import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getAddress } from 'viem';

import { makeDb } from '../src/db.js';

const MODULE_URL = new URL('../src/rwaregistrylifecycle.js', import.meta.url);
let lifecycle;
try {
  lifecycle = await import(MODULE_URL);
} catch (error) {
  if (error?.code === 'ERR_MODULE_NOT_FOUND') {
    assert.fail('CN-6A implementation missing: expected src/rwaregistrylifecycle.js');
  }
  throw error;
}

const {
  syncFinalizedRwaRegistryLifecycle,
  applyFinalizedRwaActivationEvents,
  applyFinalizedRwaBallotEvents,
  readFinalizedRwaLifecycleHeadV2,
  compareFinalizedRwaActivationV2,
  requireFinalizedRwaActivationV2,
} = lifecycle;

const EXPECTED_EXPORTS = Object.freeze([
  'applyFinalizedRwaActivationEvents',
  'applyFinalizedRwaBallotEvents',
  'compareFinalizedRwaActivationV2',
  'readFinalizedRwaLifecycleHeadV2',
  'requireFinalizedRwaActivationV2',
  'syncFinalizedRwaRegistryLifecycle',
]);
assert.deepEqual(Object.keys(lifecycle).filter((name) => !name.startsWith('__')).sort(), EXPECTED_EXPORTS,
  'CN-6A exposes only its six frozen production surfaces');
for (const name of EXPECTED_EXPORTS) assert.equal(typeof lifecycle[name], 'function', `${name} is exported`);

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
  assert.equal(caught.code, code);
  assert.doesNotMatch(caught.message, /postgres:|password|private|https?:\/\//i);
  return caught;
}

const HASH = (character) => `0x${character.repeat(64)}`;
const ADDRESS = getAddress('0x1234567890abcdef1234567890abcdef12345678').toLowerCase();
const KEY_A = HASH('1');
const KEY_B = HASH('2');
const REVIEW = HASH('3');
const EVIDENCE = HASH('4');
const TX = HASH('5');
const BLOCK = HASH('6');
const SNAPSHOT = HASH('7');
const OBSERVATION = HASH('8');
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;

const TOPIC_SIGNATURES = Object.freeze([
  'PublisherSet(address)',
  'AssetVersionRegistered(bytes32,bytes32,address,bytes32,string,string,uint8,uint64)',
  'AssetVersionActivated(bytes32,bytes32,bytes32,uint64,uint64,uint256)',
  'AssetVersionDeactivated(bytes32,bytes32,uint64,uint256)',
  'BallotPublished(uint256,bytes32,address,uint8,bytes32,uint256,uint256,uint64,uint64)',
]);
const source = await readFile(MODULE_URL, 'utf8');
await test('source binds the immutable chain, consumer, topics, and every work ceiling', () => {
  assert.match(source, /\b4663\b/);
  assert.match(source, /rwa_registry_lifecycle_v2/);
  for (const signature of TOPIC_SIGNATURES) assert(source.includes(signature), signature);
  for (const literal of ['10000', '2000', '2000000', '256', '64', '2048']) {
    assert.match(source, new RegExp(`\\b${literal}\\b`));
  }
});

await test('source contains no CN-6B, signer, sender, Safe, health, funds, scheduling, or cutover authority', () => {
  for (const forbidden of [
    /\bsetPublisher\b/, /\bactivateVersion\b/, /\bdeactivateVersion\b/, /\bpublishBallot\b/,
    /privateKey/i, /signTransaction/i, /sendTransaction/i, /broadcastTransaction/i,
    /safe[_-]transaction/i, /clearance[_-]applied/i, /transferFrom\s*\(/,
    /setInterval\s*\(/, /RWA_STOCK_PIPELINE/, /process\.env\.[A-Z_]*CUTOVER/,
  ]) assert.doesNotMatch(source, forbidden);
});

await test('closed reader requests reject before querying', async () => {
  const noQuery = { query() { assert.fail('invalid request queried the database'); } };
  for (const input of [undefined, null, '', '0x12', ZERO_ADDRESS, {}, Object.create({ inherited: true })]) {
    await rejectsCode(() => requireFinalizedRwaActivationV2(noQuery, input, {
      expectedActivationGeneration: '1',
    }), 'rwa_activation_input');
  }
  for (const expectation of [
    undefined, {}, { expectedActivationGeneration: 1 }, { expectedActivationGeneration: '0' },
    { expectedActivationGeneration: '01' }, { expectedActivationGeneration: '-1' },
    { expectedActivationGeneration: `${1n << 256n}` },
    { expectedActivationGeneration: '1', registryAddress: ADDRESS },
    Object.assign(Object.create({ inherited: true }), { expectedActivationGeneration: '1' }),
  ]) await rejectsCode(
    () => requireFinalizedRwaActivationV2(noQuery, KEY_A, expectation), 'rwa_activation_input');
});

await test('comparison rejects malformed head, key, and observed generation before querying', async () => {
  const noQuery = { query() { assert.fail('invalid comparison queried the database'); } };
  const fakeHead = Object.freeze(Object.create(null));
  for (const [head, key, expectation] of [
    [null, KEY_A, { observedActivationGeneration: '1' }],
    [fakeHead, '0x12', { observedActivationGeneration: '1' }],
    [fakeHead, KEY_A, {}],
    [fakeHead, KEY_A, { observedActivationGeneration: 1 }],
    [fakeHead, KEY_A, { observedActivationGeneration: '0' }],
    [fakeHead, KEY_A, { observedActivationGeneration: '01' }],
    [fakeHead, KEY_A, { observedActivationGeneration: '1', extra: true }],
  ]) await rejectsCode(
    () => compareFinalizedRwaActivationV2(noQuery, head, key, expectation), 'rwa_activation_input');
});

function decoded(kind, fields = {}, order = {}) {
  return Object.freeze({
    kind,
    blockNumber: order.blockNumber ?? '100',
    blockHash: order.blockHash ?? BLOCK,
    blockTimestamp: order.blockTimestamp ?? '1000',
    transactionHash: order.transactionHash ?? TX,
    transactionIndex: order.transactionIndex ?? '0',
    logIndex: order.logIndex ?? '0',
    ...fields,
  });
}

const registered = (key, order = {}) => decoded('AssetVersionRegistered', {
  assetVersionKey: key,
  tickerHash: HASH('9'),
  tokenAddress: ADDRESS,
  robinhoodAssetIdHash: HASH('a'),
  ticker: 'AAPL',
  name: 'Apple Stock Token',
  tokenDecimals: 18,
  registeredAt: '1000',
}, order);
const activated = (key, catalogVersion, order = {}) => decoded('AssetVersionActivated', {
  assetVersionKey: key,
  evidenceHash: EVIDENCE,
  reviewId: REVIEW,
  approvedAt: '900',
  validUntil: '605700',
  catalogVersion,
}, order);
const deactivated = (key, catalogVersion, order = {}) => decoded('AssetVersionDeactivated', {
  assetVersionKey: key,
  reasonHash: HASH('b'),
  deactivatedAt: '1000',
  catalogVersion,
}, order);

async function freshDb() {
  const db = await makeDb();
  return db;
}

await test('activation reducer accepts registration then activation with exact seven-day inclusion window', async () => {
  const db = await freshDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await applyFinalizedRwaActivationEvents(client, Object.freeze([
      registered(KEY_A, { logIndex: '0' }),
      activated(KEY_A, '1', { logIndex: '1' }),
    ]));
    const row = (await client.query(
      `SELECT activation_generation,active FROM rwa_registry_asset_lifecycle_current_v2
        WHERE asset_version_key=$1`, [KEY_A])).rows[0];
    assert.deepEqual({ generation: String(row.activation_generation), active: row.active },
      { generation: '1', active: true });
    await client.query('ROLLBACK');
  } finally { client.release(); await db.end?.(); }
});

await test('activation validity is half-open and TTL is exactly 604800 seconds', async () => {
  for (const [name, event] of [
    ['before approvedAt', activated(KEY_A, '1', { blockTimestamp: '899' })],
    ['at validUntil', activated(KEY_A, '1', { blockTimestamp: '605700' })],
    ['TTL minus one', decoded('AssetVersionActivated', {
      ...activated(KEY_A, '1'), validUntil: '605699',
    })],
  ]) {
    const db = await freshDb();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await rejectsCode(() => applyFinalizedRwaActivationEvents(client,
        Object.freeze([registered(KEY_A), event])), 'rwa_lifecycle_timestamp');
      await client.query('ROLLBACK');
    } finally { client.release(); await db.end?.(); }
    assert(name);
  }
});

await test('catalog grammar accepts conflict deactivations sharing one increment with target activation', async () => {
  const db = await freshDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await applyFinalizedRwaActivationEvents(client, Object.freeze([
      registered(KEY_A, { transactionIndex: '0', logIndex: '0' }),
      activated(KEY_A, '1', { transactionIndex: '0', logIndex: '1' }),
      registered(KEY_B, { transactionIndex: '1', logIndex: '0' }),
      deactivated(KEY_A, '2', { transactionIndex: '1', logIndex: '1' }),
      activated(KEY_B, '2', { transactionIndex: '1', logIndex: '2' }),
    ]));
    await client.query('ROLLBACK');
  } finally { client.release(); await db.end?.(); }
});

for (const [name, events] of [
  ['catalog skip', [registered(KEY_A), activated(KEY_A, '2')]],
  ['catalog regression', [registered(KEY_A), activated(KEY_A, '1'), deactivated(KEY_A, '0')]],
  ['conflict after activation', [registered(KEY_A), activated(KEY_A, '1'),
    registered(KEY_B), activated(KEY_B, '2', { logIndex: '1' }),
    deactivated(KEY_A, '2', { logIndex: '2' })]],
  ['cross-transaction shared catalog', [registered(KEY_A), activated(KEY_A, '1'),
    deactivated(KEY_A, '2', { transactionIndex: '1' }),
    activated(KEY_A, '2', { transactionIndex: '2' })]],
]) await test(`catalog grammar rejects ${name}`, async () => {
  const db = await freshDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await rejectsCode(() => applyFinalizedRwaActivationEvents(client,
      Object.freeze(events.map(Object.freeze))), 'rwa_lifecycle_catalog');
    await client.query('ROLLBACK');
  } finally { client.release(); await db.end?.(); }
});

await test('ballot reducer retains chain fact without granting purchase authority', async () => {
  const db = await freshDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await applyFinalizedRwaActivationEvents(client, Object.freeze([
      registered(KEY_A, { logIndex: '0' }),
      activated(KEY_A, '1', { logIndex: '1' }),
    ]));
    await applyFinalizedRwaBallotEvents(client, Object.freeze([decoded('BallotPublished', {
      day: '7', assetVersionKey: KEY_A, tokenAddress: ADDRESS, tokenDecimals: 18,
      tallyHash: HASH('c'), catalogVersion: '1', maxEthWei: '1000000000000000000',
      purchaseUntil: '700000', publishedAt: '1000',
    })]));
    const row = (await client.query(
      'SELECT * FROM rwa_registry_ballot_events_v2 WHERE ballot_day=$1', ['7'])).rows[0];
    assert(row);
    assert.equal(String(row.activation_generation), '1');
    assert(!Object.keys(row).some((key) => /authorized|purchase_allowed/i.test(key)));
    await client.query('ROLLBACK');
  } finally { client.release(); await db.end?.(); }
});

async function seedReadyLifecycle(db, { readyAt = '2030-01-01T00:00:00.000Z' } = {}) {
  await db.query(`INSERT INTO stock_catalog_sync_state_v2
    (id,chain_id,registry_address,catalog_version,finalized_block_number,finalized_block_hash,
     snapshot_hash,observation_hash,finalized_horizon_number,finalized_horizon_hash,caught_up,
     verified_at,ready_verified_at,synced_at)
    VALUES (1,4663,$1,'1','100',$2,$3,$4,'100',$2,true,$5,$5,$5)
    ON CONFLICT (id) DO UPDATE SET chain_id=EXCLUDED.chain_id,
      registry_address=EXCLUDED.registry_address,catalog_version=EXCLUDED.catalog_version,
      finalized_block_number=EXCLUDED.finalized_block_number,
      finalized_block_hash=EXCLUDED.finalized_block_hash,snapshot_hash=EXCLUDED.snapshot_hash,
      observation_hash=EXCLUDED.observation_hash,
      finalized_horizon_number=EXCLUDED.finalized_horizon_number,
      finalized_horizon_hash=EXCLUDED.finalized_horizon_hash,caught_up=EXCLUDED.caught_up,
      verified_at=EXCLUDED.verified_at,ready_verified_at=EXCLUDED.ready_verified_at,
      synced_at=EXCLUDED.synced_at`, [ADDRESS, BLOCK, SNAPSHOT, OBSERVATION, readyAt]);
  await db.query(`INSERT INTO stock_catalog_getter_checkpoint_v2
    (consumer_key,chain_id,contract_address,start_block_number,last_applied_block_number,
     last_applied_block_hash,last_observation_hash,finalized_horizon_number,
     finalized_horizon_hash,caught_up,verified_at,ready_verified_at)
    VALUES ('stock_catalog_getter_v2',4663,$1,'0','100',$2,$3,'100',$2,true,$4,$4)
    ON CONFLICT (consumer_key) DO UPDATE SET chain_id=EXCLUDED.chain_id,
      contract_address=EXCLUDED.contract_address,start_block_number=EXCLUDED.start_block_number,
      last_applied_block_number=EXCLUDED.last_applied_block_number,
      last_applied_block_hash=EXCLUDED.last_applied_block_hash,
      last_observation_hash=EXCLUDED.last_observation_hash,
      finalized_horizon_number=EXCLUDED.finalized_horizon_number,
      finalized_horizon_hash=EXCLUDED.finalized_horizon_hash,caught_up=EXCLUDED.caught_up,
      verified_at=EXCLUDED.verified_at,ready_verified_at=EXCLUDED.ready_verified_at`,
  [ADDRESS, BLOCK, OBSERVATION, readyAt]);
  await db.query(`UPDATE rwa_registry_lifecycle_checkpoint_v2 SET
    registry_address=$3,start_block_number='0',
    last_applied_block_number='100',last_applied_block_hash=$1,last_observation_hash=$2,
    finalized_horizon_block_number='100',finalized_horizon_block_hash=$1,caught_up=true,halted=false
    WHERE consumer_key='rwa_registry_lifecycle_v2'`, [BLOCK, OBSERVATION, ADDRESS]);
  await db.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET
    registry_address=$2,start_block_number='0',last_applied_block_number='100',
    last_applied_block_hash=$3,finalized_horizon_block_number='100',
    finalized_horizon_block_hash=$3,caught_up=true,sync_in_progress=false,
    ready_verified_at=$1,halted=false WHERE id=1`, [readyAt, ADDRESS, BLOCK]);
}

await test('partial bootstrap commits no activation authority until exact Task-5 same-head readiness', async () => {
  const db = await freshDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await rejectsCode(() => readFinalizedRwaLifecycleHeadV2(client), 'rwa_lifecycle_not_ready');
    await client.query('ROLLBACK');
  } finally { client.release(); await db.end?.(); }
});

await test('head receipt is key-independent, null-prototype, deeply frozen, and binds Task-5 snapshot', async () => {
  const db = await freshDb();
  await seedReadyLifecycle(db);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const receipt = await readFinalizedRwaLifecycleHeadV2(client);
    assert.equal(Object.getPrototypeOf(receipt), null);
    assert(Object.isFrozen(receipt));
    assert.deepEqual(Object.keys(receipt), [
      'chainId', 'registryAddress', 'consumerKey', 'appliedBlockNumber', 'appliedBlockHash',
      'observationHash', 'finalizedHorizonBlockNumber', 'finalizedHorizonBlockHash',
      'catalogVersion', 'catalogSnapshotHash', 'caughtUp', 'halted', 'readyVerifiedAt', 'freshThrough',
    ]);
    assert.equal(receipt.catalogSnapshotHash, SNAPSHOT);
    await client.query('ROLLBACK');
  } finally { client.release(); await db.end?.(); }
});

await test('non-strict comparison reports coherent old and absent generations without authorizing them', async () => {
  const db = await freshDb();
  await seedReadyLifecycle(db);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const head = await readFinalizedRwaLifecycleHeadV2(client);
    const absent = await compareFinalizedRwaActivationV2(client, head, KEY_A,
      { observedActivationGeneration: '1' });
    assert.deepEqual({
      exists: absent.observedInstanceExists,
      match: absent.observedLocalMatch,
      deactivated: absent.observedDeactivated,
      registered: absent.currentRegistered,
      active: absent.currentActive,
      generation: absent.currentActivationGeneration,
      same: absent.sameAsCurrent,
    }, { exists: false, match: false, deactivated: false, registered: false,
      active: false, generation: '0', same: false });
    assert(Object.isFrozen(absent));
    assert.equal(Object.getPrototypeOf(absent), null);
    await client.query('ROLLBACK');
  } finally { client.release(); await db.end?.(); }
});

await test('strict authoring seam rejects absent or unmatched generation', async () => {
  const db = await freshDb();
  await seedReadyLifecycle(db);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await rejectsCode(() => requireFinalizedRwaActivationV2(client, KEY_A,
      { expectedActivationGeneration: '1' }), 'rwa_activation_not_authoritative');
    await client.query('ROLLBACK');
  } finally { client.release(); await db.end?.(); }
});

await test('attempt lease refuses before 300 seconds and permits takeover exactly at equality', async () => {
  const db = await freshDb();
  await db.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET
    sync_in_progress=true,attempt_id='attempt-old',last_attempt_at=clock_timestamp(),ready_verified_at=NULL
    WHERE id=1`);
  await db.query(`INSERT INTO rwa_registry_lifecycle_attempts_v2
    (attempt_id,status,started_at) VALUES ('attempt-old','started',clock_timestamp())`);
  await rejectsCode(() => syncFinalizedRwaRegistryLifecycle(db), 'rwa_lifecycle_sync_busy');
  await db.query(`UPDATE rwa_registry_lifecycle_runtime_v2
    SET last_attempt_at=clock_timestamp()-INTERVAL '300 seconds' WHERE id=1`);
  await assert.rejects(() => syncFinalizedRwaRegistryLifecycle(db), (error) => {
    assert.notEqual(error.code, 'rwa_lifecycle_sync_busy');
    return true;
  });
  const old = (await db.query(
    `SELECT status FROM rwa_registry_lifecycle_attempts_v2 WHERE attempt_id='attempt-old'`)).rows[0];
  assert.equal(old.status, 'superseded');
  await db.end?.();
});

await test('atomic reducer failure leaves inbox, projection, result, and checkpoint unchanged', async () => {
  const db = await freshDb();
  const before = {};
  for (const table of [
    'rwa_registry_lifecycle_inbox_v2', 'rwa_registry_activation_instances_v2',
    'rwa_registry_asset_lifecycle_current_v2', 'rwa_registry_lifecycle_event_results_v2',
  ]) before[table] = Number((await db.query(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0].count);
  const checkpoint = (await db.query(
    `SELECT * FROM rwa_registry_lifecycle_checkpoint_v2 WHERE consumer_key='rwa_registry_lifecycle_v2'`)).rows[0];
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await rejectsCode(() => applyFinalizedRwaActivationEvents(client, Object.freeze([
      registered(KEY_A), decoded('AssetVersionActivated', {
        ...activated(KEY_A, '1', { logIndex: '1' }), validUntil: '605699',
      }),
    ])), 'rwa_lifecycle_timestamp');
    await client.query('ROLLBACK');
  } finally { client.release(); }
  for (const [table, count] of Object.entries(before)) {
    assert.equal(Number((await db.query(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0].count), count);
  }
  assert.deepEqual((await db.query(
    `SELECT * FROM rwa_registry_lifecycle_checkpoint_v2 WHERE consumer_key='rwa_registry_lifecycle_v2'`)).rows[0], checkpoint);
  await db.end?.();
});

if (failures.length) throw new AggregateError(failures, `${failures.length} rwaregistrylifecycle tests failed`);
console.log(`rwaregistrylifecycle: ${passes} passed`);
