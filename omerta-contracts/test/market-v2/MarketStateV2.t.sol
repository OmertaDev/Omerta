// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {OmertaHookV2Fixture} from "./OmertaHookV2.t.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {OmertaMarketStateV2} from "../../src/market-v2/OmertaMarketStateV2.sol";
import {IOmertaMarketStateV2} from "../../src/market-v2/IOmertaMarketStateV2.sol";
import {ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

contract MarketStateV2Test is OmertaHookV2Fixture {
    OmertaMarketStateV2 internal market;
    function setUp() public override {
        super.setUp();
        market = new OmertaMarketStateV2(hook, INITIAL_L / 2, 120, 100);
    }

    function test_requiresCompleteEpochAndCannotRefreshSpamNewEpochs() public {
        assertFalse(market.refresh().valid);
        vm.warp(3659);
        assertFalse(market.refresh().valid);
        vm.warp(3660);
        IOmertaMarketStateV2.Snapshot memory s = market.refresh();
        assertTrue(s.valid);
        assertEq(s.epoch, 60);
        assertEq(s.observedAt, 3660);
        assertEq(s.omrPerEth, 1e18);
        assertEq(s.minLiquidity, INITIAL_L);
        for (uint256 i; i < 20; ++i) assertEq(market.refresh().epoch, s.epoch);
    }

    function test_snapshotFailsClosedWhenStaleWithoutNeedingRefresh() public {
        vm.warp(3660);
        assertTrue(market.refresh().valid);
        vm.warp(3781);
        assertFalse(market.snapshot().valid);
        // Idle time still represents continuously available liquidity, so a keeper can safely
        // publish the most recent complete quiet interval without manufacturing its old volume.
        assertTrue(market.refresh().valid);
        assertEq(market.snapshot().observedAt, 3780);
    }

    function test_zeroLiquidityIntervalInvalidatesAndRecoveryNeedsFullHealthyEpoch() public {
        vm.warp(3630);
        lpRouter.modifyLiquidity(key, ModifyLiquidityParams(-887220, 887220, -int256(uint256(INITIAL_L)), bytes32(0)), "");
        vm.warp(3640);
        lpRouter.modifyLiquidity{value: 1001 ether}(key, ModifyLiquidityParams(-887220, 887220, int256(uint256(INITIAL_L)), bytes32(0)), "");
        vm.warp(3660);
        assertFalse(market.refresh().valid);
        assertEq(market.snapshot().minLiquidity, 0);
        vm.warp(3720);
        assertTrue(market.refresh().valid);
    }

    function test_swapAtBoundaryCannotRewritePriorEpochPriceOrVolume() public {
        vm.warp(3660);
        _swap(false, -int256(30 ether));
        IOmertaMarketStateV2.Snapshot memory s = market.refresh();
        assertTrue(s.valid);
        assertEq(s.meanTick, 0);
        assertEq(s.sellImbalanceBps, 0);
        assertEq(s.omrPerEth, 1e18);
        vm.warp(3720);
        s = market.refresh();
        assertGt(s.meanTick, 0); // OMR per ETH rises when OMR's ETH value falls.
        assertGt(s.omrPerEth, 1e18);
        assertEq(s.sellImbalanceBps, 10_000);
    }

    function test_timeWeightedVarianceUsesElapsedPriceNotSwapCount() public {
        vm.warp(3630);
        _swapLimit(false, -int256(100 ether), TickMath.getSqrtPriceAtTick(100));
        assertEq(hook.lastTick(), 100);
        vm.warp(3660);
        IOmertaMarketStateV2.Snapshot memory s = market.refresh();
        assertEq(s.meanTick, 50);
        assertEq(s.volatilityTicks, 50);
        assertGe(s.stressBps, 5000); // 50 ticks of dispersion, plus depth-scaled net sell flow.
        assertLe(s.stressBps, 5100);
    }

    function test_negativeFractionalMeanRoundsTowardNegativeInfinity() public {
        vm.warp(3631);
        _swapLimit(true, -int256(100 ether), TickMath.getSqrtPriceAtTick(-11));
        int24 tick = hook.lastTick();
        vm.warp(3660);
        IOmertaMarketStateV2.Snapshot memory s = market.refresh();
        int256 cumulative = int256(tick) * 29;
        int256 expected = cumulative / 60;
        if (cumulative % 60 != 0) --expected;
        assertEq(s.meanTick, expected);
        assertLt(s.omrPerEth, 1e18);
    }

    function test_dustSellCannotDeclareFullMarketStress() public {
        _swap(false, -int256(1e9));
        vm.warp(3660);
        IOmertaMarketStateV2.Snapshot memory s = market.refresh();
        assertTrue(s.valid);
        assertEq(s.sellImbalanceBps, 0);
        assertEq(s.stressBps, 0);
    }

    function testFuzz_idleCheckpointsCannotChangeObservedPrice(uint32 idle, uint8 spam) public {
        idle = uint32(bound(idle, 60, 365 days));
        vm.warp(3600 + idle);
        IOmertaMarketStateV2.Snapshot memory first = market.refresh();
        assertTrue(first.valid);
        assertEq(first.meanTick, 0);
        assertEq(first.omrPerEth, 1e18);
        assertEq(first.volatilityTicks, 0);
        for (uint256 i; i < uint256(spam) % 20; ++i) {
            IOmertaMarketStateV2.Snapshot memory current = market.refresh();
            assertEq(current.epoch, first.epoch);
            assertEq(current.observedAt, first.observedAt);
        }
    }
}
