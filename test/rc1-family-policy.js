import assert from 'node:assert/strict';
import { createFamilyPolicy, planFamilyFixture } from '../tools/rc1-family-policy.js';
const mono = planFamilyFixture('family_monopoly'), frag = planFamilyFixture('fragmented_families');
assert.equal(mono.groups[0].members.length, 20); assert.equal(mono.outsiders.length, 5);
assert.equal(frag.groups.length, 10); assert.equal(frag.outsiders.length, 2); assert(frag.groups.every((g) => g.members.length <= 5));
assert.equal(new Set([...frag.groups.flatMap((g) => g.members), ...frag.outsiders]).size, 25);
const config = { accountId: 'actor', seed: 'rc1-alpha', scenario: 'family_monopoly', population: 25 };
const view = () => ({ accountId: 'actor', session: { authed: true, character: { id: 'character' } },
  me: { character: { id: 'character', level: 1, cash: 500, nerve: 10, jailSeconds: 0, gang: null } },
  directory: { gangs: [{ id: 'full', name: 'Full Family', tag: 'FULL', members: 20, npc: false }, { id: 'small', name: 'Small Family', tag: 'SMAL', members: 2, npc: false }] },
  rules: { family: { foundCost: 25000, tributeMin: 100 }, crimes: [{ id: 'pick', lvl: 1, nerve: 2 }, { id: 'locked', lvl: 2, nerve: 1 }],
    crimeApproaches: [{ id: 'quiet', heat: 0 }], pacing: { nerveRegenPerMin: 6 } } });
const choose = (p, v, phase = 'enter', targetFamilyId = null) => p.choose(v, { logicalAt: 1000, phase, targetFamilyId });
const p = createFamilyPolicy(config), join = choose(p, view()); assert.equal(join.request.path, '/v1/gangs/full/join');
const restored = createFamilyPolicy(config).restore(p.checkpoint()); assert.deepEqual(choose(restored, view(), 'progress'), join);
restored.settle({ idempotencyKey: join.request.idempotencyKey, status: 'DENIED', replayed: false, response: { error: 'full' } });
const stillFull = view(); stillFull.directory.gangs = [stillFull.directory.gangs[0]];
assert.equal(choose(restored, stillFull).kind, 'wait');
stillFull.directory.gangs[0].members = 19; assert.equal(choose(restored, stillFull).request.path, '/v1/gangs/full/join');
assert.equal(choose(createFamilyPolicy({ ...config, scenario: 'fragmented_families' }), view()).request.path, '/v1/gangs/small/join');
assert.equal(choose(createFamilyPolicy(config), view(), 'enter', 'not-issued').kind, 'wait');
assert.equal(choose(createFamilyPolicy(config), view(), 'found').reason, 'formation-cash');
const founder = view(); founder.me.character.cash = 25000;
const fp = createFamilyPolicy(config), found = choose(fp, founder, 'found'); assert.equal(found.request.path, '/v1/gangs');
fp.settle({ idempotencyKey: found.request.idempotencyKey, status: 'COMPLETED', replayed: false, response: { ok: true, gangId: 'new' } });
fp.settle({ idempotencyKey: found.request.idempotencyKey, status: 'COMPLETED', replayed: true, response: { ok: true, gangId: 'new' } });
assert.equal(fp.summary().fresh, 1); assert.equal(fp.summary().knownReplays, 1);
assert.throws(() => fp.settle({ idempotencyKey: found.request.idempotencyKey, status: 'COMPLETED', replayed: true,
  response: { ok: true, gangId: 'changed' } }), /Conflicting/);
assert.throws(() => p.settle({ idempotencyKey: 'not-issued', status: 'COMPLETED', replayed: false,
  response: { ok: true, gangId: 'full' } }), /identity/);
const member = view(); member.me.character.gang = { id: 'small', role: 'soldier' };
assert.equal(choose(createFamilyPolicy(config), member).reason, 'already-member');
assert.equal(choose(createFamilyPolicy(config), member, 'promote').reason, 'not-the-boss');
assert.equal(choose(createFamilyPolicy(config), member, 'concentrate').request.body.amount, 500);
member.me.character.gang.role = 'boss'; member.family = { gang: { id: 'small', members: [{ id: 'character', role: 'boss' }, { id: 'member', role: 'soldier' }] } };
assert.equal(choose(createFamilyPolicy(config), member, 'promote').request.body.characterId, 'member');
member.family.gang.id = 'foreign'; assert.throws(() => choose(createFamilyPolicy(config), member, 'promote'), /Wrong/);
const progress = choose(createFamilyPolicy(config), view(), 'progress'); assert.equal(progress.request.path, '/v1/crimes/pick');
const depleted = view(); depleted.me.character.nerve = 0; assert.equal(choose(createFamilyPolicy(config), depleted, 'progress').retryAfterSeconds, 20);
const foreign = view(); foreign.session.character.id = 'other'; assert.throws(() => choose(createFamilyPolicy(config), foreign), /Foreign/);
const hidden = view(); Object.defineProperty(hidden, 'database', { get() { throw Error('Private observer input'); } }); choose(createFamilyPolicy(config), hidden);
const lost = createFamilyPolicy(config), pending = choose(lost, view());
lost.settle({ idempotencyKey: pending.request.idempotencyKey, status: 'COMPLETED', replayed: true, response: { ok: true, gangId: 'full' } });
const resumed = createFamilyPolicy(config).restore(lost.checkpoint()); assert.deepEqual(resumed.checkpoint().payload.unresolved[0].decision, pending);
assert.throws(() => choose(resumed, view()), /Unresolved/);
const bad = p.checkpoint(); bad.payload.counters.fresh++; assert.throws(() => createFamilyPolicy(config).restore(bad), /checksum/);
console.log('PASS: legal25-person extremes, public social selection, rank gates, observed-full recovery and exact restart identities');
