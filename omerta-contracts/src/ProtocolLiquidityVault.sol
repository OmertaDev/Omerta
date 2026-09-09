// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {FullMath} from "v4-core/libraries/FullMath.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {IPositionManager} from "../lib/v4-periphery/src/interfaces/IPositionManager.sol";
import {PositionInfo, PositionInfoLibrary} from "../lib/v4-periphery/src/libraries/PositionInfoLibrary.sol";
import {LiquidityAmounts} from "../lib/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {Actions} from "../lib/v4-periphery/src/libraries/Actions.sol";
import {IOmrOracle} from "./IOmrOracle.sol";

interface IProtocolPositionManager is IPositionManager {
    function permit2() external view returns (IAllowanceTransfer);
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

interface IProtocolInventoryExecutor {
    function omr() external view returns (address);
    function poolManager() external view returns (address);
    function poolId() external view returns (bytes32);
    function destination() external view returns (address);
    function secondaryRecipient() external view returns (address);
    function oracle() external view returns (address);
    function healthGuard() external view returns (address);
    function stream() external view returns (uint8);
    function deposit() external payable;
}

interface IProtocolGenesisController {
    function foundation() external view returns (address);
    function omr() external view returns (address);
    function poolId() external view returns (bytes32);
}

/// @notice Custodies one full-range native-ETH/OMR position. The keeper can only add
/// liquidity and fund a once-bound inventory executor; it cannot choose a pool,
/// recipient, token ID, router payload, approval target or principal withdrawal.
/// @dev The liquidity floor establishes continuously locked nominal liquidity from
/// activation. It is not a standalone valuation oracle or proof of market depth at
/// every historical price. healthy() additionally checks current in-range custody.
/// Underlying PositionManager, PoolManager, Permit2 and OMR must be reviewed direct
/// implementations; runtime pinning does not authenticate a proxy's implementation.
contract ProtocolLiquidityVault is Ownable2Step, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using PositionInfoLibrary for PositionInfo;

    uint256 public constant BPS = 10_000;
    uint256 public constant DESK_FEE_BPS = 7_500;
    uint256 public constant MAX_DEVIATION_BPS = 1_000;
    uint256 public constant MAX_DEADLINE_DELAY = 10 minutes;
    uint256 public constant MAX_WINDOW_ACTIONS = 64;

    struct Config {
        address safe;
        address keeper;
        IProtocolPositionManager positionManager;
        IAllowanceTransfer permit2;
        IOmrOracle oracle;
        PoolKey key;
        address payable deskRecipient;
        address payable vigRecipient;
        uint128 minLiquidity;
        uint32 warmup;
        uint32 maxOracleAge;
        uint16 maxDeviationBps;
        uint32 budgetWindow;
        uint128 maxNativePerAction;
        uint128 maxNativePerWindow;
        uint128 maxOmrPerAction;
        uint128 maxOmrPerWindow;
    }

    struct Spend {
        uint64 timestamp;
        uint128 nativeAmount;
        uint128 omrAmount;
    }

    error InvalidConfiguration();
    error NotKeeper();
    error AutomationPaused();
    error EmergencyLatched();
    error EmergencyNotLatched();
    error FoundationAlreadySet();
    error InvalidFoundation();
    error NotHealthy();
    error DependencyChanged();
    error BadDeadline();
    error BadAmounts();
    error OracleUnavailable();
    error PriceDeviation();
    error InsufficientInventory();
    error BudgetExceeded();
    error ActionWindowFull();
    error SettlementMismatch();
    error NativeTransferFailed();
    error InventoryExecutorAlreadySet();
    error InventoryExecutorUnset();
    error GenesisControllerAlreadySet();
    error NotGenesisController();

    event FoundationAccepted(uint256 indexed tokenId, uint128 liquidity, uint256 activationTimestamp);
    event LiquidityAdded(uint256 indexed tokenId, uint128 liquidityAdded, uint256 nativeUsed, uint256 omrUsed);
    event NativeDustRecovered(uint256 amount);
    event FeesCollected(uint256 indexed tokenId, uint256 nativeFees, uint256 omrFees);
    event InventoryExecutorSet(address indexed executor, bytes32 runtimeCodeHash);
    event InventoryFunded(address indexed executor, uint256 nativeAmount);
    event GenesisControllerSet(address indexed controller, bytes32 runtimeCodeHash);
    event KeeperSet(address indexed keeper);
    event AutomationStopped(address indexed actor);
    event AutomationResumed(uint256 activationTimestamp);
    event EmergencyLatchedBy(address indexed actor);
    event EmergencyRecovered(address indexed recipient, uint256 tokenId, uint256 nativeAmount, uint256 omrAmount);

    IProtocolPositionManager public immutable positionManager;
    IPoolManager public immutable poolManager;
    IAllowanceTransfer public immutable permit2;
    IERC20 public immutable omr;
    IOmrOracle public immutable oracle;
    bytes32 public immutable poolId;
    int24 public immutable tickLower;
    int24 public immutable tickUpper;
    uint128 public immutable minLiquidity;
    uint32 public immutable warmup;
    uint32 public immutable maxOracleAge;
    uint16 public immutable maxDeviationBps;
    uint32 public immutable budgetWindow;
    uint128 public immutable maxNativePerAction;
    uint128 public immutable maxNativePerWindow;
    uint128 public immutable maxOmrPerAction;
    uint128 public immutable maxOmrPerWindow;
    address payable public immutable deskRecipient;
    address payable public immutable vigRecipient;
    address payable public immutable emergencyRecipient;
    uint256 public immutable configuredChainId;
    bytes32 public immutable positionManagerCodeHash;
    bytes32 public immutable poolManagerCodeHash;
    bytes32 public immutable permit2CodeHash;
    bytes32 public immutable omrCodeHash;
    bytes32 public immutable oracleCodeHash;
    bytes32 public immutable hookCodeHash;

    PoolKey private _key;
    address public keeper;
    address public inventoryExecutor;
    bytes32 public inventoryExecutorCodeHash;
    address public genesisController;
    bytes32 public genesisControllerCodeHash;
    uint256 public positionId;
    uint256 public activationTimestamp;
    bool public paused;
    bool public emergencyLatched;
    uint256 public lastCollectionTimestamp;
    uint256 public totalCollectedNative;
    uint256 public totalCollectedOmr;
    uint256 public totalNativeAdded;
    uint256 public totalOmrAdded;
    uint256 public totalInventoryNativeFunded;
    Spend[64] private _spends;
    uint256 private _spendHead;
    uint256 private _spendCount;

    constructor(Config memory c) Ownable(c.safe) {
        if (
            c.keeper == address(0) || address(c.positionManager).code.length == 0
                || address(c.permit2).code.length == 0 || address(c.oracle).code.length == 0
                || Currency.unwrap(c.key.currency0) != address(0)
                || Currency.unwrap(c.key.currency1).code.length == 0
                || c.key.tickSpacing < TickMath.MIN_TICK_SPACING || c.key.tickSpacing > TickMath.MAX_TICK_SPACING
                || c.deskRecipient == address(0) || c.vigRecipient == address(0)
                || c.deskRecipient == address(this) || c.vigRecipient == address(this)
                || c.minLiquidity == 0 || c.warmup == 0 || c.maxOracleAge == 0
                || c.warmup < c.maxOracleAge || c.maxDeviationBps == 0 || c.maxDeviationBps > MAX_DEVIATION_BPS
                || c.budgetWindow == 0 || c.maxNativePerAction == 0 || c.maxOmrPerAction == 0
                || c.maxNativePerWindow < c.maxNativePerAction || c.maxOmrPerWindow < c.maxOmrPerAction
        ) revert InvalidConfiguration();
        // No liquidity callbacks or position subscribers can intervene between a
        // zero-delta fee collection and the subsequent positive-liquidity operation.
        uint160 liquidityFlags = uint160(
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG
                | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
                | Hooks.AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG
        );
        if (uint160(address(c.key.hooks)) & liquidityFlags != 0) revert InvalidConfiguration();
        if (address(c.key.hooks) != address(0) && address(c.key.hooks).code.length == 0) {
            revert InvalidConfiguration();
        }
        IPoolManager manager = c.positionManager.poolManager();
        if (address(manager).code.length == 0 || address(c.positionManager.permit2()) != address(c.permit2)) {
            revert InvalidConfiguration();
        }
        if (IERC20Metadata(Currency.unwrap(c.key.currency1)).decimals() != 18) revert InvalidConfiguration();
        _key = c.key;
        positionManager = c.positionManager;
        poolManager = manager;
        permit2 = c.permit2;
        omr = IERC20(Currency.unwrap(c.key.currency1));
        oracle = c.oracle;
        poolId = PoolId.unwrap(c.key.toId());
        tickLower = TickMath.minUsableTick(c.key.tickSpacing);
        tickUpper = TickMath.maxUsableTick(c.key.tickSpacing);
        minLiquidity = c.minLiquidity;
        warmup = c.warmup;
        maxOracleAge = c.maxOracleAge;
        maxDeviationBps = c.maxDeviationBps;
        budgetWindow = c.budgetWindow;
        maxNativePerAction = c.maxNativePerAction;
        maxNativePerWindow = c.maxNativePerWindow;
        maxOmrPerAction = c.maxOmrPerAction;
        maxOmrPerWindow = c.maxOmrPerWindow;
        deskRecipient = c.deskRecipient;
        vigRecipient = c.vigRecipient;
        emergencyRecipient = payable(c.safe);
        configuredChainId = block.chainid;
        keeper = c.keeper;
        positionManagerCodeHash = address(c.positionManager).codehash;
        poolManagerCodeHash = address(manager).codehash;
        permit2CodeHash = address(c.permit2).codehash;
        omrCodeHash = Currency.unwrap(c.key.currency1).codehash;
        oracleCodeHash = address(c.oracle).codehash;
        hookCodeHash = address(c.key.hooks).codehash;
        emit KeeperSet(c.keeper);
    }

    receive() external payable {}

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    function poolKey() external view returns (PoolKey memory) { return _key; }

    /// @notice No historical sampling claim: the invariant is that only this vault
    /// can alter the locked position and none of its live actions decrease liquidity.
    function healthy() external view returns (bool) {
        return !_reentrancyGuardEntered() && _healthy();
    }

    function currentLiquidity() public view returns (uint128) {
        if (positionId == 0) return 0;
        try positionManager.getPositionLiquidity(positionId) returns (uint128 liquidity) { return liquidity; }
        catch { return 0; }
    }

    function _healthy() private view returns (bool) {
        return !paused && !emergencyLatched && activationTimestamp != 0
            && block.timestamp >= activationTimestamp + warmup && _foundationValid(positionId);
    }

    function _dependenciesValid() private view returns (bool) {
        return block.chainid == configuredChainId && address(positionManager).codehash == positionManagerCodeHash
            && address(poolManager).codehash == poolManagerCodeHash && address(permit2).codehash == permit2CodeHash
            && address(omr).codehash == omrCodeHash && address(oracle).codehash == oracleCodeHash
            && (address(_key.hooks) == address(0) || address(_key.hooks).codehash == hookCodeHash);
    }

    function _foundationValid(uint256 id) private view returns (bool) {
        if (id == 0 || !_dependenciesValid()) return false;
        try positionManager.ownerOf(id) returns (address holder) {
            if (holder != address(this)) return false;
        } catch { return false; }
        try positionManager.getPoolAndPositionInfo(id) returns (PoolKey memory key, PositionInfo info) {
            if (PoolId.unwrap(key.toId()) != poolId || info.tickLower() != tickLower
                || info.tickUpper() != tickUpper || info.hasSubscriber()) return false;
        } catch { return false; }
        try positionManager.getPositionLiquidity(id) returns (uint128 liquidity) {
            if (liquidity < minLiquidity) return false;
        } catch { return false; }
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(PoolId.wrap(poolId));
        return sqrtPriceX96 > TickMath.getSqrtPriceAtTick(tickLower)
            && sqrtPriceX96 < TickMath.getSqrtPriceAtTick(tickUpper);
    }

    function _live() private view {
        if (emergencyLatched) revert EmergencyLatched();
        if (paused) revert AutomationPaused();
        if (!_dependenciesValid()) revert DependencyChanged();
    }

    function _deadline(uint256 deadline) private view {
        if (deadline < block.timestamp || deadline > block.timestamp + MAX_DEADLINE_DELAY) revert BadDeadline();
    }

    /// @notice Bootstrap is a governance action. Routine keepers cannot initialize
    /// economic custody from an oracle observed before this foundation existed.
    function mintFoundation(uint128 nativeMax, uint128 omrMax, uint128 minLiquidityAdded, uint256 deadline)
        external onlyOwner nonReentrant returns (uint256 id, uint128 liquidity, uint256 nativeUsed, uint256 omrUsed)
    {
        _live();
        if (positionId != 0) revert FoundationAlreadySet();
        (liquidity, nativeUsed, omrUsed) = _add(true, nativeMax, omrMax, minLiquidityAdded, deadline);
        id = positionId;
        _acceptFoundation(id);
    }

    /// @notice PositionManager mints without an ERC721 receiver callback. The Safe
    /// may register its direct genesis mint only after actual ownership is proven.
    function adoptFoundation(uint256 id) external onlyOwner nonReentrant {
        _live();
        if (positionId != 0) revert FoundationAlreadySet();
        _acceptFoundation(id);
    }

    /// @notice Governance may bind one reviewed launch controller before any
    /// foundation exists. Its sole authority is registering a qualifying position
    /// already owned by this vault; it cannot transfer assets or alter the floor.
    function setGenesisController(address controller) external onlyOwner nonReentrant {
        _live();
        if (genesisController != address(0)) revert GenesisControllerAlreadySet();
        if (positionId != 0) revert FoundationAlreadySet();
        if (controller.code.length == 0) revert InvalidConfiguration();
        IProtocolGenesisController c = IProtocolGenesisController(controller);
        if (c.foundation() != address(this) || c.omr() != address(omr) || c.poolId() != poolId) {
            revert InvalidConfiguration();
        }
        genesisController = controller;
        genesisControllerCodeHash = controller.codehash;
        emit GenesisControllerSet(controller, controller.codehash);
    }

    function adoptGenesisFoundation(uint256 id) external nonReentrant {
        _live();
        address controller = genesisController;
        if (controller == address(0) || msg.sender != controller) revert NotGenesisController();
        if (controller.codehash != genesisControllerCodeHash) revert DependencyChanged();
        if (positionId != 0) revert FoundationAlreadySet();
        _acceptFoundation(id);
    }

    function onERC721Received(address operator, address from, uint256 id, bytes calldata)
        external nonReentrant returns (bytes4)
    {
        _live();
        if (msg.sender != address(positionManager) || from != owner() || operator != owner()) revert InvalidFoundation();
        if (positionId != 0) revert FoundationAlreadySet();
        _acceptFoundation(id);
        return IERC721Receiver.onERC721Received.selector;
    }

    function _acceptFoundation(uint256 id) private {
        if (!_foundationValid(id)) revert InvalidFoundation();
        positionId = id;
        activationTimestamp = block.timestamp;
        emit FoundationAccepted(id, positionManager.getPositionLiquidity(id), block.timestamp);
    }

    function increase(uint128 nativeMax, uint128 omrMax, uint128 minLiquidityAdded, uint256 deadline)
        external onlyKeeper nonReentrant returns (uint128 liquidity, uint256 nativeUsed, uint256 omrUsed)
    {
        _live();
        if (!_healthy()) revert NotHealthy();
        return _add(false, nativeMax, omrMax, minLiquidityAdded, deadline);
    }

    function quoteLiquidity(uint128 nativeMax, uint128 omrMax) external view returns (uint128) {
        return _liquidityAtValidatedPrice(nativeMax, omrMax);
    }

    function _liquidityAtValidatedPrice(uint128 nativeMax, uint128 omrMax) private view returns (uint128 liquidity) {
        if (nativeMax == 0 || omrMax == 0) revert BadAmounts();
        (uint256 referencePrice, uint256 observedAt) = oracle.consult();
        if (referencePrice == 0 || observedAt == 0 || observedAt > block.timestamp
            || block.timestamp - observedAt > maxOracleAge) revert OracleUnavailable();
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(PoolId.wrap(poolId));
        uint160 lower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 upper = TickMath.getSqrtPriceAtTick(tickUpper);
        if (sqrtPriceX96 <= lower || sqrtPriceX96 >= upper) revert PriceDeviation();
        uint256 spot = FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96) * 1e18, uint256(1) << 192);
        uint256 difference = spot > referencePrice ? spot - referencePrice : referencePrice - spot;
        if (difference > FullMath.mulDiv(referencePrice, maxDeviationBps, BPS)) revert PriceDeviation();
        liquidity = LiquidityAmounts.getLiquidityForAmounts(sqrtPriceX96, lower, upper, nativeMax, omrMax);
        if (liquidity == 0) revert BadAmounts();
    }

    function _add(bool minting, uint128 nativeMax, uint128 omrMax, uint128 minimum, uint256 deadline)
        private returns (uint128 liquidity, uint256 nativeUsed, uint256 omrUsed)
    {
        _deadline(deadline);
        liquidity = _liquidityAtValidatedPrice(nativeMax, omrMax);
        if (minimum == 0 || liquidity < minimum || (minting && liquidity < minLiquidity)) revert BadAmounts();
        // Fees stay reserved in this contract until after the addition. No recipient
        // callback can swap between collection and add, and no liquidity hook/subscriber exists.
        (uint256 nativeFees, uint256 omrFees) = minting ? (uint256(0), uint256(0)) : _collectIntoVault(deadline);
        uint256 nativeBefore = address(this).balance;
        uint256 omrBefore = omr.balanceOf(address(this));
        if (nativeBefore < uint256(nativeMax) + nativeFees || omrBefore < uint256(omrMax) + omrFees) {
            revert InsufficientInventory();
        }
        uint256 slot = _reserveSpend(nativeMax, omrMax);
        uint256 id = minting ? positionManager.nextTokenId() : positionId;
        uint128 beforeLiquidity = minting ? 0 : positionManager.getPositionLiquidity(id);
        bytes[] memory params = new bytes[](3);
        params[0] = minting
            ? abi.encode(_key, tickLower, tickUpper, uint256(liquidity), nativeMax, omrMax, address(this), bytes(""))
            : abi.encode(id, uint256(liquidity), nativeMax, omrMax, bytes(""));
        params[1] = abi.encode(_key.currency0, _key.currency1);
        params[2] = abi.encode(_key.currency0, address(this));
        bytes memory actions = abi.encodePacked(
            uint8(minting ? Actions.MINT_POSITION : Actions.INCREASE_LIQUIDITY),
            uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP)
        );
        omr.forceApprove(address(permit2), omrMax);
        permit2.approve(address(omr), address(positionManager), uint160(omrMax), uint48(deadline));
        // SWEEP returns the unused msg.value. Account separately for permissionless
        // pre-existing PositionManager native dust so it cannot disguise our spend.
        uint256 pmDust = address(positionManager).balance;
        positionManager.modifyLiquidities{value: nativeMax}(abi.encode(actions, params), deadline);
        permit2.approve(address(omr), address(positionManager), 0, 0);
        omr.forceApprove(address(permit2), 0);
        uint256 nativeAfter = address(this).balance;
        uint256 omrAfter = omr.balanceOf(address(this));
        if (nativeAfter > nativeBefore + pmDust || omrAfter > omrBefore) revert SettlementMismatch();
        nativeUsed = nativeBefore + pmDust - nativeAfter;
        omrUsed = omrBefore - omrAfter;
        if (nativeUsed > nativeMax || omrUsed > omrMax || nativeUsed == 0 || omrUsed == 0) revert SettlementMismatch();
        if (positionManager.ownerOf(id) != address(this)
            || positionManager.getPositionLiquidity(id) != uint256(beforeLiquidity) + liquidity) revert SettlementMismatch();
        if (minting) positionId = id;
        _spends[slot].nativeAmount = uint128(nativeUsed);
        _spends[slot].omrAmount = uint128(omrUsed);
        totalNativeAdded += nativeUsed;
        totalOmrAdded += omrUsed;
        if (pmDust != 0) emit NativeDustRecovered(pmDust);
        emit LiquidityAdded(id, liquidity, nativeUsed, omrUsed);
        _routeFees(nativeFees, omrFees);
    }

    /// @notice An estimate using the same fee-growth recurrence as v4 Position.update.
    function pendingFees() external view returns (uint256 nativeFees, uint256 omrFees) {
        if (positionId == 0 || !_dependenciesValid()) return (0, 0);
        (uint128 liquidity, uint256 last0, uint256 last1) = poolManager.getPositionInfo(
            PoolId.wrap(poolId), address(positionManager), tickLower, tickUpper, bytes32(positionId)
        );
        (uint256 inside0, uint256 inside1) = poolManager.getFeeGrowthInside(PoolId.wrap(poolId), tickLower, tickUpper);
        unchecked {
            nativeFees = FullMath.mulDiv(inside0 - last0, liquidity, uint256(1) << 128);
            omrFees = FullMath.mulDiv(inside1 - last1, liquidity, uint256(1) << 128);
        }
    }

    /// @notice Permissionless: only fees of the fixed position are collected and all
    /// proceeds go to the two immutable recipients. Caller receives nothing.
    function collectFees(uint256 deadline) external nonReentrant returns (uint256 nativeFees, uint256 omrFees) {
        _live();
        _deadline(deadline);
        if (!_foundationValid(positionId)) revert InvalidFoundation();
        (nativeFees, omrFees) = _collectIntoVault(deadline);
        _routeFees(nativeFees, omrFees);
    }

    function _collectIntoVault(uint256 deadline) private returns (uint256 nativeFees, uint256 omrFees) {
        uint256 nativeBefore = address(this).balance;
        uint256 omrBefore = omr.balanceOf(address(this));
        uint128 liquidityBefore = positionManager.getPositionLiquidity(positionId);
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(positionId, uint256(0), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(_key.currency0, _key.currency1, address(this));
        positionManager.modifyLiquidities(
            abi.encode(abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR)), params), deadline
        );
        if (positionManager.getPositionLiquidity(positionId) != liquidityBefore
            || address(this).balance < nativeBefore || omr.balanceOf(address(this)) < omrBefore) revert SettlementMismatch();
        nativeFees = address(this).balance - nativeBefore;
        omrFees = omr.balanceOf(address(this)) - omrBefore;
    }

    function _routeFees(uint256 nativeFees, uint256 omrFees) private {
        if (nativeFees == 0 && omrFees == 0) return;
        lastCollectionTimestamp = block.timestamp;
        totalCollectedNative += nativeFees;
        totalCollectedOmr += omrFees;
        uint256 nativeDesk = nativeFees * DESK_FEE_BPS / BPS;
        uint256 omrDesk = omrFees * DESK_FEE_BPS / BPS;
        _sendNative(deskRecipient, nativeDesk);
        _sendNative(vigRecipient, nativeFees - nativeDesk);
        if (omrDesk != 0) omr.safeTransfer(deskRecipient, omrDesk);
        if (omrFees != omrDesk) omr.safeTransfer(vigRecipient, omrFees - omrDesk);
        emit FeesCollected(positionId, nativeFees, omrFees);
    }

    function setInventoryExecutor(address executor) external onlyOwner nonReentrant {
        if (inventoryExecutor != address(0)) revert InventoryExecutorAlreadySet();
        if (emergencyLatched) revert EmergencyLatched();
        if (executor.code.length == 0) revert InvalidConfiguration();
        IProtocolInventoryExecutor e = IProtocolInventoryExecutor(executor);
        if (e.omr() != address(omr) || e.poolManager() != address(poolManager)
            || e.poolId() != poolId || e.destination() != address(this) || e.secondaryRecipient() != address(0)
            || e.oracle() != address(oracle) || e.healthGuard() != address(this)
            || e.stream() != 3) revert InvalidConfiguration(); // LiquidityBuybackExecutor.Stream.Pol
        inventoryExecutor = executor;
        inventoryExecutorCodeHash = executor.codehash;
        emit InventoryExecutorSet(executor, executor.codehash);
    }

    function fundInventory(uint128 nativeAmount) external onlyKeeper nonReentrant {
        _live();
        if (!_healthy()) revert NotHealthy();
        address executor = inventoryExecutor;
        if (executor == address(0)) revert InventoryExecutorUnset();
        if (executor.codehash != inventoryExecutorCodeHash) revert DependencyChanged();
        if (nativeAmount == 0) revert BadAmounts();
        if (address(this).balance < nativeAmount) revert InsufficientInventory();
        _reserveSpend(nativeAmount, 0);
        totalInventoryNativeFunded += nativeAmount;
        IProtocolInventoryExecutor(executor).deposit{value: nativeAmount}();
        emit InventoryFunded(executor, nativeAmount);
    }

    /// @notice True trailing-window limits; boundary-adjacent executions do not get
    /// two fresh budgets. At most 64 spend actions per window keeps all scans bounded.
    function budgetAvailable() public view returns (uint256 nativeAvailable, uint256 omrAvailable) {
        (uint256 nativeSpent, uint256 omrSpent) = _activeSpend();
        nativeAvailable = maxNativePerWindow - nativeSpent;
        omrAvailable = maxOmrPerWindow - omrSpent;
        if (nativeAvailable > maxNativePerAction) nativeAvailable = maxNativePerAction;
        if (omrAvailable > maxOmrPerAction) omrAvailable = maxOmrPerAction;
    }

    function _activeSpend() private view returns (uint256 nativeSpent, uint256 omrSpent) {
        for (uint256 i; i < _spendCount; ++i) {
            Spend memory s = _spends[(_spendHead + i) % MAX_WINDOW_ACTIONS];
            if (block.timestamp < uint256(s.timestamp) + budgetWindow) {
                nativeSpent += s.nativeAmount;
                omrSpent += s.omrAmount;
            }
        }
    }

    function _reserveSpend(uint128 nativeAmount, uint128 omrAmount) private returns (uint256 slot) {
        (uint256 nativeAvailable, uint256 omrAvailable) = budgetAvailable();
        if (nativeAmount > nativeAvailable || omrAmount > omrAvailable) revert BudgetExceeded();
        while (_spendCount != 0 && block.timestamp >= uint256(_spends[_spendHead].timestamp) + budgetWindow) {
            delete _spends[_spendHead];
            _spendHead = (_spendHead + 1) % MAX_WINDOW_ACTIONS;
            --_spendCount;
        }
        if (_spendCount == MAX_WINDOW_ACTIONS) revert ActionWindowFull();
        slot = (_spendHead + _spendCount) % MAX_WINDOW_ACTIONS;
        _spends[slot] = Spend(uint64(block.timestamp), nativeAmount, omrAmount);
        ++_spendCount;
    }

    function pauseAutomation() external {
        if (msg.sender != owner() && msg.sender != keeper) revert NotKeeper();
        paused = true;
        activationTimestamp = 0;
        emit AutomationStopped(msg.sender);
    }

    function setKeeper(address nextKeeper) external onlyOwner {
        if (!paused || nextKeeper == address(0)) revert InvalidConfiguration();
        keeper = nextKeeper;
        emit KeeperSet(nextKeeper);
    }

    function resumeAutomation() external onlyOwner nonReentrant {
        if (emergencyLatched) revert EmergencyLatched();
        if (!paused || !_dependenciesValid() || (positionId != 0 && !_foundationValid(positionId))) {
            revert InvalidFoundation();
        }
        paused = false;
        // A pre-bootstrap pause must be recoverable without fabricating custody
        // or starting the warmup before a qualifying position has been accepted.
        activationTimestamp = positionId == 0 ? 0 : block.timestamp;
        emit AutomationResumed(activationTimestamp);
    }

    /// @notice A keeper can permanently stop but never recover principal. Recovery
    /// belongs to governance and only returns to the original immutable Safe.
    function latchEmergency() external {
        if (msg.sender != owner() && msg.sender != keeper) revert NotKeeper();
        emergencyLatched = true;
        paused = true;
        activationTimestamp = 0;
        emit EmergencyLatchedBy(msg.sender);
    }

    function recoverEmergency() external onlyOwner nonReentrant {
        if (!emergencyLatched) revert EmergencyNotLatched();
        uint256 id = positionId;
        positionId = 0;
        if (id != 0) positionManager.safeTransferFrom(address(this), emergencyRecipient, id);
        uint256 nativeAmount = address(this).balance;
        uint256 omrAmount = omr.balanceOf(address(this));
        if (omrAmount != 0) omr.safeTransfer(emergencyRecipient, omrAmount);
        _sendNative(emergencyRecipient, nativeAmount);
        emit EmergencyRecovered(emergencyRecipient, id, nativeAmount, omrAmount);
    }

    function renounceOwnership() public override onlyOwner { revert InvalidConfiguration(); }

    function _sendNative(address payable recipient, uint256 amount) private {
        if (amount == 0) return;
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert NativeTransferFailed();
    }
}
