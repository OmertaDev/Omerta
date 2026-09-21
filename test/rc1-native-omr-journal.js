import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { snapshotOmr, reconcileOmr, omrStateHash, omrUnits, OMR_UNSUPPORTED } from '../tools/rc1-omr-journal.js';

assert(process.argv.includes('--postgres'), 'Native PostgreSQL required');
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = await sourceIdentity(), seed = arg('seed') || 'rc1-omr-alpha';
const runId = `omr-journal-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(arg('output') || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
const database = planOwnedWorldDatabase({ controlUrl: process.env.RC1_RESOURCE_DATABASE_URL, runId, sourceRevision: source.revision });
for (const name of ['CHAIN_RPC_URL', 'CHAIN_SIGNER_PK', 'INVARIANT_WEBHOOK_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL', 'REDIS_URL']) assert(!process.env[name], `External integration excluded: ${name}`);
const epoch = Date.parse('2026-09-20T12:00:00Z'), hours = 6;
const configuration = { sourcePins: WORKER_SOURCE_PINS, epoch: new Date(epoch).toISOString(), logicalHours: hours,
  authority: 'Canonical HTTP injection and original local worker callbacks; completed boundary journal, not per-SQL-commit classification',
  fixture: 'Three ordinary characters with schema-default cash500/ammo25/respect0. Before baseline allocate5000/5000/10.011OMR from retired20000OMR AMM seed, leaving9989.989. Initial exchange cash till100000 and lifetime_funded100000 are declared fixtures.',
  clocks: 'Original six-hour unbond deadline with shared logical application/PostgreSQL clock and every local worker deadline; no persisted timer/status edits',
  controls: 'Corrupt copies of retained native before/after journal inputs, never the live world; SQL rollback trigger changes no gameplay row',
  exclusions: [...OMR_UNSUPPORTED, 'Natural acquisition, real HTTP transport/browser, literal6h wall time, deployment, provider/chain and full resource matrix'],
  methods: { pashov: 'c577eb7799c349de0acb187ba00ca98e14e436fd: concrete trace, assumptions and inversion',
    plamen: '795962b96e254f2e423a2635fe7f8cb8ea1e6d69: targeted token-entry/exit and exact-constant boundary pass',
    trailofbits: 'd3323cefbcf645678b8dc481de204b02ad3d02dc: source/caller/callee authority map and independent invariant controls',
    adaptation: 'Manual JavaScript/PostgreSQL review and native controls; no claim upstream orchestration, Solidity analyzer or chain audit ran' },
  databaseIsolation: database.descriptor, fullResourceCoverage: false };
const proof = await createProofRecorder({ directory: output, source, configuration, runId, seed, scenarioId: 'exact-core-omr-custody', population: 3 });
const runtime = installSerialRuntime(seed, configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: value => { at = value; }, expectedDormant: [{ label: 'RWA health', code: 'health_registry_unavailable' }] });
const namespace = `rc1_worker_omr_${process.pid}`, seam = installWorkerInstrumentation(controller, { namespace });
const env = { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', LIVING_WORLD_DIRECTOR: 'LIVE',
  POPULATION_OFF: 'on', LIQUIDITY_AUTOMATION_ENABLED: 'off', SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off', INVITE_MODE: 'off',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex') };
const previousEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])); Object.assign(process.env, env);
const base = new pg.Pool({ connectionString: database.url }), readPool = new pg.Pool({ connectionString: database.url, options: `-c search_path=${namespace}`, max: 1 });
const nativeConsole = { log: console.log, warn: console.warn, error: console.error };
const actors = ['omr-a', 'omr-b', 'omr-c'], tokens = new Map(), calls = [], cases = [], controls = [], saved = new Map(), faults = [];
let pool, app, result, boundaries = 0, equations = 0, movements = 0, invariants = 0, injected = false, firstFailure = false;
async function call(accountId, url, key, payload, statuses = [200], method = 'POST') {
  const response = await app.inject({ method, url, payload, headers: { authorization: `Bearer ${tokens.get(accountId)}`, ...(key ? { 'idempotency-key': key } : {}) } });
  const row = { accountId, method, url, key, payload: payload ?? null, status: response.statusCode, replayed: response.headers['x-idempotent-replay'] === 'true' };
  calls.push(row); const body = response.json(); await proof.record({ kind: 'canonical-http-receipt', ...row, body });
  assert(statuses.includes(response.statusCode), `${url}: ${response.statusCode} ${JSON.stringify(body)}`); return { ...row, body };
}
async function observe(name, work, verify = () => {}) {
  const before = await snapshotOmr(readPool), start = calls.length; let after, value, journal;
  try {
    value = await work(); after = await snapshotOmr(readPool); const commands = calls.slice(start);
    journal = reconcileOmr(before, after, { commands, logicalAt: at }); await verify({ before, after, value, journal });
    const input = { name, before, after, commands, logicalAt: at, result: value ?? null }, artifact = `omr-boundary-${String(++boundaries).padStart(4, '0')}.json`;
    await proof.artifact(artifact, input); await proof.record({ kind: 'omr-lineage', artifact, journal });
    equations += journal.equations.length; movements += journal.lineage.length; saved.set(name, input); cases.push({ name, outcome: 'PASS', movements: journal.lineage.length }); return value;
  } catch (error) { if (!firstFailure) { firstFailure = true; after ||= await snapshotOmr(readPool);
      await proof.artifact('first-omr-failure.json', { name, before, after, commands: calls.slice(start), logicalAt: at, result: value ?? null, journal: journal ?? null, error: error.message, stack: error.stack }); }
    throw error; }
}
const unchanged = ({ before, after }) => assert.equal(omrStateHash(after), omrStateHash(before), 'Replay/refusal/abort changed custody/receipts');
async function replay(name, account, url, key, payload, expected) { await observe(name, async () => { const value = await call(account, url, key, payload); assert(value.replayed); assert.deepEqual(value.body, expected.body); return value; }, unchanged); }
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => {
    if (injected && args.some(value => String(value?.code || value).includes('RCO01') || String(value).includes('RC1_OMR_ABORT'))) {
      faults.push({ code: 'RCO01', message: args.map(value => value instanceof Error ? `${value.code}: ${value.message}` : String(value)).join(' ') }); return;
    }
    controller.log(level, args);
  };
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query(`CREATE SCHEMA ${namespace}`);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap); pool = await makeWorkerDatabase(controller);
  const { buildServer } = await import('../src/server.js'); app = await buildServer();
  await proof.record({ kind: 'database-version', ...(await pool.query('SELECT version() AS version')).rows[0] });
  for (const actor of actors) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [actor]);
    await pool.query('INSERT INTO account_persistent(account_id,omr) VALUES($1,$2)', [actor, actor === actors[2] ? '10.011' : '5000']);
    await pool.query('INSERT INTO characters(id,account_id,name,season) VALUES($1,$1,$1,$2)', [actor, Math.floor(epoch / 2419200000)]);
    tokens.set(actor, app.jwt.sign({ sub: actor, tv: 0 }));
  }
  await pool.query('UPDATE amm_pool SET omr_reserve=omr_reserve-10010.011 WHERE id=1');
  await pool.query('UPDATE exchange_pool SET balance=100000,lifetime_funded=100000 WHERE id=1');
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const invariant = async label => { const value = await runLedgerInvariants(pool, { alert: false }); await proof.record({ kind: 'canonical-invariants', label, value }); assert(value.ok, label); invariants++; };
  await invariant('baseline'); await proof.artifact('initial-omr-state.json', { state: await snapshotOmr(readPool), fixtureWritesEndHere: true });
  await observe('original-worker-bootstrap', () => bootOriginalWorker(controller).then(() => ({ booted: true })));
  await pool.query(`CREATE FUNCTION rc1_window_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.account_id='omr-a' AND NEW.omr<OLD.omr THEN
      IF NOT EXISTS(SELECT 1 FROM transactions WHERE account_id=NEW.account_id AND reason='yield:window')
        OR NOT EXISTS(SELECT 1 FROM transactions WHERE account_id=NEW.account_id AND reason='window:burn')
        OR NOT EXISTS(SELECT 1 FROM transactions WHERE reason='desk:recycle' AND counterparty='window:burn')
        OR NOT EXISTS(SELECT 1 FROM transactions WHERE character_id='omr-a' AND reason='window:payout')
        OR NOT EXISTS(SELECT 1 FROM exchange_pool WHERE id=1 AND lifetime_paid>0)
        THEN RAISE EXCEPTION 'RC1_WRONG_WINDOW_FAILPOINT' USING ERRCODE='RCO02'; END IF;
      RAISE EXCEPTION 'RC1_OMR_ABORT_WINDOW_AFTER_SPLIT_AND_CASH' USING ERRCODE='RCO01'; END IF; RETURN NEW; END $$`);
  await pool.query('CREATE TRIGGER rc1_window_abort BEFORE UPDATE ON account_persistent FOR EACH ROW EXECUTE FUNCTION rc1_window_abort()'); injected = true;
  try { await observe('window:abort-after-split-recycle-and-cash', () => call(actors[0], '/v1/window/redeem', 'window-a', { amount: 6.000011 }, [500]), unchanged); }
  finally { injected = false; await pool.query('DROP TRIGGER rc1_window_abort ON account_persistent'); await pool.query('DROP FUNCTION rc1_window_abort()'); }
  assert(faults.some(row => row.message.includes('WINDOW_AFTER_SPLIT_AND_CASH')), 'Exact late window failure observed');
  const redeem = await observe('window:fractional-round-up', () => call(actors[0], '/v1/window/redeem', 'window-a', { amount: 6.000011 }));
  await replay('window:exact-retry', actors[0], '/v1/window/redeem', 'window-a', { amount: 6.000011 }, redeem);
  await observe('window:changed-body-refused', () => call(actors[0], '/v1/window/redeem', 'window-a', { amount: 7 }, [422]), unchanged);
  await observe('window:fractional-round-down', () => call(actors[1], '/v1/window/redeem', 'window-b', { amount: 6.000009 }));
  await observe('window:half-micro-cut-concurrent-duplicate', async () => {
    const values = await Promise.all([1, 2].map(() => call(actors[0], '/v1/window/redeem', 'window-race', { amount: 6.000010 }, [200, 409])));
    assert(values.some(row => row.status === 200)); return values.map(row => ({ status: row.status, replayed: row.replayed }));
  }, ({ journal }) => assert.equal(journal.lineage.length, 2));
  await observe('window:below-minimum-refused', () => call(actors[2], '/v1/window/redeem', 'window-too-small', { amount: 5.999999 }, [400]), unchanged);
  await observe('window:subatomic-refused', () => call(actors[2], '/v1/window/redeem', 'window-subatomic', { amount: 6.0000001 }, [400]), unchanged);
  await observe('window:full-balance', () => call(actors[2], '/v1/window/redeem', 'window-full', { amount: 10.011 }),
    ({ after }) => assert.equal(omrUnits(after.account_persistent.find(row => row.account_id === actors[2]).omr), 0n));
  await pool.query(`CREATE FUNCTION rc1_omr_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.account_id='omr-a' AND NEW.omr<OLD.omr THEN
      IF NOT EXISTS(SELECT 1 FROM transactions WHERE account_id=NEW.account_id AND currency='omr' AND reason='vanity:name')
        OR NOT EXISTS(SELECT 1 FROM transactions WHERE currency='omr' AND reason='desk:recycle' AND counterparty='vanity:name')
        THEN RAISE EXCEPTION 'RC1_WRONG_FAILPOINT' USING ERRCODE='RCO02'; END IF;
      RAISE EXCEPTION 'RC1_OMR_ABORT_AFTER_RECYCLE' USING ERRCODE='RCO01'; END IF; RETURN NEW; END $$`);
  await pool.query('CREATE TRIGGER rc1_omr_abort BEFORE UPDATE ON account_persistent FOR EACH ROW EXECUTE FUNCTION rc1_omr_abort()'); injected = true;
  try { await observe('sink:abort-after-ledger-and-recycle', () => call(actors[0], '/v1/vanity/name', 'name-a', { name: 'Omr Proof Alpha' }, [500]), unchanged); }
  finally { injected = false; await pool.query('DROP TRIGGER rc1_omr_abort ON account_persistent'); await pool.query('DROP FUNCTION rc1_omr_abort()'); }
  assert(faults.length > 0, 'Exact after-recycle SQL failure must be observed'); await proof.artifact('expected-rollback-faults.json', faults);
  const rename = await observe('sink:retry-after-rollback', () => call(actors[0], '/v1/vanity/name', 'name-a', { name: 'Omr Proof Alpha' }));
  await replay('sink:lost-response-exact-retry', actors[0], '/v1/vanity/name', 'name-a', { name: 'Omr Proof Alpha' }, rename);
  await observe('sink:concurrent-same-key', async () => {
    const values = await Promise.all([1, 2].map(() => call(actors[1], '/v1/vanity/name', 'name-race', { name: 'Omr Proof Beta' }, [200, 409])));
    assert(values.some(row => row.status === 200)); return values.map(row => ({ status: row.status, replayed: row.replayed }));
  }, ({ journal }) => assert.equal(journal.lineage.length, 1));
  const stake = await observe('stake:fractional-floor', () => call(actors[0], '/v1/stake', 'stake-a', { amount: 10.1234569 }));
  await replay('stake:exact-retry', actors[0], '/v1/stake', 'stake-a', { amount: 10.1234569 }, stake);
  await observe('stake:negative-refused', () => call(actors[0], '/v1/stake', 'stake-negative', { amount: -0.000001 }, [400]), unchanged);
  await observe('stake:second-owner', () => call(actors[1], '/v1/stake', 'stake-b', { amount: 8.654321 }));
  for (const [i, actor] of actors.slice(0, 2).entries()) {
    const value = await observe(`unstake:owner-${i}`, () => call(actor, '/v1/unstake', `unstake-${i}`));
    await replay(`unstake:owner-${i}:exact-retry`, actor, '/v1/unstake', `unstake-${i}`, undefined, value);
  }
  await observe('window:canonically-fund-loan-lender', () => call(actors[1], '/v1/window/redeem', 'window-loan-funding', { amount: '6.000000' }));
  const offered = await observe('loan:offer-collateral-demand-only', () => call(actors[1], '/v1/loans', 'offer', { amount: 5000, rate: 0.1, hours: 24, collateralOmr: 31.9, to: actors[0] }));
  const loan = offered.body.id; assert(loan);
  await observe('loan:wrong-borrower-denied', () => call(actors[2], `/v1/loans/${loan}/take`, 'wrong-borrower', {}, [400]), unchanged);
  const pledge = await observe('loan:pledge', () => call(actors[0], `/v1/loans/${loan}/take`, 'take', {}));
  await replay('loan:pledge-exact-retry', actors[0], `/v1/loans/${loan}/take`, 'take', {}, pledge);
  const repaid = await observe('loan:repay-return', () => call(actors[0], `/v1/loans/${loan}/repay`, 'repay', {}));
  await replay('loan:repay-exact-retry', actors[0], `/v1/loans/${loan}/repay`, 'repay', {}, repaid);
  await invariant('before-original-six-hour-expiry');
  await observe('original-workers:before-unbond-deadline', async () => { await controller.advanceTo(epoch + 21600000 - 1); return { logicalAt: at }; });
  for (const [i, actor] of actors.slice(0, 2).entries()) await observe(`unbond:owner-${i}:one-ms-early`, () => call(actor, '/v1/me', null, undefined, [200], 'GET'),
    ({ after }) => assert(omrUnits(after.account_persistent.find(row => row.account_id === actor).unbonding) > 0n));
  await observe('original-workers:at-six-hours', async () => { await controller.advanceTo(epoch + 21600000); return { logicalAt: at }; });
  assert.equal(new Date((await pool.query('SELECT clock_timestamp() AS now')).rows[0].now).getTime(), at);
  for (const [i, actor] of actors.slice(0, 2).entries()) {
    await observe(`unbond:owner-${i}:original-expiry-release`, () => call(actor, '/v1/me', null, undefined, [200], 'GET'),
      ({ after, journal }) => { assert.equal(omrUnits(after.account_persistent.find(row => row.account_id === actor).unbonding), 0n); assert.equal(journal.lineage.length, 1); });
    await observe(`unbond:owner-${i}:repeat-read`, () => call(actor, '/v1/me', null, undefined, [200], 'GET'), unchanged);
  }
  await invariant('final');
  const corrupt = async (name, baselineName, mutate) => { const input = structuredClone(saved.get(baselineName)); assert(input); mutate(input);
    let message; try { reconcileOmr(input.before, input.after, { commands: input.commands, logicalAt: input.logicalAt }); } catch (error) { message = error.message; }
    assert(message, `Corruption escaped: ${name}`); const artifact = `negative-${name}.json`; await proof.artifact(artifact, input); controls.push({ name, artifact, outcome: 'REJECTED', message }); };
  await corrupt('missing-stake-receipt', 'stake:fractional-floor', input => { input.after.idempotency = input.before.idempotency; });
  await corrupt('wrong-receipt-owner', 'stake:fractional-floor', input => { input.after.idempotency.find(row => row.key === 'stake-a').account_id = actors[2]; });
  await corrupt('wrong-request-hash', 'stake:fractional-floor', input => { input.after.idempotency.find(row => row.key === 'stake-a').body_hash = '0'.repeat(64); });
  await corrupt('wrong-fraction-rounding', 'stake:fractional-floor', input => { const row = input.after.idempotency.find(row => row.key === 'stake-a'), body = JSON.parse(row.response); body.staked = 10.123457; row.response = JSON.stringify(body); });
  await corrupt('wrong-window-cut-rounding', 'window:fractional-round-up', input => { const row = input.after.idempotency.find(row => row.key === 'window-a'), body = JSON.parse(row.response); body.familyCut = 0.3; row.response = JSON.stringify(body); });
  await corrupt('missing-recycle', 'sink:retry-after-rollback', input => { input.after.transactions = input.after.transactions.filter(row => !(row.reason === 'desk:recycle' && !input.before.transactions.some(old => old.id === row.id))); });
  await corrupt('duplicate-recycle', 'sink:retry-after-rollback', input => { const row = input.after.transactions.find(row => row.reason === 'desk:recycle' && !input.before.transactions.some(old => old.id === row.id)); input.after.transactions.push({ ...row, id: 'duplicate-recycle' }); });
  await corrupt('wrong-loan-owner', 'loan:pledge', input => { input.after.transactions.find(row => row.reason === 'loan:pledge').account_id = actors[2]; });
  await corrupt('subatomic-account', 'stake:fractional-floor', input => { input.after.account_persistent[0].omr = '4999.0000001'; });
  await corrupt('early-unbond-release', 'unbond:owner-0:original-expiry-release', input => { input.logicalAt--; });
  await corrupt('rewritten-history', 'stake:exact-retry', input => { input.after.transactions[0].amount = '1'; });
  const schedule = controller.diagnostic(); assert.equal(schedule.failures.length, 0);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map(label => [label, schedule.events.filter(row => row.kind === 'timer.fire' && row.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: 72, guardedTick: 6, guardedSeasonTick: 6, 'health-boundary': 72 });
  await proof.artifact('final-omr-state.json', await snapshotOmr(readPool)); await proof.artifact('worker-schedule.json', schedule); await proof.artifact('random-tape.json', runtime.tape);
  result = { status: 'PASS_SCOPED', boundaries, equations, movements, invariants, cases, controls, timerCounts, fullResourceCoverage: false, unsupported: OMR_UNSUPPORTED };
} catch (error) { result = { status: 'FAIL', error: error.message, boundaries, equations, movements, invariants, cases, controls };
  await proof.record({ kind: 'failure', message: error.message, stack: error.stack }); await proof.artifact('failure-worker-schedule.json', controller.diagnostic()); process.exitCode = 1;
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = nativeConsole[level];
  if (app) await app.close(); await controller.close(); await readPool.end(); await base.end(); seam.restore(); runtime.restore();
  for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await proof.record({ kind: 'database-retained', descriptor: database.descriptor }); const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify({ runId, output, source: source.revision, status: result.status, boundaries, movements, fullResourceCoverage: false }));
