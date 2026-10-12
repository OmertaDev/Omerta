import { GameError } from '../game.js';
import { encounterBoard, startEncounter, takeEncounterTurn } from '../city-encounters.js';

export function registerCityEncounters(app, { pool, auth }) {
  const privateResponse = async (_req, reply) => { reply.header('Cache-Control','private, no-store'); reply.header('Vary','Authorization'); };
  const requireKey = async req => {
    if (!req._idem?.reservationToken || typeof req.headers['idempotency-key'] !== 'string')
      throw new GameError('idempotency_required','Use the reserved Idempotency-Key.');
  };
  const errorHandler = (error, _req, reply) => {
    const status = error?.statusCode === 401 ? 401 : ['contention','encounter_changed','encounter_identity_changed','encounter_already_active'].includes(error?.code) ? 409
      : ['item_commit_unknown','encounter_integrity'].includes(error?.code) || !(error instanceof GameError) ? 503 : 400;
    reply.header('Cache-Control','private, no-store'); reply.header('Vary','Authorization');
    return reply.code(status).send({ error: status===401?'unauthorized':error instanceof GameError?error.code:'encounter_unavailable',
      message:error?.code==='item_commit_unknown'?'The result is uncertain. Recover the same request key.':error instanceof GameError?error.message:'The encounter could not refresh.' });
  };
  const options = { onRequest:privateResponse,errorHandler };
  app.get('/v1/city/encounters',{ ...options,preHandler:auth }, req => {
    if (Object.keys(req.query||{}).length) throw new GameError('bad_encounter_request','This view belongs to your current character.');
    return encounterBoard(pool,req.user.sub);
  });
  app.post('/v1/city/encounters/start',{ ...options,preHandler:[auth,requireKey] }, req =>
    startEncounter(pool,req.user.sub,req.body,{ ...req._idem,accountId:req.user.sub }));
  app.post('/v1/city/encounters/:id/turn',{ ...options,preHandler:[auth,requireKey] }, req =>
    takeEncounterTurn(pool,req.user.sub,req.params.id,req.body,{ ...req._idem,accountId:req.user.sub }));
}
