// Pure observer join of the fourteen frozen metrics. This never admits a world
// cell, upgrades its original evidence kind, or supplies actor-policy inputs.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';

const hash = value => sha256(canonicalJson(value));
const count = value => Number.isSafeInteger(value) && value >= 0;
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const sum = values => values.reduce((a, b) => a + b, 0);
const positivePath = value => ['REACHABLE', 'BOUNDED_WAIT'].includes(value);
export const WORLD_METRICS = Object.freeze([
  'meaningful actions', 'generated/accepted/ignored authorized opportunities',
  'created/completed/failed campaigns', 'coordination participation', 'resource velocity',
  'inventory/Family concentration', 'deadlocked campaigns', 'orphaned operations',
  'unreachable objectives', 'Knowledge distribution', 'inactivity', 'reward concentration',
  'world/database growth', 'command latency',
]);
const campaignSources = {
  'src/director/runtime.js': '04ff17562903a3593725921a9ba3b2f90620a1c6e71b85a3ae053540bc49e0f8',
  'src/director/storage.js': '15586a5ab7884ce613c76cac73f8f1f9b6396a10f9f470fe964260b89dd9f606',
};
const scopes = {
  'created/completed/failed campaigns': 'World/object-owned campaigns; no individual creator or personal completion is invented. Native abandoned is reported separately from completed.',
  'inventory/Family concentration': 'Original owner-scoped inventories and Family membership/treasury/reserve distributions; item representations remain separate.',
  'deadlocked campaigns': 'Actual unresolved world campaign identities, with applicable canonical recovery results; overdue does not mean permanently deadlocked.',
  'orphaned operations': 'World operation identities and original per-player role participation; an open or expired operation is not automatically an orphan.',
  'unreachable objectives': 'Complete stored unresolved objective inventory, retaining original owner scope and applicable canonical paths.',
  'world/database growth': 'Global logical table rows and physical relation bytes. Physical allocation has no meaningful per-player attribution.',
  'command latency': 'Measured process segment read/command wrapper wall time, including instrumentation, denials and retries. No production capacity threshold is applied to logical cells.',
};

// run and pointIndex are exact {path,sha256} references. All metric inputs must
// appear in the run's existing artifact list. readSource reads the specified Git
// revision (not an arbitrary current checkout); CRLF is normalized to LF.
export async function reviewWorldMetrics({ manifest, run: runReference, pointIndex, readArtifact, readSource }) {
  assert.deepEqual(manifest.metrics, WORLD_METRICS);
  assert.deepEqual(manifest.metricRules.meaningfulActionsExclude, ['reads', 'telemetry', 'invalid attempts', 'replays']);
  assert.equal(manifest.metricRules.distributions, 'time series, per-player distributions, final totals');
  assert.equal(manifest.metricRules.ignoredOpportunity, 'Expiration or explicit observation window after an authorized exposure');
  const read = async ref => {
    assert(ref?.path && /^[a-f0-9]{64}$/.test(ref.sha256 || ''));
    const bytes = await readArtifact(ref); assert.equal(sha256(bytes), ref.sha256, 'Artifact bytes changed: ' + ref.path);
    return JSON.parse(String(bytes));
  };
  const run = await read(runReference), index = await read(pointIndex);
  assert.equal(hash(run.configuration), run.configurationSha256, 'Run configuration changed');
  const binding = { sourceRevision: run.source.revision, configurationSha256: run.configurationSha256 };
  assert.deepEqual(index.binding, binding);
  assert(Array.isArray(index.points) && index.points.length > 0);
  for (const [path, digest] of Object.entries(campaignSources))
    assert.equal(sha256(String(await readSource(binding.sourceRevision, path)).replace(/\r\n/g, '\n')), digest, 'Campaign metric source changed: ' + path);
  const registered = new Map(run.artifacts.map(ref => [ref.path, ref]));
  assert.equal(registered.size, run.artifacts.length);
  const original = async ref => {
    if (!ref) return null;
    assert.equal(registered.get(ref.path)?.sha256, ref.sha256, 'Artifact is not bound by the original run: ' + ref.path);
    return read(ref);
  };
  const named = name => original(registered.get(name));
  const player = await named('player-metrics.json'), knowledgeBoundaries = await named('knowledge-boundaries.json');
  const series = [], gaps = Object.fromEntries(WORLD_METRICS.map(metric => [metric, []]));
  const gap = (metric, label, reason) => gaps[metric].push({ label, reason });
  let previousActions = new Map(), previousAt = index.startAt;
  for (const point of index.points) {
    const { logicalAt, stateSha256 } = point.binding;
    assert.equal(point.binding.sourceRevision, binding.sourceRevision);
    assert.equal(point.binding.configurationSha256, binding.configurationSha256);
    assert(count(logicalAt) && logicalAt >= index.startAt && logicalAt <= index.endAt);
    assert(logicalAt >= previousAt, 'Metric checkpoints are not ordered'); previousAt = logicalAt;
    const snapshot = await original(point.snapshot), diagnostic = await original(point.diagnostics);
    assert.equal(snapshot?.stateSha256, stateSha256);
    assert.equal(hash({ tables: snapshot.tables, sequences: snapshot.sequences }), stateSha256);
    assert.equal(new Date(snapshot.capturedAt).getTime(), logicalAt);
    const d = diagnostic?.semantic; assert.equal(d?.logicalAt, logicalAt);
    const label = point.snapshot.path.replace(/\.json$/, '');
    const final = label === 'final', values = {}, evidence = { snapshot: point.snapshot, diagnostics: point.diagnostics };
    const rows = name => {
      assert(Array.isArray(snapshot.tables[name]), 'Missing complete native table: ' + name);
      return snapshot.tables[name].map(JSON.parse);
    };
    const actors = d.actions?.perPlayer;
    assert(Array.isArray(actors) && actors.every(row => typeof row.accountId === 'string' && count(row.actions)));
    const roster = actors.map(row => row.accountId);
    assert.equal(new Set(roster).size, roster.length);
    const denominator = entries => Array.isArray(entries) && same(entries.map(row => row.accountId).sort(), [...roster].sort());
    values['meaningful actions'] = { total: sum(actors.map(row => row.actions)), perPlayer: actors };
    if (!player?.meaningfulActionDefinition?.includes('excludes reads/replays/denials/authentication'))
      gap('meaningful actions', label, 'Missing retained fresh-action definition');
    if (final && !same(Object.fromEntries(actors.map(row => [row.accountId, row.actions])), player?.actorActions))
      gap('meaningful actions', label, 'Final action counters do not match the checkpoint distribution');
    const interval = actors.map(row => ({ accountId: row.accountId, actions: row.actions - (previousActions.get(row.accountId) || 0) }));
    assert(interval.every(row => count(row.actions)), 'Action counters moved backwards');
    values.inactivity = { lifetimeInactive: actors.filter(row => row.actions === 0).length,
      intervalInactive: interval.filter(row => row.actions === 0).length, perPlayer: interval,
      denominator: 'Append-only observed synthetic accounts, including retired actors; interval means since the preceding retained observation, first from the measured baseline.' };
    previousActions = new Map(actors.map(row => [row.accountId, row.actions]));
    const day = player?.days?.find(row => label === 'day-' + row.day && row.logicalAt === logicalAt);
    const opportunity = final ? player?.opportunities : day?.opportunityObservation;
    const opportunityKeys = ['generatedAuthorizedOpportunities', 'acceptedOpportunities', 'ignoredOpportunities', 'pendingOpportunities'];
    if (!opportunity || !denominator(opportunity.perPlayer) || !opportunityKeys.every(key => count(opportunity[key])
      && opportunity.perPlayer.every(row => count(row[key])) && sum(opportunity.perPlayer.map(row => row[key])) === opportunity[key])
      || opportunity.generatedAuthorizedOpportunities !== opportunity.acceptedOpportunities + opportunity.ignoredOpportunities + opportunity.pendingOpportunities
      || !count(opportunity.observationWindowMs) || !opportunity.observationWindowMs)
      gap(WORLD_METRICS[1], label, 'Missing authorized exposure classification and its full per-player denominator');
    values[WORLD_METRICS[1]] = opportunity || null;

    const campaigns = rows('director_campaigns'), operations = rows('world_operations'), participants = rows('world_operation_roles');
    const statuses = Object.fromEntries([...new Set(campaigns.map(row => row.status))].sort()
      .map(status => [status, campaigns.filter(row => row.status === status).length]));
    values[WORLD_METRICS[2]] = { created: campaigns.length, completed: statuses.completed || 0,
      abandoned: statuses.abandoned || 0, active: statuses.active || 0, nativeStatuses: statuses,
      failureDisposition: 'Original expiry or unrecoverable branch records abandoned; it is not an invented failed status.' };
    if (Object.keys(statuses).some(status => !['active', 'completed', 'abandoned'].includes(status)))
      gap(WORLD_METRICS[2], label, 'Unreviewed native campaign status');
    values[WORLD_METRICS[3]] = { roleAssignments: participants.length,
      participatingAccounts: new Set(participants.map(row => row.account_id)).size,
      perPlayer: roster.map(accountId => ({ accountId, roles: participants.filter(row => row.account_id === accountId).length,
        operationIds: [...new Set(participants.filter(row => row.account_id === accountId).map(row => row.operation_id))] })),
      scope: 'Current canonical role assignments, including zero-participation players; not cumulative historical joins.' };
    const characters = rows('characters'), members = rows('gang_members');
    // Keep exact original amounts and representation boundaries. An actor's
    // absent ownership is an explicit empty holding list, not an omitted actor.
    const holdingPlayers = roster.map(accountId => {
      const characterIds = new Set(characters.filter(row => row.account_id === accountId).map(row => row.id));
      return { accountId, inventory: Object.fromEntries(['stacks', 'uniqueItems', 'lots'].map(kind => [kind,
        (d.inventory?.[kind] || []).map(group => ({ identity: group.identity,
          holdings: group.perOwner.filter(row => row.owner[0] === 'account' && row.owner[1] === accountId
            || row.owner[0] === 'character' && characterIds.has(row.owner[1])) })).filter(group => group.holdings.length)])),
      familyIds: [...new Set(members.filter(row => characterIds.has(row.character_id)).map(row => row.gang_id))] };
    });
    values[WORLD_METRICS[5]] = { inventory: d.inventory, families: d.families, perPlayer: holdingPlayers,
      attribution: 'Direct account/character holdings only; Family/Crew/escrow pools retain their shared original owner scope and are never copied to every member.' };
    if (!['stacks', 'uniqueItems', 'lots'].every(kind => Array.isArray(d.inventory?.[kind])
      && d.inventory[kind].every(row => Array.isArray(row.perOwner) && row.concentration))
      || !Array.isArray(d.families?.perFamily) || !['livingDeclaredMembershipConcentration', 'treasuryCashConcentration', 'reserveOmrConcentration'].every(key => d.families[key]))
      gap(WORLD_METRICS[5], label, 'Missing original owner/Family distribution');

    const recovery = await original(point.recovery), backlog = await original(point.backlog);
    if (recovery) { assert.deepEqual(recovery.binding, point.binding); evidence.recovery = point.recovery; }
    if (backlog) { assert.deepEqual(backlog.binding, point.binding); evidence.backlog = point.backlog; }
    const subjects = d.objectiveInventory?.subjects, results = recovery?.joined?.scopes?.objectives?.results;
    const inventoryComplete = d.objectiveInventory?.tablesComplete === true && recovery?.inventories?.objectives?.complete === true
      && Array.isArray(subjects) && Array.isArray(results)
      && same(subjects.map(row => row.type + ':' + row.id).sort(), results.map(row => row.id).sort());
    const unknownObjectives = inventoryComplete ? results.filter(row => !positivePath(row.status)).map(row => row.id) : null;
    values[WORLD_METRICS[8]] = { permanentlyUnreachable: inventoryComplete && unknownObjectives.length === 0 ? 0 : null,
      unresolvedSubjects: subjects || null, unknown: unknownObjectives,
      scope: 'Positive paths may complete or legally retire the actual stored objective; optional simultaneous outcomes are not additional obligations.' };
    if (values[WORLD_METRICS[8]].permanentlyUnreachable === null)
      gap(WORLD_METRICS[8], label, 'Actual required objective inventory needs applicable canonical path dispositions');
    const activeCampaigns = campaigns.filter(row => row.status === 'active');
    const unknownCampaigns = activeCampaigns.filter(row => !inventoryComplete
      || !results.some(result => result.id === 'campaign:' + row.id && positivePath(result.status))).map(row => row.id);
    values[WORLD_METRICS[6]] = { deadlocked: unknownCampaigns.length ? null : 0,
      activeIds: activeCampaigns.map(row => row.id), unknownIds: unknownCampaigns,
      overdueIds: d.director?.overdueActiveCampaignIds || [] };
    if (unknownCampaigns.length) gap(WORLD_METRICS[6], label, 'Active campaigns lack exact canonical recovery dispositions; overdue is only an observation');
    const live = backlog?.review?.liveState, structural = live?.structuralOrphanOperations;
    const recoveryOperations = live?.recoveryRequiredOperationIds;
    const operationPaths = Array.isArray(recoveryOperations) && inventoryComplete && recoveryOperations.every(id =>
      results.some(result => result.id === 'operation:' + id && positivePath(result.status)));
    const orphans = count(live?.orphanedOperations) ? live.orphanedOperations
      : count(structural) && operationPaths ? structural : null;
    values[WORLD_METRICS[7]] = { orphanedOperations: orphans, structuralOrphanOperations: structural ?? null,
      recoveryRequiredOperationIds: recoveryOperations ?? null, operations: operations.length };
    if (orphans === null) gap(WORLD_METRICS[7], label, 'Missing exact operation structural/recovery observation');

    const knowledge = await named('knowledge-' + label + '.json');
    const boundary = knowledgeBoundaries?.find(row => row.label === label && row.logicalAt === logicalAt);
    if (!knowledge?.complete || !denominator(knowledge.perPlayer) || !knowledge.perPlayer.every(row => row.complete)
      || !boundary || boundary.beforeStateSha256 !== stateSha256 || boundary.afterStateSha256 !== stateSha256
      || boundary.diagnosticSha256 !== hash(knowledge)) gap(WORLD_METRICS[9], label, 'Missing complete canonical Knowledge pages bound to unchanged checkpoint state');
    values[WORLD_METRICS[9]] = knowledge ? { perPlayer: knowledge.perPlayer.map(({ claims, ...row }) => row),
      distinctAccessibleClaims: knowledge.distinctAccessibleClaims, perClaim: knowledge.perClaim, accessConcentration: knowledge.accessConcentration } : null;
    if (knowledge) evidence.knowledge = registered.get('knowledge-' + label + '.json');

    const economy = await original(point.economy);
    if (economy) {
      evidence.economy = point.economy;
      assert.equal(economy.logicalAt, logicalAt); assert.equal(economy.nativeHash, point.economyNativeHash);
      assert.equal(economy.boundaryChain, point.economyBoundaryChain);
    }
    const economicCoverage = economy && Array.isArray(economy.resources) && Array.isArray(economy.missingCoverage)
      && economy.missingCoverage.length === 0 && same([...economy.enrolledRoster].sort(), [...roster].sort());
    for (const metric of [WORLD_METRICS[4], WORLD_METRICS[11]]) if (!economicCoverage)
      gap(metric, label, 'Missing complete native receipt/item flow classification at this checkpoint');
    values[WORLD_METRICS[4]] = economy?.resources.map(row => ({ resource: row.resource, flows: row.flows,
      unitsPerLogicalDay: row.unitsPerLogicalDay, transferTurnover: row.transferTurnover, perPlayer: row.perPlayerFlows })) ?? null;
    values[WORLD_METRICS[11]] = economy?.resources.map(row => ({ resource: row.resource, reward: row.reward, categories: row.rewardCategories })) ?? null;
    for (const row of economy?.resources || []) {
      if (!denominator(row.perPlayerFlows) || !row.flows || !row.unitsPerLogicalDay)
        gap(WORLD_METRICS[4], label, 'Incomplete per-player flow distribution: ' + row.resource);
      if (!denominator(row.reward?.perPlayer) || !Array.isArray(row.rewardCategories)
        || !row.rewardCategories.every(category => denominator(category.perPlayer)))
        gap(WORLD_METRICS[11], label, 'Incomplete per-player reward distribution: ' + row.resource);
    }
    const worldRows = d.worldRows, bytes = diagnostic.physicalDiagnostics?.relationBytes;
    values[WORLD_METRICS[12]] = { worldRows, relationBytes: bytes,
      totalRows: Array.isArray(worldRows) ? worldRows.reduce((total, row) => total + BigInt(row.count), 0n).toString() : null,
      totalRelationBytes: Array.isArray(bytes) ? bytes.reduce((total, row) => total + BigInt(row.bytes), 0n).toString() : null };
    if (!Array.isArray(worldRows) || !Array.isArray(bytes)
      || !same(worldRows.map(row => row.table).sort(), Object.keys(snapshot.tables).sort())
      || !same(bytes.map(row => row.table).sort(), Object.keys(snapshot.tables).sort())
      || !worldRows.every(row => BigInt(row.count) === BigInt(snapshot.tables[row.table].length)))
      gap(WORLD_METRICS[12], label, 'Missing complete table row/physical allocation observation');
    const latency = final ? player?.latencyDistribution : player?.latencyTimeSeries?.find(row => row.logicalAt === logicalAt);
    const measured = value => value && count(value.count) && ['p50Ms', 'p95Ms', 'p99Ms', 'maximumMs']
      .every(key => value.count === 0 ? value[key] === null : Number.isFinite(value[key]) && value[key] >= 0);
    if (!latency || !denominator(latency.perPlayer) || !['read', 'command'].every(kind => measured(latency.totals?.[kind])
      && measured(latency.unattributed?.[kind]) && latency.perPlayer.every(row => measured(row[kind]))
      && latency.totals[kind].count === sum(latency.perPlayer.map(row => row[kind].count)) + latency.unattributed[kind].count))
      gap(WORLD_METRICS[13], label, 'Missing measured segment latency totals, per-player attribution or series point');
    values[WORLD_METRICS[13]] = latency || null;
    series.push({ label, binding: point.binding, evidence, values });
  }
  const final = series.find(row => row.label === 'final');
  assert(final && final.binding.logicalAt === index.endAt, 'Missing actual final observation');
  // Use the actual declared sampling period, not a new metric cadence. A first
  // partial interval is allowed; complete later boundaries may not disappear.
  assert(count(index.sampling?.phaseAt) && count(index.sampling?.periodMs) && index.sampling.periodMs > 0);
  for (let at = index.sampling.phaseAt + index.sampling.periodMs; at <= index.endAt; at += index.sampling.periodMs)
    if (at > index.startAt && !series.some(row => row.binding.logicalAt === at))
      for (const metric of WORLD_METRICS) gap(metric, 'logicalAt:' + at, 'Missing observation from the declared checkpoint sampling schedule');
  for (const day of player?.days || []) assert(series.some(row => row.label === 'day-' + day.day
    && row.binding.logicalAt === day.logicalAt), 'Daily player measurement lacks its checkpoint');
  const metrics = WORLD_METRICS.map(metric => ({ metric, status: gaps[metric].length ? 'UNKNOWN' : 'OBSERVED',
    scope: scopes[metric] || 'Daily and final original observations with full declared synthetic-account denominator, including zeros.',
    gaps: gaps[metric], final: final.values[metric] }));
  return { format: 1, binding, evidence: { run: runReference, pointIndex,
    playerMetrics: registered.get('player-metrics.json') || null, knowledgeBoundaries: registered.get('knowledge-boundaries.json') || null },
    sourcePins: campaignSources, startAt: index.startAt, endAt: index.endAt, metrics, series,
    complete: metrics.every(row => row.status === 'OBSERVED'),
    originalEvidence: { status: run.status, evidenceKind: run.evidenceKind, matrixQualifying: run.matrixQualifying },
    retainedCaveats: { configuration: run.configuration.coverageMissing || [], diagnostic: 'Static unresolved strings are preserved in the referenced diagnostics; actual joined evidence, not string deletion, determines metric coverage.' },
    remainingCellAdmission: ['Applicable scenario policy and declared population/seed', 'Existing resource/invariant and authorization gates',
      'Original-worker coverage, minimum duration, full applicable lifecycle cycles, and stabilization', 'Required replay/recovery applicability and original native evidence qualification'],
    separateReleaseGates: ['Production-equivalent 12-hour/1000-actor soak and load thresholds', 'Deployed configuration/activation attestation', 'Real-player cohort and global matrix coverage'],
    matrixQualifying: false };
}
