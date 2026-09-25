// Scoped25-actor social extremes; initial progression fixtures are distinct from natural outsiders.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import { createFamilyPolicy, planFamilyFixture, FAMILY_POLICY_CONTRACT } from '../tools/rc1-family-policy.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, sha256 } from '../tools/rc1-native-proof.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';

assert(process.argv.includes('--postgres'), 'Explicit native PostgreSQL required');
const scenario = process.argv.find((arg) => arg.startsWith('--scenario='))?.split('=')[1];
const plan = planFamilyFixture(scenario);
const output = process.env.RC1_FAMILY_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(output && controlUrl, 'Fresh restricted output and local control database required');
const source = await sourceIdentity();
const database = planOwnedWorldDatabase({ controlUrl, runId: scenario, sourceRevision: source.revision });
for (const key of ['SEASON_MOD', 'SEASON_PHASE', 'CHAIN_RPC_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL',
  'INVARIANT_WEBHOOK_URL', 'CITY_WIRE_WEBHOOK_URL']) assert(!process.env[key], 'Undeclared timing/external override: ' + key);
const epoch = Date.parse('2026-09-20T12:00:00.000Z');
const expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
const configuration = { scenario, policy: FAMILY_POLICY_CONTRACT, fixture: plan,
  sourcePins: WORKER_SOURCE_PINS, database: database.descriptor, epoch: new Date(epoch).toISOString(), expectedDormant,
  initialization: 'All25 accounts/characters enter through ordinary routes. Only founder respect is initialized before baseline, to the declared legal level75. Actual ordinary check-ins fund actual25000 formation sinks. All member joins and all cash concentration use canonical routes. Outsiders retain original unmodified progression, resources and privileges.',
  measuredWork: 'Every declared ordinary outsider attempts canonical public-board entry and quiet progression; known-full actors retry only after a public vacancy. Boss promotes an actual member, then leaves; original succession transfers leadership. Treasury custody survives. Exact successful join and tribute retries must leave full state unchanged.',
  resourceExtreme: 'Largest means within this finite cohort for the exercised collective cash/treasury distribution. No finite global resource cap is invented. Other valuable-resource dimensions are recorded by full snapshots but not stress-qualified.',
  limits: { maximumOutsiderProgressAttempts: 20 },
  clocks: 'Shared application/SQL clock and every due original local worker callback for ordinary waits; no deadline edits or wall-time equivalence.',
  excludedIntegrations: ['unconfigured chain watcher', 'disabled liquidity automation', 'unavailable external RWA registry', 'population spawning disabled'],
  exclusions: ['Earned founder progression', 'all25 actors active throughout measured work', 'alliance/war/operations',
    'all13 resource extremes or full taxonomy', 'same-seed fresh-world replay', 'soak', '90-day/225-run matrix', 'production and real participants'] };
Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', COORDINATION_ACCOUNT_IDS: '',
  LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on',
  SOCIAL_VERIFY_MODE: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
const proof = await createProofRecorder({ directory: output, source, configuration, runId: scenario, seed: 'rc1-alpha', scenarioId: scenario, population: 25 });
const runtime = installSerialRuntime('rc1-alpha', configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: (value) => { at = value; }, expectedDormant });
const namespace = 'rc1_worker_family_' + process.pid + '_' + Math.floor(performance.now());
const base = new pg.Pool({ connectionString: database.url }); const seam = installWorkerInstrumentation(controller, { namespace });
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
let app, result, resourceSequence = 0, invariantBoundaries = 0;
const resourceSummaries = [], unsupported = [], actors = [], families = [], initializationReceipts = [], policies = new Map();
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query('CREATE SCHEMA ' + namespace);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap);
  const [{ buildServer }, { runLedgerInvariants }, { PACING, M3 }, observer] = await Promise.all([
    import('../src/server.js'), import('../src/invariants.js'), import('../src/rules.js'), import('../tools/rc1-world-resource-observer.js')]);
  assert.equal(M3.GANG_MAX_MEMBERS, plan.canonicalMaximumMembers); assert.equal(M3.GANG_FOUND_LEVEL, plan.formationLevelMinimum); assert.equal(M3.GANG_FOUND_COST, 25000);
  app = await buildServer(); const pool = app.pool, resources = () => observer.snapshotWorldResources(pool);
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
  async function raw(actor, method, path, body, key, label) {
    const identity = { accountId: actor?.accountId || null, method, path, label, logicalAt: at,
      ...(body === undefined ? {} : { body }), ...(key === undefined ? {} : { key }) };
    return proof.invoke('ordinary-http', identity, async () => {
      const r = await app.inject({ method, url: path, headers: { ...(actor ? { authorization: 'Bearer ' + actor.token } : {}),
        ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { payload: body }) });
      return { status: r.statusCode, replayed: r.headers['x-idempotent-replay'] === 'true', body: r.json() };
    });
  }
  async function invoke(actor, method, path, body, key, label = path, expectedStatus = 200) {
    const r = await observed({ label, method, path, logicalAt: at }, () => raw(actor, method, path, body, key, label));
    if (expectedStatus !== null) assert.equal(r.status, expectedStatus, JSON.stringify(r));
    if (method !== 'GET') await invariants(label); return r;
  }
  for (let i = 0; i < plan.population; i++) {
    const secret = crypto.randomBytes(32).toString('base64url'); await proof.artifact('entry-' + i + '-credential.json', { bootstrapSecret: secret });
    const guest = await invoke(null, 'POST', '/v1/auth/guest', { bootstrapSecret: secret }, undefined, 'guest-' + i);
    const actor = { index: i, accountId: app.jwt.verify(guest.body.token).sub, token: guest.body.token };
    await proof.artifact('entry-' + i + '-session.json', actor);
    const created = await invoke(actor, 'POST', '/v1/character', { name: 'Family Entry ' + i }, 'entry-' + i);
    actor.characterId = created.body.id; actors.push(actor);
    policies.set(actor.accountId, createFamilyPolicy({ accountId: actor.accountId, seed: 'rc1-alpha', scenario, population: 25 }));
  }
  const rules = (await invoke(actors[0], 'GET', '/v1/rules')).body;
  async function view(actor, label) {
    return observed({ label, authority: 'ordinary-authorized-view', accountId: actor.accountId, logicalAt: at }, async () => {
      const session = (await raw(actor, 'GET', '/v1/session', undefined, undefined, label + '-session')).body;
      const me = (await raw(actor, 'GET', '/v1/me', undefined, undefined, label + '-me')).body;
      const directory = (await raw(actor, 'GET', '/v1/gangs', undefined, undefined, label + '-directory')).body;
      const family = me.character.gang ? (await raw(actor, 'GET', '/v1/gangs/' + me.character.gang.id, undefined, undefined, label + '-family')).body : null;
      return { accountId: app.jwt.verify(actor.token).sub, session, me, directory, family, rules };
    });
  }
  async function choose(actor, phase, label, targetFamilyId = null) {
    const projection = await view(actor, label), policy = policies.get(actor.accountId);
    const decision = policy.choose(projection, { logicalAt: at, phase, targetFamilyId });
    await proof.record({ kind: 'policy-choice', label, accountId: actor.accountId, viewSha256: sha256(JSON.stringify(projection)), decision });
    if (decision.kind === 'command') {
      const checkpoint = policy.checkpoint(); await proof.artifact(label + '-pending.json', checkpoint);
      const restored = createFamilyPolicy({ accountId: actor.accountId, seed: 'rc1-alpha', scenario, population: 25 }).restore(checkpoint);
      assert.deepEqual(restored.choose(projection, { logicalAt: at, phase, targetFamilyId }), decision); policies.set(actor.accountId, restored);
    }
    return { decision, projection };
  }
  async function execute(actor, decision, label, expectedStatus = 200) {
    assert.equal(decision.kind, 'command'); const q = decision.request;
    const response = await invoke(actor, q.method, q.path, q.body, q.idempotencyKey, label, expectedStatus);
    assert([200, 400].includes(response.status), JSON.stringify(response));
    policies.get(actor.accountId).settle({ idempotencyKey: q.idempotencyKey, status: response.status === 200 ? 'COMPLETED' : 'DENIED', replayed: response.replayed, response: response.body });
    return response;
  }
  async function act(actor, phase, label, targetFamilyId = null, expectedStatus = 200) {
    const choice = await choose(actor, phase, label, targetFamilyId); return { ...choice, response: await execute(actor, choice.decision, label, expectedStatus) };
  }
  const fixtureManifest = plan.groups.map((g) => ({ index: g.founder, characterId: actors[g.founder].characterId,
    field: 'respect', before: 0, after: PACING.LEVEL_DIVISOR * (plan.founderLevel - 1) ** 2, provenance: 'Declared initialization-only progression fixture, not earned' }));
  await proof.artifact('declared-progression-fixtures.json', { fixtureManifest, plan });
  for (const fixture of fixtureManifest) {
    const observedBefore = (await pool.query('SELECT * FROM characters WHERE id=$1', [fixture.characterId])).rows[0]; assert.equal(Number(observedBefore.respect), fixture.before);
    await proof.invoke('declared-initialization-only-sql', fixture, async () => {
      const r = await pool.query('UPDATE characters SET respect=$2 WHERE id=$1 AND respect=$3', [fixture.characterId, fixture.after, fixture.before]);
      assert.equal(r.rowCount, 1); return { updated: r.rowCount };
    });
  }
  await invariants('declared-progression-only');
  for (const [groupIndex, group] of plan.groups.entries()) {
    const founder = actors[group.founder];
    const funded = await invoke(founder, 'POST', '/v1/checkin', {}, 'founder-checkin-' + groupIndex); assert.equal(funded.body.pay, 26250);
    const formed = await act(founder, 'found', 'found-' + groupIndex); const familyId = formed.response.body.gangId;
    families.push({ groupIndex, familyId, founderIndex: group.founder, memberIndices: group.members });
    initializationReceipts.push({ operation: 'formation', actorIndex: group.founder, familyId, funding: funded.body, response: formed.response.body });
    for (const index of group.members.slice(1)) {
      const joined = await act(actors[index], 'enter', 'initial-join-' + index, familyId);
      initializationReceipts.push({ operation: 'membership', actorIndex: index, familyId, response: joined.response.body });
    }
    for (const index of group.members) {
      const tribute = await act(actors[index], 'concentrate', 'initial-concentrate-' + index);
      initializationReceipts.push({ operation: 'cash-concentration', actorIndex: index, familyId, response: tribute.response.body });
    }
  }
  async function distribution(label) {
    const characters = (await pool.query('SELECT id,account_id,respect,cash,bank,ammo,cb,heat FROM characters WHERE id=ANY($1::text[]) ORDER BY id', [actors.map((a) => a.characterId)])).rows;
    const accounts = (await pool.query('SELECT account_id,omr,staked,rewards,unbonding FROM account_persistent WHERE account_id=ANY($1::text[]) ORDER BY account_id', [actors.map((a) => a.accountId)])).rows;
    const gangs = (await pool.query('SELECT id,treasury,ammo_bank,omr_reserve FROM gangs WHERE id=ANY($1::text[]) ORDER BY id', [families.map((f) => f.familyId)])).rows;
    const memberships = (await pool.query('SELECT gang_id,character_id,role FROM gang_members WHERE gang_id=ANY($1::text[]) ORDER BY gang_id,character_id', [families.map((f) => f.familyId)])).rows;
    const groups = gangs.map((g) => ({ familyId: g.id, members: memberships.filter((m) => m.gang_id === g.id).length,
      treasury: Number(g.treasury), collectiveCash: Number(g.treasury) + characters.filter((ch) => memberships.some((m) => m.character_id === ch.id && m.gang_id === g.id)).reduce((s, ch) => s + Number(ch.cash) + Number(ch.bank), 0) }));
    const outsiders = characters.filter((ch) => !memberships.some((m) => m.character_id === ch.id)).map((ch) => ({ characterId: ch.id, cashAndBank: Number(ch.cash) + Number(ch.bank) }));
    const value = { characters, accounts, gangs, memberships, groups, outsiders,
      scope: 'Exact finite-cohort distribution. Cash/treasury is exercised; other recorded resource dimensions remain unqualified, with inventory/custody in full canonical snapshots.' };
    await proof.artifact(label + '-distribution.json', value); return value;
  }
  const baseline = await distribution('initial'); assert.equal(baseline.characters.length, 25); assert.equal(baseline.accounts.length, 25);
  assert.deepEqual(baseline.groups.map((g) => g.members).sort((a, b) => a - b), plan.groups.map((g) => g.members.length).sort((a, b) => a - b));
  assert.equal(baseline.outsiders.length, plan.outsiders.length);
  const baselineTreasury = baseline.groups.reduce((n, g) => n + g.treasury, 0);
  assert.equal(baselineTreasury, scenario === 'family_monopoly' ? 11250 : 24000);
  for (const index of plan.outsiders) {
    const ch = baseline.characters.find((r) => r.id === actors[index].characterId), acct = baseline.accounts.find((r) => r.account_id === actors[index].accountId);
    for (const [key, expected] of Object.entries({ respect: 0, cash: 500, bank: 0, ammo: 25, cb: 0, heat: 0 })) assert.equal(Number(ch[key]), expected);
    assert.equal(Number(acct.omr), 0);
  }
  if (scenario === 'family_monopoly') assert(baseline.outsiders.every((o) => baseline.groups[0].collectiveCash > o.cashAndBank));
  else assert(baseline.groups.every((g) => g.members <= 25 * 0.2));
  await proof.artifact('initialization-receipts.json', { fixtureManifest, initializationReceipts, families });
  await proof.record({ kind: 'measured-initialization', scenario, population: 25, directProgressionFixtures: fixtureManifest.length,
    directResourceGrants: 0, directMembershipFixtures: 0, fixtureWritesAfterThisRecord: false });
  const invariantChecks = await invariants('baseline'); await proof.snapshot(pool, 'initial');
  await observed({ authority: 'original-worker-boot' }, () => bootOriginalWorker(controller)); await invariants('worker-boot');
  async function advance(seconds) {
    assert(seconds > 0); let prior = await resources(); await controller.advanceTo(at + seconds * 1000, async (logicalAt, label) => {
      const after = await resources(); await reconcile(prior, after, { authority: 'original-worker-callback', logicalAt, label });
      await invariants('worker:' + label); prior = await resources();
    });
  }
  const outsiderResults = []; let retryJoin = null, retryTribute = null;
  for (const index of plan.outsiders) {
    const actor = actors[index];
    const entry = await act(actor, 'enter', 'outsider-enter-' + index, null, scenario === 'family_monopoly' ? 400 : 200);
    if (scenario === 'family_monopoly') {
      assert.equal(entry.response.body.error, 'full');
      assert.equal((await choose(actor, 'enter', 'outsider-full-wait-' + index)).decision.kind, 'wait');
    } else if (!retryJoin) retryJoin = { actor, decision: entry.decision, response: entry.response };
    let progressed = null;
    for (let step = 0; step < configuration.limits.maximumOutsiderProgressAttempts && !progressed; step++) {
      const { decision, projection } = await choose(actor, 'progress', 'outsider-progress-' + index + '-' + step);
      if (decision.kind === 'wait') { await advance(decision.retryAfterSeconds); continue; }
      const response = await execute(actor, decision, 'outsider-progress-' + index + '-' + step);
      if (response.body.success) {
        const after = await view(actor, 'outsider-progressed-' + index);
        assert.equal(after.me.character.respect - projection.me.character.respect, response.body.rep);
        assert.equal(after.me.character.cash - projection.me.character.cash, response.body.take);
        progressed = { before: projection.me.character, after: after.me.character, response: response.body };
      }
    }
    assert(progressed, 'Declared outsider did not progress within bounded ordinary attempts');
    outsiderResults.push({ index, entry: entry.response, progression: progressed });
    if (scenario === 'fragmented_families') {
      const tribute = await act(actor, 'tribute', 'outsider-tribute-' + index);
      if (!retryTribute) retryTribute = { actor, decision: tribute.decision, response: tribute.response };
    }
  }
  const boss = actors[plan.groups[0].founder], familyId = families[0].familyId;
  const promotion = await act(boss, 'promote', 'promote-underboss');
  const treasuryBeforeDeparture = Number((await pool.query('SELECT treasury FROM gangs WHERE id=$1', [familyId])).rows[0].treasury);
  const departure = await act(boss, 'leave', 'boss-leaves'); assert.equal(departure.response.body.dissolved, false);
  assert.equal(departure.response.body.newBoss, promotion.decision.request.body.characterId);
  const publicAfter = (await invoke(boss, 'GET', '/v1/gangs/' + familyId)).body.gang;
  assert.equal(publicAfter.members.filter((m) => m.role === 'boss').length, 1);
  assert.equal(publicAfter.members.find((m) => m.role === 'boss').id, promotion.decision.request.body.characterId);
  assert.equal(publicAfter.treasury, treasuryBeforeDeparture);
  const actorEnteringVacancy = scenario === 'family_monopoly' ? actors[plan.outsiders[0]] : boss;
  const filled = await act(actorEnteringVacancy, 'enter', 'fill-public-vacancy', familyId);
  if (!retryJoin) retryJoin = { actor: actorEnteringVacancy, decision: filled.decision, response: filled.response };
  if (scenario === 'family_monopoly') {
    const tribute = await act(actorEnteringVacancy, 'tribute', 'outsider-tribute-after-entry');
    retryTribute = { actor: actorEnteringVacancy, decision: tribute.decision, response: tribute.response };
  }
  for (const [label, entry] of [['join', retryJoin], ['tribute', retryTribute]]) {
    const before = await proof.snapshot(pool, label + '-before-retry');
    const replay = await execute(entry.actor, entry.decision, label + '-exact-replay'); assert(replay.replayed); assert.deepEqual(replay.body, entry.response.body);
    assert.equal((await proof.snapshot(pool, label + '-after-retry')).stateSha256, before.stateSha256);
  }
  const finalDistribution = await distribution('final');
  assert.equal(finalDistribution.groups.length, plan.groups.length);
  assert(finalDistribution.groups.every((g) => g.members <= (scenario === 'family_monopoly' ? 20 : 5)));
  assert.equal(finalDistribution.groups.reduce((n, g) => n + g.treasury, 0), baselineTreasury + (scenario === 'family_monopoly' ? 100 : 200));
  await proof.artifact('outsider-natural-results.json', { outsiderResults });
  await invariants('final'); const final = await proof.snapshot(pool, 'final'), trace = controller.diagnostic(); assert.equal(trace.failures.length, 0);
  await proof.artifact('worker-schedule.json', trace); await proof.artifact('random-tape.json', { draws: runtime.tape });
  await proof.artifact('policy-checkpoints.json', [...policies].map(([accountId, p]) => ({ accountId, checkpoint: p.checkpoint() })));
  await proof.artifact('resource-summary.json', { resourceSummaries, unsupported, qualifyingFullResourcePass: false });
  for (const line of (await fs.readFile(output + '/history.jsonl', 'utf8')).trim().split('\n')) JSON.parse(line);
  result = { status: 'PASS_SCOPED', scenario, ordinaryAccounts: 25, progressionFixtureFounders: fixtureManifest.length,
    directResourceGrants: 0, directMembershipFixtures: 0, initialFamilies: plan.groups.length,
    initialFamilySizes: plan.groups.map((g) => g.members.length), initialOrdinaryOutsiders: plan.outsiders.length,
    initialFamilyTreasury: baselineTreasury, ordinaryOutsidersProgressed: outsiderResults.length,
    measuredFullDenials: scenario === 'family_monopoly' ? 5 : 0, measuredOutsiderJoins: scenario === 'family_monopoly' ? 1 : 2,
    canonicalLeaderSuccessions: 1, exactStatePreservingReplays: 2, finalFamilySizes: finalDistribution.groups.map((g) => g.members).sort((a, b) => b - a),
    logicalSeconds: (at - epoch) / 1000, invariantChecks, invariantBoundaries, resourceBoundaries: resourceSummaries.length,
    unsupportedResourceClassifications: unsupported.length, qualifyingFullResourcePass: false,
    finalStateSha256: final.stateSha256, matrixQualifying: false, exclusions: configuration.exclusions };
} catch (error) {
  result = { status: 'FAIL', message: error.message, stack: error.stack, logicalAt: at }; process.exitCode = 1;
  await proof.record({ kind: 'first-failure', ...result }); await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-resource-summary.json', { resourceSummaries, unsupported });
  await proof.artifact('failure-initialization.json', { initializationReceipts, families });
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
