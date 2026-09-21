import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
assert(process.argv.includes('--postgres'), 'Native PostgreSQL required');
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = await sourceIdentity(), seed = 'rc1-family-terminal-alpha';
const runId = `family-terminal-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(arg('output') || process.env.RC1_FAMILY_DISSOLUTION_OUTPUT || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
const database = planOwnedWorldDatabase({ controlUrl: process.env.RC1_RESOURCE_DATABASE_URL, runId, sourceRevision: source.revision });
for (const key of ['SEASON_MOD', 'SEASON_MODS', 'SEASON_PHASE', 'LAW_BUST_P', 'CHAIN_RPC_URL', 'CHAIN_SIGNER_PK', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL', 'INVARIANT_WEBHOOK_URL', 'REDIS_URL'])
  assert(!process.env[key], `Undeclared override or external integration ${key}`);
const epoch = Date.parse('2026-09-20T12:00:00.000Z'), roles = ['a', 'b', 'member', 'outsider'];
const actors = Object.fromEntries(roles.map(role => [role, `ft-${role}`]));
const configuration = { seed, epoch: new Date(epoch).toISOString(), sourcePins: WORKER_SOURCE_PINS, finalWorkerMinutes: 15, maximumBoostAttemptsPerFounder: 20, maximumPreparationHours: 6,
  scope: 'Voluntary last-member dissolution: nonzero cash/ammo destruction and exact OMR reserve-to-desk recycling/lifetime input',
  fixtures: ['Four ordinary fixture accounts; default cash500/ammo25; declared respect10000 eligibility',
    'Initial1000OMR reallocated from retired AMM seed: a400,b400,member200; exchange till1000000cash declared before baseline',
    'Canonical prebaseline redemption200/200/100 funds formation/tribute; all command/ledger/window records retained',
    'Canonical Family formation/join/tribute and GTA/melt supply initial terminal custody; public eligibility waits drive every original due callback',
    'No car/ammo/membership fixture; no gameplay status/deadline/balance rewrite after initial allocation',
    'Population off deployment switch; liquidity automation off; RWA health registry dormant; no provider or chain integration'],
  authority: 'Canonical HTTP through completed response hooks; original callbacks and aligned SQL/application clock; no forced outcomes',
  limitations: ['No authored personal ammo tribute endpoint; existing canonical GTA/melt supplies nonzero Family ammo before terminal baseline',
    'Shared observer classifies transaction/membership custody; focused proof binds actual body/route to completed durable idempotency',
    'Preparation GTA/melt, joins and succession may retain shared unknowns; no full acquisition taxonomy claim',
    'Death/estate, territory/turf/war/governance cleanup, weekly/seasonal rewards and multiple-Family compound terminals remain unsupported',
    'Native boundaries are completed HTTP actions or explicitly bounded concurrent batch and original callback; not total commit order',
    'No natural progression, external backing, deployment, full resource taxonomy or matrix qualification'],
  databaseIsolation: database.descriptor, fullResourceCoverage: false };
const proof = await createProofRecorder({ directory: output, source, configuration, runId, seed, scenarioId: 'family-terminal-observer', population: roles.length });
const runtime = installSerialRuntime(seed, configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: value => { at = value; }, expectedDormant: [{ label: 'RWA health', code: 'health_registry_unavailable' }] });
const namespace = `rc1_worker_familyterminal_${process.pid}`, seam = installWorkerInstrumentation(controller, { namespace });
const env = { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', LIVING_WORLD_DIRECTOR: 'LIVE',
  POPULATION_OFF: 'on', LIQUIDITY_AUTOMATION_ENABLED: 'off', SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off', INVITE_MODE: 'off',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex') };
const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])); Object.assign(process.env, env);
const { snapshotWorldResources, worldResourceHash } = await import('../tools/rc1-world-resource-observer.js');
const { verifyFamilyDissolutionBoundary, familyDissolutionCorruptions } = await import('./rc1-world-family-dissolution.js');
const { dayOf, familyTaskOf } = await import('../src/rules.js');
const base = new pg.Pool({ connectionString: database.url });
const readPool = new pg.Pool({ connectionString: database.url, options: `-c search_path=${namespace}`, max: 4 });
const nativeConsole = { log: console.log, warn: console.warn, error: console.error };
const tokens = new Map(), completions = new Map(), families = {}, calls = [], cases = [], controls = [], saved = new Map(), faults = [];
let pool, app, result, sequence = 0, boundaries = 0, movements = 0, invariants = 0, fault = null, firstFailure = false, phase = 'canonical-preparation';
async function call(role, url, key, payload, statuses = [200], method = 'POST') {
  const accountId = actors[role], completionId = String(++sequence); let timer;
  const complete = new Promise((resolve, reject) => { completions.set(completionId, resolve); timer = setTimeout(() => reject(Error('Response completion timed out')), 60000); });
  try {
    const response = await app.inject({ method, url, ...(payload === undefined ? {} : { payload }), headers: {
      authorization: `Bearer ${tokens.get(accountId)}`, ...(key ? { 'idempotency-key': key } : {}), 'x-rc1-response-completion': completionId } });
    await complete;
    const row = { accountId, method, url, key: key ?? null, payload: payload ?? null, status: response.statusCode,
      replayed: response.headers['x-idempotent-replay'] === 'true', body: response.json(), completedAt: at };
    calls.push(row); await proof.record({ kind: 'canonical-http-completed', ...row });
    assert(statuses.includes(row.status), `${url}: ${row.status} ${JSON.stringify(row.body)}`); return row;
  } finally { clearTimeout(timer); completions.delete(completionId); }
}
async function durable() { return JSON.parse(JSON.stringify((await readPool.query('SELECT * FROM idempotency ORDER BY account_id,key')).rows)); }
async function seal(name, before, commands, expected, value = null) {
  const input = { name, phase, before, after: await snapshotWorldResources(readPool), commands, durable: await durable(), expected, logicalAt: at, result: value };
  try {
    const journal = verifyFamilyDissolutionBoundary(input, { expected });
    const artifact = `family-terminal-boundary-${String(++boundaries).padStart(4, '0')}.json`;
    await proof.artifact(artifact, input); await proof.record({ kind: 'Family-terminal-journal', artifact, journal }); saved.set(name, input);
    movements += journal.familyDissolution.movements.length; cases.push({ name, phase, movements: journal.familyDissolution.movements.length, unsupported: journal.unsupported });
    return input;
  } catch (error) { if (!firstFailure) { firstFailure = true; await proof.artifact('first-family-terminal-failure.json', { ...input, error: error.message, stack: error.stack }); } throw error; }
}
async function observe(name, work, expected = null) {
  const before = await snapshotWorldResources(readPool), start = calls.length; let value;
  try { value = await work(); await seal(name, before, calls.slice(start), expected, value ?? null); return value; }
  catch (error) { if (!firstFailure) { firstFailure = true; await proof.artifact('first-family-terminal-failure.json', { name, before,
    after: await snapshotWorldResources(readPool), commands: calls.slice(start), durable: await durable(), expected, result: value ?? null, error: error.message, stack: error.stack }); } throw error; }
}
async function replay(name, original) { return observe(name, async () => {
  const row = await call(roles.find(role => actors[role] === original.accountId), original.url, original.key, original.payload);
  assert(row.replayed); assert.deepEqual(row.body, original.body); return row;
}, 0); }
async function installFault() {
  assert(!fault); const prior = (await pool.query('SELECT balance::text,lifetime_in::text FROM desk_inventory WHERE id=1')).rows[0];
  for (const value of Object.values(prior)) assert(/^\d+(\.\d+)?$/.test(value));
  const sql = `CREATE FUNCTION rc1_familyterminal_abort() RETURNS trigger LANGUAGE plpgsql AS $fault$
    BEGIN IF (SELECT count(*) FROM transactions WHERE reason='gang:dissolved' AND counterparty=OLD.id) <> 3
      OR NOT EXISTS (SELECT 1 FROM transactions WHERE reason='desk:recycle' AND counterparty='gang:dissolved' AND amount=OLD.omr_reserve)
      OR EXISTS (SELECT 1 FROM gang_members WHERE gang_id=OLD.id)
      OR (SELECT balance FROM desk_inventory WHERE id=1) <> ${prior.balance} + OLD.omr_reserve
      OR (SELECT lifetime_in FROM desk_inventory WHERE id=1) <> ${prior.lifetime_in} + OLD.omr_reserve THEN
        RAISE EXCEPTION 'Dissolution predecessor missing' USING ERRCODE='RFD02'; END IF;
      RAISE EXCEPTION 'RC1_FAMILY_TERMINAL_ABORT after all disposal/recycle writes before Family DELETE' USING ERRCODE='RFD01';
    RETURN OLD; END $fault$`;
  await proof.artifact('fault-late-dissolution.json', { sql, prior, disposition: 'Declared diagnostic trigger; verifies three disposal receipts, recycle and desk balance/lifetime before abort; no resource edits' });
  await pool.query(sql); await pool.query('CREATE TRIGGER rc1_familyterminal_abort BEFORE DELETE ON gangs FOR EACH ROW EXECUTE FUNCTION rc1_familyterminal_abort()'); fault = 'late-dissolution';
}
async function removeFault() { await pool.query('DROP TRIGGER rc1_familyterminal_abort ON gangs'); await pool.query('DROP FUNCTION rc1_familyterminal_abort()'); fault = null; }
async function advance(until) {
  let previousState = await snapshotWorldResources(readPool);
  await controller.advanceTo(until, async (logicalAt, label) => { const input = await seal(`worker-${logicalAt}-${label}`, previousState, [], null); previousState = input.after; });
}
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => {
    if (fault && args.some(value => String(value?.code || value).includes('RFD01') || String(value).includes('RC1_FAMILY_TERMINAL_ABORT'))) {
      faults.push({ kind: fault, logicalAt: at, code: 'RFD01', message: args.map(value => value instanceof Error ? value.message : String(value)).join(' ') }); return;
    } controller.log(level, args);
  };
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query(`CREATE SCHEMA ${namespace}`);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap);
  pool = await makeWorkerDatabase(controller); const { buildServer } = await import('../src/server.js'); app = await buildServer();
  app.addHook('onResponse', async req => { const key = req.headers['x-rc1-response-completion'], done = completions.get(key); assert(done); completions.delete(key); done(); });
  await proof.record({ kind: 'database-version', ...(await pool.query('SELECT version() AS version')).rows[0] });
  const allocation = { a: 400, b: 400, member: 200, outsider: 0 };
  for (const role of roles) {
    const actor = actors[role]; await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [actor]);
    await pool.query('INSERT INTO account_persistent(account_id,omr) VALUES($1,$2)', [actor, allocation[role]]);
    await pool.query('INSERT INTO characters(id,account_id,name,season,loc,cash,respect,ammo) VALUES($1,$1,$1,$2,0,500,10000,25)', [actor, Math.floor(dayOf() / 28)]);
    tokens.set(actor, app.jwt.sign({ sub: actor, tv: 0 }));
  }
  await pool.query('UPDATE amm_pool SET omr_reserve=omr_reserve-1000 WHERE id=1');
  await pool.query('UPDATE exchange_pool SET balance=1000000,lifetime_funded=1000000 WHERE id=1');
  await proof.artifact('prebaseline-fixture-allocation.json', await snapshotWorldResources(readPool));
  for (const [role, amount] of [['a', 200], ['b', 200], ['member', 100]]) await call(role, '/v1/window/redeem', `fixture-window-${role}`, { amount });
  assert.equal(familyTaskOf().key, 'crime', 'Weekly tribute completion intentionally outside scoped entry');
  await proof.artifact('prebaseline-canonical-funding.json', { commands: calls, durable: await durable(), state: await snapshotWorldResources(readPool) });
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const invariant = async label => { const value = await runLedgerInvariants(pool, { alert: false }); assert(value.ok, JSON.stringify(value.checks.filter(row => !row.ok)));
    await proof.record({ kind: 'canonical-invariants', label, value }); invariants++; };
  await invariant('initialization'); await proof.artifact('initialization-state.json', { fixtureWritesEndHere: true, state: await snapshotWorldResources(readPool) });
  await observe('original-worker-bootstrap', () => bootOriginalWorker(controller).then(() => ({ booted: true })), null);
  for (const role of ['a', 'b']) {
    const row = await observe(`formation-${role}`, () => call(role, '/v1/gangs', `found-${role}`, { name: `Terminal Family ${role.toUpperCase()}`, tag: `FT${role.toUpperCase()}` }));
    families[role] = row.body.gangId;
  }
  await observe('member-joins-a', () => call('member', `/v1/gangs/${families.a}/join`, 'member-join'), null);
  for (const [role, currency, amount] of [['a', 'cash', 123], ['b', 'cash', 150], ['a', 'omr', 13], ['b', 'omr', 17]]) {
    const url = `/v1/gangs/tribute${currency === 'omr' ? '/omr' : ''}`, key = `${role}-${currency}`;
    await observe(`tribute-${key}`, () => call(role, url, key, { amount }));
  }
  const acquisition = [];
  for (const role of ['a', 'b']) {
    let acquired = null, attempts = 0;
    while (!acquired && attempts < configuration.maximumBoostAttemptsPerFounder) {
      assert(at - epoch <= configuration.maximumPreparationHours * 3600000, 'Canonical acquisition exceeded declared logical bound');
      const own = (await observe(`eligibility-${role}-${attempts}`, () => call(role, '/v1/me', null, undefined, [200], 'GET'))).body.character;
      const delay = Math.max(own.gtaSeconds || 0, own.jailSeconds || 0, own.energy < 10 ? 600 : 0);
      if (delay) await advance(at + delay * 1000);
      const boosted = await observe(`boost-${role}-${attempts}`, () => call(role, '/v1/garage/boost', `boost-${role}-${attempts++}`));
      if (boosted.body.success) acquired = boosted.body.car;
    }
    assert(acquired, 'No canonical GTA success within declared attempts; no synthetic car substitute');
    const melted = await observe(`melt-${role}`, () => call(role, `/v1/garage/${acquired.id}/melt`, `melt-${role}`));
    assert(melted.body.tithe > 0); acquisition.push({ role, attempts, logicalAt: at, carId: acquired.id, melt: melted.body });
  }
  await proof.artifact('canonical-acquisition.json', acquisition);
  const initial = await snapshotWorldResources(readPool);
  assert.equal(initial.tables.gangs.length, 2); for (const family of initial.tables.gangs) for (const field of ['treasury', 'ammo_bank', 'omr_reserve']) assert(Number(family[field]) > 0);
  await invariant('terminal-baseline'); await proof.artifact('initial-state.json', { phase: 'terminal-baseline', state: initial, directResourceWritesAfterInitialization: 0 }); phase = 'terminal-proof';
  const left = await observe('boss-departs-preserved-custody', () => call('a', '/v1/gangs/leave', 'boss-departs')); assert.equal(left.body.dissolved, false);
  await observe('outsider-leave-refused', () => call('outsider', '/v1/gangs/leave', 'outsider-leave', undefined, [400]), 0);
  await installFault(); const beforeAbort = await snapshotWorldResources(readPool);
  await observe('last-member-late-abort', () => call('member', '/v1/gangs/leave', 'last-member-leave', undefined, [500]), 0);
  assert.equal(worldResourceHash(await snapshotWorldResources(readPool)), worldResourceHash(beforeAbort), 'Late terminal abort changed authoritative state or receipts');
  await removeFault(); const first = await observe('last-member-same-key-after-abort', () => call('member', '/v1/gangs/leave', 'last-member-leave'), 1);
  assert.equal(first.body.dissolved, true); await replay('last-member-exact-replay', first);
  const raced = await observe('last-member-concurrent-exact-duplicate', () => Promise.all([1, 2].map(() => call('b', '/v1/gangs/leave', 'last-b-leave', undefined, [200, 409]))), 1);
  assert.equal(raced.filter(row => row.status === 200 && !row.replayed).length, 1); await replay('last-member-concurrent-exact-retry', raced.find(row => row.status === 200));
  await invariant('after-terminal-disposition');
  await advance(at + configuration.finalWorkerMinutes * 60000);
  await invariant('after-original-workers');
  for (const name of ['last-member-same-key-after-abort', 'last-member-concurrent-exact-duplicate']) for (const control of familyDissolutionCorruptions(saved.get(name))) {
    const artifact = `family-terminal-control-${String(controls.length + 1).padStart(3, '0')}.json`; await proof.artifact(artifact, control);
    controls.push({ name: control.name, artifact, rejected: true });
  }
  const schedule = controller.diagnostic(); assert.equal(schedule.failures.length, 0); assert.equal(faults.length, 1);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map(label => [label, schedule.events.filter(row => row.kind === 'timer.fire' && row.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: Math.floor((at - epoch) / 300000), guardedTick: Math.floor((at - epoch) / 3600000),
    guardedSeasonTick: Math.floor((at - epoch) / 3600000), 'health-boundary': Math.floor((at - epoch) / 300000) });
  await proof.artifact('worker-schedule.json', schedule); await proof.artifact('random-tape.json', runtime.tape);
  await proof.artifact('expected-late-aborts.json', faults); await proof.artifact('final-state.json', await snapshotWorldResources(readPool));
  result = { status: 'PASS_SCOPED', boundaries, movements, invariants, cases, controls, timerCounts, logicalMilliseconds: at - epoch,
    preparationAttempts: acquisition.map(row => ({ role: row.role, attempts: row.attempts })), fullResourceCoverage: false, exclusions: configuration.limitations };
} catch (error) {
  result = { status: 'FAIL', error: error.message, boundaries, movements, invariants, cases, controls, logicalAt: at };
  await proof.record({ kind: 'failure', message: error.message, stack: error.stack }); await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-random-tape.json', runtime.tape); process.exitCode = 1;
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = nativeConsole[level];
  if (app) await app.close(); await controller.close(); await readPool.end(); await base.end(); seam.restore(); runtime.restore();
  for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await proof.record({ kind: 'database-cleanup', ...await database.close() }); const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify({ runId, output, source: source.revision, status: result.status, boundaries, movements, fullResourceCoverage: false }));
