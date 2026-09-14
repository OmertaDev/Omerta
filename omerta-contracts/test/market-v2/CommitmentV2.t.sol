// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

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
        t.maxDepthWei = 10 ether;
        t.maxRewardPerPosition = 2 ether;
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

    function test_two_epochs_credit_original_depositor_by_depth_time_and_claim_once() public {
        uint256 id = _commit(-1200, 1200, 100 ether);
        uint256 depth = vault.commitment(id).lastDepth;
        _next(id, 2, 1 hours);
        assertEq(vault.commitment(id).usefulDepthSeconds, depth * 1 hours);
        uint256 reward = depth * 1 hours / 1 days;
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
        assertGt(vault.rewards(alice), 0);
    }

    function test_oracle_gap_is_not_backfilled() public {
        uint256 id = _commit(-1200, 1200, 100 ether);
        _next(id, 2, 3 hours);
        assertEq(vault.rewards(alice), 0);
        _next(id, 3, 1 hours);
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
        assertEq(vault.rewards(alice), 1);
        assertEq(vault.campaign(tiny).available, 0);
        assertEq(vault.rewardLiability(), 1);
        assertEq(address(vault).balance, vault.availableBudget() + vault.rewardLiability());
    }

    function test_max_reward_is_per_position_across_repeated_samples() public {
        OmertaCommitmentVaultV2.CampaignTerms memory t = _terms(); t.maxRewardPerPosition = 7;
        uint64 capped = vault.createCampaign{value: 1 ether}(t);
        uint256 id = _mint(key, -1200, 1200, 100 ether);
        vm.prank(alice); IERC721(address(pm)).approve(address(vault), id);
        vm.prank(alice); vault.commit(id, capped, 2 days);
        _next(id, 2, 1 hours); _next(id, 3, 1 hours);
        assertEq(vault.rewards(alice), 7);
        assertEq(vault.commitment(id).rewardCredited, 7);
    }

    function test_unused_budget_recovery_excludes_earned_claims_and_NFT() public {
        uint256 id = _commit(-1200, 1200, 100 ether);
        _next(id, 2, 1 hours);
        uint256 owed = vault.rewards(alice);
        vm.expectRevert(OmertaCommitmentVaultV2.InvalidCampaign.selector); vault.recoverUnusedBudget(campaignId, payable(bob));
        vm.warp(block.timestamp + 11 days);
        vault.recoverUnusedBudget(campaignId, payable(bob));
        assertEq(bob.balance, 10 ether - owed);
        assertEq(address(vault).balance, owed);
        assertEq(pm.ownerOf(id), address(vault));
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
        _solvent();
    }
}
