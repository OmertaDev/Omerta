import assert from 'node:assert/strict';
import { register } from '../src/routes/commercialreputation.js';
const routes = [], auth = async () => {};
register({ get: (...args) => routes.push(['GET', ...args]), post: (...args) => routes.push(['POST', ...args]) }, { pool: {}, auth });
for (const route of routes.slice(0, 3)) assert.equal(route[2].preHandler, auth);
assert.equal(routes[3][1], '/v1/company/reputation/public/:accountId');
assert.throws(() => routes[2][3]({ body: { rating: 100 } }), /terms/);
console.log('commercial reputation routes: authenticated own operations, explicit publication consent and consent-filtered public lookup registered');
