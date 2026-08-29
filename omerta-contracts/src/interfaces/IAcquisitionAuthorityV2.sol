// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IAcquisitionAuthorityV2 {
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
        INGRESS_DISABLED
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

    error ZeroAddress();
    error ContractRequired(address target);
    error RoleIdentityCollision(address candidate);
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
    error IngressProposalPending(bytes32 proposalId);
    error IngressProposalMissing();
    error InvalidIngressConfig();
    error IngressCodeHashMismatch(address ingress, bytes32 expected, bytes32 actual);
    error IngressActive(address ingress);
    error NoActiveIngress();
    error IngressNotFound(uint256 generation);

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
}
