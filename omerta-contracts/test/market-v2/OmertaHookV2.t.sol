// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";

contract MockOmrMarketV2 is ERC20 {
    constructor() ERC20("Mock OMR", "OMR") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract RefusingRecipientV2 {
    receive() external payable { revert("reject ETH"); }
}

abstract contract OmertaHookV2Fixture is Test {
    uint160 internal constant FLAGS = uint160(
        Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG
            | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
            | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
    );
    uint160 internal constant Q96 = 79228162514264337593543950336;
    uint128 internal constant INITIAL_L = 1000e18;
    IPoolManager internal manager;
    MockOmrMarketV2 internal omr;
    OmertaHookV2 internal hook;
    PoolSwapTest internal router;
    PoolModifyLiquidityTest internal lpRouter;
    PoolKey internal key;
    address[5] internal recipients;
    Currency internal eth = Currency.wrap(address(0));
    Currency internal token;

    function setUp() public virtual {
        vm.warp(3600);
        vm.roll(100);
        // Use the canonical artifact to avoid recompiling pinned v4 Pool.swap under this suite's
        // via-IR profile (solc 0.8.26 optimizer-800 has a Yul stack regression in that dependency).
        // Calls below execute the real PoolManager bytecode, not a mocked settlement interface.
        manager = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        omr = new MockOmrMarketV2();
        token = Currency.wrap(address(omr));
        recipients = [address(new RefusingRecipientV2()), address(0x11), address(0x12), address(0x13), address(0x14)];
        address target = address(uint160((uint256(0xBEEF) << 144) | FLAGS));
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2", abi.encode(
            manager, address(omr), address(this), uint24(3000), int24(60), recipients,
            OmertaHookV2.OpeningConfig(200, 500, 10 ether), uint24(100), uint32(60)
        ), target);
        hook = OmertaHookV2(payable(target));
        key = hook.poolKey();
        manager.initialize(key, Q96);
        router = new PoolSwapTest(manager);
        lpRouter = new PoolModifyLiquidityTest(manager);
        vm.deal(address(this), 1_000_000 ether);
        omr.mint(address(this), 1_000_000e18);
        omr.approve(address(router), type(uint256).max);
        omr.approve(address(lpRouter), type(uint256).max);
        lpRouter.modifyLiquidity{value: 1001 ether}(
            key, ModifyLiquidityParams(-887220, 887220, int256(uint256(INITIAL_L)), bytes32(0)), ""
        );
        vm.roll(301);
    }

    receive() external payable {}

    function _swap(bool buy, int256 specified) internal returns (BalanceDelta) {
        return _swapLimit(buy, specified, buy ? Q96 / 2 : Q96 * 2);
    }

    function _swapLimit(bool buy, int256 specified, uint160 limit) internal returns (BalanceDelta) {
        return router.swap{value: buy ? 10_000 ether : 0}(
            key, SwapParams(buy, specified, limit), PoolSwapTest.TestSettings(false, false), ""
        );
    }

    function _total(Currency currency) internal view returns (uint256 total) {
        for (uint8 i; i < 5; ++i) total += hook.owed(currency, i);
    }

    function _assertConserved(Currency currency) internal view {
        assertEq(_total(currency), hook.totalOwed(currency), "sum liabilities");
        uint256 balance = Currency.unwrap(currency) == address(0) ? address(hook).balance : omr.balanceOf(address(hook));
        assertEq(balance, hook.totalOwed(currency), "assets exactly cover liabilities");
    }
}

contract OmertaHookV2Test is OmertaHookV2Fixture {
    function test_permissionsContainOnlyImplementedCallbacks() public view {
        Hooks.Permissions memory p = hook.getHookPermissions();
        assertTrue(p.afterAddLiquidity && p.afterRemoveLiquidity && p.afterSwapReturnDelta);
        assertFalse(p.beforeSwapReturnDelta || p.beforeAddLiquidity || p.beforeRemoveLiquidity);
        assertEq(uint160(address(hook)) & Hooks.ALL_HOOK_MASK, FLAGS);
    }

    function test_callbacksRequireManager() public {
        vm.expectRevert(OmertaHookV2.OnlyPoolManager.selector);
        hook.afterSwap(address(this), key, SwapParams(false, -int256(1 ether), Q96 * 2), BalanceDelta.wrap(0), "");
    }

    function test_poolIdentityIsPinned() public {
        PoolKey memory forged = key;
        forged.fee = 100;
        vm.expectRevert();
        manager.initialize(forged, Q96);
    }

    function test_sellsKeepBaseAllocationAndIsolateSurge() public {
        BalanceDelta result = _swap(false, -int256(10 ether));
        uint256 gross = uint256(uint128(result.amount0())) + _total(eth);
        uint256 base = gross * 900 / 10_000;
        assertEq(hook.owed(eth, 0), base * 200 / 900);
        assertEq(hook.owed(eth, 1), base * 160 / 900);
        assertEq(hook.owed(eth, 2), base * 240 / 900);
        assertEq(hook.owed(eth, 3), base - base * 200 / 900 - base * 160 / 900 - base * 240 / 900);
        assertGt(hook.owed(eth, 4), 0);
        assertLe(hook.owed(eth, 4), gross / 100);
        _assertConserved(eth);
    }

    function test_exactOutputSellPaysOMRBasedOnActualInput() public {
        BalanceDelta result = _swap(false, int256(1 ether));
        uint256 total = _total(token);
        uint256 rawInput = uint256(-int256(result.amount1())) - total;
        uint256 base = rawInput * 900 / 10_000;
        assertEq(total - hook.owed(token, 4), base);
        assertEq(uint256(uint128(result.amount0())), 1 ether);
        assertEq(_total(eth), 0);
        _assertConserved(token);
    }

    function test_partialFillTaxUsesActualAmountsForBothSellModes() public {
        BalanceDelta exactIn = _swapLimit(false, -int256(100 ether), TickMath.getSqrtPriceAtTick(10));
        assertLt(uint256(-int256(exactIn.amount1())), 100 ether);
        uint256 gross = uint256(uint128(exactIn.amount0())) + _total(eth);
        assertEq(_total(eth) - hook.owed(eth, 4), gross * 900 / 10_000);
        BalanceDelta exactOut = _swapLimit(false, int256(100 ether), TickMath.getSqrtPriceAtTick(20));
        assertLt(uint256(uint128(exactOut.amount0())), 100 ether);
        uint256 rawInput = uint256(-int256(exactOut.amount1())) - _total(token);
        assertEq(_total(token) - hook.owed(token, 4), rawInput * 900 / 10_000);
        _assertConserved(eth);
        _assertConserved(token);
    }

    function test_postOpeningBuysAreFreeInBothModes() public {
        _swap(true, -int256(1 ether));
        _swap(true, int256(1 ether));
        assertEq(_total(eth), 0);
        assertEq(_total(token), 0);
    }

    function test_openingSupportsExactOutputAndCapsActualQuoteIncludingFee() public {
        vm.roll(101);
        _swap(true, int256(1 ether));
        assertGt(hook.owed(eth, 4), 0);
        assertEq(hook.owed(eth, 0), 0);
        vm.expectRevert();
        _swap(true, int256(11 ether));
        // Sells remain executable throughout the opening window, regardless of size cap.
        _swap(false, -int256(30 ether));
    }

    function test_openingCapUsesFilledQuoteNotRequestedInput() public {
        vm.roll(101);
        BalanceDelta result = _swapLimit(true, -int256(100 ether), TickMath.getSqrtPriceAtTick(-10));
        assertLt(uint256(-int256(result.amount0())), 10 ether);
        assertGt(hook.owed(token, 4), 0);
        _assertConserved(token);
    }

    function test_openingExpiresWithoutAnAdminCall() public {
        vm.roll(299);
        _swap(true, -int256(1 ether));
        uint256 beforeOwed = _total(token);
        vm.roll(300);
        _swap(true, -int256(20 ether));
        assertEq(_total(token), beforeOwed);
        assertEq(hook.openingEndsAtBlock(), 300);
    }

    function test_recipientFailureCannotBlockSwapsOrOtherPayments() public {
        _swap(false, -int256(10 ether));
        uint256 devOwed = hook.owed(eth, 0);
        vm.expectRevert();
        hook.sweep(eth, 0);
        assertEq(hook.owed(eth, 0), devOwed);
        uint256 rwaOwed = hook.owed(eth, 1);
        hook.sweep(eth, 1);
        assertEq(recipients[1].balance, rwaOwed);
        _swap(false, -int256(1 ether));
        _assertConserved(eth);
    }

    function test_onlyRecipientCanRedirectOwnClaim() public {
        _swap(false, -int256(10 ether));
        vm.expectRevert(OmertaHookV2.NotRecipient.selector);
        hook.claim(eth, 0, address(0x1234));
        uint256 amount = hook.owed(eth, 0);
        vm.prank(recipients[0]);
        hook.claim(eth, 0, address(0x1234));
        assertEq(address(0x1234).balance, amount);
        _assertConserved(eth);
    }

    function test_buyCannotEraseRecentSellPressure() public {
        _swap(false, -int256(10 ether));
        uint24 pressure = hook.sellPressureTicks();
        _swap(true, -int256(10 ether));
        assertEq(hook.sellPressureTicks(), pressure);
        vm.warp(block.timestamp + 60);
        _swap(false, -int256(0.001 ether));
        assertLt(hook.sellPressureTicks(), pressure);
    }

    function test_liquidityChangesAccrueOldDepthBeforeAdoptingNewDepth() public {
        vm.warp(3630);
        lpRouter.modifyLiquidity(key, ModifyLiquidityParams(-887220, 887220, -int256(uint256(INITIAL_L / 2)), bytes32(0)), "");
        vm.warp(3660);
        hook.checkpoint();
        OmertaHookV2.Epoch memory e = hook.latestEpoch();
        assertEq(e.liquiditySeconds, uint256(INITIAL_L) * 30 + uint256(INITIAL_L / 2) * 30);
        assertEq(e.minLiquidity, INITIAL_L / 2);
        assertEq(e.observedSeconds, 60);
    }

    function test_idleGapSynthesizesNewestFullEpochWithoutRepeatingOldVolume() public {
        _swap(false, -int256(1 ether));
        int24 tick = hook.lastTick();
        vm.warp(3600 + 365 days);
        hook.checkpoint();
        OmertaHookV2.Epoch memory e = hook.latestEpoch();
        assertEq(e.end, block.timestamp);
        assertEq(e.observedSeconds, 60);
        assertEq(e.tickSeconds, int256(tick) * 60);
        assertEq(e.buyQuote + e.sellQuote, 0);
        assertEq(e.liquiditySeconds, uint256(INITIAL_L) * 60);
        (int56 cumulative,, bool ready) = hook.currentTickCumulative(key.toId());
        assertTrue(ready);
        assertEq(cumulative, int256(tick) * int256(365 days));
    }

    function testFuzz_allFeesAreCoveredAndNeverExceedTenPercent(uint96 amountSeed, bool exactOutput) public {
        uint256 amount = bound(uint256(amountSeed), 1e9, 50 ether);
        BalanceDelta result = _swap(false, exactOutput ? int256(amount) : -int256(amount));
        Currency currency = exactOutput ? token : eth;
        uint256 total = _total(currency);
        uint256 gross = exactOutput ? uint256(-int256(result.amount1())) - total
            : uint256(uint128(result.amount0())) + total;
        assertLe(total, gross * 1000 / 10_000);
        assertEq(total - hook.owed(currency, 4), gross * 900 / 10_000);
        _assertConserved(currency);
    }
}

contract OmertaHookV2InvariantHandler is Test {
    OmertaHookV2 public hook;
    PoolSwapTest public router;
    MockOmrMarketV2 public omr;
    PoolKey private _key;
    uint256 public successfulSwaps;
    constructor(OmertaHookV2 hook_, PoolSwapTest router_, MockOmrMarketV2 omr_) {
        hook = hook_;
        router = router_;
        omr = omr_;
        _key = hook_.poolKey();
        omr_.approve(address(router_), type(uint256).max);
    }
    receive() external payable {}
    function trade(uint64 amountSeed, bool buy, bool exactOutput, uint8 secondsForward) external {
        vm.warp(block.timestamp + secondsForward);
        vm.deal(address(this), 1000 ether);
        omr.mint(address(this), 1000 ether);
        uint256 amount = bound(uint256(amountSeed), 1e9, 0.1 ether);
        router.swap{value: buy ? 100 ether : 0}(_key, SwapParams(buy, exactOutput ? int256(amount) : -int256(amount),
            buy ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1), PoolSwapTest.TestSettings(false, false), "");
        ++successfulSwaps;
    }
    function sweep(uint8 bucket, bool token) external {
        bucket = uint8(bound(bucket, 1, 4)); // fixture's dev deliberately refuses ETH.
        hook.sweep(Currency.wrap(token ? address(omr) : address(0)), bucket);
    }
    function checkpoint(uint32 secondsForward) external {
        vm.warp(block.timestamp + bound(secondsForward, 0, 1 days));
        hook.checkpoint();
    }
}

contract OmertaHookV2InvariantTest is OmertaHookV2Fixture {
    OmertaHookV2InvariantHandler internal handler;
    function setUp() public override {
        super.setUp();
        handler = new OmertaHookV2InvariantHandler(hook, router, omr);
        targetContract(address(handler));
    }
    function invariant_liabilitiesRemainExactlyFundedInBothCurrencies() public view {
        _assertConserved(eth);
        _assertConserved(token);
        assertLe(hook.sellPressureTicks(), hook.surgeFullTicks());
    }
}
