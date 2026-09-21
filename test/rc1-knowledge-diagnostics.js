import assert from 'node:assert/strict';
import { collectKnowledgeDiagnostics } from '../tools/rc1-knowledge-diagnostics.js';

const claim = (id, owned = true) => ({ id, owned, domain: 'example', contentHash: 'test-hash',
  source: { root: 'public-root' }, value: 'DO NOT COPY', grants: [{ id: 'private-grant' }] });
const options = { roster: ['one', 'absent'], serialBoundary: 'unit-boundary', pageSize: 1 };
const calls = [];
const metrics = await collectKnowledgeDiagnostics({ ...options, readPage: async (actor, input) => {
  calls.push({ actor, input });
  if (actor === 'absent') return { claims: [], nextCursor: null };
  return input.cursor ? { claims: [claim('b', false)], nextCursor: null }
    : { claims: [claim('a')], nextCursor: 'continue' };
} });
assert.equal(metrics.perPlayer[0].pages, 2); assert.equal(metrics.perPlayer[0].sharedClaims, 1);
assert.equal(metrics.perPlayer[1].accessibleClaims, 0); assert.equal(metrics.distinctAccessibleClaims, 2);
assert(!JSON.stringify(metrics).includes('DO NOT COPY')); assert(!JSON.stringify(metrics).includes('private-grant'));
assert.deepEqual(calls[1].input, { limit: 1, cursor: 'continue' });
await assert.rejects(collectKnowledgeDiagnostics({ ...options, maximumPagesPerActor: 1,
  readPage: async () => ({ claims: [claim('a')], nextCursor: 'continue' }) }), /bound reached/);
await assert.rejects(collectKnowledgeDiagnostics({ ...options,
  readPage: async () => ({ claims: [claim('a')], nextCursor: 'continue' }) }), /Repeated or invalid/);
let page = 0;
await assert.rejects(collectKnowledgeDiagnostics({ ...options,
  readPage: async () => ({ claims: [claim(String(page++))], nextCursor: 'same' }) }), /Repeated.*cursor/);
await assert.rejects(collectKnowledgeDiagnostics({ ...options,
  readPage: async () => ({ claims: [], nextCursor: 'empty' }) }), /Empty/);
await assert.rejects(collectKnowledgeDiagnostics({ ...options,
  readPage: async () => { throw Object.assign(Error('unavailable'), { code: 'coordination_unavailable' }); } }),
  (error) => error.code === 'coordination_unavailable', 'Failed canonical read cannot become zero accessible claims');
console.log('PASS: complete Knowledge pagination, zero-access actors, bounded failures and restricted metric fields');

if (process.argv.includes('--postgres')) {
  const { commandDatabase, addPlayer, key } = await import('./lib/player-command-support.js');
  const { sourceIdentity, createProofRecorder, verifyArtifactIndex } = await import('../tools/rc1-native-proof.js');
  const { createCoordinationService } = await import('../src/coordination/runtime.js');
  const { COORDINATION_KNOWLEDGE_PILOT } = await import('../src/coordination/pilot.js');
  const { coordinationGraphs } = await import('../src/coordination/graph.js');
  const source = await sourceIdentity();
  const output = process.env.RC1_KNOWLEDGE_OUTPUT; assert(output, 'Provide a new restricted evidence directory');
  const proof = await createProofRecorder({ directory: output, source, runId: 'knowledge-distribution',
    seed: 'native-canonical-knowledge', scenarioId: 'scoped-knowledge-distribution', population: 3,
    configuration: { scope: 'Canonical Knowledge metric: discovery, explicit sharing, pagination and revocation',
      fixture: 'Three synthetic accounts with addPlayer defaults; source pilot graph, no production rollout claim',
      pageSize: 1, concurrency: 'Serial with no worker', actorFeedback: false } });
  let database, result;
  try {
    database = await commandDatabase('knowledge_diagnostics');
    const pool = database.pool, roster = ['metric-a', 'metric-b', 'metric-c'];
    await addPlayer(pool, roster[0], 'MetricA', 'docks');
    await addPlayer(pool, roster[1], 'MetricB', 'foundry');
    await addPlayer(pool, roster[2], 'MetricC', 'docks');
    const api = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT,
      enabled: true, knowledgeEnabled: true, sharingEnabled: true });
    const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
    await proof.snapshot(pool, 'fixture');
    for (const accountId of roster.slice(0, 2)) {
      let instance = (await api.create(accountId, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
      instance = (await api.act(accountId, instance.id,
        { expectedRevision: instance.revision, actionId: instance.actions[0].id }, key())).instance;
      const action = instance.actions.find((candidate) => candidate.kind === 'discover'); assert(action);
      await api.act(accountId, instance.id, { expectedRevision: instance.revision, actionId: action.id }, key());
    }
    const observe = async (label) => {
      const before = await proof.snapshot(pool, `${label}-before`);
      const value = await collectKnowledgeDiagnostics({ roster, readPage: api.knowledgeBoard,
        serialBoundary: label, pageSize: 1 });
      const after = await proof.snapshot(pool, `${label}-after`);
      assert.equal(after.stateSha256, before.stateSha256, 'Knowledge metric mutated canonical state');
      await proof.artifact(`${label}-metric.json`, value); return value;
    };
    const own = await observe('owned-only');
    assert.deepEqual(own.perPlayer.map((row) => row.accessibleClaims), [1, 1, 0]);
    const foreign = (await api.knowledgeBoard(roster[1])).claims[0];
    const target = (await api.knowledgeTargets(roster[1], { characterName: 'MetricA' })).targets[0]; assert(target);
    const shared = await api.shareKnowledge(roster[1], foreign.id,
      { targetId: target.id, expectedAclRevision: foreign.aclRevision }, key());
    const sharedMetric = await observe('shared');
    assert.deepEqual(sharedMetric.perPlayer.map((row) => row.accessibleClaims), [2, 1, 0]);
    assert.equal(sharedMetric.perPlayer[0].pages, 2);
    assert.equal(sharedMetric.perPlayer[0].sharedClaims, 1);
    assert.equal(sharedMetric.distinctAccessibleClaims, 2);
    await api.revokeKnowledge(roster[1], foreign.id,
      { grantId: shared.claim.grants[0].id, expectedAclRevision: shared.claim.aclRevision }, key());
    const revoked = await observe('revoked');
    assert.deepEqual(revoked.perPlayer.map((row) => row.accessibleClaims), [1, 1, 0]);
    result = { status: 'PASS_SCOPED', phases: 3, canonicalSnapshotsUnchanged: true,
      ownedCounts: [1, 1, 0], sharedCounts: [2, 1, 0], revokedCounts: [1, 1, 0],
      pagination: 'Actor A crossed the first page; both distinct claims retained',
      exclusions: ['Family/Crew grant membership changes', 'Future Knowledge acquisition reachability',
        'Full world integration and 225-run matrix'] };
  } catch (error) {
    result = { status: 'FAIL', error: error.message, stack: error.stack };
    if (database) await proof.snapshot(database.pool, 'first-failure');
    process.exitCode = 1;
  } finally {
    if (database) await database.cleanup(database.pool);
    const record = await proof.finish(result); await verifyArtifactIndex(output, record);
  }
  console.log(JSON.stringify(result));
}
