process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'test-only-operating-policy-isolated-long-secret-2026!';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.DEPOT_PILOT = 'on';
if (process.argv.includes('--postgres')) {
  if (!process.env.OPERATING_TEST_DATABASE_URL) throw new Error('Set OPERATING_TEST_DATABASE_URL to a dedicated throwaway PostgreSQL database.');
  process.env.DATABASE_URL = process.env.OPERATING_TEST_DATABASE_URL;
}
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { ledger } from '../src/game.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { recommendationOf } from '../tools/agent-alpha.js';
const app = await buildServer();
let seq = 0;
const call = async (method, url, token, body, key = `operating-${++seq}`) => {
  const r = await app.inject({ method, url, payload: body, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'idempotency-key': key } });
  return { code: r.statusCode, body: r.json() };
};
const grant = { expectedRevision: 0, enabled: true, allowRestock: true, allowReceive: true,
  businessPriority: true, maxSpend: 2020, reserveCash: 1500, expiresInSeconds: 3600 };
try {
  const ownerToken = (await call('POST', '/v1/auth/guest')).body.token;
  const agentToken = (await call('POST', '/v1/auth/agent-key', ownerToken)).body.token;
  await call('POST', '/v1/character', ownerToken, { name: 'Authorized Operator' });
  const ch = (await call('GET', '/v1/me', ownerToken)).body.character;
  await app.pool.query('UPDATE characters SET cash=20000,bank=0 WHERE id=$1', [ch.id]);
  await ledger(app.pool, { characterId: ch.id, currency: 'cash', amount: 20000 - ch.cash - ch.bank, reason: 'pilot:capital' });
  const terms = { salePrice: 2000, bidPrice: 500, reorderAt: 0, targetStock: 4, restockBudget: 3000 };
  const depot = (await call('POST', '/v1/depot', ownerToken, terms)).body.id, path = `/v1/depot/${depot}`;
  await call('POST', `${path}/fund`, ownerToken, { amount: 6000 });
  let turn = (await call('GET', '/v1/agent/turn', agentToken)).body;
  assert.equal(turn.actions.some((a) => a.kind === 'depot_restock'), false, 'opening and funding do not authorize automation');
  assert.equal((await call('POST', `${path}/policy`, agentToken, grant)).body.error, 'owner_authority');
  assert.equal((await call('POST', `${path}/restock`, agentToken)).body.error, 'operating_policy');
  const accepted = await call('POST', `${path}/policy`, ownerToken, grant, 'operating-grant-replay');
  assert.equal(accepted.code, 200, accepted.body.error);
  assert.deepEqual(await call('POST', `${path}/policy`, ownerToken, grant, 'operating-grant-replay'), accepted);
  assert.equal((await call('POST', `${path}/policy`, ownerToken, grant)).body.error, 'policy_revision');
  for (const [route, body] of [['configure', { ...terms, bidPrice: 700 }], ['withdraw', { amount: 1000 }], ['fund', { amount: 1 }]])
    assert.equal((await call('POST', `${path}/${route}`, agentToken, body)).body.error, 'owner_authority');
  turn = (await call('GET', '/v1/agent/turn', agentToken)).body;
  assert.equal(turn.recommendationSource, 'owner_policy');
  let action = recommendationOf(turn, 'business').action;
  assert.equal(action.kind, 'depot_restock');
  assert.equal(turn.recommendedActionId, action.id, 'explicit business priority precedes unrelated rewards');
  const savedTurn = turn;
  const revoked = await call('POST', `${path}/policy`, ownerToken, { ...grant, expectedRevision: 1, enabled: false });
  assert.equal(revoked.code, 200);
  assert.equal((await call('POST', '/v1/agent/act', agentToken, { turnId: savedTurn.turnId, actionId: action.id })).body.error, 'stale_turn');
  assert.equal((await call('GET', '/v1/depot', ownerToken)).body.depot.treasury, 6000);
  const renewed = await call('POST', `${path}/policy`, ownerToken, { ...grant, expectedRevision: 2 });
  assert.equal(renewed.code, 200);
  for (let retry = 0; retry < 3; retry++) {
    turn = (await call('GET', '/v1/agent/turn', agentToken)).body;
    action = recommendationOf(turn, 'business').action;
    const result = await call('POST', '/v1/agent/act', agentToken, { turnId: turn.turnId, actionId: action.id });
    if (result.body.error === 'stale_turn') continue;
    assert.equal(result.code, 200, result.body.error); break;
  }
  let state = (await call('GET', '/v1/depot', ownerToken)).body.depot;
  assert.equal(state.operatingPolicy.spent, 2020);
  assert.equal(state.operatingPolicy.remainingSpend, 0);
  const order = state.orders[0];
  assert.equal((await call('POST', `${path}/orders/${order.id}/cancel`, agentToken)).body.error, 'owner_authority');
  await call('POST', `${path}/orders/${order.id}/cancel`, ownerToken);
  state = (await call('GET', '/v1/depot', ownerToken)).body.depot;
  assert.equal(state.operatingPolicy.spent, 2020, 'refunds do not replenish an approval ceiling');
  assert.equal(state.automatedRestockQuote, null);
  turn = (await call('GET', '/v1/agent/turn', agentToken)).body;
  assert.equal(recommendationOf(turn, 'business').action, null, 'business role stops instead of farming unrelated income');
  assert.equal(recommendationOf({ ...turn, actions: turn.actions.filter((a) => a.kind === 'crime') }, 'supplier').action, null);
  assert.throws(() => recommendationOf(turn, 'invented'), /Unknown/);
  assert.equal((await call('POST', `${path}/external-costs`, agentToken, { category: 'inference', usdMicros: 100000 })).body.error, 'owner_authority');
  const cash = state.treasury;
  const cost = await call('POST', `${path}/external-costs`, ownerToken, { category: 'inference', usdMicros: 100000 }, 'external-cost-replay');
  assert.equal(cost.code, 200);
  assert.deepEqual(await call('POST', `${path}/external-costs`, ownerToken, { category: 'inference', usdMicros: 100000 }, 'external-cost-replay'), cost);
  state = (await call('GET', '/v1/depot', ownerToken)).body.depot;
  assert.equal(state.externalCostsUsdMicros, 100000); assert.equal(state.treasury, cash);
  assert.equal(state.profitAfterExternalCosts, null, 'USD costs are not converted into unpriced game cash');
  if (process.argv.includes('--postgres')) {
    const grants = await Promise.all([
      call('POST', `${path}/policy`, ownerToken, { ...grant, expectedRevision: 3, maxSpend: 5000 }),
      call('POST', `${path}/policy`, ownerToken, { ...grant, expectedRevision: 3, maxSpend: 6000 }),
    ]);
    assert.equal(grants.filter((r) => r.code === 200).length, 1, 'same-revision policy race issues one authorization');
    assert.equal(grants.filter((r) => r.body.error === 'policy_revision').length, 1);
    turn = (await call('GET', '/v1/agent/turn', agentToken)).body;
    action = recommendationOf(turn, 'business').action;
    const races = await Promise.all([
      call('POST', '/v1/agent/act', agentToken, { turnId: turn.turnId, actionId: action.id }),
      call('POST', `${path}/policy`, ownerToken, { ...grant, expectedRevision: 4, enabled: false }),
    ]);
    assert.equal(races[1].code, 200);
    assert(races[0].code === 200 || races[0].body.error === 'stale_turn', 'revocation and spending serialize under owner-character custody');
    state = (await call('GET', '/v1/depot', ownerToken)).body.depot;
    for (const order of state.orders) await call('POST', `${path}/orders/${order.id}/cancel`, ownerToken);
    await call('POST', `${path}/policy`, ownerToken, { ...grant, expectedRevision: 5, maxSpend: 5000 });
  } else await call('POST', `${path}/policy`, ownerToken, { ...grant, expectedRevision: 3, maxSpend: 5000 });
  await app.pool.query("UPDATE business_operating_policies SET expires_at=now()-interval '1 second' WHERE depot_id=$1 AND enabled", [depot]);
  turn = (await call('GET', '/v1/agent/turn', agentToken)).body;
  assert.equal(recommendationOf(turn, 'business').action, null, 'expired approval blocks automation');
  const invariant = await runLedgerInvariants(app.pool, { alert: false });
  assert.deepEqual(invariant.checks.filter((c) => (c.name === 'character cash' || c.name === 'market escrow' || c.name.startsWith('operating policy ') || c.name.startsWith('depot ')) && !c.ok), []);
  console.log('operating policies: separate owner authority, revision/replay, revocation, expiry, finite spend, priority, role isolation and outside-cost accounting passed');
} finally { delete process.env.DEPOT_PILOT; await app.close(); }
