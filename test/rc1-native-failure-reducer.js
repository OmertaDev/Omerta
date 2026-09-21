import assert from 'node:assert/strict';
import { reduceNativeFailure } from '../tools/rc1-native-failure-reducer.js';

const input = { source: { revision: 'unit-control-only' }, configuration: { engine: 'orchestrator control; not native evidence' },
  assertionIdentity: 'target-assertion', failureFingerprint: { cause: 'sentinel' },
  candidate: { actorIds: ['a', 'b', 'c', 'd'], eventIds: ['read', 'target', 'tail'], logicalDelayMs: 1000 } };
const events = [];
const runTrial = async (candidate, descriptor) => ({ assertionIdentity: input.assertionIdentity,
  inputSha256: descriptor.inputSha256, candidateSha256: descriptor.candidateSha256,
  status: candidate.actorIds.includes('a') && candidate.actorIds.includes('c') && candidate.eventIds.includes('target') ? 'REPRODUCED' : 'NOT_REPRODUCED',
  failureFingerprint: input.failureFingerprint, scope: 'unit-control-only' });
const result = await reduceNativeFailure({ input, runTrial, record: async event => events.push(event) });
assert.deepEqual(result.reduced, { actorIds: ['a', 'c'], eventIds: ['target'], logicalDelayMs: 0 });
assert.equal(result.status, 'REDUCED_SCOPED'); assert(result.minimality.actorSingleRemovals.every(r => r.reproduced === false));
assert(result.minimality.eventSingleRemovals.every(r => r.reproduced === false));
assert.equal(events.filter(event => event.kind === 'reduction-trial-result').length, result.trials);
const bounded = await reduceNativeFailure({ input, runTrial, record: async () => {}, maximumTrials: 1 });
assert.equal(bounded.status, 'INCOMPLETE_BOUNDED');
await assert.rejects(reduceNativeFailure({ input, record: async () => {},
  runTrial: async (candidate, descriptor) => ({ ...await runTrial(candidate, descriptor), failureFingerprint: { cause: 'other' } }) }), /Unrelated failure/);
await assert.rejects(reduceNativeFailure({ input, record: async () => {},
  runTrial: async (candidate, descriptor) => ({ ...await runTrial(candidate, descriptor), candidateSha256: 'wrong' }) }), /candidate binding/);
const mutable = structuredClone(input);
await assert.rejects(reduceNativeFailure({ input: mutable, record: async () => {}, runTrial: async (candidate, descriptor) => {
  mutable.configuration.changed = true; return runTrial(candidate, descriptor);
} }), /input changed/);
console.log('PASS: reducer subset/time bounds, every trial retained, bounded incomplete status and unrelated-failure/input-tamper rejection (unit controls only)');
