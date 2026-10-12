import assert from 'node:assert/strict';
import { register } from '../src/routes/companyoperators.js';
const routes = [];
const auth = async () => {};
const app = { get: (...args) => routes.push(['GET', ...args]), post: (...args) => routes.push(['POST', ...args]) };
register(app, { pool: {}, auth });
assert.deepEqual(routes.map(([method, path]) => `${method} ${path}`), [
  'GET /v1/company/operator', 'POST /v1/company/operator', 'POST /v1/company/operator/run',
]);
for (const [, , options] of routes) assert.equal(Array.isArray(options.preHandler) ? options.preHandler[0] : options.preHandler, auth);
const ownerOnly = routes[1][2].preHandler[1];
await assert.rejects(ownerOnly({ user: { agent: true } }), /owner session/);
await ownerOnly({ user: { agent: false } });
assert.equal(routes[2][2].preHandler, auth, 'both authenticated owner and agent may execute already granted duties');
console.log('company operator route registration: authenticated board/run and separate owner enrollment guard passed');
