import assert from 'node:assert/strict';
import { createPressureWorldAdapter, PRESSURE_WORLD_CONTRACT } from '../tools/rc1-pressure-world-adapter.js';
import { actorValueHash } from '../tools/rc1-native-actor-replay.js';

// Deterministic adapter protocol fixtures, not economic simulation or native proof.
const epoch = 1000000, DAY = 86400000;
const config = (scenario = 'resource_scarcity', n = 25) => ({ scenario, seed: 'rc1-alpha', epoch,
  roster: Array.from({ length: n }, (_, i) => ({ accountId: `pressure-${i}`, characterId: `street-${i}` })) });
function model(configuration) {
  const level = configuration.scenario === 'resource_abundance' ? 75 : 1;
  const players = new Map(configuration.roster.map(({ accountId, characterId }) => [accountId,
    { id: characterId, name: accountId, generation: 1,
      cash: level === 1 ? 0 : 500, bank: 0, ammo: level === 1 ? 0 : 25, cb: 0, omr: 0, respect: level === 1 ? 0 : 74000,
      level, nerve: 10, jailSeconds: 0, checkin: { done: false, pay: 350 * level } }]));
  const listings = new Map(), events = [], requests = []; let lot = 0, at = epoch;
  const hooks = { get logicalAt() { return at; }, read: async (accountId, path) => {
    const own = players.get(accountId); assert(own);
    if (path === '/v1/session') return { authed: true, character: { id: own.id } };
    if (path === '/v1/me') return { character: structuredClone(own) };
    if (path === '/v1/rules') return { crimes: [{ id: 'pick', lvl: 1, nerve: 2 }] };
    assert.equal(path, '/v1/exchange'); return { listings: [...listings.values()].map((row) => structuredClone(row)) };
  }, record: async (event) => {
    assert(!('policies' in event) && !('lastReceipts' in event), 'Per-step evidence cannot duplicate the roster checkpoint');
    events.push(event);
  }, execute: async (accountId, request) => {
    assert.equal(events.at(-1).kind, 'pressure-pending', 'Persist the exact identity before dispatch');
    assert.deepEqual(events.at(-1).decision.request, request);
    requests.push({ accountId, request: structuredClone(request) });
    const own = players.get(accountId); let body;
    if (request.path === '/v1/checkin') {
      assert(!own.checkin.done); const pay = own.checkin.pay; own.cash += pay; own.checkin.done = true;
      body = { ok: true, pay };
    } else if (request.path === '/v1/armory/ammo') {
      assert(own.cash >= 2000); own.cash -= 2000; own.ammo += 50; body = { ok: true, rolled: 50, cost: 2000 };
    } else if (request.path === '/v1/crimes/pick') {
      assert(own.nerve >= 2); own.nerve -= 2; own.cash += 80; own.respect += 2;
      body = { ok: true, success: true, approach: 'quiet', take: 80, rep: 2 };
    } else if (request.path === '/v1/exchange/list') {
      assert(own.ammo >= 25); own.ammo -= 25; const id = `lot-${++lot}`;
      listings.set(id, { id, kind: 'ammo', seller: own.name, qty: 25, unitPrice: 20 });
      body = { ok: true, listingId: id, kind: 'ammo', qty: 25, exchange: 'listed' };
    } else if (request.path.endsWith('/buy')) {
      const id = request.path.split('/')[3], listing = listings.get(id); assert(listing && listing.seller !== own.name);
      assert(own.cash >= 500); own.cash -= 500; own.ammo += 25; players.get(listing.seller).cash += 500; listings.delete(id);
      body = { ok: true, exchange: 'bought', kind: 'ammo', qty: 25, paid: 500 };
    } else if (request.method === 'DELETE') {
      const id = request.path.split('/')[3], listing = listings.get(id); assert.equal(listing?.seller, own.name);
      own.ammo += listing.qty; listings.delete(id); body = { ok: true, exchange: 'pulled', kind: 'ammo', qty: 25 };
    } else {
      assert.equal(request.path, '/v1/bank/deposit'); assert.equal(request.body.amount, own.cash);
      own.bank += own.cash; own.cash = 0; body = { ok: true, banked: request.body.amount };
    }
    return { status: 200, replayed: false, body };
  } };
  return { players, listings, events, requests, hooks, day(day) { at = epoch + day * DAY;
    for (const own of players.values()) { own.nerve = 10; own.checkin = { done: false, pay: (350 + 100 * day) * own.level }; } } };
}
async function prepare(adapter, hooks, maximumDecisions = 17) {
  let result; do { result = await adapter.prepare(hooks, { maximumDecisions }); } while (!result.complete);
}
async function runDay(adapter, day, hooks, maximumDecisions = 17) {
  let result; do { result = await adapter.runDay(day, hooks, { maximumDecisions }); } while (!result.complete);
}

for (const scenario of ['resource_scarcity', 'resource_abundance']) for (const n of PRESSURE_WORLD_CONTRACT.populations) {
  const configuration = config(scenario, n), world = model(configuration);
  let adapter = createPressureWorldAdapter(configuration);
  assert.throws(() => adapter.runDay(0, world.hooks), /preparation/);
  await prepare(adapter, world.hooks);
  const prepared = adapter.summary(); assert(prepared.prepared); assert.equal(prepared.entryVerified, n); assert.equal(prepared.preparedVerified, n);
  assert.equal(prepared.totals.preparation.fresh, scenario === 'resource_abundance' ? 4 * n : 0);
  assert.equal(prepared.totals.measured.fresh, 0, 'Preparation cannot count as measured pressure');
  for (const own of world.players.values()) {
    assert.equal(own.cash, scenario === 'resource_abundance' ? 20750 : 0);
    assert.equal(own.ammo, scenario === 'resource_abundance' ? 175 : 0);
  }
  adapter = createPressureWorldAdapter(configuration).restore(adapter.checkpoint());
  const first = await adapter.runDay(0, world.hooks, { maximumDecisions: 1 }); assert(!first.complete);
  adapter = createPressureWorldAdapter(configuration).restore(adapter.checkpoint());
  await runDay(adapter, 0, world.hooks);
  assert.equal(adapter.summary().observedLogicalDays, 0, 'Next scheduled day is not elapsed time');
  assert.equal(adapter.summary().completedDays, 1);
  const decisions = world.events.filter((event) => event.kind === 'pressure-decision' && event.scope === 'measured');
  assert.equal(new Set(decisions.filter((event) => event.decision.phase === 'progress').map((event) => event.accountId)).size, n);
  assert(decisions.some((event) => event.role === 'seller' && event.decision.phase === 'list'));
  assert(decisions.some((event) => event.role === 'taker' && event.decision.phase === 'take'));
  assert(decisions.some((event) => event.role === 'hoarder' && event.decision.phase === 'hoard'));
  assert.equal(world.listings.size, 0, 'Receipt-linked seller cleanup leaves no fixture lot');
  assert.throws(() => adapter.runDay(2, world.hooks), /consecutively/);
  assert.throws(() => adapter.runDay(1, world.hooks), /worker/);
  if (n === 25) for (let day = 1; day <= 2; day++) { world.day(day); await runDay(adapter, day, world.hooks); }
  if (n === 25) for (const actor of configuration.roster) assert.equal(new Set(world.events.filter((event) =>
    event.kind === 'pressure-decision' && event.scope === 'measured' && event.accountId === actor.accountId).map((event) => event.role)).size, 3,
  'Daily rotation visits every role for every actor');
  assert.equal(adapter.summary().matrixQualifying, false);
}

const configuration = config(), world = model(configuration);
let adapter = createPressureWorldAdapter(configuration); await prepare(adapter, world.hooks);
const pause = await adapter.runDay(0, world.hooks, { maximumDecisions: 1, pauseBeforeDispatch: true });
assert(pause.paused); assert.equal(world.requests.length, 0);
const pending = adapter.checkpoint(), choice = pending.payload.state.pending.decision;
adapter = createPressureWorldAdapter(configuration).restore(pending);
let response;
await adapter.runDay(0, { ...world.hooks, read: async () => assert.fail('A pending request must not reselect from a fresh view'),
  execute: async (accountId, request) => { assert.deepEqual(request, choice.request); response = await world.hooks.execute(accountId, request); return response; }
}, { maximumDecisions: 1 });
adapter.settleExactReplay('pressure-0', choice, { ...response, replayed: true });
assert.equal(adapter.summary().totals.measured.fresh, 1); assert.equal(adapter.summary().exactReplays, 1);
assert.throws(() => adapter.settleExactReplay('pressure-0', { ...choice, phase: 'take' }, { ...response, replayed: true }), /changed/);
const unknown = createPressureWorldAdapter(configuration).restore(pending);
assert(unknown.settle({ ...response, replayed: true }).blocked);
assert.equal(unknown.summary().totals.measured.fresh, 0);
await assert.rejects(createPressureWorldAdapter(configuration).restore(unknown.checkpoint()).runDay(0, world.hooks), /Unresolved/);
const corrupt = structuredClone(pending); corrupt.payload.state.pending.decision.request.path = '/other'; corrupt.sha256 = actorValueHash(corrupt.payload);
assert.throws(() => createPressureWorldAdapter(configuration).restore(corrupt), /mismatch/);
const wrongCursor = structuredClone(pending); wrongCursor.payload.state.day.stage = 1; wrongCursor.sha256 = actorValueHash(wrongCursor.payload);
assert.throws(() => createPressureWorldAdapter(configuration).restore(wrongCursor), /phase\/cursor mismatch/);
const wrongQuote = createPressureWorldAdapter(configuration).restore(pending);
assert.throws(() => wrongQuote.settle({ status: 200, replayed: false, body: { ok: true, pay: 351 } }), /observed public quote/);
assert(wrongQuote.cursor().pending, 'An inconsistent receipt cannot erase the pending identity');
assert.throws(() => createPressureWorldAdapter({ ...configuration, observer: {} }), /configuration/);

const lostWorld = model(configuration); adapter = createPressureWorldAdapter(configuration); await prepare(adapter, lostWorld.hooks);
await assert.rejects(adapter.runDay(0, { ...lostWorld.hooks, execute: async () => { throw Error('response-lost'); } }), /response-lost/);
const lost = adapter.cursor().pending; assert.equal(lost.dispatchState, 'DISPATCHING');
adapter = createPressureWorldAdapter(configuration).restore(adapter.checkpoint());
await adapter.runDay(0, { ...lostWorld.hooks, read: async () => assert.fail('Do not reselect after a missing response'),
  execute: async (accountId, request) => { assert.deepEqual(request, lost.decision.request); return lostWorld.hooks.execute(accountId, request); }
}, { maximumDecisions: 1 });
assert.equal(adapter.summary().totals.measured.fresh, 1);

const abundant = config('resource_abundance'), deniedWorld = model(abundant);
adapter = createPressureWorldAdapter(abundant);
await assert.rejects(adapter.prepare({ ...deniedWorld.hooks, execute: async () => ({ status: 400, replayed: false, body: { error: 'cash' } }) }), /preparation was denied/);
assert.equal(adapter.summary().prepared, false); assert.equal(adapter.summary().preparationFailed, true);
await assert.rejects(createPressureWorldAdapter(abundant).restore(adapter.checkpoint()).prepare(deniedWorld.hooks), /Failed preparation/);
const wrongSupply = model(configuration); wrongSupply.players.get('pressure-0').cash = 501;
await assert.rejects(createPressureWorldAdapter(configuration).prepare(wrongSupply.hooks), /entry cash/);
for (const [field, value] of [['cash', 500], ['bank', 1], ['ammo', 25], ['generation', 2]]) {
  const wrongFloor = model(configuration); wrongFloor.players.get('pressure-0')[field] = value;
  await assert.rejects(createPressureWorldAdapter(configuration).prepare(wrongFloor.hooks), new RegExp('entry ' + field));
}
const earnedPreparation = model(configuration);
for (const own of earnedPreparation.players.values()) {
  own.respect = 15; own.level = 2; own.health = 65; own.energy = 12; own.checkin = { done: true, pay: 700 };
}
const earnedAdapter = createPressureWorldAdapter(configuration); await prepare(earnedAdapter, earnedPreparation.hooks);
assert.equal(earnedAdapter.summary().preparedVerified, 25, 'Actual canonical progression and used check-in must remain valid');
assert.equal(earnedPreparation.requests.length, 0, 'Scarcity verification cannot repeat depletion or top-up');
const legacyPrepared = earnedAdapter.checkpoint(); legacyPrepared.payload.state.version = 1;
legacyPrepared.sha256 = actorValueHash(legacyPrepared.payload);
assert.throws(() => createPressureWorldAdapter(configuration).restore(legacyPrepared), /earlier initial-supply contract/);
const wrongLevel = model(abundant); wrongLevel.players.get('pressure-0').level = 74;
await assert.rejects(createPressureWorldAdapter(abundant).prepare(wrongLevel.hooks), /progression level/);
console.log('PASS_SCOPED: both pressure scenarios/all five populations, pre-baseline canonical preparation protocol, daily public roles, bounded records, shortages, pending/replay restore and invalid preparation');
