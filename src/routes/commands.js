import { createPlayerCommandEngine } from '../player-commands.js';
import { coreProgressionContent } from '../content/core-progression.js';
import { isDbDown } from '../dbhealth.js';
import { createConfiguredDirector } from '../director/config.js';
import { recordWorldObservation, recordWorldCommand, commandConsequenceReferences } from '../world-telemetry.js';

const invalid = () => { const error = new Error('Invalid command request'); error.code = 'bad_command_request'; throw error; };

function safeError(error, _req, reply) {
  reply.header('cache-control', 'no-store');
  if (error?.statusCode === 401) return reply.code(401).send({ error: 'unauthorized', message: 'A valid bearer token is required.' });
  if (isDbDown(error)) return reply.code(503).send({ error: 'db_down', message: 'Retry this move using its original identity.' });
  if (error?.code === 'bad_command_request' || error?.validation)
    return reply.code(400).send({ error: 'bad_command_request', message: 'Invalid command request.' });
  if (error?.code === 'command_confirmation_required')
    return reply.code(409).send({ error: 'command_confirmation_required', message: 'Confirm this move before continuing.' });
  if (['item_commit_unknown', 'item_recovery_required'].includes(error?.code))
    return reply.code(503).send({ error: 'command_reconcile', message: 'Retry this move using its original identity.' });
  // Never echo a domain error, requirement, target or hidden prerequisite.
  if (error?.code) return reply.code(409).send({ error: 'command_unavailable', message: 'Refresh your commands before trying again.' });
  return reply.code(500).send({ error: 'internal', message: 'Retry this move using its original identity.' });
}

export function register(app, { pool, auth, receiptTrust = null }) {
  const enabled = process.env.WORLD_GRAPH_KERNEL === 'on';
  const discoveryEnabled = enabled && process.env.COORDINATION_ENGINE === 'on';
  const knowledgeEnabled = discoveryEnabled && process.env.COORDINATION_KNOWLEDGE === 'on';
  const content = coreProgressionContent();
  const director = createConfiguredDirector(pool, content);
  const service = createPlayerCommandEngine({ pool, content, director, enabled, discoveryEnabled,
    operationsEnabled: discoveryEnabled && process.env.COORDINATION_OPERATIONS === 'on', knowledgeEnabled,
    sharingEnabled: knowledgeEnabled && process.env.COORDINATION_KNOWLEDGE_SHARING === 'on',
    accountIds: (process.env.COORDINATION_ACCOUNT_IDS || '').split(',').map((id) => id.trim()).filter(Boolean) });
  const options = { preHandler: auth, errorHandler: safeError,
    preValidation: async (req, reply) => {
      reply.header('cache-control', 'no-store');
      if (Object.entries(req.query || {}).some(([key, value]) => !['operationId', 'mysteryGraphId'].includes(key)
        || typeof value !== 'string' || !/^[\x21-\x7e]{1,160}$/.test(value))) invalid();
    } };
  app.get('/v1/commands', options, async (req) => {
    const board = await service.snapshot(req.user.sub, { ...req.query });
    await recordWorldCommand(pool, req.user.sub, { phase: 'issued', count: board.commands.filter((command) => command.executionIdentity).length });
    return board;
  });
  // Presentation observations are untrusted, bounded counters. They never feed
  // admission, discovery, selection, or command execution.
  app.post('/v1/commands/observations', { preHandler: auth, errorHandler: safeError }, async (req) => {
    if (Object.keys(req.query || {}).length) invalid();
    await recordWorldObservation(pool, req.user.sub, req.body);
    return { ok: true };
  });
  app.post('/v1/commands/execute', { ...options,
    ...(typeof receiptTrust === 'symbol' ? { config: { coordinationReceipts: receiptTrust, currentCommandProjection: receiptTrust } } : {}),
    preValidation: async (req, reply) => {
      reply.header('cache-control', 'no-store');
      if (Object.keys(req.query || {}).length || !req.body || typeof req.body !== 'object' || Array.isArray(req.body)
        || Object.keys(req.body).sort().join(',') !== 'confirmed,executionId') invalid();
    } }, async (req) => {
      try {
        const result = await service.execute(req.user.sub, { executionId: req.body.executionId, confirmed: req.body.confirmed }, req.headers['idempotency-key']);
        await recordWorldCommand(pool, req.user.sub, { phase: 'completed', executionId: req.body.executionId, replayed: result.replayed,
          consequenceReferences: commandConsequenceReferences(result) });
        return result;
      } catch (error) {
        await recordWorldCommand(pool, req.user.sub, { phase: 'rejected', executionId: req.body.executionId, reason: error?.code });
        throw error;
      }
    });
}
