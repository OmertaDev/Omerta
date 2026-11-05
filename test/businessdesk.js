import assert from 'node:assert/strict';
import { businessDesk, businessDeskLimit, BUSINESS_DESK } from '../src/businessdesk.js';

assert.equal(businessDeskLimit(), 20);
assert.equal(businessDeskLimit({ limit: '50' }), 50);
for (const query of [null, [], { limit: null }, { limit: 0 }, { limit: 51 }, { limit: 1.5 },
  { limit: '01' }, { limit: '1e1' }, { limit: ['1', '2'] }, { characterId: 'other' }, { limit: 2, after: 'other' }]) {
  assert.throws(() => businessDeskLimit(query), { code: 'business_desk' });
}
const ch = { id: 'current', account_id: 'private-account', name: 'Reader' };
const at = new Date('2026-10-01T00:00:00Z');
const rows = [
  { id: 'one', at, amount: '9007199254740993.125', reason: 'consignment:proceeds', counterparty: 'sale' },
  { id: 'two', at, amount: '-9007199254740993.124', reason: 'market:bid', counterparty: null },
  { id: 'three', at, amount: '99999999999999999', reason: 'market:refund', counterparty: null },
];
const calls = [];
const client = { async query(sql, values) {
  calls.push({ sql, values }); assert.match(sql, /^SELECT /);
  if (sql.includes('FROM characters')) return { rows: [{ cash: '9007199254740993.125', bank: '0.000000000000000001', observed_at: at }] };
  assert.match(sql, /character_id=\$1 AND currency='cash'/);
  assert.match(sql, /ORDER BY at DESC,id DESC LIMIT/);
  assert.deepEqual(values, [ch.id, 3]);
  assert(sql.includes("'craft:recipe:hardened_steel'"));
  assert(!sql.includes('crime:fixture'));
  return { rows };
} };
const result = await businessDesk(client, ch, 2);
assert.deepEqual(result.character, { id: 'current', name: 'Reader', cash: '9007199254740993.125', bank: '0.000000000000000001' });
assert.equal(result.currency, 'game_cash'); assert.equal(result.cashflow.hasMore, true);
assert.equal(result.cashflow.scope, BUSINESS_DESK.scope); assert.equal(result.cashflow.totalsScope, 'returned_rows');
assert.equal(result.cashflow.income, '9007199254740993.125');
assert.equal(result.cashflow.outflow, '9007199254740993.124');
assert.equal(result.cashflow.netCashflow, '0.001');
assert.deepEqual(result.cashflow.rows.map(row => row.category), ['consignment', 'market']);
assert.equal(result.cashflow.returned, 2); assert.equal(calls.length, 2);
assert.deepEqual(calls[0].values, ['current', 'private-account']);
assert.match(result.cashflow.measurement, /not accounting profit/);
const empty = await businessDesk({ async query(sql) { return { rows: sql.includes('FROM characters')
  ? [{ cash: '0', bank: '0', observed_at: at }] : [] }; } }, ch);
assert.deepEqual([empty.cashflow.income, empty.cashflow.outflow, empty.cashflow.netCashflow], ['0', '0', '0']);
assert.equal(empty.cashflow.hasMore, false);
await assert.rejects(businessDesk(client, ch, 51), { code: 'business_desk' });
await assert.rejects(businessDesk({ async query() { return { rows: [] }; } }, ch), { code: 'business_desk' });
console.log('business desk decimal projection PASS: exact NUMERIC strings beyond Number precision, bounded page totals, closed query and actor-derived SQL.');
