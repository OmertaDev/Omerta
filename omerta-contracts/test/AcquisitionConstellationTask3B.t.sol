// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, Vm, stdError} from "forge-std/Test.sol";

import {AcquisitionConstellationFactory} from "../src/AcquisitionConstellationFactory.sol";
import {AcquisitionAuthority} from "../src/AcquisitionAuthority.sol";
import {AcquisitionVaultCore} from "../src/AcquisitionVaultCore.sol";
import {PreVoteBudgetBook} from "../src/PreVoteBudgetBook.sol";
import {AcquisitionIntentExecution} from "../src/AcquisitionIntentExecution.sol";
import {AcquisitionReconciliation} from "../src/AcquisitionReconciliation.sol";
import {StockTokenRegistryV2} from "../src/StockTokenRegistryV2.sol";
import {IAcquisitionAuthorityV2} from "../src/interfaces/IAcquisitionAuthorityV2.sol";
import {IStockTokenRegistryV2} from "../src/interfaces/IStockTokenRegistryV2.sol";

/// @dev The frozen final Task-3 Core surface. Keeping this interface test-local lets the
/// Task-3B RED gate compile against the deliberately incomplete Task-3A checkpoint.
interface ITask3BFinalCore {
    struct AccountingTotals {
        uint256 availableWei;
        uint256 unattributedWei;
        uint256 ordinaryReservedWei;
        uint256 reconciliationLiabilityWei;
        uint256 reconciliationBackingWei;
        uint256 reconciliationShortfallWei;
        uint256 accountedBackingWei;
        uint256 actualBalanceWei;
        uint256 balanceDeficitWei;
        uint256 forcedSurplusWei;
        uint256 accountingSequence;
    }

    struct DepositRecord {
        bytes32 depositId;
        uint256 ingressGeneration;
        address ingress;
        bytes32 sourceEventId;
        uint256 amountWei;
        uint256 balanceDeficitRepairWei;
        uint256 availableCreditWei;
        uint256 epochDay;
        uint256 accountingSequence;
        uint64 depositedAt;
    }

    error CoreFactoryZero();
    error CoreManifestHashZero();
    error CoreFinalizerUnauthorized(address caller);
    error CoreManifestHashMismatch(bytes32 expected, bytes32 actual);
    error CoreAlreadyFinalized();
    error CoreNotFinalized();
    error CoreInitialStateMismatch(uint8 field);
    error CoreAddressMismatch(address expected, address actual);
    error CorePeerMismatch(uint8 index, address expected, address actual);
    error CoreAuthoritySnapshotCallFailed();
    error CoreAuthoritySnapshotReturnLength(uint256 actualLength);
    error CoreAuthoritySnapshotSemanticMismatch(uint8 field);
    error CoreIngressCallFailed(uint256 generation);
    error CoreIngressReturnLength(uint256 generation, uint256 actualLength);
    error CoreIngressSemanticMismatch(uint8 field);
    error InvalidGlobalLifetimeCap();
    error NoBalanceDelta();
    error InvalidAmount();
    error InsufficientUnattributed(uint256 availableWei, uint256 requestedWei);
    error BalanceDeficitActive(uint256 deficitWei);
    error ReconciliationShortfallActive(uint256 shortfallWei);
    error NotActiveIngress(address caller);
    error DepositSourceRequired();
    error DepositReplay(bytes32 depositId);
    error DepositCapExceeded(uint8 capKind, uint256 capWei, uint256 attemptedTotalWei);
    error DepositNotFound(bytes32 depositId);
    error CoreZeroAddress();
    error CoreContractRequired(address target);
    error CoreRoleIdentityCollision(address candidate);
    error CoreEmptyDetailsHash();
    error CoreCounterExhausted(bytes32 counterName);
    error CoreTimestampOverflow();
    error CoreNoActiveIngress();
    error CoreIngressCodeHashMismatch(address ingress, bytes32 expected, bytes32 actual);
    error CoreUnauthorized(address caller);
    error ReentrancyGuardReentrantCall();

    event CoreFinalized(bytes32 indexed manifestHash);
    event AccountingMutation(
        uint256 indexed accountingSequence,
        bytes32 indexed mutationId,
        uint8 indexed mutationKind,
        AccountingTotals preTotals,
        AccountingTotals postTotals,
        uint256 componentCount
    );
    event AccountingComponent(
        uint256 indexed accountingSequence,
        uint256 indexed componentIndex,
        bytes32 indexed componentId,
        uint8 componentKind,
        bytes32 componentSubjectId,
        uint256 amountWei
    );
    event UnattributedReclassified(
        bytes32 indexed mutationId,
        uint256 indexed accountingSequence,
        address indexed actor,
        uint256 amountWei,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event CanonicalDeposit(
        bytes32 indexed depositId,
        uint256 indexed ingressGeneration,
        bytes32 indexed sourceEventId,
        address ingress,
        uint256 amountWei,
        uint256 balanceDeficitRepairWei,
        uint256 availableCreditWei,
        uint256 epochDay,
        uint256 accountingSequence,
        uint64 depositedAt
    );

    function MAX_ACTIVE_ORDINARY_RESERVATIONS() external view returns (uint256);
    function MAX_ACTIVE_RECONCILIATIONS() external view returns (uint256);
    function MAX_OPERATOR_OUTFLOW_COMPONENTS() external view returns (uint256);
    function stockTokenRegistryV2() external view returns (address);
    function globalLifetimeCanonicalDepositCapWei() external view returns (uint256);
    function availableWei() external view returns (uint256);
    function unattributedWei() external view returns (uint256);
    function ordinaryReservedWei() external view returns (uint256);
    function reconciliationLiabilityWei() external view returns (uint256);
    function reconciliationBackingWei() external view returns (uint256);
    function accountingSequence() external view returns (uint256);
    function lastObservedBalanceDeficitWei() external view returns (uint256);
    function accountingTotals() external view returns (AccountingTotals memory totals);
    function syncBalance() external returns (bytes32 mutationId);
    function reclassifyUnattributed(uint256 amountWei, bytes32 detailsHash) external returns (bytes32 mutationId);
    function globalLifetimeCanonicalDepositedWei() external view returns (uint256);
    function ingressLifetimeDepositedWei(uint256 generation) external view returns (uint256);
    function ingressEpochDepositedWei(uint256 generation, uint256 epochDay) external view returns (uint256);
    function getDeposit(bytes32 depositId) external view returns (DepositRecord memory record);
    function depositCanonical(bytes32 sourceEventId) external payable returns (bytes32 depositId);
    function coreTopology() external view returns (address factory, bytes32 manifestHash, bool finalized);
    function coreSnapshot()
        external
        view
        returns (
            uint256 schemaVersion,
            address factory,
            bytes32 manifestHash,
            address authority,
            address registry,
            address budgetBook,
            address intentExecution,
            address reconciliation,
            bool finalized,
            uint256 globalLifetimeCanonicalDepositCapWei,
            uint256 availableWei_,
            uint256 unattributedWei_,
            uint256 ordinaryReservedWei_,
            uint256 reconciliationLiabilityWei_,
            uint256 reconciliationBackingWei_,
            uint256 accountingSequence_,
            uint256 lastObservedBalanceDeficitWei_,
            uint256 globalLifetimeCanonicalDepositedWei_
        );
    function finalizeCore(bytes32 manifestHash) external;
}

contract Task3BFactoryHarness {
    error CreateFailed();
    error FinalizeFailed(bytes data);

    function deploy(bytes memory initcode) external returns (address child) {
        assembly ("memory-safe") {
            child := create(0, add(initcode, 0x20), mload(initcode))
        }
        if (child == address(0)) revert CreateFailed();
    }

    function finalize(address core, bytes32 manifestHash) external {
        (bool ok, bytes memory data) = core.call(abi.encodeWithSignature("finalizeCore(bytes32)", manifestHash));
        if (!ok) revert FinalizeFailed(data);
    }
}

contract Task3BRawCreateDispatcher {
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

contract Task3BCodeStub {}

contract Task3BIngress {
    function deposit(address core, bytes32 sourceEventId) external payable returns (bytes32 depositId) {
        (bool ok, bytes memory data) =
            core.call{value: msg.value}(abi.encodeWithSignature("depositCanonical(bytes32)", sourceEventId));
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(data, 0x20), mload(data))
            }
        }
        return abi.decode(data, (bytes32));
    }
}

contract Task3BIngressV2 {
    uint256 private constant _RUNTIME_MARKER = 2;

    function deposit(address core, bytes32 sourceEventId) external payable returns (bytes32 depositId) {
        require(_RUNTIME_MARKER == 2);
        (bool ok, bytes memory data) =
            core.call{value: msg.value}(abi.encodeWithSignature("depositCanonical(bytes32)", sourceEventId));
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(data, 0x20), mload(data))
            }
        }
        return abi.decode(data, (bytes32));
    }
}

contract Task3BTestToken {
    event Transfer(address indexed from, address indexed to, uint256 amount);

    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;
    uint256 private _metadataSentinel = 1;

    function name() external view returns (string memory) {
        require(_metadataSentinel == 1);
        return "Task 3B Test Token";
    }

    function symbol() external view returns (string memory) {
        require(_metadataSentinel == 1);
        return "T3B";
    }

    function decimals() external view returns (uint8) {
        require(_metadataSentinel == 1);
        return 18;
    }

    function mint(address account, uint256 amount) external {
        totalSupply += amount;
        balanceOf[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(msg.sender, recipient, amount);
        return true;
    }

    fallback() external payable {
        require(_metadataSentinel == 1);
        revert("unexpected token call");
    }
}

/// @dev A raw, adversarial Authority oracle. Its two selectors return the exact fixed
/// buffers expected by Task 3B and can instead revert, OOG, or return malformed sizes.
contract Task3BAuthorityOracle {
    uint256[27] private _snapshot;
    uint256[8] private _ingress;
    uint8 private _snapshotMode;
    uint8 private _ingressMode;
    address private _callbackTarget;
    bytes private _callbackData;
    uint256 private _expectedSnapshotEntryGas;
    uint256 private _expectedIngressEntryGas;

    bytes4 private constant _REENTRANCY = bytes4(keccak256("ReentrancyGuardReentrantCall()"));

    function configureTopology(
        address factory,
        bytes32 manifestHash,
        address registry,
        address core,
        address budgetBook,
        address intentExecution,
        address reconciliation,
        address safe
    ) external {
        _snapshot[0] = 2;
        _snapshot[1] = uint160(factory);
        _snapshot[2] = uint256(manifestHash);
        _snapshot[3] = uint160(registry);
        _snapshot[4] = uint160(core);
        _snapshot[5] = uint160(budgetBook);
        _snapshot[6] = uint160(intentExecution);
        _snapshot[7] = uint160(reconciliation);
        _snapshot[8] = 1;
        _snapshot[9] = uint160(safe);
    }

    function configureRoles(
        address safe,
        address pendingSafe,
        bool paused,
        address operator,
        address pendingOperator,
        address pendingIngress
    ) external {
        _snapshot[9] = uint160(safe);
        _snapshot[10] = uint160(pendingSafe);
        _snapshot[11] = paused ? 1 : 0;
        _snapshot[12] = uint160(operator);
        _snapshot[13] = uint160(pendingOperator);
        _snapshot[21] = uint160(pendingIngress);
    }

    function configureIngress(
        uint256 generation,
        address ingress,
        bytes32 runtimeCodeHash,
        uint256 perDepositCapWei,
        uint256 epochCapWei,
        uint256 lifetimeCapWei,
        uint64 activatedAt,
        uint64 disabledAt,
        bytes32 configHash
    ) external {
        _snapshot[17] = generation;
        _snapshot[18] = generation;
        _snapshot[19] = uint160(ingress);
        _snapshot[20] = uint256(configHash);
        _ingress[0] = generation;
        _ingress[1] = uint160(ingress);
        _ingress[2] = uint256(runtimeCodeHash);
        _ingress[3] = perDepositCapWei;
        _ingress[4] = epochCapWei;
        _ingress[5] = lifetimeCapWei;
        _ingress[6] = activatedAt;
        _ingress[7] = disabledAt;
    }

    function disableIngress() external {
        _snapshot[18] = 0;
        _snapshot[19] = 0;
        _snapshot[20] = 0;
    }

    function setSnapshotWord(uint256 field, uint256 value) external {
        _snapshot[field] = value;
    }

    function setIngressWord(uint256 field, uint256 value) external {
        _ingress[field] = value;
    }

    function setModes(uint8 snapshotMode, uint8 ingressMode) external {
        _snapshotMode = snapshotMode;
        _ingressMode = ingressMode;
    }

    function setCallback(address target, bytes calldata data) external {
        _callbackTarget = target;
        _callbackData = data;
    }

    function setExpectedEntryGas(uint256 snapshotGas, uint256 ingressGas) external {
        _expectedSnapshotEntryGas = snapshotGas;
        _expectedIngressEntryGas = ingressGas;
    }

    function authoritySnapshot() external {
        require(msg.data.length == 4, "snapshot calldata length");
        uint256 entryGas = gasleft();
        _assertCallbackIsBlocked();
        uint8 mode = _snapshotMode;
        uint256[27] memory words = _snapshot;
        assembly ("memory-safe") {
            switch mode
            case 1 {
                mstore(0, 0xdecafbad)
                revert(0, 0x30000)
            }
            case 2 { return(words, 0x35f) }
            case 3 { return(words, 0x361) }
            case 4 { return(words, 0x30000) }
            case 5 { for {} 1 {} {} }
            case 6 {
                if iszero(eq(entryGas, sload(_expectedSnapshotEntryGas.slot))) { revert(0, 0) }
                return(words, 0x360)
            }
            case 7 {
                sstore(100, 1)
                return(words, 0x360)
            }
            case 8 {
                mstore(add(words, 0x1c0), entryGas)
                return(words, 0x360)
            }
            default { return(words, 0x360) }
        }
    }

    function getIngress(uint256 generation) external {
        require(msg.data.length == 36, "ingress calldata length");
        uint256 entryGas = gasleft();
        uint8 mode = _ingressMode;
        uint256[8] memory words = _ingress;
        require(generation == _snapshot[18], "ingress generation");
        assembly ("memory-safe") {
            switch mode
            case 1 {
                mstore(0, 0xdecafbad)
                revert(0, 0x28000)
            }
            case 2 { return(words, 0xff) }
            case 3 { return(words, 0x101) }
            case 4 { return(words, 0x28000) }
            case 5 { for {} 1 {} {} }
            case 6 {
                if iszero(eq(entryGas, sload(_expectedIngressEntryGas.slot))) { revert(0, 0) }
                return(words, 0x100)
            }
            case 7 {
                sstore(101, 1)
                return(words, 0x100)
            }
            case 8 {
                mstore(add(words, 0xe0), entryGas)
                return(words, 0x100)
            }
            default { return(words, 0x100) }
        }
    }

    function _assertCallbackIsBlocked() private view {
        address target = _callbackTarget;
        if (target == address(0)) return;
        (bool ok, bytes memory data) = target.staticcall(_callbackData);
        bytes4 selector;
        if (data.length >= 4) {
            assembly ("memory-safe") {
                selector := mload(add(data, 0x20))
            }
        }
        require(!ok && selector == _REENTRANCY, "callback escaped Core guard");
    }
}

contract AcquisitionConstellationTask3BTest is Test {
    uint256 private constant _CHAIN_ID = 4663;
    uint256 private constant _GLOBAL_CAP = 100 ether;
    uint256 private constant _EPOCH_DAY = 1 days;
    uint8 private constant _SYNC_BALANCE = 1;
    uint8 private constant _UNATTRIBUTED_RECLASSIFICATION = 2;
    uint8 private constant _CANONICAL_DEPOSIT = 3;
    uint8 private constant _FORCED_SURPLUS = 1;
    uint8 private constant _DEFICIT_OBSERVATION = 2;
    uint8 private constant _UNATTRIBUTED_TO_AVAILABLE = 3;
    uint8 private constant _DEPOSIT_REPAIR = 4;
    uint8 private constant _DEPOSIT_CREDIT = 5;
    uint8 private constant _PER_DEPOSIT_CAP = 1;
    uint8 private constant _EPOCH_CAP = 2;
    uint8 private constant _LIFETIME_CAP = 3;
    uint8 private constant _GLOBAL_CAP_KIND = 4;

    bytes32 private constant _MANIFEST = keccak256("task3b-red-manifest");
    bytes32 private constant _ACCOUNTING_MUTATION_TAG = keccak256("OMERTA_ACQUISITION_ACCOUNTING_MUTATION_V2");
    bytes32 private constant _ACCOUNTING_COMPONENT_TAG = keccak256("OMERTA_ACQUISITION_ACCOUNTING_COMPONENT_V2");
    bytes32 private constant _CANONICAL_DEPOSIT_TAG = keccak256("OMERTA_ACQUISITION_DEPOSIT_V2");
    bytes32 private constant _INGRESS_CONFIG_TAG = keccak256("OMERTA_AUTH_INGRESS_CONFIG_V2");
    bytes32 private constant _TASK3_CONFIG_TAG = keccak256("OMERTA_ACQUISITION_TASK3_CONFIG_V1");
    bytes32 private constant _CONSTELLATION_TAG = keccak256("OMERTA_ACQUISITION_CONSTELLATION_V1");
    bytes32 private constant _ACCOUNTING_SEQUENCE_COUNTER = keccak256("accountingSequence");
    bytes32 private constant _REENTRANCY_GUARD_STORAGE =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    bytes32 private constant _ACCOUNTING_MUTATION_TOPIC = keccak256(
        "AccountingMutation(uint256,bytes32,uint8,(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256),(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256),uint256)"
    );
    bytes32 private constant _ACCOUNTING_COMPONENT_TOPIC =
        keccak256("AccountingComponent(uint256,uint256,bytes32,uint8,bytes32,uint256)");
    bytes32 private constant _RECLASSIFIED_TOPIC =
        keccak256("UnattributedReclassified(bytes32,uint256,address,uint256,uint8,bytes32)");
    bytes32 private constant _CANONICAL_DEPOSIT_TOPIC =
        keccak256("CanonicalDeposit(bytes32,uint256,bytes32,address,uint256,uint256,uint256,uint256,uint256,uint64)");

    struct ProductionBundle {
        address predictedFactory;
        address[5] children;
        bytes32 configurationRoot;
        bytes32 manifest;
        bytes[5] initcodes;
        bytes32[5] initcodeHashes;
        bytes32[5] runtimeHashes;
    }

    struct ProductionFixture {
        AcquisitionConstellationFactory factory;
        AcquisitionAuthority authority;
        ITask3BFinalCore core;
        StockTokenRegistryV2 registry;
        address[5] children;
        bytes32 manifest;
    }

    Task3BFactoryHarness private _factory;
    Task3BAuthorityOracle private _authority;
    Task3BCodeStub private _registry;
    Task3BIngress private _ingress;
    ITask3BFinalCore private _core;
    address private _budgetBook;
    address private _intentExecution;
    address private _reconciliation;

    function setUp() public {
        vm.chainId(_CHAIN_ID);
        vm.warp(10 days + 123);
        vm.deal(address(this), 1_000 ether);

        _factory = new Task3BFactoryHarness();
        _registry = new Task3BCodeStub();
        address authorityAddress = _factory.deploy(type(Task3BAuthorityOracle).creationCode);
        _authority = Task3BAuthorityOracle(authorityAddress);

        address coreAddress = _predictCreateAddress(address(_factory), 2);
        _budgetBook = _predictCreateAddress(address(_factory), 3);
        _intentExecution = _predictCreateAddress(address(_factory), 4);
        _reconciliation = _predictCreateAddress(address(_factory), 5);
        bytes memory initcode = abi.encodePacked(
            type(AcquisitionVaultCore).creationCode,
            abi.encode(
                address(_factory),
                _MANIFEST,
                authorityAddress,
                address(_registry),
                _budgetBook,
                _intentExecution,
                _reconciliation,
                _GLOBAL_CAP
            )
        );
        assertEq(_factory.deploy(initcode), coreAddress, "Core CREATE nonce");
        _core = ITask3BFinalCore(coreAddress);

        _authority.configureTopology(
            address(_factory),
            _MANIFEST,
            address(_registry),
            coreAddress,
            _budgetBook,
            _intentExecution,
            _reconciliation,
            address(this)
        );
        _factory.finalize(coreAddress, _MANIFEST);

        _ingress = new Task3BIngress();
        _configureIngress(1, _ingress, 10 ether, 20 ether, 40 ether);
    }

    function test_task3B_01a_optimizedIrHasNoDynamicReturndataCopy() public {
        (bytes memory json,,) = _coreArtifactAbi();
        _assertOptimizedIrHasNoReturndataCopy(json);
    }

    function test_task3B_01b_exactFunctionAbiAndTupleNames() public {
        (bytes memory json, uint256 opening, uint256 closing) = _coreArtifactAbi();
        _assertAbiKindRows(json, opening, closing, "function", _expectedFunctionRows());
        _assertAbiNameKindRows(json, opening, closing, "function", _expectedFunctionNameRows());
        _assertDeepFunctionAbiNames(json, opening, closing);
    }

    function test_task3B_01c_exactErrorAbiAndNames() public {
        (bytes memory json, uint256 opening, uint256 closing) = _coreArtifactAbi();
        _assertAbiKindRows(json, opening, closing, "error", _expectedErrorRows());
        _assertAbiNameKindRows(json, opening, closing, "error", _expectedErrorNameRows());
    }

    function test_task3B_01d_exactEventAbiIndexingAndNames() public {
        (bytes memory json, uint256 opening, uint256 closing) = _coreArtifactAbi();
        _assertAbiKindRows(json, opening, closing, "event", _expectedEventRows());
        _assertAbiNameKindRows(json, opening, closing, "event", _expectedEventNameRows());
    }

    function test_task3B_01e_exactConstructorAbiAndNames() public {
        (bytes memory json, uint256 opening, uint256 closing) = _coreArtifactAbi();
        string[] memory constructorRows = new string[](1);
        constructorRows[0] = "constructor(address,bytes32,address,address,address,address,address,uint256)|nonpayable";
        _assertAbiKindRows(json, opening, closing, "constructor", constructorRows);
        string[] memory constructorNameRows = new string[](1);
        constructorNameRows[0] =
            "constructor(factory,manifestHash,authority,registry,budgetBook,intentExecution,reconciliation,globalLifetimeCanonicalDepositCapWei)|";
        _assertAbiNameKindRows(json, opening, closing, "constructor", constructorNameRows);
        _assertDeepConstructorAbiNames(json, opening, closing);
    }

    function test_task3B_01f_runtimeConstantsRegistryAndForbiddenSurface() public {
        assertEq(_core.MAX_ACTIVE_ORDINARY_RESERVATIONS(), 32, "ordinary reservation limit");
        assertEq(_core.MAX_ACTIVE_RECONCILIATIONS(), 32, "reconciliation limit");
        assertEq(_core.MAX_OPERATOR_OUTFLOW_COMPONENTS(), 67, "O2 component limit");
        assertEq(_core.stockTokenRegistryV2(), address(_registry), "Registry binding");
        assertEq(_core.globalLifetimeCanonicalDepositCapWei(), _GLOBAL_CAP, "global cap binding");

        bytes[7] memory forbidden = [
            abi.encodeWithSignature("syncStockToken(address)", address(_registry)),
            abi.encodeWithSignature("recordStockFill(bytes32,uint256)", keccak256("attempt"), uint256(7)),
            abi.encodeWithSignature("transfer(address,uint256)", address(0xBEEF), uint256(7)),
            abi.encodeWithSignature("approve(address,uint256)", address(0xBEEF), uint256(7)),
            abi.encodeWithSignature(
                "sweepToken(address,address,uint256)", address(_registry), address(0xBEEF), uint256(7)
            ),
            abi.encodeWithSignature("recoverToken(address,uint256)", address(_registry), uint256(7)),
            abi.encodeWithSignature(
                "allocateStock(bytes32,address,uint256)", keccak256("allocation"), address(0xBEEF), uint256(7)
            )
        ];
        for (uint256 i; i < forbidden.length; ++i) {
            (bool ok,) = address(_core).call(forbidden[i]);
            assertFalse(ok, "forbidden descriptor accepted valid calldata");
            (ok,) = address(_core).call{value: 1}(forbidden[i]);
            assertFalse(ok, "forbidden descriptor accepted value");
        }
        (bool receiveOk,) = address(_core).call{value: 1}("");
        assertFalse(receiveOk, "receive surface leaked");
        (bool fallbackOk,) = address(_core).call{value: 1}(hex"deadbeef");
        assertFalse(fallbackOk, "fallback surface leaked");
    }

    function test_task3B_02_exactLinearStorageAndMappingRootsNineThroughEleven() public {
        string memory artifactPath = vm.getArtifactPathByCode(type(AcquisitionVaultCore).creationCode);
        _assertExactCoreStorageLayout(bytes(vm.readFile(artifactPath)));

        assertEq(uint256(vm.load(address(_core), bytes32(uint256(0)))) & 0xff, 1, "finalized slot");
        for (uint256 slot = 1; slot <= 8; ++slot) {
            assertEq(vm.load(address(_core), bytes32(slot)), bytes32(0), "linear zero slot");
        }

        uint256 generation = 77;
        uint256 epochDay = 88;
        bytes32 ingressLifetimeSlot = keccak256(abi.encode(generation, uint256(9)));
        bytes32 ingressEpochOuter = keccak256(abi.encode(generation, uint256(10)));
        bytes32 ingressEpochSlot = keccak256(abi.encode(epochDay, ingressEpochOuter));
        bytes32 depositId = keccak256("root-11-record");
        bytes32 base = keccak256(abi.encode(depositId, uint256(11)));
        assertEq(vm.load(address(_core), bytes32(uint256(9))), bytes32(0), "raw root 9 zero");
        assertEq(vm.load(address(_core), bytes32(uint256(10))), bytes32(0), "raw root 10 zero");
        assertEq(vm.load(address(_core), bytes32(uint256(11))), bytes32(0), "raw root 11 zero");
        assertEq(vm.load(address(_core), ingressLifetimeSlot), bytes32(0), "root 9 leaf zero pre-use");
        assertEq(vm.load(address(_core), ingressEpochSlot), bytes32(0), "root 10 leaf zero pre-use");
        for (uint256 i; i < 10; ++i) {
            assertEq(vm.load(address(_core), _offset(base, i)), bytes32(0), "root 11 record zero pre-use");
        }
        vm.store(address(_core), ingressLifetimeSlot, bytes32(uint256(111)));
        vm.store(address(_core), ingressEpochSlot, bytes32(uint256(222)));
        assertEq(_core.ingressLifetimeDepositedWei(generation), 111, "root 9");
        assertEq(_core.ingressEpochDepositedWei(generation, epochDay), 222, "root 10");

        bytes32 source = keccak256("root-11-source");
        vm.store(address(_core), base, depositId);
        vm.store(address(_core), _offset(base, 1), bytes32(generation));
        vm.store(address(_core), _offset(base, 2), bytes32(uint256(uint160(address(_ingress)))));
        vm.store(address(_core), _offset(base, 3), source);
        vm.store(address(_core), _offset(base, 4), bytes32(uint256(3 ether)));
        vm.store(address(_core), _offset(base, 5), bytes32(uint256(1 ether)));
        vm.store(address(_core), _offset(base, 6), bytes32(uint256(2 ether)));
        vm.store(address(_core), _offset(base, 7), bytes32(epochDay));
        vm.store(address(_core), _offset(base, 8), bytes32(uint256(9)));
        vm.store(address(_core), _offset(base, 9), bytes32(uint256(type(uint64).max)));
        ITask3BFinalCore.DepositRecord memory record = _core.getDeposit(depositId);
        assertEq(record.depositId, depositId, "record discriminator");
        assertEq(record.ingressGeneration, generation, "record generation");
        assertEq(record.ingress, address(_ingress), "record ingress");
        assertEq(record.sourceEventId, source, "record source");
        assertEq(record.amountWei, 3 ether, "record amount");
        assertEq(record.balanceDeficitRepairWei, 1 ether, "record repair");
        assertEq(record.availableCreditWei, 2 ether, "record credit");
        assertEq(record.epochDay, epochDay, "record day");
        assertEq(record.accountingSequence, 9, "record sequence");
        assertEq(record.depositedAt, type(uint64).max, "record timestamp");
    }

    function test_task3B_03_finalizedStatePrecedesOneSharedReentrancyGuardForAllMutators() public {
        bytes[3] memory calls = [
            abi.encodeCall(ITask3BFinalCore.syncBalance, ()),
            abi.encodeCall(ITask3BFinalCore.reclassifyUnattributed, (1, keccak256("details"))),
            abi.encodeCall(ITask3BFinalCore.depositCanonical, (keccak256("source")))
        ];

        vm.store(address(_core), bytes32(uint256(0)), bytes32(0));
        vm.store(address(_core), _REENTRANCY_GUARD_STORAGE, bytes32(uint256(2)));
        for (uint256 i; i < calls.length; ++i) {
            uint256 value = i == 2 ? 1 ether : 0;
            bytes32 digest = _stateDigest(bytes32(0));
            uint256 callerBalance = address(this).balance;
            vm.recordLogs();
            _assertRawRevert(calls[i], abi.encodeWithSelector(ITask3BFinalCore.CoreNotFinalized.selector), value);
            assertEq(_stateDigest(bytes32(0)), digest, "pre-final state rollback");
            assertEq(address(this).balance, callerBalance, "pre-final value refund");
            assertEq(vm.getRecordedLogs().length, 0, "pre-final log rollback");
        }

        vm.store(address(_core), bytes32(uint256(0)), bytes32(uint256(1)));
        for (uint256 i; i < calls.length; ++i) {
            _assertRawRevert(
                calls[i], abi.encodeWithSelector(ITask3BFinalCore.ReentrancyGuardReentrantCall.selector), 0
            );
        }
        vm.store(address(_core), _REENTRANCY_GUARD_STORAGE, bytes32(uint256(1)));

        vm.deal(address(_core), 3 ether);
        _core.syncBalance();
        bytes[3] memory callbacks = [
            abi.encodeCall(ITask3BFinalCore.syncBalance, ()),
            abi.encodeCall(ITask3BFinalCore.reclassifyUnattributed, (1, keccak256("inner"))),
            abi.encodeCall(ITask3BFinalCore.depositCanonical, (keccak256("inner-source")))
        ];
        for (uint256 i; i < callbacks.length; ++i) {
            uint256 snapshot = vm.snapshotState();
            _authority.setCallback(address(_core), callbacks[i]);
            _core.reclassifyUnattributed(1, keccak256(abi.encode("outer", i)));
            assertEq(_core.availableWei(), 1, "outer mutation survived blocked callback");
            assertTrue(vm.revertToState(snapshot), "callback snapshot restore");
        }
    }

    function test_task3B_04_syncExactEquationsV2IdsComponentsAndDeficitProgression() public {
        vm.deal(address(_core), 10 ether);
        ITask3BFinalCore.AccountingTotals memory pre = _zeroTotals(10 ether);
        ITask3BFinalCore.AccountingTotals memory post = _zeroTotals(10 ether);
        post.unattributedWei = 10 ether;
        post.accountedBackingWei = 10 ether;
        post.forcedSurplusWei = 0;
        post.accountingSequence = 1;
        bytes32 subject = keccak256(abi.encode(pre, post));
        bytes32 expectedMutation = _mutationId(0, 1, _SYNC_BALANCE, subject);
        bytes32 expectedComponent = _componentId(0, 1, expectedMutation, 0, _FORCED_SURPLUS, subject, 10 ether);

        vm.recordLogs();
        assertEq(_core.syncBalance(), expectedMutation, "sync mutation ID");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 2, "surplus event count");
        _assertMutationLog(logs[0], 1, expectedMutation, _SYNC_BALANCE, pre, post, 1);
        _assertComponentLog(logs[1], 1, 0, expectedComponent, _FORCED_SURPLUS, subject, 10 ether);
        _assertTotals(_core.accountingTotals(), post);
        assertEq(_core.lastObservedBalanceDeficitWei(), 0, "initial observation");
        assertEq(_core.globalLifetimeCanonicalDepositedWei(), 0, "forced ETH does not consume global cap");
        assertEq(_core.ingressLifetimeDepositedWei(1), 0, "forced ETH does not consume generation cap");
        assertEq(
            _core.ingressEpochDepositedWei(1, block.timestamp / _EPOCH_DAY), 0, "forced ETH does not consume epoch cap"
        );

        vm.deal(address(_core), 7 ether);
        ITask3BFinalCore.AccountingTotals memory deficitPre = _totals(0, 10 ether, 0, 0, 0, 7 ether, 1);
        ITask3BFinalCore.AccountingTotals memory deficitPost = _totals(0, 10 ether, 0, 0, 0, 7 ether, 2);
        bytes32 deficitSubject = keccak256(abi.encode(deficitPre, deficitPost));
        bytes32 expectedDeficitMutation = _mutationId(0, 2, _SYNC_BALANCE, deficitSubject);
        bytes32 expectedDeficitComponent =
            _componentId(0, 2, expectedDeficitMutation, 0, _DEFICIT_OBSERVATION, deficitSubject, 3 ether);
        vm.recordLogs();
        bytes32 deficitMutation = _core.syncBalance();
        assertEq(deficitMutation, expectedDeficitMutation, "deficit mutation ID");
        logs = vm.getRecordedLogs();
        assertEq(logs.length, 2, "deficit observation event count");
        _assertMutationLog(logs[0], 2, expectedDeficitMutation, _SYNC_BALANCE, deficitPre, deficitPost, 1);
        _assertComponentLog(logs[1], 2, 0, expectedDeficitComponent, _DEFICIT_OBSERVATION, deficitSubject, 3 ether);
        assertEq(_core.lastObservedBalanceDeficitWei(), 3 ether, "deficit observed");
        assertEq(_core.unattributedWei(), 10 ether, "deficit never rewrites bucket");

        vm.deal(address(_core), 10 ether);
        ITask3BFinalCore.AccountingTotals memory clearPre = _totals(0, 10 ether, 0, 0, 0, 10 ether, 2);
        ITask3BFinalCore.AccountingTotals memory clearPost = _totals(0, 10 ether, 0, 0, 0, 10 ether, 3);
        bytes32 clearSubject = keccak256(abi.encode(clearPre, clearPost));
        bytes32 clearMutation = _mutationId(0, 3, _SYNC_BALANCE, clearSubject);
        bytes32 clearComponent = _componentId(0, 3, clearMutation, 0, _DEFICIT_OBSERVATION, clearSubject, 0);
        vm.recordLogs();
        assertEq(_core.syncBalance(), clearMutation, "clearing mutation ID");
        logs = vm.getRecordedLogs();
        assertEq(logs.length, 2, "clearing event count");
        _assertMutationLog(logs[0], 3, clearMutation, _SYNC_BALANCE, clearPre, clearPost, 1);
        _assertComponentLog(logs[1], 3, 0, clearComponent, _DEFICIT_OBSERVATION, clearSubject, 0);
        assertEq(_core.lastObservedBalanceDeficitWei(), 0, "deficit clearing observed");
        vm.expectRevert(ITask3BFinalCore.NoBalanceDelta.selector);
        _core.syncBalance();
    }

    function test_task3B_05_reclassificationLiveSafeGatesEquationsAndExactEvidence() public {
        vm.deal(address(_core), 10 ether);
        _core.syncBalance();
        bytes32 details = keccak256("reclassification-details");
        bytes32 expectedMutation = _mutationId(0, 2, _UNATTRIBUTED_RECLASSIFICATION, details);
        bytes32 expectedComponent =
            _componentId(0, 2, expectedMutation, 0, _UNATTRIBUTED_TO_AVAILABLE, details, 4 ether);
        ITask3BFinalCore.AccountingTotals memory reclassPre = _totals(0, 10 ether, 0, 0, 0, 10 ether, 1);
        ITask3BFinalCore.AccountingTotals memory reclassPost = _totals(4 ether, 6 ether, 0, 0, 0, 10 ether, 2);
        vm.recordLogs();
        assertEq(_core.reclassifyUnattributed(4 ether, details), expectedMutation, "reclassification ID");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 3, "reclassification event count");
        _assertMutationLog(logs[0], 2, expectedMutation, _UNATTRIBUTED_RECLASSIFICATION, reclassPre, reclassPost, 1);
        _assertComponentLog(logs[1], 2, 0, expectedComponent, _UNATTRIBUTED_TO_AVAILABLE, details, 4 ether);
        assertEq(logs[2].emitter, address(_core), "terminal emitter");
        assertEq(logs[2].topics.length, 4, "terminal topic arity");
        assertEq(logs[2].topics[0], _RECLASSIFIED_TOPIC, "terminal event last");
        assertEq(logs[2].topics[1], expectedMutation, "terminal mutation ID");
        assertEq(logs[2].topics[2], bytes32(uint256(2)), "terminal sequence");
        assertEq(logs[2].topics[3], bytes32(uint256(uint160(address(this)))), "terminal actor");
        (uint256 amount, uint8 reason, bytes32 emittedDetails) = abi.decode(logs[2].data, (uint256, uint8, bytes32));
        assertEq(amount, 4 ether, "terminal amount");
        assertEq(reason, 18, "reclassification reason");
        assertEq(emittedDetails, details, "terminal details");
        assertEq(_core.availableWei(), 4 ether, "available credit");
        assertEq(_core.unattributedWei(), 6 ether, "unattributed debit");

        vm.prank(address(0xBEEF));
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.CoreUnauthorized.selector, address(0xBEEF)));
        _core.reclassifyUnattributed(1, details);
        vm.expectRevert(ITask3BFinalCore.CoreEmptyDetailsHash.selector);
        _core.reclassifyUnattributed(1, bytes32(0));
        vm.expectRevert(ITask3BFinalCore.InvalidAmount.selector);
        _core.reclassifyUnattributed(0, details);
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.InsufficientUnattributed.selector, 6 ether, 7 ether));
        _core.reclassifyUnattributed(7 ether, details);

        _authority.configureRoles(address(0xCAFE), address(this), false, address(0), address(0), address(0));
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.CoreUnauthorized.selector, address(this)));
        _core.reclassifyUnattributed(1, details);
        vm.prank(address(0xCAFE));
        _core.reclassifyUnattributed(1, details);
        assertEq(_core.availableWei(), 4 ether + 1, "new Safe immediately authoritative");
    }

    function test_task3B_06_reclassificationDeficitShortfallAndSequenceGatesAreAtomic() public {
        vm.deal(address(_core), 10 ether);
        _core.syncBalance();
        bytes32 details = keccak256("gate-details");

        vm.deal(address(_core), 9 ether);
        bytes32 digest = _stateDigest(bytes32(0));
        vm.recordLogs();
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.BalanceDeficitActive.selector, 1 ether));
        _core.reclassifyUnattributed(1, details);
        assertEq(_stateDigest(bytes32(0)), digest, "deficit rollback");
        assertEq(vm.getRecordedLogs().length, 0, "deficit log rollback");

        vm.store(address(_core), bytes32(uint256(4)), bytes32(uint256(2 ether)));
        vm.store(address(_core), bytes32(uint256(5)), bytes32(uint256(1 ether)));
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.BalanceDeficitActive.selector, 2 ether));
        _core.reclassifyUnattributed(1, details);

        vm.deal(address(_core), 11 ether);
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.ReconciliationShortfallActive.selector, 1 ether));
        _core.reclassifyUnattributed(1, details);

        vm.store(address(_core), bytes32(uint256(4)), bytes32(0));
        vm.store(address(_core), bytes32(uint256(5)), bytes32(0));
        vm.store(address(_core), bytes32(uint256(6)), bytes32(type(uint256).max));
        digest = _stateDigest(bytes32(0));
        vm.expectRevert(
            abi.encodeWithSelector(ITask3BFinalCore.CoreCounterExhausted.selector, _ACCOUNTING_SEQUENCE_COUNTER)
        );
        _core.reclassifyUnattributed(1, details);
        assertEq(_stateDigest(bytes32(0)), digest, "sequence rollback");
    }

    function test_task3B_07_authoritySnapshotBoundedFailuresSemanticsAndAtomicity() public {
        bytes memory callData = abi.encodeCall(ITask3BFinalCore.reclassifyUnattributed, (1, keccak256("snapshot-gate")));
        uint8[5] memory modes = [uint8(1), 2, 3, 4, 5];
        uint256[5] memory lengths = [uint256(0), 863, 865, 196_608, 0];
        for (uint256 i; i < modes.length; ++i) {
            _authority.setModes(modes[i], 0);
            bytes memory expected = modes[i] == 1 || modes[i] == 5
                ? abi.encodeWithSelector(ITask3BFinalCore.CoreAuthoritySnapshotCallFailed.selector)
                : abi.encodeWithSelector(ITask3BFinalCore.CoreAuthoritySnapshotReturnLength.selector, lengths[i]);
            bytes32 digest = _stateDigest(bytes32(0));
            vm.recordLogs();
            _assertRawRevert(callData, expected, 0);
            assertEq(_stateDigest(bytes32(0)), digest, "Authority read rollback");
            assertEq(vm.getRecordedLogs().length, 0, "Authority read log rollback");
        }
        _authority.setModes(0, 0);

        for (uint256 i; i < modes.length; ++i) {
            _authority.setModes(modes[i], 0);
            bytes memory expected = modes[i] == 1 || modes[i] == 5
                ? abi.encodeWithSelector(ITask3BFinalCore.CoreAuthoritySnapshotCallFailed.selector)
                : abi.encodeWithSelector(ITask3BFinalCore.CoreAuthoritySnapshotReturnLength.selector, lengths[i]);
            _assertDepositRevert(address(_ingress), keccak256(abi.encode("snapshot-deposit", i)), 1, expected);
        }
        _authority.setModes(0, 0);

        _authority.setModes(7, 0);
        _assertRawRevert(callData, abi.encodeWithSelector(ITask3BFinalCore.CoreAuthoritySnapshotCallFailed.selector), 0);
        _authority.setModes(0, 0);

        for (uint8 field; field <= 8; ++field) {
            uint256 snapshot = vm.snapshotState();
            _authority.setSnapshotWord(field, field == 0 ? 3 : 0);
            _assertSnapshotSemanticBoth(callData, field);
            assertTrue(vm.revertToState(snapshot), "identity semantic restore");
        }

        uint8[6] memory addressFields = [uint8(9), 10, 12, 13, 19, 21];
        for (uint256 i; i < addressFields.length; ++i) {
            uint256 snapshot = vm.snapshotState();
            uint8 field = addressFields[i];
            uint256 low = field == 9 ? uint160(address(this)) : field == 19 ? uint160(address(_ingress)) : uint256(0);
            _authority.setSnapshotWord(field, low | (uint256(1) << 200));
            _assertSnapshotSemanticBoth(callData, field);
            assertTrue(vm.revertToState(snapshot), "address padding restore");
        }

        _authority.setSnapshotWord(11, 2);
        _assertSnapshotSemanticBoth(callData, 11);
        _authority.setSnapshotWord(11, 0);

        uint256 safeSnapshot = vm.snapshotState();
        _authority.setSnapshotWord(9, 0);
        _assertSnapshotSemanticBoth(callData, 9);
        assertTrue(vm.revertToState(safeSnapshot), "zero Safe restore");

        uint256 consistencySnapshot = vm.snapshotState();
        _authority.setSnapshotWord(18, 0);
        _assertSnapshotSemanticBoth(callData, 19);
        assertTrue(vm.revertToState(consistencySnapshot), "active consistency restore");
        consistencySnapshot = vm.snapshotState();
        _authority.setSnapshotWord(19, 0);
        _assertSnapshotSemanticBoth(callData, 19);
        assertTrue(vm.revertToState(consistencySnapshot), "active ingress restore");
        consistencySnapshot = vm.snapshotState();
        _authority.setSnapshotWord(18, 0);
        _authority.setSnapshotWord(19, 0);
        _assertSnapshotSemanticBoth(callData, 20);
        assertTrue(vm.revertToState(consistencySnapshot), "inactive nonzero config restore");
        consistencySnapshot = vm.snapshotState();
        _authority.setSnapshotWord(20, 0);
        _assertSnapshotSemanticBoth(callData, 20);
        assertTrue(vm.revertToState(consistencySnapshot), "active zero config restore");

        uint256 arbitrarySnapshot = vm.snapshotState();
        _authority.setSnapshotWord(11, 1);
        _authority.setSnapshotWord(14, type(uint256).max);
        _authority.setSnapshotWord(15, 0xA11CE);
        _authority.setSnapshotWord(16, 0xB0B);
        _authority.setSnapshotWord(17, 0xCAFE);
        _assertRawRevert(
            callData,
            abi.encodeWithSelector(ITask3BFinalCore.InsufficientUnattributed.selector, uint256(0), uint256(1)),
            0
        );
        assertTrue(vm.revertToState(arbitrarySnapshot), "arbitrary snapshot fields restore");

        _calibrateOracleGas();
        _authority.setModes(6, 0);
        vm.expectCall(
            address(_authority), 0, uint64(160_000), abi.encodeWithSignature("authoritySnapshot()"), uint64(1)
        );
        _assertRawRevert(
            callData,
            abi.encodeWithSelector(ITask3BFinalCore.InsufficientUnattributed.selector, uint256(0), uint256(1)),
            0
        );
    }

    function test_task3B_07a_activeIngressConsistencyPrecedesDirtyPendingIngress() public {
        bytes memory callData =
            abi.encodeCall(ITask3BFinalCore.reclassifyUnattributed, (1, keccak256("field-19-order")));
        uint256 snapshot = vm.snapshotState();
        _authority.setSnapshotWord(19, 0);
        _authority.setSnapshotWord(21, uint256(1) << 200);
        _assertSnapshotSemanticBoth(callData, 19);
        assertTrue(vm.revertToState(snapshot), "active ingress before dirty pending ingress restore");
    }

    function test_task3B_07b_activeConfigConsistencyPrecedesDirtyPendingIngress() public {
        bytes memory callData =
            abi.encodeCall(ITask3BFinalCore.reclassifyUnattributed, (1, keccak256("field-20-order")));
        uint256 snapshot = vm.snapshotState();
        _authority.setSnapshotWord(20, 0);
        _authority.setSnapshotWord(21, uint256(1) << 200);
        _assertSnapshotSemanticBoth(callData, 20);
        assertTrue(vm.revertToState(snapshot), "active config before dirty pending ingress restore");
    }

    function test_task3B_08_ingressReadBoundedFailuresEverySemanticOrdinalAndAtomicity() public {
        bytes32 source = keccak256("ingress-read-source");
        uint8[5] memory modes = [uint8(1), 2, 3, 4, 5];
        uint256[5] memory lengths = [uint256(0), 255, 257, 163_840, 0];
        for (uint256 i; i < modes.length; ++i) {
            _authority.setModes(0, modes[i]);
            bytes memory expected = modes[i] == 1 || modes[i] == 5
                ? abi.encodeWithSelector(ITask3BFinalCore.CoreIngressCallFailed.selector, uint256(1))
                : abi.encodeWithSelector(ITask3BFinalCore.CoreIngressReturnLength.selector, uint256(1), lengths[i]);
            bytes32 digest = _stateDigest(bytes32(0));
            uint256 callerBalance = address(this).balance;
            vm.recordLogs();
            vm.expectRevert(expected);
            _ingress.deposit{value: 1}(address(_core), source);
            assertEq(_stateDigest(bytes32(0)), digest, "ingress read rollback");
            assertEq(address(this).balance, callerBalance, "value refunded");
            assertEq(vm.getRecordedLogs().length, 0, "ingress read log rollback");
        }
        _authority.setModes(0, 0);

        _authority.setModes(0, 7);
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.CoreIngressCallFailed.selector, uint256(1)));
        _ingress.deposit{value: 1}(address(_core), keccak256("static-ingress-read"));
        _authority.setModes(0, 0);

        uint256 validConfig = uint256(_configHash(_ingress, 10 ether, 20 ether, 40 ether));
        uint256[9] memory badValues;
        badValues[0] = 2;
        badValues[1] = uint160(address(0x1234));
        badValues[2] = 0;
        badValues[3] = 0;
        badValues[4] = 9 ether;
        badValues[5] = _GLOBAL_CAP + 1;
        badValues[6] = uint256(1) << 64;
        badValues[7] = 1;
        badValues[8] = validConfig == 1 ? 2 : 1;
        for (uint8 field; field < 9; ++field) {
            uint256 snapshot = vm.snapshotState();
            if (field < 8) {
                _authority.setIngressWord(field, badValues[field]);
            } else {
                _authority.setSnapshotWord(20, badValues[field]);
            }
            vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.CoreIngressSemanticMismatch.selector, field));
            _ingress.deposit{value: 1}(address(_core), keccak256(abi.encode(source, field)));
            assertTrue(vm.revertToState(snapshot), "semantic restore");
        }
        uint256 dirtyIngressSnapshot = vm.snapshotState();
        _authority.setIngressWord(1, uint160(address(_ingress)) | (uint256(1) << 200));
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.CoreIngressSemanticMismatch.selector, uint8(1)));
        _ingress.deposit{value: 1}(address(_core), keccak256("dirty-ingress-address"));
        assertTrue(vm.revertToState(dirtyIngressSnapshot), "dirty ingress address restore");

        uint256 lifetimeOrderSnapshot = vm.snapshotState();
        _authority.setIngressWord(5, 20 ether - 1);
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.CoreIngressSemanticMismatch.selector, uint8(5)));
        _ingress.deposit{value: 1}(address(_core), keccak256("lifetime-below-epoch"));
        assertTrue(vm.revertToState(lifetimeOrderSnapshot), "lifetime order restore");

        uint256 dirtyDisabledSnapshot = vm.snapshotState();
        _authority.setIngressWord(7, uint256(1) << 64);
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.CoreIngressSemanticMismatch.selector, uint8(7)));
        _ingress.deposit{value: 1}(address(_core), keccak256("dirty-disabled-at"));
        assertTrue(vm.revertToState(dirtyDisabledSnapshot), "dirty disabledAt restore");

        _calibrateOracleGas();
        _authority.setModes(0, 6);
        vm.expectCall(
            address(_authority), 0, uint64(160_000), abi.encodeWithSignature("authoritySnapshot()"), uint64(1)
        );
        vm.expectCall(
            address(_authority),
            0,
            uint64(100_000),
            abi.encodeWithSignature("getIngress(uint256)", uint256(1)),
            uint64(1)
        );
        _ingress.deposit{value: 1}(address(_core), keccak256("bounded-ingress-gas"));
    }

    function test_task3B_09_depositAuthorizationConfigCodeAndLocalPrecedence() public {
        bytes32 source = keccak256("precedence-source");
        _authority.disableIngress();
        vm.expectRevert(ITask3BFinalCore.CoreNoActiveIngress.selector);
        _ingress.deposit{value: 1}(address(_core), source);
        _configureIngress(1, _ingress, 10 ether, 20 ether, 40 ether);

        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.NotActiveIngress.selector, address(this)));
        _core.depositCanonical{value: 1}(source);

        Task3BIngress otherIngress = new Task3BIngress();
        _authority.configureRoles(address(this), address(0), false, address(0), address(0), address(_ingress));
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.CoreRoleIdentityCollision.selector, address(_ingress)));
        _ingress.deposit{value: 1}(address(_core), source);
        _authority.configureRoles(address(this), address(0), false, address(0), address(0), address(otherIngress));

        vm.expectRevert(ITask3BFinalCore.DepositSourceRequired.selector);
        _ingress.deposit{value: 1}(address(_core), bytes32(0));
        vm.expectRevert(ITask3BFinalCore.InvalidAmount.selector);
        _ingress.deposit(address(_core), source);

        bytes32 expectedHash = keccak256("drifted-ingress-runtime");
        bytes32 actualHash = address(_ingress).codehash;
        _authority.setIngressWord(2, uint256(expectedHash));
        _authority.setSnapshotWord(
            20, uint256(_configHashWithRuntime(_ingress, expectedHash, 10 ether, 20 ether, 40 ether))
        );
        vm.expectRevert(
            abi.encodeWithSelector(
                ITask3BFinalCore.CoreIngressCodeHashMismatch.selector, address(_ingress), expectedHash, actualHash
            )
        );
        _ingress.deposit{value: 1}(address(_core), source);
    }

    function test_task3B_10_depositEveryCapBoundaryUtcGenerationResetAndGlobalPersistence() public {
        _configureIngress(1, _ingress, 5 ether, 8 ether, 12 ether);
        uint256 boundarySnapshot = vm.snapshotState();
        _ingress.deposit{value: 4 ether}(address(_core), keccak256("per-minus-one"));
        assertEq(_core.ingressLifetimeDepositedWei(1), 4 ether, "per-deposit minus one");
        assertTrue(vm.revertToState(boundarySnapshot), "per minus restore");
        boundarySnapshot = vm.snapshotState();
        _ingress.deposit{value: 5 ether}(address(_core), keccak256("per-exact"));
        assertEq(_core.ingressLifetimeDepositedWei(1), 5 ether, "per-deposit exact");
        assertTrue(vm.revertToState(boundarySnapshot), "per exact restore");
        vm.expectRevert(
            abi.encodeWithSelector(ITask3BFinalCore.DepositCapExceeded.selector, _PER_DEPOSIT_CAP, 5 ether, 5 ether + 1)
        );
        _ingress.deposit{value: 5 ether + 1}(address(_core), keccak256("per-plus"));

        _ingress.deposit{value: 5 ether}(address(_core), keccak256("epoch-a"));
        _ingress.deposit{value: 2 ether}(address(_core), keccak256("epoch-minus"));
        uint256 day = block.timestamp / _EPOCH_DAY;
        assertEq(_core.ingressEpochDepositedWei(1, day), 7 ether, "epoch minus one");
        _ingress.deposit{value: 1 ether}(address(_core), keccak256("epoch-exact"));
        assertEq(_core.ingressEpochDepositedWei(1, day), 8 ether, "epoch exact");
        vm.expectRevert(
            abi.encodeWithSelector(ITask3BFinalCore.DepositCapExceeded.selector, _EPOCH_CAP, 8 ether, 8 ether + 1)
        );
        _ingress.deposit{value: 1}(address(_core), keccak256("epoch-plus"));

        vm.warp((day + 1) * _EPOCH_DAY);
        _ingress.deposit{value: 3 ether}(address(_core), keccak256("lifetime-minus"));
        assertEq(_core.ingressLifetimeDepositedWei(1), 11 ether, "lifetime minus one");
        _ingress.deposit{value: 1 ether}(address(_core), keccak256("lifetime-exact"));
        assertEq(_core.ingressLifetimeDepositedWei(1), 12 ether, "lifetime exact");
        vm.expectRevert(
            abi.encodeWithSelector(ITask3BFinalCore.DepositCapExceeded.selector, _LIFETIME_CAP, 12 ether, 12 ether + 1)
        );
        _ingress.deposit{value: 1}(address(_core), keccak256("lifetime-plus"));

        _configureIngress(2, _ingress, 100 ether, 100 ether, 100 ether);
        _ingress.deposit{value: 87 ether}(address(_core), keccak256("global-minus"));
        assertEq(_core.globalLifetimeCanonicalDepositedWei(), _GLOBAL_CAP - 1 ether, "global minus one ether");
        _ingress.deposit{value: 1 ether}(address(_core), keccak256("global-exact"));
        assertEq(_core.ingressLifetimeDepositedWei(2), 88 ether, "generation reset");
        assertEq(_core.globalLifetimeCanonicalDepositedWei(), _GLOBAL_CAP, "global exact");
        vm.expectRevert(
            abi.encodeWithSelector(
                ITask3BFinalCore.DepositCapExceeded.selector, _GLOBAL_CAP_KIND, _GLOBAL_CAP, _GLOBAL_CAP + 1
            )
        );
        _ingress.deposit{value: 1}(address(_core), keccak256("global-plus"));
    }

    function test_task3B_11_depositDeficitRepairFullValueCapsRecordV2IdsAndEventOrder() public {
        vm.store(address(_core), bytes32(uint256(1)), bytes32(uint256(10 ether)));
        vm.deal(address(_core), 5 ether);
        uint256 fullValueCapSnapshot = vm.snapshotState();
        _configureIngress(1, _ingress, 6 ether, 6 ether, 6 ether);
        _ingress.deposit{value: 4 ether}(address(_core), keccak256("repair-cap-first"));
        vm.expectRevert(
            abi.encodeWithSelector(ITask3BFinalCore.DepositCapExceeded.selector, _EPOCH_CAP, 6 ether, 7 ether)
        );
        _ingress.deposit{value: 3 ether}(address(_core), keccak256("repair-cap-second"));
        assertEq(_core.ingressLifetimeDepositedWei(1), 4 ether, "repair consumes full cap value");
        assertTrue(vm.revertToState(fullValueCapSnapshot), "repair cap fixture restore");
        _configureIngress(1, _ingress, 10 ether, 20 ether, 40 ether);

        bytes32 source = keccak256("repair-source");
        bytes32 configHash = _configHash(_ingress, 10 ether, 20 ether, 40 ether);
        bytes32 expectedDepositId = _depositId(1, source, _ingress, configHash);
        ITask3BFinalCore.AccountingTotals memory depositPre = _totals(10 ether, 0, 0, 0, 0, 5 ether, 0);
        ITask3BFinalCore.AccountingTotals memory depositPost = _totals(10 ether, 0, 0, 0, 0, 9 ether, 1);
        bytes32 expectedMutation = _mutationId(1, 1, _CANONICAL_DEPOSIT, expectedDepositId);
        bytes32 expectedRepairComponent =
            _componentId(1, 1, expectedMutation, 0, _DEPOSIT_REPAIR, expectedDepositId, 4 ether);

        vm.recordLogs();
        assertEq(_ingress.deposit{value: 4 ether}(address(_core), source), expectedDepositId, "canonical deposit ID");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 3, "repair-only event count");
        _assertMutationLog(logs[0], 1, expectedMutation, _CANONICAL_DEPOSIT, depositPre, depositPost, 1);
        _assertComponentLog(logs[1], 1, 0, expectedRepairComponent, _DEPOSIT_REPAIR, expectedDepositId, 4 ether);
        _assertCanonicalDepositLog(logs[2], expectedDepositId, 1, source, address(_ingress), 4 ether, 4 ether, 0, 1);

        ITask3BFinalCore.DepositRecord memory record = _core.getDeposit(expectedDepositId);
        assertEq(record.depositId, expectedDepositId, "stored discriminator");
        assertEq(record.ingressGeneration, 1, "stored generation");
        assertEq(record.ingress, address(_ingress), "stored ingress");
        assertEq(record.sourceEventId, source, "stored source");
        assertEq(record.amountWei, 4 ether, "stored full amount");
        assertEq(record.balanceDeficitRepairWei, 4 ether, "stored repair");
        assertEq(record.availableCreditWei, 0, "zero available credit");
        assertEq(record.epochDay, block.timestamp / _EPOCH_DAY, "stored UTC day");
        assertEq(record.accountingSequence, 1, "stored sequence");
        assertEq(record.depositedAt, uint64(block.timestamp), "stored timestamp");
        assertEq(_core.availableWei(), 10 ether, "repair does not inflate bucket");
        assertEq(_core.lastObservedBalanceDeficitWei(), 1 ether, "post repair deficit");
        assertEq(_core.globalLifetimeCanonicalDepositedWei(), 4 ether, "full value consumes global cap");
        assertEq(_core.ingressLifetimeDepositedWei(1), 4 ether, "full value consumes generation cap");
        assertEq(
            _core.ingressEpochDepositedWei(1, block.timestamp / _EPOCH_DAY), 4 ether, "full value consumes epoch cap"
        );

        bytes32 source2 = keccak256("repair-and-credit");
        bytes32 depositId2 = _depositId(1, source2, _ingress, configHash);
        ITask3BFinalCore.AccountingTotals memory deposit2Pre = depositPost;
        ITask3BFinalCore.AccountingTotals memory deposit2Post = _totals(12 ether, 0, 0, 0, 0, 12 ether, 2);
        bytes32 mutation2 = _mutationId(1, 2, _CANONICAL_DEPOSIT, depositId2);
        bytes32 repair2 = _componentId(1, 2, mutation2, 0, _DEPOSIT_REPAIR, depositId2, 1 ether);
        bytes32 credit2 = _componentId(1, 2, mutation2, 1, _DEPOSIT_CREDIT, depositId2, 2 ether);
        vm.recordLogs();
        assertEq(_ingress.deposit{value: 3 ether}(address(_core), source2), depositId2, "repair+credit ID");
        logs = vm.getRecordedLogs();
        assertEq(logs.length, 4, "repair+credit event count");
        _assertMutationLog(logs[0], 2, mutation2, _CANONICAL_DEPOSIT, deposit2Pre, deposit2Post, 2);
        _assertComponentLog(logs[1], 2, 0, repair2, _DEPOSIT_REPAIR, depositId2, 1 ether);
        _assertComponentLog(logs[2], 2, 1, credit2, _DEPOSIT_CREDIT, depositId2, 2 ether);
        _assertCanonicalDepositLog(logs[3], depositId2, 1, source2, address(_ingress), 3 ether, 1 ether, 2 ether, 2);
        assertEq(_core.availableWei(), 12 ether, "credit only increases available");
        assertEq(_core.globalLifetimeCanonicalDepositedWei(), 7 ether, "full second value consumes cap");
    }

    function test_task3B_12_replayDomainSeparationMissingRecordAndFullRollback() public {
        bytes32 source = keccak256("stable-external-event");
        bytes32 config1 = _configHash(_ingress, 10 ether, 20 ether, 40 ether);
        bytes32 id1 = _depositId(1, source, _ingress, config1);
        ITask3BFinalCore.AccountingTotals memory creditPre = _totals(0, 0, 0, 0, 0, 0, 0);
        ITask3BFinalCore.AccountingTotals memory creditPost = _totals(2 ether, 0, 0, 0, 0, 2 ether, 1);
        bytes32 creditMutation = _mutationId(1, 1, _CANONICAL_DEPOSIT, id1);
        bytes32 creditComponent = _componentId(1, 1, creditMutation, 0, _DEPOSIT_CREDIT, id1, 2 ether);
        vm.recordLogs();
        assertEq(_ingress.deposit{value: 2 ether}(address(_core), source), id1, "first domain ID");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 3, "credit-only event count");
        _assertMutationLog(logs[0], 1, creditMutation, _CANONICAL_DEPOSIT, creditPre, creditPost, 1);
        _assertComponentLog(logs[1], 1, 0, creditComponent, _DEPOSIT_CREDIT, id1, 2 ether);
        _assertCanonicalDepositLog(logs[2], id1, 1, source, address(_ingress), 2 ether, 0, 2 ether, 1);

        uint256 replaySnapshot = vm.snapshotState();
        vm.store(address(_core), keccak256(abi.encode(uint256(1), uint256(9))), bytes32(uint256(40 ether)));
        bytes32 epochOuter = keccak256(abi.encode(uint256(1), uint256(10)));
        vm.store(
            address(_core), keccak256(abi.encode(block.timestamp / _EPOCH_DAY, epochOuter)), bytes32(uint256(20 ether))
        );
        vm.store(address(_core), bytes32(uint256(8)), bytes32(_GLOBAL_CAP));
        vm.store(address(_core), bytes32(uint256(6)), bytes32(type(uint256).max));
        bytes32 digest = _stateDigest(id1);
        uint256 callerBalance = address(this).balance;
        vm.recordLogs();
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.DepositReplay.selector, id1));
        _ingress.deposit{value: 10 ether + 1}(address(_core), source);
        assertEq(_stateDigest(id1), digest, "replay state rollback");
        assertEq(address(this).balance, callerBalance, "replay value refund");
        assertEq(vm.getRecordedLogs().length, 0, "replay log rollback");
        assertTrue(vm.revertToState(replaySnapshot), "replay precedence restore");

        _configureIngress(1, _ingress, 9 ether, 21 ether, 41 ether);
        bytes32 changedConfig = _configHash(_ingress, 9 ether, 21 ether, 41 ether);
        bytes32 changedConfigId = _depositId(1, source, _ingress, changedConfig);
        assertNotEq(changedConfig, config1, "same-generation config domain changed");
        assertNotEq(changedConfigId, id1, "config hash separates replay IDs");
        assertEq(
            _ingress.deposit{value: 1 ether}(address(_core), source),
            changedConfigId,
            "same generation/source/ingress accepts changed config once"
        );
        assertEq(_core.getDeposit(changedConfigId).depositId, changedConfigId, "changed-config record discriminator");

        _configureIngress(2, _ingress, 10 ether, 20 ether, 40 ether);
        bytes32 config2 = _configHash(_ingress, 10 ether, 20 ether, 40 ether);
        assertEq(config1, config2, "config hash excludes generation");
        bytes32 id2 = _depositId(2, source, _ingress, config2);
        assertNotEq(id1, id2, "generation domain separation");
        assertEq(_ingress.deposit{value: 1 ether}(address(_core), source), id2, "rotated domain accepts source");

        bytes32 missing = keccak256("missing-record");
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.DepositNotFound.selector, missing));
        _core.getDeposit(missing);
    }

    function test_task3B_13_timestampAndAllSequenceExhaustionEdgesPrecedeWrites() public {
        vm.warp(type(uint64).max);
        bytes32 maxTimeSource = keccak256("max-time");
        bytes32 maxTimeId = _ingress.deposit{value: 1}(address(_core), maxTimeSource);
        assertEq(_core.getDeposit(maxTimeId).depositedAt, type(uint64).max, "uint64 max accepted");
        vm.warp(uint256(type(uint64).max) + 1);
        bytes32 digest = _stateDigest(maxTimeId);
        vm.expectRevert(ITask3BFinalCore.CoreTimestampOverflow.selector);
        _ingress.deposit{value: 1}(address(_core), maxTimeSource);
        assertEq(_stateDigest(maxTimeId), digest, "timestamp rollback");

        vm.warp(20 days);
        vm.store(address(_core), bytes32(uint256(6)), bytes32(type(uint256).max));
        vm.deal(address(_core), address(_core).balance + 1);
        digest = _stateDigest(maxTimeId);
        vm.expectRevert(
            abi.encodeWithSelector(ITask3BFinalCore.CoreCounterExhausted.selector, _ACCOUNTING_SEQUENCE_COUNTER)
        );
        _core.syncBalance();
        assertEq(_stateDigest(maxTimeId), digest, "sync exhaustion rollback");

        vm.store(address(_core), bytes32(uint256(2)), bytes32(uint256(1)));
        vm.deal(address(_core), _core.accountingTotals().accountedBackingWei);
        vm.expectRevert(
            abi.encodeWithSelector(ITask3BFinalCore.CoreCounterExhausted.selector, _ACCOUNTING_SEQUENCE_COUNTER)
        );
        _core.reclassifyUnattributed(1, keccak256("exhausted-reclassification"));
        vm.expectRevert(
            abi.encodeWithSelector(ITask3BFinalCore.CoreCounterExhausted.selector, _ACCOUNTING_SEQUENCE_COUNTER)
        );
        _ingress.deposit{value: 1}(address(_core), keccak256("exhausted-deposit"));
    }

    function test_task3B_14_priorAboveCapPanicsAndIncomingValueFullyRollsBack() public {
        bytes32 epochOuter = keccak256(abi.encode(uint256(1), uint256(10)));
        bytes32[3] memory corruptSlots = [
            keccak256(abi.encode(block.timestamp / _EPOCH_DAY, epochOuter)),
            keccak256(abi.encode(uint256(1), uint256(9))),
            bytes32(uint256(8))
        ];
        uint256[3] memory corruptValues = [uint256(20 ether + 1), uint256(40 ether + 1), _GLOBAL_CAP + 1];
        for (uint256 i; i < corruptSlots.length; ++i) {
            uint256 snapshot = vm.snapshotState();
            bytes32 source = keccak256(abi.encode("corrupt-prior", i));
            bytes32 candidate = _depositId(1, source, _ingress, _configHash(_ingress, 10 ether, 20 ether, 40 ether));
            vm.store(address(_core), corruptSlots[i], bytes32(corruptValues[i]));
            bytes32 digest = _stateDigest(candidate);
            uint256 callerBalance = address(this).balance;
            vm.recordLogs();
            vm.expectRevert(stdError.arithmeticError);
            _ingress.deposit{value: 1}(address(_core), source);
            assertEq(_stateDigest(candidate), digest, "corrupt prior rollback");
            assertEq(address(this).balance, callerBalance, "corrupt prior refund");
            assertEq(vm.getRecordedLogs().length, 0, "corrupt prior log rollback");
            assertTrue(vm.revertToState(snapshot), "corrupt prior restore");
        }
    }

    function test_task3B_15_passiveKnownUnknownTokenPrefundingNeverCallsOrCreatesStockState() public {
        StockTokenRegistryV2 realRegistry = new StockTokenRegistryV2(address(this), address(this));
        Task3BTestToken activeToken = new Task3BTestToken();
        Task3BTestToken historicalToken = new Task3BTestToken();
        Task3BTestToken unknownToken = new Task3BTestToken();
        bytes32 activeKey = _activateRegistryToken(realRegistry, activeToken, "ACTIVE", keccak256("active-provider"));
        bytes32 historicalKey =
            _activateRegistryToken(realRegistry, historicalToken, "HIST", keccak256("historical-provider"));
        realRegistry.deactivateVersion(historicalKey, keccak256("historical-version"));
        assertEq(realRegistry.activeVersionForToken(address(activeToken)), activeKey, "active Registry category");
        assertFalse(realRegistry.getVersion(historicalKey).active, "inactive historical Registry category");
        assertEq(realRegistry.activeVersionForToken(address(unknownToken)), bytes32(0), "unknown Registry category");

        address predictedFactory = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        address predictedCore = vm.computeCreateAddress(predictedFactory, 2);
        activeToken.mint(predictedCore, 7);
        historicalToken.mint(predictedCore, 11);
        unknownToken.mint(predictedCore, 13);
        vm.deal(predictedCore, 6 ether);
        uint256 catalogVersion = realRegistry.catalogVersion();

        vm.record();
        vm.recordLogs();
        ProductionFixture memory f = _deployProductionFixture(realRegistry, _GLOBAL_CAP);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        _assertNoTokenEmitter(logs, activeToken, historicalToken, unknownToken);
        _assertNoTokenStorageAccess(activeToken, "graph active token");
        _assertNoTokenStorageAccess(historicalToken, "graph historical token");
        _assertNoTokenStorageAccess(unknownToken, "graph unknown token");
        assertEq(address(f.core), predictedCore, "prefunded production Core address");
        assertEq(activeToken.balanceOf(predictedCore), 7, "active token physically held");
        assertEq(historicalToken.balanceOf(predictedCore), 11, "historical token physically held");
        assertEq(unknownToken.balanceOf(predictedCore), 13, "unknown token physically held");
        assertEq(f.core.stockTokenRegistryV2(), address(realRegistry), "real Registry immutable binding");
        assertEq(realRegistry.catalogVersion(), catalogVersion, "graph never mutates Registry");

        _recordTokens(activeToken, historicalToken, unknownToken);
        vm.recordLogs();
        f.core.syncBalance();
        logs = vm.getRecordedLogs();
        _assertNoTokenEmitter(logs, activeToken, historicalToken, unknownToken);
        _assertNoTokenStorageAccess(activeToken, "sync active token");
        _assertNoTokenStorageAccess(historicalToken, "sync historical token");
        _assertNoTokenStorageAccess(unknownToken, "sync unknown token");

        _recordTokens(activeToken, historicalToken, unknownToken);
        vm.recordLogs();
        f.core.reclassifyUnattributed(1 ether, keccak256("real-registry-reclassification"));
        logs = vm.getRecordedLogs();
        _assertNoTokenEmitter(logs, activeToken, historicalToken, unknownToken);
        _assertNoTokenStorageAccess(activeToken, "reclass active token");
        _assertNoTokenStorageAccess(historicalToken, "reclass historical token");
        _assertNoTokenStorageAccess(unknownToken, "reclass unknown token");

        Task3BIngress realIngress = new Task3BIngress();
        _activateProductionIngress(f.authority, address(realIngress), 10 ether, 20 ether, 40 ether);
        _recordTokens(activeToken, historicalToken, unknownToken);
        vm.recordLogs();
        realIngress.deposit{value: 2 ether}(address(f.core), keccak256("real-registry-deposit"));
        logs = vm.getRecordedLogs();
        _assertNoTokenEmitter(logs, activeToken, historicalToken, unknownToken);
        _assertNoTokenStorageAccess(activeToken, "deposit active token");
        _assertNoTokenStorageAccess(historicalToken, "deposit historical token");
        _assertNoTokenStorageAccess(unknownToken, "deposit unknown token");

        assertEq(activeToken.balanceOf(predictedCore), 7, "active balance unchanged");
        assertEq(historicalToken.balanceOf(predictedCore), 11, "historical balance unchanged");
        assertEq(unknownToken.balanceOf(predictedCore), 13, "unknown balance unchanged");
        assertEq(realRegistry.catalogVersion(), catalogVersion, "native operations never mutate Registry");
        assertEq(f.core.globalLifetimeCanonicalDepositedWei(), 2 ether, "only native canonical value consumes caps");
    }

    function test_task3B_16_liveIngressRotationDisableAndCodeIdentityHaveNoCoreMirrors() public {
        bytes32 source = keccak256("rotation-source");
        bytes32 id1 = _ingress.deposit{value: 1}(address(_core), source);
        Task3BIngress successor = new Task3BIngress();
        _configureIngress(2, successor, 10 ether, 20 ether, 40 ether);

        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.NotActiveIngress.selector, address(_ingress)));
        _ingress.deposit{value: 1}(address(_core), keccak256("old-ingress"));
        bytes32 id2 = successor.deposit{value: 1}(address(_core), source);
        assertNotEq(id1, id2, "rotation changes replay domain");
        assertEq(_core.getDeposit(id1).ingress, address(_ingress), "record preserves historical ingress");
        assertEq(_core.getDeposit(id2).ingress, address(successor), "record preserves current ingress");

        _authority.disableIngress();
        vm.expectRevert(ITask3BFinalCore.CoreNoActiveIngress.selector);
        successor.deposit{value: 1}(address(_core), keccak256("disabled"));
    }

    function test_task3B_17_combinedSurplusAndObservationUsesExactContiguousEvidence() public {
        vm.deal(address(_core), 10 ether);
        _core.syncBalance();
        vm.deal(address(_core), 6 ether);
        _core.syncBalance();
        assertEq(_core.lastObservedBalanceDeficitWei(), 4 ether, "four deficit observed");

        vm.deal(address(_core), 12 ether);
        ITask3BFinalCore.AccountingTotals memory pre = _totals(0, 10 ether, 0, 0, 0, 12 ether, 2);
        ITask3BFinalCore.AccountingTotals memory post = _totals(0, 12 ether, 0, 0, 0, 12 ether, 3);
        bytes32 subject = keccak256(abi.encode(pre, post));
        bytes32 mutationId = _mutationId(0, 3, _SYNC_BALANCE, subject);
        bytes32 surplusId = _componentId(0, 3, mutationId, 0, _FORCED_SURPLUS, subject, 2 ether);
        bytes32 clearingId = _componentId(0, 3, mutationId, 1, _DEFICIT_OBSERVATION, subject, 0);

        vm.recordLogs();
        assertEq(_core.syncBalance(), mutationId, "combined mutation ID");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 3, "combined event count");
        _assertMutationLog(logs[0], 3, mutationId, _SYNC_BALANCE, pre, post, 2);
        _assertComponentLog(logs[1], 3, 0, surplusId, _FORCED_SURPLUS, subject, 2 ether);
        _assertComponentLog(logs[2], 3, 1, clearingId, _DEFICIT_OBSERVATION, subject, 0);
        assertEq(_core.unattributedWei(), 12 ether, "surplus above existing backing only enters U");
        assertEq(_core.lastObservedBalanceDeficitWei(), 0, "combined observation clears");
    }

    function test_task3B_18_arbitraryAccountingEquationsAndCheckedArithmeticPanics() public {
        vm.store(address(_core), bytes32(uint256(1)), bytes32(uint256(2 ether)));
        vm.store(address(_core), bytes32(uint256(2)), bytes32(uint256(3 ether)));
        vm.store(address(_core), bytes32(uint256(3)), bytes32(uint256(5 ether)));
        vm.store(address(_core), bytes32(uint256(4)), bytes32(uint256(11 ether)));
        vm.store(address(_core), bytes32(uint256(5)), bytes32(uint256(7 ether)));
        vm.store(address(_core), bytes32(uint256(6)), bytes32(uint256(9)));
        vm.deal(address(_core), 13 ether);
        _assertTotals(_core.accountingTotals(), _totals(2 ether, 3 ether, 5 ether, 11 ether, 7 ether, 13 ether, 9));

        vm.deal(address(_core), 21 ether);
        _assertTotals(_core.accountingTotals(), _totals(2 ether, 3 ether, 5 ether, 11 ether, 7 ether, 21 ether, 9));

        uint256 snapshot = vm.snapshotState();
        vm.store(address(_core), bytes32(uint256(4)), bytes32(uint256(6 ether)));
        vm.expectRevert(stdError.arithmeticError);
        _core.accountingTotals();
        assertTrue(vm.revertToState(snapshot), "P greater than L restore");

        snapshot = vm.snapshotState();
        vm.store(address(_core), bytes32(uint256(1)), bytes32(type(uint256).max));
        vm.store(address(_core), bytes32(uint256(2)), bytes32(uint256(1)));
        vm.expectRevert(stdError.arithmeticError);
        _core.accountingTotals();
        assertTrue(vm.revertToState(snapshot), "backing overflow restore");
    }

    function test_task3B_19_deficitObservationProgressesFourToTwoToZeroWithZeroComponent() public {
        vm.store(address(_core), bytes32(uint256(1)), bytes32(uint256(10 ether)));
        vm.deal(address(_core), 6 ether);
        _core.syncBalance();
        assertEq(_core.lastObservedBalanceDeficitWei(), 4 ether, "four");

        vm.deal(address(_core), 8 ether);
        _core.syncBalance();
        assertEq(_core.lastObservedBalanceDeficitWei(), 2 ether, "two");

        vm.deal(address(_core), 10 ether);
        ITask3BFinalCore.AccountingTotals memory pre = _totals(10 ether, 0, 0, 0, 0, 10 ether, 2);
        ITask3BFinalCore.AccountingTotals memory post = _totals(10 ether, 0, 0, 0, 0, 10 ether, 3);
        bytes32 subject = keccak256(abi.encode(pre, post));
        bytes32 mutationId = _mutationId(0, 3, _SYNC_BALANCE, subject);
        bytes32 componentId = _componentId(0, 3, mutationId, 0, _DEFICIT_OBSERVATION, subject, 0);
        vm.recordLogs();
        _core.syncBalance();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 2, "zero clearing emits one component");
        _assertMutationLog(logs[0], 3, mutationId, _SYNC_BALANCE, pre, post, 1);
        _assertComponentLog(logs[1], 3, 0, componentId, _DEFICIT_OBSERVATION, subject, 0);
        assertEq(_core.lastObservedBalanceDeficitWei(), 0, "zero");
    }

    function test_task3B_20_pauseTrueReclassificationMovesNoEthAndNoDeltaPrecedesExhaustion() public {
        vm.deal(address(_core), 10 ether);
        _core.syncBalance();
        _authority.configureRoles(address(this), address(0), true, address(0), address(0), address(0));
        uint256 balanceBefore = address(_core).balance;
        _core.reclassifyUnattributed(3 ether, keccak256("paused-reclassification"));
        assertEq(address(_core).balance, balanceBefore, "reclassification moves no ETH");
        assertEq(_core.availableWei(), 3 ether, "paused reclassification available");
        assertEq(_core.unattributedWei(), 7 ether, "paused reclassification unattributed");

        vm.store(address(_core), bytes32(uint256(6)), bytes32(type(uint256).max));
        vm.expectRevert(ITask3BFinalCore.NoBalanceDelta.selector);
        _core.syncBalance();

        vm.deal(address(_core), 9 ether);
        vm.store(address(_core), bytes32(uint256(7)), bytes32(0));
        vm.expectRevert(
            abi.encodeWithSelector(ITask3BFinalCore.CoreCounterExhausted.selector, _ACCOUNTING_SEQUENCE_COUNTER)
        );
        _core.syncBalance();
        assertEq(_core.lastObservedBalanceDeficitWei(), 0, "observation-only exhaustion writes nothing");
    }

    function test_task3B_21_exactDeficitRepairClearsWithoutAvailableInflation() public {
        vm.store(address(_core), bytes32(uint256(1)), bytes32(uint256(10 ether)));
        vm.deal(address(_core), 5 ether);
        bytes32 source = keccak256("exact-deficit-repair");
        bytes32 depositId = _depositId(1, source, _ingress, _configHash(_ingress, 10 ether, 20 ether, 40 ether));
        ITask3BFinalCore.AccountingTotals memory pre = _totals(10 ether, 0, 0, 0, 0, 5 ether, 0);
        ITask3BFinalCore.AccountingTotals memory post = _totals(10 ether, 0, 0, 0, 0, 10 ether, 1);
        bytes32 mutationId = _mutationId(1, 1, _CANONICAL_DEPOSIT, depositId);
        bytes32 componentId = _componentId(1, 1, mutationId, 0, _DEPOSIT_REPAIR, depositId, 5 ether);
        vm.recordLogs();
        _ingress.deposit{value: 5 ether}(address(_core), source);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 3, "exact repair event count");
        _assertMutationLog(logs[0], 1, mutationId, _CANONICAL_DEPOSIT, pre, post, 1);
        _assertComponentLog(logs[1], 1, 0, componentId, _DEPOSIT_REPAIR, depositId, 5 ether);
        _assertCanonicalDepositLog(logs[2], depositId, 1, source, address(_ingress), 5 ether, 5 ether, 0, 1);
        assertEq(_core.availableWei(), 10 ether, "exact repair does not inflate A");
        assertEq(_core.lastObservedBalanceDeficitWei(), 0, "exact repair clears deficit");
    }

    function test_task3B_22_allTwelveProhibitedIngressIdentitiesAndCodeBeforeCollision() public {
        vm.etch(_budgetBook, type(Task3BCodeStub).runtimeCode);
        vm.etch(_intentExecution, type(Task3BCodeStub).runtimeCode);
        vm.etch(_reconciliation, type(Task3BCodeStub).runtimeCode);
        Task3BCodeStub pendingSafe = new Task3BCodeStub();
        Task3BCodeStub operator = new Task3BCodeStub();
        Task3BCodeStub pendingOperator = new Task3BCodeStub();
        Task3BCodeStub pendingIngress = new Task3BCodeStub();
        address[12] memory candidates = [
            address(_authority),
            address(_factory),
            address(_core),
            address(_registry),
            _budgetBook,
            _intentExecution,
            _reconciliation,
            address(this),
            address(pendingSafe),
            address(operator),
            address(pendingOperator),
            address(pendingIngress)
        ];
        _authority.configureRoles(
            address(this),
            address(pendingSafe),
            false,
            address(operator),
            address(pendingOperator),
            address(pendingIngress)
        );
        for (uint256 i; i < candidates.length; ++i) {
            uint256 snapshot = vm.snapshotState();
            address candidate = candidates[i];
            _configureIngressAddress(1, candidate, candidate.codehash, 10 ether, 20 ether, 40 ether);
            vm.deal(candidate, 1 ether);
            vm.prank(candidate);
            vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.CoreRoleIdentityCollision.selector, candidate));
            _core.depositCanonical{value: 1}(keccak256(abi.encode("collision", i)));
            assertTrue(vm.revertToState(snapshot), "collision fixture restore");
        }

        address noCode = address(0xA11CE);
        bytes32 claimedHash = keccak256("claimed-runtime");
        _authority.configureRoles(address(this), address(0), false, noCode, address(0), address(0));
        _configureIngressAddress(1, noCode, claimedHash, 10 ether, 20 ether, 40 ether);
        vm.deal(noCode, 1 ether);
        vm.prank(noCode);
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.CoreContractRequired.selector, noCode));
        _core.depositCanonical{value: 1}(keccak256("code-before-collision"));
    }

    function test_task3B_23_postMutationCoreSnapshotIsExactEighteenWordState() public {
        vm.deal(address(_core), 5 ether);
        _core.syncBalance();
        _core.reclassifyUnattributed(2 ether, keccak256("snapshot-reclassification"));
        _ingress.deposit{value: 4 ether}(address(_core), keccak256("snapshot-deposit"));

        (bool ok, bytes memory snapshot) = address(_core).staticcall(abi.encodeCall(ITask3BFinalCore.coreSnapshot, ()));
        assertTrue(ok, "Core snapshot call");
        assertEq(snapshot.length, 576, "Core snapshot fixed length");
        uint256[18] memory expected = [
            uint256(3),
            uint256(uint160(address(_factory))),
            uint256(_MANIFEST),
            uint256(uint160(address(_authority))),
            uint256(uint160(address(_registry))),
            uint256(uint160(_budgetBook)),
            uint256(uint160(_intentExecution)),
            uint256(uint160(_reconciliation)),
            uint256(1),
            _GLOBAL_CAP,
            uint256(6 ether),
            uint256(3 ether),
            uint256(0),
            uint256(0),
            uint256(0),
            uint256(3),
            uint256(0),
            uint256(4 ether)
        ];
        for (uint256 i; i < expected.length; ++i) {
            assertEq(_word(snapshot, i), expected[i], "Core snapshot word");
        }
    }

    function test_task3B_24_realFactoryAuthorityLifecycleImmediatelyDrivesCoreWithoutMirrors() public {
        StockTokenRegistryV2 realRegistry = new StockTokenRegistryV2(address(this), address(this));
        ProductionFixture memory f = _deployProductionFixture(realRegistry, _GLOBAL_CAP);
        Task3BCodeStub successorSafe = new Task3BCodeStub();
        Task3BCodeStub operator = new Task3BCodeStub();
        Task3BCodeStub pendingOperator = new Task3BCodeStub();

        f.authority.transferOwnership(address(successorSafe));
        vm.prank(address(successorSafe));
        f.authority.acceptOwnership();
        assertEq(f.authority.owner(), address(successorSafe), "production ownership acceptance");

        vm.deal(address(f.core), 5 ether);
        f.core.syncBalance();
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.CoreUnauthorized.selector, address(this)));
        f.core.reclassifyUnattributed(1 ether, keccak256("superseded-safe"));
        vm.prank(address(successorSafe));
        f.core.reclassifyUnattributed(1 ether, keccak256("accepted-safe"));

        vm.prank(address(successorSafe));
        bytes32 operatorProposal = f.authority.nominateMainOperator(address(operator), keccak256("production-operator"));
        Task3BIngress firstIngress = new Task3BIngress();
        IAcquisitionAuthorityV2.IngressConfig memory firstConfig = IAcquisitionAuthorityV2.IngressConfig({
            ingress: address(firstIngress),
            runtimeCodeHash: address(firstIngress).codehash,
            perDepositCapWei: 10 ether,
            epochDepositCapWei: 20 ether,
            lifetimeDepositCapWei: 40 ether
        });
        vm.prank(address(successorSafe));
        bytes32 firstIngressProposal = f.authority.proposeIngress(firstConfig, keccak256("production-first-ingress"));
        IAcquisitionAuthorityV2.PendingIngressProposal memory firstPending = f.authority.pendingIngressProposal();
        vm.warp(firstPending.validAfter);
        vm.prank(address(operator));
        f.authority.acceptMainOperatorNomination(operatorProposal);
        vm.prank(address(successorSafe));
        assertEq(f.authority.activateIngress(firstIngressProposal), 1, "first production ingress generation");
        firstIngress.deposit{value: 1 ether}(address(f.core), keccak256("first-production-deposit"));

        bytes32 liveRoleDigest = _coreLinearDigest(address(f.core));
        vm.recordLogs();
        vm.prank(address(operator));
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.CoreUnauthorized.selector, address(operator)));
        f.core.reclassifyUnattributed(1, keccak256("current-operator-not-safe"));
        assertEq(_coreLinearDigest(address(f.core)), liveRoleDigest, "current operator changed Core state");
        assertEq(vm.getRecordedLogs().length, 0, "current operator emitted Core log");

        vm.prank(address(successorSafe));
        f.authority.disableMainOperator(keccak256("operator-transition"));
        vm.prank(address(successorSafe));
        f.authority.nominateMainOperator(address(pendingOperator), keccak256("pending-production-operator"));
        liveRoleDigest = _coreLinearDigest(address(f.core));
        vm.recordLogs();
        vm.prank(address(pendingOperator));
        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.CoreUnauthorized.selector, address(pendingOperator)));
        f.core.reclassifyUnattributed(1, keccak256("pending-operator-not-safe"));
        assertEq(_coreLinearDigest(address(f.core)), liveRoleDigest, "pending operator changed Core state");
        assertEq(vm.getRecordedLogs().length, 0, "pending operator emitted Core log");
        firstIngress.deposit{value: 1 ether}(address(f.core), keccak256("pending-role-deposit"));

        bytes32 coreBeforeAuthorityRotation = _coreLinearDigest(address(f.core));
        vm.prank(address(successorSafe));
        f.authority.disableIngress(keccak256("rotate-first-ingress"));
        assertEq(_coreLinearDigest(address(f.core)), coreBeforeAuthorityRotation, "disable created Core mirror");

        Task3BIngress secondIngress = new Task3BIngress();
        IAcquisitionAuthorityV2.IngressConfig memory secondConfig = IAcquisitionAuthorityV2.IngressConfig({
            ingress: address(secondIngress),
            runtimeCodeHash: address(secondIngress).codehash,
            perDepositCapWei: 10 ether,
            epochDepositCapWei: 20 ether,
            lifetimeDepositCapWei: 40 ether
        });
        vm.prank(address(successorSafe));
        bytes32 secondProposal = f.authority.proposeIngress(secondConfig, keccak256("production-second-ingress"));
        IAcquisitionAuthorityV2.PendingIngressProposal memory secondPending = f.authority.pendingIngressProposal();
        bytes32 pendingIngressDigest = _coreLinearDigest(address(f.core));
        uint256 pendingIngressCallerBalance = address(this).balance;
        vm.recordLogs();
        vm.expectRevert(ITask3BFinalCore.CoreNoActiveIngress.selector);
        secondIngress.deposit{value: 1}(address(f.core), keccak256("pending-ingress-not-active"));
        assertEq(_coreLinearDigest(address(f.core)), pendingIngressDigest, "pending ingress changed Core state");
        assertEq(address(this).balance, pendingIngressCallerBalance, "pending ingress value refund");
        assertEq(vm.getRecordedLogs().length, 0, "pending ingress log rollback");
        vm.warp(secondPending.validAfter);
        vm.prank(address(successorSafe));
        assertEq(f.authority.activateIngress(secondProposal), 2, "rotated production ingress generation");
        assertEq(_coreLinearDigest(address(f.core)), coreBeforeAuthorityRotation, "rotation created Core mirror");

        vm.expectRevert(abi.encodeWithSelector(ITask3BFinalCore.NotActiveIngress.selector, address(firstIngress)));
        firstIngress.deposit{value: 1}(address(f.core), keccak256("retired-production-ingress"));
        secondIngress.deposit{value: 1 ether}(address(f.core), keccak256("second-production-deposit"));

        uint256 codeDriftSnapshot = vm.snapshotState();
        bytes32 expectedCodeHash = address(secondIngress).codehash;
        vm.etch(address(secondIngress), type(Task3BIngressV2).runtimeCode);
        bytes32 actualCodeHash = address(secondIngress).codehash;
        assertNotEq(actualCodeHash, expectedCodeHash, "code-drift fixture");
        vm.expectRevert(
            abi.encodeWithSelector(
                ITask3BFinalCore.CoreIngressCodeHashMismatch.selector,
                address(secondIngress),
                expectedCodeHash,
                actualCodeHash
            )
        );
        secondIngress.deposit{value: 1}(address(f.core), keccak256("production-code-drift"));
        assertTrue(vm.revertToState(codeDriftSnapshot), "code-drift restore");

        bytes32 coreBeforeFinalDisable = _coreLinearDigest(address(f.core));
        vm.prank(address(successorSafe));
        f.authority.disableIngress(keccak256("production-disable"));
        assertEq(_coreLinearDigest(address(f.core)), coreBeforeFinalDisable, "final disable created Core mirror");
        vm.expectRevert(ITask3BFinalCore.CoreNoActiveIngress.selector);
        secondIngress.deposit{value: 1}(address(f.core), keccak256("disabled-production-ingress"));
    }

    function test_task3B_25_depositReadAndLocalAdjacentPrecedenceUsesExactPayloads() public {
        bytes32 source = keccak256("adjacent-deposit-source");

        uint256 snapshot = vm.snapshotState();
        _authority.disableIngress();
        _authority.setModes(1, 1);
        _assertDepositRevert(
            address(_ingress),
            source,
            1,
            abi.encodeWithSelector(ITask3BFinalCore.CoreAuthoritySnapshotCallFailed.selector)
        );
        assertTrue(vm.revertToState(snapshot), "snapshot/no-active restore");

        snapshot = vm.snapshotState();
        _authority.disableIngress();
        _authority.setModes(0, 1);
        _assertDepositRevert(
            address(_ingress), source, 1, abi.encodeWithSelector(ITask3BFinalCore.CoreNoActiveIngress.selector)
        );
        assertTrue(vm.revertToState(snapshot), "no-active/getIngress restore");

        snapshot = vm.snapshotState();
        _authority.setModes(0, 1);
        _assertDepositRevert(
            address(this),
            source,
            1,
            abi.encodeWithSelector(ITask3BFinalCore.CoreIngressCallFailed.selector, uint256(1))
        );
        assertTrue(vm.revertToState(snapshot), "getIngress/caller restore");

        snapshot = vm.snapshotState();
        vm.etch(address(_ingress), bytes(""));
        _assertDepositRevert(
            address(this), source, 1, abi.encodeWithSelector(ITask3BFinalCore.NotActiveIngress.selector, address(this))
        );
        assertTrue(vm.revertToState(snapshot), "caller/code restore");

        snapshot = vm.snapshotState();
        bytes32 claimedHash = keccak256("adjacent-claimed-runtime");
        _authority.configureRoles(address(this), address(0), false, address(_ingress), address(0), address(0));
        _configureIngressAddress(1, address(_ingress), claimedHash, 10 ether, 20 ether, 40 ether);
        vm.etch(address(_ingress), bytes(""));
        _assertDepositRevert(
            address(_ingress),
            source,
            1,
            abi.encodeWithSelector(ITask3BFinalCore.CoreContractRequired.selector, address(_ingress))
        );
        assertTrue(vm.revertToState(snapshot), "code/hash restore");

        snapshot = vm.snapshotState();
        bytes32 actualHash = address(_ingress).codehash;
        claimedHash = keccak256("adjacent-drift");
        _authority.configureRoles(address(this), address(0), false, address(_ingress), address(0), address(0));
        _configureIngressAddress(1, address(_ingress), claimedHash, 10 ether, 20 ether, 40 ether);
        _assertDepositRevert(
            address(_ingress),
            source,
            1,
            abi.encodeWithSelector(
                ITask3BFinalCore.CoreIngressCodeHashMismatch.selector, address(_ingress), claimedHash, actualHash
            )
        );
        assertTrue(vm.revertToState(snapshot), "hash/collision restore");

        snapshot = vm.snapshotState();
        _authority.configureRoles(address(this), address(0), false, address(_ingress), address(0), address(0));
        _assertDepositRevert(
            address(_ingress),
            bytes32(0),
            1,
            abi.encodeWithSelector(ITask3BFinalCore.CoreRoleIdentityCollision.selector, address(_ingress))
        );
        assertTrue(vm.revertToState(snapshot), "collision/source restore");

        _assertDepositRevert(
            address(_ingress), bytes32(0), 0, abi.encodeWithSelector(ITask3BFinalCore.DepositSourceRequired.selector)
        );

        snapshot = vm.snapshotState();
        vm.warp(uint256(type(uint64).max) + 1);
        _assertDepositRevert(
            address(_ingress), source, 0, abi.encodeWithSelector(ITask3BFinalCore.InvalidAmount.selector)
        );
        assertTrue(vm.revertToState(snapshot), "value/timestamp restore");
    }

    function test_task3B_26_compoundCapOrderAndCounterPrecedenceAreExact() public {
        _configureIngress(1, _ingress, 5 ether, 8 ether, 12 ether);
        bytes32 epochOuter = keccak256(abi.encode(uint256(1), uint256(10)));
        bytes32 epochSlot = keccak256(abi.encode(block.timestamp / _EPOCH_DAY, epochOuter));
        bytes32 lifetimeSlot = keccak256(abi.encode(uint256(1), uint256(9)));

        uint256 snapshot = vm.snapshotState();
        vm.store(address(_core), epochSlot, bytes32(uint256(8 ether)));
        vm.store(address(_core), lifetimeSlot, bytes32(uint256(12 ether)));
        vm.store(address(_core), bytes32(uint256(8)), bytes32(_GLOBAL_CAP));
        vm.store(address(_core), bytes32(uint256(6)), bytes32(type(uint256).max));
        _assertDepositRevert(
            address(_ingress),
            keccak256("compound-per"),
            6 ether,
            abi.encodeWithSelector(ITask3BFinalCore.DepositCapExceeded.selector, _PER_DEPOSIT_CAP, 5 ether, 6 ether)
        );
        assertTrue(vm.revertToState(snapshot), "compound per restore");

        snapshot = vm.snapshotState();
        vm.store(address(_core), epochSlot, bytes32(uint256(8 ether)));
        vm.store(address(_core), lifetimeSlot, bytes32(uint256(12 ether)));
        vm.store(address(_core), bytes32(uint256(8)), bytes32(_GLOBAL_CAP));
        vm.store(address(_core), bytes32(uint256(6)), bytes32(type(uint256).max));
        _assertDepositRevert(
            address(_ingress),
            keccak256("compound-epoch"),
            1,
            abi.encodeWithSelector(ITask3BFinalCore.DepositCapExceeded.selector, _EPOCH_CAP, 8 ether, 8 ether + 1)
        );
        assertTrue(vm.revertToState(snapshot), "compound epoch restore");

        snapshot = vm.snapshotState();
        vm.store(address(_core), lifetimeSlot, bytes32(uint256(12 ether)));
        vm.store(address(_core), bytes32(uint256(8)), bytes32(_GLOBAL_CAP));
        vm.store(address(_core), bytes32(uint256(6)), bytes32(type(uint256).max));
        _assertDepositRevert(
            address(_ingress),
            keccak256("compound-generation"),
            1,
            abi.encodeWithSelector(ITask3BFinalCore.DepositCapExceeded.selector, _LIFETIME_CAP, 12 ether, 12 ether + 1)
        );
        assertTrue(vm.revertToState(snapshot), "compound generation restore");

        snapshot = vm.snapshotState();
        vm.store(address(_core), bytes32(uint256(8)), bytes32(_GLOBAL_CAP));
        vm.store(address(_core), bytes32(uint256(6)), bytes32(type(uint256).max));
        _assertDepositRevert(
            address(_ingress),
            keccak256("compound-global"),
            1,
            abi.encodeWithSelector(
                ITask3BFinalCore.DepositCapExceeded.selector, _GLOBAL_CAP_KIND, _GLOBAL_CAP, _GLOBAL_CAP + 1
            )
        );
        assertTrue(vm.revertToState(snapshot), "compound global restore");

        vm.store(address(_core), bytes32(uint256(6)), bytes32(type(uint256).max));
        _assertDepositRevert(
            address(_ingress),
            keccak256("compound-counter"),
            1,
            abi.encodeWithSelector(ITask3BFinalCore.CoreCounterExhausted.selector, _ACCOUNTING_SEQUENCE_COUNTER)
        );
    }

    function test_task3B_27_reclassificationAdjacentPrecedenceIsExact() public {
        bytes32 details = keccak256("adjacent-reclassification");
        bytes memory callData = abi.encodeCall(ITask3BFinalCore.reclassifyUnattributed, (1, details));

        uint256 snapshot = vm.snapshotState();
        _authority.setModes(1, 0);
        vm.prank(address(0xBEEF));
        _assertRawRevert(callData, abi.encodeWithSelector(ITask3BFinalCore.CoreAuthoritySnapshotCallFailed.selector), 0);
        assertTrue(vm.revertToState(snapshot), "reclass snapshot restore");

        snapshot = vm.snapshotState();
        _authority.setSnapshotWord(0, 3);
        vm.prank(address(0xBEEF));
        _assertRawRevert(
            callData,
            abi.encodeWithSelector(ITask3BFinalCore.CoreAuthoritySnapshotSemanticMismatch.selector, uint8(0)),
            0
        );
        assertTrue(vm.revertToState(snapshot), "reclass semantics restore");

        vm.prank(address(0xBEEF));
        _assertRawRevert(
            abi.encodeCall(ITask3BFinalCore.reclassifyUnattributed, (0, bytes32(0))),
            abi.encodeWithSelector(ITask3BFinalCore.CoreUnauthorized.selector, address(0xBEEF)),
            0
        );
        _assertRawRevert(
            abi.encodeCall(ITask3BFinalCore.reclassifyUnattributed, (0, bytes32(0))),
            abi.encodeWithSelector(ITask3BFinalCore.CoreEmptyDetailsHash.selector),
            0
        );

        snapshot = vm.snapshotState();
        vm.store(address(_core), bytes32(uint256(1)), bytes32(uint256(1)));
        _assertRawRevert(
            abi.encodeCall(ITask3BFinalCore.reclassifyUnattributed, (0, details)),
            abi.encodeWithSelector(ITask3BFinalCore.InvalidAmount.selector),
            0
        );
        _assertRawRevert(
            callData, abi.encodeWithSelector(ITask3BFinalCore.BalanceDeficitActive.selector, uint256(1)), 0
        );
        assertTrue(vm.revertToState(snapshot), "reclass deficit restore");

        snapshot = vm.snapshotState();
        vm.store(address(_core), bytes32(uint256(4)), bytes32(uint256(1)));
        _assertRawRevert(
            callData, abi.encodeWithSelector(ITask3BFinalCore.ReconciliationShortfallActive.selector, uint256(1)), 0
        );
        assertTrue(vm.revertToState(snapshot), "reclass shortfall restore");

        snapshot = vm.snapshotState();
        vm.store(address(_core), bytes32(uint256(6)), bytes32(type(uint256).max));
        _assertRawRevert(
            callData,
            abi.encodeWithSelector(ITask3BFinalCore.InsufficientUnattributed.selector, uint256(0), uint256(1)),
            0
        );
        assertTrue(vm.revertToState(snapshot), "reclass insufficient restore");

        vm.store(address(_core), bytes32(uint256(2)), bytes32(uint256(1)));
        vm.store(address(_core), bytes32(uint256(6)), bytes32(type(uint256).max));
        vm.deal(address(_core), 1);
        _assertRawRevert(
            callData,
            abi.encodeWithSelector(ITask3BFinalCore.CoreCounterExhausted.selector, _ACCOUNTING_SEQUENCE_COUNTER),
            0
        );
    }

    function test_task3B_28_attemptedTotalOverflowPanicsAndRollsBackEveryTouchedRoot() public {
        Task3BFactoryHarness factory = new Task3BFactoryHarness();
        Task3BCodeStub registry = new Task3BCodeStub();
        Task3BAuthorityOracle authority =
            Task3BAuthorityOracle(factory.deploy(type(Task3BAuthorityOracle).creationCode));
        address coreAddress = _predictCreateAddress(address(factory), 2);
        address budget = _predictCreateAddress(address(factory), 3);
        address intent = _predictCreateAddress(address(factory), 4);
        address reconciliation = _predictCreateAddress(address(factory), 5);
        bytes32 manifest = keccak256("attempted-total-overflow-manifest");
        bytes memory initcode = abi.encodePacked(
            type(AcquisitionVaultCore).creationCode,
            abi.encode(
                address(factory),
                manifest,
                address(authority),
                address(registry),
                budget,
                intent,
                reconciliation,
                type(uint256).max
            )
        );
        assertEq(factory.deploy(initcode), coreAddress, "max-cap Core CREATE");
        ITask3BFinalCore core = ITask3BFinalCore(coreAddress);
        authority.configureTopology(
            address(factory), manifest, address(registry), coreAddress, budget, intent, reconciliation, address(this)
        );
        factory.finalize(coreAddress, manifest);

        Task3BIngress ingress = new Task3BIngress();
        bytes32 configHash = _configHashFor(
            coreAddress,
            address(authority),
            address(ingress),
            address(ingress).codehash,
            type(uint256).max,
            type(uint256).max,
            type(uint256).max
        );
        authority.configureIngress(
            1,
            address(ingress),
            address(ingress).codehash,
            type(uint256).max,
            type(uint256).max,
            type(uint256).max,
            uint64(block.timestamp),
            0,
            configHash
        );
        uint256 epochDay = block.timestamp / _EPOCH_DAY;
        bytes32 epochOuter = keccak256(abi.encode(uint256(1), uint256(10)));
        vm.store(coreAddress, keccak256(abi.encode(epochDay, epochOuter)), bytes32(type(uint256).max - 1));
        bytes32 source = keccak256("attempted-total-overflow");
        bytes32 candidate = keccak256(
            abi.encode(
                _CANONICAL_DEPOSIT_TAG,
                _CHAIN_ID,
                coreAddress,
                coreAddress,
                uint256(1),
                source,
                address(authority),
                address(ingress),
                configHash
            )
        );
        bytes32 digest = _coreRollbackDigest(coreAddress, candidate, 1, epochDay);
        uint256 callerBalance = address(this).balance;
        vm.recordLogs();
        vm.expectRevert(stdError.arithmeticError);
        ingress.deposit{value: 2}(coreAddress, source);
        assertEq(_coreRollbackDigest(coreAddress, candidate, 1, epochDay), digest, "overflow rollback digest");
        assertEq(address(this).balance, callerBalance, "overflow incoming value refund");
        assertEq(vm.getRecordedLogs().length, 0, "overflow log rollback");
        assertEq(core.ingressEpochDepositedWei(1, epochDay), type(uint256).max - 1, "overflow prior preserved");
    }

    function test_task3B_29_successfulDepositUsesFrozenBusinessStorageWriteOrder() public {
        bytes32 source = keccak256("frozen-deposit-write-order");
        bytes32 configHash = _configHash(_ingress, 10 ether, 20 ether, 40 ether);
        bytes32 depositId = _depositId(1, source, _ingress, configHash);
        uint256 epochDay = block.timestamp / _EPOCH_DAY;
        bytes32 generationSlot = keccak256(abi.encode(uint256(1), uint256(9)));
        bytes32 epochOuter = keccak256(abi.encode(uint256(1), uint256(10)));
        bytes32 epochSlot = keccak256(abi.encode(epochDay, epochOuter));
        bytes32 recordBase = keccak256(abi.encode(depositId, uint256(11)));

        vm.record();
        assertEq(_ingress.deposit{value: 2 ether}(address(_core), source), depositId, "ordered deposit ID");
        (, bytes32[] memory writes) = vm.accesses(address(_core));

        bytes32[] memory businessWrites = new bytes32[](writes.length);
        uint256 businessWriteCount;
        uint256 guardWriteCount;
        for (uint256 i; i < writes.length; ++i) {
            if (writes[i] == _REENTRANCY_GUARD_STORAGE) {
                ++guardWriteCount;
                continue;
            }
            businessWrites[businessWriteCount++] = writes[i];
        }

        assertEq(guardWriteCount, 2, "guard entry and exit writes");
        assertEq(businessWriteCount, 16, "exact business write count");
        assertEq(businessWrites[0], bytes32(uint256(1)), "first business write available");
        assertEq(businessWrites[1], bytes32(uint256(6)), "second business write sequence");
        assertEq(businessWrites[2], epochSlot, "third business write epoch total");
        assertEq(businessWrites[3], generationSlot, "fourth business write generation total");
        assertEq(businessWrites[4], bytes32(uint256(8)), "fifth business write global total");
        for (uint256 i; i < 10; ++i) {
            assertEq(
                businessWrites[5 + i],
                bytes32(uint256(recordBase) + i),
                string.concat("DepositRecord write ", vm.toString(i))
            );
        }
        assertEq(businessWrites[15], bytes32(uint256(7)), "last business write deficit observation");
    }

    function test_task3B_30_sequenceExhaustionPrecedesInvalidPreTotalsAndFullyRollsBack() public {
        vm.store(address(_core), bytes32(uint256(4)), bytes32(0));
        vm.store(address(_core), bytes32(uint256(5)), bytes32(uint256(1)));
        vm.store(address(_core), bytes32(uint256(6)), bytes32(type(uint256).max));

        bytes32 source = keccak256("sequence-before-invalid-pre-totals");
        bytes32 configHash = _configHash(_ingress, 10 ether, 20 ether, 40 ether);
        bytes32 depositId = _depositId(1, source, _ingress, configHash);
        uint256 epochDay = block.timestamp / _EPOCH_DAY;
        bytes32 digest = _stateDigest(depositId);
        uint256 callerBalance = address(this).balance;

        vm.recordLogs();
        vm.expectRevert(
            abi.encodeWithSelector(ITask3BFinalCore.CoreCounterExhausted.selector, _ACCOUNTING_SEQUENCE_COUNTER)
        );
        _ingress.deposit{value: 1}(address(_core), source);

        assertEq(_stateDigest(depositId), digest, "sequence precedence full raw rollback");
        assertEq(address(this).balance, callerBalance, "sequence precedence incoming value refund");
        assertEq(vm.getRecordedLogs().length, 0, "sequence precedence log rollback");
        assertEq(_core.ingressEpochDepositedWei(1, epochDay), 0, "sequence precedence epoch untouched");
        assertEq(_core.ingressLifetimeDepositedWei(1), 0, "sequence precedence lifetime untouched");
        assertEq(_core.globalLifetimeCanonicalDepositedWei(), 0, "sequence precedence global untouched");
        bytes32 recordBase = keccak256(abi.encode(depositId, uint256(11)));
        for (uint256 i; i < 10; ++i) {
            assertEq(
                vm.load(address(_core), _offset(recordBase, i)), bytes32(0), "sequence precedence record untouched"
            );
        }
    }

    function _configureIngress(
        uint256 generation,
        Task3BIngress ingress,
        uint256 perDepositCapWei,
        uint256 epochCapWei,
        uint256 lifetimeCapWei
    ) private {
        bytes32 configHash = _configHash(ingress, perDepositCapWei, epochCapWei, lifetimeCapWei);
        _authority.configureIngress(
            generation,
            address(ingress),
            address(ingress).codehash,
            perDepositCapWei,
            epochCapWei,
            lifetimeCapWei,
            uint64(block.timestamp),
            0,
            configHash
        );
    }

    function _configureIngressAddress(
        uint256 generation,
        address ingress,
        bytes32 runtimeCodeHash,
        uint256 perDepositCapWei,
        uint256 epochCapWei,
        uint256 lifetimeCapWei
    ) private {
        bytes32 configHash = _configHashFor(
            address(_core), address(_authority), ingress, runtimeCodeHash, perDepositCapWei, epochCapWei, lifetimeCapWei
        );
        _authority.configureIngress(
            generation,
            ingress,
            runtimeCodeHash,
            perDepositCapWei,
            epochCapWei,
            lifetimeCapWei,
            uint64(block.timestamp),
            0,
            configHash
        );
    }

    function _calibrateOracleGas() private {
        _authority.setModes(8, 0);
        (bool snapshotOk, bytes memory snapshotData) =
            address(_authority).staticcall{gas: 160_000}(abi.encodeWithSignature("authoritySnapshot()"));
        assertTrue(snapshotOk, "snapshot calibration call");
        assertEq(snapshotData.length, 864, "snapshot calibration length");
        uint256 snapshotEntryGas = _word(snapshotData, 14);

        _authority.setModes(0, 8);
        (bool ingressOk, bytes memory ingressData) =
            address(_authority).staticcall{gas: 100_000}(abi.encodeWithSignature("getIngress(uint256)", uint256(1)));
        assertTrue(ingressOk, "ingress calibration call");
        assertEq(ingressData.length, 256, "ingress calibration length");
        uint256 ingressEntryGas = _word(ingressData, 7);
        _authority.setExpectedEntryGas(snapshotEntryGas, ingressEntryGas);
        _authority.setModes(0, 0);
    }

    function _word(bytes memory data, uint256 index) private pure returns (uint256 value) {
        require(data.length >= (index + 1) * 32, "word bounds");
        assembly ("memory-safe") {
            value := mload(add(add(data, 0x20), mul(index, 0x20)))
        }
    }

    function _configHash(Task3BIngress ingress, uint256 perDepositCapWei, uint256 epochCapWei, uint256 lifetimeCapWei)
        private
        view
        returns (bytes32)
    {
        return _configHashWithRuntime(ingress, address(ingress).codehash, perDepositCapWei, epochCapWei, lifetimeCapWei);
    }

    function _configHashWithRuntime(
        Task3BIngress ingress,
        bytes32 runtimeCodeHash,
        uint256 perDepositCapWei,
        uint256 epochCapWei,
        uint256 lifetimeCapWei
    ) private view returns (bytes32) {
        return _configHashFor(
            address(_core),
            address(_authority),
            address(ingress),
            runtimeCodeHash,
            perDepositCapWei,
            epochCapWei,
            lifetimeCapWei
        );
    }

    function _configHashFor(
        address core,
        address authority,
        address ingress,
        bytes32 runtimeCodeHash,
        uint256 perDepositCapWei,
        uint256 epochCapWei,
        uint256 lifetimeCapWei
    ) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                _INGRESS_CONFIG_TAG,
                _CHAIN_ID,
                core,
                authority,
                ingress,
                runtimeCodeHash,
                perDepositCapWei,
                epochCapWei,
                lifetimeCapWei
            )
        );
    }

    function _depositId(uint256 generation, bytes32 sourceEventId, Task3BIngress ingress, bytes32 configHash)
        private
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                _CANONICAL_DEPOSIT_TAG,
                _CHAIN_ID,
                address(_core),
                address(_core),
                generation,
                sourceEventId,
                address(_authority),
                address(ingress),
                configHash
            )
        );
    }

    function _mutationId(uint256 generation, uint256 sequence, uint8 kind, bytes32 subjectId)
        private
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                _ACCOUNTING_MUTATION_TAG,
                _CHAIN_ID,
                address(_core),
                address(_core),
                generation,
                sequence,
                kind,
                subjectId
            )
        );
    }

    function _componentId(
        uint256 generation,
        uint256 sequence,
        bytes32 mutationId,
        uint256 componentIndex,
        uint8 kind,
        bytes32 subjectId,
        uint256 amountWei
    ) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                _ACCOUNTING_COMPONENT_TAG,
                _CHAIN_ID,
                address(_core),
                address(_core),
                generation,
                sequence,
                mutationId,
                componentIndex,
                kind,
                subjectId,
                amountWei
            )
        );
    }

    function _zeroTotals(uint256 actualBalance) private pure returns (ITask3BFinalCore.AccountingTotals memory totals) {
        totals.actualBalanceWei = actualBalance;
        totals.forcedSurplusWei = actualBalance;
    }

    function _totals(
        uint256 available,
        uint256 unattributed,
        uint256 reserved,
        uint256 liability,
        uint256 backing,
        uint256 actualBalance,
        uint256 sequence
    ) private pure returns (ITask3BFinalCore.AccountingTotals memory totals) {
        totals.availableWei = available;
        totals.unattributedWei = unattributed;
        totals.ordinaryReservedWei = reserved;
        totals.reconciliationLiabilityWei = liability;
        totals.reconciliationBackingWei = backing;
        totals.reconciliationShortfallWei = liability - backing;
        totals.accountedBackingWei = available + unattributed + reserved + backing;
        totals.actualBalanceWei = actualBalance;
        totals.balanceDeficitWei =
            totals.accountedBackingWei > actualBalance ? totals.accountedBackingWei - actualBalance : 0;
        totals.forcedSurplusWei =
            actualBalance > totals.accountedBackingWei ? actualBalance - totals.accountedBackingWei : 0;
        totals.accountingSequence = sequence;
    }

    function _assertTotals(
        ITask3BFinalCore.AccountingTotals memory actual,
        ITask3BFinalCore.AccountingTotals memory expected
    ) private pure {
        assertEq(keccak256(abi.encode(actual)), keccak256(abi.encode(expected)), "accounting totals");
    }

    function _assertMutationLog(
        Vm.Log memory entry,
        uint256 sequence,
        bytes32 mutationId,
        uint8 mutationKind,
        ITask3BFinalCore.AccountingTotals memory preTotals,
        ITask3BFinalCore.AccountingTotals memory postTotals,
        uint256 componentCount
    ) private view {
        assertEq(entry.emitter, address(_core), "event emitter");
        assertEq(entry.topics.length, 4, "mutation topic arity");
        assertEq(entry.topics[0], _ACCOUNTING_MUTATION_TOPIC, "event topic");
        assertEq(entry.topics[1], bytes32(sequence), "event sequence");
        assertEq(entry.topics[2], mutationId, "event ID");
        assertEq(entry.topics[3], bytes32(uint256(mutationKind)), "mutation kind topic");
        (
            ITask3BFinalCore.AccountingTotals memory actualPre,
            ITask3BFinalCore.AccountingTotals memory actualPost,
            uint256 actualComponentCount
        ) = abi.decode(entry.data, (ITask3BFinalCore.AccountingTotals, ITask3BFinalCore.AccountingTotals, uint256));
        _assertTotals(actualPre, preTotals);
        _assertTotals(actualPost, postTotals);
        assertEq(actualComponentCount, componentCount, "mutation component count");
    }

    function _assertComponentLog(
        Vm.Log memory entry,
        uint256 sequence,
        uint256 index,
        bytes32 componentId,
        uint8 kind,
        bytes32 subject,
        uint256 amount
    ) private view {
        assertEq(entry.emitter, address(_core), "component emitter");
        assertEq(entry.topics[0], _ACCOUNTING_COMPONENT_TOPIC, "component topic");
        assertEq(entry.topics[1], bytes32(sequence), "component sequence");
        assertEq(entry.topics[2], bytes32(index), "component index");
        assertEq(entry.topics[3], componentId, "component ID");
        (uint8 actualKind, bytes32 actualSubject, uint256 actualAmount) =
            abi.decode(entry.data, (uint8, bytes32, uint256));
        assertEq(actualKind, kind, "component kind");
        assertEq(actualSubject, subject, "component subject");
        assertEq(actualAmount, amount, "component amount");
    }

    function _assertCanonicalDepositLog(
        Vm.Log memory entry,
        bytes32 depositId,
        uint256 generation,
        bytes32 sourceEventId,
        address ingress,
        uint256 amount,
        uint256 repair,
        uint256 credit,
        uint256 sequence
    ) private view {
        assertEq(entry.emitter, address(_core), "deposit emitter");
        assertEq(entry.topics.length, 4, "deposit topic arity");
        assertEq(entry.topics[0], _CANONICAL_DEPOSIT_TOPIC, "deposit topic");
        assertEq(entry.topics[1], depositId, "deposit ID topic");
        assertEq(entry.topics[2], bytes32(generation), "deposit generation topic");
        assertEq(entry.topics[3], sourceEventId, "deposit source topic");
        (
            address actualIngress,
            uint256 actualAmount,
            uint256 actualRepair,
            uint256 actualCredit,
            uint256 epochDay,
            uint256 actualSequence,
            uint64 depositedAt
        ) = abi.decode(entry.data, (address, uint256, uint256, uint256, uint256, uint256, uint64));
        assertEq(actualIngress, ingress, "deposit ingress");
        assertEq(actualAmount, amount, "deposit amount");
        assertEq(actualRepair, repair, "deposit repair");
        assertEq(actualCredit, credit, "deposit credit");
        assertEq(epochDay, block.timestamp / _EPOCH_DAY, "deposit epoch day");
        assertEq(actualSequence, sequence, "deposit sequence");
        assertEq(depositedAt, uint64(block.timestamp), "deposit timestamp");
    }

    function _assertRawRevert(bytes memory callData, bytes memory expected, uint256 value) private {
        (bool ok, bytes memory data) = address(_core).call{value: value}(callData);
        assertFalse(ok, "expected Core revert");
        assertEq(data, expected, "Core revert payload");
    }

    function _assertSnapshotSemanticBoth(bytes memory reclassCallData, uint8 field) private {
        bytes memory expected =
            abi.encodeWithSelector(ITask3BFinalCore.CoreAuthoritySnapshotSemanticMismatch.selector, field);
        bytes32 digest = _stateDigest(bytes32(0));
        vm.recordLogs();
        _assertRawRevert(reclassCallData, expected, 0);
        assertEq(_stateDigest(bytes32(0)), digest, "snapshot semantic reclass rollback");
        assertEq(vm.getRecordedLogs().length, 0, "snapshot semantic reclass logs");
        bytes32 source = keccak256(abi.encode("snapshot-semantic-deposit", field));
        bytes32 candidate = _depositId(1, source, _ingress, _configHash(_ingress, 10 ether, 20 ether, 40 ether));
        bytes32 depositDigest = _stateDigest(candidate);
        _assertDepositRevert(address(_ingress), source, 1, expected);
        assertEq(_stateDigest(candidate), depositDigest, "snapshot semantic deposit rollback");
    }

    function _assertDepositRevert(address caller, bytes32 sourceEventId, uint256 value, bytes memory expected) private {
        vm.deal(caller, caller.balance + value);
        uint256 callerBalance = caller.balance;
        vm.recordLogs();
        vm.prank(caller);
        (bool ok, bytes memory data) =
            address(_core).call{value: value}(abi.encodeCall(ITask3BFinalCore.depositCanonical, (sourceEventId)));
        assertFalse(ok, "expected deposit revert");
        assertEq(data, expected, "deposit revert payload");
        assertEq(caller.balance, callerBalance, "deposit revert value refund");
        assertEq(vm.getRecordedLogs().length, 0, "deposit revert log rollback");
    }

    function _stateDigest(bytes32 depositId) private view returns (bytes32) {
        bytes32[12] memory slots;
        for (uint256 i; i < slots.length; ++i) {
            slots[i] = vm.load(address(_core), bytes32(i));
        }
        bytes32[2] memory ingressLifetimeLeaves;
        bytes32[2] memory ingressEpochLeaves;
        uint256 epochDay = block.timestamp / _EPOCH_DAY;
        for (uint256 generation = 1; generation <= 2; ++generation) {
            ingressLifetimeLeaves[generation - 1] =
                vm.load(address(_core), keccak256(abi.encode(generation, uint256(9))));
            bytes32 outer = keccak256(abi.encode(generation, uint256(10)));
            ingressEpochLeaves[generation - 1] = vm.load(address(_core), keccak256(abi.encode(epochDay, outer)));
        }
        bytes32 recordBase = keccak256(abi.encode(depositId, uint256(11)));
        bytes32[10] memory recordSlots;
        for (uint256 i; i < recordSlots.length; ++i) {
            recordSlots[i] = vm.load(address(_core), _offset(recordBase, i));
        }
        return
            keccak256(abi.encode(address(_core).balance, slots, ingressLifetimeLeaves, ingressEpochLeaves, recordSlots));
    }

    function _offset(bytes32 base, uint256 amount) private pure returns (bytes32) {
        return bytes32(uint256(base) + amount);
    }

    function _coreLinearDigest(address core) private view returns (bytes32) {
        bytes32[12] memory slots;
        for (uint256 i; i < slots.length; ++i) {
            slots[i] = vm.load(core, bytes32(i));
        }
        return keccak256(abi.encode(core.balance, slots));
    }

    function _coreRollbackDigest(address core, bytes32 depositId, uint256 generation, uint256 epochDay)
        private
        view
        returns (bytes32)
    {
        bytes32[9] memory linear;
        for (uint256 i; i < linear.length; ++i) {
            linear[i] = vm.load(core, bytes32(i));
        }
        bytes32 lifetime = vm.load(core, keccak256(abi.encode(generation, uint256(9))));
        bytes32 epochOuter = keccak256(abi.encode(generation, uint256(10)));
        bytes32 epoch = vm.load(core, keccak256(abi.encode(epochDay, epochOuter)));
        bytes32 recordBase = keccak256(abi.encode(depositId, uint256(11)));
        bytes32[10] memory record;
        for (uint256 i; i < record.length; ++i) {
            record[i] = vm.load(core, _offset(recordBase, i));
        }
        return keccak256(abi.encode(core.balance, linear, lifetime, epoch, record));
    }

    function _activateRegistryToken(
        StockTokenRegistryV2 registry_,
        Task3BTestToken token,
        string memory ticker,
        bytes32 providerId
    ) private returns (bytes32 versionKey) {
        uint64 approvedAt = uint64(block.timestamp);
        versionKey = registry_.activateVersion(
            IStockTokenRegistryV2.Activation({
                token: address(token),
                robinhoodAssetIdHash: providerId,
                ticker: ticker,
                name: string.concat(ticker, " Token"),
                tokenDecimals: 18,
                evidenceHash: keccak256(abi.encode("evidence", ticker)),
                reviewId: keccak256(abi.encode("review", ticker)),
                approvedAt: approvedAt,
                validUntil: approvedAt + 7 days
            })
        );
    }

    function _activateProductionIngress(
        AcquisitionAuthority authority_,
        address ingress,
        uint256 perDepositCapWei,
        uint256 epochCapWei,
        uint256 lifetimeCapWei
    ) private returns (uint256 generation) {
        IAcquisitionAuthorityV2.IngressConfig memory config =
            IAcquisitionAuthorityV2.IngressConfig({
                ingress: ingress,
                runtimeCodeHash: ingress.codehash,
                perDepositCapWei: perDepositCapWei,
                epochDepositCapWei: epochCapWei,
                lifetimeDepositCapWei: lifetimeCapWei
            });
        bytes32 proposalId = authority_.proposeIngress(config, keccak256(abi.encode("production-ingress", ingress)));
        IAcquisitionAuthorityV2.PendingIngressProposal memory pending = authority_.pendingIngressProposal();
        assertEq(pending.proposalId, proposalId, "production pending ingress");
        vm.warp(pending.validAfter);
        generation = authority_.activateIngress(proposalId);
    }

    function _recordTokens(Task3BTestToken, Task3BTestToken, Task3BTestToken) private {
        vm.record();
    }

    function _assertNoTokenStorageAccess(Task3BTestToken token, string memory branch) private {
        (bytes32[] memory reads, bytes32[] memory writes) = vm.accesses(address(token));
        assertEq(reads.length, 0, string.concat(branch, " storage reads"));
        assertEq(writes.length, 0, string.concat(branch, " storage writes"));
    }

    function _assertNoTokenEmitter(
        Vm.Log[] memory logs,
        Task3BTestToken activeToken,
        Task3BTestToken historicalToken,
        Task3BTestToken unknownToken
    ) private pure {
        for (uint256 i; i < logs.length; ++i) {
            address emitter = logs[i].emitter;
            assertTrue(
                emitter != address(activeToken) && emitter != address(historicalToken)
                    && emitter != address(unknownToken),
                "Core path emitted token event"
            );
        }
    }

    function _deployProductionFixture(StockTokenRegistryV2 registry_, uint256 cap)
        private
        returns (ProductionFixture memory f)
    {
        address predictedFactory = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        ProductionBundle memory bundle = _productionBundle(predictedFactory, registry_, cap);
        f.factory = new AcquisitionConstellationFactory(
            address(this),
            address(registry_),
            address(registry_).codehash,
            cap,
            bundle.initcodeHashes,
            bundle.runtimeHashes
        );
        assertEq(address(f.factory), predictedFactory, "production Factory prediction");
        for (uint8 i; i < 5; ++i) {
            assertEq(f.factory.deployNext(bundle.initcodes[i]), bundle.children[i], "production child CREATE order");
        }
        ITask3BFinalCore productionCore = ITask3BFinalCore(bundle.children[1]);
        assertEq(productionCore.stockTokenRegistryV2(), address(registry_), "pre-final production Registry getter");
        f.factory.finalizeConstellation();
        assertEq(productionCore.stockTokenRegistryV2(), address(registry_), "post-final production Registry getter");
        f.authority = AcquisitionAuthority(bundle.children[0]);
        f.core = productionCore;
        f.registry = registry_;
        f.children = bundle.children;
        f.manifest = bundle.manifest;
    }

    function _productionBundle(address predictedFactory, StockTokenRegistryV2 registry_, uint256 cap)
        private
        returns (ProductionBundle memory bundle)
    {
        bundle.predictedFactory = predictedFactory;
        for (uint8 i; i < 5; ++i) {
            bundle.children[i] = vm.computeCreateAddress(predictedFactory, uint256(i) + 1);
        }
        bundle.configurationRoot =
            keccak256(abi.encode(_TASK3_CONFIG_TAG, uint256(3), address(registry_), address(registry_).codehash, cap));
        bundle.manifest = keccak256(
            abi.encode(
                _CONSTELLATION_TAG,
                _CHAIN_ID,
                predictedFactory,
                address(this),
                bundle.configurationRoot,
                address(registry_),
                address(registry_).codehash,
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
                address(registry_),
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
                address(registry_),
                bundle.children[2],
                bundle.children[3],
                bundle.children[4],
                cap
            )
        );
        bundle.initcodes[2] = abi.encodePacked(
            type(PreVoteBudgetBook).creationCode,
            abi.encode(predictedFactory, bundle.manifest, bundle.children[0], bundle.children[1], address(registry_))
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
        vm.etch(predictedFactory, type(Task3BRawCreateDispatcher).runtimeCode);
        vm.setNonce(predictedFactory, 1);
        for (uint8 i; i < 5; ++i) {
            address child = Task3BRawCreateDispatcher(predictedFactory).deploy(bundle.initcodes[i]);
            assertEq(child, bundle.children[i], "shadow CREATE order");
            bundle.runtimeHashes[i] = child.codehash;
        }
        assertTrue(vm.revertToState(clean), "shadow production deployment restore");
    }

    function _predictCreateAddress(address deployer, uint8 nonce) private pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", deployer, nonce)))));
    }

    function _assertExactCoreStorageLayout(bytes memory json) private pure {
        uint256 layoutLabel = _find(json, bytes('"storageLayout":{'), 0);
        require(
            layoutLabel != type(uint256).max, "Core storageLayout missing; compile with --extra-output storageLayout"
        );
        uint256 layoutOpening = _find(json, bytes("{"), layoutLabel);
        uint256 layoutClosing = _matchingDelimiter(json, layoutOpening, bytes1("{"), bytes1("}"));
        (uint256 storageOpening, uint256 storageClosing) =
            _jsonArrayRange(json, layoutOpening, layoutClosing, "storage");
        assertEq(_topLevelObjectCount(json, storageOpening, storageClosing), 12, "Core storage cardinality/root 12");
        (uint256 typesOpening, uint256 typesClosing) = _jsonObjectRange(json, layoutOpening, layoutClosing, "types");

        uint256 cursor = storageOpening + 1;
        string memory depositMappingType;
        for (uint256 i; i < 12; ++i) {
            uint256 rowOpening = _find(json, bytes("{"), cursor);
            require(rowOpening < storageClosing, "Core storage row missing");
            uint256 rowClosing = _matchingDelimiter(json, rowOpening, bytes1("{"), bytes1("}"));
            string memory typeId = _assertCoreStorageRow(json, rowOpening, rowClosing, typesOpening, typesClosing, i);
            if (i == 11) depositMappingType = typeId;
            cursor = rowClosing + 1;
        }
        _assertDepositRecordStorage(json, typesOpening, typesClosing, depositMappingType);
    }

    function _assertOptimizedIrHasNoReturndataCopy(bytes memory json) private pure {
        bytes memory label = bytes('"irOptimized":"');
        uint256 found = _find(json, label, 0);
        require(found != type(uint256).max, "Core irOptimized missing; compile with --extra-output irOptimized");
        uint256 start = found + label.length;
        uint256 end = start;
        bool escaped;
        while (end < json.length) {
            bytes1 character = json[end];
            if (escaped) escaped = false;
            else if (character == "\\") escaped = true;
            else if (character == '"') break;
            ++end;
        }
        require(end < json.length, "Core irOptimized unterminated");
        assertFalse(
            _containsAsciiCaseInsensitive(json, start, end, bytes("returndatacopy")),
            "Core optimized IR contains dynamic returndata copy"
        );
    }

    function _assertCoreStorageRow(
        bytes memory json,
        uint256 rowOpening,
        uint256 rowClosing,
        uint256 typesOpening,
        uint256 typesClosing,
        uint256 index
    ) private pure returns (string memory typeId) {
        string[12] memory labels = [
            "_finalized",
            "availableWei",
            "unattributedWei",
            "ordinaryReservedWei",
            "reconciliationLiabilityWei",
            "reconciliationBackingWei",
            "accountingSequence",
            "lastObservedBalanceDeficitWei",
            "globalLifetimeCanonicalDepositedWei",
            "ingressLifetimeDepositedWei",
            "ingressEpochDepositedWei",
            "_depositRecords"
        ];
        string[12] memory typeLabels = [
            "bool",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "mapping(uint256 => uint256)",
            "mapping(uint256 => mapping(uint256 => uint256))",
            "mapping(bytes32 => struct AcquisitionVaultCore.DepositRecord)"
        ];
        string[12] memory slots = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
        assertEq(_jsonString(json, rowOpening, rowClosing, "label"), labels[index], "Core storage label/order");
        assertEq(_jsonString(json, rowOpening, rowClosing, "slot"), slots[index], "Core storage slot");
        assertEq(_jsonUint(json, rowOpening, rowClosing, "offset"), 0, "Core storage offset");
        typeId = _jsonString(json, rowOpening, rowClosing, "type");
        (uint256 typeOpening, uint256 typeClosing) = _jsonNamedObjectRange(json, typesOpening, typesClosing, typeId);
        assertEq(_jsonString(json, typeOpening, typeClosing, "label"), typeLabels[index], "Core storage type");
        assertEq(_jsonString(json, typeOpening, typeClosing, "encoding"), index < 9 ? "inplace" : "mapping", "encoding");
        assertEq(_jsonString(json, typeOpening, typeClosing, "numberOfBytes"), index == 0 ? "1" : "32", "bytes");
    }

    function _assertDepositRecordStorage(
        bytes memory json,
        uint256 typesOpening,
        uint256 typesClosing,
        string memory mappingTypeId
    ) private pure {
        (uint256 mappingOpening, uint256 mappingClosing) =
            _jsonNamedObjectRange(json, typesOpening, typesClosing, mappingTypeId);
        string memory recordTypeId = _jsonString(json, mappingOpening, mappingClosing, "value");
        (uint256 recordOpening, uint256 recordClosing) =
            _jsonNamedObjectRange(json, typesOpening, typesClosing, recordTypeId);
        assertEq(
            _jsonString(json, recordOpening, recordClosing, "label"),
            "struct AcquisitionVaultCore.DepositRecord",
            "DepositRecord storage label"
        );
        assertEq(_jsonString(json, recordOpening, recordClosing, "encoding"), "inplace", "DepositRecord encoding");
        assertEq(_jsonString(json, recordOpening, recordClosing, "numberOfBytes"), "320", "DepositRecord bytes");
        (uint256 membersOpening, uint256 membersClosing) =
            _jsonArrayRange(json, recordOpening, recordClosing, "members");
        assertEq(_topLevelObjectCount(json, membersOpening, membersClosing), 10, "DepositRecord member cardinality");
        uint256 cursor = membersOpening + 1;
        for (uint256 i; i < 10; ++i) {
            uint256 memberOpening = _find(json, bytes("{"), cursor);
            require(memberOpening < membersClosing, "DepositRecord member missing");
            uint256 memberClosing = _matchingDelimiter(json, memberOpening, bytes1("{"), bytes1("}"));
            _assertDepositRecordMember(json, memberOpening, memberClosing, typesOpening, typesClosing, i);
            cursor = memberClosing + 1;
        }
    }

    function _assertDepositRecordMember(
        bytes memory json,
        uint256 memberOpening,
        uint256 memberClosing,
        uint256 typesOpening,
        uint256 typesClosing,
        uint256 index
    ) private pure {
        string[10] memory labels = [
            "depositId",
            "ingressGeneration",
            "ingress",
            "sourceEventId",
            "amountWei",
            "balanceDeficitRepairWei",
            "availableCreditWei",
            "epochDay",
            "accountingSequence",
            "depositedAt"
        ];
        string[10] memory typeLabels = [
            "bytes32", "uint256", "address", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint64"
        ];
        string[10] memory slots = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
        assertEq(_jsonString(json, memberOpening, memberClosing, "label"), labels[index], "DepositRecord member label");
        assertEq(_jsonString(json, memberOpening, memberClosing, "slot"), slots[index], "DepositRecord member slot");
        assertEq(_jsonUint(json, memberOpening, memberClosing, "offset"), 0, "DepositRecord member offset");
        string memory typeId = _jsonString(json, memberOpening, memberClosing, "type");
        (uint256 typeOpening, uint256 typeClosing) = _jsonNamedObjectRange(json, typesOpening, typesClosing, typeId);
        assertEq(_jsonString(json, typeOpening, typeClosing, "label"), typeLabels[index], "DepositRecord member type");
    }

    function _coreArtifactAbi() private returns (bytes memory json, uint256 opening, uint256 closing) {
        string memory artifactPath = vm.getArtifactPathByCode(type(AcquisitionVaultCore).creationCode);
        json = bytes(vm.readFile(artifactPath));
        uint256 abiLabel = _find(json, bytes('"abi":['), 0);
        assertNotEq(abiLabel, type(uint256).max, "Core artifact ABI missing");
        opening = _find(json, bytes("["), abiLabel);
        closing = _matchingDelimiter(json, opening, bytes1("["), bytes1("]"));
    }

    function _assertDeepConstructorAbiNames(bytes memory json, uint256 opening, uint256 closing) private pure {
        string[8] memory constructorNames = [
            "factory",
            "manifestHash",
            "authority",
            "registry",
            "budgetBook",
            "intentExecution",
            "reconciliation",
            "globalLifetimeCanonicalDepositCapWei"
        ];
        (uint256 objectOpening, uint256 objectClosing) = _findAbiObject(json, opening, closing, "constructor", "");
        (uint256 arrayOpening, uint256 arrayClosing) = _jsonArrayRange(json, objectOpening, objectClosing, "inputs");
        assertEq(_topLevelObjectCount(json, arrayOpening, arrayClosing), constructorNames.length, "constructor names");
        for (uint256 i; i < constructorNames.length; ++i) {
            (uint256 parameterOpening, uint256 parameterClosing) =
                _topLevelObjectAt(json, arrayOpening, arrayClosing, i);
            assertEq(
                _jsonString(json, parameterOpening, parameterClosing, "name"),
                constructorNames[i],
                "constructor input name"
            );
        }
    }

    function _assertDeepFunctionAbiNames(bytes memory json, uint256 opening, uint256 closing) private pure {
        string[18] memory snapshotNames = [
            "schemaVersion",
            "factory",
            "manifestHash",
            "authority",
            "registry",
            "budgetBook",
            "intentExecution",
            "reconciliation",
            "finalized",
            "globalLifetimeCanonicalDepositCapWei",
            "availableWei",
            "unattributedWei",
            "ordinaryReservedWei",
            "reconciliationLiabilityWei",
            "reconciliationBackingWei",
            "accountingSequence",
            "lastObservedBalanceDeficitWei",
            "globalLifetimeCanonicalDepositedWei"
        ];
        (uint256 objectOpening, uint256 objectClosing) =
            _findAbiObject(json, opening, closing, "function", "coreSnapshot");
        (uint256 arrayOpening, uint256 arrayClosing) = _jsonArrayRange(json, objectOpening, objectClosing, "outputs");
        assertEq(_topLevelObjectCount(json, arrayOpening, arrayClosing), snapshotNames.length, "snapshot output names");
        for (uint256 i; i < snapshotNames.length; ++i) {
            (uint256 parameterOpening, uint256 parameterClosing) =
                _topLevelObjectAt(json, arrayOpening, arrayClosing, i);
            assertEq(
                _jsonString(json, parameterOpening, parameterClosing, "name"), snapshotNames[i], "snapshot output name"
            );
        }

        string[11] memory totalsNames = [
            "availableWei",
            "unattributedWei",
            "ordinaryReservedWei",
            "reconciliationLiabilityWei",
            "reconciliationBackingWei",
            "reconciliationShortfallWei",
            "accountedBackingWei",
            "actualBalanceWei",
            "balanceDeficitWei",
            "forcedSurplusWei",
            "accountingSequence"
        ];
        string[11] memory totalsTypes = [
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256"
        ];
        _assertTupleAbiNames(json, opening, closing, "accountingTotals", totalsNames, totalsTypes);

        string[10] memory depositNames = [
            "depositId",
            "ingressGeneration",
            "ingress",
            "sourceEventId",
            "amountWei",
            "balanceDeficitRepairWei",
            "availableCreditWei",
            "epochDay",
            "accountingSequence",
            "depositedAt"
        ];
        string[10] memory depositTypes = [
            "bytes32", "uint256", "address", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint64"
        ];
        _assertTupleAbiNames(json, opening, closing, "getDeposit", depositNames, depositTypes);
    }

    function _assertExactCoreAbi(bytes memory json, uint256 opening, uint256 closing) private pure {
        _assertAbiKindRows(json, opening, closing, "function", _expectedFunctionRows());
        _assertAbiKindRows(json, opening, closing, "error", _expectedErrorRows());
        _assertAbiKindRows(json, opening, closing, "event", _expectedEventRows());
        string[] memory constructorRows = new string[](1);
        constructorRows[0] = "constructor(address,bytes32,address,address,address,address,address,uint256)|nonpayable";
        _assertAbiKindRows(json, opening, closing, "constructor", constructorRows);
        _assertFrozenAbiNames(json, opening, closing);
    }

    function _expectedFunctionRows() private pure returns (string[] memory rows) {
        rows = new string[](23);
        rows[0] = "MAX_ACTIVE_ORDINARY_RESERVATIONS()|view|uint256";
        rows[1] = "MAX_ACTIVE_RECONCILIATIONS()|view|uint256";
        rows[2] = "MAX_OPERATOR_OUTFLOW_COMPONENTS()|view|uint256";
        rows[3] = "stockTokenRegistryV2()|view|address";
        rows[4] = "globalLifetimeCanonicalDepositCapWei()|view|uint256";
        rows[5] = "availableWei()|view|uint256";
        rows[6] = "unattributedWei()|view|uint256";
        rows[7] = "ordinaryReservedWei()|view|uint256";
        rows[8] = "reconciliationLiabilityWei()|view|uint256";
        rows[9] = "reconciliationBackingWei()|view|uint256";
        rows[10] = "accountingSequence()|view|uint256";
        rows[11] = "lastObservedBalanceDeficitWei()|view|uint256";
        rows[12] = string.concat("accountingTotals()|view|", _totalsCanonicalType());
        rows[13] = "syncBalance()|nonpayable|bytes32";
        rows[14] = "reclassifyUnattributed(uint256,bytes32)|nonpayable|bytes32";
        rows[15] = "globalLifetimeCanonicalDepositedWei()|view|uint256";
        rows[16] = "ingressLifetimeDepositedWei(uint256)|view|uint256";
        rows[17] = "ingressEpochDepositedWei(uint256,uint256)|view|uint256";
        rows[18] = string.concat("getDeposit(bytes32)|view|", _depositCanonicalType());
        rows[19] = "depositCanonical(bytes32)|payable|bytes32";
        rows[20] = "coreTopology()|view|address,bytes32,bool";
        rows[21] =
            "coreSnapshot()|view|uint256,address,bytes32,address,address,address,address,address,bool,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256";
        rows[22] = "finalizeCore(bytes32)|nonpayable|";
    }

    function _expectedErrorRows() private pure returns (string[] memory rows) {
        rows = new string[](36);
        rows[0] = "CoreFactoryZero()";
        rows[1] = "CoreManifestHashZero()";
        rows[2] = "CoreFinalizerUnauthorized(address)";
        rows[3] = "CoreManifestHashMismatch(bytes32,bytes32)";
        rows[4] = "CoreAlreadyFinalized()";
        rows[5] = "CoreNotFinalized()";
        rows[6] = "CoreInitialStateMismatch(uint8)";
        rows[7] = "CoreAddressMismatch(address,address)";
        rows[8] = "CorePeerMismatch(uint8,address,address)";
        rows[9] = "CoreAuthoritySnapshotCallFailed()";
        rows[10] = "CoreAuthoritySnapshotReturnLength(uint256)";
        rows[11] = "CoreAuthoritySnapshotSemanticMismatch(uint8)";
        rows[12] = "CoreIngressCallFailed(uint256)";
        rows[13] = "CoreIngressReturnLength(uint256,uint256)";
        rows[14] = "CoreIngressSemanticMismatch(uint8)";
        rows[15] = "InvalidGlobalLifetimeCap()";
        rows[16] = "NoBalanceDelta()";
        rows[17] = "InvalidAmount()";
        rows[18] = "InsufficientUnattributed(uint256,uint256)";
        rows[19] = "BalanceDeficitActive(uint256)";
        rows[20] = "ReconciliationShortfallActive(uint256)";
        rows[21] = "NotActiveIngress(address)";
        rows[22] = "DepositSourceRequired()";
        rows[23] = "DepositReplay(bytes32)";
        rows[24] = "DepositCapExceeded(uint8,uint256,uint256)";
        rows[25] = "DepositNotFound(bytes32)";
        rows[26] = "CoreZeroAddress()";
        rows[27] = "CoreContractRequired(address)";
        rows[28] = "CoreRoleIdentityCollision(address)";
        rows[29] = "CoreEmptyDetailsHash()";
        rows[30] = "CoreCounterExhausted(bytes32)";
        rows[31] = "CoreTimestampOverflow()";
        rows[32] = "CoreNoActiveIngress()";
        rows[33] = "CoreIngressCodeHashMismatch(address,bytes32,bytes32)";
        rows[34] = "CoreUnauthorized(address)";
        rows[35] = "ReentrancyGuardReentrantCall()";
    }

    function _expectedEventRows() private pure returns (string[] memory rows) {
        rows = new string[](5);
        rows[0] = "CoreFinalized(bytes32)|1|false";
        rows[1] = string.concat(
            "AccountingMutation(uint256,bytes32,uint8,",
            _totalsCanonicalType(),
            ",",
            _totalsCanonicalType(),
            ",uint256)|111000|false"
        );
        rows[2] = "AccountingComponent(uint256,uint256,bytes32,uint8,bytes32,uint256)|111000|false";
        rows[3] = "UnattributedReclassified(bytes32,uint256,address,uint256,uint8,bytes32)|111000|false";
        rows[4] =
            "CanonicalDeposit(bytes32,uint256,bytes32,address,uint256,uint256,uint256,uint256,uint256,uint64)|1110000000|false";
    }

    function _totalsCanonicalType() private pure returns (string memory) {
        return "(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)";
    }

    function _depositCanonicalType() private pure returns (string memory) {
        return "(bytes32,uint256,address,bytes32,uint256,uint256,uint256,uint256,uint256,uint64)";
    }

    function _assertFrozenAbiNames(bytes memory json, uint256 opening, uint256 closing) private pure {
        _assertAbiNameKindRows(json, opening, closing, "function", _expectedFunctionNameRows());
        _assertAbiNameKindRows(json, opening, closing, "error", _expectedErrorNameRows());
        _assertAbiNameKindRows(json, opening, closing, "event", _expectedEventNameRows());
        string[] memory constructorNameRows = new string[](1);
        constructorNameRows[0] =
            "constructor(factory,manifestHash,authority,registry,budgetBook,intentExecution,reconciliation,globalLifetimeCanonicalDepositCapWei)|";
        _assertAbiNameKindRows(json, opening, closing, "constructor", constructorNameRows);

        string[8] memory constructorNames = [
            "factory",
            "manifestHash",
            "authority",
            "registry",
            "budgetBook",
            "intentExecution",
            "reconciliation",
            "globalLifetimeCanonicalDepositCapWei"
        ];
        (uint256 objectOpening, uint256 objectClosing) = _findAbiObject(json, opening, closing, "constructor", "");
        (uint256 arrayOpening, uint256 arrayClosing) = _jsonArrayRange(json, objectOpening, objectClosing, "inputs");
        assertEq(_topLevelObjectCount(json, arrayOpening, arrayClosing), constructorNames.length, "constructor names");
        for (uint256 i; i < constructorNames.length; ++i) {
            (uint256 parameterOpening, uint256 parameterClosing) =
                _topLevelObjectAt(json, arrayOpening, arrayClosing, i);
            assertEq(
                _jsonString(json, parameterOpening, parameterClosing, "name"),
                constructorNames[i],
                "constructor input name"
            );
        }

        string[18] memory snapshotNames = [
            "schemaVersion",
            "factory",
            "manifestHash",
            "authority",
            "registry",
            "budgetBook",
            "intentExecution",
            "reconciliation",
            "finalized",
            "globalLifetimeCanonicalDepositCapWei",
            "availableWei",
            "unattributedWei",
            "ordinaryReservedWei",
            "reconciliationLiabilityWei",
            "reconciliationBackingWei",
            "accountingSequence",
            "lastObservedBalanceDeficitWei",
            "globalLifetimeCanonicalDepositedWei"
        ];
        (objectOpening, objectClosing) = _findAbiObject(json, opening, closing, "function", "coreSnapshot");
        (arrayOpening, arrayClosing) = _jsonArrayRange(json, objectOpening, objectClosing, "outputs");
        assertEq(_topLevelObjectCount(json, arrayOpening, arrayClosing), snapshotNames.length, "snapshot output names");
        for (uint256 i; i < snapshotNames.length; ++i) {
            (uint256 parameterOpening, uint256 parameterClosing) =
                _topLevelObjectAt(json, arrayOpening, arrayClosing, i);
            assertEq(
                _jsonString(json, parameterOpening, parameterClosing, "name"), snapshotNames[i], "snapshot output name"
            );
        }

        string[11] memory totalsNames = [
            "availableWei",
            "unattributedWei",
            "ordinaryReservedWei",
            "reconciliationLiabilityWei",
            "reconciliationBackingWei",
            "reconciliationShortfallWei",
            "accountedBackingWei",
            "actualBalanceWei",
            "balanceDeficitWei",
            "forcedSurplusWei",
            "accountingSequence"
        ];
        string[11] memory totalsTypes = [
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256"
        ];
        _assertTupleAbiNames(json, opening, closing, "accountingTotals", totalsNames, totalsTypes);

        string[10] memory depositNames = [
            "depositId",
            "ingressGeneration",
            "ingress",
            "sourceEventId",
            "amountWei",
            "balanceDeficitRepairWei",
            "availableCreditWei",
            "epochDay",
            "accountingSequence",
            "depositedAt"
        ];
        string[10] memory depositTypes = [
            "bytes32", "uint256", "address", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint64"
        ];
        _assertTupleAbiNames(json, opening, closing, "getDeposit", depositNames, depositTypes);
    }

    function _expectedFunctionNameRows() private pure returns (string[] memory rows) {
        rows = new string[](23);
        rows[0] = "MAX_ACTIVE_ORDINARY_RESERVATIONS()|";
        rows[1] = "MAX_ACTIVE_RECONCILIATIONS()|";
        rows[2] = "MAX_OPERATOR_OUTFLOW_COMPONENTS()|";
        rows[3] = "stockTokenRegistryV2()|";
        rows[4] = "globalLifetimeCanonicalDepositCapWei()|";
        rows[5] = "availableWei()|";
        rows[6] = "unattributedWei()|";
        rows[7] = "ordinaryReservedWei()|";
        rows[8] = "reconciliationLiabilityWei()|";
        rows[9] = "reconciliationBackingWei()|";
        rows[10] = "accountingSequence()|";
        rows[11] = "lastObservedBalanceDeficitWei()|";
        rows[12] = "accountingTotals()|totals";
        rows[13] = "syncBalance()|mutationId";
        rows[14] = "reclassifyUnattributed(amountWei,detailsHash)|mutationId";
        rows[15] = "globalLifetimeCanonicalDepositedWei()|";
        rows[16] = "ingressLifetimeDepositedWei(generation)|";
        rows[17] = "ingressEpochDepositedWei(generation,epochDay)|";
        rows[18] = "getDeposit(depositId)|record";
        rows[19] = "depositCanonical(sourceEventId)|depositId";
        rows[20] = "coreTopology()|factory,manifestHash,finalized";
        rows[21] =
            "coreSnapshot()|schemaVersion,factory,manifestHash,authority,registry,budgetBook,intentExecution,reconciliation,finalized,globalLifetimeCanonicalDepositCapWei,availableWei,unattributedWei,ordinaryReservedWei,reconciliationLiabilityWei,reconciliationBackingWei,accountingSequence,lastObservedBalanceDeficitWei,globalLifetimeCanonicalDepositedWei";
        rows[22] = "finalizeCore(manifestHash)|";
    }

    function _expectedErrorNameRows() private pure returns (string[] memory rows) {
        rows = new string[](36);
        rows[0] = "CoreFactoryZero()";
        rows[1] = "CoreManifestHashZero()";
        rows[2] = "CoreFinalizerUnauthorized(caller)";
        rows[3] = "CoreManifestHashMismatch(expected,actual)";
        rows[4] = "CoreAlreadyFinalized()";
        rows[5] = "CoreNotFinalized()";
        rows[6] = "CoreInitialStateMismatch(field)";
        rows[7] = "CoreAddressMismatch(expected,actual)";
        rows[8] = "CorePeerMismatch(index,expected,actual)";
        rows[9] = "CoreAuthoritySnapshotCallFailed()";
        rows[10] = "CoreAuthoritySnapshotReturnLength(actualLength)";
        rows[11] = "CoreAuthoritySnapshotSemanticMismatch(field)";
        rows[12] = "CoreIngressCallFailed(generation)";
        rows[13] = "CoreIngressReturnLength(generation,actualLength)";
        rows[14] = "CoreIngressSemanticMismatch(field)";
        rows[15] = "InvalidGlobalLifetimeCap()";
        rows[16] = "NoBalanceDelta()";
        rows[17] = "InvalidAmount()";
        rows[18] = "InsufficientUnattributed(availableWei,requestedWei)";
        rows[19] = "BalanceDeficitActive(deficitWei)";
        rows[20] = "ReconciliationShortfallActive(shortfallWei)";
        rows[21] = "NotActiveIngress(caller)";
        rows[22] = "DepositSourceRequired()";
        rows[23] = "DepositReplay(depositId)";
        rows[24] = "DepositCapExceeded(capKind,capWei,attemptedTotalWei)";
        rows[25] = "DepositNotFound(depositId)";
        rows[26] = "CoreZeroAddress()";
        rows[27] = "CoreContractRequired(target)";
        rows[28] = "CoreRoleIdentityCollision(candidate)";
        rows[29] = "CoreEmptyDetailsHash()";
        rows[30] = "CoreCounterExhausted(counterName)";
        rows[31] = "CoreTimestampOverflow()";
        rows[32] = "CoreNoActiveIngress()";
        rows[33] = "CoreIngressCodeHashMismatch(ingress,expected,actual)";
        rows[34] = "CoreUnauthorized(caller)";
        rows[35] = "ReentrancyGuardReentrantCall()";
    }

    function _expectedEventNameRows() private pure returns (string[] memory rows) {
        rows = new string[](5);
        rows[0] = "CoreFinalized(manifestHash)";
        rows[1] = "AccountingMutation(accountingSequence,mutationId,mutationKind,preTotals,postTotals,componentCount)";
        rows[2] =
            "AccountingComponent(accountingSequence,componentIndex,componentId,componentKind,componentSubjectId,amountWei)";
        rows[3] = "UnattributedReclassified(mutationId,accountingSequence,actor,amountWei,reasonCode,detailsHash)";
        rows[4] =
            "CanonicalDeposit(depositId,ingressGeneration,sourceEventId,ingress,amountWei,balanceDeficitRepairWei,availableCreditWei,epochDay,accountingSequence,depositedAt)";
    }

    function _assertTupleAbiNames(
        bytes memory json,
        uint256 opening,
        uint256 closing,
        string memory functionName,
        string[11] memory names,
        string[11] memory types_
    ) private pure {
        (uint256 objectOpening, uint256 objectClosing) =
            _findAbiObject(json, opening, closing, "function", functionName);
        (uint256 outputsOpening, uint256 outputsClosing) =
            _jsonArrayRange(json, objectOpening, objectClosing, "outputs");
        assertEq(_topLevelObjectCount(json, outputsOpening, outputsClosing), 1, "tuple output cardinality");
        (uint256 outputOpening, uint256 outputClosing) = _topLevelObjectAt(json, outputsOpening, outputsClosing, 0);
        (uint256 componentsOpening, uint256 componentsClosing) =
            _jsonArrayRange(json, outputOpening, outputClosing, "components");
        assertEq(_topLevelObjectCount(json, componentsOpening, componentsClosing), names.length, "tuple components");
        for (uint256 i; i < names.length; ++i) {
            (uint256 componentOpening, uint256 componentClosing) =
                _topLevelObjectAt(json, componentsOpening, componentsClosing, i);
            assertEq(_jsonString(json, componentOpening, componentClosing, "name"), names[i], "tuple component name");
            assertEq(_jsonString(json, componentOpening, componentClosing, "type"), types_[i], "tuple component type");
        }
    }

    function _assertTupleAbiNames(
        bytes memory json,
        uint256 opening,
        uint256 closing,
        string memory functionName,
        string[10] memory names,
        string[10] memory types_
    ) private pure {
        (uint256 objectOpening, uint256 objectClosing) =
            _findAbiObject(json, opening, closing, "function", functionName);
        (uint256 outputsOpening, uint256 outputsClosing) =
            _jsonArrayRange(json, objectOpening, objectClosing, "outputs");
        assertEq(_topLevelObjectCount(json, outputsOpening, outputsClosing), 1, "tuple output cardinality");
        (uint256 outputOpening, uint256 outputClosing) = _topLevelObjectAt(json, outputsOpening, outputsClosing, 0);
        (uint256 componentsOpening, uint256 componentsClosing) =
            _jsonArrayRange(json, outputOpening, outputClosing, "components");
        assertEq(_topLevelObjectCount(json, componentsOpening, componentsClosing), names.length, "tuple components");
        for (uint256 i; i < names.length; ++i) {
            (uint256 componentOpening, uint256 componentClosing) =
                _topLevelObjectAt(json, componentsOpening, componentsClosing, i);
            assertEq(_jsonString(json, componentOpening, componentClosing, "name"), names[i], "tuple component name");
            assertEq(_jsonString(json, componentOpening, componentClosing, "type"), types_[i], "tuple component type");
        }
    }

    function _findAbiObject(bytes memory json, uint256 opening, uint256 closing, string memory kind, string memory name)
        private
        pure
        returns (uint256 objectOpening, uint256 objectClosing)
    {
        uint256 cursor = opening + 1;
        while (cursor < closing) {
            objectOpening = _find(json, bytes("{"), cursor);
            if (objectOpening == type(uint256).max || objectOpening >= closing) break;
            objectClosing = _matchingDelimiter(json, objectOpening, bytes1("{"), bytes1("}"));
            if (
                _equal(_jsonString(json, objectOpening, objectClosing, "type"), kind)
                    && (_equal(kind, "constructor")
                        || _equal(_jsonString(json, objectOpening, objectClosing, "name"), name))
            ) return (objectOpening, objectClosing);
            cursor = objectClosing + 1;
        }
        revert("frozen ABI object missing");
    }

    function _assertAbiKindRows(
        bytes memory json,
        uint256 opening,
        uint256 closing,
        string memory kind,
        string[] memory expected
    ) private pure {
        assertEq(_abiKindCount(json, opening, closing, kind), expected.length, string.concat(kind, " ABI census"));
        for (uint256 i; i < expected.length; ++i) {
            assertEq(
                _abiCanonicalRowCount(json, opening, closing, kind, expected[i]),
                1,
                string.concat("missing/duplicate ", expected[i])
            );
        }
    }

    function _assertAbiNameKindRows(
        bytes memory json,
        uint256 opening,
        uint256 closing,
        string memory kind,
        string[] memory expected
    ) private pure {
        assertEq(_abiKindCount(json, opening, closing, kind), expected.length, string.concat(kind, " name census"));
        for (uint256 i; i < expected.length; ++i) {
            assertEq(
                _abiCanonicalNameRowCount(json, opening, closing, kind, expected[i]),
                1,
                string.concat("missing/duplicate ABI names ", expected[i])
            );
        }
    }

    function _abiCanonicalNameRowCount(
        bytes memory json,
        uint256 opening,
        uint256 closing,
        string memory kind,
        string memory expected
    ) private pure returns (uint256 count) {
        uint256 cursor = opening + 1;
        while (cursor < closing) {
            uint256 objectOpening = _find(json, bytes("{"), cursor);
            if (objectOpening == type(uint256).max || objectOpening >= closing) break;
            uint256 objectClosing = _matchingDelimiter(json, objectOpening, bytes1("{"), bytes1("}"));
            if (
                _equal(_jsonString(json, objectOpening, objectClosing, "type"), kind)
                    && _equal(_canonicalAbiNameRow(json, objectOpening, objectClosing, kind), expected)
            ) ++count;
            cursor = objectClosing + 1;
        }
    }

    function _canonicalAbiNameRow(bytes memory json, uint256 opening, uint256 closing, string memory kind)
        private
        pure
        returns (string memory)
    {
        string memory inputNames = _canonicalJsonParameterNames(json, opening, closing, "inputs");
        if (_equal(kind, "constructor")) return string.concat("constructor(", inputNames, ")|");
        string memory descriptor = string.concat(_jsonString(json, opening, closing, "name"), "(", inputNames, ")");
        if (_equal(kind, "function")) {
            return string.concat(descriptor, "|", _canonicalJsonParameterNames(json, opening, closing, "outputs"));
        }
        return descriptor;
    }

    function _canonicalJsonParameterNames(bytes memory json, uint256 opening, uint256 closing, string memory key)
        private
        pure
        returns (string memory result)
    {
        (uint256 arrayOpening, uint256 arrayClosing) = _jsonArrayRange(json, opening, closing, key);
        uint256 cursor = arrayOpening + 1;
        bool first = true;
        while (cursor < arrayClosing) {
            uint256 objectOpening = _find(json, bytes("{"), cursor);
            if (objectOpening == type(uint256).max || objectOpening >= arrayClosing) break;
            uint256 objectClosing = _matchingDelimiter(json, objectOpening, bytes1("{"), bytes1("}"));
            string memory parameterName = _jsonString(json, objectOpening, objectClosing, "name");
            result = first ? parameterName : string.concat(result, ",", parameterName);
            first = false;
            cursor = objectClosing + 1;
        }
    }

    function _abiKindCount(bytes memory json, uint256 opening, uint256 closing, string memory kind)
        private
        pure
        returns (uint256 count)
    {
        uint256 cursor = opening + 1;
        while (cursor < closing) {
            uint256 objectOpening = _find(json, bytes("{"), cursor);
            if (objectOpening == type(uint256).max || objectOpening >= closing) break;
            uint256 objectClosing = _matchingDelimiter(json, objectOpening, bytes1("{"), bytes1("}"));
            if (_equal(_jsonString(json, objectOpening, objectClosing, "type"), kind)) ++count;
            cursor = objectClosing + 1;
        }
    }

    function _abiCanonicalRowCount(
        bytes memory json,
        uint256 opening,
        uint256 closing,
        string memory kind,
        string memory expected
    ) private pure returns (uint256 count) {
        uint256 cursor = opening + 1;
        while (cursor < closing) {
            uint256 objectOpening = _find(json, bytes("{"), cursor);
            if (objectOpening == type(uint256).max || objectOpening >= closing) break;
            uint256 objectClosing = _matchingDelimiter(json, objectOpening, bytes1("{"), bytes1("}"));
            if (_equal(_jsonString(json, objectOpening, objectClosing, "type"), kind)) {
                if (_equal(_canonicalAbiRow(json, objectOpening, objectClosing, kind), expected)) ++count;
            }
            cursor = objectClosing + 1;
        }
    }

    function _canonicalAbiRow(bytes memory json, uint256 opening, uint256 closing, string memory kind)
        private
        pure
        returns (string memory)
    {
        string memory inputs = _canonicalJsonParameters(json, opening, closing, "inputs");
        if (_equal(kind, "constructor")) {
            return string.concat("constructor(", inputs, ")|", _jsonString(json, opening, closing, "stateMutability"));
        }
        string memory name = _jsonString(json, opening, closing, "name");
        string memory descriptor = string.concat(name, "(", inputs, ")");
        if (_equal(kind, "function")) {
            return string.concat(
                descriptor,
                "|",
                _jsonString(json, opening, closing, "stateMutability"),
                "|",
                _canonicalJsonParameters(json, opening, closing, "outputs")
            );
        }
        if (_equal(kind, "event")) {
            return string.concat(
                descriptor,
                "|",
                _eventIndexedFlags(json, opening, closing),
                "|",
                _jsonBoolean(json, opening, closing, "anonymous")
            );
        }
        return descriptor;
    }

    function _canonicalJsonParameters(bytes memory json, uint256 opening, uint256 closing, string memory key)
        private
        pure
        returns (string memory result)
    {
        (uint256 arrayOpening, uint256 arrayClosing) = _jsonArrayRange(json, opening, closing, key);
        uint256 cursor = arrayOpening + 1;
        bool first = true;
        while (cursor < arrayClosing) {
            uint256 objectOpening = _find(json, bytes("{"), cursor);
            if (objectOpening == type(uint256).max || objectOpening >= arrayClosing) break;
            uint256 objectClosing = _matchingDelimiter(json, objectOpening, bytes1("{"), bytes1("}"));
            string memory parameterType = _canonicalJsonParameterType(json, objectOpening, objectClosing);
            result = first ? parameterType : string.concat(result, ",", parameterType);
            first = false;
            cursor = objectClosing + 1;
        }
    }

    function _canonicalJsonParameterType(bytes memory json, uint256 opening, uint256 closing)
        private
        pure
        returns (string memory)
    {
        string memory parameterType = _jsonString(json, opening, closing, "type");
        bytes memory raw = bytes(parameterType);
        if (raw.length < 5 || raw[0] != "t" || raw[1] != "u" || raw[2] != "p" || raw[3] != "l" || raw[4] != "e") {
            return parameterType;
        }
        string memory components = _canonicalJsonParameters(json, opening, closing, "components");
        string memory suffix = raw.length == 5 ? "" : _sliceString(raw, 5, raw.length);
        return string.concat("(", components, ")", suffix);
    }

    function _eventIndexedFlags(bytes memory json, uint256 opening, uint256 closing)
        private
        pure
        returns (string memory flags)
    {
        (uint256 arrayOpening, uint256 arrayClosing) = _jsonArrayRange(json, opening, closing, "inputs");
        uint256 cursor = arrayOpening + 1;
        while (cursor < arrayClosing) {
            uint256 objectOpening = _find(json, bytes("{"), cursor);
            if (objectOpening == type(uint256).max || objectOpening >= arrayClosing) break;
            uint256 objectClosing = _matchingDelimiter(json, objectOpening, bytes1("{"), bytes1("}"));
            uint256 label = _find(json, bytes('"indexed":'), objectOpening);
            require(label < objectClosing, "event indexed field missing");
            bytes1 value = json[label + bytes('"indexed":').length];
            flags = string.concat(flags, value == "t" ? "1" : "0");
            cursor = objectClosing + 1;
        }
    }

    function _jsonArrayRange(bytes memory json, uint256 opening, uint256 closing, string memory key)
        private
        pure
        returns (uint256 arrayOpening, uint256 arrayClosing)
    {
        bytes memory label = bytes(string.concat('"', key, '":['));
        uint256 found = _find(json, label, opening);
        require(found < closing, string.concat("JSON array missing: ", key));
        arrayOpening = found + label.length - 1;
        arrayClosing = _matchingDelimiter(json, arrayOpening, bytes1("["), bytes1("]"));
        require(arrayClosing <= closing, string.concat("JSON array escaped: ", key));
    }

    function _jsonObjectRange(bytes memory json, uint256 opening, uint256 closing, string memory key)
        private
        pure
        returns (uint256 objectOpening, uint256 objectClosing)
    {
        bytes memory label = bytes(string.concat('"', key, '":{'));
        uint256 found = _find(json, label, opening);
        require(found < closing, string.concat("JSON object missing: ", key));
        objectOpening = found + label.length - 1;
        objectClosing = _matchingDelimiter(json, objectOpening, bytes1("{"), bytes1("}"));
        require(objectClosing <= closing, string.concat("JSON object escaped: ", key));
    }

    function _jsonNamedObjectRange(bytes memory json, uint256 opening, uint256 closing, string memory key)
        private
        pure
        returns (uint256 objectOpening, uint256 objectClosing)
    {
        return _jsonObjectRange(json, opening, closing, key);
    }

    function _jsonUint(bytes memory json, uint256 opening, uint256 closing, string memory key)
        private
        pure
        returns (uint256 value)
    {
        bytes memory label = bytes(string.concat('"', key, '":'));
        uint256 found = _find(json, label, opening);
        require(found < closing, string.concat("JSON uint missing: ", key));
        uint256 cursor = found + label.length;
        require(cursor < closing && json[cursor] >= "0" && json[cursor] <= "9", "invalid JSON uint");
        while (cursor < closing && json[cursor] >= "0" && json[cursor] <= "9") {
            value = value * 10 + (uint8(json[cursor]) - uint8(bytes1("0")));
            ++cursor;
        }
    }

    function _topLevelObjectCount(bytes memory json, uint256 opening, uint256 closing)
        private
        pure
        returns (uint256 count)
    {
        uint256 cursor = opening + 1;
        while (cursor < closing) {
            uint256 objectOpening = _find(json, bytes("{"), cursor);
            if (objectOpening == type(uint256).max || objectOpening >= closing) break;
            uint256 objectClosing = _matchingDelimiter(json, objectOpening, bytes1("{"), bytes1("}"));
            require(objectClosing < closing, "top-level JSON object escaped");
            ++count;
            cursor = objectClosing + 1;
        }
    }

    function _topLevelObjectAt(bytes memory json, uint256 opening, uint256 closing, uint256 index)
        private
        pure
        returns (uint256 objectOpening, uint256 objectClosing)
    {
        uint256 cursor = opening + 1;
        for (uint256 i; i <= index; ++i) {
            objectOpening = _find(json, bytes("{"), cursor);
            require(objectOpening < closing, "top-level JSON object missing");
            objectClosing = _matchingDelimiter(json, objectOpening, bytes1("{"), bytes1("}"));
            require(objectClosing < closing, "top-level JSON object escaped");
            cursor = objectClosing + 1;
        }
    }

    function _jsonString(bytes memory json, uint256 opening, uint256 closing, string memory key)
        private
        pure
        returns (string memory)
    {
        bytes memory label = bytes(string.concat('"', key, '":"'));
        uint256 found = _find(json, label, opening);
        require(found < closing, string.concat("JSON string missing: ", key));
        uint256 start = found + label.length;
        uint256 end = start;
        while (end < closing && json[end] != '"') ++end;
        require(end < closing, string.concat("JSON string unterminated: ", key));
        return _sliceString(json, start, end);
    }

    function _jsonBoolean(bytes memory json, uint256 opening, uint256 closing, string memory key)
        private
        pure
        returns (string memory)
    {
        bytes memory label = bytes(string.concat('"', key, '":'));
        uint256 found = _find(json, label, opening);
        require(found < closing, string.concat("JSON boolean missing: ", key));
        uint256 start = found + label.length;
        if (
            start + 4 <= closing && json[start] == "t" && json[start + 1] == "r" && json[start + 2] == "u"
                && json[start + 3] == "e"
        ) return "true";
        require(
            start + 5 <= closing && json[start] == "f" && json[start + 1] == "a" && json[start + 2] == "l"
                && json[start + 3] == "s" && json[start + 4] == "e",
            string.concat("invalid JSON boolean: ", key)
        );
        return "false";
    }

    function _sliceString(bytes memory value, uint256 start, uint256 end) private pure returns (string memory) {
        bytes memory result = new bytes(end - start);
        for (uint256 i; i < result.length; ++i) {
            result[i] = value[start + i];
        }
        return string(result);
    }

    function _equal(string memory left, string memory right) private pure returns (bool) {
        return keccak256(bytes(left)) == keccak256(bytes(right));
    }

    function _find(bytes memory haystack, bytes memory needle, uint256 from) private pure returns (uint256) {
        if (needle.length == 0 || needle.length > haystack.length) return type(uint256).max;
        for (uint256 i = from; i + needle.length <= haystack.length; ++i) {
            bool matches = true;
            for (uint256 j; j < needle.length; ++j) {
                if (haystack[i + j] != needle[j]) {
                    matches = false;
                    break;
                }
            }
            if (matches) return i;
        }
        return type(uint256).max;
    }

    function _containsAsciiCaseInsensitive(bytes memory haystack, uint256 from, uint256 to, bytes memory needle)
        private
        pure
        returns (bool)
    {
        if (needle.length == 0 || from > to || needle.length > to - from) return false;
        for (uint256 i = from; i + needle.length <= to; ++i) {
            bool matches = true;
            for (uint256 j; j < needle.length; ++j) {
                bytes1 left = haystack[i + j];
                bytes1 right = needle[j];
                if (left >= "A" && left <= "Z") left = bytes1(uint8(left) + 32);
                if (right >= "A" && right <= "Z") right = bytes1(uint8(right) + 32);
                if (left != right) {
                    matches = false;
                    break;
                }
            }
            if (matches) return true;
        }
        return false;
    }

    function _matchingDelimiter(bytes memory value, uint256 opening, bytes1 open, bytes1 close)
        private
        pure
        returns (uint256)
    {
        uint256 depth;
        bool inString;
        bool escaped;
        for (uint256 i = opening; i < value.length; ++i) {
            bytes1 character = value[i];
            if (inString) {
                if (escaped) escaped = false;
                else if (character == "\\") escaped = true;
                else if (character == '"') inString = false;
            } else if (character == '"') {
                inString = true;
            } else if (character == open) {
                ++depth;
            } else if (character == close) {
                --depth;
                if (depth == 0) return i;
            }
        }
        return type(uint256).max;
    }

    function _countBetween(bytes memory value, bytes memory needle, uint256 from, uint256 to)
        private
        pure
        returns (uint256 count)
    {
        uint256 cursor = from;
        while (cursor < to) {
            uint256 found = _find(value, needle, cursor);
            if (found == type(uint256).max || found >= to) break;
            ++count;
            cursor = found + needle.length;
        }
    }
}
