import assert from 'node:assert/strict';
import { evaluateCanonicalReachability, resolveOperationRecovery } from '../tools/rc1-reachability-diagnostics.js';

// Deterministic evaluator fixtures; these are not native world qualification.
const hash = (n) => n.toString(16).padStart(64, '0');
const checkpoint = { stateSha256: hash(1), logicalAt: 10 };
const base = { sourceRevision: 'a'.repeat(40), configurationSha256: hash(9), checkpoint };
const record = (id, kind, values) => ({ id, kind, evidenceKind: 'native-postgres',
  sourceRevision: base.sourceRevision, configurationSha256: base.configurationSha256,
  originStateSha256: checkpoint.stateSha256, artifactPath: `${id}.json`, artifactSha256: hash(100), ...values });
function fixture() {
  return { ...base,
    scopes: [{ id: 'operation-recovery', evidenceId: 'inventory' }],
    obligations: [{ id: 'operation:one', scope: 'operation-recovery', rootNodeId: 'initial', goal: 'operation.completed-or-custody-recovered' }],
    nodes: [{ id: 'initial', ...checkpoint, evidenceId: 'before' }, { id: 'recovered', stateSha256: hash(2), logicalAt: 10, evidenceId: 'after' }],
    transitions: [{ id: 'cancel', from: 'initial', to: 'recovered', evidenceId: 'call' }],
    goals: [{ id: 'returned-custody', obligationId: 'operation:one', nodeId: 'recovered', evidenceId: 'goal' }],
    evidence: [record('inventory', 'enumeration', { ...checkpoint, scope: 'operation-recovery', complete: true, obligationIds: ['operation:one'] }),
      record('before', 'snapshot', checkpoint), record('after', 'snapshot', { stateSha256: hash(2), logicalAt: 10 }),
      record('call', 'transition', { invocation: 4, authority: 'family.command.cancel', outcome: 'RETURNED', transitionKind: 'command',
        beforeStateSha256: hash(1), afterStateSha256: hash(2), beforeLogicalAt: 10, afterLogicalAt: 10 }),
      record('goal', 'goal', { obligationId: 'operation:one', stateSha256: hash(2), logicalAt: 10, passed: true,
        goal: 'operation.completed-or-custody-recovered', canonicalAssertion: 'terminal operation; no held cash/items/materials/promises; recorded depositor recovered exact custody' })] };
}
let input = fixture(), result = evaluateCanonicalReachability(input);
assert(result.complete); assert.equal(result.perScope[0].unreachable, 0);
assert.deepEqual(result.perObligation[0].transitionIds, ['cancel']);
const lifecycle = { complete: true, structuralOrphanOperations: 0, recoveryRequiredOperationIds: ['one'] };
assert.equal(resolveOperationRecovery(lifecycle, result, checkpoint).orphanedOperations, 0);
assert.equal(resolveOperationRecovery({ ...lifecycle, recoveryRequiredOperationIds: ['another'] }, result, checkpoint).orphanedOperations, null);
assert.throws(() => resolveOperationRecovery(lifecycle, result, { ...checkpoint, logicalAt: 11 }), /checkpoint/);

input = fixture(); input.transitions = [];
result = evaluateCanonicalReachability(input);
assert.equal(result.perScope[0].permanentDeadlocks, null); assert.equal(result.perObligation[0].status, 'UNKNOWN');
input = fixture(); input.goals = [];
input.transitions.push({ id: 'loop', from: 'recovered', to: 'initial', evidenceId: 'loop-call' });
input.evidence.push(record('loop-call', 'transition', { ...input.evidence.find((row) => row.id === 'call'), id: 'loop-call',
  beforeStateSha256: hash(2), afterStateSha256: hash(1) }));
assert.equal(evaluateCanonicalReachability(input).perScope[0].unreachable, null, 'A cycle does not prove no canonical exit');
input = fixture(); input.evidence.find((row) => row.id === 'inventory').complete = false;
assert.equal(evaluateCanonicalReachability(input).complete, false, 'Truncated subject enumeration cannot clear the scope');
input = fixture(); input.evidence.find((row) => row.id === 'inventory').obligationIds.push('omitted');
assert.throws(() => evaluateCanonicalReachability(input), /inventory omitted/);
input = fixture(); input.obligations[0].goal = 'operation.successfully-completed';
assert.throws(() => evaluateCanonicalReachability(input), /Recovery cannot substitute/);
for (const [field, value, expected] of [['sourceRevision', 'b'.repeat(40), /source mismatch/],
  ['configurationSha256', hash(44), /configuration mismatch/], ['originStateSha256', hash(45), /another checkpoint/],
  ['evidenceKind', 'fixture-only', /Missing native/]]) {
  input = fixture(); input.evidence.find((row) => row.id === 'call')[field] = value;
  assert.throws(() => evaluateCanonicalReachability(input), expected);
}
input = fixture(); input.evidence.find((row) => row.id === 'call').outcome = 'THREW';
assert.throws(() => evaluateCanonicalReachability(input), /Thrown calls/);
input = fixture(); input.evidence.find((row) => row.id === 'call').beforeStateSha256 = hash(77);
assert.throws(() => evaluateCanonicalReachability(input));
input = fixture(); input.goals[0].nodeId = 'initial';
assert.throws(() => evaluateCanonicalReachability(input));
input = fixture(); input.nodes[1].logicalAt = 20;
input.evidence.find((row) => row.id === 'after').logicalAt = 20;
input.evidence.find((row) => row.id === 'goal').logicalAt = 20;
Object.assign(input.evidence.find((row) => row.id === 'call'), { transitionKind: 'wait', afterLogicalAt: 20,
  deadlineEvidenceId: 'deadline', allDueWorkersExecuted: true, workerCoverageEvidenceId: 'workers' });
input.evidence.push(record('deadline', 'deadline', { ...checkpoint, dueAt: 20 }),
  record('workers', 'worker-coverage', { fromLogicalAt: 10, throughLogicalAt: 20, complete: true }));
assert(evaluateCanonicalReachability(input).complete);
input.evidence.find((row) => row.id === 'workers').complete = false;
assert.throws(() => evaluateCanonicalReachability(input), /true/);
input.evidence.find((row) => row.id === 'workers').complete = true;
input.evidence.find((row) => row.id === 'deadline').dueAt = 21;
assert.throws(() => evaluateCanonicalReachability(input), /recorded canonical deadline/);
input = fixture(); input.obligations = []; input.goals = [];
input.evidence.find((row) => row.id === 'inventory').obligationIds = [];
assert(evaluateCanonicalReachability(input).complete, 'A verified empty scope has no unreachable subjects');
input.scopes = [];
assert.equal(evaluateCanonicalReachability(input).complete, false, 'No declared scopes is not world clearance');
console.log('PASS_SCOPED: positive canonical paths, complete inventories, exact recovery goals, stale evidence, unknown cycles and legal worker-covered waits');
