import * as G from '../game.js';
import * as Seasons from '../businessseasons.js';
export function register(app, { pool, auth }) {
  app.get('/v1/company/seasons', { preHandler: auth }, req => G.readCharacter(pool, req.user.sub, (ch, client) => Seasons.businessSeasonBoard(client, ch.account_id)));
  app.post('/v1/company/seasons', { preHandler: auth }, req => G.withCharacter(pool, req.user.sub, (ch, client) => Seasons.createBusinessSeason(ch, req.body, req.headers['idempotency-key'], client)));
  app.post('/v1/company/seasons/enroll', { preHandler: auth }, req => G.withCharacter(pool, req.user.sub, (ch, client) => Seasons.enrollBusinessSeason(ch, req.body, client)));
  app.post('/v1/company/seasons/visibility', { preHandler: auth }, req => G.withCharacter(pool, req.user.sub, (ch, client) => Seasons.setBusinessSeasonVisibility(ch, req.body, client)));
  app.post('/v1/company/seasons/:id/observe', { preHandler: auth }, req => {
    if (req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) throw new G.GameError('business_season', 'terms');
    return G.withCharacter(pool, req.user.sub, (ch, client) => Seasons.observeBusinessSeason(ch, req.params.id, client));
  });
  app.get('/v1/company/seasons/public/:id', req => Seasons.publicBusinessSeason(pool, req.params.id));
}
