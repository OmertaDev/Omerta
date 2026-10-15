import assert from 'node:assert/strict';

export async function manufacturingLicenseNativeBackend() {
  assert.deepEqual(process.argv.slice(2), ['--postgres'], 'Explicit native invocation only');
  assert(!process.env.DATABASE_URL, 'Reject an ambient database endpoint');
  assert(!process.env.NODE_OPTIONS && !process.env.NODE_PATH, 'Reject preloads and module overrides');
  assert(!Object.keys(process.env).some(key => /^PG[A-Z_]/.test(key) && process.env[key]), 'Reject ambient PostgreSQL overrides');
  const url = new URL(process.env.MANUFACTURING_LICENSE_NATIVE_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.hostname, '127.0.0.1');
  assert(!url.search && !url.hash);
  assert.match(url.pathname, /^\/manufacturing_license_native_test_[a-f0-9]{12}$/);
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci, 'Only the exact owned local or CI backend is permitted');
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url.href });
  let version;
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const row = (await client.query(`SELECT current_user AS role,current_database() AS database,
      pg_get_userbyid(datdba) AS owner,current_setting('server_version') AS version
      FROM pg_database WHERE datname=current_database()`)).rows[0];
    assert.equal(row.role, url.username);
    assert.equal(row.owner, url.username);
    assert.equal(row.database, url.pathname.slice(1));
    assert.match(row.version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    version = row.version;
    if (local) {
      const datadir = (await client.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\', '/').toLowerCase();
      assert.equal(datadir, url.port === '35439'
        ? 'c:/users/jorge/appdata/local/temp/omerta-economy-oct15-pg184'
        : 'c:/users/jorge/appdata/local/temp/omerta-employment-pg184-proof');
    }
    assert.equal((await client.query(`SELECT COUNT(*)::int AS n FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m','f')`)).rows[0].n, 0,
    'Require a fresh owned namespace including sequences and views');
    await client.query('ROLLBACK');
  } finally { await client.end(); }
  process.env.DATABASE_URL = url.href;
  return { native: true, version };
}

export async function nativeFixture() {
  const backend = await manufacturingLicenseNativeBackend();
  Object.assign(process.env, {
    RESOURCE_ECONOMY: 'off', RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', INVITE_MODE: 'off', DEPOT_PILOT: 'on',
    JWT_SECRET: 'manufacturing-license-native-fixture-only', MARKET_SEED: 'manufacturing-license-native-fixture-only',
    MOD_KEY: 'manufacturing-license-native-fixture-only', LEGAL_OPERATOR_NAME: 'CI Test Operator',
    LEGAL_POSTAL_ADDRESS: '123 Fixture Street, Test City', PRIVACY_CONTACT_EMAIL: 'privacy@example.test',
    DMCA_AGENT_NAME: 'CI Test Agent', DMCA_AGENT_EMAIL: 'copyright@example.test',
    DMCA_AGENT_ADDRESS: '123 Fixture Street, Test City', DMCA_AGENT_PHONE: '+1 202 555 0100',
    DMCA_AGENT_REGISTERED: 'true', PAYMENT_REFUND_POLICY: 'Test fixture policy; not a production policy.'
  });
  const { buildServer } = await import('./server-fixture.js');
  const app = await buildServer(), pool = app.pool;
  try {
    const { dbCaps } = await import('../src/db.js');
    assert.equal(dbCaps.skipLocked, true, 'Actual PostgreSQL backend is required');
    const present = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'
      AND table_name IN ('manufacturing_licenses','manufacturing_license_requests') ORDER BY table_name`)).rows.map(row => row.table_name);
    assert.deepEqual(present, ['manufacturing_license_requests', 'manufacturing_licenses'], 'Use real integrated DDL; install no fixture DDL');
    const G = await import('../src/game.js'), I = await import('../src/items.js');
    const M = await import('../src/manufacturinglicenses.js'), A = await import('../src/manufacturinglicensesinvariants.js');
    const { canonicalDatabaseSnapshot } = await import('../tools/rc1-native-proof.js');
    let serial = 0;
    const base = '/v1/company/manufacturing-licenses';
    const key = label => 'license-native-' + label + '-' + ++serial;
    const call = (person, method, url, body, requestKey = key('http'), agent = false) => app.inject({
      method, url, payload: body, headers: {
        ...(person ? { authorization: 'Bearer ' + (agent ? person.agent : person.token) } : {}),
        ...(requestKey ? { 'idempotency-key': requestKey } : {})
      }
    });
    const ok = async (...args) => {
      const result = await call(...args);
      assert.equal(result.statusCode, 200, result.body);
      return result.json();
    };
    const catalog = await ok(null, 'GET', '/v1/resources/catalog');
    assert.equal(catalog.enabled, false);
    assert.deepEqual(catalog.capabilities, []);
    const ref = receipt => ({ licenseId: receipt.licenseId, sourceHash: receipt.sourceHash });
    const action = async (person, kind, body, requestKey = key(kind), agent = false) => {
      const result = await ok(person, 'POST', base + '/' + kind, body, requestKey, agent);
      assert(!Object.hasOwn(result, 'royaltyAudit'), 'Private royalty proof remains internal');
      return result;
    };
    async function player() {
      const person = { token: (await ok(null, 'POST', '/v1/auth/guest')).token };
      await ok(person, 'POST', '/v1/character', { name: 'Native License ' + ++serial });
      person.account = app.jwt.verify(person.token).sub;
      const original = (await pool.query('SELECT id,cash,bank FROM characters WHERE account_id=$1 AND alive=true', [person.account])).rows[0];
      person.id = original.id;
      // Explicit balanced fixture endowment, not earned revenue or crypto backing.
      await pool.query("UPDATE characters SET cash=100000,bank=0,loc='foundry',respect=10000 WHERE id=$1", [person.id]);
      await G.ledger(pool, { characterId: person.id, currency: 'cash',
        amount: 100000 - Number(original.cash) - Number(original.bank), reason: 'crime:manufacturing_license_native_fixture' });
      await pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network') ON CONFLICT DO NOTHING", [person.id]);
      await ok(person, 'POST', '/v1/resources/company', { expectedRevision: 0, name: 'Native Factory ' + serial, published: false, premises: null });
      person.business = (await ok(person, 'POST', '/v1/depot', { salePrice: 1000, bidPrice: 500, targetStock: 2, reorderAt: 0, restockBudget: 2000 })).id;
      person.agent = (await ok(person, 'POST', '/v1/auth/agent-key')).token;
      assert.equal(app.jwt.verify(person.agent).agent, true);
      return person;
    }
    async function materials(person) {
      const random = Math.random;
      let boosted;
      try { Math.random = () => 0.001; boosted = await ok(person, 'POST', '/v1/garage/boost', {}); }
      finally { Math.random = random; }
      assert(boosted.success);
      assert.equal(boosted.car.model, 'junker');
      await ok(person, 'POST', '/v1/worldgraph/recipes/recipe:car_salvage_basic/salvage/' + boosted.car.id, {});
      await ok(person, 'POST', '/v1/company/production/run', { businessId: person.business, steps: [{ recipeId: 'recipe:hardened_steel', repeat: 1 }] });
    }
    async function productionSource(person) {
      await materials(person);
      const productionKey = key('actual-prior-production');
      const production = await ok(person, 'POST', '/v1/company/production/run',
        { businessId: person.business, steps: [{ recipeId: 'recipe:precision_lock_tool', repeat: 1 }] }, productionKey);
      assert.equal(production.totalCrafts, 1);
      return { productionKey, production };
    }
    const publish = (owner, buyer, source, options = {}) => action(owner, 'publish', {
      businessId: owner.business, productionKey: source.productionKey, licenseeCharacterId: buyer.id,
      feeCash: 25, maximumRuns: 2, lifetimeSeconds: 3600, ...options, consent: true
    });
    const rows = async () => {
      const result = {};
      for (const table of ['characters', 'transactions', 'item_instances', 'item_stacks', 'item_events', 'item_mutation_guards',
        'item_mutation_inputs', 'item_mutation_outputs', 'operation_escrow', 'item_durability_states',
        'company_production_receipts', 'company_specialization_runs', 'manufacturing_licenses', 'manufacturing_license_requests']) {
        result[table] = (await pool.query('SELECT * FROM ' + table)).rows.map(row => JSON.stringify(row)).sort();
      }
      return result;
    };
    const snapshot = () => canonicalDatabaseSnapshot(pool);
    const readOnly = { query(sql, ...args) { assert.match(sql, /^SELECT\b/); return pool.query(sql, ...args); } };
    const books = async () => {
      assert.deepEqual(await A.collectManufacturingLicenseIssues(readOnly), []);
      const { runLedgerInvariants } = await import('../src/invariants.js');
      assert.deepEqual((await runLedgerInvariants(pool, { alert: false })).checks.filter(check => !check.ok), []);
    };
    return { backend, app, pool, G, I, M, A, base, key, call, ok, ref, action, player, materials, productionSource, publish, rows, snapshot, readOnly, books };
  } catch (error) { await app.close(); throw error; }
}

export function observePool(pool, afterQuery) {
  const observed = Object.create(pool);
  observed.query = pool.query.bind(pool);
  observed.connect = async () => {
    const client = await pool.connect();
    return new Proxy(client, {
      get(target, name) {
        if (name === 'query') return async (...args) => {
          const result = await target.query(...args);
          const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text;
          await afterQuery(target, sql, args[1], result);
          return result;
        };
        const value = Reflect.get(target, name);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
  };
  return observed;
}

export function observeCraftInsert(attempts, sql, parameters, result) {
  if (!/^\s*INSERT INTO item_events\b/.test(sql || '')) return;
  assert.equal(result.rowCount, 1, 'One actual appendEvent insertion per observed allocator attempt');
  attempts.push({ eventKey: parameters[1], eventKind: parameters[2], templateId: parameters[5],
    quantityDelta: parameters[7], mutationKey: parameters[15] });
}

export function assertAttemptedCraftEvents(attempts) {
  assert.equal(attempts.length, 3, 'Actual one-tool craft attempted precisely two stack-consumption events and one creation event');
  assert.deepEqual(attempts.map(row => [row.eventKind, row.templateId, row.quantityDelta]).sort(), [
    ['created', 'item:precision_lock_tool', null],
    ['stack_consumed', 'mat:hardened_steel', -1],
    ['stack_consumed', 'mat:salvage_parts', -2]
  ].sort());
  assert.equal(new Set(attempts.map(row => row.eventKey)).size, 3);
  assert.equal(new Set(attempts.map(row => row.mutationKey)).size, 1);
  assert.match(attempts[0].mutationKey, /^company-production:[a-f0-9-]+:0$/);
}

export function assertNativeCraftRollback(before, after, attempts) {
  assertAttemptedCraftEvents(attempts);
  assert.deepEqual(after.tables, before.tables, 'Every canonical native table rolls back');
  assert(before.sequences.some(row => row.sequencename === 'item_events_sequence_seq' && row.last_value != null));
  assert.deepEqual(after.sequences, before.sequences.map(row => row.sequencename === 'item_events_sequence_seq'
    ? { ...row, last_value: String(BigInt(row.last_value) + 3n) } : row),
  'Only the exact three observed nontransactional item-event allocator attempts survive rollback');
}

export function assertMetadataOnlyCancellation(before, after, licenseId, originalAccount, requestKey) {
  for (const [table, values] of Object.entries(before.tables)) {
    if (!['manufacturing_licenses', 'manufacturing_license_requests'].includes(table)) assert.deepEqual(after.tables[table], values, table);
  }
  const expected = before.tables.manufacturing_licenses.map(text => {
    const row = JSON.parse(text);
    return row.id === licenseId ? { ...row, status: 'cancelled' } : row;
  }).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(after.tables.manufacturing_licenses.map(JSON.parse).sort((a, b) => a.id.localeCompare(b.id)), expected);
  const priorRequests = new Set(before.tables.manufacturing_license_requests);
  assert.equal(after.tables.manufacturing_license_requests.length, priorRequests.size + 1);
  for (const prior of priorRequests) assert(after.tables.manufacturing_license_requests.includes(prior));
  const additions = after.tables.manufacturing_license_requests.filter(text => !priorRequests.has(text)).map(JSON.parse);
  assert.equal(additions.length, 1);
  assert.equal(additions[0].account_id, originalAccount);
  assert.equal(additions[0].request_key, requestKey);
  assert.deepEqual(after.sequences, before.sequences, 'Metadata recovery attempts no item allocator');
}
