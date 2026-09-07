// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract AcquisitionReconciliation {
    error ReconciliationFactoryZero();
    error ReconciliationManifestHashZero();
    error ReconciliationFinalizerUnauthorized(address caller);
    error ReconciliationManifestHashMismatch(bytes32 expected, bytes32 actual);
    error ReconciliationAlreadyFinalized();
    event ReconciliationFinalized(bytes32 indexed manifestHash);
    address private immutable _factory;
    bytes32 private immutable _manifestHash;
    bool private _finalized;

    constructor(address factory, bytes32 manifestHash) {
        if (factory == address(0)) revert ReconciliationFactoryZero();
        if (manifestHash == bytes32(0)) revert ReconciliationManifestHashZero();
        _factory = factory;
        _manifestHash = manifestHash;
    }

    function reconciliationTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
        return (_factory, _manifestHash, _finalized);
    }

    function finalizeReconciliation(bytes32 manifestHash) external {
        if (msg.sender != _factory) revert ReconciliationFinalizerUnauthorized(msg.sender);
        if (manifestHash != _manifestHash) revert ReconciliationManifestHashMismatch(_manifestHash, manifestHash);
        if (_finalized) revert ReconciliationAlreadyFinalized();
        _finalized = true;
        emit ReconciliationFinalized(_manifestHash);
    }
}
