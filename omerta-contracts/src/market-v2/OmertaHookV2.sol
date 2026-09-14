// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {IInitializerHook} from "../interfaces/IInitializerHook.sol";
import {IOmrV4ObservationSource} from "../interfaces/IOmrV4ObservationSource.sol";

/// @notice Immutable canonical ETH/OMR market settlement and observation layer.
/// @dev Sells retain the 9% base tax (2% dev, 1.6% RWA, 2.4% community, 3% POL).
///      Additional sell-pressure surcharge is separately owed to stability, never funding slices.
///      Exact-input fees use actual output; exact-output fees use actual input, including partial fills.
///      No strategy, oracle, recipient, or game callback executes during a swap. No owner can pause,
///      change taxes, extend the launch window, redirect accrued funds, or replace implementation.
///      Active liquidity is raw v4 L, not a claim of executable ETH depth or economic fair value.
contract OmertaHookV2 is IHooks, IInitializerHook, IOmrV4ObservationSource, ReentrancyGuard {
    uint160 public constant HOOK_FLAGS = uint160(
        Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG
            | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
            | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
    );
    uint16 public constant BASE_SELL_BPS = 900;
    uint16 public constant MAX_SURGE_BPS = 100;
    uint16 public constant MAX_HOOK_BPS = 1000;
    uint16 public constant MAX_OPENING_BLOCKS = 200;
    uint32 public constant PRESSURE_DECAY_SECONDS = 60;
    uint8 public constant DEV = 0;
    uint8 public constant RWA = 1;
    uint8 public constant COMMUNITY = 2;
    uint8 public constant POL = 3;
    uint8 public constant STABILITY = 4;

    struct OpeningConfig {
        uint16 blocks;
        uint16 buyBps;
        uint128 maxBuyQuote;
    }

    /// @dev Integral fields cover `observedSeconds`, which can be short only in the genesis epoch.
    ///      The record is finalized before it is published. Volumes are gross pool ETH deltas,
    ///      exclude hook fees, and do not imply distinct traders or manipulation-resistant demand.
    struct Epoch {
        uint64 id;
        uint64 end;
        uint32 observedSeconds;
        int128 tickSeconds;
        uint128 tickSquaredSeconds;
        uint256 liquiditySeconds;
        uint128 minLiquidity;
        uint128 buyQuote;
        uint128 sellQuote;
        uint64 swaps;
    }

    IPoolManager public immutable poolManager;
    address public immutable omr;
    address public immutable authorized;
    uint24 public immutable poolFee;
    int24 public immutable tickSpacing;
    uint32 public immutable epochDuration;
    uint24 public immutable surgeFullTicks;
    uint16 public immutable openingBlocks;
    uint16 public immutable openingBuyBps;
    uint128 public immutable openingMaxBuyQuote;
    address[5] public recipients;
    mapping(Currency => mapping(uint8 => uint256)) public owed;
    mapping(Currency => uint256) public totalOwed;

    uint64 public openedAtBlock;
    uint64 public openingEndsAtBlock;
    bool public initialized;
    int24 public lastTick;
    uint128 public lastLiquidity;
    uint64 public lastTimestamp;
    int256 private _tickCumulative;
    Epoch private _active;
    Epoch private _latest;
    uint24 public sellPressureTicks;
    uint64 public pressureUpdatedAt;
    bytes32 private constant PRE_TICK_SLOT = keccak256("omerta.v2.hook.preTick");

    error InvalidConfiguration();
    error HookAddressMismatch();
    error OnlyPoolManager();
    error PoolNotAllowed();
    error NotInitializer();
    error OpeningBuyTooLarge();
    error HookNotImplemented();
    error InvalidRecipient();
    error NotRecipient();
    error OnlyPoolManagerETH();

    event PoolOpened(PoolId indexed id, uint64 blockNumber, uint64 openingEnd);
    event FeesAccrued(address indexed sender, Currency indexed currency, bool sell, uint256 base, uint256 stability);
    event FeesPaid(Currency indexed currency, uint8 indexed bucket, address indexed recipient, uint256 amount);
    event EpochFinalized(uint64 indexed epoch, uint64 end, uint32 observedSeconds);

    constructor(
        IPoolManager manager_,
        address omr_,
        address initializer_,
        uint24 poolFee_,
        int24 tickSpacing_,
        address[5] memory recipients_,
        OpeningConfig memory opening_,
        uint24 surgeFullTicks_,
        uint32 epochDuration_
    ) {
        if (
            address(manager_) == address(0) || omr_ == address(0) || initializer_ == address(0)
                || poolFee_ > 100_000 || tickSpacing_ <= 0 || tickSpacing_ > 32767
                || opening_.blocks > MAX_OPENING_BLOCKS || opening_.buyBps > MAX_HOOK_BPS
                || (opening_.blocks == 0 && (opening_.buyBps != 0 || opening_.maxBuyQuote != 0))
                || surgeFullTicks_ == 0 || surgeFullTicks_ > 100_000
                || epochDuration_ < 60 || epochDuration_ > 1 days
        ) revert InvalidConfiguration();
        if (IERC20Metadata(omr_).decimals() != 18) revert InvalidConfiguration();
        if (uint160(address(this)) & Hooks.ALL_HOOK_MASK != HOOK_FLAGS) revert HookAddressMismatch();
        for (uint256 i; i < 5; ++i) {
            if (recipients_[i] == address(0) || recipients_[i] == address(this)) revert InvalidRecipient();
        }
        poolManager = manager_;
        omr = omr_;
        authorized = initializer_;
        poolFee = poolFee_;
        tickSpacing = tickSpacing_;
        recipients = recipients_;
        openingBlocks = opening_.blocks;
        openingBuyBps = opening_.buyBps;
        openingMaxBuyQuote = opening_.maxBuyQuote;
        surgeFullTicks = surgeFullTicks_;
        epochDuration = epochDuration_;
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        _;
    }

    receive() external payable {
        if (msg.sender != address(poolManager)) revert OnlyPoolManagerETH();
    }

    function poolKey() public view returns (PoolKey memory) {
        return PoolKey(Currency.wrap(address(0)), Currency.wrap(omr), poolFee, tickSpacing, IHooks(address(this)));
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC165).interfaceId || interfaceId == type(IInitializerHook).interfaceId
            || interfaceId == type(IOmrV4ObservationSource).interfaceId;
    }

    function getHookPermissions() external pure returns (Hooks.Permissions memory p) {
        p.beforeInitialize = true;
        p.afterInitialize = true;
        p.afterAddLiquidity = true;
        p.afterRemoveLiquidity = true;
        p.beforeSwap = true;
        p.afterSwap = true;
        p.afterSwapReturnDelta = true;
    }

    function beforeInitialize(address sender, PoolKey calldata key, uint160)
        external onlyPoolManager returns (bytes4)
    {
        _checkPool(key);
        if (sender != authorized) revert NotInitializer();
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata key, uint160, int24 tick)
        external onlyPoolManager returns (bytes4)
    {
        _checkPool(key);
        if (initialized) revert PoolNotAllowed();
        initialized = true;
        openedAtBlock = uint64(block.number);
        openingEndsAtBlock = uint64(block.number + openingBlocks);
        lastTick = tick;
        lastTimestamp = uint64(block.timestamp);
        _active = _newEpoch(uint64(block.timestamp / epochDuration));
        emit PoolOpened(key.toId(), openedAtBlock, openingEndsAtBlock);
        return IHooks.afterInitialize.selector;
    }

    function beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        external onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24)
    {
        _checkPool(key);
        // Store actual pre-swap tick, never a router-supplied trader identity or price.
        (, int24 tick,,) = StateLibrary.getSlot0(poolManager, key.toId());
        bytes32 slot = PRE_TICK_SLOT;
        assembly ("memory-safe") { tstore(slot, tick) }
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function afterSwap(address sender, PoolKey calldata key, SwapParams calldata params, BalanceDelta delta, bytes calldata)
        external onlyPoolManager returns (bytes4, int128)
    {
        _checkPool(key);
        _advance();
        _adoptPoolState(key.toId());
        return (IHooks.afterSwap.selector, _collectFee(sender, key, params, delta));
    }

    function _collectFee(address sender, PoolKey calldata key, SwapParams calldata params, BalanceDelta delta)
        private returns (int128)
    {
        bool sell = !params.zeroForOne; // currency0 ETH; currency1 OMR, always.
        uint256 quote = _abs(delta.amount0());
        if (sell) _active.sellQuote = _saturatingAdd(_active.sellQuote, quote);
        else _active.buyQuote = _saturatingAdd(_active.buyQuote, quote);
        if (_active.swaps < type(uint64).max) ++_active.swaps;
        uint16 extra = sell ? _surgeRate() : _openingRate(quote, params.amountSpecified > 0);
        bool currency0 = params.amountSpecified < 0 ? !params.zeroForOne : params.zeroForOne;
        Currency currency = currency0 ? key.currency0 : key.currency1;
        uint256 amount = _abs(currency0 ? delta.amount0() : delta.amount1());
        uint256 base = sell ? amount * BASE_SELL_BPS / 10_000 : 0;
        uint256 stability = amount * extra / 10_000;
        uint256 total = base + stability;
        if (total == 0) return 0;
        _accrueBase(currency, base);
        owed[currency][STABILITY] += stability;
        totalOwed[currency] += total;
        emit FeesAccrued(sender, currency, sell, base, stability);
        poolManager.take(currency, address(this), total);
        // <=10% of the magnitude of an int128, including its negative minimum, fits int128.
        return int128(uint128(total));
    }

    function afterAddLiquidity(address, PoolKey calldata key, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external onlyPoolManager returns (bytes4, BalanceDelta)
    {
        _afterLiquidity(key);
        return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function afterRemoveLiquidity(address, PoolKey calldata key, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external onlyPoolManager returns (bytes4, BalanceDelta)
    {
        _afterLiquidity(key);
        return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    /// @notice Anyone can pay one fixed recipient. A broken recipient cannot block other buckets.
    function sweep(Currency currency, uint8 bucket) external nonReentrant returns (uint256 amount) {
        if (bucket > STABILITY) revert InvalidRecipient();
        return _pay(currency, bucket, recipients[bucket]);
    }

    /// @notice A recipient may collect its own bucket to another destination without changing rights.
    function claim(Currency currency, uint8 bucket, address destination) external nonReentrant returns (uint256 amount) {
        if (bucket > STABILITY || destination == address(0) || destination == address(this)) revert InvalidRecipient();
        if (msg.sender != recipients[bucket]) revert NotRecipient();
        return _pay(currency, bucket, destination);
    }

    function _pay(Currency currency, uint8 bucket, address destination) private returns (uint256 amount) {
        amount = owed[currency][bucket];
        owed[currency][bucket] = 0;
        totalOwed[currency] -= amount;
        if (amount != 0) currency.transfer(destination, amount);
        emit FeesPaid(currency, bucket, destination, amount);
    }

    /// @notice Finalizes elapsed epochs even when the pool has been idle; bounded O(1) work.
    function checkpoint() external {
        if (initialized) _advance();
    }

    function latestEpoch() external view returns (Epoch memory) { return _latest; }
    function activeEpoch() external view returns (Epoch memory) { return _active; }

    function currentTickCumulative(PoolId id) external view returns (int56 cumulative, uint32 timestamp, bool ready) {
        if (!initialized || PoolId.unwrap(id) != PoolId.unwrap(poolKey().toId())) return (0, 0, false);
        int256 value = _tickCumulative + int256(lastTick) * int256(block.timestamp - lastTimestamp);
        // Deliberate v3-compatible wrapping; differences valid for windows <2^32 seconds.
        return (int56(value), uint32(block.timestamp), true);
    }

    function _checkPool(PoolKey calldata key) private view {
        if (Currency.unwrap(key.currency0) != address(0) || Currency.unwrap(key.currency1) != omr
            || key.fee != poolFee || key.tickSpacing != tickSpacing || address(key.hooks) != address(this)) {
            revert PoolNotAllowed();
        }
    }

    function _afterLiquidity(PoolKey calldata key) private {
        _checkPool(key);
        _advance();
        _adoptPoolState(key.toId());
    }

    function _adoptPoolState(PoolId id) private {
        (, lastTick,,) = StateLibrary.getSlot0(poolManager, id);
        lastLiquidity = StateLibrary.getLiquidity(poolManager, id);
    }

    function _openingRate(uint256 actualQuote, bool exactOutput) private view returns (uint16) {
        if (block.number >= openingEndsAtBlock) return 0;
        // Check actual ETH input AFTER swap, so exact-output buys and partial fills obey the same cap.
        // Reverting here atomically undoes the entire swap. No sell path enters this function.
        uint256 grossQuote = actualQuote;
        // Exact-output buys pay their opening fee in ETH; exact-input buys pay it in OMR output.
        if (exactOutput) grossQuote += actualQuote * openingBuyBps / 10_000;
        if (openingMaxBuyQuote != 0 && grossQuote > openingMaxBuyQuote) revert OpeningBuyTooLarge();
        return openingBuyBps;
    }

    /// @dev Progressive bounded tick-pressure toll. Buy reversals do not erase recent sell pressure.
    ///      Pressure decays on a real clock, not by calls or blocks. This raises repeated split-sale
    ///      costs but is not sandwich protection or a proof of order/splitting-independent pricing.
    function _surgeRate() private returns (uint16 rate) {
        uint256 elapsed = block.timestamp - pressureUpdatedAt;
        uint256 pressure = elapsed >= PRESSURE_DECAY_SECONDS
            ? 0 : uint256(sellPressureTicks) * (PRESSURE_DECAY_SECONDS - elapsed) / PRESSURE_DECAY_SECONDS;
        bytes32 slot = PRE_TICK_SLOT;
        int256 beforeTick;
        assembly ("memory-safe") { beforeTick := signextend(2, tload(slot)) }
        uint256 movement = int256(lastTick) > beforeTick ? uint256(int256(lastTick) - beforeTick) : 0;
        uint256 end = pressure + movement;
        uint256 limit = surgeFullTicks;
        // Integrate min(pressure/limit,1) over the traversed tick interval rather than charging the
        // last rate to the entire move. Weighted trade amounts still make exact partitioning nontrivial.
        if (movement == 0) rate = uint16(pressure * MAX_SURGE_BPS / limit);
        else if (end <= limit) rate = uint16((pressure + end) * MAX_SURGE_BPS / (2 * limit));
        else {
            uint256 below = limit - pressure;
            rate = uint16(MAX_SURGE_BPS - below * below * MAX_SURGE_BPS / (2 * limit * movement));
        }
        sellPressureTicks = uint24(end > limit ? limit : end);
        pressureUpdatedAt = uint64(block.timestamp);
    }

    function _accrueBase(Currency currency, uint256 base) private {
        if (base == 0) return;
        uint256 dev = base * 200 / BASE_SELL_BPS;
        uint256 rwa = base * 160 / BASE_SELL_BPS;
        uint256 community = base * 240 / BASE_SELL_BPS;
        owed[currency][DEV] += dev;
        owed[currency][RWA] += rwa;
        owed[currency][COMMUNITY] += community;
        owed[currency][POL] += base - dev - rwa - community;
    }

    function _abs(int128 value) private pure returns (uint256) {
        return value < 0 ? uint256(-int256(value)) : uint256(int256(value));
    }

    function _saturatingAdd(uint128 value, uint256 addition) private pure returns (uint128) {
        uint256 sum = uint256(value) + addition;
        return sum > type(uint128).max ? type(uint128).max : uint128(sum);
    }

    function _newEpoch(uint64 id) private view returns (Epoch memory e) {
        e.id = id;
        e.end = (id + 1) * epochDuration;
        e.minLiquidity = type(uint128).max;
    }

    function _integrate(Epoch memory e, uint32 seconds_) private view returns (Epoch memory) {
        if (seconds_ == 0) return e;
        int256 tick = lastTick;
        e.observedSeconds += seconds_;
        e.tickSeconds += int128(tick * int256(uint256(seconds_)));
        e.tickSquaredSeconds += uint128(uint256(tick * tick) * seconds_);
        e.liquiditySeconds += uint256(lastLiquidity) * seconds_;
        if (lastLiquidity < e.minLiquidity) e.minLiquidity = lastLiquidity;
        return e;
    }

    function _advance() private {
        uint64 now_ = uint64(block.timestamp);
        if (now_ == lastTimestamp) return;
        _tickCumulative += int256(lastTick) * int256(uint256(now_ - lastTimestamp));
        uint64 epoch = now_ / epochDuration;
        if (epoch == _active.id) {
            _active = _integrate(_active, uint32(now_ - lastTimestamp));
        } else {
            Epoch memory finished = _integrate(_active, uint32(_active.end - lastTimestamp));
            // There were no pool mutations/checkpoints in skipped intervals: the cached tick and
            // active L prevailed for every second. Synthesize the LAST complete quiet interval;
            // never iterate over an arbitrarily long gap or copy ancient volume into fresh epochs.
            if (epoch > finished.id + 1) finished = _integrate(_newEpoch(epoch - 1), epochDuration);
            _latest = finished;
            emit EpochFinalized(finished.id, finished.end, finished.observedSeconds);
            _active = _integrate(_newEpoch(epoch), uint32(now_ - epoch * epochDuration));
        }
        lastTimestamp = now_;
    }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata) external pure returns (bytes4) { revert HookNotImplemented(); }
    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata) external pure returns (bytes4) { revert HookNotImplemented(); }
    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) { revert HookNotImplemented(); }
    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) { revert HookNotImplemented(); }
}
