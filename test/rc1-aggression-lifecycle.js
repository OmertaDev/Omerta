// Twenty real mixed choices plus an actual same-account heir policy transition.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { createAggressionPolicy, AGGRESSION_POLICY_CONTRACT } from '../tools/rc1-aggression-policy.js';

assert(process.argv.includes('--postgres'), 'Explicit native PostgreSQL exercise only');
const output = process.env.RC1_AGGRESSION_LIFECYCLE_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(output && controlUrl, 'Fresh restricted output and explicit local PostgreSQL required');
const source = await sourceIdentity();
const database = planOwnedWorldDatabase({ controlUrl, runId: 'aggression-lifecycle-native', sourceRevision: source.revision });
for (const key of ['SEARCH_MS', 'SHOOT_CD_MS', 'SEASON_MOD', 'SEASON_PHASE', 'CHAIN_RPC_URL', 'LIQUIDITY_RPC_URL',
  'LIQUIDITY_RPC_FALLBACK_URL', 'INVARIANT_WEBHOOK_URL', 'CITY_WIRE_WEBHOOK_URL'])
  assert(!process.env[key], `Undeclared timing/external override: ${key}`);
const epoch = Date.parse('2026-09-20T12:00:00.000Z'), seasonMs = 28 * 86400000;
const expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
const configuration = { scenario: 'scoped-aggression-twenty-mixed-lifecycle-choices', seed: 'rc1-alpha', sourcePins: WORKER_SOURCE_PINS,
  policy: AGGRESSION_POLICY_CONTRACT,
  database: database.descriptor, epoch: new Date(epoch).toISOString(), expectedDormant,
  initialization: { actors: 2, shooterLevel: 600, victimLevel: 10, stats: 'Default5/5/5',
    resources: 'Schema-default cash500/ammo25/cb0. Shooter owns one declared legal Rusty .25 fixture. No earned acquisition history is claimed for fixture respect or weapon.',
    funding: 'One ordinary check-in each; shooter buys100 original $2,000/50-round boxes. Victim posts a $2,000 order with original4h TTL.',
    exclusions: 'No account privilege, paid mint, revive insurance, family membership, status/deadline or resource-balance fixtures.' },
  clocks: 'Shared application and SQL logical clocks; execute every due original local worker callback across original3h search. No wall-time equivalence or timer compression.',
  workload: 'Twenty actual policy selections at15-minute intervals. Require all20 genuinely mixed and14 actual conflict choices, with search/shot counts separate. A separate victim policy acts before death and after its canonical heir appears. Pending policy restores and exact fire retry retain identity. No fabricated denominator.',
  resourceCoverage: 'Current exact observer equations and55 canonical invariants; unknown receipt and ownership lineages remain explicit, never upgraded to full-resource clearance.',
  excludedIntegrations: ['chain watcher without configured RPC', 'disabled liquidity automation', 'unavailable external RWA registry', 'population spawning disabled'],
  exclusions: ['All conflict authorities and all actor behavior', 'naturally earned initial progression and weapon',
    'full13resource lineage', 'same-seed world replay', 'all death/ownership branches', '90days/225runs', 'production and real-player qualification'] };
Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on',
  COORDINATION_ACCOUNT_IDS: '', LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '',
  RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
const proof = await createProofRecorder({ directory: output, source, configuration, runId: 'aggression-lifecycle-native',
  seed: configuration.seed, scenarioId: configuration.scenario, population: 2 });
const runtime = installSerialRuntime(configuration.seed, configuration.epoch); let at = epoch;
runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: (value) => { at = value; }, expectedDormant });
const namespace = `rc1_worker_lifecycle_${process.pid}_${Math.floor(performance.now())}`;
const base = new pg.Pool({ connectionString: database.url });
const seam = installWorkerInstrumentation(controller, { namespace });
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
let app, result, resourceSequence = 0, invariantBoundaries = 0;
const unsupported = [], resourceSummaries = [];
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
  await proof.record({ kind: 'database-created', ...await database.create() });
  await base.query(`CREATE SCHEMA ${namespace}`);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 });
  await seam.clock.initialize(bootstrap);
  // Install the source-pinned loader before any production import can cache db.js.
  const [{ buildServer }, { PACING, CONSTANTS, M3, levelOf }, { runLedgerInvariants }, observer] = await Promise.all([
    import('../src/server.js'), import('../src/rules.js'), import('../src/invariants.js'), import('../tools/rc1-world-resource-observer.js')]);
  assert.equal(CONSTANTS.SEARCH_MS, 10800000); assert.equal(CONSTANTS.SHOOT_CD_MS, 7200000);
  app = await buildServer();
  const pool = app.pool;
  for (const [accountId, level] of [['heir-shooter', 600], ['heir-victim', 10]]) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [accountId]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [accountId]);
    await pool.query('INSERT INTO characters(id,account_id,name,season,respect) VALUES($1,$2,$2,$3,$4)',
      [`${accountId}-character`, accountId, Math.floor(epoch / seasonMs), PACING.LEVEL_DIVISOR * (level - 1) ** 2]);
  }
  await pool.query("INSERT INTO character_guns(character_id,gun_id) VALUES('heir-shooter-character','lastresort')");
  // Owned weapon selection remains an ordinary authenticated action below.
  const tokens = Object.fromEntries(['heir-shooter', 'heir-victim'].map((id) => [id, app.jwt.sign({ sub: id, tv: 0 })]));
  const invariants = async (label) => {
    const report = await runLedgerInvariants(pool, { alert: false }); assert(report.ok, JSON.stringify(report));
    invariantBoundaries++; await proof.record({ kind: 'canonical-invariants', label, logicalAt: at, checks: report.checks });
    return report.checks.length;
  };
  async function reconcile(before, after, identity) {
    const journal = observer.reconcileWorldResources(before, after, { identity, includeRestrictedChanges: true });
    const label = `resource-${resourceSequence++}`;
    await proof.artifact(`${label}.json`, journal);
    unsupported.push(...journal.unsupported.map((entry) => ({ boundary: label, ...entry })));
    resourceSummaries.push({ label, identity, beforeHash: journal.beforeHash, afterHash: journal.afterHash,
      status: journal.status, checks: journal.checks.length, unsupported: journal.unsupported.length });
    await proof.record({ kind: 'resource-boundary', ...resourceSummaries.at(-1) });
  }
  async function observed(identity, work) {
    const before = await observer.snapshotWorldResources(pool); let value, actionError;
    try { value = await work(); } catch (error) { actionError = error; }
    const after = await observer.snapshotWorldResources(pool);
    try { await reconcile(before, after, identity); }
    catch (error) {
      await proof.artifact(`resource-failure-${resourceSequence++}.json`, { identity, before, after, error: error.message }); throw error;
    }
    if (actionError) throw actionError; return value;
  }
  async function invoke(accountId, method, path, body, key, expectedStatus = 200) {
    const identity = { accountId, method, path, logicalAt: at,
      ...(body === undefined ? {} : { body }), ...(key === undefined ? {} : { key }) };
    const response = await observed(identity, () => proof.invoke('authenticated-http', identity, async () => {
      const raw = await app.inject({ method, url: path, headers: { authorization: `Bearer ${tokens[accountId]}`,
        ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { payload: body }) });
      return { status: raw.statusCode, replayed: raw.headers['x-idempotent-replay'] === 'true', body: raw.json() };
    }));
    assert.equal(response.status, expectedStatus, JSON.stringify(response));
    if (method !== 'GET') await invariants(path);
    return response;
  }
  const shooter = 'heir-shooter', victim = 'heir-victim', oldId = `${victim}-character`;
  const initialInvariantChecks = await invariants('fixture');
  await proof.record({ kind: 'measured-initialization', fixture: configuration.initialization, fixtureWritesAfterThisRecord: false });
  await proof.snapshot(pool, 'initial');
  for (const account of [shooter, victim]) await invoke(account, 'POST', '/v1/checkin', {}, `checkin-${account}`);
  await invoke(shooter, 'POST', '/v1/armory/gun/lastresort/equip', {}, 'equip-fixture-weapon');
  for (let box = 0; box < 100; box++) await invoke(shooter, 'POST', '/v1/armory/ammo', {}, `buy-ammo-${box}`);
  const order = await invoke(victim, 'POST', '/v1/market/order', { goodId: 'gin', qty: 1, price: 2000, hours: 4 }, 'victim-custody-order');
  assert.equal(order.body.escrow, 2000); assert.equal(order.body.expiresSeconds, 14400);
  const policies = Object.fromEntries([shooter, victim].map((accountId) =>
    [accountId, createAggressionPolicy({ accountId, seed: configuration.seed })]));
  const options = { [shooter]: {}, [victim]: {} }, decisions = [];
  async function observe(accountId) {
    const query = new URLSearchParams(options[accountId]).toString(), view = {};
    for (const [field, path] of [['commands', '/v1/commands' + (query ? '?' + query : '')],
      ['me', '/v1/me'], ['streets', '/v1/streets'], ['rivals', '/v1/rivals']])
      view[field] = (await invoke(accountId, 'GET', path)).body;
    return view;
  }
  async function act(accountId, label) {
    const view = await observe(accountId), policy = policies[accountId];
    const decision = policy.choose(view, { logicalAt: at });
    await proof.record({ kind: 'policy-choice', label, accountId, decision, policy: policy.summary() });
    assert.equal(decision.kind, 'command', 'This declared bounded block needs an actual legal command');
    await proof.artifact(label + '-pending.json', policy.checkpoint());
    const restored = createAggressionPolicy({ accountId, seed: configuration.seed }).restore(policy.checkpoint());
    assert.deepEqual(restored.choose(view, { logicalAt: at }), decision); policies[accountId] = restored;
    const request = decision.request;
    const response = await invoke(accountId, request.method, request.path, request.body, request.idempotencyKey);
    restored.settle({ idempotencyKey: request.idempotencyKey, status: 'COMPLETED',
      replayed: response.replayed || response.body.replayed === true, response: response.body });
    if (decision.type === 'mystery.start') options[accountId].mysteryGraphId = decision.parameters.graphId;
    decisions.push({ accountId, label, type: decision.type, category: decision.category, mixed: decision.mixed,
      actor: decision.actor, key: request.idempotencyKey, response: response.body });
    await proof.snapshot(pool, label + '-after');
    return { decision, response };
  }
  // Establish the victim's original character cursor through an actual completion.
  await act(victim, 'victim-before-death');
  await observed({ authority: 'original-worker-boot', logicalAt: at }, () => bootOriginalWorker(controller));
  await invariants('worker-boot');
  let firstHeir = null, exactFireRetries = 0, expectedSearchDeadline = null;
  for (let step = 0; step < 20; step++) {
    let previousResources = await observer.snapshotWorldResources(pool);
    await controller.advanceTo(epoch + step * 15 * 60000, async (logicalAt, label) => {
      const after = await observer.snapshotWorldResources(pool);
      await reconcile(previousResources, after, { authority: 'original-worker-callback', label, logicalAt });
      previousResources = after; await invariants('worker:' + label);
    });
    const { decision, response } = await act(shooter, 'mixed-' + step);
    assert.equal(decision.mixed, true, 'Do not pad a mixed-choice quota with forced actions');
    assert.equal(policies[shooter].summary().mixedConflict, Math.floor((step + 1) * 7 / 10));
    if (decision.type === 'legacy.search') {
      expectedSearchDeadline = Date.parse(response.body.placedAt);
      assert.equal(expectedSearchDeadline - at, CONSTANTS.SEARCH_MS);
    }
    if (decision.type === 'legacy.fire') {
      assert(expectedSearchDeadline !== null && at >= expectedSearchDeadline);
      assert.equal(response.body.shootCdSeconds, 7200);
      const beforeReplay = await proof.snapshot(pool, 'fire-replay-' + step + '-before');
      const r = decision.request, replay = await invoke(shooter, r.method, r.path, r.body, r.idempotencyKey);
      assert.equal(replay.replayed, true); assert.deepEqual(replay.body, response.body);
      policies[shooter].settle({ idempotencyKey: r.idempotencyKey, status: 'COMPLETED', replayed: true, response: replay.body });
      const afterReplay = await proof.snapshot(pool, 'fire-replay-' + step + '-after');
      assert.equal(afterReplay.stateSha256, beforeReplay.stateSha256); exactFireRetries++;
      if (response.body.kill && !firstHeir) {
        firstHeir = response.body.estate.heirId; assert(firstHeir && firstHeir !== oldId);
        assert.equal((await pool.query('SELECT alive FROM characters WHERE id=$1', [oldId])).rows[0].alive, false);
        assert.equal((await pool.query('SELECT 1 FROM market_listings WHERE id=$1', [order.body.id])).rowCount, 0);
        const replacement = await act(victim, 'victim-after-death');
        assert.equal(replacement.decision.actor.characterId, firstHeir);
        assert.equal(replacement.decision.actor.generation, 2);
        assert.equal(policies[victim].summary().replacements, 1);
        assert.equal(policies[victim].summary().fresh, 2, 'Account quota continues across character replacement');
        await proof.artifact('canonical-heir-cursor.json', policies[victim].checkpoint());
      }
    }
    if (step % 5 === 4) originalConsole.log(JSON.stringify({ phase: 'mixed-choices', completed: step + 1,
      logicalAt: at, conflicts: policies[shooter].summary().mixedConflict }));
  }
  const summary = policies[shooter].summary();
  assert.equal(summary.fresh, 20); assert.equal(summary.mixedFresh, 20); assert.equal(summary.mixedConflict, 14);
  assert.equal(summary.forcedConflict + summary.forcedOther + summary.denials + summary.unresolvedReplays, 0);
  assert(summary.searches > 0 && summary.shots > 0 && summary.kills > 0); assert(firstHeir);
  assert.equal(summary.knownReplays, exactFireRetries); assert(exactFireRetries > 0);
  const trace = controller.diagnostic(); assert.equal(trace.failures.length, 0);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map((label) =>
    [label, trace.events.filter((entry) => entry.kind === 'timer.fire' && entry.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: 57, guardedTick: 4, guardedSeasonTick: 4, 'health-boundary': 57 });
  await invariants('final'); const final = await proof.snapshot(pool, 'final');
  await proof.artifact('worker-schedule.json', trace); await proof.artifact('random-tape.json', { draws: runtime.tape });
  await proof.artifact('resource-summary.json', { resourceSummaries, unsupported, qualifyingFullResourcePass: false });
  await proof.artifact('policy-results.json', { decisions, shooter: policies[shooter].checkpoint(), victim: policies[victim].checkpoint() });
  for (const line of (await fs.readFile(output + '/history.jsonl', 'utf8')).trim().split('\n')) JSON.parse(line);
  result = { status: 'PASS_SCOPED', policy: summary, victimPolicy: policies[victim].summary(),
    elapsedLogicalMs: at - epoch, elapsedWallTimeClaim: false, timerCounts,
    invariantChecks: initialInvariantChecks, invariantBoundaries, resourceBoundaries: resourceSummaries.length,
    unsupportedResourceClassifications: unsupported.length, qualifyingFullResourcePass: false,
    sameAccountHeirObserved: true, exactFireRetries, originalEscrow: 2000,
    postgres: (await pool.query('SELECT version() AS version')).rows[0].version,
    finalStateSha256: final.stateSha256, matrixQualifying: false, exclusions: configuration.exclusions };
} catch (error) {
  result = { status: 'FAIL', message: error.message, stack: error.stack, logicalAt: at }; process.exitCode = 1;
  await proof.record({ kind: 'first-failure', ...result });
  await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-random-tape.json', { draws: runtime.tape });
  await proof.artifact('failure-resource-summary.json', { resourceSummaries, unsupported });
  if (app) await proof.snapshot(app.pool, 'failure');
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = originalConsole[level];
  for (const close of [async () => { if (app) await app.close(); }, () => controller.close(), () => base.end(),
    async () => proof.record({ kind: 'database-cleanup', ...await database.close() })]) {
    try { await close(); }
    catch (error) { result.status = 'FAIL'; result.cleanupFailure = error.message; process.exitCode = 1; await proof.record({ kind: 'cleanup-failure', message: error.message }); }
  }
  seam.restore(); runtime.restore();
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify(result));
