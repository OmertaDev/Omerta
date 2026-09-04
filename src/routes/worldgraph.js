// Phase 1 world-graph item economy HTTP boundary.
//
// This module deliberately exposes a small identifier-only contract. The authenticated account,
// current living character, Crew, graph version, recipe authority, quantities, rewards, inventory
// owners, and operation recipients are all resolved from server state and this immutable registry.
// The authored runtime is intentionally separate from /v1/agent/act: discovery never grants an
// autonomous mutation capability.
import crypto from 'node:crypto';
import * as G from '../game.js';
import {
  createCraftingContext,
  recipeCatalog,
  craftWorldGraphRecipe,
  salvageCar,
} from '../crafting.js';
import {
  inventoryBoard,
  transferItem,
  withItemMutation,
  withItemTransaction,
} from '../items.js';
import {
  cancelMystery,
  commitChoice,
  completeNode,
  createMysteryContext,
  discoverNode,
  mysteryBoard,
  startMystery,
} from '../mysteries.js';
import {
  assignRole,
  cancelOperation,
  completeOperation,
  contribute,
  createOperationContext,
  openOperation,
  operationBoard,
  operationDefinitions,
  roleBoard,
} from '../operations.js';
import { loadAndValidatePhase1WorldGraph } from '../content/phase1-validation.js';

// Module initialization is the server boot boundary: the same complete graph, executable adapter,
// and economy-policy gate used by CI must pass before these routes can be registered.
export const PHASE1_WORLD_GRAPH = loadAndValidatePhase1WorldGraph().registry;
const PHASE1_CRAFTING = createCraftingContext({ registry: PHASE1_WORLD_GRAPH });

export const WORLD_GRAPH_CAPABILITIES = Object.freeze({
  phase: 1,
  authenticated: true,
  directOnly: true,
  agentActAuthority: false,
  collectionLogAuthority: false,
  omrAuthority: false,
  cashAuthority: Object.freeze({ hardenedSteelSink: 300 }),
  deathPolicy: 'immutable_history_no_inheritance',
  validation: 'npm run worldgraph:check',
  routes: Object.freeze({
    inventory: '/v1/worldgraph/inventory',
    recipes: '/v1/worldgraph/recipes',
    assignCurrentCharacter: '/v1/worldgraph/items/:itemId/assign-current-character',
    mysteries: '/v1/worldgraph/mysteries',
    operations: '/v1/worldgraph/operations',
  }),
});

const EMPTY_BODY = Object.freeze({
  type: 'object', additionalProperties: false, properties: {},
});
const INTERACTION_BODY = Object.freeze({
  type: 'object', additionalProperties: false, properties: {
    interactionId: { type: 'string', minLength: 1, maxLength: 200 },
  },
});
const CHOICE_BODY = Object.freeze({
  type: 'object', additionalProperties: false, required: ['optionId'], properties: {
    optionId: { type: 'string', minLength: 1, maxLength: 200 },
    interactionId: { type: 'string', minLength: 1, maxLength: 200 },
  },
});
const MYSTERY_CANCEL_BODY = Object.freeze({
  type: 'object', additionalProperties: false, required: ['instanceId'], properties: {
    instanceId: {
      type: 'string', minLength: 1, maxLength: 200,
      pattern: '^(?!\\s)(?:.*\\S)?$',
    },
  },
});

const CONFLICT_CODES = new Set([
  'contention',
  'idempotency_conflict',
  'idempotency_in_progress',
  'operation_role_taken',
  'operation_choice_conflict',
  'choice_committed',
]);
const PUBLIC_ERROR_REPLACEMENTS = new Map([
  // An authenticated caller must not be able to distinguish a real operation in another Crew
  // from an invented identifier. The discovery board is the only operation-ID authority.
  ['operation_not_found', ['operation_unavailable', 'That operation is unavailable.']],
  ['operation_forbidden', ['operation_unavailable', 'That operation is unavailable.']],
  ['operation_cancel_forbidden', ['operation_unavailable', 'That operation is unavailable.']],
  // Mystery projections deliberately hide undiscovered/private node IDs. Direct action failures
  // therefore collapse missing, wrong-kind, and still-hidden nodes to one public response.
  ['mystery_node', ['mystery_node_unavailable', 'That mystery action is unavailable.']],
  ['mystery_node_type', ['mystery_node_unavailable', 'That mystery action is unavailable.']],
  ['mystery_hidden', ['mystery_node_unavailable', 'That mystery action is unavailable.']],
  ['mystery_role_private', ['mystery_node_unavailable', 'That mystery action is unavailable.']],
  ['mystery_choice', ['mystery_node_unavailable', 'That mystery action is unavailable.']],
]);
const FORBIDDEN_PROJECTION_KEYS = new Set([
  'owner',
  'accountId',
  'account_id',
  'characterId',
  'character_id',
  'crewId',
  'crew_id',
  'authorityAccountId',
  'authority_account_id',
  'openedByAccountId',
  'opened_by_account_id',
  'depositorId',
  'depositor_id',
  'depositorScope',
  'depositor_scope',
]);

const fail = (code, message, data) => { throw new G.GameError(code, message, data); };

function publicError(error) {
  const replacement = PUBLIC_ERROR_REPLACEMENTS.get(error?.code);
  return replacement ? new G.GameError(...replacement) : error;
}

function canonicalHeader(value) {
  if (typeof value !== 'string' || value.trim() !== value || !value || value.length > 200) {
    fail('bad_idempotency_key', 'Idempotency-Key must be a canonical string of at most 200 characters.');
  }
  return value;
}

function innerIdempotencyKey(accountId, externalKey) {
  const digest = crypto.createHash('sha256')
    .update(JSON.stringify([
      'omerta-worldgraph-http-v1', accountId, canonicalHeader(externalKey),
    ]))
    .digest('hex');
  return `worldgraph:http:v1:${digest}`;
}

async function requireIdempotency(req) {
  canonicalHeader(req.headers['idempotency-key']);
}

function invalidBody(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'bad_request';
  throw error;
}

const strictBody = (shape) => async (req) => {
  const body = req.body;
  if (body === undefined && !(shape.required || []).length) return;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    invalidBody('Request body must be a JSON object.');
  }
  const allowed = new Set(Object.keys(shape.properties || {}));
  const unexpected = Object.keys(body).find((key) => !allowed.has(key));
  if (unexpected) invalidBody(`Unexpected request field: ${unexpected}.`);
  for (const key of shape.required || []) {
    if (!Object.hasOwn(body, key)) invalidBody(`Missing required request field: ${key}.`);
  }
  for (const [key, rule] of Object.entries(shape.properties || {})) {
    if (!Object.hasOwn(body, key)) continue;
    const value = body[key];
    if (rule.type === 'string' && (typeof value !== 'string'
      || value.length < (rule.minLength || 0) || value.length > (rule.maxLength || Infinity))) {
      invalidBody(`${key} must be a valid string.`);
    }
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
      invalidBody(`${key} must be a canonical string.`);
    }
  }
};

const mutationOptions = (auth, body = EMPTY_BODY) => ({
  preHandler: [auth, requireIdempotency],
  preValidation: strictBody(body),
  // Fastify treats any route-level body schema as requiring a JSON body even when the OpenAPI
  // requestBody is optional. Keep identifier-free/interaction-only actions bodyless-capable; the
  // manual closed-shape validator still rejects any undeclared field when a body is supplied.
  ...((body.required || []).length ? { schema: { body } } : {}),
});

function safeValue(value, { allowPrivateEvidence = false } = {}) {
  if (Array.isArray(value)) return value.map((entry) => safeValue(entry, { allowPrivateEvidence }));
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PROJECTION_KEYS.has(key)) continue;
    if (key === 'privateEvidence' && !allowPrivateEvidence) continue;
    result[key] = safeValue(child, { allowPrivateEvidence });
  }
  return result;
}

function safeInventory(board) {
  return {
    stacks: board.stacks.map(({ templateId, quality, qty, createdAt, updatedAt }) => ({
      templateId, quality, qty, createdAt, updatedAt,
    })),
    items: board.items.map(({ id, templateId, state, escrowed, createdAt, updatedAt }) => ({
      id, templateId, state, escrowed, createdAt, updatedAt,
    })),
  };
}

function graphPackages(kind) {
  const types = new Set(['mystery_step', 'world_gate', 'choice']);
  const operationRoots = kind === 'operation'
    ? new Set(operationDefinitions(PHASE1_WORLD_GRAPH).map(({ root }) => root))
    : null;
  return [...PHASE1_WORLD_GRAPH.byPackage.values()].filter((pkg) => (
    [...PHASE1_WORLD_GRAPH.nodes.values()].some((node) => (
      node.packageId === pkg.id && (kind === 'mystery'
        ? types.has(node.type)
        : operationRoots.has(node))
    ))
  ));
}

function publicMysteryNodes(graphId) {
  return [...PHASE1_WORLD_GRAPH.nodes.values()].filter((node) => (
    node.packageId === graphId
    && ['mystery_step', 'world_gate', 'choice'].includes(node.type)
    && node.visibility === 'public'
  ));
}

async function mysteryDiscovery(client, accountId, characterId) {
  const instances = (await client.query(
    `SELECT id,graph_id,graph_version,status,created_at,completed_at,canceled_at
       FROM mystery_instances
      WHERE owner_scope='character' AND owner_id=$1 AND authority_account_id=$2`,
    [characterId, accountId],
  )).rows;
  const byGraphVersion = new Map(instances.map((row) => [
    `${row.graph_id}:${Number(row.graph_version)}`, row,
  ]));
  return graphPackages('mystery').map((pkg) => {
    const entry = byGraphVersion.get(`${pkg.id}:${Number(pkg.version)}`);
    const publicNodes = publicMysteryNodes(pkg.id);
    return {
      graphId: pkg.id,
      version: Number(pkg.version),
      season: pkg.season || null,
      title: publicNodes[0]?.metadata?.title || pkg.id,
      started: !!entry,
      status: entry?.status || 'available',
      ...(entry ? { instanceId: entry.id } : {}),
    };
  });
}

async function mysteryGateReady(client, accountId, characterId, root) {
  const gate = root.metadata?.mysteryGate;
  if (!gate) return true;
  const ownerId = gate.ownerScope === 'character' ? characterId : accountId;
  const row = (await client.query(
    `SELECT status,graph_version FROM mystery_instances
      WHERE owner_scope=$1 AND owner_id=$2 AND authority_account_id=$3 AND graph_id=$4
        AND graph_version=$5`,
    [gate.ownerScope, ownerId, accountId, gate.graphId, gate.graphVersion],
  )).rows[0];
  if (!row || row.status !== gate.requiredStatus
    || Number(row.graph_version) !== Number(gate.graphVersion)) return false;
  const completed = new Set((await client.query(
    `SELECT node_id FROM mystery_node_state
      WHERE instance_id=(SELECT id FROM mystery_instances
        WHERE owner_scope=$1 AND owner_id=$2 AND authority_account_id=$3 AND graph_id=$4
          AND graph_version=$5)
        AND state='completed'`,
    [gate.ownerScope, ownerId, accountId, gate.graphId, gate.graphVersion],
  )).rows.map(({ node_id: nodeId }) => nodeId));
  return (root.requires || []).every((id) => completed.has(id))
    && (root.requiresAny || []).every((group) => group.some((id) => completed.has(id)))
    && !(root.excludes || []).some((id) => completed.has(id));
}

async function operationDiscovery(client, accountId, characterId) {
  const membership = (await client.query(
    'SELECT crew_id FROM crew_members WHERE account_id=$1', [accountId],
  )).rows[0];
  const definitions = operationDefinitions(PHASE1_WORLD_GRAPH, { publicOnly: true });
  const result = [];
  for (const definition of definitions) {
    const { root } = definition;
    const pkg = PHASE1_WORLD_GRAPH.byPackage.get(root.packageId);
    const existing = membership ? (await client.query(
      `SELECT id,status FROM world_operations
        WHERE crew_id=$1 AND graph_id=$2 AND graph_version=$3 AND operation_node_id=$4`,
      [membership.crew_id, root.packageId, Number(pkg.version), root.id],
    )).rows[0] : null;
    const blockedBy = [];
    if (!membership) blockedBy.push({ code: 'no_crew' });
    if (!await mysteryGateReady(client, accountId, characterId, root)) {
      blockedBy.push({ code: 'operation_locked' });
    }
    result.push({
      graphId: root.packageId,
      version: Number(pkg.version),
      operationNodeId: root.id,
      title: root.metadata?.title || root.id,
      minimumDistinctAccounts: definition.minimumDistinctAccounts,
      roles: definition.roles.map((role) => ({
        roleId: role.id, title: role.title || role.id,
      })),
      available: blockedBy.length === 0,
      blockedBy,
      ...(existing ? { operationId: existing.id, status: existing.status } : {}),
    });
  }
  return result;
}

async function currentCharacterOwner(client, accountId) {
  const row = (await client.query(
    `SELECT id FROM characters
      WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1`,
    [accountId],
  )).rows[0];
  if (!row) fail('no_character', 'Create a character first.');
  return { scope: 'character', id: row.id };
}

async function lockCurrentCharacterOwner(client, accountId, expectedOwner) {
  // Route discovery is snapshot-only. Every mutation first reserves its global item guard, then
  // resolves and locks the authoritative current street. A concurrent death/replacement either
  // commits first and changes this identity (so the action fails closed), or waits behind this row;
  // no outer character lock can invert the guard -> character -> item order used by craft/mystery.
  const row = (await client.query(
    `SELECT id FROM characters
      WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1 FOR UPDATE`,
    [accountId],
  )).rows[0];
  if (!row || row.id !== expectedOwner.id) {
    fail('no_character', 'The current living character changed; refresh and retry.');
  }
  return expectedOwner;
}

export async function assignItemToCurrentCharacter(client, accountId, itemId, idempotencyKey) {
  const row = (await client.query(
    `SELECT template_id FROM item_instances
      WHERE id=$1 AND owner_scope='account' AND owner_id=$2 AND state='active'`,
    [itemId, accountId],
  )).rows[0];
  const template = row ? PHASE1_WORLD_GRAPH.nodes.get(row.template_id) : null;
  if (!template || template.type !== 'item_template'
    || template.metadata?.characterAssignable !== true) {
    fail('item_assignment_unavailable', 'That item cannot be assigned to the current character.');
  }
  const accountOwner = { scope: 'account', id: accountId };
  const characterOwner = await currentCharacterOwner(client, accountId);
  try {
    return await withItemMutation(
      client,
      accountOwner,
      'assign_current_character',
      idempotencyKey,
      {
        action: 'assign_current_character', itemId,
        itemAuthority: { destinations: [characterOwner] },
      },
      async (mutation) => {
        await lockCurrentCharacterOwner(client, accountId, characterOwner);
        const item = await transferItem(
          client,
          accountOwner,
          characterOwner,
          itemId,
          'assigned to current character',
          mutation,
        );
        return { ok: true, kind: 'assign_current_character', item };
      },
    );
  } catch (error) {
    if (error?.code === 'item_unavailable') {
      fail('item_assignment_unavailable', 'That item cannot be assigned to the current character.');
    }
    throw error;
  }
}

async function historicalMysteryOwner(client, accountId, graphId, instanceId) {
  const row = (await client.query(
    `SELECT owner_scope,owner_id,graph_version FROM mystery_instances
      WHERE id=$1 AND authority_account_id=$2 AND graph_id=$3`,
    [instanceId, accountId, graphId],
  )).rows[0];
  if (!row) {
    fail('mystery_unavailable', 'That mystery instance is unavailable.');
  }
  return { scope: row.owner_scope, id: row.owner_id };
}

async function requireCurrentCrewOperation(client, accountId, operationId) {
  const accessible = (await client.query(
    `SELECT 1 FROM world_operations operation
       JOIN crew_members membership ON membership.crew_id=operation.crew_id
      WHERE operation.id=$1 AND membership.account_id=$2`,
    [operationId, accountId],
  )).rowCount === 1;
  if (!accessible) fail('operation_unavailable', 'That operation is unavailable.');
}

const mysteryContext = (accountId) => createMysteryContext({
  registry: PHASE1_WORLD_GRAPH, accountId, now: new Date().toISOString(),
});
const operationContext = (accountId) => createOperationContext({
  registry: PHASE1_WORLD_GRAPH, accountId, now: new Date().toISOString(),
});

async function mutate(pool, reply, action, { allowPrivateEvidence = false } = {}) {
  try {
    const receipt = await withItemTransaction(pool, action);
    return safeValue(receipt, { allowPrivateEvidence });
  } catch (error) {
    const safeError = publicError(error);
    if (!CONFLICT_CODES.has(safeError?.code)) throw safeError;
    return reply.code(409).send({ error: safeError.code, message: safeError.message });
  }
}

async function readForPlayer(pool, accountId, action, { locked = false } = {}) {
  try {
    const wrapped = await (locked ? G.withCharacter : G.readCharacter)(
      pool, accountId, async (ch, client, h) => ({ projection: await action(ch, client, h) }),
    );
    return wrapped.projection;
  } catch (error) {
    throw publicError(error);
  }
}

export function register(app, { pool, auth }) {
  app.post('/v1/worldgraph/items/:itemId/assign-current-character', mutationOptions(auth),
    async (req, reply) => mutate(pool, reply, (client) => assignItemToCurrentCharacter(
      client,
      req.user.sub,
      req.params.itemId,
      innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']),
    )));

  app.get('/v1/worldgraph/inventory', { preHandler: auth }, async (req) =>
    readForPlayer(pool, req.user.sub, async (_ch, client) => safeInventory(
      await inventoryBoard(client, { scope: 'account', id: req.user.sub }),
    )));

  app.get('/v1/worldgraph/recipes', { preHandler: auth }, async (req) =>
    readForPlayer(pool, req.user.sub, async (ch, client, h) => ({
      recipes: recipeCatalog({
        character: ch,
        cash: Number(ch.cash),
        owned: h.owned,
        inventory: await inventoryBoard(client, { scope: 'account', id: req.user.sub }),
      }, PHASE1_CRAFTING),
    })));

  app.post('/v1/worldgraph/recipes/:recipeId/craft', mutationOptions(auth), async (req, reply) =>
    mutate(pool, reply, (client) => craftWorldGraphRecipe(
      client, { accountId: req.user.sub }, req.params.recipeId,
      innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']),
      PHASE1_CRAFTING,
    )));

  app.post('/v1/worldgraph/recipes/:recipeId/salvage/:carId', mutationOptions(auth), async (req, reply) =>
    mutate(pool, reply, (client) => salvageCar(
      client, { accountId: req.user.sub }, req.params.carId, req.params.recipeId,
      innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']),
      PHASE1_CRAFTING,
    )));

  app.get('/v1/worldgraph/mysteries', { preHandler: auth }, async (req) =>
    readForPlayer(pool, req.user.sub, async (ch, client) => ({
      mysteries: await mysteryDiscovery(client, req.user.sub, ch.id),
    })));

  app.post('/v1/worldgraph/mysteries/:graphId/start', mutationOptions(auth), async (req, reply) =>
    mutate(pool, reply, async (client) => {
      const owner = await currentCharacterOwner(client, req.user.sub);
      const pkg = PHASE1_WORLD_GRAPH.byPackage.get(req.params.graphId);
      if (!pkg) fail('mystery_graph', 'No such mystery graph package.');
      return startMystery(
        client, mysteryContext(req.user.sub), owner, req.params.graphId, Number(pkg.version),
        innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']),
      );
    }));

  app.get('/v1/worldgraph/mysteries/:graphId', { preHandler: auth }, async (req) =>
    readForPlayer(pool, req.user.sub, async (ch, client) => safeValue(await mysteryBoard(
      client, mysteryContext(req.user.sub), { scope: 'character', id: ch.id }, req.params.graphId,
    )), { locked: true }));

  app.post('/v1/worldgraph/mysteries/:graphId/nodes/:nodeId/discover',
    mutationOptions(auth, INTERACTION_BODY), async (req, reply) => mutate(pool, reply, async (client) => {
      const owner = await currentCharacterOwner(client, req.user.sub);
      return discoverNode(
        client, mysteryContext(req.user.sub), owner, req.params.graphId, req.params.nodeId,
        { idempotencyKey: innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']),
          interactionId: req.body?.interactionId },
      );
    }));

  app.post('/v1/worldgraph/mysteries/:graphId/nodes/:nodeId/complete',
    mutationOptions(auth, INTERACTION_BODY), async (req, reply) => mutate(pool, reply, async (client) => {
      const owner = await currentCharacterOwner(client, req.user.sub);
      return completeNode(
        client, mysteryContext(req.user.sub), owner, req.params.graphId, req.params.nodeId,
        { idempotencyKey: innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']),
          interactionId: req.body?.interactionId },
      );
    }));

  app.post('/v1/worldgraph/mysteries/:graphId/choices/:nodeId',
    mutationOptions(auth, CHOICE_BODY), async (req, reply) => mutate(pool, reply, async (client) => {
      const owner = await currentCharacterOwner(client, req.user.sub);
      return commitChoice(
        client, mysteryContext(req.user.sub), owner, req.params.graphId, req.params.nodeId,
        req.body.optionId,
        { idempotencyKey: innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']),
          interactionId: req.body?.interactionId },
      );
    }));

  app.post('/v1/worldgraph/mysteries/:graphId/cancel', mutationOptions(auth, MYSTERY_CANCEL_BODY),
    async (req, reply) => mutate(pool, reply, async (client) => {
      const owner = await historicalMysteryOwner(
        client, req.user.sub, req.params.graphId, req.body.instanceId,
      );
      return cancelMystery(
        client, mysteryContext(req.user.sub), owner, req.params.graphId,
        req.body.instanceId,
        { idempotencyKey: innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']) },
      );
    }));

  app.get('/v1/worldgraph/operations', { preHandler: auth }, async (req) =>
    readForPlayer(pool, req.user.sub, async (ch, client) => ({
      operations: await operationDiscovery(client, req.user.sub, ch.id),
    })));

  app.post('/v1/worldgraph/operations/:graphId/:operationNodeId/open', mutationOptions(auth),
    async (req, reply) => mutate(pool, reply, (client) => {
      const pkg = PHASE1_WORLD_GRAPH.byPackage.get(req.params.graphId);
      if (!pkg) fail('operation_graph', 'No such social operation graph package.');
      return openOperation(
        client, operationContext(req.user.sub), req.params.graphId,
        req.params.operationNodeId, Number(pkg.version),
        innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']),
      );
    }));

  app.get('/v1/worldgraph/operations/:operationId', { preHandler: auth }, async (req) =>
    readForPlayer(pool, req.user.sub, async (_ch, client) => {
      await requireCurrentCrewOperation(client, req.user.sub, req.params.operationId);
      return safeValue(await operationBoard(
        client, operationContext(req.user.sub), req.params.operationId,
      ));
    }));

  app.get('/v1/worldgraph/operations/:operationId/role', { preHandler: auth }, async (req) =>
    readForPlayer(pool, req.user.sub, async (_ch, client) => {
      await requireCurrentCrewOperation(client, req.user.sub, req.params.operationId);
      return safeValue(await roleBoard(
        client, operationContext(req.user.sub), req.params.operationId,
      ), { allowPrivateEvidence: true });
    }));

  app.post('/v1/worldgraph/operations/:operationId/roles/:roleId', mutationOptions(auth),
    async (req, reply) => mutate(pool, reply, (client) => assignRole(
      client, operationContext(req.user.sub), req.params.operationId, req.params.roleId,
      { idempotencyKey: innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']) },
    )));

  app.post('/v1/worldgraph/operations/:operationId/contributions/:nodeId',
    mutationOptions(auth, INTERACTION_BODY), async (req, reply) => mutate(pool, reply, (client) => contribute(
      client, operationContext(req.user.sub), req.params.operationId, req.params.nodeId,
      { idempotencyKey: innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']),
        interactionId: req.body?.interactionId },
    )));

  app.post('/v1/worldgraph/operations/:operationId/complete', mutationOptions(auth),
    async (req, reply) => mutate(pool, reply, (client) => completeOperation(
      client, operationContext(req.user.sub), req.params.operationId,
      { idempotencyKey: innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']) },
    )));

  app.post('/v1/worldgraph/operations/:operationId/cancel', mutationOptions(auth),
    async (req, reply) => mutate(pool, reply, (client) => cancelOperation(
      client, operationContext(req.user.sub), req.params.operationId,
      { idempotencyKey: innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']) },
    )));
}
