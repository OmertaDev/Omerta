// Generate only actual-current native input metadata from an explicit authored commit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ENTERPRISE_NATIVE_FILES } from './enterprise-native.js';
import { ENTERPRISE_NATIVE_RELEASE_INPUTS } from './enterprise-native-inputs.js';
import { ENTERPRISE_UX_METADATA, ENTERPRISE_UX_BUSINESS_PREDECESSOR_METADATA, ENTERPRISE_UX_BUSINESS_PREDECESSOR_METADATA_SHA256, ENTERPRISE_UX_PREDECESSOR_METADATA, ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, ENTERPRISE_UX_QUALIFIED_METADATA, ENTERPRISE_UX_QUALIFIED_METADATA_SHA256, enterpriseUxClosure, enterpriseUxMetadataBytes, enterpriseUxReplacementPlan } from './enterprise-native-ux.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as predecessorNativeInputs } from './enterprise-native-ux-b35-inputs.js';
import { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';
import { BUSINESS_DESK_COMBINED_SOURCE, BUSINESS_DESK_COMBINED_SOURCE_SHA256 } from './businessdesk-combined-source-data.js';
import { BUSINESS_DESK_COMBINED_NATIVE, BUSINESS_DESK_COMBINED_NATIVE_SHA256 } from './businessdesk-combined-native-data.js';
import { BUSINESS_DESK_COMBINED_NATIVE_PARENTS, BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256 } from './businessdesk-combined-native-parents.js';
import { assertBusinessDeskCombinedNativeParents } from './businessdesk-combined-native-provenance.js';
import { ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256 } from './economy-deed-merge-source-data.js';
import { WIKI_MEDIA_MERGE_SOURCE_SHA256, WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256 } from './wiki-media-source-data.js';
import { NOIR_UI_SOURCE_SHA256 } from './noir-ui-source-data.js';
import { assertEconomicReleaseNativeDefinition } from './economic-release-native-provenance.js';
import { reviewedRevision, reviewedTree } from './economic-release-native-source.js';
const revision = process.argv[2], predecessorRevision = 'c6247976ff71e8d4c103ebd1498c2d373217d077', uxRevision = '940df6a1efbe4ddcd8301cd138d5643dbe48a0bc';
assert.equal(process.argv.length, 3, 'Usage: node tools/enterprise-native-ux-seal.js <authored-commit>'); assert.match(revision || '', /^[a-f0-9]{40}$/);
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
git('merge-base', '--is-ancestor', predecessorRevision, revision); git('merge-base', '--is-ancestor', uxRevision, revision); git('merge-base', '--is-ancestor', ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, revision);
const read = file => git('show', revision + ':' + file);
const legacyAdditions = new Map(ENTERPRISE_NATIVE_RELEASE_INPUTS.additions.map(row => [row.file, row]));
const record = (rev, file, allowAbsence = false) => {
 const line = git('ls-tree', '-z', rev, '--', file).toString('utf8');
 if (!line) { assert(allowAbsence, 'Committed native input required: ' + file); return null; }
 const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/); assert(match && match[3] === file, 'Regular committed native input: ' + file); return Object.freeze({ file, mode: match[1], blob: match[2], sha256: sha(git('show', rev + ':' + file)) });
};
assertBusinessDeskCombinedNativeParents();
for (const parent of Object.values(BUSINESS_DESK_COMBINED_NATIVE_PARENTS.profiles)) {
 git('merge-base', '--is-ancestor', parent.revision, revision);
 assert.equal(git('rev-parse', parent.revision + '^{tree}').toString().trim(), parent.tree,
  'Every accepted parent is its exact reviewed tree');
 const archived = record(revision, parent.archiveFile);
 assert.equal(archived.mode, parent.original.mode); assert.equal(archived.blob, parent.original.blob);
 assert.equal(archived.sha256, parent.original.rawSha256, 'Never reseal a rewritten frozen parent descriptor');
}
for (const catalog of Object.values(BUSINESS_DESK_COMBINED_NATIVE_PARENTS.catalogs)) {
 git('merge-base', '--is-ancestor', catalog.revision, revision);
 const original = record(catalog.revision, catalog.source.file);
 assert.equal(original.mode, catalog.source.mode); assert.equal(original.blob, catalog.source.blob);
 assert.equal(original.sha256, catalog.source.rawSha256, 'Every historical catalog retains its exact committed source anchor');
}
for (const [definition, expected] of [[BUSINESS_DESK_COMBINED_SOURCE, BUSINESS_DESK_COMBINED_SOURCE_SHA256],
 [BUSINESS_DESK_COMBINED_NATIVE, BUSINESS_DESK_COMBINED_NATIVE_SHA256],
 [BUSINESS_DESK_COMBINED_NATIVE_PARENTS, BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256]]) {
 assert.equal(definition.status, 'SEALED'); assert.equal(sha(JSON.stringify(definition)), expected);
}
assert.equal(BUSINESS_DESK_COMBINED_NATIVE.topSourceDefinitionSha256, BUSINESS_DESK_COMBINED_SOURCE_SHA256);
assert.equal(BUSINESS_DESK_COMBINED_NATIVE.parentRegistryDefinitionSha256, BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256);
for (const definition of [BUSINESS_DESK_COMBINED_SOURCE, BUSINESS_DESK_COMBINED_NATIVE]) {
 git('merge-base', '--is-ancestor', definition.sourceRevision, revision);
 assert.equal(git('rev-parse', definition.sourceRevision + '^{tree}').toString().trim(), definition.sourceTree,
  'Every combined comparison/provenance anchor is its exact committed tree');
}
record(revision, ENTERPRISE_UX_METADATA); // This sole self-reference is captured at actual execution.
const inventory = enterpriseUxClosure(ENTERPRISE_NATIVE_FILES, read), files = inventory.map(file => record(revision, file));
const predecessorPin = (file) => { const before = record(predecessorRevision, file, true); if (before !== null) return before; const legacy = legacyAdditions.get(file); assert(legacy, 'Only a sealed legacy addition may be absent from the UX predecessor: ' + file); assert.deepEqual(record(ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, file), legacy, 'Legacy-addition baseline matches its exact sealed Git bytes'); return null; };
const plan = enterpriseUxReplacementPlan(ENTERPRISE_NATIVE_FILES, ENTERPRISE_NATIVE_RELEASE_INPUTS, files, predecessorPin);
assert.equal(sha(read(ENTERPRISE_UX_PREDECESSOR_METADATA)), ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, 'Never reseal a rewritten predecessor native manifest');
assert.equal(sha(read(ENTERPRISE_UX_QUALIFIED_METADATA)), ENTERPRISE_UX_QUALIFIED_METADATA_SHA256, 'Never reseal a rewritten qualified UX manifest');
assert.equal(sha(read(ENTERPRISE_UX_BUSINESS_PREDECESSOR_METADATA)), ENTERPRISE_UX_BUSINESS_PREDECESSOR_METADATA_SHA256, 'Never reseal a rewritten frozen Deed record');
const value = { version: 7, status: 'SEALED', phase: 'ACTUAL_ENTERPRISE_ECONOMIC_BUSINESS_DESK_NATIVE_INPUTS', authoredRevision: revision, predecessorRevision, uxRevision,
 nativePredecessorRevision: predecessorNativeInputs.authoredRevision,
 nativePredecessorMetadataSha256: sha(read(ENTERPRISE_UX_PREDECESSOR_METADATA)),
 deedSourceDefinitionSha256: sha(JSON.stringify(DEED_ALLOCATION_SOURCE_DOMAINS)),
 economyDeedProvenanceDefinitionSha256: ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256,
 wikiMergeSourceDefinitionSha256: WIKI_MEDIA_MERGE_SOURCE_SHA256,
 noirSourceDefinitionSha256: NOIR_UI_SOURCE_SHA256,
 noirMergeSourceDefinitionSha256: WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256,
 combinedSourceDefinitionSha256: BUSINESS_DESK_COMBINED_SOURCE_SHA256,
 combinedNativeDefinitionSha256: BUSINESS_DESK_COMBINED_NATIVE_SHA256,
 reviewedNativeRevision: reviewedRevision, reviewedNativeTree: reviewedTree,
 combinedNativeParentsDefinitionSha256: BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256,
 legacyRevision: ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, legacyDefinitionSha256: sha(JSON.stringify(ENTERPRISE_NATIVE_RELEASE_INPUTS)), legacyInventorySha256: sha(JSON.stringify(ENTERPRISE_NATIVE_FILES)), files, replacements: plan.replacements, legacyAdditionReplacements: plan.legacyAdditionReplacements, additions: files.slice(ENTERPRISE_NATIVE_FILES.length) };
assertEconomicReleaseNativeDefinition(value);
fs.writeFileSync(new URL('../' + ENTERPRISE_UX_METADATA, import.meta.url), enterpriseUxMetadataBytes(value));
console.log(JSON.stringify({ authoredRevision: revision, actualInputs: files.length, replacements: plan.replacements.length, legacyAdditionReplacements: plan.legacyAdditionReplacements.length, additions: value.additions.length, onlySelfReference: ENTERPRISE_UX_METADATA, nativeResultsTransferred: false }));
