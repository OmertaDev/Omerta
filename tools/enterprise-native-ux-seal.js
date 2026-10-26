// Generate only actual-current native input metadata from an explicit authored commit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ENTERPRISE_NATIVE_FILES } from './enterprise-native.js';
import { ENTERPRISE_NATIVE_RELEASE_INPUTS } from './enterprise-native-inputs.js';
import { ENTERPRISE_UX_METADATA, enterpriseUxClosure, enterpriseUxMetadataBytes } from './enterprise-native-ux.js';
const revision = process.argv[2], predecessorRevision = 'c6247976ff71e8d4c103ebd1498c2d373217d077', uxRevision = '940df6a1efbe4ddcd8301cd138d5643dbe48a0bc';
assert.equal(process.argv.length, 3, 'Usage: node tools/enterprise-native-ux-seal.js <authored-commit>'); assert.match(revision || '', /^[a-f0-9]{40}$/);
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
git('merge-base', '--is-ancestor', predecessorRevision, revision); git('merge-base', '--is-ancestor', uxRevision, revision); git('merge-base', '--is-ancestor', ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, revision);
const read = file => git('show', revision + ':' + file);
const legacyAdditions = new Set(ENTERPRISE_NATIVE_RELEASE_INPUTS.additions.map(row => row.file));
const record = (rev, file, allowLegacyAbsence = false) => {
 const line = git('ls-tree', '-z', rev, '--', file).toString('utf8');
 if (!line) { assert(allowLegacyAbsence && legacyAdditions.has(file), 'Only a sealed legacy addition may be absent from the UX predecessor: ' + file); return null; }
 const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/); assert(match && match[3] === file, 'Regular committed native input: ' + file); return { file, mode: match[1], blob: match[2], sha256: sha(git('show', rev + ':' + file)) };
};
record(revision, ENTERPRISE_UX_METADATA); // This sole self-reference is captured at actual execution.
const inventory = enterpriseUxClosure(ENTERPRISE_NATIVE_FILES, read), files = inventory.map(file => record(revision, file));
const replacements = files.slice(0, ENTERPRISE_NATIVE_FILES.length).flatMap(after => { const before = record(predecessorRevision, after.file, true); return before === null || before.blob === after.blob && before.mode === after.mode ? [] : [{ file: after.file, before, after }]; });
const value = { version: 1, status: 'SEALED', phase: 'ACTUAL_ENTERPRISE_UX_NATIVE_INPUTS', authoredRevision: revision, predecessorRevision, uxRevision, legacyRevision: ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, legacyDefinitionSha256: sha(JSON.stringify(ENTERPRISE_NATIVE_RELEASE_INPUTS)), legacyInventorySha256: sha(JSON.stringify(ENTERPRISE_NATIVE_FILES)), files, replacements, additions: files.slice(ENTERPRISE_NATIVE_FILES.length) };
fs.writeFileSync(new URL('./enterprise-native-ux-inputs.js', import.meta.url), enterpriseUxMetadataBytes(value));
console.log(JSON.stringify({ authoredRevision: revision, actualInputs: files.length, replacements: replacements.length, additions: value.additions.length, onlySelfReference: ENTERPRISE_UX_METADATA, nativeResultsTransferred: false }));
