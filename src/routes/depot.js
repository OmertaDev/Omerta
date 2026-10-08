import * as Depot from '../depot.js';
import * as G from '../game.js';
import { setOperatingPolicy, guardDelegatedControl, recordExternalCost } from '../operatingpolicy.js';

export function register(app, { pool, auth }) {
  const controlled = (req, fn) => G.withCharacter(pool, req.user.sub, async (ch, client, h) => {
    await guardDelegatedControl(client, req.params.id, req.user.agent === true);
    return fn(ch, client, h);
  });
  const ownerOnly = async (req) => { if (req.user.agent === true) throw new G.GameError('owner_authority', 'Use the separate owner session to authorize policies or declare outside costs.'); };
  app.post('/v1/depot/:id/policy', { preHandler: [auth, ownerOnly] }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client) => setOperatingPolicy(ch, req.params.id, req.body, client)));
  app.post('/v1/depot/:id/external-costs', { preHandler: [auth, ownerOnly] }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client) => recordExternalCost(ch, req.params.id, req.body, client)));
  app.get('/v1/depots', async () => ({ enabled: Depot.depotPilotEnabled(), catalog: Depot.DEPOT, businesses: await Depot.depotBoard(pool) }));
  app.get('/v1/depot', { preHandler: auth }, async (req) =>
    G.readCharacter(pool, req.user.sub, async (ch, client, h) => ({ depot: await Depot.depotState(client, ch, h) })));
  app.post('/v1/depot', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Depot.openDepot(ch, req.body, client, h)));
  app.post('/v1/depot/:id/configure', { preHandler: auth }, async (req) =>
    controlled(req, (ch, client) => Depot.configureDepot(ch, req.params.id, req.body, client)));
  app.post('/v1/depot/:id/fund', { preHandler: auth }, async (req) =>
    controlled(req, (ch, client, h) => Depot.fundDepot(ch, req.params.id, req.body?.amount, client, h)));
  app.post('/v1/depot/:id/withdraw', { preHandler: auth }, async (req) =>
    controlled(req, (ch, client, h) => Depot.withdrawDepot(ch, req.params.id, req.body?.amount, client, h)));
  app.post('/v1/depot/:id/restock', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Depot.restockDepot(ch, req.params.id, client, h,
      { automated: req.user.agent === true, policyId: req.body?.policyId })));
  app.post('/v1/depot/:id/orders/:orderId/receive', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client) => Depot.receiveDepot(ch, req.params.id, req.params.orderId, client,
      { automated: req.user.agent === true, policyId: req.body?.policyId })));
  app.post('/v1/depot/:id/orders/:orderId/cancel', { preHandler: auth }, async (req) =>
    controlled(req, (ch, client, h) => Depot.cancelDepotOrder(ch, req.params.id, req.params.orderId, client, h)));
  app.post('/v1/depot/:id/stock/withdraw', { preHandler: auth }, async (req) =>
    controlled(req, (ch, client, h) => Depot.withdrawDepotStock(ch, req.params.id, req.body?.qty, client, h)));
  app.post('/v1/depot/:id/close', { preHandler: auth }, async (req) =>
    controlled(req, (ch, client, h) => Depot.closeDepot(ch, req.params.id, client, h)));
  app.post('/v1/depot/:id/buy', { preHandler: auth }, async (req) => {
    const row = (await pool.query("SELECT owner_character FROM business_depots WHERE id=$1 AND status='open'", [req.params.id])).rows[0];
    if (!row) throw new G.GameError('no_depot', 'No operating business by that number.');
    return G.withTwoCharacters(pool, req.user.sub, row.owner_character, (ch, owner, client, h) =>
      Depot.buyFromDepot(ch, owner, req.params.id, req.body?.qty, req.body?.maxUnitPrice, client, h));
  });
}
