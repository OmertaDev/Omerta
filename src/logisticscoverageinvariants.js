import { logisticsCoverageBenefit } from './logisticscoverageterms.js';
import { canonicalBytes } from './content/canonical.js';

// Original accounts own reserve and benefit recovery. Successor characters may
// receive a stored obligation, but cannot create another acceptance or payment.
export async function logisticsCoverageFaults(pool) {
  const policies = (await pool.query('SELECT * FROM logistics_coverage_policies')).rows;
  const ledger = (await pool.query("SELECT t.*,c.account_id FROM transactions t LEFT JOIN characters c ON c.id=t.character_id WHERE t.reason LIKE 'coverage:%'")).rows;
  const characters = new Map((await pool.query('SELECT id,account_id FROM characters')).rows.map(c => [c.id, c.account_id]));
  const leases = new Map((await pool.query('SELECT * FROM business_warehouse_leases')).rows.map(l => [l.id, l]));
  const events = new Map((await pool.query("SELECT * FROM business_depot_journal WHERE reason='warehouse_tenant_death'")).rows.map(j => [j.id, j]));
  const byId = new Map(policies.map(p => [p.id, p]));
  let faults = 0;
  const rowsByPolicy = new Map();
  for (const row of ledger) {
    const match = /^coverage:(reserve|premium|claim|refund):(.+)$/.exec(row.reason);
    if (!match || !byId.has(match[2]) || row.currency !== 'cash' || !row.character_id || !row.account_id || !Number.isFinite(Number(row.amount))) { faults++; continue; }
    const rows = rowsByPolicy.get(match[2]) || []; rows.push({ ...row, kind: match[1] }); rowsByPolicy.set(match[2], rows);
  }
  for (const p of policies) {
    const rows = rowsByPolicy.get(p.id) || [];
    const offer = p.offer && typeof p.offer === 'object' && !Array.isArray(p.offer) ? p.offer : {};
    if (Object.keys(offer).sort().join(',') !== 'cashPerUnit,coveredUnits,expiresAt,leaseId,premiumCash'
      || offer.leaseId !== p.lease_id || offer.premiumCash !== Number(p.premium_cash)
      || !Number.isSafeInteger(offer.coveredUnits) || offer.coveredUnits < 1 || offer.coveredUnits > 10
      || !Number.isSafeInteger(offer.cashPerUnit) || offer.cashPerUnit < 1 || offer.cashPerUnit > 100000
      || offer.coveredUnits * offer.cashPerUnit !== Number(p.max_benefit_cash)
      || !Number.isFinite(new Date(offer.expiresAt).getTime())
      || new Date(offer.expiresAt).getTime() !== new Date(p.coverage_expires_at).getTime()) faults++;
    const max = Number(p.max_benefit_cash), premium = Number(p.premium_cash), escrow = Number(p.escrow_cash), refunded = Number(p.refunded_cash), benefit = Number(p.benefit_cash);
    if (characters.get(p.insurer_character) !== p.insurer_account || characters.get(p.tenant_character) !== p.tenant_account || p.insurer_account === p.tenant_account) faults++;
    if (![max,premium,escrow,refunded,benefit].every(Number.isSafeInteger) || max < 1 || max > 1000000 || premium < 0 || premium > max || escrow < 0 || refunded < 0 || benefit < 0) faults++;
    if (Math.abs(escrow + rows.reduce((n,r) => n + Number(r.amount), 0)) > 0.000001) faults++;
    if (!p.accepted_at) {
      if (!['offered','cancelled'].includes(p.state) || rows.length || escrow || refunded || benefit || p.terms || p.event_id || p.receipt) faults++;
      continue;
    }
    const reserve = rows.filter(r => r.kind === 'reserve');
    if (reserve.length !== 1 || reserve[0]?.character_id !== p.insurer_character || Number(reserve[0]?.amount) !== -max) faults++;
    const premiums = rows.filter(r => r.kind === 'premium');
    if (premium === 0 ? premiums.length !== 0 : premiums.length !== 2
      || premiums.filter(r => r.character_id === p.tenant_character && Number(r.amount) === -premium).length !== 1
      || premiums.filter(r => r.character_id === p.insurer_character && Number(r.amount) === premium).length !== 1) faults++;
    const claims = rows.filter(r => r.kind === 'claim'), refunds = rows.filter(r => r.kind === 'refund');
    if (claims.some(r => r.account_id !== p.tenant_account || Number(r.amount) <= 0) || refunds.some(r => r.account_id !== p.insurer_account || Number(r.amount) <= 0)) faults++;
    if (refunds.reduce((n,r) => n + Number(r.amount),0) !== refunded) faults++;
    if (p.state === 'paid') {
      if (claims.length !== 1 || Number(claims[0]?.amount) !== benefit || !p.paid_at || !p.receipt
        || p.receipt.policyId !== p.id || p.receipt.journalId !== p.event_id || p.receipt.benefitCash !== benefit || p.receipt.beneficiaryAccountId !== p.tenant_account) faults++;
    } else if (claims.length || p.receipt || p.paid_at) faults++;
    if (escrow !== max - refunded - (p.state === 'paid' ? benefit : 0)) faults++;
    const t = p.terms;
    if (!t || t.coveredEvent !== 'warehouse_tenant_death' || t.good !== 'gin'
      || !Number.isSafeInteger(t.enrollmentSequence) || t.enrollmentSequence < 1
      || !Number.isFinite(new Date(t.enrolledAt).getTime()) || !Number.isFinite(new Date(t.expiresAt).getTime())
      || t.leaseId !== p.lease_id || t.depotId !== p.depot_id || t.tenantCharacterId !== p.tenant_character
      || t.tenantAccountId !== p.tenant_account || t.beneficiaryAccountId !== p.tenant_account || t.maxBenefitCash !== max
      || t.coveredUnits !== offer.coveredUnits || t.cashPerUnit !== offer.cashPerUnit
      || new Date(t.enrolledAt).getTime() !== new Date(p.accepted_at).getTime()
      || new Date(t.expiresAt).getTime() !== new Date(p.coverage_expires_at).getTime()) faults++;
    if (p.event_id) {
      const event = events.get(p.event_id), lease = leases.get(p.lease_id);
      try {
        if (!event || !lease || !p.event_evidence || canonicalBytes(JSON.parse(JSON.stringify(event))).toString() !== canonicalBytes(p.event_evidence).toString()) faults++;
        const result = logisticsCoverageBenefit(t, lease, event, { encumberedCash: max });
        if (result.benefitCash !== benefit || !['claimable','paid'].includes(p.state)) faults++;
      } catch { faults++; }
    } else if (benefit || p.event_evidence || ['claimable','paid'].includes(p.state)) faults++;
  }
  return faults;
}

