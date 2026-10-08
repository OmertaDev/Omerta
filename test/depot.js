process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'test-only-depot-pilot-high-entropy-local-secret-2026!';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.MOD_KEY = 'depot-test-mod-key';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  if (!process.env.DEPOT_TEST_DATABASE_URL) throw new Error('Set DEPOT_TEST_DATABASE_URL to a dedicated throwaway PostgreSQL database.');
  process.env.DATABASE_URL = process.env.DEPOT_TEST_DATABASE_URL;
}
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { ledger } from '../src/game.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { sweepMarket, marketAvailability } from '../src/market.js';
import { DEPOT } from '../src/depot.js';

const app = await buildServer();
let sequence = 0;
const call = async (method, url, token, body, key = `depot-test-${++sequence}`) => {
  const response = await app.inject({ method, url, payload: body,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'idempotency-key': key } });
  return { code: response.statusCode, body: response.json() };
};
const me = async (player) => (await call('GET', '/v1/me', player.token)).body.character;
const create = async (name) => {
  const guest = (await call('POST', '/v1/auth/guest')).body.token;
  const token = (await call('POST', '/v1/auth/agent-key', guest)).body.token;
  assert.equal((await call('POST', '/v1/character', token, { name })).code, 200);
  const character = (await call('GET', '/v1/me', token)).body.character;
  await app.pool.query('UPDATE characters SET cash=100000,bank=0,nerve=0 WHERE id=$1', [character.id]);
  await ledger(app.pool, { characterId: character.id, currency: 'cash', amount: 100000 - character.cash - character.bank, reason: 'crime:pilot-fixture' });
  return { token: guest, agentToken: token, id: character.id };
};
const config = { salePrice: 2000, bidPrice: 500, reorderAt: 0, targetStock: 4, restockBudget: 3000 };
const state = async (owner) => (await call('GET', '/v1/depot', owner.token)).body.depot;
const invariant = async () => {
  const result = await runLedgerInvariants(app.pool, { alert: false });
  const checks = result.checks.filter((c) => c.name === 'character cash' || c.name === 'market escrow' || c.name.startsWith('depot '));
  assert(checks.length >= 9);
  assert.deepEqual(checks.filter((c) => !c.ok), [], 'business custody and cross-domain cash ledgers reconcile exactly');
};
const act = async (player, kind) => {
  let turn = (await call('GET', '/v1/agent/turn', player.token)).body;
  for (let retry = 0; retry < 3; retry++) {
    const action = turn.actions.find((a) => a.kind === kind);
    assert(action, `agent receives ${kind}`);
    const result = await call('POST', '/v1/agent/act', player.token, { turnId: turn.turnId, actionId: action.id });
    // Natural resource regeneration can invalidate a snapshot between GET and POST.
    // Rejected stale turns have spent nothing; follow the server's replacement authority.
    if (result.body.error === 'stale_turn') { turn = result.body.turn; continue; }
    assert.equal(result.code, 200, result.body.error || 'canonical depot action succeeds');
    return action;
  }
  assert.fail(`resource state kept changing while authorizing ${kind}`);
};

try {
  const owner = await create('Depot Merchant');
  const supplier = await create('Depot Supplier');
  const customer = await create('Depot Customer');
  const spec = (await call('GET', '/openapi.json')).body;
  assert.equal(spec.paths['/v1/depot'].post.operationId, 'openSupplyDepot');
  assert.deepEqual(spec.paths['/v1/depot'].post.requestBody.content['application/json'].schema.required,
    ['salePrice', 'bidPrice', 'targetStock', 'reorderAt', 'restockBudget']);
  assert.deepEqual(spec.paths['/v1/depots'].get.security, []);
  assert(spec.components.schemas.AgentTurn.properties.depot, 'the turn schema declares its business state');
  delete process.env.DEPOT_PILOT;
  assert.equal((await call('POST', '/v1/depot', owner.token, config)).body.error, 'pilot_disabled');
  process.env.DEPOT_PILOT = 'on';
  assert.equal((await call('POST', '/v1/depot', owner.token, { ...config, targetStock: 41 })).body.error, 'depot_terms');
  const opened = await call('POST', '/v1/depot', owner.token, config);
  assert.equal(opened.code, 200, JSON.stringify(opened.body));
  const id = opened.body.id;
  const path = `/v1/depot/${id}`;
  assert.equal((await call('POST', `${path}/policy`, owner.token, { expectedRevision: 0, enabled: true,
    allowRestock: true, allowReceive: true, businessPriority: true, maxSpend: 100000, reserveCash: 1000, expiresInSeconds: 3600 })).code, 200);
  assert.equal((await call('POST', '/v1/depot', owner.token, config)).body.error, 'exists');
  assert.equal((await call('POST', `${path}/fund`, customer.token, { amount: 6000 })).body.error, 'not_yours');
  assert.equal((await call('POST', `${path}/fund`, owner.token, { amount: -1 })).body.error, 'depot_terms');
  assert.equal((await call('POST', `${path}/fund`, owner.token, { amount: 6000 })).code, 200);
  const ownerCash = (await me(owner)).cash;
  assert.equal(ownerCash, 100000 - DEPOT.openingCost - 6000);
  assert.equal((await state(owner)).treasury, 6000);
  await invariant();

  await act(owner, 'depot_restock');
  let depot = await state(owner);
  const order = depot.orders[0];
  assert(order && order.wanted === 4);
  assert.equal(depot.treasury, 3980, 'escrow and listing fee come only from business funds');
  assert.equal((await me(owner)).cash, ownerCash, 'supplier procurement never debits personal cash');
  assert.equal((await call('POST', `${path}/restock`, owner.token)).body.error, 'pending_order');
  assert.equal((await call('POST', `${path}/withdraw`, owner.token, { amount: 5000 })).body.error, 'treasury');
  assert.equal((await call('POST', `/v1/market/${order.id}/cancel`, owner.token)).body.error, 'business_order');
  assert.equal((await call('POST', `${path}/configure`, owner.token, { ...config, bidPrice: 700 })).code, 200);
  await invariant();

  for (let delivery = 0; delivery < 2; delivery++) {
    assert.equal((await call('POST', '/v1/goods/buy', supplier.token, { goodId: 'gin', qty: 2 })).code, 200);
    await act(supplier, 'market_fill');
    const ownOrders = (await app.pool.query('SELECT * FROM market_listings WHERE seller_character=$1', [owner.id])).rows;
    const availability = marketAvailability({ id: owner.id, loc: 'docks', cash: 10000 },
      { owned: { cargo: {}, cars: [] } }, {}, ownOrders);
    assert.equal(availability.canClaim, false, 'generic market exploration cannot offer business inventory extraction');
    assert.equal(availability.canCancel, false, 'generic market exploration cannot offer business treasury refunds');
    assert.equal((await call('POST', `/v1/market/${order.id}/claim`, owner.token)).body.error, 'business_order');
    await act(owner, 'depot_receive');
    assert.equal((await state(owner)).stock, 2, 'partial deliveries enter business stock, not the owner trunk');
    assert.equal(Number((await me(owner)).cargo.gin || 0), 0);
    const publicBoard = (await call('GET', '/v1/depots')).body.businesses;
    assert.equal(publicBoard[0].stock, 2);
    assert.equal('treasury' in publicBoard[0], false, 'public customer quotes do not expose private budgets');
    assert.equal((await call('POST', `${path}/buy`, owner.token, { qty: 1, maxUnitPrice: 2000 })).body.error, 'self');
    const before = await state(owner);
    assert.equal((await call('POST', `${path}/buy`, customer.token, { qty: 3, maxUnitPrice: 2000 })).body.error, 'stock');
    assert.equal((await call('POST', `${path}/buy`, customer.token, { qty: 1, maxUnitPrice: 1999 })).body.error, 'price_changed');
    assert.deepEqual(await state(owner), before, 'overselling leaves stock, cost basis and treasury intact');
    await app.pool.query("UPDATE characters SET loc='neon' WHERE id=$1", [customer.id]);
    assert.equal((await call('POST', `${path}/buy`, customer.token, { qty: 1, maxUnitPrice: 2000 })).body.error, 'district');
    await app.pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [customer.id]);
    const key = `depot-customer-purchase-${delivery}`;
    const purchase = await call('POST', `${path}/buy`, customer.token, { qty: 2, maxUnitPrice: 2000 }, key);
    assert.equal(purchase.code, 200, JSON.stringify(purchase.body));
    assert.equal(purchase.body.businessRevenue, 3920);
    assert.deepEqual(await call('POST', `${path}/buy`, customer.token, { qty: 2, maxUnitPrice: 2000 }, key), purchase,
      'an ambiguous purchase retry cannot spend cash or transfer inventory twice');
    await invariant();
  }
  depot = await state(owner);
  assert.equal(depot.stock, 0);
  assert.equal(depot.stockCost, 0);
  assert.equal(depot.customerRevenue, 7840);
  assert.equal(depot.costOfGoodsSold, 2000);
  assert.equal(depot.operatingExpenses, 5020);
  assert.equal(depot.operatingProfit, 820, 'profit excludes capital deposits and includes opening and procurement fees');
  assert.equal(depot.treasury, 11820);
  assert.equal((await me(owner)).cash, ownerCash, 'customer revenue belongs to the business until withdrawn');
  assert.equal((await me(customer)).cargo.gin, 4);
  assert.equal((await call('POST', `${path}/configure`, owner.token, config)).code, 200,
    'changing future bids never reprices an existing delivery or its cost basis');
  await app.pool.query("UPDATE business_depots SET created_at=now()-interval '1 day' WHERE id=$1", [id]);
  assert.equal((await state(owner)).treasury, 11820, 'time alone produces no income');

  // Expiry returns business escrow to the same treasury, never its owner pocket.
  await act(owner, 'depot_restock');
  const expiring = (await state(owner)).orders[0];
  await app.pool.query("UPDATE market_listings SET expires_at=now()-interval '1 hour' WHERE id=$1", [expiring.id]);
  if (postgres) await Promise.all([
    sweepMarket(app.pool), call('POST', `${path}/orders/${expiring.id}/cancel`, owner.token),
  ]);
  else await sweepMarket(app.pool);
  assert.equal((await state(owner)).treasury, 11800);
  assert.equal((await me(owner)).cash, ownerCash);
  await invariant();

  // A disabled pilot still permits recovery of paid deliveries, stock and cash.
  await act(owner, 'depot_restock');
  const cancelled = (await state(owner)).orders[0];
  await call('POST', '/v1/goods/buy', supplier.token, { goodId: 'gin', qty: 2 });
  await act(supplier, 'market_fill');
  delete process.env.DEPOT_PILOT;
  assert.equal((await call('POST', `${path}/fund`, owner.token, { amount: 1 })).body.error, 'pilot_disabled');
  assert.equal((await call('POST', `${path}/close`, owner.token)).body.error, 'depot_obligations');
  const cancelledResult = await call('POST', `${path}/orders/${cancelled.id}/cancel`, owner.token);
  assert.equal(cancelledResult.body.refunded, 1000);
  assert.equal(cancelledResult.body.awaiting, 2);
  assert.equal((await call('POST', `${path}/orders/${cancelled.id}/receive`, owner.token)).body.received, 2);
  assert.equal((await call('POST', `${path}/stock/withdraw`, owner.token, { qty: 2 })).body.withdrawn, 2);
  assert.equal((await call('POST', `${path}/close`, owner.token)).code, 200);
  assert.equal(await state(owner), null);
  assert.equal((await me(owner)).cargo.gin, 2);
  await invariant();

  // An arbitrary market request cannot associate personal orders with a treasury.
  process.env.DEPOT_PILOT = 'on';
  const personalCash = (await me(customer)).cash;
  const spoofed = await call('POST', '/v1/market/order', customer.token,
    { goodId: 'gin', qty: 1, price: 500, depotId: id, depot_id: id });
  assert.equal(spoofed.code, 200);
  assert.equal((await app.pool.query('SELECT depot_id FROM market_listings WHERE id=$1', [spoofed.body.id])).rows[0].depot_id, null);
  assert.equal((await me(customer)).cash, personalCash - spoofed.body.escrow - spoofed.body.fee);
  await call('POST', `/v1/market/${spoofed.body.id}/cancel`, customer.token);
  await invariant();

  process.env.DEPOT_PILOT = 'on';
  const reopened = await call('POST', '/v1/depot', owner.token, config);
  assert.equal(reopened.code, 200, 'a closed depot does not permanently block that business type');
  const deathPath = `/v1/depot/${reopened.body.id}`;
  assert.equal((await call('POST', `${deathPath}/policy`, owner.token, { expectedRevision: 0, enabled: true,
    allowRestock: true, allowReceive: true, businessPriority: true, maxSpend: 100000, reserveCash: 1000, expiresInSeconds: 3600 })).code, 200);
  await call('POST', `${deathPath}/fund`, owner.token, { amount: 6000 });
  await call('POST', `${deathPath}/restock`, owner.token);
  await call('POST', '/v1/goods/buy', supplier.token, { goodId: 'gin', qty: 2 });
  await act(supplier, 'market_fill');
  await act(owner, 'depot_receive');
  if (postgres) {
    const peer = await create('Depot Competing Customer');
    const cashBefore = (await me(customer)).cash + (await me(peer)).cash;
    const races = await Promise.all([
      call('POST', `${deathPath}/buy`, customer.token, { qty: 2, maxUnitPrice: 2000 }),
      call('POST', `${deathPath}/buy`, peer.token, { qty: 2, maxUnitPrice: 2000 }),
    ]);
    assert.equal(races.filter((r) => r.code === 200).length, 1, 'two customers cannot buy the same last units');
    assert.equal(races.filter((r) => r.body.error === 'stock').length, 1);
    assert.equal((await me(customer)).cash + (await me(peer)).cash, cashBefore - 4000);
    await call('POST', '/v1/goods/buy', supplier.token, { goodId: 'gin', qty: 2 });
    await act(supplier, 'market_fill');
    await act(owner, 'depot_receive');
    const treasury = (await state(owner)).treasury;
    const withdrawals = await Promise.all([
      call('POST', `${deathPath}/withdraw`, owner.token, { amount: treasury - DEPOT.cashReserve }),
      call('POST', `${deathPath}/withdraw`, owner.token, { amount: treasury - DEPOT.cashReserve }),
    ]);
    assert.equal(withdrawals.filter((r) => r.code === 200).length, 1, 'concurrent withdrawals cannot spend the same treasury');
    assert.equal(withdrawals.filter((r) => r.body.error === 'treasury').length, 1);
    await invariant();
  }
  const death = await app.inject({ method: 'POST', url: '/v1/mod/kill', payload: { characterId: owner.id },
    headers: { 'x-mod-key': 'depot-test-mod-key' } });
  assert.equal(death.statusCode, 200, death.body);
  const deadDepot = (await app.pool.query('SELECT * FROM business_depots WHERE id=$1', [reopened.body.id])).rows[0];
  assert.equal(deadDepot.status, 'closed');
  assert.equal(Number(deadDepot.treasury), 0);
  assert.equal(Number(deadDepot.stock), 0);
  assert.equal(Number(deadDepot.stock_cost), 0);
  await invariant();
  console.log(`depot: funded inventory business, supplier agents, customers, exact profit, custody invariants, partial deliveries, retry, expiry, shutdown and death passed${postgres ? '; PostgreSQL purchase, withdrawal and refund races passed' : ''}`);
} finally {
  delete process.env.DEPOT_PILOT;
  await app.close();
}
