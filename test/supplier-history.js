import assert from 'node:assert/strict';
import { supplierHistory } from '../src/supplierhistory.js';

const now = Date.parse('2026-10-11T00:00:00Z');
const row = (id, changes = {}) => ({ id, buyerId: 'buyer', supplierId: 'supplier', quantity: 4, remaining: 2,
  deadline: new Date(now + 60000).toISOString(), status: 'accepted', ...changes });
const expired = new Date(now - 1).toISOString();
const rows = [row('fulfilled', { status: 'delivered', remaining: 0 }), row('late', { status: 'expired', deadline: expired }),
  row('buyer-death', { status: 'buyer_dead' }), row('supplier-death', { status: 'supplier_dead' }), row('active'),
  row('other-buyer', { buyerId: 'foreign' }), row('acting-supplier', { buyerId: 'foreign', supplierId: 'buyer' })];
const summary = supplierHistory(rows, 'buyer', now);
assert.deepEqual(summary.suppliers, [{ supplierId: 'supplier', fulfilled: 1, missedDeadline: 1,
  buyerInterrupted: 1, supplierInterrupted: 1, active: 1, unknown: 0, deliveredUnits: 12 }]);
assert.equal(summary.window.buyerContracts, 5);
assert.equal(summary.window.inputRows, 7);
assert.equal(summary.window.historyScope, 'buyer_and_supplier_roles');
assert.equal(summary.window.historyLimit, 100);
assert.equal(summary.unknownContracts, 0);
assert.equal(supplierHistory([row('boundary', { deadline: new Date(now).toISOString() })], 'buyer', now).suppliers[0].missedDeadline, 1);
assert.equal(supplierHistory([row('future-expired', { status: 'expired' })], 'buyer', now).suppliers[0].unknown, 1);
const single = supplierHistory([row('same')], 'buyer', now);
assert.deepEqual(supplierHistory([row('same'), row('same')], 'buyer', now),
  { ...single, window: { ...single.window, inputRows: 2 } });
const crossing = supplierHistory([row('cross', { deadline: expired }), row('cross', { status: 'expired', deadline: expired })], 'buyer', now);
assert.equal(crossing.suppliers[0].missedDeadline, 1, 'canonical elapsed normalization cannot duplicate an outcome');
for (const changes of [{ remaining: 5 }, { quantity: 41 }, { quantity: '4' }, { remaining: -1 }, { quantity: 1.5 },
  { quantity: Number.MAX_SAFE_INTEGER }, { remaining: NaN }, { deadline: null }, { deadline: 'invalid' },
  { status: 'delivered' }, { status: 'accepted', remaining: 0 }, { status: 'buyer_dead', remaining: 0 }, { status: 'unrecognized' }]) {
  const unknown = supplierHistory([row('malformed', changes)], 'buyer', now).suppliers[0];
  assert.equal(unknown.unknown, 1);
  assert.equal(unknown.deliveredUnits, 0);
}
const conflict = supplierHistory([row('conflict'), row('conflict', { remaining: 1 })], 'buyer', now);
assert.equal(conflict.suppliers[0].unknown, 1);
assert.equal(conflict.suppliers[0].deliveredUnits, 0);
const attributionConflict = supplierHistory([row('conflict'), row('conflict', { supplierId: 'different' })], 'buyer', now);
assert.equal(attributionConflict.unknownContracts, 1);
assert.deepEqual(attributionConflict.suppliers, []);
assert.equal(supplierHistory([row('conflict'), row('conflict', { buyerId: 'foreign' })], 'buyer', now).unknownContracts, 1);
assert.equal(supplierHistory([row('bad-id', { id: '../bad' })], 'buyer', now).unknownContracts, 1);
assert.equal(supplierHistory([row('self', { supplierId: 'buyer' })], 'buyer', now).unknownContracts, 1);
assert.equal(supplierHistory([row('money-conflict', { unitPrice: 100 }), row('money-conflict', { unitPrice: 200 })], 'buyer', now).suppliers[0].unknown, 1);
const ordered = [row('z', { supplierId: 'z' }), row('a', { supplierId: 'a' })];
assert.deepEqual(supplierHistory(ordered, 'buyer', now), supplierHistory([...ordered].reverse(), 'buyer', now));
assert.deepEqual(supplierHistory(ordered, 'buyer', now).suppliers.map(group => group.supplierId), ['a', 'z']);
const many = supplierHistory(Array.from({ length: 300 }, (_, i) => row(`active-${i}`)), 'buyer', now);
assert.equal(many.suppliers[0].active, 300, 'legitimate active scale is not truncated or rejected');
assert.equal(many.suppliers[0].deliveredUnits, 600);
assert.deepEqual(supplierHistory([], 'buyer', now).suppliers, []);
const privateRow = row('private', { cash: 12345, report: 'secret', question: 'secret', extraIdentity: 'secret' });
const output = JSON.stringify(supplierHistory([privateRow], 'buyer', now));
for (const forbidden of ['12345', 'secret', 'cash', 'report', 'question', 'unitPrice']) assert.ok(!output.includes(forbidden));
const before = structuredClone(rows);
supplierHistory(rows, 'buyer', now);
assert.deepEqual(rows, before, 'summary cannot mutate source observations');
for (const args of [[null, 'buyer', now], [[], '', now], [[], 'buyer', NaN], [[], 'buyer', Infinity], [[], 'buyer', 9e15]])
  assert.throws(() => supplierHistory(...args), TypeError);
console.log('Supplier private history: classification, causality, deduplication, privacy and 300-active scale passed.');
