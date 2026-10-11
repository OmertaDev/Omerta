import * as G from '../game.js';
import * as Tender from '../supplytenders.js';
import { guardDelegatedControl } from '../operatingpolicy.js';

export function register(app, { pool, auth }) {
  app.get('/v1/supply-tenders', { preHandler: auth }, async req =>
    G.readCharacter(pool, req.user.sub, (ch, client) => Tender.supplyTenderBoard(client, ch)));
  app.post('/v1/depot/:id/orders/:orderId/tender', { preHandler: auth }, async req =>
    G.withCharacter(pool, req.user.sub, async (ch, client) => {
      await guardDelegatedControl(client, req.params.id, req.user.agent === true);
      return Tender.publishSupplyTender(ch, req.params.id, req.params.orderId, req.body, client);
    }));
  app.post('/v1/supply-tenders/:id/offers', { preHandler: auth }, async req => {
    const tender = (await pool.query('SELECT buyer_character FROM supply_tenders WHERE id=$1', [req.params.id])).rows[0];
    if (!tender) throw new G.GameError('supply_tender', 'No supply tender.');
    return G.withTwoCharacters(pool, req.user.sub, tender.buyer_character, (supplier, buyer, client) =>
      Tender.offerSupplyTender(supplier, buyer, req.params.id, req.body, client));
  });
  app.post('/v1/supply-tenders/:id/offers/:offerId/award', { preHandler: auth }, async req => {
    const offer = (await pool.query('SELECT supplier_character FROM supply_tender_offers WHERE id=$1 AND tender_id=$2',
      [req.params.offerId, req.params.id])).rows[0];
    if (!offer) throw new G.GameError('supply_tender', 'No supply offer.');
    return G.withTwoCharacters(pool, req.user.sub, offer.supplier_character, async (buyer, supplier, client) => {
      const tender = (await client.query('SELECT depot_id FROM supply_tenders WHERE id=$1 AND buyer_character=$2', [req.params.id, buyer.id])).rows[0];
      if (!tender) throw new G.GameError('supply_tender', 'No supply tender of yours.');
      await guardDelegatedControl(client, tender.depot_id, req.user.agent === true);
      return Tender.awardSupplyTender(buyer, supplier, req.params.id, req.params.offerId, client);
    });
  });
  app.post('/v1/supply-tenders/:id/offers/withdraw', { preHandler: auth }, async req =>
    G.withCharacter(pool, req.user.sub, (ch, client) => Tender.withdrawSupplyOffer(ch, req.params.id, client)));
  app.post('/v1/supply-tenders/:id/cancel', { preHandler: auth }, async req =>
    G.withCharacter(pool, req.user.sub, async (ch, client) => {
      const tender = (await client.query('SELECT depot_id FROM supply_tenders WHERE id=$1 AND buyer_character=$2', [req.params.id, ch.id])).rows[0];
      if (!tender) throw new G.GameError('supply_tender', 'No supply tender of yours.');
      await guardDelegatedControl(client, tender.depot_id, req.user.agent === true);
      return Tender.cancelSupplyTender(ch, req.params.id, client);
    }));
}
