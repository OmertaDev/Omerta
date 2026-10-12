// Current-source read projection proof; --postgres uses only an explicitly owned loopback schema.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Ajv from 'ajv';

const postgres = process.argv.includes('--postgres');
let admin, namespace, app, createdSchema = false;
const nativeEndpoint = address => {
  assert.equal(typeof address, 'string', 'An explicit City homes disposable native test URL is required.');
  const endpoint = new URL(address);
  assert(['postgres:', 'postgresql:'].includes(endpoint.protocol));
  assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname), 'Native fixture requires loopback.');
  assert(/^\/(?:omerta_query|omerta_check|world_kernel_[a-z0-9_]+|city_homes_[a-z0-9_]+)$/.test(endpoint.pathname), 'Use a named test database.');
  return endpoint;
};
assert.equal(nativeEndpoint('postgresql://127.0.0.1/omerta_query').pathname, '/omerta_query');
for (const address of [undefined, 'http://127.0.0.1/omerta_query', 'postgresql://production.invalid/omerta_query',
  'postgresql://127.0.0.1/postgres', 'postgresql://127.0.0.1/live_database']) assert.throws(() => nativeEndpoint(address));
for (const key of ['JWT_SECRET', 'MOD_KEY', 'MARKET_SEED']) process.env[key] = crypto.randomBytes(32).toString('hex');
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.RATE_LIMIT = 'off';
process.env.INVITE_MODE = 'off';
process.env.POPULATION_OFF = 'on';
try {
  if (postgres) {
    const endpoint = nativeEndpoint(process.env.CITY_HOMES_TEST_DATABASE_URL);
    const { Pool } = await import('pg');
    admin = new Pool({ connectionString: endpoint.toString() });
    namespace = 'city_homes_' + crypto.randomBytes(8).toString('hex');
    assert(/^city_homes_[a-f0-9]{16}$/.test(namespace));
    await admin.query(`CREATE SCHEMA ${namespace}`);
    createdSchema = true;
    endpoint.searchParams.set('options', `-c search_path=${namespace}`);
    process.env.DATABASE_URL = endpoint.toString();
  } else assert(!process.env.DATABASE_URL, 'Memory proof requires disposable pg-mem.');
  const { buildServer } = await import('../src/server.js');
  const { ledger } = await import('../src/game.js');
  app = await buildServer();
  if (postgres) {
    const provenance = (await app.pool.query('SELECT current_schema() AS schema,version() AS version')).rows[0];
    assert.equal(provenance.schema, namespace, 'The actual application must use the owned native schema.');
    assert.match(provenance.version, /^PostgreSQL /);
  }
  const privateHeaders = response => {
    assert.equal(response.headers['cache-control'], 'private, no-store');
    assert.match(response.headers.vary, /authorization/i);
  };
  const post = (actor, url, payload) => app.inject({ method: 'POST', url, payload,
    headers: { ...(actor ? actor.headers : {}), 'idempotency-key': crypto.randomUUID() } });
  const actor = async (name, kind = 'player') => {
    const guest = await post(null, '/v1/auth/guest', { birthDate: '1990-01-01' });
    assert.equal(guest.statusCode, 200, guest.body);
    const token = guest.json().token, account = app.jwt.verify(token).sub;
    const headers = { authorization: 'Bearer ' + token };
    const created = await post({ headers }, '/v1/character', { name });
    assert.equal(created.statusCode, 200, created.body);
    const row = (await app.pool.query('SELECT id,generation,cash FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
    await app.pool.query("UPDATE characters SET loc='docks',cash=100000,is_npc=$2,last_accrued_at=$3 WHERE id=$1",
      [row.id, kind === 'npc', new Date(Date.now() + 86400000)]);
    await ledger(app.pool, { characterId: row.id, currency: 'cash', amount: 100000 - Number(row.cash), reason: 'crime:homes-fixture' });
    if (kind === 'agent') await app.pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [account]);
    return { ...row, name, account, headers };
  };
  const viewer = await actor('Home Directory Viewer'), seller = await actor('Home Directory Seller');
  const agent = await actor('Home Directory Agent', 'agent'), npc = await actor('Home Directory Resident', 'npc');
  const buyer = await actor('Home Directory Buyer');
  const claim = async (owner, name, district = 'docks') => {
    const result = await post(owner, '/v1/deeds/claim', { name, district });
    assert.equal(result.statusCode, 200, result.body);
  };
  await claim(seller, 'Alpha Street'); await claim(agent, 'Agent Avenue');
  await claim(npc, 'Resident Road'); await claim(viewer, 'Zulu Home');
  const spec = (await app.inject({ url: '/openapi.json' })).json();
  const operation = spec.paths['/v1/city/homes'].get;
  assert(operation.security?.length, 'Home directory remains authenticated.');
  assert.equal(operation.parameters.find(p => p.name === 'district').required, true);
  const validate = new Ajv({ strict: false, allErrors: true }).compile(operation.responses['200'].content['application/json'].schema);
  const read = async (owner = viewer, query = 'district=docks') => {
    const response = await app.inject({ url: '/v1/city/homes?' + query, headers: owner.headers });
    assert.equal(response.statusCode, 200, response.body); privateHeaders(response);
    const body = response.json(); assert(validate(body), JSON.stringify(validate.errors)); return body;
  };
  const snapshot = async () => ({
    characters: (await app.pool.query('SELECT id,cash,bank,respect,health,energy,nerve,heat,loc,generation FROM characters ORDER BY id')).rows,
    deeds: (await app.pool.query('SELECT * FROM street_deeds ORDER BY name_lc')).rows,
    ledger: (await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows,
  });
  const before = await snapshot();
  const first = await read(viewer, 'district=docks&limit=1');
  assert.equal(first.homes.length, 1); assert(first.nextCursor);
  assert.equal(first.total, 4); assert.equal(first.placement, 'illustrative');
  assert.deepEqual(first.viewer, { characterId: viewer.id, generation: Number(viewer.generation), district: 'docks' });
  assert.equal(first.myHome.key, 'zulu home'); assert.equal(first.myHome.mine, true);
  assert(!first.homes.some(home => home.key === first.myHome.key), 'Own address is issued even outside the public page.');
  const all = await read();
  for (const [key, kind, owner] of [['agent avenue', 'agent', agent], ['resident road', 'npc', npc], ['alpha street', 'player', seller]]) {
    assert.deepEqual(all.homes.find(home => home.key === key).owner, { name: owner.name, kind });
    assert.equal(all.homes.find(home => home.key === key).mine, false);
  }
  let page = first; const keys = first.homes.map(home => home.key);
  while (page.nextCursor) { page = await read(viewer, 'district=docks&limit=1&after=' + encodeURIComponent(page.nextCursor)); keys.push(...page.homes.map(home => home.key)); }
  assert.deepEqual(keys, all.homes.map(home => home.key));
  assert.equal(new Set(keys).size, 4, 'Keyset pages neither duplicate nor lose canonical addresses.');
  const serialized = JSON.stringify(all);
  for (const forbidden of [viewer.account, seller.account, agent.account, npc.account, 'account_id', 'wallet', 'cash', 'sale_price', 'controller', 'history', 'upgrades', 'onchain_token_id'])
    assert(!serialized.includes(forbidden), 'Directory must exclude private field: ' + forbidden);
  const malformed = structuredClone(all); malformed.homes[0].owner.wallet = 'private';
  assert.equal(validate(malformed), false, 'Closed owner schema rejects private additions.');
  assert.deepEqual(await snapshot(), before, 'Directory reads change no resources, deeds or ledger.');
  await app.pool.query('INSERT INTO street_deeds(account_id,name,name_lc,district) VALUES($1,$2,$3,$4)',
    ['homes-legacy', 'Legacy Café', 'legacy café', 'docks']);
  const legacyPage = await read(viewer, 'district=docks&limit=64');
  const legacyIndex = legacyPage.homes.findIndex(home => home.key === 'legacy café');
  assert(legacyIndex > 0, 'The real stored legacy asset is projected without renaming.');
  const legacyIssued = await read(viewer, 'district=docks&limit=1&after=' + encodeURIComponent(legacyPage.homes[legacyIndex - 1].key));
  assert.equal(legacyIssued.nextCursor, 'legacy café', 'The directory issues its actual legacy Unicode key.');
  const afterLegacy = await read(viewer, 'district=docks&limit=1&after=' + encodeURIComponent(legacyIssued.nextCursor));
  assert.notEqual(afterLegacy.homes[0].key, legacyIssued.nextCursor, 'The exact issued Unicode cursor remains usable.');
  for (let i = 0; i < 66; i++) await app.pool.query(
    'INSERT INTO street_deeds(account_id,name,name_lc,district) VALUES($1,$2,$3,$4)',
    ['homes-page-' + i, 'Page Street ' + String(i).padStart(2, '0'), 'page street ' + String(i).padStart(2, '0'), 'docks']);
  const bounded = await read(viewer, 'district=docks&limit=64');
  assert.equal(bounded.homes.length, 64); assert.equal(bounded.total, 71); assert(bounded.nextCursor);
  assert.equal((await read()).homes.length, 32, 'Default page size is bounded independently from district total.');
  assert.equal(bounded.myHome.key, 'zulu home');
  assert.equal((await read(viewer, 'district=docks&limit=64&after=' + encodeURIComponent(bounded.nextCursor))).homes.length, 7);
  for (const district of ['neon', 'foundry', 'brick', 'canal', 'cathedral']) {
    const other = await read(viewer, 'district=' + district); assert.equal(other.districtId, district);
    assert.equal(other.viewer.district, 'docks'); assert.equal(other.myHome, null); assert.equal(other.total, 0);
  }
  for (const query of ['', 'district=unknown', 'district=docks&limit=0', 'district=docks&limit=65',
    'district=docks&limit=1.5', 'district=docks&limit=02', 'district=docks&after=Alpha%20Street',
    'district=docks&after=missing%20street', 'district=brick&after=alpha%20street',
    'district=docks&after=%2Fprivate', 'district=docks&after=alpha%00street',
    'district=docks&after=' + 'a'.repeat(129), 'district=docks&owner=' + seller.account]) {
    const rejected = await app.inject({ url: '/v1/city/homes?' + query, headers: viewer.headers });
    assert.equal(rejected.statusCode, 400, rejected.body); privateHeaders(rejected);
  }
  const unauthenticated = await app.inject({ url: '/v1/city/homes?district=docks' });
  assert.equal(unauthenticated.statusCode, 401); privateHeaders(unauthenticated);
  const emptyAccount = (await post(null, '/v1/auth/guest', { birthDate: '1990-01-01' })).json();
  const noCharacter = await app.inject({ url: '/v1/city/homes?district=docks', headers: { authorization: 'Bearer ' + emptyAccount.token } });
  assert.equal(noCharacter.statusCode, 400); assert.equal(noCharacter.json().error, 'no_character'); privateHeaders(noCharacter);
  assert.equal((await post(seller, '/v1/deeds/list', { price: 10000 })).statusCode, 200);
  assert.equal((await post(buyer, '/v1/deeds/buy/' + seller.id)).statusCode, 200, 'Real canonical purchase transfers the deed.');
  const bought = await read(buyer, 'district=docks&limit=1');
  assert.equal(bought.myHome.key, 'alpha street'); assert.equal(bought.myHome.mine, true);
  assert.deepEqual(bought.myHome.owner, { name: buyer.name, kind: 'player' });
  assert.equal((await read(seller)).myHome, null);
  assert.equal((await read()).homes.find(home => home.key === 'alpha street').mine, false);
  if (postgres) {
    assert.equal((await post(buyer, '/v1/deeds/list', { price: 10000 })).statusCode, 200);
    let releasePage, observePage;
    const pageObserved = new Promise(resolve => { observePage = resolve; });
    const pageGate = new Promise(resolve => { releasePage = resolve; });
    let held = false;
    const scopedPool = { query: (...args) => app.pool.query(...args), async connect() {
      const client = await app.pool.connect();
      return { release: () => client.release(), async query(sql, values) {
        const result = await client.query(sql, values);
        if (!held && typeof sql === 'string' && sql.includes('name_lc>$2')) {
          held = true; observePage(); await pageGate;
        }
        return result;
      } };
    } };
    const { cityHomes } = await import('../src/cityhomes.js');
    const snapshotRead = cityHomes(scopedPool, buyer.account, { district: 'docks', limit: 1 });
    try {
      await Promise.race([pageObserved, snapshotRead.then(() => { throw new Error('Native read did not reach its real page query.'); })]);
      assert.equal((await post(seller, '/v1/deeds/buy/' + buyer.id)).statusCode, 200);
      releasePage();
      const historic = await snapshotRead;
      assert.equal(historic.myHome.key, 'alpha street');
      assert.deepEqual(historic.myHome.owner, { name: buyer.name, kind: 'player' }, 'Native read retains one coherent pre-transfer owner snapshot.');
      assert.equal((await read(buyer)).myHome, null, 'A fresh HTTP read sees the committed new owner.');
      assert.equal((await read(seller)).myHome.key, 'alpha street');
    } finally { releasePage(); await snapshotRead; }
    assert.equal((await post(seller, '/v1/deeds/list', { price: 10000 })).statusCode, 200);
    assert.equal((await post(buyer, '/v1/deeds/buy/' + seller.id)).statusCode, 200);
  }
  const legacy = crypto.randomUUID();
  await app.pool.query('INSERT INTO characters(id,account_id,name,season,alive,generation,loc,created_at) VALUES($1,$2,$3,1,true,99,$4,$5)',
    [legacy, agent.account, 'Private Older Steward', 'brick', new Date('2000-01-01T00:00:00Z')]);
  const currentAgent = await read(agent);
  assert.equal(currentAgent.viewer.characterId, agent.id);
  assert.deepEqual(currentAgent.myHome.owner, { name: agent.name, kind: 'agent' });
  assert(!JSON.stringify(currentAgent).includes('Private Older Steward'), 'Older living rows never leak an old steward generation.');
  await app.pool.query('DELETE FROM characters WHERE id=$1', [legacy]);
  const killed = await app.inject({ method: 'POST', url: '/v1/mod/kill', headers: { 'x-mod-key': process.env.MOD_KEY }, payload: { characterId: buyer.id } });
  assert.equal(killed.statusCode, 200, killed.body);
  const heir = (await app.pool.query('SELECT id,name,generation FROM characters WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1', [buyer.account])).rows[0];
  const inherited = await read(buyer);
  assert.equal(inherited.viewer.characterId, heir.id); assert.equal(inherited.viewer.generation, Number(heir.generation));
  assert.deepEqual(inherited.myHome.owner, { name: heir.name, kind: 'player' }); assert.equal(inherited.myHome.key, 'alpha street');
  await app.pool.query('UPDATE characters SET alive=false WHERE account_id=$1', [npc.account]);
  const estate = (await read(viewer, 'district=docks&limit=64&after=page%20street%2065')).homes.find(home => home.key === 'resident road');
  assert.equal(estate.ownership, 'estate'); assert.equal(estate.owner, null);
  await app.pool.query('UPDATE street_deeds SET onchain_token_id=$2 WHERE account_id=$1', [agent.account, '123']);
  const external = (await read(agent)).myHome;
  assert.equal(external.ownership, 'external'); assert.equal(external.owner, null); assert.equal(external.mine, false);
  await app.pool.query("UPDATE characters SET loc='cathedral' WHERE id=$1", [viewer.id]);
  assert.equal((await read()).viewer.district, 'cathedral', 'Requested display district never spoofs actual viewer location.');
  await app.pool.query('UPDATE accounts SET token_version=token_version+1 WHERE id=$1', [viewer.account]);
  const revoked = await app.inject({ url: '/v1/city/homes?district=docks', headers: viewer.headers });
  assert.equal(revoked.statusCode, 401); privateHeaders(revoked);
  console.log('city-homes-api PASS: authenticated closed private DTO, deterministic bounded pages, out-of-page own address, player/agent/NPC stewards, real claim/list/purchase, actual estate/heir, external ownership, current viewer travel and auth revocation, neutral reads' +
    (postgres ? '; actual application owned-schema PostgreSQL projection and real transfer/read snapshot coherence' : ' (pg-mem; native snapshot proof pending)'));
} finally {
  if (app) await app.close();
  if (admin) {
    if (createdSchema) {
      assert(/^city_homes_[a-f0-9]{16}$/.test(namespace));
      const ownership = (await admin.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1', [namespace])).rows[0];
      assert.equal(ownership?.mine, true, 'Drop only the generated fixture schema owned by this connection.');
      await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
    }
    await admin.end();
  }
}
