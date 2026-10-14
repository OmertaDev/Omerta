import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { queuePaymentReceipt, sweepPaymentReceipts } from '../src/payment-receipts.js';

// pg-mem does not implement transaction rollback. Its snapshot API models an
// aborted transaction for this isolated queue test; live callers use PostgreSQL.
const mem = newDb();
mem.public.none(`CREATE TABLE account_persistent (account_id TEXT PRIMARY KEY, email TEXT, email_verified BOOLEAN, digest_optin BOOLEAN);
CREATE TABLE payment_receipts (id TEXT PRIMARY KEY, account_id TEXT, email TEXT, kind TEXT, amount NUMERIC, duration_seconds INT,
  created_at TIMESTAMPTZ DEFAULT now(), next_attempt_at TIMESTAMPTZ DEFAULT now(), attempts INT DEFAULT 0,
  first_attempt_at TIMESTAMPTZ, abandoned_at TIMESTAMPTZ, claimed_until TIMESTAMPTZ, lease_id TEXT, sent_at TIMESTAMPTZ);`);
const { Pool } = mem.adapters.createPg();
const pool = new Pool();
await pool.query(`INSERT INTO account_persistent VALUES ('verified','buyer@example.test',true,false), ('unverified','unchecked@example.test',false,true), ('none',NULL,false,false)`);
const purchase = { kind: 'made', amount: 120, durationSeconds: 30 * 86400 };
const snapshot = mem.backup();
await queuePaymentReceipt(pool, 'verified', { ...purchase, receiptId: 'rolled-back' });
snapshot.restore();
const sent = [];
const send = async (message) => { sent.push(message); return true; };
assert.equal(await sweepPaymentReceipts(pool, { send }), 0, 'aborted purchase leaves no deliverable receipt');
assert.equal(sent.length, 0, 'queuing never sends before commit');
assert.equal(await queuePaymentReceipt(pool, 'unverified', purchase), null);
assert.equal(await queuePaymentReceipt(pool, 'none', purchase), null);
await queuePaymentReceipt(pool, 'verified', { ...purchase, receiptId: 'purchase-one' });
await queuePaymentReceipt(pool, 'verified', { ...purchase, receiptId: 'purchase-one' });
assert.equal((await pool.query('SELECT * FROM payment_receipts')).rows.length, 1, 'same receipt ID cannot enqueue twice');
const now = new Date(Date.now() + 1000);
assert.equal(await sweepPaymentReceipts(pool, { send: async () => { throw new Error('provider unavailable'); }, now }), 0);
let row = (await pool.query('SELECT * FROM payment_receipts')).rows[0];
assert.equal(row.sent_at, null);
assert.equal(row.attempts, 1);
assert.equal(await sweepPaymentReceipts(pool, { send, now }), 0, 'failure backs off before retry');
assert.equal(await sweepPaymentReceipts(pool, { send, now: new Date(now.getTime() + 180000) }), 1, 'delivery failure retries a committed receipt');
assert.equal(sent.length, 1, 'marketing opt-out does not suppress a transaction receipt');
assert.equal(sent[0].idempotencyKey, 'payment-receipt/purchase-one');
assert.match(sent[0].text, /does not automatically charge again/);
assert.equal(await sweepPaymentReceipts(pool, { send, now: new Date(now.getTime() + 360000) }), 0, 'sent receipt cannot replay');
await queuePaymentReceipt(pool, 'verified', { kind: 'watch', amount: 48, durationSeconds: 43200, receiptId: 'watch-one' });
await sweepPaymentReceipts(pool, { send, now: new Date(now.getTime() + 360000) });
assert.match(sent[1].text, /drop the watch/);
assert.match(sent[1].text, /every 12 hours/);
// A worker crashed after its lease: reclaiming it uses the same provider key.
await queuePaymentReceipt(pool, 'verified', { ...purchase, receiptId: 'interrupted' });
await pool.query('UPDATE payment_receipts SET claimed_until=$2, lease_id=$3 WHERE id=$1', ['interrupted', new Date(now.getTime() + 300000), 'old-worker']);
assert.equal(await sweepPaymentReceipts(pool, { send, now: new Date(now.getTime() + 100000) }), 0);
assert.equal(await sweepPaymentReceipts(pool, { send, now: new Date(now.getTime() + 400000) }), 1);
assert.equal(sent[2].idempotencyKey, 'payment-receipt/interrupted');
await queuePaymentReceipt(pool, 'verified', { ...purchase, receiptId: 'old-ambiguous' });
await pool.query('UPDATE payment_receipts SET first_attempt_at=$2 WHERE id=$1', ['old-ambiguous', new Date(now.getTime() - 24 * 3600000)]);
assert.equal(await sweepPaymentReceipts(pool, { send, now: new Date(now.getTime() + 500000) }), 0, 'automatic resend stops before provider idempotency expires');
assert((await pool.query('SELECT abandoned_at FROM payment_receipts WHERE id=$1', ['old-ambiguous'])).rows[0].abandoned_at);
await queuePaymentReceipt(pool, 'verified', { ...purchase, receiptId: 'concurrent' });
const beforeConcurrent = sent.length;
await Promise.all([
  sweepPaymentReceipts(pool, { send, now: new Date(now.getTime() + 600000) }),
  sweepPaymentReceipts(pool, { send, now: new Date(now.getTime() + 600000) }),
]);
assert.equal(sent.length - beforeConcurrent, 1, 'overlapping workers atomically claim a receipt once');
await pool.end();
console.log('payment-receipts: commit boundary, verified recipients, opt-out independence, retry, lease recovery and replay protection pass');
