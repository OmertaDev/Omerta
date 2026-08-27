// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {StdStorage, stdStorage} from "forge-std/StdStorage.sol";
import {AcquisitionVault} from "../src/AcquisitionVault.sol";
import {IAcquisitionVaultV1} from "../src/interfaces/IAcquisitionVaultV1.sol";

interface A1Task4Errors {
    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);
    error InvalidGlobalLifetimeCap();
    error EmptyDetailsHash();
    error CounterExhausted(bytes32 counterName);
    error NoBalanceDelta();
    error InvalidAmount();
    error InsufficientUnattributed(uint256 availableWei, uint256 requestedWei);
    error BalanceDeficitActive(uint256 deficitWei);
    error ReconciliationShortfallActive(uint256 shortfallWei);
    error LocalReadinessFailed(uint8 condition);
}

contract A1Task4Safe {
    function execute(address target, bytes calldata data) external returns (bytes memory result) {
        (bool ok, bytes memory returndata) = target.call(data);
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(returndata, 0x20), mload(returndata))
            }
        }
        return returndata;
    }
}

contract A1Task4Registry {
    function supportedChainId() external pure returns (uint256) {
        return 4663;
    }
}

contract A1Task4ForceSend {
    constructor() payable {}

    function force(address payable target) external {
        selfdestruct(target);
    }
}

contract A1Task4RawCreateFactory {
    function deploy(bytes memory initCode) external returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create(0, add(initCode, 0x20), mload(initCode))
            if iszero(deployed) {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }
}

contract AcquisitionVaultAccountingTest is Test {
    using stdStorage for StdStorage;

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

    uint256 internal constant CHAIN_ID = 4663;
    uint256 internal constant GLOBAL_CAP = 10_000 ether;
    uint8 internal constant MUTATION_SYNC = 1;
    uint8 internal constant MUTATION_RECLASSIFY = 2;
    uint8 internal constant COMPONENT_FORCED_TO_UNATTRIBUTED = 1;
    uint8 internal constant COMPONENT_DEFICIT_OBSERVATION = 2;
    uint8 internal constant COMPONENT_UNATTRIBUTED_TO_AVAILABLE = 3;
    uint8 internal constant REASON_RECLASSIFIED = 18;
    uint8 internal constant READINESS_ACTIVE_INGRESS_MISSING = 7;
    bytes32 internal constant MUTATION_TAG = keccak256("OMERTA_ACQUISITION_ACCOUNTING_MUTATION_V1");
    bytes32 internal constant COMPONENT_TAG = keccak256("OMERTA_ACQUISITION_ACCOUNTING_COMPONENT_V1");
    bytes32 internal constant SYNC_SUBJECT_TAG = keccak256("OMERTA_ACQUISITION_SYNC_BALANCE_V1");
    bytes32 internal constant DETAILS = keccak256("a1-task4-reclassification");
    bytes32 internal constant SEQUENCE_LABEL = keccak256(bytes("accountingSequence"));

    bytes4 internal constant CAP_SELECTOR = bytes4(keccak256("globalLifetimeCanonicalDepositCapWei()"));
    bytes4 internal constant TOTALS_SELECTOR = bytes4(keccak256("accountingTotals()"));
    bytes4 internal constant SYNC_SELECTOR = bytes4(keccak256("syncBalance()"));
    bytes4 internal constant RECLASSIFY_SELECTOR = bytes4(keccak256("reclassifyUnattributed(uint256,bytes32)"));
    bytes4 internal constant AVAILABLE_SELECTOR = bytes4(keccak256("availableWei()"));
    bytes4 internal constant UNATTRIBUTED_SELECTOR = bytes4(keccak256("unattributedWei()"));
    bytes4 internal constant ORDINARY_RESERVED_SELECTOR = bytes4(keccak256("ordinaryReservedWei()"));
    bytes4 internal constant LIABILITY_SELECTOR = bytes4(keccak256("reconciliationLiabilityWei()"));
    bytes4 internal constant BACKING_SELECTOR = bytes4(keccak256("reconciliationBackingWei()"));
    bytes4 internal constant SEQUENCE_SELECTOR = bytes4(keccak256("accountingSequence()"));
    bytes4 internal constant LAST_DEFICIT_SELECTOR = bytes4(keccak256("lastObservedBalanceDeficitWei()"));

    bytes32 internal constant ACCOUNTING_MUTATION_SIG = keccak256(
        "AccountingMutation(uint256,bytes32,uint8,(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256),(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256),uint256)"
    );
    bytes32 internal constant ACCOUNTING_COMPONENT_SIG =
        keccak256("AccountingComponent(uint256,uint256,bytes32,uint8,bytes32,uint256)");
    bytes32 internal constant RECLASSIFIED_SIG =
        keccak256("UnattributedReclassified(bytes32,uint256,address,uint256,uint8,bytes32)");

    A1Task4Safe internal safe;
    A1Task4Registry internal registry;
    AcquisitionVault internal vault;

    function setUp() public {
        vm.chainId(CHAIN_ID);
        vm.warp(30 days);
        safe = new A1Task4Safe();
        registry = new A1Task4Registry();
        vault = AcquisitionVault(_deploy(address(safe), address(registry), GLOBAL_CAP));
    }

    function _deploy(address safeOwner, address registry_, uint256 cap) internal returns (address deployed) {
        A1Task4RawCreateFactory factory = new A1Task4RawCreateFactory();
        bytes memory initCode =
            abi.encodePacked(type(AcquisitionVault).creationCode, abi.encode(safeOwner, registry_, cap));
        deployed = factory.deploy(initCode);
    }

    function _predictFirstCreate(address factory) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", factory, hex"01")))));
    }

    function _safeExecute(bytes memory data) internal returns (bytes memory) {
        return safe.execute(address(vault), data);
    }

    function _assertSafeRevert(bytes memory data, bytes memory expected) internal {
        (bool ok, bytes memory returndata) =
            address(safe).call(abi.encodeCall(A1Task4Safe.execute, (address(vault), data)));
        assertFalse(ok, "Safe call unexpectedly succeeded");
        assertEq(keccak256(returndata), keccak256(expected), "unexpected Safe-call revert");
    }

    function _word(bytes4 selector) internal view returns (uint256 result) {
        (bool ok, bytes memory returndata) = address(vault).staticcall(abi.encodeWithSelector(selector));
        assertTrue(ok, "missing Task-4 scalar getter");
        assertEq(returndata.length, 32, "malformed Task-4 scalar getter");
        result = abi.decode(returndata, (uint256));
    }

    function _totals() internal view returns (AccountingTotals memory totals) {
        (bool ok, bytes memory returndata) = address(vault).staticcall(abi.encodeWithSelector(TOTALS_SELECTOR));
        assertTrue(ok, "missing Task-4 accountingTotals");
        totals = abi.decode(returndata, (AccountingTotals));
    }

    function _sync() internal returns (bytes32 mutationId) {
        (bool ok, bytes memory returndata) = address(vault).call(abi.encodeWithSelector(SYNC_SELECTOR));
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(returndata, 0x20), mload(returndata))
            }
        }
        mutationId = abi.decode(returndata, (bytes32));
    }

    function _reclassify(uint256 amountWei, bytes32 detailsHash) internal returns (bytes32 mutationId) {
        bytes memory result = _safeExecute(abi.encodeWithSelector(RECLASSIFY_SELECTOR, amountWei, detailsHash));
        mutationId = abi.decode(result, (bytes32));
    }

    function _force(uint256 amountWei) internal {
        A1Task4ForceSend sender = new A1Task4ForceSend{value: amountWei}();
        sender.force(payable(address(vault)));
    }

    function _write(bytes4 getter, uint256 value) internal {
        stdstore.target(address(vault)).sig(getter).checked_write(value);
    }

    function _forcePaused(bool value) internal {
        vm.record();
        vault.paused();
        (bytes32[] memory reads,) = vm.accesses(address(vault));
        assertEq(reads.length, 1, "paused getter must read one packed slot");
        bytes32 slot = reads[0];
        uint256 current = uint256(vm.load(address(vault), slot));
        uint256 pausedMask = uint256(0xff) << 160;
        uint256 next = (current & ~pausedMask) | (uint256(value ? 1 : 0) << 160);
        vm.store(address(vault), slot, bytes32(next));
        assertEq(vault.paused(), value);
    }

    function _mutationId(uint256 sequence, uint8 kind, bytes32 subjectId) internal view returns (bytes32) {
        return keccak256(abi.encode(MUTATION_TAG, CHAIN_ID, address(vault), sequence, kind, subjectId));
    }

    function _componentId(bytes32 mutationId, uint256 index, uint8 kind, bytes32 subjectId, uint256 amountWei)
        internal
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(COMPONENT_TAG, CHAIN_ID, address(vault), mutationId, index, kind, subjectId, amountWei)
        );
    }

    function _syncSubject(AccountingTotals memory preTotals, AccountingTotals memory postTotals)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(SYNC_SUBJECT_TAG, preTotals, postTotals));
    }

    function _assertTotalsEq(AccountingTotals memory actual, AccountingTotals memory expected) internal pure {
        assertEq(keccak256(abi.encode(actual)), keccak256(abi.encode(expected)), "accounting totals mismatch");
    }

    function _contains(string[] memory values, string memory needle) internal pure returns (bool) {
        bytes32 expected = keccak256(bytes(needle));
        for (uint256 i; i < values.length; ++i) {
            if (keccak256(bytes(values[i])) == expected) return true;
        }
        return false;
    }

    function _find(bytes memory haystack, bytes memory needle, uint256 from) internal pure returns (uint256) {
        if (needle.length == 0 || haystack.length < needle.length) return type(uint256).max;
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

    function _matchingDelimiter(bytes memory json, uint256 opening, bytes1 open, bytes1 close)
        internal
        pure
        returns (uint256)
    {
        uint256 depth;
        bool quoted;
        bool escaped;
        for (uint256 i = opening; i < json.length; ++i) {
            bytes1 current = json[i];
            if (quoted) {
                if (escaped) escaped = false;
                else if (current == bytes1("\\")) escaped = true;
                else if (current == bytes1('"')) quoted = false;
                continue;
            }
            if (current == bytes1('"')) {
                quoted = true;
            } else if (current == open) {
                ++depth;
            } else if (current == close) {
                --depth;
                if (depth == 0) return i;
            }
        }
        revert("unterminated ABI array");
    }

    function _countBetween(bytes memory value, bytes memory needle, uint256 from, uint256 to)
        internal
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

    function _assertGetterSlot(bytes4 selector, uint256 expectedSlot) internal {
        vm.record();
        (bool ok,) = address(vault).staticcall(abi.encodeWithSelector(selector));
        assertTrue(ok);
        (bytes32[] memory reads,) = vm.accesses(address(vault));
        assertEq(reads.length, 1, "scalar getter read unexpected slot count");
        assertEq(reads[0], bytes32(expectedSlot), "scalar storage slot drift");
    }

    function _assertTask4AbiCounts(bytes memory json, uint256 opening, uint256 closing) internal pure {
        uint256 functionCount = _countBetween(json, bytes('"type":"function"'), opening, closing);
        uint256 errorCount = _countBetween(json, bytes('"type":"error"'), opening, closing);
        uint256 eventCount = _countBetween(json, bytes('"type":"event"'), opening, closing);
        uint256 constructorCount = _countBetween(json, bytes('"type":"constructor"'), opening, closing);
        assertEq(functionCount, 52, "Task-4 function count drift");
        assertEq(errorCount, 43, "Task-4 error count drift");
        assertEq(eventCount, 15, "Task-4 event count drift");
        assertEq(constructorCount, 1, "Task-4 constructor count drift");
        assertEq(
            _countBetween(json, bytes('"stateMutability":"payable"'), opening, closing),
            0,
            "Task-4 payable entry leaked"
        );
        assertEq(_countBetween(json, bytes('"type":"receive"'), opening, closing), 0, "Task-4 receive entry leaked");
        assertEq(_countBetween(json, bytes('"type":"fallback"'), opening, closing), 0, "Task-4 fallback entry leaked");
        assertEq(functionCount + errorCount + eventCount + constructorCount, 111, "Task-4 ABI entry drift");
    }

    function _assertTask4MethodMembers(string memory artifact) internal pure {
        string[] memory methods = vm.parseJsonKeys(artifact, ".methodIdentifiers");
        string[11] memory added = [
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
            "reclassifyUnattributed(uint256,bytes32)"
        ];
        for (uint256 i; i < added.length; ++i) {
            assertTrue(_contains(methods, added[i]), string.concat("missing Task-4 method: ", added[i]));
        }
    }

    function _assertTask4ErrorAndEventNames(bytes memory json, uint256 opening) internal pure {
        string[6] memory addedErrors = [
            "InvalidGlobalLifetimeCap",
            "NoBalanceDelta",
            "InvalidAmount",
            "InsufficientUnattributed",
            "BalanceDeficitActive",
            "ReconciliationShortfallActive"
        ];
        for (uint256 i; i < addedErrors.length; ++i) {
            assertNotEq(
                _find(json, bytes(string.concat('"type":"error","name":"', addedErrors[i], '"')), opening),
                type(uint256).max,
                string.concat("missing Task-4 error: ", addedErrors[i])
            );
        }

        string[3] memory addedEvents = ["AccountingMutation", "AccountingComponent", "UnattributedReclassified"];
        for (uint256 i; i < addedEvents.length; ++i) {
            assertNotEq(
                _find(json, bytes(string.concat('"type":"event","name":"', addedEvents[i], '"')), opening),
                type(uint256).max,
                string.concat("missing Task-4 event: ", addedEvents[i])
            );
        }
    }

    function _assertMutationLog(
        Vm.Log memory log,
        uint256 sequence,
        bytes32 mutationId,
        uint8 kind,
        AccountingTotals memory preTotals,
        AccountingTotals memory postTotals,
        uint256 componentCount
    ) internal view {
        assertEq(log.emitter, address(vault));
        assertEq(log.topics.length, 4);
        assertEq(log.topics[0], ACCOUNTING_MUTATION_SIG);
        assertEq(log.topics[1], bytes32(sequence));
        assertEq(log.topics[2], mutationId);
        assertEq(log.topics[3], bytes32(uint256(kind)));
        assertEq(log.data, abi.encode(preTotals, postTotals, componentCount));
    }

    function _assertComponentLog(
        Vm.Log memory log,
        uint256 sequence,
        uint256 index,
        bytes32 componentId,
        uint8 kind,
        bytes32 subjectId,
        uint256 amountWei
    ) internal view {
        assertEq(log.emitter, address(vault));
        assertEq(log.topics.length, 4);
        assertEq(log.topics[0], ACCOUNTING_COMPONENT_SIG);
        assertEq(log.topics[1], bytes32(sequence));
        assertEq(log.topics[2], bytes32(index));
        assertEq(log.topics[3], componentId);
        assertEq(log.data, abi.encode(kind, subjectId, amountWei));
        assertTrue(kind != 0, "NONE component forbidden");
    }

    function test_RED_task4CapAndAccountingSurfaceExists() public view {
        (bool ok, bytes memory returndata) = address(vault).staticcall(abi.encodeWithSelector(CAP_SELECTOR));
        assertTrue(ok, "Task-4 immutable cap getter is missing");
        assertEq(abi.decode(returndata, (uint256)), GLOBAL_CAP);
        AccountingTotals memory totals = _totals();
        assertEq(totals.accountingSequence, 0);
    }

    function test_exactTask4EnumsAbiCountsMembersConstructorAndStorageAppend() public {
        assertEq(uint8(IAcquisitionVaultV1.AccountingMutationKind.NONE), 0);
        assertEq(uint8(IAcquisitionVaultV1.AccountingMutationKind.SYNC_BALANCE), 1);
        assertEq(uint8(IAcquisitionVaultV1.AccountingMutationKind.UNATTRIBUTED_RECLASSIFICATION), 2);
        assertEq(uint8(IAcquisitionVaultV1.AccountingMutationKind.CANONICAL_DEPOSIT), 3);
        assertEq(uint8(IAcquisitionVaultV1.AccountingComponentKind.NONE), 0);
        assertEq(uint8(IAcquisitionVaultV1.AccountingComponentKind.FORCED_SURPLUS_TO_UNATTRIBUTED), 1);
        assertEq(uint8(IAcquisitionVaultV1.AccountingComponentKind.BALANCE_DEFICIT_OBSERVATION_SET), 2);
        assertEq(uint8(IAcquisitionVaultV1.AccountingComponentKind.UNATTRIBUTED_TO_AVAILABLE), 3);
        assertEq(uint8(IAcquisitionVaultV1.AccountingComponentKind.CANONICAL_DEPOSIT_DEFICIT_REPAIR), 4);
        assertEq(uint8(IAcquisitionVaultV1.AccountingComponentKind.CANONICAL_DEPOSIT_AVAILABLE_CREDIT), 5);

        string memory artifact =
            vm.readFile(string.concat(vm.projectRoot(), "/out/AcquisitionVault.sol/AcquisitionVault.json"));
        bytes memory json = bytes(artifact);
        bytes memory marker = bytes('"abi":[');
        uint256 opening = _find(json, marker, 0) + marker.length - 1;
        uint256 closing = _matchingDelimiter(json, opening, bytes1("["), bytes1("]"));
        _assertTask4AbiCounts(json, opening, closing);
        _assertTask4MethodMembers(artifact);
        _assertTask4ErrorAndEventNames(json, opening);

        assertEq(A1Task4Errors.InvalidGlobalLifetimeCap.selector, bytes4(keccak256("InvalidGlobalLifetimeCap()")));
        assertEq(A1Task4Errors.NoBalanceDelta.selector, bytes4(keccak256("NoBalanceDelta()")));
        assertEq(A1Task4Errors.InvalidAmount.selector, bytes4(keccak256("InvalidAmount()")));
        assertEq(
            A1Task4Errors.InsufficientUnattributed.selector,
            bytes4(keccak256("InsufficientUnattributed(uint256,uint256)"))
        );
        assertEq(A1Task4Errors.BalanceDeficitActive.selector, bytes4(keccak256("BalanceDeficitActive(uint256)")));
        assertEq(
            A1Task4Errors.ReconciliationShortfallActive.selector,
            bytes4(keccak256("ReconciliationShortfallActive(uint256)"))
        );
        assertEq(
            ACCOUNTING_MUTATION_SIG,
            keccak256(
                "AccountingMutation(uint256,bytes32,uint8,(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256),(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256),uint256)"
            )
        );
        assertEq(
            ACCOUNTING_COMPONENT_SIG, keccak256("AccountingComponent(uint256,uint256,bytes32,uint8,bytes32,uint256)")
        );
        assertEq(RECLASSIFIED_SIG, keccak256("UnattributedReclassified(bytes32,uint256,address,uint256,uint8,bytes32)"));
        assertNotEq(
            _find(
                json,
                bytes(
                    '"type":"constructor","inputs":[{"name":"safeOwner","type":"address","internalType":"address"},{"name":"registry","type":"address","internalType":"address"},{"name":"globalLifetimeCanonicalDepositCapWei_","type":"uint256","internalType":"uint256"}],"stateMutability":"nonpayable"'
                ),
                opening
            ),
            type(uint256).max,
            "Task-4 constructor descriptor drift"
        );

        _assertGetterSlot(AVAILABLE_SELECTOR, 14);
        _assertGetterSlot(UNATTRIBUTED_SELECTOR, 15);
        _assertGetterSlot(ORDINARY_RESERVED_SELECTOR, 16);
        _assertGetterSlot(LIABILITY_SELECTOR, 17);
        _assertGetterSlot(BACKING_SELECTOR, 18);
        _assertGetterSlot(SEQUENCE_SELECTOR, 19);
        _assertGetterSlot(LAST_DEFICIT_SELECTOR, 20);
    }

    function test_constructorInitializesExactTask4ScalarsAndRejectsOnlyZeroCap() public {
        assertEq(_word(CAP_SELECTOR), GLOBAL_CAP);
        assertTrue(vault.paused());
        assertEq(vault.owner(), address(safe));
        assertEq(vault.stockTokenRegistryV2(), address(registry));
        assertEq(_word(AVAILABLE_SELECTOR), 0);
        assertEq(_word(UNATTRIBUTED_SELECTOR), 0);
        assertEq(_word(ORDINARY_RESERVED_SELECTOR), 0);
        assertEq(_word(LIABILITY_SELECTOR), 0);
        assertEq(_word(BACKING_SELECTOR), 0);
        assertEq(_word(SEQUENCE_SELECTOR), 0);
        assertEq(_word(LAST_DEFICIT_SELECTOR), 0);
        AccountingTotals memory totals = _totals();
        _assertTotalsEq(totals, AccountingTotals(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));

        A1Task4RawCreateFactory factory = new A1Task4RawCreateFactory();
        bytes memory initCode =
            abi.encodePacked(type(AcquisitionVault).creationCode, abi.encode(address(safe), address(registry), 0));
        vm.expectRevert(A1Task4Errors.InvalidGlobalLifetimeCap.selector);
        factory.deploy(initCode);
    }

    function test_constructorAllowsPredictedAddressForcedPrefundingEvenAboveGlobalCap() public {
        A1Task4RawCreateFactory factory = new A1Task4RawCreateFactory();
        address predicted = _predictFirstCreate(address(factory));
        uint256 prefund = GLOBAL_CAP + 1;
        A1Task4ForceSend sender = new A1Task4ForceSend{value: prefund}();
        sender.force(payable(predicted));
        bytes memory initCode = abi.encodePacked(
            type(AcquisitionVault).creationCode, abi.encode(address(safe), address(registry), GLOBAL_CAP)
        );
        AcquisitionVault prefunded = AcquisitionVault(factory.deploy(initCode));
        assertEq(address(prefunded), predicted);
        assertEq(address(prefunded).balance, prefund);

        (bool ok, bytes memory returndata) = address(prefunded).staticcall(abi.encodeWithSelector(TOTALS_SELECTOR));
        assertTrue(ok);
        AccountingTotals memory totals = abi.decode(returndata, (AccountingTotals));
        _assertTotalsEq(totals, AccountingTotals(0, 0, 0, 0, 0, 0, 0, prefund, 0, prefund, 0));
        (ok, returndata) = address(prefunded).staticcall(abi.encodeWithSelector(LAST_DEFICIT_SELECTOR));
        assertTrue(ok);
        assertEq(abi.decode(returndata, (uint256)), 0);

        AcquisitionVault maxCapVault = AcquisitionVault(_deploy(address(safe), address(registry), type(uint256).max));
        (ok, returndata) = address(maxCapVault).staticcall(abi.encodeWithSelector(CAP_SELECTOR));
        assertTrue(ok);
        assertEq(abi.decode(returndata, (uint256)), type(uint256).max);
    }

    function test_accountingTotalsUsesExactAUR_LPS_BVDFFieldOrderAndDerivedEquations() public {
        _write(AVAILABLE_SELECTOR, 1 ether);
        _write(UNATTRIBUTED_SELECTOR, 2 ether);
        _write(ORDINARY_RESERVED_SELECTOR, 3 ether);
        _write(LIABILITY_SELECTOR, 5 ether);
        _write(BACKING_SELECTOR, 4 ether);
        vm.deal(address(vault), 10 ether);
        _assertTotalsEq(
            _totals(),
            AccountingTotals(1 ether, 2 ether, 3 ether, 5 ether, 4 ether, 1 ether, 10 ether, 10 ether, 0, 0, 0)
        );

        vm.deal(address(vault), 8 ether);
        _assertTotalsEq(
            _totals(),
            AccountingTotals(1 ether, 2 ether, 3 ether, 5 ether, 4 ether, 1 ether, 10 ether, 8 ether, 2 ether, 0, 0)
        );

        vm.deal(address(vault), 12 ether);
        _assertTotalsEq(
            _totals(),
            AccountingTotals(1 ether, 2 ether, 3 ether, 5 ether, 4 ether, 1 ether, 10 ether, 12 ether, 0, 2 ether, 0)
        );
    }

    function test_sourceSequenceExhaustionChecksPrecedeWritesAndTask5CallSurfacesAreAbsent() public view {
        bytes memory source = bytes(vm.readFile(string.concat(vm.projectRoot(), "/src/AcquisitionVault.sol")));
        uint256 syncStart = _find(source, bytes("function syncBalance()"), 0);
        uint256 syncEnd = _find(source, bytes("function reclassifyUnattributed"), syncStart);
        uint256 syncSequenceCheck = _find(source, bytes("uint256 nextSequence = _nextAccountingSequence();"), syncStart);
        uint256 syncFirstWrite = _find(source, bytes("unattributedWei = unattributedWei + forcedSurplus;"), syncStart);
        assertLt(syncStart, syncSequenceCheck);
        assertLt(syncSequenceCheck, syncFirstWrite);
        assertLt(syncFirstWrite, syncEnd);

        uint256 reclassifySequenceCheck =
            _find(source, bytes("uint256 nextSequence = _nextAccountingSequence();"), syncEnd);
        uint256 reclassifyFirstWrite = _find(source, bytes("availableWei = newAvailable;"), syncEnd);
        assertLt(syncEnd, reclassifySequenceCheck);
        assertLt(reclassifySequenceCheck, reclassifyFirstWrite);
        assertEq(_find(source, bytes("function depositCanonical"), 0), type(uint256).max);
        assertEq(_find(source, bytes("delegatecall"), 0), type(uint256).max);
        assertEq(_find(source, bytes("tx.origin"), 0), type(uint256).max);
        assertEq(_find(source, bytes("call{value:"), 0), type(uint256).max);
    }

    function test_syncClassifiesForcedSurplusToUnattributedWithExactEvidenceAndNoSpam() public {
        _force(7 ether);
        AccountingTotals memory preTotals = _totals();
        AccountingTotals memory postTotals = AccountingTotals(0, 7 ether, 0, 0, 0, 0, 7 ether, 7 ether, 0, 0, 1);
        bytes32 subjectId = _syncSubject(preTotals, postTotals);
        bytes32 expectedMutationId = _mutationId(1, MUTATION_SYNC, subjectId);
        bytes32 expectedComponentId =
            _componentId(expectedMutationId, 0, COMPONENT_FORCED_TO_UNATTRIBUTED, subjectId, 7 ether);

        vm.recordLogs();
        bytes32 actualMutationId = _sync();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(actualMutationId, expectedMutationId);
        assertEq(logs.length, 2);
        _assertMutationLog(logs[0], 1, expectedMutationId, MUTATION_SYNC, preTotals, postTotals, 1);
        _assertComponentLog(logs[1], 1, 0, expectedComponentId, COMPONENT_FORCED_TO_UNATTRIBUTED, subjectId, 7 ether);
        _assertTotalsEq(_totals(), postTotals);
        assertEq(_word(LAST_DEFICIT_SELECTOR), 0);

        vm.recordLogs();
        vm.expectRevert(A1Task4Errors.NoBalanceDelta.selector);
        _sync();
        assertEq(vm.getRecordedLogs().length, 0);
        _assertTotalsEq(_totals(), postTotals);
    }

    function test_syncRecordsDeficitAndClearingWithoutRewritingBuckets() public {
        _force(10 ether);
        _sync();
        _reclassify(10 ether, DETAILS);
        vm.deal(address(vault), 4 ether);
        AccountingTotals memory preDeficit = _totals();
        assertEq(preDeficit.availableWei, 10 ether);
        assertEq(preDeficit.balanceDeficitWei, 6 ether);

        vm.recordLogs();
        bytes32 deficitMutation = _sync();
        Vm.Log[] memory deficitLogs = vm.getRecordedLogs();
        AccountingTotals memory postDeficit = _totals();
        assertEq(postDeficit.availableWei, 10 ether, "deficit sync rewrote bucket");
        assertEq(postDeficit.balanceDeficitWei, 6 ether);
        assertEq(_word(LAST_DEFICIT_SELECTOR), 6 ether);
        bytes32 deficitSubject = _syncSubject(preDeficit, postDeficit);
        assertEq(deficitMutation, _mutationId(3, MUTATION_SYNC, deficitSubject));
        assertEq(deficitLogs.length, 2);
        _assertComponentLog(
            deficitLogs[1],
            3,
            0,
            _componentId(deficitMutation, 0, COMPONENT_DEFICIT_OBSERVATION, deficitSubject, 6 ether),
            COMPONENT_DEFICIT_OBSERVATION,
            deficitSubject,
            6 ether
        );

        vm.deal(address(vault), 10 ether);
        AccountingTotals memory preClear = _totals();
        vm.recordLogs();
        bytes32 clearMutation = _sync();
        Vm.Log[] memory clearLogs = vm.getRecordedLogs();
        AccountingTotals memory postClear = _totals();
        bytes32 clearSubject = _syncSubject(preClear, postClear);
        assertEq(clearMutation, _mutationId(4, MUTATION_SYNC, clearSubject));
        assertEq(clearLogs.length, 2);
        _assertComponentLog(
            clearLogs[1],
            4,
            0,
            _componentId(clearMutation, 0, COMPONENT_DEFICIT_OBSERVATION, clearSubject, 0),
            COMPONENT_DEFICIT_OBSERVATION,
            clearSubject,
            0
        );
        assertEq(_word(LAST_DEFICIT_SELECTOR), 0);
    }

    function test_syncCreditsOnlyForcedSurplusAboveExistingBacking() public {
        _force(10 ether);
        _sync();
        _reclassify(6 ether, DETAILS);
        AccountingTotals memory backed = _totals();
        assertEq(backed.accountedBackingWei, 10 ether);
        _force(3 ether);
        AccountingTotals memory beforeSync = _totals();
        assertEq(beforeSync.forcedSurplusWei, 3 ether);
        _sync();
        AccountingTotals memory afterSync = _totals();
        assertEq(afterSync.availableWei, 6 ether);
        assertEq(afterSync.unattributedWei, 7 ether);
        assertEq(afterSync.accountedBackingWei, 13 ether);
        assertEq(afterSync.forcedSurplusWei, 0);
    }

    function test_syncObservedDeficitProgressesFourToTwoToZeroThenRejectsDuplicate() public {
        _force(4 ether);
        _sync();
        _reclassify(4 ether, DETAILS);

        vm.deal(address(vault), 0);
        _sync();
        assertEq(_word(LAST_DEFICIT_SELECTOR), 4 ether);
        vm.deal(address(vault), 2 ether);
        _sync();
        assertEq(_word(LAST_DEFICIT_SELECTOR), 2 ether);
        vm.deal(address(vault), 4 ether);
        _sync();
        assertEq(_word(LAST_DEFICIT_SELECTOR), 0);

        uint256 sequence = _word(SEQUENCE_SELECTOR);
        vm.recordLogs();
        vm.expectRevert(A1Task4Errors.NoBalanceDelta.selector);
        _sync();
        assertEq(vm.getRecordedLogs().length, 0);
        assertEq(_word(SEQUENCE_SELECTOR), sequence);
    }

    function test_syncCombinedSurplusAndDeficitClearingUsesContiguousDeterministicComponentOrder() public {
        _force(10 ether);
        _sync();
        _reclassify(10 ether, DETAILS);
        vm.deal(address(vault), 5 ether);
        _sync();
        assertEq(_word(LAST_DEFICIT_SELECTOR), 5 ether);
        vm.deal(address(vault), 12 ether);
        AccountingTotals memory preTotals = _totals();

        vm.recordLogs();
        bytes32 mutationId = _sync();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        AccountingTotals memory postTotals = _totals();
        bytes32 subjectId = _syncSubject(preTotals, postTotals);
        assertEq(logs.length, 3);
        _assertMutationLog(logs[0], 4, mutationId, MUTATION_SYNC, preTotals, postTotals, 2);
        _assertComponentLog(
            logs[1],
            4,
            0,
            _componentId(mutationId, 0, COMPONENT_FORCED_TO_UNATTRIBUTED, subjectId, 2 ether),
            COMPONENT_FORCED_TO_UNATTRIBUTED,
            subjectId,
            2 ether
        );
        _assertComponentLog(
            logs[2],
            4,
            1,
            _componentId(mutationId, 1, COMPONENT_DEFICIT_OBSERVATION, subjectId, 0),
            COMPONENT_DEFICIT_OBSERVATION,
            subjectId,
            0
        );
    }

    function test_safeReclassificationIsPauseIndependentAndEmitsExactOrderedEvidence() public {
        _force(9 ether);
        _sync();
        AccountingTotals memory preTotals = _totals();
        AccountingTotals memory postTotals = AccountingTotals(4 ether, 5 ether, 0, 0, 0, 0, 9 ether, 9 ether, 0, 0, 2);
        bytes32 mutationId = _mutationId(2, MUTATION_RECLASSIFY, DETAILS);
        bytes32 componentId = _componentId(mutationId, 0, COMPONENT_UNATTRIBUTED_TO_AVAILABLE, DETAILS, 4 ether);

        vm.recordLogs();
        assertEq(_reclassify(4 ether, DETAILS), mutationId);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 3);
        _assertMutationLog(logs[0], 2, mutationId, MUTATION_RECLASSIFY, preTotals, postTotals, 1);
        _assertComponentLog(logs[1], 2, 0, componentId, COMPONENT_UNATTRIBUTED_TO_AVAILABLE, DETAILS, 4 ether);
        assertEq(logs[2].topics[0], RECLASSIFIED_SIG);
        assertEq(logs[2].topics[1], mutationId);
        assertEq(logs[2].topics[2], bytes32(uint256(2)));
        assertEq(logs[2].topics[3], bytes32(uint256(uint160(address(safe)))));
        assertEq(logs[2].data, abi.encode(4 ether, REASON_RECLASSIFIED, DETAILS));
        _assertTotalsEq(_totals(), postTotals);

        _forcePaused(false);
        _force(1 ether);
        _sync();
        _reclassify(1 ether, keccak256("unpaused-reclassification"));
        assertEq(address(vault).balance, 10 ether, "reclassification moved ETH");
    }

    function test_reclassificationValidationAndDeficitShortfallGatesAreAtomic() public {
        _force(5 ether);
        _sync();
        vm.expectRevert(abi.encodeWithSelector(A1Task4Errors.OwnableUnauthorizedAccount.selector, address(this)));
        vault.reclassifyUnattributed(1, DETAILS);

        _assertSafeRevert(
            abi.encodeWithSelector(RECLASSIFY_SELECTOR, 1, bytes32(0)),
            abi.encodeWithSelector(A1Task4Errors.EmptyDetailsHash.selector)
        );
        _assertSafeRevert(
            abi.encodeWithSelector(RECLASSIFY_SELECTOR, 0, DETAILS),
            abi.encodeWithSelector(A1Task4Errors.InvalidAmount.selector)
        );
        _assertSafeRevert(
            abi.encodeWithSelector(RECLASSIFY_SELECTOR, 6 ether, DETAILS),
            abi.encodeWithSelector(A1Task4Errors.InsufficientUnattributed.selector, 5 ether, 6 ether)
        );

        vm.deal(address(vault), 4 ether);
        _assertSafeRevert(
            abi.encodeWithSelector(RECLASSIFY_SELECTOR, 1 ether, DETAILS),
            abi.encodeWithSelector(A1Task4Errors.BalanceDeficitActive.selector, 1 ether)
        );
        vm.deal(address(vault), 5 ether);

        _write(LIABILITY_SELECTOR, 2 ether);
        _write(BACKING_SELECTOR, 1 ether);
        vm.deal(address(vault), 6 ether);
        _assertSafeRevert(
            abi.encodeWithSelector(RECLASSIFY_SELECTOR, 1 ether, DETAILS),
            abi.encodeWithSelector(A1Task4Errors.ReconciliationShortfallActive.selector, 1 ether)
        );
    }

    function test_syncAndReclassificationSequenceExhaustionFailBeforeWritesOrLogs() public {
        _force(3 ether);
        _write(SEQUENCE_SELECTOR, type(uint256).max);
        AccountingTotals memory beforeSync = _totals();
        vm.recordLogs();
        vm.expectRevert(abi.encodeWithSelector(A1Task4Errors.CounterExhausted.selector, SEQUENCE_LABEL));
        _sync();
        assertEq(vm.getRecordedLogs().length, 0);
        _assertTotalsEq(_totals(), beforeSync);

        _write(SEQUENCE_SELECTOR, 0);
        _sync();
        _write(SEQUENCE_SELECTOR, type(uint256).max);
        AccountingTotals memory beforeReclassify = _totals();
        vm.recordLogs();
        _assertSafeRevert(
            abi.encodeWithSelector(RECLASSIFY_SELECTOR, 1 ether, DETAILS),
            abi.encodeWithSelector(A1Task4Errors.CounterExhausted.selector, SEQUENCE_LABEL)
        );
        assertEq(vm.getRecordedLogs().length, 0);
        _assertTotalsEq(_totals(), beforeReclassify);
    }

    function test_syncObservationOnlySequenceExhaustionFailsBeforeObservationWrite() public {
        _force(2 ether);
        _sync();
        _reclassify(2 ether, DETAILS);
        vm.deal(address(vault), 1 ether);
        _write(SEQUENCE_SELECTOR, type(uint256).max);
        AccountingTotals memory beforeTotals = _totals();
        assertEq(_word(LAST_DEFICIT_SELECTOR), 0);
        vm.recordLogs();
        vm.expectRevert(abi.encodeWithSelector(A1Task4Errors.CounterExhausted.selector, SEQUENCE_LABEL));
        _sync();
        assertEq(vm.getRecordedLogs().length, 0);
        assertEq(_word(LAST_DEFICIT_SELECTOR), 0);
        _assertTotalsEq(_totals(), beforeTotals);
    }

    function test_syncAndReclassificationArePauseIndependentAndO1MutationsRemainNonfinancial() public {
        _force(2 ether);
        _sync();
        _reclassify(1 ether, DETAILS);
        uint256 sequence = _word(SEQUENCE_SELECTOR);
        uint256 available = _word(AVAILABLE_SELECTOR);
        uint256 unattributed = _word(UNATTRIBUTED_SELECTOR);

        _forcePaused(false);
        _force(1 ether);
        _sync();
        _reclassify(1 ether, keccak256("second"));
        uint256 afterFinancial = _word(SEQUENCE_SELECTOR);
        assertEq(afterFinancial, sequence + 2);

        _forcePaused(true);
        safe.execute(address(vault), abi.encodeCall(vault.nominateMainOperator, (makeAddr("candidate"), DETAILS)));
        assertEq(_word(SEQUENCE_SELECTOR), afterFinancial);
        assertEq(_word(AVAILABLE_SELECTOR), available + 1 ether);
        assertEq(_word(UNATTRIBUTED_SELECTOR), unattributed);
    }

    function test_task4UnpauseFailsExactlyActiveIngressMissingAfterAccountingPredicates() public {
        vm.expectRevert(
            abi.encodeWithSelector(A1Task4Errors.LocalReadinessFailed.selector, READINESS_ACTIVE_INGRESS_MISSING)
        );
        safe.execute(address(vault), abi.encodeCall(vault.unpause, (DETAILS)));

        _force(1 ether);
        _sync();
        _reclassify(1 ether, DETAILS);
        vm.deal(address(vault), 0);
        vm.expectRevert(abi.encodeWithSelector(A1Task4Errors.LocalReadinessFailed.selector, uint8(5)));
        safe.execute(address(vault), abi.encodeCall(vault.unpause, (DETAILS)));

        vm.deal(address(vault), 1 ether);
        _write(LIABILITY_SELECTOR, 1 ether);
        vm.deal(address(vault), 2 ether);
        vm.expectRevert(abi.encodeWithSelector(A1Task4Errors.LocalReadinessFailed.selector, uint8(6)));
        safe.execute(address(vault), abi.encodeCall(vault.unpause, (DETAILS)));
    }

    function test_noReceiveFallbackPayableOrTask5SurfaceLeaksIntoTask4() public {
        (bool emptyOk,) = address(vault).staticcall("");
        assertFalse(emptyOk);
        (bool unknownOk,) = address(vault).staticcall(hex"deadbeef");
        assertFalse(unknownOk);

        vm.deal(address(this), 2 ether);
        uint256 beforeSender = address(this).balance;
        uint256 beforeVault = address(vault).balance;
        (bool emptyValueOk,) = address(vault).call{value: 1 ether}("");
        assertFalse(emptyValueOk, "empty calldata unexpectedly accepted ETH");
        assertEq(address(vault).balance, beforeVault, "reverted empty call retained ETH");
        assertEq(address(this).balance, beforeSender, "reverted empty call did not refund ETH");
        (bool unknownValueOk,) = address(vault).call{value: 1 ether}(hex"deadbeef");
        assertFalse(unknownValueOk, "unknown selector unexpectedly accepted ETH");
        assertEq(address(vault).balance, beforeVault, "reverted unknown call retained ETH");
        assertEq(address(this).balance, beforeSender, "reverted unknown call did not refund ETH");

        string memory artifact =
            vm.readFile(string.concat(vm.projectRoot(), "/out/AcquisitionVault.sol/AcquisitionVault.json"));
        string[] memory methods = vm.parseJsonKeys(artifact, ".methodIdentifiers");
        assertEq(methods.length, 52, "Task-4 method count drift");
        string[8] memory forbidden = [
            "depositCanonical(bytes32)",
            "proposeIngress((address,bytes32,uint256,uint256,uint256),bytes32)",
            "activateIngress(bytes32)",
            "disableIngress(bytes32)",
            "authorizePreVoteBudget((uint256,uint256,uint64),bytes32)",
            "globalLifetimeCanonicalDepositedWei()",
            "getDeposit(bytes32)",
            "getPreVoteBudget(uint256)"
        ];
        for (uint256 i; i < forbidden.length; ++i) {
            for (uint256 j; j < methods.length; ++j) {
                assertNotEq(keccak256(bytes(methods[j])), keccak256(bytes(forbidden[i])), "future selector leaked");
            }
        }
    }
}
