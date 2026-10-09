import assert from 'node:assert/strict';
import { restockCandidates } from '../src/restock.js';
import { goodsBuyQuote } from '../src/goodsquote.js';
import { BLACK_MARKET, CONSTANTS, DISTRICTS, goodPriceOf } from '../src/rules.js';

const policy = { cashReserve: 1000, minArbitrageProfit: 25 };
const ch = { id: 'supplier', loc: 'docks', cash: 50000 };
const owned = { cargo: {}, held: [], deedPerk: [] };
const order = { type: 'order', listingId: 'customer-order', posterId: 'customer',
  good: 'gin', wanted: 8, unitPrice: 2000, district: 'neon',
  expiresAt: new Date(Date.now() + 3600000).toISOString() };
const plans = (overrides = {}, inventory = owned, demand = order, cap = 10) =>
  restockCandidates({ ...ch, ...overrides }, { cargoCap: cap }, inventory, [demand], policy);

const candidate = plans()[0];
assert(candidate, 'funded customer demand produces a procurement plan from an empty trunk');
const { plan } = candidate;
const purchase = goodsBuyQuote(order.good, plan.source, plan.quantity, owned);
assert.equal(plan.acquisitionCash, purchase.total);
assert.equal(plan.netOrderCash, plan.quantity * order.unitPrice
  - Math.ceil(plan.quantity * order.unitPrice * BLACK_MARKET.TAKE_BPS / 10000));
assert.equal(candidate.estimate.cash, plan.netOrderCash - plan.acquisitionCash - plan.travelCash);
assert(ch.cash - plan.acquisitionCash - plan.travelCash >= policy.cashReserve);
assert.equal(plan.route.at(-1).path, '/v1/market/customer-order/fill');
assert.equal(plan.route.at(-1).quantity, 8);
assert.equal(candidate.action.risk.orderReserved, false);
for (const district of DISTRICTS) {
  const fares = (ch.loc === district.id ? 0 : CONSTANTS.TRAVEL_COST)
    + (district.id === order.district ? 0 : CONSTANTS.TRAVEL_COST);
  assert(plan.acquisitionCash + plan.travelCash <= goodsBuyQuote('gin', district.id, 8, owned).total + fares,
    'the supplier route includes both fares when choosing the best acquisition cost');
}
assert.equal(plans({ id: order.posterId }).length, 0, 'no sourcing for own orders');
assert.equal(plans({ jail_until: new Date(Date.now() + 60000) }).length, 0, 'no sourcing from jail');
assert.equal(plans({ cash: 1000 }).length, 0, 'no spending the cash reserve');
assert.equal(plans({}, owned, { ...order, wanted: 0 }).length, 0, 'no buying against exhausted demand');
assert.equal(plans({}, owned, { ...order, unitPrice: 1 }).length, 0, 'no loss-making sourcing');
assert.equal(plans({}, owned, { ...order, expiresAt: new Date(Date.now() + 30000).toISOString() }).length, 0,
  'no starting a delivery against imminent expiry');
assert.equal(plans({}, owned, { ...order, good: 'invented' }).length, 0);
assert.equal(plans({}, { ...owned, cargo: { silk: 10 } }).length, 0, 'other cargo occupies trunk capacity');
assert.equal(plans({}, owned, order, 3)[0].plan.quantity, 3, 'delivery is capped by free trunk space');
const budget = goodsBuyQuote('gin', ch.loc, 1, owned).total + policy.cashReserve + 2 * CONSTANTS.TRAVEL_COST;
const small = plans({ cash: budget })[0];
assert(small && budget - small.plan.acquisitionCash - small.plan.travelCash >= policy.cashReserve,
  'fee rounding never overruns the purchase and travel budget');

const loaded = plans({}, { ...owned, cargo: { gin: 3 } })[0];
assert.equal(loaded.plan.status, 'travel_to_deliver');
assert.equal(loaded.action.path, '/v1/travel/neon');
assert.equal(loaded.plan.acquisitionCash, 0, 'held inventory is delivered without another purchase');
assert.equal(loaded.estimate.inventory, -3 * goodPriceOf('gin', ch.loc), 'delivery accounts for surrendered inventory');
assert.equal(plans({ loc: 'neon' }, { ...owned, cargo: { gin: 3 } }).length, 0,
  'existing local fill handles arrived goods without duplicate descriptors');
for (const controlled of [{ ...owned, held: ['docks'] }, { ...owned, deedPerk: ['docks'] }]) {
  const quote = goodsBuyQuote('gin', 'docks', 3, controlled);
  assert.equal(quote.unit, Math.round(goodPriceOf('gin', 'docks') * 0.95));
  assert.equal(quote.total, quote.unit * 3 + 2 * Math.ceil(quote.unit * 3 * 0.01));
}
const depleted = { districts: Object.fromEntries(DISTRICTS.map((d) => [d.id, { gin: { stock: 0 } }])) };
assert.equal(restockCandidates(ch, { cargoCap: 10 }, owned, [order], policy, depleted).length, 0,
  'an empty NPC market offers no acquisition plan');
depleted.districts.docks.gin.stock = 3;
const limited = restockCandidates(ch, { cargoCap: 10 }, owned, [order], policy, depleted)[0];
assert.equal(limited.plan.quantity, 3, 'procurement respects remaining shop stock');
assert.equal(limited.plan.source, 'docks', 'procurement selects a supplier with stock');
console.log('restock: procurement margins, route selection, reserve, capacity, ownership, expiry, turf quotes and finite supply passed');
