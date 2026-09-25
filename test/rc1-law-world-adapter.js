import assert from 'node:assert/strict';
import { createLawWorldAdapter, LAW_WORLD_CONTRACT } from '../tools/rc1-law-world-adapter.js';
import { actorValueHash } from '../tools/rc1-native-actor-replay.js';

const epoch = 1000000, windowMs = LAW_WORLD_CONTRACT.windowMilliseconds;
const roster = (n) => Array.from({ length: n }, (_, index) => ({ accountId: `law-${index}`, characterId: `street-${index}` }));
const config = { seed: 'rc1-alpha', epoch, roster: roster(25), activeAccountIds: ['law-0'] };
const view = (accountId = 'law-0', changes = {}) => ({ accountId,
  session: { authed: true, character: { id: `street-${accountId.split('-')[1]}` } },
  me: { character: { id: `street-${accountId.split('-')[1]}`, level: 1, nerve: 10, heat: 0, jailSeconds: 0, ...changes } },
  law: { indicted: false, exposure: 0, stage: 'clean', graceSeconds: 0, plea: null },
  rules: { crimes: [{ id: 'pick', lvl: 1, nerve: 2 }, { id: 'locked', lvl: 2, nerve: 1 }],
    crimeApproaches: [{ id: 'loud', heat: 6 }, { id: 'quiet', heat: 0 }], pacing: { nerveRegenPerMin: 6 } } });
const crime = (approach = 'loud', success = true) => ({ status: 200, replayed: false,
  body: { ok: true, success, approach, take: success ? 80 : 0, rep: success ? 2 : 0 } });
const make = () => createLawWorldAdapter(config);
let adapter = make(); adapter.beginWindow(epoch);
const initial = adapter.choose(view());
assert.equal(initial.request.path, '/v1/crimes/pick'); assert.equal(initial.request.body.approach, 'loud');
const pending = adapter.checkpoint(); adapter = make().restore(pending);
assert.deepEqual(adapter.choose(view('law-0', { heat: 100 })), initial, 'Pending choice survives changed public context');
adapter.settle(crime()); adapter.settleExactReplay('law-0', initial, { ...crime(), replayed: true });
assert.equal(adapter.summary().perActor[0].policy.fresh, 1); assert.equal(adapter.summary().exactReplays, 1);
assert.throws(() => adapter.settleExactReplay('law-0', { ...initial, request: { ...initial.request, path: '/other' } }, { ...crime(), replayed: true }), /changed/);
const indicted = view(); Object.assign(indicted.law, { indicted: true, stage: 'indicted', exposure: 3001,
  graceSeconds: 21600, plea: { jailSeconds: 240, forfeitRate: .15 } });
assert.equal(adapter.choose(indicted).type, 'law.pressure-crime'); adapter.settle(crime());
assert.equal(adapter.summary().perActor[0].phase, 'plea');
assert.equal(adapter.choose(indicted).type, 'law.plea');
adapter.settle({ status: 200, replayed: false, body: { ok: true, jailSeconds: 240, forfeited: 75 } });
assert.equal(adapter.summary().perActor[0].phase, 'recover');
assert.equal(adapter.choose(view('law-0', { jailSeconds: 240 })).reason, 'original-detention');
assert.equal(adapter.summary().completedWindows, 1);
assert.equal(adapter.summary().observedLogicalDays, 0, 'Scheduling the next window does not advance the clock');
assert.throws(() => adapter.beginWindow(epoch + windowMs * 2), /every original/);
adapter.beginWindow(epoch + windowMs);
assert.equal(adapter.choose(view()).request.body.approach, 'quiet'); adapter.settle(crime('quiet', false));
assert.equal(adapter.summary().completedCycles, 0, 'An unsuccessful quiet attempt is not recovery');
assert.equal(adapter.choose(view()).request.body.approach, 'quiet'); adapter.settle(crime('quiet'));
assert.equal(adapter.summary().completedCycles, 1); assert.equal(adapter.summary().perActor[0].phase, 'pressure');
assert.equal(adapter.choose(view()).request.body.approach, 'loud', 'Pressure resumes after recovery without grants');

const unknown = make().restore(pending);
assert(unknown.settle({ ...crime(), replayed: true }).blocked);
assert.equal(unknown.summary().perActor[0].policy.fresh, 0);
assert.throws(() => make().restore(unknown.checkpoint()).beginWindow(epoch), /Unresolved/);
assert.throws(() => make().restore({ ...pending, sha256: '0'.repeat(64) }), /checksum/);
const corrupt = structuredClone(pending); corrupt.payload.state.pending.decision.request.path = '/other'; corrupt.sha256 = actorValueHash(corrupt.payload);
assert.throws(() => make().restore(corrupt), /mismatch/);
assert.throws(() => createLawWorldAdapter({ ...config, pool: {} }), /configuration/);
assert.throws(() => createLawWorldAdapter({ ...config, activeAccountIds: ['outsider'] }), /Unknown/);
assert.throws(() => createLawWorldAdapter({ ...config, roster: roster(26) }));

// All frozen population sizes, bounded call budgets and no silent cohort omissions.
for (const n of LAW_WORLD_CONTRACT.populations) {
  const policy = createLawWorldAdapter({ seed: 'rc1-alpha', epoch, roster: roster(n) });
  let observed = 0, reads = 0, records = 0, result;
  const hooks = { read: async (accountId, path) => {
    reads++; const own = view(accountId, { jailSeconds: 600 });
    return own[({ '/v1/session': 'session', '/v1/me': 'me', '/v1/law': 'law', '/v1/rules': 'rules' })[path]];
  }, execute: async () => assert.fail('Detention cannot dispatch crime'), record: async (event) => {
    records++; if (event.kind === 'law-decision') observed++;
    assert(!('policies' in event) && !('byActor' in event), 'Step evidence must not contain a roster checkpoint');
  } };
  do { result = await policy.runWindow(epoch, hooks, { maximumDecisions: 17 }); } while (!result.complete);
  assert.equal(observed, n); assert.equal(reads, n * 4); assert.equal(policy.summary().activeCohort.length, n);
  assert(policy.summary().perActor.every((actor) => actor.windows === 1));
  const resumed = createLawWorldAdapter({ seed: 'rc1-alpha', epoch, roster: roster(n) }).restore(policy.checkpoint());
  reads = 0;
  do { result = await resumed.runWindow(epoch + windowMs, hooks, { maximumDecisions: 17 }); } while (!result.complete);
  assert.equal(reads, 0, 'Recorded original detention wait is retained across restart');
  assert.equal(records, n * 2); assert(resumed.summary().perActor.every((actor) => actor.windows === 2));
}

// An actual missing response preserves the same dispatch identity across restore.
let eventLog = [], executions = [];
const hooks = { read: async (accountId, path) => {
  const own = view(accountId); return own[({ '/v1/session': 'session', '/v1/me': 'me', '/v1/law': 'law', '/v1/rules': 'rules' })[path]];
}, record: async (event) => { eventLog.push(event); }, execute: async (accountId, request) => {
  executions.push({ accountId, request }); throw Error('response-lost');
} };
adapter = make();
await assert.rejects(adapter.runWindow(epoch, hooks, { maximumDecisions: 1 }), /response-lost/);
assert.equal(eventLog.at(-1).kind, 'law-pending');
assert.equal(adapter.cursor().pending.dispatchState, 'DISPATCHING');
const expected = executions[0]; adapter = make().restore(adapter.checkpoint());
const resumed = await adapter.runWindow(epoch, { ...hooks,
  read: async () => assert.fail('Pending request cannot be replaced using a fresh view'),
  execute: async (accountId, request) => { assert.deepEqual({ accountId, request }, expected); return { ...crime(), replayed: true }; }
}, { maximumDecisions: 1 });
assert(resumed.blocked);
adapter = make(); executions = [];
const paused = await adapter.runWindow(epoch, hooks, { maximumDecisions: 1, pauseBeforeDispatch: true });
assert(paused.paused); assert.equal(executions.length, 0);
adapter = make().restore(adapter.checkpoint());
await adapter.runWindow(epoch, { ...hooks, execute: async () => crime() }, { maximumDecisions: 1 });
assert.equal(adapter.summary().perActor[0].policy.fresh, 1);
// A public pressure burst bound is not mislabeled as a legal wait or coverage.
adapter = make();
const bounded = await adapter.runWindow(epoch, { ...hooks, execute: async () => crime() }, { maximumDecisions: 64 });
assert(bounded.complete); assert.equal(adapter.summary().perActor[0].boundedBursts, 1);
assert.equal(adapter.summary().perActor[0].policy.fresh, LAW_WORLD_CONTRACT.maximumDecisionsPerActorPerWindow);
assert.equal(adapter.summary().perActor[0].policy.waits, 0);
// Duration arithmetic and explicit cohort scheduling only; no simulated Law
// outcomes or original-worker execution are claimed by this deterministic test.
adapter = make(); let waits = 0;
const durationHooks = { read: async (accountId, path) => {
  const own = view(accountId, { jailSeconds: 91 * 86400 });
  return own[({ '/v1/session': 'session', '/v1/me': 'me', '/v1/law': 'law', '/v1/rules': 'rules' })[path]];
}, execute: async () => assert.fail('Public detention is still active'), record: async () => { waits++; } };
for (let index = 0; index <= 90 * 288; index++) assert((await adapter.runWindow(epoch + index * windowMs, durationHooks)).complete);
assert.equal(adapter.summary().observedLogicalDays, 90);
assert.equal(adapter.summary().completedWindows, 90 * 288 + 1); assert.equal(waits, 90 * 288 + 1);
assert.deepEqual(adapter.summary().activeCohort, ['law-0']);
console.log('PASS_SCOPED: all five Law populations, bounded five-minute scheduling, repeated public pressure/plea/recovery, exact pending restart, unknown replay and compact step records');
