// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SettlementGasPool} from "../src/SettlementGasPool.sol";
import {SettlementGasPoolTestBase} from "./utils/SettlementGasPoolTestBase.sol";

contract RejectingExecutor {
    SettlementGasPool internal immutable pool;
    bool internal rejectPayment = true;

    constructor(SettlementGasPool pool_) {
        pool = pool_;
    }

    function claim() external {
        pool.withdrawCredit();
    }

    function allowPayment() external {
        rejectPayment = false;
    }

    receive() external payable {
        if (rejectPayment) revert("reject native gas credit");
        require(pool.credits(address(this)) == 0, "credit not cleared before call");
        require(pool.totalOutstandingCredits() == 0, "liability not cleared before call");
    }
}

contract SettlementGasPoolCoreTest is SettlementGasPoolTestBase {
    event ContributionReceived(
        address indexed contributor,
        uint256 amount,
        bytes32 indexed memo,
        uint256 poolBalance,
        uint256 unreservedBalance
    );

    // Catches constructor validation or immutable Safe/vault/chain/overhead authority being removed.
    function test_constructor_starts_paused_and_pins_authority() public {
        assertTrue(pool.paused());
        assertEq(pool.owner(), safe);
        assertEq(pool.supportedChainId(), block.chainid);
        assertEq(pool.gameplayVault(), vault);
        assertEq(pool.predecessor(), address(0));
        assertEq(pool.auditedOverheadGas(), 21_000);
        assertTrue(pool.version() != bytes32(0));

        (
            uint128 priorityFeeCapWei,
            uint128 perSettlementWeiCap,
            uint128 dataFeeWeiCap,
            address dataFeeSource,
            bytes32 dataFeeSourceRuntimeCodeHash
        ) = pool.config();
        assertEq(priorityFeeCapWei, 2 gwei);
        assertEq(perSettlementWeiCap, 0.02 ether);
        assertEq(dataFeeWeiCap, 0);
        assertEq(dataFeeSource, address(0));
        assertEq(dataFeeSourceRuntimeCodeHash, bytes32(0));

        vm.expectRevert();
        new SettlementGasPool(address(0), vault, address(0), OVERHEAD_GAS, PRIORITY_CAP, SETTLEMENT_CAP, 0);
        vm.expectRevert();
        new SettlementGasPool(safe, address(0), address(0), OVERHEAD_GAS, PRIORITY_CAP, SETTLEMENT_CAP, 0);
        vm.expectRevert();
        new SettlementGasPool(safe, vault, address(0), 0, PRIORITY_CAP, SETTLEMENT_CAP, 0);
        vm.expectRevert();
        new SettlementGasPool(safe, vault, address(0), OVERHEAD_GAS, 0, SETTLEMENT_CAP, 0);
        vm.expectRevert();
        new SettlementGasPool(safe, vault, address(0), OVERHEAD_GAS, PRIORITY_CAP, 0, 0);
        vm.expectRevert();
        new SettlementGasPool(safe, vault, makeAddr("eoaPredecessor"), OVERHEAD_GAS, PRIORITY_CAP, SETTLEMENT_CAP, 0);
    }

    // Catches contribution accounting accidentally creating a sponsor credit/refund right.
    function test_contribution_creates_no_sponsor_balance_or_refund_right() public {
        vm.expectEmit(true, true, false, true, address(pool));
        emit ContributionReceived(sponsor, 1 ether, keccak256("community"), 1 ether, 1 ether);
        fund(1 ether);

        assertEq(address(pool).balance, 1 ether);
        assertEq(sponsor.balance, 99 ether);
        assertEq(pool.credits(sponsor), 0);
        assertEq(pool.totalCreditsRecorded(), 0);
        assertEq(pool.totalOutstandingCredits(), 0);
        vm.prank(sponsor);
        vm.expectRevert(SettlementGasPool.NoCredit.selector);
        pool.withdrawCredit();
    }

    // Catches zero-value sponsorship being accepted or calldata reaching a permissive fallback.
    function test_receive_and_contribute_reject_zero_and_fallback_rejects_calldata() public {
        vm.prank(sponsor);
        vm.expectRevert(SettlementGasPool.ZeroValue.selector);
        pool.contribute{value: 0}(keccak256("zero"));

        vm.prank(sponsor);
        vm.expectRevert(SettlementGasPool.ZeroValue.selector);
        payable(address(pool)).transfer(0);

        vm.prank(sponsor);
        (bool fallbackAccepted,) = address(pool).call{value: 1 ether}(hex"deadbeef");
        assertFalse(fallbackAccepted);
        assertEq(address(pool).balance, 0);

        vm.prank(sponsor);
        (bool receiveAccepted,) = address(pool).call{value: 1 ether}("");
        assertTrue(receiveAccepted);
        assertEq(address(pool).balance, 1 ether);
        assertEq(pool.credits(sponsor), 0);
    }

    // Catches the immutable vault authority check or executor identity validation being removed.
    function test_only_immutable_vault_can_record_and_executor_must_be_nonzero() public {
        SettlementGasPool.CreditRequest memory req = request(79_000);
        vm.expectRevert(SettlementGasPool.NotGameplayVault.selector);
        pool.recordSettlementCredit(req);

        req.executor = address(0);
        vm.prank(vault);
        vm.expectRevert(SettlementGasPool.ZeroAddress.selector);
        pool.recordSettlementCredit(req);

        req = request(79_000);
        req.eventId = bytes32(0);
        vm.prank(vault);
        vm.expectRevert(SettlementGasPool.ZeroId.selector);
        pool.recordSettlementCredit(req);

        req = request(79_000);
        req.victimAccountId = bytes32(0);
        vm.prank(vault);
        vm.expectRevert(SettlementGasPool.ZeroId.selector);
        pool.recordSettlementCredit(req);
    }

    // Catches the fixed overhead being omitted or the priority-fee cap being ignored.
    function test_credit_formula_caps_priority_fee_and_adds_fixed_overhead() public {
        fund(1 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);

        (
            uint256 billableGas,
            uint256 reimbursableGasPrice,
            uint256 approvedDataFee,
            uint256 verifiedGasCost,
            uint256 available,
            uint256 previewedCredit,
            SettlementGasPool.CreditStatus previewedStatus
        ) = pool.previewCredit(79_000);
        assertEq(billableGas, 100_000);
        assertEq(reimbursableGasPrice, 22 gwei);
        assertEq(approvedDataFee, 0);
        assertEq(verifiedGasCost, 0.0022 ether);
        assertEq(available, 1 ether);
        assertEq(previewedCredit, 0.0022 ether);
        assertEq(uint256(previewedStatus), uint256(SettlementGasPool.CreditStatus.FULL));

        vm.prank(vault);
        (uint256 credit, SettlementGasPool.CreditStatus status) = pool.recordSettlementCredit(request(79_000));
        assertEq(credit, 0.0022 ether);
        assertEq(uint256(status), uint256(SettlementGasPool.CreditStatus.FULL));
        assertEq(pool.credits(executor), 0.0022 ether);
        assertEq(pool.totalCreditsRecorded(), 0.0022 ether);
        assertEq(pool.totalOutstandingCredits(), 0.0022 ether);
    }

    // Catches the per-settlement wei cap being ignored, including on overflow-sized gas input.
    function test_per_settlement_cap_limits_verified_cost() public {
        fund(1 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(type(uint64).max - 1);

        vm.prank(vault);
        (uint256 credit, SettlementGasPool.CreditStatus status) =
            pool.recordSettlementCredit(request(type(uint256).max));
        assertEq(credit, 0.02 ether);
        assertEq(pool.credits(executor), 0.02 ether);
        assertEq(pool.totalOutstandingCredits(), 0.02 ether);
        assertEq(uint256(status), uint256(SettlementGasPool.CreditStatus.FULL));
    }

    // Catches availability not being bounded by the exact unreserved pool balance.
    function test_insufficient_unreserved_balance_records_partial_credit() public {
        fund(0.001 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);

        vm.prank(vault);
        (uint256 credit, SettlementGasPool.CreditStatus status) = pool.recordSettlementCredit(request(79_000));
        assertEq(credit, 0.001 ether);
        assertEq(pool.credits(executor), 0.001 ether);
        assertEq(pool.totalCreditsRecorded(), 0.001 ether);
        assertEq(pool.totalOutstandingCredits(), 0.001 ether);
        assertEq(pool.unreservedBalance(), 0);
        assertEq(uint256(status), uint256(SettlementGasPool.CreditStatus.PARTIAL));
    }

    // Catches an unfunded zero outcome reverting or failing to consume replay authority.
    function test_empty_pool_processes_zero_credit_without_reverting() public {
        unpause();
        vm.txGasPrice(1 gwei);
        bytes32 key = pool.settlementKey(EVENT_ID, VICTIM_ID, VICTIM_NONCE);

        vm.prank(vault);
        (uint256 credit, SettlementGasPool.CreditStatus status) = pool.recordSettlementCredit(request(79_000));
        assertEq(credit, 0);
        assertEq(uint256(status), uint256(SettlementGasPool.CreditStatus.ZERO_UNFUNDED));
        assertTrue(pool.processedSettlements(key));
        assertEq(pool.totalCreditsRecorded(), 0);
        assertEq(pool.totalOutstandingCredits(), 0);
    }

    // Catches pause being treated as a temporary skip that can be backfilled after unpause.
    function test_paused_pool_processes_zero_credit_and_cannot_backfill_after_unpause() public {
        fund(1 ether);
        bytes32 key = pool.settlementKey(EVENT_ID, VICTIM_ID, VICTIM_NONCE);

        vm.prank(vault);
        (uint256 credit, SettlementGasPool.CreditStatus status) = pool.recordSettlementCredit(request(79_000));
        assertEq(credit, 0);
        assertEq(uint256(status), uint256(SettlementGasPool.CreditStatus.ZERO_PAUSED));
        assertTrue(pool.processedSettlements(key));

        unpause();
        vm.prank(vault);
        vm.expectRevert(SettlementGasPool.AlreadyProcessed.selector);
        pool.recordSettlementCredit(request(79_000));
    }

    // Catches the terminal replay write being removed from a positive credit record.
    function test_same_event_victim_nonce_key_cannot_be_processed_twice() public {
        fund(1 ether);
        unpause();
        vm.txGasPrice(1 gwei);

        vm.prank(vault);
        pool.recordSettlementCredit(request(79_000));
        vm.prank(vault);
        vm.expectRevert(SettlementGasPool.AlreadyProcessed.selector);
        pool.recordSettlementCredit(request(79_000));
    }

    // Catches the victim nonce being omitted from the replay-key domain.
    function test_distinct_victim_nonce_has_a_distinct_key() public {
        bytes32 first = pool.settlementKey(EVENT_ID, VICTIM_ID, 7);
        bytes32 second = pool.settlementKey(EVENT_ID, VICTIM_ID, 8);
        assertTrue(first != second);

        vm.prank(vault);
        pool.recordSettlementCredit(request(79_000));
        SettlementGasPool.CreditRequest memory req = request(79_000);
        req.victimNonce = 8;
        vm.prank(vault);
        pool.recordSettlementCredit(req);
        assertTrue(pool.processedSettlements(first));
        assertTrue(pool.processedSettlements(second));
    }

    // Catches liabilities omitted from availability or withdrawal totals/recipient accounting.
    function test_withdraw_pays_only_callers_full_credit_and_updates_exact_totals() public {
        fund(0.003 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);

        vm.prank(vault);
        pool.recordSettlementCredit(request(79_000));
        SettlementGasPool.CreditRequest memory second = request(79_000);
        second.victimNonce = 8;
        vm.prank(vault);
        pool.recordSettlementCredit(second);

        assertEq(pool.credits(executor), 0.003 ether);
        assertEq(pool.totalOutstandingCredits(), 0.003 ether);
        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert(SettlementGasPool.NoCredit.selector);
        pool.withdrawCredit();

        uint256 executorBefore = executor.balance;
        vm.prank(executor);
        uint256 amount = pool.withdrawCredit();
        assertEq(amount, 0.003 ether);
        assertEq(executor.balance, executorBefore + 0.003 ether);
        assertEq(pool.credits(executor), 0);
        assertEq(pool.totalCreditsRecorded(), 0.003 ether);
        assertEq(pool.totalOutstandingCredits(), 0);
        assertEq(pool.totalCreditsWithdrawn(), 0.003 ether);
        assertEq(address(pool).balance, 0);
        assertEq(pool.unreservedBalance(), 0);
    }

    // Catches CEI/failure handling that loses the caller's credit when its native transfer fails.
    function test_failed_withdrawal_restores_credit_and_liability() public {
        RejectingExecutor rejecting = new RejectingExecutor(pool);
        fund(1 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);
        SettlementGasPool.CreditRequest memory req = request(79_000);
        req.executor = address(rejecting);

        vm.prank(vault);
        pool.recordSettlementCredit(req);
        vm.expectRevert(SettlementGasPool.WithdrawalFailed.selector);
        rejecting.claim();

        assertEq(pool.credits(address(rejecting)), 0.0022 ether);
        assertEq(pool.totalOutstandingCredits(), 0.0022 ether);
        assertEq(pool.totalCreditsWithdrawn(), 0);
        assertEq(address(pool).balance, 1 ether);

        rejecting.allowPayment();
        rejecting.claim();
        assertEq(pool.credits(address(rejecting)), 0);
        assertEq(pool.totalOutstandingCredits(), 0);
        assertEq(pool.totalCreditsWithdrawn(), 0.0022 ether);
    }

    // Catches pause incorrectly blocking withdrawals of already-recorded liabilities.
    function test_withdraw_remains_live_while_paused() public {
        fund(1 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);
        vm.prank(vault);
        pool.recordSettlementCredit(request(79_000));
        vm.prank(safe);
        pool.pauseCredits(keccak256("incident"));

        vm.prank(executor);
        uint256 amount = pool.withdrawCredit();
        assertEq(amount, 0.0022 ether);
        assertEq(pool.totalOutstandingCredits(), 0);
        assertEq(pool.totalCreditsWithdrawn(), 0.0022 ether);
    }

    // Catches reasonless pause evidence or an immediate cap change increasing any dimension.
    function test_pause_requires_reason_and_reduction_cannot_increase_any_cap() public {
        unpause();
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.ZeroReason.selector);
        pool.pauseCredits(bytes32(0));
        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, sponsor));
        pool.pauseCredits(keccak256("unauthorized"));
        vm.prank(safe);
        pool.pauseCredits(keccak256("incident"));
        assertTrue(pool.paused());

        vm.prank(safe);
        pool.reduceCaps(1 gwei, 0.01 ether, 0);
        (uint128 priority, uint128 settlement, uint128 data,,) = pool.config();
        assertEq(priority, 1 gwei);
        assertEq(settlement, 0.01 ether);
        assertEq(data, 0);

        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.CapIncreaseNotAllowed.selector);
        pool.reduceCaps(1 gwei + 1, 0.01 ether, 0);
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.CapIncreaseNotAllowed.selector);
        pool.reduceCaps(1 gwei, 0.01 ether + 1, 0);
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.CapIncreaseNotAllowed.selector);
        pool.reduceCaps(1 gwei, 0.01 ether, 1);
    }

    // Catches unpause without a public reason or while recorded liabilities are insolvent.
    function test_unpause_requires_reason_and_solvency() public {
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.ZeroReason.selector);
        pool.unpauseCredits(bytes32(0));

        fund(1 ether);
        unpause();
        vm.txGasPrice(1 gwei);
        vm.prank(vault);
        pool.recordSettlementCredit(request(79_000));
        vm.prank(safe);
        pool.pauseCredits(keccak256("accounting check"));
        vm.deal(address(pool), 0);
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.Insolvent.selector);
        pool.unpauseCredits(keccak256("unsafe resume"));
        assertTrue(pool.paused());
    }

    // Catches functional ownership renunciation or a one-step Safe handover.
    function test_renounce_ownership_is_disabled_and_transfer_is_two_step() public {
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.OwnershipRenunciationDisabled.selector);
        pool.renounceOwnership();

        address nextSafe = makeAddr("nextSafe");
        vm.prank(safe);
        pool.transferOwnership(nextSafe);
        assertEq(pool.owner(), safe);
        assertEq(pool.pendingOwner(), nextSafe);
        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, sponsor));
        pool.acceptOwnership();
        vm.prank(nextSafe);
        pool.acceptOwnership();
        assertEq(pool.owner(), nextSafe);
        assertEq(pool.pendingOwner(), address(0));
    }

    // Catches arithmetic overflow, a missing settlement cap, or liabilities omitted from availability.
    function testFuzz_record_never_exceeds_cap_or_unreserved(uint256 measuredGas, uint256 funding) public {
        funding = bound(funding, 0, 0.03 ether);
        if (funding != 0) fund(funding);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);

        vm.prank(vault);
        (uint256 credit,) = pool.recordSettlementCredit(request(measuredGas));
        assertLe(credit, 0.02 ether);
        assertLe(credit, funding);
        assertEq(pool.credits(executor), credit);
        assertEq(pool.totalCreditsRecorded(), credit);
        assertEq(pool.totalOutstandingCredits(), credit);
        assertGe(address(pool).balance, pool.totalOutstandingCredits());
        assertEq(pool.unreservedBalance(), funding - credit);
    }
}
