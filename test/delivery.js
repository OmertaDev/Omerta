process.env.RATE_LIMIT = 'off';
process.env.MOD_KEY = 'delivery-test-mod';
process.env.DEPOT_PILOT = 'on';
process.env.JWT_SECRET = 'test-only-delivery-pilot-high-entropy-local-secret-2026!';
process.env.SOCIAL_VERIFY_MODE = 'off';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  if (!process.env.DELIVERY_TEST_DATABASE_URL) throw new Error('Set DELIVERY_TEST_DATABASE_URL to a dedicated throwaway PostgreSQL database.');
  process.env.DATABASE_URL = process.env.DELIVERY_TEST_DATABASE_URL;
}
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { ledger, withCharacter } from '../src/game.js';
import { deliveryStep } from '../src/delivery.js';
import { runLedgerInvariants } from '../src/invariants.js';
const app = await buildServer();
let seq = 0;
const call = async (method, url, player, body, key = `delivery-${++seq}`) => {
  const r = await app.inject({ method, url, payload: body, headers: {
    ...(player ? { authorization: `Bearer ${player.token}` } : {}), 'idempotency-key': key,
  } });
  return { code: r.statusCode, body: r.json() };
};
const me = async (p) => (await call('GET', '/v1/me', p)).body.character;
const create = async (name) => {
  const guest = (await call('POST', '/v1/auth/guest')).body.token;
  const token = (await call('POST', '/v1/auth/agent-key', { token: guest })).body.token;
  const p = { token, ownerToken: guest };
  assert.equal((await call('POST', '/v1/character', p, { name })).code, 200);
  const ch = await me(p); p.id = ch.id;
  await app.pool.query('UPDATE characters SET cash=50000,bank=0,nerve=0 WHERE id=$1', [ch.id]);
  await ledger(app.pool, { characterId: ch.id, currency: 'cash', amount: 50000 - ch.cash - ch.bank, reason: 'crime:delivery-fixture' });
  p.accountId = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1', [ch.id])).rows[0].account_id;
  return p;
};
const checks = async () => {
  const results = await runLedgerInvariants(app.pool, { alert: false });
  assert.deepEqual(results.checks.filter((c) => (['character cash', 'market escrow'].includes(c.name)
    || c.name.startsWith('depot ') || c.name.startsWith('delivery ')) && !c.ok), []);
};
const accept = (order, qty = 3, spend = 1000) => ({ qty, unitPrice: 123, maxProcurementCash: spend, deadlineSeconds: 3600 });
try {
  const buyer = await create('Contract Merchant');
  buyer.token = buyer.ownerToken;
  let supplier = await create('Contract Supplier'), rival = await create('Contract Rival');
  const config = { salePrice: 2000, bidPrice: 123, targetStock: 4, reorderAt: 0, restockBudget: 3000 };
  const opened = await call('POST', '/v1/depot', buyer, config);
  assert.equal(opened.code, 200);
  const depot = opened.body.id, depotPath = `/v1/depot/${depot}`;
  await call('POST', `${depotPath}/fund`, buyer, { amount: 6000 });
  const order = (await call('POST', `${depotPath}/restock`, buyer)).body.id;
  const acceptPath = `/v1/market/${order}/accept-delivery`;
  delete process.env.DELIVERY_CONTRACTS;
  assert.equal((await call('POST', acceptPath, supplier, accept(order))).body.error, 'pilot_disabled');
  process.env.DELIVERY_CONTRACTS = 'on';
  assert.equal((await call('POST', acceptPath, buyer, accept(order))).body.error, 'own');
  assert.equal((await call('POST', acceptPath, supplier, { ...accept(order), qty: 41 })).body.error, 'delivery_terms');
  assert.equal((await call('POST', acceptPath, supplier, { ...accept(order), unitPrice: 124 })).body.error, 'price_changed');
  let accepted;
  if (postgres) {
    const race = await Promise.all([call('POST', acceptPath, supplier, accept(order)), call('POST', acceptPath, rival, accept(order))]);
    assert.equal(race.filter((r) => r.code === 200).length, 1, 'order lock prevents competing reservations from oversubscribing');
    assert.equal(race.filter((r) => r.body.error === 'reserved').length, 1);
    if (race[1].code === 200) { [supplier, rival] = [rival, supplier]; accepted = race[1]; }
    else accepted = race[0];
  } else accepted = await call('POST', acceptPath, supplier, accept(order), 'delivery-accept-replay');
  assert.equal(accepted.code, 200, accepted.body.error);
  const id = accepted.body.id;
  if (!postgres) assert.deepEqual(await call('POST', acceptPath, supplier, accept(order), 'delivery-accept-replay'), accepted);
  assert.equal((await call('POST', acceptPath, rival, accept(order, 2))).body.error, 'reserved');
  const board = (await call('GET', '/v1/market')).body.listings.find((l) => l.id === order);
  assert.equal(board.wanted, 1); assert.equal(board.reserved, 3);
  assert.equal((await call('POST', `${depotPath}/orders/${order}/cancel`, buyer)).body.error, 'committed_order');
  const originalTerms = (await call('GET', '/v1/deliveries', supplier)).body.commitments[0];
  assert.equal(originalTerms.netPayout, 361, 'net payout is fixed, including rounding');
  await call('POST', `${depotPath}/configure`, buyer, { ...config, bidPrice: 500 });
  await call('POST', '/v1/goods/buy', rival, { goodId: 'gin', qty: 2 });
  const fill = await call('POST', `/v1/market/${order}/fill`, rival, { qty: 2 });
  assert.equal(fill.body.delivered, 1, 'open fills consume only unreserved order quantity');
  await call('POST', '/v1/goods/buy', supplier, { goodId: 'gin', qty: 3 });
  assert.equal((await call('POST', `/v1/market/${order}/fill`, supplier, { qty: 1 })).body.error, 'qty');
  assert.equal((await call('POST', `/v1/deliveries/${id}/deliver`, rival, { qty: 1 })).body.error, 'no_commitment');
  delete process.env.DELIVERY_CONTRACTS;
  const before = (await me(supplier)).cash;
  const taxBefore = Number((await app.pool.query('SELECT pool FROM street_tax WHERE id=1')).rows[0].pool);
  let net = 0;
  for (let i = 0; i < 3; i++) {
    let key = `delivery-settle-${i}`, result;
    if (postgres && i === 2) {
      const races = await Promise.all([
        call('POST', `/v1/deliveries/${id}/deliver`, supplier, { qty: 1 }, key),
        call('POST', `/v1/deliveries/${id}/deliver`, supplier, { qty: 1 }, `${key}-competing`),
      ]);
      assert.equal(races.filter((r) => r.code === 200).length, 1, 'final reserved unit settles only once across distinct logical requests');
      assert.equal(races.filter((r) => r.body.error === 'no_commitment').length, 1);
      if (races[1].code === 200) { result = races[1]; key += '-competing'; } else result = races[0];
    } else result = await call('POST', `/v1/deliveries/${id}/deliver`, supplier, { qty: 1 }, key);
    assert.equal(result.code, 200, result.body.error);
    net += result.body.earned;
    assert.deepEqual(await call('POST', `/v1/deliveries/${id}/deliver`, supplier, { qty: 1 }, key), result);
    await checks();
  }
  assert.equal(net, 361); assert.equal((await me(supplier)).cash, before + 361);
  assert.equal(Number((await app.pool.query('SELECT pool FROM street_tax WHERE id=1')).rows[0].pool) - taxBefore, 4,
    'partial settlement also preserves the full-delivery fee-routing split');
  assert.equal((await call('POST', `/v1/deliveries/${id}/deliver`, supplier, { qty: 1 })).body.error, 'no_commitment');
  assert.equal((await call('GET', '/v1/deliveries', supplier)).body.commitments.find((c) => c.id === id).status, 'delivered');
  await call('POST', `${depotPath}/orders/${order}/receive`, buyer);
  await call('POST', `${depotPath}/stock/withdraw`, buyer, { qty: 4 });
  await call('POST', `${depotPath}/configure`, buyer, config);

  process.env.DELIVERY_CONTRACTS = 'on';
  const timedOrder = (await call('POST', `${depotPath}/restock`, buyer)).body.id;
  const timed = await call('POST', `/v1/market/${timedOrder}/accept-delivery`, supplier, accept(timedOrder, 2, 1));
  assert.equal(timed.code, 200);
  const second = await call('POST', `/v1/market/${timedOrder}/accept-delivery`, supplier, accept(timedOrder, 1, 1));
  assert.equal(second.code, 200);
  assert.equal((await call('POST', `/v1/market/${timedOrder}/accept-delivery`, supplier, accept(timedOrder, 1, 1))).body.error, 'delivery_limit');
  const cash = (await me(supplier)).cash;
  await assert.rejects(withCharacter(app.pool, supplier.accountId, (ch, client, h) =>
    deliveryStep(ch, timed.body.id, 'delivery_buy', { goodId: 'gin', qty: 1 }, client, h)), (e) => e.code === 'delivery_budget');
  assert.equal((await me(supplier)).cash, cash, 'budget refusal spends nothing');
  await app.pool.query("UPDATE delivery_commitments SET deadline=now()-interval '1 second' WHERE order_id=$1", [timedOrder]);
  assert.equal((await call('POST', `/v1/deliveries/${timed.body.id}/deliver`, supplier, { qty: 1 })).body.error, 'no_commitment');
  const expiry = await call('POST', `/v1/deliveries/${timed.body.id}/expire`, buyer);
  assert.equal(expiry.body.paid, 0); assert.equal(expiry.body.released, 2);
  assert.equal((await call('POST', `/v1/deliveries/${second.body.id}/expire`, supplier)).body.released, 1);
  assert.equal((await call('POST', `${depotPath}/orders/${timedOrder}/cancel`, buyer)).body.refunded, 492);
  await checks();

  // One autonomous sequence accepts first, then buys/travels under that exact
  // commitment and budget, then settles through the canonical Agent Turn executor.
  await call('POST', `${depotPath}/configure`, buyer, { ...config, bidPrice: 1000 });
  const autoOrder = (await call('POST', `${depotPath}/restock`, buyer)).body.id;
  let completed = false, spent = 0;
  for (let step = 0; step < 10 && !completed; step++) {
    const turn = (await call('GET', '/v1/agent/turn', supplier)).body;
    const action = turn.actions.find((a) => a.kind.startsWith('delivery_'));
    assert(action, 'accepted delivery always exposes its eligible bounded next step');
    assert(turn.plans.some((p) => p.id === action.planId && p.nextActionId === action.id), 'delivery action has a corresponding executable plan');
    if (step === 0) assert.equal(action.kind, 'delivery_accept', 'procurement starts by securing buyer escrow');
    const key = `delivery-auto-step-${step}`, body = { turnId: turn.turnId, actionId: action.id };
    const result = await call('POST', '/v1/agent/act', supplier, body, key);
    if (result.body.error === 'stale_turn') continue;
    assert.equal(result.code, 200, result.body.error);
    assert.deepEqual(await call('POST', '/v1/agent/act', supplier, body, key), result);
    if (['delivery_buy', 'delivery_travel'].includes(action.kind)) spent += action.cost.cash;
    completed = action.kind === 'delivery_deliver';
    await checks();
  }
  assert(completed, 'the bounded agent procures and delivers its accepted order');
  const auto = (await call('GET', '/v1/deliveries', supplier)).body.commitments.find((c) => c.orderId === autoOrder);
  assert.equal(auto.status, 'delivered'); assert.equal(auto.spent, spent);
  assert(auto.spent <= auto.maxProcurementCash);
  await call('POST', `${depotPath}/orders/${autoOrder}/receive`, buyer);
  await call('POST', `${depotPath}/stock/withdraw`, buyer, { qty: auto.quantity });
  await call('POST', `${depotPath}/configure`, buyer, config);
  const deathOrder = (await call('POST', `${depotPath}/restock`, buyer)).body.id;
  const dying = await call('POST', `/v1/market/${deathOrder}/accept-delivery`, rival, accept(deathOrder, 1));
  const kept = await call('POST', `/v1/market/${deathOrder}/accept-delivery`, supplier, accept(deathOrder, 2));
  assert.equal(dying.code, 200); assert.equal(kept.code, 200);
  let kill = await app.inject({ method: 'POST', url: '/v1/mod/kill', payload: { characterId: rival.id }, headers: { 'x-mod-key': 'delivery-test-mod' } });
  assert.equal(kill.statusCode, 200);
  assert.equal((await app.pool.query('SELECT status FROM delivery_commitments WHERE id=$1', [dying.body.id])).rows[0].status, 'supplier_dead');
  await checks();
  if (postgres) {
    assert.equal((await call('POST', '/v1/goods/buy', supplier, { goodId: 'gin', qty: 1 })).code, 200);
    const cashBefore = (await me(supplier)).cash;
    const race = await Promise.all([
      call('POST', `/v1/deliveries/${kept.body.id}/deliver`, supplier, { qty: 1 }),
      app.inject({ method: 'POST', url: '/v1/mod/kill', payload: { characterId: buyer.id }, headers: { 'x-mod-key': 'delivery-test-mod' } }),
    ]);
    kill = race[1];
    assert(race[0].code === 200 || race[0].body.error === 'no_commitment', 'death and delivery serialize to one terminal outcome');
    assert.equal((await me(supplier)).cash, cashBefore + (race[0].code === 200 ? 120 : 0), 'death race cannot fabricate or duplicate supplier payment');
  } else kill = await app.inject({ method: 'POST', url: '/v1/mod/kill', payload: { characterId: buyer.id }, headers: { 'x-mod-key': 'delivery-test-mod' } });
  assert.equal(kill.statusCode, 200);
  assert.equal((await app.pool.query('SELECT status FROM delivery_commitments WHERE id=$1', [kept.body.id])).rows[0].status, 'buyer_dead');
  await checks();
  console.log('delivery: reserved quantities, fixed partial payouts, retry, owner price changes, budget, expiry, shutdown, death and exact custody passed');
} finally { delete process.env.DELIVERY_CONTRACTS; delete process.env.DEPOT_PILOT; await app.close(); }
