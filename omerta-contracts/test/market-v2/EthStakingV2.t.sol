// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {OmertaEthStakingV2} from "../../src/market-v2/OmertaEthStakingV2.sol";

contract EthStakingOmrMock is ERC20 {
    address public immutable genesisTreasury;
    bool public policySealed = true;
    uint16 public transferFeeBps;
    mapping(address => IOmertaRestrictedOMRV2.OperatorRole) public operatorRole;
    mapping(address => bytes32) public contractHolderRuntimeHash;
    mapping(address => bool) public recipientBlocked;
    constructor(address safe) ERC20("OMR fixture", "OMR") { genesisTreasury = safe; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function setSealed(bool value) external { policySealed = value; }
    function setFee(uint16 value) external { transferFeeBps = value; }
    function setRole(address account, IOmertaRestrictedOMRV2.OperatorRole value) external { operatorRole[account] = value; }
    function setHolder(address account, bytes32 value) external { contractHolderRuntimeHash[account] = value; }
    function setBlocked(address account, bool value) external { recipientBlocked[account] = value; }
    function isOperator(address account) external view returns (bool) {
        return account.code.length != 0 && operatorRole[account] != IOmertaRestrictedOMRV2.OperatorRole.None;
    }
    function isRecipient(address account) external view returns (bool) { return !recipientBlocked[account]; }
    function _update(address from, address to, uint256 amount) internal override {
        if (from == address(0) || to == address(0)) { super._update(from, to, amount); return; }
        uint256 fee = amount * transferFeeBps / 10_000;
        super._update(from, to, amount - fee);
        if (fee != 0) super._update(from, address(0), fee);
    }
}

contract EthStakingDistributorMock {
    address public immutable omr;
    address public immutable rewardVault;
    constructor(address omr_, address vault_) { omr = omr_; rewardVault = vault_; }
    function fund(uint256 amount) external { OmertaEthStakingV2(rewardVault).fundEth{value: amount}(); }
}

contract EthClaimReceiver {
    OmertaEthStakingV2 public immutable vault;
    bool public reject;
    bool public reenter;
    bool public callbackSucceeded;
    constructor(OmertaEthStakingV2 v) { vault = v; }
    function mode(bool reject_, bool reenter_) external { reject = reject_; reenter = reenter_; }
    receive() external payable {
        require(!reject, "recipient rejected ETH");
        if (reenter) {
            uint64[] memory ids = new uint64[](1);
            (callbackSucceeded,) = address(vault).call(abi.encodeCall(vault.claim, (ids, address(this))));
        }
    }
}

contract EthStakingV2Test is Test {
    address private constant SAFE = address(0x5AFE);
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    uint256 private constant DURATION = 30 days;
    EthStakingOmrMock private omr;
    OmertaEthStakingV2 private vault;
    EthStakingDistributorMock private distributor;
    uint64 private origin;

    function setUp() public {
        vm.warp(1_000_000);
        omr = new EthStakingOmrMock(SAFE);
        vault = new OmertaEthStakingV2(IOmertaRestrictedOMRV2(address(omr)), SAFE);
        distributor = new EthStakingDistributorMock(address(omr), address(vault));
        vm.prank(SAFE); vault.setDistributor(address(distributor), address(distributor).codehash);
        omr.setRole(address(vault), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        vm.prank(SAFE); vault.activate(); origin = vault.epochOrigin();
        omr.mint(ALICE, 1_000_000 ether); omr.mint(BOB, 1_000_000 ether);
        vm.prank(ALICE); omr.approve(address(vault), type(uint256).max);
        vm.prank(BOB); omr.approve(address(vault), type(uint256).max);
        vm.deal(address(distributor), 1_000_000 ether);
    }

    function testPreparedNativeBindingAndOneTimeActivation() public {
        assertEq(address(vault.omr()), address(omr)); assertEq(vault.governanceSafe(), SAFE);
        assertEq(vault.distributor(), address(distributor)); assertEq(vault.distributorRuntimeHash(), address(distributor).codehash);
        assertEq(vault.EPOCH_DURATION(), DURATION); assertEq(vault.LOCK_DURATION(), DURATION);
        assertTrue(vault.active()); assertFalse(vault.paused());
        assertLe(address(vault).code.length, 24_576);
        vm.prank(SAFE); vm.expectRevert(OmertaEthStakingV2.AlreadyActive.selector); vault.activate();
        vm.prank(SAFE); vm.expectRevert(OmertaEthStakingV2.DistributorAlreadySet.selector);
        vault.setDistributor(address(distributor), address(distributor).codehash);
    }

    function testConstructorAndBindingRejectWrongGovernanceCodeAssetsAndVault() public {
        vm.expectRevert(OmertaEthStakingV2.InvalidConfiguration.selector);
        new OmertaEthStakingV2(IOmertaRestrictedOMRV2(address(omr)), ALICE);
        OmertaEthStakingV2 next = new OmertaEthStakingV2(IOmertaRestrictedOMRV2(address(omr)), SAFE);
        vm.prank(ALICE); vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        next.setDistributor(address(distributor), address(distributor).codehash);
        vm.prank(SAFE); vm.expectRevert(OmertaEthStakingV2.InvalidDistributor.selector);
        next.setDistributor(address(distributor), bytes32(uint256(1)));
        vm.prank(SAFE); vm.expectRevert(OmertaEthStakingV2.InvalidDistributor.selector);
        next.setDistributor(address(distributor), address(distributor).codehash);
        EthStakingDistributorMock wrong = new EthStakingDistributorMock(BOB, address(next));
        vm.prank(SAFE); vm.expectRevert(OmertaEthStakingV2.InvalidDistributor.selector);
        next.setDistributor(address(wrong), address(wrong).codehash);
    }

    function testActivationRequiresSealedPolicyAndCustodyRole() public {
        OmertaEthStakingV2 next = new OmertaEthStakingV2(IOmertaRestrictedOMRV2(address(omr)), SAFE);
        EthStakingDistributorMock d = new EthStakingDistributorMock(address(omr), address(next));
        vm.prank(SAFE); next.setDistributor(address(d), address(d).codehash);
        vm.prank(SAFE); vm.expectRevert(OmertaEthStakingV2.InvalidConfiguration.selector); next.activate();
        omr.setRole(address(next), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody); omr.setSealed(false);
        vm.prank(SAFE); vm.expectRevert(OmertaEthStakingV2.InvalidConfiguration.selector); next.activate();
    }

    function testOnlyPinnedDistributorCanFundAndRuntimeChangesFailClosed() public {
        vm.deal(ALICE, 1 ether); vm.prank(ALICE);
        vm.expectRevert(OmertaEthStakingV2.InvalidDistributor.selector); vault.fundEth{value: 1 ether}();
        vm.expectRevert(OmertaEthStakingV2.InvalidAmount.selector); distributor.fund(0);
        vm.etch(address(distributor), hex"00"); vm.prank(address(distributor));
        vm.expectRevert(OmertaEthStakingV2.InvalidDistributor.selector); vault.fundEth{value: 1 ether}();
        assertEq(vault.totalEthFunded(), 0);
    }

    function testStakeSecondsAndPrincipalExitHaveNoProtocolTax() public {
        _stake(ALICE, 100 ether); vm.warp(origin + DURATION / 2); _stake(BOB, 100 ether);
        distributor.fund(3 ether); vm.prank(ALICE);
        vm.expectRevert(OmertaEthStakingV2.LockNotMature.selector); vault.withdraw(0, 100 ether, ALICE);
        vm.warp(origin + DURATION); vault.finalizeEpoch(0);
        assertEq(vault.stakeSeconds(ALICE, 0), 100 ether * DURATION);
        assertEq(vault.claimable(ALICE, 0), 2 ether); assertEq(vault.claimable(BOB, 0), 1 ether);
        _claim(ALICE, 0, ALICE); _claim(BOB, 0, BOB);
        vm.prank(ALICE); vault.withdraw(0, 100 ether, ALICE);
        vm.warp(origin + DURATION + DURATION / 2); vm.prank(BOB); vault.withdraw(0, 100 ether, BOB);
        assertEq(omr.balanceOf(ALICE), 1_000_000 ether); assertEq(omr.balanceOf(BOB), 1_000_000 ether);
        assertEq(ALICE.balance, 2 ether); assertEq(BOB.balance, 1 ether); assertEq(address(vault).balance, 0);
        assertEq(vault.totalEthClaimed(), vault.totalEthFunded());
    }

    function testSameTimestampEarlyExitRejectsAndElapsedWeightStartsAtZero() public {
        _stake(ALICE, 100 ether); vm.prank(ALICE);
        vm.expectRevert(OmertaEthStakingV2.LockNotMature.selector); vault.withdraw(0, 100 ether, ALICE);
        assertEq(vault.stakeSeconds(ALICE, 0), 0); assertEq(vault.lockedBalance(ALICE), 100 ether);
        distributor.fund(1 ether); vm.warp(origin + DURATION); vault.finalizeEpoch(0);
        assertEq(vault.stakeSeconds(ALICE, 0), 100 ether * DURATION); assertEq(vault.claimable(ALICE, 0), 1 ether);
        assertEq(vault.lockedBalance(ALICE), 0); assertEq(vault.stakedBalance(ALICE), 100 ether);
    }

    function testExactEpochBoundaryCannotRewriteClosedWeightOrBudget() public {
        _stake(ALICE, 100 ether); distributor.fund(1 ether);
        vm.warp(origin + DURATION); _stake(BOB, 500 ether); distributor.fund(2 ether); vault.finalizeEpoch(0);
        assertEq(vault.epoch(0).budget, 1 ether); assertEq(vault.claimable(ALICE, 0), 1 ether);
        assertEq(vault.claimable(BOB, 0), 0); assertEq(vault.epoch(1).budget, 2 ether);
        vm.expectRevert(OmertaEthStakingV2.EpochAlreadyFinalized.selector); vault.finalizeEpoch(0);
    }

    function testEmptyEpochFundsGoToNextFullFutureEpoch() public {
        distributor.fund(1 ether); vm.warp(origin + DURATION * 3 + 1);
        _stake(ALICE, 100 ether); vault.finalizeEpoch(0);
        assertEq(vault.epoch(3).budget, 0); assertEq(vault.epoch(4).budget, 1 ether);
        assertEq(vault.epoch(0).budget, 0); assertEq(vault.totalEthFunded(), 1 ether);
    }

    function testPauseAndExcludedStatusNeverBlockEarnedClaimsOrPrincipalExit() public {
        _stake(ALICE, 100 ether); distributor.fund(1 ether);
        vm.warp(origin + DURATION); vault.finalizeEpoch(0);
        vm.prank(SAFE); vault.setPaused(true);
        vm.prank(BOB); vm.expectRevert(OmertaEthStakingV2.StakingPaused.selector); vault.stake(1 ether);
        omr.setBlocked(ALICE, true); omr.setHolder(ALICE, bytes32(uint256(1)));
        vm.prank(ALICE); vault.withdraw(0, 100 ether, ALICE); _claim(ALICE, 0, ALICE);
        distributor.fund(1 ether);
        assertEq(omr.balanceOf(ALICE), 1_000_000 ether); assertEq(ALICE.balance, 1 ether);
        assertEq(vault.totalStaked(), 0); assertEq(vault.totalEthFunded(), 2 ether);
    }

    function testPrincipalCannotForwardToAnotherWalletOrProtocolManager() public {
        _stake(ALICE, 100 ether);
        for (uint256 i; i < 3; ++i) {
            address recipient = i == 0 ? BOB : i == 1 ? SAFE : address(distributor);
            vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.InvalidRecipient.selector); vault.withdraw(0, 100 ether, recipient);
        }
        assertEq(vault.stakedBalance(ALICE), 100 ether);
    }

    function testSafeOperatorsPinnedHoldersAndBlockedAccountsCannotStake() public {
        for (uint256 i; i < 4; ++i) {
            address account = address(uint160(0x100 + i)); omr.mint(account, 1 ether);
            vm.prank(account); omr.approve(address(vault), 1 ether);
            if (i == 0) omr.setRole(account, IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
            else if (i == 1) omr.setHolder(account, bytes32(uint256(1)));
            else if (i == 2) omr.setBlocked(account, true);
            else account = SAFE;
            vm.prank(account); vm.expectRevert(OmertaEthStakingV2.ExcludedStaker.selector); vault.stake(1 ether);
        }
    }

    function testRejectingEthReceiverRollsBackClaimAndCanRetryWithoutBlockingOthers() public {
        _stake(ALICE, 100 ether); _stake(BOB, 100 ether); distributor.fund(2 ether);
        vm.warp(origin + DURATION); vault.finalizeEpoch(0);
        EthClaimReceiver receiver = new EthClaimReceiver(vault); receiver.mode(true, false);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.EthTransferFailed.selector); vault.claim(_one(0), address(receiver));
        assertFalse(vault.claimed(0, ALICE)); assertEq(vault.totalEthClaimed(), 0);
        _claim(BOB, 0, BOB); vm.prank(ALICE); vault.withdraw(0, 100 ether, ALICE);
        receiver.mode(false, false); _claim(ALICE, 0, address(receiver));
        assertEq(address(receiver).balance, 1 ether); assertEq(vault.totalEthClaimed(), 2 ether);
    }

    function testNativeRecipientCallbackCannotReenterClaims() public {
        _stake(ALICE, 100 ether); distributor.fund(1 ether); vm.warp(origin + DURATION); vault.finalizeEpoch(0);
        EthClaimReceiver receiver = new EthClaimReceiver(vault); receiver.mode(false, true);
        _claim(ALICE, 0, address(receiver)); assertFalse(receiver.callbackSucceeded());
        assertEq(vault.totalEthClaimed(), 1 ether); assertEq(address(receiver).balance, 1 ether);
    }

    function testInvalidClaimBatchesAndDuplicateClaimsRemainAtomic() public {
        _stake(ALICE, 100 ether); distributor.fund(1 ether); vm.warp(origin + DURATION); vault.finalizeEpoch(0);
        uint64[] memory bad = new uint64[](2); bad[1] = 0;
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.InvalidClaimBatch.selector); vault.claim(bad, ALICE);
        assertFalse(vault.claimed(0, ALICE));
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.InvalidClaimBatch.selector); vault.claim(new uint64[](25), ALICE);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.InvalidRecipient.selector); vault.claim(_one(0), address(vault));
        _claim(ALICE, 0, ALICE);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.AlreadyClaimed.selector); vault.claim(_one(0), ALICE);
    }

    function testForcedEthAndOmrDonationsNeverCreateRewardOrPrincipalCredits() public {
        vm.deal(address(vault), 10 ether); omr.mint(address(vault), 20 ether);
        assertEq(vault.totalEthFunded(), 0); assertEq(vault.totalStaked(), 0); assertEq(vault.epoch(0).budget, 0);
        _stake(ALICE, 100 ether); distributor.fund(1 ether); vm.warp(origin + DURATION); vault.finalizeEpoch(0);
        _claim(ALICE, 0, ALICE); assertEq(ALICE.balance, 1 ether); assertEq(address(vault).balance, 10 ether);
        vm.deal(ALICE, 1 ether); vm.prank(ALICE); (bool accepted,) = address(vault).call{value: 1 wei}("");
        assertFalse(accepted);
    }

    function testInexactOmrDepositRollsBackUnbackedStake() public {
        omr.setFee(100); vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.InexactTransfer.selector); vault.stake(100 ether);
        assertEq(vault.totalStaked(), 0); assertEq(vault.stakedBalance(ALICE), 0); assertEq(omr.balanceOf(address(vault)), 0);
    }

    function testLifetimeClaimsSurviveLongInactivityAndLaterCheckpoints() public {
        _stake(ALICE, 100 ether); distributor.fund(1 ether); vm.warp(origin + DURATION * 40);
        for (uint256 i; i < 30; ++i) { vm.warp(block.timestamp + 1); _stake(BOB, 1 ether); }
        vault.finalizeEpoch(0); _claim(ALICE, 0, ALICE); assertEq(ALICE.balance, 1 ether);
    }

    function testExactThirtyDayMaturityPermitsExitButKeepsAccruingWithoutAnyTransaction() public {
        _stake(ALICE, 100 ether);
        OmertaEthStakingV2.LockPosition memory position = vault.lockPosition(ALICE, 0);
        assertEq(position.lockedAt, origin); assertEq(position.unlocksAt, origin + DURATION);
        vm.warp(position.unlocksAt - 1);
        assertEq(vault.lockedBalance(ALICE), 100 ether); assertEq(vault.totalLocked(), 100 ether);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.LockNotMature.selector); vault.withdraw(0, 1, ALICE);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.LockNotMature.selector); vault.relock(0, 1);
        vm.warp(position.unlocksAt);
        assertEq(vault.lockedBalance(ALICE), 0); assertEq(vault.totalLocked(), 0);
        assertEq(vault.totalStaked(), 100 ether); assertEq(vault.stakedBalance(ALICE), 100 ether);
        vm.warp(position.unlocksAt + DURATION * 9);
        assertEq(vault.stakeSeconds(ALICE, 0), 100 ether * DURATION);
        for (uint64 id = 1; id < 10; ++id) assertEq(vault.stakeSeconds(ALICE, id), 100 ether * DURATION);
        vm.prank(ALICE); vault.withdraw(0, 100 ether, ALICE);
        assertEq(omr.balanceOf(ALICE), 1_000_000 ether);
    }

    function testTopUpNeverExtendsOlderPositionAndSameTimestampFlowsAccumulate() public {
        _stake(ALICE, 100 ether); vm.warp(origin + 10 days);
        _stake(ALICE, 30 ether); _stake(ALICE, 20 ether);
        assertEq(vault.lockCount(ALICE), 3); assertEq(vault.lockPosition(ALICE, 0).unlocksAt, origin + DURATION);
        assertEq(vault.lockPosition(ALICE, 1).unlocksAt, origin + 40 days);
        assertEq(vault.lockPosition(ALICE, 2).unlocksAt, origin + 40 days);
        vm.warp(origin + DURATION);
        assertEq(vault.lockedBalance(ALICE), 50 ether); assertEq(vault.totalLocked(), 50 ether);
        vm.prank(ALICE); vault.withdraw(0, 100 ether, ALICE);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.LockNotMature.selector); vault.withdraw(1, 1 ether, ALICE);
        vm.warp(origin + 40 days); assertEq(vault.lockedBalance(ALICE), 0);
        assertEq(vault.stakeSeconds(ALICE, 0), 100 ether * 30 days + 50 ether * 20 days);
        assertEq(vault.stakeSeconds(ALICE, 1), 50 ether * 10 days);
    }

    function testPartialMatureWithdrawalAndRelockPreserveHeldPrincipalAndPastWeight() public {
        _stake(ALICE, 100 ether); distributor.fund(1 ether);
        vm.warp(origin + 35 days); vault.finalizeEpoch(0);
        vm.prank(ALICE); vault.withdraw(0, 30 ether, ALICE);
        vm.prank(ALICE); uint256 next = vault.relock(0, 40 ether);
        assertEq(next, 1); assertEq(vault.lockPosition(ALICE, 0).amount, 30 ether);
        assertEq(vault.lockPosition(ALICE, 1).amount, 40 ether);
        assertEq(vault.lockPosition(ALICE, 1).unlocksAt, origin + 65 days);
        assertEq(vault.stakedBalance(ALICE), 70 ether); assertEq(vault.totalStaked(), 70 ether);
        assertEq(vault.lockedBalance(ALICE), 40 ether); assertEq(vault.totalLocked(), 40 ether);
        assertEq(vault.stakeSeconds(ALICE, 0), 100 ether * 30 days); assertEq(vault.claimable(ALICE, 0), 1 ether);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.InvalidAmount.selector); vault.relock(0, 31 ether);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.LockNotMature.selector); vault.withdraw(1, 40 ether, ALICE);
        _claim(ALICE, 0, ALICE); vm.warp(origin + 65 days);
        assertEq(vault.stakeSeconds(ALICE, 1), 100 ether * 5 days + 70 ether * 25 days);
        assertEq(vault.stakeSeconds(ALICE, 2), 70 ether * 5 days);
        vm.prank(ALICE); vault.withdraw(0, 30 ether, ALICE); vm.prank(ALICE); vault.withdraw(1, 40 ether, ALICE);
        assertEq(vault.totalStaked(), 0); assertEq(omr.balanceOf(ALICE), 1_000_000 ether);
    }

    function testRelockCannotRenewThroughPauseOrChangedAdmissionButMatureExitRemainsOpen() public {
        _stake(ALICE, 100 ether); vm.warp(origin + DURATION);
        vm.prank(SAFE); vault.setPaused(true);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.StakingPaused.selector); vault.relock(0, 100 ether);
        vm.prank(ALICE); vault.withdraw(0, 20 ether, ALICE);
        vm.prank(SAFE); vault.setPaused(false); omr.setBlocked(ALICE, true);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.ExcludedStaker.selector); vault.relock(0, 80 ether);
        vm.prank(ALICE); vault.withdraw(0, 80 ether, ALICE);
        assertEq(vault.totalStaked(), 0); assertEq(vault.totalLocked(), 0);
    }

    function testMatureUnwithdrawnPrincipalReceivesLaterRewardsWithoutRenewalEvenWhilePaused() public {
        _stake(ALICE, 100 ether); distributor.fund(1 ether);
        vm.warp(origin + DURATION); distributor.fund(2 ether);
        vm.prank(SAFE); vault.setPaused(true);
        assertEq(vault.lockCount(ALICE), 1); assertEq(vault.lockedBalance(ALICE), 0);
        assertEq(vault.stakedBalance(ALICE), 100 ether);
        vm.warp(origin + DURATION * 2); vault.finalizeEpoch(0); vault.finalizeEpoch(1);
        assertEq(vault.stakeSeconds(ALICE, 1), 100 ether * DURATION);
        assertEq(vault.claimable(ALICE, 1), 2 ether);
        uint64[] memory ids = new uint64[](2); ids[1] = 1;
        vm.prank(ALICE); vault.claim(ids, ALICE);
        assertEq(ALICE.balance, 3 ether); assertEq(vault.totalEthClaimed(), 3 ether);
        assertEq(vault.lockCount(ALICE), 1); assertEq(vault.totalStaked(), 100 ether);
        vm.prank(ALICE); vault.withdraw(0, 100 ether, ALICE);
        assertEq(omr.balanceOf(ALICE), 1_000_000 ether); assertEq(vault.totalStaked(), 0);
    }

    function testPartialMatureExitRemovesOnlyWithdrawnRewardWeight() public {
        _stake(ALICE, 100 ether); vm.warp(origin + 40 days);
        vm.prank(ALICE); vault.withdraw(0, 40 ether, ALICE);
        assertEq(vault.stakedBalance(ALICE), 60 ether); assertEq(vault.totalLocked(), 0);
        vm.warp(origin + 60 days);
        assertEq(vault.stakeSeconds(ALICE, 1), 100 ether * 10 days + 60 ether * 20 days);
        vm.prank(ALICE); vault.withdraw(0, 60 ether, ALICE); vm.warp(origin + 90 days);
        assertEq(vault.stakeSeconds(ALICE, 2), 0);
        assertEq(vault.stakeSeconds(ALICE, 0), 100 ether * 30 days);
        assertEq(omr.balanceOf(ALICE), 1_000_000 ether);
    }

    function testOptionalRelockAndSameTimestampTopUpNeverDoubleRewardWeight() public {
        _stake(ALICE, 100 ether); vm.warp(origin + DURATION);
        vm.prank(ALICE); vault.relock(0, 60 ether); _stake(ALICE, 20 ether);
        assertEq(vault.stakedBalance(ALICE), 120 ether); assertEq(vault.totalStaked(), 120 ether);
        assertEq(vault.lockedBalance(ALICE), 80 ether); assertEq(vault.totalLocked(), 80 ether);
        assertEq(vault.lockCount(ALICE), 3); assertEq(vault.lockPosition(ALICE, 0).amount, 40 ether);
        assertEq(vault.lockPosition(ALICE, 0).unlocksAt, origin + DURATION);
        vm.warp(origin + DURATION * 2);
        assertEq(vault.stakeSeconds(ALICE, 0), 100 ether * DURATION);
        assertEq(vault.stakeSeconds(ALICE, 1), 120 ether * DURATION);
        assertEq(vault.totalStakeSeconds(1), 120 ether * DURATION);
        assertEq(vault.lockedBalance(ALICE), 0); assertEq(vault.stakedBalance(ALICE), 120 ether);
    }

    function testPositionsBelongOnlyToTheirAccountAndDepletedLocksCannotBeReused() public {
        _stake(ALICE, 100 ether); vm.warp(origin + DURATION);
        vm.prank(BOB); vm.expectRevert(OmertaEthStakingV2.InvalidLock.selector); vault.withdraw(0, 100 ether, BOB);
        vm.prank(BOB); vm.expectRevert(OmertaEthStakingV2.InvalidLock.selector); vault.relock(0, 100 ether);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.InvalidLock.selector); vault.withdraw(1, 1, ALICE);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.InvalidAmount.selector); vault.relock(0, 0);
        vm.prank(ALICE); vault.withdraw(0, 100 ether, ALICE);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.InvalidAmount.selector); vault.withdraw(0, 1, ALICE);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.InvalidAmount.selector); vault.relock(0, 1);
    }

    function testInvalidUnlockTimestampAndBackwardStartRollbackEveryMutation() public {
        _stake(ALICE, 100 ether); vm.warp(origin - 1);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.InvalidEpoch.selector); vault.stake(1 ether);
        assertEq(vault.lockCount(ALICE), 1); assertEq(vault.stakedBalance(ALICE), 100 ether);
        vm.warp(uint256(type(uint64).max) - DURATION + 1);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.InvalidEpoch.selector); vault.stake(1 ether);
        vm.prank(ALICE); vm.expectRevert(OmertaEthStakingV2.InvalidEpoch.selector); vault.relock(0, 100 ether);
        assertEq(vault.lockCount(ALICE), 1); assertEq(vault.lockPosition(ALICE, 0).amount, 100 ether);
        vm.prank(ALICE); vault.withdraw(0, 100 ether, ALICE);
        assertEq(omr.balanceOf(ALICE), 1_000_000 ether);
    }

    function testFuzzHeldRewardWeightAndWithdrawalLocksHaveIndependentIntervals(uint96 rawA, uint96 rawB, uint32 rawDelay, uint32 rawElapsed) public {
        uint256 amountA = bound(rawA, 1 ether, 1000 ether);
        uint256 amountB = bound(rawB, 1 ether, 1000 ether);
        uint256 delay = bound(rawDelay, 0, DURATION * 2);
        uint256 elapsed = bound(rawElapsed, 0, DURATION * 3);
        _stake(ALICE, amountA); vm.warp(origin + delay);
        _stake(BOB, amountB); _stake(ALICE, amountB / 2);
        vm.warp(origin + delay + elapsed);
        uint256 now_ = vm.getBlockTimestamp();
        uint256 sumA; uint256 sumB;
        for (uint64 id; id <= 6; ++id) {
            uint256 a = _overlap(amountA, origin, id, now_) + _overlap(amountB / 2, origin + delay, id, now_);
            uint256 b = _overlap(amountB, origin + delay, id, now_);
            assertEq(vault.stakeSeconds(ALICE, id), a); assertEq(vault.stakeSeconds(BOB, id), b);
            assertEq(vault.totalStakeSeconds(id), a + b); sumA += a; sumB += b;
        }
        assertEq(sumA, amountA * (now_ - origin) + amountB / 2 * elapsed);
        assertEq(sumB, amountB * elapsed);
        uint256 activeA = now_ < origin + DURATION ? amountA : 0;
        uint256 activeB = elapsed < DURATION ? amountB : 0;
        if (elapsed < DURATION) activeA += amountB / 2;
        assertEq(vault.lockedBalance(ALICE), activeA); assertEq(vault.lockedBalance(BOB), activeB);
        assertEq(vault.totalLocked(), activeA + activeB);
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) { return a < b ? a : b; }
    function _overlap(uint256 amount, uint256 start, uint64 id, uint256 now_) private view returns (uint256) {
        uint256 left = uint256(origin) + uint256(id) * DURATION;
        uint256 right = _min(left + DURATION, now_);
        if (start > left) left = start;
        return right > left ? amount * (right - left) : 0;
    }

    function testFuzzNativeRewardsAndPrincipalConserve(uint96 rawA, uint96 rawB, uint32 rawDelay, uint64 rawReward) public {
        uint256 amountA = bound(rawA, 1, 1_000_000 ether);
        uint256 amountB = bound(rawB, 1, 1_000_000 ether);
        uint256 delay = bound(rawDelay, 0, DURATION - 1);
        uint256 reward = bound(rawReward, 1, 1000 ether);
        _stake(ALICE, amountA); vm.warp(origin + delay); _stake(BOB, amountB); distributor.fund(reward);
        vm.warp(origin + DURATION); vault.finalizeEpoch(0);
        uint256 a = vault.claimable(ALICE, 0);
        uint256 b = vault.claimable(BOB, 0);
        assertLe(a + b, reward); assertLe(reward - a - b, 1);
        _claim(ALICE, 0, ALICE); _claim(BOB, 0, BOB);
        vm.warp(origin + DURATION + delay);
        vm.prank(ALICE); vault.withdraw(0, amountA, ALICE); vm.prank(BOB); vault.withdraw(0, amountB, BOB);
        assertEq(vault.totalStaked(), 0); assertEq(omr.balanceOf(ALICE), 1_000_000 ether);
        assertEq(omr.balanceOf(BOB), 1_000_000 ether); assertEq(vault.totalEthFunded(), vault.totalEthClaimed() + address(vault).balance);
    }

    function _stake(address account, uint256 amount) private { vm.prank(account); vault.stake(amount); }
    function _claim(address account, uint64 id, address recipient) private { vm.prank(account); vault.claim(_one(id), recipient); }
    function _one(uint64 id) private pure returns (uint64[] memory ids) { ids = new uint64[](1); ids[0] = id; }
}

contract EthStakingV2Handler is Test {
    struct ReferenceFlow { address account; uint256 amount; uint256 start; bool withdrawal; }
    EthStakingOmrMock public immutable omr;
    OmertaEthStakingV2 public immutable vault;
    EthStakingDistributorMock public immutable distributor;
    address[3] public actors = [address(0xA11CE), address(0xB0B), address(0xCA11)];
    ReferenceFlow[] private _flows;
    constructor(EthStakingOmrMock token, OmertaEthStakingV2 v, EthStakingDistributorMock d) { omr = token; vault = v; distributor = d; }
    function stake(uint8 who, uint96 raw) external {
        address actor = actors[who % 3]; uint256 amount = bound(raw, 1, 1e24);
        omr.mint(actor, amount); vm.startPrank(actor); omr.approve(address(vault), amount);
        vault.stake(amount); vm.stopPrank(); _flows.push(ReferenceFlow(actor, amount, block.timestamp, false));
    }
    function exit(uint8 who, uint96 raw) external {
        address actor = actors[who % 3]; uint256 count = vault.lockCount(actor); if (count == 0) return;
        uint256 id = uint256(raw) % count; OmertaEthStakingV2.LockPosition memory position = vault.lockPosition(actor, id);
        if (position.amount == 0 || block.timestamp < position.unlocksAt) return;
        uint256 amount = bound(raw, 1, position.amount);
        vm.prank(actor); vault.withdraw(id, amount, actor); _flows.push(ReferenceFlow(actor, amount, block.timestamp, true));
    }
    function relock(uint8 who, uint96 raw) external {
        address actor = actors[who % 3]; uint256 count = vault.lockCount(actor); if (count == 0) return;
        uint256 id = uint256(raw) % count; OmertaEthStakingV2.LockPosition memory position = vault.lockPosition(actor, id);
        if (position.amount == 0 || block.timestamp < position.unlocksAt) return;
        uint256 amount = bound(raw, 1, position.amount);
        vm.prank(actor); vault.relock(id, amount);
    }
    function fund(uint96 raw) external { uint256 amount = bound(raw, 1, 1 ether); vm.deal(address(distributor), amount); distributor.fund(amount); }
    function advance(uint32 raw) external { vm.warp(block.timestamp + bound(raw, 0, 45 days)); }
    function settle(uint8 who, uint64 raw) external {
        uint64 current = vault.currentEpoch(); if (current == 0) return;
        uint64 id = uint64(uint256(raw) % current);
        if (!vault.epoch(id).finalized) vault.finalizeEpoch(id);
        address actor = actors[who % 3]; if (vault.claimed(id, actor)) return;
        uint64[] memory ids = new uint64[](1); ids[0] = id;
        vm.prank(actor); vault.claim(ids, actor);
    }
    function referenceWeight(address account, uint64 id) external view returns (uint256 weight) {
        uint256 epochStart = uint256(vault.epochOrigin()) + uint256(id) * 30 days;
        uint256 epochEnd = epochStart + 30 days;
        for (uint256 i; i < _flows.length; ++i) {
            ReferenceFlow storage flow = _flows[i]; if (account != address(0) && flow.account != account) continue;
            uint256 left = flow.start > epochStart ? flow.start : epochStart;
            uint256 right = epochEnd;
            if (right > block.timestamp) right = block.timestamp;
            if (right > left) {
                uint256 contribution = flow.amount * (right - left);
                if (flow.withdrawal) weight -= contribution;
                else weight += contribution;
            }
        }
    }
}

contract EthStakingV2InvariantTest is StdInvariant, Test {
    EthStakingOmrMock private omr;
    OmertaEthStakingV2 private vault;
    EthStakingDistributorMock private distributor;
    EthStakingV2Handler private handler;
    function setUp() public {
        vm.warp(1_000_000); omr = new EthStakingOmrMock(address(this));
        vault = new OmertaEthStakingV2(IOmertaRestrictedOMRV2(address(omr)), address(this));
        distributor = new EthStakingDistributorMock(address(omr), address(vault));
        vault.setDistributor(address(distributor), address(distributor).codehash);
        omr.setRole(address(vault), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody); vault.activate();
        handler = new EthStakingV2Handler(omr, vault, distributor); targetContract(address(handler));
    }
    function invariantPrincipalAndNativeLiabilitiesStayBacked() public view {
        assertEq(omr.balanceOf(address(vault)), vault.totalStaked());
        assertEq(vault.totalEthFunded(), vault.totalEthClaimed() + address(vault).balance);
        uint256 sum;
        uint256 locked;
        for (uint256 i; i < 3; ++i) {
            address actor = handler.actors(i); uint256 held = vault.stakedBalance(actor);
            assertLe(vault.lockedBalance(actor), held); sum += held; locked += vault.lockedBalance(actor);
            uint256 positions;
            for (uint256 id; id < vault.lockCount(actor); ++id) positions += vault.lockPosition(actor, id).amount;
            assertEq(positions, held);
        }
        assertEq(sum, vault.totalStaked());
        assertEq(locked, vault.totalLocked()); assertLe(vault.totalLocked(), vault.totalStaked());
    }
    function invariantElapsedWeightsMatchIndependentIntervals() public view {
        uint64 current = vault.currentEpoch();
        for (uint256 sample; sample < 3; ++sample) {
            uint64 id = sample == 0 ? 0 : sample == 1 ? current : current == 0 ? 0 : current - 1;
            assertEq(vault.totalStakeSeconds(id), handler.referenceWeight(address(0), id));
            for (uint256 i; i < 3; ++i) {
                address actor = handler.actors(i);
                assertEq(vault.stakeSeconds(actor, id), handler.referenceWeight(actor, id));
            }
        }
    }
}
