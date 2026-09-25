import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createChurnPolicy, CHURN_POLICY_CONTRACT } from '../tools/rc1-churn-policy.js';

const WEEK_MS = 7 * 86400000;
const configuration = { seed: 'rc1-alpha', epochAt: 0,
  initialRoster: Array.from({ length: 25 }, (_, i) => ({ accountId: `actor-${i}`, characterId: `character-${i}`, sessionRef: `session-${i}` })) };
const boundary = (policy, week, active = policy.roster().current) => ({ week, logicalAt: week * WEEK_MS, activeAccountIds: active });
function finishEnrollment(policy) {
  const guest = policy.nextEnrollment(); assert.equal(guest.phase, 'guest');
  const receipt = { requestId: guest.requestId, phase: 'guest', status: 'COMPLETED',
    accountId: `account-${guest.requestId}`, sessionRef: `session-${guest.requestId}` };
  policy.settleEnrollment(receipt); assert.deepEqual(policy.settleEnrollment(receipt), { duplicate: true });
  const character = policy.nextEnrollment();
  policy.settleEnrollment({ requestId: character.requestId, phase: 'character', status: 'COMPLETED',
    accountId: character.accountId, characterId: `character-${character.requestId}`, idempotencyKey: character.request.idempotencyKey });
}
const quota = createChurnPolicy(configuration);
for (let week = 1; week <= 26; week++) {
  const before = quota.checkpoint(), input = boundary(quota, week);
  const preview = quota.previewWeek(input); assert.deepEqual(quota.checkpoint(), before);
  assert.deepEqual(quota.beginWeek(input), preview);
  assert.equal(preview.replacementCount, week % 2 === 1 ? 7 : 8);
  for (const id of preview.retiredAccountIds) assert.equal(quota.isCurrent(id), false);
  while (quota.nextEnrollment()) finishEnrollment(quota);
  const summary = quota.summary();
  assert.equal(summary.retiredActors, Math.floor(week * 25 * .3));
  assert.equal(summary.currentCohort, 25); assert.equal(summary.lifetimeRegistered, 25 + summary.retiredActors);
  assert.equal(summary.pendingEnrollments, 0);
}
const varying = createChurnPolicy(configuration); let cumulativeActive = 0;
for (let week = 1; week <= 40; week++) {
  const active = varying.roster().current.slice(0, week % 26); cumulativeActive += active.length;
  varying.beginWeek(boundary(varying, week, active));
  while (varying.nextEnrollment()) finishEnrollment(varying);
  assert.equal(varying.summary().retiredActors, Math.floor(cumulativeActive * 3 / 10));
}
const pending = createChurnPolicy(configuration), input = boundary(pending, 1);
const plan = pending.beginWeek(input), guest = pending.nextEnrollment();
const resumed = createChurnPolicy(configuration).restore(pending.checkpoint());
assert.deepEqual(resumed.nextEnrollment(), guest);
assert.throws(() => resumed.beginWeek(boundary(resumed, 2)), /pending/);
const guestReceipt = { requestId: guest.requestId, phase: 'guest', status: 'COMPLETED', accountId: 'new-account', sessionRef: 'private-session-ref' };
resumed.settleEnrollment(guestReceipt);
assert.equal(resumed.summary().registeredWithoutCharacter, 1); assert.equal(resumed.summary().currentCohort, 18);
const character = resumed.nextEnrollment(), resumedCharacter = createChurnPolicy(configuration).restore(resumed.checkpoint());
assert.deepEqual(resumedCharacter.nextEnrollment(), character);
const characterReceipt = { requestId: character.requestId, phase: 'character', status: 'COMPLETED',
  accountId: character.accountId, characterId: 'new-character', idempotencyKey: character.request.idempotencyKey };
for (const invalid of [{ ...characterReceipt, accountId: 'wrong' }, { ...characterReceipt, idempotencyKey: 'invented' },
  { ...characterReceipt, characterId: configuration.initialRoster[0].characterId }, { ...characterReceipt, status: 'DENIED' }]) {
  const before = resumedCharacter.checkpoint(); assert.throws(() => resumedCharacter.settleEnrollment(invalid));
  assert.deepEqual(resumedCharacter.checkpoint(), before);
}
resumedCharacter.settleEnrollment(characterReceipt);
assert(resumedCharacter.isCurrent('new-account')); assert.equal(resumedCharacter.summary().registeredWithoutCharacter, 0);
assert.deepEqual(resumedCharacter.settleEnrollment(characterReceipt), { duplicate: true });
assert.throws(() => resumedCharacter.settleEnrollment({ ...characterReceipt, characterId: 'different' }), /Conflicting/);
for (const invalid of [{ ...guestReceipt, accountId: configuration.initialRoster[0].accountId },
  { ...guestReceipt, accountId: plan.retiredAccountIds[0] }, { ...guestReceipt, sessionRef: configuration.initialRoster[0].sessionRef },
  { ...guestReceipt, phase: 'character' }, { ...guestReceipt, status: 'DENIED' }]) {
  const before = pending.checkpoint(); assert.throws(() => pending.settleEnrollment(invalid)); assert.deepEqual(pending.checkpoint(), before);
}
const fresh = createChurnPolicy(configuration);
for (const invalid of [{ ...input, logicalAt: WEEK_MS - 1 }, { ...input, week: 2 },
  { ...input, activeAccountIds: ['foreign'] }, { ...input, activeAccountIds: ['actor-1', 'actor-1'] }]) assert.throws(() => fresh.beginWeek(invalid));
const ordered = fresh.previewWeek(input);
assert.deepEqual(fresh.previewWeek({ ...input, activeAccountIds: [...input.activeAccountIds].reverse() }), ordered);
assert.notDeepEqual(createChurnPolicy({ ...configuration, seed: 'rc1-beta' }).previewWeek(input).retiredAccountIds, ordered.retiredAccountIds);
assert.throws(() => createChurnPolicy({ ...configuration, database: {} }));
for (const change of [(s) => s.current.push('invented'), (s) => s.remainderTenths++,
  (s) => s.enrollments[0].requestId = 'invented', (s) => s.lifetime[0].retiredWeek = 99]) {
  const checkpoint = resumedCharacter.checkpoint(); change(checkpoint);
  assert.throws(() => createChurnPolicy(configuration).restore(checkpoint));
}
assert.deepEqual(createChurnPolicy(configuration).restore(quota.checkpoint()).checkpoint(), quota.checkpoint());
console.log('PASS: 7/8 weekly quotas, variable active denominator, current/lifetime separation, enrollment receipts and restart guards');

if (process.argv.includes('--postgres')) await nativeExercise();

async function nativeExercise() {
  const [{ planOwnedWorldDatabase }, proofTools] = await Promise.all([
    import('../tools/rc1-native-database.js'), import('../tools/rc1-native-proof.js')]);
  const output = process.env.RC1_CHURN_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
  assert(output && controlUrl, 'Fresh restricted output and explicit local PostgreSQL required');
  const source = await proofTools.sourceIdentity();
  const db = planOwnedWorldDatabase({ controlUrl, runId: 'churn-native', sourceRevision: source.revision });
  for (const key of ['SEARCH_MS', 'SHOOT_CD_MS', 'SEASON_MOD', 'SEASON_PHASE', 'CHAIN_RPC_URL', 'LIQUIDITY_RPC_URL'])
    assert(!process.env[key], `Undeclared gameplay/integration override: ${key}`);
  const runConfiguration = { scenario: 'scoped-high-player-churn-custody', policy: CHURN_POLICY_CONTRACT, database: db.descriptor,
    initialization: '25 ordinary guest/character enrollments; no direct SQL fixture writes. One selected retiree posts an ordinary $50 market buy order with original one-hour TTL before the measured boundary.',
    boundary: 'One declared weekly-boundary exercise at current real time, with cohort epoch seven days earlier. This does not claim seven days of actual activity or clock advancement.',
    enrollment: 'Seven ordinary new guest/character identities under local INVITE_MODE=off and RATE_LIMIT=off; standard rolled stats and schema birth resources; no check-ins, grants or progression fixtures.',
    exclusions: ['Seven elapsed activity days', 'original one-hour escrow expiry and refund', 'full thirteen-resource transition journals',
      'all worker intervals', '90 days/225 runs', 'same-seed fresh-world equivalence', 'production admission and load', 'real people and deployed environment'] };
  const proof = await proofTools.createProofRecorder({ directory: output, source, configuration: runConfiguration,
    runId: 'churn-native', seed: 'rc1-alpha', scenarioId: runConfiguration.scenario, population: 25 });
  let app, result;
  try {
    await proof.record({ kind: 'database-created', ...await db.create() });
    Object.assign(process.env, { DATABASE_URL: db.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
      COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on',
      RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off', LIVING_WORLD_DIRECTOR: 'DIRECTOR_DISABLED',
      JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
    const [{ buildServer }, { CONSTANTS }, { runLedgerInvariants }, { directorConfiguration }] = await Promise.all([
      import('../src/server.js'), import('../src/rules.js'), import('../src/invariants.js'), import('../src/director/config.js')]);
    assert.equal(directorConfiguration().mode, 'DIRECTOR_DISABLED'); app = await buildServer();
    const sessions = new Map(), credentials = new Map();
    const request = async (sessionRef, method, path, body, key) => {
      const response = await app.inject({ method, url: path,
        headers: { ...(sessionRef ? { authorization: `Bearer ${sessions.get(sessionRef)}` } : {}), ...(key ? { 'idempotency-key': key } : {}) },
        ...(body === undefined ? {} : { payload: body }) });
      return { status: response.statusCode, replayed: response.headers['x-idempotent-replay'] === 'true', body: response.json() };
    };
    const invoke = async (sessionRef, method, path, body, key) => {
      const response = await proof.invoke('ordinary-http', { sessionRef, method, path,
        ...(body === undefined ? {} : { body }), ...(key === undefined ? {} : { key }) }, () => request(sessionRef, method, path, body, key));
      assert.equal(response.status, 200, JSON.stringify(response)); return response;
    };
    async function prepareCredential(ref, label) {
      const secret = crypto.randomBytes(32).toString('base64url'); credentials.set(ref, secret);
      await proof.artifact(`${label}-credential.json`, { credentialRef: ref, bootstrapSecret: secret });
    }
    async function guestEnrollment(ref, sessionRef, label, retry = false) {
      const response = await invoke(null, 'POST', '/v1/auth/guest', { bootstrapSecret: credentials.get(ref) });
      const accountId = app.jwt.verify(response.body.token).sub;
      sessions.set(sessionRef, response.body.token);
      await proof.artifact(`${label}-session.json`, { accountId, sessionRef, token: response.body.token });
      if (retry) {
        const repeated = await invoke(null, 'POST', '/v1/auth/guest', { bootstrapSecret: credentials.get(ref) });
        assert.equal(app.jwt.verify(repeated.body.token).sub, accountId);
        const count = await app.pool.query('SELECT count(*)::int AS n FROM accounts WHERE id=$1', [accountId]); assert.equal(count.rows[0].n, 1);
      }
      return accountId;
    }
    async function assertNewborn(accountId, characterId) {
      const row = (await app.pool.query('SELECT * FROM characters WHERE id=$1 AND account_id=$2', [characterId, accountId])).rows[0];
      assert(row); assert.equal(row.alive, true); assert.equal(row.generation, 1);
      for (const [key, value] of Object.entries({ cash: 500, bank: 0, respect: 0, energy: 50, nerve: 10, health: 100, ammo: 25, heat: 0, cb: 0 }))
        assert.equal(Number(row[key]), value, key);
      assert.equal(row.muscle + row.cunning + row.speed, CONSTANTS.CREATE_STAT_TOTAL);
      assert([row.muscle, row.cunning, row.speed].every((n) => n >= CONSTANTS.CREATE_STAT_MIN));
      const persistent = (await app.pool.query('SELECT agent_flag,minted,mint_credits,respawn_tokens FROM account_persistent WHERE account_id=$1', [accountId])).rows[0];
      assert.equal(persistent.agent_flag, false); assert.equal(persistent.minted, false);
      assert.equal(Number(persistent.mint_credits), 0); assert.equal(Number(persistent.respawn_tokens), 0);
      await proof.record({ kind: 'canonical-newborn-resource-assertion', accountId, characterId, character: row, persistent });
    }
    const initialRoster = [];
    for (let i = 0; i < 25; i++) {
      const label = `initial-${i}`, ref = `private-${label}`, sessionRef = `session-${label}`;
      await prepareCredential(ref, label); const accountId = await guestEnrollment(ref, sessionRef, label);
      const created = await invoke(sessionRef, 'POST', '/v1/character', { name: `Churn Initial ${i}` }, `${label}-character`);
      await assertNewborn(accountId, created.body.id); initialRoster.push({ accountId, characterId: created.body.id, sessionRef });
    }
    const logicalAt = Date.now(), config = { seed: 'rc1-alpha', epochAt: logicalAt - WEEK_MS, initialRoster };
    let policy = createChurnPolicy(config);
    const input = { week: 1, logicalAt, activeAccountIds: initialRoster.map((actor) => actor.accountId) };
    const planned = policy.previewWeek(input), owner = initialRoster.find((actor) => actor.accountId === planned.retiredAccountIds[0]);
    const order = await invoke(owner.sessionRef, 'POST', '/v1/market/order', { goodId: 'gin', qty: 1, price: 50, hours: 1 }, 'initial-custody-order');
    assert.equal(order.body.escrow, 50); assert.equal(order.body.fee, 10); assert.equal(order.body.expiresSeconds, 3600);
    const custody = async () => ({
      order: (await app.pool.query('SELECT * FROM market_listings WHERE id=$1', [order.body.id])).rows[0],
      character: (await app.pool.query('SELECT * FROM characters WHERE id=$1', [owner.characterId])).rows[0],
      account: (await app.pool.query('SELECT * FROM accounts WHERE id=$1', [owner.accountId])).rows[0],
      ledger: (await app.pool.query('SELECT * FROM transactions WHERE character_id=$1 ORDER BY id', [owner.characterId])).rows });
    const originalCustody = await custody();
    assert.equal(originalCustody.order.seller_character, owner.characterId); assert.equal(originalCustody.order.status, 'live');
    assert.equal(Number(originalCustody.character.cash), 440);
    const invariants = async (label) => {
      const report = await runLedgerInvariants(app.pool, { alert: false }); assert(report.ok, JSON.stringify(report));
      await proof.record({ kind: 'canonical-invariants', label, checks: report.checks }); return report.checks.length;
    };
    const invariantChecks = await invariants('baseline');
    await proof.record({ kind: 'measured-initialization', fixtureWritesAfterThisRecord: false, canonicalOrder: order.body.id,
      boundaryOnly: true, completedWeekActivityClaim: false });
    const baseline = await proof.snapshot(app.pool, 'before-retirement');
    assert.deepEqual(policy.beginWeek(input), planned);
    for (const id of planned.retiredAccountIds) { assert.equal(policy.isCurrent(id), false); sessions.delete(initialRoster.find((actor) => actor.accountId === id).sessionRef); }
    await proof.artifact('retirement-checkpoint.json', policy.checkpoint());
    policy = createChurnPolicy(config).restore(policy.checkpoint());
    const retired = await proof.snapshot(app.pool, 'after-retirement'); assert.equal(retired.stateSha256, baseline.stateSha256);
    assert.deepEqual(await custody(), originalCustody);
    for (let i = 0; policy.nextEnrollment(); i++) {
      const pending = policy.nextEnrollment(), label = `replacement-${i}`, sessionRef = `session-${pending.requestId}`;
      await prepareCredential(pending.credentialRef, label);
      await proof.artifact(`${label}-pending-guest.json`, policy.checkpoint());
      policy = createChurnPolicy(config).restore(policy.checkpoint()); assert.deepEqual(policy.nextEnrollment(), pending);
      const accountId = await guestEnrollment(pending.credentialRef, sessionRef, label, true);
      policy.settleEnrollment({ requestId: pending.requestId, phase: 'guest', status: 'COMPLETED', accountId, sessionRef });
      const character = policy.nextEnrollment();
      await proof.artifact(`${label}-pending-character.json`, policy.checkpoint());
      policy = createChurnPolicy(config).restore(policy.checkpoint()); assert.deepEqual(policy.nextEnrollment(), character);
      const r = character.request, created = await invoke(sessionRef, r.method, r.path, r.body, r.idempotencyKey);
      // Simulate an unacknowledged canonical create: restore the durable pending
      // policy, then recover its exact response through ordinary HTTP idempotency.
      policy = createChurnPolicy(config).restore(policy.checkpoint()); assert.deepEqual(policy.nextEnrollment(), character);
      const beforeReplay = await proof.snapshot(app.pool, `${label}-replay-before`);
      const replay = await invoke(sessionRef, r.method, r.path, r.body, r.idempotencyKey);
      assert.equal(replay.replayed, true); assert.deepEqual(replay.body, created.body);
      const afterReplay = await proof.snapshot(app.pool, `${label}-replay-after`); assert.equal(afterReplay.stateSha256, beforeReplay.stateSha256);
      policy.settleEnrollment({ requestId: character.requestId, phase: 'character', status: 'COMPLETED', accountId,
        characterId: replay.body.id, idempotencyKey: r.idempotencyKey });
      await assertNewborn(accountId, replay.body.id); assert.deepEqual(await custody(), originalCustody);
      await invariants(label);
    }
    assert.equal(policy.summary().currentCohort, 25); assert.equal(policy.summary().lifetimeRegistered, 32);
    assert.equal(policy.summary().retiredActors, 7); assert.equal(policy.summary().pendingEnrollments, 0);
    const totals = (await app.pool.query('SELECT (SELECT count(*) FROM accounts)::int AS accounts,(SELECT count(*) FROM characters)::int AS characters')).rows[0];
    assert.deepEqual(totals, { accounts: 32, characters: 32 });
    const finalCustody = await custody(); assert.deepEqual(finalCustody, originalCustody);
    assert(new Date(finalCustody.order.expires_at).getTime() > Date.now(), 'Do not imply expiry coverage after the boundary');
    await proof.artifact('custody-preserved.json', { originalCustody, finalCustody, retiredOwner: owner.accountId,
      canonicalRecovery: 'Original unchanged expiry is still pending. No retired actor session executed after retirement.' });
    await proof.artifact('final-policy.json', policy.checkpoint());
    const final = await proof.snapshot(app.pool, 'final');
    for (const line of (await fs.readFile(`${output}/history.jsonl`, 'utf8')).trim().split('\n')) JSON.parse(line);
    result = { status: 'PASS_SCOPED', policy: policy.summary(), invariantChecks, ordinaryInitialEntries: 25, ordinaryReplacementEntries: 7,
      bootstrapSameAccountRetries: 7, characterExactReplays: 7, escrow: 50, listingFee: 10, originalExpirySeconds: 3600,
      canonicalExpiryExecuted: false, retiredCustodyUnchanged: true, fullRetirementStateUnchanged: true,
      postgres: (await app.pool.query('SELECT version() AS version')).rows[0].version,
      finalStateSha256: final.stateSha256, matrixQualifying: false, exclusions: runConfiguration.exclusions };
  } catch (error) {
    result = { status: 'FAIL', message: error.message, stack: error.stack }; process.exitCode = 1;
    await proof.record({ kind: 'first-failure', ...result }); if (app) await proof.snapshot(app.pool, 'failure');
  } finally {
    if (app) { try { await app.close(); } finally { await app.pool.end(); } }
    try { await proof.record({ kind: 'database-cleanup', ...await db.close() }); }
    catch (error) { result.status = 'FAIL'; result.cleanupError = error.message; process.exitCode = 1; }
    const record = await proof.finish(result); await proofTools.verifyArtifactIndex(output, record);
  }
  console.log(JSON.stringify(result));
}
