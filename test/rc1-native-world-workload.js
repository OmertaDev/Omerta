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
import { CAR_MELT_SOURCE_PINS } from '../tools/rc1-car-melt-provenance.js';
import { createNpcCarAcquisitionCommitObserver, NPC_CAR_SOURCE_PINS } from '../tools/rc1-npc-car-acquisition.js';
import { collectKnowledgeDiagnostics } from '../tools/rc1-knowledge-diagnostics.js';
import { createMysteryPolicy, MYSTERY_POLICY_CONTRACT } from '../tools/rc1-mystery-policies.js';
import { createRunGuardrails } from '../tools/rc1-native-run-guardrails.js';
import { createAllianceWorldAdapter, ALLIANCE_WORLD_CONTRACT } from '../tools/rc1-alliance-world-adapter.js';
import { assertAllianceContinuation, assertAllianceApplicationBootstrap, compareAllianceStates } from '../tools/rc1-alliance-continuation.js';
import { parseWorldHistoryStorage, assertWorldHistoryStorage, retainWorldFailure } from '../tools/rc1-world-history-storage.js';

const argument = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
assert(process.argv.includes('--postgres'), 'Real PostgreSQL is required');
const output = argument('output') || process.env.RC1_WORLD_OUTPUT; assert(output, 'Provide a new restricted output directory');
const observeResources = process.argv.includes('--observe-resources');
const historyStorage = parseWorldHistoryStorage(process.argv.slice(2));
const hours = Number(argument('hours') || 2160), population = Number(argument('population') || 25);
assert(Number.isSafeInteger(hours) && hours > 0 && hours <= 2161);
assert([25, 100, 250, 500, 1000].includes(population));
const guardArguments = ['max-wall-ms', 'max-output-bytes', 'min-free-bytes'].map(argument);
assert(guardArguments.every(value => value === undefined) || guardArguments.every(value => value !== undefined), 'Declare all three operational limits together');
assert(hours <= 48 || guardArguments.every(value => value !== undefined), 'Long runs require explicit operational guardrails');
const guardLimits = guardArguments[0] === undefined ? null : {
  maximumWallMs: Number(guardArguments[0]), maximumOutputBytes: Number(guardArguments[1]), minimumFreeBytes: Number(guardArguments[2]),
};
const seed = argument('seed') || 'rc1-alpha'; assert(['rc1-alpha', 'rc1-beta', 'rc1-gamma'].includes(seed));
const actorPolicy = argument('policy') || 'quiet_world';
assert(['quiet_world', 'high_mystery_participation', 'low_mystery_participation', 'coordinated_alliance'].includes(actorPolicy));
const allianceEnabled = actorPolicy === 'coordinated_alliance';
const scenarioId = allianceEnabled ? 'scoped-coordinated-alliance-world' : 'scoped-quiet-world-active-players-and-workers';
if (allianceEnabled) {
  assert.equal(population, 25, 'Alliance adapter currently supports the declared 25-actor cohort only');
  assert([24, 48].includes(hours), 'Alliance adapter supports a 24-hour checkpoint or 48-hour observation');
}
const source = await sourceIdentity(), controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
const priorFailureDirectory = argument('prior-failure');
let priorFailure = null;
if (priorFailureDirectory) {
  const bytes = await fs.readFile(path.join(priorFailureDirectory, 'run.json'));
  const run = JSON.parse(bytes); await verifyArtifactIndex(priorFailureDirectory, run); assert.equal(run.status, 'FAIL');
  priorFailure = { directory: path.resolve(priorFailureDirectory), source: run.source, runSha256: sha256(bytes),
    status: run.status, error: run.result.error, artifacts: run.artifacts };
}
const replay = argument('replay'), resume = argument('resume');
const comparisonDirectory = argument('compare-uninterrupted');
assert(!comparisonDirectory || (allianceEnabled && resume), 'Uninterrupted comparison requires alliance continuation');
const injectActorMismatch = process.argv.includes('--inject-actor-input-mismatch');
assert(!injectActorMismatch || replay, 'Actor mismatch control requires recorded replay');
async function readPrior(directory) {
  const run = JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8'));
  await verifyArtifactIndex(directory, run); assert.equal(run.status, 'PASS_SCOPED');
  assert.equal(run.scenarioId, scenarioId);
  assert.equal(run.source.revision, source.revision, 'Actor replay and continuation require exactly the same source');
  assert.equal(run.configuration.population, population); assert.equal(run.configuration.seed, seed);
  assert.equal(run.configuration.actorPolicy, actorPolicy, 'Actor policy differs');
  assertWorldHistoryStorage(run, historyStorage);
  return run;
}
const replayRun = replay ? await readPrior(replay) : null, parentRun = resume ? await readPrior(resume) : null;
const comparisonRun = comparisonDirectory ? await readPrior(comparisonDirectory) : null;
const readArtifact = async (directory, name) => JSON.parse(await fs.readFile(path.join(directory, name), 'utf8'));
const retainedActors = replay ? await readArtifact(replay, 'actor-tape.json') : null;
const retainedOrder = replay ? await readArtifact(replay, 'query-order.json') : null;
const checkpointLabel = allianceEnabled ? 'alliance-hour24' : 'final';
const parentContinuation = resume && allianceEnabled ? await readArtifact(resume, 'alliance-hour24-continuation.json') : null;
const parentCheckpoint = resume ? await readArtifact(resume, checkpointLabel + '-checkpoint.json') : null;
const parentTape = resume ? (await readArtifact(resume, allianceEnabled ? 'alliance-hour24-random-tape.json' : 'random-tape.json')).draws : null;
const parentPolicy = resume ? await readArtifact(resume, allianceEnabled ? 'alliance-hour24-policy.json' : 'actor-policy-final.json') : null;
if (resume) {
  const parentBoundary = parentContinuation || parentRun.result;
  assert.equal(parentCheckpoint.stateSha256, parentBoundary.finalStateSha256);
  assert.equal(sha256(canonicalJson(parentTape)), parentBoundary.deterministicRandomTapeSha256);
  assert.equal(sha256(canonicalJson(parentPolicy)), parentBoundary.policyStateSha256);
  assert(/^rc1_worker_world_[a-z_0-9]+$/.test(parentCheckpoint.schema));
  if (allianceEnabled) assertAllianceContinuation({ source, parentRun, parentPolicy, parentCheckpoint, seed, population,
    parentContinuation, observeResources, hours, guardLimits });
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
if (allianceEnabled) Object.assign(declared, { RATE_LIMIT: 'off', INVITE_MODE: 'off', SOCIAL_VERIFY_MODE: 'off',
  JWT_SECRET: sha256('rc1-isolated-alliance-world-jwt:' + seed), MARKET_SEED: sha256('rc1-isolated-alliance-market:' + seed),
  MOD_KEY: sha256('rc1-isolated-alliance-mod:' + seed) });
const previousEnv = Object.fromEntries(Object.keys(declared).map((key) => [key, process.env[key]]));
Object.assign(process.env, declared);
const seasonMs = 28 * 86400000;
const epoch = resume ? parentPolicy.epoch : Math.ceil(Date.parse('2026-09-20T12:00:00.000Z') / seasonMs) * seasonMs - 3600000;
const start = resume ? parentPolicy.logicalAt : epoch, finish = start + hours * 3600000;
const expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
const configuration = { scenario: 'quiet_world', population, seed, hours, sourcePins: WORKER_SOURCE_PINS,
  ...(historyStorage ? { historyStorage } : {}),
  actorPolicy, mysteryPolicyContract: actorPolicy.includes('mystery') ? MYSTERY_POLICY_CONTRACT : null,
  priorFailedRun: priorFailure ? { directory: priorFailure.directory, source: priorFailure.source,
    runSha256: priorFailure.runSha256, status: priorFailure.status, error: priorFailure.error,
    semantics: 'Retained failed predecessor, not qualifying evidence and not relabeled as this source.' } : null,
  guardrails: guardLimits ? { ...guardLimits,
    cadence: 'Wall time after every completed native callback; output/free space before initialization, hourly, daily and final. A running callback retains the existing 60-second deadline.',
    overflow: 'FAIL with diagnostics and cleanup; no skipped work or pass. A single callback/artifact may exceed a checked limit before the next quiescent check. Final verification/cleanup are retained beyond execution limits.' } : null,
  policyScope: 'Only the PlayerCommand selection component changes. Quiet daily roster/session limits stay declared; legacy crimes are independent and excluded from mystery quotas. No full-archetype qualification.',
  knowledgeObservation: 'Complete canonical Knowledge pages at daily/final serial checkpoints; full canonical state equality before/after each observation; never policy feedback',
  failureControl: injectActorMismatch ? 'Change the first authorized snapshot comparison input only; no canonical write or command executes from the altered projection.' : null,
  databaseIsolation: database.descriptor,
  resourceObservation: observeResources ? 'Experimental exact committed-boundary parity with explicit unsupported lineage; serial native queries only' : 'Disabled',
  carMeltWitness: observeResources ? { format: 1, sourcePins: CAR_MELT_SOURCE_PINS,
    scope: 'Native COMMIT provenance for neutral solo human melt only. Retain full car-deletion/melt-candidate and bounded-overflow witnesses privately; all other commits keep ordinary resource evidence. No added actor actions or grants.' } : null,
  npcCarAcquisitionWitness: observeResources ? { format: 1, sourcePins: NPC_CAR_SOURCE_PINS,
    scope: 'Same bounded native transaction witness, annotated with actual source caller frames. Exact default runPopulation NPC car grant only; all other acquisition branches remain unknown.' } : null,
  resourceBootstrap: 'Both original makeDb initializations precede per-commit observation; exact authoritative resource state must agree before/after second bootstrap. Arm before every queued boot job.',
  epoch: new Date(epoch).toISOString(), start: new Date(start).toISOString(), finish: new Date(finish).toISOString(),
  replay: replay ? { runSha256: sha256(await fs.readFile(path.join(replay, 'run.json'))), source: replayRun.source,
    semantics: 'Recorded actor decisions and PostgreSQL subset selection; exact inputs, outcomes and complete state must match.' } : null,
  parentCheckpoint: resume ? { runSha256: sha256(await fs.readFile(path.join(resume, 'run.json'))), source: parentRun.source,
    stateSha256: parentCheckpoint.stateSha256, policyStateSha256: parentContinuation?.policyStateSha256 || parentRun.result.policyStateSha256,
    ...(allianceEnabled ? { checkpointLabel, logicalAt: start } : {}),
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
if (allianceEnabled) Object.assign(configuration, {
  scenario: actorPolicy, allianceContract: ALLIANCE_WORLD_CONTRACT,
  policyScope: 'Three independent Family contributors plus 22 ordinary outsiders; explicit hour-0/hour-24 schedule. All 25 receive both daily crime sessions. Original independent Knowledge grants alone authorize conclusions.',
  policy: { dailyActiveActors: 25, proposedFraction: 1, realizedFraction: 1, sessionsPerSelectedActorPerDay: 1,
    maximumCommandsPerSession: 0, maximumCrimesPerSession: 1,
    information: 'Own authenticated session/me, public rules/Family directory, own diplomacy, Coordination and visible Knowledge/issued targets',
    observerFeedback: 'No diagnostic rows feed policy choices' },
  entry: '25 ordinary guest/character HTTP entries. Three initialization-only level-75 respect fixtures; zero other progression/resource/membership/ACL fixtures. All check-ins and Family formation occur after measured baseline.',
  authority: 'Alliance requests use ordinary authenticated HTTP routes; daily crimes retain the existing canonical withCharacter domain and public own-character reads. External authentication providers remain excluded.',
  workerOrder: 'Serial original callbacks; hour-0 work follows startup. Hour-24 work follows all callbacks due at that boundary. A 24-hour initial segment pauses with the first conclusion request selected but undispatched; continuation runs real startup callbacks before dispatch.',
  httpConfiguration: 'Local deterministic test secrets; rate limit/invite/social gates off. This is not production HTTP capacity or admission qualification.',
  continuation: { version: 1, mode: resume ? 'restored-continuation' : hours === 24 ? 'pending-checkpoint' : 'uninterrupted',
    originalStartupJobs: 'Always executed in each fresh process; no scheduler state transplant or omitted callbacks',
    comparisonRunSha256: comparisonRun ? sha256(await fs.readFile(path.join(comparisonDirectory, 'run.json'))) : null },
});
if (replay) {
  assert.equal(replayRun.configuration.hours, hours);
  assert.equal(replayRun.configuration.resourceObservation, configuration.resourceObservation);
  assert.deepEqual(replayRun.configuration.carMeltWitness, configuration.carMeltWitness);
  assert.deepEqual(replayRun.configuration.npcCarAcquisitionWitness, configuration.npcCarAcquisitionWitness);
  assert.deepEqual(replayRun.configuration.guardrails, configuration.guardrails, 'Replay operational limits differ');
  assert.deepEqual(replayRun.configuration.priorFailedRun, configuration.priorFailedRun, 'Replay predecessor linkage differs');
  assert.deepEqual(replayRun.configuration.parentCheckpoint, configuration.parentCheckpoint, 'Replay continuation parent differs');
  if (allianceEnabled) assert.deepEqual(replayRun.configuration.continuation, configuration.continuation);
}
const proof = await createProofRecorder({ directory: output, source, configuration,
  runId: path.basename(output), seed, scenarioId, population, ...(historyStorage ? { historyStorage } : {}) });
const guardrails = guardLimits ? createRunGuardrails({ directory: output, ...guardLimits }) : null;
const guardBoundary = async label => { if (guardrails) await proof.record({ kind: 'operational-guard-check', ...await guardrails.check(label) }); };
const runtime = installSerialRuntime(seed, configuration.start); let at = start;
runtime.bindClock(() => at);
if (resume) runtime.restoreTape(parentTape);
const controller = createWorkerSchedule({ start, setClock: (value) => { at = value; }, expectedDormant });
const namespace = resume ? parentCheckpoint.schema : `rc1_worker_world_${process.pid}_${Math.floor(performance.now())}`;
const base = new pg.Pool({ connectionString: url }), queryOrder = createRecordedQueryOrder({ replay: retainedOrder, replayDirectory: replay, artifact: proof.artifact });
const actors = createRecordedActors({ replay: retainedActors, record: proof.record });
const diagnosticPool = new pg.Pool({ connectionString: url, max: 1,
  options: `-c search_path=${namespace},pg_catalog -c default_transaction_read_only=on` });
let snapshotWorldResources, reconcileWorldResources, worldResourceHash;
let priorResources, firstResourceError, workPhase = 'initialization';
const resourceSummary = { boundaries: 0, unsupportedEntries: 0, unsupportedKinds: {}, qualifyingFullResourcePass: false };
const carMeltWitnessSummary = { committedWitnesses: 0, retainedCandidateWitnesses: 0, collectorUnsupportedWitnesses: 0,
  exactMeltTransitions: 0, unclassifiedCandidateBoundaries: 0 };
const carAcquisitionWitnessSummary = { retainedCandidateWitnesses: 0, exactAcquisitions: 0, unclassifiedCandidateBoundaries: 0 };
const resourceStream = crypto.createHash('sha256');
const resourceCost = { observedBoundaryWallMs: 0, maximumBoundaryWallMs: 0, serializedJournalBytes: 0, serializedRestrictedChangeBytes: 0 };
// BEGIN source-bound car witness integration control.
const commitObserver = observeResources ? createNpcCarAcquisitionCommitObserver({
  context: () => currentInvocation || { authority: 'original-worker', logicalAt: at, ...(allianceEnabled ? { workPhase } : {}) },
  onBoundary: async (event, carMeltProvenance = null) => {
    const started = performance.now();
    if (firstResourceError) throw firstResourceError;
    const after = await snapshotWorldResources(diagnosticPool), before = priorResources;
    try {
      if (['ROLLED_BACK', 'STATEMENT_ABORTED'].includes(event.outcome))
        assert.equal(worldResourceHash(after), worldResourceHash(before), 'Aborted SQL changed committed world resources');
      if (carMeltProvenance) carMeltWitnessSummary.committedWitnesses++;
      // Keep unknown/overflow scopes explicit. Only original executed SQL can
      // select a candidate; a request label or actor-supplied claim cannot.
      const retainedWitness = carMeltProvenance && (carMeltProvenance.unsupported || carMeltProvenance.queries.some(query =>
        /^\s*DELETE\s+FROM\s+cars\b/i.test(query.sql)
        || /^\s*INSERT\s+INTO\s+transactions\b/i.test(query.sql) && /^melt(?::|$)/.test(String(query.parameters[5] || ''))))
        ? carMeltProvenance : null;
      const acquisitionWitness = carMeltProvenance?.queries.some(query => /^\s*INSERT\s+INTO\s+cars\b/i.test(query.sql))
        ? carMeltProvenance : null;
      const { restrictedChanges, ...journal } = reconcileWorldResources(before, after,
        { identity: event, includeRestrictedChanges: true, carMeltProvenance: retainedWitness, carAcquisitionProvenance: acquisitionWitness });
      if (retainedWitness) {
        const artifact = `restricted-car-melt-witness-${String(resourceSummary.boundaries + 1).padStart(7, '0')}.json`;
        await proof.artifact(artifact, { event, carMeltProvenance: retainedWitness });
        journal.carMeltWitness = { artifact, sha256: sha256(canonicalJson(retainedWitness)) };
        carMeltWitnessSummary.retainedCandidateWitnesses++;
        if (retainedWitness.unsupported) carMeltWitnessSummary.collectorUnsupportedWitnesses++;
        const exact = journal.cars.lineage.filter(row => row.kind === 'exact-solo-melt-sink').length;
        carMeltWitnessSummary.exactMeltTransitions += exact;
        if (!exact) carMeltWitnessSummary.unclassifiedCandidateBoundaries++;
      }
      if (acquisitionWitness) {
        const artifact = `restricted-car-acquisition-witness-${String(resourceSummary.boundaries + 1).padStart(7, '0')}.json`;
        await proof.artifact(artifact, { event, carAcquisitionProvenance: acquisitionWitness });
        journal.carAcquisitionWitness = { artifact, sha256: sha256(canonicalJson(acquisitionWitness)) };
        carAcquisitionWitnessSummary.retainedCandidateWitnesses++;
        const exact = journal.cars.lineage.filter(row => row.kind === 'exact-npc-spawn-car-source').length;
        carAcquisitionWitnessSummary.exactAcquisitions += exact;
        if (!exact) carAcquisitionWitnessSummary.unclassifiedCandidateBoundaries++;
      }
      if (restrictedChanges) {
        const artifact = `restricted-resource-change-${String(resourceSummary.boundaries + 1).padStart(7, '0')}.json`;
        await proof.artifact(artifact, { event, restrictedChanges });
        resourceCost.serializedRestrictedChangeBytes += Buffer.byteLength(JSON.stringify({ event, restrictedChanges }));
        journal.restrictedChangesArtifact = artifact;
      }
      await proof.record({ kind: 'resource-commit-boundary', event, journal });
      const serializedJournal = canonicalJson({ event, journal });
      resourceStream.update(`${serializedJournal}\n`);
      resourceCost.serializedJournalBytes += Buffer.byteLength(serializedJournal);
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
      await proof.artifact('first-resource-failure.json', { before, after, event, carMeltProvenance, error: { message: error.message, stack: error.stack } });
      throw error;
    }
  },
}) : null;
// END source-bound car witness integration control.
const seam = installWorkerInstrumentation(controller, { namespace, queryOrder, commitObserver });
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
const roster = allianceEnabled ? [] : Array.from({ length: population }, (_, index) => `quiet-player-${index}`);
const actorOptions = new Map(roster.map((account) => [account, {}]));
const actorActions = new Map(roster.map((account) => [account, 0]));
const mysteryPolicies = new Map(!actorPolicy.includes('mystery') ? [] : roster.map((accountId) => [accountId,
  createMysteryPolicy({ scenarioId: actorPolicy, accountId, seed })]));
const opportunities = observedOpportunityTracker();
const metrics = { playerSnapshots: 0, ownCharacterReads: 0, freshPlayerCommands: 0, legacyCrimeAttempts: 0,
  crimeSuccesses: 0, crimeLosses: 0, exactReplays: 0, denials: {}, sessionWaits: 0, sessions: 0,
  commandTypes: {}, observedAuthorizedOpportunities: 0 };
const days = [], latencies = { read: [], command: [] };
const knowledgeBoundaries = [];
const allianceActors = [];
let allianceAdapter = null, app = null;
const responseCompletions = new Map(); let responseSequence = 0;
let lastDay = -1;
if (resume) {
  if (allianceEnabled) {
    allianceActors.push(...structuredClone(parentPolicy.allianceActors)); roster.push(...parentPolicy.roster);
    responseSequence = parentPolicy.nativeBoundary.responseSequence;
    allianceAdapter = createAllianceWorldAdapter({ seed, roster: allianceActors }).restore(parentPolicy.allianceAdapter);
  }
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
  ...(allianceEnabled ? { allianceAdapter: allianceAdapter?.checkpoint() || null, allianceActors,
    nativeBoundary: { responseSequence, pendingResponses: responseCompletions.size, invocationPending: !!currentInvocation } } : {}),
  mysteryPolicies: Object.fromEntries([...mysteryPolicies].map(([account, policy]) => [account, policy.checkpoint()])),
  mysterySummaries: mysterySummaries(),
  actorOptions: Object.fromEntries(actorOptions), actorActions: Object.fromEntries(actorActions),
  metrics, opportunities: opportunities.checkpoint(), days });
let pool, result, currentInvocation = null, failureInvocation = null, injectedActorMismatch = false;
let restoredState = null, applicationBootstrap = null;
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
  // The observer imports canonical check-in rules through game.js -> db.js.
  // Install the source-pinned DB seam before loading that production module.
  ({ snapshotWorldResources, reconcileWorldResources, worldResourceHash } = await import('../tools/rc1-world-resource-observer.js'));
  if (priorFailure) await proof.artifact('prior-failed-run.json', priorFailure);
  await guardBoundary('before-initialization');
  await proof.record({ kind: 'database-created', ...await database.create() });
  if (resume) {
    pool = await restoreCheckpoint(parentCheckpoint, path.join(resume, checkpointLabel + '.dump'), url,
      { poolFactory: seam.clock.poolFactory }); controller.pools.push(pool);
    const restoredClock = (await pool.query('SELECT now() AS tx,clock_timestamp() AS statement')).rows[0];
    assert.equal(restoredClock.tx.getTime(), start); assert.equal(restoredClock.statement.getTime(), start);
    if (allianceEnabled) restoredState = await proof.snapshot(pool, 'restored-before-application-bootstrap');
  } else {
    await base.query(`CREATE SCHEMA ${namespace}`);
    const bootstrap = new controller.Pool({ connectionString: url, options: '', max: 20 });
    await seam.clock.initialize(bootstrap);
  }
    if (allianceEnabled) {
      const { buildServer } = await import('../src/server.js'); app = await buildServer(); pool = app.pool;
      // inject can resolve at response delivery before original onResponse
      // hooks finish their native queries. Retain all original hooks and
      // wait for their completion before the next serial observed query.
      app.addHook('onResponse', async req => {
        const key = req.headers['x-rc1-response-completion'];
        const complete = responseCompletions.get(key); assert(complete, 'Untracked alliance response');
        responseCompletions.delete(key); complete();
      });
      if (resume) {
        const after = await proof.snapshot(pool, 'after-application-bootstrap');
        applicationBootstrap = assertAllianceApplicationBootstrap(restoredState, after, at);
        await proof.artifact('alliance-application-bootstrap.json', applicationBootstrap);
      } else {
      const { PACING } = await import('../src/rules.js'), grants = [];
      for (let index = 0; index < population; index++) {
        const name = 'World Alliance Entry ' + index, bootstrapSecret = crypto.randomBytes(32).toString('base64url');
        const guest = await http(null, { method: 'POST', path: '/v1/auth/guest', body: { bootstrapSecret } });
        assert.equal(guest.status, 200, JSON.stringify(guest));
        const actor = { name, accountId: app.jwt.verify(guest.body.token).sub, token: guest.body.token };
        const entry = await http(actor, { method: 'POST', path: '/v1/character', body: { name }, idempotencyKey: 'alliance-entry-' + index });
        assert.equal(entry.status, 200, JSON.stringify(entry)); actor.characterId = entry.body.id;
        allianceActors.push(actor); roster.push(actor.accountId); actorOptions.set(actor.accountId, {}); actorActions.set(actor.accountId, 0);
        await proof.artifact('alliance-entry-' + index + '.json', { bootstrapSecret, ...actor });
        if (index < 3) {
          const before = (await pool.query('SELECT id,respect,cash,bank,ammo,loc FROM characters WHERE id=$1', [actor.characterId])).rows[0];
          const respect = PACING.LEVEL_DIVISOR * 74 ** 2;
          await pool.query('UPDATE characters SET respect=$2 WHERE id=$1', [actor.characterId, respect]);
          grants.push({ accountId: actor.accountId, before, after: { respect }, classification: 'Initialization-only lawful founder progression fixture' });
        }
      }
      await proof.artifact('alliance-initialization.json', { actors: allianceActors.map(({ token: _token, ...actor }) => actor),
        grants, ordinaryUnmodifiedOutsiders: 22, directOtherFixtures: 0, fixtureWritesAfterBaseline: false });
      allianceAdapter = createAllianceWorldAdapter({ seed, roster: allianceActors });
      }
    } else if (!resume) pool = await makeWorkerDatabase(controller);
    for (const account of allianceEnabled || resume ? [] : roster) {
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
  if (resume) assert.equal(initial.stateSha256, allianceEnabled ? applicationBootstrap.afterStateSha256 : parentCheckpoint.stateSha256,
    'Measured state differs from the recorded restore/bootstrap boundary');
  await proof.artifact('actor-policy-initial.json', policyState());
  const initialRecaps = (await pool.query('SELECT account_id,season FROM season_recaps ORDER BY account_id,season')).rows;
  if (commitObserver) {
    priorResources = await snapshotWorldResources(diagnosticPool);
    if (parentContinuation) assert.equal(worldResourceHash(priorResources), parentContinuation.resourceStateSha256,
      'Restored resource state differs from recorded checkpoint');
  }
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
  async function http(actor, request) {
    return invoke('ordinary-http', { accountId: actor?.accountId || null, ...request }, async () => {
      const completionKey = String(++responseSequence);
      let timer;
      const completed = new Promise((resolve, reject) => {
        responseCompletions.set(completionKey, resolve);
        timer = setTimeout(() => reject(Error('Original HTTP response hooks did not complete within 60 seconds')), 60000);
      });
      // Attach rejection handling before inject can spend time in native work.
      completed.catch(() => {});
      let r;
      try {
      r = await app.inject({ method: request.method, url: request.path,
        headers: { 'x-rc1-response-completion': completionKey, ...(actor ? { authorization: 'Bearer ' + actor.token } : {}),
          ...(request.idempotencyKey ? { 'idempotency-key': request.idempotencyKey } : {}) },
        ...(request.body === undefined ? {} : { payload: request.body }) });
      await completed;
      } finally { clearTimeout(timer); }
      const body = r.json(); return { status: r.statusCode,
        replayed: r.headers['x-idempotent-replay'] === 'true' || body.replayed === true, body };
    }, request.method === 'GET' ? 'read' : 'command');
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
  async function allianceDay(day, pauseBeforeDispatch = false) {
    const selected = await actors.decide('alliance-roster', { day, logicalAt: at }, roster, () => allianceAdapter.roster(day));
    assert.deepEqual(selected, roster);
    const actorFor = accountId => { const actor = allianceActors.find(a => a.accountId === accountId); assert(actor); return actor; };
    const execute = async (accountId, request) => {
      const response = await http(actorFor(accountId), request);
      await invariantBoundary(`alliance:${accountId}:${request.idempotencyKey}`);
      if (response.status === 200 && !response.replayed) actorActions.set(accountId, actorActions.get(accountId) + 1);
      if (response.replayed) metrics.exactReplays++;
      return response;
    };
    const stage = await allianceAdapter.runStage(day, { logicalAt: at, pauseBeforeDispatch,
      read: async (accountId, path, expected = 200) => {
        const response = await http(actorFor(accountId), { method: 'GET', path });
        assert.equal(response.status, expected, JSON.stringify(response)); return response.body;
      }, execute,
      decision: async (identity, view, chosen) => {
        const recorded = await actors.decide('alliance-policy', identity, view, () => chosen);
        assert.equal(actorValueHash(recorded), actorValueHash(chosen), 'Restored alliance decision differs');
      },
      checkpoint: (phase, checkpoint) => actors.observe('alliance-policy-' + phase, { day, logicalAt: at }, checkpoint),
      retry: async (accountId, request) => {
        const before = await canonicalDatabaseSnapshot(pool), response = await execute(accountId, request);
        assert.equal(response.status, 200); assert(response.replayed);
        const after = await canonicalDatabaseSnapshot(pool); assert.equal(after.stateSha256, before.stateSha256, 'Alliance exact retry changed full canonical state');
        await proof.record({ kind: 'alliance-exact-retry', accountId, request, logicalAt: at,
          beforeStateSha256: before.stateSha256, afterStateSha256: after.stateSha256 }); return response;
      },
    });
    if (stage?.paused) { await proof.record({ kind: 'alliance-checkpoint-pause', day, logicalAt: at,
      pending: allianceAdapter.checkpoint().payload.state.pending }); return; }
    lastDay = day;
    for (const account of selected) await session(account, day);
    await invariantBoundary('alliance-day-' + day);
    const entry = { day, logicalAt: at, selectedActors: selected, metrics: structuredClone(metrics),
      alliance: allianceAdapter.summary(), opportunityObservation: opportunities.summarize(at) };
    days.push(entry); await proof.record({ kind: 'day-summary', ...entry });
    const daily = await proof.snapshot(pool, 'day-' + day); await knowledgeBoundary('day-' + day, daily);
    await proof.artifact('world-diagnostics-day-' + day + '.json', await collectWorldDiagnostics(diagnosticPool,
      { logicalAt: at, roster, actorActions: Object.fromEntries(actorActions) }));
    await proof.artifact('alliance-day-' + day + '-checkpoint.json', allianceAdapter.checkpoint());
    await guardBoundary('alliance-day:' + day);
    originalConsole.log(JSON.stringify({ day, sessions: metrics.sessions, allianceFresh: allianceAdapter.summary().fresh,
      crimes: metrics.legacyCrimeAttempts, actorCoverage: [...actorActions.values()].filter(Boolean).length }));
  }
  const startupBefore = allianceEnabled ? await proof.snapshot(pool, 'before-original-worker-startup') : null;
  workPhase = 'worker-startup';
  await bootOriginalWorker(controller, { beforeCallbacks: async () => {
    if (!commitObserver) return;
    const after = await snapshotWorldResources(diagnosticPool);
    await proof.artifact('resource-worker-bootstrap.json', { classification: 'Aggregate initialization comparison; not per-commit coverage',
      before: priorResources, after, beforeHash: worldResourceHash(priorResources), afterHash: worldResourceHash(after) });
    assert.equal(worldResourceHash(after), worldResourceHash(priorResources), 'Original worker bootstrap changed authoritative resource state');
    priorResources = after; commitObserver.arm();
  } });
  let startupLineage = null;
  if (allianceEnabled) {
    const startupAfter = await proof.snapshot(pool, 'after-original-worker-startup');
    startupLineage = { beforeStateSha256: startupBefore.stateSha256, afterStateSha256: startupAfter.stateSha256,
      resourceBoundaries: resourceSummary.boundaries, resourceStreamSha256: observeResources ? resourceStream.copy().digest('hex') : null,
      callbackEvents: controller.diagnostic().events.filter(e => e.kind.startsWith('callback.') && e.kind !== 'callback.wall-duration'),
      stateDifference: compareAllianceStates(startupBefore, startupAfter) };
    await proof.artifact('alliance-startup-lineage.json', startupLineage);
  }
  workPhase = 'measured';
  if (allianceEnabled) { if (resume) await allianceDay(1); else await allianceDay(0); }
  const afterBoundary = async (logicalAt, label) => {
    guardrails?.time(`after:${label}:${logicalAt}`);
    if (label !== 'guardedTick') return;
    await guardBoundary(`hour:${(logicalAt - start) / 3600000}`);
    const day = Math.floor((logicalAt - epoch) / 86400000);
    if (allianceEnabled) {
      return;
    }
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
    await guardBoundary(`day:${day}`);
    originalConsole.log(JSON.stringify({ day, sessions: metrics.sessions, commands: metrics.freshPlayerCommands,
      crimes: metrics.legacyCrimeAttempts, actorCoverage: [...actorActions.values()].filter(Boolean).length }));
  };
  if (allianceEnabled && !resume) {
    await controller.advanceTo(epoch + 86400000, afterBoundary);
    await allianceDay(1, true);
    const checkpointState = await proof.snapshot(pool, 'alliance-hour24');
    await proof.checkpoint(pool, 'alliance-hour24', url);
    const savedPolicy = policyState();
    await proof.artifact('alliance-hour24-policy.json', savedPolicy);
    await proof.artifact('alliance-hour24-random-tape.json', { draws: runtime.tape });
    await proof.artifact('alliance-hour24-worker-schedule.json', controller.diagnostic());
    await proof.artifact('alliance-hour24-continuation.json', { version: 1, logicalAt: at, source,
      finalStateSha256: checkpointState.stateSha256, policyStateSha256: sha256(canonicalJson(savedPolicy)),
      deterministicRandomTapeSha256: sha256(canonicalJson(runtime.tape)),
      resourceStateSha256: observeResources ? worldResourceHash(priorResources) : null,
      resourceJournalPrefixSha256: observeResources ? resourceStream.copy().digest('hex') : null,
      resourceJournalPrefixCount: resourceSummary.boundaries,
      semantics: 'Actual quiescent native dump with selected but undispatched request. Prefix belongs to the sealed parent stream; no process startup has been suppressed.' });
    if (hours === 48) await allianceDay(1);
  }
  await controller.advanceTo(finish, afterBoundary);
  workPhase = 'final-observation';
  await invariantBoundary('final');
  const final = await proof.snapshot(pool, 'final'); await proof.checkpoint(pool, 'final', url);
  await knowledgeBoundary('final', final);
  const finalDiagnostics = await collectWorldDiagnostics(diagnosticPool,
    { logicalAt: at, roster, actorActions: Object.fromEntries(actorActions) });
  await proof.artifact('world-diagnostics-final.json', finalDiagnostics);
  if (commitObserver) {
    commitObserver.assertComplete(); await proof.artifact('resource-observer.json', { ...resourceSummary, diagnostic: commitObserver.diagnostic() });
    await proof.artifact('car-melt-witness-summary.json', { ...carMeltWitnessSummary, scope: configuration.carMeltWitness });
    await proof.artifact('car-acquisition-witness-summary.json', { ...carAcquisitionWitnessSummary, scope: configuration.npcCarAcquisitionWitness });
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
  if (allianceEnabled) {
    assert.equal(responseCompletions.size, 0, 'Outstanding original HTTP response hook');
    const paused = !resume && hours === 24;
    assert.deepEqual(allianceAdapter.summary().completedStages, paused ? [0] : [0, 1]);
    assert.equal(allianceAdapter.summary().completions.length, paused ? 0 : 3);
    assert.equal(!!finalPolicy.allianceAdapter.payload.state.pending, paused);
    assert.equal([...actorActions.values()].filter(Boolean).length, 25);
    await proof.artifact('alliance-final.json', { contract: ALLIANCE_WORLD_CONTRACT, summary: allianceAdapter.summary(), checkpoint: allianceAdapter.checkpoint() });
  }
  await proof.artifact('actor-tape.json', actorTape); await proof.artifact('actor-policy-final.json', finalPolicy);
  await proof.artifact('knowledge-boundaries.json', knowledgeBoundaries);
  await proof.artifact('player-metrics.json', { days, metrics, latencies, actorActions: Object.fromEntries(actorActions),
    opportunities: opportunities.summarize(at), meaningfulActionDefinition: 'Fresh completed domain PlayerCommands plus canonical crime attempts with committed success or loss'
      + (allianceEnabled ? ' plus fresh completed alliance HTTP operations' : '') + '; excludes reads/replays/denials' });
  result = { status: 'PASS_SCOPED', hours, population, seed, actorPolicy, mysteryPolicySummaries: mysterySummaries(),
    actualActiveActors: [...actorActions.values()].filter(Boolean).length,
    dailySelectedActors: configuration.policy.dailyActiveActors, seasonalRolloversPerActor: expectedRollovers, metrics,
    ...(allianceEnabled ? { alliance: allianceAdapter.summary() } : {}),
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
    carMeltWitnessObservation: observeResources ? carMeltWitnessSummary : null,
    carAcquisitionWitnessObservation: observeResources ? carAcquisitionWitnessSummary : null,
    statement: 'Completed only the declared ' + actorPolicy + ' workload; no matrix qualification or dead-world clearance' };
  if (allianceEnabled) {
    result.continuation = { mode: configuration.continuation.mode, totalLogicalHours: (finish - epoch) / 3600000,
      parent: configuration.parentCheckpoint, restoredStateSha256: restoredState?.stateSha256 || null,
      applicationBootstrap, startup: startupLineage,
      resourceLineage: { parentJournalPrefixSha256: parentContinuation?.resourceJournalPrefixSha256 || null,
        parentJournalPrefixCount: parentContinuation?.resourceJournalPrefixCount || 0,
        parentCompleteJournalSha256: parentRun?.result.resourceJournalSha256 || null,
        segmentJournalSha256: result.resourceJournalSha256, segmentBoundaries: result.resourceJournalCount,
        semantics: 'Separate verified streams, joined by exact restored canonical state; physical setup/startup is retained and streams are not asserted identical to uninterrupted history.' } };
    if (comparisonRun) {
      assert.equal(comparisonRun.configuration.finish, configuration.finish);
      assert.equal(comparisonRun.configuration.continuation.mode, 'uninterrupted');
      result.continuation.uninterruptedComparison = compareAllianceStates(await readArtifact(comparisonDirectory, 'final.json'), final);
      await proof.artifact('alliance-uninterrupted-comparison.json', result.continuation.uninterruptedComparison);
    }
  }
  if (replay) {
    result.replayComparison = compareActorReplay(result, replayRun.result);
    assert.deepEqual(result.carMeltWitnessObservation, replayRun.result.carMeltWitnessObservation, 'Car COMMIT witness replay differs');
    assert.deepEqual(result.carAcquisitionWitnessObservation, replayRun.result.carAcquisitionWitnessObservation, 'Car acquisition witness replay differs');
    result.carMeltWitnessReplayEqual = true;
  }
  await guardBoundary('final');
  if (guardrails) await proof.artifact('operational-guardrails.json', guardrails.diagnostic());
  await proof.record({ kind: 'assertions', ...result });
} catch (error) {
  result = { status: 'FAIL', hours, population, metrics, error: error.message, invocation: failureInvocation, logicalAt: at };
  await retainWorldFailure(() => proof.record({ kind: 'failure', invocation: failureInvocation, logicalAt: at, message: error.message, stack: error.stack }), { historyStorage, result });
  if (historyStorage && result.captureErrors?.length && commitObserver)
    await retainWorldFailure(async () => commitObserver.disarm(), { historyStorage, result });
  await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-random-tape.json', { draws: runtime.tape });
  await proof.artifact('failure-actor-tape.json', actors.diagnostic());
  await proof.artifact('failure-actor-policy.json', policyState());
  if (guardrails) await proof.artifact('failure-operational-guardrails.json', guardrails.diagnostic());
  await proof.artifact('failure-query-order.json', await queryOrder.diagnostic());
  if (commitObserver) await proof.artifact('failure-resource-observer.json', { capturedAt: 'First failure, before diagnostic state capture', ...resourceSummary, diagnostic: commitObserver.diagnostic() });
  if (pool) {
    try { await proof.snapshot(pool, 'first-failure'); await proof.checkpoint(pool, 'first-failure', url); }
    catch (captureError) { await retainWorldFailure(() => proof.record({ kind: 'failure-capture-error', message: captureError.message, stack: captureError.stack }), { historyStorage, result }); }
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
  }, async () => { if (app) await app.close(); }, () => controller.close(), () => diagnosticPool.end(), () => base.end(),
    async () => proof.record({ kind: 'database-cleanup', ...await database.close() })]) {
    try { await close(); }
    catch (error) {
      result.status = 'FAIL'; result.cleanupFailure = error.message; process.exitCode = 1;
      await retainWorldFailure(() => proof.record({ kind: 'cleanup-failure', message: error.message }), { historyStorage, result });
    }
  }
  seam.restore(); runtime.restore();
  for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify({ status: result.status, source: source.revision, hours, population, metrics, matrixQualifying: false }));
