import { GameError } from '../game.js';
import { isDbDown } from '../dbhealth.js';
import { createWorldKernel } from '../world-kernel.js';
import { createFamilyOperations } from '../coordination/operations.js';
import { coreProgressionContent } from '../content/core-progression.js';

const canonical = (value) => typeof value === 'string' && /^[\x21-\x7e]{1,160}$/.test(value);
const invalid = () => { throw new GameError('bad_coordination_operation_request', 'Invalid operation request.'); };
const ACTION_FIELDS = Object.freeze({ publish: [], join: ['roleId'], assign: ['roleId', 'accountId'], leave: [], commit: ['requirementId'],
  contribute: ['requirementId'], withdraw: ['requirementId'], approve: [], execute: [], cancel: [], expire: [] });
function validate(mutation = false, create = false) {
  return async (req, reply) => {
    reply.header('cache-control', 'no-store');
    if (Object.keys(req.query || {}).length || Object.values(req.params || {}).some((v) => !canonical(v))) invalid();
    if (!mutation) return;
    if (!canonical(req.headers['idempotency-key'])) invalid();
    const required = create ? ['definitionId'] : ACTION_FIELDS[req.params.action];
    if (!required) invalid();
    const optional = req.params.action === 'contribute' ? ['itemId'] : [];
    const body = req.body === undefined ? {} : req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || required.some((field) => !Object.hasOwn(body, field))
      || Object.entries(body).some(([field, value]) => ![...required, ...optional].includes(field) || !canonical(value))) invalid();
  };
}
function safeError(error, _req, reply) {
  if (error?.statusCode === 401) return reply.code(401).send({ error: 'unauthorized', message: 'A valid bearer token is required.' });
  if (isDbDown(error)) return reply.code(503).send({ error: 'db_down', message: 'The database is temporarily unavailable.' });
  const code = error?.code;
  if (code === 'coordination_operation_unavailable') return reply.code(404).send({ error: code, message: 'That operation is unavailable.' });
  if (code === 'coordination_operation_forbidden') return reply.code(403).send({ error: code, message: 'That operation action is unavailable.' });
  if (['contention', 'idempotency_conflict', 'item_idempotency_conflict', 'world_stale', 'coordination_operation_closed',
    'coordination_operation_expired', 'coordination_operation_not_ready', 'coordination_operation_role',
    'coordination_operation_commitment'].includes(code)) return reply.code(409).send({ error: code, message: 'Refresh the operation before trying again.' });
  if (['item_commit_unknown', 'item_recovery_required', 'coordination_operation_definition_changed', 'world_definition_changed'].includes(code))
    return reply.code(503).send({ error: code, message: 'Reconcile this action using its original key.' });
  if (['bad_coordination_operation_request', 'coordination_operation_requirements', 'capital_cash', 'capital_overflow',
    'materials', 'item_unavailable', 'item_not_owned', 'world_unavailable', 'world_forbidden'].includes(code) || error?.validation)
    return reply.code(400).send({ error: 'coordination_operation_requirements', message: 'The operation requirements are not satisfied.' });
  return reply.code(500).send({ error: 'internal', message: 'The operation request could not complete.' });
}
export function register(app, { pool, auth, receiptTrust = null }) {
  const content = coreProgressionContent();
  const enabled = process.env.COORDINATION_OPERATIONS === 'on' && process.env.COORDINATION_ENGINE === 'on'
    && process.env.WORLD_GRAPH_KERNEL === 'on';
  const knowledgeEnabled = enabled && process.env.COORDINATION_KNOWLEDGE === 'on';
  const sharingEnabled = knowledgeEnabled && process.env.COORDINATION_KNOWLEDGE_SHARING === 'on';
  const accountIds = (process.env.COORDINATION_ACCOUNT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const policy = { enabled, knowledgeEnabled, sharingEnabled, accountIds };
  const kernel = createWorldKernel({ pool, registry: content.registry, objects: content.objects, ...policy });
  const service = createFamilyOperations({ pool, registry: content.registry, kernel, definitions: content.operations,
    prerequisitesEnabled: content.progression, ...policy });
  const cohort = new Set(accountIds);
  const admit = async (req) => {
    if (!enabled || (cohort.size && !cohort.has(req.user.sub))) throw new GameError('coordination_operation_unavailable', 'Operation unavailable.');
  };
  const options = (mutation = false, create = false) => ({ preHandler: [auth, admit],
    preValidation: validate(mutation, create), errorHandler: safeError,
    ...(mutation && typeof receiptTrust === 'symbol' ? { config: { coordinationReceipts: receiptTrust } } : {}) });
  app.get('/v1/coordination/operations', options(), (req) => service.catalog(req.user.sub));
  app.get('/v1/coordination/operations/:operationId', options(), (req) => service.get(req.user.sub, req.params.operationId));
  app.post('/v1/coordination/operations', options(true, true), (req) => service.create(req.user.sub, req.body, req.headers['idempotency-key']));
  app.post('/v1/coordination/operations/:operationId/actions/:action', options(true), (req) =>
    service.command(req.user.sub, req.params.operationId, req.params.action, req.body ?? {}, req.headers['idempotency-key']));
}
