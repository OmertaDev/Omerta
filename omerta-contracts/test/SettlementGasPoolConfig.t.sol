// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ISettlementDataFeeSource} from "../src/interfaces/ISettlementDataFeeSource.sol";
import {SettlementGasPool} from "../src/SettlementGasPool.sol";
import {SettlementGasPoolTestBase} from "./utils/SettlementGasPoolTestBase.sol";

contract FixedDataFeeSource is ISettlementDataFeeSource {
    uint256 internal immutable fee;

    constructor(uint256 fee_) {
        fee = fee_;
    }

    function currentTransactionNativeDataFee() external view returns (uint256) {
        return fee;
    }
}

contract RevertingDataFeeSource is ISettlementDataFeeSource {
    function currentTransactionNativeDataFee() external pure returns (uint256) {
        revert("source unavailable");
    }
}

contract MalformedDataFeeSource {
    fallback() external {
        assembly ("memory-safe") {
            mstore(0, 1)
            return(31, 1)
        }
    }
}

contract ReentrantDataFeeSource {
    uint256 internal immutable fee;
    SettlementGasPool internal targetPool;
    SettlementGasPool internal probePool;
    bool internal attemptCreditReentry;

    constructor(uint256 fee_) {
        fee = fee_;
    }

    function configure(SettlementGasPool targetPool_, SettlementGasPool probePool_, bool attemptCreditReentry_)
        external
    {
        targetPool = targetPool_;
        probePool = probePool_;
        attemptCreditReentry = attemptCreditReentry_;
    }

    function currentTransactionNativeDataFee() external returns (uint256) {
        SettlementGasPool.CreditRequest memory probeRequest = SettlementGasPool.CreditRequest({
            eventId: keccak256("source-probe-event"),
            victimAccountId: keccak256("source-probe-victim"),
            victimNonce: 1,
            executor: address(this),
            measuredSettlementGas: 79_000
        });
        bool reentrySucceeded;
        if (attemptCreditReentry) {
            (reentrySucceeded,) =
                address(probePool).call(abi.encodeCall(SettlementGasPool.recordSettlementCredit, (probeRequest)));
        } else {
            (reentrySucceeded,) = address(targetPool).call(abi.encodeCall(SettlementGasPool.withdrawCredit, ()));
        }
        if (reentrySucceeded) return type(uint256).max;
        return fee;
    }

    receive() external payable {}
}

contract StaticContextMutationProbe {
    bool public mutated;

    function mutate() external {
        mutated = true;
    }
}

contract StaticContextDataFeeSource {
    StaticContextMutationProbe internal immutable probe;
    uint256 internal immutable fee;

    constructor(StaticContextMutationProbe probe_, uint256 fee_) {
        probe = probe_;
        fee = fee_;
    }

    function currentTransactionNativeDataFee() external returns (uint256) {
        (bool mutationSucceeded,) = address(probe).call(abi.encodeCall(StaticContextMutationProbe.mutate, ()));
        return mutationSucceeded ? type(uint256).max : fee;
    }
}

contract SettlementGasPoolConfigTest is SettlementGasPoolTestBase {
    bytes32 internal constant CONFIG_REASON = keccak256("reviewed settlement gas policy");
    bytes32 internal constant IMMEDIATE_REDUCTION_REASON = keccak256("immediate cap reduction");

    event ConfigProposalCancelled(bytes32 indexed proposalId, bytes32 indexed cancellationReasonHash);

    // Catches proposal IDs omitting their domain/current-next config/reason/time binding or incorrect schedule fields.
    function test_config_proposal_binds_current_and_next_config_reason_and_times() public {
        SettlementGasPool.Config memory baseConfig = currentConfig();
        SettlementGasPool.Config memory nextConfig = currentConfig();
        nextConfig.priorityFeeCapWei = 3 gwei;
        uint256 proposedAt = block.timestamp;

        bytes32 proposalId = propose(nextConfig, CONFIG_REASON);
        bytes32 expectedId = keccak256(
            abi.encode(
                "OMERTA_SETTLEMENT_GAS_POOL_CONFIG_V1",
                block.chainid,
                address(pool),
                uint256(1),
                configHash(baseConfig),
                configHash(nextConfig),
                CONFIG_REASON,
                proposedAt
            )
        );
        assertEq(proposalId, expectedId);

        SettlementGasPool.ConfigProposal memory proposal = pool.getConfigProposal(proposalId);
        assertEq(proposal.id, proposalId);
        assertEq(proposal.baseConfigHash, configHash(baseConfig));
        assertEq(configHash(proposal.nextConfig), configHash(nextConfig));
        assertEq(proposal.reasonHash, CONFIG_REASON);
        assertEq(proposal.proposedAt, proposedAt);
        assertEq(proposal.executableAt, proposedAt + 48 hours);
        assertEq(proposal.expiresAt, proposedAt + 48 hours + 7 days);
        assertFalse(proposal.executed);
        assertFalse(proposal.cancelled);
        assertEq(uint256(pool.configProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.WAITING));
        assertEq(
            uint256(pool.configProposalState(bytes32(uint256(123)))), uint256(SettlementGasPool.ProposalState.NONE)
        );
    }

    // Catches an off-by-one that permits execution one second before the exact 48-hour delay.
    function test_config_cannot_execute_before_exact_48_hour_boundary() public {
        SettlementGasPool.Config memory nextConfig = currentConfig();
        nextConfig.priorityFeeCapWei = 3 gwei;
        bytes32 proposalId = propose(nextConfig, CONFIG_REASON);

        vm.warp(block.timestamp + 48 hours - 1);
        assertEq(uint256(pool.configProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.WAITING));
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.ProposalNotExecutable.selector);
        pool.executeConfigProposal(proposalId);
    }

    // Catches excluding the exact execution boundaries or allowing execution after the seven-day window.
    function test_config_executes_at_48_hours_and_expires_after_7_day_window() public {
        SettlementGasPool.Config memory firstConfig = currentConfig();
        firstConfig.priorityFeeCapWei = 3 gwei;
        bytes32 firstId = propose(firstConfig, CONFIG_REASON);
        vm.warp(block.timestamp + 48 hours);
        assertEq(uint256(pool.configProposalState(firstId)), uint256(SettlementGasPool.ProposalState.EXECUTABLE));
        vm.prank(safe);
        pool.executeConfigProposal(firstId);
        assertEq(uint256(pool.configProposalState(firstId)), uint256(SettlementGasPool.ProposalState.EXECUTED));
        assertEq(currentConfig().priorityFeeCapWei, 3 gwei);

        SettlementGasPool.Config memory secondConfig = currentConfig();
        secondConfig.priorityFeeCapWei = 4 gwei;
        bytes32 secondId = propose(secondConfig, keccak256("second reviewed change"));
        SettlementGasPool.ConfigProposal memory secondProposal = pool.getConfigProposal(secondId);
        vm.warp(secondProposal.expiresAt);
        assertEq(uint256(pool.configProposalState(secondId)), uint256(SettlementGasPool.ProposalState.EXECUTABLE));
        vm.warp(secondProposal.expiresAt + 1);
        assertEq(uint256(pool.configProposalState(secondId)), uint256(SettlementGasPool.ProposalState.EXPIRED));
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.ProposalNotExecutable.selector);
        pool.executeConfigProposal(secondId);
    }

    // Catches unauthorized cancellation, missing terminal cancellation state, or cancelling twice.
    function test_config_proposal_can_be_cancelled_only_by_owner() public {
        SettlementGasPool.Config memory nextConfig = currentConfig();
        nextConfig.priorityFeeCapWei = 3 gwei;
        bytes32 proposalId = propose(nextConfig, CONFIG_REASON);

        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, sponsor));
        pool.cancelConfigProposal(proposalId);
        vm.prank(safe);
        pool.cancelConfigProposal(proposalId);
        assertEq(uint256(pool.configProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.CANCELLED));
        assertTrue(pool.getConfigProposal(proposalId).cancelled);
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.ProposalNotCancellable.selector);
        pool.cancelConfigProposal(proposalId);
    }

    // Catches overlapping waiting/executable proposals while allowing a replacement after terminal expiry.
    function test_only_one_live_config_proposal_exists() public {
        SettlementGasPool.Config memory nextConfig = currentConfig();
        nextConfig.priorityFeeCapWei = 3 gwei;
        bytes32 firstId = propose(nextConfig, CONFIG_REASON);

        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.LiveConfigProposalExists.selector);
        pool.proposeConfig(nextConfig, keccak256("overlapping review"));
        SettlementGasPool.ConfigProposal memory firstProposal = pool.getConfigProposal(firstId);
        vm.warp(firstProposal.expiresAt + 1);
        bytes32 replacementId = propose(nextConfig, keccak256("fresh review"));
        assertTrue(replacementId != firstId);
        assertEq(uint256(pool.configProposalState(replacementId)), uint256(SettlementGasPool.ProposalState.WAITING));
    }

    // Catches an immediate reduction leaving a stale increase executable or omitting its fixed cancellation reason.
    function test_immediate_cap_reduction_cancels_live_config_proposal() public {
        SettlementGasPool.Config memory nextConfig = currentConfig();
        nextConfig.priorityFeeCapWei = 3 gwei;
        bytes32 proposalId = propose(nextConfig, CONFIG_REASON);

        vm.prank(safe);
        vm.expectEmit(true, true, false, true, address(pool));
        emit ConfigProposalCancelled(proposalId, IMMEDIATE_REDUCTION_REASON);
        pool.reduceCaps(1 gwei, 0.01 ether, 0);
        assertEq(uint256(pool.configProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.CANCELLED));
        assertEq(currentConfig().priorityFeeCapWei, 1 gwei);

        vm.warp(block.timestamp + 48 hours);
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.ProposalNotExecutable.selector);
        pool.executeConfigProposal(proposalId);
        assertEq(currentConfig().priorityFeeCapWei, 1 gwei);
    }

    // Catches reasonless, no-op, or purely monotonic-decrease changes entering the delayed increase path.
    function test_noop_or_decrease_only_proposal_is_rejected() public {
        SettlementGasPool.Config memory unchanged = currentConfig();
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.ZeroReason.selector);
        pool.proposeConfig(unchanged, bytes32(0));
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.NoConfigChange.selector);
        pool.proposeConfig(unchanged, CONFIG_REASON);

        SettlementGasPool.Config memory decreaseOnly = unchanged;
        decreaseOnly.priorityFeeCapWei = 1 gwei;
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.ConfigIncreaseRequired.selector);
        pool.proposeConfig(decreaseOnly, CONFIG_REASON);
    }

    // Catches enabling an unreviewable source, a mismatched runtime, or incoherent source/hash/cap triples.
    function test_source_requires_contract_exact_runtime_hash_and_positive_data_cap() public {
        vm.expectRevert(SettlementGasPool.InvalidDataFeeSourceConfig.selector);
        new SettlementGasPool(
            safe, vault, address(0), OVERHEAD_GAS, PRIORITY_CAP, SETTLEMENT_CAP, uint128(0.0001 ether)
        );

        SettlementGasPool.Config memory nextConfig = currentConfig();
        nextConfig.priorityFeeCapWei = 3 gwei;
        nextConfig.dataFeeSourceRuntimeCodeHash = bytes32(uint256(1));
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.InvalidDataFeeSourceConfig.selector);
        pool.proposeConfig(nextConfig, CONFIG_REASON);

        nextConfig = currentConfig();
        nextConfig.priorityFeeCapWei = 3 gwei;
        nextConfig.dataFeeWeiCap = 1;
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.InvalidDataFeeSourceConfig.selector);
        pool.proposeConfig(nextConfig, CONFIG_REASON);

        nextConfig.dataFeeSource = makeAddr("notAContract");
        nextConfig.dataFeeSourceRuntimeCodeHash = nextConfig.dataFeeSource.codehash;
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.InvalidDataFeeSource.selector);
        pool.proposeConfig(nextConfig, CONFIG_REASON);

        FixedDataFeeSource source = new FixedDataFeeSource(0.0004 ether);
        nextConfig.dataFeeSource = address(source);
        nextConfig.dataFeeSourceRuntimeCodeHash = bytes32(uint256(2));
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.DataFeeSourceCodeHashMismatch.selector);
        pool.proposeConfig(nextConfig, CONFIG_REASON);

        nextConfig.dataFeeSourceRuntimeCodeHash = address(source).codehash;
        nextConfig.dataFeeWeiCap = 0;
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.InvalidDataFeeSourceConfig.selector);
        pool.proposeConfig(nextConfig, CONFIG_REASON);

        nextConfig.dataFeeWeiCap = 0.0001 ether;
        bytes32 proposalId = propose(nextConfig, CONFIG_REASON);
        assertEq(uint256(pool.configProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.WAITING));
    }

    // Catches executing a proposal after the reviewed source bytecode has changed or disappeared.
    function test_execute_rechecks_source_code_hash() public {
        FixedDataFeeSource source = new FixedDataFeeSource(0.0004 ether);
        SettlementGasPool.Config memory nextConfig = currentConfig();
        nextConfig.dataFeeWeiCap = 0.0001 ether;
        nextConfig.dataFeeSource = address(source);
        nextConfig.dataFeeSourceRuntimeCodeHash = address(source).codehash;
        bytes32 proposalId = propose(nextConfig, CONFIG_REASON);
        vm.etch(address(source), hex"00");

        vm.warp(block.timestamp + 48 hours);
        vm.prank(safe);
        vm.expectRevert(SettlementGasPool.DataFeeSourceCodeHashMismatch.selector);
        pool.executeConfigProposal(proposalId);
        assertEq(currentConfig().dataFeeSource, address(0));
        assertEq(uint256(pool.configProposalState(proposalId)), uint256(SettlementGasPool.ProposalState.EXECUTABLE));
    }

    // Catches omitting the reviewed native data fee, failing to cap it, or adding it outside the settlement cap.
    function test_reviewed_source_fee_is_capped_and_added_to_verified_cost() public {
        FixedDataFeeSource source = new FixedDataFeeSource(0.0004 ether);
        SettlementGasPool.Config memory nextConfig = currentConfig();
        nextConfig.dataFeeWeiCap = 0.0001 ether;
        nextConfig.dataFeeSource = address(source);
        nextConfig.dataFeeSourceRuntimeCodeHash = address(source).codehash;
        executeAfterDelay(propose(nextConfig, CONFIG_REASON));
        fund(1 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);

        (,, uint256 approvedDataFee, uint256 verifiedGasCost,, uint256 credit,) = pool.previewCredit(79_000);
        assertEq(approvedDataFee, 0.0001 ether);
        assertEq(verifiedGasCost, 0.0023 ether);
        assertEq(credit, 0.0023 ether);

        vm.prank(vault);
        (uint256 recorded,) = pool.recordSettlementCredit(request(79_000));
        assertEq(recorded, 0.0023 ether);
        assertEq(pool.credits(executor), 0.0023 ether);
        assertEq(pool.totalOutstandingCredits(), 0.0023 ether);
    }

    // Catches applying the data fee after, rather than within, the exact per-settlement cap.
    function test_data_fee_is_capped_inside_per_settlement_cap_at_boundary() public {
        FixedDataFeeSource source = new FixedDataFeeSource(0.0004 ether);
        _configureSource(address(source), address(source).codehash);
        vm.prank(safe);
        pool.reduceCaps(PRIORITY_CAP, uint128(0.0022 ether), uint128(0.0001 ether));
        fund(1 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);

        (,, uint256 approvedDataFee, uint256 verifiedGasCost,, uint256 previewedCredit,) = pool.previewCredit(79_000);
        assertEq(approvedDataFee, 0.0001 ether);
        assertEq(verifiedGasCost, 0.0022 ether);
        assertEq(previewedCredit, 0.0022 ether);

        vm.prank(vault);
        (uint256 recorded,) = pool.recordSettlementCredit(request(79_000));
        assertEq(recorded, 0.0022 ether);
        assertEq(pool.credits(executor), 0.0022 ether);
        assertEq(pool.totalOutstandingCredits(), 0.0022 ether);
    }

    // Catches source failures, malformed ABI, or runtime drift bubbling up and stranding settlement replay processing.
    function test_reverting_malformed_or_drifted_source_returns_zero_fee_without_reverting_credit() public {
        RevertingDataFeeSource revertingSource = new RevertingDataFeeSource();
        _assertBrokenSourceRecordsGasOnly(address(revertingSource), address(revertingSource).codehash, 7);

        MalformedDataFeeSource malformedSource = new MalformedDataFeeSource();
        _resetPool();
        _assertBrokenSourceRecordsGasOnly(address(malformedSource), address(malformedSource).codehash, 8);

        FixedDataFeeSource driftedSource = new FixedDataFeeSource(0.0004 ether);
        _resetPool();
        _configureSource(address(driftedSource), address(driftedSource).codehash);
        vm.etch(address(driftedSource), hex"00");
        _assertGasOnlyPreviewAndRecord(9);
    }

    // Catches runtime drift being hidden behind a replacement that still returns a valid, nonzero ABI fee.
    function test_runtime_code_hash_drift_alone_forces_valid_nonzero_source_fee_to_zero() public {
        FixedDataFeeSource source = new FixedDataFeeSource(0.0004 ether);
        _configureSource(address(source), address(source).codehash);
        bytes memory replacementRuntime = hex"600760005260206000f3";
        vm.etch(address(source), replacementRuntime);

        (bool directSuccess, bytes memory directResult) = address(source)
            .staticcall(abi.encodeWithSelector(ISettlementDataFeeSource.currentTransactionNativeDataFee.selector));
        assertTrue(directSuccess);
        assertEq(directResult.length, 32);
        assertEq(abi.decode(directResult, (uint256)), 7);
        assertTrue(address(source).codehash != currentConfig().dataFeeSourceRuntimeCodeHash);

        fund(1 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);
        (,, uint256 approvedDataFee, uint256 verifiedGasCost,, uint256 previewedCredit,) = pool.previewCredit(79_000);
        assertEq(approvedDataFee, 0);
        assertEq(verifiedGasCost, 0.0022 ether);
        assertEq(previewedCredit, 0.0022 ether);
    }

    // Catches replacing STATICCALL with CALL, which would let a reviewed source mutate credit or withdrawal state.
    function test_data_source_cannot_reenter_credit_or_withdraw_through_staticcall() public {
        ReentrantDataFeeSource withdrawalSource = new ReentrantDataFeeSource(0.0001 ether);
        withdrawalSource.configure(pool, SettlementGasPool(payable(address(0))), false);

        fund(1 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);
        SettlementGasPool.CreditRequest memory sourceCredit = request(79_000);
        sourceCredit.executor = address(withdrawalSource);
        vm.prank(vault);
        pool.recordSettlementCredit(sourceCredit);
        assertEq(pool.credits(address(withdrawalSource)), 0.0022 ether);
        _configureSource(address(withdrawalSource), address(withdrawalSource).codehash);

        (,, uint256 approvedDataFee, uint256 verifiedGasCost,, uint256 previewedCredit,) = pool.previewCredit(79_000);
        assertEq(approvedDataFee, 0.0001 ether);
        assertEq(verifiedGasCost, 0.0023 ether);
        assertEq(previewedCredit, 0.0023 ether);
        assertEq(pool.credits(address(withdrawalSource)), 0.0022 ether);
        assertEq(pool.totalCreditsWithdrawn(), 0);

        SettlementGasPool.CreditRequest memory outerRequest = request(79_000);
        outerRequest.victimNonce = 8;
        vm.prank(vault);
        (uint256 recorded,) = pool.recordSettlementCredit(outerRequest);
        assertEq(recorded, 0.0023 ether);
        assertEq(pool.credits(address(withdrawalSource)), 0.0022 ether);
        assertEq(pool.credits(executor), 0.0023 ether);
        assertEq(pool.totalCreditsRecorded(), 0.0045 ether);
        assertEq(pool.totalOutstandingCredits(), 0.0045 ether);
        assertEq(pool.totalCreditsWithdrawn(), 0);

        _resetPool();
        ReentrantDataFeeSource creditSource = new ReentrantDataFeeSource(0.0001 ether);
        SettlementGasPool probePool = new SettlementGasPool(
            safe, address(creditSource), address(0), OVERHEAD_GAS, PRIORITY_CAP, SETTLEMENT_CAP, 0
        );
        creditSource.configure(pool, probePool, true);
        _configureSource(address(creditSource), address(creditSource).codehash);
        fund(1 ether);
        unpause();
        bytes32 probeKey = probePool.settlementKey(keccak256("source-probe-event"), keccak256("source-probe-victim"), 1);

        (,, approvedDataFee, verifiedGasCost,, previewedCredit,) = pool.previewCredit(79_000);
        assertEq(approvedDataFee, 0.0001 ether);
        assertEq(verifiedGasCost, 0.0023 ether);
        assertEq(previewedCredit, 0.0023 ether);
        assertFalse(probePool.processedSettlements(probeKey));
        assertEq(probePool.totalCreditsRecorded(), 0);

        vm.prank(vault);
        (recorded,) = pool.recordSettlementCredit(request(79_000));
        assertEq(recorded, 0.0023 ether);
        assertFalse(probePool.processedSettlements(probeKey));
        assertEq(probePool.totalCreditsRecorded(), 0);
        assertEq(pool.credits(executor), 0.0023 ether);
        assertEq(pool.totalOutstandingCredits(), 0.0023 ether);

        _resetPool();
        StaticContextMutationProbe mutationProbe = new StaticContextMutationProbe();
        StaticContextDataFeeSource contextSource = new StaticContextDataFeeSource(mutationProbe, 7);
        _configureSource(address(contextSource), address(contextSource).codehash);
        fund(1 ether);
        unpause();

        (,, approvedDataFee, verifiedGasCost,, previewedCredit,) = pool.previewCredit(79_000);
        assertEq(approvedDataFee, 7);
        assertEq(verifiedGasCost, 0.0022 ether + 7);
        assertEq(previewedCredit, 0.0022 ether + 7);
        assertFalse(mutationProbe.mutated());
    }

    // Catches delayed configuration rewriting existing executor balances or aggregate exact liabilities.
    function test_config_changes_do_not_mutate_existing_credits_or_liabilities() public {
        fund(1 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);
        vm.prank(vault);
        pool.recordSettlementCredit(request(79_000));
        assertEq(pool.credits(executor), 0.0022 ether);

        SettlementGasPool.Config memory nextConfig = currentConfig();
        nextConfig.priorityFeeCapWei = 3 gwei;
        nextConfig.perSettlementWeiCap = 0.03 ether;
        executeAfterDelay(propose(nextConfig, CONFIG_REASON));

        assertEq(pool.credits(executor), 0.0022 ether);
        assertEq(pool.totalCreditsRecorded(), 0.0022 ether);
        assertEq(pool.totalOutstandingCredits(), 0.0022 ether);
        assertEq(pool.totalCreditsWithdrawn(), 0);
        vm.prank(executor);
        assertEq(pool.withdrawCredit(), 0.0022 ether);
        assertEq(pool.totalOutstandingCredits(), 0);
        assertEq(pool.totalCreditsWithdrawn(), 0.0022 ether);
    }

    function _resetPool() private {
        pool = new SettlementGasPool(safe, vault, address(0), OVERHEAD_GAS, PRIORITY_CAP, SETTLEMENT_CAP, 0);
    }

    function _configureSource(address source, bytes32 runtimeCodeHash) private {
        SettlementGasPool.Config memory nextConfig = currentConfig();
        nextConfig.dataFeeWeiCap = 0.0001 ether;
        nextConfig.dataFeeSource = source;
        nextConfig.dataFeeSourceRuntimeCodeHash = runtimeCodeHash;
        executeAfterDelay(propose(nextConfig, CONFIG_REASON));
    }

    function _assertBrokenSourceRecordsGasOnly(address source, bytes32 runtimeCodeHash, uint256 victimNonce) private {
        _configureSource(source, runtimeCodeHash);
        _assertGasOnlyPreviewAndRecord(victimNonce);
    }

    function _assertGasOnlyPreviewAndRecord(uint256 victimNonce) private {
        fund(1 ether);
        unpause();
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);
        (,, uint256 approvedDataFee, uint256 verifiedGasCost,, uint256 previewedCredit,) = pool.previewCredit(79_000);
        assertEq(approvedDataFee, 0);
        assertEq(verifiedGasCost, 0.0022 ether);
        assertEq(previewedCredit, 0.0022 ether);

        SettlementGasPool.CreditRequest memory req = request(79_000);
        req.victimNonce = victimNonce;
        bytes32 key = pool.settlementKey(EVENT_ID, VICTIM_ID, victimNonce);
        vm.prank(vault);
        (uint256 recorded,) = pool.recordSettlementCredit(req);
        assertEq(recorded, 0.0022 ether);
        assertTrue(pool.processedSettlements(key));
        assertEq(pool.credits(executor), 0.0022 ether);
        assertEq(pool.totalOutstandingCredits(), 0.0022 ether);
    }
}
