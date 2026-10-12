import * as G from '../game.js';
import * as Reputation from '../commercialreputation.js';

export function register(app, { pool, auth }) {
  app.get('/v1/company/reputation', { preHandler: auth }, req => G.readCharacter(pool, req.user.sub,
    (ch, client) => Reputation.ownCommercialReputation(ch, client)));
  app.post('/v1/company/reputation', { preHandler: auth }, req => G.withCharacter(pool, req.user.sub,
    (ch, client) => Reputation.setCommercialReputation(ch, req.body, client)));
  app.post('/v1/company/reputation/refresh', { preHandler: auth }, req => {
    if (req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) throw new G.GameError('commercial_reputation', 'terms');
    return G.withCharacter(pool, req.user.sub, (ch, client) => Reputation.refreshCommercialReputation(ch, client));
  });
  app.get('/v1/company/reputation/public/:accountId', req => Reputation.publicCommercialReputation(pool, req.params.accountId));
}
