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
import {Task1Safe, Task1Registry, Task1RuntimeProbe} from "./AcquisitionConstellationTask1.t.sol";

contract MaliciousSnapshotAuthority {
    address internal _factory;
    bytes32 internal _manifest;
    bool internal _finalized;
    uint8 internal _mode;
    uint256[27] internal _words;

    constructor(address factory, bytes32 manifest) {
        _factory = factory;
        _manifest = manifest;
    }

    function setMode(uint8 mode) external {
        _mode = mode;
    }

    function setWord(uint8 field, uint256 value) external {
        _words[field] = value;
    }

    function word(uint8 field) external view returns (uint256) {
        return _words[field];
    }

    function authorityTopology() external view returns (address, bytes32, bool) {
        return (_factory, _manifest, _finalized);
    }

    function finalizeAuthority(bytes32 manifest) external {
        require(msg.sender == _factory && manifest == _manifest && !_finalized);
        _finalized = true;
    }

    fallback() external {
        require(msg.sig == bytes4(keccak256("authoritySnapshot()")));
        uint8 mode = _mode;
        if (mode == 1) revert();
        if (mode == 2) assembly { for {} 1 {} {} }
        if (mode == 6) assembly { revert(0, 4096) }
        uint256 length = mode == 3 ? 863 : mode == 4 ? 865 : mode == 5 ? 4096 : 864;
        assembly ("memory-safe") {
            let output := mload(0x40)
            for { let i := 0 } lt(i, 27) { i := add(i, 1) } {
                mstore(add(output, mul(i, 0x20)), sload(add(_words.slot, i)))
            }
            return(output, length)
        }
    }
}

contract SnapshotForceEther {
    constructor(address payable target) payable {
        selfdestruct(target);
    }
}

contract SnapshotAuthorityDeployer {
    function deploy(
        bytes32 manifest,
        address safe,
        address registry,
        address core,
        address budget,
        address intent,
        address reconciliation
    ) external returns (AcquisitionAuthority) {
        return new AcquisitionAuthority(address(this), manifest, safe, registry, core, budget, intent, reconciliation);
    }
}

contract AcquisitionAuthoritySnapshotTask2Test is Test {
    uint256 internal constant GLOBAL_CAP = 3 ether;
    bytes32 internal constant CONFIG_TAG = keccak256("OMERTA_ACQUISITION_TASK3_CONFIG_V1");
    bytes32 internal constant CONSTELLATION_TAG = keccak256("OMERTA_ACQUISITION_CONSTELLATION_V1");

    Task1Safe internal safe;
    Task1Registry internal registry;
    mapping(address factory => bytes32 manifest) internal _expectedManifest;
    mapping(address factory => bytes32 deployment) internal _expectedDeployment;

    function setUp() public {
        vm.chainId(4663);
        safe = new Task1Safe();
        registry = new Task1Registry(4663);
    }

    function test_snapshotCallOogAndReturnLengthMatrixIsAtomic() public {
        (AcquisitionConstellationFactory factory, MaliciousSnapshotAuthority authority, address[5] memory children) =
            _ready();
        uint256[5] memory expectedLengths = [uint256(0), 0, 863, 865, 4096];
        for (uint8 mode = 1; mode <= 6; ++mode) {
            authority.setMode(mode);
            vm.recordLogs();
            if (mode <= 2 || mode == 6) {
                vm.expectRevert(AcquisitionConstellationFactory.FactoryAuthoritySnapshotCallFailed.selector);
            } else {
                vm.expectRevert(
                    abi.encodeWithSelector(
                        AcquisitionConstellationFactory.FactoryAuthoritySnapshotReturnLength.selector,
                        expectedLengths[mode - 1]
                    )
                );
            }
            factory.finalizeConstellation();
            assertEq(vm.getRecordedLogs().length, 0);
            _assertReadyAndUnfinalized(factory, children);
        }
        authority.setMode(0);
        factory.finalizeConstellation();
        (,, uint8 phase,,,,,,) = factory.factoryState();
        assertEq(phase, 4);
    }

    function test_snapshotEveryOrdinalAndMultipleMutationPrecedenceIsExact() public {
        (AcquisitionConstellationFactory factory, MaliciousSnapshotAuthority authority, address[5] memory children) =
            _ready();
        uint256 registryWord = authority.word(3);
        for (uint8 field; field < 27; ++field) {
            uint256 original = authority.word(field);
            authority.setWord(field, original ^ 1);
            vm.recordLogs();
            vm.expectRevert(
                abi.encodeWithSelector(
                    AcquisitionConstellationFactory.FactoryAuthoritySnapshotSemanticMismatch.selector, field
                )
            );
            factory.finalizeConstellation();
            assertEq(vm.getRecordedLogs().length, 0);
            _assertReadyAndUnfinalized(factory, children);
            authority.setWord(field, original);
        }
        authority.setWord(19, 1);
        authority.setWord(3, 1);
        authority.setWord(0, 3);
        vm.recordLogs();
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryAuthoritySnapshotSemanticMismatch.selector, 0)
        );
        factory.finalizeConstellation();
        assertEq(vm.getRecordedLogs().length, 0);
        _assertReadyAndUnfinalized(factory, children);
        authority.setWord(0, 2);
        vm.recordLogs();
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionConstellationFactory.FactoryAuthoritySnapshotSemanticMismatch.selector, 3)
        );
        factory.finalizeConstellation();
        assertEq(vm.getRecordedLogs().length, 0);
        _assertReadyAndUnfinalized(factory, children);
        authority.setWord(19, 0);
        authority.setWord(3, registryWord);
        factory.finalizeConstellation();
        (,, uint8 phase,,,,,,) = factory.factoryState();
        assertEq(phase, 4);
    }

    function test_snapshotEveryAdjacentOrdinalPrecedenceEdgeIsExactAndAtomic() public {
        (AcquisitionConstellationFactory factory, MaliciousSnapshotAuthority authority, address[5] memory children) =
            _ready();
        uint256[27] memory valid;
        for (uint8 field; field < 27; ++field) {
            valid[field] = authority.word(field);
            authority.setWord(field, valid[field] ^ 1);
        }
        for (uint8 expected; expected < 27; ++expected) {
            vm.recordLogs();
            vm.expectRevert(
                abi.encodeWithSelector(
                    AcquisitionConstellationFactory.FactoryAuthoritySnapshotSemanticMismatch.selector, expected
                )
            );
            factory.finalizeConstellation();
            assertEq(vm.getRecordedLogs().length, 0);
            _assertReadyAndUnfinalized(factory, children);
            authority.setWord(expected, valid[expected]);
        }
        factory.finalizeConstellation();
        (,, uint8 phase,,,,,,) = factory.factoryState();
        assertEq(phase, 4);
    }

    function test_snapshotCanonicalAddressBoolAndTypedZeroValidation() public {
        (AcquisitionConstellationFactory factory, MaliciousSnapshotAuthority authority, address[5] memory children) =
            _ready();
        uint8[11] memory addressFields = [uint8(1), 3, 4, 5, 6, 7, 9, 10, 12, 13, 21];
        for (uint256 i; i < addressFields.length; ++i) {
            uint8 field = addressFields[i];
            uint256 original = authority.word(field);
            authority.setWord(field, original | (uint256(1) << 160));
            vm.recordLogs();
            vm.expectRevert(
                abi.encodeWithSelector(
                    AcquisitionConstellationFactory.FactoryAuthoritySnapshotSemanticMismatch.selector, field
                )
            );
            factory.finalizeConstellation();
            assertEq(vm.getRecordedLogs().length, 0);
            _assertReadyAndUnfinalized(factory, children);
            authority.setWord(field, original);
        }
        uint8[2] memory boolFields = [uint8(8), 11];
        for (uint256 i; i < boolFields.length; ++i) {
            for (uint256 dirtyBool = 2; dirtyBool <= type(uint256).max; dirtyBool = type(uint256).max) {
                authority.setWord(boolFields[i], dirtyBool);
                vm.recordLogs();
                vm.expectRevert(
                    abi.encodeWithSelector(
                        AcquisitionConstellationFactory.FactoryAuthoritySnapshotSemanticMismatch.selector, boolFields[i]
                    )
                );
                factory.finalizeConstellation();
                assertEq(vm.getRecordedLogs().length, 0);
                _assertReadyAndUnfinalized(factory, children);
                if (dirtyBool == type(uint256).max) break;
            }
            authority.setWord(boolFields[i], boolFields[i] == 11 ? 1 : 0);
        }
        authority.setWord(20, uint256(1) << 200);
        vm.recordLogs();
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionConstellationFactory.FactoryAuthoritySnapshotSemanticMismatch.selector, 20
            )
        );
        factory.finalizeConstellation();
        assertEq(vm.getRecordedLogs().length, 0);
        _assertReadyAndUnfinalized(factory, children);
        authority.setWord(20, 0);
        factory.finalizeConstellation();
        (,, uint8 phase,,,,,,) = factory.factoryState();
        assertEq(phase, 4);
    }

    function test_snapshotEmptyHashesAreIndependentAndColdSuccessFitsCap() public {
        (AcquisitionConstellationFactory factory, MaliciousSnapshotAuthority authority,) = _ready();
        bytes32 operatorHash = keccak256(
            abi.encode(bytes32(0), uint256(0), address(0), address(0), uint64(0), uint64(0), uint64(0), bytes32(0))
        );
        bytes32 ingressHash = keccak256(
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
        );
        assertEq(bytes32(authority.word(24)), operatorHash);
        assertEq(bytes32(authority.word(26)), ingressHash);
        _cool(address(authority));
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) =
            address(authority).staticcall{gas: 160_000}(abi.encodeWithSignature("authoritySnapshot()"));
        uint256 consumed = beforeGas - gasleft();
        assertTrue(ok);
        assertEq(result.length, 864);
        assertLe(consumed, 160_000);
        vm.expectCall(address(authority), 0, uint64(160_000), abi.encodeWithSignature("authoritySnapshot()"));
        factory.finalizeConstellation();
    }

    function test_compiledProductionSnapshotColdPathFitsCapAndFactoryCapIsBuildBound() public {
        SnapshotAuthorityDeployer deployer = new SnapshotAuthorityDeployer();
        address predictedAuthority = vm.computeCreateAddress(address(deployer), 1);
        address predictedCore = vm.computeCreateAddress(address(deployer), 2);
        address predictedBudget = vm.computeCreateAddress(address(deployer), 3);
        address predictedIntent = vm.computeCreateAddress(address(deployer), 4);
        address predictedReconciliation = vm.computeCreateAddress(address(deployer), 5);
        AcquisitionAuthority authority = deployer.deploy(
            keccak256("snapshot-cap-manifest"),
            address(safe),
            address(registry),
            predictedCore,
            predictedBudget,
            predictedIntent,
            predictedReconciliation
        );
        assertEq(address(authority), predictedAuthority);
        _cool(address(authority));
        (bool ok, bytes memory result) = address(authority).staticcall{gas: 160_000}(
            abi.encodeWithSelector(AcquisitionAuthority.authoritySnapshot.selector)
        );
        assertTrue(ok);
        assertEq(result.length, 864);

        string memory source = vm.readFile("src/AcquisitionConstellationFactory.sol");
        assertTrue(_contains(source, "uint256 private constant _AUTHORITY_SNAPSHOT_GAS = 160_000;"));
        assertTrue(_contains(source, "staticcall(_AUTHORITY_SNAPSHOT_GAS, authority, buffer, 0x04, buffer, 0x360)"));
    }

    function test_snapshotRealPathForcedEtherIsInert() public {
        (AcquisitionConstellationFactory factory,, address[5] memory children) = _ready();
        new SnapshotForceEther{value: 1 ether}(payable(address(factory)));
        for (uint8 i; i < 5; ++i) {
            new SnapshotForceEther{value: i + 1}(payable(children[i]));
        }
        factory.finalizeConstellation();
        assertEq(address(factory).balance, 1 ether);
        for (uint8 i; i < 5; ++i) {
            assertEq(children[i].balance, i + 1);
        }
    }

    function _ready()
        internal
        returns (
            AcquisitionConstellationFactory factory,
            MaliciousSnapshotAuthority authority,
            address[5] memory predicted
        )
    {
        uint64 nonce = vm.getNonce(address(this));
        address predictedFactory = vm.computeCreateAddress(address(this), nonce);
        for (uint8 i; i < 5; ++i) {
            predicted[i] = vm.computeCreateAddress(predictedFactory, uint256(i) + 1);
        }
        bytes32 config =
            keccak256(abi.encode(CONFIG_TAG, uint256(3), address(registry), address(registry).codehash, GLOBAL_CAP));
        bytes32 manifest = keccak256(
            abi.encode(
                CONSTELLATION_TAG,
                uint256(4663),
                predictedFactory,
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
        bytes[5] memory initcodes;
        initcodes[0] =
            abi.encodePacked(type(MaliciousSnapshotAuthority).creationCode, abi.encode(predictedFactory, manifest));
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
        initcodes[3] = abi.encodePacked(
            type(AcquisitionIntentExecution).creationCode, abi.encode(predictedFactory, manifest, predicted[1])
        );
        initcodes[4] =
            abi.encodePacked(type(AcquisitionReconciliation).creationCode, abi.encode(predictedFactory, manifest));
        bytes32[5] memory initHashes;
        bytes32[5] memory runtimeHashes = _runtimeHashes(predictedFactory, initcodes);
        for (uint8 i; i < 5; ++i) {
            initHashes[i] = keccak256(initcodes[i]);
        }
        factory = new AcquisitionConstellationFactory(
            address(safe), address(registry), address(registry).codehash, GLOBAL_CAP, initHashes, runtimeHashes
        );
        (bytes32 committedManifest, bytes32 deployment,,,,,,,) = factory.factoryState();
        _expectedManifest[address(factory)] = committedManifest;
        _expectedDeployment[address(factory)] = deployment;
        for (uint8 i; i < 5; ++i) {
            assertEq(factory.deployNext(initcodes[i]), predicted[i]);
        }
        authority = MaliciousSnapshotAuthority(predicted[0]);
        _setValidWords(factory, authority, predicted, manifest);
    }

    function _setValidWords(
        AcquisitionConstellationFactory factory,
        MaliciousSnapshotAuthority authority,
        address[5] memory predicted,
        bytes32 manifest
    ) internal {
        authority.setWord(0, 2);
        authority.setWord(1, uint160(address(factory)));
        authority.setWord(2, uint256(manifest));
        authority.setWord(3, uint160(address(registry)));
        for (uint8 i = 1; i < 5; ++i) {
            authority.setWord(i + 3, uint160(predicted[i]));
        }
        authority.setWord(9, uint160(address(safe)));
        authority.setWord(11, 1);
        authority.setWord(
            24,
            uint256(
                keccak256(
                    abi.encode(
                        bytes32(0), uint256(0), address(0), address(0), uint64(0), uint64(0), uint64(0), bytes32(0)
                    )
                )
            )
        );
        authority.setWord(
            26,
            uint256(
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
            )
        );
    }

    function _assertReadyAndUnfinalized(AcquisitionConstellationFactory factory, address[5] memory children)
        internal
        view
    {
        (bytes32 manifest, bytes32 deployment, uint8 phase, uint8 next,,,,,) = factory.factoryState();
        assertEq(manifest, _expectedManifest[address(factory)]);
        assertEq(deployment, _expectedDeployment[address(factory)]);
        assertEq(phase, 2);
        assertEq(next, 5);
        bytes4[5] memory selectors = [
            bytes4(keccak256("authorityTopology()")),
            AcquisitionVaultCore.coreTopology.selector,
            PreVoteBudgetBook.budgetBookTopology.selector,
            AcquisitionIntentExecution.intentExecutionTopology.selector,
            AcquisitionReconciliation.reconciliationTopology.selector
        ];
        for (uint8 i; i < 5; ++i) {
            (bool ok, bytes memory result) = children[i].staticcall(abi.encodeWithSelector(selectors[i]));
            assertTrue(ok);
            (,, bool finalized) = abi.decode(result, (address, bytes32, bool));
            assertFalse(finalized);
        }
    }

    function _cool(address target) internal {
        (bool ok,) = address(vm).call(abi.encodeWithSignature("cool(address)", target));
        assertTrue(ok);
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

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint256 i; i <= h.length - n.length; ++i) {
            bool match_ = true;
            for (uint256 j; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    match_ = false;
                    break;
                }
            }
            if (match_) return true;
        }
        return false;
    }
}
