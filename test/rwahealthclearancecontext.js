import assert from 'node:assert/strict';
import {
  keccak256, toBytes,
} from 'viem';

import {
  deriveRwaActiveSetHash, deriveRwaBatchId, deriveRwaEvaluationIds,
  deriveRwaExpectedIdentityHash, deriveRwaPageId, RwaHealthError,
  RWA_HEALTH_PROVIDER_ENDPOINT_HASH, RWA_HEALTH_RULE_SET_HASH,
} from '../src/rwahealth.js';
import {
  readRwaHealthClearanceContext, requireFreshRwaHealth,
} from '../src/rwahealthread.js';

const HASH = (byte) => `0x${byte.repeat(64)}`;
const REGISTRY = `0x${'1'.repeat(40)}`;
const SNAPSHOT = HASH('2');
const ASSET = HASH('3');
const TOKEN = `0x${'4'.repeat(40)}`;
const PROVIDER_ID_HASH = HASH('5');
const EPISODE = HASH('6');
const EPISODE_EVENT = HASH('7');
const MATERIAL_EVIDENCE = HASH('8');
const OBSERVED_AT = '2033-05-18T03:33:20.000Z';
const APPLIED_AT = '2033-05-18T03:33:21.000Z';
const CAPTURED_AT = '2033-05-18T03:33:19.000Z';
const RETAIN_UNTIL = '2033-06-22T03:33:19.000Z';
const BODY = toBytes('{"assets":[]}');
const PROVIDER_COMMITMENT = keccak256(BODY);
const IDENTITY = Object.freeze({
  chainId: '4663', registryAddress: REGISTRY, catalogVersion: '7',
  catalogSnapshotHash: SNAPSHOT, assetVersionKey: ASSET, normalizedTicker: 'AAPL',
  tokenAddress: TOKEN, tokenDecimals: 18, robinhoodAssetIdHash: PROVIDER_ID_HASH,
});
const EXPECTED_IDENTITY_HASH = deriveRwaExpectedIdentityHash(IDENTITY);
const ACTIVE_SET_HASH = deriveRwaActiveSetHash([EXPECTED_IDENTITY_HASH]);
const BATCH = deriveRwaBatchId({
  registryAddress: REGISTRY, catalogVersion: '7', catalogSnapshotHash: SNAPSHOT,
  activeSetHash: ACTIVE_SET_HASH, cycleSlot: '123', providerCommitment: PROVIDER_COMMITMENT,
});
const PAGE = deriveRwaPageId({
  batchId: BATCH, pageIndex: 0, firstAssetVersionKey: ASSET,
  lastAssetVersionKey: ASSET, itemCount: 1,
});
const EVALUATION = deriveRwaEvaluationIds({
  batchId: BATCH, pageId: PAGE, identity: IDENTITY,
  predicateValues: [0, 0, 0, 0, 0, 0, 0], evaluationKind: 0,
  providerCommitment: PROVIDER_COMMITMENT,
});
const RECEIPT_KEYS = Object.freeze([
  'ok', 'purpose', 'chainId', 'registryAddress', 'catalogVersion', 'catalogSnapshotHash',
  'assetVersionKey', 'evaluationId', 'evaluationKind', 'observedAt', 'appliedAt',
  'freshThrough', 'stateSequence', 'episodeId', 'episodeGeneration',
  'latestEpisodeEventId', 'latestMaterialEvidenceHash',
]);
const CONTEXT_KEYS = Object.freeze([
  'currentSeverity', 'evaluationId', 'evaluationEvidenceHash', 'evaluationBatchId',
  'evaluationPageId', 'evaluationObservedAt', 'evaluationAppliedAt',
  'providerEndpointHash', 'providerCommitment', 'providerSourceState',
  'providerByteCount', 'providerCapturedAt', 'providerRetainUntil',
  'providerBodyBase64url',
]);

const failures = [];
let passes = 0;
async function test(name, run) {
  try { await run(); passes += 1; } catch (error) {
    error.message = `${name}: ${error.message}`;
    failures.push(error);
  }
}

async function rejectsCode(run, code) {
  let caught;
  try { await run(); } catch (error) { caught = error; }
  assert(caught, `expected ${code}`);
  assert(caught instanceof RwaHealthError, 'stable failures use RwaHealthError');
  assert.equal(caught.code, code);
}

function privateRow(overrides = {}) {
  return {
    current_severity: 'operational_quarantine',
    evaluation_id: EVALUATION.evaluationId, evidence_hash: EVALUATION.evidenceHash,
    batch_id: BATCH, page_id: PAGE, chain_id: 4663, registry_address: REGISTRY,
    catalog_version: '7', catalog_snapshot_hash: SNAPSHOT, asset_version_key: ASSET,
    normalized_ticker: 'AAPL', token_address: TOKEN, token_decimals: 18,
    robinhood_asset_id_hash: PROVIDER_ID_HASH,
    expected_identity_hash: EVALUATION.expectedIdentityHash,
    predicate_commitment: EVALUATION.predicateCommitment,
    provider_record: 0, supported_chain: 0, ticker_identity: 0, token_identity: 0,
    token_decimals_result: 0, provider_active: 0, fractional_tradable: 0,
    evaluation_kind: 'healthy', evaluation_status: 'applied',
    observed_at: new Date(OBSERVED_AT), applied_at: new Date(APPLIED_AT),
    active_set_hash: ACTIVE_SET_HASH, rule_set_hash: RWA_HEALTH_RULE_SET_HASH,
    provider_endpoint_hash: RWA_HEALTH_PROVIDER_ENDPOINT_HASH,
    provider_commitment: PROVIDER_COMMITMENT, cycle_slot: '123',
    batch_source_state: 'observed', failure_code: null, batch_status: 'complete',
    page_index: 0, first_asset_version_key: ASSET, last_asset_version_key: ASSET,
    item_count: 1, page_status: 'applied', page_applied_at: new Date(APPLIED_AT),
    raw_body_hash: PROVIDER_COMMITMENT, evidence_source_state: 'observed',
    byte_count: BODY.byteLength, body_bytes: Buffer.from(BODY),
    captured_at: new Date(CAPTURED_AT), retain_until: new Date(RETAIN_UNTIL),
    ...overrides,
  };
}

function currentRow() {
  return {
    catalog_version: '7', catalog_snapshot_hash: SNAPSHOT,
    last_evaluation_id: EVALUATION.evaluationId, latest_evaluation_kind: 'healthy',
    last_observed_at: new Date(OBSERVED_AT), last_applied_at: new Date(APPLIED_AT),
    checked_now: new Date('2033-05-18T03:35:00.000Z'),
    fresh_through: new Date('2033-05-18T03:43:20.000Z'), is_fresh: true,
    state_sequence: '7', current_episode_id: EPISODE, current_episode_generation: '1',
    latest_episode_event_id: EPISODE_EVENT,
    latest_material_evidence_hash: MATERIAL_EVIDENCE, clearance_applied_at: null,
  };
}

function makeClient({ privateRows = [privateRow()] } = {}) {
  const calls = [];
  const target = {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('stock_catalog_sync_lock_v2')) return { rows: [{ id: 1 }] };
      if (sql.includes('extract(epoch FROM')) {
        return { rows: [{ now: new Date('2033-05-18T03:35:00.000Z'), epoch: '2000000100' }] };
      }
      if (sql.includes('rwa_health_v2_catalog_state')
          || sql.includes('rwa_health_v2_catalog_confirm')) {
        return { rows: [{
          chain_id: 4663, registry_address: REGISTRY, catalog_version: '7',
          snapshot_hash: SNAPSHOT, ready_verified_at: new Date('2033-05-18T03:35:00.000Z'),
          caught_up: true, mirror_stale: false, getter_identity_matches: true,
        }] };
      }
      if (sql.includes('rwa_health_v2_all_versions')) return { rows: [{
        asset_version_key: ASSET, ticker: 'AAPL', token_address: TOKEN, token_decimals: 18,
        robinhood_asset_id_hash: PROVIDER_ID_HASH, active: true,
        registered_at: new Date(OBSERVED_AT), activated_at: new Date(OBSERVED_AT),
        deactivated_at: null,
      }] };
      if (sql.includes('rwa_health_apply_lock_v2')) return { rows: [{ id: 1 }] };
      if (sql.includes('rwa_health_runtime_v2')) return { rows: [{ capacity_exceeded: false }] };
      if (sql.includes(' AS checked_now') && !sql.includes('FROM rwa_health_current_v2')) {
        return { rows: [{ checked_now: new Date('2033-05-18T03:35:00.000Z') }] };
      }
      if (sql.includes('FROM rwa_health_current_v2 c')
          && !sql.includes('FROM rwa_health_evaluations_v2 e')) return { rows: [currentRow()] };
      if (sql.includes('FROM rwa_health_evaluations_v2 e')) return { rows: privateRows };
      assert.fail(`unexpected SQL: ${sql}`);
    },
  };
  const client = new Proxy(target, {
    get(object, property) {
      if (!['query', 'calls'].includes(property)) {
        assert.fail(`private seam accessed client capability ${String(property)}`);
      }
      return object[property];
    },
  });
  return client;
}

const clearanceArgs = () => ({
  expectedEvaluationId: EVALUATION.evaluationId,
  purpose: 'quarantine_clearance_broadcast', expectedEpisodeGeneration: '1',
  expectedStateSequence: '7', expectedEpisodeEventId: EPISODE_EVENT,
  expectedMaterialEvidenceHash: MATERIAL_EVIDENCE,
});

async function issue(client) {
  return requireFreshRwaHealth(client, ASSET, clearanceArgs());
}

const priorEnv = {
  rpc: process.env.CHAIN_RPC_URL,
  registry: process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS,
  start: process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK,
};
process.env.CHAIN_RPC_URL = 'https://configured-rpc.invalid';
process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = REGISTRY;
process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK = '1';

await test('exports the exact deeply frozen private context without mutable capabilities', async () => {
  assert.equal(typeof readRwaHealthClearanceContext, 'function');
  const client = makeClient();
  const receipt = await issue(client);
  assert.deepEqual(Object.keys(receipt), RECEIPT_KEYS);
  const context = await readRwaHealthClearanceContext(client, receipt);
  assert.equal(Object.getPrototypeOf(context), null);
  assert.deepEqual(Object.keys(context), CONTEXT_KEYS);
  assert(Object.isFrozen(context));
  assert.equal(context.currentSeverity, '2');
  assert.equal(context.evaluationEvidenceHash, EVALUATION.evidenceHash);
  assert.equal(context.evaluationBatchId, BATCH);
  assert.equal(context.evaluationPageId, PAGE);
  assert.equal(context.providerEndpointHash, RWA_HEALTH_PROVIDER_ENDPOINT_HASH);
  assert.equal(context.providerCommitment, PROVIDER_COMMITMENT);
  assert.equal(context.providerSourceState, 'observed');
  assert.equal(context.providerByteCount, String(BODY.byteLength));
  assert.equal(context.providerBodyBase64url, Buffer.from(BODY).toString('base64url'));
  assert(!Object.values(context).some((value) => value instanceof Uint8Array));
  assert.throws(() => { context.providerBodyBase64url = 'substituted'; }, TypeError);
  assert.equal(context.providerBodyBase64url, Buffer.from(BODY).toString('base64url'));
});

await test('accepts only the authentic same-client frozen H1 clearance receipt', async () => {
  const client = makeClient();
  const receipt = await issue(client);
  const before = client.calls.length;
  const forged = Object.freeze({ ...receipt });
  await rejectsCode(() => readRwaHealthClearanceContext(client, forged), 'health_bad_input');
  assert.equal(client.calls.length, before, 'forged receipt rejected before query');

  const other = makeClient();
  await rejectsCode(() => readRwaHealthClearanceContext(other, receipt), 'health_bad_input');
  assert.equal(other.calls.length, 0, 'cross-transaction receipt rejected before query');

  const reordered = {};
  for (const key of [...RECEIPT_KEYS].reverse()) reordered[key] = receipt[key];
  await rejectsCode(() => readRwaHealthClearanceContext(client, Object.freeze(reordered)),
    'health_bad_input');
  const inherited = Object.create(receipt);
  Object.freeze(inherited);
  await rejectsCode(() => readRwaHealthClearanceContext(client, inherited), 'health_bad_input');
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'ok', { get() { getterCalls += 1; return true; } });
  Object.freeze(accessor);
  await rejectsCode(() => readRwaHealthClearanceContext(client, accessor), 'health_bad_input');
  assert.equal(getterCalls, 0, 'untrusted accessors are never invoked');
});

await test('uses one exact identity-bound private read and owns no transaction or transport', async () => {
  const client = makeClient();
  const receipt = await issue(client);
  const before = client.calls.length;
  await readRwaHealthClearanceContext(client, receipt);
  const calls = client.calls.slice(before);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /JOIN rwa_health_current_v2 c/);
  assert.match(calls[0].sql, /JOIN rwa_health_batches_v2 b/);
  assert.match(calls[0].sql, /JOIN rwa_health_pages_v2 p/);
  assert.match(calls[0].sql, /LEFT JOIN rwa_health_private_provider_evidence_v2 v/);
  assert.deepEqual(calls[0].params, [
    EVALUATION.evaluationId, REGISTRY, ASSET, '7', SNAPSHOT, OBSERVED_AT, APPLIED_AT,
    '7', EPISODE, '1', EPISODE_EVENT, MATERIAL_EVIDENCE,
  ]);
  assert(!/\bBEGIN\b|\bCOMMIT\b|\bROLLBACK\b|https?:|eth_/i.test(calls[0].sql));
});

await test('rejects absent, substituted, corrupt, or source-failure provider evidence', async () => {
  const cases = [
    ['absent', null],
    ['cross-batch', { batch_id: HASH('a') }],
    ['cross-page', { page_id: HASH('b') }],
    ['altered bytes', { body_bytes: Buffer.from('altered') }],
    ['altered byte count', { byte_count: BODY.byteLength + 1 }],
    ['altered raw hash', { raw_body_hash: HASH('c') }],
    ['missing body', { body_bytes: null }],
    ['unknown batch source', { batch_source_state: 'unknown', failure_code: 'provider_http' }],
    ['unknown evidence source', { evidence_source_state: 'unknown' }],
    ['rule-set substitution', { rule_set_hash: HASH('9') }],
    ['endpoint substitution', { provider_endpoint_hash: HASH('d') }],
    ['batch commitment substitution', { provider_commitment: HASH('e') }],
    ['batch identity substitution', { cycle_slot: '124' }],
    ['page identity substitution', { item_count: 2 }],
    ['unapplied page', { page_status: 'planned', page_applied_at: null }],
    ['crossed apply time', { page_applied_at: new Date(OBSERVED_AT) }],
    ['short retention', { retain_until: new Date('2033-06-21T03:33:18.999Z') }],
    ['wrong evaluation evidence', { evidence_hash: HASH('f') }],
    ['wrong expected identity', { expected_identity_hash: HASH('a') }],
    ['wrong predicate commitment', { predicate_commitment: HASH('b') }],
    ['nonhealthy predicates', { provider_record: 1 }],
    ['source severity missing', { current_severity: null }],
  ];
  for (const [name, mutation] of cases) {
    const client = makeClient({ privateRows: mutation === null ? [] : [privateRow(mutation)] });
    const receipt = await issue(client);
    await rejectsCode(() => readRwaHealthClearanceContext(client, receipt),
      'health_evidence_conflict');
    assert.equal(client.calls.filter((call) => call.sql.includes(
      'FROM rwa_health_evaluations_v2 e')).length, 1, name);
  }
});

await test('maps the frozen H1 severity and canonicalizes database scalar representations', async () => {
  const client = makeClient({ privateRows: [privateRow({
    current_severity: 'health_unknown', byte_count: String(BODY.byteLength),
    token_decimals: '18', page_index: '0', item_count: '1',
  })] });
  const receipt = await issue(client);
  const context = await readRwaHealthClearanceContext(client, receipt);
  assert.equal(context.currentSeverity, '1');
  assert.equal(context.providerByteCount, String(BODY.byteLength));
  for (const time of [context.evaluationObservedAt, context.evaluationAppliedAt,
    context.providerCapturedAt, context.providerRetainUntil]) {
    assert.equal(new Date(time).toISOString(), time);
  }
});

if (priorEnv.rpc === undefined) delete process.env.CHAIN_RPC_URL;
else process.env.CHAIN_RPC_URL = priorEnv.rpc;
if (priorEnv.registry === undefined) delete process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
else process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = priorEnv.registry;
if (priorEnv.start === undefined) delete process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK;
else process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK = priorEnv.start;

if (failures.length) {
  console.error(`rwahealthclearancecontext: ${passes} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(failure.stack || failure);
  process.exitCode = 1;
} else {
  console.log(`rwahealthclearancecontext: ${passes} passed`);
}
