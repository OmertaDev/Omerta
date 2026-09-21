// Arithmetic regression controls; native transaction/custody proof is separate.
import assert from 'node:assert/strict';
import { redeem } from '../src/exchange.js';
import { exactSum, negate } from '../tools/rc1-resource-journal.js';
let checks = 0;
async function run(balance, amount) {
  const ch = { cash: 500, id: 'exchange-control' }, ledger = [], h = { acct: { omr: balance }, accountId: 'control',
    async ledger(_client, row) { ledger.push(row); } };
  const client = { async query(sql) { return { rows: sql.startsWith('SELECT balance') ? [{ balance: '1000000' }] : [] }; } };
  const response = await redeem(ch, amount, client, h);
  const debits = ledger.filter(row => row.currency === 'omr').map(row => row.amount);
  assert.equal(exactSum([h.acct.omr, negate(balance), ...debits.map(negate)]), '0', 'No decimal residual may be created or destroyed');
  assert.equal(exactSum(debits.map(negate)), String(response.spent)); checks++;
  return { balance: h.acct.omr, response };
}
for (const [amount, familyCut, cash] of [[6.000009, .3, 3000], [6.000010, .300001, 3000], [6.000011, .300001, 3000], [6, .3, 3000], [1500, 75, 750000], [6.001999, .3001, 3000], [6.002, .3001, 3001]]) {
  const result = await run('5000', amount); assert.equal(result.response.familyCut, familyCut); assert.equal(result.response.cash, cash);
}
assert.equal((await run('10.011', 10.011)).balance, '0.000000');
assert.equal((await run('6.000010', '6.000010')).balance, '0.000000', 'Full balance at the split-rounding boundary');
assert.equal((await run('5000.000000000001', 6.000011)).balance, '4993.999989000001', 'Preserve old dust, do not silently clean it');
for (const amount of ['6.00001100', '6000011e-6', ' +6.000011 ', '0006.000011', '6.000011E+0']) await run('5000', amount);
await assert.rejects(run('5000', 6.0000001), { code: 'precision' });
await assert.rejects(run('5000', '6.0000000000000001'), { code: 'precision' });
let validationRefusals = 0;
for (const [amount, code] of [[NaN, 'amount'], [Infinity, 'amount'], ['1e999999999', 'amount'], ['1e-999999999', 'amount'], [5.999999, 'amount'], [-6, 'amount'], ['1501e0', 'cap'], [null, 'amount']]) {
  await assert.rejects(run('5000', amount), { code }); validationRefusals++;
}
// If decimalParts/BigInt ran first, either enormous exponent would throw or allocate;
// the canonical finite/min/cap errors above prove those checks precede its work.
console.log(JSON.stringify({ status: 'PASS_SCOPED', arithmeticCases: checks, precisionRefusals: 2, validationRefusals, nativeCoverage: false }));
