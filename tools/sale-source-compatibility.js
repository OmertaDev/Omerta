// Exact sale-page successor source only. Native capture always reads actual current bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { SALE_SOURCE, SALE_SOURCE_SHA256 } from './sale-source-data.js';
export { SALE_SOURCE };
export const SALE_SOURCE_FILES = Object.freeze(['package.json', 'public/index.html', 'src/server.js']);
export const SALE_SOURCE_PREDECESSOR = 'bb55398ccc135228353e890648bda18222e76a35';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const blob = value => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(value) + '\0').update(value).digest('hex');

export function qualifySaleSource(file, input, pin = SALE_SOURCE) {
  assert.equal(pin, SALE_SOURCE, 'Only the exact frozen sale source binding');
  assert.equal(pin.status, 'SEALED', 'Sale source must be sealed against an authored commit');
  assert.equal(sha(JSON.stringify(pin)), SALE_SOURCE_SHA256);
  assert.equal(pin.version, 1); assert.equal(pin.phase, 'EXACT_SALE_PAGE_SOURCE_ONLY');
  assert.equal(pin.targetRevision, SALE_SOURCE_PREDECESSOR);
  for (const value of [pin.revision, pin.tree, pin.targetTree]) assert.match(value, /^[a-f0-9]{40}$/);
  assert.equal(pin.contextLines, 3); assert.deepEqual(pin.files.map(row => row.file), SALE_SOURCE_FILES);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.files));
  const row = pin.files.find(record => record.file === file); assert(row, 'Unknown sale source');
  assert(Object.isFrozen(row) && Object.isFrozen(row.inverses) && row.inverses.every(Object.isFrozen));
  assert.equal(row.mode, '100644'); assert.equal(row.targetMode, '100644');
  assert.equal(typeof input, 'string', 'Complete source text required');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'Lossless UTF-8 only');
  assert(!input.includes('\ufeff') && !input.includes('\0'), 'No BOM or NUL');
  const current = input.replaceAll('\r\n', '\n');
  assert(!current.includes('\r') && (input === current || input === current.replaceAll('\n', '\r\n')), 'Uniform whole LF/CRLF only');
  assert.equal(sha(input), input === current ? row.currentRawSha256.lf : row.currentRawSha256.crlf, 'Whole raw sale source changed');
  assert.equal(sha(current), row.currentSha256, 'Whole sale source changed');
  assert.equal(blob(current), row.currentBlob); assert.equal(Buffer.byteLength(current), row.currentBytes);
  assert(row.inverses.length > 0, 'Changed guarded source requires exact inverse hunks');
  let restored = current, end = -1;
  for (const inverse of row.inverses) {
    assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);
    assert.equal(typeof inverse.current, 'string'); assert.equal(typeof inverse.baseline, 'string'); assert(inverse.current.length);
    assert.equal(current.split(inverse.current).length, 2, 'Unique complete sale inverse');
    const at = current.indexOf(inverse.current); assert(at >= end, 'Ordered nonoverlapping sale hunks'); end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha(restored), row.targetSha256); assert.equal(blob(restored), row.targetBlob); assert.equal(Buffer.byteLength(restored), row.targetBytes);
  return Object.freeze({ baselineText: restored, sourceRevision: pin.revision, targetRevision: pin.targetRevision, sourceOnly: true, native: false, runtime: false });
}

export function saleHistoricalInput(file, input) {
  const row = SALE_SOURCE.files.find(record => record.file === file); if (!row) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only; lossless UTF-8 required');
  if (typeof text !== 'string' || sha(text.replaceAll('\r\n', '\n')) !== row.currentSha256) return input;
  const restored = qualifySaleSource(file, text).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
