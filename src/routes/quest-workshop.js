import { createQuestWorkshopService } from '../quest-workshop.js';
import { isDbDown } from '../dbhealth.js';

function safeError(error, _req, reply) {
  if (isDbDown(error)) return reply.code(503).send({ error: 'db_down', message: 'The database is temporarily unavailable.' });
  if (error?.code === 'unauthorized' || error?.statusCode === 401) return reply.code(401).send({ error: 'unauthorized', message: 'A valid bearer token is required.' });
  if (error?.code === 'workshop_unavailable') return reply.code(404).send({ error: error.code, message: error.message });
  if (['bad_workshop_request', 'unsolvable_workshop_mystery', 'workshop_author', 'workshop_not_solved', 'workshop_limit', 'no_character'].includes(error?.code)) {
    return reply.code(400).send({ error: error.code, message: error.message });
  }
  if (error?.statusCode >= 400 && error.statusCode < 500) return reply.code(error.statusCode).send({ error: 'bad_workshop_request', message: 'Invalid mystery request.' });
  return reply.code(500).send({ error: 'internal', message: 'The mystery request could not complete.' });
}

export function register(app, { pool, auth, service = null }) {
  const workshop = service || createQuestWorkshopService({ pool });
  const options = { preHandler: auth, errorHandler: safeError, bodyLimit: 8192,
    onRequest: async (_req, reply) => { reply.header('cache-control', 'no-store'); } };
  app.get('/v1/quest-workshop', options, (req) => workshop.board(req.user.sub));
  app.post('/v1/quest-workshop', options, (req) => workshop.create(req.user.sub, req.body));
  app.get('/v1/quest-workshop/:id', options, (req) => workshop.get(req.user.sub, req.params.id));
  app.post('/v1/quest-workshop/:id/publish', options, (req) => workshop.publish(req.user.sub, req.params.id, req.body));
  app.post('/v1/quest-workshop/:id/solve', options, (req) => workshop.solve(req.user.sub, req.params.id, req.body));
  app.post('/v1/quest-workshop/:id/rate', options, (req) => workshop.rate(req.user.sub, req.params.id, req.body));
  return workshop;
}
