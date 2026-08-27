// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AcquisitionConstellationTask1Test} from "./AcquisitionConstellationTask1.t.sol";
import {AcquisitionConstellationFactory} from "../src/AcquisitionConstellationFactory.sol";
import {AcquisitionAuthority} from "../src/AcquisitionAuthority.sol";
import {IAcquisitionAuthorityV2} from "../src/interfaces/IAcquisitionAuthorityV2.sol";
import {Vm} from "forge-std/Vm.sol";

contract Task2SafeCandidate {}

contract Task2Ingress {}

contract Task2ForceEther {
    constructor(address payable target) payable {
        selfdestruct(target);
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
        assertEq(runtime.length, 16_061);
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
        assertEq((vm.parseJsonBytes(artifact, ".bytecode.object")).length, 18_622);
        assertEq((vm.parseJsonBytes(artifact, ".deployedBytecode.object")).length, 16_061);
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
        assertTrue(_contains(source, bytes("mstore(0, selector)")));
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

    function test_task2EoaSignatureLengthAndMalleabilityFailuresCollapse() public {
        (AcquisitionAuthority authority,) = _authority();
        address operator = _installOperator(authority, address(0xBEEF));
        (IAcquisitionAuthorityV2.SuccessorConsent memory consent,) = _signedConsent(authority, operator, 0xA11CE);
        bytes[3] memory invalid = [bytes(""), new bytes(64), new bytes(66)];
        for (uint256 i; i < invalid.length; ++i) {
            vm.prank(operator);
            vm.expectRevert(IAcquisitionAuthorityV2.InvalidSignature.selector);
            authority.replaceMainOperator(consent, invalid[i]);
        }
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
