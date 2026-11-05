// Pure historical source reconstruction. Game runtime and native capture do not use this alias.
import { businessDeskCombinedHistoricalInput } from './businessdesk-combined-source-transfer.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { WIKI_MEDIA_SOURCE, WIKI_MEDIA_SOURCE_SHA256,
  WIKI_MEDIA_MERGE_SOURCE, WIKI_MEDIA_MERGE_SOURCE_SHA256,
  WIKI_MEDIA_NOIR_MERGE_SOURCE, WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256 } from './wiki-media-source-data.js';

export { WIKI_MEDIA_SOURCE, WIKI_MEDIA_SOURCE_SHA256 };
export { WIKI_MEDIA_MERGE_SOURCE, WIKI_MEDIA_MERGE_SOURCE_SHA256 };
export { WIKI_MEDIA_NOIR_MERGE_SOURCE, WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256 };
const lf = text => text.replaceAll('\r\n', '\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && (text === lf(text) || text === lf(text).replaceAll('\n', '\r\n'));
function fingerprint(text, expected, label) {
  assert.equal(Buffer.byteLength(text), expected.bytes, label + ' byte length changed');
  assert.equal(sha256(text), expected.sha256, label + ' whole SHA-256 changed');
  assert.equal(blob(text), expected.blob, label + ' whole Git blob changed');
}

export function assertWikiMediaSourceTransfer(file, input, pin = WIKI_MEDIA_SOURCE) {
  assert.equal(pin, WIKI_MEDIA_SOURCE, 'Only the exact frozen wiki-media source binding');
  assert.equal(sha256(JSON.stringify(pin)), WIKI_MEDIA_SOURCE_SHA256, 'Wiki-media declaration changed');
  assert.equal(pin.status, 'SEALED');
  assert(Object.hasOwn(pin.files, file), 'Unknown wiki-media source domain');
  assert.equal(typeof input, 'string', 'Wiki-media source must be complete text');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'Lossless UTF-8 source required');
  assert(!input.includes('\ufeff') && !input.includes('\0'), 'No BOM or NUL in source');
  assert(uniform(input), 'Uniform complete LF or CRLF source required');
  const row = pin.files[file], text = lf(input);
  assert.equal(row.current.mode, '100644', 'Only committed regular wiki-media files');
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
export function wikiMediaHistoricalInput(file, input) {
  input = wikiMediaMergeHistoricalInput(file, input);
  if (!Object.hasOwn(WIKI_MEDIA_SOURCE.files, file)) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source required');
  if (!uniform(text) || sha256(lf(text)) !== WIKI_MEDIA_SOURCE.files[file].current.lf.sha256) return input;
  const baseline = assertWikiMediaSourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}

export function assertWikiMediaMergeSourceTransfer(file, input, target = 'main', pin = WIKI_MEDIA_MERGE_SOURCE) {
  assert.equal(pin, WIKI_MEDIA_MERGE_SOURCE, 'Only the exact frozen wiki merge source binding');
  assert.equal(sha256(JSON.stringify(pin)), WIKI_MEDIA_MERGE_SOURCE_SHA256, 'Wiki merge declaration changed');
  assert.equal(pin.status, 'SEALED');
  assert(target === 'main' || target === 'wiki', 'An exact merge parent is required');
  assert(Object.hasOwn(pin.files, file), 'Unknown wiki merge source domain');
  assert.equal(typeof input, 'string');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'Lossless UTF-8 source required');
  assert(!input.includes('\ufeff') && !input.includes('\0'), 'No BOM or NUL in source');
  assert(uniform(input), 'Uniform complete LF or CRLF source required');
  const row = pin.files[file], parent = row[target], text = lf(input);
  assert.equal(row.current.mode, '100644');
  assert(!parent.absent, 'Absent parent source cannot receive a historical inverse');
  assert.equal(parent.mode, '100644');
  fingerprint(input, input === text ? row.current.lf : row.current.crlf, 'Raw merged source');
  fingerprint(text, row.current.lf, 'Normalized merged source');
  let baselineText = text, end = 0;
  for (const inverse of parent.inverses) {
    assert(inverse.current.length, 'Nonempty merge inverse required');
    assert.equal(text.split(inverse.current).length, 2, 'Unique complete merge context required');
    const at = text.indexOf(inverse.current); assert(at >= end, 'Ordered merge contexts required');
    end = at + inverse.current.length;
    assert.equal(baselineText.split(inverse.current).length, 2, 'Missing or duplicate merge context');
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  fingerprint(baselineText, parent.lf, 'Complete merge parent');
  fingerprint(baselineText.replaceAll('\n', '\r\n'), parent.crlf, 'CRLF merge parent');
  return Object.freeze({ file, baselineText, sourceRevision: pin.revision,
    predecessorRevision: pin.parents[target].revision, target, phase: pin.phase,
    sourceOnly: true, native: false, runtime: false, migration: false,
    financial: false, activation: false, deployment: false });
}

// This forward boundary is source-only. Unknown complete bytes retain their original rejecting form.
export function wikiMediaMergeHistoricalInput(file, input, target = 'main') {
  input = wikiMediaNoirMergeHistoricalInput(file, input, 'wiki');
  if (typeof file !== 'string' || !Object.hasOwn(WIKI_MEDIA_MERGE_SOURCE.files, file)) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source required');
  if (!uniform(text) || sha256(lf(text)) !== WIKI_MEDIA_MERGE_SOURCE.files[file].current.lf.sha256) return input;
  assert(target === 'main' || target === 'wiki', 'An exact merge parent is required');
  if (WIKI_MEDIA_MERGE_SOURCE.files[file][target].absent) return input;
  const baseline = assertWikiMediaMergeSourceTransfer(file, text, target).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}

// A separate finite boundary conserves both source histories of the noir/wiki integration.
export function assertWikiMediaNoirMergeSourceTransfer(file, input, target = 'main', pin = WIKI_MEDIA_NOIR_MERGE_SOURCE) {
  assert.equal(pin, WIKI_MEDIA_NOIR_MERGE_SOURCE, 'Only the exact frozen noir/wiki merge binding');
  assert.equal(sha256(JSON.stringify(pin)), WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256, 'Noir/wiki merge declaration changed');
  assert.equal(pin.status, 'SEALED');
  assert.equal(pin.phase, 'exact-dual-parent-noir-wiki-merge-source-only; no native, runtime, financial or deployment clearance');
  assert(target === 'main' || target === 'wiki', 'An exact noir/wiki merge parent is required');
  assert(typeof file === 'string' && Object.hasOwn(pin.files, file), 'Unknown noir/wiki merge source domain');
  assert.equal(typeof input, 'string', 'Complete noir/wiki source text required');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'Lossless UTF-8 source required');
  assert(!input.includes('\ufeff') && !input.includes('\0'), 'No BOM or NUL in source');
  assert(uniform(input) && !lf(input).includes('\r'), 'Uniform complete LF or CRLF source required');
  const row = pin.files[file], parent = row[target], text = lf(input);
  assert.equal(row.current.mode, '100644', 'Only committed regular current source');
  assert(!parent.absent, 'Absent noir/wiki parent cannot receive a historical inverse');
  assert.equal(parent.mode, '100644', 'Only committed regular parent source');
  fingerprint(input, input === text ? row.current.lf : row.current.crlf, 'Raw noir/wiki merged source');
  fingerprint(text, row.current.lf, 'Normalized noir/wiki merged source');
  let baselineText = text, end = 0;
  for (const inverse of parent.inverses) {
    assert(inverse.current.length, 'Nonempty noir/wiki inverse required');
    assert.equal(text.split(inverse.current).length, 2, 'Unique complete noir/wiki context required');
    const at = text.indexOf(inverse.current);
    assert(at >= end, 'Ordered nonoverlapping noir/wiki contexts required');
    end = at + inverse.current.length;
    assert.equal(baselineText.split(inverse.current).length, 2, 'Missing or duplicate noir/wiki context');
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  fingerprint(baselineText, parent.lf, 'Complete noir/wiki merge parent');
  fingerprint(baselineText.replaceAll('\n', '\r\n'), parent.crlf, 'CRLF noir/wiki merge parent');
  return Object.freeze({ file, baselineText, sourceRevision: pin.revision,
    predecessorRevision: pin.parents[target].revision, target, phase: pin.phase,
    inverseChunks: parent.inverses.length, sourceOnly: true, native: false, runtime: false,
    migration: false, financial: false, activation: false, deployment: false });
}

export function wikiMediaNoirMergeHistoricalInput(file, input, target = 'main') {
  const pin = WIKI_MEDIA_NOIR_MERGE_SOURCE;
  if (pin.status !== 'SEALED' || typeof file !== 'string' || !Object.hasOwn(pin.files, file)) return input;
  if (['main', 'wiki'].includes(target) && !pin.files[file][target].absent)
    input = businessDeskCombinedHistoricalInput(file, input, 'wiki');
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source required');
  if (!uniform(text) || lf(text).includes('\r') || sha256(lf(text)) !== pin.files[file].current.lf.sha256) return input;
  assert(target === 'main' || target === 'wiki', 'An exact noir/wiki merge parent is required');
  if (pin.files[file][target].absent) return input;
  const baseline = assertWikiMediaNoirMergeSourceTransfer(file, text, target).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
