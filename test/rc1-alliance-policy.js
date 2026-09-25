import assert from 'node:assert/strict';
import { createAlliancePolicy } from '../tools/rc1-alliance-policy.js';
const config = { accountId: 'account', seed: 'rc1-alpha' }, at = 1000;
const base = () => ({ accountId: 'account', session: { authed: true, character: { id: 'actor' } },
  me: { character: { id: 'actor', cash: 500, loc: 'docks', gang: { id: 'family-a', role: 'boss' } } },
  directory: { gangs: [{ id: 'family-b', npc: false }] }, diplomacy: { relations: [], oathbreaker: null },
  catalog: { graphs: [{ id: 'omerta.coordination.split-ledger', contentHash: 'a'.repeat(64) }] },
  knowledge: { claims: [{ id: 'claim', owned: true, aclRevision: 0, grants: [] }] },
  targets: { expiresAt: new Date(5000).toISOString(), targets: [{ id: 'IssuedOpaqueTarget', kind: 'account', label: 'Partner' }] } });
const opts = (phase, rest = {}) => ({ phase, logicalAt: at, ...rest });
const p = createAlliancePolicy(config), decision = p.choose(base(), opts('share', { targetLabel: 'Partner' }));
assert.equal(decision.request.body.targetId, 'IssuedOpaqueTarget');
assert.deepEqual(p.choose(base(), opts('pact')), decision, 'Pending identity survives changed phase');
const restored = createAlliancePolicy(config).restore(p.checkpoint()); assert.deepEqual(restored.choose(base(), opts('share')), decision);
const response = { claim: { id: 'claim' }, replayed: false };
p.settle({ idempotencyKey: decision.request.idempotencyKey, status: 'COMPLETED', replayed: false, response });
p.settle({ idempotencyKey: decision.request.idempotencyKey, status: 'COMPLETED', replayed: true, response: { ...response, replayed: true } });
assert.equal(p.summary().fresh, 1); assert.equal(p.summary().knownReplays, 1);
assert.throws(() => p.settle({ idempotencyKey: decision.request.idempotencyKey, status: 'COMPLETED', replayed: true, response: { claim: { id: 'other' } } }));
const choose = (v, phase, args) => createAlliancePolicy(config).choose(v, opts(phase, args));
const denied = base(); denied.knowledge.claims[0].owned = false; assert.equal(choose(denied, 'share', { targetLabel: 'Partner' }).kind, 'wait');
const stale = base(); stale.targets.expiresAt = new Date(at).toISOString(); assert.equal(choose(stale, 'share', { targetLabel: 'Partner' }).reason, 'target-board-expired');
const unissued = base(); unissued.targets.targets = []; assert.equal(choose(unissued, 'share', { targetLabel: 'Partner' }).reason, 'target-not-issued');
const outsider = base(); outsider.me.character.gang = null; assert.equal(choose(outsider, 'pact', { targetFamilyId: 'family-b' }).kind, 'wait');
const rank = base(); rank.me.character.gang.role = 'soldier'; assert.equal(choose(rank, 'pact', { targetFamilyId: 'family-b' }).kind, 'wait');
const active = base(); active.diplomacy.relations = [{ withId: 'family-b', active: true }];
assert.equal(choose(active, 'pact', { targetFamilyId: 'family-b' }).reason, 'pact-already-active');
const invite = base(); invite.diplomacy.relations = [{ withId: 'family-b', pending: true, mine: false }];
assert(choose(invite, 'pact', { targetFamilyId: 'family-b' }).request.path.endsWith('/accept'));
assert.equal(choose(base(), 'revoke', { targetLabel: 'Partner' }).kind, 'wait');
assert.throws(() => choose({ ...base(), accountId: 'foreign' }, 'create'));
assert.throws(() => choose({ ...base(), diagnostics: {} }, 'create'));
const a = createAlliancePolicy(config), created = a.choose(base(), opts('create'));
a.settle({ idempotencyKey: created.request.idempotencyKey, status: 'COMPLETED', replayed: false, response: { instance: { id: 'instance' } } });
const view = { ...base(), instance: { id: 'instance', revision: 3, status: 'active', actions: [{ id: 'issued-action', nodeId: 'known' }] } };
assert.equal(a.choose(view, opts('act', { nodeId: 'hidden' })).kind, 'wait');
const act = a.choose(view, opts('act')); assert.deepEqual(act.request.body, { expectedRevision: 3, actionId: 'issued-action' });
const restart = createAlliancePolicy(config).restore(a.checkpoint()); assert.deepEqual(restart.choose(view, opts('act')), act);
restart.settle({ idempotencyKey: act.request.idempotencyKey, status: 'COMPLETED', replayed: true, response: { instance: { id: 'instance' } } });
assert.equal(restart.summary().unresolvedReplays, 1); assert.throws(() => restart.choose(view, opts('act')), /Unresolved/);
const bad = a.checkpoint(); bad.payload.choices++; assert.throws(() => createAlliancePolicy(config).restore(bad), /checksum/);
assert.deepEqual(choose(base(), 'create'), choose(base(), 'create'), 'Seeded exact selection');
console.log('PASS: issued public choices, pact/ACL separation, exact restart/replay and stale/foreign/unissued controls');
