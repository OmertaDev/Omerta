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
  'src/watcher.js', 'test/director-migration.js', 'test/enterprise-release-phase2-migration-catalog.js',
  'test/grand-strategy-source-transfer.js', 'test/phase2-postgres.js',
  'test/task-puzzle-native-catalog-guard.js', 'test/task-puzzle-native-integration-guard.js',
  'tools/crime-minigame-source-compatibility.js', 'tools/deed-quest-source-transfer.js', 'tools/market-v2-deployment-plan.js',
  'tools/native-garage-source-transfer.js', 'tools/pgquery.js', 'tools/questing-enterprise-catalog.js',
  'tools/questing-ux-release-phase2-native-catalog.js', 'tools/rc1-qualification.mjs']);
const authoredPaths = Object.freeze(['tools/enterprise-native-questing.js', 'tools/native-garage-enterprise-source.js']);
const addedPaths = Object.freeze(['test/deed-primary-native-catalog-guard.js', 'test/launch-integration-source-transfer.js', 'test/lib/phase2-error.js',
  'tools/deed-primary-native-catalog.js', 'tools/launch-integration-source-transfer.js']);
const generatedPaths = Object.freeze(['tools/launch-enterprise-source-data.js', 'tools/launch-integration-source-data.js']);
const supportPaths = Object.freeze(['test/launch-enterprise-source-transfer.js']);
let declaredBytes;
let declaredSizes;
let declaredPlan;
export const LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES = 32 * 1024 * 1024;
export const LAUNCH_ENTERPRISE_BATCH_MAX_BYTES = 256 * 1024 * 1024;
const metadataMaxBytes = 128 * 1024;
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
    declaredSizes = new Map(immutableDeclaredPlan().entries.map(row => [row.file, row.bytes]));
  }
  assert([...changedPaths, ...authoredPaths].includes(file), 'Only closed declared replacement sizes');
  return { ...expected, bytes: declaredSizes.get(file) };
}

// Pure framing helpers return no current-source receipt or native admission.
export function planLaunchEnterpriseDeclaredChunks(rows, metadata) {
  assert(Array.isArray(rows) && rows.length > 0 && Buffer.isBuffer(metadata));
  assert(metadata.length <= metadataMaxBytes);
  const text = metadata.toString('ascii'); assert(Buffer.from(text, 'ascii').equals(metadata));
  const lines = text.split('\n'); assert.equal(lines.pop(), ''); assert.equal(lines.length, rows.length);
  const names = new Set(), entries = []; let totalFramedBytes = 0;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]; fields(row, ['file', 'mode', 'blob', 'sha256']);
    assert(typeof row.file === 'string' && row.file.length && !/[\\:\0\r\n]/.test(row.file)
      && row.file.split('/').every(part => part && !['.', '..', '.git'].includes(part)));
    assert(!names.has(row.file), 'Duplicate declared path'); names.add(row.file);
    assert(['100644', '100755'].includes(row.mode));
    assert.match(row.blob, /^[a-f0-9]{40}$/); assert.match(row.sha256, /^[a-f0-9]{64}$/);
    const match = /^([a-f0-9]{40}) blob (0|[1-9][0-9]*)$/.exec(lines[index]); assert(match);
    assert.equal(match[1], row.blob, 'Immutable object metadata stays in declared order');
    const bytes = Number(match[2]); assert(Number.isSafeInteger(bytes));
    const framedBytes = bytes + Buffer.byteLength(lines[index] + '\n') + 1;
    assert(Number.isSafeInteger(framedBytes) && framedBytes <= LAUNCH_ENTERPRISE_BATCH_MAX_BYTES,
      'Individual immutable object exceeds unchanged process cap');
    totalFramedBytes += framedBytes; assert(Number.isSafeInteger(totalFramedBytes));
    entries.push(Object.freeze({ ...row, bytes, framedBytes }));
  }
  const chunks = []; let group = [], framedBytes = 0;
  const finish = () => { if (group.length) chunks.push(Object.freeze({ entries: Object.freeze(group), framedBytes })); group = []; framedBytes = 0; };
  for (const entry of entries) {
    if (group.length && framedBytes + entry.framedBytes > LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES) finish();
    group.push(entry); framedBytes += entry.framedBytes;
    if (entry.framedBytes > LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES) finish();
  }
  finish();
  assert.deepEqual(chunks.flatMap(chunk => chunk.entries.map(row => row.file)), rows.map(row => row.file));
  return Object.freeze({ entries: Object.freeze(entries), chunks: Object.freeze(chunks), totalFramedBytes });
}

export function decodeLaunchEnterpriseDeclaredChunk(output, chunk) {
  assert(Buffer.isBuffer(output)); fields(chunk, ['entries', 'framedBytes']);
  assert(Array.isArray(chunk.entries) && chunk.entries.length > 0);
  assert(Number.isSafeInteger(chunk.framedBytes) && chunk.framedBytes <= LAUNCH_ENTERPRISE_BATCH_MAX_BYTES);
  assert(chunk.framedBytes <= LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES || chunk.entries.length === 1);
  assert.equal(output.length, chunk.framedBytes, 'Complete exact-sized immutable chunk');
  const result = new Map(); let at = 0;
  for (const row of chunk.entries) {
    fields(row, ['file', 'mode', 'blob', 'sha256', 'bytes', 'framedBytes']);
    assert(!result.has(row.file), 'Duplicate immutable object path');
    const end = output.indexOf(10, at); assert(end >= at);
    const rawHeader = output.subarray(at, end), header = rawHeader.toString('ascii');
    assert(Buffer.from(header, 'ascii').equals(rawHeader));
    assert.equal(header, `${row.blob} blob ${row.bytes}`, 'Exact immutable object reference/type/size');
    assert.equal(row.framedBytes, rawHeader.length + 1 + row.bytes + 1);
    at = end + 1; assert(at + row.bytes < output.length);
    const content = output.subarray(at, at + row.bytes);
    assertLaunchEnterpriseCurrentBytes(content, { mode: row.mode, blob: row.blob, sha256: row.sha256, bytes: row.bytes });
    assert.equal(output[at + row.bytes], 10, 'Immutable object ends with its framing newline');
    result.set(row.file, Buffer.from(content)); at += row.bytes + 1;
  }
  assert.equal(at, output.length, 'No trailing immutable chunk bytes'); return result;
}

function immutableDeclaredPlan() {
  if (!declaredPlan) {
    const metadata = execFileSync('git', ['--no-optional-locks', '--no-replace-objects', 'cat-file', '--batch-check'], {
      input: declaration.files.map(row => row.blob).join('\n') + '\n', windowsHide: true, maxBuffer: metadataMaxBytes,
    });
    const plan = planLaunchEnterpriseDeclaredChunks(declaration.files, metadata);
    assert.equal(plan.entries.length, 1917, 'Entire immutable original declaration'); declaredPlan = plan;
  }
  return declaredPlan;
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
    const bytes = new Map(), order = [];
    for (const chunk of immutableDeclaredPlan().chunks) {
      admission(receipt);
      const output = execFileSync('git', ['--no-optional-locks', '--no-replace-objects', 'cat-file', '--batch'], {
        input: chunk.entries.map(row => row.blob).join('\n') + '\n', windowsHide: true, maxBuffer: LAUNCH_ENTERPRISE_BATCH_MAX_BYTES,
      });
      const decoded = decodeLaunchEnterpriseDeclaredChunk(output, chunk);
      for (const row of chunk.entries) {
        assert(!bytes.has(row.file) && decoded.has(row.file)); bytes.set(row.file, decoded.get(row.file)); order.push(row.file);
      }
    }
    assert.deepEqual(order, declaration.files.map(row => row.file)); assert.equal(bytes.size, 1917); declaredBytes = bytes;
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
