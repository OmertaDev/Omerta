// Native request/balance precision controls, including explicit legacy subatomic fixtures.
// These inputs intentionally cannot pass the six-decimal custody journal baseline.
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { snapshotOmr } from '../tools/rc1-omr-journal.js';
import { exactSum, negate } from '../tools/rc1-resource-journal.js';
assert(process.argv.includes('--postgres'), 'Native PostgreSQL required');
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = await sourceIdentity(), runId = `omr-window-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(arg('output') || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
const database = planOwnedWorldDatabase({ controlUrl: process.env.RC1_RESOURCE_DATABASE_URL, runId, sourceRevision: source.revision });
for (const name of ['CHAIN_RPC_URL', 'CHAIN_SIGNER_PK', 'INVARIANT_WEBHOOK_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL', 'REDIS_URL']) assert(!process.env[name], `External integration excluded: ${name}`);
const fixtures = { short: '6.0000099999999996', historic: '5000.000000000001', full: '6.000010', cap: '1500', formats: '5000' };
const configuration = { authority: 'Native canonical window HTTP injection; exact arbitrary-scale PostgreSQL fixtures, no worker/lifecycle claim',
  fixture: { balances: fixtures, source: 'Retired AMM seed, exact native subtraction before baseline', till: '1000000' },
  databaseIsolation: database.descriptor, fullResourceCoverage: false };
const proof = await createProofRecorder({ directory: output, source, configuration, runId, seed: 'window-boundaries', scenarioId: 'window-exact-legacy-boundaries', population: 5 });
const env = { DATABASE_URL: database.url, JWT_SECRET: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex'),
  MARKET_SEED: crypto.randomBytes(32).toString('hex'), RATE_LIMIT: 'off', INVITE_MODE: 'off', SOCIAL_VERIFY_MODE: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off', POPULATION_OFF: 'on' };
const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])); Object.assign(process.env, env);
const pool = new pg.Pool({ connectionString: database.url }); let app, result; const cases = [], tokens = new Map();
const total = state => exactSum([...state.account_persistent.flatMap(row => [row.omr, row.staked, row.unbonding]),
  ...state.amm_pool.map(row => row.omr_reserve), ...state.desk_inventory.map(row => row.balance), ...state.family_yield_pool.map(row => row.balance)]);
async function request(name, owner, amount, expectedStatus = 200, expectedBalance = null, expectedCash = null) {
  const before = await snapshotOmr(pool), response = await app.inject({ method: 'POST', url: '/v1/window/redeem', payload: { amount },
    headers: { authorization: `Bearer ${tokens.get(owner)}`, 'idempotency-key': name } });
  const body = response.json(), after = await snapshotOmr(pool), artifact = `window-${String(cases.length + 1).padStart(3, '0')}.json`;
  await proof.artifact(artifact, { name, owner, amount, before, after, status: response.statusCode, body });
  assert.equal(response.statusCode, expectedStatus, `${name}: ${JSON.stringify(body)}`);
  if (expectedStatus === 200) {
    assert.equal(total(after), total(before), 'Exact arbitrary-scale supply changed');
    const old = before.account_persistent.find(row => row.account_id === owner), now = after.account_persistent.find(row => row.account_id === owner);
    const normalized = (await pool.query('SELECT $1::numeric::text AS amount', [amount])).rows[0].amount;
    assert.equal(exactSum([now.omr, negate(old.omr), normalized]), '0', 'Exact owner debit against independent native decimal parser');
    if (expectedBalance !== null) assert.equal(exactSum([now.omr, negate(expectedBalance)]), '0');
    if (expectedCash !== null) assert.equal(body.cash, expectedCash);
  } else {
    assert.deepEqual(after.account_persistent, before.account_persistent, 'Refusal changed accounts');
    for (const table of ['transactions', 'idempotency', 'exchange_pool', 'desk_inventory', 'family_yield_pool']) assert.deepEqual(after[table], before[table], `Refusal changed ${table}`);
  }
  cases.push({ name, outcome: 'PASS', artifact, status: response.statusCode });
}
try {
  await proof.record({ kind: 'database-created', ...await database.create() });
  app = await (await import('../src/server.js')).buildServer();
  for (const [id, balance] of Object.entries(fixtures)) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
    await pool.query('INSERT INTO account_persistent(account_id,omr) VALUES($1,$2)', [id, balance]);
    await pool.query('INSERT INTO characters(id,account_id,name,season) VALUES($1,$1,$1,$2)', [id, Math.floor(Date.now() / 2419200000)]); tokens.set(id, app.jwt.sign({ sub: id, tv: 0 }));
  }
  await pool.query('UPDATE amm_pool SET omr_reserve=omr_reserve-(SELECT SUM(omr) FROM account_persistent) WHERE id=1');
  await pool.query('UPDATE exchange_pool SET balance=1000000,lifetime_funded=1000000 WHERE id=1');
  await proof.artifact('baseline.json', { state: await snapshotOmr(pool), fixtureWritesEndHere: true });
  await request('legacy-just-insufficient', 'short', '6.000010', 400);
  await request('legacy-value-preserved', 'historic', '6.000011', 200, '4993.999989000001', 3000);
  await request('full-balance-half-micro-cut', 'full', '6.000010', 200, '0', 3000);
  await request('above-cap', 'cap', '1500.000001', 400);
  await request('exact-cap-full-balance', 'cap', '1500', 200, '0', 750000);
  for (const [i, amount] of ['6.00001100', '6000011e-6', ' +6.000011 ', '0006.000011', '6.000011E+0', 6.001999, 6.002].entries())
    await request(`supported-format-${i}`, 'formats', amount, 200, null, i === 6 ? 3001 : 3000);
  for (const [i, amount] of ['1e999999999', '1e-999999999', 5.999999, -6, '1501e0', null, 6.0000001, '6.0000000000000001'].entries())
    await request(`refused-format-${i}`, 'formats', amount, 400);
  result = { status: 'PASS_SCOPED', cases, fullResourceCoverage: false, exclusions: ['Worker/lifecycles', 'All other OMR transfers', 'Historic dust cleanup', 'Chain/provider/deployment/natural acquisition'] };
} catch (error) { result = { status: 'FAIL', cases, error: error.message }; await proof.record({ kind: 'failure', message: error.message, stack: error.stack }); process.exitCode = 1;
} finally {
  if (app) await app.close(); await pool.end();
  for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify({ runId, source: source.revision, output, status: result.status, cases: cases.length }));
