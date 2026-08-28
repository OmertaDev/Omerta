// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {AcquisitionConstellationFactory} from "../src/AcquisitionConstellationFactory.sol";
import {AcquisitionAuthority} from "../src/AcquisitionAuthority.sol";
import {AcquisitionVaultCore} from "../src/AcquisitionVaultCore.sol";
import {PreVoteBudgetBook} from "../src/PreVoteBudgetBook.sol";
import {AcquisitionIntentExecution} from "../src/AcquisitionIntentExecution.sol";
import {AcquisitionReconciliation} from "../src/AcquisitionReconciliation.sol";

contract Task1Safe {}

contract Task1ForceEther {
    constructor(address payable target) payable {
        selfdestruct(target);
    }
}

contract Task1Registry {
    uint256 internal immutable _chain;

    constructor(uint256 chain_) {
        _chain = chain_;
    }

    function supportedChainId() external view returns (uint256) {
        return _chain;
    }
}

contract Task1RuntimeProbe {
    function deploy(bytes memory creation) external returns (address child) {
        assembly ("memory-safe") {
            child := create(0, add(creation, 0x20), mload(creation))
            if iszero(child) {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }
}

contract RegistryBehaviorMock {
    uint256 internal immutable _mode;

    constructor(uint256 mode) {
        _mode = mode;
    }

    fallback() external {
        uint256 mode = _mode;
        assembly {
            switch mode
            case 0 { revert(0, 0) }
            case 1 { return(0, 0) }
            case 2 { return(0, 31) }
            case 3 { return(0, 33) }
            case 4 { return(0, 4096) }
            case 5 {
                mstore(0, 1)
                return(0, 32)
            }
            default { for {} 1 {} {} }
        }
    }
}

contract RegistryCallbackMock {
    address internal immutable _target;
    bool internal immutable _catchEmpty;

    constructor(address target, bool catchEmpty) {
        _target = target;
        _catchEmpty = catchEmpty;
    }

    fallback() external {
        (bool ok, bytes memory result) = _target.staticcall(abi.encodeWithSignature("finalizeConstellation()"));
        if (!_catchEmpty && (!ok || result.length == 0)) revert();
        assembly {
            mstore(0, 4663)
            return(0, 32)
        }
    }
}

contract ConstructorCallbackAuthority {
    address internal _factory;
    bytes32 internal _manifest;
    bool internal _finalized;
    bytes public deployCallbackResult;
    bytes public finalizeCallbackResult;

    constructor(address factory, bytes32 manifest, bool catchFailures) {
        _factory = factory;
        _manifest = manifest;
        if (!catchFailures) {
            AcquisitionConstellationFactory(factory).deployNext(bytes(""));
        }
        (bool deployOk, bytes memory deployData) =
            factory.call(abi.encodeWithSelector(AcquisitionConstellationFactory.deployNext.selector, bytes("")));
        require(!deployOk);
        deployCallbackResult = deployData;
        (bool finalizeOk, bytes memory finalizeData) =
            factory.call(abi.encodeWithSelector(AcquisitionConstellationFactory.finalizeConstellation.selector));
        require(!finalizeOk);
        finalizeCallbackResult = finalizeData;
    }

    function authorityTopology() external view returns (address, bytes32, bool) {
        return (_factory, _manifest, _finalized);
    }

    function finalizeAuthority(bytes32 manifest) external {
        require(msg.sender == _factory && manifest == _manifest && !_finalized);
        _finalized = true;
    }
}

contract FactoryGasHarness is AcquisitionConstellationFactory {
    constructor(
        address safe,
        address registry,
        bytes32 registryHash,
        uint256 globalCap,
        bytes32[5] memory ih,
        bytes32[5] memory rh
    ) AcquisitionConstellationFactory(safe, registry, registryHash, globalCap, ih, rh) {}

    function pre(uint256 available) external pure returns (bool) {
        return _hasFinalizerPrecheckGas(available);
    }

    function post(uint256 available) external pure returns (bool) {
        return _hasFinalizerPostcheckGas(available);
    }

    function requirePre(uint8 index, uint256 available) external pure {
        _requireFinalizerPrecheck(index, available);
    }

    function requirePost(uint8 index, uint256 available) external pure {
        _requireFinalizerPostcheck(index, available);
    }

    function sharedCall(uint8 index, address target, bytes calldata input) external returns (uint256) {
        return _callFinalizer(index, target, input);
    }

    function requireChildAddress(uint8 index, address expected, address actual) external pure {
        _requireChildAddress(index, expected, actual);
    }

    function requireRuntimeSize(uint8 index, uint256 actual) external pure {
        _requireRuntimeSize(index, actual);
    }
}

contract FinalizerGasTarget {
    enum Mode {
        SuccessEmpty,
        SuccessOne,
        SuccessLarge,
        RevertLarge,
        ConsumeAllowance
    }
    Mode internal immutable _mode;

    constructor(Mode mode) {
        _mode = mode;
    }

    fallback() external {
        Mode mode = _mode;
        assembly {
            switch mode
            case 0 { return(0, 0) }
            case 1 {
                mstore(0, 1)
                return(0, 1)
            }
            case 2 { return(0, 4096) }
            case 3 { revert(0, 4096) }
            default {
                for {} gt(gas(), 100) {} {}
                return(0, 0)
            }
        }
    }
}

contract MatrixChild {
    address internal _factory;
    bytes32 internal _manifest;
    uint8 internal _index;
    uint8 internal _mode;
    address internal _poisonTarget;
    bool internal _finalized;

    constructor(address factory, bytes32 manifest, uint8 index, uint8 mode, address poisonTarget) {
        _factory = factory;
        _manifest = manifest;
        _index = index;
        _mode = mode;
        _poisonTarget = poisonTarget;
    }

    function poison() external {
        require(msg.sender == _poisonTarget);
        _finalized = false;
    }

    fallback() external {
        if (msg.sig == _topologySelector(_index)) {
            if (_mode == 1 && _finalized) revert();
            if (_mode == 2 && _finalized) {
                assembly { return(0, 95) }
            }
            address reportedFactory = _mode == 3 && _finalized ? address(0xBAD) : _factory;
            bytes memory result = abi.encode(reportedFactory, _manifest, _finalized);
            assembly { return(add(result, 0x20), mload(result)) }
        }
        if (msg.sig != _finalizerSelector(_index)) revert();
        require(msg.sender == _factory);
        _finalized = true;
        if (_mode == 4) {
            MatrixChild(_poisonTarget).poison();
        } else if (_mode == 5) {
            assembly {
                mstore(0, 1)
                return(0, 1)
            }
        } else if (_mode == 6) {
            assembly { return(0, 4096) }
        }
    }

    function _topologySelector(uint8 index) private pure returns (bytes4) {
        if (index == 0) return AcquisitionAuthority.authorityTopology.selector;
        if (index == 1) return AcquisitionVaultCore.coreTopology.selector;
        if (index == 2) return PreVoteBudgetBook.budgetBookTopology.selector;
        if (index == 3) return AcquisitionIntentExecution.intentExecutionTopology.selector;
        return AcquisitionReconciliation.reconciliationTopology.selector;
    }

    function _finalizerSelector(uint8 index) private pure returns (bytes4) {
        if (index == 0) return AcquisitionAuthority.finalizeAuthority.selector;
        if (index == 1) return AcquisitionVaultCore.finalizeCore.selector;
        if (index == 2) return PreVoteBudgetBook.finalizeBudgetBook.selector;
        if (index == 3) return AcquisitionIntentExecution.finalizeIntentExecution.selector;
        return AcquisitionReconciliation.finalizeReconciliation.selector;
    }
}

contract AcquisitionConstellationTask1Test is Test {
    uint256 internal constant GLOBAL_CAP = 3 ether;
    bytes32 internal constant CONFIG_TAG = keccak256("OMERTA_ACQUISITION_TASK3_CONFIG_V1");
    bytes32 internal constant CONSTELLATION_TAG = keccak256("OMERTA_ACQUISITION_CONSTELLATION_V1");
    bytes32 internal constant DEPLOYMENT_TAG = keccak256("OMERTA_ACQUISITION_DEPLOYMENT_V1");

    Task1Safe internal safe;
    Task1Registry internal registry;

    function setUp() public {
        vm.chainId(4663);
        safe = new Task1Safe();
        registry = new Task1Registry(4663);
    }

    function test_exactLifecycleCommitmentsPredictionsAndFinalizerOrder() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted) =
            _configured();
        (bytes32 manifest, bytes32 deployment) = _assertInitial(factory, predicted);
        for (uint8 i; i < 5; ++i) {
            assertEq(factory.deployNext(initcodes[i]), predicted[i]);
        }
        _assertDeploymentCommitment(factory, initcodes, manifest, deployment);
        (,, uint8 phase, uint8 next,,,,,) = factory.factoryState();
        assertEq(phase, 2);
        assertEq(next, 5);
        vm.recordLogs();
        factory.finalizeConstellation();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 6);
        assertEq(logs[0].emitter, predicted[2]);
        assertEq(logs[1].emitter, predicted[4]);
        assertEq(logs[2].emitter, predicted[3]);
        assertEq(logs[3].emitter, predicted[1]);
        assertEq(logs[4].emitter, predicted[0]);
        assertEq(logs[5].emitter, address(factory));
        (,, phase,,,,,,) = factory.factoryState();
        assertEq(phase, 4);
        _assertTopology(predicted, address(factory), manifest, true);
    }

    function _assertInitial(AcquisitionConstellationFactory factory, address[5] memory predicted)
        internal
        view
        returns (bytes32 manifest, bytes32 deployment)
    {
        uint8 phase;
        uint8 next;
        address actualSafe;
        bytes32 config;
        uint256 globalCap;
        (manifest, deployment, phase, next, actualSafe, config,,, globalCap) = factory.factoryState();
        assertEq(phase, 0);
        assertEq(next, 0);
        assertEq(actualSafe, address(safe));
        bytes32 expectedConfig =
            keccak256(abi.encode(CONFIG_TAG, uint256(3), address(registry), address(registry).codehash, GLOBAL_CAP));
        assertEq(config, expectedConfig);
        assertEq(globalCap, GLOBAL_CAP);
        assertEq(manifest, _manifest(address(factory), expectedConfig, predicted));
    }

    function _assertDeploymentCommitment(
        AcquisitionConstellationFactory factory,
        bytes[5] memory initcodes,
        bytes32 manifest,
        bytes32 deployment
    ) internal view {
        bytes32[5] memory ih;
        bytes32[5] memory rh;
        for (uint8 i; i < 5; ++i) {
            ih[i] = keccak256(initcodes[i]);
            (, bytes32 committedInit, bytes32 committedRuntime) = factory.childCommitment(i);
            assertEq(committedInit, ih[i]);
            rh[i] = committedRuntime;
        }
        assertEq(deployment, keccak256(abi.encode(DEPLOYMENT_TAG, manifest, ih, rh)));
    }

    function test_permissionlessDeployAndForcedEtherAreInert() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted) =
            _configured();
        new Task1ForceEther{value: 9 ether}(payable(address(factory)));
        for (uint8 i; i < 5; ++i) {
            new Task1ForceEther{value: uint256(i + 1) * 1 ether}(payable(predicted[i]));
        }
        vm.prank(address(0xBEEF));
        factory.deployNext(initcodes[0]);
        assertEq(address(factory).balance, 9 ether);
        assertEq(predicted[0].balance, 1 ether);
        for (uint8 i = 1; i < 5; ++i) {
            factory.deployNext(initcodes[i]);
        }
        factory.finalizeConstellation();
        (bool factoryOk,) = address(factory).call(hex"deadbeef");
        assertFalse(factoryOk);
        (factoryOk,) = address(factory).call{value: 1}("");
        assertFalse(factoryOk);
        for (uint8 i; i < 5; ++i) {
            assertEq(predicted[i].balance, uint256(i + 1) * 1 ether);
            (bool ok,) = predicted[i].call(hex"deadbeef");
            assertFalse(ok);
            (ok,) = predicted[i].call{value: 1}("");
            assertFalse(ok);
        }
    }

    function test_deployWrongInitcodeRollsBackPhaseAndIndex() public {
        (AcquisitionConstellationFactory factory,,) = _configured();
        bytes memory wrong = hex"60006000f3";
        (, bytes32 expected,) = factory.childCommitment(0);
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryInitcodeHashMismatch.selector,
                uint8(0),
                expected,
                keccak256(wrong)
            )
        );
        factory.deployNext(wrong);
        (,, uint8 phase, uint8 next,,,,,) = factory.factoryState();
        assertEq(phase, 0);
        assertEq(next, 0);
    }

    function test_finalizerPrecedenceUnauthorizedThenHashThenAlready() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes,) = _configured();
        AcquisitionAuthority authority = AcquisitionAuthority(factory.deployNext(initcodes[0]));
        (bytes32 manifest,,,,,,,,) = factory.factoryState();
        vm.prank(address(0xBAD));
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionAuthority.AuthorityFinalizerUnauthorized.selector, address(0xBAD))
        );
        authority.finalizeAuthority(bytes32(0));
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionAuthority.AuthorityManifestHashMismatch.selector, manifest, bytes32(0))
        );
        vm.prank(address(factory));
        authority.finalizeAuthority(bytes32(0));
        vm.prank(address(factory));
        authority.finalizeAuthority(manifest);
        vm.prank(address(factory));
        vm.expectRevert(AcquisitionAuthority.AuthorityAlreadyFinalized.selector);
        authority.finalizeAuthority(manifest);
    }

    function test_childConstructorPrecedenceAndNoFallbackReceive() public {
        vm.expectRevert(AcquisitionAuthority.AuthorityFactoryZero.selector);
        new AcquisitionAuthority(
            address(0), bytes32(0), address(0), address(0), address(0), address(0), address(0), address(0)
        );
        vm.expectRevert(AcquisitionAuthority.AuthorityManifestHashZero.selector);
        new AcquisitionAuthority(
            address(this), bytes32(0), address(0), address(0), address(0), address(0), address(0), address(0)
        );
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes,) = _configured();
        AcquisitionAuthority authority = AcquisitionAuthority(factory.deployNext(initcodes[0]));
        (bool ok,) = address(authority).call(hex"deadbeef");
        assertFalse(ok);
        (ok,) = address(authority).call{value: 1}("");
        assertFalse(ok);
    }

    function test_gasThresholdPredicatesExact() public {
        bytes32[5] memory h =
            [bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)), bytes32(uint256(4)), bytes32(uint256(5))];
        FactoryGasHarness harness =
            new FactoryGasHarness(address(safe), address(registry), address(registry).codehash, GLOBAL_CAP, h, h);
        assertFalse(harness.pre(211_587));
        assertTrue(harness.pre(211_588));
        assertFalse(harness.post(99_999));
        assertTrue(harness.post(100_000));
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryPostCallGasInsufficient.selector,
                uint8(3),
                uint256(211_587),
                uint256(211_588)
            )
        );
        harness.requirePre(3, 211_587);
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryPostCallGasInsufficient.selector,
                uint8(4),
                uint256(99_999),
                uint256(100_000)
            )
        );
        harness.requirePost(4, 99_999);
        harness.requirePre(3, 211_588);
        harness.requirePost(4, 100_000);
    }

    function test_actualFinalizerCallCheckpointAndFailurePrecedence() public {
        FactoryGasHarness seam = _gasHarness();
        FinalizerGasTarget empty = new FinalizerGasTarget(FinalizerGasTarget.Mode.SuccessEmpty);
        FinalizerGasTarget one = new FinalizerGasTarget(FinalizerGasTarget.Mode.SuccessOne);
        FinalizerGasTarget large = new FinalizerGasTarget(FinalizerGasTarget.Mode.SuccessLarge);
        FinalizerGasTarget reverting = new FinalizerGasTarget(FinalizerGasTarget.Mode.RevertLarge);
        FinalizerGasTarget consuming = new FinalizerGasTarget(FinalizerGasTarget.Mode.ConsumeAllowance);

        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryFinalizerCallFailed.selector, uint8(2))
        );
        seam.sharedCall(2, address(reverting), bytes(""));
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryFinalizerReturnLength.selector, uint8(3), uint256(1)
            )
        );
        seam.sharedCall(3, address(one), bytes(""));
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryFinalizerReturnLength.selector, uint8(4), uint256(4096)
            )
        );
        seam.sharedCall(4, address(large), bytes(""));
        assertGe(seam.sharedCall(0, address(empty), bytes("")), 101_588);
        // A cold target that deliberately consumes essentially the complete CALL allowance
        // cannot make the checkpoint silently bypass the reserve rule.
        assertGe(seam.sharedCall{gas: 215_000}(1, address(consuming), bytes("")), 101_588);
    }

    function test_invariantValidationHelpersUseExactProductionErrors() public {
        FactoryGasHarness harness = _gasHarness();
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryChildAddressMismatch.selector,
                uint8(3),
                address(0x1111),
                address(0x2222)
            )
        );
        harness.requireChildAddress(3, address(0x1111), address(0x2222));
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryRuntimeTooLarge.selector, uint8(4), uint256(24_577)
            )
        );
        harness.requireRuntimeSize(4, 24_577);
        harness.requireChildAddress(0, address(0x1111), address(0x1111));
        harness.requireRuntimeSize(0, 24_576);
    }

    function test_absentAndExistingEmptyCodeHashesAreDistinct() public {
        address absent = address(0xA651);
        address empty = address(new Task1Safe());
        vm.etch(empty, bytes(""));
        bytes32 absentHash;
        bytes32 emptyHash;
        assembly {
            absentHash := extcodehash(absent)
            emptyHash := extcodehash(empty)
        }
        assertEq(absentHash, bytes32(0));
        assertEq(emptyHash, keccak256(bytes("")));
    }

    function test_constructorWrongChainWins() public {
        bytes32[5] memory h =
            [bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)), bytes32(uint256(4)), bytes32(uint256(5))];
        vm.chainId(1);
        vm.expectRevert(abi.encodeWithSelector(AcquisitionConstellationFactory.WrongChain.selector, uint256(1)));
        new AcquisitionConstellationFactory(address(0), address(0), bytes32(0), GLOBAL_CAP, h, h);
    }

    function test_constructorLiteralValidationLadder() public {
        bytes32[5] memory h = _nonzeroHashes();
        vm.expectRevert(AcquisitionConstellationFactory.FactorySafeZero.selector);
        new AcquisitionConstellationFactory(address(0), address(registry), address(registry).codehash, GLOBAL_CAP, h, h);
        vm.expectRevert(AcquisitionConstellationFactory.FactoryRegistryZero.selector);
        new AcquisitionConstellationFactory(address(safe), address(0), bytes32(0), GLOBAL_CAP, h, h);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactorySafeCodeMissing.selector, address(0xA11CE))
        );
        new AcquisitionConstellationFactory(
            address(0xA11CE), address(registry), address(registry).codehash, GLOBAL_CAP, h, h
        );
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryRegistryCodeMissing.selector, address(0xB0B))
        );
        new AcquisitionConstellationFactory(address(safe), address(0xB0B), bytes32(0), GLOBAL_CAP, h, h);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryRoleCollision.selector, address(registry))
        );
        new AcquisitionConstellationFactory(
            address(registry), address(registry), address(registry).codehash, GLOBAL_CAP, h, h
        );
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryRegistryRuntimeHashMismatch.selector,
                bytes32(uint256(9)),
                address(registry).codehash
            )
        );
        new AcquisitionConstellationFactory(address(safe), address(registry), bytes32(uint256(9)), GLOBAL_CAP, h, h);
        h[2] = bytes32(0);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryChildInitcodeHashZero.selector, uint8(2))
        );
        new AcquisitionConstellationFactory(
            address(safe), address(registry), address(registry).codehash, GLOBAL_CAP, h, _nonzeroHashes()
        );
        h = _nonzeroHashes();
        bytes32[5] memory runtimeHashes = _nonzeroHashes();
        runtimeHashes[3] = bytes32(0);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryChildRuntimeHashZero.selector, uint8(3))
        );
        new AcquisitionConstellationFactory(
            address(safe), address(registry), address(registry).codehash, GLOBAL_CAP, h, runtimeHashes
        );
    }

    function test_registryCallReturnAndSemanticMatrix() public {
        bytes32[5] memory h = _nonzeroHashes();
        RegistryBehaviorMock reverting = new RegistryBehaviorMock(0);
        vm.expectRevert(AcquisitionConstellationFactory.FactoryRegistryCallFailed.selector);
        new AcquisitionConstellationFactory(
            address(safe), address(reverting), address(reverting).codehash, GLOBAL_CAP, h, h
        );
        uint256[4] memory modes = [uint256(1), uint256(2), uint256(3), uint256(4)];
        uint256[4] memory lengths = [uint256(0), uint256(31), uint256(33), uint256(4096)];
        for (uint256 i; i < 4; ++i) {
            RegistryBehaviorMock malformed = new RegistryBehaviorMock(modes[i]);
            vm.expectRevert(
                abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryRegistryReturnLength.selector, lengths[i])
            );
            new AcquisitionConstellationFactory(
                address(safe), address(malformed), address(malformed).codehash, GLOBAL_CAP, h, h
            );
        }
        RegistryBehaviorMock wrongChain = new RegistryBehaviorMock(5);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.RegistryChainMismatch.selector, uint256(1))
        );
        new AcquisitionConstellationFactory(
            address(safe), address(wrongChain), address(wrongChain).codehash, GLOBAL_CAP, h, h
        );
        RegistryBehaviorMock exhausting = new RegistryBehaviorMock(6);
        vm.expectRevert(AcquisitionConstellationFactory.FactoryRegistryCallFailed.selector);
        new AcquisitionConstellationFactory(
            address(safe), address(exhausting), address(exhausting).codehash, GLOBAL_CAP, h, h
        );
    }

    function test_registryCallbackDuringFactoryConstructionCaughtAndUncaught() public {
        bytes32[5] memory h = _nonzeroHashes();
        uint64 nonce = vm.getNonce(address(this));
        address predictedFactory = vm.computeCreateAddress(address(this), uint256(nonce) + 1);
        RegistryCallbackMock caught = new RegistryCallbackMock(predictedFactory, true);
        AcquisitionConstellationFactory factory = new AcquisitionConstellationFactory(
            address(safe), address(caught), address(caught).codehash, GLOBAL_CAP, h, h
        );
        assertEq(address(factory), predictedFactory);

        nonce = vm.getNonce(address(this));
        predictedFactory = vm.computeCreateAddress(address(this), uint256(nonce) + 1);
        RegistryCallbackMock uncaught = new RegistryCallbackMock(predictedFactory, false);
        vm.expectRevert(AcquisitionConstellationFactory.FactoryRegistryCallFailed.selector);
        new AcquisitionConstellationFactory(
            address(safe), address(uncaught), address(uncaught).codehash, GLOBAL_CAP, h, h
        );
    }

    function test_childConstructorCallbacksCaughtHaveExactPhaseErrors() public {
        (AcquisitionConstellationFactory factory, bytes memory initcode, address child) = _callbackConfigured(true);
        assertEq(factory.deployNext(initcode), child);
        ConstructorCallbackAuthority callbackChild = ConstructorCallbackAuthority(child);
        assertEq(
            callbackChild.deployCallbackResult(),
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryPhaseMismatch.selector, uint8(0), uint8(1))
        );
        assertEq(
            callbackChild.finalizeCallbackResult(),
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryPhaseMismatch.selector, uint8(2), uint8(1))
        );
        (,, uint8 phase, uint8 next,,,,,) = factory.factoryState();
        assertEq(phase, 0);
        assertEq(next, 1);
    }

    function test_childConstructorUncaughtCallbackIsCreateFailureAndRollsBack() public {
        (AcquisitionConstellationFactory factory, bytes memory initcode,) = _callbackConfigured(false);
        vm.expectRevert(abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryCreateFailed.selector, uint8(0)));
        factory.deployNext(initcode);
        (,, uint8 phase, uint8 next,,,,,) = factory.factoryState();
        assertEq(phase, 0);
        assertEq(next, 0);
    }

    function test_finalizationMissingCodeNormalizesBeforeTopologyAndRollsBack() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted) =
            _configured();
        for (uint8 i; i < 5; ++i) {
            factory.deployNext(initcodes[i]);
        }
        vm.etch(predicted[0], bytes(""));
        (, bytes32 expectedHash) = _runtimeCommitment(factory, 0);
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryRuntimeHashMismatch.selector,
                uint8(0),
                expectedHash,
                keccak256(bytes(""))
            )
        );
        factory.finalizeConstellation();
        (,, uint8 phase,,,,,,) = factory.factoryState();
        assertEq(phase, 2);
    }

    function test_readyCountCorruptionUsesExactChildIndexPrecedence() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes,) = _configured();
        for (uint8 i; i < 5; ++i) {
            factory.deployNext(initcodes[i]);
        }
        // slot 15 packs Phase at byte 0 and nextChildIndex at byte 1.
        vm.store(address(factory), bytes32(uint256(15)), bytes32(uint256(2) | (uint256(4) << 8)));
        vm.expectRevert(abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryChildIndex.selector, uint8(4)));
        factory.finalizeConstellation();
    }

    function test_absentChildFinalizationReportsZeroExtcodehash() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted) =
            _configured();
        for (uint8 i; i < 5; ++i) {
            factory.deployNext(initcodes[i]);
        }
        (, bytes32 expectedHash) = _runtimeCommitment(factory, 3);
        vm.etch(predicted[3], bytes(""));
        vm.resetNonce(predicted[3]);
        bytes32 actual;
        address child = predicted[3];
        assembly { actual := extcodehash(child) }
        assertEq(actual, bytes32(0));
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryRuntimeHashMismatch.selector, uint8(3), expectedHash, bytes32(0)
            )
        );
        factory.finalizeConstellation();
    }

    function test_preflightFailureAtEveryChildIndexRollsBackPhaseAndFlags() public {
        for (uint8 failing; failing < 5; ++failing) {
            (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted) =
                _configured();
            for (uint8 i; i < 5; ++i) {
                factory.deployNext(initcodes[i]);
            }
            (bytes32 manifest,,,,,,,,) = factory.factoryState();
            (, bytes32 expectedHash) = _runtimeCommitment(factory, failing);
            vm.etch(predicted[failing], bytes(""));
            vm.expectRevert(
                abi.encodeWithSelector(
                    AcquisitionConstellationFactory.FactoryRuntimeHashMismatch.selector,
                    failing,
                    expectedHash,
                    keccak256(bytes(""))
                )
            );
            factory.finalizeConstellation();
            (,, uint8 phase,,,,,,) = factory.factoryState();
            assertEq(phase, 2);
            for (uint8 i; i < failing; ++i) {
                (address actualFactory, bytes32 actualManifest, bool finalized) = _topology(predicted[i], i);
                assertEq(actualFactory, address(factory));
                assertEq(actualManifest, manifest);
                assertFalse(finalized);
            }
        }
    }

    function test_registryFinalizationRecheckOrderingAndRollback() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted) =
            _configured();
        for (uint8 i; i < 5; ++i) {
            factory.deployNext(initcodes[i]);
        }
        bytes memory selector = abi.encodeWithSelector(Task1Registry.supportedChainId.selector);
        vm.mockCallRevert(address(registry), selector, _bytes(4096));
        vm.expectRevert(AcquisitionConstellationFactory.FactoryRegistryCallFailed.selector);
        factory.finalizeConstellation();
        vm.clearMockedCalls();
        vm.mockCall(address(registry), selector, _bytes(31));
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryRegistryReturnLength.selector, uint256(31))
        );
        factory.finalizeConstellation();
        vm.clearMockedCalls();
        vm.mockCall(address(registry), selector, abi.encode(1));
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.RegistryChainMismatch.selector, uint256(1))
        );
        factory.finalizeConstellation();
        vm.clearMockedCalls();
        (bytes32 manifest,, uint8 phase,,,,,,) = factory.factoryState();
        assertEq(phase, 2);
        _assertTopology(predicted, address(factory), manifest, false);

        bytes32 expected = address(registry).codehash;
        bytes memory registryCode = address(registry).code;
        vm.etch(address(registry), bytes(""));
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryRegistryCodeMissing.selector, address(registry)
            )
        );
        factory.finalizeConstellation();
        vm.etch(address(registry), registryCode);
        vm.etch(address(registry), hex"00");
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryRegistryRuntimeHashMismatch.selector,
                expected,
                address(registry).codehash
            )
        );
        factory.finalizeConstellation();
    }

    function test_postFinalizerTopologyFailureAtEveryPositionRollsBack() public {
        uint8[5] memory order = [uint8(2), uint8(4), uint8(3), uint8(1), uint8(0)];
        for (uint8 kind = 1; kind <= 3; ++kind) {
            for (uint8 position; position < 5; ++position) {
                uint8[5] memory modes;
                uint8 failing = order[position];
                modes[failing] = kind;
                (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory children) =
                    _matrixConfigured(modes, false);
                for (uint8 i; i < 5; ++i) {
                    factory.deployNext(initcodes[i]);
                }
                _mockAuthoritySnapshot(factory, children);
                bytes memory expected;
                if (kind == 1) {
                    expected = abi.encodeWithSelector(
                        AcquisitionConstellationFactory.FactoryTopologyCallFailed.selector, failing
                    );
                } else if (kind == 2) {
                    expected = abi.encodeWithSelector(
                        AcquisitionConstellationFactory.FactoryTopologyReturnLength.selector, failing, uint256(95)
                    );
                } else {
                    expected = abi.encodeWithSelector(
                        AcquisitionConstellationFactory.FactoryFinalizerSemanticMismatch.selector, failing
                    );
                }
                vm.expectRevert(expected);
                factory.finalizeConstellation();
                (bytes32 manifest,, uint8 phase,,,,,,) = factory.factoryState();
                assertEq(phase, 2);
                for (uint8 i; i < 5; ++i) {
                    (address actualFactory, bytes32 actualManifest, bool finalized) = _topology(children[i], i);
                    assertEq(actualFactory, address(factory));
                    assertEq(actualManifest, manifest);
                    assertFalse(finalized);
                }
            }
        }
    }

    function test_actualFinalizerNonzeroReturnLengthsAndRollback() public {
        for (uint8 mode = 5; mode <= 6; ++mode) {
            uint8[5] memory modes;
            modes[2] = mode;
            (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory children) =
                _matrixConfigured(modes, false);
            for (uint8 i; i < 5; ++i) {
                factory.deployNext(initcodes[i]);
            }
            _mockAuthoritySnapshot(factory, children);
            uint256 length = mode == 5 ? 1 : 4096;
            vm.expectRevert(
                abi.encodeWithSelector(
                    AcquisitionConstellationFactory.FactoryFinalizerReturnLength.selector, uint8(2), length
                )
            );
            factory.finalizeConstellation();
            (bytes32 manifest,, uint8 phase,,,,,,) = factory.factoryState();
            assertEq(phase, 2);
            _assertTopology(children, address(factory), manifest, false);
        }
    }

    function test_finalAllFlagsRecheckFailureRollsBackPoisonAndFlags() public {
        uint8[5] memory modes;
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory children) =
            _matrixConfigured(modes, true);
        for (uint8 i; i < 5; ++i) {
            factory.deployNext(initcodes[i]);
        }
        _mockAuthoritySnapshot(factory, children);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryFinalizerSemanticMismatch.selector, uint8(2))
        );
        factory.finalizeConstellation();
        (bytes32 manifest,, uint8 phase,,,,,,) = factory.factoryState();
        assertEq(phase, 2);
        _assertTopology(children, address(factory), manifest, false);
    }

    function test_finalizerFailureAtomicallyRollsBackEveryFlag() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted) =
            _configured();
        for (uint8 i; i < 5; ++i) {
            factory.deployNext(initcodes[i]);
        }
        (bytes32 manifest,,,,,,,,) = factory.factoryState();
        bytes memory callData = abi.encodeWithSelector(PreVoteBudgetBook.finalizeBudgetBook.selector, manifest);
        vm.mockCallRevert(predicted[2], callData, hex"deadbeef");
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryFinalizerCallFailed.selector, uint8(2))
        );
        factory.finalizeConstellation();
        vm.clearMockedCalls();
        _assertTopology(predicted, address(factory), manifest, false);
        (,, uint8 phase,,,,,,) = factory.factoryState();
        assertEq(phase, 2);
    }

    function test_failureAtEveryFinalizerPositionRollsBackAllFlagsAndPhase() public {
        uint8[5] memory order = [uint8(2), uint8(4), uint8(3), uint8(1), uint8(0)];
        for (uint8 position; position < 5; ++position) {
            (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted) =
                _configured();
            for (uint8 i; i < 5; ++i) {
                factory.deployNext(initcodes[i]);
            }
            (bytes32 manifest,,,,,,,,) = factory.factoryState();
            uint8 failing = order[position];
            bytes memory callData = abi.encodeWithSelector(_finalizerSelector(failing), manifest);
            vm.mockCallRevert(predicted[failing], callData, hex"01");
            (bool ok, bytes memory result) =
                address(factory).call(abi.encodeWithSelector(factory.finalizeConstellation.selector));
            assertFalse(ok);
            assertEq(
                result,
                abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryFinalizerCallFailed.selector, failing)
            );
            vm.clearMockedCalls();
            _assertTopology(predicted, address(factory), manifest, false);
            (,, uint8 phase,,,,,,) = factory.factoryState();
            assertEq(phase, 2);
        }
    }

    function test_dirtyTopologyBoolIsSemanticMismatch() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted) =
            _configured();
        for (uint8 i; i < 5; ++i) {
            factory.deployNext(initcodes[i]);
        }
        (bytes32 manifest,,,,,,,,) = factory.factoryState();
        bytes4 selector = AcquisitionAuthority.authorityTopology.selector;
        vm.mockCall(predicted[0], abi.encodeWithSelector(selector), abi.encode(address(factory), manifest, uint256(2)));
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryTopologySemanticMismatch.selector, uint8(0))
        );
        factory.finalizeConstellation();
        vm.clearMockedCalls();
        bytes memory dirtyAddress = abi.encode(address(factory), manifest, false);
        assembly { mstore(add(dirtyAddress, 0x20), or(mload(add(dirtyAddress, 0x20)), shl(200, 1))) }
        vm.mockCall(predicted[0], abi.encodeWithSelector(selector), dirtyAddress);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryTopologySemanticMismatch.selector, uint8(0))
        );
        factory.finalizeConstellation();
    }

    function test_topologyReturnLengthAndCallFailureMatrix() public {
        uint256[4] memory lengths = [uint256(0), uint256(95), uint256(97), uint256(4096)];
        for (uint8 caseIndex; caseIndex < 4; ++caseIndex) {
            (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted) =
                _configured();
            for (uint8 i; i < 5; ++i) {
                factory.deployNext(initcodes[i]);
            }
            vm.mockCall(
                predicted[0],
                abi.encodeWithSelector(AcquisitionAuthority.authorityTopology.selector),
                _bytes(lengths[caseIndex])
            );
            vm.expectRevert(
                abi.encodeWithSelector(
                    AcquisitionConstellationFactory.FactoryTopologyReturnLength.selector, uint8(0), lengths[caseIndex]
                )
            );
            factory.finalizeConstellation();
            vm.clearMockedCalls();
        }
        (AcquisitionConstellationFactory failingFactory, bytes[5] memory codes, address[5] memory children) =
            _configured();
        for (uint8 i; i < 5; ++i) {
            failingFactory.deployNext(codes[i]);
        }
        vm.mockCallRevert(children[0], abi.encodeWithSelector(AcquisitionAuthority.authorityTopology.selector), hex"00");
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryTopologyCallFailed.selector, uint8(0))
        );
        failingFactory.finalizeConstellation();
    }

    function _configured()
        internal
        returns (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted)
    {
        uint64 factoryNonce = vm.getNonce(address(this));
        address predictedFactory = vm.computeCreateAddress(address(this), factoryNonce);
        for (uint8 i; i < 5; ++i) {
            predicted[i] = vm.computeCreateAddress(predictedFactory, uint256(i) + 1);
        }
        bytes32 config =
            keccak256(abi.encode(CONFIG_TAG, uint256(3), address(registry), address(registry).codehash, GLOBAL_CAP));
        bytes32 manifest = _manifest(predictedFactory, config, predicted);
        initcodes[0] = abi.encodePacked(
            type(AcquisitionAuthority).creationCode,
            abi.encode(
                predictedFactory,
                manifest,
                address(safe),
                address(registry),
                predicted[1],
                predicted[2],
                predicted[3],
                predicted[4]
            )
        );
        initcodes[1] = abi.encodePacked(
            type(AcquisitionVaultCore).creationCode,
            abi.encode(
                predictedFactory,
                manifest,
                predicted[0],
                address(registry),
                predicted[2],
                predicted[3],
                predicted[4],
                GLOBAL_CAP
            )
        );
        initcodes[2] = abi.encodePacked(
            type(PreVoteBudgetBook).creationCode,
            abi.encode(predictedFactory, manifest, predicted[0], predicted[1], address(registry))
        );
        initcodes[3] =
            abi.encodePacked(type(AcquisitionIntentExecution).creationCode, abi.encode(predictedFactory, manifest));
        initcodes[4] =
            abi.encodePacked(type(AcquisitionReconciliation).creationCode, abi.encode(predictedFactory, manifest));
        bytes32[5] memory ih;
        bytes32[5] memory rh = _runtimeHashes(predictedFactory, initcodes);
        for (uint8 i; i < 5; ++i) {
            ih[i] = keccak256(initcodes[i]);
        }
        factory = new AcquisitionConstellationFactory(
            address(safe), address(registry), address(registry).codehash, GLOBAL_CAP, ih, rh
        );
        assertEq(address(factory), predictedFactory);
    }

    function _callbackConfigured(bool caught)
        internal
        returns (AcquisitionConstellationFactory factory, bytes memory callbackInitcode, address callbackChild)
    {
        uint64 factoryNonce = vm.getNonce(address(this));
        address predictedFactory = vm.computeCreateAddress(address(this), factoryNonce);
        address[5] memory predicted;
        for (uint8 i; i < 5; ++i) {
            predicted[i] = vm.computeCreateAddress(predictedFactory, uint256(i) + 1);
        }
        bytes32 config =
            keccak256(abi.encode(CONFIG_TAG, uint256(3), address(registry), address(registry).codehash, GLOBAL_CAP));
        bytes32 manifest = _manifest(predictedFactory, config, predicted);
        callbackInitcode = abi.encodePacked(
            type(ConstructorCallbackAuthority).creationCode, abi.encode(predictedFactory, manifest, caught)
        );
        bytes32[5] memory ih = _nonzeroHashes();
        bytes32[5] memory rh = _nonzeroHashes();
        ih[0] = keccak256(callbackInitcode);
        rh[0] = keccak256(type(ConstructorCallbackAuthority).runtimeCode);
        factory = new AcquisitionConstellationFactory(
            address(safe), address(registry), address(registry).codehash, GLOBAL_CAP, ih, rh
        );
        callbackChild = predicted[0];
    }

    function _matrixConfigured(uint8[5] memory modes, bool poison)
        internal
        returns (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted)
    {
        uint64 factoryNonce = vm.getNonce(address(this));
        address predictedFactory = vm.computeCreateAddress(address(this), factoryNonce);
        for (uint8 i; i < 5; ++i) {
            predicted[i] = vm.computeCreateAddress(predictedFactory, uint256(i) + 1);
        }
        bytes32 config =
            keccak256(abi.encode(CONFIG_TAG, uint256(3), address(registry), address(registry).codehash, GLOBAL_CAP));
        bytes32 manifest = _manifest(predictedFactory, config, predicted);
        if (poison) modes[4] = 4;
        for (uint8 i; i < 5; ++i) {
            address poisonTarget = i == 2 ? predicted[4] : (i == 4 ? predicted[2] : address(0));
            initcodes[i] = abi.encodePacked(
                type(MatrixChild).creationCode, abi.encode(predictedFactory, manifest, i, modes[i], poisonTarget)
            );
        }
        bytes32[5] memory ih;
        bytes32[5] memory rh;
        bytes32 runtimeHash = keccak256(type(MatrixChild).runtimeCode);
        for (uint8 i; i < 5; ++i) {
            ih[i] = keccak256(initcodes[i]);
            rh[i] = runtimeHash;
        }
        factory = new AcquisitionConstellationFactory(
            address(safe), address(registry), address(registry).codehash, GLOBAL_CAP, ih, rh
        );
        assertEq(address(factory), predictedFactory);
    }

    function _nonzeroHashes() internal pure returns (bytes32[5] memory h) {
        h = [bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)), bytes32(uint256(4)), bytes32(uint256(5))];
    }

    function _runtimeHashes(address predictedFactory, bytes[5] memory initcodes)
        internal
        returns (bytes32[5] memory runtimeHashes)
    {
        uint256 clean = vm.snapshotState();
        vm.etch(predictedFactory, type(Task1RuntimeProbe).runtimeCode);
        vm.setNonce(predictedFactory, 1);
        for (uint8 i; i < 5; ++i) {
            address child = Task1RuntimeProbe(predictedFactory).deploy(initcodes[i]);
            assertEq(child, vm.computeCreateAddress(predictedFactory, uint256(i) + 1));
            runtimeHashes[i] = child.codehash;
        }
        assertTrue(vm.revertToState(clean));
    }

    function _mockAuthoritySnapshot(AcquisitionConstellationFactory factory, address[5] memory predicted) internal {
        bytes32 manifest;
        uint256 globalCap;
        (manifest,,,,,,,, globalCap) = factory.factoryState();
        uint256[27] memory words;
        words[0] = 2;
        words[1] = uint160(address(factory));
        words[2] = uint256(manifest);
        words[3] = uint160(address(registry));
        words[4] = uint160(predicted[1]);
        words[5] = uint160(predicted[2]);
        words[6] = uint160(predicted[3]);
        words[7] = uint160(predicted[4]);
        words[9] = uint160(address(safe));
        words[11] = 1;
        words[24] = uint256(
            keccak256(
                abi.encode(bytes32(0), uint256(0), address(0), address(0), uint64(0), uint64(0), uint64(0), bytes32(0))
            )
        );
        words[26] = uint256(
            keccak256(
                abi.encode(
                    bytes32(0),
                    uint256(0),
                    address(0),
                    address(0),
                    bytes32(0),
                    uint256(0),
                    uint256(0),
                    uint256(0),
                    bytes32(0),
                    uint64(0),
                    uint64(0),
                    uint64(0),
                    bytes32(0)
                )
            )
        );
        vm.mockCall(
            predicted[0],
            abi.encodeWithSelector(AcquisitionAuthority.authoritySnapshot.selector),
            abi.encodePacked(words)
        );

        uint256[18] memory coreWords;
        coreWords[0] = 3;
        coreWords[1] = uint160(address(factory));
        coreWords[2] = uint256(manifest);
        coreWords[3] = uint160(predicted[0]);
        coreWords[4] = uint160(address(registry));
        coreWords[5] = uint160(predicted[2]);
        coreWords[6] = uint160(predicted[3]);
        coreWords[7] = uint160(predicted[4]);
        coreWords[9] = globalCap;
        vm.mockCall(
            predicted[1],
            abi.encodeWithSelector(AcquisitionVaultCore.coreSnapshot.selector),
            abi.encodePacked(coreWords)
        );
    }

    function _gasHarness() internal returns (FactoryGasHarness harness) {
        bytes32[5] memory h = _nonzeroHashes();
        harness = new FactoryGasHarness(address(safe), address(registry), address(registry).codehash, GLOBAL_CAP, h, h);
    }

    function _topology(address child, uint8 index) internal view returns (address, bytes32, bool) {
        if (index == 0) return AcquisitionAuthority(child).authorityTopology();
        if (index == 1) return AcquisitionVaultCore(child).coreTopology();
        if (index == 2) return PreVoteBudgetBook(child).budgetBookTopology();
        if (index == 3) return AcquisitionIntentExecution(child).intentExecutionTopology();
        return AcquisitionReconciliation(child).reconciliationTopology();
    }

    function _runtimeCommitment(AcquisitionConstellationFactory factory, uint8 index)
        internal
        view
        returns (address child, bytes32 runtimeHash)
    {
        bytes32 ignored;
        (child, ignored, runtimeHash) = factory.childCommitment(index);
    }

    function _finalizerSelector(uint8 index) internal pure returns (bytes4) {
        if (index == 0) return AcquisitionAuthority.finalizeAuthority.selector;
        if (index == 1) return AcquisitionVaultCore.finalizeCore.selector;
        if (index == 2) return PreVoteBudgetBook.finalizeBudgetBook.selector;
        if (index == 3) return AcquisitionIntentExecution.finalizeIntentExecution.selector;
        return AcquisitionReconciliation.finalizeReconciliation.selector;
    }

    function _bytes(uint256 length) internal pure returns (bytes memory out) {
        out = new bytes(length);
    }

    function _manifest(address factory, bytes32 config, address[5] memory predicted) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                CONSTELLATION_TAG,
                uint256(4663),
                factory,
                address(safe),
                config,
                address(registry),
                address(registry).codehash,
                predicted[0],
                predicted[1],
                predicted[2],
                predicted[3],
                predicted[4]
            )
        );
    }

    function _assertTopology(address[5] memory children, address factory, bytes32 manifest, bool finalized)
        internal
        view
    {
        _assertTopologyCall(children[0], bytes4(keccak256("authorityTopology()")), factory, manifest, finalized);
        _assertTopologyCall(children[1], bytes4(keccak256("coreTopology()")), factory, manifest, finalized);
        _assertTopologyCall(children[2], bytes4(keccak256("budgetBookTopology()")), factory, manifest, finalized);
        _assertTopologyCall(children[3], bytes4(keccak256("intentExecutionTopology()")), factory, manifest, finalized);
        _assertTopologyCall(children[4], bytes4(keccak256("reconciliationTopology()")), factory, manifest, finalized);
    }

    function _assertTopologyCall(address child, bytes4 selector, address factory, bytes32 manifest, bool finalized)
        internal
        view
    {
        (bool ok, bytes memory data) = child.staticcall(abi.encodeWithSelector(selector));
        assertTrue(ok);
        (address actualFactory, bytes32 actualManifest, bool actualFinalized) =
            abi.decode(data, (address, bytes32, bool));
        assertEq(actualFactory, factory);
        assertEq(actualManifest, manifest);
        assertEq(actualFinalized, finalized);
    }
}
