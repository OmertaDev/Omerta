import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { RwaHealthError } from '../src/rwahealtherror.js';
import {
  createRwaHealthClearanceAttestationV2,
  expireRwaHealthClearancePackagesV2,
  normalizeRwaHealthClearanceCreateInputV2,
  normalizeRwaHealthClearanceReadInputV2,
  normalizeRwaHealthClearanceSubmissionInputV2,
  readRwaHealthClearancePackageV2,
  recordRwaHealthClearanceSubmissionV2,
} from '../src/rwahealthclearance.js';

const vector = JSON.parse(await readFile(
  new URL('./fixtures/rwa-health-overlay-v2-vectors.json', import.meta.url), 'utf8',
));

const HASH = (digit) => `0x${digit.repeat(64)}`;
const MATERIAL_EVENT = HASH('b');
const TRANSPORT = 'd'.repeat(64);
const SAFE_SERVICE_HASH = HASH('c');
const CATALOG_VERSION = '12';
const ACTIVATION_BLOCK = '91';
const ACTIVATION_LOG = '4';
const ACTIVATION_BLOCK_HASH = HASH('1');
const ACTIVATION_TX_HASH = HASH('2');
const ACTIVATION_EVIDENCE = HASH('3');
const ACTIVATION_REVIEW = HASH('e');
const ACTIVATION_APPROVED = '1893000000';
const ACTIVATION_VALID = '1893604800';
const ACTIVATION_INCLUDED = '1893000001';
const APPLIED_BLOCK = '100';
const APPLIED_BLOCK_HASH = HASH('f');
const OBSERVATION_HASH = HASH('d');
const PROVIDER_ENDPOINT_HASH = HASH('c');
const PROVIDER_COMMITMENT = HASH('d');
const EVALUATION_BATCH = HASH('e');
const EVALUATION_PAGE = HASH('f');
const EVALUATION_TIME = '2030-01-01T00:00:00.000Z';

process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = vector.registryAddress;
process.env.RWA_HEALTH_OVERLAY_V2_ADDRESS = vector.overlayAddress;
process.env.RWA_HEALTH_OVERLAY_V2_SAFE_ADDRESS = vector.safeAddress;
process.env.RWA_HEALTH_OVERLAY_V2_START_BLOCK = '0';

const nullRecord = (entries) => {
  const value = Object.create(null);
  for (const [key, item] of entries) value[key] = item;
  return Object.freeze(value);
};

function body(overrides = {}) {
  return {
    recoveryEvidenceBase64url: vector.recoveryEvidenceBase64url,
    expectedCatalogSnapshotHash: vector.clearance.catalogSnapshotHash,
    expectedEpisodeGeneration: vector.clearance.episodeGeneration,
    expectedCurrentSeverity: vector.clearance.currentSeverity,
    expectedStateSequence: vector.clearance.stateSequence,
    expectedEpisodeEventId: vector.clearance.latestEpisodeEventId,
    expectedMaterialEvidenceHash: vector.clearance.latestMaterialEvidenceHash,
    expectedEvaluationId: vector.clearance.freshHealthyEvaluationId,
    expectedEvaluationEvidenceHash: vector.clearance.freshHealthyEvidenceHash,
    expectedActivationGeneration: vector.clearance.activationGeneration,
    expectedOverlayGeneration: vector.clearance.expectedOverlayGeneration,
    expectedSafeNonce: null,
    ...overrides,
  };
}

const H1 = Object.freeze({
  ok: true,
  purpose: 'quarantine_clearance_broadcast',
  chainId: '4663',
  registryAddress: vector.registryAddress,
  catalogVersion: CATALOG_VERSION,
  catalogSnapshotHash: vector.clearance.catalogSnapshotHash,
  assetVersionKey: vector.clearance.assetVersionKey,
  evaluationId: vector.clearance.freshHealthyEvaluationId,
  evaluationKind: 'healthy',
  observedAt: EVALUATION_TIME,
  appliedAt: EVALUATION_TIME,
  freshThrough: '2030-01-01T00:10:00.000Z',
  stateSequence: vector.clearance.stateSequence,
  episodeId: vector.clearance.episodeId,
  episodeGeneration: vector.clearance.episodeGeneration,
  latestEpisodeEventId: vector.clearance.latestEpisodeEventId,
  latestMaterialEvidenceHash: vector.clearance.latestMaterialEvidenceHash,
});

const PRIVATE_CONTEXT = nullRecord([
  ['currentSeverity', vector.clearance.currentSeverity],
  ['evaluationId', vector.clearance.freshHealthyEvaluationId],
  ['evaluationEvidenceHash', vector.clearance.freshHealthyEvidenceHash],
  ['evaluationBatchId', EVALUATION_BATCH], ['evaluationPageId', EVALUATION_PAGE],
  ['evaluationObservedAt', EVALUATION_TIME], ['evaluationAppliedAt', EVALUATION_TIME],
  ['providerEndpointHash', PROVIDER_ENDPOINT_HASH], ['providerCommitment', PROVIDER_COMMITMENT],
  ['providerSourceState', 'observed'], ['providerByteCount', '3'],
  ['providerCapturedAt', EVALUATION_TIME], ['providerRetainUntil', '2030-02-05T00:00:00.000Z'],
  ['providerBodyBase64url', Buffer.from('raw').toString('base64url')],
]);

const ACTIVATION = nullRecord([
  ['chainId', '4663'], ['registryAddress', vector.registryAddress],
  ['assetVersionKey', vector.clearance.assetVersionKey],
  ['activationGeneration', vector.clearance.activationGeneration], ['active', true],
  ['localMatch', true], ['activationBlockNumber', ACTIVATION_BLOCK],
  ['activationBlockHash', ACTIVATION_BLOCK_HASH],
  ['activationTransactionHash', ACTIVATION_TX_HASH], ['activationLogIndex', ACTIVATION_LOG],
  ['catalogVersion', CATALOG_VERSION],
  ['catalogSnapshotHash', vector.clearance.catalogSnapshotHash],
  ['reviewId', ACTIVATION_REVIEW], ['evidenceHash', ACTIVATION_EVIDENCE],
  ['approvedAt', ACTIVATION_APPROVED], ['validUntil', ACTIVATION_VALID],
  ['includedAt', ACTIVATION_INCLUDED], ['appliedBlockNumber', APPLIED_BLOCK],
  ['appliedBlockHash', APPLIED_BLOCK_HASH], ['caughtUp', true], ['halted', false],
]);

const OVERLAY = nullRecord([
  ['chainId', '4663'], ['consumerKey', 'rwa_health_overlay_v2'],
  ['registryAddress', vector.registryAddress], ['overlayAddress', vector.overlayAddress],
  ['safeAddress', vector.safeAddress], ['startBlockNumber', '0'],
  ['appliedBlockNumber', APPLIED_BLOCK], ['appliedBlockHash', APPLIED_BLOCK_HASH],
  ['observationHash', OBSERVATION_HASH], ['finalizedHorizonBlockNumber', APPLIED_BLOCK],
  ['finalizedHorizonBlockHash', APPLIED_BLOCK_HASH], ['caughtUp', true], ['halted', false],
  ['readyVerifiedAt', '2030-01-01T00:00:00.000Z'],
  ['freshThrough', '2030-01-01T00:10:00.000Z'],
  ['assetVersionKey', vector.clearance.assetVersionKey], ['currentOverlayGeneration', '3'],
  ['nextOverlayGeneration', vector.clearance.expectedOverlayGeneration],
]);

const dependencies = Object.freeze({
  requireFreshRwaHealth: async (_client, key, expectation) => {
    assert.equal(key, vector.clearance.assetVersionKey);
    assert.equal(expectation.purpose, 'quarantine_clearance_broadcast');
    return H1;
  },
  readRwaHealthClearanceContext: async (_client, receipt) => {
    assert.equal(receipt, H1);
    return PRIVATE_CONTEXT;
  },
  requireFinalizedRwaActivationV2: async (_client, key, expectation) => {
    assert.equal(key, vector.clearance.assetVersionKey);
    assert.equal(expectation.expectedActivationGeneration, vector.clearance.activationGeneration);
    return ACTIVATION;
  },
  readRwaHealthOverlayAuthoringContextV2: async (_client, key) => {
    assert.equal(key, vector.clearance.assetVersionKey);
    return OVERLAY;
  },
});

function rowFromInsert(sql, params) {
  const match = sql.match(/\(([^]*?)\)\s*VALUES/i);
  assert(match, 'insert column list must be explicit');
  const columns = match[1].split(',').map((value) => value.trim());
  assert.equal(columns.length, params.length, 'test mapper expects one parameter per attestation/evidence column');
  return Object.fromEntries(columns.map((column, index) => [column, params[index]]));
}

class FakeClient {
  constructor(now = new Date(Number(BigInt(vector.clearance.approvedAt) * 1000n))) {
    this.now = now;
    this.attestation = null;
    this.evidence = null;
    this.proposal = null;
    this.calls = [];
    this.insertCount = 0;
    this.later = [];
    this.expiryRows = null;
  }

  currentRow() {
    return {
      catalog_snapshot_hash: vector.clearance.catalogSnapshotHash,
      current_episode_id: vector.clearance.episodeId,
      current_episode_generation: vector.clearance.episodeGeneration,
      current_severity: 'operational_quarantine',
      state_sequence: vector.clearance.stateSequence,
      latest_episode_event_id: vector.clearance.latestEpisodeEventId,
      latest_material_event_id: MATERIAL_EVENT,
      latest_material_evidence_hash: vector.clearance.latestMaterialEvidenceHash,
      last_evaluation_id: vector.clearance.freshHealthyEvaluationId,
      last_evaluation_evidence_hash: vector.clearance.freshHealthyEvidenceHash,
      last_applied_at: new Date(EVALUATION_TIME),
      clearance_applied_at: null,
    };
  }

  async query(sql, params = []) {
    const text = sql.replace(/\s+/g, ' ').trim();
    this.calls.push({ text, params });
    if (/SELECT current_severity,latest_material_event_id FROM rwa_health_current_v2/.test(text)) {
      return { rows: [{ current_severity: 'operational_quarantine', latest_material_event_id: MATERIAL_EVENT }], rowCount: 1 };
    }
    if (/ AS database_now$/.test(text)) return { rows: [{ database_now: this.now }], rowCount: 1 };
    if (/FROM rwa_health_clearance_attestations_v2 a JOIN rwa_health_clearance_safe_proposals_v2 p/.test(text)) {
      return { rows: this.proposal && ['safe_package_ready', 'safe_submitted'].includes(this.proposal.status)
        ? [{ clearance_id: this.proposal.clearance_id,
          semantic_request_hash: this.proposal.semantic_request_hash,
          status: this.proposal.status, clearance_deadline: this.proposal.clearance_deadline }]
        : [], rowCount: this.proposal ? 1 : 0 };
    }
    if (/SELECT \* FROM rwa_health_clearance_attestations_v2/.test(text)) {
      return { rows: this.attestation ? [{ ...this.attestation }] : [], rowCount: this.attestation ? 1 : 0 };
    }
    if (/SELECT \* FROM rwa_health_clearance_recovery_evidence_v2/.test(text)) {
      return { rows: this.evidence ? [{ ...this.evidence }] : [], rowCount: this.evidence ? 1 : 0 };
    }
    if (/SELECT \* FROM rwa_health_clearance_safe_proposals_v2/.test(text)) {
      return { rows: this.proposal ? [{ ...this.proposal }] : [], rowCount: this.proposal ? 1 : 0 };
    }
    if (/INSERT INTO rwa_health_clearance_attestations_v2/.test(text)) {
      this.attestation = rowFromInsert(sql, params);
      this.insertCount += 1;
      return { rows: [], rowCount: 1 };
    }
    if (/INSERT INTO rwa_health_clearance_recovery_evidence_v2/.test(text)) {
      this.evidence = rowFromInsert(sql, params);
      this.insertCount += 1;
      return { rows: [], rowCount: 1 };
    }
    if (/INSERT INTO rwa_health_clearance_safe_proposals_v2/.test(text)) {
      this.proposal = {
        clearance_id: params[0], semantic_request_hash: params[1], registry_address: params[2],
        asset_version_key: params[3], expected_overlay_generation: params[4],
        safe_address: params[5], to_address: params[6], value_wei: '0', operation: 0,
        calldata_hex: params[7], calldata_hash: params[8], expected_safe_nonce: params[9],
        safe_service_transaction_hash: null, execution_transaction_hash: null,
        status: 'safe_package_ready', approved_at: params[10], clearance_deadline: params[11],
        created_at: params[12], updated_at: params[12], submitted_at: null, finalized_at: null,
      };
      this.insertCount += 1;
      return { rows: [], rowCount: 1 };
    }
    if (/SELECT id FROM stock_catalog_sync_lock_v2/.test(text)) return { rows: [{ id: 1 }], rowCount: 1 };
    if (/SELECT catalog_snapshot_hash,current_episode_id/.test(text)) {
      return { rows: [this.currentRow()], rowCount: 1 };
    }
    if (/FROM rwa_health_evaluations_v2/.test(text)) return { rows: this.later.map((row) => ({ ...row })), rowCount: this.later.length };
    if (/SET status='safe_submitted'/.test(text)) {
      const canChange = this.proposal?.status === 'safe_package_ready'
        && this.proposal.safe_service_transaction_hash == null
        && BigInt(this.proposal.clearance_deadline) > BigInt(params[3]);
      if (canChange) Object.assign(this.proposal, {
        status: 'safe_submitted', safe_service_transaction_hash: params[1],
        submitted_at: params[2], updated_at: params[2],
      });
      return { rows: canChange ? [{ clearance_id: params[0] }] : [], rowCount: canChange ? 1 : 0 };
    }
    if (/SET status='approval_stale'/.test(text)) {
      const canChange = this.proposal?.clearance_id === params[0]
        && ['safe_package_ready', 'safe_submitted'].includes(this.proposal.status)
        && BigInt(this.proposal.clearance_deadline) <= BigInt(params[1]);
      if (canChange) this.proposal.status = 'approval_stale';
      return { rows: canChange ? [{ clearance_id: params[0] }] : [], rowCount: canChange ? 1 : 0 };
    }
    if (/SELECT clearance_id FROM rwa_health_clearance_safe_proposals_v2/.test(text)) {
      const rows = this.expiryRows ?? (this.proposal
        && ['safe_package_ready', 'safe_submitted'].includes(this.proposal.status)
        && BigInt(this.proposal.clearance_deadline) <= BigInt(params[0])
        ? [{ clearance_id: this.proposal.clearance_id }] : []);
      return { rows: rows.slice(0, params[1]), rowCount: Math.min(rows.length, params[1]) };
    }
    throw new Error(`unexpected SQL: ${text}`);
  }
}

async function rejectsCode(fn, code) {
  let caught;
  try { await fn(); } catch (error) { caught = error; }
  assert(caught, `expected ${code}`);
  assert.equal(caught.code, code);
  assert(!String(caught.message).includes(vector.clearance.assetVersionKey), 'errors stay secret-safe');
  return caught;
}

// Exact route-level validation is synchronous, ordered, immutable, and branded.
const normalized = normalizeRwaHealthClearanceCreateInputV2(vector.clearance.assetVersionKey, body());
assert.equal(Object.getPrototypeOf(normalized), null);
assert(Object.isFrozen(normalized));
assert.deepEqual(Object.keys(normalized), ['assetVersionKey', ...Object.keys(body())]);
assert.throws(() => { normalized.expectedSafeNonce = '1'; }, TypeError);
await rejectsCode(() => createRwaHealthClearanceAttestationV2({ query() { throw new Error('queried'); } },
  { reviewerId: vector.reviewerId, transportKeyHash: TRANSPORT }, { ...normalized }, dependencies), 'h2_input');

const reorderedBody = body();
const moved = reorderedBody.recoveryEvidenceBase64url;
delete reorderedBody.recoveryEvidenceBase64url;
reorderedBody.recoveryEvidenceBase64url = moved;
for (const invalid of [
  reorderedBody,
  Object.assign(Object.create({ inherited: true }), body()),
  { ...body(), unknown: true },
  body({ recoveryEvidenceBase64url: `${vector.recoveryEvidenceBase64url}=` }),
  body({ expectedSafeNonce: 0 }),
  body({ expectedSafeNonce: '00' }),
  body({ expectedStateSequence: '9223372036854775808' }),
]) {
  await rejectsCode(() => normalizeRwaHealthClearanceCreateInputV2(vector.clearance.assetVersionKey, invalid), 'h2_input');
}
const accessorBody = body();
Object.defineProperty(accessorBody, 'expectedSafeNonce', { enumerable: true, get() { throw new Error('getter'); } });
await rejectsCode(() => normalizeRwaHealthClearanceCreateInputV2(vector.clearance.assetVersionKey, accessorBody), 'h2_input');

const actorAccessor = { reviewerId: vector.reviewerId, transportKeyHash: TRANSPORT };
Object.defineProperty(actorAccessor, 'transportKeyHash', { enumerable: true, get() { throw new Error('getter'); } });
await rejectsCode(() => createRwaHealthClearanceAttestationV2(new FakeClient(), actorAccessor, normalized, dependencies), 'h2_input');

// The domain builder matches the frozen Solidity/JavaScript vector byte-for-byte.
const client = new FakeClient();
const created = await createRwaHealthClearanceAttestationV2(client,
  { reviewerId: vector.reviewerId, transportKeyHash: TRANSPORT }, normalized, dependencies);
assert.equal(created.clearanceId, vector.outputs.clearanceId);
assert.equal(created.approvedAt, vector.clearance.approvedAt);
assert.equal(created.clearanceDeadline, vector.clearance.clearanceDeadline);
assert.equal(created.clearancePayloadHash, vector.outputs.clearancePayloadHash);
assert.equal(created.safeCallIntentHash, vector.outputs.safeCallIntentHash);
assert.equal(created.calldataHash, vector.outputs.calldataHash);
assert.equal(created.safeTransaction.data, vector.outputs.calldata);
assert.equal(created.safeTransaction.to, vector.overlayAddress);
assert.equal(created.safeTransaction.value, '0');
assert.equal(created.safeTransaction.operation, 0);
assert.equal(created.status, 'safe_package_ready');
assert.equal(created.changed, true);
assert.equal(client.insertCount, 3);
assert.equal(client.attestation.first_transport_key_hash, TRANSPORT);
assert.equal(client.attestation.reviewer_id, vector.reviewerId);
assert.equal(client.attestation.reviewer_id_hash, vector.outputs.reviewerIdHash);
assert.equal(client.attestation.recovery_evidence_hash, vector.outputs.recoveryEvidenceHash);
assert(!JSON.stringify(created).includes(vector.recoveryEvidenceBase64url));
assert(!JSON.stringify(created).includes(vector.reviewerId));
assert(!JSON.stringify(created).includes('raw'));

// Open-only semantic replay preserves the first HTTP provenance and current open status.
const replay = await createRwaHealthClearanceAttestationV2(client,
  { reviewerId: vector.reviewerId, transportKeyHash: 'a'.repeat(64) }, normalized, dependencies);
assert.equal(replay.clearanceId, created.clearanceId);
assert.equal(replay.changed, false);
assert.equal(client.insertCount, 3);
assert.equal(client.attestation.first_transport_key_hash, TRANSPORT);

const alternate = normalizeRwaHealthClearanceCreateInputV2(vector.clearance.assetVersionKey,
  body({ recoveryEvidenceBase64url: Buffer.from('different recovery evidence').toString('base64url') }));
await rejectsCode(() => createRwaHealthClearanceAttestationV2(client,
  { reviewerId: vector.reviewerId, transportKeyHash: 'b'.repeat(64) }, alternate, dependencies),
'h2_semantic_conflict');

// Submission rechecks every authority seam and the zero-delta healthy-only proof before CAS.
client.now = new Date((Number(BigInt(vector.clearance.approvedAt)) + 1) * 1000);
const submissionInput = normalizeRwaHealthClearanceSubmissionInputV2(
  vector.clearance.assetVersionKey, created.clearanceId, { safeTransactionHash: SAFE_SERVICE_HASH },
);
const submitted = await recordRwaHealthClearanceSubmissionV2(
  client, vector.reviewerId, submissionInput, dependencies,
);
assert.deepEqual(Object.keys(submitted), [
  'clearanceId', 'assetVersionKey', 'status', 'safeServiceTransactionHash', 'changed',
]);
assert.equal(submitted.status, 'safe_submitted');
assert.equal(submitted.changed, true);
assert.equal(client.proposal.safe_service_transaction_hash, SAFE_SERVICE_HASH);
assert.equal(client.attestation.clearance_payload_hash, vector.outputs.clearancePayloadHash,
  'submission never rewrites the package');

const submittedReplay = await recordRwaHealthClearanceSubmissionV2(
  client, vector.reviewerId, submissionInput, dependencies,
);
assert.equal(submittedReplay.changed, false);
const conflictingSubmission = normalizeRwaHealthClearanceSubmissionInputV2(
  vector.clearance.assetVersionKey, created.clearanceId, { safeTransactionHash: HASH('9') },
);
await rejectsCode(() => recordRwaHealthClearanceSubmissionV2(
  client, vector.reviewerId, conflictingSubmission, dependencies,
), 'h2_submission_conflict');

// The exact deadline is half-open. Read normalization is durable and omits `changed`.
client.now = new Date(Number(BigInt(vector.clearance.clearanceDeadline) * 1000n));
const readInput = normalizeRwaHealthClearanceReadInputV2(vector.clearance.assetVersionKey, created.clearanceId);
const read = await readRwaHealthClearancePackageV2(client, vector.reviewerId, readInput);
assert.equal(read.status, 'approval_stale');
assert.equal(Object.hasOwn(read, 'changed'), false);
assert.equal(client.proposal.status, 'approval_stale');
await rejectsCode(() => recordRwaHealthClearanceSubmissionV2(
  client, vector.reviewerId, submissionInput, dependencies,
), 'h2_submission_terminal');

const missing = new FakeClient();
await rejectsCode(() => readRwaHealthClearancePackageV2(missing, vector.reviewerId,
  normalizeRwaHealthClearanceReadInputV2(vector.clearance.assetVersionKey, HASH('a'))),
'h2_package_not_found');

// Bounded expiry is fixed at <=100 and idempotently handles an empty/terminal set.
const expiry = await expireRwaHealthClearancePackagesV2(client, 100);
assert.equal(expiry.processed, 0);
await rejectsCode(() => expireRwaHealthClearancePackagesV2(client, 101), 'h2_input');
await rejectsCode(() => expireRwaHealthClearancePackagesV2(client, 0), 'h2_input');

// Closed dependency errors are mapped without leaking raw codes.
const failingDependencies = Object.freeze({
  ...dependencies,
  requireFreshRwaHealth: async () => { throw new RwaHealthError('health_not_fresh'); },
});
const noRows = new FakeClient();
await rejectsCode(() => createRwaHealthClearanceAttestationV2(noRows,
  { reviewerId: vector.reviewerId, transportKeyHash: TRANSPORT }, normalized, failingDependencies),
'h2_health_not_authoritative');
assert.equal(noRows.calls.length, 0, 'injected H1 failure occurs before H2/domain queries');

console.log('rwa health H2 clearance package tests passed (31 assertions/groups)');
