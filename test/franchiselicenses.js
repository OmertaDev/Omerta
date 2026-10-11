import assert from 'node:assert/strict';
import { FRANCHISE, franchiseLicenseTerms, franchiseRoyalty, franchiseLicenseView, settleFranchiseSale } from '../src/franchiselicenses.js';

const now = Date.parse('2026-10-11T12:00:00Z');
const terms = { companyRevision: 1, presetId: 'gin_storefront', royaltyBps: 100, royaltyCap: 1000,
  expiresAt: new Date(now + 86400000).toISOString() };
const license = changes => ({ id: 'license', operator_depot_id: 'operator', recipient_depot_id: 'recipient',
  brand_name: 'Independent shop', preset_id: 'gin_storefront', company_revision: 1, royalty_bps: 100,
  royalty_cap: 1000, paid: 0, earned_net: 0, created_at: new Date(now), expires_at: terms.expiresAt, status: 'active', ...changes });
assert.deepEqual(franchiseLicenseTerms(terms, now), terms);
for (const change of [{ royaltyBps: 0 }, { royaltyBps: 1001 }, { royaltyBps: '1' }, { royaltyCap: 1000001 },
  { companyRevision: 0 }, { presetId: 'code' }, { execute: 'anything' }, { expiresAt: new Date(now).toISOString() },
  { expiresAt: new Date(now + FRANCHISE.maxTermMs + 1).toISOString() }, { expiresAt: null }])
  assert.throws(() => franchiseLicenseTerms({ ...terms, ...change }, now), error => error.code === 'franchise_terms');
assert.deepEqual(franchiseRoyalty(license(), 12345, now), { royaltyCash: 123, earnedNet: 12345, paidCash: 123, eligible: true });
assert.equal(franchiseRoyalty(license({ paid: 999 }), 1000, now).royaltyCash, 1, 'total cap stops charges without debt');
for (const change of [{ status: 'offered' }, { status: 'ended' }, { expires_at: new Date(now) }, { paid: 1000 }])
  assert.deepEqual(franchiseRoyalty(license(change), 100, now), { royaltyCash: 0, earnedNet: 0, paidCash: change.paid || 0, eligible: false });
for (const change of [{ earned_net: -1 }, { paid: 1001 }, { royalty_bps: NaN }, { status: 'unknown' }, { expires_at: 'bad' }])
  assert.throws(() => franchiseRoyalty(license(change), 100, now));
for (const net of [0, -1, 1.5, '100', Infinity, FRANCHISE.maxSaleNet + 1]) assert.throws(() => franchiseRoyalty(license(), net, now));
assert.throws(() => franchiseRoyalty(license({ earned_net: FRANCHISE.maxEarnedNet }), 1, now), 'overflow never silently truncates');
const view = franchiseLicenseView(license({ secret: 'do not expose' }));
assert.equal(view.secret, undefined); assert.equal(view.gameCashOnly, true);
await assert.rejects(settleFranchiseSale({ query: () => assert.fail('forged context must not reach storage') },
  { licenseId: 'invented', operatorId: 'operator' }, 'sale'), error => error.code === 'franchise_proof');

// Partitioning a sale cannot avoid cumulative rounding; paired native entries will
// prove cash conservation separately once the coordinator supplies journal hooks.
let seed = 1947; const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
for (let i = 0; i < 1000; i++) {
  const bps = random() % 1000 + 1, cap = random() % 1000000 + 1;
  let row = license({ royalty_bps: bps, royalty_cap: cap }), total = 0;
  for (let j = 0; j < 20; j++) {
    const net = random() % 10000 + 1; total += net;
    const quote = franchiseRoyalty(row, net, now);
    assert(quote.royaltyCash >= 0 && quote.royaltyCash <= net);
    row = { ...row, earned_net: quote.earnedNet, paid: quote.paidCash };
  }
  assert.equal(row.paid, Math.min(cap, Math.floor(total * bps / 10000)), 'partition-independent capped royalty');
}
console.log('franchiselicenses: pure terms/expiry/cap/rounding PASS; seed1947 1000 partition cases; native settlement not yet proven');
