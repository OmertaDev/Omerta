// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISettlementDataFeeSource} from "./interfaces/ISettlementDataFeeSource.sol";

interface ISettlementGasPoolMigrationCandidate {
    function version() external view returns (bytes32);
    function supportedChainId() external view returns (uint256);
    function gameplayVault() external view returns (address);
    function predecessor() external view returns (address);
    function owner() external view returns (address);
    function paused() external view returns (bool);
    function acceptMigration(bytes32 migrationProposalId) external payable;
}

/// @title SettlementGasPool
/// @notice Community-funded native-gas credits for successful gameplay settlements.
/// @dev Credits are exact pull-payment liabilities. The immutable gameplay vault records them;
///      contributors and the owner acquire no withdrawal right over unreserved sponsorship.
contract SettlementGasPool is Ownable2Step, Pausable, ReentrancyGuard {
    enum ProposalState {
        NONE,
        WAITING,
        EXECUTABLE,
        EXECUTED,
        CANCELLED,
        EXPIRED
    }

    enum CreditStatus {
        FULL,
        PARTIAL,
        ZERO_PAUSED,
        ZERO_UNFUNDED,
        ZERO_CAP,
        ZERO_RETIRED
    }

    struct CreditRequest {
        bytes32 eventId;
        bytes32 victimAccountId;
        uint256 victimNonce;
        address executor;
        uint256 measuredSettlementGas;
    }

    struct Config {
        uint128 priorityFeeCapWei;
        uint128 perSettlementWeiCap;
        uint128 dataFeeWeiCap;
        address dataFeeSource;
        bytes32 dataFeeSourceRuntimeCodeHash;
    }

    struct CreditCalculation {
        uint256 billableGas;
        uint256 reimbursableGasPrice;
        uint256 approvedDataFee;
        uint256 verifiedGasCost;
        uint256 available;
        uint256 credit;
        CreditStatus status;
    }

    struct ConfigProposal {
        bytes32 id;
        bytes32 baseConfigHash;
        Config nextConfig;
        bytes32 reasonHash;
        uint64 proposedAt;
        uint64 executableAt;
        uint64 expiresAt;
        bool executed;
        bool cancelled;
    }

    struct MigrationProposal {
        bytes32 id;
        address successor;
        bytes32 successorRuntimeCodeHash;
        uint256 amount;
        bytes32 reasonHash;
        uint64 proposedAt;
        uint64 executableAt;
        uint64 expiresAt;
        bool executed;
        bool cancelled;
    }

    uint64 public constant CONFIG_DELAY = 48 hours;
    uint64 public constant PROPOSAL_EXECUTION_WINDOW = 7 days;
    uint256 private constant DATA_FEE_SOURCE_CALL_GAS = 30_000;
    bytes32 private constant IMMEDIATE_CAP_REDUCTION_REASON = keccak256("immediate cap reduction");

    uint256 public immutable supportedChainId;
    address public immutable gameplayVault;
    address public immutable predecessor;
    uint64 public immutable auditedOverheadGas;

    Config public config;
    address public successor;
    bool public retired;
    uint256 private proposalNonce;
    uint256 private migrationProposalNonce;
    bytes32 private liveConfigProposalId;
    mapping(bytes32 proposalId => ConfigProposal proposal) private configProposals;
    mapping(bytes32 proposalId => MigrationProposal proposal) private migrationProposals;
    mapping(bytes32 settlement => bool processed) public processedSettlements;
    mapping(address executor => uint256 amount) public credits;
    uint256 public totalCreditsRecorded;
    uint256 public totalOutstandingCredits;
    uint256 public totalCreditsWithdrawn;

    error ZeroAddress();
    error ZeroValue();
    error ZeroId();
    error InvalidOverhead();
    error InvalidCap();
    error InvalidPredecessor();
    error NotGameplayVault();
    error AlreadyProcessed();
    error NoCredit();
    error WithdrawalFailed();
    error ZeroReason();
    error CapIncreaseNotAllowed();
    error Insolvent();
    error PoolRetired();
    error OwnershipRenunciationDisabled();
    error NoConfigChange();
    error ConfigIncreaseRequired();
    error InvalidDataFeeSourceConfig();
    error InvalidDataFeeSource();
    error DataFeeSourceCodeHashMismatch();
    error LiveConfigProposalExists();
    error ProposalNotCancellable();
    error ProposalNotExecutable();
    error BaseConfigChanged();
    error InsufficientUnreservedBalance();
    error InvalidMigrationSuccessor();
    error SuccessorCodeHashMismatch();
    error SuccessorAlreadyLatched();
    error NotPredecessor();

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
        CreditStatus status
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
    event ConfigProposalCreated(
        bytes32 indexed proposalId,
        bytes32 indexed baseConfigHash,
        bytes32 indexed nextConfigHash,
        bytes32 reasonHash,
        uint64 proposedAt,
        uint64 executableAt,
        uint64 expiresAt
    );
    event ConfigProposalCancelled(bytes32 indexed proposalId, bytes32 indexed cancellationReasonHash);
    event ConfigProposalExecuted(
        bytes32 indexed proposalId,
        bytes32 indexed oldConfigHash,
        bytes32 indexed newConfigHash,
        bytes32 reasonHash,
        uint64 proposedAt,
        uint64 executableAt,
        uint64 expiresAt,
        uint64 executedAt
    );
    event MigrationProposalCreated(
        bytes32 indexed proposalId,
        address indexed successor,
        bytes32 indexed successorRuntimeCodeHash,
        uint256 amount,
        bytes32 reasonHash,
        uint64 proposedAt,
        uint64 executableAt,
        uint64 expiresAt
    );
    event MigrationProposalCancelled(bytes32 indexed proposalId);
    event MigrationExecuted(
        bytes32 indexed proposalId,
        address indexed successor,
        uint256 amount,
        uint64 proposedAt,
        uint64 executableAt,
        uint64 expiresAt,
        uint64 executedAt
    );
    event MigrationReceived(
        bytes32 indexed proposalId,
        address indexed predecessor,
        uint256 amount,
        uint256 poolBalance,
        uint256 unreservedBalance
    );

    constructor(
        address safeOwner,
        address gameplayVault_,
        address predecessor_,
        uint64 auditedOverheadGas_,
        uint128 initialPriorityFeeCapWei,
        uint128 initialPerSettlementWeiCap,
        uint128 initialDataFeeWeiCap
    ) Ownable(safeOwner) {
        if (gameplayVault_ == address(0)) revert ZeroAddress();
        if (auditedOverheadGas_ == 0) revert InvalidOverhead();
        if (initialPriorityFeeCapWei == 0 || initialPerSettlementWeiCap == 0) revert InvalidCap();
        if (initialDataFeeWeiCap != 0) revert InvalidDataFeeSourceConfig();
        if (predecessor_ != address(0) && predecessor_.code.length == 0) revert InvalidPredecessor();

        supportedChainId = block.chainid;
        gameplayVault = gameplayVault_;
        predecessor = predecessor_;
        auditedOverheadGas = auditedOverheadGas_;
        config = Config({
            priorityFeeCapWei: initialPriorityFeeCapWei,
            perSettlementWeiCap: initialPerSettlementWeiCap,
            dataFeeWeiCap: initialDataFeeWeiCap,
            dataFeeSource: address(0),
            dataFeeSourceRuntimeCodeHash: bytes32(0)
        });
        _pause();
    }

    receive() external payable {
        _recordContribution(bytes32(0));
    }

    function contribute(bytes32 memo) external payable {
        _recordContribution(memo);
    }

    function acceptMigration(bytes32 migrationProposalId) external payable {
        if (predecessor == address(0)) revert InvalidPredecessor();
        if (msg.sender != predecessor) revert NotPredecessor();
        if (msg.value == 0) revert ZeroValue();
        emit MigrationReceived(migrationProposalId, msg.sender, msg.value, address(this).balance, unreservedBalance());
    }

    function recordSettlementCredit(CreditRequest calldata request)
        external
        returns (uint256 credit, CreditStatus status)
    {
        if (msg.sender != gameplayVault) revert NotGameplayVault();
        if (request.eventId == bytes32(0) || request.victimAccountId == bytes32(0)) revert ZeroId();
        if (request.executor == address(0)) revert ZeroAddress();

        bytes32 key = settlementKey(request.eventId, request.victimAccountId, request.victimNonce);
        if (processedSettlements[key]) revert AlreadyProcessed();
        processedSettlements[key] = true;

        CreditCalculation memory calculation = _calculateCredit(request.measuredSettlementGas);
        credit = calculation.credit;
        status = calculation.status;
        if (credit != 0) {
            credits[request.executor] += credit;
            totalCreditsRecorded += credit;
            totalOutstandingCredits += credit;
        }

        emit SettlementProcessed(
            key, request.eventId, request.victimAccountId, request.victimNonce, request.executor, status
        );
        emit SettlementCreditCalculated(
            key,
            request.measuredSettlementGas,
            calculation.billableGas,
            calculation.reimbursableGasPrice,
            calculation.approvedDataFee,
            calculation.verifiedGasCost,
            calculation.available,
            credit
        );
    }

    function withdrawCredit() external nonReentrant returns (uint256 amount) {
        amount = credits[msg.sender];
        if (amount == 0) revert NoCredit();

        credits[msg.sender] = 0;
        totalOutstandingCredits -= amount;
        totalCreditsWithdrawn += amount;

        (bool sent,) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert WithdrawalFailed();

        emit CreditWithdrawn(msg.sender, amount, totalCreditsWithdrawn, totalOutstandingCredits, address(this).balance);
    }

    function unreservedBalance() public view returns (uint256) {
        uint256 balance = address(this).balance;
        if (balance <= totalOutstandingCredits) return 0;
        return balance - totalOutstandingCredits;
    }

    function settlementKey(bytes32 eventId, bytes32 victimAccountId, uint256 victimNonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(supportedChainId, gameplayVault, eventId, victimAccountId, victimNonce));
    }

    function previewCredit(uint256 measuredSettlementGas)
        external
        view
        returns (
            uint256 billableGas,
            uint256 reimbursableGasPrice,
            uint256 approvedDataFee,
            uint256 verifiedGasCost,
            uint256 available,
            uint256 credit,
            CreditStatus status
        )
    {
        CreditCalculation memory calculation = _calculateCredit(measuredSettlementGas);
        return (
            calculation.billableGas,
            calculation.reimbursableGasPrice,
            calculation.approvedDataFee,
            calculation.verifiedGasCost,
            calculation.available,
            calculation.credit,
            calculation.status
        );
    }

    function pauseCredits(bytes32 reasonHash) external onlyOwner {
        if (reasonHash == bytes32(0)) revert ZeroReason();
        _pause();
        emit CreditsPaused(reasonHash);
    }

    function unpauseCredits(bytes32 reasonHash) external onlyOwner {
        if (reasonHash == bytes32(0)) revert ZeroReason();
        if (retired) revert PoolRetired();
        if (address(this).balance < totalOutstandingCredits) revert Insolvent();
        _unpause();
        emit CreditsUnpaused(reasonHash);
    }

    function reduceCaps(uint128 priorityFeeCapWei, uint128 perSettlementWeiCap, uint128 dataFeeWeiCap)
        external
        onlyOwner
    {
        if (retired) revert PoolRetired();
        Config memory oldConfig = config;
        if (
            priorityFeeCapWei > oldConfig.priorityFeeCapWei || perSettlementWeiCap > oldConfig.perSettlementWeiCap
                || dataFeeWeiCap > oldConfig.dataFeeWeiCap
        ) revert CapIncreaseNotAllowed();

        if (
            priorityFeeCapWei != oldConfig.priorityFeeCapWei || perSettlementWeiCap != oldConfig.perSettlementWeiCap
                || dataFeeWeiCap != oldConfig.dataFeeWeiCap
        ) {
            _cancelLiveConfigProposal(IMMEDIATE_CAP_REDUCTION_REASON);
        }

        config.priorityFeeCapWei = priorityFeeCapWei;
        config.perSettlementWeiCap = perSettlementWeiCap;
        config.dataFeeWeiCap = dataFeeWeiCap;
        emit CapsReduced(
            oldConfig.priorityFeeCapWei,
            priorityFeeCapWei,
            oldConfig.perSettlementWeiCap,
            perSettlementWeiCap,
            oldConfig.dataFeeWeiCap,
            dataFeeWeiCap
        );
    }

    function proposeConfig(Config calldata nextConfig, bytes32 reasonHash)
        external
        onlyOwner
        returns (bytes32 proposalId)
    {
        if (retired) revert PoolRetired();
        if (reasonHash == bytes32(0)) revert ZeroReason();

        ProposalState liveState = configProposalState(liveConfigProposalId);
        if (liveState == ProposalState.WAITING || liveState == ProposalState.EXECUTABLE) {
            revert LiveConfigProposalExists();
        }
        (bytes32 baseConfigHash, bytes32 nextConfigHash) = _validateProposedConfig(nextConfig);

        uint64 proposedAt = uint64(block.timestamp);
        proposalId = _deriveProposalId(++proposalNonce, baseConfigHash, nextConfigHash, reasonHash);

        ConfigProposal storage proposal = configProposals[proposalId];
        proposal.id = proposalId;
        proposal.baseConfigHash = baseConfigHash;
        proposal.nextConfig = nextConfig;
        proposal.reasonHash = reasonHash;
        proposal.proposedAt = proposedAt;
        proposal.executableAt = proposedAt + CONFIG_DELAY;
        proposal.expiresAt = proposal.executableAt + PROPOSAL_EXECUTION_WINDOW;
        liveConfigProposalId = proposalId;
        _emitConfigProposalCreated(proposal, nextConfigHash);
    }

    function cancelConfigProposal(bytes32 proposalId) external onlyOwner {
        ProposalState state = configProposalState(proposalId);
        if (state != ProposalState.WAITING && state != ProposalState.EXECUTABLE) {
            revert ProposalNotCancellable();
        }
        configProposals[proposalId].cancelled = true;
        if (liveConfigProposalId == proposalId) liveConfigProposalId = bytes32(0);
        emit ConfigProposalCancelled(proposalId, bytes32(0));
    }

    function executeConfigProposal(bytes32 proposalId) external onlyOwner {
        if (retired) revert PoolRetired();
        if (configProposalState(proposalId) != ProposalState.EXECUTABLE) revert ProposalNotExecutable();

        ConfigProposal storage proposal = configProposals[proposalId];
        bytes32 oldConfigHash = _configHash(config);
        if (oldConfigHash != proposal.baseConfigHash) revert BaseConfigChanged();
        _validateDataFeeSourceConfig(proposal.nextConfig);

        bytes32 newConfigHash = _configHash(proposal.nextConfig);
        proposal.executed = true;
        if (liveConfigProposalId == proposalId) liveConfigProposalId = bytes32(0);
        config = proposal.nextConfig;

        emit ConfigProposalExecuted(
            proposalId,
            oldConfigHash,
            newConfigHash,
            proposal.reasonHash,
            proposal.proposedAt,
            proposal.executableAt,
            proposal.expiresAt,
            uint64(block.timestamp)
        );
    }

    function getConfigProposal(bytes32 proposalId) external view returns (ConfigProposal memory) {
        return configProposals[proposalId];
    }

    function configProposalState(bytes32 proposalId) public view returns (ProposalState) {
        ConfigProposal storage proposal = configProposals[proposalId];
        if (proposal.id == bytes32(0)) return ProposalState.NONE;
        if (proposal.executed) return ProposalState.EXECUTED;
        if (proposal.cancelled) return ProposalState.CANCELLED;
        if (block.timestamp < proposal.executableAt) return ProposalState.WAITING;
        if (block.timestamp > proposal.expiresAt) return ProposalState.EXPIRED;
        return ProposalState.EXECUTABLE;
    }

    /// @dev The Safe-selected runtime hash and identity getters prove consistency, not semantic provenance.
    ///      Before proposing, the Safe launch ceremony must independently reproduce and review the successor.
    function proposeMigration(address successor_, uint256 amount, bytes32 reasonHash)
        external
        onlyOwner
        returns (bytes32 proposalId)
    {
        if (amount == 0) revert ZeroValue();
        if (reasonHash == bytes32(0)) revert ZeroReason();
        if (amount > unreservedBalance()) revert InsufficientUnreservedBalance();
        _validateMigrationSuccessor(successor_);

        bytes32 successorRuntimeCodeHash = successor_.codehash;
        uint64 proposedAt = uint64(block.timestamp);
        uint64 executableAt = proposedAt + CONFIG_DELAY;
        uint64 expiresAt = executableAt + PROPOSAL_EXECUTION_WINDOW;
        proposalId = _deriveMigrationProposalId(
            ++migrationProposalNonce,
            successor_,
            successorRuntimeCodeHash,
            amount,
            reasonHash,
            proposedAt,
            executableAt,
            expiresAt
        );

        migrationProposals[proposalId] = MigrationProposal({
            id: proposalId,
            successor: successor_,
            successorRuntimeCodeHash: successorRuntimeCodeHash,
            amount: amount,
            reasonHash: reasonHash,
            proposedAt: proposedAt,
            executableAt: executableAt,
            expiresAt: expiresAt,
            executed: false,
            cancelled: false
        });

        emit MigrationProposalCreated(
            proposalId, successor_, successorRuntimeCodeHash, amount, reasonHash, proposedAt, executableAt, expiresAt
        );
    }

    function cancelMigrationProposal(bytes32 proposalId) external onlyOwner {
        ProposalState state = migrationProposalState(proposalId);
        if (state != ProposalState.WAITING && state != ProposalState.EXECUTABLE) {
            revert ProposalNotCancellable();
        }
        migrationProposals[proposalId].cancelled = true;
        emit MigrationProposalCancelled(proposalId);
    }

    function executeMigration(bytes32 proposalId) external onlyOwner nonReentrant {
        if (migrationProposalState(proposalId) != ProposalState.EXECUTABLE) revert ProposalNotExecutable();

        MigrationProposal storage proposal = migrationProposals[proposalId];
        if (proposal.amount > unreservedBalance()) revert InsufficientUnreservedBalance();
        if (proposal.successor.code.length == 0 || proposal.successor.codehash != proposal.successorRuntimeCodeHash) {
            revert SuccessorCodeHashMismatch();
        }
        _validateMigrationSuccessor(proposal.successor);

        proposal.executed = true;
        if (successor == address(0)) successor = proposal.successor;
        retired = true;
        if (!paused()) _pause();

        ISettlementGasPoolMigrationCandidate(proposal.successor).acceptMigration{value: proposal.amount}(proposalId);

        emit MigrationExecuted(
            proposalId,
            proposal.successor,
            proposal.amount,
            proposal.proposedAt,
            proposal.executableAt,
            proposal.expiresAt,
            uint64(block.timestamp)
        );
    }

    function getMigrationProposal(bytes32 proposalId) external view returns (MigrationProposal memory) {
        return migrationProposals[proposalId];
    }

    function migrationProposalState(bytes32 proposalId) public view returns (ProposalState) {
        MigrationProposal storage proposal = migrationProposals[proposalId];
        if (proposal.id == bytes32(0)) return ProposalState.NONE;
        if (proposal.executed) return ProposalState.EXECUTED;
        if (proposal.cancelled) return ProposalState.CANCELLED;
        if (block.timestamp < proposal.executableAt) return ProposalState.WAITING;
        if (block.timestamp > proposal.expiresAt) return ProposalState.EXPIRED;
        return ProposalState.EXECUTABLE;
    }

    function version() public pure returns (bytes32) {
        return keccak256("OMERTA_SETTLEMENT_GAS_POOL_V1");
    }

    function renounceOwnership() public view override onlyOwner {
        revert OwnershipRenunciationDisabled();
    }

    function _recordContribution(bytes32 memo) private {
        if (msg.value == 0) revert ZeroValue();
        if (retired) revert PoolRetired();
        emit ContributionReceived(msg.sender, msg.value, memo, address(this).balance, unreservedBalance());
    }

    function _calculateCredit(uint256 measuredSettlementGas)
        private
        view
        returns (CreditCalculation memory calculation)
    {
        if (retired) {
            calculation.status = CreditStatus.ZERO_RETIRED;
            return calculation;
        }

        uint256 perSettlementCap = config.perSettlementWeiCap;
        calculation.billableGas = _addCapped(measuredSettlementGas, auditedOverheadGas, type(uint256).max);
        uint256 baseAndPriority = _addCapped(block.basefee, config.priorityFeeCapWei, type(uint256).max);
        calculation.reimbursableGasPrice = tx.gasprice < baseAndPriority ? tx.gasprice : baseAndPriority;
        calculation.approvedDataFee = _approvedDataFee();
        calculation.verifiedGasCost =
            _mulCapped(calculation.billableGas, calculation.reimbursableGasPrice, perSettlementCap);
        calculation.verifiedGasCost =
            _addCapped(calculation.verifiedGasCost, calculation.approvedDataFee, perSettlementCap);
        calculation.available = unreservedBalance();

        if (paused()) {
            calculation.status = CreditStatus.ZERO_PAUSED;
            return calculation;
        }
        if (perSettlementCap == 0) {
            calculation.status = CreditStatus.ZERO_CAP;
            return calculation;
        }
        if (calculation.available == 0) {
            calculation.status = CreditStatus.ZERO_UNFUNDED;
            return calculation;
        }

        calculation.credit =
            calculation.verifiedGasCost < calculation.available ? calculation.verifiedGasCost : calculation.available;
        calculation.status = calculation.credit < calculation.verifiedGasCost ? CreditStatus.PARTIAL : CreditStatus.FULL;
    }

    function _approvedDataFee() private view returns (uint256) {
        Config memory currentConfig_ = config;
        address source = currentConfig_.dataFeeSource;
        if (source == address(0) || source.codehash != currentConfig_.dataFeeSourceRuntimeCodeHash) return 0;

        bytes memory callData =
            abi.encodeWithSelector(ISettlementDataFeeSource.currentTransactionNativeDataFee.selector);
        bool success;
        uint256 reportedFee;
        assembly ("memory-safe") {
            success := staticcall(DATA_FEE_SOURCE_CALL_GAS, source, add(callData, 32), mload(callData), 0, 0)
            if and(success, eq(returndatasize(), 32)) {
                returndatacopy(0, 0, 32)
                reportedFee := mload(0)
            }
            if iszero(eq(returndatasize(), 32)) { success := 0 }
        }
        if (!success) return 0;
        return reportedFee < currentConfig_.dataFeeWeiCap ? reportedFee : currentConfig_.dataFeeWeiCap;
    }

    function _cancelLiveConfigProposal(bytes32 cancellationReasonHash) private {
        bytes32 proposalId = liveConfigProposalId;
        ProposalState state = configProposalState(proposalId);
        if (state != ProposalState.WAITING && state != ProposalState.EXECUTABLE) return;

        configProposals[proposalId].cancelled = true;
        liveConfigProposalId = bytes32(0);
        emit ConfigProposalCancelled(proposalId, cancellationReasonHash);
    }

    function _validateDataFeeSourceConfig(Config memory config_) private view {
        address source = config_.dataFeeSource;
        if (source == address(0)) {
            if (config_.dataFeeSourceRuntimeCodeHash != bytes32(0) || config_.dataFeeWeiCap != 0) {
                revert InvalidDataFeeSourceConfig();
            }
            return;
        }
        if (config_.dataFeeWeiCap == 0) revert InvalidDataFeeSourceConfig();
        if (source.code.length == 0) revert InvalidDataFeeSource();
        if (source.codehash != config_.dataFeeSourceRuntimeCodeHash) revert DataFeeSourceCodeHashMismatch();
    }

    function _validateProposedConfig(Config calldata nextConfig)
        private
        view
        returns (bytes32 baseConfigHash, bytes32 nextConfigHash)
    {
        _validateDataFeeSourceConfig(nextConfig);
        Config memory oldConfig = config;
        baseConfigHash = _configHash(oldConfig);
        nextConfigHash = _configHash(nextConfig);
        if (baseConfigHash == nextConfigHash) revert NoConfigChange();

        bool sourceChanged = oldConfig.dataFeeSource != nextConfig.dataFeeSource
            || oldConfig.dataFeeSourceRuntimeCodeHash != nextConfig.dataFeeSourceRuntimeCodeHash;
        bool capIncreased = nextConfig.priorityFeeCapWei > oldConfig.priorityFeeCapWei
            || nextConfig.perSettlementWeiCap > oldConfig.perSettlementWeiCap
            || nextConfig.dataFeeWeiCap > oldConfig.dataFeeWeiCap;
        if (!sourceChanged && !capIncreased) revert ConfigIncreaseRequired();
    }

    function _emitConfigProposalCreated(ConfigProposal storage proposal, bytes32 nextConfigHash) private {
        emit ConfigProposalCreated(
            proposal.id,
            proposal.baseConfigHash,
            nextConfigHash,
            proposal.reasonHash,
            proposal.proposedAt,
            proposal.executableAt,
            proposal.expiresAt
        );
    }

    function _configHash(Config memory config_) private pure returns (bytes32) {
        return keccak256(abi.encode(config_));
    }

    function _deriveProposalId(uint256 nonce, bytes32 baseConfigHash, bytes32 nextConfigHash, bytes32 reasonHash)
        private
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                "OMERTA_SETTLEMENT_GAS_POOL_CONFIG_V1",
                supportedChainId,
                address(this),
                nonce,
                baseConfigHash,
                nextConfigHash,
                reasonHash,
                block.timestamp
            )
        );
    }

    /// @dev This on-chain check cannot protect against Byzantine Safe semantics or a purpose-built facade.
    ///      Off-chain review must cover source/compiler/settings/runtime, non-delegation, immutable identity,
    ///      current and pending ownership, paused state, and the exact acceptMigration behavior.
    function _validateMigrationSuccessor(address candidateAddress) private view {
        address latchedSuccessor = successor;
        if (latchedSuccessor != address(0) && candidateAddress != latchedSuccessor) {
            revert SuccessorAlreadyLatched();
        }
        if (candidateAddress.code.length == 0) revert InvalidMigrationSuccessor();

        ISettlementGasPoolMigrationCandidate candidate = ISettlementGasPoolMigrationCandidate(candidateAddress);
        if (
            candidate.version() != version() || candidate.supportedChainId() != supportedChainId
                || candidate.gameplayVault() != gameplayVault || candidate.predecessor() != address(this)
                || candidate.owner() != owner() || !candidate.paused()
        ) revert InvalidMigrationSuccessor();
    }

    function _deriveMigrationProposalId(
        uint256 nonce,
        address successor_,
        bytes32 successorRuntimeCodeHash,
        uint256 amount,
        bytes32 reasonHash,
        uint64 proposedAt,
        uint64 executableAt,
        uint64 expiresAt
    ) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                "OMERTA_SETTLEMENT_GAS_POOL_MIGRATION_V1",
                supportedChainId,
                address(this),
                nonce,
                successor_,
                successorRuntimeCodeHash,
                amount,
                reasonHash,
                proposedAt,
                executableAt,
                expiresAt
            )
        );
    }

    function _addCapped(uint256 a, uint256 b, uint256 cap) private pure returns (uint256) {
        if (a >= cap || b >= cap - a) return cap;
        return a + b;
    }

    function _mulCapped(uint256 a, uint256 b, uint256 cap) private pure returns (uint256) {
        if (a == 0 || b == 0) return 0;
        if (a > cap / b) return cap;
        uint256 product = a * b;
        return product > cap ? cap : product;
    }
}
