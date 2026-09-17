// Mounted-server proof: strict HTTP input, real discovery/crafting/action commands,
// safe hidden state, and recovery from a committed command without an HTTP receipt.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from '../src/server.js';
import { grantStack, withItemTransaction } from '../src/items.js';
import { WORLD_KERNEL_RECIPE } from '../src/content/world-kernel-pilot.js';

assert(!process.env.DATABASE_URL, 'world-kernel-api uses only an isolated in-memory test database');
const envNames = ['WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE',
  'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_ACCOUNT_IDS'];
const previous = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
const restore = () => { for (const [name, value] of Object.entries(previous)) {
  if (value === undefined) delete process.env[name]; else process.env[name] = value;
} };
const key = () => crypto.randomUUID();
const objectId = 'facility:foundry_archive', objectPath = `/v1/worldgraph/objects/${objectId}`;
const actionPath = `${objectPath}/actions/open_archive`;
const recipesPath = '/v1/worldgraph/kernel/recipes';
const craftPath = `${recipesPath}/${WORLD_KERNEL_RECIPE}/craft`;
const paths = ['/v1/worldgraph/state', '/v1/worldgraph/objects', objectPath, recipesPath];
async function fixture(app, id, name) {
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
  await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
  await app.pool.query("INSERT INTO characters(id,account_id,name,season,loc,cash) VALUES($1,$2,$3,1,'foundry',10000)", [`${id}-ch`, id, name]);
  return app.jwt.sign({ sub: id, tv: 0 });
}
const request = (app, method, url, token, body, commandKey) => app.inject({ method, url,
  headers: { ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(commandKey === undefined ? {} : { 'idempotency-key': commandKey }) },
  ...(body === undefined ? {} : { payload: body }) });
const ok = (response) => { assert.equal(response.statusCode, 200, response.body); return response.json(); };
let app, off;
try {
  for (const name of envNames) delete process.env[name];
  off = await buildServer();
  const offToken = await fixture(off, 'kernel-off', 'Kernel Off');
  for (const path of paths) assert.equal((await request(off, 'GET', path, offToken)).statusCode, 404, path);
  assert.equal((await request(off, 'POST', craftPath, offToken, {}, key())).statusCode, 404);
  assert.equal((await request(off, 'POST', actionPath, offToken, { itemId: 'absent', expectedRevision: 0 }, key())).statusCode, 404);
  await off.close(); off = null;

  for (const name of envNames.slice(0, 4)) process.env[name] = 'on';
  const owner = 'kernel-api-owner', member = 'kernel-api-member', observer = 'kernel-api-observer';
  process.env.COORDINATION_ACCOUNT_IDS = [owner, member, observer].join(',');
  app = await buildServer();
  const ownerToken = await fixture(app, owner, 'Kernel Owner');
  const memberToken = await fixture(app, member, 'Kernel Member');
  const observerToken = await fixture(app, observer, 'Kernel Observer');
  const outsiderToken = await fixture(app, 'kernel-api-outsider', 'Kernel Outsider');
  for (const path of paths) {
    assert.equal((await request(app, 'GET', path)).statusCode, 401, `auth: ${path}`);
    assert.equal((await request(app, 'GET', path, outsiderToken)).statusCode, 404, `cohort: ${path}`);
  }
  assert.equal((await request(app, 'POST', craftPath, undefined, {}, key())).statusCode, 401);
  assert.equal((await request(app, 'POST', actionPath, undefined, { itemId: 'absent', expectedRevision: 0 }, key())).statusCode, 401);
  const initial = ok(await request(app, 'GET', '/v1/worldgraph/state', ownerToken));
  assert(!initial.nodes.some((node) => node.type === 'knowledge'));
  assert(!JSON.stringify(initial).includes(objectId));
  assert.deepEqual(ok(await request(app, 'GET', '/v1/worldgraph/objects', ownerToken)).objects, []);
  const hidden = await request(app, 'GET', objectPath, ownerToken);
  const missing = await request(app, 'GET', '/v1/worldgraph/objects/missing', ownerToken);
  assert.equal(hidden.statusCode, 404); assert.deepEqual(hidden.json(), missing.json());

  await app.pool.query("INSERT INTO crews(id,name,leader_account) VALUES('kernel-api-crew','Kernel API Crew',$1)", [owner]);
  await app.pool.query("INSERT INTO gangs(id,name,tag) VALUES('kernel-api-family','Kernel API Family','KAF')");
  for (const [id, role] of [[owner, 'boss'], [member, 'soldier']]) {
    await app.pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('kernel-api-crew',$1,$1)", [id]);
    await app.pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('kernel-api-family',$1,$2)", [`${id}-ch`, role]);
  }
  await withItemTransaction(app.pool, async (client) => {
    await grantStack(client, { scope: 'account', id: owner }, 'mat:scrap_steel', 4, 'standard', 'HTTP proof fixture', key());
    await grantStack(client, { scope: 'account', id: owner }, 'mat:wire', 4, 'standard', 'HTTP proof fixture', key());
  });
  const unknownRecipe = ok(await request(app, 'GET', recipesPath, ownerToken)).recipes.find((recipe) => recipe.id === WORLD_KERNEL_RECIPE);
  assert.equal(unknownRecipe.available, false);
  assert(unknownRecipe.blockedBy.some((blocker) => blocker.adapter === 'knowledge'));
  assert.doesNotMatch(JSON.stringify(unknownRecipe), /sourceRoot|assembled-after-the-fire|ledger\.assembly/,
    'A blocked recipe names no hidden knowledge proposition');
  const lockedCraft = await request(app, 'POST', craftPath, ownerToken, {}, key());
  assert.equal(lockedCraft.statusCode, 400); assert.equal(lockedCraft.json().error, 'knowledge_required');

  // preValidation must see the original body before Fastify can strip/coerce fields.
  for (const body of [
    {}, [], { itemId: 'absent', expectedRevision: '0' }, { itemId: 'absent', expectedRevision: false },
    { itemId: 'absent', expectedRevision: -1 }, { itemId: 'absent', expectedRevision: 0.5 },
    { itemId: 123, expectedRevision: 0 }, { itemId: 'two words', expectedRevision: 0 },
    { itemId: 'absent', expectedRevision: 0, accountId: member },
    { itemId: 'absent', expectedRevision: 2147483648 },
  ]) assert.equal((await request(app, 'POST', actionPath, ownerToken, body, key())).statusCode, 400, JSON.stringify(body));
  for (const body of [[], { owner: member }, { amount: 1 }]) {
    assert.equal((await request(app, 'POST', craftPath, ownerToken, body, key())).statusCode, 400);
  }
  const nullCraft = await app.inject({ method: 'POST', url: craftPath, payload: 'null',
    headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', 'idempotency-key': key() } });
  assert.equal(nullCraft.statusCode, 400);
  assert.equal(nullCraft.json().error, 'bad_world_request', 'Explicit JSON null is not an empty request object');
  for (const path of paths) assert.equal((await request(app, 'GET', `${path}?accountId=${member}`, ownerToken)).statusCode, 400);
  assert.equal((await request(app, 'POST', `${craftPath}?quantity=2`, ownerToken, {}, key())).statusCode, 400);
  assert.equal((await request(app, 'POST', craftPath, ownerToken, {})).statusCode, 400);
  assert.equal((await request(app, 'POST', actionPath, ownerToken, { itemId: 'absent', expectedRevision: 0 })).statusCode, 400);

  // Both discovery and movement use mounted HTTP commands; no claim/state rows are seeded.
  ok(await request(app, 'POST', '/v1/travel/docks', ownerToken, {}, key()));
  const catalog = ok(await request(app, 'GET', '/v1/coordination', ownerToken));
  const discovery = catalog.graphs.find((graph) => graph.id === 'omerta.coordination.split-ledger');
  assert(discovery);
  let instance = ok(await request(app, 'POST', `/v1/coordination/${discovery.id}/instances`, ownerToken,
    { expectedContentHash: discovery.contentHash }, key())).instance;
  const instancePath = `/v1/coordination/instances/${instance.id}/act`;
  instance = ok(await request(app, 'POST', instancePath, ownerToken,
    { expectedRevision: instance.revision, actionId: instance.actions[0].id }, key())).instance;
  const discover = instance.actions.find((action) => action.kind === 'discover');
  assert(discover);
  assert.equal(Object.hasOwn(discover, 'nodeId'), false, 'Undiscovered source identity stays hidden');
  ok(await request(app, 'POST', instancePath, ownerToken,
    { expectedRevision: instance.revision, actionId: discover.id }, key()));
  ok(await request(app, 'POST', '/v1/travel/foundry', ownerToken, {}, key()));
  const learned = ok(await request(app, 'GET', recipesPath, ownerToken)).recipes.find((recipe) => recipe.id === WORLD_KERNEL_RECIPE);
  assert.equal(learned.available, true, JSON.stringify(learned));
  assert(ok(await request(app, 'GET', '/v1/worldgraph/state', ownerToken)).nodes.some((node) => node.type === 'knowledge'));
  assert.equal(ok(await request(app, 'GET', '/v1/worldgraph/objects', ownerToken)).objects[0].state, 'sealed');
  assert.deepEqual(ok(await request(app, 'GET', '/v1/worldgraph/objects', observerToken)).objects, []);

  async function loseHttpReceipt(url, body, commandKey) {
    const original = app.pool.query; let intercepted = 0;
    app.pool.query = async function (sql, args) {
      if (String(sql).startsWith('UPDATE idempotency SET status') && args?.[1] === commandKey && !intercepted++) {
        throw Error('kernel API proof: lost HTTP receipt acknowledgement');
      }
      return original.call(this, sql, args);
    };
    let response;
    try { response = await request(app, 'POST', url, ownerToken, body, commandKey); }
    finally { app.pool.query = original; }
    assert.equal(intercepted, 1);
    ok(response);
    assert.equal((await app.pool.query('SELECT status FROM idempotency WHERE account_id=$1 AND key=$2', [owner, commandKey])).rows[0].status, 0);
    return response;
  }
  const craftKey = key();
  const crafted = await loseHttpReceipt(craftPath, {}, craftKey);
  const craftedBody = crafted.json(), itemId = craftedBody.outputs[0].id;
  assert(itemId, crafted.body);
  assert.deepEqual(ok(await request(app, 'POST', craftPath, ownerToken, {}, craftKey)), craftedBody);
  const craftReplay = await request(app, 'POST', craftPath, ownerToken, {}, craftKey);
  assert.equal(craftReplay.headers['x-idempotent-replay'], 'true');
  assert.deepEqual(craftReplay.json(), craftedBody);
  assert.equal(Number((await app.pool.query("SELECT count(*) AS n FROM item_instances WHERE template_id='item:archive_turn_key'")).rows[0].n), 1);
  const action = { itemId, expectedRevision: 0 };
  const memberDenied = await request(app, 'POST', actionPath, memberToken, action, key());
  assert.equal(memberDenied.statusCode, 403, memberDenied.body);
  const missingItem = await request(app, 'POST', actionPath, ownerToken, { ...action, itemId: 'absent' }, key());
  assert.equal(missingItem.statusCode, 404, missingItem.body);
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM world_kernel_objects')).rows[0].n), 0, 'Failed action leaves no initialized object');
  const actionKey = key(), executed = await loseHttpReceipt(actionPath, action, actionKey);
  assert.equal(executed.json().state, 'open');

  // Force both requests to observe the pending HTTP receipt before domain replay.
  const original = app.pool.query; let readers = 0, release;
  const both = new Promise((resolve) => { release = resolve; });
  const timer = setTimeout(release, 5000);
  app.pool.query = async function (sql, args) {
    const result = await original.call(this, sql, args);
    if (String(sql).startsWith('SELECT status, body_hash, response FROM idempotency') && args?.[1] === actionKey) {
      assert.equal(result.rows[0].status, 0);
      if (++readers === 2) release();
      await both;
    }
    return result;
  };
  let duplicate;
  try { duplicate = await Promise.all([0, 1].map(() => request(app, 'POST', actionPath, ownerToken, action, actionKey))); }
  finally { clearTimeout(timer); release(); app.pool.query = original; }
  assert.equal(readers, 2);
  for (const response of duplicate) assert.deepEqual(ok(response), executed.json());
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM world_kernel_events')).rows[0].n), 1);
  const mismatch = await request(app, 'POST', actionPath, ownerToken, { ...action, expectedRevision: 1 }, actionKey);
  assert.equal(mismatch.statusCode, 422); assert.equal(mismatch.json().error, 'idempotency_key_reuse');
  assert.equal((await request(app, 'POST', actionPath, ownerToken, action, key())).statusCode, 409);
  const opened = ok(await request(app, 'GET', objectPath, observerToken));
  assert.equal(opened.state, 'open'); assert.equal(opened.revision, 1);
  assert.equal(ok(await request(app, 'GET', '/v1/worldgraph/objects', observerToken)).objects[0].id, objectId);
  assert(!ok(await request(app, 'GET', '/v1/worldgraph/state', observerToken)).nodes.some((node) => node.type === 'knowledge'),
    'A public world transition does not disclose the discoverer\'s private knowledge');
  assert.equal((await app.pool.query('SELECT state FROM item_instances WHERE id=$1', [itemId])).rows[0].state, 'consumed');
  const stock = (await app.pool.query("SELECT template_id,quantity FROM item_stacks WHERE owner_scope='account' AND owner_id=$1", [owner])).rows;
  assert.equal(stock.find((row) => row.template_id === 'mat:scrap_steel').quantity, 2);
  assert.equal(stock.find((row) => row.template_id === 'mat:wire').quantity, 2);
  assert.equal(Number((await app.pool.query("SELECT count(*) AS n FROM item_events WHERE item_id=$1 AND event_kind='consumed'", [itemId])).rows[0].n), 1);
  console.log('world-kernel-api: mounted auth/cohort, strict input, HTTP discovery/craft/action, hidden state and receipt recovery passed');
} finally {
  if (off) await off.close();
  if (app) await app.close();
  restore();
}
