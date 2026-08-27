// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract AcquisitionIntentExecution {
    error IntentExecutionFactoryZero();
    error IntentExecutionManifestHashZero();
    error IntentExecutionFinalizerUnauthorized(address caller);
    error IntentExecutionManifestHashMismatch(bytes32 expected, bytes32 actual);
    error IntentExecutionAlreadyFinalized();
    event IntentExecutionFinalized(bytes32 indexed manifestHash);
    address private immutable _factory;
    bytes32 private immutable _manifestHash;
    bool private _finalized;

    constructor(address factory, bytes32 manifestHash) {
        if (factory == address(0)) revert IntentExecutionFactoryZero();
        if (manifestHash == bytes32(0)) revert IntentExecutionManifestHashZero();
        _factory = factory;
        _manifestHash = manifestHash;
    }

    function intentExecutionTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
        return (_factory, _manifestHash, _finalized);
    }

    function finalizeIntentExecution(bytes32 manifestHash) external {
        if (msg.sender != _factory) revert IntentExecutionFinalizerUnauthorized(msg.sender);
        if (manifestHash != _manifestHash) revert IntentExecutionManifestHashMismatch(_manifestHash, manifestHash);
        if (_finalized) revert IntentExecutionAlreadyFinalized();
        _finalized = true;
        emit IntentExecutionFinalized(_manifestHash);
    }
}
