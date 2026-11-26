// Extend actual native execution to the exact garage successor; retain old pins.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { QUESTING_ENTERPRISE_NATIVE_INPUTS as declaration,
  QUESTING_ENTERPRISE_NATIVE_INPUTS_SHA256 as declarationHash } from './enterprise-native-questing-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as predecessor } from './enterprise-native-contract-release-inputs.js';
import { LAUNCH_ENTERPRISE_SOURCE as launchSource, LAUNCH_ENTERPRISE_SOURCE_SHA256 } from './launch-enterprise-source-data.js';
import { LAUNCH_INTEGRATION_SOURCE } from './launch-integration-source-data.js';
import { launchIntegrationSourceDataBytes } from './launch-integration-source-transfer.js';
import {
  NATIVE_GARAGE_SOURCE, assertNativeGarageCurrentSource, nativeGarageActual,
  nativeGarageHistoricalInput,
} from './native-garage-source-transfer.js';

export const NATIVE_GARAGE_SOURCE_METADATA = 'tools/native-garage-source-data.js';
export function nativeGarageEnterpriseBinary(file, baselineBinary = false) {
  return baselineBinary || NATIVE_GARAGE_SOURCE.additions?.[file]?.text === false;
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const blob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], {
  windowsHide: true, maxBuffer: 256 * 1024 * 1024,
});
const readPhysical = fs.readFileSync.bind(fs);
const issued = new WeakMap();
const declared = new Map(declaration.files.map(row => [row.file, row]));
const changedPaths = Object.freeze(['.github/workflows/forge.yml', 'package.json', 'public/index.html',
  'public/ux-navigation.css', 'schema.sql', 'src/chain.js', 'src/data/market-v2-eth-abis.json', 'src/db.js',
  'src/deedbuildings.js', 'src/deeds.js', 'src/marketv2abi.js', 'src/preflight.js', 'src/routes/deeds.js',
  'src/watcher.js', 'test/grand-strategy-source-transfer.js', 'test/phase2-postgres.js',
  'tools/crime-minigame-source-compatibility.js', 'tools/market-v2-deployment-plan.js',
  'tools/native-garage-source-transfer.js', 'tools/rc1-qualification.mjs']);
const authoredPaths = Object.freeze(['tools/enterprise-native-questing.js', 'tools/native-garage-enterprise-source.js']);
const addedPaths = Object.freeze(['test/launch-integration-source-transfer.js', 'test/lib/phase2-error.js',
  'tools/launch-integration-source-transfer.js']);
const generatedPaths = Object.freeze(['tools/launch-enterprise-source-data.js', 'tools/launch-integration-source-data.js']);
const supportPaths = Object.freeze(['test/launch-enterprise-source-transfer.js']);
let declaredBytes;
let declaredSizes;
const fields = (value, names) => assert.deepEqual(Object.keys(value).sort(), [...names].sort());
function pin(value) {
  fields(value, ['mode', 'blob', 'sha256', 'bytes']);
  assert(['100644', '100755'].includes(value.mode));
  assert.match(value.blob, /^[a-f0-9]{40}$/); assert.match(value.sha256, /^[a-f0-9]{64}$/);
  assert(Number.isSafeInteger(value.bytes) && value.bytes >= 0);
}
const equalPin = (left, right) => left.mode === right.mode && left.blob === right.blob
  && left.sha256 === right.sha256 && left.bytes === right.bytes;
function fullDeclaredPin(file) {
  const expected = declared.get(file); assert(expected);
  if (!declaredSizes) {
    const files = [...changedPaths, ...authoredPaths];
    const text = execFileSync('git', ['--no-optional-locks', '--no-replace-objects', 'cat-file', '--batch-check'], {
      input: files.map(name => declared.get(name).blob).join('\n') + '\n',
      encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024,
    });
    const lines = text.split('\n'); assert.equal(lines.pop(), ''); assert.equal(lines.length, files.length);
    const sizes = new Map();
    for (let index = 0; index < files.length; index++) {
      const match = /^([a-f0-9]{40}) blob (0|[1-9][0-9]*)$/.exec(lines[index]); assert(match);
      assert.equal(match[1], declared.get(files[index]).blob);
      const size = Number(match[2]); assert(Number.isSafeInteger(size)); sizes.set(files[index], size);
    }
    declaredSizes = sizes;
  }
  assert(declaredSizes.has(file), 'Only the closed twenty-two declared replacement sizes');
  return { ...expected, bytes: declaredSizes.get(file) };
}
export function assertLaunchEnterpriseCurrentBytes(bytes, expected) {
  assert(Buffer.isBuffer(bytes)); pin(expected);
  assert.equal(bytes.length, expected.bytes); assert.equal(sha(bytes), expected.sha256); assert.equal(blob(bytes), expected.blob);
}

// Immutable object-size checks grant no current-source or native admission.
export function validateLaunchEnterpriseDefinition(value) {
  fields(value, ['version', 'status', 'phase', 'reviewedRevision', 'declarationSha256', 'declaredRevision',
    'replacements', 'authored', 'additions', 'generated', 'support', 'currentClosure']);
  assert.equal(value.version, 1); assert.equal(value.status, 'SEALED');
  assert.equal(value.phase, 'CURRENT_ENTERPRISE_SOURCE_ONLY_NO_RESULTS_TRANSFER');
  assert.equal(value.reviewedRevision, '2bc417eab6939350b7ee6ac96a6e970be2d925c6');
  assert.equal(value.declarationSha256, declarationHash);
  assert.equal(value.declaredRevision, declaration.authoredRevision);
  assert.equal(sha(JSON.stringify(declaration)), declarationHash);
  for (const [name, paths] of [['replacements', changedPaths], ['authored', authoredPaths]]) {
    assert(Array.isArray(value[name])); assert.deepEqual(value[name].map(row => row.file), paths);
    for (const row of value[name]) {
      fields(row, ['file', 'before', 'current']); pin(row.before); pin(row.current);
      assert(equalPin(row.before, fullDeclaredPin(row.file)), 'Entire old declaration pin must be retained');
    }
  }
  for (const [name, paths] of [['additions', addedPaths], ['support', supportPaths]]) {
    assert(Array.isArray(value[name])); assert.deepEqual(value[name].map(row => row.file), paths);
    for (const row of value[name]) { fields(row, ['file', 'current']); pin(row.current); assert(!declared.has(row.file)); }
  }
  // Hashing either generated file here would create a metadata cycle. Both exact
  // paths are instead rendered and checked against genuine current Git below.
  assert.deepEqual(value.generated, generatedPaths);
  const old = new Set(predecessor.files.map(row => row.file));
  const names = new Set([...declared.keys(), ...addedPaths, ...generatedPaths]);
  const closure = [...old, ...[...names].filter(file => !old.has(file)).sort()];
  assert.deepEqual(value.currentClosure, closure, 'Closed actual-current import closure');
  return Object.freeze({ sourceOnly: true, currentSourceQualified: false, nativeAdmission: false, priorResultsTransferred: false });
}

export function launchEnterpriseSourceDataBytes(value) {
  return '// Current enterprise source extension only; no old execution results transfer.\n'
    + 'const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n'
    + 'export const LAUNCH_ENTERPRISE_SOURCE = freeze(' + JSON.stringify(value, null, 2) + ');\n'
    + "export const LAUNCH_ENTERPRISE_SOURCE_SHA256 = '" + sha(JSON.stringify(value)) + "';\n";
}
function genuine(file, expected) {
  pin(expected);
  const head = git('ls-tree', 'HEAD', '--', file).toString('utf8').trim();
  assert.equal(head, `${expected.mode} blob ${expected.blob}\t${file}`, 'Exact current enterprise HEAD');
  assert.equal(git('ls-files', '--stage', '--', file).toString('utf8').trim(),
    `${expected.mode} ${expected.blob} 0\t${file}`, 'Exact current enterprise stage-zero index');
  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());
  const descriptor = fs.openSync(file, 'r'); let physical;
  try { physical = readPhysical(descriptor); } finally { fs.closeSync(descriptor); }
  const committed = git('show', 'HEAD:' + file); assertLaunchEnterpriseCurrentBytes(committed, expected);
  const text = committed.toString('utf8');
  assert(Buffer.from(text).equals(committed) && !/[\r\0\ufeff]/.test(text), 'Canonical lossless LF source');
  assert(physical.equals(committed) || physical.equals(Buffer.from(text.replaceAll('\n', '\r\n'))), 'Whole physical current source');
  return { current: { type: 'blob', mode: expected.mode, blob: expected.blob }, committed };
}
function renderedPin(text) { const bytes = Buffer.from(text); return { mode: '100644', blob: blob(bytes), sha256: sha(bytes), bytes: bytes.length }; }

export function captureLaunchEnterpriseSource() {
  assert.equal(arguments.length, 0); validateLaunchEnterpriseDefinition(launchSource);
  assert(Object.isFrozen(launchSource)); assert.equal(sha(JSON.stringify(launchSource)), LAUNCH_ENTERPRISE_SOURCE_SHA256);
  assertNativeGarageCurrentSource(); git('merge-base', '--is-ancestor', launchSource.reviewedRevision, 'HEAD');
  const records = new Map();
  for (const row of [...launchSource.replacements, ...launchSource.authored, ...launchSource.additions, ...launchSource.support])
    records.set(row.file, genuine(row.file, row.current));
  records.set(generatedPaths[0], genuine(generatedPaths[0], renderedPin(launchEnterpriseSourceDataBytes(launchSource))));
  records.set(generatedPaths[1], genuine(generatedPaths[1], renderedPin(launchIntegrationSourceDataBytes(LAUNCH_INTEGRATION_SOURCE))));
  const receipt = Object.freeze({ sourceOnly: true, nativeAdmission: false, priorResultsTransferred: false,
    revision: git('rev-parse', 'HEAD').toString('utf8').trim() });
  issued.set(receipt, records); return receipt;
}
function admission(value) { const records = issued.get(value); assert(records, 'Genuine current enterprise source capture required'); return records; }

// Read the original declaration from immutable Git blobs, never by rewinding
// current server/game imports to an earlier, pre-garage source epoch.
export function launchEnterpriseDeclaredInput(file, receipt) {
  admission(receipt); assert(declared.has(file), 'Only an original declared input');
  if (!declaredBytes) {
    const rows = declaration.files;
    const output = execFileSync('git', ['--no-optional-locks', '--no-replace-objects', 'cat-file', '--batch'], {
      input: rows.map(row => row.blob).join('\n') + '\n', windowsHide: true, maxBuffer: 256 * 1024 * 1024,
    });
    const bytes = new Map(); let at = 0;
    for (const row of rows) {
      const end = output.indexOf(10, at); assert(end >= at);
      const header = output.subarray(at, end).toString('ascii').split(' ');
      assert.equal(header.length, 3); assert.equal(header[0], row.blob); assert.equal(header[1], 'blob');
      assert.match(header[2], /^(0|[1-9][0-9]*)$/); const size = Number(header[2]); assert(Number.isSafeInteger(size));
      at = end + 1; assert(at + size < output.length); const content = output.subarray(at, at + size);
      assert.equal(blob(content), row.blob); assert.equal(sha(content), row.sha256); assert.equal(output[at + size], 10);
      bytes.set(row.file, content); at += size + 1;
    }
    assert.equal(at, output.length); declaredBytes = bytes;
  }
  return Buffer.from(declaredBytes.get(file));
}

export function nativeGarageEnterprisePredecessor(file, current, bytes, expected, receipt) {
  assert(Buffer.isBuffer(bytes));
  // Ordinary predecessor inputs still face every original pin assertion.
  if (sha(bytes) === expected.sha256 && blob(bytes) === expected.blob) return { current, bytes };
  const row = NATIVE_GARAGE_SOURCE.files[file];
  if (receipt !== undefined || !row || !equalPin(row.baseline, expected)) {
    const records = admission(receipt);
    const replacement = [...launchSource.replacements, ...launchSource.authored].find(value => value.file === file);
    const before = Object.hasOwn(expected, 'bytes') ? expected : { ...expected, bytes: fullDeclaredPin(file).bytes };
    assert(replacement && equalPin(replacement.before, before), 'Only an exact declared current-source replacement');
    const actual = records.get(file); assert(actual);
    assert.equal(current.type, actual.current.type); assert.equal(current.mode, actual.current.mode);
    assert.equal(current.blob, actual.current.blob); assert(bytes.equals(actual.committed), 'Entire genuine current source required');
    return { current: { ...current, mode: expected.mode, blob: expected.blob }, bytes: launchEnterpriseDeclaredInput(file, receipt) };
  }
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

export function assertNativeGarageEnterpriseClosure(actual, historical, expected, receipt) {
  if (receipt !== undefined) {
    admission(receipt);
    assert.deepEqual(expected, declaration.files.map(row => row.file), 'Original declaration stays unchanged');
    assert.deepEqual(historical, expected, 'Complete original declared closure reconstructed from its own epoch');
    assert.deepEqual(actual, launchSource.currentClosure, 'Actual current closure remains independently complete');
    assert.equal(new Set(actual).size, actual.length); return true;
  }
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

export function nativeGarageEnterpriseScope(receipt) {
  assertNativeGarageCurrentSource();
  const original = [...Object.keys(NATIVE_GARAGE_SOURCE.files), ...Object.keys(NATIVE_GARAGE_SOURCE.additions), NATIVE_GARAGE_SOURCE_METADATA];
  if (receipt === undefined) return original;
  return [...new Set([...original, ...admission(receipt).keys()])];
}

export function nativeGarageEnterpriseHistoricalInput(file, bytes) {
  if (!Object.hasOwn(NATIVE_GARAGE_SOURCE.files, file)) return bytes;
  return Buffer.from(nativeGarageHistoricalInput(file, bytes.toString('utf8')));
}
