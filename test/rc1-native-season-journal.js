import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { SEASON_JOURNAL_TABLES, SEASON_MS, readSeasonRows, snapshotSeasonState, reconcileSeason, seasonStateHash } from '../tools/rc1-season-journal.js';

assert(process.argv.includes('--postgres'), 'Real PostgreSQL required');
const argument = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = await sourceIdentity(), seed = argument('seed') || 'rc1-season-journal-alpha';
const runId = `season-journal-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(argument('output') || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
const db = planOwnedWorldDatabase({ controlUrl: process.env.RC1_RESOURCE_DATABASE_URL, runId, sourceRevision: source.revision });
for (const name of ['CHAIN_RPC_URL', 'INVARIANT_WEBHOOK_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL']) assert(!process.env[name]);
const boundarySeason = 740, epoch = boundarySeason * SEASON_MS - 3600000, hours = 673;
const configuration = { sourcePins: WORKER_SOURCE_PINS, epoch: new Date(epoch).toISOString(), hours,
  authority: 'Actual original worker seasonal callbacks, shared native application/PostgreSQL clock, original28-day boundaries',
  fixtures: ['Two default-cash/ammo characters, initial respect1000/360, kills2/1, listed duel ELO1100/1200',
    'Initial account prestige7/0 and season_sunk4/2; zero-resource Family with seasonal tribute12000 and wins3',
    'Initial seasons align to one hour before first boundary; population disabled by deployment switch'],
  journal: 'Complete original season rollover job aggregates, all columns from eight declared tables; not arbitrary per-commit classification',
  controls: 'Native corruption controls use independent copied-table fixtures in a separate schema, never world rows; each mutation rolls back',
  excluded: ['Natural progression or social formation', 'Initial standing election recomputation', 'Unrelated currency/resources',
    'HTTP, concurrency, literal28-day wall time, deployment, complete simulation matrix', 'Independent installed-dependency attestation'],
  databaseIsolation: db.descriptor, qualifyingFullResourcePass: false };
const proof = await createProofRecorder({ directory: output, source, configuration, runId, seed, scenarioId: 'original-season-status-journal', population: 2 });
const runtime = installSerialRuntime(seed, configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: value => { at = value; }, expectedDormant: [{ label: 'RWA health', code: 'health_registry_unavailable' }] });
const namespace = `rc1_worker_seasons_${process.pid}`, seam = installWorkerInstrumentation(controller, { namespace });
const env = { DATABASE_URL: db.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', COORDINATION_ACCOUNT_IDS: '',
  LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '', POPULATION_OFF: 'on', LIQUIDITY_AUTOMATION_ENABLED: 'off' };
const priorEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])); Object.assign(process.env, env);
const base = new pg.Pool({ connectionString: db.url });
const readPool = new pg.Pool({ connectionString: db.url, options: `-c search_path=${namespace}` });
const nativeConsole = { log: console.log, warn: console.warn, error: console.error };
let pool, ready = false, result, firstTransition, firstFailure = false, boundaries = 0, equations = 0, checks = 0;
const transitions = [], negativeControls = [], invariantReports = [];
const job = controller.job.bind(controller);
controller.job = (label, fn) => job(label, async () => {
  if (!ready || label !== 'season rollover') return fn();
  const before = await snapshotSeasonState(readPool); let after, value, journal;
  try {
    value = await fn(); after = await snapshotSeasonState(readPool); journal = reconcileSeason(before, after, { logicalAt: at });
    const inputArtifact = `season-boundary-${String(++boundaries).padStart(5, '0')}.json`;
    await proof.artifact(inputArtifact, { before, after, logicalAt: at, result: value });
    await proof.record({ kind: 'season-status-boundary', logicalAt: at, journal, inputArtifact });
    equations += journal.prestigeEquations.length; checks += journal.checks.length;
    if (value.converted) { transitions.push({ logicalAt: at, result: value, inputArtifact }); firstTransition ||= { before, after, logicalAt: at }; }
    return value;
  } catch (error) {
    if (!firstFailure) { firstFailure = true; after ||= await snapshotSeasonState(readPool);
      await proof.artifact('first-season-failure.json', { before, after, logicalAt: at, result: value || null, journal: journal || null, message: error.message, stack: error.stack }); }
    throw error;
  }
});
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
  await proof.record({ kind: 'database-created', ...await db.create() }); await base.query(`CREATE SCHEMA ${namespace}`);
  const bootstrap = new controller.Pool({ connectionString: db.url, max: 20 }); await seam.clock.initialize(bootstrap); pool = await makeWorkerDatabase(controller);
  await proof.record({ kind: 'database-version', ...(await pool.query('SELECT version() AS version')).rows[0] });
  for (const [index, name] of ['season-a', 'season-b'].entries()) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [name]);
    await pool.query('INSERT INTO account_persistent(account_id,prestige,season_sunk) VALUES($1,$2,$3)', [name, index ? 0 : 7, index ? 2 : 4]);
    await pool.query("INSERT INTO characters(id,account_id,name,season,respect,season_kills,duel_limit,duel_elo) VALUES($1,$1,$1,$2,$3,$4,10,$5)",
      [name, boundarySeason - 1, index ? 360 : 1000, index ? 1 : 2, index ? 1200 : 1100]);
  }
  await pool.query("INSERT INTO gangs(id,name,tag,season,season_tribute,season_wars) VALUES('season-family','Season Family','SEAS',$1,12000,3)", [boundarySeason - 1]);
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const invariant = async label => { const value = await runLedgerInvariants(pool, { alert: false }); assert(value.ok);
    invariantReports.push({ label, checks: value.checks.length }); await proof.record({ kind: 'canonical-invariants', label, value }); };
  await invariant('baseline'); await proof.artifact('initial-season-state.json', await snapshotSeasonState(readPool)); ready = true;
  await bootOriginalWorker(controller);
  await controller.advanceTo(epoch + hours * 3600000, async (_at, label) => {
    if (label === 'guardedSeasonTick' && at % SEASON_MS === 0) {
      await invariant(`original-boundary:${at}`);
      assert.equal(new Date((await pool.query('SELECT clock_timestamp() AS now')).rows[0].now).getTime(), at);
    }
  });
  assert.equal(transitions.length, 2); assert(transitions.every(row => row.result.converted === 2));
  assert.equal(transitions[1].logicalAt - transitions[0].logicalAt, SEASON_MS);
  const final = await snapshotSeasonState(readPool); await proof.artifact('final-season-state.json', final);
  assert.equal(final.season_records.length, 2); assert.equal(final.season_recaps.length, 4);
  assert.deepEqual(final.account_persistent.map(row => [row.account_id, row.prestige, row.season_crowns, row.duel_titles]).sort(),
    [['season-a', 12, 2, 1], ['season-b', 3, 0, 1]]);
  // Independent native copied projections allow corrupted inputs without touching the tested world.
  const controls = 'rc1_season_controls'; await base.query(`CREATE SCHEMA ${controls}`);
  for (const table of SEASON_JOURNAL_TABLES) {
    await base.query(`CREATE TABLE ${controls}.${table} AS SELECT * FROM ${namespace}.${table} WITH NO DATA`);
    await base.query(`INSERT INTO ${controls}.${table} SELECT * FROM json_populate_recordset(NULL::${controls}.${table},$1::json)`, [JSON.stringify(firstTransition.after[table])]);
  }
  const q = await base.connect();
  try {
    await q.query(`SET search_path=${controls}`);
    const nativeAfter = await readSeasonRows(q); assert.equal(seasonStateHash(nativeAfter), seasonStateHash(firstTransition.after));
    const mutations = [
      ['missing-recap', "DELETE FROM season_recaps WHERE account_id='season-a'"],
      ['wrong-owner-recap', "UPDATE season_recaps SET account_id='stranger' WHERE account_id='season-a'"],
      ['duplicate-recap', "INSERT INTO season_recaps SELECT * FROM season_recaps WHERE account_id='season-a'"],
      ['missing-crown', "UPDATE account_persistent SET season_crowns=0 WHERE account_id='season-a'"],
      ['duplicate-crown', "UPDATE account_persistent SET season_crowns=2 WHERE account_id='season-a'"],
      ['wrong-owner-crown', "UPDATE account_persistent SET season_crowns=CASE WHEN account_id='season-a' THEN 0 ELSE 1 END"],
      ['wrong-prestige', "UPDATE account_persistent SET prestige=prestige+1 WHERE account_id='season-a'"],
      ['missing-notification', "DELETE FROM notifications WHERE type='season_crown'"],
      ['wrong-owner-notification', "UPDATE notifications SET character_id='stranger' WHERE type='season_crown'"],
      ['duplicate-notification', "INSERT INTO notifications SELECT * FROM notifications WHERE type='season_crown'"],
      ['wrong-season-reset', "UPDATE characters SET respect=1 WHERE id='season-a'"],
      ['wrong-conversion-owner', "UPDATE telemetry SET account_id='stranger' WHERE event='season_convert' AND account_id='season-a'"],
      ['rewritten-standings', "UPDATE season_records SET champion_name='Changed'", 'stored'],
      ['rewritten-recap', "UPDATE season_recaps SET kills=kills+1 WHERE account_id='season-a'", 'stored'],
    ];
    for (const [label, sql, mode] of mutations) {
      await q.query('BEGIN');
      try { await q.query(sql); const changed = await readSeasonRows(q); let detected;
        try { reconcileSeason(mode === 'stored' ? firstTransition.after : firstTransition.before, changed, { logicalAt: firstTransition.logicalAt }); }
        catch (error) { detected = error.message; }
        assert(detected, `Native corruption escaped: ${label}`);
        await proof.artifact(`negative-${label}.json`, { before: mode === 'stored' ? firstTransition.after : firstTransition.before,
          after: changed, logicalAt: firstTransition.logicalAt, sql, detected });
        negativeControls.push({ label, detected });
      } finally { await q.query('ROLLBACK'); }
      assert.equal(seasonStateHash(await readSeasonRows(q)), seasonStateHash(firstTransition.after));
    }
    await q.query('BEGIN');
    try { await q.query("UPDATE characters SET cash=cash+1 WHERE id='season-a'"); const changed = await readSeasonRows(q);
      const unknown = reconcileSeason(firstTransition.before, changed, { logicalAt: firstTransition.logicalAt });
      assert(unknown.unsupported.some(row => row.table === 'characters' && row.reason === 'unclassified-row-change'));
      assert.equal(unknown.currencyMovementsClassified, false); await proof.artifact('unclassified-native-cash.json', { before: firstTransition.before, after: changed, journal: unknown });
    } finally { await q.query('ROLLBACK'); }
  } finally { q.release(); }
  await invariant('final'); assert.equal(seasonStateHash(await snapshotSeasonState(readPool)), seasonStateHash(final), 'Control fixtures changed world');
  const schedule = controller.diagnostic(); assert.equal(schedule.failures.length, 0);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map(label => [label,
    schedule.events.filter(row => row.kind === 'timer.fire' && row.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: 8076, guardedTick: 673, guardedSeasonTick: 673, 'health-boundary': 8076 });
  await proof.artifact('worker-schedule.json', schedule); await proof.artifact('random-tape.json', runtime.tape);
  result = { status: 'PASS_SCOPED', logicalHours: hours, boundaries, checks, prestigeEquations: equations, transitions,
    negativeControls, invariantReports, timerCounts, currencyMovementsClassified: false, qualifyingFullResourcePass: false };
} catch (error) {
  result = { status: 'FAIL', logicalAt: at, boundaries, checks, prestigeEquations: equations, error: error.message, stack: error.stack };
  process.exitCode = 1; await proof.record({ kind: 'first-failure', ...result });
  await proof.artifact('failure-worker-schedule.json', controller.diagnostic()); if (pool) await proof.artifact('failure-season-state.json', await snapshotSeasonState(readPool));
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = nativeConsole[level];
  await controller.close(); await readPool.end(); await base.end(); seam.restore(); runtime.restore();
  for (const [name, value] of Object.entries(priorEnv)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  await proof.record({ kind: 'database-retained', descriptor: db.descriptor });
  const sealed = await proof.finish(result); await verifyArtifactIndex(output, sealed);
}
console.log(JSON.stringify({ output, runId, source: source.revision, status: result.status, boundaries, checks, equations, matrixQualifying: false }));
