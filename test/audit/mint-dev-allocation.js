// Allocation amendment: new mint payments belong entirely to DEV_WALLET. Exercise
// the real DB ingestion, entitlement reconciliation, historical accounting and router.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { getAddress } from 'viem';

if (process.argv.includes('--memory')) delete process.env.DATABASE_URL;
if (process.env.DATABASE_URL) {
  const target = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
  assert.ok(['/omerta_audit_mint_dev', '/omerta_audit_mint_dev_retest'].includes(target.pathname), 'requires a dedicated scratch database');
}
process.env.VIG_BPS = '2500';
process.env.FEE_RWA_BPS = '1000';
process.env.FEE_COMMUNITY_BPS = '1500';
const { makeDb, columnMigrations } = await import('../../src/db.js');
const { recordFeePayment, reconcileFees, feeStatus } = await import('../../src/fees.js');
const { recordVigRevenue } = await import('../../src/vig.js');
const { routerBoard, runRouterInvariants } = await import('../../src/router.js');

// The real-Postgres branch proves default backfill and idempotency. pg-mem does not
// backfill Boolean defaults on ALTER TABLE, so it cannot substantiate that claim.
const migration = columnMigrations(fs.readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8'))
  .find((sql) => sql.startsWith('ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS mint_dev_only '));
assert.ok(migration);

const pool = await makeDb();
try {
  if (process.env.DATABASE_URL) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE TEMP TABLE fee_payments (nonce BIGINT PRIMARY KEY, kind TEXT NOT NULL) ON COMMIT DROP');
      await client.query("INSERT INTO fee_payments VALUES (1, 'mint')");
      await client.query(migration);
      await client.query(migration);
      assert.equal((await client.query('SELECT mint_dev_only FROM fee_payments WHERE nonce=1')).rows[0].mint_dev_only, false);
      await client.query('ROLLBACK');
    } finally { client.release(); }
  }
  const accountId = `mint-dev-${crypto.randomUUID()}`;
  const wallet = getAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const gross = '10000000000000000';
  const txHash = '0x' + 'ab'.repeat(32);
  const ledgerCount = async () => Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n);
  const before = await ledgerCount();

  // Seed one historical split payment, exactly as a migrated pre-amendment row.
  await pool.query("INSERT INTO fee_payments (nonce, kind, payer_address, amount_wei, tx_hash) VALUES (1,'mint',$1,$2,$3)", [wallet, gross, txHash]);
  await pool.query("INSERT INTO vig_revenue (source, ref, kind, gross_eth, vig_eth) VALUES ('fee','1','mint',0.01,0.0025)");
  await pool.query("INSERT INTO rwa_revenue (source, ref, rwa_eth) VALUES ('fee','1',0.001)");
  await pool.query("INSERT INTO community_revenue (source, ref, currency, gross, amount) VALUES ('fee','1','eth',0.01,0.0015)");
  const legacyBefore = JSON.stringify((await pool.query("SELECT * FROM vig_revenue WHERE source='fee' AND ref='1'")).rows);

  const payment = { nonce: 2, kind: 'mint', payer: wallet, amountWei: gross, txHash };
  assert.equal((await recordFeePayment(pool, payment)).credited, false, 'unlinked mint parks for reconciliation');
  assert.equal((await recordFeePayment(pool, payment)).duplicate, true);
  const row = (await pool.query('SELECT * FROM fee_payments WHERE nonce=2')).rows[0];
  assert.equal(row.mint_dev_only, true);
  for (const table of ['vig_revenue', 'rwa_revenue', 'community_revenue'])
    assert.equal((await pool.query(`SELECT * FROM ${table} WHERE source='fee' AND ref='2'`)).rows.length, 0, table);
  assert.deepEqual(await recordVigRevenue(pool, { source: 'fee', ref: 2, kind: 'mint', amountWei: gross, bps: 10000 }),
    { recorded: false }, 'explicit caller BPS cannot allocate mint to Vig');

  await pool.query('INSERT INTO accounts (id, auth_provider, auth_subject) VALUES ($1,$2,$1)', [accountId, 'audit-fixture']);
  await pool.query('INSERT INTO account_persistent (account_id, wallet_address) VALUES ($1,$2)', [accountId, wallet]);
  assert.equal((await reconcileFees(pool, accountId, wallet)).credited, 2, 'old and new mint entitlements remain valid');
  assert.equal((await reconcileFees(pool, accountId, wallet)).credited, 0);
  assert.equal((await feeStatus(pool, accountId)).mintCredits, 2);
  await recordFeePayment(pool, { ...payment, nonce: 3 });
  assert.equal((await feeStatus(pool, accountId)).mintCredits, 3, 'linked mint credits immediately');
  await recordFeePayment(pool, { ...payment, nonce: 4, txHash: null });
  assert.equal((await feeStatus(pool, accountId)).mintCredits, 4, 'comp entitlement remains unchanged');
  await recordFeePayment(pool, { ...payment, nonce: 5, amountWei: '0' });
  assert.equal((await feeStatus(pool, accountId)).mintCredits, 4, 'zero-value record grants no credit');
  for (const [nonce, kind] of [[6, 'respawn'], [7, 'reroll']]) {
    await recordFeePayment(pool, { ...payment, nonce, kind });
    assert.equal((await pool.query('SELECT mint_dev_only FROM fee_payments WHERE nonce=$1', [nonce])).rows[0].mint_dev_only, false);
    assert.equal(Number((await pool.query("SELECT vig_eth FROM vig_revenue WHERE source='fee' AND ref=$1", [String(nonce)])).rows[0].vig_eth), 0.0025);
    assert.equal(Number((await pool.query("SELECT rwa_eth FROM rwa_revenue WHERE source='fee' AND ref=$1", [String(nonce)])).rows[0].rwa_eth), 0.001);
    assert.equal(Number((await pool.query("SELECT amount FROM community_revenue WHERE source='fee' AND ref=$1", [String(nonce)])).rows[0].amount), 0.0015);
  }
  const board = await routerBoard(pool);
  assert.equal(board.invariants.ok, true, JSON.stringify(board.invariants.checks.filter((c) => !c.ok)));
  assert.deepEqual(board.lifetime.mint, { gross: 0.02, operations: 0.02, vig: 0, treasury: 0, community: 0 });
  assert.equal(board.lifetime.fee.gross, 0.03, 'legacy mint and two split fees preserve their own gross');
  assert.equal(board.lifetime.fee.operations, 0.015);
  assert.equal(JSON.stringify((await pool.query("SELECT * FROM vig_revenue WHERE source='fee' AND ref='1'")).rows), legacyBefore);

  // A mistaken future booking must trip the allocation invariant, even for tiny amounts.
  await pool.query("INSERT INTO community_revenue (source, ref, currency, gross, amount) VALUES ('fee','2','eth',0.01,0.000001)");
  assert.equal((await runRouterInvariants(pool)).checks.find((c) => c.name === 'character mint belongs entirely to DEV_WALLET').ok, false);
  await pool.query("DELETE FROM community_revenue WHERE source='fee' AND ref='2'");
  assert.equal(await ledgerCount(), before, 'fee accounting and credits create no gameplay currency');
  console.log(JSON.stringify({ ok: true, database: process.env.DATABASE_URL ? 'postgres' : 'pg-mem',
    mintGrossEth: board.lifetime.mint.gross, mintDevEth: board.lifetime.mint.operations,
    historicalAndNonMintGrossEth: board.lifetime.fee.gross, mintCredits: 4,
    historicalRowsPreserved: true, allocationInvariantDetectsPhantomRevenue: true }));
} finally { await pool.end(); }
