// Deterministic finalized-RPC fixtures and actual SQL against disposable pg-mem tables.
// No live RPC, signing key, transaction broadcast or production database is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newDb } from 'pg-mem';
import { keccak256 } from 'viem';
import { releaseExpiredBondQuotes } from '../src/bondquoteexpiry.js';
import { columnMigrations } from '../src/db.js';

const address = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const CODE = '0x60006000', HASH = `0x${'ab'.repeat(32)}`, OTHER_HASH = `0x${'cd'.repeat(32)}`;
const NOW = 2_000_000, DEADLINE = 1900;
const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const quoteTable = schema.match(/CREATE TABLE IF NOT EXISTS bond_quotes \([\s\S]*?\n\);/)[0];
const expiryIndex = schema.match(/CREATE INDEX IF NOT EXISTS ix_bond_quotes_expiry[^;]+;/)[0];
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };

async function fixture({ count = 1 } = {}) {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  await pool.query('CREATE TABLE bond_reserve(id INT PRIMARY KEY,capacity_omr NUMERIC,committed_omr NUMERIC)');
  await pool.query('CREATE TABLE bonds(nonce BIGINT PRIMARY KEY)');
  await pool.query(quoteTable);
  await pool.query(expiryIndex);
  await pool.query('INSERT INTO bond_reserve VALUES(1,100000,1000)');
  const manifest = { schemaVersion: 1, chainId: 4663, governanceSafe: address(1), keeper: address(2),
    poolId: HASH, indexing: { startL2Block: '1', maxBlocks: 100 }, jobs: [], bondDailyIssuance: 'unlimited',
    contracts: Object.fromEntries(['omr', 'poolManager', 'oracle', 'polVault', 'bond'].map((name, i) =>
      [name, { address: address(i + 10), runtimeHash: keccak256(CODE) }])),
    gas: { maxGas: '100000', maxFeePerGas: '1000', maxPriorityFeePerGas: '100', dailyBudget: '1000000000', confirmations: 2, maxSnapshotAgeSeconds: 60 } };
  const config = { enabled: true, manifest, rpcUrl: 'https://unused.invalid/' };
  const env = { CHAIN_ID: '4663', OMERTA_BOND_ADDRESS: manifest.contracts.bond.address };
  for (let nonce = 1; nonce <= count; nonce++) await pool.query(
    'INSERT INTO bond_quotes(nonce,payer_address,principal_eth,price,discount_bps,payout_omr,vest_seconds,deadline,signature,chain_id,bond_address) VALUES($1,$2,1,1000,0,1000,3600,$3,$4,$5,$6)',
    [nonce, address(50), DEADLINE, '0x1234', manifest.chainId, manifest.contracts.bond.address]);
  const state = { calls: [], chainId: 4663, code: CODE, used: new Set(), locked: false,
    block: { number: 100n, hash: HASH, timestamp: 1950n }, canonicalHash: HASH };
  const trace = (method, args) => { assert.equal(state.locked, false, `RPC ${method} must precede the budget lock`); state.calls.push({ method, args }); };
  const publicClient = {
    async getChainId() { trace('getChainId', {}); return state.chainId; },
    async getBlock(args) {
      trace('getBlock', args);
      if (args.blockTag) {
        assert.equal(args.blockTag, 'finalized');
        if (state.failFinality) throw new Error('finalized is unsupported');
        return state.block;
      }
      assert.equal(args.blockNumber, state.block.number);
      if (state.beforeLock) await state.beforeLock();
      return { ...state.block, hash: state.canonicalHash };
    },
    async getCode(args) { trace('getCode', args); assert.equal(args.blockNumber, state.block.number); return state.code; },
    async readContract(args) {
      trace('readContract', args);
      assert.equal(args.functionName, 'usedNonce');
      assert.equal(args.blockNumber, state.block.number);
      assert.equal(args.address.toLowerCase(), manifest.contracts.bond.address);
      if (state.failNonce) throw new Error('RPC unavailable');
      return state.used.has(String(args.args[0]));
    },
  };
  const guardedPool = { query: (...args) => pool.query(...args), async connect() {
    const client = await pool.connect();
    return { async query(sql, ...args) {
      if (sql.includes('FROM bond_reserve') && sql.includes('FOR UPDATE')) state.locked = true;
      const result = await client.query(sql, ...args);
      if (sql === 'COMMIT' || sql === 'ROLLBACK') state.locked = false;
      return result;
    }, release() { client.release(); } };
  } };
  return { pool, state, config, env, publicClient,
    run: (options = {}) => releaseExpiredBondQuotes(guardedPool, { config, env, publicClient, now: NOW, ...options }),
    row: async (nonce = 1) => (await pool.query('SELECT * FROM bond_quotes WHERE nonce=$1', [nonce])).rows[0] };
}

await check('additive schema migrations include nullable deployment domain and expiry evidence', () => {
  const migrations = columnMigrations(schema);
  for (const [name, type] of [['chain_id', 'BIGINT'], ['bond_address', 'TEXT'], ['expiry_proof', 'TEXT']])
    assert(migrations.includes(`ALTER TABLE bond_quotes ADD COLUMN IF NOT EXISTS ${name} ${type}`));
});

await check('a finalized unused expired quote releases once and retains complete proof without RPC under a lock', async () => {
  const f = await fixture();
  try {
    assert.deepEqual(await f.run(), { examined: 1, released: 1, held: 0 });
    const row = await f.row(); assert.equal(row.status, 'expired');
    assert.deepEqual(JSON.parse(row.expiry_proof), { schemaVersion: 1, chainId: 4663,
      bondAddress: f.config.manifest.contracts.bond.address, runtimeHash: keccak256(CODE), finality: 'finalized',
      blockNumber: '100', blockHash: HASH, blockTimestamp: '1950', nonce: '1', deadline: '1900', usedNonce: false });
    const budget = (await f.pool.query('SELECT * FROM bond_reserve WHERE id=1')).rows[0];
    assert.equal(Number(budget.capacity_omr), 100000); assert.equal(Number(budget.committed_omr), 1000);
    f.state.calls.length = 0;
    assert.equal((await f.run()).released, 0); assert.equal(f.state.calls.length, 0);
    assert.equal((await f.row()).expiry_proof, row.expiry_proof);
  } finally { await f.pool.end(); }
});

for (const [name, mutate, reason] of [
  ['wrong RPC chain', (f) => { f.state.chainId = 1; }, 'expiry_wrong_chain'],
  ['wrong runtime', (f) => { f.state.code = '0x60006001'; }, 'expiry_runtime_mismatch'],
  ['missing runtime', (f) => { f.state.code = '0x'; }, 'expiry_runtime_mismatch'],
  ['unsupported finalized block', (f) => { f.state.failFinality = true; }, 'expiry_chain_unavailable'],
  ['RPC failure during nonce lookup', (f) => { f.state.failNonce = true; }, 'expiry_chain_unavailable'],
  ['changed canonical finalized hash', (f) => { f.state.canonicalHash = OTHER_HASH; }, 'expiry_finalized_block_changed'],
  ['future finalized timestamp', (f) => { f.state.block.timestamp = 2100n; }, 'expiry_future_finalized_block'],
  ['used nonce awaiting watcher', (f) => { f.state.used.add('1'); }, 'no_proven_unused_expiry'],
  ['exact deadline boundary', (f) => { f.state.block.timestamp = BigInt(DEADLINE); }, 'no_proven_unused_expiry'],
  ['wall-clock expiry before finalized chain expiry', (f) => { f.state.block.timestamp = 1899n; }, 'no_proven_unused_expiry'],
]) await check(`${name} retains the reservation`, async () => {
  const f = await fixture();
  try {
    mutate(f); const result = await f.run();
    assert.equal(result.released, 0); assert.equal(result.reason, reason);
    assert.equal((await f.row()).status, 'quoted'); assert.equal((await f.row()).expiry_proof, null);
    assert(f.state.calls.every((c) => c.method !== 'getBlock' || !c.args.blockTag || c.args.blockTag === 'finalized'));
  } finally { await f.pool.end(); }
});

for (const [name, mutate] of [
  ['configured contract mismatch', (f) => { f.env.OMERTA_BOND_ADDRESS = address(99); }],
  ['configured chain mismatch', (f) => { f.env.CHAIN_ID = '1'; }],
  ['invalid manifest policy', (f) => { f.config.manifest.bondDailyIssuance = 'other'; }],
  ['missing manifest bond runtime pin', (f) => { delete f.config.manifest.contracts.bond; }],
]) await check(`${name} refuses recovery before RPC`, async () => {
  const f = await fixture();
  try {
    mutate(f); const result = await f.run(); assert.equal(result.released, 0);
    assert.equal(result.reason, 'expiry_configuration_unavailable'); assert.equal(f.state.calls.length, 0);
    assert.equal((await f.row()).status, 'quoted');
  } finally { await f.pool.end(); }
});

for (const [name, sql] of [
  ['legacy missing domain', 'UPDATE bond_quotes SET chain_id=NULL,bond_address=NULL WHERE nonce=1'],
  ['another deployment', `UPDATE bond_quotes SET bond_address='${address(99)}' WHERE nonce=1`],
  ['another chain', 'UPDATE bond_quotes SET chain_id=1 WHERE nonce=1'],
]) await check(`${name} remains reserved without current-contract inference`, async () => {
  const f = await fixture();
  try {
    await f.pool.query(sql); assert.equal((await f.run()).released, 0); assert.equal(f.state.calls.length, 0);
    assert.equal((await f.row()).status, 'quoted');
  } finally { await f.pool.end(); }
});

for (const [name, sql] of [
  ['watcher consumed status', "UPDATE bond_quotes SET status='bonded' WHERE nonce=1"],
  ['deadline changed', 'UPDATE bond_quotes SET deadline=1999 WHERE nonce=1'],
  ['deployment changed', `UPDATE bond_quotes SET bond_address='${address(99)}' WHERE nonce=1`],
  ['bond booked without updating quote status', 'INSERT INTO bonds(nonce) VALUES(1)'],
]) await check(`database recheck preserves a ${name} race`, async () => {
  const f = await fixture();
  try {
    f.state.beforeLock = () => f.pool.query(sql); assert.equal((await f.run()).released, 0);
    assert.equal((await f.row()).expiry_proof, null); assert.notEqual((await f.row()).status, 'expired');
  } finally { await f.pool.end(); }
});

await check('one recovery call considers at most the oldest 100 candidates', async () => {
  const f = await fixture({ count: 101 });
  try {
    const first = await f.run(); assert.equal(first.examined, 100); assert.equal(first.released, 100);
    assert.equal((await f.row(101)).status, 'quoted');
    assert.equal((await f.run()).released, 1);
  } finally { await f.pool.end(); }
});

console.log(`${passed} bond quote expiry checks passed with deterministic finalized-RPC fixtures and disposable pg-mem SQL; no live network or broadcasts.`);
