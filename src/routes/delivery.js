import * as G from '../game.js';
import * as Delivery from '../delivery.js';
import { supplierHistory } from '../supplierhistory.js';
export function register(app, { pool, auth }) {
  app.get('/v1/deliveries', { preHandler: auth }, async (req) =>
    G.readCharacter(pool, req.user.sub, async (ch, client) => {
      const commitments = await Delivery.deliveryBoard(client, ch);
      return { commitments, limits: Delivery.DELIVERY, supplierHistory: supplierHistory(commitments, ch.id) };
    }));
  app.post('/v1/market/:id/accept-delivery', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client) => Delivery.acceptDelivery(ch, req.params.id, req.body, client)));
  app.post('/v1/deliveries/:id/deliver', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Delivery.deliverCommitment(ch, req.params.id, req.body?.qty, client, h)));
  app.post('/v1/deliveries/:id/expire', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client) => Delivery.expireCommitment(ch, req.params.id, client)));
  app.post('/v1/deliveries/:id/depot/:depotId/buy', { preHandler: auth }, async (req) => {
    const owner = (await pool.query("SELECT owner_character FROM business_depots WHERE id=$1 AND status='open'", [req.params.depotId])).rows[0];
    if (!owner) throw new G.GameError('no_depot', 'No operating storefront.');
    return G.withTwoCharacters(pool, req.user.sub, owner.owner_character, (ch, seller, client, h) =>
      Delivery.buyCommittedFromDepot(ch, seller, req.params.id, req.params.depotId, req.body, client, h));
  });
}
