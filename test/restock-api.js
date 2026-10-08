process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'restock-test-secret';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { CONSTANTS, DISTRICTS, goodPriceOf } from '../src/rules.js';

const app = await buildServer();
let operation = 0;
const call = async (method, url, token, body, key = `restock-test-${++operation}`) => {
  const res = await app.inject({ method, url, payload: body,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'idempotency-key': key } });
  return { code: res.statusCode, body: res.json() };
};
const create = async (name) => {
  const guest = (await call('POST', '/v1/auth/guest')).body.token;
  const token = (await call('POST', '/v1/auth/agent-key', guest)).body.token;
  assert.equal((await call('POST', '/v1/character', token, { name })).code, 200);
  const me = (await call('GET', '/v1/me', token)).body.character;
  await app.pool.query('UPDATE characters SET cash=50000,nerve=0 WHERE id=$1', [me.id]);
  return { token, id: me.id };
};
const escrow = async () => {
  const check = (await runLedgerInvariants(app.pool, { alert: false })).checks.find((c) => c.name === 'market escrow');
  assert.equal(check.ok, true, JSON.stringify(check));
};

try {
  const supplier = await create('Supply Machine');
  const customer = await create('Customer Machine');
  const destination = 'neon';
  await app.pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [customer.id, destination]);
  const price = Math.max(...DISTRICTS.map((d) => goodPriceOf('gin', d.id))) + 1000;
  const order = await call('POST', '/v1/market/order', customer.token, { goodId: 'gin', qty: 3, price });
  assert.equal(order.code, 200, JSON.stringify(order.body));
  await escrow();
  const initial = (await call('GET', '/v1/agent/turn', supplier.token)).body;
  const originalPlan = initial.plans.find((p) => p.listingId === order.body.id);
  assert(originalPlan, 'real customer escrow produces an empty-trunk delivery plan');
  const startCash = initial.state.resources.cash;

  // Cancelling customer demand invalidates the procurement authority before cash is spent.
  assert.equal((await call('POST', `/v1/market/${order.body.id}/cancel`, customer.token)).code, 200);
  const stale = await call('POST', '/v1/agent/act', supplier.token,
    { turnId: initial.turnId, actionId: originalPlan.nextActionId });
  assert.equal(stale.body.error, 'stale_turn');
  assert.equal((await call('GET', '/v1/agent/turn', supplier.token)).body.state.resources.cash, startCash);
  await escrow();

  const liveOrder = await call('POST', '/v1/market/order', customer.token, { goodId: 'gin', qty: 3, price });
  assert.equal(liveOrder.code, 200);
  let spent = 0, earned = 0, bought = false, delivered = false;
  for (let step = 0; step < 5 && !delivered; step++) {
    const turn = (await call('GET', '/v1/agent/turn', supplier.token)).body;
    const plan = turn.plans.find((p) => p.listingId === liveOrder.body.id);
    const action = plan ? turn.actions.find((a) => a.id === plan.nextActionId)
      : turn.actions.find((a) => a.path === `/v1/market/${liveOrder.body.id}/fill`);
    assert(action, `customer delivery has a safe next step ${step}`);
    const body = { turnId: turn.turnId, actionId: action.id };
    const key = `restock-cycle-${step}`;
    const result = await call('POST', '/v1/agent/act', supplier.token, body, key);
    assert.equal(result.code, 200, JSON.stringify(result.body));
    const replay = await call('POST', '/v1/agent/act', supplier.token, body, key);
    assert.equal(replay.code, 200);
    assert.deepEqual(replay.body, result.body, 'exact retries replay rather than spending or delivering twice');
    if (action.kind === 'restock_buy') { spent += action.cost.cash; bought = true; }
    if (action.kind === 'restock_travel') spent += CONSTANTS.TRAVEL_COST;
    if (action.kind === 'market_fill') { earned = action.reward.cash.net; delivered = true; }
    await escrow();
  }
  assert(bought && delivered, 'agent sourced and delivered goods using canonical actions');
  const final = (await call('GET', '/v1/agent/turn', supplier.token)).body;
  assert.equal(final.state.resources.cash, startCash - spent + earned);
  assert(earned > spent, 'supplier profit is customer-funded after acquisition fees and travel');
  assert.equal(final.actions.some((a) => a.planId === `restock:${liveOrder.body.id}`), false,
    'no additional procurement after demand is filled');
  const claim = await call('POST', `/v1/market/${liveOrder.body.id}/claim`, customer.token);
  assert.equal(claim.code, 200);
  assert.equal(claim.body.claimed, 3, 'customer receives purchased goods at their own dock');
  await escrow();
  console.log('restock-api: customer escrow → agent procurement → travel → delivery → customer pickup, stale demand and replay passed');
} finally {
  await app.close();
}
