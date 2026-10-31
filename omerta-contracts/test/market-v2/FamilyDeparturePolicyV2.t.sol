// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {FamilyDistributorV2Fixture} from "./FamilyDistributorV2.t.sol";
import {OmertaFamilyDistributorV2} from "../../src/market-v2/OmertaFamilyDistributorV2.sol";

contract DepartureForceNative {
    constructor(address payable target) payable { selfdestruct(target); }
}

contract DepartureCheckpointProbe {
    OmertaFamilyDistributorV2 immutable distributor;
    bool public reject;
    bool public collectBlocked;
    bool public payoutBlocked;
    constructor(OmertaFamilyDistributorV2 target) { distributor = target; }
    function setReject(bool value) external { reject = value; }
    function checkpointFees() external {
        require(!reject, "checkpoint rejected");
        (bool ok,) = address(distributor).call(abi.encodeCall(distributor.collect, ()));
        collectBlocked = !ok;
        (ok,) = address(distributor).call(abi.encodeCall(distributor.payout, (payable(address(0xA11CE)))));
        payoutBlocked = !ok;
    }
}

abstract contract FamilyDepartureFixture is FamilyDistributorV2Fixture {
    function one(address member) internal pure returns (address[] memory recipients, uint16[] memory weights) {
        recipients = new address[](1); weights = new uint16[](1);
        recipients[0] = member; weights[0] = 10000;
    }
    function suspend(address member, uint256 receipt) internal {
        uint64 rev = distributor.revision();
        vm.prank(operator); distributor.suspendMember(member, rev, bytes32(receipt));
    }
    function reserveConsent(address[] memory recipients, uint16[] memory weights, uint256 n, uint256 o,
        uint64 rev, uint64 deadline) internal view returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(LEADER_KEY,
            distributor.hashReserveAllocation(recipients, weights, n, o, rev, deadline));
        return abi.encodePacked(r, s, v);
    }
    function allocate(address[] memory recipients, uint16[] memory weights, uint256 n, uint256 o) internal {
        uint64 rev = distributor.revision(); uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = reserveConsent(recipients, weights, n, o, rev, deadline);
        vm.prank(operator); distributor.allocateReserve(recipients, weights, n, o, rev, deadline, signature);
    }
    function seedReserve() internal {
        start(); suspend(alice, 1);
        registry.fund{value: 101}(address(distributor), 101); distributor.collect();
        assertEq(distributor.nativeReserve(), 61); assertEq(distributor.omrReserve(), 61);
    }
    function assertBacked() internal view {
        (uint256 an, uint256 ao) = distributor.credits(alice);
        (uint256 bn, uint256 bo) = distributor.credits(bob);
        assertEq(an + bn + distributor.nativeReserve(), distributor.nativeLiability());
        assertEq(ao + bo + distributor.omrReserve(), distributor.omrLiability());
        assertGe(address(distributor).balance, distributor.nativeLiability());
        assertGe(token.balanceOf(address(distributor)), distributor.omrLiability());
    }
}

contract FamilyDeparturePolicyV2Test is FamilyDepartureFixture {
    uint256 private chainBefore;
    function setUp() public override { super.setUp(); chainBefore = block.chainid; }
    function testDepartureCheckpointsOldEarningsPreservesCreditAndNeverBoostsOtherWeight() public {
        start(); registry.fund{value: 101}(address(distributor), 101);
        suspend(bob, 1);
        assertEq(bridge.checkpoints(), 1); assertTrue(distributor.suspended(bob));
        (uint256 n, uint256 o) = distributor.credits(bob); assertEq(n, 40); assertEq(o, 40);
        registry.fund{value: 100}(address(distributor), 100); distributor.collect();
        (n, o) = distributor.credits(alice); assertEq(n, 121); assertEq(o, 121);
        (n, o) = distributor.credits(bob); assertEq(n, 40); assertEq(o, 40);
        assertEq(distributor.nativeReserve(), 40); assertEq(distributor.omrReserve(), 40);
        distributor.payout(payable(bob)); assertEq(bob.balance, 40); assertEq(token.balanceOf(bob), 40);
        assertBacked();
    }

    function testSuspendedFirstMemberReservesItsOriginalRoundingRemainder() public {
        start(); suspend(alice, 1);
        registry.fund{value: 1}(address(distributor), 1); distributor.collect();
        registry.fund{value: 101}(address(distributor), 101); distributor.collect();
        (uint256 n, uint256 o) = distributor.credits(alice); assertEq(n, 0); assertEq(o, 0);
        (n, o) = distributor.credits(bob); assertEq(n, 40); assertEq(o, 40);
        assertEq(distributor.nativeReserve(), 62); assertEq(distributor.omrReserve(), 62);
        (address[] memory members, uint16[] memory weights) = distributor.members();
        assertEq(members[0], alice); assertEq(weights[0], 6000); assertEq(weights[1], 4000);
        assertBacked();
    }

    function testAllMembersSuspendedReserveEverythingWithoutLosingPriorCredits() public {
        start(); registry.fund{value: 100}(address(distributor), 100); distributor.collect();
        suspend(alice, 1); suspend(bob, 2);
        registry.fund{value: 101}(address(distributor), 101); distributor.collect();
        assertEq(distributor.nativeReserve(), 101); assertEq(distributor.omrReserve(), 101);
        distributor.payout(payable(alice)); distributor.payout(payable(bob));
        assertEq(alice.balance, 60); assertEq(bob.balance, 40);
        assertEq(distributor.nativeLiability(), 101); assertEq(distributor.omrLiability(), 101);
        assertBacked();
    }

    function testLastSingleMemberMayLeaveAndFreshPolicyThenExplicitConsentReallocatesReserve() public {
        (address[] memory recipients, uint16[] memory weights) = one(alice);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = consent(recipients, weights, 0, deadline);
        vm.prank(operator); distributor.setShares(recipients, weights, 0, deadline, signature);
        registry.bind(2, address(distributor)); suspend(alice, 1);
        registry.fund{value: 13}(address(distributor), 17); distributor.collect();
        assertEq(distributor.nativeReserve(), 13); assertEq(distributor.omrReserve(), 17);
        (recipients, weights) = one(bob);
        signature = consent(recipients, weights, 2, deadline);
        vm.prank(operator); distributor.setShares(recipients, weights, 2, deadline, signature);
        assertEq(distributor.nativeReserve(), 13); assertEq(distributor.omrReserve(), 17);
        allocate(recipients, weights, 13, 17);
        assertEq(distributor.nativeReserve(), 0); assertEq(distributor.omrReserve(), 0);
        assertEq(distributor.nativeLiability(), 13); assertEq(distributor.omrLiability(), 17);
        distributor.payout(payable(bob)); assertEq(bob.balance, 13); assertEq(token.balanceOf(bob), 17);
        assertBacked();
    }

    function testNoRejoinOrLeaderChangeResumesWalletWithoutNewFuturePolicyConsent() public {
        seedReserve();
        uint64 rev = distributor.revision();
        vm.prank(operator); distributor.setLeader(vm.addr(LEADER_KEY), rev, bytes32(uint256(77)));
        assertTrue(distributor.suspended(alice));
        registry.fund{value: 100}(address(distributor), 100); distributor.collect();
        assertEq(distributor.nativeReserve(), 121); assertEq(distributor.omrReserve(), 121);
        configure(6000); assertFalse(distributor.suspended(alice));
        assertEq(distributor.nativeReserve(), 121); assertEq(distributor.omrReserve(), 121);
        registry.fund{value: 100}(address(distributor), 100); distributor.collect();
        (uint256 n, uint256 o) = distributor.credits(alice); assertEq(n, 60); assertEq(o, 60);
        assertEq(distributor.nativeReserve(), 121); assertBacked();
    }

    function testPartialExplicitReserveAllocationChangesCreditsButNeverLiabilityOrPhysicalBalance() public {
        seedReserve();
        (address[] memory recipients, uint16[] memory weights) = one(bob);
        uint256 checkpoints = bridge.checkpoints();
        allocate(recipients, weights, 7, 11);
        assertEq(bridge.checkpoints(), checkpoints); assertEq(distributor.revision(), 3);
        assertEq(distributor.nativeReserve(), 54); assertEq(distributor.omrReserve(), 50);
        (uint256 n, uint256 o) = distributor.credits(bob); assertEq(n, 47); assertEq(o, 51);
        assertEq(distributor.nativeLiability(), 101); assertEq(distributor.omrLiability(), 101);
        assertEq(address(distributor).balance, 101); assertEq(token.balanceOf(address(distributor)), 101);
        distributor.payout(payable(bob)); assertEq(distributor.nativeLiability(), 54);
        assertEq(distributor.omrLiability(), 50); assertBacked();
    }

    function testReserveAllocationUsesExplicitWeightsAndFirstRecipientDust() public {
        seedReserve(); configure(6000);
        (address[] memory recipients, uint16[] memory weights) = arrays(3000);
        allocate(recipients, weights, 7, 11);
        (uint256 n, uint256 o) = distributor.credits(alice); assertEq(n, 3); assertEq(o, 4);
        (n, o) = distributor.credits(bob); assertEq(n, 44); assertEq(o, 47);
        assertEq(distributor.nativeReserve(), 54); assertEq(distributor.omrReserve(), 50); assertBacked();
    }

    function testDonationAndUncollectedCreditsCannotBeLaunderedThroughReserveConsent() public {
        seedReserve(); new DepartureForceNative{value: 47}(payable(address(distributor)));
        registry.fund(address(registry), 99); registry.donate(address(distributor), 99);
        registry.fund{value: 200}(address(distributor), 300);
        (address[] memory recipients, uint16[] memory weights) = one(bob);
        uint64 rev = distributor.revision(); uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = reserveConsent(recipients, weights, 62, 62, rev, deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector);
        distributor.allocateReserve(recipients, weights, 62, 62, rev, deadline, signature);
        allocate(recipients, weights, 61, 61); distributor.payout(payable(bob));
        assertEq(address(distributor).balance, 47); assertEq(token.balanceOf(address(distributor)), 99);
        assertEq(distributor.nativeLiability(), 0); assertEq(distributor.omrLiability(), 0);
        (uint256 n, uint256 o) = registry.credits(address(distributor)); assertEq(n, 200); assertEq(o, 300);
    }

    function testReserveConsentCannotReuseSplitSignatureTamperAmountsOrReplay() public {
        seedReserve();
        (address[] memory recipients, uint16[] memory weights) = one(bob);
        uint64 rev = distributor.revision(); uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = consent(recipients, weights, rev, deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.allocateReserve(recipients, weights, 7, 11, rev, deadline, signature);
        signature = reserveConsent(recipients, weights, 7, 11, rev, deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.allocateReserve(recipients, weights, 8, 11, rev, deadline, signature);
        vm.prank(alice); vm.expectRevert(OmertaFamilyDistributorV2.Unauthorized.selector);
        distributor.allocateReserve(recipients, weights, 7, 11, rev, deadline, signature);
        vm.prank(operator); distributor.allocateReserve(recipients, weights, 7, 11, rev, deadline, signature);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.allocateReserve(recipients, weights, 7, 11, rev, deadline, signature);
        assertBacked();
    }

    function testReserveConsentWrongChainContractLeaderOrDeadlineCannotRelease() public {
        seedReserve();
        (address[] memory recipients, uint16[] memory weights) = one(bob);
        uint64 rev = distributor.revision(); uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.chainId(chainBefore + 1); bytes memory signature = reserveConsent(recipients, weights, 1, 1, rev, deadline);
        vm.chainId(chainBefore);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.allocateReserve(recipients, weights, 1, 1, rev, deadline, signature);
        OmertaFamilyDistributorV2 original = distributor;
        distributor = new OmertaFamilyDistributorV2(address(this), operator, vm.addr(LEADER_KEY), 2, original.registry());
        signature = reserveConsent(recipients, weights, 1, 1, rev, deadline); distributor = original;
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.allocateReserve(recipients, weights, 1, 1, rev, deadline, signature);
        signature = reserveConsent(recipients, weights, 1, 1, rev, deadline);
        vm.prank(operator); distributor.setLeader(bob, rev, bytes32(uint256(44)));
        signature = reserveConsent(recipients, weights, 1, 1, rev + 1, deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.allocateReserve(recipients, weights, 1, 1, rev + 1, deadline, signature);
        vm.prank(operator); distributor.setLeader(vm.addr(LEADER_KEY), rev + 1, bytes32(uint256(45)));
        rev = distributor.revision(); deadline = uint64(block.timestamp - 1);
        signature = reserveConsent(recipients, weights, 1, 1, rev, deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.allocateReserve(recipients, weights, 1, 1, rev, deadline, signature);
        deadline = uint64(block.timestamp + 1 hours + 1); signature = reserveConsent(recipients, weights, 1, 1, rev, deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.allocateReserve(recipients, weights, 1, 1, rev, deadline, signature);
        assertEq(distributor.nativeReserve(), 61); assertBacked();
    }

    function testSuspensionAuthorizationRevisionReceiptAndPermanentReplayProtection() public {
        start(); uint64 rev = distributor.revision();
        vm.prank(alice); vm.expectRevert(OmertaFamilyDistributorV2.Unauthorized.selector);
        distributor.suspendMember(alice, rev, bytes32(uint256(1)));
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.suspendMember(alice, rev + 1, bytes32(uint256(1)));
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.suspendMember(alice, rev, bytes32(0));
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector);
        distributor.suspendMember(address(0xDEAD), rev, bytes32(uint256(1)));
        suspend(alice, 1);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.suspendMember(bob, rev + 1, bytes32(uint256(1)));
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector);
        distributor.suspendMember(alice, rev + 1, bytes32(uint256(2)));
        configure(6000);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.suspendMember(alice, rev + 2, bytes32(uint256(1)));
        suspend(alice, 2); assertTrue(distributor.suspended(alice)); assertTrue(distributor.departureReceiptUsed(bytes32(uint256(2))));
    }

    function testCheckpointFailureRollsBackEntireSuspensionAndRetryCanCommit() public {
        start(); DepartureCheckpointProbe probe = new DepartureCheckpointProbe(distributor);
        game.bind(address(registry), address(probe)); probe.setReject(true);
        registry.fund{value: 101}(address(distributor), 101);
        vm.prank(operator); vm.expectRevert("checkpoint rejected");
        distributor.suspendMember(alice, 1, bytes32(uint256(1)));
        assertEq(distributor.revision(), 1); assertFalse(distributor.suspended(alice));
        assertFalse(distributor.departureReceiptUsed(bytes32(uint256(1)))); assertEq(bridge.checkpoints(), 0);
        assertEq(distributor.nativeLiability(), 0);
        probe.setReject(false); suspend(alice, 1);
        assertTrue(probe.collectBlocked()); assertTrue(probe.payoutBlocked());
        (uint256 n, uint256 o) = distributor.credits(alice); assertEq(n, 61); assertEq(o, 61);
        assertBacked();
    }

    function testReserveRejectsSuspendedUnlistedSelfZeroDuplicateOrInvalidWeightRecipients() public {
        seedReserve();
        (address[] memory recipients, uint16[] memory weights) = one(alice);
        expectBadAllocation(recipients, weights);
        recipients[0] = address(distributor); expectBadAllocation(recipients, weights);
        recipients[0] = address(0); expectBadAllocation(recipients, weights);
        address outsider = address(0x123456); vm.prank(outsider, outsider); token.registerWallet(outsider);
        recipients[0] = outsider; expectBadAllocation(recipients, weights);
        (recipients, weights) = arrays(5000); recipients[0] = bob; expectBadAllocation(recipients, weights);
        (recipients, weights) = one(bob); weights[0] = 9999; expectBadAllocation(recipients, weights);
        weights[0] = 10000;
        uint64 deadline = uint64(block.timestamp + 1 hours); uint64 rev = distributor.revision();
        bytes memory signature = reserveConsent(recipients, weights, 0, 0, rev, deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector);
        distributor.allocateReserve(recipients, weights, 0, 0, rev, deadline, signature);
        assertEq(distributor.nativeReserve(), 61); assertBacked();
    }

    function expectBadAllocation(address[] memory recipients, uint16[] memory weights) private {
        uint64 rev = distributor.revision(); uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = reserveConsent(recipients, weights, 1, 1, rev, deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector);
        distributor.allocateReserve(recipients, weights, 1, 1, rev, deadline, signature);
    }

    function testFreshFuturePolicyAlsoRejectsSelfRecipient() public {
        (address[] memory recipients, uint16[] memory weights) = one(address(distributor));
        uint64 deadline = uint64(block.timestamp + 1 hours); bytes memory signature = consent(recipients, weights, 0, deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector);
        distributor.setShares(recipients, weights, 0, deadline, signature);
    }

    function testReserveSupportsSeparateNativeOnlyAndOmrOnlyExplicitAmounts() public {
        seedReserve(); (address[] memory recipients, uint16[] memory weights) = one(bob);
        allocate(recipients, weights, 61, 0);
        assertEq(distributor.nativeReserve(), 0); assertEq(distributor.omrReserve(), 61);
        allocate(recipients, weights, 0, 61);
        assertEq(distributor.nativeReserve(), 0); assertEq(distributor.omrReserve(), 0);
        (uint256 n, uint256 o) = distributor.credits(bob); assertEq(n, 101); assertEq(o, 101);
        distributor.payout(payable(bob)); assertBacked();
    }

    function testFuzzDepartureSlicesKeepFixedDenominatorAndAllUnits(uint64 n, uint64 o, uint16 weight, uint8 flags) public {
        configure(uint16(bound(weight, 1, 9999))); registry.bind(2, address(distributor));
        if ((flags & 1) != 0) suspend(alice, 1);
        if ((flags & 2) != 0) suspend(bob, 2);
        uint256 nativeAmount = bound(n, 0, 1 ether); uint256 omrAmount = bound(o, 0, 100 ether);
        registry.fund{value: nativeAmount}(address(distributor), omrAmount); distributor.collect();
        (, uint16[] memory weights) = distributor.members();
        uint256 bn = nativeAmount * weights[1] / 10000; uint256 bo = omrAmount * weights[1] / 10000;
        uint256 reservedN = (distributor.suspended(alice) ? nativeAmount - bn : 0) + (distributor.suspended(bob) ? bn : 0);
        uint256 reservedO = (distributor.suspended(alice) ? omrAmount - bo : 0) + (distributor.suspended(bob) ? bo : 0);
        assertEq(distributor.nativeReserve(), reservedN); assertEq(distributor.omrReserve(), reservedO); assertBacked();
        distributor.payout(payable(alice)); distributor.payout(payable(bob));
        assertEq(address(distributor).balance, reservedN); assertEq(token.balanceOf(address(distributor)), reservedO);
    }
}

contract FamilyDepartureInvariantV2Test is FamilyDepartureFixture {
    uint256 private receipts;
    uint256 private donatedNative;
    uint256 private donatedOmr;
    function setUp() public override {
        super.setUp(); start();
        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = this.actFund.selector; selectors[1] = this.actCollect.selector;
        selectors[2] = this.actSuspend.selector; selectors[3] = this.actPolicy.selector;
        selectors[4] = this.actAllocate.selector; selectors[5] = this.actPayout.selector;
        selectors[6] = this.actDonate.selector;
        targetSelector(FuzzSelector({addr: address(this), selectors: selectors})); targetContract(address(this));
    }
    function actFund(uint64 n, uint64 o) external {
        uint256 amount = bound(n, 0, 1e14);
        if (address(this).balance < amount) vm.deal(address(this), 1 ether);
        registry.fund{value: amount}(address(distributor), bound(o, 0, 1e14));
    }
    function actCollect() external { distributor.collect(); }
    function actSuspend(bool first) external {
        address member = first ? alice : bob;
        if (distributor.suspended(member)) return;
        (uint256 n, uint256 o) = distributor.credits(member);
        suspend(member, ++receipts);
        (uint256 afterN, uint256 afterO) = distributor.credits(member);
        assertGe(afterN, n); assertGe(afterO, o);
    }
    function actPolicy(uint16 weight) external {
        uint256 n = distributor.nativeReserve(); uint256 o = distributor.omrReserve();
        configure(uint16(bound(weight, 1, 9999)));
        assertGe(distributor.nativeReserve(), n); assertGe(distributor.omrReserve(), o);
    }
    function actAllocate(uint64 nativeSeed, uint64 omrSeed, uint16 weight) external {
        bool a = !distributor.suspended(alice); bool b = !distributor.suspended(bob);
        if (!a && !b) return;
        uint256 n = bound(nativeSeed, 0, distributor.nativeReserve()); uint256 o = bound(omrSeed, 0, distributor.omrReserve());
        if (n == 0 && o == 0) return;
        address[] memory recipients; uint16[] memory weights;
        if (a && b) (recipients, weights) = arrays(uint16(bound(weight, 1, 9999)));
        else (recipients, weights) = one(a ? alice : bob);
        uint256 liabilityN = distributor.nativeLiability(); uint256 liabilityO = distributor.omrLiability();
        uint256 reserveN = distributor.nativeReserve(); uint256 reserveO = distributor.omrReserve();
        allocate(recipients, weights, n, o);
        assertEq(distributor.nativeLiability(), liabilityN); assertEq(distributor.omrLiability(), liabilityO);
        assertEq(distributor.nativeReserve(), reserveN - n); assertEq(distributor.omrReserve(), reserveO - o);
    }
    function actPayout(bool first) external { distributor.payout(payable(first ? alice : bob)); }
    function actDonate(uint32 n, uint32 o) external {
        uint256 nativeAmount = bound(n, 0, 100); uint256 omrAmount = bound(o, 0, 100);
        if (address(this).balance < nativeAmount) vm.deal(address(this), 1 ether);
        new DepartureForceNative{value: nativeAmount}(payable(address(distributor)));
        registry.fund(address(registry), omrAmount); registry.donate(address(distributor), omrAmount);
        donatedNative += nativeAmount; donatedOmr += omrAmount;
    }
    function invariant_CreditsPlusReserveAreExactlyLiabilitiesAndDonationsStayOutside() external view {
        assertBacked();
        assertEq(address(distributor).balance, distributor.nativeLiability() + donatedNative);
        assertEq(token.balanceOf(address(distributor)), distributor.omrLiability() + donatedOmr);
    }
}
