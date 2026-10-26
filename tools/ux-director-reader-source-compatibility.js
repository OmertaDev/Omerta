// Finite historical-reader reconstruction only. Native input capture reads actual source bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { UX_DIRECTOR_READER_SOURCE, UX_DIRECTOR_READER_SOURCE_SHA256 } from './ux-director-reader-source-data.js';
import { UX_SOURCE } from './ux-source-data.js';
import { UX_SUITES_GATE_SOURCE, UX_SUITES_GATE_SOURCE_SHA256 } from './ux-suites-gate-source-data.js';
export { UX_DIRECTOR_READER_SOURCE };
export const UX_DIRECTOR_READER_SOURCE_FILES = Object.freeze(['test/director-migration.js']);
const sha = input => crypto.createHash('sha256').update(input).digest('hex');
const blob = input => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(input) + '\0').update(input).digest('hex');
export function qualifyUxDirectorReaderSource(file, input, pin = UX_DIRECTOR_READER_SOURCE) {
  assert.equal(pin, UX_DIRECTOR_READER_SOURCE, 'Only the exact frozen Director reader source binding');
  assert.equal(pin.status, 'SEALED', 'Director reader source checkpoint is not sealed');
  assert.equal(sha(JSON.stringify(pin)), UX_DIRECTOR_READER_SOURCE_SHA256);
  assert.equal(pin.version, 1); assert.equal(pin.phase, 'EXACT_UX_DIRECTOR_READER_SOURCE_ONLY');
  assert.equal(pin.targetRevision, '8b6c4f73e691e9ab6518f1539da464d1af17026f');
  for (const value of [pin.revision, pin.tree, pin.targetTree]) assert.match(value, /^[a-f0-9]{40}$/);
  assert.equal(pin.contextLines, 3); assert.deepEqual(pin.files.map(row => row.file), UX_DIRECTOR_READER_SOURCE_FILES);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.files));
  const row = pin.files.find(record => record.file === file); assert(row, 'Unknown Director reader source');
  assert(Object.isFrozen(row) && Object.isFrozen(row.inverses) && row.inverses.every(Object.isFrozen));
  assert.equal(typeof input, 'string', 'Complete source text required');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'Lossless UTF-8 only');
  assert(!input.includes('\ufeff') && !input.includes('\0'), 'No BOM or NUL');
  const current = input.replaceAll('\r\n', '\n');
  assert(!current.includes('\r') && (input === current || input === current.replaceAll('\n', '\r\n')), 'Uniform whole LF/CRLF only');
  assert.equal(sha(input), input === current ? row.currentRawSha256.lf : row.currentRawSha256.crlf, 'Whole raw Director reader source changed');
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
  const originalImport = "from '../tools/commerce-deed-release-phase2-native-catalog.js';", currentImport = "from '../tools/ux-release-phase2-native-catalog.js';";
  assert.equal(restored.split(originalImport).length, 2); assert.equal(current, restored.replace(originalImport, currentImport));
  assert.equal(row.inverses.length, 1); assert.equal(row.mode, row.targetMode);
  return Object.freeze({ baselineText: restored, sourceRevision: pin.revision, targetRevision: pin.targetRevision, sourceOnly: true, native: false, runtime: false });
}
export { UX_SUITES_GATE_SOURCE };
export const UX_SUITES_GATE_FILE = 'test/gates.js';
const suitesGateBefore = "  assert.deepEqual(timeouts(suites), [120],\n    'the `suites` job must retain exactly one finite 120-minute HANG bound after the observed75m commercial timeout');\n  for(const invalid of ['0','60','75','90','121','${{ inputs.suites_timeout }}','unbounded']) {\n    assert.throws(() => assert.deepEqual(timeouts(suites.replace('timeout-minutes: 120','timeout-minutes: '+invalid)),[120]),'Unknown suites wall bound must reject');\n  }\n  assert.throws(() => assert.deepEqual(timeouts(suites.replace(/^    timeout-minutes: 120\\r?\\n/m,'')),[120]),'Missing suites wall bound must reject');\n  assert.throws(() => assert.deepEqual(timeouts(suites.replace('timeout-minutes: 120','timeout-minutes: 120\\n    timeout-minutes: 120')),[120]),'Duplicate suites wall bound must reject');\n";
const suitesGateAfter = "  assert.deepEqual(timeouts(suites), [150],\n    'the `suites` job must retain exactly one finite 150-minute HANG bound after the observed120m full-lifecycle timeout');\n  for(const invalid of ['0','60','75','90','120','121','151','${{ inputs.suites_timeout }}','unbounded']) {\n    assert.throws(() => assert.deepEqual(timeouts(suites.replace('timeout-minutes: 150','timeout-minutes: '+invalid)),[150]),'Unknown suites wall bound must reject');\n  }\n  assert.throws(() => assert.deepEqual(timeouts(suites.replace(/^    timeout-minutes: 150\\r?\\n/m,'')),[150]),'Missing suites wall bound must reject');\n  assert.throws(() => assert.deepEqual(timeouts(suites.replace('timeout-minutes: 150','timeout-minutes: 150\\n    timeout-minutes: 150')),[150]),'Duplicate suites wall bound must reject');\n";
export function qualifyUxSuitesGateSource(file, input, pin = UX_SUITES_GATE_SOURCE) {
  assert.equal(pin, UX_SUITES_GATE_SOURCE, 'Only the exact frozen suites gate successor binding');
  assert.equal(pin.status, 'SEALED'); assert.equal(pin.version, 1);
  assert.equal(pin.phase, 'EXACT_UX_SUITES_GATE_SOURCE_ONLY');
  assert.equal(pin.targetRevision, '9b20b7d48cfc2969b0c79b9317deee1d4f422e97');
  assert.equal(sha(JSON.stringify(pin)), UX_SUITES_GATE_SOURCE_SHA256);
  for (const value of [pin.revision, pin.tree, pin.targetTree]) assert.match(value, /^[a-f0-9]{40}$/);
  assert.equal(pin.contextLines, 3); assert.deepEqual(pin.files.map(row => row.file), [UX_SUITES_GATE_FILE]);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.files));
  assert.equal(file, UX_SUITES_GATE_FILE); assert.equal(typeof input, 'string');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'Lossless UTF-8 only');
  assert(!input.includes('\ufeff') && !input.includes('\0'), 'No BOM or NUL');
  const current = input.replaceAll('\r\n', '\n');
  assert(!current.includes('\r') && (input === current || input === current.replaceAll('\n', '\r\n')), 'Uniform whole LF/CRLF only');
  const row = pin.files[0], prior = UX_SOURCE.files.find(item => item.file === file);
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
  assert.equal(restored.split(suitesGateBefore).length, 2); assert.equal(current.split(suitesGateAfter).length, 2);
  assert.equal(current, restored.replace(suitesGateBefore, suitesGateAfter), 'Only suites gate150 expectation/message/negative controls; every other gate body remains exact');
  // The complete predecessor is pinned by the immutable eight-file source row; no main-module import cycle.
  return Object.freeze({ baselineText: restored, sourceRevision: pin.revision, targetRevision: pin.targetRevision, sourceOnly: true, native: false, runtime: false });
}
export function uxSuitesGateHistoricalInput(file, input) {
  if (file !== UX_SUITES_GATE_FILE) return input;
  const row = UX_SUITES_GATE_SOURCE.files?.[0]; if (!row) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'lossless UTF-8 physical source only');
  if (typeof text !== 'string' || sha(text.replaceAll('\r\n', '\n')) !== row.currentSha256) return input;
  const restored = qualifyUxSuitesGateSource(file, text).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
export function uxDirectorReaderHistoricalInput(file, input) {
  input = uxSuitesGateHistoricalInput(file, input);
  const row = UX_DIRECTOR_READER_SOURCE.files.find(record => record.file === file); if (!row) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only');
  if (typeof text !== 'string' || sha(text.replaceAll('\r\n', '\n')) !== row.currentSha256) return input;
  const restored = qualifyUxDirectorReaderSource(file, text).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
