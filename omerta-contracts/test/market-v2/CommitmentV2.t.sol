// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {Actions} from "../../lib/v4-periphery/src/libraries/Actions.sol";
import {PositionManager} from "../../lib/v4-periphery/src/PositionManager.sol";
import {IPositionDescriptor} from "../../lib/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "../../lib/v4-periphery/src/interfaces/external/IWETH9.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {DeployPermit2} from "permit2/test/utils/DeployPermit2.sol";
import {OmertaCommitmentVaultV2, ICommitmentPositionManagerV2} from "../../src/market-v2/OmertaCommitmentVaultV2.sol";
import {IOmertaMarketStateV2} from "../../src/market-v2/IOmertaMarketStateV2.sol";
import {GameTokenFixtureV2, MarketGameFixtureV2} from "./GameFixtureV2.sol";

/// The manager, NFT, allowances, principal, and transfer authority use real pinned v4 implementations.
/// The explicit market fixture isolates observation validity; it is not a production oracle proof.
contract CommitmentV2Test is Test, DeployPermit2 {
    OmertaCommitmentVaultV2 private vault;
    IPoolManager private manager;
    ICommitmentPositionManagerV2 private pm;
    IAllowanceTransfer private permit;
    GameTokenFixtureV2 private token;
    MarketGameFixtureV2 private market;
    PoolKey private key;
    address private alice = address(0xA11CE);
    address private bob = address(0xB0B);
    uint64 private campaignId;

    function setUp() public {
        vm.warp(1_800_000_000);
        vm.deal(address(this), 100_000 ether);
        manager = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        permit = IAllowanceTransfer(deployPermit2());
        pm = ICommitmentPositionManagerV2(address(new PositionManager(
            manager, permit, 100_000, IPositionDescriptor(address(0)), IWETH9(address(0)))));
        token = new GameTokenFixtureV2();
        token.mint(address(this), 100_000 ether);
        token.approve(address(permit), type(uint256).max);
        permit.approve(address(token), address(pm), type(uint160).max, type(uint48).max);
        key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(token)), 3000, 60, IHooks(address(0)));
        manager.initialize(key, uint160(1 << 96));
        market = new MarketGameFixtureV2();
        _observe(1, 0);
        vault = new OmertaCommitmentVaultV2(address(this), pm, market, key, 1 hours, 1 ether);
        campaignId = vault.createCampaign{value: 10 ether}(_terms());
    }
    receive() external payable {}

    function _terms() private view returns (OmertaCommitmentVaultV2.CampaignTerms memory t) {
        t.startsAt = uint64(block.timestamp);
        t.endsAt = uint64(block.timestamp + 10 days);
        t.minLock = 1 hours;
        t.maxLock = 7 days;
        t.maxObservationGap = 2 hours;
        t.referenceHalfWidth = 120;
        t.maxEpochDepthWei = 10 ether;
        t.maxRewardPerEpoch = 2 ether;
        t.rewardWeiPerEthDay = 1 ether;
    }
    function _observe(uint64 epoch, int24 tick) private {
        market.set(IOmertaMarketStateV2.Snapshot(epoch, uint64(block.timestamp), tick, 0, 100 ether, 1 ether, 0, 0, true));
    }
    function _mint(PoolKey memory pool, int24 lower, int24 upper, uint128 liquidity) private returns (uint256 id) {
        id = pm.nextTokenId();
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(pool, lower, upper, uint256(liquidity), uint128(50 ether), uint128(50 ether), alice, bytes(""));
        params[1] = abi.encode(pool.currency0, pool.currency1);
        params[2] = abi.encode(pool.currency0, address(this));
        pm.modifyLiquidities{value: 50 ether}(
            abi.encode(abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP)), params),
            block.timestamp);
    }
    function _commit(int24 lower, int24 upper, uint128 liquidity) private returns (uint256 id) {
        id = _mint(key, lower, upper, liquidity);
        vm.prank(alice); IERC721(address(pm)).approve(address(vault), id);
        vm.prank(alice); vault.commit(id, campaignId, 2 days);
    }
    function _next(uint256 id, uint64 epoch, uint32 delay) private {
        vm.warp(block.timestamp + delay); _observe(epoch, 0); vault.checkpoint(id);
    }
    function _settle(uint256 id) private {
        vm.warp(vault.settlementClosesAt(vault.commitment(id).campaignId) + 1);
        vault.settleReward(id);
    }
    function _solvent() private view {
        assertEq(address(vault).balance, vault.availableBudget() + vault.rewardLiability());
        OmertaCommitmentVaultV2.Campaign memory c = vault.campaign(campaignId);
        assertEq(c.available + c.paidOrOwed, 10 ether);
    }

    function test_real_nft_custody_and_single_sample_never_pays() public {
        uint256 id = _commit(-1200, 1200, 100 ether);
        assertEq(pm.ownerOf(id), address(vault));
        assertEq(vault.rewards(alice), 0);
        assertGt(vault.commitment(id).lastDepth, 0);
        assertEq(vault.commitment(id).usefulDepthSeconds, 0);
        vm.expectRevert(OmertaCommitmentVaultV2.InvalidObservation.selector); vault.checkpoint(id);
        assertEq(vault.rewards(alice), 0);
        _solvent();
    }

    function test_paired_observations_settle_original_depositor_after_epoch_and_claim_once() public {
        uint256 id = _commit(-1200, 1200, 100 ether);
        uint256 depth = vault.commitment(id).lastDepth;
        _next(id, 2, 1 hours);
        assertEq(vault.commitment(id).usefulDepthSeconds, depth * 1 hours);
        uint256 reward = depth * 1 hours / 1 days;
        assertEq(vault.rewards(alice), 0, "checkpoint order cannot consume the budget");
        vm.expectRevert(OmertaCommitmentVaultV2.InvalidCampaign.selector); vault.settleReward(id);
        _settle(id);
        assertEq(vault.rewards(alice), reward);
        vm.prank(bob); vm.expectRevert(OmertaCommitmentVaultV2.InvalidTransfer.selector); vault.claimReward(payable(bob));
        vm.prank(alice); vault.claimReward(payable(bob));
        assertEq(bob.balance, reward);
        vm.prank(alice); vm.expectRevert(OmertaCommitmentVaultV2.InvalidTransfer.selector); vault.claimReward(payable(alice));
        _solvent();
    }

    function test_one_sided_and_tiny_range_positions_earn_no_bounty_despite_large_L() public {
        uint256 narrow = _commit(-60, 60, 1_000 ether);
        uint256 oneSided = _commit(600, 1200, 100 ether);
        assertEq(vault.commitment(narrow).lastDepth, 0);
        assertEq(vault.commitment(oneSided).lastDepth, 0);
        _next(narrow, 2, 1 hours);
        vault.checkpoint(oneSided);
        assertEq(vault.rewards(alice), 0);
    }

    function test_depth_disappearing_at_next_epoch_zeroes_interval_reward() public {
        uint256 id = _commit(-1200, 1200, 100 ether);
        vm.warp(block.timestamp + 1 hours); _observe(2, 1800); vault.checkpoint(id);
        assertEq(vault.rewards(alice), 0);
        assertEq(vault.commitment(id).lastDepth, 0);
        _next(id, 3, 1 hours);
        assertEq(vault.rewards(alice), 0);
        _next(id, 4, 1 hours);
        _settle(id);
        assertGt(vault.rewards(alice), 0);
    }

    function test_oracle_gap_is_not_backfilled() public {
        uint256 id = _commit(-1200, 1200, 100 ether);
        _next(id, 2, 3 hours);
        assertEq(vault.rewards(alice), 0);
        _next(id, 3, 1 hours);
        _settle(id);
        assertGt(vault.rewards(alice), 0);
    }

    function test_paused_interval_is_never_retroactively_rewarded() public {
        uint256 id = _commit(-1200, 1200, 100 ether);
        vault.setPaused(true);
        vm.warp(block.timestamp + 30 minutes);
        vault.setPaused(false);
        _next(id, 2, 30 minutes);
        assertEq(vault.rewards(alice), 0);
        _next(id, 3, 1 hours);
        _settle(id);
        assertGt(vault.rewards(alice), 0);
    }

    function test_reverting_and_stale_oracle_break_anchor_without_grant() public {
        uint256 id = _commit(-1200, 1200, 100 ether);
        market.setReverts(true); vault.checkpoint(id);
        assertEq(vault.commitment(id).lastDepth, 0);
        market.setReverts(false);
        _next(id, 2, 1 hours);
        assertEq(vault.rewards(alice), 0);
        vm.warp(block.timestamp + 2 hours); vault.checkpoint(id);
        _observe(3, 0); vault.checkpoint(id);
        assertEq(vault.rewards(alice), 0);
        _next(id, 4, 1 hours);
        _settle(id);
        assertGt(vault.rewards(alice), 0);
    }

    function test_future_timestamp_low_depth_and_invalid_snapshot_do_not_pay() public {
        uint256 id = _commit(-1200, 1200, 100 ether);
        vm.warp(block.timestamp + 1 hours);
        market.set(IOmertaMarketStateV2.Snapshot(2, uint64(block.timestamp + 1), 0, 0, 100 ether, 1 ether, 0, 0, true));
        vault.checkpoint(id);
        market.set(IOmertaMarketStateV2.Snapshot(3, uint64(block.timestamp), 0, 0, 0, 1 ether, 0, 0, true));
        vault.checkpoint(id);
        market.set(IOmertaMarketStateV2.Snapshot(4, uint64(block.timestamp), 0, 0, 100 ether, 1 ether, 0, 0, false));
        vault.checkpoint(id);
        assertEq(vault.rewards(alice), 0);
    }

    function test_maturity_withdrawal_succeeds_while_paused_and_oracle_reverts() public {
        uint256 id = _commit(-1200, 1200, 100 ether);
        uint128 beforeLiquidity = pm.getPositionLiquidity(id);
        vm.prank(alice); vm.expectRevert(OmertaCommitmentVaultV2.NotMature.selector); vault.withdraw(id, alice);
        vault.setPaused(true); market.setReverts(true);
        vm.warp(block.timestamp + 2 days);
        vm.prank(bob); vm.expectRevert(OmertaCommitmentVaultV2.Unauthorized.selector); vault.withdraw(id, bob);
        vm.prank(alice); vault.withdraw(id, bob);
        assertEq(pm.ownerOf(id), bob);
        assertEq(pm.getPositionLiquidity(id), beforeLiquidity);
        vm.prank(alice); vm.expectRevert(OmertaCommitmentVaultV2.Unauthorized.selector); vault.withdraw(id, alice);
    }

    function test_no_admin_nft_recovery_or_old_owner_approval_can_steal_custody() public {
        uint256 id = _mint(key, -1200, 1200, 100 ether);
        vm.prank(alice); IERC721(address(pm)).setApprovalForAll(bob, true);
        vm.prank(alice); IERC721(address(pm)).approve(address(vault), id);
        vm.prank(alice); vault.commit(id, campaignId, 2 days);
        vm.prank(bob); vm.expectRevert(); IERC721(address(pm)).transferFrom(address(vault), bob, id);
        vm.expectRevert(OmertaCommitmentVaultV2.Unauthorized.selector); vault.withdraw(id, address(this));
        assertEq(pm.ownerOf(id), address(vault));
    }

    function test_noncanonical_pool_rejected_and_unsolicited_safe_transfer_rejected() public {
        PoolKey memory other = key; other.fee = 500;
        manager.initialize(other, uint160(1 << 96));
        uint256 id = _mint(other, -1200, 1200, 100 ether);
        vm.prank(alice); IERC721(address(pm)).approve(address(vault), id);
        vm.prank(alice); vm.expectRevert(OmertaCommitmentVaultV2.InvalidPosition.selector); vault.commit(id, campaignId, 2 days);
        uint256 canonicalId = _mint(key, -1200, 1200, 100 ether);
        vm.prank(alice); vm.expectRevert(OmertaCommitmentVaultV2.InvalidPosition.selector);
        pm.safeTransferFrom(alice, address(vault), canonicalId);
        assertEq(pm.ownerOf(canonicalId), alice);
    }

    function test_budget_exhaustion_is_funded_cap_not_unbacked_entitlement() public {
        OmertaCommitmentVaultV2.CampaignTerms memory t = _terms();
        uint64 tiny = vault.createCampaign{value: 1 wei}(t);
        uint256 id = _mint(key, -1200, 1200, 100 ether);
        vm.prank(alice); IERC721(address(pm)).approve(address(vault), id);
        vm.prank(alice); vault.commit(id, tiny, 2 days);
        _next(id, 2, 1 hours); _next(id, 3, 1 hours);
        _settle(id);
        assertEq(vault.rewards(alice), 1);
        assertEq(vault.campaign(tiny).available, 0);
        assertEq(vault.rewardLiability(), 1);
        assertEq(address(vault).balance, vault.availableBudget() + vault.rewardLiability());
    }

    function test_reward_cap_is_shared_by_epoch_instead_of_reset_per_NFT() public {
        OmertaCommitmentVaultV2.CampaignTerms memory t = _terms(); t.maxRewardPerEpoch = 7;
        uint64 capped = vault.createCampaign{value: 1 ether}(t);
        uint256 id = _mint(key, -1200, 1200, 100 ether);
        vm.prank(alice); IERC721(address(pm)).approve(address(vault), id);
        vm.prank(alice); vault.commit(id, capped, 2 days);
        uint256 second = _mint(key, -1200, 1200, 100 ether);
        vm.prank(alice); IERC721(address(pm)).approve(address(vault), second);
        vm.prank(alice); vault.commit(second, capped, 2 days);
        _next(id, 2, 1 hours); _next(id, 3, 1 hours);
        vault.checkpoint(second);
        _settle(id); vault.settleReward(second);
        assertLe(vault.rewards(alice), 7);
        assertEq(vault.campaign(capped).settlementBudget, 7);
        assertEq(vault.commitment(id).rewardCredited, 3);
        assertEq(vault.commitment(second).rewardCredited, 3);
    }

    function test_unequal_scores_share_exhausted_funding_pro_rata_across_depositors() public {
        uint64 funded = vault.createCampaign{value: 101 wei}(_terms());
        uint256 larger = _mint(key, -1200, 1200, 100 ether);
        vm.prank(alice); IERC721(address(pm)).approve(address(vault), larger);
        vm.prank(alice); vault.commit(larger, funded, 2 days);
        uint256 smaller = _mint(key, -1200, 1200, 50 ether);
        vm.prank(alice); IERC721(address(pm)).transferFrom(alice, bob, smaller);
        vm.prank(bob); IERC721(address(pm)).approve(address(vault), smaller);
        vm.prank(bob); vault.commit(smaller, funded, 2 days);
        _next(larger, 2, 1 hours); vault.checkpoint(smaller);
        uint256 largeScore = vault.commitment(larger).usefulDepthSeconds;
        uint256 smallScore = vault.commitment(smaller).usefulDepthSeconds;
        assertGt(smallScore, 0);
        assertGt(largeScore, smallScore);
        assertGt((largeScore + smallScore) / 1 days, 101);

        _settle(smaller); vault.settleReward(larger);
        assertEq(vault.campaign(funded).totalDepthSeconds, largeScore + smallScore);
        assertEq(vault.campaign(funded).settlementBudget, 101);
        assertEq(vault.campaign(funded).available, 0);
        assertEq(vault.rewards(alice), 101 * largeScore / (largeScore + smallScore));
        assertEq(vault.rewards(bob), 101 * smallScore / (largeScore + smallScore));
        assertGt(vault.rewards(alice), vault.rewards(bob));
        assertGt(vault.rewards(bob), 0);
        assertLe(vault.rewards(alice) + vault.rewards(bob), 101);
        assertEq(vault.rewardLiability(), 101);
        _solvent();
    }

    function test_integrated_depth_cap_is_shared_globally_without_capping_position_scores() public {
        OmertaCommitmentVaultV2.CampaignTerms memory t = _terms();
        t.endsAt = uint64(block.timestamp + 2 days);
        t.maxEpochDepthWei = 1 gwei;
        uint64 capped = vault.createCampaign{value: 1 ether}(t);
        uint256 first = _mint(key, -1200, 1200, 100 ether);
        vm.prank(alice); IERC721(address(pm)).approve(address(vault), first);
        vm.prank(alice); vault.commit(first, capped, 2 days);
        uint256 second = _mint(key, -1200, 1200, 100 ether);
        vm.prank(alice); IERC721(address(pm)).approve(address(vault), second);
        vm.prank(alice); vault.commit(second, capped, 2 days);
        uint256 uncappedDepth = vault.commitment(first).lastDepth;
        assertGt(uncappedDepth, t.maxEpochDepthWei);
        _next(first, 2, 1 hours); vault.checkpoint(second);
        assertEq(vault.commitment(first).usefulDepthSeconds, uncappedDepth * 1 hours);
        assertEq(vault.commitment(second).usefulDepthSeconds, uncappedDepth * 1 hours);
        uint256 globalScoreCap = uint256(t.maxEpochDepthWei) * (t.endsAt - t.startsAt);
        assertGt(vault.campaign(capped).totalDepthSeconds, globalScoreCap);

        _settle(first); vault.settleReward(second);
        uint256 expectedBudget = globalScoreCap / 1 days;
        assertEq(expectedBudget, 2 gwei);
        assertLt(expectedBudget, t.maxRewardPerEpoch);
        assertLt(expectedBudget, 1 ether);
        assertEq(vault.campaign(capped).settlementBudget, expectedBudget);
        assertEq(vault.commitment(first).rewardCredited, expectedBudget / 2);
        assertEq(vault.commitment(second).rewardCredited, expectedBudget / 2);
        assertEq(vault.rewards(alice), expectedBudget);
        _solvent();
    }

    function test_post_claim_rounding_dust_stays_reserved_and_cannot_be_recovered() public {
        OmertaCommitmentVaultV2.CampaignTerms memory t = _terms();
        t.maxRewardPerEpoch = 7;
        uint64 capped = vault.createCampaign{value: 1 ether}(t);
        uint256 first = _mint(key, -1200, 1200, 100 ether);
        vm.prank(alice); IERC721(address(pm)).approve(address(vault), first);
        vm.prank(alice); vault.commit(first, capped, 2 days);
        uint256 second = _mint(key, -1200, 1200, 100 ether);
        vm.prank(alice); IERC721(address(pm)).approve(address(vault), second);
        vm.prank(alice); vault.commit(second, capped, 2 days);
        _next(first, 2, 1 hours); vault.checkpoint(second);
        assertGt(vault.commitment(first).usefulDepthSeconds, 0);
        assertEq(vault.commitment(first).usefulDepthSeconds, vault.commitment(second).usefulDepthSeconds);
        _settle(first); vault.settleReward(second);
        assertEq(vault.rewards(alice), 6);
        assertEq(vault.rewardLiability(), 7);
        vault.recoverUnusedBudget(capped, payable(bob));
        vault.recoverUnusedBudget(campaignId, payable(bob));
        assertEq(vault.availableBudget(), 0);
        assertEq(address(vault).balance, 7);
        vm.prank(alice); vault.claimReward(payable(alice));
        assertEq(vault.rewards(alice), 0);
        assertEq(vault.rewardLiability(), 1);
        assertEq(address(vault).balance, 1);
        uint256 recovered = bob.balance;
        vault.recoverUnusedBudget(capped, payable(bob));
        assertEq(bob.balance, recovered);
        assertEq(vault.rewardLiability(), 1);
        assertEq(address(vault).balance, vault.availableBudget() + vault.rewardLiability());
        vm.prank(alice); vm.expectRevert(OmertaCommitmentVaultV2.InvalidTransfer.selector);
        vault.claimReward(payable(alice));
    }

    function test_unused_budget_recovery_excludes_earned_claims_and_NFT() public {
        uint256 id = _commit(-1200, 1200, 100 ether);
        _next(id, 2, 1 hours);
        uint256 owed = vault.commitment(id).usefulDepthSeconds / 1 days;
        vm.expectRevert(OmertaCommitmentVaultV2.InvalidCampaign.selector); vault.recoverUnusedBudget(campaignId, payable(bob));
        vm.warp(block.timestamp + 11 days);
        vault.recoverUnusedBudget(campaignId, payable(bob));
        assertEq(bob.balance, 10 ether - owed);
        assertEq(address(vault).balance, owed);
        assertEq(pm.ownerOf(id), address(vault));
        vault.settleReward(id);
        vm.prank(alice); vault.claimReward(payable(alice));
        vm.prank(alice); vault.withdraw(id, alice);
        assertEq(pm.ownerOf(id), alice);
    }

    function testFuzz_budget_conservation_and_repeat_epoch_no_double_credit(uint128 liquiditySeed, uint16 secondsSeed) public {
        uint128 liquidity = uint128(bound(liquiditySeed, 1 ether, 100 ether));
        uint32 secondsElapsed = uint32(bound(secondsSeed, 1, 2 hours));
        uint256 id = _commit(-1200, 1200, liquidity);
        _next(id, 2, secondsElapsed);
        uint256 reward = vault.rewards(alice);
        assertLe(reward, 2 ether);
        vm.expectRevert(OmertaCommitmentVaultV2.InvalidObservation.selector); vault.checkpoint(id);
        assertEq(vault.rewards(alice), reward);
        _settle(id);
        assertLe(vault.rewards(alice), 2 ether);
        _solvent();
    }

    function test_settlement_order_cannot_capture_another_positions_prefunded_share() public {
        uint256 first = _commit(-1200, 1200, 100 ether);
        uint256 second = _commit(-1200, 1200, 100 ether);
        _next(first, 2, 1 hours); vault.checkpoint(second);
        assertEq(vault.rewards(alice), 0);
        vm.warp(vault.settlementClosesAt(campaignId) + 1);
        uint256 snap = vm.snapshotState();
        vault.settleReward(first); vault.settleReward(second);
        uint256 firstReward = vault.commitment(first).rewardCredited;
        uint256 secondReward = vault.commitment(second).rewardCredited;
        assertTrue(vm.revertToState(snap));
        vault.settleReward(second); vault.settleReward(first);
        assertEq(vault.commitment(first).rewardCredited, firstReward);
        assertEq(vault.commitment(second).rewardCredited, secondReward);
        assertEq(firstReward, secondReward);
        vm.expectRevert(OmertaCommitmentVaultV2.InvalidPosition.selector); vault.settleReward(first);
        _solvent();
    }

    function testFuzz_equal_exposure_split_across_NFTs_and_accounts_cannot_increase_reward(uint128 seed) public {
        uint128 liquidity = uint128(bound(seed, 2 ether, 100 ether));
        uint256 whole = _commit(-1200, 1200, liquidity * 2);
        uint256 halfA = _commit(-1200, 1200, liquidity);
        uint256 halfB = _mint(key, -1200, 1200, liquidity);
        vm.prank(alice); IERC721(address(pm)).transferFrom(alice, bob, halfB);
        vm.prank(bob); IERC721(address(pm)).approve(address(vault), halfB);
        vm.prank(bob); vault.commit(halfB, campaignId, 2 days);
        _next(halfA, 2, 1 hours); vault.checkpoint(halfB); vault.checkpoint(whole);
        _settle(halfB); vault.settleReward(halfA); vault.settleReward(whole);
        assertLe(vault.commitment(halfA).rewardCredited + vault.commitment(halfB).rewardCredited,
            vault.commitment(whole).rewardCredited);
        _solvent();
    }

    function test_recovery_reserves_unsettled_claims_and_settlement_survives_NFT_exit_and_pause() public {
        uint256 id = _commit(-1200, 1200, 100 ether);
        _next(id, 2, 1 hours);
        vm.warp(block.timestamp + 2 days);
        vm.prank(alice); vault.withdraw(id, bob);
        vault.setPaused(true); market.setReverts(true);
        vm.warp(vault.settlementClosesAt(campaignId) + 1);
        vault.recoverUnusedBudget(campaignId, payable(bob));
        uint256 reserved = vault.rewardLiability();
        assertGt(reserved, 0);
        assertEq(address(vault).balance, reserved);
        vault.settleReward(id);
        assertEq(vault.rewards(alice), reserved);
        vm.prank(alice); vault.claimReward(payable(alice));
        assertEq(vault.rewardLiability(), 0);
        assertEq(pm.ownerOf(id), bob);
    }

    function test_last_valid_paired_observation_precedes_finalization_and_score_then_closes() public {
        OmertaCommitmentVaultV2.CampaignTerms memory t = _terms();
        t.endsAt = uint64(block.timestamp + 2 days);
        uint64 id = vault.createCampaign{value: 1 ether}(t);
        uint256 nft = _mint(key, -1200, 1200, 100 ether);
        vm.prank(alice); IERC721(address(pm)).approve(address(vault), nft);
        vm.prank(alice); vault.commit(nft, id, 2 days);
        vm.warp(t.endsAt - 1); _observe(2, 0); vault.checkpoint(nft);
        uint64 observed = uint64(t.endsAt + t.maxObservationGap - 1);
        vm.warp(vault.settlementClosesAt(id) - 1);
        market.set(IOmertaMarketStateV2.Snapshot(3, observed, 0, 0, 100 ether, 1 ether, 0, 0, true));
        vault.checkpoint(nft);
        assertGt(vault.commitment(nft).usefulDepthSeconds, 0);
        vm.expectRevert(OmertaCommitmentVaultV2.InvalidCampaign.selector); vault.finalizeCampaign(id);
        vm.warp(vault.settlementClosesAt(id) + 1); vault.finalizeCampaign(id);
        vm.expectRevert(OmertaCommitmentVaultV2.InvalidCampaign.selector); vault.checkpoint(nft);
        vault.settleReward(nft);
        assertGt(vault.rewards(alice), 0);
    }
}
