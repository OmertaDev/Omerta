// Exact source comparison for the website release. Never imported by game or native admission.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SITE_BASICS_SOURCE, SITE_BASICS_SOURCE_SHA256 } from './site-basics-source-data.js';

export { SITE_BASICS_SOURCE };
const sha = text => createHash('sha256').update(text).digest('hex');
const blob = text => createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const known = file => typeof file === 'string' && Object.hasOwn(SITE_BASICS_SOURCE.files, file);
export function siteBasicsSourceDataBytes(value) {
  return '// Exact website source comparison only; no runtime/native/financial/deployment results transferred.\n'
    + 'const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n'
    + `export const SITE_BASICS_SOURCE = freeze(${JSON.stringify(value, null, 2)});\n`
    + `export const SITE_BASICS_SOURCE_SHA256 = '${sha(JSON.stringify(value))}';\n`;
}
function definition() {
  assert.equal(SITE_BASICS_SOURCE.status, 'SEALED', 'The exact website comparison is not sealed');
  assert.equal(SITE_BASICS_SOURCE.phase, 'EXACT_SITE_BASICS_SOURCE_COMPARISON_ONLY');
  assert.equal(sha(JSON.stringify(SITE_BASICS_SOURCE)), SITE_BASICS_SOURCE_SHA256);
  assert(Object.isFrozen(SITE_BASICS_SOURCE) && Object.isFrozen(SITE_BASICS_SOURCE.files));
}
function canonical(input) {
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 source required');
  if (typeof text !== 'string') return null;
  const lf = text.replaceAll('\r\n', '\n');
  if (lf.includes('\r') || (text !== lf && text !== lf.replaceAll('\n', '\r\n'))) return null;
  return { buffer, lf };
}
function fingerprint(text, pin) {
  assert.equal(Buffer.byteLength(text), pin.bytes, 'The complete site comparison source length changed');
  assert.equal(sha(text), pin.sha256, 'The complete site comparison source hash changed');
  assert.equal(blob(text), pin.blob, 'The complete site comparison Git blob changed');
}
export function qualifySiteBasicsSource(file, input) {
  assert.equal(arguments.length, 2, 'Only the exact file and whole source are accepted');
  definition(); assert(known(file), 'Only explicitly sealed website comparison domains');
  const current = canonical(input); assert(current, 'Complete uniform LF/CRLF source required');
  const row = SITE_BASICS_SOURCE.files[file]; fingerprint(current.lf, row.current);
  let baseline = current.lf, end = baseline.length;
  for (const inverse of row.inverses.toReversed()) {
    assert(Number.isSafeInteger(inverse.at) && inverse.at >= 0);
    assert(inverse.at + inverse.current.length <= end, 'Ordered nonoverlapping exact inverse contexts');
    assert.equal(baseline.slice(inverse.at, inverse.at + inverse.current.length), inverse.current);
    baseline = baseline.slice(0, inverse.at) + inverse.baseline + baseline.slice(inverse.at + inverse.current.length);
    end = inverse.at;
  }
  fingerprint(baseline, row.baseline);
  return Object.freeze({ file, baselineText: baseline, sourceRevision: SITE_BASICS_SOURCE.revision,
    sourceTree: SITE_BASICS_SOURCE.tree, predecessor: SITE_BASICS_SOURCE.predecessor,
    predecessorTree: SITE_BASICS_SOURCE.predecessorTree, phase: SITE_BASICS_SOURCE.phase,
    sourceOnly: true, runtime: false, native: false, financial: false, activation: false,
    deployment: false, priorResultsTransferred: false });
}
// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.
export function siteBasicsHistoricalInput(file, input) {
  if (!known(file)) return input;
  const current = canonical(input), row = SITE_BASICS_SOURCE.files[file];
  if (!current || sha(current.lf) !== row.current.sha256) return input;
  const baseline = qualifySiteBasicsSource(file, input).baselineText;
  return current.buffer ? Buffer.from(baseline) : baseline;
}
export function siteBasicsHistoricalEntry(file, entry, kind) {
  assert(kind === 'tree' || kind === 'index');
  if (!known(file)) return entry;
  const row = SITE_BASICS_SOURCE.files[file];
  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\t' + file
    : pin.mode + ' ' + pin.blob + ' 0\t' + file;
  if (entry !== format(row.current) && entry !== format(row.current) + '\n') return entry;
  definition();
  return format(row.baseline) + (entry.endsWith('\n') ? '\n' : '');
}
