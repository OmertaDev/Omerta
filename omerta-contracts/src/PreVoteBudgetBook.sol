// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract PreVoteBudgetBook {
    struct PreVoteBudgetInput {
        uint256 ballotDay;
        uint256 maxEthWei;
        uint64 purchaseUntil;
    }

    struct PreVoteBudgetAuthorization {
        bytes32 budgetId;
        uint256 ballotDay;
        uint256 maxEthWei;
        uint64 purchaseUntil;
        uint256 availableAtAuthorizationWei;
        uint256 accountingSequence;
        uint64 authorizedAt;
        bytes32 detailsHash;
    }

    struct BudgetAccounting {
        uint256 availableWei;
        uint256 shortfallWei;
        uint256 deficitWei;
        uint256 sequence;
    }

    error BudgetBookFactoryZero();
    error BudgetBookManifestHashZero();
    error BudgetBookFinalizerUnauthorized(address caller);
    error BudgetBookManifestHashMismatch(bytes32 expected, bytes32 actual);
    error BudgetBookAlreadyFinalized();
    error BudgetBookNotFinalized();
    error BudgetBookZeroAddress();
    error BudgetBookContractRequired(address account);
    error BudgetBookAddressMismatch(address expected, address actual);
    error BudgetBookPeerMismatch(uint8 peer, address expected, address actual);
    error BudgetBookAuthoritySnapshotCallFailed();
    error BudgetBookAuthoritySnapshotReturnLength(uint256 actualLength);
    error BudgetBookAuthoritySnapshotSemanticMismatch(uint8 field);
    error BudgetBookCoreAccountingCallFailed();
    error BudgetBookCoreAccountingReturnLength(uint256 actualLength);
    error BudgetBookCoreAccountingSemanticMismatch(uint8 field);
    error BudgetBookUnauthorized(address caller);
    error BudgetBookPaused();
    error BudgetBookEmptyDetailsHash();
    error BudgetBookInvalidAmount();
    error BudgetBookTimestampOverflow();
    error BudgetBookBalanceDeficitActive(uint256 deficitWei);
    error BudgetBookReconciliationShortfallActive(uint256 shortfallWei);
    error BudgetDayClosed(uint256 ballotDay);
    error BudgetDeadlineOverflow();
    error InvalidPurchaseUntil(uint64 expected, uint64 supplied);
    error BudgetAlreadyAuthorized(uint256 ballotDay);
    error InsufficientAvailable(uint256 availableWei, uint256 requestedWei);
    error BudgetNotFound(uint256 ballotDay);

    event BudgetBookFinalized(bytes32 indexed manifestHash);
    event PreVoteBudgetAuthorized(
        bytes32 indexed budgetId,
        uint256 indexed ballotDay,
        uint256 maxEthWei,
        uint64 purchaseUntil,
        uint256 availableAtAuthorizationWei,
        uint256 accountingSequence,
        uint64 authorizedAt,
        uint8 reasonCode,
        bytes32 detailsHash
    );

    uint256 private constant _CHAIN = 4663;
    bytes32 private constant _BUDGET = keccak256("OMERTA_ACQUISITION_BUDGET_AUTHORIZATION_V2");
    address private immutable _factory;
    bytes32 private immutable _manifestHash;
    address private immutable _authority;
    address private immutable _core;
    address private immutable _registry;
    bool private _finalized;
    mapping(uint256 ballotDay => PreVoteBudgetAuthorization) private _preVoteBudgets;

    constructor(address factory, bytes32 manifestHash, address authority, address core, address registry) {
        if (factory == address(0)) revert BudgetBookFactoryZero();
        if (manifestHash == 0) revert BudgetBookManifestHashZero();
        if (authority == address(0)) revert BudgetBookZeroAddress();
        if (core == address(0)) revert BudgetBookZeroAddress();
        if (registry == address(0)) revert BudgetBookZeroAddress();
        if (registry.code.length == 0) revert BudgetBookContractRequired(registry);
        address expected = _predict(factory, 3);
        if (address(this) != expected) revert BudgetBookAddressMismatch(expected, address(this));
        expected = _predict(factory, 1);
        if (authority != expected) revert BudgetBookPeerMismatch(0, expected, authority);
        expected = _predict(factory, 2);
        if (core != expected) revert BudgetBookPeerMismatch(1, expected, core);
        if (authority.code.length == 0) revert BudgetBookContractRequired(authority);
        if (core.code.length == 0) revert BudgetBookContractRequired(core);
        _factory = factory;
        _manifestHash = manifestHash;
        _authority = authority;
        _core = core;
        _registry = registry;
    }

    function budgetBookTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
        return (_factory, _manifestHash, _finalized);
    }

    function finalizeBudgetBook(bytes32 manifestHash) external {
        if (msg.sender != _factory) revert BudgetBookFinalizerUnauthorized(msg.sender);
        if (manifestHash != _manifestHash) revert BudgetBookManifestHashMismatch(_manifestHash, manifestHash);
        if (_finalized) revert BudgetBookAlreadyFinalized();
        _finalized = true;
        emit BudgetBookFinalized(_manifestHash);
    }

    function authorizePreVoteBudget(PreVoteBudgetInput calldata input, bytes32 detailsHash)
        external
        returns (bytes32 budgetId)
    {
        if (!_finalized) revert BudgetBookNotFinalized();
        if (_preVoteBudgets[input.ballotDay].budgetId != 0) revert BudgetAlreadyAuthorized(input.ballotDay);
        (address safe, bool paused) = _authorityState();
        if (msg.sender != safe) revert BudgetBookUnauthorized(msg.sender);
        if (paused) revert BudgetBookPaused();
        if (detailsHash == 0) revert BudgetBookEmptyDetailsHash();
        if (input.maxEthWei == 0) revert BudgetBookInvalidAmount();
        if (block.timestamp > type(uint64).max) revert BudgetBookTimestampOverflow();
        uint64 expected = _deadline(input.ballotDay);
        if (input.ballotDay < block.timestamp / 1 days) revert BudgetDayClosed(input.ballotDay);
        if (input.purchaseUntil != expected) revert InvalidPurchaseUntil(expected, input.purchaseUntil);
        BudgetAccounting memory totals = _accounting();
        if (totals.deficitWei != 0) revert BudgetBookBalanceDeficitActive(totals.deficitWei);
        if (totals.shortfallWei != 0) revert BudgetBookReconciliationShortfallActive(totals.shortfallWei);
        if (input.maxEthWei > totals.availableWei) revert InsufficientAvailable(totals.availableWei, input.maxEthWei);
        budgetId = keccak256(
            abi.encode(
                _BUDGET,
                uint256(_CHAIN),
                _core,
                address(this),
                _registry,
                input.ballotDay,
                input.maxEthWei,
                input.purchaseUntil,
                totals.sequence
            )
        );
        PreVoteBudgetAuthorization memory authorization = PreVoteBudgetAuthorization(
            budgetId,
            input.ballotDay,
            input.maxEthWei,
            input.purchaseUntil,
            totals.availableWei,
            totals.sequence,
            uint64(block.timestamp),
            detailsHash
        );
        _commit(authorization);
    }

    function getPreVoteBudget(uint256 ballotDay)
        external
        view
        returns (PreVoteBudgetAuthorization memory authorization)
    {
        authorization = _preVoteBudgets[ballotDay];
        if (authorization.budgetId == 0) revert BudgetNotFound(ballotDay);
    }

    function _authorityState() private view returns (address safe, bool paused) {
        uint256[27] memory w;
        bool ok;
        uint256 size;
        address target = _authority;
        bytes4 selector = bytes4(keccak256("authoritySnapshot()"));
        assembly ("memory-safe") {
            mstore(0, selector)
            ok := staticcall(160000, target, 0, 4, w, 864)
            size := returndatasize()
        }
        if (!ok) revert BudgetBookAuthoritySnapshotCallFailed();
        if (size != 864) revert BudgetBookAuthoritySnapshotReturnLength(size);
        if (w[0] != 2) revert BudgetBookAuthoritySnapshotSemanticMismatch(0);
        if (w[1] != uint160(_factory)) revert BudgetBookAuthoritySnapshotSemanticMismatch(1);
        if (w[2] != uint256(_manifestHash)) revert BudgetBookAuthoritySnapshotSemanticMismatch(2);
        if (w[3] != uint160(_registry)) revert BudgetBookAuthoritySnapshotSemanticMismatch(3);
        if (w[4] != uint160(_core)) revert BudgetBookAuthoritySnapshotSemanticMismatch(4);
        if (w[5] != uint160(address(this))) revert BudgetBookAuthoritySnapshotSemanticMismatch(5);
        if (w[6] != uint160(_predict(_factory, 4))) revert BudgetBookAuthoritySnapshotSemanticMismatch(6);
        if (w[7] != uint160(_predict(_factory, 5))) revert BudgetBookAuthoritySnapshotSemanticMismatch(7);
        if (w[8] != 1) revert BudgetBookAuthoritySnapshotSemanticMismatch(8);
        _clean(w[9], 9);
        safe = address(uint160(w[9]));
        if (safe == address(0) || safe.code.length == 0) revert BudgetBookAuthoritySnapshotSemanticMismatch(9);
        _clean(w[10], 10);
        address pendingSafe = address(uint160(w[10]));
        if (pendingSafe != address(0) && pendingSafe.code.length == 0) {
            revert BudgetBookAuthoritySnapshotSemanticMismatch(10);
        }
        if (w[11] > 1) revert BudgetBookAuthoritySnapshotSemanticMismatch(11);
        _clean(w[12], 12);
        _clean(w[13], 13);
        _clean(w[19], 19);
        address ingress = address(uint160(w[19]));
        if (w[18] == 0) {
            if (ingress != address(0)) revert BudgetBookAuthoritySnapshotSemanticMismatch(19);
            if (w[20] != 0) revert BudgetBookAuthoritySnapshotSemanticMismatch(20);
        } else {
            if (ingress == address(0) || ingress.code.length == 0) {
                revert BudgetBookAuthoritySnapshotSemanticMismatch(19);
            }
            if (w[20] == 0) revert BudgetBookAuthoritySnapshotSemanticMismatch(20);
        }
        _clean(w[21], 21);
        address pendingIngress = address(uint160(w[21]));
        if (pendingIngress != address(0) && pendingIngress.code.length == 0) {
            revert BudgetBookAuthoritySnapshotSemanticMismatch(21);
        }
        paused = w[11] == 1;
    }

    function _accounting() private view returns (BudgetAccounting memory totals) {
        uint256[11] memory w;
        bool ok;
        uint256 size;
        address target = _core;
        bytes4 selector = bytes4(keccak256("accountingTotals()"));
        assembly ("memory-safe") {
            mstore(0, selector)
            ok := staticcall(100000, target, 0, 4, w, 352)
            size := returndatasize()
        }
        if (!ok) revert BudgetBookCoreAccountingCallFailed();
        if (size != 352) revert BudgetBookCoreAccountingReturnLength(size);
        if (w[4] > w[3]) revert BudgetBookCoreAccountingSemanticMismatch(4);
        if (w[5] != w[3] - w[4]) revert BudgetBookCoreAccountingSemanticMismatch(5);
        uint256 backing = w[0];
        if (w[1] > type(uint256).max - backing) revert BudgetBookCoreAccountingSemanticMismatch(6);
        backing += w[1];
        if (w[2] > type(uint256).max - backing) revert BudgetBookCoreAccountingSemanticMismatch(6);
        backing += w[2];
        if (w[4] > type(uint256).max - backing) revert BudgetBookCoreAccountingSemanticMismatch(6);
        backing += w[4];
        if (w[6] != backing) revert BudgetBookCoreAccountingSemanticMismatch(6);
        if (w[7] != target.balance) revert BudgetBookCoreAccountingSemanticMismatch(7);
        uint256 deficit = backing > w[7] ? backing - w[7] : 0;
        if (w[8] != deficit) revert BudgetBookCoreAccountingSemanticMismatch(8);
        uint256 surplus = w[7] > backing ? w[7] - backing : 0;
        if (w[9] != surplus) revert BudgetBookCoreAccountingSemanticMismatch(9);
        totals = BudgetAccounting(w[0], w[5], w[8], w[10]);
    }

    function _deadline(uint256 ballotDay) private pure returns (uint64 expected) {
        if (ballotDay == type(uint256).max) revert BudgetDeadlineOverflow();
        uint256 nextDay = ballotDay + 1;
        if (nextDay > (type(uint256).max - 2 hours) / 1 days) revert BudgetDeadlineOverflow();
        uint256 value = nextDay * 1 days + 2 hours;
        if (value > type(uint64).max) revert BudgetDeadlineOverflow();
        expected = uint64(value);
    }

    function _commit(PreVoteBudgetAuthorization memory a) private {
        _preVoteBudgets[a.ballotDay] = a;
        emit PreVoteBudgetAuthorized(
            a.budgetId,
            a.ballotDay,
            a.maxEthWei,
            a.purchaseUntil,
            a.availableAtAuthorizationWei,
            a.accountingSequence,
            a.authorizedAt,
            19,
            a.detailsHash
        );
    }

    function _clean(uint256 word, uint8 field) private pure {
        if (word >> 160 != 0) revert BudgetBookAuthoritySnapshotSemanticMismatch(field);
    }

    function _predict(address deployer, uint8 nonce) private pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", deployer, nonce)))));
    }
}
