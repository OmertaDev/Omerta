// Scoped quiet-world integration: authorized actors plus every original local
// worker deadline. It cannot qualify a matrix cell while required metrics,
// resource branches, lifecycle workloads and deployment scope remain incomplete.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { createRecordedQueryOrder, QUERY_ORDER_SCOPE } from '../tools/rc1-native-query-order.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { activeQuietRoster, chooseAuthorizedCommand, choosePublicCrime, observedOpportunityTracker } from '../tools/rc1-native-player-policy.js';
import { collectWorldDiagnostics } from '../tools/rc1-world-diagnostics.js';
import { createNativeCommitObserver } from '../tools/rc1-native-commit-observer.js';
import { snapshotWorldResources, reconcileWorldResources, worldResourceHash } from '../tools/rc1-world-resource-observer.js';

const argument = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
assert(process.argv.includes('--postgres'), 'Real PostgreSQL is required');
const output = argument('output') || process.env.RC1_WORLD_OUTPUT; assert(output, 'Provide a new restricted output directory');
const observeResources = process.argv.includes('--observe-resources');
const hours = Number(argument('hours') || 2160), population = Number(argument('population') || 25);
assert(Number.isSafeInteger(hours) && hours > 0 && hours <= 2161);
assert([25, 100, 250, 500, 1000].includes(population));
const seed = argument('seed') || 'rc1-alpha'; assert(['rc1-alpha', 'rc1-beta', 'rc1-gamma'].includes(seed));
const source = await sourceIdentity(), controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(controlUrl, 'Explicit disposable local PostgreSQL control database required');
for (const key of ['CHAIN_RPC_URL', 'INVARIANT_WEBHOOK_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL'])
  assert(!process.env[key], `No external integration is authorized for this isolated workload: ${key}`);
const database = planOwnedWorldDatabase({ controlUrl, runId: path.basename(output), sourceRevision: source.revision });
const url = database.url;
const declared = { DATABASE_URL: url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on',
  COORDINATION_ACCOUNT_IDS: '', LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '',
  POPULATION_OFF: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off' };
const previousEnv = Object.fromEntries(Object.keys(declared).map((key) => [key, process.env[key]]));
Object.assign(process.env, declared);
const seasonMs = 28 * 86400000;
const epoch = Math.ceil(Date.parse('2026-09-20T12:00:00.000Z') / seasonMs) * seasonMs - 3600000;
const expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
const configuration = { scenario: 'quiet_world', population, seed, hours, sourcePins: WORKER_SOURCE_PINS,
  databaseIsolation: database.descriptor,
  resourceObservation: observeResources ? 'Experimental exact committed-boundary parity with explicit unsupported lineage; serial native queries only' : 'Disabled',
  resourceBootstrap: 'Both original makeDb initializations precede per-commit observation; exact authoritative resource state must agree before/after second bootstrap. Arm before every queued boot job.',
  epoch: new Date(epoch).toISOString(), finish: new Date(epoch + hours * 3600000).toISOString(),
  policy: { dailyActiveActors: Math.floor(population / 10), proposedFraction: .10,
    realizedFraction: Math.floor(population / 10) / population,
    integerConstraint: '25 actors cannot supply 2.5 active identities; choose the lower integer quiet extreme before execution.',
    sessionsPerSelectedActorPerDay: 1, maximumCommandsPerSession: 4, maximumCrimesPerSession: 1,
    information: 'Authorized PlayerCommand snapshots, own canonical character read, and only public crime catalog fields',
    observerFeedback: 'Diagnostic database rows never feed policy choices' },
  entry: 'Synthetic account/character initialization only: schema-default birth resources/stats, zero progression, current canonical season, docks',
  authority: 'Original PlayerCommand dispatcher and withCharacter/readCharacter domains; no HTTP/authentication-session coverage',
  latencySemantics: 'In-process wall durations include test instrumentation; no production latency acceptance is claimed',
  clocks: 'One controller advances application and isolated SQL clocks and executes every due original local worker callback',
  workerOrder: 'Serial accepted callback order; actor session follows the scheduled hourly callback once per rolling day',
  expectedDormant, queryOrder: QUERY_ORDER_SCOPE, deploymentAttested: false,
  excludedIntegrations: ['Unconfigured chain watcher', 'Disabled liquidity automation', 'Unavailable external RWA registry'],
  coverageMissing: ['All 15 archetypes and 225 runs', 'All 13 resource journals at every worker transition',
    'Complete opportunity acceptance/ignored linkage', 'Actor-policy checkpoint continuation and recorded replay',
    'Dead-world reachability proof and failure minimization',
    'Two executions of every longest lifecycle', 'Production-equivalent 12-hour soak', 'HTTP/provider authentication', 'Deployed environment and real cohort'] };
const proof = await createProofRecorder({ directory: output, source, configuration,
  runId: path.basename(output), seed, scenarioId: 'scoped-quiet-world-active-players-and-workers', population });
const runtime = installSerialRuntime(seed, configuration.epoch); let at = epoch;
runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: (value) => { at = value; }, expectedDormant });
const namespace = `rc1_worker_world_${process.pid}_${Math.floor(performance.now())}`;
const base = new pg.Pool({ connectionString: url }), queryOrder = createRecordedQueryOrder({ artifact: proof.artifact });
const diagnosticPool = new pg.Pool({ connectionString: url, max: 1,
  options: `-c search_path=${namespace},pg_catalog -c default_transaction_read_only=on` });
let priorResources, firstResourceError;
const resourceSummary = { boundaries: 0, unsupportedEntries: 0, unsupportedKinds: {}, qualifyingFullResourcePass: false };
const commitObserver = observeResources ? createNativeCommitObserver({
  context: () => currentInvocation || { authority: 'original-worker', logicalAt: at },
  onBoundary: async (event) => {
    if (firstResourceError) throw firstResourceError;
    const after = await snapshotWorldResources(diagnosticPool), before = priorResources;
    try {
      if (['ROLLED_BACK', 'STATEMENT_ABORTED'].includes(event.outcome))
        assert.equal(worldResourceHash(after), worldResourceHash(before), 'Aborted SQL changed committed world resources');
      const journal = reconcileWorldResources(before, after, { identity: event });
      await proof.record({ kind: 'resource-commit-boundary', event, journal });
      resourceSummary.boundaries++;
      for (const unsupported of journal.unsupported) {
        resourceSummary.unsupportedEntries++;
        resourceSummary.unsupportedKinds[unsupported.kind] = (resourceSummary.unsupportedKinds[unsupported.kind] || 0) + 1;
      }
      priorResources = after;
    } catch (error) {
      firstResourceError = error;
      await proof.artifact('first-resource-failure.json', { before, after, event, error: { message: error.message, stack: error.stack } });
      throw error;
    }
  },
}) : null;
const seam = installWorkerInstrumentation(controller, { namespace, queryOrder, commitObserver });
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
const roster = Array.from({ length: population }, (_, index) => `quiet-player-${index}`);
const actorOptions = new Map(roster.map((account) => [account, {}]));
const actorActions = new Map(roster.map((account) => [account, 0]));
const opportunities = observedOpportunityTracker();
const metrics = { playerSnapshots: 0, ownCharacterReads: 0, freshPlayerCommands: 0, legacyCrimeAttempts: 0,
  crimeSuccesses: 0, crimeLosses: 0, exactReplays: 0, denials: {}, sessionWaits: 0, sessions: 0,
  commandTypes: {}, observedAuthorizedOpportunities: 0 };
const days = [], latencies = { read: [], command: [] };
let pool, result, currentInvocation = null, failureInvocation = null;
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
  await proof.record({ kind: 'database-created', ...await database.create() });
  await base.query(`CREATE SCHEMA ${namespace}`);
  const bootstrap = new controller.Pool({ connectionString: url, options: '', max: 20 });
  await seam.clock.initialize(bootstrap); pool = await makeWorkerDatabase(controller);
  for (const account of roster) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [account]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
    await pool.query('INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$3,$4,$5)',
      [`${account}-character`, account, account, Math.floor(epoch / seasonMs), 'docks']);
  }
  const [{ createPlayerCommandEngine }, { coreProgressionContent }, { createConfiguredDirector },
    { readCharacter, withCharacter, doCrime }, { CRIMES }, { runLedgerInvariants }] = await Promise.all([
    import('../src/player-commands.js'), import('../src/content/core-progression.js'), import('../src/director/config.js'),
    import('../src/game.js'), import('../src/rules.js'), import('../src/invariants.js')]);
  // Match the public /v1/rules projection; private rule fields are not policy input.
  const publicCrimes = CRIMES.map(({ id, name, lvl, nerve, cash, base: chance, jail }) => ({ id, name, lvl, nerve, cash, base: chance, jail }));
  const content = coreProgressionContent(), director = createConfiguredDirector(pool, content);
  const engine = createPlayerCommandEngine({ pool, content, director, enabled: true,
    knowledgeEnabled: true, sharingEnabled: true, operationsEnabled: true, discoveryEnabled: true });
  const baseline = await runLedgerInvariants(pool, { alert: false }); assert(baseline.ok, 'Birth fixtures must reconcile without baseline drift');
  await proof.record({ kind: 'measured-initialization', roster, configuration, publicCrimes, fixtureWritesAfterThisRecord: false });
  await proof.snapshot(pool, 'initial'); await proof.checkpoint(pool, 'initial', url);
  if (commitObserver) priorResources = await snapshotWorldResources(diagnosticPool);
  async function invoke(authority, identity, work, latencyClass) {
    currentInvocation = { authority, ...identity, logicalAt: at };
    const started = performance.now();
    try { return await proof.invoke(authority, currentInvocation, work); }
    catch (error) {
      failureInvocation = currentInvocation;
      metrics.denials[error.code || error.name] = (metrics.denials[error.code || error.name] || 0) + 1;
      throw error;
    }
    finally { currentInvocation = null; latencies[latencyClass].push(performance.now() - started); }
  }
  async function invariantBoundary(label) {
    const value = await runLedgerInvariants(pool, { alert: false });
    await proof.record({ kind: 'canonical-invariants', label, logicalAt: at, checks: value.checks });
    assert(value.ok, `Invariant failed after ${label}`);
  }
  async function session(accountId, day) {
    metrics.sessions++;
    let actions = 0;
    for (let action = 0; action < configuration.policy.maximumCommandsPerSession; action++) {
      const view = await invoke('player.snapshot', { accountId, options: actorOptions.get(accountId) },
        () => engine.snapshot(accountId, actorOptions.get(accountId)), 'read');
      metrics.playerSnapshots++; opportunities.observe(accountId, view.opportunities, at);
      metrics.observedAuthorizedOpportunities = opportunities.summarize(at).distinctAuthorizedActorOpportunities;
      const command = chooseAuthorizedCommand(view, { seed, accountId, day, action });
      if (!command) break;
      const executionId = command.executionIdentity.executionId;
      await proof.record({ kind: 'authorized-policy-choice', accountId, day, action,
        commandType: command.commandType, commandId: command.commandId, executionId });
      const response = await invoke('player.execute', { accountId, executionId },
        () => engine.execute(accountId, { executionId, confirmed: true }, executionId), 'command');
      assert.equal(response.status, 'COMPLETED');
      if (response.replayed) metrics.exactReplays++;
      else { metrics.freshPlayerCommands++; actions++; metrics.commandTypes[command.commandType] = (metrics.commandTypes[command.commandType] || 0) + 1; }
      if (command.commandType === 'mystery.start') actorOptions.get(accountId).mysteryGraphId = command.parameters.graphId;
      await invariantBoundary(`player.execute:${accountId}:${executionId}`);
    }
    const own = await invoke('character.read', { accountId }, () => readCharacter(pool, accountId, async () => ({})), 'read');
    metrics.ownCharacterReads++;
    const crime = choosePublicCrime(own.character, publicCrimes, { seed, accountId, day });
    if (crime) {
      const response = await invoke('canonical-crime', { accountId, crimeId: crime.id, approach: 'standard' },
        () => withCharacter(pool, accountId, (ch, client, hooks) => doCrime(ch, crime.id, client, hooks, 'standard')), 'command');
      metrics.legacyCrimeAttempts++; actions++;
      if (response.success === true) metrics.crimeSuccesses++;
      else if (response.success === false) metrics.crimeLosses++;
      else throw Error('Crime response lacks a classified canonical success/loss result');
      await invariantBoundary(`canonical-crime:${accountId}:${day}`);
    }
    if (!actions) metrics.sessionWaits++;
    actorActions.set(accountId, actorActions.get(accountId) + actions);
    await proof.record({ kind: 'actor-session-complete', accountId, day, actions,
      wait: !actions ? { jailSeconds: own.character.jailSeconds, nerve: own.character.nerve,
        classification: 'Observed wait only; no inference that world reachability is proved or disproved' } : null });
  }
  await bootOriginalWorker(controller, { beforeCallbacks: async () => {
    if (!commitObserver) return;
    const after = await snapshotWorldResources(diagnosticPool);
    await proof.artifact('resource-worker-bootstrap.json', { classification: 'Aggregate initialization comparison; not per-commit coverage',
      before: priorResources, after, beforeHash: worldResourceHash(priorResources), afterHash: worldResourceHash(after) });
    assert.equal(worldResourceHash(after), worldResourceHash(priorResources), 'Original worker bootstrap changed authoritative resource state');
    priorResources = after; commitObserver.arm();
  } });
  let lastDay = -1;
  await controller.advanceTo(epoch + hours * 3600000, async (logicalAt, label) => {
    if (label !== 'guardedTick') return;
    const day = Math.floor((logicalAt - epoch) / 86400000);
    if (day === lastDay || day >= Math.ceil(hours / 24)) return;
    lastDay = day;
    const selected = activeQuietRoster(roster, seed, day);
    for (const account of selected) await session(account, day);
    await invariantBoundary(`quiet-day:${day}`);
    const entry = { day, logicalAt, selectedActors: selected, metrics: structuredClone(metrics),
      opportunityObservation: opportunities.summarize(at) };
    days.push(entry); await proof.record({ kind: 'day-summary', ...entry });
    await proof.snapshot(pool, `day-${day}`);
    await proof.artifact(`world-diagnostics-day-${day}.json`, await collectWorldDiagnostics(diagnosticPool,
      { logicalAt: at, roster, actorActions: Object.fromEntries(actorActions) }));
    originalConsole.log(JSON.stringify({ day, sessions: metrics.sessions, commands: metrics.freshPlayerCommands,
      crimes: metrics.legacyCrimeAttempts, actorCoverage: [...actorActions.values()].filter(Boolean).length }));
  });
  await invariantBoundary('final');
  const final = await proof.snapshot(pool, 'final'); await proof.checkpoint(pool, 'final', url);
  const finalDiagnostics = await collectWorldDiagnostics(diagnosticPool,
    { logicalAt: at, roster, actorActions: Object.fromEntries(actorActions) });
  await proof.artifact('world-diagnostics-final.json', finalDiagnostics);
  if (commitObserver) {
    commitObserver.assertComplete(); await proof.artifact('resource-observer.json', { ...resourceSummary, diagnostic: commitObserver.diagnostic() });
  }
  const trace = controller.diagnostic(); assert.equal(trace.failures.length, 0);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary']
    .map((label) => [label, trace.events.filter((entry) => entry.kind === 'timer.fire' && entry.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: hours * 12, guardedTick: hours, guardedSeasonTick: hours, 'health-boundary': hours * 12 });
  const recaps = (await pool.query('SELECT account_id,season FROM season_recaps ORDER BY account_id,season')).rows;
  const expectedRollovers = Math.floor((epoch + hours * 3600000) / seasonMs) - Math.floor(epoch / seasonMs);
  for (const actor of roster) assert.equal(recaps.filter((row) => row.account_id === actor).length, expectedRollovers);
  await proof.artifact('worker-schedule.json', trace); await proof.artifact('query-order.json', await queryOrder.finish());
  await proof.artifact('random-tape.json', { draws: runtime.tape });
  await proof.artifact('player-metrics.json', { days, metrics, latencies, actorActions: Object.fromEntries(actorActions),
    opportunities: opportunities.summarize(at), meaningfulActionDefinition: 'Fresh completed domain PlayerCommands plus canonical crime attempts with committed success or loss; excludes reads/replays/denials' });
  result = { status: 'PASS_SCOPED', hours, population, actualActiveActors: [...actorActions.values()].filter(Boolean).length,
    dailySelectedActors: Math.floor(population / 10), seasonalRolloversPerActor: expectedRollovers, metrics,
    timerCounts, invariantChecks: baseline.checks.length, finalStateSha256: final.stateSha256,
    workerScheduleSha256: trace.scheduleSha256, missingRequiredProof: configuration.coverageMissing,
    worldDiagnosticsSemanticSha256: sha256(canonicalJson(finalDiagnostics.semantic)),
    resourceObservation: observeResources ? resourceSummary : null,
    statement: 'Completed only the declared quiet-world workload; no matrix qualification or dead-world clearance' };
} catch (error) {
  result = { status: 'FAIL', hours, population, metrics, error: error.message, invocation: failureInvocation, logicalAt: at };
  await proof.record({ kind: 'failure', invocation: failureInvocation, logicalAt: at, message: error.message, stack: error.stack });
  await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-random-tape.json', { draws: runtime.tape });
  await proof.artifact('failure-query-order.json', await queryOrder.diagnostic());
  if (commitObserver) await proof.artifact('failure-resource-observer.json', { ...resourceSummary, diagnostic: commitObserver.diagnostic() });
  if (pool) {
    try { await proof.snapshot(pool, 'first-failure'); await proof.checkpoint(pool, 'first-failure', url); }
    catch (captureError) { await proof.record({ kind: 'failure-capture-error', message: captureError.message, stack: captureError.stack }); }
  }
  process.exitCode = 1;
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = originalConsole[level];
  for (const close of [() => commitObserver?.disarm(), () => controller.close(), () => diagnosticPool.end(), () => base.end(),
    async () => proof.record({ kind: 'database-cleanup', ...await database.close() })]) {
    try { await close(); }
    catch (error) { await proof.record({ kind: 'cleanup-failure', message: error.message }); result.status = 'FAIL'; result.cleanupFailure = error.message; process.exitCode = 1; }
  }
  seam.restore(); runtime.restore();
  for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify({ status: result.status, source: source.revision, hours, population, metrics, matrixQualifying: false }));
