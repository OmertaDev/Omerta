// Exact test/tool source reconstruction only. Current runtime/native tests use actual files.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { UX_SOURCE, UX_SOURCE_SHA256 } from './ux-source-data.js';
import { uxNativeReaderHistoricalInput } from './ux-native-reader-source-compatibility.js';
export { UX_SOURCE };
export const UX_SOURCE_FILES = Object.freeze(['.github/workflows/ci.yml', 'package.json', 'public/index.html', 'schema.sql', 'src/economy.js', 'src/server.js', 'test/gates.js', 'test/migrate.js']);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
export function qualifyUxSource(file, input, pin = UX_SOURCE) {
  assert.equal(pin, UX_SOURCE, 'Only the exact frozen UX successor binding');
  assert.equal(pin.status, 'SEALED', 'UX source checkpoint is not sealed');
  assert.equal(sha(JSON.stringify(pin)), UX_SOURCE_SHA256);
  assert.equal(pin.version, 1); assert.equal(pin.phase, 'EXACT_UX_SUCCESSOR_SOURCE_ONLY');
  assert.equal(pin.targetRevision, 'c6247976ff71e8d4c103ebd1498c2d373217d077');
  for (const value of [pin.revision, pin.tree, pin.targetTree]) assert.match(value, /^[a-f0-9]{40}$/);
  assert.equal(pin.contextLines, 3); assert.deepEqual(pin.files.map(row => row.file), UX_SOURCE_FILES);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.files));
  const row = pin.files.find(record => record.file === file); assert(row, 'Unknown UX successor source');
  assert(Object.isFrozen(row) && Object.isFrozen(row.inverses) && row.inverses.every(Object.isFrozen));
  assert.equal(typeof input, 'string', 'Complete source text required');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'Lossless UTF-8 only');
  assert(!input.includes('\ufeff') && !input.includes('\0'), 'No BOM or NUL');
  const current = input.replaceAll('\r\n', '\n');
  assert(!current.includes('\r') && (input === current || input === current.replaceAll('\n', '\r\n')), 'Uniform whole LF/CRLF only');
  assert.equal(sha(input), input === current ? row.currentRawSha256.lf : row.currentRawSha256.crlf, 'Whole raw UX source changed');
  assert.equal(sha(current), row.currentSha256, 'Whole UX source changed');
  assert.equal(blob(current), row.currentBlob); assert.equal(Buffer.byteLength(current), row.currentBytes);
  assert(row.inverses.length > 0, 'Changed guarded source requires exact inverses');
  let restored = current, end = -1;
  for (const inverse of row.inverses) {
    assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);
    assert.equal(typeof inverse.current, 'string'); assert.equal(typeof inverse.baseline, 'string');
    assert(inverse.current.length); assert.equal(current.split(inverse.current).length, 2, 'Unique complete current hunk');
    const at = current.indexOf(inverse.current); assert(at >= end, 'Ordered nonoverlapping hunks'); end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha(restored), row.targetSha256, 'Complete UX predecessor changed');
  assert.equal(blob(restored), row.targetBlob); assert.equal(Buffer.byteLength(restored), row.targetBytes);
  return Object.freeze({ baselineText: restored, sourceRevision: pin.revision, targetRevision: pin.targetRevision, sourceOnly: true, native: false, runtime: false });
}
export function uxHistoricalInput(file, input) {
  input = uxNativeReaderHistoricalInput(file, input);
  const row = UX_SOURCE.files.find(record => record.file === file); if (!row) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'lossless UTF-8 physical source only');
  if (typeof text !== 'string' || sha(text.replaceAll('\r\n', '\n')) !== row.currentSha256) return input;
  const restored = qualifyUxSource(file, text).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
