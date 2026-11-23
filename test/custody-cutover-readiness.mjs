import assert from 'node:assert/strict';
import { assessCustodyCutoverSnapshot } from '../tools/custody-cutover-readiness.mjs';
import { WORLD_RESOURCE_TABLES } from '../tools/rc1-world-resource-observer.js';

const clone = structuredClone;
const observerHash = '71a13652366d4768bb6a72326ca7b6b54a5ac091ba5956899d1836e9209d0295';
const scope = () => ({ sourceIdentity: { revision: '07a4d7217ff8879ccb0c2dc82965f972a100fd3b', gitTree: 'a'.repeat(40),
  checkoutSha256: 'b'.repeat(64), lockfileSha256: 'c'.repeat(64), schemaSha256: 'd'.repeat(64) },
  observer: { path: 'tools/rc1-world-resource-observer.js', sha256: observerHash }, modules: [
    { path: 'tools/rc1-world-resource-observer.js', sha256: observerHash },
    { path: 'tools/rc1-resource-journal.js', sha256: '3b7c3e23377a10f679e195c3fab5ec5e6a8db1dbb695d1ad078673d5adc4f58f' }] });
const empty = () => ({ snapshot: { format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(t => [t, []])), boundary: { snapshot: '100:102:101' } }, scope: scope() });
function fixture() {
  const input = empty(), t = input.snapshot.tables;
  t.account_persistent = [{ account_id: 'secret-account-A', omr: '10', staked: '20', unbonding: '30', rewards: '500' },
    { account_id: 'secret-account-B', omr: '1', staked: '2', unbonding: '3', rewards: '7' }];
  t.stake_pool = [{ id: 1, balance: '10', lifetime_funded: '10000', lifetime_paid: '9990' }];
  t.gangs = [{ id: 'secret-family', omr_reserve: '11' }]; t.amm_pool = [{ id: 1, omr_reserve: '12' }];
  t.street_tax = [{ id: 1, fund: '13' }]; t.dev_fund = [{ id: 1, omr: '14' }];
  t.rwa_dividend_pool = [{ id: 1, pool: '15' }]; t.rwa_family_dividend_pool = [{ id: 1, pool: '16' }];
  t.family_yield_pool = [{ id: 1, balance: '17' }]; t.desk_inventory = [{ id: 1, balance: '18' }];
  t.exchange_pool = [{ id: 1, balance: '888' }]; // cash, not an OMR bucket
  t.loans = [{ id: 'secret-active-loan', status: 'active', collateral_omr: '6', lender_character: 'secret-lender', borrower_character: 'secret-borrower' },
    { id: 'secret-open-loan', status: 'open', collateral_omr: '999', lender_character: 'secret-lender', borrower_character: null }];
  t.auctions = [{ lot_id: 'secret-lot-A', status: 'live', current_bid: '7', bidder: 'secret-account-A' },
    { lot_id: 'secret-lot-B', status: 'live', current_bid: '8', bidder: 'secret-account-B' },
    { lot_id: 'secret-settled', status: 'settled', current_bid: '999', bidder: 'secret-account-A' }];
  t.auction_consignments = [{ id: 'secret-consignment', status: 'live', current_bid: '9', bidder: 'secret-account-A', seller_account: 'secret-seller' },
    { id: 'secret-sold', status: 'sold', current_bid: '999', bidder: 'secret-account-A', seller_account: 'secret-seller' }];
  t.vouchers = [
    { id: 'secret-signed', account_id: 'secret-account-A', nonce: '1', kind: 'omr', amount: '11', status: 'signed', claimed_onchain: false, signed_payload: 'SECRET-SIGNATURE' },
    { id: 'secret-claimed', account_id: 'secret-account-A', nonce: '2', kind: 'omr', amount: '13', status: 'claimed', claimed_onchain: true },
    { id: 'secret-queued', account_id: 'secret-account-B', nonce: '3', kind: 'omr', amount: '17', status: 'queued', claimed_onchain: false },
    { id: 'secret-cancelled', account_id: 'secret-account-B', nonce: '4', kind: 'omr', amount: '19', status: 'cancelled', claimed_onchain: false },
    { id: 'secret-gear', account_id: 'secret-account-B', nonce: '5', kind: 'gear', amount: '1', status: 'signed', claimed_onchain: false }];
  t.chain_reserve = [{ id: 1, funded_omr: '1000', next_nonce: '6' }];
  return input;
}
let groups = 0;
const check = name => { groups++; console.log('PASS ' + name); };
const refuses = (input, code) => assert.throws(() => assessCustodyCutoverSnapshot(input), e => e.code === code);
const assess = input => assessCustodyCutoverSnapshot(input);

// SOURCE-01: completeness comes from the imported canonical inventory, including reserve/vouchers.
const observedEmpty = assess(empty()); assert.equal(observedEmpty.observedCanonicalTableCount, WORLD_RESOURCE_TABLES.length);
assert.equal(observedEmpty.canonicalOmr.totalExact, '0'); assert.equal(observedEmpty.releaseReadiness, 'NOT_ESTABLISHED');
for (const table of WORLD_RESOURCE_TABLES) { const missing = empty(); delete missing.snapshot.tables[table]; refuses(missing, 'unsupported_snapshot_shape'); }
for (const table of ['vouchers', 'chain_reserve']) { const malformed = empty(); malformed.snapshot.tables[table] = {}; refuses(malformed, 'missing_canonical_world_table'); }
const version = empty(); version.snapshot.format = 2; refuses(version, 'unsupported_snapshot_format');
check('SOURCE-01 all canonical arrays required; explicit empty observations never imply readiness');

// PRECISION-01: validate authoritative text quantities even where a status excludes them from totals.
for (const [table, field] of [['account_persistent', 'omr'], ['account_persistent', 'rewards'], ['stake_pool', 'balance'], ['loans', 'collateral_omr'],
  ['auctions', 'current_bid'], ['auction_consignments', 'current_bid'], ['vouchers', 'amount'], ['chain_reserve', 'funded_omr']]) {
  for (const bad of [1, 9007199254740992, 'NaN', 'Infinity', '1e6', ' 1', '', null]) {
    const input = fixture(); input.snapshot.tables[table][0][field] = bad; refuses(input, 'invalid_exact_quantity');
  }
  const input = fixture(); delete input.snapshot.tables[table][0][field]; refuses(input, 'invalid_exact_quantity');
}
const excluded = fixture(); excluded.snapshot.tables.loans[1].collateral_omr = 999; refuses(excluded, 'invalid_exact_quantity');
check('PRECISION-01 missing, coerced Number and nondecimal amounts rejected, including inactive predicates');

const precise = fixture(); precise.snapshot.tables.account_persistent[0].omr = '90071992547409931234567890.0000001';
const precisionResult = assess(precise); assert.equal(precisionResult.canonicalOmr.totalExact, '90071992547409931234568102.0000001');
assert.equal(precisionResult.precision.submicroQuantityCount, 1);
assert(precisionResult.canonicalOmr.buckets.some(b => b.amount === '90071992547409931234567890.0000001' && !b.microCompatible));
const trailing = fixture(); trailing.snapshot.tables.account_persistent[0].omr = '1.0000000'; assert.equal(assess(trailing).precision.submicroQuantityCount, 0);
const negative = fixture(); negative.snapshot.tables.account_persistent[0].omr = '-0.0000001'; refuses(negative, 'negative_custody_quantity');
check('PRECISION-02 large exact balances and historical dust preserved; negatives never clamped or netted');

const inventory = assess(fixture()); assert.equal(inventory.canonicalOmr.totalExact, '222');
const lots = inventory.canonicalOmr.buckets.filter(b => b.table === 'auctions');
assert.equal(lots.length, 2); assert.equal(new Set(lots.map(b => b.sourceRef)).size, 2); assert.equal(new Set(lots.map(b => b.ownerRef)).size, 2);
assert(lots.every(b => !Object.values(b).includes(undefined)));
for (const table of ['account_persistent', 'stake_pool', 'gangs', 'loans', 'auctions', 'auction_consignments', 'vouchers', 'chain_reserve']) {
  const duplicate = fixture(); duplicate.snapshot.tables[table].push(clone(duplicate.snapshot.tables[table][0])); refuses(duplicate, 'duplicate_source_key');
}
const unknownStatus = fixture(); unknownStatus.snapshot.tables.loans[0].status = 'unreviewed'; refuses(unknownStatus, 'unsupported_source_status');
const ownerless = fixture(); ownerless.snapshot.tables.auctions[0].bidder = null; refuses(ownerless, 'invalid_source_identity');
check('OWNER-01 actual primary keys, distinct lot_id owners and status predicates cannot collapse or duplicate');

const rewardChange = fixture(); rewardChange.snapshot.tables.account_persistent[0].rewards = '999999999999999999.00000001';
rewardChange.snapshot.tables.stake_pool[0].lifetime_funded = '999999999999999999999';
const rewardResult = assess(rewardChange); assert.equal(rewardResult.canonicalOmr.totalExact, '222');
assert.equal(rewardResult.rewards.totalExact, '1000000000000000006.00000001');
assert(!rewardResult.canonicalOmr.buckets.some(b => b.field === 'rewards' || b.table === 'exchange_pool'));
check('REWARDS-01 existing rewards and lifetime counters are not additional canonical supply');

assert.equal(inventory.vouchers.lifetimeCommittedOmr, '24'); assert.equal(inventory.vouchers.liveSignedOmr, '11'); assert.equal(inventory.vouchers.queuedOmr, '17');
const flag = fixture(); flag.snapshot.tables.vouchers[0].claimed_onchain = true;
const flagged = assess(flag); assert.equal(flagged.vouchers.lifetimeCommittedOmr, '24'); assert.equal(flagged.vouchers.liveSignedOmr, '0');
assert.equal(flagged.integrityFindings[0].code, 'voucher_claim_status_disagreement');
const overlap = fixture(); overlap.snapshot.tables.vouchers[2].claimed_onchain = true;
assert.equal(assess(overlap).vouchers.lifetimeCommittedOmr, '41'); assert.equal(assess(overlap).vouchers.queuedOmr, '17');
const nonce = fixture(); nonce.snapshot.tables.vouchers[4].nonce = '1'; refuses(nonce, 'duplicate_voucher_nonce');
const predicate = fixture(); predicate.snapshot.tables.vouchers[0].claimed_onchain = 'false'; refuses(predicate, 'invalid_claimed_predicate');
check('VOUCHER-01 exact lifetime/live/queued predicates remain separate; nonOMR and overlapping flags do not inflate supply');

const funding = fixture(); funding.snapshot.tables.chain_reserve[0].funded_omr = '999999999999999999999999999.00000001';
const fundingResult = assess(funding); assert.equal(fundingResult.cumulativeFundingMirror.rows[0].amount, '999999999999999999999999999.00000001');
assert.equal(fundingResult.canonicalOmr.totalExact, '222'); assert.equal(fundingResult.vouchers.lifetimeCommittedOmr, '24');
assert.equal(fundingResult.releaseReadiness, 'NOT_ESTABLISHED');
check('COUNTER-01 cumulative reserve mirrors never become physical backing, supply or approved baseline');

for (const result of [inventory, observedEmpty, fundingResult]) {
  for (const gap of ['vig_prize_pool_coverage', 'game_custody_state_and_events', 'operating_cost_payment_outbox', 'physical_token_backing_and_withdrawal_capacity',
    'final_source_writer_retirement_and_reservation', 'accepted_cutover_mode_and_liability_policy', 'complete_schema_and_source_coverage']) assert(result.unresolved.includes(gap));
  assert.equal(result.releaseReadiness, 'NOT_ESTABLISHED'); assert(!Object.hasOwn(result, 'ready')); assert(!Object.hasOwn(result, 'backed'));
}
const injected = empty(); injected.snapshot.tables.game_custody_state = []; refuses(injected, 'unsupported_snapshot_shape');
check('GAP-01 missing domain/prize/custody/outbox/backing/writer/policy/schema facts stay unresolved even with zero known buckets');

const mismatch = fixture(); mismatch.scope.modules[0].sha256 = 'f'.repeat(64); refuses(mismatch, 'mismatched_observer_provenance');
const wrongSource = fixture(); wrongSource.scope.sourceIdentity.revision = 'bad'; refuses(wrongSource, 'invalid_source_provenance');
const extraClaim = fixture(); extraClaim.scope.physicalBackingApproved = true; refuses(extraClaim, 'unsupported_snapshot_shape');
assert.match(inventory.suppliedProvenance.authentication, /not authenticated/);
check('SCOPE-01 source/observer provenance checked for consistency only; unsupported claims and malformed identity refused');

const input = fixture(), before = clone(input), report = assess(input); assert.deepEqual(input, before);
input.snapshot.tables.account_persistent[0].omr = '900'; input.scope.sourceIdentity.revision = 'f'.repeat(40);
assert.equal(report.canonicalOmr.totalExact, '222'); assert.notEqual(report.suppliedProvenance.sourceIdentity.revision, input.scope.sourceIdentity.revision);
assert(Object.isFrozen(report) && Object.isFrozen(report.canonicalOmr.buckets[0]) && Object.isFrozen(report.suppliedProvenance.sourceIdentity));
assert.deepEqual(report, assess(before)); const output = JSON.stringify(report); assert(!output.includes('secret-')); assert(!output.includes('SECRET-SIGNATURE'));
const accessor = fixture(); Object.defineProperty(accessor.snapshot.tables.account_persistent[0], 'omr', { enumerable: true, get() { throw new Error('must not execute'); } }); refuses(accessor, 'invalid_snapshot_data');
assert(!Object.values(report).some(v => typeof v === 'function'));
check('INERT-01 pure deterministic immutable restricted report omits personal rows/signatures and grants no action');
console.log(JSON.stringify({ complete: true, groups, fixtureOnly: true, databaseConnections: 0, rpcConnections: 0, productionActions: 0,
  scope: 'Partial supplied-snapshot custody inventory; no complete liabilities, authenticated capture or backing/cutover clearance' }));
