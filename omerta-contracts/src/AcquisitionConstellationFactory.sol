// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract AcquisitionConstellationFactory {
    uint256 private constant _SUPPORTED_CHAIN_ID = 4663;
    uint256 private constant _REGISTRY_GAS = 100_000;
    uint256 private constant _TOPOLOGY_GAS = 50_000;
    uint256 private constant _FINALIZER_GAS = 100_000;
    uint256 private constant _FINALIZER_PRECHECK = 211_588;
    uint256 private constant _FINALIZER_POSTCHECK = 100_000;
    uint256 private constant _MAX_INITCODE = 49_152;
    uint256 private constant _MAX_RUNTIME = 24_576;
    bytes32 private constant _EMPTY_CODE_HASH = keccak256("");
    bytes32 private constant _CONFIG_TAG = keccak256("OMERTA_ACQUISITION_TASK1_CONFIG_V1");
    bytes32 private constant _CONSTELLATION_TAG = keccak256("OMERTA_ACQUISITION_CONSTELLATION_V1");
    bytes32 private constant _DEPLOYMENT_TAG = keccak256("OMERTA_ACQUISITION_DEPLOYMENT_V1");

    enum Phase {
        DEPLOYING,
        DEPLOYING_CHILD,
        READY_TO_FINALIZE,
        FINALIZING,
        FINALIZED
    }

    error WrongChain(uint256 actualChainId);
    error RegistryChainMismatch(uint256 actualChainId);
    error FactorySafeZero();
    error FactoryRegistryZero();
    error FactorySafeCodeMissing(address safe);
    error FactoryRegistryCodeMissing(address registry);
    error FactoryRoleCollision(address candidate);
    error FactoryRegistryRuntimeHashMismatch(bytes32 expected, bytes32 actual);
    error FactoryRegistryCallFailed();
    error FactoryRegistryReturnLength(uint256 actual);
    error FactoryPhaseMismatch(uint8 expected, uint8 actual);
    error FactoryChildIndex(uint8 index);
    error FactoryChildInitcodeHashZero(uint8 index);
    error FactoryChildRuntimeHashZero(uint8 index);
    error FactoryInitcodeEmpty(uint8 index);
    error FactoryInitcodeTooLarge(uint8 index, uint256 actual);
    error FactoryInitcodeHashMismatch(uint8 index, bytes32 expected, bytes32 actual);
    error FactoryCreateFailed(uint8 index);
    error FactoryChildAddressMismatch(uint8 index, address expected, address actual);
    error FactoryRuntimeTooLarge(uint8 index, uint256 actual);
    error FactoryRuntimeHashMismatch(uint8 index, bytes32 expected, bytes32 actual);
    error FactoryTopologyCallFailed(uint8 index);
    error FactoryTopologyReturnLength(uint8 index, uint256 actual);
    error FactoryTopologySemanticMismatch(uint8 index);
    error FactoryPostCallGasInsufficient(uint8 index, uint256 available, uint256 required);
    error FactoryFinalizerCallFailed(uint8 index);
    error FactoryFinalizerReturnLength(uint8 index, uint256 actual);
    error FactoryFinalizerSemanticMismatch(uint8 index);

    event ChildDeployed(uint8 indexed index, address indexed child, bytes32 indexed initcodeHash, bytes32 runtimeHash);
    event ConstellationFinalized(bytes32 indexed manifestHash, bytes32 indexed deploymentCommitment);

    address private immutable _safe;
    address private immutable _registry;
    bytes32 private immutable _registryRuntimeHash;
    bytes32 private immutable _configurationRoot;
    bytes32 private immutable _manifestHash;
    bytes32 private immutable _deploymentCommitment;
    bytes32[5] private _childInitcodeHashes;
    bytes32[5] private _childRuntimeHashes;
    address[5] private _children;
    Phase private _phase;
    uint8 private _nextChildIndex;

    constructor(
        address safe,
        address registry,
        bytes32 registryRuntimeHash,
        bytes32[5] memory childInitcodeHashes,
        bytes32[5] memory childRuntimeHashes
    ) {
        if (block.chainid != _SUPPORTED_CHAIN_ID) {
            revert WrongChain(block.chainid);
        }
        if (safe == address(0)) revert FactorySafeZero();
        if (registry == address(0)) revert FactoryRegistryZero();
        if (safe.code.length == 0) revert FactorySafeCodeMissing(safe);
        if (registry.code.length == 0) revert FactoryRegistryCodeMissing(registry);
        address[5] memory predicted;
        for (uint8 i; i < 5; ++i) {
            predicted[i] = _predictCreateAddress(address(this), i + 1);
        }
        if (safe == registry) revert FactoryRoleCollision(safe);
        if (safe == address(this)) revert FactoryRoleCollision(safe);
        if (registry == address(this)) revert FactoryRoleCollision(registry);
        for (uint8 i; i < 5; ++i) {
            if (safe == predicted[i]) revert FactoryRoleCollision(safe);
            if (registry == predicted[i]) revert FactoryRoleCollision(registry);
        }
        bytes32 actualRegistryHash = registry.codehash;
        if (actualRegistryHash != registryRuntimeHash) {
            revert FactoryRegistryRuntimeHashMismatch(registryRuntimeHash, actualRegistryHash);
        }
        for (uint8 i; i < 5; ++i) {
            if (childInitcodeHashes[i] == bytes32(0)) revert FactoryChildInitcodeHashZero(i);
        }
        for (uint8 i; i < 5; ++i) {
            if (childRuntimeHashes[i] == bytes32(0)) revert FactoryChildRuntimeHashZero(i);
        }
        _checkRegistry(registry, false);

        bytes32 config = keccak256(abi.encode(_CONFIG_TAG, uint256(1), registry, registryRuntimeHash));
        bytes32 manifest = keccak256(
            abi.encode(
                _CONSTELLATION_TAG,
                uint256(_SUPPORTED_CHAIN_ID),
                address(this),
                safe,
                config,
                registry,
                registryRuntimeHash,
                predicted[0],
                predicted[1],
                predicted[2],
                predicted[3],
                predicted[4]
            )
        );
        _safe = safe;
        _registry = registry;
        _registryRuntimeHash = registryRuntimeHash;
        _configurationRoot = config;
        _manifestHash = manifest;
        _deploymentCommitment =
            keccak256(abi.encode(_DEPLOYMENT_TAG, manifest, childInitcodeHashes, childRuntimeHashes));
        _childInitcodeHashes = childInitcodeHashes;
        _childRuntimeHashes = childRuntimeHashes;
        _children = predicted;
    }

    function factoryState()
        external
        view
        returns (
            bytes32 manifestHash,
            bytes32 deploymentCommitment,
            uint8 phase,
            uint8 nextChildIndex,
            address safe,
            bytes32 configurationRoot,
            address registry,
            bytes32 registryRuntimeHash
        )
    {
        return (
            _manifestHash,
            _deploymentCommitment,
            uint8(_phase),
            _nextChildIndex,
            _safe,
            _configurationRoot,
            _registry,
            _registryRuntimeHash
        );
    }

    function childCommitment(uint8 index)
        external
        view
        returns (address child, bytes32 initcodeHash, bytes32 runtimeHash)
    {
        if (index >= 5) revert FactoryChildIndex(index);
        return (_children[index], _childInitcodeHashes[index], _childRuntimeHashes[index]);
    }

    function deployNext(bytes calldata initcode) external returns (address child) {
        if (_phase != Phase.DEPLOYING) revert FactoryPhaseMismatch(uint8(Phase.DEPLOYING), uint8(_phase));
        uint8 index = _nextChildIndex;
        if (index >= 5) revert FactoryChildIndex(index);
        if (initcode.length == 0) revert FactoryInitcodeEmpty(index);
        if (initcode.length > _MAX_INITCODE) revert FactoryInitcodeTooLarge(index, initcode.length);
        bytes32 actualInitcodeHash = keccak256(initcode);
        bytes32 expectedInitcodeHash = _childInitcodeHashes[index];
        if (actualInitcodeHash != expectedInitcodeHash) {
            revert FactoryInitcodeHashMismatch(index, expectedInitcodeHash, actualInitcodeHash);
        }
        bytes memory creation = initcode;
        _phase = Phase.DEPLOYING_CHILD;
        assembly ("memory-safe") {
            child := create(0, add(creation, 0x20), mload(creation))
        }
        if (child == address(0)) revert FactoryCreateFailed(index);
        address expectedChild = _children[index];
        if (child != expectedChild) revert FactoryChildAddressMismatch(index, expectedChild, child);
        bytes32 actualRuntimeHash = child.codehash;
        bytes32 expectedRuntimeHash = _childRuntimeHashes[index];
        if (actualRuntimeHash == bytes32(0) || actualRuntimeHash == _EMPTY_CODE_HASH) {
            revert FactoryRuntimeHashMismatch(index, expectedRuntimeHash, actualRuntimeHash);
        }
        uint256 runtimeSize = child.code.length;
        if (runtimeSize > _MAX_RUNTIME) revert FactoryRuntimeTooLarge(index, runtimeSize);
        if (actualRuntimeHash != expectedRuntimeHash) {
            revert FactoryRuntimeHashMismatch(index, expectedRuntimeHash, actualRuntimeHash);
        }
        _checkTopology(index, false, false);
        unchecked {
            _nextChildIndex = index + 1;
        }
        _phase = _nextChildIndex == 5 ? Phase.READY_TO_FINALIZE : Phase.DEPLOYING;
        emit ChildDeployed(index, child, expectedInitcodeHash, expectedRuntimeHash);
    }

    function finalizeConstellation() external {
        if (_phase != Phase.READY_TO_FINALIZE) {
            revert FactoryPhaseMismatch(uint8(Phase.READY_TO_FINALIZE), uint8(_phase));
        }
        if (_nextChildIndex != 5) revert FactoryChildIndex(_nextChildIndex);
        for (uint8 i; i < 5; ++i) {
            _checkDeployedChild(i, false);
        }
        if (_registry.code.length == 0) revert FactoryRegistryCodeMissing(_registry);
        bytes32 actualRegistryHash = _registry.codehash;
        if (actualRegistryHash != _registryRuntimeHash) {
            revert FactoryRegistryRuntimeHashMismatch(_registryRuntimeHash, actualRegistryHash);
        }
        _checkRegistry(_registry, false);
        _phase = Phase.FINALIZING;
        _finalize(2);
        _finalize(4);
        _finalize(3);
        _finalize(1);
        _finalize(0);
        for (uint8 i; i < 5; ++i) {
            _checkTopology(i, true, true);
        }
        _phase = Phase.FINALIZED;
        emit ConstellationFinalized(_manifestHash, _deploymentCommitment);
    }

    function _checkDeployedChild(uint8 index, bool finalized) private view {
        address child = _children[index];
        bytes32 actualHash = child.codehash;
        bytes32 expectedHash = _childRuntimeHashes[index];
        if (actualHash == bytes32(0) || actualHash == _EMPTY_CODE_HASH) {
            revert FactoryRuntimeHashMismatch(index, expectedHash, actualHash);
        }
        uint256 size = child.code.length;
        if (size > _MAX_RUNTIME) revert FactoryRuntimeTooLarge(index, size);
        if (actualHash != expectedHash) revert FactoryRuntimeHashMismatch(index, expectedHash, actualHash);
        _checkTopology(index, finalized, finalized);
    }

    function _checkRegistry(address registry, bool checkCode) private view {
        if (checkCode && registry.code.length == 0) revert FactoryRegistryCodeMissing(registry);
        bytes4 selector = bytes4(keccak256("supportedChainId()"));
        bool ok;
        uint256 size;
        uint256 actual;
        assembly ("memory-safe") {
            mstore(0x00, selector)
            ok := staticcall(_REGISTRY_GAS, registry, 0x00, 0x04, 0x00, 0x20)
            size := returndatasize()
            actual := mload(0x00)
        }
        if (!ok) revert FactoryRegistryCallFailed();
        if (size != 32) revert FactoryRegistryReturnLength(size);
        if (actual != _SUPPORTED_CHAIN_ID) revert RegistryChainMismatch(actual);
    }

    function _checkTopology(uint8 index, bool expectedFinalized, bool afterFinalizer) private view {
        address child = _children[index];
        bytes4 selector = _topologySelector(index);
        bool ok;
        uint256 size;
        uint256 actualFactoryWord;
        bytes32 actualManifest;
        uint256 actualFinalizedWord;
        assembly ("memory-safe") {
            let buffer := mload(0x40)
            mstore(buffer, selector)
            ok := staticcall(_TOPOLOGY_GAS, child, buffer, 0x04, buffer, 0x60)
            size := returndatasize()
            actualFactoryWord := mload(buffer)
            actualManifest := mload(add(buffer, 0x20))
            actualFinalizedWord := mload(add(buffer, 0x40))
        }
        if (!ok) revert FactoryTopologyCallFailed(index);
        if (size != 96) revert FactoryTopologyReturnLength(index, size);
        // forge-lint: disable-next-line(unsafe-typecast)
        bool canonicalFactory = actualFactoryWord >> 160 == 0 && address(uint160(actualFactoryWord)) == address(this);
        bool canonicalFinalized = actualFinalizedWord <= 1 && (actualFinalizedWord == 1) == expectedFinalized;
        if (!canonicalFactory || actualManifest != _manifestHash || !canonicalFinalized) {
            if (afterFinalizer) revert FactoryFinalizerSemanticMismatch(index);
            revert FactoryTopologySemanticMismatch(index);
        }
    }

    function _finalize(uint8 index) private {
        bytes memory input = abi.encodeWithSelector(_finalizerSelector(index), _manifestHash);
        address child = _children[index];
        uint256 beforeGas = gasleft();
        _requireFinalizerPrecheck(index, beforeGas);
        bool ok;
        uint256 size;
        uint256 afterGas;
        assembly ("memory-safe") {
            ok := call(_FINALIZER_GAS, child, 0, add(input, 0x20), mload(input), 0, 0)
            afterGas := gas()
        }
        _requireFinalizerPostcheck(index, afterGas);
        assembly ("memory-safe") {
            size := returndatasize()
        }
        if (!ok) revert FactoryFinalizerCallFailed(index);
        if (size != 0) revert FactoryFinalizerReturnLength(index, size);
        _checkTopology(index, true, true);
    }

    function _topologySelector(uint8 index) private pure returns (bytes4) {
        if (index == 0) return bytes4(keccak256("authorityTopology()"));
        if (index == 1) return bytes4(keccak256("coreTopology()"));
        if (index == 2) return bytes4(keccak256("budgetBookTopology()"));
        if (index == 3) return bytes4(keccak256("intentExecutionTopology()"));
        return bytes4(keccak256("reconciliationTopology()"));
    }

    function _finalizerSelector(uint8 index) private pure returns (bytes4) {
        if (index == 0) return bytes4(keccak256("finalizeAuthority(bytes32)"));
        if (index == 1) return bytes4(keccak256("finalizeCore(bytes32)"));
        if (index == 2) return bytes4(keccak256("finalizeBudgetBook(bytes32)"));
        if (index == 3) return bytes4(keccak256("finalizeIntentExecution(bytes32)"));
        return bytes4(keccak256("finalizeReconciliation(bytes32)"));
    }

    function _predictCreateAddress(address deployer, uint8 nonce) private pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", deployer, nonce)))));
    }

    function _hasFinalizerPrecheckGas(uint256 available) internal pure returns (bool) {
        return available >= _FINALIZER_PRECHECK;
    }

    function _hasFinalizerPostcheckGas(uint256 available) internal pure returns (bool) {
        return available >= _FINALIZER_POSTCHECK;
    }

    function _requireFinalizerPrecheck(uint8 index, uint256 available) internal pure {
        if (!_hasFinalizerPrecheckGas(available)) {
            revert FactoryPostCallGasInsufficient(index, available, _FINALIZER_PRECHECK);
        }
    }

    function _requireFinalizerPostcheck(uint8 index, uint256 available) internal pure {
        if (!_hasFinalizerPostcheckGas(available)) {
            revert FactoryPostCallGasInsufficient(index, available, _FINALIZER_POSTCHECK);
        }
    }
}
