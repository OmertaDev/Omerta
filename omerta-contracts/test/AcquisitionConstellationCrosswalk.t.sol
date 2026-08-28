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
        Topology,
        NewV2
    }
    enum SemanticKind {
        None,
        Eip712Fallback,
        OwnerRole,
        PauseState,
        OperatorRole,
        IngressAuthority,
        Accounting,
        Guard
    }
    enum TargetKind {
        None,
        EcrecoverPrecompile,
        CodeCheckedERC1271,
        Registry,
        ChildTopology,
        ChildFinalizer,
        RawCreate
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
    uint256 internal constant TASK4_FUNCTION_COUNT = 85;
    uint256 internal constant TASK4_ERROR_COUNT = 164;
    uint256 internal constant TASK4_EVENT_COUNT = 29;
    uint256 internal constant TASK4_CONSTRUCTOR_COUNT = 6;
    uint256 internal constant TASK4_ABI_COUNT = 284;
    uint256 internal constant TASK4_UNIQUE_FUNCTION_COUNT = 85;
    uint256 internal constant TASK4_UNIQUE_ERROR_COUNT = 163;
    uint256 internal constant TASK4_UNIQUE_EVENT_COUNT = 29;
    uint256 internal constant TASK5_FUNCTION_COUNT = 87;
    uint256 internal constant TASK5_ERROR_COUNT = 168;
    uint256 internal constant TASK5_EVENT_COUNT = 29;
    uint256 internal constant TASK5_CONSTRUCTOR_COUNT = 6;
    uint256 internal constant TASK5_ABI_COUNT = 290;
    uint256 internal constant TASK5_UNIQUE_FUNCTION_COUNT = 87;
    uint256 internal constant TASK5_UNIQUE_ERROR_COUNT = 167;
    uint256 internal constant TASK5_UNIQUE_EVENT_COUNT = 29;
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
        uint8 startRoot;
        uint8 endRoot;
    }

    struct Callsite {
        string context;
        TargetKind targetKind;
        bytes4 selector;
        bool arbitraryCalldata;
        uint256 value;
        uint256 gasCap;
        uint16 returnBytes;
        bool copiesRevertData;
        bool bubblesFailure;
        uint256 postCallReserve;
        string failurePolicy;
    }

    struct Dependency {
        string name;
        Owner owner;
        string introductionNode;
        string provenance;
        bool proxy;
        bool delegates;
    }

    struct DescriptorRow {
        bytes32 id;
        Category category;
        Owner owner;
        string descriptor;
    }

    struct Task4ArtifactCensus {
        uint256 functionCount;
        uint256 errorCount;
        uint256 eventCount;
        uint256 constructorCount;
        uint256 abiCount;
        uint256 authorityGuardCount;
        uint256 coreGuardCount;
        uint256 otherGuardCount;
    }

    struct ArtifactDescriptorPartition {
        uint256 functionCount;
        bytes32 functionHash;
        uint256 errorCount;
        bytes32 errorHash;
        uint256 eventCount;
        bytes32 eventHash;
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
        StorageRow[] storageRows;
        Callsite[14] calls;
        Dependency[6] dependencies;
        string constructorMutability;
        string immutableSource;
        bytes scannerCode;
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

    function test_task1Green_exactSixFinalArtifactsArePresent() public {
        for (uint256 i; i < finalArtifacts.length; ++i) {
            assertTrue(vm.exists(finalArtifacts[i]), finalArtifacts[i]);
        }
    }

    function test_task4_frozenAggregateConstantsRemainHistorical() public pure {
        assertEq(TASK4_FUNCTION_COUNT, 85);
        assertEq(TASK4_ERROR_COUNT, 164);
        assertEq(TASK4_EVENT_COUNT, 29);
        assertEq(TASK4_CONSTRUCTOR_COUNT, 6);
        assertEq(TASK4_ABI_COUNT, 284);
        assertEq(TASK4_UNIQUE_FUNCTION_COUNT, 85);
        assertEq(TASK4_UNIQUE_ERROR_COUNT, 163);
        assertEq(TASK4_UNIQUE_EVENT_COUNT, 29);
    }

    function test_task5_exactAggregateAndCollisionUniverse() public view {
        string[] memory functions = new string[](TASK5_FUNCTION_COUNT);
        string[] memory errors = new string[](TASK5_ERROR_COUNT);
        string[] memory events = new string[](TASK5_EVENT_COUNT);
        Task4ArtifactCensus memory census;

        for (uint256 artifactIndex; artifactIndex < finalArtifacts.length; ++artifactIndex) {
            string memory json = vm.readFile(finalArtifacts[artifactIndex]);
            for (uint256 abiIndex; vm.keyExistsJson(json, _abiPath(abiIndex)); ++abiIndex) {
                string memory path = _abiPath(abiIndex);
                string memory kind = vm.parseJsonString(json, string.concat(path, ".type"));
                uint8 classified = _classifyAbiKind(kind);
                ++census.abiCount;
                if (classified == 1) {
                    ++census.constructorCount;
                } else if (classified == 2) {
                    functions[census.functionCount++] = _artifactDescriptor(json, path);
                } else if (classified == 3) {
                    string memory descriptor = _artifactDescriptor(json, path);
                    errors[census.errorCount++] = descriptor;
                    if (_sameBytes(descriptor, "ReentrancyGuardReentrantCall()")) {
                        if (artifactIndex == 1) ++census.authorityGuardCount;
                        else if (artifactIndex == 2) ++census.coreGuardCount;
                        else ++census.otherGuardCount;
                    }
                } else if (classified == 4) {
                    events[census.eventCount++] = _artifactDescriptor(json, path);
                } else {
                    assertTrue(false, "unexpected compiled ABI kind");
                }
            }
        }

        assertEq(census.abiCount, TASK5_ABI_COUNT);
        assertEq(census.functionCount, TASK5_FUNCTION_COUNT);
        assertEq(census.errorCount, TASK5_ERROR_COUNT);
        assertEq(census.eventCount, TASK5_EVENT_COUNT);
        assertEq(census.constructorCount, TASK5_CONSTRUCTOR_COUNT);
        assertEq(
            census.functionCount + census.errorCount + census.eventCount + census.constructorCount, TASK5_ABI_COUNT
        );
        assertEq(_uniqueDescriptorCount(functions, true, false), TASK5_UNIQUE_FUNCTION_COUNT);
        assertEq(_uniqueDescriptorCount(errors, true, true), TASK5_UNIQUE_ERROR_COUNT);
        assertEq(_uniqueDescriptorCount(events, false, false), TASK5_UNIQUE_EVENT_COUNT);
        assertEq(_uniqueEventTopicCount(events), TASK5_UNIQUE_EVENT_COUNT);
        assertTrue(_validGuardOwnership(census.authorityGuardCount, census.coreGuardCount, census.otherGuardCount));
    }

    function test_task5_nonIntentArtifactsHaveExactFrozenDescriptorPartitions() public view {
        uint256[5] memory artifactIndexes = [uint256(0), 1, 2, 3, 5];
        ArtifactDescriptorPartition[5] memory expected = _nonIntentArtifactPartitions();

        for (uint256 i; i < artifactIndexes.length; ++i) {
            string memory json = vm.readFile(finalArtifacts[artifactIndexes[i]]);
            _assertArtifactDescriptorPartition(json, expected[i]);
        }
    }

    function test_task5_sameKindSameCountDescriptorSubstitutionRejectedByExactPartition() public view {
        string[] memory functions = _artifactDescriptorsByKind(vm.readFile(finalArtifacts[0]), "function");
        ArtifactDescriptorPartition[5] memory expected = _nonIntentArtifactPartitions();
        assertTrue(_matchesDescriptorPartition(functions, expected[0].functionCount, expected[0].functionHash));

        string memory original = functions[0];
        functions[0] = "factoryStateMutated()";
        assertFalse(_eq(original, functions[0]), "hostile fixture must replace a distinct descriptor");
        assertEq(functions.length, expected[0].functionCount, "hostile fixture must preserve kind cardinality");
        _assertUnique(functions, true);
        assertEq(_uniqueDescriptorCount(functions, true, false), expected[0].functionCount);
        assertFalse(
            _matchesDescriptorPartition(functions, expected[0].functionCount, expected[0].functionHash),
            "exact artifact ownership accepted same-kind same-count substitution"
        );
    }

    function test_task5_exactDescriptorPartitionAcceptsSetReordering() public view {
        string[] memory functions = _artifactDescriptorsByKind(vm.readFile(finalArtifacts[1]), "function");
        ArtifactDescriptorPartition[5] memory expected = _nonIntentArtifactPartitions();
        assertTrue(_matchesDescriptorPartition(functions, expected[1].functionCount, expected[1].functionHash));

        string memory first = functions[0];
        string memory second = functions[1];
        assertFalse(_eq(first, second), "reorder fixture requires distinct descriptors");
        (functions[0], functions[1]) = (functions[1], functions[0]);
        assertTrue(_eq(functions[0], second) && _eq(functions[1], first), "reorder fixture must change ABI order");
        assertTrue(
            _matchesDescriptorPartition(functions, expected[1].functionCount, expected[1].functionHash),
            "exact descriptor set rejected harmless ABI reorder"
        );
    }

    function test_task4_abiKindClassificationFailsClosed() public pure {
        assertEq(_classifyAbiKind("constructor"), 1);
        assertEq(_classifyAbiKind("function"), 2);
        assertEq(_classifyAbiKind("error"), 3);
        assertEq(_classifyAbiKind("event"), 4);
        assertEq(_classifyAbiKind("receive"), 0);
        assertEq(_classifyAbiKind("fallback"), 0);
        assertEq(_classifyAbiKind("Function"), 0);
        assertEq(_classifyAbiKind(" function"), 0);
    }

    function test_task4_eventTopicCollisionMutationRejected() public pure {
        bytes32[] memory topics = new bytes32[](2);
        topics[0] = keccak256("EventOne(uint256)");
        topics[1] = keccak256("EventTwo(uint256)");
        assertTrue(_uniqueHashes(topics));
        topics[1] = topics[0];
        assertFalse(_uniqueHashes(topics));
    }

    function test_task4_guardOwnershipMutationRejected() public pure {
        assertTrue(_validGuardOwnership(1, 1, 0));
        assertFalse(_validGuardOwnership(0, 1, 1));
        assertFalse(_validGuardOwnership(1, 0, 1));
        assertFalse(_validGuardOwnership(2, 0, 0));
        assertFalse(_validGuardOwnership(0, 2, 0));
        assertFalse(_validGuardOwnership(1, 1, 1));
    }

    function test_task4_budgetRowsTransitionedFromHistoricalFutureToCompiledOwnership() public view {
        string[] memory historical = _futureReserved();
        string memory json = vm.readFile(finalArtifacts[3]);
        uint256[3] memory matched;
        for (uint256 abiIndex; vm.keyExistsJson(json, _abiPath(abiIndex)); ++abiIndex) {
            string memory path = _abiPath(abiIndex);
            string memory kind = vm.parseJsonString(json, string.concat(path, ".type"));
            if (_eq(kind, "constructor")) continue;
            string memory descriptor = _artifactDescriptor(json, path);
            for (uint256 historicalIndex; historicalIndex < historical.length; ++historicalIndex) {
                if (!_eq(descriptor, historical[historicalIndex])) continue;
                if (_eq(kind, "function")) ++matched[0];
                else if (_eq(kind, "error")) ++matched[1];
                else if (_eq(kind, "event")) ++matched[2];
                else assertTrue(false, "historical row compiled under wrong ABI kind");
            }
        }
        assertEq(matched[0], 2, "Task4 BudgetBook function transition");
        assertEq(matched[1], 6, "Task4 BudgetBook error transition");
        assertEq(matched[2], 1, "Task4 BudgetBook event transition");
        assertEq(_activeFutureReserved().length, 0, "Task4 historical rows still active future reservations");
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
        (string[] memory legacyEvents,) = _events();
        (DescriptorRow[] memory tf, DescriptorRow[] memory te, DescriptorRow[] memory tv) = _topologyRows();
        DescriptorRow[] memory fr = _futureRows();
        (DescriptorRow[] memory nf, DescriptorRow[] memory ne, DescriptorRow[] memory nv) = _task5NewV2Rows();
        string[] memory topologyFunctions = _rowDescriptors(tf);
        string[] memory topologyEvents = _rowDescriptors(tv);
        string[] memory future = _rowDescriptors(fr);
        assertTrue(_validRows(tf, tf));
        assertTrue(_validRows(te, te));
        assertTrue(_validRows(tv, tv));
        assertTrue(_validRows(fr, fr));
        assertTrue(_validRows(nf, nf));
        assertTrue(_validRows(ne, ne));
        assertEq(nv.length, 0);

        string[] memory task4Functions = _join(legacyFunctions, topologyFunctions, future, 0, 2);
        string[] memory functions = _joinTwo(task4Functions, _rowDescriptors(nf));
        string[] memory events = _join(legacyEvents, topologyEvents, future, 8, 9);
        _assertUnique(functions, true);
        assertTrue(_combinedErrorUniverseIsValid(te, fr, ne));
        _assertUnique(events, false);
        assertEq(functions.length, 67 + 14 + 2 + 2);
        assertEq(55 + te.length + 6 + ne.length, 55 + 51 + 6 + 4);
        assertEq(events.length, 21 + 7 + 1);
    }

    function test_task5_newV2RowsExactTransitionOwnerCategoryAndCardinality() public view {
        (DescriptorRow[] memory functions, DescriptorRow[] memory errors, DescriptorRow[] memory events) =
            _task5NewV2Rows();
        assertEq(functions.length, 2);
        assertEq(errors.length, 4);
        assertEq(events.length, 0);
        assertEq(_activeFutureReserved().length, 0);
        for (uint256 i; i < functions.length; ++i) {
            assertEq(uint8(functions[i].category), uint8(Category.NewV2));
            assertEq(uint8(functions[i].owner), uint8(Owner.Intent));
            assertEq(functions[i].id, keccak256(abi.encode("T5NF", i + 1)));
        }
        for (uint256 i; i < errors.length; ++i) {
            assertEq(uint8(errors[i].category), uint8(Category.NewV2));
            assertEq(uint8(errors[i].owner), uint8(Owner.Intent));
            assertEq(errors[i].id, keccak256(abi.encode("T5NE", i + 1)));
        }

        _assertTask5IntentArtifactRows(functions, errors);
    }

    function _assertTask5IntentArtifactRows(DescriptorRow[] memory functions, DescriptorRow[] memory errors)
        internal
        view
    {
        string memory json = vm.readFile(finalArtifacts[4]);
        uint256[2] memory functionMatches;
        uint256[4] memory errorMatches;
        uint256 topologyFunctions;
        uint256 topologyErrors;
        uint256 topologyEvents;
        uint256 constructors;
        for (uint256 abiIndex; vm.keyExistsJson(json, _abiPath(abiIndex)); ++abiIndex) {
            string memory path = _abiPath(abiIndex);
            string memory kind = vm.parseJsonString(json, string.concat(path, ".type"));
            if (_eq(kind, "constructor")) {
                ++constructors;
                continue;
            }
            string memory descriptor = _artifactDescriptor(json, path);
            if (_eq(kind, "function")) {
                uint256 matchIndex = _matchingRow(descriptor, functions);
                if (matchIndex != 0) {
                    ++functionMatches[matchIndex - 1];
                } else {
                    assertTrue(
                        _eq(descriptor, "intentExecutionTopology()")
                            || _eq(descriptor, "finalizeIntentExecution(bytes32)"),
                        "extra Intent function outside Task4 topology and Task5 NewV2"
                    );
                    ++topologyFunctions;
                }
            } else if (_eq(kind, "error")) {
                uint256 matchIndex = _matchingRow(descriptor, errors);
                if (matchIndex != 0) {
                    ++errorMatches[matchIndex - 1];
                } else {
                    assertTrue(_isTask4IntentError(descriptor), "extra Intent error outside Task4 and Task5 NewV2");
                    ++topologyErrors;
                }
            } else if (_eq(kind, "event")) {
                assertEq(descriptor, "IntentExecutionFinalized(bytes32)", "extra Intent event");
                ++topologyEvents;
            } else {
                assertTrue(false, "unexpected Intent ABI kind");
            }
        }
        assertEq(constructors, 1);
        assertEq(topologyFunctions, 2);
        assertEq(topologyErrors, 5);
        assertEq(topologyEvents, 1);
        for (uint256 i; i < functionMatches.length; ++i) {
            assertEq(functionMatches[i], 1, "NewV2 function match");
        }
        for (uint256 i; i < errorMatches.length; ++i) {
            assertEq(errorMatches[i], 1, "NewV2 error match");
        }
    }

    function test_task5_newV2MutationProofsRejectIdCategoryOwnerDescriptorAndCardinality() public pure {
        (DescriptorRow[] memory expectedFunctions, DescriptorRow[] memory expectedErrors,) = _task5NewV2Rows();
        (DescriptorRow[] memory actualFunctions, DescriptorRow[] memory actualErrors,) = _task5NewV2Rows();
        actualFunctions[0].id = bytes32(0);
        assertFalse(_validRows(actualFunctions, expectedFunctions));
        (actualFunctions,,) = _task5NewV2Rows();
        actualFunctions[0].category = Category.Topology;
        assertFalse(_validRows(actualFunctions, expectedFunctions));
        (actualFunctions,,) = _task5NewV2Rows();
        actualFunctions[0].owner = Owner.Core;
        assertFalse(_validRows(actualFunctions, expectedFunctions));
        (actualFunctions,,) = _task5NewV2Rows();
        actualFunctions[0].descriptor = "deriveIntentId(bytes32,uint256)";
        assertFalse(_validRows(actualFunctions, expectedFunctions));
        DescriptorRow[] memory shortFunctions = new DescriptorRow[](1);
        shortFunctions[0] = expectedFunctions[0];
        assertFalse(_validRows(shortFunctions, expectedFunctions));
        (actualFunctions,,) = _task5NewV2Rows();
        assertTrue(actualFunctions[0].id != actualFunctions[1].id);
        assertFalse(_eq(actualFunctions[0].descriptor, actualFunctions[1].descriptor));
        actualFunctions[1] = actualFunctions[0];
        assertFalse(_validRows(actualFunctions, expectedFunctions));
        (actualFunctions,,) = _task5NewV2Rows();
        assertEq(uint8(actualFunctions[0].owner), uint8(actualFunctions[1].owner));
        assertTrue(actualFunctions[0].id != actualFunctions[1].id);
        (actualFunctions[0], actualFunctions[1]) = (actualFunctions[1], actualFunctions[0]);
        assertFalse(_validRows(actualFunctions, expectedFunctions));
        actualErrors[0].category = Category.FutureReserved;
        assertFalse(_validRows(actualErrors, expectedErrors));
    }

    function test_mutation35_sameOwnerTopologyRowSwap_rejected() public pure {
        (DescriptorRow[] memory actual,,) = _topologyRows();
        (DescriptorRow[] memory expected,,) = _topologyRows();
        assertTrue(_validRows(actual, expected));
        (actual[10], actual[11]) = (actual[11], actual[10]);
        assertFalse(_validRows(actual, expected));
    }

    function test_mutation36_topologyOwner_rejected() public pure {
        (DescriptorRow[] memory actual,,) = _topologyRows();
        (DescriptorRow[] memory expected,,) = _topologyRows();
        assertTrue(_validRows(actual, expected));
        actual[0].owner = Owner.Core;
        assertFalse(_validRows(actual, expected));
    }

    function test_mutation37_futureCategory_rejected() public pure {
        DescriptorRow[] memory actual = _futureRows();
        DescriptorRow[] memory expected = _futureRows();
        actual[0].category = Category.Topology;
        assertFalse(_validRows(actual, expected));
    }

    function test_mutation38_pauseSemanticKind_rejected() public pure {
        Manifest memory m = _valid();
        m.storageRows[4].kind = SemanticKind.OwnerRole;
        _rejects(m, Reject.AccountingCopy);
    }

    function test_mutation39_ingressSemanticKind_rejected() public pure {
        Manifest memory m = _valid();
        m.storageRows[18].kind = SemanticKind.OperatorRole;
        _rejects(m, Reject.AccountingCopy);
    }

    function test_mutation34_nonGuardRepeatedInheritedError_rejected() public pure {
        string[] memory rows = new string[](2);
        Owner[] memory owners = new Owner[](2);
        rows[0] = "OwnableUnauthorizedAccount(address)";
        rows[1] = "OwnableUnauthorizedAccount(address)";
        owners[0] = Owner.Authority;
        owners[1] = Owner.Core;
        assertFalse(_validErrorUniverse(rows, owners));
    }

    function test_validManifest_isAccepted() public pure {
        assertEq(uint8(_validate(_valid())), uint8(Reject.None));
    }

    function test_storageOwnershipManifest() public pure {
        Manifest memory m = _valid();
        assertEq(uint8(_validate(m)), uint8(Reject.None));
        assertEq(m.storageRows.length, 27);
    }

    function test_pushAwareScanner_skipsOpcodeBytesInPushData() public pure {
        bytes memory code = hex"61f4fff100"; // PUSH2 [DELEGATECALL, SELFDESTRUCT], CALL, STOP
        (uint256 calls, uint256 forbidden, bool malformed) = _scan(code);
        assertEq(calls, 1);
        assertEq(forbidden, 0);
        assertFalse(malformed);
    }

    function test_pushAwareScanner_detectsRealForbiddenOpcode() public pure {
        (, uint256 forbidden, bool malformed) = _scan(hex"60f4f4");
        assertEq(forbidden, 1);
        assertFalse(malformed);
    }

    function test_pushAwareScanner_truncatedPushFailsClosed() public pure {
        (,, bool malformed) = _scan(hex"62aabb");
        assertTrue(malformed);
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
        m.storageRows[5].owner = Owner.Core;
        _rejects(m, Reject.OperatorCopy);
    }

    function test_mutation12_ownerAliasCopy_rejected() public pure {
        Manifest memory m = _valid();
        m.storageRows[0] = StorageRow("safeOwnerMirror", Owner.Intent, SemanticKind.OwnerRole, 0, 0);
        _rejects(m, Reject.OwnerCopy);
    }

    function test_mutation13_accountingMirror_rejected() public pure {
        Manifest memory m = _valid();
        m.storageRows[10].owner = Owner.Reconciliation;
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

    function test_mutation16_executableForbiddenOpcode_rejected() public pure {
        Manifest memory m = _valid();
        m.scannerCode = hex"61f4fff100f4";
        _rejects(m, Reject.OpcodeAfterPush);
    }

    function test_mutation17_truncatedPush_rejected() public pure {
        Manifest memory m = _valid();
        m.scannerCode = hex"62aabb";
        _rejects(m, Reject.PushScanner);
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

    function test_mutation26_sameOwnerFunctionRowSwap_rejected() public pure {
        Manifest memory m = _valid();
        (m.functions[0], m.functions[1]) = (m.functions[1], m.functions[0]);
        _rejects(m, Reject.UnknownSelector);
    }

    function test_mutation27_storageRangeBoundary_rejected() public pure {
        Manifest memory m = _valid();
        m.storageRows[9].endRoot = 12;
        _rejects(m, Reject.AccountingCopy);
    }

    function test_mutation28_storageRowSwap_rejected() public pure {
        Manifest memory m = _valid();
        (m.storageRows[10], m.storageRows[11]) = (m.storageRows[11], m.storageRows[10]);
        _rejects(m, Reject.AccountingCopy);
    }

    function test_mutation29_topologyGasCap_rejected() public pure {
        Manifest memory m = _valid();
        m.calls[3].gasCap = 50_001;
        _rejects(m, Reject.UnapprovedCall);
    }

    function test_mutation30_finalizerReturnPolicy_rejected() public pure {
        Manifest memory m = _valid();
        m.calls[8].returnBytes = 32;
        _rejects(m, Reject.UnapprovedCall);
    }

    function test_mutation31_finalizerPostReserve_rejected() public pure {
        Manifest memory m = _valid();
        m.calls[8].postCallReserve = 99_999;
        _rejects(m, Reject.UnapprovedCall);
    }

    function test_mutation32_createValuePolicy_rejected() public pure {
        Manifest memory m = _valid();
        m.calls[13].value = 1;
        _rejects(m, Reject.UnapprovedCall);
    }

    function test_mutation33_dependencyOrder_rejected() public pure {
        Manifest memory m = _valid();
        (m.dependencies[0], m.dependencies[1]) = (m.dependencies[1], m.dependencies[0]);
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
        m.storageRows = _storageManifest();
        m.calls = _callsiteManifest();
        m.dependencies = _dependencyManifest();
        m.constructorMutability = "nonpayable";
        m.immutableSource = "manifest";
        m.scannerCode = hex"61f4fff100";
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
            if (!_eq(m.functions[i], allowed[i])) {
                if (_eq(m.functions[i], "authorizePreVoteBudget((uint256,uint256,uint64),bytes32)")) {
                    return Reject.FutureEarly;
                }
                return Reject.UnknownSelector;
            }
            if (m.functionOwners[i] != allowedOwners[i]) return Reject.FactoryBusiness;
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
        StorageRow[] memory expectedStorage = _storageManifest();
        if (m.storageRows.length != expectedStorage.length) return Reject.AccountingCopy;
        for (uint256 i; i < m.storageRows.length; ++i) {
            if (m.storageRows[i].kind == SemanticKind.OperatorRole && m.storageRows[i].owner != Owner.Authority) {
                return Reject.OperatorCopy;
            }
            if (m.storageRows[i].kind == SemanticKind.OwnerRole && m.storageRows[i].owner != Owner.Authority) {
                return Reject.OwnerCopy;
            }
            if (m.storageRows[i].kind == SemanticKind.Accounting && m.storageRows[i].owner != Owner.Core) {
                return Reject.AccountingCopy;
            }
            if (
                !_eq(m.storageRows[i].label, expectedStorage[i].label)
                    || m.storageRows[i].kind != expectedStorage[i].kind
                    || m.storageRows[i].owner != expectedStorage[i].owner
                    || m.storageRows[i].startRoot != expectedStorage[i].startRoot
                    || m.storageRows[i].endRoot != expectedStorage[i].endRoot
            ) return Reject.AccountingCopy;
        }
        Callsite[14] memory expectedCalls = _callsiteManifest();
        for (uint256 i; i < 14; ++i) {
            if (m.calls[i].targetKind != expectedCalls[i].targetKind) {
                if (i == 0) return Reject.DelegateCall;
                return Reject.UnapprovedCall;
            }
            if (
                m.calls[i].selector != expectedCalls[i].selector
                    || m.calls[i].arbitraryCalldata != expectedCalls[i].arbitraryCalldata
            ) return Reject.ArbitraryCall;
            if (
                !_eq(m.calls[i].context, expectedCalls[i].context) || m.calls[i].value != expectedCalls[i].value
                    || m.calls[i].gasCap != expectedCalls[i].gasCap
                    || m.calls[i].returnBytes != expectedCalls[i].returnBytes
                    || m.calls[i].copiesRevertData != expectedCalls[i].copiesRevertData
                    || m.calls[i].bubblesFailure != expectedCalls[i].bubblesFailure
                    || m.calls[i].postCallReserve != expectedCalls[i].postCallReserve
                    || !_eq(m.calls[i].failurePolicy, expectedCalls[i].failurePolicy)
            ) return Reject.UnapprovedCall;
        }
        (, uint256 forbidden, bool malformed) = _scan(m.scannerCode);
        if (malformed) return Reject.PushScanner;
        if (forbidden != 0) return Reject.OpcodeAfterPush;
        if (m.runtimeSize > RUNTIME_LIMIT) return Reject.RuntimeOversize;
        if (m.initcodeSize > INITCODE_LIMIT) return Reject.InitcodeOversize;
        if (m.createValue != 0) return Reject.CreateValue;
        if (!_eq(m.immutableSource, "manifest")) return Reject.BlockContext;
        Dependency[6] memory expectedDeps = _dependencyManifest();
        for (uint256 i; i < 6; ++i) {
            if (
                !_eq(m.dependencies[i].name, expectedDeps[i].name) || m.dependencies[i].owner != expectedDeps[i].owner
                    || !_eq(m.dependencies[i].introductionNode, expectedDeps[i].introductionNode)
                    || !_eq(m.dependencies[i].provenance, expectedDeps[i].provenance)
            ) return Reject.Proxy;
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

    function _scan(bytes memory code) internal pure returns (uint256 calls, uint256 forbidden, bool malformed) {
        for (uint256 i; i < code.length; ++i) {
            uint8 op = uint8(code[i]);
            if (op >= 0x60 && op <= 0x7f) {
                uint256 width = op - 0x5f;
                if (i + width >= code.length) return (calls, forbidden, true);
                i += width;
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

    function _validErrorUniverse(string[] memory rows, Owner[] memory owners) internal pure returns (bool) {
        if (rows.length != owners.length) return false;
        uint256 authorityGuard;
        uint256 coreGuard;
        for (uint256 i; i < rows.length; ++i) {
            if (_eq(rows[i], "ReentrancyGuardReentrantCall()")) {
                if (owners[i] == Owner.Authority) ++authorityGuard;
                else if (owners[i] == Owner.Core) ++coreGuard;
                else return false;
            }
            for (uint256 j = i + 1; j < rows.length; ++j) {
                if (_selector(rows[i]) != _selector(rows[j])) continue;
                if (!_eq(rows[i], "ReentrancyGuardReentrantCall()") || !_eq(rows[i], rows[j])) return false;
            }
        }
        return authorityGuard == 1 && coreGuard == 1;
    }

    function _combinedErrorUniverseIsValid(
        DescriptorRow[] memory topology,
        DescriptorRow[] memory future,
        DescriptorRow[] memory newV2
    ) internal pure returns (bool) {
        (string[] memory legacy, Owner[] memory legacyOwners) = _errors();
        uint256 futureErrorCount = 6;
        string[] memory rows = new string[](legacy.length + topology.length + futureErrorCount + newV2.length + 1);
        Owner[] memory owners = new Owner[](rows.length);
        uint256 n;
        for (uint256 i; i < legacy.length; ++i) {
            rows[n] = legacy[i];
            owners[n++] = legacyOwners[i];
        }
        for (uint256 i; i < topology.length; ++i) {
            rows[n] = topology[i].descriptor;
            owners[n++] = topology[i].owner;
        }
        for (uint256 i = 2; i < 8; ++i) {
            rows[n] = future[i].descriptor;
            owners[n++] = future[i].owner;
        }
        for (uint256 i; i < newV2.length; ++i) {
            rows[n] = newV2[i].descriptor;
            owners[n++] = newV2[i].owner;
        }
        rows[n] = "ReentrancyGuardReentrantCall()";
        owners[n] = Owner.Core;
        return n + 1 == rows.length && _validErrorUniverse(rows, owners);
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

    function _abiPath(uint256 index) internal pure returns (string memory) {
        return string.concat(".abi[", vm.toString(index), "]");
    }

    function _classifyAbiKind(string memory kind) internal pure returns (uint8) {
        if (_sameBytes(kind, "constructor")) return 1;
        if (_sameBytes(kind, "function")) return 2;
        if (_sameBytes(kind, "error")) return 3;
        if (_sameBytes(kind, "event")) return 4;
        return 0;
    }

    function _artifactDescriptor(string memory json, string memory path) internal view returns (string memory) {
        string memory name = vm.parseJsonString(json, string.concat(path, ".name"));
        return string.concat(name, "(", _parameterTypes(json, string.concat(path, ".inputs")), ")");
    }

    function _assertArtifactDescriptorPartition(string memory json, ArtifactDescriptorPartition memory expected)
        internal
        view
    {
        string[] memory functions = _artifactDescriptorsByKind(json, "function");
        string[] memory errors = _artifactDescriptorsByKind(json, "error");
        string[] memory events = _artifactDescriptorsByKind(json, "event");
        assertTrue(
            _matchesDescriptorPartition(functions, expected.functionCount, expected.functionHash),
            "exact artifact function partition"
        );
        assertTrue(
            _matchesDescriptorPartition(errors, expected.errorCount, expected.errorHash),
            "exact artifact error partition"
        );
        assertTrue(
            _matchesDescriptorPartition(events, expected.eventCount, expected.eventHash),
            "exact artifact event partition"
        );
    }

    function _artifactDescriptorsByKind(string memory json, string memory expectedKind)
        internal
        view
        returns (string[] memory rows)
    {
        uint256 count;
        for (uint256 abiIndex; vm.keyExistsJson(json, _abiPath(abiIndex)); ++abiIndex) {
            if (_eq(vm.parseJsonString(json, string.concat(_abiPath(abiIndex), ".type")), expectedKind)) ++count;
        }
        rows = new string[](count);
        uint256 rowIndex;
        for (uint256 abiIndex; vm.keyExistsJson(json, _abiPath(abiIndex)); ++abiIndex) {
            string memory path = _abiPath(abiIndex);
            if (!_eq(vm.parseJsonString(json, string.concat(path, ".type")), expectedKind)) continue;
            rows[rowIndex++] = _artifactDescriptor(json, path);
        }
        assertEq(rowIndex, count, "artifact descriptor collection cardinality");
    }

    function _matchesDescriptorPartition(string[] memory rows, uint256 expectedCount, bytes32 expectedHash)
        internal
        pure
        returns (bool)
    {
        return rows.length == expectedCount && _descriptorPartitionHash(rows) == expectedHash;
    }

    function _descriptorPartitionHash(string[] memory rows) internal pure returns (bytes32) {
        string[] memory sorted = new string[](rows.length);
        for (uint256 i; i < rows.length; ++i) {
            sorted[i] = rows[i];
        }
        for (uint256 i = 1; i < sorted.length; ++i) {
            string memory candidate = sorted[i];
            uint256 j = i;
            while (j != 0 && _descriptorComesAfter(sorted[j - 1], candidate)) {
                sorted[j] = sorted[j - 1];
                --j;
            }
            sorted[j] = candidate;
        }

        bytes memory joined;
        for (uint256 i; i < sorted.length; ++i) {
            if (i != 0) joined = bytes.concat(joined, bytes("\n"));
            joined = bytes.concat(joined, bytes(sorted[i]));
        }
        return keccak256(joined);
    }

    function _descriptorComesAfter(string memory left, string memory right) internal pure returns (bool) {
        bytes memory a = bytes(left);
        bytes memory b = bytes(right);
        uint256 commonLength = a.length < b.length ? a.length : b.length;
        for (uint256 i; i < commonLength; ++i) {
            if (uint8(a[i]) != uint8(b[i])) return uint8(a[i]) > uint8(b[i]);
        }
        return a.length > b.length;
    }

    function _nonIntentArtifactPartitions() internal pure returns (ArtifactDescriptorPartition[5] memory expected) {
        expected[0] = ArtifactDescriptorPartition({
            functionCount: 4,
            functionHash: 0x77e79aa303a945f069f154fa2b8393ec7bb12f010bcec339f3a3f247b49074be,
            errorCount: 35,
            errorHash: 0x10da2a62fcd635ac20f43a3604075c53aad7b9bdaa20da8632a1987ba186d260,
            eventCount: 2,
            eventHash: 0x08a4a2cb9281b3bd9f93345b502180d535b486331d9b9bea8b27f8ba2146a4cf
        });
        expected[1] = ArtifactDescriptorPartition({
            functionCount: 50,
            functionHash: 0xb439b62dccc4ec1c47ffb01800896dc15b55f9a1955a5d1ad3b798c4c0c594a0,
            errorCount: 54,
            errorHash: 0xca063e84d4789ea0db888a33220de6f5b50b1696b35d19654a65e20b79f4bd76,
            eventCount: 18,
            eventHash: 0x9409a20bda8f1776e4887cc8c628335eda460e0aae710b429aae73a454b9efee
        });
        expected[2] = ArtifactDescriptorPartition({
            functionCount: 23,
            functionHash: 0xbffe172907ef380212285fb526a86d7f271ed3d106bb8bcd8711c837626659a5,
            errorCount: 36,
            errorHash: 0xdcedc445532e355478ee2e1f13b8be05bb9c3d69c9b1d8d29472ebc4bdfe4776,
            eventCount: 5,
            eventHash: 0x32f4d40f4741e4810ee206ecf1062a90df09e6a8a9f05791934e88b8d3ccee82
        });
        expected[3] = ArtifactDescriptorPartition({
            functionCount: 4,
            functionHash: 0x4704b160754082c1683da0664f25c0582f6044477990765e42926d9fcab5a60d,
            errorCount: 29,
            errorHash: 0x1a39c111e4b2f9e6ab563129aad4439430b6e9213fbb26f9196793e99f2a3e71,
            eventCount: 2,
            eventHash: 0x220f493e421d15af04c8ec9fae273aec4105154235832c0725811069a97b5151
        });
        expected[4] = ArtifactDescriptorPartition({
            functionCount: 2,
            functionHash: 0xd16f274e0c956fd773d96d2a34039ac67d5715cb7ba435c238a76189c6f15ae6,
            errorCount: 5,
            errorHash: 0x1fd46988bb9beb67de977b59ea9db2098295b27ca7564ae082e718127640ec58,
            eventCount: 1,
            eventHash: 0xf367f39206358295ebaffc9ac4fbdf599fb888fbefb98ef5cefa788c672f0f71
        });
    }

    function _parameterTypes(string memory json, string memory path) internal view returns (string memory types) {
        for (uint256 i; vm.keyExistsJson(json, string.concat(path, "[", vm.toString(i), "]")); ++i) {
            if (i != 0) types = string.concat(types, ",");
            types = string.concat(types, _canonicalType(json, string.concat(path, "[", vm.toString(i), "]")));
        }
    }

    function _canonicalType(string memory json, string memory path) internal view returns (string memory) {
        string memory abiType = vm.parseJsonString(json, string.concat(path, ".type"));
        bytes memory raw = bytes(abiType);
        if (!_startsWithTuple(raw)) return abiType;
        return string.concat("(", _parameterTypes(json, string.concat(path, ".components")), ")", _slice(raw, 5));
    }

    function _startsWithTuple(bytes memory value) internal pure returns (bool) {
        return value.length >= 5 && value[0] == "t" && value[1] == "u" && value[2] == "p" && value[3] == "l"
            && value[4] == "e";
    }

    function _slice(bytes memory value, uint256 start) internal pure returns (string memory result) {
        bytes memory sliced = new bytes(value.length - start);
        for (uint256 i; i < sliced.length; ++i) {
            sliced[i] = value[start + i];
        }
        result = string(sliced);
    }

    function _uniqueDescriptorCount(string[] memory rows, bool compareSelectors, bool allowGuardDuplicate)
        internal
        pure
        returns (uint256 unique)
    {
        uint256 guardCount;
        for (uint256 i; i < rows.length; ++i) {
            bool duplicate;
            for (uint256 j; j < i; ++j) {
                bool same = _sameBytes(rows[i], rows[j]);
                if (same) {
                    assertTrue(
                        allowGuardDuplicate && _sameBytes(rows[i], "ReentrancyGuardReentrantCall()"),
                        "unexpected compiled descriptor duplicate"
                    );
                    duplicate = true;
                } else if (compareSelectors) {
                    assertTrue(_selector(rows[i]) != _selector(rows[j]), "compiled selector collision");
                }
            }
            if (_sameBytes(rows[i], "ReentrancyGuardReentrantCall()")) ++guardCount;
            if (!duplicate) ++unique;
        }
        if (allowGuardDuplicate) assertEq(guardCount, 2, "sole guard duplicate cardinality");
    }

    function _uniqueEventTopicCount(string[] memory rows) internal pure returns (uint256) {
        bytes32[] memory topics = new bytes32[](rows.length);
        for (uint256 i; i < rows.length; ++i) {
            topics[i] = keccak256(bytes(rows[i]));
        }
        assertTrue(_uniqueHashes(topics), "compiled event topic collision");
        return topics.length;
    }

    function _uniqueHashes(bytes32[] memory hashes) internal pure returns (bool) {
        for (uint256 i; i < hashes.length; ++i) {
            for (uint256 j; j < i; ++j) {
                if (hashes[i] == hashes[j]) return false;
            }
        }
        return true;
    }

    function _validGuardOwnership(uint256 authorityCount, uint256 coreCount, uint256 otherCount)
        internal
        pure
        returns (bool)
    {
        return authorityCount == 1 && coreCount == 1 && otherCount == 0;
    }

    function _sameBytes(string memory a, string memory b) internal pure returns (bool) {
        bytes memory left = bytes(a);
        bytes memory right = bytes(b);
        if (left.length != right.length) return false;
        for (uint256 i; i < left.length; ++i) {
            if (left[i] != right[i]) return false;
        }
        return true;
    }

    function _activeFutureReserved() internal pure returns (string[] memory r) {
        r = new string[](0);
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

    function _futureRows() internal pure returns (DescriptorRow[] memory r) {
        string[] memory descriptors = _futureReserved();
        r = new DescriptorRow[](descriptors.length);
        for (uint256 i; i < descriptors.length; ++i) {
            r[i] = DescriptorRow(
                keccak256(abi.encode("FR", i + 1)), Category.FutureReserved, Owner.BudgetBook, descriptors[i]
            );
        }
    }

    function _task5NewV2Rows()
        internal
        pure
        returns (DescriptorRow[] memory functions, DescriptorRow[] memory errors, DescriptorRow[] memory events)
    {
        functions = new DescriptorRow[](2);
        functions[0] = DescriptorRow(
            keccak256(abi.encode("T5NF", uint256(1))), Category.NewV2, Owner.Intent, "deriveIntentId(uint256,bytes32)"
        );
        functions[1] = DescriptorRow(
            keccak256(abi.encode("T5NF", uint256(2))),
            Category.NewV2,
            Owner.Intent,
            "deriveAttemptId(uint256,uint256,bytes32,address,bytes32,bytes32)"
        );
        errors = new DescriptorRow[](4);
        string[4] memory descriptors = [
            "IntentExecutionZeroAddress()",
            "IntentExecutionContractRequired(address)",
            "IntentExecutionAddressMismatch(address,address)",
            "IntentExecutionPeerMismatch(uint8,address,address)"
        ];
        for (uint256 i; i < errors.length; ++i) {
            errors[i] =
                DescriptorRow(keccak256(abi.encode("T5NE", i + 1)), Category.NewV2, Owner.Intent, descriptors[i]);
        }
        events = new DescriptorRow[](0);
    }

    function _topologyRows()
        internal
        pure
        returns (DescriptorRow[] memory functions, DescriptorRow[] memory errors, DescriptorRow[] memory events)
    {
        (string[] memory f, string[] memory e, string[] memory v) = _topologyDescriptors();
        functions = new DescriptorRow[](f.length);
        errors = new DescriptorRow[](e.length);
        events = new DescriptorRow[](v.length);
        Owner[5] memory modules = [Owner.Authority, Owner.Core, Owner.BudgetBook, Owner.Intent, Owner.Reconciliation];
        for (uint256 i; i < f.length; ++i) {
            Owner owner = i < 10 ? modules[i / 2] : Owner.Factory;
            functions[i] = DescriptorRow(keccak256(abi.encode("TF", i + 1)), Category.Topology, owner, f[i]);
        }
        for (uint256 i; i < e.length; ++i) {
            Owner owner;
            if (i < 15) owner = modules[i / 3];
            else if (i < 41) owner = Owner.Factory;
            else owner = modules[(i - 41) / 2];
            errors[i] = DescriptorRow(keccak256(abi.encode("TER", i + 1)), Category.Topology, owner, e[i]);
        }
        for (uint256 i; i < v.length; ++i) {
            Owner owner = i < 5 ? modules[i] : Owner.Factory;
            events[i] = DescriptorRow(keccak256(abi.encode("TEV", i + 1)), Category.Topology, owner, v[i]);
        }
    }

    function _rowDescriptors(DescriptorRow[] memory rows) internal pure returns (string[] memory r) {
        r = new string[](rows.length);
        for (uint256 i; i < rows.length; ++i) {
            r[i] = rows[i].descriptor;
        }
    }

    function _matchingRow(string memory descriptor, DescriptorRow[] memory rows) internal pure returns (uint256) {
        for (uint256 i; i < rows.length; ++i) {
            if (_eq(descriptor, rows[i].descriptor)) return i + 1;
        }
        return 0;
    }

    function _isTask4IntentError(string memory descriptor) internal pure returns (bool) {
        return _eq(descriptor, "IntentExecutionFactoryZero()") || _eq(descriptor, "IntentExecutionManifestHashZero()")
            || _eq(descriptor, "IntentExecutionFinalizerUnauthorized(address)")
            || _eq(descriptor, "IntentExecutionManifestHashMismatch(bytes32,bytes32)")
            || _eq(descriptor, "IntentExecutionAlreadyFinalized()");
    }

    function _validRows(DescriptorRow[] memory actual, DescriptorRow[] memory expected) internal pure returns (bool) {
        if (actual.length != expected.length) return false;
        for (uint256 i; i < actual.length; ++i) {
            if (
                actual[i].id != expected[i].id || actual[i].category != expected[i].category
                    || actual[i].owner != expected[i].owner || !_eq(actual[i].descriptor, expected[i].descriptor)
            ) return false;
        }
        return true;
    }

    function _topologyDescriptors()
        internal
        pure
        returns (string[] memory functions, string[] memory errors, string[] memory events)
    {
        functions = new string[](14);
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
        functions[10] = "factoryState()";
        functions[11] = "childCommitment(uint8)";
        functions[12] = "deployNext(bytes)";
        functions[13] = "finalizeConstellation()";
        errors = new string[](51);
        events = new string[](7);
        string[5] memory p = ["Authority", "Core", "BudgetBook", "IntentExecution", "Reconciliation"];
        for (uint256 i; i < 5; ++i) {
            errors[i * 3] = string.concat(p[i], "FinalizerUnauthorized(address)");
            errors[i * 3 + 1] = string.concat(p[i], "ManifestHashMismatch(bytes32,bytes32)");
            errors[i * 3 + 2] = string.concat(p[i], "AlreadyFinalized()");
            events[i] = string.concat(p[i], "Finalized(bytes32)");
        }
        string[26] memory factoryErrors = [
            "FactorySafeZero()",
            "FactoryRegistryZero()",
            "FactorySafeCodeMissing(address)",
            "FactoryRegistryCodeMissing(address)",
            "FactoryRoleCollision(address)",
            "FactoryRegistryRuntimeHashMismatch(bytes32,bytes32)",
            "FactoryRegistryCallFailed()",
            "FactoryRegistryReturnLength(uint256)",
            "FactoryPhaseMismatch(uint8,uint8)",
            "FactoryChildIndex(uint8)",
            "FactoryChildInitcodeHashZero(uint8)",
            "FactoryChildRuntimeHashZero(uint8)",
            "FactoryInitcodeEmpty(uint8)",
            "FactoryInitcodeTooLarge(uint8,uint256)",
            "FactoryInitcodeHashMismatch(uint8,bytes32,bytes32)",
            "FactoryCreateFailed(uint8)",
            "FactoryChildAddressMismatch(uint8,address,address)",
            "FactoryRuntimeTooLarge(uint8,uint256)",
            "FactoryRuntimeHashMismatch(uint8,bytes32,bytes32)",
            "FactoryTopologyCallFailed(uint8)",
            "FactoryTopologyReturnLength(uint8,uint256)",
            "FactoryTopologySemanticMismatch(uint8)",
            "FactoryPostCallGasInsufficient(uint8,uint256,uint256)",
            "FactoryFinalizerCallFailed(uint8)",
            "FactoryFinalizerReturnLength(uint8,uint256)",
            "FactoryFinalizerSemanticMismatch(uint8)"
        ];
        for (uint256 i; i < factoryErrors.length; ++i) {
            errors[15 + i] = factoryErrors[i];
        }
        string[10] memory constructorErrors = [
            "AuthorityFactoryZero()",
            "AuthorityManifestHashZero()",
            "CoreFactoryZero()",
            "CoreManifestHashZero()",
            "BudgetBookFactoryZero()",
            "BudgetBookManifestHashZero()",
            "IntentExecutionFactoryZero()",
            "IntentExecutionManifestHashZero()",
            "ReconciliationFactoryZero()",
            "ReconciliationManifestHashZero()"
        ];
        for (uint256 i; i < constructorErrors.length; ++i) {
            errors[41 + i] = constructorErrors[i];
        }
        events[5] = "ChildDeployed(uint8,address,bytes32,bytes32)";
        events[6] = "ConstellationFinalized(bytes32,bytes32)";
    }

    function _storageManifest() internal pure returns (StorageRow[] memory r) {
        r = new StorageRow[](27);
        r[0] = StorageRow("_nameFallback", Owner.Authority, SemanticKind.Eip712Fallback, 0, 0);
        r[1] = StorageRow("_versionFallback", Owner.Authority, SemanticKind.Eip712Fallback, 1, 1);
        r[2] = StorageRow("_owner", Owner.Authority, SemanticKind.OwnerRole, 2, 2);
        r[3] = StorageRow("_pendingOwner", Owner.Authority, SemanticKind.OwnerRole, 3, 3);
        r[4] = StorageRow("_paused", Owner.Authority, SemanticKind.PauseState, 3, 3);
        r[5] = StorageRow("mainOperator", Owner.Authority, SemanticKind.OperatorRole, 4, 4);
        r[6] = StorageRow("operatorGeneration", Owner.Authority, SemanticKind.OperatorRole, 5, 5);
        r[7] = StorageRow("outflowNonce", Owner.Authority, SemanticKind.OperatorRole, 6, 6);
        r[8] = StorageRow("nominationNonce", Owner.Authority, SemanticKind.OperatorRole, 7, 7);
        r[9] = StorageRow("_pendingMainOperatorNomination", Owner.Authority, SemanticKind.OperatorRole, 8, 13);
        r[10] = StorageRow("availableWei", Owner.Core, SemanticKind.Accounting, 14, 14);
        r[11] = StorageRow("unattributedWei", Owner.Core, SemanticKind.Accounting, 15, 15);
        r[12] = StorageRow("ordinaryReservedWei", Owner.Core, SemanticKind.Accounting, 16, 16);
        r[13] = StorageRow("reconciliationLiabilityWei", Owner.Core, SemanticKind.Accounting, 17, 17);
        r[14] = StorageRow("reconciliationBackingWei", Owner.Core, SemanticKind.Accounting, 18, 18);
        r[15] = StorageRow("accountingSequence", Owner.Core, SemanticKind.Accounting, 19, 19);
        r[16] = StorageRow("lastObservedBalanceDeficitWei", Owner.Core, SemanticKind.Accounting, 20, 20);
        r[17] = StorageRow("globalLifetimeCanonicalDepositedWei", Owner.Core, SemanticKind.Accounting, 21, 21);
        r[18] = StorageRow("ingressProposalNonce", Owner.Authority, SemanticKind.IngressAuthority, 22, 22);
        r[19] = StorageRow("ingressGeneration", Owner.Authority, SemanticKind.IngressAuthority, 23, 23);
        r[20] = StorageRow("activeIngressGeneration", Owner.Authority, SemanticKind.IngressAuthority, 24, 24);
        r[21] = StorageRow("_pendingIngressProposal", Owner.Authority, SemanticKind.IngressAuthority, 25, 35);
        r[22] = StorageRow("_ingressRecords", Owner.Authority, SemanticKind.IngressAuthority, 36, 36);
        r[23] = StorageRow("ingressLifetimeDepositedWei", Owner.Core, SemanticKind.Accounting, 37, 37);
        r[24] = StorageRow("ingressEpochDepositedWei", Owner.Core, SemanticKind.Accounting, 38, 38);
        r[25] = StorageRow("_depositRecords", Owner.Core, SemanticKind.Accounting, 39, 39);
        r[26] = StorageRow("REENTRANCY_GUARD_STORAGE", Owner.Inherited, SemanticKind.Guard, 255, 255);
    }

    function _callsiteManifest() internal pure returns (Callsite[14] memory r) {
        r[0] = Callsite(
            "constructor.registry",
            TargetKind.Registry,
            bytes4(keccak256("supportedChainId()")),
            false,
            0,
            100_000,
            32,
            false,
            false,
            0,
            "registry-call-return-semantic"
        );
        r[1] = Callsite(
            "runtime.ecrecover",
            TargetKind.EcrecoverPrecompile,
            bytes4(0),
            false,
            0,
            0,
            32,
            false,
            false,
            0,
            "invalid-signature"
        );
        r[2] = Callsite(
            "runtime.erc1271",
            TargetKind.CodeCheckedERC1271,
            0x1626ba7e,
            false,
            0,
            100_000,
            32,
            false,
            false,
            100_000,
            "invalid-signature"
        );
        string[5] memory topology = [
            "authorityTopology()",
            "coreTopology()",
            "budgetBookTopology()",
            "intentExecutionTopology()",
            "reconciliationTopology()"
        ];
        for (uint256 i; i < 5; ++i) {
            r[3 + i] = Callsite(
                string.concat("finalize.topology.", topology[i]),
                TargetKind.ChildTopology,
                bytes4(keccak256(bytes(topology[i]))),
                false,
                0,
                50_000,
                96,
                false,
                false,
                0,
                "topology-call-return-semantic"
            );
        }
        string[5] memory finalizers = [
            "finalizeBudgetBook(bytes32)",
            "finalizeReconciliation(bytes32)",
            "finalizeIntentExecution(bytes32)",
            "finalizeCore(bytes32)",
            "finalizeAuthority(bytes32)"
        ];
        for (uint256 i; i < 5; ++i) {
            r[8 + i] = Callsite(
                string.concat("finalize.call.", finalizers[i]),
                TargetKind.ChildFinalizer,
                bytes4(keccak256(bytes(finalizers[i]))),
                false,
                0,
                100_000,
                0,
                false,
                false,
                100_000,
                "finalizer-gas-call-return-semantic"
            );
        }
        r[13] = Callsite(
            "deploy.raw-create",
            TargetKind.RawCreate,
            bytes4(0),
            false,
            0,
            0,
            32,
            false,
            false,
            0,
            "create-address-runtime"
        );
    }

    function _dependencyManifest() internal pure returns (Dependency[6] memory r) {
        r[0] = Dependency("Registry", Owner.Factory, "TASK1", "address+runtimeHash+chain+nondelegating", false, false);
        r[1] = Dependency(
            "CircuitBreakerHealth", Owner.Authority, "HEALTH_NODE", "deferred-versioned-config", false, false
        );
        r[2] =
            Dependency("CanonicalIngress", Owner.Authority, "INGRESS_NODE", "deferred-codehash-nonproxy", false, false);
        r[3] = Dependency("Oracle", Owner.Intent, "INTENT_NODE", "deferred-codehash-nonproxy", false, false);
        r[4] = Dependency("Adapter", Owner.Intent, "EXECUTION_NODE", "deferred-codehash-selector-policy", false, false);
        r[5] = Dependency(
            "StockToken", Owner.Core, "EXECUTION_NODE", "deferred-registry-version-token-proof", false, false
        );
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

    function _joinTwo(string[] memory a, string[] memory b) internal pure returns (string[] memory out) {
        out = new string[](a.length + b.length);
        uint256 n;
        for (uint256 i; i < a.length; ++i) {
            out[n++] = a[i];
        }
        for (uint256 i; i < b.length; ++i) {
            out[n++] = b[i];
        }
    }
}
