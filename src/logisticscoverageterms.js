// Pure arithmetic for one defined game event, not enrollment or payout authority.
// Canonical source: warehouseleases.closeWarehouseClaimsAtDeath + depotbook.bookDepot.
// Any canonical tenant death can trigger this benefit, including deliberate death.
// This model promises neither prevention nor a return. Runtime must authenticate
// the original tenant account's living successor, encumber funds atomically and
// consume policy/event identity exactly once; supplied evidence proves none of that.
export const LOGISTICS_COVERAGE = Object.freeze({ event: 'warehouse_tenant_death', good: 'gin', maxUnits: 10,
  maxCashPerUnit: 100000, maxBenefitCash: 1000000, maxTermMs: 86400000 });
const fail = () => { throw Object.assign(new Error('Invalid logistics coverage terms or evidence.'), { code: 'logistics_coverage_terms' }); };
const whole = (value, min, max) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail();
  return value;
};
const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail(); return value; };
const time = value => {
  if (!(value instanceof Date) && (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value))) fail();
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) fail();
  if (typeof value === 'string' && new Date(ms).toISOString() !== value.replace(/Z$/, value.includes('.') ? 'Z' : '.000Z')) fail();
  return ms;
};
const zero = value => value === 0 || (typeof value === 'string' && /^0(?:\.0+)?$/.test(value));
function termsOf(body, encumberedCash) {
  const coveredUnits = whole(body?.coveredUnits, 1, LOGISTICS_COVERAGE.maxUnits);
  const cashPerUnit = whole(body.cashPerUnit, 1, LOGISTICS_COVERAGE.maxCashPerUnit);
  const maxBenefitCash = coveredUnits * cashPerUnit;
  if ((body.coveredEvent !== undefined && body.coveredEvent !== LOGISTICS_COVERAGE.event)
      || (body.good !== undefined && body.good !== LOGISTICS_COVERAGE.good)
      || (body.maxBenefitCash !== undefined && body.maxBenefitCash !== maxBenefitCash)
      || (body.beneficiaryAccountId !== undefined && body.beneficiaryAccountId !== body.tenantAccountId)) fail();
  whole(encumberedCash, maxBenefitCash, Number.MAX_SAFE_INTEGER);
  const start = time(body.enrolledAt), end = time(body.expiresAt);
  if (end <= start || end - start > LOGISTICS_COVERAGE.maxTermMs) fail();
  return { coveredEvent: LOGISTICS_COVERAGE.event, good: LOGISTICS_COVERAGE.good,
    leaseId: id(body.leaseId), depotId: id(body.depotId), tenantCharacterId: id(body.tenantCharacterId),
    beneficiaryAccountId: id(body.tenantAccountId), tenantAccountId: body.tenantAccountId,
    coveredUnits, cashPerUnit, maxBenefitCash,
    enrollmentSequence: whole(body.enrollmentSequence, 1, 2147483646),
    enrolledAt: new Date(start).toISOString(), expiresAt: new Date(end).toISOString() };
}
function boundLease(terms, lease) {
  if (!lease || lease.id !== terms.leaseId || lease.depot_id !== terms.depotId
      || lease.tenant_character !== terms.tenantCharacterId || lease.good_id !== terms.good
      || whole(lease.units, 1, LOGISTICS_COVERAGE.maxUnits) < terms.coveredUnits
      || time(lease.created_at) > time(terms.enrolledAt) || time(lease.expires_at) < time(terms.expiresAt)) fail();
}
export function logisticsCoverageTerms(body, lease, { encumberedCash } = {}) {
  const terms = termsOf(body, encumberedCash); boundLease(terms, lease);
  if (lease.status !== 'active' || whole(lease.held_qty, 0, lease.units) < terms.coveredUnits) fail();
  return terms;
}
export function logisticsCoverageBenefit(policy, lease, journal, { encumberedCash, consumedJournalIds = [] } = {}) {
  const terms = termsOf(policy, encumberedCash); boundLease(terms, lease);
  if (policy.coveredEvent !== terms.coveredEvent || policy.good !== terms.good
      || policy.maxBenefitCash !== terms.maxBenefitCash || policy.beneficiaryAccountId !== terms.tenantAccountId
      || lease.status !== 'tenant_dead' || lease.held_qty !== 0 || !journal) fail();
  const journalId = id(journal.id);
  if (!Array.isArray(consumedJournalIds) || new Set(consumedJournalIds.map(id)).size !== consumedJournalIds.length
      || consumedJournalIds.includes(journalId)) fail();
  const at = time(journal.created_at), destroyedUnits = -whole(journal.lease_stock_delta, -lease.units, -1);
  if (journal.reason !== terms.coveredEvent || journal.lease_id !== terms.leaseId || journal.depot_id !== terms.depotId
      || journal.customer_character !== terms.tenantCharacterId || journal.lease_stock_after !== 0
      || whole(journal.lease_sequence, 1, 2147483647) <= terms.enrollmentSequence
      || at < time(terms.enrolledAt) || at >= time(terms.expiresAt)
      || ![journal.cash_delta, journal.stock_delta, journal.cost_delta, journal.expense].every(zero)
      || journal.order_id !== null || journal.policy_id !== null || journal.warehouse_rent_lease_id !== null) fail();
  const coveredUnits = Math.min(destroyedUnits, terms.coveredUnits);
  return { coveredEvent: terms.coveredEvent, journalId, leaseId: terms.leaseId, destroyedUnits, coveredUnits,
    benefitCash: coveredUnits * terms.cashPerUnit, beneficiaryAccountId: terms.tenantAccountId };
}
