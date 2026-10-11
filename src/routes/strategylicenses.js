import * as G from '../game.js';
import * as Strategy from '../strategylicenses.js';

function emptyBody(body) {
  if (body != null && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length))
    throw new G.GameError('strategy_license', 'This action accepts no payment or authority fields.');
}

export function register(app, { pool, auth }) {
  app.get('/v1/strategies', async () => ({ ok: true, strategies: await Strategy.strategyCatalog(pool) }));
  app.get('/v1/strategies/library', { preHandler: auth }, req =>
    G.withCharacterReadLocked(pool, req.user.sub, async (ch, client) => ({ ok: true, strategies: await Strategy.strategyLibrary(client, ch.account_id) })));
  app.post('/v1/strategies', { preHandler: auth }, req =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Strategy.publishStrategy(ch, req.body, req.headers['idempotency-key'], client, h)));
  app.post('/v1/strategies/:id/buy', { preHandler: auth }, async req => {
    emptyBody(req.body);
    const owned = (await pool.query('SELECT id FROM strategy_licenses WHERE version_id=$1 AND buyer_account=$2', [req.params.id, req.user.sub])).rows[0];
    if (owned) return G.withCharacter(pool, req.user.sub, (buyer, client, h) =>
      Strategy.buyStrategy(buyer, null, req.params.id, req.headers['idempotency-key'], client, h));
    const version = (await pool.query('SELECT seller_character FROM strategy_versions WHERE id=$1', [req.params.id])).rows[0];
    if (!version) throw new G.GameError('strategy_license', 'No strategy version.');
    return G.withTwoCharacters(pool, req.user.sub, version.seller_character, (buyer, seller, client, h) =>
      Strategy.buyStrategy(buyer, seller, req.params.id, req.headers['idempotency-key'], client, h), { meet: false });
  });
  app.post('/v1/strategies/:id/resolve', { preHandler: auth }, req => {
    emptyBody(req.body);
    return G.withCharacter(pool, req.user.sub, (ch, client) => Strategy.resolveStrategyHoldout(ch, req.params.id, client));
  });
}
