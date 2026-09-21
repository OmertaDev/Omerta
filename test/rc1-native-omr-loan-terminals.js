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
const source = await sourceIdentity(), seed = arg('seed') || 'rc1-omr-loan-terminals-alpha';
const runId = `omr-loan-terminals-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(arg('output') || process.env.RC1_OMR_LOAN_OUTPUT || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
const database = planOwnedWorldDatabase({ controlUrl: process.env.RC1_RESOURCE_DATABASE_URL, runId, sourceRevision: source.revision });
for (const name of ['SEARCH_MS', 'SHOOT_CD_MS', 'WANTED_HUNT_P', 'SEASON_MOD', 'SEASON_MODS', 'CHAIN_RPC_URL', 'CHAIN_SIGNER_PK', 'INVARIANT_WEBHOOK_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL', 'REDIS_URL'])
  assert(!process.env[name], `Override/external integration excluded: ${name}`);
const epoch = Date.parse('2026-09-20T12:00:00.000Z'), hours = 27;
const roles = ['lender', 'buyer', 'paperBorrower', 'graceA', 'graceB', 'deadLender', 'inheritBorrower', 'modBorrower', 'thirdBorrower', 'killerThird', 'sameBorrower', 'killerSame'];
const actors = Object.fromEntries(roles.map(role => [role, `ol-${role}`]));
const configuration = { sourcePins: WORKER_SOURCE_PINS, seed, epoch: new Date(epoch).toISOString(), logicalHours: hours,
  authority: 'Canonical authenticated HTTP injection plus original worker callbacks using shared logical application and SQL clocks',
  fixtures: ['12 ordinary accounts defaultcash500/ammo25, stats50/respect10000, no arbitrary hospital/jail/shield deadline',
    'Two hunters equipped lastresort. Initial collateral235OMR and funding1900OMR reallocated from retired AMM20000 seed; till1000000 declared before baseline',
    'Canonical window redemption1900OMR and240 standard ammo boxes before baseline; exact receipts retained',
    'Three initial rat progression flags permit canonical once-per-street48h witness protection; initial rat acquisition is unproved',
    'Population off deploy setting; all original local deadlines still execute. No postbaseline balance/status/deadline edits'],
  boundary: 'Each completed actor request/bounded concurrent batch and complete original worker interval; no assertion of total commit order',
  fullResourceCoverage: false, databaseIsolation: database.descriptor };
const proof = await createProofRecorder({ directory: output, source, configuration, runId, seed, scenarioId: 'omr-loan-terminal-custody', population: roles.length });
const runtime = installSerialRuntime(seed, configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: value => { at = value; }, expectedDormant: [{ label: 'RWA health', code: 'health_registry_unavailable' }] });
const namespace = `rc1_worker_omrloans_${process.pid}`, seam = installWorkerInstrumentation(controller, { namespace });
const env = { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', LIVING_WORLD_DIRECTOR: 'LIVE',
  POPULATION_OFF: 'on', LIQUIDITY_AUTOMATION_ENABLED: 'off', SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off', INVITE_MODE: 'off',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex') };
const previousEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])); Object.assign(process.env, env);
const { snapshotOmrLoans, reconcileOmrLoans, omrLoanCustodyHash, OMR_LOAN_EXCLUSIONS } = await import('../tools/rc1-omr-loan-journal.js');
const { omrBuckets } = await import('../tools/rc1-omr-journal.js');
const { LAW, LOAN, CONSTANTS, seasonIdxOf, dayOf } = await import('../src/rules.js');
const base = new pg.Pool({ connectionString: database.url }), readPool = new pg.Pool({ connectionString: database.url, options: `-c search_path=${namespace}`, max: 4 });
const nativeConsole = { log: console.log, warn: console.warn, error: console.error }, tokens = new Map();
const calls = [], cases = [], controls = [], saved = new Map(), faults = [], loans = {};
let pool, app, result, boundaries = 0, movements = 0, equations = 0, invariants = 0, injected = false, firstFailure = false;
async function call(role, url, key, payload, statuses = [200]) {
  const accountId = actors[role], startedAt = at;
  const response = await app.inject({ method: 'POST', url, payload, headers: url.startsWith('/v1/mod/') ? { 'x-mod-key': env.MOD_KEY }
    : { authorization: `Bearer ${tokens.get(accountId)}`, ...(key ? { 'idempotency-key': key } : {}) } });
  const row = { accountId: accountId || null, method: 'POST', url, key: key || null, payload: payload ?? null, startedAt, completedAt: at,
    status: response.statusCode, replayed: response.headers['x-idempotent-replay'] === 'true', body: response.json() };
  calls.push(row); await proof.record({ kind: 'canonical-http-receipt', ...row });
  assert(statuses.includes(row.status), `${url}: ${row.status} ${JSON.stringify(row.body)}`); return row;
}
async function observe(name, work, verify = () => {}, worker = false) {
  const before = await snapshotOmrLoans(readPool), start = calls.length; let value, after, journal;
  try { value = await work(); after = await snapshotOmrLoans(readPool); const commands = calls.slice(start);
    journal = reconcileOmrLoans(before, after, { commands, logicalAt: at, worker }); await verify({ before, after, value, journal });
    const input = { name, before, after, commands, logicalAt: at, worker, result: value ?? null }, artifact = `omr-loan-boundary-${String(++boundaries).padStart(4, '0')}.json`;
    await proof.artifact(artifact, input); await proof.record({ kind: 'omr-loan-lineage', artifact, journal }); saved.set(name, input);
    equations += journal.equations.length; movements += journal.lineage.length; cases.push({ name, outcome: 'PASS', movements: journal.lineage.length }); return value;
  } catch (error) { if (!firstFailure) { firstFailure = true; after ||= await snapshotOmrLoans(readPool);
    await proof.artifact('first-omr-loan-failure.json', { name, before, after, commands: calls.slice(start), logicalAt: at, worker,
      result: value ?? null, journal: journal ?? null, error: error.message, stack: error.stack }); } throw error; }
}
const unchanged = ({ before, after }) => assert.equal(omrLoanCustodyHash(after), omrLoanCustodyHash(before), 'Abort/replay/refusal changed authoritative custody');
async function replay(name, original) { return observe(name, async () => {
  const role = roles.find(role => actors[role] === original.accountId), row = await call(role, original.url, original.key, original.payload);
  assert(row.replayed); assert.deepEqual(row.body, original.body); return row; }, unchanged); }
async function createLoan(name, lender, borrower, pledge, term = 72) {
  const offered = await observe(`${name}:offer`, () => call(lender, '/v1/loans', `${name}-offer`, { amount: 5000, rate: 0.05, hours: term, collateralOmr: pledge, to: actors[borrower] }));
  loans[name] = offered.body.id;
  const taken = await observe(`${name}:pledge`, () => call(borrower, `/v1/loans/${loans[name]}/take`, `${name}-take`));
  await replay(`${name}:pledge-retry`, taken); return taken;
}
async function fault(kind, ids) {
  assert(!injected); const placeholders = ids.map(id => `'${id.replaceAll("'", "''")}'`).join(',');
  await pool.query(`CREATE FUNCTION rc1_omrloan_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF OLD.id IN (${placeholders}) ${kind === 'grace' ? "AND OLD.status='active' AND NEW.status='collected'" : ''} THEN
      IF NOT EXISTS(SELECT 1 FROM transactions WHERE currency='omr' AND reason='loan:seize:omr' AND counterparty=OLD.borrower_character AND at=now())
        THEN RAISE EXCEPTION 'RC1_WRONG_OMRLOAN_FAILPOINT' USING ERRCODE='RCL02'; END IF;
      RAISE EXCEPTION 'RC1_OMRLOAN_ABORT_AFTER_CREDIT' USING ERRCODE='RCL01'; END IF; RETURN ${kind === 'grace' ? 'NEW' : 'OLD'}; END $$`);
  await pool.query(`CREATE TRIGGER rc1_omrloan_abort BEFORE ${kind === 'grace' ? 'UPDATE' : 'DELETE'} ON loans FOR EACH ROW EXECUTE FUNCTION rc1_omrloan_abort()`); injected = true;
}
async function removeFault() { injected = false; await pool.query('DROP TRIGGER rc1_omrloan_abort ON loans'); await pool.query('DROP FUNCTION rc1_omrloan_abort()'); }
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => {
    if (injected && args.some(value => String(value?.code || value).includes('RCL01') || String(value).includes('RC1_OMRLOAN_ABORT'))) {
      faults.push({ code: 'RCL01', logicalAt: at, message: args.map(value => value instanceof Error ? `${value.code}: ${value.message}` : String(value)).join(' ') }); return; }
    controller.log(level, args);
  };
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query(`CREATE SCHEMA ${namespace}`);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap); pool = await makeWorkerDatabase(controller);
  const { buildServer } = await import('../src/server.js'); app = await buildServer();
  await proof.record({ kind: 'database-version', ...(await pool.query('SELECT version() AS version')).rows[0] });
  for (const role of roles) {
    const actor = actors[role]; await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [actor]);
    await pool.query('INSERT INTO account_persistent(account_id,rat) VALUES($1,$2)', [actor, ['paperBorrower', 'graceA', 'graceB'].includes(role)]);
    await pool.query(`INSERT INTO characters(id,account_id,name,season,loc,cash,respect,muscle,cunning,speed,ammo,gun)
      VALUES($1,$1,$1,$2,0,500,10000,50,50,50,25,$3)`, [actor, seasonIdxOf(dayOf()), role.startsWith('killer') ? 'lastresort' : null]);
    tokens.set(actor, app.jwt.sign({ sub: actor, tv: 0 }));
  }
  const pledges = { paperBorrower: 31, graceA: 33, graceB: 35, inheritBorrower: 37, modBorrower: 35, thirdBorrower: 31, sameBorrower: 33 };
  const funding = { lender: 500, buyer: 100, deadLender: 100, killerThird: 600, killerSame: 600 };
  const total = Object.values(pledges).reduce((sum, n) => sum + n, 0) + Object.values(funding).reduce((sum, n) => sum + n, 0);
  assert.equal(total, 2135);
  for (const [role, amount] of Object.entries({ ...pledges, ...funding })) await pool.query('UPDATE account_persistent SET omr=$2 WHERE account_id=$1', [actors[role], amount]);
  await pool.query('UPDATE amm_pool SET omr_reserve=omr_reserve-$1 WHERE id=1', [total]);
  await pool.query('UPDATE exchange_pool SET balance=1000000,lifetime_funded=1000000 WHERE id=1');
  await proof.artifact('prebaseline-fixture-allocation.json', await snapshotOmrLoans(readPool));
  for (const [role, amount] of Object.entries(funding)) await call(role, '/v1/window/redeem', `fixture-window-${role}`, { amount });
  const { withCharacter } = await import('../src/game.js'), { buyAmmo } = await import('../src/economy.js');
  for (const role of ['killerThird', 'killerSame']) for (let box = 0; box < 120; box++) {
    const acquired = await withCharacter(pool, actors[role], buyAmmo); assert.equal(acquired.rolled, 50); assert.equal(acquired.cost, 2000);
    await proof.record({ kind: 'prebaseline-canonical-ammo', role, box, gained: acquired.rolled, cost: acquired.cost, held: acquired.ammo });
  }
  assert.equal(LAW.WITPRO_MS, 48 * 3600000); assert.equal(LOAN.GRACE_MS, 24 * 3600000); assert.equal(CONSTANTS.SEARCH_MS, 3 * 3600000);
  for (const role of ['paperBorrower', 'graceA', 'graceB']) {
    const protectedActor = await call(role, '/v1/law/witpro', `fixture-protection-${role}`); assert.equal(protectedActor.body.witproSeconds, 48 * 3600);
    const row = (await pool.query('SELECT witpro_until FROM characters WHERE id=$1', [actors[role]])).rows[0]; assert.equal(+row.witpro_until, epoch + LAW.WITPRO_MS);
  }
  await proof.artifact('prebaseline-purchase-and-protection-receipts.json', { transactions: (await pool.query('SELECT * FROM transactions ORDER BY at,id')).rows,
    requests: calls, notifications: (await pool.query("SELECT * FROM notifications WHERE type='witpro'")).rows });
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const invariant = async label => { const value = await runLedgerInvariants(pool, { alert: false }); assert(value.ok, `${label}: ${JSON.stringify(value.checks.filter(row => !row.ok))}`);
    await proof.record({ kind: 'canonical-invariants', label, value }); invariants++; };
  await invariant('baseline'); await proof.artifact('initial-state.json', { state: await snapshotOmrLoans(readPool), fixtureWritesEndHere: true });
  await observe('original-worker-bootstrap', () => bootOriginalWorker(controller).then(() => ({ booted: true })), () => {}, true);
  await createLoan('paper', 'lender', 'paperBorrower', 31, 1);
  await createLoan('grace-a', 'lender', 'graceA', 33, 1); await createLoan('grace-b', 'lender', 'graceB', 35, 1);
  await createLoan('inherit', 'deadLender', 'inheritBorrower', 37); await createLoan('mod-death', 'lender', 'modBorrower', 35);
  await createLoan('third-death', 'lender', 'thirdBorrower', 31); await createLoan('same-death', 'killerSame', 'sameBorrower', 33);
  await observe('paper:list', () => call('lender', `/v1/loans/${loans.paper}/sell`, 'paper-list', { price: 10001 }));
  const bought = await observe('paper:buy-concurrent-duplicate', async () => {
    const rows = await Promise.all([1, 2].map(() => call('buyer', `/v1/loans/${loans.paper}/buy`, 'paper-buy', undefined, [200, 409])));
    assert(rows.some(row => row.status === 200)); return rows.find(row => row.status === 200);
  }, ({ journal }) => assert.equal(journal.statuses.filter(row => row.kind === 'paper-sale').length, 1));
  await replay('paper:exact-retry', bought);
  await observe('paper:old-creditor-refused', () => call('lender', `/v1/loans/${loans.paper}/collect`, 'paper-old-collect', undefined, [400]), unchanged);
  await observe('paper:new-creditor-before-due-refused', () => call('buyer', `/v1/loans/${loans.paper}/collect`, 'paper-early-collect', undefined, [400]), unchanged);
  await observe('lender:canonical-death-inherits-pledge', () => call(null, '/v1/mod/kill', null, { characterId: actors.deadLender, reason: 'declared native collateral inheritance proof' }));
  const repaid = await observe('heir:borrower-repays-current-claim', () => call('inheritBorrower', `/v1/loans/${loans.inherit}/repay`, 'inherited-repay'));
  await replay('heir:repay-exact-retry', repaid);
  await observe('borrower:nonlooting-death-whole-creditor', () => call(null, '/v1/mod/kill', null, { characterId: actors.modBorrower, reason: 'declared native collateral nonlooting proof' }));
  await observe('borrower:nonlooting-dead-target-retry', () => call(null, '/v1/mod/kill', null, { characterId: actors.modBorrower }, [400]), unchanged);
  for (const [hunter, victim] of [['killerThird', 'thirdBorrower'], ['killerSame', 'sameBorrower']])
    await observe(`fire:search-${hunter}`, () => call(hunter, `/v1/streets/${actors[victim]}/search`, `search-${hunter}`));
  await observe('worker:original-due-equality', () => controller.advanceTo(epoch + 3600000).then(() => ({ at })), ({ after }) => {
    for (const role of ['graceA', 'graceB']) assert.equal(after.characters.find(row => row.id === actors[role]).welsher, false);
  }, true);
  const collected = await observe('paper:manual-collect-at-exact-due', () => call('buyer', `/v1/loans/${loans.paper}/collect`, 'paper-collect'));
  await replay('paper:manual-collect-exact-retry', collected);
  await observe('workers:original-search-ready', () => controller.advanceTo(epoch + CONSTANTS.SEARCH_MS).then(() => ({ at })), () => {}, true);
  await fault('death', [loans['third-death']]);
  try { await observe('fire:late-abort-after-collateral-credit', () => call('killerThird', `/v1/streets/${actors.thirdBorrower}/fire`, 'fire-third', { rounds: 6000 }, [500]), unchanged); }
  finally { await removeFault(); }
  assert(faults.length > 0);
  const third = await observe('fire:third-party-odd-split', () => call('killerThird', `/v1/streets/${actors.thirdBorrower}/fire`, 'fire-third', { rounds: 6000 }),
    ({ value, journal }) => { assert(value.body.kill); assert.deepEqual(journal.lineage.map(row => row.omr).sort(), ['15.000000', '16.000000']); });
  await replay('fire:third-party-exact-retry', third);
  const same = await observe('fire:killer-creditor-odd-split', () => call('killerSame', `/v1/streets/${actors.sameBorrower}/fire`, 'fire-same', { rounds: 6000 }),
    ({ value, journal }) => { assert(value.body.kill); assert.deepEqual(journal.lineage.map(row => row.omr).sort(), ['16.000000', '17.000000']); assert.equal(new Set(journal.lineage.map(row => row.to)).size, 1); });
  await replay('fire:killer-creditor-exact-retry', same);
  await invariant('short-terminals');
  await observe('workers:grace-strict-equality', () => controller.advanceTo(epoch + 25 * 3600000).then(() => ({ at })), ({ after }) => {
    for (const id of [loans['grace-a'], loans['grace-b']]) assert.equal(after.loans.find(row => row.id === id).status, 'active');
  }, true);
  await fault('grace', [loans['grace-a'], loans['grace-b']]); const faultStart = faults.length;
  try { await observe('workers:grace-first-eligible-sweep-aborted', () => controller.advanceTo(epoch + 26 * 3600000).then(() => ({ at })), ({ before, after }) => {
    assert.deepEqual(omrBuckets(after), omrBuckets(before)); assert.deepEqual(after.loans, before.loans);
    assert.deepEqual(after.transactions.filter(row => row.currency === 'omr'), before.transactions.filter(row => row.currency === 'omr'));
    assert.equal(faults.length - faultStart, 2);
  }, true); } finally { await removeFault(); }
  await observe('workers:grace-next-original-sweep-two-forfeits', () => controller.advanceTo(epoch + 27 * 3600000).then(() => ({ at })), ({ journal }) => {
    assert.deepEqual(journal.lineage.map(row => row.omr).sort(), ['33.000000', '35.000000']);
  }, true);
  const { sweepLoans } = await import('../src/loans.js');
  await observe('workers:grace-terminal-sweep-replay', () => sweepLoans(pool), unchanged, true);
  await invariant('final');
  const corrupt = async (name, baseName, change) => { const input = structuredClone(saved.get(baseName)); assert(input); change(input);
    let error; try { reconcileOmrLoans(input.before, input.after, input); } catch (caught) { error = caught.message; }
    assert(error, `Corruption escaped ${name}`); const artifact = `negative-${name}.json`; await proof.artifact(artifact, input); controls.push({ name, artifact, outcome: 'REJECTED', error }); };
  await corrupt('missing-seize-receipt', 'paper:manual-collect-at-exact-due', input => { input.after.transactions = input.after.transactions.filter(row =>
    !(row.reason === 'loan:seize:omr' && row.counterparty === actors.paperBorrower && !input.before.transactions.some(prior => prior.id === row.id))); });
  await corrupt('duplicate-loot-receipt', 'fire:third-party-odd-split', input => { const row = structuredClone(input.after.transactions.find(row => row.reason === 'loan:pledge:loot')); row.id = 'corrupt-duplicate'; input.after.transactions.push(row); });
  await corrupt('wrong-loot-owner-balanced', 'fire:third-party-odd-split', input => { const row = input.after.transactions.find(row => row.reason === 'loan:pledge:loot'); row.account_id = actors.buyer;
    input.after.account_persistent.find(row => row.account_id === actors.killerThird).omr = '0'; input.after.account_persistent.find(row => row.account_id === actors.buyer).omr = '46'; });
  await corrupt('odd-remainder-rounded-down', 'fire:third-party-odd-split', input => { input.after.transactions.find(row => row.reason === 'loan:seize:omr' && row.counterparty === actors.thirdBorrower).amount = '15'; });
  await corrupt('missing-death-authority', 'fire:killer-creditor-odd-split', input => { input.after.kill_log = input.before.kill_log; });
  await corrupt('wrong-heir-owner', 'lender:canonical-death-inherits-pledge', input => { input.after.characters.find(row => row.account_id === actors.deadLender && row.alive).account_id = actors.buyer; });
  await corrupt('missing-inheritance-notice', 'lender:canonical-death-inherits-pledge', input => { input.after.notifications = input.after.notifications.filter(row => row.type !== 'loan_inherited'); });
  await corrupt('grace-equality-forfeit', 'workers:grace-next-original-sweep-two-forfeits', input => { input.logicalAt = epoch + 25 * 3600000; });
  await corrupt('paper-missing-owner-receipt', 'paper:buy-concurrent-duplicate', input => { input.after.idempotency.find(row => row.key === 'paper-buy').account_id = actors.lender; });
  await corrupt('paper-wrong-cash-owner', 'paper:buy-concurrent-duplicate', input => { input.after.transactions.find(row => row.reason === 'loan:paper' && row.character_id === actors.lender).character_id = actors.deadLender; });
  await corrupt('rewritten-historical-receipt', 'paper:exact-retry', input => { input.after.transactions.find(row => row.reason === 'loan:pledge').amount = '-30'; });
  await corrupt('rewritten-original-due', 'workers:grace-strict-equality', input => { input.after.loans.find(row => row.id === loans['grace-a']).due_at = new Date(epoch).toISOString(); });
  await corrupt('subatomic-drift', 'paper:exact-retry', input => { input.after.account_persistent.find(row => row.account_id === actors.buyer).omr = '0.000000000001'; });
  const schedule = controller.diagnostic(); assert.equal(schedule.failures.length, 0);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map(label => [label, schedule.events.filter(event => event.kind === 'timer.fire' && event.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: hours * 12, guardedTick: hours, guardedSeasonTick: hours, 'health-boundary': hours * 12 });
  await proof.artifact('final-state.json', await snapshotOmrLoans(readPool)); await proof.artifact('worker-schedule.json', schedule);
  await proof.artifact('random-tape.json', runtime.tape); await proof.artifact('expected-late-rollback.json', faults);
  result = { status: 'PASS_SCOPED', boundaries, movements, equations, invariants, cases, controls, timerCounts, logicalHours: hours,
    graceExpiries: 2, fullResourceCoverage: false, exclusions: OMR_LOAN_EXCLUSIONS };
} catch (error) {
  result = { status: 'FAIL', error: error.message, logicalAt: at, boundaries, movements, equations, invariants, cases, controls };
  await proof.record({ kind: 'failure', message: error.message, stack: error.stack }); await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-random-tape.json', runtime.tape); process.exitCode = 1;
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = nativeConsole[level];
  if (app) await app.close(); await controller.close(); await readPool.end(); await base.end(); seam.restore(); runtime.restore();
  for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify({ runId, output, source: source.revision, status: result.status, boundaries, movements, fullResourceCoverage: false }));
