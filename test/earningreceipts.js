import assert from 'node:assert/strict';
import { reconcileEarningReceipts } from '../src/earningreceipts.js';

const row = (id = 'job-1', priceUsdMicros = 10000) => ({ id, buyerAccountId: 'buyer', sellerAccountId: 'seller',
  state: 'accepted', priceUsdMicros, fulfillment: 'authored', buyerFrozen: false,
  credit: { accountId: 'seller', eventKey: `job_revenue:${id}`, kind: 'customer_revenue', availableDelta: priceUsdMicros, reservedDelta: 0 },
  debit: { accountId: 'buyer', eventKey: `job_payment:${id}`, kind: 'job_payment', availableDelta: 0, reservedDelta: -priceUsdMicros } });
const reconcile = rows => reconcileEarningReceipts({ accountId: 'seller', mode: 'live', rows });
function closed(result) {
  for (const key of ['withdrawalsSupported', 'fundingProvenanceVerified', 'outsideCostsComplete', 'profitabilityKnown']) assert.equal(result[key], false);
  assert.equal(result.withdrawableUsdMicros, 0);
  assert.deepEqual(result.payoutBlockers, ['withdrawal_rail_unavailable', 'funding_provenance_unverified', 'external_costs_incomplete']);
}
closed(reconcile([]));
closed(reconcileEarningReceipts({ accountId: 'seller', mode: null, rows: [] }));
for (const fulfillment of ['authored', 'compute']) {
  const result = reconcile([{ ...row(), fulfillment, question: 'private', report: 'private', buyerEmail: 'private' }]);
  assert.equal(result.matchedPageRevenueUsdMicros, 10000); closed(result);
  assert.deepEqual(Object.keys(result.receipts[0]), ['jobId', 'fulfillment', 'balancedTransfer', 'matchedRevenueUsdMicros', 'issues', 'fundingFrozen']);
  assert.ok(!JSON.stringify(result).includes('private'));
}
const adversaries = [
  r => { r.credit = null; }, r => { r.debit = null; }, r => { r.sellerAccountId = 'other'; },
  r => { r.buyerAccountId = 'seller'; }, r => { r.state = 'submitted'; },
  ...['credit', 'debit'].flatMap(side => [
    r => { r[side].accountId = 'other'; }, r => { r[side].kind = 'capital'; },
    r => { r[side].eventKey += '-other'; }, r => { r[side].availableDelta += 10000; },
    r => { r[side].reservedDelta += 10000; }
  ])
];
for (const mutate of adversaries) {
  const candidate = row(); mutate(candidate);
  const result = reconcile([candidate]); closed(result);
  assert.equal(result.matchedPageRevenueUsdMicros, 0);
  assert.equal(result.receipts[0].balancedTransfer, false);
  assert.equal(result.receipts[0].matchedRevenueUsdMicros, null);
  assert.ok(result.receipts[0].issues.length);
}
for (const buyerFrozen of [null, true]) {
  const result = reconcile([{ ...row(), buyerFrozen }]);
  assert.equal(result.matchedPageRevenueUsdMicros, 10000);
  assert.equal(result.receipts[0].fundingFrozen, buyerFrozen);
  assert.deepEqual(result.receipts[0].issues, [buyerFrozen ? 'buyer_funding_frozen' : 'buyer_funding_status_unknown']); closed(result);
}
for (const side of ['credit', 'debit']) {
  const candidate = row();
  candidate[side].availableDelta = 1000000001;
  const result = reconcile([candidate]);
  assert.equal(result.matchedPageRevenueUsdMicros, 0);
  assert.equal(result.receipts[0].balancedTransfer, false);
  assert.deepEqual(result.receipts[0].issues, [`${side}_mismatch`]); closed(result);
  candidate[side].availableDelta = 1000000000000;
  assert.equal(reconcile([candidate]).matchedPageRevenueUsdMicros, 0);
  for (const delta of [1000000000001, -1000000000001]) {
    candidate[side].availableDelta = delta;
    assert.throws(() => reconcile([candidate]), TypeError);
  }
}
for (const mutate of [r => { r.id = 'x'.repeat(129); }, r => { r.id = '\n'; },
  r => { r.credit = []; }, r => { delete r.debit; }, r => { r.credit.availableDelta = Number.MAX_SAFE_INTEGER + 1; },
  r => { r.credit.reservedDelta = NaN; }, r => { r.buyerFrozen = 'false'; }, r => { r.fulfillment = 'unknown'; },
  ...[0, -10000, 10001, 1000000001, Infinity, '10000'].map(value => r => { r.priceUsdMicros = value; })]) {
  const candidate = row(); mutate(candidate); assert.throws(() => reconcile([candidate]), TypeError);
}
assert.throws(() => reconcile([row(), row()]), TypeError);
assert.throws(() => reconcile(new Array(1)), TypeError);
assert.throws(() => reconcile(Array.from({ length: 101 }, (_, i) => row(`job-${i}`))), TypeError);
for (const input of [null, {}, { accountId: 'seller', mode: null, rows: [row()] },
  { accountId: 'seller', mode: 'unknown', rows: [] }, { accountId: 'seller', mode: 'test', rows: null }])
  assert.throws(() => reconcileEarningReceipts(input), TypeError);
assert.equal(reconcile(Array.from({ length: 100 }, (_, i) => row(`job-${i}`, 1000000000))).matchedPageRevenueUsdMicros, 100000000000);

// Bounded reproducible conservation pass: wrong one-sided edges cannot contribute revenue.
let seed = 0x5eed1234;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
for (let run = 0; run < 500; run++) {
  const rows = []; let expected = 0;
  for (let i = 0, count = random() % 101; i < count; i++) {
    const amount = (1 + random() % 100000) * 10000;
    const candidate = row(`job-${i}`, amount);
    if (random() % 3 === 0) candidate.debit.reservedDelta = 0;
    else { expected += amount; assert.equal(candidate.credit.availableDelta + candidate.debit.reservedDelta, 0); }
    rows.push(candidate);
  }
  const result = reconcileEarningReceipts({ accountId: 'seller', mode: run % 2 ? 'test' : 'live', rows });
  assert.equal(result.matchedPageRevenueUsdMicros, expected); closed(result);
  assert.equal(result.receipts.reduce((sum, receipt) => sum + (receipt.matchedRevenueUsdMicros ?? 0), 0), expected);
}
console.log('earning receipts: unit/adversarial checks and 500 conservation pages passed (seed 0x5eed1234).');
