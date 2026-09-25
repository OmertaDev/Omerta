// Test-only admission and exact diagnostic comparison for the bounded alliance restart.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { createAllianceWorldAdapter, ALLIANCE_WORLD_CONTRACT } from './rc1-alliance-world-adapter.js';

export function assertAllianceContinuation({ source, parentRun, parentPolicy, parentCheckpoint, parentContinuation, seed, population,
  observeResources, hours, guardLimits }) {
  assert.deepEqual(parentRun.source, source, 'Continuation source bytes differ');
  assert.equal(parentRun.status, 'PASS_SCOPED', 'Unfinished or failed parent');
  const c = parentRun.configuration;
  assert.equal(c.actorPolicy, 'coordinated_alliance'); assert.equal(c.seed, seed); assert.equal(c.population, population);
  assert([24, 48].includes(c.hours)); assert.equal(hours, 24, 'Continuation is the remaining 24 hours');
  assert.deepEqual(c.allianceContract, ALLIANCE_WORLD_CONTRACT, 'Continuation contract differs');
  assert(['pending-checkpoint', 'uninterrupted'].includes(c.continuation?.mode)); assert.equal(c.continuation.version, 1);
  assert.equal(parentRun.result.resourceObservationEnabled, observeResources, 'Continuation observation configuration differs');
  const limits = c.guardrails && Object.fromEntries(Object.keys(guardLimits || {}).map(k => [k, c.guardrails[k]]));
  assert.deepEqual(limits, guardLimits, 'Continuation guardrails differ');
  assert.equal(parentContinuation.version, 1); assert.deepEqual(parentContinuation.source, source);
  assert.equal(parentCheckpoint.stateSha256, parentContinuation.finalStateSha256);
  assert.equal(parentPolicy.logicalAt, parentContinuation.logicalAt);
  assert.equal(parentPolicy.logicalAt, Date.parse(c.epoch) + 86400000); assert.equal(parentPolicy.lastDay, 0);
  assert.equal(parentPolicy.nativeBoundary.pendingResponses, 0, 'Unfinished HTTP response lifecycle');
  assert.equal(parentPolicy.nativeBoundary.invocationPending, false, 'Unfinished native invocation');
  assert(Number.isSafeInteger(parentPolicy.nativeBoundary.responseSequence) && parentPolicy.nativeBoundary.responseSequence > 0);
  assert.equal(parentPolicy.allianceActors.length, 25);
  assert.deepEqual(parentPolicy.allianceActors.map(a => a.accountId), parentPolicy.roster);
  assert(parentPolicy.allianceActors.every(a => typeof a.token === 'string' && a.token.length > 0), 'Missing original session identity');
  const adapter = createAllianceWorldAdapter({ seed, roster: parentPolicy.allianceActors }).restore(parentPolicy.allianceAdapter);
  assert.deepEqual(adapter.summary().completedStages, [0]); assert.equal(adapter.summary().unknownResponses, 0, 'Unresolved response');
  const state = parentPolicy.allianceAdapter.payload.state;
  assert.deepEqual(state.workflow, { day: 1, index: 0, phase: 'progress', actions: 0, last: null });
  assert.equal(state.pending?.dispatchState, 'SELECTED', 'Unfinished dispatch is not an undispatched request');
  assert.equal(state.pending.accountId, parentPolicy.roster[0]); assert.equal(state.pending.decision.phase, 'act');
  assert.equal(state.pending.decision.logicalAt, parentPolicy.logicalAt);
  return { accepted: true, request: structuredClone(state.pending.decision.request) };
}

export function compareAllianceStates(before, after) {
  for (const s of [before, after]) assert.equal(s.stateSha256, sha256(canonicalJson({ tables: s.tables, sequences: s.sequences })), 'Canonical snapshot checksum differs');
  const changed = [], names = [...new Set([...Object.keys(before.tables), ...Object.keys(after.tables)])].sort();
  for (const name of names) {
    const a = before.tables[name] ?? null, b = after.tables[name] ?? null;
    if (canonicalJson(a) === canonicalJson(b)) continue;
    // Exact row text and multiplicity; no parsing/rounding of SQL numeric values.
    const remaining = new Map(); for (const row of a || []) remaining.set(row, (remaining.get(row) || 0) + 1);
    const added = []; for (const row of b || []) {
      const count = remaining.get(row) || 0; if (count) remaining.set(row, count - 1); else added.push(row);
    }
    const removed = [...remaining].flatMap(([row, n]) => Array(n).fill(row));
    changed.push({ table: name, beforePresent: a !== null, afterPresent: b !== null,
      beforeSha256: sha256(canonicalJson(a)), afterSha256: sha256(canonicalJson(b)), added, removed });
  }
  return { beforeStateSha256: before.stateSha256, afterStateSha256: after.stateSha256,
    equal: before.stateSha256 === after.stateSha256, comparedTables: names.length, changed,
    sequences: canonicalJson(before.sequences) === canonicalJson(after.sequences) ? null : { before: before.sequences, after: after.sequences },
    exclusions: [], interpretation: 'All exact canonical tables, row values/multiplicities and sequences. Differences are retained diagnostics, never normalized into equivalence.' };
}

export function assertAllianceApplicationBootstrap(before, after, logicalAt) {
  const difference = compareAllianceStates(before, after);
  assert.equal(difference.sequences, null, 'Application bootstrap changed a canonical sequence');
  assert(difference.changed.every(t => t.table === 'schema_meta'), 'Unexpected application bootstrap canonical mutation');
  for (const table of difference.changed) {
    assert.equal(table.removed.length, 1); assert.equal(table.added.length, 1);
    const a = JSON.parse(table.removed[0]), b = JSON.parse(table.added[0]);
    const { applied_at: oldAt, ...oldFields } = a, { applied_at: newAt, ...newFields } = b;
    assert.deepEqual(newFields, oldFields, 'Bootstrap changed schema identity');
    assert.equal(a.id, 1); assert(Number.isFinite(Date.parse(oldAt))); assert.equal(Date.parse(newAt), logicalAt);
  }
  return { ...difference,
    classification: 'Original makeDb schema_meta.applied_at stamp retained as canonical state. Complete aggregate bootstrap comparison; no per-commit schema/migration coverage.' };
}
