// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract AcquisitionIntentExecution {
    uint256 private constant _SUPPORTED_CHAIN_ID = 4663;
    bytes32 private constant _ATTEMPT_TAG = keccak256("OMERTA_ACQUISITION_INTENT_ATTEMPT_V2");

    error IntentExecutionFactoryZero();
    error IntentExecutionManifestHashZero();
    error IntentExecutionFinalizerUnauthorized(address caller);
    error IntentExecutionManifestHashMismatch(bytes32 expected, bytes32 actual);
    error IntentExecutionAlreadyFinalized();
    error IntentExecutionZeroAddress();
    error IntentExecutionContractRequired(address account);
    error IntentExecutionAddressMismatch(address expected, address actual);
    error IntentExecutionPeerMismatch(uint8 peer, address expected, address actual);

    event IntentExecutionFinalized(bytes32 indexed manifestHash);

    address private immutable _factory;
    bytes32 private immutable _manifestHash;
    address private immutable _core;
    bool private _finalized;

    constructor(address factory, bytes32 manifestHash, address core) {
        if (factory == address(0)) revert IntentExecutionFactoryZero();
        if (manifestHash == bytes32(0)) revert IntentExecutionManifestHashZero();
        if (core == address(0)) revert IntentExecutionZeroAddress();
        address expectedIntent = _predictCreateAddress(factory, 4);
        if (address(this) != expectedIntent) revert IntentExecutionAddressMismatch(expectedIntent, address(this));
        address expectedCore = _predictCreateAddress(factory, 2);
        if (core != expectedCore) revert IntentExecutionPeerMismatch(1, expectedCore, core);
        if (core.code.length == 0) revert IntentExecutionContractRequired(core);
        _factory = factory;
        _manifestHash = manifestHash;
        _core = core;
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

    function deriveIntentId(uint256 ballotDay, bytes32 assetVersionKey) external view returns (bytes32 intentId) {
        return keccak256(abi.encode(uint256(_SUPPORTED_CHAIN_ID), address(_core), ballotDay, assetVersionKey));
    }

    function deriveAttemptId(
        uint256 operatorGeneration,
        uint256 attemptIndex,
        bytes32 intentId,
        address adapter,
        bytes32 runtimeCodeHash,
        bytes32 routeHash
    ) external view returns (bytes32 attemptId) {
        return keccak256(
            abi.encode(
                _ATTEMPT_TAG,
                uint256(_SUPPORTED_CHAIN_ID),
                address(_core),
                address(this),
                operatorGeneration,
                attemptIndex,
                intentId,
                adapter,
                runtimeCodeHash,
                routeHash
            )
        );
    }

    function _predictCreateAddress(address deployer, uint8 nonce) private pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", deployer, nonce)))));
    }
}
