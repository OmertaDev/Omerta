// Two separate, scoped full-server authority proofs on owned native databases.
// Run with --knowledge or --confirmation; restricted evidence is mandatory.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';

const selected = process.argv.slice(2);
assert(selected.length === 1 && ['--knowledge', '--confirmation'].includes(selected[0]), 'Select exactly --knowledge or --confirmation');
assert(process.env.RC1_TEST_DATABASE_URL && process.env.RC1_KNOWLEDGE_AUTHORITY_OUTPUT, 'Explicit native control URL and restricted output directory required');
const scenario = selected[0].slice(2), source = await sourceIdentity();
const directory = path.resolve(process.env.RC1_KNOWLEDGE_AUTHORITY_OUTPUT);
const database = planOwnedWorldDatabase({ controlUrl: process.env.RC1_TEST_DATABASE_URL, runId: `${scenario}-authority`, sourceRevision: source.revision });
for (const key of Object.keys(process.env)) if (/^(CHAIN_|VOUCHER_|PRIVY_|X_OAUTH|INVARIANT_WEBHOOK|DISCORD_|REDIS_URL)/.test(key)) delete process.env[key];
for (const key of ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY']) process.env[key] = crypto.randomBytes(32).toString('hex');
Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on',
  COORDINATION_ENGINE: 'on', COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on',
  COORDINATION_ACCOUNT_IDS: '', SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on' });
const configuration = { phase: 'local-prerelease', scenario, database: database.descriptor, originalWorkers: false,
  initialFixtures: scenario === 'knowledge'
    ? 'Six funded eligible characters (cash100000/respect10000/stats50); reader at docks, others foundry; three initial Crew/Family members. No measured SQL writes.'
    : 'Two funded eligible characters (cash100000/respect10000/stats50) at docks, initial shared Crew membership. Researcher obtains a junker via canonical HTTP boost with setup-only Math.random=0.01, restored before baseline. No initial claims, crafted items or mystery progress. All measured progression uses authenticated HTTP; no postbaseline SQL writes.',
  authorityComparison: `${scenario === 'knowledge' ? 30 : 32} named tables, all columns/rows, serial quiescent denial/replay boundaries. Existing row JSON representation. Full canonical initial/final and restart snapshots retained separately.`,
  excludedFromEquality: ['HTTP transport idempotency cache', 'current projection issuance/command boards', 'passive telemetry', 'all tables outside the declared comparison set', 'sequences'],
  exclusions: ['Natural entry and earned initial progression/resources', 'Complete route/role authority cross product', 'Concurrent transaction commit ordering', 'Workers and timed recovery', 'Full economy/resource conservation for funded fixtures', '90-day matrix', 'Deployment and physical devices'] };
const proof = await createProofRecorder({ directory, source, configuration, runId: `${scenario}-authority`, seed: 'scoped-http-v1',
  scenarioId: `${scenario}-http-authority`, population: scenario === 'knowledge' ? 6 : 2 });
const { buildServer } = await import('../src/server.js');
const { roleKnowledgeProbes } = await import('./lib/rc1-authority-probes.js');
const { choiceConfirmationProbes } = await import('./lib/rc1-choice-confirmation-probes.js');
const { familyOperationInvariants } = await import('../src/coordination/operation-invariants.js');
const { worldKernelInvariants } = await import('../src/world-kernel-invariants.js');
let app, result, phase = 'initialization', requestOrdinal = 0, evidenceOrdinal = 0, restarts = 0;
const completions = new Map(), active = new Set(), evidence = [];
async function boot() {
  app = await buildServer();
  const target = app, originalInject = app.inject.bind(app);
  // Await original response hooks (including projection-events membership SQL).
  // This terminal hook does not replace or remove any original lifecycle hook.
  app.addHook('onResponse', async req => { completions.get(req.headers['x-rc1-completion'])?.(); });
  app.inject = input => {
    const work = (async () => {
      const ordinal = ++requestOrdinal, id = String(ordinal); let timer;
      const completed = new Promise((resolve, reject) => {
        completions.set(id, resolve); timer = setTimeout(() => reject(Error('Original HTTP response hooks did not complete')), 30000);
      });
      try {
        const response = await originalInject({ ...input, headers: { ...input.headers, 'x-rc1-completion': id } });
        await completed;
        const token = input.headers?.authorization?.replace(/^Bearer /, '');
        const accountId = token ? target.jwt.verify(token).sub : null;
        await proof.record({ kind: 'completed-http', requestOrdinal: ordinal, phase, method: input.method, url: input.url, accountId,
          ...(input.payload === undefined ? {} : { payload: input.payload }),
          ...(input.headers?.['idempotency-key'] ? { idempotencyKey: input.headers['idempotency-key'] } : {}),
          status: response.statusCode, body: response.json(), transportReplay: response.headers['x-idempotent-replay'] === 'true' });
        return response;
      } finally { clearTimeout(timer); completions.delete(id); }
    })();
    active.add(work); work.then(() => active.delete(work), () => active.delete(work)); return work;
  };
}
async function closeServer() { if (app) { const current = app; app = null; await current.close(); await current.pool.end(); } }
async function restart() {
  const number = ++restarts;
  await proof.snapshot(app.pool, `restart-${number}-before`);
  await closeServer(); await boot();
  await proof.snapshot(app.pool, `restart-${number}-after`);
  await proof.record({ kind: 'server-reconstruction', number, note: 'Original application bootstrap retained; no equality claim across bootstrap.' });
}
async function onEvidence(value) {
  const name = `case-${String(++evidenceOrdinal).padStart(3, '0')}.json`;
  await proof.artifact(name, value); evidence.push({ artifact: name, kind: value.kind, label: value.label || value.kind });
}
async function onFixture(value) {
  await proof.artifact('initial-fixture.json', value); await proof.snapshot(app.pool, 'initial-canonical'); phase = 'measured';
}
try {
  await proof.record({ kind: 'database-created', ...await database.create() });
  await boot();
  const probe = scenario === 'knowledge' ? roleKnowledgeProbes : choiceConfirmationProbes;
  const scope = await probe({ server: () => app, restart, onEvidence, onFixture });
  const invariants = { familyOperations: await familyOperationInvariants(app.pool), worldKernel: await worldKernelInvariants(app.pool) };
  await proof.artifact('scoped-invariants.json', invariants);
  assert(invariants.familyOperations.ok && invariants.worldKernel.ok, 'Scoped canonical invariants failed');
  const final = await proof.snapshot(app.pool, 'final-canonical');
  result = { status: 'PASS_SCOPED', source: source.revision, ...scope, requestCount: requestOrdinal,
    evidenceCases: evidence.length, finalStateSha256: final.stateSha256, releaseReady: false, fullAuthorityCoverage: false };
} catch (error) {
  result = { status: 'FAIL', error: error.message, stack: error.stack, requestsCompletedOrAttempted: requestOrdinal, evidenceCases: evidence.length };
  await proof.artifact('failure.json', result);
  if (app) try { await proof.snapshot(app.pool, 'failure-canonical'); } catch (snapshotError) {
    await proof.artifact('failure-snapshot-error.json', { message: snapshotError.message });
  }
  process.exitCode = 1;
} finally {
  await Promise.allSettled([...active]);
  try { await closeServer(); await proof.record({ kind: 'database-cleanup', ...await database.close() }); }
  catch (error) {
    result = { ...result, status: 'FAIL', cleanupError: error.message }; process.exitCode = 1;
    await proof.artifact('cleanup-failure.json', { message: error.message });
  }
  await proof.artifact('evidence-index.json', { cases: evidence });
  const record = await proof.finish(result); await verifyArtifactIndex(directory, record);
  console.log(JSON.stringify({ status: result.status, source: source.revision, scenario, directory,
    requests: requestOrdinal, denials: result.deniedCases || null, error: result.error || result.cleanupError || null }));
}
