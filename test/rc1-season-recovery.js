// Native interruption and retry proofs for the existing seasonal status award.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';

assert(process.argv.includes('--postgres'), 'Real PostgreSQL required');
const output = process.env.RC1_SEASON_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(output && controlUrl, 'Fresh restricted output and explicit local PostgreSQL required');
const source = await sourceIdentity();
const db = planOwnedWorldDatabase({ controlUrl, runId: 'season-recovery', sourceRevision: source.revision });
const proof = await createProofRecorder({ directory: output, source, configuration: {
  database: db.descriptor, initialization: 'One ordinary guest/character; no direct progression, balance or status grants',
  authority: 'Original recordReckoning and runSeasonRollover with the existing explicit season option; no persisted deadline/status rewrites',
  scope: 'Bounded seasonal boundary recovery, native transaction rollback, concurrent duplicate and lost commit response',
  excluded: ['Elapsed28-day lifetimes', 'All original worker intervals', 'Process termination', 'Full resource matrix', 'Deployment'] },
  runId: 'season-recovery', seed: 'none', scenarioId: 'season-crown-recovery', population: 1 });
let app, result;
try {
  await proof.record({ kind: 'database-created', ...await db.create() });
  Object.assign(process.env, { DATABASE_URL: db.url, RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on',
    SOCIAL_VERIFY_MODE: 'off', LIVING_WORLD_DIRECTOR: 'DIRECTOR_DISABLED', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
  const [{ buildServer }, { recordReckoning }, { runSeasonRollover }, { runLedgerInvariants }] = await Promise.all([
    import('../src/server.js'), import('../src/season.js'), import('../src/worker.js'), import('../src/invariants.js')]);
  app = await buildServer();
  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' }); assert.equal(guest.statusCode, 200);
  const born = await app.inject({ method: 'POST', url: '/v1/character',
    headers: { authorization: `Bearer ${guest.json().token}`, 'idempotency-key': 'season-recovery-birth' }, payload: { name: 'Season Recovery' } });
  assert.equal(born.statusCode, 200);
  const actor = (await app.pool.query('SELECT id,account_id,season FROM characters WHERE name=$1', ['Season Recovery'])).rows[0];
  let current = Number(actor.season) + 1, expectedCrowns = 0;
  const cases = [];
  const crowns = async () => Number((await app.pool.query('SELECT season_crowns FROM account_persistent WHERE account_id=$1', [actor.account_id])).rows[0].season_crowns);
  const record = async season => (await app.pool.query('SELECT * FROM season_records WHERE season=$1', [season])).rows[0] || null;
  const notices = async () => Number((await app.pool.query("SELECT COUNT(*) AS n FROM notifications WHERE character_id=$1 AND type='season_crown'", [actor.id])).rows[0].n);
  const snapshot = async label => {
    const value = await proof.snapshot(app.pool, label);
    assert.match(value.stateSha256, /^[a-f0-9]{64}$/); return value;
  };
  async function invariant(label) {
    const report = await runLedgerInvariants(app.pool, { alert: false }); assert(report.ok, JSON.stringify(report));
    await proof.record({ kind: 'canonical-invariants', label, checks: report.checks });
  }
  async function installFault(table, event, condition = '') {
    await app.pool.query("CREATE FUNCTION rc1_season_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected season fault' USING ERRCODE='RCS01'; END $$");
    await app.pool.query(`CREATE TRIGGER rc1_season_fault BEFORE ${event} ON ${table} FOR EACH ROW ${condition} EXECUTE FUNCTION rc1_season_fault()`);
    await proof.record({ kind: 'fault-installed', table, event, condition, sqlstate: 'RCS01' });
  }
  async function removeFault(table) {
    await app.pool.query(`DROP TRIGGER rc1_season_fault ON ${table}`);
    await app.pool.query('DROP FUNCTION rc1_season_fault()');
  }
  const rollover = () => proof.invoke('runSeasonRollover', { season: current }, () => runSeasonRollover(app.pool, { season: current }));
  const assertAward = async () => {
    assert.equal(await crowns(), expectedCrowns); assert.equal(await notices(), expectedCrowns);
    const saved = await record(current - 1); assert(saved.crowned); assert.equal(saved.champion_account, actor.account_id);
  };
  await invariant('baseline');
  // Failure before a durable record must not discard the old standings by advancing characters.
  await installFault('season_records', 'INSERT');
  const beforeInsert = await snapshot('record-insert-before');
  await assert.rejects(rollover, error => error.code === 'RCS01');
  const afterInsert = await snapshot('record-insert-after');
  assert.equal(afterInsert.stateSha256, beforeInsert.stateSha256);
  assert.equal(await record(current - 1), null);
  await removeFault('season_records');
  assert.equal((await rollover()).converted, 1); expectedCrowns++; await assertAward();
  cases.push('record insert rollback preserves original standings and retry');
  await invariant('record-insert-recovered');

  for (const [label, table, event, condition] of [
    ['crown', 'account_persistent', 'UPDATE OF season_crowns', ''],
    ['notification', 'notifications', 'INSERT', "WHEN (NEW.type = 'season_crown')"]]) {
    current++;
    await installFault(table, event, condition);
    const failed = await rollover(); assert.equal(failed.converted, 1);
    const pending = await record(current - 1); assert.equal(pending.crowned, false);
    assert.equal(await crowns(), expectedCrowns); assert.equal(await notices(), expectedCrowns);
    await snapshot(`${label}-rolled-back`); await invariant(`${label}-rolled-back`);
    await removeFault(table);
    // The character no longer has season<current. Recovery must follow the durable pending record.
    const recovered = await rollover(); assert.equal(recovered.converted, 0); assert(recovered.reckoning);
    expectedCrowns++; await assertAward();
    const after = await snapshot(`${label}-recovered`);
    assert.equal((await rollover()).reckoning, null);
    assert.equal((await snapshot(`${label}-exact-retry`)).stateSha256, after.stateSha256);
    await invariant(`${label}-recovered`); cases.push(`${label} rollback and worker retry after character conversion`);
  }
  current++;
  const concurrent = await proof.invoke('concurrent-recordReckoning', { season: current - 1, requests: 2 },
    () => Promise.all([recordReckoning(app.pool, current - 1), recordReckoning(app.pool, current - 1)]));
  assert.equal(concurrent.filter(Boolean).length, 1); expectedCrowns++; await assertAward();
  cases.push('two concurrent claims award once'); await invariant('concurrent');

  current++;
  let commitLost = false;
  const lostResponsePool = {
    query: app.pool.query.bind(app.pool),
    async connect() {
      const client = await app.pool.connect();
      return { release: () => client.release(), async query(sql, values) {
        const value = await client.query(sql, values);
        if (sql === 'COMMIT' && !commitLost) { commitLost = true; throw Object.assign(new Error('lost commit response'), { code: 'RCS02' }); }
        return value;
      } };
    }
  };
  await assert.rejects(() => proof.invoke('recordReckoning-lost-commit-response', { season: current - 1 },
    () => recordReckoning(lostResponsePool, current - 1)), error => error.code === 'RCS02');
  assert(commitLost); expectedCrowns++; await assertAward();
  const committed = await snapshot('lost-response-committed');
  assert.equal(await proof.invoke('recordReckoning-retry', { season: current - 1 }, () => recordReckoning(app.pool, current - 1)), null);
  assert.equal((await snapshot('lost-response-retry')).stateSha256, committed.stateSha256);
  await invariant('lost-response'); cases.push('lost native COMMIT response and exact retry');
  result = { status: 'PASS_SCOPED', cases, expectedCrowns, actualCrowns: await crowns(), crownNotifications: await notices(),
    invariantChecks: 55, postgres: (await app.pool.query('SELECT version() AS version')).rows[0].version, matrixQualifying: false };
} catch (error) {
  result = { status: 'FAIL', error: error.message, stack: error.stack }; process.exitCode = 1;
  await proof.record({ kind: 'first-failure', ...result }); if (app) await proof.snapshot(app.pool, 'failure');
} finally {
  if (app) { try { await app.close(); } finally { await app.pool.end(); } }
  try { await proof.record({ kind: 'database-cleanup', ...await db.close() }); }
  catch (error) { result.status = 'FAIL'; result.cleanupError = error.message; process.exitCode = 1; }
  const sealed = await proof.finish(result); await verifyArtifactIndex(output, sealed);
}
console.log(JSON.stringify(result));
