// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {StdStorage, stdStorage} from "forge-std/StdStorage.sol";
import {AcquisitionVault} from "../src/AcquisitionVault.sol";
import {IAcquisitionVaultV1} from "../src/interfaces/IAcquisitionVaultV1.sol";

interface O1LiteralErrors {
    error WrongChain(uint256 actualChainId);
    error ZeroAddress();
    error ContractRequired(address target);
    error RoleIdentityCollision(address candidate);
    error RegistryChainMismatch(uint256 actualChainId);
    error OwnershipRenunciationDisabled();
    error NoPendingOwnershipTransfer();
    error EmptyDetailsHash();
    error InvalidActionReason(uint8 supplied);
    error CounterExhausted(bytes32 counterName);
    error TimestampOverflow();
    error MainOperatorActive(address operator);
    error NoMainOperator();
    error OperatorNominationPending(bytes32 proposalId);
    error OperatorNominationMissing();
    error ProposalIdMismatch(bytes32 expectedId, bytes32 actualId);
    error NotNominee(address caller);
    error ProposalNotReady(uint64 eligibleAt);
    error ProposalExpired(uint64 expiresAt);
    error NoOperatorStateChange();
    error InvalidOperatorReplacement();
    error InvalidOutflowNonceStep(uint256 currentNonce, uint256 suppliedNonce);
    error OutflowNonceExhausted(uint256 currentNonce);
    error InvalidAuthorizationWindow();
    error AuthorizationNotYetValid();
    error AuthorizationExpired();
    error InvalidAuthorizationFields();
    error InvalidShortString();
    error InvalidSignature();
    error InsufficientSignatureValidationGas();
    error LocalReadinessFailed(uint8 condition);
    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);
    error EnforcedPause();
    error ExpectedPause();
    error ReentrancyGuardReentrantCall();
    error StringTooLong(string str);
}

contract O1SafeActor {
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

contract O1RegistryProbe {
    enum Mode {
        WORD,
        REVERT_EMPTY,
        REVERT_DATA,
        EMPTY,
        SHORT,
        OVERSIZED,
        RETURNDATA_BOMB
    }

    bytes4 internal constant SUPPORTED_CHAIN_ID_SELECTOR = bytes4(keccak256("supportedChainId()"));

    Mode public mode;
    uint256 public response;

    constructor(uint256 response_) {
        response = response_;
    }

    function configure(Mode mode_, uint256 response_) external {
        mode = mode_;
        response = response_;
    }

    fallback() external {
        if (msg.sig != SUPPORTED_CHAIN_ID_SELECTOR || msg.data.length != 4) revert();

        Mode selected = mode;
        uint256 value = response;
        if (selected == Mode.REVERT_EMPTY) {
            assembly ("memory-safe") {
                revert(0, 0)
            }
        }
        if (selected == Mode.REVERT_DATA) revert("registry-controlled-data");
        if (selected == Mode.EMPTY) {
            assembly ("memory-safe") {
                return(0, 0)
            }
        }
        if (selected == Mode.SHORT) {
            assembly ("memory-safe") {
                mstore(0, value)
                return(1, 31)
            }
        }
        if (selected == Mode.OVERSIZED) {
            assembly ("memory-safe") {
                mstore(0, value)
                mstore(32, not(0))
                return(0, 64)
            }
        }
        if (selected == Mode.RETURNDATA_BOMB) {
            // A bounded caller needs only RETURNDATASIZE and the first word. A
            // high-level call that allocates/copies this response exhausts the
            // deliberately narrow constructor budget used by the RED test.
            assembly ("memory-safe") {
                return(0, 0x100000)
            }
        }
        assembly ("memory-safe") {
            mstore(0, value)
            return(0, 32)
        }
    }
}

contract O1ERC1271Mock {
    enum Mode {
        VALID,
        WRONG_MAGIC,
        RETURN_0,
        RETURN_4,
        RETURN_31,
        RETURN_33,
        RETURN_64,
        REVERT_EMPTY,
        REVERT_DATA,
        BURN_GAS,
        CONSUME_THEN_VALID,
        SIGNATURE_BOUND,
        GAS_WINDOW,
        REENTER,
        RIGHT_ALIGNED_MAGIC,
        RETURNDATA_BOMB,
        PRESTATE_WITNESS
    }

    bytes4 internal constant ERC1271_SELECTOR = 0x1626ba7e;
    bytes4 internal constant WRONG_MAGIC = 0xffffffff;

    Mode public mode;
    bytes32 public expectedDigest;
    bytes32 public expectedSignatureHash;
    address public reentryTarget;
    bytes public reentryCalldata;
    address public witnessedVault;
    bytes32 public expectedPrestateHash;

    function configure(Mode mode_) external {
        mode = mode_;
    }

    function configureBound(bytes32 digest, bytes calldata signature) external {
        expectedDigest = digest;
        expectedSignatureHash = keccak256(signature);
        mode = Mode.SIGNATURE_BOUND;
    }

    function configureReentry(address target, bytes calldata data) external {
        reentryTarget = target;
        reentryCalldata = data;
        mode = Mode.REENTER;
    }

    function configurePrestateWitness(address target, bytes32 expectedStateHash) external {
        witnessedVault = target;
        expectedPrestateHash = expectedStateHash;
        mode = Mode.PRESTATE_WITNESS;
    }

    function execute(address target, bytes calldata data) external returns (bytes memory result) {
        (bool ok, bytes memory returndata) = target.call(data);
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(returndata, 0x20), mload(returndata))
            }
        }
        return returndata;
    }

    fallback() external {
        if (msg.sig != ERC1271_SELECTOR) revert();
        Mode selected = mode;

        if (selected == Mode.REVERT_EMPTY) {
            assembly ("memory-safe") {
                revert(0, 0)
            }
        }
        if (selected == Mode.REVERT_DATA) revert("wallet-controlled-data");
        if (selected == Mode.BURN_GAS) {
            assembly ("memory-safe") {
                for {} 1 {} { pop(keccak256(0, 0)) }
            }
        }
        if (selected == Mode.CONSUME_THEN_VALID) {
            assembly ("memory-safe") {
                for {} gt(gas(), 8000) {} { mstore(0, keccak256(0, 32)) }
            }
        }
        if (selected == Mode.SIGNATURE_BOUND) {
            (bytes32 digest, bytes memory signature) = abi.decode(msg.data[4:], (bytes32, bytes));
            if (digest != expectedDigest || keccak256(signature) != expectedSignatureHash) {
                _returnSized(_word(WRONG_MAGIC), 32);
            }
        }
        if (selected == Mode.GAS_WINDOW) {
            uint256 entryGas = gasleft();
            if (entryGas < 98_000 || entryGas > 100_000) _returnSized(_word(WRONG_MAGIC), 32);
        }
        if (selected == Mode.REENTER) {
            (bool reentered, bytes memory returndata) = reentryTarget.staticcall(reentryCalldata);
            bytes4 actual;
            if (returndata.length >= 4) {
                assembly ("memory-safe") {
                    actual := mload(add(returndata, 0x20))
                }
            }
            if (reentered || actual != bytes4(keccak256("ReentrancyGuardReentrantCall()"))) {
                _returnSized(_word(WRONG_MAGIC), 32);
            }
        }
        if (selected == Mode.PRESTATE_WITNESS && _vaultStateHash() != expectedPrestateHash) {
            _returnSized(_word(WRONG_MAGIC), 32);
        }
        if (selected == Mode.WRONG_MAGIC) _returnSized(_word(WRONG_MAGIC), 32);
        if (selected == Mode.RIGHT_ALIGNED_MAGIC) {
            _returnSized(bytes32(uint256(uint32(ERC1271_SELECTOR))), 32);
        }
        if (selected == Mode.RETURNDATA_BOMB) {
            // 160 KiB is producible inside the 100k stipend but makes an
            // unbounded caller copy consume the required post-call reserve.
            assembly ("memory-safe") {
                return(0, 0x28000)
            }
        }
        if (selected == Mode.RETURN_0) _returnSized(bytes32(0), 0);
        if (selected == Mode.RETURN_4) _returnSized(_word(ERC1271_SELECTOR), 4);
        if (selected == Mode.RETURN_31) _returnSized(_word(ERC1271_SELECTOR), 31);
        if (selected == Mode.RETURN_33) _returnSized(_word(ERC1271_SELECTOR), 33);
        if (selected == Mode.RETURN_64) _returnSized(_word(ERC1271_SELECTOR), 64);
        _returnSized(_word(ERC1271_SELECTOR), 32);
    }

    function _word(bytes4 value) private pure returns (bytes32) {
        return bytes32(uint256(uint32(value)) << 224);
    }

    function _vaultStateHash() private view returns (bytes32) {
        AcquisitionVault target = AcquisitionVault(witnessedVault);
        IAcquisitionVaultV1.PendingOperatorNomination memory pending = target.pendingMainOperatorNomination();
        return keccak256(
            abi.encode(
                target.owner(),
                target.pendingOwner(),
                target.stockTokenRegistryV2(),
                target.mainOperator(),
                target.operatorGeneration(),
                target.outflowNonce(),
                target.nominationNonce(),
                pending,
                target.paused()
            )
        );
    }

    function _returnSized(bytes32 word, uint256 length) private pure {
        assembly ("memory-safe") {
            mstore(0, word)
            return(0, length)
        }
    }
}

contract O1SignatureGasBoundaryHarness is AcquisitionVault {
    constructor(address safeOwner, address registry, uint256 globalCap)
        AcquisitionVault(safeOwner, registry, globalCap)
    {}

    function requireErc1271PrecallGas(uint256 observedGas) external pure {
        _requireErc1271PrecallGas(observedGas);
    }

    function requireErc1271PostcallGas(uint256 observedGas) external pure {
        _requireErc1271PostcallGas(observedGas);
    }
}

contract O1CreateFactory {
    function deploy(address safeOwner, address registry, uint256 globalCap) external returns (AcquisitionVault vault) {
        vault = new AcquisitionVault(safeOwner, registry, globalCap);
    }
}

contract AcquisitionVaultOperatorTest is Test {
    using stdStorage for StdStorage;

    uint256 internal constant CHAIN_ID = 4663;
    uint64 internal constant NOMINATION_DELAY = 48 hours;
    uint64 internal constant ACCEPTANCE_WINDOW = 7 days;
    uint64 internal constant MAX_AUTH_LIFETIME = 1 hours;
    uint256 internal constant MAX_SIGNATURE_BYTES = 4_096;
    uint256 internal constant ERC1271_CALL_GAS = 100_000;
    uint256 internal constant ERC1271_POST_RESERVE = 50_000;
    uint256 internal constant ERC1271_MIN_PRECALL_GAS = 160_000;
    uint256 internal constant GLOBAL_CAP = 10_000 ether;
    uint256 internal constant SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    uint8 internal constant REASON_NONE = 0;
    uint8 internal constant REASON_NOMINATED = 4;
    uint8 internal constant REASON_CANCELLED = 5;
    uint8 internal constant REASON_EXPIRED = 6;
    uint8 internal constant REASON_DISABLED = 7;
    uint8 internal constant REASON_RENOUNCED = 8;
    uint8 internal constant REASON_REPLACED = 9;
    uint8 internal constant REASON_NONCE_INVALIDATED = 10;
    uint8 internal constant REASON_PAUSED = 11;
    uint8 internal constant REASON_UNPAUSED = 12;

    uint8 internal constant READINESS_WRONG_CHAIN = 1;
    uint8 internal constant READINESS_OWNER_CODE_MISSING = 2;
    uint8 internal constant READINESS_REGISTRY_CODE_MISSING = 3;
    uint8 internal constant READINESS_ROLE_COLLISION = 4;
    uint8 internal constant READINESS_ACTIVE_INGRESS_MISSING = 7;

    bytes32 internal constant NOMINATION_TYPE_TAG = keccak256("OMERTA_ACQUISITION_OPERATOR_NOMINATION_V1");
    bytes32 internal constant EXPIRY_DETAILS_TYPE_TAG = keccak256("OMERTA_ACQUISITION_OPERATOR_EXPIRY_DETAILS_V1");
    bytes32 internal constant OWNERSHIP_ACCEPTANCE_CANCEL_TYPE_TAG =
        keccak256("OMERTA_ACQUISITION_OPERATOR_OWNERSHIP_ACCEPTANCE_CANCEL_V1");
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant OUTFLOW_TYPEHASH = keccak256(
        "OutflowAuthorization(address operator,address destination,uint256 amountWei,uint256 generation,uint256 nonce,uint64 issuedAt,uint64 deadline,uint8 reasonCode,bytes32 detailsHash)"
    );
    bytes32 internal constant SUCCESSOR_TYPEHASH = keccak256(
        "SuccessorConsent(address currentOperator,address successor,uint256 generation,uint256 outflowNonce,uint64 issuedAt,uint64 deadline,uint8 reasonCode,bytes32 detailsHash)"
    );
    bytes32 internal constant DETAILS = keccak256("operator-evidence-details");
    bytes32 internal constant SECOND_DETAILS = keccak256("operator-evidence-details-2");

    uint256 internal successorKey = 0xA11CE;
    uint256 internal wrongKey = 0xBAD;
    address internal operator = makeAddr("operator");
    address internal stranger = makeAddr("stranger");

    O1SafeActor internal safe;
    O1RegistryProbe internal registry;
    AcquisitionVault internal vault;
    event MainOperatorNominationCreated(
        bytes32 indexed proposalId,
        address indexed nominee,
        address indexed proposedBy,
        uint256 proposalNumber,
        uint64 proposedAt,
        uint64 validAfter,
        uint64 expiresAt,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event MainOperatorNominationCancelled(
        bytes32 indexed proposalId,
        address indexed nominee,
        address indexed actor,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event MainOperatorNominationExpired(
        bytes32 indexed proposalId,
        address indexed nominee,
        address indexed actor,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event MainOperatorChanged(
        address indexed previousOperator,
        address indexed newOperator,
        uint256 indexed operatorGeneration,
        uint256 outflowNonce,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event OutflowNonceInvalidated(
        address indexed operator,
        uint256 indexed operatorGeneration,
        uint256 previousNonce,
        uint256 newNonce,
        uint8 reasonCode,
        bytes32 detailsHash
    );
    event RiskPaused(address indexed actor, uint8 reasonCode, bytes32 detailsHash);
    event RiskUnpaused(address indexed actor, uint8 reasonCode, bytes32 detailsHash);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address account);
    event Unpaused(address account);

    struct O1State {
        address owner;
        address pendingOwner;
        address registry;
        address mainOperator;
        uint256 generation;
        uint256 nonce;
        uint256 nominationNonce;
        bytes32 proposalId;
        uint256 proposalNumber;
        address nominee;
        address proposedBy;
        uint64 proposedAt;
        uint64 validAfter;
        uint64 expiresAt;
        bytes32 detailsHash;
        bool paused;
    }

    function setUp() public {
        vm.chainId(CHAIN_ID);
        vm.warp(30 days);
        safe = new O1SafeActor();
        registry = new O1RegistryProbe(CHAIN_ID);
        vault = new AcquisitionVault(address(safe), address(registry), GLOBAL_CAP);
    }

    function _safeCall(bytes memory data) internal returns (bytes memory) {
        return safe.execute(address(vault), data);
    }

    function _nominate(address nominee, bytes32 detailsHash) internal returns (bytes32 proposalId) {
        bytes memory result = _safeCall(abi.encodeCall(vault.nominateMainOperator, (nominee, detailsHash)));
        proposalId = abi.decode(result, (bytes32));
    }

    function _appoint(address nominee) internal returns (bytes32 proposalId) {
        proposalId = _nominate(nominee, DETAILS);
        IAcquisitionVaultV1.PendingOperatorNomination memory pending = vault.pendingMainOperatorNomination();
        vm.warp(pending.validAfter);
        vm.prank(nominee);
        vault.acceptMainOperatorNomination(proposalId);
    }

    function _appointContract(O1ERC1271Mock nominee) internal returns (bytes32 proposalId) {
        proposalId = _nominate(address(nominee), DETAILS);
        IAcquisitionVaultV1.PendingOperatorNomination memory pending = vault.pendingMainOperatorNomination();
        vm.warp(pending.validAfter);
        nominee.execute(address(vault), abi.encodeCall(vault.acceptMainOperatorNomination, (proposalId)));
    }

    function _pending() internal view returns (IAcquisitionVaultV1.PendingOperatorNomination memory) {
        return vault.pendingMainOperatorNomination();
    }

    function _expectedNominationId(
        uint256 proposalNumber,
        address proposedBy,
        address nominee,
        uint64 proposedAt,
        uint64 validAfter,
        uint64 expiresAt,
        bytes32 detailsHash
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                NOMINATION_TYPE_TAG,
                uint256(CHAIN_ID),
                address(vault),
                proposalNumber,
                proposedBy,
                nominee,
                proposedAt,
                validAfter,
                expiresAt,
                detailsHash
            )
        );
    }

    function _domainSeparator(uint256 chainId, address verifyingContract) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("OMERTA AcquisitionVault")),
                keccak256(bytes("1")),
                chainId,
                verifyingContract
            )
        );
    }

    function _outflowStructHash(IAcquisitionVaultV1.OutflowAuthorization memory authorization)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                OUTFLOW_TYPEHASH,
                authorization.operator,
                authorization.destination,
                authorization.amountWei,
                authorization.generation,
                authorization.nonce,
                authorization.issuedAt,
                authorization.deadline,
                authorization.reasonCode,
                authorization.detailsHash
            )
        );
    }

    function _successorStructHash(IAcquisitionVaultV1.SuccessorConsent memory consent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                SUCCESSOR_TYPEHASH,
                consent.currentOperator,
                consent.successor,
                consent.generation,
                consent.outflowNonce,
                consent.issuedAt,
                consent.deadline,
                consent.reasonCode,
                consent.detailsHash
            )
        );
    }

    function _typedDigest(bytes32 domainSeparator, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", domainSeparator, structHash));
    }

    function _successorDigest(IAcquisitionVaultV1.SuccessorConsent memory consent) internal view returns (bytes32) {
        return _typedDigest(_domainSeparator(CHAIN_ID, address(vault)), _successorStructHash(consent));
    }

    function _sign(uint256 privateKey, bytes32 digest) internal returns (bytes memory signature) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        signature = abi.encodePacked(r, s, v);
    }

    function _validConsent(address successor) internal view returns (IAcquisitionVaultV1.SuccessorConsent memory) {
        return IAcquisitionVaultV1.SuccessorConsent({
            currentOperator: vault.mainOperator(),
            successor: successor,
            generation: vault.operatorGeneration(),
            outflowNonce: vault.outflowNonce(),
            issuedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + MAX_AUTH_LIFETIME),
            reasonCode: REASON_REPLACED,
            detailsHash: DETAILS
        });
    }

    function _state() internal view returns (O1State memory current) {
        IAcquisitionVaultV1.PendingOperatorNomination memory pending = vault.pendingMainOperatorNomination();
        current = O1State({
            owner: vault.owner(),
            pendingOwner: vault.pendingOwner(),
            registry: vault.stockTokenRegistryV2(),
            mainOperator: vault.mainOperator(),
            generation: vault.operatorGeneration(),
            nonce: vault.outflowNonce(),
            nominationNonce: vault.nominationNonce(),
            proposalId: pending.proposalId,
            proposalNumber: pending.proposalNumber,
            nominee: pending.nominee,
            proposedBy: pending.proposedBy,
            proposedAt: pending.proposedAt,
            validAfter: pending.validAfter,
            expiresAt: pending.expiresAt,
            detailsHash: pending.detailsHash,
            paused: vault.paused()
        });
    }

    function _assertStateEq(O1State memory left, O1State memory right) internal pure {
        assertEq(left.owner, right.owner, "owner changed");
        assertEq(left.pendingOwner, right.pendingOwner, "pending owner changed");
        assertEq(left.registry, right.registry, "registry changed");
        assertEq(left.mainOperator, right.mainOperator, "operator changed");
        assertEq(left.generation, right.generation, "generation changed");
        assertEq(left.nonce, right.nonce, "nonce changed");
        assertEq(left.nominationNonce, right.nominationNonce, "nomination nonce changed");
        assertEq(left.proposalId, right.proposalId, "proposal ID changed");
        assertEq(left.proposalNumber, right.proposalNumber, "proposal number changed");
        assertEq(left.nominee, right.nominee, "nominee changed");
        assertEq(left.proposedBy, right.proposedBy, "proposer changed");
        assertEq(left.proposedAt, right.proposedAt, "proposal time changed");
        assertEq(left.validAfter, right.validAfter, "valid-after changed");
        assertEq(left.expiresAt, right.expiresAt, "expiry changed");
        assertEq(left.detailsHash, right.detailsHash, "proposal details changed");
        assertEq(left.paused, right.paused, "pause state changed");
    }

    function _stateHash(O1State memory state_) internal pure returns (bytes32) {
        return keccak256(abi.encode(state_));
    }

    function _assertRevertData(bytes memory actual, bytes memory expected) internal pure {
        assertEq(keccak256(actual), keccak256(expected), "unexpected revert data");
    }

    function _assertReplaceFailure(
        address caller,
        IAcquisitionVaultV1.SuccessorConsent memory consent,
        bytes memory signature,
        bytes memory expectedError
    ) internal {
        O1State memory beforeState = _state();
        vm.recordLogs();
        vm.prank(caller);
        (bool ok, bytes memory returndata) =
            address(vault).call(abi.encodeCall(vault.replaceMainOperator, (consent, signature)));
        assertFalse(ok, "replacement unexpectedly succeeded");
        _assertRevertData(returndata, expectedError);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 0, "failed replacement emitted evidence");
        _assertStateEq(_state(), beforeState);
    }

    function _assertCallFailureUnchanged(address caller, bytes memory callData, bytes memory expectedError) internal {
        O1State memory beforeState = _state();
        vm.recordLogs();
        vm.prank(caller);
        (bool ok, bytes memory returndata) = address(vault).call(callData);
        assertFalse(ok, "call unexpectedly succeeded");
        _assertRevertData(returndata, expectedError);
        assertEq(vm.getRecordedLogs().length, 0, "failed call emitted evidence");
        _assertStateEq(_state(), beforeState);
    }

    function _writeScalar(bytes4 getter, uint256 value) internal {
        stdstore.target(address(vault)).sig(getter).checked_write(value);
    }

    function _writeAddress(bytes4 getter, address value) internal {
        if (getter == vault.pendingOwner.selector) {
            vm.record();
            vault.pendingOwner();
            (bytes32[] memory reads,) = vm.accesses(address(vault));
            assertEq(reads.length, 1, "pendingOwner getter must read one packed slot");
            bytes32 current = vm.load(address(vault), reads[0]);
            uint256 addressMask = type(uint160).max;
            vm.store(address(vault), reads[0], bytes32((uint256(current) & ~addressMask) | uint160(value)));
            assertEq(vault.pendingOwner(), value);
            return;
        }
        stdstore.target(address(vault)).sig(getter).checked_write(value);
    }

    function _writeAddressAtDepth(bytes4 getter, uint256 depth, address value) internal {
        stdstore.target(address(vault)).sig(getter).depth(depth).checked_write(value);
    }

    function _forcePaused(bool value) internal {
        vm.record();
        vault.paused();
        (bytes32[] memory reads,) = vm.accesses(address(vault));
        assertEq(reads.length, 1, "paused getter must read one packed slot");
        bytes32 slot = reads[0];
        uint256 current = uint256(vm.load(address(vault), slot));
        uint256 pausedMask = uint256(0xff) << 160;
        vm.store(address(vault), slot, bytes32((current & ~pausedMask) | (uint256(value ? 1 : 0) << 160)));
        assertEq(vault.paused(), value);
    }

    function _assertRiskTransitionLogs(Vm.Log[] memory logs, bool pausing, address actor, bytes32 detailsHash)
        internal
        view
    {
        assertEq(logs.length, 2, "risk transition must emit exactly inherited + evidence events");
        assertEq(logs[0].emitter, address(vault));
        assertEq(logs[0].topics.length, 1);
        assertEq(logs[0].topics[0], keccak256(bytes(pausing ? "Paused(address)" : "Unpaused(address)")));
        assertEq(logs[0].data, abi.encode(actor));
        assertEq(logs[1].emitter, address(vault));
        assertEq(logs[1].topics.length, 2);
        assertEq(
            logs[1].topics[0],
            keccak256(bytes(pausing ? "RiskPaused(address,uint8,bytes32)" : "RiskUnpaused(address,uint8,bytes32)"))
        );
        assertEq(logs[1].topics[1], bytes32(uint256(uint160(actor))));
        assertEq(logs[1].data, abi.encode(pausing ? REASON_PAUSED : REASON_UNPAUSED, detailsHash));
    }

    function _contains(string[] memory values, string memory needle) internal pure returns (bool) {
        bytes32 expectedHash = keccak256(bytes(needle));
        for (uint256 i; i < values.length; ++i) {
            if (keccak256(bytes(values[i])) == expectedHash) return true;
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

    function _slice(bytes memory value, uint256 from, uint256 to) internal pure returns (bytes memory result) {
        assertLe(from, to);
        assertLe(to, value.length);
        result = new bytes(to - from);
        for (uint256 i; i < result.length; ++i) {
            result[i] = value[from + i];
        }
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
                continue;
            }
            if (current == open) ++depth;
            if (current == close) {
                --depth;
                if (depth == 0) return i;
            }
        }
        revert("unterminated artifact JSON delimiter");
    }

    function _jsonString(bytes memory object, string memory key) internal pure returns (string memory) {
        bytes memory prefix = bytes(string.concat('"', key, "\":\""));
        uint256 start = _find(object, prefix, 0);
        if (start == type(uint256).max) return "";
        start += prefix.length;
        uint256 end = start;
        while (end < object.length && object[end] != bytes1('"')) ++end;
        assertLt(end, object.length, "unterminated artifact JSON string");
        return string(_slice(object, start, end));
    }

    function _jsonArray(bytes memory object, string memory key) internal pure returns (bytes memory) {
        bytes memory prefix = bytes(string.concat('"', key, "\":["));
        uint256 start = _find(object, prefix, 0);
        if (start == type(uint256).max) return "";
        start += prefix.length - 1;
        uint256 end = _matchingDelimiter(object, start, bytes1("["), bytes1("]"));
        return _slice(object, start + 1, end);
    }

    function _parameterType(bytes memory parameter) internal pure returns (string memory) {
        string memory primitive = _jsonString(parameter, "type");
        if (keccak256(bytes(primitive)) != keccak256("tuple")) return primitive;
        return string.concat("(", _parameterTypes(parameter, "components"), ")");
    }

    function _parameterTypes(bytes memory object, string memory key) internal pure returns (string memory types_) {
        bytes memory parameters = _jsonArray(object, key);
        uint256 cursor;
        bool first = true;
        while (cursor < parameters.length) {
            while (cursor < parameters.length && parameters[cursor] != bytes1("{")) ++cursor;
            if (cursor == parameters.length) break;
            uint256 end = _matchingDelimiter(parameters, cursor, bytes1("{"), bytes1("}"));
            string memory parameterType = _parameterType(_slice(parameters, cursor, end + 1));
            types_ = first ? parameterType : string.concat(types_, ",", parameterType);
            first = false;
            cursor = end + 1;
        }
    }

    function _eventIndexedFlags(bytes memory eventEntry) internal pure returns (string memory flags) {
        bytes memory parameters = _jsonArray(eventEntry, "inputs");
        uint256 cursor;
        while (cursor < parameters.length) {
            while (cursor < parameters.length && parameters[cursor] != bytes1("{")) ++cursor;
            if (cursor == parameters.length) break;
            uint256 end = _matchingDelimiter(parameters, cursor, bytes1("{"), bytes1("}"));
            bytes memory parameter = _slice(parameters, cursor, end + 1);
            bool isIndexed = _find(parameter, bytes('"indexed\":true'), 0) != type(uint256).max;
            flags = string.concat(flags, isIndexed ? "1" : "0");
            cursor = end + 1;
        }
    }

    function _abiDescriptor(bytes memory entry) internal pure returns (string memory) {
        string memory kind = _jsonString(entry, "type");
        string memory name = keccak256(bytes(kind)) == keccak256("constructor") ? "" : _jsonString(entry, "name");
        string memory mutability = _jsonString(entry, "stateMutability");
        string memory inputs = _parameterTypes(entry, "inputs");
        string memory outputs = _parameterTypes(entry, "outputs");
        bool isEvent = keccak256(bytes(kind)) == keccak256("event");
        string memory indexedFlags;
        if (isEvent) {
            string memory anonymousFlag = _find(entry, bytes('"anonymous\":false'), 0) != type(uint256).max ? "0" : "1";
            indexedFlags = string.concat(_eventIndexedFlags(entry), ";anonymous=", anonymousFlag);
        }
        return string.concat(kind, "|", name, "|(", inputs, ")->(", outputs, ")|", mutability, "|", indexedFlags);
    }

    function _artifactAbiDescriptors(string memory artifact) internal pure returns (string[] memory descriptors) {
        bytes memory json = bytes(artifact);
        bytes memory marker = bytes('"abi\":[');
        uint256 opening = _find(json, marker, 0);
        assertNotEq(opening, type(uint256).max, "artifact ABI missing");
        opening += marker.length - 1;
        uint256 closing = _matchingDelimiter(json, opening, bytes1("["), bytes1("]"));
        uint256 count;
        for (uint256 cursor = opening + 1; cursor < closing;) {
            while (cursor < closing && json[cursor] != bytes1("{")) ++cursor;
            if (cursor == closing) break;
            uint256 end = _matchingDelimiter(json, cursor, bytes1("{"), bytes1("}"));
            ++count;
            cursor = end + 1;
        }
        descriptors = new string[](count);
        uint256 index;
        for (uint256 cursor = opening + 1; cursor < closing;) {
            while (cursor < closing && json[cursor] != bytes1("{")) ++cursor;
            if (cursor == closing) break;
            uint256 end = _matchingDelimiter(json, cursor, bytes1("{"), bytes1("}"));
            descriptors[index++] = _abiDescriptor(_slice(json, cursor, end + 1));
            cursor = end + 1;
        }
    }

    function _assertExactDescriptorSet(string[] memory actual, string[] memory expected) internal pure {
        assertEq(actual.length, expected.length, "unexpected ABI entry count");
        bool[] memory matched = new bool[](expected.length);
        for (uint256 i; i < actual.length; ++i) {
            bytes32 actualHash = keccak256(bytes(actual[i]));
            bool found;
            for (uint256 j; j < expected.length; ++j) {
                if (!matched[j] && actualHash == keccak256(bytes(expected[j]))) {
                    matched[j] = true;
                    found = true;
                    break;
                }
            }
            assertTrue(found, string.concat("unexpected ABI entry: ", actual[i]));
        }
    }

    function _assertDescriptorMembership(string[] memory actual, string[] memory expected) internal pure {
        for (uint256 i; i < expected.length; ++i) {
            assertTrue(_contains(actual, expected[i]), string.concat("missing O1 ABI descriptor: ", expected[i]));
        }
    }

    function _count(bytes memory haystack, bytes memory needle) internal pure returns (uint256 count) {
        uint256 cursor;
        while (cursor < haystack.length) {
            uint256 found = _find(haystack, needle, cursor);
            if (found == type(uint256).max) break;
            ++count;
            cursor = found + needle.length;
        }
    }

    function _stripCommentsAndQuotedStrings(bytes memory source) internal pure returns (bytes memory code) {
        code = bytes.concat(source);
        uint256 i;
        while (i < code.length) {
            if (i + 1 < code.length && code[i] == bytes1("/") && code[i + 1] == bytes1("/")) {
                code[i++] = bytes1(" ");
                code[i++] = bytes1(" ");
                while (i < code.length && code[i] != bytes1("\n")) code[i++] = bytes1(" ");
                continue;
            }
            if (i + 1 < code.length && code[i] == bytes1("/") && code[i + 1] == bytes1("*")) {
                code[i++] = bytes1(" ");
                code[i++] = bytes1(" ");
                while (i + 1 < code.length && !(code[i] == bytes1("*") && code[i + 1] == bytes1("/"))) {
                    code[i++] = bytes1(" ");
                }
                if (i + 1 < code.length) {
                    code[i++] = bytes1(" ");
                    code[i++] = bytes1(" ");
                }
                continue;
            }
            if (code[i] == bytes1('"') || code[i] == bytes1("'")) {
                bytes1 quote = code[i];
                code[i++] = bytes1(" ");
                bool escaped;
                while (i < code.length) {
                    bytes1 current = code[i];
                    code[i++] = bytes1(" ");
                    if (escaped) escaped = false;
                    else if (current == bytes1("\\")) escaped = true;
                    else if (current == quote) break;
                }
                continue;
            }
            ++i;
        }
    }

    function _expectedFunctionAbi() internal pure returns (string[] memory expected) {
        expected = new string[](41);
        expected[0] = "function|owner|()->(address)|view|";
        expected[1] = "function|pendingOwner|()->(address)|view|";
        expected[2] = "function|transferOwnership|(address)->()|nonpayable|";
        expected[3] = "function|acceptOwnership|()->()|nonpayable|";
        expected[4] = "function|renounceOwnership|()->()|nonpayable|";
        expected[5] = "function|paused|()->(bool)|view|";
        expected[6] = "function|eip712Domain|()->(bytes1,string,string,uint256,address,bytes32,uint256[])|view|";
        expected[7] = "function|supportedChainId|()->(uint256)|view|";
        expected[8] = "function|OPERATOR_NOMINATION_DELAY|()->(uint64)|view|";
        expected[9] = "function|OPERATOR_ACCEPTANCE_WINDOW|()->(uint64)|view|";
        expected[10] = "function|INGRESS_PROPOSAL_DELAY|()->(uint64)|view|";
        expected[11] = "function|INGRESS_ACCEPTANCE_WINDOW|()->(uint64)|view|";
        expected[12] = "function|MAX_AUTHORIZATION_LIFETIME|()->(uint64)|view|";
        expected[13] = "function|MAX_SIGNATURE_BYTES|()->(uint256)|view|";
        expected[14] = "function|ERC1271_CALL_GAS|()->(uint256)|view|";
        expected[15] = "function|ERC1271_POST_CALL_GAS_RESERVE|()->(uint256)|view|";
        expected[16] = "function|ERC1271_MIN_PRECALL_GAS|()->(uint256)|view|";
        expected[17] = "function|MAX_ACTIVE_ORDINARY_RESERVATIONS|()->(uint256)|view|";
        expected[18] = "function|MAX_ACTIVE_RECONCILIATIONS|()->(uint256)|view|";
        expected[19] = "function|MAX_OPERATOR_OUTFLOW_COMPONENTS|()->(uint256)|view|";
        expected[20] = "function|OUTFLOW_AUTHORIZATION_TYPEHASH|()->(bytes32)|view|";
        expected[21] = "function|SUCCESSOR_CONSENT_TYPEHASH|()->(bytes32)|view|";
        expected[22] = "function|stockTokenRegistryV2|()->(address)|view|";
        expected[23] = "function|version|()->(string)|view|";
        expected[24] = "function|mainOperator|()->(address)|view|";
        expected[25] = "function|operatorGeneration|()->(uint256)|view|";
        expected[26] = "function|outflowNonce|()->(uint256)|view|";
        expected[27] = "function|nominationNonce|()->(uint256)|view|";
        expected[28] =
            "function|pendingMainOperatorNomination|()->((bytes32,uint256,address,address,uint64,uint64,uint64,bytes32))|view|";
        expected[29] = "function|nominateMainOperator|(address,bytes32)->(bytes32)|nonpayable|";
        expected[30] = "function|cancelMainOperatorNomination|(bytes32,bytes32)->()|nonpayable|";
        expected[31] = "function|expireMainOperatorNomination|(bytes32)->()|nonpayable|";
        expected[32] = "function|acceptMainOperatorNomination|(bytes32)->()|nonpayable|";
        expected[33] = "function|disableMainOperator|(bytes32)->()|nonpayable|";
        expected[34] = "function|renounceMainOperator|(bytes32)->()|nonpayable|";
        expected[35] =
            "function|replaceMainOperator|((address,address,uint256,uint256,uint64,uint64,uint8,bytes32),bytes)->()|nonpayable|";
        expected[36] = "function|invalidateOutflowNonce|(uint256,bytes32)->()|nonpayable|";
        expected[37] = "function|pause|(bytes32)->()|nonpayable|";
        expected[38] = "function|unpause|(bytes32)->()|nonpayable|";
        expected[39] =
            "function|hashOutflowAuthorization|((address,address,uint256,uint256,uint256,uint64,uint64,uint8,bytes32))->(bytes32)|view|";
        expected[40] =
            "function|hashSuccessorConsent|((address,address,uint256,uint256,uint64,uint64,uint8,bytes32))->(bytes32)|view|";
    }

    function _expectedEventAbi() internal pure returns (string[] memory expected) {
        expected = new string[](12);
        expected[0] = "event|EIP712DomainChanged|()->()||;anonymous=0";
        expected[1] = "event|OwnershipTransferStarted|(address,address)->()||11;anonymous=0";
        expected[2] = "event|OwnershipTransferred|(address,address)->()||11;anonymous=0";
        expected[3] = "event|Paused|(address)->()||0;anonymous=0";
        expected[4] = "event|Unpaused|(address)->()||0;anonymous=0";
        expected[5] =
            "event|MainOperatorNominationCreated|(bytes32,address,address,uint256,uint64,uint64,uint64,uint8,bytes32)->()||111000000;anonymous=0";
        expected[6] =
        "event|MainOperatorNominationCancelled|(bytes32,address,address,uint8,bytes32)->()||11100;anonymous=0";
        expected[7] =
        "event|MainOperatorNominationExpired|(bytes32,address,address,uint8,bytes32)->()||11100;anonymous=0";
        expected[8] =
        "event|MainOperatorChanged|(address,address,uint256,uint256,uint8,bytes32)->()||111000;anonymous=0";
        expected[9] =
        "event|OutflowNonceInvalidated|(address,uint256,uint256,uint256,uint8,bytes32)->()||110000;anonymous=0";
        expected[10] = "event|RiskPaused|(address,uint8,bytes32)->()||100;anonymous=0";
        expected[11] = "event|RiskUnpaused|(address,uint8,bytes32)->()||100;anonymous=0";
    }

    function _expectedErrorAbi() internal pure returns (string[] memory expected) {
        expected = new string[](37);
        expected[0] = "error|WrongChain|(uint256)->()||";
        expected[1] = "error|ZeroAddress|()->()||";
        expected[2] = "error|ContractRequired|(address)->()||";
        expected[3] = "error|RoleIdentityCollision|(address)->()||";
        expected[4] = "error|RegistryChainMismatch|(uint256)->()||";
        expected[5] = "error|OwnershipRenunciationDisabled|()->()||";
        expected[6] = "error|NoPendingOwnershipTransfer|()->()||";
        expected[7] = "error|EmptyDetailsHash|()->()||";
        expected[8] = "error|InvalidActionReason|(uint8)->()||";
        expected[9] = "error|CounterExhausted|(bytes32)->()||";
        expected[10] = "error|TimestampOverflow|()->()||";
        expected[11] = "error|MainOperatorActive|(address)->()||";
        expected[12] = "error|NoMainOperator|()->()||";
        expected[13] = "error|OperatorNominationPending|(bytes32)->()||";
        expected[14] = "error|OperatorNominationMissing|()->()||";
        expected[15] = "error|ProposalIdMismatch|(bytes32,bytes32)->()||";
        expected[16] = "error|NotNominee|(address)->()||";
        expected[17] = "error|ProposalNotReady|(uint64)->()||";
        expected[18] = "error|ProposalExpired|(uint64)->()||";
        expected[19] = "error|NoOperatorStateChange|()->()||";
        expected[20] = "error|InvalidOperatorReplacement|()->()||";
        expected[21] = "error|InvalidOutflowNonceStep|(uint256,uint256)->()||";
        expected[22] = "error|OutflowNonceExhausted|(uint256)->()||";
        expected[23] = "error|InvalidAuthorizationWindow|()->()||";
        expected[24] = "error|AuthorizationNotYetValid|()->()||";
        expected[25] = "error|AuthorizationExpired|()->()||";
        expected[26] = "error|InvalidAuthorizationFields|()->()||";
        expected[27] = "error|InvalidSignature|()->()||";
        expected[28] = "error|InsufficientSignatureValidationGas|()->()||";
        expected[29] = "error|LocalReadinessFailed|(uint8)->()||";
        expected[30] = "error|OwnableUnauthorizedAccount|(address)->()||";
        expected[31] = "error|OwnableInvalidOwner|(address)->()||";
        expected[32] = "error|EnforcedPause|()->()||";
        expected[33] = "error|ExpectedPause|()->()||";
        expected[34] = "error|ReentrancyGuardReentrantCall|()->()||";
        expected[35] = "error|InvalidShortString|()->()||";
        expected[36] = "error|StringTooLong|(string)->()||";
    }

    function _expectedO1Abi() internal pure returns (string[] memory expected) {
        string[] memory functions_ = _expectedFunctionAbi();
        string[] memory events_ = _expectedEventAbi();
        string[] memory errors_ = _expectedErrorAbi();
        expected = new string[](functions_.length + events_.length + errors_.length);
        uint256 cursor;
        for (uint256 i; i < functions_.length; ++i) {
            expected[cursor++] = functions_[i];
        }
        for (uint256 i; i < events_.length; ++i) {
            expected[cursor++] = events_[i];
        }
        for (uint256 i; i < errors_.length; ++i) {
            expected[cursor++] = errors_[i];
        }
    }

    // --- Literal ABI, constants, constructor, ownership, and runtime boundary ---

    function test_literalConstantsEnumsAndInitialTupleOrder() public view {
        assertEq(vault.supportedChainId(), CHAIN_ID);
        assertEq(vault.OPERATOR_NOMINATION_DELAY(), NOMINATION_DELAY);
        assertEq(vault.OPERATOR_ACCEPTANCE_WINDOW(), ACCEPTANCE_WINDOW);
        assertEq(vault.INGRESS_PROPOSAL_DELAY(), NOMINATION_DELAY);
        assertEq(vault.INGRESS_ACCEPTANCE_WINDOW(), ACCEPTANCE_WINDOW);
        assertEq(vault.MAX_AUTHORIZATION_LIFETIME(), MAX_AUTH_LIFETIME);
        assertEq(vault.MAX_SIGNATURE_BYTES(), MAX_SIGNATURE_BYTES);
        assertEq(vault.ERC1271_CALL_GAS(), ERC1271_CALL_GAS);
        assertEq(vault.ERC1271_POST_CALL_GAS_RESERVE(), ERC1271_POST_RESERVE);
        assertEq(vault.ERC1271_MIN_PRECALL_GAS(), ERC1271_MIN_PRECALL_GAS);
        assertEq(vault.MAX_ACTIVE_ORDINARY_RESERVATIONS(), 32);
        assertEq(vault.MAX_ACTIVE_RECONCILIATIONS(), 32);
        assertEq(vault.MAX_OPERATOR_OUTFLOW_COMPONENTS(), 67);
        assertEq(vault.OUTFLOW_AUTHORIZATION_TYPEHASH(), OUTFLOW_TYPEHASH);
        assertEq(vault.SUCCESSOR_CONSENT_TYPEHASH(), SUCCESSOR_TYPEHASH);
        assertEq(vault.version(), "1");

        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.NONE), 0);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.OUTFLOW_ACQUISITION), 1);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.OUTFLOW_TREASURY_REBALANCE), 2);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.OUTFLOW_SECURITY_RESPONSE), 3);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.OPERATOR_NOMINATION), 4);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.OPERATOR_NOMINATION_CANCELLED), 5);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.OPERATOR_NOMINATION_EXPIRED), 6);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.OPERATOR_DISABLED), 7);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.OPERATOR_RENOUNCED), 8);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.OPERATOR_REPLACED), 9);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.OUTFLOW_NONCE_INVALIDATED), 10);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.RISK_PAUSED), 11);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.RISK_UNPAUSED), 12);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.INGRESS_PROPOSED), 13);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.INGRESS_PROPOSAL_CANCELLED), 14);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.INGRESS_PROPOSAL_EXPIRED), 15);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.INGRESS_ACTIVATED), 16);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.INGRESS_DISABLED), 17);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.UNATTRIBUTED_RECLASSIFIED), 18);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.BALLOT_BUDGET_AUTHORIZED), 19);
        assertEq(uint8(IAcquisitionVaultV1.ReasonCode.RECONCILIATION_DISPOSITION), 20);
        assertEq(uint8(IAcquisitionVaultV1.LocalReadinessCondition.NONE), 0);
        assertEq(uint8(IAcquisitionVaultV1.LocalReadinessCondition.WRONG_CHAIN), 1);
        assertEq(uint8(IAcquisitionVaultV1.LocalReadinessCondition.OWNER_CODE_MISSING), 2);
        assertEq(uint8(IAcquisitionVaultV1.LocalReadinessCondition.REGISTRY_CODE_MISSING), 3);
        assertEq(uint8(IAcquisitionVaultV1.LocalReadinessCondition.ROLE_COLLISION), 4);
        assertEq(uint8(IAcquisitionVaultV1.LocalReadinessCondition.BALANCE_DEFICIT), 5);
        assertEq(uint8(IAcquisitionVaultV1.LocalReadinessCondition.RECONCILIATION_SHORTFALL), 6);
        assertEq(uint8(IAcquisitionVaultV1.LocalReadinessCondition.ACTIVE_INGRESS_MISSING), 7);
        assertEq(uint8(IAcquisitionVaultV1.LocalReadinessCondition.INGRESS_CODE_MISSING), 8);
        assertEq(uint8(IAcquisitionVaultV1.LocalReadinessCondition.INGRESS_CODE_HASH_MISMATCH), 9);
        assertEq(uint8(IAcquisitionVaultV1.LocalReadinessCondition.INGRESS_PROPOSAL_PENDING), 10);

        IAcquisitionVaultV1.PendingOperatorNomination memory pending = vault.pendingMainOperatorNomination();
        assertEq(pending.proposalId, bytes32(0));
        assertEq(pending.proposalNumber, 0);
        assertEq(pending.nominee, address(0));
        assertEq(pending.proposedBy, address(0));
        assertEq(pending.proposedAt, 0);
        assertEq(pending.validAfter, 0);
        assertEq(pending.expiresAt, 0);
        assertEq(pending.detailsHash, bytes32(0));
    }

    function test_literalClosedO1ErrorSelectors() public pure {
        assertEq(O1LiteralErrors.WrongChain.selector, bytes4(keccak256("WrongChain(uint256)")));
        assertEq(O1LiteralErrors.ZeroAddress.selector, bytes4(keccak256("ZeroAddress()")));
        assertEq(O1LiteralErrors.ContractRequired.selector, bytes4(keccak256("ContractRequired(address)")));
        assertEq(O1LiteralErrors.RoleIdentityCollision.selector, bytes4(keccak256("RoleIdentityCollision(address)")));
        assertEq(O1LiteralErrors.RegistryChainMismatch.selector, bytes4(keccak256("RegistryChainMismatch(uint256)")));
        assertEq(
            O1LiteralErrors.OwnershipRenunciationDisabled.selector, bytes4(keccak256("OwnershipRenunciationDisabled()"))
        );
        assertEq(O1LiteralErrors.CounterExhausted.selector, bytes4(keccak256("CounterExhausted(bytes32)")));
        assertEq(O1LiteralErrors.TimestampOverflow.selector, bytes4(keccak256("TimestampOverflow()")));
        assertEq(O1LiteralErrors.ProposalNotReady.selector, bytes4(keccak256("ProposalNotReady(uint64)")));
        assertEq(O1LiteralErrors.ProposalExpired.selector, bytes4(keccak256("ProposalExpired(uint64)")));
        assertEq(O1LiteralErrors.InvalidOperatorReplacement.selector, bytes4(keccak256("InvalidOperatorReplacement()")));
        assertEq(
            O1LiteralErrors.InvalidOutflowNonceStep.selector,
            bytes4(keccak256("InvalidOutflowNonceStep(uint256,uint256)"))
        );
        assertEq(O1LiteralErrors.InvalidSignature.selector, bytes4(keccak256("InvalidSignature()")));
        assertEq(
            O1LiteralErrors.InsufficientSignatureValidationGas.selector,
            bytes4(keccak256("InsufficientSignatureValidationGas()"))
        );
        assertEq(
            O1LiteralErrors.OwnableUnauthorizedAccount.selector,
            bytes4(keccak256("OwnableUnauthorizedAccount(address)"))
        );
        assertEq(
            O1LiteralErrors.ReentrancyGuardReentrantCall.selector, bytes4(keccak256("ReentrancyGuardReentrantCall()"))
        );
    }

    function test_exactO1MethodIdentifierAllowlist() public view {
        string memory artifact =
            vm.readFile(string.concat(vm.projectRoot(), "/out/AcquisitionVault.sol/AcquisitionVault.json"));
        string[] memory actual = vm.parseJsonKeys(artifact, ".methodIdentifiers");
        string[] memory expected = new string[](41);
        expected[0] = "owner()";
        expected[1] = "pendingOwner()";
        expected[2] = "transferOwnership(address)";
        expected[3] = "acceptOwnership()";
        expected[4] = "renounceOwnership()";
        expected[5] = "paused()";
        expected[6] = "eip712Domain()";
        expected[7] = "supportedChainId()";
        expected[8] = "OPERATOR_NOMINATION_DELAY()";
        expected[9] = "OPERATOR_ACCEPTANCE_WINDOW()";
        expected[10] = "INGRESS_PROPOSAL_DELAY()";
        expected[11] = "INGRESS_ACCEPTANCE_WINDOW()";
        expected[12] = "MAX_AUTHORIZATION_LIFETIME()";
        expected[13] = "MAX_SIGNATURE_BYTES()";
        expected[14] = "ERC1271_CALL_GAS()";
        expected[15] = "ERC1271_POST_CALL_GAS_RESERVE()";
        expected[16] = "ERC1271_MIN_PRECALL_GAS()";
        expected[17] = "MAX_ACTIVE_ORDINARY_RESERVATIONS()";
        expected[18] = "MAX_ACTIVE_RECONCILIATIONS()";
        expected[19] = "MAX_OPERATOR_OUTFLOW_COMPONENTS()";
        expected[20] = "OUTFLOW_AUTHORIZATION_TYPEHASH()";
        expected[21] = "SUCCESSOR_CONSENT_TYPEHASH()";
        expected[22] = "stockTokenRegistryV2()";
        expected[23] = "version()";
        expected[24] = "mainOperator()";
        expected[25] = "operatorGeneration()";
        expected[26] = "outflowNonce()";
        expected[27] = "nominationNonce()";
        expected[28] = "pendingMainOperatorNomination()";
        expected[29] = "nominateMainOperator(address,bytes32)";
        expected[30] = "cancelMainOperatorNomination(bytes32,bytes32)";
        expected[31] = "expireMainOperatorNomination(bytes32)";
        expected[32] = "acceptMainOperatorNomination(bytes32)";
        expected[33] = "disableMainOperator(bytes32)";
        expected[34] = "renounceMainOperator(bytes32)";
        expected[35] = "replaceMainOperator((address,address,uint256,uint256,uint64,uint64,uint8,bytes32),bytes)";
        expected[36] = "invalidateOutflowNonce(uint256,bytes32)";
        expected[37] = "pause(bytes32)";
        expected[38] = "unpause(bytes32)";
        expected[39] = "hashOutflowAuthorization((address,address,uint256,uint256,uint256,uint64,uint64,uint8,bytes32))";
        expected[40] = "hashSuccessorConsent((address,address,uint256,uint256,uint64,uint64,uint8,bytes32))";

        for (uint256 i; i < expected.length; ++i) {
            assertTrue(_contains(actual, expected[i]), string.concat("missing selector: ", expected[i]));
        }
    }

    function test_O1CompiledAbiDescriptorMembershipPreservesTuplesMutabilityErrorsAndEvents() public view {
        string memory artifact =
            vm.readFile(string.concat(vm.projectRoot(), "/out/AcquisitionVault.sol/AcquisitionVault.json"));
        string[] memory actual = _artifactAbiDescriptors(artifact);
        _assertDescriptorMembership(actual, _expectedO1Abi());

        // Membership freezes every O1 tuple, mutability, error, event, and
        // indexed-field descriptor while allowing later planned A1 additions.
        // The progressive accounting suite owns exact current artifact and
        // constructor equality. No milestone adds receive or fallback.
        for (uint256 i; i < actual.length; ++i) {
            assertEq(_find(bytes(actual[i]), bytes("receive|"), 0), type(uint256).max, "receive ABI entry");
            assertEq(_find(bytes(actual[i]), bytes("fallback|"), 0), type(uint256).max, "fallback ABI entry");
        }
    }

    function test_literalConstructorAbiParserIgnoresNestedInputNames() public pure {
        bytes memory constructorEntry = bytes(
            '{"type":"constructor","inputs":[{"name":"safeOwner","type":"address","internalType":"address"},{"name":"registry","type":"address","internalType":"address"},{"name":"globalCap","type":"uint256","internalType":"uint256"}],"stateMutability":"nonpayable"}'
        );
        assertEq(
            _abiDescriptor(constructorEntry),
            "constructor||(address,address,uint256)->()|nonpayable|",
            "nested constructor input name leaked into top-level ABI name"
        );
    }

    function test_constructorPinsImmutableAuthorityAndStartsPausedAndEmpty() public view {
        assertEq(vault.owner(), address(safe));
        assertEq(vault.pendingOwner(), address(0));
        assertEq(vault.stockTokenRegistryV2(), address(registry));
        assertTrue(vault.paused());
        assertEq(vault.mainOperator(), address(0));
        assertEq(vault.operatorGeneration(), 0);
        assertEq(vault.outflowNonce(), 0);
        assertEq(vault.nominationNonce(), 0);
        assertEq(address(vault).balance, 0);
    }

    function test_constructorRejectsZeroSafeThroughOwnableBase() public {
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.OwnableInvalidOwner.selector, address(0)));
        new AcquisitionVault(address(0), address(registry), GLOBAL_CAP);
    }

    function test_constructorRejectsWrongChainBeforeBodyPredicates() public {
        vm.chainId(CHAIN_ID + 1);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.WrongChain.selector, CHAIN_ID + 1));
        new AcquisitionVault(address(safe), address(registry), GLOBAL_CAP);
    }

    function test_constructorRejectsEoaSafeOnSupportedChain() public {
        address eoaSafe = makeAddr("eoa-safe");
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.ContractRequired.selector, eoaSafe));
        new AcquisitionVault(eoaSafe, address(registry), GLOBAL_CAP);
    }

    function test_constructorRejectsZeroEoaAndCollidingRegistry() public {
        vm.expectRevert(O1LiteralErrors.ZeroAddress.selector);
        new AcquisitionVault(address(safe), address(0), GLOBAL_CAP);

        address eoaRegistry = makeAddr("eoa-registry");
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.ContractRequired.selector, eoaRegistry));
        new AcquisitionVault(address(safe), eoaRegistry, GLOBAL_CAP);

        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.RoleIdentityCollision.selector, address(safe)));
        new AcquisitionVault(address(safe), address(safe), GLOBAL_CAP);
    }

    function test_constructorRejectsItsOwnAddressAsRegistry() public {
        O1CreateFactory factory = new O1CreateFactory();
        address predicted = address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", address(factory), hex"01")))));
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.RoleIdentityCollision.selector, predicted));
        factory.deploy(address(safe), predicted, GLOBAL_CAP);
    }

    function test_constructorRegistrySentinelMapsMalformedAndWalletControlledFailuresToZero() public {
        O1RegistryProbe probe = new O1RegistryProbe(CHAIN_ID);
        for (
            uint256 rawMode = uint256(O1RegistryProbe.Mode.REVERT_EMPTY);
            rawMode <= uint256(O1RegistryProbe.Mode.OVERSIZED);
            ++rawMode
        ) {
            probe.configure(O1RegistryProbe.Mode(rawMode), CHAIN_ID);
            vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.RegistryChainMismatch.selector, 0));
            new AcquisitionVault(address(safe), address(probe), GLOBAL_CAP);
        }
    }

    function test_constructorRegistrySentinelReportsWellFormedWrongChain() public {
        O1RegistryProbe probe = new O1RegistryProbe(CHAIN_ID + 7);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.RegistryChainMismatch.selector, CHAIN_ID + 7));
        new AcquisitionVault(address(safe), address(probe), GLOBAL_CAP);
    }

    function test_constructorRegistryReturndataBombIsBoundedAndMapsWithoutBubbling() public {
        O1RegistryProbe probe = new O1RegistryProbe(CHAIN_ID);
        probe.configure(O1RegistryProbe.Mode.RETURNDATA_BOMB, CHAIN_ID);
        O1CreateFactory factory = new O1CreateFactory();
        bytes memory callData = abi.encodeCall(factory.deploy, (address(safe), address(probe), GLOBAL_CAP));
        (bool ok, bytes memory returndata) = address(factory).call{gas: 3_500_000}(callData);
        assertFalse(ok, "returndata bomb unexpectedly deployed vault");
        _assertRevertData(returndata, abi.encodeWithSelector(O1LiteralErrors.RegistryChainMismatch.selector, 0));
    }

    function test_emptyCalldataAndUnknownSelectorsRevert() public {
        (bool emptyOk,) = address(vault).call("");
        assertFalse(emptyOk);
        (bool unknownOk,) = address(vault).call(hex"deadbeef");
        assertFalse(unknownOk);
    }

    function test_transferOwnershipRejectsUnauthorizedEoaSelfAndRoleCollisionsWithoutLogs() public {
        O1SafeActor candidate = new O1SafeActor();
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        vault.transferOwnership(address(candidate));

        address[3] memory collisions = [address(safe), address(vault), address(registry)];
        for (uint256 i; i < collisions.length; ++i) {
            vm.recordLogs();
            vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.RoleIdentityCollision.selector, collisions[i]));
            safe.execute(address(vault), abi.encodeCall(vault.transferOwnership, (collisions[i])));
            assertEq(vm.getRecordedLogs().length, 0);
        }

        address eoaCandidate = makeAddr("owner-eoa");
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.ContractRequired.selector, eoaCandidate));
        safe.execute(address(vault), abi.encodeCall(vault.transferOwnership, (eoaCandidate)));
    }

    function test_transferOwnershipRejectsActiveAndPendingOperator() public {
        _appoint(operator);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.RoleIdentityCollision.selector, operator));
        safe.execute(address(vault), abi.encodeCall(vault.transferOwnership, (operator)));

        _safeCall(abi.encodeCall(vault.disableMainOperator, (DETAILS)));
        O1ERC1271Mock nominee = new O1ERC1271Mock();
        _nominate(address(nominee), DETAILS);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.RoleIdentityCollision.selector, address(nominee)));
        safe.execute(address(vault), abi.encodeCall(vault.transferOwnership, (address(nominee))));
    }

    function test_ownershipTwoStepRechecksCodeAndCurrentOwnerAtAcceptance() public {
        O1SafeActor candidate = new O1SafeActor();
        safe.execute(address(vault), abi.encodeCall(vault.transferOwnership, (address(candidate))));
        assertEq(vault.pendingOwner(), address(candidate));
        vm.etch(address(candidate), "");
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.ContractRequired.selector, address(candidate)));
        vm.prank(address(candidate));
        vault.acceptOwnership();
        assertEq(vault.owner(), address(safe));

        _writeAddress(vault.pendingOwner.selector, address(safe));
        vm.recordLogs();
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.RoleIdentityCollision.selector, address(safe)));
        safe.execute(address(vault), abi.encodeCall(vault.acceptOwnership, ()));
        assertEq(vm.getRecordedLogs().length, 0, "self-accept emitted ownership noise");
        assertEq(vault.owner(), address(safe));
    }

    function test_contractSafeCompletesTwoStepOwnershipWithExactEventsAndNoOtherStateChange() public {
        O1SafeActor candidate = new O1SafeActor();
        O1State memory expected = _state();

        vm.expectEmit(true, true, false, false, address(vault));
        emit OwnershipTransferStarted(address(safe), address(candidate));
        _safeCall(abi.encodeCall(vault.transferOwnership, (address(candidate))));
        expected.pendingOwner = address(candidate);
        _assertStateEq(_state(), expected);

        vm.expectEmit(true, true, false, false, address(vault));
        emit OwnershipTransferred(address(safe), address(candidate));
        candidate.execute(address(vault), abi.encodeCall(vault.acceptOwnership, ()));
        expected.owner = address(candidate);
        expected.pendingOwner = address(0);
        _assertStateEq(_state(), expected);

        _assertCallFailureUnchanged(
            address(safe),
            abi.encodeCall(vault.nominateMainOperator, (operator, DETAILS)),
            abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, address(safe))
        );

        uint64 proposedAt = uint64(block.timestamp);
        uint64 validAfter = proposedAt + NOMINATION_DELAY;
        uint64 expiresAt = validAfter + ACCEPTANCE_WINDOW;
        bytes32 expectedId =
            _expectedNominationId(1, address(candidate), operator, proposedAt, validAfter, expiresAt, DETAILS);
        vm.expectEmit(true, true, true, true, address(vault));
        emit MainOperatorNominationCreated(
            expectedId, operator, address(candidate), 1, proposedAt, validAfter, expiresAt, REASON_NOMINATED, DETAILS
        );
        bytes memory result =
            candidate.execute(address(vault), abi.encodeCall(vault.nominateMainOperator, (operator, DETAILS)));
        assertEq(abi.decode(result, (bytes32)), expectedId);
        expected.nominationNonce = 1;
        expected.proposalId = expectedId;
        expected.proposalNumber = 1;
        expected.nominee = operator;
        expected.proposedBy = address(candidate);
        expected.proposedAt = proposedAt;
        expected.validAfter = validAfter;
        expected.expiresAt = expiresAt;
        expected.detailsHash = DETAILS;
        _assertStateEq(_state(), expected);

        vm.expectEmit(true, true, true, true, address(vault));
        emit MainOperatorNominationCancelled(expectedId, operator, address(candidate), REASON_CANCELLED, SECOND_DETAILS);
        candidate.execute(
            address(vault), abi.encodeCall(vault.cancelMainOperatorNomination, (expectedId, SECOND_DETAILS))
        );
        expected.proposalId = bytes32(0);
        expected.proposalNumber = 0;
        expected.nominee = address(0);
        expected.proposedBy = address(0);
        expected.proposedAt = 0;
        expected.validAfter = 0;
        expected.expiresAt = 0;
        expected.detailsHash = bytes32(0);
        _assertStateEq(_state(), expected);
        assertEq(vault.operatorGeneration(), 0);
        assertEq(vault.outflowNonce(), 0);
    }

    function test_successfulOwnershipAcceptanceAtomicallyCancelsPendingNominationAndCannotRevive() public {
        O1SafeActor candidate = new O1SafeActor();
        bytes32 proposalId = _nominate(operator, DETAILS);
        IAcquisitionVaultV1.PendingOperatorNomination memory pending = _pending();
        O1State memory expected = _state();
        assertEq(vault.nominationNonce(), pending.proposalNumber);

        _safeCall(abi.encodeCall(vault.transferOwnership, (address(candidate))));
        expected.pendingOwner = address(candidate);
        _assertStateEq(_state(), expected);

        _safeCall(abi.encodeCall(vault.transferOwnership, (address(0))));
        expected.pendingOwner = address(0);
        _assertStateEq(_state(), expected);

        _safeCall(abi.encodeCall(vault.transferOwnership, (address(candidate))));
        expected.pendingOwner = address(candidate);
        _assertStateEq(_state(), expected);

        bytes32 cancellationDetails =
            keccak256(abi.encode(OWNERSHIP_ACCEPTANCE_CANCEL_TYPE_TAG, proposalId, address(safe), address(candidate)));
        vm.recordLogs();
        candidate.execute(address(vault), abi.encodeCall(vault.acceptOwnership, ()));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 2, "ownership acceptance must emit exactly two events");
        assertEq(logs[0].emitter, address(vault));
        assertEq(logs[0].topics.length, 3);
        assertEq(logs[0].topics[0], keccak256("OwnershipTransferred(address,address)"));
        assertEq(logs[0].topics[1], bytes32(uint256(uint160(address(safe)))));
        assertEq(logs[0].topics[2], bytes32(uint256(uint160(address(candidate)))));
        assertEq(logs[0].data.length, 0);
        assertEq(logs[1].emitter, address(vault));
        assertEq(logs[1].topics.length, 4);
        assertEq(logs[1].topics[0], keccak256("MainOperatorNominationCancelled(bytes32,address,address,uint8,bytes32)"));
        assertEq(logs[1].topics[1], proposalId);
        assertEq(logs[1].topics[2], bytes32(uint256(uint160(operator))));
        assertEq(logs[1].topics[3], bytes32(uint256(uint160(address(candidate)))));
        assertEq(logs[1].data, abi.encode(REASON_CANCELLED, cancellationDetails));

        expected.owner = address(candidate);
        expected.pendingOwner = address(0);
        expected.proposalId = bytes32(0);
        expected.proposalNumber = 0;
        expected.nominee = address(0);
        expected.proposedBy = address(0);
        expected.proposedAt = 0;
        expected.validAfter = 0;
        expected.expiresAt = 0;
        expected.detailsHash = bytes32(0);
        _assertStateEq(_state(), expected);
        assertEq(vault.nominationNonce(), pending.proposalNumber, "issued proposal number changed");

        _assertCallFailureUnchanged(
            operator,
            abi.encodeCall(vault.acceptMainOperatorNomination, (proposalId)),
            abi.encodeWithSelector(O1LiteralErrors.OperatorNominationMissing.selector)
        );

        candidate.execute(address(vault), abi.encodeCall(vault.transferOwnership, (address(safe))));
        safe.execute(address(vault), abi.encodeCall(vault.acceptOwnership, ()));
        expected.owner = address(safe);
        _assertStateEq(_state(), expected);

        vm.warp(pending.validAfter);
        _assertCallFailureUnchanged(
            operator,
            abi.encodeCall(vault.acceptMainOperatorNomination, (proposalId)),
            abi.encodeWithSelector(O1LiteralErrors.OperatorNominationMissing.selector)
        );
        vm.warp(uint256(pending.expiresAt) + 1);
        _assertCallFailureUnchanged(
            operator,
            abi.encodeCall(vault.acceptMainOperatorNomination, (proposalId)),
            abi.encodeWithSelector(O1LiteralErrors.OperatorNominationMissing.selector)
        );
    }

    function test_failedOwnershipAcceptancePreservesPendingNominationAndEmitsNothing() public {
        O1SafeActor candidate = new O1SafeActor();
        bytes32 proposalId = _nominate(operator, DETAILS);
        _safeCall(abi.encodeCall(vault.transferOwnership, (address(candidate))));
        O1State memory beforeState = _state();

        vm.etch(address(candidate), "");
        vm.recordLogs();
        vm.prank(address(candidate));
        (bool ok, bytes memory returndata) = address(vault).call(abi.encodeCall(vault.acceptOwnership, ()));
        assertFalse(ok, "ownership acceptance unexpectedly succeeded");
        _assertRevertData(
            returndata, abi.encodeWithSelector(O1LiteralErrors.ContractRequired.selector, address(candidate))
        );
        assertEq(vm.getRecordedLogs().length, 0, "failed ownership acceptance emitted evidence");
        _assertStateEq(_state(), beforeState);
        assertEq(_pending().proposalId, proposalId);
    }

    function test_activeOperatorSurvivesOwnershipAcceptanceAndNewSafeCanDisableImmediately() public {
        _appoint(operator);
        vm.prank(operator);
        vault.invalidateOutflowNonce(1, DETAILS);
        O1SafeActor candidate = new O1SafeActor();
        _safeCall(abi.encodeCall(vault.transferOwnership, (address(candidate))));
        O1State memory expected = _state();

        vm.recordLogs();
        candidate.execute(address(vault), abi.encodeCall(vault.acceptOwnership, ()));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1, "active-operator handoff emitted extra evidence");
        assertEq(logs[0].topics[0], keccak256("OwnershipTransferred(address,address)"));
        expected.owner = address(candidate);
        expected.pendingOwner = address(0);
        _assertStateEq(_state(), expected);
        assertEq(vault.mainOperator(), operator);
        assertEq(vault.operatorGeneration(), 1);
        assertEq(vault.outflowNonce(), 1);
        assertTrue(vault.paused());

        vm.expectEmit(true, true, true, true, address(vault));
        emit MainOperatorChanged(operator, address(0), 2, 1, REASON_DISABLED, SECOND_DETAILS);
        candidate.execute(address(vault), abi.encodeCall(vault.disableMainOperator, (SECOND_DETAILS)));
        assertEq(vault.mainOperator(), address(0));
        assertEq(vault.operatorGeneration(), 2);
        assertEq(vault.outflowNonce(), 1);
        assertTrue(vault.paused());
    }

    function test_safeOnlyAuthorityRejectsActiveOperatorPendingNomineeAndStrangersAcrossSurface() public {
        O1SafeActor ownerCandidate = new O1SafeActor();
        O1SafeActor relay = new O1SafeActor();
        bytes32 proposalId = _nominate(operator, DETAILS);
        address[3] memory pendingStateCallers = [operator, stranger, address(relay)];
        for (uint256 i; i < pendingStateCallers.length; ++i) {
            address caller = pendingStateCallers[i];
            _assertCallFailureUnchanged(
                caller,
                abi.encodeCall(vault.transferOwnership, (address(ownerCandidate))),
                abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, caller)
            );
            _assertCallFailureUnchanged(
                caller,
                abi.encodeCall(vault.nominateMainOperator, (stranger, SECOND_DETAILS)),
                abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, caller)
            );
            _assertCallFailureUnchanged(
                caller,
                abi.encodeCall(vault.cancelMainOperatorNomination, (proposalId, SECOND_DETAILS)),
                abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, caller)
            );
            _assertCallFailureUnchanged(
                caller,
                abi.encodeCall(vault.disableMainOperator, (SECOND_DETAILS)),
                abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, caller)
            );
            _assertCallFailureUnchanged(
                caller,
                abi.encodeCall(vault.unpause, (SECOND_DETAILS)),
                abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, caller)
            );
        }

        vm.warp(_pending().validAfter);
        vm.prank(operator);
        vault.acceptMainOperatorNomination(proposalId);
        address[3] memory activeStateCallers = [operator, stranger, address(relay)];
        for (uint256 i; i < activeStateCallers.length; ++i) {
            address caller = activeStateCallers[i];
            _assertCallFailureUnchanged(
                caller,
                abi.encodeCall(vault.transferOwnership, (address(ownerCandidate))),
                abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, caller)
            );
            _assertCallFailureUnchanged(
                caller,
                abi.encodeCall(vault.nominateMainOperator, (stranger, SECOND_DETAILS)),
                abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, caller)
            );
            _assertCallFailureUnchanged(
                caller,
                abi.encodeCall(vault.cancelMainOperatorNomination, (SECOND_DETAILS, SECOND_DETAILS)),
                abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, caller)
            );
            _assertCallFailureUnchanged(
                caller,
                abi.encodeCall(vault.disableMainOperator, (SECOND_DETAILS)),
                abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, caller)
            );
            _assertCallFailureUnchanged(
                caller,
                abi.encodeCall(vault.unpause, (SECOND_DETAILS)),
                abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, caller)
            );
        }
    }

    function test_operatorOnlyAuthorityRejectsSafePendingNomineeRelayAndStrangerWithExactPartition() public {
        O1SafeActor relay = new O1SafeActor();
        bytes32 proposalId = _nominate(operator, DETAILS);
        IAcquisitionVaultV1.SuccessorConsent memory emptyConsent;
        address[4] memory noActiveCallers = [address(safe), operator, address(relay), stranger];
        for (uint256 i; i < noActiveCallers.length; ++i) {
            address caller = noActiveCallers[i];
            _assertCallFailureUnchanged(
                caller,
                abi.encodeCall(vault.renounceMainOperator, (SECOND_DETAILS)),
                abi.encodeWithSelector(O1LiteralErrors.NoMainOperator.selector)
            );
            _assertCallFailureUnchanged(
                caller,
                abi.encodeCall(vault.replaceMainOperator, (emptyConsent, hex"01")),
                abi.encodeWithSelector(O1LiteralErrors.NoMainOperator.selector)
            );
            _assertCallFailureUnchanged(
                caller,
                abi.encodeCall(vault.invalidateOutflowNonce, (1, SECOND_DETAILS)),
                abi.encodeWithSelector(O1LiteralErrors.NoMainOperator.selector)
            );
        }

        vm.warp(_pending().validAfter);
        vm.prank(operator);
        vault.acceptMainOperatorNomination(proposalId);
        address[3] memory wrongActiveCallers = [address(safe), address(relay), stranger];
        for (uint256 i; i < wrongActiveCallers.length; ++i) {
            address caller = wrongActiveCallers[i];
            bytes memory errorData = abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, caller);
            _assertCallFailureUnchanged(caller, abi.encodeCall(vault.renounceMainOperator, (SECOND_DETAILS)), errorData);
            _assertCallFailureUnchanged(
                caller, abi.encodeCall(vault.replaceMainOperator, (emptyConsent, hex"01")), errorData
            );
            _assertCallFailureUnchanged(
                caller, abi.encodeCall(vault.invalidateOutflowNonce, (1, SECOND_DETAILS)), errorData
            );
        }
    }

    function test_nomineeOnlyAcceptanceAndDisableCallerMatrixAreClosed() public {
        bytes32 proposalId = _nominate(operator, DETAILS);
        vm.warp(_pending().validAfter);
        _assertCallFailureUnchanged(
            address(safe),
            abi.encodeCall(vault.acceptMainOperatorNomination, (proposalId)),
            abi.encodeWithSelector(O1LiteralErrors.NotNominee.selector, address(safe))
        );
        _assertCallFailureUnchanged(
            stranger,
            abi.encodeCall(vault.acceptMainOperatorNomination, (proposalId)),
            abi.encodeWithSelector(O1LiteralErrors.NotNominee.selector, stranger)
        );
        _assertCallFailureUnchanged(
            stranger,
            abi.encodeCall(vault.disableMainOperator, (SECOND_DETAILS)),
            abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, stranger)
        );

        vm.prank(operator);
        vault.acceptMainOperatorNomination(proposalId);
        _assertCallFailureUnchanged(
            operator,
            abi.encodeCall(vault.disableMainOperator, (SECOND_DETAILS)),
            abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, operator)
        );
        _assertCallFailureUnchanged(
            stranger,
            abi.encodeCall(vault.disableMainOperator, (SECOND_DETAILS)),
            abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, stranger)
        );
    }

    function test_zeroOwnershipCandidateOnlyCancelsExistingProposalAndNeverBecomesOwner() public {
        vm.expectRevert(O1LiteralErrors.NoPendingOwnershipTransfer.selector);
        safe.execute(address(vault), abi.encodeCall(vault.transferOwnership, (address(0))));

        O1SafeActor candidate = new O1SafeActor();
        safe.execute(address(vault), abi.encodeCall(vault.transferOwnership, (address(candidate))));
        safe.execute(address(vault), abi.encodeCall(vault.transferOwnership, (address(0))));
        assertEq(vault.pendingOwner(), address(0));
        assertEq(vault.owner(), address(safe));

        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, address(0)));
        vm.prank(address(0));
        vault.acceptOwnership();
        assertEq(vault.owner(), address(safe));
    }

    function test_renounceOwnershipIsUnauthorizedForNonOwnerAndDisabledForOwner() public {
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        vault.renounceOwnership();

        vm.expectRevert(O1LiteralErrors.OwnershipRenunciationDisabled.selector);
        safe.execute(address(vault), abi.encodeCall(vault.renounceOwnership, ()));
        assertEq(vault.owner(), address(safe));
    }

    function test_runtimeDisassemblerSkipsPushDataAndBansValueAndDelegationOpcodes() public view {
        bytes memory runtime = address(vault).code;
        assertGt(runtime.length, 2, "runtime omitted Solidity metadata length");
        uint256 metadataLength =
            (uint256(uint8(runtime[runtime.length - 2])) << 8) | uint256(uint8(runtime[runtime.length - 1]));
        assertLt(metadataLength + 2, runtime.length, "invalid Solidity metadata trailer length");
        uint256 executableLength = runtime.length - metadataLength - 2;
        assertEq(uint8(runtime[executableLength]), 0xa2, "unexpected Solidity CBOR metadata prefix");

        uint256 staticcallSites;
        // The CBOR payload is compiler metadata rather than executable code and
        // may contain arbitrary bytes that resemble opcodes. Disassemble only
        // the validated executable prefix so every opcode assertion is real.
        for (uint256 pc; pc < executableLength;) {
            uint8 opcode = uint8(runtime[pc]);
            assertTrue(opcode != 0xf1, "runtime contains CALL");
            assertTrue(opcode != 0xf2, "runtime contains CALLCODE");
            assertTrue(opcode != 0xf4, "runtime contains DELEGATECALL");
            assertTrue(opcode != 0xff, "runtime contains SELFDESTRUCT");
            if (opcode == 0xfa) ++staticcallSites;
            if (opcode >= 0x60 && opcode <= 0x7f) {
                pc += 1 + (opcode - 0x5f);
            } else {
                ++pc;
            }
        }
        assertGt(staticcallSites, 0, "runtime omitted required signature STATICCALL families");
        // The supportedChainId() public getter necessarily leaves its PUSH4
        // dispatcher selector in runtime. Constructor-only evidence concerns
        // the Registry external-call site, not the expected getter selector;
        // source/build-info/IR review below owns that distinction.
    }

    function test_artifactMetadataBindsCompilerConfigSourceHashAndReviewedExternalCallVocabulary() public view {
        string memory artifact =
            vm.readFile(string.concat(vm.projectRoot(), "/out/AcquisitionVault.sol/AcquisitionVault.json"));
        string memory rawMetadata = vm.parseJsonString(artifact, ".rawMetadata");
        bytes memory metadata = bytes(rawMetadata);
        assertNotEq(
            _find(metadata, bytes('"compiler\":{\"version\":\"0.8.26+commit.8a97fa7a\"}'), 0),
            type(uint256).max,
            "wrong compiler metadata"
        );
        assertNotEq(
            _find(metadata, bytes('"optimizer\":{\"enabled\":true,\"runs\":800}'), 0),
            type(uint256).max,
            "wrong optimizer metadata"
        );
        assertNotEq(
            _find(metadata, bytes('"compilationTarget\":{\"src/AcquisitionVault.sol\":\"AcquisitionVault\"}'), 0),
            type(uint256).max,
            "wrong compilation target"
        );
        assertNotEq(_find(metadata, bytes('"evmVersion\":\"cancun\"'), 0), type(uint256).max, "wrong EVM");

        bytes memory source = bytes(vm.readFile(string.concat(vm.projectRoot(), "/src/AcquisitionVault.sol")));
        string memory sourceHash = vm.toString(keccak256(source));
        bytes memory sourceHashEntry =
            bytes(string.concat('"src/AcquisitionVault.sol\":{\"keccak256\":\"', sourceHash, '"'));
        assertNotEq(_find(metadata, sourceHashEntry, 0), type(uint256).max, "artifact is not bound to reviewed source");

        bytes memory code = _stripCommentsAndQuotedStrings(source);
        assertEq(_count(code, bytes("staticcall")), 2, "unexpected explicit STATICCALL family in vault source");
        assertEq(_count(code, bytes("call(")), 2, "non-STATICCALL external call in vault source");
        assertEq(_count(code, bytes("delegatecall")), 0, "vault source contains DELEGATECALL");
        assertEq(_count(code, bytes("callcode")), 0, "vault source contains CALLCODE");
        assertEq(_count(code, bytes("selfdestruct")), 0, "vault source contains SELFDESTRUCT");
        assertEq(_count(code, bytes(".call")), 0, "vault source contains high-level CALL");
        assertEq(_count(code, bytes(".transfer")), 0, "vault source contains native transfer");
        assertEq(_count(code, bytes(".send")), 0, "vault source contains native send");
        assertNotEq(_find(code, bytes("IStockTokenRegistryV2.supportedChainId.selector"), 0), type(uint256).max);
        assertNotEq(_find(code, bytes("ERC1271_CALL_GAS"), 0), type(uint256).max);
        assertNotEq(_find(code, bytes("returndatasize"), 0), type(uint256).max);
        assertNotEq(_find(code, bytes("returndatacopy"), 0), type(uint256).max);
        assertEq(
            _count(code, bytes("_requireErc1271PrecallGas")),
            2,
            "pre-call gas seam must have one definition and one production use"
        );
        assertEq(
            _count(code, bytes("_requireErc1271PostcallGas")),
            2,
            "post-call gas seam must have one definition and one production use"
        );
        assertNotEq(
            _find(code, bytes("_requireErc1271PrecallGas(gasleft())"), 0),
            type(uint256).max,
            "validator does not feed gasleft() to production pre-call seam"
        );
        assertNotEq(
            _find(code, bytes("_requireErc1271PostcallGas(gasleft())"), 0),
            type(uint256).max,
            "validator does not feed gasleft() to production post-call seam"
        );

        // Pure Solidity tests cannot request ad-hoc compiler IR under this
        // repository's non-FFI profile. Task 2 therefore still MUST execute
        // `forge build --build-info`, `forge inspect AcquisitionVault ir`, and
        // `forge inspect AcquisitionVault irOptimized`, hash those outputs, and
        // review their creation/runtime call sites, including proof that the
        // Registry selector's only external-call use is in creation code and
        // both validator gasleft() observations invoke the same internal seams
        // exposed by O1SignatureGasBoundaryHarness. The public
        // supportedChainId() dispatcher selector is expected in runtime. This
        // executable gate binds that review to the exact compiler config and
        // source hash; it does not misrepresent lexical/opcode evidence as full
        // IR classification.
    }

    // --- Delayed nomination lifecycle and checked generation transitions ---

    function test_nominationFreezesExactCounterIdTupleAndEvent() public {
        uint64 proposedAt = uint64(block.timestamp);
        uint64 validAfter = proposedAt + NOMINATION_DELAY;
        uint64 expiresAt = validAfter + ACCEPTANCE_WINDOW;
        bytes32 expectedId =
            _expectedNominationId(1, address(safe), operator, proposedAt, validAfter, expiresAt, DETAILS);

        vm.expectEmit(true, true, true, true, address(vault));
        emit MainOperatorNominationCreated(
            expectedId, operator, address(safe), 1, proposedAt, validAfter, expiresAt, REASON_NOMINATED, DETAILS
        );
        bytes32 actualId = _nominate(operator, DETAILS);
        assertEq(actualId, expectedId);
        assertEq(vault.nominationNonce(), 1);

        IAcquisitionVaultV1.PendingOperatorNomination memory pending = _pending();
        assertEq(pending.proposalId, expectedId);
        assertEq(pending.proposalNumber, 1);
        assertEq(pending.nominee, operator);
        assertEq(pending.proposedBy, address(safe));
        assertEq(pending.proposedAt, proposedAt);
        assertEq(pending.validAfter, validAfter);
        assertEq(pending.expiresAt, expiresAt);
        assertEq(pending.detailsHash, DETAILS);
    }

    function test_nominationRequiresSafeZeroOperatorNoPendingNonzeroDetailsAndDisjointNominee() public {
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        vault.nominateMainOperator(operator, DETAILS);

        vm.expectRevert(O1LiteralErrors.ZeroAddress.selector);
        _safeCall(abi.encodeCall(vault.nominateMainOperator, (address(0), DETAILS)));
        vm.expectRevert(O1LiteralErrors.EmptyDetailsHash.selector);
        _safeCall(abi.encodeCall(vault.nominateMainOperator, (operator, bytes32(0))));

        address[3] memory collisions = [address(safe), address(vault), address(registry)];
        for (uint256 i; i < collisions.length; ++i) {
            vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.RoleIdentityCollision.selector, collisions[i]));
            _safeCall(abi.encodeCall(vault.nominateMainOperator, (collisions[i], DETAILS)));
        }

        O1SafeActor pendingOwnerCandidate = new O1SafeActor();
        _safeCall(abi.encodeCall(vault.transferOwnership, (address(pendingOwnerCandidate))));
        vm.expectRevert(
            abi.encodeWithSelector(O1LiteralErrors.RoleIdentityCollision.selector, address(pendingOwnerCandidate))
        );
        _safeCall(abi.encodeCall(vault.nominateMainOperator, (address(pendingOwnerCandidate), DETAILS)));

        bytes32 proposalId = _nominate(operator, DETAILS);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.OperatorNominationPending.selector, proposalId));
        _safeCall(abi.encodeCall(vault.nominateMainOperator, (stranger, SECOND_DETAILS)));
        assertEq(vault.nominationNonce(), 1);

        vm.warp(_pending().validAfter);
        vm.prank(operator);
        vault.acceptMainOperatorNomination(proposalId);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.MainOperatorActive.selector, operator));
        _safeCall(abi.encodeCall(vault.nominateMainOperator, (stranger, DETAILS)));
    }

    function test_eoaAndErc1271ContractsMayAcceptOnlyTheirExactReadyNomination() public {
        bytes32 proposalId = _nominate(operator, DETAILS);
        IAcquisitionVaultV1.PendingOperatorNomination memory pending = _pending();
        vm.warp(pending.validAfter - 1);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.ProposalNotReady.selector, pending.validAfter));
        vm.prank(operator);
        vault.acceptMainOperatorNomination(proposalId);

        vm.warp(pending.validAfter);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.NotNominee.selector, stranger));
        vm.prank(stranger);
        vault.acceptMainOperatorNomination(proposalId);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.ProposalIdMismatch.selector, proposalId, SECOND_DETAILS));
        vm.prank(operator);
        vault.acceptMainOperatorNomination(SECOND_DETAILS);

        vm.expectEmit(true, true, true, true, address(vault));
        emit MainOperatorChanged(address(0), operator, 1, 0, REASON_NOMINATED, DETAILS);
        vm.prank(operator);
        vault.acceptMainOperatorNomination(proposalId);
        assertEq(vault.mainOperator(), operator);
        assertEq(vault.operatorGeneration(), 1);
        assertEq(vault.nominationNonce(), 1);
        assertEq(_pending().proposalId, bytes32(0));

        _safeCall(abi.encodeCall(vault.disableMainOperator, (SECOND_DETAILS)));
        O1ERC1271Mock contractNominee = new O1ERC1271Mock();
        _appointContract(contractNominee);
        assertEq(vault.mainOperator(), address(contractNominee));
        assertEq(vault.operatorGeneration(), 3);
    }

    function test_acceptanceUsesHalfOpenExpiryBoundary() public {
        bytes32 proposalId = _nominate(operator, DETAILS);
        IAcquisitionVaultV1.PendingOperatorNomination memory pending = _pending();

        vm.warp(pending.expiresAt - 1);
        vm.prank(operator);
        vault.acceptMainOperatorNomination(proposalId);
        assertEq(vault.mainOperator(), operator);

        uint256 snapshot = vm.snapshotState();
        assertTrue(vm.revertToState(snapshot));
    }

    function test_acceptanceAtExpiryIsRejectedAndPermissionlessExpiryClearsWithoutAppointment() public {
        bytes32 proposalId = _nominate(operator, DETAILS);
        IAcquisitionVaultV1.PendingOperatorNomination memory pending = _pending();
        vm.warp(pending.expiresAt);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.ProposalExpired.selector, pending.expiresAt));
        vm.prank(operator);
        vault.acceptMainOperatorNomination(proposalId);

        bytes32 expiryDetails = keccak256(abi.encode(EXPIRY_DETAILS_TYPE_TAG, proposalId));
        vm.expectEmit(true, true, true, true, address(vault));
        emit MainOperatorNominationExpired(proposalId, operator, stranger, REASON_EXPIRED, expiryDetails);
        vm.prank(stranger);
        vault.expireMainOperatorNomination(proposalId);
        assertEq(vault.mainOperator(), address(0));
        assertEq(vault.operatorGeneration(), 0);
        assertEq(vault.nominationNonce(), 1);
        assertEq(_pending().proposalId, bytes32(0));
    }

    function test_expiryValidatesMissingIdAndExactTimeBeforeMutation() public {
        vm.expectRevert(O1LiteralErrors.OperatorNominationMissing.selector);
        vault.expireMainOperatorNomination(DETAILS);

        bytes32 proposalId = _nominate(operator, DETAILS);
        IAcquisitionVaultV1.PendingOperatorNomination memory pending = _pending();
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.ProposalIdMismatch.selector, proposalId, SECOND_DETAILS));
        vault.expireMainOperatorNomination(SECOND_DETAILS);
        vm.warp(pending.expiresAt - 1);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.ProposalNotReady.selector, pending.expiresAt));
        vault.expireMainOperatorNomination(proposalId);
        assertEq(_pending().proposalId, proposalId);
    }

    function test_safeCancellationUsesExactIdDetailsAndNeverAppoints() public {
        bytes32 proposalId = _nominate(operator, DETAILS);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        vault.cancelMainOperatorNomination(proposalId, SECOND_DETAILS);
        vm.expectRevert(O1LiteralErrors.EmptyDetailsHash.selector);
        _safeCall(abi.encodeCall(vault.cancelMainOperatorNomination, (proposalId, bytes32(0))));
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.ProposalIdMismatch.selector, proposalId, SECOND_DETAILS));
        _safeCall(abi.encodeCall(vault.cancelMainOperatorNomination, (SECOND_DETAILS, DETAILS)));

        vm.expectEmit(true, true, true, true, address(vault));
        emit MainOperatorNominationCancelled(proposalId, operator, address(safe), REASON_CANCELLED, SECOND_DETAILS);
        _safeCall(abi.encodeCall(vault.cancelMainOperatorNomination, (proposalId, SECOND_DETAILS)));
        assertEq(vault.mainOperator(), address(0));
        assertEq(vault.operatorGeneration(), 0);
        assertEq(vault.nominationNonce(), 1);
        assertEq(_pending().proposalId, bytes32(0));
    }

    function test_threeProposalNumbersRemainMonotonicAcrossCancelExpireAndAcceptWithExactIds() public {
        uint64 proposedAt1 = uint64(block.timestamp);
        bytes32 expected1 = _expectedNominationId(
            1,
            address(safe),
            operator,
            proposedAt1,
            proposedAt1 + NOMINATION_DELAY,
            proposedAt1 + NOMINATION_DELAY + ACCEPTANCE_WINDOW,
            DETAILS
        );
        bytes32 proposal1 = _nominate(operator, DETAILS);
        assertEq(proposal1, expected1);
        _safeCall(abi.encodeCall(vault.cancelMainOperatorNomination, (proposal1, SECOND_DETAILS)));
        assertEq(vault.nominationNonce(), 1);

        uint64 proposedAt2 = uint64(block.timestamp);
        bytes32 expected2 = _expectedNominationId(
            2,
            address(safe),
            stranger,
            proposedAt2,
            proposedAt2 + NOMINATION_DELAY,
            proposedAt2 + NOMINATION_DELAY + ACCEPTANCE_WINDOW,
            SECOND_DETAILS
        );
        bytes32 proposal2 = _nominate(stranger, SECOND_DETAILS);
        assertEq(proposal2, expected2);
        vm.warp(_pending().expiresAt);
        vm.prank(operator);
        vault.expireMainOperatorNomination(proposal2);
        assertEq(vault.nominationNonce(), 2);

        address thirdNominee = makeAddr("third-nominee");
        uint64 proposedAt3 = uint64(block.timestamp);
        bytes32 expected3 = _expectedNominationId(
            3,
            address(safe),
            thirdNominee,
            proposedAt3,
            proposedAt3 + NOMINATION_DELAY,
            proposedAt3 + NOMINATION_DELAY + ACCEPTANCE_WINDOW,
            DETAILS
        );
        bytes32 proposal3 = _nominate(thirdNominee, DETAILS);
        assertEq(proposal3, expected3);
        vm.warp(_pending().validAfter);
        vm.prank(thirdNominee);
        vault.acceptMainOperatorNomination(proposal3);
        assertEq(vault.nominationNonce(), 3);
        assertEq(vault.mainOperator(), thirdNominee);
        assertNotEq(proposal1, proposal2);
        assertNotEq(proposal2, proposal3);
        assertNotEq(proposal1, proposal3);
    }

    function test_cancelAndAcceptMissingProposalUseExactErrorsWithoutNonceStateOrLogs() public {
        _assertCallFailureUnchanged(
            address(safe),
            abi.encodeCall(vault.cancelMainOperatorNomination, (DETAILS, SECOND_DETAILS)),
            abi.encodeWithSelector(O1LiteralErrors.OperatorNominationMissing.selector)
        );
        _assertCallFailureUnchanged(
            operator,
            abi.encodeCall(vault.acceptMainOperatorNomination, (DETAILS)),
            abi.encodeWithSelector(O1LiteralErrors.OperatorNominationMissing.selector)
        );
        assertEq(vault.nominationNonce(), 0);
    }

    function test_acceptanceRechecksReciprocalPendingOwnerCollision() public {
        bytes32 proposalId = _nominate(operator, DETAILS);
        IAcquisitionVaultV1.PendingOperatorNomination memory pending = _pending();
        _writeAddress(vault.pendingOwner.selector, operator);
        vm.warp(pending.validAfter);
        vm.recordLogs();
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.RoleIdentityCollision.selector, operator));
        vm.prank(operator);
        vault.acceptMainOperatorNomination(proposalId);
        assertEq(vm.getRecordedLogs().length, 0);
        assertEq(vault.mainOperator(), address(0));
        assertEq(vault.operatorGeneration(), 0);
        assertEq(_pending().proposalId, proposalId);
    }

    function test_nominationTimestampLastValidAndFirstInvalidAreCheckedWithoutCounterConsumption() public {
        uint256 lastValid = type(uint64).max - NOMINATION_DELAY - ACCEPTANCE_WINDOW;
        vm.warp(lastValid);
        bytes32 proposalId = _nominate(operator, DETAILS);
        IAcquisitionVaultV1.PendingOperatorNomination memory pending = _pending();
        assertEq(pending.proposedAt, uint64(lastValid));
        assertEq(pending.validAfter, uint64(lastValid + NOMINATION_DELAY));
        assertEq(pending.expiresAt, type(uint64).max);

        _safeCall(abi.encodeCall(vault.cancelMainOperatorNomination, (proposalId, SECOND_DETAILS)));
        uint256 nonceBefore = vault.nominationNonce();
        vm.warp(lastValid + 1);
        vm.recordLogs();
        vm.expectRevert(O1LiteralErrors.TimestampOverflow.selector);
        _safeCall(abi.encodeCall(vault.nominateMainOperator, (operator, DETAILS)));
        assertEq(vm.getRecordedLogs().length, 0);
        assertEq(vault.nominationNonce(), nonceBefore);
        assertEq(_pending().proposalId, bytes32(0));
    }

    function test_nominationAndGenerationCountersUseExactExhaustionLabels() public {
        _writeScalar(vault.nominationNonce.selector, type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(O1LiteralErrors.CounterExhausted.selector, keccak256(bytes("nominationNonce")))
        );
        _safeCall(abi.encodeCall(vault.nominateMainOperator, (operator, DETAILS)));

        _writeScalar(vault.nominationNonce.selector, 0);
        _appoint(operator);
        _writeScalar(vault.operatorGeneration.selector, type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(O1LiteralErrors.CounterExhausted.selector, keccak256(bytes("operatorGeneration")))
        );
        _safeCall(abi.encodeCall(vault.disableMainOperator, (DETAILS)));
        assertEq(vault.mainOperator(), operator);
    }

    function test_operatorGenerationMaximumFailsAcceptancePendingDisableActiveDisableRenounceAndReplaceAtomically()
        public
    {
        bytes32 counterLabel = keccak256(bytes("operatorGeneration"));
        bytes memory exhaustion = abi.encodeWithSelector(O1LiteralErrors.CounterExhausted.selector, counterLabel);

        bytes32 pendingId = _nominate(operator, DETAILS);
        vm.warp(_pending().validAfter);
        uint256 checkpoint = vm.snapshotState();
        _writeScalar(vault.operatorGeneration.selector, type(uint256).max);
        _assertCallFailureUnchanged(
            operator, abi.encodeCall(vault.acceptMainOperatorNomination, (pendingId)), exhaustion
        );
        assertTrue(vm.revertToState(checkpoint));

        checkpoint = vm.snapshotState();
        _writeScalar(vault.operatorGeneration.selector, type(uint256).max);
        _assertCallFailureUnchanged(
            address(safe), abi.encodeCall(vault.disableMainOperator, (SECOND_DETAILS)), exhaustion
        );
        assertTrue(vm.revertToState(checkpoint));

        vm.prank(operator);
        vault.acceptMainOperatorNomination(pendingId);
        checkpoint = vm.snapshotState();

        _writeScalar(vault.operatorGeneration.selector, type(uint256).max);
        _assertCallFailureUnchanged(
            address(safe), abi.encodeCall(vault.disableMainOperator, (SECOND_DETAILS)), exhaustion
        );
        assertTrue(vm.revertToState(checkpoint));

        _writeScalar(vault.operatorGeneration.selector, type(uint256).max);
        _assertCallFailureUnchanged(operator, abi.encodeCall(vault.renounceMainOperator, (SECOND_DETAILS)), exhaustion);
        assertTrue(vm.revertToState(checkpoint));

        _writeScalar(vault.operatorGeneration.selector, type(uint256).max);
        address successor = vm.addr(successorKey);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(successor);
        bytes memory signature = _sign(successorKey, _successorDigest(consent));
        _assertReplaceFailure(operator, consent, signature, exhaustion);
        assertTrue(vm.revertToState(checkpoint));
    }

    function test_safeDisablePendingEmitsCancellationThenMandatoryZeroToZeroChange() public {
        bytes32 proposalId = _nominate(operator, DETAILS);
        vm.recordLogs();
        _safeCall(abi.encodeCall(vault.disableMainOperator, (SECOND_DETAILS)));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 2, "pending disable evidence must contain exactly two events");
        assertEq(logs[0].emitter, address(vault));
        assertEq(logs[0].topics.length, 4);
        assertEq(logs[0].topics[0], keccak256("MainOperatorNominationCancelled(bytes32,address,address,uint8,bytes32)"));
        assertEq(logs[0].topics[1], proposalId);
        assertEq(logs[0].topics[2], bytes32(uint256(uint160(operator))));
        assertEq(logs[0].topics[3], bytes32(uint256(uint160(address(safe)))));
        assertEq(logs[0].data, abi.encode(REASON_DISABLED, SECOND_DETAILS));
        assertEq(logs[1].emitter, address(vault));
        assertEq(logs[1].topics.length, 4);
        assertEq(logs[1].topics[0], keccak256("MainOperatorChanged(address,address,uint256,uint256,uint8,bytes32)"));
        assertEq(logs[1].topics[1], bytes32(0));
        assertEq(logs[1].topics[2], bytes32(0));
        assertEq(logs[1].topics[3], bytes32(uint256(1)));
        assertEq(logs[1].data, abi.encode(uint256(0), REASON_DISABLED, SECOND_DETAILS));
        assertEq(vault.operatorGeneration(), 1);
        assertEq(vault.outflowNonce(), 0);
        assertEq(_pending().proposalId, bytes32(0));
    }

    function test_safeDisableActiveIsImmediateOneGenerationAndPreservesNonce() public {
        _appoint(operator);
        vm.prank(operator);
        vault.invalidateOutflowNonce(1, DETAILS);
        vm.expectEmit(true, true, true, true, address(vault));
        emit MainOperatorChanged(operator, address(0), 2, 1, REASON_DISABLED, SECOND_DETAILS);
        _safeCall(abi.encodeCall(vault.disableMainOperator, (SECOND_DETAILS)));
        assertEq(vault.mainOperator(), address(0));
        assertEq(vault.operatorGeneration(), 2);
        assertEq(vault.outflowNonce(), 1);
    }

    function test_safeDisableRejectsNoStateAndEmptyDetails() public {
        vm.expectRevert(O1LiteralErrors.NoOperatorStateChange.selector);
        _safeCall(abi.encodeCall(vault.disableMainOperator, (DETAILS)));
        _nominate(operator, DETAILS);
        vm.expectRevert(O1LiteralErrors.EmptyDetailsHash.selector);
        _safeCall(abi.encodeCall(vault.disableMainOperator, (bytes32(0))));
    }

    function test_directRenounceRequiresActiveExactCallerAndPreservesNonce() public {
        vm.expectRevert(O1LiteralErrors.NoMainOperator.selector);
        vm.prank(stranger);
        vault.renounceMainOperator(DETAILS);

        _appoint(operator);
        vm.prank(operator);
        vault.invalidateOutflowNonce(1, DETAILS);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        vault.renounceMainOperator(DETAILS);
        vm.expectRevert(O1LiteralErrors.EmptyDetailsHash.selector);
        vm.prank(operator);
        vault.renounceMainOperator(bytes32(0));

        vm.expectEmit(true, true, true, true, address(vault));
        emit MainOperatorChanged(operator, address(0), 2, 1, REASON_RENOUNCED, SECOND_DETAILS);
        vm.prank(operator);
        vault.renounceMainOperator(SECOND_DETAILS);
        assertEq(vault.mainOperator(), address(0));
        assertEq(vault.operatorGeneration(), 2);
        assertEq(vault.outflowNonce(), 1);
    }

    // --- Exact EIP-712 payloads and direct successor replacement ---

    function test_eip712DomainAndIndependentOutflowHashAreLiteral() public view {
        (
            bytes1 fields,
            string memory name,
            string memory domainVersion,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        ) = vault.eip712Domain();
        assertEq(fields, bytes1(0x0f));
        assertEq(name, "OMERTA AcquisitionVault");
        assertEq(domainVersion, "1");
        assertEq(chainId, CHAIN_ID);
        assertEq(verifyingContract, address(vault));
        assertEq(salt, bytes32(0));
        assertEq(extensions.length, 0);

        IAcquisitionVaultV1.OutflowAuthorization memory authorization = IAcquisitionVaultV1.OutflowAuthorization({
            operator: operator,
            destination: stranger,
            amountWei: 3 ether,
            generation: 8,
            nonce: 11,
            issuedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            reasonCode: 1,
            detailsHash: DETAILS
        });
        bytes32 expected = _typedDigest(_domainSeparator(CHAIN_ID, address(vault)), _outflowStructHash(authorization));
        assertEq(vault.hashOutflowAuthorization(authorization), expected);
    }

    function test_outflowAuthorizationDigestBindsEveryFieldDomainVaultAndLiteralOrder() public view {
        IAcquisitionVaultV1.OutflowAuthorization memory base = IAcquisitionVaultV1.OutflowAuthorization({
            operator: operator,
            destination: stranger,
            amountWei: 17 ether,
            generation: 4,
            nonce: 9,
            issuedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + MAX_AUTH_LIFETIME),
            reasonCode: 1,
            detailsHash: DETAILS
        });
        bytes32 expected = _typedDigest(_domainSeparator(CHAIN_ID, address(vault)), _outflowStructHash(base));
        assertEq(vault.hashOutflowAuthorization(base), expected);
        assertNotEq(expected, _typedDigest(_domainSeparator(CHAIN_ID + 1, address(vault)), _outflowStructHash(base)));
        assertNotEq(expected, _typedDigest(_domainSeparator(CHAIN_ID, stranger), _outflowStructHash(base)));

        IAcquisitionVaultV1.OutflowAuthorization memory changed = base;
        changed.operator = address(1);
        assertNotEq(expected, vault.hashOutflowAuthorization(changed));
        changed = base;
        changed.destination = address(2);
        assertNotEq(expected, vault.hashOutflowAuthorization(changed));
        changed = base;
        ++changed.amountWei;
        assertNotEq(expected, vault.hashOutflowAuthorization(changed));
        changed = base;
        ++changed.generation;
        assertNotEq(expected, vault.hashOutflowAuthorization(changed));
        changed = base;
        ++changed.nonce;
        assertNotEq(expected, vault.hashOutflowAuthorization(changed));
        changed = base;
        ++changed.issuedAt;
        assertNotEq(expected, vault.hashOutflowAuthorization(changed));
        changed = base;
        ++changed.deadline;
        assertNotEq(expected, vault.hashOutflowAuthorization(changed));
        changed = base;
        changed.reasonCode = 2;
        assertNotEq(expected, vault.hashOutflowAuthorization(changed));
        changed = base;
        changed.detailsHash = SECOND_DETAILS;
        assertNotEq(expected, vault.hashOutflowAuthorization(changed));

        bytes32 wrongOrder = keccak256(
            abi.encode(
                OUTFLOW_TYPEHASH,
                base.destination,
                base.operator,
                base.amountWei,
                base.generation,
                base.nonce,
                base.issuedAt,
                base.deadline,
                base.reasonCode,
                base.detailsHash
            )
        );
        assertNotEq(expected, _typedDigest(_domainSeparator(CHAIN_ID, address(vault)), wrongOrder));
    }

    function test_successorHashBindsEveryFieldAndLiteralOrder() public view {
        IAcquisitionVaultV1.SuccessorConsent memory base = IAcquisitionVaultV1.SuccessorConsent({
            currentOperator: operator,
            successor: stranger,
            generation: 4,
            outflowNonce: 7,
            issuedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            reasonCode: REASON_REPLACED,
            detailsHash: DETAILS
        });
        bytes32 expected = _typedDigest(_domainSeparator(CHAIN_ID, address(vault)), _successorStructHash(base));
        assertEq(vault.hashSuccessorConsent(base), expected);
        assertNotEq(expected, _typedDigest(_domainSeparator(CHAIN_ID + 1, address(vault)), _successorStructHash(base)));
        assertNotEq(expected, _typedDigest(_domainSeparator(CHAIN_ID, stranger), _successorStructHash(base)));

        IAcquisitionVaultV1.SuccessorConsent memory changed = base;
        changed.currentOperator = address(1);
        assertNotEq(expected, vault.hashSuccessorConsent(changed));
        changed = base;
        changed.successor = address(2);
        assertNotEq(expected, vault.hashSuccessorConsent(changed));
        changed = base;
        changed.generation++;
        assertNotEq(expected, vault.hashSuccessorConsent(changed));
        changed = base;
        changed.outflowNonce++;
        assertNotEq(expected, vault.hashSuccessorConsent(changed));
        changed = base;
        changed.issuedAt++;
        assertNotEq(expected, vault.hashSuccessorConsent(changed));
        changed = base;
        changed.deadline++;
        assertNotEq(expected, vault.hashSuccessorConsent(changed));
        changed = base;
        changed.reasonCode = REASON_RENOUNCED;
        assertNotEq(expected, vault.hashSuccessorConsent(changed));
        changed = base;
        changed.detailsHash = SECOND_DETAILS;
        assertNotEq(expected, vault.hashSuccessorConsent(changed));

        bytes32 wrongOrder = keccak256(
            abi.encode(
                SUCCESSOR_TYPEHASH,
                base.successor,
                base.currentOperator,
                base.generation,
                base.outflowNonce,
                base.issuedAt,
                base.deadline,
                base.reasonCode,
                base.detailsHash
            )
        );
        assertNotEq(expected, _typedDigest(_domainSeparator(CHAIN_ID, address(vault)), wrongOrder));
    }

    function test_directEoaReplacementIsAtomicIncrementsOnceAndPreservesNonce() public {
        _appoint(operator);
        vm.prank(operator);
        vault.invalidateOutflowNonce(1, DETAILS);
        address successor = vm.addr(successorKey);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(successor);
        bytes memory signature = _sign(successorKey, _successorDigest(consent));

        vm.expectEmit(true, true, true, true, address(vault));
        emit MainOperatorChanged(operator, successor, 2, 1, REASON_REPLACED, DETAILS);
        vm.prank(operator);
        vault.replaceMainOperator(consent, signature);
        assertEq(vault.mainOperator(), successor);
        assertEq(vault.operatorGeneration(), 2);
        assertEq(vault.outflowNonce(), 1);
        assertEq(_pending().proposalId, bytes32(0));
    }

    function test_replacementRejectsZeroSameAndEveryO1RoleCollisionAtStageThree() public {
        _appoint(operator);
        O1SafeActor pendingOwnerCandidate = new O1SafeActor();
        _safeCall(abi.encodeCall(vault.transferOwnership, (address(pendingOwnerCandidate))));

        address[6] memory invalid =
            [address(0), operator, address(safe), address(pendingOwnerCandidate), address(vault), address(registry)];
        for (uint256 i; i < invalid.length; ++i) {
            IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(invalid[i]);
            _assertReplaceFailure(
                operator, consent, hex"01", abi.encodeWithSelector(O1LiteralErrors.InvalidOperatorReplacement.selector)
            );
        }
    }

    function test_replacementRequiresActiveDirectCallerAndRejectsRelay() public {
        IAcquisitionVaultV1.SuccessorConsent memory consent = IAcquisitionVaultV1.SuccessorConsent({
            currentOperator: address(0),
            successor: vm.addr(successorKey),
            generation: 0,
            outflowNonce: 0,
            issuedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            reasonCode: REASON_REPLACED,
            detailsHash: DETAILS
        });
        _assertReplaceFailure(
            stranger, consent, hex"01", abi.encodeWithSelector(O1LiteralErrors.NoMainOperator.selector)
        );

        _appoint(operator);
        consent = _validConsent(vm.addr(successorKey));
        bytes memory signature = _sign(successorKey, _successorDigest(consent));
        _assertReplaceFailure(
            stranger,
            consent,
            signature,
            abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, stranger)
        );

        O1SafeActor relay = new O1SafeActor();
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, address(relay)));
        relay.execute(address(vault), abi.encodeCall(vault.replaceMainOperator, (consent, signature)));
        assertEq(vault.mainOperator(), operator);
    }

    function test_replacementExactEightStageFirstFailureLadder() public {
        IAcquisitionVaultV1.SuccessorConsent memory allInvalid;
        _assertReplaceFailure(stranger, allInvalid, "", abi.encodeWithSelector(O1LiteralErrors.NoMainOperator.selector));

        _appoint(operator);
        _assertReplaceFailure(
            stranger,
            allInvalid,
            "",
            abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, stranger)
        );
        _assertReplaceFailure(
            operator, allInvalid, "", abi.encodeWithSelector(O1LiteralErrors.InvalidOperatorReplacement.selector)
        );

        address successor = vm.addr(successorKey);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(successor);
        consent.currentOperator = stranger;
        consent.reasonCode = REASON_NONE;
        consent.detailsHash = bytes32(0);
        consent.issuedAt = 0;
        consent.deadline = 0;
        _assertReplaceFailure(
            operator, consent, "", abi.encodeWithSelector(O1LiteralErrors.InvalidAuthorizationFields.selector)
        );

        consent.currentOperator = operator;
        _assertReplaceFailure(
            operator, consent, "", abi.encodeWithSelector(O1LiteralErrors.InvalidActionReason.selector, REASON_NONE)
        );
        consent.reasonCode = REASON_REPLACED;
        _assertReplaceFailure(operator, consent, "", abi.encodeWithSelector(O1LiteralErrors.EmptyDetailsHash.selector));
        consent.detailsHash = DETAILS;
        _assertReplaceFailure(
            operator, consent, "", abi.encodeWithSelector(O1LiteralErrors.InvalidAuthorizationWindow.selector)
        );
        consent.issuedAt = uint64(block.timestamp);
        consent.deadline = uint64(block.timestamp + 1 hours);
        _assertReplaceFailure(operator, consent, "", abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector));
    }

    function test_replacementMismatchedConsentIdentityGenerationAndNonceAreStageFour() public {
        _appoint(operator);
        address successor = vm.addr(successorKey);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(successor);

        consent.currentOperator = stranger;
        _assertReplaceFailure(
            operator, consent, hex"01", abi.encodeWithSelector(O1LiteralErrors.InvalidAuthorizationFields.selector)
        );
        consent = _validConsent(successor);
        consent.successor = stranger;
        _assertReplaceFailure(
            operator, consent, hex"01", abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
        consent = _validConsent(successor);
        consent.generation++;
        _assertReplaceFailure(
            operator, consent, hex"01", abi.encodeWithSelector(O1LiteralErrors.InvalidAuthorizationFields.selector)
        );
        consent = _validConsent(successor);
        consent.outflowNonce++;
        _assertReplaceFailure(
            operator, consent, hex"01", abi.encodeWithSelector(O1LiteralErrors.InvalidAuthorizationFields.selector)
        );
    }

    function test_replacementReasonAndDetailsHaveClosedStageFiveAndSixErrors() public {
        _appoint(operator);
        address successor = vm.addr(successorKey);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(successor);
        consent.reasonCode = REASON_RENOUNCED;
        _assertReplaceFailure(
            operator,
            consent,
            hex"01",
            abi.encodeWithSelector(O1LiteralErrors.InvalidActionReason.selector, REASON_RENOUNCED)
        );
        consent = _validConsent(successor);
        consent.detailsHash = bytes32(0);
        _assertReplaceFailure(
            operator, consent, hex"01", abi.encodeWithSelector(O1LiteralErrors.EmptyDetailsHash.selector)
        );
    }

    function test_authorizationWindowInclusiveEndpointsAndExactErrors() public {
        _appoint(operator);
        address successor = vm.addr(successorKey);

        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(successor);
        consent.deadline = consent.issuedAt;
        bytes memory signature = _sign(successorKey, _successorDigest(consent));
        uint256 checkpoint = vm.snapshotState();
        vm.prank(operator);
        vault.replaceMainOperator(consent, signature);
        assertEq(vault.mainOperator(), successor, "issuedAt/deadline inclusive endpoint rejected");
        assertTrue(vm.revertToState(checkpoint));

        consent = _validConsent(successor);
        consent.issuedAt = uint64(block.timestamp - 1 hours);
        consent.deadline = uint64(block.timestamp);
        signature = _sign(successorKey, _successorDigest(consent));
        vm.prank(operator);
        vault.replaceMainOperator(consent, signature);
        assertEq(vault.mainOperator(), successor, "deadline endpoint rejected");
    }

    function test_authorizationWindowRejectsZeroReversedFutureExpiredAndOverLifetime() public {
        _appoint(operator);
        address successor = vm.addr(successorKey);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(successor);

        consent.issuedAt = 0;
        _assertReplaceFailure(
            operator, consent, hex"01", abi.encodeWithSelector(O1LiteralErrors.InvalidAuthorizationWindow.selector)
        );
        consent = _validConsent(successor);
        consent.deadline = consent.issuedAt - 1;
        _assertReplaceFailure(
            operator, consent, hex"01", abi.encodeWithSelector(O1LiteralErrors.InvalidAuthorizationWindow.selector)
        );
        consent = _validConsent(successor);
        consent.deadline = consent.issuedAt + MAX_AUTH_LIFETIME + 1;
        _assertReplaceFailure(
            operator, consent, hex"01", abi.encodeWithSelector(O1LiteralErrors.InvalidAuthorizationWindow.selector)
        );
        consent = _validConsent(successor);
        consent.issuedAt = uint64(block.timestamp + 1);
        consent.deadline = consent.issuedAt;
        _assertReplaceFailure(
            operator, consent, hex"01", abi.encodeWithSelector(O1LiteralErrors.AuthorizationNotYetValid.selector)
        );
        consent = _validConsent(successor);
        consent.issuedAt = uint64(block.timestamp - 2);
        consent.deadline = uint64(block.timestamp - 1);
        _assertReplaceFailure(
            operator, consent, hex"01", abi.encodeWithSelector(O1LiteralErrors.AuthorizationExpired.selector)
        );
    }

    function test_wrongDomainVaultFieldOrderAndWrongKeySignaturesFailClosed() public {
        _appoint(operator);
        address successor = vm.addr(successorKey);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(successor);

        bytes32 structHash = _successorStructHash(consent);
        bytes memory wrongChainSig =
            _sign(successorKey, _typedDigest(_domainSeparator(CHAIN_ID + 1, address(vault)), structHash));
        _assertReplaceFailure(
            operator, consent, wrongChainSig, abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
        bytes memory wrongVaultSig = _sign(successorKey, _typedDigest(_domainSeparator(CHAIN_ID, stranger), structHash));
        _assertReplaceFailure(
            operator, consent, wrongVaultSig, abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
        bytes32 wrongOrder = keccak256(
            abi.encode(
                SUCCESSOR_TYPEHASH,
                consent.successor,
                consent.currentOperator,
                consent.generation,
                consent.outflowNonce,
                consent.issuedAt,
                consent.deadline,
                consent.reasonCode,
                consent.detailsHash
            )
        );
        bytes memory wrongOrderSig =
            _sign(successorKey, _typedDigest(_domainSeparator(CHAIN_ID, address(vault)), wrongOrder));
        _assertReplaceFailure(
            operator, consent, wrongOrderSig, abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
        bytes memory wrongKeySig = _sign(wrongKey, _successorDigest(consent));
        _assertReplaceFailure(
            operator, consent, wrongKeySig, abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
    }

    function test_eoaPathUsesEcrecoverPrecompileAndAcceptsCanonical65ByteSignature() public {
        _appoint(operator);
        address successor = vm.addr(successorKey);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(successor);
        bytes32 digest = _successorDigest(consent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(successorKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        vm.expectCall(address(1), abi.encode(digest, v, r, s));
        vm.prank(operator);
        vault.replaceMainOperator(consent, signature);
        assertEq(vault.mainOperator(), successor);
    }

    function test_eoaBadLengthHighSInvalidVZeroRecoverAndWrongSignerCollapseToInvalidSignature() public {
        _appoint(operator);
        address successor = vm.addr(successorKey);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(successor);
        bytes32 digest = _successorDigest(consent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(successorKey, digest);

        bytes memory shortSignature = new bytes(64);
        _assertReplaceFailure(
            operator, consent, shortSignature, abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
        bytes32 highS = bytes32(SECP256K1_N - uint256(s));
        uint8 flippedV = v == 27 ? 28 : 27;
        _assertReplaceFailure(
            operator,
            consent,
            abi.encodePacked(r, highS, flippedV),
            abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
        _assertReplaceFailure(
            operator,
            consent,
            abi.encodePacked(r, s, uint8(29)),
            abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
        _assertReplaceFailure(
            operator,
            consent,
            abi.encodePacked(bytes32(0), bytes32(0), uint8(27)),
            abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
        _assertReplaceFailure(
            operator,
            consent,
            _sign(wrongKey, digest),
            abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
    }

    // --- Bounded ERC-1271 validation, returndata discipline, and reentrancy ---

    function test_erc1271PathRequestsExactGasAndAcceptsOnlyExact32ByteLeftAlignedMagic() public {
        _appoint(operator);
        O1ERC1271Mock successor = new O1ERC1271Mock();
        successor.configure(O1ERC1271Mock.Mode.GAS_WINDOW);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(address(successor));
        bytes memory signature = hex"1234";
        bytes32 digest = _successorDigest(consent);
        bytes memory walletCall = abi.encodeWithSelector(bytes4(0x1626ba7e), digest, signature);
        vm.expectCallMinGas(address(successor), 0, uint64(ERC1271_CALL_GAS), walletCall);
        vm.prank(operator);
        vault.replaceMainOperator(consent, signature);
        assertEq(vault.mainOperator(), address(successor));
        assertEq(vault.operatorGeneration(), 2);
    }

    function test_erc1271WrongMagicAndEveryNon32ReturnLengthFailWithoutWalletDataBubbling() public {
        _appoint(operator);
        O1ERC1271Mock successor = new O1ERC1271Mock();
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(address(successor));
        bytes memory signature = hex"1234";
        O1ERC1271Mock.Mode[7] memory modes = [
            O1ERC1271Mock.Mode.WRONG_MAGIC,
            O1ERC1271Mock.Mode.RETURN_0,
            O1ERC1271Mock.Mode.RETURN_4,
            O1ERC1271Mock.Mode.RETURN_31,
            O1ERC1271Mock.Mode.RETURN_33,
            O1ERC1271Mock.Mode.RETURN_64,
            O1ERC1271Mock.Mode.REVERT_DATA
        ];
        for (uint256 i; i < modes.length; ++i) {
            successor.configure(modes[i]);
            _assertReplaceFailure(
                operator, consent, signature, abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
            );
        }
        successor.configure(O1ERC1271Mock.Mode.REVERT_EMPTY);
        _assertReplaceFailure(
            operator, consent, signature, abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
        successor.configure(O1ERC1271Mock.Mode.RIGHT_ALIGNED_MAGIC);
        _assertReplaceFailure(
            operator, consent, signature, abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
    }

    function test_erc1271LargeReturndataIsBoundedAndMapsToInvalidSignatureWithoutBubbling() public {
        _appoint(operator);
        O1ERC1271Mock successor = new O1ERC1271Mock();
        successor.configure(O1ERC1271Mock.Mode.RETURNDATA_BOMB);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(address(successor));
        O1State memory beforeState = _state();
        vm.recordLogs();
        vm.prank(operator);
        (bool ok, bytes memory returndata) =
            address(vault).call{gas: 215_000}(abi.encodeCall(vault.replaceMainOperator, (consent, hex"1234")));
        assertFalse(ok);
        _assertRevertData(returndata, abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector));
        assertEq(vm.getRecordedLogs().length, 0);
        _assertStateEq(_state(), beforeState);
    }

    function test_erc1271DeliberateOver100kConsumptionAndMalformedSignatureFailClosed() public {
        _appoint(operator);
        O1ERC1271Mock successor = new O1ERC1271Mock();
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(address(successor));
        successor.configure(O1ERC1271Mock.Mode.BURN_GAS);
        _assertReplaceFailure(
            operator, consent, hex"1234", abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );

        bytes memory expectedSignature = hex"aabbccdd";
        successor.configureBound(_successorDigest(consent), expectedSignature);
        _assertReplaceFailure(
            operator, consent, hex"aabbccde", abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
    }

    function test_signatureLengthRejectsEmptyAndOver4096BeforeWalletStorageReadsAndAcceptsExactMaximum() public {
        _appoint(operator);
        O1ERC1271Mock successor = new O1ERC1271Mock();
        successor.configure(O1ERC1271Mock.Mode.VALID);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(address(successor));

        vm.record();
        _assertReplaceFailure(operator, consent, "", abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector));
        (bytes32[] memory reads,) = vm.accesses(address(successor));
        assertEq(reads.length, 0, "empty signature reached wallet external work");

        bytes memory oversized = new bytes(MAX_SIGNATURE_BYTES + 1);
        oversized[0] = 0x01;
        vm.record();
        _assertReplaceFailure(
            operator, consent, oversized, abi.encodeWithSelector(O1LiteralErrors.InvalidSignature.selector)
        );
        (reads,) = vm.accesses(address(successor));
        assertEq(reads.length, 0, "oversized signature reached wallet external work");

        bytes memory maximum = new bytes(MAX_SIGNATURE_BYTES);
        maximum[0] = 0x01;
        vm.prank(operator);
        vault.replaceMainOperator(consent, maximum);
        assertEq(vault.mainOperator(), address(successor));
    }

    function test_erc1271PrecallGasGuardHasExclusiveInsufficientGasError() public {
        _appoint(operator);
        O1ERC1271Mock successor = new O1ERC1271Mock();
        successor.configure(O1ERC1271Mock.Mode.VALID);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(address(successor));
        bytes memory callData = abi.encodeCall(vault.replaceMainOperator, (consent, hex"01"));
        O1State memory beforeState = _state();
        vm.recordLogs();
        vm.prank(operator);
        (bool ok, bytes memory returndata) = address(vault).call{gas: 150_000}(callData);
        assertFalse(ok);
        _assertRevertData(
            returndata, abi.encodeWithSelector(O1LiteralErrors.InsufficientSignatureValidationGas.selector)
        );
        assertEq(vm.getRecordedLogs().length, 0);
        _assertStateEq(_state(), beforeState);
    }

    function test_validatorSeamFreezesExactImmediatePrecallAndPostcallGasBoundaries() public {
        O1SignatureGasBoundaryHarness harness =
            new O1SignatureGasBoundaryHarness(address(safe), address(registry), GLOBAL_CAP);
        vm.expectRevert(O1LiteralErrors.InsufficientSignatureValidationGas.selector);
        harness.requireErc1271PrecallGas(159_999);
        harness.requireErc1271PrecallGas(160_000);

        vm.expectRevert(O1LiteralErrors.InsufficientSignatureValidationGas.selector);
        harness.requireErc1271PostcallGas(49_999);
        harness.requireErc1271PostcallGas(50_000);
    }

    function test_erc1271PostcallReserveGuardUsesTheSharedProductionSeam() public {
        O1SignatureGasBoundaryHarness harness =
            new O1SignatureGasBoundaryHarness(address(safe), address(registry), GLOBAL_CAP);
        vm.expectRevert(O1LiteralErrors.InsufficientSignatureValidationGas.selector);
        harness.requireErc1271PostcallGas(49_999);
        harness.requireErc1271PostcallGas(50_000);
        assertEq(vault.ERC1271_POST_CALL_GAS_RESERVE(), 50_000);
    }

    function test_erc1271StaticReentrancyHitsGuardAndOuterTransitionOccursExactlyOnce() public {
        _appoint(operator);
        O1ERC1271Mock successor = new O1ERC1271Mock();
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(address(successor));
        bytes memory signature = hex"1234";
        successor.configureReentry(address(vault), abi.encodeCall(vault.replaceMainOperator, (consent, signature)));
        vm.prank(operator);
        vault.replaceMainOperator(consent, signature);
        assertEq(vault.mainOperator(), address(successor));
        assertEq(vault.operatorGeneration(), 2);
        assertEq(vault.outflowNonce(), 0);
    }

    function test_erc1271WitnessReadsEveryPretransitionFieldBeforeApplicationStateChanges() public {
        _appoint(operator);
        O1ERC1271Mock successor = new O1ERC1271Mock();
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(address(successor));
        O1State memory beforeState = _state();
        successor.configurePrestateWitness(address(vault), _stateHash(beforeState));

        vm.prank(operator);
        vault.replaceMainOperator(consent, hex"1234");

        assertEq(vault.mainOperator(), address(successor));
        assertEq(vault.operatorGeneration(), beforeState.generation + 1);
        assertEq(vault.outflowNonce(), beforeState.nonce);
        assertEq(vault.nominationNonce(), beforeState.nominationNonce);
        assertEq(vault.owner(), beforeState.owner);
        assertEq(vault.pendingOwner(), beforeState.pendingOwner);
        assertEq(vault.stockTokenRegistryV2(), beforeState.registry);
        assertEq(_pending().proposalId, bytes32(0));
    }

    // --- Shared next-outflow nonce and pause/local-readiness behavior ---

    function test_nonceInvalidationRequiresActiveDirectOperatorOneStepAndDetails() public {
        vm.expectRevert(O1LiteralErrors.NoMainOperator.selector);
        vm.prank(stranger);
        vault.invalidateOutflowNonce(1, DETAILS);

        _appoint(operator);
        _assertCallFailureUnchanged(
            stranger,
            abi.encodeCall(vault.invalidateOutflowNonce, (1, DETAILS)),
            abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, stranger)
        );
        _assertCallFailureUnchanged(
            operator,
            abi.encodeCall(vault.invalidateOutflowNonce, (1, bytes32(0))),
            abi.encodeWithSelector(O1LiteralErrors.EmptyDetailsHash.selector)
        );
        _assertCallFailureUnchanged(
            operator,
            abi.encodeCall(vault.invalidateOutflowNonce, (2, DETAILS)),
            abi.encodeWithSelector(O1LiteralErrors.InvalidOutflowNonceStep.selector, 0, 2)
        );
        _assertCallFailureUnchanged(
            operator,
            abi.encodeCall(vault.invalidateOutflowNonce, (type(uint256).max - 1, DETAILS)),
            abi.encodeWithSelector(O1LiteralErrors.InvalidOutflowNonceStep.selector, 0, type(uint256).max - 1)
        );
        _assertCallFailureUnchanged(
            operator,
            abi.encodeCall(vault.invalidateOutflowNonce, (type(uint256).max, DETAILS)),
            abi.encodeWithSelector(O1LiteralErrors.InvalidOutflowNonceStep.selector, 0, type(uint256).max)
        );

        vm.expectEmit(true, true, false, true, address(vault));
        emit OutflowNonceInvalidated(operator, 1, 0, 1, REASON_NONCE_INVALIDATED, DETAILS);
        vm.prank(operator);
        vault.invalidateOutflowNonce(1, DETAILS);
        assertEq(vault.outflowNonce(), 1);
        assertEq(address(vault).balance, 0, "nonce invalidation moved native funds");
    }

    function test_nonceTheoreticalUint256BoundaryFailsClosedWithoutWrap() public {
        _appoint(operator);
        _writeScalar(vault.outflowNonce.selector, type(uint256).max - 1);
        vm.prank(operator);
        vault.invalidateOutflowNonce(type(uint256).max, DETAILS);
        assertEq(vault.outflowNonce(), type(uint256).max);

        _assertCallFailureUnchanged(
            operator,
            abi.encodeCall(vault.invalidateOutflowNonce, (0, SECOND_DETAILS)),
            abi.encodeWithSelector(O1LiteralErrors.OutflowNonceExhausted.selector, type(uint256).max)
        );
        assertEq(vault.outflowNonce(), type(uint256).max);
    }

    function testFuzz_boundedTraceNonceGrowthNeverExceedsSuccessfulOneStepInvalidations(
        uint8 rawSteps,
        uint256 validMask
    ) public {
        _appoint(operator);
        uint256 steps = bound(uint256(rawSteps), 1, 32);
        uint256 successful;
        for (uint256 i; i < steps; ++i) {
            uint256 current = vault.outflowNonce();
            bool attemptValid = ((validMask >> i) & 1) == 1;
            uint256 supplied = attemptValid ? current + 1 : current + 2;
            vm.prank(operator);
            (bool ok,) = address(vault).call(abi.encodeCall(vault.invalidateOutflowNonce, (supplied, DETAILS)));
            if (ok) ++successful;
            assertEq(vault.outflowNonce(), successful);
            assertLe(vault.outflowNonce(), successful);
            assertTrue(vault.outflowNonce() < type(uint256).max - 1);
        }
    }

    function test_nonceNeverResetsAcrossOwnershipPauseDisableRenounceReappointmentAndReplacement() public {
        _appoint(operator);
        vm.prank(operator);
        vault.invalidateOutflowNonce(1, DETAILS);

        O1SafeActor ownerCandidate = new O1SafeActor();
        _safeCall(abi.encodeCall(vault.transferOwnership, (address(ownerCandidate))));
        _safeCall(abi.encodeCall(vault.transferOwnership, (address(0))));
        assertEq(vault.outflowNonce(), 1);

        _forcePaused(false);
        vm.prank(operator);
        vault.pause(DETAILS);
        assertEq(vault.outflowNonce(), 1);

        _safeCall(abi.encodeCall(vault.disableMainOperator, (DETAILS)));
        assertEq(vault.outflowNonce(), 1);
        _appoint(operator);
        vm.prank(operator);
        vault.renounceMainOperator(DETAILS);
        assertEq(vault.outflowNonce(), 1);

        _appoint(operator);
        address successor = vm.addr(successorKey);
        IAcquisitionVaultV1.SuccessorConsent memory consent = _validConsent(successor);
        vm.prank(operator);
        vault.replaceMainOperator(consent, _sign(successorKey, _successorDigest(consent)));
        assertEq(vault.outflowNonce(), 1);
    }

    function test_unpauseIsSafeOnlyAndUsesExactO1LocalReadinessPredicates() public {
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        vault.unpause(DETAILS);
        vm.expectRevert(O1LiteralErrors.EmptyDetailsHash.selector);
        _safeCall(abi.encodeCall(vault.unpause, (bytes32(0))));

        vm.chainId(CHAIN_ID + 1);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.LocalReadinessFailed.selector, READINESS_WRONG_CHAIN));
        _safeCall(abi.encodeCall(vault.unpause, (DETAILS)));
        vm.chainId(CHAIN_ID);

        vm.etch(address(registry), "");
        vm.expectRevert(
            abi.encodeWithSelector(O1LiteralErrors.LocalReadinessFailed.selector, READINESS_REGISTRY_CODE_MISSING)
        );
        _safeCall(abi.encodeCall(vault.unpause, (DETAILS)));
        vm.etch(address(registry), type(O1RegistryProbe).runtimeCode);

        vm.etch(address(safe), "");
        vm.expectRevert(
            abi.encodeWithSelector(O1LiteralErrors.LocalReadinessFailed.selector, READINESS_OWNER_CODE_MISSING)
        );
        vm.prank(address(safe));
        vault.unpause(DETAILS);
    }

    function test_unpauseRejectsRoleCollisionAndDoesNotRequeryRegistryChain() public {
        _writeAddress(vault.pendingOwner.selector, address(safe));
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.LocalReadinessFailed.selector, READINESS_ROLE_COLLISION));
        _safeCall(abi.encodeCall(vault.unpause, (DETAILS)));

        _writeAddress(vault.pendingOwner.selector, address(0));
        registry.configure(O1RegistryProbe.Mode.REVERT_DATA, CHAIN_ID + 1);
        vm.expectRevert(
            abi.encodeWithSelector(O1LiteralErrors.LocalReadinessFailed.selector, READINESS_ACTIVE_INGRESS_MISSING)
        );
        _safeCall(abi.encodeCall(vault.unpause, (DETAILS)));
        assertTrue(vault.paused(), "Task-4 pre-ingress vault unexpectedly unpaused");
    }

    function test_unpauseRejectsEveryO1OwnerOperatorPendingAndImmutableRoleCollisionShape() public {
        bytes memory collisionError =
            abi.encodeWithSelector(O1LiteralErrors.LocalReadinessFailed.selector, READINESS_ROLE_COLLISION);
        O1SafeActor pendingOwnerCandidate = new O1SafeActor();

        // pendingOwner against owner / vault / RegistryV2
        _safeCall(abi.encodeCall(vault.transferOwnership, (address(pendingOwnerCandidate))));
        uint256 base = vm.snapshotState();
        address[3] memory pendingOwnerCollisions = [address(safe), address(vault), address(registry)];
        for (uint256 i; i < pendingOwnerCollisions.length; ++i) {
            _writeAddress(vault.pendingOwner.selector, pendingOwnerCollisions[i]);
            _assertCallFailureUnchanged(address(safe), abi.encodeCall(vault.unpause, (DETAILS)), collisionError);
            assertTrue(vm.revertToState(base));
        }
        _safeCall(abi.encodeCall(vault.transferOwnership, (address(0))));

        // active mainOperator against owner / vault / RegistryV2
        _appoint(operator);
        base = vm.snapshotState();
        address[3] memory activeCollisions = [address(safe), address(vault), address(registry)];
        for (uint256 i; i < activeCollisions.length; ++i) {
            _writeAddress(vault.mainOperator.selector, activeCollisions[i]);
            _assertCallFailureUnchanged(address(safe), abi.encodeCall(vault.unpause, (DETAILS)), collisionError);
            assertTrue(vm.revertToState(base));
        }

        // active mainOperator against pendingOwner
        _safeCall(abi.encodeCall(vault.transferOwnership, (address(pendingOwnerCandidate))));
        base = vm.snapshotState();
        _writeAddress(vault.mainOperator.selector, address(pendingOwnerCandidate));
        _assertCallFailureUnchanged(address(safe), abi.encodeCall(vault.unpause, (DETAILS)), collisionError);
        assertTrue(vm.revertToState(base));
        _safeCall(abi.encodeCall(vault.transferOwnership, (address(0))));
        _safeCall(abi.encodeCall(vault.disableMainOperator, (SECOND_DETAILS)));

        // pending nominee against owner / vault / RegistryV2
        _nominate(operator, DETAILS);
        base = vm.snapshotState();
        address[3] memory nomineeCollisions = [address(safe), address(vault), address(registry)];
        for (uint256 i; i < nomineeCollisions.length; ++i) {
            _writeAddressAtDepth(vault.pendingMainOperatorNomination.selector, 2, nomineeCollisions[i]);
            _assertCallFailureUnchanged(address(safe), abi.encodeCall(vault.unpause, (DETAILS)), collisionError);
            assertTrue(vm.revertToState(base));
        }

        // pending nominee against pendingOwner
        _safeCall(abi.encodeCall(vault.transferOwnership, (address(pendingOwnerCandidate))));
        base = vm.snapshotState();
        _writeAddressAtDepth(vault.pendingMainOperatorNomination.selector, 2, address(pendingOwnerCandidate));
        _assertCallFailureUnchanged(address(safe), abi.encodeCall(vault.unpause, (DETAILS)), collisionError);
        assertTrue(vm.revertToState(base));

        // active and pending operator identities may never coexist or overlap.
        _writeAddress(vault.mainOperator.selector, operator);
        _assertCallFailureUnchanged(address(safe), abi.encodeCall(vault.unpause, (DETAILS)), collisionError);
    }

    function test_pauseEmitsExactInheritedThenRiskEvidenceForSafeAndOperatorActors() public {
        _forcePaused(false);
        vm.recordLogs();
        _safeCall(abi.encodeCall(vault.pause, (SECOND_DETAILS)));
        _assertRiskTransitionLogs(vm.getRecordedLogs(), true, address(safe), SECOND_DETAILS);

        _forcePaused(false);
        _appoint(operator);
        vm.recordLogs();
        vm.prank(operator);
        vault.pause(SECOND_DETAILS);
        _assertRiskTransitionLogs(vm.getRecordedLogs(), true, operator, SECOND_DETAILS);
    }

    function test_safeAndActiveOperatorMayPauseButPendingNomineeAndStrangerMayNot() public {
        _forcePaused(false);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        vault.pause(DETAILS);

        O1SafeActor relay = new O1SafeActor();
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, address(relay)));
        relay.execute(address(vault), abi.encodeCall(vault.pause, (DETAILS)));

        bytes32 proposalId = _nominate(operator, DETAILS);
        vm.expectRevert(abi.encodeWithSelector(O1LiteralErrors.OwnableUnauthorizedAccount.selector, operator));
        vm.prank(operator);
        vault.pause(DETAILS);
        _safeCall(abi.encodeCall(vault.cancelMainOperatorNomination, (proposalId, SECOND_DETAILS)));

        vm.expectEmit(true, false, false, true, address(vault));
        emit RiskPaused(address(safe), REASON_PAUSED, DETAILS);
        _safeCall(abi.encodeCall(vault.pause, (DETAILS)));
        assertTrue(vault.paused());

        _forcePaused(false);
        _appoint(operator);
        vm.prank(operator);
        vault.pause(SECOND_DETAILS);
        assertTrue(vault.paused());
    }

    function test_pauseRejectsEmptyDetailsAndAlreadyPausedWithoutChangingAuthority() public {
        vm.expectRevert(O1LiteralErrors.ExpectedPause.selector);
        _safeCall(abi.encodeCall(vault.pause, (DETAILS)));
        _forcePaused(false);
        O1State memory beforeState = _state();
        vm.expectRevert(O1LiteralErrors.EmptyDetailsHash.selector);
        _safeCall(abi.encodeCall(vault.pause, (bytes32(0))));
        _assertStateEq(_state(), beforeState);
    }
}
