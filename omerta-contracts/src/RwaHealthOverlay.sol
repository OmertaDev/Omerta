// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IRwaHealthOverlay} from "./interfaces/IRwaHealthOverlay.sol";
import {IStockTokenRegistryV2} from "./interfaces/IStockTokenRegistryV2.sol";

contract RwaHealthOverlay is IRwaHealthOverlay {
    uint256 public constant override supportedChainId = 4663;
    uint256 private constant _CLEARANCE_TTL = 7 days;
    uint64 private constant _MAX_STATE_SEQUENCE = uint64(type(int64).max);

    bytes32 private constant _PAYLOAD_TAG = keccak256("OMERTA_RWA_HEALTH_CLEARANCE_PAYLOAD_V2");
    bytes32 private constant _CALL_INTENT_TAG = keccak256("OMERTA_RWA_HEALTH_SAFE_CALL_INTENT_V2");
    bytes32 private constant _ATTESTATION_TAG = keccak256("OMERTA_RWA_HEALTH_CLEARANCE_ATTESTATION_V2");

    address public immutable override SAFE;
    IStockTokenRegistryV2 public immutable override REGISTRY;

    mapping(bytes32 assetVersionKey => uint256 generation) public override clearanceGeneration;
    mapping(bytes32 assetVersionKey => bytes32 clearanceId_) public override latestClearanceId;
    mapping(bytes32 clearanceId_ => bool used) public override usedClearanceId;

    constructor(address safe_, IStockTokenRegistryV2 registry_) {
        if (block.chainid != supportedChainId) revert();
        if (safe_ == address(0) || safe_.code.length == 0) revert();
        if (address(registry_) == address(0) || address(registry_).code.length == 0) revert();
        if (registry_.supportedChainId() != supportedChainId) revert();

        SAFE = safe_;
        REGISTRY = registry_;
    }

    function clearancePayloadHash(Clearance calldata value) external view override returns (bytes32) {
        return _clearancePayloadHash(value);
    }

    function safeCallIntentHash(Clearance calldata value) external view override returns (bytes32) {
        return _safeCallIntentHash(value);
    }

    function clearanceId(Clearance calldata value) external view override returns (bytes32) {
        return _clearanceId(value, _safeCallIntentHash(value));
    }

    function recordClearance(Clearance calldata value) external override returns (bytes32 clearanceId_) {
        if (msg.sender != SAFE) revert();
        _validateLocal(value);
        _validateRegistry(value);

        bytes32 payloadHash = _clearancePayloadHash(value);
        bytes32 callIntentHash = _safeCallIntentHash(value);
        clearanceId_ = _clearanceId(value, callIntentHash);
        if (usedClearanceId[clearanceId_]) revert();

        usedClearanceId[clearanceId_] = true;
        clearanceGeneration[value.assetVersionKey] = value.expectedOverlayGeneration;
        latestClearanceId[value.assetVersionKey] = clearanceId_;

        emit ClearanceApplied(
            clearanceId_,
            value.assetVersionKey,
            value.expectedOverlayGeneration,
            address(REGISTRY),
            value.activationGeneration,
            value.catalogSnapshotHash,
            value.episodeId,
            value.episodeGeneration,
            value.currentSeverity,
            value.stateSequence,
            value.latestEpisodeEventId,
            value.latestMaterialEvidenceHash,
            value.recoveryEvidenceHash,
            value.freshHealthyEvaluationId,
            value.freshHealthyEvidenceHash,
            value.reviewerIdHash,
            payloadHash,
            callIntentHash,
            value.approvedAt,
            value.clearanceDeadline
        );
    }

    function _validateLocal(Clearance calldata value) private view {
        if (block.chainid != supportedChainId) revert();
        if (address(REGISTRY).code.length == 0 || REGISTRY.supportedChainId() != supportedChainId) revert();
        if (
            value.catalogSnapshotHash == bytes32(0) || value.assetVersionKey == bytes32(0)
                || value.episodeId == bytes32(0) || value.latestEpisodeEventId == bytes32(0)
                || value.latestMaterialEvidenceHash == bytes32(0) || value.recoveryEvidenceHash == bytes32(0)
                || value.freshHealthyEvaluationId == bytes32(0) || value.freshHealthyEvidenceHash == bytes32(0)
                || value.reviewerIdHash == bytes32(0)
        ) revert();
        if (
            value.activationGeneration == 0 || value.episodeGeneration == 0 || value.expectedOverlayGeneration == 0
                || value.stateSequence == 0 || value.stateSequence > _MAX_STATE_SEQUENCE
                || (value.currentSeverity != 1 && value.currentSeverity != 2)
        ) revert();
        if (uint256(value.approvedAt) + _CLEARANCE_TTL != uint256(value.clearanceDeadline)) revert();
        if (block.timestamp < value.approvedAt || block.timestamp >= value.clearanceDeadline) revert();

        uint256 currentGeneration = clearanceGeneration[value.assetVersionKey];
        if (currentGeneration == type(uint256).max || value.expectedOverlayGeneration != currentGeneration + 1) {
            revert();
        }
    }

    function _validateRegistry(Clearance calldata value) private view {
        if (REGISTRY.activationGeneration(value.assetVersionKey) != value.activationGeneration) revert();
        IStockTokenRegistryV2.AssetVersion memory version = REGISTRY.getVersion(value.assetVersionKey);
        if (version.chainId != supportedChainId || !version.active) revert();
        if (REGISTRY.activeVersionForTickerHash(version.tickerHash) != value.assetVersionKey) revert();
        if (REGISTRY.activeVersionForToken(version.token) != value.assetVersionKey) revert();
        if (REGISTRY.activeVersionForProviderIdHash(version.robinhoodAssetIdHash) != value.assetVersionKey) revert();
    }

    function _clearancePayloadHash(Clearance calldata value) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                _PAYLOAD_TAG,
                block.chainid,
                address(REGISTRY),
                address(this),
                value.catalogSnapshotHash,
                value.assetVersionKey,
                value.activationGeneration,
                value.episodeId,
                value.episodeGeneration,
                value.currentSeverity,
                value.stateSequence,
                value.latestEpisodeEventId,
                value.latestMaterialEvidenceHash,
                value.recoveryEvidenceHash,
                value.freshHealthyEvaluationId,
                value.freshHealthyEvidenceHash,
                value.reviewerIdHash,
                value.approvedAt,
                value.clearanceDeadline,
                value.expectedOverlayGeneration
            )
        );
    }

    function _safeCallIntentHash(Clearance calldata value) private view returns (bytes32) {
        bytes32 calldataHash = keccak256(abi.encodeWithSelector(IRwaHealthOverlay.recordClearance.selector, value));
        return keccak256(
            abi.encode(
                _CALL_INTENT_TAG,
                block.chainid,
                SAFE,
                address(this),
                uint256(0),
                uint8(0),
                IRwaHealthOverlay.recordClearance.selector,
                calldataHash
            )
        );
    }

    function _clearanceId(Clearance calldata value, bytes32 callIntentHash) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                _ATTESTATION_TAG,
                block.chainid,
                address(REGISTRY),
                value.catalogSnapshotHash,
                value.assetVersionKey,
                value.activationGeneration,
                value.episodeId,
                value.episodeGeneration,
                value.currentSeverity,
                value.stateSequence,
                value.latestEpisodeEventId,
                value.latestMaterialEvidenceHash,
                value.recoveryEvidenceHash,
                value.freshHealthyEvaluationId,
                value.freshHealthyEvidenceHash,
                value.reviewerIdHash,
                value.approvedAt,
                value.clearanceDeadline,
                value.expectedOverlayGeneration,
                callIntentHash
            )
        );
    }
}
