import assert from 'node:assert/strict';
import { ensureComponentDDL } from './lib/company-middle-five-fixture-schema.js';
import { insuranceFixture } from './equipmentinsurance-fixture.js';
import { ledger } from '../src/game.js';
import * as E from '../src/equipmentinsurance.js';
import * as Mutual from '../src/coverage-mutual.js';
import { coverageMutualAccounting } from '../src/coverage-mutual-invariants.js';
import { mutualStable } from '../src/coverage-mutual-sources.js';
export async function mutualFixture(pool) {
  await ensureComponentDDL(pool, Mutual.coverageMutualDDL, ['coverage_mutual_pools', 'coverage_mutual_positions',
    'coverage_mutual_enrollments', 'coverage_mutual_claims', 'coverage_mutual_requests']);
  const f = await insuranceFixture(pool);
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('partner','coverage-mutual-fixture','partner')");
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash,last_accrued_at) VALUES('partner-actor','partner','Original Mutual Partner',1,'foundry',1000000,10000,$1)", [new Date(Date.now() + 3600000)]);
  await pool.query("INSERT INTO account_persistent(account_id) VALUES('partner')");
  await ledger(pool, { characterId: 'partner-actor', currency: 'cash', amount: 9500, reason: 'crime:coverage-mutual-fixture' });
  let n = 0;
  const terms = { coverageSeconds: 3600, maximumCash: 100, offerSeconds: 3600, premiumCash: 10, published: true };
  const offers = async (extra = {}) => {
    const a = await f.tx(c => E.createEquipmentInsurance(c, 'insurer', { ...terms, ...extra }, 'mutual-policy-a-' + ++n));
    const b = await f.tx(c => E.createEquipmentInsurance(c, 'partner', { ...terms, ...extra }, 'mutual-policy-b-' + ++n));
    return { a, b };
  };
  const openBody = policies => ({ partnerCharacterId: 'partner-actor', creatorPolicyId: policies.a.offerId,
    partnerPolicyId: policies.b.offerId, contributionCash: 100, deductibleCash: 5, consent: true });
  const open = async policies => f.tx(c => Mutual.openCoverageMutual(c, 'insurer', openBody(policies), 'mutual-open-' + ++n));
  const joinBody = opened => ({ poolId: opened.pool.id, sourceHash: opened.pool.sourceHash, contributionCash: 100, deductibleCash: 5, consent: true });
  const join = opened => f.tx(c => Mutual.joinCoverageMutual(c, 'partner', joinBody(opened), 'mutual-join-' + ++n));
  const closeBody = opened => ({ poolId: opened.pool.id, sourceHash: opened.pool.sourceHash, consent: true });
  const claimBody = (opened, policyId) => ({ ...closeBody(opened), policyId });
  const actualLoss = async policyId => {
    await f.tx(c => E.acceptEquipmentInsurance(c, 'insured', { consent: true, itemId: f.itemId, maximumCash: 100,
      offerId: policyId, premiumCash: 10 }, 'mutual-actual-accept-' + ++n));
    const wear = await f.wear(), repair = await f.repair();
    const paid = await f.tx(c => E.claimEquipmentInsurance(c, 'insured', { policyId, repairId: repair.repairId,
      wearEventId: wear.wearEventId }, 'mutual-actual-insurance-claim-' + ++n));
    assert.equal(paid.payoutCash, 80); return { paid, wear, repair };
  };
  const books = async () => { assert.deepEqual((await coverageMutualAccounting(pool)).issues, []); assert.deepEqual(await E.collectEquipmentInsuranceIssues(pool), []); };
  const cash = async account => Number((await pool.query('SELECT cash FROM characters WHERE account_id=$1 AND alive=true', [account])).rows[0].cash);
  const snapshot = async () => {
    const result = {};
    for (const table of ['characters', 'transactions', 'coverage_mutual_pools', 'coverage_mutual_positions', 'coverage_mutual_enrollments', 'coverage_mutual_claims', 'coverage_mutual_requests',
      'equipment_insurance_policies', 'equipment_insurance_claims', 'equipment_insurance_requests', 'equipment_maintenance_repairs', 'item_events', 'item_stacks']) {
      const rows = (await pool.query('SELECT * FROM ' + table)).rows;
      result[table] = rows.map(mutualStable).sort();
    }
    return result;
  };
  return { ...f, offers, openBody, open, joinBody, join, closeBody, claimBody, actualLoss, books, cash, snapshot };
}
