// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {FamilyDepartureFixture, DepartureForceNative, DepartureCheckpointProbe} from "./FamilyDeparturePolicyV2.t.sol";
import {FamilyGameFixture, FamilyRegistryFixture, FamilyBridgeFixture, FamilyManagerFixture, FamilyRejectingMember} from "./FamilyDistributorV2.t.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {OmertaFamilyDistributorV2, IFamilyRegistryV2} from "../../src/market-v2/OmertaFamilyDistributorV2.sol";

contract DissolutionCheckpointCredit {
    FamilyRegistryFixture immutable registry;
    address immutable distributor;
    bool public enabled;
    constructor(FamilyRegistryFixture registry_, address distributor_) { registry = registry_; distributor = distributor_; }
    function arm() external payable { enabled = true; }
    function checkpointFees() external {
        if (enabled) { enabled = false; registry.fund{value: address(this).balance}(distributor, 0); }
    }
}

abstract contract FamilyDissolutionFixture is FamilyDepartureFixture {
    bool internal rejectSafe;
    bool internal probeSafe;
    bool internal reentryBlocked;
    receive() external payable {
        require(!rejectSafe, "Safe rejects native");
        if (probeSafe) {
            (bool ok,) = address(distributor).call(abi.encodeCall(distributor.collect, ()));
            reentryBlocked = !ok;
        }
    }
    function deployFixture(string memory artifact, bytes memory args) internal returns (address deployed) {
        bytes memory creation = abi.encodePacked(vm.getCode(artifact), args);
        assembly ("memory-safe") { deployed := create(0, add(creation, 32), mload(creation)) }
        require(deployed != address(0), "fixture deployment failed");
    }
    function setUp() public virtual override {
        vm.warp(10 days); vm.deal(address(this), 100 ether);
        // Keep fixture bytecode out of new test runtimes; deploy actual canonical artifacts.
        token = OmertaRestrictedOMRV2(deployFixture("OmertaRestrictedOMRV2.sol:OmertaRestrictedOMRV2", abi.encode(address(this))));
        game = FamilyGameFixture(deployFixture("FamilyDistributorV2.t.sol:FamilyGameFixture", abi.encode(operator)));
        registry = FamilyRegistryFixture(deployFixture("FamilyDistributorV2.t.sol:FamilyRegistryFixture", abi.encode(token, address(game))));
        bridge = FamilyBridgeFixture(deployFixture("FamilyDistributorV2.t.sol:FamilyBridgeFixture", ""));
        game.bind(address(registry), address(bridge));
        distributor = OmertaFamilyDistributorV2(payable(deployFixture("OmertaFamilyDistributorV2.sol:OmertaFamilyDistributorV2",
            abi.encode(address(this), operator, vm.addr(LEADER_KEY), uint64(2), IFamilyRegistryV2(address(registry))))));
        FamilyManagerFixture manager = FamilyManagerFixture(deployFixture("FamilyDistributorV2.t.sol:FamilyManagerFixture", abi.encode(address(token))));
        token.bindSettlementManager(address(manager), address(manager).codehash);
        token.setOperator(address(registry), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(registry).codehash);
        token.setOperator(address(distributor), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(distributor).codehash);
        vm.prank(alice, alice); token.registerWallet(alice);
        vm.prank(bob, bob); token.registerWallet(bob);
        badMember = FamilyRejectingMember(payable(deployFixture("FamilyDistributorV2.t.sol:FamilyRejectingMember", "")));
        token.setContractHolder(address(badMember), address(badMember).codehash);
        token.sealPolicy(); token.approve(address(registry), type(uint256).max);
    }
    function finish(uint256 receipt) internal {
        uint64 rev = distributor.revision();
        vm.prank(operator); distributor.dissolve(rev, bytes32(receipt));
    }
    function suspendAll() internal { suspend(alice, 1); suspend(bob, 2); }
    function assertDissolutionBacked() internal view {
        (uint256 an, uint256 ao) = distributor.credits(alice);
        (uint256 bn, uint256 bo) = distributor.credits(bob);
        (uint256 sn, uint256 so) = distributor.credits(address(this));
        assertEq(an + bn + sn + distributor.nativeReserve(), distributor.nativeLiability());
        assertEq(ao + bo + so + distributor.omrReserve(), distributor.omrLiability());
        assertGe(address(distributor).balance, distributor.nativeLiability());
        assertGe(token.balanceOf(address(distributor)), distributor.omrLiability());
        if (distributor.dissolved()) { assertEq(distributor.nativeReserve(), 0); assertEq(distributor.omrReserve(), 0); }
    }
}

contract FamilyDissolutionPolicyV2Test is FamilyDissolutionFixture {
    event FamilyDissolved(uint64 indexed revision, address indexed treasury, bytes32 receipt, uint256 nativeAmount, uint256 omrAmount);
    function testDissolutionCreditsOnlyFixedSafeAndPreservesEarnedWalletCredits() public {
        start(); registry.fund{value: 101}(address(distributor), 103); distributor.collect();
        suspendAll(); registry.fund{value: 17}(address(distributor), 19);
        uint64 rev = distributor.revision(); uint256 checkpoints = bridge.checkpoints();
        vm.expectEmit(true, true, false, true, address(distributor));
        emit FamilyDissolved(rev + 1, address(this), bytes32(uint256(3)), 17, 19);
        finish(3);
        assertEq(distributor.dissolutionPolicyVersion(), 1); assertTrue(distributor.dissolved());
        assertTrue(distributor.dissolutionReceiptUsed(bytes32(uint256(3)))); assertEq(distributor.revision(), rev + 1);
        assertEq(bridge.checkpoints(), checkpoints + 1);
        (uint256 n, uint256 o) = distributor.credits(alice); assertEq(n, 61); assertEq(o, 62);
        (n, o) = distributor.credits(bob); assertEq(n, 40); assertEq(o, 41);
        (n, o) = distributor.credits(address(this)); assertEq(n, 17); assertEq(o, 19);
        assertEq(distributor.nativeLiability(), 118); assertEq(distributor.omrLiability(), 122);
        assertDissolutionBacked();
        distributor.payout(payable(alice)); distributor.payout(payable(bob));
        assertEq(alice.balance, 61); assertEq(token.balanceOf(alice), 62);
        assertEq(bob.balance, 40); assertEq(token.balanceOf(bob), 41); assertDissolutionBacked();
    }
    function testAllRecipientsMustBeSuspendedEvenWhenLastWalletHasOnlyDustWeight() public {
        configure(9999); registry.bind(2, address(distributor)); suspend(alice, 1);
        uint64 rev = distributor.revision();
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector);
        distributor.dissolve(rev, bytes32(uint256(2)));
        suspend(bob, 2); registry.fund{value: 1}(address(distributor), 1); finish(3);
        (uint256 n, uint256 o) = distributor.credits(address(this)); assertEq(n, 1); assertEq(o, 1); assertDissolutionBacked();
    }
    function testOperatorExactRevisionNonzeroReceiptAndTerminalReplayRequired() public {
        start(); suspendAll(); uint64 rev = distributor.revision();
        vm.prank(alice); vm.expectRevert(OmertaFamilyDistributorV2.Unauthorized.selector); distributor.dissolve(rev, bytes32(uint256(3)));
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector); distributor.dissolve(rev - 1, bytes32(uint256(3)));
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector); distributor.dissolve(rev, bytes32(0));
        finish(3);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector); distributor.dissolve(rev + 1, bytes32(uint256(3)));
        assertDissolutionBacked();
    }
    function testTerminalPolicyCannotBeRevivedByFreshLeaderConsentOrOperator() public {
        start(); suspendAll(); finish(3);
        uint64 rev = distributor.revision(); uint64 deadline = uint64(block.timestamp + 1 hours);
        (address[] memory recipients, uint16[] memory weights) = arrays(6000);
        bytes memory split = consent(recipients, weights, rev, deadline);
        bytes memory reserve = reserveConsent(recipients, weights, 1, 1, rev, deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector); distributor.setShares(recipients, weights, rev, deadline, split);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector); distributor.setLeader(bob, rev, bytes32(uint256(4)));
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector); distributor.allocateReserve(recipients, weights, 1, 1, rev, deadline, reserve);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector); distributor.suspendMember(alice, rev, bytes32(uint256(5)));
        assertEq(distributor.revision(), rev); assertDissolutionBacked();
    }
    function testLaterRegistryFeesCreditSafeButNativeAndTokenDonationsStayOutside() public {
        start(); suspendAll(); finish(3);
        new DepartureForceNative{value: 47}(payable(address(distributor)));
        registry.fund(address(registry), 53); registry.donate(address(distributor), 53);
        registry.fund{value: 101}(address(distributor), 103); vm.prank(bob); distributor.collect();
        (uint256 n, uint256 o) = distributor.credits(address(this)); assertEq(n, 101); assertEq(o, 103);
        distributor.payout(payable(address(this)));
        assertEq(address(distributor).balance, 47); assertEq(token.balanceOf(address(distributor)), 53);
        assertEq(distributor.nativeLiability(), 0); assertEq(distributor.omrLiability(), 0); assertDissolutionBacked();
    }
    function testSafePayoutIsDeferredAtomicallyAndReentryCannotBlockDissolution() public {
        start(); suspendAll(); registry.fund{value: 17}(address(distributor), 19);
        rejectSafe = true; finish(3); assertTrue(distributor.dissolved());
        address payable[] memory list = new address payable[](1); list[0] = payable(address(this));
        distributor.payoutBatch(list);
        (uint256 n, uint256 o) = distributor.credits(address(this)); assertEq(n, 17); assertEq(o, 19);
        assertEq(distributor.nativeLiability(), 17); assertEq(distributor.omrLiability(), 19);
        assertEq(token.balanceOf(address(distributor)), 19);
        rejectSafe = false; probeSafe = true; distributor.payout(payable(address(this))); assertTrue(reentryBlocked);
        assertEq(distributor.nativeLiability(), 0); assertEq(distributor.omrLiability(), 0); assertDissolutionBacked();
    }
    function testEmptyPolicyCanEndButCannotInventPreexistingUnallocatedCreditOwnership() public {
        registry.fund{value: 1}(address(distributor), 1);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector); distributor.dissolve(0, bytes32(uint256(1)));
        assertFalse(distributor.dissolved()); assertEq(distributor.revision(), 0);
    }
    function testEmptyPolicyRejectsCurrentRegistryTreasuryEvenWhenNoCreditYet() public {
        registry.bind(2, address(distributor));
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector); distributor.dissolve(0, bytes32(uint256(1)));
        assertFalse(distributor.dissolved());
    }
    function testEmptyPolicyRechecksAfterCheckpointAndRevertsNewUnallocatedCredit() public {
        DissolutionCheckpointCredit lane = new DissolutionCheckpointCredit(registry, address(distributor));
        game.bind(address(registry), address(lane)); lane.arm{value: 7}();
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector); distributor.dissolve(0, bytes32(uint256(1)));
        (uint256 n, uint256 o) = registry.credits(address(distributor)); assertEq(n, 0); assertEq(o, 0);
        assertTrue(lane.enabled()); assertEq(address(lane).balance, 7); assertFalse(distributor.dissolved());
        assertEq(bridge.checkpoints(), 0);
    }
    function testEmptyUnboundPolicyEndsAndOnlyLaterGenuineReceiptsReachSafe() public {
        finish(1); assertTrue(distributor.dissolved()); assertEq(distributor.revision(), 1);
        registry.fund{value: 7}(address(distributor), 11); distributor.collect();
        (uint256 n, uint256 o) = distributor.credits(address(this)); assertEq(n, 7); assertEq(o, 11); assertDissolutionBacked();
    }
    function testCheckpointFailureRollsBackTerminalReceiptAndReserveCredit() public {
        start(); suspendAll(); registry.fund{value: 17}(address(distributor), 19);
        DepartureCheckpointProbe lane = new DepartureCheckpointProbe(distributor); lane.setReject(true);
        game.bind(address(registry), address(lane)); uint64 rev = distributor.revision();
        vm.prank(operator); vm.expectRevert(); distributor.dissolve(rev, bytes32(uint256(3)));
        assertFalse(distributor.dissolved()); assertFalse(distributor.dissolutionReceiptUsed(bytes32(uint256(3))));
        assertEq(distributor.revision(), rev); (uint256 n, uint256 o) = registry.credits(address(distributor)); assertEq(n, 17); assertEq(o, 19);
        lane.setReject(false); finish(3); assertTrue(lane.collectBlocked()); assertTrue(lane.payoutBlocked()); assertDissolutionBacked();
    }
    function testSingleMemberDissolutionPreservesPriorCreditAndReturnsOnlyFutureReserve() public {
        (address[] memory recipients, uint16[] memory weights) = one(alice); uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = consent(recipients, weights, 0, deadline);
        vm.prank(operator); distributor.setShares(recipients, weights, 0, deadline, signature); registry.bind(2, address(distributor));
        registry.fund{value: 13}(address(distributor), 17); suspend(alice, 1);
        registry.fund{value: 19}(address(distributor), 23); finish(2);
        (uint256 n, uint256 o) = distributor.credits(alice); assertEq(n, 13); assertEq(o, 17);
        (n, o) = distributor.credits(address(this)); assertEq(n, 19); assertEq(o, 23); assertDissolutionBacked();
    }
    function testSafeAlreadyAnEarningRecipientKeepsItsOldCreditAndAddsReserveExactlyOnce() public {
        (address[] memory recipients, uint16[] memory weights) = arrays(6000); recipients[0] = address(this);
        uint64 deadline = uint64(block.timestamp + 1 hours); bytes memory signature = consent(recipients, weights, 0, deadline);
        vm.prank(operator); distributor.setShares(recipients, weights, 0, deadline, signature); registry.bind(2, address(distributor));
        registry.fund{value: 101}(address(distributor), 103); distributor.collect();
        suspend(address(this), 1); suspend(bob, 2); registry.fund{value: 17}(address(distributor), 19); finish(3);
        (uint256 n, uint256 o) = distributor.credits(address(this)); assertEq(n, 78); assertEq(o, 81);
        (n, o) = distributor.credits(bob); assertEq(n, 40); assertEq(o, 41);
        assertEq(distributor.nativeLiability(), 118); assertEq(distributor.omrLiability(), 122); assertDissolutionBacked();
    }
    function testNativeOnlyReserveAndLaterOmrOnlyReceiptRemainIndependentlyPayable() public {
        start(); suspendAll(); registry.fund{value: 13}(address(distributor), 0); finish(3);
        (uint256 n, uint256 o) = distributor.credits(address(this)); assertEq(n, 13); assertEq(o, 0);
        registry.fund(address(distributor), 17); distributor.collect();
        (n, o) = distributor.credits(address(this)); assertEq(n, 13); assertEq(o, 17);
        distributor.payout(payable(address(this))); assertDissolutionBacked();
    }
    function testTerminalCollectionCannotBypassActualTokenModuleAdmission() public {
        OmertaFamilyDistributorV2 unadmitted = OmertaFamilyDistributorV2(payable(deployFixture(
            "OmertaFamilyDistributorV2.sol:OmertaFamilyDistributorV2", abi.encode(address(this), operator,
            vm.addr(LEADER_KEY), uint64(3), IFamilyRegistryV2(address(registry))))));
        vm.prank(operator); unadmitted.dissolve(0, bytes32(uint256(1)));
        registry.fund{value: 13}(address(unadmitted), 17); assertFalse(token.isOperator(address(unadmitted)));
        vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector); unadmitted.collect();
        (uint256 n, uint256 o) = registry.credits(address(unadmitted)); assertEq(n, 13); assertEq(o, 17);
        assertEq(unadmitted.nativeLiability(), 0); assertEq(unadmitted.omrLiability(), 0);
    }
    function testFuzzDissolutionConservesBothAssetsOldCreditsReserveAndDonations(uint64 n, uint64 o, uint16 weight) public {
        configure(uint16(bound(weight, 1, 9999))); registry.bind(2, address(distributor));
        registry.fund{value: 101}(address(distributor), 103); distributor.collect();
        (uint256 an, uint256 ao) = distributor.credits(alice); (uint256 bn, uint256 bo) = distributor.credits(bob);
        suspendAll(); uint256 nativeAmount = bound(n, 0, 1 ether); uint256 omrAmount = bound(o, 0, 100 ether);
        registry.fund{value: nativeAmount}(address(distributor), omrAmount);
        new DepartureForceNative{value: 5}(payable(address(distributor))); registry.fund(address(registry), 7); registry.donate(address(distributor), 7);
        finish(3); (uint256 sn, uint256 so) = distributor.credits(address(this)); assertEq(sn, nativeAmount); assertEq(so, omrAmount);
        (uint256 afterN, uint256 afterO) = distributor.credits(alice); assertEq(afterN, an); assertEq(afterO, ao);
        (afterN, afterO) = distributor.credits(bob); assertEq(afterN, bn); assertEq(afterO, bo); assertDissolutionBacked();
        distributor.payout(payable(alice)); distributor.payout(payable(bob)); distributor.payout(payable(address(this)));
        assertEq(address(distributor).balance, 5); assertEq(token.balanceOf(address(distributor)), 7); assertDissolutionBacked();
    }
}

contract FamilyDissolutionInvariantV2Test is FamilyDissolutionFixture {
    uint256 private receipts;
    uint256 private donatedNative;
    uint256 private donatedOmr;
    uint64 private terminalRevision;
    function setUp() public override {
        super.setUp(); start();
        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = this.actFund.selector; selectors[1] = this.actCollect.selector;
        selectors[2] = this.actSuspend.selector; selectors[3] = this.actDissolve.selector;
        selectors[4] = this.actPayout.selector; selectors[5] = this.actDonate.selector; selectors[6] = this.actPolicy.selector;
        targetSelector(FuzzSelector({addr: address(this), selectors: selectors})); targetContract(address(this));
    }
    function actFund(uint64 n, uint64 o) external {
        uint256 amount = bound(n, 0, 1e14); if (address(this).balance < amount) vm.deal(address(this), 1 ether);
        registry.fund{value: amount}(address(distributor), bound(o, 0, 1e14));
    }
    function actCollect() external { distributor.collect(); }
    function actSuspend(bool first) external {
        address member = first ? alice : bob;
        if (distributor.dissolved() || distributor.suspended(member)) return;
        suspend(member, ++receipts);
    }
    function actDissolve() external {
        if (distributor.dissolved()) return;
        if (!distributor.suspended(alice)) suspend(alice, ++receipts);
        if (!distributor.suspended(bob)) suspend(bob, ++receipts);
        (uint256 an, uint256 ao) = distributor.credits(alice); (uint256 bn, uint256 bo) = distributor.credits(bob);
        finish(++receipts); terminalRevision = distributor.revision();
        (uint256 n, uint256 o) = distributor.credits(alice); assertEq(n, an); assertEq(o, ao);
        (n, o) = distributor.credits(bob); assertEq(n, bn); assertEq(o, bo);
    }
    function actPolicy(uint16 weight) external { if (!distributor.dissolved()) configure(uint16(bound(weight, 1, 9999))); }
    function actPayout(uint8 whom) external { distributor.payout(payable(whom % 3 == 0 ? alice : whom % 3 == 1 ? bob : address(this))); }
    function actDonate(uint32 n, uint32 o) external {
        uint256 nativeAmount = bound(n, 0, 100); uint256 omrAmount = bound(o, 0, 100);
        if (address(this).balance < nativeAmount) vm.deal(address(this), 1 ether);
        new DepartureForceNative{value: nativeAmount}(payable(address(distributor)));
        registry.fund(address(registry), omrAmount); registry.donate(address(distributor), omrAmount);
        donatedNative += nativeAmount; donatedOmr += omrAmount;
    }
    function invariant_AllCreditsAndReserveExactlyEqualLiabilitiesAndDonationsStaySurplus() external view {
        assertDissolutionBacked();
        assertEq(address(distributor).balance, distributor.nativeLiability() + donatedNative);
        assertEq(token.balanceOf(address(distributor)), distributor.omrLiability() + donatedOmr);
        if (distributor.dissolved()) assertEq(distributor.revision(), terminalRevision);
    }
    function testStatefulTraceActuallyCrossesTerminalAndPaysAllThreeCreditHolders() public {
        this.actFund(101, 103); this.actCollect(); this.actDonate(5, 7); this.actSuspend(true);
        this.actFund(17, 19); this.actDissolve(); assertTrue(distributor.dissolved());
        this.actFund(23, 29); this.actCollect(); this.actPolicy(5000);
        this.actPayout(0); this.actPayout(1); this.actPayout(2);
        this.invariant_AllCreditsAndReserveExactlyEqualLiabilitiesAndDonationsStaySurplus();
        assertEq(distributor.nativeLiability(), 0); assertEq(distributor.omrLiability(), 0);
        assertEq(address(distributor).balance, 5); assertEq(token.balanceOf(address(distributor)), 7);
    }
}
