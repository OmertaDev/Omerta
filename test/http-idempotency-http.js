// Full-server/native receipt recovery; no production or human qualification.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';

const controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(controlUrl, 'Explicit disposable loopback PostgreSQL URL required');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(controlUrl).hostname));
const schema = `http_idem_${crypto.randomBytes(12).toString('hex')}`;
const owner = `http-idempotency-native:${crypto.randomUUID()}`;
const control = new pg.Pool({ connectionString: controlUrl, max: 1 });
const databaseUrl = new URL(controlUrl); databaseUrl.searchParams.set('options', `-c search_path=${schema}`);
for (const key of Object.keys(process.env)) if (/^(CHAIN_|VOUCHER_|PRIVY_|X_OAUTH|INVARIANT_WEBHOOK|DISCORD_|REDIS_URL)/.test(key)) delete process.env[key];
Object.assign(process.env, { DATABASE_URL: databaseUrl.toString(), SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on' });
for (const key of ['JWT_SECRET', 'MOD_KEY', 'MARKET_SEED']) process.env[key] = crypto.randomBytes(32).toString('hex');
let app, originalQuery, controls = 0, created = false;
try {
  await control.query(`CREATE SCHEMA ${schema}`); created = true;
  await control.query(`COMMENT ON SCHEMA ${schema} IS '${owner}'`);
  const { buildServer } = await import('../src/server.js');
  app = await buildServer(); originalQuery = app.pool.query;
  async function actor() {
    const login = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: {} });
    assert.equal(login.statusCode, 200);
    const token = login.json().token, accountId = app.jwt.decode(token).sub;
    const headers = { authorization: `Bearer ${token}` };
    const character = await app.inject({ method: 'POST', url: '/v1/character', headers,
      payload: { name: `Native ${crypto.randomBytes(4).toString('hex')}` } });
    assert.equal(character.statusCode, 200);
    return { accountId, headers };
  }
  async function state(accountId) {
    return (await originalQuery.call(app.pool, `SELECT cash::text AS cash,
      (SELECT COUNT(*)::integer FROM transactions WHERE character_id=characters.id) AS ledger_count
      FROM characters WHERE account_id=$1 AND alive`, [accountId])).rows[0];
  }
  async function disconnect() {
    const client = await app.pool.connect(); client.on('error', () => {});
    try {
      await assert.rejects(client.query('SELECT pg_terminate_backend(pg_backend_pid())'), { code: '57P01' });
    } finally { client.release(true); }
  }
  for (const scenario of ['success-store-disconnect', 'failure-release-disconnect', 'insert-acknowledgement-loss']) {
    const { accountId, headers } = await actor(), key = crypto.randomUUID();
    let injected = false, selectInjected = false, receiptAttempts = 0;
    app.pool.query = async function(sql, args) {
      const text = String(sql);
      if (args?.[1] === key) {
        if (scenario === 'insert-acknowledgement-loss' && text.startsWith('INSERT INTO idempotency') && !injected) {
          injected = true; await originalQuery.call(this, sql, args);
          throw Object.assign(new Error('Injected lost INSERT acknowledgement'), { code: '08006' });
        }
        if (scenario === 'insert-acknowledgement-loss' && text.startsWith('SELECT status, body_hash, response') && !selectInjected) {
          selectInjected = true; throw Object.assign(new Error('Injected reconnect during ownership read'), { code: '57P01' });
        }
        const receipt = scenario === 'failure-release-disconnect' ? text.startsWith('DELETE FROM idempotency') : text.startsWith('UPDATE idempotency SET status');
        if (receipt) {
          receiptAttempts++;
          if (!injected) { injected = true; await disconnect(); throw Object.assign(new Error('Native receipt backend disconnected'), { code: '57P01' }); }
        }
      }
      return originalQuery.call(this, sql, args);
    };
    const request = { method: 'POST', url: scenario === 'failure-release-disconnect' ? '/v1/crimes/not-a-crime' : '/v1/checkin',
      headers: { ...headers, 'idempotency-key': key }, payload: {} };
    let first;
    try { first = await app.inject(request); } finally { app.pool.query = originalQuery; }
    assert(injected, scenario);
    if (scenario === 'failure-release-disconnect') {
      assert.equal(first.statusCode, 400); assert.equal(receiptAttempts, 2);
      assert.equal((await originalQuery.call(app.pool, 'SELECT COUNT(*)::integer AS n FROM idempotency WHERE account_id=$1 AND key=$2', [accountId, key])).rows[0].n, 0);
    } else {
      assert.equal(first.statusCode, 200, first.body);
      if (scenario === 'insert-acknowledgement-loss') assert(selectInjected); else assert.equal(receiptAttempts, 2);
      const beforeReplay = await state(accountId);
      const replay = await app.inject(request);
      assert.equal(replay.statusCode, 200); assert.equal(replay.headers['x-idempotent-replay'], 'true');
      assert.equal(replay.body, first.body); assert.deepEqual(await state(accountId), beforeReplay);
      assert.equal((await originalQuery.call(app.pool, 'SELECT status FROM idempotency WHERE account_id=$1 AND key=$2', [accountId, key])).rows[0].status, 200);
    }
    controls++;
  }
  console.log(JSON.stringify({ status: 'PASS', nativeServerControls: controls, scope: 'Native server HTTP reservation recovery only' }));
} finally {
  if (app) { if (originalQuery) app.pool.query = originalQuery; await app.close(); await app.pool.end(); }
  try {
    if (created) {
      const row = (await control.query("SELECT obj_description(oid,'pg_namespace') AS owner FROM pg_namespace WHERE nspname=$1", [schema])).rows[0];
      assert.equal(row?.owner, owner, 'Owned test schema identity changed; refusing cleanup');
      await control.query(`DROP SCHEMA ${schema} CASCADE`);
    }
  } finally { await control.end(); }
}
