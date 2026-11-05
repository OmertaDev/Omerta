// Provenance only. Native callers must first admit actual current/authored bytes.
import assert from 'node:assert/strict';
import { businessDeskNoirNativeProvenance } from './businessdesk-noir-native-provenance.js';
import { BUSINESS_DESK_DOMAINS } from './businessdesk-source-transfer.js';
import { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as current } from './enterprise-native-deed-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as predecessor } from './enterprise-native-ux-b35-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as deedNative } from './businessdesk-deed-native-inputs.js';

const same = (row, mode, blob, sha256) => row.mode === mode && row.blob === blob && row.sha256 === sha256;

export function businessDeskNativeProvenance(file, previous, expected) {
  const combined = businessDeskNoirNativeProvenance(file, previous, expected);
  if (combined) return combined;
  if (typeof file !== 'string' || !Object.hasOwn(BUSINESS_DESK_DOMAINS, file)) return null;
  const original = predecessor.files.find(row => row.file === file);
  if (!original) return null;
  assert.equal(current.status, 'SEALED', 'Sealed current native metadata required');
  assert.strictEqual(previous, original, 'Only the immutable original native predecessor');
  const actual = current.files.find(row => row.file === file);
  assert(actual, 'A declared actual current input is required');
  assert.strictEqual(expected, actual, 'Only the immutable actual current input');
  const desk = BUSINESS_DESK_DOMAINS[file];
  if (!same(expected, desk.mode, desk.currentBlob, desk.currentSha256)) return null;

  // Compare exact pin identities, never historical or transformed execution bytes.
  assert.equal(deedNative.status, 'SEALED', 'Sealed immutable Deed native metadata required');
  const stage = deedNative.files.find(row => row.file === file);
  assert(stage, 'An actual frozen Deed native input anchors the Desk predecessor');
  assert(same(stage, desk.baselineMode, desk.baselineBlob, desk.baselineSha256),
    'Desk predecessor is the exact frozen Deed native input');
  const deed = DEED_ALLOCATION_SOURCE_DOMAINS[file];
  if (deed) {
    assert.equal(desk.baselineMode, deed.currentMode, 'Desk predecessor mode is exact Deed source');
    assert.equal(desk.baselineBlob, deed.currentBlob, 'Desk predecessor blob is exact Deed source');
    assert.equal(desk.baselineSha256, deed.currentSha256, 'Desk predecessor hash is exact Deed source');
    assert(same(previous, deed.baselineMode, deed.baselineBlob, deed.baselineSha256),
      'The reviewed Deed predecessor remains the original native input');
  } else {
    assert(same(previous, desk.baselineMode, desk.baselineBlob, desk.baselineSha256),
      'Desk-only provenance starts at the exact original native input');
  }
  return Object.freeze({ file, current: Object.freeze({ mode: expected.mode, blob: expected.blob, sha256: expected.sha256 }),
    predecessor: previous, predecessorRevision: predecessor.authoredRevision,
    relation: 'exact-reviewed-business-and-deed-source-provenance-only', nativeAdmission: false, priorResultsTransferred: false });
}
