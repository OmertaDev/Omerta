import assert from 'node:assert/strict';
import { register } from '../src/routes/businessseasons.js';
const routes = [], auth = async () => {};
register({ get: (...args) => routes.push(['GET', ...args]), post: (...args) => routes.push(['POST', ...args]) }, { pool: {}, auth });
assert.equal(routes.length, 6);
for (const route of routes.slice(0, 5)) assert.equal(route[2].preHandler, auth, 'human and agent same-account gameplay');
assert.equal(routes[5][1], '/v1/company/seasons/public/:id');
assert.throws(() => routes[4][3]({ body: { timestamp: 'backfilled' } }), /terms/);
console.log('business seasons routes: authenticated finite gameplay operations, no caller observation clock, opted-in public standings');
