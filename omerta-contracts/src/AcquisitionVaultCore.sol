// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract AcquisitionVaultCore {
    error CoreFactoryZero();
    error CoreManifestHashZero();
    error CoreZeroAddress();
    error CoreContractRequired(address target);
    error CoreAddressMismatch(address expected, address actual);
    error CorePeerMismatch(uint8 index, address expected, address actual);
    error InvalidGlobalLifetimeCap();
    error CoreFinalizerUnauthorized(address caller);
    error CoreManifestHashMismatch(bytes32 expected, bytes32 actual);
    error CoreAlreadyFinalized();
    error CoreInitialStateMismatch(uint8 field);

    event CoreFinalized(bytes32 indexed manifestHash);

    address private immutable _factory;
    bytes32 private immutable _manifestHash;
    address private immutable _authority;
    address private immutable _registry;
    address private immutable _budgetBook;
    address private immutable _intentExecution;
    address private immutable _reconciliation;
    uint256 private immutable _globalLifetimeCanonicalDepositCapWei;

    bool private _finalized;
    uint256 private availableWei;
    uint256 private unattributedWei;
    uint256 private ordinaryReservedWei;
    uint256 private reconciliationLiabilityWei;
    uint256 private reconciliationBackingWei;
    uint256 private accountingSequence;
    uint256 private lastObservedBalanceDeficitWei;
    uint256 private globalLifetimeCanonicalDepositedWei;

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
        if (manifestHash == bytes32(0)) revert CoreManifestHashZero();
        if (
            authority == address(0) || registry == address(0) || budgetBook == address(0)
                || intentExecution == address(0) || reconciliation == address(0)
        ) revert CoreZeroAddress();
        if (registry.code.length == 0) revert CoreContractRequired(registry);

        address expected = _predictCreateAddress(factory, 2);
        if (address(this) != expected) revert CoreAddressMismatch(expected, address(this));

        expected = _predictCreateAddress(factory, 1);
        if (authority != expected) revert CorePeerMismatch(0, expected, authority);
        expected = _predictCreateAddress(factory, 3);
        if (budgetBook != expected) revert CorePeerMismatch(2, expected, budgetBook);
        expected = _predictCreateAddress(factory, 4);
        if (intentExecution != expected) revert CorePeerMismatch(3, expected, intentExecution);
        expected = _predictCreateAddress(factory, 5);
        if (reconciliation != expected) revert CorePeerMismatch(4, expected, reconciliation);

        if (authority.code.length == 0) revert CoreContractRequired(authority);
        if (globalLifetimeCanonicalDepositCapWei == 0) revert InvalidGlobalLifetimeCap();

        _factory = factory;
        _manifestHash = manifestHash;
        _authority = authority;
        _registry = registry;
        _budgetBook = budgetBook;
        _intentExecution = intentExecution;
        _reconciliation = reconciliation;
        _globalLifetimeCanonicalDepositCapWei = globalLifetimeCanonicalDepositCapWei;
    }

    function coreTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
        return (_factory, _manifestHash, _finalized);
    }

    function globalLifetimeCanonicalDepositCapWei() external view returns (uint256) {
        return _globalLifetimeCanonicalDepositCapWei;
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
        uint256[18] memory words = _coreSnapshotWords();
        assembly ("memory-safe") {
            return(words, 0x240)
        }
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

    function _predictCreateAddress(address deployer, uint8 nonce) private pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", deployer, nonce)))));
    }

    function _coreSnapshotWords() private view returns (uint256[18] memory words) {
        words[0] = 3;
        words[1] = uint256(uint160(_factory));
        words[2] = uint256(_manifestHash);
        words[3] = uint256(uint160(_authority));
        words[4] = uint256(uint160(_registry));
        words[5] = uint256(uint160(_budgetBook));
        words[6] = uint256(uint160(_intentExecution));
        words[7] = uint256(uint160(_reconciliation));
        words[8] = _finalized ? 1 : 0;
        words[9] = _globalLifetimeCanonicalDepositCapWei;
        words[10] = availableWei;
        words[11] = unattributedWei;
        words[12] = ordinaryReservedWei;
        words[13] = reconciliationLiabilityWei;
        words[14] = reconciliationBackingWei;
        words[15] = accountingSequence;
        words[16] = lastObservedBalanceDeficitWei;
        words[17] = globalLifetimeCanonicalDepositedWei;
    }
}
