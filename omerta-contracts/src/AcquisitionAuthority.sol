// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract AcquisitionAuthority {
    error AuthorityFactoryZero();
    error AuthorityManifestHashZero();
    error AuthorityFinalizerUnauthorized(address caller);
    error AuthorityManifestHashMismatch(bytes32 expected, bytes32 actual);
    error AuthorityAlreadyFinalized();
    event AuthorityFinalized(bytes32 indexed manifestHash);

    address private immutable _factory;
    bytes32 private immutable _manifestHash;
    bool private _finalized;

    constructor(address factory, bytes32 manifestHash) {
        if (factory == address(0)) revert AuthorityFactoryZero();
        if (manifestHash == bytes32(0)) revert AuthorityManifestHashZero();
        _factory = factory;
        _manifestHash = manifestHash;
    }

    function authorityTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
        return (_factory, _manifestHash, _finalized);
    }

    function finalizeAuthority(bytes32 manifestHash) external {
        if (msg.sender != _factory) revert AuthorityFinalizerUnauthorized(msg.sender);
        if (manifestHash != _manifestHash) revert AuthorityManifestHashMismatch(_manifestHash, manifestHash);
        if (_finalized) revert AuthorityAlreadyFinalized();
        _finalized = true;
        emit AuthorityFinalized(_manifestHash);
    }
}
