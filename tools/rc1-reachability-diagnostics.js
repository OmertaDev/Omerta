// Observer-only evaluation of executed canonical paths. Never an actor-policy input.
// A finite failed search cannot prove that a game state is permanently unreachable.
import assert from 'node:assert/strict';

const text = (value) => typeof value === 'string' && value.length > 0;
const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const unique = (rows, key, label) => {
  assert(Array.isArray(rows), `${label} must be an array`);
  const map = new Map(rows.map((row) => [row[key], row]));
  assert.equal(map.size, rows.length, `Duplicate ${label}`);
  assert([...map.keys()].every(text), `Invalid ${label} identity`);
  return map;
};

/**
 * The runner supplies an independently verified native evidence index, not guessed
 * actions or synthetic graph edges. Each edge names the retained invocation and
 * full before/after canonical snapshots of an executed command, worker or legal
 * wait. Nodes include logical time: waiting is not a free edge between equal data.
 * Goal records are retained canonical assertions, specific to an obligation:
 * completion/recovery, meaningful actor progress, resource replenishment, or an
 * authorized Knowledge acquisition/propagation requirement. Seeing AVAILABLE,
 * an active grant, a deadline, or a returned call alone is never a goal assertion.
 *
 * Source/configuration/checkpoint and scope enumeration must be verified by the
 * caller against the run's artifact/history index before passing this input.
 * This evaluator checks the joins and finite positive paths; it is not another
 * native recorder, permission oracle, or proof of exhaustive search.
 */
export function evaluateCanonicalReachability({ sourceRevision, configurationSha256, checkpoint,
  obligations, scopes, nodes, transitions, goals, evidence }) {
  assert(/^[a-f0-9]{40}$/.test(sourceRevision), 'Pin the reviewed source revision');
  assert(digest(configurationSha256), 'Pin the frozen run configuration');
  assert(digest(checkpoint?.stateSha256) && Number.isSafeInteger(checkpoint.logicalAt));
  const required = unique(obligations, 'id', 'obligations');
  const scopeMap = unique(scopes, 'id', 'scopes');
  const states = unique(nodes, 'id', 'nodes');
  const records = unique(evidence, 'id', 'evidence');
  const edges = unique(transitions, 'id', 'transitions');
  unique(goals, 'id', 'goals');
  function record(id, kind) {
    const row = records.get(id);
    assert(row && row.kind === kind && row.evidenceKind === 'native-postgres', `Missing native ${kind} evidence: ${id}`);
    assert.equal(row.sourceRevision, sourceRevision, 'Evidence source mismatch');
    assert.equal(row.configurationSha256, configurationSha256, 'Evidence configuration mismatch');
    assert.equal(row.originStateSha256, checkpoint.stateSha256, 'Evidence restored from another checkpoint');
    assert(text(row.artifactPath) && digest(row.artifactSha256), 'Retain indexed evidence bytes');
    return row;
  }
  for (const node of states.values()) {
    assert(digest(node.stateSha256) && Number.isSafeInteger(node.logicalAt));
    assert(node.logicalAt >= checkpoint.logicalAt, 'A path cannot travel before its checkpoint');
    const snapshot = record(node.evidenceId, 'snapshot');
    assert.equal(snapshot.stateSha256, node.stateSha256);
    assert.equal(snapshot.logicalAt, node.logicalAt);
  }
  const outgoing = new Map([...states.keys()].map((id) => [id, []]));
  for (const edge of edges.values()) {
    const from = states.get(edge.from), to = states.get(edge.to);
    assert(from && to && to.logicalAt >= from.logicalAt, 'Invalid transition endpoints');
    const invocation = record(edge.evidenceId, 'transition');
    assert(text(invocation.authority) && Number.isSafeInteger(invocation.invocation) && invocation.invocation > 0);
    assert.equal(invocation.outcome, 'RETURNED', 'Thrown calls cannot establish a legal transition');
    assert.equal(invocation.beforeStateSha256, from.stateSha256);
    assert.equal(invocation.afterStateSha256, to.stateSha256);
    assert.equal(invocation.beforeLogicalAt, from.logicalAt);
    assert.equal(invocation.afterLogicalAt, to.logicalAt);
    assert(['command', 'worker', 'wait'].includes(invocation.transitionKind));
    if (invocation.transitionKind === 'wait') {
      assert(to.logicalAt > from.logicalAt, 'A legal wait must advance time');
      assert(text(invocation.deadlineEvidenceId), 'Wait needs its canonical eligibility/deadline evidence');
      const deadline = record(invocation.deadlineEvidenceId, 'deadline');
      assert.equal(deadline.stateSha256, from.stateSha256);
      assert.equal(deadline.logicalAt, from.logicalAt);
      assert.equal(deadline.dueAt, to.logicalAt, 'Wait must reach the recorded canonical deadline');
      // Advancing the clock alone does not execute the workers due during it.
      assert.equal(invocation.allDueWorkersExecuted, true, 'Wait must include every due canonical worker');
      assert(text(invocation.workerCoverageEvidenceId));
      const coverage = record(invocation.workerCoverageEvidenceId, 'worker-coverage');
      assert.equal(coverage.fromLogicalAt, from.logicalAt);
      assert.equal(coverage.throughLogicalAt, to.logicalAt);
      assert.equal(coverage.complete, true);
    }
    outgoing.get(edge.from).push(edge);
  }
  const targetNodes = new Map();
  for (const goal of goals) {
    assert(required.has(goal.obligationId) && states.has(goal.nodeId), 'Unknown goal subject');
    const assertion = record(goal.evidenceId, 'goal');
    assert.equal(assertion.obligationId, goal.obligationId);
    assert.equal(assertion.stateSha256, states.get(goal.nodeId).stateSha256);
    assert.equal(assertion.logicalAt, states.get(goal.nodeId).logicalAt);
    assert.equal(assertion.passed, true, 'Failed goal assertion');
    assert(text(assertion.canonicalAssertion), 'Name the canonical goal assertion and retained result');
    assert.equal(assertion.goal, required.get(goal.obligationId).goal, 'Recovery cannot substitute for completion or acquisition');
    const targets = targetNodes.get(goal.obligationId) || new Map();
    targets.set(goal.nodeId, goal.evidenceId); targetNodes.set(goal.obligationId, targets);
  }
  const perObligation = [];
  for (const obligation of required.values()) {
    assert(scopeMap.has(obligation.scope) && text(obligation.goal), 'Obligation needs an enumerated scope and exact goal');
    const root = states.get(obligation.rootNodeId);
    assert(root && root.stateSha256 === checkpoint.stateSha256 && root.logicalAt === checkpoint.logicalAt,
      'Every obligation starts at the measured checkpoint');
    const queue = [root.id], visited = new Map([[root.id, null]]);
    let reached = null;
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      if (targetNodes.get(obligation.id)?.has(id)) { reached = id; break; }
      for (const edge of outgoing.get(id)) if (!visited.has(edge.to)) {
        visited.set(edge.to, edge); queue.push(edge.to);
      }
    }
    const path = [];
    for (let at = reached; at && visited.get(at); at = visited.get(at).from) path.unshift(visited.get(at).id);
    perObligation.push({ id: obligation.id, scope: obligation.scope, goal: obligation.goal,
      status: reached ? 'REACHABLE' : 'UNKNOWN', transitionIds: path,
      goalEvidenceId: reached ? targetNodes.get(obligation.id).get(reached) : null,
      reason: reached ? 'Executed canonical path to the exact goal'
        : 'No retained positive path; finite failure, cycles, missing observations and search bounds do not prove permanent unreachability' });
  }
  const perScope = [...scopeMap.values()].map((scope) => {
    const rows = perObligation.filter((row) => row.scope === scope.id);
    const enumeration = record(scope.evidenceId, 'enumeration');
    assert.equal(enumeration.stateSha256, checkpoint.stateSha256);
    assert.equal(enumeration.logicalAt, checkpoint.logicalAt);
    assert.equal(enumeration.scope, scope.id);
    assert.deepEqual([...enumeration.obligationIds].sort(), rows.map((row) => row.id).sort(), 'Obligation inventory omitted or added a subject');
    const complete = enumeration.complete === true && rows.every((row) => row.status === 'REACHABLE');
    return { id: scope.id, enumerationComplete: enumeration.complete === true, obligations: rows.length,
      reachable: rows.filter((row) => row.status === 'REACHABLE').length,
      unknown: rows.filter((row) => row.status === 'UNKNOWN').length, complete,
      unreachable: complete ? 0 : null, permanentDeadlocks: complete ? 0 : null };
  });
  return { format: 1, sourceRevision, configurationSha256, checkpoint, perObligation, perScope,
    complete: perScope.length > 0 && perScope.every((row) => row.complete),
    // No overall world clearance: the caller must join every frozen assertion's
    // scope, including resource prerequisites and Family/Knowledge propagation.
    limitations: ['Positive paths apply only to their exact source, configuration and checkpoint',
      'Missing or bounded exploration remains unknown; no permanent failure is inferred',
      'Goal and native artifact assertions are independently verified runner inputs',
      'Restricted observer evidence must never feed actor decisions'] };
}

// Call at the same checkpoint as operationLifecycleDiagnostics. Exact IDs stop a
// clean proof for one operation from clearing another operation's recovery gap.
export function resolveOperationRecovery(lifecycle, reachability, checkpoint) {
  assert.deepEqual(reachability.checkpoint, checkpoint, 'Operation observation and paths must share one checkpoint');
  const scope = reachability.perScope.find((row) => row.id === 'operation-recovery');
  const proofs = reachability.perObligation.filter((row) => row.scope === 'operation-recovery');
  const expected = lifecycle.recoveryRequiredOperationIds.map((id) => `operation:${id}`).sort();
  const exactInventory = JSON.stringify(proofs.map((row) => row.id).sort()) === JSON.stringify(expected);
  const verified = new Set(proofs.filter((row) => row.status === 'REACHABLE'
    && row.goal === 'operation.completed-or-custody-recovered').map((row) => row.id));
  const unresolvedOperationIds = lifecycle.recoveryRequiredOperationIds.filter((id) => !verified.has(`operation:${id}`));
  const complete = lifecycle.complete && exactInventory && scope?.enumerationComplete === true && !unresolvedOperationIds.length;
  return { ...lifecycle, recoveryComplete: complete, unresolvedOperationIds,
    orphanedOperations: complete ? lifecycle.structuralOrphanOperations : null,
    recoveryCheckpoint: checkpoint, recoveryScopeInventoryMatches: exactInventory };
}
