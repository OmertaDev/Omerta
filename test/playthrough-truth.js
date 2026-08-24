import assert from 'node:assert/strict';
import { crimeCoachRungObeyed } from '../tools/playthrough-truth.js';

// Regression target: the former predicate credited a level-2 player for any
// successful job while the coach still asked them to reach level 5.
assert.equal(crimeCoachRungObeyed({
  label: 'Get to level 5', successfulCrime: true, postActionLevel: 2,
}), false, 'a successful crime below level 5 does not complete the level-5 coach rung');

assert.equal(crimeCoachRungObeyed({
  label: 'Get to level 5', successfulCrime: true, postActionLevel: 5,
}), true, 'the level-5 coach rung completes after a successful crime reaches level 5');
assert.equal(crimeCoachRungObeyed({
  label: 'Pull your first job', successfulCrime: true, postActionLevel: 1,
}), true, 'the first-job coach rung remains completed by a successful crime');
assert.equal(crimeCoachRungObeyed({
  label: 'Out of nerve', successfulCrime: true, postActionLevel: 1,
}), true, 'the existing out-of-nerve crime rung remains completed by a successful crime');

for (const label of ['Get to level 5', 'Pull your first job', 'Out of nerve']) {
  assert.equal(crimeCoachRungObeyed({
    label, successfulCrime: false, postActionLevel: 5,
  }), false, `a failed crime does not complete the ${label} coach rung`);
}

console.log('✓ playthrough coach-truth regression passed');
