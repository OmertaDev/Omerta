import crypto from 'node:crypto';
import { GameError } from '../game.js';
import { isDbDown } from '../dbhealth.js';
import { createWorldKernel } from '../world-kernel.js';
import { createWorldKernelQuery } from '../world-kernel-query.js';
import { createCoordinationKnowledge } from '../coordination/knowledge.js';
import { createCraftingContext, craftWorldGraphRecipe, recipeCatalogForPlayer } from '../crafting.js';
import { withItemTransaction } from '../items.js';
import { WORLD_KERNEL_REGISTRY, WORLD_KERNEL_OBJECTS, WORLD_KERNEL_RECIPE } from '../content/world-kernel-pilot.js';

const invalid = () => { throw new GameError('bad_world_request', 'Invalid world request.'); };
const identifier = (value) => typeof value === 'string' && /^[\x21-\x7e]{1,160}$/.test(value);
const actionBody = { type: 'object', additionalProperties: false, required: ['itemId', 'expectedRevision'], properties: {
  itemId: { type: 'string', minLength: 1, maxLength: 160 }, expectedRevision: { type: 'integer', minimum: 0, maximum: 2147483647 },
} };
function validate(fields = null) {
  return async (req) => {
    if (Object.keys(req.query || {}).length) invalid();
    if (Object.values(req.params || {}).some((value) => !identifier(value))) invalid();
    if (fields !== null) {
      const value = req.body === undefined ? {} : req.body;
      if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).some((key) => !fields.includes(key)) || fields.some((key) => !Object.hasOwn(value, key))) invalid();
      if (fields.includes('itemId') && !identifier(value.itemId)) invalid();
      if (fields.includes('expectedRevision') && (!Number.isSafeInteger(value.expectedRevision)
        || value.expectedRevision < 0 || value.expectedRevision > 2147483647)) invalid();
      if (!identifier(req.headers['idempotency-key'])) invalid();
    }
  };
}
function safeError(error, _req, reply) {
  if (error?.statusCode === 401) return reply.code(401).send({ error: 'unauthorized', message: 'A valid bearer token is required.' });
  if (isDbDown(error)) return reply.code(503).send({ error: 'db_down', message: 'The database is temporarily unavailable.' });
  const code = error?.code;
  if (['world_unavailable', 'world_query_unavailable', 'no_character', 'crafting_unavailable'].includes(code)) {
    return reply.code(404).send({ error: 'world_unavailable', message: 'That world action or object is unavailable.' });
  }
  if (code === 'world_forbidden' || error?.statusCode === 403) {
    return reply.code(403).send({ error: 'world_forbidden', message: 'That world action is unavailable.' });
  }
  if (['world_stale', 'contention', 'idempotency_conflict', 'item_idempotency_conflict'].includes(code)) {
    return reply.code(409).send({ error: code, message: 'Refresh world state before trying again.' });
  }
  if (['item_commit_unknown', 'item_recovery_required', 'world_definition_changed'].includes(code)) {
    return reply.code(503).send({ error: code, message: 'Reconcile this command using its original key.' });
  }
  if (['bad_world_request', 'bad_world_definition', 'bad_world_query', 'knowledge_required', 'materials',
    'item_unavailable', 'location', 'bad_recipe'].includes(code) || error?.validation) {
    return reply.code(400).send({ error: code || 'bad_world_request', message: 'The world request requirements are not satisfied.' });
  }
  return reply.code(500).send({ error: 'internal', message: 'The world request could not complete.' });
}

export function register(app, { pool, auth, receiptTrust = null }) {
  const enabled = process.env.WORLD_GRAPH_KERNEL === 'on';
  const knowledgeEnabled = enabled && process.env.COORDINATION_ENGINE === 'on' && process.env.COORDINATION_KNOWLEDGE === 'on';
  const sharingEnabled = knowledgeEnabled && process.env.COORDINATION_KNOWLEDGE_SHARING === 'on';
  const accountIds = (process.env.COORDINATION_ACCOUNT_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  const cohort = new Set(accountIds);
  const policy = { enabled, knowledgeEnabled, sharingEnabled, accountIds };
  const world = createWorldKernel({ pool, registry: WORLD_KERNEL_REGISTRY, objects: WORLD_KERNEL_OBJECTS, ...policy });
  const knowledge = createCoordinationKnowledge({ enabled: knowledgeEnabled, sharingEnabled, accountIds });
  const query = createWorldKernelQuery({ pool, knowledge, registry: WORLD_KERNEL_REGISTRY });
  const crafting = createCraftingContext({ registry: WORLD_KERNEL_REGISTRY, knowledgeEnabled, sharingEnabled, accountIds });
  const admit = async (req) => {
    if (!enabled || (cohort.size && !cohort.has(req.user.sub))) throw new GameError('world_unavailable', 'World Graph is unavailable.');
  };
  const options = (fields = null) => ({ preHandler: [auth, admit], preValidation: validate(fields), errorHandler: safeError,
    ...(fields !== null && typeof receiptTrust === 'symbol' ? { config: { coordinationReceipts: receiptTrust } } : {}),
    ...(fields?.length ? { schema: { body: actionBody } } : {}),
  });
  app.get('/v1/worldgraph/state', options(), (req) => query.snapshot(req.user.sub));
  app.get('/v1/worldgraph/objects', options(), async (req) => ({ objects: await world.list(req.user.sub) }));
  app.get('/v1/worldgraph/objects/:objectId', options(), (req) => world.get(req.user.sub, req.params.objectId));
  app.post('/v1/worldgraph/objects/:objectId/actions/:actionId', options(['itemId', 'expectedRevision']), (req) =>
    world.execute(req.user.sub, { objectId: req.params.objectId, actionId: req.params.actionId, ...req.body }, req.headers['idempotency-key']));
  app.get('/v1/worldgraph/kernel/recipes', options(), async (req) => ({ recipes: await withItemTransaction(pool,
    (client) => recipeCatalogForPlayer(client, req.user.sub, crafting, [WORLD_KERNEL_RECIPE])) }));
  app.post('/v1/worldgraph/kernel/recipes/:recipeId/craft', options([]), (req) => {
    if (req.params.recipeId !== WORLD_KERNEL_RECIPE) throw new GameError('world_unavailable', 'Recipe unavailable.');
    const key = 'world-craft:' + crypto.createHash('sha256').update(JSON.stringify([req.user.sub, req.headers['idempotency-key']])).digest('hex');
    return withItemTransaction(pool, (client) => craftWorldGraphRecipe(client, { accountId: req.user.sub }, req.params.recipeId, key, crafting));
  });
}
