// Phase 1 world-graph HTTP contract and live pg-mem proof.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildOpenApi } from '../src/agentgateway.js';
import { buildServer } from '../src/server.js';
import { register as registerWorldGraphRoutes } from '../src/routes/worldgraph.js';

process.env.MOD_KEY = 'world-graph-phase1-mod-key';

const routeTable = [
  ['POST', '/v1/worldgraph/items/:itemId/assign-current-character'],
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
  for (const status of [400, 401, 403, 429, 503]) {
    assert(operation.responses[status]?.content?.['application/json']?.schema,
      `${method} ${path} has a typed ${status} response`);
  }
  assert(operation.responses[429].headers?.['Retry-After']);
  assert(operation.responses[503].headers?.['Retry-After']);
  for (const parameter of operation.parameters.filter(({ in: where }) => where === 'path')) {
    assert.equal(parameter.schema.minLength, 1);
    assert(parameter.schema.maxLength <= 200);
    assert.equal(typeof parameter.schema.pattern, 'string');
  }
  if (method === 'POST') {
    const idempotency = operation.parameters.find((entry) => entry.in === 'header');
    assert.equal(idempotency?.name, 'Idempotency-Key');
    assert.equal(idempotency?.required, true);
    assert.equal(operation.requestBody.content['application/json'].schema.additionalProperties, false);
    assert(operation.responses[409], `${method} ${path} documents safe mutation conflicts`);
    assert(operation.responses[422], `${method} ${path} documents mismatched key reuse`);
    assert.equal(operation.responses[200].headers?.['X-Idempotent-Replay']?.schema?.const, 'true');
  }
}
const cancelContract = spec.paths['/v1/worldgraph/mysteries/{graphId}/cancel'].post;
assert.equal(cancelContract.requestBody.required, true);
assert.deepEqual(cancelContract.requestBody.content['application/json'].schema.required, ['instanceId']);
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
for (const [method, rawPath] of routeTable) {
  const path = rawPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  const operation = liveSpec.body.paths[path]?.[method.toLowerCase()];
  assert(operation?.responses?.[403]?.content?.['application/json']?.schema,
    `${method} ${path} retains typed authorization failures in live OpenAPI`);
  assert(operation.responses[429]?.headers?.['Retry-After']);
  assert(operation.responses[503]?.headers?.['Retry-After']);
}

const catalogSurface = await call('GET', '/v1/catalog');
assert.equal(catalogSurface.code, 200);
assert.equal(catalogSurface.body.worldGraph.directOnly, true);
assert.equal(catalogSurface.body.worldGraph.agentActAuthority, false);
assert.equal(catalogSurface.body.worldGraph.collectionLogAuthority, false);
assert.equal(catalogSurface.body.worldGraph.omrAuthority, false);
assert.equal(catalogSurface.body.worldGraph.cashAuthority.hardenedSteelSink, 300);
assert.equal(catalogSurface.body.worldGraph.deathPolicy, 'immutable_history_no_inheritance');
assert.equal(catalogSurface.body.worldGraph.validation, 'npm run worldgraph:check');
assert.equal(catalogSurface.body.worldGraph.routes.inventory, '/v1/worldgraph/inventory');
assert.equal(catalogSurface.body.worldGraph.routes.recipes, '/v1/worldgraph/recipes');
assert.match(catalogSurface.body.worldGraph.routes.assignCurrentCharacter, /assign-current-character$/);
assert.equal(catalogSurface.body.worldGraph.routes.mysteries, '/v1/worldgraph/mysteries');
assert.equal(catalogSurface.body.worldGraph.routes.operations, '/v1/worldgraph/operations');
const discoverySurfaces = [
  (await call('GET', '/llms.txt')).body,
  (await call('GET', '/agents')).body,
  (await call('GET', '/AGENTS.md')).body,
  (await call('GET', '/wiki')).body,
];
assert.equal(discoverySurfaces[1], readFileSync('AGENTS.md', 'utf8'));
assert.equal(discoverySurfaces[2], discoverySurfaces[1]);
for (const surface of discoverySurfaces) {
  assert.match(surface, /\/v1\/worldgraph\/inventory/);
  assert.match(surface, /\/v1\/worldgraph\/recipes/);
  assert.match(surface, /\/v1\/worldgraph\/mysteries/);
  assert.match(surface, /\/v1\/worldgraph\/operations/);
  assert.match(surface, /assign-current-character/);
  assert.match(surface, /direct[\s-]*(?:only|content actions)[\s\S]{0,220}(?:no|not)[\s\S]{0,80}\/v1\/agent\/act/i);
}
assert.equal((await call('GET', '/v1/worldgraph/inventory')).code, 401,
  'inventory requires authentication');
assert.equal((await mutate(
  '/v1/worldgraph/items/no-such-item/assign-current-character', null, 'api-unauthorized-custody',
)).code, 401, 'item custody derives its account only after authentication');
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
await app.pool.query('UPDATE characters SET cash=0 WHERE id=$1', [players[1].characterId]);
await app.pool.query(
  `INSERT INTO character_skills (character_id,skill_id)
   VALUES ($1,'fence_network'),($2,'fence_network'),($3,'fence_network')`,
  [players[0].characterId, players[2].characterId, players[3].characterId],
);
const carIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
for (const [index, playerIndex] of [0, 2, 3].entries()) {
  await app.pool.query(
    `INSERT INTO cars
       (id,character_id,model_id,trim_id,dmg,listed,pledged,minted_onchain,race_limit,pink_slip)
     VALUES ($1,$2,'junker','stock',80,false,false,false,null,false)`,
    [carIds[index], players[playerIndex].characterId],
  );
}
const carId = carIds[0];

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
const malformedCancel = await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/cancel',
  players[0].token, 'api-malformed-cancel', {},
);
assert.equal(malformedCancel.code, 400, 'historical cancel requires the exact server-issued instance ID');

const recipeFrom = (response, id) => response.body.recipes.find((entry) => entry.id === id);
const recipes = await call('GET', '/v1/worldgraph/recipes', { token: players[0].token });
assert.equal(recipes.code, 200);
assert.deepEqual(recipes.body.recipes.map(({ id }) => id), [
  'recipe:car_salvage_basic', 'recipe:hardened_steel', 'recipe:precision_lock_tool',
]);
assert.equal(recipeFrom(recipes, 'recipe:car_salvage_basic').available, true);
assert.equal(recipeFrom(recipes, 'recipe:hardened_steel').available, false);
assert(recipeFrom(recipes, 'recipe:hardened_steel').blockedBy.some(
  ({ adapter, current }) => adapter === 'material_quantity' && current === 0,
));
assert.equal(recipeFrom(recipes, 'recipe:precision_lock_tool').available, false);

const emptyRecipes = await call('GET', '/v1/worldgraph/recipes', { token: players[1].token });
assert.equal(emptyRecipes.code, 200);
const emptyHardened = recipeFrom(emptyRecipes, 'recipe:hardened_steel');
assert.equal(emptyHardened.available, false,
  'an eligible recipe is not advertised executable without its server-read resources');
assert(emptyHardened.blockedBy.some(
  ({ adapter, current, required }) => adapter === 'cash' && current === 0 && required === 300,
));
assert(emptyHardened.blockedBy.some(
  ({ adapter, current }) => adapter === 'material_quantity' && current === 0,
));

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
const sharedSalvageKey = 'api-cross-account-salvage';
const salvaged = await mutate(salvageUrl, players[0].token, sharedSalvageKey);
assert.equal(salvaged.code, 200);
const salvageReplay = await mutate(salvageUrl, players[0].token, sharedSalvageKey);
assert.equal(salvageReplay.code, 200);
assert.deepEqual(salvageReplay.body, salvaged.body, 'an exact HTTP retry replays byte-equivalent JSON');
assert.equal(salvageReplay.headers['x-idempotent-replay'], 'true');
const salvageKeyReuse = await mutate(salvageUrl, players[0].token, sharedSalvageKey, {});
assert.equal(salvageKeyReuse.code, 422);
assert.equal(salvageKeyReuse.body.error, 'idempotency_key_reuse',
  'the same key cannot authorize a different logical request');
const changedRouteReuse = await mutate(
  '/v1/worldgraph/recipes/recipe:hardened_steel/craft',
  players[0].token, sharedSalvageKey,
);
assert.equal(changedRouteReuse.code, 422);
assert.equal(changedRouteReuse.body.error, 'idempotency_key_reuse',
  'one account cannot reuse an outer key on another route');
for (const secret of players.flatMap(({ accountId, characterId }) => [accountId, characterId]).concat(crewId)) {
  assert.equal(JSON.stringify(salvaged.body).includes(secret), false,
    'mutation receipts do not publish raw owner identity');
}

let transitionedRecipes = await call('GET', '/v1/worldgraph/recipes', { token: players[0].token });
assert.equal(recipeFrom(transitionedRecipes, 'recipe:hardened_steel').available, true,
  'salvage makes the cash-and-material-backed hardening recipe executable');
assert.equal(recipeFrom(transitionedRecipes, 'recipe:precision_lock_tool').available, false);

const mechanicSalvageUrl = '/v1/worldgraph/recipes/recipe:car_salvage_basic/salvage/' + carIds[1];
const mechanicSalvaged = await mutate(
  mechanicSalvageUrl, players[2].token, sharedSalvageKey,
);
assert.equal(mechanicSalvaged.code, 200,
  'the same external key is independent for a second authenticated account');

const sharedCrossRouteKey = 'api-cross-account-different-route';
const hardened = await mutate(
  '/v1/worldgraph/recipes/recipe:hardened_steel/craft',
  players[0].token, sharedCrossRouteKey,
);
assert.equal(hardened.code, 200);
assert.equal(hardened.body.cashCost, 300);
const mechanicHardened = await mutate(
  '/v1/worldgraph/recipes/recipe:hardened_steel/craft',
  players[2].token, 'api-mechanic-hardened',
);
assert.equal(mechanicHardened.code, 200);

transitionedRecipes = await call('GET', '/v1/worldgraph/recipes', { token: players[0].token });
assert.equal(recipeFrom(transitionedRecipes, 'recipe:precision_lock_tool').available, true,
  'the board transitions to executable only after the prerequisite craft');
const precision = await mutate(
  '/v1/worldgraph/recipes/recipe:precision_lock_tool/craft',
  players[0].token, 'api-precision',
);
assert.equal(precision.code, 200);
const precisionItemId = precision.body.outputs.find(
  ({ templateId }) => templateId === 'item:precision_lock_tool',
)?.id;
assert(precisionItemId);

const mechanicPrecision = await mutate(
  '/v1/worldgraph/recipes/recipe:precision_lock_tool/craft',
  players[2].token, sharedCrossRouteKey,
);
assert.equal(mechanicPrecision.code, 200,
  'the same external key may authorize a different route for another account');
const mechanicPrecisionItemId = mechanicPrecision.body.outputs.find(
  ({ templateId }) => templateId === 'item:precision_lock_tool',
)?.id;
assert(mechanicPrecisionItemId,
  'the operation mechanic acquires its own proof tool through salvage and craft HTTP');

const innerKey = (accountId, externalKey) => `worldgraph:http:v1:${crypto.createHash('sha256')
  .update(JSON.stringify(['omerta-worldgraph-http-v1', accountId, externalKey])).digest('hex')}`;
const scopedKeys = [
  innerKey(players[0].accountId, sharedSalvageKey),
  innerKey(players[2].accountId, sharedSalvageKey),
  innerKey(players[0].accountId, sharedCrossRouteKey),
  innerKey(players[2].accountId, sharedCrossRouteKey),
];
assert.equal(new Set(scopedKeys).size, scopedKeys.length);
for (const key of scopedKeys) {
  assert.equal(key.length, 83);
  assert.match(key, /^worldgraph:http:v1:[0-9a-f]{64}$/);
  assert.equal(Number((await app.pool.query(
    'SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key=$1', [key],
  )).rows[0].n), 1, 'each account-scoped inner mutation key is persisted exactly once');
}
assert.equal(Number((await app.pool.query(
  `SELECT COUNT(*) AS n FROM item_mutation_guards
    WHERE idempotency_key IN ($1,$2)`, [sharedSalvageKey, sharedCrossRouteKey],
)).rows[0].n), 0, 'raw external idempotency keys never enter the global domain guard table');

const assignmentUrl = `/v1/worldgraph/items/${precisionItemId}/assign-current-character`;
assert.equal((await mutate(assignmentUrl, players[0].token, null)).body.error,
  'bad_idempotency_key');
assert.equal((await mutate(
  assignmentUrl, players[0].token, 'api-assignment-spoof', { owner: players[1].accountId },
)).code, 400, 'the custody bridge accepts no owner or destination authority');
const assigned = await mutate(assignmentUrl, players[0].token, 'api-assign-investigator-tool');
assert.equal(assigned.code, 200, JSON.stringify(assigned.body));
const assignedReplay = await mutate(
  assignmentUrl, players[0].token, 'api-assign-investigator-tool',
);
assert.deepEqual(assignedReplay.body, assigned.body);
assert.equal(assignedReplay.headers['x-idempotent-replay'], 'true');
const unavailableAssignmentBodies = await Promise.all([
  mutate(assignmentUrl, players[0].token, 'api-assign-stale-tool'),
  mutate(`/v1/worldgraph/items/${mechanicPrecisionItemId}/assign-current-character`,
    players[0].token, 'api-assign-foreign-tool'),
  mutate('/v1/worldgraph/items/no-such-item/assign-current-character',
    players[0].token, 'api-assign-missing-tool'),
]);
for (const response of unavailableAssignmentBodies) {
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'item_assignment_unavailable');
}
const assignedRow = (await app.pool.query(
  'SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [precisionItemId],
)).rows[0];
assert.deepEqual(assignedRow, {
  owner_scope: 'character', owner_id: players[0].characterId, state: 'active',
});
assert.equal(Number((await app.pool.query(
  "SELECT COUNT(*) AS n FROM item_events WHERE item_id=$1 AND event_kind='transferred'",
  [precisionItemId],
)).rows[0].n), 1, 'the narrow custody route writes one permanent transfer provenance event');

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
const sharedRoleKey = 'api-shared-role-assignment';
for (let index = 0; index < roles.length; index += 1) {
  const assigned = await mutate(
    `/v1/worldgraph/operations/${operationId}/roles/${roles[index]}`,
    players[index].token, sharedRoleKey,
  );
  assert.equal(assigned.code, 200, JSON.stringify(assigned.body));
  if (index === 0) {
    const roleConflict = await mutate(
      `/v1/worldgraph/operations/${operationId}/roles/investigator`,
      players[1].token, 'api-role-conflict',
    );
    assert.equal(roleConflict.code, 409);
    assert.equal(roleConflict.body.error, 'operation_role_taken',
      'a concurrent role authority conflict uses the stable safe 409 mapping');
  }
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
const awardedInventory = await call('GET', '/v1/worldgraph/inventory', {
  token: players[0].token,
});
const artifactItemId = awardedInventory.body.items.find(
  ({ templateId }) => templateId === 'item:belladonna_artifact',
)?.id;
assert(artifactItemId);
const wrongTemplateAssignment = await mutate(
  `/v1/worldgraph/items/${artifactItemId}/assign-current-character`,
  players[0].token, 'api-assign-unflagged-artifact',
);
assert.equal(wrongTemplateAssignment.code, 400);
assert.equal(wrongTemplateAssignment.body.error, 'item_assignment_unavailable',
  'an owned but unflagged template is indistinguishable from absent or foreign custody');
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

// A second complete HTTP-only supply chain proves custody races and historical recovery. The only
// direct writes below simulate the external death boundary; all item acquisition, custody, mystery,
// escrow, and release authority stays behind the authenticated Phase 1 routes.
const recoverySalvage = await mutate(
  `/v1/worldgraph/recipes/recipe:car_salvage_basic/salvage/${carIds[2]}`,
  players[3].token, sharedCrossRouteKey,
);
assert.equal(recoverySalvage.code, 200,
  'the shared text key is still account-scoped when used on a third route instance');
assert.equal((await mutate(
  '/v1/worldgraph/recipes/recipe:hardened_steel/craft',
  players[3].token, 'api-recovery-hardened',
)).code, 200);
const recoveryPrecision = await mutate(
  '/v1/worldgraph/recipes/recipe:precision_lock_tool/craft',
  players[3].token, 'api-recovery-precision',
);
assert.equal(recoveryPrecision.code, 200);
const recoveryToolId = recoveryPrecision.body.outputs.find(
  ({ templateId }) => templateId === 'item:precision_lock_tool',
)?.id;
assert(recoveryToolId);

const recoveryAssignmentUrl = `/v1/worldgraph/items/${recoveryToolId}/assign-current-character`;
const raceKeys = ['api-recovery-custody-race-a', 'api-recovery-custody-race-b'];
const custodyRace = await Promise.all(raceKeys.map((key) => (
  mutate(recoveryAssignmentUrl, players[3].token, key)
)));
const raceWinnerIndex = custodyRace.findIndex(({ code }) => code === 200);
assert.notEqual(raceWinnerIndex, -1, JSON.stringify(custodyRace));
assert.equal(custodyRace.filter(({ code }) => code === 200).length, 1,
  'two racing custody requests cannot both move one unique item');
const raceLoser = custodyRace[1 - raceWinnerIndex];
assert([400, 409].includes(raceLoser.code));
assert(['item_assignment_unavailable', 'contention'].includes(raceLoser.body.error));
const raceWinnerReplay = await mutate(
  recoveryAssignmentUrl, players[3].token, raceKeys[raceWinnerIndex],
);
assert.deepEqual(raceWinnerReplay.body, custodyRace[raceWinnerIndex].body);
assert.equal(raceWinnerReplay.headers['x-idempotent-replay'], 'true');
assert.equal(Number((await app.pool.query(
  "SELECT COUNT(*) AS n FROM item_events WHERE item_id=$1 AND event_kind='transferred'",
  [recoveryToolId],
)).rows[0].n), 1, 'a custody race leaves one permanent transfer event');

const recoveryStart = await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/start',
  players[3].token, 'api-recovery-mystery-start',
);
assert.equal(recoveryStart.code, 200);
const historicalInstanceId = recoveryStart.body.instanceId;
assert(historicalInstanceId);
assert.equal((await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/nodes/mystery:belladonna-trace/complete',
  players[3].token, 'api-recovery-trace', { interactionId: 'inspect_belladonna_stamp' },
)).code, 200);
assert.equal((await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/nodes/mystery:belladonna-lock/discover',
  players[3].token, 'api-recovery-discover-lock',
)).code, 200);
assert.equal((await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/nodes/mystery:belladonna-lock/complete',
  players[3].token, 'api-recovery-open-lock', { interactionId: 'set_precision_tumblers' },
)).code, 200);
assert.equal((await app.pool.query(
  'SELECT state FROM item_instances WHERE id=$1', [recoveryToolId],
)).rows[0].state, 'escrowed');

const historicalCustody = async () => {
  const [stacks, item, mystery, escrow] = await Promise.all([
    app.pool.query(
      `SELECT owner_scope,owner_id,template_id,quality,quantity,created_at,updated_at
         FROM item_stacks
        WHERE owner_id IN ($1,$2)
        ORDER BY owner_scope,owner_id,template_id,quality`,
      [players[3].characterId, players[3].accountId],
    ),
    app.pool.query(
      `SELECT id,template_id,owner_scope,owner_id,state,created_at,updated_at,consumed_at
         FROM item_instances WHERE id=$1`,
      [recoveryToolId],
    ),
    app.pool.query(
      `SELECT id,owner_scope,owner_id,authority_account_id,graph_id,graph_version,status,
              created_at,updated_at,completed_at,failed_at,canceled_at
         FROM mystery_instances WHERE id=$1`,
      [historicalInstanceId],
    ),
    app.pool.query(
      `SELECT item_id,owner_scope,operation_id,item_state,depositor_scope,depositor_id,created_at
         FROM operation_escrow WHERE item_id=$1`,
      [recoveryToolId],
    ),
  ]);
  return { stacks: stacks.rows, item: item.rows, mystery: mystery.rows, escrow: escrow.rows };
};
const PHASE1_AUTHORITY_TABLES = Object.freeze([
  ['item_stacks', 'owner_scope,owner_id,template_id,quality'],
  ['item_instances', 'id'],
  ['item_events', 'sequence'],
  ['item_mutation_guards', 'idempotency_key'],
  ['operation_escrow', 'item_id'],
  ['mystery_instances', 'id'],
  ['mystery_node_state', 'instance_id,node_id'],
  ['mystery_choices', 'instance_id,node_id'],
  ['world_operations', 'id'],
  ['world_operation_roles', 'operation_id,role_id'],
  ['world_operation_node_state', 'operation_id,node_id'],
  ['world_operation_contributions', 'operation_id,node_id'],
]);
const phase1AuthoritySnapshot = async () => Object.fromEntries(await Promise.all(
  PHASE1_AUTHORITY_TABLES.map(async ([table, order]) => [
    table, (await app.pool.query(`SELECT * FROM ${table} ORDER BY ${order}`)).rows,
  ]),
));
const custodyBeforeDeath = await historicalCustody();
const phase1AuthorityBeforeDeath = await phase1AuthoritySnapshot();
assert(custodyBeforeDeath.stacks.length > 0, 'the death fixture includes generic stack owner tuples');
assert.deepEqual(custodyBeforeDeath.item.map(({ owner_scope, owner_id, state }) => (
  { owner_scope, owner_id, state }
)), [{ owner_scope: 'operation', owner_id: historicalInstanceId, state: 'escrowed' }]);
assert.deepEqual(custodyBeforeDeath.escrow.map(({ depositor_scope, depositor_id }) => (
  { depositor_scope, depositor_id }
)), [{ depositor_scope: 'character', depositor_id: players[3].characterId }]);

const death = await app.inject({
  method: 'POST',
  url: '/v1/mod/kill',
  headers: { 'x-mod-key': process.env.MOD_KEY },
  payload: { characterId: players[3].characterId, reason: 'Phase 1 estate-policy proof' },
});
assert.equal(death.statusCode, 200, death.body);
const replacementCharacterId = death.json().heirId;
assert(replacementCharacterId, 'the production runEstate path creates the replacement street');
assert.notEqual(replacementCharacterId, players[3].characterId);
assert.equal(Number((await app.pool.query(
  'SELECT COUNT(*) AS n FROM characters WHERE account_id=$1 AND alive', [players[3].accountId],
)).rows[0].n), 1, 'the production death path leaves exactly one living replacement');
assert.deepEqual(await phase1AuthoritySnapshot(), phase1AuthorityBeforeDeath,
  'runEstate cannot insert, merge, update, delete, inherit, or duplicate any Phase 1 authority row');
assert.equal(Number((await app.pool.query(
  `SELECT
     (SELECT count(*) FROM item_stacks
       WHERE owner_scope='character' AND owner_id=$1) +
     (SELECT count(*) FROM item_instances
       WHERE owner_scope='character' AND owner_id=$1) +
     (SELECT count(*) FROM item_events
       WHERE (from_owner_scope='character' AND from_owner_id=$1)
          OR (to_owner_scope='character' AND to_owner_id=$1)) +
     (SELECT count(*) FROM item_mutation_guards
       WHERE owner_scope='character' AND owner_id=$1) +
     (SELECT count(*) FROM operation_escrow
       WHERE (owner_scope='character' AND operation_id=$1)
          OR (depositor_scope='character' AND depositor_id=$1)) +
     (SELECT count(*) FROM mystery_instances
       WHERE owner_scope='character' AND owner_id=$1) AS n`,
  [replacementCharacterId],
)).rows[0].n), 0,
'the heir receives no inserted or copied Phase 1 owner/depositor tuple');
assert.deepEqual(await historicalCustody(), custodyBeforeDeath,
  'runEstate and replacement creation preserve every generic owner and exact historical depositor tuple byte-for-byte');
const heirDriveHistorical = await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/nodes/mystery:belladonna-reward/complete',
  players[3].token, 'api-heir-drive-historical', { interactionId: 'recover_belladonna_lockbox' },
);
assert.equal(heirDriveHistorical.code, 400);
assert.equal(heirDriveHistorical.body.error, 'mystery_not_started',
  'the heir cannot drive the old character-scoped mystery instance');
assert.deepEqual(await historicalCustody(), custodyBeforeDeath,
  'a refused heir action cannot mutate historical custody');

const replacementStart = await mutate(
  '/v1/worldgraph/mysteries/belladonna-demo/start',
  players[3].token, 'api-replacement-mystery-start',
);
assert.equal(replacementStart.code, 200);
assert.notEqual(replacementStart.body.instanceId, historicalInstanceId,
  'the replacement street may have its own current instance');
assert.deepEqual(await historicalCustody(), custodyBeforeDeath,
  'starting the heir\'s distinct instance still does not inherit or duplicate historical custody');

// Simulate the active registry no longer matching the instance's immutable definition. The direct
// runtime suite drives the natural v1-instance/v2-registry direction; this HTTP seam stores another
// valid version to prove the route does not demand equality before entering release-only recovery.
await app.pool.query(
  'UPDATE mystery_instances SET graph_version=2 WHERE id=$1', [historicalInstanceId],
);
const oldVersionCustody = await historicalCustody();
assert.equal(Number(oldVersionCustody.mystery[0].graph_version), 2);

const historicalCancelUrl = '/v1/worldgraph/mysteries/belladonna-demo/cancel';
const foreignHistorical = await mutate(
  historicalCancelUrl, players[1].token, 'api-foreign-historical-cancel',
  { instanceId: historicalInstanceId },
);
const missingHistorical = await mutate(
  historicalCancelUrl, players[1].token, 'api-missing-historical-cancel',
  { instanceId: 'not-a-real-instance' },
);
assert.equal(foreignHistorical.code, 400);
assert.equal(missingHistorical.code, 400);
assert.equal(foreignHistorical.body.error, 'mystery_unavailable');
assert.equal(missingHistorical.body.error, foreignHistorical.body.error,
  'historical instance lookup does not reveal another account\'s instance');
const wrongGraphHistorical = await mutate(
  '/v1/worldgraph/mysteries/not-a-graph/cancel',
  players[3].token, 'api-wrong-graph-historical-cancel',
  { instanceId: historicalInstanceId },
);
assert.equal(wrongGraphHistorical.code, 400);
assert.equal(wrongGraphHistorical.body.error, 'mystery_unavailable');

const canceledMystery = await mutate(
  historicalCancelUrl, players[3].token, 'api-historical-cancel',
  { instanceId: historicalInstanceId },
);
assert.equal(canceledMystery.code, 200, JSON.stringify(canceledMystery.body));
assert.equal(canceledMystery.body.status, 'canceled');
assert.equal(canceledMystery.body.graph.version, 2,
  'the release receipt retains the stored pinned version rather than relabeling it current');
assert.equal(canceledMystery.body.releasedEscrowCount, 1);
const canceledMysteryReplay = await mutate(
  historicalCancelUrl, players[3].token, 'api-historical-cancel',
  { instanceId: historicalInstanceId },
);
assert.deepEqual(canceledMysteryReplay.body, canceledMystery.body,
  'historical cancellation replays exactly after death and replacement');
assert.equal(canceledMysteryReplay.headers['x-idempotent-replay'], 'true');
const historicalCancelAfterReplacement = await mutate(
  historicalCancelUrl, players[3].token, 'api-historical-cancel-after-replacement',
  { instanceId: historicalInstanceId },
);
assert.equal(historicalCancelAfterReplacement.code, 200);
assert.equal(historicalCancelAfterReplacement.body.status, 'canceled');
assert.equal(historicalCancelAfterReplacement.body.releasedEscrowCount, 0,
  'a fresh post-replacement lookup still targets the closed historical instance, not the heir');
const recoveredTool = (await app.pool.query(
  'SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [recoveryToolId],
)).rows[0];
assert.deepEqual(recoveredTool, {
  owner_scope: 'character', owner_id: players[3].characterId, state: 'active',
}, 'escrow returns to the exact historical depositor, never the replacement character');
assert.equal(Number((await app.pool.query(
  "SELECT COUNT(*) AS n FROM item_events WHERE item_id=$1 AND event_kind='released'",
  [recoveryToolId],
)).rows[0].n), 1, 'historical retry cannot duplicate escrow release provenance');
assert.equal(Number((await app.pool.query(
  'SELECT COUNT(*) AS n FROM item_instances WHERE id=$1', [recoveryToolId],
)).rows[0].n), 1, 'historical recovery preserves one permanent item id');
assert.equal(Number((await app.pool.query(
  'SELECT COUNT(*) AS n FROM operation_escrow WHERE item_id=$1', [recoveryToolId],
)).rows[0].n), 0, 'the one live escrow claim is removed after its exact release');
assert.deepEqual((await app.pool.query(
  'SELECT id,status FROM mystery_instances WHERE id IN ($1,$2) ORDER BY id',
  [historicalInstanceId, replacementStart.body.instanceId],
)).rows.map(({ id, status }) => ({ id, status })).sort((a, b) => a.id.localeCompare(b.id)), [
  { id: historicalInstanceId, status: 'canceled' },
  { id: replacementStart.body.instanceId, status: 'active' },
].sort((a, b) => a.id.localeCompare(b.id)),
'cancel targets the supplied historical instance without touching the replacement instance');

const { cash: cashAfter, omr: omrAfter } = await readBalances();
for (const player of players) {
  const expectedCash = player === players[3]
    ? 0 // the production estate closes the dead street after its Phase 1 hardening spend
    : cashBefore.get(player.accountId) - ([players[0], players[2]].includes(player) ? 300 : 0);
  assert.equal(cashAfter.get(player.accountId), expectedCash,
    'Phase 1 only sinks the declared hardening cash; the driven production estate closes the dead street');
  assert.equal(omrAfter.get(player.accountId), omrBefore.get(player.accountId),
    'Phase 1 HTTP play cannot move OMR');
}
const newLedger = (await app.pool.query(
  `SELECT currency,amount,reason FROM transactions
    ORDER BY at,id OFFSET $1`, [ledgerBefore],
)).rows;
const phase1Ledger = newLedger.filter(({ reason }) => (
  reason.startsWith('craft:recipe:') || reason.startsWith('mystery:') || reason.startsWith('operation:')
));
assert.deepEqual(phase1Ledger, [{
  currency: 'cash', amount: -300, reason: 'craft:recipe:hardened_steel',
}, {
  currency: 'cash', amount: -300, reason: 'craft:recipe:hardened_steel',
}, {
  currency: 'cash', amount: -300, reason: 'craft:recipe:hardened_steel',
}], 'the Phase 1 HTTP vertical slices create only their three declared crafting sink ledger entries');
const deathLedgerOrder = (left, right) => (
  left.currency.localeCompare(right.currency)
  || Number(left.amount) - Number(right.amount)
  || left.reason.localeCompare(right.reason)
);
const deathLedger = newLedger
  .filter(({ reason }) => reason.startsWith('death:'))
  .sort(deathLedgerOrder);
assert.deepEqual(deathLedger, [{
  currency: 'cash', amount: -9700, reason: 'death:estate',
}, {
  currency: 'ammo', amount: -25, reason: 'death:estate',
}, {
  currency: 'cash', amount: 1600, reason: 'death:legacy',
}].sort(deathLedgerOrder),
'the additional value rows belong only to the explicitly driven legacy production estate');

console.log('✅ world-graph Phase 1 HTTP authority, replay, privacy, and economy contract passed');
await app.close();
