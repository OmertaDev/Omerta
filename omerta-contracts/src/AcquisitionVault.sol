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
    struct DepositWork {
        uint256 epochDay;
        uint256 epochTotal;
        uint256 generationTotal;
        uint256 globalTotal;
        uint256 nextSequence;
        uint256 repairWei;
        uint256 creditWei;
        uint64 depositedAt;
        AccountingTotals preTotals;
    }

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
    bytes32 private constant _OWNERSHIP_ACCEPTANCE_CANCEL_KIND =
        keccak256("OMERTA_ACQUISITION_OPERATOR_OWNERSHIP_ACCEPTANCE_CANCEL_V1");
    bytes32 private constant _NOMINATION_COUNTER = keccak256("nominationNonce");
    bytes32 private constant _GENERATION_COUNTER = keccak256("operatorGeneration");
    bytes32 private constant _ACCOUNTING_SEQUENCE_COUNTER = keccak256("accountingSequence");
    bytes32 private constant _ACCOUNTING_MUTATION_KIND = keccak256("OMERTA_ACQUISITION_ACCOUNTING_MUTATION_V1");
    bytes32 private constant _ACCOUNTING_COMPONENT_KIND = keccak256("OMERTA_ACQUISITION_ACCOUNTING_COMPONENT_V1");
    bytes32 private constant _SYNC_BALANCE_KIND = keccak256("OMERTA_ACQUISITION_SYNC_BALANCE_V1");
    bytes32 private constant _INGRESS_CONFIG_KIND = keccak256("OMERTA_ACQUISITION_INGRESS_CONFIG_V1");
    bytes32 private constant _INGRESS_PROPOSAL_KIND = keccak256("OMERTA_ACQUISITION_INGRESS_PROPOSAL_V1");
    bytes32 private constant _INGRESS_EXPIRY_KIND = keccak256("OMERTA_ACQUISITION_INGRESS_EXPIRY_DETAILS_V1");
    bytes32 private constant _DEPOSIT_KIND = keccak256("OMERTA_ACQUISITION_DEPOSIT_V1");
    bytes32 private constant _INGRESS_PROPOSAL_COUNTER = keccak256("ingressProposalNonce");
    bytes32 private constant _INGRESS_GENERATION_COUNTER = keccak256("ingressGeneration");
    bytes4 private constant _ERC1271_MAGIC = 0x1626ba7e;

    address public immutable stockTokenRegistryV2;
    uint256 public immutable globalLifetimeCanonicalDepositCapWei;
    string public constant version = "1";
    address public mainOperator;
    uint256 public operatorGeneration;
    uint256 public outflowNonce;
    uint256 public nominationNonce;
    PendingOperatorNomination private _pendingMainOperatorNomination;
    uint256 public availableWei;
    uint256 public unattributedWei;
    uint256 public ordinaryReservedWei;
    uint256 public reconciliationLiabilityWei;
    uint256 public reconciliationBackingWei;
    uint256 public accountingSequence;
    uint256 public lastObservedBalanceDeficitWei;
    uint256 public globalLifetimeCanonicalDepositedWei;
    uint256 public ingressProposalNonce;
    uint256 public ingressGeneration;
    uint256 public activeIngressGeneration;
    PendingIngressProposal private _pendingIngressProposal;
    mapping(uint256 => IngressRecord) private _ingressRecords;
    mapping(uint256 => uint256) public ingressLifetimeDepositedWei;
    mapping(uint256 => mapping(uint256 => uint256)) public ingressEpochDepositedWei;
    mapping(bytes32 => DepositRecord) private _depositRecords;

    constructor(address safeOwner, address registry, uint256 globalLifetimeCanonicalDepositCapWei_)
        Ownable(safeOwner)
        EIP712("OMERTA AcquisitionVault", "1")
    {
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
        if (globalLifetimeCanonicalDepositCapWei_ == 0) revert InvalidGlobalLifetimeCap();
        stockTokenRegistryV2 = registry;
        globalLifetimeCanonicalDepositCapWei = globalLifetimeCanonicalDepositCapWei_;
        _pause();
    }

    function pendingMainOperatorNomination() external view returns (PendingOperatorNomination memory) {
        return _pendingMainOperatorNomination;
    }

    function pendingIngressProposal() external view returns (PendingIngressProposal memory) {
        return _pendingIngressProposal;
    }

    function getIngress(uint256 generation) external view returns (IngressRecord memory record) {
        record = _ingressRecords[generation];
        if (record.generation == 0) revert IngressNotFound(generation);
    }

    function getDeposit(bytes32 depositId) external view returns (DepositRecord memory record) {
        record = _depositRecords[depositId];
        if (record.depositId == bytes32(0)) revert DepositNotFound(depositId);
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
        address previousOwner = owner();
        address candidate = pendingOwner();
        PendingOperatorNomination memory p = _pendingMainOperatorNomination;
        if (_msgSender() != candidate || candidate == address(0)) revert OwnableUnauthorizedAccount(_msgSender());
        _checkOwnerCandidate(candidate);
        super.acceptOwnership();
        if (p.proposalId != bytes32(0)) {
            delete _pendingMainOperatorNomination;
            bytes32 details =
                keccak256(abi.encode(_OWNERSHIP_ACCEPTANCE_CANCEL_KIND, p.proposalId, previousOwner, candidate));
            emit MainOperatorNominationCancelled(
                p.proposalId, p.nominee, candidate, uint8(ReasonCode.OPERATOR_NOMINATION_CANCELLED), details
            );
        }
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
        if (!_localReadinessSatisfied()) {
            revert LocalReadinessFailed(uint8(LocalReadinessCondition.ACTIVE_INGRESS_MISSING));
        }
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

    function accountingTotals() public view returns (AccountingTotals memory totals) {
        return _accountingTotalsAtBalance(address(this).balance);
    }

    function syncBalance() external returns (bytes32 mutationId) {
        AccountingTotals memory preTotals = accountingTotals();
        uint256 forcedSurplus = preTotals.forcedSurplusWei;
        bool observationChanged = preTotals.balanceDeficitWei != lastObservedBalanceDeficitWei;
        if (forcedSurplus == 0 && !observationChanged) revert NoBalanceDelta();

        uint256 nextSequence = _nextAccountingSequence();
        if (forcedSurplus != 0) unattributedWei = unattributedWei + forcedSurplus;
        accountingSequence = nextSequence;
        AccountingTotals memory postTotals = accountingTotals();
        lastObservedBalanceDeficitWei = postTotals.balanceDeficitWei;

        bytes32 subjectId = keccak256(abi.encode(_SYNC_BALANCE_KIND, preTotals, postTotals));
        mutationId = _accountingMutationId(nextSequence, AccountingMutationKind.SYNC_BALANCE, subjectId);
        uint256 componentCount = (forcedSurplus == 0 ? 0 : 1) + (observationChanged ? 1 : 0);
        emit AccountingMutation(
            nextSequence, mutationId, uint8(AccountingMutationKind.SYNC_BALANCE), preTotals, postTotals, componentCount
        );
        uint256 componentIndex;
        if (forcedSurplus != 0) {
            _emitAccountingComponent(
                nextSequence,
                mutationId,
                componentIndex,
                AccountingComponentKind.FORCED_SURPLUS_TO_UNATTRIBUTED,
                subjectId,
                forcedSurplus
            );
            ++componentIndex;
        }
        if (observationChanged) {
            _emitAccountingComponent(
                nextSequence,
                mutationId,
                componentIndex,
                AccountingComponentKind.BALANCE_DEFICIT_OBSERVATION_SET,
                subjectId,
                postTotals.balanceDeficitWei
            );
        }
    }

    function reclassifyUnattributed(uint256 amountWei, bytes32 detailsHash)
        external
        onlyOwner
        returns (bytes32 mutationId)
    {
        _requireDetails(detailsHash);
        if (amountWei == 0) revert InvalidAmount();
        AccountingTotals memory preTotals = accountingTotals();
        if (preTotals.balanceDeficitWei != 0) revert BalanceDeficitActive(preTotals.balanceDeficitWei);
        if (preTotals.reconciliationShortfallWei != 0) {
            revert ReconciliationShortfallActive(preTotals.reconciliationShortfallWei);
        }
        if (amountWei > preTotals.unattributedWei) {
            revert InsufficientUnattributed(preTotals.unattributedWei, amountWei);
        }

        uint256 nextSequence = _nextAccountingSequence();
        uint256 newAvailable = availableWei + amountWei;
        uint256 newUnattributed = unattributedWei - amountWei;
        availableWei = newAvailable;
        unattributedWei = newUnattributed;
        accountingSequence = nextSequence;
        AccountingTotals memory postTotals = accountingTotals();
        lastObservedBalanceDeficitWei = postTotals.balanceDeficitWei;

        mutationId =
            _accountingMutationId(nextSequence, AccountingMutationKind.UNATTRIBUTED_RECLASSIFICATION, detailsHash);
        emit AccountingMutation(
            nextSequence,
            mutationId,
            uint8(AccountingMutationKind.UNATTRIBUTED_RECLASSIFICATION),
            preTotals,
            postTotals,
            1
        );
        _emitAccountingComponent(
            nextSequence, mutationId, 0, AccountingComponentKind.UNATTRIBUTED_TO_AVAILABLE, detailsHash, amountWei
        );
        emit UnattributedReclassified(
            mutationId, nextSequence, _msgSender(), amountWei, uint8(ReasonCode.UNATTRIBUTED_RECLASSIFIED), detailsHash
        );
    }

    function proposeIngress(IngressConfig calldata config, bytes32 detailsHash)
        external
        onlyOwner
        returns (bytes32 proposalId)
    {
        if (_pendingIngressProposal.proposalId != bytes32(0)) {
            revert IngressProposalPending(_pendingIngressProposal.proposalId);
        }
        _validateIngressConfig(config, false);
        _requireDetails(detailsHash);
        if (block.timestamp > type(uint64).max - INGRESS_PROPOSAL_DELAY - INGRESS_ACCEPTANCE_WINDOW) {
            revert TimestampOverflow();
        }
        if (ingressProposalNonce == type(uint256).max) revert CounterExhausted(_INGRESS_PROPOSAL_COUNTER);
        uint256 proposalNumber = ingressProposalNonce + 1;
        uint64 proposedAt = uint64(block.timestamp);
        uint64 validAfter = proposedAt + INGRESS_PROPOSAL_DELAY;
        uint64 expiresAt = validAfter + INGRESS_ACCEPTANCE_WINDOW;
        bytes32 configHash = _ingressConfigHash(config);
        proposalId = keccak256(
            abi.encode(
                _INGRESS_PROPOSAL_KIND,
                supportedChainId,
                address(this),
                proposalNumber,
                owner(),
                configHash,
                proposedAt,
                validAfter,
                expiresAt,
                detailsHash
            )
        );
        ingressProposalNonce = proposalNumber;
        PendingIngressProposal storage pending = _pendingIngressProposal;
        pending.proposalId = proposalId;
        pending.proposalNumber = proposalNumber;
        pending.proposedBy = _msgSender();
        pending.config = config;
        pending.configHash = configHash;
        pending.proposedAt = proposedAt;
        pending.validAfter = validAfter;
        pending.expiresAt = expiresAt;
        pending.detailsHash = detailsHash;
        _emitIngressProposalCreated(pending);
    }

    function _emitIngressProposalCreated(PendingIngressProposal storage pending) private {
        emit IngressProposalCreated(
            pending.proposalId,
            pending.config.ingress,
            pending.proposedBy,
            pending.proposalNumber,
            pending.configHash,
            pending.proposedAt,
            pending.validAfter,
            pending.expiresAt,
            uint8(ReasonCode.INGRESS_PROPOSED),
            pending.detailsHash
        );
    }

    function cancelIngressProposal(bytes32 proposalId, bytes32 detailsHash) external onlyOwner {
        PendingIngressProposal storage p = _requirePendingIngress(proposalId);
        _requireDetails(detailsHash);
        bytes32 pendingId = p.proposalId;
        address ingress = p.config.ingress;
        delete _pendingIngressProposal;
        emit IngressProposalCancelled(
            pendingId, ingress, _msgSender(), uint8(ReasonCode.INGRESS_PROPOSAL_CANCELLED), detailsHash
        );
    }

    function expireIngressProposal(bytes32 proposalId) external {
        PendingIngressProposal storage p = _requirePendingIngress(proposalId);
        if (block.timestamp < p.expiresAt) revert ProposalNotReady(p.expiresAt);
        bytes32 pendingId = p.proposalId;
        address ingress = p.config.ingress;
        delete _pendingIngressProposal;
        bytes32 detailsHash = keccak256(abi.encode(_INGRESS_EXPIRY_KIND, proposalId));
        emit IngressProposalExpired(
            pendingId, ingress, _msgSender(), uint8(ReasonCode.INGRESS_PROPOSAL_EXPIRED), detailsHash
        );
    }

    function activateIngress(bytes32 proposalId) external onlyOwner whenPaused returns (uint256 generation) {
        PendingIngressProposal storage p = _requirePendingIngress(proposalId);
        uint64 activatedAt = _checkedTimestamp(block.timestamp);
        if (activatedAt < p.validAfter) revert ProposalNotReady(p.validAfter);
        if (activatedAt >= p.expiresAt) revert ProposalExpired(p.expiresAt);
        if (activeIngressGeneration != 0) {
            revert IngressActive(_ingressRecords[activeIngressGeneration].ingress);
        }
        IngressConfig memory config = p.config;
        _validateIngressConfig(config, true);
        if (_ingressConfigHash(config) != p.configHash) revert InvalidIngressConfig();
        if (ingressGeneration == type(uint256).max) revert CounterExhausted(_INGRESS_GENERATION_COUNTER);
        generation = ingressGeneration + 1;
        _ingressRecords[generation] = IngressRecord({
            generation: generation,
            ingress: config.ingress,
            runtimeCodeHash: config.runtimeCodeHash,
            perDepositCapWei: config.perDepositCapWei,
            epochDepositCapWei: config.epochDepositCapWei,
            lifetimeDepositCapWei: config.lifetimeDepositCapWei,
            activatedAt: activatedAt,
            disabledAt: 0
        });
        bytes32 pendingId = p.proposalId;
        bytes32 detailsHash = p.detailsHash;
        delete _pendingIngressProposal;
        ingressGeneration = generation;
        activeIngressGeneration = generation;
        emit IngressActivated(
            generation,
            config.ingress,
            pendingId,
            config.runtimeCodeHash,
            config.perDepositCapWei,
            config.epochDepositCapWei,
            config.lifetimeDepositCapWei,
            activatedAt,
            uint8(ReasonCode.INGRESS_ACTIVATED),
            detailsHash
        );
    }

    function disableIngress(bytes32 detailsHash) external onlyOwner {
        uint256 generation = activeIngressGeneration;
        if (generation == 0) revert NoActiveIngress();
        IngressRecord storage record = _ingressRecords[generation];
        if (record.generation != generation || record.ingress == address(0)) revert NoActiveIngress();
        _requireDetails(detailsHash);
        uint64 disabledAt = _checkedTimestamp(block.timestamp);
        record.disabledAt = disabledAt;
        activeIngressGeneration = 0;
        emit IngressDisabled(
            generation, record.ingress, _msgSender(), disabledAt, uint8(ReasonCode.INGRESS_DISABLED), detailsHash
        );
    }

    function depositCanonical(bytes32 sourceEventId) external payable returns (bytes32 depositId) {
        uint256 generation = activeIngressGeneration;
        if (generation == 0) revert NoActiveIngress();
        IngressRecord storage ingress = _ingressRecords[generation];
        if (_msgSender() != ingress.ingress) revert NotActiveIngress(_msgSender());
        _requireHealthyIngress(ingress.ingress, ingress.runtimeCodeHash, true);
        if (sourceEventId == bytes32(0)) revert DepositSourceRequired();
        if (msg.value == 0) revert InvalidAmount();
        DepositWork memory work;
        work.depositedAt = _checkedTimestamp(block.timestamp);
        depositId = keccak256(
            abi.encode(_DEPOSIT_KIND, supportedChainId, address(this), generation, _msgSender(), sourceEventId)
        );
        if (_depositRecords[depositId].depositId != bytes32(0)) revert DepositReplay(depositId);

        work.epochDay = block.timestamp / 1 days;
        _checkedDepositTotal(DepositCapKind.PER_DEPOSIT, ingress.perDepositCapWei, 0, msg.value);
        work.epochTotal = _checkedDepositTotal(
            DepositCapKind.EPOCH,
            ingress.epochDepositCapWei,
            ingressEpochDepositedWei[generation][work.epochDay],
            msg.value
        );
        work.generationTotal = _checkedDepositTotal(
            DepositCapKind.GENERATION_LIFETIME,
            ingress.lifetimeDepositCapWei,
            ingressLifetimeDepositedWei[generation],
            msg.value
        );
        work.globalTotal = _checkedDepositTotal(
            DepositCapKind.GLOBAL_LIFETIME,
            globalLifetimeCanonicalDepositCapWei,
            globalLifetimeCanonicalDepositedWei,
            msg.value
        );

        work.nextSequence = _nextAccountingSequence();
        uint256 preBalance = address(this).balance - msg.value;
        work.preTotals = _accountingTotalsAtBalance(preBalance);
        work.repairWei = msg.value < work.preTotals.balanceDeficitWei ? msg.value : work.preTotals.balanceDeficitWei;
        work.creditWei = msg.value - work.repairWei;
        uint256 newAvailable = availableWei + work.creditWei;

        availableWei = newAvailable;
        accountingSequence = work.nextSequence;
        ingressEpochDepositedWei[generation][work.epochDay] = work.epochTotal;
        ingressLifetimeDepositedWei[generation] = work.generationTotal;
        globalLifetimeCanonicalDepositedWei = work.globalTotal;
        DepositRecord memory deposit = DepositRecord({
            depositId: depositId,
            ingressGeneration: generation,
            ingress: ingress.ingress,
            sourceEventId: sourceEventId,
            amountWei: msg.value,
            balanceDeficitRepairWei: work.repairWei,
            availableCreditWei: work.creditWei,
            epochDay: work.epochDay,
            accountingSequence: work.nextSequence,
            depositedAt: work.depositedAt
        });
        _depositRecords[depositId] = deposit;
        AccountingTotals memory postTotals = accountingTotals();
        lastObservedBalanceDeficitWei = postTotals.balanceDeficitWei;
        _emitCanonicalDepositEvidence(deposit, work.preTotals, postTotals);
    }

    function _emitCanonicalDepositEvidence(
        DepositRecord memory deposit,
        AccountingTotals memory preTotals,
        AccountingTotals memory postTotals
    ) private {
        bytes32 mutationId = _accountingMutationId(
            deposit.accountingSequence, AccountingMutationKind.CANONICAL_DEPOSIT, deposit.depositId
        );
        uint256 componentCount =
            (deposit.balanceDeficitRepairWei == 0 ? 0 : 1) + (deposit.availableCreditWei == 0 ? 0 : 1);
        emit AccountingMutation(
            deposit.accountingSequence,
            mutationId,
            uint8(AccountingMutationKind.CANONICAL_DEPOSIT),
            preTotals,
            postTotals,
            componentCount
        );
        uint256 componentIndex;
        if (deposit.balanceDeficitRepairWei != 0) {
            _emitAccountingComponent(
                deposit.accountingSequence,
                mutationId,
                componentIndex,
                AccountingComponentKind.CANONICAL_DEPOSIT_DEFICIT_REPAIR,
                deposit.depositId,
                deposit.balanceDeficitRepairWei
            );
            ++componentIndex;
        }
        if (deposit.availableCreditWei != 0) {
            _emitAccountingComponent(
                deposit.accountingSequence,
                mutationId,
                componentIndex,
                AccountingComponentKind.CANONICAL_DEPOSIT_AVAILABLE_CREDIT,
                deposit.depositId,
                deposit.availableCreditWei
            );
        }
        emit CanonicalDeposit(
            deposit.depositId,
            deposit.ingressGeneration,
            deposit.sourceEventId,
            deposit.ingress,
            deposit.amountWei,
            deposit.balanceDeficitRepairWei,
            deposit.availableCreditWei,
            deposit.epochDay,
            deposit.accountingSequence,
            deposit.depositedAt
        );
    }

    function _checkOwnerCandidate(address candidate) private view {
        if (
            candidate == owner() || candidate == address(this) || candidate == stockTokenRegistryV2
                || candidate == mainOperator || candidate == _pendingMainOperatorNomination.nominee
                || candidate == _activeIngressAddress() || candidate == _pendingIngressProposal.config.ingress
        ) revert RoleIdentityCollision(candidate);
        if (candidate.code.length == 0) revert ContractRequired(candidate);
    }

    function _checkOperatorCandidate(address candidate, bool ignorePendingNominee) private view {
        if (candidate == address(0)) revert ZeroAddress();
        if (_operatorCollision(candidate, ignorePendingNominee)) revert RoleIdentityCollision(candidate);
    }

    function _operatorCollision(address candidate, bool ignorePendingNominee) private view returns (bool) {
        return candidate == owner() || candidate == pendingOwner() || candidate == address(this)
            || candidate == stockTokenRegistryV2 || candidate == _activeIngressAddress()
            || candidate == _pendingIngressProposal.config.ingress
            || (!ignorePendingNominee && candidate == _pendingMainOperatorNomination.nominee);
    }

    function _requirePending(bytes32 proposalId) private view returns (PendingOperatorNomination memory p) {
        p = _pendingMainOperatorNomination;
        if (p.proposalId == bytes32(0)) revert OperatorNominationMissing();
        if (proposalId != p.proposalId) revert ProposalIdMismatch(p.proposalId, proposalId);
    }

    function _requirePendingIngress(bytes32 proposalId) private view returns (PendingIngressProposal storage p) {
        p = _pendingIngressProposal;
        if (p.proposalId == bytes32(0)) revert IngressProposalMissing();
        if (proposalId != p.proposalId) revert ProposalIdMismatch(p.proposalId, proposalId);
    }

    function _validateIngressConfig(IngressConfig memory config, bool ignorePendingIngress) private view {
        if (config.ingress == address(0)) revert ZeroAddress();
        if (
            config.runtimeCodeHash == bytes32(0) || config.perDepositCapWei == 0
                || config.perDepositCapWei > config.epochDepositCapWei
                || config.epochDepositCapWei > config.lifetimeDepositCapWei
                || config.lifetimeDepositCapWei > globalLifetimeCanonicalDepositCapWei
        ) revert InvalidIngressConfig();
        _requireIngressCodeHash(config.ingress, config.runtimeCodeHash);
        if (_ingressRoleCollision(config.ingress, ignorePendingIngress, false)) {
            revert RoleIdentityCollision(config.ingress);
        }
    }

    function _requireHealthyIngress(address ingress, bytes32 expectedCodeHash, bool ignoreActiveIngress) private view {
        _requireIngressCodeHash(ingress, expectedCodeHash);
        if (_ingressRoleCollision(ingress, false, ignoreActiveIngress)) revert RoleIdentityCollision(ingress);
    }

    function _requireIngressCodeHash(address ingress, bytes32 expectedCodeHash) private view {
        if (ingress.code.length == 0) revert ContractRequired(ingress);
        bytes32 actualCodeHash = ingress.codehash;
        if (actualCodeHash != expectedCodeHash) {
            revert IngressCodeHashMismatch(ingress, expectedCodeHash, actualCodeHash);
        }
    }

    function _ingressRoleCollision(address candidate, bool ignorePendingIngress, bool ignoreActiveIngress)
        private
        view
        returns (bool)
    {
        return candidate == owner() || candidate == pendingOwner() || candidate == mainOperator
            || candidate == _pendingMainOperatorNomination.nominee || candidate == address(this)
            || candidate == stockTokenRegistryV2
            || (!ignorePendingIngress && candidate == _pendingIngressProposal.config.ingress)
            || (!ignoreActiveIngress && candidate == _activeIngressAddress());
    }

    function _activeIngressAddress() private view returns (address) {
        return _ingressRecords[activeIngressGeneration].ingress;
    }

    function _ingressConfigHash(IngressConfig memory config) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                _INGRESS_CONFIG_KIND,
                config.ingress,
                config.runtimeCodeHash,
                config.perDepositCapWei,
                config.epochDepositCapWei,
                config.lifetimeDepositCapWei
            )
        );
    }

    function _checkedTimestamp(uint256 timestamp) internal pure returns (uint64) {
        if (timestamp > type(uint64).max) revert TimestampOverflow();
        return uint64(timestamp);
    }

    function _checkedDepositTotal(DepositCapKind kind, uint256 capWei, uint256 priorWei, uint256 amountWei)
        private
        pure
        returns (uint256 attemptedTotalWei)
    {
        if (amountWei > capWei - priorWei) {
            attemptedTotalWei = priorWei + amountWei;
            revert DepositCapExceeded(uint8(kind), capWei, attemptedTotalWei);
        }
        return priorWei + amountWei;
    }

    function _accountingTotalsAtBalance(uint256 actual) private view returns (AccountingTotals memory totals) {
        uint256 shortfall = reconciliationLiabilityWei - reconciliationBackingWei;
        uint256 accounted = availableWei + unattributedWei + ordinaryReservedWei + reconciliationBackingWei;
        uint256 deficit = accounted > actual ? accounted - actual : 0;
        uint256 forced = actual > accounted ? actual - accounted : 0;
        totals = AccountingTotals({
            availableWei: availableWei,
            unattributedWei: unattributedWei,
            ordinaryReservedWei: ordinaryReservedWei,
            reconciliationLiabilityWei: reconciliationLiabilityWei,
            reconciliationBackingWei: reconciliationBackingWei,
            reconciliationShortfallWei: shortfall,
            accountedBackingWei: accounted,
            actualBalanceWei: actual,
            balanceDeficitWei: deficit,
            forcedSurplusWei: forced,
            accountingSequence: accountingSequence
        });
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

    function _nextAccountingSequence() private view returns (uint256) {
        if (accountingSequence == type(uint256).max) revert CounterExhausted(_ACCOUNTING_SEQUENCE_COUNTER);
        return accountingSequence + 1;
    }

    function _accountingMutationId(uint256 sequence, AccountingMutationKind kind, bytes32 subjectId)
        private
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(_ACCOUNTING_MUTATION_KIND, supportedChainId, address(this), sequence, uint8(kind), subjectId)
        );
    }

    function _emitAccountingComponent(
        uint256 sequence,
        bytes32 mutationId,
        uint256 componentIndex,
        AccountingComponentKind kind,
        bytes32 subjectId,
        uint256 amountWei
    ) private {
        bytes32 componentId = keccak256(
            abi.encode(
                _ACCOUNTING_COMPONENT_KIND,
                supportedChainId,
                address(this),
                mutationId,
                componentIndex,
                uint8(kind),
                subjectId,
                amountWei
            )
        );
        emit AccountingComponent(sequence, componentIndex, componentId, uint8(kind), subjectId, amountWei);
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

    function _localReadinessSatisfied() private view returns (bool) {
        if (block.chainid != supportedChainId) revert LocalReadinessFailed(uint8(LocalReadinessCondition.WRONG_CHAIN));
        if (owner().code.length == 0) revert LocalReadinessFailed(uint8(LocalReadinessCondition.OWNER_CODE_MISSING));
        if (stockTokenRegistryV2.code.length == 0) {
            revert LocalReadinessFailed(uint8(LocalReadinessCondition.REGISTRY_CODE_MISSING));
        }
        address o = owner();
        address po = pendingOwner();
        address m = mainOperator;
        address n = _pendingMainOperatorNomination.nominee;
        address activeIngress = _activeIngressAddress();
        address pendingIngress = _pendingIngressProposal.config.ingress;
        if (
            o == address(this) || o == stockTokenRegistryV2
                || (po != address(0) && (po == o || po == address(this) || po == stockTokenRegistryV2))
                || (m != address(0) && (m == o || m == po || m == address(this) || m == stockTokenRegistryV2))
                || (n != address(0) && (n == o || n == po || n == m || n == address(this) || n == stockTokenRegistryV2))
                || (activeIngress != address(0) && _ingressRoleCollision(activeIngress, true, true))
                || (pendingIngress != address(0) && _ingressRoleCollision(pendingIngress, true, true))
                || (activeIngress != address(0) && activeIngress == pendingIngress)
        ) revert LocalReadinessFailed(uint8(LocalReadinessCondition.ROLE_COLLISION));
        AccountingTotals memory totals = accountingTotals();
        if (totals.balanceDeficitWei != 0) {
            revert LocalReadinessFailed(uint8(LocalReadinessCondition.BALANCE_DEFICIT));
        }
        if (totals.reconciliationShortfallWei != 0) {
            revert LocalReadinessFailed(uint8(LocalReadinessCondition.RECONCILIATION_SHORTFALL));
        }
        uint256 generation = activeIngressGeneration;
        if (generation == 0) {
            revert LocalReadinessFailed(uint8(LocalReadinessCondition.ACTIVE_INGRESS_MISSING));
        }
        IngressRecord storage ingress = _ingressRecords[generation];
        if (ingress.ingress.code.length == 0) {
            revert LocalReadinessFailed(uint8(LocalReadinessCondition.INGRESS_CODE_MISSING));
        }
        if (ingress.ingress.codehash != ingress.runtimeCodeHash) {
            revert LocalReadinessFailed(uint8(LocalReadinessCondition.INGRESS_CODE_HASH_MISMATCH));
        }
        if (_pendingIngressProposal.proposalId != bytes32(0)) {
            revert LocalReadinessFailed(uint8(LocalReadinessCondition.INGRESS_PROPOSAL_PENDING));
        }
        return true;
    }
}
