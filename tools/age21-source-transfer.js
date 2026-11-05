// Pure historical source reconstruction. Game runtime and native capture do not use this alias.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AGE21_SOURCE, AGE21_SOURCE_SHA256 } from './age21-source-data.js';

export { AGE21_SOURCE, AGE21_SOURCE_SHA256 };
const lf = text => text.replaceAll('\r\n', '\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && (text === lf(text) || text === lf(text).replaceAll('\n', '\r\n'));
function fingerprint(text, expected, label) {
  assert.equal(Buffer.byteLength(text), expected.bytes, label + ' byte length changed');
  assert.equal(sha256(text), expected.sha256, label + ' whole SHA-256 changed');
  assert.equal(blob(text), expected.blob, label + ' whole Git blob changed');
}

export function assertAge21SourceTransfer(file, input, pin = AGE21_SOURCE) {
  assert.equal(pin, AGE21_SOURCE, 'Only the exact frozen age-21 source binding');
  assert.equal(sha256(JSON.stringify(pin)), AGE21_SOURCE_SHA256, 'Age-21 declaration changed');
  assert.equal(pin.status, 'SEALED');
  assert(Object.hasOwn(pin.files, file), 'Unknown age-21 source domain');
  assert.equal(typeof input, 'string', 'Age-21 source must be complete text');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'Lossless UTF-8 source required');
  assert(!input.includes('\ufeff') && !input.includes('\0'), 'No BOM or NUL in source');
  assert(uniform(input), 'Uniform complete LF or CRLF source required');
  const row = pin.files[file], text = lf(input);
  assert.equal(row.current.mode, '100644', 'Only committed regular age-policy files');
  assert.equal(row.baseline.mode, '100644', 'Only committed regular predecessor files');
  fingerprint(input, input === text ? row.current.lf : row.current.crlf, 'Raw current source');
  fingerprint(text, row.current.lf, 'Normalized current source');
  let baselineText = text, end = 0;
  for (const inverse of row.inverses) {
    assert(inverse.current.length, 'Inverse context must not be empty');
    assert.equal(text.split(inverse.current).length, 2, 'Actual inverse context occurs once');
    const at = text.indexOf(inverse.current);
    assert(at >= end, 'Actual inverse hunks retain authored order');
    end = at + inverse.current.length;
    assert.equal(baselineText.split(inverse.current).length, 2, 'Missing or duplicate inverse context');
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  fingerprint(baselineText, row.baseline.lf, 'Complete reconstructed predecessor');
  fingerprint(baselineText.replaceAll('\n', '\r\n'), row.baseline.crlf, 'CRLF reconstructed predecessor');
  return Object.freeze({ file, baselineText, sourceRevision: pin.revision,
    predecessorRevision: pin.predecessorRevision, phase: pin.phase,
    inverseChunks: row.inverses.length, sourceOnly: true,
    native: false, runtime: false, migration: false, financial: false, activation: false, deployment: false });
}

// Unknown bytes stay unchanged for the caller's original rejecting guard. Only this literal source
// obtains an inverse; actual current runtime/native source is never replaced by this function.
export function age21HistoricalInput(file, input) {
  if (!Object.hasOwn(AGE21_SOURCE.files, file)) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source required');
  if (!uniform(text) || sha256(lf(text)) !== AGE21_SOURCE.files[file].current.lf.sha256) return input;
  const baseline = assertAge21SourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
