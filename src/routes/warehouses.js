import * as G from '../game.js';
import * as Warehouse from '../warehouseleases.js';
import { guardDelegatedControl } from '../operatingpolicy.js';

export function register(app, { pool, auth }) {
  app.get('/v1/warehouses', { preHandler: auth }, async req =>
    G.readCharacter(pool, req.user.sub, async (ch, client) => ({
      offers: await Warehouse.warehouseOffers(client), leases: await Warehouse.warehouseLeaseBoard(client, ch),
      limits: Warehouse.WAREHOUSE, gameCashOnly: true,
    })));
  app.post('/v1/depot/:id/warehouse-offer', { preHandler: auth }, async req =>
    G.withCharacter(pool, req.user.sub, async (ch, client) => {
      await guardDelegatedControl(client, req.params.id, req.user.agent === true);
      return Warehouse.configureWarehouseOffer(ch, req.params.id, req.body, client);
    }));
  app.post('/v1/warehouses/:id/lease', { preHandler: auth }, async req => {
    const owner = (await pool.query("SELECT owner_character FROM business_depots WHERE id=$1 AND status='open'", [req.params.id])).rows[0];
    if (!owner) throw new G.GameError('no_depot', 'No operating warehouse.');
    return G.withTwoCharacters(pool, req.user.sub, owner.owner_character, (ch, landlord, client, h) =>
      Warehouse.leaseWarehouse(ch, landlord, req.params.id, req.body, client, h));
  });
  app.post('/v1/warehouse-leases/:id/deposit', { preHandler: auth }, async req =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Warehouse.depositWarehouseCargo(ch, req.params.id, req.body?.qty, client, h)));
  app.post('/v1/warehouse-leases/:id/withdraw', { preHandler: auth }, async req =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Warehouse.withdrawWarehouseCargo(ch, req.params.id, req.body?.qty, client, h)));
  app.post('/v1/warehouse-leases/:id/close', { preHandler: auth }, async req =>
    G.withCharacter(pool, req.user.sub, (ch, client) => Warehouse.closeWarehouseLease(ch, req.params.id, client)));
}
