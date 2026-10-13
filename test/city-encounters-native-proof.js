// Actual HTTP/transaction proofs. Native mode owns one fresh schema on an explicit loopback test DB.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const postgres = process.argv.includes('--postgres'), memory = process.argv.includes('--memory');
assert(postgres !== memory, 'Choose --postgres for native qualification or --memory for bounded fixture verification.');
let admin, namespace, app, ownsSchema = false;
for (const key of ['JWT_SECRET', 'MOD_KEY', 'MARKET_SEED']) process.env[key] = crypto.randomBytes(32).toString('hex');
Object.assign(process.env, { INVITE_MODE: 'off', RATE_LIMIT: 'off', POPULATION_OFF: 'on', CORE_PROGRESSION: 'off', SOCIAL_VERIFY_MODE: 'off' });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const bounded = (promise, label) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error('Timed out waiting for ' + label)), 30000);
  promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});
try {
  if (postgres) {
    assert.equal(typeof process.env.CITY_ENCOUNTERS_TEST_DATABASE_URL, 'string', 'Set the explicit disposable native fixture URL.');
    let endpoint;
    try { endpoint = new URL(process.env.CITY_ENCOUNTERS_TEST_DATABASE_URL); } catch { assert.fail('The native fixture URL is invalid.'); }
    assert(!endpoint.search && !endpoint.hash, 'Fixture URLs cannot override driver host or connection options');
    assert(['postgres:', 'postgresql:'].includes(endpoint.protocol));
    assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname), 'Native fixtures must use loopback.');
    assert(/^\/(?:omerta_query|omerta_check|city_encounters_[a-z0-9_]+)$/.test(endpoint.pathname), 'Use a named disposable test database.');
    const { Pool } = await import('pg'); admin = new Pool({ connectionString: endpoint.toString() });
    namespace = 'city_encounters_' + crypto.randomBytes(8).toString('hex');
    await admin.query('CREATE SCHEMA ' + namespace); ownsSchema = true;
    endpoint.searchParams.set('options', '-c search_path=' + namespace); process.env.DATABASE_URL = endpoint.toString();
  } else assert(!process.env.DATABASE_URL, 'Memory fixture verification requires disposable pg-mem.');
  const { buildServer } = await import('../src/server.js'); app = await buildServer();
  if (postgres) {
    const actual = (await app.pool.query('SELECT current_schema() AS schema,version() AS version')).rows[0];
    assert.equal(actual.schema, namespace); assert.match(actual.version, /^PostgreSQL /);
    console.log('Native encounter fixture:', actual.version.split(' on ')[0]);
  }
  const call = (actor, method, path, body, key = crypto.randomUUID()) => app.inject({ method, url: path,
    ...(body === undefined ? {} : { payload: body }), headers: { ...(actor?.headers || {}), ...(method === 'POST' ? { 'idempotency-key': key } : {}) } });
  const ok = response => { assert.equal(response.statusCode, 200, response.body); return response.json(); };
  const player = async name => {
    const guest = ok(await call(null, 'POST', '/v1/auth/guest', { birthDate: '1990-01-01' }));
    const account = app.jwt.verify(guest.token).sub, headers = { authorization: 'Bearer ' + guest.token };
    ok(await call({ headers }, 'POST', '/v1/character', { name }));
    const row = (await app.pool.query('SELECT id,generation,loc FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
    await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1', [row.id, new Date(Date.now() + 86400000)]);
    return { ...row, account, headers };
  };
  const board = async actor => ok(await call(actor, 'GET', '/v1/city/encounters'));
  const send = (actor, action, key) => call(actor, action.method, action.path, action.body, key);
  const snapshot = async actor => ({
    character: (await app.pool.query('SELECT cash,bank,health,respect,energy,nerve,heat,ammo FROM characters WHERE id=$1', [actor.id])).rows[0],
    account: (await app.pool.query('SELECT omr FROM account_persistent WHERE account_id=$1', [actor.account])).rows[0],
    ledger: Number((await app.pool.query('SELECT count(*) n FROM transactions WHERE character_id=$1 OR account_id=$2', [actor.id, actor.account])).rows[0].n),
    items: Number((await app.pool.query("SELECT count(*) n FROM item_instances WHERE (owner_scope='character' AND owner_id=$1) OR (owner_scope='account' AND owner_id=$2)", [actor.id, actor.account])).rows[0].n),
  });
  // Preserve Pool.connect/query callback semantics: only the promise transaction calls are observed.
  const instrument = observe => {
    const originalConnect = app.pool.connect, originals = new Map(), releases = [];
    const wrap = client => {
      if (!originals.has(client)) {
        const original = client.query, query = original.bind(client); originals.set(client, original);
        client.query = function (...args) {
          if (typeof args.at(-1) === 'function') return query(...args);
          return observe(client, args, () => query(...args));
        };
      }
      const release = client.release.bind(client);
      client.release = (...args) => { releases.push(args[0] === true); return release(...args); };
      return client;
    };
    app.pool.connect = function (...args) {
      if (typeof args[0] === 'function') {
        const callback = args[0]; return originalConnect.call(this, (error, client, release) => callback(error, client ? wrap(client) : client, release));
      }
      return originalConnect.apply(this, args).then(wrap);
    };
    return { releases, restore() { app.pool.connect = originalConnect; for (const [client, query] of originals) client.query = query; } };
  };
  const witness = await player('Encounter Commit Witness'), baseline = await snapshot(witness);
  for (const kind of ['start', 'turn']) {
    const action = kind === 'start' ? (await board(witness)).scenarios[0].action : (await board(witness)).active.actions.find(action => action.id === 'guard');
    const key = crypto.randomUUID(), mutated = new WeakSet(); let withheld = false;
    const probe = instrument(async (client, args, query) => {
      const sql = String(args[0]), result = await query();
      if (/^(?:INSERT INTO|UPDATE) city_encounters\b/.test(sql)) mutated.add(client);
      if (!withheld && sql === 'COMMIT' && mutated.has(client)) {
        withheld = true; throw Object.assign(Error('Controlled loss after the real encounter COMMIT'), { code: '08006' });
      }
      return result;
    });
    let uncertain;
    try { uncertain = await send(witness, action, key); } finally { probe.restore(); }
    assert(withheld); assert(probe.releases.includes(true), 'An uncertain committed connection must be discarded.');
    assert.equal(uncertain.statusCode, 503); assert.equal(uncertain.json().error, 'item_commit_unknown');
    const receipt = (await app.pool.query('SELECT status,response FROM idempotency WHERE account_id=$1 AND key=$2', [witness.account, key])).rows[0];
    assert.equal(Number(receipt.status), 200, 'The real COMMIT persisted its receipt with the encounter state.');
    const recovered = await send(witness, action, key); assert.equal(recovered.statusCode, 200);
    assert.equal(recovered.headers['x-idempotent-replay'], 'true'); assert.deepEqual(recovered.json(), JSON.parse(receipt.response));
    const current = (await board(witness)).active;
    assert.equal(current.revision, kind === 'start' ? 1 : 2); assert.equal(current.turn, kind === 'start' ? 0 : 1);
    assert.equal(Number((await app.pool.query('SELECT count(*) n FROM city_encounters WHERE owner_character_id=$1', [witness.id])).rows[0].n), 1);
  }
  assert.deepEqual(await snapshot(witness), baseline, 'COMMIT uncertainty/replay has no core or ledger effects.');
  const active = (await board(witness)).active, persisted = (await app.pool.query('SELECT model_json FROM city_encounters WHERE id=$1', [active.id])).rows[0];
  const originalModel = JSON.parse(persisted.model_json);
  for (const invalid of [{ ...originalModel, stamina: 0.5 }, { ...originalModel, health: 0, maxHealth: 0 }]) {
    try {
      await app.pool.query('UPDATE city_encounters SET model_json=$2 WHERE id=$1', [active.id, JSON.stringify(invalid)]);
      const rejected = await call(witness, 'GET', '/v1/city/encounters');
      assert.equal(rejected.statusCode, 503); assert.equal(rejected.json().error, 'encounter_integrity');
      const refused = await send(witness, active.actions.find(action => action.id === 'guard'));
      assert.equal(refused.statusCode, 503); assert.equal(refused.json().error, 'encounter_integrity');
      assert.equal(Number((await app.pool.query('SELECT revision FROM city_encounters WHERE id=$1', [active.id])).rows[0].revision), active.revision);
    } finally { await app.pool.query('UPDATE city_encounters SET model_json=$2 WHERE id=$1', [active.id, persisted.model_json]); }
  }
  assert.deepEqual(await snapshot(witness), baseline, 'Rejected corrupt persisted models never advance a drill or affect core state.');
  const travel = ok(await call(witness, 'POST', '/v1/travel/neon', {}));
  assert.equal(travel.loc, 'neon'); assert.equal(travel.cost, 250, 'District transitions use the real canonical paid travel endpoint.');
  const away = await board(witness), travelBaseline = await snapshot(witness);
  assert(away.active.actions.filter(action => action.id !== 'retreat').every(action => !action.available
    && action.blockedBy.some(blocker => blocker.code === 'return_to_encounter_district')));
  const awayTurn = await send(witness, away.active.actions.find(action => action.id === 'guard'));
  assert.equal(awayTurn.statusCode, 409); assert.equal(awayTurn.json().error, 'encounter_changed');
  assert(away.active.actions.find(action => action.id === 'retreat').available);
  const retreated = ok(await send(witness, away.active.actions.find(action => action.id === 'retreat')));
  assert.equal(retreated.encounter.status, 'retreated'); assert.equal((await board(witness)).active, null);
  assert.deepEqual(await snapshot(witness), travelBaseline, 'Withdrawing from a drill after real travel has no additional core effects.');

  if (postgres) {
    const actor = await player('Encounter Native Race'), before = await snapshot(actor);
    const race = async (action, failure) => {
      const locked = deferred(), attempted = deferred(), gate = deferred(); let firstLock = false, secondSettled = false;
      const probe = instrument(async (_client, args, query) => {
        const actorLock = /FROM characters[\s\S]*FOR UPDATE$/.test(String(args[0])) && args[1]?.[0] === actor.account;
        if (actorLock && firstLock) attempted.resolve();
        const result = await query();
        if (actorLock && !firstLock) { firstLock = true; locked.resolve(); await gate.promise; }
        return result;
      });
      let first, second;
      try {
        first = send(actor, action, crypto.randomUUID()); await bounded(locked.promise, 'the first native character row lock');
        second = send(actor, action, crypto.randomUUID()).then(result => { secondSettled = true; return result; });
        await bounded(attempted.promise, 'the competing native request attempting the held row lock');
        assert.equal(secondSettled, false); gate.resolve();
        const results = await Promise.all([first, second]); assert.deepEqual(results.map(result => result.statusCode).sort(), [200, 409]);
        assert.equal(results.find(result => result.statusCode === 409).json().error, failure);
        return ok(results.find(result => result.statusCode === 200));
      } finally { gate.resolve(); if (first) await first; if (second) await second; probe.restore(); }
    };
    await race((await board(actor)).scenarios[0].action, 'encounter_already_active');
    assert.equal(Number((await app.pool.query("SELECT count(*) n FROM city_encounters WHERE owner_character_id=$1 AND status='active'", [actor.id])).rows[0].n), 1);
    const advanced = await race((await board(actor)).active.actions.find(action => action.id === 'guard'), 'encounter_changed');
    assert.equal(advanced.encounter.revision, 2); assert.equal(advanced.encounter.turn, 1);
    assert.equal((await board(actor)).active.revision, 2); assert.deepEqual(await snapshot(actor), before);
  }

  const authority = await player('Encounter Authority Witness'), old = (await board(authority)).scenarios[0].action;
  const opened = ok(await send(authority, old));
  await app.pool.query('UPDATE characters SET generation=generation+1 WHERE id=$1', [authority.id]);
  const stale = await send(authority, opened.encounter.actions.find(action => action.id === 'guard'));
  assert.equal(stale.statusCode, 409); assert.equal(stale.json().error, 'encounter_identity_changed');
  const fresh = await board(authority); assert.equal(fresh.active, null); assert.deepEqual(fresh.history, []); assert.deepEqual(fresh.clues, []);
  const inaccessible = await call(authority, 'POST', opened.encounter.actions[0].path, { ...fresh.viewer, expectedRevision: 1, move: 'guard' });
  assert.equal(inaccessible.statusCode, 400); assert.equal(inaccessible.json().error, 'encounter_unavailable');
  const banned = await player('Encounter Ban Witness'), invitation = (await board(banned)).scenarios[0].action;
  await app.pool.query("UPDATE accounts SET status='banned' WHERE id=$1", [banned.account]);
  assert.equal((await send(banned, invitation)).statusCode, 403);
  assert.equal(Number((await app.pool.query('SELECT count(*) n FROM city_encounters WHERE owner_character_id=$1', [banned.id])).rows[0].n), 0);
  console.log('city-encounters-native-proof PASS: real COMMIT acknowledgement loss/exact persisted replay, corrupt-model fail closed, canonical paid travel/district affordances/safe drill retreat, current-generation isolation and banned actor refusal; '
    + (postgres ? 'actual PostgreSQL held-row competing start/turn each have one winner' : 'memory fixture verification only; native concurrency unqualified'));
} finally {
  if (app) await app.close();
  if (admin) {
    try {
      if (ownsSchema) {
        assert(/^city_encounters_[a-f0-9]{16}$/.test(namespace));
        const row = (await admin.query('SELECT n.nspname,pg_get_userbyid(n.nspowner) AS owner,current_user AS actor FROM pg_namespace n WHERE n.nspname=$1', [namespace])).rows[0];
        assert.equal(row?.nspname, namespace); assert.equal(row.owner, row.actor, 'Only the fixture-owned schema may be removed.');
        await admin.query('DROP SCHEMA ' + namespace + ' CASCADE');
      }
    } finally { await admin.end(); }
  }
}
