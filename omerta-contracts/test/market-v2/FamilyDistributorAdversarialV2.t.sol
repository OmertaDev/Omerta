// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {FamilyDistributorV2Fixture} from "./FamilyDistributorV2.t.sol";
import {OmertaFamilyDistributorV2} from "../../src/market-v2/OmertaFamilyDistributorV2.sol";

contract FamilyGasBurnerV2 {
    receive() external payable { assembly { for {} 1 {} {} } }
}
contract FamilyReenteringRecipientV2 {
    OmertaFamilyDistributorV2 public immutable distributor;
    bool public payoutBlocked;
    bool public batchBlocked;
    bool public collectBlocked;
    bool public selfCallBlocked;
    uint256 public creditAtCallback;
    constructor(OmertaFamilyDistributorV2 d) { distributor = d; }
    receive() external payable {
        (creditAtCallback,) = distributor.credits(address(this));
        (bool ok,) = address(distributor).call(abi.encodeCall(distributor.payout, (payable(address(this)))));
        payoutBlocked = !ok;
        address payable[] memory list = new address payable[](1); list[0] = payable(address(this));
        (ok,) = address(distributor).call(abi.encodeCall(distributor.payoutBatch, (list)));
        batchBlocked = !ok;
        (ok,) = address(distributor).call(abi.encodeCall(distributor.collect, ()));
        collectBlocked = !ok;
        (ok,) = address(distributor).call(abi.encodeCall(distributor.payBatchMember, (payable(address(this)))));
        selfCallBlocked = !ok;
    }
}
contract FamilyForceNativeV2 {
    constructor(address payable destination) payable { selfdestruct(destination); }
}

contract FamilyDistributorAdversarialV2Test is FamilyDistributorV2Fixture {
    uint256 private chainBefore;
    function setUp() public override { super.setUp(); chainBefore = block.chainid; }
    function test_AdversarialWrongDomainExpiredAndLongLivedConsent() public {
        (address[] memory members,uint16[] memory weights) = arrays(6000);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.chainId(chainBefore + 1);
        bytes memory signature = consent(members,weights,0,deadline);
        vm.chainId(chainBefore);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.setShares(members,weights,0,deadline,signature);
        deadline = uint64(block.timestamp - 1); signature = consent(members,weights,0,deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.setShares(members,weights,0,deadline,signature);
        deadline = uint64(block.timestamp + 1 hours + 1); signature = consent(members,weights,0,deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.setShares(members,weights,0,deadline,signature);
    }

    function test_AdversarialAnotherDistributorCannotAuthorizeThisFamilyPolicy() public {
        (address[] memory members,uint16[] memory weights) = arrays(6000);
        OmertaFamilyDistributorV2 original=distributor;
        OmertaFamilyDistributorV2 other=new OmertaFamilyDistributorV2(address(this),operator,vm.addr(LEADER_KEY),2,distributor.registry());
        uint64 deadline=uint64(block.timestamp+1 hours);
        distributor=other; bytes memory signature=consent(members,weights,0,deadline); distributor=original;
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.setShares(members,weights,0,deadline,signature);
        assertEq(distributor.revision(),0);
    }

    function test_AdversarialReentrantRecipientCannotRespendOrMutatePolicy() public {
        FamilyReenteringRecipientV2 receiver = new FamilyReenteringRecipientV2(distributor);
        token.proposeContractHolder(address(receiver),address(receiver).codehash);
        vm.warp(block.timestamp + 7 days); token.executeContractHolderProposal(address(receiver));
        (address[] memory members,uint16[] memory weights) = arrays(5000); members[0] = address(receiver);
        uint64 deadline = uint64(block.timestamp + 1 hours); bytes memory signature = consent(members,weights,0,deadline);
        vm.prank(operator); distributor.setShares(members,weights,0,deadline,signature);
        registry.bind(2,address(distributor)); registry.fund{value:100}(address(distributor),100); distributor.collect();
        address payable[] memory list = new address payable[](2); list[0] = payable(address(receiver)); list[1] = payable(bob);
        distributor.payoutBatch(list);
        assertTrue(receiver.payoutBlocked()); assertTrue(receiver.batchBlocked());
        assertTrue(receiver.collectBlocked()); assertTrue(receiver.selfCallBlocked());
        assertEq(receiver.creditAtCallback(),0);
        assertEq(address(receiver).balance,50); assertEq(token.balanceOf(address(receiver)),50);
        assertEq(bob.balance,50); assertEq(token.balanceOf(bob),50);
        assertEq(distributor.nativeLiability(),0); assertEq(distributor.omrLiability(),0);
        assertEq(distributor.revision(),1);
    }

    function test_AdversarialGasBurnerDefersOnlyItsOwnCredit() public {
        FamilyGasBurnerV2 receiver = new FamilyGasBurnerV2();
        token.proposeContractHolder(address(receiver),address(receiver).codehash);
        vm.warp(block.timestamp + 7 days); token.executeContractHolderProposal(address(receiver));
        (address[] memory members,uint16[] memory weights) = arrays(5000); members[0] = address(receiver);
        uint64 deadline = uint64(block.timestamp + 1 hours); bytes memory signature = consent(members,weights,0,deadline);
        vm.prank(operator); distributor.setShares(members,weights,0,deadline,signature);
        registry.bind(2,address(distributor)); registry.fund{value:100}(address(distributor),100); distributor.collect();
        address payable[] memory list = new address payable[](2); list[0] = payable(address(receiver)); list[1] = payable(bob);
        uint256 beforeGas = gasleft(); distributor.payoutBatch(list); uint256 used = beforeGas - gasleft();
        assertLt(used,700000);
        (uint256 n,uint256 o) = distributor.credits(address(receiver)); assertEq(n,50); assertEq(o,50);
        assertEq(token.balanceOf(address(receiver)),0); assertEq(address(receiver).balance,0);
        assertEq(bob.balance,50); assertEq(token.balanceOf(bob),50);
        assertEq(distributor.nativeLiability(),50); assertEq(distributor.omrLiability(),50);
    }

    function test_AdversarialForcedDonationsAndRemovedMemberStayOutsideNewRights() public {
        start(); registry.fund{value:101}(address(distributor),101); distributor.collect();
        new FamilyForceNativeV2{value:47}(payable(address(distributor)));
        registry.fund(address(registry),99); registry.donate(address(distributor),99);
        address[] memory members = new address[](1); members[0] = bob;
        uint16[] memory weights = new uint16[](1); weights[0] = 10000;
        uint64 deadline = uint64(block.timestamp + 1 hours); bytes memory signature = consent(members,weights,1,deadline);
        vm.prank(operator); distributor.setShares(members,weights,1,deadline,signature);
        registry.fund{value:100}(address(distributor),100); distributor.collect();
        (uint256 n,uint256 o) = distributor.credits(alice); assertEq(n,61); assertEq(o,61);
        (n,o) = distributor.credits(bob); assertEq(n,140); assertEq(o,140);
        distributor.payout(payable(alice)); distributor.payout(payable(bob));
        assertEq(address(distributor).balance,47); assertEq(token.balanceOf(address(distributor)),99);
        assertEq(distributor.nativeLiability(),0); assertEq(distributor.omrLiability(),0);
    }

    function test_AdversarialBatchBoundsAndDuplicateWalletCannotDoublePay() public {
        start(); registry.fund{value:100}(address(distributor),100); distributor.collect();
        address payable[] memory list = new address payable[](0);
        vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector); distributor.payoutBatch(list);
        list = new address payable[](21);
        vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector); distributor.payoutBatch(list);
        list = new address payable[](2); list[0] = payable(alice); list[1] = payable(alice);
        distributor.payoutBatch(list); assertEq(alice.balance,60); assertEq(token.balanceOf(alice),60);
        (uint256 n,uint256 o) = distributor.credits(bob); assertEq(n,40); assertEq(o,40);
    }

    function test_AdversarialTwentyRecipientsConserveSmallestUnitsAndBoundGas() public {
        address[] memory members = new address[](20); uint16[] memory weights = new uint16[](20);
        for (uint256 i; i<20; ++i) {
            members[i] = address(uint160(0x100000+i)); weights[i] = 500;
            vm.prank(members[i],members[i]); token.registerWallet(members[i]);
        }
        uint64 deadline = uint64(block.timestamp + 1 hours); bytes memory signature = consent(members,weights,0,deadline);
        vm.prank(operator); distributor.setShares(members,weights,0,deadline,signature);
        registry.bind(2,address(distributor)); registry.fund{value:19}(address(distributor),19); distributor.collect();
        // All rounding remains with the first OLD recipient. No new snapshot
        // ever receives an unallocated remainder from this earning period.
        (uint256 n,uint256 o) = distributor.credits(members[0]); assertEq(n,19); assertEq(o,19);
        for (uint256 i=1; i<20; ++i) { (n,o) = distributor.credits(members[i]); assertEq(n,0); assertEq(o,0); }
        address payable[] memory list = new address payable[](20);
        for (uint256 i; i<20; ++i) list[i] = payable(members[i]);
        uint256 beforeGas=gasleft(); distributor.payoutBatch(list); assertLt(beforeGas-gasleft(),700000);
        assertEq(distributor.nativeLiability(),0); assertEq(distributor.omrLiability(),0);
    }
}

contract FamilyDistributorInvariantV2Test is FamilyDistributorV2Fixture {
    function setUp() public override {
        super.setUp(); start();
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0]=this.actFund.selector; selectors[1]=this.actCollect.selector;
        selectors[2]=this.actReweight.selector; selectors[3]=this.actPayout.selector;
        targetSelector(FuzzSelector({addr:address(this),selectors:selectors}));
        targetContract(address(this));
    }
    function actFund(uint64 n,uint64 o) external {
        uint256 nativeAmount=bound(n,0,1e14); uint256 omrAmount=bound(o,0,1e14);
        if(address(this).balance<nativeAmount)vm.deal(address(this),1 ether);
        registry.fund{value:nativeAmount}(address(distributor),omrAmount);
    }
    function actCollect() external { distributor.collect(); }
    function actReweight(uint16 weight) external { configure(uint16(bound(weight,1,9999))); }
    function actPayout(bool first) external { distributor.payout(payable(first?alice:bob)); }
    function invariant_EarnedWalletCreditsAlwaysEqualLiabilitiesAndAreBacked() external view {
        (uint256 an,uint256 ao)=distributor.credits(alice); (uint256 bn,uint256 bo)=distributor.credits(bob);
        assertEq(an+bn,distributor.nativeLiability()); assertEq(ao+bo,distributor.omrLiability());
        assertEq(address(distributor).balance,distributor.nativeLiability());
        assertEq(token.balanceOf(address(distributor)),distributor.omrLiability());
    }
}
