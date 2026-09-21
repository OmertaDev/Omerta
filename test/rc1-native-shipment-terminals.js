import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { setTimeout as pause } from 'node:timers/promises';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
assert(process.argv.includes('--postgres'), 'Native PostgreSQL required');
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = await sourceIdentity(), seed = arg('seed') || 'rc1-shipment-terminal-alpha';
const runId = `shipment-terminal-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(arg('output') || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
const database = planOwnedWorldDatabase({ controlUrl: process.env.RC1_RESOURCE_DATABASE_URL, runId, sourceRevision: source.revision });
for (const name of ['SEARCH_MS', 'SHOOT_CD_MS', 'GEAR_LOOT_CHANCE', 'CHAIN_RPC_URL', 'CHAIN_SIGNER_PK', 'INVARIANT_WEBHOOK_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL', 'REDIS_URL']) assert(!process.env[name], `Override/external integration excluded: ${name}`);
const epoch = Date.parse('2026-09-20T23:59:59.999Z'), population = 18;
const configuration = { sourcePins: WORKER_SOURCE_PINS, epoch: new Date(epoch).toISOString(), population, seed,
  authority: 'Canonical HTTP injection, actual PostgreSQL row-lock contention and original local workers; no forced outcomes',
  fixture: '18 ordinary accounts with defaultcash500/ammo25, physical stats50; respect10000 except below-loot-floor victim respect0. Two hunters have equipped lastresort. Initial material3/1 for two victims,0 elsewhere. Before baseline reallocate2000OMR from retired AMM seed and declare1000000cash till; canonical window500/1000/500 and120 standard ammo boxes per hunter fund the scenario. All fixtures end before baseline; no search/day/status/deadline rewrites.',
  clocks: 'Original midnight via1ms shared clock advance while old-day SQL claims remain blocked; original3h search with all local worker callbacks',
  contention: 'Read-only SELECT FOR UPDATE barrier on actual old-day row; retain PostgreSQL blocking evidence before advancing time. No global commit observer, whose serial-only guard excludes concurrency.',
  exclusions: ['Natural entry/material/combat acquisition', 'Network/browser/deployment', 'Apex rout source', 'Other resources and full simulation matrix'],
  databaseIsolation: database.descriptor, fullResourceCoverage: false };
const proof = await createProofRecorder({ directory: output, source, configuration, runId, seed, scenarioId: 'shipment-midnight-and-fire-terminals', population });
const runtime = installSerialRuntime(seed, configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: value => { at = value; }, expectedDormant: [{ label: 'RWA health', code: 'health_registry_unavailable' }] });
const namespace = `rc1_worker_shipment_${process.pid}`, seam = installWorkerInstrumentation(controller, { namespace });
const env = { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', LIVING_WORLD_DIRECTOR: 'LIVE',
  POPULATION_OFF: 'on', LIQUIDITY_AUTOMATION_ENABLED: 'off', SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off', INVITE_MODE: 'off',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex') };
const previousEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])); Object.assign(process.env, env);
const { snapshotShipment, reconcileShipment, shipmentCustodyHash } = await import('../tools/rc1-shipment-journal.js');
const { SHIPMENT, dayOf, shipmentDistrictOf, shipmentCityCap, CONSTANTS } = await import('../src/rules.js');
const base = new pg.Pool({ connectionString: database.url }), readPool = new pg.Pool({ connectionString: database.url, options: `-c search_path=${namespace}`, max: 4 });
const nativeConsole = { log: console.log, warn: console.warn, error: console.error }, actors = Array.from({ length: population }, (_, i) => `ship-${i}`);
const tokens = new Map(), calls = [], cases = [], controls = [], saved = new Map(), faults = [];
let pool, app, result, boundaries = 0, movements = 0, equations = 0, invariants = 0, injected = false, firstFailure = false;
async function call(accountId, url, key, payload, statuses = [200], method = 'POST') {
  const startedAt = at;
  const response = await app.inject({ method, url, payload, headers: { authorization: `Bearer ${tokens.get(accountId)}`, ...(key ? { 'idempotency-key': key } : {}) } });
  const row = { accountId, method, url, key, payload: payload ?? null, startedAt, completedAt: at, status: response.statusCode,
    replayed: response.headers['x-idempotent-replay'] === 'true', body: response.json() };
  calls.push(row); await proof.record({ kind: 'canonical-http-receipt', ...row });
  assert(statuses.includes(row.status), `${url}: ${row.status} ${JSON.stringify(row.body)}`); return row;
}
async function observe(name, work, verify = () => {}) {
  const before = await snapshotShipment(readPool), start = calls.length; let value, after, journal;
  try { value = await work(); after = await snapshotShipment(readPool); const commands = calls.slice(start);
    journal = reconcileShipment(before, after, { commands, label: name }); await verify({ before, after, value, journal });
    const input = { name, before, after, commands, logicalAt: at, result: value ?? null }, artifact = `shipment-boundary-${String(++boundaries).padStart(4, '0')}.json`;
    await proof.artifact(artifact, input); await proof.record({ kind: 'shipment-lineage', artifact, journal }); saved.set(name, input);
    equations += journal.equations.length; movements += journal.lineage.length; cases.push({ name, outcome: 'PASS', movements: journal.lineage.length }); return value;
  } catch (error) { if (!firstFailure) { firstFailure = true; after ||= await snapshotShipment(readPool);
      await proof.artifact('first-shipment-failure.json', { name, before, after, commands: calls.slice(start), logicalAt: at, result: value ?? null,
        journal: journal ?? null, error: error.message, stack: error.stack }); } throw error; }
}
const unchanged = ({ before, after }) => assert.equal(shipmentCustodyHash(after), shipmentCustodyHash(before), 'Replay/refusal/abort changed custody');
async function replay(name, original) { await observe(name, async () => { const response = await call(original.accountId, original.url, original.key, original.payload, [200], original.method);
  assert(response.replayed); assert.deepEqual(response.body, original.body); return response; }, unchanged); }
async function waitForBlocked(barrierPid, count) {
  const until = performance.now() + 15000; let rows = [];
  while (performance.now() < until) {
    rows = (await readPool.query("SELECT pid,wait_event_type,wait_event,query,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows;
    const reachesBarrier = (pid, seen = new Set()) => pid === barrierPid || (!seen.has(pid) && (seen.add(pid),
      (rows.find(row => row.pid === pid)?.blockers || []).some(parent => reachesBarrier(parent, seen))));
    const claims = rows.filter(row => row.query.startsWith('UPDATE shipment_days SET taken') && reachesBarrier(row.pid));
    if (claims.length === count) return claims;
    await pause(20);
  }
  throw new Error(`Expected ${count} original-day native claim waiters; observed ${JSON.stringify(rows)}`);
}
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => {
    if (injected && args.some(value => String(value?.code || value).includes('RCS01') || String(value).includes('RC1_SHIPMENT_ABORT'))) {
      faults.push({ code: 'RCS01', message: args.map(value => value instanceof Error ? `${value.code}: ${value.message}` : String(value)).join(' ') }); return; }
    controller.log(level, args);
  };
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query(`CREATE SCHEMA ${namespace}`);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap); pool = await makeWorkerDatabase(controller);
  const { buildServer } = await import('../src/server.js'); app = await buildServer();
  const oldDay = dayOf(), oldDistrict = shipmentDistrictOf(oldDay), nextDistrict = shipmentDistrictOf(oldDay + 1);
  for (const [i, actor] of actors.entries()) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [actor]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [actor]);
    await pool.query(`INSERT INTO characters(id,account_id,name,season,loc,cash,respect,muscle,cunning,speed,shipment,ammo,gun)
      VALUES($1,$1,$1,$2,$3,500,$4,50,50,50,$5,25,$6)`, [actor, Math.floor(oldDay / 28), i === 13 ? nextDistrict : oldDistrict,
      i === 1 ? 0 : 10000, i === 0 ? 3 : i === 1 ? 1 : 0, [14, 15].includes(i) ? 'lastresort' : null]);
    tokens.set(actor, app.jwt.sign({ sub: actor, tv: 0 }));
  }
  for (const [i, amount] of [[0, 500], [14, 1000], [15, 500]]) await pool.query('UPDATE account_persistent SET omr=$2 WHERE account_id=$1', [actors[i], amount]);
  await pool.query('UPDATE amm_pool SET omr_reserve=omr_reserve-2000 WHERE id=1');
  await pool.query('UPDATE exchange_pool SET balance=1000000,lifetime_funded=1000000 WHERE id=1');
  await proof.artifact('prebaseline-fixture-allocation.json', { actors: await snapshotShipment(readPool),
    amm: (await pool.query('SELECT * FROM amm_pool')).rows, exchange: (await pool.query('SELECT * FROM exchange_pool')).rows });
  for (const [i, amount] of [[0, 500], [14, 1000], [15, 500]]) await call(actors[i], '/v1/window/redeem', `fixture-window-${i}`, { amount });
  const { withCharacter } = await import('../src/game.js'), { buyAmmo } = await import('../src/economy.js');
  for (const i of [14, 15]) for (let box = 0; box < 120; box++) {
    const acquired = await withCharacter(pool, actors[i], buyAmmo); assert.equal(acquired.rolled, 50); assert.equal(acquired.cost, 2000);
    await proof.record({ kind: 'prebaseline-canonical-ammo-purchase', accountId: actors[i], box, cost: acquired.cost, gained: acquired.rolled, held: acquired.ammo });
  }
  await proof.artifact('prebaseline-canonical-purchase-receipts.json', (await pool.query("SELECT * FROM transactions WHERE reason IN ('ammo:buy','window:burn','yield:window','desk:recycle','window:payout') ORDER BY at,id")).rows);
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const invariant = async label => { const value = await runLedgerInvariants(pool, { alert: false });
    assert(value.ok, `${label}: ${JSON.stringify(value.checks.filter(check => !check.ok))}`);
    await proof.record({ kind: 'canonical-invariants', label, value }); invariants++; };
  await invariant('baseline'); await proof.artifact('initial-state.json', { state: await snapshotShipment(readPool), fixtureWritesEndHere: true });
  await observe('original-worker-bootstrap', () => bootOriginalWorker(controller).then(() => ({ booted: true })));
  const victimTake = await observe('old-day:take-victim', () => call(actors[0], '/v1/shipment/take', 'old-take-0'));
  for (let i = 1; i <= 10; i++) await observe(`old-day:fill-${i}`, () => call(actors[i], '/v1/shipment/take', `old-take-${i}`));
  assert.equal(shipmentCityCap(population), 48); assert.equal((await pool.query('SELECT taken FROM shipment_days WHERE day=$1', [oldDay])).rows[0].taken, 44);
  const victimPiece = await observe('victim:commission-before-death', () => call(actors[0], '/v1/shipment/commission/case', 'victim-piece'));
  const searches = [];
  for (const [killer, victim] of [[14, 0], [15, 1]]) searches.push(await observe(`search:original-${killer}`, () => call(actors[killer], `/v1/streets/${actors[victim]}/search`, `search-${killer}`)));
  assert(searches.every(row => Date.parse(row.body.placedAt) === epoch + CONSTANTS.SEARCH_MS));
  let oldResults;
  await observe('midnight:overlapping-original-day-claims', async () => {
    const barrier = await readPool.connect(); let pending = [];
    try {
      await barrier.query('BEGIN'); const pid = (await barrier.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await barrier.query('SELECT day FROM shipment_days WHERE day=$1 FOR UPDATE', [oldDay]);
      pending = [11, 12].map(i => call(actors[i], '/v1/shipment/take', `old-race-${i}`, undefined, [200, 400]));
      const blocked = await waitForBlocked(pid, 2); await proof.artifact('midnight-native-blockers.json', { oldDay, barrierPid: pid, blocked, logicalAt: at });
      await controller.advanceTo(epoch + 1); assert.equal(dayOf(), oldDay + 1);
      const next = await call(actors[13], '/v1/shipment/take', 'new-day-first'); assert.equal(next.body.took, SHIPMENT.PER_PLAYER);
      assert.equal((await waitForBlocked(pid, 2)).length, 2, 'Old claims still blocked after new-day commit');
      await proof.record({ kind: 'new-day-committed-before-old-claims-release', logicalAt: at, oldDay, newDay: dayOf() });
      await barrier.query('COMMIT'); oldResults = await Promise.all(pending);
      assert.equal(oldResults.filter(row => row.status === 200).length, 1); assert.equal(oldResults.find(row => row.status === 400).body.error, 'gone');
      return { oldResults, next };
    } finally { await barrier.query('ROLLBACK'); barrier.release(); await Promise.allSettled(pending); }
  }, ({ after }) => { assert.equal(after.shipment_days.find(row => row.day === oldDay).taken, 48); assert.equal(after.shipment_days.find(row => row.day === oldDay + 1).taken, 4); });
  await replay('midnight:old-success-retry-after-new-day', oldResults.find(row => row.status === 200));
  await observe('midnight:new-day-player-cap', () => call(actors[13], '/v1/shipment/take', 'new-day-again', undefined, [400]), unchanged);
  await observe('workers:original-search-one-ms-early', async () => { await controller.advanceTo(epoch + CONSTANTS.SEARCH_MS - 1); return { at }; });
  await observe('fire:one-ms-early-refused', () => call(actors[14], `/v1/streets/${actors[0]}/fire`, 'fire-early', { rounds: 6000 }, [400]), unchanged);
  await observe('workers:original-search-ready', async () => { await controller.advanceTo(epoch + CONSTANTS.SEARCH_MS); return { at }; });
  const killed = await observe('fire:odd-material-loot-and-replacement', () => call(actors[14], `/v1/streets/${actors[0]}/fire`, 'fire-eligible', { rounds: 6000 }),
    ({ value, journal }) => { assert(value.body.kill); assert.equal(value.body.matLoot, 2); assert.equal(journal.lineage[0].destroyed, 3); });
  await replay('fire:exact-retry-no-second-estate', killed);
  await observe('fire:below-loot-floor-death', () => call(actors[15], `/v1/streets/${actors[1]}/fire`, 'fire-ineligible', { rounds: 6000 }),
    ({ value, journal }) => { assert(value.body.kill); assert.equal(value.body.matLoot, 0); assert.equal(journal.lineage[0].destroyed, 5); });
  await replay('heir:historical-take-does-not-create-material', victimTake);
  await replay('heir:historical-bespoke-does-not-charge-again', victimPiece);
  await observe('heir:fresh-commission-without-material-refused', () => call(actors[0], '/v1/shipment/commission/case', 'heir-piece', undefined, [400]), unchanged);
  await pool.query(`CREATE FUNCTION rc1_shipment_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.account_id='ship-14' THEN
      IF NOT EXISTS(SELECT 1 FROM transactions WHERE character_id='ship-14' AND reason='shipment:commission')
        OR NOT EXISTS(SELECT 1 FROM bespoke_serials WHERE commission_id=NEW.commission_id AND minted=NEW.serial)
        THEN RAISE EXCEPTION 'RC1_WRONG_SHIPMENT_FAILPOINT' USING ERRCODE='RCS02'; END IF;
      RAISE EXCEPTION 'RC1_SHIPMENT_ABORT_AFTER_SERIAL' USING ERRCODE='RCS01'; END IF; RETURN NEW; END $$`);
  await pool.query('CREATE TRIGGER rc1_shipment_abort BEFORE INSERT ON bespoke_pieces FOR EACH ROW EXECUTE FUNCTION rc1_shipment_abort()'); injected = true;
  try { await observe('loot-commission:abort-after-cash-and-serial', () => call(actors[14], '/v1/shipment/commission/case', 'loot-piece', undefined, [500]), unchanged); }
  finally { injected = false; await pool.query('DROP TRIGGER rc1_shipment_abort ON bespoke_pieces'); await pool.query('DROP FUNCTION rc1_shipment_abort()'); }
  assert(faults.length); await proof.artifact('expected-output-rollback.json', faults);
  let commission;
  await observe('loot-commission:same-key-concurrent-duplicate', async () => {
    const responses = await Promise.all([1, 2].map(() => call(actors[14], '/v1/shipment/commission/case', 'loot-piece', undefined, [200, 409])));
    commission = responses.find(row => row.status === 200); assert(commission); return responses;
  }, ({ journal }) => assert.equal(journal.lineage.length, 1));
  await replay('loot-commission:durable-exact-retry', commission);
  await invariant('final');
  const corrupt = async (name, baseline, change) => { const input = structuredClone(saved.get(baseline)); assert(input); change(input);
    let error; try { reconcileShipment(input.before, input.after, { commands: input.commands, label: input.name }); } catch (caught) { error = caught.message; }
    assert(error, `Corruption escaped: ${name}`); const artifact = `negative-${name}.json`; await proof.artifact(artifact, input); controls.push({ name, artifact, outcome: 'REJECTED', error }); };
  await corrupt('wrong-loot-owner', 'fire:odd-material-loot-and-replacement', input => { input.after.characters.find(row => row.id === actors[14]).shipment--; input.after.characters.find(row => row.id === actors[16]).shipment++; });
  await corrupt('heir-retains-material', 'fire:odd-material-loot-and-replacement', input => { input.after.characters.find(row => row.account_id === actors[0] && row.alive).shipment = 1; });
  await corrupt('missing-kill-receipt', 'fire:odd-material-loot-and-replacement', input => { input.after.kill_log = input.before.kill_log; });
  await corrupt('rewritten-old-day', 'midnight:overlapping-original-day-claims', input => { input.after.shipment_days[0].cap++; });
  await corrupt('missing-take-authority', 'midnight:overlapping-original-day-claims', input => { input.after.shipment_takes = input.before.shipment_takes; });
  await corrupt('orphan-serial', 'loot-commission:same-key-concurrent-duplicate', input => { input.after.bespoke_serials[0].minted++; });
  await corrupt('wrong-piece-owner', 'loot-commission:same-key-concurrent-duplicate', input => { input.after.bespoke_pieces.find(row => row.account_id === actors[14]).account_id = actors[16]; });
  await corrupt('missing-cash-debit', 'loot-commission:same-key-concurrent-duplicate', input => { input.after.transactions = input.after.transactions.filter(row => !(row.reason === 'shipment:commission' && row.character_id === actors[14])); });
  await corrupt('wrong-request-owner', 'loot-commission:same-key-concurrent-duplicate', input => { input.after.idempotency.find(row => row.key === 'loot-piece').account_id = actors[16]; });
  const schedule = controller.diagnostic(); assert.equal(schedule.failures.length, 0);
  await proof.artifact('final-state.json', await snapshotShipment(readPool)); await proof.artifact('worker-schedule.json', schedule); await proof.artifact('random-tape.json', runtime.tape);
  result = { status: 'PASS_SCOPED', boundaries, movements, equations, invariants, cases, controls, midnightBoundaries: 1,
    originalSearchMilliseconds: CONSTANTS.SEARCH_MS, terminalDeaths: 2, fullResourceCoverage: false, exclusions: configuration.exclusions };
} catch (error) { result = { status: 'FAIL', error: error.message, boundaries, movements, equations, invariants, cases, controls };
  await proof.record({ kind: 'failure', message: error.message, stack: error.stack }); await proof.artifact('failure-worker-schedule.json', controller.diagnostic()); process.exitCode = 1;
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = nativeConsole[level];
  if (app) await app.close(); await controller.close(); await readPool.end(); await base.end(); seam.restore(); runtime.restore();
  for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify({ runId, output, source: source.revision, status: result.status, boundaries, movements, fullResourceCoverage: false }));
