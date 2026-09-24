// Observer-only join of existing checkpoint artifacts. Never actor-policy input.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { compareWorldBacklogMeasurements, evaluateWorldDuration } from './rc1-world-qualification.js';

const hash = value => sha256(canonicalJson(value));
const digest = value => /^[a-f0-9]{64}$/.test(value || '');
const axes = ['concentration', 'backlog', 'reachability'];
const scopes = ['actors', 'resources', 'objectives', 'family', 'knowledge'];
const reference = value => assert(value?.path && digest(value.sha256), 'An exact retained artifact reference is required');
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const sorted = rows => [...rows].sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
const unique = values => assert.equal(new Set(values).size, values.length, 'Duplicate series identity');
const nativeBytes = value => JSON.stringify(value, null, 2) + '\n';

export const WORLD_CHECKPOINT_SERIES_CONTRACT = Object.freeze({ format: 1, axes,
  durationRule: 'Continue for the longest requirement, and longer until concentration/backlog/reachability stabilize. Every due worker interval must execute.',
  measurements: ['inventory/Family concentration', 'reward concentration'],
  sufficientCriterion: 'Across two successive complete longest-applicable windows, the exact retained concentration profiles repeat at corresponding observation offsets, required recovery remains satisfied at every observation, and each applicable backlog class/live-state orphan count does not grow. This is one sufficient observation-based review, not a required repetition gate or a numerical tolerance.',
  alternativeReview: 'Changing concentration profiles need a substantive source/config/index/window-bound review of the existing stability requirement. The adapter does not invent a tolerance, infer convergence from bounded shares, or waive missing evidence.',
  sampling: 'The input declares the actual retained sampling schedule. Missing declared observations in selected windows remain UNKNOWN. Initial partial intervals and exact duplicate final boundaries do not manufacture missing full windows.',
});

function fraction(value) {
  if (value === null) return null;
  assert(value && /^-?\d+$/.test(value.numerator) && /^\d+$/.test(value.denominator));
  let a = BigInt(value.numerator), b = BigInt(value.denominator); assert(a >= 0n && b > 0n);
  let x = a, y = b; while (y) [x, y] = [y, x % y];
  return `${a / x}/${b / x}`;
}
function concentration(value) {
  assert(value && Number.isSafeInteger(value.holders) && value.holders >= 0
    && Number.isSafeInteger(value.nonzeroHolders) && value.nonzeroHolders >= 0);
  return { holders: value.holders, nonzeroHolders: value.nonzeroHolders,
    largestShare: fraction(value.largestShare), gini: fraction(value.gini) };
}
function concentrationProfile(diagnostic, economy) {
  const inventory = {};
  for (const kind of ['stacks', 'uniqueItems', 'lots']) {
    assert(Array.isArray(diagnostic.inventory?.[kind]), 'Missing actual inventory concentration');
    inventory[kind] = sorted(diagnostic.inventory[kind].map(row => ({ identity: row.identity, concentration: concentration(row.concentration) })));
  }
  const families = Object.fromEntries(['livingDeclaredMembershipConcentration', 'treasuryCashConcentration', 'reserveOmrConcentration']
    .map(key => [key, concentration(diagnostic.families?.[key])]));
  assert(Array.isArray(economy.resources) && Array.isArray(economy.enrolledRoster) && Array.isArray(economy.missingCoverage));
  const reward = row => {
    assert(Array.isArray(row.perPlayer));
    assert.deepEqual(row.perPlayer.map(player => player.accountId).sort(), [...economy.enrolledRoster].sort(), 'Reward denominator changed');
    return { declaredAccounts: row.perPlayer.length, recipients: row.recipients, largestShare: fraction(row.largestShare),
      topDecile: { players: row.topDecile.players, share: fraction(row.topDecile.share) }, gini: fraction(row.gini),
      outsideRosterAccounts: row.outsideRoster.length };
  };
  unique(economy.resources.map(row => row.resource));
  return { inventory, families, distributionScope: economy.distributionScope,
    rewards: sorted(economy.resources.map(row => ({ resource: row.resource, reward: reward(row.reward),
      categories: sorted(row.rewardCategories.map(entry => ({ category: entry.category, reward: reward(entry) }))) }))) };
}
function backlogClasses(review) {
  assert(Array.isArray(review.inventory) && Array.isArray(review.unknown));
  unique(review.inventory.map(row => row.id));
  return review.inventory.map(row => ({ id: row.id, status: row.status, count: row.count,
    ...(row.status === 'OBSERVED' ? {} : { reason: row.reason || row.disposition || row.scope || 'Source review did not establish this class' }) }));
}
// readArtifact(ref) returns original file bytes, including gzip-independent JSON
// artifacts. retain(name,value) persists native pretty JSON and returns its hash.
// Retain may reuse an existing byte-identical artifact when adding a later review.
export async function reviewWorldCheckpointSeries({ manifest, source, pointIndex, workerDuration, lifecycleReview,
  readArtifact, retain, stabilizationReview = null }) {
  assert.equal(manifest.thresholds.durationRule, WORLD_CHECKPOINT_SERIES_CONTRACT.durationRule);
  for (const metric of WORLD_CHECKPOINT_SERIES_CONTRACT.measurements) assert(manifest.metrics.includes(metric));
  assert.equal(typeof readArtifact, 'function'); assert.equal(typeof retain, 'function');
  const read = async ref => { reference(ref); const bytes = await readArtifact(ref); assert.equal(sha256(bytes), ref.sha256, 'Retained artifact bytes changed: ' + ref.path); return JSON.parse(String(bytes)); };
  const put = async (name, value) => { const ref = await retain(name, value); reference(ref); assert.equal(ref.sha256, sha256(nativeBytes(value))); return ref; };
  const index = await read(pointIndex), worker = await read(workerDuration), applicability = await read(lifecycleReview);
  const { configurationSha256 } = index.binding, { startAt, endAt, sampling } = index;
  const binding = { sourceRevision: source.sourceRevision, configurationSha256 };
  assert.deepEqual(index.binding, binding); assert(digest(configurationSha256));
  assert(Number.isSafeInteger(startAt) && Number.isSafeInteger(endAt) && endAt >= startAt);
  assert(Number.isSafeInteger(sampling.periodMs) && sampling.periodMs > 0 && Number.isSafeInteger(sampling.phaseAt));
  assert.deepEqual(applicability.binding, binding); assert.deepEqual(worker.workerCoverage.binding, binding);
  const unknown = [], points = [];
  for (const entry of index.points) {
    const expected = entry.binding;
    assert.equal(expected.sourceRevision, binding.sourceRevision); assert.equal(expected.configurationSha256, configurationSha256);
    assert(digest(expected.stateSha256) && Number.isSafeInteger(expected.logicalAt) && expected.logicalAt >= startAt && expected.logicalAt <= endAt);
    const [recovery, backlog, diagnosticArtifact, economy] = await Promise.all([read(entry.recovery), read(entry.backlog), read(entry.diagnostics), entry.economy ? read(entry.economy) : null]);
    const diagnostic = diagnosticArtifact.semantic || diagnosticArtifact;
    assert.deepEqual(recovery.binding, expected); assert.deepEqual(backlog.binding, expected);
    assert.deepEqual(backlog.diagnostics, entry.diagnostics);
    assert.equal(diagnostic.logicalAt, expected.logicalAt);
    if (economy) {
      assert.equal(economy.logicalAt, expected.logicalAt);
      assert.equal(economy.nativeHash, entry.economyNativeHash); assert(digest(entry.economyNativeHash));
      assert.equal(economy.boundaryChain, entry.economyBoundaryChain); assert(digest(entry.economyBoundaryChain));
    } else assert(entry.economyNativeHash == null && entry.economyBoundaryChain == null, 'Absent economy sample has a fabricated boundary');
    const { sha256: backlogHash, ...backlogBody } = backlog.review;
    assert.equal(backlogHash, hash(backlogBody)); assert.equal(backlog.review.snapshotStateSha256, expected.stateSha256);
    assert.equal(backlog.review.sourceRevision, source.sourceRevision); assert.equal(backlog.review.logicalAt, expected.logicalAt);
    const statuses = Object.fromEntries(scopes.map(scope => [scope, recovery.joined.scopes[scope]?.status || 'UNKNOWN']));
    assert.deepEqual(recovery.joined.assertions.map(row => row.assertion), manifest.deadWorldAssertions);
    const classes = backlogClasses(backlog.review), orphans = backlog.review.liveState.orphanedOperations;
    const concentration = economy ? concentrationProfile(diagnostic, economy) : null;
    points.push({ binding: expected, evidence: { recovery: entry.recovery, backlog: entry.backlog, diagnostics: entry.diagnostics, economy: entry.economy },
      concentration, concentrationComplete: !!economy && economy.missingCoverage.length === 0,
      reachability: statuses, recoveryAssertions: recovery.joined.assertions,
      reachabilityComplete: Object.values(statuses).every(status => status === 'SATISFIED') && recovery.joined.assertions.slice(0, 4).every(row => row.status === 'SATISFIED'),
      backlog: { classes, orphans, sourcePins: backlog.review.sourcePins, configurationSha256: backlog.review.configurationSha256,
        complete: !backlog.review.unknown.length && !classes.some(row => row.status === 'UNKNOWN')
          && Number.isSafeInteger(orphans) && orphans >= 0 && backlog.review.liveState.failedCanonicalChecks.length === 0 } });
  }
  points.sort((a, b) => a.binding.logicalAt - b.binding.logicalAt);
  const observations = [];
  for (const point of points) {
    const previous = observations.at(-1);
    if (previous?.binding.logicalAt === point.binding.logicalAt) {
      assert.deepEqual(previous.binding, point.binding, 'Distinct states share one sampled timestamp');
      assert(same(previous.concentration, point.concentration) && same(previous.reachability, point.reachability)
        && same(previous.backlog, point.backlog), 'Duplicate final boundary measurements differ');
      observations[observations.length - 1] = point;
    } else observations.push(point);
  }
  const applicable = applicability.lifecycles.filter(row => row.applicability === 'APPLICABLE');
  const longest = Math.max(0, ...applicable.map(row => row.durationMs));
  const final = observations.find(point => point.binding.logicalAt === endAt);
  let bounds = [];
  if (longest > 0 && final) {
    const middle = observations.filter(point => point.binding.logicalAt <= endAt - longest).at(-1);
    const first = middle && observations.filter(point => point.binding.logicalAt <= middle.binding.logicalAt - longest).at(-1);
    if (first) bounds = [[first.binding.logicalAt, middle.binding.logicalAt], [middle.binding.logicalAt, endAt]];
  }
  if (!bounds.length) unknown.push({ kind: 'successive-complete-longest-windows-missing', longestMs: longest, startAt, endAt });
  const windows = [], profiles = [], documents = [];
  for (const [indexOfWindow, [fromLogicalAt, throughLogicalAt]] of bounds.entries()) {
    const selected = observations.filter(point => point.binding.logicalAt >= fromLogicalAt && point.binding.logicalAt <= throughLogicalAt);
    const times = new Set(selected.map(point => point.binding.logicalAt)), missing = [];
    for (let at = sampling.phaseAt + Math.ceil((fromLogicalAt - sampling.phaseAt) / sampling.periodMs) * sampling.periodMs; at <= throughLogicalAt; at += sampling.periodMs)
      if (!times.has(at)) missing.push(at);
    if (missing.length) unknown.push({ kind: 'declared-window-observations-missing', fromLogicalAt, throughLogicalAt, logicalAt: missing });
    const endpoint = selected.at(-1), prior = selected[0];
    for (const point of selected) {
      assert.deepEqual(point.backlog.sourcePins, prior.backlog.sourcePins, 'Backlog sources changed across a window');
      assert.equal(point.backlog.configurationSha256, prior.backlog.configurationSha256, 'Backlog configuration changed across a window');
    }
    const coverage = { concentration: !missing.length && selected.every(point => point.concentrationComplete),
      reachability: !missing.length && selected.every(point => point.reachabilityComplete),
      backlog: !missing.length && selected.every(point => point.backlog.complete) };
    const complete = Object.values(coverage).every(Boolean);
    const document = { binding, fromLogicalAt, throughLogicalAt, longestApplicableDurationMs: longest, declaredSampling: sampling,
      observations: selected, missingLogicalAt: missing, coverage, complete,
      scope: 'Actual recorded checkpoints; no interpolation, synthetic resource amounts, hidden actor feedback or future-state guarantee.' };
    const evidence = await put('checkpoint-series-window-' + indexOfWindow + '.json', document);
    const checkpoint = { stateSha256: endpoint.binding.stateSha256, configurationSha256, logicalAt: throughLogicalAt };
    windows.push({ fromLogicalAt, throughLogicalAt, checkpoint, evidence, complete: coverage.backlog,
      backlogClasses: endpoint.backlog.classes, liveStateOrphans: endpoint.backlog.orphans,
      backlogSamples: selected.map(point => ({ offsetMs: point.binding.logicalAt - fromLogicalAt,
        backlogClasses: point.backlog.classes, liveStateOrphans: point.backlog.orphans })) });
    profiles.push(selected.map(point => ({ offsetMs: point.binding.logicalAt - fromLogicalAt, concentration: point.concentration })));
    documents.push(document);
  }
  const covered = Object.fromEntries(axes.map(axis => [axis, documents.length >= 2 && documents.every(document => document.coverage[axis])]));
  const backlogStatus = covered.backlog ? compareWorldBacklogMeasurements(windows[0], windows[1]) : 'UNKNOWN';
  const repetition = covered.concentration && same(profiles[0], profiles[1]);
  const conclusions = { concentration: repetition ? 'STABLE' : 'UNKNOWN', backlog: backlogStatus === 'SATISFIED' ? 'STABLE' : backlogStatus === 'FAILED' ? 'NOT_STABLE' : 'UNKNOWN',
    reachability: covered.reachability ? 'STABLE' : 'UNKNOWN' };
  let criterion = WORLD_CHECKPOINT_SERIES_CONTRACT.sufficientCriterion, reviewed = null;
  if (stabilizationReview) {
    reviewed = await read(stabilizationReview); assert.deepEqual(reviewed.binding, binding); assert.equal(reviewed.pointIndexSha256, pointIndex.sha256);
    assert.deepEqual(reviewed.windowEvidence, windows.map(window => window.evidence));
    assert.deepEqual(reviewed.axes.map(row => row.axis), axes);
    for (const axis of reviewed.axes) {
      assert(['STABLE', 'NOT_STABLE', 'UNKNOWN'].includes(axis.conclusion));
      assert(typeof axis.criterion === 'string' && axis.criterion && typeof axis.rationale === 'string' && axis.rationale);
      assert(Array.isArray(axis.evidence) && axis.evidence.length); for (const ref of axis.evidence) await read(ref);
      if (covered[axis.axis] && conclusions[axis.axis] !== 'NOT_STABLE') conclusions[axis.axis] = axis.conclusion;
    }
    criterion = reviewed.axes.map(row => row.axis + ': ' + row.criterion + ' — ' + row.rationale).join('\n');
  }
  const conclusion = Object.values(conclusions).includes('NOT_STABLE') ? 'NOT_STABLE' : Object.values(conclusions).every(value => value === 'STABLE') ? 'STABLE' : 'UNKNOWN';
  const reviewDocument = { binding, pointIndex, windowEvidence: windows.map(window => window.evidence), axes, conclusions, criterion, conclusion,
    ...(stabilizationReview ? { retainedReview: stabilizationReview } : {}), exactProfileRepetition: repetition, unknown,
    limits: WORLD_CHECKPOINT_SERIES_CONTRACT.alternativeReview };
  const reviewEvidence = await put('checkpoint-series-stabilization.json', reviewDocument);
  const duration = evaluateWorldDuration({ manifest, source, configurationSha256, startAt, endAt,
    lifecycleReview: { ...applicability, evidence: lifecycleReview }, executions: worker.executions,
    seasonalRollovers: worker.seasonalRollovers, workerCoverage: worker.workerCoverage, windows,
    stabilizationReview: { binding, evidence: reviewEvidence, windowEvidence: windows.map(window => window.evidence), axes, criterion, conclusion } });
  return { binding, pointIndex, workerDuration, lifecycleReview, windows, stabilization: { ...reviewDocument, evidence: reviewEvidence }, duration,
    checkpointAssertions: final ? final.recoveryAssertions.map((row, i) => i === 4 ? { ...row, status: duration.backlogStatus } : row) : null,
    remaining: [...unknown, ...axes.filter(axis => conclusions[axis] !== 'STABLE').map(axis => ({ kind: 'stabilization-not-established', axis, status: conclusions[axis] })),
      ...['minimumDaysMet', 'seasonalMet', 'cyclesMet', 'workersComplete', 'applicabilityComplete'].filter(key => !duration[key]).map(key => ({ kind: 'duration-requirement-unproved', requirement: key }))],
    matrixQualifying: false };
}
