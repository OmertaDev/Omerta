// Both accepted descriptors retain their own proof rules. Actual admission uses the
// raw integrated Git tree and the independently sealed current descriptor.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ENTERPRISE_NATIVE_UX_INPUTS as PREDECESSOR_NATIVE_INPUTS } from './enterprise-native-ux-b35-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as DEED_NATIVE_INPUTS } from './economic-deed-parent-native-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as active } from './enterprise-native-economic-release-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as economic } from './enterprise-native-economic-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as desk } from './enterprise-native-deed-inputs.js';
import { combinedEconomicDeedSource as combinedEconomicDeedPin } from './combined-economic-deed-source-data.js';
import { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';
import { businessDeskCombinedNativeProvenance, assertBusinessDeskCombinedNativeDefinition } from './businessdesk-combined-native-provenance.js';
import { reviewedRevision, reviewedTree } from './economic-release-native-source.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const changedPin = (a, b) => a.mode !== b.mode || a.blob !== b.blob || a.sha256 !== b.sha256;
const rows = files => new Map(files.map(row => [row.file, row]));
const economicRows = rows(economic.files), deskRows = rows(desk.files), b35Rows = rows(PREDECESSOR_NATIVE_INPUTS.files);
const anchorFile = 'tools/economic-release-native-source.js';
const descriptors = Object.freeze([
 { accepted: '3cf03ab3ebec43983b59ee07849594ed34f3dcae', file: 'tools/enterprise-native-economic-inputs.js',
   sha256: 'b84e844da34bdcda00f52c6330d1fc6484c79106cec7db55ba2c822b4a7341b4' },
 { accepted: '68a4d92d810ee17c192abb8a8c2a3fcbf87c4c52', file: 'tools/enterprise-native-deed-inputs.js',
   sha256: 'efffdc723601dbcac89c651092748c7931fa97a8f252a1f7c7045434237f858e' },
 { accepted: '3cf03ab3ebec43983b59ee07849594ed34f3dcae', file: 'tools/economic-deed-parent-native-inputs.js',
   original: 'tools/enterprise-native-deed-inputs.js', sha256: '7dab84d91912e78448797e70dcf0fca4af19027a482d780c8557ae6a2293d311' },
]);
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
 windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
let reviewedFiles;
function rawReviewedTree() {
 if (reviewedFiles) return reviewedFiles;
 assert.match(reviewedRevision ?? '', /^[a-f0-9]{40}$/, 'Bind the reviewed native source before sealing');
 assert.match(reviewedTree ?? '', /^[a-f0-9]{40}$/);
 assert.equal(git('rev-parse', reviewedRevision + '^{tree}').toString().trim(), reviewedTree);
 for (const descriptor of descriptors) git('merge-base', '--is-ancestor', descriptor.accepted, reviewedRevision);
 const result = new Map();
 for (const record of git('ls-tree', '-r', '-z', reviewedRevision).toString().split('\0').filter(Boolean)) {
  const separator = record.indexOf('\t');
  const [mode, type, blob] = record.slice(0, separator).split(' ');
  result.set(record.slice(separator + 1), {mode, type, blob});
 }
 reviewedFiles = result;
 return result;
}

export function assertReviewedNativePin(row) {
 const reviewed = rawReviewedTree().get(row.file);
 assert(reviewed && reviewed.type === 'blob' && ['100644', '100755'].includes(reviewed.mode), 'Reviewed regular file: ' + row.file);
 assert.equal(row.mode, reviewed.mode);
 if (row.file === anchorFile) {
  const canonical = Buffer.from("export const reviewedRevision = '" + reviewedRevision + "';\nexport const reviewedTree = '" + reviewedTree + "';\n");
  assert.equal(row.sha256, digest(canonical), 'Only the literal reviewed revision and tree may occupy the source pointer');
  assert.equal(row.blob, createHash('sha1').update('blob ' + canonical.length + '\0').update(canonical).digest('hex'));
 } else {
  assert.equal(row.blob, reviewed.blob, 'Native postimage must equal the reviewed raw Git file: ' + row.file);
 }
}

function economicParentProvenance(file, expected) {
 const previous = PREDECESSOR_NATIVE_INPUTS.files.find(row => row.file === file);
 const deed = DEED_NATIVE_INPUTS.files.find(row => row.file === file);
 assert(!previous || deed, 'Existing B35 native input is missing from Deed admission: ' + file);
 let deedProvenance = null;
 if (previous && deed && changedPin(previous, deed)) {
  const sourcePin = DEED_ALLOCATION_SOURCE_DOMAINS[file];
  assert(sourcePin, 'No unreviewed Deed change to an existing native input: ' + file);
  assert.equal(deed.mode, sourcePin.currentMode); assert.equal(deed.blob, sourcePin.currentBlob);
  assert.equal(deed.sha256, sourcePin.currentSha256);
  assert.equal(previous.mode, sourcePin.baselineMode); assert.equal(previous.blob, sourcePin.baselineBlob);
  assert.equal(previous.sha256, sourcePin.baselineSha256);
  deedProvenance = Object.freeze({ file, current: deed, predecessor: previous,
   predecessorRevision: PREDECESSOR_NATIVE_INPUTS.authoredRevision, relation: 'exact-reviewed-deed-source-provenance-only',
   nativeAdmission: false, priorResultsTransferred: false });
 }
 if (!deed || !changedPin(deed, expected)) return deedProvenance;
 const transition = combinedEconomicDeedPin.nativeFiles[file];
 assert(transition, 'No unreviewed economic change to an existing Deed native input: ' + file);
 for (const key of ['mode', 'blob', 'sha256']) {
  assert.equal(transition.baseline[key], deed[key], 'Economic native predecessor: ' + file);
  assert.equal(transition.current[key], expected[key], 'Economic native input: ' + file);
 }
 return Object.freeze({ file, current: expected, predecessor: deed, predecessorRevision: DEED_NATIVE_INPUTS.authoredRevision,
  relation: 'exact-reviewed-economic-deed-source-provenance-only', deedProvenance, nativeAdmission: false, priorResultsTransferred: false });
}

export function assertEconomicReleaseNativeDefinition(declaration) {
 assert.deepEqual([declaration.reviewedNativeRevision, declaration.reviewedNativeTree], [reviewedRevision, reviewedTree]);
 git('merge-base', '--is-ancestor', reviewedRevision, declaration.authoredRevision);
 const current = rows(declaration.files);
 for (const descriptor of descriptors) {
  const archived = current.get(descriptor.file);
  assert(archived, 'Accepted native descriptors are ordinary mandatory inputs: ' + descriptor.file);
  assert.equal(archived.sha256, descriptor.sha256);
  const original = descriptor.accepted + ':' + (descriptor.original ?? descriptor.file);
  assert.equal(archived.blob, git('rev-parse', original).toString().trim());
  assert.equal(archived.sha256, digest(git('show', original)));
 }
 assertBusinessDeskCombinedNativeDefinition();
 assert.equal(digest(JSON.stringify(combinedEconomicDeedPin)), '782b41ced211d4e7caad40dbd61b486aeb6933db9ef9f9041b5b4c7fc35f7617');
 assert.equal(economic.deedNativeMetadataSha256, descriptors[2].sha256);
 assert.equal(economic.economicNativeSourceSha256, digest(JSON.stringify(combinedEconomicDeedPin.nativeFiles)));
 const archivedChanges = DEED_NATIVE_INPUTS.files.filter(row => {
  const after = economicRows.get(row.file); assert(after, 'Missing archived economic input: ' + row.file);
  return changedPin(row, after);
 }).map(row => row.file).sort();
 assert.deepEqual(archivedChanges, Object.keys(combinedEconomicDeedPin.nativeFiles).sort());
 for (const file of archivedChanges) economicParentProvenance(file, economicRows.get(file));
 for (const file of new Set([...economicRows.keys(), ...deskRows.keys(), anchorFile])) {
  assert(current.has(file), 'Every accepted parent input must remain present: ' + file);
 }
 for (const row of declaration.files) assertReviewedNativePin(row);
}

export function economicReleaseNativeProvenance(file, expected) {
 const sealed = active.files?.find(row => row.file === file);
 assert(sealed && Object.isFrozen(sealed) && sealed === expected, 'Only the exact immutable current native row may receive provenance');
 assertReviewedNativePin(sealed);
 const before = b35Rows.get(file), deskPin = deskRows.get(file), economicPin = economicRows.get(file);
 const deskProvenance = before && deskPin ? businessDeskCombinedNativeProvenance(file, before, deskPin) : null;
 const economicProvenance = economicPin ? economicParentProvenance(file, economicPin) : null;
 const deskChanged = deskPin && changedPin(deskPin, expected);
 const economicChanged = economicPin && changedPin(economicPin, expected);
 if (!deskChanged && !economicChanged && !(deskProvenance && economicProvenance)) return deskProvenance ?? economicProvenance;
 const predecessor = deskChanged ? deskPin : economicChanged ? economicPin : deskProvenance.predecessor;
 const predecessorRevision = deskChanged ? desk.authoredRevision : economicChanged ? economic.authoredRevision : deskProvenance.predecessorRevision;
 return Object.freeze({file, current: expected, predecessor, predecessorRevision,
  deskParent: deskPin ?? null, deskProvenance, economicParent: economicPin ?? null, economicProvenance,
  relation: 'exact-reviewed-economic-business-desk-native-provenance-only', nativeAdmission: false, priorResultsTransferred: false});
}
