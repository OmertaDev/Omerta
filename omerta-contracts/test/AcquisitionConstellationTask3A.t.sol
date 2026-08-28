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
import {IAcquisitionAuthorityV2} from "../src/interfaces/IAcquisitionAuthorityV2.sol";

interface ITask3AFactory {
    error RegistryChainMismatch(uint256 actualChainId);
    error FactoryInvalidGlobalLifetimeCap();
    error FactoryCoreSnapshotCallFailed();
    error FactoryCoreSnapshotReturnLength(uint256 actualLength);
    error FactoryCoreSnapshotSemanticMismatch(uint8 field);
    error FactoryAuthoritySnapshotSemanticMismatch(uint8 field);

    function factoryState()
        external
        view
        returns (
            bytes32 manifestHash,
            bytes32 deploymentCommitment,
            uint8 phase,
            uint8 nextChildIndex,
            address safe,
            bytes32 configurationRoot,
            address registry,
            bytes32 registryRuntimeHash,
            uint256 globalLifetimeCanonicalDepositCapWei
        );

    function childCommitment(uint8 index)
        external
        view
        returns (address child, bytes32 initcodeHash, bytes32 runtimeHash);

    function deployNext(bytes calldata initcode) external returns (address child);
    function finalizeConstellation() external;
}

interface ITask3ACore {
    error CoreFactoryZero();
    error CoreManifestHashZero();
    error CoreZeroAddress();
    error CoreContractRequired(address target);
    error CoreAddressMismatch(address expected, address actual);
    error CorePeerMismatch(uint8 index, address expected, address actual);
    error InvalidGlobalLifetimeCap();
    error CoreFinalizerUnauthorized(address caller);
    error CoreManifestHashMismatch(bytes32 expected, bytes32 actual);
    error CoreAlreadyFinalized();
    error CoreInitialStateMismatch(uint8 field);

    function coreTopology() external view returns (address factory, bytes32 manifestHash, bool finalized);
    function coreSnapshot()
        external
        view
        returns (
            uint256,
            address,
            bytes32,
            address,
            address,
            address,
            address,
            address,
            bool,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        );
    function globalLifetimeCanonicalDepositCapWei() external view returns (uint256);
    function finalizeCore(bytes32 manifestHash) external;
}

interface ITask3AAuthority {
    error AuthorityCoreCapCallFailed();
    error AuthorityCoreCapReturnLength(uint256 actualLength);
    error AuthorityCoreCapSemanticMismatch(uint256 actualCapWei);
    error InvalidIngressConfig();
    error IngressProposalMissing();
    error ProposalIdMismatch(bytes32 expectedId, bytes32 actualId);
    error ProposalNotReady(uint64 eligibleAt);
    error ProposalExpired(uint64 expiresAt);
    error IngressActive(address ingress);
    error LocalReadinessFailed(uint8 condition);

    function finalizeAuthority(bytes32 manifestHash) external;
    function proposeIngress(IAcquisitionAuthorityV2.IngressConfig calldata config, bytes32 detailsHash)
        external
        returns (bytes32 proposalId);
    function cancelIngressProposal(bytes32 proposalId, bytes32 detailsHash) external;
    function expireIngressProposal(bytes32 proposalId) external;
    function activateIngress(bytes32 proposalId) external returns (uint256 generation);
    function disableIngress(bytes32 detailsHash) external;
    function pendingIngressProposal() external view returns (IAcquisitionAuthorityV2.PendingIngressProposal memory);
    function ingressProposalNonce() external view returns (uint256);
    function ingressGeneration() external view returns (uint256);
    function activeIngressGeneration() external view returns (uint256);
    function unpause(bytes32 detailsHash) external;
}

contract Task3ASafe {}

contract Task3AIngress {}

contract Task3AForceEther {
    constructor(address payable target) payable {
        selfdestruct(target);
    }
}

contract Task3APrefundERC20 {
    event Transfer(address indexed from, address indexed to, uint256 amount);

    mapping(address account => uint256 balance) public balanceOf;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        uint256 balance = balanceOf[msg.sender];
        require(balance >= amount);
        unchecked {
            balanceOf[msg.sender] = balance - amount;
        }
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
}

contract Task3AVanishingPeer {
    constructor() {
        selfdestruct(payable(msg.sender));
    }
}

contract Task3ARawCreateDispatcher {
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

contract Task3ARegistry {
    uint256 internal _chainId;
    uint8 internal _mode;

    constructor(uint256 chainId_) {
        _chainId = chainId_;
    }

    function setChainId(uint256 chainId_) external {
        _chainId = chainId_;
    }

    function setMode(uint8 mode_) external {
        _mode = mode_;
    }

    fallback() external {
        require(msg.sig == bytes4(keccak256("supportedChainId()")));
        uint8 mode = _mode;
        if (mode == 1) revert();
        if (mode == 2) assembly { for {} 1 {} {} }
        uint256 chainId_ = _chainId;
        uint256 length = mode == 3 ? 31 : mode == 4 ? 33 : mode == 5 ? 4096 : 32;
        assembly ("memory-safe") {
            mstore(0, chainId_)
            return(0, length)
        }
    }
}

contract Task3ACapMock {
    uint256 internal _cap;
    uint8 internal _mode;

    function setCap(uint256 cap_) external {
        _cap = cap_;
    }

    function setMode(uint8 mode_) external {
        _mode = mode_;
    }

    fallback() external {
        uint8 mode = _mode;
        if (msg.sig != bytes4(keccak256("globalLifetimeCanonicalDepositCapWei()")) || msg.data.length != 4) {
            assembly ("memory-safe") {
                mstore(0, mode)
                revert(0, 32)
            }
        }
        if (mode == 1) revert();
        if (mode == 2) assembly { for {} 1 {} {} }
        if (mode == 7) assembly { revert(0, 4096) }
        uint256 value = mode == 6 ? 0 : _cap;
        uint256 length = mode == 3 ? 31 : mode == 4 ? 33 : mode == 5 ? 4096 : 32;
        assembly ("memory-safe") {
            mstore(0, value)
            return(0, length)
        }
    }
}

contract Task3AShell {
    address internal _factory;
    bytes32 internal _manifest;
    bool internal _finalized;

    constructor(address factory_, bytes32 manifest_) {
        _factory = factory_;
        _manifest = manifest_;
    }

    function authorityTopology() external view returns (address, bytes32, bool) {
        return (_factory, _manifest, _finalized);
    }

    function coreTopology() external view returns (address, bytes32, bool) {
        return (_factory, _manifest, _finalized);
    }

    function budgetBookTopology() external view returns (address, bytes32, bool) {
        return (_factory, _manifest, _finalized);
    }

    function intentExecutionTopology() external view returns (address, bytes32, bool) {
        return (_factory, _manifest, _finalized);
    }

    function reconciliationTopology() external view returns (address, bytes32, bool) {
        return (_factory, _manifest, _finalized);
    }

    function finalizeAuthority(bytes32 manifest_) external {
        _finalize(manifest_);
    }

    function finalizeCore(bytes32 manifest_) external {
        _finalize(manifest_);
    }

    function finalizeBudgetBook(bytes32 manifest_) external {
        _finalize(manifest_);
    }

    function finalizeIntentExecution(bytes32 manifest_) external {
        _finalize(manifest_);
    }

    function finalizeReconciliation(bytes32 manifest_) external {
        _finalize(manifest_);
    }

    function _finalize(bytes32 manifest_) private {
        require(msg.sender == _factory && manifest_ == _manifest && !_finalized);
        _finalized = true;
    }
}

contract Task3AMaliciousAuthoritySnapshot {
    address internal _factory;
    bytes32 internal _manifest;
    bool internal _finalized;
    uint8 internal _mode;
    uint256[27] internal _words;

    constructor(
        address factory_,
        bytes32 manifest_,
        address safe_,
        address registry_,
        address core_,
        address budget_,
        address intent_,
        address reconciliation_
    ) {
        _factory = factory_;
        _manifest = manifest_;
        _words[0] = 2;
        _words[1] = uint160(factory_);
        _words[2] = uint256(manifest_);
        _words[3] = uint160(registry_);
        _words[4] = uint160(core_);
        _words[5] = uint160(budget_);
        _words[6] = uint160(intent_);
        _words[7] = uint160(reconciliation_);
        _words[9] = uint160(safe_);
        _words[11] = 1;
        _words[24] = uint256(
            keccak256(
                abi.encode(bytes32(0), uint256(0), address(0), address(0), uint64(0), uint64(0), uint64(0), bytes32(0))
            )
        );
        _words[26] = uint256(
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
    }

    function setMode(uint8 mode_) external {
        _mode = mode_;
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

    function finalizeAuthority(bytes32 manifest_) external {
        require(msg.sender == _factory && manifest_ == _manifest && !_finalized);
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

contract Task3AMaliciousCoreSnapshot {
    error CoreFinalizerUnauthorized(address caller);
    error CoreManifestHashMismatch(bytes32 expected, bytes32 actual);
    error CoreAlreadyFinalized();
    error CoreInitialStateMismatch(uint8 field);

    address internal _factory;
    bytes32 internal _manifest;
    bool internal _finalized;
    uint8 internal _mode;
    uint256[18] internal _words;

    constructor(
        address factory_,
        bytes32 manifest_,
        address authority_,
        address registry_,
        address budget_,
        address intent_,
        address reconciliation_,
        uint256 cap_
    ) {
        _factory = factory_;
        _manifest = manifest_;
        _words[0] = 3;
        _words[1] = uint160(factory_);
        _words[2] = uint256(manifest_);
        _words[3] = uint160(authority_);
        _words[4] = uint160(registry_);
        _words[5] = uint160(budget_);
        _words[6] = uint160(intent_);
        _words[7] = uint160(reconciliation_);
        _words[9] = cap_;
    }

    function setMode(uint8 mode_) external {
        _mode = mode_;
    }

    function setWord(uint8 field, uint256 value) external {
        _words[field] = value;
    }

    function word(uint8 field) external view returns (uint256) {
        return _words[field];
    }

    function coreTopology() external view returns (address, bytes32, bool) {
        return (_factory, _manifest, _finalized);
    }

    function finalizeCore(bytes32 manifest_) external {
        if (msg.sender != _factory) revert CoreFinalizerUnauthorized(msg.sender);
        if (manifest_ != _manifest) revert CoreManifestHashMismatch(_manifest, manifest_);
        if (_finalized) revert CoreAlreadyFinalized();
        for (uint8 field = 10; field < 18; ++field) {
            if (_words[field] != 0) revert CoreInitialStateMismatch(field);
        }
        _finalized = true;
    }

    fallback() external {
        require(msg.sig == bytes4(keccak256("coreSnapshot()")) && msg.data.length == 4);
        uint8 mode = _mode;
        if (mode == 1) revert();
        if (mode == 2) assembly { for {} 1 {} {} }
        if (mode == 6) assembly { revert(0, 4096) }
        uint256 length = mode == 3 ? 575 : mode == 4 ? 577 : mode == 5 ? 4096 : 576;
        assembly ("memory-safe") {
            let output := mload(0x40)
            for { let i := 0 } lt(i, 18) { i := add(i, 1) } {
                mstore(add(output, mul(i, 0x20)), sload(add(_words.slot, i)))
            }
            return(output, length)
        }
    }
}

contract AcquisitionConstellationTask3ATest is Test {
    uint256 internal constant CHAIN_ID = 4663;
    uint256 internal constant GLOBAL_CAP = 100;
    bytes32 internal constant TASK2_CONFIG_TAG = keccak256("OMERTA_ACQUISITION_TASK2_CONFIG_V1");
    bytes32 internal constant TASK3_CONFIG_TAG = keccak256("OMERTA_ACQUISITION_TASK3_CONFIG_V1");
    bytes32 internal constant CONSTELLATION_TAG = keccak256("OMERTA_ACQUISITION_CONSTELLATION_V1");
    bytes32 internal constant DEPLOYMENT_TAG = keccak256("OMERTA_ACQUISITION_DEPLOYMENT_V1");
    bytes4 internal constant CORE_CAP_SELECTOR = bytes4(keccak256("globalLifetimeCanonicalDepositCapWei()"));
    bytes4 internal constant CORE_SNAPSHOT_SELECTOR = bytes4(keccak256("coreSnapshot()"));

    struct ProductionBundle {
        address predictedFactory;
        address[5] children;
        bytes32 configurationRoot;
        bytes32 manifest;
        bytes[5] initcodes;
        bytes32[5] initcodeHashes;
        bytes32[5] runtimeHashes;
    }

    struct SnapshotFixture {
        ITask3AFactory factory;
        Task3AMaliciousAuthoritySnapshot authority;
        Task3AMaliciousCoreSnapshot core;
        address[5] children;
    }

    struct AuthorityFixture {
        ITask3AAuthority authority;
        Task3ACapMock core;
        address coreAddress;
        Task3ARawCreateDispatcher factory;
        bytes32 manifest;
    }

    Task3ASafe internal safe;
    Task3ARegistry internal registry;

    function setUp() public {
        vm.chainId(CHAIN_ID);
        vm.warp(1_000_000);
        safe = new Task3ASafe();
        registry = new Task3ARegistry(CHAIN_ID);
    }

    function test_task3A_01_freshGraphCommitsCapConfigurationManifestAndCreateOrder() public {
        address predictedFactory = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        ProductionBundle memory b = _productionBundle(predictedFactory, GLOBAL_CAP);
        address deployed = _rawCreate(_futureFactoryInitcode(GLOBAL_CAP, b.initcodeHashes, b.runtimeHashes));
        assertEq(deployed, predictedFactory);

        (bool ok, bytes memory state) = deployed.staticcall(abi.encodeWithSignature("factoryState()"));
        assertTrue(ok);
        assertEq(state.length, 288, "Task3A Factory must expose the ninth cap word");
        (
            bytes32 manifest,
            bytes32 deployment,
            uint8 phase,
            uint8 next,
            address committedSafe,
            bytes32 config,
            address committedRegistry,
            bytes32 registryHash,
            uint256 cap
        ) = abi.decode(state, (bytes32, bytes32, uint8, uint8, address, bytes32, address, bytes32, uint256));
        assertEq(manifest, b.manifest);
        assertEq(config, b.configurationRoot);
        assertEq(deployment, keccak256(abi.encode(DEPLOYMENT_TAG, manifest, b.initcodeHashes, b.runtimeHashes)));
        assertEq(phase, 0);
        assertEq(next, 0);
        assertEq(committedSafe, address(safe));
        assertEq(committedRegistry, address(registry));
        assertEq(registryHash, address(registry).codehash);
        assertEq(cap, GLOBAL_CAP);

        ITask3AFactory factory = ITask3AFactory(deployed);
        for (uint8 i; i < 5; ++i) {
            (address child, bytes32 initcodeHash, bytes32 runtimeHash) = factory.childCommitment(i);
            assertEq(child, b.children[i]);
            assertEq(initcodeHash, b.initcodeHashes[i]);
            assertEq(runtimeHash, b.runtimeHashes[i]);
            assertEq(factory.deployNext(b.initcodes[i]), b.children[i]);
        }
        factory.finalizeConstellation();
    }

    function test_task3A_02_factoryConstructorPrecedenceIncludesCapAfterRegistryAttestation() public {
        bytes32[5] memory hashes = _nonzeroHashes();
        registry.setChainId(CHAIN_ID + 1);
        vm.expectRevert(abi.encodeWithSelector(ITask3AFactory.RegistryChainMismatch.selector, CHAIN_ID + 1));
        _rawCreate(_futureFactoryInitcode(0, hashes, hashes));

        registry.setChainId(CHAIN_ID);
        vm.expectRevert(ITask3AFactory.FactoryInvalidGlobalLifetimeCap.selector);
        _rawCreate(_futureFactoryInitcode(0, hashes, hashes));
    }

    function test_task3A_03_coreConstructorExactPrecedenceAndZeroBusinessState() public {
        Task3ARawCreateDispatcher zeroFactory = new Task3ARawCreateDispatcher();
        vm.expectRevert(ITask3ACore.CoreFactoryZero.selector);
        zeroFactory.deploy(
            _futureCoreInitcode(
                address(0), keccak256("nonzero"), address(0), address(0), address(0), address(0), address(0), 0
            )
        );

        Task3ARawCreateDispatcher zeroManifest = new Task3ARawCreateDispatcher();
        vm.expectRevert(ITask3ACore.CoreManifestHashZero.selector);
        zeroManifest.deploy(
            _futureCoreInitcode(
                address(zeroManifest), bytes32(0), address(0), address(0), address(0), address(0), address(0), 0
            )
        );

        for (uint8 zeroField; zeroField < 5; ++zeroField) {
            (Task3ARawCreateDispatcher deployer, bytes32 manifest, address[5] memory peers) =
                _coreConstructorContext(true);
            address authority = zeroField == 0 ? address(0) : peers[0];
            address registry_ = zeroField == 1 ? address(0) : address(registry);
            address budget = zeroField == 2 ? address(0) : peers[2];
            address intent = zeroField == 3 ? address(0) : peers[3];
            address reconciliation = zeroField == 4 ? address(0) : peers[4];
            vm.expectRevert(ITask3ACore.CoreZeroAddress.selector);
            deployer.deploy(
                _futureCoreInitcode(
                    address(deployer), manifest, authority, registry_, budget, intent, reconciliation, GLOBAL_CAP
                )
            );
        }

        (Task3ARawCreateDispatcher missingRegistry, bytes32 missingRegistryManifest, address[5] memory missingPeers) =
            _coreConstructorContext(true);
        address noCodeRegistry = address(0xBEEF);
        vm.expectRevert(abi.encodeWithSelector(ITask3ACore.CoreContractRequired.selector, noCodeRegistry));
        missingRegistry.deploy(
            _futureCoreInitcode(
                address(missingRegistry),
                missingRegistryManifest,
                missingPeers[0],
                noCodeRegistry,
                missingPeers[2],
                missingPeers[3],
                missingPeers[4],
                GLOBAL_CAP
            )
        );

        Task3ARawCreateDispatcher wrongAddress = new Task3ARawCreateDispatcher();
        bytes32 wrongAddressManifest = keccak256(abi.encode("wrong-core-address", address(wrongAddress)));
        address[5] memory wrongAddressPeers = _predictedChildren(address(wrongAddress));
        vm.expectRevert(
            abi.encodeWithSelector(ITask3ACore.CoreAddressMismatch.selector, wrongAddressPeers[1], wrongAddressPeers[0])
        );
        wrongAddress.deploy(
            _futureCoreInitcode(
                address(wrongAddress),
                wrongAddressManifest,
                wrongAddressPeers[0],
                address(registry),
                wrongAddressPeers[2],
                wrongAddressPeers[3],
                wrongAddressPeers[4],
                GLOBAL_CAP
            )
        );

        uint8[4] memory peerIndexes = [uint8(0), 2, 3, 4];
        for (uint8 i; i < peerIndexes.length; ++i) {
            (Task3ARawCreateDispatcher deployer, bytes32 manifest, address[5] memory peers) =
                _coreConstructorContext(true);
            uint8 peerIndex = peerIndexes[i];
            address wrongPeer = address(safe);
            address authority = peerIndex == 0 ? wrongPeer : peers[0];
            address budget = peerIndex == 2 ? wrongPeer : peers[2];
            address intent = peerIndex == 3 ? wrongPeer : peers[3];
            address reconciliation = peerIndex == 4 ? wrongPeer : peers[4];
            vm.expectRevert(
                abi.encodeWithSelector(ITask3ACore.CorePeerMismatch.selector, peerIndex, peers[peerIndex], wrongPeer)
            );
            deployer.deploy(
                _futureCoreInitcode(
                    address(deployer),
                    manifest,
                    authority,
                    address(registry),
                    budget,
                    intent,
                    reconciliation,
                    GLOBAL_CAP
                )
            );
        }

        (
            Task3ARawCreateDispatcher missingAuthority,
            bytes32 missingAuthorityManifest,
            address[5] memory missingAuthPeers
        ) = _coreConstructorContext(false);
        vm.expectRevert(abi.encodeWithSelector(ITask3ACore.CoreContractRequired.selector, missingAuthPeers[0]));
        missingAuthority.deploy(
            _futureCoreInitcode(
                address(missingAuthority),
                missingAuthorityManifest,
                missingAuthPeers[0],
                address(registry),
                missingAuthPeers[2],
                missingAuthPeers[3],
                missingAuthPeers[4],
                0
            )
        );

        (Task3ARawCreateDispatcher zeroCap, bytes32 zeroCapManifest, address[5] memory zeroCapPeers) =
            _coreConstructorContext(true);
        vm.expectRevert(ITask3ACore.InvalidGlobalLifetimeCap.selector);
        zeroCap.deploy(
            _futureCoreInitcode(
                address(zeroCap),
                zeroCapManifest,
                zeroCapPeers[0],
                address(registry),
                zeroCapPeers[2],
                zeroCapPeers[3],
                zeroCapPeers[4],
                0
            )
        );

        (Task3ARawCreateDispatcher validDeployer, bytes32 validManifest, address[5] memory validPeers) =
            _coreConstructorContext(true);
        address deployed = validDeployer.deploy(
            _futureCoreInitcode(
                address(validDeployer),
                validManifest,
                validPeers[0],
                address(registry),
                validPeers[2],
                validPeers[3],
                validPeers[4],
                GLOBAL_CAP
            )
        );
        assertEq(deployed, validPeers[1]);
        (bool ok, bytes memory snapshot) = deployed.staticcall(abi.encodeWithSignature("coreSnapshot()"));
        assertTrue(ok);
        assertEq(snapshot.length, 576);
        for (uint8 field = 10; field < 18; ++field) {
            assertEq(_word(snapshot, field), 0);
        }
    }

    function test_task3A_04_coreSnapshotExact576AndIgnoresPhysicalBalance() public {
        Task3APrefundERC20 knownStockToken = new Task3APrefundERC20();
        Task3APrefundERC20 unknownStockToken = new Task3APrefundERC20();
        address predictedFactory = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        ProductionBundle memory b = _productionBundle(predictedFactory, GLOBAL_CAP);
        address core = b.children[1];
        uint256 knownStockAmount = 19 ether;
        uint256 unknownStockAmount = 37 ether;

        knownStockToken.mint(address(this), knownStockAmount);
        unknownStockToken.mint(address(this), unknownStockAmount);
        assertTrue(knownStockToken.transfer(core, knownStockAmount));
        assertTrue(unknownStockToken.transfer(core, unknownStockAmount));
        assertEq(core.code.length, 0, "ERC-20 prefunding must work at the predicted Core address");

        address deployed = _rawCreate(_futureFactoryInitcode(GLOBAL_CAP, b.initcodeHashes, b.runtimeHashes));
        assertEq(deployed, predictedFactory);
        ITask3AFactory factory = ITask3AFactory(deployed);
        new Task3AForceEther{value: 1 ether}(payable(core));
        assertEq(core.code.length, 0, "forced ETH must pre-fund the predicted Core address");
        assertEq(core.balance, 1 ether, "cap-below-prefunding forced balance mismatch");
        for (uint8 i; i < 5; ++i) {
            assertEq(factory.deployNext(b.initcodes[i]), b.children[i]);
        }
        assertEq(core.balance, 1 ether, "Core CREATE changed cap-below-prefunding balance");

        (bool ok, bytes memory snapshotBefore) = core.staticcall(abi.encodeWithSignature("coreSnapshot()"));
        assertTrue(ok, "Task3A coreSnapshot surface is absent");
        assertEq(snapshotBefore.length, 576);
        assertEq(_word(snapshotBefore, 0), 3);
        assertEq(address(uint160(_word(snapshotBefore, 1))), address(factory));
        assertEq(bytes32(_word(snapshotBefore, 2)), b.manifest);
        assertEq(address(uint160(_word(snapshotBefore, 3))), b.children[0]);
        assertEq(address(uint160(_word(snapshotBefore, 4))), address(registry));
        assertEq(address(uint160(_word(snapshotBefore, 5))), b.children[2]);
        assertEq(address(uint160(_word(snapshotBefore, 6))), b.children[3]);
        assertEq(address(uint160(_word(snapshotBefore, 7))), b.children[4]);
        assertEq(_word(snapshotBefore, 8), 0);
        assertEq(_word(snapshotBefore, 9), GLOBAL_CAP);
        for (uint8 field = 10; field < 18; ++field) {
            assertEq(_word(snapshotBefore, field), 0);
        }
        (bool capOk, bytes memory capResult) = core.staticcall(abi.encodeWithSelector(CORE_CAP_SELECTOR));
        assertTrue(capOk, "Task3A production Core cap getter is absent");
        assertEq(capResult.length, 32, "Task3A production Core cap getter must return exactly one word");
        assertEq(abi.decode(capResult, (uint256)), _word(snapshotBefore, 9), "Core getter/snapshot cap mismatch");
        assertEq(core.balance, 1 ether);
        assertEq(knownStockToken.balanceOf(core), knownStockAmount);
        assertEq(unknownStockToken.balanceOf(core), unknownStockAmount);

        vm.record();
        vm.recordLogs();
        factory.finalizeConstellation();
        (bytes32[] memory knownReads, bytes32[] memory knownWrites) = vm.accesses(address(knownStockToken));
        (bytes32[] memory unknownReads, bytes32[] memory unknownWrites) = vm.accesses(address(unknownStockToken));
        assertEq(knownReads.length, 0, "finalization read the known Stock Token");
        assertEq(knownWrites.length, 0, "finalization wrote the known Stock Token");
        assertEq(unknownReads.length, 0, "finalization read the unknown Stock Token");
        assertEq(unknownWrites.length, 0, "finalization wrote the unknown Stock Token");

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 6, "ERC-20 prefunding changed finalization log count");
        address[6] memory expectedEmitters =
            [b.children[2], b.children[4], b.children[3], b.children[1], b.children[0], address(factory)];
        for (uint8 i; i < logs.length; ++i) {
            assertEq(logs[i].emitter, expectedEmitters[i], "ERC-20 prefunding changed finalization log order");
        }

        (bool afterOk, bytes memory snapshotAfter) = core.staticcall(abi.encodeWithSignature("coreSnapshot()"));
        assertTrue(afterOk);
        assertEq(snapshotAfter.length, 576);
        for (uint8 field; field < 18; ++field) {
            uint256 expected = field == 8 ? 1 : _word(snapshotBefore, field);
            assertEq(_word(snapshotAfter, field), expected, "ERC-20 prefunding changed Core accounting");
        }
        assertEq(core.balance, 1 ether);
        assertEq(knownStockToken.balanceOf(core), knownStockAmount);
        assertEq(unknownStockToken.balanceOf(core), unknownStockAmount);

        uint256 equalityCap = 1 ether;
        address equalityFactoryAddress = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        ProductionBundle memory equalityBundle = _productionBundle(equalityFactoryAddress, equalityCap);
        address equalityDeployed = _rawCreate(
            _futureFactoryInitcode(equalityCap, equalityBundle.initcodeHashes, equalityBundle.runtimeHashes)
        );
        assertEq(equalityDeployed, equalityFactoryAddress);
        ITask3AFactory equalityFactory = ITask3AFactory(equalityDeployed);
        address equalityCore = equalityBundle.children[1];
        new Task3AForceEther{value: equalityCap}(payable(equalityCore));
        assertEq(equalityCore.code.length, 0, "equal-cap ETH must pre-fund the predicted Core address");
        assertEq(equalityCore.balance, equalityCap, "forced balance must equal the committed cap");
        for (uint8 i; i < 5; ++i) {
            assertEq(equalityFactory.deployNext(equalityBundle.initcodes[i]), equalityBundle.children[i]);
        }
        assertEq(equalityCore.balance, equalityCap, "Core CREATE changed the equal-cap prefunding");
        equalityFactory.finalizeConstellation();
        assertEq(equalityCore.balance, equalityCap, "equal-cap finalization changed the physical balance");
    }

    function test_task3A_05_factoryCoreSnapshotCallLengthOogBombAtomic() public {
        SnapshotFixture memory f = _snapshotFixture();
        uint256[6] memory lengths = [uint256(0), 0, 575, 577, 4096, 0];
        for (uint8 mode = 1; mode <= 6; ++mode) {
            f.core.setMode(mode);
            vm.recordLogs();
            if (mode == 1 || mode == 2 || mode == 6) {
                vm.expectRevert(ITask3AFactory.FactoryCoreSnapshotCallFailed.selector);
            } else {
                vm.expectRevert(
                    abi.encodeWithSelector(ITask3AFactory.FactoryCoreSnapshotReturnLength.selector, lengths[mode - 1])
                );
            }
            f.factory.finalizeConstellation();
            assertEq(vm.getRecordedLogs().length, 0);
            _assertSnapshotFixtureReady(f);
        }
    }

    function test_task3A_06_coreSnapshotEveryOrdinalAdjacentDirtyEncoding() public {
        SnapshotFixture memory f = _snapshotFixture();
        uint256[18] memory valid;
        for (uint8 field; field < 18; ++field) {
            valid[field] = f.core.word(field);
            f.core.setWord(field, valid[field] ^ 1);
        }
        for (uint8 expected; expected < 18; ++expected) {
            vm.expectRevert(
                abi.encodeWithSelector(ITask3AFactory.FactoryCoreSnapshotSemanticMismatch.selector, expected)
            );
            f.factory.finalizeConstellation();
            _assertSnapshotFixtureReady(f);
            f.core.setWord(expected, valid[expected]);
        }

        uint8[6] memory addressFields = [uint8(1), 3, 4, 5, 6, 7];
        for (uint8 i; i < addressFields.length; ++i) {
            uint8 field = addressFields[i];
            f.core.setWord(field, valid[field] | (uint256(1) << 160));
            vm.expectRevert(abi.encodeWithSelector(ITask3AFactory.FactoryCoreSnapshotSemanticMismatch.selector, field));
            f.factory.finalizeConstellation();
            f.core.setWord(field, valid[field]);
        }
        f.core.setWord(8, 2);
        vm.expectRevert(abi.encodeWithSelector(ITask3AFactory.FactoryCoreSnapshotSemanticMismatch.selector, uint8(8)));
        f.factory.finalizeConstellation();
    }

    function test_task3A_07_authoritySnapshotFailurePrecedesCoreSnapshotAndRetry() public {
        SnapshotFixture memory f = _snapshotFixture();
        uint256 authoritySchema = f.authority.word(0);
        f.authority.setWord(0, authoritySchema ^ 1);
        f.core.setMode(1);
        vm.expectRevert(
            abi.encodeWithSelector(ITask3AFactory.FactoryAuthoritySnapshotSemanticMismatch.selector, uint8(0))
        );
        f.factory.finalizeConstellation();
        _assertSnapshotFixtureReady(f);

        f.authority.setWord(0, authoritySchema);
        vm.expectRevert(ITask3AFactory.FactoryCoreSnapshotCallFailed.selector);
        f.factory.finalizeConstellation();
        _assertSnapshotFixtureReady(f);

        f.core.setMode(0);
        vm.expectCall(address(f.core), 0, uint64(100_000), abi.encodeWithSelector(CORE_SNAPSHOT_SELECTOR));
        f.factory.finalizeConstellation();
    }

    function test_task3A_08_coreFinalizerCallerManifestAlreadyInitialFields() public {
        (Task3ARawCreateDispatcher deployer, address core, bytes32 manifest,) = _productionCoreFixture(GLOBAL_CAP);
        vm.expectRevert(abi.encodeWithSelector(ITask3ACore.CoreFinalizerUnauthorized.selector, address(this)));
        ITask3ACore(core).finalizeCore(manifest);

        bytes32 wrong = keccak256("wrong-manifest");
        vm.prank(address(deployer));
        vm.expectRevert(abi.encodeWithSelector(ITask3ACore.CoreManifestHashMismatch.selector, manifest, wrong));
        ITask3ACore(core).finalizeCore(wrong);

        for (uint8 ordinal = 10; ordinal < 18; ++ordinal) {
            vm.store(core, bytes32(uint256(ordinal - 9)), bytes32(uint256(1)));
            vm.prank(address(deployer));
            vm.expectRevert(abi.encodeWithSelector(ITask3ACore.CoreInitialStateMismatch.selector, ordinal));
            ITask3ACore(core).finalizeCore(manifest);
            vm.store(core, bytes32(uint256(ordinal - 9)), bytes32(0));
        }

        vm.prank(address(deployer));
        ITask3ACore(core).finalizeCore(manifest);
        vm.prank(address(deployer));
        vm.expectRevert(ITask3ACore.CoreAlreadyFinalized.selector);
        ITask3ACore(core).finalizeCore(manifest);
    }

    function test_task3A_09_proposalCapMinusOneExactPlusOne() public {
        uint256[3] memory lifetimes = [GLOBAL_CAP - 1, GLOBAL_CAP, GLOBAL_CAP + 1];
        for (uint8 i; i < 3; ++i) {
            AuthorityFixture memory f = _authorityFixture(GLOBAL_CAP);
            Task3AIngress ingress = new Task3AIngress();
            IAcquisitionAuthorityV2.IngressConfig memory config = _config(address(ingress), lifetimes[i]);
            vm.expectCall(f.coreAddress, 0, uint64(50_000), abi.encodeWithSelector(CORE_CAP_SELECTOR));
            vm.prank(address(safe));
            if (i == 2) {
                vm.expectRevert(ITask3AAuthority.InvalidIngressConfig.selector);
                f.authority.proposeIngress(config, keccak256("proposal-plus-one"));
            } else {
                bytes32 proposal = f.authority.proposeIngress(config, keccak256(abi.encode("proposal", i)));
                vm.prank(address(safe));
                f.authority.cancelIngressProposal(proposal, keccak256("cancel"));
            }
        }
    }

    function test_task3A_10_activationCapMinusOneExactPlusOne() public {
        uint256[3] memory lifetimes = [GLOBAL_CAP - 1, GLOBAL_CAP, GLOBAL_CAP + 1];
        for (uint8 i; i < 3; ++i) {
            uint256 proposalCap = i == 2 ? GLOBAL_CAP + 1 : GLOBAL_CAP;
            AuthorityFixture memory f = _authorityFixture(proposalCap);
            Task3AIngress ingress = new Task3AIngress();
            vm.prank(address(safe));
            bytes32 proposal = f.authority
            .proposeIngress(_config(address(ingress), lifetimes[i]), keccak256(abi.encode("activate", i)));
            IAcquisitionAuthorityV2.PendingIngressProposal memory pending = f.authority.pendingIngressProposal();
            vm.warp(pending.validAfter);
            f.core.setCap(GLOBAL_CAP);
            vm.expectCall(f.coreAddress, 0, uint64(50_000), abi.encodeWithSelector(CORE_CAP_SELECTOR));
            vm.prank(address(safe));
            if (i == 2) {
                vm.expectRevert(ITask3AAuthority.InvalidIngressConfig.selector);
                f.authority.activateIngress(proposal);
            } else {
                assertEq(f.authority.activateIngress(proposal), 1);
            }
        }
    }

    function test_task3A_11_proposalCapReadFailureLengthZeroOogAtomic() public {
        uint8[7] memory modes = [uint8(1), 2, 7, 3, 4, 5, 6];
        uint256[7] memory lengths = [uint256(0), 0, 0, 31, 33, 4096, 0];
        for (uint8 i; i < modes.length; ++i) {
            AuthorityFixture memory f = _authorityFixture(GLOBAL_CAP);
            Task3AIngress ingress = new Task3AIngress();
            f.core.setMode(modes[i]);
            vm.recordLogs();
            vm.prank(address(safe));
            if (i < 3) {
                vm.expectRevert(ITask3AAuthority.AuthorityCoreCapCallFailed.selector);
            } else if (i < 6) {
                vm.expectRevert(
                    abi.encodeWithSelector(ITask3AAuthority.AuthorityCoreCapReturnLength.selector, lengths[i])
                );
            } else {
                vm.expectRevert(
                    abi.encodeWithSelector(ITask3AAuthority.AuthorityCoreCapSemanticMismatch.selector, uint256(0))
                );
            }
            f.authority.proposeIngress(_config(address(ingress), GLOBAL_CAP), keccak256(abi.encode("failure", i)));
            assertEq(vm.getRecordedLogs().length, 0);
            assertEq(f.authority.ingressProposalNonce(), 0);
            assertEq(f.authority.pendingIngressProposal().proposalId, bytes32(0));
        }
    }

    function test_task3A_12_activationCapReadFailurePreservesProposal() public {
        AuthorityFixture memory f = _authorityFixture(GLOBAL_CAP);
        Task3AIngress ingress = new Task3AIngress();
        vm.prank(address(safe));
        bytes32 proposal =
            f.authority.proposeIngress(_config(address(ingress), GLOBAL_CAP), keccak256("activation-failure"));
        IAcquisitionAuthorityV2.PendingIngressProposal memory pending = f.authority.pendingIngressProposal();
        bytes32 pendingHash = keccak256(abi.encode(pending));
        vm.warp(pending.validAfter);

        uint8[7] memory modes = [uint8(1), 2, 7, 3, 4, 5, 6];
        uint256[7] memory lengths = [uint256(0), 0, 0, 31, 33, 4096, 0];
        for (uint8 i; i < modes.length; ++i) {
            f.core.setMode(modes[i]);
            vm.prank(address(safe));
            if (i < 3) {
                vm.expectRevert(ITask3AAuthority.AuthorityCoreCapCallFailed.selector);
            } else if (i < 6) {
                vm.expectRevert(
                    abi.encodeWithSelector(ITask3AAuthority.AuthorityCoreCapReturnLength.selector, lengths[i])
                );
            } else {
                vm.expectRevert(
                    abi.encodeWithSelector(ITask3AAuthority.AuthorityCoreCapSemanticMismatch.selector, uint256(0))
                );
            }
            f.authority.activateIngress(proposal);
            assertEq(keccak256(abi.encode(f.authority.pendingIngressProposal())), pendingHash);
            assertEq(f.authority.ingressGeneration(), 0);
            assertEq(f.authority.activeIngressGeneration(), 0);
        }

        f.core.setMode(0);
        f.core.setCap(GLOBAL_CAP - 1);
        vm.prank(address(safe));
        vm.expectRevert(ITask3AAuthority.InvalidIngressConfig.selector);
        f.authority.activateIngress(proposal);
        assertEq(keccak256(abi.encode(f.authority.pendingIngressProposal())), pendingHash);
    }

    function test_task3A_13_proposalLocalValidationPrecedesCoreAndCapPrecedesIngressChecks() public {
        AuthorityFixture memory f = _authorityFixture(GLOBAL_CAP);
        Task3AIngress ingress = new Task3AIngress();
        IAcquisitionAuthorityV2.IngressConfig memory invalid = _config(address(ingress), GLOBAL_CAP);
        invalid.perDepositCapWei = 0;
        f.core.setMode(2);
        vm.prank(address(safe));
        vm.expectRevert(ITask3AAuthority.InvalidIngressConfig.selector);
        f.authority.proposeIngress(invalid, keccak256("local-first"));

        f.core.setMode(0);
        IAcquisitionAuthorityV2.IngressConfig memory absent = IAcquisitionAuthorityV2.IngressConfig({
            ingress: address(0xBEEF),
            runtimeCodeHash: bytes32(uint256(1)),
            perDepositCapWei: 1,
            epochDepositCapWei: 1,
            lifetimeDepositCapWei: GLOBAL_CAP + 1
        });
        vm.expectCall(f.coreAddress, 0, uint64(50_000), abi.encodeWithSelector(CORE_CAP_SELECTOR));
        vm.prank(address(safe));
        vm.expectRevert(ITask3AAuthority.InvalidIngressConfig.selector);
        f.authority.proposeIngress(absent, bytes32(0));
    }

    function test_task3A_14_activationEarlyPrecedenceDoesNotReachCore() public {
        AuthorityFixture memory empty = _authorityFixture(GLOBAL_CAP);
        empty.core.setMode(2);
        vm.record();
        vm.prank(address(safe));
        vm.expectRevert(ITask3AAuthority.IngressProposalMissing.selector);
        empty.authority.activateIngress(keccak256("missing"));
        _assertNoCoreStorageAccess(empty.coreAddress, "missing proposal");

        AuthorityFixture memory f = _authorityFixture(GLOBAL_CAP);
        Task3AIngress ingress = new Task3AIngress();
        vm.prank(address(safe));
        bytes32 proposal = f.authority.proposeIngress(_config(address(ingress), GLOBAL_CAP), keccak256("early"));
        IAcquisitionAuthorityV2.PendingIngressProposal memory pending = f.authority.pendingIngressProposal();
        f.core.setMode(2);
        bytes32 wrong = keccak256("wrong");
        vm.record();
        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(ITask3AAuthority.ProposalIdMismatch.selector, proposal, wrong));
        f.authority.activateIngress(wrong);
        _assertNoCoreStorageAccess(f.coreAddress, "wrong proposal id");
        vm.record();
        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(ITask3AAuthority.ProposalNotReady.selector, pending.validAfter));
        f.authority.activateIngress(proposal);
        _assertNoCoreStorageAccess(f.coreAddress, "proposal not ready");
        vm.warp(pending.expiresAt);
        vm.record();
        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(ITask3AAuthority.ProposalExpired.selector, pending.expiresAt));
        f.authority.activateIngress(proposal);
        _assertNoCoreStorageAccess(f.coreAddress, "proposal expired");

        AuthorityFixture memory active = _authorityFixture(GLOBAL_CAP);
        Task3AIngress first = new Task3AIngress();
        vm.prank(address(safe));
        bytes32 firstProposal = active.authority.proposeIngress(_config(address(first), GLOBAL_CAP), keccak256("first"));
        IAcquisitionAuthorityV2.PendingIngressProposal memory firstPending = active.authority.pendingIngressProposal();
        vm.warp(firstPending.validAfter);
        vm.prank(address(safe));
        active.authority.activateIngress(firstProposal);
        Task3AIngress second = new Task3AIngress();
        vm.prank(address(safe));
        bytes32 secondProposal =
            active.authority.proposeIngress(_config(address(second), GLOBAL_CAP), keccak256("second"));
        IAcquisitionAuthorityV2.PendingIngressProposal memory secondPending = active.authority.pendingIngressProposal();
        vm.warp(secondPending.validAfter);
        active.core.setMode(2);
        vm.record();
        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(ITask3AAuthority.IngressActive.selector, address(first)));
        active.authority.activateIngress(secondProposal);
        _assertNoCoreStorageAccess(active.coreAddress, "active ingress overlap");
    }

    function test_task3A_15_cancelExpireDisableLiveThroughCoreFailure() public {
        AuthorityFixture memory f = _authorityFixture(GLOBAL_CAP);
        Task3AIngress first = new Task3AIngress();
        vm.prank(address(safe));
        bytes32 cancelled = f.authority.proposeIngress(_config(address(first), GLOBAL_CAP), keccak256("cancelled"));
        f.core.setMode(2);
        vm.record();
        vm.prank(address(safe));
        f.authority.cancelIngressProposal(cancelled, keccak256("cancel"));
        _assertNoCoreStorageAccess(f.coreAddress, "cancel ingress proposal");

        f.core.setMode(0);
        Task3AIngress second = new Task3AIngress();
        vm.prank(address(safe));
        bytes32 expired = f.authority.proposeIngress(_config(address(second), GLOBAL_CAP), keccak256("expired"));
        IAcquisitionAuthorityV2.PendingIngressProposal memory expiring = f.authority.pendingIngressProposal();
        f.core.setMode(2);
        vm.warp(expiring.expiresAt);
        vm.record();
        f.authority.expireIngressProposal(expired);
        _assertNoCoreStorageAccess(f.coreAddress, "expire ingress proposal");

        f.core.setMode(0);
        Task3AIngress third = new Task3AIngress();
        vm.prank(address(safe));
        bytes32 activated = f.authority.proposeIngress(_config(address(third), GLOBAL_CAP), keccak256("active"));
        IAcquisitionAuthorityV2.PendingIngressProposal memory pending = f.authority.pendingIngressProposal();
        vm.warp(pending.validAfter);
        vm.prank(address(safe));
        f.authority.activateIngress(activated);
        f.core.setMode(2);
        vm.record();
        vm.prank(address(safe));
        f.authority.disableIngress(keccak256("disable"));
        _assertNoCoreStorageAccess(f.coreAddress, "disable ingress");
        assertEq(f.authority.activeIngressGeneration(), 0);
    }

    function test_task3A_16_authorityHasNoCapGetterAndUnpauseOrdinal11() public {
        AuthorityFixture memory f = _authorityFixture(GLOBAL_CAP);
        (bool hasCapGetter, bytes memory data) =
            address(f.authority).staticcall(abi.encodeWithSelector(CORE_CAP_SELECTOR));
        assertFalse(hasCapGetter);
        assertEq(data.length, 0);

        f.core.setMode(2);
        vm.record();
        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(ITask3AAuthority.LocalReadinessFailed.selector, uint8(11)));
        f.authority.unpause(keccak256("still-dormant"));
        _assertNoCoreStorageAccess(f.coreAddress, "unpause readiness");
    }

    function _productionBundle(address predictedFactory, uint256 cap) internal returns (ProductionBundle memory b) {
        b.predictedFactory = predictedFactory;
        b.children = _predictedChildren(predictedFactory);
        b.configurationRoot = _task3ConfigurationRoot(cap);
        b.manifest = _manifest(predictedFactory, b.configurationRoot, b.children);
        b.initcodes = _productionInitcodes(predictedFactory, b.manifest, b.children, cap);
        for (uint8 i; i < 5; ++i) {
            b.initcodeHashes[i] = keccak256(b.initcodes[i]);
        }

        uint256 clean = vm.snapshotState();
        vm.etch(predictedFactory, type(Task3ARawCreateDispatcher).runtimeCode);
        vm.setNonce(predictedFactory, 1);
        for (uint8 i; i < 5; ++i) {
            address child = Task3ARawCreateDispatcher(predictedFactory).deploy(b.initcodes[i]);
            assertEq(child, b.children[i], "shadow CREATE order");
            b.runtimeHashes[i] = child.codehash;
        }
        assertTrue(vm.revertToState(clean));
    }

    function _productionInitcodes(address factory, bytes32 manifest, address[5] memory children, uint256 cap)
        internal
        view
        returns (bytes[5] memory initcodes)
    {
        initcodes[0] = abi.encodePacked(
            type(AcquisitionAuthority).creationCode,
            abi.encode(
                factory, manifest, address(safe), address(registry), children[1], children[2], children[3], children[4]
            )
        );
        initcodes[1] = _futureCoreInitcode(
            factory, manifest, children[0], address(registry), children[2], children[3], children[4], cap
        );
        initcodes[2] = abi.encodePacked(type(PreVoteBudgetBook).creationCode, abi.encode(factory, manifest));
        initcodes[3] = abi.encodePacked(type(AcquisitionIntentExecution).creationCode, abi.encode(factory, manifest));
        initcodes[4] = abi.encodePacked(type(AcquisitionReconciliation).creationCode, abi.encode(factory, manifest));
    }

    function _snapshotFixture() internal returns (SnapshotFixture memory f) {
        uint256 clean = vm.snapshotState();
        address predictedFactory = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        (
            bytes32 task3Manifest,
            bytes[5] memory task3Initcodes,
            bytes32[5] memory task3InitHashes,
            bytes32[5] memory rh
        ) = _snapshotChildBundle(predictedFactory, _task3ConfigurationRoot(GLOBAL_CAP), GLOBAL_CAP);
        address first = _rawCreate(_futureFactoryInitcode(GLOBAL_CAP, task3InitHashes, rh));
        (bool ok, bytes memory futureState) = first.staticcall(abi.encodeWithSignature("factoryState()"));
        assertTrue(ok);

        bytes32 manifest = task3Manifest;
        bytes[5] memory initcodes = task3Initcodes;
        address factoryAddress = first;
        if (futureState.length == 256) {
            assertTrue(vm.revertToState(clean));
            predictedFactory = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
            bytes32 task2Config =
                keccak256(abi.encode(TASK2_CONFIG_TAG, uint256(2), address(registry), address(registry).codehash));
            (manifest, initcodes, task3InitHashes, rh) = _snapshotChildBundle(predictedFactory, task2Config, GLOBAL_CAP);
            factoryAddress = _rawCreate(_legacyFactoryInitcode(task3InitHashes, rh));
        } else {
            assertEq(futureState.length, 288);
        }

        f.factory = ITask3AFactory(factoryAddress);
        f.children = _predictedChildren(factoryAddress);
        for (uint8 i; i < 5; ++i) {
            assertEq(f.factory.deployNext(initcodes[i]), f.children[i]);
        }
        f.authority = Task3AMaliciousAuthoritySnapshot(f.children[0]);
        f.core = Task3AMaliciousCoreSnapshot(f.children[1]);
        assertTrue(manifest != bytes32(0));
    }

    function _snapshotChildBundle(address factory, bytes32 config, uint256 cap)
        internal
        view
        returns (
            bytes32 manifest,
            bytes[5] memory initcodes,
            bytes32[5] memory initcodeHashes,
            bytes32[5] memory runtimeHashes
        )
    {
        address[5] memory children = _predictedChildren(factory);
        manifest = _manifest(factory, config, children);
        initcodes[0] = abi.encodePacked(
            type(Task3AMaliciousAuthoritySnapshot).creationCode,
            abi.encode(
                factory, manifest, address(safe), address(registry), children[1], children[2], children[3], children[4]
            )
        );
        initcodes[1] = abi.encodePacked(
            type(Task3AMaliciousCoreSnapshot).creationCode,
            abi.encode(factory, manifest, children[0], address(registry), children[2], children[3], children[4], cap)
        );
        for (uint8 i = 2; i < 5; ++i) {
            initcodes[i] = abi.encodePacked(type(Task3AShell).creationCode, abi.encode(factory, manifest));
        }
        runtimeHashes[0] = keccak256(type(Task3AMaliciousAuthoritySnapshot).runtimeCode);
        runtimeHashes[1] = keccak256(type(Task3AMaliciousCoreSnapshot).runtimeCode);
        for (uint8 i = 2; i < 5; ++i) {
            runtimeHashes[i] = keccak256(type(Task3AShell).runtimeCode);
        }
        for (uint8 i; i < 5; ++i) {
            initcodeHashes[i] = keccak256(initcodes[i]);
        }
    }

    function _authorityFixture(uint256 cap) internal returns (AuthorityFixture memory f) {
        f.factory = new Task3ARawCreateDispatcher();
        address authorityAddress = vm.computeCreateAddress(address(f.factory), 1);
        f.coreAddress = vm.computeCreateAddress(address(f.factory), 2);
        address budget = vm.computeCreateAddress(address(f.factory), 3);
        address intent = vm.computeCreateAddress(address(f.factory), 4);
        address reconciliation = vm.computeCreateAddress(address(f.factory), 5);
        f.manifest = keccak256(abi.encode("task3a-authority", address(f.factory)));
        vm.etch(f.coreAddress, type(Task3ACapMock).runtimeCode);
        f.core = Task3ACapMock(f.coreAddress);
        f.core.setCap(cap);
        address deployed = f.factory
            .deploy(
                abi.encodePacked(
                    type(AcquisitionAuthority).creationCode,
                    abi.encode(
                        address(f.factory),
                        f.manifest,
                        address(safe),
                        address(registry),
                        f.coreAddress,
                        budget,
                        intent,
                        reconciliation
                    )
                )
            );
        assertEq(deployed, authorityAddress);
        f.authority = ITask3AAuthority(deployed);
        vm.prank(address(f.factory));
        f.authority.finalizeAuthority(f.manifest);
    }

    function _productionCoreFixture(uint256 cap)
        internal
        returns (Task3ARawCreateDispatcher deployer, address core, bytes32 manifest, address[5] memory peers)
    {
        deployer = new Task3ARawCreateDispatcher();
        manifest = keccak256(abi.encode("task3a-core", address(deployer)));
        peers = _predictedChildren(address(deployer));
        address authority =
            deployer.deploy(abi.encodePacked(type(Task3AShell).creationCode, abi.encode(address(deployer), manifest)));
        assertEq(authority, peers[0]);
        core = deployer.deploy(
            _futureCoreInitcode(
                address(deployer), manifest, peers[0], address(registry), peers[2], peers[3], peers[4], cap
            )
        );
        assertEq(core, peers[1]);
    }

    function _coreConstructorContext(bool authorityCode)
        internal
        returns (Task3ARawCreateDispatcher deployer, bytes32 manifest, address[5] memory peers)
    {
        deployer = new Task3ARawCreateDispatcher();
        manifest = keccak256(abi.encode("task3a-core-constructor", address(deployer)));
        peers = _predictedChildren(address(deployer));
        bytes memory authorityInitcode = authorityCode
            ? abi.encodePacked(type(Task3AShell).creationCode, abi.encode(address(deployer), manifest))
            : type(Task3AVanishingPeer).creationCode;
        assertEq(deployer.deploy(authorityInitcode), peers[0]);
        if (authorityCode) assertTrue(peers[0].code.length != 0);
        else assertEq(peers[0].code.length, 0);
    }

    function _assertSnapshotFixtureReady(SnapshotFixture memory f) internal view {
        (bool ok, bytes memory state) = address(f.factory).staticcall(abi.encodeWithSignature("factoryState()"));
        assertTrue(ok);
        assertTrue(state.length == 256 || state.length == 288);
        assertEq(uint8(_word(state, 2)), 2);
        assertEq(uint8(_word(state, 3)), 5);
        for (uint8 i; i < 5; ++i) {
            bytes4 selector = i == 0
                ? bytes4(keccak256("authorityTopology()"))
                : i == 1
                    ? bytes4(keccak256("coreTopology()"))
                    : i == 2
                        ? bytes4(keccak256("budgetBookTopology()"))
                        : i == 3
                            ? bytes4(keccak256("intentExecutionTopology()"))
                            : bytes4(keccak256("reconciliationTopology()"));
            (bool topologyOk, bytes memory topology) = f.children[i].staticcall(abi.encodeWithSelector(selector));
            assertTrue(topologyOk);
            (,, bool finalized) = abi.decode(topology, (address, bytes32, bool));
            assertFalse(finalized);
        }
    }

    function _assertNoCoreStorageAccess(address core, string memory branch) internal {
        (bytes32[] memory reads, bytes32[] memory writes) = vm.accesses(core);
        assertEq(reads.length, 0, string.concat(branch, " unexpectedly read Core storage"));
        assertEq(writes.length, 0, string.concat(branch, " unexpectedly wrote Core storage"));
    }

    function _config(address ingress, uint256 lifetime)
        internal
        view
        returns (IAcquisitionAuthorityV2.IngressConfig memory)
    {
        return IAcquisitionAuthorityV2.IngressConfig({
            ingress: ingress,
            runtimeCodeHash: ingress.codehash,
            perDepositCapWei: 1,
            epochDepositCapWei: 1,
            lifetimeDepositCapWei: lifetime
        });
    }

    function _futureFactoryInitcode(uint256 cap, bytes32[5] memory initHashes, bytes32[5] memory runtimeHashes)
        internal
        view
        returns (bytes memory)
    {
        return abi.encodePacked(
            type(AcquisitionConstellationFactory).creationCode,
            abi.encode(address(safe), address(registry), address(registry).codehash, cap, initHashes, runtimeHashes)
        );
    }

    function _legacyFactoryInitcode(bytes32[5] memory initHashes, bytes32[5] memory runtimeHashes)
        internal
        view
        returns (bytes memory)
    {
        return abi.encodePacked(
            type(AcquisitionConstellationFactory).creationCode,
            abi.encode(address(safe), address(registry), address(registry).codehash, initHashes, runtimeHashes)
        );
    }

    function _futureCoreInitcode(
        address factory,
        bytes32 manifest,
        address authority,
        address registry_,
        address budget,
        address intent,
        address reconciliation,
        uint256 cap
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            type(AcquisitionVaultCore).creationCode,
            abi.encode(factory, manifest, authority, registry_, budget, intent, reconciliation, cap)
        );
    }

    function _rawCreate(bytes memory creation) internal returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create(0, add(creation, 0x20), mload(creation))
            if iszero(deployed) {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }

    function _task3ConfigurationRoot(uint256 cap) internal view returns (bytes32) {
        return keccak256(abi.encode(TASK3_CONFIG_TAG, uint256(3), address(registry), address(registry).codehash, cap));
    }

    function _manifest(address factory, bytes32 config, address[5] memory children) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                CONSTELLATION_TAG,
                uint256(CHAIN_ID),
                factory,
                address(safe),
                config,
                address(registry),
                address(registry).codehash,
                children[0],
                children[1],
                children[2],
                children[3],
                children[4]
            )
        );
    }

    function _predictedChildren(address factory) internal pure returns (address[5] memory children) {
        for (uint8 i; i < 5; ++i) {
            children[i] = vm.computeCreateAddress(factory, uint256(i) + 1);
        }
    }

    function _nonzeroHashes() internal pure returns (bytes32[5] memory hashes) {
        hashes =
            [bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)), bytes32(uint256(4)), bytes32(uint256(5))];
    }

    function _word(bytes memory data, uint256 index) internal pure returns (uint256 value) {
        require(data.length >= (index + 1) * 32);
        assembly ("memory-safe") {
            value := mload(add(add(data, 0x20), mul(index, 0x20)))
        }
    }
}
