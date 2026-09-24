// Public-projection actor controls only. This mock is not native gameplay evidence.
import assert from 'node:assert/strict';
import { createAllianceWorldAdapter, ALLIANCE_CONTINUOUS_WORLD_CONTRACT } from '../tools/rc1-alliance-world-adapter.js';
import { actorValueHash } from '../tools/rc1-native-actor-replay.js';

function fixture(population = 25, seed = 'rc1-alpha') {
  const roster = Array.from({ length: population }, (_, i) => ({ accountId: 'actor-' + i, characterId: 'character-' + i, name: 'Actor ' + i }));
  const make = () => createAllianceWorldAdapter({ seed, roster, mode: 'continuous' });
  const legacy = createAllianceWorldAdapter({ seed, roster: roster.slice(0, 25) });
  const families = Object.fromEntries(roster.slice(0, 3).map((a, i) => [a.accountId, 'family-' + i]));
  const claims = new Map(roster.slice(0, 3).map((a, i) => ['claim-' + i, { id: 'claim-' + i, owner: a.accountId, aclRevision: 0,
    source: { root: i === 1 ? 'foundry.impression' : 'docks.manifest' }, grants: [] }]));
  const instances = new Map(), locations = new Map(roster.map(a => [a.accountId, 'docks'])), pacts = new Map(), receipts = new Map();
  const executed = []; let now = 0, checkpointHook = async () => {}, replayUnknown = false;
  const actorFor = accountId => roster.find(a => a.accountId === accountId);
  const pair = (a, b) => [a, b].sort().join(':');
  const instance = accountId => {
    const value = instances.get(accountId); if (!value) return null;
    return { id: value.id, revision: value.revision, status: value.revision >= 4 ? 'completed' : 'active',
      actions: value.revision >= 4 ? [] : [{ id: 'issued-' + value.revision, nodeId: 'case-step' }],
      nodes: [{ id: 'conclusion', status: value.revision >= 4 ? 'completed' : 'hidden' }] };
  };
  const visible = (accountId, claim) => claim.owner === accountId || claim.grants.some(g => g.accountId === accountId);
  const projectedClaim = (accountId, claim) => ({ id: claim.id, owned: claim.owner === accountId, source: claim.source,
    ...(claim.owner === accountId ? { aclRevision: claim.aclRevision, grants: claim.grants.map(({ accountId: _account, ...g }) => g) } : {}) });
  for (let i = 0; i < 3; i++) {
    const actor = roster[i];
    const view = { accountId: actor.accountId, session: { authed: true, character: { id: actor.characterId } },
      me: { character: { id: actor.characterId } }, catalog: { graphs: [{ id: 'omerta.coordination.split-ledger', contentHash: 'a'.repeat(64) }] } };
    const chosen = legacy.choose(i, 'create', view, { logicalAt: 0 });
    instances.set(actor.accountId, { id: 'case-' + actor.accountId, revision: 4 });
    legacy.settle(i, chosen, { status: 200, replayed: false, body: { instance: instance(actor.accountId) } });
  }
  const prefix = legacy.checkpoint(); prefix.payload.state.completedStages = [0, 1]; prefix.payload.state.families = families;
  prefix.payload.state.claims = Object.fromEntries(roster.slice(0, 3).map((a, i) => [a.accountId, 'claim-' + i]));
  prefix.payload.state.completions = roster.slice(0, 3).map(a => ({ accountId: a.accountId, logicalAt: 86400000 }));
  prefix.sha256 = actorValueHash(prefix.payload);
  const saved = make().checkpoint(); saved.payload.state.completedStages = [0, 1]; saved.payload.legacy = prefix;
  saved.sha256 = actorValueHash(saved.payload);
  let adapter = make().restore(saved);
  const hooks = day => ({ logicalAt: now = day * 86400000,
    async read(accountId, pathname, expected = 200) {
      const actor = actorFor(accountId); assert(actor, 'Only the declared public actor may read');
      if (pathname === '/v1/session') return { authed: true, character: { id: actor.characterId } };
      if (pathname === '/v1/me') return { character: { id: actor.characterId, alive: true, level: 75, cash: 100000,
        jailSeconds: 0, loc: locations.get(accountId), gang: families[accountId] ? { id: families[accountId], role: 'boss' } : null } };
      if (pathname === '/v1/rules') return { family: { foundCost: 25000 }, travelCost: 100,
        districts: [{ id: 'docks' }, { id: 'foundry' }] };
      if (pathname === '/v1/gangs') return { gangs: Object.values(families).map(id => ({ id, npc: false })) };
      if (pathname === '/v1/diplomacy') return { relations: Object.values(families).filter(id => id !== families[accountId]).flatMap(withId => {
        const pact = pacts.get(pair(families[accountId], withId));
        return pact ? [{ withId, active: pact.until > now, pending: !pact.until, mine: pact.from === families[accountId] }] : [];
      }) };
      if (pathname === '/v1/coordination') return { graphs: [{ id: 'omerta.coordination.split-ledger', contentHash: 'a'.repeat(64) }] };
      if (pathname === '/v1/coordination/knowledge') return { claims: [...claims.values()].filter(c => visible(accountId, c)).map(c => projectedClaim(accountId, c)) };
      if (pathname.startsWith('/v1/coordination/knowledge/targets')) {
        const label = new URL(pathname, 'http://local').searchParams.get('characterName'), target = roster.find(a => a.name === label);
        return { expiresAt: new Date(now + 60000).toISOString(), targets: target ? [{ kind: 'account', label, id: 'target-' + target.accountId }] : [] };
      }
      if (pathname.startsWith('/v1/coordination/instances/')) {
        const value = instance(accountId); assert.equal(value.id, pathname.split('/').at(-1)); return value;
      }
      if (pathname.startsWith('/v1/coordination/knowledge/')) {
        const claim = claims.get(pathname.split('/').at(-1));
        if (!claim || !visible(accountId, claim)) { assert.equal(expected, 404); return { error: 'coordination_unavailable' }; }
        assert.equal(expected, 200, 'Revoked or unselected reader still has access'); return { claim: projectedClaim(accountId, claim), links: [] };
      }
      throw Error('Unexpected public read: ' + pathname);
    },
    async execute(accountId, request) {
      assert(actorFor(accountId)); assert.equal(request.method, 'POST');
      if (receipts.has(request.idempotencyKey)) return { ...structuredClone(receipts.get(request.idempotencyKey)), replayed: true };
      const parts = request.path.split('/'); let body;
      if (request.path === '/v1/checkin') body = { ok: true };
      else if (request.path.startsWith('/v1/diplomacy/pact/')) {
        const target = parts[4], key = pair(families[accountId], target);
        if (parts[5] === 'accept') { const pact = pacts.get(key); assert(pact && pact.from !== families[accountId]); pact.until = now + 4 * 86400000; }
        else pacts.set(key, { from: families[accountId], until: null });
        body = { ok: true };
      } else if (request.path.startsWith('/v1/travel/')) { locations.set(accountId, parts[3]); body = { ok: true }; }
      else if (parts[3] === 'knowledge') {
        const claim = claims.get(parts[4]); assert.equal(claim.owner, accountId); assert.equal(request.body.expectedAclRevision, claim.aclRevision);
        if (parts[5] === 'share') {
          const targetId = request.body.targetId.slice('target-'.length), target = actorFor(targetId);
          assert(target && !claim.grants.some(g => g.accountId === targetId));
          claim.grants.push({ accountId: targetId, id: 'grant-' + claim.aclRevision, kind: 'account', label: target.name });
        } else { assert.equal(parts[5], 'revoke'); assert(claim.grants.some(g => g.id === request.body.grantId));
          claim.grants = claim.grants.filter(g => g.id !== request.body.grantId); }
        claim.aclRevision++; body = { claim: projectedClaim(accountId, claim) };
      } else if (parts[3] === 'instances') {
        const value = instances.get(accountId); assert.equal(value.id, parts[4]); assert(value.revision < 4);
        assert.equal(request.body.expectedRevision, value.revision); assert.equal(request.body.actionId, 'issued-' + value.revision);
        assert([...claims.values()].some(c => visible(accountId, c) && c.owner !== accountId), 'Case needs an actual granted source');
        value.revision++; body = { instance: instance(accountId) };
      } else {
        assert.equal(request.path, '/v1/coordination/omerta.coordination.split-ledger/instances');
        assert(!instances.has(accountId), 'Completed per-character cases must not be fabricated again');
        instances.set(accountId, { id: 'case-' + accountId, revision: 0 }); body = { instance: instance(accountId) };
      }
      const response = { status: 200, replayed: replayUnknown, body }; executed.push({ day, accountId, request: structuredClone(request) });
      receipts.set(request.idempotencyKey, response); return response;
    },
    async decision(identity, projection) { assert.equal(identity.accountId, projection.accountId); },
    async checkpoint(phase, saved) { await checkpointHook(phase, saved); },
    async retry() { throw Error('Continuous tasks must not manufacture exact retries as new activity'); },
  });
  return { roster, make, hooks, executed, claims, pacts, saved,
    get adapter() { return adapter; }, restore(value) { adapter = make().restore(value); return adapter; },
    onCheckpoint(fn) { checkpointHook = fn; }, unknownReplay() { replayUnknown = true; } };
}

let populationSeedPairs = 0;
for (const population of ALLIANCE_CONTINUOUS_WORLD_CONTRACT.populations) for (const seed of ALLIANCE_CONTINUOUS_WORLD_CONTRACT.seeds) {
  const f = fixture(population, seed);
  assert.equal(f.adapter.roster(91).length, population);
  await f.adapter.runStage(2, f.hooks(2)); await f.adapter.runStage(3, f.hooks(3));
  const summary = f.adapter.summary();
  assert(summary.dailyCooperation.every(day => day.cooperationSatisfied && day.freshGrants === 3 && day.verifiedGrants === 3));
  assert.deepEqual(summary.dailyCooperation.map(d => d.revocations), [0, 3]);
  assert.equal(new Set(Object.values(summary.families)).size, 3); assert.equal(summary.unknownResponses, 0);
  assert.deepEqual(f.make().restore(JSON.parse(JSON.stringify(f.adapter.checkpoint()))).summary(), summary);
  populationSeedPairs++;
}

const continuing = fixture();
for (let day = 2; day <= 91; day++) await continuing.adapter.runStage(day, continuing.hooks(day));
const summary = continuing.adapter.summary();
assert.equal(summary.dailyCooperation.length, 90); assert.equal(summary.delegateCompletions.length, 22);
assert.equal(summary.dailyCooperation.reduce((n, d) => n + d.newCaseCompletions, 0), 22, 'Finite cases are counted exactly once');
assert.equal(summary.dailyCooperation.reduce((n, d) => n + d.freshGrants, 0), 270);
assert.equal(summary.dailyCooperation.reduce((n, d) => n + d.revocations, 0), 267);
assert(summary.dailyCooperation.every(d => d.freshOperations >= 6 && d.cooperationSatisfied));
assert(continuing.executed.filter(e => e.day >= 6 && e.request.path.includes('/diplomacy/pact/')).length > 0, 'Expired pacts renew canonically');
await assert.rejects(() => continuing.adapter.runStage(91, continuing.hooks(91)), /next continuous day/);
await assert.rejects(() => continuing.adapter.runStage(92, { ...continuing.hooks(92), logicalAt: 91 * 86400000 }), /full logical day/);

const pending = fixture();
assert.deepEqual(await pending.adapter.runStage(2, { ...pending.hooks(2), pauseBeforeDispatch: true }), { paused: true });
const selected = pending.adapter.checkpoint(), selectedRequest = selected.payload.state.pending.decision.request;
assert.equal(pending.executed.length, 0);
pending.restore(JSON.parse(JSON.stringify(selected))); await pending.adapter.runStage(2, pending.hooks(2));
assert.deepEqual(pending.executed[0].request, selectedRequest); assert.equal(pending.adapter.summary().unknownResponses, 0);
const corrupted = structuredClone(selected); corrupted.payload.state.workflow.tasks[0].accountId = 'foreign';
corrupted.sha256 = actorValueHash(corrupted.payload); assert.throws(() => pending.make().restore(corrupted), /task schedule/);
assert.throws(() => pending.make().restore(selected.payload.legacy), /version-three/);

const settled = fixture(); let savedAfterShare;
settled.onCheckpoint(async (phase, saved) => {
  if (!savedAfterShare && phase === 'step-complete' && saved.result.freshGrants === 1) {
    assert.equal(saved.kind, 'alliance-incremental-step'); assert(saved.receipt);
    assert.throws(() => settled.make().restore(saved), 'Incremental evidence is not a restore checkpoint');
    savedAfterShare = settled.adapter.checkpoint(); throw Error('CONTROL_QUIESCENT_STOP');
  }
});
await assert.rejects(() => settled.adapter.runStage(2, settled.hooks(2)), /QUIESCENT_STOP/);
const countAtPause = settled.executed.length; settled.onCheckpoint(async () => {});
settled.restore(savedAfterShare); await settled.adapter.runStage(2, settled.hooks(2));
assert.equal(settled.executed.filter(e => e.request.path.endsWith('/share')).length, 3, 'Settled share must not repeat after restart');
assert(settled.executed.length > countAtPause); assert.equal(settled.adapter.summary().dailyCooperation[0].freshGrants, 3);

const unknown = fixture(); unknown.unknownReplay();
await assert.rejects(() => unknown.adapter.runStage(2, unknown.hooks(2)), /Unknown completed replay/);
assert.equal(unknown.adapter.summary().unknownResponses, 1);
await assert.rejects(() => unknown.adapter.runStage(2, unknown.hooks(2)), /Unresolved continuous response/);
assert.throws(() => createAllianceWorldAdapter({ seed: 'unknown', roster: unknown.roster, mode: 'continuous' }));
console.log(JSON.stringify({ status: 'PASS_SCOPED', populationSeedPairs, continuedDays: 90, freshGrants: 270, revocations: 267,
  finiteDelegateCases: 22, controls: 'public authority, three families, expiry renewal, revocation denial, full roster, exact pending/settled continuation, altered schedule, legacy isolation and unresolved replay',
  matrixQualifying: false, nativeQualification: false }));
