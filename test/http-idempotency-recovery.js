// Native reservation recovery controls; no gameplay or deployment qualification.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { finalizeHttpIdempotency } from '../src/http-idempotency.js';

const connectionString = process.env.COORDINATION_TEST_DATABASE_URL;
assert(connectionString, 'Explicit disposable loopback PostgreSQL URL required');
const url = new URL(connectionString);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Native controls require loopback PostgreSQL');
const schema = `http_idem_${crypto.randomBytes(12).toString('hex')}`;
const control = new pg.Pool({ connectionString, max: 1 });
const pool = new pg.Pool({ connectionString, max: 2, options: `-c search_path=${schema}` });
let created = false, controls = 0;
const transient = () => Object.assign(new Error('Injected connectivity interruption'), { code: '57P01' });
const success = { status: 200, response: JSON.stringify({ ok: true, receipt: 'native-control' }) };
const failure = { status: 503 };
const binding = () => ({ accountId: crypto.randomUUID(), key: crypto.randomUUID(), bodyHash: 'a'.repeat(64), reservationToken: crypto.randomUUID() });
async function reserve(value) {
  await pool.query('INSERT INTO idempotency(account_id,key,status,body_hash,response) VALUES($1,$2,0,$3,$4)',
    [value.accountId, value.key, value.bodyHash, value.reservationToken]);
}
async function row(value) {
  return (await pool.query('SELECT status,body_hash,response FROM idempotency WHERE account_id=$1 AND key=$2', [value.accountId, value.key])).rows[0];
}
try {
  await control.query(`CREATE SCHEMA ${schema}`); created = true;
  await pool.query('CREATE TABLE idempotency(account_id TEXT NOT NULL,key TEXT NOT NULL,status INTEGER NOT NULL,body_hash TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(account_id,key))');
  // A failure before the native write recovers, releases only its own row, and
  // permits a fresh owner to finalize the same transport identity.
  {
    const value = binding(); await reserve(value); let calls = 0;
    await finalizeHttpIdempotency({ query: async (...args) => {
      if (++calls === 1) throw transient(); return pool.query(...args);
    } }, value, failure);
    assert.equal(calls, 2); assert.equal(await row(value), undefined);
    const next = { ...value, reservationToken: crypto.randomUUID() }; await reserve(next);
    await finalizeHttpIdempotency(pool, next, success);
    assert.deepEqual(await row(value), { status: 200, body_hash: value.bodyHash, response: success.response }); controls++;
  }
  // DELETE committed but its acknowledgement was lost. Another owner reserves
  // precisely the same account/key/body before the old callback retries.
  {
    const value = binding(), next = { ...value, reservationToken: crypto.randomUUID() };
    await reserve(value); let calls = 0;
    const result = await finalizeHttpIdempotency({ query: async (...args) => {
      const result = await pool.query(...args);
      if (++calls === 1) { assert.equal(result.rowCount, 1); await reserve(next); throw transient(); }
      return result;
    } }, value, failure);
    assert.equal(calls, 2); assert.equal(result.rowCount, 0);
    assert.deepEqual(await row(value), { status: 0, body_hash: value.bodyHash, response: next.reservationToken }); controls++;
  }
  // An acknowledged-lost successful store is retried safely; finalized native
  // response bytes survive unchanged and the retry touches no row.
  {
    const value = binding(); await reserve(value); let calls = 0;
    const result = await finalizeHttpIdempotency({ query: async (...args) => {
      const result = await pool.query(...args); if (++calls === 1) throw transient(); return result;
    } }, value, success);
    assert.equal(calls, 2); assert.equal(result.rowCount, 0);
    assert.deepEqual(await row(value), { status: 200, body_hash: value.bodyHash, response: success.response }); controls++;
  }
  // An old success callback cannot finalize a same-body replacement owner.
  {
    const value = binding(), next = { ...value, reservationToken: crypto.randomUUID() }; await reserve(next);
    const result = await finalizeHttpIdempotency(pool, value, success);
    assert.equal(result.rowCount, 0);
    assert.deepEqual(await row(value), { status: 0, body_hash: value.bodyHash, response: next.reservationToken }); controls++;
  }
  // Persistent connectivity failure leaves the uncertainty latch intact.
  {
    const value = binding(); await reserve(value); let calls = 0;
    await assert.rejects(finalizeHttpIdempotency({ query: async () => { calls++; throw transient(); } }, value, success), { code: '57P01' });
    assert.equal(calls, 3);
    assert.deepEqual(await row(value), { status: 0, body_hash: value.bodyHash, response: value.reservationToken }); controls++;
  }
  // A SQL/programming error is not retried or hidden as an outage.
  {
    const value = binding(); await reserve(value); let calls = 0;
    await assert.rejects(finalizeHttpIdempotency({ query: async () => {
      calls++; throw Object.assign(new Error('Injected non-connectivity error'), { code: '23514' });
    } }, value, failure), { code: '23514' });
    assert.equal(calls, 1);
    assert.deepEqual(await row(value), { status: 0, body_hash: value.bodyHash, response: value.reservationToken }); controls++;
  }
  console.log(JSON.stringify({ status: 'PASS', nativeReservationControls: controls, scope: 'Native HTTP reservation storage/release only' }));
} finally {
  await pool.end();
  try { if (created) await control.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await control.end(); }
}
