// Exact physical-source bridge for the gameplay/paid Deed allocation. Never a runtime import.
// Every historical binding remains unchanged; unknown bytes receive no historical authority.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DEED_ALLOCATION_SOURCE_PREDECESSOR, DEED_ALLOCATION_SOURCE_PREDECESSOR_TREE,
  DEED_ALLOCATION_SOURCE_PHASE, DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';

export { DEED_ALLOCATION_SOURCE_PREDECESSOR, DEED_ALLOCATION_SOURCE_PREDECESSOR_TREE,
  DEED_ALLOCATION_SOURCE_PHASE, DEED_ALLOCATION_SOURCE_DOMAINS };

const lf = text => text.replaceAll('\r\n', '\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const uniform = text => typeof text === 'string' && !text.includes('\0') && !text.includes('\ufeff')
  && !lf(text).includes('\r') && (text === lf(text) || text === lf(text).replaceAll('\n', '\r\n'));

export function assertDeedAllocationSourceTransfer(file, input) {
  assert(typeof file === 'string' && Object.hasOwn(DEED_ALLOCATION_SOURCE_DOMAINS, file), 'Unknown Deed allocation source domain');
  assert(uniform(input), 'Complete uniform LF/CRLF Deed allocation source required');
  const pin = DEED_ALLOCATION_SOURCE_DOMAINS[file], text = lf(input);
  assert.equal(sha256(input), pin.currentRawSha256[input === text ? 'lf' : 'crlf'], 'Complete Deed allocation physical source drift: ' + file);
  assert.equal(sha256(text), pin.currentSha256, 'Complete Deed allocation source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete Deed allocation Git blob drift: ' + file);
  assert.equal(Buffer.byteLength(text), pin.currentBytes);
  let baselineText = text, end = -1;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length, 'Nonempty Deed allocation inverse required');
    assert.equal(text.split(inverse.current).length, 2, 'Unique complete Deed allocation context required');
    const offset = text.indexOf(inverse.current);
    assert(offset >= end, 'Ordered nonoverlapping Deed allocation contexts required');
    end = offset + inverse.current.length;
    assert.equal(baselineText.split(inverse.current).length, 2, 'Missing or duplicate Deed allocation inverse');
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha256(baselineText), pin.baselineSha256, 'Complete Deed allocation predecessor source drift: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob, 'Complete Deed allocation predecessor Git blob drift: ' + file);
  assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  return Object.freeze({ file, baselineText, predecessorRevision: DEED_ALLOCATION_SOURCE_PREDECESSOR,
    phase: DEED_ALLOCATION_SOURCE_PHASE, sourceOnly: true, runtime: false, native: false,
    inverseChunks: pin.inverses.length });
}

export function deedAllocationHistoricalInput(file, input) {
  if (typeof file !== 'string' || !Object.hasOwn(DEED_ALLOCATION_SOURCE_DOMAINS, file)) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text, 'utf8').equals(input), 'Lossless UTF-8 physical source only; lossless UTF-8 required');
  if (!uniform(text) || sha256(lf(text)) !== DEED_ALLOCATION_SOURCE_DOMAINS[file].currentSha256) return input;
  const baseline = assertDeedAllocationSourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
