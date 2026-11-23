import assert from 'node:assert/strict';
import { AssertionError } from 'node:assert';
import { phase2ErrorSummary } from './lib/phase2-error.js';

const accessorSecret = 'PRIVATE_ACCESSOR_TOKEN';
let codeReads = 0;
const changingCode = new Error('Synthetic private error');
Object.defineProperty(changingCode, 'code', { get: () => ++codeReads <= 2 ? 'ECONNRESET' : accessorSecret });
assert.equal(phase2ErrorSummary(changingCode), 'code: ECONNRESET', 'Changing code accessors must not bypass the whitelist');
assert.equal(codeReads, 1, 'Read the diagnostic code exactly once');
let operatorReads = 0;
const changingOperator = new AssertionError({ message: 'Synthetic assertion', actual: false, expected: true, operator: 'strictEqual' });
void changingOperator.stack;
Object.defineProperty(changingOperator, 'operator', { get: () => ++operatorReads === 1 ? 'strictEqual' : accessorSecret });
assert(!phase2ErrorSummary(changingOperator).includes(accessorSecret), 'Changing operator accessors must not bypass the whitelist');
assert.equal(operatorReads, 1, 'Read the assertion operator exactly once');
const capturedFields = { code: 'ERR_ASSERTION', stack: 'AssertionError: captured\n    at source-proof.mjs:9:12',
  message: 'captured', actual: false, expected: true, operator: 'strictEqual' };
const reads = Object.fromEntries(Object.keys(capturedFields).map((key) => [key, 0]));
const counted = Object.defineProperties({}, Object.fromEntries(Object.entries(capturedFields)
  .map(([key, value]) => [key, { get: () => { reads[key]++; return value; } }])));
assert.equal(phase2ErrorSummary(counted), 'assertion at source-proof.mjs:9:12; actual=false expected=true; strictEqual');
assert(Object.values(reads).every((count) => count === 1), 'Capture every diagnostic field exactly once');
for (const key of Object.keys(capturedFields)) {
  const throwing = { ...capturedFields };
  Object.defineProperty(throwing, key, { get: () => { throw new Error(accessorSecret); } });
  assert.equal(phase2ErrorSummary(throwing), 'code: test_failed', `Throwing ${key} accessor must use a constant fallback`);
}

const privateFrame = 'PRIVATE_MESSAGE_TOKEN.js:42:9';
const multiline = new AssertionError({ message: `Synthetic private assertion\n    at ${privateFrame}`,
  actual: { private: 'synthetic' }, expected: true, operator: 'strictEqual' });
assert(!phase2ErrorSummary(multiline).includes(privateFrame), 'Multiline assertion message must never become a frame');
assert.match(phase2ErrorSummary(multiline), /^assertion at phase2-error\.js:\d+:\d+;/);

const failure = (stack, overrides = {}) => ({ code: 'ERR_ASSERTION', stack, message: '', actual: false,
  expected: true, operator: 'strictEqual', ...overrides });
const prefix = 'assertion at native-garage-source-transfer.js:218:3; actual=false expected=true; strictEqual';
const misleading = failure('AssertionError: source refused\n'
  + '    at assertNativeGarageCurrentSource (file:///home/runner/private/native-garage-source-transfer.js:218:3)\n'
  + '    at phase2SourceInputs (file:///home/runner/private/questing-ux-release-phase2-native-catalog.js:473:49)',
{ message: 'source refused' });
assert.equal(phase2ErrorSummary(misleading), prefix,
  'Report the first failing helper instead of a later filename suffix');

for (const frame of [
  '    at assertSource (C:\\Users\\private-owner\\private-folder\\native-garage-source-transfer.js:218:3)',
  '    at file:///C:/Users/private-owner/private-folder/native-garage-source-transfer.js:218:3',
  '    at /home/private-owner/private-folder/native-garage-source-transfer.js:218:3',
]) assert.equal(phase2ErrorSummary(failure('AssertionError\n' + frame)), prefix);
assert.match(phase2ErrorSummary(failure('AssertionError\n    at file:///private/source-proof.mjs:9:12')),
  /^assertion at source-proof\.mjs:9:12;/);

const secret = 'private-marker-DoNotPrint';
const sensitiveMessage = `${secret} phase2-message.js:1:2\nSQL SELECT '${secret}' FROM private_table`;
const sensitive = failure(`AssertionError: ${sensitiveMessage}\n`
  + `    at sourceCheck (file:///private/${secret}/source-proof.mjs:9:12)`,
{ message: sensitiveMessage, actual: { secret }, expected: secret, operator: secret });
const redacted = phase2ErrorSummary(sensitive);
assert.equal(redacted, 'assertion at source-proof.mjs:9:12; actual=[redacted non-scalar] expected=[redacted non-scalar]; unknown');
for (const value of [secret, 'phase2-message.js', 'SELECT', 'private_table', '/private/'])
  assert(!redacted.includes(value), `Diagnostic must omit ${value}`);
assert.equal(phase2ErrorSummary(failure(`AssertionError: ${secret} phase2-message.js:1:2`,
  { message: `${secret} phase2-message.js:1:2` })),
  'assertion at unknown assertion location; actual=false expected=true; strictEqual');
assert.equal(phase2ErrorSummary(failure('AssertionError\n    at native\n    at node:internal/process/task_queues:105:5')),
  'assertion at unknown assertion location; actual=false expected=true; strictEqual');
assert.equal(phase2ErrorSummary(failure(undefined, { actual: null, expected: 17, operator: 'deepStrictEqual' })),
  'assertion at unknown assertion location; actual=null expected=17; deepStrictEqual');
for (const overrides of [{ message: 'Different message' }, { message: undefined }, { message: { secret } }])
  assert.equal(phase2ErrorSummary(failure(`AssertionError\n    at ${privateFrame}`, overrides)),
    'assertion at unknown assertion location; actual=false expected=true; strictEqual',
    'A missing or unaligned complete message/header must not expose candidate frames');
const native = new AssertionError({ message: 'source refused', actual: false, expected: true, operator: 'strictEqual' });
native.stack = `AssertionError [ERR_ASSERTION]: ${native.message}\n`
  + '    at assertSource (file:///private/native-garage-source-transfer.js:218:3)\n'
  + '    at phase2SourceInputs (file:///private/questing-ux-release-phase2-native-catalog.js:473:49)';
assert.equal(phase2ErrorSummary(native), prefix);
for (const value of [undefined, NaN, Infinity, '42', [secret]])
  assert.match(phase2ErrorSummary(failure('', { actual: value })), /actual=\[redacted non-scalar\]/);
assert.equal(phase2ErrorSummary({ code: '40P01', message: secret }), 'code: 40P01');
assert.equal(phase2ErrorSummary({ code: secret, message: secret }), 'code: test_failed');
assert.equal(phase2ErrorSummary(undefined), 'code: test_failed');
console.log('Phase2 diagnostics passed: first-frame attribution, Windows/file URLs, private-data redaction, safe codes/operators and fallback locations.');
