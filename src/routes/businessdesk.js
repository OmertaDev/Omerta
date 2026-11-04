import { withCharacterReadLocked } from '../game.js';
import { businessDesk, businessDeskLimit } from '../businessdesk.js';

export function register(app, { pool, auth }) {
  if (typeof pool?.connect !== 'function' || typeof auth !== 'function') throw new Error('Business desk requires authenticated canonical read transactions.');
  app.get('/v1/company/desk', { preHandler: auth }, (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const limit = businessDeskLimit(req.query);
    return withCharacterReadLocked(pool, req.user.sub, (ch, client) => businessDesk(client, ch, limit));
  });
}
