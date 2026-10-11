import assert from 'node:assert/strict';
import { planCommittedCargo } from '../src/courierjobs.js';
import { CONSTANTS, DISTRICTS } from '../src/rules.js';

const now = Date.parse('2026-10-11T00:00:00Z');
const ch = { id: 'supplier', loc: DISTRICTS[0].id, cash: 1000 + CONSTANTS.TRAVEL_COST };
const owned = { cargo: { gin: 3 } };
const policy = { cashReserve: 1000, minArbitrageProfit: 999999 };
const contract = { id: 'commitment', supplierId: ch.id, status: 'accepted', good: 'gin',
  district: DISTRICTS[1].id, quantity: 4, remaining: 3, unitPrice: 123, takeBps: 200,
  maxProcurementCash: 1000, spent: 750, deadline: new Date(now + 1).toISOString() };
const plan = (c = contract, player = ch, inventory = owned) => planCommittedCargo(player, inventory, c, policy, now);

const travel = plan();
assert.equal(travel.kind, 'delivery_travel', 'accepted obligation ignores new-entry profit threshold');
assert.deepEqual(travel.body, { commitmentId: contract.id, district: contract.district });
assert.equal(travel.gross, 369);
assert.equal(travel.take, 7, 'partial settlement deducts cumulative fee difference');
assert.equal(travel.net, 362);
assert.equal(travel.incrementalCash, 112);
assert.equal(travel.travelCash, CONSTANTS.TRAVEL_COST);
assert.deepEqual(travel.inventory, { good: 'gin', quantity: 3 });
assert.equal(plan({ ...contract, spent: 751 }).blockedReason, 'budget');
assert.equal(plan(contract, { ...ch, cash: ch.cash - 1 }).blockedReason, 'reserve');
assert.equal(plan({ ...contract, deadline: new Date(now).toISOString() }).blockedReason, 'deadline');
assert.equal(plan({ ...contract, deadline: 'bad' }).blockedReason, 'deadline');
assert.equal(plan(contract, { ...ch, jail_until: new Date(now + 1) }).blockedReason, 'status');
assert.equal(plan(contract, { ...ch, safe_until: new Date(now + 1) }).blockedReason, 'status');
assert.equal(plan(contract, { ...ch, jail_until: new Date(now) }).kind, 'delivery_travel');
assert.equal(plan({ ...contract, unitPrice: 80 }).blockedReason, 'incremental_cash');
assert.equal(plan({ ...contract, takeBps: 10000 }).blockedReason, 'incremental_cash');
assert.equal(plan({ ...contract, status: 'delivered' }), null);
assert.equal(plan({ ...contract, supplierId: 'other' }), null);
assert.equal(plan(contract, ch, { cargo: {} }), null);
for (const changes of [{ remaining: 5 }, { quantity: 41 }, { spent: -1 }, { takeBps: 10001 },
  { district: 'invalid' }, { good: 'invalid' }, { unitPrice: 1.5 }, { maxProcurementCash: 100001 }, { id: '../path' }])
  assert.equal(plan({ ...contract, ...changes }).blockedReason, 'terms');
assert.equal(plan(contract, ch, { cargo: { gin: -1 } }).blockedReason, 'cargo');
assert.equal(plan(contract, { ...ch, loc: contract.district, cash: Number.MAX_SAFE_INTEGER }).blockedReason, 'cash_capacity');
const local = plan({ ...contract, spent: 1000 }, { ...ch, loc: contract.district, cash: 0 });
assert.equal(local.kind, 'delivery_deliver', 'delivery needs no fresh spending or travel reserve');
assert.deepEqual(local.body, { commitmentId: contract.id, qty: 3 });
assert.equal(local.travelCash, 0);
assert.equal(local.incrementalCash, local.net);
assert.equal(plan(contract, ch, { cargo: { gin: 40 } }).quantity, 3, 'never over-deliver commitment');
// Exhaustive small quantities demonstrate telescoping fees across partial settlements.
for (let price = 1; price <= 200; price++) for (let done = 0; done < 10; done++) {
  const c = { ...contract, quantity: 10, remaining: 10 - done, unitPrice: price };
  const result = plan(c, { ...ch, loc: c.district }, { cargo: { gin: 1 } });
  const take = Math.ceil((done + 1) * price * 200 / 10000) - Math.ceil(done * price * 200 / 10000);
  if (price - take > 0) assert.equal(result.take, take);
  else assert.equal(result.blockedReason, 'incremental_cash');
}
console.log('Courier committed-cargo continuation: boundaries and 2,000 cumulative-fee cases passed.');
