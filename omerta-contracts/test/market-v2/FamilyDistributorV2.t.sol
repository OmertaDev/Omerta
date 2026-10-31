// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;
import {Test} from "forge-std/Test.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {OmertaFamilyDistributorV2, IFamilyRegistryV2} from "../../src/market-v2/OmertaFamilyDistributorV2.sol";

contract FamilyGameFixture {
    address public registry;
    address public immutable adjudicator;
    address[] private _lanes;
    constructor(address operator) { adjudicator = operator; }
    function bind(address r, address lane) external { registry = r; _lanes.push(lane); }
    function activeLanes() external view returns (address[] memory) { return _lanes; }
}
contract FamilyRegistryFixture {
    OmertaRestrictedOMRV2 public immutable omr;
    address public immutable game;
    address public immutable owner;
    mapping(uint64 => address) public familyTreasury;
    struct Credit { uint256 nativeAmount; uint256 omrAmount; }
    mapping(address => Credit) public credits;
    constructor(OmertaRestrictedOMRV2 token, address g) { omr = token; game = g; owner = msg.sender; }
    function bind(uint64 family, address treasury) external { familyTreasury[family] = treasury; }
    function fund(address receiver, uint256 amount) external payable {
        if (amount != 0) omr.transferFrom(msg.sender, address(this), amount);
        credits[receiver].nativeAmount += msg.value; credits[receiver].omrAmount += amount;
    }
    function donate(address receiver, uint256 amount) external { omr.transfer(receiver, amount); }
    function claim(address payable receiver) external {
        Credit memory c = credits[msg.sender]; delete credits[msg.sender];
        if (c.omrAmount != 0) omr.transfer(receiver, c.omrAmount);
        if (c.nativeAmount != 0) { (bool ok,) = receiver.call{value:c.nativeAmount}(""); require(ok); }
    }
}
contract FamilyBridgeFixture { uint256 public checkpoints; function checkpointFees() external { ++checkpoints; } }
contract FamilyManagerFixture {
    address public immutable omr; uint16 public constant TRADE_FEE_BPS = 400;
    constructor(address token) { omr = token; }
    function revenuePolicyId() external pure returns(bytes32) { return keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_350_BASE_50_BTC_REWARDS_BOTH_DIRECTIONS"); }
}
contract FamilyRejectingMember { receive() external payable { revert(); } }

abstract contract FamilyDistributorV2Fixture is Test {
    OmertaRestrictedOMRV2 token;
    FamilyRegistryFixture registry;
    FamilyGameFixture game;
    FamilyBridgeFixture bridge;
    OmertaFamilyDistributorV2 distributor;
    FamilyRejectingMember badMember;
    address operator = address(0xCAFE);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    uint256 constant LEADER_KEY = 0x234567;

    function setUp() public virtual {
        vm.warp(10 days); vm.deal(address(this), 100 ether);
        token = new OmertaRestrictedOMRV2(address(this));
        game = new FamilyGameFixture(operator);
        registry = new FamilyRegistryFixture(token, address(game));
        bridge = new FamilyBridgeFixture(); game.bind(address(registry), address(bridge));
        distributor = new OmertaFamilyDistributorV2(address(this), operator, vm.addr(LEADER_KEY), 2,
            IFamilyRegistryV2(address(registry)));
        FamilyManagerFixture manager = new FamilyManagerFixture(address(token));
        token.bindSettlementManager(address(manager), address(manager).codehash);
        token.setOperator(address(registry), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(registry).codehash);
        token.setOperator(address(distributor), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(distributor).codehash);
        vm.prank(alice, alice); token.registerWallet(alice);
        vm.prank(bob, bob); token.registerWallet(bob);
        badMember = new FamilyRejectingMember();
        token.setContractHolder(address(badMember), address(badMember).codehash);
        token.sealPolicy(); token.approve(address(registry), type(uint256).max);
    }
    function arrays(uint16 a) internal view returns(address[] memory members, uint16[] memory weights) {
        members = new address[](2); weights = new uint16[](2);
        members[0] = alice; members[1] = bob; weights[0] = a; weights[1] = 10000-a;
    }
    function consent(address[] memory members, uint16[] memory weights, uint64 rev, uint64 deadline)
        internal view returns(bytes memory)
    {
        bytes32 digest = distributor.hashSplit(members, weights, rev, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(LEADER_KEY, digest);
        return abi.encodePacked(r,s,v);
    }
    function configure(uint16 a) internal {
        (address[] memory members, uint16[] memory weights) = arrays(a);
        uint64 rev = distributor.revision(); uint64 deadline = uint64(block.timestamp+1 hours);
        bytes memory sig = consent(members, weights, rev, deadline);
        vm.prank(operator); distributor.setShares(members, weights, rev, deadline, sig);
    }
    function start() internal { configure(6000); registry.bind(2, address(distributor)); }

}

contract FamilyDistributorV2Test is FamilyDistributorV2Fixture {
    function testActualRestrictedTokenSplitsAndPaysFixedRecipients() public {
        start(); registry.fund{value: 1 ether}(address(distributor), 10 ether);
        vm.prank(bob); distributor.collect();
        (uint256 n, uint256 o) = distributor.credits(alice);
        assertEq(n, 0.6 ether); assertEq(o, 6 ether);
        vm.prank(address(0xBAD)); distributor.payout(payable(alice));
        assertEq(alice.balance, 0.6 ether); assertEq(token.balanceOf(alice), 6 ether);
        assertEq(distributor.nativeLiability(), 0.4 ether); assertEq(distributor.omrLiability(), 4 ether);
        distributor.payout(payable(bob)); distributor.payout(payable(bob));
        assertEq(distributor.nativeLiability(),0); assertEq(distributor.omrLiability(),0);
        assertEq(bridge.checkpoints(),1);
    }
    function testSplitChangeCheckpointsAndPreservesAllPastWalletRights() public {
        start(); registry.fund{value: 101}(address(distributor),101);
        configure(2000);
        (uint256 n, uint256 o) = distributor.credits(alice); assertEq(n,61); assertEq(o,61);
        (n,o) = distributor.credits(bob); assertEq(n,40); assertEq(o,40);
        registry.fund{value: 100}(address(distributor),100); distributor.collect();
        (n,o) = distributor.credits(alice); assertEq(n,81); assertEq(o,81);
        (n,o) = distributor.credits(bob); assertEq(n,120); assertEq(o,120);
        assertEq(bridge.checkpoints(),2);
    }
    function testUnsolicitedOMRIsNotRedistributedToNewSnapshot() public {
        start(); registry.fund(address(registry), 1000);
        registry.donate(address(distributor),1000);
        distributor.collect(); assertEq(distributor.omrLiability(),0);
        configure(2000); assertEq(distributor.omrLiability(),0);
        assertEq(token.balanceOf(address(distributor)),1000);
    }
    function testRequiresLeaderConsentOperatorAndExactRevision() public {
        (address[] memory members, uint16[] memory weights) = arrays(6000);
        uint64 deadline = uint64(block.timestamp+1 hours);
        bytes memory sig = consent(members,weights,0,deadline);
        vm.prank(alice); vm.expectRevert(OmertaFamilyDistributorV2.Unauthorized.selector);
        distributor.setShares(members,weights,0,deadline,sig);
        weights[0]=5000; weights[1]=5000;
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.setShares(members,weights,0,deadline,sig);
        weights[0]=6000; weights[1]=4000;
        vm.prank(operator); distributor.setShares(members,weights,0,deadline,sig);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.setShares(members,weights,0,deadline,sig);
    }
    function testRejectsBadTotalsDuplicatesAndUnregisteredWallets() public {
        (address[] memory members, uint16[] memory weights)=arrays(6000);
        uint64 deadline=uint64(block.timestamp+1 hours);
        weights[1]=3999;
        bytes memory sig=consent(members,weights,0,deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector);
        distributor.setShares(members,weights,0,deadline,sig);
        weights[1]=4000; members[1]=alice; sig=consent(members,weights,0,deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector);
        distributor.setShares(members,weights,0,deadline,sig);
        members[1]=address(0xDEAD); sig=consent(members,weights,0,deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector);
        distributor.setShares(members,weights,0,deadline,sig);
    }
    function testFirstSplitCannotReassignFeesAlreadyEarnedWithoutPolicy() public {
        registry.bind(2,address(distributor));
        (address[] memory members,uint16[] memory weights)=arrays(6000);
        uint64 deadline=uint64(block.timestamp+1 hours); bytes memory sig=consent(members,weights,0,deadline);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConfiguration.selector);
        distributor.setShares(members,weights,0,deadline,sig);
    }
    function testLeadershipChangeInvalidatesOldConsentWithoutMovingCredits() public {
        start(); registry.fund{value: 100}(address(distributor),100); distributor.collect();
        (address[] memory members,uint16[] memory weights)=arrays(2000);
        uint64 deadline=uint64(block.timestamp+1 hours); bytes memory sig=consent(members,weights,1,deadline);
        vm.prank(operator); distributor.setLeader(bob,1,bytes32(uint256(1)));
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.setShares(members,weights,1,deadline,sig);
        (uint256 n,uint256 o)=distributor.credits(alice); assertEq(n,60); assertEq(o,60);
        vm.prank(operator); vm.expectRevert(OmertaFamilyDistributorV2.InvalidConsent.selector);
        distributor.setLeader(alice,2,bytes32(uint256(1)));
    }
    function testFuzzSplitSolvencyAndDust(uint64 n,uint64 o,uint16 weight) public {
        uint16 a=uint16(bound(weight,1,9999)); configure(a); registry.bind(2,address(distributor));
        uint256 nativeAmount=bound(n,1,1 ether); uint256 omrAmount=bound(o,1,100 ether);
        registry.fund{value:nativeAmount}(address(distributor),omrAmount); distributor.collect();
        (uint256 an,uint256 ao)=distributor.credits(alice); (uint256 bn,uint256 bo)=distributor.credits(bob);
        assertEq(an+bn,nativeAmount); assertEq(ao+bo,omrAmount);
        assertEq(distributor.nativeLiability(),address(distributor).balance);
        assertEq(distributor.omrLiability(),token.balanceOf(address(distributor)));
        distributor.payout(payable(alice)); distributor.payout(payable(bob));
        assertEq(address(distributor).balance,0); assertEq(token.balanceOf(address(distributor)),0);
    }

    function testBatchFailureRollsBackOnlyRejectingMemberAndPaysOthers() public {
        (address[] memory members,uint16[] memory weights)=arrays(5000);
        members[0]=address(badMember);
        uint64 deadline=uint64(block.timestamp+1 hours); bytes memory sig=consent(members,weights,0,deadline);
        vm.prank(operator); distributor.setShares(members,weights,0,deadline,sig);
        registry.bind(2,address(distributor));
        registry.fund{value:100}(address(distributor),100); distributor.collect();
        address payable[] memory targets=new address payable[](2);
        targets[0]=payable(address(badMember)); targets[1]=payable(bob);
        distributor.payoutBatch(targets);
        (uint256 n,uint256 o)=distributor.credits(address(badMember));
        assertEq(n,50); assertEq(o,50); assertEq(token.balanceOf(address(badMember)),0);
        assertEq(bob.balance,50); assertEq(token.balanceOf(bob),50);
        assertEq(distributor.nativeLiability(),50); assertEq(distributor.omrLiability(),50);
        vm.expectRevert(OmertaFamilyDistributorV2.Unauthorized.selector);
        distributor.payBatchMember(payable(address(badMember)));
    }
}
