// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {OmertaWorkEscrowV2} from "../../src/market-v2/OmertaWorkEscrowV2.sol";

contract WorkFixtureUSDC is ERC20 {
    constructor() ERC20("Fixture only", "FIXTURE") {}
    function mint(address to, uint256 n) external { _mint(to, n); }
    function decimals() public pure override returns(uint8) { return 6; }
}
contract RejectWorkRecipient {
    function accept(OmertaWorkEscrowV2 e, bytes32 id) external { e.accept(id); }
    function settle(OmertaWorkEscrowV2 e, bytes32 id) external { e.settle(id); }
    receive() external payable { revert(); }
}
contract FeeWorkToken is ERC20 {
    bool public fee;
    constructor() ERC20("Fee fixture", "FEE") {}
    function setFee(bool on) external { fee=on; }
    function _update(address from,address to,uint256 amount) internal override {
        if(fee && from!=address(0) && to!=address(0)){super._update(from,to,amount-1);super._update(from,address(0),1);}
        else super._update(from,to,amount);
    }
}
contract ReenterWorkRecipient {
    OmertaWorkEscrowV2 escrow;
    bytes32 id;
    bool public refused;
    function accept(OmertaWorkEscrowV2 e,bytes32 source) external {escrow=e;id=source;e.accept(source);}
    function settle() external {escrow.settle(id);}
    receive() external payable {(bool ok,)=address(escrow).call(abi.encodeCall(escrow.settle,(id)));refused=!ok;}
}
contract WorkEscrowV2Test is Test {
    OmertaWorkEscrowV2 escrow;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address funder = address(0xF1);
    address worker = address(0xB1);
    bytes32 workHash = keccak256("fixture canonical work identity");
    bytes32 outcome = keccak256("fixture outcome; not production gameplay proof");
    function setUp() public {
        vm.chainId(1);
        WorkFixtureUSDC token = new WorkFixtureUSDC();
        // Honest isolated token fixture at the issuer address; no fork/deployment/backing claim.
        vm.etch(USDC, address(token).code);
        WorkFixtureUSDC(USDC).mint(funder, 1000e6);
        vm.deal(funder, 100 ether);
        escrow = new OmertaWorkEscrowV2();
        vm.prank(funder); WorkFixtureUSDC(USDC).approve(address(escrow), type(uint256).max);
    }
    function funded(address asset, uint256 amount, address payee) private returns(bytes32 id) {
        vm.prank(funder); id=escrow.fund{value:asset==address(0)?amount:0}(1,payee,asset,amount,workHash,uint64(block.timestamp+120));
    }
    function testNativeAllocationAndActualPayout() public {
        bytes32 id=funded(address(0),1 ether,worker);
        assertEq(escrow.liability(address(0)),1 ether);assertEq(address(escrow).balance,1 ether);
        vm.prank(worker);escrow.accept(id);
        vm.prank(funder);escrow.allocate(id,outcome);
        vm.warp(block.timestamp+121);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowV2.InvalidState.selector);escrow.recover(id);
        vm.prank(worker);escrow.settle(id);
        assertEq(worker.balance,1 ether);assertEq(escrow.liability(address(0)),0);
        assertEq(uint256(escrow.work(id).state),uint256(OmertaWorkEscrowV2.State.Settled));
        vm.prank(worker);vm.expectRevert(OmertaWorkEscrowV2.InvalidState.selector);escrow.settle(id);
    }
    function testUSDCAllocationAndActualPayout() public {
        bytes32 id=funded(USDC,125e6,worker);
        assertEq(WorkFixtureUSDC(USDC).balanceOf(address(escrow)),125e6);
        vm.prank(worker);escrow.accept(id);vm.prank(funder);escrow.allocate(id,outcome);vm.prank(worker);escrow.settle(id);
        assertEq(WorkFixtureUSDC(USDC).balanceOf(worker),125e6);assertEq(WorkFixtureUSDC(USDC).balanceOf(funder),875e6);
        assertEq(escrow.liability(USDC),0);
    }
    function testUnusedRecoveryOriginalOnlyAndReplay() public {
        bytes32 id=funded(USDC,10e6,worker);vm.prank(worker);escrow.accept(id);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowV2.InvalidState.selector);escrow.recover(id);
        vm.warp(block.timestamp+120);
        vm.prank(address(0x999));vm.expectRevert(OmertaWorkEscrowV2.Unauthorized.selector);escrow.recover(id);
        vm.prank(funder);escrow.recover(id);assertEq(WorkFixtureUSDC(USDC).balanceOf(funder),1000e6);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowV2.InvalidState.selector);escrow.recover(id);
        uint64 later=escrow.work(id).deadline+120;
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowV2.InvalidState.selector);escrow.fund(1,worker,USDC,10e6,workHash,later);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowV2.InvalidState.selector);escrow.fund(2,worker,USDC,10e6,workHash,later);
    }
    function testWrongPartiesAssetAndExpiredAdmission() public {
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowV2.InvalidTerms.selector);escrow.fund(1,worker,address(0x999),100,workHash,uint64(block.timestamp+120));
        bytes32 id=funded(address(0),1 ether,worker);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowV2.Unauthorized.selector);escrow.accept(id);
        vm.prank(worker);vm.expectRevert(OmertaWorkEscrowV2.Unauthorized.selector);escrow.allocate(id,outcome);
        vm.prank(worker);escrow.accept(id);vm.warp(block.timestamp+120);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowV2.InvalidState.selector);escrow.allocate(id,outcome);
    }
    function testRejectedRecipientRetainsAllocatedLiability() public {
        RejectWorkRecipient rejector=new RejectWorkRecipient();bytes32 id=funded(address(0),1 ether,address(rejector));
        rejector.accept(escrow,id);vm.prank(funder);escrow.allocate(id,outcome);
        vm.expectRevert(OmertaWorkEscrowV2.TransferFailed.selector);rejector.settle(escrow,id);
        assertEq(escrow.liability(address(0)),1 ether);assertEq(address(escrow).balance,1 ether);
        assertEq(uint256(escrow.work(id).state),uint256(OmertaWorkEscrowV2.State.Allocated));
    }
    function testReentrancyCannotSettleTwice() public {
        ReenterWorkRecipient receiver=new ReenterWorkRecipient();bytes32 id=funded(address(0),1 ether,address(receiver));
        receiver.accept(escrow,id);vm.prank(funder);escrow.allocate(id,outcome);receiver.settle();
        assertTrue(receiver.refused());assertEq(address(receiver).balance,1 ether);assertEq(escrow.liability(address(0)),0);
    }
    function testTokenIncomingAndOutgoingDeltaFailClosed() public {
        FeeWorkToken token=new FeeWorkToken();vm.etch(USDC,address(token).code);FeeWorkToken(USDC).setFee(true);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowV2.TransferFailed.selector);escrow.fund(1,worker,USDC,100,workHash,uint64(block.timestamp+120));
        assertFalse(escrow.usedNonce(funder,1));assertEq(escrow.liability(USDC),0);assertEq(WorkFixtureUSDC(USDC).balanceOf(funder),1000e6);
        FeeWorkToken(USDC).setFee(false);bytes32 id=funded(USDC,100,worker);
        vm.prank(worker);escrow.accept(id);vm.prank(funder);escrow.allocate(id,outcome);FeeWorkToken(USDC).setFee(true);
        vm.prank(worker);vm.expectRevert(OmertaWorkEscrowV2.TransferFailed.selector);escrow.settle(id);
        assertEq(escrow.liability(USDC),100);assertEq(WorkFixtureUSDC(USDC).balanceOf(address(escrow)),100);assertEq(WorkFixtureUSDC(USDC).balanceOf(worker),0);
    }
    function testFuzzNativeConservation(uint96 amount) public {
        amount=uint96(bound(amount,1,10 ether));bytes32 id=funded(address(0),amount,worker);
        vm.prank(worker);escrow.accept(id);vm.prank(funder);escrow.allocate(id,outcome);vm.prank(worker);escrow.settle(id);
        assertEq(worker.balance,amount);assertEq(funder.balance+worker.balance,100 ether);assertEq(escrow.liability(address(0)),0);
    }
    function testFuzzUSDCConservation(uint96 amount) public {
        amount=uint96(bound(amount,1,1000e6));bytes32 id=funded(USDC,amount,worker);
        vm.prank(worker);escrow.accept(id);vm.prank(funder);escrow.allocate(id,outcome);vm.prank(worker);escrow.settle(id);
        assertEq(WorkFixtureUSDC(USDC).balanceOf(worker),amount);assertEq(WorkFixtureUSDC(USDC).balanceOf(funder)+WorkFixtureUSDC(USDC).balanceOf(worker),1000e6);assertEq(escrow.liability(USDC),0);
    }
    function testNoAuthorityOverUnrelatedSurplusOrUnknownWork() public {
        bytes32 id=funded(address(0),1 ether,worker);vm.deal(address(escrow),10 ether);
        vm.prank(worker);escrow.accept(id);vm.prank(funder);escrow.allocate(id,outcome);vm.prank(worker);escrow.settle(id);
        assertEq(worker.balance,1 ether);assertEq(address(escrow).balance,9 ether);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowV2.Unauthorized.selector);escrow.recover(keccak256("unrelated"));
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowV2.Unauthorized.selector);escrow.settle(id);
    }
}


