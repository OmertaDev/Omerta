// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract AcquisitionVaultCore {
    error CoreFactoryZero();
    error CoreManifestHashZero();
    error CoreFinalizerUnauthorized(address caller);
    error CoreManifestHashMismatch(bytes32 expected, bytes32 actual);
    error CoreAlreadyFinalized();
    event CoreFinalized(bytes32 indexed manifestHash);
    address private immutable _factory;
    bytes32 private immutable _manifestHash;
    bool private _finalized;

    constructor(address factory, bytes32 manifestHash) {
        if (factory == address(0)) revert CoreFactoryZero();
        if (manifestHash == bytes32(0)) revert CoreManifestHashZero();
        _factory = factory;
        _manifestHash = manifestHash;
    }

    function coreTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
        return (_factory, _manifestHash, _finalized);
    }

    function finalizeCore(bytes32 manifestHash) external {
        if (msg.sender != _factory) revert CoreFinalizerUnauthorized(msg.sender);
        if (manifestHash != _manifestHash) revert CoreManifestHashMismatch(_manifestHash, manifestHash);
        if (_finalized) revert CoreAlreadyFinalized();
        _finalized = true;
        emit CoreFinalized(_manifestHash);
    }
}
