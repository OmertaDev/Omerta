// Finite historical reader only. Runtime/browser tests continue to use actual current files.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { businessDeskNoirHistoricalInput } from './businessdesk-noir-source-transfer.js';
import { NOIR_UI_SOURCE, NOIR_UI_SOURCE_SHA256 } from './noir-ui-source-data.js';

export { NOIR_UI_SOURCE };
export const NOIR_UI_SOURCE_FILES = Object.freeze([
  'package.json',
  'public/index.html',
  'public/omerta-ui.css',
  'public/ux-feedback.js',
  'public/ux-navigation.js',
  'public/ux-tactics.js',
  'public/ux-world.js',
  'test/classic-interface-browser.js',
  'test/ux-community-browser.js',
  'test/ux-expanded-browser.js',
  'test/ux-experience-browser.js',
  'test/ux-personality-browser.js',
  'test/ux-shell-browser.js',
  'test/ux-story-browser.js',
]);
export const NOIR_UI_SOURCE_PREDECESSOR = 'fe887350a661901983282183fb21e9d1d330f04f';
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
const uniform = text => typeof text === 'string' && !text.includes('\0') && !text.includes('\ufeff')
  && Buffer.from(text).toString('utf8') === text && !lf(text).includes('\r')
  && (text === lf(text) || text === lf(text).replaceAll('\n', '\r\n'));

export function assertNoirUiSourceTransfer(file, input, pin = NOIR_UI_SOURCE) {
  assert.equal(pin, NOIR_UI_SOURCE, 'Only the exact frozen noir UI source binding');
  assert.equal(pin.status, 'SEALED', 'Noir UI source is not sealed');
  assert.equal(sha(JSON.stringify(pin)), NOIR_UI_SOURCE_SHA256, 'Noir UI envelope changed');
  assert.equal(pin.version, 1); assert.equal(pin.phase, 'EXACT_NOIR_UI_SOURCE_ONLY');
  assert.equal(pin.predecessor, NOIR_UI_SOURCE_PREDECESSOR);
  assert.equal(pin.contextLines, 3);
  assert.deepEqual(pin.files.map(row => row.file), NOIR_UI_SOURCE_FILES, 'Closed noir UI source domains');
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.files));
  const row = pin.files.find(record => record.file === file);
  assert(row && typeof file === 'string', 'Unknown noir UI source domain');
  assert(Object.isFrozen(row) && Object.isFrozen(row.inverses) && row.inverses.every(Object.isFrozen));
  assert(Object.isFrozen(row.currentRawSha256));
  assert(uniform(input), 'Complete uniform LF/CRLF UTF-8 noir UI source required');
  const current = lf(input);
  assert.equal(sha(input), row.currentRawSha256[input === current ? 'lf' : 'crlf'], 'Whole raw noir UI source drift');
  assert.equal(sha(current), row.currentSha256, 'Whole noir UI source drift');
  assert.equal(blob(current), row.currentBlob); assert.equal(Buffer.byteLength(current), row.currentBytes);
  if (row.predecessorAbsent) {
    assert.equal(file, 'test/ux-shell-browser.js', 'Only the new shell regression has no predecessor');
    assert.equal(row.inverses.length, 0);
    return Object.freeze({ file, baselineText: null, predecessorAbsent: true, sourceRevision: pin.revision,
      predecessorRevision: pin.predecessor, sourceOnly: true, runtime: false, native: false });
  }
  assert.equal(row.predecessorAbsent, false);
  assert(row.inverses.length > 0, 'Changed noir UI source needs exact inverse contexts');
  let baselineText = current, end = -1;
  for (const inverse of row.inverses) {
    assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);
    assert.equal(typeof inverse.current, 'string'); assert.equal(typeof inverse.baseline, 'string');
    assert(inverse.current.length); assert.equal(current.split(inverse.current).length, 2, 'Unique complete noir UI inverse');
    const at = current.indexOf(inverse.current); assert(at >= end, 'Ordered nonoverlapping noir UI inverses');
    end = at + inverse.current.length;
    assert.equal(baselineText.split(inverse.current).length, 2);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha(baselineText), row.predecessorSha256, 'Complete noir UI predecessor changed');
  assert.equal(blob(baselineText), row.predecessorBlob);
  assert.equal(Buffer.byteLength(baselineText), row.predecessorBytes);
  return Object.freeze({ file, baselineText, predecessorAbsent: false, sourceRevision: pin.revision,
    predecessorRevision: pin.predecessor, sourceOnly: true, runtime: false, native: false });
}

export function noirUiHistoricalInput(file, input) {
  input = businessDeskNoirHistoricalInput(file, input, 'noir');
  if (NOIR_UI_SOURCE.status !== 'SEALED' || typeof file !== 'string') return input;
  const row = NOIR_UI_SOURCE.files.find(record => record.file === file);
  if (!row || row.predecessorAbsent) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only; lossless UTF-8 required');
  if (!uniform(text) || sha(lf(text)) !== row.currentSha256) return input;
  const baseline = assertNoirUiSourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
