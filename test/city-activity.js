import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createCityActivityRegistry, cityOwnerActivityCategory } from '../src/city-activity.js';
import { CROSS_DOCK_SCHEMAS } from '../src/crossdocking-contracts.js';
import { PRODUCTION_SLOT_SCHEMAS } from '../src/productionslots-contracts.js';
import { MERCHANT_RETURN_SCHEMAS } from '../src/merchantreturns-contracts.js';
import { recordPlayerIntel } from '../src/playerintel.js';
import { buildServer } from './server-fixture.js';
import { bus } from '../src/game.js';
import { FURNACE_IDS } from '../src/content/furnace-ledger.js';
import { addPlayer, findCommand } from './lib/player-command-support.js';

// Exact lifetime/capacity checks use a controlled clock; HTTP tests below use a
// disposable database and the real auth, mutation, replay and presence hooks.
let now = Date.parse('2026-10-16T12:00:00Z');
const registry = createCityActivityRegistry({ now: () => now, ttlMs: 60000, limit: 2 });
const row = { id: 'actor-a', account_id: 'account-a', generation: 1, loc: 'neon', alive: true };
const viewer = { district: 'neon' };
registry.record(row, row, 'den');
const first = registry.read(row, viewer);
assert.deepEqual(Object.keys(first).sort(), ['at', 'id', 'kind', 'label', 'venueId']);
assert.equal(first.kind, 'play');
first.label = 'External mutation';
assert.equal(registry.read(row, viewer).label, 'At the tables');
assert.equal(registry.read(row, { district: 'docks' }), null);
for (const stale of [{ ...row, account_id: 'other' }, { ...row, generation: 2 }, { ...row, loc: 'docks' }, { ...row, alive: false }]) {
  assert.equal(registry.read(stale, viewer), null);
}
now += 59999;
assert(registry.read(row, viewer), 'Activity survives the normal 30-second roster refresh.');
now++;
assert.equal(registry.read(row, viewer), null, 'Activity expires at 60 seconds.');
for (const [before, after, category, destination] of [
  [row, { ...row, id: 'heir' }, 'den'],
  [row, { ...row, generation: 2 }, 'den'],
  [row, { ...row, account_id: 'other' }, 'den'],
  [row, { ...row, alive: false }, 'den'],
  [row, { ...row, loc: 'docks' }, 'den'],
  [row, { ...row, loc: 'docks' }, 'move', 'canal'],
  [null, row, 'den'], [row, row, 'private'], [row, row, 'toString'],
]) {
  registry.record(before, after, category, destination);
  assert.equal(registry.read(after, { district: after.loc }), null);
}
const arrived = { ...row, loc: 'docks' };
registry.record(row, arrived, 'move', 'docks');
assert.equal(registry.read(arrived, { district: 'docks' }).kind, 'move');
assert.equal(registry.read(row, viewer), null, 'Arrival does not remain in the previous district.');
const b = { ...row, id: 'actor-b' }, c = { ...row, id: 'actor-c' };
registry.record(b, b, 'crime');
registry.record(c, c, 'market');
assert.equal(registry.read(arrived, { district: 'docks' }), null, 'The oldest entry is evicted at capacity.');
assert(registry.read(b, viewer)); assert(registry.read(c, viewer));
registry.record(b, b, 'vice');
registry.record(arrived, arrived, 'world');
assert.equal(registry.read(c, viewer), null, 'Updating an actor refreshes its capacity position.');
assert.equal(createCityActivityRegistry().read(row, viewer), null, 'A new server registry starts empty.');
assert.throws(() => createCityActivityRegistry({ ttlMs: Infinity }), TypeError);
assert.throws(() => createCityActivityRegistry({ limit: 0 }), TypeError);
for (const route of ['GET /v1/bank', 'HEAD /v1/train/:stat', 'POST /v1/auth/logout-all', 'POST /v1/access/session',
  'POST /v1/admin/reset', 'DELETE /v1/mod/accounts/:id', 'POST /v1/screens', 'POST /v1/commands/observations',
  'POST /v1/broadcast/shared', 'POST /v1/push/subscribe', 'POST /v1/bond/quote', 'POST /v1/company/intelligence/:id/preview',
  'POST /v1/company/forecast/:id', 'POST /v1/company/demand/:id/scenario',
  'POST /v1/train/muscle?target=someone', 'POST /v1/../admin/reset', 'POST /outside']) {
  assert.equal(cityOwnerActivityCategory(route), null, route);
}
for (const [route, category] of [['POST /v1/train/:stat', 'train'], ['POST /v1/regimen/:id', 'train'],
  ['POST /v1/bank/:dir', 'bank'], ['POST /v1/city/home/workbench/craft', 'craft'],
  ['PATCH /v1/buildings/:id', 'property'], ['DELETE /v1/crew/:id', 'social'],
  ['PUT /v1/company/production/:id', 'work'], ['POST /v1/commands', 'work'],
  ['POST /v1/company/forecast/:id/apply', 'work'], ['POST /v1/company/demand/:id/apply', 'work']]) {
  assert.equal(cityOwnerActivityCategory(route), category, route);
}
const ownerRegistry = createCityActivityRegistry({ ownerOnly: true, now: () => now, ttlMs: 60000, limit: 2 });
const ownerView = actor => ({ characterId: actor.id, generation: Number(actor.generation), district: actor.loc });
registry.record(row, row, 'bank');
assert.equal(registry.read(row, viewer), null, 'Private categories are rejected by the public registry.');
ownerRegistry.record(row, row, 'bank', undefined, 'private-receipt-key');
assert.equal(ownerRegistry.read(row, ownerView(row)).id, 'owner:private-receipt-key');
assert.equal(ownerRegistry.read({ ...row, account_id: 'other' }, ownerView(row)), null);
assert.equal(ownerRegistry.read(row, viewer), null, 'Owner reads require an explicit viewer identity.');
assert.equal(ownerRegistry.read(row, ownerView(b)), null, 'Another actor in the same district cannot read owner receipts.');
assert.equal(ownerRegistry.read(row, ownerView({ ...row, generation: 2 })), null, 'A successor viewer cannot read the previous generation receipt.');
ownerRegistry.record(row, row, 'work', undefined, 'bad key');
assert.match(ownerRegistry.read(row, ownerView(row)).id, /^owner:[0-9a-f-]{36}$/);
assert.equal(ownerRegistry.read(row, ownerView(row)).label, 'Action completed');
now += 60000;
assert.equal(ownerRegistry.read(row, ownerView(row)), null, 'Owner receipts expire under the same TTL.');
ownerRegistry.record(row, row, 'work');
now--;
assert.equal(ownerRegistry.read(row, ownerView(row)), null, 'Future-dated owner receipts fail closed after clock rollback.');
ownerRegistry.record(b, b, 'work');
now--;
ownerRegistry.record(c, c, 'work');
assert.equal(ownerRegistry.read(b, ownerView(b)), null, 'Recording after clock rollback clears older clock state.');
assert(ownerRegistry.read(c, ownerView(c)));

assert(!process.env.DATABASE_URL, 'City activity HTTP fixtures require disposable pg-mem.');
const flags = ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE',
  'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS', 'COORDINATION_ACCOUNT_IDS'];
const prior = Object.fromEntries(flags.map(flag => [flag, process.env[flag]]));
const commandAccount = 'city-activity-command-owner';
for (const flag of flags.slice(0, -1)) process.env[flag] = 'on';
process.env.COORDINATION_ACCOUNT_IDS = commandAccount;
const app = await buildServer(), completed = new Map(), wire = [];
const onActivity = event => wire.push(event);
bus.on('activity', onActivity);
let changeBeforeResponse = null;
let trustedResponseReplay = false;
app.addHook('preSerialization', async (_req, _reply, payload) => trustedResponseReplay ? { ...payload, replayed: true } : payload);
app.addHook('onSend', async (req, _reply, payload) => {
  if (req.headers['x-city-test-race'] && changeBeforeResponse) await changeBeforeResponse();
  return payload;
});
app.addHook('onResponse', async req => completed.get(req.headers['x-city-test-request'])?.());
async function call(options, server = app, origin = null) {
  const id = crypto.randomUUID();
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  completed.set(id, finish);
  const timer = setTimeout(() => finish(new Error('City activity response hook timed out.')), 10000);
  try {
    const headers = { ...options.headers, 'x-city-test-request': id };
    let response;
    if (origin) {
      if (options.payload !== undefined) headers['content-type'] = 'application/json';
      const fetched = await fetch(new URL(options.url, origin), { method: options.method || 'GET', headers,
        body: options.payload === undefined ? undefined : JSON.stringify(options.payload), signal: AbortSignal.timeout(10000) });
      const body = await fetched.text();
      response = { statusCode: fetched.status, headers: Object.fromEntries(fetched.headers), body, json: () => JSON.parse(body) };
    } else response = await server.inject({ ...options, headers });
    const error = await done;
    if (error) throw error;
    return response;
  } finally { clearTimeout(timer); completed.delete(id); }
}
async function actor(name, loc = 'neon') {
  const guest = await call({ method: 'POST', url: '/v1/auth/guest' });
  assert.equal(guest.statusCode, 200, guest.body);
  const headers = { authorization: 'Bearer ' + guest.json().token };
  const created = await call({ method: 'POST', url: '/v1/character', headers, payload: { name } });
  assert.equal(created.statusCode, 200, created.body);
  const character = (await app.pool.query('SELECT id,account_id FROM characters WHERE name=$1 AND alive', [name])).rows[0];
  await app.pool.query('UPDATE characters SET loc=$2,cash=100000,nerve=100,energy=200 WHERE id=$1', [character.id, loc]);
  return { ...character, headers };
}
async function presence(person, server = app, origin = null) {
  const response = await call({ url: '/v1/city/presence?limit=40', headers: person.headers }, server, origin);
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.headers['cache-control'], 'private, no-store');
  return response.json();
}
async function meet(observer, person, server = app, origin = null) {
  const action = (await presence(observer, server, origin)).actors.find(a => a.id === person.id).actions[0];
  const response = await call({ method: action.method, url: action.path,
    headers: { ...observer.headers, 'idempotency-key': crypto.randomUUID() }, payload: action.body }, server, origin);
  assert.equal(response.statusCode, 200, response.body);
}
const dice = (person, headers = {}, amount = 500) => call({ method: 'POST', url: '/v1/casino/dice',
  headers: { ...person.headers, ...headers }, payload: { amount } });
try {
  const observer = await actor('Activity Observer'), active = await actor('Activity Actor');
  const distant = await actor('Activity Distant', 'docks'), privateActor = await actor('Activity Private');
  const turnover = await actor('Activity Turnover'), traveling = await actor('Activity Traveler', 'docks');
  await meet(observer, turnover);
  await app.pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [observer.id]);
  await meet(observer, traveling);
  await app.pool.query("UPDATE characters SET loc='neon' WHERE id=$1", [observer.id]);
  assert.equal((await call({ url: '/v1/city/presence' })).statusCode, 401);
  assert.equal((await presence(observer)).actors.find(a => a.id === active.id).activity, undefined);
  const key = crypto.randomUUID();
  const action = await dice(active, { 'idempotency-key': key });
  assert.equal(action.statusCode, 200, action.body);
  const unknownCard = (await presence(observer)).actors.find(a => a.id === active.id);
  assert.equal(unknownCard.activity, undefined, 'An unknown face exposes no activity to correlate with the named wire.');
  for (const field of ['name', 'level', 'gangTag', 'online', 'lastSeenDistrict', 'observedAt', 'source', 'sourceName']) {
    assert.equal(unknownCard[field], null, 'Public activity must not identify an unknown person: ' + field);
  }
  await meet(observer, active);
  const card = (await presence(observer)).actors.find(a => a.id === active.id);
  assert.equal(card.name, 'Activity Actor'); assert.equal(card.source, 'city_encounter'); assert(card.observedAt);
  assert.equal(card.activity.kind, 'play');
  assert.deepEqual(Object.keys(card.activity).sort(), ['at', 'id', 'kind', 'label', 'venueId']);
  const observerReceipt = (await presence(observer)).viewer.activity;
  assert(!(await presence(distant)).actors.some(a => a.id === active.id));
  const ownPublic = await presence(active);
  assert(!ownPublic.actors.some(a => a.id === active.id), 'The roster does not echo the viewer.');
  assert.equal(ownPublic.viewer.activity.id, 'owner:' + key);
  assert.equal(ownPublic.viewer.activity.kind, 'play');
  assert(!JSON.stringify(card).includes(key), 'A public actor never exposes the owner idempotency key.');
  assert.equal(wire.length, 1);
  assert.deepEqual(Object.keys(wire[0]).sort(), ['cat', 'text', 'type', 'who'], 'The global wire gains no identity/location fields.');
  const replay = await dice(active, { 'idempotency-key': key });
  assert.equal(replay.headers['x-idempotent-replay'], 'true');
  assert.deepEqual((await presence(observer)).actors.find(a => a.id === active.id).activity, card.activity);
  assert.deepEqual((await presence(active)).viewer.activity, ownPublic.viewer.activity);
  assert.equal(wire.length, 1, 'A replay does not publish another activity event.');
  trustedResponseReplay = true;
  const domainWireReplay = await dice(active);
  trustedResponseReplay = false;
  assert.equal(domainWireReplay.statusCode, 200, domainWireReplay.body);
  assert.equal(domainWireReplay.json().replayed, true);
  assert.equal(domainWireReplay.headers['x-idempotent-replay'], undefined);
  assert.deepEqual((await presence(observer)).actors.find(a => a.id === active.id).activity, card.activity);
  assert.deepEqual((await presence(active)).viewer.activity, ownPublic.viewer.activity);
  assert.equal(wire.length, 1, 'A trusted domain replay suppresses public, owner and global activity.');
  assert.equal((await dice(privateActor, {}, 1)).statusCode, 400);
  assert.equal((await presence(privateActor)).viewer.activity, undefined, 'Failed actions do not create owner receipts.');
  await app.pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [privateActor.account_id]);
  const trainingKey = crypto.randomUUID();
  const training = await call({ method: 'POST', url: '/v1/train/muscle', headers: { ...privateActor.headers, 'idempotency-key': trainingKey } });
  assert.equal(training.statusCode, 200, training.body);
  const trainingReceipt = (await presence(privateActor)).viewer.activity;
  assert.equal(trainingReceipt.id, 'owner:' + trainingKey); assert.equal(trainingReceipt.kind, 'train');
  assert.equal((await presence(observer)).actors.find(a => a.id === privateActor.id).activity, undefined, 'An agent training is visible only to its owner.');
  const bankKey = crypto.randomUUID();
  const bankRequest = { method: 'POST', url: '/v1/bank/deposit', headers: { ...privateActor.headers, 'idempotency-key': bankKey }, payload: { amount: 500 } };
  const privateAction = await call(bankRequest);
  assert.equal(privateAction.statusCode, 200, privateAction.body);
  const bankReceipt = (await presence(privateActor)).viewer.activity;
  assert.equal(bankReceipt.id, 'owner:' + bankKey); assert.equal(bankReceipt.label, 'Banking');
  assert.deepEqual(Object.keys(bankReceipt).sort(), ['at', 'id', 'kind', 'label', 'venueId']);
  const bankReplay = await call(bankRequest);
  assert.equal(bankReplay.headers['x-idempotent-replay'], 'true');
  assert.deepEqual((await presence(privateActor)).viewer.activity, bankReceipt);
  assert.equal((await presence(observer)).actors.find(a => a.id === privateActor.id).activity, undefined);
  assert.deepEqual((await presence(observer)).viewer.activity, observerReceipt, 'Other viewers receive none of the private actor receipts.');
  assert.equal(wire.length, 1, 'Private and rejected mutations publish no activity.');
  const checkin = await call({ method: 'POST', url: '/v1/checkin', headers: privateActor.headers });
  assert.equal(checkin.statusCode, 200, checkin.body);
  const restReceipt = (await presence(privateActor)).viewer.activity;
  assert.equal(restReceipt.kind, 'rest'); assert.match(restReceipt.id, /^owner:[0-9a-f-]{36}$/);
  assert.equal((await presence(observer)).actors.find(a => a.id === privateActor.id).activity, undefined);
  const telemetry = await call({ method: 'POST', url: '/v1/screens', headers: privateActor.headers, payload: { tabs: ['map'] } });
  assert.equal(telemetry.statusCode, 200, telemetry.body);
  assert.deepEqual((await presence(privateActor)).viewer.activity, restReceipt, 'Telemetry does not replace a real action receipt.');
  await app.pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [active.account_id]);
  const agentCard = (await presence(observer)).actors.find(a => a.id === active.id);
  assert.equal(agentCard.kind, 'agent'); assert.equal(agentCard.name, 'Activity Actor'); assert.equal(agentCard.online, null);
  assert.deepEqual(agentCard.activity, card.activity);
  await app.pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [active.id]);
  assert.equal((await presence(distant)).actors.find(a => a.id === active.id).activity, undefined, 'An old action cannot migrate with its actor.');
  assert.equal((await presence(active)).viewer.activity, undefined, 'Owner receipts cannot migrate to another district.');

  changeBeforeResponse = () => app.pool.query('UPDATE characters SET generation=generation+1 WHERE id=$1', [turnover.id]);
  const oldLife = await dice(turnover, { 'x-city-test-race': 'generation' });
  assert.equal(oldLife.statusCode, 200, oldLife.body);
  assert.equal((await presence(observer)).actors.find(a => a.id === turnover.id).activity, undefined, 'A response from an old generation does not animate its successor.');
  assert.equal((await presence(turnover)).viewer.activity, undefined, 'Owner receipts cannot cross generations.');
  changeBeforeResponse = () => app.pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [turnover.id]);
  assert.equal((await dice(turnover, { 'x-city-test-race': 'location' })).statusCode, 200);
  assert.equal((await presence(distant)).actors.find(a => a.id === turnover.id).activity, undefined, 'A concurrent move invalidates a non-travel cue.');

  const travel = await call({ method: 'POST', url: '/v1/travel/neon', headers: traveling.headers });
  assert.equal(travel.statusCode, 200, travel.body);
  assert.equal((await presence(observer)).actors.find(a => a.id === traveling.id).activity.kind, 'move');
  assert.equal((await presence(traveling)).viewer.activity.kind, 'move');
  assert(!(await presence(distant)).actors.some(a => a.id === traveling.id));
  await app.pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [traveling.id]);
  changeBeforeResponse = () => app.pool.query("UPDATE characters SET loc='canal' WHERE id=$1", [traveling.id]);
  const interruptedTravel = await call({ method: 'POST', url: '/v1/travel/neon', headers: { ...traveling.headers, 'x-city-test-race': 'travel' } });
  assert.equal(interruptedTravel.statusCode, 200, interruptedTravel.body);
  await app.pool.query("UPDATE characters SET loc='canal' WHERE id=$1", [distant.id]);
  assert.equal((await presence(distant)).actors.find(a => a.id === traveling.id).activity, undefined, 'Travel only publishes at the executed destination.');
  assert.equal((await presence(traveling)).viewer.activity, undefined);

  const unseenAgent = await actor('Activity Unseen Agent'), resident = await actor('Activity Resident');
  await app.pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [unseenAgent.account_id]);
  await app.pool.query('UPDATE characters SET is_npc=true WHERE id=$1', [resident.id]);
  assert.equal((await dice(unseenAgent)).statusCode, 200);
  const unseenCard = (await presence(observer)).actors.find(a => a.id === unseenAgent.id);
  assert.equal(unseenCard.kind, 'agent'); assert.equal(unseenCard.name, null); assert.equal(unseenCard.activity, undefined);
  assert.equal((await presence(unseenAgent)).viewer.activity.kind, 'play', 'Unknown agents still receive their own activity.');
  assert.equal((await dice(resident)).statusCode, 200);
  assert.equal((await presence(observer)).actors.find(a => a.id === resident.id).activity.kind, 'play', 'Public residents need no prior private observation.');

  await addPlayer(app.pool, commandAccount);
  const commander = { headers: { authorization: 'Bearer ' + app.jwt.sign({ sub: commandAccount, tv: 0 }) } };
  const board = await call({ url: '/v1/commands', headers: commander.headers });
  assert.equal(board.statusCode, 200, board.body);
  const command = findCommand(board.json(), 'mystery.start', { graphId: FURNACE_IDS.inspection });
  const executionId = command.executionIdentity.executionId;
  const execute = { method: 'POST', url: '/v1/commands/execute',
    headers: { ...commander.headers, 'idempotency-key': executionId }, payload: { executionId, confirmed: true } };
  const executed = await call(execute);
  assert.equal(executed.statusCode, 200, executed.body); assert.equal(executed.json().replayed, false);
  const deposit = await call({ method: 'POST', url: '/v1/bank/deposit', headers: commander.headers, payload: { amount: 500 } });
  assert.equal(deposit.statusCode, 200, deposit.body);
  const newerReceipt = (await presence(commander)).viewer.activity;
  assert.equal(newerReceipt.label, 'Banking');
  const commandReplay = await call(execute);
  assert.equal(commandReplay.statusCode, 200, commandReplay.body);
  assert.equal(commandReplay.json().replayed, true); assert(commandReplay.json().projection);
  assert.equal(commandReplay.headers['x-idempotent-replay'], undefined);
  assert.deepEqual((await presence(commander)).viewer.activity, newerReceipt, 'Domain replay cannot replace a newer owner action.');
  const compressedReplay = await call({ ...execute, headers: { ...execute.headers, 'accept-encoding': 'gzip' } });
  assert.equal(compressedReplay.statusCode, 200);
  assert.equal(compressedReplay.headers['content-encoding'], 'gzip');
  assert.equal(JSON.parse(gunzipSync(compressedReplay.rawPayload).toString('utf8')).replayed, true);
  assert.deepEqual((await presence(commander)).viewer.activity, newerReceipt, 'Compressed domain replay also preserves the newer receipt.');
  const commandCharacter = (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [commandAccount])).rows[0].id;
  const depotId = crypto.randomUUID();
  await app.pool.query(`INSERT INTO business_depots
    (id,owner_character,district,sale_price,bid_price,target_stock,reorder_at,restock_budget)
    VALUES ($1,$2,'docks',300,100,8,0,5000)`, [depotId, commandCharacter]);
  for (const [url, payload] of [
    ['/v1/company/forecast/' + depotId, { windowHours: 24, horizonHours: 4 }],
    ['/v1/company/demand/' + depotId + '/scenario', { windowHours: 24, horizonHours: 4,
      maxBudgetCash: 5000, preference: 'availability', priceChangeBps: 0, sensitivity: 'medium' }],
  ]) {
    const preview = await call({ method: 'POST', url, headers: commander.headers, payload });
    assert.equal(preview.statusCode, 200, preview.body);
    assert.deepEqual((await presence(commander)).viewer.activity, newerReceipt, 'A read-only POST does not replace the action receipt: ' + url);
  }
  console.log('city-activity: lifetime, cap, private owner receipts, redaction, public allowlist, replay, turnover and travel checks passed');
} finally {
  bus.off('activity', onActivity);
  await app.close();
  for (const [flag, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[flag]; else process.env[flag] = value;
  }
}

// Exercise the merged registrars over an actual loopback HTTP listener. Durable
// request rows survive the same completed-HTTP-receipt expiry used by the worker.
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
for (const [name, schema] of Object.entries({ ...CROSS_DOCK_SCHEMAS, ...PRODUCTION_SLOT_SCHEMAS, ...MERCHANT_RETURN_SCHEMAS })) {
  ajv.addSchema(schema, '#/components/schemas/' + name);
}
const checkedReceiptSchemas = new Set();
function checkReceiptSchema(name, receipt) {
  const valid = ajv.getSchema('#/components/schemas/' + name);
  assert(valid(receipt), name + ': ' + JSON.stringify(valid.errors));
  assert(valid({ ...receipt, replayed: true }), name + ' accepts the trusted replay marker.');
  assert(!valid({ ...receipt, replayed: false }), name + ' rejects a false replay marker.');
  assert(!valid({ ...receipt, replayed: 'true' }), name + ' rejects an untyped replay marker.');
  assert(!valid({ ...receipt, extra: true }), name + ' remains closed.');
  checkedReceiptSchemas.add(name);
}
async function marketActivityHarness(f) {
  const server = f.app, known = new Set(), publicEvents = [];
  server.addHook('onResponse', async req => completed.get(req.headers['x-city-test-request'])?.());
  const origin = await server.listen({ host: '127.0.0.1', port: 0 });
  const request = options => call(options, server, origin);
  const read = person => presence(person, server, origin);
  const observer = { id: 'other-actor', headers: { authorization: 'Bearer ' + server.jwt.sign({ sub: 'other', tv: 0 }) } };
  const onPublic = event => publicEvents.push(event);
  bus.on('activity', onPublic);
  async function mutate({ account, agent = false, path, body, schema, table, successor = false }) {
    assert(['cross_dock_requests', 'production_slot_requests', 'merchant_return_requests'].includes(table));
    const person = (await f.pool.query('SELECT id,account_id,generation,loc,name,respect FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
    person.headers = { authorization: 'Bearer ' + server.jwt.sign({ sub: account, tv: 0, ...(agent ? { agent: true } : {}) }) };
    if (agent) await f.pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [account]);
    await f.pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [observer.id, person.loc]);
    // The economy fixtures use readable synthetic IDs, outside the encounter
    // route's UUID contract. Seed its ordinary private intel through the same
    // canonical helper so redaction cannot hide an accidental public cue.
    if (!known.has(person.id)) { await recordPlayerIntel(f.pool, 'other', person, { source: 'city_encounter' }); known.add(person.id); }
    const observed = (await read(observer)).actors.find(actor => actor.id === person.id);
    assert.equal(observed.name, person.name);
    const observedBefore = observed.activity;
    const wireCount = publicEvents.length, before = await f.state(), key = crypto.randomUUID();
    const options = { method: 'POST', url: path, headers: { ...person.headers, 'idempotency-key': key }, payload: body };
    const firstResponse = await request(options);
    assert.equal(firstResponse.statusCode, 200, firstResponse.body);
    const firstReceipt = firstResponse.json();
    assert.equal(firstReceipt.replayed, undefined, 'First execution keeps its original receipt shape.');
    checkReceiptSchema(schema, firstReceipt);
    assert.notDeepEqual(await f.state(), before, path + ' performs a genuine canonical mutation.');
    const firstActivity = (await read(person)).viewer.activity;
    assert.equal(firstActivity.id, 'owner:' + key); assert.equal(firstActivity.kind, 'work');
    assert.equal(firstActivity.label, 'Action completed');
    const requestColumn = table === 'merchant_return_requests' ? 'key_hash' : 'request_key';
    const requestKey = requestColumn === 'key_hash' ? crypto.createHash('sha256').update(JSON.stringify([account, key])).digest('hex') : key;
    const durableRow = async () => (await f.pool.query('SELECT * FROM ' + table + ' WHERE account_id=$1 AND ' + requestColumn + '=$2', [account, requestKey])).rows[0];
    const stored = await durableRow(), storedBytes = JSON.stringify(stored.receipt);
    assert.deepEqual(stored.receipt, firstReceipt, 'Only the original unmarked receipt is persisted.');
    const bankKey = crypto.randomUUID();
    const banked = await request({ method: 'POST', url: '/v1/bank/deposit', headers: { ...person.headers, 'idempotency-key': bankKey }, payload: { amount: 1 } });
    assert.equal(banked.statusCode, 200, banked.body);
    const newerActivity = (await read(person)).viewer.activity;
    assert.equal(newerActivity.id, 'owner:' + bankKey);
    assert.equal(newerActivity.label, 'Banking');
    async function expireHttpReceipt() {
      assert.equal((await f.pool.query('UPDATE idempotency SET created_at=$3 WHERE account_id=$1 AND key=$2 AND status<>0',
        [account, key, new Date(Date.now() - 25 * 60 * 60 * 1000)])).rowCount, 1);
      assert.equal((await f.pool.query("DELETE FROM idempotency WHERE account_id=$1 AND key=$2 AND status<>0 AND created_at < now() - interval '24 hours'",
        [account, key])).rowCount, 1, 'The completed transport receipt expires under the worker policy.');
      assert.equal((await f.pool.query('SELECT * FROM idempotency WHERE account_id=$1 AND key=$2', [account, key])).rows.length, 0);
      assert.deepEqual(await durableRow(), stored, 'HTTP expiry preserves the durable key and every stored receipt field.');
    }
    await expireHttpReceipt();
    const economicBeforeReplay = await f.state();
    // Fetch negotiates gzip; these small DTOs may remain below the real server's
    // compression threshold. The large command receipt above proves the actual
    // gzip onSend path, without padding or changing these closed receipt DTOs.
    const replayResponse = await request({ ...options, headers: { ...options.headers, 'accept-encoding': 'gzip' } });
    assert.equal(replayResponse.statusCode, 200, replayResponse.body);
    assert.equal(replayResponse.headers['x-idempotent-replay'], undefined, 'This response came from durable domain recovery, not HTTP cache.');
    assert.match(replayResponse.headers.vary, /Accept-Encoding/i);
    assert.deepEqual((await read(person)).viewer.activity, newerActivity, 'Durable replay cannot replace a newer owner cue: ' + path);
    assert.deepEqual(replayResponse.json(), { ...firstReceipt, replayed: true });
    assert(ajv.getSchema('#/components/schemas/' + schema)(replayResponse.json()));
    assert.deepEqual(await f.state(), economicBeforeReplay, 'Durable replay changes no cash, items, journal entries, domain rows or counts.');
    assert.equal(JSON.stringify((await durableRow()).receipt), storedBytes, 'Stored receipt bytes remain unchanged.');
    assert.deepEqual(await durableRow(), stored);
    assert.deepEqual((await read(observer)).actors.find(actor => actor.id === person.id).activity, observedBefore, 'Private mutations never create observer activity.');
    assert.equal(publicEvents.length, wireCount);
    const cached = await request(options);
    assert.equal(cached.statusCode, 200, cached.body);
    assert.equal(cached.headers['x-idempotent-replay'], 'true');
    assert.deepEqual(cached.json(), replayResponse.json());
    assert.deepEqual(await f.state(), economicBeforeReplay);
    assert.deepEqual((await read(person)).viewer.activity, newerActivity);
    if (successor) {
      // Use the same generation-turnover seam as the existing city lifecycle
      // tests; no fabricated estate settlement or new heir authority is needed.
      await f.pool.query('UPDATE characters SET generation=generation+1 WHERE id=$1', [person.id]);
      assert.equal((await read(person)).viewer.activity, undefined);
      await expireHttpReceipt();
      const afterTurnover = await f.state();
      const recovered = await request(options);
      assert.equal(recovered.statusCode, 200, recovered.body);
      assert.equal(recovered.headers['x-idempotent-replay'], undefined);
      assert.deepEqual(recovered.json(), { ...firstReceipt, replayed: true });
      assert.equal((await read(person)).viewer.activity, undefined, 'An old durable receipt cannot cue a later generation.');
      assert.deepEqual(await f.state(), afterTurnover);
      assert.deepEqual(await durableRow(), stored);
    }
    console.log('city-activity: real HTTP durable-expiry ' + path + ' ' + (agent ? 'agent' : 'human') + ' PASS');
    return firstReceipt;
  }
  return { mutate, close: async () => { bus.off('activity', onPublic); await server.close(); } };
}
const crossFixtures = await import('./crossdocking-fixture.js');
const cross = await crossFixtures.fixture(true), crossActivity = await marketActivityHarness(cross);
try {
  const hub = await crossFixtures.eligibleHub(cross), network = await cross.invoke('owner', 'publish', cross.terms(await cross.tool()));
  await cross.invoke('first', 'consent', cross.ref(network)); await cross.invoke('second', 'consent', cross.ref(network));
  await cross.invoke('owner', 'dispatch', cross.ref(network));
  const dock = { schema: 'CrossDockResult', table: 'cross_dock_requests' };
  const offered = await crossActivity.mutate({ ...dock, account: 'owner', path: '/v1/company/cross-docking/offer',
    body: { networkId: network.networkId, networkSourceHash: network.sourceHash, hubId: hub.hub.id, expectedHubRevision: 2, consent: true } });
  await crossActivity.mutate({ ...dock, account: 'first', agent: true, path: '/v1/company/cross-docking/consent',
    body: { linkId: offered.linkId, sourceHash: offered.sourceHash, consent: true } });
  await cross.books();
} finally { await crossActivity.close(); }
const slots = await (await import('./productionslots-fixture.js')).fixture(true), slotActivity = await marketActivityHarness(slots);
try {
  await slots.specialize();
  const commission = await slots.funded(), slot = { schema: 'ProductionSlotResult', table: 'production_slot_requests' };
  const offered = await slotActivity.mutate({ ...slot, account: 'maker', agent: true, path: '/v1/company/production-slots/offer', body: slots.offerTerms(commission) });
  await slotActivity.mutate({ ...slot, account: 'customer', path: '/v1/company/production-slots/confirm', body: slots.ref(offered) });
  await slots.books();
} finally { await slotActivity.close(); }
const merchant = await (await import('./merchantreturns-fixture.js')).fixture(true), merchantActivity = await marketActivityHarness(merchant);
try {
  const sale = await merchant.sell(), marketReturn = { table: 'merchant_return_requests' };
  const offered = await merchantActivity.mutate({ ...marketReturn, account: 'seller', path: '/v1/items/merchant-returns/offer',
    body: sale.offerBody, schema: 'MerchantReturnOfferReceipt' });
  await merchantActivity.mutate({ ...marketReturn, account: 'buyer', agent: true, path: '/v1/items/merchant-returns/accept',
    body: merchant.ref(offered), schema: 'MerchantReturnAcceptanceReceipt' });
  await merchantActivity.mutate({ ...marketReturn, account: 'buyer', agent: true, path: '/v1/items/merchant-returns/return',
    body: merchant.ref(offered), schema: 'MerchantReturnPaidReceipt' });
  const secondSale = await merchant.sell();
  const cancelled = await merchantActivity.mutate({ ...marketReturn, account: 'seller', path: '/v1/items/merchant-returns/offer',
    body: secondSale.offerBody, schema: 'MerchantReturnOfferReceipt' });
  await merchantActivity.mutate({ ...marketReturn, account: 'seller', path: '/v1/items/merchant-returns/cancel',
    body: merchant.ref(cancelled), schema: 'MerchantReturnRefundReceipt', successor: true });
  await merchant.books();
} finally { await merchantActivity.close(); }
assert.deepEqual([...checkedReceiptSchemas].sort(), ['CrossDockResult', 'ProductionSlotResult', 'MerchantReturnOfferReceipt',
  'MerchantReturnAcceptanceReceipt', 'MerchantReturnPaidReceipt', 'MerchantReturnRefundReceipt'].sort());
console.log('city-activity: three actual market registrars, all six closed receipt schemas, durable expiry, human/agent cues and generation replay passed');
