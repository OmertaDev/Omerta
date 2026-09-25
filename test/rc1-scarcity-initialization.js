// Deterministic actor/restart controls only. These do not replace native proof.
import assert from 'node:assert/strict';
import { createScarcityInitialization, SCARCITY_INITIALIZATION_CONTRACT } from '../tools/rc1-scarcity-initialization.js';
import { actorValueHash as hash } from '../tools/rc1-native-actor-replay.js';
import { M3, MEGAPROJECT } from '../src/rules.js';

assert.equal(M3.JUMP_AMMO, 5); assert.equal(MEGAPROJECT.MIN_CASH, 100);
const epoch = Date.UTC(2026, 8, 24);
function harness(population = 25, options = {}) {
  const roster = Array.from({ length: population }, (_, i) => ({ accountId: 'a' + i, characterId: 'c' + i }));
  const configuration = { seed: 'rc1-alpha', roster, epoch, maximumLogicalMs: options.maximumLogicalMs || 14 * 86400000 };
  const people = new Map(roster.map(actor => [actor.accountId, { id: actor.characterId, generation: 1, cash: 500, bank: 0, ammo: 25,
    cb: 0, omr: 0, respect: 0, level: 1, energy: 100, health: 100, loc: 'docks', gang: null,
    jailSeconds: 0, hospSeconds: 0, safeSeconds: 0, law: { witproSeconds: 0 }, checkin: { done: false, pay: 350 } }]));
  const byId = new Map([...people.values()].map(own => [own.id, own]));
  let at = epoch, lastAt = epoch, admissions = 0, donated = 0, topups = 0, advances = 0, deniedOnce = false, clamped = false;
  const hospital = new Map(), records = [], executions = [], receipts = new Map();
  const refresh = () => {
    const elapsed = (at - lastAt) / 60000;
    for (const own of people.values()) { own.energy = Math.min(100, own.energy + 12 * elapsed);
      own.health = Math.min(100, own.health + 20 * elapsed); own.hospSeconds = Math.max(0, ((hospital.get(own.id) || 0) - at) / 1000); }
    lastAt = at;
  };
  const hooks = () => ({ logicalAt: at,
    async read(accountId, path) {
      refresh(); const own = people.get(accountId);
      if (path === '/v1/session') return { authed: true, character: { id: own.id } };
      if (path === '/v1/me') return { character: { ...structuredClone(own), energy: Math.floor(own.energy), health: Math.floor(own.health) } };
      if (path === '/v1/rules') return { megaproject: { minCash: 100 } };
      assert.equal(path, '/v1/streets');
      return { streets: options.noTargets ? [] : [...byId.values()].slice(0, 100).map(target => ({ id: target.id, npc: false,
        loc: target.loc, jailed: false, hospitalized: target.hospSeconds > 0, gangTag: null })).concat([
        { id: 'unregistered-public-character', npc: false, loc: 'docks', jailed: false, hospitalized: false },
        { id: 'public-npc', npc: true, loc: 'docks', jailed: false, hospitalized: false }]) };
    },
    async execute(accountId, request) {
      assert.equal(records.at(-1).kind, 'scarcity-request-pending', 'Evidence must precede dispatch');
      assert.deepEqual(records.at(-1).request, request);
      executions.push(structuredClone({ accountId, request, at }));
      const prior = receipts.get(request.idempotencyKey);
      if (prior) return { ...structuredClone(prior), replayed: true };
      const own = people.get(accountId); let body;
      if (request.path.endsWith('/jump')) {
        if (options.oneDenial && !deniedOnce) { deniedOnce = true; const r = { status: 400, replayed: false, body: { error: 'protected' } };
          receipts.set(request.idempotencyKey, r); return r; }
        const target = byId.get(request.path.split('/')[3]); assert(target && target.id !== own.id);
        assert(own.ammo >= 5 && own.energy >= 25 && own.health >= 20 && own.hospSeconds === 0 && target.hospSeconds === 0);
        own.ammo -= 5; own.energy -= 25; const win = admissions++ % 2 === 0;
        if (win) { const stolen = Math.floor(target.cash * .15); target.cash -= stolen; own.cash += stolen;
          target.health = Math.max(1, target.health - 30); hospital.set(target.id, at + 180000); }
        else own.health = Math.max(1, own.health - 15);
        body = { ok: true, win, intent: 'standard', energy: 25 };
      } else if (request.path === '/v1/checkin') {
        assert.equal(own.checkin.done, false); own.cash += 350; topups += 350; own.checkin.done = true;
        body = { ok: true, pay: 350 };
      } else {
        assert.equal(request.path, '/v1/megaproject/cash'); assert(request.body.amount >= 100 && own.cash >= request.body.amount);
        let credited = request.body.amount;
        if (options.partialDonation && !clamped) { clamped = true; credited -= 50; }
        own.cash -= credited; donated += credited; body = { credited, progress: donated, target: 10000000, completed: false, yourTotal: credited, monument: 'test' };
      }
      const response = { status: 200, replayed: false, body }; receipts.set(request.idempotencyKey, structuredClone(response)); return response;
    },
    async record(event) { records.push(structuredClone(event)); },
    async advanceOriginalWorkers(target) { assert(target > at); at = target; advances++; return at; },
  });
  return { configuration, people, records, executions, hooks, setAt: value => { at = value; },
    totals: () => ({ at, admissions, donated, topups, advances }) };
}
async function finish(adapter, h) {
  let result;
  for (let guard = 0; guard < 500; guard++) {
    result = await adapter.run(h.hooks(), { maximumSteps: 4096 });
    if (result.complete || result.blocked) return result;
  }
  throw Error('Control failed to terminate');
}
let controls = 0;
for (const population of SCARCITY_INITIALIZATION_CONTRACT.populations) {
  const h = harness(population), adapter = createScarcityInitialization(h.configuration), result = await finish(adapter, h);
  assert.equal(result.complete, true, JSON.stringify(result.summary)); assert.equal(result.summary.admittedJumps, 5 * population);
  assert.equal(result.summary.verifiedActors, population); assert.equal(result.summary.nativeBaselineRequired, true);
  assert([...h.people.values()].every(own => own.cash === 0 && own.bank === 0 && own.ammo === 0 && own.generation === 1));
  assert.equal(h.totals().donated, population * 500 + h.totals().topups, 'Transfers are not a cash sink');
  assert(h.totals().advances > 0, 'Energy/hospital recovery cannot be fabricated');
  assert.equal(new Set(h.executions.map(row => row.request.idempotencyKey)).size, h.executions.length);
  const checkpoint = JSON.parse(JSON.stringify(adapter.checkpoint()));
  assert.deepEqual(createScarcityInitialization(h.configuration).restore(checkpoint).summary(), adapter.summary());
  controls++;
}
{
  const h = harness(25, { oneDenial: true, partialDonation: true }), adapter = createScarcityInitialization(h.configuration);
  const result = await finish(adapter, h); assert.equal(result.complete, true); assert.equal(result.summary.denied, 1);
  assert(h.totals().topups >= 350, 'A below-minimum remainder must use real public top-up');
  assert.equal(result.summary.admittedJumps, 125, 'Denied jump must not consume an admission'); controls++;
}
{
  const h = harness(), adapter = createScarcityInitialization(h.configuration);
  const paused = await adapter.run(h.hooks(), { maximumSteps: 4096, pauseBeforeDispatch: true }); assert(paused.paused);
  const checkpoint = adapter.checkpoint(), pending = checkpoint.payload.pending;
  const restored = createScarcityInitialization(h.configuration).restore(JSON.parse(JSON.stringify(checkpoint)));
  // Pending identity must survive a changed public board without a new choice.
  const hooks = h.hooks(), read = hooks.read;
  hooks.read = async (account, path) => path === '/v1/streets' ? { streets: [] } : read(account, path);
  await restored.run(hooks, { maximumSteps: 1 }); assert.deepEqual(h.executions[0].request, pending.request);
  assert.equal(restored.summary().admittedJumps, 1); controls++;
}
{
  const h = harness(), adapter = createScarcityInitialization(h.configuration);
  await adapter.run(h.hooks(), { maximumSteps: 4096, pauseBeforeDispatch: true });
  const checkpoint = adapter.checkpoint(), hooks = h.hooks(), execute = hooks.execute;
  hooks.execute = async (...args) => { await execute(...args); throw Error('lost response'); };
  await assert.rejects(adapter.run(hooks, { maximumSteps: 1 }), /lost response/);
  const restored = createScarcityInitialization(h.configuration).restore(checkpoint), result = await restored.run(h.hooks(), { maximumSteps: 1 });
  assert.equal(result.blocked, true); assert.equal(result.summary.failure.reason, 'unresolved-successful-replay');
  assert.equal(result.summary.admittedJumps, 0); assert.deepEqual(h.executions[0].request, h.executions[1].request); controls++;
}
{
  const h = harness(), adapter = createScarcityInitialization(h.configuration), hooks = h.hooks();
  hooks.advanceOriginalWorkers = async target => { h.setAt(target); throw Error('lost worker completion'); };
  await assert.rejects(adapter.run(hooks, { maximumSteps: 4096 }), /lost worker completion/);
  const checkpoint = adapter.checkpoint(); assert(checkpoint.payload.pendingWait);
  const restored = createScarcityInitialization(h.configuration).restore(checkpoint), resumed = h.hooks();
  resumed.advanceOriginalWorkers = async () => { throw Error('repeated original callback'); };
  await restored.run(resumed, { maximumSteps: 1 }); assert.equal(restored.summary().pendingOriginalAdvance, null);
  assert.equal(restored.summary().workerAdvances, 1); controls++;
}
{
  const h = harness(25, { noTargets: true, maximumLogicalMs: 600000 }), adapter = createScarcityInitialization(h.configuration);
  const result = await finish(adapter, h); assert.equal(result.blocked, true);
  assert.equal(result.summary.failure.reason, 'declared-initialization-duration-exhausted');
  assert.equal(h.executions.length, 0); assert.equal(h.totals().advances, 2); controls++;
}
for (const [field, value] of [['generation', 2], ['ammo', 24], ['bank', 1], ['cash', 0]]) {
  const h = harness(); h.people.get('a0')[field] = value;
  const result = await createScarcityInitialization(h.configuration).run(h.hooks());
  assert.equal(result.blocked, true); assert.equal(h.executions.length, 0); controls++;
}
{
  const h = harness(), adapter = createScarcityInitialization(h.configuration), checkpoint = adapter.checkpoint();
  checkpoint.payload.actors[0].admissions = 1; checkpoint.payload.actors[0].jumpAttempts = 1; checkpoint.sha256 = hash(checkpoint.payload);
  assert.throws(() => adapter.restore(checkpoint), /admission count/);
  const valid = createScarcityInitialization(h.configuration).checkpoint();
  assert.throws(() => createScarcityInitialization({ ...h.configuration, seed: 'rc1-beta' }).restore(valid));
  assert.throws(() => createScarcityInitialization({ ...h.configuration, roster: h.configuration.roster.concat(h.configuration.roster) }));
  controls++;
}
{
  const h = harness(), adapter = createScarcityInitialization(h.configuration);
  await adapter.run(h.hooks(), { maximumSteps: 4096, pauseBeforeDispatch: true });
  const checkpoint = adapter.checkpoint(); checkpoint.payload.pending.request.path = '/v1/streets/public-npc/jump';
  checkpoint.payload.pending.requestSha256 = hash(checkpoint.payload.pending.request); checkpoint.sha256 = hash(checkpoint.payload);
  assert.throws(() => createScarcityInitialization(h.configuration).restore(checkpoint)); controls++;
}
console.log('PASS: scarcity initialization ' + controls + ' controls; all five populations, canonical-shaped depletion/recovery, exact pending replay and bounded failure. No native qualification.');
