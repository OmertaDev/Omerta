// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {SqrtPriceMath} from "v4-core/libraries/SqrtPriceMath.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {LiquidityAmounts} from "../../lib/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {IOmertaMarketStateV2} from "./IOmertaMarketStateV2.sol";

/// @notice Funded, compartmentalized range liquidity under immutable execution limits.
/// @dev Native ETH is currency0 and OMR is currency1: DOWN in OMR/ETH economic value is
///      UP in raw v4 ticks. Positions remain reversible inventory until actually removed.
///      This contract neither promises a floor nor mints OMR. Safe can pause and retire
///      capital to itself, but cannot change pool, recipients, limits, or issue arbitrary calls.
contract OmertaStabilityControllerV2 is ReentrancyGuard, IUnlockCallback {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    enum Tranche {
        Core,
        LowerCushion,
        Garrison,
        UpperCushion,
        Desk,
        WarChest,
        Turf
    }
    enum Operation {
        Add,
        Collect,
        Exit
    }

    struct Limits {
        uint128 nativePerAction;
        uint128 omrPerAction;
        uint128 nativePerEpisode;
        uint128 omrPerEpisode;
        uint128 nativeLifetime;
        uint128 omrLifetime;
        uint128 nativeRegeneration;
        uint128 omrRegeneration;
    }

    struct Config {
        address safe;
        IPoolManager manager;
        PoolKey key;
        IOmertaMarketStateV2 marketState;
        address[7] feeRecipients;
        Limits[7] limits;
        uint32 maxObservationAge;
        uint32 cooldown;
        uint32 recoveryInterval;
        uint128 minLiquidity;
        uint24 maxSpotDeviationTicks;
        uint24 minBandTicks;
        uint24 maxBandTicks;
        uint16 stressOnBps;
        uint16 stressOffBps;
        uint8 recoveryX;
        uint8 recoveryY;
        int24 turfLower;
        int24 turfUpper;
        uint64 turfSeasonStart;
        uint64 turfSeasonEnd;
    }

    struct Account {
        uint256 idleNative;
        uint256 idleOmr;
        uint256 nativeFees;
        uint256 omrFees;
        uint256 nativeDeployed;
        uint256 omrDeployed;
        uint256 nativeReturned;
        uint256 omrReturned;
        uint128 nativeCapacity;
        uint128 omrCapacity;
        uint64 lastDeploymentEpoch;
        uint64 lastDeploymentAt;
        uint64 lastRecoveryEpoch;
        uint64 lastRecoveryAt;
        uint32 recoveryVotes;
        uint8 recoverySamples;
    }

    struct Position {
        int24 lower;
        int24 upper;
        uint128 liquidity;
        uint64 nonce;
        uint64 deployedBlock;
    }

    error BadConfiguration();
    error Unauthorized();
    error Paused();
    error InvalidObservation();
    error InsufficientDepth();
    error SpotDeviation();
    error InvalidTranche();
    error ActivePosition();
    error NoPosition();
    error BudgetExhausted();
    error Cooldown();
    error WrongRegime();
    error RecoveryNotReady();
    error BadSettlement();
    error BadCallback();
    error TransferFailed();

    event Funded(Tranche indexed tranche, address indexed donor, uint256 nativeAmount, uint256 omrAmount);
    event Deployed(Tranche indexed tranche, uint64 indexed epoch, int24 lower, int24 upper, uint128 liquidity);
    event PrincipalMoved(Tranche indexed tranche, bool deployed, uint256 nativeAmount, uint256 omrAmount);
    event FeesCollected(Tranche indexed tranche, uint256 nativeAmount, uint256 omrAmount);
    event FeesClaimed(Tranche indexed tranche, address indexed recipient, uint256 nativeAmount, uint256 omrAmount);
    event Exited(Tranche indexed tranche, uint64 nonce);
    event RecoveryObserved(Tranche indexed tranche, uint64 indexed epoch, bool recovered);
    event Regenerated(Tranche indexed tranche, uint256 nativeAmount, uint256 omrAmount);
    event Retired(Tranche indexed tranche, uint256 nativeAmount, uint256 omrAmount);
    event PauseSet(bool paused);
    event StressLatched(bool stressed, uint64 indexed epoch);

    address public immutable safe;
    IPoolManager public immutable manager;
    IOmertaMarketStateV2 public immutable marketState;
    IERC20 public immutable omr;
    PoolId public immutable poolId;
    uint32 public immutable maxObservationAge;
    uint32 public immutable cooldown;
    uint32 public immutable recoveryInterval;
    uint128 public immutable minLiquidity;
    uint24 public immutable maxSpotDeviationTicks;
    uint24 public immutable minBandTicks;
    uint24 public immutable maxBandTicks;
    uint16 public immutable stressOnBps;
    uint16 public immutable stressOffBps;
    uint8 public immutable recoveryX;
    uint8 public immutable recoveryY;
    int24 public immutable turfLower;
    int24 public immutable turfUpper;
    uint64 public immutable turfSeasonStart;
    uint64 public immutable turfSeasonEnd;
    PoolKey private _key;
    address[7] public feeRecipients;
    Limits[7] private _limits;
    Account[7] private _accounts;
    Position[7] private _positions;
    bool public paused;
    bool public stressed;
    uint64 public lastRegimeEpoch;
    uint64 public lastRegimeAt;
    uint256 public totalIdleNative;
    uint256 public totalIdleOmr;
    uint256 public totalNativeFees;
    uint256 public totalOmrFees;
    uint256[7] public claimedNativeFees;
    uint256[7] public claimedOmrFees;
    bytes32 private _callbackHash;

    constructor(Config memory c) {
        // LP return deltas would let another hook redefine the principal/fee split.
        uint160 prohibited =
            Hooks.AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG;
        if (
            c.safe == address(0) || address(c.manager).code.length == 0 || address(c.marketState).code.length == 0
                || Currency.unwrap(c.key.currency0) != address(0) || Currency.unwrap(c.key.currency1).code.length == 0
                || address(c.key.hooks).code.length == 0 || uint160(address(c.key.hooks)) & prohibited != 0
                || c.key.tickSpacing <= 0 || c.key.tickSpacing > 200 || c.maxObservationAge == 0
                || c.maxObservationAge > 1 days || c.cooldown < 1 minutes || c.recoveryInterval < 1 minutes
                || c.minLiquidity == 0 || c.maxSpotDeviationTicks == 0 || c.maxSpotDeviationTicks > 2000
                || c.minBandTicks < uint24(c.key.tickSpacing) || c.maxBandTicks < c.minBandTicks
                || c.maxBandTicks > 10000 || c.stressOnBps > 10000 || c.stressOnBps <= c.stressOffBps
                || c.recoveryX == 0 || c.recoveryX > c.recoveryY || c.recoveryY > 32
        ) revert BadConfiguration();
        if (
            c.turfLower < TickMath.MIN_TICK || c.turfUpper > TickMath.MAX_TICK || c.turfLower >= c.turfUpper
                || c.turfLower % c.key.tickSpacing != 0 || c.turfUpper % c.key.tickSpacing != 0
                || c.turfSeasonStart == 0 || c.turfSeasonEnd <= c.turfSeasonStart
                || c.turfSeasonEnd - c.turfSeasonStart > 366 days
        ) revert BadConfiguration();
        safe = c.safe;
        manager = c.manager;
        marketState = c.marketState;
        omr = IERC20(Currency.unwrap(c.key.currency1));
        _key = c.key;
        poolId = c.key.toId();
        maxObservationAge = c.maxObservationAge;
        cooldown = c.cooldown;
        recoveryInterval = c.recoveryInterval;
        minLiquidity = c.minLiquidity;
        maxSpotDeviationTicks = c.maxSpotDeviationTicks;
        minBandTicks = c.minBandTicks;
        maxBandTicks = c.maxBandTicks;
        stressOnBps = c.stressOnBps;
        stressOffBps = c.stressOffBps;
        recoveryX = c.recoveryX;
        recoveryY = c.recoveryY;
        turfLower = c.turfLower;
        turfUpper = c.turfUpper;
        turfSeasonStart = c.turfSeasonStart;
        turfSeasonEnd = c.turfSeasonEnd;
        for (uint256 i; i < 7; ++i) {
            Limits memory l = c.limits[i];
            if (
                c.feeRecipients[i] == address(0) || c.feeRecipients[i] == address(this)
                    || l.nativePerAction > l.nativePerEpisode || l.omrPerAction > l.omrPerEpisode
                    || l.nativePerEpisode > l.nativeLifetime || l.omrPerEpisode > l.omrLifetime
                    || l.nativeRegeneration > l.nativePerEpisode || l.omrRegeneration > l.omrPerEpisode
            ) revert BadConfiguration();
            feeRecipients[i] = c.feeRecipients[i];
            _limits[i] = l;
            _accounts[i].nativeCapacity = l.nativePerEpisode;
            _accounts[i].omrCapacity = l.omrPerEpisode;
        }
    }

    /// @dev Only actual PoolManager withdrawals arrive through receive. Donations use fund.
    receive() external payable {
        if (msg.sender != address(manager)) revert Unauthorized();
    }

    function poolKey() external view returns (PoolKey memory) {
        return _key;
    }

    function limits(Tranche t) external view returns (Limits memory) {
        return _limits[uint256(t)];
    }

    function account(Tranche t) external view returns (Account memory) {
        return _accounts[uint256(t)];
    }

    function position(Tranche t) external view returns (Position memory) {
        return _positions[uint256(t)];
    }

    /// @notice Deposits are gifts to this immutable compartment, not withdrawable LP shares.
    /// Funding adds assets; it never resets deployment capacity or lifetime spend.
    function fund(Tranche t, uint256 omrAmount) external payable nonReentrant {
        if (msg.value == 0 && omrAmount == 0) revert BudgetExhausted();
        uint256 beforeOmr = omr.balanceOf(address(this));
        if (omrAmount != 0) omr.safeTransferFrom(msg.sender, address(this), omrAmount);
        if (omr.balanceOf(address(this)) - beforeOmr != omrAmount) revert BadSettlement();
        Account storage a = _accounts[uint256(t)];
        a.idleNative += msg.value;
        a.idleOmr += omrAmount;
        totalIdleNative += msg.value;
        totalIdleOmr += omrAmount;
        emit Funded(t, msg.sender, msg.value, omrAmount);
    }

    function setPaused(bool value) external {
        if (msg.sender != safe) revert Unauthorized();
        paused = value;
        emit PauseSet(value);
    }

    /// @notice Permissionless deterministic placement; caller chooses neither price nor amounts.
    /// Every placement consumes immutable per-action, per-observation, episode and lifetime limits.
    function deploy(Tranche t, uint64 expectedEpoch) external nonReentrant {
        if (paused) revert Paused();
        if (t == Tranche.WarChest) revert InvalidTranche();
        if (t == Tranche.Turf && (block.timestamp < turfSeasonStart || block.timestamp >= turfSeasonEnd)) {
            revert WrongRegime();
        }
        IOmertaMarketStateV2.Snapshot memory s = _observation(expectedEpoch);
        _updateRegime(s);
        if (_downside(t) && !stressed) revert WrongRegime();
        if (_upside(t) && stressed) revert WrongRegime();
        Account storage a = _accounts[uint256(t)];
        Position storage p = _positions[uint256(t)];
        if (p.liquidity != 0) revert ActivePosition();
        if (s.epoch <= a.lastDeploymentEpoch || block.timestamp < uint256(a.lastDeploymentAt) + cooldown) {
            revert Cooldown();
        }
        (uint160 sqrtPrice,,,) = manager.getSlot0(poolId);
        (p.lower, p.upper) = _range(t, s);
        if (
            (_downside(t) && sqrtPrice > TickMath.getSqrtPriceAtTick(p.lower))
                || (_upside(t) && sqrtPrice < TickMath.getSqrtPriceAtTick(p.upper))
        ) revert SpotDeviation();
        Limits storage l = _limits[uint256(t)];
        uint256 budget0 =
            _min(_min(a.idleNative, l.nativePerAction), _min(a.nativeCapacity, l.nativeLifetime - a.nativeDeployed));
        uint256 budget1 = _min(_min(a.idleOmr, l.omrPerAction), _min(a.omrCapacity, l.omrLifetime - a.omrDeployed));
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPrice, TickMath.getSqrtPriceAtTick(p.lower), TickMath.getSqrtPriceAtTick(p.upper), budget0, budget1
        );
        if (liquidity == 0 || liquidity > uint128(type(int128).max)) revert BudgetExhausted();
        ++p.nonce;
        p.deployedBlock = uint64(block.number);
        a.lastDeploymentEpoch = s.epoch;
        a.lastDeploymentAt = uint64(block.timestamp);
        _modify(t, Operation.Add, liquidity, budget0, budget1);
        p.liquidity = liquidity;
        emit Deployed(t, s.epoch, p.lower, p.upper, liquidity);
    }

    /// @notice Fee collection never needs an oracle, a keeper, or an unpaused strategy.
    function collect(Tranche t) external nonReentrant {
        if (_positions[uint256(t)].liquidity == 0) revert NoPosition();
        _modify(t, Operation.Collect, 0, 0, 0);
    }

    /// @notice Owner can always remove inventory, including during an oracle outage.
    function exit(Tranche t) external nonReentrant {
        if (msg.sender != safe) revert Unauthorized();
        _exit(t);
    }

    /// @notice Season expiry can be settled without governance, strategy readiness, or an oracle.
    /// Principal stays in Turf custody; earned fees remain owed to its immutable beneficiary.
    function expireTurf() external nonReentrant {
        if (block.timestamp < turfSeasonEnd) revert WrongRegime();
        if (_positions[uint256(Tranche.Turf)].liquidity != 0) _exit(Tranche.Turf);
    }

    /// @notice Anyone can settle a band that has fully converted in its intended direction.
    /// This is an actual withdrawal: reversing price before this transaction reverses inventory.
    function finalize(Tranche t) external nonReentrant {
        Position storage p = _positions[uint256(t)];
        (uint160 spot,,,) = manager.getSlot0(poolId);
        if (p.liquidity == 0 || block.number <= p.deployedBlock) revert NoPosition();
        if (!((_downside(t) && spot >= TickMath.getSqrtPriceAtTick(p.upper))
                    || (_upside(t) && spot <= TickMath.getSqrtPriceAtTick(p.lower)))) revert WrongRegime();
        _exit(t);
    }

    function _exit(Tranche t) private {
        Position storage p = _positions[uint256(t)];
        if (p.liquidity == 0) revert NoPosition();
        uint128 liquidity = p.liquidity;
        p.liquidity = 0;
        _modify(t, Operation.Exit, liquidity, 0, 0);
        emit Exited(t, p.nonce);
    }

    /// @notice Transferred only to the constructor-pinned beneficiary, independent of capital.
    function claimFees(Tranche t) external nonReentrant {
        Account storage a = _accounts[uint256(t)];
        uint256 amount0 = a.nativeFees;
        uint256 amount1 = a.omrFees;
        a.nativeFees = 0;
        a.omrFees = 0;
        totalNativeFees -= amount0;
        totalOmrFees -= amount1;
        claimedNativeFees[uint256(t)] += amount0;
        claimedOmrFees[uint256(t)] += amount1;
        _send(feeRecipients[uint256(t)], amount0, amount1);
        emit FeesClaimed(t, feeRecipients[uint256(t)], amount0, amount1);
    }

    /// @notice Records at most one fresh observation per spaced interval, never repeated epochs.
    /// Recovery requires the entire Y-sample window to have been observed, and X healthy samples.
    function observeRecovery(Tranche t, uint64 expectedEpoch) external nonReentrant {
        if (!_downside(t) && !_upside(t)) revert InvalidTranche();
        IOmertaMarketStateV2.Snapshot memory s = _observation(expectedEpoch);
        Account storage a = _accounts[uint256(t)];
        if (
            s.epoch <= a.lastRecoveryEpoch || s.observedAt <= a.lastRecoveryAt
                || s.observedAt < uint256(a.lastRecoveryAt) + recoveryInterval
        ) revert Cooldown();
        bool recovered = s.stressBps <= stressOffBps && s.sellImbalanceBps <= stressOffBps;
        // Gaps do not count as unobserved healthy samples and cannot stitch distant windows.
        if (a.lastRecoveryAt != 0 && s.observedAt > uint256(a.lastRecoveryAt) + uint256(recoveryInterval) * 2) {
            a.recoveryVotes = 0;
            a.recoverySamples = 0;
        }
        uint32 mask = recoveryY == 32 ? type(uint32).max : uint32((uint256(1) << recoveryY) - 1);
        a.recoveryVotes = ((a.recoveryVotes << 1) | (recovered ? 1 : 0)) & mask;
        if (a.recoverySamples < recoveryY) ++a.recoverySamples;
        a.lastRecoveryEpoch = s.epoch;
        a.lastRecoveryAt = s.observedAt;
        _updateRegime(s);
        emit RecoveryObserved(t, s.epoch, recovered);
    }

    /// @notice Partial regeneration consumes actual idle WarChest funds and the whole recovery
    /// window. It never increases lifetime limits or treats returned inventory as fresh capacity.
    function regenerate(Tranche t, uint64 expectedEpoch) external nonReentrant {
        if (paused) revert Paused();
        if (!_downside(t) && !_upside(t)) revert InvalidTranche();
        IOmertaMarketStateV2.Snapshot memory s = _observation(expectedEpoch);
        Account storage a = _accounts[uint256(t)];
        if (
            s.epoch != a.lastRecoveryEpoch || s.stressBps > stressOffBps || s.sellImbalanceBps > stressOffBps
                || a.recoverySamples < recoveryY || _popcount(a.recoveryVotes) < recoveryX
                || _positions[uint256(t)].liquidity != 0
        ) revert RecoveryNotReady();
        Limits storage l = _limits[uint256(t)];
        Account storage reserve = _accounts[uint256(Tranche.WarChest)];
        uint256 amount0 = _min(
            _min(reserve.idleNative, l.nativeRegeneration),
            _min(l.nativePerEpisode - a.nativeCapacity, l.nativeLifetime - a.nativeDeployed)
        );
        uint256 amount1 = _min(
            _min(reserve.idleOmr, l.omrRegeneration),
            _min(l.omrPerEpisode - a.omrCapacity, l.omrLifetime - a.omrDeployed)
        );
        if (amount0 == 0 && amount1 == 0) revert BudgetExhausted();
        reserve.idleNative -= amount0;
        reserve.idleOmr -= amount1;
        a.idleNative += amount0;
        a.idleOmr += amount1;
        a.nativeCapacity += uint128(amount0);
        a.omrCapacity += uint128(amount1);
        a.recoveryVotes = 0;
        a.recoverySamples = 0;
        emit Regenerated(t, amount0, amount1);
    }

    /// @notice Explicit governance retirement to the immutable Safe, without touching fee debts.
    function retire(Tranche t, uint256 nativeAmount, uint256 omrAmount) external nonReentrant {
        if (msg.sender != safe) revert Unauthorized();
        Account storage a = _accounts[uint256(t)];
        a.idleNative -= nativeAmount;
        a.idleOmr -= omrAmount;
        totalIdleNative -= nativeAmount;
        totalIdleOmr -= omrAmount;
        _send(safe, nativeAmount, omrAmount);
        emit Retired(t, nativeAmount, omrAmount);
    }

    /// @notice Mark-to-inventory token amounts at the actual pool price, excluding uncollected fees.
    function positionInventory(Tranche t) external view returns (uint256 nativeAmount, uint256 omrAmount) {
        Position memory p = _positions[uint256(t)];
        if (p.liquidity == 0) return (0, 0);
        (uint160 spot,,,) = manager.getSlot0(poolId);
        uint160 lower = TickMath.getSqrtPriceAtTick(p.lower);
        uint160 upper = TickMath.getSqrtPriceAtTick(p.upper);
        if (spot < upper) {
            nativeAmount = SqrtPriceMath.getAmount0Delta(spot > lower ? spot : lower, upper, p.liquidity, false);
        }
        if (spot > lower) {
            omrAmount = SqrtPriceMath.getAmount1Delta(lower, spot < upper ? spot : upper, p.liquidity, false);
        }
    }

    function previewRange(Tranche t, uint64 expectedEpoch) external view returns (int24 lower, int24 upper) {
        if (t == Tranche.WarChest) revert InvalidTranche();
        return _range(t, _observation(expectedEpoch));
    }

    function _observation(uint64 epoch) private view returns (IOmertaMarketStateV2.Snapshot memory s) {
        s = marketState.snapshot();
        if (
            !s.valid || s.epoch == 0 || s.epoch != epoch || s.observedAt == 0 || s.observedAt > block.timestamp
                || block.timestamp - s.observedAt > maxObservationAge || s.omrPerEth == 0 || s.stressBps > 10000
                || s.sellImbalanceBps > 10000
        ) revert InvalidObservation();
        if (s.minLiquidity < minLiquidity || manager.getLiquidity(poolId) < minLiquidity) revert InsufficientDepth();
        (uint160 spot, int24 tick,,) = manager.getSlot0(poolId);
        if (spot == 0) revert InvalidObservation();
        int256 difference = int256(tick) - s.meanTick;
        if (difference < 0) difference = -difference;
        if (uint256(difference) > maxSpotDeviationTicks) revert SpotDeviation();
    }

    function _updateRegime(IOmertaMarketStateV2.Snapshot memory s) private {
        if (s.epoch < lastRegimeEpoch || s.observedAt < lastRegimeAt) revert InvalidObservation();
        if (s.epoch == lastRegimeEpoch) return;
        lastRegimeEpoch = s.epoch;
        lastRegimeAt = s.observedAt;
        bool next = stressed ? s.stressBps > stressOffBps : s.stressBps >= stressOnBps;
        if (next != stressed) {
            stressed = next;
            emit StressLatched(next, s.epoch);
        }
    }

    function _range(Tranche t, IOmertaMarketStateV2.Snapshot memory s) private view returns (int24 lower, int24 upper) {
        if (t == Tranche.Turf) return (turfLower, turfUpper);
        int256 spacing = _key.tickSpacing;
        int256 anchor = int256(s.meanTick) / spacing;
        if (s.meanTick < 0 && int256(s.meanTick) % spacing != 0) --anchor;
        anchor *= spacing;
        uint256 width = uint256(s.volatilityTicks) * 2;
        width = width < minBandTicks ? minBandTicks : (width > maxBandTicks ? maxBandTicks : width);
        int256 step = int256((width + uint256(spacing) - 1) / uint256(spacing)) * spacing;
        int256 lo;
        int256 hi;
        if (t == Tranche.LowerCushion) {
            lo = anchor + step;
            hi = anchor + step * 2;
        } else if (t == Tranche.Garrison) {
            lo = anchor + step * 2;
            hi = anchor + step * 3;
        } else if (t == Tranche.UpperCushion) {
            lo = anchor - step * 2;
            hi = anchor - step;
        } else if (t == Tranche.Desk) {
            lo = anchor - step * 3;
            hi = anchor - step * 2;
        } else if (t == Tranche.Core) {
            lo = anchor - step * 4;
            hi = anchor + step * 4;
        } else {
            lo = anchor - step;
            hi = anchor + step;
        }
        if (lo < TickMath.MIN_TICK || hi > TickMath.MAX_TICK || lo >= hi) revert InvalidObservation();
        return (int24(lo), int24(hi));
    }

    function _modify(Tranche t, Operation op, uint128 liquidity, uint256 budget0, uint256 budget1) private {
        bytes memory data = abi.encode(t, op, liquidity, budget0, budget1);
        _callbackHash = keccak256(data);
        manager.unlock(data);
        if (_callbackHash != bytes32(0)) revert BadCallback();
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(manager) || _callbackHash == bytes32(0) || keccak256(data) != _callbackHash) {
            revert BadCallback();
        }
        _callbackHash = bytes32(0);
        (Tranche t, Operation op, uint128 liquidity, uint256 budget0, uint256 budget1) =
            abi.decode(data, (Tranche, Operation, uint128, uint256, uint256));
        Position storage p = _positions[uint256(t)];
        int256 change = op == Operation.Add
            ? int256(uint256(liquidity))
            : op == Operation.Exit ? -int256(uint256(liquidity)) : int256(0);
        (BalanceDelta delta, BalanceDelta fees) = manager.modifyLiquidity(
            _key, ModifyLiquidityParams(p.lower, p.upper, change, keccak256(abi.encode(t, p.nonce))), ""
        );
        int256 principal0 = int256(delta.amount0()) - fees.amount0();
        int256 principal1 = int256(delta.amount1()) - fees.amount1();
        if (fees.amount0() < 0 || fees.amount1() < 0) revert BadSettlement();
        Account storage a = _accounts[uint256(t)];
        if (op == Operation.Add) {
            if (principal0 > 0 || principal1 > 0 || uint256(-principal0) > budget0 || uint256(-principal1) > budget1) {
                revert BadSettlement();
            }
            uint256 amount0 = uint256(-principal0);
            uint256 amount1 = uint256(-principal1);
            a.idleNative -= amount0;
            a.idleOmr -= amount1;
            totalIdleNative -= amount0;
            totalIdleOmr -= amount1;
            a.nativeCapacity -= uint128(amount0);
            a.omrCapacity -= uint128(amount1);
            a.nativeDeployed += amount0;
            a.omrDeployed += amount1;
            emit PrincipalMoved(t, true, amount0, amount1);
        } else {
            if (principal0 < 0 || principal1 < 0 || (op == Operation.Collect && (principal0 != 0 || principal1 != 0))) {
                revert BadSettlement();
            }
            a.idleNative += uint256(principal0);
            a.idleOmr += uint256(principal1);
            totalIdleNative += uint256(principal0);
            totalIdleOmr += uint256(principal1);
            a.nativeReturned += uint256(principal0);
            a.omrReturned += uint256(principal1);
            if (op == Operation.Exit) emit PrincipalMoved(t, false, uint256(principal0), uint256(principal1));
        }
        uint256 fee0 = uint256(uint128(fees.amount0()));
        uint256 fee1 = uint256(uint128(fees.amount1()));
        a.nativeFees += fee0;
        a.omrFees += fee1;
        totalNativeFees += fee0;
        totalOmrFees += fee1;
        if (fee0 != 0 || fee1 != 0) emit FeesCollected(t, fee0, fee1);
        _settle(_key.currency0, delta.amount0());
        _settle(_key.currency1, delta.amount1());
        return "";
    }

    function _settle(Currency currency, int128 delta) private {
        if (delta > 0) {
            manager.take(currency, address(this), uint256(uint128(delta)));
        } else if (delta < 0) {
            uint256 amount = uint256(-int256(delta));
            if (Currency.unwrap(currency) == address(0)) {
                // A previous ERC20 sync can persist through the unlock. Explicitly select ETH.
                manager.sync(currency);
                if (manager.settle{value: amount}() != amount) revert BadSettlement();
            } else {
                manager.sync(currency);
                omr.safeTransfer(address(manager), amount);
                if (manager.settle() != amount) revert BadSettlement();
            }
        }
    }

    function _send(address to, uint256 amount0, uint256 amount1) private {
        if (amount0 != 0) {
            (bool ok,) = to.call{value: amount0}("");
            if (!ok) revert TransferFailed();
        }
        if (amount1 != 0) omr.safeTransfer(to, amount1);
    }

    function _downside(Tranche t) private pure returns (bool) {
        return t == Tranche.LowerCushion || t == Tranche.Garrison;
    }

    function _upside(Tranche t) private pure returns (bool) {
        return t == Tranche.UpperCushion || t == Tranche.Desk;
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    function _popcount(uint32 n) private pure returns (uint256 count) {
        while (n != 0) {
            n &= n - 1;
            ++count;
        }
    }
}
