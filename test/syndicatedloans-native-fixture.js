import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export function nativeEndpoint(argv = process.argv.slice(2), env = process.env, execArgv = process.execArgv) {
  assert.deepEqual(argv, ['--postgres'], 'N22 native: exact --postgres required before connect');
  assert.deepEqual(execArgv, [], 'N22 native: CLI loaders/preloads refused before connect');
  assert(!env.DATABASE_URL && !env.NODE_OPTIONS && !env.NODE_PATH, 'N22 native: ambient/preload refused before connect');
  assert(!Object.keys(env).some(key => /^PG[A-Z_]/i.test(key) && env[key]), 'N22 native: ambient PG refused before connect');
  assert(!Object.keys(env).some(key => /DATABASE_URL$/i.test(key) && key !== 'SYNDICATED_LOAN_NATIVE_DATABASE_URL' && env[key]),
    'N22 native: unrelated database target refused before connect');
  const url = new URL(env.SYNDICATED_LOAN_NATIVE_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(url.protocol), 'N22 native: protocol refused before connect');
  assert.equal(url.hostname, '127.0.0.1', 'N22 native: host refused before connect');
  assert(!url.search && !url.hash, 'N22 native: URL options refused before connect');
  assert.match(url.pathname, /^\/syndicated_loan_native_[a-f0-9]{12}$/, 'N22 native: fresh owned database name required before connect');
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && !url.password;
  const ci = env.CI === 'true' && url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci, 'N22 native: exact local/CI authority refused before connect');
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
      AND c.relkind IN ('r','p','S','v','m','f')`)).rows[0].n, 0, 'N22 native: database must be genuinely empty');
    assert.equal((await client.query(`SELECT COUNT(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'`)).rows[0].n, 0);
    await client.query('ROLLBACK'); return { ...endpoint, identity };
  } finally { await client.end(); }
}

// Observes or fails actual native writes; never substitutes a result or actor.
export function observedPool(pool, intercept, before) {
  const observed = Object.create(pool); observed.query = pool.query.bind(pool);
  observed.connect = async () => {
    const client = await pool.connect();
    return new Proxy(client, { get(target, name) {
      if (name === 'query') return async (...args) => {
        const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text;
        if (before) await before(target, sql, args[1]);
        const result = await target.query(...args);
        await intercept(target, sql, args[1], result); return result;
      };
      const value = Reflect.get(target, name); return typeof value === 'function' ? value.bind(target) : value;
    } });
  };
  return observed;
}

export async function nativeFixture() {
  const backend = await admission(), proofDirectory = process.env.SYNDICATED_LOAN_NATIVE_PROOFS;
  assert(path.isAbsolute(proofDirectory)); fs.mkdirSync(proofDirectory);
  const proof = (label, value) => fs.writeFileSync(path.join(proofDirectory, label + '.json'), JSON.stringify(value, null, 2) + '\n');
  proof('admission', { ...backend.identity, native: true, fresh: true });
  process.env.DATABASE_URL = backend.url.href; delete process.env.LEGAL_PROFILE_DEFER;
  Object.assign(process.env, { RESOURCE_ECONOMY: 'off', CHAIN_ENABLED: 'off', DEPOT_PILOT: 'on', RATE_LIMIT: 'off',
    INVITE_MODE: 'off', SOCIAL_VERIFY_MODE: 'off', JWT_SECRET: 'syndicated-native-fixture-only',
    MARKET_SEED: 'syndicated-native-fixture-seed', MOD_KEY: 'syndicated-native-fixture-only',
    LEGAL_OPERATOR_NAME: 'CI Test Operator', LEGAL_POSTAL_ADDRESS: '123 Fixture Street, Test City',
    PRIVACY_CONTACT_EMAIL: 'privacy@example.test', DMCA_AGENT_NAME: 'CI Test Agent', DMCA_AGENT_EMAIL: 'copyright@example.test',
    DMCA_AGENT_ADDRESS: '123 Fixture Street, Test City', DMCA_AGENT_PHONE: '+1 202 555 0100', DMCA_AGENT_REGISTERED: 'true',
    PAYMENT_REFUND_POLICY: 'Test fixture policy; not a production policy.' });
  const { buildServer } = await import('../src/server.js'), app = await buildServer(), pool = app.pool;
  const G = await import('../src/game.js'), S = await import('../src/syndicatedloans.js'), Loans = await import('../src/loans.js');
  const I = await import('../src/items.js'), R = await import('../src/equipmentrentals.js'), Rules = await import('../src/rules.js');
  assert.equal(G.syndicatedLoanDispatch, S.executeSyndicatedLoanAction);
  assert.equal(R.syndicatedLoanSource, S.syndicatedLoanScopeSource); assert.equal(Loans.syndicatedLoanGuard, S.assertSyndicatedLoanMutation);
  assert.equal(Rules.LOAN.MAX_ACTIVE, 1);
  const players = {}, tokens = {};
  for (const account of ['borrower', 'lenderA', 'lenderB', 'foreign', 'customer']) {
    await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)', [account, 'syndicated-native-fixture']);
    await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$1,1,'foundry',10000,100000)", [account + '-actor', account]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
    await G.ledger(pool, { characterId: account + '-actor', currency: 'cash', amount: 99500, reason: 'crime:syndicated_fixture' });
    players[account] = { id: account + '-actor', account };
    tokens[account] = { human: app.jwt.sign({ sub: account, tv: 0 }), agent: app.jwt.sign({ sub: account, tv: 0, agent: true }) };
  }
  let serial = 0; const key = label => 'N22-native-' + label + '-' + ++serial;
  const single = (account, fn, database = pool) => G.withCharacter(database, account, fn);
  const pair = (account, other, fn, database = pool) => G.withTwoCharacters(database, account, players[other]?.id || other, fn, { meet: false });
  const balance = async account => Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [players[account]?.id || account])).rows[0].cash);
  const proposalBody = (options = {}) => ({ lenderCharacters: [players.lenderA.id, players.lenderB.id].sort(), principalPerLender: 5000,
    rateBps: 1000, termHours: 1, expiresInSeconds: options.seconds ?? 600, consent: true });
  const current = receipt => ({ facilityId: receipt.facility.id, termsHash: receipt.facility.termsHash, consent: true });
  const action = (account, verb, receipt, requestKey = key(verb), database = pool) => S.createSyndicatedLoanRuntime({ pool: database }).action(account, verb, current(receipt), requestKey);
  const propose = (options = {}, database = pool) => S.createSyndicatedLoanRuntime({ pool: database }).action('borrower', 'propose', proposalBody(options), options.key || key('propose'));
  const http = (account, verb, body, requestKey = key('http'), agent = false) => app.inject({ method: body === undefined ? 'GET' : 'POST',
    url: '/v1/company/syndicated-loans' + (verb ? '/' + verb : ''), payload: body,
    headers: account ? { authorization: 'Bearer ' + tokens[account][agent ? 'agent' : 'human'], 'idempotency-key': requestKey } : {} });
  const ok = async (...args) => { const response = await http(...args); assert.equal(response.statusCode, 200, response.body); return response.json(); };
  const { canonicalDatabaseSnapshot } = await import('../tools/rc1-native-proof.js');
  const snapshot = async label => { const result = await canonicalDatabaseSnapshot(pool); proof(label, result); return result; };
  const same = (before, after) => { assert.deepEqual(after.tables, before.tables); assert.deepEqual(after.sequences, before.sequences); assert.equal(after.stateSha256, before.stateSha256); };
  const books = async () => { assert.deepEqual(await S.collectSyndicatedLoanIssues(pool), []);
    const result = await (await import('../src/invariants.js')).runLedgerInvariants(pool, { alert: false }); assert.equal(result.ok, true, JSON.stringify(result.checks?.filter(row => !row.ok))); };
  const waitForLock = async () => { const until = Date.now() + 5000;
    while (Date.now() < until) { const rows = (await pool.query("SELECT pid,wait_event FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' ORDER BY pid")).rows;
      if (rows.length) return rows; await new Promise(resolve => setTimeout(resolve, 10)); }
    throw Error('N22 native: genuine competing original never reached an actual database lock'); };
  return { app, pool, G, S, Loans, I, R, Rules, players, tokens, key, single, pair, balance, proposalBody, current, action, propose, http, ok,
    snapshot, same, books, proof, waitForLock, close: async () => { try { await app.close(); } finally { await pool.end(); } } };
}
