// Exact source-text views only. Runtime/native admission always uses actual current bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { CONTRACT_RELEASE_SOURCE_DATA as data, CONTRACT_RELEASE_SOURCE_DATA_SHA256 } from './contract-release-source-data.js';

export const CONTRACT_RELEASE_MIN_CONTEXT_LINES = 3;
export const CONTRACT_RELEASE_MAX_CONTEXT_LINES = 64;

const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
const canonicalPath = file => typeof file === 'string' && !file.includes('\\') && !file.includes(':')
  && !file.includes('\0') && file.split('/').every(part => part && !['.', '..', '.git', '__proto__', 'constructor', 'prototype'].includes(part));
const fields = (value, keys) => {
  assert(value && Object.getPrototypeOf(value) === Object.prototype && Object.isFrozen(value), 'Frozen plain source record required');
  const actual = Reflect.ownKeys(value); assert(actual.every(key => typeof key === 'string'), 'No hidden symbol source fields');
  assert(Object.values(Object.getOwnPropertyDescriptors(value)).every(row => row.enumerable && Object.hasOwn(row, 'value')),
    'Only enumerable data source fields');
  assert.deepEqual(actual.sort(), keys.slice().sort(), 'Closed contract-release source record');
};
const revision = value => assert.match(value, /^[a-f0-9]{40}$/, 'Exact Git revision required');
const pin = (value, file, detailed = false, raw = false) => {
  fields(value, ['file', 'mode', 'blob', 'sha256', ...(detailed ? ['bytes'] : []), ...(raw ? ['rawSha256'] : [])]);
  assert(canonicalPath(file)); assert.equal(value.file, file); assert(['100644', '100755'].includes(value.mode));
  assert.match(value.blob, /^[a-f0-9]{40}$/); assert.match(value.sha256, /^[a-f0-9]{64}$/);
  if (detailed) assert(Number.isSafeInteger(value.bytes) && value.bytes > 0);
  if (raw) {
    fields(value.rawSha256, ['lf', 'crlf']);
    assert.match(value.rawSha256.lf, /^[a-f0-9]{64}$/); assert.match(value.rawSha256.crlf, /^[a-f0-9]{64}$/);
    assert.equal(value.rawSha256.lf, value.sha256);
  }
};
const manifests = Object.freeze(['tools/enterprise-native-ux-b35-inputs.js', 'tools/enterprise-native-ux-inputs.js',
  'tools/businessdesk-deed-native-inputs.js', 'tools/businessdesk-desk-parent-native-inputs.js',
  'tools/businessdesk-monitor-parent-native-inputs.js', 'tools/businessdesk-wiki-parent-native-inputs.js',
  'tools/enterprise-native-deed-inputs.js']);
const phase = 'EXACT_CONTRACT_RELEASE_SOURCE_ONLY';
const excluded = file => manifests.includes(file) || ['tools/contract-release-source-data.js',
  'tools/enterprise-native-contract-release-inputs.js'].includes(file);

export function assertContractReleaseSourceDefinition() {
  assert.equal(arguments.length, 0, 'Caller cannot substitute a source definition');
  fields(data, ['version', 'status', 'phase', 'reviewedContractRevision', 'reviewedUiRevision',
    'baseRevision', 'baseTree', 'sourceRevision', 'sourceTree', 'historicalManifests', 'nativeChanges', 'approvedAdditions', 'sourceViews']);
  assert.equal(sha256(JSON.stringify(data)), CONTRACT_RELEASE_SOURCE_DATA_SHA256, 'Whole contract-release definition changed');
  assert.equal(data.version, 1); assert.equal(data.phase, phase);
  assert.equal(data.reviewedContractRevision, 'd70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e');
  assert.equal(data.reviewedUiRevision, 'f3b1fe4768fe2a6ef18dba5edb45bfdb090a04b7');
  for (const map of [data.historicalManifests, data.nativeChanges, data.approvedAdditions, data.sourceViews]) {
    assert(map && Object.getPrototypeOf(map) === Object.prototype && Object.isFrozen(map), 'Frozen plain source maps required');
    assert(Reflect.ownKeys(map).every(key => typeof key === 'string'), 'No hidden symbol source subjects');
    assert(Object.values(Object.getOwnPropertyDescriptors(map)).every(row => row.enumerable && Object.hasOwn(row, 'value')),
      'Only enumerable data source subjects');
  }
  assert(['UNBOUND', 'BOUND'].includes(data.status));
  if (data.status === 'UNBOUND') {
    for (const key of ['baseRevision', 'baseTree', 'sourceRevision', 'sourceTree']) assert.equal(data[key], null);
    for (const map of [data.historicalManifests, data.nativeChanges, data.approvedAdditions, data.sourceViews])
      assert.deepEqual(Object.keys(map), [], 'Unaccepted prototype has no accepted subjects');
    return data;
  }
  for (const key of ['baseRevision', 'baseTree', 'sourceRevision', 'sourceTree']) revision(data[key]);
  assert.deepEqual(Object.keys(data.historicalManifests).sort(), manifests.slice().sort(), 'Exactly the six immutable archives and accepted Desk descriptor');
  for (const file of manifests) pin(data.historicalManifests[file], file);
  for (const [file, row] of Object.entries(data.nativeChanges)) {
    assert(canonicalPath(file) && !excluded(file), 'No immutable or self-referential changed source subject'); fields(row, ['current', 'predecessor']);
    pin(row.current, file); pin(row.predecessor, file);
    assert.notDeepEqual(row.current, row.predecessor, 'A changed relation must change exact identity');
    assert(!Object.hasOwn(data.approvedAdditions, file), 'Changed and added subjects are disjoint');
  }
  for (const [file, row] of Object.entries(data.approvedAdditions)) {
    assert(canonicalPath(file)); pin(row, file);
    assert(!excluded(file),
      'Data cannot self-hash and only the current manifest is self-referential');
  }
  for (const [file, row] of Object.entries(data.sourceViews)) {
    assert(canonicalPath(file) && !excluded(file), 'No immutable or self-referential source view'); fields(row, ['current', 'targets']); pin(row.current, file, true, true);
    assert(Object.isFrozen(row.targets) && Object.getPrototypeOf(row.targets) === Object.prototype);
    assert(Reflect.ownKeys(row.targets).every(key => typeof key === 'string'), 'No hidden symbol source views');
    assert(Object.values(Object.getOwnPropertyDescriptors(row.targets)).every(row => row.enumerable && Object.hasOwn(row, 'value')),
      'Only enumerable data source views');
    assert(Object.keys(row.targets).length && Object.keys(row.targets).every(view => ['desk', 'fee'].includes(view)));
    for (const [view, target] of Object.entries(row.targets)) {
      fields(target, ['revision', 'pin', 'contextLines', 'inverses']); revision(target.revision); pin(target.pin, file, true);
      assert(Number.isSafeInteger(target.contextLines) && target.contextLines >= CONTRACT_RELEASE_MIN_CONTEXT_LINES
        && target.contextLines <= CONTRACT_RELEASE_MAX_CONTEXT_LINES, 'Explicit bounded Git context required');
      assert.equal(target.revision, view === 'desk' ? data.baseRevision : data.reviewedContractRevision);
      assert(Array.isArray(target.inverses) && Object.isFrozen(target.inverses) && target.inverses.length);
      assert.deepEqual(Reflect.ownKeys(target.inverses), [...target.inverses.keys()].map(String).concat('length'), 'No sparse or hidden inverse array fields');
      for (const inverse of target.inverses) {
        fields(inverse, ['current', 'baseline']);
        assert.equal(typeof inverse.current, 'string'); assert.equal(typeof inverse.baseline, 'string');
        assert(inverse.current.length && inverse.current.endsWith('\n') && inverse.baseline.endsWith('\n'));
        assert(!inverse.current.includes('\r') && !inverse.baseline.includes('\r'));
      }
    }
  }
  return data;
}

const textOf = input => {
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  assert.equal(typeof text, 'string', 'Complete source text required');
  assert(Buffer.from(text).toString('utf8') === text && (!buffer || Buffer.from(text).equals(input)), 'Lossless UTF-8 source required');
  assert(!text.includes('\ufeff') && !text.includes('\0'), 'BOM and NUL are not source inputs');
  const normalized = lf(text);
  assert(text === normalized || text === normalized.replaceAll('\n', '\r\n'), 'Uniform whole LF/CRLF source required');
  assert(!normalized.includes('\r') && normalized.endsWith('\n'), 'Complete newline-terminated source required');
  return { text, normalized, buffer };
};

export function assertContractReleaseSourceTransfer(file, input, view = 'desk') {
  assert.equal(arguments.length >= 2 && arguments.length <= 3, true, 'Only file, input and named view are accepted');
  assertContractReleaseSourceDefinition();
  assert.equal(data.status, 'BOUND', 'Contract-release source is UNBOUND until the stable base is accepted');
  assert(canonicalPath(file) && Object.hasOwn(data.sourceViews, file), 'Unknown contract-release source domain');
  assert(['desk', 'fee'].includes(view) && Object.hasOwn(data.sourceViews[file].targets, view), 'Unknown contract-release source view');
  const { text, normalized } = textOf(input), row = data.sourceViews[file], target = row.targets[view];
  assert.equal(sha256(text), text === normalized ? row.current.rawSha256.lf : row.current.rawSha256.crlf, 'Whole raw contract source changed');
  assert.equal(sha256(normalized), row.current.sha256); assert.equal(blob(normalized), row.current.blob);
  assert.equal(Buffer.byteLength(normalized), row.current.bytes);
  let restored = normalized, end = -1;
  for (const inverse of target.inverses) {
    assert.equal(normalized.split(inverse.current).length, 2, 'Unique complete inverse context required');
    const at = normalized.indexOf(inverse.current); assert(at >= end, 'Ordered nonoverlapping inverse contexts required');
    end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2, 'Inverse context remains unique after prior inverses');
    restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha256(restored), target.pin.sha256, 'Complete target source changed');
  assert.equal(blob(restored), target.pin.blob); assert.equal(Buffer.byteLength(restored), target.pin.bytes);
  return Object.freeze({ file, view, baselineText: restored, sourceRevision: data.sourceRevision,
    predecessorRevision: target.revision, contextLines: target.contextLines, inverseChunks: target.inverses.length, phase,
    sourceOnly: true, runtime: false, native: false });
}

function historicalInput(file, input, view) {
  if (data.status !== 'BOUND' || !canonicalPath(file) || !Object.hasOwn(data.sourceViews, file)
    || !Object.hasOwn(data.sourceViews[file].targets, view)) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source required');
  if (typeof text !== 'string') return input;
  const normalized = lf(text);
  if ((text !== normalized && text !== normalized.replaceAll('\n', '\r\n'))
    || sha256(normalized) !== data.sourceViews[file].current.sha256) return input;
  const restored = assertContractReleaseSourceTransfer(file, input, view).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
export const contractReleaseDeskInput = (file, input) => historicalInput(file, input, 'desk');
export const contractReleaseFeeInput = (file, input) => historicalInput(file, input, 'fee');
