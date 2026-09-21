import assert from 'node:assert/strict';
import { createAllianceWorldAdapter, ALLIANCE_WORLD_CONTRACT } from '../tools/rc1-alliance-world-adapter.js';
import { assertAllianceContinuation, compareAllianceStates } from '../tools/rc1-alliance-continuation.js';
import { actorValueHash } from '../tools/rc1-native-actor-replay.js';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';

const seed = 'rc1-alpha', roster = Array.from({ length: 25 }, (_, i) => ({ accountId: 'actor-' + i,
  characterId: 'character-' + i, name: 'Actor ' + i, token: 'local-test-session-' + i }));
const make = () => createAllianceWorldAdapter({ seed, roster });
const current = i => ({ id: 'instance-' + i, revision: completed.has(i) ? 1 : 0,
  status: completed.has(i) ? 'completed' : 'active', actions: completed.has(i) ? [] : [{ id: 'issued-' + i }],
  nodes: [{ id: 'conclusion', status: completed.has(i) ? 'completed' : 'available' }] });
const completed = new Set(), executed = [], receipts = new Map(), decisions = [];
let adapter = make();
for (let i = 0; i < 3; i++) {
  const view = { accountId: roster[i].accountId, session: { authed: true, character: { id: roster[i].characterId } },
    me: { character: { id: roster[i].characterId } }, catalog: { graphs: [{ id: 'omerta.coordination.split-ledger', contentHash: 'a'.repeat(64) }] } };
  const decision = adapter.choose(i, 'create', view, { logicalAt: 0 });
  adapter.settle(i, decision, { status: 200, replayed: false, body: { instance: current(i) } });
}
// Declared mock stage-zero state; native acceptance uses sealed real PostgreSQL inputs instead.
const setup = adapter.checkpoint(); setup.payload.state.completedStages = [0];
for (let i = 0; i < 3; i++) { setup.payload.state.families[roster[i].accountId] = 'family-' + i; setup.payload.state.claims[roster[i].accountId] = 'claim-' + i; }
setup.sha256 = actorValueHash(setup.payload); adapter.restore(setup);
const hooks = {
  logicalAt: 86400000,
  async read(account, path, expected) {
    const i = roster.findIndex(a => a.accountId === account);
    if (expected === 404) return { error: 'coordination_unavailable' };
    if (path === '/v1/session') return { authed: true, character: { id: roster[i].characterId } };
    if (path === '/v1/me') return { character: { id: roster[i].characterId, gang: { id: 'family-' + i } } };
    if (path === '/v1/diplomacy') return { relations: [{ active: true }, { active: true }] };
    if (path.startsWith('/v1/coordination/instances/')) return current(i);
    return {};
  },
  async execute(account, request) {
    const i = roster.findIndex(a => a.accountId === account); assert(!completed.has(i), 'Completed action was duplicated');
    assert.deepEqual(request.body, { expectedRevision: 0, actionId: 'issued-' + i });
    completed.add(i); executed.push(structuredClone(request));
    const response = { status: 200, replayed: false, body: { instance: current(i) } };
    receipts.set(request.idempotencyKey, response); return response;
  },
  async decision(identity, view, chosen) { decisions.push({ identity, view, chosen }); },
  async checkpoint() {},
  async retry(account, request) { assert(receipts.has(request.idempotencyKey)); return { ...receipts.get(request.idempotencyKey), replayed: true }; },
};
assert.deepEqual(await adapter.runStage(1, { ...hooks, pauseBeforeDispatch: true }), { paused: true });
assert.equal(executed.length, 0); const paused = adapter.checkpoint(), request = paused.payload.state.pending.decision.request;
assert.equal(paused.payload.state.pending.dispatchState, 'SELECTED');
adapter = make().restore(JSON.parse(JSON.stringify(paused)));
await adapter.runStage(1, hooks);
assert.equal(executed.length, 3); assert.deepEqual(executed[0], request); assert.equal(decisions.length, 3);
assert.deepEqual(adapter.summary().completedStages, [0, 1]); assert.equal(adapter.summary().exactReplays, 3);
assert.equal(adapter.checkpoint().payload.state.pending, null); assert.equal(adapter.checkpoint().payload.state.workflow, null);
await assert.rejects(() => adapter.runStage(1, hooks));

const input = { source: { revision: 'source', checkoutSha256: 'bytes' }, seed, population: 25, hours: 24, observeResources: true, guardLimits: null,
  parentCheckpoint: { stateSha256: 'state' },
  parentContinuation: { version: 1, logicalAt: hooks.logicalAt, source: { revision: 'source', checkoutSha256: 'bytes' }, finalStateSha256: 'state' },
  parentRun: { source: { revision: 'source', checkoutSha256: 'bytes' }, status: 'PASS_SCOPED',
    configuration: { actorPolicy: 'coordinated_alliance', seed, population: 25, hours: 24, epoch: new Date(0).toISOString(), finish: new Date(hooks.logicalAt).toISOString(),
      allianceContract: ALLIANCE_WORLD_CONTRACT, continuation: { mode: 'pending-checkpoint', version: 1 }, guardrails: null },
    result: { resourceObservationEnabled: true, finalStateSha256: 'state' } },
  parentPolicy: { logicalAt: hooks.logicalAt, lastDay: 0, roster: roster.map(a => a.accountId), allianceActors: roster,
    nativeBoundary: { pendingResponses: 0, invocationPending: false, responseSequence: 500 }, allianceAdapter: paused } };
assert.deepEqual(assertAllianceContinuation(input).request, request);
for (const [label, mutate] of [
  ['wrong source', v => { v.source.revision = 'wrong'; }],
  ['wrong bytes', v => { v.source.checkoutSha256 = 'wrong'; }],
  ['wrong seed', v => { v.seed = 'rc1-beta'; }],
  ['wrong observation', v => { v.observeResources = false; }],
  ['wrong guardrails', v => { v.guardLimits = { maximumWallMs: 1 }; }],
  ['unfinished response', v => { v.parentPolicy.nativeBoundary.pendingResponses = 1; }],
  ['unfinished invocation', v => { v.parentPolicy.nativeBoundary.invocationPending = true; }],
  ['failed run', v => { v.parentRun.status = 'FAIL'; }],
  ['unfinished dispatch', v => { const c = v.parentPolicy.allianceAdapter; c.payload.state.pending.dispatchState = 'DISPATCHING'; c.sha256 = actorValueHash(c.payload); }],
]) { const corrupted = structuredClone(input); mutate(corrupted); assert.throws(() => assertAllianceContinuation(corrupted), undefined, label); }
const inFlight = structuredClone(paused); inFlight.payload.state.pending.dispatchState = 'DISPATCHING'; inFlight.sha256 = actorValueHash(inFlight.payload);
await assert.rejects(() => make().restore(inFlight).runStage(1, hooks), /Unfinished dispatch/);

const snapshot = (tables, sequences = []) => ({ tables, sequences, stateSha256: sha256(canonicalJson({ tables, sequences })) });
const a = snapshot({ cash: ['{"n":9007199254740993}', '{"n":9007199254740993}'], empty: [] });
const b = snapshot({ cash: ['{"n":9007199254740993}', '{"n":9007199254740994}'] }, [{ sequencename: 'id', last_value: '2' }]);
const diff = compareAllianceStates(a, b); assert.equal(diff.equal, false); assert.equal(diff.changed.length, 2);
assert.deepEqual(diff.changed[0].added, ['{"n":9007199254740994}']); assert.deepEqual(diff.changed[0].removed, ['{"n":9007199254740993}']);
assert.equal(diff.changed[1].afterPresent, false); assert(diff.sequences); assert.deepEqual(diff.exclusions, []);
assert.equal(compareAllianceStates(a, a).equal, true); assert.throws(() => compareAllianceStates({ ...a, stateSha256: 'wrong' }, b), /checksum/);
console.log('PASS alliance continuation: actual stage cursor, selected request restore, no repeated completed action, wrong source/config/unfinished rejection and lossless full-state differences');
