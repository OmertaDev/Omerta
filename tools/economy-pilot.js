// Controlled local commercial cohort. No live admission, inference calls or activity rewards.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import { buildServer } from '../src/server.js';
import { ledger } from '../src/game.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { recommendationOf } from './agent-alpha.js';

const memory = process.argv.includes('--memory');
if (memory) delete process.env.DATABASE_URL;
else {
  const url = new URL(process.env.PILOT_TEST_DATABASE_URL || 'about:blank');
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/omerta_pilot_'))
    throw new Error('PILOT_TEST_DATABASE_URL must name an isolated loopback omerta_pilot_* PostgreSQL database.');
  process.env.DATABASE_URL = url.href;
}
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT = 'off';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.MOD_KEY = crypto.randomBytes(32).toString('hex');
process.env.MARKET_SEED ||= 'controlled-pilot-market-seed-2026-!@#$%^&*';
process.env.DEPOT_PILOT = 'on';
process.env.DELIVERY_CONTRACTS = 'on';
if (!memory) {
  const probe = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const table = (await probe.query("SELECT to_regclass('public.characters') AS present")).rows[0].present;
    if (table && Number((await probe.query('SELECT COUNT(*) n FROM characters')).rows[0].n) !== 0)
      throw new Error('Refusing to seed capital into an occupied database; use a fresh isolated pilot database.');
  } finally { await probe.end(); }
}
const app = await buildServer();
const runId = crypto.randomUUID(), startedAt = new Date().toISOString();
let seq = 0, capital = 0;
const actions = [];
const request = async (method, url, token, body, key = `${runId}-${++seq}`) => {
  const r = await app.inject({ method, url, payload: body,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'idempotency-key': key } });
  return { code: r.statusCode, body: r.json() };
};
const create = async (name, initialCapital) => {
  const ownerToken = (await request('POST', '/v1/auth/guest')).body.token;
  const agentToken = (await request('POST', '/v1/auth/agent-key', ownerToken)).body.token;
  assert.equal((await request('POST', '/v1/character', ownerToken, { name })).code, 200);
  const ch = (await request('GET', '/v1/me', ownerToken)).body.character;
  await app.pool.query('UPDATE characters SET cash=$2,bank=0 WHERE id=$1', [ch.id, initialCapital]);
  await ledger(app.pool, { characterId: ch.id, currency: 'cash', amount: initialCapital - ch.cash - ch.bank, reason: 'pilot:capital' });
  capital += initialCapital;
  return { id: ch.id, ownerToken, agentToken, initialCapital };
};
const stateOf = async (owner) => (await request('GET', '/v1/depot', owner.ownerToken)).body.depot;
const act = async (actor, role, expected) => {
  for (let retry = 0; retry < 4; retry++) {
    const turn = (await request('GET', '/v1/agent/turn', actor.agentToken)).body;
    const action = recommendationOf(turn, role).action;
    if (!action) return null;
    if (expected) assert.equal(action.kind, expected);
    const result = await request('POST', '/v1/agent/act', actor.agentToken, { turnId: turn.turnId, actionId: action.id });
    if (result.body.error === 'stale_turn') continue;
    assert.equal(result.code, 200, result.body.error);
    actions.push({ role, kind: action.kind });
    return action.kind;
  }
  throw new Error('Repeated state changes prevented a bounded pilot action.');
};
try {
  const venues = [];
  for (const [index, district] of ['docks', 'neon'].entries()) {
    const suffix = runId.slice(0, 6) + index;
    const owner = await create(`Merchant ${suffix}`, 18000);
    const supplier = await create(`Supplier ${suffix}`, 6000);
    const customers = [await create(`Customer A${suffix}`, 6000), await create(`Customer B${suffix}`, 6000)];
    if (district !== 'docks') {
      await request('POST', `/v1/travel/${district}`, owner.ownerToken);
      for (const customer of customers) await request('POST', `/v1/travel/${district}`, customer.ownerToken);
    }
    const opened = await request('POST', '/v1/depot', owner.ownerToken,
      { salePrice: 900, bidPrice: 300, targetStock: 4, reorderAt: 0, restockBudget: 1500 });
    assert.equal(opened.code, 200, opened.body.error);
    owner.depotId = opened.body.id;
    assert.equal((await request('POST', `/v1/depot/${owner.depotId}/fund`, owner.ownerToken, { amount: 10000 })).code, 200);
    const approval = await request('POST', `/v1/depot/${owner.depotId}/policy`, owner.ownerToken,
      { expectedRevision: 0, enabled: true, allowRestock: true, allowReceive: true, businessPriority: true,
        maxSpend: 3636, reserveCash: 1500, expiresInSeconds: 3600 });
    assert.equal(approval.code, 200, approval.body.error);
    venues.push({ owner, supplier, customers });
  }
  for (let round = 0; round < 3; round++) for (const venue of venues) {
    await act(venue.owner, 'business', 'depot_restock');
    let delivered = false;
    for (let step = 0; step < 12; step++) {
      const kind = await act(venue.supplier, 'supplier');
      assert(kind, 'funded depot work has a supplier action');
      if (kind === 'delivery_deliver') { delivered = true; break; }
    }
    assert(delivered, 'supplier completes its contract within the bounded action count');
    await act(venue.owner, 'business', 'depot_receive');
    for (const customer of venue.customers) {
      const sale = await request('POST', `/v1/depot/${venue.owner.depotId}/buy`, customer.agentToken, { qty: 2, maxUnitPrice: 900 });
      assert.equal(sale.code, 200, sale.body.error);
    }
    const check = await runLedgerInvariants(app.pool, { alert: false });
    assert.deepEqual(check.checks.filter((c) => (['character cash', 'market escrow'].includes(c.name) || /^(depot |delivery |operating policy )/.test(c.name)) && !c.ok), []);
  }
  const businesses = [];
  for (const venue of venues) {
    const state = await stateOf(venue.owner);
    assert.equal(state.customerMetrics.repeatCustomers, 2);
    assert.equal(state.customerMetrics.measuredPurchases, 6);
    assert.equal(state.unitsSold, 12);
    assert.equal(state.stockoutEvents, 3);
    assert.equal(state.operatingPolicy.spent, 3636);
    assert.equal(await act(venue.owner, 'business'), null, 'finite owner budget ends further procurement');
    businesses.push({ district: state.district, customerRevenueGameCash: state.customerRevenue,
      costOfGoodsSoldGameCash: state.costOfGoodsSold, operatingExpensesGameCash: state.operatingExpenses,
      operatingProfitGameCash: state.operatingProfit, treasuryGameCash: state.treasury,
      budgetSpentGameCash: state.operatingPolicy.spent, stockouts: state.stockoutEvents,
      repeatCustomerCharacters: state.customerMetrics.repeatCustomers, purchases: state.customerMetrics.measuredPurchases,
      inferenceCostUsdMicros: 0, profitAfterInference: null });
  }
  const deliveries = (await app.pool.query('SELECT status FROM delivery_commitments')).rows;
  let finalLiquidCapital = businesses.reduce((n, b) => n + b.treasuryGameCash, 0);
  const supplierResults = [];
  for (const venue of venues) {
    for (const participant of [venue.owner, venue.supplier, ...venue.customers]) {
      const ch = (await request('GET', '/v1/me', participant.ownerToken)).body.character;
      finalLiquidCapital += Number(ch.cash) + Number(ch.bank);
      if (participant === venue.supplier) supplierResults.push({ districtServed: (await stateOf(venue.owner)).district,
        netCashChangeGameCash: Number(ch.cash) + Number(ch.bank) - participant.initialCapital });
    }
  }
  const activityRewards = Number((await app.pool.query("SELECT COUNT(*) n FROM transactions WHERE currency='cash' AND reason LIKE 'crime:%' AND amount>0")).rows[0].n);
  assert.equal(activityRewards, 0);
  assert(actions.every((a) => !['crime', 'onboard_claim', 'daily_claim', 'career_claim'].includes(a.kind)));
  const report = { runId, startedAt, finishedAt: new Date().toISOString(), environment: memory ? 'pg-mem' : 'isolated PostgreSQL',
    cohort: { depots: 2, supplierAgents: 2, customerCharacters: 4, initialCapitalGameCash: capital, additionalCapitalGrants: 0 },
    actionCount: actions.length, completion: { accepted: deliveries.length, delivered: deliveries.filter((c) => c.status === 'delivered').length },
    businesses, supplierResults, finalLiquidCapitalGameCash: finalLiquidCapital,
    liquidCapitalReductionGameCash: capital - finalLiquidCapital,
    activitySubsidies: 0, deployed: false,
    limitations: ['Controlled purchasing demand and fixed prices; not evidence of organic or independent customers',
      'Deterministic agents with no LLM calls; inference economics untested', 'Game cash has no verified USD conversion',
      'Liquid capital reduction includes purchases of retained customer cargo; it is not total wealth loss',
      'Test harness disables cadence; production Agent Alpha pacing is unchanged'], actions };
  const index = process.argv.indexOf('--output');
  const output = resolve(index >= 0 ? process.argv[index + 1] : 'output/agent-economy-pilot.json');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ report: output, environment: report.environment, actions: actions.length,
    deliveries: report.completion, operatingProfitGameCash: businesses.map((b) => b.operatingProfitGameCash), activitySubsidies: 0 }));
} finally { delete process.env.DEPOT_PILOT; delete process.env.DELIVERY_CONTRACTS; await app.close(); }
