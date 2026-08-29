import {
  encodeAbiParameters, encodeFunctionData, getAddress, keccak256, parseAbi, toBytes,
} from 'viem';

import { dbCaps } from './db.js';
import { RWA_HEALTH_ERROR_CODES, RwaHealthError } from './rwahealtherror.js';
import { readRwaHealthClearanceContext, requireFreshRwaHealth } from './rwahealthread.js';
import {
  readRwaHealthOverlayAuthoringContextV2, RwaHealthOverlayError,
} from './rwahealthoverlay.js';
import { requireFinalizedRwaActivationV2 } from './rwaregistrylifecycle.js';

const CHAIN_ID = '4663';
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const ZERO_HASH = `0x${'0'.repeat(64)}`;
const UINT64_MAX = (1n << 64n) - 1n;
const UINT256_MAX = (1n << 256n) - 1n;
const INT63_MAX = (1n << 63n) - 1n;
const CLEARANCE_TTL_SECONDS = 604800n;
const RETENTION_SECONDS = 35n * 86400n;
const MAX_RECOVERY_BYTES = 65536;
const MAX_HEALTHY_SEQUENCE = 2048n;
const MAX_EXPIRE_BATCH = 100;

const CREATE_BODY_KEYS = Object.freeze([
  'recoveryEvidenceBase64url', 'expectedCatalogSnapshotHash',
  'expectedEpisodeGeneration', 'expectedCurrentSeverity', 'expectedStateSequence',
  'expectedEpisodeEventId', 'expectedMaterialEvidenceHash', 'expectedEvaluationId',
  'expectedEvaluationEvidenceHash', 'expectedActivationGeneration',
  'expectedOverlayGeneration', 'expectedSafeNonce',
]);
const CREATE_REQUEST_KEYS = Object.freeze(['assetVersionKey', ...CREATE_BODY_KEYS]);
const SUBMISSION_BODY_KEYS = Object.freeze(['safeTransactionHash']);
const SUBMISSION_REQUEST_KEYS = Object.freeze([
  'assetVersionKey', 'clearanceId', 'safeTransactionHash',
]);
const READ_REQUEST_KEYS = Object.freeze(['assetVersionKey', 'clearanceId']);
const ACTOR_KEYS = Object.freeze(['reviewerId', 'transportKeyHash']);
const OPEN_STATUSES = Object.freeze(['safe_package_ready', 'safe_submitted']);
const ALL_STATUSES = Object.freeze([
  ...OPEN_STATUSES, 'approval_stale', 'finalized_applied', 'finalized_rejected',
]);

const CREATE_REQUESTS = new WeakSet();
const SUBMISSION_REQUESTS = new WeakSet();
const READ_REQUESTS = new WeakSet();

const CLEARANCE_ABI = parseAbi([
  'function recordClearance((bytes32 catalogSnapshotHash,bytes32 assetVersionKey,uint256 activationGeneration,bytes32 episodeId,uint256 episodeGeneration,uint8 currentSeverity,uint64 stateSequence,bytes32 latestEpisodeEventId,bytes32 latestMaterialEvidenceHash,bytes32 recoveryEvidenceHash,bytes32 freshHealthyEvaluationId,bytes32 freshHealthyEvidenceHash,bytes32 reviewerIdHash,uint64 approvedAt,uint64 clearanceDeadline,uint256 expectedOverlayGeneration) value) returns (bytes32 clearanceId_)',
]);

const PAYLOAD_TAG = keccak256(toBytes('OMERTA_RWA_HEALTH_CLEARANCE_PAYLOAD_V2'));
const CALL_INTENT_TAG = keccak256(toBytes('OMERTA_RWA_HEALTH_SAFE_CALL_INTENT_V2'));
const CLEARANCE_TAG = keccak256(toBytes('OMERTA_RWA_HEALTH_CLEARANCE_ATTESTATION_V2'));
const REVIEWER_TAG = keccak256(toBytes('OMERTA_RWA_HEALTH_REVIEWER_V2'));
const SEMANTIC_TAG = keccak256(toBytes('OMERTA_RWA_HEALTH_CLEARANCE_SEMANTIC_REQUEST_V2'));

const DEFAULT_DEPENDENCIES = Object.freeze({
  requireFreshRwaHealth,
  readRwaHealthClearanceContext,
  requireFinalizedRwaActivationV2,
  readRwaHealthOverlayAuthoringContextV2,
});

const ACTIVATION_ERROR_CODES = new Set([
  'rwa_activation_generation_stale', 'rwa_activation_halted', 'rwa_activation_head_changed',
  'rwa_activation_input', 'rwa_activation_not_authoritative', 'rwa_activation_not_ready',
  'rwa_activation_state_malformed', 'rwa_activation_task5_mismatch',
  'rwa_activation_unconfigured', 'rwa_lifecycle_attempt_superseded',
  'rwa_lifecycle_capacity', 'rwa_lifecycle_catalog', 'rwa_lifecycle_config',
  'rwa_lifecycle_decode', 'rwa_lifecycle_generation', 'rwa_lifecycle_getter_mismatch',
  'rwa_lifecycle_halted', 'rwa_lifecycle_inbox_conflict', 'rwa_lifecycle_input',
  'rwa_lifecycle_internal', 'rwa_lifecycle_not_ready', 'rwa_lifecycle_observation',
  'rwa_lifecycle_provenance', 'rwa_lifecycle_reorg', 'rwa_lifecycle_rpc',
  'rwa_lifecycle_structure', 'rwa_lifecycle_sync_busy', 'rwa_lifecycle_task5_mismatch',
  'rwa_lifecycle_timestamp', 'rwa_lifecycle_unconfigured',
]);

function fail(code, cause) { throw new RwaHealthOverlayError(code, cause); }

function queryClient(client) {
  if (!client || typeof client.query !== 'function') fail('h2_input');
  return client;
}

function exactOrdinaryDataRecord(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || Reflect.ownKeys(value).length !== keys.length) return false;
  const ownKeys = Reflect.ownKeys(value);
  return keys.every((key, index) => {
    if (ownKeys[index] !== key) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, 'value');
  });
}

function exactNullFrozenRecord(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== null || !Object.isFrozen(value)
      || Reflect.ownKeys(value).length !== keys.length) return false;
  const ownKeys = Reflect.ownKeys(value);
  return keys.every((key, index) => {
    if (ownKeys[index] !== key) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && descriptor.configurable === false
      && descriptor.writable === false && Object.hasOwn(descriptor, 'value');
  });
}

function frozenRecord(entries) {
  const value = Object.create(null);
  for (const [key, item] of entries) value[key] = item;
  return Object.freeze(value);
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function canonicalHash(value) {
  return typeof value === 'string' && /^0x[0-9a-f]{64}$/.test(value)
    && value !== ZERO_HASH ? value : null;
}

function canonicalAddress(value) {
  if (typeof value !== 'string') return null;
  try {
    const normalized = getAddress(value).toLowerCase();
    return normalized === ZERO_ADDRESS ? null : normalized;
  } catch {
    return null;
  }
}

function canonicalDecimal(value, maximum = UINT256_MAX, positive = false) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(value)) return null;
  const parsed = BigInt(value);
  return parsed <= maximum && (!positive || parsed > 0n) ? value : null;
}

function rowDecimal(value, maximum = UINT256_MAX, positive = false) {
  if (value === null || value === undefined) return null;
  return canonicalDecimal(typeof value === 'bigint' ? value.toString() : String(value), maximum, positive);
}

function canonicalIso(value) {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value ? value : null;
}

function rowIso(value) {
  if (value === null || value === undefined) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function canonicalBase64Bytes(value, minimum, maximum) {
  if (typeof value !== 'string' || (value.length > 0 && !/^[A-Za-z0-9_-]+$/.test(value))) return null;
  let bytes;
  try { bytes = Buffer.from(value, 'base64url'); } catch { return null; }
  if (bytes.byteLength < minimum || bytes.byteLength > maximum
      || bytes.toString('base64url') !== value) return null;
  return Uint8Array.from(bytes);
}

function canonicalRecovery(value) {
  return canonicalBase64Bytes(value, 1, MAX_RECOVERY_BYTES);
}

function reviewerId(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 200
      || value.trim() !== value || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)) fail('h2_input');
  return value;
}

function transportKeyHash(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) fail('h2_input');
  return value;
}

function dependencies(value) {
  if (value === undefined) return DEFAULT_DEPENDENCIES;
  const keys = Object.keys(DEFAULT_DEPENDENCIES);
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Reflect.ownKeys(value).length !== keys.length
      || !keys.every((key) => typeof value[key] === 'function')) fail('h2_input');
  return value;
}

function productionIdentity() {
  const registryAddress = canonicalAddress(process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS);
  const overlayAddress = canonicalAddress(process.env.RWA_HEALTH_OVERLAY_V2_ADDRESS);
  const safeAddress = canonicalAddress(process.env.RWA_HEALTH_OVERLAY_V2_SAFE_ADDRESS);
  const startBlockNumber = canonicalDecimal(process.env.RWA_HEALTH_OVERLAY_V2_START_BLOCK ?? '');
  if (!registryAddress || !overlayAddress || !safeAddress || startBlockNumber === null) {
    fail('h2_unconfigured');
  }
  return Object.freeze({ registryAddress, overlayAddress, safeAddress, startBlockNumber });
}

function inputCopy(assetVersionKey, body) {
  const key = canonicalHash(assetVersionKey);
  if (!key || !exactOrdinaryDataRecord(body, CREATE_BODY_KEYS)) fail('h2_input');
  const recovery = canonicalRecovery(body.recoveryEvidenceBase64url);
  if (!recovery || !canonicalHash(body.expectedCatalogSnapshotHash)
      || canonicalDecimal(body.expectedEpisodeGeneration, UINT256_MAX, true) === null
      || !['1', '2'].includes(body.expectedCurrentSeverity)
      || canonicalDecimal(body.expectedStateSequence, INT63_MAX, true) === null
      || !canonicalHash(body.expectedEpisodeEventId)
      || !canonicalHash(body.expectedMaterialEvidenceHash)
      || !canonicalHash(body.expectedEvaluationId)
      || !canonicalHash(body.expectedEvaluationEvidenceHash)
      || canonicalDecimal(body.expectedActivationGeneration, UINT256_MAX, true) === null
      || canonicalDecimal(body.expectedOverlayGeneration, UINT256_MAX, true) === null
      || !(body.expectedSafeNonce === null
        || canonicalDecimal(body.expectedSafeNonce, UINT256_MAX) !== null)) fail('h2_input');
  const result = frozenRecord([
    ['assetVersionKey', key],
    ...CREATE_BODY_KEYS.map((name) => [name, body[name]]),
  ]);
  CREATE_REQUESTS.add(result);
  return result;
}

export function normalizeRwaHealthClearanceCreateInputV2(assetVersionKey, body) {
  return inputCopy(assetVersionKey, body);
}

export function normalizeRwaHealthClearanceSubmissionInputV2(assetVersionKey, clearanceId, body) {
  const key = canonicalHash(assetVersionKey);
  const id = canonicalHash(clearanceId);
  if (!key || !id || !exactOrdinaryDataRecord(body, SUBMISSION_BODY_KEYS)
      || !canonicalHash(body.safeTransactionHash)) fail('h2_input');
  const result = frozenRecord([
    ['assetVersionKey', key], ['clearanceId', id],
    ['safeTransactionHash', body.safeTransactionHash],
  ]);
  SUBMISSION_REQUESTS.add(result);
  return result;
}

export function normalizeRwaHealthClearanceReadInputV2(assetVersionKey, clearanceId) {
  const key = canonicalHash(assetVersionKey);
  const id = canonicalHash(clearanceId);
  if (!key || !id) fail('h2_input');
  const result = frozenRecord([['assetVersionKey', key], ['clearanceId', id]]);
  READ_REQUESTS.add(result);
  return result;
}

function normalizedCreate(value) {
  if (!CREATE_REQUESTS.has(value) || !exactNullFrozenRecord(value, CREATE_REQUEST_KEYS)) fail('h2_input');
  return value;
}

function normalizedSubmission(value) {
  if (!SUBMISSION_REQUESTS.has(value)
      || !exactNullFrozenRecord(value, SUBMISSION_REQUEST_KEYS)) fail('h2_input');
  return value;
}

function normalizedRead(value) {
  if (!READ_REQUESTS.has(value) || !exactNullFrozenRecord(value, READ_REQUEST_KEYS)) fail('h2_input');
  return value;
}

function normalizedActor(value) {
  if (!exactOrdinaryDataRecord(value, ACTOR_KEYS)) fail('h2_input');
  return frozenRecord([
    ['reviewerId', reviewerId(value.reviewerId)],
    ['transportKeyHash', transportKeyHash(value.transportKeyHash)],
  ]);
}

function reviewerHash(value) {
  return keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'bytes32' }],
    [REVIEWER_TAG, keccak256(toBytes(value))],
  ));
}

function mapH1(error) {
  if (error instanceof RwaHealthOverlayError) throw error;
  if (error instanceof RwaHealthError || RWA_HEALTH_ERROR_CODES.includes(error?.code)) {
    fail(error.code === 'health_bad_input' ? 'h2_input' : 'h2_health_not_authoritative', error);
  }
  throw error;
}

function mapActivation(error) {
  if (error instanceof RwaHealthOverlayError) throw error;
  if (!ACTIVATION_ERROR_CODES.has(error?.code)) throw error;
  if (error.code === 'rwa_activation_input') fail('h2_input', error);
  if (['rwa_activation_unconfigured', 'rwa_lifecycle_unconfigured'].includes(error.code)) {
    fail('h2_unconfigured', error);
  }
  if (['rwa_activation_halted', 'rwa_lifecycle_halted'].includes(error.code)) fail('h2_halted', error);
  if (['rwa_activation_not_ready', 'rwa_lifecycle_not_ready'].includes(error.code)) {
    fail('h2_not_ready', error);
  }
  fail('h2_activation_not_authoritative', error);
}

function mapDatabase(error) {
  if (error instanceof RwaHealthOverlayError) throw error;
  if (['40001', '40P01', '55P03', '23505'].includes(error?.code)) fail('h2_contention', error);
  fail('h2_internal', error);
}

function h1ReceiptShape(value) {
  const keys = [
    'ok', 'purpose', 'chainId', 'registryAddress', 'catalogVersion', 'catalogSnapshotHash',
    'assetVersionKey', 'evaluationId', 'evaluationKind', 'observedAt', 'appliedAt',
    'freshThrough', 'stateSequence', 'episodeId', 'episodeGeneration',
    'latestEpisodeEventId', 'latestMaterialEvidenceHash',
  ];
  return value && Object.getPrototypeOf(value) === Object.prototype && Object.isFrozen(value)
    && Reflect.ownKeys(value).every((key, index) => key === keys[index])
    && Reflect.ownKeys(value).length === keys.length && value.ok === true
    && value.purpose === 'quarantine_clearance_broadcast' && value.chainId === CHAIN_ID
    && canonicalAddress(value.registryAddress) !== null
    && canonicalDecimal(value.catalogVersion) !== null && canonicalHash(value.catalogSnapshotHash)
    && canonicalHash(value.assetVersionKey) && canonicalHash(value.evaluationId)
    && value.evaluationKind === 'healthy' && canonicalIso(value.observedAt)
    && canonicalIso(value.appliedAt) && canonicalIso(value.freshThrough)
    && canonicalDecimal(value.stateSequence, INT63_MAX, true) !== null
    && canonicalHash(value.episodeId)
    && canonicalDecimal(value.episodeGeneration, UINT256_MAX, true) !== null
    && canonicalHash(value.latestEpisodeEventId)
    && canonicalHash(value.latestMaterialEvidenceHash);
}

function privateContextShape(value) {
  const keys = [
    'currentSeverity', 'evaluationId', 'evaluationEvidenceHash', 'evaluationBatchId',
    'evaluationPageId', 'evaluationObservedAt', 'evaluationAppliedAt',
    'providerEndpointHash', 'providerCommitment', 'providerSourceState',
    'providerByteCount', 'providerCapturedAt', 'providerRetainUntil',
    'providerBodyBase64url',
  ];
  if (!exactNullFrozenRecord(value, keys) || !['1', '2'].includes(value.currentSeverity)
      || !canonicalHash(value.evaluationId) || !canonicalHash(value.evaluationEvidenceHash)
      || !canonicalHash(value.evaluationBatchId) || !canonicalHash(value.evaluationPageId)
      || !canonicalIso(value.evaluationObservedAt) || !canonicalIso(value.evaluationAppliedAt)
      || !canonicalHash(value.providerEndpointHash) || !canonicalHash(value.providerCommitment)
      || value.providerSourceState !== 'observed'
      || canonicalDecimal(value.providerByteCount, 2000000n) === null
      || !canonicalIso(value.providerCapturedAt) || !canonicalIso(value.providerRetainUntil)) return false;
  const body = canonicalBase64Bytes(value.providerBodyBase64url, 0, 2_000_000);
  return body !== null && BigInt(body.byteLength) === BigInt(value.providerByteCount);
}

function activationReceiptShape(value) {
  const keys = [
    'chainId', 'registryAddress', 'assetVersionKey', 'activationGeneration', 'active',
    'localMatch', 'activationBlockNumber', 'activationBlockHash',
    'activationTransactionHash', 'activationLogIndex', 'catalogVersion',
    'catalogSnapshotHash', 'reviewId', 'evidenceHash', 'approvedAt', 'validUntil',
    'includedAt', 'appliedBlockNumber', 'appliedBlockHash', 'caughtUp', 'halted',
  ];
  return exactNullFrozenRecord(value, keys) && value.chainId === CHAIN_ID
    && canonicalAddress(value.registryAddress) && canonicalHash(value.assetVersionKey)
    && canonicalDecimal(value.activationGeneration, UINT256_MAX, true) !== null
    && value.active === true && value.localMatch === true
    && canonicalDecimal(value.activationBlockNumber) !== null
    && canonicalHash(value.activationBlockHash) && canonicalHash(value.activationTransactionHash)
    && canonicalDecimal(value.activationLogIndex) !== null
    && canonicalDecimal(value.catalogVersion) !== null && canonicalHash(value.catalogSnapshotHash)
    && canonicalHash(value.reviewId) && canonicalHash(value.evidenceHash)
    && canonicalDecimal(value.approvedAt, UINT64_MAX) !== null
    && canonicalDecimal(value.validUntil, UINT64_MAX) !== null
    && canonicalDecimal(value.includedAt, UINT64_MAX) !== null
    && canonicalDecimal(value.appliedBlockNumber) !== null && canonicalHash(value.appliedBlockHash)
    && value.caughtUp === true && value.halted === false;
}

function overlayContextShape(value) {
  const keys = [
    'chainId', 'consumerKey', 'registryAddress', 'overlayAddress', 'safeAddress',
    'startBlockNumber', 'appliedBlockNumber', 'appliedBlockHash', 'observationHash',
    'finalizedHorizonBlockNumber', 'finalizedHorizonBlockHash', 'caughtUp', 'halted',
    'readyVerifiedAt', 'freshThrough', 'assetVersionKey', 'currentOverlayGeneration',
    'nextOverlayGeneration',
  ];
  return exactNullFrozenRecord(value, keys) && value.chainId === CHAIN_ID
    && value.consumerKey === 'rwa_health_overlay_v2' && canonicalAddress(value.registryAddress)
    && canonicalAddress(value.overlayAddress) && canonicalAddress(value.safeAddress)
    && canonicalDecimal(value.startBlockNumber) !== null
    && canonicalDecimal(value.appliedBlockNumber) !== null && canonicalHash(value.appliedBlockHash)
    && canonicalHash(value.observationHash)
    && canonicalDecimal(value.finalizedHorizonBlockNumber) !== null
    && canonicalHash(value.finalizedHorizonBlockHash) && value.caughtUp === true
    && value.halted === false && canonicalIso(value.readyVerifiedAt)
    && canonicalIso(value.freshThrough) && canonicalHash(value.assetVersionKey)
    && canonicalDecimal(value.currentOverlayGeneration) !== null
    && canonicalDecimal(value.nextOverlayGeneration, UINT256_MAX, true) !== null
    && BigInt(value.nextOverlayGeneration) === BigInt(value.currentOverlayGeneration) + 1n;
}

function clearanceValue(facts, approvedAt, clearanceDeadline) {
  return Object.freeze({
    catalogSnapshotHash: facts.catalogSnapshotHash,
    assetVersionKey: facts.assetVersionKey,
    activationGeneration: BigInt(facts.activationGeneration),
    episodeId: facts.episodeId,
    episodeGeneration: BigInt(facts.episodeGeneration),
    currentSeverity: Number(facts.currentSeverity),
    stateSequence: BigInt(facts.stateSequence),
    latestEpisodeEventId: facts.latestEpisodeEventId,
    latestMaterialEvidenceHash: facts.latestMaterialEvidenceHash,
    recoveryEvidenceHash: facts.recoveryEvidenceHash,
    freshHealthyEvaluationId: facts.freshHealthyEvaluationId,
    freshHealthyEvidenceHash: facts.freshHealthyEvidenceHash,
    reviewerIdHash: facts.reviewerIdHash,
    approvedAt: BigInt(approvedAt),
    clearanceDeadline: BigInt(clearanceDeadline),
    expectedOverlayGeneration: BigInt(facts.expectedOverlayGeneration),
  });
}

function semanticRequestHash(facts) {
  return keccak256(encodeAbiParameters([
    { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'address' },
    { type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' },
    { type: 'uint256' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' },
    { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' },
    { type: 'uint64' }, { type: 'uint64' }, { type: 'bytes32' }, { type: 'uint256' },
    { type: 'uint8' }, { type: 'uint64' }, { type: 'bytes32' }, { type: 'bytes32' },
    { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' },
    { type: 'bytes32' }, { type: 'uint256' }, { type: 'bool' },
    { type: 'uint256' },
  ], [
    SEMANTIC_TAG, BigInt(CHAIN_ID), facts.registryAddress, facts.overlayAddress,
    facts.safeAddress, BigInt(facts.catalogVersion), facts.catalogSnapshotHash,
    facts.assetVersionKey, BigInt(facts.activationGeneration),
    BigInt(facts.activationBlockNumber), facts.activationBlockHash,
    facts.activationTransactionHash, BigInt(facts.activationLogIndex),
    facts.activationEvidenceHash, facts.activationReviewId,
    BigInt(facts.activationApprovedAt), BigInt(facts.activationValidUntil),
    BigInt(facts.activationIncludedAt), facts.episodeId, BigInt(facts.episodeGeneration),
    Number(facts.currentSeverity), BigInt(facts.stateSequence), facts.latestEpisodeEventId,
    facts.latestMaterialEventId, facts.latestMaterialEvidenceHash,
    facts.freshHealthyEvaluationId, facts.freshHealthyEvidenceHash,
    facts.recoveryEvidenceHash, facts.reviewerIdHash, BigInt(facts.expectedOverlayGeneration),
    facts.expectedSafeNonce !== null,
    facts.expectedSafeNonce === null ? 0n : BigInt(facts.expectedSafeNonce),
  ]));
}

function derivePackage(facts, approvedAt) {
  const approved = BigInt(approvedAt);
  if (approved > UINT64_MAX - CLEARANCE_TTL_SECONDS) fail('h2_internal');
  const deadline = (approved + CLEARANCE_TTL_SECONDS).toString();
  const value = clearanceValue(facts, approvedAt, deadline);
  const data = encodeFunctionData({ abi: CLEARANCE_ABI, functionName: 'recordClearance', args: [value] });
  const calldataHash = keccak256(data);
  const selector = data.slice(0, 10);
  const clearancePayloadHash = keccak256(encodeAbiParameters([
    { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'address' },
    { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'bytes32' },
    { type: 'uint256' }, { type: 'uint8' }, { type: 'uint64' }, { type: 'bytes32' },
    { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' },
    { type: 'bytes32' }, { type: 'uint64' }, { type: 'uint64' }, { type: 'uint256' },
  ], [PAYLOAD_TAG, BigInt(CHAIN_ID), facts.registryAddress, facts.overlayAddress,
    ...Object.values(value)]));
  const safeCallIntentHash = keccak256(encodeAbiParameters([
    { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'address' },
    { type: 'uint256' }, { type: 'uint8' }, { type: 'bytes4' }, { type: 'bytes32' },
  ], [CALL_INTENT_TAG, BigInt(CHAIN_ID), facts.safeAddress, facts.overlayAddress,
    0n, 0, selector, calldataHash]));
  const clearanceId = keccak256(encodeAbiParameters([
    { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'bytes32' },
    { type: 'bytes32' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'uint256' },
    { type: 'uint8' }, { type: 'uint64' }, { type: 'bytes32' }, { type: 'bytes32' },
    { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' },
    { type: 'uint64' }, { type: 'uint64' }, { type: 'uint256' }, { type: 'bytes32' },
  ], [CLEARANCE_TAG, BigInt(CHAIN_ID), facts.registryAddress, ...Object.values(value),
    safeCallIntentHash]));
  return deepFreeze({
    clearanceId, approvedAt, clearanceDeadline: deadline, data, calldataHash,
    clearancePayloadHash, safeCallIntentHash,
    safeTransaction: { to: facts.overlayAddress, value: '0', operation: 0, data },
  });
}

function creationProjection(packageValue, facts, status, safeServiceTransactionHash, changed) {
  return frozenRecord([
    ['clearanceId', packageValue.clearanceId], ['assetVersionKey', facts.assetVersionKey],
    ['status', status], ['approvedAt', packageValue.approvedAt],
    ['clearanceDeadline', packageValue.clearanceDeadline],
    ['expectedOverlayGeneration', facts.expectedOverlayGeneration],
    ['expectedSafeNonce', facts.expectedSafeNonce],
    ['safeServiceTransactionHash', safeServiceTransactionHash],
    ['clearancePayloadHash', packageValue.clearancePayloadHash],
    ['safeCallIntentHash', packageValue.safeCallIntentHash],
    ['calldataHash', packageValue.calldataHash],
    ['safeTransaction', frozenRecord([
      ['to', facts.overlayAddress], ['value', '0'], ['operation', 0], ['data', packageValue.data],
    ])],
    ['changed', changed],
  ]);
}

function operatorProjection(projection) {
  return frozenRecord(Object.entries(projection).filter(([key]) => key !== 'changed'));
}

async function databaseClock(client, wholeSecond = false) {
  const expression = dbCaps.skipLocked ? 'clock_timestamp()' : 'now()';
  const select = wholeSecond ? `date_trunc('second',${expression})` : expression;
  const value = (await client.query(`SELECT ${select} AS database_now`)).rows[0]?.database_now;
  const iso = rowIso(value);
  if (!iso) fail('h2_internal');
  const milliseconds = new Date(iso).getTime();
  return Object.freeze({ date: new Date(milliseconds), milliseconds, seconds: String(Math.floor(milliseconds / 1000)) });
}

async function materialHead(client, h1) {
  const row = (await client.query(
    `SELECT current_severity,latest_material_event_id
       FROM rwa_health_current_v2
      WHERE registry_address=$1 AND asset_version_key=$2 AND catalog_version=$3::numeric
        AND catalog_snapshot_hash=$4 AND current_episode_id=$5
        AND current_episode_generation=$6::numeric AND state_sequence=$7::bigint
        AND latest_episode_event_id=$8 AND latest_material_evidence_hash=$9
        AND last_evaluation_id=$10 AND clearance_applied_at IS NULL`,
    [h1.registryAddress, h1.assetVersionKey, h1.catalogVersion, h1.catalogSnapshotHash,
      h1.episodeId, h1.episodeGeneration, h1.stateSequence, h1.latestEpisodeEventId,
      h1.latestMaterialEvidenceHash, h1.evaluationId],
  )).rows[0];
  if (!row || !canonicalHash(row.latest_material_event_id)
      || !['health_unknown', 'operational_quarantine'].includes(row.current_severity)) {
    fail('h2_health_not_authoritative');
  }
  return Object.freeze({
    currentSeverity: row.current_severity === 'health_unknown' ? '1' : '2',
    latestMaterialEventId: row.latest_material_event_id,
  });
}

async function authorityFacts(client, request, actor, deps) {
  let h1;
  try {
    h1 = await deps.requireFreshRwaHealth(client, request.assetVersionKey, {
      expectedEvaluationId: request.expectedEvaluationId,
      purpose: 'quarantine_clearance_broadcast',
      expectedEpisodeGeneration: request.expectedEpisodeGeneration,
      expectedStateSequence: request.expectedStateSequence,
      expectedEpisodeEventId: request.expectedEpisodeEventId,
      expectedMaterialEvidenceHash: request.expectedMaterialEvidenceHash,
    });
  } catch (error) { mapH1(error); }
  if (!h1ReceiptShape(h1)) fail('h2_health_not_authoritative');
  let privateContext;
  try { privateContext = await deps.readRwaHealthClearanceContext(client, h1); }
  catch (error) { mapH1(error); }
  if (!privateContextShape(privateContext)) fail('h2_health_not_authoritative');
  const material = await materialHead(client, h1);
  if (h1.catalogSnapshotHash !== request.expectedCatalogSnapshotHash
      || h1.episodeGeneration !== request.expectedEpisodeGeneration
      || material.currentSeverity !== request.expectedCurrentSeverity
      || h1.stateSequence !== request.expectedStateSequence
      || h1.latestEpisodeEventId !== request.expectedEpisodeEventId
      || h1.latestMaterialEvidenceHash !== request.expectedMaterialEvidenceHash
      || h1.evaluationId !== request.expectedEvaluationId
      || privateContext.currentSeverity !== request.expectedCurrentSeverity
      || privateContext.evaluationId !== request.expectedEvaluationId
      || privateContext.evaluationEvidenceHash !== request.expectedEvaluationEvidenceHash
      || privateContext.evaluationObservedAt !== h1.observedAt
      || privateContext.evaluationAppliedAt !== h1.appliedAt) fail('h2_health_not_authoritative');

  let activation;
  try {
    activation = await deps.requireFinalizedRwaActivationV2(client, request.assetVersionKey,
      { expectedActivationGeneration: request.expectedActivationGeneration });
  } catch (error) { mapActivation(error); }
  if (!activationReceiptShape(activation)) fail('h2_activation_not_authoritative');

  let overlay;
  try { overlay = await deps.readRwaHealthOverlayAuthoringContextV2(client, request.assetVersionKey); }
  catch (error) {
    if (error instanceof RwaHealthOverlayError) throw error;
    throw error;
  }
  if (!overlayContextShape(overlay)) fail('h2_not_ready');

  const identity = productionIdentity();
  if (h1.registryAddress !== identity.registryAddress
      || activation.registryAddress !== identity.registryAddress
      || overlay.registryAddress !== identity.registryAddress
      || overlay.overlayAddress !== identity.overlayAddress || overlay.safeAddress !== identity.safeAddress
      || overlay.startBlockNumber !== identity.startBlockNumber
      || activation.assetVersionKey !== request.assetVersionKey
      || overlay.assetVersionKey !== request.assetVersionKey
      || activation.catalogSnapshotHash !== h1.catalogSnapshotHash
      || activation.catalogVersion !== h1.catalogVersion
      || activation.activationGeneration !== request.expectedActivationGeneration
      || overlay.nextOverlayGeneration !== request.expectedOverlayGeneration) {
    fail('h2_activation_not_authoritative');
  }

  const recoveryBytes = canonicalRecovery(request.recoveryEvidenceBase64url);
  if (!recoveryBytes) fail('h2_input');
  return Object.freeze({
    chainId: CHAIN_ID, registryAddress: identity.registryAddress,
    overlayAddress: identity.overlayAddress, safeAddress: identity.safeAddress,
    catalogVersion: h1.catalogVersion, catalogSnapshotHash: h1.catalogSnapshotHash,
    assetVersionKey: request.assetVersionKey,
    activationGeneration: activation.activationGeneration,
    activationBlockNumber: activation.activationBlockNumber,
    activationBlockHash: activation.activationBlockHash,
    activationTransactionHash: activation.activationTransactionHash,
    activationLogIndex: activation.activationLogIndex,
    activationEvidenceHash: activation.evidenceHash,
    activationReviewId: activation.reviewId,
    activationApprovedAt: activation.approvedAt,
    activationValidUntil: activation.validUntil,
    activationIncludedAt: activation.includedAt,
    episodeId: h1.episodeId, episodeGeneration: h1.episodeGeneration,
    currentSeverity: material.currentSeverity, stateSequence: h1.stateSequence,
    latestEpisodeEventId: h1.latestEpisodeEventId,
    latestMaterialEventId: material.latestMaterialEventId,
    latestMaterialEvidenceHash: h1.latestMaterialEvidenceHash,
    freshHealthyEvaluationId: h1.evaluationId,
    freshHealthyEvidenceHash: privateContext.evaluationEvidenceHash,
    freshHealthyEvaluationAppliedAt: privateContext.evaluationAppliedAt,
    reviewerId: actor.reviewerId, reviewerIdHash: reviewerHash(actor.reviewerId),
    recoveryEvidenceHash: keccak256(recoveryBytes), recoveryBytes,
    expectedOverlayGeneration: overlay.nextOverlayGeneration,
    expectedSafeNonce: request.expectedSafeNonce,
    semanticRequestHash: null,
  });
}

async function openPackage(client, facts) {
  const rows = (await client.query(
    `SELECT p.clearance_id,p.semantic_request_hash,p.status,p.clearance_deadline
       FROM rwa_health_clearance_attestations_v2 a
       JOIN rwa_health_clearance_safe_proposals_v2 p ON p.clearance_id=a.clearance_id
      WHERE p.registry_address=$1 AND p.asset_version_key=$2
        AND p.expected_overlay_generation=$3::numeric
        AND p.status IN ('safe_package_ready','safe_submitted')
      ORDER BY p.clearance_id ASC${dbCaps.skipLocked ? ' FOR UPDATE OF a,p' : ''}`,
    [facts.registryAddress, facts.assetVersionKey, facts.expectedOverlayGeneration],
  )).rows;
  if (rows.length > 1) fail('h2_semantic_conflict');
  return rows[0] ?? null;
}

async function packageRows(client, clearanceId, lock = false) {
  const suffix = lock && dbCaps.skipLocked ? ' FOR UPDATE' : '';
  const attestation = (await client.query(
    `SELECT * FROM rwa_health_clearance_attestations_v2 WHERE clearance_id=$1${suffix}`,
    [clearanceId],
  )).rows[0] ?? null;
  const evidence = (await client.query(
    `SELECT * FROM rwa_health_clearance_recovery_evidence_v2 WHERE clearance_id=$1${suffix}`,
    [clearanceId],
  )).rows[0] ?? null;
  const proposal = (await client.query(
    `SELECT * FROM rwa_health_clearance_safe_proposals_v2 WHERE clearance_id=$1${suffix}`,
    [clearanceId],
  )).rows[0] ?? null;
  return { attestation, evidence, proposal };
}

function factsFromRows(rows) {
  const { attestation: a, evidence: e, proposal: p } = rows;
  if (!a || !e || !p || p.clearance_id !== a.clearance_id || e.clearance_id !== a.clearance_id
      || !canonicalHash(a.clearance_id) || !canonicalHash(a.semantic_request_hash)
      || p.semantic_request_hash !== a.semantic_request_hash
      || canonicalAddress(a.registry_address) === null || canonicalAddress(a.overlay_address) === null
      || canonicalAddress(a.safe_address) === null || String(a.chain_id) !== CHAIN_ID
      || canonicalDecimal(String(a.catalog_version)) === null || !canonicalHash(a.catalog_snapshot_hash)
      || !canonicalHash(a.asset_version_key)
      || canonicalDecimal(String(a.activation_generation), UINT256_MAX, true) === null
      || canonicalDecimal(String(a.activation_block_number)) === null
      || !canonicalHash(a.activation_block_hash) || !canonicalHash(a.activation_transaction_hash)
      || canonicalDecimal(String(a.activation_log_index)) === null
      || !canonicalHash(a.activation_evidence_hash) || !canonicalHash(a.activation_review_id)
      || rowIso(a.activation_approved_at) === null || rowIso(a.activation_valid_until) === null
      || rowIso(a.activation_included_at) === null || !canonicalHash(a.episode_id)
      || canonicalDecimal(String(a.episode_generation), UINT256_MAX, true) === null
      || !['1', '2'].includes(String(a.current_severity))
      || canonicalDecimal(String(a.state_sequence), INT63_MAX, true) === null
      || !canonicalHash(a.latest_episode_event_id) || !canonicalHash(a.latest_material_event_id)
      || !canonicalHash(a.latest_material_evidence_hash)
      || !canonicalHash(a.fresh_healthy_evaluation_id)
      || !canonicalHash(a.fresh_healthy_evidence_hash)
      || rowIso(a.fresh_healthy_evaluation_applied_at) === null
      || reviewerId(a.reviewer_id) !== a.reviewer_id || !canonicalHash(a.reviewer_id_hash)
      || !canonicalHash(a.recovery_evidence_hash)
      || canonicalDecimal(String(a.approved_at), UINT64_MAX) === null
      || canonicalDecimal(String(a.clearance_deadline), UINT64_MAX) === null
      || BigInt(a.clearance_deadline) !== BigInt(a.approved_at) + CLEARANCE_TTL_SECONDS
      || canonicalDecimal(String(a.expected_overlay_generation), UINT256_MAX, true) === null
      || !(a.expected_safe_nonce == null
        || canonicalDecimal(String(a.expected_safe_nonce), UINT256_MAX) !== null)
      || !canonicalHash(a.clearance_payload_hash) || !canonicalHash(a.safe_call_intent_hash)
      || !canonicalHash(a.calldata_hash) || !ALL_STATUSES.includes(p.status)
      || p.registry_address !== a.registry_address || p.asset_version_key !== a.asset_version_key
      || String(p.expected_overlay_generation) !== String(a.expected_overlay_generation)
      || p.safe_address !== a.safe_address || p.to_address !== a.overlay_address
      || String(p.value_wei) !== '0' || Number(p.operation) !== 0
      || typeof p.calldata_hex !== 'string' || p.calldata_hash !== a.calldata_hash
      || String(p.approved_at) !== String(a.approved_at)
      || String(p.clearance_deadline) !== String(a.clearance_deadline)
      || (p.expected_safe_nonce == null ? null : String(p.expected_safe_nonce))
        !== (a.expected_safe_nonce == null ? null : String(a.expected_safe_nonce))
      || !(p.safe_service_transaction_hash == null
        || canonicalHash(p.safe_service_transaction_hash))
      || e.recovery_evidence_hash !== a.recovery_evidence_hash
      || rowDecimal(e.byte_count, BigInt(MAX_RECOVERY_BYTES), true) === null
      || !(e.evidence_bytes instanceof Uint8Array)) fail('h2_semantic_conflict');
  const recoveryBytes = Uint8Array.from(e.evidence_bytes);
  if (BigInt(recoveryBytes.byteLength) !== BigInt(e.byte_count)
      || keccak256(recoveryBytes) !== a.recovery_evidence_hash
      || reviewerHash(a.reviewer_id) !== a.reviewer_id_hash) fail('h2_semantic_conflict');
  const facts = Object.freeze({
    chainId: CHAIN_ID, registryAddress: a.registry_address, overlayAddress: a.overlay_address,
    safeAddress: a.safe_address, catalogVersion: String(a.catalog_version),
    catalogSnapshotHash: a.catalog_snapshot_hash, assetVersionKey: a.asset_version_key,
    activationGeneration: String(a.activation_generation),
    activationBlockNumber: String(a.activation_block_number),
    activationBlockHash: a.activation_block_hash,
    activationTransactionHash: a.activation_transaction_hash,
    activationLogIndex: String(a.activation_log_index), activationEvidenceHash: a.activation_evidence_hash,
    activationReviewId: a.activation_review_id,
    activationApprovedAt: String(Math.floor(new Date(a.activation_approved_at).getTime() / 1000)),
    activationValidUntil: String(Math.floor(new Date(a.activation_valid_until).getTime() / 1000)),
    activationIncludedAt: String(Math.floor(new Date(a.activation_included_at).getTime() / 1000)),
    episodeId: a.episode_id, episodeGeneration: String(a.episode_generation),
    currentSeverity: String(a.current_severity), stateSequence: String(a.state_sequence),
    latestEpisodeEventId: a.latest_episode_event_id,
    latestMaterialEventId: a.latest_material_event_id,
    latestMaterialEvidenceHash: a.latest_material_evidence_hash,
    freshHealthyEvaluationId: a.fresh_healthy_evaluation_id,
    freshHealthyEvidenceHash: a.fresh_healthy_evidence_hash,
    freshHealthyEvaluationAppliedAt: rowIso(a.fresh_healthy_evaluation_applied_at),
    reviewerId: a.reviewer_id, reviewerIdHash: a.reviewer_id_hash,
    recoveryEvidenceHash: a.recovery_evidence_hash, recoveryBytes,
    expectedOverlayGeneration: String(a.expected_overlay_generation),
    expectedSafeNonce: a.expected_safe_nonce == null ? null : String(a.expected_safe_nonce),
    semanticRequestHash: a.semantic_request_hash,
  });
  const packageValue = derivePackage(facts, String(a.approved_at));
  if (packageValue.clearanceId !== a.clearance_id
      || semanticRequestHash(facts) !== a.semantic_request_hash
      || packageValue.clearancePayloadHash !== a.clearance_payload_hash
      || packageValue.safeCallIntentHash !== a.safe_call_intent_hash
      || packageValue.calldataHash !== a.calldata_hash || packageValue.data !== p.calldata_hex) {
    fail('h2_semantic_conflict');
  }
  return { facts, packageValue, proposal: p };
}

async function markStale(client, clearanceId, nowSeconds) {
  return client.query(
    `UPDATE rwa_health_clearance_safe_proposals_v2
        SET status='approval_stale',updated_at=to_timestamp($2::double precision)
      WHERE clearance_id=$1 AND status IN ('safe_package_ready','safe_submitted')
        AND clearance_deadline <= $2::numeric RETURNING clearance_id`,
    [clearanceId, nowSeconds],
  );
}

export async function createRwaHealthClearanceAttestationV2(
  client, actorValue, requestValue, dependencyOverrides,
) {
  queryClient(client);
  const actor = normalizedActor(actorValue);
  const request = normalizedCreate(requestValue);
  const deps = dependencies(dependencyOverrides);
  productionIdentity();
  try {
    const baseFacts = await authorityFacts(client, request, actor, deps);
    const facts = Object.freeze({ ...baseFacts, semanticRequestHash: semanticRequestHash(baseFacts) });
    const clock = await databaseClock(client, true);
    const existing = await openPackage(client, facts);
    if (existing && BigInt(existing.clearance_deadline) <= BigInt(clock.seconds)) {
      await markStale(client, existing.clearance_id, clock.seconds);
    } else if (existing) {
      if (existing.semantic_request_hash !== facts.semanticRequestHash) fail('h2_semantic_conflict');
      const stored = factsFromRows(await packageRows(client, existing.clearance_id, true));
      if (stored.facts.semanticRequestHash !== facts.semanticRequestHash
          || stored.facts.reviewerId !== actor.reviewerId) fail('h2_semantic_conflict');
      return creationProjection(stored.packageValue, stored.facts, stored.proposal.status,
        stored.proposal.safe_service_transaction_hash ?? null, false);
    }

    const packageValue = derivePackage(facts, clock.seconds);
    const activationApprovedAt = new Date(Number(BigInt(facts.activationApprovedAt) * 1000n));
    const activationValidUntil = new Date(Number(BigInt(facts.activationValidUntil) * 1000n));
    const activationIncludedAt = new Date(Number(BigInt(facts.activationIncludedAt) * 1000n));
    const evaluationAppliedAt = new Date(facts.freshHealthyEvaluationAppliedAt);
    const retainUntil = new Date(clock.date.getTime() + Number(RETENTION_SECONDS * 1000n));
    await client.query(
      `INSERT INTO rwa_health_clearance_attestations_v2
        (clearance_id,semantic_request_hash,chain_id,registry_address,overlay_address,safe_address,
         catalog_version,catalog_snapshot_hash,asset_version_key,activation_generation,
         activation_block_number,activation_block_hash,activation_transaction_hash,
         activation_log_index,activation_evidence_hash,activation_review_id,activation_approved_at,
         activation_valid_until,activation_included_at,episode_id,episode_generation,current_severity,
         state_sequence,latest_episode_event_id,latest_material_event_id,
         latest_material_evidence_hash,fresh_healthy_evaluation_id,fresh_healthy_evidence_hash,
         fresh_healthy_evaluation_applied_at,reviewer_id,reviewer_id_hash,recovery_evidence_hash,
         approved_at,clearance_deadline,expected_overlay_generation,expected_safe_nonce,
         clearance_payload_hash,safe_call_intent_hash,calldata_hash,first_transport_key_hash,created_at)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7::numeric,$8,$9,$10::numeric,$11::numeric,$12,$13,
         $14::numeric,$15,$16,$17,$18,$19,$20,$21::numeric,$22,$23::bigint,$24,$25,$26,
         $27,$28,$29,$30,$31,$32,$33::numeric,$34::numeric,$35::numeric,$36::numeric,
         $37,$38,$39,$40,$41)`,
      [packageValue.clearanceId, facts.semanticRequestHash, CHAIN_ID, facts.registryAddress,
        facts.overlayAddress, facts.safeAddress, facts.catalogVersion, facts.catalogSnapshotHash,
        facts.assetVersionKey, facts.activationGeneration, facts.activationBlockNumber,
        facts.activationBlockHash, facts.activationTransactionHash, facts.activationLogIndex,
        facts.activationEvidenceHash, facts.activationReviewId, activationApprovedAt,
        activationValidUntil, activationIncludedAt, facts.episodeId, facts.episodeGeneration,
        Number(facts.currentSeverity), facts.stateSequence, facts.latestEpisodeEventId,
        facts.latestMaterialEventId, facts.latestMaterialEvidenceHash,
        facts.freshHealthyEvaluationId, facts.freshHealthyEvidenceHash, evaluationAppliedAt,
        actor.reviewerId, facts.reviewerIdHash, facts.recoveryEvidenceHash, packageValue.approvedAt,
        packageValue.clearanceDeadline, facts.expectedOverlayGeneration, facts.expectedSafeNonce,
        packageValue.clearancePayloadHash, packageValue.safeCallIntentHash,
        packageValue.calldataHash, actor.transportKeyHash, clock.date],
    );
    await client.query(
      `INSERT INTO rwa_health_clearance_recovery_evidence_v2
        (clearance_id,recovery_evidence_hash,byte_count,evidence_bytes,captured_at,retain_until)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [packageValue.clearanceId, facts.recoveryEvidenceHash, facts.recoveryBytes.byteLength,
        Buffer.from(facts.recoveryBytes), clock.date, retainUntil],
    );
    await client.query(
      `INSERT INTO rwa_health_clearance_safe_proposals_v2
        (clearance_id,semantic_request_hash,registry_address,asset_version_key,
         expected_overlay_generation,safe_address,to_address,value_wei,operation,calldata_hex,
         calldata_hash,expected_safe_nonce,safe_service_transaction_hash,
         execution_transaction_hash,status,approved_at,clearance_deadline,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5::numeric,$6,$7,0,0,$8,$9,$10,NULL,NULL,
               'safe_package_ready',$11::numeric,$12::numeric,$13,$13)`,
      [packageValue.clearanceId, facts.semanticRequestHash, facts.registryAddress,
        facts.assetVersionKey, facts.expectedOverlayGeneration, facts.safeAddress,
        facts.overlayAddress, packageValue.data, packageValue.calldataHash,
        facts.expectedSafeNonce, packageValue.approvedAt, packageValue.clearanceDeadline,
        clock.date],
    );
    return creationProjection(packageValue, facts, 'safe_package_ready', null, true);
  } catch (error) {
    if (error instanceof RwaHealthOverlayError) throw error;
    mapDatabase(error);
  }
}

async function unlockedCurrentExpectation(client, identity, assetVersionKey) {
  await client.query(`SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1${dbCaps.skipLocked ? ' FOR SHARE' : ''}`);
  const row = (await client.query(
    `SELECT catalog_snapshot_hash,current_episode_id,current_episode_generation,current_severity,
            state_sequence,latest_episode_event_id,latest_material_event_id,
            latest_material_evidence_hash,last_evaluation_id,last_evaluation_evidence_hash,
            last_applied_at,clearance_applied_at
       FROM rwa_health_current_v2
      WHERE registry_address=$1 AND asset_version_key=$2`,
    [identity.registryAddress, assetVersionKey],
  )).rows[0];
  if (!row || row.clearance_applied_at != null || !canonicalHash(row.catalog_snapshot_hash)
      || !canonicalHash(row.current_episode_id)
      || rowDecimal(row.current_episode_generation, UINT256_MAX, true) === null
      || !['health_unknown', 'operational_quarantine'].includes(row.current_severity)
      || rowDecimal(row.state_sequence, INT63_MAX, true) === null
      || !canonicalHash(row.latest_episode_event_id) || !canonicalHash(row.latest_material_event_id)
      || !canonicalHash(row.latest_material_evidence_hash) || !canonicalHash(row.last_evaluation_id)
      || !canonicalHash(row.last_evaluation_evidence_hash) || rowIso(row.last_applied_at) === null) {
    fail('h2_health_not_authoritative');
  }
  return row;
}

async function currentAuthorityForStored(client, stored, reviewer, deps) {
  const identity = productionIdentity();
  const baseline = stored.facts;
  if (identity.registryAddress !== baseline.registryAddress
      || identity.overlayAddress !== baseline.overlayAddress || identity.safeAddress !== baseline.safeAddress
      || baseline.reviewerId !== reviewer) fail('h2_package_not_found');
  const head = await unlockedCurrentExpectation(client, identity, baseline.assetVersionKey);
  let h1;
  try {
    h1 = await deps.requireFreshRwaHealth(client, baseline.assetVersionKey, {
      expectedEvaluationId: head.last_evaluation_id,
      purpose: 'quarantine_clearance_broadcast',
      expectedEpisodeGeneration: String(head.current_episode_generation),
      expectedStateSequence: String(head.state_sequence),
      expectedEpisodeEventId: head.latest_episode_event_id,
      expectedMaterialEvidenceHash: head.latest_material_evidence_hash,
    });
  } catch (error) { mapH1(error); }
  if (!h1ReceiptShape(h1)) fail('h2_health_not_authoritative');
  let context;
  try { context = await deps.readRwaHealthClearanceContext(client, h1); }
  catch (error) { mapH1(error); }
  if (!privateContextShape(context)) fail('h2_health_not_authoritative');
  let activation;
  try {
    activation = await deps.requireFinalizedRwaActivationV2(client, baseline.assetVersionKey,
      { expectedActivationGeneration: baseline.activationGeneration });
  } catch (error) { mapActivation(error); }
  if (!activationReceiptShape(activation)) fail('h2_activation_not_authoritative');
  let overlay;
  try { overlay = await deps.readRwaHealthOverlayAuthoringContextV2(client, baseline.assetVersionKey); }
  catch (error) {
    if (error instanceof RwaHealthOverlayError) throw error;
    throw error;
  }
  if (!overlayContextShape(overlay)) fail('h2_not_ready');
  if (h1.catalogSnapshotHash !== baseline.catalogSnapshotHash
      || h1.episodeId !== baseline.episodeId || h1.episodeGeneration !== baseline.episodeGeneration
      || (head.current_severity === 'health_unknown' ? '1' : '2') !== baseline.currentSeverity
      || h1.latestEpisodeEventId !== baseline.latestEpisodeEventId
      || head.latest_material_event_id !== baseline.latestMaterialEventId
      || h1.latestMaterialEvidenceHash !== baseline.latestMaterialEvidenceHash
      || activation.activationGeneration !== baseline.activationGeneration
      || activation.activationBlockNumber !== baseline.activationBlockNumber
      || activation.activationBlockHash !== baseline.activationBlockHash
      || activation.activationTransactionHash !== baseline.activationTransactionHash
      || activation.activationLogIndex !== baseline.activationLogIndex
      || activation.evidenceHash !== baseline.activationEvidenceHash
      || activation.reviewId !== baseline.activationReviewId
      || activation.approvedAt !== baseline.activationApprovedAt
      || activation.validUntil !== baseline.activationValidUntil
      || activation.includedAt !== baseline.activationIncludedAt
      || overlay.nextOverlayGeneration !== baseline.expectedOverlayGeneration) {
    fail('h2_approval_stale');
  }
  const currentSequence = BigInt(h1.stateSequence);
  const baselineSequence = BigInt(baseline.stateSequence);
  if (currentSequence < baselineSequence || currentSequence - baselineSequence > MAX_HEALTHY_SEQUENCE) {
    fail('h2_approval_stale');
  }
  const delta = currentSequence - baselineSequence;
  const later = (await client.query(
    `SELECT evaluation_id,evidence_hash,evaluation_kind,status,catalog_snapshot_hash,applied_at
       FROM rwa_health_evaluations_v2
      WHERE registry_address=$1 AND asset_version_key=$2
        AND applied_at > $3::timestamptz AND status='applied'
      ORDER BY applied_at ASC,evaluation_id ASC LIMIT 2049`,
    [baseline.registryAddress, baseline.assetVersionKey, baseline.freshHealthyEvaluationAppliedAt],
  )).rows;
  if (later.length > Number(MAX_HEALTHY_SEQUENCE) || BigInt(later.length) !== delta) {
    fail('h2_approval_stale');
  }
  if (delta === 0n) {
    if (h1.evaluationId !== baseline.freshHealthyEvaluationId
        || context.evaluationEvidenceHash !== baseline.freshHealthyEvidenceHash
        || context.evaluationAppliedAt !== baseline.freshHealthyEvaluationAppliedAt) {
      fail('h2_approval_stale');
    }
  } else {
    for (let index = 0; index < later.length; index += 1) {
      const row = later[index];
      if (!canonicalHash(row.evaluation_id) || !canonicalHash(row.evidence_hash)
          || row.evaluation_kind !== 'healthy' || row.status !== 'applied'
          || row.catalog_snapshot_hash !== baseline.catalogSnapshotHash
          || rowIso(row.applied_at) === null
          || (index > 0 && rowIso(later[index - 1].applied_at) === rowIso(row.applied_at))) {
        fail('h2_approval_stale');
      }
    }
    const last = later.at(-1);
    if (last.evaluation_id !== h1.evaluationId
        || last.evidence_hash !== context.evaluationEvidenceHash
        || rowIso(last.applied_at) !== context.evaluationAppliedAt) fail('h2_approval_stale');
  }
  return { h1, context, head };
}

export async function recordRwaHealthClearanceSubmissionV2(
  client, reviewerValue, requestValue, dependencyOverrides,
) {
  queryClient(client);
  const reviewer = reviewerId(reviewerValue);
  const request = normalizedSubmission(requestValue);
  const deps = dependencies(dependencyOverrides);
  productionIdentity();
  try {
    const snapshotRows = await packageRows(client, request.clearanceId, false);
    if (!snapshotRows.attestation || snapshotRows.attestation.asset_version_key !== request.assetVersionKey
        || snapshotRows.attestation.reviewer_id !== reviewer) fail('h2_package_not_found');
    const snapshot = factsFromRows(snapshotRows);
    if (!OPEN_STATUSES.includes(snapshot.proposal.status)) fail('h2_submission_terminal');
    await currentAuthorityForStored(client, snapshot, reviewer, deps);
    const clock = await databaseClock(client);
    const locked = factsFromRows(await packageRows(client, request.clearanceId, true));
    if (locked.facts.semanticRequestHash !== snapshot.facts.semanticRequestHash
        || locked.facts.assetVersionKey !== request.assetVersionKey) fail('h2_contention');
    if (!OPEN_STATUSES.includes(locked.proposal.status)) fail('h2_submission_terminal');
    if (BigInt(clock.seconds) >= BigInt(locked.packageValue.clearanceDeadline)) {
      await markStale(client, request.clearanceId, clock.seconds);
      fail('h2_approval_stale');
    }
    if (locked.proposal.status === 'safe_submitted') {
      if (locked.proposal.safe_service_transaction_hash !== request.safeTransactionHash) {
        fail('h2_submission_conflict');
      }
      return frozenRecord([
        ['clearanceId', request.clearanceId], ['assetVersionKey', request.assetVersionKey],
        ['status', 'safe_submitted'],
        ['safeServiceTransactionHash', request.safeTransactionHash], ['changed', false],
      ]);
    }
    const result = await client.query(
      `UPDATE rwa_health_clearance_safe_proposals_v2
          SET status='safe_submitted',safe_service_transaction_hash=$2,
              submitted_at=$3,updated_at=$3
        WHERE clearance_id=$1 AND status='safe_package_ready'
          AND safe_service_transaction_hash IS NULL
          AND clearance_deadline > $4::numeric RETURNING clearance_id`,
      [request.clearanceId, request.safeTransactionHash, clock.date, clock.seconds],
    );
    if (result.rowCount !== 1) fail('h2_contention');
    return frozenRecord([
      ['clearanceId', request.clearanceId], ['assetVersionKey', request.assetVersionKey],
      ['status', 'safe_submitted'],
      ['safeServiceTransactionHash', request.safeTransactionHash], ['changed', true],
    ]);
  } catch (error) {
    if (error instanceof RwaHealthOverlayError) throw error;
    mapDatabase(error);
  }
}

export async function readRwaHealthClearancePackageV2(client, reviewerValue, requestValue) {
  queryClient(client);
  const reviewer = reviewerId(reviewerValue);
  const request = normalizedRead(requestValue);
  productionIdentity();
  try {
    const clock = await databaseClock(client);
    const rows = await packageRows(client, request.clearanceId, true);
    if (!rows.attestation || !rows.evidence || !rows.proposal) fail('h2_package_not_found');
    let stored = factsFromRows(rows);
    if (stored.facts.assetVersionKey !== request.assetVersionKey
        || stored.facts.reviewerId !== reviewer) fail('h2_package_not_found');
    if (OPEN_STATUSES.includes(stored.proposal.status)
        && BigInt(clock.seconds) >= BigInt(stored.packageValue.clearanceDeadline)) {
      await markStale(client, request.clearanceId, clock.seconds);
      stored = {
        ...stored,
        proposal: { ...stored.proposal, status: 'approval_stale' },
      };
    }
    const projection = creationProjection(stored.packageValue, stored.facts,
      stored.proposal.status, stored.proposal.safe_service_transaction_hash ?? null, false);
    return operatorProjection(projection);
  } catch (error) {
    if (error instanceof RwaHealthOverlayError) throw error;
    mapDatabase(error);
  }
}

export async function expireRwaHealthClearancePackagesV2(client, limit = MAX_EXPIRE_BATCH) {
  queryClient(client);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_EXPIRE_BATCH) fail('h2_input');
  productionIdentity();
  try {
    const clock = await databaseClock(client);
    const selected = (await client.query(
      `SELECT clearance_id FROM rwa_health_clearance_safe_proposals_v2
        WHERE status IN ('safe_package_ready','safe_submitted')
          AND clearance_deadline <= $1::numeric
        ORDER BY clearance_deadline ASC,clearance_id ASC LIMIT $2${dbCaps.skipLocked ? ' FOR UPDATE SKIP LOCKED' : ''}`,
      [clock.seconds, limit],
    )).rows;
    let processed = 0;
    for (const row of selected) {
      if (!canonicalHash(row.clearance_id)) fail('h2_internal');
      const changed = await markStale(client, row.clearance_id, clock.seconds);
      if (changed.rowCount === 1) processed += 1;
    }
    return frozenRecord([['processed', processed]]);
  } catch (error) {
    if (error instanceof RwaHealthOverlayError) throw error;
    mapDatabase(error);
  }
}
