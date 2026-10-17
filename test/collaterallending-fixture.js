import assert from 'node:assert/strict';
import { collateralLendingDDL } from '../src/collaterallending-schema.js';
import { ensureComponentDDL } from './lib/company-middle-five-fixture-schema.js';

export async function collateralLendingBackend() {
  assert(!process.env.DATABASE_URL, 'Reject ambient database endpoints');
  const native = process.argv.includes('--postgres');
  if (!native) { assert.deepEqual(process.argv.slice(2), []); return { native: false, version: 'pg-mem' }; }
  assert.deepEqual(process.argv.slice(2), ['--postgres']);
  assert(!process.env.NODE_OPTIONS && !process.env.NODE_PATH, 'Reject preload and module overrides');
  assert(!Object.keys(process.env).some(key => /^PG[A-Z_]/.test(key) && process.env[key]), 'Reject ambient PG overrides');
  const url = new URL(process.env.COLLATERAL_LENDING_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(url.protocol)); assert.equal(url.hostname, '127.0.0.1');
  assert(!url.search && !url.hash); assert.match(url.pathname, /^\/collateral_lending_test_[a-f0-9]{12}$/);
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck'; assert(local || ci);
  const { default: pg } = await import('pg'), pre = new pg.Client({ connectionString: url.href });
  let version;
  await pre.connect();
  try {
    await pre.query('BEGIN READ ONLY');
    const server = (await pre.query(`SELECT current_user AS role,current_database() AS database,
      pg_get_userbyid(datdba) AS owner,current_setting('server_version') AS version FROM pg_database WHERE datname=current_database()`)).rows[0];
    assert.equal(server.role, url.username); assert.equal(server.owner, url.username); assert.equal(server.database, url.pathname.slice(1));
    version = server.version; assert.match(version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    if (local) assert.equal((await pre.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\', '/').toLowerCase(), url.port === '35439'
      ? 'c:/users/jorge/appdata/local/temp/omerta-economy-oct15-pg184' : 'c:/users/jorge/appdata/local/temp/omerta-employment-pg184-proof');
    assert.equal((await pre.query(`SELECT COUNT(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m','f')`)).rows[0].n, 0);
    await pre.query('ROLLBACK');
  } finally { await pre.end(); }
  process.env.DATABASE_URL = url.href;
  return { native, version };
}

export async function fixture({ nativeOnly = false } = {}) {
  if (nativeOnly) assert.deepEqual(process.argv.slice(2), ['--postgres'], 'Positive cash-loan/custody integration requires the actual native backend');
  const backend = await collateralLendingBackend();
  Object.assign(process.env, { RESOURCE_ECONOMY: 'off', RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', INVITE_MODE: 'off', DEPOT_PILOT: 'on',
     JWT_SECRET: 'equipment-collateral-fixture-only', MOD_KEY: 'equipment-collateral-fixture-only', MARKET_SEED: 'equipment-collateral-fixture-only' });
  const { buildServer } = await import('./server-fixture.js');
  const G = await import('../src/game.js'), I = await import('../src/items.js'), Loans = await import('../src/loans.js');
  const C = await import('../src/collaterallending.js'), A = await import('../src/collaterallending-invariants.js');
  const app = await buildServer(), pool = app.pool;
  if (backend.native) {
    const names = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'
      AND table_name IN ('collateral_lending_pledges','collateral_lending_requests','collateral_lending_terminals') ORDER BY table_name`)).rows.map(row => row.table_name);
    assert.deepEqual(names, ['collateral_lending_pledges', 'collateral_lending_requests', 'collateral_lending_terminals'], 'Native integration uses actual shared DDL only');
    assert.equal((await C.collateralLendingAvailability()).available, true, 'Actual fixed canonical hooks must be composed before a positive native test');
  } else await ensureComponentDDL(pool, collateralLendingDDL, ['collateral_lending_pledges', 'collateral_lending_requests', 'collateral_lending_terminals']);
  let serial = 0;
  const key = label => 'collateral-fixture-' + label + '-' + ++serial;
  const call = (person, method, url, body, requestKey = key('http'), agent = false) => app.inject({ method, url, payload: body,
    headers: { ...(person ? { authorization: 'Bearer ' + (agent ? person.agent : person.token) } : {}), ...(requestKey ? { 'idempotency-key': requestKey } : {}) } });
  const ok = async (...args) => { const result = await call(...args); assert.equal(result.statusCode, 200, result.body); return result.json(); };
  async function player() {
    const person = { token: (await ok(null, 'POST', '/v1/auth/guest')).token };
    await ok(person, 'POST', '/v1/character', { name: 'Equipment credit ' + ++serial }); person.account = app.jwt.verify(person.token).sub;
    const original = (await pool.query('SELECT id,cash,bank FROM characters WHERE account_id=$1 AND alive=true', [person.account])).rows[0]; person.id = original.id;
    await pool.query("UPDATE characters SET cash=100000,bank=0,loc='foundry',respect=10000 WHERE id=$1", [person.id]);
    await G.ledger(pool, { characterId: person.id, currency: 'cash', amount: 100000 - Number(original.cash) - Number(original.bank), reason: 'crime:collateral_fixture_endowment' });
    await pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network') ON CONFLICT DO NOTHING", [person.id]);
    person.agent = (await ok(person, 'POST', '/v1/auth/agent-key')).token;
    return person;
  }
  const tx = fn => I.withItemTransaction(pool, fn);
  async function makeTool(person) {
    const Craft = await import('../src/crafting.js');
    await tx(async client => {
      for (const [template, quantity] of [['mat:hardened_steel', 1], ['mat:salvage_parts', 2]]) {
        await I.grantStack(client, { scope: 'account', id: person.account }, template, quantity, 'standard', 'explicit equipment credit fixture materials', key('material'));
      }
    });
    return (await tx(client => Craft.craftWorldGraphRecipe(client, { accountId: person.account }, 'recipe:precision_lock_tool', key('actual-craft')))).outputs[0].id;
  }
  const offer = (lender, borrower, options = {}) => ok(lender, 'POST', '/v1/loans', { amount: 5000, rate: 0.05, hours: 1, to: borrower.id, collateral: 0, collateralOmr: 0, ...options });
  const ref = receipt => ({ pledgeId: receipt.pledge.pledgeId, sourceHash: receipt.pledge.sourceHash, consent: true });
  const quote = (borrower, loan, itemId) => C.collateralLendingQuote(pool, borrower.account, { loanId: loan.id, itemId });
  const pledge = (borrower, loan, itemId, quoted, requestKey = key('pledge')) => C.collateralLendingAction(pool, borrower.account, 'pledge',
    { loanId: loan.id, itemId, sourceHash: quoted.sourceHash, consent: true }, requestKey);
  const state = async () => {
    const result = {};
    for (const table of ['characters', 'transactions', 'account_persistent', 'loans', 'loan_house', 'street_tax', 'item_instances', 'item_stacks',
      'item_events', 'item_mutation_guards', 'item_mutation_inputs', 'item_mutation_outputs', 'operation_escrow', 'item_durability_states',
      'equipment_rental_offers', 'equipment_rental_leases', 'consignments', 'consignment_requests',
      'collateral_lending_pledges', 'collateral_lending_requests', 'collateral_lending_terminals']) {
      result[table] = (await pool.query('SELECT * FROM ' + table)).rows.map(row => JSON.stringify(row)).sort();
    }
    return result;
  };
  const snapshot = async () => (await import('../tools/rc1-native-proof.js')).canonicalDatabaseSnapshot(pool);
  const books = async () => {
    assert.deepEqual(await A.collectCollateralLendingIssues(pool), []);
    assert.deepEqual((await (await import('../src/invariants.js')).runLedgerInvariants(pool, { alert: false })).checks.filter(check => !check.ok), []);
  };
  return { ...backend, app, pool, G, I, Loans, C, A, key, call, ok, player, tx, makeTool, offer, ref, quote, pledge, state, snapshot, books };
}

export function observedPool(pool, intercept) {
  const observed = Object.create(pool); observed.query = pool.query.bind(pool);
  observed.connect = async () => {
    const client = await pool.connect();
    return new Proxy(client, { get(target, name) {
      if (name === 'query') return async (...args) => {
        const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text;
        const result = await target.query(...args); await intercept(target, sql, args[1], result); return result;
      };
      const value = Reflect.get(target, name); return typeof value === 'function' ? value.bind(target) : value;
    } });
  };
  return observed;
}
