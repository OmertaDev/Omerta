import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { canonicalJson } from '../tools/rc1-native-proof.js';
import { createAggressionPolicy, AGGRESSION_POLICY_CONTRACT } from '../tools/rc1-aggression-policy.js';

const digest = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const at = Date.parse('2026-09-21T00:00:00Z');
const configuration = { accountId: 'actor', seed: 'rc1-alpha' };
const httpIdentity = (account, method, path, body, key) => ({ account, method, path,
  ...(body === undefined ? {} : { body }), ...(key === undefined ? {} : { key }) });
assert.throws(() => JSON.parse(canonicalJson({ body: undefined })), 'History verification must reject undefined JSON fields');
assert.deepEqual(JSON.parse(canonicalJson(httpIdentity('actor', 'GET', '/v1/me'))), { account: 'actor', method: 'GET', path: '/v1/me' });
assert.deepEqual(JSON.parse(canonicalJson(httpIdentity('actor', 'POST', '/v1/heal', {}, 'key'))),
  { account: 'actor', method: 'POST', path: '/v1/heal', body: {}, key: 'key' });
const makeView = (sequence) => {
  const id = digest(sequence), executionId = `${digest(`board:${sequence}`)}.${id}`;
  return { commands: { player: { id: 'actor', character: { id: 'own-street' } }, commandSchemaVersion: 1,
    commands: [{ commandId: id, commandType: 'discovery.act', availability: 'AVAILABLE', expiresAt: new Date(at + 60000).toISOString(),
      executionIdentity: { executionId }, parameters: {} }] },
  me: { character: { id: 'own-street', loc: 'docks', health: 100, energy: 50, ammo: 25, cash: 500,
    jailSeconds: 0, hospSeconds: 0, safeSeconds: 0, law: { witproSeconds: 0 }, healCost: null } },
  streets: { streets: [{ id: 'target', loc: 'docks', hospitalized: false, jailed: false, gangTag: null }] },
  rivals: { rivals: [] } };
};
const choose = (policy, view) => policy.choose(view, { logicalAt: at });
const settle = (policy, choice, win = true) => policy.settle({ idempotencyKey: choice.request.idempotencyKey,
  status: 'COMPLETED', replayed: false, response: choice.type === 'legacy.jump' ? { ok: true, win }
    : choice.type === 'legacy.heal' ? { ok: true, health: 100, healed: 20 } : { status: 'COMPLETED' } });

const quota = createAggressionPolicy(configuration);
for (let sequence = 0; sequence < 1000; sequence++) {
  const decision = choose(quota, makeView(sequence)); settle(quota, decision, sequence % 2 === 0);
  assert.equal(quota.summary().mixedConflict, Math.floor((sequence + 1) * 7 / 10));
}
assert.equal(quota.summary().freshConflict, 700);
assert(quota.summary().losses > 0); assert(quota.summary().wins > 0);
const forced = createAggressionPolicy(configuration), conflictOnly = makeView(0); conflictOnly.commands.commands = [];
const forceChoice = choose(forced, conflictOnly); assert.equal(forceChoice.category, 'conflict'); settle(forced, forceChoice, false);
assert.equal(forced.summary().actualConflictFraction, 1); assert.equal(forced.summary().mixedConflictFraction, null);
assert.equal(forced.summary().forcedConflict, 1);

for (const [field, value] of [['health', 19], ['energy', 24], ['ammo', 4], ['jailSeconds', 1], ['hospSeconds', 1], ['safeSeconds', 1]]) {
  const projection = makeView(1); projection.me.character[field] = value;
  assert.equal(choose(createAggressionPolicy(configuration), projection).observedCandidates.conflict, 0, field);
}
const protectedOwn = makeView(1); protectedOwn.me.character.law.witproSeconds = 1;
assert.equal(choose(createAggressionPolicy(configuration), protectedOwn).observedCandidates.conflict, 0);
for (const target of [{ jailed: true }, { hospitalized: true }, { loc: 'canal' }, { id: 'own-street' }]) {
  const projection = makeView(1); Object.assign(projection.streets.streets[0], target);
  assert.equal(choose(createAggressionPolicy(configuration), projection).observedCandidates.conflict, 0);
}
const sameFamily = makeView(1); sameFamily.me.character.gang = { tag: 'FAM' }; sameFamily.streets.streets[0].gangTag = 'FAM';
assert.equal(choose(createAggressionPolicy(configuration), sameFamily).observedCandidates.conflict, 0);
const ownWrong = makeView(1); ownWrong.me.character.id = 'foreign';
assert.throws(() => choose(createAggressionPolicy(configuration), ownWrong), /Foreign/);
const actorWrong = makeView(1); actorWrong.commands.player.id = 'foreign';
assert.throws(() => choose(createAggressionPolicy(configuration), actorWrong), /Foreign/);
assert.throws(() => createAggressionPolicy({ ...configuration, database: {} }));

const hidden = makeView(1);
Object.defineProperty(hidden, 'diagnostic', { get() { throw Error('Hidden observer inspected'); } });
Object.defineProperty(hidden.streets.streets[0], 'stats', { get() { throw Error('Hidden target stats inspected'); } });
choose(createAggressionPolicy(configuration), hidden);
for (const mutation of [{ availability: 'LOCKED' }, { availability: 'BLOCKED' }, { executionIdentity: null },
  { executionIdentity: { executionId: 'invented' } }, { expiresAt: new Date(at).toISOString() }]) {
  const projection = makeView(1); Object.assign(projection.commands.commands[0], mutation);
  const choice = choose(createAggressionPolicy(configuration), projection);
  assert.equal(choice.category, 'conflict'); assert.equal(choice.observedCandidates.other, 0);
}
const unclassified = makeView(1); unclassified.commands.commands[0].commandType = 'situation.act';
assert.deepEqual(choose(createAggressionPolicy(configuration), unclassified).observedCandidates.unclassifiedTypes, ['situation.act']);

const wounded = makeView(1); wounded.me.character.health = 80; wounded.me.character.healCost = 300;
assert.equal(choose(createAggressionPolicy(configuration), wounded).type, 'legacy.heal');
wounded.me.character.cash = 299;
assert.equal(choose(createAggressionPolicy(configuration), wounded).type, 'discovery.act');
const revenge = makeView(1); revenge.commands.commands = [];
revenge.streets.streets.push({ ...revenge.streets.streets[0], id: 'known-rival' });
revenge.rivals.rivals.push({ street: { id: 'known-rival' } });
const revengePolicy = createAggressionPolicy(configuration), revengeChoice = choose(revengePolicy, revenge);
assert.equal(revengeChoice.request.path, '/v1/streets/known-rival/jump'); settle(revengePolicy, revengeChoice, false);
assert.equal(revengePolicy.summary().retaliationCompletions, 1);

const pending = createAggressionPolicy(configuration), decision = choose(pending, makeView(1));
assert.deepEqual(choose(pending, makeView(2)), decision);
const restored = createAggressionPolicy(configuration).restore(pending.checkpoint());
assert.deepEqual(choose(restored, makeView(2)), decision);
assert.throws(() => restored.settle({ status: 'COMPLETED', idempotencyKey: 'different', replayed: false }));
settle(restored, decision); settle(pending, decision);
assert.deepEqual(restored.checkpoint(), pending.checkpoint());
for (let sequence = 3; sequence < 30; sequence++) {
  const projection = makeView(sequence), a = choose(pending, projection), b = choose(restored, projection);
  assert.deepEqual(a, b); settle(pending, a); settle(restored, b);
}
assert.deepEqual(restored.checkpoint(), pending.checkpoint());
const corrupt = pending.checkpoint(); corrupt.payload.counters.fresh++;
assert.throws(() => createAggressionPolicy(configuration).restore(corrupt), /checksum/);
assert.throws(() => createAggressionPolicy({ ...configuration, seed: 'rc1-beta' }).restore(pending.checkpoint()));
const denied = createAggressionPolicy(configuration), denialChoice = choose(denied, makeView(1));
denied.settle({ idempotencyKey: denialChoice.request.idempotencyKey, status: 'DENIED' });
assert.equal(denied.summary().fresh, 0);
const replayChoice = choose(denied, makeView(2));
denied.settle({ idempotencyKey: replayChoice.request.idempotencyKey, status: 'COMPLETED', replayed: true });
assert.equal(denied.summary().fresh, 0); assert.throws(() => choose(denied, makeView(3)), /Unresolved/);
console.log('PASS: aggression quota, public candidate gates, loss accounting, recovery/retaliation, identities and policy restart');

if (process.argv.includes('--postgres')) await nativeExercise();

async function nativeExercise() {
  const [{ planOwnedWorldDatabase }, proofTools, { installSerialRuntime }] = await Promise.all([
    import('../tools/rc1-native-database.js'), import('../tools/rc1-native-proof.js'), import('../tools/rc1-native-determinism.js')]);
  const output = process.env.RC1_AGGRESSION_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
  assert(output && controlUrl, 'Fresh restricted output and explicit local PostgreSQL required');
  const source = await proofTools.sourceIdentity();
  const db = planOwnedWorldDatabase({ controlUrl, runId: 'aggression-native', sourceRevision: source.revision });
  for (const key of ['SEARCH_MS', 'SHOOT_CD_MS', 'SEASON_MOD', 'SEASON_PHASE', 'CHAIN_RPC_URL', 'LIQUIDITY_RPC_URL'])
    assert(!process.env[key], `Undeclared gameplay/integration override: ${key}`);
  const fixture = { actors: 2, resourceGrants: 'Schema-default birth resources only. Each actor claims one canonical check-in before baseline.',
    stats: 'Weak: default 5/5/5. Strong: declared legal trained-stat fixture 50 muscle/5 cunning/50 speed; no claimed natural training history.',
    progression: 'No earned respect, items, memberships, protection or special roles. Both at docks in the current season.',
    deadlines: 'Original 180-second standard-jump hospital protection; real time, no deadline or status rewrites.' };
  const runConfiguration = { scenario: 'scoped-high-aggression-jump-loss-heal-retaliation', fixture,
    policy: AGGRESSION_POLICY_CONTRACT, database: db.descriptor,
    exclusions: ['replacement/death characters', 'search/fire and other conflict authorities', 'all thirteen resource journals',
      '90 days/225 runs', 'complete workers', 'database restart and crash-window reconciliation', 'full-game seeded replay', 'production-equivalent load'] };
  const proof = await proofTools.createProofRecorder({ directory: output, source, configuration: runConfiguration,
    runId: 'aggression-native', seed: 'rc1-alpha', scenarioId: runConfiguration.scenario, population: 2 });
  const wallNow = Date.now.bind(Date);
  const runtime = installSerialRuntime('rc1-alpha', new Date(wallNow()).toISOString()); runtime.bindClock(wallNow);
  let app, result;
  try {
    await proof.record({ kind: 'database-created', ...await db.create() });
    Object.assign(process.env, { DATABASE_URL: db.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
      COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on',
      RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off', LIVING_WORLD_DIRECTOR: 'DIRECTOR_DISABLED',
      JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'),
      MOD_KEY: crypto.randomBytes(32).toString('hex') });
    const [{ buildServer }, { M3 }, { runLedgerInvariants }, { directorConfiguration }] = await Promise.all([
      import('../src/server.js'), import('../src/rules.js'), import('../src/invariants.js'), import('../src/director/config.js')]);
    assert.equal(directorConfiguration().mode, 'DIRECTOR_DISABLED', 'Validate the local Director mode before allocating the server pool');
    assert.equal(M3.JUMP_ENERGY, 25); assert.equal(M3.JUMP_AMMO, 5); assert.equal(M3.JUMP_MIN_HEALTH, 20); assert.equal(M3.JUMP_HOSP_MS, 180000);
    app = await buildServer();
    for (const [account, muscle, speed] of [['aggression-weak', 5, 5], ['aggression-strong', 50, 50]]) {
      await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [account]);
      await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
      await app.pool.query('INSERT INTO characters(id,account_id,name,season,loc,muscle,speed) VALUES($1,$2,$2,$3,$4,$5,$6)',
        [`${account}-character`, account, Math.floor(Date.now() / (28 * 86400000)), 'docks', muscle, speed]);
    }
    const tokens = Object.fromEntries(['aggression-weak', 'aggression-strong'].map((account) => [account, app.jwt.sign({ sub: account, tv: 0 })]));
    const request = async (account, method, path, body, key) => {
      const response = await app.inject({ method, url: path, headers: { authorization: `Bearer ${tokens[account]}`,
        ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { payload: body }) });
      return { status: response.statusCode, replayed: response.headers['x-idempotent-replay'] === 'true', body: response.json() };
    };
    const invoke = async (account, method, path, body, key) => {
      const response = await proof.invoke('authenticated-http', httpIdentity(account, method, path, body, key), () => request(account, method, path, body, key));
      assert.equal(response.status, 200, JSON.stringify(response)); return response;
    };
    for (const account of Object.keys(tokens)) await invoke(account, 'POST', '/v1/checkin', {}, `initial-checkin-${account}`);
    const baseline = await runLedgerInvariants(app.pool, { alert: false }); assert(baseline.ok);
    await proof.record({ kind: 'measured-initialization', fixture, fixtureWritesAfterThisRecord: false });
    await proof.snapshot(app.pool, 'initial');
    const policies = Object.fromEntries(Object.keys(tokens).map((account) => [account, createAggressionPolicy({ accountId: account, seed: 'rc1-alpha' })]));
    const options = Object.fromEntries(Object.keys(tokens).map((account) => [account, {}]));
    let step = 0;
    async function observe(account) {
      const query = new URLSearchParams(options[account]).toString();
      const projection = {};
      for (const [key, path] of [['commands', `/v1/commands${query ? `?${query}` : ''}`], ['me', '/v1/me'], ['streets', '/v1/streets'], ['rivals', '/v1/rivals']])
        projection[key] = (await invoke(account, 'GET', path)).body;
      return projection;
    }
    async function act(account) {
      const projection = await observe(account), policy = policies[account];
      const decision = policy.choose(projection, { logicalAt: Date.now() });
      await proof.record({ kind: 'policy-choice', account, step, decision }); assert.equal(decision.kind, 'command');
      await proof.artifact(`policy-${step}-pending.json`, policy.checkpoint());
      const resumed = createAggressionPolicy({ accountId: account, seed: 'rc1-alpha' }).restore(policy.checkpoint());
      assert.deepEqual(resumed.choose(projection, { logicalAt: Date.now() }), decision);
      policies[account] = resumed;
      const r = decision.request, response = await invoke(account, r.method, r.path, r.body, r.idempotencyKey);
      resumed.settle({ idempotencyKey: r.idempotencyKey, status: 'COMPLETED', replayed: response.replayed || response.body.replayed === true, response: response.body });
      if (decision.type === 'mystery.start') options[account].mysteryGraphId = decision.parameters.graphId;
      const invariants = await runLedgerInvariants(app.pool, { alert: false }); assert(invariants.ok);
      await proof.record({ kind: 'canonical-invariants', step, checks: invariants.checks });
      await proof.snapshot(app.pool, `step-${step++}`);
      return { decision, response };
    }
    const weak = 'aggression-weak', strong = 'aggression-strong';
    assert.equal((await act(weak)).decision.category, 'other');
    const loss = await act(weak); assert.equal(loss.decision.type, 'legacy.jump'); assert.equal(loss.response.body.win, false);
    const loss2 = await act(weak); assert.equal(loss2.decision.type, 'legacy.jump'); assert.equal(loss2.response.body.win, false);
    const recovery = await act(weak); assert.equal(recovery.decision.type, 'legacy.heal');
    assert.equal(recovery.response.body.health, 100);
    assert.equal((await act(strong)).decision.category, 'other');
    const victory = await act(strong); assert.equal(victory.decision.type, 'legacy.jump'); assert.equal(victory.response.body.win, true);
    const protectedView = await observe(weak);
    assert(protectedView.me.character.hospSeconds > 0);
    assert(protectedView.rivals.rivals.some((entry) => entry.street?.id === `${strong}-character`));
    const replayBefore = await proof.snapshot(app.pool, 'jump-replay-before');
    const r = victory.decision.request, replay = await invoke(strong, r.method, r.path, r.body, r.idempotencyKey);
    assert.equal(replay.replayed, true); assert.deepEqual(replay.body, victory.response.body);
    const replayAfter = await proof.snapshot(app.pool, 'jump-replay-after'); assert.equal(replayAfter.stateSha256, replayBefore.stateSha256);
    const waitMs = protectedView.me.character.hospSeconds * 1000 + 1000;
    await proof.record({ kind: 'canonical-hospital-wait', waitMs, reportedSeconds: protectedView.me.character.hospSeconds, clock: 'real wall clock', workerCoverage: false });
    console.log(JSON.stringify({ phase: 'waiting-original-hospital-expiry', waitMs }));
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const recovered = await observe(weak); assert.equal(recovered.me.character.hospSeconds, 0); assert(recovered.me.character.energy >= 25);
    assert.equal((await act(weak)).decision.category, 'other');
    const retaliation = await act(weak); assert.equal(retaliation.decision.type, 'legacy.jump'); assert.equal(retaliation.decision.retaliation, true);
    assert.equal(retaliation.response.body.win, false);
    const final = await proof.snapshot(app.pool, 'final');
    // Validate trace syntax before assigning a passing result, in addition to the
    // final indexed hash/chain/invocation validator after recorder completion.
    for (const line of (await fs.readFile(`${output}/history.jsonl`, 'utf8')).trim().split('\n')) JSON.parse(line);
    result = { status: 'PASS_SCOPED', policyResults: Object.values(policies).map((policy) => policy.summary()),
      invariantChecks: baseline.checks.length, hospitalWaitMs: waitMs, exactHttpReplays: 1,
      postgres: (await app.pool.query('SELECT version() AS version')).rows[0].version,
      finalStateSha256: final.stateSha256, matrixQualifying: false, exclusions: runConfiguration.exclusions };
  } catch (error) {
    result = { status: 'FAIL', message: error.message, stack: error.stack }; process.exitCode = 1;
    await proof.record({ kind: 'first-failure', ...result });
    if (app) await proof.snapshot(app.pool, 'failure');
  } finally {
    if (app) await app.close();
    try { await proof.record({ kind: 'database-cleanup', ...await db.close() }); }
    catch (error) { result.status = 'FAIL'; result.cleanupError = error.message; process.exitCode = 1; }
    await proof.artifact('random-tape.json', { draws: runtime.tape, clocks: 'Application follows real wall clock; PostgreSQL native clock unchanged. No deterministic world-replay claim.' });
    runtime.restore();
    const record = await proof.finish(result); await proofTools.verifyArtifactIndex(output, record);
  }
  console.log(JSON.stringify(result));
}
