// Seal only the new actual-current native declaration, after all authored source is committed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildQuestingNativeDefinition, questingNativeMetadataBytes, QUESTING_NATIVE_METADATA } from './enterprise-native-questing.js';
assert.equal(process.argv.length, 3, 'Usage: node tools/enterprise-native-questing-seal.js <clean-authored-commit>');
const revision = process.argv[2]; assert.match(revision || '', /^[a-f0-9]{40}$/);
const value = buildQuestingNativeDefinition(revision);
fs.writeFileSync(new URL('../' + QUESTING_NATIVE_METADATA, import.meta.url), questingNativeMetadataBytes(value));
console.log(JSON.stringify({ authoredRevision: revision, actualInputs: value.files.length, replacements: value.replacements.length,
  additions: value.additions.length, onlySelfReference: QUESTING_NATIVE_METADATA, nativeResultsTransferred: false, nativeExecution: false }));
