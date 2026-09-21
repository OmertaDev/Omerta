import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createWorkerSchedule, installWorkerInstrumentation, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, canonicalJson, sha256 } from '../tools/rc1-native-proof.js';

let fake = 0, fires = 0;
const unit = createWorkerSchedule({ start: fake, setClock: (at) => { fake = at; } });
unit.timers.setInterval(async () => { await Promise.resolve(); fires++; }, 10);
const chained = () => unit.timers.setTimeout(async () => { fires++; chained(); }, 7);
chained(); await unit.advanceTo(30);
assert.equal(fake, 30); assert.equal(fires, 7);
const bad = createWorkerSchedule({ start: 0, setClock() {} });
bad.timers.setTimeout(async () => { try { await bad.job('deliberate', async () => { throw Error('retained sentinel'); }); } catch {} }, 1);
await assert.rejects(bad.advanceTo(1), /Unexpected production worker failure/);
assert.equal(bad.diagnostic().jobs[0].status, 'FAILED');
console.log('PASS: actual async timer callbacks, chained deadlines, and swallowed-job failure detection');

if (process.argv.includes('--postgres')) {
  const argument = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const output = argument('output'); assert(output, 'Provide a new restricted evidence directory');
  const hours = Number(argument('hours') || 673); assert(Number.isInteger(hours) && hours > 0 && hours <= 2161);
  const compare = argument('compare');
  const source = await sourceIdentity();
  const url = process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL;
  assert(url, 'Explicit disposable PostgreSQL URL required');
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname));
  for (const name of ['CHAIN_RPC_URL', 'INVARIANT_WEBHOOK_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL'])
    assert(!process.env[name], `Native worker fixture requires unconfigured external integration: ${name}`);
  const declared = { DATABASE_URL: url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
    COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on',
    COORDINATION_ACCOUNT_IDS: '', LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '',
    POPULATION_OFF: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off' };
  const priorEnvironment = Object.fromEntries(Object.keys(declared).map((name) => [name, process.env[name]]));
  Object.assign(process.env, declared);
  // One hour before a real 28-day boundary. The second rollover occurs 28 days
  // later; no shortened season option, deadline update, or skipped interval.
  const seasonMs = 28 * 86400000, epoch = Math.ceil(Date.parse('2026-09-20T12:00:00.000Z') / seasonMs) * seasonMs - 3600000;
  const seed = 'rc1-worker-due-clock-v1'; let at = epoch;
  const expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable',
    reason: 'No finalized external stock registry/provider in this local fixture; fail-closed callback execution is retained, settlement coverage is excluded.' }];
  const configuration = { hours, start: new Date(epoch).toISOString(), finish: new Date(epoch + hours * 3600000).toISOString(), seed,
    sourcePins: WORKER_SOURCE_PINS, expectedDormant, backupArchiving: 'off; local cluster; expected backup alarm retained; no PITR claim',
    workerScheduling: 'Original production timer callbacks at every declared deadline, serial accepted order; zero logical callback duration; native wall durations retained.',
    environment: { ...declared, DATABASE_URL: 'explicit local PostgreSQL isolated schema' },
    excludedIntegrations: ['chain watcher: no RPC or signer configured', 'liquidity automation: disabled', 'external RWA registry/provider: unavailable'] };
  const proof = await createProofRecorder({ directory: output, source, configuration, runId: path.basename(output), seed,
    population: 1, scenarioId: 'scoped-native-complete-local-worker-clock' });
  const runtime = installSerialRuntime(seed, new Date(epoch).toISOString()); runtime.bindClock(() => at);
  const controller = createWorkerSchedule({ start: epoch, setClock: (value) => { at = value; }, expectedDormant });
  const namespace = `rc1_worker_${process.pid}_${Math.floor(performance.now())}`;
  const base = new pg.Pool({ connectionString: url });
  const instrumentation = installWorkerInstrumentation(controller, { namespace });
  const originalConsole = { log: console.log, warn: console.warn, error: console.error };
  const originalArgv = process.argv[1]; let pool, result, created = false, firstRollover = false;
  try {
    await base.query(`CREATE SCHEMA ${namespace}`); created = true;
    const bootstrap = new controller.Pool({ connectionString: url, options: '', max: 20 });
    await instrumentation.clock.initialize(bootstrap);
    for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
    const { makeDb } = await import('../src/db.js'); pool = await makeDb();
    const initialSeason = Math.floor(epoch / seasonMs);
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('rc1-worker-actor','test','rc1-worker-actor')");
    await pool.query("INSERT INTO account_persistent(account_id) VALUES('rc1-worker-actor')");
    await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES('rc1-worker-character','rc1-worker-actor','Worker clock fixture',$1,'docks',10000,500)", [initialSeason]);
    const { runLedgerInvariants } = await import('../src/invariants.js');
    const baseline = await runLedgerInvariants(pool, { alert: false }); assert(baseline.ok, 'Initial worker fixture must reconcile without subtracting drift');
    await proof.record({ kind: 'measured-initialization', syntheticActor: true, cash: 500, respect: 10000, initialSeason,
      randomDraws: runtime.tape, clock: epoch, fixtureWritesAfterThisRecord: false });
    const initial = await proof.snapshot(pool, 'initial-state'); await proof.checkpoint(pool, 'initial', url);
    process.argv[1] = fileURLToPath(new URL('../src/worker.js', import.meta.url));
    await import('../src/worker.js'); process.argv[1] = originalArgv;
    assert.equal(controller.transformations.length, 2, 'Both exact pinned instrumentation maps must be applied');
    await controller.drainBoot();
    let reportedDay = Math.floor(epoch / 86400000);
    await controller.advanceTo(epoch + hours * 3600000, async (logicalAt, label) => {
      const today = Math.floor(logicalAt / 86400000);
      if (!firstRollover && label === 'guardedSeasonTick') {
        firstRollover = true;
        await proof.snapshot(pool, 'first-rollover-state'); await proof.checkpoint(pool, 'first-rollover', url);
      }
      if (today !== reportedDay) {
        reportedDay = today;
        const invariants = await runLedgerInvariants(pool, { alert: false }); assert(invariants.ok, 'Daily worker conservation failed');
        await proof.record({ kind: 'logical-day-complete', logicalAt, checks: invariants.checks });
        originalConsole.log(JSON.stringify({ workerDay: today, elapsedLogicalHours: (logicalAt - epoch) / 3600000,
          callbacks: controller.diagnostic().events.filter((event) => event.kind === 'callback.complete').length }));
      }
    });
    const final = await proof.snapshot(pool, 'final-state'); await proof.checkpoint(pool, 'final', url);
    const finalInvariants = await runLedgerInvariants(pool, { alert: false }); assert(finalInvariants.ok);
    const trace = controller.diagnostic(), timerFirings = trace.events.filter((event) => event.kind === 'timer.fire');
    const counts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map((label) => [label, timerFirings.filter((entry) => entry.label === label).length]));
    assert.deepEqual(counts, { directorTick: hours * 12, guardedTick: hours, guardedSeasonTick: hours, 'health-boundary': hours * 12 });
    assert.equal(trace.events.filter((event) => event.kind === 'callback.start').length, trace.events.filter((event) => event.kind === 'callback.complete').length);
    assert(!trace.activeTimers.some((entry) => entry.label === 'watchdog'), 'Every completed main callback must clear its watchdog');
    const recaps = (await pool.query("SELECT season FROM season_recaps WHERE account_id='rc1-worker-actor' ORDER BY season")).rows.map((row) => Number(row.season));
    const expectedRollovers = Math.floor((hours - 1) / (28 * 24)) + 1;
    assert.equal(recaps.length, expectedRollovers); assert.equal(Number((await pool.query("SELECT season FROM characters WHERE id='rc1-worker-character'")).rows[0].season), initialSeason + expectedRollovers);
    await proof.artifact('worker-schedule.json', trace); await proof.artifact('random-tape.json', { draws: runtime.tape });
    result = { status: 'PASS_SCOPED', source: source.revision, hours, canonicalSeasonalRollovers: recaps.length,
      initialStateSha256: initial.stateSha256, finalStateSha256: final.stateSha256, timerFirings: counts,
      guardedJobs: trace.jobs.length, expectedDormantJobs: trace.jobs.filter((job) => job.status === 'EXPECTED_DORMANT').length,
      unexpectedWorkerFailures: trace.failures.length, invariantChecks: finalInvariants.checks.length, matrixQualifying: false,
      scheduleSha256: trace.scheduleSha256, deterministicRandomTapeSha256: sha256(canonicalJson(runtime.tape)) };
    if (compare) {
      const previous = JSON.parse(await fs.readFile(path.join(compare, 'run.json'), 'utf8'));
      assert.equal(previous.status, 'PASS_SCOPED'); assert.equal(previous.source.revision, source.revision);
      for (const field of ['hours', 'initialStateSha256', 'finalStateSha256', 'scheduleSha256', 'deterministicRandomTapeSha256'])
        assert.equal(result[field], previous.result[field], `Fresh-worker same-seed replay differed: ${field}`);
      result.sameSeedFreshWorkerReplay = true;
    }
    await proof.record({ kind: 'assertions', ...result });
  } catch (error) {
    result = { status: 'FAIL', error: { message: error.message, stack: error.stack } };
    await proof.record({ kind: 'failure', ...result.error });
    await proof.artifact('first-failure-schedule.json', controller.diagnostic());
    if (pool) { await proof.snapshot(pool, 'first-failure-state'); await proof.checkpoint(pool, 'first-failure', url); }
  } finally {
    Object.assign(console, originalConsole); process.argv[1] = originalArgv;
    await controller.close(); instrumentation.restore(); runtime.restore();
    if (created) await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end();
    for (const [name, value] of Object.entries(priorEnvironment)) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
  console.log(JSON.stringify(result)); assert.equal(result.status, 'PASS_SCOPED', result.error?.message);
}
