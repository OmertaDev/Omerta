// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IStockTokenRegistryV2} from "./IStockTokenRegistryV2.sol";

interface IRwaHealthOverlay {
    struct Clearance {
        bytes32 catalogSnapshotHash;
        bytes32 assetVersionKey;
        uint256 activationGeneration;
        bytes32 episodeId;
        uint256 episodeGeneration;
        uint8 currentSeverity;
        uint64 stateSequence;
        bytes32 latestEpisodeEventId;
        bytes32 latestMaterialEvidenceHash;
        bytes32 recoveryEvidenceHash;
        bytes32 freshHealthyEvaluationId;
        bytes32 freshHealthyEvidenceHash;
        bytes32 reviewerIdHash;
        uint64 approvedAt;
        uint64 clearanceDeadline;
        uint256 expectedOverlayGeneration;
    }

    event ClearanceApplied(
        bytes32 indexed clearanceId,
        bytes32 indexed assetVersionKey,
        uint256 indexed overlayGeneration,
        address registryAddress,
        uint256 activationGeneration,
        bytes32 catalogSnapshotHash,
        bytes32 episodeId,
        uint256 episodeGeneration,
        uint8 currentSeverity,
        uint64 stateSequence,
        bytes32 latestEpisodeEventId,
        bytes32 latestMaterialEvidenceHash,
        bytes32 recoveryEvidenceHash,
        bytes32 freshHealthyEvaluationId,
        bytes32 freshHealthyEvidenceHash,
        bytes32 reviewerIdHash,
        bytes32 clearancePayloadHash,
        bytes32 safeCallIntentHash,
        uint64 approvedAt,
        uint64 clearanceDeadline
    );

    function supportedChainId() external view returns (uint256);
    function SAFE() external view returns (address);
    function REGISTRY() external view returns (IStockTokenRegistryV2);
    function clearanceGeneration(bytes32 assetVersionKey) external view returns (uint256 generation);
    function latestClearanceId(bytes32 assetVersionKey) external view returns (bytes32 clearanceId_);
    function usedClearanceId(bytes32 clearanceId_) external view returns (bool used);

    function clearancePayloadHash(Clearance calldata value) external view returns (bytes32);
    function safeCallIntentHash(Clearance calldata value) external view returns (bytes32);
    function clearanceId(Clearance calldata value) external view returns (bytes32);
    function recordClearance(Clearance calldata value) external returns (bytes32 clearanceId_);
}
