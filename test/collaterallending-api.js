import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { fixture } from './collaterallending-fixture.js';
import { COLLATERAL_LENDING_CONTRACTS as contracts } from '../src/collaterallending-contracts.js';
const f = await fixture();
try {
  const ajv = new Ajv({ strict: false, allErrors: true }); addFormats(ajv);
  const spec = (await f.app.inject({ method: 'GET', url: '/openapi.json' })).json();
  for (const [key, contract] of Object.entries(contracts)) {
    const [method, route] = key.split(' '), op = spec.paths[route]?.[method.toLowerCase()];
    assert(op, key + ' must be registered in the actual server'); assert.deepEqual(op.security, [{ bearerAuth: [] }]);
    assert.deepEqual(op.responses['200'].content['application/json'].schema, contract.responseSchema);
    if (contract.requestSchema) assert.deepEqual(op.requestBody.content['application/json'].schema, contract.requestSchema);
    assert.equal((await f.call(null, method, route, method === 'POST' ? {} : undefined)).statusCode, 401);
  }
  const lender = await f.player(), borrower = await f.player(), item = await f.makeTool(borrower), loan = await f.offer(lender, borrower);
  const base = '/v1/loans/equipment';
  for (const agent of [false, true]) {
    for (const [path, body] of [['/availability', undefined], ['', undefined], ['/quote', { loanId: loan.id, itemId: item }]]) {
      const response = await f.call(borrower, body ? 'POST' : 'GET', base + path, body, f.key('api'), agent);
      assert.equal(response.statusCode, 200, response.body);
      const schema = contracts[(body ? 'POST ' : 'GET ') + base + path].responseSchema;
      assert(ajv.compile(schema)(response.json()), response.body);
      assert(!response.body.includes(borrower.account) && !response.body.includes(lender.account));
    }
  }
  const rejected = await f.call(borrower, 'POST', base + '/quote', { loanId: loan.id, itemId: item, owner: lender.account });
  assert.notEqual(rejected.statusCode, 200);
  assert.notEqual((await f.call(borrower, 'GET', base + '?account=' + lender.account)).statusCode, 200);
  console.log('PASS actual six authenticated closed equipment-lending contracts and human/agent read parity');
} finally { await f.app.close(); }
