// Exact historical comparison only. Runtime and native execution use actual current source.
import assert from 'node:assert/strict';
import { uiTrimHistoricalInput, uiTrimHistoricalEntry, uiTrimHistoricalRecord } from './ui-trim-source-transfer.js';
import { createHash } from 'node:crypto';
import { AGE_REMOVAL_SOURCE, AGE_REMOVAL_SOURCE_SHA256 } from './age-removal-source-data.js';

export { AGE_REMOVAL_SOURCE };
const sha = input => createHash('sha256').update(input).digest('hex');
const blob = text => createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const known = file => typeof file === 'string' && Object.hasOwn(AGE_REMOVAL_SOURCE.files || {}, file);
const flags = Object.freeze({ sourceOnly: true, runtime: false, native: false, migration: false,
  financial: false, activation: false, deployment: false, priorResultsTransferred: false });
function definition() {
  assert.equal(AGE_REMOVAL_SOURCE.status, 'SEALED', 'Reviewed age-removal comparison must be sealed');
  assert.equal(AGE_REMOVAL_SOURCE.phase, 'EXACT_AGE_REMOVAL_SOURCE_COMPARISON_ONLY');
  assert.equal(sha(JSON.stringify(AGE_REMOVAL_SOURCE)), AGE_REMOVAL_SOURCE_SHA256);
  assert(Object.isFrozen(AGE_REMOVAL_SOURCE) && Object.isFrozen(AGE_REMOVAL_SOURCE.files));
}
function canonical(input) {
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 source required; lossless UTF-8 required');
  if (typeof text !== 'string' || /[\0\ufeff]/.test(text)) return null;
  const lf = text.replaceAll('\r\n', '\n');
  if (lf.includes('\r') || (text !== lf && text !== lf.replaceAll('\n', '\r\n'))) return null;
  return { buffer, lf };
}
function fingerprint(text, pin) {
  assert.equal(Buffer.byteLength(text), pin.bytes, 'Whole age-removal source length changed');
  assert.equal(sha(text), pin.sha256, 'Whole age-removal source hash changed');
  assert.equal(blob(text), pin.blob, 'Whole age-removal source Git blob changed');
}
const entry = (file, pin, kind) => kind === 'tree' ? `${pin.mode} blob ${pin.blob}\t${file}`
  : `${pin.mode} ${pin.blob} 0\t${file}`;
export function ageRemovalSourceDataBytes(value) {
  return '// Exact age-removal historical comparison only; no execution or deployment results transferred.\n'
    + 'const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n'
    + `export const AGE_REMOVAL_SOURCE = freeze(${JSON.stringify(value, null, 2)});\n`
    + `export const AGE_REMOVAL_SOURCE_SHA256 = '${sha(JSON.stringify(value))}';\n`;
}
export function qualifyAgeRemovalSource(file, input) {
  assert.equal(arguments.length, 2); definition(); assert(known(file), 'Only closed age-removal source domains');
  const current = canonical(input); assert(current, 'Uniform complete LF/CRLF source required');
  const row = AGE_REMOVAL_SOURCE.files[file]; fingerprint(current.lf, row.current);
  let baselineText = current.lf, end = baselineText.length;
  for (const inverse of row.inverses.toReversed()) {
    assert(Number.isSafeInteger(inverse.at) && inverse.at >= 0);
    assert(inverse.at + inverse.current.length <= end, 'Exact ordered nonoverlapping inverse contexts');
    assert.equal(baselineText.slice(inverse.at, inverse.at + inverse.current.length), inverse.current);
    baselineText = baselineText.slice(0, inverse.at) + inverse.baseline + baselineText.slice(inverse.at + inverse.current.length);
    end = inverse.at;
  }
  fingerprint(baselineText, row.baseline);
  return Object.freeze({ file, baselineText, sourceRevision: AGE_REMOVAL_SOURCE.revision,
    predecessorRevision: AGE_REMOVAL_SOURCE.predecessor, ...flags });
}
// Unknown bytes pass unchanged to the original rejecting qualifier.
export function ageRemovalHistoricalInput(file, input) {
  input = uiTrimHistoricalInput(file, input);
  if (!known(file)) return input;
  const current = canonical(input);
  if (!current || sha(current.lf) !== AGE_REMOVAL_SOURCE.files[file].current.sha256) return input;
  const baseline = qualifyAgeRemovalSource(file, input).baselineText;
  return current.buffer ? Buffer.from(baseline) : baseline;
}
export function ageRemovalHistoricalEntry(file, input, kind) {
  input = uiTrimHistoricalEntry(file, input, kind);
  assert(kind === 'tree' || kind === 'index');
  if (!known(file)) return input;
  const row = AGE_REMOVAL_SOURCE.files[file], expected = entry(file, row.current, kind);
  if (input !== expected && input !== expected + '\n') return input;
  definition(); return entry(file, row.baseline, kind) + (input.endsWith('\n') ? '\n' : '');
}
// Complete actual identities qualify before returning an explicitly historical record.
// No runtime loader or actual-current native capture imports this record view.
export function ageRemovalHistoricalRecord(file, actual) {
  assert.equal(arguments.length, 2);
  // The outer successor admits the complete actual tuple before this frozen comparison.
  if (uiTrimHistoricalEntry(file, actual?.index, 'index') !== actual?.index)
    actual = uiTrimHistoricalRecord(file, actual);
  if (!known(file)) return actual;
  definition();
  assert.deepEqual(Object.keys(actual).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());
  const row = AGE_REMOVAL_SOURCE.files[file];
  assert.deepEqual(actual.head, { mode: row.current.mode, blob: row.current.blob }, 'Actual HEAD must equal the new complete source pin');
  assert.equal(actual.index, entry(file, row.current, 'index'), 'Actual stage-zero index must equal HEAD');
  assert.equal(actual.regular, true); assert.equal(actual.symbolic, false);
  assert(Buffer.isBuffer(actual.committed) && Buffer.isBuffer(actual.physical));
  const current = canonical(actual.committed); assert(current && !actual.committed.includes(13), 'Canonical whole committed LF source');
  assert(actual.physical.equals(actual.committed) || actual.physical.equals(Buffer.from(current.lf.replaceAll('\n', '\r\n'))),
    'Actual physical source must equal whole HEAD in LF or uniform CRLF');
  const baseline = Buffer.from(qualifyAgeRemovalSource(file, actual.committed).baselineText);
  return { head: { mode: row.baseline.mode, blob: row.baseline.blob }, index: entry(file, row.baseline, 'index'),
    committed: baseline, physical: baseline, regular: true, symbolic: false };
}
