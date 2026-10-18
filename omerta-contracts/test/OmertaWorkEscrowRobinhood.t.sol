// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OmertaWorkEscrowRobinhood} from "../src/market-v2/OmertaWorkEscrowRobinhood.sol";

// Isolated mocked4663/USDG only. No fork, real issuer token, signatures or live funding proof.
contract RobinhoodWorkFixtureUSDG is ERC20 {
    uint8 public feeMode;
    bool public blocked;
    bool public falseReturn;
    address public callbackTarget;
    bytes public callbackData;
    bool private calling;
    bool public callbackSucceeded;
    bytes4 public callbackError;
    error FixtureBlocked();
    constructor() ERC20("Fixture USDG only", "FIXTURE") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function setFee(uint8 mode) external { feeMode = mode; }
    function setBlocked(bool value) external { blocked = value; }
    function setFalseReturn(bool value) external { falseReturn = value; }
    function setCallback(address target, bytes calldata data) external { callbackTarget = target; callbackData = data; }
    function transfer(address to, uint256 amount) public override returns (bool) {
        if (falseReturn) return false;
        return super.transfer(to, amount);
    }
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (falseReturn) return false;
        return super.transferFrom(from, to, amount);
    }
    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0)) {
            if (blocked) revert FixtureBlocked();
            if (feeMode == 1) {
                super._update(from, to, amount - 1);
                super._update(from, address(0), 1);
            } else {
                super._update(from, to, amount);
                if (feeMode == 2) super._update(from, address(0), 1);
            }
            if (callbackTarget != address(0) && !calling) {
                calling = true;
                (bool ok, bytes memory result) = callbackTarget.call(callbackData);
                callbackSucceeded = ok;
                callbackError = result.length >= 4 ? bytes4(result) : bytes4(0);
                calling = false;
            }
        } else super._update(from, to, amount);
    }
}

contract OmertaWorkEscrowRobinhoodTest is Test {
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant FUNDER = address(0xF1);
    address constant PAYEE = address(0xB1);
    address constant OTHER = address(0x999);
    bytes32 constant WORK = keccak256("fixture work, not canonical live work");
    bytes32 constant OUTCOME = keccak256("fixture outcome, not a game oracle");
    OmertaWorkEscrowRobinhood escrow;
    RobinhoodWorkFixtureUSDG token;
    function setUp() public {
        vm.chainId(4663);
        RobinhoodWorkFixtureUSDG implementation = new RobinhoodWorkFixtureUSDG();
        vm.etch(USDG, address(implementation).code);
        token = RobinhoodWorkFixtureUSDG(USDG);
        token.mint(FUNDER, 1000e6);
        vm.deal(FUNDER, 100 ether);
        escrow = new OmertaWorkEscrowRobinhood();
        vm.prank(FUNDER); token.approve(address(escrow), 1000e6);
    }
    function funded(uint256 amount) private returns (bytes32) {
        vm.prank(FUNDER);
        return escrow.fund(1, PAYEE, USDG, amount, WORK, uint64(vm.getBlockTimestamp() + 120));
    }
    function allocated(uint256 amount) private returns (bytes32 id) {
        id = funded(amount);
        vm.prank(PAYEE); escrow.accept(id);
        vm.prank(FUNDER); escrow.allocate(id, OUTCOME);
    }
    function assertUnused(uint256 nonce, bytes32 workHash) private view {
        assertFalse(escrow.usedNonce(FUNDER, nonce));
        assertFalse(escrow.usedWork(keccak256(abi.encode(FUNDER, workHash))));
        assertEq(escrow.liability(USDG), 0);
    }
    function testUSDGLifecycleAndImmutableTerms() public {
        bytes32 id = allocated(125e6);
        OmertaWorkEscrowRobinhood.Work memory before = escrow.work(id);
        assertEq(before.funder, FUNDER); assertEq(before.payee, PAYEE); assertEq(before.asset, USDG);
        assertEq(before.amount, 125e6); assertEq(before.workHash, WORK); assertEq(before.outcomeHash, OUTCOME);
        assertEq(escrow.liability(USDG), 125e6); assertEq(token.balanceOf(address(escrow)), 125e6);
        vm.prank(PAYEE); escrow.settle(id);
        OmertaWorkEscrowRobinhood.Work memory afterWork = escrow.work(id);
        before.state = OmertaWorkEscrowRobinhood.State.Settled;
        assertEq(abi.encode(afterWork), abi.encode(before));
        assertEq(token.balanceOf(PAYEE), 125e6); assertEq(token.balanceOf(FUNDER), 875e6);
        assertEq(escrow.liability(USDG), 0); assertEq(token.balanceOf(address(escrow)), 0);
    }
    function testWrongChainConstructorRefusals() public {
        uint256[5] memory wrong = [uint256(1), 8453, 46630, 11155111, 31337];
        for (uint256 i; i < wrong.length; i++) {
            vm.chainId(wrong[i]);
            vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidTerms.selector);
            new OmertaWorkEscrowRobinhood();
        }
    }
    function testMissingCanonicalTokenCodeRefusesConstructor() public {
        vm.etch(USDG, hex"");
        vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidTerms.selector);
        new OmertaWorkEscrowRobinhood();
    }
    function testOnlyCanonicalUSDGAsset() public {
        address[4] memory wrong = [address(0), address(0x999),
            0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48];
        for (uint256 i; i < wrong.length; i++) {
            vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidTerms.selector);
            escrow.fund(1, PAYEE, wrong[i], 100, WORK, uint64(vm.getBlockTimestamp() + 120));
            assertUnused(1, WORK);
        }
    }
    function testNativeValueAndDirectETHRefuseWithoutConsumingIdentity() public {
        uint64 deadline = uint64(vm.getBlockTimestamp() + 120);
        vm.prank(FUNDER);
        (bool fundedETH,) = address(escrow).call{value: 1}(abi.encodeCall(escrow.fund, (1, PAYEE, USDG, 100, WORK, deadline)));
        assertFalse(fundedETH); assertUnused(1, WORK);
        vm.prank(FUNDER); (bool sent,) = address(escrow).call{value: 1}("");
        assertFalse(sent); assertEq(address(escrow).balance, 0); assertEq(FUNDER.balance, 100 ether);
        assertEq(token.balanceOf(FUNDER), 1000e6);
    }
    function testZeroTermsAndExactTermBounds() public {
        uint256 nowTime = vm.getBlockTimestamp();
        assertEq(escrow.MAX_TERM(), 24 hours);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidTerms.selector);
        escrow.fund(1, PAYEE, USDG, 1, WORK, uint64(nowTime + 59));
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidTerms.selector);
        escrow.fund(1, PAYEE, USDG, 1, WORK, uint64(nowTime + 24 hours + 1));
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidTerms.selector);
        escrow.fund(1, address(0), USDG, 1, WORK, uint64(nowTime + 120));
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidTerms.selector);
        escrow.fund(1, FUNDER, USDG, 1, WORK, uint64(nowTime + 120));
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidTerms.selector);
        escrow.fund(1, PAYEE, USDG, 0, WORK, uint64(nowTime + 120));
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidTerms.selector);
        escrow.fund(1, PAYEE, USDG, 1, bytes32(0), uint64(nowTime + 120));
        assertUnused(1, WORK);
        vm.prank(FUNDER); escrow.fund(1, PAYEE, USDG, 1, WORK, uint64(nowTime + 60));
        vm.prank(FUNDER); escrow.fund(2, PAYEE, USDG, 1, keccak256("max-term"), uint64(nowTime + 24 hours));
        assertEq(escrow.liability(USDG), 2);
    }
    function testIdentitySeparatesChainContractAndFunder() public {
        bytes32 id = funded(10);
        assertEq(id, keccak256(abi.encode(uint256(4663), address(escrow), FUNDER, uint256(1))));
        assertTrue(id != keccak256(abi.encode(uint256(8453), address(escrow), FUNDER, uint256(1))));
        token.mint(OTHER, 10); vm.startPrank(OTHER); token.approve(address(escrow), 10);
        bytes32 otherId = escrow.fund(1, PAYEE, USDG, 10, WORK, uint64(vm.getBlockTimestamp() + 120)); vm.stopPrank();
        assertTrue(id != otherId);
        OmertaWorkEscrowRobinhood separate = new OmertaWorkEscrowRobinhood();
        vm.startPrank(FUNDER); token.approve(address(separate), 10);
        bytes32 separateId = separate.fund(1, PAYEE, USDG, 10, WORK, uint64(vm.getBlockTimestamp() + 120)); vm.stopPrank();
        assertTrue(id != separateId);
    }
    function testRolesAndTransitionOrder() public {
        bytes32 id = funded(100);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.Unauthorized.selector); escrow.accept(id);
        vm.prank(OTHER); vm.expectRevert(OmertaWorkEscrowRobinhood.Unauthorized.selector); escrow.allocate(id, OUTCOME);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidState.selector); escrow.allocate(id, OUTCOME);
        vm.prank(PAYEE); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidState.selector); escrow.settle(id);
        vm.prank(PAYEE); escrow.accept(id);
        vm.prank(PAYEE); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidState.selector); escrow.accept(id);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidState.selector); escrow.allocate(id, bytes32(0));
        vm.prank(FUNDER); escrow.allocate(id, OUTCOME);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidState.selector); escrow.allocate(id, OUTCOME);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.Unauthorized.selector); escrow.settle(id);
        vm.prank(OTHER); vm.expectRevert(OmertaWorkEscrowRobinhood.Unauthorized.selector); escrow.recover(id);
        vm.prank(PAYEE); escrow.settle(id);
        vm.prank(PAYEE); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidState.selector); escrow.settle(id);
    }
    function testFundedAndAcceptedExactDeadlineRecovery() public {
        uint64 deadline = uint64(vm.getBlockTimestamp() + 24 hours);
        vm.prank(FUNDER); bytes32 first = escrow.fund(1, PAYEE, USDG, 100, WORK, deadline);
        vm.prank(FUNDER); bytes32 second = escrow.fund(2, PAYEE, USDG, 200, keccak256("second"), deadline);
        vm.prank(PAYEE); escrow.accept(second);
        vm.warp(uint256(deadline) - 1);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidState.selector); escrow.recover(first);
        vm.warp(deadline);
        vm.prank(PAYEE); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidState.selector); escrow.accept(first);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidState.selector); escrow.allocate(second, OUTCOME);
        vm.prank(PAYEE); vm.expectRevert(OmertaWorkEscrowRobinhood.Unauthorized.selector); escrow.recover(second);
        vm.prank(FUNDER); escrow.recover(first);
        vm.prank(FUNDER); escrow.recover(second);
        assertEq(token.balanceOf(FUNDER), 1000e6); assertEq(token.balanceOf(PAYEE), 0); assertEq(escrow.liability(USDG), 0);
    }
    function testAllocatedEntitlementSurvivesExpiryAndCannotBeRecovered() public {
        bytes32 id = allocated(100);
        vm.warp(uint256(escrow.work(id).deadline) + 7 days);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidState.selector); escrow.recover(id);
        vm.prank(PAYEE); escrow.settle(id);
        assertEq(token.balanceOf(PAYEE), 100); assertEq(escrow.liability(USDG), 0);
    }
    function testReplayStaysConsumedAfterSettlementAndRefund() public {
        bytes32 id = allocated(100); vm.prank(PAYEE); escrow.settle(id);
        uint64 deadline = uint64(vm.getBlockTimestamp() + 120); bytes32 secondWork = keccak256("refunded job");
        vm.prank(FUNDER); bytes32 second = escrow.fund(2, PAYEE, USDG, 100, secondWork, deadline);
        vm.warp(deadline); vm.prank(FUNDER); escrow.recover(second);
        uint64 fresh = uint64(vm.getBlockTimestamp() + 120);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidState.selector);
        escrow.fund(1, PAYEE, USDG, 100, keccak256("fresh job"), fresh);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidState.selector);
        escrow.fund(3, PAYEE, USDG, 100, WORK, fresh);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidState.selector);
        escrow.fund(3, PAYEE, USDG, 100, secondWork, fresh);
        assertTrue(escrow.usedNonce(FUNDER, 1)); assertTrue(escrow.usedNonce(FUNDER, 2));
        assertTrue(escrow.usedWork(keccak256(abi.encode(FUNDER, WORK))));
        assertTrue(escrow.usedWork(keccak256(abi.encode(FUNDER, secondWork))));
    }
    function testInsufficientBalanceAndAllowanceRollback() public {
        vm.prank(FUNDER); token.approve(address(escrow), 0);
        vm.prank(FUNDER); vm.expectRevert(); escrow.fund(1, PAYEE, USDG, 100, WORK, uint64(vm.getBlockTimestamp() + 120));
        assertUnused(1, WORK);
        vm.prank(OTHER); token.approve(address(escrow), 100);
        vm.prank(OTHER); vm.expectRevert(); escrow.fund(1, PAYEE, USDG, 100, WORK, uint64(vm.getBlockTimestamp() + 120));
        assertFalse(escrow.usedNonce(OTHER, 1)); assertEq(token.balanceOf(address(escrow)), 0);
    }
    function testIncomingShortTransferRollsBackEveryEffect() public {
        token.setFee(1);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.TransferFailed.selector);
        escrow.fund(1, PAYEE, USDG, 100, WORK, uint64(vm.getBlockTimestamp() + 120));
        assertUnused(1, WORK); assertEq(token.balanceOf(FUNDER), 1000e6);
        assertEq(token.balanceOf(address(escrow)), 0); assertEq(token.totalSupply(), 1000e6);
    }
    function testIncomingExtraDebitRollsBackAndPreservesRetryIdentity() public {
        uint64 deadline = uint64(vm.getBlockTimestamp() + 120);
        uint256 allowance = token.allowance(FUNDER, address(escrow));
        bytes32 id = keccak256(abi.encode(uint256(4663), address(escrow), FUNDER, uint256(1)));
        token.setFee(2);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.TransferFailed.selector);
        escrow.fund(1, PAYEE, USDG, 100, WORK, deadline);
        assertUnused(1, WORK);
        assertEq(uint256(escrow.work(id).state), uint256(OmertaWorkEscrowRobinhood.State.Empty));
        assertEq(token.balanceOf(FUNDER), 1000e6); assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(token.balanceOf(PAYEE), 0); assertEq(token.totalSupply(), 1000e6);
        assertEq(token.allowance(FUNDER, address(escrow)), allowance);
        token.setFee(0);
        vm.prank(FUNDER); assertEq(escrow.fund(1, PAYEE, USDG, 100, WORK, deadline), id);
        assertTrue(escrow.usedNonce(FUNDER, 1)); assertTrue(escrow.usedWork(keccak256(abi.encode(FUNDER, WORK))));
        assertEq(uint256(escrow.work(id).state), uint256(OmertaWorkEscrowRobinhood.State.Funded));
        assertEq(escrow.liability(USDG), 100); assertEq(token.balanceOf(address(escrow)), 100);
        assertEq(token.balanceOf(FUNDER), 1000e6 - 100); assertEq(token.totalSupply(), 1000e6);
        assertEq(token.allowance(FUNDER, address(escrow)), allowance - 100);
    }
    function testOutgoingShortRecipientPreservesAllocatedClaim() public {
        bytes32 id = allocated(100); token.setFee(1);
        vm.prank(PAYEE); vm.expectRevert(OmertaWorkEscrowRobinhood.TransferFailed.selector); escrow.settle(id);
        assertEq(uint256(escrow.work(id).state), uint256(OmertaWorkEscrowRobinhood.State.Allocated));
        assertEq(escrow.liability(USDG), 100); assertEq(token.balanceOf(address(escrow)), 100); assertEq(token.balanceOf(PAYEE), 0);
        token.setFee(0); vm.prank(PAYEE); escrow.settle(id); assertEq(token.balanceOf(PAYEE), 100);
    }
    function testOutgoingExtraDebitCannotConsumeUnrelatedSurplus() public {
        bytes32 id = allocated(100); token.mint(address(escrow), 1); token.setFee(2);
        vm.prank(PAYEE); vm.expectRevert(OmertaWorkEscrowRobinhood.TransferFailed.selector); escrow.settle(id);
        assertEq(token.balanceOf(address(escrow)), 101); assertEq(escrow.liability(USDG), 100); assertEq(token.balanceOf(PAYEE), 0);
        token.setFee(0); vm.prank(PAYEE); escrow.settle(id); assertEq(token.balanceOf(address(escrow)), 1);
    }
    function testBlockedRefundRollbackAndRetry() public {
        bytes32 id = funded(100); vm.prank(PAYEE); escrow.accept(id);
        vm.warp(escrow.work(id).deadline); token.setBlocked(true);
        vm.prank(FUNDER); vm.expectRevert(RobinhoodWorkFixtureUSDG.FixtureBlocked.selector); escrow.recover(id);
        assertEq(uint256(escrow.work(id).state), uint256(OmertaWorkEscrowRobinhood.State.Accepted));
        assertEq(escrow.liability(USDG), 100); assertEq(token.balanceOf(address(escrow)), 100);
        token.setBlocked(false); vm.prank(FUNDER); escrow.recover(id); assertEq(token.balanceOf(FUNDER), 1000e6);
    }
    function testFalseTokenReturnsFailClosedOnFundAndSettle() public {
        token.setFalseReturn(true);
        vm.prank(FUNDER); vm.expectRevert(); escrow.fund(1, PAYEE, USDG, 100, WORK, uint64(vm.getBlockTimestamp() + 120));
        assertUnused(1, WORK); token.setFalseReturn(false);
        bytes32 id = allocated(100); token.setFalseReturn(true);
        vm.prank(PAYEE); vm.expectRevert(); escrow.settle(id);
        assertEq(uint256(escrow.work(id).state), uint256(OmertaWorkEscrowRobinhood.State.Allocated));
        assertEq(escrow.liability(USDG), 100); assertEq(token.balanceOf(PAYEE), 0);
    }
    function testTokenCallbackCannotReenterSettlement() public {
        bytes32 id = allocated(100); token.setCallback(address(escrow), abi.encodeCall(escrow.settle, (id)));
        vm.prank(PAYEE); escrow.settle(id);
        assertFalse(token.callbackSucceeded()); assertEq(token.callbackError(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(token.balanceOf(PAYEE), 100); assertEq(escrow.liability(USDG), 0);
    }
    function testTokenCallbackCannotReenterFunding() public {
        token.setCallback(address(escrow), abi.encodeCall(escrow.fund, (99, PAYEE, USDG, 1, keccak256("nested"), uint64(vm.getBlockTimestamp() + 120))));
        bytes32 id = funded(100);
        assertFalse(token.callbackSucceeded()); assertEq(token.callbackError(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(escrow.liability(USDG), 100); assertEq(escrow.work(id).amount, 100); assertFalse(escrow.usedNonce(USDG, 99));
    }
    function testUnrelatedSurplusAndForcedETHHaveNoSweepAuthority() public {
        bytes32 id = allocated(100); token.mint(address(escrow), 77); vm.deal(address(escrow), 3 ether);
        vm.prank(OTHER); (bool swept,) = address(escrow).call(abi.encodeWithSignature("sweep(address,uint256)", USDG, 77));
        assertFalse(swept); vm.prank(PAYEE); escrow.settle(id);
        assertEq(token.balanceOf(PAYEE), 100); assertEq(token.balanceOf(address(escrow)), 77);
        assertEq(address(escrow).balance, 3 ether); assertEq(escrow.liability(USDG), 0);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.Unauthorized.selector); escrow.recover(keccak256("unknown"));
    }
    function testTimestampOverflowAndWrappedDeadlineDoNotFund() public {
        vm.warp(uint256(type(uint64).max) - 30);
        uint64 wrapped = uint64(vm.getBlockTimestamp() + 60);
        vm.prank(FUNDER); vm.expectRevert(OmertaWorkEscrowRobinhood.InvalidTerms.selector);
        escrow.fund(1, PAYEE, USDG, 100, WORK, wrapped); assertUnused(1, WORK);
        vm.warp(type(uint256).max - 59);
        vm.prank(FUNDER); vm.expectRevert(abi.encodeWithSignature("Panic(uint256)", 0x11));
        escrow.fund(1, PAYEE, USDG, 100, WORK, type(uint64).max); assertUnused(1, WORK);
    }
    function testFuzzUSDGConservation(uint96 seed) public {
        uint256 amount = bound(uint256(seed), 1, 1000e6); bytes32 id = allocated(amount);
        vm.prank(PAYEE); escrow.settle(id);
        assertEq(token.balanceOf(FUNDER) + token.balanceOf(PAYEE) + token.balanceOf(address(escrow)), 1000e6);
        assertEq(token.balanceOf(PAYEE), amount); assertEq(escrow.liability(USDG), 0);
    }
    function testFuzzPendingRefundConservation(uint96 seed, bool accepted, uint32 termSeed) public {
        uint256 amount = bound(uint256(seed), 1, 1000e6); uint64 deadline = uint64(vm.getBlockTimestamp() + bound(uint256(termSeed), 60, 24 hours));
        vm.prank(FUNDER); bytes32 id = escrow.fund(1, PAYEE, USDG, amount, WORK, deadline);
        if (accepted) { vm.prank(PAYEE); escrow.accept(id); }
        vm.warp(deadline); vm.prank(FUNDER); escrow.recover(id);
        assertEq(token.balanceOf(FUNDER), 1000e6); assertEq(token.balanceOf(PAYEE), 0); assertEq(escrow.liability(USDG), 0);
    }
    function testFuzzLongTermAllocationAndLateSettlement(uint32 termSeed) public {
        uint64 deadline = uint64(vm.getBlockTimestamp() + bound(uint256(termSeed), 901, 24 hours));
        vm.prank(FUNDER); bytes32 id = escrow.fund(1, PAYEE, USDG, 100, WORK, deadline);
        vm.warp(uint256(deadline) - 1); vm.prank(PAYEE); escrow.accept(id); vm.prank(FUNDER); escrow.allocate(id, OUTCOME);
        vm.warp(uint256(deadline) + 7 days); vm.prank(PAYEE); escrow.settle(id);
        assertEq(token.balanceOf(PAYEE), 100); assertEq(escrow.liability(USDG), 0);
    }
}

contract RobinhoodWorkEscrowHandler is Test {
    OmertaWorkEscrowRobinhood public immutable escrow;
    RobinhoodWorkFixtureUSDG public immutable token;
    address[2] public funders = [address(0xC1), address(0xC2)];
    address[2] public payees = [address(0xD1), address(0xD2)];
    bytes32[] public ids;
    mapping(bytes32 => bool) public wasAllocated;
    uint256 private nonce;
    constructor(OmertaWorkEscrowRobinhood source, RobinhoodWorkFixtureUSDG asset) {
        escrow = source; token = asset;
        for (uint256 i; i < 2; i++) token.mint(funders[i], 1000e6);
    }
    function count() external view returns (uint256) { return ids.length; }
    function fund(uint96 seed, uint8 actorSeed) external {
        address original = funders[actorSeed % 2]; uint256 available = token.balanceOf(original);
        if (available == 0) return;
        uint256 amount = bound(uint256(seed), 1, available);
        uint256 next = ++nonce;
        vm.startPrank(original); token.approve(address(escrow), amount);
        bytes32 id = escrow.fund(next, payees[actorSeed % 2], address(token), amount,
            keccak256(abi.encode("isolated stateful fixture", original, next)), uint64(vm.getBlockTimestamp() + 60 + uint256(seed) % 86341));
        vm.stopPrank(); ids.push(id);
    }
    function accept(uint256 seed) external {
        if (ids.length == 0) return;
        bytes32 id = ids[seed % ids.length]; OmertaWorkEscrowRobinhood.Work memory w = escrow.work(id);
        if (w.state != OmertaWorkEscrowRobinhood.State.Funded || vm.getBlockTimestamp() >= w.deadline) return;
        vm.prank(w.payee); escrow.accept(id);
    }
    function allocate(uint256 seed) external {
        if (ids.length == 0) return;
        bytes32 id = ids[seed % ids.length]; OmertaWorkEscrowRobinhood.Work memory w = escrow.work(id);
        if (w.state != OmertaWorkEscrowRobinhood.State.Accepted || vm.getBlockTimestamp() >= w.deadline) return;
        vm.prank(w.funder); escrow.allocate(id, keccak256(abi.encode("fixture outcome", id))); wasAllocated[id] = true;
    }
    function settle(uint256 seed) external {
        if (ids.length == 0) return;
        bytes32 id = ids[seed % ids.length]; OmertaWorkEscrowRobinhood.Work memory w = escrow.work(id);
        if (w.state != OmertaWorkEscrowRobinhood.State.Allocated) return;
        vm.prank(w.payee); escrow.settle(id);
    }
    function recover(uint256 seed) external {
        if (ids.length == 0) return;
        bytes32 id = ids[seed % ids.length]; OmertaWorkEscrowRobinhood.Work memory w = escrow.work(id);
        if ((w.state != OmertaWorkEscrowRobinhood.State.Funded && w.state != OmertaWorkEscrowRobinhood.State.Accepted)
            || vm.getBlockTimestamp() < w.deadline) return;
        vm.prank(w.funder); escrow.recover(id);
    }
    function elapse(uint32 seed) external { vm.warp(vm.getBlockTimestamp() + bound(uint256(seed), 0, 86401)); }
}

contract OmertaWorkEscrowRobinhoodInvariantTest is StdInvariant, Test {
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    OmertaWorkEscrowRobinhood escrow;
    RobinhoodWorkEscrowHandler handler;
    function setUp() public {
        vm.chainId(4663);
        RobinhoodWorkFixtureUSDG implementation = new RobinhoodWorkFixtureUSDG(); vm.etch(USDG, address(implementation).code);
        escrow = new OmertaWorkEscrowRobinhood(); handler = new RobinhoodWorkEscrowHandler(escrow, RobinhoodWorkFixtureUSDG(USDG));
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = handler.fund.selector; selectors[1] = handler.accept.selector; selectors[2] = handler.allocate.selector;
        selectors[3] = handler.settle.selector; selectors[4] = handler.recover.selector; selectors[5] = handler.elapse.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors})); targetContract(address(handler));
    }
    function invariant_LiabilityEqualsEveryUnpaidWork() public view {
        uint256 owed;
        for (uint256 i; i < handler.count(); i++) {
            OmertaWorkEscrowRobinhood.Work memory w = escrow.work(handler.ids(i));
            if (w.state == OmertaWorkEscrowRobinhood.State.Funded || w.state == OmertaWorkEscrowRobinhood.State.Accepted
                || w.state == OmertaWorkEscrowRobinhood.State.Allocated) owed += w.amount;
            assertEq(w.asset, USDG); assertTrue(escrow.usedNonce(w.funder, i + 1));
            assertTrue(escrow.usedWork(keccak256(abi.encode(w.funder, w.workHash))));
            assertEq(handler.ids(i), keccak256(abi.encode(uint256(4663), address(escrow), w.funder, i + 1)));
        }
        assertEq(escrow.liability(USDG), owed); assertEq(escrow.liability(address(0)), 0);
        assertEq(RobinhoodWorkFixtureUSDG(USDG).balanceOf(address(escrow)), owed);
    }
    function invariant_USDGConservation() public view {
        RobinhoodWorkFixtureUSDG token = RobinhoodWorkFixtureUSDG(USDG); uint256 total = token.balanceOf(address(escrow));
        for (uint256 i; i < 2; i++) total += token.balanceOf(handler.funders(i)) + token.balanceOf(handler.payees(i));
        assertEq(total, 2000e6); assertEq(address(escrow).balance, 0);
    }
    function invariant_AllocationNeverBecomesRefundable() public view {
        for (uint256 i; i < handler.count(); i++) if (handler.wasAllocated(handler.ids(i))) {
            OmertaWorkEscrowRobinhood.State state = escrow.work(handler.ids(i)).state;
            assertTrue(state == OmertaWorkEscrowRobinhood.State.Allocated || state == OmertaWorkEscrowRobinhood.State.Settled);
        }
    }
}
