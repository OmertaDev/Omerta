// Deterministic real-route compositions. Native mode owns a temporary schema and
// additionally checks row-lock races, rollback, and receipts after a server restart.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const native = process.argv.includes('--postgres');
const endpoint = native ? new URL(process.env.ECONOMY_COMPOSITION_TEST_DATABASE_URL
  || process.env.COORDINATION_TEST_DATABASE_URL || 'about:blank') : null;
if (native) {
  assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname),
    'Composition tests require an explicit disposable loopback PostgreSQL URL');
  assert(/test|omerta_cooldown/.test(endpoint.pathname), 'Use an explicitly named test database');
}
for (const key of Object.keys(process.env))
  if (/^(CHAIN_|VOUCHER_|PRIVY_|X_OAUTH|INVARIANT_WEBHOOK|DISCORD_|REDIS_URL)/.test(key)) delete process.env[key];
Object.assign(process.env, {
  NODE_ENV: 'test', RATE_LIMIT: 'off', INVITE_MODE: 'off', SOCIAL_VERIFY_MODE: 'off',
  POPULATION_OFF: 'on',
  LEGAL_OPERATOR_NAME: 'Economy composition fixture', LEGAL_POSTAL_ADDRESS: '1 Fixture Street',
  PRIVACY_CONTACT_EMAIL: 'privacy@example.test', DMCA_AGENT_NAME: 'Fixture agent',
  DMCA_AGENT_EMAIL: 'copyright@example.test', DMCA_AGENT_ADDRESS: '1 Fixture Street',
  DMCA_AGENT_PHONE: '+1 202 555 0100', DMCA_AGENT_REGISTERED: 'true',
  PAYMENT_REFUND_POLICY: 'Isolated economy fixtures; no payments.',
});
delete process.env.SEASON_MOD;
delete process.env.CLUE_DROP_P;
for (const key of ['JWT_SECRET', 'MOD_KEY', 'MARKET_SEED']) process.env[key] = crypto.randomBytes(32).toString('hex');

const RealDate = Date;
let wall = RealDate.parse('2026-10-31T23:45:00Z');
// Both Date.now() and new Date() must observe the same boundary. Patching only
// Date.now() would advance daily rights while leaving accrual at the real clock.
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [wall])); }
  static now() { return wall; }
};
const start = wall, hour = 3_600_000, day = 86_400_000;
const schema = `economy_composition_${crypto.randomBytes(12).toString('hex')}`;
const owner = `economy-composition:${crypto.randomUUID()}`;
let control, created = false, app, pool, version = 'pg-mem', checks = 0, failure;
let buildServer, G, dayOf;
const seedRandom = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const request = (method, url, player, body, key = crypto.randomUUID()) => ({ method, url, payload: body,
  headers: { ...(player ? { authorization: `Bearer ${player.token}` } : {}), 'idempotency-key': key } });
const call = async (...args) => {
  const res = await app.inject(request(...args));
  return { code: res.statusCode, body: res.json(), raw: res.body, replay: res.headers['x-idempotent-replay'] };
};
async function create(label) {
  const auth = await call('POST', '/v1/auth/guest', null, {});
  assert.equal(auth.code, 200, auth.raw);
  const player = { token: auth.body.token, accountId: app.jwt.decode(auth.body.token).sub };
  const minted = await call('POST', '/v1/character', player, { name: `${label} ${crypto.randomBytes(3).toString('hex')}` });
  assert.equal(minted.code, 200, minted.raw); player.id = minted.body.id;
  return player;
}
const state = async (player) => (await pool.query(
  'SELECT id,cash,bank,bank_credit_ms,racket_credit_ms,street_action_at FROM characters WHERE account_id=$1 AND alive',
  [player.accountId])).rows[0];
const cashBook = async (id) => Number((await pool.query(
  "SELECT COALESCE(SUM(amount),0) AS n FROM transactions WHERE character_id=$1 AND currency='cash'", [id])).rows[0].n);
const rewards = async (player) => (await pool.query(
  `SELECT t.reason,t.amount FROM transactions t JOIN characters c ON c.id=t.character_id
   WHERE c.account_id=$1 AND t.reason='checkin' ORDER BY t.at,t.id`, [player.accountId])).rows;
const latchCount = async (player) => Number((await pool.query(
  "SELECT COUNT(*) AS n FROM account_daily_claims WHERE account_id=$1 AND scope='checkin'", [player.accountId])).rows[0].n);
async function accepted(...args) {
  const prior = native && args[1] === '/v1/checkin'
    ? new Set((await pool.query("SELECT id FROM transactions WHERE character_id=$1 AND reason='checkin'", [args[2].id])).rows.map(row => row.id))
    : null;
  const response = await call(...args); assert.equal(response.code, 200, response.raw);
  // Native NOW() belongs to the database host, while this isolated suite moves
  // the application through UTC boundaries. Stamp the just-created fixture
  // ledger row to that same simulated clock before any boot-time history bridge
  // reads it. No amount, account right, or response is changed.
  if (prior && response.replay !== 'true') {
    const inserted = (await pool.query("SELECT id FROM transactions WHERE character_id=$1 AND reason='checkin'", [args[2].id])).rows
      .filter(row => !prior.has(row.id));
    assert.equal(inserted.length, 1);
    await pool.query('UPDATE transactions SET at=$2 WHERE id=$1', [inserted[0].id, new Date()]);
  }
  return response;
}
async function kill(player) {
  const before = await state(player);
  const response = await app.inject({ method: 'POST', url: '/v1/mod/kill',
    headers: { 'x-mod-key': process.env.MOD_KEY }, payload: { characterId: before.id, reason: 'economy-composition' } });
  assert.equal(response.statusCode, 200, response.body);
  player.id = response.json().heirId; assert.notEqual(player.id, before.id);
}
async function restartProbe(probe) {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./economy-composition-restart.js', import.meta.url))],
    { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  const timeout = setTimeout(() => child.kill(), 90_000); timeout.unref();
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.stdin.end(JSON.stringify({ ...probe, wall }));
  try {
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject); child.once('close', resolve);
    });
    assert.equal(exitCode, 0, `${stdout}\n${stderr}`);
    const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
    assert.equal(result.status, 'PASS'); assert.notEqual(result.pid, process.pid);
    assert.equal(result.mode, probe.mode);
  } finally { clearTimeout(timeout); }
}

try {
  if (native) {
    const { default: pg } = await import('pg');
    control = new pg.Pool({ connectionString: endpoint.href, max: 1 });
    await control.query(`CREATE SCHEMA ${schema}`); created = true;
    await control.query(`COMMENT ON SCHEMA ${schema} IS '${owner}'`);
    const scoped = new URL(endpoint); scoped.searchParams.set('options', `-c search_path=${schema}`);
    process.env.DATABASE_URL = scoped.href;
    version = String((await control.query('SHOW server_version')).rows[0].server_version);
  } else delete process.env.DATABASE_URL;
  ({ buildServer } = await import('./server-fixture.js'));
  G = await import('../src/game.js');
  ({ dayOf } = await import('../src/rules.js'));
  app = await buildServer(); pool = app.pool;

  // Same economically meaningful events at the same times; only one account
  // adds frequent reads, refused actions, and exact-key retries between them.
  // The quiet account is a separate execution, not a restatement of accrue().
  for (const seed of [0x35f01, 0x90ab2, 0x731cd]) {
    wall = start;
    const random = seedRandom(seed), quiet = await create('Quiet'), noisy = await create('Noisy');
    for (const player of [quiet, noisy]) {
      await pool.query(`UPDATE characters SET cash=50000000,bank=$2,respect=10000,crew=0,heat=0,
        bank_credit_ms=0,racket_credit_ms=0,last_accrued_at=$3 WHERE id=$1`,
      [player.id, seed === 0x35f01 ? 9_990_000 : seed === 0x90ab2 ? 1_000_000 : 30_000_000, new Date()]);
      await accepted('POST', '/v1/rackets/laundro/buy', player, {});
    }
    const initial = new Map();
    for (const player of [quiet, noisy]) {
      const row = await state(player); initial.set(player.id, { total: Number(row.cash) + Number(row.bank), book: await cashBook(player.id) });
    }
    for (let step = 0; step < 12; step++) {
      const at = wall, interval = (8 + Math.floor(random() * 28)) * 60_000;
      for (let touch = 1; touch <= 3; touch++) {
        wall = at + Math.floor(interval * touch / 4 / 1000) * 1000;
        // Invalid actions still settle elapsed income, while exact replays must
        // return the old receipt without executing a second bank transfer.
        const refused = await call('POST', '/v1/rackets/no-such-racket/upgrade', noisy, {});
        assert.equal(refused.body.error, 'bad_racket', refused.raw);
        await accepted('GET', '/v1/me', noisy);
      }
      wall = at + interval;
      for (const player of [quiet, noisy]) {
        await accepted('GET', '/v1/me', player);
        const key = `transfer-${seed}-${step}`, direction = step % 2 ? 'withdraw' : 'deposit';
        const payload = { amount: 1000 + Math.floor(random() * 5000) };
        // A shared schedule uses the same amount for both players.
        if (player === quiet) quiet.nextPayload = payload;
        const used = quiet.nextPayload;
        const first = await accepted('POST', `/v1/bank/${direction}`, player, used, key);
        const after = await state(player), book = await cashBook(player.id);
        const replay = await accepted('POST', `/v1/bank/${direction}`, player, used, key);
        assert.equal(replay.replay, 'true'); assert.equal(replay.raw, first.raw);
        assert.deepEqual(await state(player), after); assert.equal(await cashBook(player.id), book);
        const collision = await call('POST', `/v1/bank/${direction}`, player, { amount: used.amount + 1 }, key);
        assert.equal(collision.code, 422); assert.equal(collision.body.error, 'idempotency_key_reuse');
        assert.deepEqual(await state(player), after);
        if (step === 3 || step === 7) await accepted('POST', '/v1/rackets/laundro/upgrade', player, {});
      }
      const q = await state(quiet), n = await state(noisy);
      assert.equal(Number(n.bank_credit_ms), Number(q.bank_credit_ms), `bank credit seed=${seed}, step=${step}`);
      assert.equal(Number(n.racket_credit_ms), Number(q.racket_credit_ms));
      assert(Math.abs(Number(n.bank) - Number(q.bank)) < 0.001, `bank spam bonus seed=${seed}, step=${step}`);
      assert(Number(n.cash) <= Number(q.cash) + 0.001, 'partitioned racket rounding cannot increase cash');
      for (const player of [quiet, noisy]) {
        const s = await state(player), baseline = initial.get(player.id);
        assert(Math.abs(Number(s.cash) + Number(s.bank) - baseline.total - (await cashBook(player.id) - baseline.book)) < 0.001,
          'combined accrual, bank transfer, and upgrade reconcile with an independent balance delta');
      }
      checks++;
    }
  }

  // Daily rights persist through old receipt replay, fresh keys, lineage, and a
  // UTC rollover. An account has exactly one paid check-in for each visited day.
  wall = start;
  const lineage = await create('Lifecycle'), oldKey = 'before-midnight-claim';
  const first = await accepted('POST', '/v1/checkin', lineage, {}, oldKey);
  const paid = [first.body.pay];
  for (const action of ['read', 'replay', 'kill', 'fresh', 'kill', 'read', 'fresh']) {
    if (action === 'kill') await kill(lineage);
    else if (action === 'read') await accepted('GET', '/v1/me', lineage);
    else if (action === 'replay') {
      const replay = await accepted('POST', '/v1/checkin', lineage, {}, oldKey);
      assert.equal(replay.raw, first.raw); assert.equal(replay.replay, 'true');
    } else assert.equal((await call('POST', '/v1/checkin', lineage, {})).body.error, 'done');
    assert.equal(await latchCount(lineage), 1); assert.equal((await rewards(lineage)).length, 1); checks++;
  }
  wall = (Math.floor(start / day) + 1) * day;
  const replayNextDay = await accepted('POST', '/v1/checkin', lineage, {}, oldKey);
  assert.equal(replayNextDay.raw, first.raw); assert.equal(await latchCount(lineage), 1,
    'yesterday receipt cannot consume or pay today right');
  const next = await accepted('POST', '/v1/checkin', lineage, {}, 'after-midnight-claim'); paid.push(next.body.pay);
  await kill(lineage);
  assert.equal((await call('POST', '/v1/checkin', lineage, {})).body.error, 'done');
  const account = (await pool.query('SELECT checkins_lifetime,checkin_day FROM account_persistent WHERE account_id=$1', [lineage.accountId])).rows[0];
  assert.equal(Number(account.checkins_lifetime), 2); assert.equal(Number(account.checkin_day), dayOf());
  assert.equal(await latchCount(lineage), 2); assert.equal((await rewards(lineage)).length, 2);
  assert.equal((await rewards(lineage)).reduce((sum, row) => sum + Number(row.amount), 0), paid.reduce((sum, value) => sum + value, 0));
  checks++;

  if (native) {
    const mixed = await create('Mixed Race');
    await pool.query('UPDATE characters SET cash=1000000,bank=1000000,respect=10000,last_accrued_at=$2 WHERE id=$1', [mixed.id, new Date()]);
    await accepted('POST', '/v1/rackets/laundro/buy', mixed, {});
    await pool.query('UPDATE characters SET bank_credit_ms=0,racket_credit_ms=0,last_accrued_at=$2 WHERE id=$1',
      [mixed.id, new Date(wall - hour)]);
    const beforeMixed = await state(mixed), mixedBook = await cashBook(mixed.id);
    const simultaneous = await Promise.all([
      call('GET', '/v1/me', mixed),
      call('POST', '/v1/bank/deposit', mixed, { amount: 1000 }, 'mixed-deposit'),
      call('POST', '/v1/bank/withdraw', mixed, { amount: 1000 }, 'mixed-withdraw'),
      call('POST', '/v1/rackets/laundro/upgrade', mixed, {}, 'mixed-upgrade'),
      accepted('POST', '/v1/checkin', mixed, {}, 'mixed-checkin'),
    ]);
    assert(simultaneous.every(result => result.code === 200), JSON.stringify(simultaneous));
    const afterMixed = await state(mixed);
    assert(Math.abs(Number(afterMixed.cash) + Number(afterMixed.bank) - Number(beforeMixed.cash) - Number(beforeMixed.bank)
      - (await cashBook(mixed.id) - mixedBook)) < 0.001, 'concurrent mixed actions conserve their combined ledger delta');
    for (const reason of ['bank:interest', 'racket:income'])
      assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1 AND reason=$2',
        [mixed.id, reason])).rows[0].n), 1, `${reason} settles once at the fixed mixed-race clock`);
    assert.equal((await rewards(mixed)).length, 1); assert.equal(await latchCount(mixed), 1); checks++;

    const racer = await create('Race');
    // Distinct keys race the shared account/day right at midnight. Physical
    // PostgreSQL locks and the unique receipt must choose exactly one payout.
    const burst = await Promise.all(Array.from({ length: 8 }, (_, i) => call('POST', '/v1/checkin', racer, {}, `race-${i}`)));
    assert.equal(burst.filter(r => r.code === 200).length, 1);
    assert(burst.every(r => r.code === 200 || r.body.error === 'done'), JSON.stringify(burst));
    await pool.query("UPDATE transactions SET at=$2 WHERE character_id=$1 AND reason='checkin'", [racer.id, new Date()]);
    assert.equal((await rewards(racer)).length, 1); assert.equal(await latchCount(racer), 1); checks++;

    const banked = await create('Rollback');
    await accepted('POST', '/v1/bank/deposit', banked, { amount: 100 });
    const before = await state(banked), book = await cashBook(banked.id);
    await assert.rejects(G.withCharacter(pool, banked.accountId, async (ch, client, h) => {
      await G.bank(ch, 'withdraw', 50, client, h);
      throw new Error('composition rollback after ledger');
    }), /composition rollback after ledger/);
    assert.deepEqual(await state(banked), before); assert.equal(await cashBook(banked.id), book); checks++;

    // A completed value transaction whose HTTP receipt acknowledgement is lost
    // must survive a new server/pool, exact replay, death, and a fresh-key retry.
    const recovered = await create('Recovery'), key = 'committed-receipt-loss';
    const originalQuery = pool.query;
    let injected = false, attempts = 0;
    pool.query = async function(sql, args) {
      if (String(sql).startsWith('UPDATE idempotency SET status') && args?.[1] === key) {
        attempts++;
        const result = await originalQuery.call(this, sql, args);
        if (!injected) { injected = true; throw Object.assign(new Error('lost committed receipt acknowledgement'), { code: '08006' }); }
        return result;
      }
      return originalQuery.call(this, sql, args);
    };
    let receipt;
    try { receipt = await accepted('POST', '/v1/checkin', recovered, {}, key); }
    finally { pool.query = originalQuery; }
    assert(injected); assert.equal(attempts, 2);
    await app.close(); await pool.end(); app = null; pool = null;
    await restartProbe({ mode: 'committed', token: recovered.token, key, receipt: receipt.raw });
    app = await buildServer(); pool = app.pool;
    const replay = await accepted('POST', '/v1/checkin', recovered, {}, key);
    assert.equal(replay.replay, 'true'); assert.equal(replay.raw, receipt.raw);
    await kill(recovered);
    assert.equal((await call('POST', '/v1/checkin', recovered, {})).body.error, 'done');
    assert.equal((await rewards(recovered)).length, 1); assert.equal(await latchCount(recovered), 1); checks++;

    // The harsher seam: value committed but every HTTP receipt write failed.
    // A restart cannot reinterpret the pending reservation as unpaid, nor can a
    // new transport key reopen the account/day right after succession.
    const uncertain = await create('Uncertain'), pendingKey = 'uncertain-committed-claim';
    const pendingQuery = pool.query, realError = console.error;
    let failedStores = 0, diagnostics = 0;
    pool.query = async function(sql, args) {
      if (String(sql).startsWith('UPDATE idempotency SET status') && args?.[1] === pendingKey) {
        failedStores++;
        throw Object.assign(new Error('injected persistent receipt outage'), { code: '08006' });
      }
      return pendingQuery.call(this, sql, args);
    };
    console.error = (...args) => {
      if (String(args[0]).startsWith('idempotency: store UPDATE failed')) diagnostics++;
      else realError(...args);
    };
    try { await accepted('POST', '/v1/checkin', uncertain, {}, pendingKey); }
    finally { pool.query = pendingQuery; console.error = realError; }
    assert.equal(failedStores, 3); assert.equal(diagnostics, 1, 'uncertain value must produce an operator diagnostic');
    assert.equal((await pool.query('SELECT status FROM idempotency WHERE account_id=$1 AND key=$2',
      [uncertain.accountId, pendingKey])).rows[0].status, 0);
    await app.close(); await pool.end(); app = null; pool = null;
    await restartProbe({ mode: 'pending', token: uncertain.token, key: pendingKey });
    app = await buildServer(); pool = app.pool;
    const pending = await call('POST', '/v1/checkin', uncertain, {}, pendingKey);
    assert.equal(pending.code, 409); assert.equal(pending.body.error, 'in_progress');
    await kill(uncertain);
    assert.equal((await call('POST', '/v1/checkin', uncertain, {})).body.error, 'done');
    assert.equal((await rewards(uncertain)).length, 1); assert.equal(await latchCount(uncertain), 1); checks++;
  }
  const falseAlarms = Number((await pool.query(
    "SELECT COUNT(*) AS n FROM telemetry WHERE event='economy_payout_bound'")).rows[0].n);
  assert.equal(falseAlarms, 0, 'legitimate mixed schedules must not trigger payout-bound alerts');
  console.log(JSON.stringify({ status: 'PASS', mode: native ? 'postgres' : 'pg-mem', version,
    seeds: ['0x35f01', '0x90ab2', '0x731cd'], composedIntervals: 36, checks,
    payoutBoundFalseAlarms: falseAlarms,
    coverage: native ? 'mixed earning routes, UTC/lineage, PostgreSQL races/rollback/server restart' : 'mixed earning routes and UTC/lineage; native locking/restart not claimed' }));
} catch (error) {
  failure = error;
  throw error;
} finally {
  try { if (app) { await app.close(); if (native) await pool.end(); } }
  finally {
    globalThis.Date = RealDate;
    if (control) {
      try {
        if (created) {
          const row = (await control.query("SELECT obj_description(oid,'pg_namespace') AS owner FROM pg_namespace WHERE nspname=$1", [schema])).rows[0];
          assert.equal(row?.owner, owner, 'Refusing cleanup: test schema ownership changed');
          try {
            // The production schema contains thousands of relations. A single
            // DROP SCHEMA needs locks for all of them at once and can exhaust a
            // stock CI Postgres; bounded autocommit batches retain the same
            // ownership proof without changing server settings.
            const tables = (await control.query('SELECT tablename FROM pg_tables WHERE schemaname=$1', [schema])).rows;
            for (let i = 0; i < tables.length; i += 16) {
              const names = tables.slice(i, i + 16).map(row => `${schema}."${row.tablename.replaceAll('"', '""')}"`);
              await control.query(`DROP TABLE IF EXISTS ${names.join(',')} CASCADE`);
            }
            await control.query(`DROP SCHEMA ${schema} CASCADE`);
          }
          catch (error) {
            if (!failure) throw error;
            console.error(`Cleanup could not remove owned test schema ${schema}: ${error.code || error.message}`);
          }
        }
      } finally { await control.end(); }
    }
  }
}
