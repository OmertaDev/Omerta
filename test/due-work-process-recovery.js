// Scoped native process recovery with nonempty loan-expiry work. The canonical
// offer is aged ONLY during fixture initialization, before the measured baseline.
// This is not a soak, all-queue, natural acquisition or production proof.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import net from 'node:net';
import pg from 'pg';
import { spawn, execFileSync } from 'node:child_process';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sweepLoans } from '../src/loans.js';

const controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(controlUrl, 'Explicit disposable loopback PostgreSQL required');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const lease = planOwnedWorldDatabase({ controlUrl, runId: 'due-work-process-recovery', sourceRevision: revision });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(work, label) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) { const value = await work(); if (value) return value; await sleep(50); }
  throw Error(`Timed out: ${label}`);
}
const socket = net.createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(CHAIN_|VOUCHER_|PRIVY_|X_OAUTH|INVARIANT_WEBHOOK|DISCORD_|REDIS_URL|DATABASE_URL)/.test(key)));
Object.assign(environment, { DATABASE_URL: lease.url, PORT: String(port), SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off',
  INVITE_MODE: 'off', POPULATION_OFF: 'on', PUBLIC_URL: `http://127.0.0.1:${port}`, LIQUIDITY_AUTOMATION_ENABLED: 'off' });
for (const key of ['JWT_SECRET', 'MOD_KEY', 'MARKET_SEED']) environment[key] = crypto.randomBytes(32).toString('hex');
const processes = new Set(); let pool, api, worker;
function launch(role) {
  const url = new URL(lease.url); url.searchParams.set('application_name', `due-proof-${role}`);
  const child = spawn(process.execPath, [`src/${role === 'api' ? 'server' : 'worker'}.js`],
    { env: { ...environment, DATABASE_URL: url.toString() }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  // Observe child output without printing private actor/request information.
  let errors = '', output = '';
  child.stdout.on('data', bytes => { output = (output + bytes).slice(-16384); });
  child.stderr.on('data', bytes => { errors = (errors + bytes).slice(-16384); });
  const exited = new Promise(resolve => { child.once('error', error => resolve({ error: error.code }));
    child.once('exit', (code, signal) => resolve({ code, signal })); });
  const owned = { process: child, exited, errors: () => errors, booted: () => output.includes('OMERTÀ worker up — hourly: buyback + season check; daily: §10.4 invariant sweep.') };
  processes.add(owned); return owned;
}
async function stop(child) {
  if (!child) return;
  if (child.process.exitCode === null && child.process.signalCode === null) child.process.kill('SIGKILL');
  await child.exited; processes.delete(child);
}
async function request(method, route, token, key, body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, { method, headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}), ...(key ? { 'idempotency-key': key } : {}),
    ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.text(), replay: response.headers.get('x-idempotent-replay') };
}
async function bootApi() {
  api = launch('api');
  await wait(async () => { try { return (await request('GET', '/health')).status === 200; } catch { return false; } }, 'owned API boot');
}
async function state(characterId, loanId) {
  return (await pool.query(`SELECT cash::text AS cash,
    (SELECT status FROM loans WHERE id=$2) AS loan_status,
    (SELECT COUNT(*)::integer FROM transactions WHERE character_id=$1 AND reason='loan:refund') AS refunds,
    (SELECT COALESCE(SUM(amount),0)::text FROM transactions WHERE character_id=$1 AND reason='loan:refund') AS refunded
    FROM characters WHERE id=$1`, [characterId, loanId])).rows[0];
}
const cases = [];
try {
  await lease.create(); pool = new pg.Pool({ connectionString: lease.url }); await bootApi();
  const version = (await pool.query('SHOW server_version')).rows[0].server_version;
  for (const mode of ['worker-interruption', 'database-disconnect', 'api-restart']) {
    const auth = await request('POST', '/v1/auth/guest', null, null, {}); assert.equal(auth.status, 200);
    const token = JSON.parse(auth.body).token;
    const created = await request('POST', '/v1/character', token, crypto.randomUUID(), { name: `Due ${crypto.randomBytes(4).toString('hex')}` }); assert.equal(created.status, 200);
    const view = JSON.parse((await request('GET', '/v1/me', token)).body).character;
    // Explicit initial liquidity fixture, not earned income or a game reward.
    await pool.query('UPDATE characters SET cash=10000 WHERE id=$1', [view.id]);
    const key = crypto.randomUUID(), body = { amount: 5000, rate: .1, hours: 24 };
    const offered = await request('POST', '/v1/loans', token, key, body); assert.equal(offered.status, 200);
    const loanId = JSON.parse(offered.body).id; assert(loanId);
    // Declared initial matured-work fixture. No deadline/status changes occur
    // after this statement or during fault/recovery measurement.
    await pool.query("UPDATE loans SET offered_at=now()-interval '49 hours' WHERE id=$1 AND status='open'", [loanId]);
    // Test-only native barrier at the canonical refund ledger insert. It blocks
    // after the cash update but before commit, without blocking startup DDL.
    await pool.query(`CREATE OR REPLACE FUNCTION due_refund_barrier() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.reason='loan:refund' THEN PERFORM pg_advisory_xact_lock(223344556); END IF; RETURN NEW; END $$`);
    await pool.query('DROP TRIGGER IF EXISTS due_refund_barrier ON transactions');
    await pool.query('CREATE TRIGGER due_refund_barrier BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION due_refund_barrier()');
    const before = await state(view.id, loanId); assert.equal(before.loan_status, 'open'); assert.equal(before.refunds, 0);
    assert.equal((await pool.query("SELECT COUNT(*)::integer AS n FROM loans WHERE id=$1 AND status='open' AND offered_at<now()-interval '48 hours'", [loanId])).rows[0].n, 1);
    const started = Date.now();
    if (mode === 'api-restart') { await stop(api); await bootApi(); }
    const holder = await pool.connect();
    const holderPid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await holder.query('SELECT pg_advisory_lock(223344556)');
    try {
      worker = launch('worker');
      const blocked = await wait(async () => {
        assert.equal(worker.process.exitCode, null, `Owned worker exited during setup: ${worker.errors()}`);
        return (await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND application_name='due-proof-worker' AND wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid)) AND query LIKE '%INSERT INTO transactions%' LIMIT 1",
          [holderPid])).rows[0];
      }, 'original loan worker paused at canonical refund receipt');
      if (mode === 'database-disconnect') assert.equal((await pool.query('SELECT pg_terminate_backend($1) AS terminated', [blocked.pid])).rows[0].terminated, true);
      await stop(worker); worker = null;
      assert.deepEqual(await state(view.id, loanId), before, 'Interrupted canonical transaction must preserve escrow');
    } finally { await holder.query('SELECT pg_advisory_unlock(223344556)'); holder.release(); }
    worker = launch('worker');
    // Preserve observer quiescence while original startup DDL holds cross-table
    // locks. A state reader must not create its own migration/read deadlock.
    await wait(() => { assert.equal(worker.process.exitCode, null, 'Resumed worker boot failed'); return worker.booted(); }, 'original resumed worker boot marker');
    await wait(async () => (await state(view.id, loanId)).loan_status === 'cancelled', 'original resumed worker refund');
    await stop(worker); worker = null;
    const recovered = await state(view.id, loanId);
    assert.equal(recovered.refunds, 1); assert.equal(Number(recovered.refunded), 5000); assert.equal(Number(recovered.cash), Number(before.cash) + 5000);
    assert(Date.now() - started <= 2 * 3600000, 'Recovery exceeds two original hourly periods');
    const replay = await request('POST', '/v1/loans', token, key, body); assert.equal(replay.status, 200); assert.equal(replay.replay, 'true'); assert.equal(replay.body, offered.body);
    await sweepLoans(pool);
    assert.deepEqual(await state(view.id, loanId), recovered, 'Repeat canonical sweep and HTTP replay must not refund twice');
    cases.push({ mode, dueBefore: 1, refundedOnce: true, acknowledgedOfferReplay: true, originalPeriodMs: 3600000, elapsedMs: Date.now() - started });
  }
  console.log(JSON.stringify({ status: 'PASS_SCOPED', source: revision, databaseVersion: version, cases,
    fixture: 'Initial character cash10000 liquidity fixture, canonical HTTP offers, initial offered_at aging and native refund-insert barrier before baseline; no post-baseline state/deadline rewrites',
    scope: 'One nonempty cash escrow expiry queue through original API/worker process interruption and native backend disconnect; not all queues, full resources or soak qualification' }));
} finally {
  await Promise.all([...processes].map(stop)); await pool?.end(); await lease.close();
}
