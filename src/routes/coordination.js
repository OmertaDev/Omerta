// Phase 0 coordination HTTP boundary. Owner identity comes only from authenticated
// requests; inputs contain issued hashes/actions and optimistic revisions.
import { GameError } from '../game.js';
import { isDbDown } from '../dbhealth.js';
import { COORDINATION_SCHEMAS } from '../agentgateway.js';
import { createCoordinationService } from '../coordination/runtime.js';
import { coreProgressionContent } from '../content/core-progression.js';
import { KNOWLEDGE_INPUTS, KNOWLEDGE_QUERIES } from '../coordination/http-contract.js';

const identifier = { type: 'string', minLength: 1, maxLength: 200, pattern: '^[!-~]+$' };
const revision = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
const createBody = { type: 'object', additionalProperties: false, required: ['expectedContentHash'],
  properties: { expectedContentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' } } };
const actBody = { type: 'object', additionalProperties: false, required: ['expectedRevision', 'actionId'],
  properties: { expectedRevision: revision, actionId: identifier } };
const cancelBody = { type: 'object', additionalProperties: false, required: ['expectedRevision'],
  properties: { expectedRevision: revision } };
const fail = () => { throw new GameError('bad_coordination_request', 'Invalid coordination request.'); };
const canonical = (value) => typeof value === 'string' && /^[!-~]{1,200}$/.test(value);

function strictInput(shape, queryShape) {
  return async (req, reply) => {
    reply.header('cache-control', 'no-store');
    for (const [key, value] of Object.entries(req.query || {})) {
      if (!queryShape?.properties[key] || typeof value !== 'string') fail();
      if (key === 'limit' && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(value)) fail();
      if (key === 'cursor' && !/^[A-Za-z0-9_-]{1,2048}$/.test(value)) fail();
      if (key === 'characterName' && (value.length < 2 || value.length > 24
          || value.trim() !== value || /[\u0000-\u001f\u007f-\u009f]/.test(value))) fail();
    }
    if (Object.values(req.params || {}).some((value) => !canonical(value))) fail();
    if (!shape) return;
    const value = req.body;
    // preValidation observes the parsed JSON before Fastify strips extra fields or
    // coerces values. A string revision is not a numeric optimistic-lock token.
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).length !== shape.required.length
        || shape.required.some((key) => !Object.hasOwn(value, key))) fail();
    if (Object.hasOwn(value, 'expectedRevision')
        && (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0)) fail();
    if (Object.hasOwn(value, 'actionId') && !canonical(value.actionId)) fail();
    if (Object.hasOwn(value, 'expectedContentHash')
        && (typeof value.expectedContentHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.expectedContentHash))) fail();
    if (Object.hasOwn(value, 'expectedAclRevision')
        && (!Number.isInteger(value.expectedAclRevision) || value.expectedAclRevision < 0
          || value.expectedAclRevision > 2_147_483_647)) fail();
    if (Object.hasOwn(value, 'targetId') && (typeof value.targetId !== 'string'
        || !/^[A-Za-z0-9_-]{1,2048}$/.test(value.targetId))) fail();
    for (const key of ['grantId', 'claimId', 'fromClaimId', 'toClaimId']) {
      if (Object.hasOwn(value, key) && !canonical(value[key])) fail();
    }
    if (Object.hasOwn(value, 'relation') && !['corroborates', 'contradicts'].includes(value.relation)) fail();
  };
}
async function requireKey(req) {
  if (!canonical(req.headers['idempotency-key'])) fail();
}

function safeError(error, _req, reply) {
  const code = error?.code;
  if (isDbDown(error)) {
    return reply.code(503).header('retry-after', 15).send({ error: 'db_down', message: 'The database is temporarily unavailable.' });
  }
  if (['coordination_unavailable', 'coordination_action_unavailable', 'knowledge_unavailable'].includes(code)) {
    return reply.code(404).send({ error: 'coordination_unavailable', message: 'That coordination instance or action is unavailable.' });
  }
  if (['stale_coordination', 'stale_coordination_content', 'stale_coordination_acl', 'coordination_key_reuse',
    'coordination_knowledge_limit', 'knowledge_stale_acl', 'knowledge_stale_target', 'knowledge_limit', 'contention'].includes(code)) {
    return reply.code(409).send({ error: code, message: 'Refresh the coordination board before trying again.' });
  }
  if (['coordination_disabled', 'knowledge_disabled', 'knowledge_sharing_disabled'].includes(code)) {
    return reply.code(503).send({ error: code, message: 'Coordination is not enabled for this account.' });
  }
  if (code === 'content_commit_unknown') {
    return reply.code(503).send({ error: 'coordination_commit_unknown', message: 'The result is uncertain. Retry the same logical command key.' });
  }
  if (['bad_coordination_request', 'bad_knowledge_request', 'bad_knowledge_cursor'].includes(code) || error?.validation
      || (error?.statusCode >= 400 && error.statusCode < 500)) {
    // Authentication failures still use the existing bearer authority perimeter.
    if (error?.statusCode === 401) return reply.code(401).send({ error: 'unauthorized', message: 'A valid bearer token is required.' });
    return reply.code(400).send({ error: 'bad_coordination_request', message: 'Invalid coordination request.' });
  }
  // Do not reflect SQL, stored definitions, private state, or exception data.
  return reply.code(500).send({ error: 'internal', message: 'The coordination request could not complete.' });
}

const fastifySchema = (value) => JSON.parse(JSON.stringify(value).replaceAll('#/components/schemas/', ''));

export function register(app, { pool, auth, modAuth, service = null, receiptTrust = null }) {
  const content = coreProgressionContent();
  const coordination = service || createCoordinationService({
    pool, registry: content.coordinationRegistry, prerequisitesEnabled: content.progression,
    enabled: process.env.COORDINATION_ENGINE === 'on',
    knowledgeEnabled: process.env.COORDINATION_KNOWLEDGE === 'on',
    sharingEnabled: process.env.COORDINATION_KNOWLEDGE_SHARING === 'on',
    accountIds: (process.env.COORDINATION_ACCOUNT_IDS || '').split(',').map((id) => id.trim()).filter(Boolean),
  });
  for (const [name, schema] of Object.entries(COORDINATION_SCHEMAS)) {
    app.addSchema({ $id: name, ...fastifySchema(schema) });
  }
  const options = (response, { body, admin = false, param, query } = {}) => ({
    ...(body && typeof receiptTrust === 'symbol' ? { config: { coordinationReceipts: receiptTrust } } : {}),
    preHandler: body ? [auth, requireKey] : admin ? modAuth : auth,
    preValidation: strictInput(body, query), errorHandler: safeError,
    schema: {
      ...(body ? { body } : {}),
      ...(query ? { querystring: query } : {}),
      ...(param ? { params: { type: 'object', additionalProperties: false, required: [param],
        properties: { [param]: identifier } } } : {}),
      response: { 200: { $ref: `${response}#` },
        '4xx': { $ref: 'CoordinationError#' }, '5xx': { $ref: 'CoordinationError#' } },
    },
  });
  app.get('/v1/coordination', options('CoordinationCatalog'), (req) => coordination.catalog(req.user.sub));
  app.post('/v1/coordination/:graphId/instances', options('CoordinationReceipt', { body: createBody, param: 'graphId' }),
    (req) => coordination.create(req.user.sub, req.params.graphId, req.body, req.headers['idempotency-key']));
  app.get('/v1/coordination/instances/:instanceId', options('CoordinationInstance', { param: 'instanceId' }),
    (req) => coordination.get(req.user.sub, req.params.instanceId));
  app.post('/v1/coordination/instances/:instanceId/act', options('CoordinationReceipt', { body: actBody, param: 'instanceId' }),
    (req) => coordination.act(req.user.sub, req.params.instanceId, req.body, req.headers['idempotency-key']));
  app.post('/v1/coordination/instances/:instanceId/cancel', options('CoordinationReceipt', { body: cancelBody, param: 'instanceId' }),
    (req) => coordination.cancel(req.user.sub, req.params.instanceId, req.body, req.headers['idempotency-key']));
  app.get('/v1/mod/coordination/metrics', options('CoordinationMetrics', { admin: true }), () => coordination.metrics());
  const page = (req) => ({ ...(req.query.cursor ? { cursor: req.query.cursor } : {}),
    ...(req.query.limit ? { limit: Number(req.query.limit) } : {}) });
  app.get('/v1/coordination/knowledge', options('CoordinationKnowledgeBoard', { query: KNOWLEDGE_QUERIES.page }),
    (req) => coordination.knowledgeBoard(req.user.sub, page(req)));
  app.get('/v1/coordination/knowledge/targets', options('CoordinationKnowledgeTargets', { query: KNOWLEDGE_QUERIES.targets }),
    (req) => coordination.knowledgeTargets(req.user.sub, { ...req.query }));
  app.get('/v1/coordination/knowledge/archive', options('CoordinationKnowledgeArchive', { query: KNOWLEDGE_QUERIES.page }),
    (req) => coordination.knowledgeArchive(req.user.sub, page(req)));
  app.get('/v1/coordination/knowledge/:claimId', options('CoordinationKnowledgeDetail', { param: 'claimId' }),
    (req) => coordination.knowledgeGet(req.user.sub, req.params.claimId));
  app.post('/v1/coordination/knowledge/:claimId/share', options('CoordinationKnowledgeClaimReceipt', { body: KNOWLEDGE_INPUTS.share, param: 'claimId' }),
    (req) => coordination.shareKnowledge(req.user.sub, req.params.claimId, req.body, req.headers['idempotency-key']));
  app.post('/v1/coordination/knowledge/:claimId/revoke', options('CoordinationKnowledgeClaimReceipt', { body: KNOWLEDGE_INPUTS.revoke, param: 'claimId' }),
    (req) => coordination.revokeKnowledge(req.user.sub, req.params.claimId, req.body, req.headers['idempotency-key']));
  app.post('/v1/coordination/knowledge/links', options('CoordinationKnowledgeLinkReceipt', { body: KNOWLEDGE_INPUTS.link }),
    (req) => coordination.linkKnowledge(req.user.sub, req.body, req.headers['idempotency-key']));
  app.post('/v1/coordination/knowledge/archive', options('CoordinationKnowledgeArchiveReceipt', { body: KNOWLEDGE_INPUTS.archive }),
    (req) => coordination.archiveKnowledge(req.user.sub, req.body, req.headers['idempotency-key']));
  app.post('/v1/coordination/knowledge/rebuild', options('CoordinationKnowledgeRebuildReceipt', { body: KNOWLEDGE_INPUTS.rebuild }),
    (req) => coordination.rebuildKnowledge(req.user.sub, req.body, req.headers['idempotency-key']));
}
