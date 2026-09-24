// Observer-only adapters for the EXISTING frozen assertions. Never feed results to actors.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { levelOf, M3, MADE, STAKE_LOCKS } from '../src/rules.js';

const DAY = 86400000, digest = value => /^[a-f0-9]{64}$/.test(value || ''), hash = value => sha256(canonicalJson(value));
const sourceFiles = Object.freeze({
  'src/game.js': '7829195c2235b24d2a8e5d0c879e4c58ca31525a5d80884603ce4c15394d7fc4',
  'src/economy.js': 'b8c97f458c20b42e768f56445d3bae4a77fd0221b8939db313b381de5e6ae931',
  'src/accrual.js': 'e91bedfd0d4c4701d029b7f6af73e073266558fa29670de5d85991f42263767e',
  'src/social/gangs.js': 'd768b69b1d6473d650594277637c9625824eb8d43f9ea0ee937ec91fcd918644',
  'src/rules.js': 'fff8a956f608fcdfa834d86767699aa87026abe58ff1fcb5c18d92c9b467d0bb',
  'src/rules.generated.js': '4c86682b7890b557040270613aa4abed4464257936867d2b499b3051b814d11f',
  'src/rules.tail.js': 'ab10af0a70ea476c5f38d16d677daade49840f6a672cde922d841068a7d8b8d5',
  'src/server.js': 'f9789ddc1a8d95c294111a0e76545e903a30f6e6b46c1adc1e292894cdde44f4',
  'src/worker.js': '2937b63311191ca14955b194008894eae08aedfdbeb37f394745948fc1430fba',
  'src/coordination/operations.js': '0e422fa588b74797cd424c83e0829d64f9eb3b759a31ff18250642e05cc00095',
  'src/operations.js': '198f96a02588fb1ed91d8f95664345657b166094f87ae9a69e05b53dcc95d245',
  'src/coordination/knowledge.js': '46aa18d88dbf25e9c80adf2646e71ff4b7501cbaba5b556609e6caabd970e7e3',
  'src/director/runtime.js': 'e6afb1e070646df207087b1d64af9264f857d053123fd720c43b21307e3edad4',
  'src/content/runtime.js': 'be50a85e1fa68b07a3fb253d0a51d1410f0abea096bebce7fe2f456f736161dc',
});
export const WORLD_RECOVERY_REVIEW = Object.freeze({ version: 1, reviewedRevision: '92f09bb436d9e7cacb874adb60f7238c0b1d709d', sourceFiles,
  durationThresholds: { minimumLogicalDays: 90, minimumApplicableSeasonalRollovers: 2, minimumLongestLifecycleExecutions: 2 },
  assertions: [
    'Eligible new/returning actor has a reachable meaningful path or a bounded legal wait',
    'Exhausted prerequisite resources have an existing reachable canonical replenishment path',
    'No dependency cycles, orphaned operations, impossible mysteries or permanently unreachable thresholds after canonical recovery',
    'No permanent Family exclusion or missing authorized Knowledge acquisition/propagation path',
    'Unresolved worker backlog/live-state orphans do not grow across successive lifecycle windows',
  ],
  rules: {
    checkin: 'src/game.js checkinQuoteOf/checkin, withCharacter; src/server.js POST /v1/checkin: living own character; one claim per UTC day; no jail, nerve, item or Family gate. First/lapsed streak>=1 and level>=1 imply pay>=350 even across season resets. Accrual and original workers remain canonical; no guaranteed survival under another actor attack is asserted.',
    ammunition: 'src/economy.js buyAmmo:2000 cash for50 ammo; no additional level, jail or inventory gate. An immediately funded purchase or one sufficient canonical check-in is proved here. Multi-day accumulation must additionally dispose unavoidable intervening losses; a faucet alone does not prove every resource threshold, and OMR is not unlimited.',
    family: 'src/social/gangs.js joinGang/createGang/leaveGang: current membership has a release-only exit; otherwise an existing non-NPC Family below20 is joinable without level or cash. Formation requires level5,25000 cash and an unused valid name/tag. Cash alone does not prove future level5 after a season reset.',
    operations: 'Crew opener may cancel forming/active operations despite participant death/exit. Family cancel/expire recovery skips changed-definition requirements; expiry is a COMMAND, not an expiry worker. Active account, enabled/cohort gate, canRead, bounded role/depositor union and revision<2147483647 still apply. Do not infer these from an expiry timestamp alone.',
    knowledge: 'Current authorized paginated claims establish distribution only. Every applicable acquisition/propagation requirement must join its canonical requirement/claim proof and current principals; grant rows, tokens, public availability and empty searches do not prove future reachability.',
  },
  retainedProofs: ['docs/release/readiness-work/harness-resource-pressure-results.json',
    'docs/release/readiness-work/family-player-policy.md', 'docs/release/readiness-work/resource-capital-lifecycle-summary.json',
    'docs/release/readiness-work/authority-family-results.json', 'docs/release/readiness-work/authority-final-review.json'],
  limits: 'This source review transfers canonical guards, not fixture supplies, measured world outcomes, raw artifact verification or deployment configuration. Other reviewed native paths can join the same assertions without adopting an edge-by-edge full-state graph.' });

export async function verifyWorldRecoverySources({ readFile, sourceRevision }) {
  assert(/^[a-f0-9]{40}$/.test(sourceRevision));
  for (const [file, expected] of Object.entries(sourceFiles)) assert.equal(sha256(await readFile(file)), expected, 'Recovery rule source changed: ' + file);
  return { sourceRevision, reviewSha256: hash(WORLD_RECOVERY_REVIEW), sourceFiles: { ...sourceFiles } };
}
function binding(source, checkpoint) {
  assert.equal(source.reviewSha256, hash(WORLD_RECOVERY_REVIEW)); assert.deepEqual(source.sourceFiles, sourceFiles);
  assert(/^[a-f0-9]{40}$/.test(source.sourceRevision));
  assert(digest(checkpoint.stateSha256) && digest(checkpoint.configurationSha256) && Number.isSafeInteger(checkpoint.logicalAt));
  return { sourceRevision: source.sourceRevision, ...checkpoint };
}
const reference = value => assert(value && typeof value.path === 'string' && value.path && digest(value.sha256), 'Retain an exact evidence reference');
const unique = (values, label) => assert.equal(new Set(values).size, values.length, 'Duplicate ' + label);

// Accept the existing native snapshot format, verify its complete hash, and then
// use only exact relevant rows. No call to readCharacter or /v1/me occurs here.
// roster is the reviewed eligible-account inventory, not all historical retired
// accounts; retain eligibility/exclusion reasoning with the actor enumeration.
export function canonicalRecoveryWitnesses({ source, checkpoint, snapshot, roster, resourceRequirements = [] }) {
  const bound = binding(source, checkpoint);
  assert.equal(snapshot.stateSha256, checkpoint.stateSha256);
  assert.equal(hash({ tables: snapshot.tables, sequences: snapshot.sequences }), checkpoint.stateSha256);
  const rows = table => { assert(Array.isArray(snapshot.tables[table]), 'Missing checkpoint table ' + table); return snapshot.tables[table].map(JSON.parse); };
  const characters = rows('characters'), accounts = rows('accounts'), persistent = rows('account_persistent'), families = rows('gangs'), memberships = rows('gang_members');
  unique(roster, 'roster'); const witnesses = [];
  const actor = accountId => {
    const live = characters.filter(row => row.account_id === accountId && row.alive && !row.is_npc);
    return accounts.some(row => row.id === accountId && row.status === 'active') && live.length === 1
      && persistent.some(row => row.account_id === accountId) ? live[0] : null;
  };
  const emit = (id, scope, goal, result) => witnesses.push({ id, scope, goal, ...bound, method: 'pinned-canonical-guards',
    reviewSha256: source.reviewSha256, ...result });
  const cashPath = (ch, amount) => {
    if (!ch || !Number.isSafeInteger(amount) || amount < 0 || !Number.isFinite(Number(ch.cash)) || Number(ch.cash) < 0
      || !Number.isFinite(Number(ch.respect)) || Number(ch.respect) < 0 || !Number.isInteger(ch.checkin_day)) return null;
    const day = Math.floor(checkpoint.logicalAt / DAY), cash = Math.floor(Number(ch.cash));
    if (ch.checkin_day > day) return null;
    if (cash >= amount) return { status: 'REACHABLE', dueAt: checkpoint.logicalAt, canonicalActions: [] };
    const streak = ch.checkin_day === day - 1 ? (Number(ch.streak) || 0) + 1 : Math.max(1, Math.floor((Number(ch.streak) || 0) / 2));
    const pay = levelOf(Number(ch.respect)) * (250 + 100 * Math.min(streak, 7));
    if (ch.checkin_day !== day && Number.isSafeInteger(pay) && pay >= 350 && cash + pay >= amount)
      return { status: 'REACHABLE', dueAt: checkpoint.logicalAt, canonicalActions: [{ path: '/v1/checkin', maximumClaims: 1, quotedCash: pay }] };
    // Existing cash may face forced Law/loan losses before tomorrow. Use only the
    // fresh minimum reward, not an invented persistent savings balance.
    if (amount <= 350) return { status: 'BOUNDED_WAIT', dueAt: (day + 1) * DAY,
      canonicalActions: [{ path: '/v1/checkin', maximumClaims: 1, minimumCashPerClaim: 350 }] };
    return null;
  };
  for (const accountId of roster) {
    const ch = actor(accountId);
    // Meaningful progress is the fresh check-in action, not just already owning cash.
    const progress = ch && cashPath({ ...ch, cash: 0 }, 1);
    emit('actor:' + accountId, 'actors', 'meaningful-action-or-legal-wait', progress || { status: 'UNKNOWN', reason: 'No active living original character/check-in guards; entry/heir path needs its own canonical proof' });
    const own = ch && memberships.find(row => row.character_id === ch.id), family = own && families.find(row => row.id === own.gang_id);
    const vacancy = families.find(row => !row.npc_flag && memberships.filter(member => member.gang_id === row.id).length < M3.GANG_MAX_MEMBERS);
    let access = { status: 'UNKNOWN', reason: 'No current membership or public vacancy; formation/progression requires a specific canonical path' };
    if (ch && family) access = { status: 'REACHABLE', familyId: family.id, canonicalActions: [{ path: '/v1/gangs/leave' }], reason: 'Current Family access and legal release-only exit' };
    else if (ch && !own && vacancy) access = { status: 'REACHABLE', familyId: vacancy.id, canonicalActions: [{ path: '/v1/gangs/' + vacancy.id + '/join' }] };
    // An immediately satisfiable formation has no future rank/season assumption.
    else if (ch && !own && levelOf(Number(ch.respect)) >= M3.GANG_FOUND_LEVEL && Number(ch.cash) >= M3.GANG_FOUND_COST) {
      let candidate = null;
      for (let index = 0; index < 36 ** 4; index++) {
        const tag = index.toString(36).toUpperCase().padStart(4, '0'), name = 'RC1 Recovery ' + tag;
        if (!families.some(row => row.tag === tag || row.name === name)) { candidate = { name, tag }; break; }
      }
      if (candidate) access = { status: 'REACHABLE', canonicalActions: [{ path: '/v1/gangs', body: candidate }], reason: 'Present canonical level/cash/name/tag guards satisfy formation' };
    }
    emit('family:' + accountId, 'family', 'family-access-or-legal-exit', access);
  }
  unique(resourceRequirements.map(row => row.id), 'resource requirement');
  for (const requirement of resourceRequirements) {
    assert(roster.includes(requirement.accountId)); assert(Number.isSafeInteger(requirement.quantity) && requirement.quantity > 0);
    assert.equal(requirement.goal, requirement.resource + '>=' + requirement.quantity, 'Resource goal must bind its actual quantity');
    const ch = actor(requirement.accountId); let path = null;
    if (requirement.resource === 'cash') path = cashPath(ch, requirement.quantity);
    if (requirement.resource === 'ammo' && ch && Number.isSafeInteger(ch.ammo) && ch.ammo >= 0) {
      const purchases = Math.ceil(Math.max(0, requirement.quantity - ch.ammo) / 50);
      path = cashPath(ch, purchases * 2000);
      if (path && purchases) path.canonicalActions.push({ path: '/v1/armory/ammo', maximumPurchases: purchases, cashPerPurchase: 2000, ammoPerPurchase: 50 });
    }
    emit(requirement.id, 'resources', requirement.goal, path || { status: 'UNKNOWN', reason: 'This resource/guard needs an applicable canonical replenishment proof; no unlimited OMR/material faucet inferred' });
  }
  return { ...bound, witnesses, matrixQualifying: false };
}

// Inventories/review witnesses may be adapted from existing retained native paths,
// a source-pinned review, or evaluateCanonicalReachability. The runner independently
// verifies referenced artifact bytes and conclusions. This function checks joins;
// it neither manufactures reviews nor demands another native path graph.
export function joinWorldCheckpointAssertions({ manifest, source, checkpoint, diagnostics, diagnosticEvidence, roster,
  inventories = {}, witnesses = [], lifecycleWindows = null }) {
  const bound = binding(source, checkpoint); assert.deepEqual(manifest.deadWorldAssertions, WORLD_RECOVERY_REVIEW.assertions);
  reference(diagnosticEvidence); assert.deepEqual(diagnosticEvidence.binding, bound);
  assert.equal(diagnosticEvidence.contentSha256, hash(diagnostics), 'Diagnostic content differs from its checkpoint binding');
  assert.equal(diagnostics.logicalAt, checkpoint.logicalAt);
  const expected = {
    actors: roster.map(id => 'actor:' + id), family: roster.map(id => 'family:' + id),
    objectives: diagnostics.objectiveInventory.subjects.map(row => row.type + ':' + row.id),
  };
  unique(witnesses.map(row => row.scope + ':' + row.id), 'witness');
  const scopeResults = {};
  for (const scope of ['actors', 'resources', 'objectives', 'family', 'knowledge']) {
    const inventory = inventories[scope];
    if (!inventory) { scopeResults[scope] = { status: 'UNKNOWN', reason: 'Missing complete checkpoint obligation inventory' }; continue; }
    reference(inventory.evidence); assert.deepEqual(inventory.binding, bound); unique(inventory.obligations.map(row => row.id), 'obligation');
    if (expected[scope]) assert.deepEqual(inventory.obligations.map(row => row.id).sort(), expected[scope].sort(), 'Checkpoint subject inventory mismatch: ' + scope);
    const results = inventory.obligations.map(obligation => {
      assert(typeof obligation.goal === 'string' && obligation.goal);
      const proof = witnesses.find(row => row.id === obligation.id && row.scope === scope);
      if (!proof) return { ...obligation, status: 'UNKNOWN', reason: 'No applicable positive witness' };
      for (const [key, value] of Object.entries(bound)) assert.deepEqual(proof[key], value, 'Witness binding mismatch: ' + key);
      assert.equal(proof.goal, obligation.goal, 'Recovery cannot substitute for another goal');
      assert(['REACHABLE', 'BOUNDED_WAIT', 'UNKNOWN'].includes(proof.status));
      if (proof.status === 'BOUNDED_WAIT') assert(Number.isSafeInteger(proof.dueAt) && proof.dueAt > checkpoint.logicalAt);
      if (proof.method === 'pinned-canonical-guards') assert.equal(proof.reviewSha256, source.reviewSha256);
      else { assert(['retained-native-path', 'source-pinned-review'].includes(proof.method)); reference(proof.evidence); }
      return { ...obligation, status: proof.status };
    });
    const complete = inventory.complete === true && (scope !== 'objectives' || diagnostics.objectiveInventory.tablesComplete)
      && results.every(row => row.status !== 'UNKNOWN');
    scopeResults[scope] = { status: complete ? 'SATISFIED' : 'UNKNOWN', results, inventoryEvidence: inventory.evidence };
  }
  const structural = diagnostics.coordination.lifecycle;
  const status = scopes => scopes.every(scope => scopeResults[scope].status === 'SATISFIED') ? 'SATISFIED' : 'UNKNOWN';
  const assertions = [status(['actors']), status(['resources']),
    structural.complete && structural.structuralOrphanOperations === 0 ? status(['objectives']) : structural.structuralOrphanOperations > 0 ? 'FAILED' : 'UNKNOWN',
    status(['family', 'knowledge']), lifecycleWindows?.backlogStatus || 'UNKNOWN'];
  if (lifecycleWindows) {
    assert.deepEqual(lifecycleWindows.finalCheckpoint, checkpoint);
    assert.equal(lifecycleWindows.sourceRevision, source.sourceRevision); assert.equal(lifecycleWindows.configurationSha256, checkpoint.configurationSha256);
    assert(['SATISFIED', 'FAILED', 'UNKNOWN'].includes(lifecycleWindows.backlogStatus));
  }
  return { ...bound, scopes: scopeResults,
    assertions: assertions.map((result, index) => ({ assertion: manifest.deadWorldAssertions[index], status: result })),
    complete: assertions.every(result => result === 'SATISFIED'),
    permanentDeadlocks: assertions.every(result => result === 'SATISFIED') ? 0 : null,
    unknownIsNotPermanentFailure: true, matrixQualifying: false };
}

export const WORLD_DURATION_CANDIDATES = Object.freeze([
  { id: 'season', durationMs: 28 * DAY, source: 'src/worker.js runSeasonRollover / rules seasonIdxOf', applicability: 'Local world population; count distinct world seasons, never one rollover per actor' },
  { id: 'made-membership', durationMs: MADE.MS, source: 'src/rules.tail.js MADE/isMade', applicability: 'Review configured paid/status rail and workload; an empty balance alone is not a disabled-rail attestation' },
  ...STAKE_LOCKS.TIERS.map(tier => ({ id: 'stake-lock-' + tier.id, durationMs: tier.days * DAY,
    source: 'src/rules.tail.js STAKE_LOCKS/stakeLockActive', applicability: 'Review configured stake rail and workload; expiry predicate is not an automatic unbond or withdrawal' })),
]);

// This is a join onto retained execution evidence, not proof that an elapsed timer
// executed. Full source/config applicability inventory and reviewed stabilization
// series stay explicit inputs; the frozen manifest supplies all numerical gates.
export function evaluateWorldDuration({ manifest, source, configurationSha256, startAt, endAt,
  lifecycleReview, executions = [], seasonalRollovers = [], workerCoverage, windows = [], stabilizationReview = null }) {
  assert.equal(source.reviewSha256, hash(WORLD_RECOVERY_REVIEW)); assert(digest(configurationSha256));
  assert.deepEqual(source.sourceFiles, sourceFiles);
  assert(Number.isSafeInteger(startAt) && Number.isSafeInteger(endAt) && endAt >= startAt);
  const threshold = manifest.thresholds, bound = { sourceRevision: source.sourceRevision, configurationSha256 };
  for (const [key, value] of Object.entries(WORLD_RECOVERY_REVIEW.durationThresholds)) assert.equal(threshold[key], value, 'Frozen duration threshold changed');
  reference(lifecycleReview.evidence); assert.deepEqual(lifecycleReview.binding, bound);
  unique(lifecycleReview.lifecycles.map(row => row.id), 'lifecycle');
  // Candidates are a reviewed warning list, not a newly mandated enabled feature.
  // Every one needs an explicit applicability disposition in the retained review.
  for (const candidate of WORLD_DURATION_CANDIDATES) {
    const row = lifecycleReview.lifecycles.find(entry => entry.id === candidate.id); assert(row, 'Missing lifecycle applicability: ' + candidate.id);
    assert.equal(row.durationMs, candidate.durationMs, 'Original lifecycle duration changed');
  }
  const unresolved = lifecycleReview.lifecycles.filter(row => !['APPLICABLE', 'NOT_APPLICABLE'].includes(row.applicability));
  for (const row of lifecycleReview.lifecycles) {
    assert(Number.isSafeInteger(row.durationMs) && row.durationMs > 0); reference(row.applicabilityEvidence);
  }
  const applicable = lifecycleReview.lifecycles.filter(row => row.applicability === 'APPLICABLE');
  const windowLifecycle = applicable.find(row => row.id === lifecycleReview.stabilizationWindowLifecycleId);
  const longestMs = Math.max(0, ...applicable.map(row => row.durationMs)), longest = applicable.filter(row => row.durationMs === longestMs);
  unique(executions.map(row => row.lifecycleId + ':' + row.cycleId), 'execution cycle');
  for (const execution of executions) {
    const lifecycle = applicable.find(row => row.id === execution.lifecycleId); assert(lifecycle, 'Execution belongs to an unqualified lifecycle');
    for (const key of ['startedAt', 'dueAt', 'completedAt']) assert(Number.isSafeInteger(execution[key]));
    assert(execution.startedAt >= startAt && execution.completedAt <= endAt && execution.completedAt >= execution.dueAt);
    assert.equal(execution.dueAt - execution.startedAt, lifecycle.durationMs, 'Rewritten or partial original lifetime');
    assert(['canonical-command', 'original-worker', 'canonical-expiry-predicate'].includes(execution.authority));
    reference(execution.openingEvidence); reference(execution.completionEvidence);
  }
  const cycles = longest.map(row => ({ lifecycleId: row.id, executions: executions.filter(entry => entry.lifecycleId === row.id).length }));
  unique(seasonalRollovers.map(row => row.season), 'world seasonal boundary');
  for (const row of seasonalRollovers) {
    assert(Number.isSafeInteger(row.season) && row.logicalAt >= startAt && row.logicalAt <= endAt);
    assert.equal(Math.floor(row.logicalAt / (28 * DAY)), row.season); assert.equal(row.authority, 'original-worker'); reference(row.evidence);
  }
  assert.deepEqual(workerCoverage.binding, bound); reference(workerCoverage.evidence);
  const workersComplete = workerCoverage.complete === true && workerCoverage.fromLogicalAt === startAt && workerCoverage.throughLogicalAt === endAt;
  let backlogStatus = 'UNKNOWN';
  for (const [index, window] of windows.entries()) {
    assert(Number.isSafeInteger(window.fromLogicalAt) && Number.isSafeInteger(window.throughLogicalAt));
    assert(digest(window.checkpoint.stateSha256));
    assert(window.fromLogicalAt >= startAt && window.fromLogicalAt < window.throughLogicalAt && window.throughLogicalAt <= endAt);
    assert.equal(window.checkpoint.logicalAt, window.throughLogicalAt); assert.equal(window.checkpoint.configurationSha256, configurationSha256);
    reference(window.evidence); assert(Number.isSafeInteger(window.unresolvedBacklog) && window.unresolvedBacklog >= 0);
    assert(Number.isSafeInteger(window.liveStateOrphans) && window.liveStateOrphans >= 0);
    if (index) assert.equal(window.fromLogicalAt, windows[index - 1].throughLogicalAt, 'Nonconsecutive lifecycle windows');
  }
  if (windowLifecycle && windows.length >= 2 && windows.every(window => window.complete
    && window.throughLogicalAt - window.fromLogicalAt >= windowLifecycle.durationMs)) {
    backlogStatus = windows.slice(1).every((window, index) => window.unresolvedBacklog <= windows[index].unresolvedBacklog
      && window.liveStateOrphans <= windows[index].liveStateOrphans) ? 'SATISFIED' : 'FAILED';
  }
  let stable = false;
  if (stabilizationReview) {
    reference(stabilizationReview.evidence); assert.deepEqual(stabilizationReview.binding, bound);
    assert.deepEqual(stabilizationReview.windowEvidence, windows.map(window => window.evidence));
    assert.deepEqual(stabilizationReview.axes, ['concentration', 'backlog', 'reachability']);
    assert(typeof stabilizationReview.criterion === 'string' && stabilizationReview.criterion, 'Retain the reviewed criterion; invent no numerical tolerance');
    stable = stabilizationReview.conclusion === 'STABLE' && windows.length >= 2 && windows.at(-1).throughLogicalAt === endAt;
  }
  const minimumDaysMet = endAt - startAt >= threshold.minimumLogicalDays * DAY;
  const applicableSeasons = applicable.some(row => row.id === 'season');
  const seasonalMet = !applicableSeasons || seasonalRollovers.length >= threshold.minimumApplicableSeasonalRollovers;
  const cyclesMet = longest.length > 0 && cycles.every(row => row.executions >= threshold.minimumLongestLifecycleExecutions);
  return { ...bound, minimumDaysMet, seasonalMet, cyclesMet, longestMs, cycles, workersComplete,
    applicabilityComplete: lifecycleReview.complete === true && !unresolved.length, unresolvedApplicability: unresolved.map(row => row.id),
    backlogStatus, stable, finalCheckpoint: windows.at(-1)?.checkpoint || null,
    complete: minimumDaysMet && seasonalMet && cyclesMet && workersComplete && lifecycleReview.complete === true
      && !unresolved.length && backlogStatus === 'SATISFIED' && stable,
    matrixQualifying: false };
}
