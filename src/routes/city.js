import { GameError } from '../game.js';
import { cityPresence, cityIntel, recordCityEncounter, validateEncounterBody } from '../city-presence.js';

export function registerCity(app, { pool, auth, onlineIds = () => [] }) {
  const privateResponse = async (_req, reply) => { reply.header('Cache-Control', 'private, no-store'); reply.header('Vary', 'Authorization'); };
  app.get('/v1/city/presence', { preHandler: auth, onRequest: privateResponse }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return cityPresence(pool, req.user.sub, onlineIds(), req.query || {});
  });
  app.get('/v1/city/intel', { preHandler: auth, onRequest: privateResponse }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return cityIntel(pool, req.user.sub);
  });
  app.post('/v1/city/encounters/:actorId', { preHandler: auth, onRequest: privateResponse, preValidation: async req => {
    validateEncounterBody(req.body);
    if (typeof req.headers['idempotency-key'] !== 'string') throw new GameError('idempotency_required', 'Supply an Idempotency-Key.');
  } }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return recordCityEncounter(pool, req.user.sub, req.params.actorId, req.body, req.headers['idempotency-key']);
  });
}
