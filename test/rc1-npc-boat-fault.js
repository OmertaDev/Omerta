import assert from 'node:assert/strict';
import { createNpcBoatFault, NPC_BOAT_FAULT_MESSAGE, NPC_BOAT_FAULT_SQL } from '../tools/rc1-npc-boat-fault.js';
import { NPC_BOAT_INSERT } from '../tools/rc1-npc-boat-journal.js';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { createNativeCommitObserver } from '../tools/rc1-native-commit-observer.js';
const stateHash = value => sha256(canonicalJson(value));
const at = 3600000, state = { characters: [], boats: [] };
const attempt = { sequence: 2, clientId: 1, transactionId: 1, context: { authority: 'original-worker', logicalAt: at },
  sqlSha256: sha256(NPC_BOAT_INSERT), outcome: 'THREW', code: 'RNB01' };
const rollback = { ...attempt, sequence: 3, sqlSha256: sha256('ROLLBACK'), command: 'ROLLBACK', outcome: 'ROLLED_BACK' }; delete rollback.code;
const provenance = event => ({ boundary: event, unsupported: 'native-query-failure', queries: [] });
const logs = ['[population] spawn failed', NPC_BOAT_FAULT_MESSAGE];
const controls = [];
function setup(enabled = true) {
  const artifacts = [], records = [], queries = [];
  const proof = { artifact: async (name, value) => artifacts.push({ name, value: structuredClone(value) }), record: async value => records.push(structuredClone(value)) };
  const pool = { query: async sql => { queries.push(sql); return { rows: [{ last_value: '3', is_called: true }] }; } };
  return { fault: createNpcBoatFault({ enabled, proof, stateHash }), pool, artifacts, records, queries };
}
async function primed() { const value = setup(); await value.fault.installBeforeBaseline(value.pool); await value.fault.onAttempt(attempt); return value; }
async function ready() { const value = await primed(); await value.fault.boundary(rollback, state, state, provenance(rollback)); assert(value.fault.acceptConsole('error', logs, at)); return value; }
const disabled = setup(false); await disabled.fault.installBeforeBaseline(disabled.pool); await disabled.fault.onAttempt(attempt);
await disabled.fault.boundary(rollback, state, { corrupted: true }, null); await disabled.fault.classified({}, {});
assert.equal(disabled.fault.acceptConsole('error', logs, at), false); assert.equal(await disabled.fault.finish(disabled.pool), null);
assert.deepEqual(disabled.queries, []); assert.deepEqual(disabled.artifacts, []); controls.push('disabled-no-query-no-retention-no-error-exemption');
for (const [name, mutate] of [
  ['wrong-sql', e => e.sqlSha256 = sha256('SELECT 1')], ['wrong-authority', e => e.context.authority = 'actor'],
  ['missing-transaction', e => e.transactionId = null], ['off-deadline', e => e.context.logicalAt++]]) {
  const value = setup(); await value.fault.installBeforeBaseline(value.pool); const e = structuredClone(attempt); mutate(e);
  await assert.rejects(value.fault.onAttempt(e)); controls.push(name);
}
{ const value = await primed(); await assert.rejects(value.fault.onAttempt(attempt), /Repeated/); controls.push('duplicate-error'); }
{ const value = await primed(); await assert.rejects(value.fault.boundary(rollback, state, { corrupt: true }, provenance(rollback)), /projection/); controls.push('rollback-resource-change'); }
{ const value = await primed(); await assert.rejects(value.fault.boundary(rollback, state, state, provenance({ ...rollback, sequence: 8 })), /deep-equal/); controls.push('stale-rollback-witness'); }
{ const value = await primed(); await assert.rejects(value.fault.boundary({ ...rollback, outcome: 'COMMITTED' }, state, state, provenance(rollback))); controls.push('commit-is-not-rollback'); }
{ const value = setup(); assert.equal(value.fault.acceptConsole('error', logs, at), false); await value.fault.installBeforeBaseline(value.pool); await value.fault.onAttempt(attempt);
  assert.equal(value.fault.acceptConsole('error', logs, at), false); controls.push('copied-console-cannot-hide-error'); }
{ const value = await ready(); assert.equal(value.fault.acceptConsole('error', logs, at), false);
  assert.equal(value.fault.acceptConsole('error', [logs[0], 'Unrelated failure'], at), false); controls.push('duplicate-and-unrelated-console-not-accepted'); }
{ const value = await primed(); await value.fault.boundary(rollback, state, state, provenance(rollback));
  assert.equal(value.fault.acceptConsole('error', logs, at + 1), false); assert.equal(value.fault.acceptConsole('warn', logs, at), false); controls.push('console-time-and-level-binding'); }
const grant = (id, logicalAt) => [{ ...rollback, transactionId: id + 3, sequence: id + 10, outcome: 'COMMITTED', command: 'COMMIT', context: { authority: 'original-worker', logicalAt } },
  { boats: { movements: [{ kind: 'exact-npc-spawn-boat-source', boatId: 'boat-' + id }] }, npcBoatWitness: { artifact: 'candidate-' + id + '.json', sha256: 'c'.repeat(64) } }];
{ const value = await ready(); await value.fault.classified(...grant(1, at)); await value.fault.classified(...grant(2, at));
  await assert.rejects(value.fault.finish(value.pool), /strictly later/); controls.push('same-deadline-grants-do-not-satisfy-retry'); }
{ const value = await ready(); await value.fault.classified(...grant(1, at * 2)); await assert.rejects(value.fault.classified(...grant(1, at * 3)), /Duplicate/); controls.push('duplicate-asset'); }
{ const value = await ready(); const g = grant(1, at * 2); delete g[1].npcBoatWitness; await assert.rejects(value.fault.classified(...g), /retention/); controls.push('missing-candidate'); }
const successful = await ready(); await successful.fault.classified(...grant(1, at * 2)); await successful.fault.classified(...grant(2, at * 3));
assert.equal((await successful.fault.finish(successful.pool)).strictlyLaterGrants, 2);
assert.deepEqual(successful.queries.slice(0, 3), NPC_BOAT_FAULT_SQL);
assert.deepEqual(successful.artifacts.find(a => a.name.includes('rollback')).value.before, state); controls.push('positive-exact-schedule-and-full-resource-retention');
// Native observer control: real callback order, one native-query error, rollback,
// and no callback-failure waiver. The PostgreSQL workload separately proves SQL.
const integrated = setup(); await integrated.fault.installBeforeBaseline(integrated.pool);
const observer = createNativeCommitObserver({ context: () => ({ authority: 'original-worker', logicalAt: at }),
  onAttempt: e => integrated.fault.onAttempt(e), onBoundary: e => integrated.fault.boundary(e, state, state, provenance(e)) });
const query = observer.wrapQuery({}, async sql => { if (sql === NPC_BOAT_INSERT) throw Object.assign(Error(NPC_BOAT_FAULT_MESSAGE), { code: 'RNB01' });
  return { command: sql, rowCount: null, rows: [] }; });
observer.arm(); await query('BEGIN'); await assert.rejects(query(NPC_BOAT_INSERT), { code: 'RNB01' }); await query('ROLLBACK');
assert(integrated.fault.acceptConsole('error', logs, at)); observer.assertComplete(); observer.disarm(); controls.push('actual-observer-attempt-rollback-order');
console.log(JSON.stringify({ status: 'PASS', controls, productionClaim: false }));
