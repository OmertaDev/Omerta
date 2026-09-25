// Native three-Family social pacts and explicit account Knowledge grants; no invented alliance ACL.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { createAlliancePolicy, ALLIANCE_POLICY_CONTRACT } from '../tools/rc1-alliance-policy.js';
import { snapshotFamilyCashAmmo, reconcileFamilyCashAmmo } from '../tools/rc1-family-cash-ammo-journal.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, sha256 } from '../tools/rc1-native-proof.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';

assert(process.argv.includes('--postgres'), 'Explicit native PostgreSQL required');
const output = process.env.RC1_ALLIANCE_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(output && controlUrl, 'Fresh restricted output and local control database required');
const source = await sourceIdentity(), database = planOwnedWorldDatabase({ controlUrl, runId: 'alliance-native', sourceRevision: source.revision });
for (const key of ['LAW_BUST_P', 'SEASON_MOD', 'SEASON_PHASE', 'CHAIN_RPC_URL', 'LIQUIDITY_RPC_URL',
  'LIQUIDITY_RPC_FALLBACK_URL', 'INVARIANT_WEBHOOK_URL', 'CITY_WIRE_WEBHOOK_URL']) assert(!process.env[key], 'Undeclared override: ' + key);
const epoch = Date.parse('2026-09-20T12:00:00.000Z'), expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
const configuration = { scenario: 'scoped-three-family-pacts-and-knowledge-cooperation', contract: ALLIANCE_POLICY_CONTRACT,
  database: database.descriptor, sourcePins: WORKER_SOURCE_PINS, epoch: new Date(epoch).toISOString(), expectedDormant,
  entry: 'Four ordinary guests/characters. Three founders receive only initialization level75 respect; actual check-ins fund actual Family formation before measured baseline. Fourth outsider has no progression/resource/social grants.',
  measured: 'Three canonical bilateral pacts connect all three Families. Three investigators travel canonically and independently discover docks/foundry/docks Split Ledger evidence. Explicit owner-to-account shares from all three contributors unlock each authorized conclusion.',
  negativeControls: ['Pacts alone grant no claim access', 'outsider cannot read or act in another account instance', 'recipient cannot reshare',
    'stale ACL revision rejects', 'revocation hides archive/link and rejects previously issued action', 'fresh regrant restores eligibility'],
  retries: 'Exact share, archived reference after revocation, and conclusion replay preserve full canonical state. Every policy pending request is checkpointed and restored before dispatch.',
  clocks: 'Shared application/SQL logical clock; original workers boot. This bounded scenario advances no time and claims no recurring deadline or pact-expiry coverage.',
  resourceScope: 'All canonical invariants, unchanged shared resource observer with all unknowns, and independent Family CASH/AMMO journal. Knowledge/diplomacy grant no value; conclusions authoritatively pay no reward.',
  exclusions: ['Cross-Family operation execution (unsupported authority)', 'anti-hegemon warfare/coalitions', 'cash/item operation contributions',
    'pact expiry/break/honor loss', 'OMR reserve lineage', 'full resource taxonomy', 'fresh-world replay', '25 actors/90 days/three seeds/225-run matrix', 'deployed people and production'] };
Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', COORDINATION_ACCOUNT_IDS: '',
  LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on',
  SOCIAL_VERIFY_MODE: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
const proof = await createProofRecorder({ directory: output, source, configuration, runId: 'alliance-native', seed: 'rc1-alpha',
  scenarioId: configuration.scenario, population: 4 });
const runtime = installSerialRuntime('rc1-alpha', configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: (value) => { at = value; }, expectedDormant });
const namespace = 'rc1_worker_alliance_' + process.pid + '_' + Math.floor(performance.now());
const base = new pg.Pool({ connectionString: database.url }), seam = installWorkerInstrumentation(controller, { namespace });
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
let app, result, measured = false, sequence = 0, invariantBoundaries = 0;
const actors = [], policies = new Map(), resources = [], custody = [], unknown = [], controls = [], completions = [];
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query('CREATE SCHEMA ' + namespace);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap);
  const [{ buildServer }, { runLedgerInvariants }, observer, { PACING }] = await Promise.all([
    import('../src/server.js'), import('../src/invariants.js'), import('../tools/rc1-world-resource-observer.js'), import('../src/rules.js')]);
  app = await buildServer(); const pool = app.pool;
  async function invariants(label) {
    const r = await runLedgerInvariants(pool, { alert: false }); assert(r.ok, JSON.stringify(r)); invariantBoundaries++;
    await proof.record({ kind: 'canonical-invariants', label, checks: r.checks }); return r.checks.length;
  }
  const snapshot = async () => ({ global: await observer.snapshotWorldResources(pool), family: measured ? await snapshotFamilyCashAmmo(pool) : null });
  async function observe(identity, work) {
    const before = await snapshot(); let value, error;
    try { value = await work(); } catch (e) { error = e; }
    const after = await snapshot(), label = 'boundary-' + sequence++;
    try {
      const journal = observer.reconcileWorldResources(before.global, after.global, { identity, includeRestrictedChanges: true });
      await proof.artifact(label + '-resource.json', journal); resources.push({ label, checks: journal.checks.length, unknown: journal.unsupported.length });
      unknown.push(...journal.unsupported.map((r) => ({ boundary: label, ...r })));
      if (measured) {
        // None of these authored Knowledge/diplomacy/travel actions moves Family buckets.
        // Their exact HTTP identities remain in history; they are not fake Family monetary operations.
        const family = reconcileFamilyCashAmmo(before.family, after.family); assert.equal(family.status, 'PASS_SCOPED');
        assert.equal(family.flows.length, 0);
        await proof.artifact(label + '-family.json', { identity, before: before.family, after: after.family, journal: family });
        custody.push({ label, checks: family.checks.length, personalChecks: family.personalChecks.length });
      }
    } catch (e) { await proof.artifact(label + '-failure.json', { identity, before, after, message: e.message }); throw e; }
    if (error) throw error; return value;
  }
  async function raw(actor, method, path, body, key, label) {
    return proof.invoke('ordinary-http', { accountId: actor?.accountId || null, method, path, label, logicalAt: at,
      ...(body === undefined ? {} : { body }), ...(key === undefined ? {} : { key }) }, async () => {
      const r = await app.inject({ method, url: path, headers: { ...(actor ? { authorization: 'Bearer ' + actor.token } : {}),
        ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { payload: body }) });
      const response = r.json(); return { status: r.statusCode, replayed: r.headers['x-idempotent-replay'] === 'true' || response.replayed === true, body: response };
    });
  }
  async function invoke(actor, method, path, body, key, label = path, expected = 200) {
    const r = await observe({ label, method, path, logicalAt: at }, () => raw(actor, method, path, body, key, label));
    assert.equal(r.status, expected, JSON.stringify(r)); if (method !== 'GET') await invariants(label); return r;
  }
  for (let i = 0; i < 4; i++) {
    const bootstrapSecret = crypto.randomBytes(32).toString('base64url'), name = 'Alliance Entry ' + i;
    const guest = await invoke(null, 'POST', '/v1/auth/guest', { bootstrapSecret }, undefined, 'guest-' + i);
    const actor = { name, accountId: app.jwt.verify(guest.body.token).sub, token: guest.body.token };
    const created = await invoke(actor, 'POST', '/v1/character', { name }, 'entry-' + i); actor.characterId = created.body.id; actors.push(actor);
    policies.set(actor.accountId, createAlliancePolicy({ accountId: actor.accountId, seed: 'rc1-alpha' }));
    await proof.artifact('entry-' + i + '.json', { bootstrapSecret, ...actor });
  }
  const founders = actors.slice(0, 3), outsider = actors[3], grants = [];
  for (let i = 0; i < founders.length; i++) {
    const actor = founders[i], respect = PACING.LEVEL_DIVISOR * 74 ** 2;
    const before = (await pool.query('SELECT id,respect,cash,ammo,loc FROM characters WHERE id=$1', [actor.characterId])).rows[0];
    await pool.query('UPDATE characters SET respect=$2 WHERE id=$1', [actor.characterId, respect]); grants.push({ before, after: { respect } });
    await invoke(actor, 'POST', '/v1/checkin', undefined, 'initial-checkin-' + i);
    const formation = await invoke(actor, 'POST', '/v1/gangs', { name: 'Alliance Family ' + i, tag: 'A' + i }, 'initial-family-' + i);
    actor.familyId = formation.body.gangId;
  }
  await proof.artifact('initialization-grants.json', { progression: grants, directOtherResourceOrMembershipGrants: 0,
    allPostbaselineMutationsCanonical: true, families: founders.map((a) => ({ founder: a.characterId, familyId: a.familyId })) });
  await observe({ authority: 'original-worker-boot' }, () => bootOriginalWorker(controller)); await invariants('worker-boot');
  measured = true; await proof.record({ kind: 'measured-initialization', ordinaryEntrants: 4, actualFamilies: 3, initialRespectFixtures: 3, fixtureWritesAfterThisRecord: false });
  const invariantChecks = await invariants('initial'); await proof.snapshot(pool, 'initial');
  async function view(actor, targetLabel = null) {
    return observe({ authority: 'authorized-policy-view', accountId: actor.accountId }, async () => {
      const get = async (path) => { const r = await raw(actor, 'GET', path, undefined, undefined, 'public-view'); assert.equal(r.status, 200); return r.body; };
      const session = await get('/v1/session'), me = await get('/v1/me'), directory = await get('/v1/gangs'), diplomacy = await get('/v1/diplomacy');
      const rules = await get('/v1/rules'), catalog = await get('/v1/coordination'), knowledge = await get('/v1/coordination/knowledge');
      const targets = await get('/v1/coordination/knowledge/targets' + (targetLabel ? '?characterName=' + encodeURIComponent(targetLabel) : ''));
      const instanceId = policies.get(actor.accountId).summary().instanceId;
      const instance = instanceId ? await get('/v1/coordination/instances/' + instanceId) : null;
      return { accountId: app.jwt.verify(actor.token).sub, session, me, directory, diplomacy, rules, catalog, knowledge, targets, instance };
    });
  }
  let choiceNumber = 0;
  async function choose(actor, phase, extra = {}) {
    const projection = await view(actor, extra.targetLabel), options = { logicalAt: at, phase, ...extra };
    let policy = policies.get(actor.accountId); const decision = policy.choose(projection, options), label = 'choice-' + choiceNumber++;
    await proof.artifact(label + '-view.json', projection);
    await proof.record({ kind: 'policy-choice', accountId: actor.accountId, label, viewSha256: sha256(JSON.stringify(projection)), decision });
    if (decision.kind === 'command') {
      const checkpoint = policy.checkpoint(); await proof.artifact(label + '-pending.json', checkpoint);
      policy = createAlliancePolicy({ accountId: actor.accountId, seed: 'rc1-alpha' }).restore(checkpoint);
      assert.deepEqual(policy.choose(projection, options), decision); policies.set(actor.accountId, policy);
    }
    return { decision, projection };
  }
  async function execute(actor, decision, expected = 200, label = decision.type) {
    assert.equal(decision.kind, 'command'); const r = decision.request;
    const response = await invoke(actor, r.method, r.path, r.body, r.idempotencyKey, label, expected);
    policies.get(actor.accountId).settle({ idempotencyKey: r.idempotencyKey, status: expected === 200 ? 'COMPLETED' : 'DENIED', replayed: response.replayed, response: response.body });
    return response;
  }
  const act = async (actor, phase, extra = {}) => { const { decision } = await choose(actor, phase, extra); return { decision, response: await execute(actor, decision) }; };
  async function replay(actor, saved, label) {
    const before = await proof.snapshot(pool, label + '-before'); const result = await execute(actor, saved.decision, 200, label);
    assert(result.replayed); const { replayed: _a, ...a } = result.body, { replayed: _b, ...b } = saved.response.body; assert.deepEqual(a, b);
    assert.equal((await proof.snapshot(pool, label + '-after')).stateSha256, before.stateSha256); return result;
  }
  const [a, b, c] = founders;
  for (const [from, to] of [[a, b], [b, c], [c, a]]) {
    await act(from, 'pact', { targetFamilyId: to.familyId }); await act(to, 'pact', { targetFamilyId: from.familyId });
  }
  for (const founder of founders) assert.equal((await view(founder)).diplomacy.relations.filter((r) => r.active).length, 2);
  for (const [i, actor] of founders.entries()) {
    const movement = await choose(actor, 'travel', { districtId: i === 1 ? 'foundry' : 'docks' });
    if (movement.decision.kind === 'command') await execute(actor, movement.decision);
    await act(actor, 'create');
    for (let step = 0; step < 3; step++) await act(actor, 'act');
    const current = await view(actor); assert.equal(current.knowledge.claims.length, 1); assert(current.knowledge.claims[0].owned);
    assert.equal(current.instance.actions.length, 0, 'Independent evidence must be required'); actor.claimId = current.knowledge.claims[0].id;
    assert.equal(current.knowledge.claims[0].source.root, i === 1 ? 'foundry.impression' : 'docks.manifest');
  }
  async function refused(actor, method, path, body, key, expected, label) {
    const r = await invoke(actor, method, path, body, key, label, expected); controls.push({ label, status: r.status, error: r.body.error }); return r;
  }
  for (const [reader, owner] of [[a, b], [b, c], [c, a]])
    await refused(reader, 'GET', '/v1/coordination/knowledge/' + owner.claimId, undefined, undefined, 404, 'pact-does-not-grant-' + reader.name.at(-1));
  await refused(outsider, 'GET', '/v1/coordination/knowledge/' + b.claimId, undefined, undefined, 404, 'outsider-claim');
  const instanceA = policies.get(a.accountId).summary().instanceId;
  await refused(outsider, 'GET', '/v1/coordination/instances/' + instanceA, undefined, undefined, 404, 'outsider-instance');
  const sharedBA = await act(b, 'share', { targetLabel: a.name, claimId: b.claimId }); await replay(b, sharedBA, 'share-exact-replay');
  await act(a, 'share', { targetLabel: b.name, claimId: a.claimId });
  await act(b, 'share', { targetLabel: c.name, claimId: b.claimId });
  await act(c, 'share', { targetLabel: b.name, claimId: c.claimId });
  await refused(b, 'POST', sharedBA.decision.request.path, sharedBA.decision.request.body, 'negative-stale-acl', 409, 'stale-acl-revision');
  const readerView = await view(a, c.name), recipient = readerView.targets.targets.find((t) => t.kind === 'account'); assert(recipient);
  await refused(a, 'POST', '/v1/coordination/knowledge/' + b.claimId + '/share', { targetId: recipient.id, expectedAclRevision: 0 }, 'negative-reshare', 404, 'reader-cannot-reshare');
  const archived = await act(a, 'archive', { claimId: b.claimId }); await act(a, 'link');
  const pending = await choose(a, 'act'); assert.equal(pending.decision.kind, 'command');
  await refused(outsider, 'POST', pending.decision.request.path, pending.decision.request.body, 'negative-outsider-action', 404, 'outsider-cannot-participate');
  await act(b, 'revoke', { targetLabel: a.name, claimId: b.claimId });
  await refused(a, 'GET', '/v1/coordination/knowledge/' + b.claimId, undefined, undefined, 404, 'revoked-claim');
  assert.deepEqual((await invoke(a, 'GET', '/v1/coordination/knowledge/archive')).body.entries, []);
  assert.deepEqual((await invoke(a, 'GET', '/v1/coordination/knowledge/' + a.claimId)).body.links, []);
  const stale = await execute(a, pending.decision, 404, 'revoked-issued-action'); controls.push({ label: 'revoked-issued-action', status: stale.status, error: stale.body.error });
  await replay(a, archived, 'archived-reference-replay-after-revoke');
  assert.deepEqual((await invoke(a, 'GET', '/v1/coordination/knowledge/archive')).body.entries, []);
  await act(b, 'share', { targetLabel: a.name, claimId: b.claimId });
  for (const actor of founders) {
    let last;
    for (let i = 0; i < 4; i++) {
      const current = await view(actor); if (current.instance.status === 'completed') break;
      last = await act(actor, 'act');
    }
    const completed = await view(actor); assert.equal(completed.instance.status, 'completed');
    assert(completed.instance.nodes.some((n) => n.id === 'conclusion' && n.status === 'completed'));
    completions.push({ accountId: actor.accountId, familyId: actor.familyId, instance: completed.instance });
    await replay(actor, last, 'conclusion-replay-' + actor.name.at(-1));
  }
  await proof.artifact('authorized-conclusions.json', { completions, valueReward: 0, meaning: 'No-reward corroborated record, not cross-Family operation execution' });
  await proof.artifact('permission-controls.json', { controls, archiveAndLinkHiddenAfterRevocation: true });
  const checkpoints = founders.map((actor) => ({ accountId: actor.accountId, checkpoint: policies.get(actor.accountId).checkpoint() }));
  await proof.artifact('policy-checkpoints.json', checkpoints);
  await invariants('final'); const final = await proof.snapshot(pool, 'final'), trace = controller.diagnostic(); assert.equal(trace.failures.length, 0);
  assert.equal(trace.events.filter((e) => e.kind === 'timer.fire').length, 0);
  await proof.artifact('worker-schedule.json', trace); await proof.artifact('random-tape.json', { draws: runtime.tape });
  await proof.artifact('resource-summary.json', { resources, custody, unknown, qualifyingFullResourcePass: false });
  result = { status: 'PASS_SCOPED', actualFamilies: 3, actualPacts: 3, ordinaryEntrants: 4, initialRespectFixtures: 3,
    otherDirectGameplayFixtureWrites: 0, independentContributors: 3, explicitFreshAccountGrants: 5, revocations: 1,
    authorizedConclusions: completions.length, permissionControls: controls.length, exactReplays: 5, conclusionRewards: 0,
    invariantChecks, invariantBoundaries, resourceBoundaries: resources.length, resourceChecks: resources.reduce((n, r) => n + r.checks, 0),
    custodyBoundaries: custody.length, familyChecks: custody.reduce((n, r) => n + r.checks, 0), unsupportedResourceClassifications: unknown.length,
    observedLogicalSeconds: 0, recurringWorkerCallbacks: 0, policies: founders.map((a) => policies.get(a.accountId).summary()),
    finalStateSha256: final.stateSha256, qualifyingFullResourcePass: false, matrixQualifying: false, exclusions: configuration.exclusions };
} catch (error) {
  result = { status: 'FAIL', message: error.message, stack: error.stack, logicalAt: at }; process.exitCode = 1;
  await proof.record({ kind: 'first-failure', ...result }); await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-summary.json', { resources, custody, unknown, controls, completions });
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
