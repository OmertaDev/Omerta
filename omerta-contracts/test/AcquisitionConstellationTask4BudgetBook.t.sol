// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vm, VmSafe} from "forge-std/Vm.sol";
import {AcquisitionConstellationFactory} from "../src/AcquisitionConstellationFactory.sol";
import {AcquisitionAuthority} from "../src/AcquisitionAuthority.sol";
import {AcquisitionVaultCore} from "../src/AcquisitionVaultCore.sol";
import {PreVoteBudgetBook} from "../src/PreVoteBudgetBook.sol";
import {AcquisitionIntentExecution} from "../src/AcquisitionIntentExecution.sol";
import {AcquisitionReconciliation} from "../src/AcquisitionReconciliation.sol";
import {StockTokenRegistryV2} from "../src/StockTokenRegistryV2.sol";

interface ITask4BudgetBook {
    struct PreVoteBudgetInput {
        uint256 ballotDay;
        uint256 maxEthWei;
        uint64 purchaseUntil;
    }

    struct PreVoteBudgetAuthorization {
        bytes32 budgetId;
        uint256 ballotDay;
        uint256 maxEthWei;
        uint64 purchaseUntil;
        uint256 availableAtAuthorizationWei;
        uint256 accountingSequence;
        uint64 authorizedAt;
        bytes32 detailsHash;
    }

    error BudgetBookFactoryZero();
    error BudgetBookManifestHashZero();
    error BudgetBookFinalizerUnauthorized(address caller);
    error BudgetBookManifestHashMismatch(bytes32 expected, bytes32 actual);
    error BudgetBookAlreadyFinalized();
    error BudgetBookNotFinalized();
    error BudgetBookZeroAddress();
    error BudgetBookContractRequired(address account);
    error BudgetBookAddressMismatch(address expected, address actual);
    error BudgetBookPeerMismatch(uint8 peer, address expected, address actual);
    error BudgetBookAuthoritySnapshotCallFailed();
    error BudgetBookAuthoritySnapshotReturnLength(uint256 actualLength);
    error BudgetBookAuthoritySnapshotSemanticMismatch(uint8 field);
    error BudgetBookCoreAccountingCallFailed();
    error BudgetBookCoreAccountingReturnLength(uint256 actualLength);
    error BudgetBookCoreAccountingSemanticMismatch(uint8 field);
    error BudgetBookUnauthorized(address caller);
    error BudgetBookPaused();
    error BudgetBookEmptyDetailsHash();
    error BudgetBookInvalidAmount();
    error BudgetBookTimestampOverflow();
    error BudgetBookBalanceDeficitActive(uint256 deficitWei);
    error BudgetBookReconciliationShortfallActive(uint256 shortfallWei);
    error BudgetDayClosed(uint256 ballotDay);
    error BudgetDeadlineOverflow();
    error InvalidPurchaseUntil(uint64 expected, uint64 supplied);
    error BudgetAlreadyAuthorized(uint256 ballotDay);
    error InsufficientAvailable(uint256 availableWei, uint256 requestedWei);
    error BudgetNotFound(uint256 ballotDay);

    event BudgetBookFinalized(bytes32 indexed manifestHash);
    event PreVoteBudgetAuthorized(
        bytes32 indexed budgetId,
        uint256 indexed ballotDay,
        uint256 maxEthWei,
        uint64 purchaseUntil,
        uint256 availableAtAuthorizationWei,
        uint256 accountingSequence,
        uint64 authorizedAt,
        uint8 reasonCode,
        bytes32 detailsHash
    );

    function budgetBookTopology() external view returns (address factory, bytes32 manifestHash, bool finalized);
    function finalizeBudgetBook(bytes32 manifestHash) external;
    function authorizePreVoteBudget(PreVoteBudgetInput calldata input, bytes32 detailsHash)
        external
        returns (bytes32 budgetId);
    function getPreVoteBudget(uint256 ballotDay) external view returns (PreVoteBudgetAuthorization memory authorization);
}

contract Task4Safe {}

contract Task4CodeStub {}

contract Task4RegistrySentinel {
    fallback() external {
        revert("REGISTRY_MUST_NOT_BE_CALLED");
    }
}

contract Task4AuthorityOracle {
    uint256[27] private _words;
    uint8 private _mode;

    function setWords(uint256[27] calldata words) external {
        _words = words;
    }

    function setMode(uint8 mode) external {
        _mode = mode;
    }

    fallback() external {
        require(msg.sig == bytes4(keccak256("authoritySnapshot()")) && msg.data.length == 4, "AUTH_SELECTOR");
        uint8 mode = _mode;
        if (mode == 1) revert();
        if (mode == 2) {
            assembly {
                for {} 1 {} {}
            }
        }
        uint256[27] memory words = _words;
        uint256 length = mode == 3 ? 863 : mode == 4 ? 865 : mode == 5 ? 131_072 : 864;
        assembly ("memory-safe") {
            return(words, length)
        }
    }
}

contract Task4CoreOracle {
    uint256[11] private _words;
    uint8 private _mode;

    function setWords(uint256[11] calldata words) external {
        _words = words;
    }

    function setMode(uint8 mode) external {
        _mode = mode;
    }

    fallback() external {
        require(msg.sig == bytes4(keccak256("accountingTotals()")) && msg.data.length == 4, "CORE_SELECTOR");
        uint8 mode = _mode;
        if (mode == 1) revert();
        if (mode == 2) {
            assembly {
                for {} 1 {} {}
            }
        }
        uint256[11] memory words = _words;
        uint256 length = mode == 3 ? 351 : mode == 4 ? 353 : mode == 5 ? 131_072 : 352;
        assembly ("memory-safe") {
            return(words, length)
        }
    }
}

contract Task4FactoryHarness {
    Task4AuthorityOracle public immutable authority;
    Task4CoreOracle public immutable core;

    constructor() {
        authority = new Task4AuthorityOracle();
        core = new Task4CoreOracle();
    }

    function deployBudget(bytes memory creation) external returns (address child) {
        assembly ("memory-safe") {
            child := create(0, add(creation, 0x20), mload(creation))
            if iszero(child) {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }

    function finalizeBudget(address budgetBook, bytes32 manifestHash) external {
        ITask4BudgetBook(budgetBook).finalizeBudgetBook(manifestHash);
    }
}

contract Task4RawCreateDispatcher {
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

contract Task4ForceEther {
    constructor(address payable target) payable {
        selfdestruct(target);
    }
}

contract Task4TestToken {
    mapping(address account => uint256 balance) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    fallback() external {
        revert("TOKEN_MUST_NOT_BE_CALLED");
    }
}

contract Task4InvariantHandler {
    Vm private constant _VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ITask4BudgetBook private immutable _book;
    address private immutable _safe;
    uint256 private immutable _firstDay;

    uint256 public attempts;
    uint256 public successfulDays;
    bytes32[2] private _ids;
    bytes32[2] private _recordHashes;

    constructor(ITask4BudgetBook book, address safe, uint256 firstDay) {
        _book = book;
        _safe = safe;
        _firstDay = firstDay;
    }

    function authorize(uint256 seed) external {
        uint256 index = seed % 2;
        ITask4BudgetBook.PreVoteBudgetInput memory input;
        input.ballotDay = _firstDay + index;
        input.maxEthWei = index + 1;
        input.purchaseUntil = uint64((input.ballotDay + 1) * 1 days + 2 hours);
        ++attempts;
        _VM.prank(_safe);
        (bool ok, bytes memory result) = address(_book)
            .call(
                abi.encodeCall(
                    ITask4BudgetBook.authorizePreVoteBudget, (input, keccak256(abi.encode("task4-invariant", seed)))
                )
            );
        if (!ok) return;
        bytes32 id = abi.decode(result, (bytes32));
        ITask4BudgetBook.PreVoteBudgetAuthorization memory record = _book.getPreVoteBudget(input.ballotDay);
        bytes32 recordHash = keccak256(abi.encode(record));
        if (_ids[index] == bytes32(0)) {
            _ids[index] = id;
            _recordHashes[index] = recordHash;
            ++successfulDays;
        } else {
            require(_ids[index] == id && _recordHashes[index] == recordHash, "mutable day authorization");
        }
    }

    function day(uint256 index) external view returns (uint256) {
        return _firstDay + index;
    }

    function id(uint256 index) external view returns (bytes32) {
        return _ids[index];
    }

    function recordHash(uint256 index) external view returns (bytes32) {
        return _recordHashes[index];
    }
}

contract AcquisitionConstellationTask4BudgetBookTest is Test {
    uint256 private constant _CHAIN_ID = 4663;
    uint256 private constant _GLOBAL_CAP = 100 ether;
    uint256 private constant _AVAILABLE = 10 ether;
    uint256 private constant _SEQUENCE = 7;
    bytes32 private constant _MANIFEST = keccak256("task4-budget-book-manifest");
    bytes32 private constant _DETAILS = keccak256("task4-budget-details");
    bytes32 private constant _BUDGET_TAG = keccak256("OMERTA_ACQUISITION_BUDGET_AUTHORIZATION_V2");
    bytes32 private constant _TASK3_CONFIG_TAG = keccak256("OMERTA_ACQUISITION_TASK3_CONFIG_V1");
    bytes32 private constant _CONSTELLATION_TAG = keccak256("OMERTA_ACQUISITION_CONSTELLATION_V1");

    struct ProductionBundle {
        address predictedFactory;
        address[5] children;
        bytes32 configurationRoot;
        bytes32 manifest;
        bytes[5] initcodes;
        bytes32[5] initcodeHashes;
        bytes32[5] runtimeHashes;
    }

    Task4Safe private _safe;
    Task4RegistrySentinel private _registry;
    Task4FactoryHarness private _factory;
    Task4AuthorityOracle private _authority;
    Task4CoreOracle private _core;
    ITask4BudgetBook private _book;
    Task4InvariantHandler private _invariantHandler;
    bytes32 private _invariantCoreDigest;
    uint256 private _invariantCoreBalance;
    uint256 private _invariantBudgetBalance;

    function setUp() public {
        vm.chainId(_CHAIN_ID);
        vm.warp(100 days + 17 hours);
        _safe = new Task4Safe();
        _registry = new Task4RegistrySentinel();
        (_factory, _book) = _deployBudget(false);
        _authority = _factory.authority();
        _core = _factory.core();
        _configureValidPeers(_factory, _book, _authority, _core);
        _factory.finalizeBudget(address(_book), _MANIFEST);
        _invariantHandler = new Task4InvariantHandler(_book, address(_safe), block.timestamp / 1 days);
        _invariantCoreDigest = _coreOracleDigest();
        _invariantCoreBalance = address(_core).balance;
        _invariantBudgetBalance = address(_book).balance;
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = _invariantHandler.authorize.selector;
        targetContract(address(_invariantHandler));
        targetSelector(FuzzSelector({addr: address(_invariantHandler), selectors: selectors}));
    }

    function test_task4_01a_exactFunctionConstructorAbiAndEveryName() public {
        string memory json = _artifactJson();
        assertEq(_abiEntryCount(json), 36, "exact total ABI cardinality");
        assertEq(_abiKindCount(json, "function"), 4, "exact function cardinality");
        assertEq(_abiKindCount(json, "constructor"), 1, "exact constructor cardinality");
        assertEq(_abiKindCount(json, "fallback"), 0, "fallback ABI cardinality");
        assertEq(_abiKindCount(json, "receive"), 0, "receive ABI cardinality");
        _assertAbiEntry(
            json,
            "function",
            "budgetBookTopology",
            "",
            "",
            "address,bytes32,bool",
            "factory,manifestHash,finalized",
            "view"
        );
        _assertAbiEntry(json, "function", "finalizeBudgetBook", "bytes32", "manifestHash", "", "", "nonpayable");
        _assertAbiEntry(
            json,
            "function",
            "authorizePreVoteBudget",
            "(uint256,uint256,uint64),bytes32",
            "input(ballotDay,maxEthWei,purchaseUntil),detailsHash",
            "bytes32",
            "budgetId",
            "nonpayable"
        );
        _assertAbiEntry(
            json,
            "function",
            "getPreVoteBudget",
            "uint256",
            "ballotDay",
            "(bytes32,uint256,uint256,uint64,uint256,uint256,uint64,bytes32)",
            "authorization(budgetId,ballotDay,maxEthWei,purchaseUntil,availableAtAuthorizationWei,accountingSequence,authorizedAt,detailsHash)",
            "view"
        );
        _assertAbiEntry(
            json,
            "constructor",
            "",
            "address,bytes32,address,address,address",
            "factory,manifestHash,authority,core,registry",
            "",
            "",
            "nonpayable"
        );
    }

    function test_task4_01b_exactTwentyNineErrorsAndEveryParameterName() public {
        string memory json = _artifactJson();
        assertEq(_abiKindCount(json, "error"), 29, "exact error cardinality");
        string[29] memory rows = [
            "BudgetAlreadyAuthorized(uint256)|ballotDay",
            "BudgetBookAddressMismatch(address,address)|expected,actual",
            "BudgetBookAlreadyFinalized()|",
            "BudgetBookAuthoritySnapshotCallFailed()|",
            "BudgetBookAuthoritySnapshotReturnLength(uint256)|actualLength",
            "BudgetBookAuthoritySnapshotSemanticMismatch(uint8)|field",
            "BudgetBookBalanceDeficitActive(uint256)|deficitWei",
            "BudgetBookContractRequired(address)|account",
            "BudgetBookCoreAccountingCallFailed()|",
            "BudgetBookCoreAccountingReturnLength(uint256)|actualLength",
            "BudgetBookCoreAccountingSemanticMismatch(uint8)|field",
            "BudgetBookEmptyDetailsHash()|",
            "BudgetBookFactoryZero()|",
            "BudgetBookFinalizerUnauthorized(address)|caller",
            "BudgetBookInvalidAmount()|",
            "BudgetBookManifestHashMismatch(bytes32,bytes32)|expected,actual",
            "BudgetBookManifestHashZero()|",
            "BudgetBookNotFinalized()|",
            "BudgetBookPaused()|",
            "BudgetBookPeerMismatch(uint8,address,address)|peer,expected,actual",
            "BudgetBookReconciliationShortfallActive(uint256)|shortfallWei",
            "BudgetBookTimestampOverflow()|",
            "BudgetBookUnauthorized(address)|caller",
            "BudgetBookZeroAddress()|",
            "BudgetDayClosed(uint256)|ballotDay",
            "BudgetDeadlineOverflow()|",
            "BudgetNotFound(uint256)|ballotDay",
            "InsufficientAvailable(uint256,uint256)|availableWei,requestedWei",
            "InvalidPurchaseUntil(uint64,uint64)|expected,supplied"
        ];
        for (uint256 i; i < rows.length; ++i) {
            _assertErrorRow(json, rows[i]);
        }
    }

    function test_task4_01c_exactEventsIndexingNamesAndForbiddenSurface() public {
        string memory json = _artifactJson();
        assertEq(_abiKindCount(json, "event"), 2, "exact event cardinality");
        _assertEvent(json, "BudgetBookFinalized", "bytes32", "manifestHash", "1", false);
        _assertEvent(
            json,
            "PreVoteBudgetAuthorized",
            "bytes32,uint256,uint256,uint64,uint256,uint256,uint64,uint8,bytes32",
            "budgetId,ballotDay,maxEthWei,purchaseUntil,availableAtAuthorizationWei,accountingSequence,authorizedAt,reasonCode,detailsHash",
            "1,1,0,0,0,0,0,0,0",
            false
        );

        bytes[10] memory forbidden = [
            abi.encodeWithSignature("cancelBudget(uint256)", uint256(100)),
            abi.encodeWithSignature("replaceBudget(uint256,uint256)", uint256(100), uint256(1 ether)),
            abi.encodeWithSignature("consumeBudget(uint256,uint256)", uint256(100), uint256(1 ether)),
            abi.encodeWithSignature("reserveBudget(uint256,uint256)", uint256(100), uint256(1 ether)),
            abi.encodeWithSignature("sweep(address,uint256)", address(0xBEEF), uint256(1)),
            abi.encodeWithSignature("recoverToken(address,uint256)", address(_registry), uint256(1)),
            abi.encodeWithSignature("transfer(address,uint256)", address(0xBEEF), uint256(1)),
            abi.encodeWithSignature("approve(address,uint256)", address(0xBEEF), uint256(1)),
            abi.encodeWithSignature("publishResult(uint256,bytes32)", uint256(100), keccak256("result")),
            abi.encodeWithSignature("execute(address,bytes)", address(0xBEEF), hex"1234")
        ];
        for (uint256 i; i < forbidden.length; ++i) {
            (bool ok,) = address(_book).call(forbidden[i]);
            assertFalse(ok, "forbidden descriptor accepted");
            (ok,) = address(_book).call{value: 1}(forbidden[i]);
            assertFalse(ok, "forbidden descriptor accepted value");
        }
        (bool receiveOk,) = address(_book).call{value: 1}("");
        assertFalse(receiveOk, "receive surface leaked");
        (bool fallbackOk,) = address(_book).call(hex"deadbeef");
        assertFalse(fallbackOk, "fallback surface leaked");
    }

    function test_task4_01d_exactTwoRowStorageAndEightMemberMappingValue() public {
        string memory json = _artifactJson();
        string memory root = ".storageLayout.storage";
        assertTrue(vm.keyExistsJson(json, string.concat(root, "[0]")), "storage row zero missing");
        assertTrue(vm.keyExistsJson(json, string.concat(root, "[1]")), "mapping root one missing");
        assertFalse(vm.keyExistsJson(json, string.concat(root, "[2]")), "hidden storage root two");
        _assertStorageRow(json, 0, "_finalized", "0", 0, "bool");
        _assertStorageRow(json, 1, "_preVoteBudgets", "1", 0, "mapping");

        string memory mappingType = vm.parseJsonString(json, string.concat(root, "[1].type"));
        string memory mappingPath = _storageTypePath(mappingType);
        assertEq(
            vm.parseJsonString(json, string.concat(mappingPath, ".label")),
            "mapping(uint256 => struct PreVoteBudgetBook.PreVoteBudgetAuthorization)",
            "mapping type label"
        );
        assertEq(vm.parseJsonString(json, string.concat(mappingPath, ".encoding")), "mapping", "mapping encoding");
        assertEq(vm.parseJsonString(json, string.concat(mappingPath, ".numberOfBytes")), "32", "mapping bytes");
        string memory keyType = vm.parseJsonString(json, string.concat(mappingPath, ".key"));
        assertEq(vm.parseJsonString(json, string.concat(_storageTypePath(keyType), ".label")), "uint256", "day key");
        _assertStorageTypeMetadata(json, keyType, "uint256", "inplace", "32");
        string memory valueType = vm.parseJsonString(json, string.concat(mappingPath, ".value"));
        string memory valuePath = _storageTypePath(valueType);
        _assertStorageTypeMetadata(
            json, valueType, "struct PreVoteBudgetBook.PreVoteBudgetAuthorization", "inplace", "256"
        );
        string[8] memory names = [
            "budgetId",
            "ballotDay",
            "maxEthWei",
            "purchaseUntil",
            "availableAtAuthorizationWei",
            "accountingSequence",
            "authorizedAt",
            "detailsHash"
        ];
        string[8] memory types = ["bytes32", "uint256", "uint256", "uint64", "uint256", "uint256", "uint64", "bytes32"];
        for (uint256 i; i < 8; ++i) {
            string memory member = string.concat(valuePath, ".members[", vm.toString(i), "]");
            assertTrue(vm.keyExistsJson(json, member), "record member missing");
            assertEq(vm.parseJsonString(json, string.concat(member, ".label")), names[i], "record member name");
            assertEq(vm.parseJsonString(json, string.concat(member, ".slot")), vm.toString(i), "record member slot");
            assertEq(vm.parseJsonUint(json, string.concat(member, ".offset")), 0, "record member offset");
            string memory memberType = vm.parseJsonString(json, string.concat(member, ".type"));
            _assertStorageTypeMetadata(json, memberType, types[i], "inplace", _same(types[i], "uint64") ? "8" : "32");
        }
        assertFalse(vm.keyExistsJson(json, string.concat(valuePath, ".members[8]")), "hidden record member");
        assertEq(vm.load(address(_book), bytes32(uint256(0))), bytes32(uint256(1)), "finalized slot zero");
        assertEq(vm.load(address(_book), bytes32(uint256(1))), bytes32(0), "raw mapping root zero");
        assertEq(vm.load(address(_book), _recordBase(777)), bytes32(0), "unused mapping leaf zero");
    }

    function test_task4_01e_optimizedIrHasOnlyTwoFixedOutputStaticCalls() public view {
        _assertIrGateNegativeSelfTests();
        string memory json = _artifactJson();
        assertTrue(
            vm.keyExistsJson(json, ".irOptimized"),
            "irOptimized missing; compile with --extra-output storageLayout irOptimized"
        );
        bytes memory canonicalIr = _compactIr(bytes(vm.parseJsonString(json, ".irOptimized")));
        bytes memory ir = _lowerAscii(canonicalIr);
        assertFalse(_contains(ir, bytes("returndatacopy(")), "dynamic returndata copy forbidden");
        assertFalse(_contains(ir, bytes("delegatecall(")), "delegatecall forbidden");
        assertFalse(_contains(ir, bytes("callcode(")), "callcode forbidden");
        assertFalse(_contains(ir, bytes("create2(")), "CREATE2 forbidden");
        assertFalse(_contains(ir, bytes("selfdestruct(")), "SELFDESTRUCT forbidden");
        assertFalse(_containsStandalonePrimitive(ir, bytes("call(")), "generic CALL forbidden");
        assertFalse(_containsStandalonePrimitive(ir, bytes("create(")), "ordinary CREATE forbidden");
        assertEq(_count(ir, bytes("staticcall(")), 2, "exact Authority/Core staticcall inventory");
        assertEq(_count(canonicalIr, bytes("staticcall(")), 2, "mixed-case STATICCALL spelling forbidden");
        _assertStaticcallShape(ir, "160000", "864", "Authority");
        _assertStaticcallShape(ir, "100000", "352", "Core");
        assertLe(vm.parseJsonBytes(json, ".deployedBytecode.object").length, 24_576, "runtime bytecode limit");
        assertLe(type(PreVoteBudgetBook).creationCode.length, 49_152, "initcode limit");
    }

    function test_task4_01f_runtimeOpcodeInventoryIsClosed() public view {
        bytes memory runtime = vm.parseJsonBytes(_artifactJson(), ".deployedBytecode.object");
        uint256 staticcalls;
        for (uint256 pc; pc < runtime.length;) {
            uint8 opcode = uint8(runtime[pc]);
            if (opcode == 0xfe) break;
            if (opcode == 0xfa) ++staticcalls;
            assertTrue(
                opcode != 0x3e && opcode != 0xf0 && opcode != 0xf1 && opcode != 0xf2 && opcode != 0xf4 && opcode != 0xf5
                    && opcode != 0xff,
                "forbidden runtime returndata-copy/call/create/selfdestruct opcode"
            );
            pc += opcode >= 0x60 && opcode <= 0x7f ? uint256(opcode - 0x5f) + 1 : 1;
        }
        assertEq(staticcalls, 2, "exact runtime STATICCALL opcode count");
    }

    function test_task4_02_constructorRejectsZeroAuthorityBeforePrediction() public {
        Task4RawCreateDispatcher dispatcher = new Task4RawCreateDispatcher();
        bytes memory creation =
            _creation(address(dispatcher), _MANIFEST, address(0), address(_core), address(_registry));
        vm.expectRevert(ITask4BudgetBook.BudgetBookZeroAddress.selector);
        dispatcher.deploy(creation);

        Task4FactoryHarness factory = new Task4FactoryHarness();
        vm.expectRevert(ITask4BudgetBook.BudgetBookZeroAddress.selector);
        factory.deployBudget(
            _creation(address(factory), _MANIFEST, address(factory.authority()), address(0), address(_registry))
        );

        factory = new Task4FactoryHarness();
        vm.expectRevert(ITask4BudgetBook.BudgetBookZeroAddress.selector);
        factory.deployBudget(
            _creation(address(factory), _MANIFEST, address(factory.authority()), address(factory.core()), address(0))
        );

        factory = new Task4FactoryHarness();
        vm.expectRevert(ITask4BudgetBook.BudgetBookZeroAddress.selector);
        factory.deployBudget(_creation(address(factory), _MANIFEST, address(0), address(0), address(0)));
    }

    function test_task4_02b_constructorCodeAddressAndPeerPrecedenceIsExact() public {
        Task4FactoryHarness factory = new Task4FactoryHarness();
        vm.expectRevert(abi.encodeWithSelector(ITask4BudgetBook.BudgetBookContractRequired.selector, address(0xBEEF)));
        factory.deployBudget(
            _creation(
                address(factory), _MANIFEST, address(factory.authority()), address(factory.core()), address(0xBEEF)
            )
        );

        Task4RawCreateDispatcher dispatcher = new Task4RawCreateDispatcher();
        address expected = vm.computeCreateAddress(address(dispatcher), 3);
        address actual = vm.computeCreateAddress(address(dispatcher), 1);
        vm.expectRevert(abi.encodeWithSelector(ITask4BudgetBook.BudgetBookAddressMismatch.selector, expected, actual));
        dispatcher.deploy(
            _creation(address(dispatcher), _MANIFEST, address(_authority), address(_core), address(_registry))
        );

        factory = new Task4FactoryHarness();
        address expectedAuthority = address(factory.authority());
        vm.expectRevert(
            abi.encodeWithSelector(
                ITask4BudgetBook.BudgetBookPeerMismatch.selector, uint8(0), expectedAuthority, address(0xCAFE)
            )
        );
        factory.deployBudget(
            _creation(address(factory), _MANIFEST, address(0xCAFE), address(factory.core()), address(_registry))
        );

        factory = new Task4FactoryHarness();
        address expectedCore = address(factory.core());
        vm.expectRevert(
            abi.encodeWithSelector(
                ITask4BudgetBook.BudgetBookPeerMismatch.selector, uint8(1), expectedCore, address(0xCAFE)
            )
        );
        factory.deployBudget(
            _creation(address(factory), _MANIFEST, address(factory.authority()), address(0xCAFE), address(_registry))
        );

        factory = new Task4FactoryHarness();
        vm.etch(address(factory.authority()), "");
        vm.expectRevert(
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookContractRequired.selector, address(factory.authority()))
        );
        factory.deployBudget(
            _creation(
                address(factory), _MANIFEST, address(factory.authority()), address(factory.core()), address(_registry)
            )
        );

        factory = new Task4FactoryHarness();
        vm.etch(address(factory.core()), "");
        vm.expectRevert(
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookContractRequired.selector, address(factory.core()))
        );
        factory.deployBudget(
            _creation(
                address(factory), _MANIFEST, address(factory.authority()), address(factory.core()), address(_registry)
            )
        );
    }

    function test_task4_03_constructorAcceptsForcedPrefundingAndNeverCallsPeers() public {
        Task4FactoryHarness factory = new Task4FactoryHarness();
        address predicted = vm.computeCreateAddress(address(factory), 3);
        vm.deal(address(this), 1 ether);
        new Task4ForceEther{value: 1 ether}(payable(predicted));
        factory.authority().setMode(1);
        factory.core().setMode(1);
        address child = factory.deployBudget(
            _creation(
                address(factory), _MANIFEST, address(factory.authority()), address(factory.core()), address(_registry)
            )
        );
        assertEq(child, predicted, "nonce-3 BudgetBook prediction");
        assertEq(child.balance, 1 ether, "forced prefunding preserved");
    }

    function test_task4_04_finalizerIsOneShotAndMakesNoPeerCall() public {
        (Task4FactoryHarness factory, ITask4BudgetBook book) = _deployBudget(false);
        factory.authority().setMode(1);
        factory.core().setMode(1);
        vm.expectEmit(true, false, false, true, address(book));
        emit ITask4BudgetBook.BudgetBookFinalized(_MANIFEST);
        factory.finalizeBudget(address(book), _MANIFEST);
        (address topologyFactory, bytes32 manifest, bool finalized) = book.budgetBookTopology();
        assertEq(topologyFactory, address(factory), "topology Factory");
        assertEq(manifest, _MANIFEST, "topology manifest");
        assertTrue(finalized, "topology finalized");
        vm.expectRevert(ITask4BudgetBook.BudgetBookAlreadyFinalized.selector);
        factory.finalizeBudget(address(book), _MANIFEST);
    }

    function test_task4_04b_finalizerCallerManifestAlreadyPrecedenceIsExact() public {
        (Task4FactoryHarness factory, ITask4BudgetBook book) = _deployBudget(false);
        bytes32 wrong = keccak256("wrong-manifest");
        vm.expectRevert(
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookFinalizerUnauthorized.selector, address(this))
        );
        book.finalizeBudgetBook(wrong);
        vm.expectRevert(
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookManifestHashMismatch.selector, _MANIFEST, wrong)
        );
        factory.finalizeBudget(address(book), wrong);
        factory.finalizeBudget(address(book), _MANIFEST);
        vm.expectRevert(
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookFinalizerUnauthorized.selector, address(this))
        );
        book.finalizeBudgetBook(_MANIFEST);
        vm.expectRevert(
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookManifestHashMismatch.selector, _MANIFEST, wrong)
        );
        factory.finalizeBudget(address(book), wrong);
        vm.expectRevert(ITask4BudgetBook.BudgetBookAlreadyFinalized.selector);
        factory.finalizeBudget(address(book), _MANIFEST);
    }

    function test_task4_05_prefinalMutatorAndUngatedGetterUseTask4Errors() public {
        (, ITask4BudgetBook book) = _deployBudget(false);
        ITask4BudgetBook.PreVoteBudgetInput memory input = _currentInput(1 ether);
        vm.prank(address(_safe));
        vm.expectRevert(ITask4BudgetBook.BudgetBookNotFinalized.selector);
        book.authorizePreVoteBudget(input, _DETAILS);
        vm.expectRevert(abi.encodeWithSelector(ITask4BudgetBook.BudgetNotFound.selector, input.ballotDay));
        book.getPreVoteBudget(input.ballotDay);
    }

    function test_task4_06_successReadsExactPeersAndCreatesExactEvidence() public {
        ITask4BudgetBook.PreVoteBudgetInput memory input = _currentInput(3 ether);
        vm.expectCall(address(_authority), 0, 160_000, abi.encodeWithSignature("authoritySnapshot()"), 1);
        vm.expectCall(address(_core), 0, 100_000, abi.encodeWithSignature("accountingTotals()"), 1);
        bytes32 expected = _budgetId(address(_book), input, _SEQUENCE);
        vm.prank(address(_safe));
        bytes32 actual = _book.authorizePreVoteBudget(input, _DETAILS);
        assertEq(actual, expected, "exact V2 budget ID");
        ITask4BudgetBook.PreVoteBudgetAuthorization memory record = _book.getPreVoteBudget(input.ballotDay);
        assertEq(record.budgetId, expected, "stored budget ID");
        assertEq(record.availableAtAuthorizationWei, _AVAILABLE, "available snapshot");
        assertEq(record.accountingSequence, _SEQUENCE, "sequence snapshot");
        assertEq(record.detailsHash, _DETAILS, "details evidence");
    }

    function test_task4_07_authorityTransportIsBoundedNormalizedAndAtomic() public {
        ITask4BudgetBook.PreVoteBudgetInput memory input = _currentInput(1 ether);
        uint8[5] memory modes = [uint8(1), 2, 3, 4, 5];
        uint256[5] memory lengths = [uint256(0), 0, 863, 865, 131_072];
        for (uint256 i; i < modes.length; ++i) {
            _authority.setMode(modes[i]);
            bytes memory expected = i < 2
                ? abi.encodeWithSelector(ITask4BudgetBook.BudgetBookAuthoritySnapshotCallFailed.selector)
                : abi.encodeWithSelector(ITask4BudgetBook.BudgetBookAuthoritySnapshotReturnLength.selector, lengths[i]);
            _assertAuthorizeRevertWithCalls(input, _DETAILS, address(_safe), expected, 1, 0);
        }
        _authority.setMode(0);
        vm.expectCall(address(_authority), 0, 160_000, abi.encodeWithSignature("authoritySnapshot()"), 1);
        vm.expectCall(address(_core), 0, 100_000, abi.encodeWithSignature("accountingTotals()"), 1);
        _assertAuthorizeSuccessWithCalls(input, _DETAILS, address(_safe), _budgetId(address(_book), input, _SEQUENCE));
    }

    function test_task4_08_authoritySnapshotEveryFailingOrdinalAndAcceptedOpaqueFields() public {
        uint256[14] memory badValues;
        badValues[0] = 3;
        badValues[1] = uint160(address(_factory)) + 1;
        badValues[2] = uint256(_MANIFEST) ^ 1;
        badValues[3] = uint160(address(_registry)) + 1;
        badValues[4] = uint160(address(_core)) + 1;
        badValues[5] = uint160(address(_book)) + 1;
        badValues[6] = uint160(vm.computeCreateAddress(address(_factory), 4)) + 1;
        badValues[7] = uint160(vm.computeCreateAddress(address(_factory), 5)) + 1;
        badValues[8] = 2;
        badValues[9] = 0;
        badValues[10] = uint256(1) << 160;
        badValues[11] = 2;
        badValues[12] = uint256(1) << 160;
        badValues[13] = uint256(1) << 160;
        for (uint8 ordinal; ordinal < 14; ++ordinal) {
            uint256 snapshot = vm.snapshotState();
            uint256[27] memory words = _validAuthorityWords();
            words[ordinal] = badValues[ordinal];
            _authority.setWords(words);
            _assertAuthorizeRevert(
                _currentInput(1 ether),
                _DETAILS,
                address(_safe),
                abi.encodeWithSelector(ITask4BudgetBook.BudgetBookAuthoritySnapshotSemanticMismatch.selector, ordinal)
            );
            assertTrue(vm.revertToState(snapshot), "Authority ordinal restore");
        }

        Task4CodeStub ingress = new Task4CodeStub();
        uint256[27] memory authorityWords = _validAuthorityWords();
        authorityWords[9] = uint160(address(0xBEEF));
        _assertAuthoritySemantic(authorityWords, 9);
        authorityWords = _validAuthorityWords();
        authorityWords[10] = uint160(address(0xBEEF));
        _assertAuthoritySemantic(authorityWords, 10);

        uint256[27] memory active = _validAuthorityWords();
        active[18] = 1;
        active[20] = uint256(keccak256("active-config"));
        _assertAuthoritySemantic(active, 19);
        active[19] = uint160(address(ingress));
        active[20] = 0;
        _assertAuthoritySemantic(active, 20);
        active = _validAuthorityWords();
        active[18] = 1;
        active[19] = (uint256(1) << 160) | uint160(address(ingress));
        active[20] = uint256(keccak256("dirty-active-ingress"));
        _assertAuthoritySemantic(active, 19);
        active[19] = uint160(address(0xBEEF));
        _assertAuthoritySemantic(active, 19);
        active = _validAuthorityWords();
        active[19] = uint160(address(ingress));
        active[20] = uint256(keccak256("zero-generation-nonzero-tuple"));
        _assertAuthoritySemantic(active, 19);
        active[19] = 0;
        _assertAuthoritySemantic(active, 20);

        active = _validAuthorityWords();
        active[21] = (uint256(1) << 160) | uint160(address(ingress));
        _assertAuthoritySemantic(active, 21);
        active[21] = uint160(address(0xBEEF));
        _assertAuthoritySemantic(active, 21);

        authorityWords = _validAuthorityWords();
        authorityWords[9] = (uint256(1) << 160) | uint160(address(_safe));
        authorityWords[10] = uint256(1) << 160;
        _assertAuthoritySemantic(authorityWords, 9);
        authorityWords = _validAuthorityWords();
        authorityWords[18] = 1;
        authorityWords[20] = uint256(keccak256("compound-active"));
        authorityWords[21] = uint256(1) << 160;
        _assertAuthoritySemantic(authorityWords, 19);
        authorityWords[19] = uint160(address(ingress));
        authorityWords[20] = 0;
        _assertAuthoritySemantic(authorityWords, 20);

        uint256 acceptedSnapshot = vm.snapshotState();
        uint256[27] memory accepted = _validAuthorityWords();
        assertEq(accepted[12], 0, "zero main operator fixture");
        for (uint256 i = 14; i <= 17; ++i) {
            accepted[i] = type(uint256).max - i;
        }
        for (uint256 i = 22; i <= 26; ++i) {
            accepted[i] = type(uint256).max - i;
        }
        accepted[21] = uint160(address(ingress));
        _authority.setWords(accepted);
        _authorize(_currentInput(1 ether), _DETAILS, address(_safe));
        assertTrue(vm.revertToState(acceptedSnapshot), "opaque field success restore");
    }

    function test_task4_09_liveSafePauseReplayAndLocalPrecedenceAreExact() public {
        ITask4BudgetBook.PreVoteBudgetInput memory input = _currentInput(1 ether);
        uint256[27] memory paused = _validAuthorityWords();
        paused[11] = 1;
        _authority.setWords(paused);
        _assertAuthorizeRevert(
            input,
            bytes32(0),
            address(0xCAFE),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookUnauthorized.selector, address(0xCAFE))
        );
        _assertAuthorizeRevert(
            input, bytes32(0), address(_safe), abi.encodeWithSelector(ITask4BudgetBook.BudgetBookPaused.selector)
        );

        _authority.setWords(_validAuthorityWords());
        input.maxEthWei = 0;
        _assertAuthorizeRevert(
            input,
            bytes32(0),
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookEmptyDetailsHash.selector)
        );
        _assertAuthorizeRevert(
            input, _DETAILS, address(_safe), abi.encodeWithSelector(ITask4BudgetBook.BudgetBookInvalidAmount.selector)
        );

        input = _currentInput(1 ether);
        bytes32 id = _authorize(input, _DETAILS, address(_safe));
        _authority.setMode(1);
        _core.setMode(1);
        _assertAuthorizeRevert(
            input,
            keccak256("changed-details"),
            address(0xCAFE),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetAlreadyAuthorized.selector, input.ballotDay)
        );
        assertEq(_book.getPreVoteBudget(input.ballotDay).budgetId, id, "replay cannot rewrite");
    }

    function test_task4_10_calendarDeadlineAndTimestampBoundaries() public {
        uint256 baseline = vm.snapshotState();
        ITask4BudgetBook.PreVoteBudgetInput memory input = _currentInput(1);
        _authorize(input, _DETAILS, address(_safe));
        assertTrue(vm.revertToState(baseline), "current day restore");

        input = _currentInput(1);
        input.ballotDay += 9;
        input.purchaseUntil = _deadline(input.ballotDay);
        _authorize(input, _DETAILS, address(_safe));
        assertTrue(vm.revertToState(baseline), "future day restore");

        input = _currentInput(1);
        input.ballotDay -= 1;
        input.purchaseUntil = _deadline(input.ballotDay);
        _assertAuthorizeRevert(
            input,
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetDayClosed.selector, input.ballotDay)
        );
        input = _currentInput(1);
        uint64 expected = input.purchaseUntil;
        input.purchaseUntil = expected + 1;
        _assertAuthorizeRevert(
            input,
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.InvalidPurchaseUntil.selector, expected, expected + 1)
        );

        input.ballotDay = type(uint256).max;
        _assertAuthorizeRevert(
            input, _DETAILS, address(_safe), abi.encodeWithSelector(ITask4BudgetBook.BudgetDeadlineOverflow.selector)
        );
        vm.warp(type(uint64).max);
        input.ballotDay = block.timestamp / 1 days;
        _assertAuthorizeRevert(
            input, _DETAILS, address(_safe), abi.encodeWithSelector(ITask4BudgetBook.BudgetDeadlineOverflow.selector)
        );
        assertTrue(vm.revertToState(baseline), "max uint64 timestamp restore");
        vm.warp(uint256(type(uint64).max) + 1);
        input.ballotDay = block.timestamp / 1 days;
        _assertAuthorizeRevert(
            input,
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookTimestampOverflow.selector)
        );
        assertTrue(vm.revertToState(baseline), "timestamp overflow restore");

        uint256 maxDay = (uint256(type(uint64).max) - 2 hours) / 1 days - 1;
        uint256 latest = (maxDay + 1) * 1 days - 1;
        vm.warp(latest);
        input.ballotDay = maxDay;
        input.maxEthWei = 1;
        input.purchaseUntil = _deadline(maxDay);
        _authorize(input, _DETAILS, address(_safe));
        assertTrue(vm.revertToState(baseline), "latest full path restore");
    }

    function test_task4_11_coreTransportIsBoundedNormalizedAndAfterLocalChecks() public {
        ITask4BudgetBook.PreVoteBudgetInput memory input = _currentInput(1 ether);
        uint8[5] memory modes = [uint8(1), 2, 3, 4, 5];
        uint256[5] memory lengths = [uint256(0), 0, 351, 353, 131_072];
        for (uint256 i; i < modes.length; ++i) {
            _core.setMode(modes[i]);
            bytes memory expected = i < 2
                ? abi.encodeWithSelector(ITask4BudgetBook.BudgetBookCoreAccountingCallFailed.selector)
                : abi.encodeWithSelector(ITask4BudgetBook.BudgetBookCoreAccountingReturnLength.selector, lengths[i]);
            _assertAuthorizeRevertWithCalls(input, _DETAILS, address(_safe), expected, 1, 1);
        }
        _core.setMode(1);
        input.maxEthWei = 0;
        _assertAuthorizeRevert(
            input,
            bytes32(0),
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookEmptyDetailsHash.selector)
        );
        _core.setMode(0);
        input = _currentInput(1 ether);
        vm.expectCall(address(_authority), 0, 160_000, abi.encodeWithSignature("authoritySnapshot()"), 1);
        vm.expectCall(address(_core), 0, 100_000, abi.encodeWithSignature("accountingTotals()"), 1);
        _assertAuthorizeSuccessWithCalls(input, _DETAILS, address(_safe), _budgetId(address(_book), input, _SEQUENCE));
    }

    function test_task4_12_coreEveryEquationAndFinancialGatePrecedence() public {
        for (uint8 field = 4; field <= 9; ++field) {
            uint256 snapshot = vm.snapshotState();
            uint256[11] memory words = _validCoreWords();
            if (field == 4) {
                words[3] = 0;
                words[4] = 1;
            } else if (field == 5) {
                words[5] = 1;
            } else if (field == 6) {
                words[6] += 1;
            } else if (field == 7) {
                words[7] += 1;
            } else if (field == 8) {
                words[8] = 1;
            } else {
                words[9] = 1;
            }
            _core.setWords(words);
            _assertAuthorizeRevert(
                _currentInput(1),
                _DETAILS,
                address(_safe),
                abi.encodeWithSelector(ITask4BudgetBook.BudgetBookCoreAccountingSemanticMismatch.selector, field)
            );
            assertTrue(vm.revertToState(snapshot), "Core semantic restore");
        }

        uint256[11] memory totals = _validCoreWords();
        totals[0] = 8 ether;
        totals[3] = 5 ether;
        totals[4] = 3 ether;
        totals[5] = 2 ether;
        totals[6] = 11 ether;
        totals[7] = 10 ether;
        totals[8] = 1 ether;
        vm.deal(address(_core), 10 ether);
        _core.setWords(totals);
        _assertAuthorizeRevert(
            _currentInput(9 ether),
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookBalanceDeficitActive.selector, 1 ether)
        );
        totals[3] = 4 ether;
        totals[4] = 2 ether;
        totals[5] = 2 ether;
        totals[6] = 10 ether;
        totals[8] = 0;
        _core.setWords(totals);
        _assertAuthorizeRevert(
            _currentInput(9 ether),
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookReconciliationShortfallActive.selector, 2 ether)
        );
        totals[3] = 2 ether;
        totals[4] = 2 ether;
        totals[5] = 0;
        _core.setWords(totals);
        _assertAuthorizeRevert(
            _currentInput(9 ether),
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.InsufficientAvailable.selector, 8 ether, 9 ether)
        );

        totals = _validCoreWords();
        totals[0] = type(uint256).max;
        totals[1] = 1;
        totals[6] = 0;
        totals[7] = 0;
        _core.setWords(totals);
        _assertAuthorizeRevert(
            _currentInput(1),
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookCoreAccountingSemanticMismatch.selector, uint8(6))
        );
    }

    function test_task4_13_successRecordEventStorageAndAccountingAreExact() public {
        ITask4BudgetBook.PreVoteBudgetInput memory input = _currentInput(3 ether);
        bytes32 expectedId = _budgetId(address(_book), input, _SEQUENCE);
        uint256 coreBalance = address(_core).balance;
        bytes32 coreBefore = _coreOracleDigest();
        vm.recordLogs();
        vm.record();
        bytes32 actual = _authorize(input, _DETAILS, address(_safe));
        (, bytes32[] memory writes) = vm.accesses(address(_book));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(actual, expectedId, "budget ID");
        assertEq(logs.length, 1, "single BudgetBook event");
        assertEq(logs[0].emitter, address(_book), "BudgetBook emitter");
        assertEq(logs[0].topics.length, 3, "event topic arity");
        assertEq(
            logs[0].topics[0],
            keccak256("PreVoteBudgetAuthorized(bytes32,uint256,uint256,uint64,uint256,uint256,uint64,uint8,bytes32)"),
            "event signature"
        );
        assertEq(logs[0].topics[1], expectedId, "event budget ID");
        assertEq(logs[0].topics[2], bytes32(input.ballotDay), "event day");
        assertEq(
            logs[0].data,
            abi.encode(
                input.maxEthWei,
                input.purchaseUntil,
                _AVAILABLE,
                _SEQUENCE,
                uint64(block.timestamp),
                uint8(19),
                _DETAILS
            ),
            "full event data"
        );
        assertEq(writes.length, 8, "only eight record slots written");
        bytes32 base = _recordBase(input.ballotDay);
        for (uint256 i; i < 8; ++i) {
            assertEq(writes[i], _offset(base, i), "record write order");
        }
        assertEq(address(_core).balance, coreBalance, "Core balance unchanged");
        assertEq(_coreOracleDigest(), coreBefore, "Core oracle unchanged");

        ITask4BudgetBook.PreVoteBudgetAuthorization memory record = _book.getPreVoteBudget(input.ballotDay);
        assertEq(record.budgetId, expectedId, "record ID");
        assertEq(record.ballotDay, input.ballotDay, "record day");
        assertEq(record.maxEthWei, input.maxEthWei, "record amount");
        assertEq(record.purchaseUntil, input.purchaseUntil, "record deadline");
        assertEq(record.availableAtAuthorizationWei, _AVAILABLE, "record available");
        assertEq(record.accountingSequence, _SEQUENCE, "record sequence");
        assertEq(record.authorizedAt, uint64(block.timestamp), "record timestamp");
        assertEq(record.detailsHash, _DETAILS, "record details");
    }

    function test_task4_14_recordsAreOnePerDayImmutableAndResultIndependent() public {
        ITask4BudgetBook.PreVoteBudgetInput memory dayOne = _currentInput(2 ether);
        bytes32 idOne = _authorize(dayOne, _DETAILS, address(_safe));
        ITask4BudgetBook.PreVoteBudgetAuthorization memory frozen = _book.getPreVoteBudget(dayOne.ballotDay);
        uint256[27] memory changedAuthority = _validAuthorityWords();
        changedAuthority[11] = 1;
        _authority.setWords(changedAuthority);
        uint256[11] memory changedCore = _validCoreWords();
        changedCore[0] = 1;
        changedCore[6] = 1;
        changedCore[7] = 1;
        changedCore[10] = 999;
        vm.deal(address(_core), 1);
        _core.setWords(changedCore);
        vm.warp(block.timestamp + 30 days);
        ITask4BudgetBook.PreVoteBudgetAuthorization memory afterChanges = _book.getPreVoteBudget(dayOne.ballotDay);
        assertEq(keccak256(abi.encode(afterChanges)), keccak256(abi.encode(frozen)), "record immutable");
        assertEq(idOne, frozen.budgetId, "result-independent identity retained");
    }

    function test_task4_15_everyAdjacentAuthorizationStageHasExactFirstErrorAndCallBoundary() public {
        uint256 clean = vm.snapshotState();
        ITask4BudgetBook.PreVoteBudgetInput memory input = _currentInput(1 ether);

        (, ITask4BudgetBook prefinal) = _deployBudget(false);
        ITask4BudgetBook original = _book;
        _book = prefinal;
        vm.store(address(_book), _recordBase(input.ballotDay), keccak256("existing-prefinal"));
        _assertAuthorizeRevertWithCalls(
            input,
            bytes32(0),
            address(0xCAFE),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookNotFinalized.selector),
            0,
            0
        );
        _book = original;
        assertTrue(vm.revertToState(clean), "stage 1 restore");

        vm.store(address(_book), _recordBase(input.ballotDay), keccak256("existing-final"));
        _authority.setMode(1);
        _assertAuthorizeRevertWithCalls(
            input,
            bytes32(0),
            address(0xCAFE),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetAlreadyAuthorized.selector, input.ballotDay),
            0,
            0
        );
        assertTrue(vm.revertToState(clean), "stage 2 restore");

        _authority.setMode(1);
        _assertAuthorizeRevertWithCalls(
            input,
            bytes32(0),
            address(0xCAFE),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookAuthoritySnapshotCallFailed.selector),
            1,
            0
        );
        assertTrue(vm.revertToState(clean), "stage 3 restore");
        _authority.setMode(3);
        _assertAuthorizeRevertWithCalls(
            input,
            bytes32(0),
            address(0xCAFE),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookAuthoritySnapshotReturnLength.selector, 863),
            1,
            0
        );
        assertTrue(vm.revertToState(clean), "stage 4 restore");

        uint256[27] memory authorityWords = _validAuthorityWords();
        authorityWords[0] = 3;
        authorityWords[11] = 1;
        _authority.setWords(authorityWords);
        _assertAuthorizeRevertWithCalls(
            input,
            bytes32(0),
            address(0xCAFE),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookAuthoritySnapshotSemanticMismatch.selector, 0),
            1,
            0
        );
        assertTrue(vm.revertToState(clean), "stage 5 restore");
        authorityWords = _validAuthorityWords();
        authorityWords[11] = 1;
        _authority.setWords(authorityWords);
        _assertAuthorizeRevertWithCalls(
            input,
            bytes32(0),
            address(0xCAFE),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookUnauthorized.selector, address(0xCAFE)),
            1,
            0
        );
        assertTrue(vm.revertToState(clean), "stage 6 restore");
        authorityWords = _validAuthorityWords();
        authorityWords[11] = 1;
        _authority.setWords(authorityWords);
        _assertAuthorizeRevertWithCalls(
            input, bytes32(0), address(_safe), abi.encodeWithSelector(ITask4BudgetBook.BudgetBookPaused.selector), 1, 0
        );
        assertTrue(vm.revertToState(clean), "stage 7 restore");

        input.maxEthWei = 0;
        _assertAuthorizeRevertWithCalls(
            input,
            bytes32(0),
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookEmptyDetailsHash.selector),
            1,
            0
        );
        assertTrue(vm.revertToState(clean), "stage 8 restore");
        input = _currentInput(0);
        vm.warp(uint256(type(uint64).max) + 1);
        _assertAuthorizeRevertWithCalls(
            input,
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookInvalidAmount.selector),
            1,
            0
        );
        assertTrue(vm.revertToState(clean), "stage 9 restore");

        input = _currentInput(1);
        vm.warp(uint256(type(uint64).max) + 1);
        input.ballotDay = type(uint256).max;
        _assertAuthorizeRevertWithCalls(
            input,
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookTimestampOverflow.selector),
            1,
            0
        );
        assertTrue(vm.revertToState(clean), "stage 10 restore");
        input = _currentInput(1);
        input.ballotDay = type(uint256).max;
        _assertAuthorizeRevertWithCalls(
            input,
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetDeadlineOverflow.selector),
            1,
            0
        );
        assertTrue(vm.revertToState(clean), "stage 11 restore");
        input = _currentInput(1);
        input.ballotDay -= 1;
        input.purchaseUntil = _deadline(input.ballotDay) + 1;
        _assertAuthorizeRevertWithCalls(
            input,
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetDayClosed.selector, input.ballotDay),
            1,
            0
        );
        assertTrue(vm.revertToState(clean), "stage 12 restore");

        input = _currentInput(1);
        uint64 expectedDeadline = input.purchaseUntil;
        input.purchaseUntil += 1;
        _core.setMode(1);
        _assertAuthorizeRevertWithCalls(
            input,
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(
                ITask4BudgetBook.InvalidPurchaseUntil.selector, expectedDeadline, expectedDeadline + 1
            ),
            1,
            0
        );
        assertTrue(vm.revertToState(clean), "stage 13 restore");
        _core.setMode(1);
        _assertAuthorizeRevertWithCalls(
            _currentInput(100 ether),
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookCoreAccountingCallFailed.selector),
            1,
            1
        );
        assertTrue(vm.revertToState(clean), "stage 14 restore");
        _core.setMode(3);
        _assertAuthorizeRevertWithCalls(
            _currentInput(100 ether),
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookCoreAccountingReturnLength.selector, 351),
            1,
            1
        );
        assertTrue(vm.revertToState(clean), "stage 15 restore");

        uint256[11] memory totals = _validCoreWords();
        totals[4] = 1;
        totals[8] = 1;
        _core.setWords(totals);
        _assertAuthorizeRevertWithCalls(
            _currentInput(100 ether),
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookCoreAccountingSemanticMismatch.selector, 4),
            1,
            1
        );
        assertTrue(vm.revertToState(clean), "stage 16 restore");

        totals = _validCoreWords();
        totals[0] = 8 ether;
        totals[3] = 5 ether;
        totals[4] = 3 ether;
        totals[5] = 2 ether;
        totals[6] = 11 ether;
        totals[7] = 10 ether;
        totals[8] = 1 ether;
        vm.deal(address(_core), 10 ether);
        _core.setWords(totals);
        _assertAuthorizeRevertWithCalls(
            _currentInput(9 ether),
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookBalanceDeficitActive.selector, 1 ether),
            1,
            1
        );
        assertTrue(vm.revertToState(clean), "stage 17 restore");
        totals[0] = 8 ether;
        totals[3] = 3 ether;
        totals[4] = 1 ether;
        totals[5] = 2 ether;
        totals[6] = 9 ether;
        totals[7] = 9 ether;
        totals[8] = 0;
        vm.deal(address(_core), 9 ether);
        _core.setWords(totals);
        _assertAuthorizeRevertWithCalls(
            _currentInput(9 ether),
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookReconciliationShortfallActive.selector, 2 ether),
            1,
            1
        );
        assertTrue(vm.revertToState(clean), "stage 18 restore");
        _assertAuthorizeRevertWithCalls(
            _currentInput(_AVAILABLE + 1),
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.InsufficientAvailable.selector, _AVAILABLE, _AVAILABLE + 1),
            1,
            1
        );
        assertTrue(vm.revertToState(clean), "stage 19 restore");
    }

    function test_task4_16_forcedEthRegistryAndTokenCustodyRemainInert() public {
        Task4TestToken token = new Task4TestToken();
        token.mint(address(_book), 99 ether);
        vm.deal(address(_book), 7 ether);
        uint256 budgetBalance = address(_book).balance;
        uint256 tokenBalance = token.balanceOf(address(_book));
        vm.record();
        _authorize(_currentInput(1 ether), _DETAILS, address(_safe));
        (bytes32[] memory registryReads, bytes32[] memory registryWrites) = vm.accesses(address(_registry));
        (bytes32[] memory tokenReads, bytes32[] memory tokenWrites) = vm.accesses(address(token));
        assertEq(registryReads.length, 0, "Registry storage read");
        assertEq(registryWrites.length, 0, "Registry storage write");
        assertEq(tokenReads.length, 0, "token storage read");
        assertEq(tokenWrites.length, 0, "token storage write");
        assertEq(address(_book).balance, budgetBalance, "forced ETH unchanged");
        assertEq(token.balanceOf(address(_book)), tokenBalance, "token custody unchanged");
    }

    function test_task4_17_amountSequenceSurplusAndV2DomainEdges() public {
        uint256 clean = vm.snapshotState();
        ITask4BudgetBook.PreVoteBudgetInput memory input = _currentInput(1);
        bytes32 oneWei = _authorize(input, _DETAILS, address(_safe));
        assertEq(oneWei, _budgetId(address(_book), input, _SEQUENCE), "one wei ID");
        assertTrue(vm.revertToState(clean), "one wei restore");

        input = _currentInput(_AVAILABLE);
        _authorize(input, _DETAILS, address(_safe));
        assertTrue(vm.revertToState(clean), "exact available restore");
        input = _currentInput(_AVAILABLE + 1);
        _assertAuthorizeRevert(
            input,
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.InsufficientAvailable.selector, _AVAILABLE, _AVAILABLE + 1)
        );

        uint256[11] memory totals = _validCoreWords();
        totals[10] = type(uint256).max;
        _core.setWords(totals);
        input = _currentInput(1);
        bytes32 maxSequence = _authorize(input, _DETAILS, address(_safe));
        assertEq(maxSequence, _budgetId(address(_book), input, type(uint256).max), "max sequence accepted");
        assertTrue(vm.revertToState(clean), "max sequence restore");

        totals = _validCoreWords();
        totals[7] = _AVAILABLE + 2 ether;
        totals[9] = 2 ether;
        vm.deal(address(_core), _AVAILABLE + 2 ether);
        _core.setWords(totals);
        _assertAuthorizeRevert(
            _currentInput(_AVAILABLE + 1),
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.InsufficientAvailable.selector, _AVAILABLE, _AVAILABLE + 1)
        );
        assertTrue(vm.revertToState(clean), "forced surplus restore");

        input = _currentInput(1 ether);
        bytes32 baseId = _budgetId(address(_book), input, _SEQUENCE);
        ITask4BudgetBook.PreVoteBudgetInput memory changed = input;
        changed.ballotDay += 1;
        changed.purchaseUntil = _deadline(changed.ballotDay);
        assertTrue(baseId != _budgetId(address(_book), changed, _SEQUENCE), "day domain separation");
        changed = input;
        changed.maxEthWei += 1;
        assertTrue(baseId != _budgetId(address(_book), changed, _SEQUENCE), "amount domain separation");
        changed = input;
        changed.purchaseUntil += 1;
        assertTrue(baseId != _budgetId(address(_book), changed, _SEQUENCE), "deadline domain separation");
        assertTrue(baseId != _budgetId(address(_book), input, _SEQUENCE + 1), "sequence domain separation");
    }

    function test_task4_18_realFactoryAuthorityCoreRegistryLifecycleAuthorizes() public {
        StockTokenRegistryV2 registry = new StockTokenRegistryV2(address(this), address(this));
        address predictedFactory = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        ProductionBundle memory bundle = _productionBundle(predictedFactory, registry, _GLOBAL_CAP);
        AcquisitionConstellationFactory factory = new AcquisitionConstellationFactory(
            address(this),
            address(registry),
            address(registry).codehash,
            _GLOBAL_CAP,
            bundle.initcodeHashes,
            bundle.runtimeHashes
        );
        assertEq(address(factory), predictedFactory, "real Factory prediction");
        for (uint8 i; i < 5; ++i) {
            assertEq(factory.deployNext(bundle.initcodes[i]), bundle.children[i], "real child CREATE order");
        }
        factory.finalizeConstellation();

        AcquisitionAuthority authority = AcquisitionAuthority(bundle.children[0]);
        AcquisitionVaultCore core = AcquisitionVaultCore(payable(bundle.children[1]));
        ITask4BudgetBook book = ITask4BudgetBook(bundle.children[2]);
        (address topologyFactory, bytes32 manifest, bool finalized) = book.budgetBookTopology();
        assertEq(topologyFactory, address(factory), "real BudgetBook Factory");
        assertEq(manifest, bundle.manifest, "real BudgetBook manifest");
        assertTrue(finalized, "real BudgetBook finalized");
        assertEq(core.stockTokenRegistryV2(), address(registry), "real Core Registry");

        vm.deal(address(core), 3 ether);
        core.syncBalance();
        core.reclassifyUnattributed(1 ether, keccak256("task4-real-available"));
        AcquisitionVaultCore.AccountingTotals memory totals = core.accountingTotals();
        assertEq(totals.availableWei, 1 ether, "real Core available");
        assertEq(totals.unattributedWei, 2 ether, "real Core unattributed");
        assertEq(totals.accountingSequence, 2, "real Core sequence");

        bytes32 packedAuthoritySlot = vm.load(address(authority), bytes32(uint256(3)));
        vm.store(
            address(authority), bytes32(uint256(3)), bytes32(uint256(packedAuthoritySlot) & ~(uint256(0xff) << 160))
        );
        assertFalse(authority.paused(), "test-only live Authority unpause");

        ITask4BudgetBook.PreVoteBudgetInput memory input;
        input.ballotDay = block.timestamp / 1 days;
        input.maxEthWei = 1 ether;
        input.purchaseUntil = _deadline(input.ballotDay);
        bytes32 expected =
            _budgetIdFor(address(core), address(book), address(registry), input, totals.accountingSequence);
        bytes32 actual = book.authorizePreVoteBudget(input, _DETAILS);
        assertEq(actual, expected, "real lifecycle Budget ID");
        assertEq(book.getPreVoteBudget(input.ballotDay).budgetId, expected, "real lifecycle record");
        assertEq(core.accountingTotals().accountingSequence, 2, "BudgetBook leaves real Core unchanged");
    }

    function test_task4_19_twoDayFixtureDomainsAndForbiddenFieldsAreIndependent() public {
        bytes32 coreBefore = _coreOracleDigest();
        uint256 coreBalance = address(_core).balance;
        uint256 budgetBalance = address(_book).balance;
        ITask4BudgetBook.PreVoteBudgetInput memory dayOne = _currentInput(2 ether);
        ITask4BudgetBook.PreVoteBudgetInput memory dayTwo = dayOne;
        dayTwo.ballotDay += 1;
        dayTwo.maxEthWei = 3 ether;
        dayTwo.purchaseUntil = _deadline(dayTwo.ballotDay);
        bytes32 idOne = _authorize(dayOne, _DETAILS, address(_safe));
        bytes32 idTwo = _authorize(dayTwo, keccak256("day-two-details"), address(_safe));
        assertEq(idOne, _budgetId(address(_book), dayOne, _SEQUENCE), "day one exact ID");
        assertEq(idTwo, _budgetId(address(_book), dayTwo, _SEQUENCE), "day two exact ID");
        assertTrue(idOne != idTwo, "independent day IDs");
        assertEq(_book.getPreVoteBudget(dayOne.ballotDay).budgetId, idOne, "day one retained");
        assertEq(_book.getPreVoteBudget(dayTwo.ballotDay).budgetId, idTwo, "day two retained");
        assertEq(_coreOracleDigest(), coreBefore, "two-day Core unchanged");
        assertEq(address(_core).balance, coreBalance, "two-day Core balance");
        assertEq(address(_book).balance, budgetBalance, "two-day BudgetBook balance");

        Task4RegistrySentinel secondRegistry = new Task4RegistrySentinel();
        (Task4FactoryHarness secondFactory, ITask4BudgetBook secondBook) =
            _deployBudgetForRegistry(address(secondRegistry), false);
        bytes32 baseId = _budgetId(address(_book), dayOne, _SEQUENCE);
        assertTrue(
            baseId
                != _budgetIdFor(address(secondFactory.core()), address(_book), address(_registry), dayOne, _SEQUENCE),
            "Core domain separation across fixture"
        );
        assertTrue(
            baseId != _budgetIdFor(address(_core), address(secondBook), address(_registry), dayOne, _SEQUENCE),
            "BudgetBook domain separation across fixture"
        );
        assertTrue(
            baseId != _budgetIdFor(address(_core), address(_book), address(secondRegistry), dayOne, _SEQUENCE),
            "Registry domain separation across fixture"
        );

        Task4CodeStub role = new Task4CodeStub();
        ITask4BudgetBook.PreVoteBudgetInput memory excluded = dayOne;
        excluded.ballotDay += 2;
        excluded.maxEthWei = 1 ether;
        excluded.purchaseUntil = _deadline(excluded.ballotDay);
        uint256 clean = vm.snapshotState();
        bytes32 baselineExcluded = _authorize(excluded, _DETAILS, address(_safe));
        assertTrue(vm.revertToState(clean), "excluded-field baseline restore");
        uint256[27] memory changedAuthority = _validAuthorityWords();
        changedAuthority[10] = uint160(address(role));
        changedAuthority[12] = uint160(address(role));
        changedAuthority[13] = uint160(address(role));
        changedAuthority[14] = 111;
        changedAuthority[15] = 222;
        changedAuthority[16] = 333;
        changedAuthority[17] = 444;
        changedAuthority[18] = 9;
        changedAuthority[19] = uint160(address(role));
        changedAuthority[20] = uint256(keccak256("excluded-active-config"));
        changedAuthority[21] = uint160(address(role));
        changedAuthority[22] = uint256(keccak256("excluded-pending-config"));
        changedAuthority[23] = 555;
        changedAuthority[24] = uint256(keccak256("excluded-operator-state"));
        changedAuthority[25] = 666;
        changedAuthority[26] = uint256(keccak256("excluded-ingress-state"));
        _authority.setWords(changedAuthority);
        vm.warp(block.timestamp + 1 hours);
        bytes32 changedExcluded = _authorize(excluded, keccak256("changed-excluded-details"), address(_safe));
        assertEq(changedExcluded, baselineExcluded, "forbidden fields excluded from ID");
    }

    function invariant_task4_oneImmutableRecordPerDayAndNoCoreOrFundMovement() public view {
        uint256 attempts = _invariantHandler.attempts();
        if (attempts != 0) assertGt(_invariantHandler.successfulDays(), 0, "all Task4 authorizations failed");
        assertLe(_invariantHandler.successfulDays(), 2, "more successful days than bounded domain");
        for (uint256 i; i < 2; ++i) {
            bytes32 id = _invariantHandler.id(i);
            if (id == bytes32(0)) continue;
            ITask4BudgetBook.PreVoteBudgetAuthorization memory record = _book.getPreVoteBudget(_invariantHandler.day(i));
            assertEq(record.budgetId, id, "invariant day ID");
            assertEq(keccak256(abi.encode(record)), _invariantHandler.recordHash(i), "invariant immutable record");
        }
        assertEq(_coreOracleDigest(), _invariantCoreDigest, "invariant Core unchanged");
        assertEq(address(_core).balance, _invariantCoreBalance, "invariant Core balance");
        assertEq(address(_book).balance, _invariantBudgetBalance, "invariant BudgetBook balance");
    }

    function _productionBundle(address predictedFactory, StockTokenRegistryV2 registry, uint256 cap)
        private
        returns (ProductionBundle memory bundle)
    {
        bundle.predictedFactory = predictedFactory;
        for (uint8 i; i < 5; ++i) {
            bundle.children[i] = vm.computeCreateAddress(predictedFactory, uint256(i) + 1);
        }
        bundle.configurationRoot =
            keccak256(abi.encode(_TASK3_CONFIG_TAG, uint256(3), address(registry), address(registry).codehash, cap));
        bundle.manifest = keccak256(
            abi.encode(
                _CONSTELLATION_TAG,
                _CHAIN_ID,
                predictedFactory,
                address(this),
                bundle.configurationRoot,
                address(registry),
                address(registry).codehash,
                bundle.children[0],
                bundle.children[1],
                bundle.children[2],
                bundle.children[3],
                bundle.children[4]
            )
        );
        bundle.initcodes[0] = abi.encodePacked(
            type(AcquisitionAuthority).creationCode,
            abi.encode(
                predictedFactory,
                bundle.manifest,
                address(this),
                address(registry),
                bundle.children[1],
                bundle.children[2],
                bundle.children[3],
                bundle.children[4]
            )
        );
        bundle.initcodes[1] = abi.encodePacked(
            type(AcquisitionVaultCore).creationCode,
            abi.encode(
                predictedFactory,
                bundle.manifest,
                bundle.children[0],
                address(registry),
                bundle.children[2],
                bundle.children[3],
                bundle.children[4],
                cap
            )
        );
        bundle.initcodes[2] = abi.encodePacked(
            type(PreVoteBudgetBook).creationCode,
            abi.encode(predictedFactory, bundle.manifest, bundle.children[0], bundle.children[1], address(registry))
        );
        bundle.initcodes[3] = abi.encodePacked(
            type(AcquisitionIntentExecution).creationCode, abi.encode(predictedFactory, bundle.manifest)
        );
        bundle.initcodes[4] = abi.encodePacked(
            type(AcquisitionReconciliation).creationCode, abi.encode(predictedFactory, bundle.manifest)
        );
        for (uint8 i; i < 5; ++i) {
            bundle.initcodeHashes[i] = keccak256(bundle.initcodes[i]);
        }

        uint256 clean = vm.snapshotState();
        vm.etch(predictedFactory, type(Task4RawCreateDispatcher).runtimeCode);
        vm.setNonce(predictedFactory, 1);
        for (uint8 i; i < 5; ++i) {
            address child = Task4RawCreateDispatcher(predictedFactory).deploy(bundle.initcodes[i]);
            assertEq(child, bundle.children[i], "shadow child CREATE order");
            bundle.runtimeHashes[i] = child.codehash;
        }
        assertTrue(vm.revertToState(clean), "shadow production deployment restore");
    }

    function _deployBudget(bool finalize) private returns (Task4FactoryHarness factory, ITask4BudgetBook book) {
        return _deployBudgetForRegistry(address(_registry), finalize);
    }

    function _deployBudgetForRegistry(address registry, bool finalize)
        private
        returns (Task4FactoryHarness factory, ITask4BudgetBook book)
    {
        factory = new Task4FactoryHarness();
        address expected = vm.computeCreateAddress(address(factory), 3);
        address child = factory.deployBudget(
            _creation(address(factory), _MANIFEST, address(factory.authority()), address(factory.core()), registry)
        );
        assertEq(child, expected, "BudgetBook nonce-3 deployment");
        book = ITask4BudgetBook(child);
        if (finalize) factory.finalizeBudget(child, _MANIFEST);
    }

    function _creation(address factory, bytes32 manifest, address authority, address core, address registry)
        private
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            type(PreVoteBudgetBook).creationCode, abi.encode(factory, manifest, authority, core, registry)
        );
    }

    function _configureValidPeers(
        Task4FactoryHarness factory,
        ITask4BudgetBook book,
        Task4AuthorityOracle authority,
        Task4CoreOracle core
    ) private {
        authority.setWords(_validAuthorityWordsFor(factory, book, core));
        vm.deal(address(core), _AVAILABLE);
        core.setWords(_validCoreWords());
    }

    function _validAuthorityWords() private view returns (uint256[27] memory words) {
        return _validAuthorityWordsFor(_factory, _book, _core);
    }

    function _validAuthorityWordsFor(Task4FactoryHarness factory, ITask4BudgetBook book, Task4CoreOracle core)
        private
        view
        returns (uint256[27] memory a)
    {
        a[0] = 2;
        a[1] = uint160(address(factory));
        a[2] = uint256(_MANIFEST);
        a[3] = uint160(address(_registry));
        a[4] = uint160(address(core));
        a[5] = uint160(address(book));
        a[6] = uint160(vm.computeCreateAddress(address(factory), 4));
        a[7] = uint160(vm.computeCreateAddress(address(factory), 5));
        a[8] = 1;
        a[9] = uint160(address(_safe));
    }

    function _validCoreWords() private pure returns (uint256[11] memory c) {
        c[0] = _AVAILABLE;
        c[6] = _AVAILABLE;
        c[7] = _AVAILABLE;
        c[10] = _SEQUENCE;
    }

    function _currentInput(uint256 amount) private view returns (ITask4BudgetBook.PreVoteBudgetInput memory input) {
        input.ballotDay = block.timestamp / 1 days;
        input.maxEthWei = amount;
        input.purchaseUntil = uint64((input.ballotDay + 1) * 1 days + 2 hours);
    }

    function _budgetId(address budgetBook, ITask4BudgetBook.PreVoteBudgetInput memory input, uint256 accountingSequence)
        private
        view
        returns (bytes32)
    {
        return _budgetIdFor(address(_core), budgetBook, address(_registry), input, accountingSequence);
    }

    function _budgetIdFor(
        address core,
        address budgetBook,
        address registry,
        ITask4BudgetBook.PreVoteBudgetInput memory input,
        uint256 accountingSequence
    ) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                _BUDGET_TAG,
                uint256(_CHAIN_ID),
                core,
                budgetBook,
                registry,
                input.ballotDay,
                input.maxEthWei,
                input.purchaseUntil,
                accountingSequence
            )
        );
    }

    function _authorize(ITask4BudgetBook.PreVoteBudgetInput memory input, bytes32 detailsHash, address caller)
        private
        returns (bytes32 budgetId)
    {
        vm.prank(caller);
        budgetId = _book.authorizePreVoteBudget(input, detailsHash);
    }

    function _assertAuthorizeRevert(
        ITask4BudgetBook.PreVoteBudgetInput memory input,
        bytes32 detailsHash,
        address caller,
        bytes memory expected
    ) private {
        vm.prank(caller);
        (bool ok, bytes memory actual) =
            address(_book).call(abi.encodeCall(ITask4BudgetBook.authorizePreVoteBudget, (input, detailsHash)));
        assertFalse(ok, "authorization unexpectedly succeeded");
        assertEq(actual, expected, "exact authorization revert");
    }

    function _assertAuthorizeRevertWithCalls(
        ITask4BudgetBook.PreVoteBudgetInput memory input,
        bytes32 detailsHash,
        address caller,
        bytes memory expected,
        uint256 expectedAuthorityCalls,
        uint256 expectedCoreCalls
    ) private {
        bytes32 budgetBefore = _budgetDigest(input.ballotDay);
        bytes32 authorityBefore = _authorityOracleDigest();
        bytes32 coreBefore = _coreOracleDigest();
        uint256 callerBefore = caller.balance;
        vm.recordLogs();
        vm.startStateDiffRecording();
        vm.prank(caller);
        (bool ok, bytes memory actual) =
            address(_book).call(abi.encodeCall(ITask4BudgetBook.authorizePreVoteBudget, (input, detailsHash)));
        Vm.AccountAccess[] memory accesses = vm.stopAndReturnStateDiff();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertFalse(ok, "authorization unexpectedly succeeded");
        assertEq(actual, expected, "exact authorization revert");
        _assertPeerCallTrace(accesses, expectedAuthorityCalls, expectedCoreCalls);
        assertEq(_budgetDigest(input.ballotDay), budgetBefore, "BudgetBook rollback");
        assertEq(_authorityOracleDigest(), authorityBefore, "Authority rollback");
        assertEq(_coreOracleDigest(), coreBefore, "Core rollback");
        assertEq(caller.balance, callerBefore, "caller balance rollback");
        assertEq(logs.length, 0, "failure log rollback");
    }

    function _assertAuthorizeSuccessWithCalls(
        ITask4BudgetBook.PreVoteBudgetInput memory input,
        bytes32 detailsHash,
        address caller,
        bytes32 expectedId
    ) private {
        vm.startStateDiffRecording();
        bytes32 actual = _authorize(input, detailsHash, caller);
        Vm.AccountAccess[] memory accesses = vm.stopAndReturnStateDiff();
        assertEq(actual, expectedId, "successful budget ID");
        _assertPeerCallTrace(accesses, 1, 1);
    }

    function _assertPeerCallTrace(
        Vm.AccountAccess[] memory accesses,
        uint256 expectedAuthorityCalls,
        uint256 expectedCoreCalls
    ) private view {
        uint256 authorityCalls;
        uint256 coreCalls;
        bytes memory authorityCalldata = abi.encodeWithSignature("authoritySnapshot()");
        bytes memory coreCalldata = abi.encodeWithSignature("accountingTotals()");
        for (uint256 i; i < accesses.length; ++i) {
            Vm.AccountAccess memory access = accesses[i];
            if (access.accessor != address(_book)) continue;
            bool callKind = access.kind == VmSafe.AccountAccessKind.Call
                || access.kind == VmSafe.AccountAccessKind.StaticCall
                || access.kind == VmSafe.AccountAccessKind.DelegateCall
                || access.kind == VmSafe.AccountAccessKind.CallCode;
            if (!callKind) continue;
            assertEq(uint256(access.kind), uint256(VmSafe.AccountAccessKind.StaticCall), "BudgetBook peer call kind");
            assertEq(access.value, 0, "BudgetBook peer call value");
            if (access.account == address(_authority)) {
                ++authorityCalls;
                assertEq(access.data, authorityCalldata, "Authority exact calldata");
            } else if (access.account == address(_core)) {
                ++coreCalls;
                assertEq(access.data, coreCalldata, "Core exact calldata");
            } else {
                assertTrue(false, "unexpected BudgetBook external call");
            }
        }
        assertEq(authorityCalls, expectedAuthorityCalls, "Authority exact call count");
        assertEq(coreCalls, expectedCoreCalls, "Core exact call count");
    }

    function _assertAuthoritySemantic(uint256[27] memory words, uint8 ordinal) private {
        uint256 snapshot = vm.snapshotState();
        _authority.setWords(words);
        _assertAuthorizeRevert(
            _currentInput(1),
            _DETAILS,
            address(_safe),
            abi.encodeWithSelector(ITask4BudgetBook.BudgetBookAuthoritySnapshotSemanticMismatch.selector, ordinal)
        );
        assertTrue(vm.revertToState(snapshot), "Authority consistency restore");
    }

    function _budgetDigest(uint256 ballotDay) private view returns (bytes32) {
        bytes32 base = _recordBase(ballotDay);
        bytes32[10] memory words;
        words[0] = vm.load(address(_book), bytes32(0));
        words[1] = vm.load(address(_book), bytes32(uint256(1)));
        for (uint256 i; i < 8; ++i) {
            words[i + 2] = vm.load(address(_book), _offset(base, i));
        }
        return keccak256(abi.encode(address(_book).balance, words));
    }

    function _coreOracleDigest() private view returns (bytes32) {
        bytes32[12] memory words;
        for (uint256 i; i < words.length; ++i) {
            words[i] = vm.load(address(_core), bytes32(i));
        }
        return keccak256(abi.encode(address(_core).balance, address(_core).codehash, words));
    }

    function _authorityOracleDigest() private view returns (bytes32) {
        bytes32[28] memory words;
        for (uint256 i; i < words.length; ++i) {
            words[i] = vm.load(address(_authority), bytes32(i));
        }
        return keccak256(abi.encode(address(_authority).balance, address(_authority).codehash, words));
    }

    function _recordBase(uint256 ballotDay) private pure returns (bytes32) {
        return keccak256(abi.encode(ballotDay, uint256(1)));
    }

    function _offset(bytes32 base, uint256 amount) private pure returns (bytes32) {
        return bytes32(uint256(base) + amount);
    }

    function _deadline(uint256 ballotDay) private pure returns (uint64) {
        return uint64((ballotDay + 1) * 1 days + 2 hours);
    }

    function _artifactJson() private view returns (string memory) {
        return vm.readFile(vm.getArtifactPathByCode(type(PreVoteBudgetBook).creationCode));
    }

    function _abiEntryCount(string memory json) private view returns (uint256 count) {
        while (vm.keyExistsJson(json, _abiPath(count))) ++count;
    }

    function _abiKindCount(string memory json, string memory kind) private view returns (uint256 count) {
        for (uint256 i; vm.keyExistsJson(json, _abiPath(i)); ++i) {
            if (_same(vm.parseJsonString(json, string.concat(_abiPath(i), ".type")), kind)) ++count;
        }
    }

    function _findAbiEntry(string memory json, string memory kind, string memory name)
        private
        view
        returns (string memory path)
    {
        for (uint256 i; vm.keyExistsJson(json, _abiPath(i)); ++i) {
            path = _abiPath(i);
            if (!_same(vm.parseJsonString(json, string.concat(path, ".type")), kind)) continue;
            if (_same(kind, "constructor")) return path;
            if (_same(vm.parseJsonString(json, string.concat(path, ".name")), name)) return path;
        }
        return "";
    }

    function _assertAbiEntry(
        string memory json,
        string memory kind,
        string memory name,
        string memory inputTypes,
        string memory inputNames,
        string memory outputTypes,
        string memory outputNames,
        string memory stateMutability
    ) private view {
        string memory path = _findAbiEntry(json, kind, name);
        assertTrue(bytes(path).length != 0, string.concat(kind, " ABI entry missing: ", name));
        assertEq(_parameterTypes(json, path, "inputs"), inputTypes, string.concat(name, " input types"));
        assertEq(_parameterNames(json, path, "inputs"), inputNames, string.concat(name, " input names"));
        if (_same(kind, "function")) {
            assertEq(_parameterTypes(json, path, "outputs"), outputTypes, string.concat(name, " output types"));
            assertEq(_parameterNames(json, path, "outputs"), outputNames, string.concat(name, " output names"));
        }
        assertEq(
            vm.parseJsonString(json, string.concat(path, ".stateMutability")),
            stateMutability,
            string.concat(name, " mutability")
        );
    }

    function _assertErrorRow(string memory json, string memory expected) private view {
        bytes memory row = bytes(expected);
        uint256 open;
        uint256 close;
        uint256 divider;
        for (uint256 i; i < row.length; ++i) {
            if (row[i] == bytes1("(")) open = i;
            else if (row[i] == bytes1(")")) close = i;
            else if (row[i] == bytes1("|")) divider = i;
        }
        string memory name = _slice(row, 0, open);
        string memory expectedTypes = _slice(row, open + 1, close);
        string memory expectedNames = _slice(row, divider + 1, row.length);
        string memory path = _findAbiEntry(json, "error", name);
        assertTrue(bytes(path).length != 0, string.concat("error missing: ", name));
        assertEq(_parameterTypes(json, path, "inputs"), expectedTypes, string.concat(name, " types"));
        assertEq(_parameterNames(json, path, "inputs"), expectedNames, string.concat(name, " names"));
    }

    function _assertEvent(
        string memory json,
        string memory name,
        string memory types,
        string memory names,
        string memory indexedFlags,
        bool isAnonymous
    ) private view {
        string memory path = _findAbiEntry(json, "event", name);
        assertTrue(bytes(path).length != 0, string.concat("event missing: ", name));
        assertEq(_parameterTypes(json, path, "inputs"), types, string.concat(name, " types"));
        assertEq(_parameterNames(json, path, "inputs"), names, string.concat(name, " names"));
        assertEq(_indexedFlags(json, path), indexedFlags, string.concat(name, " indexed"));
        assertEq(
            vm.parseJsonBool(json, string.concat(path, ".anonymous")), isAnonymous, string.concat(name, " anonymous")
        );
    }

    function _parameterTypes(string memory json, string memory parent, string memory field)
        private
        view
        returns (string memory result)
    {
        for (uint256 i; vm.keyExistsJson(json, _parameterPath(parent, field, i)); ++i) {
            if (i != 0) result = string.concat(result, ",");
            result = string.concat(result, _parameterType(json, _parameterPath(parent, field, i)));
        }
    }

    function _parameterType(string memory json, string memory path) private view returns (string memory) {
        string memory rawType = vm.parseJsonString(json, string.concat(path, ".type"));
        if (!_same(rawType, "tuple")) return rawType;
        return string.concat("(", _parameterTypes(json, path, "components"), ")");
    }

    function _parameterNames(string memory json, string memory parent, string memory field)
        private
        view
        returns (string memory result)
    {
        for (uint256 i; vm.keyExistsJson(json, _parameterPath(parent, field, i)); ++i) {
            if (i != 0) result = string.concat(result, ",");
            string memory path = _parameterPath(parent, field, i);
            string memory name = vm.parseJsonString(json, string.concat(path, ".name"));
            string memory rawType = vm.parseJsonString(json, string.concat(path, ".type"));
            result = string.concat(result, name);
            if (_same(rawType, "tuple")) {
                result = string.concat(result, "(", _parameterNames(json, path, "components"), ")");
            }
        }
    }

    function _indexedFlags(string memory json, string memory parent) private view returns (string memory result) {
        for (uint256 i; vm.keyExistsJson(json, _parameterPath(parent, "inputs", i)); ++i) {
            if (i != 0) result = string.concat(result, ",");
            bool isIndexed = vm.parseJsonBool(json, string.concat(_parameterPath(parent, "inputs", i), ".indexed"));
            result = string.concat(result, isIndexed ? "1" : "0");
        }
    }

    function _assertStorageRow(
        string memory json,
        uint256 index,
        string memory label,
        string memory slot,
        uint256 offset,
        string memory typeLabel
    ) private view {
        string memory path = string.concat(".storageLayout.storage[", vm.toString(index), "]");
        assertEq(vm.parseJsonString(json, string.concat(path, ".label")), label, "storage label");
        assertEq(vm.parseJsonString(json, string.concat(path, ".slot")), slot, "storage slot");
        assertEq(vm.parseJsonUint(json, string.concat(path, ".offset")), offset, "storage offset");
        string memory typeId = vm.parseJsonString(json, string.concat(path, ".type"));
        string memory actual = vm.parseJsonString(json, string.concat(_storageTypePath(typeId), ".label"));
        if (_same(typeLabel, "mapping")) {
            assertTrue(_contains(bytes(actual), bytes("mapping(")), "storage mapping type");
            _assertStorageTypeMetadata(json, typeId, actual, "mapping", "32");
        } else {
            assertEq(actual, typeLabel, "storage type");
            _assertStorageTypeMetadata(json, typeId, typeLabel, "inplace", _same(typeLabel, "bool") ? "1" : "32");
        }
    }

    function _assertStorageTypeMetadata(
        string memory json,
        string memory typeId,
        string memory label,
        string memory encoding,
        string memory numberOfBytes
    ) private view {
        string memory path = _storageTypePath(typeId);
        assertEq(vm.parseJsonString(json, string.concat(path, ".label")), label, "storage type label");
        assertEq(vm.parseJsonString(json, string.concat(path, ".encoding")), encoding, "storage type encoding");
        assertEq(vm.parseJsonString(json, string.concat(path, ".numberOfBytes")), numberOfBytes, "storage type bytes");
    }

    function _storageTypePath(string memory typeId) private pure returns (string memory) {
        return string.concat(".storageLayout.types[\"", typeId, "\"]");
    }

    function _abiPath(uint256 index) private view returns (string memory) {
        return string.concat(".abi[", vm.toString(index), "]");
    }

    function _parameterPath(string memory parent, string memory field, uint256 index)
        private
        view
        returns (string memory)
    {
        return string.concat(parent, ".", field, "[", vm.toString(index), "]");
    }

    function _slice(bytes memory value, uint256 start, uint256 end) private pure returns (string memory) {
        bytes memory result = new bytes(end - start);
        for (uint256 i; i < result.length; ++i) {
            result[i] = value[start + i];
        }
        return string(result);
    }

    function _same(string memory left, string memory right) private pure returns (bool) {
        return keccak256(bytes(left)) == keccak256(bytes(right));
    }

    function _contains(bytes memory haystack, bytes memory needle) private pure returns (bool) {
        if (needle.length == 0 || needle.length > haystack.length) return false;
        for (uint256 i; i <= haystack.length - needle.length; ++i) {
            bool same = true;
            for (uint256 j; j < needle.length; ++j) {
                if (haystack[i + j] != needle[j]) {
                    same = false;
                    break;
                }
            }
            if (same) return true;
        }
        return false;
    }

    function _count(bytes memory haystack, bytes memory needle) private pure returns (uint256 count) {
        if (needle.length == 0 || needle.length > haystack.length) return 0;
        for (uint256 i; i <= haystack.length - needle.length; ++i) {
            bool same = true;
            for (uint256 j; j < needle.length; ++j) {
                if (haystack[i + j] != needle[j]) {
                    same = false;
                    break;
                }
            }
            if (same) ++count;
        }
    }

    function _indexOf(bytes memory haystack, bytes memory needle) private pure returns (uint256) {
        if (needle.length == 0 || needle.length > haystack.length) return type(uint256).max;
        for (uint256 i; i <= haystack.length - needle.length; ++i) {
            bool same = true;
            for (uint256 j; j < needle.length; ++j) {
                if (haystack[i + j] != needle[j]) {
                    same = false;
                    break;
                }
            }
            if (same) return i;
        }
        return type(uint256).max;
    }

    function _containsStandalonePrimitive(bytes memory value, bytes memory primitive) private pure returns (bool) {
        if (primitive.length > value.length) return false;
        for (uint256 i; i <= value.length - primitive.length; ++i) {
            bool same = true;
            for (uint256 j; j < primitive.length; ++j) {
                if (value[i + j] != primitive[j]) {
                    same = false;
                    break;
                }
            }
            if (!same) continue;
            if (i == 0 || !_isIdentifierByte(value[i - 1])) return true;
        }
        return false;
    }

    function _isIdentifierByte(bytes1 value) private pure returns (bool) {
        return (value >= 0x30 && value <= 0x39) || (value >= 0x61 && value <= 0x7a) || value == 0x5f;
    }

    function _assertStaticcallShape(
        bytes memory ir,
        string memory gasLimit,
        string memory outputLength,
        string memory label
    ) private pure {
        assertTrue(_hasStaticcallShape(ir, gasLimit, outputLength), string.concat(label, " fixed STATICCALL shape"));
    }

    function _hasStaticcallShape(bytes memory ir, string memory gasLimit, string memory outputLength)
        private
        pure
        returns (bool)
    {
        bytes memory prefix = bytes(string.concat("staticcall(", gasLimit, ","));
        if (_count(ir, prefix) != 1) return false;
        uint256 callIndex = _indexOf(ir, prefix);
        uint256 start = callIndex + bytes("staticcall").length;
        uint256[6] memory argumentStarts;
        uint256[6] memory argumentEnds;
        uint256 argument;
        uint256 depth = 1;
        bool closed;
        argumentStarts[0] = start + 1;
        for (uint256 i = start + 1; i < ir.length; ++i) {
            if (ir[i] == bytes1("(")) {
                ++depth;
            } else if (ir[i] == bytes1(")")) {
                --depth;
                if (depth == 0) {
                    argumentEnds[argument] = i;
                    closed = true;
                    break;
                }
            } else if (ir[i] == bytes1(",") && depth == 1) {
                argumentEnds[argument] = i;
                ++argument;
                if (argument >= 6) return false;
                argumentStarts[argument] = i + 1;
            }
        }
        if (!closed || argument != 5) return false;
        bytes memory gasArgument = bytes(_slice(ir, argumentStarts[0], argumentEnds[0]));
        bytes memory inputLength = bytes(_slice(ir, argumentStarts[3], argumentEnds[3]));
        bytes memory outputArgument = bytes(_slice(ir, argumentStarts[5], argumentEnds[5]));
        if (keccak256(gasArgument) != keccak256(bytes(gasLimit))) return false;
        if (keccak256(inputLength) != keccak256(bytes("4"))) return false;
        bool direct = keccak256(outputArgument) == keccak256(bytes(outputLength));
        bool bound = _lastLiteralAssignmentBefore(ir, outputArgument, bytes(outputLength), callIndex);
        return direct || bound;
    }

    function _lastLiteralAssignmentBefore(
        bytes memory ir,
        bytes memory variableName,
        bytes memory expectedLiteral,
        uint256 beforeIndex
    ) private pure returns (bool) {
        if (variableName.length == 0) return false;
        bytes memory assignment = bytes.concat(variableName, bytes(":="));
        if (assignment.length > beforeIndex) return false;
        uint256 last = type(uint256).max;
        for (uint256 i; i + assignment.length <= beforeIndex; ++i) {
            bool same = true;
            for (uint256 j; j < assignment.length; ++j) {
                if (ir[i + j] != assignment[j]) {
                    same = false;
                    break;
                }
            }
            if (same && (i == 0 || !_isIdentifierByte(ir[i - 1]))) last = i;
        }
        if (last == type(uint256).max) return false;
        uint256 literalStart = last + assignment.length;
        if (literalStart + expectedLiteral.length > beforeIndex) return false;
        for (uint256 i; i < expectedLiteral.length; ++i) {
            if (ir[literalStart + i] != expectedLiteral[i]) return false;
        }
        uint256 afterLiteral = literalStart + expectedLiteral.length;
        return afterLiteral >= beforeIndex || ir[afterLiteral] < 0x30 || ir[afterLiteral] > 0x39;
    }

    function _assertIrGateNegativeSelfTests() private pure {
        bytes memory mixedStatic = _compactIr(bytes("let ok := StAtIcCaLl (160000, target, 0, 4, out, 864)"));
        assertEq(_count(mixedStatic, bytes("staticcall(")), 0, "mixed STATICCALL not canonical");
        assertEq(_count(_lowerAscii(mixedStatic), bytes("staticcall(")), 1, "mixed STATICCALL detectable");

        bytes memory mixedCall = _lowerAscii(_compactIr(bytes("let ok := CaLl ( gas(), target, 0, 0, 0, 0 )")));
        assertTrue(_containsStandalonePrimitive(mixedCall, bytes("call(")), "spaced mixed CALL detected");
        bytes memory mixedCreate = _lowerAscii(_compactIr(bytes("let child := CrEaTe (0, code, size)")));
        assertTrue(_containsStandalonePrimitive(mixedCreate, bytes("create(")), "spaced mixed CREATE detected");

        bytes memory overwritten =
            _compactIr(bytes("let n := 352; n := 999; let ok := staticcall(100000, target, 0, 4, out, n)"));
        assertFalse(_hasStaticcallShape(overwritten, "100000", "352"), "overwritten output binding rejected");
        bytes memory suffixCollision =
            _compactIr(bytes("let n := 999; let len := 352; let ok := staticcall(100000, target, 0, 4, out, n)"));
        assertFalse(_hasStaticcallShape(suffixCollision, "100000", "352"), "identifier suffix collision rejected");
        bytes memory direct = _compactIr(bytes("let ok := staticcall(100000, target, 0, 4, out, 352)"));
        assertTrue(_hasStaticcallShape(direct, "100000", "352"), "direct output binding accepted");
    }

    function _compactIr(bytes memory value) private pure returns (bytes memory compacted) {
        compacted = new bytes(value.length);
        uint256 written;
        for (uint256 i; i < value.length;) {
            if (i + 1 < value.length && value[i] == 0x2f && value[i + 1] == 0x2f) {
                i += 2;
                while (i < value.length && value[i] != 0x0a && value[i] != 0x0d) ++i;
                continue;
            }
            if (i + 1 < value.length && value[i] == 0x2f && value[i + 1] == 0x2a) {
                i += 2;
                while (i + 1 < value.length && !(value[i] == 0x2a && value[i + 1] == 0x2f)) ++i;
                i = i + 1 < value.length ? i + 2 : value.length;
                continue;
            }
            bytes1 character = value[i++];
            if (character <= 0x20) continue;
            compacted[written++] = character;
        }
        assembly ("memory-safe") {
            mstore(compacted, written)
        }
    }

    function _lowerAscii(bytes memory value) private pure returns (bytes memory lowered) {
        lowered = new bytes(value.length);
        for (uint256 i; i < value.length; ++i) {
            bytes1 character = value[i];
            lowered[i] = character >= 0x41 && character <= 0x5a ? bytes1(uint8(character) + 32) : character;
        }
    }
}
