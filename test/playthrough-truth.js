import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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

// Exercise the actual harness with a deterministic local player. Omitting its street clock
// caps this simulated sitting at one real-time attempt; parsing obsolete coach prose keeps
// the First Blood instruction permanently uncleared despite the assigned rival being present.
const entry = new URL('../tools/playthrough.js', import.meta.url).href;
const childCode = `
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT = 'off';
  process.env.SEASON_MOD = 'dead_quiet';
  process.env.SEASON_PHASE = 'long_game';
  delete process.env.DATABASE_URL;
  let seed = 936017;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  process.argv = [process.execPath, ${JSON.stringify(entry)}, '--days', '1', '--sessions', '1', '--session', '20'];
  await import(${JSON.stringify(entry)});
`;
const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '--eval', childCode], {
  windowsHide: true, timeout: 90000, maxBuffer: 1024 * 1024,
});
const attempts = [...stdout.matchAll(/^\s+crime:(?:win|bust)\s+(\d+)\s*$/gm)]
  .reduce((sum, match) => sum + Number(match[1]), 0);
assert.ok(attempts >= 8,
  `simulated street cooldowns must advance with the sitting; only ${attempts} crime attempts occurred`);
const obeyed = stdout.match(/^  obeyed: (.*)$/m)?.[1] || '';
assert.ok(obeyed.includes('Settle your first score'),
  'the actual current coach hint identifies the assigned rival and the harness clears First Blood');

console.log(`✓ playthrough coach-truth regression passed (${attempts} crimes; First Blood cleared)`);
