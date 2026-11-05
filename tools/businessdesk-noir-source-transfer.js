// Exact historical comparison views only. Runtime and native execution use actual files.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { BUSINESS_DESK_NOIR_SOURCE, BUSINESS_DESK_NOIR_SOURCE_SHA256 } from './businessdesk-noir-source-data.js';

export { BUSINESS_DESK_NOIR_SOURCE, BUSINESS_DESK_NOIR_SOURCE_SHA256 };
export const BUSINESS_DESK_NOIR_REVISION = '42d9df7628a30653ff7c8bac203b7bd317dee597';
export const BUSINESS_DESK_NOIR_TREE = 'ed4fb24f94c1c83a500868eeafbd72719d194af2';
export const BUSINESS_DESK_NOIR_BUSINESS_REVISION = 'd01c02b67896521ac3651cea827f235197c6d870';
export const BUSINESS_DESK_NOIR_BUSINESS_TREE = 'd22d03209e14f4d3f18b732290558b252177aab5';
export const BUSINESS_DESK_NOIR_SOURCE_FILES = Object.freeze([
  'package.json', 'public/index.html', 'test/ux-community-browser.js', 'test/ux-expanded-browser.js',
  'test/deed-allocation-source-compatibility.js', 'tools/deed-allocation-source-transfer.js',
]);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
const uniform = text => typeof text === 'string' && !text.includes('\0') && !text.includes('\ufeff')
  && Buffer.from(text).toString('utf8') === text && !lf(text).includes('\r')
  && (text === lf(text) || text === lf(text).replaceAll('\n', '\r\n'));

export function assertBusinessDeskNoirSourceTransfer(file, input, pin = BUSINESS_DESK_NOIR_SOURCE) {
  assert.strictEqual(pin, BUSINESS_DESK_NOIR_SOURCE, 'Only the exact frozen Desk/Noir source binding');
  assert.equal(pin.status, 'SEALED', 'Desk/Noir source catalog is unbound');
  assert.equal(sha(JSON.stringify(pin)), BUSINESS_DESK_NOIR_SOURCE_SHA256, 'Desk/Noir source catalog drift');
  assert.equal(pin.version, 1); assert.equal(pin.phase, 'EXACT_BUSINESS_DESK_NOIR_SOURCE_ONLY');
  assert.match(pin.revision, /^[a-f0-9]{40}$/); assert.match(pin.tree, /^[a-f0-9]{40}$/);
  assert.equal(pin.contextLines, 3);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.files));
  assert.deepEqual(pin.files.map(row => row.file), BUSINESS_DESK_NOIR_SOURCE_FILES, 'Closed Desk/Noir source domains');
  assert(typeof file === 'string' && BUSINESS_DESK_NOIR_SOURCE_FILES.includes(file), 'Unknown Desk/Noir source domain');
  const index = BUSINESS_DESK_NOIR_SOURCE_FILES.indexOf(file), row = pin.files[index];
  assert(Object.isFrozen(row) && Object.isFrozen(row.currentRawSha256) && Object.isFrozen(row.inverses));
  assert(row.inverses.every(Object.isFrozen));
  assert.equal(row.targetKind, index < 4 ? 'noir' : 'business');
  assert.equal(row.targetRevision, index < 4 ? BUSINESS_DESK_NOIR_REVISION : BUSINESS_DESK_NOIR_BUSINESS_REVISION);
  assert.equal(row.mode, '100644'); assert.equal(row.targetMode, row.mode);
  assert(uniform(input), 'Complete uniform LF/CRLF lossless UTF-8 Desk/Noir source required');
  const current = lf(input);
  assert.equal(sha(input), row.currentRawSha256[input === current ? 'lf' : 'crlf'], 'Whole raw Desk/Noir source drift');
  assert.equal(sha(current), row.currentSha256, 'Whole Desk/Noir source drift');
  assert.equal(blob(current), row.currentBlob); assert.equal(Buffer.byteLength(current), row.currentBytes);
  assert(row.inverses.length > 0, 'Changed Desk/Noir source requires exact inverse contexts');
  let targetText = current, end = -1;
  for (const inverse of row.inverses) {
    assert.deepEqual(Object.keys(inverse).sort(), ['current', 'target']);
    assert.equal(typeof inverse.current, 'string'); assert.equal(typeof inverse.target, 'string');
    assert(inverse.current.length); assert.equal(current.split(inverse.current).length, 2, 'Unique complete Desk/Noir inverse');
    const offset = current.indexOf(inverse.current); assert(offset >= end, 'Ordered nonoverlapping Desk/Noir inverses');
    end = offset + inverse.current.length;
    assert.equal(targetText.split(inverse.current).length, 2, 'Missing or duplicate Desk/Noir inverse');
    targetText = targetText.replace(inverse.current, () => inverse.target);
  }
  assert.equal(sha(targetText), row.targetSha256, 'Complete Desk/Noir target drift');
  assert.equal(blob(targetText), row.targetBlob); assert.equal(Buffer.byteLength(targetText), row.targetBytes);
  return Object.freeze({ file, targetText, targetKind: row.targetKind, targetRevision: row.targetRevision,
    sourceRevision: pin.revision, inverseChunks: row.inverses.length, sourceOnly: true, runtime: false, native: false });
}

export function businessDeskNoirHistoricalInput(file, input, targetKind = 'noir') {
  if (BUSINESS_DESK_NOIR_SOURCE.status !== 'SEALED' || typeof file !== 'string'
    || !['noir', 'business'].includes(targetKind)) return input;
  const row = BUSINESS_DESK_NOIR_SOURCE.files.find(record => record.file === file);
  if (!row || row.targetKind !== targetKind) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical Desk/Noir source required');
  if (!uniform(text)) return input;
  const current = lf(text);
  if (sha(text) !== row.currentRawSha256[text === current ? 'lf' : 'crlf'] || sha(current) !== row.currentSha256) return input;
  const target = assertBusinessDeskNoirSourceTransfer(file, text).targetText;
  return buffer ? Buffer.from(target) : target;
}
