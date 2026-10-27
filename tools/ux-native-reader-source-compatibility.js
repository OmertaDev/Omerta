// Finite historical-reader reconstruction only. Native input capture reads actual source bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { UX_NATIVE_READER_SOURCE, UX_NATIVE_READER_SOURCE_SHA256 } from './ux-native-reader-source-data.js';
import { UX_PHASE2_UPGRADE_BOUND_SOURCE, UX_PHASE2_UPGRADE_BOUND_SOURCE_SHA256 } from './ux-phase2-upgrade-bound-source-data.js';
import { economyUxMergeMainHistoricalInput } from './economy-ux-merge-source-compatibility.js';
export { UX_NATIVE_READER_SOURCE };
export const UX_NATIVE_READER_SOURCE_FILES = Object.freeze(['test/phase2-postgres.js', 'tools/enterprise-native.js', 'test/enterprise-native-guard.js']);
const sha = input => crypto.createHash('sha256').update(input).digest('hex');
const blob = input => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(input) + '\0').update(input).digest('hex');
export function qualifyUxNativeReaderSource(file, input, pin = UX_NATIVE_READER_SOURCE) {
  assert.equal(pin, UX_NATIVE_READER_SOURCE, 'Only the exact frozen native-reader source binding');
  assert.equal(pin.status, 'SEALED', 'Native-reader source checkpoint is not sealed');
  assert.equal(sha(JSON.stringify(pin)), UX_NATIVE_READER_SOURCE_SHA256);
  assert.equal(pin.version, 1); assert.equal(pin.phase, 'EXACT_UX_NATIVE_READER_SOURCE_ONLY');
  assert.equal(pin.targetRevision, 'a93245c8eb798dd3760720b65e61c300cb0fceed');
  for (const value of [pin.revision, pin.tree, pin.targetTree]) assert.match(value, /^[a-f0-9]{40}$/);
  assert.equal(pin.contextLines, 3); assert.deepEqual(pin.files.map(row => row.file), UX_NATIVE_READER_SOURCE_FILES);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.files));
  const row = pin.files.find(record => record.file === file); assert(row, 'Unknown native-reader source');
  assert(Object.isFrozen(row) && Object.isFrozen(row.inverses) && row.inverses.every(Object.isFrozen));
  assert.equal(typeof input, 'string', 'Complete source text required');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'Lossless UTF-8 only');
  assert(!input.includes('\ufeff') && !input.includes('\0'), 'No BOM or NUL');
  const current = input.replaceAll('\r\n', '\n');
  assert(!current.includes('\r') && (input === current || input === current.replaceAll('\n', '\r\n')), 'Uniform whole LF/CRLF only');
  assert.equal(sha(input), input === current ? row.currentRawSha256.lf : row.currentRawSha256.crlf, 'Whole raw native-reader source changed');
  assert.equal(sha(current), row.currentSha256); assert.equal(blob(current), row.currentBlob); assert.equal(Buffer.byteLength(current), row.currentBytes);
  assert(row.inverses.length > 0, 'Changed source requires exact inverse hunks');
  let restored = current, end = -1;
  for (const inverse of row.inverses) {
    assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);
    assert.equal(typeof inverse.current, 'string'); assert.equal(typeof inverse.baseline, 'string'); assert(inverse.current.length);
    assert.equal(current.split(inverse.current).length, 2, 'Unique complete current hunk');
    const at = current.indexOf(inverse.current); assert(at >= end, 'Ordered nonoverlapping hunks'); end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha(restored), row.targetSha256); assert.equal(blob(restored), row.targetBlob); assert.equal(Buffer.byteLength(restored), row.targetBytes);
  return Object.freeze({ baselineText: restored, sourceRevision: pin.revision, targetRevision: pin.targetRevision, sourceOnly: true, native: false, runtime: false });
}
export { UX_PHASE2_UPGRADE_BOUND_SOURCE };
export const UX_PHASE2_UPGRADE_BOUND_FILE = 'test/phase2-postgres.js';
const phase2UpgradeBoundBefore = "          encoding: 'utf8', timeout: 240000, maxBuffer: 8*1024*1024, windowsHide: true,\n";
const phase2UpgradeBoundAfter = "          encoding: 'utf8', timeout: mode === 'upgrade' ? 600000 : 240000, maxBuffer: 8*1024*1024, windowsHide: true,\n";
export function qualifyUxPhase2UpgradeBoundSource(file, input, pin = UX_PHASE2_UPGRADE_BOUND_SOURCE) {
  assert.equal(pin, UX_PHASE2_UPGRADE_BOUND_SOURCE, 'Only the exact frozen Phase2 upgrade-child bound binding');
  assert.equal(pin.status, 'SEALED'); assert.equal(pin.version, 1);
  assert.equal(pin.phase, 'EXACT_UX_PHASE2_UPGRADE_BOUND_SOURCE_ONLY');
  assert.equal(pin.targetRevision, 'ae8f8688960d5165b94a5de1c29d6306ad9f0c9c');
  assert.equal(sha(JSON.stringify(pin)), UX_PHASE2_UPGRADE_BOUND_SOURCE_SHA256);
  for (const value of [pin.revision, pin.tree, pin.targetTree]) assert.match(value, /^[a-f0-9]{40}$/);
  assert.equal(pin.contextLines, 3); assert.deepEqual(pin.files.map(row => row.file), [UX_PHASE2_UPGRADE_BOUND_FILE]);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.files));
  assert.equal(file, UX_PHASE2_UPGRADE_BOUND_FILE); assert.equal(typeof input, 'string');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'Lossless UTF-8 only');
  assert(!input.includes('\ufeff') && !input.includes('\0'), 'No BOM or NUL');
  const current = input.replaceAll('\r\n', '\n');
  assert(!current.includes('\r') && (input === current || input === current.replaceAll('\n', '\r\n')), 'Uniform whole LF/CRLF only');
  const row = pin.files[0], prior = UX_NATIVE_READER_SOURCE.files.find(item => item.file === file);
  assert(Object.isFrozen(row) && Object.isFrozen(row.inverses) && row.inverses.every(Object.isFrozen));
  assert.equal(row.mode, '100644'); assert.equal(row.targetMode, prior.mode);
  assert.equal(row.targetBlob, prior.currentBlob); assert.equal(row.targetSha256, prior.currentSha256); assert.equal(row.targetBytes, prior.currentBytes);
  assert.equal(sha(input), input === current ? row.currentRawSha256.lf : row.currentRawSha256.crlf);
  assert.equal(sha(current), row.currentSha256); assert.equal(blob(current), row.currentBlob); assert.equal(Buffer.byteLength(current), row.currentBytes);
  assert.equal(row.inverses.length, 1);
  const inverse = row.inverses[0]; assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);
  assert.equal(typeof inverse.current, 'string'); assert.equal(typeof inverse.baseline, 'string'); assert(inverse.current.length);
  assert.equal(current.split(inverse.current).length, 2, 'One unique complete Git hunk');
  const restored = current.replace(inverse.current, () => inverse.baseline);
  assert.equal(sha(restored), row.targetSha256); assert.equal(blob(restored), row.targetBlob); assert.equal(Buffer.byteLength(restored), row.targetBytes);
  assert.equal(restored.split(phase2UpgradeBoundBefore).length, 2); assert.equal(current.split(phase2UpgradeBoundAfter).length, 2);
  assert.equal(current, restored.replace(phase2UpgradeBoundBefore, phase2UpgradeBoundAfter), 'Only upgrade child240000 to600000; other modes240000 and every SQL deadline, command, environment and assertion remain exact');
  qualifyUxNativeReaderSource(file, restored); // The unchanged old direct qualifier still owns its exact predecessor.
  return Object.freeze({ baselineText: restored, sourceRevision: pin.revision, targetRevision: pin.targetRevision, sourceOnly: true, native: false, runtime: false });
}
export function uxPhase2UpgradeBoundHistoricalInput(file, input) {
  input = economyUxMergeMainHistoricalInput(file, input);
  if (file !== UX_PHASE2_UPGRADE_BOUND_FILE) return input;
  const row = UX_PHASE2_UPGRADE_BOUND_SOURCE.files?.[0]; if (!row) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only');
  if (typeof text !== 'string' || sha(text.replaceAll('\r\n', '\n')) !== row.currentSha256) return input;
  const restored = qualifyUxPhase2UpgradeBoundSource(file, text).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
export function uxNativeReaderHistoricalInput(file, input) {
  input = uxPhase2UpgradeBoundHistoricalInput(file, input);
  const row = UX_NATIVE_READER_SOURCE.files.find(record => record.file === file); if (!row) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only');
  if (typeof text !== 'string' || sha(text.replaceAll('\r\n', '\n')) !== row.currentSha256) return input;
  const restored = qualifyUxNativeReaderSource(file, text).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
