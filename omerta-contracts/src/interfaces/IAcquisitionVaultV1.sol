// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IAcquisitionVaultV1 {
    enum ReasonCode {
        NONE,
        OUTFLOW_ACQUISITION,
        OUTFLOW_TREASURY_REBALANCE,
        OUTFLOW_SECURITY_RESPONSE,
        OPERATOR_NOMINATION,
        OPERATOR_NOMINATION_CANCELLED,
        OPERATOR_NOMINATION_EXPIRED,
        OPERATOR_DISABLED,
        OPERATOR_RENOUNCED,
        OPERATOR_REPLACED,
        OUTFLOW_NONCE_INVALIDATED,
        RISK_PAUSED,
        RISK_UNPAUSED,
        INGRESS_PROPOSED,
        INGRESS_PROPOSAL_CANCELLED,
        INGRESS_PROPOSAL_EXPIRED,
        INGRESS_ACTIVATED,
        INGRESS_DISABLED,
        UNATTRIBUTED_RECLASSIFIED,
        BALLOT_BUDGET_AUTHORIZED,
        RECONCILIATION_DISPOSITION
    }

    enum LocalReadinessCondition {
        NONE,
        WRONG_CHAIN,
        OWNER_CODE_MISSING,
        REGISTRY_CODE_MISSING,
        ROLE_COLLISION,
        BALANCE_DEFICIT,
        RECONCILIATION_SHORTFALL,
        ACTIVE_INGRESS_MISSING,
        INGRESS_CODE_MISSING,
        INGRESS_CODE_HASH_MISMATCH,
        INGRESS_PROPOSAL_PENDING
    }

    struct PendingOperatorNomination {
        bytes32 proposalId;
        uint256 proposalNumber;
        address nominee;
        address proposedBy;
        uint64 proposedAt;
        uint64 validAfter;
        uint64 expiresAt;
        bytes32 detailsHash;
    }

    struct OutflowAuthorization {
        address operator;
        address destination;
        uint256 amountWei;
        uint256 generation;
        uint256 nonce;
        uint64 issuedAt;
        uint64 deadline;
        uint8 reasonCode;
        bytes32 detailsHash;
    }

    struct SuccessorConsent {
        address currentOperator;
        address successor;
        uint256 generation;
        uint256 outflowNonce;
        uint64 issuedAt;
        uint64 deadline;
        uint8 reasonCode;
        bytes32 detailsHash;
    }

    struct AccountingTotals {
        uint256 availableWei;
        uint256 unattributedWei;
        uint256 ordinaryReservedWei;
        uint256 reconciliationLiabilityWei;
        uint256 reconciliationBackingWei;
        uint256 reconciliationShortfallWei;
        uint256 accountedBackingWei;
        uint256 actualBalanceWei;
        uint256 balanceDeficitWei;
        uint256 forcedSurplusWei;
        uint256 accountingSequence;
    }

    enum AccountingMutationKind {
        NONE,
        SYNC_BALANCE,
        UNATTRIBUTED_RECLASSIFICATION,
        CANONICAL_DEPOSIT
    }

    enum AccountingComponentKind {
        NONE,
        FORCED_SURPLUS_TO_UNATTRIBUTED,
        BALANCE_DEFICIT_OBSERVATION_SET,
        UNATTRIBUTED_TO_AVAILABLE,
        CANONICAL_DEPOSIT_DEFICIT_REPAIR,
        CANONICAL_DEPOSIT_AVAILABLE_CREDIT
    }

    struct IngressConfig {
        address ingress;
        bytes32 runtimeCodeHash;
        uint256 perDepositCapWei;
        uint256 epochDepositCapWei;
        uint256 lifetimeDepositCapWei;
    }

    struct PendingIngressProposal {
        bytes32 proposalId;
        uint256 proposalNumber;
        address proposedBy;
        IngressConfig config;
        bytes32 configHash;
        uint64 proposedAt;
        uint64 validAfter;
        uint64 expiresAt;
        bytes32 detailsHash;
    }

    struct IngressRecord {
        uint256 generation;
        address ingress;
        bytes32 runtimeCodeHash;
        uint256 perDepositCapWei;
        uint256 epochDepositCapWei;
        uint256 lifetimeDepositCapWei;
        uint64 activatedAt;
        uint64 disabledAt;
    }

    enum DepositCapKind {
        NONE,
        PER_DEPOSIT,
        EPOCH,
        GENERATION_LIFETIME,
        GLOBAL_LIFETIME
    }

    struct DepositRecord {
        bytes32 depositId;
        uint256 ingressGeneration;
        address ingress;
        bytes32 sourceEventId;
        uint256 amountWei;
        uint256 balanceDeficitRepairWei;
        uint256 availableCreditWei;
        uint256 epochDay;
        uint256 accountingSequence;
        uint64 depositedAt;
    }

    error WrongChain(uint256 actualChainId);
    error ZeroAddress();
    error ContractRequired(address target);
    error RoleIdentityCollision(address candidate);
    error RegistryChainMismatch(uint256 actualChainId);
    error OwnershipRenunciationDisabled();
    error NoPendingOwnershipTransfer();
    error EmptyDetailsHash();
    error InvalidActionReason(uint8 supplied);
    error CounterExhausted(bytes32 counterName);
    error TimestampOverflow();
    error MainOperatorActive(address operator);
    error NoMainOperator();
    error OperatorNominationPending(bytes32 proposalId);
    error OperatorNominationMissing();
    error ProposalIdMismatch(bytes32 expectedId, bytes32 actualId);
    error NotNominee(address caller);
    error ProposalNotReady(uint64 eligibleAt);
    error ProposalExpired(uint64 expiresAt);
    error NoOperatorStateChange();
    error InvalidOperatorReplacement();
    error InvalidOutflowNonceStep(uint256 currentNonce, uint256 suppliedNonce);
    error OutflowNonceExhausted(uint256 currentNonce);
    error InvalidAuthorizationWindow();
    error AuthorizationNotYetValid();
    error AuthorizationExpired();
    error InvalidAuthorizationFields();
    error InvalidSignature();
    error InsufficientSignatureValidationGas();
    error LocalReadinessFailed(uint8 condition);
    error InvalidGlobalLifetimeCap();
    error NoBalanceDelta();
    error InvalidAmount();
    error InsufficientUnattributed(uint256 availableWei, uint256 requestedWei);
    error BalanceDeficitActive(uint256 deficitWei);
    error ReconciliationShortfallActive(uint256 shortfallWei);
    error IngressProposalPending(bytes32 proposalId);
    error IngressProposalMissing();
    error InvalidIngressConfig();
    error IngressCodeHashMismatch(address ingress, bytes32 expected, bytes32 actual);
    error IngressActive(address ingress);
    error NoActiveIngress();
    error IngressNotFound(uint256 generation);
    error NotActiveIngress(address caller);
    error DepositSourceRequired();
    error DepositReplay(bytes32 depositId);
    error DepositCapExceeded(uint8 capKind, uint256 capWei, uint256 attemptedTotalWei);
    error DepositNotFound(bytes32 depositId);

    event MainOperatorNominationCreated(
        bytes32 indexed proposalId,
        address indexed nominee,
        address indexed proposedBy,
        uint256 proposalNumber,
        uint64 proposedAt,
        uint64 validAfter,
        uint64 expiresAt,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event MainOperatorNominationCancelled(
        bytes32 indexed proposalId,
        address indexed nominee,
        address indexed actor,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event MainOperatorNominationExpired(
        bytes32 indexed proposalId,
        address indexed nominee,
        address indexed actor,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event MainOperatorChanged(
        address indexed previousOperator,
        address indexed newOperator,
        uint256 indexed operatorGeneration,
        uint256 outflowNonce,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event OutflowNonceInvalidated(
        address indexed operator,
        uint256 indexed operatorGeneration,
        uint256 previousNonce,
        uint256 newNonce,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event RiskPaused(address indexed actor, uint8 reasonCode, bytes32 detailsHash);
    event RiskUnpaused(address indexed actor, uint8 reasonCode, bytes32 detailsHash);
    event AccountingMutation(
        uint256 indexed accountingSequence,
        bytes32 indexed mutationId,
        uint8 indexed mutationKind,
        AccountingTotals preTotals,
        AccountingTotals postTotals,
        uint256 componentCount
    );
    event AccountingComponent(
        uint256 indexed accountingSequence,
        uint256 indexed componentIndex,
        bytes32 indexed componentId,
        uint8 componentKind,
        bytes32 componentSubjectId,
        uint256 amountWei
    );
    event UnattributedReclassified(
        bytes32 indexed mutationId,
        uint256 indexed accountingSequence,
        address indexed actor,
        uint256 amountWei,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event IngressProposalCreated(
        bytes32 indexed proposalId,
        address indexed ingress,
        address indexed proposedBy,
        uint256 proposalNumber,
        bytes32 configHash,
        uint64 proposedAt,
        uint64 validAfter,
        uint64 expiresAt,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event IngressProposalCancelled(
        bytes32 indexed proposalId,
        address indexed ingress,
        address indexed actor,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event IngressProposalExpired(
        bytes32 indexed proposalId,
        address indexed ingress,
        address indexed actor,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event IngressActivated(
        uint256 indexed ingressGeneration,
        address indexed ingress,
        bytes32 indexed proposalId,
        bytes32 runtimeCodeHash,
        uint256 perDepositCapWei,
        uint256 epochDepositCapWei,
        uint256 lifetimeDepositCapWei,
        uint64 activatedAt,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event IngressDisabled(
        uint256 indexed ingressGeneration,
        address indexed ingress,
        address indexed actor,
        uint64 disabledAt,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event CanonicalDeposit(
        bytes32 indexed depositId,
        uint256 indexed ingressGeneration,
        bytes32 indexed sourceEventId,
        address ingress,
        uint256 amountWei,
        uint256 balanceDeficitRepairWei,
        uint256 availableCreditWei,
        uint256 epochDay,
        uint256 accountingSequence,
        uint64 depositedAt
    );

    function supportedChainId() external view returns (uint256);
    function OPERATOR_NOMINATION_DELAY() external view returns (uint64);
    function OPERATOR_ACCEPTANCE_WINDOW() external view returns (uint64);
    function INGRESS_PROPOSAL_DELAY() external view returns (uint64);
    function INGRESS_ACCEPTANCE_WINDOW() external view returns (uint64);
    function MAX_AUTHORIZATION_LIFETIME() external view returns (uint64);
    function MAX_SIGNATURE_BYTES() external view returns (uint256);
    function ERC1271_CALL_GAS() external view returns (uint256);
    function ERC1271_POST_CALL_GAS_RESERVE() external view returns (uint256);
    function ERC1271_MIN_PRECALL_GAS() external view returns (uint256);
    function MAX_ACTIVE_ORDINARY_RESERVATIONS() external view returns (uint256);
    function MAX_ACTIVE_RECONCILIATIONS() external view returns (uint256);
    function MAX_OPERATOR_OUTFLOW_COMPONENTS() external view returns (uint256);
    function OUTFLOW_AUTHORIZATION_TYPEHASH() external view returns (bytes32);
    function SUCCESSOR_CONSENT_TYPEHASH() external view returns (bytes32);
    function stockTokenRegistryV2() external view returns (address);
    function version() external view returns (string memory);
    function mainOperator() external view returns (address);
    function operatorGeneration() external view returns (uint256);
    function outflowNonce() external view returns (uint256);
    function nominationNonce() external view returns (uint256);
    function pendingMainOperatorNomination() external view returns (PendingOperatorNomination memory);
    function nominateMainOperator(address nominee, bytes32 detailsHash) external returns (bytes32);
    function cancelMainOperatorNomination(bytes32 proposalId, bytes32 detailsHash) external;
    function expireMainOperatorNomination(bytes32 proposalId) external;
    function acceptMainOperatorNomination(bytes32 proposalId) external;
    function disableMainOperator(bytes32 detailsHash) external;
    function renounceMainOperator(bytes32 detailsHash) external;
    function replaceMainOperator(SuccessorConsent calldata consent, bytes calldata signature) external;
    function invalidateOutflowNonce(uint256 newNextNonce, bytes32 detailsHash) external;
    function pause(bytes32 detailsHash) external;
    function unpause(bytes32 detailsHash) external;
    function hashOutflowAuthorization(OutflowAuthorization calldata authorization) external view returns (bytes32);
    function hashSuccessorConsent(SuccessorConsent calldata consent) external view returns (bytes32);
    function globalLifetimeCanonicalDepositCapWei() external view returns (uint256);
    function availableWei() external view returns (uint256);
    function unattributedWei() external view returns (uint256);
    function ordinaryReservedWei() external view returns (uint256);
    function reconciliationLiabilityWei() external view returns (uint256);
    function reconciliationBackingWei() external view returns (uint256);
    function accountingSequence() external view returns (uint256);
    function lastObservedBalanceDeficitWei() external view returns (uint256);
    function accountingTotals() external view returns (AccountingTotals memory);
    function syncBalance() external returns (bytes32 mutationId);
    function reclassifyUnattributed(uint256 amountWei, bytes32 detailsHash) external returns (bytes32 mutationId);
    function globalLifetimeCanonicalDepositedWei() external view returns (uint256);
    function ingressProposalNonce() external view returns (uint256);
    function ingressGeneration() external view returns (uint256);
    function activeIngressGeneration() external view returns (uint256);
    function pendingIngressProposal() external view returns (PendingIngressProposal memory);
    function getIngress(uint256 generation) external view returns (IngressRecord memory);
    function proposeIngress(IngressConfig calldata config, bytes32 detailsHash) external returns (bytes32 proposalId);
    function cancelIngressProposal(bytes32 proposalId, bytes32 detailsHash) external;
    function expireIngressProposal(bytes32 proposalId) external;
    function activateIngress(bytes32 proposalId) external returns (uint256 generation);
    function disableIngress(bytes32 detailsHash) external;
    function ingressLifetimeDepositedWei(uint256 generation) external view returns (uint256);
    function ingressEpochDepositedWei(uint256 generation, uint256 epochDay) external view returns (uint256);
    function getDeposit(bytes32 depositId) external view returns (DepositRecord memory);
    function depositCanonical(bytes32 sourceEventId) external payable returns (bytes32 depositId);
}
