// Current-source private API journeys: real NPC bindings, durable branches, inventory,
// learned skills, server-time windows and adversarial freshness/replay controls.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import Ajv from 'ajv';
import { makeDb } from '../src/db.js';
import { loadGraphPackages } from '../src/worldgraph.js';
import { PHASE1_WORLD_GRAPH_PACKAGES } from '../src/content/phase1.js';
import { CITY_WORLD_OPPORTUNITY_PACKAGES, CITY_NEIGHBOR_ROUTE_PASS } from '../src/content/city-world-opportunities.js';
import { createMysteryContext, mysteryDefinitionHash, startMystery } from '../src/mysteries.js';
import { withItemTransaction } from '../src/items.js';
import { register } from '../src/routes/city-world-opportunities.js';
import { CITY_WORLD_OPPORTUNITY_INDEX_SCHEMA, CITY_WORLD_OPPORTUNITY_DETAIL_SCHEMA,
  CITY_WORLD_OPPORTUNITY_RESULT_SCHEMA } from '../src/city-world-opportunities-contract.js';
import { cityWorldOpportunityControls } from './lib/city-world-opportunity-controls.js';

const postgres = process.argv.includes('--postgres');
let pool, admin, namespace, createdSchema = false, app;
function nativeEndpoint(address) {
  assert.equal(typeof address, 'string', 'An explicit City opportunities disposable native test URL is required.');
  const endpoint = new URL(address);
  assert(!endpoint.search && !endpoint.hash, 'Fixture URLs cannot override driver host or connection options');
  assert(['postgres:', 'postgresql:'].includes(endpoint.protocol));
  assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname), 'Native fixture requires loopback.');
  assert(/^\/(?:omerta_query|omerta_check|world_kernel_[a-z0-9_]+|city_homes_[a-z0-9_]+|city_opportunities_[a-z0-9_]+)$/.test(endpoint.pathname), 'Use a named test database.');
  return endpoint;
}
assert.equal(nativeEndpoint('postgresql://127.0.0.1/omerta_query').pathname, '/omerta_query');
for (const address of [undefined, 'http://127.0.0.1/omerta_query', 'postgresql://production.invalid/omerta_query',
  'postgresql://127.0.0.1/postgres', 'postgresql://127.0.0.1/live_database']) assert.throws(() => nativeEndpoint(address));
async function cleanup() {
  if (app) await app.close();
  if (pool) await pool.end();
  if (admin) {
    if (createdSchema) {
      assert(/^city_opportunities_[a-f0-9]{16}$/.test(namespace));
      const ownership = (await admin.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1', [namespace])).rows[0];
      assert.equal(ownership?.mine, true, 'Drop only the generated fixture schema owned by this connection.');
      await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
    }
    await admin.end();
  }
}
const registry = loadGraphPackages(PHASE1_WORLD_GRAPH_PACKAGES);
let time = Date.parse('2026-10-12T07:00:00.000Z');
const auth = async (req, reply) => {
  const sub = req.headers['x-test-account'];
  if (!sub) return reply.code(401).send({ error: 'unauthorized' });
  req.user = { sub };
};
try {
  if (postgres) {
    const endpoint = nativeEndpoint(process.env.CITY_WORLD_OPPORTUNITIES_TEST_DATABASE_URL);
    const { Pool } = await import('pg'); admin = new Pool({ connectionString: endpoint.toString() });
    namespace = 'city_opportunities_' + crypto.randomBytes(8).toString('hex');
    assert(/^city_opportunities_[a-f0-9]{16}$/.test(namespace));
    await admin.query(`CREATE SCHEMA ${namespace}`); createdSchema = true;
    endpoint.searchParams.set('options', `-c search_path=${namespace}`);
    process.env.DATABASE_URL = endpoint.toString();
  } else assert(!process.env.DATABASE_URL, 'Memory proof requires disposable pg-mem.');
  pool = await makeDb();
  if (postgres) {
    const provenance = (await pool.query('SELECT current_schema() AS schema,version() AS version')).rows[0];
    assert.equal(provenance.schema, namespace, 'The API must use the owned native schema.');
    assert.match(provenance.version, /^PostgreSQL /);
    console.log(JSON.stringify({ proof: 'city-world-opportunities native provenance', ...provenance }));
  }
  app = Fastify({ logger: false, ajv: { customOptions: { removeAdditional: false } } });
  register(app, { pool, auth, registry, now: () => time }); await app.ready();
} catch (error) { await cleanup(); throw error; }
const ajv = new Ajv({ strict: false });
const schemas = [CITY_WORLD_OPPORTUNITY_INDEX_SCHEMA, CITY_WORLD_OPPORTUNITY_DETAIL_SCHEMA, CITY_WORLD_OPPORTUNITY_RESULT_SCHEMA].map(schema => ajv.compile(schema));
const uuid = () => crypto.randomUUID();
const owner = { account: uuid(), character: uuid() }, other = { account: uuid(), character: uuid() };
const resident = { account: uuid(), character: uuid() }, second = { account: uuid(), character: uuid() };
async function player(value, npc = false) {
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [value.account]);
  await pool.query('INSERT INTO account_persistent(account_id,npc_flag) VALUES($1,$2)', [value.account, npc]);
  await pool.query(`INSERT INTO characters(id,account_id,name,season,loc,respect,cash,is_npc)
    VALUES($1,$2,$3,1,'docks',10000,100000,$4)`, [value.character, value.account, (npc ? 'Rosa ' : 'Tester ') + value.character.slice(0, 8), npc]);
}
const request = (account, method, url, payload, key) => app.inject({ method, url,
  headers: { ...(account ? { 'x-test-account': account } : {}), ...(key ? { 'idempotency-key': key } : {}) }, ...(payload ? { payload } : {}) });
function assertPrivate(reply) {
  assert.match(reply.headers['cache-control'] || '', /(?:^|,\s*)private(?:,|$)/);
  assert((reply.headers['cache-control'] || '').includes('no-store'));
  assert((reply.headers.vary || '').toLowerCase().split(/\s*,\s*/).includes('authorization'));
}
async function get(account, url, schema) {
  const reply = await request(account, 'GET', url);
  assertPrivate(reply);
  assert.equal(reply.statusCode, 200, reply.body);
  const result = reply.json();
  assert(schemas[schema](result), JSON.stringify(schemas[schema].errors));
  return result;
}
const index = account => get(account, '/v1/city/opportunities', 0);
const urlOf = entry => '/v1/city/opportunities/' + entry.npcId + '/' + entry.graphRef;
const detail = (account, entry) => get(account, urlOf(entry), 1);
async function invoke(account, action, key = uuid()) {
  assert(action.available, JSON.stringify(action.blockedBy));
  const reply = await request(account, action.method, action.path, action.body, key);
  assertPrivate(reply);
  assert.equal(reply.statusCode, 200, reply.body);
  const value = reply.json(); assert(schemas[2](value), JSON.stringify(schemas[2].errors));
  return value;
}
const nodeAction = (board, id) => board.nodes.find(node => node.id === id)?.actions.find(action => action.available);
const explore = board => board.actions.find(action => action.id.endsWith(':explore'));
const favor = async (value = owner) => Number((await pool.query(`SELECT favor FROM city_npc_favors WHERE owner_character_id=$1
  AND owner_generation=1 AND npc_character_id=$2 AND npc_generation=1`, [value.character, resident.character])).rows[0]?.favor || 0);
const heat = async value => Number((await pool.query('SELECT heat FROM characters WHERE id=$1', [value.character])).rows[0].heat);
async function offer(account, title) {
  return (await index(account)).opportunities.find(entry => entry.npcId === resident.character && entry.title === title);
}
async function begin(account, entry) { const board = await detail(account, entry); await invoke(account, board.actions.find(action => action.id.endsWith(':start'))); }
async function trusted(value) {
  const entry = await offer(value.account, "A Neighbor's Confidence"); await begin(value.account, entry);
  await invoke(value.account, nodeAction(await detail(value.account, entry), 'm:city-favors:meet'));
  await invoke(value.account, explore(await detail(value.account, entry)));
  const first = nodeAction(await detail(value.account, entry), 'm:city-favors:return-note'), firstKey = uuid();
  const firstResult = await invoke(value.account, first, firstKey);
  assert.deepEqual(await invoke(value.account, first, firstKey), firstResult);
  assert.deepEqual(await invoke(value.account, first, uuid()), firstResult);
  assert.equal(await favor(value), 1);
  await invoke(value.account, explore(await detail(value.account, entry)));
  const choice = (await detail(value.account, entry)).nodes.find(node => node.id === 'choice:city-favors:confidence');
  await invoke(value.account, choice.actions.find(action => action.body.optionId === 'keep-confidence'));
  assert.equal(await favor(value), 2);
  await invoke(value.account, explore(await detail(value.account, entry)));
  await invoke(value.account, nodeAction(await detail(value.account, entry), 'm:city-favors:route-pass'));
  assert.equal(await favor(value), 3);
  return entry;
}
try {
  for (const value of [owner, other]) await player(value);
  for (const value of [resident, second]) await player(value, true);
  const anonymous = await request(null, 'GET', '/v1/city/opportunities');
  assert.equal(anonymous.statusCode, 401); assertPrivate(anonymous);
  const initial = await index(owner.account);
  assert.deepEqual(initial.npcs.map(npc => npc.id).sort(), [resident.character, second.character].sort());
  assert(!JSON.stringify(initial).includes('m:city-sealed-record:drawer'));
  assert(!initial.opportunities.some(entry => entry.title === 'The Sealed Record'));
  for (const entry of [initial.opportunities.find(entry => entry.npcId === resident.character && entry.title === 'The Quiet Loading Route'),
    initial.opportunities.find(entry => entry.npcId === resident.character && entry.event && !entry.available)]) {
    const start = (await detail(owner.account, entry)).actions[0];
    assert.equal(start.available, false);
    assert.deepEqual(start.blockedBy, entry.blockedBy);
    const denied = await request(owner.account, 'POST', start.path, start.body, uuid());
    assert.notEqual(denied.statusCode, 200, 'Unavailable offers cannot create native instances.');
  }
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM mystery_instances WHERE owner_id=$1', [owner.character])).rows[0].n), 0);
  const trustEntry = await offer(owner.account, "A Neighbor's Confidence");
  const fresh = (await detail(owner.account, trustEntry)).actions[0];
  for (const extra of [{ favor: 3 }, { npcName: 'An imaginary guide' }, { nowMs: time }, { accountId: owner.account }]) {
    assert.equal((await request(owner.account, 'POST', fresh.path, { ...fresh.body, ...extra }, uuid())).statusCode, 400);
  }
  assert.equal((await request(other.account, 'GET', urlOf(trustEntry))).statusCode, 404);
  await assert.rejects(withItemTransaction(pool, client => startMystery(client,
    createMysteryContext({ registry, accountId: owner.account, now: time }), { scope: 'character', id: owner.character }, 'city-neighbor-favors', 1)),
  error => error.code === 'city_npc_context_required');
  await trusted(owner);
  const route = await offer(owner.account, 'The Quiet Loading Route'); await begin(owner.account, route);
  await invoke(owner.account, nodeAction(await detail(owner.account, route), 'm:city-loading-route:intro'));
  let routeBoard = await detail(owner.account, route);
  assert(!routeBoard.nodes.find(node => node.id === 'm:city-loading-route:trained').actions[0].available);
  await pool.query('INSERT INTO character_skills(character_id,skill_id) VALUES($1,$2)', [owner.character, 'pack_mule']);
  routeBoard = await detail(owner.account, route);
  await invoke(owner.account, nodeAction(routeBoard, 'm:city-loading-route:trained'));
  assert(!JSON.stringify(routeBoard).includes('The corridor record identifies the crate'));
  await invoke(owner.account, explore(await detail(owner.account, route)));
  await invoke(owner.account, nodeAction(await detail(owner.account, route), 'm:city-loading-route:quiet-end'));
  const secret = await offer(owner.account, 'The Sealed Record'); await begin(owner.account, secret);
  assert.equal((await detail(owner.account, secret)).nodes.length, 0);
  await invoke(owner.account, explore(await detail(owner.account, secret)));
  const drawer = nodeAction(await detail(owner.account, secret), 'm:city-sealed-record:drawer');
  const drawerKey = uuid(), drawerResult = await invoke(owner.account, drawer, drawerKey);
  assert.deepEqual(await invoke(owner.account, drawer, drawerKey), drawerResult);
  assert.equal(Number((await pool.query(`SELECT COUNT(*) n FROM item_instances WHERE owner_id=$1 AND template_id=$2 AND state='consumed'`,
    [owner.character, CITY_NEIGHBOR_ROUTE_PASS])).rows[0].n), 1);
  await invoke(owner.account, explore(await detail(owner.account, secret)));
  assert((await detail(owner.account, secret)).nodes.some(node => node.id === 'm:city-sealed-record:room'));
  await invoke(owner.account, nodeAction(await detail(owner.account, secret), 'm:city-sealed-record:room'));
  for (const [district, title, graphId, skill] of [['foundry', 'The Shutter Lock', 'city-shutter-lock', 'bruiser'],
    ['neon', 'The Careful Negotiation', 'city-careful-negotiation', 'fast_talker']]) {
    await pool.query('UPDATE characters SET loc=$1 WHERE id IN ($2,$3)', [district, owner.character, resident.character]);
    const challenge = await offer(owner.account, title); await begin(owner.account, challenge);
    await invoke(owner.account, nodeAction(await detail(owner.account, challenge), 'm:' + graphId + ':intro'));
    const blocked = (await detail(owner.account, challenge)).nodes.find(node => node.id === 'm:' + graphId + ':trained').actions[0];
    assert.equal(blocked.available, false); assert(blocked.blockedBy.some(value => value.code === 'skill'));
    assert.notEqual((await request(owner.account, 'POST', blocked.path, blocked.body, uuid())).statusCode, 200);
    await pool.query('INSERT INTO character_skills(character_id,skill_id) VALUES($1,$2)', [owner.character, skill]);
    await invoke(owner.account, nodeAction(await detail(owner.account, challenge), 'm:' + graphId + ':trained'));
    await invoke(owner.account, explore(await detail(owner.account, challenge)));
    await invoke(owner.account, nodeAction(await detail(owner.account, challenge), 'm:' + graphId + ':quiet-end'));
    assert.equal((await detail(owner.account, challenge)).graph.status, 'completed');
  }
  await pool.query("UPDATE characters SET loc='docks' WHERE id IN ($1,$2)", [owner.character, resident.character]);
  const noPassOwner = { account: uuid(), character: uuid() }; await player(noPassOwner);
  await pool.query(`INSERT INTO city_npc_favors(owner_character_id,owner_generation,npc_character_id,npc_generation,favor)
    VALUES($1,1,$2,1,3)`, [noPassOwner.character, second.character]);
  const missingPass = (await index(noPassOwner.account)).opportunities.find(entry => entry.npcId === second.character && entry.title === 'The Sealed Record');
  const missingPassStart = (await detail(noPassOwner.account, missingPass)).actions[0];
  assert(missingPass.blockedBy.some(value => value.code === 'item_ownership'));
  assert.deepEqual(missingPassStart.blockedBy, missingPass.blockedBy);
  assert.notEqual((await request(noPassOwner.account, 'POST', missingPassStart.path, missingPassStart.body, uuid())).statusCode, 200);
  await trusted(other);
  await pool.query('INSERT INTO character_skills(character_id,skill_id) VALUES($1,$2)', [other.character, 'pack_mule']);
  await pool.query('UPDATE characters SET heat=28 WHERE id=$1', [other.character]);
  const otherSecret = await offer(other.account, 'The Sealed Record'); await begin(other.account, otherSecret);
  assert(explore(await detail(other.account, otherSecret)).available);
  const noisyRoute = await offer(other.account, 'The Quiet Loading Route'); await begin(other.account, noisyRoute);
  await invoke(other.account, nodeAction(await detail(other.account, noisyRoute), 'm:city-loading-route:intro'));
  const noisy = nodeAction(await detail(other.account, noisyRoute), 'choice:city-loading-route:loud'), noisyKey = uuid();
  const noisyResult = await invoke(other.account, noisy, noisyKey);
  assert.deepEqual(noisyResult.heat, { before: 28, after: 34 });
  assert.deepEqual(await invoke(other.account, noisy, noisyKey), noisyResult);
  assert.equal(await heat(other), 34);
  assert(!explore(await detail(other.account, otherSecret)).available);
  await invoke(other.account, explore(await detail(other.account, noisyRoute)));
  await invoke(other.account, nodeAction(await detail(other.account, noisyRoute), 'm:city-loading-route:loud-end'));
  assert.equal((await detail(other.account, noisyRoute)).graph.status, 'completed');
  const rotatingOwner = { account: uuid(), character: uuid() }; await player(rotatingOwner);
  for (let phase = 0; phase < 4; phase++) {
    time = Date.parse('2026-10-12T00:00:00Z') + phase * 21600000 + 3600000;
    const available = (await index(rotatingOwner.account)).opportunities.filter(entry => entry.npcId === resident.character && entry.event && entry.available);
    assert.equal(available.length, 1);
    const event = available[0]; await begin(rotatingOwner.account, event);
    await invoke(rotatingOwner.account, nodeAction(await detail(rotatingOwner.account, event), 'm:city-rotating-account-' + phase + ':read'));
    await invoke(rotatingOwner.account, explore(await detail(rotatingOwner.account, event)));
    await invoke(rotatingOwner.account, nodeAction(await detail(rotatingOwner.account, event), 'm:city-rotating-account-' + phase + ':confirm'));
    assert.equal(await favor(rotatingOwner), Math.min(3, phase + 1));
    assert.equal((await detail(rotatingOwner.account, event)).graph.status, 'completed');
  }
  time = Date.parse('2026-10-12T07:00:00Z');
  const timed = (await index(owner.account)).opportunities.filter(entry => entry.npcId === resident.character && entry.event);
  assert.equal(timed.filter(entry => entry.available).length, 1);
  const activeEvent = timed.find(entry => entry.available);
  const eventStart = (await detail(owner.account, activeEvent)).actions[0], eventStartKey = uuid();
  const eventStarted = await invoke(owner.account, eventStart, eventStartKey);
  const eventBoard = await detail(owner.account, activeEvent), read = eventBoard.nodes.flatMap(node => node.actions).find(action => action.available);
  const eventCancel = eventBoard.actions.find(action => action.id.endsWith(':cancel'));
  for (const [account, path, body] of [[other.account, eventCancel.path, eventCancel.body],
    [owner.account, eventCancel.path.replace(activeEvent.graphRef, '0'.repeat(64)), eventCancel.body],
    [owner.account, eventCancel.path, { ...eventCancel.body, generation: 2 }],
    [owner.account, eventCancel.path, { ...eventCancel.body, instanceId: uuid() }]]) {
    assert.equal((await request(account, 'POST', path, body, uuid())).statusCode, 404);
  }
  time += 21600000;
  assert.deepEqual(await invoke(owner.account, eventStart, eventStartKey), eventStarted, 'Exact start receipt ACK survives window closure.');
  const afterWindow = await request(owner.account, 'POST', read.path, read.body, uuid());
  assert.notEqual(afterWindow.statusCode, 200);
  assert.equal((await detail(owner.account, activeEvent)).nodes.find(node => node.id === read.path.split('/nodes/')[1]?.split('/complete')[0])?.status === 'completed', false);
  const currentEvents = (await index(owner.account)).opportunities.filter(entry => entry.npcId === resident.character && entry.event);
  assert.notEqual(currentEvents.find(entry => entry.available).graphRef, activeEvent.graphRef);
  const late = nodeAction(await detail(other.account, noisyRoute), 'choice:city-loading-route:loud');
  assert.equal(late, undefined);
  await pool.query("UPDATE characters SET loc='canal' WHERE id=$1", [resident.character]);
  const staleStart = await request(owner.account, 'POST', eventStart.path, eventStart.body, uuid());
  assert.equal(staleStart.statusCode, 409); assert.equal(staleStart.json().error, 'city_npc_unavailable');
  assert.deepEqual(await invoke(owner.account, eventStart, eventStartKey), eventStarted, 'Exact start receipt ACK survives target travel.');
  const cancelKey = uuid(), canceledEvent = await invoke(owner.account, eventCancel, cancelKey);
  assert.deepEqual(await invoke(owner.account, eventCancel, cancelKey), canceledEvent, 'Issued historical cancellation survives target travel and replays exactly.');
  const stale = await request(other.account, 'POST', noisy.path, noisy.body, uuid());
  assert.equal(stale.statusCode, 409); assert.equal(stale.json().error, 'city_npc_unavailable');
  assert.deepEqual(await invoke(other.account, noisy, noisyKey), noisyResult);
  assert.equal(await heat(other), 34);
  await pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [resident.character]);
  await pool.query('UPDATE characters SET generation=2 WHERE id=$1', [other.character]);
  const changedLife = await request(other.account, 'POST', noisy.path, noisy.body, uuid());
  assert.equal(changedLife.statusCode, 409); assert.equal(changedLife.json().error, 'city_opportunity_identity_changed');
  assert.equal((await index(other.account)).npcs.find(npc => npc.id === resident.character).favor, 0);
  assert.equal(Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [owner.character])).rows[0].cash), 100000);
  const old = PHASE1_WORLD_GRAPH_PACKAGES.filter(pkg => !CITY_WORLD_OPPORTUNITY_PACKAGES.some(current => current.id === pkg.id));
  const oldRegistry = loadGraphPackages(old);
  for (const pkg of old.filter(pkg => pkg.nodes.some(node => ['mystery_step', 'world_gate', 'choice'].includes(node.type)))) {
    assert.equal(mysteryDefinitionHash(oldRegistry, pkg.id), mysteryDefinitionHash(registry, pkg.id));
  }
  await cityWorldOpportunityControls(pool, { postgres });
  console.log('city-world-opportunities API PASS: real resident/owner epochs, private discovery, durable three-stage favor, pass consumption, three learned approaches, permanent heat branch, server-clock rotation, guarded start admission/ACK, closed DTOs, replay and no currency grant; mode=' + (postgres ? 'postgres' : 'pg-mem'));
} finally { await cleanup(); }
