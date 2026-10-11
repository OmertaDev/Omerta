import * as G from '../game.js';
import * as Franchise from '../franchiselicenses.js';
import { guardDelegatedControl } from '../operatingpolicy.js';

export function register(app, { pool, auth }) {
  app.get('/v1/franchise-licenses', { preHandler: auth }, async req =>
    G.readCharacter(pool, req.user.sub, async (ch, client) => ({
      licenses: (await client.query('SELECT * FROM depot_brand_licenses WHERE operator_character=$1 OR licensor_character=$1 ORDER BY created_at DESC,id LIMIT 100', [ch.id]))
        .rows.map(Franchise.franchiseLicenseView), gameCashOnly: true, preset: Franchise.FRANCHISE.preset,
    })));
  app.post('/v1/depot/:id/franchise-offers', { preHandler: auth }, async req => {
    const target = (await pool.query("SELECT owner_character FROM business_depots WHERE id=$1 AND status='open'", [req.body?.operatorDepotId])).rows[0];
    if (!target) throw new G.GameError('franchise_owner', 'No independent operating storefront.');
    return G.withTwoCharacters(pool, req.user.sub, target.owner_character, async (licensor, operator, client) => {
      await guardDelegatedControl(client, req.params.id, req.user.agent === true);
      const { companyRevision, presetId, royaltyBps, royaltyCap, expiresAt } = req.body || {};
      return Franchise.offerFranchiseLicense(licensor, operator, req.params.id, req.body?.operatorDepotId,
        { companyRevision, presetId, royaltyBps, royaltyCap, expiresAt }, client);
    });
  });
  app.post('/v1/franchise-licenses/:id/accept', { preHandler: auth }, async req => {
    const license = (await pool.query('SELECT licensor_character FROM depot_brand_licenses WHERE id=$1', [req.params.id])).rows[0];
    if (!license) throw new G.GameError('franchise_owner', 'No franchise offer.');
    return G.withTwoCharacters(pool, req.user.sub, license.licensor_character, async (operator, licensor, client) => {
      const row = (await client.query('SELECT operator_depot_id FROM depot_brand_licenses WHERE id=$1 AND operator_character=$2', [req.params.id, operator.id])).rows[0];
      if (!row) throw new G.GameError('franchise_owner', 'Only the recorded operator may accept.');
      await guardDelegatedControl(client, row.operator_depot_id, req.user.agent === true);
      return Franchise.acceptFranchiseLicense(operator, licensor, req.params.id, client);
    });
  });
  app.post('/v1/franchise-licenses/:id/end', { preHandler: auth }, async req =>
    G.withCharacter(pool, req.user.sub, async (ch, client) => {
      const row = (await client.query('SELECT operator_character,operator_depot_id,licensor_character,recipient_depot_id FROM depot_brand_licenses WHERE id=$1', [req.params.id])).rows[0];
      if (!row || ![row.operator_character, row.licensor_character].includes(ch.id)) throw new G.GameError('franchise_owner', 'No franchise licence of yours.');
      await guardDelegatedControl(client, row.operator_character === ch.id ? row.operator_depot_id : row.recipient_depot_id, req.user.agent === true);
      return Franchise.endFranchiseLicense(ch, req.params.id, client);
    }));
}
