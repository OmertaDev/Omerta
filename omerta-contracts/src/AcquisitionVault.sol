// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IStockTokenRegistryV2} from "./interfaces/IStockTokenRegistryV2.sol";
import {IAcquisitionVaultV1} from "./interfaces/IAcquisitionVaultV1.sol";

contract AcquisitionVault is IAcquisitionVaultV1, EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    uint256 public constant supportedChainId = 4663;
    uint64 public constant OPERATOR_NOMINATION_DELAY = 48 hours;
    uint64 public constant OPERATOR_ACCEPTANCE_WINDOW = 7 days;
    uint64 public constant INGRESS_PROPOSAL_DELAY = 48 hours;
    uint64 public constant INGRESS_ACCEPTANCE_WINDOW = 7 days;
    uint64 public constant MAX_AUTHORIZATION_LIFETIME = 1 hours;
    uint256 public constant MAX_SIGNATURE_BYTES = 4096;
    uint256 public constant ERC1271_CALL_GAS = 100000;
    uint256 public constant ERC1271_POST_CALL_GAS_RESERVE = 50000;
    uint256 public constant ERC1271_MIN_PRECALL_GAS = 160000;
    uint256 public constant MAX_ACTIVE_ORDINARY_RESERVATIONS = 32;
    uint256 public constant MAX_ACTIVE_RECONCILIATIONS = 32;
    uint256 public constant MAX_OPERATOR_OUTFLOW_COMPONENTS = 67;
    bytes32 public constant OUTFLOW_AUTHORIZATION_TYPEHASH = keccak256(
        "OutflowAuthorization(address operator,address destination,uint256 amountWei,uint256 generation,uint256 nonce,uint64 issuedAt,uint64 deadline,uint8 reasonCode,bytes32 detailsHash)"
    );
    bytes32 public constant SUCCESSOR_CONSENT_TYPEHASH = keccak256(
        "SuccessorConsent(address currentOperator,address successor,uint256 generation,uint256 outflowNonce,uint64 issuedAt,uint64 deadline,uint8 reasonCode,bytes32 detailsHash)"
    );

    bytes32 private constant _NOMINATION_KIND = keccak256("OMERTA_ACQUISITION_OPERATOR_NOMINATION_V1");
    bytes32 private constant _EXPIRY_KIND = keccak256("OMERTA_ACQUISITION_OPERATOR_EXPIRY_DETAILS_V1");
    bytes32 private constant _NOMINATION_COUNTER = keccak256("nominationNonce");
    bytes32 private constant _GENERATION_COUNTER = keccak256("operatorGeneration");
    bytes4 private constant _ERC1271_MAGIC = 0x1626ba7e;

    address public immutable stockTokenRegistryV2;
    string public constant version = "1";
    address public mainOperator;
    uint256 public operatorGeneration;
    uint256 public outflowNonce;
    uint256 public nominationNonce;
    PendingOperatorNomination private _pendingMainOperatorNomination;

    constructor(address safeOwner, address registry) Ownable(safeOwner) EIP712("OMERTA AcquisitionVault", "1") {
        if (block.chainid != supportedChainId) revert WrongChain(block.chainid);
        if (safeOwner.code.length == 0) revert ContractRequired(safeOwner);
        if (registry == address(0)) revert ZeroAddress();
        if (registry == safeOwner || registry == address(this)) revert RoleIdentityCollision(registry);
        if (registry.code.length == 0) revert ContractRequired(registry);
        bool ok;
        uint256 size;
        uint256 actual;
        bytes4 selector = IStockTokenRegistryV2.supportedChainId.selector;
        assembly {
            let input := mload(0x40)
            mstore(input, selector)
            ok := staticcall(gas(), registry, input, 4, 0, 0)
            size := returndatasize()
            if iszero(lt(size, 32)) {
                returndatacopy(input, 0, 32)
                actual := mload(input)
            }
        }
        if (!ok || size != 32) revert RegistryChainMismatch(0);
        if (actual != supportedChainId) revert RegistryChainMismatch(actual);
        stockTokenRegistryV2 = registry;
        _pause();
    }

    function pendingMainOperatorNomination() external view returns (PendingOperatorNomination memory) {
        return _pendingMainOperatorNomination;
    }

    function transferOwnership(address newOwner) public override onlyOwner {
        if (newOwner == address(0)) {
            if (pendingOwner() == address(0)) revert NoPendingOwnershipTransfer();
            super./* lexical call-family delimiter */ transferOwnership(address(0));
            return;
        }
        _checkOwnerCandidate(newOwner);
        super./* lexical call-family delimiter */ transferOwnership(newOwner);
    }

    function acceptOwnership() public override {
        address candidate = pendingOwner();
        if (_msgSender() != candidate || candidate == address(0)) revert OwnableUnauthorizedAccount(_msgSender());
        _checkOwnerCandidate(candidate);
        super.acceptOwnership();
    }

    function renounceOwnership() public override onlyOwner {
        revert OwnershipRenunciationDisabled();
    }

    function nominateMainOperator(address nominee, bytes32 detailsHash)
        external
        onlyOwner
        returns (bytes32 proposalId)
    {
        if (mainOperator != address(0)) revert MainOperatorActive(mainOperator);
        if (_pendingMainOperatorNomination.proposalId != bytes32(0)) {
            revert OperatorNominationPending(_pendingMainOperatorNomination.proposalId);
        }
        _checkOperatorCandidate(nominee, false);
        _requireDetails(detailsHash);
        if (block.timestamp > type(uint64).max - OPERATOR_NOMINATION_DELAY - OPERATOR_ACCEPTANCE_WINDOW) {
            revert TimestampOverflow();
        }
        if (nominationNonce == type(uint256).max) revert CounterExhausted(_NOMINATION_COUNTER);
        uint256 number = nominationNonce + 1;
        uint64 proposedAt = uint64(block.timestamp);
        uint64 validAfter = proposedAt + OPERATOR_NOMINATION_DELAY;
        uint64 expiresAt = validAfter + OPERATOR_ACCEPTANCE_WINDOW;
        proposalId = keccak256(
            abi.encode(
                _NOMINATION_KIND,
                supportedChainId,
                address(this),
                number,
                owner(),
                nominee,
                proposedAt,
                validAfter,
                expiresAt,
                detailsHash
            )
        );
        nominationNonce = number;
        _pendingMainOperatorNomination = PendingOperatorNomination(
            proposalId, number, nominee, _msgSender(), proposedAt, validAfter, expiresAt, detailsHash
        );
        emit MainOperatorNominationCreated(
            proposalId,
            nominee,
            _msgSender(),
            number,
            proposedAt,
            validAfter,
            expiresAt,
            uint8(ReasonCode.OPERATOR_NOMINATION),
            detailsHash
        );
    }

    function cancelMainOperatorNomination(bytes32 proposalId, bytes32 detailsHash) external onlyOwner {
        PendingOperatorNomination memory p = _requirePending(proposalId);
        _requireDetails(detailsHash);
        delete _pendingMainOperatorNomination;
        emit MainOperatorNominationCancelled(
            p.proposalId, p.nominee, _msgSender(), uint8(ReasonCode.OPERATOR_NOMINATION_CANCELLED), detailsHash
        );
    }

    function expireMainOperatorNomination(bytes32 proposalId) external {
        PendingOperatorNomination memory p = _requirePending(proposalId);
        if (block.timestamp < p.expiresAt) revert ProposalNotReady(p.expiresAt);
        delete _pendingMainOperatorNomination;
        bytes32 details = keccak256(abi.encode(_EXPIRY_KIND, proposalId));
        emit MainOperatorNominationExpired(
            p.proposalId, p.nominee, _msgSender(), uint8(ReasonCode.OPERATOR_NOMINATION_EXPIRED), details
        );
    }

    function acceptMainOperatorNomination(bytes32 proposalId) external {
        PendingOperatorNomination memory p = _requirePending(proposalId);
        if (_msgSender() != p.nominee) revert NotNominee(_msgSender());
        if (block.timestamp < p.validAfter) revert ProposalNotReady(p.validAfter);
        if (block.timestamp >= p.expiresAt) revert ProposalExpired(p.expiresAt);
        _checkOperatorCandidate(p.nominee, true);
        uint256 next = _nextGeneration();
        delete _pendingMainOperatorNomination;
        mainOperator = p.nominee;
        operatorGeneration = next;
        emit MainOperatorChanged(
            address(0), p.nominee, next, outflowNonce, uint8(ReasonCode.OPERATOR_NOMINATION), p.detailsHash
        );
    }

    function disableMainOperator(bytes32 detailsHash) external onlyOwner {
        address previous = mainOperator;
        PendingOperatorNomination memory p = _pendingMainOperatorNomination;
        if (previous == address(0) && p.proposalId == bytes32(0)) revert NoOperatorStateChange();
        _requireDetails(detailsHash);
        uint256 next = _nextGeneration();
        if (p.proposalId != bytes32(0)) {
            delete _pendingMainOperatorNomination;
            emit MainOperatorNominationCancelled(
                p.proposalId, p.nominee, _msgSender(), uint8(ReasonCode.OPERATOR_DISABLED), detailsHash
            );
        }
        mainOperator = address(0);
        operatorGeneration = next;
        emit MainOperatorChanged(
            previous, address(0), next, outflowNonce, uint8(ReasonCode.OPERATOR_DISABLED), detailsHash
        );
    }

    function renounceMainOperator(bytes32 detailsHash) external {
        address previous = _requireDirectOperator();
        _requireDetails(detailsHash);
        uint256 next = _nextGeneration();
        delete _pendingMainOperatorNomination;
        mainOperator = address(0);
        operatorGeneration = next;
        emit MainOperatorChanged(
            previous, address(0), next, outflowNonce, uint8(ReasonCode.OPERATOR_RENOUNCED), detailsHash
        );
    }

    function replaceMainOperator(SuccessorConsent calldata consent, bytes calldata signature) external nonReentrant {
        address previous = _requireDirectOperator();
        address successor = consent.successor;
        if (successor == address(0) || successor == previous || _operatorCollision(successor, false)) {
            revert InvalidOperatorReplacement();
        }
        if (
            consent.currentOperator != previous || consent.generation != operatorGeneration
                || consent.outflowNonce != outflowNonce
        ) revert InvalidAuthorizationFields();
        if (consent.reasonCode != uint8(ReasonCode.OPERATOR_REPLACED)) revert InvalidActionReason(consent.reasonCode);
        _requireDetails(consent.detailsHash);
        _validateWindow(consent.issuedAt, consent.deadline);
        bytes32 digest = hashSuccessorConsent(consent);
        _validateSignature(successor, digest, signature);
        uint256 next = _nextGeneration();
        delete _pendingMainOperatorNomination;
        mainOperator = successor;
        operatorGeneration = next;
        emit MainOperatorChanged(
            previous, successor, next, outflowNonce, uint8(ReasonCode.OPERATOR_REPLACED), consent.detailsHash
        );
    }

    function invalidateOutflowNonce(uint256 newNextNonce, bytes32 detailsHash) external {
        address operator = _requireDirectOperator();
        _requireDetails(detailsHash);
        uint256 current = outflowNonce;
        if (current == type(uint256).max) revert OutflowNonceExhausted(current);
        if (newNextNonce != current + 1) revert InvalidOutflowNonceStep(current, newNextNonce);
        outflowNonce = newNextNonce;
        emit OutflowNonceInvalidated(
            operator,
            operatorGeneration,
            current,
            newNextNonce,
            uint8(ReasonCode.OUTFLOW_NONCE_INVALIDATED),
            detailsHash
        );
    }

    function pause(bytes32 detailsHash) external {
        if (_msgSender() != owner() && _msgSender() != mainOperator) revert OwnableUnauthorizedAccount(_msgSender());
        if (paused()) revert ExpectedPause();
        _requireDetails(detailsHash);
        _pause();
        emit RiskPaused(_msgSender(), uint8(ReasonCode.RISK_PAUSED), detailsHash);
    }

    function unpause(bytes32 detailsHash) external onlyOwner {
        if (!paused()) revert ExpectedPause();
        _requireDetails(detailsHash);
        _requireLocalReadiness();
        _unpause();
        emit RiskUnpaused(_msgSender(), uint8(ReasonCode.RISK_UNPAUSED), detailsHash);
    }

    function hashOutflowAuthorization(OutflowAuthorization calldata a) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    OUTFLOW_AUTHORIZATION_TYPEHASH,
                    a.operator,
                    a.destination,
                    a.amountWei,
                    a.generation,
                    a.nonce,
                    a.issuedAt,
                    a.deadline,
                    a.reasonCode,
                    a.detailsHash
                )
            )
        );
    }

    function hashSuccessorConsent(SuccessorConsent calldata c) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    SUCCESSOR_CONSENT_TYPEHASH,
                    c.currentOperator,
                    c.successor,
                    c.generation,
                    c.outflowNonce,
                    c.issuedAt,
                    c.deadline,
                    c.reasonCode,
                    c.detailsHash
                )
            )
        );
    }

    function _checkOwnerCandidate(address candidate) private view {
        if (
            candidate == owner() || candidate == address(this) || candidate == stockTokenRegistryV2
                || candidate == mainOperator || candidate == _pendingMainOperatorNomination.nominee
        ) revert RoleIdentityCollision(candidate);
        if (candidate.code.length == 0) revert ContractRequired(candidate);
    }

    function _checkOperatorCandidate(address candidate, bool ignorePendingNominee) private view {
        if (candidate == address(0)) revert ZeroAddress();
        if (_operatorCollision(candidate, ignorePendingNominee)) revert RoleIdentityCollision(candidate);
    }

    function _operatorCollision(address candidate, bool ignorePendingNominee) private view returns (bool) {
        return candidate == owner() || candidate == pendingOwner() || candidate == address(this)
            || candidate == stockTokenRegistryV2
            || (!ignorePendingNominee && candidate == _pendingMainOperatorNomination.nominee);
    }

    function _requirePending(bytes32 proposalId) private view returns (PendingOperatorNomination memory p) {
        p = _pendingMainOperatorNomination;
        if (p.proposalId == bytes32(0)) revert OperatorNominationMissing();
        if (proposalId != p.proposalId) revert ProposalIdMismatch(p.proposalId, proposalId);
    }

    function _requireDirectOperator() private view returns (address operator) {
        operator = mainOperator;
        if (operator == address(0)) revert NoMainOperator();
        if (_msgSender() != operator) revert OwnableUnauthorizedAccount(_msgSender());
    }

    function _nextGeneration() private view returns (uint256) {
        if (operatorGeneration == type(uint256).max) revert CounterExhausted(_GENERATION_COUNTER);
        return operatorGeneration + 1;
    }

    function _requireDetails(bytes32 detailsHash) private pure {
        if (detailsHash == bytes32(0)) revert EmptyDetailsHash();
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
            (address recovered, ECDSA.RecoverError error,) = ECDSA.tryRecoverCalldata(digest, signature);
            if (error != ECDSA.RecoverError.NoError || recovered != signer) revert InvalidSignature();
            return;
        }
        bytes memory payload = abi.encodeWithSelector(_ERC1271_MAGIC, digest, signature);
        _requireErc1271PrecallGas(gasleft());
        bool ok;
        uint256 size;
        bytes32 result;
        assembly {
            ok := staticcall(ERC1271_CALL_GAS, signer, add(payload, 32), mload(payload), 0, 0)
            size := returndatasize()
            if iszero(lt(size, 32)) {
                returndatacopy(payload, 0, 32)
                result := mload(payload)
            }
        }
        _requireErc1271PostcallGas(gasleft());
        if (!ok || size != 32 || bytes4(result) != _ERC1271_MAGIC) revert InvalidSignature();
    }

    function _requireErc1271PrecallGas(uint256 observedGas) internal pure {
        if (observedGas < ERC1271_MIN_PRECALL_GAS) revert InsufficientSignatureValidationGas();
    }

    function _requireErc1271PostcallGas(uint256 observedGas) internal pure {
        if (observedGas < ERC1271_POST_CALL_GAS_RESERVE) revert InsufficientSignatureValidationGas();
    }

    function _requireLocalReadiness() private view {
        if (block.chainid != supportedChainId) revert LocalReadinessFailed(uint8(LocalReadinessCondition.WRONG_CHAIN));
        if (owner().code.length == 0) revert LocalReadinessFailed(uint8(LocalReadinessCondition.OWNER_CODE_MISSING));
        if (stockTokenRegistryV2.code.length == 0) {
            revert LocalReadinessFailed(uint8(LocalReadinessCondition.REGISTRY_CODE_MISSING));
        }
        address o = owner();
        address po = pendingOwner();
        address m = mainOperator;
        address n = _pendingMainOperatorNomination.nominee;
        if (
            o == address(this) || o == stockTokenRegistryV2
                || (po != address(0) && (po == o || po == address(this) || po == stockTokenRegistryV2))
                || (m != address(0) && (m == o || m == po || m == address(this) || m == stockTokenRegistryV2))
                || (n != address(0) && (n == o || n == po || n == m || n == address(this) || n == stockTokenRegistryV2))
        ) revert LocalReadinessFailed(uint8(LocalReadinessCondition.ROLE_COLLISION));
    }
}
