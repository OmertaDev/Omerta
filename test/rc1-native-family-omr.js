import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
assert(process.argv.includes('--postgres'), 'Native PostgreSQL required');
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = await sourceIdentity(), seed = arg('seed') || 'rc1-family-omr-alpha';
const runId = `family-omr-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(arg('output') || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
const database = planOwnedWorldDatabase({ controlUrl: process.env.RC1_RESOURCE_DATABASE_URL, runId, sourceRevision: source.revision });
for (const key of ['SEASON_MOD', 'SEASON_MODS', 'LAW_BUST_P', 'CHAIN_RPC_URL', 'CHAIN_SIGNER_PK', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL', 'INVARIANT_WEBHOOK_URL', 'REDIS_URL'])
  assert(!process.env[key], `Undeclared outcome override or external integration ${key}`);
const epoch = Date.parse('2026-09-20T12:00:00.000Z'), roles = ['a', 'b', 'c', 'soldier', 'member', 'donor'];
const actors = Object.fromEntries(roles.map(role => [role, `fo-${role}`]));
const configuration = { seed, epoch: new Date(epoch).toISOString(), sourcePins: WORKER_SOURCE_PINS, logicalHours: 3,
  scope: 'Exact Family OMR tribute, reserve spending/recycling, ranked worker yield, membership custody and dissolution',
  fixtures: ['Six ordinary accounts with defaultcash500/ammo25; respect10000 eligibility; stats50 except rival b stats5',
    'Initial4920OMR reallocated from retired AMM20000 seed to accounts; declared1000000cash till before baseline',
    'Canonical prebaseline redemption400/200/200 funds formation/tribute; actual window receipts retained; no Family membership or reserve fixture',
    'Population off deploy switch; no provider or rail configuration; no postbaseline status/deadline/balance edits'],
  authority: 'Canonical HTTP injection plus original local callbacks; shared logical application and SQL clocks; no forced combat outcome',
  worker: 'Actual family yield executes hourly; old12h source comments are not treated as runtime authority',
  war: 'Canonical declaration, scored jump and original30min resolution affect cash/standing; OMR no-change control only, not full cash custody proof',
  databaseIsolation: database.descriptor, fullResourceCoverage: false };
const proof = await createProofRecorder({ directory: output, source, configuration, runId, seed, scenarioId: 'family-omr-exact-custody', population: roles.length });
const runtime = installSerialRuntime(seed, configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: value => { at = value; }, expectedDormant: [{ label: 'RWA health', code: 'health_registry_unavailable' }] });
const namespace = `rc1_worker_familyomr_${process.pid}`, seam = installWorkerInstrumentation(controller, { namespace });
const env = { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', LIVING_WORLD_DIRECTOR: 'LIVE',
  POPULATION_OFF: 'on', LIQUIDITY_AUTOMATION_ENABLED: 'off', SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off', INVITE_MODE: 'off',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex') };
const previousEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])); Object.assign(process.env, env);
const { snapshotFamilyOmr, reconcileFamilyOmr, familyOmrCustodyHash, FAMILY_OMR_EXCLUSIONS } = await import('../tools/rc1-family-omr-journal.js');
const { omrBuckets } = await import('../tools/rc1-omr-journal.js');
const { M3, dayOf, familyTaskOf } = await import('../src/rules.js');
const base = new pg.Pool({ connectionString: database.url }), readPool = new pg.Pool({ connectionString: database.url, options: `-c search_path=${namespace}`, max: 4 });
const nativeConsole = { log: console.log, warn: console.warn, error: console.error }, tokens = new Map(), families = {};
const calls = [], cases = [], controls = [], saved = new Map(), faults = [];
let pool, app, result, boundaries = 0, movements = 0, equations = 0, invariants = 0, faultKind = null, firstFailure = false;
async function call(role, url, key, payload, statuses = [200]) {
  const accountId = actors[role], startedAt = at;
  const response = await app.inject({ method: 'POST', url, payload, headers: { authorization: `Bearer ${tokens.get(accountId)}`, 'idempotency-key': key } });
  const row = { accountId, method: 'POST', url, key, payload: payload ?? null, startedAt, completedAt: at, status: response.statusCode,
    replayed: response.headers['x-idempotent-replay'] === 'true', body: response.json() };
  calls.push(row); await proof.record({ kind: 'canonical-http-receipt', ...row });
  assert(statuses.includes(row.status), `${url}: ${row.status} ${JSON.stringify(row.body)}`); return row;
}
async function observe(name, work, verify = () => {}, yieldAuthority = false) {
  const before = await snapshotFamilyOmr(readPool), start = calls.length; let value, after, journal;
  try { value = await work(); after = await snapshotFamilyOmr(readPool); const commands = calls.slice(start);
    journal = reconcileFamilyOmr(before, after, { commands, logicalAt: at, yieldAuthority }); await verify({ before, after, value, journal });
    const input = { name, before, after, commands, logicalAt: at, yieldAuthority, result: value ?? null }, artifact = `family-omr-boundary-${String(++boundaries).padStart(4, '0')}.json`;
    await proof.artifact(artifact, input); await proof.record({ kind: 'family-omr-lineage', artifact, journal }); saved.set(name, input);
    equations += journal.equations.length; movements += journal.lineage.length; cases.push({ name, outcome: 'PASS', movements: journal.lineage.length }); return value;
  } catch (error) { if (!firstFailure) { firstFailure = true; after ||= await snapshotFamilyOmr(readPool);
    await proof.artifact('first-family-omr-failure.json', { name, before, after, commands: calls.slice(start), logicalAt: at, yieldAuthority,
      result: value ?? null, journal: journal ?? null, error: error.message, stack: error.stack }); } throw error; }
}
const unchanged = ({ before, after }) => assert.equal(familyOmrCustodyHash(after), familyOmrCustodyHash(before), 'Abort/replay/refusal changed scoped authoritative custody');
async function replay(name, original) { return observe(name, async () => { const role = roles.find(role => actors[role] === original.accountId);
  const row = await call(role, original.url, original.key, original.payload); assert(row.replayed); assert.deepEqual(row.body, original.body); return row; }, unchanged); }
async function installFault(kind) {
  assert(!faultKind); const id = families.a;
  const condition = kind === 'seal' ? "NEW.reason='desk:recycle' AND NEW.counterparty='vanity:gang:seal'"
    : kind === 'yield' ? 'NEW.lifetime_paid > OLD.lifetime_paid' : `OLD.id='${id}'`;
  const predecessor = kind === 'seal' ? "reason='vanity:gang:seal'" : kind === 'yield' ? "reason='yield:family'" : `reason='gang:dissolved' AND counterparty='${id}'`;
  const returned = kind === 'dissolution' ? 'OLD' : 'NEW';
  await pool.query(`CREATE FUNCTION rc1_familyomr_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN
    IF NOT EXISTS(SELECT 1 FROM transactions WHERE currency='omr' AND ${predecessor} AND at=now()) THEN
      RAISE EXCEPTION 'RC1_WRONG_FAMILYOMR_FAILPOINT' USING ERRCODE='RFO02'; END IF;
    RAISE EXCEPTION 'RC1_FAMILYOMR_ABORT_AFTER_VALUE' USING ERRCODE='RFO01'; END IF; RETURN ${returned}; END $$`);
  await pool.query(`CREATE TRIGGER rc1_familyomr_abort BEFORE ${kind === 'seal' ? 'INSERT ON transactions' : kind === 'yield' ? 'UPDATE ON family_yield_pool' : 'DELETE ON gangs'}
    FOR EACH ROW EXECUTE FUNCTION rc1_familyomr_abort()`); faultKind = kind;
}
async function removeFault() { const table = faultKind === 'seal' ? 'transactions' : faultKind === 'yield' ? 'family_yield_pool' : 'gangs';
  await pool.query(`DROP TRIGGER rc1_familyomr_abort ON ${table}`); await pool.query('DROP FUNCTION rc1_familyomr_abort()'); faultKind = null; }
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => {
    if (faultKind && args.some(value => String(value?.code || value).includes('RFO01') || String(value).includes('RC1_FAMILYOMR_ABORT'))) {
      faults.push({ kind: faultKind, logicalAt: at, code: 'RFO01', message: args.map(value => value instanceof Error ? `${value.code}: ${value.message}` : String(value)).join(' ') }); return; }
    controller.log(level, args);
  };
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query(`CREATE SCHEMA ${namespace}`);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap); pool = await makeWorkerDatabase(controller);
  const { buildServer } = await import('../src/server.js'); app = await buildServer();
  await proof.record({ kind: 'database-version', ...(await pool.query('SELECT version() AS version')).rows[0] });
  const allocation = { a: 2200, b: 1200, c: 1000, soldier: 500, member: 0, donor: 20 };
  for (const role of roles) {
    const actor = actors[role]; await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [actor]);
    await pool.query('INSERT INTO account_persistent(account_id,omr) VALUES($1,$2)', [actor, allocation[role]]);
    await pool.query(`INSERT INTO characters(id,account_id,name,season,loc,cash,respect,muscle,cunning,speed,ammo)
      VALUES($1,$1,$1,$2,0,500,10000,$3,$3,$3,25)`, [actor, Math.floor(dayOf() / 28), role === 'b' ? 5 : 50]);
    tokens.set(actor, app.jwt.sign({ sub: actor, tv: 0 }));
  }
  assert.equal(Object.values(allocation).reduce((sum, n) => sum + n, 0), 4920);
  await pool.query('UPDATE amm_pool SET omr_reserve=omr_reserve-4920 WHERE id=1');
  await pool.query('UPDATE exchange_pool SET balance=1000000,lifetime_funded=1000000 WHERE id=1');
  await proof.artifact('prebaseline-fixture-allocation.json', await snapshotFamilyOmr(readPool));
  for (const [role, amount] of [['a', 400], ['b', 200], ['c', 200]]) await call(role, '/v1/window/redeem', `fixture-window-${role}`, { amount });
  assert.equal(familyTaskOf().key, 'crime', 'This fixture excludes weekly-contract completion by cash tribute or jump');
  await proof.artifact('prebaseline-canonical-window-receipts.json', { commands: calls, transactions: (await pool.query('SELECT * FROM transactions ORDER BY at,id')).rows });
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const invariant = async label => { const value = await runLedgerInvariants(pool, { alert: false }); assert(value.ok, `${label}: ${JSON.stringify(value.checks.filter(row => !row.ok))}`);
    await proof.record({ kind: 'canonical-invariants', label, value }); invariants++; };
  await invariant('baseline'); await proof.artifact('initial-state.json', { state: await snapshotFamilyOmr(readPool), fixtureWritesEndHere: true });
  await observe('original-worker-bootstrap', () => bootOriginalWorker(controller).then(() => ({ booted: true })), () => {}, true);
  for (const role of ['a', 'b', 'c']) {
    const row = await observe(`family:${role}:found`, () => call(role, '/v1/gangs', `found-${role}`, { name: `OMR Proof ${role.toUpperCase()}`, tag: `FO${role.toUpperCase()}` }));
    families[role] = row.body.gangId;
  }
  for (const role of ['soldier', 'member']) await observe(`family:${role}:join`, () => call(role, `/v1/gangs/${families.a}/join`, `join-${role}`));
  await observe('tribute:outsider-refused', () => call('donor', '/v1/gangs/tribute/omr', 'outsider-tribute', { amount: 6 }, [400]), unchanged);
  for (const [role, amount] of [['a', 1200], ['b', 300], ['c', 100]]) await observe(`tribute:${role}`, () => call(role, '/v1/gangs/tribute/omr', `tribute-${role}`, { amount }));
  const duplicate = await observe('tribute:member-concurrent-exact-duplicate', async () => {
    const rows = await Promise.all([1, 2].map(() => call('soldier', '/v1/gangs/tribute/omr', 'member-tribute', { amount: 200.99 }, [200, 409])));
    assert(rows.some(row => row.status === 200)); return rows.find(row => row.status === 200);
  }, ({ journal }) => assert.equal(journal.lineage.length, 1));
  await replay('tribute:exact-retry', duplicate);
  await observe('reserve:soldier-seal-refused', () => call('soldier', '/v1/gangs/vanity/seal', 'seal-denied', undefined, [400]), unchanged);
  await installFault('seal');
  try { await observe('reserve:seal-late-recycle-abort', () => call('a', '/v1/gangs/vanity/seal', 'seal', undefined, [500]), unchanged); }
  finally { await removeFault(); }
  const seal = await observe('reserve:seal-spend', () => call('a', '/v1/gangs/vanity/seal', 'seal')); await replay('reserve:seal-exact-retry', seal);
  await observe('reserve:promote-underboss', () => call('a', '/v1/gangs/promote', 'promote', { characterId: actors.soldier, role: 'underboss' }));
  const foundation = await observe('reserve:underboss-foundation', () => call('soldier', '/v1/gangs/foundation', 'foundation')); await replay('reserve:foundation-exact-retry', foundation);
  await observe('reserve:charter-first-free', () => call('a', '/v1/gangs/charter/syndicate', 'charter-first'));
  const charter = await observe('reserve:charter-paid', () => call('a', '/v1/gangs/charter/outfit', 'charter-paid')); await replay('reserve:charter-exact-retry', charter);
  await observe('reserve:charter-original-cooldown-refused', () => call('a', '/v1/gangs/charter/fixers', 'charter-early', undefined, [400]), unchanged);
  for (const [role, amount] of [['a', 30000], ['b', 20000], ['c', 10000]]) await observe(`standing:${role}:cash-tribute`, () => call(role, '/v1/gangs/tribute', `cash-${role}`, { amount }));
  assert.equal(M3.WAR_MS, 30 * 60000);
  await observe('war:declare-OMR-unchanged', () => call('a', `/v1/gangs/war/${families.b}`, 'war'), ({ after }) => {
    for (const id of [families.a, families.b]) assert.equal(Date.parse(after.gangs.find(row => row.id === id).war_until), epoch + M3.WAR_MS);
  });
  await observe('war:canonical-scored-jump-OMR-unchanged', () => call('a', `/v1/streets/${actors.b}/jump`, 'war-jump'), ({ value, after }) => {
    assert(value.body.win && value.body.war); assert.equal(after.gangs.find(row => row.id === families.a).war_score_us, 1);
  });
  await observe('workers:original-war-deadline', () => controller.advanceTo(epoch + M3.WAR_MS).then(() => ({ at })), () => {}, true);
  await observe('war:original-due-touch-and-standing', () => call('a', '/v1/gangs/tribute', 'war-settle', { amount: 100 }), ({ before, after }) => {
    const oldA = before.gangs.find(row => row.id === families.a), oldB = before.gangs.find(row => row.id === families.b);
    const a = after.gangs.find(row => row.id === families.a), b = after.gangs.find(row => row.id === families.b), spoils = Math.floor(Number(oldB.treasury) * M3.WAR_SPOILS);
    assert(spoils > 0); assert.equal(Number(a.treasury), Number(oldA.treasury) + spoils + 100); assert.equal(Number(b.treasury), Number(oldB.treasury) - spoils);
    assert.equal(a.season_wars, oldA.season_wars + 1); assert.equal(a.war_with, null); assert.equal(b.war_with, null);
  });
  await installFault('yield');
  try { await observe('yield:first-original-hour-abort-after-credits', () => controller.advanceTo(epoch + 3600000).then(() => ({ at })), ({ before, after }) => {
    assert.deepEqual(omrBuckets(after), omrBuckets(before)); assert.deepEqual(after.transactions.filter(row => row.currency === 'omr'), before.transactions.filter(row => row.currency === 'omr'));
    assert.equal(faults.filter(row => row.kind === 'yield').length, 1);
  }, true); } finally { await removeFault(); }
  await observe('yield:next-original-hour-three-ranked-shares', () => controller.advanceTo(epoch + 2 * 3600000).then(() => ({ at })), ({ journal }) => {
    assert.deepEqual(journal.lineage.map(row => row.amount), ['16.670000', '13.330000', '10.000000']);
  }, true);
  const { payFamilyYield } = await import('../src/exchange.js');
  await observe('yield:empty-pot-canonical-replay', () => payFamilyYield(pool), unchanged, true);
  await observe('membership:boss-leaves-reserve-preserved', () => call('a', '/v1/gangs/leave', 'boss-leave'), ({ value, after }) => {
    assert(!value.body.dissolved); assert.equal(value.body.newBoss, actors.soldier); assert.equal(after.gang_members.find(row => row.character_id === actors.soldier).role, 'boss');
  });
  await observe('membership:member-leaves-reserve-preserved', () => call('member', '/v1/gangs/leave', 'member-leave'));
  await installFault('dissolution');
  try { await observe('dissolution:late-abort-after-reserve-recycle', () => call('soldier', '/v1/gangs/leave', 'last-leave', undefined, [500]), unchanged); }
  finally { await removeFault(); }
  await observe('membership:canonical-rejoin', () => call('member', `/v1/gangs/${families.a}/join`, 'member-rejoin'));
  const departures = await observe('dissolution:concurrent-last-two-members', () => Promise.all([
    call('soldier', '/v1/gangs/leave', 'last-leave'), call('member', '/v1/gangs/leave', 'concurrent-leave')]), ({ value, journal }) => {
    assert.equal(value.filter(row => row.body.dissolved).length, 1); assert.equal(journal.lineage.length, 1);
  });
  await replay('dissolution:exact-retry', departures[0]);
  await observe('dissolution:second-family', () => call('b', '/v1/gangs/leave', 'family-b-leave'));
  await invariant('integer-and-cent-boundaries');
  await observe('yield:fractional-canonical-window-funding', () => call('donor', '/v1/window/redeem', 'fractional-window', { amount: '6.19' }),
    ({ value }) => assert.equal(value.body.familyCut, 0.3095));
  await observe('yield:fractional-backing-original-hour', () => controller.advanceTo(epoch + 3 * 3600000).then(() => ({ at })), () => {}, true);
  await observe('yield:sub-cent-remainder-replay', () => payFamilyYield(pool), unchanged, true);
  await invariant('final');
  const corrupt = async (name, baseName, change) => { const input = structuredClone(saved.get(baseName)); change(input); let error;
    try { reconcileFamilyOmr(input.before, input.after, input); } catch (caught) { error = caught.message; }
    assert(error, `Corruption escaped ${name}`); const artifact = `negative-${name}.json`; await proof.artifact(artifact, input); controls.push({ name, artifact, outcome: 'REJECTED', error }); };
  await corrupt('missing-tribute-receipt', 'tribute:a', input => { input.after.transactions = input.after.transactions.filter(row => !(row.currency === 'omr' && row.reason === 'gang:tribute')); });
  await corrupt('tribute-wrong-family-balanced', 'tribute:a', input => {
    input.after.transactions.find(row => row.currency === 'omr' && row.reason === 'gang:tribute').counterparty = families.b;
    input.after.gangs.find(row => row.id === families.a).omr_reserve = '0'; input.after.gangs.find(row => row.id === families.b).omr_reserve = '1200';
  });
  await corrupt('missing-recycle', 'reserve:seal-spend', input => { input.after.transactions = input.after.transactions.filter(row => row.counterparty !== 'vanity:gang:seal'); });
  await corrupt('duplicate-yield-receipt', 'yield:next-original-hour-three-ranked-shares', input => { const row = structuredClone(input.after.transactions.find(row => row.reason === 'yield:family')); row.id = 'duplicate'; input.after.transactions.push(row); });
  await corrupt('wrong-ranked-share', 'yield:next-original-hour-three-ranked-shares', input => { const rows = input.after.transactions.filter(row => row.reason === 'yield:family'); [rows[0].counterparty, rows[1].counterparty] = [rows[1].counterparty, rows[0].counterparty]; });
  await corrupt('yield-not-observed', 'yield:next-original-hour-three-ranked-shares', input => { input.yieldAuthority = false; });
  await corrupt('dissolution-personal-refund', 'dissolution:concurrent-last-two-members', input => { input.after.account_persistent.find(row => row.account_id === actors.soldier).omr = '966.67'; });
  await corrupt('lost-reserve-on-succession', 'membership:boss-leaves-reserve-preserved', input => { input.after.gangs.find(row => row.id === families.a).omr_reserve = '0'; });
  await corrupt('missing-request-owner', 'tribute:member-concurrent-exact-duplicate', input => { input.after.idempotency.find(row => row.key === 'member-tribute').account_id = actors.donor; });
  await corrupt('subatomic-pool-drift', 'yield:empty-pot-canonical-replay', input => { input.after.family_yield_pool[0].balance = '0.000000000001'; });
  const schedule = controller.diagnostic(); assert.equal(schedule.failures.length, 1); assert.equal(schedule.failures[0].label, 'family yield'); assert.equal(schedule.failures[0].code, 'RFO01');
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map(label => [label, schedule.events.filter(row => row.kind === 'timer.fire' && row.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: 36, guardedTick: 3, guardedSeasonTick: 3, 'health-boundary': 36 });
  await proof.artifact('final-state.json', await snapshotFamilyOmr(readPool)); await proof.artifact('worker-schedule.json', schedule);
  await proof.artifact('random-tape.json', runtime.tape); await proof.artifact('expected-late-rollbacks.json', faults);
  result = { status: 'PASS_SCOPED', boundaries, movements, equations, invariants, cases, controls, timerCounts, logicalHours: 3,
    originalWarMilliseconds: M3.WAR_MS, fullResourceCoverage: false, exclusions: FAMILY_OMR_EXCLUSIONS };
} catch (error) {
  result = { status: 'FAIL', error: error.message, logicalAt: at, boundaries, movements, equations, invariants, cases, controls };
  await proof.record({ kind: 'failure', message: error.message, stack: error.stack }); await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-random-tape.json', runtime.tape);
  if (pool) { const { runLedgerInvariants } = await import('../src/invariants.js'), { runExchangeInvariants } = await import('../src/exchange.js');
    await proof.artifact('failure-canonical-invariants.json', { ledger: await runLedgerInvariants(pool, { alert: false }), exchange: await runExchangeInvariants(pool) }); }
  process.exitCode = 1;
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = nativeConsole[level];
  if (app) await app.close(); await controller.close(); await readPool.end(); await base.end(); seam.restore(); runtime.restore();
  for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify({ runId, output, source: source.revision, status: result.status, boundaries, movements, fullResourceCoverage: false }));
