import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { exactConcentration } from '../tools/rc1-world-diagnostics.js';
import { verifyWorldRecoverySources, WORLD_DURATION_CANDIDATES } from '../tools/rc1-world-qualification.js';
import { reviewWorldCheckpointSeries } from '../tools/rc1-world-checkpoint-series.js';

const DAY = 86400000, hash = value => sha256(canonicalJson(value)), copy = value => structuredClone(value);
const source = await verifyWorldRecoverySources({ sourceRevision: '92f09bb436d9e7cacb874adb60f7238c0b1d709d', readFile: file => fs.readFile(file) });
const manifest = JSON.parse(await fs.readFile('docs/release/readiness-work/scenario-manifest.json', 'utf8'));
function fixture({ days = 90, missingDay = null, changedConcentration = false, growth = false, interiorGrowth = false, economyGap = false, earlyPartial = false, duplicateFinal = false } = {}) {
  const files = new Map(), values = new Map(), configurationSha256 = hash('frozen configuration');
  const put = (path, value) => { const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n'); files.set(path, bytes); values.set(path, copy(value)); return { path, sha256: sha256(bytes) }; };
  const binding = { sourceRevision: source.sourceRevision, configurationSha256 }, startAt = 0, endAt = days * DAY;
  const ref = put('original-worker-trace.json', { fixture: 'deterministic measurement fixture; not native world evidence' });
  const lifecycleReview = put('lifecycle-applicability.json', { binding, complete: true, stabilizationWindowLifecycleId: 'season',
    lifecycles: WORLD_DURATION_CANDIDATES.map(row => ({ ...row, applicability: row.id === 'season' ? 'APPLICABLE' : 'NOT_APPLICABLE', applicabilityEvidence: ref })) });
  const workerDuration = put('worker-duration.json', { workerCoverage: { binding, evidence: ref, complete: true, fromLogicalAt: startAt, throughLogicalAt: endAt },
    seasonalRollovers: [1, 2, 3].filter(season => season * 28 * DAY <= endAt).map(season => ({ season, logicalAt: season * 28 * DAY, authority: 'original-worker', evidence: ref })),
    executions: [1, 2].filter(season => (season + 1) * 28 * DAY <= endAt).map(season => ({ lifecycleId: 'season', cycleId: String(season), startedAt: season * 28 * DAY,
      dueAt: (season + 1) * 28 * DAY, completedAt: (season + 1) * 28 * DAY, authority: 'original-worker', openingEvidence: ref, completionEvidence: ref })) });
  const points = [], roster = ['a', 'b'];
  const sampleTimes = Array.from({ length: Math.floor(days) + 1 }, (_, day) => day * DAY);
  if (sampleTimes.at(-1) !== endAt) sampleTimes.push(endAt);
  if (earlyPartial) sampleTimes[0] = 3600000;
  for (const logicalAt of sampleTimes) {
    const day = logicalAt / DAY; if (day === missingDay) continue;
    const stateSha256 = hash('snapshot-' + logicalAt), pointBinding = { ...binding, stateSha256, logicalAt };
    const weights = changedConcentration && day > 62 ? [1, 3] : [1, 1], dist = exactConcentration(weights.map(quantity => ({ quantity })));
    const diagnostic = { semantic: { logicalAt,
      families: { livingDeclaredMembershipConcentration: dist, treasuryCashConcentration: dist, reserveOmrConcentration: dist },
      inventory: { stacks: [{ identity: ['item:key', 'basic'], concentration: dist }], uniqueItems: [], lots: [] } } };
    const diagnostics = put('diagnostics-' + day + '.json', diagnostic);
    const recovery = put('recovery-' + day + '.json', { binding: pointBinding, joined: {
      scopes: Object.fromEntries(['actors', 'resources', 'objectives', 'family', 'knowledge'].map(scope => [scope, { status: 'SATISFIED' }])),
      assertions: manifest.deadWorldAssertions.map((assertion, i) => ({ assertion, status: i === 4 ? 'UNKNOWN' : 'SATISFIED' })) } });
    const rawBacklog = { logicalAt, sourceRevision: source.sourceRevision, snapshotStateSha256: stateSha256, sourcePins: { worker: hash('worker') },
      configurationSha256: hash('effective backlog flags'), unknown: [],
      inventory: [{ id: 'loan-branding', status: 'OBSERVED', count: growth && day === days || interiorGrowth && day === 80 ? 1 : 0 },
        { id: 'loan-collateral', status: 'OBSERVED', count: growth && day < days ? 2 : 0 },
        { id: 'director-shadow', status: 'NON_MUTATING_MODE', count: null, reason: 'Pinned non-mutating configuration' }],
      liveState: { orphanedOperations: 0, failedCanonicalChecks: [] } };
    const backlog = put('backlog-' + day + '.json', { binding: pointBinding, diagnostics, review: { ...rawBacklog, sha256: hash(rawBacklog) } });
    const reward = { perPlayer: roster.map(accountId => ({ accountId, quantity: String(day + 1) })), recipients: 2,
      largestShare: { numerator: '1', denominator: '2' }, topDecile: { players: 1, share: { numerator: '2', denominator: '4' } },
      gini: { numerator: '0', denominator: '2' }, outsideRoster: [] };
    const economyNativeHash = hash('resource-snapshot-' + day), economyBoundaryChain = hash('resource-chain-' + day);
    const economy = put('economy-' + day + '.json', { logicalAt, nativeHash: economyNativeHash, boundaryChain: economyBoundaryChain,
      enrolledRoster: roster, distributionScope: 'Declared accounts including zero rewards', missingCoverage: economyGap && day === 80 ? [{ kind: 'unclassified-receipt' }] : [],
      resources: [{ resource: 'cash', reward, rewardCategories: [{ category: 'check-in', ...reward }] }] });
    points.push({ binding: pointBinding, recovery, backlog, diagnostics, economy, economyNativeHash, economyBoundaryChain });
  }
  if (duplicateFinal) points.push(copy(points.at(-1)));
  const index = { binding, startAt, endAt, sampling: { phaseAt: startAt, periodMs: DAY }, points };
  const input = { manifest, source, pointIndex: put('checkpoint-series-points.json', index), workerDuration, lifecycleReview,
    readArtifact: async ref => { assert(files.has(ref.path)); return files.get(ref.path); }, retain: async (path, value) => put(path, value) };
  return { input, files, values, put, index, binding, ref };
}
const stable = fixture(), result = await reviewWorldCheckpointSeries(stable.input);
assert.equal(result.duration.complete, true); assert.equal(result.matrixQualifying, false);
assert.equal(result.stabilization.exactProfileRepetition, true); assert.deepEqual(result.windows.map(row => row.throughLogicalAt / DAY), [62, 90]);
assert.deepEqual(result.checkpointAssertions.map(row => row.status), Array(5).fill('SATISFIED'));
assert(result.windows.every(row => !Object.hasOwn(row, 'unresolvedBacklog')), 'Different worker classes must never be summed');
assert.equal((await reviewWorldCheckpointSeries(fixture({ earlyPartial: true, duplicateFinal: true }).input)).duration.complete, true);
{
  const short = await reviewWorldCheckpointSeries(fixture({ days: 25 / 24, earlyPartial: true }).input);
  assert.equal(short.windows.length, 0); assert.equal(short.duration.minimumDaysMet, false); assert.equal(short.duration.complete, false);
  assert(short.remaining.some(row => row.kind === 'successive-complete-longest-windows-missing'));
}
{
  const missing = await reviewWorldCheckpointSeries(fixture({ missingDay: 60 }).input);
  assert.equal(missing.duration.complete, false); assert.equal(missing.duration.backlogStatus, 'UNKNOWN');
  assert(missing.remaining.some(row => row.kind === 'declared-window-observations-missing'));
}
{
  const grown = await reviewWorldCheckpointSeries(fixture({ growth: true }).input);
  assert.equal(grown.duration.backlogStatus, 'FAILED', 'A falling aggregate must not conceal growth in one original work class');
  assert.equal(grown.stabilization.conclusions.backlog, 'NOT_STABLE');
  const interior = await reviewWorldCheckpointSeries(fixture({ interiorGrowth: true }).input);
  assert.equal(interior.duration.backlogStatus, 'FAILED', 'Identical endpoints must not hide growth at corresponding interior observations');
}
{
  const missing = await reviewWorldCheckpointSeries(fixture({ economyGap: true }).input);
  assert.equal(missing.stabilization.conclusions.concentration, 'UNKNOWN'); assert.equal(missing.duration.backlogStatus, 'SATISFIED');
  assert.equal(missing.duration.complete, false, 'Receipt coverage gaps cannot be relabeled stable');
}
{
  const changing = fixture({ changedConcentration: true }), first = await reviewWorldCheckpointSeries(changing.input);
  assert.equal(first.stabilization.conclusions.concentration, 'UNKNOWN', 'No invented percentage tolerance');
  const review = { binding: changing.binding, pointIndexSha256: changing.input.pointIndex.sha256,
    windowEvidence: first.windows.map(row => row.evidence), axes: ['concentration', 'backlog', 'reachability'].map(axis => ({ axis,
      conclusion: 'UNKNOWN', criterion: 'Existing duration stability rule', rationale: 'This fixture contains changed observations; further applicable explanation remains necessary.', evidence: [changing.ref] })) };
  changing.input.stabilizationReview = changing.put('external-review.json', review);
  assert.equal((await reviewWorldCheckpointSeries(changing.input)).duration.complete, false);
  const model = changing.put('reviewed-fixture-transition-model.json', { scope: 'Synthetic test model only; not an OMERTA production proof',
    rule: 'This fixture has one transition after day62 to fixed weights1:3, and no subsequent transition.' });
  const explanation = Buffer.from('Synthetic source-review explanation; retained text is evidence, not executable instructions.\n');
  changing.files.set('fixture-review.md', explanation);
  for (const axis of review.axes) Object.assign(axis, { conclusion: 'STABLE', criterion: 'Source-closed finite transition model; no numerical tolerance',
    rationale: axis.axis === 'concentration' ? 'The retained synthetic model permits one change and then no further concentration writer. Actual selected observations agree; this source proof does not require identical prior-window profiles.'
      : 'The exact retained observations establish the existing no-growth and reachable-path requirements.',
    evidence: [model, { path: 'fixture-review.md', sha256: sha256(explanation) }, ...first.windows.map(row => row.evidence)] });
  changing.input.stabilizationReview = changing.put('external-review.json', review);
  assert.equal((await reviewWorldCheckpointSeries(changing.input)).duration.complete, true, 'Exact repetition is sufficient, not a new mandatory gate');
  review.pointIndexSha256 = hash('different-index'); changing.input.stabilizationReview = changing.put('external-review.json', review);
  await assert.rejects(reviewWorldCheckpointSeries(changing.input));
}
{
  const missing = fixture(); Object.assign(missing.index.points.at(-1), { economy: null, economyNativeHash: null, economyBoundaryChain: null });
  missing.input.pointIndex = missing.put('checkpoint-series-points.json', missing.index);
  const result = await reviewWorldCheckpointSeries(missing.input);
  assert.equal(result.stabilization.conclusions.concentration, 'UNKNOWN'); assert.equal(result.duration.complete, false);
}
for (const change of [state => { state.files.set(state.index.points.at(-1).economy.path, Buffer.from('{}')); },
  state => { state.index.points.at(-1).economyNativeHash = hash('different-native-state'); state.input.pointIndex = state.put('checkpoint-series-points.json', state.index); },
  state => { state.index.points.at(-1).binding.configurationSha256 = hash('different-config'); state.input.pointIndex = state.put('checkpoint-series-points.json', state.index); }]) {
  const changed = fixture(); change(changed); await assert.rejects(reviewWorldCheckpointSeries(changed.input));
}
console.log('PASS rc1-world-checkpoint-series: exact artifact/checkpoint joins; actual longest windows; initial partial/final duplicate handling; missing cadence and economy gaps; independent backlog growth; no invented stability tolerance or matrix claim');
