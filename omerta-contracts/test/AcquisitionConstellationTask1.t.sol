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
    function hashes(address factory, bytes32 manifest) external returns (bytes32[5] memory h) {
        h[0] = address(new AcquisitionAuthority(factory, manifest)).codehash;
        h[1] = address(new AcquisitionVaultCore(factory, manifest)).codehash;
        h[2] = address(new PreVoteBudgetBook(factory, manifest)).codehash;
        h[3] = address(new AcquisitionIntentExecution(factory, manifest)).codehash;
        h[4] = address(new AcquisitionReconciliation(factory, manifest)).codehash;
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
    constructor(address safe, address registry, bytes32 registryHash, bytes32[5] memory ih, bytes32[5] memory rh)
        AcquisitionConstellationFactory(safe, registry, registryHash, ih, rh)
    {}

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
}

contract AcquisitionConstellationTask1Test is Test {
    bytes32 internal constant CONFIG_TAG = keccak256("OMERTA_ACQUISITION_TASK1_CONFIG_V1");
    bytes32 internal constant CONSTELLATION_TAG = keccak256("OMERTA_ACQUISITION_CONSTELLATION_V1");
    bytes32 internal constant DEPLOYMENT_TAG = keccak256("OMERTA_ACQUISITION_DEPLOYMENT_V1");

    Task1Safe internal safe;
    Task1Registry internal registry;
    Task1RuntimeProbe internal probe;

    function setUp() public {
        vm.chainId(4663);
        safe = new Task1Safe();
        registry = new Task1Registry(4663);
        probe = new Task1RuntimeProbe();
    }

    function test_exactLifecycleCommitmentsPredictionsAndFinalizerOrder() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted) =
            _configured();
        (bytes32 manifest, bytes32 deployment) = _assertInitial(factory, predicted);
        for (uint8 i; i < 5; ++i) {
            assertEq(factory.deployNext(initcodes[i]), predicted[i]);
        }
        _assertDeploymentCommitment(factory, initcodes, manifest, deployment);
        (,, uint8 phase, uint8 next,,,,) = factory.factoryState();
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
        (,, phase,,,,,) = factory.factoryState();
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
        (manifest, deployment, phase, next, actualSafe, config,,) = factory.factoryState();
        assertEq(phase, 0);
        assertEq(next, 0);
        assertEq(actualSafe, address(safe));
        bytes32 expectedConfig =
            keccak256(abi.encode(CONFIG_TAG, uint256(1), address(registry), address(registry).codehash));
        assertEq(config, expectedConfig);
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
        (,, uint8 phase, uint8 next,,,,) = factory.factoryState();
        assertEq(phase, 0);
        assertEq(next, 0);
    }

    function test_finalizerPrecedenceUnauthorizedThenHashThenAlready() public {
        bytes32 manifest = keccak256("manifest");
        AcquisitionAuthority authority = new AcquisitionAuthority(address(this), manifest);
        vm.prank(address(0xBAD));
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionAuthority.AuthorityFinalizerUnauthorized.selector, address(0xBAD))
        );
        authority.finalizeAuthority(bytes32(0));
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionAuthority.AuthorityManifestHashMismatch.selector, manifest, bytes32(0))
        );
        authority.finalizeAuthority(bytes32(0));
        authority.finalizeAuthority(manifest);
        vm.expectRevert(AcquisitionAuthority.AuthorityAlreadyFinalized.selector);
        authority.finalizeAuthority(manifest);
    }

    function test_childConstructorPrecedenceAndNoFallbackReceive() public {
        vm.expectRevert(AcquisitionAuthority.AuthorityFactoryZero.selector);
        new AcquisitionAuthority(address(0), bytes32(0));
        vm.expectRevert(AcquisitionAuthority.AuthorityManifestHashZero.selector);
        new AcquisitionAuthority(address(this), bytes32(0));
        AcquisitionAuthority authority = new AcquisitionAuthority(address(this), bytes32(uint256(1)));
        (bool ok,) = address(authority).call(hex"deadbeef");
        assertFalse(ok);
        (ok,) = address(authority).call{value: 1}("");
        assertFalse(ok);
    }

    function test_gasThresholdPredicatesExact() public {
        bytes32[5] memory h =
            [bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)), bytes32(uint256(4)), bytes32(uint256(5))];
        FactoryGasHarness harness =
            new FactoryGasHarness(address(safe), address(registry), address(registry).codehash, h, h);
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

    function test_constructorWrongChainWins() public {
        bytes32[5] memory h =
            [bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)), bytes32(uint256(4)), bytes32(uint256(5))];
        vm.chainId(1);
        vm.expectRevert(abi.encodeWithSelector(AcquisitionConstellationFactory.WrongChain.selector, uint256(1)));
        new AcquisitionConstellationFactory(address(0), address(0), bytes32(0), h, h);
    }

    function test_constructorLiteralValidationLadder() public {
        bytes32[5] memory h = _nonzeroHashes();
        vm.expectRevert(AcquisitionConstellationFactory.FactorySafeZero.selector);
        new AcquisitionConstellationFactory(address(0), address(registry), address(registry).codehash, h, h);
        vm.expectRevert(AcquisitionConstellationFactory.FactoryRegistryZero.selector);
        new AcquisitionConstellationFactory(address(safe), address(0), bytes32(0), h, h);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactorySafeCodeMissing.selector, address(0xA11CE))
        );
        new AcquisitionConstellationFactory(address(0xA11CE), address(registry), address(registry).codehash, h, h);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryRegistryCodeMissing.selector, address(0xB0B))
        );
        new AcquisitionConstellationFactory(address(safe), address(0xB0B), bytes32(0), h, h);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryRoleCollision.selector, address(registry))
        );
        new AcquisitionConstellationFactory(address(registry), address(registry), address(registry).codehash, h, h);
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryRegistryRuntimeHashMismatch.selector,
                bytes32(uint256(9)),
                address(registry).codehash
            )
        );
        new AcquisitionConstellationFactory(address(safe), address(registry), bytes32(uint256(9)), h, h);
        h[2] = bytes32(0);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryChildInitcodeHashZero.selector, uint8(2))
        );
        new AcquisitionConstellationFactory(
            address(safe), address(registry), address(registry).codehash, h, _nonzeroHashes()
        );
        h = _nonzeroHashes();
        bytes32[5] memory runtimeHashes = _nonzeroHashes();
        runtimeHashes[3] = bytes32(0);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryChildRuntimeHashZero.selector, uint8(3))
        );
        new AcquisitionConstellationFactory(
            address(safe), address(registry), address(registry).codehash, h, runtimeHashes
        );
    }

    function test_registryCallReturnAndSemanticMatrix() public {
        bytes32[5] memory h = _nonzeroHashes();
        RegistryBehaviorMock reverting = new RegistryBehaviorMock(0);
        vm.expectRevert(AcquisitionConstellationFactory.FactoryRegistryCallFailed.selector);
        new AcquisitionConstellationFactory(address(safe), address(reverting), address(reverting).codehash, h, h);
        uint256[4] memory modes = [uint256(1), uint256(2), uint256(3), uint256(4)];
        uint256[4] memory lengths = [uint256(0), uint256(31), uint256(33), uint256(4096)];
        for (uint256 i; i < 4; ++i) {
            RegistryBehaviorMock malformed = new RegistryBehaviorMock(modes[i]);
            vm.expectRevert(
                abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryRegistryReturnLength.selector, lengths[i])
            );
            new AcquisitionConstellationFactory(address(safe), address(malformed), address(malformed).codehash, h, h);
        }
        RegistryBehaviorMock wrongChain = new RegistryBehaviorMock(5);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.RegistryChainMismatch.selector, uint256(1))
        );
        new AcquisitionConstellationFactory(address(safe), address(wrongChain), address(wrongChain).codehash, h, h);
        RegistryBehaviorMock exhausting = new RegistryBehaviorMock(6);
        vm.expectRevert(AcquisitionConstellationFactory.FactoryRegistryCallFailed.selector);
        new AcquisitionConstellationFactory(address(safe), address(exhausting), address(exhausting).codehash, h, h);
    }

    function test_registryCallbackDuringFactoryConstructionCaughtAndUncaught() public {
        bytes32[5] memory h = _nonzeroHashes();
        uint64 nonce = vm.getNonce(address(this));
        address predictedFactory = vm.computeCreateAddress(address(this), uint256(nonce) + 1);
        RegistryCallbackMock caught = new RegistryCallbackMock(predictedFactory, true);
        AcquisitionConstellationFactory factory =
            new AcquisitionConstellationFactory(address(safe), address(caught), address(caught).codehash, h, h);
        assertEq(address(factory), predictedFactory);

        nonce = vm.getNonce(address(this));
        predictedFactory = vm.computeCreateAddress(address(this), uint256(nonce) + 1);
        RegistryCallbackMock uncaught = new RegistryCallbackMock(predictedFactory, false);
        vm.expectRevert(AcquisitionConstellationFactory.FactoryRegistryCallFailed.selector);
        new AcquisitionConstellationFactory(address(safe), address(uncaught), address(uncaught).codehash, h, h);
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
        (,, uint8 phase, uint8 next,,,,) = factory.factoryState();
        assertEq(phase, 0);
        assertEq(next, 1);
    }

    function test_childConstructorUncaughtCallbackIsCreateFailureAndRollsBack() public {
        (AcquisitionConstellationFactory factory, bytes memory initcode,) = _callbackConfigured(false);
        vm.expectRevert(abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryCreateFailed.selector, uint8(0)));
        factory.deployNext(initcode);
        (,, uint8 phase, uint8 next,,,,) = factory.factoryState();
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
        (,, uint8 phase,,,,,) = factory.factoryState();
        assertEq(phase, 2);
    }

    function test_finalizerFailureAtomicallyRollsBackEveryFlag() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted) =
            _configured();
        for (uint8 i; i < 5; ++i) {
            factory.deployNext(initcodes[i]);
        }
        (bytes32 manifest,,,,,,,) = factory.factoryState();
        bytes memory callData = abi.encodeWithSelector(PreVoteBudgetBook.finalizeBudgetBook.selector, manifest);
        vm.mockCallRevert(predicted[2], callData, hex"deadbeef");
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryFinalizerCallFailed.selector, uint8(2))
        );
        factory.finalizeConstellation();
        vm.clearMockedCalls();
        _assertTopology(predicted, address(factory), manifest, false);
        (,, uint8 phase,,,,,) = factory.factoryState();
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
            (bytes32 manifest,,,,,,,) = factory.factoryState();
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
            (,, uint8 phase,,,,,) = factory.factoryState();
            assertEq(phase, 2);
        }
    }

    function test_dirtyTopologyBoolIsSemanticMismatch() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes, address[5] memory predicted) =
            _configured();
        for (uint8 i; i < 5; ++i) {
            factory.deployNext(initcodes[i]);
        }
        (bytes32 manifest,,,,,,,) = factory.factoryState();
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
        bytes32 config = keccak256(abi.encode(CONFIG_TAG, uint256(1), address(registry), address(registry).codehash));
        bytes32 manifest = _manifest(predictedFactory, config, predicted);
        initcodes[0] = abi.encodePacked(type(AcquisitionAuthority).creationCode, abi.encode(predictedFactory, manifest));
        initcodes[1] = abi.encodePacked(type(AcquisitionVaultCore).creationCode, abi.encode(predictedFactory, manifest));
        initcodes[2] = abi.encodePacked(type(PreVoteBudgetBook).creationCode, abi.encode(predictedFactory, manifest));
        initcodes[3] =
            abi.encodePacked(type(AcquisitionIntentExecution).creationCode, abi.encode(predictedFactory, manifest));
        initcodes[4] =
            abi.encodePacked(type(AcquisitionReconciliation).creationCode, abi.encode(predictedFactory, manifest));
        bytes32[5] memory ih;
        bytes32[5] memory rh = probe.hashes(predictedFactory, manifest);
        for (uint8 i; i < 5; ++i) {
            ih[i] = keccak256(initcodes[i]);
        }
        factory =
            new AcquisitionConstellationFactory(address(safe), address(registry), address(registry).codehash, ih, rh);
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
        bytes32 config = keccak256(abi.encode(CONFIG_TAG, uint256(1), address(registry), address(registry).codehash));
        bytes32 manifest = _manifest(predictedFactory, config, predicted);
        callbackInitcode = abi.encodePacked(
            type(ConstructorCallbackAuthority).creationCode, abi.encode(predictedFactory, manifest, caught)
        );
        bytes32[5] memory ih = _nonzeroHashes();
        bytes32[5] memory rh = _nonzeroHashes();
        ih[0] = keccak256(callbackInitcode);
        rh[0] = keccak256(type(ConstructorCallbackAuthority).runtimeCode);
        factory =
            new AcquisitionConstellationFactory(address(safe), address(registry), address(registry).codehash, ih, rh);
        callbackChild = predicted[0];
    }

    function _nonzeroHashes() internal pure returns (bytes32[5] memory h) {
        h = [bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)), bytes32(uint256(4)), bytes32(uint256(5))];
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
