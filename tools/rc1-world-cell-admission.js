// Read-only admission of existing evidence. No runner, policy or acceptance target changes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import crypto from 'node:crypto';
import { canonicalJson, sha256, validateScenarioManifest, verifyArtifactIndex } from './rc1-native-proof.js';
import { sha256 as resourceDigest } from './rc1-resource-journal.js';
import { verifyWorldRecoverySources } from './rc1-world-qualification.js';
import { reviewWorldCheckpointSeries } from './rc1-world-checkpoint-series.js';
import { reviewWorldMetrics } from './rc1-world-metrics-review.js';
import { measureWorldWorkerDuration } from './rc1-world-duration-evidence.js';
import { createMysteryPolicy } from './rc1-mystery-policies.js';
import { createAggressionPolicy } from './rc1-aggression-policy.js';
import { assessFamilyInitialState, createFamilyWorldAdapter } from './rc1-family-world-adapter.js';
import { createChurnPolicy } from './rc1-churn-policy.js';
import { assessCohortBaseline, createCohortPolicy } from './rc1-cohort-policy.js';
import { createPressureWorldAdapter } from './rc1-pressure-world-adapter.js';
import { createScarcityInitialization } from './rc1-scarcity-initialization.js';
import { createAllianceWorldAdapter } from './rc1-alliance-world-adapter.js';
import { createWarWorldAdapter } from './rc1-war-world-adapter.js';
import { createMarketWorldAdapter } from './rc1-market-world-adapter.js';
import { createLawWorldAdapter } from './rc1-law-world-adapter.js';

const DAY = 86400000, hash = value => sha256(canonicalJson(value));
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const answer = (status, reason, observed = null) => ({ status, reason, observed });
const observed = (condition, reason, data = null) => answer(condition ? 'SATISFIED' : 'FAILED', reason, data);
const unknown = (reason, data = null) => answer('UNKNOWN', reason, data);
const AUTHORITY_PATH = 'docs/release/readiness-work/authority-final-review.json';

export function cellAllianceControlsMatch(controls, days, http) {
  return controls.every(control => http.some(row => row.accountId === control.accountId && row.request.path === control.path
    && row.request.method === 'GET' && row.logicalAt === days.find(day => day.day === control.day)?.logicalAt
    && row.status === 404 && row.body.error === 'coordination_unavailable'));
}

export async function reviewCellMarketConcurrency(groups, { named, readSource, sourceRevision, trace }) {
  let mixed = 0, expiryOverlap = 0;
  for (const { event, journal } of groups) {
    if (event.caller?.kind !== 'market-mixed-lifecycle') continue;
    const evidence = await named(journal.quiescentGroupArtifact), root = event.traceRoot;
    assert(evidence, 'Missing original market aggregate');
    assert.deepEqual(evidence.identity, event);
    const { sha256: digest, ...descriptor } = root; assert.equal(hash(descriptor), digest);
    const stateHash = ({ boundary, ...state }) => resourceDigest(state);
    assert.equal(stateHash(evidence.before), root.beforeHash); assert.equal(stateHash(evidence.after), root.afterHash);
    for (const [field, data] of [['requestsSha256', evidence.requests], ['outcomesSha256', evidence.outcomes], ['traceSha256', evidence.trace]])
      assert.equal(hash(data), root[field], 'Market aggregate trace root differs');
    assert.equal(evidence.outcomes.length, evidence.requests.length);
    let maximum = 0, overlap = false; const active = new Set(), intervals = new Map();
    for (const [position, row] of evidence.trace.entries()) {
      if (row.phase === 'REQUEST_DISPATCH') {
        assert(!intervals.has(row.requestIndex)); active.add(row.requestIndex); intervals.set(row.requestIndex, [position, null]);
        maximum = Math.max(maximum, active.size);
      }
      if (['REQUEST_RETURNED', 'REQUEST_THREW'].includes(row.phase)) {
        assert(active.delete(row.requestIndex)); intervals.get(row.requestIndex)[1] = position;
      }
      if (row.phase === 'COMPANION_DISPATCH' && active.size) overlap = true;
    }
    assert.equal(active.size, 0);
    assert.equal(intervals.size, evidence.requests.length);
    const fresh = evidence.requests.map((item, i) => ({ ...item, requestIndex: i, response: evidence.outcomes[i].value }))
      .filter((item, i) => evidence.outcomes[i].status === 'fulfilled' && item.response?.status === 200 && item.response.replayed === false);
    assert.equal(new Set(fresh.map(row => row.accountId + ':' + row.request.idempotencyKey)).size, fresh.length, 'Duplicate fresh market effect');
    const phases = event.caller.phases;
    for (const phase of phases) assert.equal(phase.accountId, evidence.requests[phase.requestIndex].accountId);
    const duplicate = event.caller.duplicateOf;
    const originalIndex = row => row.requestIndex === evidence.requests.length - 1 && duplicate != null ? duplicate : row.requestIndex;
    const byPhase = phase => fresh.filter(row => phases.some(item => item.phase === phase && item.requestIndex === originalIndex(row)));
    const concurrent = row => {
      const [from, through] = intervals.get(row.requestIndex);
      return [...intervals].some(([i, [otherFrom, otherThrough]]) => evidence.requests[i].accountId !== row.accountId
        && from < otherThrough && otherFrom < through);
    };
    const competitors = phases.filter(row => row.phase === 'compete').map(row => evidence.requests[row.requestIndex]);
    const listingId = competitors[0]?.request.path.split('/')[3];
    const originalListing = evidence.before.tables?.market_listings?.find(row => row.id === listingId);
    const oneUnit = originalListing && Number(originalListing.qty) === 1;
    const competition = competitors.length > 1 && new Set(competitors.map(row => row.request.path)).size === 1
      && oneUnit && byPhase('compete').length === 1;
    if (duplicate !== undefined && duplicate !== null) {
      assert.deepEqual(evidence.requests.at(-1), evidence.requests[duplicate], 'Market duplicate identity differs');
      const a = evidence.outcomes[duplicate], b = evidence.outcomes.at(-1);
      assert.equal(a.status, 'fulfilled'); assert.equal(b.status, 'fulfilled');
      const stripReplay = ({ replayed, ...body }) => body;
      const inProgress = value => value.status === 409 && value.body.error === 'in_progress';
      assert(inProgress(a.value) || inProgress(b.value)
        || (b.value.replayed === true || a.value.replayed === true) && b.value.status === a.value.status && same(stripReplay(b.value.body), stripReplay(a.value.body)),
      'Market duplicate lacks its original replay/in-progress outcome');
    }
    if (maximum > 1 && competition && ['sale', 'compete', 'refund-cancel', 'fill'].every(phase => byPhase(phase).some(concurrent))
      && byPhase('refund-cancel').some(row => row.response.body.refunded > 0)
      && byPhase('fill').some(row => row.response.body.delivered > 0 && row.response.body.gross > 0)) mixed++;
    if (root.format === 2) {
      assert.equal(hash(evidence.companions), root.companionsSha256);
      assert.equal(hash(evidence.companionOutcomes), root.companionOutcomesSha256);
      const companion = evidence.companions[0];
      assert.equal(companion.kind, 'original-worker-job'); assert.equal(companion.label, 'market sweep');
      assert.equal(companion.logicalAt, event.context.logicalAt);
      for (const [file, digest] of [[companion.sourceFile, companion.sourceSha256], [companion.handlerSourceFile, companion.handlerSourceSha256]]) {
        const raw = String(await readSource(sourceRevision, file)), lf = raw.replaceAll('\r\n', '\n');
        assert([sha256(raw), sha256(lf), sha256(lf.replaceAll('\n', '\r\n'))].includes(digest), 'Market companion source differs');
      }
      // The existing exact lineage classifier supplies expiry movements; a due
      // sweep without an actual expiration does not establish expiry contention.
      const expired = journal.orderExpiry?.movements?.length > 0;
      if (overlap && expired && evidence.companionOutcomes.every(row => row.status === 'fulfilled')
        && trace?.jobs.some(job => job.label === 'market sweep' && job.logicalAt === companion.logicalAt && job.status === 'RETURNED')) expiryOverlap++;
    }
  }
  return mixed > 0 && expiryOverlap > 0 ? answer('SATISFIED', 'Actual mixed HTTP overlap and source-bound original expiry companion', { mixed, expiryOverlap })
    : unknown('Missing actual mixed HTTP overlap or an overlapping original sweep with observed expiry', { mixed, expiryOverlap });
}

// The existing authoritative review is a shared source-level proof. It is not
// repeated per cell. Its original bytes, inputs and source applicability must all
// remain available; changed source or missing proof is never an implicit waiver.
export async function reviewCellAuthority({ sourceRevision, readSource, readExternal }) {
  const bytes = await readSource(sourceRevision, AUTHORITY_PATH), review = JSON.parse(String(bytes));
  assert.equal(review.status, 'SOURCE_PHASE_AUTHORITY_REVIEW_COMPLETE');
  assert.equal(review.cleanAtExecution, true);
  assert(Array.isArray(review.sourceFiles) && review.sourceFiles.length > 0);
  assert.equal(new Set(review.sourceFiles.map(row => row.path)).size, review.sourceFiles.length);
  const changed = [];
  for (const file of review.sourceFiles) {
    const original = String(await readSource(review.source, file.path)), lf = original.replaceAll('\r\n', '\n');
    assert([sha256(original), sha256(lf), sha256(lf.replaceAll('\n', '\r\n'))].includes(file.sha256), 'Authority reviewed source hash differs: ' + file.path);
    if (String(await readSource(sourceRevision, file.path)).replaceAll('\r\n', '\n') !== lf) changed.push(file.path);
  }
  if (changed.length) return unknown('Shared authority review needs applicability for changed source', { changed });
  const references = [...review.inputs, ...review.evidence.flatMap(row => row.path ? [row] : row.artifacts), review.rawSourceAndDiagnosticMap];
  for (const ref of references) {
    const raw = await readExternal(ref);
    assert.equal(sha256(raw), ref.sha256, 'Authority proof bytes differ: ' + ref.path);
    if (ref.bytes !== undefined) assert.equal(Buffer.byteLength(raw), ref.bytes, 'Authority proof size differs: ' + ref.path);
    for (const marker of ref.requiredSuccessMarkers || []) assert(String(raw).includes(marker), 'Missing original authority success marker');
  }
  const c = review.backendConclusion;
  return observed(c.status === 'SCOPED_BACKEND_AUTHORITY_REVIEW_COMPLETE' && c.uncoveredRoutes === 0
    && c.uncoveredCommandFamilies === 0 && c.unresolvedCriticalOrHigh === 0 && c.roleCommandMatrixComplete
    && c.securityPolicyReviewComplete && review.routes.length === review.counts.routes
    && review.routes.every(row => row.status === 'SOURCE_AND_EXECUTED_EVIDENCE_MAPPED')
    && review.commandMatrix.every(row => ['PASS_SCOPED_RECONCILED', 'NOT_ISSUED_CURRENT_PROJECTION_DIRECT_API_REVIEWED'].includes(row.status)
      && (row.missingExecutableProofsForCurrentAuthoredCommandScope || []).length === 0),
  'Existing unchanged-source backend authorization/replay review; deployment and external activation remain separate',
  { source: review.source, appliedSource: sourceRevision, review: { path: AUTHORITY_PATH, sha256: sha256(bytes) }, verifiedReferences: references.length });
}

// Pure policy predicates use actual retained selections and restored selector
// state. Unsupported adapters remain UNKNOWN, with their existing evidence named.
// No minimum number of mixed opportunities, all-resource extreme, or additional
// combat branch is introduced here.
export function reviewCellPolicy({ scenarioId, population, seed, initial, final, player, activity, prepared = null, snapshot = null,
  artifacts = {}, configuration = {}, http = [], lawReceipts = [], marketOverlap = null }) {
  if (!initial || !final || !player) return unknown('Missing original policy or player artifacts');
  const roster = final.roster;
  if (!Array.isArray(roster) || new Set(roster).size !== roster.length
    || (scenarioId === 'high_player_churn' ? initial.roster?.length !== population : roster.length !== population))
    return unknown('Declared population cannot be joined to the retained actor roster');
  if (!same(player.days, final.days) || !same(player.metrics, final.metrics)) return answer('FAILED', 'Player and policy totals disagree');
  if (initial.roster && scenarioId !== 'high_player_churn') assert.deepEqual(initial.roster, roster, 'Measured roster changed');
  const family = ['family_monopoly', 'fragmented_families'].includes(scenarioId);
  const supported = ['quiet_world', 'high_mystery_participation', 'low_mystery_participation', 'high_aggression', 'family_monopoly', 'fragmented_families',
    'high_player_churn', 'mostly_new_players', 'mostly_veteran_players', 'resource_scarcity', 'resource_abundance',
    'coordinated_alliance', 'multi_family_war', 'market_stress', 'law_pressure'];
  if (!supported.includes(scenarioId)) return unknown('Actual policy evidence requires its scenario-specific admission join',
    { scenarioId, artifacts: {
      family_monopoly: ['family-prepared.json', 'family-final.json', 'initial.json'],
      fragmented_families: ['family-prepared.json', 'family-final.json', 'initial.json'],
      resource_scarcity: ['scarcity-initialization.json', 'pressure-prepared.json', 'initial.json'],
      resource_abundance: ['pressure-prepared.json', 'pressure-final.json', 'initial.json'],
      high_player_churn: ['churn-final.json', 'churn-week-*.json'],
      mostly_new_players: ['cohort-baseline.json', 'cohort-final.json', 'cohort-entry-*.json'],
      mostly_veteran_players: ['cohort-baseline.json', 'cohort-final.json', 'cohort-entry-*.json'],
      coordinated_alliance: ['alliance-final.json', 'alliance-day-*-checkpoint.json'],
      multi_family_war: ['war-prepared.json', 'war-final.json', 'war-day-*.json'],
      market_stress: ['market-final.json', 'restricted-resource-group-*.json'],
      law_pressure: ['law-final.json', 'law-day-*.json'],
    }[scenarioId] || [] });
  const days = final.days.filter(day => day.logicalAt >= initial.logicalAt && day.logicalAt <= final.logicalAt);
  if (!days.length) return unknown('No retained measured daily activity');
  if (Number.isSafeInteger(initial.lastDay) && Number.isSafeInteger(final.epoch)) {
    const expectedDays = Array.from({ length: Math.max(0, Math.floor((final.logicalAt - final.epoch) / DAY) - initial.lastDay) },
      (_, i) => initial.lastDay + i + 1);
    assert.deepEqual(days.filter(day => day.day > initial.lastDay).map(day => day.day), expectedDays, 'Missing or repeated measured daily session');
    for (const day of days) assert.equal(day.logicalAt, final.epoch + day.day * DAY, 'Daily actor clock differs');
  }
  const expectedSelected = ['quiet_world', 'high_mystery_participation', 'low_mystery_participation'].includes(scenarioId) ? Math.floor(population / 10) : population;
  for (const day of days) {
    if (day.selectedActors.length !== expectedSelected || new Set(day.selectedActors).size !== expectedSelected
      || !day.selectedActors.every(id => roster.includes(id))) return answer('FAILED', 'Actual selected roster differs from the declared integer policy');
    if (!day.selectedActors.every(id => activity.has(day.logicalAt + ':' + id)))
      return unknown('Selected identities lack an observed fresh meaningful action at the daily session', { day: day.day });
  }
  const summaries = [];
  const fresh = http.filter(row => row.status === 200 && row.replayed === false);
  const matches = receipt => http.some(row => row.accountId === receipt.accountId
    && same(row.request, receipt.request) && row.status === receipt.status
    && (!receipt.bodySha256 || receipt.bodySha256 === row.bodySha256)
    && (!receipt.body || same(receipt.body, row.body)));
  if (family) {
    if (!prepared || !snapshot || !initial.familyActors || !final.familyAdapter) return unknown('Missing retained Family preparation/initial snapshot');
    const assessment = assessFamilyInitialState(prepared.plan, initial.familyActors, prepared.views);
    assert.deepEqual(assessment, prepared.assessment, 'Family preparation assessment differs');
    const families = snapshot.tables.gangs.map(JSON.parse), members = snapshot.tables.gang_members.map(JSON.parse);
    const characters = snapshot.tables.characters.map(JSON.parse);
    for (const view of prepared.views) {
      const actual = families.find(row => row.id === view.gang.id);
      assert(actual && String(actual.treasury) === String(view.gang.treasury), 'Prepared treasury differs from measured baseline');
      const actualMembers = members.filter(row => row.gang_id === actual.id);
      assert.deepEqual(actualMembers.map(row => [row.character_id, row.role]).sort(), view.gang.members.map(row => [row.id, row.role]).sort(),
        'Prepared Family membership differs from measured baseline');
      for (const member of actualMembers) assert.equal(Number(characters.find(row => row.id === member.character_id)?.cash), 0,
        'Initial Family cash was not concentrated');
    }
    const adapter = createFamilyWorldAdapter({ scenario: scenarioId, seed, roster: final.familyActors }).restore(final.familyAdapter);
    const summary = adapter.summary();
    if (summary.pending || summary.unresolvedResponses) return unknown('Unresolved Family policy response');
    summaries.push({ assessment, summary });
  } else if (scenarioId === 'high_player_churn') {
    if (!final.churn || !initial.churn) return unknown('Missing retained churn cursor');
    const adapter = createChurnPolicy(final.churn.configuration).restore(final.churn), summary = adapter.summary();
    if (summary.pendingEnrollments || summary.registeredWithoutCharacter) return unknown('Pending ordinary churn enrollment');
    assert.equal(summary.currentCohort, population);
    const weeks = final.churn.weeks;
    for (const week of weeks.filter(row => row.logicalAt >= initial.logicalAt)) {
      const from = final.churn.configuration.epochAt + (week.week - 1) * 7 * DAY;
      const active = new Set();
      for (const day of final.days.filter(row => row.logicalAt >= from && row.logicalAt < week.logicalAt))
        for (const id of day.selectedActors) if (activity.has(day.logicalAt + ':' + id)) active.add(id);
      assert.deepEqual([...active].sort(), week.activeAccountIds, 'Weekly churn denominator differs from observed active sessions');
    }
    summaries.push(summary);
  } else if (['mostly_new_players', 'mostly_veteran_players'].includes(scenarioId)) {
    const baseline = artifacts['cohort-baseline.json'];
    if (!baseline || !snapshot || !final.cohortPolicies) return unknown('Missing original cohort baseline/provenance');
    const assessment = assessCohortBaseline(baseline.plan, baseline.observations);
    assert.deepEqual(assessment, baseline.assessment);
    if (!assessment.ready) return unknown('Required public starting progression was not established', assessment);
    const characters = snapshot.tables.characters.map(JSON.parse);
    for (const row of baseline.observations) {
      if (!artifacts[row.provenance.evidenceRef]) return unknown('Missing original cohort provenance: ' + row.provenance.evidenceRef);
      const ch = characters.find(ch => ch.account_id === row.accountId && ch.alive && !ch.is_npc);
      assert(ch && Number(ch.respect) === row.character.respect, 'Cohort baseline differs from actual native progression');
      const state = final.cohortPolicies[row.accountId];
      if (!state) return unknown('Missing cohort selector cursor');
      const summary = createCohortPolicy({ plan: baseline.plan, accountId: row.accountId }).restore(state).summary();
      if (state.payload.pending || summary.unresolvedReplays) return unknown('Unresolved cohort selection');
    }
    summaries.push({ assessment, counts: baseline.plan.counts, realized: baseline.plan.realized });
  } else if (['resource_scarcity', 'resource_abundance'].includes(scenarioId)) {
    const preparation = artifacts['pressure-prepared.json'];
    if (!preparation || !snapshot || !final.pressure) return unknown('Missing original pressure preparation or cursor');
    const config = preparation.checkpoint.payload.state.configuration;
    assert.equal(config.scenario, scenarioId); assert.equal(config.seed, seed); assert.equal(config.roster.length, population);
    const setup = createPressureWorldAdapter(config).restore(preparation.checkpoint).summary();
    const summary = createPressureWorldAdapter(config).restore(final.pressure).summary();
    if (!setup.prepared || setup.preparedVerified !== population || summary.pending || summary.unresolvedResponses || summary.preparationFailed)
      return unknown('Unresolved pressure setup or policy outcome');
    const characters = snapshot.tables.characters.map(JSON.parse);
    for (const actor of config.roster) {
      const ch = characters.find(row => row.id === actor.characterId && row.account_id === actor.accountId);
      assert(ch && ch.alive && Number(ch.generation) === 1);
      assert.equal(Number(ch.cash), scenarioId === 'resource_scarcity' ? 0 : 20750, 'Declared initial cash differs');
      assert.equal(Number(ch.bank), 0); assert.equal(Number(ch.ammo), scenarioId === 'resource_scarcity' ? 0 : 175, 'Declared initial ammo differs');
    }
    if (scenarioId === 'resource_scarcity') {
      const scarce = artifacts['scarcity-prepared.json'];
      if (!scarce || configuration.scarcityInitialization?.artifact !== 'scarcity-prepared.json') return unknown('Missing actual canonical scarcity floor preparation');
      const state = scarce.preparation.payload;
      const checked = createScarcityInitialization(state.configuration).restore(scarce.preparation).summary();
      assert.deepEqual(checked, scarce.summary);
      assert(checked.complete && !checked.pending && !checked.failure && scarce.fixtureWrites === 0);
      assert.equal(scarce.baselineAt, Date.parse(snapshot.capturedAt));
      assert.equal(artifacts['scarcity-before-depletion.json']?.stateSha256, scarce.beforeStateSha256);
      assert.equal(artifacts['scarcity-after-depletion.json']?.stateSha256, scarce.afterStateSha256);
    }
    summaries.push({ preparation: setup, summary });
  } else if (scenarioId === 'coordinated_alliance') {
    if (!final.allianceAdapter || !final.allianceActors) return unknown('Missing continuous alliance checkpoint');
    const adapter = createAllianceWorldAdapter({ seed, roster: final.allianceActors, mode: 'continuous' }).restore(final.allianceAdapter), summary = adapter.summary();
    if (summary.version !== 3 || summary.unknownResponses || summary.continuationPending || final.allianceAdapter.payload.state.workflow)
      return unknown('Missing resolved continuous cooperation');
    assert.deepEqual(summary.completedStages, final.days.map(day => day.day), 'Alliance stages differ from actual daily sessions');
    const families = Object.values(summary.families), state = final.allianceAdapter.payload.state;
    const legacy = final.allianceAdapter.payload.legacy.payload.state;
    if (new Set(families).size < 3 || ![...state.receipts, ...legacy.receipts].every(matches))
      return unknown('Missing actual three-Family formation or exact cooperation receipts');
    for (const [accountId, familyId] of Object.entries(summary.families))
      if (!fresh.some(row => row.accountId === accountId && row.request.path === '/v1/gangs' && row.body.gangId === familyId))
        return unknown('Family formation lacks the original successful canonical response');
    for (const day of summary.dailyCooperation) {
      if (new Set(day.currentFamilies).size !== 3 || day.freshGrants !== 3 || day.verifiedGrants !== 3 || !day.cooperationSatisfied)
        return unknown('Incomplete actual daily alliance cooperation', { day: day.day });
      const grants = fresh.filter(row => row.logicalAt === day.logicalAt && row.request.path.includes('/knowledge/') && row.request.path.endsWith('/share'));
      if (grants.length !== 3 || !grants.every(row => fresh.some(read => read.logicalAt === day.logicalAt && day.delegates.includes(read.accountId)
        && read.request.method === 'GET' && read.body.claim?.id === row.body.claim?.id && read.body.claim.owned === false)))
        return unknown('Missing raw fresh grant and recipient-read outcomes', { day: day.day });
    }
    if (!cellAllianceControlsMatch(summary.controls, final.days, http)) return unknown('Missing original alliance unavailable controls');
    summaries.push(summary);
  } else if (scenarioId === 'multi_family_war') {
    if (!final.war) return unknown('Missing original war checkpoint');
    const saved = final.war.payload, summary = createWarWorldAdapter(saved.configuration).restore(final.war).summary();
    if (!summary.prepared || summary.pending || summary.dayInProgress || summary.unresolvedResponses || summary.failure)
      return unknown('Unresolved war policy workflow');
    const round = summary.rounds.find(round => new Set(round.claims.map(row => row.familyId)).size >= 3
      && round.claims.every(row => row.deadline > round.logicalAt));
    if (!round) return unknown('No actual overlapping commitments by three opposing Families');
    const claims = fresh.filter(row => row.logicalAt === round.logicalAt && /\/districts\/[^/]+\/claim$/.test(row.request.path));
    if (new Set(claims.map(row => row.body.district)).size !== 1 || !round.claims.every(claim => claims.some(row =>
      row.accountId === saved.configuration.roster[claim.founder].accountId && row.body.staked === claim.staked
      && row.request.body.amount === claim.staked && row.body.added === claim.staked
      && row.logicalAt + row.body.resolvesSeconds * 1000 === claim.deadline))) return unknown('War commitments lack matching original same-district receipts');
    summaries.push(summary);
  } else if (scenarioId === 'market_stress') {
    if (!final.market) return unknown('Missing market checkpoint');
    const saved = final.market.payload, summary = createMarketWorldAdapter(saved.state.configuration).restore(final.market).summary();
    if (summary.pending || summary.unresolvedResponses) return unknown('Unresolved market outcome');
    if (!Object.values(saved.state.receipts).every(matches)) return unknown('Missing original market receipt outcomes');
    if (marketOverlap?.status !== 'SATISFIED') return marketOverlap || unknown('Missing original concurrent HTTP/worker aggregate evidence');
    if (!summary.expiryNotices.length || !summary.expiryNotices.every(notice => http.some(row => row.accountId === notice.accountId
      && row.logicalAt === notice.logicalAt && row.request.path === '/v1/notifications' && row.status === 200
      && row.body.notifications?.some(item => item.id === notice.notificationId && item.type === 'order_expired'
        && item.payload.listing === notice.listingId && item.payload.refunded === notice.reportedRefund))))
      return unknown('No original own expiry notification/refund outcome');
    summaries.push({ summary, concurrency: marketOverlap.observed });
  } else if (scenarioId === 'law_pressure') {
    if (!final.law) return unknown('Missing original Law checkpoint');
    const saved = final.law.payload, summary = createLawWorldAdapter(saved.state.configuration).restore(final.law).summary();
    if (summary.pending || summary.unresolvedResponses) return unknown('Unresolved Law workflow');
    const cycles = [];
    for (const actor of saved.state.configuration.roster) {
      const calls = fresh.filter(row => row.accountId === actor.accountId && row.logicalAt >= initial.logicalAt && row.logicalAt <= final.logicalAt);
      for (const plea of calls.filter(row => row.request.path === '/v1/law/plea' && row.body.forfeited > 0 && row.body.jailSeconds > 0)) {
        const deadline = plea.logicalAt + plea.body.jailSeconds * 1000;
        const pressure = calls.filter(row => row.logicalAt <= plea.logicalAt && row.request.path.startsWith('/v1/crimes/') && row.request.body?.approach === 'loud');
        const indicted = calls.some(row => row.logicalAt <= plea.logicalAt && row.request.path === '/v1/law' && row.body.indicted === true);
        const clear = calls.find(row => row.logicalAt >= deadline && row.request.path === '/v1/me'
          && row.body.character?.id === actor.characterId && row.body.character.jailSeconds === 0
          && calls.some(law => law.logicalAt === row.logicalAt && law.request.path === '/v1/law' && law.body.indicted === false));
        const recovery = clear && calls.find(row => row.logicalAt >= clear.logicalAt && row.request.path.startsWith('/v1/crimes/')
          && row.request.body?.approach === 'quiet' && row.body.success === true && row.body.take > 0 && row.body.rep > 0);
        const debit = lawReceipts.some(row => row.character_id === actor.characterId && row.reason === 'law:plea' && Number(row.amount) === -plea.body.forfeited);
        if (pressure.length > 1 && indicted && recovery && debit) cycles.push({ accountId: actor.accountId, characterId: actor.characterId,
          pleadedAt: plea.logicalAt, jailUntil: deadline, recoveredAt: recovery.logicalAt, forfeited: plea.body.forfeited });
      }
    }
    if (!cycles.length) return unknown('No same-character sustained pressure, actual plea loss/detention and later successful legal progression',
      { completedCycles: summary.completedCycles, publicCaseClearances: summary.perActor.map(row => row.publicCaseClearances) });
    summaries.push({ summary, observedLossRecovery: cycles });
  } else if (scenarioId.includes('mystery')) {
    for (const id of roster) {
      const checkpoint = final.mysteryPolicies?.[id];
      if (!checkpoint) return unknown('Missing final mystery selector state');
      const policy = createMysteryPolicy({ scenarioId, accountId: id, seed }).restore(checkpoint), summary = policy.summary();
      if (checkpoint.payload.pending || summary.unresolvedReplayCompletions) return unknown('Unresolved mystery selector outcome');
      summaries.push(summary);
    }
  } else if (scenarioId === 'high_aggression') {
    for (const id of roster) {
      const checkpoint = final.aggressionPolicies?.[id];
      if (!checkpoint) return unknown('Missing final aggression selector state');
      const summary = createAggressionPolicy({ accountId: id, seed, sustained: true }).restore(checkpoint).summary();
      if (checkpoint.payload.pending || summary.unresolvedReplays) return unknown('Unresolved aggression selector outcome');
      summaries.push(summary);
    }
  }
  return answer('SATISFIED', 'Actual daily activity and original selector integer denominators; forced choices and empty denominators remain explicit',
    { days: days.length, selectedPerDay: expectedSelected, fraction: expectedSelected / population, summaries });
}

// The filesystem adapter only reads. Existing verifyArtifactIndex validates the
// complete sealed index and legacy/gzip history using their original contracts.
// readSource must read the requested Git revision, never an unpinned checkout.
export async function reviewWorldCellAdmission({ directory, runSha256, manifest, readSource,
  readExternal = ref => fs.readFile(ref.path), stabilizationReview = null }) {
  validateScenarioManifest(manifest);
  const runBytes = await fs.readFile(path.join(directory, 'run.json'));
  assert.equal(sha256(runBytes), runSha256, 'Sealed run bytes changed');
  const run = JSON.parse(runBytes);
  await verifyArtifactIndex(directory, run);
  assert(/^[a-f0-9]{40}$/.test(run.source.revision));
  assert.equal(hash(run.configuration), run.configurationSha256);
  const binding = { sourceRevision: run.source.revision, configurationSha256: run.configurationSha256, runSha256 };
  const index = new Map(run.artifacts.map(ref => [ref.path, ref])), used = new Map(), externalUsed = new Map();
  const reference = name => { const ref = index.get(name); return ref ? { path: ref.path, sha256: ref.sha256 } : null; };
  const readArtifact = async ref => {
    assert.equal(index.get(ref.path)?.sha256, ref.sha256, 'Input is not in the sealed run: ' + ref.path);
    const bytes = await fs.readFile(path.join(directory, ref.path));
    assert.equal(sha256(bytes), ref.sha256, 'Indexed artifact changed: ' + ref.path);
    assert.equal(bytes.length, index.get(ref.path).bytes); used.set(ref.path, ref); return bytes;
  };
  const named = async name => index.has(name) ? JSON.parse(String(await readArtifact(index.get(name)))) : null;
  const externalRead = async ref => {
    if (index.has(ref.path) && index.get(ref.path).sha256 === ref.sha256) return readArtifact(ref);
    const bytes = await readExternal(ref);
    assert.equal(sha256(bytes), ref.sha256, 'External stabilization evidence changed');
    externalUsed.set(ref.path, { path: ref.path, sha256: ref.sha256 }); return bytes;
  };
  const predicates = {}, derivedArtifacts = [], put = (id, value) => { predicates[id] = value; };
  const scenarioId = run.configuration.actorPolicy || run.configuration.scenario, { population, seed } = run;
  if (run.result.actorPolicy !== undefined) assert.equal(run.result.actorPolicy, scenarioId);
  put('cell', observed(manifest.cells.some(row => row.scenarioId === scenarioId && row.population === population && row.seed === seed)
    && run.configuration.population === population && run.configuration.seed === seed, 'Exact frozen scenario/population/seed'));
  put('execution', observed(run.status === 'PASS_SCOPED' && run.result.status === 'PASS_SCOPED' && !run.sourceFailure,
    'Original sealed process completed; its scoped status is preserved'));
  const initial = await named('initial.json'), final = await named('final.json');
  for (const snapshot of [initial, final].filter(Boolean)) assert.equal(snapshot.stateSha256, hash({ tables: snapshot.tables, sequences: snapshot.sequences }));
  if (initial) assert.equal(initial.stateSha256, run.result.initialStateSha256);
  if (final) assert.equal(final.stateSha256, run.result.finalStateSha256);
  put('native-database', initial && final ? observed(/^PostgreSQL /.test(initial.version) && /^PostgreSQL /.test(final.version),
    'Original canonical snapshots retain PostgreSQL version and complete state hashes') : unknown('Missing original native snapshots'));
  const points = await named('checkpoint-series-points.json');
  if (stabilizationReview) {
    assert(points, 'External stabilization review needs the original point index');
    const raw = await externalRead(stabilizationReview);
    const review = JSON.parse(String(raw));
    assert.deepEqual(review.binding, { sourceRevision: run.source.revision, configurationSha256: run.configurationSha256 },
      'External stabilization binding differs');
    assert.equal(review.pointIndexSha256, index.get('checkpoint-series-points.json').sha256, 'External stabilization point index differs');
  }
  const startAt = points?.startAt ?? Date.parse(run.configuration.start), endAt = points?.endAt ?? Date.parse(run.configuration.finish);
  assert.equal(startAt, Date.parse(run.configuration.start), 'Point index opening differs from sealed measured configuration');
  assert.equal(endAt, Date.parse(run.configuration.finish), 'Point index ending differs from sealed measured configuration');
  put('logical-duration', observed(Number.isSafeInteger(startAt) && Number.isSafeInteger(endAt)
    && endAt - startAt >= manifest.thresholds.minimumLogicalDays * DAY, 'Frozen minimum measured logical duration',
  { startAt, endAt, logicalDays: (endAt - startAt) / DAY }));
  if (initial && points) assert.equal(Date.parse(initial.capturedAt), startAt, 'Measured opening differs from the point index');
  if (final && points) assert.equal(Date.parse(final.capturedAt), endAt, 'Measured ending differs from the point index');

  // Recheck every retained journal and canonical invariant, not a summary flag.
  let boundaries = 0, gaps = 0, drift = 0, invariantChecks = 0, invariantFailures = 0, lastHash = null, measured = false;
  const streamHash = crypto.createHash('sha256'), activity = new Set(), pending = new Map(), http = [], lawReceipts = [], groups = [];
  const history = createReadStream(path.join(directory, run.format === 2 ? 'history.jsonl.gz' : 'history.jsonl'));
  const decoded = run.format === 2 ? history.pipe(createGunzip()) : history;
  try {
    for await (const line of createInterface({ input: decoded, crlfDelay: Infinity })) {
      if (!line.trim()) continue;
      const record = JSON.parse(line);
      if (record.kind === 'measured-initialization') measured = true;
      if (record.kind === 'invocation') pending.set(record.invocation, { ...record, measured });
      if (record.kind === 'completion') {
        const call = pending.get(record.invocation); pending.delete(record.invocation);
        const value = record.result;
        if (call?.authority === 'ordinary-http' && record.outcome === 'RETURNED') {
          const { accountId, logicalAt, authority, ...request } = call.identity;
          if (request.method === 'POST' || ['coordinated_alliance', 'law_pressure', 'multi_family_war', 'market_stress'].includes(scenarioId))
            http.push({ accountId, logicalAt, request, status: value.status, replayed: value.replayed, body: value.body, bodySha256: hash(value.body) });
        }
        if (call?.measured && record.outcome === 'RETURNED' && ((call.authority === 'player.execute' && value?.status === 'COMPLETED' && !value.replayed)
          || (call.authority === 'canonical-crime' && typeof value?.success === 'boolean')
          || (call.authority === 'ordinary-http' && call.identity.method === 'POST' && value?.status === 200 && !value.replayed
            && !/^\/v1\/(?:auth|character)(?:\/|$)/.test(call.identity.path))))
          activity.add(call.identity.logicalAt + ':' + call.identity.accountId);
      }
      if (measured && record.kind === 'canonical-invariants' && record.logicalAt >= startAt && record.logicalAt <= endAt) {
        assert(Array.isArray(record.checks)); invariantChecks += record.checks.length;
        invariantFailures += record.checks.filter(check => check.ok !== true).length;
      }
      if (!['resource-commit-boundary', 'resource-quiescent-boundary'].includes(record.kind)) continue;
      const { event, journal } = record;
      assert.deepEqual(journal.identity, event);
      if (lastHash !== null) assert.equal(journal.beforeHash, lastHash, 'Resource journal state chain gap');
      lastHash = journal.afterHash;
      assert(Array.isArray(journal.unsupported) && Array.isArray(journal.checks));
      gaps += journal.unsupported.length; drift += journal.checks.filter(check => check.drift !== '0').length;
      boundaries++; streamHash.update(canonicalJson({ event, journal }) + '\n');
      if (scenarioId === 'market_stress' && record.kind === 'resource-quiescent-boundary') groups.push({ event, journal });
      if (scenarioId === 'law_pressure') lawReceipts.push(...(journal.receipts || []).filter(row => row.reason === 'law:plea'));
    }
  } finally { decoded.destroy(); history.destroy(); }
  const resourceHash = streamHash.digest('hex'), resource = await named('resource-observer-final.json') || await named('resource-observer.json');
  if (resource) {
    assert.equal(boundaries, resource.boundaries); assert.equal(boundaries, run.result.resourceJournalCount);
    assert.equal(gaps, resource.unsupportedEntries); assert.equal(resourceHash, run.result.resourceJournalSha256);
    if (resource.resourceJournalSha256) assert.equal(resource.resourceJournalSha256, resourceHash);
    const d = resource.diagnostic;
    put('resources', observed(run.result.resourceObservationEnabled === true && boundaries > 0 && gaps === 0 && drift === 0
      && d.busy === false && d.openTransactions.length === 0 && d.failures.length === 0
      && !d.quiescentGroups?.active && !d.quiescentGroups?.failure,
    'Every retained resource boundary and receipt-parity result, joined to exact sealed totals', { boundaries, unsupported: gaps, drift, resourceHash }));
  } else put('resources', unknown('Missing measured resource observer evidence'));
  put('invariants', invariantChecks ? observed(invariantFailures === 0, 'Original measured canonical invariant checks',
    { checks: invariantChecks, failed: invariantFailures }) : unknown('No measured canonical invariant checks'));

  const policyInitial = await named('actor-policy-initial.json'), policyFinal = await named('actor-policy-final.json');
  if (policyFinal) assert.equal(hash(policyFinal), run.result.policyStateSha256);
  for (const policy of [policyInitial, policyFinal].filter(Boolean)) {
    assert.equal(policy.seed, seed); assert.equal(policy.actorPolicy, scenarioId);
    assert.equal(policy.epoch, run.configuration.actorEpoch ?? run.configuration.epoch, 'Actor epoch differs from the sealed configuration');
  }
  const policyArtifacts = {};
  for (const name of ['cohort-baseline.json', 'pressure-prepared.json', 'scarcity-prepared.json', 'scarcity-before-depletion.json', 'scarcity-after-depletion.json'])
    policyArtifacts[name] = await named(name);
  for (const row of policyArtifacts['cohort-baseline.json']?.observations || []) policyArtifacts[row.provenance.evidenceRef] = await named(row.provenance.evidenceRef);
  const marketOverlap = scenarioId === 'market_stress' && typeof readSource === 'function'
    ? await reviewCellMarketConcurrency(groups, { named, readSource, sourceRevision: run.source.revision, trace: await named('worker-schedule.json') }) : null;
  put('policy', reviewCellPolicy({ scenarioId, population, seed, initial: policyInitial, final: policyFinal,
    player: await named('player-metrics.json'), activity, prepared: await named('family-prepared.json'), snapshot: initial,
    artifacts: policyArtifacts, configuration: run.configuration, http, lawReceipts, marketOverlap }));
  const requiredDuration = ['checkpoint-series-points.json', 'world-duration-measurements.json', 'world-lifecycle-applicability.json', 'world-duration-review.json', 'worker-schedule.json'];
  if (typeof readSource === 'function' && requiredDuration.every(name => index.has(name))) {
    const source = await verifyWorldRecoverySources({ sourceRevision: run.source.revision, readFile: file => readSource(run.source.revision, file) });
    const trace = await named('worker-schedule.json'), worker = await named('world-duration-measurements.json');
    const measured = measureWorldWorkerDuration({ sourceRevision: run.source.revision, configurationSha256: run.configurationSha256,
      startAt, endAt, trace, evidence: reference('worker-schedule.json'), expectedDormant: run.configuration.expectedDormant || [] });
    assert.deepEqual(measured, worker, 'Retained worker duration differs from actual original schedule');
    const retained = await named('world-duration-review.json');
    let computed = await reviewWorldCheckpointSeries({ manifest, source, pointIndex: reference(requiredDuration[0]),
      workerDuration: reference(requiredDuration[1]), lifecycleReview: reference(requiredDuration[2]), readArtifact: externalRead,
      stabilizationReview: retained.stabilization.retainedReview || null,
      retain: async (name, value) => {
        const ref = index.get(name); assert(ref, 'Missing original checkpoint review output: ' + name);
        assert.equal(sha256(JSON.stringify(value, null, 2) + '\n'), ref.sha256, 'Checkpoint review no longer reproduces: ' + name);
        await readArtifact(ref); return reference(name);
      } });
    assert.deepEqual(computed, retained, 'Retained duration/checkpoint review differs from its inputs');
    if (stabilizationReview) {
      // Reuse the existing alternative-criterion contract. Derived outputs are
      // returned to the caller for retention separately; the original report and
      // its exact-profile UNKNOWN remain untouched in the sealed run.
      computed = await reviewWorldCheckpointSeries({ manifest, source, pointIndex: reference(requiredDuration[0]),
        workerDuration: reference(requiredDuration[1]), lifecycleReview: reference(requiredDuration[2]),
        readArtifact: externalRead, stabilizationReview,
        retain: async (name, value) => {
          const bytes = JSON.stringify(value, null, 2) + '\n', sha = sha256(bytes);
          if (index.get(name)?.sha256 === sha) return reference(name);
          const ref = { path: 'admission-' + name, sha256: sha };
          derivedArtifacts.push({ ...ref, bytes: Buffer.byteLength(bytes), value }); return ref;
        } });
    }
    put('duration-and-recovery', observed(computed.duration.complete && computed.checkpointAssertions?.every(row => row.status === 'SATISFIED'),
      'Existing worker/lifecycle, stabilization and dead-world evaluators', { duration: computed.duration, assertions: computed.checkpointAssertions, remaining: computed.remaining }));
  } else put('duration-and-recovery', unknown('Missing exact-source reader or original duration/checkpoint inputs'));
  if (points && typeof readSource === 'function') {
    const metrics = await reviewWorldMetrics({ manifest, run: { path: 'run.json', sha256: runSha256 }, pointIndex: index.get('checkpoint-series-points.json'),
      readSource, readArtifact: ref => ref.path === 'run.json' && ref.sha256 === runSha256 ? runBytes : readArtifact(ref) });
    put('metrics', metrics.complete ? answer('SATISFIED', 'All fourteen existing metrics recomputed from exact original artifacts')
      : unknown('Existing metric coverage is incomplete', metrics.metrics.filter(row => row.status !== 'OBSERVED')));
  } else put('metrics', unknown('Missing exact-source reader or original metric point index'));
  put('authorization-and-replay', typeof readSource === 'function' ? await reviewCellAuthority({ sourceRevision: run.source.revision, readSource, readExternal })
    : unknown('Missing unchanged-source applicability for existing shared authorization/replay proof'));
  // Re-read the seal after all dependent reads; the result never updates run.json.
  assert.equal(sha256(await fs.readFile(path.join(directory, 'run.json'))), runSha256, 'Run seal changed during review');
  const complete = Object.values(predicates).every(row => row.status === 'SATISFIED');
  return { format: 1, binding, cell: { scenarioId, population, seed }, manifestSha256: hash(manifest), predicates,
    status: complete ? 'PASS_CELL' : 'NOT_ADMITTED', cellQualifying: complete, matrixQualifying: false,
    supplementalStabilization: stabilizationReview, externalEvidence: [...externalUsed.values()], derivedArtifacts,
    originalEvidence: { status: run.status, evidenceKind: run.evidenceKind, matrixQualifying: run.matrixQualifying,
      coverageExclusions: run.coverageExclusions || [] }, evidence: { run: { path: 'run.json', sha256: runSha256 }, inputs: [...used.values()] },
    remaining: Object.entries(predicates).filter(([, row]) => row.status !== 'SATISFIED').map(([predicate, row]) => ({ predicate, ...row })),
    separateReleaseGates: ['225-cell coverage', 'Production-equivalent soak/load', 'Deployed configuration and external activation', 'Real-player cohort'],
    scope: 'One sealed logical-world cell. Shared unchanged-source authority evidence is reused; original scoped evidence is never rewritten.' };
}
