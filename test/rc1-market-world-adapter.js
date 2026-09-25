import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMarketWorldAdapter, planMarketWorld } from '../tools/rc1-market-world-adapter.js';
import { actorValueHash } from '../tools/rc1-native-actor-replay.js';

const DAY = 86400000, rosterOf = n => Array.from({ length: n }, (_, i) => ({ accountId: 'a-' + i, characterId: 'c-' + i }));
const populations = JSON.parse(readFileSync(new URL('../docs/release/readiness-work/scenario-manifest.json', import.meta.url))).populations;
assert.deepEqual(populations, [25, 100, 250, 500, 1000]);
assert.throws(() => planMarketWorld({ seed: 'rc1-alpha', roster: rosterOf(50), day: 0 }));
const clone = structuredClone;
function world(roster) {
  let at = 0, serial = 0;
  const people = new Map(roster.map(actor => [actor.accountId, { id: actor.characterId, cash: 500, cargo: {}, cargoCap: 10,
    loc: 'docks', jailSeconds: 0, safeSeconds: 0, alive: true, checkinDay: -1 }]));
  const listings = new Map(), receipts = new Map(), notifications = new Map(roster.map(actor => [actor.accountId, []]));
  const commands = [], groups = [], checkpoints = [];
  const owner = characterId => [...people].find(([, ch]) => ch.id === characterId)?.[0];
  const notify = (accountId, type, payload) => notifications.get(accountId).push({ id: 'notice-' + ++serial, type, payload, at });
  function advance(value) {
    assert(value >= at); at = value;
    for (const listing of listings.values()) if (listing.status === 'live' && listing.expiresAt <= at) {
      listing.status = 'expired';
      if (listing.kind === 'order') {
        const refund = listing.wanted * listing.unitPrice; people.get(owner(listing.sellerId)).cash += refund; listing.wanted = 0;
        notify(owner(listing.sellerId), 'order_expired', { listing: listing.id, refunded: refund, awaiting: listing.filled });
      }
    }
  }
  const read = async (accountId, path) => {
    const ch = people.get(accountId); assert(ch);
    if (path === '/v1/session') return { authed: true, character: { id: ch.id } };
    if (path === '/v1/me') return { character: { ...clone(ch), checkin: { done: ch.checkinDay === Math.floor(at / DAY), pay: 350 } } };
    if (path === '/v1/rules') return { goods: [{ id: 'gin', base: 120 }, { id: 'coffee', base: 180 }] };
    if (path === '/v1/notifications') { const result = clone(notifications.get(accountId)); notifications.set(accountId, []); return { notifications: result }; }
    assert.equal(path, '/v1/market');
    return { levers: { minPrice: 50, listFeeBps: 100, maxTtlH: 48 }, listings: [...listings.values()].filter(row => row.status === 'live' && row.expiresAt > at).slice(0, 100)
      .map(({ id, kind, sellerId, good, qty, wanted, unitPrice, district, expiresAt }) => ({ id, kind, sellerId, good, qty, wanted, unitPrice, district, expiresSeconds: Math.ceil((expiresAt - at) / 1000) })) };
  };
  const execute = async (accountId, request) => {
    assert.equal(request.method, 'POST'); assert(request.idempotencyKey); commands.push({ accountId, request: clone(request) });
    const prior = receipts.get(request.idempotencyKey);
    if (prior) { assert.equal(prior.accountId, accountId); assert.deepEqual(prior.request, request); return { ...clone(prior.response), replayed: true }; }
    const ch = people.get(accountId); let body, status = 200;
    const deny = error => { status = 400; return { error }; };
    if (request.path === '/v1/checkin') {
      if (ch.checkinDay === Math.floor(at / DAY)) body = deny('done');
      else { ch.cash += 350; ch.checkinDay = Math.floor(at / DAY); body = { ok: true, cash: 350 }; }
    } else if (request.path === '/v1/goods/buy') {
      assert.equal(request.body.qty, 1); ch.cargo[request.body.goodId] = (ch.cargo[request.body.goodId] || 0) + 1; ch.cash -= 124;
      body = { ok: true, good: request.body.goodId, qty: 1, unit: 120, spent: 124 };
    } else if (['/v1/market', '/v1/market/order'].includes(request.path)) {
      const order = request.path.endsWith('/order'), { goodId, price, qty, hours } = request.body;
      assert.equal(qty, 1); assert([1, 24].includes(hours)); assert.equal(price, 50);
      if (!order) { assert(ch.cargo[goodId] >= 1); ch.cargo[goodId]--; }
      ch.cash -= order ? 60 : 10;
      const id = 'listing-' + ++serial, kind = order ? 'order' : 'good';
      listings.set(id, { id, kind, sellerId: ch.id, good: goodId, qty: order ? 0 : 1, wanted: order ? 1 : 0, filled: 0,
        unitPrice: price, district: ch.loc, status: 'live', expiresAt: at + hours * 3600000 });
      body = { ok: true, id, kind, good: goodId, price, expiresSeconds: hours * 3600, ...(order ? { wanted: 1, escrow: 50 } : { qty: 1 }) };
    } else {
      const match = /^\/v1\/market\/([^/]+)\/(buy|fill|claim|cancel)$/.exec(request.path); assert(match);
      const listing = listings.get(match[1]), action = match[2];
      if (!listing || action !== 'claim' && listing.status !== 'live') body = deny('no_listing');
      else if (action === 'buy') {
        assert.equal(listing.kind, 'good'); ch.cash -= 50; people.get(owner(listing.sellerId)).cash += 49;
        ch.cargo[listing.good] = (ch.cargo[listing.good] || 0) + 1; listing.qty = 0; listing.status = 'sold';
        body = { ok: true, bought: listing.good, qty: 1 };
      } else if (action === 'fill') {
        assert(ch.cargo[listing.good] >= 1 && listing.wanted > 0); ch.cargo[listing.good]--; ch.cash += 49; listing.wanted--; listing.filled++;
        notify(owner(listing.sellerId), 'order_filled', { listing: listing.id, good: listing.good, qty: 1 });
        body = { ok: true, delivered: 1, earned: 49, good: listing.good };
      } else if (action === 'claim') {
        assert.equal(listing.sellerId, ch.id); assert.equal(listing.filled, 1);
        ch.cargo[listing.good] = (ch.cargo[listing.good] || 0) + 1; listing.filled = 0; listing.status = 'sold';
        body = { ok: true, claimed: 1, awaiting: 0, good: listing.good };
      } else {
        assert.equal(listing.sellerId, ch.id); listing.status = 'cancelled';
        if (listing.kind === 'order') { const refunded = listing.wanted * 50; ch.cash += refunded; listing.wanted = 0; body = { ok: true, cancelled: listing.id, refunded }; }
        else { ch.cargo[listing.good] = (ch.cargo[listing.good] || 0) + listing.qty; listing.qty = 0; body = { ok: true, cancelled: listing.id }; }
      }
    }
    const response = { status, replayed: false, body }; receipts.set(request.idempotencyKey, { accountId, request: clone(request), response: clone(response) }); return response;
  };
  function hooks(extra = {}) { return { logicalAt: at, read, execute,
    executeGroup: async (requests, context) => { groups.push({ requests: clone(requests), context }); return Promise.all(requests.map(item => execute(item.accountId, item.request))); },
    decision: async () => {}, checkpoint: async (phase, value) => { checkpoints.push({ phase, kind: value.kind || 'full' }); }, ...extra }; }
  return { advance, hooks, people, listings, receipts, commands, groups, checkpoints };
}

let controls = 0;
for (const population of populations) for (const seed of ['rc1-alpha', 'rc1-beta', 'rc1-gamma']) {
  const roster = rosterOf(population), a = planMarketWorld({ seed, roster, day: 0 }), b = planMarketWorld({ seed, roster, day: 89 });
  for (const plan of [a, b]) { assert.equal(plan.groups.flat().length, population); assert.equal(new Set(plan.groups.flat()).size, population); assert(plan.groups.every(group => group.length >= 3 && group.length <= 5)); }
  assert.deepEqual(a, planMarketWorld({ seed, roster, day: 0 })); controls++;
}
for (const population of populations) {
  const roster = rosterOf(population), backend = world(roster), adapter = createMarketWorldAdapter({ seed: 'rc1-alpha', roster });
  const result = await adapter.runDay(0, backend.hooks());
  for (const type of ['market.post-good', 'market.buy', 'market.post-order', 'market.fill', 'market.claim', 'market.cancel']) assert(result.byType[type] > 0, type);
  assert(result.concurrentGroups > 0); assert.equal(result.serialCompetitionGroups, 0); assert.equal(result.participants, population);
  assert.equal(new Set(backend.commands.map(command => command.accountId)).size, population);
  for (const group of backend.groups) { assert(group.requests.length >= 3); assert.deepEqual(group.requests[group.context.duplicateOf], group.requests.at(-1)); assert.equal(group.context.boundary, 'quiescent-aggregate'); }
  const mixed = backend.groups.filter(group => group.context.kind === 'market-mixed-lifecycle'); assert.equal(mixed.length, 1); assert.equal(result.mixedGroups, 1);
  assert.deepEqual([...new Set(mixed[0].context.phases.map(item => item.phase))], ['sale', 'compete', 'refund-cancel', 'fill']);
  for (const { accountId, request } of mixed[0].requests) assert(backend.receipts.has(request.idempotencyKey), accountId);
  const lifecycleReceipts = mixed[0].context.phases.filter(item => item.phase !== 'compete').map(item => backend.receipts.get(mixed[0].requests[item.requestIndex].request.idempotencyKey).response);
  assert(lifecycleReceipts.every(receipt => receipt.status === 200 && !receipt.replayed));
  assert.equal(adapter.summary().expiryCandidates.length, 1); backend.advance(3600000);
  const expiry = await adapter.runTimerWindow(0, backend.hooks()); assert.equal(expiry.observed, 1); assert.equal(expiry.unresolvedCandidates, 0);
  const cash = [...backend.people.values()].reduce((sum, ch) => sum + ch.cash, 0); backend.advance(7200000);
  assert.equal((await adapter.runTimerWindow(0, backend.hooks())).observed, 0);
  assert.equal([...backend.people.values()].reduce((sum, ch) => sum + ch.cash, 0), cash); controls++;
}

// Restoring a selected request survives canonical outer JSON sorting, and the
// retained exact request executes once. Per-step evidence stays incremental.
{
  const roster = rosterOf(25), backend = world(roster), adapter = createMarketWorldAdapter({ seed: 'rc1-beta', roster });
  assert.equal((await adapter.runDay(0, backend.hooks({ pauseBeforeDispatch: true }))).paused, true);
  const checkpoint = adapter.checkpoint(), expected = checkpoint.payload.state.pending.items[0].decision.request;
  const sort = value => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : value;
  const restored = createMarketWorldAdapter({ seed: 'rc1-beta', roster }).restore(JSON.parse(JSON.stringify(sort(checkpoint))));
  await restored.runDay(0, backend.hooks({ executeGroup: undefined })); assert.deepEqual(backend.commands[0].request, expected);
  assert.equal(restored.summary().daily[0].concurrentGroups, 0); assert(restored.summary().daily[0].serialCompetitionGroups > 0);
  assert.equal(restored.summary().daily[0].serialMixedGroups, 1);
  assert(backend.checkpoints.some(row => row.kind === 'market-incremental-step')); controls++;
  const bad = clone(checkpoint); bad.payload.state.workflow.tasks.reverse(); bad.sha256 = actorValueHash(bad.payload);
  assert.throws(() => createMarketWorldAdapter({ seed: 'rc1-beta', roster }).restore(bad)); controls++;
}

// A process interruption after response persistence continues settlement,
// never issues a replacement request or pays the recorded response twice.
{
  const roster = rosterOf(25), backend = world(roster), adapter = createMarketWorldAdapter({ seed: 'rc1-alpha', roster });
  let stopped = false;
  await assert.rejects(adapter.runDay(0, backend.hooks({ checkpoint: async phase => {
    if (phase === 'responses' && !stopped) { stopped = true; throw Error('simulated stop'); }
  } })), /simulated stop/);
  const firstKey = backend.commands[0].request.idempotencyKey;
  const resumed = createMarketWorldAdapter({ seed: 'rc1-alpha', roster }).restore(adapter.checkpoint());
  await resumed.runDay(0, backend.hooks()); assert.equal(backend.commands.filter(command => command.request.idempotencyKey === firstKey).length, 1); controls++;
}

{
  const roster = rosterOf(25), backend = world(roster), adapter = createMarketWorldAdapter({ seed: 'rc1-alpha', roster });
  await assert.rejects(adapter.runDay(0, backend.hooks({ execute: async (accountId, request) => ({ ...await backend.hooks().execute(accountId, request), replayed: true }) })), /Unknown completed replay/);
  assert.equal(adapter.summary().fresh, 0); assert.equal(adapter.summary().unresolvedResponses, 1);
  const resumed = createMarketWorldAdapter({ seed: 'rc1-alpha', roster }).restore(adapter.checkpoint());
  await assert.rejects(resumed.runDay(0, backend.hooks()), /Unresolved completed/); controls++;
}

{
  const roster = rosterOf(25), backend = world(roster), adapter = createMarketWorldAdapter({ seed: 'rc1-alpha', roster });
  let refused = false;
  await assert.rejects(adapter.runDay(0, backend.hooks({ execute: async (accountId, request) => {
    if (!refused) { refused = true; return { status: 409, replayed: false, body: { error: 'in_progress' } }; }
    return backend.hooks().execute(accountId, request);
  } })), /in progress/);
  const checkpoint = adapter.checkpoint(), request = checkpoint.payload.state.pending.items[0].decision.request;
  assert.equal(checkpoint.payload.state.pending.settledCount, 0);
  const restored = createMarketWorldAdapter({ seed: 'rc1-alpha', roster }).restore(checkpoint);
  await restored.runDay(0, backend.hooks()); assert.deepEqual(backend.commands[0].request, request); controls++;
}

{
  const roster = rosterOf(25), backend = world(roster), adapter = createMarketWorldAdapter({ seed: 'rc1-alpha', roster });
  let stop = false;
  await assert.rejects(adapter.runDay(0, backend.hooks({ checkpoint: async (phase, value) => {
    if (!stop && phase === 'receipt-settled' && value.pending?.items.length >= 2 && value.pending.settledCount === 1) {
      stop = true; throw Error('partial competition settlement');
    }
  } })), /partial competition settlement/);
  const checkpoint = adapter.checkpoint(), keys = checkpoint.payload.state.pending.items.map(item => item.decision.request.idempotencyKey);
  const calls = keys.map(key => backend.commands.filter(command => command.request.idempotencyKey === key).length);
  const restored = createMarketWorldAdapter({ seed: 'rc1-alpha', roster }).restore(checkpoint); await restored.runDay(0, backend.hooks());
  assert.deepEqual(keys.map(key => backend.commands.filter(command => command.request.idempotencyKey === key).length), calls); controls++;
}

{
  const roster = rosterOf(25), backend = world(roster), adapter = createMarketWorldAdapter({ seed: 'rc1-alpha', roster });
  await adapter.runDay(0, backend.hooks()); await assert.rejects(adapter.runTimerWindow(0, backend.hooks()), /original due expiry/);
  backend.advance(3600000);
  const read = backend.hooks().read;
  const observation = await adapter.runTimerWindow(0, backend.hooks({ read: async (accountId, path) => path === '/v1/notifications'
    ? { notifications: [] } : read(accountId, path) }));
  assert.equal(observation.observed, 0); assert.equal(observation.unresolvedCandidates, 1, 'Absent public listing cannot prove expiry/refund'); controls++;
}

// Sustained daily activity, advancing ordinary logical deadlines between days.
{
  const roster = rosterOf(25), backend = world(roster), adapter = createMarketWorldAdapter({ seed: 'rc1-alpha', roster });
  assert.equal((await adapter.runDay(0, backend.hooks({ pauseBeforeDispatch: 'mixed' }))).phase, 'mixed');
  const checkpoint = adapter.checkpoint(), pending = checkpoint.payload.state.pending;
  assert.deepEqual([...new Set(pending.items.map(item => item.task.phase))], ['sale', 'compete', 'refund-cancel', 'fill']);
  assert(pending.items.every(item => !backend.receipts.has(item.decision.request.idempotencyKey)));
  const restored = createMarketWorldAdapter({ seed: 'rc1-alpha', roster }).restore(checkpoint);
  assert.equal((await restored.runDay(0, backend.hooks({ stopAfterMixed: true }))).phase, 'after-mixed');
  assert.equal(restored.summary().completedDays.length, 0); assert.equal(restored.summary().pending, false);
  const result = await restored.runDay(0, backend.hooks()); assert.equal(result.mixedGroups, 1);
  const count = backend.commands.length;
  assert.deepEqual(await restored.runDay(0, backend.hooks({ execute: () => { throw Error('duplicate day'); } })), result);
  assert.equal(backend.commands.length, count); controls++;
}

{
  const roster = rosterOf(25), backend = world(roster), adapter = createMarketWorldAdapter({ seed: 'rc1-alpha', roster });
  let stopped = false;
  await assert.rejects(adapter.runDay(0, backend.hooks({ checkpoint: async (phase, value) => {
    if (!stopped && phase === 'receipt-settled' && value.pending?.items.some(item => item.task.phase === 'refund-cancel') && value.pending.settledCount === 2) {
      stopped = true; throw Error('partial mixed settlement');
    }
  } })), /partial mixed settlement/);
  const checkpoint = adapter.checkpoint(), keys = checkpoint.payload.state.pending.items.map(item => item.decision.request.idempotencyKey);
  const calls = keys.map(key => backend.commands.filter(command => command.request.idempotencyKey === key).length);
  const restored = createMarketWorldAdapter({ seed: 'rc1-alpha', roster }).restore(checkpoint); await restored.runDay(0, backend.hooks());
  assert.deepEqual(keys.map(key => backend.commands.filter(command => command.request.idempotencyKey === key).length), calls);
  assert.equal(restored.summary().daily[0].mixedGroups, 1); controls++;
}

{
  const roster = rosterOf(25), backend = world(roster), adapter = createMarketWorldAdapter({ seed: 'rc1-alpha', roster, expiryHours: 24 });
  await adapter.runDay(0, backend.hooks());
  const candidate = adapter.summary().expiryCandidates[0]; assert.equal(candidate.returnedExpirySeconds, 86400);
  backend.advance(3600000); assert.equal(backend.listings.get(candidate.listingId).status, 'live');
  await assert.rejects(adapter.runTimerWindow(0, backend.hooks()), /original due expiry/);
  const restored = createMarketWorldAdapter({ seed: 'rc1-alpha', roster, expiryHours: 24 }).restore(adapter.checkpoint());
  assert.throws(() => createMarketWorldAdapter({ seed: 'rc1-alpha', roster }).restore(adapter.checkpoint()));
  backend.advance(DAY); assert.equal((await restored.runTimerWindow(0, backend.hooks())).observed, 1);
  await restored.runDay(1, backend.hooks()); assert.equal(restored.summary().daily[1].mixedGroups, 1); controls++;
}

{
  const roster = rosterOf(25), backend = world(roster), adapter = createMarketWorldAdapter({ seed: 'rc1-gamma', roster });
  for (let day = 0; day < 90; day++) {
    backend.advance(day * DAY); const daily = await adapter.runDay(day, backend.hooks()); assert(daily.byType['market.fill'] > 0);
    backend.advance(day * DAY + 3600000); assert.equal((await adapter.runTimerWindow(day, backend.hooks())).observed, 1);
  }
  assert.equal(adapter.summary().completedDays.length, 90); assert.equal(adapter.summary().expiryNotices.length, 90);
  assert.equal(adapter.summary().unresolvedResponses, 0); assert.equal(adapter.summary().matrixQualifying, false); controls++;
}
console.log(JSON.stringify({ status: 'PASS_SCOPED', controls, populations, seeds: 3,
  continuedDays: 90, nativeConcurrencyClaim: false, scope: 'Actor scheduler and replay controls; mock handlers do not replace retained native market/resource evidence' }));
