import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getAddress, keccak256, toBytes } from 'viem';

import {
  RwaHealthError,
  deriveRwaHealthIds,
  evaluateRwaHealthAsset,
  fetchRwaHealthProvider,
  healthDbNowSql,
  parseRwaHealthProviderBody,
} from '../src/rwahealth.js';
import { requireFreshRwaHealth } from '../src/rwahealthread.js';

const vectors = JSON.parse(await readFile(
  new URL('./fixtures/rwa-health-v2-vectors.json', import.meta.url),
  'utf8',
));

const ZERO_HASH = `0x${'00'.repeat(32)}`;
const HASH = (byte) => `0x${byte.repeat(64)}`;
const KEY = HASH('3');
const expected = Object.freeze({
  chainId: '4663',
  registryAddress: getAddress(vectors.formula.registryAddress).toLowerCase(),
  catalogVersion: '7',
  catalogSnapshotHash: HASH('2'),
  assetVersionKey: KEY,
  normalizedTicker: 'AAPL',
  tokenAddress: getAddress(vectors.formula.tokenAddress).toLowerCase(),
  tokenDecimals: 18,
  robinhoodAssetIdHash: vectors.healthy.outputs.robinhoodAssetIdHash,
  active: true,
});
const PASS = Object.freeze([
  { code: 'provider_record', result: 'pass' },
  { code: 'supported_chain', result: 'pass' },
  { code: 'ticker_identity', result: 'pass' },
  { code: 'token_identity', result: 'pass' },
  { code: 'token_decimals', result: 'pass' },
  { code: 'provider_active', result: 'pass' },
  { code: 'fractional_tradable', result: 'pass' },
]);
const encoder = new TextEncoder();
const bytes = (value) => encoder.encode(value);

const failures = [];
let passes = 0;
async function test(name, run) {
  try {
    await run();
    passes += 1;
  } catch (error) {
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

async function rejectsProviderFailure(run, providerFailureCode, publicCode = null) {
  let caught;
  try { await run(); } catch (error) { caught = error; }
  assert(caught, `expected ${providerFailureCode}`);
  assert.equal(caught.providerFailureCode, providerFailureCode);
  if (publicCode !== null) {
    assert(caught instanceof RwaHealthError, 'transport failures use stable public errors');
    assert.equal(caught.code, publicCode);
  }
}

function bodyWithAsset(overrides = {}, deploymentOverrides = {}) {
  const asset = {
    id: vectors.healthy.providerId,
    tokenSymbol: 'AAPL',
    deployments: [{
      chainId: 4663,
      contractAddress: vectors.formula.tokenAddress,
      ...deploymentOverrides,
    }],
    status: 'ASSET_STATUS_ACTIVE',
    tradingCapabilities: { fractionalTradability: 'tradable' },
    tokenDecimals: 18,
    ...overrides,
  };
  return bytes(JSON.stringify({ assets: [asset] }));
}

function parse(body) {
  return parseRwaHealthProviderBody(body);
}

function evaluate(body, identity = expected) {
  return evaluateRwaHealthAsset(identity, parse(body));
}

function deriveEvaluation(body, identity = expected) {
  const evaluation = evaluate(body, identity);
  return {
    ...evaluation,
    ...deriveRwaHealthIds({
      ...vectors.formula,
      ...identity,
      providerBody: new TextDecoder().decode(body),
      predicates: evaluation.predicateValues,
      evaluationKind: ['healthy', 'health_unknown', 'operational_quarantine']
        .indexOf(evaluation.evaluationKind),
      pageIndex: 0,
      firstAssetVersionKey: identity.assetVersionKey,
      lastAssetVersionKey: identity.assetVersionKey,
      itemCount: 1,
      eventKind: 0,
      resultingSeverity: 2,
      sourceId: vectors.formula.outputs.reviewerActionId,
    }),
  };
}

await test('exports the closed H1 domain surface and stable error vocabulary', () => {
  for (const fn of [
    deriveRwaHealthIds, evaluateRwaHealthAsset, fetchRwaHealthProvider,
    healthDbNowSql, parseRwaHealthProviderBody, requireFreshRwaHealth,
  ]) assert.equal(typeof fn, 'function');
  assert.deepEqual(RwaHealthError.CODES, Object.freeze([
    'health_bad_input', 'health_asset_not_found', 'health_registry_unavailable',
    'health_registry_stale', 'health_snapshot_changed', 'health_work_oversized',
    'health_capacity_exceeded', 'health_slot_conflict', 'health_page_conflict',
    'health_provider_timeout', 'health_provider_http', 'health_provider_oversized',
    'health_provider_malformed', 'health_evidence_conflict', 'health_evidence_limit',
    'health_state_conflict', 'health_not_fresh', 'health_blocked',
  ]));
});

await test('literal formula and semantic healthy vectors bind all IDs independently', () => {
  const formula = deriveRwaHealthIds({
    ...vectors.formula,
    predicates: [0, 0, 0, 0, 0, 0, 0],
    evaluationKind: 0,
    pageIndex: 0,
    firstAssetVersionKey: KEY,
    lastAssetVersionKey: KEY,
    itemCount: 1,
    eventKind: 0,
    resultingSeverity: 2,
    sourceId: vectors.formula.outputs.reviewerActionId,
  });
  for (const [name, value] of Object.entries(vectors.formula.outputs)) {
    assert.equal(formula[name], value, `literal ${name}`);
  }
  const healthy = deriveEvaluation(bytes(vectors.healthy.providerBody));
  assert.equal(keccak256(bytes(vectors.healthy.providerBody)), vectors.healthy.outputs.providerBodyHash);
  assert.deepEqual(healthy.predicates, PASS);
  assert.equal(healthy.evaluationKind, 'healthy');
  for (const [name, value] of Object.entries(vectors.healthy.outputs)) {
    assert.equal(healthy[name], value, `semantic ${name}`);
  }
  const validMutation = {
    registryAddress: `0x${'8'.repeat(40)}`, catalogVersion: '8', catalogSnapshotHash: HASH('8'),
    assetVersionKey: HASH('8'), normalizedTicker: 'MSFT', tokenAddress: `0x${'8'.repeat(40)}`,
    tokenDecimals: 19, robinhoodAssetIdHash: HASH('8'), cycleSlot: '123457',
    providerBody: '{"assets":[]} ', episodeGeneration: '2', reviewerId: 'reviewer-two',
    requestedState: 1, ruleCode: 'reviewer_verification_unknown', reasonHash: HASH('8'),
    reviewerEvidenceHash: HASH('8'),
  };
  for (const field of Object.keys(validMutation)) {
    const changed = structuredClone(vectors.formula);
    changed[field] = validMutation[field];
    assert.notDeepEqual(deriveRwaHealthIds({
      ...changed, predicates: [0, 0, 0, 0, 0, 0, 0], evaluationKind: 0,
      pageIndex: 0, firstAssetVersionKey: KEY, lastAssetVersionKey: KEY, itemCount: 1,
      eventKind: 0, resultingSeverity: 2, sourceId: vectors.formula.outputs.reviewerActionId,
    }), formula, `${field} participates in the commitment domain`);
  }
});

await test('bounded lexical parser preserves number spelling and rejects duplicate keys', () => {
  const valid = parse(bytes(vectors.healthy.providerBody));
  assert.equal(Object.getPrototypeOf(valid), null);
  assert.equal(Object.getPrototypeOf(valid.assets[0]), null);
  assert.equal(Object.getPrototypeOf(valid.assets[0].deployments[0]), null);
  for (const token of ['18.0', '1.8e1', '-18']) {
    const mutated = vectors.healthy.providerBody.replace('"tokenDecimals":18', `"tokenDecimals":${token}`);
    assert.equal(evaluate(bytes(mutated)).predicates[4].result, 'unknown', token);
  }
  for (const token of ['+18', '018']) {
    const mutated = vectors.healthy.providerBody.replace('"tokenDecimals":18', `"tokenDecimals":${token}`);
    assert.throws(() => parse(bytes(mutated)), /malformed/i, `${token} is not JSON number grammar`);
  }
  for (const duplicate of [
    '{"assets":[],"assets":[]}',
    '{"assets":[{"id":"x","id":"y"}]}',
    '{"assets":[{"id":"x","deployments":[{"chainId":1,"chainId":4663}]}]}',
    '{"assets":[{"id":"x","tradingCapabilities":{"fractionalTradability":"tradable","fractionalTradability":"untradable"}}]}',
  ]) assert.throws(() => parse(bytes(duplicate)), /duplicate/i);
  assert.throws(() => parse(Uint8Array.from([0xc3, 0x28])), /utf|malformed/i);
  assert.throws(() => parse(bytes('['.repeat(33) + ']'.repeat(33))), /depth|malformed/i);
  assert.throws(() => parse(bytes(`{"${'k'.repeat(129)}":0}`)), /key|malformed/i);
  assert.throws(() => parse(bytes(`{"assets":[],"x":"${'a'.repeat(4097)}"}`)), /string|malformed/i);
});

await test('closed parser distinguishes verified failures from unknown states', () => {
  const cases = [
    [{ tokenSymbol: 'MSFT' }, 2, 'ticker_identity'],
    [{ tokenSymbol: null }, 1, 'ticker_identity'],
    [{ tokenDecimals: 19 }, 2, 'token_decimals'],
    [{ tokenDecimals: '18' }, 1, 'token_decimals'],
    [{ status: 'ASSET_STATUS_INACTIVE' }, 2, 'provider_active'],
    [{ status: 'future_status' }, 1, 'provider_active'],
    [{ tradingCapabilities: { fractionalTradability: 'untradable' } }, 2, 'fractional_tradable'],
    [{ tradingCapabilities: { fractionalTradability: 'future' } }, 1, 'fractional_tradable'],
  ];
  for (const [override, result, rule] of cases) {
    const evaluation = evaluate(bodyWithAsset(override));
    assert.equal(evaluation.predicates.find((entry) => entry.code === rule).result,
      result === 2 ? 'verified_failure' : 'unknown');
    assert.equal(evaluation.evaluationKind,
      result === 2 ? 'operational_quarantine' : 'health_unknown');
    assert.equal(evaluation.ruleCode, rule);
  }
  const otherChain = evaluate(bodyWithAsset({}, { chainId: 1 }));
  assert.equal(otherChain.predicates[1].result, 'verified_failure');
  assert.equal(otherChain.ruleCode, 'supported_chain');
  for (const chainId of ['4663', -1, 4663.0, 4.663e3, null]) {
    const text = new TextDecoder().decode(bodyWithAsset({}, { chainId }));
    const malformed = chainId === 4663.0
      ? text.replace('"chainId":4663', '"chainId":4663.0')
      : chainId === 4.663e3
        ? text.replace('"chainId":4663', '"chainId":4.663e3') : text;
    assert.throws(() => evaluate(bytes(malformed)), /malformed/i,
      'non-uint64 deployment chain IDs make the provider observation malformed');
  }
});

await test('identity ambiguity and malformed deployments fail the whole observation', () => {
  const asset = JSON.parse(new TextDecoder().decode(bodyWithAsset())).assets[0];
  for (const mutation of [
    { ...asset, deployments: [...asset.deployments, ...asset.deployments] },
    { ...asset, deployments: [{ chainId: 1, contractAddress: '0x1234' }] },
  ]) assert.throws(() => parse(bytes(JSON.stringify({ assets: [mutation] }))), /malformed|conflict/i);
  for (const duplicate of [
    [asset, { ...asset }],
    [asset, { ...asset, id: asset.id.toUpperCase().replace('0X', '0x') }],
    [asset, { ...asset, id: HASH('b') }],
  ]) assert.throws(() => parse(bytes(JSON.stringify({ assets: duplicate }))), /duplicate|ambiguous/i);
  const omitted = evaluate(bytes('{"assets":[]}'));
  assert.equal(omitted.predicates[0].result, 'unknown');
  assert.equal(omitted.evaluationKind, 'health_unknown');
});

await test('provider parser preserves the closed durable failure taxonomy', async () => {
  await rejectsProviderFailure(() => parse(new Uint8Array([0xff])), 'provider_utf8');
  await rejectsProviderFailure(() => parse(bytes('{')), 'provider_json');
  await rejectsProviderFailure(() => parse(bytes('{"assets":{}}')), 'provider_shape');
  await rejectsProviderFailure(() => parse(bytes('{"assets":[{"id":"bad"}]}')),
    'provider_identity_malformed');
  const asset = JSON.parse(new TextDecoder().decode(bodyWithAsset())).assets[0];
  await rejectsProviderFailure(
    () => parse(bytes(JSON.stringify({ assets: [asset, asset] }))),
    'provider_identity_duplicate',
  );
});

function response({
  status = 200, headers = {}, chunks = [bytes(vectors.healthy.providerBody)], redirected = false,
} = {}) {
  return {
    status,
    redirected,
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
  };
}

await test('transport is fixed, bounded, identity encoded, and never follows redirects', async () => {
  let request;
  const result = await fetchRwaHealthProvider(async (url, init) => {
    request = { url, init };
    return response({ headers: { 'content-length': String(bytes(vectors.healthy.providerBody).length) } });
  });
  assert.equal(request.url, 'https://api.robinhood.com/rhj/assets');
  assert.equal(request.init.redirect, 'error');
  assert.equal(request.init.credentials, 'omit');
  assert.deepEqual(request.init.headers, { accept: 'application/json', 'accept-encoding': 'identity' });
  assert.deepEqual(result.body, bytes(vectors.healthy.providerBody));
  for (const [fixture, code, failureCode] of [
    [response({ redirected: true }), 'health_provider_http', 'provider_redirect'],
    [response({ status: 500 }), 'health_provider_http', 'provider_http'],
    [response({ headers: { 'content-type': 'text/plain' } }), 'health_provider_malformed', 'provider_content_type'],
    [response({ headers: { 'content-encoding': 'gzip' } }), 'health_provider_malformed', 'provider_content_encoding'],
    [response({ headers: { 'content-length': '01' } }), 'health_provider_malformed', 'provider_shape'],
    [response({ headers: { 'content-length': '1', }, chunks: [bytes('12')] }), 'health_provider_malformed', 'provider_shape'],
  ]) await rejectsProviderFailure(() => fetchRwaHealthProvider(async () => fixture), failureCode, code);
  await rejectsProviderFailure(() => fetchRwaHealthProvider(async () => response({
    chunks: [new Uint8Array(2_000_001)],
  })), 'provider_oversized', 'health_provider_oversized');
  const exact = await fetchRwaHealthProvider(async () => response({ chunks: [new Uint8Array(2_000_000)] }));
  assert.equal(exact.body.length, 2_000_000);
  await rejectsProviderFailure(() => fetchRwaHealthProvider(async (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  })), 'provider_timeout', 'health_provider_timeout');
  const nativeSetTimeout = globalThis.setTimeout;
  try {
    globalThis.setTimeout = (callback, _delay, ...args) => nativeSetTimeout(callback, 1, ...args);
    await rejectsProviderFailure(() => fetchRwaHealthProvider(async () => ({
      ...response(), body: { getReader: () => ({
        read: () => new Promise(() => {}), cancel: async () => {},
      }) },
    })), 'provider_timeout', 'health_provider_timeout');
  } finally { globalThis.setTimeout = nativeSetTimeout; }
});

await test('database clock SQL is capability-specific and contains no JavaScript time', () => {
  assert.equal(healthDbNowSql({ postgres: true }), "date_trunc('milliseconds',clock_timestamp())");
  assert.equal(healthDbNowSql({ postgres: false }), 'now()');
  assert.throws(() => healthDbNowSql({}), /capability|input/i);
});

const normalArgs = () => ({
  expectedEvaluationId: HASH('8'),
  purpose: 'purchase_broadcast',
  expectedEpisodeGeneration: null,
  expectedStateSequence: '1',
  expectedEpisodeEventId: null,
  expectedMaterialEvidenceHash: null,
});

await test('fresh-action seam rejects every malformed six-property request before query', async () => {
  const mutations = [];
  for (const key of Object.keys(normalArgs())) {
    const missing = normalArgs(); delete missing[key]; mutations.push(missing);
    mutations.push({ ...normalArgs(), [key]: undefined });
  }
  mutations.push({ ...normalArgs(), extra: true });
  mutations.push({ ...normalArgs(), expectedStateSequence: '0' });
  mutations.push({ ...normalArgs(), expectedStateSequence: '9223372036854775808' });
  mutations.push({ ...normalArgs(), expectedEpisodeGeneration: '1' });
  mutations.push({ ...normalArgs(), expectedEpisodeEventId: HASH('9') });
  mutations.push({ ...normalArgs(), expectedMaterialEvidenceHash: HASH('a') });
  mutations.push({ ...normalArgs(), purpose: 'quarantine_clearance_broadcast' });
  const inherited = Object.create(normalArgs()); mutations.push(inherited);
  const accessor = normalArgs(); Object.defineProperty(accessor, 'purpose', { get: () => 'purchase_broadcast' });
  mutations.push(accessor);
  for (const args of mutations) {
    let queries = 0;
    await rejectsCode(() => requireFreshRwaHealth({ query: async () => { queries += 1; } }, KEY, args),
      'health_bad_input');
    assert.equal(queries, 0, 'bad input is rejected before the first query');
  }
});

await test('clearance inputs require the full exact generation/sequence/head tuple', async () => {
  const clearance = {
    ...normalArgs(),
    purpose: 'quarantine_clearance_broadcast',
    expectedEpisodeGeneration: '1',
    expectedEpisodeEventId: HASH('9'),
    expectedMaterialEvidenceHash: HASH('a'),
  };
  for (const [field, values] of Object.entries({
    expectedEpisodeGeneration: [null, '0', '01', (2n ** 256n).toString()],
    expectedStateSequence: [null, '0', '01', (2n ** 63n).toString()],
    expectedEpisodeEventId: [null, ZERO_HASH, HASH('A')],
    expectedMaterialEvidenceHash: [null, ZERO_HASH, HASH('A')],
  })) {
    for (const value of values) {
      let queries = 0;
      await rejectsCode(() => requireFreshRwaHealth({ query: async () => { queries += 1; } }, KEY,
        { ...clearance, [field]: value }), 'health_bad_input');
      assert.equal(queries, 0);
    }
  }
});

await test('action seam is client-owned, read-only, deeply frozen, and uses exact precedence', async () => {
  await rejectsCode(() => requireFreshRwaHealth({}, KEY, normalArgs()), 'health_bad_input');
  const prior = {
    rpc: process.env.CHAIN_RPC_URL,
    registry: process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS,
    start: process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK,
  };
  process.env.CHAIN_RPC_URL = 'https://configured-rpc.invalid';
  process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = expected.registryAddress;
  process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK = '1';
  const checked = new Date('2033-05-18T03:33:20.000Z');
  const actionClient = (stage = 'success') => ({
    query: async (sql) => {
      if (sql.includes('stock_catalog_sync_lock_v2')) return { rows: [{ id: 1 }] };
      if (sql.includes('extract(epoch FROM')) return { rows: [{ now: checked, epoch: '2000000000' }] };
      if (sql.includes('rwa_health_v2_catalog_state') || sql.includes('rwa_health_v2_catalog_confirm')) {
        if (stage === 'registry') return { rows: [] };
        return { rows: [{
          chain_id: 4663, registry_address: expected.registryAddress, catalog_version: '7',
          snapshot_hash: expected.catalogSnapshotHash, ready_verified_at: checked,
          caught_up: true, mirror_stale: stage === 'staleRegistry', getter_identity_matches: true,
        }] };
      }
      if (sql.includes('rwa_health_v2_all_versions')) return { rows: stage === 'asset' ? [] : [{
        asset_version_key: KEY, ticker: 'AAPL', token_address: expected.tokenAddress,
        token_decimals: 18, robinhood_asset_id_hash: expected.robinhoodAssetIdHash,
        active: true, registered_at: checked, activated_at: checked, deactivated_at: null,
      }] };
      if (sql.includes('rwa_health_apply_lock_v2')) return { rows: [{ id: 1 }] };
      if (sql.includes('rwa_health_runtime_v2')) {
        return { rows: [{ capacity_exceeded: stage === 'capacity' }] };
      }
      if (sql.includes(' AS checked_now') && !sql.includes('FROM rwa_health_current_v2')) {
        return { rows: [{ checked_now: stage === 'freshness'
          ? new Date(checked.getTime() + 600_001) : checked }] };
      }
      if (sql.includes('FROM rwa_health_current_v2')) {
        if (stage === 'missingHealth') return { rows: [] };
        return { rows: [{
          catalog_version: stage === 'snapshot' ? '8' : '7',
          catalog_snapshot_hash: expected.catalogSnapshotHash,
          last_evaluation_id: stage === 'evaluation' ? HASH('9') : HASH('8'),
          latest_evaluation_kind: stage === 'kind' ? 'health_unknown' : 'healthy',
          last_observed_at: checked, last_applied_at: checked,
          checked_now: stage === 'freshness' ? new Date(checked.getTime() + 600_001) : checked,
          fresh_through: new Date(checked.getTime() + 600_000),
          is_fresh: stage !== 'freshness',
          state_sequence: stage === 'sequence' ? 2 : 1,
          current_episode_id: stage === 'episode' ? HASH('a') : null,
          current_episode_generation: stage === 'episode' ? '1' : null,
          latest_episode_event_id: stage === 'episode' ? HASH('b') : null,
          latest_material_evidence_hash: stage === 'episode' ? HASH('c') : null,
          clearance_applied_at: null,
        }] };
      }
      assert.fail(`unexpected action-wall SQL: ${sql}`);
    },
  });
  const forbidden = new Proxy(actionClient('asset'), { get: (target, property) => {
    if (property !== 'query') assert.fail(`seam accessed forbidden client capability ${String(property)}`);
    return target.query;
  } });
  await rejectsCode(() => requireFreshRwaHealth(forbidden, KEY, normalArgs()), 'health_asset_not_found');
  const precedence = [
    ['asset', 'health_asset_not_found'],
    ['registry', 'health_registry_unavailable'],
    ['staleRegistry', 'health_registry_stale'],
    ['capacity', 'health_capacity_exceeded'],
    ['snapshot', 'health_snapshot_changed'],
    ['episode', 'health_blocked'],
    ['kind', 'health_not_fresh'],
    ['freshness', 'health_not_fresh'],
    ['evaluation', 'health_snapshot_changed'],
    ['sequence', 'health_snapshot_changed'],
  ];
  try {
    for (const [stage, code] of precedence) {
      await rejectsCode(() => requireFreshRwaHealth(actionClient(stage), KEY, normalArgs()), code);
    }
    const receipt = await requireFreshRwaHealth(actionClient(), KEY, normalArgs());
    assert.deepEqual(Object.keys(receipt), [
      'ok', 'purpose', 'chainId', 'registryAddress', 'catalogVersion', 'catalogSnapshotHash',
      'assetVersionKey', 'evaluationId', 'evaluationKind', 'observedAt', 'appliedAt',
      'freshThrough', 'stateSequence', 'episodeId', 'episodeGeneration',
      'latestEpisodeEventId', 'latestMaterialEvidenceHash',
    ]);
    assert(Object.isFrozen(receipt));
    assert.equal(receipt.ok, true);
  } finally {
    if (prior.rpc === undefined) delete process.env.CHAIN_RPC_URL; else process.env.CHAIN_RPC_URL = prior.rpc;
    if (prior.registry === undefined) delete process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
    else process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = prior.registry;
    if (prior.start === undefined) delete process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK;
    else process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK = prior.start;
  }
});

await test('evidence preimages reject corruption, cross-asset swaps, and same-ID drift', () => {
  const baseline = deriveEvaluation(bytes(vectors.healthy.providerBody));
  for (const mutation of [
    vectors.healthy.providerBody.replace('AAPL', 'MSFT'),
    vectors.healthy.providerBody.replace(vectors.formula.tokenAddress, `0x${'5'.repeat(40)}`),
    vectors.healthy.providerBody.replace('"tokenDecimals":18', '"tokenDecimals":19'),
    `${vectors.healthy.providerBody} `,
  ]) {
    const changed = deriveEvaluation(bytes(mutation));
    assert.notEqual(changed.providerBodyHash, baseline.providerBodyHash);
    assert.notEqual(changed.evidenceHash, baseline.evidenceHash);
    assert.notEqual(changed.evaluationId, baseline.evaluationId);
  }
  assert.throws(() => deriveRwaHealthIds({
    ...vectors.formula,
    providerBodyHash: vectors.healthy.outputs.providerBodyHash,
    providerBody: vectors.formula.providerBody,
  }), /evidence|conflict/i);
});

if (failures.length) {
  console.error(`rwahealth: ${passes} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(failure.stack || failure);
  process.exitCode = 1;
} else {
  console.log(`rwahealth: ${passes} passed`);
}
