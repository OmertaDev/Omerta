// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {TransientStateLibrary} from "v4-core/libraries/TransientStateLibrary.sol";
import {BaseTestHooks} from "v4-core/test/BaseTestHooks.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";

// Keep the non-via-IR manager artifact separate from this via-IR test compilation unit.
interface OmertaPoolManagerV2 is IPoolManager {
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

    function TRADE_FEE_BPS() external view returns (uint16);
    function revenuePolicyId() external view returns (bytes32);
    function owed(Currency currency, uint8 bucket) external view returns (uint256);
    function totalOwed(Currency currency) external view returns (uint256);
    function sweep(Currency currency, uint8 bucket) external returns (uint256);
    function claim(Currency currency, uint8 bucket, address to) external returns (uint256);
}

/// @dev A approved zero-fee hook cannot undercut the fee enforced by the manager.
contract RestrictedZeroFeeHookFixtureV2 is BaseTestHooks {
    IPoolManager public immutable poolManager;
    uint256 public swapCalls;
    uint16 public feeBps;

    constructor(IPoolManager manager_) { poolManager = manager_; }

    function setFeeBps(uint16 feeBps_) external { feeBps = feeBps_; }

    function beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata)
        external override returns (bytes4, BeforeSwapDelta, uint24)
    {
        require(msg.sender == address(poolManager));
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function afterSwap(address, PoolKey calldata key, SwapParams calldata params, BalanceDelta delta, bytes calldata)
        external override returns (bytes4, int128)
    {
        require(msg.sender == address(poolManager));
        ++swapCalls;
        bool currency0 = params.amountSpecified < 0 ? !params.zeroForOne : params.zeroForOne;
        int256 raw = currency0 ? int256(delta.amount0()) : int256(delta.amount1());
        uint256 fee = uint256(raw < 0 ? -raw : raw) * feeBps / 10_000;
        if (fee != 0) poolManager.take(currency0 ? key.currency0 : key.currency1, address(this), fee);
        return (IHooks.afterSwap.selector, int128(int256(fee)));
    }

    receive() external payable { require(msg.sender == address(poolManager)); }
}

/// @dev A cycle nets all OMR inside the manager; neither leg physically transfers OMR.
contract RestrictedNettingRouterFixtureV2 is IUnlockCallback {
    using TransientStateLibrary for IPoolManager;
    IPoolManager public immutable manager;
    int256 public lastOmrDelta;

    constructor(IPoolManager manager_) { manager = manager_; }

    function execute(PoolKey memory first, PoolKey memory second, uint256 amount)
        external payable returns (BalanceDelta buy, BalanceDelta sell)
    {
        (buy, sell) = abi.decode(manager.unlock(abi.encode(first, second, amount)), (BalanceDelta, BalanceDelta));
        (bool ok,) = msg.sender.call{value: address(this).balance}("");
        require(ok);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(manager));
        (PoolKey memory first, PoolKey memory second, uint256 amount) = abi.decode(data, (PoolKey, PoolKey, uint256));
        uint160 q96 = 79228162514264337593543950336;
        BalanceDelta buy = manager.swap(first, SwapParams(true, -int256(amount), q96 / 2), "");
        BalanceDelta sell = manager.swap(second, SwapParams(false, -int256(buy.amount1()), q96 * 2), "");
        lastOmrDelta = manager.currencyDelta(address(this), first.currency1);
        require(lastOmrDelta == 0, "OMR must net internally");
        int256 ethDelta = manager.currencyDelta(address(this), first.currency0);
        manager.sync(first.currency0);
        if (ethDelta < 0) manager.settle{value: uint256(-ethDelta)}();
        else if (ethDelta > 0) manager.take(first.currency0, address(this), uint256(ethDelta));
        return abi.encode(buy, sell);
    }

    receive() external payable {}
}

/// @dev Test-only typed probe for invoking a withdrawal during an approved unlock callback.
contract RestrictedWithdrawalProbeFixtureV2 is IUnlockCallback {
    IPoolManager public immutable manager;
    constructor(IPoolManager manager_) { manager = manager_; }

    function probe(bytes memory data) external { manager.unlock(data); }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(manager));
        (bool ok, bytes memory result) = address(manager).call(data);
        if (!ok) assembly ("memory-safe") { revert(add(result, 32), mload(result)) }
        return result;
    }
}

/// @dev An unapproved holder drives approved settlement operators through mixed cash/claim swaps,
/// LP changes and public fixed-recipient withdrawals. Failed affordability/price-limit requests
/// revert atomically; successful requests leave the real manager fully settled.
contract RestrictedRevenueInvariantHandlerV2 is Test {
    uint160 private constant Q96 = 79228162514264337593543950336;
    IPoolManager public immutable manager;
    OmertaRestrictedOMRV2 public immutable token;
    PoolSwapTest public immutable router;
    PoolModifyLiquidityTest public immutable lpRouter;
    PoolKey private _noHookKey;
    PoolKey private _hookedKey;
    uint128[2] public addedLiquidity;
    uint256 public successfulSwaps;
    uint256 public successfulLiquidityChanges;

    constructor(IPoolManager manager_, OmertaRestrictedOMRV2 token_, PoolSwapTest router_,
        PoolModifyLiquidityTest lpRouter_, PoolKey memory noHookKey_, PoolKey memory hookedKey_)
    {
        manager = manager_;
        token = token_;
        router = router_;
        lpRouter = lpRouter_;
        _noHookKey = noHookKey_;
        _hookedKey = hookedKey_;
        token_.approve(address(router_), type(uint256).max);
        token_.approve(address(lpRouter_), type(uint256).max);
        manager_.setOperator(address(router_), true);
    }

    function trade(uint8 kind, uint96 size, bool hooked) external {
        bool buy = kind & 1 != 0;
        bool exactInput = kind & 2 == 0;
        bool takeClaims = kind & 4 != 0;
        bool burn = kind & 8 != 0;
        PoolKey memory key = hooked ? _hookedKey : _noHookKey;
        uint256 available = burn
            ? manager.balanceOf(address(this), (buy ? key.currency0 : key.currency1).toId())
            : buy ? address(this).balance : token.balanceOf(address(this));
        if (available < 1e12) return;
        uint256 amount = bound(uint256(size), 1e12, 5 ether);
        if (exactInput && amount > available) amount = available;
        try router.swap{value: buy && !burn ? 15 ether : 0}(key,
            SwapParams(buy, exactInput ? -int256(amount) : int256(amount), buy ? Q96 / 2 : Q96 * 2),
            PoolSwapTest.TestSettings(takeClaims, burn), "") returns (BalanceDelta) {
            ++successfulSwaps;
        } catch {}
    }

    function adjustLiquidity(uint64 size, bool remove, bool hooked) external {
        uint256 index = hooked ? 1 : 0;
        uint256 amount = bound(uint256(size), 1e12, 1 ether);
        if (remove) {
            if (addedLiquidity[index] == 0) return;
            if (amount > addedLiquidity[index]) amount = addedLiquidity[index];
        }
        PoolKey memory key = hooked ? _hookedKey : _noHookKey;
        OmertaPoolManagerV2 revenue = OmertaPoolManagerV2(address(manager));
        uint256 beforeEth = revenue.totalOwed(key.currency0);
        uint256 beforeOmr = revenue.totalOwed(key.currency1);
        try lpRouter.modifyLiquidity{value: remove ? 0 : 100 ether}(key,
            ModifyLiquidityParams(-887220, 887220, remove ? -int256(amount) : int256(amount),
                bytes32(uint256(uint160(address(this))))), "") returns (BalanceDelta) {
            if (remove) addedLiquidity[index] -= uint128(amount);
            else addedLiquidity[index] += uint128(amount);
            ++successfulLiquidityChanges;
            assertEq(revenue.totalOwed(key.currency0), beforeEth, "LP operation changed ETH trade revenue");
            assertEq(revenue.totalOwed(key.currency1), beforeOmr, "LP operation changed OMR trade revenue");
        } catch {}
    }

    function forwardRevenue(uint8 bucket, bool omr) external {
        PoolKey memory key = _noHookKey;
        OmertaPoolManagerV2(address(manager)).sweep(omr ? key.currency1 : key.currency0, uint8(bucket % 4));
    }

    receive() external payable {}
}

contract RestrictedPoolManagerV2Test is Test {
    using StateLibrary for IPoolManager;
    using TransientStateLibrary for IPoolManager;

    uint160 internal constant Q96 = 79228162514264337593543950336;
    uint128 internal constant INITIAL_L = 1000e18;
    bytes32 internal constant SWAP_TOPIC = keccak256("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)");
    OmertaRestrictedOMRV2 internal omr;
    OmertaPoolManagerV2 internal revenueManager;
    IPoolManager internal manager;
    PoolSwapTest internal router;
    PoolModifyLiquidityTest internal lpRouter;
    RestrictedNettingRouterFixtureV2 internal nettingRouter;
    RestrictedWithdrawalProbeFixtureV2 internal probe;
    RestrictedZeroFeeHookFixtureV2 internal hook;
    RestrictedZeroFeeHookFixtureV2 internal foreignHook;
    RestrictedZeroFeeHookFixtureV2 internal beforeReturnHook;
    RestrictedRevenueInvariantHandlerV2 internal invariantHandler;
    PoolKey internal noHookKey;
    PoolKey internal hookedKey;
    Currency internal eth = Currency.wrap(address(0));
    Currency internal token;
    address[4] internal recipients = [address(0xD), address(0xE), address(0xF), address(0x10)];

    function setUp() public {
        omr = new OmertaRestrictedOMRV2(address(this));
        // Deploy the manager artifact independently: do not inline v4 Pool.swap into this test.
        manager = IPoolManager(deployCode("OmertaPoolManagerV2.sol:OmertaPoolManagerV2",
            abi.encode(address(omr), address(this), recipients)));
        revenueManager = OmertaPoolManagerV2(address(manager));
        token = Currency.wrap(address(omr));
        router = new PoolSwapTest(manager);
        lpRouter = new PoolModifyLiquidityTest(manager);
        nettingRouter = new RestrictedNettingRouterFixtureV2(manager);
        probe = new RestrictedWithdrawalProbeFixtureV2(manager);

        hook = _deployHook(0xBEEF, Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG, manager);
        foreignHook = _deployHook(0xBEF0, Hooks.AFTER_SWAP_FLAG, IPoolManager(address(0xBAD)));
        beforeReturnHook = _deployHook(0xBEF1, Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG, manager);
        noHookKey = PoolKey(eth, token, 0, 60, IHooks(address(0)));
        hookedKey = PoolKey(eth, token, 0, 60, IHooks(address(hook)));
        invariantHandler = new RestrictedRevenueInvariantHandlerV2(manager, omr, router, lpRouter, noHookKey, hookedKey);
        omr.setContractHolder(address(invariantHandler), address(invariantHandler).codehash);
        for (uint256 i; i < recipients.length; ++i) _registerWallet(recipients[i]);
        _registerWallet(address(0x123));
        _register(address(this), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(router), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        _register(address(lpRouter), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        _register(address(nettingRouter), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        _register(address(probe), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        _register(address(hook), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(foreignHook), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(beforeReturnHook), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        omr.bindSettlementManager(address(manager), address(manager).codehash);
        omr.sealPolicy();

        manager.initialize(noHookKey, Q96);
        manager.initialize(hookedKey, Q96);
        vm.deal(address(this), 1_000_000 ether);
        omr.approve(address(router), type(uint256).max);
        omr.approve(address(lpRouter), type(uint256).max);
        _addLiquidity(noHookKey, int256(uint256(INITIAL_L)));
        _addLiquidity(hookedKey, int256(uint256(INITIAL_L)));
        vm.deal(address(invariantHandler), 1_000_000 ether);
        omr.transfer(address(invariantHandler), 100_000 ether);
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = RestrictedRevenueInvariantHandlerV2.trade.selector;
        selectors[1] = RestrictedRevenueInvariantHandlerV2.adjustLiquidity.selector;
        selectors[2] = RestrictedRevenueInvariantHandlerV2.forwardRevenue.selector;
        targetSelector(FuzzSelector({addr: address(invariantHandler), selectors: selectors}));
        targetContract(address(invariantHandler));
    }

    function _register(address account, IOmertaRestrictedOMRV2.OperatorRole role) internal {
        omr.setOperator(account, role, account.codehash);
    }

    function _registerWallet(address wallet) internal {
        vm.prank(wallet, wallet);
        omr.registerWallet(wallet);
    }

    function _deployHook(uint160 prefix, uint160 flags, IPoolManager selectedManager)
        internal returns (RestrictedZeroFeeHookFixtureV2 selectedHook)
    {
        address target = address(uint160((uint256(prefix) << 144) | flags));
        deployCodeTo("RestrictedPoolManagerV2.t.sol:RestrictedZeroFeeHookFixtureV2", abi.encode(selectedManager), target);
        return RestrictedZeroFeeHookFixtureV2(payable(target));
    }

    function _addLiquidity(PoolKey memory key, int256 amount) internal returns (BalanceDelta) {
        return lpRouter.modifyLiquidity{value: amount > 0 ? 2000 ether : 0}(
            key, ModifyLiquidityParams(-887220, 887220, amount, bytes32(0)), "");
    }

    function _swap(PoolKey memory key, bool buy, int256 specified, uint160 limit)
        internal returns (BalanceDelta)
    {
        return router.swap{value: 2000 ether}(key, SwapParams(buy, specified, limit),
            PoolSwapTest.TestSettings(false, false), "");
    }

    function _rawAmounts() internal returns (int128 amount0, int128 amount1) {
        Vm.Log[] memory entries = vm.getRecordedLogs();
        for (uint256 i; i < entries.length; ++i) {
            if (entries[i].emitter == address(manager) && entries[i].topics[0] == SWAP_TOPIC) {
                (amount0, amount1,,,,) = abi.decode(entries[i].data, (int128, int128, uint160, uint128, int24, uint24));
                return (amount0, amount1);
            }
        }
        revert("raw swap event missing");
    }

    function _assertTradeFee(PoolKey memory key, bool buy, bool exactInput, uint160 limit) internal {
        bool currency0 = exactInput ? !buy : buy;
        Currency currency = currency0 ? eth : token;
        uint256 beforeOwed = revenueManager.totalOwed(currency);
        vm.recordLogs();
        BalanceDelta delta = _swap(key, buy, exactInput ? -int256(1 ether) : int256(1 ether), limit);
        (int128 raw0, int128 raw1) = _rawAmounts();
        int256 raw = currency0 ? int256(raw0) : int256(raw1);
        uint256 fee = uint256(raw < 0 ? -raw : raw) * 500 / 10_000;
        assertGt(fee, 0);
        assertEq(revenueManager.totalOwed(currency) - beforeOwed, fee, "mandatory fee uses raw executed delta");
        assertEq(currency0 ? int256(delta.amount0()) : int256(delta.amount1()), raw - int256(fee), "returned debit includes fee once");
        assertEq(currency0 ? int256(delta.amount1()) : int256(delta.amount0()), currency0 ? int256(raw1) : int256(raw0));
        _assertLiabilities(currency);
        assertEq(manager.getNonzeroDeltaCount(), 0, "all fees settled at unlock");
    }

    function _assertLiabilities(Currency currency) internal view {
        uint256 sum;
        for (uint8 i; i < 4; ++i) sum += revenueManager.owed(currency, i);
        assertEq(sum, revenueManager.totalOwed(currency), "four bucket conservation");
        uint256 custody = currency == eth ? address(manager).balance : omr.balanceOf(address(manager));
        assertGe(custody, sum, "custody covers accrued revenue");
    }

    function testNoHookExactInputBuyPaysFivePointFivePercent() public { _assertTradeFee(noHookKey, true, true, Q96 / 2); }
    function testNoHookExactInputSellPaysFivePointFivePercent() public { _assertTradeFee(noHookKey, false, true, Q96 * 2); }
    function testNoHookExactOutputBuyPaysFivePointFivePercent() public { _assertTradeFee(noHookKey, true, false, Q96 / 2); }
    function testNoHookExactOutputSellPaysFivePointFivePercent() public { _assertTradeFee(noHookKey, false, false, Q96 * 2); }

    function testZeroFeeHookCannotUndercutBuyOrSellRevenue() public {
        _assertTradeFee(hookedKey, true, true, Q96 / 2);
        _assertTradeFee(hookedKey, false, true, Q96 * 2);
        assertEq(hook.swapCalls(), 2, "the competing hook executed");
    }

    function testApprovedHookAtFiftyBpsKeepsEverySwapModeAtSixPercentMaximum() public {
        hook.setFeeBps(50);
        for (uint256 mode; mode < 4; ++mode) {
            bool buy = mode < 2;
            bool exactInput = mode % 2 == 0;
            bool nativeFee = exactInput ? !buy : buy;
            Currency currency = nativeFee ? eth : token;
            uint256 revenueBefore = revenueManager.totalOwed(currency);
            uint256 hookBefore = nativeFee ? address(hook).balance : omr.balanceOf(address(hook));
            vm.recordLogs();
            BalanceDelta delta = _swap(hookedKey, buy, exactInput ? -int256(1 ether) : int256(1 ether), buy ? Q96 / 2 : Q96 * 2);
            (int128 raw0, int128 raw1) = _rawAmounts();
            int256 raw = nativeFee ? int256(raw0) : int256(raw1);
            uint256 magnitude = uint256(raw < 0 ? -raw : raw);
            uint256 base = magnitude * 500 / 10_000;
            uint256 surcharge = magnitude * 50 / 10_000;
            assertGt(surcharge, 0, "exercise an actual funded hook surcharge");
            assertEq(revenueManager.totalOwed(currency) - revenueBefore, base);
            assertEq((nativeFee ? address(hook).balance : omr.balanceOf(address(hook))) - hookBefore, surcharge);
            assertEq(nativeFee ? int256(delta.amount0()) : int256(delta.amount1()), raw - int256(base + surcharge));
            assertLe(base + surcharge, magnitude * 600 / 10_000, "aggregate tax never exceeds 6%");
            _assertLiabilities(currency);
            assertEq(manager.getNonzeroDeltaCount(), 0);
        }
        assertEq(hook.swapCalls(), 4);
    }

    function testApprovedHookOverFiftyBpsRollsBackEverySwapModeAndPayout() public {
        hook.setFeeBps(51);
        uint256 nativeBefore = address(manager).balance;
        uint256 tokenBefore = omr.balanceOf(address(manager));
        (uint160 priceBefore, int24 tickBefore,,) = manager.getSlot0(hookedKey.toId());
        for (uint256 mode; mode < 4; ++mode) {
            bool buy = mode < 2;
            bool exactInput = mode % 2 == 0;
            vm.expectRevert(OmertaPoolManagerV2.RestrictedHookNotAllowed.selector);
            _swap(hookedKey, buy, exactInput ? -int256(1 ether) : int256(1 ether), buy ? Q96 / 2 : Q96 * 2);
            assertEq(address(manager).balance, nativeBefore);
            assertEq(omr.balanceOf(address(manager)), tokenBefore);
            assertEq(address(hook).balance, 0, "attempted native payout rolls back");
            assertEq(omr.balanceOf(address(hook)), 0, "attempted token payout rolls back");
            assertEq(hook.swapCalls(), 0, "callback state rolls back");
            assertEq(revenueManager.totalOwed(eth), 0);
            assertEq(revenueManager.totalOwed(token), 0);
            for (uint8 bucket; bucket < 4; ++bucket) {
                assertEq(revenueManager.owed(eth, bucket), 0);
                assertEq(revenueManager.owed(token, bucket), 0);
            }
            (uint160 priceAfter, int24 tickAfter,,) = manager.getSlot0(hookedKey.toId());
            assertEq(priceAfter, priceBefore);
            assertEq(tickAfter, tickBefore);
            assertEq(manager.getLiquidity(hookedKey.toId()), INITIAL_L);
            assertEq(manager.getNonzeroDeltaCount(), 0);
        }
    }

    function testBothDirectionsPreserveFounderTwoPercentAndHalveOtherBuckets() public {
        assertEq(revenueManager.TRADE_FEE_BPS(), 500);
        assertEq(revenueManager.revenuePolicyId(), keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_500_BOTH_DIRECTIONS"));
        vm.recordLogs();
        _swap(noHookKey, true, -1 ether, Q96 / 2);
        (, int128 rawBuy) = _rawAmounts();
        _assertGrossAllocation(token, uint256(int256(rawBuy)));
        vm.recordLogs();
        _swap(noHookKey, false, -1 ether, Q96 * 2);
        (int128 rawSell,) = _rawAmounts();
        _assertGrossAllocation(eth, uint256(int256(rawSell)));
    }

    function _assertGrossAllocation(Currency currency, uint256 rawMagnitude) internal view {
        uint256 fee = rawMagnitude * 500 / 10_000;
        assertEq(revenueManager.totalOwed(currency), fee);
        assertEq(revenueManager.owed(currency, 0), fee * 200 / 500);
        assertEq(revenueManager.owed(currency, 1), fee * 100 / 500);
        assertEq(revenueManager.owed(currency, 2), fee * 100 / 500);
        assertEq(revenueManager.owed(currency, 3), fee - fee * 200 / 500 - fee * 100 / 500 - fee * 100 / 500);
        assertApproxEqAbs(revenueManager.owed(currency, 0), rawMagnitude * 200 / 10_000, 1, "founder remains 2% of gross");
        assertApproxEqAbs(revenueManager.owed(currency, 1), rawMagnitude * 100 / 10_000, 1);
        assertApproxEqAbs(revenueManager.owed(currency, 2), rawMagnitude * 100 / 10_000, 1);
        assertApproxEqAbs(revenueManager.owed(currency, 3), rawMagnitude * 100 / 10_000, 3);
        _assertLiabilities(currency);
    }

    function testPartialFillFeesUseExecutedAmount() public {
        vm.recordLogs();
        BalanceDelta delta = _swap(noHookKey, true, -1000 ether, Q96 * 999 / 1000);
        (int128 raw0, int128 raw1) = _rawAmounts();
        assertLt(uint256(-int256(raw0)), 1000 ether, "limit causes partial fill");
        uint256 fee = uint256(int256(raw1)) * 500 / 10_000;
        assertEq(revenueManager.totalOwed(token), fee);
        assertEq(int256(delta.amount1()), int256(raw1) - int256(fee));
    }

    function testLiquidityAdditionAndRemovalDoNotAccrueTradeRevenue() public {
        uint256 beforeToken = omr.balanceOf(address(this));
        uint256 beforeEth = address(this).balance;
        BalanceDelta add = _addLiquidity(noHookKey, 10 ether);
        BalanceDelta remove = _addLiquidity(noHookKey, -10 ether);
        assertLe(int256(add.amount0()) + int256(remove.amount0()), 0);
        assertLe(int256(add.amount1()) + int256(remove.amount1()), 0);
        assertLe(beforeToken - omr.balanceOf(address(this)), 1, "only v4 principal rounding");
        assertLe(beforeEth - address(this).balance, 1, "only v4 principal rounding");
        assertEq(revenueManager.totalOwed(eth), 0);
        assertEq(revenueManager.totalOwed(token), 0);
        assertEq(manager.getLiquidity(noHookKey.toId()), INITIAL_L, "StateLibrary pool storage remains compatible");
    }

    function testTwoPoolInternalNettingCannotAvoidEitherLegFee() public {
        uint256 beforeToken = omr.balanceOf(address(manager));
        (BalanceDelta buy, BalanceDelta sell) = nettingRouter.execute{value: 1 ether}(noHookKey, hookedKey, 1 ether);
        assertEq(int256(buy.amount1()) + int256(sell.amount1()), 0);
        assertEq(nettingRouter.lastOmrDelta(), 0);
        assertEq(omr.balanceOf(address(manager)), beforeToken, "no underlying OMR settlement happened");
        assertGt(revenueManager.totalOwed(token), 0, "buy pays even without transfer");
        assertGt(revenueManager.totalOwed(eth), 0, "sale pays even without OMR transfer");
        _assertLiabilities(eth);
        _assertLiabilities(token);
    }

    function testClaimTokenMintAndBurnSettlementStillPaysEveryTradeFee() public {
        BalanceDelta buy = router.swap{value: 1 ether}(noHookKey, SwapParams(true, -1 ether, Q96 / 2),
            PoolSwapTest.TestSettings(true, false), "");
        uint256 claimAmount = manager.balanceOf(address(this), token.toId());
        assertEq(claimAmount, uint256(int256(buy.amount1())));
        assertGt(revenueManager.totalOwed(token), 0);
        uint256 beforeToken = omr.balanceOf(address(manager));
        manager.setOperator(address(router), true);
        router.swap(noHookKey, SwapParams(false, -int256(claimAmount), Q96 * 2),
            PoolSwapTest.TestSettings(false, true), "");
        assertEq(manager.balanceOf(address(this), token.toId()), 0);
        assertEq(omr.balanceOf(address(manager)), beforeToken, "claims settle input without OMR transfer");
        assertGt(revenueManager.totalOwed(eth), 0);
        _assertLiabilities(eth);
        _assertLiabilities(token);
    }

    function testClaimReceiptsCannotTransferToAnIndependentPool() public {
        vm.expectRevert(OmertaPoolManagerV2.ClaimsNotTransferable.selector);
        manager.transfer(address(0xBAD), token.toId(), 0);
        vm.expectRevert(OmertaPoolManagerV2.ClaimsNotTransferable.selector);
        manager.transferFrom(address(this), address(0xBAD), token.toId(), 0);
    }

    function testForeignManagerHookAndCustomBeforeSwapAccountingAreRejected() public {
        PoolKey memory invalid = noHookKey;
        invalid.hooks = IHooks(address(foreignHook));
        vm.expectRevert(OmertaPoolManagerV2.RestrictedHookNotAllowed.selector);
        manager.initialize(invalid, Q96);
        invalid.hooks = IHooks(address(beforeReturnHook));
        vm.expectRevert(OmertaPoolManagerV2.RestrictedHookNotAllowed.selector);
        manager.initialize(invalid, Q96);
    }

    function testUnapprovedHookAndForeignCurrenciesAreRejected() public {
        PoolKey memory invalid = noHookKey;
        invalid.hooks = IHooks(address(uint160(0xBEEF0000) | Hooks.AFTER_SWAP_FLAG));
        vm.expectRevert(OmertaPoolManagerV2.RestrictedHookNotAllowed.selector);
        manager.initialize(invalid, Q96);
        invalid = noHookKey;
        invalid.currency1 = Currency.wrap(address(0xBAD));
        vm.expectRevert(OmertaPoolManagerV2.RestrictedPoolNotAllowed.selector);
        manager.initialize(invalid, Q96);
        vm.expectRevert(OmertaPoolManagerV2.RestrictedCurrencyNotAllowed.selector);
        manager.sync(Currency.wrap(address(0xBAD)));
    }

    function testAnyoneCanInitializeAnotherPermittedNoHookPool() public {
        PoolKey memory another = noHookKey;
        another.fee = 100;
        vm.prank(address(0xBAD));
        manager.initialize(another, Q96);
        (uint160 sqrtPrice,,,) = manager.getSlot0(another.toId());
        assertEq(sqrtPrice, Q96);
    }

    function testUnsealedOrOtherBoundManagerCannotInitializePools() public {
        OmertaRestrictedOMRV2 fresh = new OmertaRestrictedOMRV2(address(this));
        IPoolManager unsealed = IPoolManager(deployCode("OmertaPoolManagerV2.sol:OmertaPoolManagerV2",
            abi.encode(address(fresh), address(this), recipients)));
        PoolKey memory freshKey = PoolKey(eth, Currency.wrap(address(fresh)), 0, 60, IHooks(address(0)));
        vm.expectRevert(OmertaPoolManagerV2.RestrictedPolicyNotSealed.selector);
        unsealed.initialize(freshKey, Q96);
        IPoolManager foreign = IPoolManager(deployCode("OmertaPoolManagerV2.sol:OmertaPoolManagerV2",
            abi.encode(address(omr), address(this), recipients)));
        vm.expectRevert(OmertaPoolManagerV2.RestrictedPolicyNotSealed.selector);
        foreign.initialize(noHookKey, Q96);
    }

    function testAllValueEntryPointsRejectAnUnapprovedCaller() public {
        bytes[] memory calls = new bytes[](13);
        calls[0] = abi.encodeCall(IPoolManager.unlock, (bytes("")));
        calls[1] = abi.encodeCall(IPoolManager.swap, (noHookKey, SwapParams(true, -1, Q96 / 2), bytes("")));
        calls[2] = abi.encodeCall(IPoolManager.modifyLiquidity, (noHookKey, ModifyLiquidityParams(-60, 60, 1, 0), bytes("")));
        calls[3] = abi.encodeCall(IPoolManager.take, (eth, address(0xBAD), 0));
        calls[4] = abi.encodeCall(IPoolManager.settle, ());
        calls[5] = abi.encodeCall(IPoolManager.settleFor, (address(0xBAD)));
        calls[6] = abi.encodeCall(IPoolManager.sync, (eth));
        calls[7] = abi.encodeCall(IPoolManager.mint, (address(0xBAD), token.toId(), 0));
        calls[8] = abi.encodeCall(IPoolManager.burn, (address(0xBAD), token.toId(), 0));
        calls[9] = abi.encodeCall(IPoolManager.clear, (eth, 0));
        calls[10] = abi.encodeCall(IPoolManager.donate, (noHookKey, 0, 0, bytes("")));
        calls[11] = abi.encodeCall(IPoolManager.updateDynamicLPFee, (noHookKey, 0));
        calls[12] = abi.encodeWithSignature("collectProtocolFees(address,address,uint256)", address(0xBAD), address(0), 0);
        for (uint256 i; i < calls.length; ++i) {
            vm.prank(address(0xBAD));
            (bool ok, bytes memory reason) = address(manager).call(calls[i]);
            assertFalse(ok, "unapproved accounting entry point accepted");
            assertEq(bytes4(reason), OmertaPoolManagerV2.RestrictedOperatorRequired.selector);
        }
    }

    function testPinnedRuntimeChangeRevokesOperatorAndHookAccess() public {
        vm.etch(address(hook), hex"00");
        vm.expectRevert(OmertaPoolManagerV2.RestrictedHookNotAllowed.selector);
        _swap(hookedKey, true, -1 ether, Q96 / 2);
        vm.etch(address(router), hex"00");
        vm.prank(address(router));
        vm.expectRevert(OmertaPoolManagerV2.RestrictedOperatorRequired.selector);
        manager.unlock("");
    }

    function testFeeSplitAndPermissionlessSweepPayOnlyFixedRecipients() public {
        _swap(noHookKey, false, -1 ether, Q96 * 2);
        uint256 accrued = revenueManager.totalOwed(eth);
        assertEq(revenueManager.owed(eth, 0), accrued * 200 / 500);
        assertEq(revenueManager.owed(eth, 1), accrued * 100 / 500);
        assertEq(revenueManager.owed(eth, 2), accrued * 100 / 500);
        assertEq(revenueManager.owed(eth, 3), accrued - accrued * 200 / 500 - accrued * 100 / 500 - accrued * 100 / 500);
        uint256 beforeManager = address(manager).balance;
        for (uint8 i; i < 4; ++i) {
            uint256 entitlement = revenueManager.owed(eth, i);
            uint256 beforeRecipient = recipients[i].balance;
            vm.prank(address(0xBAD));
            assertEq(revenueManager.sweep(eth, i), entitlement);
            assertEq(recipients[i].balance - beforeRecipient, entitlement);
        }
        assertEq(revenueManager.totalOwed(eth), 0);
        assertEq(beforeManager - address(manager).balance, accrued);
        assertEq(revenueManager.sweep(eth, 0), 0);
    }

    function testOnlyRecipientMayRedirectItsOwnTokenBucket() public {
        _swap(noHookKey, true, -1 ether, Q96 / 2);
        uint256 entitlement = revenueManager.owed(token, 0);
        vm.prank(address(0xBAD));
        vm.expectRevert(OmertaPoolManagerV2.OnlyRevenueRecipient.selector);
        revenueManager.claim(token, 0, address(0xBAD));
        vm.prank(recipients[0]);
        revenueManager.claim(token, 0, address(0x123));
        assertEq(omr.balanceOf(address(0x123)), entitlement);
        assertEq(revenueManager.owed(token, 0), 0);
        _assertLiabilities(token);
    }

    function testClaimAndProtocolFeeWithdrawalCannotOccurDuringUnlock() public {
        vm.expectRevert(OmertaPoolManagerV2.WithdrawalWhileUnlocked.selector);
        probe.probe(abi.encodeCall(OmertaPoolManagerV2.sweep, (eth, 0)));
        revenueManager.setProtocolFeeController(address(probe));
        vm.expectRevert(OmertaPoolManagerV2.WithdrawalWhileUnlocked.selector);
        probe.probe(abi.encodeWithSignature("collectProtocolFees(address,address,uint256)", address(probe), address(0), 0));
    }

    function testSyncedTokenWithdrawalIsRejectedUntilNativeResync() public {
        _swap(noHookKey, true, -1 ether, Q96 / 2);
        manager.sync(token);
        vm.expectRevert(bytes4(keccak256("ProtocolFeeCurrencySynced()")));
        revenueManager.sweep(token, 0);
        manager.sync(eth);
        assertGt(revenueManager.sweep(token, 0), 0);
    }

    function testRevenueBucketAndRecipientValidation() public {
        vm.expectRevert(OmertaPoolManagerV2.InvalidRevenueBucket.selector);
        revenueManager.sweep(eth, 4);
        vm.prank(recipients[0]);
        vm.expectRevert(OmertaPoolManagerV2.InvalidRestrictedConfiguration.selector);
        revenueManager.claim(eth, 0, address(0));
    }

    function testFeeRoundingMatchesExistingBasisPointConvention() public {
        vm.recordLogs();
        _swap(noHookKey, true, -2, Q96 / 2);
        (, int128 raw1) = _rawAmounts();
        assertLt(uint256(int256(raw1)), 19);
        assertEq(revenueManager.totalOwed(token), 0, "sub-19-wei gross fees round down");
    }

    function testFuzzBothDirectionsAndExactModesSettleAndConserveRevenue(uint96 size, bool buy, bool exactInput) public {
        uint256 amount = bound(uint256(size), 1e12, 10 ether);
        Currency currency = (exactInput ? !buy : buy) ? eth : token;
        uint256 beforeOwed = revenueManager.totalOwed(currency);
        vm.recordLogs();
        BalanceDelta delta = _swap(noHookKey, buy, exactInput ? -int256(amount) : int256(amount), buy ? Q96 / 2 : Q96 * 2);
        (int128 raw0, int128 raw1) = _rawAmounts();
        int256 raw = currency == eth ? int256(raw0) : int256(raw1);
        uint256 fee = uint256(raw < 0 ? -raw : raw) * 500 / 10_000;
        assertEq(revenueManager.totalOwed(currency) - beforeOwed, fee);
        assertEq(currency == eth ? int256(delta.amount0()) : int256(delta.amount1()), raw - int256(fee));
        _assertLiabilities(currency);
        assertEq(manager.getNonzeroDeltaCount(), 0);
    }

    function invariantTradeRevenueRemainsCoveredAndSplitAfterMixedOperations() public view {
        _assertLiabilities(eth);
        _assertLiabilities(token);
        assertGe(manager.getLiquidity(noHookKey.toId()), INITIAL_L);
        assertGe(manager.getLiquidity(hookedKey.toId()), INITIAL_L);
        assertFalse(manager.isUnlocked());
    }

    receive() external payable {}
}
