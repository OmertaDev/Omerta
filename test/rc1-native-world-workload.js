// Scoped quiet-world integration: authorized actors plus every original local
// worker deadline. It cannot qualify a matrix cell while required metrics,
// resource branches, lifecycle workloads and deployment scope remain incomplete.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { createRecordedQueryOrder, QUERY_ORDER_SCOPE } from '../tools/rc1-native-query-order.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, restoreCheckpoint, canonicalDatabaseSnapshot, canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { createRecordedActors, compareActorReplay, actorValueHash } from '../tools/rc1-native-actor-replay.js';
import { activeQuietRoster, chooseAuthorizedCommand, choosePublicCrime, observedOpportunityTracker } from '../tools/rc1-native-player-policy.js';
import { collectWorldDiagnostics } from '../tools/rc1-world-diagnostics.js';
import { createNativeCommitObserver } from '../tools/rc1-native-commit-observer.js';
import { snapshotWorldResources, reconcileWorldResources, worldResourceHash } from '../tools/rc1-world-resource-observer.js';
import { collectKnowledgeDiagnostics } from '../tools/rc1-knowledge-diagnostics.js';
import { createMysteryPolicy, MYSTERY_POLICY_CONTRACT } from '../tools/rc1-mystery-policies.js';

const argument = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
assert(process.argv.includes('--postgres'), 'Real PostgreSQL is required');
const output = argument('output') || process.env.RC1_WORLD_OUTPUT; assert(output, 'Provide a new restricted output directory');
const observeResources = process.argv.includes('--observe-resources');
const hours = Number(argument('hours') || 2160), population = Number(argument('population') || 25);
assert(Number.isSafeInteger(hours) && hours > 0 && hours <= 2161);
assert([25, 100, 250, 500, 1000].includes(population));
const seed = argument('seed') || 'rc1-alpha'; assert(['rc1-alpha', 'rc1-beta', 'rc1-gamma'].includes(seed));
const actorPolicy = argument('policy') || 'quiet_world';
assert(['quiet_world', 'high_mystery_participation', 'low_mystery_participation'].includes(actorPolicy));
const source = await sourceIdentity(), controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
const replay = argument('replay'), resume = argument('resume');
const injectActorMismatch = process.argv.includes('--inject-actor-input-mismatch');
assert(!injectActorMismatch || replay, 'Actor mismatch control requires recorded replay');
async function readPrior(directory) {
  const run = JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8'));
  await verifyArtifactIndex(directory, run); assert.equal(run.status, 'PASS_SCOPED');
  assert.equal(run.scenarioId, 'scoped-quiet-world-active-players-and-workers');
  assert.equal(run.source.revision, source.revision, 'Actor replay and continuation require exactly the same source');
  assert.equal(run.configuration.population, population); assert.equal(run.configuration.seed, seed);
  assert.equal(run.configuration.actorPolicy, actorPolicy, 'Actor policy differs');
  return run;
}
const replayRun = replay ? await readPrior(replay) : null, parentRun = resume ? await readPrior(resume) : null;
const readArtifact = async (directory, name) => JSON.parse(await fs.readFile(path.join(directory, name), 'utf8'));
const retainedActors = replay ? await readArtifact(replay, 'actor-tape.json') : null;
const retainedOrder = replay ? await readArtifact(replay, 'query-order.json') : null;
const parentCheckpoint = resume ? await readArtifact(resume, 'final-checkpoint.json') : null;
const parentTape = resume ? (await readArtifact(resume, 'random-tape.json')).draws : null;
const parentPolicy = resume ? await readArtifact(resume, 'actor-policy-final.json') : null;
if (resume) {
  assert.equal(parentCheckpoint.stateSha256, parentRun.result.finalStateSha256);
  assert.equal(sha256(canonicalJson(parentTape)), parentRun.result.deterministicRandomTapeSha256);
  assert.equal(sha256(canonicalJson(parentPolicy)), parentRun.result.policyStateSha256);
  assert(/^rc1_worker_world_[a-z_0-9]+$/.test(parentCheckpoint.schema));
}
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
const epoch = resume ? parentPolicy.epoch : Math.ceil(Date.parse('2026-09-20T12:00:00.000Z') / seasonMs) * seasonMs - 3600000;
const start = resume ? Date.parse(parentRun.configuration.finish) : epoch, finish = start + hours * 3600000;
const expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
const configuration = { scenario: 'quiet_world', population, seed, hours, sourcePins: WORKER_SOURCE_PINS,
  actorPolicy, mysteryPolicyContract: actorPolicy === 'quiet_world' ? null : MYSTERY_POLICY_CONTRACT,
  policyScope: 'Only the PlayerCommand selection component changes. Quiet daily roster/session limits stay declared; legacy crimes are independent and excluded from mystery quotas. No full-archetype qualification.',
  knowledgeObservation: 'Complete canonical Knowledge pages at daily/final serial checkpoints; full canonical state equality before/after each observation; never policy feedback',
  failureControl: injectActorMismatch ? 'Change the first authorized snapshot comparison input only; no canonical write or command executes from the altered projection.' : null,
  databaseIsolation: database.descriptor,
  resourceObservation: observeResources ? 'Experimental exact committed-boundary parity with explicit unsupported lineage; serial native queries only' : 'Disabled',
  resourceBootstrap: 'Both original makeDb initializations precede per-commit observation; exact authoritative resource state must agree before/after second bootstrap. Arm before every queued boot job.',
  epoch: new Date(epoch).toISOString(), start: new Date(start).toISOString(), finish: new Date(finish).toISOString(),
  replay: replay ? { runSha256: sha256(await fs.readFile(path.join(replay, 'run.json'))), source: replayRun.source,
    semantics: 'Recorded actor decisions and PostgreSQL subset selection; exact inputs, outcomes and complete state must match.' } : null,
  parentCheckpoint: resume ? { runSha256: sha256(await fs.readFile(path.join(resume, 'run.json'))), source: parentRun.source,
    stateSha256: parentCheckpoint.stateSha256, policyStateSha256: parentRun.result.policyStateSha256,
    semantics: 'Fresh worker boots from exact database, RNG and actor-policy checkpoint. Boot effects retained; no uninterrupted-schedule equivalence.' } : null,
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
    'Complete opportunity acceptance/ignored linkage', 'Actor-policy replay across all archetypes and seeds',
    'Dead-world reachability proof and failure minimization',
    'Two executions of every longest lifecycle', 'Production-equivalent 12-hour soak', 'HTTP/provider authentication', 'Deployed environment and real cohort'] };
if (replay) {
  assert.equal(replayRun.configuration.hours, hours);
  assert.equal(replayRun.configuration.resourceObservation, configuration.resourceObservation);
  assert.deepEqual(replayRun.configuration.parentCheckpoint, configuration.parentCheckpoint, 'Replay continuation parent differs');
}
const proof = await createProofRecorder({ directory: output, source, configuration,
  runId: path.basename(output), seed, scenarioId: 'scoped-quiet-world-active-players-and-workers', population });
const runtime = installSerialRuntime(seed, configuration.start); let at = start;
runtime.bindClock(() => at);
if (resume) runtime.restoreTape(parentTape);
const controller = createWorkerSchedule({ start, setClock: (value) => { at = value; }, expectedDormant });
const namespace = resume ? parentCheckpoint.schema : `rc1_worker_world_${process.pid}_${Math.floor(performance.now())}`;
const base = new pg.Pool({ connectionString: url }), queryOrder = createRecordedQueryOrder({ replay: retainedOrder, replayDirectory: replay, artifact: proof.artifact });
const actors = createRecordedActors({ replay: retainedActors, record: proof.record });
const diagnosticPool = new pg.Pool({ connectionString: url, max: 1,
  options: `-c search_path=${namespace},pg_catalog -c default_transaction_read_only=on` });
let priorResources, firstResourceError;
const resourceSummary = { boundaries: 0, unsupportedEntries: 0, unsupportedKinds: {}, qualifyingFullResourcePass: false };
const resourceStream = crypto.createHash('sha256');
const resourceCost = { observedBoundaryWallMs: 0, maximumBoundaryWallMs: 0, serializedJournalBytes: 0, serializedRestrictedChangeBytes: 0 };
const commitObserver = observeResources ? createNativeCommitObserver({
  context: () => currentInvocation || { authority: 'original-worker', logicalAt: at },
  onBoundary: async (event) => {
    const started = performance.now();
    if (firstResourceError) throw firstResourceError;
    const after = await snapshotWorldResources(diagnosticPool), before = priorResources;
    try {
      if (['ROLLED_BACK', 'STATEMENT_ABORTED'].includes(event.outcome))
        assert.equal(worldResourceHash(after), worldResourceHash(before), 'Aborted SQL changed committed world resources');
      const { restrictedChanges, ...journal } = reconcileWorldResources(before, after, { identity: event, includeRestrictedChanges: true });
      if (restrictedChanges) {
        const artifact = `restricted-resource-change-${String(resourceSummary.boundaries + 1).padStart(7, '0')}.json`;
        await proof.artifact(artifact, { event, restrictedChanges });
        resourceCost.serializedRestrictedChangeBytes += Buffer.byteLength(JSON.stringify({ event, restrictedChanges }));
        journal.restrictedChangesArtifact = artifact;
      }
      await proof.record({ kind: 'resource-commit-boundary', event, journal });
      resourceStream.update(`${canonicalJson({ event, journal })}\n`);
      resourceCost.serializedJournalBytes += Buffer.byteLength(canonicalJson({ event, journal }));
      resourceSummary.boundaries++;
      for (const unsupported of journal.unsupported) {
        resourceSummary.unsupportedEntries++;
        resourceSummary.unsupportedKinds[unsupported.kind] = (resourceSummary.unsupportedKinds[unsupported.kind] || 0) + 1;
      }
      priorResources = after;
      const elapsed = performance.now() - started;
      resourceCost.observedBoundaryWallMs += elapsed; resourceCost.maximumBoundaryWallMs = Math.max(resourceCost.maximumBoundaryWallMs, elapsed);
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
const mysteryPolicies = new Map(actorPolicy === 'quiet_world' ? [] : roster.map((accountId) => [accountId,
  createMysteryPolicy({ scenarioId: actorPolicy, accountId, seed })]));
const opportunities = observedOpportunityTracker();
const metrics = { playerSnapshots: 0, ownCharacterReads: 0, freshPlayerCommands: 0, legacyCrimeAttempts: 0,
  crimeSuccesses: 0, crimeLosses: 0, exactReplays: 0, denials: {}, sessionWaits: 0, sessions: 0,
  commandTypes: {}, observedAuthorizedOpportunities: 0 };
const days = [], latencies = { read: [], command: [] };
const knowledgeBoundaries = [];
let lastDay = -1;
if (resume) {
  assert.equal(parentPolicy.format, 1); assert.equal(parentPolicy.seed, seed); assert.deepEqual(parentPolicy.roster, roster);
  assert.equal(parentPolicy.logicalAt, start); assert(Number.isSafeInteger(parentPolicy.lastDay));
  for (const [name, target] of [['actorOptions', actorOptions], ['actorActions', actorActions]]) {
    assert.deepEqual(Object.keys(parentPolicy[name]).sort(), [...roster].sort());
    for (const [key, value] of Object.entries(parentPolicy[name])) target.set(key, structuredClone(value));
  }
  assert.deepEqual(Object.keys(parentPolicy.metrics).sort(), Object.keys(metrics).sort());
  Object.assign(metrics, structuredClone(parentPolicy.metrics)); opportunities.restore(parentPolicy.opportunities);
  assert.equal(parentPolicy.actorPolicy, actorPolicy);
  assert.deepEqual(Object.keys(parentPolicy.mysteryPolicies).sort(), [...mysteryPolicies.keys()].sort());
  for (const [accountId, policy] of mysteryPolicies) policy.restore(parentPolicy.mysteryPolicies[accountId]);
  days.push(...structuredClone(parentPolicy.days)); lastDay = parentPolicy.lastDay;
}
const mysterySummaries = () => Object.fromEntries([...mysteryPolicies].map(([account, policy]) => [account, policy.summary()]));
const policyState = () => ({ format: 1, seed, actorPolicy, epoch, logicalAt: at, roster, lastDay,
  mysteryPolicies: Object.fromEntries([...mysteryPolicies].map(([account, policy]) => [account, policy.checkpoint()])),
  mysterySummaries: mysterySummaries(),
  actorOptions: Object.fromEntries(actorOptions), actorActions: Object.fromEntries(actorActions),
  metrics, opportunities: opportunities.checkpoint(), days });
let pool, result, currentInvocation = null, failureInvocation = null, injectedActorMismatch = false;
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
  await proof.record({ kind: 'database-created', ...await database.create() });
  if (resume) {
    pool = await restoreCheckpoint(parentCheckpoint, path.join(resume, 'final.dump'), url,
      { poolFactory: seam.clock.poolFactory }); controller.pools.push(pool);
    const restoredClock = (await pool.query('SELECT now() AS tx,clock_timestamp() AS statement')).rows[0];
    assert.equal(restoredClock.tx.getTime(), start); assert.equal(restoredClock.statement.getTime(), start);
  } else {
    await base.query(`CREATE SCHEMA ${namespace}`);
    const bootstrap = new controller.Pool({ connectionString: url, options: '', max: 20 });
    await seam.clock.initialize(bootstrap); pool = await makeWorkerDatabase(controller);
    for (const account of roster) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [account]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
    await pool.query('INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$3,$4,$5)',
      [`${account}-character`, account, account, Math.floor(epoch / seasonMs), 'docks']);
    }
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
  const { createCoordinationService } = await import('../src/coordination/runtime.js');
  const knowledgeService = createCoordinationService({ pool, registry: content.coordinationRegistry,
    prerequisitesEnabled: content.progression === true, enabled: true, knowledgeEnabled: true, sharingEnabled: true, accountIds: [] });
  async function knowledgeBoundary(label, before) {
    const diagnostic = await collectKnowledgeDiagnostics({ roster, serialBoundary: `${label}:${at}`,
      readPage: (accountId, options) => proof.invoke('observer.knowledgeBoard', { accountId, options, logicalAt: at },
        () => knowledgeService.knowledgeBoard(accountId, options)) });
    const after = await canonicalDatabaseSnapshot(pool);
    if (before.stateSha256 !== after.stateSha256) await proof.artifact(`knowledge-${label}-changed-state.json`, after);
    assert.equal(after.stateSha256, before.stateSha256, 'Knowledge observer changed canonical state');
    await proof.artifact(`knowledge-${label}.json`, diagnostic);
    const comparison = { label, logicalAt: at, beforeStateSha256: before.stateSha256, afterStateSha256: after.stateSha256,
      diagnosticSha256: sha256(canonicalJson(diagnostic)) };
    knowledgeBoundaries.push(comparison); await proof.record({ kind: 'knowledge-observer-boundary', ...comparison });
  }
  const baseline = await runLedgerInvariants(pool, { alert: false }); assert(baseline.ok, 'Birth fixtures must reconcile without baseline drift');
  await proof.record({ kind: 'measured-initialization', roster, configuration, publicCrimes, randomDraws: runtime.tape,
    logicalAt: at, restoredCheckpoint: configuration.parentCheckpoint, fixtureWritesAfterThisRecord: false });
  const initial = await proof.snapshot(pool, 'initial'); await proof.checkpoint(pool, 'initial', url);
  if (resume) assert.equal(initial.stateSha256, parentCheckpoint.stateSha256, 'Restart did not restore exact canonical state');
  await proof.artifact('actor-policy-initial.json', policyState());
  const initialRecaps = (await pool.query('SELECT account_id,season FROM season_recaps ORDER BY account_id,season')).rows;
  if (commitObserver) priorResources = await snapshotWorldResources(diagnosticPool);
  async function invoke(authority, identity, work, latencyClass) {
    currentInvocation = { authority, ...identity, logicalAt: at };
    const started = performance.now();
    try {
      const value = await proof.invoke(authority, currentInvocation, work);
      if (injectActorMismatch && !injectedActorMismatch && authority === 'player.snapshot') {
        injectedActorMismatch = true;
        await actors.observe('native-outcome', currentInvocation, { ...value, deliberateSemanticMutation: true });
        throw Error('Actor replay incorrectly accepted the deliberate semantic mutation');
      }
      await actors.observe('native-outcome', currentInvocation, value); return value;
    }
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
      const mysteryPolicy = mysteryPolicies.get(accountId);
      let command;
      if (mysteryPolicy) {
        const chosen = mysteryPolicy.choose(view, { logicalAt: at });
        const decision = await actors.decide('mystery-policy', { actorPolicy, accountId, day, action, logicalAt: at }, view, () => chosen);
        assert.equal(actorValueHash(decision), actorValueHash(chosen), 'Recorded policy decision differs from restored policy state');
        await actors.observe('mystery-policy-pending', { accountId, logicalAt: at }, mysteryPolicy.checkpoint());
        if (decision.kind === 'wait') break;
        command = view.commands.find((candidate) => candidate.commandId === decision.command.commandId
          && candidate.executionIdentity?.executionId === decision.command.executionIdentity.executionId);
        assert(command, 'Mystery policy decision is not currently issued');
      } else command = await actors.decide('authorized-command', { accountId, day, action, logicalAt: at }, view,
        () => chooseAuthorizedCommand(view, { seed, accountId, day, action }));
      if (!command) break;
      assert(view.commands.some((candidate) => candidate.availability === 'AVAILABLE' && actorValueHash(candidate) === actorValueHash(command)),
        'Recorded command is not in the current exact authorized view');
      const executionId = command.executionIdentity.executionId;
      await proof.record({ kind: 'authorized-policy-choice', accountId, day, action,
        commandType: command.commandType, commandId: command.commandId, executionId });
      const response = await invoke('player.execute', { accountId, executionId },
        () => engine.execute(accountId, { executionId, confirmed: true }, executionId), 'command');
      assert.equal(response.status, 'COMPLETED');
      if (mysteryPolicy) {
        mysteryPolicy.settle(response);
        await actors.observe('mystery-policy-settled', { accountId, logicalAt: at }, mysteryPolicy.checkpoint());
      }
      if (response.replayed) metrics.exactReplays++;
      else { metrics.freshPlayerCommands++; actions++; metrics.commandTypes[command.commandType] = (metrics.commandTypes[command.commandType] || 0) + 1; }
      if (command.commandType === 'mystery.start') actorOptions.get(accountId).mysteryGraphId = command.parameters.graphId;
      await invariantBoundary(`player.execute:${accountId}:${executionId}`);
    }
    const own = await invoke('character.read', { accountId }, () => readCharacter(pool, accountId, async () => ({})), 'read');
    metrics.ownCharacterReads++;
    const crime = await actors.decide('public-crime', { accountId, day, logicalAt: at }, { character: own.character, publicCrimes },
      () => choosePublicCrime(own.character, publicCrimes, { seed, accountId, day }));
    if (crime) {
      assert(publicCrimes.some((candidate) => actorValueHash(candidate) === actorValueHash(crime)), 'Recorded crime is not public catalog content');
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
  await controller.advanceTo(finish, async (logicalAt, label) => {
    if (label !== 'guardedTick') return;
    const day = Math.floor((logicalAt - epoch) / 86400000);
    if (day === lastDay || day >= Math.ceil((finish - epoch) / 86400000)) return;
    lastDay = day;
    const selected = await actors.decide('quiet-roster', { day, logicalAt }, roster, () => activeQuietRoster(roster, seed, day));
    assert.equal(selected.length, Math.floor(population / 10)); assert.equal(new Set(selected).size, selected.length);
    assert(selected.every((account) => roster.includes(account)));
    for (const account of selected) await session(account, day);
    await invariantBoundary(`quiet-day:${day}`);
    const entry = { day, logicalAt, selectedActors: selected, metrics: structuredClone(metrics),
      opportunityObservation: opportunities.summarize(at) };
    days.push(entry); await proof.record({ kind: 'day-summary', ...entry });
    const daily = await proof.snapshot(pool, `day-${day}`);
    await knowledgeBoundary(`day-${day}`, daily);
    await proof.artifact(`world-diagnostics-day-${day}.json`, await collectWorldDiagnostics(diagnosticPool,
      { logicalAt: at, roster, actorActions: Object.fromEntries(actorActions) }));
    originalConsole.log(JSON.stringify({ day, sessions: metrics.sessions, commands: metrics.freshPlayerCommands,
      crimes: metrics.legacyCrimeAttempts, actorCoverage: [...actorActions.values()].filter(Boolean).length }));
  });
  await invariantBoundary('final');
  const final = await proof.snapshot(pool, 'final'); await proof.checkpoint(pool, 'final', url);
  await knowledgeBoundary('final', final);
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
  const expectedRollovers = Math.floor(finish / seasonMs) - Math.floor(start / seasonMs);
  for (const actor of roster) assert.equal(recaps.filter((row) => row.account_id === actor).length - initialRecaps.filter((row) => row.account_id === actor).length, expectedRollovers);
  await proof.artifact('worker-schedule.json', trace); await proof.artifact('query-order.json', await queryOrder.finish());
  await proof.artifact('random-tape.json', { draws: runtime.tape });
  const actorTape = actors.finish(), finalPolicy = policyState();
  await proof.artifact('actor-tape.json', actorTape); await proof.artifact('actor-policy-final.json', finalPolicy);
  await proof.artifact('knowledge-boundaries.json', knowledgeBoundaries);
  await proof.artifact('player-metrics.json', { days, metrics, latencies, actorActions: Object.fromEntries(actorActions),
    opportunities: opportunities.summarize(at), meaningfulActionDefinition: 'Fresh completed domain PlayerCommands plus canonical crime attempts with committed success or loss; excludes reads/replays/denials' });
  result = { status: 'PASS_SCOPED', hours, population, seed, actorPolicy, mysteryPolicySummaries: mysterySummaries(),
    actualActiveActors: [...actorActions.values()].filter(Boolean).length,
    dailySelectedActors: Math.floor(population / 10), seasonalRolloversPerActor: expectedRollovers, metrics,
    timerCounts, invariantChecks: baseline.checks.length, initialStateSha256: initial.stateSha256, finalStateSha256: final.stateSha256,
    workerScheduleSha256: trace.scheduleSha256, missingRequiredProof: configuration.coverageMissing,
    jobOutcomesSha256: sha256(canonicalJson(trace.jobs)), deterministicRandomTapeSha256: sha256(canonicalJson(runtime.tape)),
    actorTapeSha256: actorTape.entriesSha256, policyStateSha256: sha256(canonicalJson(finalPolicy)),
    mysteryPolicySummarySha256: sha256(canonicalJson(mysterySummaries())), knowledgeDiagnosticsSha256: sha256(canonicalJson(knowledgeBoundaries)),
    semanticMetricsSha256: sha256(canonicalJson({ days, metrics, actorActions: Object.fromEntries(actorActions), opportunities: opportunities.summarize(at) })),
    checkpointRestart: !!resume, recordedActorAndSelectionReplay: !!replay,
    worldDiagnosticsSemanticSha256: sha256(canonicalJson(finalDiagnostics.semantic)),
    resourceObservationEnabled: observeResources, resourceJournalCount: resourceSummary.boundaries,
    resourceJournalSha256: observeResources ? resourceStream.copy().digest('hex') : null,
    resourceObservation: observeResources ? resourceSummary : null,
    statement: 'Completed only the declared quiet-world workload; no matrix qualification or dead-world clearance' };
  if (replay) result.replayComparison = compareActorReplay(result, replayRun.result);
  await proof.record({ kind: 'assertions', ...result });
} catch (error) {
  result = { status: 'FAIL', hours, population, metrics, error: error.message, invocation: failureInvocation, logicalAt: at };
  await proof.record({ kind: 'failure', invocation: failureInvocation, logicalAt: at, message: error.message, stack: error.stack });
  await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-random-tape.json', { draws: runtime.tape });
  await proof.artifact('failure-actor-tape.json', actors.diagnostic());
  await proof.artifact('failure-actor-policy.json', policyState());
  await proof.artifact('failure-query-order.json', await queryOrder.diagnostic());
  if (commitObserver) await proof.artifact('failure-resource-observer.json', { capturedAt: 'First failure, before diagnostic state capture', ...resourceSummary, diagnostic: commitObserver.diagnostic() });
  if (pool) {
    try { await proof.snapshot(pool, 'first-failure'); await proof.checkpoint(pool, 'first-failure', url); }
    catch (captureError) { await proof.record({ kind: 'failure-capture-error', message: captureError.message, stack: captureError.stack }); }
  }
  process.exitCode = 1;
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = originalConsole[level];
  for (const close of [async () => {
    if (!commitObserver) return;
    try { commitObserver.disarm(); }
    finally { await proof.artifact('resource-observer-final.json', { capturedAt: 'After diagnostic state capture, before cleanup', ...resourceSummary,
      resourceJournalSha256: resourceStream.copy().digest('hex'),
      cost: { ...resourceCost, logicalHours: (at - start) / 3600000,
        note: 'Measured native snapshot/reconciliation/artifact overhead only; linear projection is not a capacity guarantee. Every required boundary retained.' }, diagnostic: commitObserver.diagnostic() }); }
  }, () => controller.close(), () => diagnosticPool.end(), () => base.end(),
    async () => proof.record({ kind: 'database-cleanup', ...await database.close() })]) {
    try { await close(); }
    catch (error) { await proof.record({ kind: 'cleanup-failure', message: error.message }); result.status = 'FAIL'; result.cleanupFailure = error.message; process.exitCode = 1; }
  }
  seam.restore(); runtime.restore();
  for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify({ status: result.status, source: source.revision, hours, population, metrics, matrixQualifying: false }));
