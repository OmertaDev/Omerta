// Real route regressions; --postgres additionally proves row locking and rollback.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const postgres = process.argv.includes('--postgres');
if (postgres) {
  const endpoint = new URL(process.env.COOLDOWN_TEST_DATABASE_URL || 'about:blank');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
    && endpoint.pathname.startsWith('/omerta_cooldown_'), 'Use an isolated loopback omerta_cooldown_* database');
  process.env.DATABASE_URL = endpoint.href;
  // Synthetic operator settings satisfy boot guards only in this isolated local DB.
  Object.assign(process.env, {
    LEGAL_OPERATOR_NAME: 'Cooldown test operator', LEGAL_POSTAL_ADDRESS: '1 Fixture Street',
    PRIVACY_CONTACT_EMAIL: 'privacy@example.test', DMCA_AGENT_NAME: 'Fixture agent',
    DMCA_AGENT_EMAIL: 'copyright@example.test', DMCA_AGENT_ADDRESS: '1 Fixture Street',
    DMCA_AGENT_PHONE: '+1 202 555 0100', DMCA_AGENT_REGISTERED: 'true',
    PAYMENT_REFUND_POLICY: 'Isolated test fixture; no payments.',
    MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex'),
    SOCIAL_VERIFY_MODE: 'off',
  });
} else delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT = 'off';
if (!postgres) process.env.CLUE_DROP_P = '0';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const { buildServer } = await import('./server-fixture.js');
const { PACING, coolLeft } = await import('../src/rules.js');
const { withCharacter, doCrime } = await import('../src/game.js');
const { consumeStreetActionCooldown } = await import('../src/actioncooldown.js');
const { columnMigrations } = await import('../src/db.js');
const { readFileSync } = await import('node:fs');
const migration = columnMigrations(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
assert(migration.some((s) => s.includes('characters ADD COLUMN IF NOT EXISTS street_action_at TIMESTAMPTZ')));
assert(migration.some((s) => s.includes('characters ADD COLUMN IF NOT EXISTS crew_sale_credit_ms BIGINT NOT NULL DEFAULT 0')));
const app = await buildServer();
const pool = app.pool;
if (postgres) {
  const migrationClient = await pool.connect();
  try {
    await migrationClient.query('CREATE TEMP TABLE cooldown_migration_probe (id TEXT PRIMARY KEY)');
    await migrationClient.query("INSERT INTO cooldown_migration_probe (id) VALUES ('existing-player')");
    const additions = migration.filter((s) => /^ALTER TABLE characters /.test(s)
      && /ADD COLUMN IF NOT EXISTS (street_action_at|crew_sale_credit_ms) /.test(s));
    assert.equal(additions.length, 2);
    for (let replay = 0; replay < 2; replay++)
      for (const sql of additions)
        await migrationClient.query(sql.replace('ALTER TABLE characters ', 'ALTER TABLE cooldown_migration_probe '));
    const upgraded = (await migrationClient.query('SELECT * FROM cooldown_migration_probe')).rows[0];
    assert.equal(upgraded.street_action_at, null);
    assert.equal(Number(upgraded.crew_sale_credit_ms), 0, 'existing players receive zero fractional work on migration');
  } finally {
    await migrationClient.query('DROP TABLE IF EXISTS cooldown_migration_probe');
    migrationClient.release();
  }
}
const call = async (method, url, token, payload, key = crypto.randomUUID()) => {
  const res = await app.inject({ method, url, payload,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'idempotency-key': key } });
  return { code: res.statusCode, body: res.json() };
};
const create = async (name) => {
  const token = (await call('POST', '/v1/auth/guest')).body.token;
  const minted = await call('POST', '/v1/character', token, { name });
  assert.equal(minted.code, 200, JSON.stringify(minted.body));
  const ch = (await call('GET', '/v1/me', token)).body.character;
  return { token, id: ch.id, accountId: (await pool.query('SELECT account_id FROM characters WHERE id=$1', [ch.id])).rows[0].account_id };
};
const row = async (p) => (await pool.query('SELECT * FROM characters WHERE id=$1', [p.id])).rows[0];
const reset = async (p) => pool.query(
  'UPDATE characters SET street_action_at=NULL,jail_until=NULL,nerve=100,energy=100,cunning=200,speed=200,heat=0,last_accrued_at=$2 WHERE id=$1',
  [p.id, new Date()]);
const snapshot = async (p) => {
  const r = await row(p);
  return { cash: Number(r.cash), respect: Number(r.respect),
    ledger: Number((await pool.query('SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1', [p.id])).rows[0].n),
    stash: (await pool.query('SELECT drug_id,qty FROM stash WHERE character_id=$1 ORDER BY drug_id', [p.id])).rows };
};
const originalRandom = Math.random;
try {
  const p = await create(`Cooldown ${crypto.randomUUID().slice(0, 8)}`);
  assert.equal((await call('GET', '/v1/rules', p.token)).body.pacing.streetActionCooldownSeconds, 30);
  await reset(p);
  assert.equal((await call('POST', '/v1/crimes/unknown', p.token)).body.error, 'bad_crime');
  await pool.query('UPDATE characters SET nerve=0 WHERE id=$1', [p.id]);
  assert.equal((await call('POST', '/v1/crimes/stereo', p.token)).body.error, 'nerve');
  assert.equal((await row(p)).street_action_at, null, 'invalid actions reserve no time');
  await reset(p);
  Math.random = () => 0.2;
  const key = crypto.randomUUID();
  const first = await call('POST', '/v1/crimes/stereo', p.token, { approach: 'standard' }, key);
  assert.equal(first.code, 200, JSON.stringify(first.body));
  assert.equal(first.body.success, true);
  assert.equal(first.body.cooldownMs, PACING.STREET_ACTION_CD_MS);
  assert(first.body.character.streetActionSeconds > 0);
  const beforeSpam = await snapshot(p);
  const replay = await call('POST', '/v1/crimes/stereo', p.token, { approach: 'standard' }, key);
  assert.equal(replay.code, 200, 'an idempotent replay returns the committed receipt');
  assert.deepEqual(await snapshot(p), beforeSpam, 'replay grants no second payout');
  await pool.query('INSERT INTO stash (character_id,drug_id,qty,quality) VALUES ($1,$2,100,1)', [p.id, 'vim']);
  const beforeAlternation = await snapshot(p);
  for (const [url, body] of [
    ['/v1/crimes/stereo', { approach: 'quiet' }],
    ['/v1/crimes/stereo', { approach: 'loud' }],
    ['/v1/kitchen/deal', { drugId: 'vim', qty: 10, play: 'flood' }],
  ]) {
    const blocked = await call('POST', url, p.token, body);
    assert.equal(blocked.code, 400, JSON.stringify(blocked.body));
    assert.equal(blocked.body.error, 'cooldown');
    assert(blocked.body.cooldownSeconds > 0 && blocked.body.cooldownSeconds <= 30);
  }
  assert.deepEqual(await snapshot(p), beforeAlternation, 'changing action or approach cannot farm value');
  assert((await call('GET', '/v1/me', p.token)).body.character.streetActionSeconds > 0, 'reload retains the clock');
  // Exact millisecond boundary, without waiting or weakening production rules.
  const boundary = new Date((await row(p)).street_action_at).getTime();
  const originalNow = Date.now;
  try {
    Date.now = () => boundary - 1;
    await assert.rejects(consumeStreetActionCooldown(await row(p), pool), (e) => e.code === 'cooldown' && e.data.cooldownSeconds === 1);
    Date.now = () => boundary;
    await consumeStreetActionCooldown(await row(p), pool);
  } finally { Date.now = originalNow; }
  assert.equal(coolLeft(boundary, boundary), 0);
  await reset(p);
  const sold = await call('POST', '/v1/kitchen/deal', p.token, { drugId: 'vim', qty: 10 });
  assert.equal(sold.code, 200, JSON.stringify(sold.body));
  assert.equal((await call('POST', '/v1/crimes/stereo', p.token)).body.error, 'cooldown', 'deal also gates crime');
  await reset(p);
  Math.random = () => 0.999;
  const failure = await call('POST', '/v1/crimes/stereo', p.token);
  assert.equal(failure.code, 200);
  assert.equal(failure.body.success, false);
  await pool.query('UPDATE characters SET jail_until=NULL WHERE id=$1', [p.id]);
  assert.equal((await call('POST', '/v1/crimes/stereo', p.token)).body.error, 'cooldown', 'failed attempts and released jail retain rest');

  Math.random = () => 0.2;
  await reset(p);
  const beforeRace = await snapshot(p);
  const burst = await Promise.all(Array.from({ length: 8 }, () => call('POST', '/v1/crimes/stereo', p.token)));
  assert.equal(burst.filter((r) => r.code === 200).length, 1, 'only one independent request earns a reward');
  assert(burst.every((r) => r.code === 200 || r.body.error === 'cooldown'), JSON.stringify(burst));
  assert.equal(Number((await row(p)).respect), beforeRace.respect + burst.find((r) => r.code === 200).body.rep);
  if (postgres) {
    await reset(p);
    const beforeRollback = await snapshot(p);
    await assert.rejects(withCharacter(pool, p.accountId, async (ch, client, h) => {
      await doCrime(ch, 'stereo', client, h);
      throw new Error('forced rollback');
    }), /forced rollback/);
    assert.equal((await row(p)).street_action_at, null, 'rolled-back action releases its clock');
    assert.deepEqual(await snapshot(p), beforeRollback, 'rollback preserves cash, inventory, respect and ledger');
    assert.equal((await call('POST', '/v1/crimes/stereo', p.token)).code, 200);
  }
  const final = await row(p);
  const book = (await pool.query(
    "SELECT COALESCE(SUM(amount),0) AS cash FROM transactions WHERE character_id=$1 AND currency='cash'", [p.id])).rows[0];
  assert(Math.abs(Number(final.cash) + Number(final.bank) - 500 - Number(book.cash)) < 0.01,
    'cash from accepted actions reconciles exactly with the ledger');
  console.log(`Action cooldowns OK (${postgres ? 'PostgreSQL: concurrency + rollback' : 'pg-mem: PostgreSQL locking unverified'})`);
} finally {
  Math.random = originalRandom;
  await app.close();
}
