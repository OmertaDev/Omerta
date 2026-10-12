import assert from 'node:assert/strict';
import { LOGISTICS_COVERAGE, logisticsCoverageTerms, logisticsCoverageBenefit } from '../src/logisticscoverageterms.js';
const start = '2026-10-11T12:00:00.000Z', end = '2026-10-12T12:00:00.000Z';
const body = { leaseId: 'lease', depotId: 'depot', tenantCharacterId: 'tenant', tenantAccountId: 'account',
  coveredUnits: 4, cashPerUnit: 50, enrollmentSequence: 2, enrolledAt: start, expiresAt: end };
const active = { id: 'lease', depot_id: 'depot', tenant_character: 'tenant', good_id: 'gin', units: 10, held_qty: 4,
  status: 'active', created_at: start, expires_at: end };
const dead = { ...active, held_qty: 0, status: 'tenant_dead' };
const event = { id: 'journal', lease_id: 'lease', depot_id: 'depot', customer_character: 'tenant', reason: 'warehouse_tenant_death',
  lease_stock_delta: -4, lease_stock_after: 0, lease_sequence: 3, created_at: start, event_at: start,
  cash_delta: '0', stock_delta: 0, cost_delta: '0.000', expense: '0', order_id: null, policy_id: null, warehouse_rent_lease_id: null };
const reserve = { encumberedCash: 200 };
const terms = logisticsCoverageTerms(body, active, reserve);
assert.equal(terms.maxBenefitCash, 200); assert.equal(terms.beneficiaryAccountId, 'account');
assert.equal(logisticsCoverageBenefit(terms, dead, event, reserve).benefitCash, 200);
assert.equal(logisticsCoverageBenefit(terms, dead, { ...event, lease_stock_delta: -1 }, reserve).benefitCash, 50);
assert.equal(logisticsCoverageBenefit(terms, dead, { ...event, lease_stock_delta: -10 }, reserve).benefitCash, 200);
assert.equal(logisticsCoverageBenefit(terms, dead, { ...event, event_at: new Date(start) }, reserve).benefitCash, 200);
// Transaction-start time can precede enrollment while the actual post-lock burn
// occurs inside coverage. It cannot qualify a burn that actually occurs at expiry.
assert.equal(logisticsCoverageBenefit(terms, dead, { ...event,
  created_at: '2026-10-11T11:59:59.999Z', event_at: '2026-10-11T12:00:00.001Z' }, reserve).benefitCash, 200);
let negatives = 0;
const rejects = fn => { assert.throws(fn, { code: 'logistics_coverage_terms' }); negatives++; };
for (const change of [
  { coveredUnits: 0 }, { coveredUnits: 11 }, { coveredUnits: 1.5 }, { cashPerUnit: 0 }, { cashPerUnit: 100001 },
  { cashPerUnit: NaN }, { cashPerUnit: Infinity }, { coveredUnits: '4' }, { cashPerUnit: '50' },
  { tenantCharacterId: 'other' }, { leaseId: 'other' }, { depotId: 'other' }, { tenantAccountId: '' },
  { beneficiaryAccountId: 'third_party' }, { coveredEvent: 'landlord_closed' }, { good: 'omr' },
  { enrollmentSequence: 0 }, { enrollmentSequence: Infinity }, { maxBenefitCash: 201 },
  { enrolledAt: null }, { enrolledAt: '2026-02-30T12:00:00.000Z' }, { expiresAt: start },
  { expiresAt: '2026-10-13T12:00:00.000Z' },
]) rejects(() => logisticsCoverageTerms({ ...body, ...change }, active, reserve));
for (const change of [{ held_qty: 3 }, { units: 11 }, { status: 'landlord_closed' }, { status: 'closed' },
  { status: 'tenant_dead' }, { good_id: 'omr' }, { created_at: '2026-10-11T12:00:00.001Z' }, { expires_at: start }])
  rejects(() => logisticsCoverageTerms(body, { ...active, ...change }, reserve));
for (const cash of [199, -1, NaN, Infinity, '200', Number.MAX_SAFE_INTEGER + 1]) {
  rejects(() => logisticsCoverageTerms(body, active, { encumberedCash: cash }));
  rejects(() => logisticsCoverageBenefit(terms, dead, event, { encumberedCash: cash }));
}
for (const change of [
  { reason: 'landlord_closed' }, { reason: 'warehouse_withdraw' }, { reason: 'delivery_cancel' }, { reason: 'delivery_default' },
  { lease_id: 'other' }, { depot_id: 'other' }, { customer_character: 'landlord' }, { id: '' },
  { lease_stock_delta: 0 }, { lease_stock_delta: 4 }, { lease_stock_delta: -11 }, { lease_stock_delta: -1.5 },
  { lease_stock_delta: NaN }, { lease_stock_delta: -Infinity }, { lease_stock_after: 1 }, { lease_stock_after: null },
  { lease_sequence: 2 }, { lease_sequence: 0 }, { lease_sequence: NaN },
  { event_at: '2026-10-11T11:59:59.999Z' }, { event_at: end }, { event_at: null }, { event_at: undefined },
  { event_at: '2026-02-30T12:00:00.000Z' }, { event_at: Infinity },
  { cash_delta: 1 }, { cash_delta: '' }, { cash_delta: NaN }, { stock_delta: 1 }, { cost_delta: -1 }, { expense: 1 },
  { order_id: 'order' }, { policy_id: 'policy' }, { warehouse_rent_lease_id: 'lease' },
]) rejects(() => logisticsCoverageBenefit(terms, dead, { ...event, ...change }, reserve));
const legacy = { ...event }; delete legacy.event_at;
rejects(() => logisticsCoverageBenefit(terms, dead, legacy, reserve));
rejects(() => logisticsCoverageBenefit(terms, dead, { ...event,
  created_at: '2026-10-12T11:59:59.999Z', event_at: end }, reserve));
for (const change of [{ status: 'landlord_closed' }, { status: 'active' }, { held_qty: 1 }, { tenant_character: 'other' }])
  rejects(() => logisticsCoverageBenefit(terms, { ...dead, ...change }, event, reserve));
for (const consumedJournalIds of [['journal'], ['other', 'other'], [null], 'journal'])
  rejects(() => logisticsCoverageBenefit(terms, dead, event, { ...reserve, consumedJournalIds }));
for (const change of [{ coveredEvent: 'delivery_default' }, { good: 'omr' }, { maxBenefitCash: 201 }, { beneficiaryAccountId: 'third_party' }])
  rejects(() => logisticsCoverageBenefit({ ...terms, ...change }, dead, event, reserve));
// Seeded arithmetic covers both partial loss and loss above enrolled quantity.
let seed = 3919;
const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
for (let i = 0; i < 2000; i++) {
  const units = 1 + random(10), rate = 1 + random(LOGISTICS_COVERAGE.maxCashPerUnit), lost = 1 + random(10);
  const funds = units * rate, options = { encumberedCash: funds };
  const policy = logisticsCoverageTerms({ ...body, coveredUnits: units, cashPerUnit: rate }, { ...active, held_qty: 10 }, options);
  const result = logisticsCoverageBenefit(policy, dead, { ...event, lease_stock_delta: -lost }, options);
  assert.equal(result.benefitCash, Math.min(units, lost) * rate);
  assert(result.benefitCash <= funds && result.benefitCash <= policy.maxBenefitCash);
  rejects(() => logisticsCoverageBenefit(policy, dead, event, { encumberedCash: funds - 1 }));
}
assert.deepEqual(active, { id: 'lease', depot_id: 'depot', tenant_character: 'tenant', good_id: 'gin', units: 10, held_qty: 4,
  status: 'active', created_at: start, expires_at: end });
console.log(JSON.stringify({ status: 'PASS', seed: 3919, arithmeticCases: 2000, negatives,
  scope: 'Pure tenant-death burn terms and bounded arithmetic only; authoritative post-lock event_at instrumentation is required and legacy clocks cannot qualify. Inputs do not authenticate beneficiary, funding, replay or concurrency and no runtime payout occurs.' }));
