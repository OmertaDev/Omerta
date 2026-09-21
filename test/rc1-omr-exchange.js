// Arithmetic regression controls; native transaction/custody proof is separate.
import assert from 'node:assert/strict';
import { redeem } from '../src/exchange.js';
import { exactSum, negate } from '../tools/rc1-resource-journal.js';
let checks = 0;
async function run(balance, amount) {
  const ch = { cash: 500, id: 'exchange-control' }, ledger = [], h = { acct: { omr: balance }, accountId: 'control',
    async ledger(_client, row) { ledger.push(row); } };
  const client = { async query(sql) { return { rows: sql.startsWith('SELECT balance') ? [{ balance: '1000000' }] : [] }; };
  const response = await redeem(ch, amount, client, h);
  const debits = ledger.filter(row => row.currency === 'omr').map(row => row.amount);
  assert.equal(exactSum([h.acct.omr, negate(balance), ...debits.map(negate)]), '0', 'No decimal residual may be created or destroyed');
  assert.equal(exactSum(debits.map(negate)), String(response.spent)); checks++;
  return { balance: h.acct.omr, response };
}
for (const [amount, familyCut] of [[6.000009, .3], [6.000010, .300001], [6.000011, .300001], [6, .3], [1500, 75]]) {
  const result = await run('5000', amount); assert.equal(result.response.familyCut, familyCut);
}
assert.equal((await run('10.011', 10.011)).balance, '0.000000');
assert.equal((await run('5000.000000000001', 6.000011)).balance, '4993.999989000001', 'Preserve old dust, do not silently clean it');
await run('5000', '6.00001100'); await run('5000', '6000011e-6');
await assert.rejects(run('5000', 6.0000001), { code: 'precision' });
await assert.rejects(run('5000', '6.0000000000000001'), { code: 'precision' });
console.log(JSON.stringify({ status: 'PASS_SCOPED', arithmeticCases: checks, precisionRefusals: 2, nativeCoverage: false }));
