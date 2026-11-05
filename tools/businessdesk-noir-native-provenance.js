// Pin relations only. The caller must first admit the actual current/authored native bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { BUSINESS_DESK_NOIR_SOURCE, BUSINESS_DESK_NOIR_SOURCE_SHA256, BUSINESS_DESK_NOIR_SOURCE_FILES,
  BUSINESS_DESK_NOIR_REVISION } from './businessdesk-noir-source-transfer.js';
import { NOIR_UI_SOURCE, NOIR_UI_SOURCE_SHA256 } from './noir-ui-source-data.js';
import { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as current } from './enterprise-native-deed-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as predecessor } from './enterprise-native-ux-b35-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as deedNative } from './businessdesk-deed-native-inputs.js';

export const BUSINESS_DESK_NOIR_NATIVE_FILES = Object.freeze([
  'package.json', 'public/index.html', 'public/omerta-ui.css', 'public/ux-feedback.js',
  'public/ux-navigation.js', 'public/ux-tactics.js', 'public/ux-world.js',
  'test/deed-allocation-source-compatibility.js', 'tools/deed-allocation-source-transfer.js',
]);
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same = (record, mode, blob, sha256) => !!record && record.mode === mode && record.blob === blob && record.sha256 === sha256;

export function businessDeskNoirNativeProvenance(file, previous, expected) {
  if (typeof file !== 'string' || !BUSINESS_DESK_NOIR_NATIVE_FILES.includes(file)) return null;
  const original = predecessor.files.find(row => row.file === file);
  // Both shared Deed hooks are current additions, with no original B35 input.
  // Their actual bytes remain captured by the current declaration, never a fabricated relation.
  if (!original) return null;
  const actual = current.files.find(row => row.file === file);
  assert(actual, 'Declared actual native input required');
  assert(BUSINESS_DESK_NOIR_NATIVE_FILES.indexOf(file) < 7, 'Only the seven existing Noir native inputs');
  assert.equal(current.status, 'SEALED'); assert.equal(predecessor.status, 'SEALED'); assert.equal(deedNative.status, 'SEALED');
  assert.strictEqual(previous, original, 'Only the immutable original native predecessor');
  assert.strictEqual(expected, actual, 'Only the immutable actual current native input');
  assert.equal(BUSINESS_DESK_NOIR_SOURCE.status, 'SEALED', 'Combined source catalog is unbound');
  assert.equal(BUSINESS_DESK_NOIR_SOURCE.version, 1);
  assert.equal(BUSINESS_DESK_NOIR_SOURCE.phase, 'EXACT_BUSINESS_DESK_NOIR_SOURCE_ONLY');
  assert.equal(sha(BUSINESS_DESK_NOIR_SOURCE), BUSINESS_DESK_NOIR_SOURCE_SHA256);
  assert(Object.isFrozen(BUSINESS_DESK_NOIR_SOURCE) && Object.isFrozen(BUSINESS_DESK_NOIR_SOURCE.files));
  assert.deepEqual(BUSINESS_DESK_NOIR_SOURCE.files.map(row => row.file), BUSINESS_DESK_NOIR_SOURCE_FILES);
  const integration = BUSINESS_DESK_NOIR_SOURCE.files.find(row => row.file === file);
  const stage = deedNative.files.find(row => row.file === file);
  assert(stage, 'Exact frozen Deed native anchor required');
  assert.equal(NOIR_UI_SOURCE.status, 'SEALED'); assert.equal(NOIR_UI_SOURCE.version, 1);
  assert.equal(NOIR_UI_SOURCE.phase, 'EXACT_NOIR_UI_SOURCE_ONLY');
  assert.equal(NOIR_UI_SOURCE.revision, BUSINESS_DESK_NOIR_REVISION);
  assert.equal(sha(NOIR_UI_SOURCE), NOIR_UI_SOURCE_SHA256);
  const noir = NOIR_UI_SOURCE.files.find(row => row.file === file);
  assert(noir && !noir.predecessorAbsent, 'Closed existing Noir native source');
  if (integration) {
    if (!same(expected, integration.mode, integration.currentBlob, integration.currentSha256)) return null;
    assert.equal(integration.targetKind, 'noir'); assert.equal(integration.targetRevision, BUSINESS_DESK_NOIR_REVISION);
    assert.equal(integration.targetMode, noir.mode); assert.equal(integration.targetBlob, noir.currentBlob);
    assert.equal(integration.targetSha256, noir.currentSha256); assert.equal(integration.targetBytes, noir.currentBytes);
  } else if (!same(expected, noir.mode, noir.currentBlob, noir.currentSha256)) return null;
  assert(same(stage, noir.predecessorMode, noir.predecessorBlob, noir.predecessorSha256), 'Noir predecessor is exact frozen Deed source');
  const deed = DEED_ALLOCATION_SOURCE_DOMAINS[file];
  if (deed) {
    assert(same(stage, deed.currentMode, deed.currentBlob, deed.currentSha256), 'Frozen Deed source is exact reviewed current source');
    assert(same(previous, deed.baselineMode, deed.baselineBlob, deed.baselineSha256), 'Exact original Deed/B35 relation');
  } else assert(same(previous, stage.mode, stage.blob, stage.sha256), 'Unchanged Deed/B35 source identity');
  return Object.freeze({ file, current: Object.freeze({ mode: expected.mode, blob: expected.blob, sha256: expected.sha256 }),
    predecessor: previous, predecessorRevision: predecessor.authoredRevision,
    relation: 'exact-combined-noir-and-deed-source-provenance-only',
    nativeAdmission: false, priorResultsTransferred: false });
}
