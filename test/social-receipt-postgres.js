import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { installLegacySocialReceiptGuard, migrateSocialProofReceipts,
  verifyLegacySocialReceiptGuard } from '../src/db.js';
import { normalizeLegacySocialPostProof, normalizeSocialPostProof } from '../src/socialproof.js';

const raw = process.env.SOCIAL_RECEIPT_TEST_DATABASE_URL;
assert(raw, 'Set SOCIAL_RECEIPT_TEST_DATABASE_URL to an explicit disposable PostgreSQL database');
const endpoint = new URL(raw);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol));
assert(['127.0.0.1', 'localhost'].includes(endpoint.hostname));
assert(!endpoint.search && !endpoint.hash);
const local = endpoint.port === '35449' && endpoint.username === 'pilot_runner'
  && !endpoint.password && endpoint.pathname === '/postgres';
const ci = endpoint.port === '55442' && endpoint.username === 'postgres'
  && endpoint.password === 'pgcheck' && endpoint.pathname === '/social_receipt_test';
assert(local || ci, 'Refusing an unowned social-receipt PostgreSQL target');

const namespace = `social_receipt_${crypto.randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: endpoint.toString() });
await admin.query(`CREATE SCHEMA ${namespace}`);
const pool = new pg.Pool({ connectionString: endpoint.toString(), max: 6,
  options: `-c search_path=${namespace},pg_catalog -c statement_timeout=20000 -c lock_timeout=5000` });
const migrationClient = await pool.connect();
const receipt = id => `social-proof:x:${BigInt(id)}`;
const receiptCount = async id => Number((await pool.query(
  `SELECT count(*) n FROM account_daily_claims
    WHERE account_id=$1 AND day=0 AND scope='social-proof' AND claim_id='used'`, [receipt(id)])).rows[0].n);

try {
  const provenance = (await pool.query('SELECT current_schema() schema,current_user,version()')).rows[0];
  assert.equal(provenance.schema, namespace); assert.match(provenance.version, /^PostgreSQL (16|18\.4)\b/);
  await pool.query(`CREATE TABLE account_daily_claims (
      account_id TEXT NOT NULL, day INT NOT NULL, scope TEXT NOT NULL, claim_id TEXT NOT NULL,
      slot INT, claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY(account_id,day,scope,claim_id));
    CREATE TABLE economy_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE social_claims (
      account_id TEXT NOT NULL, day INT NOT NULL, task_id TEXT NOT NULL,
      posted_at TIMESTAMPTZ NOT NULL DEFAULT now(), paid BOOLEAN NOT NULL DEFAULT false,
      proof TEXT, legacy_proof_bridge BOOLEAN NOT NULL DEFAULT true,
      PRIMARY KEY(account_id,day,task_id));
    CREATE TABLE telemetry (
      id TEXT PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT now(), account_id TEXT,
      event TEXT NOT NULL, props TEXT NOT NULL DEFAULT '{}');`);

  assert.deepEqual(await installLegacySocialReceiptGuard(migrationClient),
    { compatibility: 'postgres', installed: true });
  assert.deepEqual(await installLegacySocialReceiptGuard(migrationClient),
    { compatibility: 'postgres', installed: true }, 'guard installation is idempotent');
  assert.deepEqual(await verifyLegacySocialReceiptGuard(migrationClient),
    { enabled: true, triggerType: 19, column: 'paid',
      functionName: 'omerta_legacy_social_receipt_guard' });
  await migrationClient.query('ALTER TABLE social_claims DISABLE TRIGGER social_claims_legacy_receipt_guard');
  await assert.rejects(verifyLegacySocialReceiptGuard(migrationClient),
    error => error.code === 'social_receipt_guard_invalid', 'a disabled financial trigger is refused');
  await installLegacySocialReceiptGuard(migrationClient);
  await migrationClient.query(`CREATE OR REPLACE FUNCTION omerta_legacy_social_receipt_guard()
    RETURNS trigger LANGUAGE plpgsql AS $guard$ BEGIN RETURN NEW; END $guard$`);
  await assert.rejects(verifyLegacySocialReceiptGuard(migrationClient),
    error => error.code === 'social_receipt_guard_invalid', 'a mutated trigger function is refused');
  await installLegacySocialReceiptGuard(migrationClient);

  // A predecessor binary knows neither the receipt nor the transaction capability. Every paid
  // transition is nevertheless receipted, including a row registered by the new binary (flag=false).
  const firstId = '00012345678950001';
  await pool.query(`INSERT INTO social_claims(account_id,day,task_id,paid,proof,legacy_proof_bridge)
    VALUES ('old-a',1,'sw_post',false,$1,false)`, [`https://x.com/a/status/${firstId}`]);
  assert.equal((await pool.query(
    "UPDATE social_claims SET paid=true WHERE account_id='old-a' AND day=1 AND task_id='sw_post' AND NOT paid"
  )).rowCount, 1);
  assert.equal(await receiptCount(firstId), 1, 'predecessor update and receipt commit atomically');

  await pool.query(`INSERT INTO social_claims(account_id,day,task_id,paid,proof)
    VALUES ('old-b',2,'sw_post',false,$1)`, ['https://twitter.com/b/statuses/12345678950001']);
  await assert.rejects(pool.query(
    "UPDATE social_claims SET paid=true WHERE account_id='old-b' AND day=2 AND task_id='sw_post' AND NOT paid"
  ), error => error.code === '23505', 'a predecessor duplicate loses before cash can commit');
  assert.equal((await pool.query("SELECT paid FROM social_claims WHERE account_id='old-b'")).rows[0].paid,
    false, 'duplicate transition rolls back');

  // Current code proves it reserved this exact receipt in this transaction. A different/missing
  // capability cannot bypass the trigger merely by setting legacy_proof_bridge=false.
  const currentId = '12345678950002', currentAccount = receipt(currentId);
  await pool.query(`INSERT INTO social_claims(account_id,day,task_id,paid,proof,legacy_proof_bridge)
    VALUES ('current-a',3,'sw_post',false,$1,false)`, [currentId]);
  const current = await pool.connect();
  try {
    await current.query('BEGIN');
    await current.query(`INSERT INTO account_daily_claims(account_id,day,scope,claim_id)
      VALUES ($1,0,'social-proof','used')`, [currentAccount]);
    await current.query("SELECT set_config('omerta.social_receipt_account',$1,true)", [currentAccount]);
    assert.equal((await current.query(
      "UPDATE social_claims SET paid=true,legacy_proof_bridge=false WHERE account_id='current-a' AND NOT paid"
    )).rowCount, 1);
    await current.query('COMMIT');
  } catch (error) { await current.query('ROLLBACK').catch(() => {}); throw error; }
  finally { current.release(); }
  assert.equal(await receiptCount(currentId), 1);

  // The deployed predecessor permitted a pending row with no stored proof and accepted the URL on
  // settlement. Current code persists that already-verified URL in the same paid UPDATE, so the
  // trigger sees the canonical proof and recognizes the transaction's exact receipt capability.
  const settlementId = '12345678950010', settlementAccount = receipt(settlementId);
  const settlementProof = `https://x.com/settlement/status/${settlementId}`;
  await pool.query(`INSERT INTO social_claims(account_id,day,task_id,paid,proof)
    VALUES ('current-null-proof',33,'sw_post',false,NULL)`);
  const settlement = await pool.connect();
  try {
    await settlement.query('BEGIN');
    await settlement.query(`INSERT INTO account_daily_claims(account_id,day,scope,claim_id)
      VALUES ($1,0,'social-proof','used')`, [settlementAccount]);
    await settlement.query("SELECT set_config('omerta.social_receipt_account',$1,true)", [settlementAccount]);
    assert.equal((await settlement.query(
      `UPDATE social_claims SET paid=true,proof=COALESCE(proof,$1),legacy_proof_bridge=false
        WHERE account_id='current-null-proof' AND NOT paid`, [settlementProof])).rowCount, 1);
    await settlement.query('COMMIT');
  } catch (error) { await settlement.query('ROLLBACK').catch(() => {}); throw error; }
  finally { settlement.release(); }
  assert.deepEqual((await pool.query(
    "SELECT paid,proof FROM social_claims WHERE account_id='current-null-proof'"
  )).rows[0], { paid: true, proof: settlementProof });
  assert.equal(await receiptCount(settlementId), 1,
    'proof-at-settlement and paid transition commit through the exact database guard');

  for (const [index, proof, id] of [
    [0, ' 12345678950007 ', '12345678950007'],
    [1, 'https://x.com/u/STATUS/00012345678950008', '12345678950008'],
  ]) {
    assert.equal(normalizeSocialPostProof(proof).id, id);
    const account = receipt(id), row = `current-parity-${index}`;
    await pool.query(`INSERT INTO social_claims(account_id,day,task_id,paid,proof,legacy_proof_bridge)
      VALUES ($1,$2,'sw_post',false,$3,false)`, [row, 30 + index, proof]);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO account_daily_claims(account_id,day,scope,claim_id)
        VALUES ($1,0,'social-proof','used')`, [account]);
      await client.query("SELECT set_config('omerta.social_receipt_account',$1,true)", [account]);
      assert.equal((await client.query(
        'UPDATE social_claims SET paid=true,legacy_proof_bridge=false WHERE account_id=$1 AND NOT paid',
      [row])).rowCount, 1, 'trigger canonicalization matches every current accepted proof shape');
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }
  const legacyParity = 'https://example.com/u/status/00012345678950009';
  assert.equal(normalizeSocialPostProof(legacyParity), null);
  assert.equal(normalizeLegacySocialPostProof(legacyParity).id, '12345678950009');
  await pool.query(`INSERT INTO social_claims(account_id,day,task_id,paid,proof)
    VALUES ('legacy-parity',32,'sw_post',false,$1)`, [legacyParity]);
  await pool.query("UPDATE social_claims SET paid=true WHERE account_id='legacy-parity' AND NOT paid");
  assert.equal(await receiptCount('12345678950009'), 1,
    'trigger canonicalization retains the predecessor-only proof shape');

  // Receipt and paid transition share rollback fate when a later payout step fails.
  const rollbackId = '12345678950003';
  await pool.query(`INSERT INTO social_claims(account_id,day,task_id,paid,proof)
    VALUES ('rollback-a',4,'sw_post',false,$1)`, [rollbackId]);
  const rollback = await pool.connect();
  try {
    await rollback.query('BEGIN');
    await rollback.query("UPDATE social_claims SET paid=true WHERE account_id='rollback-a' AND NOT paid");
    assert.equal(Number((await rollback.query(
      `SELECT count(*) n FROM account_daily_claims
        WHERE account_id=$1 AND day=0 AND scope='social-proof' AND claim_id='used'`,
      [receipt(rollbackId)])).rows[0].n), 1, 'own transaction sees trigger receipt');
    await rollback.query('ROLLBACK');
  } finally { rollback.release(); }
  assert.equal(await receiptCount(rollbackId), 0);
  assert.equal((await pool.query("SELECT paid FROM social_claims WHERE account_id='rollback-a'")).rows[0].paid,
    false);

  // Two predecessor processes racing aliases of one proof elect exactly one paid transition.
  const raceId = '12345678950004';
  await pool.query(`INSERT INTO social_claims(account_id,day,task_id,paid,proof) VALUES
    ('race-a',5,'sw_post',false,$1),('race-b',5,'sw_post',false,$2)`,
  [`https://x.com/a/status/${raceId}`, `https://twitter.com/b/statuses/${raceId}`]);
  const one = await pool.connect(), two = await pool.connect();
  try {
    await one.query('BEGIN'); await two.query('BEGIN');
    await one.query("UPDATE social_claims SET paid=true WHERE account_id='race-a' AND NOT paid");
    const losing = two.query("UPDATE social_claims SET paid=true WHERE account_id='race-b' AND NOT paid");
    await new Promise(resolve => setTimeout(resolve, 20));
    await one.query('COMMIT');
    await assert.rejects(losing, error => error.code === '23505');
    await two.query('ROLLBACK');
  } finally {
    await one.query('ROLLBACK').catch(() => {}); await two.query('ROLLBACK').catch(() => {});
    one.release(); two.release();
  }
  assert.equal(await receiptCount(raceId), 1);
  assert.equal(Number((await pool.query(
    "SELECT count(*) n FROM social_claims WHERE account_id LIKE 'race-%' AND paid")).rows[0].n), 1);

  // Model the real claim-vs-sweep window: receipt reserved, pending evidence deleted by the sweep,
  // conditional paid UPDATE loses, then caller rollback removes the otherwise orphan receipt.
  const lapsedId = '12345678950005', lapsedAccount = receipt(lapsedId);
  await pool.query(`INSERT INTO social_claims(account_id,day,task_id,paid,proof,legacy_proof_bridge)
    VALUES ('lapsed-a',6,'sw_post',false,$1,false)`, [lapsedId]);
  const claimant = await pool.connect(), sweeper = await pool.connect();
  try {
    await claimant.query('BEGIN');
    await claimant.query(`INSERT INTO account_daily_claims(account_id,day,scope,claim_id)
      VALUES ($1,0,'social-proof','used')`, [lapsedAccount]);
    await claimant.query("SELECT set_config('omerta.social_receipt_account',$1,true)", [lapsedAccount]);
    assert.equal((await sweeper.query(
      "DELETE FROM social_claims WHERE account_id='lapsed-a' AND day=6 AND task_id='sw_post'"
    )).rowCount, 1);
    assert.equal((await claimant.query(
      "UPDATE social_claims SET paid=true,legacy_proof_bridge=false WHERE account_id='lapsed-a' AND NOT paid"
    )).rowCount, 0);
    await claimant.query('ROLLBACK');
  } finally { claimant.release(); sweeper.release(); }
  assert.equal(await receiptCount(lapsedId), 0, 'lost pending transition leaves no receipt or payout authority');

  // Freeze the first cutoff, then commit unreceipted evidence behind it. Full completion must refresh
  // a DB-clock cutoff, run catch-up in the same lifecycle, and only then install final markers.
  await pool.query(`DELETE FROM economy_migrations WHERE id IN
    ('social-proof-receipts-2026-10-23','social-proof-receipt-retention-2026-10-27')
    OR id LIKE 'social-proof-receipt-retention-progress-2026-10-27%'`);
  let page = await migrateSocialProofReceipts(migrationClient, { batchSize: 1, maxBatches: 1, timestampText: true });
  assert.equal(page.complete, false);
  await new Promise(resolve => setTimeout(resolve, 20));
  const catchupId = '12345678950006';
  await pool.query(`INSERT INTO social_claims(account_id,day,task_id,paid,proof,legacy_proof_bridge)
    VALUES ('catchup-a',7,'sw_post',true,$1,false)`, [catchupId]);
  await pool.query(`INSERT INTO telemetry(id,account_id,event,props)
    VALUES ('catchup-after-cutoff','catchup-a','social_task',$1)`,
  [JSON.stringify({ task: 'sw_post', proof: catchupId })]);
  let calls = 1;
  while (!page.complete) {
    page = await migrateSocialProofReceipts(migrationClient, { batchSize: 1, maxBatches: 1, timestampText: true });
    calls++;
    const cursorCount = Number((await pool.query(
      "SELECT count(*) n FROM economy_migrations WHERE id LIKE 'social-proof-receipt-retention-progress-2026-10-27:cursor:%'"
    )).rows[0].n);
    assert(cursorCount <= 1, 'crash/resume retains at most one durable cursor');
    if (!page.complete) assert.equal((await pool.query(
      "SELECT 1 FROM economy_migrations WHERE id='social-proof-receipt-retention-2026-10-27'"
    )).rowCount, 0, 'marker stays absent through full and catch-up pages');
    assert(calls < 100, 'native pager makes forward progress');
  }
  assert.equal(page.applied, true); assert.equal(await receiptCount(catchupId), 1);

  // Even an explicit oversized request is capped to 100 committed pages. Progress survives the
  // refusal boundary and later bounded invocations finish it without stamping early.
  await pool.query(`DELETE FROM economy_migrations WHERE id IN
    ('social-proof-receipts-2026-10-23','social-proof-receipt-retention-2026-10-27')
    OR id LIKE 'social-proof-receipt-retention-progress-2026-10-27%'`);
  await pool.query(`INSERT INTO telemetry(id,at,event,props)
    SELECT 'cap-' || g, clock_timestamp() - interval '1 day', 'social_task',
           json_build_object('proof',(12345678960000 + g)::text)::text
      FROM generate_series(1,105) g`);
  const capped = await migrateSocialProofReceipts(migrationClient,
    { batchSize: 1, maxBatches: 1000, timestampText: true });
  assert.deepEqual([capped.batches, capped.complete], [100, false]);
  assert.equal((await pool.query(
    "SELECT 1 FROM economy_migrations WHERE id='social-proof-receipt-retention-2026-10-27'"
  )).rowCount, 0);
  let resumed = capped, resumes = 0;
  while (!resumed.complete) {
    resumed = await migrateSocialProofReceipts(migrationClient,
      { batchSize: 1, maxBatches: 100, timestampText: true });
    assert(++resumes < 5);
  }

  console.log('Native social receipt PASS: predecessor trigger, duplicate race, current capability, rollback, claim/sweep loss, same-lifecycle catch-up and 100-page boot bound');
} finally {
  migrationClient.release();
  await pool.end();
  await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
  await admin.end();
}
