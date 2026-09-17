import { GameError } from '../game.js';
import { isDbDown } from '../dbhealth.js';
import { createWorldProjection } from '../world-projection.js';
import { createWorldKernel } from '../world-kernel.js';
import { createWorldKernelQuery } from '../world-kernel-query.js';
import { createCoordinationKnowledge } from '../coordination/knowledge.js';
import { createFamilyOperations } from '../coordination/operations.js';
import { createCraftingContext } from '../crafting.js';
import { coreProgressionContent } from '../content/core-progression.js';

const invalid = () => { throw new GameError('bad_projection_request', 'Invalid projection request.'); };
const identifier = (value) => typeof value === 'string' && /^[\x21-\x7e]{1,160}$/.test(value);
function validate(world = false) {
  return async (req, reply) => {
    reply.header('cache-control', 'no-store');
    const query = req.query || {};
    if (Object.keys(query).some((key) => !world || key !== 'operationId')
      || (query.operationId !== undefined && !identifier(query.operationId))) invalid();
  };
}
function safeError(error, _req, reply) {
  reply.header('cache-control', 'no-store');
  if (error?.statusCode === 401) return reply.code(401).send({ error: 'unauthorized', message: 'A valid bearer token is required.' });
  if (isDbDown(error)) return reply.code(503).send({ error: 'db_down', message: 'The database is temporarily unavailable.' });
  if (error?.code === 'bad_projection_request' || error?.validation) return reply.code(400).send({ error: 'bad_projection_request', message: 'Invalid projection request.' });
  if (error?.code === 'no_character') return reply.code(404).send({ error: 'no_character', message: 'Create a character first.' });
  if (['projection_unavailable', 'world_query_unavailable', 'world_unavailable', 'crafting_unavailable', 'coordination_operation_unavailable'].includes(error?.code))
    return reply.code(404).send({ error: 'projection_unavailable', message: 'That view is unavailable.' });
  if (['contention', '40001', '40P01', '55P03'].includes(error?.code)) return reply.code(409).send({ error: 'contention', message: 'Refresh the view before trying again.' });
  return reply.code(500).send({ error: 'internal', message: 'The view could not be loaded.' });
}
export function register(app, { pool, auth, readPlayer }) {
  const content = coreProgressionContent();
  const enabled = process.env.WORLD_GRAPH_KERNEL === 'on';
  const knowledgeEnabled = enabled && process.env.COORDINATION_ENGINE === 'on' && process.env.COORDINATION_KNOWLEDGE === 'on';
  const sharingEnabled = knowledgeEnabled && process.env.COORDINATION_KNOWLEDGE_SHARING === 'on';
  const accountIds = (process.env.COORDINATION_ACCOUNT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const cohort = new Set(accountIds), policy = { enabled, knowledgeEnabled, sharingEnabled, accountIds };
  const kernel = createWorldKernel({ pool, registry: content.registry, objects: content.objects, ...policy });
  const knowledge = createCoordinationKnowledge({ enabled: knowledgeEnabled, sharingEnabled, accountIds });
  const query = createWorldKernelQuery({ pool, knowledge, registry: content.registry });
  const crafting = createCraftingContext({ registry: content.registry, knowledgeEnabled, sharingEnabled, accountIds,
    worldDefinitions: kernel.definitions });
  const familyOperations = createFamilyOperations({ pool, registry: content.registry, kernel,
    definitions: content.operations, prerequisitesEnabled: content.progression, ...policy,
    enabled: enabled && process.env.COORDINATION_ENGINE === 'on' && process.env.COORDINATION_OPERATIONS === 'on' });
  const service = createWorldProjection({ pool, query, kernel, knowledge, familyOperations, crafting, recipeIds: content.recipeIds });
  const admit = async (req) => {
    if (!enabled || (cohort.size && !cohort.has(req.user.sub))) throw new GameError('projection_unavailable', 'That view is unavailable.');
  };
  app.get('/v1/projections/player', { preHandler: auth, preValidation: validate(), errorHandler: safeError }, async (req) => {
    // Preserve the existing player accrual/read path. This is a separate snapshot from world.
    const result = await readPlayer(req.user.sub);
    return { schemaVersion: 1, asOf: Date.now(), player: result.character || result };
  });
  app.get('/v1/projections/world', { preHandler: [auth, admit], preValidation: validate(true), errorHandler: safeError }, (req) =>
    service.snapshot(req.user.sub, req.query?.operationId === undefined ? {} : { operationId: req.query.operationId }));
}
