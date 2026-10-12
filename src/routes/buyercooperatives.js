import * as G from '../game.js';
import * as Cooperative from '../buyercooperatives.js';

export function register(app, { pool, auth }) {
  app.get('/v1/buyer-cooperatives/public', async () => ({ cooperatives: await Cooperative.publicBuyerCooperatives(pool) }));
  app.get('/v1/buyer-cooperatives', { preHandler: auth }, req =>
    G.withCharacterReadLocked(pool, req.user.sub, async (ch, client) => ({ ok: true, cooperatives: await Cooperative.buyerCooperativeBoard(client, ch.account_id), limits: Cooperative.BUYER_COOPERATIVE })));
  app.post('/v1/buyer-cooperatives', { preHandler: auth }, req =>
    G.withCharacter(pool, req.user.sub, (ch, client) => Cooperative.createBuyerCooperative(ch, req.body, req.headers['idempotency-key'], client)));
  for (const [action, execute] of [['fund', Cooperative.fundBuyerCooperative], ['launch', Cooperative.launchBuyerCooperative], ['settle', Cooperative.settleBuyerCooperative], ['claim', Cooperative.claimBuyerCooperative]]) {
    app.post(`/v1/buyer-cooperatives/:id/${action}`, { preHandler: auth }, req =>
      G.withCharacter(pool, req.user.sub, (ch, client, h) => execute(ch, req.params.id, req.body, req.headers['idempotency-key'], client, h)));
  }
}
