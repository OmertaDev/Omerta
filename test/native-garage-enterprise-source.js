import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { NATIVE_GARAGE_SOURCE, nativeGarageActual, assertNativeGarageCurrentSource } from '../tools/native-garage-source-transfer.js';
import { QUESTING_ENTERPRISE_NATIVE_INPUTS as declaration } from '../tools/enterprise-native-questing-inputs.js';
import {
  nativeGarageEnterprisePredecessor, assertNativeGarageEnterpriseClosure,
  nativeGarageEnterpriseScope, nativeGarageEnterpriseHistoricalInput,
  NATIVE_GARAGE_SOURCE_METADATA,
} from '../tools/native-garage-enterprise-source.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
assertNativeGarageCurrentSource();
const expectedNames = declaration.files.map(row => row.file);
const changed = declaration.files.filter(row => Object.hasOwn(NATIVE_GARAGE_SOURCE.files, row.file));
assert(changed.length >= 8, 'Existing native execution includes the actual changed garage entry points');
let checks = 0;
for (const expected of changed) {
  const actual = nativeGarageActual(expected.file);
  const current = { type: 'blob', mode: actual.head.mode, blob: actual.head.blob };
  const qualified = nativeGarageEnterprisePredecessor(expected.file, current, actual.committed, expected);
  const before = git('show', NATIVE_GARAGE_SOURCE.predecessor + ':' + expected.file);
  assert(qualified.bytes.equals(before));
  assert.equal(qualified.current.blob, expected.blob);
  assert.equal(sha(actual.committed), NATIVE_GARAGE_SOURCE.files[expected.file].current.sha256);
  assert(nativeGarageEnterpriseHistoricalInput(expected.file, actual.committed).equals(before));
  assert.throws(() => nativeGarageEnterprisePredecessor(expected.file, current,
    Buffer.concat([actual.committed, Buffer.from('// unreviewed\n')]), expected));
  assert.throws(() => nativeGarageEnterprisePredecessor(expected.file, { ...current, blob: '0'.repeat(40) }, actual.committed, expected));
  assert.throws(() => nativeGarageEnterprisePredecessor(expected.file, current, actual.committed, { ...expected, sha256: '0'.repeat(64) }));
  assert.throws(() => nativeGarageEnterprisePredecessor('src/unreviewed.js', current, actual.committed, expected));
  checks += 8;
}

const unchanged = declaration.files.find(row => !Object.hasOwn(NATIVE_GARAGE_SOURCE.files, row.file));
const bytes = git('show', 'HEAD:' + unchanged.file), current = { type: 'blob', mode: unchanged.mode, blob: unchanged.blob };
const retained = nativeGarageEnterprisePredecessor(unchanged.file, current, bytes, unchanged);
assert.strictEqual(retained.bytes, bytes); assert.strictEqual(retained.current, current);

const additions = Object.keys(NATIVE_GARAGE_SOURCE.additions);
assert(additions.includes('src/nativegarage.js') && additions.includes('public/nativegarage-client.js'));
const actual = [...expectedNames, ...additions.filter(file => !expectedNames.includes(file)), NATIVE_GARAGE_SOURCE_METADATA];
assertNativeGarageEnterpriseClosure(actual, expectedNames, expectedNames);
assert.throws(() => assertNativeGarageEnterpriseClosure([...actual, 'src/unreviewed.js'], expectedNames, expectedNames));
assert.throws(() => assertNativeGarageEnterpriseClosure(actual.slice(1), expectedNames, expectedNames));
assert.throws(() => assertNativeGarageEnterpriseClosure([...actual, actual[0]], expectedNames, expectedNames));
assert.throws(() => assertNativeGarageEnterpriseClosure(actual, expectedNames.slice(1), expectedNames));
const scope = nativeGarageEnterpriseScope();
assert.equal(new Set(scope).size, scope.length);
assert(scope.includes(NATIVE_GARAGE_SOURCE_METADATA));
assert(scope.includes('public/nativegarage.css') && scope.includes('test/nativegarage-browser.js'));
console.log(`Native garage actual enterprise source: ${checks + 12} assertions, retained predecessor pins and unknown-source refusals`);
