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
import { DISTRICTS, CONSTANTS } from '../src/rules.js';
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
  const supplierDistrict = (await call('GET', '/v1/me', deathSupplier)).body.character.loc;
  const destination = DISTRICTS.find((d) => d.id !== supplierDistrict).id;
  assert.equal((await call('POST', `/v1/travel/${destination}`, deathBuyer)).code, 200);
  const deathDepot = await depot(deathBuyer, 1000);
  const refill = (await call('POST', `/v1/depot/${sellerDepot}/restock`, seller)).body.id;
  await call('POST', '/v1/goods/buy', rival, { goodId: 'gin', qty: 4 });
  await call('POST', `/v1/market/${refill}/fill`, rival, { qty: 4 });
  assert.equal((await call('POST', `/v1/depot/${sellerDepot}/orders/${refill}/receive`, seller)).code, 200);
  await call('POST', `/v1/depot/${sellerDepot}/configure`, seller, { ...config, bidPrice: 50, salePrice: 60 });
  await call('POST', `/v1/depot/${deathDepot}/configure`, deathBuyer, { ...config, bidPrice: 1000, salePrice: 2000, restockBudget: 5000 });
  const deathOrder = (await call('POST', `/v1/depot/${deathDepot}/restock`, deathBuyer)).body.id;
  const autoAccepted = await call('POST', `/v1/market/${deathOrder}/accept-delivery`, deathSupplier,
    { qty: 2, unitPrice: 1000, maxProcurementCash: 600, deadlineSeconds: 3600 });
  assert.equal(autoAccepted.code, 200, JSON.stringify(autoAccepted.body));
  const autoCommitment = autoAccepted.body.id;
  const autoTurn = (await call('GET', '/v1/agent/turn', deathSupplier)).body;
  const issued = autoTurn.actions.find((a) => a.kind === 'delivery_depot_buy' && a.body.commitmentId === autoCommitment);
  assert.ok(issued, `Agent Turn issues actual player storefront acquisition: ${JSON.stringify(autoTurn.actions.filter((a) => a.kind.startsWith('delivery_')))}`);
  const issuedBody = { turnId: autoTurn.turnId, actionId: issued.id };
  const untouched = await snapshot(deathSupplier, sellerDepot, autoCommitment);
  await call('POST', `/v1/depot/${sellerDepot}/configure`, seller, { ...config, bidPrice: 50, salePrice: 70 });
  assert.equal((await call('POST', '/v1/agent/act', deathSupplier, issuedBody)).body.error, 'stale_turn');
  await call('POST', `/v1/depot/${sellerDepot}/configure`, seller, { ...config, bidPrice: 50, salePrice: 60 });
  await app.pool.query('UPDATE delivery_commitments SET spend_limit=119 WHERE id=$1', [autoCommitment]);
  assert.equal((await call('POST', '/v1/agent/act', deathSupplier, issuedBody)).body.error, 'stale_turn');
  await app.pool.query('UPDATE delivery_commitments SET spend_limit=600 WHERE id=$1', [autoCommitment]);
  assert.deepEqual(await snapshot(deathSupplier, sellerDepot, autoCommitment), untouched, 'stale quote and cap refuse without economic mutation');
  assert.equal((await call('POST', `/v1/depot/${sellerDepot}/buy`, rival, { qty: 3, maxUnitPrice: 60 })).code, 200);
  const depleted = await snapshot(deathSupplier, sellerDepot, autoCommitment);
  assert.equal((await call('POST', '/v1/agent/act', deathSupplier, issuedBody)).body.error, 'stale_turn');
  assert.deepEqual(await snapshot(deathSupplier, sellerDepot, autoCommitment), depleted, 'stock depletion invalidates old quantity without acquisition');
  await call('POST', `/v1/depot/${sellerDepot}/configure`, seller, { ...config, bidPrice: 50, salePrice: 60, reorderAt: 1 });
  const staleRefill = (await call('POST', `/v1/depot/${sellerDepot}/restock`, seller)).body.id;
  assert.equal((await call('POST', `/v1/market/${staleRefill}/fill`, rival, { qty: 3 })).code, 200);
  assert.equal((await call('POST', `/v1/depot/${sellerDepot}/orders/${staleRefill}/receive`, seller)).code, 200);
  const fresh = (await call('GET', '/v1/agent/turn', deathSupplier)).body;
  const freshAction = fresh.actions.find((a) => a.kind === 'delivery_depot_buy' && a.body.commitmentId === autoCommitment);
  const freshBody = { turnId: fresh.turnId, actionId: freshAction.id };
  let executionKey = 'storefront-issued-execution', executed;
  if (postgres) {
    const race = await Promise.all([call('POST', '/v1/agent/act', deathSupplier, freshBody, executionKey),
      call('POST', '/v1/agent/act', deathSupplier, freshBody, `${executionKey}-competing`)]);
    assert.equal(race.filter((r) => r.code === 200).length, 1, 'same issued turn commits acquisition once');
    assert.equal(race.filter((r) => r.body.error === 'stale_turn').length, 1);
    if (race[1].code === 200) { executed = race[1]; executionKey += '-competing'; } else executed = race[0];
  } else executed = await call('POST', '/v1/agent/act', deathSupplier, freshBody, executionKey);
  assert.equal(executed.code, 200, JSON.stringify(executed.body));
  assert.equal(executed.body.result.paid, 120);
  assert.deepEqual(await call('POST', '/v1/agent/act', deathSupplier, freshBody, executionKey), executed);
  assert.equal(Number((await snapshot(deathSupplier, sellerDepot, autoCommitment)).contract.spent), 120);
  assert.equal(executed.body.turn.actions.some((a) => a.kind === 'delivery_depot_buy' && a.body.commitmentId === autoCommitment), false,
    'held cargo completion takes precedence over more acquisition');
  const cashAfterPurchase = Number((await snapshot(deathSupplier, sellerDepot, autoCommitment)).ch.cash);
  const travelTurn = (await call('GET', '/v1/agent/turn', deathSupplier)).body;
  const travelAction = travelTurn.actions.find((a) => a.kind === 'delivery_travel' && a.body.commitmentId === autoCommitment);
  assert.ok(travelAction, 'the same acquired cargo exposes issued travel to its customer');
  const traveled = await call('POST', '/v1/agent/act', deathSupplier,
    { turnId: travelTurn.turnId, actionId: travelAction.id }, 'storefront-issued-travel');
  assert.equal(traveled.code, 200, JSON.stringify(traveled.body));
  const afterTravel = await snapshot(deathSupplier, sellerDepot, autoCommitment);
  assert.equal(Number(afterTravel.ch.cash), cashAfterPurchase - CONSTANTS.TRAVEL_COST);
  assert.equal(Number(afterTravel.contract.spent), 120 + CONSTANTS.TRAVEL_COST);
  assert.equal(afterTravel.cargo.find((r) => r.good_id === 'gin').qty, 2, 'travel preserves acquired cargo');
  const deliveryTurn = (await call('GET', '/v1/agent/turn', deathSupplier)).body;
  const deliveryAction = deliveryTurn.actions.find((a) => a.kind === 'delivery_deliver' && a.body.commitmentId === autoCommitment);
  assert.ok(deliveryAction, 'arrival exposes issued settlement of the same commitment');
  const deliveryBody = { turnId: deliveryTurn.turnId, actionId: deliveryAction.id };
  const takeBeforeDelivery = Number((await app.pool.query("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE reason='market:take' AND currency='cash'")).rows[0].total);
  const delivered = await call('POST', '/v1/agent/act', deathSupplier, deliveryBody, 'storefront-issued-delivery');
  assert.equal(delivered.code, 200, JSON.stringify(delivered.body));
  assert.equal(delivered.body.result.delivered, 2);
  assert.equal(delivered.body.result.gross, 2000);
  assert.equal(delivered.body.result.take, 40);
  assert.equal(delivered.body.result.earned, 1960);
  assert.deepEqual(await call('POST', '/v1/agent/act', deathSupplier, deliveryBody, 'storefront-issued-delivery'), delivered);
  const finished = await snapshot(deathSupplier, sellerDepot, autoCommitment);
  assert.equal(Number(finished.ch.cash), cashAfterPurchase - CONSTANTS.TRAVEL_COST + 1960);
  assert.equal(Number(finished.contract.spent), 120 + CONSTANTS.TRAVEL_COST, 'settlement adds no acquisition spend');
  assert.equal(Number(finished.contract.remaining), 0);
  assert.equal(Number((await app.pool.query("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE character_id=$1 AND reason='market:fill' AND currency='cash'", [deathSupplier.id])).rows[0].total), 1960);
  assert.equal(Number((await app.pool.query("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE character_id=$1 AND reason='depot:buy' AND currency='cash'", [deathSupplier.id])).rows[0].total), -120);
  assert.equal(Number((await app.pool.query("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE reason='market:take' AND currency='cash'")).rows[0].total) - takeBeforeDelivery, -40);
  assert.equal(Number(finished.cargo.find((r) => r.good_id === 'gin')?.qty || 0), 0);
  assert.equal((await app.pool.query('SELECT status FROM delivery_commitments WHERE id=$1', [autoCommitment])).rows[0].status, 'delivered');
  assert.equal(Number((await app.pool.query('SELECT filled_qty FROM market_listings WHERE id=$1', [deathOrder])).rows[0].filled_qty), 2,
    'customer warehouse receives exactly the acquired two units');
  assert.equal((await call('POST', `/v1/depot/${deathDepot}/orders/${deathOrder}/receive`, deathBuyer)).body.received, 2);
  assert.equal(Number((await app.pool.query('SELECT stock FROM business_depots WHERE id=$1', [deathDepot])).rows[0].stock), 2);
  const raceSupplier = await create('Storefront Race Supplier');
  const deathCommitment = (await call('POST', `/v1/market/${deathOrder}/accept-delivery`, raceSupplier,
    { qty: 2, unitPrice: 1000, maxProcurementCash: 600, deadlineSeconds: 3600 })).body.id;
  const deathPath = `/v1/deliveries/${deathCommitment}/depot/${sellerDepot}/buy`;
  const cashBeforeDeath = Number((await snapshot(raceSupplier, sellerDepot, deathCommitment)).ch.cash);
  const kill = () => app.inject({ method: 'POST', url: '/v1/mod/kill', payload: { characterId: seller.id },
    headers: { 'x-mod-key': 'storefront-test-mod' } });
  if (postgres) {
    const race = await Promise.all([call('POST', deathPath, raceSupplier, body), kill()]);
    assert.equal(race[1].statusCode, 200);
    assert.ok(race[0].code === 200 || ['no_target', 'no_depot'].includes(race[0].body.error));
    const end = await snapshot(raceSupplier, sellerDepot, deathCommitment);
    assert.equal(Number(end.ch.cash), cashBeforeDeath - (race[0].code === 200 ? 120 : 0));
    assert.equal(Number(end.contract.spent), race[0].code === 200 ? 120 : 0);
  } else {
    assert.equal((await kill()).statusCode, 200);
    assert.equal((await call('POST', deathPath, raceSupplier, body)).body.error, 'no_depot');
  }
  assert.equal((await app.pool.query('SELECT status FROM business_depots WHERE id=$1', [sellerDepot])).rows[0].status, 'closed');
  console.log(`Storefront canonical API and issued Agent Turn procurement passed (${postgres ? 'PostgreSQL concurrency' : 'memory'}).`);
} finally { await app.close(); }
