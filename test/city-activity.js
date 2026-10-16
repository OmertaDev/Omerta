import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { createCityActivityRegistry, cityOwnerActivityCategory } from '../src/city-activity.js';
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
async function call(options) {
  const id = crypto.randomUUID();
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  completed.set(id, finish);
  const timer = setTimeout(() => finish(new Error('City activity response hook timed out.')), 10000);
  try {
    const response = await app.inject({ ...options, headers: { ...options.headers, 'x-city-test-request': id } });
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
async function presence(person) {
  const response = await call({ url: '/v1/city/presence?limit=40', headers: person.headers });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.headers['cache-control'], 'private, no-store');
  return response.json();
}
async function meet(observer, person) {
  const action = (await presence(observer)).actors.find(a => a.id === person.id).actions[0];
  const response = await call({ method: action.method, url: action.path,
    headers: { ...observer.headers, 'idempotency-key': crypto.randomUUID() }, payload: action.body });
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
