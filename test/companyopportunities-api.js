import assert from 'node:assert/strict';
import { register } from '../src/routes/companyopportunities.js';
const routes = [], auth = async () => {};
register({ get: (...args) => routes.push(['GET', ...args]), post: (...args) => routes.push(['POST', ...args]) }, { pool: {}, auth });
assert.deepEqual(routes.map(([method, path]) => `${method} ${path}`), [
  'GET /v1/company/opportunities', 'POST /v1/company/opportunities/subscription',
  'POST /v1/company/opportunities/refresh', 'POST /v1/company/opportunities/acknowledge',
]);
for (const [, , options] of routes) assert.equal(options.preHandler, auth, 'same authenticated game account for human and agent sessions');
assert.throws(() => routes[2][3]({ body: { url: 'https://arbitrary.invalid' } }), /terms/);
console.log('company opportunities routes: all authenticated; refresh rejects caller-selected sources');
