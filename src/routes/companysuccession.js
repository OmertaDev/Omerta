import * as G from '../game.js';
import * as Succession from '../companysuccession.js';

export function register(app, { pool, auth }) {
  app.get('/v1/company-succession', { preHandler: auth }, req =>
    G.withCharacterReadLocked(pool, req.user.sub, async (ch, client) => ({ ok: true, succession: await Succession.companySuccessionBoard(client, ch.account_id) })));
  app.post('/v1/company-succession', { preHandler: auth }, req =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Succession.resumeCompany(ch, req.body, req.headers['idempotency-key'], client, h)));
}
