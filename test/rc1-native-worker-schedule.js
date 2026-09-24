import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { createRecordedQueryOrder, replayRowOrder, replayCandidateSelection, QUERY_ORDER_SCOPE } from '../tools/rc1-native-query-order.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, restoreCheckpoint, canonicalJson, sha256 } from '../tools/rc1-native-proof.js';

let fake = 0, fires = 0;
const unit = createWorkerSchedule({ start: fake, setClock: (at) => { fake = at; } });
unit.timers.setInterval(async () => { await Promise.resolve(); fires++; }, 10);
const chained = () => unit.timers.setTimeout(async () => { fires++; chained(); }, 7);
chained(); await unit.advanceTo(30);
assert.equal(fake, 30); assert.equal(fires, 7);
const prepared = [], ordering = [];
const withPreparation = createWorkerSchedule({ start: 0, setClock: value => ordering.push(['clock', value]),
  beforeCallback: async identity => { prepared.push(identity); ordering.push(['prepare', identity.logicalAt]); } });
withPreparation.timers.setInterval(async function originalTick() { ordering.push(['original', prepared.at(-1).logicalAt]); }, 10);
await withPreparation.advanceTo(20);
assert.deepEqual(prepared, [{ logicalAt: 10, label: 'originalTick' }, { logicalAt: 20, label: 'originalTick' }]);
assert.deepEqual(ordering, [['clock', 10], ['prepare', 10], ['original', 10], ['clock', 20], ['prepare', 20], ['original', 20], ['clock', 20]]);
assert.equal(withPreparation.diagnostic().events.filter(row => row.kind === 'timer.fire').length, 2);
await withPreparation.close();
const drained = [], sameTimeWork = [];
const withObservation = createWorkerSchedule({ start: 0, setClock() {},
  afterTimestamp: async at => drained.push({ at, completed: [...sameTimeWork] }) });
withObservation.timers.setInterval(async function hourly() { sameTimeWork.push('hourly'); }, 10);
withObservation.timers.setInterval(async function seasonal() { sameTimeWork.push('seasonal'); }, 10);
await withObservation.advanceTo(10, async (_, label) => sameTimeWork.push('actor-after-' + label));
assert.deepEqual(drained, [{ at: 10, completed: ['hourly', 'actor-after-hourly', 'seasonal', 'actor-after-seasonal'] }]);
assert.equal(withObservation.diagnostic().events.filter(row => row.kind === 'timer.fire').length, 2);
await withObservation.close();
const bad = createWorkerSchedule({ start: 0, setClock() {} });
bad.timers.setTimeout(async () => { try { await bad.job('deliberate', async () => { throw Error('retained sentinel'); }); } catch {} }, 1);
await assert.rejects(bad.advanceTo(1), /Unexpected production worker failure/);
assert.equal(bad.diagnostic().jobs[0].status, 'FAILED');
let random = installSerialRuntime('worker-checkpoint-unit'); crypto.randomUUID(); Math.random();
const tape = structuredClone(random.tape), nextRandom = crypto.randomUUID(); random.restore();
random = installSerialRuntime('worker-checkpoint-unit'); random.restoreTape(tape); assert.equal(crypto.randomUUID(), nextRandom); random.restore();
random = installSerialRuntime('worker-checkpoint-unit');
assert.throws(() => random.restoreTape([{ ...tape[0], hex: '00'.repeat(16) }]), /differs from seed/); random.restore();
console.log('PASS: async timer callbacks, chained deadlines, swallowed failures, random checkpoint restoration and tamper detection');
assert.deepEqual(replayRowOrder([{ id: 'b' }, { id: 'a' }, { id: 'a' }], [{ id: 'a' }, { id: 'b' }, { id: 'a' }]), [{ id: 'a' }, { id: 'b' }, { id: 'a' }]);
assert.throws(() => replayRowOrder([{ id: 'b' }, { id: 'a' }], [{ id: 'a' }, { id: 'a' }]), /membership\/value/);
assert.throws(() => replayRowOrder([{ cash: 9 }], [{ cash: 10 }]), /membership\/value/);
console.log('PASS: recorded SQL reordering preserves values and duplicate multiplicities');
const eligible = ['{"id":"a","cash":9007199254740993}', '{"id":"b","cash":7}', '{"id":"c","cash":8}'];
const selection = { eligibleRows: eligible, nativeRows: [{ id: 'a' }, { id: 'b' }],
  recordedEligibleRows: [...eligible].reverse(), recordedRows: [{ id: 'c' }, { id: 'a' }], limit: 2 };
assert.deepEqual(replayCandidateSelection(selection), [{ id: 'c' }, { id: 'a' }]);
assert.throws(() => replayCandidateSelection({ ...selection, eligibleRows: [eligible[0], eligible[1]] }), /row count/);
assert.throws(() => replayCandidateSelection({ ...selection, eligibleRows: [eligible[0].replace('9007199254740993', '9007199254740992'), ...eligible.slice(1)] }), /membership\/value/);
assert.throws(() => replayCandidateSelection({ ...selection, eligibleRows: [eligible[0], eligible[1], eligible[1]] }), /membership\/value/);
assert.throws(() => replayCandidateSelection({ ...selection, recordedRows: [{ id: 'a' }, { id: 'a' }] }), /membership\/value/);
assert.throws(() => replayCandidateSelection({ ...selection, nativeRows: [{ id: 'a' }] }), /cardinality/);
assert.deepEqual(replayCandidateSelection({ eligibleRows: [], nativeRows: [] }), []);
console.log('PASS: recorded LIMIT selection rejects changed eligibility, exact large numeric value, multiplicity and cardinality');
execFileSync(process.execPath, ['--input-type=module', '-e', `
  import assert from 'node:assert/strict';
  import './src/db.js';
  import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker } from './tools/rc1-native-worker.js';
  const controller = createWorkerSchedule({ start: 0, setClock() {} });
  const seam = installWorkerInstrumentation(controller, { namespace: 'rc1_worker_cache_guard' });
  try {
    await assert.rejects(makeWorkerDatabase(controller), /Cached uninstrumented db.js/);
    await assert.rejects(bootOriginalWorker(controller), /Cached uninstrumented db.js/);
    assert.equal(controller.pools.length, 0);
  } finally { seam.restore(); }
`], { stdio: 'pipe' });
console.log('PASS: cached uninstrumented database refuses before creating any pool');

if (process.argv.includes('--postgres')) {
  const argument = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const output = argument('output'); assert(output, 'Provide a new restricted evidence directory');
  const hours = Number(argument('hours') || 673); assert(Number.isInteger(hours) && hours > 0 && hours <= 2161);
  const compare = argument('compare');
  const resume = argument('resume');
  const queryOrderReplay = argument('query-order-replay');
  const source = await sourceIdentity();
  let retainedOrder;
  if (queryOrderReplay) {
    const orderRun = JSON.parse(await fs.readFile(path.join(queryOrderReplay, 'run.json'), 'utf8'));
    await verifyArtifactIndex(queryOrderReplay, orderRun); assert.equal(orderRun.status, 'PASS_SCOPED');
    assert.equal(orderRun.source.revision, source.revision, 'Recorded SQL replay requires the same source');
    retainedOrder = JSON.parse(await fs.readFile(path.join(queryOrderReplay, 'query-order.json'), 'utf8'));
  }
  let parentRun, parentCheckpoint, parentTape;
  if (resume) {
    parentRun = JSON.parse(await fs.readFile(path.join(resume, 'run.json'), 'utf8'));
    await verifyArtifactIndex(resume, parentRun); assert.equal(parentRun.status, 'PASS_SCOPED');
    assert.equal(parentRun.scenarioId, 'scoped-native-complete-local-worker-clock');
    assert.deepEqual(parentRun.configuration.sourcePins, WORKER_SOURCE_PINS, 'Checkpoint used different production instrumentation sources');
    parentCheckpoint = JSON.parse(await fs.readFile(path.join(resume, 'final-checkpoint.json'), 'utf8'));
    parentTape = JSON.parse(await fs.readFile(path.join(resume, 'random-tape.json'), 'utf8')).draws;
    assert.equal(parentCheckpoint.stateSha256, parentRun.result.finalStateSha256);
    assert.equal(sha256(canonicalJson(parentTape)), parentRun.result.deterministicRandomTapeSha256);
    assert(/^rc1_worker_[a-z_0-9]+$/.test(parentCheckpoint.schema), 'Checkpoint is not an isolated worker fixture');
  }
  const controlUrl = process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL;
  assert(controlUrl, 'Explicit disposable PostgreSQL URL required');
  for (const name of ['CHAIN_RPC_URL', 'INVARIANT_WEBHOOK_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL'])
    assert(!process.env[name], `Native worker fixture requires unconfigured external integration: ${name}`);
  const database = planOwnedWorldDatabase({ controlUrl, runId: path.basename(output), sourceRevision: source.revision });
  const url = database.url;
  const declared = { DATABASE_URL: url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
    COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on',
    COORDINATION_ACCOUNT_IDS: '', LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '',
    POPULATION_OFF: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off' };
  const priorEnvironment = Object.fromEntries(Object.keys(declared).map((name) => [name, process.env[name]]));
  Object.assign(process.env, declared);
  // One hour before a real 28-day boundary. The second rollover occurs 28 days
  // later; no shortened season option, deadline update, or skipped interval.
  const seasonMs = 28 * 86400000, epoch = resume ? Date.parse(parentRun.configuration.finish)
    : Math.ceil(Date.parse('2026-09-20T12:00:00.000Z') / seasonMs) * seasonMs - 3600000;
  const seed = 'rc1-worker-due-clock-v1'; let at = epoch;
  const expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable',
    reason: 'No finalized external stock registry/provider in this local fixture; fail-closed callback execution is retained, settlement coverage is excluded.' }];
  const configuration = { hours, start: new Date(epoch).toISOString(), finish: new Date(epoch + hours * 3600000).toISOString(), seed,
    databaseIsolation: database.descriptor,
    queryOrder: { scope: QUERY_ORDER_SCOPE, mode: queryOrderReplay ? 'recorded-selection-replay' : 'observe',
      inputSha256: queryOrderReplay ? sha256(await fs.readFile(path.join(queryOrderReplay, 'query-order.json'))) : null },
    parentCheckpoint: resume ? { directory: path.resolve(resume), source: parentRun.source,
      runSha256: sha256(await fs.readFile(path.join(resume, 'run.json'))), checkpointSha256: parentCheckpoint.sha256,
      stateSha256: parentCheckpoint.stateSha256, randomTapeSha256: parentRun.result.deterministicRandomTapeSha256,
      semantics: 'Fresh worker process boots from restored database and RNG tape. Boot effects are retained; no equivalence to an uninterrupted schedule is assumed.' } : null,
    sourcePins: WORKER_SOURCE_PINS, expectedDormant, backupArchiving: 'off; local cluster; expected backup alarm retained; no PITR claim',
    workerScheduling: 'Original production timer callbacks at every declared deadline, serial accepted order; zero logical callback duration; native wall durations retained.',
    environment: { ...declared, DATABASE_URL: 'new exclusively owned local PostgreSQL database' },
    excludedIntegrations: ['chain watcher: no RPC or signer configured', 'liquidity automation: disabled', 'external RWA registry/provider: unavailable'] };
  const proof = await createProofRecorder({ directory: output, source, configuration, runId: path.basename(output), seed,
    population: 1, scenarioId: 'scoped-native-complete-local-worker-clock' });
  const runtime = installSerialRuntime(seed, new Date(epoch).toISOString()); runtime.bindClock(() => at);
  if (resume) runtime.restoreTape(parentTape);
  const controller = createWorkerSchedule({ start: epoch, setClock: (value) => { at = value; }, expectedDormant });
  const namespace = resume ? parentCheckpoint.schema : `rc1_worker_${process.pid}_${Math.floor(performance.now())}`;
  const base = new pg.Pool({ connectionString: url });
  const queryOrder = createRecordedQueryOrder({ replay: retainedOrder, replayDirectory: queryOrderReplay, artifact: proof.artifact });
  const instrumentation = installWorkerInstrumentation(controller, { namespace, queryOrder });
  const originalConsole = { log: console.log, warn: console.warn, error: console.error };
  const originalArgv = process.argv[1]; let pool, result, firstRollover = false;
  try {
    for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
    await proof.record({ kind: 'database-created', ...await database.create() });
    const initialSeason = Math.floor(epoch / seasonMs);
    if (resume) {
      pool = await restoreCheckpoint(parentCheckpoint, path.join(resume, 'final.dump'), url,
        { poolFactory: instrumentation.clock.poolFactory }); controller.pools.push(pool);
      const restoredClock = (await pool.query('SELECT now() AS tx,clock_timestamp() AS statement')).rows[0];
      assert.equal(restoredClock.tx.getTime(), epoch); assert.equal(restoredClock.statement.getTime(), epoch);
    } else {
      await base.query(`CREATE SCHEMA ${namespace}`);
      const bootstrap = new controller.Pool({ connectionString: url, options: '', max: 20 });
      await instrumentation.clock.initialize(bootstrap);
      pool = await makeWorkerDatabase(controller);
      await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('rc1-worker-actor','test','rc1-worker-actor')");
      await pool.query("INSERT INTO account_persistent(account_id) VALUES('rc1-worker-actor')");
      await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES('rc1-worker-character','rc1-worker-actor','Worker clock fixture',$1,'docks',10000,500)", [initialSeason]);
    }
    const initialRecaps = Number((await pool.query("SELECT count(*) n FROM season_recaps WHERE account_id='rc1-worker-actor'")).rows[0].n);
    const { runLedgerInvariants } = await import('../src/invariants.js');
    const baseline = await runLedgerInvariants(pool, { alert: false }); assert(baseline.ok, 'Initial worker fixture must reconcile without subtracting drift');
    await proof.record({ kind: 'measured-initialization', ...(resume ? { restoredCheckpoint: configuration.parentCheckpoint }
      : { syntheticActor: true, cash: 500, respect: 10000 }), initialSeason,
      randomDraws: runtime.tape, clock: epoch, fixtureWritesAfterThisRecord: false });
    const initial = await proof.snapshot(pool, 'initial-state'); await proof.checkpoint(pool, 'initial', url);
    if (resume) assert.equal(initial.stateSha256, parentCheckpoint.stateSha256, 'Restart did not restore exact canonical state');
    await bootOriginalWorker(controller);
    let reportedDay = Math.floor(epoch / 86400000);
    await controller.advanceTo(epoch + hours * 3600000, async (logicalAt, label) => {
      const today = Math.floor(logicalAt / 86400000);
      if (!firstRollover && label === 'guardedSeasonTick' && Math.floor(logicalAt / seasonMs) > initialSeason) {
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
    const expectedRollovers = Math.floor((epoch + hours * 3600000) / seasonMs) - initialSeason;
    assert.equal(recaps.length - initialRecaps, expectedRollovers); assert.equal(Number((await pool.query("SELECT season FROM characters WHERE id='rc1-worker-character'")).rows[0].season), initialSeason + expectedRollovers);
    assert.equal(Number((await pool.query('SELECT count(*) n FROM characters WHERE alive AND season < $1', [initialSeason + expectedRollovers])).rows[0].n), 0,
      'Season worker left an eligible living character behind');
    await proof.artifact('worker-schedule.json', trace); await proof.artifact('random-tape.json', { draws: runtime.tape });
    await proof.artifact('query-order.json', await queryOrder.finish());
    result = { status: 'PASS_SCOPED', source: source.revision, hours, canonicalSeasonalRollovers: recaps.length - initialRecaps,
      checkpointRestart: !!resume, parentSource: parentRun?.source.revision || null, recordedQueryOrderReplay: !!queryOrderReplay,
      recordedQuerySelectionReplay: !!queryOrderReplay, queryReplayScopeVersion: QUERY_ORDER_SCOPE.version,
      initialStateSha256: initial.stateSha256, finalStateSha256: final.stateSha256, timerFirings: counts,
      guardedJobs: trace.jobs.length, expectedDormantJobs: trace.jobs.filter((job) => job.status === 'EXPECTED_DORMANT').length,
      unexpectedWorkerFailures: trace.failures.length, invariantChecks: finalInvariants.checks.length, matrixQualifying: false,
      scheduleSha256: trace.scheduleSha256, jobOutcomesSha256: sha256(canonicalJson(trace.jobs)),
      deterministicRandomTapeSha256: sha256(canonicalJson(runtime.tape)),
      actorRoster: { initialCharacters: initial.tables.characters.length, finalCharacters: final.tables.characters.length,
        initialPlayers: initial.tables.characters.map(JSON.parse).filter((row) => !row.is_npc).length,
        finalPlayers: final.tables.characters.map(JSON.parse).filter((row) => !row.is_npc).length,
        finalLivingResidents: final.tables.characters.map(JSON.parse).filter((row) => row.is_npc && row.alive).length,
        playerPolicyWorkload: 'idle; worker-only coverage' } };
    if (compare) {
      const previous = JSON.parse(await fs.readFile(path.join(compare, 'run.json'), 'utf8'));
      assert.equal(previous.status, 'PASS_SCOPED'); assert.equal(previous.source.revision, source.revision);
      for (const field of ['hours', 'initialStateSha256', 'finalStateSha256', 'scheduleSha256', 'jobOutcomesSha256', 'deterministicRandomTapeSha256'])
        assert.equal(result[field], previous.result[field], `Fresh-worker same-seed replay differed: ${field}`);
      result.sameSeedFreshWorkerReplay = !queryOrderReplay; result.recordedNondeterminismReplay = !!queryOrderReplay;
    }
    await proof.record({ kind: 'assertions', ...result });
  } catch (error) {
    result = { status: 'FAIL', error: { message: error.message, stack: error.stack } };
    await proof.record({ kind: 'failure', ...result.error });
    await proof.artifact('first-failure-schedule.json', controller.diagnostic());
    await proof.artifact('first-failure-query-order.json', await queryOrder.diagnostic());
    await proof.artifact('first-failure-random-tape.json', { draws: runtime.tape });
    if (pool) {
      try { await proof.snapshot(pool, 'first-failure-state'); await proof.checkpoint(pool, 'first-failure', url); }
      catch (captureError) { await proof.record({ kind: 'failure-capture-error', message: captureError.message, stack: captureError.stack }); }
    }
  } finally {
    Object.assign(console, originalConsole); process.argv[1] = originalArgv;
    try { await controller.close(); }
    catch (error) { result = { status: 'FAIL', error: { message: error.message, stack: error.stack } }; await proof.record({ kind: 'cleanup-failure', ...result.error }); }
    instrumentation.restore(); runtime.restore();
    try { await base.end(); await proof.record({ kind: 'database-cleanup', ...await database.close() }); }
    catch (error) { result = { status: 'FAIL', error: { message: error.message, stack: error.stack } }; await proof.record({ kind: 'cleanup-failure', ...result.error }); }
    for (const [name, value] of Object.entries(priorEnvironment)) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
  console.log(JSON.stringify(result)); assert.equal(result.status, 'PASS_SCOPED', result.error?.message);
}
