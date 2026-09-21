import assert from 'node:assert/strict';
import { createMarketPolicy } from '../tools/rc1-market-policy.js';
const config = { accountId: 'actor', seed: 'rc1-alpha' }, at = 1000;
const view = () => ({ accountId: 'actor', session: { authed: true, character: { id: 'own' } },
  me: { character: { id: 'own', cash: 500, cargo: { gin: 1 }, cargoCap: 10, loc: 'docks', jailSeconds: 0, safeSeconds: 0 } },
  rules: { goods: [{ id: 'gin', base: 120 }, { id: 'coffee', base: 180 }] },
  market: { levers: { minPrice: 50, listFeeBps: 100 }, listings: [
    { id: 'sale', kind: 'good', sellerId: 'other', good: 'gin', qty: 1, unitPrice: 50, district: 'docks', expiresSeconds: 3600 }] } });
const choose = (p, v, phase) => p.choose(v, { logicalAt: at, phase });
const p = createMarketPolicy(config), post = choose(p, view(), 'post');
assert.equal(post.type, 'market.post-good'); assert.deepEqual(post.request.body, { goodId: 'gin', qty: 1, price: 50, hours: 1 });
const restored = createMarketPolicy(config).restore(p.checkpoint()); assert.deepEqual(choose(restored, view(), 'take'), post);
const posted = { ok: true, id: 'own-post', kind: 'good', good: 'gin', qty: 1, price: 50, expiresSeconds: 3600 };
restored.settle({ idempotencyKey: post.request.idempotencyKey, status: 'COMPLETED', replayed: false, response: posted });
restored.settle({ idempotencyKey: post.request.idempotencyKey, status: 'COMPLETED', replayed: true, response: posted });
assert.equal(restored.summary().fresh, 1); assert.equal(restored.summary().knownReplays, 1);
assert.throws(() => restored.settle({ idempotencyKey: post.request.idempotencyKey, status: 'COMPLETED', replayed: true,
  response: { ...posted, id: 'other' } }), /Conflicting/);
const emptyCargo = view(); emptyCargo.me.character.cargo = {};
assert.equal(choose(createMarketPolicy(config), emptyCargo, 'post').type, 'market.post-order');
assert.equal(choose(createMarketPolicy(config), emptyCargo, 'post').request.body.goodId, 'gin');
const buyer = createMarketPolicy(config), buy = choose(buyer, view(), 'take'); assert.equal(buy.type, 'market.buy');
const denied = { error: 'no_listing' };
buyer.settle({ idempotencyKey: buy.request.idempotencyKey, status: 'DENIED', replayed: false, response: denied });
assert.equal(buyer.summary().denials, 1); assert.equal(buyer.summary().fresh, 0);
const lost = choose(buyer, view(), 'take');
buyer.settle({ idempotencyKey: lost.request.idempotencyKey, status: 'COMPLETED', replayed: true, response: { ok: true } });
assert.equal(buyer.summary().fresh, 0); assert.throws(() => choose(buyer, view(), 'take'), /Unresolved/);
const unresolved = createMarketPolicy(config).restore(buyer.checkpoint());
assert.deepEqual(unresolved.checkpoint().payload.unresolved[0].decision, lost);
assert.deepEqual(unresolved.checkpoint().payload.unresolved[0].response, { ok: true });
assert.throws(() => choose(unresolved, view(), 'take'), /Unresolved/);
const retainedPost = restored.summary().retainedOwnPosts[0];
assert.equal(retainedPost.returnedExpirySeconds, 3600); assert.equal(retainedPost.selectedAt, at);
assert.equal(Object.hasOwn(retainedPost, 'originallyExpiresAt'), false, 'Selection time cannot prove delayed request deadline');
for (const mutation of [{ expiresSeconds: 0 }, { sellerId: 'own' }, { district: 'canal' }, { qty: 0 }, { unitPrice: 501 }, { kind: 'car' }]) {
  const v = view(); Object.assign(v.market.listings[0], mutation);
  assert.equal(choose(createMarketPolicy(config), v, 'take').kind, 'wait');
}
for (const mutate of [(v) => v.me.character.jailSeconds = 1, (v) => v.me.character.cargoCap = 1]) {
  const v = view(); mutate(v); assert.equal(choose(createMarketPolicy(config), v, 'take').kind, 'wait');
}
const foreign = view(); foreign.accountId = 'foreign'; assert.throws(() => choose(createMarketPolicy(config), foreign, 'take'), /Foreign/);
foreign.accountId = 'actor'; foreign.session.character.id = 'foreign'; assert.throws(() => choose(createMarketPolicy(config), foreign, 'take'), /Foreign/);
assert.throws(() => createMarketPolicy({ ...config, pool: {} }));
const hidden = view(); Object.defineProperty(hidden, 'database', { get() { throw Error('Hidden database inspected'); } });
Object.defineProperty(hidden.market.listings[0], 'reserve', { get() { throw Error('Hidden reserve inspected'); } });
choose(createMarketPolicy(config), hidden, 'take');
const fillView = view(); Object.assign(fillView.market.listings[0], { kind: 'order', wanted: 1 });
assert.equal(choose(createMarketPolicy(config), fillView, 'take').type, 'market.fill');
fillView.me.character.cargo = {}; assert.equal(choose(createMarketPolicy(config), fillView, 'take').kind, 'wait');
const orderPolicy = createMarketPolicy(config), order = choose(orderPolicy, emptyCargo, 'post');
orderPolicy.settle({ idempotencyKey: order.request.idempotencyKey, status: 'COMPLETED', replayed: false,
  response: { ok: true, id: 'own-order', kind: 'order', good: 'gin', wanted: 1, price: 50, expiresSeconds: 3600 } });
const warehouse = view(); warehouse.market.listings = [{ id: 'own-order', kind: 'order', good: 'gin', sellerId: 'own', wanted: 0,
  district: 'docks', unitPrice: 50, expiresSeconds: 1 }];
assert.equal(choose(createMarketPolicy(config), warehouse, 'claim').kind, 'wait', 'Unissued own posting identity cannot invent warehouse stock');
const claim = choose(orderPolicy, warehouse, 'claim'); assert.equal(claim.type, 'market.claim');
orderPolicy.settle({ idempotencyKey: claim.request.idempotencyKey, status: 'COMPLETED', replayed: false, response: { ok: true, claimed: 1 } });
assert.equal(choose(orderPolicy, warehouse, 'claim').kind, 'wait', 'Already claimed stock cannot be counted twice');
const cancel = choose(createMarketPolicy(config), warehouse, 'cancel'); assert.equal(cancel.type, 'market.cancel');
const bad = p.checkpoint(); bad.payload.counters.fresh++; assert.throws(() => createMarketPolicy(config).restore(bad), /checksum/);
console.log('PASS: market public candidate gates, own custody receipts, seeded identities, replay and checkpoint contracts');
