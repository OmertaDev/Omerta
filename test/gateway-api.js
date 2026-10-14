import { adultAuthFixture } from './auth-fixture.js';
// Real mounted HTTP boundaries and a player-confirmed authoritative coordination command.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from './server-fixture.js';
import { SCOPES } from '../src/gateway/security.js';

assert(!process.env.DATABASE_URL, 'Gateway HTTP regression uses isolated pg-mem only.');
process.env.COORDINATION_ENGINE = 'on';
process.env.RATE_LIMIT = 'off';
const app = await buildServer();
const account = crypto.randomUUID(), stranger = crypto.randomUUID();
const playerToken = app.jwt.sign({ sub: account, tv: 0 });
const strangerToken = app.jwt.sign({ sub: stranger, tv: 0 });
const inject = (method, url, token, body, headers = {}) => app.inject({ method, url,
  payload: adultAuthFixture(method, url, body),
  headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers } });
const post = (url, token, body) => inject('POST', url, token, body);
const call = (token, capability, args = {}, requestId = crypto.randomUUID()) => post('/v1/gateway/call', token,
  { capability, arguments: args, requestId });
try {
  for (const [id, name] of [[account, 'Consigliere Player'], [stranger, 'Unrelated Player']]) {
    await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
    await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
    await app.pool.query('INSERT INTO characters(id,account_id,name,season) VALUES($1,$2,$3,1)', [id + '-ch', id, name]);
  }
  for (const route of app.routes.filter((row) => row.url.startsWith('/v1/gateway') || row.url.startsWith('/integrations/muse/'))) {
    const response = await inject(route.method, route.url.replace(':id', 'unknown'), null,
      route.method === 'POST' ? {} : undefined);
    assert.equal(response.statusCode, 401, route.url + ': ' + response.body);
    assert(route.hasAuth, route.url + ' is visible to auth discovery');
  }
  assert.equal((await inject('HEAD', '/v1/gateway/capabilities')).statusCode, 401);
  const page = await inject('GET', '/consigliere');
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /OMERTA CONSIGLIERE/);
  assert.equal(page.headers['referrer-policy'], 'no-referrer');
  assert.equal(page.headers['x-frame-options'], 'DENY');
  const manifest = (await inject('GET', '/integrations/muse')).json();
  assert.equal(manifest.compatibility.nativeMuseVerified, false);
  const input = { provider: 'muse', label: 'Muse', scopes: ['omerta.player.read', 'omerta.world.read'] };
  const grant = await post('/v1/gateway/connections', playerToken, input);
  assert.equal(grant.statusCode, 200, grant.body);
  const basic = grant.json();
  const key = crypto.randomUUID();
  const nonReplayable = await inject('POST', '/v1/gateway/connections', playerToken, input, { 'idempotency-key': key });
  assert.equal(nonReplayable.statusCode, 400);
  assert.equal(nonReplayable.json().error, 'credential_not_replayable');
  assert.equal((await app.pool.query('SELECT key FROM idempotency WHERE account_id=$1 AND key=$2', [account, key])).rows.length, 0,
    'plaintext delegated tokens never enter the legacy replay cache');
  assert.equal((await post('/v1/gateway/connections', basic.token, input)).statusCode, 401);
  const autonomous = app.jwt.sign({ sub: account, tv: 0, agent: true });
  assert.equal((await post('/v1/gateway/connections', autonomous, input)).statusCode, 403);
  assert.equal((await inject('POST', '/v1/gateway/connections', playerToken, input, { origin: 'https://foreign.example' })).statusCode, 403);
  assert.equal((await post('/v1/gateway/connections', playerToken, { ...input, owner: stranger })).statusCode, 400);
  assert.equal((await inject('GET', '/v1/me', basic.token)).statusCode, 401);
  assert.equal((await inject('GET', '/v1/gateway/capabilities', playerToken)).statusCode, 401);
  const list = await inject('GET', '/v1/gateway/capabilities', basic.token);
  assert.equal(list.statusCode, 200);
  assert(!list.json().capabilities.some((entry) => entry.name === 'get_inventory'));
  assert.equal((await call(basic.token, 'get_inventory')).statusCode, 403);
  const context = await call(basic.token, 'get_player_context');
  assert.equal(context.statusCode, 200, context.body);
  assert(!context.body.includes('wallet_address'));
  assert.equal((await call(basic.token, 'get_player_context', { accountId: stranger })).statusCode, 400);
  const tools = await inject('GET', '/integrations/muse/tools', basic.token);
  assert.equal(tools.statusCode, 200, tools.body);
  assert(tools.json().tools.some((tool) => tool.name === 'get_my_omerta_status'));
  const muse = await post('/integrations/muse/call', basic.token,
    { name: 'get_my_omerta_status', arguments: {}, requestId: 'muse-status' });
  assert.equal(muse.statusCode, 200, muse.body);
  assert.equal(muse.json().contentType, 'untrusted_game_data');
  const otherProvider = (await post('/v1/gateway/connections', playerToken, { ...input, provider: 'claude' })).json();
  assert.equal((await inject('GET', '/integrations/muse/tools', otherProvider.token)).statusCode, 403);

  const full = (await post('/v1/gateway/connections', playerToken, { ...input, scopes: SCOPES })).json();
  const catalog = await call(full.token, 'get_coordination_requests');
  assert.equal(catalog.statusCode, 200, catalog.body);
  const graph = catalog.json().data.graphs.find((entry) => entry.id === 'omerta.coordination.dead-letter');
  assert(graph);
  const before = Number((await app.pool.query('SELECT count(*) AS n FROM coordination_instances')).rows[0].n);
  const prepared = await call(full.token, 'prepare_coordination_request', { graphId: graph.id, expectedContentHash: graph.contentHash }, 'prepare-real');
  assert.equal(prepared.statusCode, 200, prepared.body);
  const proposal = prepared.json().data;
  assert(!Object.hasOwn(proposal, 'nonce'));
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM coordination_instances')).rows[0].n), before);
  const path = '/v1/gateway/preparations/' + proposal.id;
  assert.equal((await inject('GET', path, full.token)).statusCode, 401);
  assert.equal((await inject('GET', path, strangerToken)).statusCode, 404);
  const human = (await inject('GET', path, playerToken)).json();
  const confirmation = { nonce: human.nonce, digest: human.digest };
  assert.equal((await post(path + '/confirm', full.token, confirmation)).statusCode, 401);
  assert.equal((await post(path + '/confirm', autonomous, confirmation)).statusCode, 403);
  assert.equal((await post(path + '/confirm', strangerToken, confirmation)).statusCode, 404);
  const confirmed = await post(path + '/confirm', playerToken, confirmation);
  assert.equal(confirmed.statusCode, 200, confirmed.body);
  assert.equal(confirmed.json().state, 'completed', confirmed.body);
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM coordination_instances')).rows[0].n), before + 1);
  assert.equal((await post(path + '/confirm', playerToken, confirmation)).json().state, 'completed');
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM coordination_instances')).rows[0].n), before + 1);
  const audit = await inject('GET', '/v1/gateway/activity', playerToken);
  assert(audit.json().activity.some((entry) => entry.capability === 'prepare_coordination_request' && entry.confirmationState === 'completed'));
  assert(!audit.body.includes(full.token));
  const eventCatalog = await inject('GET', '/v1/gateway/events/catalog', full.token);
  assert.equal(eventCatalog.statusCode, 200);
  const subscription = await post('/v1/gateway/subscriptions', full.token, { topics: ['coordination.created'] });
  assert.equal(subscription.statusCode, 200, subscription.body);
  const history = await inject('GET', '/v1/gateway/events?subscriptionId=' + subscription.json().id, full.token);
  assert.equal(history.statusCode, 200, history.body);
  assert(history.json().events.some((event) => event.topic === 'coordination.created'));
  const openapi = (await inject('GET', '/openapi.json')).json();
  assert.deepEqual(openapi.paths['/v1/gateway/call'].post.security, [{ delegatedAgentAuth: [] }]);
  assert(openapi.paths['/v1/gateway/call'].post.requestBody.content['application/json'].schema.oneOf.length > 70);
  assert.deepEqual(openapi.paths['/v1/gateway/preparations/{id}/confirm'].post.security, [{ bearerAuth: [] }]);
  await inject('DELETE', '/v1/gateway/connections/' + full.connection.id, playerToken);
  assert.equal((await call(full.token, 'get_player_context')).statusCode, 401);
  await app.pool.query('UPDATE accounts SET token_version=token_version+1 WHERE id=$1', [account]);
  assert.equal((await call(basic.token, 'get_player_context')).statusCode, 401);
  console.log('gateway API: opaque/player/provider boundaries, safe Muse framing, real prepare-confirm-replay, audit, events and OpenAPI passed');
} finally { await app.close(); }
