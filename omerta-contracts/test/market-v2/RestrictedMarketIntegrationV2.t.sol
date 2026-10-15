// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {OmertaSwapRouterV2} from "../../src/market-v2/OmertaSwapRouterV2.sol";

interface IRestrictedRevenueIntegrationV2 {
    function owed(Currency, uint8) external view returns (uint256);
    function totalOwed(Currency) external view returns (uint256);
    function sweep(Currency, uint8) external returns (uint256);
    function claim(Currency, uint8, address) external returns (uint256);
}

/// @dev Executes actual restricted token, core manager, canonical hook, and production swap router.
contract RestrictedMarketIntegrationV2Test is Test {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;
    uint160 private constant Q96 = 79228162514264337593543950336;
    bytes32 private constant SWAP_TOPIC = keccak256("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)");
    IPoolManager private manager;
    IRestrictedRevenueIntegrationV2 private revenue;
    OmertaRestrictedOMRV2 private omr;
    OmertaHookV2 private hook;
    OmertaSwapRouterV2 private router;
    PoolModifyLiquidityTest private lpRouter;
    PoolKey private key;
    Currency private eth = Currency.wrap(address(0));
    Currency private token;
    address private trader = address(0xCAFE);
    address[4] private recipients = [address(0xD), address(0xE), address(0xF), address(0x10)];

    function setUp() public {
        vm.roll(100);
        vm.warp(3600);
        omr = new OmertaRestrictedOMRV2(address(this));
        manager = IPoolManager(deployCode("OmertaPoolManagerV2.sol:OmertaPoolManagerV2",
            abi.encode(address(omr), address(this), recipients)));
        revenue = IRestrictedRevenueIntegrationV2(address(manager));
        token = Currency.wrap(address(omr));
        router = new OmertaSwapRouterV2(manager, omr);
        lpRouter = new PoolModifyLiquidityTest(manager);
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG
            | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
            | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG);
        address target = address(uint160((uint256(0xABCD) << 144) | flags));
        address[5] memory hookRecipients = [recipients[0], recipients[1], recipients[2], recipients[3], address(0x11)];
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2", abi.encode(manager, address(omr), address(this),
            uint24(3000), int24(60), hookRecipients, OmertaHookV2.OpeningConfig(200, 50, 10 ether),
            uint24(100), uint32(60)), target);
        hook = OmertaHookV2(payable(target));
        key = hook.poolKey();
        _register(address(this), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(hook), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(router), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        _register(address(lpRouter), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        omr.bindSettlementManager(address(manager), address(manager).codehash);
        omr.sealPolicy();
        vm.prank(trader, trader);
        omr.registerWallet(trader);
        omr.transfer(trader, 10_000 ether);
        manager.initialize(key, Q96);
        vm.deal(address(this), 1_000_000 ether);
        vm.deal(trader, 10_000 ether);
        omr.approve(address(lpRouter), type(uint256).max);
        vm.prank(trader, trader);
        omr.approve(address(router), type(uint256).max);
        lpRouter.modifyLiquidity{value: 1001 ether}(key,
            ModifyLiquidityParams(-887220, 887220, 1000e18, bytes32(0)), "");
        vm.roll(301);
    }

    function _register(address operator, IOmertaRestrictedOMRV2.OperatorRole role) private {
        omr.setOperator(operator, role, operator.codehash);
    }

    function _swap(bool buy, int256 specified, uint160 limit, uint256 minOut, uint256 maxInput)
        private returns (BalanceDelta delta, int128 raw0, int128 raw1)
    {
        vm.recordLogs();
        vm.prank(trader, trader);
        delta = router.swap{value: buy ? 1000 ether : 0}(key, SwapParams(buy, specified, limit),
            minOut, maxInput, uint64(block.timestamp));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(manager) && logs[i].topics[0] == SWAP_TOPIC) {
                (raw0, raw1,,,,) = abi.decode(logs[i].data, (int128, int128, uint160, uint128, int24, uint24));
                // Swap sender is indexed: only deltas and state are in the event data.
                found = true;
            }
        }
        require(found, "missing real core swap");
    }

    function _assertSplit(Currency currency, uint256 base) private view {
        assertEq(revenue.totalOwed(currency), base);
        assertEq(revenue.owed(currency, 0), base * 200 / 500);
        assertEq(revenue.owed(currency, 1), base * 100 / 500);
        assertEq(revenue.owed(currency, 2), base * 100 / 500);
        assertEq(revenue.owed(currency, 3), base - base * 200 / 500 - base * 100 / 500 - base * 100 / 500);
        for (uint8 i; i < 4; ++i) assertEq(hook.owed(currency, i), 0, "hook must not double collect base");
    }

    function test_realRouterExactInputBuyCollectsBaseOnly() public {
        assertTrue(hook.managerCollectsRevenue());
        uint256 nativeBefore = trader.balance;
        uint256 omrBefore = omr.balanceOf(trader);
        (BalanceDelta delta,, int128 raw1) = _swap(true, -10 ether, Q96 / 2, 1, 10 ether);
        uint256 fee = uint256(int256(raw1)) * 500 / 10_000;
        _assertSplit(token, fee);
        assertEq(hook.totalOwed(token), 0);
        assertEq(int256(delta.amount1()), int256(raw1) - int256(fee));
        assertEq(omr.balanceOf(trader) - omrBefore, uint256(int256(delta.amount1())));
        assertEq(nativeBefore - trader.balance, uint256(-int256(delta.amount0())));
    }

    function test_realRouterExactInputSellCollectsBaseAndSeparateSurge() public {
        (BalanceDelta delta, int128 raw0,) = _swap(false, -10 ether, Q96 * 2, 1, 10 ether);
        uint256 gross = uint256(int256(raw0));
        uint256 base = gross * 500 / 10_000;
        _assertSplit(eth, base);
        uint256 surge = hook.owed(eth, 4);
        assertGt(surge, 0);
        assertLe(surge, gross * 50 / 10_000);
        assertEq(int256(delta.amount0()), int256(raw0) - int256(base + surge));
        assertEq(address(hook).balance, hook.totalOwed(eth));
    }

    function test_realRouterExactOutputBuyAddsBaseToActualInput() public {
        (BalanceDelta delta, int128 raw0,) = _swap(true, 1 ether, Q96 / 2, 1 ether, 2 ether);
        uint256 fee = uint256(-int256(raw0)) * 500 / 10_000;
        _assertSplit(eth, fee);
        assertEq(int256(delta.amount0()), int256(raw0) - int256(fee));
        assertEq(delta.amount1(), 1 ether);
    }

    function test_realRouterExactOutputSellAddsBaseAndSurgeToActualInput() public {
        (BalanceDelta delta,, int128 raw1) = _swap(false, 1 ether, Q96 * 2, 1 ether, 2 ether);
        uint256 fee = uint256(-int256(raw1)) * 500 / 10_000;
        _assertSplit(token, fee);
        assertEq(int256(delta.amount1()), int256(raw1) - int256(fee + hook.owed(token, 4)));
        assertEq(delta.amount0(), 1 ether);
        assertEq(omr.balanceOf(address(hook)), hook.totalOwed(token));
    }

    function test_saturatedSellSurgeReachesSixPercentInBothExactModes() public {
        _swap(false, -10 ether, Q96 * 2, 1, 10 ether);
        assertEq(hook.sellPressureTicks(), hook.surgeFullTicks());
        for (uint8 mode; mode < 2; ++mode) {
            Currency currency = mode == 0 ? eth : token;
            uint256 baseBefore = revenue.totalOwed(currency);
            uint256 surgeBefore = hook.owed(currency, 4);
            (BalanceDelta delta, int128 raw0, int128 raw1) =
                _swap(false, mode == 0 ? -int256(1 ether) : int256(1 ether), Q96 * 2, 1, 2 ether);
            uint256 gross = mode == 0 ? uint256(int256(raw0)) : uint256(-int256(raw1));
            uint256 base = revenue.totalOwed(currency) - baseBefore;
            uint256 surge = hook.owed(currency, 4) - surgeBefore;
            assertEq(base, gross * 500 / 10_000);
            assertEq(surge, gross * 50 / 10_000);
            assertLe(base + surge, gross * 600 / 10_000);
            assertEq(mode == 0 ? int256(delta.amount0()) : int256(delta.amount1()),
                (mode == 0 ? int256(raw0) : int256(raw1)) - int256(base + surge));
        }
    }

    function test_openingBuysReachSixPercentInBothExactModes() public {
        vm.roll(101);
        for (uint8 mode; mode < 2; ++mode) {
            Currency currency = mode == 0 ? token : eth;
            (BalanceDelta delta, int128 raw0, int128 raw1) =
                _swap(true, mode == 0 ? -int256(1 ether) : int256(1 ether), Q96 / 2, 1, 2 ether);
            uint256 gross = mode == 0 ? uint256(int256(raw1)) : uint256(-int256(raw0));
            _assertSplit(currency, gross * 500 / 10_000);
            uint256 surge = hook.owed(currency, 4);
            assertEq(surge, gross * 50 / 10_000);
            assertLe(revenue.totalOwed(currency) + surge, gross * 600 / 10_000);
            assertEq(mode == 0 ? int256(delta.amount1()) : int256(delta.amount0()),
                (mode == 0 ? int256(raw1) : int256(raw0)) - int256(revenue.totalOwed(currency) + surge));
        }
    }

    function test_restrictedOpeningFeeAboveHalfPercentIsRejected() public {
        address target = address(uint160((uint256(0xDCBA) << 144) | hook.HOOK_FLAGS()));
        address[5] memory hookRecipients = [recipients[0], recipients[1], recipients[2], recipients[3], address(0x11)];
        bytes memory creation = abi.encodePacked(vm.getCode("OmertaHookV2.sol:OmertaHookV2"),
            abi.encode(manager, address(omr), address(this), uint24(3000), int24(60), hookRecipients,
                OmertaHookV2.OpeningConfig(200, 51, 10 ether), uint24(100), uint32(60)));
        vm.etch(target, creation);
        (bool ok, bytes memory reason) = target.call("");
        assertFalse(ok);
        assertEq(reason, abi.encodeWithSelector(OmertaHookV2.InvalidConfiguration.selector));
    }

    function test_realPartialFillUsesFilledOutputAndRefundsETH() public {
        uint256 beforeBalance = trader.balance;
        (BalanceDelta delta,, int128 raw1) = _swap(true, -100 ether,
            TickMath.getSqrtPriceAtTick(-10), 1, 100 ether);
        assertLt(uint256(-int256(delta.amount0())), 100 ether);
        _assertSplit(token, uint256(int256(raw1)) * 500 / 10_000);
        assertEq(beforeBalance - trader.balance, uint256(-int256(delta.amount0())));
        assertEq(address(router).balance, 0);
    }

    function test_actualFeeAdjustedLimitsRevertAtomically() public {
        vm.prank(trader);
        vm.expectRevert(OmertaSwapRouterV2.InputAboveMaximum.selector);
        router.swap{value: 2 ether}(key, SwapParams(true, 1 ether, Q96 / 2), 1 ether, 1.05 ether,
            uint64(block.timestamp));
        assertEq(revenue.totalOwed(eth), 0);
        vm.prank(trader);
        vm.expectRevert(OmertaSwapRouterV2.OutputBelowMinimum.selector);
        router.swap{value: 1 ether}(key, SwapParams(true, -1 ether, Q96 / 2), 0.95 ether, 1 ether,
            uint64(block.timestamp));
        assertEq(revenue.totalOwed(token), 0);
        assertEq(manager.getLiquidity(key.toId()), 1000e18);
    }

    function test_openingExactOutputCapIncludesManagerBase() public {
        vm.roll(101);
        vm.prank(trader);
        vm.expectRevert();
        router.swap{value: 20 ether}(key, SwapParams(true, 9.5 ether, Q96 / 2), 0, 20 ether,
            uint64(block.timestamp));
        assertEq(revenue.totalOwed(eth), 0);
        (BalanceDelta delta, int128 raw0,) = _swap(true, 8 ether, Q96 / 2, 8 ether, 10 ether);
        uint256 base = uint256(-int256(raw0)) * 500 / 10_000;
        _assertSplit(eth, base);
        assertGt(hook.owed(eth, 4), 0);
        assertEq(int256(delta.amount0()), int256(raw0) - int256(base + hook.owed(eth, 4)));
    }

    function test_liquidityPrincipalHasNoTradeTax() public {
        lpRouter.modifyLiquidity(key, ModifyLiquidityParams(-887220, 887220, -1000e18, bytes32(0)), "");
        assertEq(revenue.totalOwed(eth), 0);
        assertEq(revenue.totalOwed(token), 0);
        assertEq(hook.totalOwed(eth), 0);
        assertEq(hook.totalOwed(token), 0);
    }

    function test_foreignManagerAndCounterfactualCannotReceiveRevenueInventory() public {
        _swap(true, -1 ether, Q96 / 2, 1, 1 ether);
        uint256 entitlement = revenue.owed(token, 0);
        assertGt(entitlement, 0);
        IPoolManager foreign = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        foreign.sync(token);
        vm.prank(recipients[0], recipients[0]);
        vm.expectRevert();
        revenue.claim(token, 0, address(foreign));
        assertEq(omr.balanceOf(address(foreign)), 0);
        assertEq(revenue.owed(token, 0), entitlement, "failed foreign funding preserves owed bucket");
        address futureManager = address(uint160(uint256(keccak256("counterfactual manager deployment"))));
        vm.prank(recipients[0], recipients[0]);
        vm.expectRevert();
        revenue.claim(token, 0, futureManager);
        assertEq(omr.balanceOf(futureManager), 0);
        assertEq(revenue.owed(token, 0), entitlement);
    }

    function test_firstWalletBuyRegistersOnlyItsAuthenticatedRecipient() public {
        address newcomer = address(0xA11CE);
        vm.deal(newcomer, 1 ether);
        assertFalse(omr.isRecipient(newcomer));
        vm.prank(newcomer, newcomer);
        BalanceDelta delta = router.swap{value: 1 ether}(key, SwapParams(true, -1 ether, Q96 / 2),
            1, 1 ether, uint64(block.timestamp));
        assertTrue(omr.isRecipient(newcomer));
        assertEq(omr.balanceOf(newcomer), uint256(int256(delta.amount1())));
        assertGt(revenue.totalOwed(token), 0);
    }

    receive() external payable {}
}
