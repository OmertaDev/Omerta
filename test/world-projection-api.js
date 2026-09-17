// Mounted Fastify route contracts. Native MVCC is covered by world-projection.js.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from '../src/server.js';
import { COORDINATION_OPERATION_PILOT } from '../src/content/coordination-operation-pilot.js';
import { WORLD_KERNEL_OBJECTS, WORLD_KERNEL_RECIPE } from '../src/content/world-kernel-pilot.js';

assert(!process.env.DATABASE_URL, 'Projection API tests use an isolated in-memory server');
const names = ['WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE',
  'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS', 'COORDINATION_ACCOUNT_IDS'];
const prior = Object.fromEntries(names.map((name) => [name, process.env[name]]));
const restore = () => { for (const [name, value] of Object.entries(prior)) {
  if (value === undefined) delete process.env[name]; else process.env[name] = value;
} };
const key = () => crypto.randomUUID(), world = '/v1/projections/world', player = '/v1/projections/player';
const owner = 'projection-api-owner', reader = 'projection-api-reader', outsider = 'projection-api-outsider';
const secret = WORLD_KERNEL_OBJECTS[0].knowledge[0];
async function account(app, id, withCharacter = true) {
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
  await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
  if (withCharacter) await app.pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$2,1,'foundry',10000,100000)", [`${id}-ch`, id]);
  return app.jwt.sign({ sub: id, tv: 0 });
}
const request = (app, method, url, token, payload) => app.inject({ method, url,
  headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(method === 'POST' ? { 'idempotency-key': key() } : {}) },
  ...(payload === undefined ? {} : { payload }) });
const ok = (response) => { assert.equal(response.statusCode, 200, response.body); return response.json(); };
const noStore = (response) => assert.equal(response.headers['cache-control'], 'no-store', response.body);
let app;
try {
  for (const name of names) delete process.env[name];
  app = await buildServer();
  const offToken = await account(app, 'projection-disabled');
  const disabled = await request(app, 'GET', world, offToken);
  assert.equal(disabled.statusCode, 404); noStore(disabled);
  const compat = await request(app, 'GET', player, offToken); noStore(compat);
  const original = ok(await request(app, 'GET', '/v1/me', offToken)).character;
  const projected = ok(compat);
  assert.equal(projected.schemaVersion, 1); assert(Number.isSafeInteger(projected.asOf));
  assert.deepEqual(Object.keys(projected.player).sort(), Object.keys(original).sort());
  for (const name of ['id', 'name', 'loc', 'cash', 'respect', 'alive']) assert.deepEqual(projected.player[name], original[name], `Player compatibility: ${name}`);
  await app.close(); app = null;

  for (const name of names.slice(0, 5)) process.env[name] = 'on';
  process.env.COORDINATION_ACCOUNT_IDS = [owner, reader, outsider, 'projection-no-character'].join(',');
  app = await buildServer();
  const ownerToken = await account(app, owner), readerToken = await account(app, reader);
  const outsiderToken = await account(app, outsider), excludedToken = await account(app, 'projection-excluded');
  const noCharacterToken = await account(app, 'projection-no-character', false);
  for (const path of [world, player]) {
    const absent = await request(app, 'GET', path); assert.equal(absent.statusCode, 401); noStore(absent);
    const invalid = await request(app, 'GET', path, 'invalid-token'); assert.equal(invalid.statusCode, 401); noStore(invalid);
  }
  const excluded = await request(app, 'GET', world, excludedToken); assert.equal(excluded.statusCode, 404); noStore(excluded);
  assert.equal((await request(app, 'GET', player, excludedToken)).statusCode, 200, 'Player compatibility is independent of the world cohort');
  const noCharacterWorld = ok(await request(app, 'GET', world, noCharacterToken));
  assert.equal(noCharacterWorld.player.character, null); assert.deepEqual(noCharacterWorld.knowledge.claims, []);
  assert.deepEqual(noCharacterWorld.worldObjects, []);
  const noCharacterPlayer = await request(app, 'GET', player, noCharacterToken);
  assert.equal(noCharacterPlayer.statusCode, 404); assert.equal(noCharacterPlayer.json().error, 'no_character'); noStore(noCharacterPlayer);
  for (const suffix of ['?accountId=another', '?limit=1', '?operationId=', '?operationId=a&operationId=b',
    '?operationId[]=a', '?operationId=%20private%20', '?operationId=a&ownerId=b']) {
    const response = await request(app, 'GET', world + suffix, ownerToken);
    assert.equal(response.statusCode, 400, suffix); noStore(response);
  }
  for (const suffix of ['?operationId=a', '?limit=1', '?accountId=another']) {
    const response = await request(app, 'GET', player + suffix, ownerToken); assert.equal(response.statusCode, 400, suffix); noStore(response);
  }
  await app.pool.query("INSERT INTO gangs(id,name,tag) VALUES('projection-api-family','Projection API Family','PAPI')");
  await app.pool.query("INSERT INTO crews(id,name,leader_account) VALUES('projection-api-crew','Projection API Crew',$1)", [owner]);
  for (const [id, role] of [[owner, 'boss'], [reader, 'soldier']]) {
    await app.pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('projection-api-family',$1,$2)", [`${id}-ch`, role]);
    await app.pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('projection-api-crew',$1,$1)", [id]);
  }
  const operation = ok(await request(app, 'POST', '/v1/coordination/operations', ownerToken, { definitionId: COORDINATION_OPERATION_PILOT[0].id }));
  assert.equal(typeof operation.operationId, 'string', JSON.stringify(operation));
  const selected = await request(app, 'GET', `${world}?operationId=${operation.operationId}`, ownerToken);
  noStore(selected); assert.equal(ok(selected).operations.selected.status, 'draft');
  const hidden = await request(app, 'GET', `${world}?operationId=${operation.operationId}`, outsiderToken);
  const missing = await request(app, 'GET', `${world}?operationId=missing`, outsiderToken);
  assert.equal(hidden.statusCode, 404); assert.equal(missing.statusCode, 404); assert.deepEqual(hidden.json(), missing.json());
  noStore(hidden); noStore(missing);
  const unknown = ok(await request(app, 'GET', world, readerToken));
  assert.deepEqual(unknown.knowledge.claims, []); assert.deepEqual(unknown.worldObjects, []);
  assert(unknown.recipes.find((entry) => entry.id === WORLD_KERNEL_RECIPE).missing.includes('knowledge'));
  for (const value of [secret.contentHash, secret.domain, secret.proposition, secret.sourceRoot, secret.value.value]) assert(!JSON.stringify(unknown).includes(value));
  assert(!Object.hasOwn(unknown, 'nodes')); assert(!Object.hasOwn(unknown, 'relationships'));

  // Discovery and audience grants travel through real authenticated HTTP commands.
  ok(await request(app, 'POST', '/v1/travel/docks', ownerToken, {}));
  const catalog = ok(await request(app, 'GET', '/v1/coordination', ownerToken));
  const graph = catalog.graphs.find((entry) => entry.id === 'omerta.coordination.split-ledger');
  let run = ok(await request(app, 'POST', `/v1/coordination/${graph.id}/instances`, ownerToken, { expectedContentHash: graph.contentHash })).instance;
  const actionPath = `/v1/coordination/instances/${run.id}/act`;
  run = ok(await request(app, 'POST', actionPath, ownerToken, { expectedRevision: run.revision, actionId: run.actions[0].id })).instance;
  const discover = run.actions.find((action) => action.kind === 'discover'); assert(discover);
  ok(await request(app, 'POST', actionPath, ownerToken, { expectedRevision: run.revision, actionId: discover.id }));
  ok(await request(app, 'POST', '/v1/travel/foundry', ownerToken, {}));
  const known = ok(await request(app, 'GET', world, ownerToken));
  const claim = known.knowledge.claims[0]; assert(claim.owned); assert.equal(claim.aclRevision, 0);
  assert.equal(known.worldObjects[0].state, 'sealed');
  assert.equal(ok(await request(app, 'GET', world, readerToken)).knowledge.claims.length, 0);
  const targets = ok(await request(app, 'GET', '/v1/coordination/knowledge/targets', ownerToken));
  const crew = targets.targets.find((entry) => entry.kind === 'crew'); assert(crew);
  const share = ok(await request(app, 'POST', `/v1/coordination/knowledge/${claim.id}/share`, ownerToken,
    { targetId: crew.id, expectedAclRevision: claim.aclRevision }));
  const shared = ok(await request(app, 'GET', world, readerToken));
  assert.equal(shared.knowledge.claims[0].id, claim.id); assert.equal(shared.knowledge.claims[0].owned, false);
  assert.equal(shared.worldObjects[0].id, WORLD_KERNEL_OBJECTS[0].id);
  assert(!shared.recipes.find((entry) => entry.id === WORLD_KERNEL_RECIPE).missing.includes('knowledge'));
  assert(!JSON.stringify(shared.knowledge).includes('sourceRoot'));
  assert.equal(ok(await request(app, 'GET', world, outsiderToken)).knowledge.claims.length, 0);
  ok(await request(app, 'POST', `/v1/coordination/knowledge/${claim.id}/revoke`, ownerToken,
    { grantId: share.claim.grants[0].id, expectedAclRevision: share.claim.aclRevision }));
  const revoked = ok(await request(app, 'GET', world, readerToken));
  assert.deepEqual(revoked.knowledge.claims, []); assert.deepEqual(revoked.worldObjects, []);
  console.log('world-projection-api: mounted auth/default-off/cohort/no-store, strict queries, private=missing, player compatibility and HTTP discovery/sharing/revocation passed');
} finally { if (app) await app.close(); restore(); }
