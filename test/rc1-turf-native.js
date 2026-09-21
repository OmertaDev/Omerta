// Three opposing Families, one actual district, concurrent sealed stakes and original worker settlement.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { createTurfPolicy, TURF_POLICY_CONTRACT } from '../tools/rc1-turf-policy.js';
import { snapshotTurfCustody, reconcileTurfCustody } from '../tools/rc1-turf-custody.js';
import { reconcileFamilyCashAmmo } from '../tools/rc1-family-cash-ammo-journal.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, sha256 } from '../tools/rc1-native-proof.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
assert(process.argv.includes('--postgres'), 'Explicit native PostgreSQL required');
const output = process.env.RC1_TURF_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(output && controlUrl, 'Fresh restricted output and local control database required');
const source = await sourceIdentity(), database = planOwnedWorldDatabase({ controlUrl, runId: 'turf-native', sourceRevision: source.revision });
for (const key of ['LAW_BUST_P', 'SEASON_MOD', 'SEASON_PHASE', 'CHAIN_RPC_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL',
  'INVARIANT_WEBHOOK_URL', 'CITY_WIRE_WEBHOOK_URL']) assert(!process.env[key], 'Undeclared override: ' + key);
const epoch = Date.parse('2026-09-20T12:00:00.000Z'), districtId = 'cathedral', expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
const configuration = { scenario: 'scoped-three-family-single-turf-contention', contract: TURF_POLICY_CONTRACT, database: database.descriptor,
  sourcePins: WORKER_SOURCE_PINS, epoch: new Date(epoch).toISOString(), expectedDormant,
  initialization: 'Four ordinary entrants; three founders receive level400 respect eligibility only. Actual140000 check-ins,25000 formations and100000 tributes create each treasury. Incumbent canonically seizes naturally unoccupied Cathedral before baseline. No balance/item/membership/district/deadline SQL writes.',
  measured: 'One incumbent defense and two rival claims, selected independently before dispatch with own commitment rates70%,60%,80% plus deterministic jitter; all three canonical requests concurrently contend on one district. Original returned contest deadline, all original due callbacks through two hours, one terminal winner and loser refund/burn paths.',
  lifecycle: 'Observe one second before deadline, exact deadline before hourly sweep, first original hourly settlement, then second original hourly sweep. No direct resolver calls or shortened durations.',
  concurrency: 'Request invocation and response-completion order retained; aggregate complete snapshots bound the batch. PostgreSQL total commit order is not claimed.',
  privacy: TURF_POLICY_CONTRACT.privacy,
  resourceScope: 'Focused exact unchartered turf escrow equations with canonical receipts and original job authority; reuse Family journal without relabeling its unsupported turf branches; unchanged shared observer unknowns retained.',
  exclusions: ['Three-way declareWar triangle', 'war/spoils/OMR', 'charter modifiers and dissolved bidders', 'incumbent tie native exercise',
    'other objectives and resource taxonomy', 'same-seed fresh-world replay', '25 actors/90 days/three seeds/225-run matrix', 'production and real people'] };
Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', COORDINATION_ACCOUNT_IDS: '',
  LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on',
  SOCIAL_VERIFY_MODE: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
const proof = await createProofRecorder({ directory: output, source, configuration, runId: 'turf-native', seed: 'rc1-alpha', scenarioId: configuration.scenario, population: 4 });
const runtime = installSerialRuntime('rc1-alpha', configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: (v) => { at = v; }, expectedDormant });
const namespace = 'rc1_worker_turf_' + process.pid + '_' + Math.floor(performance.now());
const base = new pg.Pool({ connectionString: database.url }), seam = installWorkerInstrumentation(controller, { namespace });
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
let app, result, measured = false, sequence = 0, invariantBoundaries = 0, requestOrder = 0, completionOrder = 0;
const actors = [], policies = new Map(), resourceSummary = [], unknown = [], turfSummary = [], familyUnknown = [], requests = [], outcomes = [];
try {
  for (const k of ['log', 'warn', 'error']) console[k] = (...args) => controller.log(k, args);
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query('CREATE SCHEMA ' + namespace);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap);
  const [{ buildServer }, { runLedgerInvariants }, observer, { PACING }] = await Promise.all([
    import('../src/server.js'), import('../src/invariants.js'), import('../tools/rc1-world-resource-observer.js'), import('../src/rules.js')]);
  app = await buildServer(); const pool = app.pool;
  async function invariants(label) {
    const r = await runLedgerInvariants(pool, { alert: false }); assert(r.ok, JSON.stringify(r)); invariantBoundaries++;
    await proof.record({ kind: 'canonical-invariants', label, logicalAt: at, checks: r.checks }); return r.checks.length;
  }
  const snapshot = async () => ({ global: await observer.snapshotWorldResources(pool), turf: measured ? await snapshotTurfCustody(pool) : null });
  async function reconcile(before, after, identity, operations = [], workerJobs = []) {
    const label = 'boundary-' + sequence++;
    try {
      const global = observer.reconcileWorldResources(before.global, after.global, { identity, includeRestrictedChanges: true });
      await proof.artifact(label + '-resource.json', global); resourceSummary.push({ label, checks: global.checks.length, unknown: global.unsupported.length });
      unknown.push(...global.unsupported.map((r) => ({ boundary: label, ...r })));
      if (measured) {
        const turf = reconcileTurfCustody(before.turf, after.turf, { districtId, operations, workerJobs });
        const family = reconcileFamilyCashAmmo(before.turf.family, after.turf.family);
        await proof.artifact(label + '-turf.json', { identity, before: before.turf, after: after.turf, operations, workerJobs, journal: turf, familyJournal: family });
        turfSummary.push({ label, checks: turf.checks.length, settled: turf.settled, flows: turf.flows });
        familyUnknown.push(...family.unsupported.map((r) => ({ boundary: label, ...r })));
      }
    } catch (error) { await proof.artifact(label + '-failure.json', { identity, before, after, operations, workerJobs, message: error.message }); throw error; }
  }
  async function observed(identity, work, operationOf = () => []) {
    const before = await snapshot(); let value, error;
    try { value = await work(); } catch (e) { error = e; }
    await reconcile(before, await snapshot(), identity, value ? operationOf(value) : []); if (error) throw error; return value;
  }
  async function raw(actor, method, path, body, key, label) {
    const order = ++requestOrder;
    const r = await proof.invoke('ordinary-http', { accountId: actor?.accountId || null, method, path, label, logicalAt: at, order,
      ...(body === undefined ? {} : { body }), ...(key === undefined ? {} : { key }) }, async () => {
      const reply = await app.inject({ method, url: path, headers: { ...(actor ? { authorization: 'Bearer ' + actor.token } : {}),
        ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { payload: body }) });
      return { status: reply.statusCode, replayed: reply.headers['x-idempotent-replay'] === 'true', body: reply.json() };
    });
    requests.push({ order, completedOrder: ++completionOrder, accountId: actor?.accountId || null, method, path,
      ...(key === undefined ? {} : { key }), result: r }); return r;
  }
  const operation = (actor, key, body, result) => ({ accountId: actor.accountId, characterId: actor.characterId,
    method: 'POST', path: '/v1/districts/' + districtId + '/claim', key, body, result });
  async function invoke(actor, method, path, body, key, label = path, expected = 200) {
    const r = await observed({ label, method, path, logicalAt: at }, () => raw(actor, method, path, body, key, label),
      (r) => measured && method === 'POST' && path.endsWith('/claim') ? [operation(actor, key, body, r)] : []);
    assert.equal(r.status, expected, JSON.stringify(r)); if (method !== 'GET') await invariants(label); return r;
  }
  for (let i = 0; i < 4; i++) {
    const bootstrapSecret = crypto.randomBytes(32).toString('base64url'), name = 'Turf Entry ' + i;
    const guest = await invoke(null, 'POST', '/v1/auth/guest', { bootstrapSecret }, undefined, 'guest-' + i);
    const actor = { index: i, name, accountId: app.jwt.verify(guest.body.token).sub, token: guest.body.token };
    const created = await invoke(actor, 'POST', '/v1/character', { name }, 'entry-' + i); actor.characterId = created.body.id; actors.push(actor);
    await proof.artifact('entry-' + i + '.json', { bootstrapSecret, ...actor });
  }
  const founders = actors.slice(0, 3), fixture = [];
  for (const actor of founders) {
    const before = (await pool.query('SELECT id,respect,cash,ammo FROM characters WHERE id=$1', [actor.characterId])).rows[0], respect = PACING.LEVEL_DIVISOR * 399 ** 2;
    await pool.query('UPDATE characters SET respect=$2 WHERE id=$1', [actor.characterId, respect]); fixture.push({ before, after: { respect } });
    await invoke(actor, 'POST', '/v1/checkin', undefined, 'initial-checkin-' + actor.index);
    const formed = await invoke(actor, 'POST', '/v1/gangs', { name: 'Turf Family ' + actor.index, tag: 'T' + actor.index }, 'initial-family-' + actor.index);
    actor.familyId = formed.body.gangId; await invoke(actor, 'POST', '/v1/gangs/tribute', { amount: 100000 }, 'initial-tribute-' + actor.index);
    policies.set(actor.accountId, createTurfPolicy({ accountId: actor.accountId, seed: 'rc1-alpha', commitBps: [7000, 6000, 8000][actor.index] }));
  }
  const publicDistricts = (await invoke(founders[0], 'GET', '/v1/districts')).body;
  const initialDistrict = publicDistricts.districts.find((d) => d.id === districtId); assert(!initialDistrict.holder && !initialDistrict.occupiedBy);
  const seized = await invoke(founders[0], 'POST', '/v1/districts/' + districtId + '/seize', undefined, 'initial-seize');
  await proof.artifact('initialization.json', { respectFixtures: fixture, cashAndAmmoFixtures: 0, initialDistrict, seizure: seized.body,
    canonicalTreasuryFunding: 100000, founderCount: 3, directMembershipOrDeadlineEdits: 0 });
  await observed({ authority: 'original-worker-boot' }, () => bootOriginalWorker(controller)); await invariants('worker-boot');
  measured = true; await proof.record({ kind: 'measured-initialization', initialRespectFixtures: 3, actualFamilies: 3, fixtureWritesAfterThisRecord: false });
  const invariantChecks = await invariants('initial'); await proof.snapshot(pool, 'initial');
  async function view(actor) {
    return observed({ authority: 'own-public-policy-view', accountId: actor.accountId, logicalAt: at }, async () => {
      const get = async (path) => { const r = await raw(actor, 'GET', path, undefined, undefined, 'public-view'); assert.equal(r.status, 200); return r.body; };
      return { accountId: app.jwt.verify(actor.token).sub, session: await get('/v1/session'), me: await get('/v1/me'),
        districts: await get('/v1/districts'), notifications: await get('/v1/notifications') };
    });
  }
  const choices = [];
  for (const actor of founders) {
    const projection = await view(actor), policy = policies.get(actor.accountId), decision = policy.choose(projection, { districtId, logicalAt: at });
    assert.equal(decision.kind, 'command'); const checkpoint = policy.checkpoint(); await proof.artifact('choice-' + actor.index + '.json', { projection, decision, checkpoint });
    const restored = createTurfPolicy({ accountId: actor.accountId, seed: 'rc1-alpha', commitBps: [7000, 6000, 8000][actor.index] }).restore(checkpoint);
    assert.deepEqual(restored.choose(projection, { districtId, logicalAt: at }), decision); policies.set(actor.accountId, restored);
    choices.push({ actor, decision, projection });
  }
  const start = at;
  const stakeResults = await observed({ authority: 'concurrent-three-family-claims', inflight: 3, logicalAt: at },
    () => Promise.all(choices.map(({ actor, decision }) => { const r = decision.request; return raw(actor, r.method, r.path, r.body, r.idempotencyKey, 'concurrent-stake-' + actor.index); })),
    (responses) => choices.map(({ actor, decision }, i) => operation(actor, decision.request.idempotencyKey, decision.request.body, responses[i])));
  await invariants('concurrent-stakes');
  for (const [i, r] of stakeResults.entries()) {
    assert.equal(r.status, 200); assert.equal(r.replayed, false); const choice = choices[i];
    policies.get(choice.actor.accountId).settle({ idempotencyKey: choice.decision.request.idempotencyKey, status: 'COMPLETED', replayed: false, response: r.body });
  }
  assert.equal(stakeResults.filter((r) => r.body.defending).length, 1);
  assert.equal(new Set(stakeResults.map((r) => r.body.staked)).size, 3);
  const deadline = start + stakeResults[0].body.resolvesSeconds * 1000;
  assert(stakeResults.every((r) => start + r.body.resolvesSeconds * 1000 === deadline)); assert(deadline <= epoch + 1800000);
  const committed = await snapshotTurfCustody(pool); assert.equal(committed.bids.filter((r) => r.district_id === districtId).length, 3);
  assert.equal(new Date(committed.districts.find((d) => d.id === districtId).contest_until).getTime(), deadline);
  await proof.artifact('contested-state.json', { committed, deadline, responses: stakeResults }); await proof.snapshot(pool, 'contested');
  const projection = (await view(actors[3])).districts.districts.find((d) => d.id === districtId);
  const beforePublic = choices[0].projection.districts.districts.find((d) => d.id === districtId), { contest: _old, ...basePublic } = beforePublic;
  assert.deepEqual(projection, { ...basePublic, contest: { families: 3, resolvesSeconds: stakeResults[0].body.resolvesSeconds } });
  await proof.artifact('public-projection-isolation.json', { before: beforePublic, during: projection,
    exactlyOnlyContestCountAndDeadlineAdded: true, noRivalBalancesWerePolicyInputs: true, caveat: TURF_POLICY_CONTRACT.privacy });
  const denied = await invoke(actors[3], 'POST', '/v1/districts/' + districtId + '/claim', { amount: 50000 }, 'outsider-stake', 'outsider-no-family', 400);
  assert.equal(denied.body.error, 'rank');
  async function replay(index, label) {
    const { actor, decision } = choices[index], r = decision.request, before = await proof.snapshot(pool, label + '-before');
    const response = await invoke(actor, r.method, r.path, r.body, r.idempotencyKey, label); assert(response.replayed); assert.deepEqual(response.body, stakeResults[index].body);
    policies.get(actor.accountId).settle({ idempotencyKey: r.idempotencyKey, status: 'COMPLETED', replayed: true, response: response.body });
    assert.equal((await proof.snapshot(pool, label + '-after')).stateSha256, before.stateSha256);
  }
  await replay(0, 'predeadline-exact-replay');
  async function advance(to) {
    let prior = await snapshot(), jobIndex = controller.diagnostic().jobs.length;
    await controller.advanceTo(to, async (logicalAt, label) => {
      const after = await snapshot(), jobs = controller.diagnostic().jobs.slice(jobIndex);
      await reconcile(prior, after, { authority: 'original-worker-callback', label, logicalAt }, [], jobs);
      await invariants('worker:' + label); prior = await snapshot(); jobIndex = controller.diagnostic().jobs.length;
    });
    await reconcile(prior, await snapshot(), { authority: 'logical-clock-terminal-boundary', logicalAt: at });
  }
  await advance(deadline - 1000);
  for (const actor of founders) { const current = await view(actor); assert.equal(current.districts.districts.find((d) => d.id === districtId).contest.resolvesSeconds, 1);
    assert.equal(policies.get(actor.accountId).choose(current, { districtId, logicalAt: at }).reason, 'original-contest-window'); }
  await advance(deadline);
  assert.equal((await snapshotTurfCustody(pool)).bids.length, 3, 'Elapsed contest timer alone must not fabricate settlement');
  for (const actor of founders) assert.equal(policies.get(actor.accountId).choose(await view(actor), { districtId, logicalAt: at }).reason, 'await-canonical-settlement');
  await proof.snapshot(pool, 'expired-before-sweep');
  await advance(epoch + 3600000);
  const settled = await snapshotTurfCustody(pool); assert.equal(settled.bids.length, 0);
  for (const actor of founders) {
    const current = await view(actor), outcome = policies.get(actor.accountId).choose(current, { districtId, logicalAt: at });
    assert.equal(outcome.kind, 'outcome'); outcomes.push({ actor: actor.index, familyId: actor.familyId, ...outcome });
    await proof.artifact('outcome-' + actor.index + '.json', { projection: current, outcome });
  }
  assert.equal(outcomes.filter((r) => r.won).length, 1); assert.equal(outcomes.filter((r) => !r.won && r.refunded > 0).length, 2);
  await proof.snapshot(pool, 'settled'); await replay(2, 'postsettlement-exact-replay');
  await advance(epoch + 7200000);
  const sweeps = controller.diagnostic().jobs.filter((j) => j.label === 'turf contest sweep' && j.status === 'RETURNED');
  assert.equal(sweeps.filter((j) => j.result?.resolved === 1).length, 1); assert.equal(sweeps.at(-1).result.resolved, 0);
  assert.equal((await snapshotTurfCustody(pool)).bids.length, 0);
  await invariants('final'); const final = await proof.snapshot(pool, 'final'), trace = controller.diagnostic(); assert.equal(trace.failures.length, 0);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map((label) => [label, trace.events.filter((e) => e.kind === 'timer.fire' && e.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: 24, guardedTick: 2, guardedSeasonTick: 2, 'health-boundary': 24 });
  await proof.artifact('worker-schedule.json', trace); await proof.artifact('random-tape.json', { draws: runtime.tape }); await proof.artifact('requests.json', requests);
  await proof.artifact('resource-summary.json', { resourceSummary, unknown, turfSummary, familyUnknown, qualifyingFullResourcePass: false });
  await proof.artifact('policy-checkpoints.json', founders.map((a) => ({ accountId: a.accountId, checkpoint: policies.get(a.accountId).checkpoint() })));
  result = { status: 'PASS_SCOPED', actualFamilies: 3, ordinaryEntrants: 4, initialRespectFixtures: 3, otherDirectGameplayFixtureWrites: 0,
    objective: districtId, simultaneousClaimRequests: 3, originalContestSeconds: (deadline - start) / 1000,
    originalSettlementDelaySeconds: (epoch + 3600000 - deadline) / 1000, stakes: stakeResults.map((r) => r.body.staked), outcomes,
    exactReplays: 2, ownPermissionDenials: 1, canonicalTerminalSettlements: 1, terminalSecondSweepResolved: 0,
    invariantChecks, invariantBoundaries, resourceBoundaries: resourceSummary.length, resourceChecks: resourceSummary.reduce((n, r) => n + r.checks, 0),
    turfBoundaries: turfSummary.length, turfChecks: turfSummary.reduce((n, r) => n + r.checks, 0),
    sharedObserverUnknown: unknown.length, familyJournalUnknown: familyUnknown.length, observedLogicalSeconds: 7200, timerCounts,
    finalStateSha256: final.stateSha256, matrixQualifying: false, qualifyingFullResourcePass: false, exclusions: configuration.exclusions };
} catch (error) {
  result = { status: 'FAIL', message: error.message, stack: error.stack, logicalAt: at }; process.exitCode = 1;
  await proof.record({ kind: 'first-failure', ...result }); await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-summary.json', { resourceSummary, unknown, turfSummary, familyUnknown, requests, outcomes }); if (app) await proof.snapshot(app.pool, 'failure');
} finally {
  for (const k of ['log', 'warn', 'error']) console[k] = originalConsole[k];
  for (const close of [async () => { if (app) await app.close(); }, () => controller.close(), () => base.end(), async () => proof.record({ kind: 'database-cleanup', ...await database.close() })]) {
    try { await close(); } catch (error) { result.status = 'FAIL'; result.cleanupFailure = error.message; process.exitCode = 1; await proof.record({ kind: 'cleanup-failure', message: error.message }); }
  }
  seam.restore(); runtime.restore(); const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify(result));
