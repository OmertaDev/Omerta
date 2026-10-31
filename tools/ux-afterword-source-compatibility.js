// Finite physical-reader reconstruction only. Native capture retains actual current content.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { UX_AFTERWORD_SOURCE, UX_AFTERWORD_SOURCE_SHA256 } from './ux-afterword-source-data.js';
export { UX_AFTERWORD_SOURCE };
export const UX_AFTERWORD_SOURCE_FILES = Object.freeze(['src/content/phase1-policy.js', 'src/content/phase1.js', 'src/content/city-quest-presentation.js', 'test/worldgraph-validation.js']);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
export function qualifyUxAfterwordSource(file, input, pin = UX_AFTERWORD_SOURCE) {
  assert.equal(pin, UX_AFTERWORD_SOURCE, 'Only the exact frozen afterword source binding');
  assert.equal(sha(JSON.stringify(pin)), UX_AFTERWORD_SOURCE_SHA256);
  assert.equal(pin.version, 1); assert.equal(pin.status, 'SEALED');
  assert.equal(pin.phase, 'EXACT_UX_AFTERWORD_SOURCE_ONLY');
  assert.equal(pin.revision, 'fc32848ba3cc52b9b0e7c880c7f0d69771a4364a');
  assert.equal(pin.targetRevision, 'b35dd222054f0c5f3ca814f228dd7d9a46c58ae9');
  for (const value of [pin.revision, pin.tree, pin.targetRevision, pin.targetTree]) assert.match(value, /^[a-f0-9]{40}$/);
  assert.equal(pin.contextLines, 3); assert.deepEqual(pin.files.map(row => row.file), UX_AFTERWORD_SOURCE_FILES);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.files));
  const row = pin.files.find(record => record.file === file); assert(row, 'Unknown afterword source');
  assert(Object.isFrozen(row) && Object.isFrozen(row.currentRawSha256) && Object.isFrozen(row.inverses) && row.inverses.every(Object.isFrozen));
  assert.equal(row.mode, '100644'); assert.equal(row.targetMode, '100644');
  assert.equal(typeof input, 'string', 'Complete source text required');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'Lossless UTF-8 only');
  assert(!input.includes('\ufeff') && !input.includes('\0'), 'No BOM or NUL');
  const current = input.replaceAll('\r\n', '\n');
  assert(!current.includes('\r') && (input === current || input === current.replaceAll('\n', '\r\n')), 'Uniform whole LF/CRLF only');
  assert.equal(sha(input), input === current ? row.currentRawSha256.lf : row.currentRawSha256.crlf, 'Whole raw afterword source changed');
  assert.equal(sha(current), row.currentSha256); assert.equal(blob(current), row.currentBlob); assert.equal(Buffer.byteLength(current), row.currentBytes);
  assert.equal(row.inverses.length, file === 'src/content/phase1.js' ? 2 : file === 'test/worldgraph-validation.js' ? 3 : 1);
  let restored = current, end = -1;
  for (const inverse of row.inverses) {
    assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);
    assert.equal(typeof inverse.current, 'string'); assert.equal(typeof inverse.baseline, 'string'); assert(inverse.current.length);
    assert.equal(current.split(inverse.current).length, 2, 'Unique complete current Git hunk');
    const at = current.indexOf(inverse.current); assert(at >= end, 'Ordered nonoverlapping Git hunks'); end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha(restored), row.targetSha256); assert.equal(blob(restored), row.targetBlob); assert.equal(Buffer.byteLength(restored), row.targetBytes);
  return Object.freeze({ baselineText: restored, sourceRevision: pin.revision, targetRevision: pin.targetRevision, sourceOnly: true, native: false, runtime: false });
}
export function uxAfterwordHistoricalInput(file, input) {
  const row = UX_AFTERWORD_SOURCE.files.find(record => record.file === file); if (!row) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless physical UTF-8 only');
  if (typeof text !== 'string' || sha(text.replaceAll('\r\n', '\n')) !== row.currentSha256) return input;
  const restored = qualifyUxAfterwordSource(file, text).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
