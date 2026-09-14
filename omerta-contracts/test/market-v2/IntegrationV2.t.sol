// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StabilityV2Fixture} from "./StabilityV2.t.sol";
import {OmertaStabilityControllerV2 as Controller} from "../../src/market-v2/OmertaStabilityControllerV2.sol";
import {OmertaTurfV2} from "../../src/market-v2/OmertaTurfV2.sol";
import {OmertaTurfFeeBridgeV2} from "../../src/market-v2/OmertaTurfFeeBridgeV2.sol";
import {OmertaGameSettlementV2} from "../../src/market-v2/OmertaGameSettlementV2.sol";
import {OmertaMarketStateV2} from "../../src/market-v2/OmertaMarketStateV2.sol";
import {IOmertaMarketStateV2} from "../../src/market-v2/IOmertaMarketStateV2.sol";
import {OmertaArbitrageV2} from "../../src/market-v2/OmertaArbitrageV2.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";

contract TurfIntegrationV2Test is StabilityV2Fixture {
    OmertaGameSettlementV2 game;
    OmertaTurfV2 registry;
    OmertaTurfFeeBridgeV2 bridge;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA201);
    uint64 season;
    Controller.Tranche constant TURF = Controller.Tranche.Turf;

    function setUp() public override {
        super.setUp();
        game = new OmertaGameSettlementV2(safe, address(this));
        registry = new OmertaTurfV2(safe, token, address(game), observations, 60, 600);
        vm.prank(safe);
        game.bindRegistry(registry);
        game.setFamilyTreasury(1, alice, 0);
        game.setFamilyTreasury(2, bob, 0);
        uint64 start = uint64(block.timestamp + 1);
        vm.prank(safe);
        season = registry.createSeason(start, start + 28 days);
        vm.prank(safe);
        registry.createTurf(season, -600, 600, _single(1));
        bridge = new OmertaTurfFeeBridgeV2(safe, registry, season, 0);
        Controller.Config memory c = _config(recipient);
        c.feeRecipients[6] = address(bridge);
        c.turfSeasonStart = start;
        c.turfSeasonEnd = start + 28 days;
        controller = new Controller(c);
        token.approve(address(controller), type(uint256).max);
        controller.fund{value: 10 ether}(TURF, 10 ether);
        vm.prank(safe);
        bridge.bindSource(controller);
        vm.prank(safe);
        registry.bindFeeSource(address(bridge), season, 0);
        vm.prank(safe);
        game.registerLane(bridge);
        vm.warp(start);
        _reading(0, 0, 0);
        controller.deploy(TURF, epoch);
    }

    function _single(uint64 family) private pure returns (OmertaTurfV2.Split memory s) {
        s.families[0] = family;
        s.shares[0] = 10000;
        s.count = 1;
    }

    function _assertFees() private view {
        assertEq(address(registry).balance, registry.nativeLiability());
        assertEq(token.balanceOf(address(registry)), registry.omrLiability());
        assertEq(bridge.forwardedNative(), controller.claimedNativeFees(6));
        assertEq(bridge.forwardedOmr(), controller.claimedOmrFees(6));
        _assertCustody();
    }

    function testTakeoverAtomicallyPaysPreviousFamilyThenFutureOwner() public {
        _sellTo(10);
        game.settleOwnership(season, 0, _single(2), 1, epoch, bytes32(uint256(1)));
        (, uint256 aliceOmr) = registry.credits(alice);
        (, uint256 bobOmr) = registry.credits(bob);
        assertGt(aliceOmr, 0);
        assertEq(bobOmr, 0);
        _sellTo(20);
        bridge.checkpointFees();
        (, uint256 aliceAfter) = registry.credits(alice);
        (, uint256 bobAfter) = registry.credits(bob);
        assertEq(aliceAfter, aliceOmr);
        assertGt(bobAfter, 0);
        _assertFees();
    }

    function testEarlyPermissionlessClaimAndTokenDonationsCannotChangeFeeAuthority() public {
        _sellTo(10);
        controller.collect(TURF);
        controller.claimFees(TURF);
        uint256 actual = controller.claimedOmrFees(6);
        token.transfer(address(bridge), 100 ether);
        bridge.checkpointFees();
        bridge.checkpointFees();
        (, uint256 credited) = registry.credits(alice);
        assertEq(credited, actual);
        assertEq(token.balanceOf(address(bridge)), 100 ether);
        _assertFees();
    }

    function testWalletRotationCheckpointsAccruedFeesBeforeChangingTreasury() public {
        _sellTo(10);
        game.setFamilyTreasury(1, carol, 1);
        (, uint256 oldCredit) = registry.credits(alice);
        assertGt(oldCredit, 0);
        _sellTo(20);
        bridge.checkpointFees();
        (, uint256 oldAfter) = registry.credits(alice);
        (, uint256 newCredit) = registry.credits(carol);
        assertEq(oldAfter, oldCredit);
        assertGt(newCredit, 0);
        _assertFees();
    }

    function testSiegeEscrowsOnlyFeesEarnedAfterAtomicStart() public {
        _sellTo(10);
        game.startSiege(season, 0, _single(2), 1 hours, 5000, 1, epoch, bytes32(uint256(1)));
        (, uint256 beforeSiege) = registry.credits(alice);
        assertGt(beforeSiege, 0);
        assertEq(registry.siege(season, 0).omrEscrow, 0);
        _sellTo(20);
        bridge.checkpointFees();
        uint256 escrow = registry.siege(season, 0).omrEscrow;
        assertGt(escrow, 0);
        game.resolveSiege(season, 0, true, 2, epoch, bytes32(uint256(2)));
        (, uint256 a) = registry.credits(alice);
        (, uint256 b) = registry.credits(bob);
        assertEq(a, beforeSiege + escrow - escrow / 2);
        assertEq(b, escrow / 2);
        assertEq(registry.turf(season, 0).owners.families[0], 2);
        _assertFees();
    }

    function testRejectedSettlementRevertsFeeCheckpointAsWell() public {
        _sellTo(10);
        vm.expectRevert(OmertaTurfV2.StaleRevision.selector);
        game.settleOwnership(season, 0, _single(2), 99, epoch, bytes32(uint256(1)));
        assertEq(controller.claimedOmrFees(6), 0);
        assertEq(registry.omrLiability(), 0);
        bridge.checkpointFees();
        assertGt(registry.omrLiability(), 0);
        _assertFees();
    }

    function testExpiredSiegeCannotRedirectFrozenEarningsToReplacementWallet() public {
        game.startSiege(season, 0, _single(2), 1 hours, 5000, 1, epoch, bytes32(uint256(1)));
        _sellTo(10);
        game.setFamilyTreasury(1, carol, 1);
        _sellTo(20);
        vm.warp(registry.siege(season, 0).expiresAt);
        vm.expectRevert(OmertaTurfV2.Unauthorized.selector);
        registry.expireSiege(season, 0);
        game.expireSiege(season, 0);
        (, uint256 oldWallet) = registry.credits(alice);
        (, uint256 newWallet) = registry.credits(carol);
        assertGt(oldWallet, 0);
        assertEq(newWallet, 0);
        _sellTo(30);
        bridge.checkpointFees();
        (, uint256 afterExpiry) = registry.credits(carol);
        assertGt(afterExpiry, 0);
        _assertFees();
    }

    function testSeasonExpirySettlesFeesAndPrincipalEvenWithBrokenOracleAndPause() public {
        _sellTo(10);
        observations.setBroken(true);
        vm.prank(safe);
        controller.setPaused(true);
        vm.warp(controller.turfSeasonEnd());
        game.archiveLane(0);
        assertTrue(bridge.closed());
        assertEq(controller.position(TURF).liquidity, 0);
        assertEq(game.activeLanes().length, 0);
        assertGt(controller.account(TURF).omrReturned, 0);
        (, uint256 a) = registry.credits(alice);
        assertGt(a, 0);
        _assertFees();
        vm.prank(alice);
        registry.claim(payable(alice));
        assertEq(token.balanceOf(alice), a);
    }

    function testAdjudicatorCannotBeBypassedOrWithdrawPrincipal() public {
        vm.expectRevert(OmertaTurfV2.Unauthorized.selector);
        registry.setFamilyTreasury(1, bob, 1);
        vm.prank(bob);
        vm.expectRevert(OmertaGameSettlementV2.Unauthorized.selector);
        game.settleOwnership(season, 0, _single(2), 1, epoch, bytes32(uint256(1)));
        vm.expectRevert(Controller.Unauthorized.selector);
        controller.exit(TURF);
        _assertCustody();
    }
}

contract MarketIntegrationV2Test is StabilityV2Fixture {
    function testRealFinalizedHookObservationFundsControllerAndStaleReadStopsNewRisk() public {
        OmertaMarketStateV2 state = new OmertaMarketStateV2(hook, 1 ether, 600, 600);
        Controller.Config memory c = _config(recipient);
        c.marketState = state;
        Controller actual = new Controller(c);
        token.approve(address(actual), type(uint256).max);
        actual.fund{value: 10 ether}(CORE, 10 ether);
        assertFalse(state.snapshot().valid);
        vm.warp((block.timestamp / 60 + 2) * 60);
        state.refresh();
        IOmertaMarketStateV2.Snapshot memory s = state.snapshot();
        assertTrue(s.valid);
        assertEq(s.meanTick, 0);
        assertEq(s.omrPerEth, 1 ether);
        assertEq(s.stressBps, 0);
        actual.deploy(CORE, s.epoch);
        assertGt(actual.position(CORE).liquidity, 0);
        vm.warp(block.timestamp + 601);
        assertFalse(state.snapshot().valid);
        vm.prank(safe);
        actual.exit(CORE);
        vm.expectRevert(Controller.InvalidObservation.selector);
        actual.deploy(CORE, s.epoch);
    }

    function testRealV2CanonicalSellArbitragePaysTaxAndOnlySharesRealizedProfit() public {
        PoolKey memory alternative = PoolKey(key.currency0, key.currency1, 500, 10, IHooks(address(0)));
        manager.initialize(alternative, TickMath.getSqrtPriceAtTick(10000));
        lp.modifyLiquidity{value: 2000 ether}(
            alternative, ModifyLiquidityParams(-887270, 887270, 1000 ether, bytes32(0)), ""
        );
        OmertaArbitrageV2 arb = new OmertaArbitrageV2(manager, key, recipient, 2000, 10 ether);
        OmertaArbitrageV2.Plan memory plan =
            OmertaArbitrageV2.Plan(alternative, false, 1 ether, 1, uint64(block.timestamp + 120), bytes32(uint256(9)));
        arb.commit(arb.hashPlan(address(this), plan));
        vm.roll(block.number + 1);
        uint256 profit = arb.execute{value: 1 ether}(plan);
        assertGt(profit, 0);
        assertEq(arb.claimable(recipient), profit / 5);
        assertGt(hook.totalOwed(key.currency0), 0);
        assertEq(address(arb).balance, arb.totalClaimable());
    }
}
