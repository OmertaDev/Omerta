// Pure, restricted diagnostics over a supplied world snapshot. No DB/RPC or cutover authority.
import { WORLD_RESOURCE_TABLES, omrBuckets } from './rc1-world-resource-observer.js';
import { exactDecimal, exactSum, sha256 } from './rc1-resource-journal.js';

const OBSERVER = 'tools/rc1-world-resource-observer.js';
const JOURNAL = 'tools/rc1-resource-journal.js';
const fail = code => { throw Object.assign(new TypeError(code), { code }); };
const freeze = value => {
  if (value && typeof value === 'object') { for (const v of Object.values(value)) freeze(v); Object.freeze(value); }
  return value;
};
// Reject getters and non-JSON values before inspecting supplied rows. Do not retain input references.
function own(value) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object') fail('invalid_snapshot_data');
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) fail('invalid_snapshot_array');
    return Array.from({ length: value.length }, (_, i) => {
      const d = Object.getOwnPropertyDescriptor(value, String(i));
      if (!d || !d.enumerable || !Object.hasOwn(d, 'value')) fail('invalid_snapshot_array');
      return own(d.value);
    });
  }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('invalid_snapshot_data');
  const out = {};
  for (const key of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !d.enumerable || !Object.hasOwn(d, 'value')) fail('invalid_snapshot_data');
    Object.defineProperty(out, key, { enumerable: true, writable: true, configurable: true, value: own(d.value) });
  }
  return out;
}
function shape(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every(k => Object.hasOwn(value, k))) fail('unsupported_snapshot_shape');
}
const text = v => { if (typeof v !== 'string' || !v.length) fail('invalid_source_identity'); return v; };
function identity(row, key, numeric = false) {
  const value = row[key];
  if (numeric) { if (!Number.isSafeInteger(value) || value < 1) fail('invalid_source_key'); return String(value); }
  return text(value);
}
function quantity(row, field) {
  if (typeof row[field] !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(row[field])) fail('invalid_exact_quantity');
  const d = exactDecimal(row[field]);
  if (d.coefficient < 0n) fail('negative_custody_quantity');
  return { amount: exactSum([row[field]]), originalScale: d.scale,
    microCompatible: d.scale <= 6 || d.coefficient % (10n ** BigInt(d.scale - 6)) === 0n };
}
const ref = (kind, value) => sha256(JSON.stringify([kind, value]));
function provenance(scope) {
  shape(scope, ['sourceIdentity', 'observer', 'modules']);
  shape(scope.sourceIdentity, ['revision', 'gitTree', 'checkoutSha256', 'lockfileSha256', 'schemaSha256']);
  for (const [key, value] of Object.entries(scope.sourceIdentity)) {
    const n = ['revision', 'gitTree'].includes(key) ? 40 : 64;
    if (typeof value !== 'string' || !new RegExp(`^[0-9a-f]{${n}}$`).test(value) || /^0+$/.test(value)) fail('invalid_source_provenance');
  }
  const pin = p => {
    shape(p, ['path', 'sha256']);
    if (typeof p.path !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(p.path) || p.path.startsWith('/') || p.path.split('/').includes('..')
      || typeof p.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(p.sha256) || /^0+$/.test(p.sha256)) fail('invalid_source_provenance');
  };
  pin(scope.observer);
  if (scope.observer.path !== OBSERVER || !Array.isArray(scope.modules)) fail('unsupported_observer_scope');
  const modules = new Map();
  for (const p of scope.modules) { pin(p); if (modules.has(p.path)) fail('duplicate_module_provenance'); modules.set(p.path, p.sha256); }
  if (modules.get(OBSERVER) !== scope.observer.sha256 || !modules.has(JOURNAL)) fail('mismatched_observer_provenance');
  return { ...scope, authentication: 'Supplied provenance only; shape/consistency checked, not authenticated against source files, schema or chain.' };
}

export function assessCustodyCutoverSnapshot(input) {
  const captured = own(input); shape(captured, ['snapshot', 'scope']);
  const { snapshot, scope } = captured; shape(snapshot, ['format', 'tables', 'boundary']);
  if (snapshot.format !== 1) fail('unsupported_snapshot_format');
  shape(snapshot.tables, WORLD_RESOURCE_TABLES);
  shape(snapshot.boundary, ['snapshot']);
  if (typeof snapshot.boundary.snapshot !== 'string' || !/^\d+:\d+:(?:\d+(?:,\d+)*)?$/.test(snapshot.boundary.snapshot)) fail('invalid_snapshot_boundary');
  const suppliedProvenance = provenance(scope), tables = snapshot.tables;
  for (const table of WORLD_RESOURCE_TABLES) {
    if (!Array.isArray(tables[table]) || tables[table].some(row => !row || typeof row !== 'object' || Array.isArray(row))) fail('missing_canonical_world_table');
  }
  const sourceRows = new Map(), rowsByRef = new Map();
  function register(table, key, numeric = false) {
    const seen = new Set();
    for (const row of tables[table]) { const id = identity(row, key, numeric); if (seen.has(id)) fail('duplicate_source_key'); seen.add(id); const sourceRef = ref(table, id); sourceRows.set(row, { table, sourceRef }); rowsByRef.set(sourceRef, row); }
  }
  register('account_persistent', 'account_id');
  const pools = [['amm_pool', 'omr_reserve'], ['street_tax', 'fund'], ['gangs', 'omr_reserve'], ['stake_pool', 'balance'], ['dev_fund', 'omr'],
    ['rwa_dividend_pool', 'pool'], ['rwa_family_dividend_pool', 'pool'], ['family_yield_pool', 'balance'], ['desk_inventory', 'balance']];
  for (const [table] of pools) register(table, 'id', table !== 'gangs');
  register('loans', 'id'); register('auctions', 'lot_id'); register('auction_consignments', 'id'); register('vouchers', 'id'); register('chain_reserve', 'id', true);
  const descriptions = [], rewards = [];
  const add = (row, field, ownerRef) => { quantity(row, field); descriptions.push({ ...sourceRows.get(row), field, ownerRef }); };
  for (const field of ['omr', 'staked', 'unbonding']) for (const row of tables.account_persistent) add(row, field, ref('account', row.account_id));
  for (const row of tables.account_persistent) rewards.push({ ...sourceRows.get(row), ownerRef: ref('account', row.account_id), ...quantity(row, 'rewards') });
  for (const [table, field] of pools) for (const row of tables[table]) add(row, field, table === 'gangs' ? ref('family', row.id) : ref('pool', table + ':' + row.id));
  const status = (row, values) => { if (!values.includes(row.status)) fail('unsupported_source_status'); };
  for (const row of tables.loans) {
    status(row, ['open', 'active', 'repaid', 'collected', 'cancelled']); quantity(row, 'collateral_omr'); text(row.lender_character);
    if (row.status === 'active') add(row, 'collateral_omr', ref('character', text(row.borrower_character)));
  }
  for (const table of ['auctions', 'auction_consignments']) for (const row of tables[table]) {
    status(row, table === 'auctions' ? ['live', 'settled'] : ['live', 'sold', 'unsold', 'cancelled']);
    const amount = quantity(row, 'current_bid');
    if (!Object.hasOwn(row, 'bidder') || row.bidder !== null && typeof row.bidder !== 'string') fail('invalid_auction_owner');
    if (exactDecimal(amount.amount).coefficient > 0n) text(row.bidder);
    if (table === 'auction_consignments') text(row.seller_account);
    if (row.status === 'live') add(row, 'current_bid', row.bidder === null ? null : ref('account', text(row.bidder)));
  }
  // Reuse canonical arithmetic/predicates. Pair in helper order to retain the real
  // auctions.lot_id key; that helper's generic owner expression has no lot_id fallback.
  const canonical = omrBuckets(snapshot);
  if (canonical.length !== descriptions.length) fail('canonical_bucket_shape_changed');
  const buckets = canonical.map((bucket, i) => {
    const description = descriptions[i];
    if (bucket.table !== description.table || bucket.field !== description.field) fail('canonical_bucket_shape_changed');
    const row = rowsByRef.get(description.sourceRef);
    const value = quantity(row, bucket.field);
    if (bucket.amount !== value.amount) fail('canonical_bucket_amount_changed');
    return { ...description, ...value };
  });
  const nonces = new Set(), vouchers = [], integrityFindings = [];
  for (const row of tables.vouchers) {
    if (!['omr', 'gear', 'car', 'boat', 'deed', 'dynasty'].includes(row.kind)) fail('unsupported_voucher_kind');
    status(row, ['queued', 'signed', 'claimed', 'cancelled', 'expired']);
    if (typeof row.claimed_onchain !== 'boolean') fail('invalid_claimed_predicate');
    const amount = quantity(row, 'amount'); text(row.account_id);
    if (typeof row.nonce !== 'string' || !/^(0|[1-9]\d*)$/.test(row.nonce) || BigInt(row.nonce) > 9223372036854775807n) fail('invalid_voucher_nonce');
    if (nonces.has(row.nonce)) fail('duplicate_voucher_nonce'); nonces.add(row.nonce);
    if ((row.status === 'claimed') !== row.claimed_onchain) integrityFindings.push({ code: 'voucher_claim_status_disagreement', sourceRef: sourceRows.get(row).sourceRef });
    vouchers.push({ ...sourceRows.get(row), ownerRef: ref('account', row.account_id), nonceRef: ref('voucher-nonce', row.nonce),
      kind: row.kind, status: row.status, claimedOnchain: row.claimed_onchain, ...amount });
  }
  const omrVouchers = vouchers.filter(v => v.kind === 'omr');
  const sum = rows => exactSum(rows.map(r => r.amount));
  const reserve = tables.chain_reserve.map(row => ({ ...sourceRows.get(row), ...quantity(row, 'funded_omr') }));
  return freeze({ format: 1, classification: 'RESTRICTED_PARTIAL_CUSTODY_DIAGNOSTIC', releaseReadiness: 'NOT_ESTABLISHED',
    suppliedProvenance, observedCanonicalTableCount: WORLD_RESOURCE_TABLES.length,
    canonicalOmr: { coverage: 'Named partial buckets only; not complete liabilities or physical backing.', buckets, totalExact: sum(buckets) },
    rewards: { meaning: 'Existing account reward claims on funded pools; excluded from canonical supply total.', claims: rewards, totalExact: sum(rewards) },
    vouchers: { meaning: 'Separate overlapping source predicates; never add these totals to canonical supply or physical backing.', rows: vouchers,
      lifetimeCommittedOmr: sum(omrVouchers.filter(v => v.status === 'signed' || v.claimedOnchain)),
      liveSignedOmr: sum(omrVouchers.filter(v => v.status === 'signed' && !v.claimedOnchain)), queuedOmr: sum(omrVouchers.filter(v => v.status === 'queued')) },
    cumulativeFundingMirror: { meaning: 'Cumulative chain_reserve.funded_omr mirror; not current token balance, a native ReserveFunded event or approved baseline.', rows: reserve },
    precision: { microCompatibilityIsNotMigrationApproval: true, submicroQuantityCount: [...buckets, ...rewards, ...vouchers, ...reserve].filter(r => !r.microCompatible).length }, integrityFindings,
    unresolved: ['complete_schema_and_source_coverage', 'authenticated_source_and_snapshot_capture', 'custody_chain_contract_domain_attribution',
      'vig_prize_pool_coverage', 'game_custody_state_and_events', 'operating_cost_payment_outbox', 'physical_token_backing_and_withdrawal_capacity',
      'final_source_writer_retirement_and_reservation', 'accepted_cutover_mode_and_liability_policy', 'release_manifest_and_specific_approval'],
    authority: 'No cutover, signing, deployment, funding or activation authority. Supplied empty tables do not establish absent liabilities as zero.' });
}
