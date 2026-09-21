// Natural-entry sustained Law pressure through canonical actions and original worker deadlines.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import { createLawPolicy, LAW_POLICY_CONTRACT } from '../tools/rc1-law-policy.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, sha256 } from '../tools/rc1-native-proof.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';

assert(process.argv.includes('--postgres'), 'Explicit native PostgreSQL required');
const output = process.env.RC1_LAW_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(output && controlUrl, 'Fresh restricted output and local control database required');
const source = await sourceIdentity();
const database = planOwnedWorldDatabase({ controlUrl, runId: 'law-native', sourceRevision: source.revision });
for (const key of ['LAW_BUST_P', 'SEASON_MOD', 'SEASON_PHASE', 'CHAIN_RPC_URL', 'LIQUIDITY_RPC_URL',
  'LIQUIDITY_RPC_FALLBACK_URL', 'INVARIANT_WEBHOOK_URL', 'CITY_WIRE_WEBHOOK_URL'])
  assert(!process.env[key], 'Undeclared timing, probability or external override: ' + key);
const epoch = Date.parse('2026-09-20T00:00:00.000Z');
const expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
const configuration = { scenario: 'scoped-natural-law-pressure-plea-recovery', policy: LAW_POLICY_CONTRACT,
  sourcePins: WORKER_SOURCE_PINS, database: database.descriptor, epoch: new Date(epoch).toISOString(), expectedDormant,
  entry: 'One ordinary guest and ordinary character creation; original numeric starting resources; zero SQL fixtures or progression/status/clock/deadline grants.',
  workload: 'Public-directed loud cheapest-nerve crime builds actual heat and Law exposure. Original300s observation windows sustain pressure; ordinary nerve regeneration waits apply. On a public indictment one further eligible pressure crime persists the case. Then ordinary plea, exact retry, canonical jailed denial, original240s detention and a quiet recovery crime until one win (at most20 attempts).',
  limits: { maximumLogicalPressureHours: 24, maximumPressureChoices: 1000, maximumRecoveryAttempts: 20 },
  clocks: 'Shared application/SQL logical clock; every due original local worker callback. No direct job invocation, test probability or duration overrides; no wall-time equivalence.',
  resourceCoverage: 'Current exact observer equations and all canonical invariants at each mutation and callback; full snapshots at milestones. Law cash loss independently reconciles owner cash+bank, its exact ledger row and confiscation pool transfer.',
  excludedIntegrations: ['unconfigured chain watcher', 'disabled liquidity automation', 'unavailable external RWA registry', 'population spawning disabled'],
  exclusions: ['Forced offline six-hour trial and RNG conviction/acquittal', 'all other Law branches', 'cross-character effects',
    'full resource taxonomy', 'same-seed fresh-world replay', '100-inflight soak', '90-day/225-run matrix', 'production and real participants'] };
Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', COORDINATION_ACCOUNT_IDS: '',
  LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on',
  SOCIAL_VERIFY_MODE: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
const proof = await createProofRecorder({ directory: output, source, configuration, runId: 'law-native', seed: 'rc1-alpha',
  scenarioId: configuration.scenario, population: 1 });
const runtime = installSerialRuntime('rc1-alpha', configuration.epoch); let at = epoch;
runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: (value) => { at = value; }, expectedDormant });
const namespace = 'rc1_worker_law_' + process.pid + '_' + Math.floor(performance.now());
const base = new pg.Pool({ connectionString: database.url });
const seam = installWorkerInstrumentation(controller, { namespace });
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
let app, result, resourceSequence = 0, invariantBoundaries = 0, policy;
const resourceSummaries = [], unsupported = [], trajectory = [];
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
  await proof.record({ kind: 'database-created', ...await database.create() });
  await base.query('CREATE SCHEMA ' + namespace);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap);
  const [{ buildServer }, { runLedgerInvariants }, observer] = await Promise.all([
    import('../src/server.js'), import('../src/invariants.js'), import('../tools/rc1-world-resource-observer.js')]);
  app = await buildServer(); const pool = app.pool;
  const resources = () => observer.snapshotWorldResources(pool);
  async function reconcile(before, after, identity) {
    let journal;
    try { journal = observer.reconcileWorldResources(before, after, { identity, includeRestrictedChanges: true }); }
    catch (error) { await proof.artifact('resource-failure-' + resourceSequence++ + '.json', { identity, before, after, message: error.message }); throw error; }
    const label = 'resource-' + resourceSequence++; await proof.artifact(label + '.json', journal);
    unsupported.push(...journal.unsupported.map((entry) => ({ boundary: label, ...entry })));
    resourceSummaries.push({ label, identity, checks: journal.checks.length, status: journal.status, unsupported: journal.unsupported.length });
    await proof.record({ kind: 'resource-boundary', ...resourceSummaries.at(-1) });
  }
  async function invariants(label) {
    const report = await runLedgerInvariants(pool, { alert: false }); assert(report.ok, JSON.stringify(report)); invariantBoundaries++;
    await proof.record({ kind: 'canonical-invariants', label, logicalAt: at, checks: report.checks }); return report.checks.length;
  }
  async function observed(identity, work) {
    const before = await resources(); let value, caught;
    try { value = await work(); } catch (error) { caught = error; }
    await reconcile(before, await resources(), identity); if (caught) throw caught; return value;
  }
  let token = null, accountId = null;
  async function raw(method, path, body, key, label) {
    const identity = { accountId, method, path, label, logicalAt: at,
      ...(body === undefined ? {} : { body }), ...(key === undefined ? {} : { key }) };
    return proof.invoke('ordinary-http', identity, async () => {
      const response = await app.inject({ method, url: path, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}),
        ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { payload: body }) });
      return { status: response.statusCode, replayed: response.headers['x-idempotent-replay'] === 'true', body: response.json() };
    });
  }
  async function invoke(method, path, body, key, label = path, expectedStatus = 200) {
    const response = await observed({ label, method, path, logicalAt: at }, () => raw(method, path, body, key, label));
    if (expectedStatus !== null) assert.equal(response.status, expectedStatus, JSON.stringify(response));
    if (method !== 'GET') await invariants(label); return response;
  }
  const secret = crypto.randomBytes(32).toString('base64url'); await proof.artifact('entry-credential.json', { bootstrapSecret: secret });
  const guest = await invoke('POST', '/v1/auth/guest', { bootstrapSecret: secret }, undefined, 'ordinary-guest');
  token = guest.body.token; accountId = app.jwt.verify(token).sub; await proof.artifact('entry-session.json', { accountId, token });
  const created = await invoke('POST', '/v1/character', { name: 'Law Entry' }, 'law-entry-character');
  const characterId = created.body.id;
  policy = createLawPolicy({ accountId, seed: 'rc1-alpha' });
  const rules = (await invoke('GET', '/v1/rules')).body;
  async function view(label) {
    return observed({ label, authority: 'ordinary-own-views', logicalAt: at }, async () => {
      const session = (await raw('GET', '/v1/session', undefined, undefined, label + '-session')).body;
      const me = (await raw('GET', '/v1/me', undefined, undefined, label + '-me')).body;
      const law = (await raw('GET', '/v1/law', undefined, undefined, label + '-law')).body;
      return { accountId: app.jwt.verify(token).sub, session, me, law, rules };
    });
  }
  async function choose(projection, phase, label) {
    const decision = policy.choose(projection, { logicalAt: at, phase });
    await proof.record({ kind: 'policy-choice', label, logicalAt: at, viewSha256: sha256(JSON.stringify(projection)), decision });
    if (decision.kind === 'command') {
      const checkpoint = policy.checkpoint(); await proof.artifact(label + '-pending.json', checkpoint);
      policy = createLawPolicy({ accountId, seed: 'rc1-alpha' }).restore(checkpoint);
      assert.deepEqual(policy.choose(projection, { logicalAt: at, phase }), decision);
    }
    return decision;
  }
  async function execute(decision, label) {
    const r = decision.request, response = await invoke(r.method, r.path, r.body, r.idempotencyKey, label);
    policy.settle({ idempotencyKey: r.idempotencyKey, status: 'COMPLETED', replayed: response.replayed, response: response.body });
    return response;
  }
  async function advance(deadline) {
    assert(deadline > at); let prior = await resources();
    await controller.advanceTo(deadline, async (logicalAt, label) => {
      const after = await resources(); await reconcile(prior, after, { authority: 'original-worker-callback', label, logicalAt });
      await invariants('worker:' + label); prior = await resources();
    });
  }
  const initial = await view('initial'); assert.equal(initial.me.character.heat, 0); assert.equal(initial.law.exposure, 0);
  assert.equal(initial.law.indicted, false); assert.equal(initial.me.character.cash, 500);
  await proof.record({ kind: 'measured-initialization', ordinaryEntrants: 1, directFixtureWrites: 0, fixtureWritesAfterThisRecord: false });
  const invariantChecks = await invariants('initial'); await proof.snapshot(pool, 'initial');
  await observed({ authority: 'original-worker-boot' }, () => bootOriginalWorker(controller)); await invariants('worker-boot');
  let persistedIndictment = false, iteration = 0, pressureAttempts = 0;
  while (!persistedIndictment && iteration < 2000 && at <= epoch + configuration.limits.maximumLogicalPressureHours * 3600000) {
    const projection = await view('pressure-' + iteration), own = projection.me.character;
    trajectory.push({ logicalAt: at, heat: own.heat, nerve: own.nerve, exposure: projection.law.exposure,
      stage: projection.law.stage, indicted: projection.law.indicted });
    const decision = await choose(projection, 'pressure', 'pressure-' + iteration++);
    if (decision.kind === 'wait') {
      assert(decision.retryAfterSeconds > 0, JSON.stringify(decision)); await advance(at + decision.retryAfterSeconds * 1000); continue;
    }
    assert(++pressureAttempts <= configuration.limits.maximumPressureChoices);
    await execute(decision, 'pressure-' + pressureAttempts);
    // Observations never feed choice: this only checks the completed canonical mutation persisted the public case.
    if (projection.law.indicted) {
      const row = (await pool.query('SELECT heat,heat_exposure,indicted_at FROM characters WHERE id=$1', [characterId])).rows[0];
      assert(row.indicted_at && Number(row.heat_exposure) >= projection.law.thresholds.indict);
      await proof.artifact('actual-indictment.json', row); persistedIndictment = true;
    }
  }
  assert(persistedIndictment, 'Declared24h bound did not produce a canonical persisted indictment');
  await proof.artifact('pressure-trajectory.json', { observations: trajectory }); await proof.snapshot(pool, 'indicted');
  for (const stage of ['clean', 'watched', 'investigation', 'indicted']) assert(trajectory.some((v) => v.stage === stage), 'Missing actual public stage ' + stage);
  assert(trajectory.some((v) => v.heat === 100));
  const quote = await view('plea-quote'); assert.equal(quote.law.plea.jailSeconds, 240);
  const before = (await pool.query('SELECT * FROM characters WHERE id=$1', [characterId])).rows[0];
  const taxBefore = Number((await pool.query('SELECT pool FROM street_tax WHERE id=1')).rows[0].pool);
  const pleaDecision = await choose(quote, 'plea', 'plea'), plea = await execute(pleaDecision, 'ordinary-plea');
  assert.equal(plea.body.forfeited, Math.floor((Number(before.cash) + Number(before.bank)) * quote.law.plea.forfeitRate));
  assert(plea.body.forfeited > 0); const jailDeadline = at + plea.body.jailSeconds * 1000;
  const after = (await pool.query('SELECT * FROM characters WHERE id=$1', [characterId])).rows[0];
  assert.equal(Number(before.cash) + Number(before.bank) - Number(after.cash) - Number(after.bank), plea.body.forfeited);
  assert.equal(Number((await pool.query('SELECT pool FROM street_tax WHERE id=1')).rows[0].pool) - taxBefore, plea.body.forfeited);
  assert(after.alive && after.id === characterId && !after.indicted_at); assert.equal(new Date(after.jail_until).getTime(), jailDeadline);
  const ledger = (await pool.query("SELECT * FROM transactions WHERE character_id=$1 AND reason='law:plea'", [characterId])).rows;
  assert.equal(ledger.length, 1); assert.equal(Number(ledger[0].amount), -plea.body.forfeited);
  await proof.artifact('plea-loss.json', { before, after, ledger, taxBefore, response: plea.body });
  const beforeReplay = await proof.snapshot(pool, 'plea-before-replay');
  const retry = await execute(pleaDecision, 'plea-exact-replay'); assert(retry.replayed); assert.deepEqual(retry.body, plea.body);
  assert.equal((await proof.snapshot(pool, 'plea-after-replay')).stateSha256, beforeReplay.stateSha256);
  const detained = await view('detained'), wait = await choose(detained, 'recover', 'detained');
  assert.equal(wait.kind, 'wait'); assert.equal(wait.reason, 'original-detention'); assert.equal(wait.retryAfterSeconds, 240);
  const denial = await invoke('POST', '/v1/crimes/pick', { approach: 'quiet' }, 'negative-jailed-crime', 'negative-jailed-crime', null);
  assert([400, 409].includes(denial.status) && denial.body.error === 'jailed', JSON.stringify(denial));
  await advance(jailDeadline - 1000);
  const still = await view('one-second-left'); assert.equal(still.me.character.jailSeconds, 1);
  assert.equal((await choose(still, 'recover', 'one-second-left')).kind, 'wait');
  await advance(jailDeadline);
  const released = await view('released'); assert.equal(released.me.character.jailSeconds, 0); assert.equal(released.me.character.id, characterId);
  let recovered = null;
  for (let i = 0; i < configuration.limits.maximumRecoveryAttempts && !recovered; i++) {
    const projection = await view('recovery-' + i), decision = await choose(projection, 'recover', 'recovery-' + i);
    if (decision.kind === 'wait') { assert(decision.retryAfterSeconds > 0); await advance(at + decision.retryAfterSeconds * 1000); continue; }
    const response = await execute(decision, 'recovery-' + i);
    if (response.body.success) {
      const next = await view('recovered');
      assert.equal(next.me.character.respect - projection.me.character.respect, response.body.rep);
      assert.equal(next.me.character.cash - projection.me.character.cash, response.body.take);
      recovered = { response: response.body, before: projection.me.character, after: next.me.character };
    }
  }
  assert(recovered, 'No successful quiet progression within declared recovery bound');
  await proof.artifact('recovered-progression.json', recovered);
  await invariants('final'); const final = await proof.snapshot(pool, 'final'), trace = controller.diagnostic(); assert.equal(trace.failures.length, 0);
  const hours = Math.floor((at - epoch) / 3600000), fiveMinutes = Math.floor((at - epoch) / 300000);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map((label) =>
    [label, trace.events.filter((entry) => entry.kind === 'timer.fire' && entry.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: fiveMinutes, guardedTick: hours, guardedSeasonTick: hours, 'health-boundary': fiveMinutes });
  await proof.artifact('worker-schedule.json', trace); await proof.artifact('random-tape.json', { draws: runtime.tape });
  await proof.artifact('policy-checkpoint.json', policy.checkpoint());
  await proof.artifact('resource-summary.json', { resourceSummaries, unsupported, qualifyingFullResourcePass: false });
  for (const line of (await fs.readFile(output + '/history.jsonl', 'utf8')).trim().split('\n')) JSON.parse(line);
  result = { status: 'PASS_SCOPED', ordinaryEntrants: 1, directFixtureWrites: 0, pressureAttempts,
    observedLogicalSeconds: (at - epoch) / 1000, stages: policy.summary().observedStages, maximumObservedHeat: policy.summary().maxHeat,
    actualPleaLoss: plea.body.forfeited, originalDetentionSeconds: 240, exactPleaRetries: 1, canonicalJailedDenials: 1,
    sameCharacterRecovered: true, quietRecoveryCash: recovered.response.take, quietRecoveryRespect: recovered.response.rep,
    invariantChecks, invariantBoundaries, resourceBoundaries: resourceSummaries.length, unsupportedResourceClassifications: unsupported.length,
    timerCounts, policy: policy.summary(), qualifyingFullResourcePass: false, finalStateSha256: final.stateSha256,
    matrixQualifying: false, exclusions: configuration.exclusions };
} catch (error) {
  result = { status: 'FAIL', message: error.message, stack: error.stack, logicalAt: at }; process.exitCode = 1;
  await proof.record({ kind: 'first-failure', ...result }); await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-resource-summary.json', { resourceSummaries, unsupported });
  await proof.artifact('failure-trajectory.json', { observations: trajectory, policy: policy?.checkpoint() || null });
  if (app) await proof.snapshot(app.pool, 'failure');
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = originalConsole[level];
  for (const close of [async () => { if (app) await app.close(); }, () => controller.close(), () => base.end(),
    async () => proof.record({ kind: 'database-cleanup', ...await database.close() })]) {
    try { await close(); } catch (error) { result.status = 'FAIL'; result.cleanupFailure = error.message; process.exitCode = 1;
      await proof.record({ kind: 'cleanup-failure', message: error.message }); }
  }
  seam.restore(); runtime.restore(); const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify(result));
