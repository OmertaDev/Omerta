import assert from 'node:assert/strict';
import { createFamilyWorldAdapter } from '../tools/rc1-family-world-adapter.js';
import { planFamilyFixture } from '../tools/rc1-family-policy.js';

for (const population of [25, 100, 250, 500, 1000]) for (const scenario of ['family_monopoly', 'fragmented_families']) {
  const plan = planFamilyFixture(scenario, population);
  assert.equal(new Set([...plan.groups.flatMap(group => group.members), ...plan.outsiders]).size, population);
  assert(plan.groups.every(group => group.members.length <= 20));
  if (scenario === 'fragmented_families') { assert(plan.groups.length >= 10); assert(plan.realizedLargestFamilyFraction <= .2); }
  else { assert.equal(plan.groups[0].members.length, 20); assert.equal(!!plan.legalConstraint, population > 25); }
}

for (const scenario of ['family_monopoly', 'fragmented_families']) {
  const roster = Array.from({ length: 25 }, (_, index) => ({ accountId: 'actor-' + index, characterId: 'character-' + index }));
  const configuration = { scenario, seed: 'rc1-alpha', roster }, plan = planFamilyFixture(scenario);
  const people = new Map(roster.map(actor => [actor.accountId, { id: actor.characterId, level: 1, cash: 500,
    checkin: { done: false }, gang: null }]));
  for (const group of plan.groups) people.get(roster[group.founder].accountId).level = 75;
  const families = new Map(); let executions = 0, decisions = 0, checkpoints = 0, lastCheckpoint;
  const rules = { family: { foundCost: 25000, tributeMin: 100 } };
  const hooks = { logicalAt: 0,
    read: async (accountId, path) => {
      const own = people.get(accountId);
      if (path === '/v1/session') return { authed: true, character: { id: own.id } };
      if (path === '/v1/me') return { character: structuredClone(own) };
      if (path === '/v1/rules') return rules;
      if (path === '/v1/gangs') return { gangs: [...families.values()].map(family => ({ ...family, members: family.members.length })) };
      return { gang: structuredClone(families.get(path.split('/')[3])) };
    },
    execute: async (accountId, request) => {
      executions++; const own = people.get(accountId), body = { ok: true };
      if (request.path === '/v1/checkin') { assert(!own.checkin.done); own.checkin.done = true; own.cash += own.level * 350; }
      else if (request.path === '/v1/gangs') {
        assert(own.cash >= 25000 && !own.gang); own.cash -= 25000;
        body.gangId = 'family-' + families.size; own.gang = { id: body.gangId, role: 'boss' };
        families.set(body.gangId, { ...request.body, id: body.gangId, npc: false, treasury: 0, members: [{ id: own.id, role: 'boss' }] });
      } else if (request.path.endsWith('/join')) {
        const family = families.get(request.path.split('/')[3]);
        if (family.members.length === 20) return { status: 400, replayed: false, body: { error: 'full' } };
        assert(!own.gang); own.gang = { id: family.id, role: 'soldier' }; family.members.push({ id: own.id, role: 'soldier' }); body.gangId = family.id;
      } else if (request.path === '/v1/gangs/tribute') {
        assert(own.gang && own.cash >= request.body.amount); own.cash -= request.body.amount;
        families.get(own.gang.id).treasury += request.body.amount; Object.assign(body, { amount: request.body.amount, currency: 'cash' });
      } else throw Error('Unexpected request: ' + request.path);
      return { status: 200, replayed: false, body };
    },
    decision: async () => { decisions++; },
    checkpoint: async (_phase, checkpoint) => { checkpoints++; lastCheckpoint = checkpoint;
      assert.deepEqual(createFamilyWorldAdapter(configuration).restore(checkpoint).checkpoint(), checkpoint); },
  };
  const adapter = createFamilyWorldAdapter(configuration); await adapter.runDay(0, hooks);
  assert.equal(adapter.summary().nextDay, 1); assert.equal(families.size, plan.groups.length);
  assert.equal(adapter.summary().unresolvedResponses, 0); assert(executions && decisions && checkpoints);
  const restored = createFamilyWorldAdapter(configuration).restore(lastCheckpoint);
  for (const person of people.values()) person.checkin.done = false;
  await restored.runDay(1, { ...hooks, logicalAt: 86400000 });
  assert.equal(restored.summary().nextDay, 2); assert.equal(restored.summary().pending, false);
  assert(restored.summary().fresh > adapter.summary().fresh, 'Daily work must continue');
  assert.equal(restored.summary().completedByType['family.checkin'], plan.groups.length + 25);
  await assert.rejects(() => restored.runDay(1, hooks));
  const damaged = restored.checkpoint(); damaged.payload.state.nextDay++;
  assert.throws(() => createFamilyWorldAdapter(configuration).restore(damaged));
  const altered = { ...configuration, roster: [...roster].reverse() };
  assert.throws(() => createFamilyWorldAdapter(altered).restore(restored.checkpoint()));
}

const roster = Array.from({ length: 25 }, (_, index) => ({ accountId: 'a' + index, characterId: 'c' + index }));
const configuration = { scenario: 'family_monopoly', seed: 'rc1-beta', roster };
let pending;
const adapter = createFamilyWorldAdapter(configuration);
await assert.rejects(() => adapter.runDay(0, { logicalAt: 0,
  read: async (_id, path) => path === '/v1/session' ? { character: { id: 'c0' } }
    : path === '/v1/me' ? { character: { checkin: { done: false } } } : {},
  decision: async () => {}, checkpoint: async (_phase, value) => { pending = value; },
  execute: async () => { throw Error('lost response'); },
}), /lost response/);
const resumed = createFamilyWorldAdapter(configuration).restore(pending);
await assert.rejects(() => resumed.runDay(0, { logicalAt: 0,
  read: async () => { throw Error('Pending action must not be reselected'); }, decision: async () => {}, checkpoint: async () => {},
  execute: async (_id, request) => {
    assert.deepEqual(request, pending.payload.state.pending.selected.request);
    return { status: 200, replayed: true, body: { ok: true } };
  },
}), /Unknown completed/);
assert.equal(resumed.summary().unresolvedResponses, 1);
console.log('PASS: five legal population plans, two repeated Family worlds, exact pending restart and fail-closed replay controls');
