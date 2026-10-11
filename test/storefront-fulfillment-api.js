process.env.RATE_LIMIT = 'off';
process.env.DEPOT_PILOT = 'on';
process.env.DELIVERY_CONTRACTS = 'on';
process.env.MOD_KEY = 'storefront-test-mod';
process.env.JWT_SECRET = 'test-only-storefront-fulfillment-long-isolated-secret';
process.env.SOCIAL_VERIFY_MODE = 'off';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  if (!process.env.STOREFRONT_TEST_DATABASE_URL) throw new Error('Set STOREFRONT_TEST_DATABASE_URL to a dedicated throwaway PostgreSQL database.');
  process.env.DATABASE_URL = process.env.STOREFRONT_TEST_DATABASE_URL;
}
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { ledger } from '../src/game.js';
const app = await buildServer();
let seq = 0;
const fixtureSuffix = Math.random().toString(36).slice(2, 6);
const call = async (method, url, p, body, key = `storefront-${++seq}`) => {
  const r = await app.inject({ method, url, payload: body, headers: {
    ...(p ? { authorization: `Bearer ${p.token}` } : {}), 'idempotency-key': key } });
  return { code: r.statusCode, body: r.json() };
};
const create = async (name) => {
  const token = (await call('POST', '/v1/auth/guest')).body.token, p = { token };
  assert.equal((await call('POST', '/v1/character', p, { name: `${name.slice(0, 20)} ${fixtureSuffix}` })).code, 200);
  const ch = (await call('GET', '/v1/me', p)).body.character;
  p.id = ch.id;
  await app.pool.query('UPDATE characters SET cash=50000,bank=0 WHERE id=$1', [p.id]);
  await ledger(app.pool, { characterId: p.id, currency: 'cash', amount: 50000 - ch.cash - ch.bank, reason: 'crime:storefront-fixture' });
  return p;
};
const config = { salePrice: 1000, bidPrice: 100, targetStock: 4, reorderAt: 0, restockBudget: 2000 };
const depot = async (p, salePrice) => {
  const opened = await call('POST', '/v1/depot', p, { ...config, salePrice });
  assert.equal(opened.code, 200, JSON.stringify(opened.body));
  await call('POST', `/v1/depot/${opened.body.id}/fund`, p, { amount: 6000 });
  return opened.body.id;
};
const snapshot = async (supplier, sellerDepot, commitment) => ({
  ch: (await app.pool.query('SELECT cash FROM characters WHERE id=$1', [supplier.id])).rows[0],
  depot: (await app.pool.query('SELECT treasury,stock,stock_cost FROM business_depots WHERE id=$1', [sellerDepot])).rows[0],
  contract: (await app.pool.query('SELECT spent,remaining FROM delivery_commitments WHERE id=$1', [commitment])).rows[0],
  cargo: (await app.pool.query('SELECT good_id,qty FROM character_cargo WHERE character_id=$1', [supplier.id])).rows,
});
try {
  const buyer = await create('Storefront Buyer'), seller = await create('Storefront Seller');
  const supplier = await create('Storefront Supplier'), rival = await create('Storefront Rival');
  const buyerDepot = await depot(buyer, 1000), sellerDepot = await depot(seller, 300);
  const stockOrder = (await call('POST', `/v1/depot/${sellerDepot}/restock`, seller)).body.id;
  assert.equal((await call('POST', '/v1/goods/buy', rival, { goodId: 'gin', qty: 4 })).code, 200);
  assert.equal((await call('POST', `/v1/market/${stockOrder}/fill`, rival, { qty: 4 })).code, 200);
  assert.equal((await call('POST', `/v1/depot/${sellerDepot}/orders/${stockOrder}/receive`, seller)).code, 200);
  const order = (await call('POST', `/v1/depot/${buyerDepot}/restock`, buyer)).body.id;
  const accepted = await call('POST', `/v1/market/${order}/accept-delivery`, supplier,
    { qty: 2, unitPrice: 100, maxProcurementCash: 600, deadlineSeconds: 3600 });
  assert.equal(accepted.code, 200, JSON.stringify(accepted.body));
  const id = accepted.body.id, path = `/v1/deliveries/${id}/depot/${sellerDepot}/buy`;
  const body = { qty: 2, maxUnitPrice: 300 };
  assert.equal((await call('POST', path, null, body)).code, 401);
  const before = await snapshot(supplier, sellerDepot, id);
  for (const [player, url, terms, error] of [
    [rival, path, body, 'no_commitment'],
    [supplier, path, { ...body, qty: 3 }, 'delivery_terms'],
    [supplier, path, { ...body, maxUnitPrice: 299 }, 'price_changed'],
    [supplier, `/v1/deliveries/${id}/depot/${buyerDepot}/buy`, body, 'delivery_terms'],
  ]) {
    assert.equal((await call('POST', url, player, terms)).body.error, error);
    assert.deepEqual(await snapshot(supplier, sellerDepot, id), before, 'rejected purchases mutate no funded state');
  }
  await app.pool.query('UPDATE delivery_commitments SET spend_limit=599 WHERE id=$1', [id]);
  assert.equal((await call('POST', path, supplier, body)).body.error, 'delivery_budget');
  await app.pool.query('UPDATE delivery_commitments SET spend_limit=600 WHERE id=$1', [id]);
  await app.pool.query('UPDATE characters SET cash=1599 WHERE id=$1', [supplier.id]);
  assert.equal((await call('POST', path, supplier, body)).body.error, 'delivery_budget');
  await app.pool.query('UPDATE characters SET cash=1600 WHERE id=$1', [supplier.id]);
  const result = await call('POST', path, supplier, body, 'storefront-confirmed-purchase');
  assert.equal(result.code, 200, JSON.stringify(result.body));
  assert.equal(result.body.paid, 600);
  assert.deepEqual(await call('POST', path, supplier, body, 'storefront-confirmed-purchase'), result);
  const after = await snapshot(supplier, sellerDepot, id);
  assert.equal(Number(after.ch.cash), 1000);
  assert.equal(Number(after.contract.spent), 600);
  assert.equal(Number(after.depot.stock), 2);
  assert.equal(Number(after.depot.treasury) - Number(before.depot.treasury), result.body.businessRevenue);
  assert.equal(after.cargo.find((r) => r.good_id === 'gin').qty, 2);
  assert.equal((await call('POST', path, supplier, { qty: 1, maxUnitPrice: 300 })).body.error, 'delivery_terms');
  const turn = (await call('GET', '/v1/agent/turn', supplier)).body;
  const forged = await call('POST', '/v1/agent/act', supplier,
    { turnId: turn.turnId, actionId: `delivery:${id}:depot:${sellerDepot}:buy` });
  assert.ok(['unknown_action', 'stale_turn'].includes(forged.body.error));
  assert.deepEqual(await snapshot(supplier, sellerDepot, id), after);
  await call('POST', `/v1/deliveries/${id}/deliver`, supplier, { qty: 2 });
  const second = await call('POST', `/v1/market/${order}/accept-delivery`, supplier,
    { qty: 2, unitPrice: 100, maxProcurementCash: 600, deadlineSeconds: 3600 });
  assert.equal(second.code, 200);
  const secondPath = `/v1/deliveries/${second.body.id}/depot/${sellerDepot}/buy`;
  await app.pool.query('UPDATE characters SET cash=1600 WHERE id=$1', [supplier.id]);
  if (postgres) {
    const races = await Promise.all([call('POST', secondPath, supplier, body), call('POST', secondPath, supplier, body)]);
    assert.equal(races.filter((r) => r.code === 200).length, 1, 'ordered character locks serialize acquisition');
    assert.equal(races.filter((r) => r.body.error === 'delivery_terms').length, 1);
  } else assert.equal((await call('POST', secondPath, supplier, body)).code, 200);
  assert.equal(Number((await app.pool.query('SELECT spent FROM delivery_commitments WHERE id=$1', [second.body.id])).rows[0].spent), 600);
  // A separately funded merchant's canonical death competes with an acquisition.
  const deathBuyer = await create('Storefront Death Buyer'), deathSupplier = await create('Storefront Death Supplier');
  const deathDepot = await depot(deathBuyer, 1000);
  const refill = (await call('POST', `/v1/depot/${sellerDepot}/restock`, seller)).body.id;
  await call('POST', '/v1/goods/buy', rival, { goodId: 'gin', qty: 4 });
  await call('POST', `/v1/market/${refill}/fill`, rival, { qty: 4 });
  assert.equal((await call('POST', `/v1/depot/${sellerDepot}/orders/${refill}/receive`, seller)).code, 200);
  const deathOrder = (await call('POST', `/v1/depot/${deathDepot}/restock`, deathBuyer)).body.id;
  const deathCommitment = (await call('POST', `/v1/market/${deathOrder}/accept-delivery`, deathSupplier,
    { qty: 2, unitPrice: 100, maxProcurementCash: 600, deadlineSeconds: 3600 })).body.id;
  const deathPath = `/v1/deliveries/${deathCommitment}/depot/${sellerDepot}/buy`;
  const cashBeforeDeath = Number((await snapshot(deathSupplier, sellerDepot, deathCommitment)).ch.cash);
  const kill = () => app.inject({ method: 'POST', url: '/v1/mod/kill', payload: { characterId: seller.id },
    headers: { 'x-mod-key': 'storefront-test-mod' } });
  if (postgres) {
    const race = await Promise.all([call('POST', deathPath, deathSupplier, body), kill()]);
    assert.equal(race[1].statusCode, 200);
    assert.ok(race[0].code === 200 || ['no_target', 'no_depot'].includes(race[0].body.error));
    const end = await snapshot(deathSupplier, sellerDepot, deathCommitment);
    assert.equal(Number(end.ch.cash), cashBeforeDeath - (race[0].code === 200 ? 600 : 0));
    assert.equal(Number(end.contract.spent), race[0].code === 200 ? 600 : 0);
  } else {
    assert.equal((await kill()).statusCode, 200);
    assert.equal((await call('POST', deathPath, deathSupplier, body)).body.error, 'no_depot');
  }
  assert.equal((await app.pool.query('SELECT status FROM business_depots WHERE id=$1', [sellerDepot])).rows[0].status, 'closed');
  console.log(`Storefront canonical API procurement passed (${postgres ? 'PostgreSQL concurrency' : 'memory'}); Agent Turn sourcing integration remains separate.`);
} finally { await app.close(); }
