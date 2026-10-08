import * as G from '../game.js';
import * as Delivery from '../delivery.js';
export function register(app, { pool, auth }) {
  app.get('/v1/deliveries', { preHandler: auth }, async (req) =>
    G.readCharacter(pool, req.user.sub, async (ch, client) => ({ commitments: await Delivery.deliveryBoard(client, ch), limits: Delivery.DELIVERY })));
  app.post('/v1/market/:id/accept-delivery', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client) => Delivery.acceptDelivery(ch, req.params.id, req.body, client)));
  app.post('/v1/deliveries/:id/deliver', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Delivery.deliverCommitment(ch, req.params.id, req.body?.qty, client, h)));
  app.post('/v1/deliveries/:id/expire', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client) => Delivery.expireCommitment(ch, req.params.id, client)));
}
