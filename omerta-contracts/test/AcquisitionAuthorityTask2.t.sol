// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AcquisitionConstellationTask1Test} from "./AcquisitionConstellationTask1.t.sol";
import {AcquisitionConstellationFactory} from "../src/AcquisitionConstellationFactory.sol";
import {AcquisitionAuthority} from "../src/AcquisitionAuthority.sol";
import {IAcquisitionAuthorityV2} from "../src/interfaces/IAcquisitionAuthorityV2.sol";

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
        assertEq(runtime.length, 19_998);
    }

    function test_task2SnapshotIsFixed864BytesAndColdBelowCap() public {
        (AcquisitionAuthority authority,) = _authority();
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) =
            address(authority).staticcall(abi.encodeWithSelector(AcquisitionAuthority.authoritySnapshot.selector));
        uint256 used = beforeGas - gasleft();
        assertTrue(ok);
        assertEq(result.length, 864);
        assertLe(used, 160_000);
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
        AcquisitionAuthority.AuthoritySnapshot memory snapshot = authority.authoritySnapshot();
        bytes32 structHash = keccak256(
            abi.encode(
                authority.SUCCESSOR_CONSENT_TYPEHASH(),
                address(authority),
                snapshot.core,
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
}
