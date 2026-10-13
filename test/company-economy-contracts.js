import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import { COMPANY_ECONOMY_CONTRACTS } from '../src/company-economy-contracts.js';
import { demandFixture } from './companydemand-fixture.js';
const f = await demandFixture('demand');
try {
  const spec = (await f.call(null, 'GET', '/openapi.json')).body;
  const ajv = new Ajv({ strict: false, validateFormats: false });
  const validate = (schema, value) => { const check = ajv.compile({ ...schema, components: spec.components }); assert(check(value), JSON.stringify(check.errors)); };
  for (const [key, contract] of Object.entries(COMPANY_ECONOMY_CONTRACTS)) {
    const [method, route] = key.split(' '), op = spec.paths[route.replace(/:([A-Za-z]+)/g, '{$1}')][method.toLowerCase()];
    assert.equal(op.operationId, contract.operationId); assert.deepEqual(op.security, [{ bearerAuth: [] }]);
    assert.deepEqual(op.responses[200].content['application/json'].schema, contract.responseSchema);
    if (contract.requestSchema) {
      assert.equal(op.requestBody.content['application/json'].schema.additionalProperties, false);
      const bad = ajv.compile({ ...contract.requestSchema, components: spec.components }); assert.equal(bad({ extra: true }), false);
    }
  }
  const scenario = { windowHours: 24, horizonHours: 4, maxBudgetCash: 2000, priceChangeBps: 500, sensitivity: 'high', preference: 'availability' };
  const production = COMPANY_ECONOMY_CONTRACTS['POST /v1/company/production/run'];
  validate(production.requestSchema, { businessId: f.depotId, steps: [{ recipeId: 'recipe:hardened_steel', repeat: 1 }] });
  assert.equal(production.requestParameters[0].required, true);
  assert.equal(COMPANY_ECONOMY_CONTRACTS['POST /v1/company/specializations'].requestParameters[0].required, true);
  await f.seedHistory();
  const calls = [
    ['GET', '/v1/company/production', '/v1/company/production'],
    ['GET', '/v1/company/specializations', '/v1/company/specializations'],
    ['GET', '/v1/items/durability', '/v1/items/durability'],
    ['GET', '/v1/company/demand/:id', '/v1/company/demand/' + f.depotId],
    ['POST', '/v1/company/demand/:id/scenario', '/v1/company/demand/' + f.depotId + '/scenario', scenario],
    ['POST', '/v1/company/forecast/:id', '/v1/company/forecast/' + f.depotId, { windowHours: 24, horizonHours: 4 }],
  ];
  for (const [method, route, url, body] of calls) {
    const result = await f.call(f.owner, method, url, body); assert.equal(result.code, 200, JSON.stringify(result.body));
    validate(COMPANY_ECONOMY_CONTRACTS[method + ' ' + route].responseSchema, result.body);
    assert.equal((await f.call(null, method, url, body)).code, 401);
  }
  const modeled = (await f.call(f.owner, 'POST', '/v1/company/demand/' + f.depotId + '/scenario', scenario)).body;
  const applied = await f.call(f.owner, 'POST', '/v1/company/demand/' + f.depotId + '/apply', { consent: true, evidenceId: modeled.evidenceId, scenario });
  assert.equal(applied.code, 200); validate(COMPANY_ECONOMY_CONTRACTS['POST /v1/company/demand/:id/apply'].responseSchema, applied.body);
  await f.invariants(); console.log('company economy contracts PASS: authenticated registered routes, closed request DTOs and real evidence/configuration responses');
} finally { await f.app.close(); }
