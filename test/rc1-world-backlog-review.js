import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { BACKLOG_REVIEW_TABLES, reviewWorldBacklog, compareWorldBacklogWindows } from '../tools/rc1-world-backlog-review.js';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { LOAN, dayOf } from '../src/rules.js';

const DAY = 86400000, at = 1790208000000, sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const configuration = { LIVING_WORLD_DIRECTOR: 'LIVE' }, digest = value => sha256(canonicalJson(value));
const iso = value => new Date(value).toISOString();
const empty = () => Object.fromEntries(BACKLOG_REVIEW_TABLES.map(table => [table, []]));
const character = (id, extra = {}) => ({ id, alive: true, welsher: false, season: Math.floor(dayOf(at) / 28), ...extra });
const loan = (id, extra = {}) => ({ id, status: 'open', offered_at: iso(at), due_at: null, lender_character: 'lender',
  borrower_character: 'borrower', collateral_car: null, collateral_omr: '0', ...extra });
function snapshot(rows, logicalAt = at) {
  const tables = Object.fromEntries(Object.entries(rows).map(([table, values]) => [table, values.map(row => JSON.stringify(row)).sort()]));
  const base = { tables, sequences: [] }; return { ...base, stateSha256: digest(base), capturedAt: iso(logicalAt) };
}
function review(rows = empty(), options = {}) {
  return reviewWorldBacklog(snapshot(rows, options.logicalAt || at), { logicalAt: at, sourceRevision, configuration, ...options });
}
const count = (report, id) => report.inventory.find(row => row.id === id).count;
let cases = 0;
function test(name, fn) { fn(); cases++; }

test('complete empty lifecycle tables prove zero rows while missing evidence stays unknown', () => {
  const result = review(); assert(result.inventory.every(row => row.count === 0)); assert.equal(result.inventory.length, 21);
  assert.equal(result.liveState.orphanedOperations, null);
  assert(result.unknown.some(row => row.kind === 'canonical-invariant-evidence-missing'));
  const rows = empty(); delete rows.market_listings;
  const missing = review(rows); assert.equal(count(missing, 'market-expiry'), null);
  assert(missing.unknown.some(row => row.missing?.includes('market_listings')));
});

test('due operators preserve strict loan/favor deadlines and inclusive market deadlines', () => {
  const rows = empty(); rows.characters = [character('borrower'), character('lender')];
  rows.market_listings = [
    { id: 'inclusive', status: 'live', expires_at: iso(at) }, { id: 'future', status: 'live', expires_at: iso(at + 1) },
    { id: 'recoverable', status: 'expired', expires_at: iso(at - DAY) }, { id: 'null', status: 'live', expires_at: null },
  ];
  rows.loans = [loan('edge', { offered_at: iso(at - LOAN.OFFER_TTL_MS) }), loan('old', { offered_at: iso(at - LOAN.OFFER_TTL_MS - 1) })];
  rows.favors = [{ id: 'edge', status: 'open', expires_at: iso(at) }, { id: 'past', status: 'open', expires_at: iso(at - 1) }];
  const result = review(rows); assert.equal(count(result, 'market-expiry'), 1); assert.equal(count(result, 'loan-offer-expiry'), 1);
  assert.equal(count(result, 'favor-expiry'), 1);
});

test('loan branding is borrower work, not every active overdue debt', () => {
  const rows = empty(); rows.characters = [character('borrower'), character('branded', { welsher: true }), character('dead', { alive: false })];
  rows.loans = [
    loan('unsecured', { status: 'active', due_at: iso(at - 1) }), loan('same-borrower', { status: 'active', due_at: iso(at - 1) }),
    loan('branded', { status: 'active', due_at: iso(at - DAY), borrower_character: 'branded' }),
    loan('dead', { status: 'active', due_at: iso(at - DAY), borrower_character: 'dead' }),
    loan('house', { status: 'active', due_at: iso(at - 1), lender_character: 'HOUSE' }),
    loan('car', { status: 'active', due_at: iso(at - LOAN.GRACE_MS - 1), collateral_car: 'car' }),
    loan('omr-edge', { status: 'active', due_at: iso(at - LOAN.GRACE_MS), collateral_omr: '10' }),
  ];
  const result = review(rows); assert.equal(count(result, 'loan-welsher-brand'), 1);
  assert.equal(count(result, 'loan-house-collection'), 1); assert.equal(count(result, 'loan-collateral-forfeit'), 1);
  delete rows.characters[0].welsher; assert.equal(count(review(rows), 'loan-welsher-brand'), null);
});

test('complete checkpoint inventories do not inherit original director read caps', () => {
  const rows = empty(); rows.director_campaigns = Array.from({ length: 40 }, (_, i) => ({ id: 'campaign-' + i, status: 'active', expires_at: iso(at) }));
  const live = review(rows); assert.equal(count(live, 'director-campaign'), 40);
  assert.equal(live.inventory.find(row => row.id === 'director-campaign').originalReadLimit, 33);
  const shadow = review(rows, { configuration: { LIVING_WORLD_DIRECTOR: 'SHADOW_MODE' } });
  const observed = shadow.inventory.find(row => row.id === 'director-campaign');
  assert.equal(observed.status, 'NON_MUTATING_MODE'); assert.equal(observed.count, null); assert.equal(observed.observedOverdueIds.length, 40);
  assert(review(rows, { configuration: {} }).unknown.some(row => row.kind === 'director-mutation-mode-not-declared'));
});

test('original orphan and invariant evidence remains separate from worker due rows', () => {
  const lifecycleDiagnostics = { logicalAt: at, coordination: { lifecycle: { complete: true, structuralOrphanOperations: 0,
    orphanedOperations: null, issues: [], recoveryRequiredOperationIds: ['open-operation'], overdueOpenOperationIds: ['open-operation'] } } };
  const invariants = { logicalAt: at, checks: [{ name: 'family operation custody', ok: false, issues: ['retained-native-issue'] }] };
  const result = review(empty(), { lifecycleDiagnostics, invariants });
  assert.deepEqual(result.liveState.overdueCommandOwnedOperationIds, ['open-operation']);
  assert.equal(result.liveState.orphanedOperations, null); assert.deepEqual(result.liveState.failedCanonicalChecks, ['family operation custody']);
  assert.equal(count(result, 'market-expiry'), 0);
  assert.throws(() => review(empty(), { lifecycleDiagnostics: { ...lifecycleDiagnostics, logicalAt: at - 1 } }), /clock differs/);
  assert.throws(() => review(empty(), { invariants: { ...invariants, logicalAt: at - 1 } }), /clock differs/);
});

test('successive actual window comparisons show additions, persistence and exact count growth', () => {
  const rows = empty(); rows.market_listings = [{ id: 'old', status: 'live', expires_at: iso(at - 1) }];
  const first = review(rows); rows.market_listings.push({ id: 'new', status: 'live', expires_at: iso(at + DAY) });
  const second = review(rows, { logicalAt: at + 28 * DAY }); rows.market_listings[0].status = 'expired';
  const third = review(rows, { logicalAt: at + 56 * DAY });
  const result = compareWorldBacklogWindows([first, second, third]);
  const growth = result.comparisons[0].rows.find(row => row.id === 'market-expiry');
  assert.equal(growth.status, 'GROWTH_OBSERVED'); assert.equal(growth.persisting.length, 1); assert.equal(growth.added.length, 1);
  const recovery = result.comparisons[1].rows.find(row => row.id === 'market-expiry');
  assert.equal(recovery.status, 'NO_COUNT_GROWTH'); assert.equal(recovery.cleared.length, 1); assert.equal(recovery.persisting.length, 1);
  assert.equal(result.comparisons[0].liveStateOrphans.status, 'UNKNOWN');
  assert(compareWorldBacklogWindows([first]).unknown.length);
  assert.throws(() => compareWorldBacklogWindows([first, first]), /must advance/);
  const changed = structuredClone(second); changed.inventory[0].count = 0;
  assert.throws(() => compareWorldBacklogWindows([first, changed]), /checkpoint changed/);
});

test('full snapshot hash and fixed logical clock cannot be substituted', () => {
  const state = snapshot(empty()); state.tables.market_listings.push(JSON.stringify({ id: 'hidden', status: 'live', expires_at: iso(at) }));
  assert.throws(() => reviewWorldBacklog(state, { logicalAt: at, sourceRevision, configuration }), /snapshot hash mismatch/);
  assert.throws(() => reviewWorldBacklog(snapshot(empty()), { logicalAt: at + 1, sourceRevision, configuration }), /clock differs/);
  const rows = empty(); rows.market_listings = [{ id: 'bad-date', status: 'live', expires_at: 'not-a-date' }];
  assert.throws(() => review(rows), /Invalid native timestamp/);
});

console.log(JSON.stringify({ status: 'PASS_SCOPED', controls: cases, classes: 21,
  scope: 'Source-bound due-row inventory, canonical skip guards, retained snapshot/clock bindings, UNKNOWN handling and exact successive-window comparisons; no new native run or matrix qualification' }));
