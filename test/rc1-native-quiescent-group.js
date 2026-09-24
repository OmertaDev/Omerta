import assert from 'node:assert/strict';
import { createNativeCommitObserver } from '../tools/rc1-native-commit-observer.js';
import { createNativeQuiescentGroupObserver } from '../tools/rc1-native-quiescent-group.js';
import { actorValueHash } from '../tools/rc1-native-actor-replay.js';
import { sha256 } from '../tools/rc1-resource-journal.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const request = (index, path = '/v1/market/listing/buy') => ({ accountId: 'a-' + index,
  request: { method: 'POST', path, body: { qty: 1 }, idempotencyKey: 'key-' + index } });
const response = value => ({ status: 200, replayed: false, body: { ok: true, value } });
const companionIdentity = () => ({ kind: 'original-worker-job', label: 'market sweep', logicalAt: 1000,
  sourceFile: 'src/worker.js', sourceSha256: 'a'.repeat(64), handlerSourceFile: 'src/market.js', handlerSourceSha256: 'b'.repeat(64) });
function setup(options = {}) {
  let logicalAt = 1000, state = 0;
  const native = [], serialBoundaries = [], groups = [], records = [];
  const serial = createNativeCommitObserver({ context: () => ({ authority: 'serial', logicalAt }), onBoundary: async event => serialBoundaries.push(event) });
  serial.arm();
  const router = createNativeQuiescentGroupObserver({ serialObserver: serial, clock: () => logicalAt,
    snapshot: options.snapshot || (async () => ({ value: state })),
    onGroup: options.onGroup || (async evidence => { groups.push(evidence); }), record: async row => records.push(row) });
  const client = (handler = async sql => {
    const text = typeof sql === 'string' ? sql : sql.text;
    if (text.startsWith('INSERT') || text.startsWith('UPDATE')) state++;
    return { command: text.split(' ')[0], rowCount: 1 };
  }) => router.wrapQuery({}, async (sql, parameters) => { native.push({ sql, parameters }); return handler(sql, parameters); });
  return { router, serial, native, serialBoundaries, groups, records, client, tick: () => { logicalAt++; }, increment: () => { state++; } };
}
let controls = 0;

// Two actual pending native calls, rather than relabeling a serial request loop.
{
  const env = setup(), barrier = deferred(); let updates = 0;
  const sql = { text: 'UPDATE counter SET value=$1', name: 'same-native-config' }, parameters = [1];
  const queries = [0, 1].map(() => env.client(async (statement, bindings) => {
    const text = typeof statement === 'string' ? statement : statement.text;
    if (text.startsWith('UPDATE')) {
      assert.equal(statement, sql); assert.equal(bindings, parameters);
      if (++updates === 2) barrier.resolve(); await barrier.promise; env.increment();
    }
    return { command: text.split(' ')[0], rowCount: 1 };
  }));
  const result = await env.router.runGroup([request(0), request(1)], { logicalAt: 1000, drain: async () => {}, execute: async accountId => {
    const q = queries[Number(accountId.slice(2))]; await q('BEGIN'); await q(sql, parameters); await q('COMMIT'); return response(accountId);
  } });
  assert.equal(result.length, 2); assert.equal(env.serialBoundaries.length, 0);
  const evidence = env.groups[0]; assert.deepEqual(evidence.before, { value: 0 }); assert.deepEqual(evidence.after, { value: 2 });
  assert.equal(evidence.identity.outcome, 'QUIESCENT_AGGREGATE'); assert.equal(Object.hasOwn(evidence.identity, 'sequence'), false);
  assert.equal(evidence.identity.requestsSha256, actorValueHash([request(0), request(1)]));
  assert.equal(evidence.summary.maximumSqlInFlight, 2); assert.equal(evidence.summary.maximumOpenTransactions, 2);
  assert.equal(evidence.summary.commitAcknowledgments, 2); assert.equal(evidence.summary.concurrentPlayerRequests, true);
  assert.equal(evidence.summary.nativeCommitOrder, false); assert.equal(evidence.summary.isolatedPerCommitResources, false);
  assert.equal(evidence.traceSha256, actorValueHash(evidence.trace));
  const { sha256: rootHash, ...root } = evidence.identity.traceRoot; assert.equal(rootHash, actorValueHash(root));
  assert.equal(root.beforeHash, sha256(evidence.before)); assert.equal(root.afterHash, sha256(evidence.after));
  assert.equal(root.outcomesSha256, actorValueHash(evidence.outcomes)); assert.equal(root.traceSha256, evidence.traceSha256);
  assert.deepEqual([...new Set(evidence.trace.filter(row => row.phase === 'DISPATCH').map(row => row.requestIndex))], [0, 1]);
  await queries[0]('SELECT 1'); assert.equal(env.serialBoundaries.length, 1); assert.equal(env.serialBoundaries[0].outcome, 'AUTOCOMMITTED');
  assert.equal(env.serial.diagnostic().armed, true); env.router.assertComplete(); controls++;
}

// One HTTP request can overlap queued telemetry and receipt writes. Its drain
// must finish before the after snapshot, without claiming multiple players.
{
  const env = setup(), releaseTelemetry = deferred(); let telemetry;
  const telemetryQuery = env.client(async () => { await releaseTelemetry.promise; env.increment(); return { command: 'INSERT', rowCount: 1 }; });
  const storeQuery = env.client();
  await env.router.runGroup([request(0, '/v1/commands')], { logicalAt: 1000,
    execute: async () => { telemetry = telemetryQuery('INSERT INTO telemetry VALUES (1)'); await storeQuery('UPDATE idempotency SET done=true'); return response('done'); },
    drain: async () => { releaseTelemetry.resolve(); await telemetry; await storeQuery('SELECT 1'); } });
  const evidence = env.groups[0]; assert.equal(evidence.summary.requestCount, 1);
  assert.equal(evidence.summary.concurrentPlayerRequests, false); assert.equal(evidence.summary.internalSqlOverlap, true);
  assert.deepEqual(evidence.after, { value: 2 });
  assert(evidence.trace.findIndex(row => row.phase === 'REQUEST_RETURNED') < evidence.trace.findIndex(row => row.phase === 'ACKNOWLEDGED' && row.command === 'INSERT'));
  assert(evidence.trace.some(row => row.phase === 'DISPATCH' && row.authority === 'queued-work-drain' && row.requestIndex === null)); controls++;
}

// Exact duplicate identities are retained, and HTTP denial is not SQL failure.
{
  const env = setup(), q = env.client(), a = request(0), b = request(1);
  const result = await env.router.runGroup([a, b, a], { logicalAt: 1000, drain: async () => {}, execute: async (accountId, command) => {
    if (accountId === 'a-1') return { status: 400, replayed: false, body: { error: 'no_listing' } };
    await q('SELECT 1'); return { status: 409, replayed: false, body: { error: 'in_progress', key: command.idempotencyKey } };
  } });
  assert.equal(result.length, 3); assert.deepEqual(env.groups[0].requests[0], env.groups[0].requests[2]);
  assert.deepEqual(env.groups[0].outcomes.map(row => row.value.status), [409, 400, 409]); controls++;
}

// A throwing request does not abandon another request still committing.
{
  const env = setup(), gate = deferred(), failed = env.client(async sql => {
    if (sql === 'UPDATE fail') { const error = Error('serialization'); error.code = '40001'; gate.resolve(); throw error; }
    return { command: sql, rowCount: 0 };
  }), successful = env.client();
  await assert.rejects(env.router.runGroup([request(0), request(1)], { logicalAt: 1000, drain: async () => {}, execute: async accountId => {
    if (accountId === 'a-0') { await failed('BEGIN'); try { await failed('UPDATE fail'); } finally { await failed('ROLLBACK'); } }
    await gate.promise; await successful('BEGIN'); await successful('UPDATE passed'); await successful('COMMIT'); return response('committed');
  } }), error => error instanceof AggregateError && error.rc1GroupReconciled === true);
  assert.deepEqual(env.groups[0].outcomes.map(row => row.status), ['rejected', 'fulfilled']); assert.equal(env.groups[0].after.value, 1);
  assert.equal(env.groups[0].summary.rollbackAcknowledgments, 1); assert.equal(env.groups[0].summary.commitAcknowledgments, 1);
  assert.equal(env.serial.diagnostic().armed, true); env.router.assertComplete(); controls++;
}

{
  const env = setup({ onGroup: async () => { throw Error('reconciliation failed'); } }), q = env.client();
  await assert.rejects(env.router.runGroup([request(0)], { logicalAt: 1000, drain: async () => {}, execute: async () => { await q('UPDATE native'); return response(1); } }), /reconciliation failed/);
  assert.equal(env.serial.diagnostic().armed, false); const calls = env.native.length;
  await assert.rejects(q('UPDATE must_not_absorb_group'), /quarantined/); assert.equal(env.native.length, calls);
  const diagnostic = env.router.diagnostic().quiescentGroups;
  assert.equal(diagnostic.failure.evidence.after.value, 1); assert(diagnostic.failure.evidence.trace.length > 0);
  assert.throws(() => env.router.arm(), /quarantined/); controls++;
}

{
  const env = setup(), q = env.client();
  await assert.rejects(env.router.runGroup([request(0)], { logicalAt: 1000, drain: async () => {}, execute: async () => { await q('BEGIN'); return response(1); } }), /transaction still open/);
  assert.equal(env.router.diagnostic().quiescentGroups.failure.evidence.openTransactions.length, 1);
  assert.equal(env.serial.diagnostic().armed, false); controls++;
}

{
  const env = setup(), q = env.client(async () => { env.tick(); return { command: 'UPDATE', rowCount: 1 }; });
  await assert.rejects(env.router.runGroup([request(0)], { logicalAt: 1000, drain: async () => {}, execute: async () => { await q('UPDATE time'); return response(1); } }), /clock changed/);
  const trace = env.router.diagnostic().quiescentGroups.failure.evidence.trace;
  assert(trace.some(row => row.phase === 'OBSERVATION_FAILED')); assert(!trace.some(row => row.phase === 'THREW')); controls++;
}

{
  let q; const env = setup({ snapshot: async () => { await q('SELECT diagnostic'); return {}; } }); q = env.client();
  await assert.rejects(env.router.runGroup([request(0)], { logicalAt: 1000, drain: async () => {}, execute: async () => response(1) }), /Unattributed query/);
  assert.equal(env.native.length, 0, 'Instrumented diagnostic must not enter actor trace'); controls++;
}

{
  const env = setup(), q = env.client(); await q('BEGIN');
  await assert.rejects(env.router.runGroup([request(0)], { logicalAt: 1000, drain: async () => {}, execute: async () => response(1) }), /0/);
  await q('ROLLBACK'); assert.equal(env.serial.diagnostic().armed, true); controls++;
}

// The original worker companion has its own authority and full SQL witnesses;
// it is never padded into the HTTP request list or a fabricated commit event.
{
  const env = setup(), barrier = deferred(); let updates = 0, originalReturn;
  const sql = { text: 'UPDATE market_listings SET qty=$1 WHERE id=$2', name: 'original-market-sweep' }, parameters = [0, 'listing-1'];
  const nativeResult = { command: 'UPDATE', rowCount: 1, rows: [{ id: 'listing-1', qty: '0', expires_at: new Date(1000) }], fields: [{ name: 'id', dataTypeID: 25 }] };
  const run = async statement => {
    const text = typeof statement === 'string' ? statement : statement.text;
    if (text.startsWith('UPDATE')) { if (++updates === 2) barrier.resolve(); await barrier.promise; env.increment(); }
    return text.startsWith('UPDATE') ? nativeResult : { command: text, rowCount: null, rows: [], fields: [] };
  };
  const http = env.client(run), worker = env.client(async (statement, bindings) => {
    if (typeof statement === 'object') { assert.equal(statement, sql); assert.equal(bindings, parameters); }
    return run(statement);
  });
  const identity = companionIdentity(), returned = { settled: 0, lapsed: 1 };
  const results = await env.router.runGroup([request(0)], { logicalAt: 1000, drain: async () => {},
    execute: async () => { await http('UPDATE actor'); return response('http'); },
    companion: { identity, execute: async () => {
      await worker('BEGIN'); assert.equal(await worker(sql, parameters), nativeResult); await worker('COMMIT'); return originalReturn = returned;
    } } });
  assert.equal(originalReturn, returned); assert.equal(results.length, 1);
  const evidence = env.groups[0], root = evidence.identity.traceRoot;
  assert.equal(evidence.identity.requestCount, 1); assert.equal(evidence.identity.companionCount, 1);
  assert.equal(evidence.summary.concurrentPlayerRequests, false); assert.equal(evidence.summary.workerRequestOverlap, true);
  assert.equal(evidence.summary.maximumSqlInFlight, 2); assert.equal(evidence.summary.nativeCommitOrder, false);
  assert.equal(root.format, 2); assert.deepEqual(evidence.companionOutcomes, [{ status: 'fulfilled', value: returned }]);
  assert.deepEqual(evidence.companions, [{ ...identity, companionIndex: 0 }]);
  assert.deepEqual(evidence.identity.context.companions, evidence.companions);
  assert.equal(root.companionsSha256, actorValueHash(evidence.companions));
  assert.equal(root.companionOutcomesSha256, actorValueHash(evidence.companionOutcomes));
  const { sha256: rootHash, ...descriptor } = root; assert.equal(rootHash, actorValueHash(descriptor));
  const dispatch = evidence.trace.find(row => row.phase === 'DISPATCH' && row.original?.sql?.name === sql.name);
  assert.equal(dispatch.authority, 'original-worker-job'); assert.equal(dispatch.requestIndex, null); assert.equal(dispatch.companionIndex, 0);
  assert.deepEqual(dispatch.original, { sql, parametersProvided: true, parameters });
  const acknowledged = evidence.trace.find(row => row.phase === 'ACKNOWLEDGED' && row.queryId === dispatch.queryId);
  assert.deepEqual(acknowledged.nativeResult, nativeResult); assert.equal(acknowledged.nativeResultSha256, actorValueHash(nativeResult));
  assert.equal(evidence.traceSha256, actorValueHash(JSON.parse(JSON.stringify(evidence.trace))));
  assert(!Object.hasOwn(evidence.identity, 'sequence')); assert.equal(env.serialBoundaries.length, 0); env.router.assertComplete(); controls++;
}

{
  const env = setup(), gate = deferred(), http = env.client(), worker = env.client();
  await assert.rejects(env.router.runGroup([request(0)], { logicalAt: 1000, drain: async () => {},
    execute: async () => { await gate.promise; await http('UPDATE actor'); return response('committed'); },
    companion: { identity: companionIdentity(), execute: async () => {
      await worker('BEGIN'); await worker('ROLLBACK'); gate.resolve(); throw Error('original market failure');
    } } }), error => error instanceof AggregateError && error.rc1GroupReconciled === true);
  assert.equal(env.groups[0].after.value, 1); assert.equal(env.groups[0].outcomes[0].status, 'fulfilled');
  assert.equal(env.groups[0].companionOutcomes[0].error.message, 'original market failure');
  assert.equal(env.groups[0].summary.rollbackAcknowledgments, 1); assert.equal(env.serial.diagnostic().armed, true); controls++;
}

{
  const env = setup();
  await assert.rejects(env.router.runGroup([request(0)], { logicalAt: 1000, drain: async () => {}, execute: async () => response(1),
    companion: { identity: { ...companionIdentity(), logicalAt: 2000 }, execute: async () => {} } }));
  assert.equal(env.native.length, 0); assert.equal(env.serial.diagnostic().armed, true); controls++;
}

console.log(JSON.stringify({ status: 'PASS_SCOPED', controls, scope: 'Observer router, native-call overlap, original SQL forwarding, explicit original-worker companions, drain, aggregate evidence, serial continuity and quarantine controls',
  gameNativeProof: 'Retained market-policy-d283982b-native; these controlled drivers do not replace canonical-handler native qualification' }));
