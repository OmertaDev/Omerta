const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const blockers = ['withdrawal_rail_unavailable', 'funding_provenance_unverified', 'external_costs_incomplete'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function requireInput(condition) {
  if (!condition) throw new TypeError('Invalid earning receipt input.');
}
function id(value) { requireInput(typeof value === 'string' && idPattern.test(value)); }
function edge(value) {
  if (value === null) return;
  requireInput(object(value));
  id(value.accountId);
  requireInput(typeof value.eventKey === 'string' && /^[A-Za-z0-9_:-]{1,256}$/.test(value.eventKey));
  requireInput(typeof value.kind === 'string' && /^[a-z_]{1,64}$/.test(value.kind));
  for (const delta of [value.availableDelta, value.reservedDelta])
    requireInput(Number.isSafeInteger(delta) && Math.abs(delta) <= 1000000000);
}

// This verifies supplied internal ledger edges, never provenance or cash-out authority.
export function reconcileEarningReceipts(input) {
  requireInput(object(input));
  const { accountId, mode, rows } = input;
  id(accountId);
  requireInput(mode === 'live' || mode === 'test' || mode === null);
  requireInput(Array.isArray(rows) && rows.length <= 100 && (mode !== null || rows.length === 0));
  const seen = new Set();
  let matchedPageRevenueUsdMicros = 0;
  const receipts = Array.from(rows).map(row => {
    requireInput(object(row));
    for (const value of [row.id, row.buyerAccountId, row.sellerAccountId]) id(value);
    requireInput(!seen.has(row.id));
    seen.add(row.id);
    requireInput(typeof row.state === 'string' && /^[a-z_]{1,32}$/.test(row.state));
    requireInput(Number.isSafeInteger(row.priceUsdMicros) && row.priceUsdMicros >= 10000 &&
      row.priceUsdMicros <= 1000000000 && row.priceUsdMicros % 10000 === 0);
    requireInput(row.fulfillment === 'compute' || row.fulfillment === 'authored');
    requireInput(row.buyerFrozen === null || typeof row.buyerFrozen === 'boolean');
    edge(row.credit); edge(row.debit);
    const issues = [];
    if (row.sellerAccountId !== accountId) issues.push('seller_account_mismatch');
    if (row.buyerAccountId === row.sellerAccountId) issues.push('self_payment');
    if (row.state !== 'accepted') issues.push('job_not_accepted');
    const credit = row.credit;
    if (!credit) issues.push('credit_missing');
    else if (credit.accountId !== row.sellerAccountId || credit.kind !== 'customer_revenue' ||
      credit.eventKey !== `job_revenue:${row.id}` || credit.availableDelta !== row.priceUsdMicros || credit.reservedDelta !== 0)
      issues.push('credit_mismatch');
    const debit = row.debit;
    if (!debit) issues.push('debit_missing');
    else if (debit.accountId !== row.buyerAccountId || debit.kind !== 'job_payment' ||
      debit.eventKey !== `job_payment:${row.id}` || debit.availableDelta !== 0 || debit.reservedDelta !== -row.priceUsdMicros)
      issues.push('debit_mismatch');
    const balancedTransfer = issues.length === 0;
    const matchedRevenueUsdMicros = balancedTransfer ? row.priceUsdMicros : null;
    if (balancedTransfer) {
      requireInput(Number.isSafeInteger(matchedPageRevenueUsdMicros + row.priceUsdMicros));
      matchedPageRevenueUsdMicros += row.priceUsdMicros;
    }
    if (row.buyerFrozen === null) issues.push('buyer_funding_status_unknown');
    else if (row.buyerFrozen) issues.push('buyer_funding_frozen');
    return { jobId: row.id, fulfillment: row.fulfillment, balancedTransfer, matchedRevenueUsdMicros,
      issues, fundingFrozen: row.buyerFrozen };
  });
  return { receipts, matchedPageRevenueUsdMicros, withdrawalsSupported: false, withdrawableUsdMicros: 0,
    fundingProvenanceVerified: false, outsideCostsComplete: false, profitabilityKnown: false,
    payoutBlockers: [...blockers] };
}
