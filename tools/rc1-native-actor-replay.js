// Test-only actor decisions. Exact authorized inputs must match before a recorded
// choice can be returned; domain authorization still executes in the caller.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';

// Compare the full JSON projection a caller receives, including native Date
// values as ISO strings. No fields or numerical/string values are normalized.
export const actorValueHash = (value) => sha256(canonicalJson(JSON.parse(JSON.stringify(value))));
const hash = actorValueHash;
export function createRecordedActors({ replay = null, record = async () => {} } = {}) {
  if (replay) {
    assert.equal(replay.format, 1); assert.equal(replay.complete, true);
    assert.deepEqual(replay.failures, []); assert(Array.isArray(replay.entries));
    assert.equal(hash(replay.entries), replay.entriesSha256, 'Actor tape hash differs');
  }
  const entries = [], failures = [];
  async function accept(kind, identity, input, choose) {
    const request = { sequence: entries.length + 1, kind, identity: structuredClone(identity), inputSha256: hash(input) };
    try {
      let choice;
      if (replay) {
        const expected = replay.entries[entries.length]; assert(expected, 'Unrecorded actor occurrence');
        const { choice: priorChoice, ...priorRequest } = expected;
        assert.deepEqual(request, priorRequest, 'Actor identity or exact authorized input differs');
        choice = structuredClone(priorChoice);
      } else choice = await choose();
      const entry = { ...request, choice: JSON.parse(JSON.stringify(choice)) };
      entries.push(entry); await record({ kind: 'actor-replay-entry', entry }); return choice;
    } catch (error) {
      const failure = { request, input, expected: replay?.entries[entries.length] || null, message: error.message };
      failures.push(failure); await record({ kind: 'actor-replay-rejection', failure }); throw error;
    }
  }
  const diagnostic = (complete = false) => ({ format: 1, complete, entries, failures, entriesSha256: hash(entries) });
  return {
    decide: accept,
    async observe(kind, identity, value) { assert.equal(await accept(kind, identity, value, () => null), null); },
    diagnostic,
    finish() {
      assert.equal(failures.length, 0, 'Actor replay contains rejected occurrences');
      if (replay) assert.equal(entries.length, replay.entries.length, 'Unconsumed actor occurrences');
      return diagnostic(true);
    },
  };
}

export const ACTOR_REPLAY_COMPARISON_FIELDS = Object.freeze([
  'hours', 'population', 'seed', 'initialStateSha256', 'finalStateSha256',
  'workerScheduleSha256', 'jobOutcomesSha256', 'deterministicRandomTapeSha256',
  'actorTapeSha256', 'policyStateSha256', 'semanticMetricsSha256', 'worldDiagnosticsSemanticSha256',
]);
export function compareActorReplay(actual, expected) {
  for (const field of ACTOR_REPLAY_COMPARISON_FIELDS) {
    assert(actual[field] !== undefined && expected[field] !== undefined, `Missing actor replay comparison: ${field}`);
    assert.deepEqual(actual[field], expected[field], `Actor replay differs: ${field}`);
  }
  return { fields: ACTOR_REPLAY_COMPARISON_FIELDS,
    exclusions: ['Native wall durations', 'Read-only physical MVCC and relation-size diagnostics'],
    canonicalStateExclusions: [] };
}
