// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AcquisitionConstellationTask1Test} from "./AcquisitionConstellationTask1.t.sol";
import {AcquisitionConstellationFactory} from "../src/AcquisitionConstellationFactory.sol";
import {AcquisitionAuthority} from "../src/AcquisitionAuthority.sol";
import {IAcquisitionAuthorityV2} from "../src/interfaces/IAcquisitionAuthorityV2.sol";
import {Vm, VmSafe} from "forge-std/Vm.sol";

contract Task2SafeCandidate {}

contract Task2Ingress {}

contract Task2SafeProxy {
    address internal immutable _implementation;

    constructor(address implementation) {
        _implementation = implementation;
    }

    fallback() external payable {
        address implementation = _implementation;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            if iszero(ok) { revert(0, returndatasize()) }
            return(0, returndatasize())
        }
    }
}

contract Task2ForceEther {
    constructor(address payable target) payable {
        selfdestruct(target);
    }
}

contract Task2ERC1271Fixture {
    bytes32 internal _digest;
    bytes32 internal _signatureHash;
    uint256 internal _signatureLength;
    uint256 internal _mode;
    address internal _callbackTarget;
    bytes internal _callbackData;
    bytes4 internal _callbackError;
    address internal _callbackSender;

    function configure(
        bytes32 digest,
        bytes calldata signature,
        uint256 mode,
        address callbackTarget,
        bytes calldata callbackData
    ) external {
        _digest = digest;
        _signatureHash = keccak256(signature);
        _signatureLength = signature.length;
        _mode = mode;
        _callbackTarget = callbackTarget;
        _callbackData = callbackData;
        _callbackError = bytes4(keccak256("ReentrancyGuardReentrantCall()"));
    }

    function setCallbackError(bytes4 callbackError) external {
        _callbackError = callbackError;
    }

    function setCallbackSender(address callbackSender) external {
        _callbackSender = callbackSender;
    }

    fallback() external {
        require(msg.sig == 0x1626ba7e);
        require(msg.data.length >= 100);
        bytes32 digest;
        uint256 offset;
        uint256 length;
        assembly {
            digest := calldataload(4)
            offset := calldataload(36)
            length := calldataload(68)
        }
        require(digest == _digest && offset == 0x40 && length == _signatureLength);
        uint256 padded = (length + 31) & ~uint256(31);
        require(msg.data.length == 100 + padded);
        bytes32 signatureHash;
        assembly ("memory-safe") {
            let signaturePtr := mload(0x40)
            calldatacopy(signaturePtr, 100, length)
            signatureHash := keccak256(signaturePtr, length)
            mstore(0x40, add(signaturePtr, padded))
        }
        require(signatureHash == _signatureHash);
        for (uint256 i = length; i < padded; ++i) {
            require(msg.data[100 + i] == 0);
        }
        if (_callbackTarget != address(0)) {
            if (_callbackSender != address(0)) {
                Vm(address(uint160(uint256(keccak256("hevm cheat code"))))).prank(_callbackSender);
            }
            (bool callbackOk, bytes memory callbackResult) = _callbackTarget.staticcall(_callbackData);
            require(!callbackOk);
            require(callbackResult.length >= 4 && bytes4(callbackResult) == _callbackError);
        }
        uint256 mode = _mode;
        if (mode == 7) revert();
        if (mode == 8) assembly { revert(0, 4096) }
        if (mode == 9) assembly { for {} 1 {} {} }
        if (mode == 3) assembly { return(0, 0) }
        if (mode == 4) assembly { return(0, 31) }
        if (mode == 5) assembly { return(0, 33) }
        if (mode == 6) assembly { return(0, 4096) }
        if (mode == 10) assembly { return(0, 1) }
        if (mode == 11) assembly { return(0, 4) }
        if (mode == 12) {
            assembly {
                mstore(0, 0x1626ba7effffffffffffffffffffffffffffffffffffffffffffffffffffffff)
                return(0, 32)
            }
        }
        if (mode == 2) {
            assembly {
                mstore(0, 0x1626ba7e)
                return(0, 32)
            }
        }
        if (mode == 1) {
            assembly {
                mstore(0, 0xffffffff00000000000000000000000000000000000000000000000000000000)
                return(0, 32)
            }
        }
        assembly {
            mstore(0, 0x1626ba7e00000000000000000000000000000000000000000000000000000000)
            return(0, 32)
        }
    }
}

contract Task2AuthorityDeployer {
    function consumeNonce() external returns (address) {
        return address(new Task2Ingress());
    }

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

contract AcquisitionAuthorityTask2Test is AcquisitionConstellationTask1Test {
    function _authority() internal returns (AcquisitionAuthority authority, AcquisitionConstellationFactory factory) {
        bytes[5] memory initcodes;
        (factory, initcodes,) = _configured();
        for (uint8 i; i < 5; ++i) {
            factory.deployNext(initcodes[i]);
        }
        factory.finalizeConstellation();
        (address child,,) = factory.childCommitment(0);
        authority = AcquisitionAuthority(child);
    }

    function test_task2AuthorityHardSizeAndExactAbiCensus() public {
        bytes memory runtime = vm.getDeployedCode("AcquisitionAuthority.sol:AcquisitionAuthority");
        bytes memory initcode = vm.getCode("AcquisitionAuthority.sol:AcquisitionAuthority");
        assertLe(runtime.length, 20_000);
        assertLe(initcode.length, 49_152);
        assertEq(runtime.length, 16_068);
        string memory artifact = vm.readFile("out/AcquisitionAuthority.sol/AcquisitionAuthority.json");
        assertEq(vm.parseJsonString(artifact, ".abi[16].name"), "authoritySnapshot");
        for (uint256 i; i < 27; ++i) {
            string memory root = string.concat(".abi[16].outputs[", vm.toString(i), "]");
            assertEq(vm.parseJsonString(artifact, string.concat(root, ".name")), "");
            assertEq(vm.parseJsonString(artifact, string.concat(root, ".type")), _snapshotType(i));
        }
    }

    function test_task2SnapshotIsFixed864BytesAndColdBelowCap() public {
        (AcquisitionAuthority authority, AcquisitionConstellationFactory factory) = _authority();
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) =
            address(authority).staticcall(abi.encodeWithSelector(AcquisitionAuthority.authoritySnapshot.selector));
        uint256 used = beforeGas - gasleft();
        assertTrue(ok);
        assertEq(result.length, 864);
        assertLe(used, 160_000);
        (bytes32 manifest,,,,,,,) = factory.factoryState();
        assertEq(_word(result, 0), 2);
        assertEq(address(uint160(_word(result, 1))), address(factory));
        assertEq(bytes32(_word(result, 2)), manifest);
        assertEq(address(uint160(_word(result, 3))), address(registry));
        for (uint8 i = 1; i < 5; ++i) {
            (address child,,) = factory.childCommitment(i);
            assertEq(address(uint160(_word(result, i + 3))), child);
        }
        assertEq(_word(result, 8), 1);
        assertEq(address(uint160(_word(result, 9))), address(safe));
        assertEq(_word(result, 10), 0);
        assertEq(_word(result, 11), 1);
        for (uint256 i = 12; i <= 23; ++i) {
            assertEq(_word(result, i), 0);
        }
        assertEq(
            bytes32(_word(result, 24)),
            keccak256(
                abi.encode(bytes32(0), uint256(0), address(0), address(0), uint64(0), uint64(0), uint64(0), bytes32(0))
            )
        );
        assertEq(_word(result, 25), 0);
        assertEq(
            bytes32(_word(result, 26)),
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

    function test_task2VersionCanonicalRawDynamicString() public {
        (AcquisitionAuthority authority,) = _authority();
        bytes memory dirty = new bytes(257);
        for (uint256 i; i < dirty.length; ++i) {
            dirty[i] = 0xff;
        }
        (bool ok, bytes memory result) =
            address(authority).staticcall(abi.encodeWithSelector(authority.version.selector));
        assertTrue(ok);
        assertEq(result.length, 96);
        assertEq(_word(result, 0), 0x20);
        assertEq(_word(result, 1), 1);
        assertEq(bytes32(_word(result, 2)), bytes32("2"));
        assertEq(abi.decode(result, (string)), "2");
        assertEq(uint256(uint8(dirty[0])), 0xff);
    }

    function test_task2PrefinalMutationFailsClosed() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes,) = _configured();
        AcquisitionAuthority authority = AcquisitionAuthority(factory.deployNext(initcodes[0]));
        vm.prank(address(safe));
        vm.expectRevert(AcquisitionAuthority.AuthorityNotFinalized.selector);
        authority.nominateMainOperator(address(0xBEEF), keccak256("details"));
    }

    function test_task2OwnershipAcceptanceAndOperatorLifecycle() public {
        (AcquisitionAuthority authority,) = _authority();
        Task2SafeCandidate nextSafe = new Task2SafeCandidate();
        vm.prank(address(safe));
        authority.transferOwnership(address(nextSafe));
        vm.prank(address(nextSafe));
        authority.acceptOwnership();
        assertEq(authority.owner(), address(nextSafe));

        address nominee = address(0xBEEF);
        vm.prank(address(nextSafe));
        bytes32 proposal = authority.nominateMainOperator(nominee, keccak256("nominate"));
        vm.warp(block.timestamp + authority.OPERATOR_NOMINATION_DELAY());
        vm.prank(nominee);
        authority.acceptMainOperatorNomination(proposal);
        assertEq(authority.mainOperator(), nominee);
        assertEq(authority.operatorGeneration(), 1);
        vm.prank(nominee);
        authority.invalidateOutflowNonce(1, keccak256("invalidate"));
        assertEq(authority.outflowNonce(), 1);
    }

    function test_task2EoaSuccessorConsentAndHashEncoding() public {
        (AcquisitionAuthority authority,) = _authority();
        address operator = address(0xBEEF);
        vm.prank(address(safe));
        bytes32 proposal = authority.nominateMainOperator(operator, keccak256("nominate"));
        vm.warp(block.timestamp + authority.OPERATOR_NOMINATION_DELAY());
        vm.prank(operator);
        authority.acceptMainOperatorNomination(proposal);

        uint256 successorKey = 0xA11CE;
        address successor = vm.addr(successorKey);
        IAcquisitionAuthorityV2.SuccessorConsent memory consent = IAcquisitionAuthorityV2.SuccessorConsent({
            currentOperator: operator,
            successor: successor,
            generation: 1,
            outflowNonce: 0,
            issuedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            reasonCode: uint8(IAcquisitionAuthorityV2.ReasonCode.OPERATOR_REPLACED),
            detailsHash: keccak256("replace")
        });
        bytes32 digest = authority.hashSuccessorConsent(consent);
        (bool snapshotOk, bytes memory snapshotData) =
            address(authority).staticcall(abi.encodeWithSelector(AcquisitionAuthority.authoritySnapshot.selector));
        assertTrue(snapshotOk);
        address snapshotCore;
        assembly {
            snapshotCore := mload(add(snapshotData, 0xa0))
        }
        bytes32 structHash = keccak256(
            abi.encode(
                authority.SUCCESSOR_CONSENT_TYPEHASH(),
                address(authority),
                snapshotCore,
                address(authority),
                keccak256("OMERTA_OPERATOR_REPLACEMENT_V2"),
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
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("OMERTA AcquisitionAuthority"),
                keccak256("2"),
                uint256(4663),
                address(authority)
            )
        );
        assertEq(digest, keccak256(abi.encodePacked(hex"1901", domain, structHash)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(successorKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        vm.prank(operator);
        authority.replaceMainOperator(consent, signature);
        assertEq(authority.mainOperator(), successor);
        assertEq(authority.operatorGeneration(), 2);
    }

    function test_task2IngressLifecycleAndFailClosedUnpause() public {
        (AcquisitionAuthority authority,) = _authority();
        Task2Ingress ingress = new Task2Ingress();
        IAcquisitionAuthorityV2.IngressConfig memory config = IAcquisitionAuthorityV2.IngressConfig({
            ingress: address(ingress),
            runtimeCodeHash: address(ingress).codehash,
            perDepositCapWei: 1 ether,
            epochDepositCapWei: 2 ether,
            lifetimeDepositCapWei: 3 ether
        });
        vm.prank(address(safe));
        bytes32 proposal = authority.proposeIngress(config, keccak256("ingress"));
        vm.warp(block.timestamp + authority.INGRESS_PROPOSAL_DELAY());
        vm.prank(address(safe));
        uint256 generation = authority.activateIngress(proposal);
        assertEq(generation, 1);
        assertEq(authority.activeIngressGeneration(), 1);
        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.LocalReadinessFailed.selector, uint8(11)));
        authority.unpause(keccak256("unpause"));
        vm.prank(address(safe));
        authority.disableIngress(keccak256("disable"));
        assertEq(authority.activeIngressGeneration(), 0);
    }

    function test_task2EnumDerivedReasonCodesMatchRawEventData() public {
        (AcquisitionAuthority authority,) = _authority();
        address operator = address(0xBEEF);
        vm.prank(address(safe));
        bytes32 nomination = authority.nominateMainOperator(operator, keccak256("nominate"));
        vm.warp(block.timestamp + authority.OPERATOR_NOMINATION_DELAY());
        vm.prank(operator);
        authority.acceptMainOperatorNomination(nomination);

        vm.recordLogs();
        vm.prank(operator);
        authority.invalidateOutflowNonce(1, keccak256("invalidate"));
        Vm.Log memory invalidated = _onlyLog(
            vm.getRecordedLogs(),
            keccak256("OutflowNonceInvalidated(address,uint256,uint256,uint256,uint8,bytes32)"),
            address(authority)
        );
        assertEq(invalidated.topics.length, 3);
        assertEq(invalidated.data.length, 128);
        assertEq(_word(invalidated.data, 2), uint8(IAcquisitionAuthorityV2.ReasonCode.OUTFLOW_NONCE_INVALIDATED));

        bytes32 packedPause = vm.load(address(authority), bytes32(uint256(3)));
        vm.store(address(authority), bytes32(uint256(3)), bytes32(uint256(packedPause) & ~(uint256(0xff) << 160)));
        vm.recordLogs();
        vm.prank(address(safe));
        authority.pause(keccak256("pause"));
        Vm.Log memory paused =
            _onlyLog(vm.getRecordedLogs(), keccak256("RiskPaused(address,uint8,bytes32)"), address(authority));
        assertEq(paused.topics.length, 2);
        assertEq(paused.data.length, 64);
        assertEq(_word(paused.data, 0), uint8(IAcquisitionAuthorityV2.ReasonCode.RISK_PAUSED));

        Task2Ingress ingress = new Task2Ingress();
        IAcquisitionAuthorityV2.IngressConfig memory config = IAcquisitionAuthorityV2.IngressConfig({
            ingress: address(ingress),
            runtimeCodeHash: address(ingress).codehash,
            perDepositCapWei: 1,
            epochDepositCapWei: 2,
            lifetimeDepositCapWei: 3
        });
        vm.prank(address(safe));
        bytes32 ingressProposal = authority.proposeIngress(config, keccak256("ingress"));
        vm.warp(block.timestamp + authority.INGRESS_PROPOSAL_DELAY());
        vm.prank(address(safe));
        authority.activateIngress(ingressProposal);
        vm.recordLogs();
        vm.prank(address(safe));
        authority.disableIngress(keccak256("disable"));
        Vm.Log memory disabled = _onlyLog(
            vm.getRecordedLogs(),
            keccak256("IngressDisabled(uint256,address,address,uint64,uint8,bytes32)"),
            address(authority)
        );
        assertEq(disabled.topics.length, 4);
        assertEq(disabled.data.length, 96);
        assertEq(_word(disabled.data, 1), uint8(IAcquisitionAuthorityV2.ReasonCode.INGRESS_DISABLED));
    }

    function test_task2StaticGettersReturnCanonicalZeroAndMaxWidthWords() public {
        (AcquisitionAuthority authority,) = _authority();
        bytes memory result = _raw(address(authority), AcquisitionAuthority.pendingMainOperatorNomination.selector, "");
        assertEq(
            result,
            abi.encode(
                IAcquisitionAuthorityV2.PendingOperatorNomination(
                    bytes32(0), 0, address(0), address(0), 0, 0, 0, bytes32(0)
                )
            )
        );
        result = _raw(address(authority), AcquisitionAuthority.pendingIngressProposal.selector, "");
        IAcquisitionAuthorityV2.IngressConfig memory zeroConfig;
        assertEq(
            result,
            abi.encode(
                IAcquisitionAuthorityV2.PendingIngressProposal(
                    bytes32(0), 0, address(0), zeroConfig, bytes32(0), 0, 0, 0, bytes32(0)
                )
            )
        );

        bytes32 proposalId = keccak256("operator-id");
        bytes32 details = keccak256("operator-details");
        address nominee = address(type(uint160).max);
        address proposer = address(0xA11CE);
        vm.store(address(authority), bytes32(uint256(9)), proposalId);
        vm.store(address(authority), bytes32(uint256(10)), bytes32(type(uint256).max));
        vm.store(address(authority), bytes32(uint256(11)), bytes32(uint256(uint160(nominee))));
        vm.store(
            address(authority),
            bytes32(uint256(12)),
            bytes32(uint256(uint160(proposer)) | (uint256(type(uint64).max) << 160))
        );
        vm.store(
            address(authority),
            bytes32(uint256(13)),
            bytes32(uint256(type(uint64).max) | (uint256(type(uint64).max) << 64))
        );
        vm.store(address(authority), bytes32(uint256(14)), details);
        IAcquisitionAuthorityV2.PendingOperatorNomination memory operatorState =
            IAcquisitionAuthorityV2.PendingOperatorNomination(
                proposalId,
                type(uint256).max,
                nominee,
                proposer,
                type(uint64).max,
                type(uint64).max,
                type(uint64).max,
                details
            );
        assertEq(
            _raw(address(authority), AcquisitionAuthority.pendingMainOperatorNomination.selector, ""),
            abi.encode(operatorState)
        );

        IAcquisitionAuthorityV2.IngressConfig memory config = IAcquisitionAuthorityV2.IngressConfig(
            nominee, keccak256("runtime"), type(uint256).max, type(uint256).max - 1, type(uint256).max - 2
        );
        bytes32 configHash = keccak256("config");
        vm.store(address(authority), bytes32(uint256(18)), proposalId);
        vm.store(address(authority), bytes32(uint256(19)), bytes32(type(uint256).max));
        vm.store(address(authority), bytes32(uint256(20)), bytes32(uint256(uint160(proposer))));
        vm.store(address(authority), bytes32(uint256(21)), bytes32(uint256(uint160(config.ingress))));
        vm.store(address(authority), bytes32(uint256(22)), config.runtimeCodeHash);
        vm.store(address(authority), bytes32(uint256(23)), bytes32(config.perDepositCapWei));
        vm.store(address(authority), bytes32(uint256(24)), bytes32(config.epochDepositCapWei));
        vm.store(address(authority), bytes32(uint256(25)), bytes32(config.lifetimeDepositCapWei));
        vm.store(address(authority), bytes32(uint256(26)), configHash);
        vm.store(
            address(authority),
            bytes32(uint256(27)),
            bytes32(uint256(type(uint64).max) | (uint256(type(uint64).max) << 64) | (uint256(type(uint64).max) << 128))
        );
        vm.store(address(authority), bytes32(uint256(28)), details);
        IAcquisitionAuthorityV2.PendingIngressProposal memory ingressState =
            IAcquisitionAuthorityV2.PendingIngressProposal(
                proposalId,
                type(uint256).max,
                proposer,
                config,
                configHash,
                type(uint64).max,
                type(uint64).max,
                type(uint64).max,
                details
            );
        assertEq(
            _raw(address(authority), AcquisitionAuthority.pendingIngressProposal.selector, ""), abi.encode(ingressState)
        );

        uint256 generation = type(uint256).max;
        vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.IngressNotFound.selector, generation));
        authority.getIngress(generation);
        bytes32 base = keccak256(abi.encode(generation, uint256(29)));
        vm.store(address(authority), base, bytes32(generation));
        vm.store(address(authority), bytes32(uint256(base) + 1), bytes32(uint256(uint160(nominee))));
        vm.store(address(authority), bytes32(uint256(base) + 2), config.runtimeCodeHash);
        vm.store(address(authority), bytes32(uint256(base) + 3), bytes32(config.perDepositCapWei));
        vm.store(address(authority), bytes32(uint256(base) + 4), bytes32(config.epochDepositCapWei));
        vm.store(address(authority), bytes32(uint256(base) + 5), bytes32(config.lifetimeDepositCapWei));
        vm.store(
            address(authority),
            bytes32(uint256(base) + 6),
            bytes32(uint256(type(uint64).max) | (uint256(type(uint64).max) << 64))
        );
        IAcquisitionAuthorityV2.IngressRecord memory record = IAcquisitionAuthorityV2.IngressRecord(
            generation,
            nominee,
            config.runtimeCodeHash,
            config.perDepositCapWei,
            config.epochDepositCapWei,
            config.lifetimeDepositCapWei,
            type(uint64).max,
            type(uint64).max
        );
        assertEq(
            _raw(address(authority), AcquisitionAuthority.getIngress.selector, abi.encode(generation)),
            abi.encode(record)
        );
    }

    function test_task2ArtifactSchemaDomainAndLiteralVersion() public {
        (AcquisitionAuthority authority,) = _authority();
        assertEq(authority.supportedChainId(), 4663);
        assertEq(authority.version(), "2");
        (bytes1 fields, string memory name, string memory version, uint256 chainId, address verifyingContract,,) =
            authority.eip712Domain();
        assertEq(fields, hex"0f");
        assertEq(name, "OMERTA AcquisitionAuthority");
        assertEq(version, "2");
        assertEq(chainId, 4663);
        assertEq(verifyingContract, address(authority));
        string memory artifact = vm.readFile("out/AcquisitionAuthority.sol/AcquisitionAuthority.json");
        assertEq((vm.parseJsonBytes(artifact, ".bytecode.object")).length, 18_629);
        assertEq((vm.parseJsonBytes(artifact, ".deployedBytecode.object")).length, 16_068);
    }

    function test_task2FreshFactoriesCannotReuseTask1AddressesOrCommitments() public {
        (AcquisitionConstellationFactory first,,) = _configured();
        (AcquisitionConstellationFactory second,,) = _configured();
        assertTrue(address(first) != address(second));
        (bytes32 firstManifest, bytes32 firstDeployment,,,,,,) = first.factoryState();
        (bytes32 secondManifest, bytes32 secondDeployment,,,,,,) = second.factoryState();
        assertTrue(firstManifest != secondManifest);
        assertTrue(firstDeployment != secondDeployment);
        for (uint8 i; i < 5; ++i) {
            (address a,,) = first.childCommitment(i);
            (address b,,) = second.childCommitment(i);
            assertTrue(a != b);
        }
    }

    function test_task2ConstructorLeavesExactPausedZeroPrefinalStateWithoutPeerCodeRequirement() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes,) = _configured();
        AcquisitionAuthority authority = AcquisitionAuthority(factory.deployNext(initcodes[0]));
        assertTrue(authority.paused());
        assertEq(authority.owner(), address(safe));
        assertEq(authority.mainOperator(), address(0));
        assertEq(authority.operatorGeneration(), 0);
        assertEq(authority.outflowNonce(), 0);
        assertEq(authority.ingressGeneration(), 0);
        assertEq(authority.activeIngressGeneration(), 0);
        (address boundFactory,, bool finalized) = authority.authorityTopology();
        assertEq(boundFactory, address(factory));
        assertFalse(finalized);
    }

    function test_task2AuthorityConstructorZeroAndCodeValidationLadder() public {
        address[4] memory peers;
        Task2AuthorityDeployer deployer = new Task2AuthorityDeployer();
        for (uint8 i; i < 4; ++i) {
            peers[i] = vm.computeCreateAddress(address(deployer), uint256(i + 2));
        }
        vm.expectRevert(AcquisitionAuthority.AuthorityFactoryZero.selector);
        new AcquisitionAuthority(
            address(0), bytes32(uint256(1)), address(safe), address(registry), peers[0], peers[1], peers[2], peers[3]
        );
        vm.expectRevert(AcquisitionAuthority.AuthorityManifestHashZero.selector);
        deployer.deploy(bytes32(0), address(safe), address(registry), peers[0], peers[1], peers[2], peers[3]);
        for (uint8 field; field < 6; ++field) {
            Task2AuthorityDeployer fresh = new Task2AuthorityDeployer();
            for (uint8 i; i < 4; ++i) {
                peers[i] = vm.computeCreateAddress(address(fresh), uint256(i + 2));
            }
            address safe_ = field == 0 ? address(0) : address(safe);
            address registry_ = field == 1 ? address(0) : address(registry);
            if (field >= 2) peers[field - 2] = address(0);
            vm.expectRevert(IAcquisitionAuthorityV2.ZeroAddress.selector);
            fresh.deploy(bytes32(uint256(1)), safe_, registry_, peers[0], peers[1], peers[2], peers[3]);
        }
        Task2AuthorityDeployer noCode = new Task2AuthorityDeployer();
        for (uint8 i; i < 4; ++i) {
            peers[i] = vm.computeCreateAddress(address(noCode), uint256(i + 2));
        }
        vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.ContractRequired.selector, address(0xBEEF)));
        noCode.deploy(bytes32(uint256(1)), address(0xBEEF), address(registry), peers[0], peers[1], peers[2], peers[3]);
        Task2AuthorityDeployer noRegistryCode = new Task2AuthorityDeployer();
        for (uint8 i; i < 4; ++i) {
            peers[i] = vm.computeCreateAddress(address(noRegistryCode), uint256(i + 2));
        }
        vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.ContractRequired.selector, address(0xCAFE)));
        noRegistryCode.deploy(
            bytes32(uint256(1)), address(safe), address(0xCAFE), peers[0], peers[1], peers[2], peers[3]
        );
    }

    function test_task2AuthorityConstructorAddressAndPeerMismatchPayloads() public {
        Task2AuthorityDeployer shifted = new Task2AuthorityDeployer();
        shifted.consumeNonce();
        address[4] memory peers;
        for (uint8 i; i < 4; ++i) {
            peers[i] = vm.computeCreateAddress(address(shifted), uint256(i + 2));
        }
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionAuthority.AuthorityAddressMismatch.selector,
                vm.computeCreateAddress(address(shifted), 1),
                vm.computeCreateAddress(address(shifted), 2)
            )
        );
        shifted.deploy(bytes32(uint256(1)), address(safe), address(registry), peers[0], peers[1], peers[2], peers[3]);

        for (uint8 peerIndex = 1; peerIndex <= 4; ++peerIndex) {
            Task2AuthorityDeployer fresh = new Task2AuthorityDeployer();
            for (uint8 i; i < 4; ++i) {
                peers[i] = vm.computeCreateAddress(address(fresh), uint256(i + 2));
            }
            address expected = peers[peerIndex - 1];
            peers[peerIndex - 1] = address(0xDEAD);
            vm.expectRevert(
                abi.encodeWithSelector(
                    AcquisitionAuthority.AuthorityPeerMismatch.selector, peerIndex, expected, address(0xDEAD)
                )
            );
            fresh.deploy(bytes32(uint256(1)), address(safe), address(registry), peers[0], peers[1], peers[2], peers[3]);
        }
    }

    function test_task2AuthorityConstructorRoleCollisionPrecedenceAndSafeProxyException() public {
        Task2AuthorityDeployer sameRole = new Task2AuthorityDeployer();
        address[4] memory peers;
        for (uint8 i; i < 4; ++i) {
            peers[i] = vm.computeCreateAddress(address(sameRole), uint256(i + 2));
        }
        vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.RoleIdentityCollision.selector, address(safe)));
        sameRole.deploy(bytes32(uint256(1)), address(safe), address(safe), peers[0], peers[1], peers[2], peers[3]);

        Task2AuthorityDeployer safeFactory = new Task2AuthorityDeployer();
        for (uint8 i; i < 4; ++i) {
            peers[i] = vm.computeCreateAddress(address(safeFactory), uint256(i + 2));
        }
        vm.expectRevert(
            abi.encodeWithSelector(IAcquisitionAuthorityV2.RoleIdentityCollision.selector, address(safeFactory))
        );
        safeFactory.deploy(
            bytes32(uint256(1)), address(safeFactory), address(registry), peers[0], peers[1], peers[2], peers[3]
        );

        Task2AuthorityDeployer registryFactory = new Task2AuthorityDeployer();
        for (uint8 i; i < 4; ++i) {
            peers[i] = vm.computeCreateAddress(address(registryFactory), uint256(i + 2));
        }
        vm.expectRevert(
            abi.encodeWithSelector(IAcquisitionAuthorityV2.RoleIdentityCollision.selector, address(registryFactory))
        );
        registryFactory.deploy(
            bytes32(uint256(1)), address(safe), address(registryFactory), peers[0], peers[1], peers[2], peers[3]
        );

        for (uint8 role; role < 2; ++role) {
            for (uint8 peer; peer < 4; ++peer) {
                Task2AuthorityDeployer fresh = new Task2AuthorityDeployer();
                for (uint8 i; i < 4; ++i) {
                    peers[i] = vm.computeCreateAddress(address(fresh), uint256(i + 2));
                }
                vm.etch(peers[peer], hex"60006000f3");
                address safe_ = role == 0 ? peers[peer] : address(safe);
                address registry_ = role == 1 ? peers[peer] : address(registry);
                vm.expectRevert(
                    abi.encodeWithSelector(IAcquisitionAuthorityV2.RoleIdentityCollision.selector, peers[peer])
                );
                fresh.deploy(bytes32(uint256(1)), safe_, registry_, peers[0], peers[1], peers[2], peers[3]);
            }
        }

        Task2SafeProxy proxySafe = new Task2SafeProxy(address(new Task2Ingress()));
        Task2AuthorityDeployer proxyDeployer = new Task2AuthorityDeployer();
        for (uint8 i; i < 4; ++i) {
            peers[i] = vm.computeCreateAddress(address(proxyDeployer), uint256(i + 2));
        }
        AcquisitionAuthority proxyOwned = proxyDeployer.deploy(
            bytes32(uint256(1)), address(proxySafe), address(registry), peers[0], peers[1], peers[2], peers[3]
        );
        assertEq(proxyOwned.owner(), address(proxySafe));
    }

    function test_task2AuthorityConstructorOverlappingFirstFailureTable() public {
        address[4] memory peers;
        vm.expectRevert(AcquisitionAuthority.AuthorityFactoryZero.selector);
        new AcquisitionAuthority(
            address(0), bytes32(0), address(0), address(0), address(0), address(0), address(0), address(0)
        );

        Task2AuthorityDeployer manifestFirst = new Task2AuthorityDeployer();
        for (uint8 i; i < 4; ++i) {
            peers[i] = vm.computeCreateAddress(address(manifestFirst), uint256(i + 2));
        }
        vm.expectRevert(AcquisitionAuthority.AuthorityManifestHashZero.selector);
        manifestFirst.deploy(bytes32(0), address(0), address(registry), peers[0], peers[1], peers[2], peers[3]);

        Task2AuthorityDeployer safeCodeFirst = new Task2AuthorityDeployer();
        for (uint8 i; i < 4; ++i) {
            peers[i] = vm.computeCreateAddress(address(safeCodeFirst), uint256(i + 2));
        }
        vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.ContractRequired.selector, address(0xA11CE)));
        safeCodeFirst.deploy(
            bytes32(uint256(1)), address(0xA11CE), address(0xB0B), peers[0], peers[1], peers[2], peers[3]
        );

        Task2AuthorityDeployer addressFirst = new Task2AuthorityDeployer();
        addressFirst.consumeNonce();
        for (uint8 i; i < 4; ++i) {
            peers[i] = address(0xDEAD);
        }
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionAuthority.AuthorityAddressMismatch.selector,
                vm.computeCreateAddress(address(addressFirst), 1),
                vm.computeCreateAddress(address(addressFirst), 2)
            )
        );
        addressFirst.deploy(
            bytes32(uint256(1)), address(safe), address(registry), peers[0], peers[1], peers[2], peers[3]
        );

        for (uint8 firstMismatch = 1; firstMismatch <= 3; ++firstMismatch) {
            Task2AuthorityDeployer peerFirst = new Task2AuthorityDeployer();
            for (uint8 i; i < 4; ++i) {
                peers[i] = vm.computeCreateAddress(address(peerFirst), uint256(i + 2));
            }
            address expected = peers[firstMismatch - 1];
            peers[firstMismatch - 1] = address(uint160(0xD000 + firstMismatch));
            peers[firstMismatch] = address(uint160(0xE000 + firstMismatch));
            vm.expectRevert(
                abi.encodeWithSelector(
                    AcquisitionAuthority.AuthorityPeerMismatch.selector,
                    firstMismatch,
                    expected,
                    address(uint160(0xD000 + firstMismatch))
                )
            );
            peerFirst.deploy(
                bytes32(uint256(1)), address(safe), address(registry), peers[0], peers[1], peers[2], peers[3]
            );
        }

        for (uint8 overlap; overlap < 3; ++overlap) {
            Task2AuthorityDeployer collision = new Task2AuthorityDeployer();
            for (uint8 i; i < 4; ++i) {
                peers[i] = vm.computeCreateAddress(address(collision), uint256(i + 2));
            }
            address candidate = overlap == 1 ? peers[0] : address(collision);
            if (overlap == 1) vm.etch(candidate, hex"60006000f3");
            vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.RoleIdentityCollision.selector, candidate));
            collision.deploy(bytes32(uint256(1)), candidate, candidate, peers[0], peers[1], peers[2], peers[3]);
        }

        Task2AuthorityDeployer childZero = new Task2AuthorityDeployer();
        address predictedAuthority = vm.computeCreateAddress(address(childZero), 1);
        for (uint8 i; i < 4; ++i) {
            peers[i] = vm.computeCreateAddress(address(childZero), uint256(i + 2));
        }
        vm.etch(predictedAuthority, hex"60006000f3");
        (bool created,) = address(childZero)
            .call(
                abi.encodeCall(
                    childZero.deploy,
                    (bytes32(uint256(1)), predictedAuthority, address(registry), peers[0], peers[1], peers[2], peers[3])
                )
            );
        assertFalse(created, "prefunded-code child0 blocks CREATE before any late collision branch");
    }

    function test_task2FinalizerCallerManifestAlreadyPrecedenceAndRollback() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes,) = _configured();
        AcquisitionAuthority authority = AcquisitionAuthority(factory.deployNext(initcodes[0]));
        (bytes32 manifest,,,,,,,) = factory.factoryState();
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionAuthority.AuthorityFinalizerUnauthorized.selector, address(this))
        );
        authority.finalizeAuthority(bytes32(uint256(1)));
        vm.prank(address(factory));
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionAuthority.AuthorityManifestHashMismatch.selector, manifest, bytes32(uint256(1))
            )
        );
        authority.finalizeAuthority(bytes32(uint256(1)));
        (,, bool finalizedBefore) = authority.authorityTopology();
        assertFalse(finalizedBefore);
        vm.prank(address(factory));
        authority.finalizeAuthority(manifest);
        vm.prank(address(factory));
        vm.expectRevert(AcquisitionAuthority.AuthorityAlreadyFinalized.selector);
        authority.finalizeAuthority(manifest);
    }

    function test_task2FinalizerStateOrdinalsNineThroughTwentySixHaveExactPayloads() public {
        for (uint8 field = 9; field <= 26; ++field) {
            if (field == 20) continue;
            (AcquisitionConstellationFactory factory, bytes[5] memory initcodes,) = _configured();
            AcquisitionAuthority authority = AcquisitionAuthority(factory.deployNext(initcodes[0]));
            (bytes32 manifest,,,,,,,) = factory.factoryState();
            _corruptInitialField(authority, field);
            vm.expectRevert(abi.encodeWithSelector(AcquisitionAuthority.AuthorityInitialStateMismatch.selector, field));
            vm.prank(address(factory));
            authority.finalizeAuthority(manifest);
            (,, bool finalized) = authority.authorityTopology();
            assertFalse(finalized);
        }
    }

    function test_task2InitialStateOrdinalTwentyIsStrictlyShadowedByNineteen() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes,) = _configured();
        AcquisitionAuthority authority = AcquisitionAuthority(factory.deployNext(initcodes[0]));
        (bytes32 manifest,,,,,,,) = factory.factoryState();
        bytes32 base = _ingressBase(0);
        vm.store(address(authority), bytes32(uint256(base) + 2), bytes32(uint256(1)));
        vm.prank(address(factory));
        authority.finalizeAuthority(manifest);

        (AcquisitionConstellationFactory secondFactory, bytes[5] memory secondInitcodes,) = _configured();
        AcquisitionAuthority second = AcquisitionAuthority(secondFactory.deployNext(secondInitcodes[0]));
        (bytes32 secondManifest,,,,,,,) = secondFactory.factoryState();
        bytes32 secondBase = _ingressBase(0);
        vm.store(address(second), bytes32(uint256(secondBase) + 1), bytes32(uint256(1)));
        vm.store(address(second), bytes32(uint256(secondBase) + 2), bytes32(uint256(1)));
        vm.expectRevert(abi.encodeWithSelector(AcquisitionAuthority.AuthorityInitialStateMismatch.selector, uint8(19)));
        vm.prank(address(secondFactory));
        second.finalizeAuthority(secondManifest);
    }

    function test_task2InitialStateEncoderHasNoViaIrDoubleShiftPattern() public view {
        bytes memory source = bytes(vm.readFile("src/AcquisitionAuthority.sol"));
        assertFalse(_contains(source, bytes("shl(224, selector)")));
        assertFalse(_contains(source, bytes("shl(224, _ERC1271_MAGIC)")));
        assertTrue(_contains(source, bytes("mstore(0, selector)")));
        assertTrue(_contains(source, bytes("mstore(input, magic)")));
    }

    function test_task2EveryMutationFamilyRejectsPrefinalBeforeAuthorization() public {
        (AcquisitionConstellationFactory factory, bytes[5] memory initcodes,) = _configured();
        AcquisitionAuthority authority = AcquisitionAuthority(factory.deployNext(initcodes[0]));
        bytes[] memory calls = new bytes[](8);
        calls[0] = abi.encodeWithSelector(authority.transferOwnership.selector, address(0xBEEF));
        calls[1] = abi.encodeWithSelector(authority.nominateMainOperator.selector, address(0xBEEF), bytes32(uint256(1)));
        calls[2] = abi.encodeWithSelector(authority.invalidateOutflowNonce.selector, 1, bytes32(uint256(1)));
        calls[3] = abi.encodeWithSelector(authority.pause.selector, bytes32(uint256(1)));
        calls[4] = abi.encodeWithSelector(authority.unpause.selector, bytes32(uint256(1)));
        calls[5] =
            abi.encodeWithSelector(authority.cancelMainOperatorNomination.selector, bytes32(0), bytes32(uint256(1)));
        calls[6] = abi.encodeWithSelector(authority.disableIngress.selector, bytes32(uint256(1)));
        calls[7] = abi.encodeWithSelector(authority.expireIngressProposal.selector, bytes32(0));
        for (uint256 i; i < calls.length; ++i) {
            (bool ok, bytes memory data) = address(authority).call(calls[i]);
            assertFalse(ok);
            assertEq(bytes4(data), AcquisitionAuthority.AuthorityNotFinalized.selector);
        }
    }

    function test_task2OwnershipAcceptanceCancelsOnlyPendingNominationAndPreservesAuthorityState() public {
        (AcquisitionAuthority authority,) = _authority();
        bytes32 proposal = _nominate(authority, address(0xBEEF));
        Task2SafeCandidate nextSafe = new Task2SafeCandidate();
        vm.prank(address(safe));
        authority.transferOwnership(address(nextSafe));
        vm.recordLogs();
        vm.prank(address(nextSafe));
        authority.acceptOwnership();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 2);
        assertEq(logs[0].topics[0], keccak256("OwnershipTransferred(address,address)"));
        assertEq(logs[1].topics[0], keccak256("MainOperatorNominationCancelled(bytes32,address,address,uint8,bytes32)"));
        assertEq(logs[1].topics[1], proposal);
        assertEq(authority.owner(), address(nextSafe));
        assertEq(authority.nominationNonce(), 1);
        assertEq(authority.operatorGeneration(), 0);
        assertEq(authority.outflowNonce(), 0);
        assertEq(authority.pendingMainOperatorNomination().proposalId, bytes32(0));
    }

    function test_task2OperatorDelayAndHalfOpenAcceptanceWindow() public {
        (AcquisitionAuthority authority,) = _authority();
        address nominee = address(0xBEEF);
        bytes32 proposal = _nominate(authority, nominee);
        IAcquisitionAuthorityV2.PendingOperatorNomination memory pending = authority.pendingMainOperatorNomination();
        vm.warp(pending.validAfter - 1);
        vm.prank(nominee);
        vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.ProposalNotReady.selector, pending.validAfter));
        authority.acceptMainOperatorNomination(proposal);
        vm.warp(pending.expiresAt);
        vm.prank(nominee);
        vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.ProposalExpired.selector, pending.expiresAt));
        authority.acceptMainOperatorNomination(proposal);
    }

    function test_task2OperatorCancelAndPermissionlessExpiryPreserveMonotonicCounter() public {
        (AcquisitionAuthority authority,) = _authority();
        bytes32 first = _nominate(authority, address(0xBEEF));
        vm.prank(address(safe));
        authority.cancelMainOperatorNomination(first, keccak256("cancel"));
        bytes32 second = _nominate(authority, address(0xCAFE));
        IAcquisitionAuthorityV2.PendingOperatorNomination memory pending = authority.pendingMainOperatorNomination();
        vm.warp(pending.expiresAt);
        vm.prank(address(0xDEAD));
        authority.expireMainOperatorNomination(second);
        assertEq(authority.nominationNonce(), 2);
        assertEq(authority.pendingMainOperatorNomination().proposalId, bytes32(0));
    }

    function test_task2SharedNonceRequiresExactOneStepAndNeverChangesGeneration() public {
        (AcquisitionAuthority authority,) = _authority();
        address operator = _installOperator(authority, address(0xBEEF));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.InvalidOutflowNonceStep.selector, 0, 2));
        authority.invalidateOutflowNonce(2, keccak256("bad"));
        vm.prank(operator);
        authority.invalidateOutflowNonce(1, keccak256("good"));
        assertEq(authority.outflowNonce(), 1);
        assertEq(authority.operatorGeneration(), 1);
    }

    function test_task2SuccessorConsentReplayFailsAfterGenerationTransition() public {
        (AcquisitionAuthority authority,) = _authority();
        address operator = _installOperator(authority, address(0xBEEF));
        (IAcquisitionAuthorityV2.SuccessorConsent memory consent, bytes memory signature) =
            _signedConsent(authority, operator, 0xA11CE);
        vm.prank(operator);
        authority.replaceMainOperator(consent, signature);
        vm.prank(consent.successor);
        vm.expectRevert(IAcquisitionAuthorityV2.InvalidOperatorReplacement.selector);
        authority.replaceMainOperator(consent, signature);
    }

    function test_task2SuccessorHashBindsEveryAuthorityDomainAndActionField() public {
        (AcquisitionAuthority authority,) = _authority();
        IAcquisitionAuthorityV2.SuccessorConsent memory consent = IAcquisitionAuthorityV2.SuccessorConsent(
            address(1),
            address(2),
            3,
            4,
            5,
            6,
            uint8(IAcquisitionAuthorityV2.ReasonCode.OPERATOR_REPLACED),
            bytes32(uint256(7))
        );
        bytes32 original = authority.hashSuccessorConsent(consent);
        consent.generation++;
        assertTrue(authority.hashSuccessorConsent(consent) != original);
        consent.generation--;
        consent.detailsHash = bytes32(uint256(8));
        assertTrue(authority.hashSuccessorConsent(consent) != original);
    }

    function test_task2EoaInvalidLengthHighSInvalidVRecoveryAndWrongSignerCollapse() public {
        (AcquisitionAuthority authority,) = _authority();
        address operator = _installOperator(authority, address(0xBEEF));
        (IAcquisitionAuthorityV2.SuccessorConsent memory consent, bytes memory valid) =
            _signedConsent(authority, operator, 0xA11CE);
        bytes memory highS = bytes.concat(bytes32(valid), bytes32(type(uint256).max), bytes1(uint8(27)));
        bytes memory invalidV = bytes.concat(bytes32(valid), bytes32(uint256(1)), bytes1(uint8(29)));
        bytes memory zeroRecovery = bytes.concat(bytes32(0), bytes32(uint256(1)), bytes1(uint8(27)));
        (, bytes memory wrongSigner) = _signedConsent(authority, operator, 0xB0B);
        bytes[] memory invalid = new bytes[](7);
        invalid[0] = bytes("");
        invalid[1] = new bytes(64);
        invalid[2] = new bytes(66);
        invalid[3] = highS;
        invalid[4] = invalidV;
        invalid[5] = zeroRecovery;
        invalid[6] = wrongSigner;
        for (uint256 i; i < invalid.length; ++i) {
            vm.prank(operator);
            vm.expectRevert(IAcquisitionAuthorityV2.InvalidSignature.selector);
            authority.replaceMainOperator(consent, invalid[i]);
        }
    }

    function test_task2Erc1271ExactPayloadAndSignatureLengthSuccessMatrix() public {
        uint256[6] memory lengths = [uint256(1), 31, 32, 33, 65, 4096];
        for (uint256 i; i < lengths.length; ++i) {
            (AcquisitionAuthority authority,) = _authority();
            address operator = _installOperator(authority, address(uint160(0xBEEF + i)));
            Task2ERC1271Fixture wallet = new Task2ERC1271Fixture();
            bytes memory signature = new bytes(lengths[i]);
            for (uint256 j; j < signature.length; ++j) {
                signature[j] = bytes1(uint8(j + 1));
            }
            IAcquisitionAuthorityV2.SuccessorConsent memory consent =
                _walletConsent(authority, operator, address(wallet));
            bytes32 digest = authority.hashSuccessorConsent(consent);
            wallet.configure(digest, signature, 0, address(0), "");
            bytes memory exactCall = abi.encodeWithSelector(bytes4(0x1626ba7e), digest, signature);
            vm.expectCallMinGas(address(wallet), 0, uint64(authority.ERC1271_CALL_GAS()), exactCall);
            vm.prank(operator);
            authority.replaceMainOperator(consent, signature);
            assertEq(authority.mainOperator(), address(wallet));
        }
    }

    function test_task2Erc1271RejectsZeroAndOverMaximumBeforeWalletCall() public {
        for (uint256 length = 0; length <= 4097; length += 4097) {
            (AcquisitionAuthority authority,) = _authority();
            address operator = _installOperator(authority, address(uint160(0xCAFE + length)));
            Task2ERC1271Fixture wallet = new Task2ERC1271Fixture();
            bytes memory signature = new bytes(length);
            IAcquisitionAuthorityV2.SuccessorConsent memory consent =
                _walletConsent(authority, operator, address(wallet));
            vm.startStateDiffRecording();
            vm.prank(operator);
            vm.expectRevert(IAcquisitionAuthorityV2.InvalidSignature.selector);
            authority.replaceMainOperator(consent, signature);
            Vm.AccountAccess[] memory accesses = vm.stopAndReturnStateDiff();
            for (uint256 i; i < accesses.length; ++i) {
                assertFalse(
                    accesses[i].kind == VmSafe.AccountAccessKind.StaticCall && accesses[i].account == address(wallet),
                    "invalid signature length reached ERC1271 wallet"
                );
            }
            assertEq(authority.mainOperator(), operator);
        }
    }

    function test_task2Erc1271ReturnRevertBombAndOogMatrixIsAtomic() public {
        for (uint256 mode = 1; mode <= 11; ++mode) {
            (AcquisitionAuthority authority,) = _authority();
            address operator = _installOperator(authority, address(uint160(0xD000 + mode)));
            Task2ERC1271Fixture wallet = new Task2ERC1271Fixture();
            bytes memory signature = hex"aabbcc";
            IAcquisitionAuthorityV2.SuccessorConsent memory consent =
                _walletConsent(authority, operator, address(wallet));
            wallet.configure(authority.hashSuccessorConsent(consent), signature, mode, address(0), "");
            vm.prank(operator);
            vm.expectRevert(IAcquisitionAuthorityV2.InvalidSignature.selector);
            authority.replaceMainOperator(consent, signature);
            assertEq(authority.mainOperator(), operator);
            assertEq(authority.operatorGeneration(), 1);
        }
    }

    function test_task2Erc1271GasBoundariesAndActualCallTracePrecedence() public {
        (AcquisitionAuthority authority,) = _authority();
        address operator = _installOperator(authority, address(0xBEEF));
        Task2ERC1271Fixture wallet = new Task2ERC1271Fixture();
        bytes memory signature = hex"010203";
        IAcquisitionAuthorityV2.SuccessorConsent memory consent = _walletConsent(authority, operator, address(wallet));
        bytes32 digest = authority.hashSuccessorConsent(consent);
        bytes memory callData = abi.encodeWithSelector(authority.replaceMainOperator.selector, consent, signature);
        assertFalse(_signatureGasAllowed(159_999, authority.ERC1271_MIN_PRECALL_GAS()));
        assertTrue(_signatureGasAllowed(160_000, authority.ERC1271_MIN_PRECALL_GAS()));
        assertFalse(_signatureGasAllowed(49_999, authority.ERC1271_POST_CALL_GAS_RESERVE()));
        assertTrue(_signatureGasAllowed(50_000, authority.ERC1271_POST_CALL_GAS_RESERVE()));
        string memory source = vm.readFile("src/AcquisitionAuthority.sol");
        assertTrue(_contains(bytes(source), bytes("gasleft() < ERC1271_MIN_PRECALL_GAS")));
        assertTrue(_contains(bytes(source), bytes("gasleft() < ERC1271_POST_CALL_GAS_RESERVE")));

        wallet.configure(digest, signature, 0, address(0), "");
        uint256 preGas = _findSignatureGasFailure(authority, wallet, operator, callData, 120_000, 260_000, 500, false);
        assertTrue(preGas != 0);

        wallet.configure(digest, signature, 9, address(0), "");
        _cool(address(wallet));
        vm.startStateDiffRecording();
        vm.prank(operator);
        (bool ok, bytes memory result) = address(authority).call{gas: 500_000}(callData);
        Vm.AccountAccess[] memory accesses = vm.stopAndReturnStateDiff();
        assertFalse(ok);
        assertEq(bytes4(result), IAcquisitionAuthorityV2.InvalidSignature.selector);
        assertTrue(_sawStaticCall(accesses, address(wallet)));
        assertEq(authority.mainOperator(), operator);
        assertEq(authority.operatorGeneration(), 1);
    }

    function _signatureGasAllowed(uint256 available, uint256 required) internal pure returns (bool) {
        return available >= required;
    }

    function _findSignatureGasFailure(
        AcquisitionAuthority authority,
        Task2ERC1271Fixture wallet,
        address operator,
        bytes memory callData,
        uint256 from,
        uint256 to,
        uint256 step,
        bool requireWalletCall
    ) internal returns (uint256 found) {
        bytes4 expected = IAcquisitionAuthorityV2.InsufficientSignatureValidationGas.selector;
        for (uint256 supplied = from; supplied <= to; supplied += step) {
            _cool(address(wallet));
            vm.startStateDiffRecording();
            vm.prank(operator);
            (bool ok, bytes memory result) = address(authority).call{gas: supplied}(callData);
            Vm.AccountAccess[] memory accesses = vm.stopAndReturnStateDiff();
            bool sawWallet = _sawStaticCall(accesses, address(wallet));
            if (!ok && result.length >= 4 && bytes4(result) == expected && sawWallet == requireWalletCall) {
                return supplied;
            }
        }
        fail();
    }

    function _sawStaticCall(Vm.AccountAccess[] memory accesses, address target) internal pure returns (bool) {
        for (uint256 i; i < accesses.length; ++i) {
            if (accesses[i].kind == VmSafe.AccountAccessKind.StaticCall && accesses[i].account == target) return true;
        }
        return false;
    }

    function _cool(address target) internal {
        (bool ok,) = address(vm).call(abi.encodeWithSignature("cool(address)", target));
        assertTrue(ok);
    }

    function test_task2Erc1271CallbackCoversAllGuardedMutatorsAndFinalizerException() public {
        for (uint8 family; family < 19; ++family) {
            (AcquisitionAuthority authority,) = _authority();
            address operator = _installOperator(authority, address(uint160(0xBEEF + family)));
            Task2ERC1271Fixture wallet = new Task2ERC1271Fixture();
            bytes memory signature = hex"0102030405";
            IAcquisitionAuthorityV2.SuccessorConsent memory consent =
                _walletConsent(authority, operator, address(wallet));
            bytes memory callback = _mutatorCallback(authority, family);
            wallet.configure(authority.hashSuccessorConsent(consent), signature, 0, address(authority), callback);
            if (family == 18) {
                (address factory,,) = authority.authorityTopology();
                wallet.setCallbackSender(factory);
                wallet.setCallbackError(AcquisitionAuthority.AuthorityAlreadyFinalized.selector);
            }
            vm.prank(operator);
            authority.replaceMainOperator(consent, signature);
            assertEq(authority.mainOperator(), address(wallet));
            assertEq(authority.operatorGeneration(), 2);
            assertEq(authority.outflowNonce(), 0);
        }
    }

    function _mutatorCallback(AcquisitionAuthority authority, uint8 family) internal view returns (bytes memory) {
        if (family == 0) return abi.encodeWithSelector(authority.transferOwnership.selector, address(0xCAFE));
        if (family == 1) return abi.encodeWithSelector(authority.acceptOwnership.selector);
        if (family == 2) return abi.encodeWithSelector(authority.renounceOwnership.selector);
        if (family == 3) {
            return abi.encodeWithSelector(authority.nominateMainOperator.selector, address(1), bytes32(uint256(1)));
        }
        if (family == 4) {
            return abi.encodeWithSelector(authority.cancelMainOperatorNomination.selector, bytes32(0), bytes32(0));
        }
        if (family == 5) return abi.encodeWithSelector(authority.expireMainOperatorNomination.selector, bytes32(0));
        if (family == 6) return abi.encodeWithSelector(authority.acceptMainOperatorNomination.selector, bytes32(0));
        if (family == 7) return abi.encodeWithSelector(authority.disableMainOperator.selector, bytes32(0));
        if (family == 8) return abi.encodeWithSelector(authority.renounceMainOperator.selector, bytes32(0));
        if (family == 9) {
            IAcquisitionAuthorityV2.SuccessorConsent memory empty;
            return abi.encodeWithSelector(authority.replaceMainOperator.selector, empty, bytes(""));
        }
        if (family == 10) return abi.encodeWithSelector(authority.invalidateOutflowNonce.selector, 1, bytes32(0));
        if (family == 11) return abi.encodeWithSelector(authority.pause.selector, bytes32(0));
        if (family == 12) return abi.encodeWithSelector(authority.unpause.selector, bytes32(0));
        if (family == 13) {
            IAcquisitionAuthorityV2.IngressConfig memory empty;
            return abi.encodeWithSelector(authority.proposeIngress.selector, empty, bytes32(0));
        }
        if (family == 14) {
            return abi.encodeWithSelector(authority.cancelIngressProposal.selector, bytes32(0), bytes32(0));
        }
        if (family == 15) return abi.encodeWithSelector(authority.expireIngressProposal.selector, bytes32(0));
        if (family == 16) return abi.encodeWithSelector(authority.activateIngress.selector, bytes32(0));
        if (family == 17) return abi.encodeWithSelector(authority.disableIngress.selector, bytes32(0));
        (, bytes32 manifestHash,) = authority.authorityTopology();
        return abi.encodeWithSelector(authority.finalizeAuthority.selector, manifestHash);
    }

    function test_task2Erc1271Exact32DirtyLowBytesAreAcceptedByFrozenBytes4Comparison() public {
        (AcquisitionAuthority authority,) = _authority();
        address operator = _installOperator(authority, address(0xBEEF));
        Task2ERC1271Fixture wallet = new Task2ERC1271Fixture();
        bytes memory signature = hex"42";
        IAcquisitionAuthorityV2.SuccessorConsent memory consent = _walletConsent(authority, operator, address(wallet));
        wallet.configure(authority.hashSuccessorConsent(consent), signature, 12, address(0), "");
        vm.prank(operator);
        authority.replaceMainOperator(consent, signature);
        assertEq(authority.mainOperator(), address(wallet));
    }

    function test_task2IngressLocalCapInequalitiesRejectWithoutGlobalCapState() public {
        (AcquisitionAuthority authority,) = _authority();
        Task2Ingress ingress = new Task2Ingress();
        IAcquisitionAuthorityV2.IngressConfig memory config = _config(address(ingress));
        config.perDepositCapWei = 4;
        vm.prank(address(safe));
        vm.expectRevert(IAcquisitionAuthorityV2.InvalidIngressConfig.selector);
        authority.proposeIngress(config, keccak256("bad"));
        config.perDepositCapWei = 1;
        config.epochDepositCapWei = 4;
        config.lifetimeDepositCapWei = 3;
        vm.prank(address(safe));
        vm.expectRevert(IAcquisitionAuthorityV2.InvalidIngressConfig.selector);
        authority.proposeIngress(config, keccak256("bad"));
    }

    function test_task2IngressCapEqualityAndPlusMinusOneSeams() public {
        (AcquisitionAuthority authority,) = _authority();
        Task2Ingress ingress = new Task2Ingress();
        IAcquisitionAuthorityV2.IngressConfig memory equal =
            IAcquisitionAuthorityV2.IngressConfig(address(ingress), address(ingress).codehash, 7, 7, 7);
        vm.prank(address(safe));
        bytes32 proposal = authority.proposeIngress(equal, keccak256("equal"));
        assertTrue(proposal != bytes32(0));
        vm.prank(address(safe));
        authority.cancelIngressProposal(proposal, keccak256("cancel"));
        uint256[3] memory per = [uint256(0), 8, 7];
        uint256[3] memory epoch = [uint256(7), 7, 8];
        uint256[3] memory life = [uint256(7), 7, 7];
        for (uint256 i; i < 3; ++i) {
            equal.perDepositCapWei = per[i];
            equal.epochDepositCapWei = epoch[i];
            equal.lifetimeDepositCapWei = life[i];
            vm.expectRevert(IAcquisitionAuthorityV2.InvalidIngressConfig.selector);
            vm.prank(address(safe));
            authority.proposeIngress(equal, keccak256(abi.encode("invalid", i)));
        }
        assertEq(authority.ingressProposalNonce(), 1);
    }

    function test_task2IngressActivationUsesHalfOpenWindow() public {
        (AcquisitionAuthority authority,) = _authority();
        Task2Ingress ingress = new Task2Ingress();
        vm.prank(address(safe));
        bytes32 proposal = authority.proposeIngress(_config(address(ingress)), keccak256("ingress"));
        IAcquisitionAuthorityV2.PendingIngressProposal memory pending = authority.pendingIngressProposal();
        vm.warp(pending.validAfter - 1);
        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.ProposalNotReady.selector, pending.validAfter));
        authority.activateIngress(proposal);
        vm.warp(pending.expiresAt);
        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.ProposalExpired.selector, pending.expiresAt));
        authority.activateIngress(proposal);

        (AcquisitionAuthority lastAuthority,) = _authority();
        Task2Ingress lastIngress = new Task2Ingress();
        vm.prank(address(safe));
        bytes32 lastProposal = lastAuthority.proposeIngress(_config(address(lastIngress)), keccak256("last"));
        IAcquisitionAuthorityV2.PendingIngressProposal memory lastPending = lastAuthority.pendingIngressProposal();
        vm.warp(lastPending.expiresAt - 1);
        vm.prank(address(safe));
        assertEq(lastAuthority.activateIngress(lastProposal), 1);
    }

    function test_task2IngressCancellationAndExpiryIgnoreCodeDrift() public {
        (AcquisitionAuthority authority,) = _authority();
        Task2Ingress ingress = new Task2Ingress();
        vm.prank(address(safe));
        bytes32 proposal = authority.proposeIngress(_config(address(ingress)), keccak256("ingress"));
        vm.etch(address(ingress), hex"");
        vm.prank(address(safe));
        authority.cancelIngressProposal(proposal, keccak256("cancel"));
        Task2Ingress second = new Task2Ingress();
        vm.prank(address(safe));
        bytes32 secondProposal = authority.proposeIngress(_config(address(second)), keccak256("ingress2"));
        IAcquisitionAuthorityV2.PendingIngressProposal memory pending = authority.pendingIngressProposal();
        vm.etch(address(second), hex"");
        vm.warp(pending.expiresAt);
        authority.expireIngressProposal(secondProposal);
        assertEq(authority.ingressProposalNonce(), 2);
    }

    function test_task2IngressActivationCodeAbsenceAndDriftPreservePendingState() public {
        for (uint8 mode; mode < 2; ++mode) {
            (AcquisitionAuthority authority,) = _authority();
            Task2Ingress ingress = new Task2Ingress();
            vm.prank(address(safe));
            bytes32 proposal = authority.proposeIngress(_config(address(ingress)), keccak256("ingress"));
            IAcquisitionAuthorityV2.PendingIngressProposal memory beforeState = authority.pendingIngressProposal();
            bytes32 beforeHash = keccak256(abi.encode(beforeState));
            uint256 beforeBalance = address(authority).balance;
            bool beforePaused = authority.paused();
            vm.warp(beforeState.validAfter);
            if (mode == 0) {
                vm.etch(address(ingress), hex"");
                vm.expectRevert(
                    abi.encodeWithSelector(IAcquisitionAuthorityV2.ContractRequired.selector, address(ingress))
                );
            } else {
                vm.etch(address(ingress), hex"60006000fd");
                vm.expectRevert(
                    abi.encodeWithSelector(
                        IAcquisitionAuthorityV2.IngressCodeHashMismatch.selector,
                        address(ingress),
                        beforeState.config.runtimeCodeHash,
                        address(ingress).codehash
                    )
                );
            }
            vm.recordLogs();
            vm.prank(address(safe));
            authority.activateIngress(proposal);
            assertEq(vm.getRecordedLogs().length, 0);
            assertEq(keccak256(abi.encode(authority.pendingIngressProposal())), beforeHash);
            assertEq(authority.ingressGeneration(), 0);
            assertEq(authority.activeIngressGeneration(), 0);
            assertEq(authority.ingressProposalNonce(), 1);
            assertEq(authority.paused(), beforePaused);
            assertEq(address(authority).balance, beforeBalance);
        }
    }

    function test_task2IngressLastProposalTimestampAndIndependentHashPreimages() public {
        (AcquisitionAuthority authority,) = _authority();
        Task2Ingress ingress = new Task2Ingress();
        uint256 last = type(uint64).max - authority.OPERATOR_NOMINATION_DELAY() - authority.OPERATOR_ACCEPTANCE_WINDOW();
        vm.warp(last);
        bytes32 details = keccak256("last-valid");
        IAcquisitionAuthorityV2.IngressConfig memory config = _config(address(ingress));
        vm.prank(address(safe));
        bytes32 proposalId = authority.proposeIngress(config, details);
        IAcquisitionAuthorityV2.PendingIngressProposal memory pending = authority.pendingIngressProposal();
        (, bytes memory snapshot) =
            address(authority).staticcall(abi.encodeWithSelector(authority.authoritySnapshot.selector));
        address core = address(uint160(_word(snapshot, 4)));
        bytes32 expectedConfigHash = keccak256(
            abi.encode(
                keccak256("OMERTA_AUTH_INGRESS_CONFIG_V2"),
                uint256(4663),
                core,
                address(authority),
                config.ingress,
                config.runtimeCodeHash,
                config.perDepositCapWei,
                config.epochDepositCapWei,
                config.lifetimeDepositCapWei
            )
        );
        assertEq(pending.configHash, expectedConfigHash, "independent config hash");
        bytes memory proposalPreimage = abi.encode(
            keccak256("OMERTA_AUTH_INGRESS_PROPOSAL_V2"),
            uint256(4663),
            core,
            address(authority),
            uint256(0),
            uint256(1),
            address(safe),
            config.ingress,
            config.runtimeCodeHash,
            config.perDepositCapWei,
            config.epochDepositCapWei,
            config.lifetimeDepositCapWei,
            pending.proposedAt,
            pending.validAfter,
            pending.expiresAt,
            details
        );
        bytes32 expectedProposalId = keccak256(proposalPreimage);
        assertEq(proposalId, expectedProposalId, "independent proposal id");
        assertEq(proposalPreimage.length, 0x200, "exact sixteen-word proposal preimage");
        for (uint256 field; field < 16; ++field) {
            bytes memory mutated = bytes.concat(proposalPreimage);
            assembly {
                let fieldPtr := add(add(mutated, 0x20), mul(field, 0x20))
                mstore(fieldPtr, xor(mload(fieldPtr), 1))
            }
            assertTrue(keccak256(mutated) != proposalId, "one-field proposal sensitivity");
        }

        (AcquisitionAuthority tooLate,) = _authority();
        vm.warp(last + 1);
        Task2Ingress tooLateIngress = new Task2Ingress();
        vm.expectRevert(IAcquisitionAuthorityV2.TimestampOverflow.selector);
        vm.prank(address(safe));
        tooLate.proposeIngress(_config(address(tooLateIngress)), keccak256("too-late"));
    }

    function test_task2OperatorAndIngressCounterAndTimestampExhaustionAreAtomic() public {
        (AcquisitionAuthority authority,) = _authority();
        vm.store(address(authority), bytes32(uint256(8)), bytes32(type(uint256).max));
        vm.expectRevert(
            abi.encodeWithSelector(IAcquisitionAuthorityV2.CounterExhausted.selector, keccak256("nominationNonce"))
        );
        vm.prank(address(safe));
        authority.nominateMainOperator(address(0xBEEF), keccak256("nominate"));
        vm.store(address(authority), bytes32(uint256(8)), bytes32(0));
        vm.store(address(authority), bytes32(uint256(15)), bytes32(type(uint256).max));
        Task2Ingress ingress = new Task2Ingress();
        vm.expectRevert(
            abi.encodeWithSelector(IAcquisitionAuthorityV2.CounterExhausted.selector, keccak256("ingressProposalNonce"))
        );
        vm.prank(address(safe));
        authority.proposeIngress(_config(address(ingress)), keccak256("ingress"));
        vm.store(address(authority), bytes32(uint256(15)), bytes32(0));
        vm.prank(address(safe));
        bytes32 proposal = authority.proposeIngress(_config(address(ingress)), keccak256("generation"));
        IAcquisitionAuthorityV2.PendingIngressProposal memory pending = authority.pendingIngressProposal();
        vm.warp(pending.validAfter);
        vm.store(address(authority), bytes32(uint256(16)), bytes32(type(uint256).max));
        vm.expectRevert(
            abi.encodeWithSelector(IAcquisitionAuthorityV2.CounterExhausted.selector, keccak256("ingressGeneration"))
        );
        vm.prank(address(safe));
        authority.activateIngress(proposal);
        vm.prank(address(safe));
        authority.cancelIngressProposal(proposal, keccak256("cancel"));
        vm.store(address(authority), bytes32(uint256(16)), bytes32(0));
        vm.warp(type(uint64).max);
        vm.expectRevert(IAcquisitionAuthorityV2.TimestampOverflow.selector);
        vm.prank(address(safe));
        authority.proposeIngress(_config(address(ingress)), keccak256("late"));
    }

    function test_task2IngressProposalIdAndConfigHashBindEveryFieldAndFailuresDoNotConsumeNonce() public {
        bytes32[5] memory ids;
        for (uint8 field; field < 5; ++field) {
            (AcquisitionAuthority authority,) = _authority();
            Task2Ingress ingress = new Task2Ingress();
            IAcquisitionAuthorityV2.IngressConfig memory config = _config(address(ingress));
            if (field == 0) config.runtimeCodeHash = bytes32(uint256(config.runtimeCodeHash) ^ 1);
            else if (field == 1) config.perDepositCapWei = 2;
            else if (field == 2) config.epochDepositCapWei = 3;
            else if (field == 3) config.lifetimeDepositCapWei = 4;
            else config.ingress = address(new Task2Ingress());
            if (field == 0) {
                vm.expectRevert();
                vm.prank(address(safe));
                authority.proposeIngress(config, keccak256("details"));
                assertEq(authority.ingressProposalNonce(), 0);
                config = _config(address(ingress));
            }
            vm.prank(address(safe));
            ids[field] = authority.proposeIngress(config, keccak256("details"));
            assertTrue(authority.pendingIngressProposal().configHash != bytes32(0));
        }
        for (uint8 i = 1; i < ids.length; ++i) {
            assertTrue(ids[i] != ids[0]);
        }
    }

    function test_task2ActiveIngressAndDistinctPendingRotationCoexist() public {
        (AcquisitionAuthority authority,) = _authority();
        Task2Ingress first = new Task2Ingress();
        vm.prank(address(safe));
        bytes32 firstProposal = authority.proposeIngress(_config(address(first)), keccak256("first"));
        vm.warp(block.timestamp + authority.INGRESS_PROPOSAL_DELAY());
        vm.prank(address(safe));
        authority.activateIngress(firstProposal);
        Task2Ingress second = new Task2Ingress();
        vm.prank(address(safe));
        bytes32 secondProposal = authority.proposeIngress(_config(address(second)), keccak256("second"));
        vm.prank(address(safe));
        authority.disableIngress(keccak256("disable"));
        assertEq(authority.pendingIngressProposal().proposalId, secondProposal);
        assertEq(authority.activeIngressGeneration(), 0);
    }

    function test_task2IngressProposalAndActivationRecheckRoleCollisions() public {
        (AcquisitionAuthority authority,) = _authority();
        Task2Ingress ingress = new Task2Ingress();
        IAcquisitionAuthorityV2.IngressConfig memory config = _config(address(ingress));
        vm.store(address(authority), bytes32(uint256(2)), bytes32(uint256(uint160(address(ingress)))));
        vm.expectRevert(
            abi.encodeWithSelector(IAcquisitionAuthorityV2.RoleIdentityCollision.selector, address(ingress))
        );
        vm.prank(address(ingress));
        authority.proposeIngress(config, keccak256("collision"));
        vm.store(address(authority), bytes32(uint256(2)), bytes32(uint256(uint160(address(safe)))));
        vm.prank(address(safe));
        bytes32 proposal = authority.proposeIngress(config, keccak256("valid"));
        vm.warp(block.timestamp + authority.INGRESS_PROPOSAL_DELAY());
        vm.store(
            address(authority), bytes32(uint256(4)), bytes32(uint256(uint160(address(ingress))) | (uint256(1) << 160))
        );
        vm.expectRevert(
            abi.encodeWithSelector(IAcquisitionAuthorityV2.RoleIdentityCollision.selector, address(ingress))
        );
        vm.prank(address(safe));
        authority.activateIngress(proposal);
    }

    function test_task2PendingIngressBlocksReachableOwnershipAndOperatorTransitions() public {
        (AcquisitionAuthority authority,) = _authority();
        Task2Ingress ingress = new Task2Ingress();
        vm.prank(address(safe));
        bytes32 proposal = authority.proposeIngress(_config(address(ingress)), keccak256("pending"));
        bytes32 beforeHash = keccak256(abi.encode(authority.pendingIngressProposal()));

        vm.expectRevert(
            abi.encodeWithSelector(IAcquisitionAuthorityV2.RoleIdentityCollision.selector, address(ingress))
        );
        vm.prank(address(safe));
        authority.transferOwnership(address(ingress));
        assertEq(authority.pendingOwner(), address(0));
        assertEq(keccak256(abi.encode(authority.pendingIngressProposal())), beforeHash);

        vm.expectRevert(
            abi.encodeWithSelector(IAcquisitionAuthorityV2.RoleIdentityCollision.selector, address(ingress))
        );
        vm.prank(address(safe));
        authority.nominateMainOperator(address(ingress), keccak256("operator"));
        assertEq(authority.pendingMainOperatorNomination().proposalId, bytes32(0));
        assertEq(authority.pendingIngressProposal().proposalId, proposal);
        assertEq(keccak256(abi.encode(authority.pendingIngressProposal())), beforeHash);
    }

    function test_task2IngressProposalAndSyntheticActivationCollisionUniverse() public {
        (AcquisitionAuthority authority, AcquisitionConstellationFactory factory) = _authority();
        Task2Ingress pendingOwnerRole = new Task2Ingress();
        Task2Ingress operatorRole = new Task2Ingress();
        Task2Ingress nomineeRole = new Task2Ingress();
        Task2Ingress activeRole = new Task2Ingress();
        Task2Ingress pendingIngressRole = new Task2Ingress();
        bytes32 slot3 = bytes32(uint256(uint160(address(pendingOwnerRole))) | (uint256(1) << 160));
        bytes32 slot4 = bytes32(uint256(uint160(address(operatorRole))) | (uint256(1) << 160));
        vm.store(address(authority), bytes32(uint256(3)), slot3);
        vm.store(address(authority), bytes32(uint256(4)), slot4);
        vm.store(address(authority), bytes32(uint256(11)), bytes32(uint256(uint160(address(nomineeRole)))));
        vm.store(address(authority), bytes32(uint256(17)), bytes32(uint256(1)));
        bytes32 activeBase = _ingressBase(1);
        vm.store(address(authority), activeBase, bytes32(uint256(1)));
        vm.store(address(authority), bytes32(uint256(activeBase) + 1), bytes32(uint256(uint160(address(activeRole)))));
        vm.store(address(authority), bytes32(uint256(21)), bytes32(uint256(uint160(address(pendingIngressRole)))));
        (bool snapshotOk, bytes memory snapshot) =
            address(authority).staticcall(abi.encodeWithSelector(authority.authoritySnapshot.selector));
        assertTrue(snapshotOk);
        address[] memory candidates = new address[](14);
        candidates[0] = address(safe);
        candidates[1] = address(pendingOwnerRole);
        candidates[2] = address(operatorRole);
        candidates[3] = address(nomineeRole);
        candidates[4] = address(activeRole);
        candidates[5] = address(pendingIngressRole);
        candidates[6] = address(authority);
        candidates[7] = address(factory);
        candidates[8] = address(registry);
        for (uint8 i; i < 4; ++i) {
            candidates[i + 9] = address(uint160(_word(snapshot, i + 4)));
        }
        candidates[13] = address(uint160(_word(snapshot, 7)));
        for (uint256 i; i < candidates.length; ++i) {
            vm.expectRevert(
                abi.encodeWithSelector(IAcquisitionAuthorityV2.RoleIdentityCollision.selector, candidates[i])
            );
            vm.prank(address(safe));
            authority.proposeIngress(_config(candidates[i]), keccak256(abi.encode("collision", i)));
        }

        vm.store(address(authority), bytes32(uint256(17)), bytes32(0));
        vm.store(address(authority), bytes32(uint256(21)), bytes32(0));
        Task2Ingress clean = new Task2Ingress();
        vm.prank(address(safe));
        bytes32 proposal = authority.proposeIngress(_config(address(clean)), keccak256("clean"));
        IAcquisitionAuthorityV2.PendingIngressProposal memory pending = authority.pendingIngressProposal();
        vm.warp(pending.validAfter);
        for (uint256 i; i < candidates.length; ++i) {
            if (candidates[i] == address(pendingIngressRole) || candidates[i] == address(activeRole)) continue;
            vm.store(address(authority), bytes32(uint256(21)), bytes32(uint256(uint160(candidates[i]))));
            vm.store(address(authority), bytes32(uint256(22)), candidates[i].codehash);
            vm.expectRevert(
                abi.encodeWithSelector(IAcquisitionAuthorityV2.RoleIdentityCollision.selector, candidates[i])
            );
            vm.prank(address(safe));
            authority.activateIngress(proposal);
            assertEq(authority.pendingIngressProposal().proposalId, proposal);
        }
    }

    function test_task2PauseAuthorizationOrderingAndFailClosedUnpauseAreAtomic() public {
        (AcquisitionAuthority authority,) = _authority();
        _setPaused(authority, false);
        vm.prank(address(0xDEAD));
        vm.expectRevert(
            abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), address(0xDEAD))
        );
        authority.pause(bytes32(0));
        vm.prank(address(safe));
        vm.expectRevert(IAcquisitionAuthorityV2.EmptyDetailsHash.selector);
        authority.pause(bytes32(0));
        vm.prank(address(safe));
        authority.pause(keccak256("pause"));
        vm.prank(address(safe));
        vm.expectRevert(IAcquisitionAuthorityV2.EmptyDetailsHash.selector);
        authority.unpause(bytes32(0));
        vm.prank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.LocalReadinessFailed.selector, uint8(11)));
        authority.unpause(keccak256("unpause"));
        assertTrue(authority.paused());
    }

    function test_task2ForcedEtherIsInertAndNoReceiveOrFallbackExists() public {
        (AcquisitionAuthority authority,) = _authority();
        new Task2ForceEther{value: 3 ether}(payable(address(authority)));
        assertEq(address(authority).balance, 3 ether);
        assertTrue(authority.paused());
        (bool receiveOk,) = address(authority).call{value: 1}("");
        (bool fallbackOk,) = address(authority).call(hex"deadbeef");
        assertFalse(receiveOk);
        assertFalse(fallbackOk);
        assertEq(address(authority).balance, 3 ether);
    }

    function test_task2SizeBoundaryClassificationsAreExact() public pure {
        assertTrue(_runtimeAllowed(18_000));
        assertTrue(_runtimeAllowed(20_000));
        assertFalse(_runtimeAllowed(20_001));
        assertTrue(_initcodeAllowed(30_000));
        assertTrue(_initcodeAllowed(49_152));
        assertFalse(_initcodeAllowed(49_153));
    }

    function _nominate(AcquisitionAuthority authority, address nominee) internal returns (bytes32 proposal) {
        vm.prank(authority.owner());
        proposal = authority.nominateMainOperator(nominee, keccak256(abi.encode("nominate", nominee)));
    }

    function _installOperator(AcquisitionAuthority authority, address nominee) internal returns (address) {
        bytes32 proposal = _nominate(authority, nominee);
        vm.warp(block.timestamp + authority.OPERATOR_NOMINATION_DELAY());
        vm.prank(nominee);
        authority.acceptMainOperatorNomination(proposal);
        return nominee;
    }

    function _signedConsent(AcquisitionAuthority authority, address operator, uint256 successorKey)
        internal
        returns (IAcquisitionAuthorityV2.SuccessorConsent memory consent, bytes memory signature)
    {
        consent = IAcquisitionAuthorityV2.SuccessorConsent({
            currentOperator: operator,
            successor: vm.addr(successorKey),
            generation: authority.operatorGeneration(),
            outflowNonce: authority.outflowNonce(),
            issuedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            reasonCode: uint8(IAcquisitionAuthorityV2.ReasonCode.OPERATOR_REPLACED),
            detailsHash: keccak256("replace")
        });
        bytes32 digest = authority.hashSuccessorConsent(consent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(successorKey, digest);
        signature = abi.encodePacked(r, s, v);
    }

    function _walletConsent(AcquisitionAuthority authority, address operator, address wallet)
        internal
        view
        returns (IAcquisitionAuthorityV2.SuccessorConsent memory)
    {
        return IAcquisitionAuthorityV2.SuccessorConsent({
            currentOperator: operator,
            successor: wallet,
            generation: authority.operatorGeneration(),
            outflowNonce: authority.outflowNonce(),
            issuedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            reasonCode: uint8(IAcquisitionAuthorityV2.ReasonCode.OPERATOR_REPLACED),
            detailsHash: keccak256("wallet-replace")
        });
    }

    function _config(address ingress) internal view returns (IAcquisitionAuthorityV2.IngressConfig memory) {
        return IAcquisitionAuthorityV2.IngressConfig(ingress, ingress.codehash, 1, 2, 3);
    }

    function _setPaused(AcquisitionAuthority authority, bool value) internal {
        bytes32 current = vm.load(address(authority), bytes32(uint256(3)));
        uint256 cleared = uint256(current) & ~(uint256(0xff) << 160);
        vm.store(address(authority), bytes32(uint256(3)), bytes32(cleared | (value ? uint256(1) << 160 : 0)));
    }

    function _corruptInitialField(AcquisitionAuthority authority, uint8 field) internal {
        bytes32 one = bytes32(uint256(1));
        if (field == 9) vm.store(address(authority), bytes32(uint256(2)), bytes32(uint256(uint160(address(1)))));
        else if (field == 10) vm.store(address(authority), bytes32(uint256(3)), one);
        else if (field == 11) _setPaused(authority, false);
        else if (field == 12) vm.store(address(authority), bytes32(uint256(4)), one);
        else if (field == 13) vm.store(address(authority), bytes32(uint256(11)), one);
        else if (field == 14) vm.store(address(authority), bytes32(uint256(5)), one);
        else if (field == 15) vm.store(address(authority), bytes32(uint256(6)), one);
        else if (field == 16) vm.store(address(authority), bytes32(uint256(7)), one);
        else if (field == 17) vm.store(address(authority), bytes32(uint256(16)), one);
        else if (field == 18) vm.store(address(authority), bytes32(uint256(17)), one);
        else if (field == 19) vm.store(address(authority), bytes32(uint256(_ingressBase(0)) + 1), one);
        else if (field == 20) vm.store(address(authority), bytes32(uint256(_ingressBase(0)) + 2), one);
        else if (field == 21) vm.store(address(authority), bytes32(uint256(21)), one);
        else if (field == 22) vm.store(address(authority), bytes32(uint256(26)), one);
        else if (field == 23) vm.store(address(authority), bytes32(uint256(8)), one);
        else if (field == 24) vm.store(address(authority), bytes32(uint256(9)), one);
        else if (field == 25) vm.store(address(authority), bytes32(uint256(15)), one);
        else if (field == 26) vm.store(address(authority), bytes32(uint256(18)), one);
    }

    function _ingressBase(uint256 generation) internal pure returns (bytes32) {
        return keccak256(abi.encode(generation, uint256(29)));
    }

    function _contains(bytes memory haystack, bytes memory needle) internal pure returns (bool) {
        if (needle.length == 0 || needle.length > haystack.length) return false;
        for (uint256 i; i <= haystack.length - needle.length; ++i) {
            bool match_ = true;
            for (uint256 j; j < needle.length; ++j) {
                if (haystack[i + j] != needle[j]) {
                    match_ = false;
                    break;
                }
            }
            if (match_) return true;
        }
        return false;
    }

    function _runtimeAllowed(uint256 size) internal pure returns (bool) {
        return size <= 20_000;
    }

    function _initcodeAllowed(uint256 size) internal pure returns (bool) {
        return size <= 49_152;
    }

    function _raw(address target, bytes4 selector, bytes memory arguments) internal view returns (bytes memory result) {
        (bool ok, bytes memory data) = target.staticcall(bytes.concat(selector, arguments));
        assertTrue(ok);
        return data;
    }

    function _onlyLog(Vm.Log[] memory logs, bytes32 topic, address emitter)
        internal
        pure
        returns (Vm.Log memory found)
    {
        uint256 matches;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == emitter && logs[i].topics[0] == topic) {
                found = logs[i];
                ++matches;
            }
        }
        assertEq(matches, 1);
    }

    function _word(bytes memory data, uint256 index) internal pure returns (uint256 value) {
        assembly {
            value := mload(add(add(data, 0x20), mul(index, 0x20)))
        }
    }

    function _snapshotType(uint256 index) internal pure returns (string memory) {
        if (index == 0 || (index >= 14 && index <= 18) || index == 23 || index == 25) return "uint256";
        if (index == 2 || index == 20 || index == 22 || index == 24 || index == 26) return "bytes32";
        if (index == 8 || index == 11) return "bool";
        return "address";
    }
}
