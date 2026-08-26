// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SettlementGasPool} from "../src/SettlementGasPool.sol";
import {SettlementGasPoolTestBase} from "./utils/SettlementGasPoolTestBase.sol";

contract MutableMigrationCandidate {
    bytes32 public version;
    uint256 public supportedChainId;
    address public gameplayVault;
    address public predecessor;
    address public owner;
    bool public paused;
    bool public rejectReceipt;
    bool public attemptWithdrawalReentry;
    bool public withdrawalReentrySucceeded;
    bytes4 public withdrawalReentryErrorSelector;
    bytes32 public lastMigrationProposalId;
    uint256 public receiptCount;
    uint256 public totalMigrationReceived;

    error ReceiptRejected();

    constructor(
        bytes32 version_,
        uint256 supportedChainId_,
        address gameplayVault_,
        address predecessor_,
        address owner_,
        bool paused_
    ) {
        version = version_;
        supportedChainId = supportedChainId_;
        gameplayVault = gameplayVault_;
        predecessor = predecessor_;
        owner = owner_;
        paused = paused_;
    }

    function setOwner(address owner_) external {
        owner = owner_;
    }

    function setRejectReceipt(bool rejectReceipt_) external {
        rejectReceipt = rejectReceipt_;
    }

    function setAttemptWithdrawalReentry(bool attemptWithdrawalReentry_) external {
        attemptWithdrawalReentry = attemptWithdrawalReentry_;
    }

    function acceptMigration(bytes32 migrationProposalId) external payable {
        if (rejectReceipt) revert ReceiptRejected();
        lastMigrationProposalId = migrationProposalId;
        receiptCount += 1;
        totalMigrationReceived += msg.value;
        if (attemptWithdrawalReentry) {
            bytes memory returnData;
            (withdrawalReentrySucceeded, returnData) =
                predecessor.call(abi.encodeCall(SettlementGasPool.withdrawCredit, ()));
            if (!withdrawalReentrySucceeded && returnData.length >= 4) {
                bytes4 selector;
                assembly ("memory-safe") {
                    selector := mload(add(returnData, 32))
                }
                withdrawalReentryErrorSelector = selector;
            }
        }
    }

    receive() external payable {}
}

contract SettlementGasPoolMigrationTest is SettlementGasPoolTestBase {
    bytes32 internal constant MIGRATION_REASON = keccak256("audited successor rollout");
    uint128 internal constant MIGRATION_PRIORITY_CAP = 1_000 gwei;
    uint128 internal constant MIGRATION_SETTLEMENT_CAP = 1 ether;

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

    // Catches migration IDs or stored proposals omitting the exact successor runtime, amount, reason, or schedule.
    function test_migration_proposal_binds_successor_codehash_amount_reason_and_times() public {
        fund(2 ether);
        SettlementGasPool candidate = _deploySuccessor();
        uint256 proposedAt = block.timestamp;

        bytes32 proposalId = _proposeMigration(address(candidate), 1.5 ether, MIGRATION_REASON);
        uint64 executableAt = uint64(proposedAt + 48 hours);
        uint64 expiresAt = uint64(proposedAt + 48 hours + 7 days);
        bytes32 expectedId = keccak256(
            abi.encode(
                "OMERTA_SETTLEMENT_GAS_POOL_MIGRATION_V1",
                block.chainid,
                address(pool),
                uint256(1),
                address(candidate),
                address(candidate).codehash,
                uint256(1.5 ether),
                MIGRATION_REASON,
                uint64(proposedAt),
                executableAt,
                expiresAt
            )
        );
        assertEq(proposalId, expectedId);

        SettlementGasPool.MigrationProposal memory proposal = pool.getMigrationProposal(proposalId);
        assertEq(proposal.id, proposalId);
        assertEq(proposal.successor, address(candidate));
        assertEq(proposal.successorRuntimeCodeHash, address(candidate).codehash);
        assertEq(proposal.amount, 1.5 ether);
        assertEq(proposal.reasonHash, MIGRATION_REASON);
        assertEq(proposal.proposedAt, proposedAt);
        assertEq(proposal.executableAt, proposedAt + 48 hours);
        assertEq(proposal.expiresAt, proposedAt + 48 hours + 7 days);
        assertFalse(proposal.executed);
        assertFalse(proposal.cancelled);
        assertEq(uint256(pool.migrationProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.WAITING));
        assertEq(
            uint256(pool.migrationProposalState(bytes32(uint256(123)))), uint256(SettlementGasPool.ProposalState.NONE)
        );
    }

    // Catches early execution, excluded exact boundaries, or execution after the seven-day review window.
    function test_migration_cannot_execute_before_48_hours_and_expires_after_window() public {
        fund(2 ether);
        SettlementGasPool candidate = _deploySuccessor();
        bytes32 proposalId = _proposeMigration(address(candidate), 1 ether, MIGRATION_REASON);
        SettlementGasPool.MigrationProposal memory proposal = pool.getMigrationProposal(proposalId);

        vm.warp(proposal.executableAt - 1);
        assertEq(uint256(pool.migrationProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.WAITING));
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.ProposalNotExecutable.selector);
        pool.executeMigration(proposalId);

        vm.warp(proposal.executableAt);
        assertEq(uint256(pool.migrationProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.EXECUTABLE));
        vm.warp(proposal.expiresAt);
        assertEq(uint256(pool.migrationProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.EXECUTABLE));
        vm.warp(proposal.expiresAt + 1);
        assertEq(uint256(pool.migrationProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.EXPIRED));
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.ProposalNotExecutable.selector);
        pool.executeMigration(proposalId);
    }

    // Catches unauthorized cancellation or cancellation failing to become terminal and irreversible.
    function test_migration_can_be_cancelled_only_by_owner() public {
        fund(2 ether);
        SettlementGasPool candidate = _deploySuccessor();
        bytes32 proposalId = _proposeMigration(address(candidate), 1 ether, MIGRATION_REASON);

        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, sponsor));
        pool.cancelMigrationProposal(proposalId);
        vm.prank(safe);
        pool.cancelMigrationProposal(proposalId);
        assertEq(uint256(pool.migrationProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.CANCELLED));
        assertTrue(pool.getMigrationProposal(proposalId).cancelled);
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.ProposalNotCancellable.selector);
        pool.cancelMigrationProposal(proposalId);
    }

    // Catches zero/reasonless migrations or any proposal reserving already-backed executor liabilities.
    function test_migration_rejects_zero_amount_or_amount_above_unreserved() public {
        fund(2 ether);
        SettlementGasPool candidate = _deploySuccessor();

        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.ZeroValue.selector);
        pool.proposeMigration(address(candidate), 0, MIGRATION_REASON);
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.ZeroReason.selector);
        pool.proposeMigration(address(candidate), 1 ether, bytes32(0));
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.InsufficientUnreservedBalance.selector);
        pool.proposeMigration(address(candidate), 2 ether + 1, MIGRATION_REASON);

        bytes32 proposalId = _proposeMigration(address(candidate), 2 ether, MIGRATION_REASON);
        unpause();
        vm.fee(0);
        vm.txGasPrice(2 gwei);
        vm.prank(vault);
        (uint256 credit,) = pool.recordSettlementCredit(request(79_000));
        assertEq(credit, 0.0002 ether);
        vm.warp(block.timestamp + 48 hours);
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.InsufficientUnreservedBalance.selector);
        pool.executeMigration(proposalId);
        assertFalse(pool.getMigrationProposal(proposalId).executed);
    }

    // Catches accepting anything except a paused, same-version successor with every immutable identity field equal.
    function test_migration_rejects_eoa_wrong_chain_wrong_vault_wrong_predecessor_wrong_owner_or_version() public {
        fund(2 ether);
        _expectInvalidCandidate(makeAddr("eoaCandidate"));
        _expectInvalidCandidate(
            address(new MutableMigrationCandidate(pool.version(), block.chainid + 1, vault, address(pool), safe, true))
        );
        _expectInvalidCandidate(
            address(
                new MutableMigrationCandidate(
                    pool.version(), block.chainid, makeAddr("wrongVault"), address(pool), safe, true
                )
            )
        );
        _expectInvalidCandidate(
            address(
                new MutableMigrationCandidate(
                    pool.version(), block.chainid, vault, makeAddr("wrongPredecessor"), safe, true
                )
            )
        );
        _expectInvalidCandidate(
            address(
                new MutableMigrationCandidate(
                    pool.version(), block.chainid, vault, address(pool), makeAddr("wrongOwner"), true
                )
            )
        );
        _expectInvalidCandidate(
            address(
                new MutableMigrationCandidate(
                    keccak256("wrong version"), block.chainid, vault, address(pool), safe, true
                )
            )
        );
        _expectInvalidCandidate(
            address(new MutableMigrationCandidate(pool.version(), block.chainid, vault, address(pool), safe, false))
        );
    }

    // Catches execution trusting proposal-time bytecode or mutable identity instead of revalidating both.
    function test_execute_rechecks_successor_codehash_and_identity() public {
        fund(2 ether);
        SettlementGasPool codeChangedCandidate = _deploySuccessor();
        bytes32 codeChangedId = _proposeMigration(address(codeChangedCandidate), 0.5 ether, MIGRATION_REASON);

        MutableMigrationCandidate identityChangedCandidate = _validMutableCandidate();
        bytes32 identityChangedId =
            _proposeMigration(address(identityChangedCandidate), 0.5 ether, keccak256("identity recheck"));
        vm.etch(address(codeChangedCandidate), hex"00");
        identityChangedCandidate.setOwner(makeAddr("changedOwner"));
        vm.warp(block.timestamp + 48 hours);

        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.SuccessorCodeHashMismatch.selector);
        pool.executeMigration(codeChangedId);
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.InvalidMigrationSuccessor.selector);
        pool.executeMigration(identityChangedId);
        assertFalse(pool.retired());
        assertEq(pool.successor(), address(0));
    }

    // Catches migration moving executor backing, rounding the exact amount, or manufacturing successor credits.
    function test_execution_moves_exact_unreserved_amount_and_preserves_old_liability() public {
        SettlementGasPool candidate = _prepareExactLiabilityPool();
        bytes32 proposalId = _proposeMigration(address(candidate), 1.5 ether, MIGRATION_REASON);
        _executeMigrationAfterDelay(proposalId);

        assertEq(address(pool).balance, 1.5 ether);
        assertEq(pool.totalOutstandingCredits(), 1 ether);
        assertEq(pool.unreservedBalance(), 0.5 ether);
        assertEq(address(candidate).balance, 1.5 ether);
        assertEq(pool.credits(executor), 1 ether);
        assertEq(candidate.credits(executor), 0);
        assertEq(candidate.totalOutstandingCredits(), 0);
    }

    // Catches migration spending the last wei reserved for exact old-pool executor liabilities.
    function test_migration_never_reduces_old_balance_below_old_outstanding() public {
        pool = deployPool(address(0), MIGRATION_PRIORITY_CAP, MIGRATION_SETTLEMENT_CAP);
        fund(3 ether);
        unpause();
        vm.fee(0);
        vm.txGasPrice(1_000 gwei);
        vm.prank(vault);
        (uint256 credit,) = pool.recordSettlementCredit(request(979_000));
        assertEq(credit, 1 ether);
        assertEq(pool.unreservedBalance(), 2 ether);
        SettlementGasPool candidate = _deploySuccessor();

        bytes32 proposalId = _proposeMigration(address(candidate), 2 ether, MIGRATION_REASON);
        _executeMigrationAfterDelay(proposalId);

        assertEq(address(pool).balance, 1 ether);
        assertEq(pool.totalOutstandingCredits(), 1 ether);
        assertEq(pool.credits(executor), 1 ether);
        assertEq(pool.unreservedBalance(), 0);
        assertEq(address(candidate).balance, 2 ether);
        assertGe(address(pool).balance, pool.totalOutstandingCredits());
    }

    // Catches reversible retirement, successor replacement, leaving credit creation live, or mutable config after cutover.
    function test_first_execution_latches_successor_retires_and_pauses_old_pool() public {
        pool = deployPool(address(0), MIGRATION_PRIORITY_CAP, MIGRATION_SETTLEMENT_CAP);
        fund(2 ether);
        unpause();
        SettlementGasPool.Config memory nextConfig = currentConfig();
        nextConfig.priorityFeeCapWei = MIGRATION_PRIORITY_CAP + 1;
        bytes32 configProposalId = propose(nextConfig, keccak256("pending increase"));
        SettlementGasPool candidate = _deploySuccessor();
        bytes32 proposalId = _proposeMigration(address(candidate), 1 ether, MIGRATION_REASON);
        _executeMigrationAfterDelay(proposalId);

        assertEq(pool.successor(), address(candidate));
        assertTrue(pool.retired());
        assertTrue(pool.paused());
        assertEq(uint256(pool.migrationProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.EXECUTED));

        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.PoolRetired.selector);
        pool.unpauseCredits(keccak256("cannot revive"));
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.PoolRetired.selector);
        pool.reduceCaps(MIGRATION_PRIORITY_CAP - 1, MIGRATION_SETTLEMENT_CAP - 1, 0);
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.PoolRetired.selector);
        pool.proposeConfig(nextConfig, keccak256("cannot reconfigure"));
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.PoolRetired.selector);
        pool.executeConfigProposal(configProposalId);
    }

    // Catches retired settlement keys remaining replayable or reading/calculating cost before the terminal zero result.
    function test_retired_pool_processes_new_key_as_zero_retired_and_never_backfills() public {
        fund(2 ether);
        SettlementGasPool candidate = _deploySuccessor();
        _executeMigrationAfterDelay(_proposeMigration(address(candidate), 1 ether, MIGRATION_REASON));
        SettlementGasPool.CreditRequest memory retiredRequest = request(type(uint256).max);
        retiredRequest.victimNonce = 88;
        bytes32 key = pool.settlementKey(EVENT_ID, VICTIM_ID, 88);

        vm.prank(vault);
        vm.expectEmit(true, false, false, true, address(pool));
        emit SettlementCreditCalculated(key, type(uint256).max, 0, 0, 0, 0, 0, 0);
        (uint256 credit, SettlementGasPool.CreditStatus status) = pool.recordSettlementCredit(retiredRequest);
        assertEq(credit, 0);
        assertEq(uint256(status), uint256(SettlementGasPool.CreditStatus.ZERO_RETIRED));
        assertTrue(pool.processedSettlements(key));
        assertEq(pool.credits(executor), 0);
        assertEq(pool.totalOutstandingCredits(), 0);

        vm.deal(address(pool), address(pool).balance + 5 ether);
        assertEq(pool.credits(executor), 0);
        assertEq(pool.totalOutstandingCredits(), 0);
        vm.prank(vault);
        vm.expectRevert(SettlementGasPool.AlreadyProcessed.selector);
        pool.recordSettlementCredit(retiredRequest);
    }

    // Catches retirement freezing or haircutting the exact pull-payment liabilities retained in the old pool.
    function test_old_executor_withdraws_full_credit_after_retirement() public {
        SettlementGasPool candidate = _prepareExactLiabilityPool();
        _executeMigrationAfterDelay(_proposeMigration(address(candidate), 1.5 ether, MIGRATION_REASON));
        uint256 oldPoolBalance = address(pool).balance;
        uint256 oldOutstanding = pool.totalOutstandingCredits();
        uint256 executorBalance = executor.balance;

        vm.prank(executor);
        assertEq(pool.withdrawCredit(), 1 ether);
        assertEq(executor.balance, executorBalance + 1 ether);
        assertEq(address(pool).balance, oldPoolBalance - 1 ether);
        assertEq(pool.totalOutstandingCredits(), oldOutstanding - 1 ether);
        assertEq(pool.credits(executor), 0);
    }

    // Catches the first successor latch being replaceable while still permitting exact later partial transfers to it.
    function test_later_partial_migration_can_only_target_latched_successor() public {
        fund(3 ether);
        SettlementGasPool candidate = _deploySuccessor();
        _executeMigrationAfterDelay(_proposeMigration(address(candidate), 1 ether, MIGRATION_REASON));
        SettlementGasPool replacement = _deploySuccessor();

        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.SuccessorAlreadyLatched.selector);
        pool.proposeMigration(address(replacement), 0.5 ether, keccak256("replacement attempt"));

        bytes32 laterId = _proposeMigration(address(candidate), 0.5 ether, keccak256("forced balance follow-up"));
        _executeMigrationAfterDelay(laterId);
        assertEq(pool.successor(), address(candidate));
        assertEq(address(pool).balance, 1.5 ether);
        assertEq(address(candidate).balance, 1.5 ether);
        assertEq(uint256(pool.migrationProposalState(laterId)), uint256(SettlementGasPool.ProposalState.EXECUTED));
    }

    // Catches post-retirement sponsorship reopening while proving forcibly received native ETH remains migratable.
    function test_direct_contribution_reverts_after_retirement_but_forced_eth_can_be_migrated() public {
        fund(1 ether);
        SettlementGasPool candidate = _deploySuccessor();
        _executeMigrationAfterDelay(_proposeMigration(address(candidate), 1 ether, MIGRATION_REASON));

        vm.prank(sponsor);
        vm.expectRevert(SettlementGasPool.PoolRetired.selector);
        pool.contribute{value: 1 ether}(keccak256("too late"));
        vm.prank(sponsor);
        (bool accepted,) = address(pool).call{value: 1 ether}("");
        assertFalse(accepted);
        assertEq(address(pool).balance, 0);

        vm.deal(address(pool), 0.75 ether);
        assertEq(pool.unreservedBalance(), 0.75 ether);
        bytes32 forcedId = _proposeMigration(address(candidate), 0.75 ether, keccak256("forced native recovery"));
        _executeMigrationAfterDelay(forcedId);
        assertEq(address(pool).balance, 0);
        assertEq(address(candidate).balance, 1.75 ether);
    }

    // Catches migration receipts accepting arbitrary senders, zero-value calls, or creating sponsor/executor rights.
    function test_successor_accepts_migration_only_from_exact_predecessor() public {
        SettlementGasPool candidate = _deploySuccessor();
        vm.deal(address(pool), 1 ether);

        vm.prank(sponsor);
        vm.expectRevert(SettlementGasPool.NotPredecessor.selector);
        candidate.acceptMigration{value: 1 ether}(keccak256("forged receipt"));
        vm.prank(address(pool));
        vm.expectRevert(SettlementGasPool.ZeroValue.selector);
        candidate.acceptMigration(keccak256("zero receipt"));
        vm.prank(address(pool));
        candidate.acceptMigration{value: 1 ether}(keccak256("exact predecessor receipt"));
        assertEq(address(candidate).balance, 1 ether);
        assertEq(candidate.credits(address(pool)), 0);
        assertEq(candidate.totalCreditsRecorded(), 0);
        assertEq(candidate.totalOutstandingCredits(), 0);

        vm.deal(sponsor, sponsor.balance + 1 ether);
        vm.prank(sponsor);
        vm.expectRevert(SettlementGasPool.InvalidPredecessor.selector);
        pool.acceptMigration{value: 1 ether}(keccak256("no predecessor configured"));
    }

    // Catches effects surviving a rejected successor receipt or any failure spending unreserved balance non-atomically.
    function test_migration_reentrancy_or_failed_successor_receipt_reverts_atomically() public {
        fund(2 ether);
        unpause();
        MutableMigrationCandidate candidate = _validMutableCandidate();
        candidate.setRejectReceipt(true);
        bytes32 proposalId = _proposeMigration(address(candidate), 1 ether, MIGRATION_REASON);
        vm.warp(block.timestamp + 48 hours);

        vm.prank(safe);
        vm.expectRevert();
        pool.executeMigration(proposalId);
        assertFalse(pool.getMigrationProposal(proposalId).executed);
        assertEq(uint256(pool.migrationProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.EXECUTABLE));
        assertEq(pool.successor(), address(0));
        assertFalse(pool.retired());
        assertFalse(pool.paused());
        assertEq(address(pool).balance, 2 ether);
        assertEq(address(candidate).balance, 0);
    }

    // Catches removing the shared migration guard and permitting the successor callback to withdraw mid-transfer.
    function test_successor_receipt_callback_cannot_reenter_and_migration_is_atomic() public {
        pool = deployPool(address(0), MIGRATION_PRIORITY_CAP, MIGRATION_SETTLEMENT_CAP);
        fund(3 ether);
        unpause();
        MutableMigrationCandidate candidate = _validMutableCandidate();
        vm.fee(0);
        vm.txGasPrice(1_000 gwei);
        SettlementGasPool.CreditRequest memory candidateCredit = request(979_000);
        candidateCredit.executor = address(candidate);
        vm.prank(vault);
        (uint256 credit,) = pool.recordSettlementCredit(candidateCredit);
        assertEq(credit, 1 ether);
        assertEq(pool.unreservedBalance(), 2 ether);

        candidate.setAttemptWithdrawalReentry(true);
        bytes32 proposalId = _proposeMigration(address(candidate), 2 ether, MIGRATION_REASON);
        _executeMigrationAfterDelay(proposalId);

        assertEq(candidate.receiptCount(), 1);
        assertEq(candidate.lastMigrationProposalId(), proposalId);
        assertEq(candidate.totalMigrationReceived(), 2 ether);
        assertEq(address(candidate).balance, 2 ether);
        assertFalse(candidate.withdrawalReentrySucceeded());
        assertEq(candidate.withdrawalReentryErrorSelector(), bytes4(keccak256("ReentrancyGuardReentrantCall()")));
        assertEq(pool.credits(address(candidate)), 1 ether);
        assertEq(pool.totalOutstandingCredits(), 1 ether);
        assertEq(pool.totalCreditsWithdrawn(), 0);
        assertEq(address(pool).balance, 1 ether);
        assertEq(uint256(pool.migrationProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.EXECUTED));
        assertTrue(pool.retired());
        assertTrue(pool.paused());
    }

    function _deploySuccessor() private returns (SettlementGasPool candidate) {
        candidate = deployPool(address(pool), PRIORITY_CAP, SETTLEMENT_CAP);
    }

    function _validMutableCandidate() private returns (MutableMigrationCandidate candidate) {
        candidate = new MutableMigrationCandidate(pool.version(), block.chainid, vault, address(pool), safe, true);
    }

    function _expectInvalidCandidate(address candidate) private {
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.InvalidMigrationSuccessor.selector);
        pool.proposeMigration(candidate, 1 ether, MIGRATION_REASON);
    }

    function _proposeMigration(address candidate, uint256 amount, bytes32 reasonHash)
        private
        returns (bytes32 proposalId)
    {
        vm.prank(safe);
        proposalId = pool.proposeMigration(candidate, amount, reasonHash);
    }

    function _executeMigrationAfterDelay(bytes32 proposalId) private {
        vm.warp(block.timestamp + 48 hours);
        vm.prank(safe);
        pool.executeMigration(proposalId);
    }

    function _prepareExactLiabilityPool() private returns (SettlementGasPool candidate) {
        pool = deployPool(address(0), MIGRATION_PRIORITY_CAP, MIGRATION_SETTLEMENT_CAP);
        fund(3 ether);
        unpause();
        vm.fee(0);
        vm.txGasPrice(1_000 gwei);
        vm.prank(vault);
        (uint256 credit, SettlementGasPool.CreditStatus status) = pool.recordSettlementCredit(request(979_000));
        assertEq(credit, 1 ether);
        assertEq(uint256(status), uint256(SettlementGasPool.CreditStatus.FULL));
        assertEq(pool.totalOutstandingCredits(), 1 ether);
        assertEq(pool.unreservedBalance(), 2 ether);
        candidate = _deploySuccessor();
    }
}
