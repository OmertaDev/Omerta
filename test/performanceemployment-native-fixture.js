import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// This separate entry never accepts the memory backend or inherited databases.
// Validation precedes the pg import and every network/database operation.
export function nativeEndpoint(argv = process.argv.slice(2), env = process.env) {
  assert.deepEqual(argv, ['--postgres'], 'N26 native: exact --postgres required before connect');
  assert(!env.DATABASE_URL && !env.NODE_OPTIONS && !env.NODE_PATH, 'N26 native: ambient/preload refused before connect');
  assert(!Object.keys(env).some(key => /^PG[A-Z_]/.test(key) && env[key]), 'N26 native: ambient PG refused before connect');
  const url = new URL(env.PERFORMANCE_EMPLOYMENT_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(url.protocol), 'N26 native: protocol refused before connect');
  assert.equal(url.hostname, '127.0.0.1', 'N26 native: host refused before connect');
  assert(!url.search && !url.hash, 'N26 native: URL options refused before connect');
  assert.match(url.pathname, /^\/performance_employment_test_[a-f0-9]{12}$/, 'N26 native: owned database name required before connect');
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && !url.password;
  const ci = env.CI === 'true' && url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci, 'N26 native: exact local/CI authority refused before connect');
  return { url, local, ci };
}

async function admission() {
  const endpoint = nativeEndpoint();
  const { default: pg } = await import('pg'), client = new pg.Client({ connectionString: endpoint.url.href });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const identity = (await client.query(`SELECT current_user AS role,current_database() AS database,
      pg_get_userbyid(datdba) AS owner,current_setting('server_version') AS version,
      current_setting('data_directory') AS directory FROM pg_database WHERE datname=current_database()`)).rows[0];
    assert.equal(identity.role, endpoint.url.username); assert.equal(identity.owner, endpoint.url.username);
    assert.equal(identity.database, endpoint.url.pathname.slice(1));
    assert.match(identity.version, endpoint.local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    if (endpoint.local) assert.equal(identity.directory.replaceAll('\\', '/').toLowerCase(), endpoint.url.port === '35439'
      ? 'c:/users/jorge/appdata/local/temp/omerta-economy-oct15-pg184'
      : 'c:/users/jorge/appdata/local/temp/omerta-employment-pg184-proof');
    assert.equal((await client.query(`SELECT COUNT(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
      AND c.relkind IN ('r','p','S','v','m','f')`)).rows[0].n, 0, 'N26 native: database must be genuinely empty');
    assert.equal((await client.query(`SELECT COUNT(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'`)).rows[0].n, 0);
    await client.query('ROLLBACK');
    return { ...endpoint, identity };
  } finally { await client.end(); }
}

// Delegates every operation to the actual native client; callbacks observe or
// fail real write boundaries. No query result, clock or authority is fabricated.
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

export async function nativeFixture() {
  const backend = await admission(), proofDirectory = process.env.PERFORMANCE_EMPLOYMENT_NATIVE_PROOFS;
  assert(path.isAbsolute(proofDirectory)); fs.mkdirSync(proofDirectory);
  fs.writeFileSync(path.join(proofDirectory, 'admission.json'), JSON.stringify({ ...backend.identity, native: true, fresh: true }, null, 2) + '\n');
  process.env.DATABASE_URL = backend.url.href; delete process.env.LEGAL_PROFILE_DEFER;
  Object.assign(process.env, { RESOURCE_ECONOMY: 'off', DEPOT_PILOT: 'on', DELIVERY_CONTRACTS: 'on', RATE_LIMIT: 'off',
    INVITE_MODE: 'off', SOCIAL_VERIFY_MODE: 'off', JWT_SECRET: 'performance-native-fixture-only',
    MARKET_SEED: 'performance-employment-test-seed', MOD_KEY: 'performance-native-fixture-only' });
  Object.assign(process.env, { LEGAL_OPERATOR_NAME: 'CI Test Operator', LEGAL_POSTAL_ADDRESS: '123 Fixture Street, Test City',
    PRIVACY_CONTACT_EMAIL: 'privacy@example.test', DMCA_AGENT_NAME: 'CI Test Agent', DMCA_AGENT_EMAIL: 'copyright@example.test',
    DMCA_AGENT_ADDRESS: '123 Fixture Street, Test City', DMCA_AGENT_PHONE: '+1 202 555 0100', DMCA_AGENT_REGISTERED: 'true',
    PAYMENT_REFUND_POLICY: 'Test fixture policy; not a production policy.' });
  const { buildServer } = await import('./server-fixture.js'), app = await buildServer(), pool = app.pool;
  const I = await import('../src/items.js'), G = await import('../src/game.js'), D = await import('../src/depot.js');
  const Delivery = await import('../src/delivery.js'), Economy = await import('../src/economy.js'), A = await import('../src/agentcompany.js');
  const E = await import('../src/gameemployment.js'), P = await import('../src/performanceemployment.js'), Market = await import('../src/market.js');
  assert.equal(E.performanceEmploymentHook, P.performanceEmploymentHook);
  assert.equal(Market.performanceEmploymentFill, P.recordPerformanceEmploymentFill);
  const tables = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'
    AND table_name IN ('performance_employment_contracts','performance_employment_assignments','performance_employment_requests') ORDER BY table_name`)).rows.map(row => row.table_name);
  assert.deepEqual(tables, ['performance_employment_assignments', 'performance_employment_contracts', 'performance_employment_requests']);
  const players = {}, tokens = {};
  for (const account of ['employer', 'worker', 'other']) {
    await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)', [account, 'performance-native-fixture']);
    await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$1,1,'foundry',10000,100000)", [account + '-actor', account]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
    await G.ledger(pool, { characterId: account + '-actor', currency: 'cash', amount: 99500, reason: 'crime:performance_fixture' });
    players[account] = { id: account + '-actor', account };
    tokens[account] = { human: app.jwt.sign({ sub: account, tv: 0 }), agent: app.jwt.sign({ sub: account, tv: 0, agent: true }) };
  }
  const single = (account, fn, database = pool) => G.withCharacter(database, account, fn);
  const pair = (account, other, fn, database = pool) => G.withTwoCharacters(database, account, players[other].id, fn, { meet: false });
  const balance = async account => Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [players[account].id])).rows[0].cash);
  let serial = 0; const key = label => 'N26-native-' + label + '-' + ++serial;
  await pool.query('INSERT INTO estates(account_id,tier) VALUES($1,1)', ['employer']);
  await A.setAgentCompany(pool, 'employer', { expectedRevision: 0, name: 'Actual native employer', published: true, premises: 'estate' });
  const depot = await single('employer', (ch, c, h) => D.openDepot(ch, { salePrice: 2000, bidPrice: 500, targetStock: 4, reorderAt: 0, restockBudget: 3000 }, c, h));
  await single('employer', (ch, c, h) => D.fundDepot(ch, depot.id, 20000, c, h));
  let order = await single('employer', (ch, c, h) => D.restockDepot(ch, depot.id, c, h));
  const create = (options = {}) => single('employer', (ch, c, h) => E.createEmployment(ch, { depotId: depot.id,
    slots: options.slots ?? 2, wageCash: 100, acceptHumans: true, acceptAgents: true,
    expiresAt: options.expiresAt || new Date(Date.now() + 1200000).toISOString() }, key('job'), c, h));
  const fund = (job, options = {}, database = pool) => I.withItemTransaction(database, c => P.fundPerformanceEmployment(c, 'employer',
    { employmentId: job.employmentId, minimumUnits: options.minimumUnits ?? 4, bonusCash: options.bonusCash ?? 50, consent: true },
    options.key || key('fund'), { agent: options.agent === true }));
  const commitment = (account = 'worker', qty = 4, seconds = 600) => single(account, (ch, c) => Delivery.acceptDelivery(ch, order.id,
    { qty, unitPrice: 500, maxProcurementCash: 5000, deadlineSeconds: seconds }, c));
  const accept = (job, com, account = 'worker', requestKey = key('accept')) => pair(account, 'employer', (ch, owner, c, h) =>
    E.acceptEmployment(ch, owner, { employmentId: job.employmentId, commitmentId: com.id, consent: true }, requestKey, c, h));
  const claim = (job, com, account = 'worker', requestKey = key('claim'), database = pool) => pair(account, 'employer', (ch, owner, c, h) =>
    E.claimEmployment(ch, owner, job.employmentId, com.id, requestKey, c, h), database);
  const deliver = async (com, qty, account = 'worker', database = pool) => {
    const cargo = Number((await pool.query("SELECT qty FROM character_cargo WHERE character_id=$1 AND good_id='gin'", [players[account].id])).rows[0]?.qty || 0);
    if (cargo < qty) await single(account, (ch, c, h) => Economy.buyGood(ch, 'gin', qty - cargo, c, h));
    return single(account, (ch, c, h) => Delivery.deliverCommitment(ch, com.id, qty, c, h), database);
  };
  const restock = async () => {
    await single('employer', (ch, c) => D.receiveDepot(ch, depot.id, order.id, c));
    await single('employer', (ch, c, h) => D.withdrawDepotStock(ch, depot.id, 4, c, h));
    order = await single('employer', (ch, c, h) => D.restockDepot(ch, depot.id, c, h)); return order;
  };
  const { canonicalDatabaseSnapshot } = await import('../tools/rc1-native-proof.js');
  const snapshot = async label => { const actual = await canonicalDatabaseSnapshot(pool);
    fs.writeFileSync(path.join(proofDirectory, label + '.json'), JSON.stringify(actual, null, 2) + '\n'); return actual; };
  const same = (before, after) => { assert.deepEqual(after.tables, before.tables); assert.deepEqual(after.sequences, before.sequences);
    assert.equal(after.stateSha256, before.stateSha256); };
  const books = async () => { const bonus = await P.performanceEmploymentInvariant(pool); assert.equal(bonus.ok, true, JSON.stringify(bonus));
    const all = await (await import('../src/invariants.js')).runLedgerInvariants(pool, { alert: false });
    assert.equal(all.ok, true, JSON.stringify(all.checks?.filter(check => !check.ok))); };
  const http = (account, method, url, payload, requestKey = key('http'), agent = false) => app.inject({ method, url, payload,
    headers: { authorization: 'Bearer ' + tokens[account][agent ? 'agent' : 'human'], 'idempotency-key': requestKey } });
  const ok = async (...args) => { const response = await http(...args); assert.equal(response.statusCode, 200, response.body); return response.json(); };
  const proof = (label, value) => fs.writeFileSync(path.join(proofDirectory, label + '.json'), JSON.stringify(value, null, 2) + '\n');
  return { app, pool, I, G, D, Delivery, Economy, E, P, players, tokens, depot, get order() { return order; }, key,
    single, pair, balance, create, fund, commitment, accept, claim, deliver, restock, snapshot, same, books, http, ok, proof,
    close: () => app.close() };
}
