import * as G from '../game.js';
import * as League from '../strategyleagues.js';

function emptyBody(body) {
  if (body != null && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length))
    throw new G.GameError('strategy_league', 'This benchmark action accepts no private rule or funding fields.');
}

export function register(app, { pool, auth }) {
  app.get('/v1/strategy-leagues', async () => ({ ok: true, leagues: await League.strategyLeagueBoard(pool) }));
  app.get('/v1/strategy-leagues/own', { preHandler: auth }, req =>
    G.withCharacterReadLocked(pool, req.user.sub, async (ch, client) => ({ ok: true, leagues: await League.strategyLeagueBoard(client, ch.account_id) })));
  app.post('/v1/strategy-leagues', { preHandler: auth }, req =>
    G.withCharacter(pool, req.user.sub, (ch, client) => League.createStrategyLeague(ch, req.body, req.headers['idempotency-key'], client)));
  app.post('/v1/strategy-leagues/:id/join', { preHandler: auth }, req =>
    G.withCharacter(pool, req.user.sub, (ch, client) => League.joinStrategyLeague(ch, req.params.id, req.body, client)));
  for (const [action, command] of [['start', League.startStrategyLeague], ['resolve', League.resolveStrategyLeague]]) {
    app.post(`/v1/strategy-leagues/:id/${action}`, { preHandler: auth }, req => {
      emptyBody(req.body);
      return G.withCharacter(pool, req.user.sub, (ch, client) => command(ch, req.params.id, client));
    });
  }
}
