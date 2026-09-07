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
const ORIGINAL_ENV = Object.freeze({
  CHAIN_RPC_URL: process.env.CHAIN_RPC_URL,
  STOCK_TOKEN_REGISTRY_V2_ADDRESS: process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS,
  STOCK_TOKEN_REGISTRY_V2_START_BLOCK: process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK,
});
process.env.CHAIN_RPC_URL = 'http://127.0.0.1:1';
process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = ADDRESS;
process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK = '0';
const KEY_A = HASH('1');
const KEY_B = HASH('2');
const KEY_C = HASH('c');
const KEY_D = HASH('d');
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

await test('source makes attempt installation and domain apply explicit lock-and-CAS operations', () => {
  assert.match(source, /rwa_registry_lifecycle_lock_v2[\s\S]{0,180}?FOR UPDATE/i);
  assert.match(source, /rwa_registry_lifecycle_checkpoint_v2[\s\S]{0,220}?FOR UPDATE/i);
  assert.match(source, /rwa_registry_lifecycle_runtime_v2[\s\S]{0,220}?FOR UPDATE/i);
  assert.match(source, /WHERE id=1 AND attempt_id=\$1/i,
    'success/failure must compare-and-set the still-current attempt');
  assert.match(source, /ORDER BY asset_version_key[\s\S]{0,120}?FOR UPDATE/i,
    'all touched asset rows must be locked in ascending key order');
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
  for (const input of [undefined, null, '', '0x12', ZERO_ADDRESS, {},
    { toString: () => KEY_A }, Object.create({ inherited: true }), KEY_A.toUpperCase()]) {
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
  const transactionIndex = order.transactionIndex ?? '0';
  return Object.freeze({
    kind,
    blockNumber: order.blockNumber ?? '100',
    blockHash: order.blockHash ?? BLOCK,
    blockTimestamp: order.blockTimestamp ?? '1000',
    transactionHash: order.transactionHash
      ?? (transactionIndex === '0' ? TX : HASH(transactionIndex === '1' ? 'd' : 'e')),
    transactionIndex,
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
const registeredIdentity = (key, identity, order = {}) => decoded('AssetVersionRegistered', {
  assetVersionKey: key,
  tickerHash: identity.tickerHash,
  tokenAddress: identity.tokenAddress,
  robinhoodAssetIdHash: identity.providerHash,
  ticker: identity.ticker ?? key.slice(2, 6).toUpperCase(),
  name: identity.name ?? `Asset ${key.slice(2, 6)}`,
  tokenDecimals: 18,
  registeredAt: order.blockTimestamp ?? '1000',
}, order);
const activated = (key, catalogVersion, order = {}) => decoded('AssetVersionActivated', {
  assetVersionKey: key,
  evidenceHash: EVIDENCE,
  reviewId: REVIEW,
  approvedAt: '900',
  validUntil: '605700',
  catalogVersion,
}, { logIndex: '1', ...order });
const deactivated = (key, catalogVersion, order = {}) => decoded('AssetVersionDeactivated', {
  assetVersionKey: key,
  reasonHash: HASH('b'),
  deactivatedAt: '1000',
  catalogVersion,
}, { logIndex: '2', ...order });

async function freshDb() {
  const db = await makeDb();
  await db.query(`UPDATE rwa_registry_lifecycle_checkpoint_v2
    SET registry_address=$1,start_block_number='0'
    WHERE consumer_key='rwa_registry_lifecycle_v2'`, [ADDRESS]);
  await db.query(`UPDATE rwa_registry_lifecycle_runtime_v2
    SET registry_address=$1,start_block_number='0' WHERE id=1`, [ADDRESS]);
  await db.query(`INSERT INTO stock_catalog_sync_state_v2
    (id,chain_id,registry_address,catalog_version,finalized_block_number,
     finalized_block_hash,snapshot_hash,synced_at)
    VALUES (1,4663,$1,'0','0',$2,$3,now()) ON CONFLICT (id) DO NOTHING`,
  [ADDRESS, BLOCK, SNAPSHOT]);
  await db.query(`INSERT INTO stock_catalog_getter_checkpoint_v2
    (consumer_key,chain_id,contract_address,start_block_number,caught_up)
    VALUES ('stock_catalog_getter_v2',4663,$1,'0',false)
    ON CONFLICT (consumer_key) DO NOTHING`, [ADDRESS]);
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
    registered(KEY_B, { transactionIndex: '1', logIndex: '0' }),
    activated(KEY_B, '2', { transactionIndex: '1', logIndex: '1' }),
    deactivated(KEY_A, '2', { transactionIndex: '1', logIndex: '2' })]],
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

await test('catalog grammar accepts zero, two, and three ordered distinct conflicts', async () => {
  for (const conflicts of [0, 2, 3]) {
    const db = await freshDb();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const keys = [KEY_A, KEY_B, KEY_C];
      const identities = [
        { tickerHash: HASH('1'), tokenAddress: getAddress(`0x${'1'.repeat(40)}`).toLowerCase(), providerHash: HASH('4') },
        { tickerHash: HASH('2'), tokenAddress: getAddress(`0x${'2'.repeat(40)}`).toLowerCase(), providerHash: HASH('5') },
        { tickerHash: HASH('3'), tokenAddress: getAddress(`0x${'3'.repeat(40)}`).toLowerCase(), providerHash: HASH('6') },
      ];
      const setup = [];
      for (let index = 0; index < conflicts; index += 1) {
        const transactionHash = HASH(['5', 'd', 'e'][index]);
        setup.push(registeredIdentity(keys[index], identities[index], {
          transactionHash, transactionIndex: String(index), logIndex: '0',
        }));
        setup.push(activated(keys[index], String(index + 1), {
          transactionHash, transactionIndex: String(index), logIndex: '1',
        }));
      }
      const targetTx = String(conflicts + 1);
      const targetTransactionHash = HASH(['d', 'e', 'f', 'a'][conflicts]);
      const targetCatalog = String(conflicts + 1);
      const target = registeredIdentity(KEY_D, {
        tickerHash: conflicts > 0 ? identities[0].tickerHash : HASH('7'),
        tokenAddress: conflicts > 1 ? identities[1].tokenAddress
          : getAddress(`0x${'7'.repeat(40)}`).toLowerCase(),
        providerHash: conflicts > 2 ? identities[2].providerHash : HASH('7'),
      }, { transactionHash: targetTransactionHash, transactionIndex: targetTx, logIndex: '0' });
      const conflictEvents = keys.slice(0, conflicts).map((key, index) => deactivated(
        key, targetCatalog, { transactionHash: targetTransactionHash,
          transactionIndex: targetTx, logIndex: String(index + 1) },
      ));
      await applyFinalizedRwaActivationEvents(client, Object.freeze([
        ...setup, target, ...conflictEvents,
        activated(KEY_D, targetCatalog, { transactionHash: targetTransactionHash,
          transactionIndex: targetTx, logIndex: String(conflicts + 1) }),
      ]));
      await client.query('ROLLBACK');
    } finally { client.release(); await db.end?.(); }
  }
});

await test('catalog grammar rejects duplicate conflict, reversed conflict order, and missing active instance', async () => {
  const cases = [
    [registered(KEY_A), activated(KEY_A, '1'),
      registered(KEY_D, { transactionIndex: '1', logIndex: '0' }),
      deactivated(KEY_A, '2', { transactionIndex: '1', logIndex: '1' }),
      deactivated(KEY_A, '2', { transactionIndex: '1', logIndex: '2' }),
      activated(KEY_D, '2', { transactionIndex: '1', logIndex: '3' })],
    [registered(KEY_A), activated(KEY_A, '1'),
      registered(KEY_B, { transactionIndex: '1', logIndex: '0' }),
      activated(KEY_B, '2', { transactionIndex: '1', logIndex: '1' }),
      registered(KEY_D, { transactionIndex: '2', logIndex: '0' }),
      deactivated(KEY_B, '3', { transactionIndex: '2', logIndex: '1' }),
      deactivated(KEY_A, '3', { transactionIndex: '2', logIndex: '2' }),
      activated(KEY_D, '3', { transactionIndex: '2', logIndex: '3' })],
    [registered(KEY_A), deactivated(KEY_A, '1')],
  ];
  for (const events of cases) {
    const db = await freshDb();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await assert.rejects(() => applyFinalizedRwaActivationEvents(client, Object.freeze(events)));
      await client.query('ROLLBACK');
    } finally { client.release(); await db.end?.(); }
  }
});

await test('registration is exact-idempotent, conflicts fail, and same-key reactivation increments generation', async () => {
  const db = await freshDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await applyFinalizedRwaActivationEvents(client, Object.freeze([registered(KEY_A)]));
    await applyFinalizedRwaActivationEvents(client, Object.freeze([registered(KEY_A)]));
    await applyFinalizedRwaActivationEvents(client, Object.freeze([activated(KEY_A, '1')]));
    await applyFinalizedRwaActivationEvents(client, Object.freeze([
      deactivated(KEY_A, '2', { transactionIndex: '1' }),
    ]));
    await applyFinalizedRwaActivationEvents(client, Object.freeze([
      activated(KEY_A, '3', { transactionIndex: '2' }),
    ]));
    const row = (await client.query(`SELECT activation_generation,active,catalog_version
      FROM rwa_registry_asset_lifecycle_current_v2 WHERE asset_version_key=$1`, [KEY_A])).rows[0];
    assert.deepEqual([String(row.activation_generation), row.active, String(row.catalog_version)],
      ['2', true, '3']);
    await assert.rejects(() => applyFinalizedRwaActivationEvents(client, Object.freeze([
      registered(KEY_A, { blockTimestamp: '1001' }),
    ])), (error) => error.code === 'rwa_lifecycle_structure');
    await client.query('ROLLBACK');
  } finally { client.release(); await db.end?.(); }
});

await test('an already-active Registry version can be activated again with a new generation', async () => {
  const db = await freshDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await applyFinalizedRwaActivationEvents(client, Object.freeze([
      registered(KEY_A), activated(KEY_A, '1'),
    ]));
    await applyFinalizedRwaActivationEvents(client, Object.freeze([
      activated(KEY_A, '2', { transactionIndex: '1', transactionHash: HASH('d') }),
    ]));
    const row = (await client.query(`SELECT activation_generation,active,catalog_version
      FROM rwa_registry_asset_lifecycle_current_v2 WHERE asset_version_key=$1`, [KEY_A])).rows[0];
    const instances = (await client.query(`SELECT activation_generation,deactivated_at
      FROM rwa_registry_activation_instances_v2 WHERE asset_version_key=$1
      ORDER BY activation_generation`, [KEY_A])).rows;
    assert.deepEqual([String(row.activation_generation), row.active, String(row.catalog_version)],
      ['2', true, '2']);
    assert.deepEqual(instances.map((instance) =>
      [String(instance.activation_generation), instance.deactivated_at]), [['1', null], ['2', null]]);
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

await test('activation provenance distinguishes exact match, each local-field drift, and unmatched', async () => {
  const variants = [
    ['matched', {}, 'matched'],
    ['evidence', { evidence_hash: HASH('f') }, 'drift'],
    ['asset', { asset_version_key: KEY_B }, 'drift'],
    ['registry', { registry_address: getAddress(`0x${'f'.repeat(40)}`).toLowerCase() }, 'drift'],
    ['approved', { approved_at: new Date(901 * 1000) }, 'drift'],
    ['deadline', { valid_until: new Date(605701 * 1000) }, 'drift'],
    ['unmatched', null, 'unmatched'],
  ];
  for (const [name, mutation, expected] of variants) {
    const db = await freshDb();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      if (mutation) {
        const proposal = {
          asset_version_key: KEY_A, registry_address: ADDRESS, evidence_hash: EVIDENCE,
          approved_at: new Date(900 * 1000), valid_until: new Date(605700 * 1000), ...mutation,
        };
        await client.query(`INSERT INTO rwa_nomination_safe_proposals_v2
          (nomination_id,asset_version_key,registry_address,safe_transaction,calldata_hash,
           evidence_hash,review_id,approved_at,valid_until,status)
          VALUES ($1,$2,$3,'{}',$4,$5,$6,$7,$8,'approval_stale')`,
        [`proposal-${name}`, proposal.asset_version_key, proposal.registry_address, HASH('d'),
          proposal.evidence_hash, REVIEW, proposal.approved_at, proposal.valid_until]);
      }
      const results = await applyFinalizedRwaActivationEvents(client,
        Object.freeze([registered(KEY_A), activated(KEY_A, '1')]));
      assert.equal(results[1].disposition, expected, name);
      assert.equal(results[1].localRecordId, expected === 'matched' ? `proposal-${name}`
        : expected === 'drift' ? `proposal-${name}` : null, name);
      await client.query('ROLLBACK');
    } finally { client.release(); await db.end?.(); }
  }
});

await test('ballot provenance distinguishes every one-field drift and unmatched', async () => {
  const base = {
    status: 'closed_ready', asset_version_key: KEY_A, token_address: ADDRESS,
    token_decimals: 18, tally_hash: HASH('c'), catalog_version: '1',
    max_eth_wei: '1000000000000000000', purchase_until: new Date(700000 * 1000),
  };
  const variants = [
    ['matched', {}, 'matched'], ['status', { status: 'skipped_catalog_empty' }, 'drift'],
    ['asset', { asset_version_key: KEY_B }, 'drift'],
    ['token', { token_address: getAddress(`0x${'f'.repeat(40)}`).toLowerCase() }, 'drift'],
    ['decimals', { token_decimals: 17 }, 'drift'], ['tally', { tally_hash: HASH('d') }, 'drift'],
    ['catalog', { catalog_version: '2' }, 'drift'], ['budget', { max_eth_wei: '2' }, 'drift'],
    ['window', { purchase_until: new Date(700001 * 1000) }, 'drift'],
    ['unmatched', null, 'unmatched'],
  ];
  for (const [name, mutation, expected] of variants) {
    const db = await freshDb();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await applyFinalizedRwaActivationEvents(client, Object.freeze([registered(KEY_A)]));
      if (mutation) {
        const row = { ...base, ...mutation };
        const closed = row.status === 'closed_ready';
        await client.query(`INSERT INTO ticker_ballot_results_v2
          (day,status,asset_version_key,ticker,token_address,token_decimals,registry_index,
           catalog_version,catalog_snapshot_hash,max_eth_wei,votes,weighted,decided_by,
           decided_by_code,skip_reason,tally_hash,closed_at,purchase_until)
          VALUES ('7',$1,$2,$3,$4,$5,$6,$7,$8,$9,0,0,$10,$11,$12,$13,now(),$14)`,
        [row.status, closed ? row.asset_version_key : null, closed ? 'AAPL' : null,
          closed ? row.token_address : null, closed ? row.token_decimals : null,
          closed ? '0' : null, row.catalog_version, SNAPSHOT, row.max_eth_wei,
          closed ? 'default_silence' : 'skipped', closed ? 2 : 5,
          closed ? null : 'catalog_empty', row.tally_hash, closed ? row.purchase_until : null]);
      }
      const [result] = await applyFinalizedRwaBallotEvents(client, Object.freeze([decoded('BallotPublished', {
        day: '7', assetVersionKey: KEY_A, tokenAddress: ADDRESS, tokenDecimals: 18,
        tallyHash: HASH('c'), catalogVersion: '1', maxEthWei: '1000000000000000000',
        purchaseUntil: '700000', publishedAt: '1000',
      })]));
      assert.equal(result.disposition, expected, name);
      assert.equal(result.localRecordId, mutation ? '7' : null, name);
      await client.query('ROLLBACK');
    } finally { client.release(); await db.end?.(); }
  }
});

async function seedReadyLifecycle(db, { readyAt = '2030-01-01T00:00:00.000Z' } = {}) {
  await db.query(`INSERT INTO stock_catalog_sync_state_v2
    (id,chain_id,registry_address,catalog_version,finalized_block_number,finalized_block_hash,
     snapshot_hash,observation_hash,finalized_horizon_number,finalized_horizon_hash,caught_up,
     verified_at,ready_verified_at,synced_at)
    VALUES (1,4663,$1,'0','100',$2,$3,$4,'100',$2,true,$5,$5,$5)
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
    finalized_horizon_block_number='100',finalized_horizon_block_hash=$1,caught_up=true,
    halted=false,verified_at=$4,ready_verified_at=$4
    WHERE consumer_key='rwa_registry_lifecycle_v2'`, [BLOCK, OBSERVATION, ADDRESS, readyAt]);
  await db.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET
    registry_address=$2,start_block_number='0',last_applied_block_number='100',
    last_applied_block_hash=$3,finalized_horizon_block_number='100',
    finalized_horizon_block_hash=$3,caught_up=true,sync_in_progress=false,
    ready_verified_at=$1,halted=false WHERE id=1`, [readyAt, ADDRESS, BLOCK]);
  await db.query(`INSERT INTO rwa_registry_publisher_current_v2
    (chain_id,registry_address,publisher,block_number,block_hash,block_timestamp,
     transaction_hash,transaction_index,log_index)
    VALUES (4663,$1,$1,'100',$2,'1000',$3,'0','0')
    ON CONFLICT (chain_id,registry_address) DO UPDATE SET publisher=EXCLUDED.publisher,
      block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash,
      block_timestamp=EXCLUDED.block_timestamp,transaction_hash=EXCLUDED.transaction_hash,
      transaction_index=EXCLUDED.transaction_index,log_index=EXCLUDED.log_index`,
  [ADDRESS, BLOCK, TX]);
  await db.query(`INSERT INTO rwa_registry_publisher_history_v2
    (chain_id,registry_address,publisher,block_number,block_hash,block_timestamp,
     transaction_hash,transaction_index,log_index)
    VALUES (4663,$1,$1,'100',$2,'1000',$3,'0','0')
    ON CONFLICT DO NOTHING`, [ADDRESS, BLOCK, TX]);
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

await test('readiness freshness accepts exactly 600 seconds and rejects one millisecond past', async () => {
  for (const [offset, expected] of [[600000, 'ready'], [600001, 'rwa_lifecycle_not_ready']]) {
    const db = await freshDb();
    const databaseNow = Date.parse('2030-01-01T00:10:00.000Z');
    await seedReadyLifecycle(db, { readyAt: new Date(databaseNow - offset).toISOString() });
    const client = await db.connect();
    const clockedClient = {
      query(...args) {
        if (/^SELECT now\(\) AS now$/i.test(String(args[0]).trim())) {
          return Promise.resolve({ rows: [{ now: new Date(databaseNow) }], rowCount: 1 });
        }
        return client.query(...args);
      },
    };
    try {
      await client.query('BEGIN');
      if (expected === 'ready') {
        const receipt = await readFinalizedRwaLifecycleHeadV2(clockedClient);
        assert.equal(new Date(receipt.freshThrough).getTime(), databaseNow);
      } else await rejectsCode(() => readFinalizedRwaLifecycleHeadV2(clockedClient), expected);
      await client.query('ROLLBACK');
    } finally { client.release(); await db.end?.(); }
  }
});

await test('head reconciliation remains row-bounded with unrelated provenance and history', async () => {
  const db = await freshDb();
  await seedReadyLifecycle(db);
  for (let index = 0; index < 300; index += 1) {
    const key = `0x${BigInt(index + 1000).toString(16).padStart(64, '0')}`;
    await db.query(`INSERT INTO rwa_nomination_safe_proposals_v2
      (nomination_id,asset_version_key,registry_address,safe_transaction,calldata_hash,
       evidence_hash,review_id,approved_at,valid_until,status)
      VALUES ($1,$2,$3,'{}',$4,$5,$6,$7,$8,'approval_stale')`,
    [`unrelated-${index}`, key, ADDRESS, HASH('d'), EVIDENCE,
      `0x${BigInt(index + 5000).toString(16).padStart(64, '0')}`,
      new Date(900 * 1000), new Date(605700 * 1000)]);
    await db.query(`INSERT INTO rwa_registry_activation_instances_v2
      (chain_id,registry_address,asset_version_key,activation_generation,
       activation_block_number,activation_block_hash,activation_transaction_hash,
       activation_transaction_index,activation_log_index,catalog_version,review_id,evidence_hash,
       approved_at,valid_until,included_at,local_match,local_match_record_id)
      VALUES (4663,$1,$2,'1','1',$3,$4,'0',$5,'1',$6,$7,$8,$9,$10,false,NULL)`,
    [ADDRESS, key, BLOCK, TX, String(index), REVIEW, EVIDENCE,
      new Date(900 * 1000), new Date(605700 * 1000), new Date(1000 * 1000)]);
  }
  const client = await db.connect();
  let maxAuthorityRows = 0;
  const boundedClient = {
    async query(...args) {
      const result = await client.query(...args);
      const sql = String(args[0]);
      if (/rwa_nomination_safe_proposals_v2|rwa_registry_activation_instances_v2/i.test(sql)) {
        maxAuthorityRows = Math.max(maxAuthorityRows, result.rows?.length ?? 0);
      }
      return result;
    },
  };
  try {
    await client.query('BEGIN');
    await readFinalizedRwaLifecycleHeadV2(boundedClient);
    assert(maxAuthorityRows <= 256,
      `head reconciliation materialized ${maxAuthorityRows} unrelated authority rows`);
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

await test('strict authoring success returns the exact authoritative frozen receipt', async () => {
  const db = await freshDb();
  await seedReadyLifecycle(db);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO rwa_nomination_safe_proposals_v2
      (nomination_id,asset_version_key,registry_address,safe_transaction,calldata_hash,
       evidence_hash,review_id,approved_at,valid_until,status)
      VALUES ('fixture-proposal',$1,$2,'{}',$3,$4,$5,$6,$7,'approval_stale')`,
    [KEY_A, ADDRESS, HASH('d'), EVIDENCE, REVIEW, new Date(900 * 1000), new Date(605700 * 1000)]);
    await applyFinalizedRwaActivationEvents(client, Object.freeze([registered(KEY_A), activated(KEY_A, '1')]));
    await client.query(`INSERT INTO rwa_registry_lifecycle_inbox_v2
      (inbox_id,consumer_key,chain_id,contract_address,block_number,block_hash,block_timestamp,
       transaction_hash,transaction_index,log_index,topic0,topics_json,data_hex,event_kind,
       decoded_hash,observation_hash,asset_version_key,evidence_hash,review_id,approved_at,
       valid_until,catalog_version)
      VALUES ('activation-fixture','rwa_registry_lifecycle_v2',4663,$1,'100',$2,'1000',
        $3,'0','1',$4,'[]','0x','AssetVersionActivated',$5,$6,$7,$8,$9,'900','605700','1')`,
    [ADDRESS, BLOCK, TX, HASH('1'), HASH('2'), OBSERVATION, KEY_A, EVIDENCE, REVIEW]);
    await client.query(`INSERT INTO rwa_registry_lifecycle_event_results_v2
      (inbox_id,event_kind,disposition,local_record_id,detail_code)
      VALUES ('activation-fixture','AssetVersionActivated','activation_matched','fixture-proposal','matched')`);
    await client.query(`UPDATE stock_catalog_sync_state_v2 SET catalog_version='1' WHERE id=1`);
    const lifecycleRow = (await client.query(`SELECT * FROM rwa_registry_asset_lifecycle_current_v2
      WHERE asset_version_key=$1`, [KEY_A])).rows[0];
    await client.query(`INSERT INTO stock_asset_versions_v2
      (asset_version_key,chain_id,ticker_hash,ticker,name,token_address,token_decimals,
       robinhood_asset_id_hash,registry_index,active,registered_at,activated_at,deactivated_at,
       last_catalog_version,synced_at)
      VALUES ($1,4663,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,NULL,'1',now())`,
    [KEY_A, lifecycleRow.ticker_hash, lifecycleRow.ticker, lifecycleRow.name,
      lifecycleRow.token_address, lifecycleRow.token_decimals, lifecycleRow.robinhood_asset_id_hash,
      lifecycleRow.registry_index, new Date(1000 * 1000), new Date(1000 * 1000)]);
    await client.query(`INSERT INTO stock_asset_active_heads_v2
      (dimension_type,dimension_value,asset_version_key) VALUES
      ('tickerHash',$1,$4),('tokenAddress',$2,$4),('robinhoodAssetIdHash',$3,$4)`,
    [HASH('9'), ADDRESS, HASH('a'), KEY_A]);
    const receipt = await requireFinalizedRwaActivationV2(client, KEY_A,
      { expectedActivationGeneration: '1' });
    assert.equal(Object.getPrototypeOf(receipt), null);
    assert(Object.isFrozen(receipt));
    assert.deepEqual(Object.keys(receipt), [
      'chainId', 'registryAddress', 'assetVersionKey', 'activationGeneration', 'active',
      'localMatch', 'activationBlockNumber', 'activationBlockHash',
      'activationTransactionHash', 'activationLogIndex', 'catalogVersion',
      'catalogSnapshotHash', 'reviewId', 'evidenceHash', 'approvedAt', 'validUntil',
      'includedAt', 'appliedBlockNumber', 'appliedBlockHash', 'caughtUp', 'halted',
    ]);
    assert.deepEqual({
      chainId: receipt.chainId, registryAddress: receipt.registryAddress,
      key: receipt.assetVersionKey, generation: receipt.activationGeneration,
      active: receipt.active, localMatch: receipt.localMatch,
      blockNumber: receipt.activationBlockNumber, blockHash: receipt.activationBlockHash,
      transactionHash: receipt.activationTransactionHash, logIndex: receipt.activationLogIndex,
      catalogVersion: receipt.catalogVersion, snapshot: receipt.catalogSnapshotHash,
      reviewId: receipt.reviewId, evidenceHash: receipt.evidenceHash,
      approvedAt: receipt.approvedAt, validUntil: receipt.validUntil, includedAt: receipt.includedAt,
      appliedBlockNumber: receipt.appliedBlockNumber, appliedBlockHash: receipt.appliedBlockHash,
      caughtUp: receipt.caughtUp, halted: receipt.halted,
    }, {
      chainId: '4663', registryAddress: ADDRESS, key: KEY_A, generation: '1',
      active: true, localMatch: true, blockNumber: '100', blockHash: BLOCK,
      transactionHash: TX, logIndex: '1', catalogVersion: '1', snapshot: SNAPSHOT,
      reviewId: REVIEW, evidenceHash: EVIDENCE, approvedAt: '900', validUntil: '605700',
      includedAt: '1000', appliedBlockNumber: '100', appliedBlockHash: BLOCK,
      caughtUp: true, halted: false,
    });
    for (const [column, badValue, exactValue] of [
      ['asset_version_key', KEY_B, KEY_A],
      ['registry_address', getAddress(`0x${'f'.repeat(40)}`).toLowerCase(), ADDRESS],
      ['evidence_hash', HASH('f'), EVIDENCE],
      ['review_id', HASH('e'), REVIEW],
      ['approved_at', new Date(901 * 1000), new Date(900 * 1000)],
      ['valid_until', new Date(605701 * 1000), new Date(605700 * 1000)],
    ]) {
      await client.query(`UPDATE rwa_nomination_safe_proposals_v2 SET ${column}=$1
        WHERE nomination_id='fixture-proposal'`, [badValue]);
      await rejectsCode(() => requireFinalizedRwaActivationV2(client, KEY_A,
        { expectedActivationGeneration: '1' }), 'rwa_activation_state_malformed');
      await client.query(`UPDATE rwa_nomination_safe_proposals_v2 SET ${column}=$1
        WHERE nomination_id='fixture-proposal'`, [exactValue]);
    }
    const expectTask5Mismatch = async (mutateSql, mutateArgs, restoreSql, restoreArgs) => {
      await client.query(mutateSql, mutateArgs);
      await rejectsCode(() => requireFinalizedRwaActivationV2(client, KEY_A,
        { expectedActivationGeneration: '1' }), 'rwa_activation_task5_mismatch');
      await client.query(restoreSql, restoreArgs);
    };
    const task5Mutations = [
      [`UPDATE stock_asset_versions_v2 SET ticker_hash=$1 WHERE asset_version_key=$2`,
        [HASH('f'), KEY_A], `UPDATE stock_asset_versions_v2 SET ticker_hash=$1 WHERE asset_version_key=$2`,
        [HASH('9'), KEY_A]],
      [`UPDATE stock_asset_versions_v2 SET ticker='BAD' WHERE asset_version_key=$1`, [KEY_A],
        `UPDATE stock_asset_versions_v2 SET ticker='AAPL' WHERE asset_version_key=$1`, [KEY_A]],
      [`UPDATE stock_asset_versions_v2 SET name='Bad' WHERE asset_version_key=$1`, [KEY_A],
        `UPDATE stock_asset_versions_v2 SET name='Apple Stock Token' WHERE asset_version_key=$1`, [KEY_A]],
      [`UPDATE stock_asset_versions_v2 SET token_address=$1 WHERE asset_version_key=$2`,
        [getAddress(`0x${'f'.repeat(40)}`).toLowerCase(), KEY_A],
        `UPDATE stock_asset_versions_v2 SET token_address=$1 WHERE asset_version_key=$2`, [ADDRESS, KEY_A]],
      [`UPDATE stock_asset_versions_v2 SET token_decimals=17 WHERE asset_version_key=$1`, [KEY_A],
        `UPDATE stock_asset_versions_v2 SET token_decimals=18 WHERE asset_version_key=$1`, [KEY_A]],
      [`UPDATE stock_asset_versions_v2 SET robinhood_asset_id_hash=$1 WHERE asset_version_key=$2`,
        [HASH('f'), KEY_A],
        `UPDATE stock_asset_versions_v2 SET robinhood_asset_id_hash=$1 WHERE asset_version_key=$2`,
        [HASH('a'), KEY_A]],
      [`UPDATE stock_asset_versions_v2 SET registered_at=$1 WHERE asset_version_key=$2`,
        [new Date(1001 * 1000), KEY_A],
        `UPDATE stock_asset_versions_v2 SET registered_at=$1 WHERE asset_version_key=$2`,
        [new Date(1000 * 1000), KEY_A]],
      [`UPDATE stock_asset_versions_v2 SET active=false WHERE asset_version_key=$1`, [KEY_A],
        `UPDATE stock_asset_versions_v2 SET active=true WHERE asset_version_key=$1`, [KEY_A]],
      [`UPDATE stock_asset_versions_v2 SET registry_index='1' WHERE asset_version_key=$1`, [KEY_A],
        `UPDATE stock_asset_versions_v2 SET registry_index='0' WHERE asset_version_key=$1`, [KEY_A]],
      [`UPDATE stock_catalog_sync_state_v2 SET catalog_version='2' WHERE id=1`, [],
        `UPDATE stock_catalog_sync_state_v2 SET catalog_version='1' WHERE id=1`, []],
    ];
    for (const mutation of task5Mutations) await expectTask5Mismatch(...mutation);
    for (const [fieldPair, badValue, goodValue] of [
      [['last_applied_block_number', 'finalized_horizon_number'], '101', '100'],
      [['last_applied_block_hash', 'finalized_horizon_hash'], HASH('f'), BLOCK],
    ]) {
      const stateFields = fieldPair[0].endsWith('number')
        ? ['finalized_block_number', 'finalized_horizon_number']
        : ['finalized_block_hash', 'finalized_horizon_hash'];
      await client.query(`UPDATE stock_catalog_getter_checkpoint_v2 SET
        ${fieldPair[0]}=$1,${fieldPair[1]}=$1 WHERE consumer_key='stock_catalog_getter_v2'`, [badValue]);
      await client.query(`UPDATE stock_catalog_sync_state_v2 SET
        ${stateFields[0]}=$1,${stateFields[1]}=$1 WHERE id=1`, [badValue]);
      await rejectsCode(() => requireFinalizedRwaActivationV2(client, KEY_A,
        { expectedActivationGeneration: '1' }), 'rwa_activation_task5_mismatch');
      await client.query(`UPDATE stock_catalog_getter_checkpoint_v2 SET
        ${fieldPair[0]}=$1,${fieldPair[1]}=$1 WHERE consumer_key='stock_catalog_getter_v2'`, [goodValue]);
      await client.query(`UPDATE stock_catalog_sync_state_v2 SET
        ${stateFields[0]}=$1,${stateFields[1]}=$1 WHERE id=1`, [goodValue]);
    }
    for (const dimension of ['tickerHash', 'tokenAddress', 'robinhoodAssetIdHash']) {
      await expectTask5Mismatch(
        `UPDATE stock_asset_active_heads_v2 SET asset_version_key=$1 WHERE dimension_type=$2`,
        [KEY_B, dimension],
        `UPDATE stock_asset_active_heads_v2 SET asset_version_key=$1 WHERE dimension_type=$2`,
        [KEY_A, dimension],
      );
    }
    await client.query('ROLLBACK');
  } finally { client.release(); await db.end?.(); }
});

await test('attempt lease refuses before 300 seconds and permits takeover exactly at equality', async () => {
  const db = await freshDb();
  await db.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET
    sync_in_progress=true,attempt_id='attempt-old',last_attempt_at=now(),ready_verified_at=NULL
    WHERE id=1`);
  await db.query(`INSERT INTO rwa_registry_lifecycle_attempts_v2
    (attempt_id,status,started_at) VALUES ('attempt-old','started',now())`);
  await rejectsCode(() => syncFinalizedRwaRegistryLifecycle(db), 'rwa_lifecycle_sync_busy');
  await db.query(`UPDATE rwa_registry_lifecycle_runtime_v2
    SET last_attempt_at=now()-INTERVAL '300 seconds' WHERE id=1`);
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

for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
if (failures.length) throw new AggregateError(failures, `${failures.length} rwaregistrylifecycle tests failed`);
console.log(`rwaregistrylifecycle: ${passes} passed`);
