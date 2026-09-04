// Phase 1 world-graph HTTP contract and live pg-mem proof.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildOpenApi } from '../src/agentgateway.js';
import { buildServer } from '../src/server.js';
import { createItem, transferItem, withItemTransaction } from '../src/items.js';
import { register as registerWorldGraphRoutes } from '../src/routes/worldgraph.js';

const routeTable = [
  ['GET', '/v1/worldgraph/inventory'],
  ['GET', '/v1/worldgraph/recipes'],
  ['POST', '/v1/worldgraph/recipes/:recipeId/craft'],
  ['POST', '/v1/worldgraph/recipes/:recipeId/salvage/:carId'],
  ['GET', '/v1/worldgraph/mysteries'],
  ['POST', '/v1/worldgraph/mysteries/:graphId/start'],
  ['GET', '/v1/worldgraph/mysteries/:graphId'],
  ['POST', '/v1/worldgraph/mysteries/:graphId/nodes/:nodeId/discover'],
  ['POST', '/v1/worldgraph/mysteries/:graphId/nodes/:nodeId/complete'],
  ['POST', '/v1/worldgraph/mysteries/:graphId/choices/:nodeId'],
  ['POST', '/v1/worldgraph/mysteries/:graphId/cancel'],
  ['GET', '/v1/worldgraph/operations'],
  ['POST', '/v1/worldgraph/operations/:graphId/:operationNodeId/open'],
  ['GET', '/v1/worldgraph/operations/:operationId'],
  ['GET', '/v1/worldgraph/operations/:operationId/role'],
  ['POST', '/v1/worldgraph/operations/:operationId/roles/:roleId'],
  ['POST', '/v1/worldgraph/operations/:operationId/contributions/:nodeId'],
  ['POST', '/v1/worldgraph/operations/:operationId/complete'],
  ['POST', '/v1/worldgraph/operations/:operationId/cancel'],
];

const mounted = [];
const fakeAuth = async function auth() {};
const fakeApp = {
  get(url, options, handler) { mounted.push({ method: 'GET', url, options, handler }); },
  post(url, options, handler) { mounted.push({ method: 'POST', url, options, handler }); },
};
registerWorldGraphRoutes(fakeApp, { pool: Symbol('pool'), auth: fakeAuth });
assert.deepEqual(mounted.map(({ method, url }) => [method, url]), routeTable,
  'the dedicated registrar mounts exactly the approved Phase 1 surface');
for (const route of mounted) {
  const preHandlers = [].concat(route.options.preHandler || []);
  assert(preHandlers.includes(fakeAuth), `${route.method} ${route.url} uses player auth`);
  if (route.method === 'POST') {
    assert.equal(preHandlers.some((handler) => handler.name === 'requireIdempotency'), true,
      `${route.url} requires a logical mutation key`);
    assert.equal(typeof route.options.preValidation, 'function',
      `${route.url} enforces a closed request body`);
  }
}

const spec = buildOpenApi(routeTable.map(([method, url]) => ({
  method, url, hasAuth: true, isMod: false,
})), { baseUrl: 'https://example.test', version: '1.1.0-test' });
for (const [method, rawPath] of routeTable) {
  const path = rawPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  const operation = spec.paths[path]?.[method.toLowerCase()];
  assert(operation, `${method} ${path} is in OpenAPI`);
  assert(operation.operationId, `${method} ${path} has a stable operationId`);
  assert.deepEqual(operation.security, [{ bearerAuth: [] }], `${method} ${path} requires bearer auth`);
  assert(operation.responses[200]?.content?.['application/json']?.schema,
    `${method} ${path} has a typed success response`);
  if (method === 'POST') {
    const idempotency = operation.parameters.find((entry) => entry.in === 'header');
    assert.equal(idempotency?.name, 'Idempotency-Key');
    assert.equal(idempotency?.required, true);
    assert.equal(operation.requestBody.content['application/json'].schema.additionalProperties, false);
    assert(operation.responses[409], `${method} ${path} documents safe mutation conflicts`);
    assert(operation.responses[422], `${method} ${path} documents mismatched key reuse`);
  }
}
assert.match(spec.tags.find(({ name }) => name === 'worldgraph')?.description || '',
  /conserved|data-defined/i);
assert.equal(
  Object.keys(spec.paths).some((path) => path.startsWith('/v1/agent/act/worldgraph')),
  false,
  'world-graph discovery creates no autonomous execution route',
);
const publishedWorldGraph = JSON.stringify(Object.fromEntries(
  Object.entries(spec.components.schemas).filter(([name]) => name.startsWith('WorldGraph')),
));
assert.doesNotMatch(publishedWorldGraph,
  /accountId|account_id|characterId|character_id|crewId|crew_id|authorityAccount|depositor/i,
  'the machine contract has no client or response field for raw ownership authority');

const app = await buildServer();
const call = async (method, url, { token, body, key } = {}) => {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (key) headers['idempotency-key'] = key;
  const request = { method, url, headers };
  if (body !== undefined) request.payload = body;
  const response = await app.inject(request);
  let parsed;
  try { parsed = response.json(); } catch { parsed = response.body; }
  return { code: response.statusCode, body: parsed, headers: response.headers };
};
const mutate = (url, token, key, body) => call('POST', url, { token, key, body });

const liveSpec = await call('GET', '/openapi.json');
assert.equal(liveSpec.code, 200);
assert.equal(liveSpec.body.info.version, '1.2.0');
assert(liveSpec.body.paths['/v1/worldgraph/operations/{operationId}/role']?.get,
  'the mounted server publishes the role-private board in its live OpenAPI document');
assert.equal((await call('GET', '/v1/worldgraph/inventory')).code, 401,
  'inventory requires authentication');
assert.equal((await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/start', null, 'api-unauthorized-mutation',
)).code, 401, 'mutation auth runs before any player authority is considered');

const players = [];
for (let index = 0; index < 4; index += 1) {
  const token = (await call('POST', '/v1/auth/guest')).body.token;
  const created = await call('POST', '/v1/character', {
    token, body: { name: `Graph API Player ${index + 1}` },
  });
  assert.equal(created.code, 200);
  const characterId = (await call('GET', '/v1/me', { token })).body.character.id;
  const accountId = (await app.pool.query(
    'SELECT account_id FROM characters WHERE id=$1', [characterId],
  )).rows[0].account_id;
  players.push({ token, characterId, accountId });
}

const crewId = crypto.randomUUID();
await app.pool.query(
  'INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)',
  [crewId, 'Graph API Crew', players[0].accountId],
);
for (let index = 0; index < players.length; index += 1) {
  const player = players[index];
  await app.pool.query(
    "UPDATE characters SET loc='foundry',respect=10000,cash=10000 WHERE id=$1",
    [player.characterId],
  );
  await app.pool.query(
    'INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)',
    [crewId, player.accountId, `Graph API Member ${index + 1}`],
  );
}
await app.pool.query(
  "INSERT INTO character_skills (character_id,skill_id) VALUES ($1,'fence_network'),($2,'fence_network')",
  [players[0].characterId, players[2].characterId],
);
const carId = crypto.randomUUID();
await app.pool.query(
  `INSERT INTO cars
     (id,character_id,model_id,trim_id,dmg,listed,pledged,minted_onchain,race_limit,pink_slip)
   VALUES ($1,$2,'junker','stock',80,false,false,false,null,false)`,
  [carId, players[0].characterId],
);

const readBalances = async () => {
  const cash = new Map();
  const omr = new Map();
  for (const player of players) {
    cash.set(player.accountId, Number((await app.pool.query(
      'SELECT cash FROM characters WHERE id=$1', [player.characterId],
    )).rows[0].cash));
    omr.set(player.accountId, Number((await app.pool.query(
      'SELECT omr FROM account_persistent WHERE account_id=$1', [player.accountId],
    )).rows[0].omr));
  }
  return { cash, omr };
};
const { cash: cashBefore, omr: omrBefore } = await readBalances();
const ledgerBefore = Number((await app.pool.query(
  'SELECT COUNT(*) AS n FROM transactions',
)).rows[0].n);

const malformedChoice = await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/choices/not-a-choice',
  players[0].token, 'api-malformed-choice', {},
);
assert.equal(malformedChoice.code, 400, 'a required identifier cannot be omitted from the body');

const recipes = await call('GET', '/v1/worldgraph/recipes', { token: players[0].token });
assert.equal(recipes.code, 200);
assert.deepEqual(recipes.body.recipes.map(({ id }) => id), [
  'recipe:car_salvage_basic', 'recipe:hardened_steel', 'recipe:precision_lock_tool',
]);
assert.equal(recipes.body.recipes.find(({ id }) => id === 'recipe:car_salvage_basic').available, true);

const missingKey = await mutate(
  '/v1/worldgraph/recipes/recipe:car_salvage_basic/salvage/' + carId,
  players[0].token, null,
);
assert.equal(missingKey.code, 400);
assert.equal(missingKey.body.error, 'bad_idempotency_key');
const spoof = await mutate(
  '/v1/worldgraph/recipes/recipe:car_salvage_basic/salvage/' + carId,
  players[0].token, 'api-spoof', { accountId: players[1].accountId },
);
assert.equal(spoof.code, 400, 'caller-supplied ownership is rejected by the body contract');

const salvageUrl = '/v1/worldgraph/recipes/recipe:car_salvage_basic/salvage/' + carId;
const salvaged = await mutate(salvageUrl, players[0].token, 'api-salvage');
assert.equal(salvaged.code, 200);
const salvageReplay = await mutate(salvageUrl, players[0].token, 'api-salvage');
assert.equal(salvageReplay.code, 200);
assert.deepEqual(salvageReplay.body, salvaged.body, 'an exact HTTP retry replays byte-equivalent JSON');
assert.equal(salvageReplay.headers['x-idempotent-replay'], 'true');
const salvageKeyReuse = await mutate(salvageUrl, players[0].token, 'api-salvage', {});
assert.equal(salvageKeyReuse.code, 422);
assert.equal(salvageKeyReuse.body.error, 'idempotency_key_reuse',
  'the same key cannot authorize a different logical request');
for (const secret of players.flatMap(({ accountId, characterId }) => [accountId, characterId]).concat(crewId)) {
  assert.equal(JSON.stringify(salvaged.body).includes(secret), false,
    'mutation receipts do not publish raw owner identity');
}

const hardened = await mutate(
  '/v1/worldgraph/recipes/recipe:hardened_steel/craft',
  players[0].token, 'api-hardened',
);
assert.equal(hardened.code, 200);
assert.equal(hardened.body.cashCost, 300);
const precision = await mutate(
  '/v1/worldgraph/recipes/recipe:precision_lock_tool/craft',
  players[0].token, 'api-precision',
);
assert.equal(precision.code, 200);
const precisionItemId = precision.body.outputs.find(
  ({ templateId }) => templateId === 'item:precision_lock_tool',
)?.id;
assert(precisionItemId);

// Phase 1 deliberately exposes inventory read, not arbitrary owner transfer. Put the account-crafted
// proof tool into its current character with the already-reviewed ledger primitive, just as the
// domain vertical proof does, so this test can focus on HTTP authority and projection safety.
await withItemTransaction(app.pool, (client) => transferItem(
  client,
  { scope: 'account', id: players[0].accountId },
  { scope: 'character', id: players[0].characterId },
  precisionItemId,
  'mystery proof custody',
  'api-investigator-tool-custody',
));
await withItemTransaction(app.pool, (client) => createItem(
  client, { scope: 'account', id: players[2].accountId },
  'item:precision_lock_tool', 'crafted', 'api-mechanic-tool',
));

const inventory = await call('GET', '/v1/worldgraph/inventory', { token: players[0].token });
assert.equal(inventory.code, 200);
assert.equal(Object.hasOwn(inventory.body, 'owner'), false);
assert.equal(JSON.stringify(inventory.body).includes(players[0].accountId), false);

const discovery = await call('GET', '/v1/worldgraph/mysteries', { token: players[0].token });
assert.equal(discovery.code, 200);
assert.equal(discovery.body.mysteries.some(({ graphId }) => graphId === 'belladonna-demo'), true);

const startUrl = '/v1/worldgraph/mysteries/belladonna-demo/start';
const start = await mutate(startUrl, players[0].token, 'api-mystery-start');
assert.equal(start.code, 200);
assert.equal(Object.hasOwn(start.body, 'owner'), false);
assert.equal((await mutate(startUrl, players[0].token, 'api-mystery-start')).code, 200);

const inProgressKey = 'api-known-in-progress';
const inProgressUrl = '/v1/worldgraph/mysteries/belladonna-demo/start';
const bodyHash = crypto.createHash('sha256')
  .update(`POST\n${inProgressUrl}\nnull`).digest('hex');
await app.pool.query(
  `INSERT INTO idempotency (account_id,key,status,body_hash,response)
   VALUES ($1,$2,0,$3,'')`,
  [players[0].accountId, inProgressKey, bodyHash],
);
const conflict = await mutate(inProgressUrl, players[0].token, inProgressKey);
assert.equal(conflict.code, 409);
assert.equal(conflict.body.error, 'in_progress');
await app.pool.query('DELETE FROM idempotency WHERE account_id=$1 AND key=$2',
  [players[0].accountId, inProgressKey]);

assert.equal((await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/nodes/mystery:belladonna-trace/complete',
  players[0].token, 'api-trace', { interactionId: 'inspect_belladonna_stamp' },
)).code, 200);
assert.equal((await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/nodes/mystery:belladonna-lock/discover',
  players[0].token, 'api-discover-lock',
)).code, 200);
assert.equal((await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/nodes/mystery:belladonna-lock/complete',
  players[0].token, 'api-open-lock', { interactionId: 'set_precision_tumblers' },
)).code, 200);
assert.equal((await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/nodes/mystery:belladonna-file-closed/discover',
  players[0].token, 'api-discover-file',
)).code, 200);
assert.equal((await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/nodes/mystery:belladonna-file-closed/complete',
  players[0].token, 'api-close-file', { interactionId: 'seal_belladonna_file' },
)).code, 200);
const mystery = await call('GET', '/v1/worldgraph/mysteries/belladonna-demo', {
  token: players[0].token,
});
assert.equal(mystery.code, 200);
assert.equal(mystery.body.status, 'completed');
assert.doesNotMatch(JSON.stringify(mystery.body), /privateEvidence/);

const bogusChoice = await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/choices/not-a-choice',
  players[0].token, 'api-bogus-choice', { optionId: 'guessed' },
);
assert.equal(bogusChoice.code, 400);
assert.equal(bogusChoice.body.error, 'mystery_node_unavailable');
const wrongKindChoice = await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/choices/evidence:belladonna-maker-mark',
  players[0].token, 'api-wrong-kind-choice', { optionId: 'guessed' },
);
assert.equal(wrongKindChoice.code, 400);
assert.equal(wrongKindChoice.body.error, bogusChoice.body.error,
  'a known non-choice and a nonexistent choice do not form a mystery-node existence oracle');
const bogusGraph = await mutate(
  '/v1/worldgraph/mysteries/not-a-graph/start', players[0].token, 'api-bogus-graph',
);
assert.equal(bogusGraph.code, 400);
assert.equal(bogusGraph.body.error, 'mystery_graph');
assert.equal((await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/start',
  players[3].token, 'api-cancelable-mystery-start',
)).code, 200);
const canceledMystery = await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/cancel',
  players[3].token, 'api-cancel-mystery',
);
assert.equal(canceledMystery.code, 200);
assert.equal(canceledMystery.body.status, 'canceled');
assert.deepEqual((await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/cancel',
  players[3].token, 'api-cancel-mystery',
)).body, canceledMystery.body, 'mystery cancellation replays exactly');

const availableOperations = await call('GET', '/v1/worldgraph/operations', {
  token: players[0].token,
});
assert.equal(availableOperations.code, 200);
const belladonnaOperation = availableOperations.body.operations.find(
  ({ operationNodeId }) => operationNodeId === 'operation:belladonna-lockbox',
);
assert.equal(belladonnaOperation.available, true);
assert.equal(belladonnaOperation.minimumDistinctAccounts, 4);

const opened = await mutate(
  '/v1/worldgraph/operations/belladonna-demo/operation:belladonna-lockbox/open',
  players[0].token, 'api-operation-open',
);
assert.equal(opened.code, 200);
const operationId = opened.body.operationId;
assert(operationId);
const roles = ['investigator', 'driver', 'mechanic', 'enforcer'];
for (let index = 0; index < roles.length; index += 1) {
  const assigned = await mutate(
    `/v1/worldgraph/operations/${operationId}/roles/${roles[index]}`,
    players[index].token, `api-assign-${roles[index]}`,
  );
  assert.equal(assigned.code, 200, JSON.stringify(assigned.body));
}

const privateProbe = await mutate(
  `/v1/worldgraph/operations/${operationId}/contributions/operation:belladonna-investigate`,
  players[1].token, 'api-private-probe', { interactionId: 'read_belladonna_cipher' },
);
assert.equal(privateProbe.code, 400);
assert.equal(privateProbe.body.error, 'operation_step_unavailable',
  'another role gets the same unavailable response as a nonexistent contribution');
const missingProbe = await mutate(
  `/v1/worldgraph/operations/${operationId}/contributions/no-such-step`,
  players[1].token, 'api-missing-probe', { interactionId: 'read_belladonna_cipher' },
);
assert.equal(missingProbe.body.error, privateProbe.body.error);

assert.equal((await mutate(
  `/v1/worldgraph/operations/${operationId}/contributions/operation:belladonna-investigate`,
  players[0].token, 'api-investigate', { interactionId: 'read_belladonna_cipher' },
)).code, 200);
const sharedAfterEvidence = await call('GET', `/v1/worldgraph/operations/${operationId}`, {
  token: players[1].token,
});
assert.equal(sharedAfterEvidence.code, 200);
assert.doesNotMatch(JSON.stringify(sharedAfterEvidence.body),
  /belladonna-cipher-fragment|fourth petal|privateEvidence/i,
  'the shared operation projection hides private node identity and clue text');
const investigatorBoard = await call(
  'GET', `/v1/worldgraph/operations/${operationId}/role`, { token: players[0].token },
);
assert.match(JSON.stringify(investigatorBoard.body), /fourth petal/i,
  'the assigned investigator receives only its own private clue');
const driverBoard = await call(
  'GET', `/v1/worldgraph/operations/${operationId}/role`, { token: players[1].token },
);
assert.doesNotMatch(JSON.stringify(driverBoard.body), /fourth petal|reversed the last two/i);

assert.equal((await mutate(
  `/v1/worldgraph/operations/${operationId}/contributions/operation:belladonna-drive`,
  players[1].token, 'api-drive', { interactionId: 'stage_belladonna_car' },
)).code, 200);
assert.equal((await mutate(
  `/v1/worldgraph/operations/${operationId}/contributions/operation:belladonna-mechanic`,
  players[2].token, 'api-mechanic',
)).code, 200);
const mechanicBoard = await call(
  'GET', `/v1/worldgraph/operations/${operationId}/role`, { token: players[2].token },
);
assert.match(JSON.stringify(mechanicBoard.body), /reversed the last two/i);
assert.doesNotMatch(JSON.stringify(mechanicBoard.body), /fourth petal/i);
assert.equal((await mutate(
  `/v1/worldgraph/operations/${operationId}/contributions/operation:belladonna-enforce`,
  players[3].token, 'api-enforce', { interactionId: 'secure_belladonna_room' },
)).code, 200);
const completed = await mutate(
  `/v1/worldgraph/operations/${operationId}/complete`,
  players[0].token, 'api-operation-complete',
);
assert.equal(completed.code, 200, JSON.stringify(completed.body));
assert.equal(completed.body.status, 'completed');
assert.equal((await mutate(
  `/v1/worldgraph/operations/${operationId}/cancel`,
  players[0].token, 'api-operation-cancel-closed',
)).code, 400, 'a terminal operation cannot be canceled into another state');

const recoveryCrewId = crypto.randomUUID();
await app.pool.query(
  'INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)',
  [recoveryCrewId, 'Graph API Recovery Crew', players[0].accountId],
);
await app.pool.query(
  'UPDATE crew_members SET crew_id=$2 WHERE account_id=$1',
  [players[0].accountId, recoveryCrewId],
);
const recoverableOperation = await mutate(
  '/v1/worldgraph/operations/belladonna-demo/operation:belladonna-lockbox/open',
  players[0].token, 'api-recovery-operation-open',
);
assert.equal(recoverableOperation.code, 200);
const canceledOperation = await mutate(
  `/v1/worldgraph/operations/${recoverableOperation.body.operationId}/cancel`,
  players[0].token, 'api-cancel-operation',
);
assert.equal(canceledOperation.code, 200);
assert.equal(canceledOperation.body.status, 'canceled');
assert.deepEqual((await mutate(
  `/v1/worldgraph/operations/${recoverableOperation.body.operationId}/cancel`,
  players[0].token, 'api-cancel-operation',
)).body, canceledOperation.body, 'operation cancellation replays exactly');
const bogusOperation = await call('GET', '/v1/worldgraph/operations/not-a-real-operation', {
  token: players[0].token,
});
assert.equal(bogusOperation.code, 400);
assert.equal(bogusOperation.body.error, 'operation_unavailable');
const foreignOperation = await call(
  'GET', `/v1/worldgraph/operations/${operationId}`, { token: players[0].token },
);
assert.equal(foreignOperation.code, 400);
assert.equal(foreignOperation.body.error, bogusOperation.body.error,
  'another Crew\'s operation and a nonexistent operation have the same public failure');

const { cash: cashAfter, omr: omrAfter } = await readBalances();
for (const player of players) {
  const expectedCash = cashBefore.get(player.accountId) - (player === players[0] ? 300 : 0);
  assert.equal(cashAfter.get(player.accountId), expectedCash,
    'only the graph-declared hardening cash sink moves cash');
  assert.equal(omrAfter.get(player.accountId), omrBefore.get(player.accountId),
    'Phase 1 HTTP play cannot move OMR');
}
const newLedger = (await app.pool.query(
  `SELECT currency,amount,reason FROM transactions
    ORDER BY at,id OFFSET $1`, [ledgerBefore],
)).rows;
assert.deepEqual(newLedger, [{
  currency: 'cash', amount: -300, reason: 'craft:recipe:hardened_steel',
}], 'the HTTP vertical slice creates exactly one declared economy ledger entry');

console.log('✅ world-graph Phase 1 HTTP authority, replay, privacy, and economy contract passed');
await app.close();
