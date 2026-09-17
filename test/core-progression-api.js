// The admitted composition must be the same at every HTTP boundary. Full domain
// journeys live in the native progression lane; this checks route/cohort authority.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from '../src/server.js';
import { FURNACE_IDS as ids } from '../src/content/furnace-ledger.js';

assert(!process.env.DATABASE_URL, 'This HTTP lane uses only its isolated memory database');
const flags = ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE',
  'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS', 'COORDINATION_ACCOUNT_IDS'];
const prior = Object.fromEntries(flags.map((flag) => [flag, process.env[flag]]));
const owner = 'progression-api-owner', excluded = 'progression-api-excluded';
const key = () => crypto.randomUUID();
const req = (app, method, url, token, payload, commandKey) => app.inject({ method, url,
  headers: { ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(commandKey ? { 'idempotency-key': commandKey } : {}) }, ...(payload === undefined ? {} : { payload }) });
const ok = (response) => { assert.equal(response.statusCode, 200, response.body); return response.json(); };
async function actor(app, id) {
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
  await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
  await app.pool.query("INSERT INTO characters(id,account_id,name,season,loc,cash) VALUES($1,$2,$2,1,'docks',10000)", [`${id}-ch`, id]);
  return app.jwt.sign({ sub: id, tv: 0 });
}
let app;
try {
  for (const flag of flags) delete process.env[flag];
  app = await buildServer();
  let token = await actor(app, owner);
  assert(!JSON.stringify(ok(await req(app, 'GET', '/v1/worldgraph/mysteries', token))).includes(ids.inspection),
    'Source content cannot activate itself');
  await app.close(); app = null;

  for (const flag of flags.slice(0, -1)) process.env[flag] = 'on';
  process.env.COORDINATION_ACCOUNT_IDS = owner;
  app = await buildServer();
  token = await actor(app, owner);
  const outsider = await actor(app, excluded);
  const path = `/v1/worldgraph/mysteries/${ids.inspection}`;
  assert.equal((await req(app, 'GET', path)).statusCode, 401);
  const listed = ok(await req(app, 'GET', '/v1/worldgraph/mysteries', token));
  assert(listed.mysteries.some((entry) => entry.graphId === ids.inspection));
  assert(!JSON.stringify(ok(await req(app, 'GET', '/v1/worldgraph/mysteries', outsider))).includes(ids.inspection));
  assert.equal((await req(app, 'GET', '/v1/projections/world', outsider)).statusCode, 404);
  assert.equal((await req(app, 'POST', `${path}/start`, outsider, {}, key())).statusCode, 400);
  assert.equal((await req(app, 'POST', `${path}/start`, token, { accountId: excluded }, key())).statusCode, 400);
  ok(await req(app, 'POST', `${path}/start`, token, {}, key()));
  const boardResponse = await req(app, 'GET', path, token);
  const board = ok(boardResponse);
  assert.equal(boardResponse.headers['cache-control'], 'no-store');
  assert(!JSON.stringify(board).includes(ids.impression), 'An unearned hidden countermark stays private');
  const offered = board.actions.find((action) => action.kind === 'complete');
  assert.equal(offered?.nodeId, ids.entry, 'Players receive an eligible action from the board');
  assert.equal(offered.interactionId, 'inspect_seized_steel_manifest');
  const body = { interactionId: offered.interactionId }, mutationKey = key();
  const complete = `${path}/nodes/${offered.nodeId}/complete`;
  const first = ok(await req(app, 'POST', complete, token, body, mutationKey));
  assert.deepEqual(ok(await req(app, 'POST', complete, token, body, mutationKey)), first);
  assert(!JSON.stringify(ok(await req(app, 'GET', '/v1/projections/world', token))).includes(ids.object),
    'Progression admission does not reveal the hidden world consequence');
  const catalog = ok(await req(app, 'GET', '/v1/coordination', token));
  assert(JSON.stringify(catalog).includes(ids.coordination), 'Coordination uses the same admitted composition');
  assert(!JSON.stringify(ok(await req(app, 'GET', '/v1/worldgraph/kernel/recipes', token))).includes(ids.recipe),
    'Inspection alone cannot disclose a secret recipe without authentic discovery');
  const hiddenCraft = await req(app, 'POST', `/v1/worldgraph/kernel/recipes/${ids.recipe}/craft`, token, {}, key());
  const missingCraft = await req(app, 'POST', '/v1/worldgraph/kernel/recipes/missing/craft', token, {}, key());
  assert.equal(hiddenCraft.statusCode, 404);
  assert.deepEqual(hiddenCraft.json(), missingCraft.json(), 'Guessing a recipe ID cannot distinguish hidden from absent content');
  const direct = await req(app, 'POST', `/v1/worldgraph/objects/${ids.object}/actions/preserve_archive`, token,
    { itemId: 'invented', expectedRevision: 0 }, key());
  const absent = await req(app, 'POST', '/v1/worldgraph/objects/absent/actions/absent', token,
    { itemId: 'invented', expectedRevision: 0 }, key());
  assert.equal(direct.statusCode, 404, 'The direct HTTP action cannot bypass Family coordination');
  assert.deepEqual(direct.json(), absent.json(), 'A guessed collective consequence does not reveal a hidden world object');
  console.log('core-progression-api: default-off/cohort, shared admission, mystery snapshot, replay and collective-only HTTP gates pass');
} finally {
  await app?.close();
  for (const flag of flags) { if (prior[flag] === undefined) delete process.env[flag]; else process.env[flag] = prior[flag]; }
}
