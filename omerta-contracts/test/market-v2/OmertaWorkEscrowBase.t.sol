// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {OmertaWorkEscrowBase} from "../../src/market-v2/OmertaWorkEscrowBase.sol";

contract BaseWorkFixtureUSDC is ERC20 {
    constructor() ERC20("Fixture only", "FIXTURE") {}
    function mint(address to, uint256 n) external { _mint(to, n); }
    function decimals() public pure override returns(uint8) { return 6; }
}
contract BaseRejectWorkRecipient {
    function accept(OmertaWorkEscrowBase e, bytes32 id) external { e.accept(id); }
    function settle(OmertaWorkEscrowBase e, bytes32 id) external { e.settle(id); }
    receive() external payable { revert(); }
}
contract BaseFeeWorkToken is ERC20 {
    bool public fee;
    constructor() ERC20("Fee fixture", "FEE") {}
    function setFee(bool on) external { fee=on; }
    function _update(address from,address to,uint256 amount) internal override {
        if(fee && from!=address(0) && to!=address(0)){super._update(from,to,amount-1);super._update(from,address(0),1);}
        else super._update(from,to,amount);
    }
}
contract BaseReenterWorkRecipient {
    OmertaWorkEscrowBase escrow;
    bytes32 id;
    bool public refused;
    function accept(OmertaWorkEscrowBase e,bytes32 source) external {escrow=e;id=source;e.accept(source);}
    function settle() external {escrow.settle(id);}
    receive() external payable {(bool ok,)=address(escrow).call(abi.encodeCall(escrow.settle,(id)));refused=!ok;}
}
contract OmertaWorkEscrowBaseTest is Test {
    OmertaWorkEscrowBase escrow;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address funder = address(0xF1);
    address worker = address(0xB1);
    bytes32 workHash = keccak256("fixture canonical work identity");
    bytes32 outcome = keccak256("fixture outcome; not production gameplay proof");
    function setUp() public {
        vm.chainId(8453);
        BaseWorkFixtureUSDC token = new BaseWorkFixtureUSDC();
        // Honest isolated token fixture at the issuer address; no fork/deployment/backing claim.
        vm.etch(USDC, address(token).code);
        BaseWorkFixtureUSDC(USDC).mint(funder, 1000e6);
        vm.deal(funder, 100 ether);
        escrow = new OmertaWorkEscrowBase();
        vm.prank(funder); BaseWorkFixtureUSDC(USDC).approve(address(escrow), type(uint256).max);
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
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector);escrow.recover(id);
        vm.prank(worker);escrow.settle(id);
        assertEq(worker.balance,1 ether);assertEq(escrow.liability(address(0)),0);
        assertEq(uint256(escrow.work(id).state),uint256(OmertaWorkEscrowBase.State.Settled));
        vm.prank(worker);vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector);escrow.settle(id);
    }
    function testUSDCAllocationAndActualPayout() public {
        bytes32 id=funded(USDC,125e6,worker);
        assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(address(escrow)),125e6);
        vm.prank(worker);escrow.accept(id);vm.prank(funder);escrow.allocate(id,outcome);vm.prank(worker);escrow.settle(id);
        assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(worker),125e6);assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(funder),875e6);
        assertEq(escrow.liability(USDC),0);
    }
    function testUnusedRecoveryOriginalOnlyAndReplay() public {
        bytes32 id=funded(USDC,10e6,worker);vm.prank(worker);escrow.accept(id);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector);escrow.recover(id);
        vm.warp(block.timestamp+120);
        vm.prank(address(0x999));vm.expectRevert(OmertaWorkEscrowBase.Unauthorized.selector);escrow.recover(id);
        vm.prank(funder);escrow.recover(id);assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(funder),1000e6);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector);escrow.recover(id);
        uint64 later=escrow.work(id).deadline+120;
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector);escrow.fund(1,worker,USDC,10e6,workHash,later);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector);escrow.fund(2,worker,USDC,10e6,workHash,later);
    }
    function testWrongPartiesAssetAndExpiredAdmission() public {
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);escrow.fund(1,worker,address(0x999),100,workHash,uint64(block.timestamp+120));
        bytes32 id=funded(address(0),1 ether,worker);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowBase.Unauthorized.selector);escrow.accept(id);
        vm.prank(worker);vm.expectRevert(OmertaWorkEscrowBase.Unauthorized.selector);escrow.allocate(id,outcome);
        vm.prank(worker);escrow.accept(id);vm.warp(block.timestamp+120);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector);escrow.allocate(id,outcome);
    }
    function testRejectedRecipientRetainsAllocatedLiability() public {
        BaseRejectWorkRecipient rejector=new BaseRejectWorkRecipient();bytes32 id=funded(address(0),1 ether,address(rejector));
        rejector.accept(escrow,id);vm.prank(funder);escrow.allocate(id,outcome);
        vm.expectRevert(OmertaWorkEscrowBase.TransferFailed.selector);rejector.settle(escrow,id);
        assertEq(escrow.liability(address(0)),1 ether);assertEq(address(escrow).balance,1 ether);
        assertEq(uint256(escrow.work(id).state),uint256(OmertaWorkEscrowBase.State.Allocated));
    }
    function testReentrancyCannotSettleTwice() public {
        BaseReenterWorkRecipient receiver=new BaseReenterWorkRecipient();bytes32 id=funded(address(0),1 ether,address(receiver));
        receiver.accept(escrow,id);vm.prank(funder);escrow.allocate(id,outcome);receiver.settle();
        assertTrue(receiver.refused());assertEq(address(receiver).balance,1 ether);assertEq(escrow.liability(address(0)),0);
    }
    function testTokenIncomingAndOutgoingDeltaFailClosed() public {
        BaseFeeWorkToken token=new BaseFeeWorkToken();vm.etch(USDC,address(token).code);BaseFeeWorkToken(USDC).setFee(true);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowBase.TransferFailed.selector);escrow.fund(1,worker,USDC,100,workHash,uint64(block.timestamp+120));
        assertFalse(escrow.usedNonce(funder,1));assertEq(escrow.liability(USDC),0);assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(funder),1000e6);
        BaseFeeWorkToken(USDC).setFee(false);bytes32 id=funded(USDC,100,worker);
        vm.prank(worker);escrow.accept(id);vm.prank(funder);escrow.allocate(id,outcome);BaseFeeWorkToken(USDC).setFee(true);
        vm.prank(worker);vm.expectRevert(OmertaWorkEscrowBase.TransferFailed.selector);escrow.settle(id);
        assertEq(escrow.liability(USDC),100);assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(address(escrow)),100);assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(worker),0);
    }
    function testFuzzNativeConservation(uint96 amount) public {
        amount=uint96(bound(amount,1,10 ether));bytes32 id=funded(address(0),amount,worker);
        vm.prank(worker);escrow.accept(id);vm.prank(funder);escrow.allocate(id,outcome);vm.prank(worker);escrow.settle(id);
        assertEq(worker.balance,amount);assertEq(funder.balance+worker.balance,100 ether);assertEq(escrow.liability(address(0)),0);
    }
    function testFuzzUSDCConservation(uint96 amount) public {
        amount=uint96(bound(amount,1,1000e6));bytes32 id=funded(USDC,amount,worker);
        vm.prank(worker);escrow.accept(id);vm.prank(funder);escrow.allocate(id,outcome);vm.prank(worker);escrow.settle(id);
        assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(worker),amount);assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(funder)+BaseWorkFixtureUSDC(USDC).balanceOf(worker),1000e6);assertEq(escrow.liability(USDC),0);
    }
    function testNoAuthorityOverUnrelatedSurplusOrUnknownWork() public {
        bytes32 id=funded(address(0),1 ether,worker);vm.deal(address(escrow),10 ether);
        vm.prank(worker);escrow.accept(id);vm.prank(funder);escrow.allocate(id,outcome);vm.prank(worker);escrow.settle(id);
        assertEq(worker.balance,1 ether);assertEq(address(escrow).balance,9 ether);
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowBase.Unauthorized.selector);escrow.recover(keccak256("unrelated"));
        vm.prank(funder);vm.expectRevert(OmertaWorkEscrowBase.Unauthorized.selector);escrow.settle(id);
    }
    function testConstructorRejectsEveryOtherChain() public {
        uint256[4] memory wrong = [uint256(1), 84532, 4663, 31337];
        for (uint256 i; i < wrong.length; i++) {
            vm.chainId(wrong[i]);
            vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);
            new OmertaWorkEscrowBase();
        }
    }
    function testConstructorRejectsAbsentCanonicalTokenCode() public {
        vm.etch(USDC, hex"");
        vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);
        new OmertaWorkEscrowBase();
    }
    function testOnlyBaseNativeUSDCAndExactNativeValue() public {
        uint64 deadline = uint64(block.timestamp + 120);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);
        escrow.fund(1, worker, 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48, 100, workHash, deadline);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);
        escrow.fund{value: 99}(1, worker, address(0), 100, workHash, deadline);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);
        escrow.fund{value: 101}(1, worker, address(0), 100, workHash, deadline);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);
        escrow.fund{value: 1}(1, worker, USDC, 100, workHash, deadline);
        assertFalse(escrow.usedNonce(funder, 1));
        assertFalse(escrow.usedWork(keccak256(abi.encode(funder, workHash))));
        assertEq(escrow.liability(address(0)), 0); assertEq(escrow.liability(USDC), 0);
        assertEq(funder.balance, 100 ether); assertEq(address(escrow).balance, 0);
    }
    function testExactTermBoundsAndZeroTerms() public {
        assertEq(escrow.MAX_TERM(), 24 hours);
        uint64 early = uint64(block.timestamp + 59);
        uint64 late = uint64(block.timestamp + 24 hours + 1);
        uint64 valid = uint64(block.timestamp + 120);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);
        escrow.fund(1, worker, address(0), 1, workHash, early);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);
        escrow.fund(1, worker, address(0), 1, workHash, late);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);
        escrow.fund(1, address(0), address(0), 1, workHash, valid);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);
        escrow.fund(1, funder, address(0), 1, workHash, valid);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);
        escrow.fund(1, worker, address(0), 0, workHash, valid);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);
        escrow.fund(1, worker, address(0), 1, bytes32(0), valid);
        vm.prank(funder); escrow.fund{value: 1}(1, worker, address(0), 1, workHash, uint64(block.timestamp + 60));
        vm.prank(funder); escrow.fund{value: 1}(2, worker, address(0), 1, keccak256("max term"), uint64(block.timestamp + 24 hours));
        assertEq(escrow.liability(address(0)), 2);
    }
    function testIdentifierBindsBaseContractAndOriginalFunder() public {
        bytes32 id = funded(address(0), 1 ether, worker);
        assertEq(id, keccak256(abi.encode(uint256(8453), address(escrow), funder, uint256(1))));
        assertTrue(id != keccak256(abi.encode(uint256(1), address(escrow), funder, uint256(1))));
        address other = address(0xF2); vm.deal(other, 1 ether);
        vm.prank(other);
        bytes32 second = escrow.fund{value: 1 ether}(1, worker, address(0), 1 ether, workHash, uint64(block.timestamp + 120));
        assertTrue(id != second);
        OmertaWorkEscrowBase separate = new OmertaWorkEscrowBase();
        vm.prank(funder);
        bytes32 third = separate.fund{value: 1 ether}(1, worker, address(0), 1 ether, workHash, uint64(block.timestamp + 120));
        assertTrue(id != third);
    }
    function testUSDCAllocatedEntitlementSurvivesDeadline() public {
        bytes32 id = funded(USDC, 100, worker);
        vm.prank(worker); vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector); escrow.settle(id);
        vm.prank(worker); escrow.accept(id);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector); escrow.allocate(id, bytes32(0));
        vm.prank(funder); escrow.allocate(id, outcome);
        uint64 deadline = escrow.work(id).deadline;
        vm.warp(uint256(deadline) + 1 days);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector); escrow.recover(id);
        vm.prank(worker); escrow.settle(id);
        assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(worker), 100);
        assertEq(escrow.liability(USDC), 0);
    }
    function testUSDCRefundDeltaFailureIsAtomicAndRetryable() public {
        BaseFeeWorkToken token = new BaseFeeWorkToken(); vm.etch(USDC, address(token).code);
        bytes32 id = funded(USDC, 100, worker);
        uint64 deadline = escrow.work(id).deadline; vm.warp(deadline);
        BaseFeeWorkToken(USDC).setFee(true);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.TransferFailed.selector); escrow.recover(id);
        assertEq(uint256(escrow.work(id).state), uint256(OmertaWorkEscrowBase.State.Funded));
        assertEq(escrow.liability(USDC), 100);
        assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(address(escrow)), 100);
        assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(funder), 1000e6 - 100);
        BaseFeeWorkToken(USDC).setFee(false);
        vm.prank(funder); escrow.recover(id);
        assertEq(escrow.liability(USDC), 0);
        assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(funder), 1000e6);
    }


    function testNativeLongWorkAfterOldCeilingAndLateSettlement() public {
        uint256 started = vm.getBlockTimestamp();
        uint64 deadline = uint64(started + 24 hours);
        vm.prank(funder);
        bytes32 id = escrow.fund{value: 1 ether}(1, worker, address(0), 1 ether, workHash, deadline);
        vm.warp(started + 2 hours);
        assertEq(vm.getBlockTimestamp(), started + 2 hours);
        vm.prank(worker); escrow.accept(id);
        vm.warp(started + 23 hours);
        assertEq(vm.getBlockTimestamp(), uint256(deadline) - 1 hours);
        vm.prank(funder); escrow.allocate(id, outcome);
        vm.warp(uint256(deadline) + 7 days);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector); escrow.recover(id);
        vm.prank(worker); escrow.settle(id);
        assertEq(worker.balance, 1 ether);
        assertEq(escrow.liability(address(0)), 0);
        assertEq(uint256(escrow.work(id).state), uint256(OmertaWorkEscrowBase.State.Settled));
    }
    function testUSDCExactDayExpiryFundedAndAcceptedRefunds() public {
        uint64 deadline = uint64(block.timestamp + 24 hours);
        vm.prank(funder);
        bytes32 first = escrow.fund(1, worker, USDC, 100, workHash, deadline);
        vm.prank(funder);
        bytes32 second = escrow.fund(2, worker, USDC, 200, keccak256("second day work"), deadline);
        vm.warp(uint256(deadline) - 4 hours);
        vm.prank(worker); escrow.accept(second);
        vm.warp(uint256(deadline) - 1);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector); escrow.recover(first);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector); escrow.recover(second);
        vm.warp(deadline);
        vm.prank(worker); vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector); escrow.accept(first);
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidState.selector); escrow.allocate(second, outcome);
        vm.prank(worker); vm.expectRevert(OmertaWorkEscrowBase.Unauthorized.selector); escrow.recover(first);
        vm.prank(funder); escrow.recover(first);
        vm.prank(funder); escrow.recover(second);
        assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(funder), 1000e6);
        assertEq(BaseWorkFixtureUSDC(USDC).balanceOf(worker), 0);
        assertEq(escrow.liability(USDC), 0);
        assertEq(uint256(escrow.work(first).state), uint256(OmertaWorkEscrowBase.State.Refunded));
        assertEq(uint256(escrow.work(second).state), uint256(OmertaWorkEscrowBase.State.Refunded));
    }
    function testUint64DeadlineBoundaryAndWrappedDeadlineRefusal() public {
        vm.warp(uint256(type(uint64).max) - 24 hours);
        vm.prank(funder);
        bytes32 id = escrow.fund{value: 1}(1, worker, address(0), 1, workHash, type(uint64).max);
        assertEq(escrow.work(id).deadline, type(uint64).max);
        vm.warp(uint256(type(uint64).max) - 30);
        uint64 wrapped = uint64(block.timestamp + 60);
        bytes32 otherWork = keccak256("wrapped deadline must not fund");
        vm.prank(funder); vm.expectRevert(OmertaWorkEscrowBase.InvalidTerms.selector);
        escrow.fund{value: 1}(2, worker, address(0), 1, otherWork, wrapped);
        assertFalse(escrow.usedNonce(funder, 2));
        assertFalse(escrow.usedWork(keccak256(abi.encode(funder, otherWork))));
        assertEq(escrow.liability(address(0)), 1);
        assertEq(address(escrow).balance, 1);
        vm.warp(type(uint64).max);
        vm.prank(funder); escrow.recover(id);
        assertEq(funder.balance, 100 ether);
    }
    function testTimestampArithmeticOverflowRevertsBeforeFunding() public {
        vm.warp(type(uint256).max - 59);
        vm.prank(funder); vm.expectRevert(abi.encodeWithSignature("Panic(uint256)", 0x11));
        escrow.fund{value: 1}(1, worker, address(0), 1, workHash, type(uint64).max);
        assertFalse(escrow.usedNonce(funder, 1));
        assertFalse(escrow.usedWork(keccak256(abi.encode(funder, workHash))));
        assertEq(escrow.liability(address(0)), 0);
        assertEq(address(escrow).balance, 0);
        assertEq(funder.balance, 100 ether);
    }
    function testFuzzLongTermStrictAllocationAndSettlement(uint32 seed) public {
        uint256 term = bound(uint256(seed), 901, 24 hours);
        uint64 deadline = uint64(block.timestamp + term);
        vm.prank(funder);
        bytes32 id = escrow.fund{value: 1}(1, worker, address(0), 1, workHash, deadline);
        vm.warp(uint256(deadline) - 1);
        vm.prank(worker); escrow.accept(id);
        vm.prank(funder); escrow.allocate(id, outcome);
        vm.warp(uint256(deadline) + 1 days);
        vm.prank(worker); escrow.settle(id);
        assertEq(worker.balance, 1);
        assertEq(escrow.liability(address(0)), 0);
        assertEq(uint256(escrow.work(id).state), uint256(OmertaWorkEscrowBase.State.Settled));
    }

}



contract BaseWorkEscrowHandler is Test {
    OmertaWorkEscrowBase public immutable escrow;
    BaseWorkFixtureUSDC public immutable token;
    address[2] public funders = [address(0xC1), address(0xC2)];
    address[2] public payees = [address(0xD1), address(0xD2)];
    bytes32[] public ids;
    uint256 private nonce;
    constructor(OmertaWorkEscrowBase source, BaseWorkFixtureUSDC asset) {
        escrow = source; token = asset;
        for (uint256 i; i < 2; i++) {
            vm.deal(funders[i], 100 ether); vm.deal(payees[i], 0);
            token.mint(funders[i], 1000e6);
            vm.prank(funders[i]); token.approve(address(escrow), type(uint256).max);
        }
    }
    function count() external view returns (uint256) { return ids.length; }
    function fund(uint96 seed, bool usdc, uint8 actorSeed) external {
        address original = funders[actorSeed % 2];
        uint256 available = usdc ? token.balanceOf(original) : original.balance;
        if (available == 0) return;
        uint256 amount = bound(uint256(seed), 1, available);
        uint256 next = ++nonce;
        bytes32 workHash = keccak256(abi.encode("stateful fixture", original, next));
        address asset = usdc ? address(token) : address(0);
        vm.prank(original);
        bytes32 id = escrow.fund{value: usdc ? 0 : amount}(next, payees[actorSeed % 2], asset, amount, workHash,
            uint64(block.timestamp + 60 + uint256(seed) % 86341));
        ids.push(id);
    }
    function accept(uint256 seed) external {
        if (ids.length == 0) return;
        bytes32 id = ids[seed % ids.length]; OmertaWorkEscrowBase.Work memory w = escrow.work(id);
        if (w.state != OmertaWorkEscrowBase.State.Funded || block.timestamp >= w.deadline) return;
        vm.prank(w.payee); escrow.accept(id);
    }
    function allocate(uint256 seed) external {
        if (ids.length == 0) return;
        bytes32 id = ids[seed % ids.length]; OmertaWorkEscrowBase.Work memory w = escrow.work(id);
        if (w.state != OmertaWorkEscrowBase.State.Accepted || block.timestamp >= w.deadline) return;
        vm.prank(w.funder); escrow.allocate(id, keccak256(abi.encode("fixture outcome", id)));
    }
    function settle(uint256 seed) external {
        if (ids.length == 0) return;
        bytes32 id = ids[seed % ids.length]; OmertaWorkEscrowBase.Work memory w = escrow.work(id);
        if (w.state != OmertaWorkEscrowBase.State.Allocated) return;
        vm.prank(w.payee); escrow.settle(id);
    }
    function recover(uint256 seed) external {
        if (ids.length == 0) return;
        bytes32 id = ids[seed % ids.length]; OmertaWorkEscrowBase.Work memory w = escrow.work(id);
        if ((w.state != OmertaWorkEscrowBase.State.Funded && w.state != OmertaWorkEscrowBase.State.Accepted)
            || block.timestamp < w.deadline) return;
        vm.prank(w.funder); escrow.recover(id);
    }
    function elapse(uint32 seed) external { vm.warp(block.timestamp + bound(uint256(seed), 0, 86401)); }
}

contract OmertaWorkEscrowBaseInvariantTest is StdInvariant, Test {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    OmertaWorkEscrowBase escrow;
    BaseWorkEscrowHandler handler;
    function setUp() public {
        vm.chainId(8453);
        BaseWorkFixtureUSDC token = new BaseWorkFixtureUSDC(); vm.etch(USDC, address(token).code);
        escrow = new OmertaWorkEscrowBase();
        handler = new BaseWorkEscrowHandler(escrow, BaseWorkFixtureUSDC(USDC));
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = handler.fund.selector; selectors[1] = handler.accept.selector;
        selectors[2] = handler.allocate.selector; selectors[3] = handler.settle.selector;
        selectors[4] = handler.recover.selector; selectors[5] = handler.elapse.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }
    function invariant_LiabilitiesEqualEveryUnpaidWork() public view {
        uint256 nativeLiability; uint256 tokenLiability;
        for (uint256 i; i < handler.count(); i++) {
            OmertaWorkEscrowBase.Work memory w = escrow.work(handler.ids(i));
            if (w.state == OmertaWorkEscrowBase.State.Funded || w.state == OmertaWorkEscrowBase.State.Accepted
                || w.state == OmertaWorkEscrowBase.State.Allocated) {
                if (w.asset == address(0)) nativeLiability += w.amount; else tokenLiability += w.amount;
            }
            assertTrue(escrow.usedNonce(w.funder, _nonceFromWork(i)));
            assertTrue(escrow.usedWork(keccak256(abi.encode(w.funder, w.workHash))));
        }
        assertEq(escrow.liability(address(0)), nativeLiability);
        assertEq(escrow.liability(USDC), tokenLiability);
        assertGe(address(escrow).balance, nativeLiability);
        assertGe(BaseWorkFixtureUSDC(USDC).balanceOf(address(escrow)), tokenLiability);
    }
    function _nonceFromWork(uint256 index) private pure returns (uint256) { return index + 1; }
    function invariant_NativeConservation() public view {
        uint256 total = address(escrow).balance;
        for (uint256 i; i < 2; i++) total += handler.funders(i).balance + handler.payees(i).balance;
        assertEq(total, 200 ether);
    }
    function invariant_USDCConservation() public view {
        BaseWorkFixtureUSDC token = BaseWorkFixtureUSDC(USDC);
        uint256 total = token.balanceOf(address(escrow));
        for (uint256 i; i < 2; i++) total += token.balanceOf(handler.funders(i)) + token.balanceOf(handler.payees(i));
        assertEq(total, 2000e6);
    }
}
