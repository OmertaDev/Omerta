import assert from 'node:assert/strict';
import { createWarWorldAdapter, planWarWorld } from '../tools/rc1-war-world-adapter.js';
import { actorValueHash as hash } from '../tools/rc1-native-actor-replay.js';

// Protocol doubles test adapter scheduling/inputs/receipt handling, not native game economics or matrix qualification.
const DAY = 86400000, HOUR = 3600000, epoch = Date.parse('2026-09-20T12:00:00Z');
function fixture(population = 25) {
  const roster = Array.from({ length: population }, (_, index) => ({ accountId: 'actor-' + index, characterId: 'character-' + index }));
  const configuration = { seed: 'war-test', roster, epoch }, plan = planWarWorld(population);
  const people = new Map(roster.map((actor, index) => [actor.accountId, { id: actor.characterId,
    level: index < plan.groups.length ? 400 : 1, cash: 500, ammo: 25, bank: 0, cb: 0, omr: 0,
    nerve: 10, jailSeconds: 0, checkin: { done: false, pay: (index < plan.groups.length ? 400 : 1) * 350 }, gang: null }]));
  const families = new Map(), delivered = new Map(roster.map(actor => [actor.accountId, []])), seen = new Map(), events = [], requests = [];
  const district = { id: 'cathedral', holder: null, garrison: 0 }, bids = new Map();
  let adapter = createWarWorldAdapter(configuration), notificationId = 0;
  const rules = { family: { foundCost: 25000, tributeMin: 100 }, crimes: [{ id: 'pickpocket', lvl: 1, nerve: 1 }],
    crimeApproaches: [{ id: 'quiet', heat: 0 }], pacing: { nerveRegenPerMin: 1 } };
  const hooks = { logicalAt: epoch,
    read: async (accountId, path) => {
      const own = structuredClone(people.get(accountId));
      if (own.gang) own.gang.treasury = families.get(own.gang.id).treasury;
      if (path === '/v1/session') return { authed: true, character: { id: own.id } };
      if (path === '/v1/me') return { character: own };
      if (path === '/v1/rules') return structuredClone(rules);
      if (path === '/v1/gangs') return { gangs: [...families.values()].map(family => ({ ...family, members: family.members.length })) };
      if (path === '/v1/districts') return { districts: [structuredClone(district)] };
      if (path === '/v1/notifications') { const notifications = delivered.get(accountId).splice(0); return { notifications }; }
      assert.fail('Undeclared actor read ' + path);
    },
    record: async event => { events.push(structuredClone(event)); },
    execute: async (accountId, request) => {
      assert.equal(events.at(-1).kind, 'war-pending', 'Durable exact selection must precede dispatch');
      assert.deepEqual(events.at(-1).pending.selected.request, request);
      requests.push({ accountId, request: structuredClone(request) });
      const prior = seen.get(request.idempotencyKey); if (prior) return { ...structuredClone(prior), replayed: true };
      const own = people.get(accountId), body = { ok: true };
      if (request.path === '/v1/checkin') {
        assert(!own.checkin.done); own.cash += own.checkin.pay; body.pay = own.checkin.pay; own.checkin.done = true;
      } else if (request.path === '/v1/gangs') {
        assert(own.cash >= 25000 && !own.gang); own.cash -= 25000;
        body.gangId = 'family-' + families.size; own.gang = { id: body.gangId, role: 'boss' };
        families.set(body.gangId, { id: body.gangId, ...request.body, npc: false, members: [own.id], treasury: 0 });
      } else if (request.path.endsWith('/join')) {
        const family = families.get(request.path.split('/')[3]); assert(family.members.length < 20 && !own.gang);
        own.gang = { id: family.id, role: 'soldier' }; family.members.push(own.id); body.gangId = family.id;
      } else if (request.path === '/v1/gangs/tribute') {
        const amount = request.body.amount; assert(amount >= 100 && amount <= own.cash); own.cash -= amount;
        families.get(own.gang.id).treasury += amount; Object.assign(body, { amount, currency: 'cash' });
      } else if (request.path.endsWith('/seize')) {
        assert(!district.holder); const family = families.get(own.gang.id); family.treasury -= 22500;
        district.holder = { gangId: family.id }; district.garrison = 22500; district.claimFloor = 22500;
        Object.assign(body, { district: district.id, cost: 22500, garrison: 22500 });
      } else if (request.path.endsWith('/claim')) {
        const family = families.get(own.gang.id), amount = request.body.amount;
        assert(amount >= district.claimFloor && amount <= family.treasury && !bids.has(family.id));
        family.treasury -= amount; bids.set(family.id, amount); district.contest = { resolvesSeconds: 900, families: bids.size };
        Object.assign(body, { district: district.id, staked: amount, added: amount, defending: district.holder.gangId === family.id,
          resolvesSeconds: 900, lossBps: 5000 });
      } else if (request.path === '/v1/crimes/pickpocket') {
        assert.equal(request.body.approach, 'quiet'); own.cash += 200; Object.assign(body, { approach: 'quiet', success: true });
      } else assert.fail('Undeclared actor mutation ' + request.path);
      const response = { status: 200, replayed: false, body }; seen.set(request.idempotencyKey, structuredClone(response)); return response;
    } };
  return { configuration, plan, people, families, district, bids, delivered, hooks, events, requests,
    get adapter() { return adapter; },
    restore(checkpoint = adapter.checkpoint()) { adapter = createWarWorldAdapter(configuration).restore(checkpoint); },
    day(day) { hooks.logicalAt = epoch + day * DAY; for (const person of people.values()) { person.checkin.done = false; person.nerve = 10; } },
    settle() {
      assert(bids.size); const winner = [...bids].sort((a, b) => b[1] - a[1] || Number(b[0] === district.holder.gangId) - Number(a[0] === district.holder.gangId))[0][0];
      district.holder = { gangId: winner }; district.contest = null;
      for (const [familyId, staked] of bids) {
        const won = familyId === winner, back = won ? 0 : Math.floor(staked / 2); families.get(familyId).treasury += back;
        for (const actor of roster) if (people.get(actor.accountId).gang?.id === familyId) delivered.get(actor.accountId).push({
          id: 'notification-' + notificationId++, type: 'contest_resolved', at: new Date(hooks.logicalAt).toISOString(),
          payload: { district: district.id, staked, won, back } });
      }
      bids.clear();
    } };
}
async function prepare(f, maximumDecisions = 47) {
  let result; do { result = await f.adapter.prepare(f.hooks, { maximumDecisions }); } while (!result.complete);
  return result;
}
async function runDay(f, day, maximumDecisions = 53) {
  let result; do { result = await f.adapter.runDay(day, f.hooks, { maximumDecisions }); } while (!result.complete && !result.waitingForSettlement);
  return result;
}
async function observe(f, maximumDecisions = 2) {
  let result; do { result = await f.adapter.observeSettlements(f.hooks, { maximumDecisions }); } while (!result.complete);
  return result;
}

for (const population of [25, 100, 250, 500, 1000]) {
  const f = fixture(population), members = f.plan.groups.flatMap(group => group.members);
  assert.equal(new Set(members).size, population); assert(f.plan.groups.length >= 3);
  assert(f.plan.groups.every(group => group.members.length <= 20 && group.members[0] === group.founder));
  const prepared = await prepare(f); assert.equal(prepared.formedFamilies, f.plan.groups.length);
  assert.equal(f.requests.filter(row => row.request.path.endsWith('/seize')).length, 1);
  assert([...f.families.values()].every(family => family.members.length <= 20));
  const calls = f.requests.length; await prepare(f); assert.equal(f.requests.length, calls);
  let result = await runDay(f, 0); assert(result.complete); assert.equal(result.rounds[0].claims.length, f.plan.groups.length);
  assert.equal(result.awaitingSettlements, f.plan.groups.length); assert.equal(result.observedLogicalDays, 0);
  f.restore(); f.hooks.logicalAt = epoch + HOUR;
  // Time passing does not manufacture original worker settlement or refunds.
  result = await observe(f); assert.equal(result.awaitingSettlements, f.plan.groups.length);
  assert.equal(result.rounds[0].outcomes.length, 0);
  f.settle(); f.restore(); result = await observe(f); assert.equal(result.awaitingSettlements, 0);
  assert.equal(result.rounds[0].outcomes.length, f.plan.groups.length);
  assert.equal(result.rounds[0].outcomes.filter(row => row.won).length, 1);
  assert.equal(result.matrixQualifying, false);
  for (const event of f.events.filter(row => row.kind === 'war-choice' && row.phase === 'claim')) {
    assert.equal(event.selected.kind, 'command'); assert(event.selected.request.body.amount > 0);
  }
  // Every actor generated an ordinary quiet action and own treasury tribute after preparation.
  assert.equal(result.completedByType['family.progress'], population);
  assert.equal(result.completedByType['family.tribute'], population);
}

{
  const f = fixture(); await prepare(f); await runDay(f, 0); f.hooks.logicalAt = epoch + HOUR; f.settle(); await observe(f);
  const oldIds = new Set(f.adapter.summary().rounds[0].outcomes.map(row => row.notificationId));
  for (let day = 1; day <= 2; day++) {
    f.day(day); await runDay(f, day);
    // A stale undelivered receipt cannot satisfy a new commitment, even if delivered with current receipts.
    f.delivered.get('actor-0').unshift({ id: 'stale', type: 'contest_resolved', at: new Date(epoch).toISOString(),
      payload: { district: 'cathedral', staked: 1, back: 0, won: true } });
    f.hooks.logicalAt += HOUR; f.settle(); await observe(f); f.restore();
    const round = f.adapter.summary().rounds[day]; assert.equal(round.outcomes.length, 3);
    assert(round.outcomes.every(row => !oldIds.has(row.notificationId) && row.notificationId !== 'stale'));
  }
  assert.equal(f.adapter.summary().observedLogicalDays, 2);
  assert.equal(new Set(f.requests.map(row => row.request.idempotencyKey)).size, f.requests.length);
  await assert.rejects(f.adapter.runDay(4, f.hooks));
}

{
  const f = fixture(); await prepare(f); await runDay(f, 0);
  f.day(1); const before = f.requests.length, result = await f.adapter.runDay(1, f.hooks);
  assert(!result.complete && result.awaitingSettlements === 3); assert.equal(f.requests.length, before);
}

{
  // Lost transport before execution retains the exact request across checkpoint/restore.
  const f = fixture(), execute = f.hooks.execute; let lost;
  f.hooks.execute = async (_, request) => { lost = structuredClone(request); throw Error('transport-before-effect'); };
  await assert.rejects(prepare(f), /transport-before-effect/); assert(f.adapter.summary().pending); f.restore();
  f.hooks.execute = async (accountId, request) => { assert.deepEqual(request, lost); f.hooks.execute = execute; return execute(accountId, request); };
  await prepare(f); assert(!f.adapter.summary().pending);
}

{
  // Lost completed response cannot count an unknown replay as fresh money/formation.
  const f = fixture(), execute = f.hooks.execute; let lost;
  f.hooks.execute = async (accountId, request) => { lost = structuredClone(request); await execute(accountId, request); throw Error('lost-after-effect'); };
  await assert.rejects(prepare(f), /lost-after-effect/); f.restore();
  f.hooks.execute = async (accountId, request) => { assert.deepEqual(request, lost); return execute(accountId, request); };
  await assert.rejects(prepare(f), /Unknown completed war replay/);
  assert.equal(f.adapter.summary().unresolvedResponses, 1); assert.equal(f.adapter.summary().fresh, 0);
}

{
  // Delivery is retained before processing; failure while recording a choice must not lose its consumed notification.
  const f = fixture(); await prepare(f); await runDay(f, 0); f.hooks.logicalAt += HOUR; f.settle();
  const record = f.hooks.record; f.hooks.record = async event => {
    if (event.kind === 'war-settlement-choice') throw Error('durable-choice-failed'); return record(event);
  };
  await assert.rejects(observe(f), /durable-choice-failed/);
  assert.equal(f.delivered.get('actor-0').length, 0); assert.equal(f.adapter.summary().rounds[0].outcomes.length, 0);
  f.restore(); f.hooks.record = record; const result = await observe(f); assert.equal(result.awaitingSettlements, 0);
  assert.equal(result.rounds[0].outcomes.length, 3);
}

{
  const f = fixture(), execute = f.hooks.execute;
  f.hooks.execute = async (accountId, request) => request.path === '/v1/gangs'
    ? { status: 400, replayed: false, body: { error: 'name_taken' } } : execute(accountId, request);
  await assert.rejects(prepare(f), /preparation denied/); assert(!f.adapter.summary().prepared); f.restore();
  await assert.rejects(prepare(f), /preparation denied/);
}

{
  const f = fixture(); await prepare(f); const checkpoint = f.adapter.checkpoint(); checkpoint.payload.state.prepCursor--;
  assert.throws(() => f.restore(checkpoint), /checksum/);
  checkpoint.sha256 = hash(checkpoint.payload); assert.throws(() => f.restore(checkpoint));
  const g = fixture(); g.people.get('actor-0').cash = 1000000; await assert.rejects(prepare(g));
  const h = fixture(); await prepare(h); h.people.get('actor-1').id = 'replacement'; await assert.rejects(runDay(h, 0), /generation changed/);
}
console.log('PASS rc1-war-world-adapter: all5 populations, bounded public setup/daily contention, original-settlement waits, stale/delivered receipts, checkpoints and unknown replay denial; protocol doubles only');
