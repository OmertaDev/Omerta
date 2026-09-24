// Scoped quiet-world integration: authorized actors plus every original local
// worker deadline. It cannot qualify a matrix cell while required metrics,
// resource branches, lifecycle workloads and deployment scope remain incomplete.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { createSeasonElectionProbe, snapshotElectionCandidates, ELECTION_SOURCE_PINS } from '../tools/rc1-season-election-provenance.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { createRecordedQueryOrder, QUERY_ORDER_SCOPE } from '../tools/rc1-native-query-order.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, restoreCheckpoint, canonicalDatabaseSnapshot, canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { createRecordedActors, compareActorReplay, actorValueHash } from '../tools/rc1-native-actor-replay.js';
import { activeQuietRoster, chooseAuthorizedCommand, choosePublicCrime, observedOpportunityTracker } from '../tools/rc1-native-player-policy.js';
import { collectWorldDiagnostics } from '../tools/rc1-world-diagnostics.js';
import { CAR_MELT_SOURCE_PINS } from '../tools/rc1-car-melt-provenance.js';
import { createNpcCarAcquisitionCommitObserver, NPC_CAR_SOURCE_PINS } from '../tools/rc1-npc-car-acquisition.js';
import { createNpcBoatFault, NPC_BOAT_FAULT_CONTRACT } from '../tools/rc1-npc-boat-fault.js';
import { createNpcBoatAcquisitionCommitObserver, NPC_BOAT_SOURCE_PINS } from '../tools/rc1-npc-boat-journal.js';
import { createNpcMarketOrderCommitObserver, NPC_MARKET_SOURCE_PINS, NPC_MARKET_SQL } from '../tools/rc1-npc-market-order-journal.js';
import { createNpcFamilyCommitObserver, NPC_FAMILY_SOURCE_PINS } from '../tools/rc1-npc-family-provenance.js';
import { captureDuelSelection } from '../tools/rc1-duel-selection-provenance.js';
import { collectKnowledgeDiagnostics } from '../tools/rc1-knowledge-diagnostics.js';
import { createMysteryPolicy, MYSTERY_POLICY_CONTRACT } from '../tools/rc1-mystery-policies.js';
import { planCohort, createCohortPolicy, assessCohortBaseline, COHORT_POLICY_CONTRACT } from '../tools/rc1-cohort-policy.js';
import { createRunGuardrails } from '../tools/rc1-native-run-guardrails.js';
import { createAllianceWorldAdapter, ALLIANCE_WORLD_CONTRACT, ALLIANCE_CONTINUOUS_WORLD_CONTRACT } from '../tools/rc1-alliance-world-adapter.js';
import { createFamilyWorldAdapter, FAMILY_WORLD_CONTRACT } from '../tools/rc1-family-world-adapter.js';
import { planFamilyFixture } from '../tools/rc1-family-policy.js';
import { createChurnPolicy, CHURN_POLICY_CONTRACT } from '../tools/rc1-churn-policy.js';
import { assertAllianceContinuation, assertAllianceApplicationBootstrap, compareAllianceStates } from '../tools/rc1-alliance-continuation.js';
import { parseWorldHistoryStorage, assertWorldHistoryStorage, retainWorldFailure } from '../tools/rc1-world-history-storage.js';

const argument = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
assert(process.argv.includes('--postgres'), 'Real PostgreSQL is required');
const output = argument('output') || process.env.RC1_WORLD_OUTPUT; assert(output, 'Provide a new restricted output directory');
const faultNpcBoatGrant = process.argv.includes('--fault-npc-boat-grant');
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
assert(['quiet_world', 'high_mystery_participation', 'low_mystery_participation', 'coordinated_alliance', 'mostly_new_players', 'mostly_veteran_players', 'family_monopoly', 'fragmented_families', 'high_player_churn'].includes(actorPolicy));
const allianceEnabled = actorPolicy === 'coordinated_alliance';
const continuousAlliance = allianceEnabled && (population !== 25 || ![24, 48].includes(hours) || process.argv.includes('--continuous-alliance'));
const legacyAlliance = allianceEnabled && !continuousAlliance;
const allianceMode = continuousAlliance ? 'continuous' : 'legacy';
const cohortEnabled = actorPolicy === 'mostly_new_players' || actorPolicy === 'mostly_veteran_players';
const familyEnabled = actorPolicy === 'family_monopoly' || actorPolicy === 'fragmented_families';
const churnEnabled = actorPolicy === 'high_player_churn';
const httpEnabled = allianceEnabled || cohortEnabled || familyEnabled || churnEnabled;
if (faultNpcBoatGrant) {
  assert(observeResources && hours === 12 && population === 25 && seed === 'rc1-alpha' && actorPolicy === 'quiet_world');
  assert(!argument('resume'), 'Fault workload does not support continuation');
}
const scenarioId = faultNpcBoatGrant ? 'scoped-quiet-world-npc-boat-late-fault' : continuousAlliance ? 'scoped-continuous-alliance-world' : allianceEnabled ? 'scoped-coordinated-alliance-world' : cohortEnabled || familyEnabled || churnEnabled ? 'scoped-' + actorPolicy + '-world' : 'scoped-quiet-world-active-players-and-workers';
if (legacyAlliance) {
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
assert(!comparisonDirectory || (legacyAlliance && resume), 'Uninterrupted comparison requires legacy alliance continuation');
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
const checkpointLabel = legacyAlliance ? 'alliance-hour24' : 'final';
const parentContinuation = resume && legacyAlliance ? await readArtifact(resume, 'alliance-hour24-continuation.json') : null;
const parentCheckpoint = resume ? await readArtifact(resume, checkpointLabel + '-checkpoint.json') : null;
const parentTape = resume ? (await readArtifact(resume, legacyAlliance ? 'alliance-hour24-random-tape.json' : 'random-tape.json')).draws : null;
const parentPolicy = resume ? await readArtifact(resume, legacyAlliance ? 'alliance-hour24-policy.json' : 'actor-policy-final.json') : null;
if (resume) {
  const parentBoundary = parentContinuation || parentRun.result;
  assert.equal(parentCheckpoint.stateSha256, parentBoundary.finalStateSha256);
  assert.equal(sha256(canonicalJson(parentTape)), parentBoundary.deterministicRandomTapeSha256);
  assert.equal(sha256(canonicalJson(parentPolicy)), parentBoundary.policyStateSha256);
  assert(/^rc1_worker_world_[a-z_0-9]+$/.test(parentCheckpoint.schema));
  if (legacyAlliance) assertAllianceContinuation({ source, parentRun, parentPolicy, parentCheckpoint, seed, population,
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
if (httpEnabled) Object.assign(declared, { RATE_LIMIT: 'off', INVITE_MODE: 'off', SOCIAL_VERIFY_MODE: 'off',
  JWT_SECRET: sha256('rc1-isolated-alliance-world-jwt:' + seed), MARKET_SEED: sha256('rc1-isolated-alliance-market:' + seed),
  MOD_KEY: sha256('rc1-isolated-alliance-mod:' + seed) });
const previousEnv = Object.fromEntries(Object.keys(declared).map((key) => [key, process.env[key]]));
Object.assign(process.env, declared);
const seasonMs = 28 * 86400000;
const epoch = resume ? parentPolicy.epoch : Math.ceil(Date.parse('2026-09-20T12:00:00.000Z') / seasonMs) * seasonMs - 3600000;
const start = resume ? parentPolicy.logicalAt : epoch;
let measuredStart = start, finish = start + hours * 3600000;
const expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
const configuration = { ...(faultNpcBoatGrant ? { npcBoatFault: NPC_BOAT_FAULT_CONTRACT } : {}), scenario: 'quiet_world', population, seed, hours, sourcePins: WORKER_SOURCE_PINS,
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
  npcFamilyWitness: observeResources ? { format: 1, sourcePins: NPC_FAMILY_SOURCE_PINS,
    scope: 'Original worker formation only; exact cash fee/owner/receipt and nonmonetary initial war_pool. Full candidate states retained; other Family changes stay unsupported.' } : null,
  seasonElectionObservation: observeResources ? { sourcePins: ELECTION_SOURCE_PINS, maximumBytes: 8388608, maximumQueries: 64,
    scope: 'Original cold all-zero standing cohort with no core Family holder only; cached/shared-flight, nonzero and compound selections remain unsupported' } : null,
  npcBoatWitness: observeResources ? { format: 1, sourcePins: NPC_BOAT_SOURCE_PINS,
    scope: 'Same native transaction witness; exact default NPC dinghy birth, source caller and original serial RNG tape inputs. No authored boat grant receipt exists; all other boat dispositions remain unsupported.' } : null,
  npcMarketOrderWitness: observeResources ? { format: 1, sourcePins: NPC_MARKET_SOURCE_PINS,
    scope: 'Same bounded transaction witness: one original worker NPC buy order, exact fee sink/pocket debit/owned escrow/default custody/deadline. No terminal or human postOrder classification.' } : null,
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
  syntheticSessionRenewal: 'Before an ordinary HTTP bearer is within two logical days of expiry, the same authenticated actor calls /v1/auth/agent-key. This canonical registration sets agent_flag and referral exclusion, issues its real90-day agent token and retains the credential privately. No direct JWT signing or postbaseline fixture.',
  excludedIntegrations: ['Unconfigured chain watcher', 'Disabled liquidity automation', 'Unavailable external RWA registry'],
  coverageMissing: ['All 15 archetypes and 225 runs', 'All 13 resource journals at every worker transition',
    'Actor-policy replay across all archetypes and seeds',
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
if (continuousAlliance) {
  Object.assign(configuration, { allianceContract: ALLIANCE_CONTINUOUS_WORLD_CONTRACT,
    policyScope: ALLIANCE_CONTINUOUS_WORLD_CONTRACT.schedule,
    policy: { ...configuration.policy, dailyActiveActors: population },
    entry: population + ' ordinary HTTP entrants; only first three receive prebaseline founder respect. Every rolling day executes canonical alliance cooperation and all declared actor crime sessions.',
    workerOrder: 'All due original callbacks execute; daily alliance work follows the first hourly callback of each rolling day, with day0 immediately after startup.',
  });
  delete configuration.continuation;
}
if (cohortEnabled) Object.assign(configuration, {
  scenario: actorPolicy, cohortContract: COHORT_POLICY_CONTRACT,
  policyScope: 'All assigned actors use current issued PlayerCommands and their own public crime eligibility. Starting cohort labels never grant continuing eligibility.',
  policy: { dailyActiveActors: population, proposedFraction: 1, realizedFraction: 1, sessionsPerSelectedActorPerDay: 1,
    maximumCommandsPerSession: 4, maximumCrimesPerSession: 1,
    information: 'Authorized PlayerCommand snapshots, own public character, public crimes and pacing', observerFeedback: 'No diagnostic rows feed policy choices' },
  entry: 'Ordinary HTTP guest/character entry. Mostly-new veterans earn progression before new majority character entry; mostly-veteran majority receives only the declared initialization respect fixture.',
  authority: 'Ordinary HTTP entry; original PlayerCommand engine and canonical withCharacter crimes. No external authentication-provider qualification.',
  initialization: { maximumLogicalDays: 14, maximumWallMs: 7200000,
    progression: 'Highest unlocked public level crime, stable public ID tie-break. Wait for its public nerve cost or jail recovery on the shared controller; every due original worker callback runs. No hospital crime gate.',
    measurement: 'Warmup is retained before the measured initial checkpoint and excluded from measured player/resource totals. No postbaseline fixtures.' },
  resourceBootstrap: 'Resource observation starts at the measured baseline. Mostly-new initial worker boot and all canonical warmup precede it; no worker callback is omitted or repeated.',
  workerOrder: 'Initial cohort sessions follow original startup and measured baseline; subsequent sessions follow the first hourly callback of each rolling day.',
  httpConfiguration: 'Local deterministic test secrets; rate limit/invite/social gates off. No production admission or capacity qualification.',
});
if (familyEnabled) Object.assign(configuration, {
  scenario: actorPolicy, familyContract: FAMILY_WORLD_CONTRACT, familyPlan: planFamilyFixture(actorPolicy, population),
  policyScope: FAMILY_WORLD_CONTRACT.schedule,
  policy: { dailyActiveActors: population, proposedFraction: 1, realizedFraction: 1, sessionsPerSelectedActorPerDay: 1,
    maximumCommandsPerSession: 4, maximumCrimesPerSession: 1,
    information: FAMILY_WORLD_CONTRACT.information, observerFeedback: 'No diagnostic rows feed policy choices' },
  entry: FAMILY_WORLD_CONTRACT.initialization,
  authority: 'Ordinary authenticated Family HTTP actions; original PlayerCommand dispatcher and canonical crimes.',
  httpConfiguration: 'Local deterministic test secrets; rate limit/invite/social gates off. No production admission or capacity qualification.',
});
if (churnEnabled) Object.assign(configuration, {
  scenario: actorPolicy, churnContract: CHURN_POLICY_CONTRACT,
  policyScope: 'All current actors receive daily ordinary sessions; replace30% of actual weekly active actors with carried integer remainder at each original seven-day boundary. Retired accounts and custody remain untouched and observed.',
  policy: { dailyActiveActors: population, proposedFraction: 1, realizedFraction: 1, sessionsPerSelectedActorPerDay: 1,
    maximumCommandsPerSession: 4, maximumCrimesPerSession: 1,
    information: 'Authorized PlayerCommands, own character, public crimes and recorded actual activity', observerFeedback: 'No diagnostic rows feed policy choices' },
  entry: 'Every initial/replacement actor uses ordinary guest and character HTTP; no progression or resource fixtures.',
  authority: 'Original guest/session entry, PlayerCommand dispatcher and canonical crimes; no external authentication-provider qualification.',
});
if (replay) {
  assert.equal(replayRun.configuration.hours, hours);
  assert.deepEqual(replayRun.configuration.npcBoatFault, configuration.npcBoatFault);
  assert.equal(replayRun.configuration.resourceObservation, configuration.resourceObservation);
  assert.deepEqual(replayRun.configuration.carMeltWitness, configuration.carMeltWitness);
  assert.deepEqual(replayRun.configuration.npcCarAcquisitionWitness, configuration.npcCarAcquisitionWitness);
  assert.deepEqual(replayRun.configuration.npcFamilyWitness, configuration.npcFamilyWitness);
  assert.deepEqual(replayRun.configuration.npcBoatWitness, configuration.npcBoatWitness);
  assert.deepEqual(replayRun.configuration.npcMarketOrderWitness, configuration.npcMarketOrderWitness);
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
// A fresh application rebuilds process-local sealing keys and Fastify's random
// registration IDs. Retain those draws without shifting the restored gameplay
// stream, just as for the repeated original worker startup below.
const initializeApplication = work => resume && httpEnabled ? runtime.withRestartStartup(work) : work();
const controller = createWorkerSchedule({ start, setClock: (value) => { at = value; }, expectedDormant });
const namespace = resume ? parentCheckpoint.schema : `rc1_worker_world_${process.pid}_${Math.floor(performance.now())}`;
const base = new pg.Pool({ connectionString: url }), queryOrder = createRecordedQueryOrder({ replay: retainedOrder, replayDirectory: replay, artifact: proof.artifact });
const actors = createRecordedActors({ replay: retainedActors, record: proof.record });
const diagnosticPool = new pg.Pool({ connectionString: url, max: 1,
  options: `-c search_path=${namespace},pg_catalog -c default_transaction_read_only=on` });
const electionProbe = observeResources ? createSeasonElectionProbe({ snapshot: () => snapshotElectionCandidates(diagnosticPool) }) : null;
const electionSeam = electionProbe?.install();
let snapshotWorldResources, reconcileWorldResources, worldResourceHash;
let priorResources, firstResourceError, workPhase = 'initialization';
let duelSelection = null, duelSelectionArtifact = null;
const resourceSummary = { boundaries: 0, unsupportedEntries: 0, unsupportedKinds: {}, qualifyingFullResourcePass: false };
const carMeltWitnessSummary = { committedWitnesses: 0, retainedCandidateWitnesses: 0, collectorUnsupportedWitnesses: 0,
  exactMeltTransitions: 0, unclassifiedCandidateBoundaries: 0 };
const carAcquisitionWitnessSummary = { retainedCandidateWitnesses: 0, exactAcquisitions: 0, unclassifiedCandidateBoundaries: 0 };
const npcFamilyWitnessSummary = { retainedCandidateWitnesses: 0, exactFormations: 0, rolledBackCandidates: 0, unclassifiedCandidateBoundaries: 0 };
const npcBoatWitnessSummary = { retainedCandidateWitnesses: 0, exactAcquisitions: 0, unclassifiedCandidateBoundaries: 0 };
const npcMarketOrderWitnessSummary = { retainedCandidateWitnesses: 0, exactPlacements: 0, unclassifiedCandidateBoundaries: 0 };
const resourceStream = crypto.createHash('sha256');
const resourceCost = { observedBoundaryWallMs: 0, maximumBoundaryWallMs: 0, serializedJournalBytes: 0, serializedRestrictedChangeBytes: 0 };
const npcBoatFault = createNpcBoatFault({ enabled: faultNpcBoatGrant, proof, stateHash: value => worldResourceHash(value) });
// BEGIN source-bound car witness integration control.
const commitObserver = observeResources ? createNpcFamilyCommitObserver({
  innerObserverFactory: options => createNpcMarketOrderCommitObserver({ ...options,
    innerObserverFactory: extra => createNpcBoatAcquisitionCommitObserver({ ...extra, seed, readRandomTape: () => runtime.tape }) }),
  context: () => currentInvocation || { authority: 'original-worker', logicalAt: at, ...(allianceEnabled ? { workPhase } : {}) },
  onAttempt: event => npcBoatFault.onAttempt(event),
  onBoundary: async (event, carMeltProvenance = null, npcFamilyProvenance = null) => {
    const started = performance.now();
    if (firstResourceError) throw firstResourceError;
    const after = await snapshotWorldResources(diagnosticPool), before = priorResources;
    let seasonElectionProvenance = null;
    try {
      if (['ROLLED_BACK', 'STATEMENT_ABORTED'].includes(event.outcome))
        assert.equal(worldResourceHash(after), worldResourceHash(before), 'Aborted SQL changed committed world resources');
      seasonElectionProvenance = await electionProbe?.boundary(event) ?? null;
      const selection = captureDuelSelection(event, before, after);
      if (selection) {
        duelSelection = selection;
        duelSelectionArtifact = `restricted-duel-selection-${String(resourceSummary.boundaries + 1).padStart(7, '0')}.json`;
        await proof.artifact(duelSelectionArtifact, { event, before, after, duelSelection });
      }
      await npcBoatFault.boundary(event, before, after, carMeltProvenance);
      if (carMeltProvenance) carMeltWitnessSummary.committedWitnesses++;
      // Keep unknown/overflow scopes explicit. Only original executed SQL can
      // select a candidate; a request label or actor-supplied claim cannot.
      const retainedWitness = carMeltProvenance && (carMeltProvenance.unsupported || carMeltProvenance.queries.some(query =>
        /^\s*DELETE\s+FROM\s+cars\b/i.test(query.sql)
        || /^\s*INSERT\s+INTO\s+transactions\b/i.test(query.sql) && /^melt(?::|$)/.test(String(query.parameters[5] || ''))))
        ? carMeltProvenance : null;
      const acquisitionWitness = carMeltProvenance?.queries.some(query => /^\s*INSERT\s+INTO\s+cars\b/i.test(query.sql))
        ? carMeltProvenance : null;
      const boatWitness = carMeltProvenance?.queries.some(query => /^\s*INSERT\s+INTO\s+boats\b/i.test(query.sql))
        ? carMeltProvenance : null;
      const marketWitness = carMeltProvenance?.queries.some(query => query.sql === NPC_MARKET_SQL.listing) ? carMeltProvenance : null;
      const { restrictedChanges, ...journal } = reconcileWorldResources(before, after,
        { identity: event, includeRestrictedChanges: true, carMeltProvenance: retainedWitness, carAcquisitionProvenance: acquisitionWitness, npcFamilyProvenance, seasonElectionProvenance, npcBoatProvenance: boatWitness, npcMarketOrderProvenance: marketWitness, duelSelection });
      if (journal.seasonConversions.movements.some(row => row.kind === 'season-duel-title'))
        journal.duelSelection = { artifact: duelSelectionArtifact, sha256: sha256(canonicalJson(duelSelection)) };
      if (marketWitness) {
        const artifact = `restricted-npc-market-order-${String(resourceSummary.boundaries + 1).padStart(7, '0')}.json`;
        await proof.artifact(artifact, { event, before, after, npcMarketOrderProvenance: marketWitness });
        journal.npcMarketOrderWitness = { artifact, sha256: sha256(canonicalJson(marketWitness)) };
        npcMarketOrderWitnessSummary.retainedCandidateWitnesses++;
        const exact = journal.npcMarketOrder.movements.length; npcMarketOrderWitnessSummary.exactPlacements += exact;
        if (!exact) npcMarketOrderWitnessSummary.unclassifiedCandidateBoundaries++;
      }
      if (retainedWitness) {
        const artifact = `restricted-car-melt-witness-${String(resourceSummary.boundaries + 1).padStart(7, '0')}.json`;
        await proof.artifact(artifact, { event, before, after, carMeltProvenance: retainedWitness });
        journal.carMeltWitness = { artifact, sha256: sha256(canonicalJson(retainedWitness)) };
        carMeltWitnessSummary.retainedCandidateWitnesses++;
        if (retainedWitness.unsupported) carMeltWitnessSummary.collectorUnsupportedWitnesses++;
        const exact = journal.cars.lineage.filter(row => row.kind === 'exact-solo-melt-sink').length;
        carMeltWitnessSummary.exactMeltTransitions += exact;
        if (!exact) carMeltWitnessSummary.unclassifiedCandidateBoundaries++;
      }
      if (acquisitionWitness) {
        const artifact = `restricted-car-acquisition-witness-${String(resourceSummary.boundaries + 1).padStart(7, '0')}.json`;
        await proof.artifact(artifact, { event, before, after, carAcquisitionProvenance: acquisitionWitness });
        journal.carAcquisitionWitness = { artifact, sha256: sha256(canonicalJson(acquisitionWitness)) };
        carAcquisitionWitnessSummary.retainedCandidateWitnesses++;
        const exact = journal.cars.lineage.filter(row => row.kind === 'exact-npc-spawn-car-source').length;
        carAcquisitionWitnessSummary.exactAcquisitions += exact;
        if (!exact) carAcquisitionWitnessSummary.unclassifiedCandidateBoundaries++;
      }
      if (boatWitness) {
        assert.deepEqual(boatWitness.boundary, event, 'Boat witness belongs to another native boundary');
        const artifact = `restricted-npc-boat-witness-${String(resourceSummary.boundaries + 1).padStart(7, '0')}.json`;
        await proof.artifact(artifact, { event, before, after, npcBoatProvenance: boatWitness });
        journal.npcBoatWitness = { artifact, sha256: sha256(canonicalJson(boatWitness)) };
        npcBoatWitnessSummary.retainedCandidateWitnesses++;
        const exact = journal.boats.movements.filter(row => row.kind === 'exact-npc-spawn-boat-source').length;
        npcBoatWitnessSummary.exactAcquisitions += exact;
        if (!exact) npcBoatWitnessSummary.unclassifiedCandidateBoundaries++;
      }
      if (npcFamilyProvenance) {
        const artifact = `restricted-npc-family-witness-${String(resourceSummary.boundaries + 1).padStart(7, '0')}.json`;
        await proof.artifact(artifact, { event, before, after, npcFamilyProvenance });
        journal.npcFamilyWitness = { artifact, sha256: sha256(canonicalJson(npcFamilyProvenance)) };
        npcFamilyWitnessSummary.retainedCandidateWitnesses++;
        const exact = journal.familyEntry.movements.filter(row => row.kind === 'npc-family-formation-cash-sink').length;
        npcFamilyWitnessSummary.exactFormations += exact;
        if (event.outcome === 'ROLLED_BACK') npcFamilyWitnessSummary.rolledBackCandidates++;
        else if (!exact) npcFamilyWitnessSummary.unclassifiedCandidateBoundaries++;
      }
      if (seasonElectionProvenance) {
        const artifact = `restricted-season-election-${String(resourceSummary.boundaries + 1).padStart(7, '0')}.json`;
        await proof.artifact(artifact, seasonElectionProvenance);
        journal.seasonCrowns.electionProvenanceArtifact = artifact;
        journal.seasonCrowns.electionProvenanceSha256 = sha256(canonicalJson(seasonElectionProvenance));
      }
      if (restrictedChanges) {
        const artifact = `restricted-resource-change-${String(resourceSummary.boundaries + 1).padStart(7, '0')}.json`;
        await proof.artifact(artifact, { event, restrictedChanges });
        resourceCost.serializedRestrictedChangeBytes += Buffer.byteLength(JSON.stringify({ event, restrictedChanges }));
        journal.restrictedChangesArtifact = artifact;
      }
      await npcBoatFault.classified(event, journal);
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
      await proof.artifact('first-resource-failure.json', { before, after, event, carMeltProvenance, npcFamilyProvenance, seasonElectionProvenance, error: { message: error.message, stack: error.stack } });
      throw error;
    }
  },
}) : null;
// END source-bound car witness integration control.
const seam = installWorkerInstrumentation(controller, { namespace, queryOrder, commitObserver });
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
const roster = httpEnabled ? [] : Array.from({ length: population }, (_, index) => `quiet-player-${index}`);
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
const familyActors = []; let familyAdapter = null;
const churnActors = [], churnWeeklyActive = new Set(); let churnPolicy = null;
const cohortActors = [], cohortPolicies = new Map();
let cohortPlan = null, cohortBaseline = null, cohortWarmup = null, workerBooted = false;
let allianceAdapter = null, app = null;
const responseCompletions = new Map(); let responseSequence = 0;
let lastDay = -1;
if (resume) {
  if (allianceEnabled) {
    allianceActors.push(...structuredClone(parentPolicy.allianceActors)); roster.push(...parentPolicy.roster);
    responseSequence = parentPolicy.nativeBoundary.responseSequence;
    allianceAdapter = createAllianceWorldAdapter({ seed, roster: allianceActors, mode: allianceMode }).restore(parentPolicy.allianceAdapter);
  }
  if (cohortEnabled) {
    cohortActors.push(...structuredClone(parentPolicy.cohortActors)); roster.push(...parentPolicy.roster);
    cohortPlan = structuredClone(parentPolicy.cohortPlan); cohortBaseline = structuredClone(parentPolicy.cohortBaseline);
    cohortWarmup = structuredClone(parentPolicy.cohortWarmup); responseSequence = parentPolicy.nativeBoundary.responseSequence;
    for (const accountId of roster) cohortPolicies.set(accountId,
      createCohortPolicy({ plan: cohortPlan, accountId }).restore(parentPolicy.cohortPolicies[accountId]));
  }
  if (familyEnabled) {
    familyActors.push(...structuredClone(parentPolicy.familyActors)); roster.push(...parentPolicy.roster);
    familyAdapter = createFamilyWorldAdapter({ scenario: actorPolicy, seed, roster: familyActors }).restore(parentPolicy.familyAdapter);
    responseSequence = parentPolicy.nativeBoundary.responseSequence;
  }
  if (churnEnabled) {
    churnActors.push(...structuredClone(parentPolicy.churnActors)); roster.push(...parentPolicy.roster);
    churnPolicy = createChurnPolicy(parentPolicy.churn.configuration).restore(parentPolicy.churn);
    for (const accountId of parentPolicy.churnWeeklyActive) churnWeeklyActive.add(accountId);
    responseSequence = parentPolicy.nativeBoundary.responseSequence;
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
  ...(churnEnabled ? { churnActors, churn: churnPolicy?.checkpoint() || null, churnWeeklyActive: [...churnWeeklyActive].sort(),
    nativeBoundary: { responseSequence, pendingResponses: responseCompletions.size, invocationPending: !!currentInvocation } } : {}),
  ...(familyEnabled ? { familyActors, familyAdapter: familyAdapter?.checkpoint() || null,
    nativeBoundary: { responseSequence, pendingResponses: responseCompletions.size, invocationPending: !!currentInvocation } } : {}),
  ...(cohortEnabled ? { cohortActors, cohortPlan, cohortBaseline, cohortWarmup, measuredStart,
    cohortPolicies: Object.fromEntries([...cohortPolicies].map(([accountId, policy]) => [accountId, policy.checkpoint()])),
    nativeBoundary: { responseSequence, pendingResponses: responseCompletions.size, invocationPending: !!currentInvocation } } : {}),
  ...(allianceEnabled ? { allianceAdapter: allianceAdapter?.checkpoint() || null, allianceActors,
    nativeBoundary: { responseSequence, pendingResponses: responseCompletions.size, invocationPending: !!currentInvocation } } : {}),
  mysteryPolicies: Object.fromEntries([...mysteryPolicies].map(([account, policy]) => [account, policy.checkpoint()])),
  mysterySummaries: mysterySummaries(),
  actorOptions: Object.fromEntries(actorOptions), actorActions: Object.fromEntries(actorActions),
  metrics, opportunities: opportunities.checkpoint(), days });
let pool, result, currentInvocation = null, failureInvocation = null, injectedActorMismatch = false;
let restoredState = null, applicationBootstrap = null;
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => {
    if (!npcBoatFault.acceptConsole(level, args, at)) controller.log(level, args);
  };
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
    if (httpEnabled) restoredState = await proof.snapshot(pool, 'restored-before-application-bootstrap');
  } else {
    await base.query(`CREATE SCHEMA ${namespace}`);
    const bootstrap = new controller.Pool({ connectionString: url, options: '', max: 20 });
    await seam.clock.initialize(bootstrap);
  }
    if (httpEnabled) {
      await initializeApplication(async () => {
        const { buildServer } = await import('../src/server.js'); app = await buildServer();
      });
      pool = app.pool;
      // inject can resolve at response delivery before original onResponse
      // hooks finish their native queries. Retain all original hooks and
      // wait for their completion before the next serial observed query.
      app.addHook('onResponse', async req => {
        const key = req.headers['x-rc1-response-completion'];
        const complete = responseCompletions.get(key); assert(complete, 'Untracked alliance response');
        responseCompletions.delete(key); complete();
      });
      if (resume) {
        // Complete deferred plugin registration before the first player request;
        // otherwise its final diagnostic random draw escapes the startup scope.
        await initializeApplication(() => app.ready());
        const after = await proof.snapshot(pool, 'after-application-bootstrap');
        applicationBootstrap = assertAllianceApplicationBootstrap(restoredState, after, at);
        await proof.artifact('alliance-application-bootstrap.json', applicationBootstrap);
      } else if (allianceEnabled) {
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
        grants, ordinaryUnmodifiedOutsiders: population - 3, directOtherFixtures: 0, fixtureWritesAfterBaseline: false });
      allianceAdapter = createAllianceWorldAdapter({ seed, roster: allianceActors, mode: allianceMode });
      }
    } else if (!resume) pool = await makeWorkerDatabase(controller);
    for (const account of httpEnabled || resume ? [] : roster) {
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
  const { engine, knowledgeService } = await initializeApplication(async () => {
    const content = coreProgressionContent(), director = createConfiguredDirector(pool, content);
    const engine = createPlayerCommandEngine({ pool, content, director, enabled: true,
      knowledgeEnabled: true, sharingEnabled: true, operationsEnabled: true, discoveryEnabled: true });
    const { createCoordinationService } = await import('../src/coordination/runtime.js');
    const knowledgeService = createCoordinationService({ pool, registry: content.coordinationRegistry,
      prerequisitesEnabled: content.progression === true, enabled: true, knowledgeEnabled: true, sharingEnabled: true, accountIds: [] });
    return { engine, knowledgeService };
  });
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
  if (familyEnabled && !resume) {
    const { PACING } = await import('../src/rules.js'), plan = configuration.familyPlan, grants = [];
    const founders = new Set(plan.groups.map(group => group.founder));
    for (let index = 0; index < population; index++) {
      const name = 'World Family Entry ' + index, bootstrapSecret = crypto.randomBytes(32).toString('base64url');
      const guest = await http(null, { method: 'POST', path: '/v1/auth/guest', body: { bootstrapSecret } });
      assert.equal(guest.status, 200, JSON.stringify(guest));
      const actor = { name, accountId: app.jwt.verify(guest.body.token).sub, token: guest.body.token };
      const entry = await http(actor, { method: 'POST', path: '/v1/character', body: { name }, idempotencyKey: 'family-entry-' + index });
      assert.equal(entry.status, 200, JSON.stringify(entry)); actor.characterId = entry.body.id;
      familyActors.push(actor); roster.push(actor.accountId); actorOptions.set(actor.accountId, {}); actorActions.set(actor.accountId, 0);
      await proof.artifact('family-entry-' + index + '.json', { bootstrapSecret, ...actor });
      if (founders.has(index)) {
        const before = (await pool.query('SELECT * FROM characters WHERE id=$1', [actor.characterId])).rows[0];
        const respect = PACING.LEVEL_DIVISOR * (plan.founderLevel - 1) ** 2;
        await pool.query('UPDATE characters SET respect=$2 WHERE id=$1', [actor.characterId, respect]);
        const after = (await pool.query('SELECT * FROM characters WHERE id=$1', [actor.characterId])).rows[0];
        assert.deepEqual({ ...after, respect: before.respect }, before, 'Only declared founder respect may change');
        grants.push({ accountId: actor.accountId, before, after });
      }
    }
    await proof.artifact('family-initialization.json', { plan, grants, otherDirectFixtures: 0, fixtureWritesAfterBaseline: false });
    familyAdapter = createFamilyWorldAdapter({ scenario: actorPolicy, seed, roster: familyActors });
  }
  if (churnEnabled && !resume) {
    for (let index = 0; index < population; index++) {
      const name = 'World Churn Entry ' + index, bootstrapSecret = crypto.randomBytes(32).toString('base64url');
      await proof.artifact('churn-initial-secret-' + index + '.json', { bootstrapSecret });
      const guest = await http(null, { method: 'POST', path: '/v1/auth/guest', body: { bootstrapSecret } });
      assert.equal(guest.status, 200, JSON.stringify(guest));
      const actor = { name, accountId: app.jwt.verify(guest.body.token).sub, token: guest.body.token,
        sessionRef: 'churn-initial-session-' + index, joinedAt: at };
      await proof.artifact(actor.sessionRef + '.json', actor);
      const entry = await http(actor, { method: 'POST', path: '/v1/character', body: { name }, idempotencyKey: 'churn-initial-character-' + index });
      assert.equal(entry.status, 200, JSON.stringify(entry)); actor.characterId = entry.body.id;
      churnActors.push(actor); roster.push(actor.accountId); actorOptions.set(actor.accountId, {}); actorActions.set(actor.accountId, 0);
    }
    churnPolicy = createChurnPolicy({ seed, epochAt: epoch,
      initialRoster: churnActors.map(({ accountId, characterId, sessionRef }) => ({ accountId, characterId, sessionRef })) });
    await proof.artifact('churn-initialization.json', { actors: churnActors, policy: churnPolicy.checkpoint(), directFixtures: 0 });
  }
  if (cohortEnabled && !resume) {
    const provenance = new Map(), grants = [];
    for (let index = 0; index < population; index++) {
      const bootstrapSecret = crypto.randomBytes(32).toString('base64url');
      const guest = await http(null, { method: 'POST', path: '/v1/auth/guest', body: { bootstrapSecret } });
      assert.equal(guest.status, 200, JSON.stringify(guest));
      const actor = { name: 'World Cohort Entry ' + index, accountId: app.jwt.verify(guest.body.token).sub, token: guest.body.token, index };
      cohortActors.push(actor); roster.push(actor.accountId); actorOptions.set(actor.accountId, {}); actorActions.set(actor.accountId, 0);
      await proof.artifact('cohort-guest-' + index + '.json', { bootstrapSecret, ...actor });
    }
    cohortPlan = planCohort({ scenarioId: actorPolicy, seed, roster });
    await proof.artifact('cohort-plan.json', cohortPlan);
    for (const accountId of roster) cohortPolicies.set(accountId, createCohortPolicy({ plan: cohortPlan, accountId }));
    const enter = async actor => {
      const entry = await http(actor, { method: 'POST', path: '/v1/character', body: { name: actor.name }, idempotencyKey: 'cohort-entry-' + actor.index });
      assert.equal(entry.status, 200, JSON.stringify(entry)); actor.characterId = entry.body.id;
      const evidenceRef = 'cohort-entry-' + actor.index + '.json';
      await proof.artifact(evidenceRef, { accountId: actor.accountId, logicalAt: at, entry });
      provenance.set(actor.accountId, { kind: 'ordinary-entry', evidenceRef });
    };
    const veteranIds = new Set(cohortPlan.actors.filter(a => a.cohort === 'veteran').map(a => a.accountId));
    const veterans = cohortActors.filter(a => veteranIds.has(a.accountId));
    for (const actor of actorPolicy === 'mostly_new_players' ? veterans : cohortActors) await enter(actor);
    if (actorPolicy === 'mostly_veteran_players') {
      const resourcesBefore = await snapshotWorldResources(diagnosticPool);
      for (const actor of veterans) {
        const descriptor = cohortPlan.actors.find(a => a.accountId === actor.accountId);
        const before = (await pool.query('SELECT * FROM characters WHERE id=$1', [actor.characterId])).rows[0];
        await pool.query('UPDATE characters SET respect=$2 WHERE id=$1', [actor.characterId, descriptor.initialization.respect]);
        const after = (await pool.query('SELECT * FROM characters WHERE id=$1', [actor.characterId])).rows[0];
        assert.deepEqual({ ...after, respect: before.respect }, before, 'Only initialization respect may change');
        grants.push({ accountId: actor.accountId, before, after, initialization: descriptor.initialization });
        provenance.set(actor.accountId, { kind: 'respect-fixture', evidenceRef: 'cohort-respect-fixtures.json' });
      }
      const resourcesAfter = await snapshotWorldResources(diagnosticPool);
      for (const table of Object.keys(resourcesBefore.tables)) {
        const normalized = resourcesAfter.tables[table].map(row => table === 'characters'
          ? { ...row, respect: resourcesBefore.tables.characters.find(before => before.id === row.id)?.respect } : row);
        assert.deepEqual(normalized.map(canonicalJson).sort(), resourcesBefore.tables[table].map(canonicalJson).sort(),
          'Respect fixture changed another authoritative field: ' + table);
      }
      await proof.artifact('cohort-respect-fixtures.json', { grants, resourcesBefore, resourcesAfter, directOtherFixtures: 0 });
    } else {
      const rules = await http(null, { method: 'GET', path: '/v1/rules' }); assert.equal(rules.status, 200);
      assert.deepEqual(rules.body.crimes, publicCrimes);
      const regenPerMinute = rules.body.pacing.nerveRegenPerMin; assert(regenPerMinute > 0);
      cohortWarmup = { startedAt: at, finishedAt: null, attempts: 0, successes: 0, losses: 0, recoveries: 0,
        actors: Object.fromEntries(veterans.map(a => [a.accountId, { attempts: 0, character: null }])),
        maximumLogicalDays: 14, maximumWallMs: 7200000, directProgressionWrites: 0 };
      await proof.snapshot(pool, 'cohort-before-warmup');
      workPhase = 'cohort-canonical-warmup';
      await bootOriginalWorker(controller); workerBooted = true;
      const wallStart = performance.now(), logicalLimit = at + 14 * 86400000;
      const checkWarmup = async (logicalAt, label) => {
        assert(performance.now() - wallStart <= cohortWarmup.maximumWallMs, 'Cohort canonical warmup exceeded two-hour wall limit');
        assert(logicalAt <= logicalLimit, 'Cohort canonical warmup exceeded fourteen logical days');
        guardrails?.time('cohort-warmup:' + label);
        if (label === 'guardedTick') {
          await invariantBoundary('cohort-warmup:' + logicalAt); await guardBoundary('cohort-warmup:' + logicalAt);
          originalConsole.log(JSON.stringify({ phase: 'cohort-warmup', logicalHours: (at - cohortWarmup.startedAt) / 3600000,
            attempts: cohortWarmup.attempts, levels: Object.values(cohortWarmup.actors).map(a => a.character?.level || 1) }));
        }
      };
      while (true) {
        let pending = 0, attempts = 0, waitMs = Infinity;
        for (const actor of veterans) {
          await checkWarmup(at, 'actor');
          const own = await invoke('cohort-warmup.character.read', { accountId: actor.accountId },
            () => readCharacter(pool, actor.accountId, async () => ({})), 'read');
          const state = cohortWarmup.actors[actor.accountId]; state.character = own.character;
          if (own.character.level >= COHORT_POLICY_CONTRACT.veteranLevel) continue;
          pending++;
          const eligible = publicCrimes.filter(c => c.lvl <= own.character.level).sort((a, b) => b.lvl - a.lvl || a.id.localeCompare(b.id));
          const chosen = own.character.jailSeconds > 0 || own.character.nerve < eligible[0].nerve ? null : eligible[0];
          const crime = await actors.decide('cohort-warmup.public-crime', { accountId: actor.accountId, attempt: state.attempts, logicalAt: at },
            { character: own.character, publicCrimes }, () => chosen || null);
          assert.deepEqual(crime, chosen || null, 'Warmup choice differs from own public eligibility');
          if (crime) {
            const response = await invoke('cohort-warmup.canonical-crime', { accountId: actor.accountId, crimeId: crime.id, approach: 'standard' },
              () => withCharacter(pool, actor.accountId, (ch, client, hooks) => doCrime(ch, crime.id, client, hooks, 'standard')), 'command');
            assert.equal(typeof response.success, 'boolean');
            cohortWarmup.attempts++; state.attempts++; attempts++;
            cohortWarmup[response.success ? 'successes' : 'losses']++;
          } else {
            const nerveWait = Math.ceil(Math.max(0, eligible[0].nerve - own.character.nerve) / regenPerMinute * 60000);
            waitMs = Math.min(waitMs, Math.max(1000, own.character.jailSeconds * 1000, nerveWait));
          }
        }
        if (!pending) break;
        if (!attempts) {
          assert(Number.isFinite(waitMs));
          const next = Math.min(at + waitMs, logicalLimit);
          assert(next > at, 'Cohort canonical warmup exhausted fourteen logical days before the veteran baseline');
          await controller.advanceTo(next, checkWarmup); cohortWarmup.recoveries++;
        }
      }
      cohortWarmup.finishedAt = at;
      await invariantBoundary('cohort-warmup-complete');
      await proof.snapshot(pool, 'cohort-after-warmup');
      await proof.artifact('cohort-canonical-progression.json', { ...cohortWarmup, elapsedWallMs: performance.now() - wallStart });
      for (const actor of veterans) provenance.set(actor.accountId, { kind: 'canonical-progression', evidenceRef: 'cohort-canonical-progression.json' });
      for (const actor of cohortActors.filter(a => !veteranIds.has(a.accountId))) await enter(actor);
    }
    const observations = [];
    for (const actor of cohortActors) {
      const own = await invoke('cohort-baseline.character.read', { accountId: actor.accountId },
        () => readCharacter(pool, actor.accountId, async () => ({})), 'read');
      observations.push({ accountId: actor.accountId, character: own.character, provenance: provenance.get(actor.accountId) });
    }
    cohortBaseline = assessCohortBaseline(cohortPlan, observations);
    await proof.artifact('cohort-baseline.json', { plan: cohortPlan, observations, assessment: cohortBaseline,
      nativeHistory: 'Ordinary entry receipts, canonical warmup calls/results and worker schedule retained in this run. Only declared respect fixture writes above.' });
    assert(cohortBaseline.ready, 'Required public cohort starting progression was not established');
    measuredStart = at; finish = at + hours * 3600000;
    configuration.start = new Date(at).toISOString(); configuration.finish = new Date(finish).toISOString();
    configuration.initialization.realizedCounts = cohortPlan.counts;
    configuration.initialization.realizedFractions = cohortPlan.realized;
    latencies.read.length = 0; latencies.command.length = 0;
  }
  await npcBoatFault.installBeforeBaseline(pool);
  const baseline = await runLedgerInvariants(pool, { alert: false }); assert(baseline.ok, 'Birth fixtures must reconcile without baseline drift');
  await proof.record({ kind: 'measured-initialization', roster, configuration, publicCrimes, randomDraws: runtime.tape,
    logicalAt: at, restoredCheckpoint: configuration.parentCheckpoint, fixtureWritesAfterThisRecord: false });
  const initial = await proof.snapshot(pool, 'initial'); await proof.checkpoint(pool, 'initial', url);
  if (resume) assert.equal(initial.stateSha256, httpEnabled ? applicationBootstrap.afterStateSha256 : parentCheckpoint.stateSha256,
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
    if (actor && request.path !== '/v1/auth/agent-key') {
      const identity = app.jwt.verify(actor.token); assert.equal(identity.sub, actor.accountId);
      assert(Number.isFinite(identity.exp), 'Ordinary session lacks an expiry');
      if (identity.exp * 1000 <= at + 2 * 86400000) {
        const renewal = await http(actor, { method: 'POST', path: '/v1/auth/agent-key', body: {} });
        assert.equal(renewal.status, 200, JSON.stringify(renewal)); assert.equal(renewal.body.agent, true);
        const renewed = app.jwt.verify(renewal.body.token);
        assert.equal(renewed.sub, actor.accountId); assert.equal(renewed.agent, true); assert(renewed.exp > identity.exp);
        actor.token = renewal.body.token; actor.authRenewals = (actor.authRenewals || 0) + 1;
        await proof.artifact('agent-session-' + actor.accountId + '-' + actor.authRenewals + '.json',
          { accountId: actor.accountId, logicalAt: at, token: actor.token, expiresAt: renewed.exp * 1000,
            canonicalEffects: ['agent_flag=true', 'agent referral exclusion'], fixture: false });
      }
    }
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
      metrics.playerSnapshots++;
      metrics.observedAuthorizedOpportunities = opportunities.observe(accountId, view.opportunities, at);
      const mysteryPolicy = mysteryPolicies.get(accountId), cohortPolicy = cohortPolicies.get(accountId);
      let command;
      if (cohortPolicy) {
        const chosen = cohortPolicy.choose(view, { day, logicalAt: at });
        const decision = await actors.decide('cohort-policy', { actorPolicy, accountId, day, action, logicalAt: at }, view, () => chosen);
        assert.equal(actorValueHash(decision), actorValueHash(chosen), 'Recorded cohort decision differs from restored policy state');
        await actors.observe('cohort-policy-pending', { accountId, logicalAt: at }, cohortPolicy.checkpoint());
        if (decision.kind === 'wait') break;
        command = view.commands.find(candidate => candidate.commandId === decision.command.commandId
          && candidate.executionIdentity?.executionId === decision.command.executionIdentity.executionId);
        assert(command, 'Cohort policy decision is not currently issued');
      } else if (mysteryPolicy) {
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
      opportunities.accept(accountId, command, response, at);
      if (mysteryPolicy) {
        mysteryPolicy.settle(response);
        await actors.observe('mystery-policy-settled', { accountId, logicalAt: at }, mysteryPolicy.checkpoint());
      }
      if (cohortPolicy) {
        cohortPolicy.settle(response);
        await actors.observe('cohort-policy-settled', { accountId, logicalAt: at }, cohortPolicy.checkpoint());
      }
      if (response.replayed) metrics.exactReplays++;
      else { metrics.freshPlayerCommands++; actions++; metrics.commandTypes[command.commandType] = (metrics.commandTypes[command.commandType] || 0) + 1; }
      if (command.commandType === 'mystery.start') actorOptions.get(accountId).mysteryGraphId = command.parameters.graphId;
      await invariantBoundary(`player.execute:${accountId}:${executionId}`);
    }
    const own = await invoke('character.read', { accountId }, () => readCharacter(pool, accountId, async () => ({})), 'read');
    metrics.ownCharacterReads++;
    const crime = await actors.decide('public-crime', { accountId, day, logicalAt: at }, { character: own.character, publicCrimes },
      () => cohortEnabled ? cohortPolicies.get(accountId).chooseCrime({ accountId, character: own.character, publicCrimes }, { day })
        : choosePublicCrime(own.character, publicCrimes, { seed, accountId, day }));
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
    if (churnEnabled && actions > 0) { assert(churnPolicy.isCurrent(accountId)); churnWeeklyActive.add(accountId); }
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
      alliance: allianceAdapter.summary(), opportunityObservation: opportunities.summarize(at, roster) };
    days.push(entry); await proof.record({ kind: 'day-summary', ...entry });
    const daily = await proof.snapshot(pool, 'day-' + day); await knowledgeBoundary('day-' + day, daily);
    await proof.artifact('world-diagnostics-day-' + day + '.json', await collectWorldDiagnostics(diagnosticPool,
      { logicalAt: at, roster, actorActions: Object.fromEntries(actorActions) }));
    await proof.artifact('alliance-day-' + day + '-checkpoint.json', allianceAdapter.checkpoint());
    await guardBoundary('alliance-day:' + day);
    originalConsole.log(JSON.stringify({ day, sessions: metrics.sessions, allianceFresh: allianceAdapter.summary().fresh,
      crimes: metrics.legacyCrimeAttempts, actorCoverage: [...actorActions.values()].filter(Boolean).length }));
  }
  async function churnWeek(day) {
    if (!day || day % 7) return;
    const input = { week: day / 7, logicalAt: at, activeAccountIds: [...churnWeeklyActive].sort() };
    const preview = churnPolicy.previewWeek(input);
    const selected = await actors.decide('churn-week', input, churnPolicy.roster(), () => preview);
    assert.deepEqual(selected, preview); churnPolicy.beginWeek(input);
    await actors.observe('churn-retired', { day, logicalAt: at }, churnPolicy.checkpoint());
    let enrollment;
    while ((enrollment = churnPolicy.nextEnrollment())) {
      await actors.observe('churn-enrollment-pending', { day, logicalAt: at }, enrollment);
      if (enrollment.phase === 'guest') {
        const bootstrapSecret = crypto.randomBytes(32).toString('base64url');
        await proof.artifact(enrollment.credentialRef + '.json', { bootstrapSecret });
        const response = await http(null, { method: 'POST', path: enrollment.request.path, body: { bootstrapSecret } });
        assert.equal(response.status, 200, JSON.stringify(response));
        const actor = { accountId: app.jwt.verify(response.body.token).sub, token: response.body.token,
          sessionRef: 'churn-session-' + enrollment.requestId, joinedAt: at };
        await proof.artifact(actor.sessionRef + '.json', actor); churnActors.push(actor);
        churnPolicy.settleEnrollment({ requestId: enrollment.requestId, phase: 'guest', status: 'COMPLETED',
          accountId: actor.accountId, sessionRef: actor.sessionRef });
      } else {
        const actor = churnActors.find(actor => actor.accountId === enrollment.accountId); assert(actor);
        const response = await http(actor, enrollment.request); assert.equal(response.status, 200, JSON.stringify(response));
        actor.characterId = response.body.id; actor.name = enrollment.request.body.name;
        churnPolicy.settleEnrollment({ requestId: enrollment.requestId, phase: 'character', status: 'COMPLETED',
          accountId: actor.accountId, characterId: actor.characterId, idempotencyKey: enrollment.request.idempotencyKey });
        roster.push(actor.accountId); actorOptions.set(actor.accountId, {}); actorActions.set(actor.accountId, 0);
      }
      await actors.observe('churn-enrollment-settled', { day, logicalAt: at }, { enrollment, policy: churnPolicy.checkpoint() });
    }
    assert.equal(churnPolicy.roster().current.length, population); churnWeeklyActive.clear();
    await invariantBoundary('churn-week-' + day / 7);
    await proof.artifact('churn-week-' + day / 7 + '.json', { summary: churnPolicy.summary(), checkpoint: churnPolicy.checkpoint() });
  }
  const startupBefore = allianceEnabled ? await proof.snapshot(pool, 'before-original-worker-startup') : null;
  workPhase = 'worker-startup';
  const workerStartup = () => bootOriginalWorker(controller, { beforeCallbacks: async () => {
    if (!commitObserver) return;
    const after = await snapshotWorldResources(diagnosticPool);
    await proof.artifact('resource-worker-bootstrap.json', { classification: 'Aggregate initialization comparison; not per-commit coverage',
      before: priorResources, after, beforeHash: worldResourceHash(priorResources), afterHash: worldResourceHash(after) });
    assert.equal(worldResourceHash(after), worldResourceHash(priorResources), 'Original worker bootstrap changed authoritative resource state');
    priorResources = after; commitObserver.arm();
  } });
  if (workerBooted) { if (commitObserver) commitObserver.arm(); }
  else if (resume && httpEnabled) await runtime.withRestartStartup(workerStartup);
  else await workerStartup();
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
  if (allianceEnabled) { if (!resume) await allianceDay(0); else if (legacyAlliance) await allianceDay(1); }
  const afterBoundary = async (logicalAt, label) => {
    guardrails?.time(`after:${label}:${logicalAt}`);
    if (label !== 'guardedTick') return;
    await guardBoundary(`hour:${(logicalAt - start) / 3600000}`);
    const day = Math.floor((logicalAt - epoch) / 86400000);
    if (allianceEnabled) {
      if (continuousAlliance && day !== lastDay && day < Math.ceil((finish - epoch) / 86400000)) await allianceDay(day);
      return;
    }
    if (day === lastDay || day >= Math.ceil((finish - epoch) / 86400000)) return;
    if (churnEnabled) await churnWeek(day);
    lastDay = day;
    const selected = await actors.decide(churnEnabled ? 'churn-roster' : familyEnabled ? 'family-roster' : cohortEnabled ? 'cohort-roster' : 'quiet-roster', { day, logicalAt }, roster,
      () => churnEnabled ? churnPolicy.roster().current : cohortEnabled || familyEnabled ? [...roster] : activeQuietRoster(roster, seed, day));
    assert.equal(selected.length, cohortEnabled || familyEnabled || churnEnabled ? population : Math.floor(population / 10)); assert.equal(new Set(selected).size, selected.length);
    assert(selected.every((account) => roster.includes(account)));
    if (familyEnabled) await familyAdapter.runDay(day, { logicalAt,
      read: async (accountId, path) => {
        const response = await http(familyActors.find(actor => actor.accountId === accountId), { method: 'GET', path });
        assert.equal(response.status, 200, JSON.stringify(response)); return response.body;
      },
      execute: async (accountId, request) => {
        const response = await http(familyActors.find(actor => actor.accountId === accountId), request);
        await invariantBoundary('family:' + request.idempotencyKey);
        if (response.status === 200 && !response.replayed) actorActions.set(accountId, actorActions.get(accountId) + 1);
        return response;
      },
      decision: async (identity, view, chosen) => {
        const recorded = await actors.decide('family-policy', identity, view, () => chosen);
        assert.equal(actorValueHash(recorded), actorValueHash(chosen));
      },
      checkpoint: (phase, checkpoint) => actors.observe('family-policy-' + phase, { day, logicalAt }, checkpoint),
    });
    for (const account of selected) await session(account, day);
    await invariantBoundary(`${cohortEnabled || familyEnabled || churnEnabled ? actorPolicy : 'quiet'}-day:${day}`);
    const entry = { day, logicalAt, selectedActors: selected, metrics: structuredClone(metrics),
      opportunityObservation: opportunities.summarize(at, roster) };
    days.push(entry); await proof.record({ kind: 'day-summary', ...entry });
    const daily = await proof.snapshot(pool, `day-${day}`);
    await knowledgeBoundary(`day-${day}`, daily);
    await proof.artifact(`world-diagnostics-day-${day}.json`, await collectWorldDiagnostics(diagnosticPool,
      { logicalAt: at, roster, actorActions: Object.fromEntries(actorActions) }));
    await guardBoundary(`day:${day}`);
    originalConsole.log(JSON.stringify({ day, sessions: metrics.sessions, commands: metrics.freshPlayerCommands,
      crimes: metrics.legacyCrimeAttempts, actorCoverage: [...actorActions.values()].filter(Boolean).length }));
  };
  if ((cohortEnabled || familyEnabled || churnEnabled) && !resume) await afterBoundary(at, 'guardedTick');
  if (legacyAlliance && !resume) {
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
    await proof.artifact('npc-family-witness-summary.json', { ...npcFamilyWitnessSummary, scope: configuration.npcFamilyWitness });
    await proof.artifact('npc-boat-witness-summary.json', { ...npcBoatWitnessSummary, scope: configuration.npcBoatWitness });
    await proof.artifact('npc-market-order-witness-summary.json', { ...npcMarketOrderWitnessSummary, scope: configuration.npcMarketOrderWitness });
  }
  const npcBoatFaultObservation = await npcBoatFault.finish(pool);
  const trace = controller.diagnostic(); assert.equal(trace.failures.length, 0);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary']
    .map((label) => [label, trace.events.filter((entry) => entry.kind === 'timer.fire' && entry.label === label).length]));
  const elapsed = finish - start;
  assert.deepEqual(timerCounts, { directorTick: Math.floor(elapsed / 300000), guardedTick: Math.floor(elapsed / 3600000),
    guardedSeasonTick: Math.floor(elapsed / 3600000), 'health-boundary': Math.floor(elapsed / 300000) });
  const recaps = (await pool.query('SELECT account_id,season FROM season_recaps ORDER BY account_id,season')).rows;
  const expectedRollovers = Math.floor(finish / seasonMs) - Math.floor(measuredStart / seasonMs);
  for (const actor of roster) {
    const actorStart = churnEnabled ? Math.max(measuredStart, churnActors.find(entry => entry.accountId === actor).joinedAt) : measuredStart;
    assert.equal(recaps.filter(row => row.account_id === actor).length - initialRecaps.filter(row => row.account_id === actor).length,
      Math.floor(finish / seasonMs) - Math.floor(actorStart / seasonMs));
  }
  await proof.artifact('worker-schedule.json', trace); await proof.artifact('query-order.json', await queryOrder.finish());
  await proof.artifact('random-tape.json', { draws: runtime.tape });
  const actorTape = actors.finish(), finalPolicy = policyState();
  if (allianceEnabled) {
    assert.equal(responseCompletions.size, 0, 'Outstanding original HTTP response hook');
    if (legacyAlliance) {
      const paused = !resume && hours === 24;
      assert.deepEqual(allianceAdapter.summary().completedStages, paused ? [0] : [0, 1]);
      assert.equal(allianceAdapter.summary().completions.length, paused ? 0 : 3);
      assert.equal(!!finalPolicy.allianceAdapter.payload.state.pending, paused);
    } else {
      assert.deepEqual(allianceAdapter.summary().completedStages, Array.from({ length: Math.ceil((finish - epoch) / 86400000) }, (_, day) => day));
      assert.equal(allianceAdapter.summary().unknownResponses, 0);
      assert(allianceAdapter.summary().dailyCooperation.every(day => day.cooperationSatisfied));
    }
    assert.equal([...actorActions.values()].filter(Boolean).length, population);
    await proof.artifact('alliance-final.json', { contract: configuration.allianceContract, summary: allianceAdapter.summary(), checkpoint: allianceAdapter.checkpoint() });
  }
  if (cohortEnabled) {
    assert.equal(responseCompletions.size, 0, 'Outstanding original HTTP response hook');
    assert(cohortBaseline.ready);
    await proof.artifact('cohort-final.json', { plan: cohortPlan, baseline: cohortBaseline, warmup: cohortWarmup,
      summaries: Object.fromEntries([...cohortPolicies].map(([accountId, policy]) => [accountId, policy.summary()])),
      measuredStart, measuredFinish: finish, fixtureWritesAfterBaseline: false, matrixQualifying: false });
  }
  if (familyEnabled) {
    assert.equal(responseCompletions.size, 0, 'Outstanding original HTTP response hook');
    assert.equal(familyAdapter.summary().unresolvedResponses, 0);
    await proof.artifact('family-final.json', { contract: FAMILY_WORLD_CONTRACT, summary: familyAdapter.summary(), checkpoint: familyAdapter.checkpoint() });
  }
  if (churnEnabled) {
    assert.equal(responseCompletions.size, 0); assert.equal(churnPolicy.summary().pendingEnrollments, 0);
    await proof.artifact('churn-final.json', { contract: CHURN_POLICY_CONTRACT, summary: churnPolicy.summary(), checkpoint: churnPolicy.checkpoint() });
  }
  await proof.artifact('actor-tape.json', actorTape); await proof.artifact('actor-policy-final.json', finalPolicy);
  await proof.artifact('knowledge-boundaries.json', knowledgeBoundaries);
  await proof.artifact('player-metrics.json', { days, metrics, latencies, actorActions: Object.fromEntries(actorActions),
    opportunities: opportunities.summarize(at, roster), meaningfulActionDefinition: 'Fresh completed domain PlayerCommands plus canonical crime attempts with committed success or loss'
      + (allianceEnabled || familyEnabled ? ' plus fresh completed social HTTP operations' : '') + '; excludes reads/replays/denials/authentication' });
  result = { ...(faultNpcBoatGrant ? { npcBoatFaultObservation } : {}), status: 'PASS_SCOPED', hours, population, seed, actorPolicy, mysteryPolicySummaries: mysterySummaries(),
    actualActiveActors: [...actorActions.values()].filter(Boolean).length,
    dailySelectedActors: configuration.policy.dailyActiveActors, seasonalRolloversPerActor: expectedRollovers, metrics,
    ...(allianceEnabled ? { alliance: allianceAdapter.summary() } : {}),
    ...(familyEnabled ? { family: familyAdapter.summary() } : {}),
    ...(churnEnabled ? { churn: churnPolicy.summary() } : {}),
    ...(cohortEnabled ? { cohort: { counts: cohortPlan.counts, realized: cohortPlan.realized, baselineReady: cohortBaseline.ready,
      warmup: cohortWarmup, measuredStart, measuredFinish: finish, initializationLogicalHours: (measuredStart - start) / 3600000 } } : {}),
    timerCounts, invariantChecks: baseline.checks.length, initialStateSha256: initial.stateSha256, finalStateSha256: final.stateSha256,
    workerScheduleSha256: trace.scheduleSha256, missingRequiredProof: configuration.coverageMissing,
    jobOutcomesSha256: sha256(canonicalJson(trace.jobs)), deterministicRandomTapeSha256: sha256(canonicalJson(runtime.tape)),
    actorTapeSha256: actorTape.entriesSha256, policyStateSha256: sha256(canonicalJson(finalPolicy)),
    mysteryPolicySummarySha256: sha256(canonicalJson(mysterySummaries())), knowledgeDiagnosticsSha256: sha256(canonicalJson(knowledgeBoundaries)),
    semanticMetricsSha256: sha256(canonicalJson({ days, metrics, actorActions: Object.fromEntries(actorActions), opportunities: opportunities.summarize(at, roster) })),
    checkpointRestart: !!resume, recordedActorAndSelectionReplay: !!replay,
    worldDiagnosticsSemanticSha256: sha256(canonicalJson(finalDiagnostics.semantic)),
    resourceObservationEnabled: observeResources, resourceJournalCount: resourceSummary.boundaries,
    resourceJournalSha256: observeResources ? resourceStream.copy().digest('hex') : null,
    resourceObservation: observeResources ? resourceSummary : null,
    carMeltWitnessObservation: observeResources ? carMeltWitnessSummary : null,
    carAcquisitionWitnessObservation: observeResources ? carAcquisitionWitnessSummary : null,
    npcFamilyWitnessObservation: observeResources ? npcFamilyWitnessSummary : null,
    npcBoatWitnessObservation: observeResources ? npcBoatWitnessSummary : null,
    npcMarketOrderWitnessObservation: observeResources ? npcMarketOrderWitnessSummary : null,
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
    assert.deepEqual(result.npcFamilyWitnessObservation, replayRun.result.npcFamilyWitnessObservation, 'NPC Family COMMIT witness replay differs');
    result.npcFamilyWitnessReplayEqual = true;
    assert.deepEqual(result.npcBoatWitnessObservation, replayRun.result.npcBoatWitnessObservation, 'NPC boat COMMIT witness replay differs');
    result.npcBoatWitnessReplayEqual = true;
    assert.deepEqual(result.npcMarketOrderWitnessObservation, replayRun.result.npcMarketOrderWitnessObservation, 'NPC order witness replay differs');
    result.npcMarketOrderWitnessReplayEqual = true;
    assert.deepEqual(result.npcBoatFaultObservation, replayRun.result.npcBoatFaultObservation, 'NPC boat fault schedule differs');
  }
  await guardBoundary('final');
  if (guardrails) await proof.artifact('operational-guardrails.json', guardrails.diagnostic());
  await proof.record({ kind: 'assertions', ...result });
} catch (error) {
  result = { status: 'FAIL', hours, population, metrics, error: error.message, invocation: failureInvocation, logicalAt: at };
  await retainWorldFailure(() => proof.record({ kind: 'failure', invocation: failureInvocation, logicalAt: at, message: error.message, stack: error.stack }), { historyStorage, result });
  if (historyStorage && result.captureErrors?.length && commitObserver)
    await retainWorldFailure(async () => commitObserver.disarm(), { historyStorage, result });
  if (faultNpcBoatGrant) await proof.artifact('failure-npc-boat-fault.json', npcBoatFault.diagnostic());
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
  if (electionProbe) await retainWorldFailure(() => proof.artifact('season-election-observer-final.json', electionProbe.diagnostic()), { historyStorage, result });
  electionSeam?.restore(); seam.restore(); runtime.restore();
  for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify({ status: result.status, source: source.revision, hours, population, metrics, matrixQualifying: false }));
