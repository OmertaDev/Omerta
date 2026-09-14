// Phase 1 through the mounted server: strict contracts, sharing authority and replay privacy.
// Only an in-memory database is permitted; no production credentials or social messages.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import { buildServer } from '../src/server.js';
import { register } from '../src/routes/coordination.js';

assert(!process.env.DATABASE_URL, 'knowledge-api must use the in-memory test database');
process.env.COORDINATION_ENGINE = 'on';
process.env.COORDINATION_KNOWLEDGE = 'on';
process.env.COORDINATION_KNOWLEDGE_SHARING = 'on';
process.env.COORDINATION_ACCOUNT_IDS = 'knowledge-api-a,knowledge-api-b';
const app = await buildServer();
const a = 'knowledge-api-a', b = 'knowledge-api-b', c = 'knowledge-api-c';
const tokens = new Map();
const key = () => crypto.randomUUID();
const call = (method, url, account = a, body, idem = key(), server = app) => server.inject({ method, url,
  ...(body === undefined ? {} : { payload: body }), headers: {
    ...(account ? { authorization: `Bearer ${tokens.get(account)}` } : {}),
    ...(method === 'POST' ? { 'idempotency-key': idem } : {}),
  } });
const ok = async (...args) => { const r = await call(...args); assert.equal(r.statusCode, 200, r.body); return r.json(); };
const advance = async (who, view, action = view.actions[0]) => {
  assert(action, 'expected issued action');
  return (await ok('POST', `/v1/coordination/instances/${view.id}/act`, who,
    { expectedRevision: view.revision, actionId: action.id })).instance;
};
const fixture = async (account, name, loc) => {
  await app.pool.query("INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,'test',$1)", [account]);
  await app.pool.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [account]);
  await app.pool.query('INSERT INTO characters (id,account_id,name,loc,season) VALUES ($1,$2,$3,$4,1)', [`${account}-character`, account, name, loc]);
  tokens.set(account, app.jwt.sign({ sub: account, tv: 0 }));
};
try {
  await fixture(a, 'Api Archivist', 'docks');
  await fixture(b, 'Api Printer', 'foundry');
  await fixture(c, 'Api Stranger', 'docks');
  const economics = (await app.pool.query('SELECT * FROM characters ORDER BY id')).rows;
  const contract = await ok('GET', '/openapi.json', null);
  const knowledgeRoutes = app.routes.filter(({ url }) => url.startsWith('/v1/coordination/knowledge'));
  assert.equal(knowledgeRoutes.length, 9);
  for (const { method, url, hasAuth } of knowledgeRoutes) {
    assert.equal(hasAuth, true, url);
    const op = contract.paths[url.replace(/:([A-Za-z]+)/g, '{$1}')][method.toLowerCase()];
    assert(op.operationId && op.responses[200].content['application/json'].schema.$ref);
    if (method === 'POST') {
      assert.equal(op.requestBody.content['application/json'].schema.additionalProperties, false);
      assert(op.parameters.find((p) => p.name === 'Idempotency-Key')?.required);
    }
    const unauthBody = url.endsWith('/share') ? { targetId: 'unissued', expectedAclRevision: 0 }
      : url.endsWith('/revoke') ? { grantId: 'missing', expectedAclRevision: 0 }
        : url.endsWith('/links') ? { fromClaimId: 'missing', toClaimId: 'missing2', relation: 'corroborates' }
          : url.endsWith('/archive') ? { claimId: 'missing' } : {};
    assert.equal((await call(method, url.replace(':claimId', 'missing'), null, method === 'POST' ? unauthBody : undefined)).statusCode, 401);
  }
  for (const query of ['limit=0', 'limit=51', 'limit=01', 'owner=someone', 'cursor=not.a.token', 'limit=2&limit=3']) {
    assert.equal((await call('GET', `/v1/coordination/knowledge?${query}`)).statusCode, 400, query);
  }
  assert.equal((await call('GET', '/v1/coordination/knowledge/targets?characterName=%20Api%20Printer')).statusCode, 400);
  const graph = (await ok('GET', '/v1/coordination')).graphs.find((g) => g.id === 'omerta.coordination.split-ledger');
  assert(graph);
  assert(!(await ok('GET', '/v1/coordination', c)).graphs.some((g) => g.id === graph.id));
  assert.equal((await call('POST', `/v1/coordination/${graph.id}/instances`, c, { expectedContentHash: graph.contentHash })).statusCode, 503);
  const create = (who) => ok('POST', `/v1/coordination/${graph.id}/instances`, who, { expectedContentHash: graph.contentHash });
  let av = (await create(a)).instance, bv = (await create(b)).instance;
  av = await advance(a, av); bv = await advance(b, bv); // briefing
  av = await advance(a, av); bv = await advance(b, bv); // source discovery
  av = await advance(a, av, av.actions.find((x) => x.nodeId === 'docks-source'));
  bv = await advance(b, bv, bv.actions.find((x) => x.nodeId === 'foundry-source'));
  const ac = (await ok('GET', '/v1/coordination/knowledge', a)).claims[0];
  let bc = (await ok('GET', '/v1/coordination/knowledge', b)).claims[0];
  assert(ac.owned && bc.owned);
  assert(!av.nodes.some((n) => n.id === 'conclusion'));
  const missing = await call('GET', '/v1/coordination/knowledge/missing', a);
  const foreign = await call('GET', `/v1/coordination/knowledge/${bc.id}`, a);
  assert.equal(foreign.statusCode, 404); assert.deepEqual(foreign.json(), missing.json());
  const targetBoard = await ok('GET', '/v1/coordination/knowledge/targets?characterName=Api%20Archivist', b);
  const target = targetBoard.targets.find((t) => t.kind === 'account');
  assert(target);
  assert.doesNotMatch(JSON.stringify(targetBoard), /knowledge-api-a|account_id|recipient_id/);
  assert(!Buffer.from(target.id, 'base64url').toString('utf8').includes(a), 'target principal is encrypted');
  const shareUrl = `/v1/coordination/knowledge/${bc.id}/share`;
  const shareBody = { targetId: target.id, expectedAclRevision: bc.aclRevision };
  for (const bad of [{ ...shareBody, owner: b }, { ...shareBody, expectedAclRevision: String(bc.aclRevision) },
    { ...shareBody, targetId: a }, { ...shareBody, recipientAccountId: a }]) {
    const r = await call('POST', shareUrl, b, bad); assert([400, 409].includes(r.statusCode), r.body);
  }
  assert.equal((await call('POST', shareUrl, b, shareBody, '')).statusCode, 400);
  const shareKey = key();
  // Domain success survives loss of the enclosing HTTP receipt-store write.
  const originalQuery = app.pool.query;
  let failedStore = false;
  app.pool.query = async function (...args) {
    if (!failedStore && String(args[0]).startsWith('UPDATE idempotency SET status') && args[1]?.[1] === shareKey) {
      failedStore = true; throw Error('injected knowledge HTTP receipt-store failure');
    }
    return originalQuery.apply(this, args);
  };
  let shared;
  try { shared = await ok('POST', shareUrl, b, shareBody, shareKey); }
  finally { app.pool.query = originalQuery; }
  assert(failedStore);
  const recovered = await ok('POST', shareUrl, b, shareBody, shareKey);
  assert.equal(recovered.replayed, true); assert.deepEqual(recovered.claim, shared.claim);
  bc = shared.claim;
  assert.equal((await call('POST', shareUrl, b, { ...shareBody, expectedAclRevision: 99 }, shareKey)).statusCode, 422);
  const detailResponse = await call('GET', `/v1/coordination/knowledge/${bc.id}`, a);
  assert.equal(detailResponse.statusCode, 200, detailResponse.body);
  assert.equal(detailResponse.headers['cache-control'], 'no-store');
  const detail = detailResponse.json();
  assert.equal(detail.claim.owned, false); assert.equal(detail.claim.grants, undefined);
  assert.equal(detail.claim.aclRevision, undefined);
  assert.doesNotMatch(detailResponse.body, /knowledge-api-|account_id|character_id|source_event|command_id|definition_json/);
  const readerTarget = (await ok('GET', '/v1/coordination/knowledge/targets?characterName=Api%20Printer', a)).targets.find((t) => t.kind === 'account');
  assert.equal((await call('POST', shareUrl, a, { targetId: readerTarget.id, expectedAclRevision: 0 })).statusCode, 404, 'readers cannot reshare');
  const page1 = await ok('GET', '/v1/coordination/knowledge?limit=1', a);
  assert.equal(page1.claims.length, 1); assert(page1.nextCursor);
  const page2 = await ok('GET', `/v1/coordination/knowledge?limit=1&cursor=${page1.nextCursor}`, a);
  assert.equal(page2.claims.length, 1); assert.notEqual(page1.claims[0].id, page2.claims[0].id);
  assert.equal((await call('GET', `/v1/coordination/knowledge?cursor=${page1.nextCursor}`, b)).statusCode, 400);
  const archiveKey = key(), linkKey = key();
  const archived = await ok('POST', '/v1/coordination/knowledge/archive', a, { claimId: bc.id }, archiveKey);
  const linked = await ok('POST', '/v1/coordination/knowledge/links', a,
    { fromClaimId: ac.id, toClaimId: bc.id, relation: 'corroborates' }, linkKey);
  assert(!JSON.stringify(archived).includes(bc.id));
  assert(!JSON.stringify(linked).includes(bc.id));
  assert.equal((await ok('GET', '/v1/coordination/knowledge/archive', a)).entries.length, 1);
  const beforeRevoke = await ok('GET', `/v1/coordination/instances/${av.id}`, a);
  assert(beforeRevoke.actions.length > 0, 'current evidence unlocks a lead');
  const revokeBody = { grantId: bc.grants[0].id, expectedAclRevision: bc.aclRevision };
  bc = (await ok('POST', `/v1/coordination/knowledge/${bc.id}/revoke`, b, revokeBody)).claim;
  assert.equal((await call('GET', `/v1/coordination/knowledge/${bc.id}`, a)).statusCode, 404);
  assert.deepEqual((await ok('GET', '/v1/coordination/knowledge/archive', a)).entries, []);
  assert.deepEqual((await ok('GET', `/v1/coordination/knowledge/${ac.id}`, a)).links, []);
  const staleGate = await call('POST', `/v1/coordination/instances/${av.id}/act`, a,
    { expectedRevision: beforeRevoke.revision, actionId: beforeRevoke.actions[0].id });
  assert.equal(staleGate.statusCode, 404, staleGate.body);
  assert.deepEqual(await ok('POST', '/v1/coordination/knowledge/archive', a, { claimId: bc.id }, archiveKey), archived);
  assert.deepEqual(await ok('POST', '/v1/coordination/knowledge/links', a,
    { fromClaimId: ac.id, toClaimId: bc.id, relation: 'corroborates' }, linkKey), linked);
  const refreshedTarget = (await ok('GET', '/v1/coordination/knowledge/targets?characterName=Api%20Archivist', b)).targets.find((t) => t.kind === 'account');
  bc = (await ok('POST', shareUrl, b, { targetId: refreshedTarget.id, expectedAclRevision: bc.aclRevision })).claim;
  av = await ok('GET', `/v1/coordination/instances/${av.id}`, a);
  av = await advance(a, av);
  av = await advance(a, av, av.actions.find((x) => x.nodeId === 'conclusion'));
  assert.equal(av.status, 'completed');
  const rebuilt = await ok('POST', '/v1/coordination/knowledge/rebuild', b, {});
  assert(Number.isSafeInteger(rebuilt.rebuilt.grants));
  assert.equal((await ok('GET', '/v1/coordination/knowledge', a)).claims.length, 2);
  assert.deepEqual((await app.pool.query('SELECT * FROM characters ORDER BY id')).rows, economics);
  for (const table of ['transactions', 'item_events']) assert.equal(Number((await app.pool.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n), 0);
  const turn = await ok('GET', '/v1/agent/turn', a);
  assert(!turn.actions.some((x) => x.path.startsWith('/v1/coordination')));
  await app.pool.query("UPDATE accounts SET status='banned' WHERE id=$1", [a]);
  assert.equal((await call('GET', '/v1/coordination/knowledge', a)).statusCode, 403);
  await app.pool.query("UPDATE accounts SET status='active',token_version=1 WHERE id=$1", [a]);
  assert.equal((await call('GET', '/v1/coordination/knowledge', a)).statusCode, 401);
  delete process.env.COORDINATION_KNOWLEDGE;
  delete process.env.COORDINATION_KNOWLEDGE_SHARING;
  const stopped = Fastify();
  register(stopped, { pool: app.pool, auth: async (req) => { req.user = { sub: b }; }, modAuth: async () => {} });
  try {
    const own = await ok('GET', `/v1/coordination/knowledge/${bc.id}`, b, undefined, key(), stopped);
    assert(own.claim.owned);
    assert.equal((await call('POST', shareUrl, b, { targetId: refreshedTarget.id, expectedAclRevision: bc.aclRevision }, key(), stopped)).statusCode, 503);
    const rev = await ok('POST', `/v1/coordination/knowledge/${bc.id}/revoke`, b,
      { grantId: bc.grants[0].id, expectedAclRevision: bc.aclRevision }, key(), stopped);
    assert.equal(rev.claim.grants.length, 0);
  } finally { await stopped.close(); }
} finally {
  await app.close();
  for (const name of ['COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_ACCOUNT_IDS']) delete process.env[name];
}
console.log('coordination knowledge API: full shared pilot, strict inputs, private projections, stale authority, receipt recovery, archive/link revocation and dormant recovery pass');
