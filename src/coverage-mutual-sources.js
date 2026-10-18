import crypto from 'node:crypto';
import { COVERAGE_MUTUAL } from './coverage-mutual-contracts.js';

export const mutualStable = value => JSON.stringify(value, (_key, x) => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : x);
export const mutualHash = value => crypto.createHash('sha256').update(mutualStable(value)).digest('hex');
export const mutualFailure = reason => { throw Object.assign(new Error(reason), { code: 'coverage_mutual', reason }); };
const iso = value => { const n = +new Date(value); if (!Number.isFinite(n)) mutualFailure('source_time'); return new Date(n).toISOString(); };
const integer = (v, min, max) => { const n = Number(v); if (!Number.isSafeInteger(n) || n < min || n > max) mutualFailure('source_cash'); return n; };

export function coveragePoolSource(row) {
  return { kind: 'coverage-mutual-v1', id: row.id, creatorAccount: row.creator_account, creatorCharacter: row.creator_character,
    partnerAccount: row.partner_account, partnerCharacter: row.partner_character, contributionCash: Number(row.contribution_cash),
    deductibleCash: Number(row.deductible_cash), creatorPolicy: row.creator_policy, partnerPolicy: row.partner_policy,
    policySources: row.policy_sources, createdAt: iso(row.created_at), offerExpiresAt: iso(row.offer_expires_at) };
}

// Read-only: the original canonical offer ACK and reserved journal, not a caller's policy DTO.
export async function coveragePolicyOfferSource(c, policyId, account, character, offeredAt = null) {
  const p = (await c.query('SELECT * FROM equipment_insurance_policies WHERE id=$1', [policyId])).rows[0];
  if (!p || p.insurer_account !== account || p.insurer_character !== character || !p.published) mutualFailure('policy_original');
  integer(p.maximum_cash, 1, 1000); integer(p.premium_cash, 1, 1000); integer(p.coverage_seconds, 60, COVERAGE_MUTUAL.maximumPolicySeconds);
  const rows = (await c.query("SELECT * FROM equipment_insurance_requests WHERE account_id=$1 AND action='offer' AND receipt->>'offerId'=$2", [account, policyId])).rows;
  if (rows.length !== 1) mutualFailure('policy_offer_ack');
  const ack = rows[0], terms = { coverageSeconds: Number(p.coverage_seconds), maximumCash: Number(p.maximum_cash),
    offerSeconds: integer(ack.identity.offerSeconds, 60, 86400), premiumCash: Number(p.premium_cash), published: true };
  if (mutualStable(ack.identity) !== mutualStable(terms) || mutualStable(ack.receipt) !== mutualStable({ offerId: p.id, ...terms,
    escrowCash: Number(p.maximum_cash), product: COVERAGE_MUTUAL.underlying })) mutualFailure('policy_offer_ack');
  const reserve = (await c.query('SELECT id,character_id,account_id,currency,amount,reason,counterparty FROM transactions WHERE id=$1', [p.reserve_id])).rows[0];
  if (!reserve || reserve.character_id !== character || reserve.account_id !== account || reserve.currency !== 'cash'
    || Number(reserve.amount) !== -Number(p.maximum_cash) || reserve.reason !== 'equipment_insurance:reserve' || reserve.counterparty !== p.id) mutualFailure('policy_reserve');
  if (offeredAt !== null && (p.state !== 'offered' || p.insured_account !== null || p.insured_character !== null || p.item_id !== null
    || p.accepted_at !== null || p.expires_at !== null || p.baseline_sequence !== null || p.premium_debit_id !== null || p.premium_credit_id !== null
    || Number(p.escrow_cash) !== Number(p.maximum_cash) || Number(p.paid_cash) || Number(p.refunded_cash) || Number(p.burned_cash)
    || +new Date(p.offer_expires_at) <= offeredAt || +new Date(p.offer_expires_at) - offeredAt > 3600000
    || (await c.query('SELECT policy_id FROM equipment_insurance_claims WHERE policy_id=$1', [p.id])).rows.length)) mutualFailure('policy_not_prospective');
  const source = { policyId: p.id, insurerAccount: account, insurerCharacter: character, maximumCash: Number(p.maximum_cash),
    premiumCash: Number(p.premium_cash), coverageSeconds: Number(p.coverage_seconds), offerExpiresAt: iso(p.offer_expires_at),
    reserveId: p.reserve_id, offerKey: ack.request_key, offerIdentity: ack.identity, offerReceipt: ack.receipt };
  return { policy: p, source, hash: mutualHash(source) };
}

export async function coverageMutualLossSource(c, pool, enrollment) {
  const member = enrollment.member_character, account = enrollment.member_account;
  const offer = await coveragePolicyOfferSource(c, enrollment.policy_id, account, member);
  if (mutualStable(offer.source) !== mutualStable(enrollment.source) || offer.hash !== enrollment.source_hash) mutualFailure('policy_source_changed');
  const claim = (await c.query('SELECT * FROM equipment_insurance_claims WHERE policy_id=$1', [enrollment.policy_id])).rows[0];
  if (!claim) return null;
  const p = offer.policy, members = [pool.creator_account, pool.partner_account];
  const repair = (await c.query('SELECT * FROM equipment_maintenance_repairs WHERE id=$1', [claim.repair_id])).rows[0];
  if (!repair || !pool.activated_at || !p.accepted_at || +new Date(p.accepted_at) < +new Date(pool.activated_at)
    || p.state !== 'claimed' || p.insurer_account !== account || p.insurer_character !== member) mutualFailure('self_coverage');
  // The fixed canonical oracle follows real Belladonna wear, original UID,
  // consumed two-steel repair and exact gross payout/premium/residual journals.
  const E = await import('./equipmentinsurance.js');
  if (E.EQUIPMENT_INSURANCE.product !== COVERAGE_MUTUAL.underlying || (await E.collectEquipmentInsuranceIssues(c)).length) mutualFailure('canonical_equipment_claim');
  const requests = (await c.query("SELECT * FROM equipment_insurance_requests WHERE account_id=$1 AND action='claim' AND identity->>'policyId'=$2", [p.insured_account, p.id])).rows;
  if (requests.length !== 1 || mutualStable(requests[0].identity) !== mutualStable({ policyId: p.id, repairId: claim.repair_id, wearEventId: claim.wear_event_id })
    || mutualStable(requests[0].receipt) !== mutualStable({ policyId: p.id, itemId: p.item_id, repairId: claim.repair_id,
      paidFee: Number(claim.paid_fee), payoutCash: Number(claim.payout_cash) })) mutualFailure('canonical_claim_ack');
  const refunds = (await c.query("SELECT id,character_id,account_id,currency,amount,reason,counterparty FROM transactions WHERE counterparty=$1 AND reason IN ('equipment_insurance:refund','equipment_insurance:burn','death:equipment_insurance') ORDER BY id", [p.id])).rows;
  const source = { kind: 'coverage-mutual-equipment-loss-v1', policyId: p.id, memberAccount: account, memberCharacter: member,
    insuredAccount: p.insured_account, insuredCharacter: p.insured_character, providerAccount: repair.provider_account, providerCharacter: repair.provider_character,
    itemId: p.item_id, repairId: claim.repair_id, wearEventId: claim.wear_event_id, repairDebit: repair.debit_id, repairCredit: repair.credit_id,
    materialKey: repair.material_key, reserveDebit: p.reserve_id, premiumDebit: p.premium_debit_id, premiumCredit: p.premium_credit_id,
    grossPayoutId: claim.payout_id, grossPayoutCash: Number(claim.payout_cash), premiumCash: Number(p.premium_cash),
    acceptedAt: iso(p.accepted_at), expiresAt: iso(p.expires_at), canonicalPaidFee: Number(claim.paid_fee), refundedCash: Number(p.refunded_cash), burnedCash: Number(p.burned_cash), residualJournals: refunds,
    claimKey: requests[0].request_key, claimIdentity: requests[0].identity, claimReceipt: requests[0].receipt };
  const related = members.includes(p.insured_account) || members.includes(repair.provider_account) || p.insured_account === repair.provider_account;
  source.exclusion = related ? 'related_counterparty' : null;
  const payout = related ? 0 : Math.min(Number(pool.contribution_cash), Math.max(0, source.grossPayoutCash - source.premiumCash - Number(pool.deductible_cash)));
  if (!Number.isSafeInteger(payout)) mutualFailure('source_cash');
  return { source, hash: mutualHash(source), payout, policy: p, claim };
}
