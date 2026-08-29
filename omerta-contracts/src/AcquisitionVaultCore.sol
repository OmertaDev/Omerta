// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AcquisitionVaultCore is ReentrancyGuard {
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

    struct AuthoritySnapshot {
        address safe;
        address pendingSafe;
        bool paused;
        address operator;
        address pendingOperator;
        uint256 generation;
        address ingress;
        bytes32 configHash;
        address pendingIngress;
    }

    struct IngressRecord {
        uint256 generation;
        address ingress;
        bytes32 codeHash;
        uint256 perCap;
        uint256 epochCap;
        uint256 lifetimeCap;
    }

    error CoreFactoryZero();
    error CoreManifestHashZero();
    error CoreFinalizerUnauthorized(address caller);
    error CoreManifestHashMismatch(bytes32 expected, bytes32 actual);
    error CoreAlreadyFinalized();
    error CoreNotFinalized();
    error CoreInitialStateMismatch(uint8 field);
    error CoreAddressMismatch(address expected, address actual);
    error CorePeerMismatch(uint8 index, address expected, address actual);
    error CoreAuthoritySnapshotCallFailed();
    error CoreAuthoritySnapshotReturnLength(uint256 actualLength);
    error CoreAuthoritySnapshotSemanticMismatch(uint8 field);
    error CoreIngressCallFailed(uint256 generation);
    error CoreIngressReturnLength(uint256 generation, uint256 actualLength);
    error CoreIngressSemanticMismatch(uint8 field);
    error InvalidGlobalLifetimeCap();
    error NoBalanceDelta();
    error InvalidAmount();
    error InsufficientUnattributed(uint256 availableWei, uint256 requestedWei);
    error BalanceDeficitActive(uint256 deficitWei);
    error ReconciliationShortfallActive(uint256 shortfallWei);
    error NotActiveIngress(address caller);
    error DepositSourceRequired();
    error DepositReplay(bytes32 depositId);
    error DepositCapExceeded(uint8 capKind, uint256 capWei, uint256 attemptedTotalWei);
    error DepositNotFound(bytes32 depositId);
    error CoreZeroAddress();
    error CoreContractRequired(address target);
    error CoreRoleIdentityCollision(address candidate);
    error CoreEmptyDetailsHash();
    error CoreCounterExhausted(bytes32 counterName);
    error CoreTimestampOverflow();
    error CoreNoActiveIngress();
    error CoreIngressCodeHashMismatch(address ingress, bytes32 expected, bytes32 actual);
    error CoreUnauthorized(address caller);

    event CoreFinalized(bytes32 indexed manifestHash);
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

    uint256 public constant MAX_ACTIVE_ORDINARY_RESERVATIONS = 32;
    uint256 public constant MAX_ACTIVE_RECONCILIATIONS = 32;
    uint256 public constant MAX_OPERATOR_OUTFLOW_COMPONENTS = 67;
    uint256 private constant _CHAIN = 4663;
    bytes32 private constant _MUT = keccak256("OMERTA_ACQUISITION_ACCOUNTING_MUTATION_V2");
    bytes32 private constant _COMP = keccak256("OMERTA_ACQUISITION_ACCOUNTING_COMPONENT_V2");
    bytes32 private constant _DEP = keccak256("OMERTA_ACQUISITION_DEPOSIT_V2");
    bytes32 private constant _CFG = keccak256("OMERTA_AUTH_INGRESS_CONFIG_V2");
    bytes32 private constant _SEQ = keccak256("accountingSequence");
    address private immutable _factory;
    bytes32 private immutable _manifestHash;
    address private immutable _authority;
    address private immutable _registry;
    address private immutable _budgetBook;
    address private immutable _intentExecution;
    address private immutable _reconciliation;
    uint256 private immutable _globalCap;
    bool private _finalized;
    uint256 public availableWei;
    uint256 public unattributedWei;
    uint256 public ordinaryReservedWei;
    uint256 public reconciliationLiabilityWei;
    uint256 public reconciliationBackingWei;
    uint256 public accountingSequence;
    uint256 public lastObservedBalanceDeficitWei;
    uint256 public globalLifetimeCanonicalDepositedWei;
    mapping(uint256 generation => uint256) public ingressLifetimeDepositedWei;
    mapping(uint256 generation => mapping(uint256 epochDay => uint256)) public ingressEpochDepositedWei;
    mapping(bytes32 => DepositRecord) private _depositRecords;
    modifier finalizedState() {
        if (!_finalized) revert CoreNotFinalized();
        _;
    }

    constructor(
        address factory,
        bytes32 manifestHash,
        address authority,
        address registry,
        address budgetBook,
        address intentExecution,
        address reconciliation,
        uint256 globalLifetimeCanonicalDepositCapWei
    ) {
        if (factory == address(0)) revert CoreFactoryZero();
        if (manifestHash == 0) revert CoreManifestHashZero();
        if (
            authority == address(0) || registry == address(0) || budgetBook == address(0)
                || intentExecution == address(0) || reconciliation == address(0)
        ) revert CoreZeroAddress();
        if (registry.code.length == 0) revert CoreContractRequired(registry);
        address e = _predict(factory, 2);
        if (address(this) != e) revert CoreAddressMismatch(e, address(this));
        e = _predict(factory, 1);
        if (authority != e) revert CorePeerMismatch(0, e, authority);
        e = _predict(factory, 3);
        if (budgetBook != e) revert CorePeerMismatch(2, e, budgetBook);
        e = _predict(factory, 4);
        if (intentExecution != e) revert CorePeerMismatch(3, e, intentExecution);
        e = _predict(factory, 5);
        if (reconciliation != e) revert CorePeerMismatch(4, e, reconciliation);
        if (authority.code.length == 0) revert CoreContractRequired(authority);
        if (globalLifetimeCanonicalDepositCapWei == 0) revert InvalidGlobalLifetimeCap();
        _factory = factory;
        _manifestHash = manifestHash;
        _authority = authority;
        _registry = registry;
        _budgetBook = budgetBook;
        _intentExecution = intentExecution;
        _reconciliation = reconciliation;
        _globalCap = globalLifetimeCanonicalDepositCapWei;
    }

    function stockTokenRegistryV2() external view returns (address) {
        return _registry;
    }

    function globalLifetimeCanonicalDepositCapWei() external view returns (uint256) {
        return _globalCap;
    }

    function accountingTotals() external view returns (AccountingTotals memory totals) {
        return _totals(address(this).balance);
    }

    function getDeposit(bytes32 depositId) external view returns (DepositRecord memory record) {
        record = _depositRecords[depositId];
        if (record.depositId == 0) revert DepositNotFound(depositId);
    }

    function syncBalance() external finalizedState nonReentrant returns (bytes32 mutationId) {
        AccountingTotals memory pre = _totals(address(this).balance);
        bool changed = pre.balanceDeficitWei != lastObservedBalanceDeficitWei;
        if (pre.forcedSurplusWei == 0 && !changed) revert NoBalanceDelta();
        uint256 seq = _next();
        if (pre.forcedSurplusWei != 0) unattributedWei += pre.forcedSurplusWei;
        AccountingTotals memory post = _totals(address(this).balance);
        lastObservedBalanceDeficitWei = post.balanceDeficitWei;
        bytes32 subject = keccak256(abi.encode(pre, post));
        mutationId = _mid(0, seq, 1, subject);
        emit AccountingMutation(seq, mutationId, 1, pre, post, (pre.forcedSurplusWei == 0 ? 0 : 1) + (changed ? 1 : 0));
        uint256 i;
        if (pre.forcedSurplusWei != 0) _component(0, seq, mutationId, i++, 1, subject, pre.forcedSurplusWei);
        if (changed) _component(0, seq, mutationId, i, 2, subject, post.balanceDeficitWei);
    }

    function reclassifyUnattributed(uint256 amountWei, bytes32 detailsHash)
        external
        finalizedState
        nonReentrant
        returns (bytes32 mutationId)
    {
        AuthoritySnapshot memory s = _snapshot();
        if (msg.sender != s.safe) revert CoreUnauthorized(msg.sender);
        if (detailsHash == 0) revert CoreEmptyDetailsHash();
        if (amountWei == 0) revert InvalidAmount();
        AccountingTotals memory pre = _totals(address(this).balance);
        if (pre.balanceDeficitWei != 0) revert BalanceDeficitActive(pre.balanceDeficitWei);
        if (pre.reconciliationShortfallWei != 0) revert ReconciliationShortfallActive(pre.reconciliationShortfallWei);
        if (amountWei > unattributedWei) revert InsufficientUnattributed(unattributedWei, amountWei);
        uint256 seq = _next();
        unattributedWei -= amountWei;
        availableWei += amountWei;
        AccountingTotals memory post = _totals(address(this).balance);
        lastObservedBalanceDeficitWei = post.balanceDeficitWei;
        mutationId = _mid(0, seq, 2, detailsHash);
        emit AccountingMutation(seq, mutationId, 2, pre, post, 1);
        _component(0, seq, mutationId, 0, 3, detailsHash, amountWei);
        emit UnattributedReclassified(mutationId, seq, msg.sender, amountWei, 18, detailsHash);
    }

    function depositCanonical(bytes32 sourceEventId)
        external
        payable
        finalizedState
        nonReentrant
        returns (bytes32 depositId)
    {
        AuthoritySnapshot memory s = _snapshot();
        if (s.generation == 0) revert CoreNoActiveIngress();
        IngressRecord memory r = _ingress(s.generation, s.ingress, s.configHash);
        if (msg.sender != r.ingress) revert NotActiveIngress(msg.sender);
        if (r.ingress.code.length == 0) revert CoreContractRequired(r.ingress);
        bytes32 actual = r.ingress.codehash;
        if (actual != r.codeHash) revert CoreIngressCodeHashMismatch(r.ingress, r.codeHash, actual);
        _collision(r.ingress, s);
        if (sourceEventId == 0) revert DepositSourceRequired();
        if (msg.value == 0) revert InvalidAmount();
        if (block.timestamp > type(uint64).max) revert CoreTimestampOverflow();
        depositId = keccak256(
            abi.encode(
                _DEP,
                _CHAIN,
                address(this),
                address(this),
                r.generation,
                sourceEventId,
                _authority,
                r.ingress,
                s.configHash
            )
        );
        if (_depositRecords[depositId].depositId != 0) revert DepositReplay(depositId);
        uint256 day = block.timestamp / 1 days;
        _cap(1, r.perCap, 0, msg.value);
        uint256 pe = ingressEpochDepositedWei[r.generation][day];
        _cap(2, r.epochCap, pe, msg.value);
        uint256 pl = ingressLifetimeDepositedWei[r.generation];
        _cap(3, r.lifetimeCap, pl, msg.value);
        _cap(4, _globalCap, globalLifetimeCanonicalDepositedWei, msg.value);
        if (accountingSequence == type(uint256).max) revert CoreCounterExhausted(_SEQ);
        uint256 seq = accountingSequence + 1;
        AccountingTotals memory pre = _totals(address(this).balance - msg.value);
        uint256 repair = msg.value < pre.balanceDeficitWei ? msg.value : pre.balanceDeficitWei;
        uint256 credit = msg.value - repair;
        uint256 newAvailable = availableWei + credit;
        uint256 newEpoch = pe + msg.value;
        uint256 newLifetime = pl + msg.value;
        uint256 newGlobal = globalLifetimeCanonicalDepositedWei + msg.value;
        DepositRecord memory record = DepositRecord(
            depositId,
            r.generation,
            r.ingress,
            sourceEventId,
            msg.value,
            repair,
            credit,
            day,
            seq,
            uint64(block.timestamp)
        );
        availableWei = newAvailable;
        accountingSequence = seq;
        ingressEpochDepositedWei[r.generation][day] = newEpoch;
        ingressLifetimeDepositedWei[r.generation] = newLifetime;
        globalLifetimeCanonicalDepositedWei = newGlobal;
        _depositRecords[depositId] = record;
        AccountingTotals memory post = _totals(address(this).balance);
        lastObservedBalanceDeficitWei = post.balanceDeficitWei;
        bytes32 mutationId = _mid(r.generation, seq, 3, depositId);
        emit AccountingMutation(seq, mutationId, 3, pre, post, (repair == 0 ? 0 : 1) + (credit == 0 ? 0 : 1));
        uint256 i;
        if (repair != 0) _component(r.generation, seq, mutationId, i++, 4, depositId, repair);
        if (credit != 0) _component(r.generation, seq, mutationId, i, 5, depositId, credit);
        emit CanonicalDeposit(
            depositId,
            r.generation,
            sourceEventId,
            r.ingress,
            msg.value,
            repair,
            credit,
            day,
            seq,
            uint64(block.timestamp)
        );
    }

    function coreTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
        return (_factory, _manifestHash, _finalized);
    }

    function coreSnapshot()
        external
        view
        returns (
            uint256 schemaVersion,
            address factory,
            bytes32 manifestHash,
            address authority,
            address registry,
            address budgetBook,
            address intentExecution,
            address reconciliation,
            bool finalized,
            uint256 globalLifetimeCanonicalDepositCapWei,
            uint256 availableWei,
            uint256 unattributedWei,
            uint256 ordinaryReservedWei,
            uint256 reconciliationLiabilityWei,
            uint256 reconciliationBackingWei,
            uint256 accountingSequence,
            uint256 lastObservedBalanceDeficitWei,
            uint256 globalLifetimeCanonicalDepositedWei
        )
    {
        uint256[18] memory w = _coreSnapshotWords();
        assembly ("memory-safe") { return(w, 576) }
    }

    function _coreSnapshotWords() private view returns (uint256[18] memory w) {
        w[0] = 3;
        w[1] = uint160(_factory);
        w[2] = uint256(_manifestHash);
        w[3] = uint160(_authority);
        w[4] = uint160(_registry);
        w[5] = uint160(_budgetBook);
        w[6] = uint160(_intentExecution);
        w[7] = uint160(_reconciliation);
        w[8] = _finalized ? 1 : 0;
        w[9] = _globalCap;
        w[10] = availableWei;
        w[11] = unattributedWei;
        w[12] = ordinaryReservedWei;
        w[13] = reconciliationLiabilityWei;
        w[14] = reconciliationBackingWei;
        w[15] = accountingSequence;
        w[16] = lastObservedBalanceDeficitWei;
        w[17] = globalLifetimeCanonicalDepositedWei;
    }

    function finalizeCore(bytes32 manifestHash) external {
        if (msg.sender != _factory) revert CoreFinalizerUnauthorized(msg.sender);
        if (manifestHash != _manifestHash) revert CoreManifestHashMismatch(_manifestHash, manifestHash);
        if (_finalized) revert CoreAlreadyFinalized();
        if (availableWei != 0) revert CoreInitialStateMismatch(10);
        if (unattributedWei != 0) revert CoreInitialStateMismatch(11);
        if (ordinaryReservedWei != 0) revert CoreInitialStateMismatch(12);
        if (reconciliationLiabilityWei != 0) revert CoreInitialStateMismatch(13);
        if (reconciliationBackingWei != 0) revert CoreInitialStateMismatch(14);
        if (accountingSequence != 0) revert CoreInitialStateMismatch(15);
        if (lastObservedBalanceDeficitWei != 0) revert CoreInitialStateMismatch(16);
        if (globalLifetimeCanonicalDepositedWei != 0) revert CoreInitialStateMismatch(17);
        _finalized = true;
        emit CoreFinalized(_manifestHash);
    }

    function _totals(uint256 v) private view returns (AccountingTotals memory t) {
        t.availableWei = availableWei;
        t.unattributedWei = unattributedWei;
        t.ordinaryReservedWei = ordinaryReservedWei;
        t.reconciliationLiabilityWei = reconciliationLiabilityWei;
        t.reconciliationBackingWei = reconciliationBackingWei;
        t.reconciliationShortfallWei = reconciliationLiabilityWei - reconciliationBackingWei;
        t.accountedBackingWei = availableWei + unattributedWei + ordinaryReservedWei + reconciliationBackingWei;
        t.actualBalanceWei = v;
        if (t.accountedBackingWei > v) t.balanceDeficitWei = t.accountedBackingWei - v;
        else t.forcedSurplusWei = v - t.accountedBackingWei;
        t.accountingSequence = accountingSequence;
    }

    function _next() private returns (uint256 n) {
        if (accountingSequence == type(uint256).max) revert CoreCounterExhausted(_SEQ);
        n = accountingSequence + 1;
        accountingSequence = n;
    }

    function _mid(uint256 g, uint256 s, uint8 k, bytes32 subject) private view returns (bytes32) {
        return keccak256(abi.encode(_MUT, _CHAIN, address(this), address(this), g, s, k, subject));
    }

    function _component(uint256 g, uint256 s, bytes32 m, uint256 i, uint8 k, bytes32 subject, uint256 amount) private {
        bytes32 id = keccak256(abi.encode(_COMP, _CHAIN, address(this), address(this), g, s, m, i, k, subject, amount));
        emit AccountingComponent(s, i, id, k, subject, amount);
    }

    function _cap(uint8 k, uint256 cap, uint256 prior, uint256 amount) private pure {
        if (amount > cap - prior) revert DepositCapExceeded(k, cap, prior + amount);
    }

    function _snapshot() private view returns (AuthoritySnapshot memory s) {
        uint256[27] memory w;
        bool ok;
        uint256 size;
        address target = _authority;
        bytes4 sel = bytes4(keccak256("authoritySnapshot()"));
        assembly ("memory-safe") {
            mstore(0, sel)
            ok := staticcall(160000, target, 0, 4, w, 864)
            size := returndatasize()
        }
        if (!ok) revert CoreAuthoritySnapshotCallFailed();
        if (size != 864) revert CoreAuthoritySnapshotReturnLength(size);
        if (w[0] != 2) revert CoreAuthoritySnapshotSemanticMismatch(0);
        if (w[1] != uint160(_factory)) revert CoreAuthoritySnapshotSemanticMismatch(1);
        if (w[2] != uint256(_manifestHash)) revert CoreAuthoritySnapshotSemanticMismatch(2);
        if (w[3] != uint160(_registry)) revert CoreAuthoritySnapshotSemanticMismatch(3);
        if (w[4] != uint160(address(this))) revert CoreAuthoritySnapshotSemanticMismatch(4);
        if (w[5] != uint160(_budgetBook)) revert CoreAuthoritySnapshotSemanticMismatch(5);
        if (w[6] != uint160(_intentExecution)) revert CoreAuthoritySnapshotSemanticMismatch(6);
        if (w[7] != uint160(_reconciliation)) revert CoreAuthoritySnapshotSemanticMismatch(7);
        if (w[8] != 1) revert CoreAuthoritySnapshotSemanticMismatch(8);
        _clean(w[9], 9);
        if (w[9] == 0) revert CoreAuthoritySnapshotSemanticMismatch(9);
        _clean(w[10], 10);
        if (w[11] > 1) revert CoreAuthoritySnapshotSemanticMismatch(11);
        _clean(w[12], 12);
        _clean(w[13], 13);
        _clean(w[19], 19);
        if (w[18] == 0) {
            if (w[19] != 0) revert CoreAuthoritySnapshotSemanticMismatch(19);
            if (w[20] != 0) revert CoreAuthoritySnapshotSemanticMismatch(20);
        } else {
            if (w[19] == 0) revert CoreAuthoritySnapshotSemanticMismatch(19);
            if (w[20] == 0) revert CoreAuthoritySnapshotSemanticMismatch(20);
        }
        _clean(w[21], 21);
        s = AuthoritySnapshot(
            address(uint160(w[9])),
            address(uint160(w[10])),
            w[11] == 1,
            address(uint160(w[12])),
            address(uint160(w[13])),
            w[18],
            address(uint160(w[19])),
            bytes32(w[20]),
            address(uint160(w[21]))
        );
    }

    function _ingress(uint256 g, address active, bytes32 cfg) private view returns (IngressRecord memory r) {
        uint256[8] memory w;
        bool ok;
        uint256 size;
        address target = _authority;
        bytes4 sel = bytes4(keccak256("getIngress(uint256)"));
        assembly ("memory-safe") {
            mstore(0, sel)
            mstore(4, g)
            ok := staticcall(100000, target, 0, 36, w, 256)
            size := returndatasize()
        }
        if (!ok) revert CoreIngressCallFailed(g);
        if (size != 256) revert CoreIngressReturnLength(g, size);
        if (w[0] != g) revert CoreIngressSemanticMismatch(0);
        if (w[1] >> 160 != 0 || address(uint160(w[1])) != active) revert CoreIngressSemanticMismatch(1);
        if (w[2] == 0) revert CoreIngressSemanticMismatch(2);
        if (w[3] == 0) revert CoreIngressSemanticMismatch(3);
        if (w[4] < w[3]) revert CoreIngressSemanticMismatch(4);
        if (w[5] < w[4] || w[5] > _globalCap) revert CoreIngressSemanticMismatch(5);
        if (w[6] > type(uint64).max) revert CoreIngressSemanticMismatch(6);
        if (w[7] > type(uint64).max || w[7] != 0) revert CoreIngressSemanticMismatch(7);
        bytes32 h = keccak256(
            abi.encode(_CFG, _CHAIN, address(this), _authority, address(uint160(w[1])), bytes32(w[2]), w[3], w[4], w[5])
        );
        if (h != cfg) revert CoreIngressSemanticMismatch(8);
        r = IngressRecord(g, address(uint160(w[1])), bytes32(w[2]), w[3], w[4], w[5]);
    }

    function _clean(uint256 w, uint8 f) private pure {
        if (w >> 160 != 0) revert CoreAuthoritySnapshotSemanticMismatch(f);
    }

    function _collision(address c, AuthoritySnapshot memory s) private view {
        if (
            c == _authority || c == _factory || c == address(this) || c == _registry || c == _budgetBook
                || c == _intentExecution || c == _reconciliation || c == s.safe || c == s.pendingSafe || c == s.operator
                || c == s.pendingOperator || c == s.pendingIngress
        ) revert CoreRoleIdentityCollision(c);
    }

    function _predict(address d, uint8 n) private pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", d, n)))));
    }
}
