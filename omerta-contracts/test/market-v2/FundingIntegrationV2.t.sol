// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StabilityV2Fixture} from "./StabilityV2.t.sol";
import {OmertaStabilityControllerV2 as Controller} from "../../src/market-v2/OmertaStabilityControllerV2.sol";
import {OmertaReserveFundingV2 as Funding} from "../../src/market-v2/OmertaReserveFundingV2.sol";
import {OmertaArbitrageV2 as Arbitrage} from "../../src/market-v2/OmertaArbitrageV2.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

contract FundingIntegrationV2Test is StabilityV2Fixture {
    Funding coreFunding;
    Funding reserveFunding;

    function setUp() public override {
        super.setUp();
        // These fixed recipients can be deployed before the hook/controller cycle, then
        // bound exactly once after controller immutables contain the canonical pool.
        coreFunding = new Funding(safe, token, CORE);
        reserveFunding = new Funding(safe, token, RESERVE);
        address[5] memory recipients =
            [address(0xD), address(0xE), address(0xF), address(coreFunding), address(reserveFunding)];
        address replacement = address(uint160(0xDECA << 144) | hook.HOOK_FLAGS());
        deployCodeTo(
            "OmertaHookV2.sol:OmertaHookV2",
            abi.encode(
                manager,
                address(token),
                address(this),
                uint24(3000),
                int24(60),
                recipients,
                OmertaHookV2.OpeningConfig(0, 0, 0),
                uint24(600),
                uint32(60)
            ),
            replacement
        );
        hook = OmertaHookV2(payable(replacement));
        key = hook.poolKey();
        manager.initialize(key, TickMath.getSqrtPriceAtTick(0));
        lp.modifyLiquidity{value: 2000 ether}(key, ModifyLiquidityParams(-887220, 887220, 1000 ether, bytes32(0)), "");
        Controller.Config memory c = _config(recipient);
        c.feeRecipients[0] = address(reserveFunding);
        controller = new Controller(c);
        token.approve(address(controller), type(uint256).max);
        vm.prank(safe);
        coreFunding.bindController(controller);
        vm.prank(safe);
        reserveFunding.bindController(controller);
        controller.fund(CORE, 1 ether);
    }

    function testActualHookBasePOLAndSeparateSurgeFundOnlyTheirOwnCompartment() public {
        _sellTo(200);
        uint256 pol = hook.owed(key.currency0, 3);
        uint256 surge = hook.owed(key.currency0, 4);
        assertGt(pol, 0);
        assertGt(surge, 0);
        uint256 otherFunding = hook.owed(key.currency0, 0) + hook.owed(key.currency0, 1) + hook.owed(key.currency0, 2);
        Controller.Account memory coreBefore = controller.account(CORE);
        Controller.Account memory reserveBefore = controller.account(RESERVE);
        hook.sweep(key.currency0, 3);
        hook.sweep(key.currency0, 4);
        assertEq(address(coreFunding).balance, pol);
        assertEq(address(reserveFunding).balance, surge);
        coreFunding.flush();
        reserveFunding.flush();
        assertEq(controller.account(CORE).idleNative, coreBefore.idleNative + pol);
        assertEq(controller.account(RESERVE).idleNative, reserveBefore.idleNative + surge);
        assertEq(controller.account(CORE).nativeCapacity, coreBefore.nativeCapacity);
        assertEq(controller.account(RESERVE).nativeCapacity, reserveBefore.nativeCapacity);
        assertEq(hook.totalOwed(key.currency0), otherFunding);
        assertEq(token.allowance(address(coreFunding), address(controller)), 0);
        assertEq(token.allowance(address(reserveFunding), address(controller)), 0);
        _assertCustody();
    }

    function testExactOutputSellOMRFeesRemainOMRWhenFundingCoreAndReserve() public {
        _sellTo(200); // Establish pressure before the exact-output sale.
        swaps.swap(
            key,
            SwapParams(false, int256(0.5 ether), TickMath.getSqrtPriceAtTick(400)),
            PoolSwapTest.TestSettings(false, false),
            ""
        );
        uint256 pol = hook.owed(key.currency1, 3);
        uint256 surge = hook.owed(key.currency1, 4);
        assertGt(pol, 0);
        assertGt(surge, 0);
        hook.sweep(key.currency1, 3);
        hook.sweep(key.currency1, 4);
        coreFunding.flush();
        reserveFunding.flush();
        assertEq(controller.account(CORE).idleOmr, 1 ether + pol);
        assertEq(controller.account(RESERVE).idleOmr, surge);
        assertEq(controller.account(CORE).idleNative, 0);
        assertEq(controller.account(RESERVE).idleNative, 0);
        _assertCustody();
    }

    function testSolverProfitClaimForAndFlushFundReserveWithoutTreasuryCollateral() public {
        PoolKey memory alternative = PoolKey(key.currency0, key.currency1, 500, 10, IHooks(address(0)));
        manager.initialize(alternative, TickMath.getSqrtPriceAtTick(10000));
        lp.modifyLiquidity{value: 2000 ether}(
            alternative, ModifyLiquidityParams(-887270, 887270, 1000 ether, bytes32(0)), ""
        );
        Arbitrage arb = new Arbitrage(manager, key, address(reserveFunding), 2000, 10 ether);
        Arbitrage.Plan memory p =
            Arbitrage.Plan(alternative, false, 1 ether, 1, uint64(vm.getBlockTimestamp() + 120), bytes32(uint256(1)));
        arb.commit(arb.hashPlan(address(this), p));
        vm.roll(vm.getBlockNumber() + 1);
        uint256 beforeCapacity = controller.account(RESERVE).nativeCapacity;
        uint256 profit = arb.execute{value: 1 ether}(p);
        assertGt(profit, 0);
        uint256 reserveShare = profit / 5;
        uint256 solverClaim = arb.claimable(address(this));
        assertEq(solverClaim, 1 ether + profit - reserveShare);
        assertEq(arb.claimable(address(reserveFunding)), reserveShare);
        vm.prank(address(0xBAD));
        arb.claimFor(payable(address(reserveFunding)));
        assertEq(address(reserveFunding).balance, reserveShare);
        reserveFunding.flush();
        assertEq(controller.account(RESERVE).idleNative, reserveShare);
        assertEq(controller.account(RESERVE).nativeCapacity, beforeCapacity);
        assertEq(arb.claimable(address(this)), solverClaim);
        assertEq(address(arb).balance, solverClaim);
        assertEq(arb.totalClaimable(), solverClaim);
        assertGt(hook.totalOwed(key.currency0), 0, "canonical arbitrage sale retains funding tax");
        _assertCustody();
    }
}
