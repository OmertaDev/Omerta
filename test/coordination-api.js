// HTTP contract, strict request boundary, safe projections, and mounted-server proof.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import { buildOpenApi, COORDINATION_SCHEMAS } from '../src/agentgateway.js';
import { register } from '../src/routes/coordination.js';
import { buildServer } from '../src/server.js';

const routeTable = [
  ['GET', '/v1/coordination'],
  ['POST', '/v1/coordination/:graphId/instances'],
  ['GET', '/v1/coordination/instances/:instanceId'],
  ['POST', '/v1/coordination/instances/:instanceId/act'],
  ['POST', '/v1/coordination/instances/:instanceId/cancel'],
  ['GET', '/v1/mod/coordination/metrics'],
];
const spec = buildOpenApi(routeTable.map(([method, url]) => ({ method, url, hasAuth: true, isMod: url.includes('/mod/') })));
for (const [method, url] of routeTable.filter(([, path]) => !path.includes('/mod/'))) {
  const operation = spec.paths[url.replace(/:([A-Za-z]+)/g, '{$1}')][method.toLowerCase()];
  assert(operation.operationId);
  assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
  assert(operation.responses[200].content['application/json'].schema.$ref.startsWith('#/components/schemas/Coordination'));
  for (const code of [400, 401, 403, 404, 409, 422, 429, 500, 503]) {
    assert(operation.responses[code]?.content?.['application/json']?.schema, `${method} ${url}: ${code}`);
  }
  if (method === 'POST') {
    assert.equal(operation.requestBody.required, true);
    assert.equal(operation.requestBody.content['application/json'].schema.additionalProperties, false);
    assert.equal(operation.parameters.find((param) => param.name === 'Idempotency-Key')?.required, true);
  }
}
assert.equal(spec.paths['/v1/mod/coordination/metrics'], undefined);
assert.match(spec.tags.find(({ name }) => name === 'coordination').description, /value-neutral/);
function assertClosed(value) {
  if (!value || typeof value !== 'object') return;
  if (value.type === 'object') assert.equal(value.additionalProperties, false);
  if (value.$ref) assert(spec.components.schemas[value.$ref.split('/').at(-1)], value.$ref);
  Object.values(value).forEach(assertClosed);
}
Object.values(COORDINATION_SCHEMAS).forEach(assertClosed);
assert.doesNotMatch(JSON.stringify(COORDINATION_SCHEMAS), /owner_account|actor_account|privateEvidence|definition_json|state_json/);

const HASH = 'a'.repeat(64);
const example = { id: 'instance-1', graphId: 'graph-1', graphVersion: 1, contentHash: HASH,
  title: 'Private case', status: 'active', revision: 0, createdAt: '2026-09-13T00:00:00.000Z',
  updatedAt: '2026-09-13T00:00:00.000Z', historical: false, canCancel: true, directOnly: true,
  nodes: [{ id: 'node-1', title: 'Read the envelope', status: 'available' }],
  actions: [{ id: 'action-1', kind: 'complete', label: 'Complete: Read the envelope', nodeId: 'node-1' }] };
const calls = [];
let injectedFailure;
const response = (method, args, value) => {
  if (injectedFailure) throw injectedFailure;
  calls.push([method, ...args]);
  return value;
};
const service = {
  catalog: (...args) => response('catalog', args, { enabled: true, directOnly: true, graphs: [], instances: [example] }),
  get: (...args) => response('get', args, { ...example, owner_account_id: 'private-owner',
    nodes: [{ ...example.nodes[0], secret: 'private-secret' }] }),
  create: (...args) => response('create', args, { instance: example, replayed: false }),
  act: (...args) => response('act', args, { instance: example, replayed: false }),
  cancel: (...args) => response('cancel', args, { instance: example, replayed: false }),
  metrics: (...args) => response('metrics', args, { schemaVersion: 1, events: [], instances: [], secret: 'private-secret' }),
};
const auth = async (req, reply) => {
  if (req.headers.authorization !== 'Bearer caller') return reply.code(401).send({ error: 'unauthorized' });
  req.user = { sub: 'authenticated-account' };
};
const modAuth = async (req, reply) => {
  if (req.headers['x-mod-key'] !== 'operator-key') return reply.code(401).send({ error: 'mod_auth' });
};
const app = Fastify();
register(app, { auth, modAuth, service });
const inject = (server, method, url, { body, key, token = 'caller', headers = {} } = {}) => server.inject({
  method, url, ...(body === undefined ? {} : { payload: body }), headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}), ...(key === undefined ? {} : { 'idempotency-key': key }), ...headers,
  },
});
const createPath = '/v1/coordination/graph-1/instances';
const instancePath = '/v1/coordination/instances/instance-1';
try {
  for (const [method, path] of routeTable) {
    const url = path.replace(':graphId', 'graph-1').replace(':instanceId', 'instance-1');
    const body = method !== 'POST' ? undefined : url.endsWith('/act')
      ? { expectedRevision: 0, actionId: 'action-1' } : url.endsWith('/cancel')
        ? { expectedRevision: 0 } : { expectedContentHash: HASH };
    const denied = await inject(app, method, url, { token: null, body, key: 'test-key' });
    assert.equal(denied.statusCode, 401, `auth required for ${method} ${url}`);
  }
  assert.equal(calls.length, 0);
  for (const [path, body] of [
    [createPath, { expectedContentHash: HASH }],
    [instancePath + '/act', { expectedRevision: 0, actionId: 'action-1' }],
    [instancePath + '/cancel', { expectedRevision: 0 }],
  ]) {
    for (const key of [undefined, '', ' leading', 'trailing ', 'two words', 'x'.repeat(201)]) {
      const denied = await inject(app, 'POST', path, { body, key });
      assert.equal(denied.statusCode, 400, `canonical key required: ${String(key).slice(0, 30)}`);
      assert.equal(denied.json().error, 'bad_coordination_request');
    }
    const valid = await inject(app, 'POST', path, { body, key: 'command-key' });
    assert.equal(valid.statusCode, 200, valid.body);
    assert.deepEqual(calls.at(-1).slice(1), ['authenticated-account', path === createPath ? 'graph-1' : 'instance-1', body, 'command-key']);
  }
  const beforeInvalid = calls.length;
  for (const [path, body] of [
    [createPath, { expectedContentHash: HASH, accountId: 'other' }],
    [createPath, { expectedContentHash: HASH, hidden: {} }],
    [createPath, { expectedContentHash: HASH.toUpperCase() }],
    [createPath, { expectedContentHash: 123 }], [createPath, {}], [createPath, []],
    [instancePath + '/act', { expectedRevision: '0', actionId: 'action-1' }],
    [instancePath + '/act', { expectedRevision: false, actionId: 'action-1' }],
    [instancePath + '/act', { expectedRevision: -1, actionId: 'action-1' }],
    [instancePath + '/act', { expectedRevision: 0.5, actionId: 'action-1' }],
    [instancePath + '/act', { expectedRevision: Number.MAX_SAFE_INTEGER + 1, actionId: 'action-1' }],
    [instancePath + '/act', { expectedRevision: 0, actionId: 12 }],
    [instancePath + '/act', { expectedRevision: 0, actionId: 'action-1', nodeId: 'hidden' }],
    [instancePath + '/cancel', { expectedRevision: '0' }],
    [instancePath + '/cancel', { expectedRevision: 0, accountId: 'other' }],
  ]) {
    const denied = await inject(app, 'POST', path, { body, key: 'test-key' });
    assert.equal(denied.statusCode, 400, JSON.stringify({ path, body, response: denied.body }));
  }
  assert.equal(calls.length, beforeInvalid, 'invalid raw inputs never reach the service');
  assert.equal((await inject(app, 'GET', instancePath + '?accountId=other')).statusCode, 400);
  assert.equal((await inject(app, 'GET', '/v1/coordination/instances/%20instance-1')).statusCode, 400);
  const projected = await inject(app, 'GET', instancePath);
  assert.equal(projected.statusCode, 200);
  assert.doesNotMatch(projected.body, /private-owner|private-secret|owner_account_id|secret/);
  const metrics = await inject(app, 'GET', '/v1/mod/coordination/metrics', { headers: { 'x-mod-key': 'operator-key' } });
  assert.equal(metrics.statusCode, 200);
  assert.doesNotMatch(metrics.body, /secret/);
  for (const [code, status, publicCode = code] of [
    ['stale_coordination', 409], ['stale_coordination_content', 409], ['coordination_key_reuse', 409],
    ['contention', 409], ['coordination_disabled', 503], ['coordination_unavailable', 404],
    ['coordination_action_unavailable', 404, 'coordination_unavailable'],
    ['content_commit_unknown', 503, 'coordination_commit_unknown'],
    ['ECONNREFUSED', 503, 'db_down'],
    ['coordination_corrupt', 500, 'internal'], ['XX000', 500, 'internal'],
  ]) {
    injectedFailure = Object.assign(new Error('private SQL and hidden state'), { code, data: { secret: 'private-secret' } });
    const denied = await inject(app, 'GET', instancePath);
    assert.equal(denied.statusCode, status, code);
    assert.equal(denied.json().error, publicCode);
    assert.doesNotMatch(denied.body, /private|SQL|hidden|secret/);
  }
} finally { await app.close(); }

// Real server wiring uses its existing auth, launch access, rate, idempotency, and
// serializers. Fixtures are isolated in pg-mem; never point this suite at a live DB.
assert(!process.env.DATABASE_URL, 'coordination-api uses only the in-memory test database');
process.env.COORDINATION_ENGINE = 'on';
process.env.COORDINATION_ACCOUNT_IDS = 'coordination-owner';
process.env.MOD_KEY = 'coordination-api-operator-key';
const live = await buildServer();
const owner = 'coordination-owner', outsider = 'coordination-outsider';
const fixture = async (id) => {
  await live.pool.query("INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,'test',$1)", [id]);
  await live.pool.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [id]);
  await live.pool.query('INSERT INTO characters (id,account_id,name,season) VALUES ($1,$2,$2,1)', [`${id}-character`, id]);
  return live.jwt.sign({ sub: id, tv: 0 });
};
const reserveHttpKey = async (accountId, key, url, body) => {
  const bodyHash = crypto.createHash('sha256').update(`POST\n${url}\n${JSON.stringify(body)}`).digest('hex');
  await live.pool.query('INSERT INTO idempotency (account_id,key,status,body_hash,response) VALUES ($1,$2,0,$3,$4)',
    [accountId, key, bodyHash, '']);
};
try {
  const ownerToken = await fixture(owner), outsiderToken = await fixture(outsider);
  const mounted = live.routes.filter(({ url }) => url.includes('/coordination'));
  assert.equal(mounted.length, 19);
  for (const [method, url] of [
    ['GET', '/v1/coordination/operations'], ['POST', '/v1/coordination/operations'],
    ['GET', '/v1/coordination/operations/:operationId'],
    ['POST', '/v1/coordination/operations/:operationId/actions/:action'],
  ]) assert(mounted.some((route) => route.method === method && route.url === url), `${method} ${url}`);
  for (const route of mounted) assert.equal(route.hasAuth, true, route.url);
  const liveSpec = (await inject(live, 'GET', '/openapi.json', { token: null })).json();
  assert(liveSpec.paths['/v1/coordination/instances/{instanceId}/act']);
  assert.equal(liveSpec.paths['/v1/mod/coordination/metrics'], undefined);
  assert.equal((await inject(live, 'GET', '/v1/coordination', { token: null })).statusCode, 401);
  const ownerCatalog = await inject(live, 'GET', '/v1/coordination', { token: ownerToken });
  assert.equal(ownerCatalog.statusCode, 200, ownerCatalog.body);
  assert.equal(ownerCatalog.json().enabled, true);
  const graph = ownerCatalog.json().graphs[0];
  const outsiderCatalog = await inject(live, 'GET', '/v1/coordination', { token: outsiderToken });
  assert.equal(outsiderCatalog.statusCode, 200, outsiderCatalog.body);
  assert.equal(outsiderCatalog.json().enabled, false);
  assert.deepEqual(outsiderCatalog.json().graphs, []);
  const createUrl = `/v1/coordination/${graph.id}/instances`;
  const creation = { expectedContentHash: graph.contentHash };
  const disabled = await inject(live, 'POST', createUrl, { token: outsiderToken, body: creation, key: crypto.randomUUID() });
  assert.equal(disabled.statusCode, 503, disabled.body);
  assert.equal(disabled.json().error, 'coordination_disabled');
  const key = crypto.randomUUID();
  // Lose only the outer onSend receipt write after the domain transaction commits.
  const originalQuery = live.pool.query;
  let missedHttpReceipt = 0, created;
  live.pool.query = async (...args) => {
    if (String(args[0]).startsWith('UPDATE idempotency SET status') && args[1]?.[1] === key && !missedHttpReceipt++) {
      throw new Error('injected lost HTTP receipt-store acknowledgement');
    }
    return originalQuery.apply(live.pool, args);
  };
  try { created = await inject(live, 'POST', createUrl, { token: ownerToken, body: creation, key }); }
  finally { live.pool.query = originalQuery; }
  assert.equal(created.statusCode, 200, created.body);
  assert.equal(missedHttpReceipt, 1);
  assert.equal((await live.pool.query('SELECT status FROM idempotency WHERE account_id=$1 AND key=$2', [owner, key])).rows[0].status, 0);
  const recovered = await inject(live, 'POST', createUrl, { token: ownerToken, body: creation, key });
  assert.equal(recovered.statusCode, 200, recovered.body);
  assert.equal(recovered.json().replayed, true, 'pending HTTP key resolves the already committed domain receipt');
  assert.deepEqual(recovered.json().instance, created.json().instance);
  assert.equal((await live.pool.query('SELECT count(*) AS n FROM coordination_instances')).rows[0].n, 1);
  assert.equal((await live.pool.query('SELECT count(*) AS n FROM coordination_events')).rows[0].n, 1);
  const replay = await inject(live, 'POST', createUrl, { token: ownerToken, body: creation, key });
  assert.equal(replay.statusCode, 200, replay.body);
  assert.equal(replay.headers['x-idempotent-replay'], 'true');
  assert.deepEqual(replay.json(), recovered.json());
  const mismatch = await inject(live, 'POST', createUrl, { token: ownerToken, body: { expectedContentHash: HASH }, key });
  assert.equal(mismatch.statusCode, 422, mismatch.body);
  const instance = created.json().instance, ownedPath = `/v1/coordination/instances/${instance.id}`;
  const foreign = await inject(live, 'GET', ownedPath, { token: outsiderToken });
  const missing = await inject(live, 'GET', '/v1/coordination/instances/missing', { token: outsiderToken });
  assert.equal(foreign.statusCode, 404);
  assert.deepEqual(foreign.json(), missing.json());
  const actionKey = crypto.randomUUID();
  const actionBody = { expectedRevision: instance.revision, actionId: instance.actions[0].id };
  await reserveHttpKey(owner, actionKey, ownedPath + '/act', actionBody);
  const reservedConflict = await inject(live, 'POST', ownedPath + '/act', { token: ownerToken, key: actionKey,
    body: { ...actionBody, actionId: 'different-action' } });
  assert.equal(reservedConflict.statusCode, 422, reservedConflict.body);
  assert.equal((await live.pool.query('SELECT count(*) AS n FROM coordination_commands')).rows[0].n, 1);
  // Both requests must observe the same pending reservation before either can
  // enter its handler. The domain transaction, not request timing, serializes them.
  let pendingReaders = 0, releaseReaders;
  const bothRead = new Promise((resolve) => { releaseReaders = resolve; });
  live.pool.query = async (...args) => {
    const result = await originalQuery.apply(live.pool, args);
    if (String(args[0]).startsWith('SELECT status, body_hash, response FROM idempotency') && args[1]?.[1] === actionKey) {
      assert.equal(result.rows[0].status, 0);
      if (++pendingReaders === 2) releaseReaders();
      await bothRead;
    }
    return result;
  };
  let duplicates;
  try {
    duplicates = await Promise.all([0, 1].map(() => inject(live, 'POST', ownedPath + '/act', {
      token: ownerToken, key: actionKey, body: actionBody,
    })));
  } finally { live.pool.query = originalQuery; }
  assert.equal(pendingReaders, 2);
  for (const duplicate of duplicates) assert.equal(duplicate.statusCode, 200, duplicate.body);
  assert.deepEqual(duplicates.map((duplicate) => duplicate.json().replayed).sort(), [false, true]);
  assert.deepEqual(duplicates[0].json().instance, duplicates[1].json().instance);
  const acted = duplicates[0];
  assert.equal(acted.statusCode, 200, acted.body);
  assert.equal((await live.pool.query('SELECT count(*) AS n FROM coordination_instances')).rows[0].n, 1);
  assert.equal((await live.pool.query('SELECT count(*) AS n FROM coordination_events')).rows[0].n, 2);
  assert.equal((await live.pool.query('SELECT count(*) AS n FROM coordination_commands')).rows[0].n, 2);
  // Request-controlled headers cannot grant another route this receipt capability.
  const unrelatedKey = crypto.randomUUID(), bankBody = { amount: 1 };
  await reserveHttpKey(owner, unrelatedKey, '/v1/bank/deposit', bankBody);
  const unrelated = await inject(live, 'POST', '/v1/bank/deposit', { token: ownerToken, key: unrelatedKey, body: bankBody,
    headers: { 'coordination-receipts': 'true' } });
  assert.equal(unrelated.statusCode, 409, unrelated.body);
  assert.equal(unrelated.json().error, 'in_progress');
  const stale = await inject(live, 'POST', ownedPath + '/act', { token: ownerToken, key: crypto.randomUUID(),
    body: { expectedRevision: instance.revision, actionId: instance.actions[0].id } });
  assert.equal(stale.statusCode, 409, stale.body);
  assert.equal(stale.json().error, 'stale_coordination');
  assert.equal((await live.pool.query('SELECT count(*) AS n FROM transactions')).rows[0].n, 0);
  assert.equal((await live.pool.query('SELECT count(*) AS n FROM item_events')).rows[0].n, 0);
  const metricResponse = await inject(live, 'GET', '/v1/mod/coordination/metrics', {
    token: null, headers: { 'x-mod-key': process.env.MOD_KEY },
  });
  assert.equal(metricResponse.statusCode, 200, metricResponse.body);
  assert(metricResponse.json().events.some(({ type, total }) => type === 'coordination.created' && total === 1));
  assert.doesNotMatch(metricResponse.body, /coordination-owner|actor_account|correlation_id|nodeId/);
  const turn = await inject(live, 'GET', '/v1/agent/turn', { token: ownerToken });
  assert.equal(turn.statusCode, 200, turn.body);
  assert(!turn.json().actions.some((action) => action.path.startsWith('/v1/coordination')),
    'coordination discovery grants no autonomous Agent Act action');
  await live.pool.query("UPDATE accounts SET status='banned' WHERE id=$1", [outsider]);
  assert.equal((await inject(live, 'GET', ownedPath, { token: outsiderToken })).statusCode, 403);
  await live.pool.query("UPDATE accounts SET status='active',token_version=1 WHERE id=$1", [outsider]);
  const revoked = await inject(live, 'GET', '/v1/coordination', { token: outsiderToken });
  assert.equal(revoked.statusCode, 401);
  assert.equal(revoked.json().error, 'token_revoked');
  await live.pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [outsider]);
  const agentToken = live.jwt.sign({ sub: outsider, tv: 1 });
  process.env.RATE_LIMIT = 'on';
  assert.equal((await inject(live, 'GET', '/v1/coordination', { token: agentToken })).statusCode, 200);
  const throttled = await inject(live, 'GET', '/v1/coordination', { token: agentToken });
  assert.equal(throttled.statusCode, 429);
  assert.equal(throttled.json().error, 'rate_limited');
  assert(Number(throttled.headers['retry-after']) >= 1);
  delete process.env.RATE_LIMIT;
  // A source rollout stop preserves owned historical reads and cancellation.
  delete process.env.COORDINATION_ENGINE;
  const stopped = Fastify();
  register(stopped, { pool: live.pool, auth: async (req) => { req.user = { sub: owner }; }, modAuth });
  try {
    const old = await inject(stopped, 'GET', ownedPath);
    assert.equal(old.statusCode, 200, old.body);
    assert.deepEqual(old.json().actions, []);
    const refused = await inject(stopped, 'POST', ownedPath + '/act', { key: crypto.randomUUID(),
      body: { expectedRevision: acted.json().instance.revision, actionId: 'arbitrary' } });
    assert.equal(refused.statusCode, 503, refused.body);
    const cancelled = await inject(stopped, 'POST', ownedPath + '/cancel', { key: crypto.randomUUID(),
      body: { expectedRevision: acted.json().instance.revision } });
    assert.equal(cancelled.statusCode, 200, cancelled.body);
    assert.equal(cancelled.json().instance.status, 'cancelled');
  } finally { await stopped.close(); }
} finally {
  await live.close();
  delete process.env.COORDINATION_ENGINE;
  delete process.env.COORDINATION_ACCOUNT_IDS;
  delete process.env.RATE_LIMIT;
}
console.log('coordination API: strict inputs, auth, safe projections, OpenAPI, cohort, replay, privacy, and stopped-rollout recovery passed');
