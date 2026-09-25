import assert from 'node:assert/strict';
import { createRunGuardrails } from '../tools/rc1-native-run-guardrails.js';
let now = 0, measured = { outputBytes: 100, freeBytes: 2000, files: 1 };
const options = { directory: 'unused-test-path', maximumWallMs: 100, maximumOutputBytes: 1000, minimumFreeBytes: 500,
  now: () => now, storage: async () => measured };
const passing = createRunGuardrails(options); assert.equal((await passing.check('initial')).outputBytes, 100);
now = 101; assert.throws(() => passing.time('callback'), { code: 'RC1_RUN_GUARDRAIL' });
assert.equal(passing.diagnostic().failure.maximumWallMs, 100);
now = 0; const output = createRunGuardrails(options); measured = { ...measured, outputBytes: 1001 };
await assert.rejects(output.check('hourly'), { code: 'RC1_RUN_GUARDRAIL' });
assert.equal(output.diagnostic().failure.maximumOutputBytes, 1000);
const reserve = createRunGuardrails(options); measured = { ...measured, outputBytes: 100, freeBytes: 499 };
await assert.rejects(reserve.check('final'), { code: 'RC1_RUN_GUARDRAIL' });
assert.equal(reserve.diagnostic().failure.minimumFreeBytes, 500);
console.log('PASS: declared wall, output and disk-reserve limits fail closed with retained diagnostics');
