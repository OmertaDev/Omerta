import assert from 'node:assert/strict';
import { createResourcePressurePolicy, planResourcePressure } from '../tools/rc1-resource-pressure-policy.js';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
const configuration = { accountId: 'alice', seed: 'rc1-alpha', scenario: 'resource_scarcity' };
const view = { accountId: 'alice', session: { authed: true, character: { id: 'alice-character' } },
  me: { character: { id: 'alice-character', name: 'Alice', cash: 500, ammo: 25, nerve: 10, level: 1, checkin: { done: false, pay: 350 } } },
  rules: { crimes: [{ id: 'pick', lvl: 1, nerve: 2 }] }, exchange: { listings: [{ id: 'lot-1', seller: 'Bob', kind: 'ammo', qty: 25, unitPrice: 20 }] } };
assert.equal(planResourcePressure('resource_abundance').expectedCashAfterFirstCheckin, 26750);
assert.throws(() => planResourcePressure('invented'));
const p = createResourcePressurePolicy(configuration);
assert.equal(p.choose(view, { logicalAt: 1, phase: 'replenish-ammo' }).reason, 'armory-cash');
const choice = p.choose(view, { logicalAt: 2, phase: 'take' });
assert.equal(choice.request.path, '/v1/exchange/lot-1/buy');
assert.throws(() => p.choose({ ...view, accountId: 'mallory' }, { logicalAt: 2, phase: 'take' }), /Foreign/);
const restored = createResourcePressurePolicy(configuration).restore(p.checkpoint());
assert.deepEqual(restored.choose(view, { logicalAt: 3, phase: 'hoard' }), choice);
const response = { ok: true, exchange: 'bought', kind: 'ammo', qty: 25, paid: 500 };
restored.settle({ idempotencyKey: choice.request.idempotencyKey, status: 'COMPLETED', replayed: false, response });
restored.settle({ idempotencyKey: choice.request.idempotencyKey, status: 'COMPLETED', replayed: true, response });
assert.equal(restored.summary().fresh, 1); assert.equal(restored.summary().knownReplays, 1);
assert.throws(() => restored.settle({ idempotencyKey: choice.request.idempotencyKey, status: 'COMPLETED', replayed: true, response: { ...response, paid: 1 } }), /Conflicting/);
const corrupt = restored.checkpoint(); corrupt.payload.counters.fresh++; corrupt.sha256 = sha256(canonicalJson(corrupt.payload));
assert.throws(() => createResourcePressurePolicy(configuration).restore(corrupt));
const uncertain = createResourcePressurePolicy(configuration), pending = uncertain.choose(view, { logicalAt: 1, phase: 'take' });
uncertain.settle({ idempotencyKey: pending.request.idempotencyKey, status: 'COMPLETED', replayed: true, response });
assert.throws(() => uncertain.choose(view, { logicalAt: 2, phase: 'progress' }), /Unresolved/);
assert.throws(() => createResourcePressurePolicy(configuration).choose({ ...view, exchange: { listings: [...view.exchange.listings, ...view.exchange.listings] } }, { logicalAt: 1, phase: 'take' }), /Duplicate/);
console.log('resource pressure policy: PASS (identity, gates, pending restore, exact replay, unresolved replay, corrupted checkpoint, duplicate lot)');
