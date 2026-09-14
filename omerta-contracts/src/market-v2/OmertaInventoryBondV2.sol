// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {IOmertaMarketStateV2} from "./IOmertaMarketStateV2.sol";

/// @notice Finite treasury-inventory bonds for large ETH purchases of linearly vested OMR.
/// @dev There is no mint authority, firm market bid, sellback, callable adapter, or guaranteed
///      redemption value. OMR is reserved from funded inventory at purchase; native proceeds
///      are separately owed to the immutable reserve recipient. Buys do not replace the hook's
///      canonical sell path or exempt a later holder's market sale from its existing funding tax.
contract OmertaInventoryBondV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    struct Config {
        address safe;
        address proceedsRecipient;
        IPoolManager manager;
        PoolKey key;
        IOmertaMarketStateV2 marketState;
        uint32 maxObservationAge;
        uint32 vestingSeconds;
        uint128 minLiquidity;
        uint24 maxSpotDeviationTicks;
        uint16 discountBps;
        uint128 minNativePurchase;
        uint128 maxNativePurchase;
        uint128 maxNativePerEpoch;
        uint128 maxNativeLifetime;
        uint128 maxOmrPerPurchase;
        uint128 maxOmrPerEpoch;
        uint128 maxOmrLifetime;
        uint256 maxOmrPerEth;
    }

    struct Note {
        address beneficiary;
        uint64 start;
        uint64 end;
        uint128 amount;
        uint128 claimed;
    }

    error BadConfiguration();
    error Unauthorized();
    error Paused();
    error InvalidQuote();
    error InvalidObservation();
    error BudgetExceeded();
    error InsufficientInventory();
    error Replay();
    error NoClaim();
    error TransferFailed();

    event InventoryFunded(address indexed donor, uint256 omrAmount);
    event Purchased(
        bytes32 indexed noteId,
        address indexed buyer,
        uint64 indexed epoch,
        uint256 nativePaid,
        uint256 omrReserved,
        uint64 vestingEnd
    );
    event Claimed(bytes32 indexed noteId, address indexed beneficiary, uint256 omrAmount);
    event ProceedsClaimed(address indexed recipient, uint256 nativeAmount);
    event InventoryRetired(uint256 omrAmount);
    event PauseSet(bool paused);

    address public immutable safe;
    address public immutable proceedsRecipient;
    IPoolManager public immutable manager;
    PoolId public immutable poolId;
    IERC20 public immutable omr;
    IOmertaMarketStateV2 public immutable marketState;
    uint32 public immutable maxObservationAge;
    uint32 public immutable vestingSeconds;
    uint128 public immutable minLiquidity;
    uint24 public immutable maxSpotDeviationTicks;
    uint16 public immutable discountBps;
    uint128 public immutable minNativePurchase;
    uint128 public immutable maxNativePurchase;
    uint128 public immutable maxNativePerEpoch;
    uint128 public immutable maxNativeLifetime;
    uint128 public immutable maxOmrPerPurchase;
    uint128 public immutable maxOmrPerEpoch;
    uint128 public immutable maxOmrLifetime;
    uint256 public immutable maxOmrPerEth;
    bool public paused;
    uint256 public availableInventory;
    uint256 public outstandingClaims;
    uint256 public proceedsOwed;
    uint256 public nativePurchased;
    uint256 public omrPurchased;
    uint64 public lastPurchaseEpoch;
    uint64 public lastPurchaseObservedAt;
    uint256 public epochNativePurchased;
    uint256 public epochOmrPurchased;
    mapping(bytes32 => Note) public notes;

    constructor(Config memory c) {
        if (
            c.safe == address(0) || c.proceedsRecipient == address(0) || c.proceedsRecipient == address(this)
                || address(c.manager).code.length == 0 || address(c.marketState).code.length == 0
                || Currency.unwrap(c.key.currency0) != address(0) || Currency.unwrap(c.key.currency1).code.length == 0
                || address(c.key.hooks).code.length == 0 || c.maxObservationAge == 0 || c.maxObservationAge > 1 days
                || c.vestingSeconds < 1 days || c.vestingSeconds > 365 days || c.minLiquidity == 0
                || c.maxSpotDeviationTicks == 0 || c.maxSpotDeviationTicks > 2000 || c.discountBps > 1000
                || c.minNativePurchase == 0 || c.minNativePurchase > c.maxNativePurchase
                || c.maxNativePurchase > c.maxNativePerEpoch || c.maxNativePerEpoch > c.maxNativeLifetime
                || c.maxOmrPerPurchase == 0 || c.maxOmrPerPurchase > c.maxOmrPerEpoch
                || c.maxOmrPerEpoch > c.maxOmrLifetime || c.maxOmrPerEth == 0
        ) revert BadConfiguration();
        safe = c.safe;
        proceedsRecipient = c.proceedsRecipient;
        manager = c.manager;
        poolId = c.key.toId();
        omr = IERC20(Currency.unwrap(c.key.currency1));
        marketState = c.marketState;
        maxObservationAge = c.maxObservationAge;
        vestingSeconds = c.vestingSeconds;
        minLiquidity = c.minLiquidity;
        maxSpotDeviationTicks = c.maxSpotDeviationTicks;
        discountBps = c.discountBps;
        minNativePurchase = c.minNativePurchase;
        maxNativePurchase = c.maxNativePurchase;
        maxNativePerEpoch = c.maxNativePerEpoch;
        maxNativeLifetime = c.maxNativeLifetime;
        maxOmrPerPurchase = c.maxOmrPerPurchase;
        maxOmrPerEpoch = c.maxOmrPerEpoch;
        maxOmrLifetime = c.maxOmrLifetime;
        maxOmrPerEth = c.maxOmrPerEth;
    }

    function fundInventory(uint256 amount) external nonReentrant {
        if (amount == 0) revert InsufficientInventory();
        uint256 beforeBalance = omr.balanceOf(address(this));
        omr.safeTransferFrom(msg.sender, address(this), amount);
        if (omr.balanceOf(address(this)) - beforeBalance != amount) revert InsufficientInventory();
        availableInventory += amount;
        emit InventoryFunded(msg.sender, amount);
    }

    function setPaused(bool value) external {
        if (msg.sender != safe) revert Unauthorized();
        paused = value;
        emit PauseSet(value);
    }

    /// @notice Nontransferable receipts bind beneficiary and nonce; exact retry cannot reserve twice.
    /// Slippage and expected epoch bind a purchase to a concrete published quote. No signature
    /// grants inventory or issuance authority; finite aggregate limits apply across all buyers.
    function purchase(uint64 expectedEpoch, uint256 minimumOmr, uint64 deadline, bytes32 nonce)
        external
        payable
        nonReentrant
        returns (bytes32 id, uint256 amount)
    {
        if (paused) revert Paused();
        if (
            nonce == bytes32(0) || deadline < block.timestamp || deadline > block.timestamp + 5 minutes
                || msg.value < minNativePurchase || msg.value > maxNativePurchase || minimumOmr == 0
        ) revert InvalidQuote();
        IOmertaMarketStateV2.Snapshot memory s = _observation(expectedEpoch);
        id = keccak256(abi.encode(block.chainid, address(this), msg.sender, nonce));
        if (notes[id].beneficiary != address(0)) revert Replay();
        amount = _price(msg.value, s.omrPerEth);
        if (amount < minimumOmr) revert InvalidQuote();
        if (s.epoch < lastPurchaseEpoch || s.observedAt < lastPurchaseObservedAt) revert InvalidObservation();
        if (s.epoch > lastPurchaseEpoch) {
            // The epoch is trusted only as a unique published observation. Time cannot regress.
            if (lastPurchaseEpoch != 0 && s.observedAt <= lastPurchaseObservedAt) revert InvalidObservation();
            epochNativePurchased = 0;
            epochOmrPurchased = 0;
            lastPurchaseEpoch = s.epoch;
            lastPurchaseObservedAt = s.observedAt;
        }
        if (
            amount > maxOmrPerPurchase || nativePurchased + msg.value > maxNativeLifetime
                || omrPurchased + amount > maxOmrLifetime || epochNativePurchased + msg.value > maxNativePerEpoch
                || epochOmrPurchased + amount > maxOmrPerEpoch
        ) revert BudgetExceeded();
        if (amount > availableInventory) revert InsufficientInventory();
        availableInventory -= amount;
        outstandingClaims += amount;
        proceedsOwed += msg.value;
        nativePurchased += msg.value;
        omrPurchased += amount;
        epochNativePurchased += msg.value;
        epochOmrPurchased += amount;
        uint64 end = uint64(block.timestamp + vestingSeconds);
        notes[id] = Note(msg.sender, uint64(block.timestamp), end, uint128(amount), 0);
        emit Purchased(id, msg.sender, s.epoch, msg.value, amount, end);
    }

    function quote(uint256 nativeAmount, uint64 expectedEpoch) external view returns (uint256 amount) {
        if (nativeAmount < minNativePurchase || nativeAmount > maxNativePurchase) revert InvalidQuote();
        return _price(nativeAmount, _observation(expectedEpoch).omrPerEth);
    }

    /// @notice Claims remain available during oracle outages, exhausted sale budgets and pauses.
    /// Anyone may settle a claim; funds always reach the recorded beneficiary.
    function claim(bytes32 id) external nonReentrant returns (uint256 amount) {
        Note storage n = notes[id];
        amount = claimable(id);
        if (amount == 0) revert NoClaim();
        n.claimed += uint128(amount);
        outstandingClaims -= amount;
        omr.safeTransfer(n.beneficiary, amount);
        emit Claimed(id, n.beneficiary, amount);
    }

    function claimable(bytes32 id) public view returns (uint256) {
        Note memory n = notes[id];
        if (n.beneficiary == address(0) || block.timestamp <= n.start) return 0;
        uint256 vested =
            block.timestamp >= n.end ? n.amount : Math.mulDiv(n.amount, block.timestamp - n.start, n.end - n.start);
        return vested - n.claimed;
    }

    function claimProceeds() external nonReentrant {
        uint256 amount = proceedsOwed;
        proceedsOwed = 0;
        if (amount != 0) {
            (bool ok,) = proceedsRecipient.call{value: amount}("");
            if (!ok) revert TransferFailed();
        }
        emit ProceedsClaimed(proceedsRecipient, amount);
    }

    /// @notice Safe can retire only unpromised inventory. Note collateral is never withdrawable.
    function retireInventory(uint256 amount) external nonReentrant {
        if (msg.sender != safe) revert Unauthorized();
        if (amount > availableInventory) revert InsufficientInventory();
        availableInventory -= amount;
        omr.safeTransfer(safe, amount);
        emit InventoryRetired(amount);
    }

    function _price(uint256 nativeAmount, uint256 omrPerEth) private view returns (uint256) {
        // A D% discount on ETH/OMR price produces OMR/ETH divided by (1-D), rounded down.
        uint256 atMarket = Math.mulDiv(nativeAmount, omrPerEth, 1 ether);
        return Math.mulDiv(atMarket, 10_000, 10_000 - discountBps);
    }

    function _observation(uint64 epoch) private view returns (IOmertaMarketStateV2.Snapshot memory s) {
        s = marketState.snapshot();
        if (
            !s.valid || s.epoch == 0 || s.epoch != epoch || s.observedAt == 0 || s.observedAt > block.timestamp
                || block.timestamp - s.observedAt > maxObservationAge || s.omrPerEth == 0 || s.omrPerEth > maxOmrPerEth
                || s.minLiquidity < minLiquidity || manager.getLiquidity(poolId) < minLiquidity
        ) revert InvalidObservation();
        (uint160 spot, int24 tick,,) = manager.getSlot0(poolId);
        int256 difference = int256(tick) - s.meanTick;
        if (difference < 0) difference = -difference;
        if (spot == 0 || uint256(difference) > maxSpotDeviationTicks) revert InvalidObservation();
    }
}
