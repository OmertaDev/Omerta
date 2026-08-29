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

contract ReentrantExecutor {
    SettlementGasPool internal immutable pool;

    uint256 public receiveCount;
    uint256 public totalReceived;
    bool public reentrySucceeded;
    bytes4 public reentryErrorSelector;

    constructor(SettlementGasPool pool_) {
        pool = pool_;
    }

    function claim() external {
        pool.withdrawCredit();
    }

    receive() external payable {
        receiveCount += 1;
        totalReceived += msg.value;
        bytes memory returnData;
        (reentrySucceeded, returnData) = address(pool).call(abi.encodeCall(SettlementGasPool.withdrawCredit, ()));
        if (!reentrySucceeded && returnData.length >= 4) {
            bytes4 selector;
            assembly ("memory-safe") {
                selector := mload(add(returnData, 32))
            }
            reentryErrorSelector = selector;
        }
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
    event SettlementProcessed(
        bytes32 indexed settlementKey,
        bytes32 indexed eventId,
        bytes32 indexed victimAccountId,
        uint256 victimNonce,
        address executor,
        SettlementGasPool.CreditStatus status
    );
    event SettlementCreditCalculated(
        bytes32 indexed settlementKey,
        uint256 measuredSettlementGas,
        uint256 billableGas,
        uint256 reimbursableGasPrice,
        uint256 approvedDataFee,
        uint256 verifiedGasCost,
        uint256 available,
        uint256 credit
    );
    event CreditWithdrawn(
        address indexed executor,
        uint256 amount,
        uint256 totalCreditsWithdrawn,
        uint256 totalOutstandingCredits,
        uint256 poolBalance
    );
    event CreditsPaused(bytes32 indexed reasonHash);
    event CreditsUnpaused(bytes32 indexed reasonHash);
    event CapsReduced(
        uint128 oldPriorityFeeCapWei,
        uint128 newPriorityFeeCapWei,
        uint128 oldPerSettlementWeiCap,
        uint128 newPerSettlementWeiCap,
        uint128 oldDataFeeWeiCap,
        uint128 newDataFeeWeiCap
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

        bytes32 key = pool.settlementKey(EVENT_ID, VICTIM_ID, VICTIM_NONCE);
        vm.prank(vault);
        vm.expectEmit(true, true, true, true, address(pool));
        emit SettlementProcessed(key, EVENT_ID, VICTIM_ID, VICTIM_NONCE, executor, SettlementGasPool.CreditStatus.FULL);
        vm.expectEmit(true, false, false, true, address(pool));
        emit SettlementCreditCalculated(key, 79_000, 100_000, 22 gwei, 0, 0.0022 ether, 1 ether, 0.0022 ether);
        (uint256 credit, SettlementGasPool.CreditStatus status) = pool.recordSettlementCredit(request(79_000));
        assertEq(credit, 0.0022 ether);
        assertEq(uint256(status), uint256(SettlementGasPool.CreditStatus.FULL));
        assertEq(pool.credits(executor), 0.0022 ether);
        assertEq(pool.totalCreditsRecorded(), 0.0022 ether);
        assertEq(pool.totalOutstandingCredits(), 0.0022 ether);
    }

    // Catches charging basefee plus the priority cap when the actual transaction gas price is lower.
    function test_credit_formula_uses_lower_actual_transaction_gas_price() public {
        fund(1 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(10 gwei);

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
        assertEq(reimbursableGasPrice, 10 gwei);
        assertEq(approvedDataFee, 0);
        assertEq(verifiedGasCost, 0.001 ether);
        assertEq(available, 1 ether);
        assertEq(previewedCredit, 0.001 ether);
        assertEq(uint256(previewedStatus), uint256(SettlementGasPool.CreditStatus.FULL));

        vm.prank(vault);
        (uint256 credit, SettlementGasPool.CreditStatus status) = pool.recordSettlementCredit(request(79_000));
        assertEq(credit, 0.001 ether);
        assertEq(uint256(status), uint256(SettlementGasPool.CreditStatus.FULL));
        assertEq(pool.credits(executor), 0.001 ether);
        assertEq(pool.totalCreditsRecorded(), 0.001 ether);
        assertEq(pool.totalOutstandingCredits(), 0.001 ether);
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

    // Catches unchecked additions/multiplications or a cap applied only after overflow-sized inputs are evaluated.
    function test_max_measured_gas_and_max_fee_caps_saturate_without_overflow() public {
        pool = deployPool(address(0), type(uint128).max, type(uint128).max);
        vm.deal(address(pool), type(uint128).max);
        unpause();
        vm.fee(type(uint64).max);
        vm.txGasPrice(type(uint64).max);

        (
            uint256 billableGas,
            uint256 reimbursableGasPrice,
            uint256 approvedDataFee,
            uint256 verifiedGasCost,
            uint256 available,
            uint256 previewedCredit,
            SettlementGasPool.CreditStatus previewedStatus
        ) = pool.previewCredit(type(uint256).max);
        assertEq(billableGas, type(uint256).max);
        assertEq(reimbursableGasPrice, type(uint64).max);
        assertEq(approvedDataFee, 0);
        assertEq(verifiedGasCost, type(uint128).max);
        assertEq(available, type(uint128).max);
        assertEq(previewedCredit, type(uint128).max);
        assertEq(uint256(previewedStatus), uint256(SettlementGasPool.CreditStatus.FULL));

        vm.prank(vault);
        (uint256 credit, SettlementGasPool.CreditStatus status) =
            pool.recordSettlementCredit(request(type(uint256).max));
        assertEq(credit, type(uint128).max);
        assertEq(pool.credits(executor), type(uint128).max);
        assertEq(pool.totalCreditsRecorded(), type(uint128).max);
        assertEq(pool.totalOutstandingCredits(), type(uint128).max);
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

    // Catches a paused zero-credit key becoming payable after later sponsorship and an unpause.
    function test_zero_credit_key_is_terminal_across_pause_fund_and_unpause() public {
        bytes32 key = pool.settlementKey(EVENT_ID, VICTIM_ID, VICTIM_NONCE);

        vm.prank(vault);
        (uint256 credit, SettlementGasPool.CreditStatus status) = pool.recordSettlementCredit(request(79_000));
        assertEq(credit, 0);
        assertEq(uint256(status), uint256(SettlementGasPool.CreditStatus.ZERO_PAUSED));
        assertTrue(pool.processedSettlements(key));

        fund(1 ether);
        unpause();
        vm.prank(vault);
        vm.expectRevert(SettlementGasPool.AlreadyProcessed.selector);
        pool.recordSettlementCredit(request(79_000));
        assertEq(pool.credits(executor), 0);
        assertEq(pool.totalCreditsRecorded(), 0);
        assertEq(pool.totalOutstandingCredits(), 0);
        assertEq(pool.unreservedBalance(), 1 ether);
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

    // Catches the victim account ID being omitted from a replay key shared by equal event IDs and nonces.
    function test_two_distinct_victims_with_same_nonce_do_not_collide() public {
        fund(1 ether);
        unpause();
        vm.txGasPrice(1 gwei);
        bytes32 secondVictimId = keccak256("victim-2");
        bytes32 firstKey = pool.settlementKey(EVENT_ID, VICTIM_ID, VICTIM_NONCE);
        bytes32 secondKey = pool.settlementKey(EVENT_ID, secondVictimId, VICTIM_NONCE);
        assertTrue(firstKey != secondKey);

        vm.prank(vault);
        (uint256 firstCredit,) = pool.recordSettlementCredit(request(79_000));
        SettlementGasPool.CreditRequest memory secondRequest = request(79_000);
        secondRequest.victimAccountId = secondVictimId;
        vm.prank(vault);
        (uint256 secondCredit,) = pool.recordSettlementCredit(secondRequest);

        assertEq(firstCredit, 0.0001 ether);
        assertEq(secondCredit, 0.0001 ether);
        assertTrue(pool.processedSettlements(firstKey));
        assertTrue(pool.processedSettlements(secondKey));
        assertEq(pool.credits(executor), 0.0002 ether);
        assertEq(pool.totalOutstandingCredits(), 0.0002 ether);
    }

    // Catches omitting the supported chain, immutable vault, event, victim, or nonce from the exact replay domain.
    function test_settlement_key_binds_supported_chain_vault_event_victim_and_nonce() public view {
        bytes32 expected = keccak256(abi.encode(uint256(31_337), vault, EVENT_ID, VICTIM_ID, uint256(7)));
        assertEq(pool.settlementKey(EVENT_ID, VICTIM_ID, 7), expected);
    }

    // Catches removal or misclassification of the terminal ZERO_CAP branch and its replay write.
    function test_zero_cap_processes_terminal_zero_and_cannot_backfill() public {
        fund(1 ether);
        vm.prank(safe);
        pool.reduceCaps(PRIORITY_CAP, 0, 0);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);
        bytes32 key = pool.settlementKey(EVENT_ID, VICTIM_ID, VICTIM_NONCE);

        vm.prank(vault);
        (uint256 credit, SettlementGasPool.CreditStatus status) = pool.recordSettlementCredit(request(79_000));
        assertEq(credit, 0);
        assertEq(uint256(status), uint256(SettlementGasPool.CreditStatus.ZERO_CAP));
        assertTrue(pool.processedSettlements(key));
        assertEq(pool.credits(executor), 0);
        assertEq(pool.totalCreditsRecorded(), 0);
        assertEq(pool.totalOutstandingCredits(), 0);
        assertEq(pool.unreservedBalance(), 1 ether);

        vm.prank(vault);
        vm.expectRevert(SettlementGasPool.AlreadyProcessed.selector);
        pool.recordSettlementCredit(request(79_000));
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
        vm.expectEmit(true, false, false, true, address(pool));
        emit CreditWithdrawn(executor, 0.003 ether, 0.003 ether, 0, 0);
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
    function test_reverting_executor_keeps_exact_credit() public {
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

    // Catches removing the withdrawal guard even though checks-effects-interactions also clears the credit first.
    function test_reentrant_executor_cannot_double_withdraw() public {
        ReentrantExecutor reentrant = new ReentrantExecutor(pool);
        fund(1 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);
        SettlementGasPool.CreditRequest memory req = request(79_000);
        req.executor = address(reentrant);

        vm.prank(vault);
        pool.recordSettlementCredit(req);
        assertEq(pool.credits(address(reentrant)), 0.0022 ether);
        reentrant.claim();

        assertEq(reentrant.receiveCount(), 1);
        assertEq(reentrant.totalReceived(), 0.0022 ether);
        assertFalse(reentrant.reentrySucceeded());
        assertEq(reentrant.reentryErrorSelector(), bytes4(keccak256("ReentrancyGuardReentrantCall()")));
        assertEq(pool.credits(address(reentrant)), 0);
        assertEq(pool.totalCreditsRecorded(), 0.0022 ether);
        assertEq(pool.totalOutstandingCredits(), 0);
        assertEq(pool.totalCreditsWithdrawn(), 0.0022 ether);
        assertEq(address(pool).balance, 1 ether - 0.0022 ether);
    }

    // Catches forcibly received ETH being treated as a sponsor refund or an unearned executor withdrawal balance.
    function test_forced_eth_creates_unreserved_balance_but_no_sponsor_or_executor_right() public {
        address forceSender = makeAddr("forceSender");
        vm.etch(forceSender, abi.encodePacked(hex"73", address(pool), hex"ff"));
        vm.deal(forceSender, 1 ether);
        (bool forced,) = forceSender.call("");
        assertTrue(forced);

        assertEq(address(pool).balance, 1 ether);
        assertEq(pool.unreservedBalance(), 1 ether);
        assertEq(pool.credits(sponsor), 0);
        assertEq(pool.credits(executor), 0);
        assertEq(pool.credits(safe), 0);
        assertEq(pool.totalCreditsRecorded(), 0);
        assertEq(pool.totalOutstandingCredits(), 0);

        vm.prank(sponsor);
        vm.expectRevert(SettlementGasPool.NoCredit.selector);
        pool.withdrawCredit();
        vm.prank(executor);
        vm.expectRevert(SettlementGasPool.NoCredit.selector);
        pool.withdrawCredit();
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.NoCredit.selector);
        pool.withdrawCredit();
        assertEq(address(pool).balance, 1 ether);
        assertEq(pool.unreservedBalance(), 1 ether);
    }

    // Catches a Safe-only sweep, arbitrary-recipient withdrawal, or owner bypass around immutable vault crediting.
    function test_owner_cannot_sweep_redirect_or_manually_create_credit() public {
        fund(1 ether);
        unpause();
        vm.txGasPrice(1 gwei);
        vm.prank(vault);
        pool.recordSettlementCredit(request(79_000));
        uint256 poolBalance = address(pool).balance;
        uint256 executorCredit = pool.credits(executor);

        SettlementGasPool.CreditRequest memory ownerRequest = request(79_000);
        ownerRequest.victimNonce = 8;
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.NotGameplayVault.selector);
        pool.recordSettlementCredit(ownerRequest);
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.NoCredit.selector);
        pool.withdrawCredit();

        vm.prank(safe);
        (bool swept,) = address(pool).call(abi.encodeWithSignature("sweep(address,uint256)", safe, 1 ether));
        vm.prank(safe);
        (bool redirected,) = address(pool).call(abi.encodeWithSignature("withdrawCredit(address)", safe));
        vm.prank(safe);
        (bool manuallyCredited,) =
            address(pool).call(abi.encodeWithSignature("grantCredit(address,uint256)", safe, 1 ether));
        assertFalse(swept);
        assertFalse(redirected);
        assertFalse(manuallyCredited);
        assertEq(address(pool).balance, poolBalance);
        assertEq(pool.credits(executor), executorCredit);
        assertEq(pool.credits(safe), 0);
        assertEq(pool.totalCreditsRecorded(), executorCredit);
        assertEq(pool.totalOutstandingCredits(), executorCredit);
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
        bytes32 pauseReason = keccak256("incident");
        vm.expectEmit(true, false, false, true, address(pool));
        emit CreditsPaused(pauseReason);
        pool.pauseCredits(pauseReason);
        assertTrue(pool.paused());

        vm.prank(safe);
        vm.expectEmit(false, false, false, true, address(pool));
        emit CapsReduced(PRIORITY_CAP, 1 gwei, SETTLEMENT_CAP, 0.01 ether, 0, 0);
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
        bytes32 unpauseReason = keccak256("launch checks complete");
        vm.prank(safe);
        vm.expectEmit(true, false, false, true, address(pool));
        emit CreditsUnpaused(unpauseReason);
        pool.unpauseCredits(unpauseReason);
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
