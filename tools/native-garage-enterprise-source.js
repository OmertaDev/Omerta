// Extend actual native execution to the exact garage successor; retain old pins.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  NATIVE_GARAGE_SOURCE, assertNativeGarageCurrentSource, nativeGarageActual,
  nativeGarageHistoricalInput,
} from './native-garage-source-transfer.js';

export const NATIVE_GARAGE_SOURCE_METADATA = 'tools/native-garage-source-data.js';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const blob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

export function nativeGarageEnterprisePredecessor(file, current, bytes, expected) {
  assert(Buffer.isBuffer(bytes));
  // Ordinary predecessor inputs still face every original pin assertion.
  if (sha(bytes) === expected.sha256 && blob(bytes) === expected.blob) return { current, bytes };
  const row = NATIVE_GARAGE_SOURCE.files[file];
  assert(row, 'Only an explicitly pinned garage successor may extend a native input');
  assert.equal(row.baseline.mode, expected.mode);
  assert.equal(row.baseline.blob, expected.blob);
  assert.equal(row.baseline.sha256, expected.sha256, 'Garage predecessor must equal the entire original native pin');
  const actual = nativeGarageActual(file);
  assert.equal(current.type, 'blob');
  assert.equal(current.mode, actual.head.mode);
  assert.equal(current.blob, actual.head.blob);
  assert(bytes.equals(actual.committed), 'Native execution must use the complete genuine garage successor');
  const restored = Buffer.from(nativeGarageHistoricalInput(file, bytes.toString('utf8')));
  assert.equal(sha(restored), expected.sha256);
  assert.equal(blob(restored), expected.blob);
  return { current: { ...current, mode: expected.mode, blob: expected.blob }, bytes: restored };
}

export function assertNativeGarageEnterpriseClosure(actual, historical, expected) {
  assertNativeGarageCurrentSource();
  assert.deepEqual(historical, expected, 'Complete original native closure is retained after exact garage reconstruction');
  assert.equal(new Set(actual).size, actual.length);
  const prior = new Set(expected);
  for (const file of expected) assert(actual.includes(file), `Missing original native input: ${file}`);
  for (const file of actual) {
    if (prior.has(file)) continue;
    assert(file === NATIVE_GARAGE_SOURCE_METADATA || Object.hasOwn(NATIVE_GARAGE_SOURCE.additions, file),
      `Undeclared actual native dependency: ${file}`);
    if (file !== NATIVE_GARAGE_SOURCE_METADATA) nativeGarageActual(file);
  }
  return true;
}

export function nativeGarageEnterpriseScope() {
  assertNativeGarageCurrentSource();
  return [...Object.keys(NATIVE_GARAGE_SOURCE.files), ...Object.keys(NATIVE_GARAGE_SOURCE.additions), NATIVE_GARAGE_SOURCE_METADATA];
}

export function nativeGarageEnterpriseHistoricalInput(file, bytes) {
  if (!Object.hasOwn(NATIVE_GARAGE_SOURCE.files, file)) return bytes;
  return Buffer.from(nativeGarageHistoricalInput(file, bytes.toString('utf8')));
}
