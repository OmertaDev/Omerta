import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  RWA_HEALTH_OVERLAY_ERROR_CODES,
  RwaHealthOverlayError,
  readRwaHealthOverlayAuthoringContextV2,
  requireRwaHealthOverlayReadyV2,
} from '../src/rwahealthoverlay.js';

const HASH = (character) => `0x${character.repeat(64)}`;
const ADDRESS = (character) => `0x${character.repeat(40)}`;
const REGISTRY = ADDRESS('1');
const OVERLAY = ADDRESS('2');
const SAFE = ADDRESS('3');
const ASSET = HASH('4');
const BLOCK = HASH('5');
const OBSERVATION = HASH('6');
const HORIZON = HASH('7');
const READY = '2026-08-28T12:00:00.000Z';
const FRESH = '2026-08-28T12:10:00.000Z';
const ORIGINAL_ENV = Object.freeze({
  STOCK_TOKEN_REGISTRY_V2_ADDRESS: process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS,
  RWA_HEALTH_OVERLAY_V2_ADDRESS: process.env.RWA_HEALTH_OVERLAY_V2_ADDRESS,
  RWA_HEALTH_OVERLAY_V2_START_BLOCK: process.env.RWA_HEALTH_OVERLAY_V2_START_BLOCK,
  RWA_HEALTH_OVERLAY_V2_SAFE_ADDRESS: process.env.RWA_HEALTH_OVERLAY_V2_SAFE_ADDRESS,
});

function installEnv() {
  process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = REGISTRY;
  process.env.RWA_HEALTH_OVERLAY_V2_ADDRESS = OVERLAY;
  process.env.RWA_HEALTH_OVERLAY_V2_START_BLOCK = '100';
  process.env.RWA_HEALTH_OVERLAY_V2_SAFE_ADDRESS = SAFE;
}

const nullRecord = (entries) => Object.assign(Object.create(null), Object.fromEntries(entries));
const expectation = () => nullRecord([
  ['expectedH2BlockNumber', '200'], ['expectedH2BlockHash', BLOCK],
  ['expectedReadyVerifiedAt', READY],
]);

function baseState(overrides = {}) {
  const identity = {
    consumer_key: 'rwa_health_overlay_v2', chain_id: '4663', registry_address: REGISTRY,
    overlay_address: OVERLAY, safe_address: SAFE, start_block_number: '100',
  };
  return {
    singleton: { id: 1 },
    checkpoint: {
      ...identity, last_applied_block_number: '200', last_applied_block_hash: BLOCK,
      last_observation_hash: OBSERVATION, finalized_horizon_block_number: '200',
      finalized_horizon_block_hash: BLOCK, caught_up: true, halted: false,
    },
    runtime: {
      id: 1, ...identity, sync_in_progress: false, caught_up: true, halted: false,
      unresolved_authority_incident_count: '0', ready_verified_at: new Date(READY),
    },
    asset: null,
    now: new Date(READY),
    ...overrides,
  };
}

function clientFor(state = baseState()) {
  const issued = [];
  const client = {
    issued,
    async query(sql, params = []) {
      issued.push({ sql, params });
      if (/rwa_health_overlay_lock_v2/i.test(sql)) return { rows: state.singleton ? [state.singleton] : [] };
      if (/rwa_health_overlay_checkpoint_v2/i.test(sql)) return { rows: state.checkpoint ? [state.checkpoint] : [] };
      if (/rwa_health_overlay_runtime_v2/i.test(sql)) return { rows: state.runtime ? [state.runtime] : [] };
      if (/rwa_health_overlay_asset_state_v2/i.test(sql)) return { rows: state.asset ? [state.asset] : [] };
      if (/WITH h2_clock/i.test(sql)) {
        const ready = new Date(state.runtime.ready_verified_at);
        const fresh = new Date(ready.getTime() + 600_000);
        return { rows: [{ database_now: state.now, fresh_through: fresh,
          readiness_fresh: state.now.getTime() <= fresh.getTime() }] };
      }
      assert.fail(`unexpected SQL: ${sql}`);
    },
  };
  return client;
}

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
  assert(caught instanceof RwaHealthOverlayError);
  assert.equal(caught.code, code);
  assert.doesNotMatch(caught.message, /postgres|password|private|https?:|0x[0-9a-f]/i);
}

installEnv();

await test('exports one closed secret-safe H2 error family', () => {
  assert.equal(new Set(RWA_HEALTH_OVERLAY_ERROR_CODES).size, 17);
  for (const code of RWA_HEALTH_OVERLAY_ERROR_CODES) {
    const error = new RwaHealthOverlayError(code);
    assert.equal(error.code, code);
    assert.equal(error.name, 'RwaHealthOverlayError');
  }
  assert.throws(() => new RwaHealthOverlayError('raw_database_error'), TypeError);
});

await test('invalid readiness input rejects before configuration or any query', async () => {
  const noQuery = { query() { assert.fail('invalid input queried'); } };
  const invalid = [
    null, {}, Object.assign(Object.create(null), { expectedH2BlockNumber: '200' }),
    { expectedH2BlockNumber: '200', expectedH2BlockHash: BLOCK, expectedReadyVerifiedAt: READY },
    nullRecord([['expectedH2BlockHash', BLOCK], ['expectedH2BlockNumber', '200'],
      ['expectedReadyVerifiedAt', READY]]),
    nullRecord([['expectedH2BlockNumber', '0200'], ['expectedH2BlockHash', BLOCK],
      ['expectedReadyVerifiedAt', READY]]),
    nullRecord([['expectedH2BlockNumber', '200'], ['expectedH2BlockHash', HASH('0')],
      ['expectedReadyVerifiedAt', READY]]),
    nullRecord([['expectedH2BlockNumber', '200'], ['expectedH2BlockHash', BLOCK],
      ['expectedReadyVerifiedAt', '2026-08-28T12:00:00Z']]),
  ];
  for (const input of invalid) {
    await rejectsCode(() => requireRwaHealthOverlayReadyV2(noQuery, input), 'h2_readiness_input');
  }
  const accessor = Object.create(null);
  Object.defineProperties(accessor, {
    expectedH2BlockNumber: { enumerable: true, get: () => '200' },
    expectedH2BlockHash: { enumerable: true, value: BLOCK },
    expectedReadyVerifiedAt: { enumerable: true, value: READY },
  });
  await rejectsCode(() => requireRwaHealthOverlayReadyV2(noQuery, accessor), 'h2_readiness_input');
  await rejectsCode(() => requireRwaHealthOverlayReadyV2(null, expectation()), 'h2_readiness_input');
});

await test('invalid authoring key rejects before configuration or any query', async () => {
  const noQuery = { query() { assert.fail('invalid input queried'); } };
  for (const input of [null, '', '0x12', HASH('0'), ASSET.toUpperCase(), { toString: () => ASSET }]) {
    await rejectsCode(() => readRwaHealthOverlayAuthoringContextV2(noQuery, input), 'h2_input');
  }
  await rejectsCode(() => readRwaHealthOverlayAuthoringContextV2(null, ASSET), 'h2_input');
});

await test('missing or malformed immutable configuration rejects before a query', async () => {
  const saved = process.env.RWA_HEALTH_OVERLAY_V2_SAFE_ADDRESS;
  delete process.env.RWA_HEALTH_OVERLAY_V2_SAFE_ADDRESS;
  const noQuery = { query() { assert.fail('unconfigured seam queried'); } };
  await rejectsCode(() => requireRwaHealthOverlayReadyV2(noQuery, expectation()), 'h2_unconfigured');
  process.env.RWA_HEALTH_OVERLAY_V2_SAFE_ADDRESS = saved;
});

await test('readiness locks singleton, checkpoint, and runtime in literal order', async () => {
  const client = clientFor();
  const receipt = await requireRwaHealthOverlayReadyV2(client, expectation());
  assert.deepEqual(client.issued.slice(0, 3).map(({ sql }) => sql.match(/rwa_health_overlay_[a-z_]+_v2/i)[0]), [
    'rwa_health_overlay_lock_v2', 'rwa_health_overlay_checkpoint_v2', 'rwa_health_overlay_runtime_v2',
  ]);
  assert.equal(client.issued.length, 4);
  assert.equal(Object.getPrototypeOf(receipt), null);
  assert(Object.isFrozen(receipt));
  assert.deepEqual(Object.keys(receipt), [
    'ok', 'consumerKey', 'chainId', 'registryAddress', 'overlayAddress', 'startBlockNumber',
    'appliedBlockNumber', 'appliedBlockHash', 'observationHash', 'finalizedHorizonBlockNumber',
    'finalizedHorizonBlockHash', 'caughtUp', 'halted', 'readyVerifiedAt', 'freshThrough',
  ]);
  assert.equal(receipt.freshThrough, FRESH);
  assert.throws(() => { receipt.appliedBlockNumber = '201'; }, TypeError);
});

await test('readiness snapshots the exact request before its first await', async () => {
  const request = expectation();
  const client = clientFor();
  const query = client.query.bind(client);
  client.query = async (...args) => {
    request.expectedH2BlockNumber = '199';
    request.expectedH2BlockHash = HORIZON;
    request.expectedReadyVerifiedAt = FRESH;
    return query(...args);
  };
  const receipt = await requireRwaHealthOverlayReadyV2(client, request);
  assert.equal(receipt.appliedBlockNumber, '200');
  assert.equal(receipt.appliedBlockHash, BLOCK);
  assert.equal(receipt.readyVerifiedAt, READY);
});

await test('immutable database identity mismatch precedes all readiness conditions', async () => {
  const state = baseState();
  state.checkpoint = { ...state.checkpoint, overlay_address: ADDRESS('9'), caught_up: false, halted: true };
  state.runtime = { ...state.runtime, sync_in_progress: true, halted: true,
    unresolved_authority_incident_count: '1', ready_verified_at: new Date('2020-01-01T00:00:00.000Z') };
  await rejectsCode(() => requireRwaHealthOverlayReadyV2(clientFor(state), expectation()), 'h2_unconfigured');
});

await test('active, uninitialized, and not-caught-up state precede halt and incident', async () => {
  for (const state of [
    baseState({ singleton: null }),
    baseState({ runtime: { ...baseState().runtime, overlay_address: null, halted: true,
      unresolved_authority_incident_count: '1' } }),
    baseState({ checkpoint: { ...baseState().checkpoint, caught_up: false, halted: true },
      runtime: { ...baseState().runtime, halted: true, unresolved_authority_incident_count: '1' } }),
    baseState({ runtime: { ...baseState().runtime, sync_in_progress: true, halted: true,
      unresolved_authority_incident_count: '1' } }),
    baseState({ checkpoint: { ...baseState().checkpoint, finalized_horizon_block_number: '201',
      finalized_horizon_block_hash: HORIZON, halted: true },
      runtime: { ...baseState().runtime, halted: true, unresolved_authority_incident_count: '1' } }),
  ]) await rejectsCode(() => requireRwaHealthOverlayReadyV2(clientFor(state), expectation()), 'h2_not_ready');
});

await test('halt precedes authority incident and expiry', async () => {
  const state = baseState({ now: new Date('2026-08-28T12:10:00.001Z') });
  state.runtime = { ...state.runtime, halted: true, unresolved_authority_incident_count: '1' };
  await rejectsCode(() => requireRwaHealthOverlayReadyV2(clientFor(state), expectation()), 'h2_halted');
});

await test('authority incident precedes expiry and malformed incident state fails closed', async () => {
  const incident = baseState({ now: new Date('2026-08-28T12:10:00.001Z') });
  incident.runtime = { ...incident.runtime, unresolved_authority_incident_count: '1' };
  await rejectsCode(() => requireRwaHealthOverlayReadyV2(clientFor(incident), expectation()),
    'h2_authority_incident');
  const malformed = baseState();
  malformed.runtime = { ...malformed.runtime, unresolved_authority_incident_count: null };
  await rejectsCode(() => requireRwaHealthOverlayReadyV2(clientFor(malformed), expectation()), 'h2_not_ready');
});

await test('database freshness is inclusive at equality and stale one millisecond later', async () => {
  const equal = baseState({ now: new Date(FRESH) });
  const receipt = await requireRwaHealthOverlayReadyV2(clientFor(equal), expectation());
  assert.equal(receipt.freshThrough, FRESH);
  const late = baseState({ now: new Date('2026-08-28T12:10:00.001Z') });
  await rejectsCode(() => requireRwaHealthOverlayReadyV2(clientFor(late), expectation()),
    'h2_readiness_stale');
});

await test('freshness expiry precedes compare-and-set mismatch', async () => {
  const changed = expectation();
  changed.expectedH2BlockNumber = '199';
  const stale = baseState({ now: new Date('2026-08-28T12:10:00.001Z') });
  await rejectsCode(() => requireRwaHealthOverlayReadyV2(clientFor(stale), changed),
    'h2_readiness_stale');
  await rejectsCode(() => requireRwaHealthOverlayReadyV2(clientFor(), changed),
    'h2_readiness_changed');
});

await test('authoring returns absent projection as exact generation zero-to-one after all locks', async () => {
  const client = clientFor();
  const receipt = await readRwaHealthOverlayAuthoringContextV2(client, ASSET);
  assert.equal(Object.getPrototypeOf(receipt), null);
  assert(Object.isFrozen(receipt));
  assert.deepEqual(Object.keys(receipt), [
    'chainId', 'consumerKey', 'registryAddress', 'overlayAddress', 'safeAddress', 'startBlockNumber',
    'appliedBlockNumber', 'appliedBlockHash', 'observationHash', 'finalizedHorizonBlockNumber',
    'finalizedHorizonBlockHash', 'caughtUp', 'halted', 'readyVerifiedAt', 'freshThrough',
    'assetVersionKey', 'currentOverlayGeneration', 'nextOverlayGeneration',
  ]);
  assert.equal(receipt.currentOverlayGeneration, '0');
  assert.equal(receipt.nextOverlayGeneration, '1');
  assert.deepEqual(client.issued.slice(0, 4).map(({ sql }) => sql.match(/rwa_health_overlay_[a-z_]+_v2/i)[0]), [
    'rwa_health_overlay_lock_v2', 'rwa_health_overlay_checkpoint_v2',
    'rwa_health_overlay_runtime_v2', 'rwa_health_overlay_asset_state_v2',
  ]);
  assert.equal(client.issued.length, 5);
  assert.throws(() => { receipt.nextOverlayGeneration = '2'; }, TypeError);
});

await test('authoring returns the exact present generation and rejects malformed or exhausted state', async () => {
  const state = baseState({ asset: { registry_address: REGISTRY, overlay_address: OVERLAY,
    asset_version_key: ASSET, overlay_generation: '41' } });
  const receipt = await readRwaHealthOverlayAuthoringContextV2(clientFor(state), ASSET);
  assert.equal(receipt.currentOverlayGeneration, '41');
  assert.equal(receipt.nextOverlayGeneration, '42');
  for (const overlayGeneration of ['0', '01', `${(1n << 256n) - 1n}`]) {
    const invalid = baseState({ asset: { ...state.asset, overlay_generation: overlayGeneration } });
    await rejectsCode(() => readRwaHealthOverlayAuthoringContextV2(clientFor(invalid), ASSET),
      'h2_not_ready');
  }
});

await test('source owns no transaction, connection, RPC, signer, sender, or worker authority', async () => {
  const source = await readFile(new URL('../src/rwahealthoverlay.js', import.meta.url), 'utf8');
  for (const forbidden of [
    /\.connect\s*\(/, /\bBEGIN\b/, /\bCOMMIT\b/, /\bROLLBACK\b/, /createPublicClient/,
    /CHAIN_RPC_URL/, /privateKey/i, /signTransaction/i, /sendTransaction/i, /setInterval\s*\(/,
  ]) assert.doesNotMatch(source, forbidden);
  assert.match(source, /function lockSuffix\(\) \{ return dbCaps\.skipLocked \? ' FOR SHARE' : ''; \}/);
  for (const table of [
    'rwa_health_overlay_lock_v2', 'rwa_health_overlay_checkpoint_v2',
    'rwa_health_overlay_runtime_v2', 'rwa_health_overlay_asset_state_v2',
  ]) assert(source.includes(table), `${table} is lock-read by the seam`);
});

for (const [name, value] of Object.entries(ORIGINAL_ENV)) {
  if (value === undefined) delete process.env[name]; else process.env[name] = value;
}

if (failures.length) {
  for (const error of failures) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`rwahealthoverlay readiness: ${passes} passed`);
}
