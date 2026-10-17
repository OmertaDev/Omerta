// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import {Hooks} from "v4-core/libraries/Hooks.sol";
import {Pool} from "v4-core/libraries/Pool.sol";
import {SafeCast} from "v4-core/libraries/SafeCast.sol";
import {Position} from "v4-core/libraries/Position.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {NoDelegateCall} from "v4-core/NoDelegateCall.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IProtocolFees} from "v4-core/interfaces/IProtocolFees.sol";
import {ProtocolFeeLibrary} from "v4-core/libraries/ProtocolFeeLibrary.sol";
import {Owned} from "solmate/src/auth/Owned.sol";
import {IOmertaRestrictedOMRV2} from "../IOmertaRestrictedOMRV2.sol";
import {ERC6909Claims} from "v4-core/ERC6909Claims.sol";
import {ERC6909} from "v4-core/ERC6909.sol";
import {IERC6909Claims} from "v4-core/interfaces/external/IERC6909Claims.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {BalanceDelta, BalanceDeltaLibrary, toBalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "v4-core/types/BeforeSwapDelta.sol";
import {Lock} from "v4-core/libraries/Lock.sol";
import {CurrencyDelta} from "v4-core/libraries/CurrencyDelta.sol";
import {NonzeroDeltaCount} from "v4-core/libraries/NonzeroDeltaCount.sol";
import {CurrencyReserves} from "v4-core/libraries/CurrencyReserves.sol";
import {Extsload} from "v4-core/Extsload.sol";
import {Exttload} from "v4-core/Exttload.sol";
import {CustomRevert} from "v4-core/libraries/CustomRevert.sol";

/// @dev Storage-identical local copy of v4 ProtocolFees. Withdrawal guards are delegated to the
/// manager so the inherited storage prefix and the StateLibrary pool slot remain unchanged.
abstract contract OmertaProtocolFeesV2 is IProtocolFees, Owned {
    using ProtocolFeeLibrary for uint24;
    using Pool for Pool.State;
    using CustomRevert for bytes4;

    mapping(Currency currency => uint256 amount) public protocolFeesAccrued;
    address public protocolFeeController;

    constructor(address initialOwner) Owned(initialOwner) {}

    function setProtocolFeeController(address controller) external onlyOwner {
        protocolFeeController = controller;
        emit ProtocolFeeControllerUpdated(controller);
    }

    function setProtocolFee(PoolKey memory key, uint24 newProtocolFee) external {
        _checkRestrictedOperator();
        _checkPoolKey(key);
        if (msg.sender != protocolFeeController) InvalidCaller.selector.revertWith();
        if (!newProtocolFee.isValidProtocolFee()) ProtocolFeeTooLarge.selector.revertWith(newProtocolFee);
        PoolId id = key.toId();
        _getPool(id).setProtocolFee(newProtocolFee);
        emit ProtocolFeeUpdated(id, newProtocolFee);
    }

    function collectProtocolFees(address recipient, Currency currency, uint256 amount)
        external returns (uint256 amountCollected)
    {
        _checkRestrictedOperator();
        _checkCurrency(currency);
        if (msg.sender != protocolFeeController) InvalidCaller.selector.revertWith();
        _beginWithdrawal(currency);
        amountCollected = (amount == 0) ? protocolFeesAccrued[currency] : amount;
        protocolFeesAccrued[currency] -= amountCollected;
        currency.transfer(recipient, amountCollected);
        _endWithdrawal();
    }

    function _getPool(PoolId id) internal view virtual returns (Pool.State storage);
    function _isUnlocked() internal view virtual returns (bool);
    function _checkRestrictedOperator() internal view virtual;
    function _checkPoolKey(PoolKey memory key) internal view virtual;
    function _checkCurrency(Currency currency) internal view virtual;
    function _beginWithdrawal(Currency currency) internal virtual;
    function _endWithdrawal() internal virtual;

    function _updateProtocolFees(Currency currency, uint256 amount) internal {
        unchecked { protocolFeesAccrued[currency] += amount; }
    }
}

/// @title OMERTA restricted LP settlement manager
/// @notice Every raw ETH/OMR swap pays the immutable 5% trade fee in either direction.
/// @dev Fork of the vendored v4 PoolManager. Core storage and settlement accounting are preserved;
/// restriction and revenue fields are appended after the pool mapping. This guarantee covers this
/// manager's swaps, not markets in independent receipts or third-party custody claims.
contract OmertaPoolManagerV2 is IPoolManager, OmertaProtocolFeesV2, NoDelegateCall, ERC6909Claims, Extsload, Exttload {
    using SafeCast for *;
    using Pool for *;
    using Hooks for IHooks;
    using CurrencyDelta for Currency;
    using LPFeeLibrary for uint24;
    using CurrencyReserves for Currency;
    using CustomRevert for bytes4;

    int24 private constant MAX_TICK_SPACING = TickMath.MAX_TICK_SPACING;

    int24 private constant MIN_TICK_SPACING = TickMath.MIN_TICK_SPACING;

    mapping(PoolId id => Pool.State) internal _pools;

    uint16 public constant TRADE_FEE_BPS = 500;
    bytes32 public constant revenuePolicyId = keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_500_BOTH_DIRECTIONS");
    address public immutable omr;
    address public immutable developerRecipient;
    address public immutable rwaRecipient;
    address public immutable communityRecipient;
    address public immutable polRecipient;
    mapping(Currency currency => mapping(uint8 bucket => uint256 amount)) public owed;
    mapping(Currency currency => uint256 amount) public totalOwed;
    uint256 private _withdrawalGuard = 1;
    /// @notice Actual raw OMR turnover, once per successful swap; LP changes/donations are excluded.
    mapping(uint256 utcDay => uint256 amount) public dailyOmrVolume;
    /// @notice The first full UTC day observed by this deployment (deployment's partial day is excluded).
    uint256 public immutable volumeTrackingStartDay = block.timestamp / 1 days + 1;

    error InvalidRestrictedConfiguration();
    error RestrictedPolicyNotSealed();
    error RestrictedOperatorRequired();
    error RestrictedPoolNotAllowed();
    error RestrictedHookNotAllowed();
    error RestrictedCurrencyNotAllowed();
    error ClaimsNotTransferable();
    error WithdrawalWhileUnlocked();
    error WithdrawalReentered();
    error InvalidRevenueBucket();
    error OnlyRevenueRecipient();

    event TradeRevenueAccrued(address indexed caller, PoolId indexed poolId, Currency indexed currency, uint256 amount);
    event TradeRevenueClaimed(Currency indexed currency, uint8 indexed bucket, address indexed recipient, uint256 amount);

    modifier onlyRestrictedPolicy() {
        _checkRestrictedPolicy();
        _;
    }

    modifier onlyOperator() {
        _checkRestrictedOperator();
        _;
    }

    /// @notice This will revert if the contract is locked
    modifier onlyWhenUnlocked() {
        if (!Lock.isUnlocked()) ManagerLocked.selector.revertWith();
        _;
    }

    constructor(address omr_, address owner_, address[4] memory recipients_) OmertaProtocolFeesV2(owner_) {
        if (omr_ == address(0) || omr_.code.length == 0 || owner_ == address(0)) {
            revert InvalidRestrictedConfiguration();
        }
        for (uint256 i; i < recipients_.length; ++i) {
            if (recipients_[i] == address(0) || recipients_[i] == address(this)) {
                revert InvalidRestrictedConfiguration();
            }
        }
        omr = omr_;
        developerRecipient = recipients_[0];
        rwaRecipient = recipients_[1];
        communityRecipient = recipients_[2];
        polRecipient = recipients_[3];
    }

    /// @inheritdoc IPoolManager
    function unlock(bytes calldata data) external onlyOperator override returns (bytes memory result) {
        if (Lock.isUnlocked()) AlreadyUnlocked.selector.revertWith();

        Lock.unlock();

        // the caller does everything in this callback, including paying what they owe via calls to settle
        result = IUnlockCallback(msg.sender).unlockCallback(data);

        if (NonzeroDeltaCount.read() != 0) CurrencyNotSettled.selector.revertWith();
        Lock.lock();
    }

    /// @inheritdoc IPoolManager
    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external onlyRestrictedPolicy noDelegateCall returns (int24 tick) {
        _checkPoolKey(key);
        // see TickBitmap.sol for overflow conditions that can arise from tick spacing being too large
        if (key.tickSpacing > MAX_TICK_SPACING) TickSpacingTooLarge.selector.revertWith(key.tickSpacing);
        if (key.tickSpacing < MIN_TICK_SPACING) TickSpacingTooSmall.selector.revertWith(key.tickSpacing);
        if (key.currency0 >= key.currency1) {
            CurrenciesOutOfOrderOrEqual.selector.revertWith(
                Currency.unwrap(key.currency0), Currency.unwrap(key.currency1)
            );
        }
        if (!key.hooks.isValidHookAddress(key.fee)) Hooks.HookAddressNotValid.selector.revertWith(address(key.hooks));

        uint24 lpFee = key.fee.getInitialLPFee();

        key.hooks.beforeInitialize(key, sqrtPriceX96);

        PoolId id = key.toId();

        tick = _pools[id].initialize(sqrtPriceX96, lpFee);

        // event is emitted before the afterInitialize call to ensure events are always emitted in order
        // emit all details of a pool key. poolkeys are not saved in storage and must always be provided by the caller
        // the key's fee may be a static fee or a sentinel to denote a dynamic fee.
        emit Initialize(id, key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks, sqrtPriceX96, tick);

        key.hooks.afterInitialize(key, sqrtPriceX96, tick);
    }

    /// @inheritdoc IPoolManager
    function modifyLiquidity(PoolKey memory key, ModifyLiquidityParams memory params, bytes calldata hookData)
        external
        onlyOperator
        onlyWhenUnlocked
        noDelegateCall
        returns (BalanceDelta callerDelta, BalanceDelta feesAccrued)
    {
        _checkPoolKey(key);
        PoolId id = key.toId();
        {
            Pool.State storage pool = _getPool(id);
            pool.checkPoolInitialized();

            key.hooks.beforeModifyLiquidity(key, params, hookData);

            BalanceDelta principalDelta;
            (principalDelta, feesAccrued) = pool.modifyLiquidity(
                Pool.ModifyLiquidityParams({
                    owner: msg.sender,
                    tickLower: params.tickLower,
                    tickUpper: params.tickUpper,
                    liquidityDelta: params.liquidityDelta.toInt128(),
                    tickSpacing: key.tickSpacing,
                    salt: params.salt
                })
            );

            // fee delta and principal delta are both accrued to the caller
            callerDelta = principalDelta + feesAccrued;
        }

        // event is emitted before the afterModifyLiquidity call to ensure events are always emitted in order
        emit ModifyLiquidity(id, msg.sender, params.tickLower, params.tickUpper, params.liquidityDelta, params.salt);

        BalanceDelta hookDelta;
        (callerDelta, hookDelta) = key.hooks.afterModifyLiquidity(key, params, callerDelta, feesAccrued, hookData);

        // if the hook doesn't have the flag to be able to return deltas, hookDelta will always be 0
        if (hookDelta != BalanceDeltaLibrary.ZERO_DELTA) _accountPoolBalanceDelta(key, hookDelta, address(key.hooks));

        _accountPoolBalanceDelta(key, callerDelta, msg.sender);
    }

    /// @inheritdoc IPoolManager
    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData)
        external
        onlyOperator
        onlyWhenUnlocked
        noDelegateCall
        returns (BalanceDelta swapDelta)
    {
        _checkPoolKey(key);
        if (params.amountSpecified == 0) SwapAmountCannotBeZero.selector.revertWith();
        BeforeSwapDelta beforeSwapDelta;
        {
            PoolId id = key.toId();
            Pool.State storage pool = _getPool(id);
            pool.checkPoolInitialized();
            int256 amountToSwap;
            uint24 lpFeeOverride;
            (amountToSwap, beforeSwapDelta, lpFeeOverride) = key.hooks.beforeSwap(key, params, hookData);

            // execute swap, account protocol fees, and emit swap event
            // _swap is needed to avoid stack too deep error
            swapDelta = _swap(
                pool,
                id,
                Pool.SwapParams({
                    tickSpacing: key.tickSpacing,
                    zeroForOne: params.zeroForOne,
                    amountSpecified: amountToSwap,
                    sqrtPriceLimitX96: params.sqrtPriceLimitX96,
                    lpFeeOverride: lpFeeOverride
                }),
                params.zeroForOne ? key.currency0 : key.currency1 // input token
            );
        }

        // _checkPoolKey pins OMR as currency1. Use filled raw delta, before trade/hook fees.
        // Any later swap/unlock revert also rolls back the counter.
        int256 rawOmr = int256(swapDelta.amount1());
        dailyOmrVolume[block.timestamp / 1 days] += uint256(rawOmr < 0 ? -rawOmr : rawOmr);
        uint256 tradeFee = _accrueTradeRevenue(key, params, swapDelta);
        BalanceDelta hookDelta;
        (swapDelta, hookDelta) = key.hooks.afterSwap(key, params, swapDelta, hookData, beforeSwapDelta);
        {
            // 500 = 10 * 50, so dividing the rounded base fee by 10 gives exactly the rounded
            // 50-bps limit on the same raw magnitude. Every approved hook shares the 5.5% combined cap.
            int256 maxHookFee = int256(tradeFee / (TRADE_FEE_BPS / 50));
            if (int256(hookDelta.amount0()) > maxHookFee || int256(hookDelta.amount1()) > maxHookFee) {
                revert RestrictedHookNotAllowed();
            }
        }

        // if the hook doesn't have the flag to be able to return deltas, hookDelta will always be 0
        if (hookDelta != BalanceDeltaLibrary.ZERO_DELTA) _accountPoolBalanceDelta(key, hookDelta, address(key.hooks));

        _accountPoolBalanceDelta(key, swapDelta, msg.sender);
        // The fee debt was accounted independently before the hook. Return the same final amount
        // the caller must settle, without accounting this reduced delta a second time.
        swapDelta = _subtractTradeFee(params, swapDelta, tradeFee);
    }

    /// @notice Internal swap function to execute a swap, take protocol fees on input token, and emit the swap event
    function _swap(Pool.State storage pool, PoolId id, Pool.SwapParams memory params, Currency inputCurrency)
        internal
        returns (BalanceDelta)
    {
        (BalanceDelta delta, uint256 amountToProtocol, uint24 swapFee, Pool.SwapResult memory result) =
            pool.swap(params);

        // the fee is on the input currency
        if (amountToProtocol > 0) _updateProtocolFees(inputCurrency, amountToProtocol);

        // event is emitted before the afterSwap call to ensure events are always emitted in order
        emit Swap(
            id,
            msg.sender,
            delta.amount0(),
            delta.amount1(),
            result.sqrtPriceX96,
            result.liquidity,
            result.tick,
            swapFee
        );

        return delta;
    }

    /// @inheritdoc IPoolManager
    function donate(PoolKey memory key, uint256 amount0, uint256 amount1, bytes calldata hookData)
        external
        onlyOperator
        onlyWhenUnlocked
        noDelegateCall
        returns (BalanceDelta delta)
    {
        _checkPoolKey(key);
        PoolId poolId = key.toId();
        Pool.State storage pool = _getPool(poolId);
        pool.checkPoolInitialized();

        key.hooks.beforeDonate(key, amount0, amount1, hookData);

        delta = pool.donate(amount0, amount1);

        _accountPoolBalanceDelta(key, delta, msg.sender);

        // event is emitted before the afterDonate call to ensure events are always emitted in order
        emit Donate(poolId, msg.sender, amount0, amount1);

        key.hooks.afterDonate(key, amount0, amount1, hookData);
    }

    /// @inheritdoc IPoolManager
    function sync(Currency currency) external onlyOperator {
        _checkCurrency(currency);
        // address(0) is used for the native currency
        if (currency.isAddressZero()) {
            // The reserves balance is not used for native settling, so we only need to reset the currency.
            CurrencyReserves.resetCurrency();
        } else {
            uint256 balance = currency.balanceOfSelf();
            CurrencyReserves.syncCurrencyAndReserves(currency, balance);
        }
    }

    /// @inheritdoc IPoolManager
    function take(Currency currency, address to, uint256 amount) external onlyOperator onlyWhenUnlocked {
        _checkCurrency(currency);
        unchecked {
            // negation must be safe as amount is not negative
            _accountDelta(currency, -(amount.toInt128()), msg.sender);
            currency.transfer(to, amount);
        }
    }

    /// @inheritdoc IPoolManager
    function settle() external payable onlyOperator onlyWhenUnlocked returns (uint256) {
        return _settle(msg.sender);
    }

    /// @inheritdoc IPoolManager
    function settleFor(address recipient) external payable onlyOperator onlyWhenUnlocked returns (uint256) {
        return _settle(recipient);
    }

    /// @inheritdoc IPoolManager
    function clear(Currency currency, uint256 amount) external onlyOperator onlyWhenUnlocked {
        _checkCurrency(currency);
        int256 current = currency.getDelta(msg.sender);
        // Because input is `uint256`, only positive amounts can be cleared.
        int128 amountDelta = amount.toInt128();
        if (amountDelta != current) MustClearExactPositiveDelta.selector.revertWith();
        // negation must be safe as amountDelta is positive
        unchecked {
            _accountDelta(currency, -(amountDelta), msg.sender);
        }
    }

    /// @inheritdoc IPoolManager
    function mint(address to, uint256 id, uint256 amount) external onlyOperator onlyWhenUnlocked {
        unchecked {
            Currency currency = CurrencyLibrary.fromId(id);
            _checkCurrency(currency);
            // negation must be safe as amount is not negative
            _accountDelta(currency, -(amount.toInt128()), msg.sender);
            _mint(to, currency.toId(), amount);
        }
    }

    /// @inheritdoc IPoolManager
    function burn(address from, uint256 id, uint256 amount) external onlyOperator onlyWhenUnlocked {
        Currency currency = CurrencyLibrary.fromId(id);
        _checkCurrency(currency);
        _accountDelta(currency, amount.toInt128(), msg.sender);
        _burnFrom(from, currency.toId(), amount);
    }

    /// @inheritdoc IPoolManager
    function updateDynamicLPFee(PoolKey memory key, uint24 newDynamicLPFee) external onlyOperator {
        _checkPoolKey(key);
        if (!key.fee.isDynamicFee() || msg.sender != address(key.hooks)) {
            UnauthorizedDynamicLPFeeUpdate.selector.revertWith();
        }
        newDynamicLPFee.validate();
        PoolId id = key.toId();
        _pools[id].setLPFee(newDynamicLPFee);
    }

    // if settling native, integrators should still call `sync` first to avoid DoS attack vectors
    function _settle(address recipient) internal returns (uint256 paid) {
        Currency currency = CurrencyReserves.getSyncedCurrency();
        _checkCurrency(currency);

        // if not previously synced, or the syncedCurrency slot has been reset, expects native currency to be settled
        if (currency.isAddressZero()) {
            paid = msg.value;
        } else {
            if (msg.value > 0) NonzeroNativeValue.selector.revertWith();
            // Reserves are guaranteed to be set because currency and reserves are always set together
            uint256 reservesBefore = CurrencyReserves.getSyncedReserves();
            uint256 reservesNow = currency.balanceOfSelf();
            paid = reservesNow - reservesBefore;
            CurrencyReserves.resetCurrency();
        }

        _accountDelta(currency, paid.toInt128(), recipient);
    }

    /// @notice Adds a balance delta in a currency for a target address
    function _accountDelta(Currency currency, int128 delta, address target) internal {
        if (delta == 0) return;

        (int256 previous, int256 next) = currency.applyDelta(target, delta);

        if (next == 0) {
            NonzeroDeltaCount.decrement();
        } else if (previous == 0) {
            NonzeroDeltaCount.increment();
        }
    }

    /// @notice Accounts the deltas of 2 currencies to a target address
    function _accountPoolBalanceDelta(PoolKey memory key, BalanceDelta delta, address target) internal {
        _accountDelta(key.currency0, delta.amount0(), target);
        _accountDelta(key.currency1, delta.amount1(), target);
    }

    /// @notice Implementation of the _getPool function defined in ProtocolFees
    function _getPool(PoolId id) internal view override returns (Pool.State storage) {
        return _pools[id];
    }

    /// @notice Implementation of the _isUnlocked function defined in ProtocolFees
    function _isUnlocked() internal view override returns (bool) {
        return Lock.isUnlocked();
    }

    /// @dev Claims can settle approved operators' swaps but cannot become a freely transferable
    /// substitute asset on an unapproved LP. Standard claim approval/burn authorization is retained.
    function transfer(address, uint256, uint256) public pure override(ERC6909, IERC6909Claims) returns (bool) {
        revert ClaimsNotTransferable();
    }

    function transferFrom(address, address, uint256, uint256) public pure override(ERC6909, IERC6909Claims) returns (bool) {
        revert ClaimsNotTransferable();
    }

    /// @notice Anyone may forward a funded bucket to its immutable recipient while locked.
    function sweep(Currency currency, uint8 bucket) external onlyRestrictedPolicy returns (uint256 amount) {
        return _claimRevenue(currency, bucket, _recipient(bucket));
    }

    /// @notice A fixed recipient may direct only its own bucket to a chosen receiving address.
    function claim(Currency currency, uint8 bucket, address to)
        external onlyRestrictedPolicy returns (uint256 amount)
    {
        if (msg.sender != _recipient(bucket)) revert OnlyRevenueRecipient();
        if (to == address(0) || to == address(this)) revert InvalidRestrictedConfiguration();
        return _claimRevenue(currency, bucket, to);
    }

    function _claimRevenue(Currency currency, uint8 bucket, address to) private returns (uint256 amount) {
        _checkCurrency(currency);
        _beginWithdrawal(currency);
        amount = owed[currency][bucket];
        owed[currency][bucket] = 0;
        totalOwed[currency] -= amount;
        currency.transfer(to, amount);
        emit TradeRevenueClaimed(currency, bucket, to, amount);
        _endWithdrawal();
    }

    function _accrueTradeRevenue(PoolKey memory key, SwapParams memory params, BalanceDelta rawDelta)
        private returns (uint256 fee)
    {
        bool currency0 = params.amountSpecified < 0 ? !params.zeroForOne : params.zeroForOne;
        int256 raw = currency0 ? int256(rawDelta.amount0()) : int256(rawDelta.amount1());
        uint256 magnitude = uint256(raw < 0 ? -raw : raw);
        fee = magnitude * TRADE_FEE_BPS / 10_000;
        if (fee == 0) return 0;
        Currency currency = currency0 ? key.currency0 : key.currency1;
        uint256 developer = fee * 200 / TRADE_FEE_BPS;
        uint256 rwa = fee * 100 / TRADE_FEE_BPS;
        uint256 community = fee * 100 / TRADE_FEE_BPS;
        owed[currency][0] += developer;
        owed[currency][1] += rwa;
        owed[currency][2] += community;
        owed[currency][3] += fee - developer - rwa - community;
        totalOwed[currency] += fee;
        // 5% of any int128 magnitude fits a positive int128, including abs(type(int128).min).
        _accountDelta(currency, -(int256(fee).toInt128()), msg.sender);
        emit TradeRevenueAccrued(msg.sender, key.toId(), currency, fee);
    }

    function _subtractTradeFee(SwapParams memory params, BalanceDelta delta, uint256 fee)
        private pure returns (BalanceDelta)
    {
        if (fee == 0) return delta;
        bool currency0 = params.amountSpecified < 0 ? !params.zeroForOne : params.zeroForOne;
        int256 amount0 = int256(delta.amount0());
        int256 amount1 = int256(delta.amount1());
        if (currency0) amount0 -= int256(fee);
        else amount1 -= int256(fee);
        return toBalanceDelta(amount0.toInt128(), amount1.toInt128());
    }

    function _recipient(uint8 bucket) private view returns (address) {
        if (bucket == 0) return developerRecipient;
        if (bucket == 1) return rwaRecipient;
        if (bucket == 2) return communityRecipient;
        if (bucket == 3) return polRecipient;
        revert InvalidRevenueBucket();
    }

    function _checkRestrictedPolicy() private view {
        IOmertaRestrictedOMRV2 token = IOmertaRestrictedOMRV2(omr);
        if (!token.policySealed() || token.settlementManager() != address(this)
            || !token.isOperator(address(this))) {
            revert RestrictedPolicyNotSealed();
        }
    }

    function _checkRestrictedOperator() internal view override {
        _checkRestrictedPolicy();
        if (_withdrawalGuard != 1) revert WithdrawalReentered();
        if (!IOmertaRestrictedOMRV2(omr).isOperator(msg.sender)) revert RestrictedOperatorRequired();
    }

    function _checkPoolKey(PoolKey memory key) internal view override {
        if (!key.currency0.isAddressZero() || Currency.unwrap(key.currency1) != omr) {
            revert RestrictedPoolNotAllowed();
        }
        address hook = address(key.hooks);
        if (hook == address(0)) return;
        if (!IOmertaRestrictedOMRV2(omr).isOperator(hook)
            || Hooks.hasPermission(key.hooks, Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG)) {
            revert RestrictedHookNotAllowed();
        }
        (bool ok, bytes memory data) = hook.staticcall(abi.encodeWithSignature("poolManager()"));
        if (!ok || data.length != 32 || abi.decode(data, (address)) != address(this)) {
            revert RestrictedHookNotAllowed();
        }
    }

    function _checkCurrency(Currency currency) internal view override {
        if (!currency.isAddressZero() && Currency.unwrap(currency) != omr) revert RestrictedCurrencyNotAllowed();
    }

    function _beginWithdrawal(Currency currency) internal override {
        if (Lock.isUnlocked()) revert WithdrawalWhileUnlocked();
        if (_withdrawalGuard != 1) revert WithdrawalReentered();
        if (!currency.isAddressZero() && CurrencyReserves.getSyncedCurrency() == currency) {
            ProtocolFeeCurrencySynced.selector.revertWith();
        }
        _withdrawalGuard = 2;
    }

    function _endWithdrawal() internal override {
        _withdrawalGuard = 1;
    }
}
