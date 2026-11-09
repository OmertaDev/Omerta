// Exact source comparison for the quest quality release. Never imported by game or native admission.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { QUEST_QUALITY_SOURCE, QUEST_QUALITY_SOURCE_SHA256 } from './quest-quality-source-data.js';
import { ageRemovalHistoricalInput, ageRemovalHistoricalEntry } from './age-removal-source-transfer.js';

export { QUEST_QUALITY_SOURCE };
const sha = text => createHash('sha256').update(text).digest('hex');
const blob = text => createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const known = file => typeof file === 'string' && Object.hasOwn(QUEST_QUALITY_SOURCE.files, file);
export function questQualitySourceDataBytes(value) {
  return '// Exact quest quality source comparison only; no runtime/native/financial/deployment results transferred.\n'
    + 'const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n'
    + `export const QUEST_QUALITY_SOURCE = freeze(${JSON.stringify(value, null, 2)});\n`
    + `export const QUEST_QUALITY_SOURCE_SHA256 = '${sha(JSON.stringify(value))}';\n`;
}
function definition() {
  assert.equal(QUEST_QUALITY_SOURCE.status, 'SEALED', 'The exact quest quality comparison is not sealed');
  assert.equal(QUEST_QUALITY_SOURCE.phase, 'EXACT_QUEST_QUALITY_SOURCE_COMPARISON_ONLY');
  assert.equal(sha(JSON.stringify(QUEST_QUALITY_SOURCE)), QUEST_QUALITY_SOURCE_SHA256);
  assert(Object.isFrozen(QUEST_QUALITY_SOURCE) && Object.isFrozen(QUEST_QUALITY_SOURCE.files));
}
function canonical(input) {
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 source required; lossless UTF-8 required');
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
export function qualifyQuestQualitySource(file, input) {
  assert.equal(arguments.length, 2, 'Only the exact file and whole source are accepted');
  input = ageRemovalHistoricalInput(file, input);
  definition(); assert(known(file), 'Only explicitly sealed quest quality comparison domains');
  const current = canonical(input); assert(current, 'Complete uniform LF/CRLF source required');
  const row = QUEST_QUALITY_SOURCE.files[file]; fingerprint(current.lf, row.current);
  let baseline = current.lf, end = baseline.length;
  for (const inverse of row.inverses.toReversed()) {
    assert(Number.isSafeInteger(inverse.at) && inverse.at >= 0);
    assert(inverse.at + inverse.current.length <= end, 'Ordered nonoverlapping exact inverse contexts');
    assert.equal(baseline.slice(inverse.at, inverse.at + inverse.current.length), inverse.current);
    baseline = baseline.slice(0, inverse.at) + inverse.baseline + baseline.slice(inverse.at + inverse.current.length);
    end = inverse.at;
  }
  fingerprint(baseline, row.baseline);
  return Object.freeze({ file, baselineText: baseline, sourceRevision: QUEST_QUALITY_SOURCE.revision,
    sourceTree: QUEST_QUALITY_SOURCE.tree, predecessor: QUEST_QUALITY_SOURCE.predecessor,
    predecessorTree: QUEST_QUALITY_SOURCE.predecessorTree, phase: QUEST_QUALITY_SOURCE.phase,
    sourceOnly: true, runtime: false, native: false, financial: false, activation: false,
    deployment: false, priorResultsTransferred: false });
}
// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.
export function questQualityHistoricalInput(file, input) {
  input = ageRemovalHistoricalInput(file, input);
  if (!known(file)) return input;
  const current = canonical(input), row = QUEST_QUALITY_SOURCE.files[file];
  if (!current || sha(current.lf) !== row.current.sha256) return input;
  const baseline = qualifyQuestQualitySource(file, input).baselineText;
  return current.buffer ? Buffer.from(baseline) : baseline;
}
export function questQualityHistoricalEntry(file, entry, kind) {
  assert(kind === 'tree' || kind === 'index');
  entry = ageRemovalHistoricalEntry(file, entry, kind);
  if (!known(file)) return entry;
  const row = QUEST_QUALITY_SOURCE.files[file];
  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\t' + file
    : pin.mode + ' ' + pin.blob + ' 0\t' + file;
  if (entry !== format(row.current) && entry !== format(row.current) + '\n') return entry;
  definition();
  return format(row.baseline) + (entry.endsWith('\n') ? '\n' : '');
}
