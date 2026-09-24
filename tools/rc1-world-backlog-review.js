// Read-only review of complete native checkpoints. Original workers own every
// predicate and disposition below; this helper never expires or repairs state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { LOAN, WORLD, PEN, HEIST_PLAN_TTL_MS, dayOf, weekOf } from '../src/rules.js';

export const BACKLOG_SOURCE_PINS = Object.freeze({
  'src/worker.js': '7072264895a874fbcc1f068c85a8668c4cc34819918868459d71194c5f1eabf6',
  'src/market.js': 'ac65c72a32ce85e1e6cb5804a5c76c15e5d8f611ffab84122d6ddade1611fb40',
  'src/loans.js': '663f71b15332367689b5b4db5cf7fc8d94e49249d8697cc6b98bb986607cb14e',
  'src/social/gangs.js': 'f8ac8bdd2ee2706619d2d5cfd5ef8901f05415703c67cdd08d4e6e5554f53ad7',
  'src/social/contracts.js': '46c2c5293f89dde7a2dda71f48f5e517e014a7097cf7a44109cd02682c9a5c8d',
  'src/npcwar.js': '4f8be69d632e188cc0400646fb5dbedce6dc1b77dcce2ef5f362380c936f22d6',
  'src/world.js': '4946a0b43aa2f456a4f6cffcf2049cb576fbeee9241dc3bc4955db57a889553a',
  'src/convoy.js': 'a4d98d41a3f265fd5743b7e46aa0b2ae351695cfb47cdd62f5e9caa5eac6ee7b',
  'src/heists.js': '44031976626adacd64b56234bccc1d9a0067ec5bd63d1d44332597ecdb852b83',
  'src/pen.js': '11f992b7e89796e050384ab1834f024ffad13f6489b932c90132dc6fbab02506',
  'src/favors.js': '9026bd6a0e76da70e8307bbca45b08982904e455cf1e2e46ac8a843f14bb4f87',
  'src/auction.js': 'aa5b1931188d7e8294e6c1518b36ea2664544fd218c431ea62cd4b435bfdf743',
  'src/commission.js': '7e1aabd4aea45dc32ff68f3ba9307fd8e6a3794c74ad7e9387f308045da5445f',
  'src/rules.tail.js': 'ee6bdee29f049fcac9c3530729cbdca3039ea87a18b873cf7a6d548f0af1abed',
  'src/director/runtime.js': '04ff17562903a3593725921a9ba3b2f90620a1c6e71b85a3ae053540bc49e0f8',
  'src/invariants.js': 'ffbaae96e4ff8f9a62a0d8329020c13853a50ccc69a197f5c0b4c6a04bc7e9c4',
});
const compact = text => text.replace(/\s+/g, ' ').trim();
const digest = value => sha256(canonicalJson(value));
const instant = value => { if (value == null) return null; const n = new Date(value).getTime(); assert(Number.isSafeInteger(n), 'Invalid native timestamp'); return n; };
const due = (row, field, at, inclusive = true) => row[field] != null && (inclusive ? instant(row[field]) <= at : instant(row[field]) < at);
const key = (row, fields) => canonicalJson(fields.map(field => row[field]));
const sources = new Map(), revisions = new Set();
function sourceProof(revision) {
  assert.match(revision, /^[a-f0-9]{40}$/);
  if (revisions.has(revision)) return;
  for (const [file, expected] of Object.entries(BACKLOG_SOURCE_PINS)) {
    const actual = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(sha256(actual), expected, `Backlog reviewer source changed: ${file}`);
    const pinned = execFileSync('git', ['show', `${revision}:${file}`], { cwd: new URL('..', import.meta.url), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).replace(/\r\n/g, '\n');
    assert.equal(sha256(pinned), expected, `Checkpoint source is not covered: ${file}`); sources.set(file, compact(actual));
  }
  revisions.add(revision);
}
const specs = [];
function spec(id, label, file, table, fields, query, filter, disposition, keys = ['id'], extra = {}) {
  specs.push({ id, label, file, table, fields: [...new Set([...fields, ...keys])], query, filter, disposition, keys, periodMs: 3600000, ...extra });
}
spec('market-expiry', 'market sweep', 'src/market.js', 'market_listings', ['status', 'expires_at'],
  "SELECT id, kind, seller_character, bidder FROM market_listings WHERE status='live' AND expires_at <= now()",
  (r, at) => r.status === 'live' && due(r, 'expires_at', at), 'Original sweep settles/refunds or marks expired; expired goods and delivered warehouse cargo remain public-command recoverable.');
spec('loan-offer-expiry', 'loan sweep', 'src/loans.js', 'loans', ['status', 'offered_at'],
  "SELECT id, lender_character FROM loans WHERE status='open' AND offered_at < $1 ORDER BY id",
  (r, at) => r.status === 'open' && due(r, 'offered_at', at - LOAN.OFFER_TTL_MS, false), 'Cancel the expired offer and refund a living lender.');
spec('loan-house-collection', 'loan sweep', 'src/loans.js', 'loans', ['status', 'lender_character', 'due_at'],
  "SELECT id FROM loans WHERE status='active' AND lender_character='HOUSE' AND due_at < $1 ORDER BY id",
  (r, at) => r.status === 'active' && r.lender_character === 'HOUSE' && due(r, 'due_at', at, false), 'Collect or close the overdue house loan.');
spec('loan-collateral-forfeit', 'loan sweep', 'src/loans.js', 'loans', ['status', 'collateral_car', 'collateral_omr', 'due_at'],
  "SELECT id FROM loans WHERE status='active' AND (collateral_car IS NOT NULL OR collateral_omr > 0) AND due_at < $1 ORDER BY id",
  (r, at) => r.status === 'active' && (r.collateral_car != null || Number(r.collateral_omr) > 0) && due(r, 'due_at', at - LOAN.GRACE_MS, false),
  'Forfeit surviving collateral and close the loan after the canonical grace period.');
spec('loan-welsher-brand', 'loan sweep', 'src/loans.js', 'loans', ['status', 'due_at', 'borrower_character'],
  "SELECT DISTINCT borrower_character FROM loans WHERE status='active' AND due_at < $1",
  (r, at, tables) => r.status === 'active' && due(r, 'due_at', at, false) && tables.characters.some(c => c.id === r.borrower_character && c.alive && !c.welsher),
  'Only a living, not-yet-branded borrower needs worker action. An already branded unsecured debt can remain active for public repayment/collection.', ['borrower_character'],
  { dependencies: { characters: ['id', 'alive', 'welsher'] }, guards: ["SELECT id, welsher FROM characters WHERE id=$1 AND alive FOR UPDATE", 'if (!b || b.welsher || !still)'] });
spec('turf-contest', 'turf contest sweep', 'src/social/gangs.js', 'districts', ['contest_until'],
  'SELECT id FROM districts WHERE contest_until IS NOT NULL AND contest_until <= $1', (r, at) => due(r, 'contest_until', at), 'Resolve each sealed contest through resolveContest.');
spec('npc-family-war', 'family war sweep', 'src/npcwar.js', 'npc_wars', ['resolved', 'ends_at'],
  'SELECT attacker_gang, npc_gang FROM npc_wars WHERE NOT resolved AND ends_at <= now()',
  (r, at) => r.resolved === false && due(r, 'ends_at', at), 'Mark the elapsed NPC Family war resolved.', ['attacker_gang', 'npc_gang']);
spec('uprising', 'world uprising sweep', 'src/world.js', 'world_uprisings', ['status', 'day'],
  "SELECT day, npc_id FROM world_uprisings WHERE day < $1 AND status='active' ORDER BY day",
  (r, at) => r.status === 'active' && Number(r.day) < dayOf(at), 'Resolve the prior-day uprising.', ['day', 'npc_id']);
spec('npc-convoy-arrival', 'npc convoy despawn', 'src/convoy.js', 'convoys', ['is_npc', 'status', 'arrives_at'],
  "SELECT id FROM convoys WHERE is_npc AND status='transit' AND arrives_at <= now()",
  (r, at) => r.is_npc === true && r.status === 'transit' && due(r, 'arrives_at', at), 'Delete the arrived NPC convoy and its cargo/ambush rows atomically.');
spec('season-character', 'season rollover', 'src/worker.js', 'characters', ['alive', 'season'],
  'SELECT id FROM characters WHERE alive AND season < $1 ORDER BY id',
  (r, at) => r.alive === true && Number(r.season) < Math.floor(dayOf(at) / 28), 'Convert each living earlier-season character independently.');
spec('season-crown', 'season rollover', 'src/worker.js', 'season_records', ['crowned', 'season'],
  'SELECT season FROM season_records WHERE NOT crowned AND season < $1 ORDER BY season',
  (r, at) => r.crowned === false && Number(r.season) < Math.floor(dayOf(at) / 28), 'Retry the durable uncrowned season record.', ['season']);
spec('heist-plan', 'heist sweep', 'src/heists.js', 'crew_heists', ['status', 'created_at'],
  "SELECT id, job, leader_character FROM crew_heists WHERE status='planning' AND created_at < now() - $1::interval",
  (r, at) => r.status === 'planning' && due(r, 'created_at', at - HEIST_PLAN_TTL_MS, false), 'Abandon stale planning and refund a living leader.');
spec('pen-break-plan', 'pen break sweep', 'src/pen.js', 'pen_breaks', ['status', 'created_at'],
  "SELECT id, leader_character FROM pen_breaks WHERE status='planning' AND created_at < now() - $1::interval",
  (r, at) => r.status === 'planning' && due(r, 'created_at', at - PEN.COOP_TTL_MS, false), 'Abandon stale planning and return the living leader cutkit.');
spec('world-raid-plan', 'world raid sweep', 'src/world.js', 'world_raids', ['status', 'created_at'],
  "SELECT id FROM world_raids WHERE status='planning' AND created_at < $1",
  (r, at) => r.status === 'planning' && due(r, 'created_at', at - WORLD.COOP_TTL_MS, false), 'Abandon stale planning and release memberships.');
spec('bounty-expiry', 'bounty sweep', 'src/social/contracts.js', 'bounties', ['expires_at'],
  'SELECT target_character, kind FROM bounties WHERE expires_at IS NOT NULL AND expires_at <= now()',
  (r, at) => due(r, 'expires_at', at), 'Resolve the expired pot through the original refund transaction.', ['target_character', 'kind']);
spec('favor-expiry', 'favor sweep', 'src/favors.js', 'favors', ['status', 'expires_at'],
  "SELECT id, poster_character FROM favors WHERE status='open' AND expires_at < now() ORDER BY id",
  (r, at) => r.status === 'open' && due(r, 'expires_at', at, false), 'Refund the expired favor escrow.');
spec('auction-week', 'auction sweep', 'src/auction.js', 'auctions', ['status', 'week'],
  "SELECT lot_id FROM auctions WHERE status='live' AND week < $1 ORDER BY lot_id",
  (r, at) => r.status === 'live' && Number(r.week) < weekOf(dayOf(at)), 'Settle the earlier-week auction.', ['lot_id']);
spec('consignment-expiry', 'consignment sweep', 'src/auction.js', 'auction_consignments', ['status', 'closes_at'],
  "SELECT id FROM auction_consignments WHERE status='live' AND closes_at <= now() ORDER BY id",
  (r, at) => r.status === 'live' && due(r, 'closes_at', at), 'Settle or return the closed consignment.');
spec('commission-proposal', 'commission proposals', 'src/commission.js', 'commission_proposals', ['status', 'week'],
  "SELECT week FROM commission_proposals WHERE status='open' AND week < $1",
  (r, at) => r.status === 'open' && Number(r.week) < weekOf(dayOf(at)), 'Settle every open proposal from an earlier week.', ['week', 'gang_id', 'decree']);
for (const [id, table, field, query] of [
  ['director-situation', 'director_situations', 'terminal', 'SELECT * FROM director_situations WHERE terminal=false ORDER BY created_at,id LIMIT 33'],
  ['director-campaign', 'director_campaigns', 'status', "SELECT * FROM director_campaigns WHERE status='active' ORDER BY created_at,id LIMIT 33"],
]) spec(id, 'directorTick', 'src/director/runtime.js', table, [field, 'expires_at'], query,
  (r, at) => (field === 'terminal' ? r.terminal === false : r.status === 'active') && due(r, 'expires_at', at),
  'Original LIVE/LIMITED_COHORT tick resolves timely canonical consequences or expires/abandons; other modes do not mutate this lifecycle.', ['id'],
  { periodMs: 300000, originalReadLimit: 33, director: true });

export const BACKLOG_REVIEW_TABLES = Object.freeze([...new Set(specs.flatMap(s => [s.table, ...Object.keys(s.dependencies || {})]))].sort());
const INVARIANT_NAMES = ['world graph stack conservation', 'world graph unique custody and provenance', 'world graph object transitions',
  'family operation history', 'family operation custody', 'family operation capital', 'item lot definition integrity',
  'item lot quantity integrity', 'item lot custody integrity', 'item lot lineage parity', 'item lot conservation'];

export function reviewWorldBacklog(snapshot, { logicalAt, sourceRevision, configuration, lifecycleDiagnostics = null, invariants = null } = {}) {
  sourceProof(sourceRevision); assert(Number.isSafeInteger(logicalAt)); assert(configuration && typeof configuration === 'object');
  assert.equal(instant(snapshot.capturedAt), logicalAt, 'Snapshot clock differs from backlog boundary');
  assert.equal(snapshot.stateSha256, digest({ tables: snapshot.tables, sequences: snapshot.sequences }), 'Native snapshot hash mismatch');
  const tables = {}, unknown = [], inventory = [];
  for (const name of BACKLOG_REVIEW_TABLES) {
    if (!Array.isArray(snapshot.tables[name])) continue;
    tables[name] = snapshot.tables[name].map(row => { assert.equal(typeof row, 'string', 'Use complete native snapshot rows'); return JSON.parse(row); });
  }
  const mode = configuration.LIVING_WORLD_DIRECTOR;
  for (const s of specs) {
    assert(sources.get(s.file).includes(compact(s.query)), `Original backlog selector changed: ${s.id}`);
    for (const guard of s.guards || []) assert(sources.get(s.file).includes(compact(guard)), 'Original backlog guard changed');
    assert(sources.get('src/worker.js').includes(s.label), `Original worker no longer registers ${s.label}`);
    const required = { [s.table]: s.fields, ...s.dependencies };
    const missing = Object.entries(required).flatMap(([table, fields]) => !tables[table] ? [table]
      : tables[table].some(row => fields.some(field => !Object.hasOwn(row, field))) ? [table + ':columns'] : []);
    const meta = { id: s.id, workerLabel: s.label, schedulingPeriodMs: s.periodMs, sourceFile: s.file,
      sourceSha256: BACKLOG_SOURCE_PINS[s.file], selector: s.query, originalReadLimit: s.originalReadLimit || null,
      disposition: s.disposition, scope: 'All checkpoint rows matching original selection and documented skip guards; no internal commit order inferred' };
    if (missing.length) { inventory.push({ ...meta, status: 'UNKNOWN', dueIds: null, count: null }); unknown.push({ kind: 'missing-checkpoint-columns', id: s.id, missing }); continue; }
    const ids = [...new Set(tables[s.table].filter(row => s.filter(row, logicalAt, tables)).map(row => key(row, s.keys)))].sort();
    if (s.director && !['LIVE', 'LIMITED_COHORT'].includes(mode)) {
      inventory.push({ ...meta, status: ['DIRECTOR_DISABLED', 'INTERNAL_SIMULATION', 'SHADOW_MODE'].includes(mode) ? 'NON_MUTATING_MODE' : 'UNKNOWN',
        dueIds: null, count: null, observedOverdueIds: ids });
      if (!['DIRECTOR_DISABLED', 'INTERNAL_SIMULATION', 'SHADOW_MODE'].includes(mode)) unknown.push({ kind: 'director-mutation-mode-not-declared', id: s.id });
    } else inventory.push({ ...meta, status: 'OBSERVED', dueIds: ids, count: ids.length });
  }
  const lifecycle = lifecycleDiagnostics?.coordination?.lifecycle || lifecycleDiagnostics?.lifecycle;
  if (lifecycleDiagnostics) assert.equal(lifecycleDiagnostics.logicalAt, logicalAt, 'Lifecycle evidence clock differs');
  const invariantResult = invariants?.checks ? invariants : invariants?.result;
  if (invariants?.logicalAt != null) assert.equal(invariants.logicalAt, logicalAt, 'Invariant evidence clock differs');
  const checks = INVARIANT_NAMES.map(name => invariantResult?.checks?.find(check => check.name === name)).filter(Boolean);
  const liveState = { structuralOrphanOperations: lifecycle?.complete ? lifecycle.structuralOrphanOperations : null,
    orphanedOperations: lifecycle?.complete ? lifecycle.orphanedOperations : null,
    issues: lifecycle?.issues || [], recoveryRequiredOperationIds: lifecycle?.recoveryRequiredOperationIds || null,
    overdueCommandOwnedOperationIds: lifecycle?.overdueOpenOperationIds || null,
    canonicalChecks: checks, failedCanonicalChecks: checks.filter(check => check.ok !== true).map(check => check.name),
    evidenceSha256: digest({ lifecycleDiagnostics, invariants }),
    scope: 'Existing operation lifecycle diagnostics and canonical custody/history/conservation checks; command expiry and positive recovery are separate authorities' };
  if (!lifecycle?.complete) unknown.push({ kind: 'operation-lifecycle-evidence-missing' });
  if (invariants && invariants.logicalAt == null) unknown.push({ kind: 'canonical-invariant-clock-binding-missing' });
  if (checks.length !== INVARIANT_NAMES.length) unknown.push({ kind: 'canonical-invariant-evidence-missing', missing: INVARIANT_NAMES.filter(name => !checks.some(c => c.name === name)) });
  const report = { format: 1, logicalAt, snapshotStateSha256: snapshot.stateSha256, sourceRevision, sourcePins: BACKLOG_SOURCE_PINS,
    configuration, configurationSha256: digest(configuration), inventory, liveState, unknown,
    scope: 'Selected original row-draining lifecycle jobs exercised or reachable in native world workloads. Recurring generators, provider keepers, notification delivery and retention hygiene are not classified as draining lifecycle work.',
    qualification: 'OBSERVATIONS_ONLY' };
  return { ...report, sha256: digest(report) };
}

export function compareWorldBacklogWindows(checkpoints) {
  const comparisons = [];
  for (const [index, current] of checkpoints.entries()) {
    const { sha256: hash, ...body } = current; assert.equal(hash, digest(body), 'Backlog checkpoint changed');
    if (!index) continue;
    const previous = checkpoints[index - 1]; assert(current.logicalAt > previous.logicalAt, 'Backlog windows must advance');
    assert.deepEqual(current.sourcePins, previous.sourcePins, 'Backlog authorities changed across windows');
    assert.equal(current.configurationSha256, previous.configurationSha256, 'Backlog configuration changed across windows');
    const rows = current.inventory.map(row => {
      const before = previous.inventory.find(prior => prior.id === row.id); assert(before);
      if (row.status !== 'OBSERVED' || before.status !== 'OBSERVED') return { id: row.id, status: 'UNKNOWN', beforeStatus: before.status, afterStatus: row.status };
      return { id: row.id, status: row.count > before.count ? 'GROWTH_OBSERVED' : 'NO_COUNT_GROWTH', before: before.count, after: row.count,
        added: row.dueIds.filter(id => !before.dueIds.includes(id)), cleared: before.dueIds.filter(id => !row.dueIds.includes(id)),
        persisting: row.dueIds.filter(id => before.dueIds.includes(id)) };
    });
    const a = previous.liveState.orphanedOperations, b = current.liveState.orphanedOperations;
    comparisons.push({ from: previous.logicalAt, to: current.logicalAt, beforeSha256: previous.sha256, afterSha256: current.sha256, rows,
      liveStateOrphans: { before: a, after: b, status: a == null || b == null ? 'UNKNOWN' : b > a ? 'GROWTH_OBSERVED' : 'NO_COUNT_GROWTH',
        beforeFailedCanonicalChecks: previous.liveState.failedCanonicalChecks, afterFailedCanonicalChecks: current.liveState.failedCanonicalChecks } });
  }
  return { format: 1, observations: checkpoints.length, comparisons,
    unknown: [...(checkpoints.length < 2 ? [{ kind: 'successive-lifecycle-window-checkpoints-missing' }] : []),
      ...checkpoints.filter(row => row.unknown.length).map(row => ({ checkpointSha256: row.sha256, logicalAt: row.logicalAt, unknown: row.unknown }))],
    qualification: 'OBSERVATIONS_ONLY', note: 'The caller selects the actual successive lifecycle windows. Counts are exact with no tolerance; persistent IDs remain visible even at a flat count. No callback completion, resource parity or two endpoint snapshots alone establishes full-window qualification.' };
}
