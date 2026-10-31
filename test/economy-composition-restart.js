// Fresh-process probe for economy-composition.js; accepts only an owned
// disposable PostgreSQL schema and synthetic request details on stdin.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const endpoint = new URL(process.env.DATABASE_URL || 'about:blank');
assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname));
assert(/^economy_composition_[a-f0-9]{24}$/.test(
  /^-c search_path=(.+)$/.exec(endpoint.searchParams.get('options') || '')?.[1] || ''),
'Only an owned composition-test schema may be reopened');
let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
  assert(input.length < 262144, 'Bounded synthetic restart probe input');
}
const probe = JSON.parse(input), RealDate = Date;
assert(Number.isSafeInteger(probe.wall));
assert(['committed', 'pending'].includes(probe.mode));
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [probe.wall])); }
  static now() { return probe.wall; }
};
let app;
try {
  const { buildServer } = await import('./server-fixture.js');
  app = await buildServer();
  const accountId = app.jwt.decode(probe.token).sub;
  const snapshot = async () => {
    const row = (await app.pool.query('SELECT cash,bank FROM characters WHERE account_id=$1 AND alive', [accountId])).rows[0];
    const paid = (await app.pool.query(`SELECT COUNT(*) AS n FROM transactions t
      JOIN characters c ON c.id=t.character_id WHERE c.account_id=$1 AND t.reason='checkin'`, [accountId])).rows[0];
    return { cash: String(row.cash), bank: String(row.bank), checkins: Number(paid.n) };
  };
  const before = await snapshot(); assert.equal(before.checkins, 1);
  const response = await app.inject({ method: 'POST', url: '/v1/checkin', payload: {},
    headers: { authorization: `Bearer ${probe.token}`, 'idempotency-key': probe.key } });
  if (probe.mode === 'committed') {
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers['x-idempotent-replay'], 'true');
    assert.equal(response.body, probe.receipt);
  } else {
    assert.equal(response.statusCode, 409, response.body);
    assert.equal(response.json().error, 'in_progress');
  }
  const fresh = await app.inject({ method: 'POST', url: '/v1/checkin', payload: {},
    headers: { authorization: `Bearer ${probe.token}`, 'idempotency-key': crypto.randomUUID() } });
  assert.equal(fresh.statusCode, 400, fresh.body); assert.equal(fresh.json().error, 'done');
  assert.deepEqual(await snapshot(), before, 'fresh process cannot pay the completed daily right again');
  console.log(JSON.stringify({ status: 'PASS', pid: process.pid, mode: probe.mode }));
} finally {
  globalThis.Date = RealDate;
  if (app) { await app.close(); await app.pool.end(); }
}
