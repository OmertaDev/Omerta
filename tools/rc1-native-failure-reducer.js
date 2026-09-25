// Reduction orchestration only. The caller must execute and retain native trials.
// An unrelated error never counts as reproduction of the target assertion.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';

export async function reduceNativeFailure({ input, runTrial, record, maximumTrials = 48, maximumWallMs = 1200000 }) {
  assert.equal(typeof runTrial, 'function'); assert.equal(typeof record, 'function');
  assert(Number.isSafeInteger(maximumTrials) && maximumTrials > 0);
  assert(Number.isSafeInteger(maximumWallMs) && maximumWallMs > 0);
  const bytes = canonicalJson(input), inputSha256 = sha256(bytes), immutable = JSON.parse(bytes);
  assert(immutable.assertionIdentity && immutable.failureFingerprint && immutable.source && immutable.configuration);
  const initial = immutable.candidate;
  function validate(candidate) {
    assert.deepEqual(Object.keys(candidate).sort(), ['actorIds', 'eventIds', 'logicalDelayMs']);
    for (const field of ['actorIds', 'eventIds']) {
      assert(Array.isArray(candidate[field]));
      assert.equal(new Set(candidate[field]).size, candidate[field].length);
      assert.deepEqual(candidate[field], initial[field].filter(id => candidate[field].includes(id)), `${field} must remain an ordered subset`);
    }
    assert(Number.isSafeInteger(candidate.logicalDelayMs) && candidate.logicalDelayMs >= 0);
    assert(candidate.logicalDelayMs <= initial.logicalDelayMs);
  }
  validate(initial);
  let best = structuredClone(initial), trials = 0, bounded = false;
  const started = performance.now(), cache = new Map(), outcomes = [];
  async function evaluate(candidate, reason) {
    assert.equal(canonicalJson(input), bytes, 'Failure input changed during reduction'); validate(candidate);
    const candidateSha256 = sha256(canonicalJson(candidate));
    if (cache.has(candidateSha256)) {
      const previous = cache.get(candidateSha256);
      await record({ kind: 'reduction-reused-trial', reason, candidateSha256, trial: previous.trial });
      return previous.reproduced;
    }
    if (trials >= maximumTrials || performance.now() - started >= maximumWallMs) {
      bounded = true; await record({ kind: 'reduction-bound-reached', trials, reason, candidateSha256 }); return null;
    }
    const trial = ++trials, descriptor = { trial, reason, inputSha256, candidateSha256,
      assertionIdentity: immutable.assertionIdentity, candidate: structuredClone(candidate) };
    await record({ kind: 'reduction-trial-start', ...descriptor });
    let result;
    try { result = await runTrial(structuredClone(candidate), descriptor); }
    catch (error) {
      await record({ kind: 'reduction-trial-error', ...descriptor, message: error.message, stack: error.stack }); throw error;
    }
    try {
      assert.equal(canonicalJson(input), bytes, 'Failure input changed during native trial');
      assert(['REPRODUCED', 'NOT_REPRODUCED', 'ERROR'].includes(result.status), 'Native trial must provide an explicit classification');
      assert.equal(result.assertionIdentity, immutable.assertionIdentity, 'Native trial assertion identity changed');
      assert.equal(result.inputSha256, inputSha256, 'Native trial input binding changed');
      assert.equal(result.candidateSha256, candidateSha256, 'Native trial candidate binding changed');
      if (result.status === 'REPRODUCED') assert.deepEqual(result.failureFingerprint, immutable.failureFingerprint, 'Unrelated failure cannot qualify as reproduction');
    } catch (error) {
      await record({ kind: 'reduction-invalid-trial-result', ...descriptor, result, message: error.message }); throw error;
    }
    const reproduced = result.status === 'REPRODUCED';
    const outcome = { ...descriptor, result, reproduced };
    outcomes.push(outcome); cache.set(candidateSha256, outcome);
    await record({ kind: 'reduction-trial-result', ...outcome });
    assert.notEqual(result.status, 'ERROR', 'Native trial failed outside the target assertion; reduction stopped');
    return reproduced;
  }
  assert.equal(await evaluate(best, 'baseline'), true, 'Immutable native baseline does not reproduce the target failure');
  async function reduceList(field) {
    let granularity = 2;
    while (best[field].length && !bounded) {
      const size = Math.max(1, Math.ceil(best[field].length / granularity));
      let removed = false;
      for (let offset = 0; offset < best[field].length && !bounded; offset += size) {
        const candidate = { ...best, [field]: best[field].filter((_, index) => index < offset || index >= offset + size) };
        if (await evaluate(candidate, `remove-${field}-${offset}-${size}`)) {
          best = structuredClone(candidate); granularity = Math.max(2, granularity - 1); removed = true; break;
        }
      }
      if (removed) continue;
      if (granularity >= best[field].length) break;
      granularity = Math.min(best[field].length, granularity * 2);
    }
  }
  await reduceList('actorIds'); await reduceList('eventIds');
  // Zero is the declared lower bound. If it does not reproduce, retain the
  // original delay rather than assuming a monotonic temporal predicate.
  if (!bounded && best.logicalDelayMs > 0) {
    const candidate = { ...best, logicalDelayMs: 0 };
    if (await evaluate(candidate, 'logical-delay-lower-bound')) best = candidate;
  }
  // Changing events or time can make another actor dispensable. Do not assume
  // independent dimensions or a monotonic target predicate.
  let previous;
  do {
    previous = canonicalJson(best);
    await reduceList('actorIds'); await reduceList('eventIds');
  } while (!bounded && canonicalJson(best) !== previous);
  const minimality = { actorSingleRemovals: [], eventSingleRemovals: [], logicalDelayAtDeclaredFloor: best.logicalDelayMs === 0 };
  for (const [field, key] of [['actorIds', 'actorSingleRemovals'], ['eventIds', 'eventSingleRemovals']]) {
    for (const id of best[field]) {
      if (bounded) break;
      const reproduced = await evaluate({ ...best, [field]: best[field].filter(value => value !== id) }, `minimality-${field}-${id}`);
      minimality[key].push({ removed: id, reproduced });
      assert.notEqual(reproduced, true, 'Final candidate was not deletion-minimal');
    }
  }
  const result = { format: 1, status: bounded ? 'INCOMPLETE_BOUNDED' : 'REDUCED_SCOPED', matrixQualifying: false,
    inputSha256, assertionIdentity: immutable.assertionIdentity, source: immutable.source, configuration: immutable.configuration,
    original: initial, reduced: best, trials, outcomes, minimality,
    limitation: 'Deletion-minimal only for the declared actor/event subsets; temporal proof only at the tested zero-delay floor. This is not full-world history minimization.' };
  await record({ kind: 'reduction-finished', ...result }); return result;
}
