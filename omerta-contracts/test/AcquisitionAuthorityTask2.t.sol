// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AcquisitionConstellationTask1Test} from "./AcquisitionConstellationTask1.t.sol";
import {AcquisitionConstellationFactory} from "../src/AcquisitionConstellationFactory.sol";
import {AcquisitionAuthority} from "../src/AcquisitionAuthority.sol";
import {IAcquisitionAuthorityV2} from "../src/interfaces/IAcquisitionAuthorityV2.sol";
import {Vm} from "forge-std/Vm.sol";

contract Task2SafeCandidate {}

contract Task2Ingress {}

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
        assertEq(runtime.length, 15_935);
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
