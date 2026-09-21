// Real PostgreSQL, complete committed Family custody boundaries, original clocks and scoped rollback.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { FAMILY_CASH_AMMO_CONTRACT, snapshotFamilyCashAmmo, reconcileFamilyCashAmmo, normalizeFamilyCustodySnapshot } from '../tools/rc1-family-cash-ammo-journal.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';

assert(process.argv.includes('--postgres'), 'Explicit native PostgreSQL required');
const output = process.env.RC1_FAMILY_CUSTODY_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(output && controlUrl, 'Fresh restricted output and local control database required');
const source = await sourceIdentity();
const database = planOwnedWorldDatabase({ controlUrl, runId: 'family-custody', sourceRevision: source.revision });
for (const key of ['LAW_BUST_P', 'SEASON_MOD', 'SEASON_PHASE', 'CHAIN_RPC_URL', 'LIQUIDITY_RPC_URL',
  'LIQUIDITY_RPC_FALLBACK_URL', 'INVARIANT_WEBHOOK_URL', 'CITY_WIRE_WEBHOOK_URL']) assert(!process.env[key], 'Undeclared override: ' + key);
const epoch = Date.parse('2026-09-20T12:00:00.000Z');
const expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
const configuration = { scenario: 'scoped-exact-family-cash-ammo-custody', contract: FAMILY_CASH_AMMO_CONTRACT,
  sourcePins: WORKER_SOURCE_PINS, database: database.descriptor, epoch: new Date(epoch).toISOString(), expectedDormant,
  entry: 'Two ordinary guest/character entries. Before baseline only the founder receives level75 respect eligibility; actual daily check-in funds formation. No SQL cash, ammo, item or membership grants.',
  measured: 'Canonical formation, join, nonzero cash tribute and exact replay; natural GTA car acquisition (maximum20 attempts) and melt; promotion, boss departure/succession, late dissolution ammo-ledger fault, same-key retry and successful replay.',
  clocks: 'Shared application/SQL logical clock; public own-character cooldown/jail waits; every due original worker callback. No duration/probability overrides or wall-time equivalence.',
  fault: 'A local transactions trigger rejects only gang:dissolved ammo after the cash receipt attempt. The whole canonical transaction must roll back; trigger and function removed and absence verified before exact-key retry.',
  evidence: 'Complete custody snapshots and exact canonical operation outcomes at every measured mutation and original worker callback; all canonical invariants and unchanged shared resource observer with unknown classifications retained.',
  exclusions: ['OMR/reserve lineage', 'war/turf/contracts/territory branches', 'generic cash/ammo withdrawal (no authored endpoint)',
    'full resource taxonomy', 'same-seed fresh-world replay', '100-inflight soak', '90-day/225-run matrix', 'production and real participants'] };
Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', COORDINATION_ACCOUNT_IDS: '',
  LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on',
  SOCIAL_VERIFY_MODE: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
const proof = await createProofRecorder({ directory: output, source, configuration, runId: 'family-custody', seed: 'rc1-alpha',
  scenarioId: configuration.scenario, population: 2 });
const runtime = installSerialRuntime('rc1-alpha', configuration.epoch); let at = epoch;
runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: (value) => { at = value; }, expectedDormant });
const namespace = 'rc1_worker_family_' + process.pid + '_' + Math.floor(performance.now());
const base = new pg.Pool({ connectionString: database.url });
const seam = installWorkerInstrumentation(controller, { namespace });
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
let app, result, measured = false, faultInstalled = false, invariantBoundaries = 0, resourceSequence = 0;
const journals = [], resourceSummaries = [], unsupported = [];
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
  await proof.record({ kind: 'database-created', ...await database.create() });
  await base.query('CREATE SCHEMA ' + namespace);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap);
  const [{ buildServer }, { runLedgerInvariants }, observer, { PACING }] = await Promise.all([
    import('../src/server.js'), import('../src/invariants.js'), import('../tools/rc1-world-resource-observer.js'), import('../src/rules.js')]);
  app = await buildServer(); const pool = app.pool;
  async function invariants(label) {
    const report = await runLedgerInvariants(pool, { alert: false }); assert(report.ok, JSON.stringify(report)); invariantBoundaries++;
    await proof.record({ kind: 'canonical-invariants', label, logicalAt: at, checks: report.checks }); return report.checks.length;
  }
  async function boundary(before, after, identity, operation = null) {
    const n = resourceSequence++, label = 'boundary-' + n;
    let custody = null, global;
    try {
      if (measured) {
        custody = reconcileFamilyCashAmmo(before.custody, after.custody, { operations: operation ? [operation] : [] });
        assert.equal(custody.status, 'PASS_SCOPED');
        await proof.artifact(label + '-custody.json', { identity, before: before.custody, after: after.custody, operations: operation ? [operation] : [], journal: custody });
        journals.push({ label, flows: custody.flows, familyChecks: custody.checks.length, personalChecks: custody.personalChecks.length });
      }
      global = observer.reconcileWorldResources(before.global, after.global, { identity, includeRestrictedChanges: true });
    } catch (error) {
      await proof.artifact(label + '-failure.json', { identity, before, after, operation, message: error.message }); throw error;
    }
    await proof.artifact(label + '-global.json', global);
    unsupported.push(...global.unsupported.map((r) => ({ boundary: label, ...r })));
    resourceSummaries.push({ label, identity, checks: global.checks.length, status: global.status, unsupported: global.unsupported.length });
    await proof.record({ kind: 'resource-boundary', ...resourceSummaries.at(-1) });
  }
  const snapshots = async () => ({ global: await observer.snapshotWorldResources(pool), custody: measured ? await snapshotFamilyCashAmmo(pool) : null });
  async function invoke(actor, method, path, body, key, label = path, expected = 200) {
    const before = await snapshots();
    const identity = { accountId: actor?.accountId || null, method, path, label, logicalAt: at,
      ...(body === undefined ? {} : { body }), ...(key === undefined ? {} : { key }) };
    const response = await proof.invoke('ordinary-http', identity, async () => {
      const r = await app.inject({ method, url: path, headers: { ...(actor?.token ? { authorization: 'Bearer ' + actor.token } : {}),
        ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { payload: body }) });
      return { status: r.statusCode, replayed: r.headers['x-idempotent-replay'] === 'true', body: r.json() };
    });
    const operation = measured && method === 'POST' ? { accountId: actor.accountId, characterId: actor.characterId, method, path,
      ...(body === undefined ? {} : { body }), idempotencyKey: key, result: response } : null;
    await boundary(before, await snapshots(), { label, method, path, logicalAt: at }, operation);
    if (expected !== null) assert.equal(response.status, expected, JSON.stringify(response));
    if (method !== 'GET') await invariants(label); return response;
  }
  const actors = [];
  for (const name of ['Custody Founder', 'Custody Member']) {
    const bootstrapSecret = crypto.randomBytes(32).toString('base64url');
    const guest = await invoke(null, 'POST', '/v1/auth/guest', { bootstrapSecret }, undefined, 'ordinary-guest-' + actors.length);
    const actor = { token: guest.body.token, accountId: app.jwt.verify(guest.body.token).sub };
    const ch = await invoke(actor, 'POST', '/v1/character', { name }, 'entry-' + actors.length, 'ordinary-character-' + actors.length);
    actor.characterId = ch.body.id; actors.push(actor);
    await proof.artifact('entry-' + (actors.length - 1) + '.json', { bootstrapSecret, ...actor });
  }
  const [founder, member] = actors, respect = PACING.LEVEL_DIVISOR * (75 - 1) ** 2;
  const priorFounder = (await pool.query('SELECT id,respect,cash,ammo FROM characters WHERE id=$1', [founder.characterId])).rows[0];
  await pool.query('UPDATE characters SET respect=$2 WHERE id=$1', [founder.characterId, respect]);
  await proof.artifact('declared-fixture.json', { before: priorFounder, after: { respect }, timing: 'initialization-only', directWrites: 1,
    rationale: 'Level75 founder check-in funds authored formation; no cash/ammo/car/membership fixture.' });
  const checkin = await invoke(founder, 'POST', '/v1/checkin', undefined, 'founder-checkin');
  await proof.artifact('actual-checkin.json', checkin);
  let beforeBoot = await snapshots(); await bootOriginalWorker(controller);
  await boundary(beforeBoot, await snapshots(), { authority: 'original-worker-boot', logicalAt: at }); await invariants('worker-boot');
  measured = true;
  await proof.record({ kind: 'measured-initialization', ordinaryEntrants: 2, directFixtureWrites: 1, fixtureWritesAfterThisRecord: false });
  const invariantChecks = await invariants('initial'); await proof.snapshot(pool, 'initial');
  const formation = await invoke(founder, 'POST', '/v1/gangs', { name: 'Custody Family', tag: 'CF' }, 'formation');
  const familyId = formation.body.gangId;
  await invoke(member, 'POST', '/v1/gangs/' + familyId + '/join', undefined, 'join');
  const tribute = await invoke(member, 'POST', '/v1/gangs/tribute', { amount: 200 }, 'tribute');
  const preReplay = await proof.snapshot(pool, 'tribute-before-replay');
  const retry = await invoke(member, 'POST', '/v1/gangs/tribute', { amount: 200 }, 'tribute', 'tribute-exact-replay');
  assert(retry.replayed); assert.deepEqual(retry.body, tribute.body);
  assert.equal((await proof.snapshot(pool, 'tribute-after-replay')).stateSha256, preReplay.stateSha256);
  async function advance(deadline) {
    assert(deadline > at); let prior = await snapshots();
    await controller.advanceTo(deadline, async (logicalAt, label) => {
      const after = await snapshots(); await boundary(prior, after, { authority: 'original-worker-callback', label, logicalAt });
      await invariants('worker:' + label); prior = await snapshots();
    });
    await boundary(prior, await snapshots(), { authority: 'logical-clock-terminal-boundary', logicalAt: at });
  }
  let acquired = null, boostAttempts = 0;
  for (; boostAttempts < 20 && !acquired;) {
    const own = (await invoke(founder, 'GET', '/v1/me', undefined, undefined, 'public-car-eligibility-' + boostAttempts)).body.character;
    const delay = Math.max(own.gtaSeconds || 0, own.jailSeconds || 0, own.energy < 10 ? 600 : 0);
    if (delay) await advance(at + delay * 1000);
    const boosted = await invoke(founder, 'POST', '/v1/garage/boost', undefined, 'boost-' + boostAttempts++);
    if (boosted.body.success) acquired = boosted.body.car;
  }
  assert(acquired, 'No canonical GTA success within declared20-attempt bound');
  const melt = await invoke(founder, 'POST', '/v1/garage/' + acquired.id + '/melt', undefined, 'melt');
  assert(melt.body.tithe > 0); const custodyBeforeSuccession = await snapshotFamilyCashAmmo(pool);
  await invoke(founder, 'POST', '/v1/gangs/promote', { characterId: member.characterId, role: 'underboss' }, 'promote');
  const left = await invoke(founder, 'POST', '/v1/gangs/leave', undefined, 'founder-leave'); assert.equal(left.body.dissolved, false);
  const succession = await snapshotFamilyCashAmmo(pool);
  assert.deepEqual(succession.families, custodyBeforeSuccession.families);
  assert.deepEqual(succession.members, [{ gang_id: familyId, character_id: member.characterId, role: 'boss' }]);
  await proof.artifact('succession-preserved.json', { before: custodyBeforeSuccession, after: succession, response: left.body });
  const faultBefore = await proof.snapshot(pool, 'dissolve-before-fault');
  await pool.query("CREATE FUNCTION rc1_family_ammo_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason='gang:dissolved' AND NEW.currency='ammo' THEN RAISE EXCEPTION 'rc1 scoped late ammo ledger fault'; END IF; RETURN NEW; END $$");
  await pool.query('CREATE TRIGGER rc1_family_ammo_fault BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION rc1_family_ammo_fault()'); faultInstalled = true;
  let failed;
  try { failed = await invoke(member, 'POST', '/v1/gangs/leave', undefined, 'last-leave', 'dissolution-late-ammo-fault', 500); }
  finally {
    await pool.query('DROP TRIGGER IF EXISTS rc1_family_ammo_fault ON transactions');
    await pool.query('DROP FUNCTION IF EXISTS rc1_family_ammo_fault()'); faultInstalled = false;
  }
  assert.equal((await pool.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname='rc1_family_ammo_fault'")).rows[0].n, 0);
  assert.equal((await pool.query("SELECT count(*)::int n FROM pg_proc WHERE proname='rc1_family_ammo_fault'")).rows[0].n, 0);
  const faultAfter = await proof.snapshot(pool, 'dissolve-after-fault');
  assert.deepEqual(normalizeFamilyCustodySnapshot(faultAfter), normalizeFamilyCustodySnapshot(faultBefore));
  await proof.artifact('fault-cleanup.json', { triggerAbsent: true, functionAbsent: true, custodyAndReceiptsRolledBack: true,
    wholeSnapshotIdentical: faultAfter.stateSha256 === faultBefore.stateSha256, response: failed });
  const dissolved = await invoke(member, 'POST', '/v1/gangs/leave', undefined, 'last-leave', 'dissolution-same-key-after-rollback');
  assert.equal(dissolved.body.dissolved, true); assert.equal(dissolved.replayed, false);
  const preLastReplay = await proof.snapshot(pool, 'dissolve-before-replay');
  const again = await invoke(member, 'POST', '/v1/gangs/leave', undefined, 'last-leave', 'dissolution-exact-replay');
  assert(again.replayed); assert.deepEqual(again.body, dissolved.body);
  assert.equal((await proof.snapshot(pool, 'dissolve-after-replay')).stateSha256, preLastReplay.stateSha256);
  await invariants('final'); const final = await proof.snapshot(pool, 'final'), trace = controller.diagnostic(); assert.equal(trace.failures.length, 0);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map((label) =>
    [label, trace.events.filter((e) => e.kind === 'timer.fire' && e.label === label).length]));
  const minutes = Math.floor((at - epoch) / 300000), hours = Math.floor((at - epoch) / 3600000);
  assert.deepEqual(timerCounts, { directorTick: minutes, guardedTick: hours, guardedSeasonTick: hours, 'health-boundary': minutes });
  await proof.artifact('worker-schedule.json', trace); await proof.artifact('random-tape.json', { draws: runtime.tape });
  await proof.artifact('custody-summary.json', { journals, contract: FAMILY_CASH_AMMO_CONTRACT });
  await proof.artifact('resource-summary.json', { resourceSummaries, unsupported, qualifyingFullResourcePass: false });
  result = { status: 'PASS_SCOPED', ordinaryEntrants: 2, initialRespectFixtures: 1, otherDirectGameplayFixtureWrites: 0,
    boostAttempts, actualTribute: 200, personalMeltAmmo: melt.body.rounds, familyMeltAmmo: melt.body.tithe, familyMeltCash: melt.body.tithe * 30,
    dissolvedCash: 200 + melt.body.tithe * 30, dissolvedAmmo: melt.body.tithe, preservedSuccession: true, scopedFaults: 1,
    sameKeyRetriesAfterRollback: 1, exactSuccessfulReplays: 2, faultCleanupVerified: true,
    custodyBoundaries: journals.length, invariantChecks, invariantBoundaries, resourceBoundaries: resourceSummaries.length,
    unsupportedResourceClassifications: unsupported.length, observedLogicalSeconds: (at - epoch) / 1000, timerCounts,
    finalStateSha256: final.stateSha256, qualifyingFullResourcePass: false, matrixQualifying: false, exclusions: configuration.exclusions };
} catch (error) {
  result = { status: 'FAIL', message: error.message, stack: error.stack, logicalAt: at }; process.exitCode = 1;
  await proof.record({ kind: 'first-failure', ...result });
  await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-custody-summary.json', { journals, resourceSummaries, unsupported });
  if (app) await proof.snapshot(app.pool, 'failure');
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = originalConsole[level];
  if (faultInstalled && app) {
    await app.pool.query('DROP TRIGGER IF EXISTS rc1_family_ammo_fault ON transactions');
    await app.pool.query('DROP FUNCTION IF EXISTS rc1_family_ammo_fault()');
    await proof.record({ kind: 'fault-finally-cleanup', triggerAndFunctionDropped: true });
  }
  for (const close of [async () => { if (app) await app.close(); }, () => controller.close(), () => base.end(),
    async () => proof.record({ kind: 'database-cleanup', ...await database.close() })]) {
    try { await close(); } catch (error) { result.status = 'FAIL'; result.cleanupFailure = error.message; process.exitCode = 1;
      await proof.record({ kind: 'cleanup-failure', message: error.message }); }
  }
  seam.restore(); runtime.restore(); const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify(result));
