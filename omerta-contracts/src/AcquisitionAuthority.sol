// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAcquisitionAuthorityV2} from "./interfaces/IAcquisitionAuthorityV2.sol";

contract AcquisitionAuthority is IAcquisitionAuthorityV2, EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    uint256 public constant supportedChainId = 4663;
    uint64 public constant OPERATOR_NOMINATION_DELAY = 48 hours;
    uint64 public constant OPERATOR_ACCEPTANCE_WINDOW = 7 days;
    uint64 public constant INGRESS_PROPOSAL_DELAY = 48 hours;
    uint64 public constant INGRESS_ACCEPTANCE_WINDOW = 7 days;
    uint64 public constant MAX_AUTHORIZATION_LIFETIME = 1 hours;
    uint256 public constant MAX_SIGNATURE_BYTES = 4096;
    uint256 public constant ERC1271_CALL_GAS = 100_000;
    uint256 public constant ERC1271_POST_CALL_GAS_RESERVE = 50_000;
    uint256 public constant ERC1271_MIN_PRECALL_GAS = 160_000;
    bytes32 public constant OUTFLOW_AUTHORIZATION_TYPEHASH = keccak256(
        "OutflowAuthorizationV2(address authority,address core,address targetModule,bytes32 action,address operator,address destination,uint256 amountWei,uint256 generation,uint256 nonce,uint64 issuedAt,uint64 deadline,uint8 reasonCode,bytes32 detailsHash)"
    );
    bytes32 public constant SUCCESSOR_CONSENT_TYPEHASH = keccak256(
        "SuccessorConsentV2(address authority,address core,address targetModule,bytes32 action,address currentOperator,address successor,uint256 generation,uint256 outflowNonce,uint64 issuedAt,uint64 deadline,uint8 reasonCode,bytes32 detailsHash)"
    );

    bytes32 private constant _OPERATOR_PROPOSAL_TAG = keccak256("OMERTA_AUTH_OPERATOR_PROPOSAL_V2");
    bytes32 private constant _INGRESS_PROPOSAL_TAG = keccak256("OMERTA_AUTH_INGRESS_PROPOSAL_V2");
    bytes32 private constant _INGRESS_CONFIG_TAG = keccak256("OMERTA_AUTH_INGRESS_CONFIG_V2");
    bytes32 private constant _OPERATOR_EXPIRY_TAG = keccak256("OMERTA_AUTH_OPERATOR_EXPIRY_DETAILS_V2");
    bytes32 private constant _OWNERSHIP_CANCEL_TAG =
        keccak256("OMERTA_AUTH_OWNERSHIP_ACCEPT_OPERATOR_CANCELLATION_DETAILS_V2");
    bytes32 private constant _INGRESS_EXPIRY_TAG = keccak256("OMERTA_AUTH_INGRESS_EXPIRY_DETAILS_V2");
    bytes32 private constant _O2_ACTION = keccak256("OMERTA_O2_AUTHORIZATION_V2");
    bytes32 private constant _REPLACEMENT_ACTION = keccak256("OMERTA_OPERATOR_REPLACEMENT_V2");
    bytes32 private constant _NOMINATION_COUNTER = keccak256("nominationNonce");
    bytes32 private constant _GENERATION_COUNTER = keccak256("operatorGeneration");
    bytes32 private constant _INGRESS_PROPOSAL_COUNTER = keccak256("ingressProposalNonce");
    bytes32 private constant _INGRESS_GENERATION_COUNTER = keccak256("ingressGeneration");
    bytes4 private constant _ERC1271_MAGIC = 0x1626ba7e;
    uint256 private constant _SECP256K1_HALF_ORDER = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;
    bytes32 private constant _INGRESS_PROPOSAL_CREATED_TOPIC =
        keccak256("IngressProposalCreated(bytes32,address,address,uint256,bytes32,uint64,uint64,uint64,uint8,bytes32)");
    bytes32 private constant _INGRESS_ACTIVATED_TOPIC =
        keccak256("IngressActivated(uint256,address,bytes32,bytes32,uint256,uint256,uint256,uint64,uint8,bytes32)");
    bytes32 private constant _OPERATOR_PROPOSAL_CREATED_TOPIC =
        keccak256("MainOperatorNominationCreated(bytes32,address,address,uint256,uint64,uint64,uint64,uint8,bytes32)");
    bytes32 private constant _OPERATOR_CHANGED_TOPIC =
        keccak256("MainOperatorChanged(address,address,uint256,uint256,uint8,bytes32)");
    bytes32 private constant _OPERATOR_CANCELLED_TOPIC =
        keccak256("MainOperatorNominationCancelled(bytes32,address,address,uint8,bytes32)");
    bytes32 private constant _OPERATOR_EXPIRED_TOPIC =
        keccak256("MainOperatorNominationExpired(bytes32,address,address,uint8,bytes32)");
    bytes32 private constant _INGRESS_CANCELLED_TOPIC =
        keccak256("IngressProposalCancelled(bytes32,address,address,uint8,bytes32)");
    bytes32 private constant _INGRESS_EXPIRED_TOPIC =
        keccak256("IngressProposalExpired(bytes32,address,address,uint8,bytes32)");
    bytes32 private constant _OUTFLOW_NONCE_INVALIDATED_TOPIC =
        keccak256("OutflowNonceInvalidated(address,uint256,uint256,uint256,uint8,bytes32)");
    bytes32 private constant _RISK_PAUSED_TOPIC = keccak256("RiskPaused(address,uint8,bytes32)");
    bytes32 private constant _INGRESS_DISABLED_TOPIC =
        keccak256("IngressDisabled(uint256,address,address,uint64,uint8,bytes32)");
    bytes32 private constant _AUTHORITY_FINALIZED_TOPIC = keccak256("AuthorityFinalized(bytes32)");
    bytes32 private constant _EMPTY_OPERATOR_HASH = keccak256(
        abi.encode(bytes32(0), uint256(0), address(0), address(0), uint64(0), uint64(0), uint64(0), bytes32(0))
    );
    bytes32 private constant _EMPTY_INGRESS_HASH = keccak256(
        abi.encode(
            bytes32(0),
            uint256(0),
            address(0),
            address(0),
            bytes32(0),
            uint256(0),
            uint256(0),
            uint256(0),
            bytes32(0),
            uint64(0),
            uint64(0),
            uint64(0),
            bytes32(0)
        )
    );

    error AuthorityFactoryZero();
    error AuthorityManifestHashZero();
    error AuthorityFinalizerUnauthorized(address caller);
    error AuthorityManifestHashMismatch(bytes32 expected, bytes32 actual);
    error AuthorityAlreadyFinalized();
    error AuthorityNotFinalized();
    error AuthorityInitialStateMismatch(uint8 field);
    error AuthorityAddressMismatch(address expected, address actual);
    error AuthorityPeerMismatch(uint8 index, address expected, address actual);
    event AuthorityFinalized(bytes32 indexed manifestHash);

    address private immutable _factory;
    bytes32 private immutable _manifestHash;
    address private immutable _launchSafe;
    address private immutable _registry;
    address private immutable _core;
    address private immutable _budgetBook;
    address private immutable _intentExecution;
    address private immutable _reconciliation;

    address public mainOperator;
    bool private _finalized;
    uint256 public operatorGeneration;
    uint256 private _sharedO2Nonce;
    uint256 private _cancelNonce;
    uint256 public nominationNonce;
    PendingOperatorNomination private _pendingMainOperatorNomination;
    uint256 public ingressProposalNonce;
    uint256 public ingressGeneration;
    uint256 public activeIngressGeneration;
    PendingIngressProposal private _pendingIngressProposal;
    mapping(uint256 => IngressRecord) private _ingressRecords;

    modifier finalizedState() {
        if (!_finalized) revert AuthorityNotFinalized();
        _;
    }

    function version() external pure returns (string memory) {
        assembly ("memory-safe") {
            mstore(0, 0x20)
            mstore(0x20, 1)
            mstore(0x40, shl(248, 0x32))
            return(0, 0x60)
        }
    }

    constructor(
        address factory,
        bytes32 manifestHash,
        address safe,
        address registry,
        address core,
        address budgetBook,
        address intentExecution,
        address reconciliation
    ) Ownable(_validatedLaunchSafe(factory, manifestHash, safe)) EIP712("OMERTA AcquisitionAuthority", "2") {
        if (
            registry == address(0) || core == address(0) || budgetBook == address(0) || intentExecution == address(0)
                || reconciliation == address(0)
        ) revert ZeroAddress();
        if (safe.code.length == 0) revert ContractRequired(safe);
        if (registry.code.length == 0) revert ContractRequired(registry);
        address expected = _predict(factory, 1);
        if (address(this) != expected) revert AuthorityAddressMismatch(expected, address(this));
        address[4] memory supplied = [core, budgetBook, intentExecution, reconciliation];
        for (uint8 i; i < 4; ++i) {
            expected = _predict(factory, i + 2);
            if (supplied[i] != expected) revert AuthorityPeerMismatch(i + 1, expected, supplied[i]);
        }
        if (safe == registry) revert RoleIdentityCollision(safe);
        if (safe == factory) revert RoleIdentityCollision(safe);
        if (registry == factory) revert RoleIdentityCollision(registry);
        for (uint8 i; i < 5; ++i) {
            address child = _predict(factory, i + 1);
            if (safe == child) revert RoleIdentityCollision(safe);
            if (registry == child) revert RoleIdentityCollision(registry);
        }
        _factory = factory;
        _manifestHash = manifestHash;
        _launchSafe = safe;
        _registry = registry;
        _core = core;
        _budgetBook = budgetBook;
        _intentExecution = intentExecution;
        _reconciliation = reconciliation;
        _pause();
    }

    function _validatedLaunchSafe(address factory, bytes32 manifestHash, address safe) private pure returns (address) {
        if (factory == address(0)) revert AuthorityFactoryZero();
        if (manifestHash == bytes32(0)) revert AuthorityManifestHashZero();
        if (safe == address(0)) revert ZeroAddress();
        return safe;
    }

    function authorityTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
        return (_factory, _manifestHash, _finalized);
    }

    function authoritySnapshot()
        external
        view
        returns (
            uint256,
            address,
            bytes32,
            address,
            address,
            address,
            address,
            address,
            bool,
            address,
            address,
            bool,
            address,
            address,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            address,
            bytes32,
            address,
            bytes32,
            uint256,
            bytes32,
            uint256,
            bytes32
        )
    {
        PendingOperatorNomination memory p = _pendingMainOperatorNomination;
        PendingIngressProposal memory q = _pendingIngressProposal;
        IngressRecord memory active = _ingressRecords[activeIngressGeneration];
        uint256[27] memory words;
        words[0] = 2;
        words[1] = uint160(_factory);
        words[2] = uint256(_manifestHash);
        words[3] = uint160(_registry);
        words[4] = uint160(_core);
        words[5] = uint160(_budgetBook);
        words[6] = uint160(_intentExecution);
        words[7] = uint160(_reconciliation);
        words[8] = _finalized ? 1 : 0;
        words[9] = uint160(owner());
        words[10] = uint160(pendingOwner());
        words[11] = paused() ? 1 : 0;
        words[12] = uint160(mainOperator);
        words[13] = uint160(p.nominee);
        words[14] = operatorGeneration;
        words[15] = _sharedO2Nonce;
        words[16] = _cancelNonce;
        words[17] = ingressGeneration;
        words[18] = activeIngressGeneration;
        words[19] = uint160(active.ingress);
        words[20] = uint256(_ingressRecordConfigHash(active));
        words[21] = uint160(q.config.ingress);
        words[22] = uint256(q.configHash);
        words[23] = nominationNonce;
        words[24] = uint256(_operatorStateHash(p));
        words[25] = ingressProposalNonce;
        words[26] = uint256(_ingressStateHash(q));
        assembly ("memory-safe") { return(words, 0x360) }
    }

    function finalizeAuthority(bytes32 manifestHash) external {
        if (msg.sender != _factory) revert AuthorityFinalizerUnauthorized(msg.sender);
        if (manifestHash != _manifestHash) revert AuthorityManifestHashMismatch(_manifestHash, manifestHash);
        if (_finalized) revert AuthorityAlreadyFinalized();
        _initial(owner() == _launchSafe, 9);
        _initial(pendingOwner() == address(0), 10);
        _initial(paused(), 11);
        _initial(mainOperator == address(0), 12);
        _initial(_pendingMainOperatorNomination.nominee == address(0), 13);
        _initial(operatorGeneration == 0, 14);
        _initial(_sharedO2Nonce == 0, 15);
        _initial(_cancelNonce == 0, 16);
        _initial(ingressGeneration == 0, 17);
        _initial(activeIngressGeneration == 0, 18);
        _initial(_ingressRecords[0].ingress == address(0), 19);
        _initial(_ingressRecordConfigHash(_ingressRecords[0]) == bytes32(0), 20);
        _initial(_pendingIngressProposal.config.ingress == address(0), 21);
        _initial(_pendingIngressProposal.configHash == bytes32(0), 22);
        _initial(nominationNonce == 0, 23);
        _initial(_operatorStateHash(_pendingMainOperatorNomination) == _EMPTY_OPERATOR_HASH, 24);
        _initial(ingressProposalNonce == 0, 25);
        _initial(_ingressStateHash(_pendingIngressProposal) == _EMPTY_INGRESS_HASH, 26);
        _finalized = true;
        bytes32 topic = _AUTHORITY_FINALIZED_TOPIC;
        bytes32 manifest = _manifestHash;
        assembly ("memory-safe") { log2(0, 0, topic, manifest) }
    }

    function outflowNonce() external view returns (uint256) {
        return _sharedO2Nonce;
    }

    function pendingMainOperatorNomination() external view returns (PendingOperatorNomination memory) {
        assembly ("memory-safe") {
            let packedActorAndTime := sload(12)
            let packedWindow := sload(13)
            mstore(0, sload(9))
            mstore(0x20, sload(10))
            mstore(0x40, and(sload(11), 0xffffffffffffffffffffffffffffffffffffffff))
            mstore(0x60, and(packedActorAndTime, 0xffffffffffffffffffffffffffffffffffffffff))
            mstore(0x80, and(shr(160, packedActorAndTime), 0xffffffffffffffff))
            mstore(0xa0, and(packedWindow, 0xffffffffffffffff))
            mstore(0xc0, and(shr(64, packedWindow), 0xffffffffffffffff))
            mstore(0xe0, sload(14))
            return(0, 0x100)
        }
    }

    function pendingIngressProposal() external view returns (PendingIngressProposal memory) {
        assembly ("memory-safe") {
            let packedWindow := sload(27)
            mstore(0, sload(18))
            mstore(0x20, sload(19))
            mstore(0x40, and(sload(20), 0xffffffffffffffffffffffffffffffffffffffff))
            mstore(0x60, and(sload(21), 0xffffffffffffffffffffffffffffffffffffffff))
            mstore(0x80, sload(22))
            mstore(0xa0, sload(23))
            mstore(0xc0, sload(24))
            mstore(0xe0, sload(25))
            mstore(0x100, sload(26))
            mstore(0x120, and(packedWindow, 0xffffffffffffffff))
            mstore(0x140, and(shr(64, packedWindow), 0xffffffffffffffff))
            mstore(0x160, and(shr(128, packedWindow), 0xffffffffffffffff))
            mstore(0x180, sload(28))
            return(0, 0x1a0)
        }
    }

    function getIngress(uint256 generation) external view returns (IngressRecord memory) {
        uint256 base;
        uint256 storedGeneration;
        assembly ("memory-safe") {
            mstore(0, generation)
            mstore(0x20, 29)
            base := keccak256(0, 0x40)
            storedGeneration := sload(base)
        }
        if (storedGeneration == 0) revert IngressNotFound(generation);
        assembly ("memory-safe") {
            let packedTimes := sload(add(base, 6))
            mstore(0, storedGeneration)
            mstore(0x20, and(sload(add(base, 1)), 0xffffffffffffffffffffffffffffffffffffffff))
            mstore(0x40, sload(add(base, 2)))
            mstore(0x60, sload(add(base, 3)))
            mstore(0x80, sload(add(base, 4)))
            mstore(0xa0, sload(add(base, 5)))
            mstore(0xc0, and(packedTimes, 0xffffffffffffffff))
            mstore(0xe0, and(shr(64, packedTimes), 0xffffffffffffffff))
            return(0, 0x100)
        }
    }

    function transferOwnership(address newOwner) public override finalizedState nonReentrant onlyOwner {
        if (newOwner == address(0)) {
            if (pendingOwner() == address(0)) revert NoPendingOwnershipTransfer();
            super.transferOwnership(address(0));
            return;
        }
        _checkOwnerCandidate(newOwner, false);
        super.transferOwnership(newOwner);
    }

    function acceptOwnership() public override finalizedState nonReentrant {
        address previousOwner = owner();
        address candidate = pendingOwner();
        PendingOperatorNomination memory p = _pendingMainOperatorNomination;
        if (_msgSender() != candidate || candidate == address(0)) revert OwnableUnauthorizedAccount(_msgSender());
        _checkOwnerCandidate(candidate, true);
        super.acceptOwnership();
        if (p.proposalId != bytes32(0)) {
            delete _pendingMainOperatorNomination;
            bytes32 details = _ownershipCancellationDetails(p, previousOwner, candidate);
            _emitProposalResult(
                _OPERATOR_CANCELLED_TOPIC,
                p.proposalId,
                p.nominee,
                candidate,
                ReasonCode.OPERATOR_NOMINATION_CANCELLED,
                details
            );
        }
    }

    function renounceOwnership() public override finalizedState nonReentrant onlyOwner {
        revert OwnershipRenunciationDisabled();
    }

    function nominateMainOperator(address nominee, bytes32 detailsHash)
        external
        finalizedState
        nonReentrant
        onlyOwner
        returns (bytes32 proposalId)
    {
        if (mainOperator != address(0)) revert MainOperatorActive(mainOperator);
        if (_pendingMainOperatorNomination.proposalId != bytes32(0)) {
            revert OperatorNominationPending(_pendingMainOperatorNomination.proposalId);
        }
        _checkOperatorCandidate(nominee, false);
        _requireDetails(detailsHash);
        _requireProposalTimestampRoom();
        if (nominationNonce == type(uint256).max) revert CounterExhausted(_NOMINATION_COUNTER);
        uint256 number = nominationNonce + 1;
        uint64 proposedAt = uint64(block.timestamp);
        uint64 validAfter = proposedAt + OPERATOR_NOMINATION_DELAY;
        uint64 expiresAt = validAfter + OPERATOR_ACCEPTANCE_WINDOW;
        PendingOperatorNomination memory pending = PendingOperatorNomination(
            bytes32(0), number, nominee, _msgSender(), proposedAt, validAfter, expiresAt, detailsHash
        );
        proposalId = _operatorProposalId(pending);
        pending.proposalId = proposalId;
        nominationNonce = number;
        _pendingMainOperatorNomination = pending;
        _emitOperatorProposalCreated(pending);
    }

    function _emitOperatorProposalCreated(PendingOperatorNomination memory pending) private {
        bytes32 topic = _OPERATOR_PROPOSAL_CREATED_TOPIC;
        assembly ("memory-safe") {
            let data := mload(0x40)
            mstore(data, mload(add(pending, 0x20)))
            mstore(add(data, 0x20), mload(add(pending, 0x80)))
            mstore(add(data, 0x40), mload(add(pending, 0xa0)))
            mstore(add(data, 0x60), mload(add(pending, 0xc0)))
            mstore(add(data, 0x80), 4)
            mstore(add(data, 0xa0), mload(add(pending, 0xe0)))
            log4(data, 0xc0, topic, mload(pending), mload(add(pending, 0x40)), mload(add(pending, 0x60)))
        }
    }

    function _transitionOperator(address previous, address next, ReasonCode reason, bytes32 details) private {
        uint256 generation = _nextGeneration();
        delete _pendingMainOperatorNomination;
        mainOperator = next;
        operatorGeneration = generation;
        bytes32 topic = _OPERATOR_CHANGED_TOPIC;
        uint256 nonce = _sharedO2Nonce;
        assembly ("memory-safe") {
            let data := mload(0x40)
            mstore(data, nonce)
            mstore(add(data, 0x20), reason)
            mstore(add(data, 0x40), details)
            log4(data, 0x60, topic, previous, next, generation)
        }
    }

    function _emitProposalResult(
        bytes32 topic,
        bytes32 proposalId,
        address subject,
        address actor,
        ReasonCode reason,
        bytes32 details
    ) private {
        assembly ("memory-safe") {
            let data := mload(0x40)
            mstore(data, reason)
            mstore(add(data, 0x20), details)
            log4(data, 0x40, topic, proposalId, subject, actor)
        }
    }

    function cancelMainOperatorNomination(bytes32 proposalId, bytes32 detailsHash)
        external
        finalizedState
        nonReentrant
        onlyOwner
    {
        PendingOperatorNomination memory p = _requirePending(proposalId);
        _requireDetails(detailsHash);
        delete _pendingMainOperatorNomination;
        _emitProposalResult(
            _OPERATOR_CANCELLED_TOPIC,
            p.proposalId,
            p.nominee,
            _msgSender(),
            ReasonCode.OPERATOR_NOMINATION_CANCELLED,
            detailsHash
        );
    }

    function expireMainOperatorNomination(bytes32 proposalId) external finalizedState nonReentrant {
        PendingOperatorNomination memory p = _requirePending(proposalId);
        if (block.timestamp < p.expiresAt) revert ProposalNotReady(p.expiresAt);
        delete _pendingMainOperatorNomination;
        bytes32 details = _operatorExpiryDetails(p);
        _emitProposalResult(
            _OPERATOR_EXPIRED_TOPIC,
            p.proposalId,
            p.nominee,
            _msgSender(),
            ReasonCode.OPERATOR_NOMINATION_EXPIRED,
            details
        );
    }

    function acceptMainOperatorNomination(bytes32 proposalId) external finalizedState nonReentrant {
        PendingOperatorNomination memory p = _requirePending(proposalId);
        if (_msgSender() != p.nominee) revert NotNominee(_msgSender());
        if (block.timestamp < p.validAfter) revert ProposalNotReady(p.validAfter);
        if (block.timestamp >= p.expiresAt) revert ProposalExpired(p.expiresAt);
        _checkOperatorCandidate(p.nominee, true);
        _transitionOperator(address(0), p.nominee, ReasonCode.OPERATOR_NOMINATION, p.detailsHash);
    }

    function disableMainOperator(bytes32 detailsHash) external finalizedState nonReentrant onlyOwner {
        address previous = mainOperator;
        PendingOperatorNomination memory p = _pendingMainOperatorNomination;
        if (previous == address(0) && p.proposalId == bytes32(0)) revert NoOperatorStateChange();
        _requireDetails(detailsHash);
        if (p.proposalId != bytes32(0)) {
            delete _pendingMainOperatorNomination;
            _emitProposalResult(
                _OPERATOR_CANCELLED_TOPIC,
                p.proposalId,
                p.nominee,
                _msgSender(),
                ReasonCode.OPERATOR_DISABLED,
                detailsHash
            );
        }
        _transitionOperator(previous, address(0), ReasonCode.OPERATOR_DISABLED, detailsHash);
    }

    function renounceMainOperator(bytes32 detailsHash) external finalizedState nonReentrant {
        address previous = _requireDirectOperator();
        _requireDetails(detailsHash);
        _transitionOperator(previous, address(0), ReasonCode.OPERATOR_RENOUNCED, detailsHash);
    }

    function replaceMainOperator(SuccessorConsent calldata consent, bytes calldata signature)
        external
        finalizedState
        nonReentrant
    {
        address previous = _requireDirectOperator();
        address successor = consent.successor;
        if (successor == address(0) || successor == previous || _roleCollision(successor, 0)) {
            revert InvalidOperatorReplacement();
        }
        if (
            consent.currentOperator != previous || consent.generation != operatorGeneration
                || consent.outflowNonce != _sharedO2Nonce
        ) revert InvalidAuthorizationFields();
        if (consent.reasonCode != uint8(ReasonCode.OPERATOR_REPLACED)) {
            revert InvalidActionReason(consent.reasonCode);
        }
        _requireDetails(consent.detailsHash);
        _validateWindow(consent.issuedAt, consent.deadline);
        _validateSignature(successor, hashSuccessorConsent(consent), signature);
        _transitionOperator(previous, successor, ReasonCode.OPERATOR_REPLACED, consent.detailsHash);
    }

    function invalidateOutflowNonce(uint256 newNextNonce, bytes32 detailsHash) external finalizedState nonReentrant {
        address operator = _requireDirectOperator();
        _requireDetails(detailsHash);
        uint256 current = _sharedO2Nonce;
        if (current == type(uint256).max) revert OutflowNonceExhausted(current);
        if (newNextNonce != current + 1) revert InvalidOutflowNonceStep(current, newNextNonce);
        _sharedO2Nonce = newNextNonce;
        bytes32 topic = _OUTFLOW_NONCE_INVALIDATED_TOPIC;
        uint256 generation = operatorGeneration;
        ReasonCode reason = ReasonCode.OUTFLOW_NONCE_INVALIDATED;
        assembly ("memory-safe") {
            let data := mload(0x40)
            mstore(data, current)
            mstore(add(data, 0x20), newNextNonce)
            mstore(add(data, 0x40), reason)
            mstore(add(data, 0x60), detailsHash)
            log3(data, 0x80, topic, operator, generation)
        }
    }

    function pause(bytes32 detailsHash) external finalizedState nonReentrant {
        if (_msgSender() != owner() && _msgSender() != mainOperator) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
        if (paused()) revert ExpectedPause();
        _requireDetails(detailsHash);
        _pause();
        bytes32 topic = _RISK_PAUSED_TOPIC;
        address actor = _msgSender();
        ReasonCode reason = ReasonCode.RISK_PAUSED;
        assembly ("memory-safe") {
            let data := mload(0x40)
            mstore(data, reason)
            mstore(add(data, 0x20), detailsHash)
            log2(data, 0x40, topic, actor)
        }
    }

    function unpause(bytes32 detailsHash) external finalizedState nonReentrant onlyOwner {
        if (!paused()) revert ExpectedPause();
        _requireDetails(detailsHash);
        revert LocalReadinessFailed(11);
    }

    function hashOutflowAuthorization(OutflowAuthorization calldata authorization) public view returns (bytes32) {
        bytes32 structHash;
        bytes32 typeHash = OUTFLOW_AUTHORIZATION_TYPEHASH;
        bytes32 action = _O2_ACTION;
        address core = _core;
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            mstore(ptr, typeHash)
            mstore(add(ptr, 0x20), address())
            mstore(add(ptr, 0x40), core)
            mstore(add(ptr, 0x60), core)
            mstore(add(ptr, 0x80), action)
            calldatacopy(add(ptr, 0xa0), authorization, 0x120)
            structHash := keccak256(ptr, 0x1c0)
        }
        return _hashTypedDataV4(structHash);
    }

    function hashSuccessorConsent(SuccessorConsent calldata consent) public view returns (bytes32) {
        bytes32 structHash;
        bytes32 typeHash = SUCCESSOR_CONSENT_TYPEHASH;
        bytes32 action = _REPLACEMENT_ACTION;
        address core = _core;
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            mstore(ptr, typeHash)
            mstore(add(ptr, 0x20), address())
            mstore(add(ptr, 0x40), core)
            mstore(add(ptr, 0x60), address())
            mstore(add(ptr, 0x80), action)
            calldatacopy(add(ptr, 0xa0), consent, 0x100)
            structHash := keccak256(ptr, 0x1a0)
        }
        return _hashTypedDataV4(structHash);
    }

    function proposeIngress(IngressConfig calldata config, bytes32 detailsHash)
        external
        finalizedState
        nonReentrant
        onlyOwner
        returns (bytes32 proposalId)
    {
        if (_pendingIngressProposal.proposalId != bytes32(0)) {
            revert IngressProposalPending(_pendingIngressProposal.proposalId);
        }
        _validateIngressConfig(config, false);
        _requireDetails(detailsHash);
        _requireProposalTimestampRoom();
        if (ingressProposalNonce == type(uint256).max) revert CounterExhausted(_INGRESS_PROPOSAL_COUNTER);
        uint256 proposalNumber = ingressProposalNonce + 1;
        uint64 proposedAt = uint64(block.timestamp);
        uint64 validAfter = proposedAt + INGRESS_PROPOSAL_DELAY;
        uint64 expiresAt = validAfter + INGRESS_ACCEPTANCE_WINDOW;
        bytes32 configHash = _ingressConfigHash(config);
        PendingIngressProposal memory value = PendingIngressProposal({
            proposalId: bytes32(0),
            proposalNumber: proposalNumber,
            proposedBy: _msgSender(),
            config: config,
            configHash: configHash,
            proposedAt: proposedAt,
            validAfter: validAfter,
            expiresAt: expiresAt,
            detailsHash: detailsHash
        });
        proposalId = _ingressProposalId(value);
        value.proposalId = proposalId;
        ingressProposalNonce = proposalNumber;
        _pendingIngressProposal = value;
        _emitIngressProposalCreated(value);
    }

    function _emitIngressProposalCreated(PendingIngressProposal memory pending) private {
        bytes32 topic = _INGRESS_PROPOSAL_CREATED_TOPIC;
        assembly ("memory-safe") {
            let config := mload(add(pending, 0x60))
            let data := mload(0x40)
            mstore(data, mload(add(pending, 0x20)))
            mstore(add(data, 0x20), mload(add(pending, 0x80)))
            mstore(add(data, 0x40), mload(add(pending, 0xa0)))
            mstore(add(data, 0x60), mload(add(pending, 0xc0)))
            mstore(add(data, 0x80), mload(add(pending, 0xe0)))
            mstore(add(data, 0xa0), 13)
            mstore(add(data, 0xc0), mload(add(pending, 0x100)))
            log4(data, 0xe0, topic, mload(pending), mload(config), mload(add(pending, 0x40)))
        }
    }

    function cancelIngressProposal(bytes32 proposalId, bytes32 detailsHash)
        external
        finalizedState
        nonReentrant
        onlyOwner
    {
        PendingIngressProposal memory pending = _requirePendingIngress(proposalId);
        _requireDetails(detailsHash);
        delete _pendingIngressProposal;
        _emitProposalResult(
            _INGRESS_CANCELLED_TOPIC,
            pending.proposalId,
            pending.config.ingress,
            _msgSender(),
            ReasonCode.INGRESS_PROPOSAL_CANCELLED,
            detailsHash
        );
    }

    function expireIngressProposal(bytes32 proposalId) external finalizedState nonReentrant {
        PendingIngressProposal memory pending = _requirePendingIngress(proposalId);
        if (block.timestamp < pending.expiresAt) revert ProposalNotReady(pending.expiresAt);
        delete _pendingIngressProposal;
        bytes32 detailsHash = _ingressExpiryDetails(pending);
        _emitProposalResult(
            _INGRESS_EXPIRED_TOPIC,
            pending.proposalId,
            pending.config.ingress,
            _msgSender(),
            ReasonCode.INGRESS_PROPOSAL_EXPIRED,
            detailsHash
        );
    }

    function activateIngress(bytes32 proposalId)
        external
        finalizedState
        nonReentrant
        onlyOwner
        whenPaused
        returns (uint256 generation)
    {
        PendingIngressProposal memory pending = _requirePendingIngress(proposalId);
        uint64 activatedAt = _checkedTimestamp();
        if (activatedAt < pending.validAfter) revert ProposalNotReady(pending.validAfter);
        if (activatedAt >= pending.expiresAt) revert ProposalExpired(pending.expiresAt);
        if (activeIngressGeneration != 0) {
            revert IngressActive(_ingressRecords[activeIngressGeneration].ingress);
        }
        _validateIngressConfig(pending.config, true);
        if (_ingressConfigHash(pending.config) != pending.configHash) revert InvalidIngressConfig();
        if (ingressGeneration == type(uint256).max) revert CounterExhausted(_INGRESS_GENERATION_COUNTER);
        generation = ingressGeneration + 1;
        _ingressRecords[generation] = IngressRecord({
            generation: generation,
            ingress: pending.config.ingress,
            runtimeCodeHash: pending.config.runtimeCodeHash,
            perDepositCapWei: pending.config.perDepositCapWei,
            epochDepositCapWei: pending.config.epochDepositCapWei,
            lifetimeDepositCapWei: pending.config.lifetimeDepositCapWei,
            activatedAt: activatedAt,
            disabledAt: 0
        });
        delete _pendingIngressProposal;
        ingressGeneration = generation;
        activeIngressGeneration = generation;
        _emitIngressActivated(generation, pending, activatedAt);
    }

    function _emitIngressActivated(uint256 generation, PendingIngressProposal memory pending, uint64 activatedAt)
        private
    {
        bytes32 topic = _INGRESS_ACTIVATED_TOPIC;
        assembly ("memory-safe") {
            let config := mload(add(pending, 0x60))
            let data := mload(0x40)
            mstore(data, mload(add(config, 0x20)))
            mstore(add(data, 0x20), mload(add(config, 0x40)))
            mstore(add(data, 0x40), mload(add(config, 0x60)))
            mstore(add(data, 0x60), mload(add(config, 0x80)))
            mstore(add(data, 0x80), activatedAt)
            mstore(add(data, 0xa0), 16)
            mstore(add(data, 0xc0), mload(add(pending, 0x100)))
            log4(data, 0xe0, topic, generation, mload(config), mload(pending))
        }
    }

    function disableIngress(bytes32 detailsHash) external finalizedState nonReentrant onlyOwner {
        uint256 generation = activeIngressGeneration;
        if (generation == 0) revert NoActiveIngress();
        IngressRecord storage record = _ingressRecords[generation];
        if (record.generation != generation || record.ingress == address(0)) revert NoActiveIngress();
        _requireDetails(detailsHash);
        uint64 disabledAt = _checkedTimestamp();
        record.disabledAt = disabledAt;
        activeIngressGeneration = 0;
        bytes32 topic = _INGRESS_DISABLED_TOPIC;
        address ingress = record.ingress;
        address actor = _msgSender();
        ReasonCode reason = ReasonCode.INGRESS_DISABLED;
        assembly ("memory-safe") {
            let data := mload(0x40)
            mstore(data, disabledAt)
            mstore(add(data, 0x20), reason)
            mstore(add(data, 0x40), detailsHash)
            log4(data, 0x60, topic, generation, ingress, actor)
        }
    }

    function _initial(bool condition, uint8 field) private pure {
        if (!condition) {
            bytes4 selector = AuthorityInitialStateMismatch.selector;
            assembly ("memory-safe") {
                mstore(0, selector)
                mstore(4, field)
                revert(0, 0x24)
            }
        }
    }

    function _requireDetails(bytes32 detailsHash) private pure {
        if (detailsHash == bytes32(0)) revert EmptyDetailsHash();
    }

    function _requireProposalTimestampRoom() private view {
        if (block.timestamp > type(uint64).max - OPERATOR_NOMINATION_DELAY - OPERATOR_ACCEPTANCE_WINDOW) {
            revert TimestampOverflow();
        }
    }

    function _checkedTimestamp() private view returns (uint64) {
        if (block.timestamp > type(uint64).max) revert TimestampOverflow();
        return uint64(block.timestamp);
    }

    function _nextGeneration() private view returns (uint256) {
        if (operatorGeneration == type(uint256).max) revert CounterExhausted(_GENERATION_COUNTER);
        return operatorGeneration + 1;
    }

    function _requireDirectOperator() private view returns (address operator) {
        operator = mainOperator;
        if (operator == address(0)) revert NoMainOperator();
        if (_msgSender() != operator) revert OwnableUnauthorizedAccount(_msgSender());
    }

    function _requirePending(bytes32 proposalId) private view returns (PendingOperatorNomination memory pending) {
        pending = _pendingMainOperatorNomination;
        if (pending.proposalId == bytes32(0)) revert OperatorNominationMissing();
        if (proposalId != pending.proposalId) revert ProposalIdMismatch(pending.proposalId, proposalId);
    }

    function _requirePendingIngress(bytes32 proposalId) private view returns (PendingIngressProposal memory pending) {
        pending = _pendingIngressProposal;
        if (pending.proposalId == bytes32(0)) revert IngressProposalMissing();
        if (proposalId != pending.proposalId) revert ProposalIdMismatch(pending.proposalId, proposalId);
    }

    function _checkOwnerCandidate(address candidate, bool ignorePendingOwner) private view {
        if (_roleCollision(candidate, ignorePendingOwner ? 1 : 0)) revert RoleIdentityCollision(candidate);
        if (candidate.code.length == 0) revert ContractRequired(candidate);
    }

    function _checkOperatorCandidate(address candidate, bool ignorePendingNominee) private view {
        if (candidate == address(0)) revert ZeroAddress();
        if (_roleCollision(candidate, ignorePendingNominee ? 2 : 0)) revert RoleIdentityCollision(candidate);
    }

    function _roleCollision(address candidate, uint8 ignored) private view returns (bool) {
        return candidate == owner() || (ignored & 1 == 0 && candidate == pendingOwner()) || candidate == mainOperator
            || (ignored & 2 == 0 && candidate == _pendingMainOperatorNomination.nominee)
            || candidate == _activeIngressAddress()
            || (ignored & 4 == 0 && candidate == _pendingIngressProposal.config.ingress)
            || _constellationCollision(candidate);
    }

    function _constellationCollision(address candidate) private view returns (bool) {
        return candidate == address(this) || candidate == _factory || candidate == _registry || candidate == _core
            || candidate == _budgetBook || candidate == _intentExecution || candidate == _reconciliation;
    }

    function _activeIngressAddress() private view returns (address) {
        return _ingressRecords[activeIngressGeneration].ingress;
    }

    function _validateIngressConfig(IngressConfig memory config, bool ignorePendingIngress) private view {
        if (config.ingress == address(0)) revert ZeroAddress();
        if (
            config.runtimeCodeHash == bytes32(0) || config.perDepositCapWei == 0
                || config.perDepositCapWei > config.epochDepositCapWei
                || config.epochDepositCapWei > config.lifetimeDepositCapWei
        ) revert InvalidIngressConfig();
        if (config.ingress.code.length == 0) revert ContractRequired(config.ingress);
        bytes32 actual = config.ingress.codehash;
        if (actual != config.runtimeCodeHash) {
            revert IngressCodeHashMismatch(config.ingress, config.runtimeCodeHash, actual);
        }
        if (_roleCollision(config.ingress, ignorePendingIngress ? 4 : 0)) revert RoleIdentityCollision(config.ingress);
    }

    function _ingressConfigHash(IngressConfig memory config) private view returns (bytes32) {
        return _configHash(
            config.ingress,
            config.runtimeCodeHash,
            config.perDepositCapWei,
            config.epochDepositCapWei,
            config.lifetimeDepositCapWei
        );
    }

    function _ingressRecordConfigHash(IngressRecord memory record) private view returns (bytes32) {
        if (record.ingress == address(0)) return bytes32(0);
        return _configHash(
            record.ingress,
            record.runtimeCodeHash,
            record.perDepositCapWei,
            record.epochDepositCapWei,
            record.lifetimeDepositCapWei
        );
    }

    function _configHash(address ingress, bytes32 runtimeHash, uint256 perCap, uint256 epochCap, uint256 lifetimeCap)
        private
        view
        returns (bytes32 result)
    {
        bytes32 tag = _INGRESS_CONFIG_TAG;
        address core = _core;
        assembly ("memory-safe") {
            let p := mload(0x40)
            mstore(p, tag)
            mstore(add(p, 0x20), 4663)
            mstore(add(p, 0x40), core)
            mstore(add(p, 0x60), address())
            mstore(add(p, 0x80), ingress)
            mstore(add(p, 0xa0), runtimeHash)
            mstore(add(p, 0xc0), perCap)
            mstore(add(p, 0xe0), epochCap)
            mstore(add(p, 0x100), lifetimeCap)
            result := keccak256(p, 0x120)
        }
    }

    function _operatorStateHash(PendingOperatorNomination memory pending) private pure returns (bytes32 result) {
        assembly ("memory-safe") { result := keccak256(pending, 0x100) }
    }

    function _ownershipCancellationDetails(PendingOperatorNomination memory pending, address previous, address next)
        private
        view
        returns (bytes32 result)
    {
        bytes32 tag = _OWNERSHIP_CANCEL_TAG;
        address core = _core;
        assembly ("memory-safe") {
            let p := mload(0x40)
            mstore(p, tag)
            mstore(add(p, 0x20), 4663)
            mstore(add(p, 0x40), core)
            mstore(add(p, 0x60), address())
            mstore(add(p, 0x80), mload(pending))
            mstore(add(p, 0xa0), mload(add(pending, 0x20)))
            mstore(add(p, 0xc0), previous)
            mstore(add(p, 0xe0), next)
            mstore(add(p, 0x100), mload(add(pending, 0x40)))
            result := keccak256(p, 0x120)
        }
    }

    function _operatorExpiryDetails(PendingOperatorNomination memory pending) private view returns (bytes32 result) {
        bytes32 tag = _OPERATOR_EXPIRY_TAG;
        address core = _core;
        assembly ("memory-safe") {
            let p := mload(0x40)
            mstore(p, tag)
            mstore(add(p, 0x20), 4663)
            mstore(add(p, 0x40), core)
            mstore(add(p, 0x60), address())
            mstore(add(p, 0x80), mload(pending))
            mstore(add(p, 0xa0), mload(add(pending, 0x20)))
            mstore(add(p, 0xc0), mload(add(pending, 0x40)))
            mstore(add(p, 0xe0), mload(add(pending, 0xc0)))
            result := keccak256(p, 0x100)
        }
    }

    function _ingressExpiryDetails(PendingIngressProposal memory pending) private view returns (bytes32 result) {
        bytes32 tag = _INGRESS_EXPIRY_TAG;
        address core = _core;
        assembly ("memory-safe") {
            let c := mload(add(pending, 0x60))
            let p := mload(0x40)
            mstore(p, tag)
            mstore(add(p, 0x20), 4663)
            mstore(add(p, 0x40), core)
            mstore(add(p, 0x60), address())
            mstore(add(p, 0x80), mload(pending))
            mstore(add(p, 0xa0), mload(add(pending, 0x20)))
            mstore(add(p, 0xc0), mload(c))
            mstore(add(p, 0xe0), mload(add(pending, 0xe0)))
            result := keccak256(p, 0x100)
        }
    }

    function _operatorProposalId(PendingOperatorNomination memory pending) private view returns (bytes32 result) {
        bytes32 tag = _OPERATOR_PROPOSAL_TAG;
        address core = _core;
        uint256 generation = operatorGeneration;
        address currentOwner = owner();
        assembly ("memory-safe") {
            let p := mload(0x40)
            mstore(p, tag)
            mstore(add(p, 0x20), 4663)
            mstore(add(p, 0x40), core)
            mstore(add(p, 0x60), address())
            mstore(add(p, 0x80), generation)
            mstore(add(p, 0xa0), mload(add(pending, 0x20)))
            mstore(add(p, 0xc0), currentOwner)
            mstore(add(p, 0xe0), mload(add(pending, 0x40)))
            mstore(add(p, 0x100), mload(add(pending, 0x80)))
            mstore(add(p, 0x120), mload(add(pending, 0xa0)))
            mstore(add(p, 0x140), mload(add(pending, 0xc0)))
            mstore(add(p, 0x160), mload(add(pending, 0xe0)))
            result := keccak256(p, 0x180)
        }
    }

    function _ingressStateHash(PendingIngressProposal memory pending) private pure returns (bytes32 result) {
        assembly ("memory-safe") {
            let c := mload(add(pending, 0x60))
            let p := mload(0x40)
            mstore(p, mload(pending))
            mstore(add(p, 0x20), mload(add(pending, 0x20)))
            mstore(add(p, 0x40), mload(add(pending, 0x40)))
            mstore(add(p, 0x60), mload(c))
            mstore(add(p, 0x80), mload(add(c, 0x20)))
            mstore(add(p, 0xa0), mload(add(c, 0x40)))
            mstore(add(p, 0xc0), mload(add(c, 0x60)))
            mstore(add(p, 0xe0), mload(add(c, 0x80)))
            mstore(add(p, 0x100), mload(add(pending, 0x80)))
            mstore(add(p, 0x120), mload(add(pending, 0xa0)))
            mstore(add(p, 0x140), mload(add(pending, 0xc0)))
            mstore(add(p, 0x160), mload(add(pending, 0xe0)))
            mstore(add(p, 0x180), mload(add(pending, 0x100)))
            result := keccak256(p, 0x1a0)
        }
    }

    function _ingressProposalId(PendingIngressProposal memory pending) private view returns (bytes32 result) {
        bytes32 tag = _INGRESS_PROPOSAL_TAG;
        address core = _core;
        uint256 generation = ingressGeneration;
        address currentOwner = owner();
        assembly ("memory-safe") {
            let c := mload(add(pending, 0x60))
            let p := mload(0x40)
            mstore(p, tag)
            mstore(add(p, 0x20), 4663)
            mstore(add(p, 0x40), core)
            mstore(add(p, 0x60), address())
            mstore(add(p, 0x80), generation)
            mstore(add(p, 0xa0), mload(add(pending, 0x20)))
            mstore(add(p, 0xc0), currentOwner)
            mstore(add(p, 0xe0), mload(c))
            mstore(add(p, 0x100), mload(add(c, 0x20)))
            mstore(add(p, 0x120), mload(add(c, 0x40)))
            mstore(add(p, 0x140), mload(add(c, 0x60)))
            mstore(add(p, 0x160), mload(add(c, 0x80)))
            mstore(add(p, 0x180), mload(add(pending, 0x80)))
            mstore(add(p, 0x1a0), mload(add(pending, 0xa0)))
            mstore(add(p, 0x1c0), mload(add(pending, 0xc0)))
            mstore(add(p, 0x1e0), mload(add(pending, 0x100)))
            result := keccak256(p, 0x200)
        }
    }

    function _validateWindow(uint64 issuedAt, uint64 deadline) private view {
        if (issuedAt == 0 || issuedAt > deadline || uint256(deadline) - issuedAt > MAX_AUTHORIZATION_LIFETIME) {
            revert InvalidAuthorizationWindow();
        }
        if (block.timestamp < issuedAt) revert AuthorizationNotYetValid();
        if (block.timestamp > deadline) revert AuthorizationExpired();
    }

    function _validateSignature(address signer, bytes32 digest, bytes calldata signature) private view {
        if (signature.length == 0 || signature.length > MAX_SIGNATURE_BYTES) revert InvalidSignature();
        if (signer.code.length == 0) {
            if (signature.length != 65) revert InvalidSignature();
            bytes32 r;
            bytes32 s;
            uint256 v;
            address recovered;
            assembly ("memory-safe") {
                r := calldataload(signature.offset)
                s := calldataload(add(signature.offset, 0x20))
                v := byte(0, calldataload(add(signature.offset, 0x40)))
            }
            if (uint256(s) > _SECP256K1_HALF_ORDER || (v != 27 && v != 28)) revert InvalidSignature();
            assembly ("memory-safe") {
                let input := mload(0x40)
                mstore(input, digest)
                mstore(add(input, 0x20), v)
                mstore(add(input, 0x40), r)
                mstore(add(input, 0x60), s)
                mstore(add(input, 0x80), 0)
                pop(staticcall(gas(), 1, input, 0x80, add(input, 0x80), 0x20))
                recovered := mload(add(input, 0x80))
            }
            if (recovered != signer) revert InvalidSignature();
            return;
        }
        if (gasleft() < ERC1271_MIN_PRECALL_GAS) revert InsufficientSignatureValidationGas();
        bool ok;
        uint256 size;
        bytes32 result;
        assembly ("memory-safe") {
            let input := mload(0x40)
            mstore(input, shl(224, _ERC1271_MAGIC))
            mstore(add(input, 0x04), digest)
            mstore(add(input, 0x24), 0x40)
            let length := signature.length
            mstore(add(input, 0x44), length)
            calldatacopy(add(input, 0x64), signature.offset, length)
            mstore(add(add(input, 0x64), length), 0)
            let inputLength := add(0x64, and(add(length, 0x1f), not(0x1f)))
            let output := add(input, inputLength)
            ok := staticcall(ERC1271_CALL_GAS, signer, input, inputLength, output, 0x20)
            size := returndatasize()
            result := mload(output)
        }
        if (gasleft() < ERC1271_POST_CALL_GAS_RESERVE) revert InsufficientSignatureValidationGas();
        if (!ok || size != 32 || bytes4(result) != _ERC1271_MAGIC) revert InvalidSignature();
    }

    function _predict(address deployer, uint8 nonce) private pure returns (address) {
        bytes32 digest;
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            mstore(ptr, shl(240, 0xd694))
            mstore(add(ptr, 2), shl(96, deployer))
            mstore8(add(ptr, 22), nonce)
            digest := keccak256(ptr, 23)
        }
        return address(uint160(uint256(digest)));
    }
}
