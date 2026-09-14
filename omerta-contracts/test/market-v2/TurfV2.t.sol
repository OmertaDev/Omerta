// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {OmertaTurfV2} from "../../src/market-v2/OmertaTurfV2.sol";
import {IOmertaMarketStateV2} from "../../src/market-v2/IOmertaMarketStateV2.sol";
import {GameTokenFixtureV2, MarketGameFixtureV2} from "./GameFixtureV2.sol";

contract TurfFeeFixtureV2 {
    OmertaTurfV2 public immutable turf;
    GameTokenFixtureV2 public immutable token;
    constructor(OmertaTurfV2 t, GameTokenFixtureV2 o) { turf = t; token = o; token.approve(address(t), type(uint256).max); }
    function fund(uint64 s, uint32 id, uint256 amount) external payable { turf.depositFees{value: msg.value}(s, id, amount); }
}

contract TurfRejectRecipientV2 {
    receive() external payable { revert("reject"); }
}

contract TurfV2Test is Test {
    OmertaTurfV2 private turf;
    GameTokenFixtureV2 private token;
    MarketGameFixtureV2 private market;
    TurfFeeFixtureV2 private source;
    address private defender = address(0xD1);
    address private attacker = address(0xA1);
    address private nextTreasury = address(0xD2);
    uint64 private seasonId;
    uint64 private startsAt;

    function setUp() public {
        vm.warp(1_800_000_000);
        vm.deal(address(this), 10_000 ether);
        token = new GameTokenFixtureV2();
        market = new MarketGameFixtureV2();
        turf = new OmertaTurfV2(address(this), token, address(this), market, 60, 1 hours);
        turf.setFamilyTreasury(1, defender, 0);
        turf.setFamilyTreasury(2, attacker, 0);
        startsAt = uint64(block.timestamp + 1);
        seasonId = turf.createSeason(startsAt, startsAt + 30 days);
        turf.createTurf(seasonId, -1200, 0, _single(1));
        turf.createTurf(seasonId, 0, 1200, _single(1));
        source = new TurfFeeFixtureV2(turf, token);
        turf.bindFeeSource(address(source), seasonId, 0);
        token.mint(address(source), 1_000_000 ether);
        vm.warp(startsAt);
        _observe(1);
    }

    function _single(uint64 family) private pure returns (OmertaTurfV2.Split memory s) {
        s.count = 1; s.families[0] = family; s.shares[0] = 10_000;
    }
    function _observe(uint64 epoch) private {
        market.set(IOmertaMarketStateV2.Snapshot(epoch, uint64(block.timestamp), 0, 0, 100 ether, 1 ether, 0, 0, true));
    }
    function _fund(uint256 n, uint256 o) private { source.fund{value: n}(seasonId, 0, o); }
    function _start() private {
        turf.startSiege(seasonId, 0, _single(2), 1 days, 6000, turf.turf(seasonId, 0).revision, 1, bytes32("start"));
    }
    function _credits(address who) private view returns (uint256 n, uint256 o) { return turf.credits(who); }
    function _assertSolvent() private view {
        assertEq(address(turf).balance, turf.nativeLiability());
        assertEq(token.balanceOf(address(turf)), turf.omrLiability());
        (uint256 dn, uint256 dO) = _credits(defender);
        (uint256 an, uint256 ao) = _credits(attacker);
        (uint256 nn, uint256 no) = _credits(nextTreasury);
        OmertaTurfV2.Siege memory s = turf.siege(seasonId, 0);
        assertEq(dn + an + nn + s.nativeEscrow, turf.nativeLiability());
        assertEq(dO + ao + no + s.omrEscrow, turf.omrLiability());
    }

    function test_conquest_preserves_historical_earned_fees() public {
        _fund(3 ether, 9 ether);
        turf.settleOwnership(seasonId, 0, _single(2), 1, 1, bytes32("conquest"));
        _fund(2 ether, 4 ether);
        assertEq(_native(defender), 3 ether);
        assertEq(_native(attacker), 2 ether);
        vm.prank(defender); turf.claim(payable(defender));
        assertEq(defender.balance, 3 ether);
        assertEq(token.balanceOf(defender), 9 ether);
        _assertSolvent();
    }

    function test_treasury_change_is_prospective_and_nonce_checked() public {
        _fund(3 ether, 9 ether);
        turf.setFamilyTreasury(1, nextTreasury, 1);
        _fund(2 ether, 4 ether);
        assertEq(_native(defender), 3 ether);
        assertEq(_native(nextTreasury), 2 ether);
        vm.expectRevert(OmertaTurfV2.StaleRevision.selector);
        turf.setFamilyTreasury(1, attacker, 1);
        _assertSolvent();
    }

    function test_siege_freezes_recipient_and_victory_split_then_assigns_future_fees() public {
        _fund(1 ether, 1 ether);
        _start();
        _fund(10 ether, 10 ether);
        turf.setFamilyTreasury(1, nextTreasury, 1);
        turf.resolveSiege(seasonId, 0, true, 2, 1, bytes32("resolve"));
        assertEq(_native(defender), 5 ether);
        assertEq(_native(attacker), 6 ether);
        assertEq(_native(nextTreasury), 0);
        _fund(2 ether, 2 ether);
        assertEq(_native(attacker), 8 ether);
        assertEq(turf.turf(seasonId, 0).owners.families[0], 2);
        _assertSolvent();
    }

    function test_adapter_expiry_ignores_failed_oracle_and_direct_bypass_is_rejected() public {
        _start(); _fund(10 ether, 20 ether);
        vm.warp(block.timestamp + 1 days);
        market.setReverts(true);
        vm.prank(address(0x123)); vm.expectRevert(OmertaTurfV2.Unauthorized.selector); turf.expireSiege(seasonId, 0);
        turf.expireSiege(seasonId, 0);
        assertEq(_native(defender), 10 ether);
        assertEq(turf.siege(seasonId, 0).expiresAt, 0);
        assertEq(turf.turf(seasonId, 0).owners.families[0], 1);
        vm.prank(defender); turf.claim(payable(defender));
        _assertSolvent();
    }

    function test_late_deposit_expires_siege_without_stranding_escrow() public {
        _start(); _fund(10 ether, 20 ether);
        vm.warp(block.timestamp + 1 days);
        _fund(2 ether, 3 ether);
        assertEq(_native(defender), 12 ether);
        _assertSolvent();
    }

    function test_expired_siege_final_batch_uses_frozen_treasury_then_future_batch_uses_rotation() public {
        _start(); _fund(2 ether, 3 ether);
        turf.setFamilyTreasury(1, nextTreasury, 1);
        vm.warp(block.timestamp + 1 days);
        _fund(5 ether, 7 ether);
        assertEq(_native(defender), 7 ether);
        assertEq(_native(nextTreasury), 0);
        _fund(11 ether, 13 ether);
        assertEq(_native(nextTreasury), 11 ether);
        _assertSolvent();
    }

    function test_source_lane_cannot_relabel_other_turf_or_season() public {
        vm.expectRevert(OmertaTurfV2.Unauthorized.selector);
        source.fund{value: 1 ether}(seasonId, 1, 0);
        vm.expectRevert(OmertaTurfV2.Unauthorized.selector);
        source.fund{value: 1 ether}(seasonId + 1, 0, 0);
        vm.expectRevert(OmertaTurfV2.InvalidConfiguration.selector);
        turf.bindFeeSource(address(source), seasonId, 1);
    }

    function test_duplicate_source_and_post_start_binding_are_rejected() public {
        uint64 next = turf.createSeason(startsAt + 30 days, startsAt + 60 days);
        turf.createTurf(next, -1200, 1200, _single(1));
        TurfFeeFixtureV2 first = new TurfFeeFixtureV2(turf, token);
        TurfFeeFixtureV2 second = new TurfFeeFixtureV2(turf, token);
        turf.bindFeeSource(address(first), next, 0);
        vm.expectRevert(OmertaTurfV2.InvalidConfiguration.selector);
        turf.bindFeeSource(address(second), next, 0);
        vm.expectRevert(OmertaTurfV2.InvalidConfiguration.selector);
        turf.bindFeeSource(address(second), seasonId, 1);
        assertEq(turf.laneSource(next, 0), address(first));
    }

    function test_replayed_settlement_rejected_even_with_fresh_revision() public {
        turf.settleOwnership(seasonId, 0, _single(2), 1, 1, bytes32("same"));
        vm.expectRevert(OmertaTurfV2.InvalidSettlement.selector);
        turf.settleOwnership(seasonId, 0, _single(1), 2, 1, bytes32("same"));
        assertEq(turf.turf(seasonId, 0).revision, 2);
    }

    function test_wrong_epoch_future_time_and_stale_observation_rejected() public {
        vm.expectRevert(OmertaTurfV2.InvalidSettlement.selector);
        turf.settleOwnership(seasonId, 0, _single(2), 1, 2, bytes32("epoch"));
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(OmertaTurfV2.InvalidSettlement.selector);
        turf.settleOwnership(seasonId, 0, _single(2), 1, 1, bytes32("stale"));
        market.set(IOmertaMarketStateV2.Snapshot(2, uint64(block.timestamp + 1), 0, 0, 1, 1 ether, 0, 0, true));
        vm.expectRevert(OmertaTurfV2.InvalidSettlement.selector);
        turf.settleOwnership(seasonId, 0, _single(2), 1, 2, bytes32("future"));
    }

    function test_owner_cannot_override_season_ranges_after_start() public {
        vm.expectRevert(OmertaTurfV2.InvalidSeason.selector);
        turf.createTurf(seasonId, 1200, 2400, _single(1));
        vm.warp(startsAt + 30 days);
        _observe(2);
        vm.expectRevert(OmertaTurfV2.InvalidSeason.selector);
        turf.settleOwnership(seasonId, 0, _single(2), 1, 2, bytes32("late"));
    }

    function test_corridors_require_touching_matching_ownership_and_status_is_bounded() public {
        turf.settleStatus(seasonId, 0, 2, 10, 10_000, 1, 1, bytes32("status"));
        assertEq(turf.turf(seasonId, 0).corridors, 2);
        vm.expectRevert(OmertaTurfV2.InvalidConfiguration.selector);
        turf.settleStatus(seasonId, 0, 4, 10, 10_000, 2, 1, bytes32("invalid"));
        vm.expectRevert(OmertaTurfV2.InvalidConfiguration.selector);
        turf.settleStatus(seasonId, 0, 2, 11, 10_000, 2, 1, bytes32("fort"));
    }

    function test_failed_recipient_reverts_claim_without_losing_entitlement() public {
        _fund(1 ether, 3 ether);
        TurfRejectRecipientV2 reject = new TurfRejectRecipientV2();
        vm.prank(defender);
        vm.expectRevert(OmertaTurfV2.InvalidTransfer.selector);
        turf.claim(payable(address(reject)));
        assertEq(_native(defender), 1 ether);
        vm.prank(defender); turf.claim(payable(nextTreasury));
        vm.prank(defender); vm.expectRevert(OmertaTurfV2.NothingToClaim.selector); turf.claim(payable(defender));
        _assertSolvent();
    }

    function testFuzz_syndicate_and_siege_rounding_conserve_all_assets(uint96 nativeSeed, uint96 omrSeed, uint16 shareSeed) public {
        uint256 n = bound(nativeSeed, 1, 100 ether);
        uint256 o = bound(omrSeed, 1, 100 ether);
        uint16 share = uint16(bound(shareSeed, 1, 9999));
        OmertaTurfV2.Split memory split = _single(1);
        split.count = 2; split.families[1] = 2; split.shares[0] = share; split.shares[1] = 10_000 - share;
        turf.settleOwnership(seasonId, 0, split, 1, 1, bytes32("syndicate"));
        _fund(n, o); _assertSolvent();
        _start(); _fund(n, o); _assertSolvent();
        turf.resolveSiege(seasonId, 0, true, 3, 1, bytes32("victory"));
        _assertSolvent();
        (uint256 dn, uint256 dO) = _credits(defender);
        if (dn != 0 || dO != 0) { vm.prank(defender); turf.claim(payable(defender)); }
        (uint256 an, uint256 ao) = _credits(attacker);
        if (an != 0 || ao != 0) { vm.prank(attacker); turf.claim(payable(attacker)); }
        _assertSolvent();
        assertEq(defender.balance + attacker.balance, n * 2);
        assertEq(token.balanceOf(defender) + token.balanceOf(attacker), o * 2);
    }

    function _native(address who) private view returns (uint256 value) { (value,) = turf.credits(who); }
}

/// Stateful actor: real deposits, treasury rotations, conquest, siege, expiry and claims.
/// Its independent cumulative funding ledger is compared with paid balances plus outstanding debt.
contract TurfConservationHandlerV2 is Test {
    OmertaTurfV2 public turf;
    GameTokenFixtureV2 public token;
    MarketGameFixtureV2 private market;
    TurfFeeFixtureV2 private source;
    uint64 public seasonId;
    uint64 private nonce;
    uint256 public nativeFunded;
    uint256 public omrFunded;
    address[3] private wallets = [address(0x101), address(0x102), address(0x103)];

    constructor() {
        token = new GameTokenFixtureV2(); market = new MarketGameFixtureV2();
        turf = new OmertaTurfV2(address(this), token, address(this), market, 60, 1 hours);
        turf.setFamilyTreasury(1, wallets[0], 0); turf.setFamilyTreasury(2, wallets[1], 0);
        seasonId = turf.createSeason(uint64(block.timestamp + 1), uint64(block.timestamp + 100 days));
        turf.createTurf(seasonId, -1200, 1200, _split(1));
        source = new TurfFeeFixtureV2(turf, token);
        turf.bindFeeSource(address(source), seasonId, 0);
        token.mint(address(source), 1e32);
        vm.deal(address(this), 1e32); vm.warp(block.timestamp + 1);
    }
    function fund(uint96 nSeed, uint96 oSeed) external {
        uint256 n = bound(nSeed, 1, 1e15); uint256 o = bound(oSeed, 1, 1e15);
        source.fund{value: n}(seasonId, 0, o);
        nativeFunded += n; omrFunded += o;
    }
    function conquer(bool familyTwo) external {
        if (!_live() || turf.siege(seasonId, 0).expiresAt != 0) return;
        _observe();
        turf.settleOwnership(seasonId, 0, _split(familyTwo ? 2 : 1), turf.turf(seasonId, 0).revision, nonce, bytes32(uint256(nonce)));
    }
    function rotateTreasury(bool first, uint8 walletSeed) external {
        uint64 family = first ? 1 : 2;
        turf.setFamilyTreasury(family, wallets[walletSeed % 3], turf.familyRevision(family));
    }
    function siegeStep(bool victory) external {
        OmertaTurfV2.Siege memory s = turf.siege(seasonId, 0);
        if (s.expiresAt != 0 && block.timestamp >= s.expiresAt) { turf.expireSiege(seasonId, 0); return; }
        if (!_live()) return;
        _observe(); uint64 revision = turf.turf(seasonId, 0).revision;
        if (s.expiresAt != 0) turf.resolveSiege(seasonId, 0, victory, revision, nonce, bytes32(uint256(nonce)));
        else {
            (, uint64 endsAt,) = turf.seasons(seasonId);
            if (block.timestamp + 1 hours > endsAt) return;
            uint64 family = turf.turf(seasonId, 0).owners.families[0] == 1 ? 2 : 1;
            turf.startSiege(seasonId, 0, _split(family), 1 hours, 6000, revision, nonce, bytes32(uint256(nonce)));
        }
    }
    function claim(uint8 walletSeed) external {
        address wallet = wallets[walletSeed % 3];
        (uint256 n, uint256 o) = turf.credits(wallet);
        if (n != 0 || o != 0) { vm.prank(wallet); turf.claim(payable(wallet)); }
    }
    function advance(uint32 delay) external { vm.warp(block.timestamp + bound(delay, 1, 2 days)); }
    function totals() external view returns (uint256 creditsN, uint256 creditsO, uint256 paidN, uint256 paidO) {
        for (uint256 i; i < 3; ++i) {
            (uint256 n, uint256 o) = turf.credits(wallets[i]);
            creditsN += n; creditsO += o; paidN += wallets[i].balance; paidO += token.balanceOf(wallets[i]);
        }
    }
    function _live() private view returns (bool) { (, uint64 endsAt,) = turf.seasons(seasonId); return block.timestamp < endsAt; }
    function _observe() private {
        ++nonce; market.set(IOmertaMarketStateV2.Snapshot(nonce, uint64(block.timestamp), 0, 0, 1 ether, 1 ether, 0, 0, true));
    }
    function _split(uint64 family) private pure returns (OmertaTurfV2.Split memory s) {
        s.count = 1; s.families[0] = family; s.shares[0] = 10_000;
    }
}

contract TurfV2InvariantTest is Test {
    TurfConservationHandlerV2 private handler;
    function setUp() public {
        vm.warp(1_800_000_000);
        handler = new TurfConservationHandlerV2();
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = handler.fund.selector; selectors[1] = handler.conquer.selector;
        selectors[2] = handler.rotateTreasury.selector; selectors[3] = handler.siegeStep.selector;
        selectors[4] = handler.claim.selector; selectors[5] = handler.advance.selector;
        targetSelector(FuzzSelector(address(handler), selectors)); targetContract(address(handler));
    }
    function invariant_all_funded_fees_are_paid_or_back_exact_historical_credits_and_escrow() public view {
        OmertaTurfV2 t = handler.turf();
        (uint256 creditN, uint256 creditO, uint256 paidN, uint256 paidO) = handler.totals();
        OmertaTurfV2.Siege memory s = t.siege(handler.seasonId(), 0);
        assertEq(t.nativeLiability(), creditN + s.nativeEscrow);
        assertEq(t.omrLiability(), creditO + s.omrEscrow);
        assertEq(address(t).balance, t.nativeLiability());
        assertEq(handler.token().balanceOf(address(t)), t.omrLiability());
        assertEq(handler.nativeFunded(), paidN + t.nativeLiability());
        assertEq(handler.omrFunded(), paidO + t.omrLiability());
    }
}
