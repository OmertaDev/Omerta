// Opt-in native PostgreSQL conformance. No real signer, wallet, RPC or application boot.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const address = '0x' + '12'.repeat(20);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function target(raw) {
  assert(typeof raw === 'string' && raw.length > 0, 'Explicit WITHDRAW_RESERVE_TEST_ADMIN_URL required');
  const url = new URL(raw);
  assert(['postgres:', 'postgresql:'].includes(url.protocol), 'PostgreSQL protocol required');
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Loopback test server required');
  assert(url.port && url.port !== '5432', 'Explicit nondefault test port required');
  assert(url.pathname === '/postgres' && !url.search && !url.hash, 'Dedicated cluster control database required');
  return url;
}
function preflight() {
  target('postgresql://synthetic@127.0.0.1:35459/postgres');
  const refused = [undefined, '', 'https://localhost:35459/postgres', 'postgresql://example.com:35459/postgres',
    'postgresql://localhost/postgres', 'postgresql://localhost:5432/postgres',
    'postgresql://localhost:35459/omerta', 'postgresql://localhost:35459/postgres?options=unsafe'];
  for (const value of refused) assert.throws(() => target(value));
  console.log(JSON.stringify({complete: true, scope: 'HOST target guards only', controls: 1,
    refusals: refused.length, pgImported: false, databaseConnections: 0, nativeCasesExecuted: false}));
}
function productionBody(source, name) {
  const match = new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, 'm').exec(source);
  assert(match, 'Required production function missing');
  const end = source.indexOf('\n}', match.index);
  assert(end > match.index, 'Production function boundary missing');
  return source.slice(match.index, end + 2).replace(/^export /, '');
}
function productionTable(schema, name) {
  const sql = new RegExp(`CREATE TABLE IF NOT EXISTS ${name}\\s*\\([\\s\\S]*?\\n\\);`).exec(schema)?.[0];
  assert(sql, 'Required production table definition missing');
  return sql;
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
}
async function bounded(promise, ms, message) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })]); }
  finally { clearTimeout(timer); }
}
class GameError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

async function native() {
  assert(process.argv.includes('--postgres'), 'Explicit --postgres required');
  const endpoint = target(process.env.WITHDRAW_RESERVE_TEST_ADMIN_URL);
  const outputArg = process.argv.find(value => value.startsWith('--output='))?.slice(9);
  assert(outputArg, 'Fresh explicit --output directory required');
  const output = path.resolve(outputArg);
  // Public dependency routes only. No fallback to a different checkout or pg-mem.
  const {default: pg} = await import('pg');
  const {planOwnedWorldDatabase} = await import('../tools/rc1-native-database.js');
  const lock = JSON.parse(await fs.readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const numericParser = pg.types.getTypeParser(1700, 'text');
  assert.equal(numericParser('8589934592.000001'), '8589934592.000001', 'Default NUMERIC text parser required');
  assert.equal(numericParser('9007199254740993.000001'), '9007199254740993.000001', 'Exact NUMERIC parser required');
  const source = await fs.readFile(new URL('../src/chain.js', import.meta.url), 'utf8');
  const schema = await fs.readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8', windowsHide: true}).trim();
  const runId = 'withdraw-reserve-' + crypto.randomBytes(8).toString('hex');
  const database = planOwnedWorldDatabase({controlUrl: endpoint.href, runId, sourceRevision});
  await fs.mkdir(output, {recursive: false});
  const artifact = async (name, value) => fs.writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
  const cases = [], numericObservations = [], lockObservations = [], pools = [];
  let creationAttempted = false, created = false, closed = null, failure = null, snapshot = null;
  const safeFailure = error => {
    const code = error?.code;
    return {category: error instanceof assert.AssertionError ? 'assertion_failed' : 'native_test_failed',
      code: ['ECONNREFUSED', 'ETIMEDOUT', '28P01', '55P03', '57014'].includes(code) ? code : 'test_failed'};
  };
  await artifact('source.json', {format: 1, sourceRevision, sourceSha256: hash(source), schemaSha256: hash(schema),
    testSha256: hash(await fs.readFile(fileURLToPath(import.meta.url))),
    leaseToolSha256: hash(await fs.readFile(new URL('../tools/rc1-native-database.js', import.meta.url))),
    pgLockVersion: lock.packages['node_modules/pg'].version,
    pgLockIntegrity: lock.packages['node_modules/pg'].integrity,
    database: database.descriptor, actualSigning: false, completeApplicationSchema: false,
    scope: 'Exact production function bodies and three production table definitions; fake ledger/toll/signer boundaries'});
  try {
    creationAttempted = true; await database.create(); created = true;
    const pool = new pg.Pool({connectionString: database.url, max: 6,
      options: '-c statement_timeout=10000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=15000'});
    const observer = new pg.Pool({connectionString: database.url, max: 1,
      options: '-c statement_timeout=10000'});
    pools.push(pool, observer);
    for (const name of ['account_persistent', 'vouchers', 'chain_reserve']) await pool.query(productionTable(schema, name));
    const profile = (await pool.query('SELECT version() AS version, current_database() AS database')).rows[0];
    assert.equal(profile.database, database.descriptor.name);
    await artifact('postgres.json', profile);
    async function seed(funded = '1', historical = []) {
      await pool.query('TRUNCATE vouchers, account_persistent, chain_reserve');
      await pool.query('INSERT INTO chain_reserve(id,funded_omr,next_nonce) VALUES(1,$1,1)', [funded]);
      for (const id of ['synthetic-a', 'synthetic-b']) {
        await pool.query('INSERT INTO account_persistent(account_id,omr,minted,wallet_address) VALUES($1,10,true,$2)', [id, address]);
      }
      for (const [index, row] of historical.entries()) await pool.query(
        'INSERT INTO vouchers(id,account_id,kind,amount,nonce,to_address,deadline,status,claimed_onchain) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        ['historical-' + index, 'synthetic-a', 'omr', row.amount, 1000 + index, address, 1900000000, row.status, row.claimed]);
    }
    snapshot = async () => ({
      accounts: (await pool.query('SELECT account_id,omr::text FROM account_persistent ORDER BY account_id')).rows,
      reserve: (await pool.query('SELECT id,funded_omr::text,next_nonce::text FROM chain_reserve ORDER BY id')).rows,
      vouchers: (await pool.query('SELECT id,account_id,amount::text,nonce::text,status,claimed_onchain FROM vouchers ORDER BY id')).rows
    });
    function application({hold = false, failSigner = false} = {}) {
      const entered = deferred(), release = deferred(), connections = [], signs = [];
      let connected = 0;
      const wrappedPool = {async connect() {
        const client = await pool.connect(); connected++; connections.push(client.processID);
        return {release: () => client.release(), async query(sql, params) {
          const result = await client.query(sql, params);
          if (sql.startsWith('SELECT COALESCE(SUM(amount),0)')) {
            assert.equal(result.fields[0].dataTypeID, 1700);
            assert.equal(typeof result.rows[0].s, 'string');
            numericObservations.push({oid: 1700, type: typeof result.rows[0].s, value: result.rows[0].s});
          }
          if (sql === 'SELECT * FROM chain_reserve WHERE id=1 FOR UPDATE') assert.equal(typeof result.rows[0].funded_omr, 'string');
          return result;
        }};
      }};
      const context = vm.createContext({GameError, process: {env: Object.freeze({})}, WITHDRAW_TTL_SEC: 86400,
        Date: {now: () => 1700000000000}, withdrawTaxBps: () => 0,
        earlySurcharge: async () => ({surcharge: 0, freshSold: 0}), splitToll: () => ({devCut: 0, buyCut: 0}),
        ledger: async () => {}, creditTollBuckets: async () => {},
        isAddress: value => value === address, getAddress: value => value, uid: () => crypto.randomUUID(),
        signVoucher: async row => {
          signs.push({id: row.id, amount: String(row.amount), recipient: row.to_address}); entered.resolve();
          if (hold) await release.promise;
          if (failSigner) throw new GameError('synthetic_signer_refusal', 'Synthetic signer refusal');
          return {voucher: {amount: String(row.amount)}, signature: 'synthetic-only'};
        }});
      vm.runInContext(['reserveMicros', 'committedOutstanding', 'requestWithdraw', 'drainQueue']
        .map(name => productionBody(source, name)).join('\n')
        + '\nglobalThis.production={requestWithdraw,drainQueue};', context, {timeout: 1000});
      return {connections, signs, entered, release, count: () => connected,
        request: account => context.production.requestWithdraw(wrappedPool, account, 1, address),
        drain: options => context.production.drainQueue(wrappedPool, options)};
    }
    async function record(name, work) { await work(); cases.push({name, outcome: 'PASS', state: await snapshot()}); console.log('PASS ' + name); }
    await record('actual NUMERIC retains exact decimal text above2^53', async () => {
      await seed('9007199254740993.000001');
      const row = (await pool.query('SELECT funded_omr FROM chain_reserve WHERE id=1')).rows[0];
      assert.equal(typeof row.funded_omr, 'string');
      assert.equal(row.funded_omr, '9007199254740993.000001');
    });
    await record('two accounts serialize at the reserve row: one signs and one queues', async () => {
      await seed(); const app = application({hold: true}), owned = [];
      try {
        owned.push(app.request('synthetic-a').then(value => ({value}), error => ({error})));
        await bounded(app.entered.promise, 5000, 'First request did not reach the signer seam');
        owned.push(app.request('synthetic-b').then(value => ({value}), error => ({error})));
        const deadline = Date.now() + 5000; let observed = false;
        while (Date.now() < deadline) {
          if (app.connections[1]) {
            const row = (await observer.query('SELECT wait_event_type,wait_event FROM pg_stat_activity WHERE pid=$1 AND datname=$2',
              [app.connections[1], database.descriptor.name])).rows[0];
            if (row?.wait_event_type === 'Lock') { lockObservations.push({pid: app.connections[1], ...row}); observed = true; break; }
          }
          await pause(20);
        }
        assert(observed, 'Second owned PostgreSQL backend must have an observed lock wait');
        app.release.resolve();
        const results = await Promise.all(owned);
        assert(results.every(row => !row.error), 'Both owned requests must complete successfully');
        assert.deepEqual(results.map(row => row.value.status).sort(), ['queued', 'signed']);
        assert.equal(app.signs.length, 1);
        const state = await snapshot();
        assert.deepEqual(state.accounts.map(row => row.omr), ['9', '9']);
        assert.equal(state.reserve[0].next_nonce, '3');
        assert.equal(state.vouchers.filter(row => row.status === 'signed').length, 1);
      } finally { app.release.resolve(); await Promise.allSettled(owned); }
    });
    await record('a claimed liability never frees cumulative signing capacity', async () => {
      await seed('1', [{amount: '1', status: 'claimed', claimed: true}]);
      const app = application();
      assert.equal((await app.request('synthetic-a')).status, 'queued');
      assert.equal((await app.drain()).signed, 0);
      assert.equal(app.signs.length, 0);
    });
    await record('one-micro short queues while an exact cumulative fit signs', async () => {
      for (const [committed, expected] of [['99999999999.000001', 'queued'], ['99999999999.000000', 'signed']]) {
        await seed('100000000000.000000', [{amount: committed, status: 'signed', claimed: false}]);
        const app = application();
        assert.equal((await app.request('synthetic-a')).status, expected);
        assert.equal(app.signs.length, expected === 'signed' ? 1 : 0);
      }
    });
    await record('signer refusal rolls back actual account debit and nonce without inserting a voucher', async () => {
      await seed(); const before = await snapshot(), app = application({failSigner: true});
      await assert.rejects(app.request('synthetic-a'), error => error.code === 'synthetic_signer_refusal');
      assert.equal(app.signs.length, 1);
      assert.deepEqual(await snapshot(), before);
    });
    await record('FIFO queue and physical claim cap retain exact NUMERIC behavior', async () => {
      await seed('10', [{amount: '1', status: 'signed', claimed: false}]);
      await pool.query("INSERT INTO vouchers(id,account_id,kind,amount,nonce,to_address,deadline,status) VALUES('queued','synthetic-b','omr',1,2000,$1,1900000000,'queued')", [address]);
      await pool.query("INSERT INTO vouchers(id,account_id,kind,amount,nonce,to_address,deadline,status) VALUES('queued-later','synthetic-b','omr',1,2001,$1,1900000000,'queued')", [address]);
      const app = application();
      assert.equal((await app.drain({maxLiveClaimWei: 1999999999999999999n})).signed, 0);
      assert.equal(app.signs.length, 0);
      assert.equal((await app.drain({maxLiveClaimWei: 2000000000000000000n})).signed, 1);
      assert.equal(app.signs.length, 1);
      assert.equal(app.signs[0].id, 'queued');
      const statuses = (await pool.query("SELECT id,status FROM vouchers WHERE id IN ('queued','queued-later') ORDER BY id")).rows;
      assert.deepEqual(statuses, [{id: 'queued', status: 'signed'}, {id: 'queued-later', status: 'queued'}]);
    });
    await artifact('cases.json', {complete: true, cases, numericObservations, lockObservations,
      numericParserIdentityUnchanged: pg.types.getTypeParser(1700, 'text') === numericParser,
      noNumericParserOverrideInstalledByTest: true,
      actualSignatures: 0, RPC: false, fullApplicationOrLedgerRollbackQualified: false});
    assert.equal(pg.types.getTypeParser(1700, 'text'), numericParser);
  } catch (error) {
    failure = safeFailure(error);
    let failureState = null;
    if (snapshot) { try { failureState = await snapshot(); } catch {} }
    await artifact('failure.json', {complete: false, ...failure, cases, failureState, numericObservations, lockObservations});
  } finally {
    const ended = await Promise.allSettled(pools.map(pool => pool.end()));
    const allOwnPoolsEnded = ended.every(result => result.status === 'fulfilled');
    if (!allOwnPoolsEnded) failure ||= {category: 'owned_pool_cleanup_failed', code: 'test_failed'};
    if (creationAttempted) {
      try { closed = await database.close(); }
      catch { failure ||= {category: 'owned_database_cleanup_failed', code: 'test_failed'}; }
    }
    await artifact('terminal.json', {complete: !failure, databaseCreationAttempted: creationAttempted,
      databaseCreationCompleted: created, databaseClosed: closed,
      allOwnPoolsEnded, noForeignBackendTermination: true, casesPassed: cases.length, failure,
      scope: 'Native three-table/function-body conformance only; fake signer/toll/ledger, no activation authority'});
  }
  if (failure) throw new Error('Native conformance or owned database cleanup failed');
  console.log(JSON.stringify({complete: true, cases: cases.length, databaseClosed: closed?.closed === true,
    actualSignatures: 0, RPC: false, production: false}));
}

try {
  if (process.argv.includes('--preflight')) {
    assert(!process.argv.includes('--postgres'), 'Preflight cannot request PostgreSQL'); preflight();
  } else await native();
} catch {
  console.error('chain-reserve-precision-postgres: FAIL; inspect retained sanitized test metadata if created');
  process.exitCode = 1;
}
