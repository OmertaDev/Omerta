import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbi,
  toBytes,
} from 'viem';

const vector = JSON.parse(await readFile(
  new URL('./fixtures/rwa-health-overlay-v2-vectors.json', import.meta.url),
  'utf8',
));

const CLEARANCE_KEYS = [
  'catalogSnapshotHash',
  'assetVersionKey',
  'activationGeneration',
  'episodeId',
  'episodeGeneration',
  'currentSeverity',
  'stateSequence',
  'latestEpisodeEventId',
  'latestMaterialEvidenceHash',
  'recoveryEvidenceHash',
  'freshHealthyEvaluationId',
  'freshHealthyEvidenceHash',
  'reviewerIdHash',
  'approvedAt',
  'clearanceDeadline',
  'expectedOverlayGeneration',
];

assert.deepEqual(Object.keys(vector.clearance), CLEARANCE_KEYS, 'the frozen Solidity tuple order drifted');

const clearance = {
  catalogSnapshotHash: vector.clearance.catalogSnapshotHash,
  assetVersionKey: vector.clearance.assetVersionKey,
  activationGeneration: BigInt(vector.clearance.activationGeneration),
  episodeId: vector.clearance.episodeId,
  episodeGeneration: BigInt(vector.clearance.episodeGeneration),
  currentSeverity: Number(vector.clearance.currentSeverity),
  stateSequence: BigInt(vector.clearance.stateSequence),
  latestEpisodeEventId: vector.clearance.latestEpisodeEventId,
  latestMaterialEvidenceHash: vector.clearance.latestMaterialEvidenceHash,
  recoveryEvidenceHash: vector.clearance.recoveryEvidenceHash,
  freshHealthyEvaluationId: vector.clearance.freshHealthyEvaluationId,
  freshHealthyEvidenceHash: vector.clearance.freshHealthyEvidenceHash,
  reviewerIdHash: vector.clearance.reviewerIdHash,
  approvedAt: BigInt(vector.clearance.approvedAt),
  clearanceDeadline: BigInt(vector.clearance.clearanceDeadline),
  expectedOverlayGeneration: BigInt(vector.clearance.expectedOverlayGeneration),
};

const abi = parseAbi([
  'function recordClearance((bytes32 catalogSnapshotHash,bytes32 assetVersionKey,uint256 activationGeneration,bytes32 episodeId,uint256 episodeGeneration,uint8 currentSeverity,uint64 stateSequence,bytes32 latestEpisodeEventId,bytes32 latestMaterialEvidenceHash,bytes32 recoveryEvidenceHash,bytes32 freshHealthyEvaluationId,bytes32 freshHealthyEvidenceHash,bytes32 reviewerIdHash,uint64 approvedAt,uint64 clearanceDeadline,uint256 expectedOverlayGeneration) value) returns (bytes32 clearanceId_)',
]);
const calldata = encodeFunctionData({ abi, functionName: 'recordClearance', args: [clearance] });
assert.equal(calldata.slice(0, 10), vector.outputs.recordClearanceSelector);
assert.equal(calldata, vector.outputs.calldata);
assert.equal(keccak256(calldata), vector.outputs.calldataHash);
assert.equal(
  keccak256(toBytes('ClearanceApplied(bytes32,bytes32,uint256,address,uint256,bytes32,bytes32,uint256,uint8,uint64,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint64,uint64)')),
  vector.outputs.clearanceAppliedTopic,
);

const reviewerIdHash = keccak256(encodeAbiParameters(
  [{ type: 'bytes32' }, { type: 'bytes32' }],
  [
    keccak256(toBytes('OMERTA_RWA_HEALTH_REVIEWER_V2')),
    keccak256(toBytes(vector.reviewerId)),
  ],
));
const recoveryEvidenceHash = keccak256(Buffer.from(vector.recoveryEvidenceBase64url, 'base64url'));
assert.equal(reviewerIdHash, vector.outputs.reviewerIdHash);
assert.equal(reviewerIdHash, clearance.reviewerIdHash);
assert.equal(recoveryEvidenceHash, vector.outputs.recoveryEvidenceHash);
assert.equal(recoveryEvidenceHash, clearance.recoveryEvidenceHash);

const payloadHash = keccak256(encodeAbiParameters(
  [
    { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'address' },
    { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'bytes32' },
    { type: 'uint256' }, { type: 'uint8' }, { type: 'uint64' }, { type: 'bytes32' },
    { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' },
    { type: 'bytes32' }, { type: 'uint64' }, { type: 'uint64' }, { type: 'uint256' },
  ],
  [
    keccak256(toBytes('OMERTA_RWA_HEALTH_CLEARANCE_PAYLOAD_V2')),
    BigInt(vector.chainId),
    vector.registryAddress,
    vector.overlayAddress,
    ...Object.values(clearance),
  ],
));
assert.equal(payloadHash, vector.outputs.clearancePayloadHash);

const safeCallIntentHash = keccak256(encodeAbiParameters(
  [
    { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'address' },
    { type: 'uint256' }, { type: 'uint8' }, { type: 'bytes4' }, { type: 'bytes32' },
  ],
  [
    keccak256(toBytes('OMERTA_RWA_HEALTH_SAFE_CALL_INTENT_V2')),
    BigInt(vector.chainId),
    vector.safeAddress,
    vector.overlayAddress,
    0n,
    0,
    vector.outputs.recordClearanceSelector,
    vector.outputs.calldataHash,
  ],
));
assert.equal(safeCallIntentHash, vector.outputs.safeCallIntentHash);

const clearanceId = keccak256(encodeAbiParameters(
  [
    { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' },
    { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'bytes32' },
    { type: 'uint256' }, { type: 'uint8' }, { type: 'uint64' }, { type: 'bytes32' },
    { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' },
    { type: 'bytes32' }, { type: 'uint64' }, { type: 'uint64' }, { type: 'uint256' },
    { type: 'bytes32' },
  ],
  [
    keccak256(toBytes('OMERTA_RWA_HEALTH_CLEARANCE_ATTESTATION_V2')),
    BigInt(vector.chainId),
    vector.registryAddress,
    ...Object.values(clearance),
    safeCallIntentHash,
  ],
));
assert.equal(clearanceId, vector.outputs.clearanceId);

console.log('rwa health overlay cross-language vector passed');
