// Scoped transport integration: original worker callbacks, owned native DB,
// complete state and recorded query-order replay. No actor/resource-matrix claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createRecordedQueryOrder, QUERY_ORDER_SCOPE } from '../tools/rc1-native-query-order.js';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = argument('output'), replay = argument('replay'); assert(output);
const source = await sourceIdentity(), controlUrl = process.env.COORDINATION_TEST_DATABASE_URL; assert(controlUrl);
let prior, retainedOrder;
if (replay) {
  prior = JSON.parse(await fs.readFile(path.join(replay, 'run.json'))); await verifyArtifactIndex(replay, prior);
  assert.equal(prior.status, 'PASS_SCOPED'); assert.equal(prior.source.revision, source.revision);
  retainedOrder = JSON.parse(await fs.readFile(path.join(replay, 'query-order.json')));
}
for (const key of ['CHAIN_RPC_URL', 'INVARIANT_WEBHOOK_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL']) assert(!process.env[key]);
const database = planOwnedWorldDatabase({ controlUrl, runId: path.basename(output), sourceRevision: source.revision });
Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', COORDINATION_ACCOUNT_IDS: '',
  LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '', POPULATION_OFF: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off' });
const seed = 'rc1-gzip-worker', epoch = Date.parse('2026-09-20T12:00:00.000Z'), hours = 2;
const historyStorage = { encoding: 'gzip', framing: 'event-members-v1', maximumDecodedBytes: 67108864,
  maximumStoredBytes: 16777216, maximumLineBytes: 4194304, maximumOutstandingInvocations: 8, maximumPendingRecords: 8 };
const expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable', reason: 'Local external registry unavailable; callback retained, settlement excluded.' }];
const configuration = { seed, epoch, hours, database: database.descriptor, sourcePins: WORKER_SOURCE_PINS, queryScope: QUERY_ORDER_SCOPE,
  replay: replay ? { directory: path.resolve(replay), runSha256: sha256(await fs.readFile(path.join(replay, 'run.json'))) } : null,
  resourceScope: 'Canonical aggregate invariants only; no per-commit thirteen-resource observer or matrix qualification.',
  actorScope: 'Empty initial player roster; actual original NPC worker population retained.', expectedDormant,
  externalScope: 'Chain/liquidity integrations disabled; RWA registry absent; local backup archive alarm retained.' };
const proof = await createProofRecorder({ directory: output, source, configuration, runId: path.basename(output), seed,
  scenarioId: 'scoped-gzip-original-worker-transport', population: 0, historyStorage });
let at = epoch;
const runtime = installSerialRuntime(seed, new Date(epoch).toISOString()); runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: value => { at = value; }, expectedDormant });
const namespace = 'rc1_worker_gzip_transport', queryOrder = createRecordedQueryOrder({ replay: retainedOrder, replayDirectory: replay, artifact: proof.artifact });
const instrumentation = installWorkerInstrumentation(controller, { namespace, queryOrder }), base = new pg.Pool({ connectionString: database.url });
const consoleBefore = { log: console.log, warn: console.warn, error: console.error }; let pool, result;
try {
  for (const level of Object.keys(consoleBefore)) console[level] = (...args) => controller.log(level, args);
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query(`CREATE SCHEMA ${namespace}`);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await instrumentation.clock.initialize(bootstrap);
  pool = await makeWorkerDatabase(controller);
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const initialChecks = await runLedgerInvariants(pool, { alert: false }); assert(initialChecks.ok);
  const initial = await proof.snapshot(pool, 'initial');
  await proof.record({ kind: 'measured-initialization', initialStateSha256: initial.stateSha256, randomDraws: runtime.tape,
    clock: epoch, playerActors: 0, fixtureWritesAfterThisRecord: false });
  await proof.invoke('original-worker.boot', { sourcePins: WORKER_SOURCE_PINS }, async () => {
    await bootOriginalWorker(controller); return { bootJobs: controller.diagnostic().jobs.length };
  });
  let previousJobs = controller.diagnostic().jobs.length;
  await proof.invoke('original-worker.advance', { until: epoch + hours * 3600000 }, async () => {
    await controller.advanceTo(epoch + hours * 3600000, async (logicalAt, label) => {
      const trace = controller.diagnostic();
      await proof.record({ kind: 'worker-boundary', logicalAt, label, jobs: trace.jobs.slice(previousJobs) }); previousJobs = trace.jobs.length;
    });
    return { logicalAt: at };
  });
  const final = await proof.snapshot(pool, 'final'); await proof.checkpoint(pool, 'final', database.url);
  const invariants = await runLedgerInvariants(pool, { alert: false }); assert(invariants.ok);
  const trace = controller.diagnostic(), counts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary']
    .map(label => [label, trace.events.filter(event => event.kind === 'timer.fire' && event.label === label).length]));
  assert.deepEqual(counts, { directorTick: 24, guardedTick: 2, guardedSeasonTick: 2, 'health-boundary': 24 });
  assert.equal(trace.failures.length, 0);
  assert.equal(trace.events.filter(event => event.kind === 'callback.start').length, trace.events.filter(event => event.kind === 'callback.complete').length);
  await proof.artifact('worker-schedule.json', trace); await proof.artifact('random-tape.json', { draws: runtime.tape });
  await proof.artifact('query-order.json', await queryOrder.finish());
  result = { status: 'PASS_SCOPED', hours, initialStateSha256: initial.stateSha256, finalStateSha256: final.stateSha256,
    scheduleSha256: trace.scheduleSha256, jobOutcomesSha256: sha256(canonicalJson(trace.jobs)), randomTapeSha256: sha256(canonicalJson(runtime.tape)),
    counts, invariantChecks: invariants.checks.length, guardedJobs: trace.jobs.length, exactRecordedReplay: !!replay,
    finalPlayerActors: final.tables.characters.map(JSON.parse).filter(row => !row.is_npc).length, matrixQualifying: false };
  if (prior) for (const field of ['initialStateSha256', 'finalStateSha256', 'scheduleSha256', 'jobOutcomesSha256', 'randomTapeSha256'])
    assert.equal(result[field], prior.result[field], `Complete worker replay mismatch: ${field}`);
  await proof.record({ kind: 'assertions', ...result });
} catch (error) {
  result = { status: 'FAIL', error: { message: error.message, stack: error.stack } };
  await proof.artifact('failure-context.json', { error: result.error, schedule: controller.diagnostic(), randomTape: runtime.tape });
  await proof.record({ kind: 'failure', ...result.error });
} finally {
  Object.assign(console, consoleBefore);
  const cleanupErrors = [];
  try { await controller.close(); } catch (error) { cleanupErrors.push(error.message); }
  instrumentation.restore(); runtime.restore();
  try { await base.end(); await proof.record({ kind: 'database-cleanup', ...await database.close() }); }
  catch (error) { cleanupErrors.push(error.message); }
  if (cleanupErrors.length) {
    result = { ...result, status: 'FAIL', cleanupErrors };
    await proof.artifact('cleanup-failure.json', { cleanupErrors, originalResult: result });
  }
}
const run = await proof.finish(result); await verifyArtifactIndex(output, run);
console.log(JSON.stringify(result)); assert.equal(result.status, 'PASS_SCOPED', result.error?.message);
