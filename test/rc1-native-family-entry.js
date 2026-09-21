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
const source = await sourceIdentity(), seed = 'rc1-family-entry-alpha';
const runId = `family-entry-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(arg('output') || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
const database = planOwnedWorldDatabase({ controlUrl: process.env.RC1_RESOURCE_DATABASE_URL, runId, sourceRevision: source.revision });
for (const key of ['SEASON_MOD', 'SEASON_MODS', 'SEASON_PHASE', 'LAW_BUST_P', 'CHAIN_RPC_URL', 'CHAIN_SIGNER_PK', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL', 'INVARIANT_WEBHOOK_URL', 'REDIS_URL'])
  assert(!process.env[key], `Undeclared override or external integration ${key}`);
const epoch = Date.parse('2026-09-20T12:00:00.000Z'), roles = ['a', 'b', 'member', 'outsider'];
const actors = Object.fromEntries(roles.map(role => [role, `fe-${role}`]));
const configuration = { seed, epoch: new Date(epoch).toISOString(), sourcePins: WORKER_SOURCE_PINS, logicalMinutes: 15,
  scope: 'Ordinary Family formation cash sink and member cash/OMR tribute; exact receipt/custody and completed HTTP/idempotency binding',
  fixtures: ['Four ordinary fixture accounts; default cash500/ammo25; declared respect10000 eligibility',
    'Initial1000OMR reallocated from retired AMM seed: a400,b400,member200; exchange till1000000cash declared before baseline',
    'Canonical prebaseline redemption200/200/100 funds formation/tribute; all command/ledger/window records retained',
    'No prebaseline Family or membership fixture; no gameplay status/deadline/balance rewrite after baseline',
    'Population off deployment switch; liquidity automation off; RWA health registry dormant; no provider or chain integration'],
  authority: 'Canonical HTTP through completed response hooks; original callbacks and aligned SQL/application clock; no forced outcomes',
  limitations: ['No authored personal ammo tribute endpoint; ammo banks checked unchanged, car-melt funding not exercised',
    'Shared observer classifies transaction/membership custody; focused proof binds actual body/route to completed durable idempotency',
    'Join is canonical but remains an explicit shared membership unknown', 'Weekly/seasonal, war, turf, dissolution and unrelated OMR remain unsupported',
    'Native boundaries are completed HTTP actions or explicitly bounded concurrent batch and original callback; not total commit order',
    'No natural progression, external backing, deployment, full resource taxonomy or matrix qualification'],
  databaseIsolation: database.descriptor, fullResourceCoverage: false };
const proof = await createProofRecorder({ directory: output, source, configuration, runId, seed, scenarioId: 'family-entry-observer', population: roles.length });
const runtime = installSerialRuntime(seed, configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: value => { at = value; }, expectedDormant: [{ label: 'RWA health', code: 'health_registry_unavailable' }] });
const namespace = `rc1_worker_familyentry_${process.pid}`, seam = installWorkerInstrumentation(controller, { namespace });
const env = { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', LIVING_WORLD_DIRECTOR: 'LIVE',
  POPULATION_OFF: 'on', LIQUIDITY_AUTOMATION_ENABLED: 'off', SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off', INVITE_MODE: 'off',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex') };
const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])); Object.assign(process.env, env);
const { snapshotWorldResources, worldResourceHash } = await import('../tools/rc1-world-resource-observer.js');
const { verifyFamilyEntryBoundary, familyEntryCorruptions } = await import('./lib/rc1-family-entry-controls.js');
const { dayOf, familyTaskOf } = await import('../src/rules.js');
const base = new pg.Pool({ connectionString: database.url });
const readPool = new pg.Pool({ connectionString: database.url, options: `-c search_path=${namespace}`, max: 4 });
const nativeConsole = { log: console.log, warn: console.warn, error: console.error };
const tokens = new Map(), completions = new Map(), families = {}, calls = [], cases = [], controls = [], saved = new Map(), faults = [];
let pool, app, result, sequence = 0, boundaries = 0, movements = 0, invariants = 0, fault = null, firstFailure = false;
async function call(role, url, key, payload, statuses = [200]) {
  const accountId = actors[role], completionId = String(++sequence); let timer;
  const complete = new Promise((resolve, reject) => { completions.set(completionId, resolve); timer = setTimeout(() => reject(Error('Response completion timed out')), 60000); });
  try {
    const response = await app.inject({ method: 'POST', url, ...(payload === undefined ? {} : { payload }), headers: {
      authorization: `Bearer ${tokens.get(accountId)}`, 'idempotency-key': key, 'x-rc1-response-completion': completionId } });
    await complete;
    const row = { accountId, method: 'POST', url, key, payload: payload ?? null, status: response.statusCode,
      replayed: response.headers['x-idempotent-replay'] === 'true', body: response.json(), completedAt: at };
    calls.push(row); await proof.record({ kind: 'canonical-http-completed', ...row });
    assert(statuses.includes(row.status), `${url}: ${row.status} ${JSON.stringify(row.body)}`); return row;
  } finally { clearTimeout(timer); completions.delete(completionId); }
}
async function durable() { return JSON.parse(JSON.stringify((await readPool.query('SELECT * FROM idempotency ORDER BY account_id,key')).rows)); }
async function seal(name, before, commands, expected, value = null) {
  const input = { name, before, after: await snapshotWorldResources(readPool), commands, durable: await durable(), expected, logicalAt: at, result: value };
  try {
    const journal = verifyFamilyEntryBoundary(input, { expected });
    const artifact = `family-entry-boundary-${String(++boundaries).padStart(4, '0')}.json`;
    await proof.artifact(artifact, input); await proof.record({ kind: 'Family-entry-journal', artifact, journal }); saved.set(name, input);
    movements += journal.familyEntry.movements.length; cases.push({ name, movements: journal.familyEntry.movements.length, unsupported: journal.unsupported });
    return input;
  } catch (error) { if (!firstFailure) { firstFailure = true; await proof.artifact('first-family-entry-failure.json', { ...input, error: error.message, stack: error.stack }); } throw error; }
}
async function observe(name, work, expected = 1) {
  const before = await snapshotWorldResources(readPool), start = calls.length; let value;
  try { value = await work(); await seal(name, before, calls.slice(start), expected, value ?? null); return value; }
  catch (error) { if (!firstFailure) { firstFailure = true; await proof.artifact('first-family-entry-failure.json', { name, before,
    after: await snapshotWorldResources(readPool), commands: calls.slice(start), durable: await durable(), expected, result: value ?? null, error: error.message, stack: error.stack }); } throw error; }
}
async function replay(name, original) { return observe(name, async () => {
  const row = await call(roles.find(role => actors[role] === original.accountId), original.url, original.key, original.payload);
  assert(row.replayed); assert.deepEqual(row.body, original.body); return row;
}, 0); }
async function installFault(currency, amount) {
  assert(!fault); const field = currency === 'cash' ? 'treasury' : 'omr_reserve';
  const prior = (await pool.query(`SELECT ${field}::text AS balance FROM gangs WHERE id=$1`, [families.a])).rows[0].balance;
  const sql = `CREATE FUNCTION rc1_familyentry_abort() RETURNS trigger LANGUAGE plpgsql AS $fault$
    BEGIN IF NEW.reason='gang:tribute' AND NEW.currency='${currency}' AND NEW.amount=-${amount} THEN
      IF (SELECT ${field} FROM gangs WHERE id=NEW.counterparty) <> ${prior} + ${amount} THEN
        RAISE EXCEPTION 'Family credit predecessor missing' USING ERRCODE='RFE02'; END IF;
      RAISE EXCEPTION 'RC1_FAMILY_ENTRY_ABORT after Family credit before durable ledger' USING ERRCODE='RFE01';
    END IF; RETURN NEW; END $fault$`;
  await proof.artifact(`fault-${currency}.json`, { sql, currency, amount, prior, disposition: 'Declared diagnostic trigger; throws only after canonical Family credit; no resource edits' });
  await pool.query(sql); await pool.query('CREATE TRIGGER rc1_familyentry_abort BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION rc1_familyentry_abort()'); fault = currency;
}
async function removeFault() { await pool.query('DROP TRIGGER rc1_familyentry_abort ON transactions'); await pool.query('DROP FUNCTION rc1_familyentry_abort()'); fault = null; }
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => {
    if (fault && args.some(value => String(value?.code || value).includes('RFE01') || String(value).includes('RC1_FAMILY_ENTRY_ABORT'))) {
      faults.push({ currency: fault, logicalAt: at, code: 'RFE01', message: args.map(value => value instanceof Error ? value.message : String(value)).join(' ') }); return;
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
  await invariant('baseline'); await proof.artifact('initial-state.json', { fixtureWritesEndHere: true, state: await snapshotWorldResources(readPool) });
  await observe('original-worker-bootstrap', () => bootOriginalWorker(controller).then(() => ({ booted: true })), null);
  for (const role of ['a', 'b']) {
    const row = await observe(`formation-${role}`, () => call(role, '/v1/gangs', `found-${role}`, { name: `Entry Family ${role.toUpperCase()}`, tag: `FE${role.toUpperCase()}` }));
    families[role] = row.body.gangId; await replay(`formation-${role}-retry`, row);
  }
  await observe('member-joins-a', () => call('member', `/v1/gangs/${families.a}/join`, 'member-join'), null);
  await observe('outsider-cash-refused', () => call('outsider', '/v1/gangs/tribute', 'outsider-cash', { amount: 100 }, [400]), 0);
  await observe('outsider-omr-refused', () => call('outsider', '/v1/gangs/tribute/omr', 'outsider-omr', { amount: 6 }, [400]), 0);
  for (const [role, currency, amount] of [['a', 'cash', '100.99'], ['member', 'cash', 123.99], ['b', 'cash', 150], ['a', 'omr', '6.99'], ['member', 'omr', 7], ['b', 'omr', 8]]) {
    const url = `/v1/gangs/tribute${currency === 'omr' ? '/omr' : ''}`, key = `${role}-${currency}`;
    const row = await observe(`tribute-${key}`, () => call(role, url, key, { amount })); await replay(`tribute-${key}-retry`, row);
  }
  const raced = await observe('cash-concurrent-exact-duplicate', () => Promise.all([1, 2].map(() => call('member', '/v1/gangs/tribute', 'cash-race', { amount: 151 }, [200, 409]))));
  assert.equal(raced.filter(row => row.status === 200 && !row.replayed).length, 1); await replay('cash-concurrent-exact-retry', raced.find(row => row.status === 200));
  for (const [currency, amount] of [['cash', 177], ['omr', 13]]) {
    await installFault(currency, amount); const before = await snapshotWorldResources(readPool), url = `/v1/gangs/tribute${currency === 'omr' ? '/omr' : ''}`;
    await observe(`${currency}-late-abort`, () => call('member', url, `${currency}-late-abort`, { amount }, [500]), 0);
    assert.equal(worldResourceHash(await snapshotWorldResources(readPool)), worldResourceHash(before), 'Late abort changed authoritative observed state');
    await removeFault(); const row = await observe(`${currency}-late-abort-retry`, () => call('member', url, `${currency}-late-abort`, { amount }));
    await replay(`${currency}-late-abort-exact-retry`, row);
  }
  await invariant('after-canonical-entry');
  let previousState = await snapshotWorldResources(readPool);
  await controller.advanceTo(epoch + 15 * 60000, async (logicalAt, label) => {
    const input = await seal(`worker-${logicalAt}-${label}`, previousState, [], null); previousState = input.after;
  });
  await invariant('after-original-workers');
  for (const name of ['formation-a', 'tribute-member-cash', 'tribute-member-omr']) for (const control of familyEntryCorruptions(saved.get(name))) {
    const artifact = `family-entry-control-${String(controls.length + 1).padStart(3, '0')}.json`; await proof.artifact(artifact, control);
    controls.push({ name: control.name, artifact, rejected: true });
  }
  const schedule = controller.diagnostic(); assert.equal(schedule.failures.length, 0); assert.equal(faults.length, 2);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map(label => [label, schedule.events.filter(row => row.kind === 'timer.fire' && row.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: 3, guardedTick: 0, guardedSeasonTick: 0, 'health-boundary': 3 });
  await proof.artifact('worker-schedule.json', schedule); await proof.artifact('random-tape.json', runtime.tape);
  await proof.artifact('expected-late-aborts.json', faults); await proof.artifact('final-state.json', await snapshotWorldResources(readPool));
  result = { status: 'PASS_SCOPED', boundaries, movements, invariants, cases, controls, timerCounts, logicalMinutes: 15, fullResourceCoverage: false, exclusions: configuration.limitations };
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
