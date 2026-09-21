import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { exactSum, negate } from '../tools/rc1-resource-journal.js';

assert(process.argv.includes('--postgres'), 'Native PostgreSQL required');
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = await sourceIdentity(), seed = 'family-yield-exact-numeric-v1';
const runId = `family-yield-precision-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(arg('output') || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
const cases = [
  { name: 'fractional-window-sized', balance: '0.3095', paid: '0.30', shares: ['0.30'] },
  { name: 'legacy-high-scale-remainder', balance: '0.309999999999999999', paid: '0.30', shares: ['0.30'] },
  { name: 'sub-cent-rounds-to-cent-as-number', balance: '0.009999999999999999', paid: '0', shares: ['0'] },
  { name: 'legacy-one-attounit-remainder', balance: '1.010000000000000001', paid: '1.01', shares: ['1.01'], rollback: true },
  { name: 'five-authored-quotas-clamped', balance: '0.23', paid: '0.23', shares: ['0.08', '0.06', '0.05', '0.03', '0.01'] },
  { name: 'five-authored-quotas-below-minimum', balance: '0.01', paid: '0', shares: ['0', '0', '0', '0', '0'] },
  { name: 'negative-attounit', balance: '-0.000000000000000001', funded: '0', previousPaid: '0.000000000000000001', rejected: ['family yield backed', 'family yield balance'] },
  { name: 'positive-identity-attounit', balance: '0.010000000000000001', funded: '0.01', previousPaid: '0', rejected: ['family yield balance'] },
  { name: 'overspent-attounit', balance: '0', funded: '0.3', previousPaid: '0.300000000000000001', rejected: ['family yield backed', 'family yield balance'] },
];
const configuration = { seed, cases, scope: 'Native NUMERIC Family-yield precision and strict invariant controls',
  fixtures: ['One exclusively owned database per case; declared eligible Family rows with ordered standing and zero reserve before baseline',
    'Exact desired pool balance reallocated from retired AMM initial20000; matching lifetime funding before baseline for valid cases',
    'Three named intentionally corrupt prebaseline counter/balance states are rejection controls, not valid game entry'],
  authority: 'Canonical payFamilyYield transaction; no postbaseline value/status edits; concurrent duplicate and exact no-value replay',
  exclusions: ['This precision suite does not drive a worker timer; rc1-native-family-omr drives the original hourly callbacks',
    'Formation/progression, Levy, other rank counts/ties, distribution versus membership changes, external backing and full resource qualification'],
  fullResourceCoverage: false };
const proof = await createProofRecorder({ directory: output, source, configuration, runId, seed, scenarioId: 'family-yield-native-precision', population: 5 });
const previousUrl = process.env.DATABASE_URL, results = []; let pool, currentCase, before, firstFailure = false, result;
async function snapshot() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const state = {
      pool: (await client.query('SELECT * FROM family_yield_pool ORDER BY id')).rows,
      gangs: (await client.query('SELECT id,omr_reserve,season_tribute,season_wars,npc_flag FROM gangs ORDER BY id')).rows,
      receipts: (await client.query('SELECT * FROM transactions ORDER BY id')).rows,
      amm: (await client.query('SELECT omr_reserve FROM amm_pool WHERE id=1')).rows,
    };
    await client.query('COMMIT'); return state;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
const familyChecks = value => value.checks.filter(row => row.name.startsWith('family yield'));
try {
  const { makeDb } = await import('../src/db.js');
  const { payFamilyYield, runExchangeInvariants } = await import('../src/exchange.js');
  for (const scenario of cases) {
    currentCase = scenario.name; before = null;
    const database = planOwnedWorldDatabase({ controlUrl: process.env.RC1_RESOURCE_DATABASE_URL, runId: `${runId}-${scenario.name}`, sourceRevision: source.revision });
    await proof.record({ kind: 'owned-database', name: currentCase, ...await database.create() });
    process.env.DATABASE_URL = database.url; pool = await makeDb();
    await proof.record({ kind: 'database-version', name: currentCase, ...(await pool.query('SELECT version() AS version')).rows[0] });
    const shares = scenario.shares || ['0'];
    for (let index = 0; index < shares.length; index++) await pool.query(
      'INSERT INTO gangs(id,name,tag,season_tribute) VALUES($1,$2,$3,$4)',
      [`precision-family-${index}`, `Precision Family ${index}`, `P${index}`, (shares.length - index) * 100]);
    await pool.query('UPDATE amm_pool SET omr_reserve=omr_reserve-$1 WHERE id=1', [scenario.balance]);
    await pool.query('UPDATE family_yield_pool SET balance=$1,lifetime_funded=$2,lifetime_paid=$3 WHERE id=1',
      [scenario.balance, scenario.funded ?? scenario.balance, scenario.previousPaid ?? '0']);
    before = await snapshot(); await proof.artifact(`${currentCase}-baseline.json`, { scenario, fixtureWritesEndHere: true, state: before });
    assert.equal(exactSum([before.amm[0].omr_reserve, before.pool[0].balance]), '20000', 'Declared allocation retains seed total');
    const initialInvariant = await runExchangeInvariants(pool);
    if (scenario.rejected) {
      assert.deepEqual(familyChecks(initialInvariant).filter(row => !row.ok).map(row => row.name), scenario.rejected);
      assert.equal(initialInvariant.ok, false); assert.deepEqual(await snapshot(), before);
      await proof.artifact(`${currentCase}-rejection.json`, { scenario, invariant: initialInvariant, after: await snapshot() });
      results.push({ name: currentCase, outcome: 'CORRUPTION_REJECTED', rejected: scenario.rejected });
      await pool.end(); pool = null; continue;
    }
    assert(initialInvariant.ok, JSON.stringify(initialInvariant));
    if (scenario.rollback) {
      await pool.query(`CREATE FUNCTION rc1_precision_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.lifetime_paid > OLD.lifetime_paid THEN
          IF NOT EXISTS(SELECT 1 FROM transactions WHERE reason='yield:family') THEN
            RAISE EXCEPTION 'wrong precision failpoint' USING ERRCODE='RFP02'; END IF;
          RAISE EXCEPTION 'abort after exact reserve and receipt credit' USING ERRCODE='RFP01';
        END IF; RETURN NEW; END $$`);
      await pool.query('CREATE TRIGGER rc1_precision_abort BEFORE UPDATE ON family_yield_pool FOR EACH ROW EXECUTE FUNCTION rc1_precision_abort()');
      try { await assert.rejects(payFamilyYield(pool), error => error.code === 'RFP01'); }
      finally { await pool.query('DROP TRIGGER rc1_precision_abort ON family_yield_pool'); await pool.query('DROP FUNCTION rc1_precision_abort()'); }
      const afterAbort = await snapshot(); assert.deepEqual(afterAbort, before, 'Late native abort retained a debit, credit or receipt');
      await proof.artifact(`${currentCase}-rollback.json`, { before, after: afterAbort, expectedSqlstate: 'RFP01' });
    }
    // Both calls are real canonical transactions. The locked pool makes the second
    // see the first's committed remainder; no request or commit ordering is invented.
    const returned = await Promise.all([payFamilyYield(pool), payFamilyYield(pool)]), after = await snapshot();
    assert.equal(exactSum(returned.map(row => String(row.paid))), exactSum([scenario.paid]));
    assert.equal(exactSum([after.pool[0].balance]), exactSum([scenario.balance, negate(scenario.paid)]));
    assert.equal(exactSum([after.pool[0].lifetime_paid]), exactSum([scenario.paid]));
    assert.equal(after.pool[0].lifetime_funded, before.pool[0].lifetime_funded);
    assert.equal(exactSum([after.amm[0].omr_reserve, after.pool[0].balance, ...after.gangs.map(row => row.omr_reserve)]), '20000');
    const oldReceipts = new Map(before.receipts.map(row => [row.id, row]));
    for (const row of before.receipts) assert.deepEqual(after.receipts.find(item => item.id === row.id), row);
    const added = after.receipts.filter(row => !oldReceipts.has(row.id));
    assert.equal(added.length, shares.filter(share => exactSum([share]) !== '0').length);
    for (let index = 0; index < shares.length; index++) {
      const id = `precision-family-${index}`, gang = after.gangs.find(row => row.id === id), receipts = added.filter(row => row.counterparty === id);
      assert.equal(exactSum([gang.omr_reserve]), exactSum([shares[index]]));
      assert.equal(exactSum(receipts.map(row => row.amount)), exactSum([shares[index]]));
      for (const receipt of receipts) {
        assert.equal(receipt.reason, 'yield:family'); assert.equal(receipt.currency, 'omr');
        assert.equal(receipt.account_id, null); assert.equal(receipt.character_id, null);
      }
    }
    const finalInvariant = await runExchangeInvariants(pool); assert(finalInvariant.ok, JSON.stringify(finalInvariant));
    const replay = await payFamilyYield(pool); assert.equal(replay.paid, 0); assert.deepEqual(await snapshot(), after);
    await proof.artifact(`${currentCase}-distribution.json`, { scenario, before, after, returned, replay, initialInvariant, finalInvariant });
    results.push({ name: currentCase, outcome: 'PASS', paid: scenario.paid, remainder: after.pool[0].balance,
      receipts: added.length, concurrentCalls: returned.length, lateRollback: !!scenario.rollback, replay: 'EXACT_NO_VALUE' });
    await pool.end(); pool = null;
  }
  result = { status: 'PASS_SCOPED', results, fullResourceCoverage: false, exclusions: configuration.exclusions };
} catch (error) {
  firstFailure = true;
  await proof.artifact('first-precision-failure.json', { name: currentCase ?? null, before: before ?? null,
    after: pool ? await snapshot().catch(() => null) : null, message: error.message, stack: error.stack });
  result = { status: 'FAIL', results, failedCase: currentCase ?? null, error: error.message, fullResourceCoverage: false }; process.exitCode = 1;
} finally {
  if (pool) await pool.end();
  if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify({ runId, output, source: source.revision, status: result.status, completed: results.length, firstFailure, fullResourceCoverage: false }));
