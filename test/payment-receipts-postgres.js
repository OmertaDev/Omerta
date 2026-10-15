import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { migrateSchemaUnderLock } from '../src/db.js';
import { queuePaymentReceipt, sweepPaymentReceipts } from '../src/payment-receipts.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Set a disposable COORDINATION_TEST_DATABASE_URL');
const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(endpoint.hostname), 'Isolated loopback PostgreSQL required');
const suffix = crypto.randomBytes(8).toString('hex');
const schema = `receipt_test_${suffix}`, role = `receipt_client_${suffix}`;
const admin = new pg.Pool({ connectionString: endpoint.toString() });
await admin.query(`CREATE SCHEMA ${schema}`);
const pool = new pg.Pool({ connectionString: endpoint.toString(), options: `-c search_path=${schema}` });
const buyer = await pool.connect();
let roleCreated = false;
try {
  await buyer.query('SELECT pg_advisory_lock(918273645)');
  const migration = await migrateSchemaUnderLock(buyer);
  assert(migration.rls.verified && migration.rls.tables >= 366, 'entire final schema protected');
  const receiptPolicy = (await buyer.query(`SELECT c.relrowsecurity,
    EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='omerta_direct_access_denied') AS denied
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=current_schema() AND c.relname='payment_receipts'`)).rows[0];
  assert.deepEqual(receiptPolicy, { relrowsecurity: true, denied: true });
  await buyer.query('SELECT pg_advisory_unlock(918273645)');
  await buyer.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES ('buyer','test','buyer')");
  await buyer.query("INSERT INTO account_persistent(account_id,email,email_verified,digest_optin) VALUES ('buyer','buyer@example.test',true,false)");
  const sent = [];
  const send = async message => { sent.push(message); return true; };
  const purchase = { kind: 'made', amount: 120, durationSeconds: 30 * 86400 };
  await buyer.query('BEGIN');
  await queuePaymentReceipt(buyer, 'buyer', { ...purchase, receiptId: 'aborted' });
  assert.equal(await sweepPaymentReceipts(pool, { send }), 0, 'uncommitted receipt invisible to independent worker');
  await buyer.query('ROLLBACK');
  assert.equal((await pool.query('SELECT * FROM payment_receipts')).rows.length, 0, 'rollback removes receipt');
  assert.equal(sent.length, 0);
  await buyer.query('BEGIN');
  await queuePaymentReceipt(buyer, 'buyer', { ...purchase, receiptId: 'committed' });
  await queuePaymentReceipt(buyer, 'buyer', { ...purchase, receiptId: 'committed' });
  await buyer.query('COMMIT');
  const now = new Date(Date.now() + 1000);
  assert.equal(await sweepPaymentReceipts(pool, { send, now }), 1, 'committed receipt delivered despite marketing opt-out');
  assert.equal(sent[0].idempotencyKey, 'payment-receipt/committed');
  assert.equal(await sweepPaymentReceipts(pool, { send, now }), 0, 'sent receipt cannot replay');
  await queuePaymentReceipt(buyer, 'buyer', { ...purchase, receiptId: 'concurrent' });
  const before = sent.length;
  await Promise.all([sweepPaymentReceipts(pool, { send, now }), sweepPaymentReceipts(pool, { send, now })]);
  assert.equal(sent.length - before, 1, 'concurrent PostgreSQL workers claim once');
  await admin.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
  roleCreated = true;
  await buyer.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
  await buyer.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON payment_receipts TO ${role}`);
  await buyer.query(`SET ROLE ${role}`);
  assert.equal((await buyer.query('SELECT * FROM payment_receipts')).rows.length, 0, 'explicitly granted client cannot read recipient data');
  assert.equal((await buyer.query('UPDATE payment_receipts SET sent_at=now() RETURNING id')).rowCount, 0);
  await assert.rejects(buyer.query("INSERT INTO payment_receipts(id,account_id,email,kind,amount,duration_seconds) VALUES ('evil','buyer','attacker@example.test','made',1,1)"), { code: '42501' });
  await buyer.query('RESET ROLE');
  console.log(`payment-receipts-postgres: ${migration.rls.tables} tables protected; real commit/rollback isolation, digest opt-out independence, replay prevention, concurrent claim and direct-client RLS deny passed`);
} finally {
  await buyer.query('ROLLBACK').catch(() => {});
  await buyer.query('RESET ROLE').catch(() => {});
  await buyer.query('SELECT pg_advisory_unlock(918273645)').catch(() => {});
  buyer.release();
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  if (roleCreated) await admin.query(`DROP ROLE ${role}`);
  await admin.end();
}
