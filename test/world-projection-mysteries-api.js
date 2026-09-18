// Additive case selection preserves HTTP authentication, rollout and strict query parsing.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from '../src/server.js';
import { FURNACE_IDS as ids } from '../src/content/furnace-ledger.js';

assert(!process.env.DATABASE_URL, 'This HTTP lane uses only its isolated memory database');
const flags = ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE',
  'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS', 'COORDINATION_ACCOUNT_IDS'];
const prior = Object.fromEntries(flags.map((name) => [name, process.env[name]]));
const url = '/v1/projections/world', owner = 'case-api-owner', empty = 'case-api-empty';
const request = (app, method, path, token, payload) => app.inject({ method, url: path,
  headers: { ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(method === 'POST' ? { 'idempotency-key': crypto.randomUUID() } : {}) }, ...(payload === undefined ? {} : { payload }) });
const ok = (result) => { assert.equal(result.statusCode, 200, result.body); return result.json(); };
const noStore = (result) => assert.equal(result.headers['cache-control'], 'no-store');
async function actor(app, id, living = true) {
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
  await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
  if (living) await app.pool.query("INSERT INTO characters(id,account_id,name,season,loc,cash) VALUES($1,$2,$2,1,'docks',10000)", [`${id}-ch`, id]);
  return app.jwt.sign({ sub: id, tv: 0 });
}
let app;
try {
  for (const flag of flags) delete process.env[flag];
  for (const flag of flags.slice(1, -1)) process.env[flag] = 'on';
  app = await buildServer();
  let token = await actor(app, owner);
  assert(!Object.hasOwn(ok(await request(app, 'GET', url, token)), 'cases'), 'Default-off preserves the prior projection DTO');
  assert.equal((await request(app, 'GET', `${url}?mysteryGraphId=${ids.inspection}`, token)).statusCode, 404);
  await app.close(); app = null;

  process.env.CORE_PROGRESSION = 'on'; process.env.COORDINATION_ACCOUNT_IDS = `${owner},${empty}`;
  app = await buildServer(); token = await actor(app, owner);
  const excluded = await actor(app, 'case-api-excluded'), emptyToken = await actor(app, empty, false);
  const selected = `${url}?mysteryGraphId=${ids.inspection}`;
  for (const tokenValue of [undefined, 'invalid-token']) {
    const response = await request(app, 'GET', selected, tokenValue); assert.equal(response.statusCode, 401); noStore(response);
  }
  const outside = await request(app, 'GET', selected, excluded); assert.equal(outside.statusCode, 404); noStore(outside);
  const freshResponse = await request(app, 'GET', selected, token); noStore(freshResponse);
  const fresh = ok(freshResponse);
  assert.equal(fresh.cases.selected, null);
  assert.deepEqual(fresh.cases.catalog.map((entry) => entry.graphId), [ids.inspection, ids.deduction, ids.epilogue]);
  assert.deepEqual(fresh.cases.catalog.slice(1).map((entry) => entry.title), ['Furnace Archive Deduction', 'Furnace Archive Aftermath'],
    'Fallback catalog titles are readable without exposing hidden-node prose or changing authored pins');
  assert(fresh.cases.catalog.every((entry) => entry.canStart && !entry.started));
  const noCharacter = ok(await request(app, 'GET', selected, emptyToken));
  assert.equal(noCharacter.player.character, null); assert.equal(noCharacter.cases.selected, null);
  assert(noCharacter.cases.catalog.every((entry) => !entry.canStart && !entry.started));
  for (const suffix of ['?mysteryGraphId=', '?mysteryGraphId=a&mysteryGraphId=b', '?mysteryGraphId[]=a',
    '?mysteryGraphId=%20a', '?mysteryGraphId=%C3%A9', '?mysteryGraphId=a&accountId=b', '?mysteryGraphId=a&unknown=b']) {
    const response = await request(app, 'GET', url + suffix, token); assert.equal(response.statusCode, 400, suffix); noStore(response);
  }
  const missing = await request(app, 'GET', `${url}?mysteryGraphId=missing`, token);
  const unadmitted = await request(app, 'GET', `${url}?mysteryGraphId=belladonna`, token);
  assert.equal(missing.statusCode, 404); assert.equal(unadmitted.statusCode, 404); assert.deepEqual(missing.json(), unadmitted.json());
  const badPlayer = await request(app, 'GET', `/v1/projections/player?mysteryGraphId=${ids.inspection}`, token);
  assert.equal(badPlayer.statusCode, 400);
  ok(await request(app, 'POST', `/v1/worldgraph/mysteries/${ids.inspection}/start`, token, {}));
  const view = ok(await request(app, 'GET', selected, token));
  assert.equal(view.cases.selected.owner.id, `${owner}-ch`);
  assert.equal(view.cases.selected.graph.id, ids.inspection);
  assert.equal(view.cases.catalog.find((entry) => entry.graphId === ids.inspection).canStart, false);
  assert.equal(view.cases.selected.nodes[0].description, 'A waterlogged shipping index lists seized steel. Compare its dates before trusting the missing accounts.');
  for (const hidden of [ids.impression, 'read_reversed_countermark', 'deliveries-after-confiscation']) assert(!JSON.stringify(view.cases).includes(hidden));
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [`${owner}-ch`]);
  await app.pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES('case-api-heir',$1,'Case API Heir',1,'docks')", [owner]);
  const heir = ok(await request(app, 'GET', selected, token));
  assert.equal(heir.cases.selected, null); assert(heir.cases.catalog.every((entry) => !entry.started));
  console.log('world-projection-mysteries-api: auth, rollout, cohort, strict selection, public prose and current-character isolation PASS');
} finally {
  if (app) await app.close();
  for (const [name, value] of Object.entries(prior)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
}
