// Original rule durations driven by the shared logical application/SQL clocks.
// This fixture-assisted proof is not wall-clock equivalence or a matrix cell.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { snapshotLoanResources, reconcileLoanLifecycle, loanStateHash } from '../tools/rc1-loan-lifecycle-journal.js';
import { exactSum } from '../tools/rc1-resource-journal.js';

assert(process.argv.includes('--postgres'), 'Real PostgreSQL required');
const argument = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = await sourceIdentity(), seed = argument('seed') || 'rc1-loan-alpha';
const runId = `loan-lifecycles-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(argument('output') || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
const controlUrl = process.env.RC1_RESOURCE_DATABASE_URL; assert(controlUrl, 'Explicit disposable local PostgreSQL endpoint required');
for (const key of ['CHAIN_RPC_URL', 'INVARIANT_WEBHOOK_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL', 'WANTED_HUNT_P'])
  assert(!process.env[key], `External integrations/outcome overrides excluded: ${key}`);
const database = planOwnedWorldDatabase({ controlUrl, runId, sourceRevision: source.revision });
const env = { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on',
  COORDINATION_ACCOUNT_IDS: '', LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '',
  POPULATION_OFF: 'on', LIQUIDITY_AUTOMATION_ENABLED: 'off' };
const priorEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])); Object.assign(process.env, env);
const epoch = Date.parse('2026-09-20T12:00:00.000Z'), hours = 77;
const configuration = { hours, epoch: new Date(epoch).toISOString(), sourcePins: WORKER_SOURCE_PINS,
  clocks: 'Shared serial application and PostgreSQL clocks; every due original local callback runs, without deadline/status rewrites',
  actorAuthority: 'Canonical withCharacter/withTwoCharacters loan functions; HTTP/authentication/idempotency middleware excluded',
  fixtures: ['Four boss-band NPC actors created by canonical spawnResident, using its existing marks fixture seam for cars only',
    'Initial hospital protection through hour80 for all four fixture actors; natural survival is not proved',
    'Initial street_tax cash pool100000; funding origin is an explicit fixture, not earned income',
    'Population deploy switch disabled for this focused fixture run; NPC player progression is not claimed'],
  excluded: ['Natural entry and defense acquisition', 'Unshielded Wanted combat outcomes', 'OMR collateral in this case group',
    'Every other resource transition and all simulation matrix cells', 'Concurrent scheduling and deterministic replay',
    'Literal48h/72h wall-time or real deployment equivalence', 'Independent installed-dependency attestation'],
  journalScope: 'Every declared actor action and complete original loan sweep, bounty sweep, Wanted hunt and buyback job; job-level committed aggregates, not per-commit ordering',
  databaseIsolation: database.descriptor, deploymentAttested: false, populationEnabled: false };
const proof = await createProofRecorder({ directory: output, source, configuration, runId, seed,
  scenarioId: 'original-loan-and-wanted-lifecycles', population: 4 });
const runtime = installSerialRuntime(seed, configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: value => { at = value; },
  expectedDormant: [{ label: 'RWA health', code: 'health_registry_unavailable' }] });
const namespace = `rc1_worker_loans_${process.pid}`;
const seam = installWorkerInstrumentation(controller, { namespace });
const base = new pg.Pool({ connectionString: database.url });
const readPool = new pg.Pool({ connectionString: database.url, options: `-c search_path=${namespace}`, max: 1 });
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
const actors = {}, loans = {}, cases = [], focus = new Set(['loan sweep', 'wanted hunt', 'bounty sweep', 'buyback']);
const injectionPlans = new Map([['loan sweep:2', 'bounty:wanted'], ['loan sweep:26', 'forfeit'],
  ['loan sweep:49', 'loan:refund'], ['bounty sweep:75', 'bounty:wanted:refund']]);
let pool, result, fixtureComplete = false, injecting = null, expectedFaults = [], firstFailure = false, boundaryCount = 0, equationCount = 0;
const elapsedHour = () => (at - epoch) / 3600000;
async function observe(label, action, validate = () => {}) {
  const before = await snapshotLoanResources(readPool); let after, value, actionError, journal;
  try {
    try { value = await action(); } catch (error) { actionError = error; }
    after = await snapshotLoanResources(readPool);
    journal = reconcileLoanLifecycle(before, after, { label, result: value });
    await validate({ before, after, result: value, journal, error: actionError });
    boundaryCount++; equationCount += journal.equations.length;
    await proof.record({ kind: 'loan-resource-boundary', label, logicalAt: at, journal, result: value ?? null,
      actionError: actionError ? { code: actionError.code || null, message: actionError.message } : null });
    if (actionError) throw actionError;
    return value;
  } catch (error) {
    const expectedRefusal = error === actionError && (['overdue', 'clean'].includes(error.code)
      || (injecting && error.message.includes('RC1_LIFECYCLE_ABORT')));
    if (!firstFailure && !expectedRefusal) {
      firstFailure = true; await proof.artifact('first-resource-failure.json', { label, logicalAt: at, before, after: after || null,
        result: value ?? null, journal: journal || null, error: { message: error.message, stack: error.stack } });
    }
    throw error;
  }
}
const unchanged = ({ before, after }) => assert.equal(loanStateHash(after), loanStateHash(before), 'Abort/replay changed authoritative custody');
async function installFailure(reason) {
  assert(!injecting); injecting = reason; expectedFaults = [];
  const condition = reason === 'forfeit' ? "OLD.status='active' AND NEW.status='collected'" : `NEW.reason='${reason}'`;
  assert(['forfeit', 'bounty:wanted', 'loan:refund', 'bounty:wanted:refund', 'loan:square'].includes(reason));
  // Bounty sweep deliberately logs SQLSTATE instead of database exception text.
  // A unique test state identifies only this injected fault, never generic P0001.
  await pool.query(`CREATE FUNCTION rc1_loan_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'RC1_LIFECYCLE_ABORT' USING ERRCODE='RCL01'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER rc1_loan_abort BEFORE ${reason === 'forfeit' ? 'UPDATE ON loans' : 'INSERT ON transactions'} FOR EACH ROW EXECUTE FUNCTION rc1_loan_abort()`);
}
async function removeFailure() {
  const reason = injecting; await pool.query(`DROP TRIGGER rc1_loan_abort ON ${reason === 'forfeit' ? 'loans' : 'transactions'}`);
  await pool.query('DROP FUNCTION rc1_loan_abort()'); injecting = null;
}
const originalJob = controller.job.bind(controller);
controller.job = (label, fn) => originalJob(label, async () => {
  if (!fixtureComplete || !focus.has(label)) return fn();
  const key = `${label}:${elapsedHour()}`, failure = injectionPlans.get(key);
  if (failure) { injectionPlans.delete(key); await installFailure(failure); }
  try {
    return await observe(label, fn, async state => {
      if (failure) {
        unchanged(state); assert(expectedFaults.length > 0, 'Injection did not reach the canonical terminal write');
        await proof.record({ kind: 'expected-terminal-rollback', logicalAt: at, label, reason: failure, faults: expectedFaults });
        cases.push({ branch: `${label}:${failure}:rollback`, hour: elapsedHour(), outcome: 'PASS' });
      }
    });
  } finally { if (failure) await removeFailure(); }
});
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => {
    if (level === 'error' && injecting && (args.map(String).join(' ').includes('RC1_LIFECYCLE_ABORT') || args.includes('RCL01'))) {
      expectedFaults.push(args.map(String).join(' ')); return;
    }
    controller.log(level, args);
  };
  await proof.record({ kind: 'database-created', ...await database.create() });
  await base.query(`CREATE SCHEMA ${namespace}`);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 });
  await seam.clock.initialize(bootstrap); pool = await makeWorkerDatabase(controller);
  const [{ spawnResident }, { POPULATION, LOAN }, { withCharacter, withTwoCharacters }, loanDomain, { runLedgerInvariants }] = await Promise.all([
    import('../src/population.js'), import('../src/rules.js'), import('../src/game.js'), import('../src/loans.js'), import('../src/invariants.js')]);
  assert.equal(LOAN.OFFER_TTL_MS, 48 * 3600000); assert.equal(LOAN.GRACE_MS, 24 * 3600000); assert.equal(LOAN.WANTED_MS, 72 * 3600000);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const role of ['lender', 'grace', 'expiry', 'square']) {
      const actor = await spawnResident(client, { band: POPULATION.BANDS.find(row => row.id === 'boss'), marks: { car: role !== 'lender' } }); assert(actor);
      const row = (await client.query('SELECT id,account_id FROM characters WHERE id=$1', [actor.id])).rows[0];
      const car = (await client.query('SELECT id FROM cars WHERE character_id=$1', [actor.id])).rows[0];
      actors[role] = { ...row, car: car?.id || null };
      await client.query('UPDATE characters SET hosp_until=$2 WHERE id=$1', [actor.id, new Date(epoch + 80 * 3600000)]);
    }
    await client.query('UPDATE street_tax SET pool=100000 WHERE id=1');
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  const invariant = async label => {
    const value = await runLedgerInvariants(pool, { alert: false });
    await proof.record({ kind: 'canonical-invariants', label, logicalAt: at, value }); assert(value.ok, `Canonical invariant failed: ${label}`);
  };
  await invariant('initial-fixture');
  await proof.artifact('fixture-resources.json', { actors, state: await snapshotLoanResources(readPool), fixtureWritesEndHere: true });
  fixtureComplete = true;
  await bootOriginalWorker(controller);
  const one = (role, name, work) => observe(name, () => withCharacter(pool, actors[role].account_id, work));
  const offer = (name, to, collateral = 0) => one('lender', name, (ch, q, h) => loanDomain.offerLoan(ch,
    { amount: 5000, rate: .1, hours: 1, ...(to ? { to: actors[to].id } : {}), collateral }, q, h));
  loans.open = (await offer('untaken-offer', null)).id;
  for (const role of ['grace', 'expiry', 'square']) {
    loans[role] = (await offer(`${role}-secured-offer`, role, 5000)).id;
    await one(role, `${role}-take`, (ch, q, h) => loanDomain.takeLoan(ch, loans[role], actors[role].car, q, h));
  }
  await invariant('canonical-entry');
  await proof.artifact('loan-entry.json', { loans, state: await snapshotLoanResources(readPool) });
  const row = (state, role) => state.loans.find(item => item.id === loans[role]);
  const mark = (branch, hour = elapsedHour()) => cases.push({ branch, hour, outcome: 'PASS' });
  await controller.advanceTo(epoch + hours * 3600000, async (_at, label) => {
    if (label !== 'guardedTick') return;
    const hour = elapsedHour(), state = await snapshotLoanResources(readPool);
    if (hour === 1) { for (const role of ['grace', 'expiry', 'square']) assert.equal(row(state, role).status, 'active'); assert.equal(state.bounties.length, 0); mark('due-equality-no-early-Wanted'); }
    if (hour === 2) { assert.equal(state.bounties.length, 0); mark('Wanted-rollback-no-pot-or-mark'); }
    if (hour === 3) {
      assert.equal(state.bounties.length, 3); assert.equal(exactSum(state.bounties.map(r => r.amount)), String(3 * LOAN.WANTED_BOUNTY));
      for (const pot of state.bounties) assert.equal(Date.parse(pot.expires_at), at + LOAN.WANTED_MS);
      mark('funded-Wanted-original-next-tick-retry');
      await assert.rejects(one('square', 'square-active-debt-denied', (ch, q, h) => loanDomain.squareWanted(ch, q, h)), error => error.code === 'overdue');
      await observe('repay-before-square', () => withTwoCharacters(pool, actors.square.account_id, actors.lender.id,
        (ch, lender, q, h) => loanDomain.repayLoan(ch, lender, loans.square, q, h), { meet: false }));
      await installFailure('loan:square');
      try { await assert.rejects(observe('square-late-rollback', () => withCharacter(pool, actors.square.account_id,
        (ch, q, h) => loanDomain.squareWanted(ch, q, h)), unchanged), /RC1_LIFECYCLE_ABORT/); mark('square-pool-and-personal-rollback'); }
      finally { await removeFailure(); }
      await one('square', 'square-refunds-funded-Wanted', (ch, q, h) => loanDomain.squareWanted(ch, q, h));
      await assert.rejects(one('square', 'square-terminal-retry', (ch, q, h) => loanDomain.squareWanted(ch, q, h)), error => error.code === 'clean');
      mark('square-payment-and-HOUSE-share-refund-once');
    }
    if (hour === 25 || hour === 26) {
      for (const role of ['grace', 'expiry']) { assert.equal(row(state, role).status, 'active'); const car = state.cars.find(c => c.id === actors[role].car); assert(car.pledged); assert.equal(car.character_id, actors[role].id); }
      mark(hour === 25 ? 'grace-equality-no-early-forfeit' : 'grace-car-transfer-rolled-back');
    }
    if (hour === 27) {
      for (const role of ['grace', 'expiry']) { assert.equal(row(state, role).status, 'collected'); const car = state.cars.find(c => c.id === actors[role].car); assert(!car.pledged); assert.equal(car.character_id, actors.lender.id); }
      mark('original24h-grace-two-car-forfeits-once');
      await observe('loan sweep', () => loanDomain.sweepLoans(pool), unchanged); mark('grace-terminal-sweep-retry');
    }
    if (hour === 48 || hour === 49) { assert.equal(row(state, 'open').status, 'open'); mark(hour === 48 ? 'offer48h-equality-no-early-expiry' : 'offer-expiry-refund-rolled-back'); }
    if (hour === 50) { assert.equal(row(state, 'open').status, 'cancelled'); mark('original48h-offer-next-tick-refund'); await observe('loan sweep', () => loanDomain.sweepLoans(pool), unchanged); mark('offer-terminal-sweep-retry'); }
    if (hour === 74 || hour === 75) { assert.equal(state.bounties.length, 2); mark(hour === 74 ? 'Wanted-before72h-no-early-expiry' : 'Wanted-expiry-HOUSE-refund-rolled-back'); }
    if (hour === 76) {
      assert.equal(state.bounties.length, 0); assert.equal(state.bounty_contributors.length, 0); mark('original72h-Wanted-expiry-two-HOUSE-refunds');
      const { sweepExpiredBounties } = await import('../src/social.js'); await observe('bounty sweep', () => sweepExpiredBounties(pool), unchanged); mark('Wanted-terminal-sweep-retry');
    }
    await invariant(`hour:${hour}`);
    if (hour % 12 === 0 || [2, 3, 26, 27, 49, 50, 75, 76].includes(hour)) originalConsole.log(JSON.stringify({ runId, hour, cases: cases.length, boundaries: boundaryCount }));
  });
  assert.equal(injectionPlans.size, 0, 'Not every planned original-worker terminal injection ran');
  const schedule = controller.diagnostic(); assert.equal(schedule.failures.length, 0);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map(label =>
    [label, schedule.events.filter(row => row.kind === 'timer.fire' && row.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: hours * 12, guardedTick: hours, guardedSeasonTick: hours, 'health-boundary': hours * 12 });
  const final = await snapshotLoanResources(readPool); await proof.artifact('final-resources.json', final);
  const relevant = final.transactions.filter(r => ['bounty:wanted', 'bounty:wanted:refund', 'loan:refund'].includes(r.reason));
  assert.equal(relevant.filter(r => r.reason === 'bounty:wanted').length, 3);
  assert.equal(relevant.filter(r => r.reason === 'bounty:wanted:refund').length, 3);
  assert.equal(relevant.filter(r => r.reason === 'loan:refund').length, 1);
  await proof.artifact('worker-schedule.json', schedule); await proof.artifact('random-tape.json', runtime.tape);
  await proof.artifact('branch-coverage.json', { source: source.revision, cases, fullGapStatus: 'OPEN_REQUIRED_PROOF', exclusions: configuration.excluded });
  result = { status: 'PASS_SCOPED', logicalHours: hours, boundaryCount, equationCount, timerCounts, cases,
    sourceImmutable: true, qualifyingFullResourcePass: false, gateStatus: 'OPEN_REQUIRED_PROOF', evidence: 'NATIVE_ORIGINAL_DURATIONS_LOGICAL_CLOCK_FIXTURE_ASSISTED' };
} catch (error) {
  result = { status: 'FAIL', logicalAt: at, logicalHour: elapsedHour(), error: error.message, cases, boundaryCount, equationCount };
  await proof.record({ kind: 'failure', message: error.message, stack: error.stack, logicalAt: at });
  await proof.artifact('failure-worker-schedule.json', controller.diagnostic()); await proof.artifact('failure-random-tape.json', runtime.tape);
  if (pool) try { await proof.artifact('failure-resources.json', await snapshotLoanResources(readPool)); } catch (capture) { await proof.record({ kind: 'failure-capture-error', message: capture.message }); }
  process.exitCode = 1;
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = originalConsole[level];
  await controller.close(); await readPool.end(); await base.end();
  await proof.record({ kind: 'database-retained', descriptor: database.descriptor });
  seam.restore(); runtime.restore();
  for (const [key, value] of Object.entries(priorEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify({ runId, output, source: source.revision, status: result.status, logicalHour: result.logicalHour ?? hours,
  boundaryCount, equationCount, matrixQualifying: false }));
