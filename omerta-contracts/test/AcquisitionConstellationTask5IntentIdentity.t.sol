// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {AcquisitionIntentExecution} from "../src/AcquisitionIntentExecution.sol";

interface ITask5IntentExecution {
    struct IntentIdentityInput {
        uint256 ballotDay;
        bytes32 assetVersionKey;
    }

    struct AttemptIdentityInput {
        uint256 operatorGeneration;
        uint256 attemptIndex;
        bytes32 intentId;
        address adapter;
        bytes32 runtimeCodeHash;
        bytes32 routeHash;
    }

    struct ImmutableIntentCommitment {
        bytes32 intentId;
        bytes32 budgetId;
        uint256 ballotDay;
        bytes32 assetVersionKey;
        address token;
        uint8 tokenDecimals;
        uint256 maxEthWei;
        uint64 purchaseUntil;
        uint256 ingressGeneration;
        bytes32 oracleCommitment;
        uint256 minimumOutput;
        address adapter;
        bytes32 adapterRuntimeCodeHash;
        bytes32 routeHash;
    }
    error IntentExecutionZeroAddress();
    error IntentExecutionContractRequired(address account);
    error IntentExecutionAddressMismatch(address expected, address actual);
    error IntentExecutionPeerMismatch(uint8 peer, address expected, address actual);
    event IntentExecutionFinalized(bytes32 indexed manifestHash);
    function intentExecutionTopology() external view returns (address factory, bytes32 manifestHash, bool finalized);
    function finalizeIntentExecution(bytes32 manifestHash) external;
    function deriveIntentId(uint256 ballotDay, bytes32 assetVersionKey) external view returns (bytes32 intentId);
    function deriveAttemptId(
        uint256 operatorGeneration,
        uint256 attemptIndex,
        bytes32 intentId,
        address adapter,
        bytes32 runtimeCodeHash,
        bytes32 routeHash
    ) external view returns (bytes32 attemptId);
}

contract Task5CodeStub {}

contract Task5NonceFactory {
    enum Mode {
        Correct,
        WrongCore,
        CoreWithoutCode,
        WrongSelf,
        ZeroCore,
        ZeroFactory,
        ZeroManifest,
        ZeroCoreWrongSelf,
        WrongSelfWrongCore,
        WrongCoreWithoutCode
    }

    function deploy(bytes32 manifestHash, Mode mode, address wrongCore)
        external
        returns (address core, address intent, bytes memory revertData)
    {
        new Task5CodeStub();
        core = mode == Mode.CoreWithoutCode || mode == Mode.WrongCoreWithoutCode
            ? _emptyRuntime()
            : address(new Task5CodeStub());
        new Task5CodeStub();
        if (mode == Mode.WrongSelf || mode == Mode.ZeroCoreWrongSelf || mode == Mode.WrongSelfWrongCore) {
            new Task5CodeStub();
        }
        address suppliedCore = mode == Mode.WrongCore || mode == Mode.WrongSelfWrongCore
            || mode == Mode.WrongCoreWithoutCode
            ? wrongCore
            : mode == Mode.ZeroCore || mode == Mode.ZeroFactory || mode == Mode.ZeroManifest
                || mode == Mode.ZeroCoreWrongSelf
                ? address(0)
                : core;
        address suppliedFactory = mode == Mode.ZeroFactory ? address(0) : address(this);
        bytes32 suppliedManifest = mode == Mode.ZeroFactory || mode == Mode.ZeroManifest ? bytes32(0) : manifestHash;
        bytes memory initcode = abi.encodePacked(
            type(AcquisitionIntentExecution).creationCode, abi.encode(suppliedFactory, suppliedManifest, suppliedCore)
        );
        assembly ("memory-safe") {
            intent := create(0, add(initcode, 0x20), mload(initcode))
            let n := returndatasize()
            revertData := mload(0x40)
            mstore(revertData, n)
            returndatacopy(add(revertData, 0x20), 0, n)
            mstore(0x40, and(add(add(revertData, 0x3f), n), not(0x1f)))
        }
    }

    function finalize(address intent, bytes32 manifestHash) external {
        ITask5IntentExecution(intent).finalizeIntentExecution(manifestHash);
    }

    function _emptyRuntime() private returns (address result) {
        bytes memory initcode = hex"60006000f3";
        assembly ("memory-safe") { result := create(0, add(initcode, 0x20), mload(initcode)) }
    }
}

contract AcquisitionConstellationTask5IntentIdentityTest is Test {
    bytes32 private constant _MANIFEST = keccak256("TASK5_RED_MANIFEST");
    bytes32 private constant _TAG = 0x8aa693df3b136274e99739abc62a2c7aabc541180430aaba0fc4cb6267383c27;
    uint256 private constant _CHAIN = 4663;

    function test_01_selectorsEventAndLiteralVectorsAreFrozen() external pure {
        assertEq(ITask5IntentExecution.deriveIntentId.selector, bytes4(0x6fd37d8c));
        assertEq(ITask5IntentExecution.deriveAttemptId.selector, bytes4(0x14ddcae0));
        assertEq(ITask5IntentExecution.IntentExecutionZeroAddress.selector, bytes4(0xdf2b1023));
        assertEq(ITask5IntentExecution.IntentExecutionContractRequired.selector, bytes4(0xe861d66a));
        assertEq(ITask5IntentExecution.IntentExecutionAddressMismatch.selector, bytes4(0x9022e30f));
        assertEq(ITask5IntentExecution.IntentExecutionPeerMismatch.selector, bytes4(0xb3910689));
        assertEq(
            keccak256("IntentExecutionFinalized(bytes32)"), ITask5IntentExecution.IntentExecutionFinalized.selector
        );
        address core = 0x1111111111111111111111111111111111111111;
        bytes32 key = 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;
        bytes32 iid = _intentOracle(core, 20_702, key);
        assertEq(iid, 0x7fb4270f2e2a3d72d11ea1439252f0034a349eedb2a3fd1d1e6f5099a43f7274);
        assertEq(
            _attemptOracle(
                core,
                0x4444444444444444444444444444444444444444,
                7,
                3,
                iid,
                0x7777777777777777777777777777777777777777,
                0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,
                0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
            ),
            0x77e64ac10210ac43ddc3c3fc400cd50c6780aa3a3acfbe6c2d1c9124f2b9088a
        );
    }

    function test_01b_bytecodeScannerFailsClosedAndSkipsPushData() external {
        this.exposedScan(hex"607ff3", 0);
        vm.expectRevert(bytes("truncated PUSH"));
        this.exposedScan(hex"61ff", 0);
        vm.expectRevert(bytes("malformed metadata suffix"));
        this.exposedStrip(hex"00");
        vm.expectRevert(bytes("malformed metadata length"));
        this.exposedStrip(hex"00ffff");
        vm.expectRevert(bytes("noncanonical Solidity metadata"));
        this.exposedStrip(abi.encodePacked(new bytes(52), hex"0033"));
        bytes memory forged = abi.encodePacked(
            hex"f1",
            hex"a2646970667358221220000000000000000000000000000000000000000000000000000000000000000064736f6c634300081a0033"
        );
        bytes memory visibleCall = this.exposedStrip(forged);
        vm.expectRevert(bytes("forbidden executable opcode"));
        this.exposedScan(visibleCall, 0);
    }

    function exposedScan(bytes memory code, uint256 expectedExtcodesize) external pure {
        _scanNoCalls(code, expectedExtcodesize);
    }

    function exposedStrip(bytes memory code) external pure returns (bytes memory) {
        return _stripMetadata(code);
    }

    function test_01c_sourceNormalizerIgnoresCommentsAndFailsClosed() external {
        assertEq(
            this.exposedSemanticCompact("// SPDX\n pragma /* NatSpec */ solidity 0.8.26; // tail\n interface I{}"),
            "pragmasolidity0.8.26;interfaceI{}"
        );
        vm.expectRevert(bytes("unterminated block comment"));
        this.exposedSemanticCompact("pragma solidity 0.8.26; /*");
    }

    function exposedSemanticCompact(string memory source) external pure returns (string memory) {
        return _semanticCompact(source);
    }

    function test_02_RED_exactProductionAbiArtifact() external view {
        string memory j = _artifactJson();
        assertEq(_abiKindCount(j, "function"), 4, "TASK5_RED: four-function ABI missing");
        assertEq(_abiKindCount(j, "error"), 9, "TASK5_RED: nine-error ABI missing");
        assertEq(_abiKindCount(j, "event"), 1);
        assertEq(_abiKindCount(j, "constructor"), 1);
        assertEq(_abiEntryCount(j), 15);
        _assertEntry(j, "constructor", "", "address,bytes32,address", "factory,manifestHash,core", "", "", "nonpayable");
        _assertEntry(
            j,
            "function",
            "intentExecutionTopology",
            "",
            "",
            "address,bytes32,bool",
            "factory,manifestHash,finalized",
            "view"
        );
        _assertEntry(j, "function", "finalizeIntentExecution", "bytes32", "manifestHash", "", "", "nonpayable");
        _assertEntry(
            j,
            "function",
            "deriveIntentId",
            "uint256,bytes32",
            "ballotDay,assetVersionKey",
            "bytes32",
            "intentId",
            "view"
        );
        _assertEntry(
            j,
            "function",
            "deriveAttemptId",
            "uint256,uint256,bytes32,address,bytes32,bytes32",
            "operatorGeneration,attemptIndex,intentId,adapter,runtimeCodeHash,routeHash",
            "bytes32",
            "attemptId",
            "view"
        );
        _assertError(j, "IntentExecutionFactoryZero", "", "");
        _assertError(j, "IntentExecutionManifestHashZero", "", "");
        _assertError(j, "IntentExecutionFinalizerUnauthorized", "address", "caller");
        _assertError(j, "IntentExecutionManifestHashMismatch", "bytes32,bytes32", "expected,actual");
        _assertError(j, "IntentExecutionAlreadyFinalized", "", "");
        _assertError(j, "IntentExecutionZeroAddress", "", "");
        _assertError(j, "IntentExecutionContractRequired", "address", "account");
        _assertError(j, "IntentExecutionAddressMismatch", "address,address", "expected,actual");
        _assertError(j, "IntentExecutionPeerMismatch", "uint8,address,address", "peer,expected,actual");
        string memory e = _find(j, "event", "IntentExecutionFinalized");
        assertTrue(bytes(e).length != 0);
        assertEq(_types(j, e, "inputs"), "bytes32");
        assertEq(_names(j, e, "inputs"), "manifestHash");
        assertTrue(vm.parseJsonBool(j, string.concat(e, ".inputs[0].indexed")));
        assertFalse(vm.parseJsonBool(j, string.concat(e, ".anonymous")));
        assertEq(_abiKindCount(j, "fallback"), 0);
        assertEq(_abiKindCount(j, "receive"), 0);
    }

    function test_03_RED_typeOnlyProductionInterfaceSchema() external {
        string memory artifact = "out/IAcquisitionIntentExecutionV2.sol/IAcquisitionIntentExecutionV2.json";
        assertTrue(vm.exists(artifact), "TASK5_RED: interface artifact missing");
        string memory j = vm.readFile(artifact);
        assertEq(_abiKindCount(j, "function"), 0, "type-only interface executable ABI");
        string memory compact = _semanticCompact(vm.readFile("src/interfaces/IAcquisitionIntentExecutionV2.sol"));
        string memory expected =
            "pragmasolidity0.8.26;interfaceIAcquisitionIntentExecutionV2{structIntentIdentityInput{uint256ballotDay;bytes32assetVersionKey;}structAttemptIdentityInput{uint256operatorGeneration;uint256attemptIndex;bytes32intentId;addressadapter;bytes32runtimeCodeHash;bytes32routeHash;}structImmutableIntentCommitment{bytes32intentId;bytes32budgetId;uint256ballotDay;bytes32assetVersionKey;addresstoken;uint8tokenDecimals;uint256maxEthWei;uint64purchaseUntil;uint256ingressGeneration;bytes32oracleCommitment;uint256minimumOutput;addressadapter;bytes32adapterRuntimeCodeHash;bytes32routeHash;}}";
        assertEq(compact, expected, "exact complete type-only source unit");
    }

    function test_04a_RED_constructorRejectsCodeBearingWrongCore() external {
        Task5CodeStub wrong = new Task5CodeStub();
        _assertBranch(Task5NonceFactory.Mode.WrongCore, address(wrong), 1);
    }

    function test_04b_RED_constructorRejectsPredictedCoreWithoutCode() external {
        _assertBranch(Task5NonceFactory.Mode.CoreWithoutCode, address(0), 2);
    }

    function test_04c_RED_constructorRejectsNonceShiftedSelf() external {
        _assertBranch(Task5NonceFactory.Mode.WrongSelf, address(0), 3);
    }

    function test_04d_RED_constructorRejectsZeroCoreFirst() external {
        _assertBranch(Task5NonceFactory.Mode.ZeroCore, address(0), 4);
    }

    function test_04e_constructorZeroFactoryWinsCompoundInvalid() external {
        _assertBranch(Task5NonceFactory.Mode.ZeroFactory, address(0), 5);
    }

    function test_04f_constructorZeroManifestWinsZeroCore() external {
        _assertBranch(Task5NonceFactory.Mode.ZeroManifest, address(0), 6);
    }

    function test_04g_RED_zeroCoreWinsNonceShiftedSelf() external {
        _assertBranch(Task5NonceFactory.Mode.ZeroCoreWrongSelf, address(0), 7);
    }

    function test_04h_RED_wrongSelfWinsWrongCore() external {
        Task5CodeStub wrong = new Task5CodeStub();
        _assertBranch(Task5NonceFactory.Mode.WrongSelfWrongCore, address(wrong), 8);
    }

    function test_04i_RED_peerMismatchWinsWrongCoreWithoutCode() external {
        address wrongWithoutCode = address(0xBEEF);
        assertEq(wrongWithoutCode.code.length, 0, "fixture wrong Core must have no code");
        _assertBranch(Task5NonceFactory.Mode.WrongCoreWithoutCode, wrongWithoutCode, 9);
    }

    function test_04j_topologyGetterAndFinalizationTransition() external {
        (Task5NonceFactory f,, address intent) = _deployCorrect();
        (address factory, bytes32 manifest, bool finalized) = ITask5IntentExecution(intent).intentExecutionTopology();
        assertEq(factory, address(f));
        assertEq(manifest, _MANIFEST);
        assertFalse(finalized);
        f.finalize(intent, _MANIFEST);
        (factory, manifest, finalized) = ITask5IntentExecution(intent).intentExecutionTopology();
        assertEq(factory, address(f));
        assertEq(manifest, _MANIFEST);
        assertTrue(finalized);
    }

    function test_05_RED_realProductionHelpersAndFinalizationStability() external {
        (Task5NonceFactory f, address core, address intent) = _deployCorrect();
        bytes32 key = keccak256("stable-key");
        bytes32 iid = _deriveIntent(intent, 20_702, key);
        assertEq(iid, _intentOracle(core, 20_702, key));
        bytes32 aid = _deriveAttempt(intent, 7, 3, iid, address(0x7777), bytes32(uint256(8)), bytes32(uint256(9)));
        assertEq(
            aid, _attemptOracle(core, intent, 7, 3, iid, address(0x7777), bytes32(uint256(8)), bytes32(uint256(9)))
        );
        f.finalize(intent, _MANIFEST);
        assertEq(_deriveIntent(intent, 20_702, key), iid);
        assertEq(_deriveAttempt(intent, 7, 3, iid, address(0x7777), bytes32(uint256(8)), bytes32(uint256(9))), aid);
    }

    function test_06_RED_zeroMaxAndDimensionSeparation() external {
        (, address core, address intent) = _deployCorrect();
        bytes32 z = _deriveIntent(intent, 0, bytes32(0));
        assertEq(z, _intentOracle(core, 0, bytes32(0)));
        bytes32 dayMutation = _deriveIntent(intent, 1, bytes32(0));
        assertEq(dayMutation, _intentOracle(core, 1, bytes32(0)));
        assertTrue(z != dayMutation);
        bytes32 keyMutation = _deriveIntent(intent, 0, bytes32(uint256(1)));
        assertEq(keyMutation, _intentOracle(core, 0, bytes32(uint256(1))));
        assertTrue(z != keyMutation);
        assertEq(
            _deriveIntent(intent, type(uint256).max, bytes32(type(uint256).max)),
            _intentOracle(core, type(uint256).max, bytes32(type(uint256).max))
        );
        assertTrue(z != keccak256(abi.encode(uint256(1), core, uint256(0), bytes32(0))));
        bytes32 b = _deriveAttempt(intent, 0, 0, bytes32(0), address(0), bytes32(0), bytes32(0));
        assertEq(b, _attemptOracle(core, intent, 0, 0, bytes32(0), address(0), bytes32(0), bytes32(0)));
        bytes32 m;
        m = _deriveAttempt(intent, 1, 0, bytes32(0), address(0), bytes32(0), bytes32(0));
        assertEq(m, _attemptOracle(core, intent, 1, 0, bytes32(0), address(0), bytes32(0), bytes32(0)));
        assertTrue(b != m);
        m = _deriveAttempt(intent, 0, 1, bytes32(0), address(0), bytes32(0), bytes32(0));
        assertEq(m, _attemptOracle(core, intent, 0, 1, bytes32(0), address(0), bytes32(0), bytes32(0)));
        assertTrue(b != m);
        m = _deriveAttempt(intent, 0, 0, bytes32(uint256(1)), address(0), bytes32(0), bytes32(0));
        assertEq(m, _attemptOracle(core, intent, 0, 0, bytes32(uint256(1)), address(0), bytes32(0), bytes32(0)));
        assertTrue(b != m);
        m = _deriveAttempt(intent, 0, 0, bytes32(0), address(1), bytes32(0), bytes32(0));
        assertEq(m, _attemptOracle(core, intent, 0, 0, bytes32(0), address(1), bytes32(0), bytes32(0)));
        assertTrue(b != m);
        m = _deriveAttempt(intent, 0, 0, bytes32(0), address(0), bytes32(uint256(1)), bytes32(0));
        assertEq(m, _attemptOracle(core, intent, 0, 0, bytes32(0), address(0), bytes32(uint256(1)), bytes32(0)));
        assertTrue(b != m);
        m = _deriveAttempt(intent, 0, 0, bytes32(0), address(0), bytes32(0), bytes32(uint256(1)));
        assertEq(m, _attemptOracle(core, intent, 0, 0, bytes32(0), address(0), bytes32(0), bytes32(uint256(1))));
        assertTrue(b != m);
        assertEq(
            _deriveAttempt(
                intent,
                type(uint256).max,
                type(uint256).max,
                bytes32(type(uint256).max),
                address(type(uint160).max),
                bytes32(type(uint256).max),
                bytes32(type(uint256).max)
            ),
            _attemptOracle(
                core,
                intent,
                type(uint256).max,
                type(uint256).max,
                bytes32(type(uint256).max),
                address(type(uint160).max),
                bytes32(type(uint256).max),
                bytes32(type(uint256).max)
            )
        );
        assertTrue(
            b
                != keccak256(
                    abi.encodePacked(
                        _TAG,
                        _CHAIN,
                        core,
                        intent,
                        uint256(0),
                        uint256(0),
                        bytes32(0),
                        address(0),
                        bytes32(0),
                        bytes32(0)
                    )
                )
        );
        assertTrue(
            b
                != keccak256(
                    abi.encode(
                        bytes32(uint256(1)),
                        _CHAIN,
                        core,
                        intent,
                        uint256(0),
                        uint256(0),
                        bytes32(0),
                        address(0),
                        bytes32(0),
                        bytes32(0)
                    )
                )
        );
        assertTrue(
            b
                != keccak256(
                    abi.encode(
                        _TAG,
                        uint256(1),
                        core,
                        intent,
                        uint256(0),
                        uint256(0),
                        bytes32(0),
                        address(0),
                        bytes32(0),
                        bytes32(0)
                    )
                )
        );
        assertTrue(
            b
                != keccak256(
                    abi.encode(
                        _TAG,
                        _CHAIN,
                        address(0xFACA),
                        intent,
                        uint256(0),
                        uint256(0),
                        bytes32(0),
                        address(0),
                        bytes32(0),
                        bytes32(0)
                    )
                )
        );
        assertTrue(
            b
                != keccak256(
                    abi.encode(
                        _TAG,
                        _CHAIN,
                        core,
                        address(0xB00C),
                        uint256(0),
                        uint256(0),
                        bytes32(0),
                        address(0),
                        bytes32(0),
                        bytes32(0)
                    )
                )
        );
    }

    function test_07_RED_opcodesAndForbiddenBusinessSurface() external {
        string memory j = _artifactJson();
        _scanNoCalls(_stripMetadata(vm.parseJsonBytes(j, ".deployedBytecode.object")), 0);
        _scanNoCalls(_stripMetadata(vm.parseJsonBytes(j, ".bytecode.object")), 1);
        (,, address intent) = _deployCorrect();
        _assertForbidden(intent, j, "createIntent", abi.encodeWithSignature("createIntent(bytes)", hex"01"));
        _assertForbidden(
            intent, j, "execute", abi.encodeWithSignature("execute(bytes32,bytes)", bytes32(uint256(1)), hex"02")
        );
        _assertForbidden(intent, j, "consume", abi.encodeWithSignature("consume(bytes32)", bytes32(uint256(1))));
        _assertForbidden(intent, j, "cancel", abi.encodeWithSignature("cancel(bytes32)", bytes32(uint256(1))));
        _assertForbidden(intent, j, "expire", abi.encodeWithSignature("expire(bytes32)", bytes32(uint256(1))));
        _assertForbidden(
            intent,
            j,
            "recordResult",
            abi.encodeWithSignature("recordResult(bytes32,bytes)", bytes32(uint256(1)), hex"03")
        );
        _assertForbidden(intent, j, "getIntent", abi.encodeWithSignature("getIntent(bytes32)", bytes32(uint256(1))));
        _assertForbidden(intent, j, "getAttempt", abi.encodeWithSignature("getAttempt(bytes32)", bytes32(uint256(1))));
        _assertForbidden(
            intent, j, "transfer", abi.encodeWithSignature("transfer(address,uint256)", address(1), uint256(1))
        );
        _assertForbidden(
            intent,
            j,
            "recoverToken",
            abi.encodeWithSignature("recoverToken(address,address,uint256)", address(1), address(2), uint256(1))
        );
        vm.deal(address(this), 1);
        (bool receiveOk,) = intent.call{value: 1}("");
        assertFalse(receiveOk);
        assertEq(intent.balance, 0);
    }

    function _assertBranch(Task5NonceFactory.Mode mode, address wrong, uint256 branch) private {
        Task5NonceFactory f = new Task5NonceFactory();
        address pc = _predict(address(f), 2);
        address pi = _predict(address(f), 4);
        (address core, address intent, bytes memory data) = f.deploy(_MANIFEST, mode, wrong);
        assertEq(core, pc, "fixture nonce2");
        assertEq(intent, address(0), "TASK5_RED: constructor branch absent");
        bytes memory expected;
        if (branch == 1) {
            expected =
                abi.encodeWithSelector(ITask5IntentExecution.IntentExecutionPeerMismatch.selector, uint8(1), pc, wrong);
        } else if (branch == 2) {
            expected = abi.encodeWithSelector(ITask5IntentExecution.IntentExecutionContractRequired.selector, pc);
        } else if (branch == 3) {
            expected = abi.encodeWithSelector(
                ITask5IntentExecution.IntentExecutionAddressMismatch.selector, pi, _predict(address(f), 5)
            );
        } else if (branch == 4) {
            expected = abi.encodeWithSelector(ITask5IntentExecution.IntentExecutionZeroAddress.selector);
        } else if (branch == 5) {
            expected = abi.encodeWithSignature("IntentExecutionFactoryZero()");
        } else if (branch == 6) {
            expected = abi.encodeWithSignature("IntentExecutionManifestHashZero()");
        } else if (branch == 7) {
            expected = abi.encodeWithSelector(ITask5IntentExecution.IntentExecutionZeroAddress.selector);
        } else if (branch == 8) {
            expected = abi.encodeWithSelector(
                ITask5IntentExecution.IntentExecutionAddressMismatch.selector, pi, _predict(address(f), 5)
            );
        } else {
            expected =
                abi.encodeWithSelector(ITask5IntentExecution.IntentExecutionPeerMismatch.selector, uint8(1), pc, wrong);
        }
        assertEq(data, expected, "exact constructor error");
    }

    function _deployCorrect() private returns (Task5NonceFactory f, address core, address intent) {
        f = new Task5NonceFactory();
        address pc = _predict(address(f), 2);
        address pi = _predict(address(f), 4);
        bytes memory data;
        (core, intent, data) = f.deploy(_MANIFEST, Task5NonceFactory.Mode.Correct, address(0));
        assertEq(core, pc, "fixture nonce2");
        assertEq(intent, pi, "fixture nonce4");
        assertEq(data.length, 0);
        assertTrue(core.code.length != 0 && intent.code.length != 0);
    }

    function _deriveIntent(address target, uint256 day, bytes32 key) private view returns (bytes32 r) {
        (bool ok, bytes memory d) = target.staticcall(abi.encodeCall(ITask5IntentExecution.deriveIntentId, (day, key)));
        assertTrue(ok, "TASK5_RED: deriveIntentId absent");
        assertEq(d.length, 32);
        r = abi.decode(d, (bytes32));
    }

    function _deriveAttempt(
        address target,
        uint256 generation,
        uint256 index,
        bytes32 iid,
        address adapter,
        bytes32 codeHash,
        bytes32 route
    ) private view returns (bytes32 r) {
        (bool ok, bytes memory d) = target.staticcall(
            abi.encodeCall(ITask5IntentExecution.deriveAttemptId, (generation, index, iid, adapter, codeHash, route))
        );
        assertTrue(ok, "TASK5_RED: deriveAttemptId absent");
        assertEq(d.length, 32);
        r = abi.decode(d, (bytes32));
    }

    function _intentOracle(address core, uint256 day, bytes32 key) private pure returns (bytes32) {
        return keccak256(abi.encode(_CHAIN, core, day, key));
    }

    function _attemptOracle(
        address core,
        address module,
        uint256 generation,
        uint256 index,
        bytes32 iid,
        address adapter,
        bytes32 codeHash,
        bytes32 route
    ) private pure returns (bytes32) {
        return keccak256(abi.encode(_TAG, _CHAIN, core, module, generation, index, iid, adapter, codeHash, route));
    }

    function _predict(address deployer, uint8 nonce) private pure returns (address) {
        require(nonce > 0 && nonce < 128);
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", deployer, bytes1(nonce))))));
    }

    function _artifactJson() private view returns (string memory) {
        return vm.readFile(vm.getArtifactPathByCode(type(AcquisitionIntentExecution).creationCode));
    }

    function _abiPath(uint256 i) private view returns (string memory) {
        return string.concat(".abi[", vm.toString(i), "]");
    }

    function _abiEntryCount(string memory j) private view returns (uint256 n) {
        while (vm.keyExistsJson(j, _abiPath(n))) ++n;
    }

    function _abiKindCount(string memory j, string memory kind) private view returns (uint256 n) {
        for (uint256 i; vm.keyExistsJson(j, _abiPath(i)); ++i) {
            if (_same(vm.parseJsonString(j, string.concat(_abiPath(i), ".type")), kind)) ++n;
        }
    }

    function _find(string memory j, string memory kind, string memory name) private view returns (string memory p) {
        for (uint256 i; vm.keyExistsJson(j, _abiPath(i)); ++i) {
            p = _abiPath(i);
            if (!_same(vm.parseJsonString(j, string.concat(p, ".type")), kind)) continue;
            if (_same(kind, "constructor") || _same(vm.parseJsonString(j, string.concat(p, ".name")), name)) return p;
        }
        return "";
    }

    function _assertEntry(
        string memory j,
        string memory kind,
        string memory name,
        string memory ins,
        string memory inNames,
        string memory outs,
        string memory outNames,
        string memory mutability
    ) private view {
        string memory p = _find(j, kind, name);
        assertTrue(bytes(p).length != 0, string.concat("missing ", name));
        assertEq(_types(j, p, "inputs"), ins);
        assertEq(_names(j, p, "inputs"), inNames);
        if (_same(kind, "function")) {
            assertEq(_types(j, p, "outputs"), outs);
            assertEq(_names(j, p, "outputs"), outNames);
        }
        assertEq(vm.parseJsonString(j, string.concat(p, ".stateMutability")), mutability);
    }

    function _assertError(string memory j, string memory name, string memory types_, string memory names_)
        private
        view
    {
        string memory p = _find(j, "error", name);
        assertTrue(bytes(p).length != 0, string.concat("missing error ", name));
        assertEq(_types(j, p, "inputs"), types_, string.concat(name, " types"));
        assertEq(_names(j, p, "inputs"), names_, string.concat(name, " names"));
    }

    function _assertForbidden(address target, string memory j, string memory name, bytes memory callData) private {
        assertEq(bytes(_find(j, "function", name)).length, 0, string.concat("forbidden ABI descriptor: ", name));
        (bool ok,) = target.call(callData);
        assertFalse(ok, string.concat("forbidden runtime selector: ", name));
    }

    function _stripMetadata(bytes memory code) private pure returns (bytes memory body) {
        assertTrue(code.length >= 2, "malformed metadata suffix");
        uint256 metadataLength = (uint8(code[code.length - 2]) << 8) | uint8(code[code.length - 1]);
        assertTrue(metadataLength + 2 <= code.length, "malformed metadata length");
        assertEq(metadataLength, 51, "noncanonical Solidity metadata");
        uint256 length = code.length - metadataLength - 2;
        assertTrue(
            code[length] == 0xa2 && code[length + 1] == 0x64 && code[length + 2] == 0x69 && code[length + 3] == 0x70
                && code[length + 4] == 0x66 && code[length + 5] == 0x73 && code[length + 6] == 0x58
                && code[length + 7] == 0x22 && code[length + 8] == 0x12 && code[length + 9] == 0x20
                && code[length + 42] == 0x64 && code[length + 43] == 0x73 && code[length + 44] == 0x6f
                && code[length + 45] == 0x6c && code[length + 46] == 0x63 && code[length + 47] == 0x43,
            "noncanonical Solidity metadata"
        );
        body = new bytes(length);
        for (uint256 i; i < length; ++i) {
            body[i] = code[i];
        }
    }

    function _scanNoCalls(bytes memory code, uint256 expectedExtcodesize) private pure {
        uint256 extcodesizeCount;
        for (uint256 i; i < code.length; ++i) {
            uint8 op = uint8(code[i]);
            if (op >= 0x60 && op <= 0x7f) {
                uint256 width = op - 0x5f;
                assertTrue(i + width < code.length, "truncated PUSH");
                i += width;
                continue;
            }
            if (op == 0x3b) ++extcodesizeCount;
            assertTrue(
                op != 0x3e && op != 0xf0 && op != 0xf1 && op != 0xf2 && op != 0xf4 && op != 0xf5 && op != 0xfa
                    && op != 0xff,
                "forbidden executable opcode"
            );
        }
        assertEq(extcodesizeCount, expectedExtcodesize, "exact EXTCODESIZE inventory");
    }

    function _types(string memory j, string memory p, string memory field) private view returns (string memory r) {
        for (uint256 i; vm.keyExistsJson(j, string.concat(p, ".", field, "[", vm.toString(i), "]")); ++i) {
            if (i > 0) r = string.concat(r, ",");
            r = string.concat(r, vm.parseJsonString(j, string.concat(p, ".", field, "[", vm.toString(i), "].type")));
        }
    }

    function _names(string memory j, string memory p, string memory field) private view returns (string memory r) {
        for (uint256 i; vm.keyExistsJson(j, string.concat(p, ".", field, "[", vm.toString(i), "]")); ++i) {
            if (i > 0) r = string.concat(r, ",");
            r = string.concat(r, vm.parseJsonString(j, string.concat(p, ".", field, "[", vm.toString(i), "].name")));
        }
    }

    function _same(string memory a, string memory b) private pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function _semanticCompact(string memory input) private pure returns (string memory) {
        bytes memory src = bytes(input);
        bytes memory tmp = new bytes(src.length);
        uint256 n;
        bool blockComment;
        bool lineComment;
        for (uint256 i; i < src.length; ++i) {
            bytes1 c = src[i];
            if (lineComment) {
                if (c == 0x0a || c == 0x0d) lineComment = false;
                continue;
            }
            if (blockComment) {
                if (c == 0x2a && i + 1 < src.length && src[i + 1] == 0x2f) {
                    blockComment = false;
                    ++i;
                }
                continue;
            }
            if (c == 0x2f && i + 1 < src.length && src[i + 1] == 0x2f) {
                lineComment = true;
                ++i;
                continue;
            }
            if (c == 0x2f && i + 1 < src.length && src[i + 1] == 0x2a) {
                blockComment = true;
                ++i;
                continue;
            }
            if (c != 0x20 && c != 0x09 && c != 0x0a && c != 0x0d) tmp[n++] = c;
        }
        assertFalse(blockComment, "unterminated block comment");
        bytes memory out = new bytes(n);
        for (uint256 i; i < n; ++i) {
            out[i] = tmp[i];
        }
        return string(out);
    }

    function _slice(string memory input, uint256 start, uint256 end) private pure returns (string memory) {
        bytes memory src = bytes(input);
        assertTrue(start <= end && end <= src.length, "slice bounds");
        bytes memory out = new bytes(end - start);
        for (uint256 i; i < out.length; ++i) {
            out[i] = src[start + i];
        }
        return string(out);
    }

    function _index(string memory hs, string memory ns) private pure returns (uint256) {
        bytes memory h = bytes(hs);
        bytes memory n = bytes(ns);
        if (n.length > h.length) return type(uint256).max;
        for (uint256 i; i + n.length <= h.length; ++i) {
            bool ok = true;
            for (uint256 k; k < n.length; ++k) {
                if (h[i + k] != n[k]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return i;
        }
        return type(uint256).max;
    }
}
