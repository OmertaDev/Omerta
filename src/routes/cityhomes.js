import { cityHomes } from '../cityhomes.js';

export function registerCityHomes(app, { pool, auth }) {
  const privateResponse = async (_req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    reply.header('Vary', 'Authorization');
  };
  app.get('/v1/city/homes', { preHandler: auth, onRequest: privateResponse }, req =>
    cityHomes(pool, req.user.sub, req.query || {}));
}
