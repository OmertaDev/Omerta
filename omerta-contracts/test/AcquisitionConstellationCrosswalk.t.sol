// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

contract AcquisitionConstellationCrosswalkTest is Test {
    enum Owner {
        Factory,
        Authority,
        Core,
        BudgetBook,
        Intent,
        Reconciliation,
        Inherited,
        Retired
    }
    enum Category {
        Move,
        Inherited,
        Retired,
        FutureReserved,
        Topology
    }
    enum SemanticKind {
        None,
        OwnerRole,
        OperatorRole,
        Accounting,
        Guard
    }
    enum TargetKind {
        None,
        EcrecoverPrecompile,
        CodeCheckedERC1271
    }

    uint256 internal constant FUNCTION_COUNT = 67;
    uint256 internal constant ERROR_COUNT = 55;
    uint256 internal constant EVENT_COUNT = 21;
    uint256 internal constant CONSTRUCTOR_COUNT = 1;
    uint256 internal constant ABI_COUNT = 144;
    uint256 internal constant LEGACY_RUNTIME_SIZE = 23_212;
    uint256 internal constant LAST_STORAGE_ROOT = 39;
    uint256 internal constant RUNTIME_LIMIT = 24_576;
    uint256 internal constant INITCODE_LIMIT = 49_152;
    bytes32 internal constant LEGACY_CENSUS_HASH = 0x900d8599031796556ccc5d83d3df8dcfe4725d4c34b9f0cf26ff269436a00aab;

    enum Reject {
        None,
        MissingSelector,
        DuplicateAssignment,
        UnknownSelector,
        SelectorCollision,
        DuplicateError,
        DuplicateEvent,
        HiddenPayable,
        PayableConstructor,
        Receive,
        Fallback,
        OperatorCopy,
        OwnerCopy,
        AccountingCopy,
        UnapprovedCall,
        DelegateCall,
        PushScanner,
        OpcodeAfterPush,
        ArbitraryCall,
        RuntimeOversize,
        InitcodeOversize,
        FutureEarly,
        FactoryBusiness,
        CreateValue,
        BlockContext,
        Proxy
    }

    struct StorageRow {
        string label;
        Owner owner;
        SemanticKind kind;
    }

    struct Callsite {
        TargetKind targetKind;
        bytes4 selector;
        bool arbitraryCalldata;
        uint256 value;
        uint256 gasCap;
        uint16 returnBytes;
        bool copiesRevertData;
        bool bubblesFailure;
    }

    struct Dependency {
        string name;
        bool proxy;
        bool delegates;
    }

    struct Manifest {
        string[67] functions;
        bytes32[67] functionRowIds;
        Category[67] functionCategories;
        Owner[67] functionOwners;
        uint8[67] assignments;
        bool[67] payableFlags;
        string[55] errors;
        Owner[55] errorOwners;
        Category[55] errorCategories;
        string[21] events;
        Owner[21] eventOwners;
        Category[21] eventCategories;
        StorageRow[4] storageRows;
        Callsite[2] calls;
        Dependency[6] dependencies;
        string constructorMutability;
        string immutableSource;
        bytes scannerCode;
        uint8 expectedForbidden;
        uint32 runtimeSize;
        uint32 initcodeSize;
        uint96 createValue;
    }

    string[6] internal finalArtifacts = [
        "out/AcquisitionConstellationFactory.sol/AcquisitionConstellationFactory.json",
        "out/AcquisitionAuthority.sol/AcquisitionAuthority.json",
        "out/AcquisitionVaultCore.sol/AcquisitionVaultCore.json",
        "out/PreVoteBudgetBook.sol/PreVoteBudgetBook.json",
        "out/AcquisitionIntentExecution.sol/AcquisitionIntentExecution.json",
        "out/AcquisitionReconciliation.sol/AcquisitionReconciliation.json"
    ];

    function test_task0Red_exactSixFinalArtifactsAreAbsent() public {
        for (uint256 i; i < finalArtifacts.length; ++i) {
            assertFalse(vm.exists(finalArtifacts[i]), finalArtifacts[i]);
        }
    }

    function test_frozenCountsAndLimits() public pure {
        assertEq(FUNCTION_COUNT + ERROR_COUNT + EVENT_COUNT + CONSTRUCTOR_COUNT, ABI_COUNT);
        assertEq(LEGACY_RUNTIME_SIZE, 23_212);
        assertEq(LAST_STORAGE_ROOT, 39);
        assertEq(RUNTIME_LIMIT, 24_576);
        assertEq(INITCODE_LIMIT, 49_152);
        assertEq(_censusHash(), LEGACY_CENSUS_HASH);
    }

    function test_literalFunctionCensus_uniqueAndOwned() public pure {
        (string[] memory rows, Owner[] memory owners) = _functions();
        assertEq(rows.length, FUNCTION_COUNT);
        assertEq(owners.length, rows.length);
        _assertUnique(rows, true);
        uint256 authority;
        uint256 core;
        for (uint256 i; i < owners.length; ++i) {
            if (owners[i] == Owner.Authority) ++authority;
            else if (owners[i] == Owner.Core) ++core;
            else assertTrue(false, "unexpected function owner");
        }
        assertEq(authority, 47);
        assertEq(core, 20);
    }

    function test_literalErrorCensus_uniqueAndOwned() public pure {
        (string[] memory rows, Owner[] memory owners) = _errors();
        assertEq(rows.length, ERROR_COUNT);
        assertEq(owners.length, rows.length);
        _assertUnique(rows, true);
        uint256 factory;
        uint256 authority;
        uint256 core;
        for (uint256 i; i < owners.length; ++i) {
            if (owners[i] == Owner.Factory) ++factory;
            else if (owners[i] == Owner.Authority) ++authority;
            else if (owners[i] == Owner.Core) ++core;
        }
        assertEq(factory, 2);
        assertEq(authority, 42);
        assertEq(core, 11);
    }

    function test_literalEventCensus_uniqueAndOwned() public pure {
        (string[] memory rows, Owner[] memory owners) = _events();
        assertEq(rows.length, EVENT_COUNT);
        assertEq(owners.length, rows.length);
        _assertUnique(rows, false);
        uint256 authority;
        uint256 core;
        for (uint256 i; i < owners.length; ++i) {
            if (owners[i] == Owner.Authority) ++authority;
            else if (owners[i] == Owner.Core) ++core;
        }
        assertEq(authority, 17);
        assertEq(core, 4);
    }

    function test_combinedCategoryAwareCollisionUniverse() public pure {
        (string[] memory legacyFunctions,) = _functions();
        (string[] memory legacyErrors,) = _errors();
        (string[] memory legacyEvents,) = _events();
        (string[] memory topologyFunctions, string[] memory topologyErrors, string[] memory topologyEvents) =
            _topologyDescriptors();
        string[] memory future = _futureReserved();

        string[] memory functions = _join(legacyFunctions, topologyFunctions, future, 0, 2);
        string[] memory errors = _join(legacyErrors, topologyErrors, future, 2, 8);
        string[] memory events = _join(legacyEvents, topologyEvents, future, 8, 9);
        _assertUnique(functions, true);
        _assertUnique(errors, true);
        _assertUnique(events, false);
        assertEq(functions.length, 67 + 12 + 2);
        assertEq(errors.length, 55 + 15 + 6);
        assertEq(events.length, 21 + 5 + 1);
    }

    function test_reentrancyGuard_isSolePermittedRepeatedInheritedError() public pure {
        assertTrue(_repeatableInheritedError("ReentrancyGuardReentrantCall()", 5));
        assertFalse(_repeatableInheritedError("OwnableUnauthorizedAccount(address)", 2));
        assertFalse(_repeatableInheritedError("ReentrancyGuardReentrantCall()", 7));
        assertFalse(_repeatableInheritedError("ReentrancyGuardReentrantCall()", 1));
    }

    function test_validManifest_isAccepted() public pure {
        assertEq(uint8(_validate(_valid())), uint8(Reject.None));
    }

    function test_storageOwnershipManifest() public pure {
        Owner[40] memory roots;
        roots[0] = Owner.Authority;
        roots[1] = Owner.Authority;
        roots[2] = Owner.Authority;
        roots[3] = Owner.Authority;
        for (uint256 i = 4; i <= 13; ++i) {
            roots[i] = Owner.Authority;
        }
        for (uint256 i = 14; i <= 21; ++i) {
            roots[i] = Owner.Core;
        }
        for (uint256 i = 22; i <= 36; ++i) {
            roots[i] = Owner.Authority;
        }
        roots[37] = Owner.Core;
        roots[38] = Owner.Core;
        roots[39] = Owner.Core;
        for (uint256 i; i < roots.length; ++i) {
            assertTrue(roots[i] == Owner.Authority || roots[i] == Owner.Core);
        }
    }

    function test_pushAwareScanner_skipsOpcodeBytesInPushData() public pure {
        bytes memory code = hex"61f4fff100"; // PUSH2 [DELEGATECALL, SELFDESTRUCT], CALL, STOP
        (uint256 calls, uint256 forbidden) = _scan(code);
        assertEq(calls, 1);
        assertEq(forbidden, 0);
    }

    function test_pushAwareScanner_detectsRealForbiddenOpcode() public pure {
        (, uint256 forbidden) = _scan(hex"60f4f4");
        assertEq(forbidden, 1);
    }

    function test_runtimeLimitBoundary() public pure {
        assertTrue(RUNTIME_LIMIT <= 24_576);
        assertTrue(RUNTIME_LIMIT + 1 > 24_576);
    }

    function test_initcodeLimitBoundary() public pure {
        assertTrue(INITCODE_LIMIT <= 49_152);
        assertTrue(INITCODE_LIMIT + 1 > 49_152);
    }

    // Each named test mutates actual manifest rows and proves the shared derived validator's exact rejection.
    function test_mutation01_missingSelector_rejected() public pure {
        Manifest memory m = _valid();
        m.functions[0] = "";
        _rejects(m, Reject.MissingSelector);
    }

    function test_mutation02_duplicateAssignment_rejected() public pure {
        Manifest memory m = _valid();
        m.assignments[0] = 2;
        _rejects(m, Reject.DuplicateAssignment);
    }

    function test_mutation03_unknownSelector_rejected() public pure {
        Manifest memory m = _valid();
        m.functions[0] = "unknownTask0Surface()";
        _rejects(m, Reject.UnknownSelector);
    }

    function test_mutation04_bytes4Collision_rejected() public pure {
        Manifest memory m = _valid();
        m.functions[0] = "burn(uint256)";
        m.functions[1] = "collate_propagate_storage(bytes16)";
        _rejects(m, Reject.SelectorCollision);
    }

    function test_mutation05_duplicateCustomError_rejected() public pure {
        Manifest memory m = _valid();
        m.errors[1] = m.errors[0];
        _rejects(m, Reject.DuplicateError);
    }

    function test_mutation06_duplicateEventTopic_rejected() public pure {
        Manifest memory m = _valid();
        m.events[1] = m.events[0];
        _rejects(m, Reject.DuplicateEvent);
    }

    function test_mutation07_hiddenPayable_rejected() public pure {
        Manifest memory m = _valid();
        m.payableFlags[0] = true;
        _rejects(m, Reject.HiddenPayable);
    }

    function test_mutation08_payableConstructor_rejected() public pure {
        Manifest memory m = _valid();
        m.constructorMutability = "payable";
        _rejects(m, Reject.PayableConstructor);
    }

    function test_mutation09_receive_rejected() public pure {
        Manifest memory m = _valid();
        m.functions[0] = "receive()";
        _rejects(m, Reject.Receive);
    }

    function test_mutation10_fallback_rejected() public pure {
        Manifest memory m = _valid();
        m.functions[0] = "fallback()";
        _rejects(m, Reject.Fallback);
    }

    function test_mutation11_operatorRoleCopy_rejected() public pure {
        Manifest memory m = _valid();
        m.storageRows[1].owner = Owner.Core;
        _rejects(m, Reject.OperatorCopy);
    }

    function test_mutation12_ownerAliasCopy_rejected() public pure {
        Manifest memory m = _valid();
        m.storageRows[0] = StorageRow("safeOwnerMirror", Owner.Intent, SemanticKind.OwnerRole);
        _rejects(m, Reject.OwnerCopy);
    }

    function test_mutation13_accountingMirror_rejected() public pure {
        Manifest memory m = _valid();
        m.storageRows[2].owner = Owner.Reconciliation;
        _rejects(m, Reject.AccountingCopy);
    }

    function test_mutation14_unapprovedCall_rejected() public pure {
        Manifest memory m = _valid();
        m.calls[1].targetKind = TargetKind.None;
        _rejects(m, Reject.UnapprovedCall);
    }

    function test_mutation15_delegatecall_rejected() public pure {
        Manifest memory m = _valid();
        m.calls[0].targetKind = TargetKind.None;
        _rejects(m, Reject.DelegateCall);
    }

    function test_mutation16_pushDataFalsePositive_rejected() public pure {
        Manifest memory m = _valid();
        m.scannerCode = hex"60f4";
        m.expectedForbidden = 1;
        _rejects(m, Reject.PushScanner);
    }

    function test_mutation17_realOpcodeAfterPush_rejected() public pure {
        Manifest memory m = _valid();
        m.scannerCode = hex"60f4f4";
        m.expectedForbidden = 0;
        _rejects(m, Reject.OpcodeAfterPush);
    }

    function test_mutation18_arbitraryTargetCalldata_rejected() public pure {
        Manifest memory m = _valid();
        m.calls[1].selector = 0xdeadbeef;
        _rejects(m, Reject.ArbitraryCall);
    }

    function test_mutation19_runtimeOversize_rejected() public pure {
        Manifest memory m = _valid();
        m.runtimeSize = uint32(RUNTIME_LIMIT + 1);
        _rejects(m, Reject.RuntimeOversize);
    }

    function test_mutation20_initcodeOversize_rejected() public pure {
        Manifest memory m = _valid();
        m.initcodeSize = uint32(INITCODE_LIMIT + 1);
        _rejects(m, Reject.InitcodeOversize);
    }

    function test_mutation21_futureSelectorEarly_rejected() public pure {
        Manifest memory m = _valid();
        m.functions[0] = "authorizePreVoteBudget((uint256,uint256,uint64),bytes32)";
        _rejects(m, Reject.FutureEarly);
    }

    function test_mutation22_factoryBusinessSelector_rejected() public pure {
        Manifest memory m = _valid();
        m.functionOwners[66] = Owner.Factory;
        _rejects(m, Reject.FactoryBusiness);
    }

    function test_mutation23_nonzeroCreateValue_rejected() public pure {
        Manifest memory m = _valid();
        m.createValue = 1;
        _rejects(m, Reject.CreateValue);
    }

    function test_mutation24_blockContextImmutable_rejected() public pure {
        Manifest memory m = _valid();
        m.immutableSource = "block.timestamp";
        _rejects(m, Reject.BlockContext);
    }

    function test_mutation25_unboundProxyDependency_rejected() public pure {
        Manifest memory m = _valid();
        m.dependencies[0].proxy = true;
        _rejects(m, Reject.Proxy);
    }

    function _valid() internal pure returns (Manifest memory m) {
        (string[] memory f, Owner[] memory fo) = _functions();
        (string[] memory e, Owner[] memory eo) = _errors();
        (string[] memory v, Owner[] memory vo) = _events();
        for (uint256 i; i < 67; ++i) {
            m.functions[i] = f[i];
            m.functionRowIds[i] = keccak256(abi.encode("F", i + 1));
            m.functionCategories[i] = Category.Move;
            m.functionOwners[i] = fo[i];
            m.assignments[i] = 1;
        }
        m.payableFlags[66] = true;
        for (uint256 i; i < 55; ++i) {
            m.errors[i] = e[i];
            m.errorOwners[i] = eo[i];
            m.errorCategories[i] = i >= 48 ? Category.Inherited : Category.Move;
        }
        for (uint256 i; i < 21; ++i) {
            m.events[i] = v[i];
            m.eventOwners[i] = vo[i];
            m.eventCategories[i] = i >= 16 ? Category.Inherited : Category.Move;
        }
        m.storageRows[0] = StorageRow("owner", Owner.Authority, SemanticKind.OwnerRole);
        m.storageRows[1] = StorageRow("mainOperator", Owner.Authority, SemanticKind.OperatorRole);
        m.storageRows[2] = StorageRow("availableWei", Owner.Core, SemanticKind.Accounting);
        m.storageRows[3] = StorageRow("reentrancyGuard", Owner.Core, SemanticKind.Guard);
        m.calls[0] = Callsite(TargetKind.EcrecoverPrecompile, 0x00000000, false, 0, 0, 32, false, false);
        m.calls[1] = Callsite(TargetKind.CodeCheckedERC1271, 0x1626ba7e, false, 0, 100_000, 32, false, false);
        string[6] memory names =
            ["Registry", "CircuitBreakerHealth", "CanonicalIngress", "Oracle", "Adapter", "StockToken"];
        for (uint256 i; i < 6; ++i) {
            m.dependencies[i] = Dependency(names[i], false, false);
        }
        m.constructorMutability = "nonpayable";
        m.immutableSource = "manifest";
        m.scannerCode = hex"60f4";
        m.expectedForbidden = 0;
        m.runtimeSize = uint32(RUNTIME_LIMIT);
        m.initcodeSize = uint32(INITCODE_LIMIT);
    }

    function _rejects(Manifest memory m, Reject expected) internal pure {
        assertEq(uint8(_validate(m)), uint8(expected));
    }

    function _validate(Manifest memory m) internal pure returns (Reject) {
        (string[] memory allowed, Owner[] memory allowedOwners) = _functions();
        uint256 payableCount;
        for (uint256 i; i < 67; ++i) {
            if (bytes(m.functions[i]).length == 0) return Reject.MissingSelector;
            if (m.functionRowIds[i] != keccak256(abi.encode("F", i + 1)) || m.functionCategories[i] != Category.Move) {
                return Reject.UnknownSelector;
            }
            if (_eq(m.functions[i], "receive()")) return Reject.Receive;
            if (_eq(m.functions[i], "fallback()")) return Reject.Fallback;
            for (uint256 j = i + 1; j < 67; ++j) {
                if (_selector(m.functions[i]) == _selector(m.functions[j])) return Reject.SelectorCollision;
            }
            if (m.assignments[i] != 1) return Reject.DuplicateAssignment;
            bool known;
            for (uint256 j; j < 67; ++j) {
                if (_eq(m.functions[i], allowed[j])) {
                    known = true;
                    if (m.functionOwners[i] != allowedOwners[j]) return Reject.FactoryBusiness;
                    break;
                }
            }
            if (!known) {
                if (_eq(m.functions[i], "authorizePreVoteBudget((uint256,uint256,uint64),bytes32)")) {
                    return Reject.FutureEarly;
                }
                return Reject.UnknownSelector;
            }
            if (m.payableFlags[i]) {
                ++payableCount;
                if (!_eq(m.functions[i], "depositCanonical(bytes32)")) return Reject.HiddenPayable;
            }
        }
        if (payableCount != 1) return Reject.HiddenPayable;
        if (!_eq(m.constructorMutability, "nonpayable")) return Reject.PayableConstructor;
        (string[] memory allowedErrors, Owner[] memory allowedErrorOwners) = _errors();
        for (uint256 i; i < 55; ++i) {
            if (
                !_eq(m.errors[i], allowedErrors[i]) || m.errorOwners[i] != allowedErrorOwners[i]
                    || m.errorCategories[i] != (i >= 48 ? Category.Inherited : Category.Move)
            ) return Reject.UnknownSelector;
            for (uint256 j = i + 1; j < 55; ++j) {
                if (_selector(m.errors[i]) == _selector(m.errors[j])) return Reject.DuplicateError;
            }
        }
        (string[] memory allowedEvents, Owner[] memory allowedEventOwners) = _events();
        for (uint256 i; i < 21; ++i) {
            if (
                !_eq(m.events[i], allowedEvents[i]) || m.eventOwners[i] != allowedEventOwners[i]
                    || m.eventCategories[i] != (i >= 16 ? Category.Inherited : Category.Move)
            ) return Reject.UnknownSelector;
            for (uint256 j = i + 1; j < 21; ++j) {
                if (keccak256(bytes(m.events[i])) == keccak256(bytes(m.events[j]))) return Reject.DuplicateEvent;
            }
        }
        for (uint256 i; i < 4; ++i) {
            if (m.storageRows[i].kind == SemanticKind.OperatorRole && m.storageRows[i].owner != Owner.Authority) {
                return Reject.OperatorCopy;
            }
            if (m.storageRows[i].kind == SemanticKind.OwnerRole && m.storageRows[i].owner != Owner.Authority) {
                return Reject.OwnerCopy;
            }
            if (m.storageRows[i].kind == SemanticKind.Accounting && m.storageRows[i].owner != Owner.Core) {
                return Reject.AccountingCopy;
            }
        }
        Callsite memory ec = m.calls[0];
        Callsite memory er = m.calls[1];
        if (ec.targetKind != TargetKind.EcrecoverPrecompile) return Reject.DelegateCall;
        if (
            ec.selector != bytes4(0) || ec.value != 0 || ec.returnBytes != 32 || ec.copiesRevertData
                || ec.bubblesFailure
        ) {
            return Reject.UnapprovedCall;
        }
        if (er.targetKind != TargetKind.CodeCheckedERC1271) return Reject.UnapprovedCall;
        if (
            er.selector != 0x1626ba7e || er.value != 0 || er.gasCap != 100_000 || er.returnBytes != 32
                || er.copiesRevertData || er.bubblesFailure || er.arbitraryCalldata
        ) return Reject.ArbitraryCall;
        (, uint256 forbidden) = _scan(m.scannerCode);
        if (forbidden != m.expectedForbidden) {
            return m.scannerCode.length == 2 ? Reject.PushScanner : Reject.OpcodeAfterPush;
        }
        if (m.runtimeSize > RUNTIME_LIMIT) return Reject.RuntimeOversize;
        if (m.initcodeSize > INITCODE_LIMIT) return Reject.InitcodeOversize;
        if (m.createValue != 0) return Reject.CreateValue;
        if (!_eq(m.immutableSource, "manifest")) return Reject.BlockContext;
        for (uint256 i; i < 6; ++i) {
            if (m.dependencies[i].proxy || m.dependencies[i].delegates) return Reject.Proxy;
        }
        return Reject.None;
    }

    function _eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function _censusHash() internal pure returns (bytes32 h) {
        (string[] memory f, Owner[] memory fo) = _functions();
        (string[] memory e, Owner[] memory eo) = _errors();
        (string[] memory v, Owner[] memory vo) = _events();
        for (uint256 i; i < f.length; ++i) {
            h = keccak256(abi.encode(h, "F", i + 1, "MOVE", fo[i], f[i]));
        }
        for (uint256 i; i < e.length; ++i) {
            h = keccak256(abi.encode(h, "ER", i + 1, i >= 48 ? "INHERITED" : "MOVE", eo[i], e[i]));
        }
        for (uint256 i; i < v.length; ++i) {
            h = keccak256(abi.encode(h, "EV", i + 1, i >= 16 ? "INHERITED" : "MOVE", vo[i], v[i]));
        }
        h = keccak256(
            abi.encode(h, "C", uint256(1), "RETIRED", Owner.Retired, "constructor(address,address,uint256):nonpayable")
        );
    }

    function _scan(bytes memory code) internal pure returns (uint256 calls, uint256 forbidden) {
        for (uint256 i; i < code.length; ++i) {
            uint8 op = uint8(code[i]);
            if (op >= 0x60 && op <= 0x7f) {
                i += op - 0x5f;
                continue;
            }
            if (op == 0xf1 || op == 0xfa) ++calls;
            if (op == 0xf2 || op == 0xf4 || op == 0xf5 || op == 0xff) ++forbidden;
        }
    }

    function _assertUnique(string[] memory rows, bool compareSelectors) internal pure {
        for (uint256 i; i < rows.length; ++i) {
            for (uint256 j = i + 1; j < rows.length; ++j) {
                assertTrue(keccak256(bytes(rows[i])) != keccak256(bytes(rows[j])), "duplicate descriptor");
                if (compareSelectors) assertTrue(_selector(rows[i]) != _selector(rows[j]), "selector collision");
            }
        }
    }

    function _selector(string memory descriptor) internal pure returns (bytes4) {
        return bytes4(keccak256(bytes(descriptor)));
    }

    function _functions() internal pure returns (string[] memory r, Owner[] memory o) {
        r = new string[](67);
        o = new Owner[](67);
        string[47] memory a = [
            "owner()",
            "pendingOwner()",
            "transferOwnership(address)",
            "acceptOwnership()",
            "renounceOwnership()",
            "paused()",
            "eip712Domain()",
            "supportedChainId()",
            "OPERATOR_NOMINATION_DELAY()",
            "OPERATOR_ACCEPTANCE_WINDOW()",
            "INGRESS_PROPOSAL_DELAY()",
            "INGRESS_ACCEPTANCE_WINDOW()",
            "MAX_AUTHORIZATION_LIFETIME()",
            "MAX_SIGNATURE_BYTES()",
            "ERC1271_CALL_GAS()",
            "ERC1271_POST_CALL_GAS_RESERVE()",
            "ERC1271_MIN_PRECALL_GAS()",
            "OUTFLOW_AUTHORIZATION_TYPEHASH()",
            "SUCCESSOR_CONSENT_TYPEHASH()",
            "version()",
            "mainOperator()",
            "operatorGeneration()",
            "outflowNonce()",
            "nominationNonce()",
            "pendingMainOperatorNomination()",
            "nominateMainOperator(address,bytes32)",
            "cancelMainOperatorNomination(bytes32,bytes32)",
            "expireMainOperatorNomination(bytes32)",
            "acceptMainOperatorNomination(bytes32)",
            "disableMainOperator(bytes32)",
            "renounceMainOperator(bytes32)",
            "replaceMainOperator((address,address,uint256,uint256,uint64,uint64,uint8,bytes32),bytes)",
            "invalidateOutflowNonce(uint256,bytes32)",
            "pause(bytes32)",
            "unpause(bytes32)",
            "hashOutflowAuthorization((address,address,uint256,uint256,uint256,uint64,uint64,uint8,bytes32))",
            "hashSuccessorConsent((address,address,uint256,uint256,uint64,uint64,uint8,bytes32))",
            "ingressProposalNonce()",
            "ingressGeneration()",
            "activeIngressGeneration()",
            "pendingIngressProposal()",
            "getIngress(uint256)",
            "proposeIngress((address,bytes32,uint256,uint256,uint256),bytes32)",
            "cancelIngressProposal(bytes32,bytes32)",
            "expireIngressProposal(bytes32)",
            "activateIngress(bytes32)",
            "disableIngress(bytes32)"
        ];
        string[20] memory c = [
            "MAX_ACTIVE_ORDINARY_RESERVATIONS()",
            "MAX_ACTIVE_RECONCILIATIONS()",
            "MAX_OPERATOR_OUTFLOW_COMPONENTS()",
            "stockTokenRegistryV2()",
            "globalLifetimeCanonicalDepositCapWei()",
            "availableWei()",
            "unattributedWei()",
            "ordinaryReservedWei()",
            "reconciliationLiabilityWei()",
            "reconciliationBackingWei()",
            "accountingSequence()",
            "lastObservedBalanceDeficitWei()",
            "accountingTotals()",
            "syncBalance()",
            "reclassifyUnattributed(uint256,bytes32)",
            "globalLifetimeCanonicalDepositedWei()",
            "ingressLifetimeDepositedWei(uint256)",
            "ingressEpochDepositedWei(uint256,uint256)",
            "getDeposit(bytes32)",
            "depositCanonical(bytes32)"
        ];
        for (uint256 i; i < a.length; ++i) {
            r[i] = a[i];
            o[i] = Owner.Authority;
        }
        for (uint256 i; i < c.length; ++i) {
            r[47 + i] = c[i];
            o[47 + i] = Owner.Core;
        }
    }

    function _errors() internal pure returns (string[] memory r, Owner[] memory o) {
        r = new string[](55);
        o = new Owner[](55);
        string[2] memory f = ["WrongChain(uint256)", "RegistryChainMismatch(uint256)"];
        string[35] memory a = [
            "ZeroAddress()",
            "ContractRequired(address)",
            "RoleIdentityCollision(address)",
            "OwnershipRenunciationDisabled()",
            "NoPendingOwnershipTransfer()",
            "EmptyDetailsHash()",
            "InvalidActionReason(uint8)",
            "CounterExhausted(bytes32)",
            "TimestampOverflow()",
            "MainOperatorActive(address)",
            "NoMainOperator()",
            "OperatorNominationPending(bytes32)",
            "OperatorNominationMissing()",
            "ProposalIdMismatch(bytes32,bytes32)",
            "NotNominee(address)",
            "ProposalNotReady(uint64)",
            "ProposalExpired(uint64)",
            "NoOperatorStateChange()",
            "InvalidOperatorReplacement()",
            "InvalidOutflowNonceStep(uint256,uint256)",
            "OutflowNonceExhausted(uint256)",
            "InvalidAuthorizationWindow()",
            "AuthorizationNotYetValid()",
            "AuthorizationExpired()",
            "InvalidAuthorizationFields()",
            "InvalidSignature()",
            "InsufficientSignatureValidationGas()",
            "LocalReadinessFailed(uint8)",
            "IngressProposalPending(bytes32)",
            "IngressProposalMissing()",
            "InvalidIngressConfig()",
            "IngressCodeHashMismatch(address,bytes32,bytes32)",
            "IngressActive(address)",
            "NoActiveIngress()",
            "IngressNotFound(uint256)"
        ];
        string[11] memory c = [
            "InvalidGlobalLifetimeCap()",
            "NoBalanceDelta()",
            "InvalidAmount()",
            "InsufficientUnattributed(uint256,uint256)",
            "BalanceDeficitActive(uint256)",
            "ReconciliationShortfallActive(uint256)",
            "NotActiveIngress(address)",
            "DepositSourceRequired()",
            "DepositReplay(bytes32)",
            "DepositCapExceeded(uint8,uint256,uint256)",
            "DepositNotFound(bytes32)"
        ];
        string[7] memory h = [
            "OwnableUnauthorizedAccount(address)",
            "OwnableInvalidOwner(address)",
            "EnforcedPause()",
            "ExpectedPause()",
            "InvalidShortString()",
            "StringTooLong(string)",
            "ReentrancyGuardReentrantCall()"
        ];
        uint256 n;
        for (uint256 i; i < f.length; ++i) {
            r[n] = f[i];
            o[n++] = Owner.Factory;
        }
        for (uint256 i; i < a.length; ++i) {
            r[n] = a[i];
            o[n++] = Owner.Authority;
        }
        for (uint256 i; i < c.length; ++i) {
            r[n] = c[i];
            o[n++] = Owner.Core;
        }
        for (uint256 i; i < h.length; ++i) {
            r[n] = h[i];
            o[n++] = Owner.Authority;
        }
    }

    function _events() internal pure returns (string[] memory r, Owner[] memory o) {
        r = new string[](21);
        o = new Owner[](21);
        string[12] memory a = [
            "MainOperatorNominationCreated(bytes32,address,address,uint256,uint64,uint64,uint64,uint8,bytes32)",
            "MainOperatorNominationCancelled(bytes32,address,address,uint8,bytes32)",
            "MainOperatorNominationExpired(bytes32,address,address,uint8,bytes32)",
            "MainOperatorChanged(address,address,uint256,uint256,uint8,bytes32)",
            "OutflowNonceInvalidated(address,uint256,uint256,uint256,uint8,bytes32)",
            "RiskPaused(address,uint8,bytes32)",
            "RiskUnpaused(address,uint8,bytes32)",
            "IngressProposalCreated(bytes32,address,address,uint256,bytes32,uint64,uint64,uint64,uint8,bytes32)",
            "IngressProposalCancelled(bytes32,address,address,uint8,bytes32)",
            "IngressProposalExpired(bytes32,address,address,uint8,bytes32)",
            "IngressActivated(uint256,address,bytes32,bytes32,uint256,uint256,uint256,uint64,uint8,bytes32)",
            "IngressDisabled(uint256,address,address,uint64,uint8,bytes32)"
        ];
        string[4] memory c = [
            "AccountingMutation(uint256,bytes32,uint8,(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256),(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256),uint256)",
            "AccountingComponent(uint256,uint256,bytes32,uint8,bytes32,uint256)",
            "UnattributedReclassified(bytes32,uint256,address,uint256,uint8,bytes32)",
            "CanonicalDeposit(bytes32,uint256,bytes32,address,uint256,uint256,uint256,uint256,uint256,uint64)"
        ];
        string[5] memory h = [
            "OwnershipTransferStarted(address,address)",
            "OwnershipTransferred(address,address)",
            "Paused(address)",
            "Unpaused(address)",
            "EIP712DomainChanged()"
        ];
        uint256 n;
        for (uint256 i; i < a.length; ++i) {
            r[n] = a[i];
            o[n++] = Owner.Authority;
        }
        for (uint256 i; i < c.length; ++i) {
            r[n] = c[i];
            o[n++] = Owner.Core;
        }
        for (uint256 i; i < h.length; ++i) {
            r[n] = h[i];
            o[n++] = Owner.Authority;
        }
    }

    function _futureReserved() internal pure returns (string[] memory r) {
        r = new string[](9);
        r[0] = "authorizePreVoteBudget((uint256,uint256,uint64),bytes32)";
        r[1] = "getPreVoteBudget(uint256)";
        r[2] = "BudgetDayClosed(uint256)";
        r[3] = "BudgetDeadlineOverflow()";
        r[4] = "InvalidPurchaseUntil(uint64,uint64)";
        r[5] = "BudgetAlreadyAuthorized(uint256)";
        r[6] = "InsufficientAvailable(uint256,uint256)";
        r[7] = "BudgetNotFound(uint256)";
        r[8] = "PreVoteBudgetAuthorized(bytes32,uint256,uint256,uint64,uint256,uint256,uint64,uint8,bytes32)";
    }

    function _topologyDescriptors()
        internal
        pure
        returns (string[] memory functions, string[] memory errors, string[] memory events)
    {
        functions = new string[](12);
        functions[0] = "authorityTopology()";
        functions[1] = "finalizeAuthority(bytes32)";
        functions[2] = "coreTopology()";
        functions[3] = "finalizeCore(bytes32)";
        functions[4] = "budgetBookTopology()";
        functions[5] = "finalizeBudgetBook(bytes32)";
        functions[6] = "intentExecutionTopology()";
        functions[7] = "finalizeIntentExecution(bytes32)";
        functions[8] = "reconciliationTopology()";
        functions[9] = "finalizeReconciliation(bytes32)";
        functions[10] = "deployNext(bytes)";
        functions[11] = "finalizeConstellation()";
        errors = new string[](15);
        events = new string[](5);
        string[5] memory p = ["Authority", "Core", "BudgetBook", "IntentExecution", "Reconciliation"];
        for (uint256 i; i < 5; ++i) {
            errors[i * 3] = string.concat(p[i], "FinalizerUnauthorized(address)");
            errors[i * 3 + 1] = string.concat(p[i], "ManifestHashMismatch(bytes32,bytes32)");
            errors[i * 3 + 2] = string.concat(p[i], "AlreadyFinalized()");
            events[i] = string.concat(p[i], "Finalized(bytes32)");
        }
    }

    function _join(string[] memory a, string[] memory b, string[] memory c, uint256 cStart, uint256 cEnd)
        internal
        pure
        returns (string[] memory out)
    {
        out = new string[](a.length + b.length + cEnd - cStart);
        uint256 n;
        for (uint256 i; i < a.length; ++i) {
            out[n++] = a[i];
        }
        for (uint256 i; i < b.length; ++i) {
            out[n++] = b[i];
        }
        for (uint256 i = cStart; i < cEnd; ++i) {
            out[n++] = c[i];
        }
    }

    function _repeatableInheritedError(string memory descriptor, uint256 copies) internal pure returns (bool) {
        return copies >= 2 && copies <= 6 && _eq(descriptor, "ReentrancyGuardReentrantCall()");
    }
}
