// Trusted integration adapters; JSON requests never carry these scope capabilities.
import * as G from './game.js';
import * as Organizations from './employmentorganizations.js';
import { canonicalDepotAcquisitionRuntime } from './depotacquisitionruntime.js';
import { prelockEquipmentRentalDeathActors } from './equipmentrentals.js';

export async function withCrewTwoCharacters(pool, accountId, targetId, organizationId, fn) {
  const hooks = Organizations.organizationCrewLockHooks({ organizationId });
  return G.withTwoCharacters(pool, accountId, targetId, async (ch, other, client, helpers) => {
    await hooks.afterAccountLock(client, accountId);
    return fn(ch, other, client, helpers);
  }, { meet: false, withActionScope: async (client, account, execute) => {
    await hooks.beforeCharacterLock(client, account);
    try { return await execute(); } finally { Organizations.clearOrganizationCrewProof(client); }
  } });
}

export async function withAcquisitionCharacters(pool, accountId, targetId, fn) {
  return G.withTwoCharacters(pool, accountId, targetId, fn, { meet: false,
    withActionScope: async (client, account, execute) => {
      const primary = (await client.query('SELECT id,account_id,alive,is_npc FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
      const target = (await client.query('SELECT id,account_id,alive,is_npc FROM characters WHERE id=$1 AND alive', [targetId])).rows[0];
      if (!primary || !target || primary.id === target.id || primary.account_id === target.account_id) throw new G.GameError('company_acquisition', 'party');
      // Rental counterpart union must precede even the private acquisition actor preflight.
      await prelockEquipmentRentalDeathActors(client, [primary.id, target.id]);
      return canonicalDepotAcquisitionRuntime.withParties(client, primary, target, execute);
    },
  });
}
