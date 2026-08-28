// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IRwaHealthOverlay} from "../src/interfaces/IRwaHealthOverlay.sol";
import {RwaHealthOverlayTestBase} from "./utils/RwaHealthOverlayTestBase.sol";

contract RwaHealthOverlayFuzzTest is RwaHealthOverlayTestBase {
    function testFuzz_validClosedIntegerDomainRecordsExactlyOne(
        uint256 episodeGeneration,
        uint64 stateSequence,
        uint8 severity,
        uint64 approvedAt
    ) external {
        episodeGeneration = bound(episodeGeneration, 1, type(uint256).max);
        stateSequence = uint64(bound(stateSequence, 1, uint64(type(int64).max)));
        severity = uint8(bound(severity, 1, 2));
        approvedAt = uint64(bound(approvedAt, 1, type(uint64).max - TTL));
        vm.warp(approvedAt);

        IRwaHealthOverlay.Clearance memory value = _validClearance();
        value.episodeGeneration = episodeGeneration;
        value.stateSequence = stateSequence;
        value.currentSeverity = severity;
        value.approvedAt = approvedAt;
        value.clearanceDeadline = approvedAt + TTL;

        bytes32 id = _record(value);
        assertEq(overlay.clearanceGeneration(assetVersionKey), 1);
        assertEq(overlay.latestClearanceId(assetVersionKey), id);
        assertTrue(overlay.usedClearanceId(id));
    }

    function testFuzz_allIntegerBoundaryCombinationsRecord(uint8 boundaryMask) external {
        uint64 approvedAt = boundaryMask & 8 == 0 ? 0 : type(uint64).max - TTL;
        vm.warp(approvedAt);
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        value.episodeGeneration = boundaryMask & 1 == 0 ? 1 : type(uint256).max;
        value.stateSequence = boundaryMask & 2 == 0 ? 1 : uint64(type(int64).max);
        value.currentSeverity = boundaryMask & 4 == 0 ? 1 : 2;
        value.approvedAt = approvedAt;
        value.clearanceDeadline = approvedAt + TTL;

        bytes32 id = _record(value);
        assertEq(overlay.clearanceGeneration(assetVersionKey), 1);
        assertEq(overlay.latestClearanceId(assetVersionKey), id);
        assertTrue(overlay.usedClearanceId(id));
    }

    function testFuzz_stateSequenceOutsideSignedBigintDomainAlwaysRejects(uint64 sequence) external {
        sequence = uint64(bound(sequence, uint256(uint64(type(int64).max)) + 1, type(uint64).max));
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        value.stateSequence = sequence;
        _expectSafeReject(value);
    }

    function testFuzz_wrongCallerNeverChangesStorage(address caller) external {
        vm.assume(caller != address(safe));
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        bytes32 id = overlay.clearanceId(value);
        vm.prank(caller);
        vm.expectRevert();
        overlay.recordClearance(value);
        _assertEmpty(assetVersionKey);
        assertFalse(overlay.usedClearanceId(id));
    }

    function testFuzz_anyNonzeroTtlMutationRejects(uint32 delta, bool add) external {
        delta = uint32(bound(delta, 1, type(uint32).max));
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        if (add) {
            value.clearanceDeadline += delta;
        } else if (delta < value.clearanceDeadline) {
            value.clearanceDeadline -= delta;
        } else {
            value.clearanceDeadline = 0;
        }
        _expectSafeReject(value);
    }

    function testFuzz_halfOpenWindowAcceptsBeforeAndRejectsAtDeadline(uint32 elapsed) external {
        elapsed = uint32(bound(elapsed, 0, TTL));
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        vm.warp(uint256(value.approvedAt) + elapsed);
        if (elapsed < TTL) {
            assertNotEq(_record(value), bytes32(0));
        } else {
            _expectSafeReject(value);
        }
    }

    function testFuzz_everySingleFieldMutationChangesAllThreeCanonicalIdentities(uint8 field, bytes32 entropy)
        external
        view
    {
        field = uint8(bound(field, 0, 15));
        if (entropy == bytes32(0)) entropy = bytes32(uint256(1));
        IRwaHealthOverlay.Clearance memory beforeValue = _validClearance();
        IRwaHealthOverlay.Clearance memory afterValue = _validClearance();

        if (field == 0) {
            afterValue.catalogSnapshotHash = _different(beforeValue.catalogSnapshotHash, entropy);
        } else if (field == 1) {
            afterValue.assetVersionKey = _different(beforeValue.assetVersionKey, entropy);
        } else if (field == 2) {
            afterValue.activationGeneration = _different(beforeValue.activationGeneration, entropy);
        } else if (field == 3) {
            afterValue.episodeId = _different(beforeValue.episodeId, entropy);
        } else if (field == 4) {
            afterValue.episodeGeneration = _different(beforeValue.episodeGeneration, entropy);
        } else if (field == 5) {
            afterValue.currentSeverity = beforeValue.currentSeverity == 1 ? 2 : 1;
        } else if (field == 6) {
            afterValue.stateSequence = beforeValue.stateSequence == 1 ? 2 : 1;
        } else if (field == 7) {
            afterValue.latestEpisodeEventId = _different(beforeValue.latestEpisodeEventId, entropy);
        } else if (field == 8) {
            afterValue.latestMaterialEvidenceHash = _different(beforeValue.latestMaterialEvidenceHash, entropy);
        } else if (field == 9) {
            afterValue.recoveryEvidenceHash = _different(beforeValue.recoveryEvidenceHash, entropy);
        } else if (field == 10) {
            afterValue.freshHealthyEvaluationId = _different(beforeValue.freshHealthyEvaluationId, entropy);
        } else if (field == 11) {
            afterValue.freshHealthyEvidenceHash = _different(beforeValue.freshHealthyEvidenceHash, entropy);
        } else if (field == 12) {
            afterValue.reviewerIdHash = _different(beforeValue.reviewerIdHash, entropy);
        } else if (field == 13) {
            afterValue.approvedAt += 1;
        } else if (field == 14) {
            afterValue.clearanceDeadline += 1;
        } else {
            afterValue.expectedOverlayGeneration += 1;
        }

        assertNotEq(overlay.clearancePayloadHash(beforeValue), overlay.clearancePayloadHash(afterValue));
        assertNotEq(overlay.safeCallIntentHash(beforeValue), overlay.safeCallIntentHash(afterValue));
        assertNotEq(overlay.clearanceId(beforeValue), overlay.clearanceId(afterValue));
    }

    function _different(bytes32 original, bytes32 entropy) private pure returns (bytes32 changed) {
        changed = keccak256(abi.encode(original, entropy));
        if (changed == original || changed == bytes32(0)) changed = bytes32(uint256(original) ^ 1);
        if (changed == bytes32(0)) changed = bytes32(uint256(1));
    }

    function _different(uint256 original, bytes32 entropy) private pure returns (uint256 changed) {
        changed = uint256(keccak256(abi.encode(original, entropy)));
        if (changed == original) changed = original == type(uint256).max ? original - 1 : original + 1;
    }
}
