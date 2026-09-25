import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { reviewWorldMetrics, WORLD_METRICS } from '../tools/rc1-world-metrics-review.js';

const hash = value => sha256(canonicalJson(value)), copy = value => structuredClone(value);
const manifest = JSON.parse(await fs.readFile('docs/release/readiness-work/scenario-manifest.json', 'utf8'));
function fixture({ latency = true, unresolvedCampaign = false, economyGap = false, knowledgeGap = false,
  unknownObjective = false, openOperation = false, recoveredOperation = false, resourceCount = 1 } = {}) {
  const files = new Map(), refs = new Map(), values = new Map();
  const put = (path, value) => { const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
    const ref = { path, sha256: sha256(bytes) }; files.set(path, bytes); refs.set(path, ref); values.set(path, copy(value)); return ref; };
  const configuration = { coverageMissing: ['All 13 resource journals at every worker transition', 'Production-equivalent 12-hour soak'] };
  const binding = { sourceRevision: '1'.repeat(40), configurationSha256: hash(configuration) };
  const roster = ['a', 'b'], points = [], knowledgeBoundaries = [], days = [], latencyTimeSeries = [];
  const dist = { holders: 0, nonzeroHolders: 0, total: '0', largestShare: null, gini: null };
  const latencyStat = count => ({ count, p50Ms: count ? 5 : null, p95Ms: count ? 5 : null,
    p99Ms: count ? 5 : null, maximumMs: count ? 5 : null });
  const latencyPoint = { totals: { read: latencyStat(2), command: latencyStat(1) },
    perPlayer: [{ accountId: 'a', read: latencyStat(2), command: latencyStat(1) },
      { accountId: 'b', read: latencyStat(0), command: latencyStat(0) }],
    unattributed: { read: latencyStat(0), command: latencyStat(0) } };
  const opportunity = { observationWindowMs: 86400000, generatedAuthorizedOpportunities: 2,
    acceptedOpportunities: 1, ignoredOpportunities: 0, pendingOpportunities: 1,
    perPlayer: roster.map((accountId, i) => ({ accountId, generatedAuthorizedOpportunities: i ? 0 : 2,
      acceptedOpportunities: i ? 0 : 1, ignoredOpportunities: 0, pendingOpportunities: i ? 0 : 1 })) };
  for (const [i, label] of ['day-0', 'final'].entries()) {
    const logicalAt = i * 3600000, campaigns = unresolvedCampaign ? [{ id: 'c', status: 'active' }] : [{ id: 'old', status: 'abandoned' }];
    const tables = { director_campaigns: campaigns.map(JSON.stringify), world_operations: openOperation ? [JSON.stringify({ id: 'op', status: 'forming' })] : [],
      world_operation_roles: [], mystery_instances: [], characters: [], gangs: [], gang_members: [] };
    const snapshot = { tables, sequences: [], capturedAt: new Date(logicalAt).toISOString(), stateSha256: hash({ tables, sequences: [] }) };
    const bound = { ...binding, stateSha256: snapshot.stateSha256, logicalAt };
    const subjects = [...(unresolvedCampaign ? [{ type: 'campaign', id: 'c' }] : []),
      ...(unknownObjective ? [{ type: 'mystery', id: 'm' }] : []), ...(openOperation ? [{ type: 'operation', id: 'op' }] : [])];
    const diagnostic = { semantic: { logicalAt, actions: { perPlayer: [{ accountId: 'a', actions: 1 }, { accountId: 'b', actions: 0 }] },
      objectiveInventory: { tablesComplete: true, subjects }, director: { overdueActiveCampaignIds: unresolvedCampaign ? ['c'] : [] },
      inventory: { stacks: [], uniqueItems: [], lots: [] }, families: { perFamily: [],
        livingDeclaredMembershipConcentration: dist, treasuryCashConcentration: dist, reserveOmrConcentration: dist },
      worldRows: Object.entries(tables).map(([table, rows]) => ({ table, count: String(rows.length) })) },
      physicalDiagnostics: { relationBytes: Object.keys(tables).map(table => ({ table, bytes: '8192' })) } };
    const recovery = { binding: bound, inventories: { objectives: { complete: true } },
      joined: { scopes: { objectives: { results: subjects.map(row => ({ id: row.type + ':' + row.id,
        status: row.type === 'operation' && recoveredOperation ? 'REACHABLE' : 'UNKNOWN' })) } } } };
    const backlog = { binding: bound, review: { liveState: { structuralOrphanOperations: 0,
      orphanedOperations: openOperation ? null : 0, recoveryRequiredOperationIds: openOperation ? ['op'] : [] } } };
    const knowledge = { complete: !knowledgeGap, perPlayer: roster.map(accountId => ({ accountId, complete: !knowledgeGap,
      accessibleClaims: 0, ownedClaims: 0, sharedClaims: 0, claims: [] })), distinctAccessibleClaims: 0, perClaim: [], accessConcentration: dist };
    put('knowledge-' + label + '.json', knowledge);
    knowledgeBoundaries.push({ label, logicalAt, beforeStateSha256: snapshot.stateSha256,
      afterStateSha256: snapshot.stateSha256, diagnosticSha256: hash(knowledge) });
    const economy = { logicalAt, nativeHash: hash('resources-' + i), boundaryChain: hash('chain-' + i), enrolledRoster: roster,
      missingCoverage: economyGap ? ['unclassified receipt'] : [], resources: Array.from({ length: resourceCount }, (_, resource) => ({ resource: String(resource),
        flows: { transferred: '0' }, unitsPerLogicalDay: { transferred: null }, transferTurnover: null,
        perPlayerFlows: roster.map(accountId => ({ accountId })), reward: { perPlayer: roster.map(accountId => ({ accountId, quantity: '0' })) }, rewardCategories: [] })) };
    points.push({ binding: bound, snapshot: put(label + '.json', snapshot), diagnostics: put('world-diagnostics-' + label + '.json', diagnostic),
      recovery: put('checkpoint-recovery-' + label + '.json', recovery), backlog: put('world-backlog-' + label + '.json', backlog),
      economy: put('economy-metrics-' + label + '.json', economy), economyNativeHash: economy.nativeHash, economyBoundaryChain: economy.boundaryChain });
    if (!i) { days.push({ day: 0, logicalAt, opportunityObservation: opportunity }); latencyTimeSeries.push({ logicalAt, ...latencyPoint }); }
  }
  put('knowledge-boundaries.json', knowledgeBoundaries);
  put('player-metrics.json', { days, actorActions: { a: 1, b: 0 }, opportunities: opportunity,
    meaningfulActionDefinition: 'Fresh actions; excludes reads/replays/denials/authentication',
    ...(latency ? { latencyTimeSeries, latencyDistribution: latencyPoint } : {}) });
  const pointIndex = put('checkpoint-series-points.json', { binding, startAt: 0, endAt: 3600000,
    sampling: { phaseAt: 0, periodMs: 86400000 }, points });
  const run = put('run.json', { source: { revision: binding.sourceRevision }, configuration, configurationSha256: binding.configurationSha256,
    artifacts: [...refs.values()], status: 'PASS_SCOPED', evidenceKind: 'scoped', matrixQualifying: false });
  return { files, refs, values, input: { manifest, run, pointIndex, readArtifact: ref => files.get(ref.path),
    readSource: (_revision, path) => fs.readFile(path) }, put };
}
let f = fixture(), report = await reviewWorldMetrics(f.input);
assert.deepEqual(report.metrics.map(row => row.metric), WORLD_METRICS);
assert(report.complete); assert.equal(report.matrixQualifying, false); assert.equal(report.originalEvidence.status, 'PASS_SCOPED');
assert.equal(report.metrics[2].final.abandoned, 1); assert.equal(report.metrics[2].final.completed, 0);
assert.equal(report.metrics[10].final.lifetimeInactive, 1); assert.equal(report.metrics[10].final.intervalInactive, 2);
assert.equal(report.metrics[13].final.perPlayer[1].command.p95Ms, null);
assert(report.retainedCaveats.configuration.length); assert(report.separateReleaseGates.some(row => row.includes('12-hour')));
// Logical-cell metrics do not acquire the separate soak's latency limits or an
// invented minimum resource cardinality. Zero rewards and zero calls stay null.
f = fixture({ resourceCount: 0 }); assert((await reviewWorldMetrics(f.input)).complete);
for (const [option, metric] of [['latency', 13], ['economyGap', 4], ['knowledgeGap', 9], ['unknownObjective', 8], ['unresolvedCampaign', 6], ['openOperation', 7]]) {
  f = fixture({ [option]: option !== 'latency' }); report = await reviewWorldMetrics(f.input);
  assert.equal(report.metrics[metric].status, 'UNKNOWN', option); assert(!report.complete); assert(!report.matrixQualifying);
}
f = fixture({ openOperation: true, recoveredOperation: true }); report = await reviewWorldMetrics(f.input);
assert.equal(report.metrics[7].final.orphanedOperations, 0); assert(report.complete);
f = fixture(); f.files.set('knowledge-final.json', Buffer.from('{}'));
await assert.rejects(() => reviewWorldMetrics(f.input), /Artifact bytes changed/);
f = fixture(); f.input.readSource = () => 'changed source';
await assert.rejects(() => reviewWorldMetrics(f.input), /Campaign metric source changed/);
f = fixture(); f.input.readSource = async (_revision, path) => (await fs.readFile(path, 'utf8')).replace(/\r?\n/g, '\r\n');
assert((await reviewWorldMetrics(f.input)).complete);
f = fixture(); const missingSeries = copy(f.values.get('checkpoint-series-points.json'));
missingSeries.sampling.periodMs = 900000;
f.input.pointIndex = f.put('missing-series-index.json', missingSeries);
report = await reviewWorldMetrics(f.input);
assert(report.metrics.every(row => row.status === 'UNKNOWN'));
assert(report.metrics[0].gaps.every(row => row.reason.includes('declared checkpoint sampling')));
// A replaced, self-consistent point cannot silently leave the original run.
f = fixture(); const point = copy(f.values.get('checkpoint-series-points.json'));
point.points[1].economy = f.put('replacement-economy.json', f.values.get('economy-metrics-final.json'));
f.input.pointIndex = f.put('replacement-index.json', point);
await assert.rejects(() => reviewWorldMetrics(f.input), /not bound by the original run/);
console.log('world metrics review: fourteen frozen metrics, scoped provenance, exact artifacts, denominators and conservative gaps passed');
