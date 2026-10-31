// Generate only actual-current native input metadata from an explicit authored commit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ENTERPRISE_NATIVE_FILES } from './enterprise-native.js';
import { ENTERPRISE_NATIVE_RELEASE_INPUTS } from './enterprise-native-inputs.js';
import { ENTERPRISE_UX_METADATA, ENTERPRISE_UX_PREDECESSOR_METADATA, ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, ENTERPRISE_UX_QUALIFIED_METADATA, ENTERPRISE_UX_QUALIFIED_METADATA_SHA256, enterpriseUxClosure, enterpriseUxMetadataBytes, enterpriseUxReplacementPlan } from './enterprise-native-ux.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as predecessorNativeInputs } from './enterprise-native-ux-b35-inputs.js';
import { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';
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
record(revision, ENTERPRISE_UX_METADATA); // This sole self-reference is captured at actual execution.
const inventory = enterpriseUxClosure(ENTERPRISE_NATIVE_FILES, read), files = inventory.map(file => record(revision, file));
const predecessorPin = (file) => { const before = record(predecessorRevision, file, true); if (before !== null) return before; const legacy = legacyAdditions.get(file); assert(legacy, 'Only a sealed legacy addition may be absent from the UX predecessor: ' + file); assert.deepEqual(record(ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, file), legacy, 'Legacy-addition baseline matches its exact sealed Git bytes'); return null; };
const plan = enterpriseUxReplacementPlan(ENTERPRISE_NATIVE_FILES, ENTERPRISE_NATIVE_RELEASE_INPUTS, files, predecessorPin);
assert.equal(sha(read(ENTERPRISE_UX_PREDECESSOR_METADATA)), ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, 'Never reseal a rewritten predecessor native manifest');
assert.equal(sha(read(ENTERPRISE_UX_QUALIFIED_METADATA)), ENTERPRISE_UX_QUALIFIED_METADATA_SHA256, 'Never reseal a rewritten qualified UX manifest');
const value = { version: 3, status: 'SEALED', phase: 'ACTUAL_ENTERPRISE_DEED_NATIVE_INPUTS', authoredRevision: revision, predecessorRevision, uxRevision,
 nativePredecessorRevision: predecessorNativeInputs.authoredRevision,
 nativePredecessorMetadataSha256: sha(read(ENTERPRISE_UX_PREDECESSOR_METADATA)),
 deedSourceDefinitionSha256: sha(JSON.stringify(DEED_ALLOCATION_SOURCE_DOMAINS)),
 legacyRevision: ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, legacyDefinitionSha256: sha(JSON.stringify(ENTERPRISE_NATIVE_RELEASE_INPUTS)), legacyInventorySha256: sha(JSON.stringify(ENTERPRISE_NATIVE_FILES)), files, replacements: plan.replacements, legacyAdditionReplacements: plan.legacyAdditionReplacements, additions: files.slice(ENTERPRISE_NATIVE_FILES.length) };
fs.writeFileSync(new URL('../' + ENTERPRISE_UX_METADATA, import.meta.url), enterpriseUxMetadataBytes(value));
console.log(JSON.stringify({ authoredRevision: revision, actualInputs: files.length, replacements: plan.replacements.length, legacyAdditionReplacements: plan.legacyAdditionReplacements.length, additions: value.additions.length, onlySelfReference: ENTERPRISE_UX_METADATA, nativeResultsTransferred: false }));
