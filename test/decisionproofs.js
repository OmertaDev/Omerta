import assert from 'node:assert/strict';
import { validateDecisionCall, recordDecisionExecution } from '../src/decisionproofs.js';

const args = { callId: 'call-1', accountId: 'owner', characterId: 'actor', generation: 1, turnId: `turn_${'a'.repeat(64)}`, actionId: 'train:strength' };
const row = () => ({ id: args.callId, account_id: args.accountId, status: 'succeeded', purpose: { kind: 'game_decision', turnId: args.turnId }, output: JSON.stringify({ actionId: args.actionId }), simulated: false, decision_execution_receipt: null });
function fixture(overrides = {}) {
  const stored = { ...row(), ...overrides }, queries = [];
  const client = { async query(sql, values) {
    queries.push({ sql, values });
    if (sql.startsWith('SELECT')) return { rows: [stored] };
    if (stored.decision_execution_receipt !== null) return { rows: [] };
    stored.decision_execution_receipt = values[2];
    return { rows: [{ id: stored.id }] };
  } };
  return { stored, queries, client };
}
const rejects = (promise, code = 'decision_call') => assert.rejects(promise, error => error.code === code && !error.message.includes('SECRET'));
for (const changes of [{ callId: '' }, { accountId: '../owner' }, { generation: 0 }, { generation: 1.5 }, { turnId: 'turn_bad' }, { actionId: 'bad\n' }, { actionId: 'a'.repeat(513) }]) {
  const f = fixture(); await rejects(validateDecisionCall(f.client, { ...args, ...changes })); assert.equal(f.queries.length, 0);
}
for (const changes of [{ id: 'foreign' }, { account_id: 'foreign' }, { status: 'reserved' }, { simulated: null }, { purpose: { kind: 'paid_market_analysis', turnId: args.turnId } }, { purpose: { kind: 'game_decision', turnId: 'other' } }, { output: 'SECRET' }, { output: '[]' }, { output: '{}' }, { output: JSON.stringify({ actionId: args.actionId, secret: 'SECRET' }) }, { output: JSON.stringify({ actionId: 'other' }) }, { output: ' '.repeat(8193) }]) {
  const f = fixture(changes); await rejects(validateDecisionCall(f.client, args)); assert.equal(f.queries.length, 1);
}
const missing = { query: async () => ({ rows: [] }) }; await rejects(validateDecisionCall(missing, args));
const existing = fixture({ decision_execution_receipt: {} }); await rejects(validateDecisionCall(existing.client, args), 'decision_reused'); assert.equal(existing.queries.length, 1);
const f = fixture(), validated = await validateDecisionCall(f.client, args);
assert.ok(Object.isFrozen(validated)); assert.match(f.queries[0].sql, /WHERE id=\$1 AND account_id=\$2 FOR UPDATE/); assert.deepEqual(f.queries[0].values, [args.callId, args.accountId]);
await rejects(recordDecisionExecution({}, validated, { actionKind: 'train', result: {} }));
await rejects(recordDecisionExecution(f.client, { ...validated }, { actionKind: 'train', result: {} }));
const proof = await recordDecisionExecution(f.client, validated, { actionKind: 'train', result: { SECRET: 'private', trained: true } });
assert.deepEqual(Object.keys(proof).sort(), ['id', 'callId', 'turnId', 'actionId', 'executionRecorded', 'simulated', 'reasoningVerified', 'monetaryProof', 'causalEffect'].sort());
assert.equal(proof.reasoningVerified, false); assert.equal(proof.monetaryProof, false); assert.equal(proof.causalEffect, null); assert.equal(proof.executionRecorded, true);
assert.ok(!JSON.stringify(proof).includes('SECRET')); assert.ok(!JSON.stringify(f.stored.decision_execution_receipt).includes('SECRET'));
assert.deepEqual(Object.keys(f.stored.decision_execution_receipt).sort(), ['id', 'characterId', 'generation', 'turnId', 'actionId', 'actionKind', 'resultDigest', 'recordedAt'].sort());
assert.match(f.stored.decision_execution_receipt.resultDigest, /^[a-f0-9]{64}$/); assert.match(f.queries[1].sql, /decision_execution_receipt IS NULL/);
await rejects(recordDecisionExecution(f.client, validated, { actionKind: 'train', result: {} }), 'decision_reused'); assert.equal(f.queries.length, 2);
async function digest(result) { const x = fixture(); const v = await validateDecisionCall(x.client, args); await recordDecisionExecution(x.client, v, { actionKind: 'train', result }); return x.stored.decision_execution_receipt.resultDigest; }
assert.equal(await digest({ b: [1, { z: 2, a: 3 }], a: new Date(0) }), await digest({ a: new Date(0).toISOString(), b: [1, { a: 3, z: 2 }] }));
assert.notEqual(await digest({ a: [1, 2] }), await digest({ a: [2, 1] }));
const cycle = {}; cycle.self = cycle;
let deep = {}; for (let i = 0; i < 66; i++) deep = { child: deep };
for (const result of [null, [], 'SECRET', cycle, deep, { huge: 'SECRET'.repeat(180000) }, { value: 1n }]) {
  const x = fixture(), v = await validateDecisionCall(x.client, args); await rejects(recordDecisionExecution(x.client, v, { actionKind: 'train', result })); assert.equal(x.queries.length, 1);
}
// Fake rollback contract: caller must roll back native mutation when persistence fails.
for (const failure of ['database', 'guard']) {
  const x = fixture(); let nativeCount = 0; const original = x.client.query; const databaseError = new Error('injected persistence failure');
  x.client.query = async (sql, values) => { if (sql.startsWith('UPDATE')) { if (failure === 'database') throw databaseError; return { rows: [] }; } return original(sql, values); };
  const snapshot = nativeCount;
  try { const v = await validateDecisionCall(x.client, args); nativeCount++; await recordDecisionExecution(x.client, v, { actionKind: 'train', result: { count: nativeCount } }); assert.fail('expected persistence failure'); }
  catch (error) { nativeCount = snapshot; if (failure === 'database') assert.equal(error, databaseError); else assert.equal(error.code, 'decision_reused'); }
  assert.equal(nativeCount, 0); assert.equal(x.stored.decision_execution_receipt, null); assert.ok(x.queries.every(q => !/BEGIN|COMMIT|ROLLBACK/.test(q.sql)));
}
// Bounded deterministic conservation of canonical object ordering (seed 7331, 100 cases).
let seed = 7331; const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
for (let i = 0; i < 100; i++) { const a = random(), b = random(); assert.equal(await digest({ a, nested: { b, a } }), await digest({ nested: { a, b }, a })); assert.notEqual(await digest({ a }), await digest({ a: a + 1 })); }
console.log('decisionproofs: PASS; adversarial validation/privacy/write-once/rollback-contract; seed 7331, 100 canonicalization cases (native transaction proof belongs to integration suite)');
// Same validation cannot race two writes, even while the first query is pending.
const racing = fixture(), raceValidated = await validateDecisionCall(racing.client, args);
let releaseWrite; const originalRaceQuery = racing.client.query;
racing.client.query = async (sql, values) => { if (sql.startsWith('UPDATE')) await new Promise(resolve => { releaseWrite = resolve; }); return originalRaceQuery(sql, values); };
const firstWrite = recordDecisionExecution(racing.client, raceValidated, { actionKind: 'train', result: {} });
await rejects(recordDecisionExecution(racing.client, raceValidated, { actionKind: 'train', result: {} }), 'decision_reused');
releaseWrite(); await firstWrite; assert.equal(racing.queries.length, 2);
const badKind = fixture(), badKindValidated = await validateDecisionCall(badKind.client, args);
await rejects(recordDecisionExecution(badKind.client, badKindValidated, { actionKind: 'SECRET\n', result: {} })); assert.equal(badKind.queries.length, 1);
