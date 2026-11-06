// Admission executes unchanged native proofs on exact current source. Historical provenance never admits bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { ENTERPRISE_NATIVE_UX_INPUTS, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 } from './enterprise-native-contract-release-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as PREDECESSOR_NATIVE_INPUTS,
 ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as PREDECESSOR_NATIVE_DEFINITION_SHA256 } from './enterprise-native-ux-b35-inputs.js';
import { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';
import { CONTRACT_RELEASE_METADATA, CONTRACT_RELEASE_PREDECESSOR_METADATA,
 assertContractReleaseNativeDefinition, contractReleaseNativeProvenance } from './contract-release-native-provenance.js';
import { BUSINESS_DESK_COMBINED_NATIVE_PARENTS } from './businessdesk-combined-native-parents.js';
// Refuse ambient checkout manifests before the native parent can connect or launch children.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(new URL('./enterprise-native.js', import.meta.url))) {
 for (const key of Object.keys(process.env)) assert(!/^INVENTORY_BOND_MANIFEST_(?:PATH|SHA256)$/i.test(key), 'Inventory bond manifest forbidden during native qualification: ' + key);
}
export { ENTERPRISE_NATIVE_UX_INPUTS };
export const ENTERPRISE_UX_METADATA = CONTRACT_RELEASE_METADATA;
export const ENTERPRISE_UX_CONTRACT_PREDECESSOR_METADATA = CONTRACT_RELEASE_PREDECESSOR_METADATA;
export const ENTERPRISE_UX_PREDECESSOR_METADATA = 'tools/enterprise-native-ux-b35-inputs.js';
export const ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256 = '70db907a20352f433aec965c5cd1bdaa05ac7fb2c159b3c132538fc7d714789e';
export const ENTERPRISE_UX_QUALIFIED_METADATA = 'tools/enterprise-native-ux-inputs.js';
export const ENTERPRISE_UX_QUALIFIED_METADATA_SHA256 = 'b37b8de9a428f2e23a43c33d69393785fc6b2e7b728750950ab4ad177c5c4e68';
export const ENTERPRISE_UX_BUSINESS_PREDECESSOR_METADATA = 'tools/businessdesk-deed-native-inputs.js';
export const ENTERPRISE_UX_BUSINESS_PREDECESSOR_METADATA_SHA256 = '489be592435800a0d760592006327c624a0a043c15c059c858b9b3c5457755ff';
export const ENTERPRISE_UX_SUPPORT = Object.freeze([
 "test/ci-deed-recovery-source.js",
 "tools/generate-ci-deed-recovery-source.js",
 "tools/enterprise-native-ux-b35-inputs.js",
 "tools/enterprise-native-ux-inputs.js",
 "tools/enterprise-native-ux.js",
 "tools/enterprise-native-ux-seal.js",
 "test/lib/enterprise-ux-native-guard.js",
 "test/ux-source-compatibility.js",
 "test/lib/ux-native-reader-source-compatibility.js",
 "tools/ux-director-reader-source-seal.js",
 "tools/ux-workflow-bound-source-seal.js",
 "tools/ux-phase2-upgrade-bound-source-seal.js",
 "tools/ux-suites-gate-source-seal.js",
 "tools/sale-source-seal.js",
 "test/sale-source-compatibility.js",
 "tools/generate-economy-social-proof-receipt-source-transfer.js",
 "tools/generate-economy-social-proof-receipt-safety-source-transfer.js",
 "tools/generate-economy-social-proof-cutover-source-transfer.js",
 "tools/generate-economy-bank-interest-source-transfer.js",
 "tools/pgquery.js",
 "test/social-receipt-postgres.js",
 "test/db-boot-lock-postgres.js",
 "tools/businessdesk-deed-native-inputs.js",
 "test/businessdesk.js",
 "test/businessdesk-api.js",
 "test/business-control-desk-loop.js",
 "test/business-control-desk-browser.js",
 "test/businessdesk-source-compatibility.js",
 "test/businessdesk-native-provenance.js",
 "tools/businessdesk-native-provenance.js",
 "test/businessdesk-consent-browser.js",
 "tools/generate-businessdesk-source-transfer.js",
 ".github/workflows/economy-hardening.yml",
 "tools/generate-economy-monitor-source-transfer.js",
 "test/economy-monitor-source-compatibility.js",
 "test/economy-monitor.js",
 "test/economy-composition.js",
 "test/economy-composition-restart.js",
 "tools/generate-age-eligibility-source-transfer.js",
 "test/age-eligibility-source-compatibility.js",
 "test/age.js",
 "test/legal-security.js",
 "tools/economy-deed-merge-source-data.js",
 "tools/economy-deed-merge-source-compatibility.js",
 "tools/generate-economy-deed-merge-source.js",
 "test/economy-deed-merge-source-compatibility.js",
 "tools/noir-ui-source-data.js",
 "tools/noir-ui-source-transfer.js",
 "tools/generate-noir-ui-source-transfer.js",
 "test/noir-ui-source-compatibility.js",
 "test/ux-expanded-browser.js",
 "tools/businessdesk-combined-source-data.js",
 "tools/businessdesk-combined-source-transfer.js",
 "tools/generate-businessdesk-combined-source.js",
 "test/businessdesk-combined-source-compatibility.js",
 "tools/businessdesk-desk-parent-native-inputs.js",
 "tools/businessdesk-monitor-parent-native-inputs.js",
 "tools/businessdesk-wiki-parent-native-inputs.js",
 "tools/businessdesk-combined-native-parents.js",
 "tools/businessdesk-combined-native-data.js",
 "tools/businessdesk-combined-native-provenance.js",
 "tools/generate-businessdesk-combined-native.js",
 "test/businessdesk-combined-native-provenance.js",
 "test/launch-invites-browser.js",
 "test/wallet-connect-browser.js",
 "tools/mobile.js",
 "tools/public-ui.js",
 "tools/enterprise-native-deed-inputs.js",
 "tools/contract-release-source-data.js",
 "tools/contract-release-source-format.js",
 "tools/contract-release-source-transfer.js",
 "tools/contract-release-native-provenance.js",
 "tools/generate-contract-release-source-transfer.js",
 "test/contract-release-source-compatibility.js",
 "tools/generate-native-eth-source-transfer.js",
 "test/native-eth-source-transfer.js",
 "tools/native-eth-source-transfer.json",
 "src/data/market-v2-eth-abis.json",
 "tools/generate-current-economic-terms-source-transfer.js",
 "tools/generate-combined-economic-deed-source-transfer.js",
 "test/economy-ux-merge-source-compatibility.js",
 "test/inventory-bond-checkout.js"
]);
export const ENTERPRISE_UX_ASSETS = Object.freeze([
 "public/ux-feedback.js",
 "public/ux-feedback.css",
 "public/ux-progression.js",
 "public/ux-progression.css",
 "public/ux-social.js",
 "public/ux-social.css",
 "public/ux-navigation.js",
 "public/ux-navigation.css",
 "public/ux-workspace.js",
 "public/ux-world.js",
 "public/ux-world.css",
 "public/ux-tactics.js",
 "public/ux-tactics.css",
 "public/ux-investigation.js",
 "public/ux-investigation.css",
 "public/ux-coordination.js",
 "public/ux-coordination.css",
 "public/ux-feel.js",
 "public/ux-feel.css",
 "public/ux-tools.js",
 "public/ux-tools.css",
 "public/ux-identity.js",
 "public/ux-identity.css",
 "public/ux-story.js",
 "public/ux-story.css",
 "public/ux-community.js",
 "public/ux-community.css",
 "public/sale.html",
 "public/inventory-bond-client.js",
 "public/business-control-desk.js",
 "public/business-control-desk.css",
 "public/art/nft/deed-docks.jpg",
 "public/art/nft/deed-neon.jpg",
 "public/art/nft/deed-foundry.jpg",
 "public/art/nft/deed-brick.jpg",
 "public/art/nft/deed-canal.jpg",
 "public/art/nft/deed-cathedral.jpg",
 "public/eth-staking.js"
]);
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blob = bytes => crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
export function enterpriseUxMetadataBytes(value) {
 return Buffer.from('// Actual-current native input admission only; prior native results do not transfer.\nconst freeze = value => { if (value && typeof value === \'object\') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\nexport const ENTERPRISE_NATIVE_UX_INPUTS = freeze(' + JSON.stringify(value, null, 2) + ');\nexport const ENTERPRISE_NATIVE_UX_INPUTS_SHA256 = ' + JSON.stringify(digest(JSON.stringify(value))) + ';\n');
}
export function assertEnterpriseUxMetadataBytes(bytes, declaration = ENTERPRISE_NATIVE_UX_INPUTS) {
 assert.equal(declaration, ENTERPRISE_NATIVE_UX_INPUTS); assert(Buffer.isBuffer(bytes));
 assert(bytes.equals(enterpriseUxMetadataBytes(declaration)), 'The sole manifest self-reference must be the exact generated declaration, with no executable additions');
}
const fields = (value, keys) => assert.deepEqual(Object.keys(value).sort(), keys.slice().sort(), 'Closed native UX record');
const canonicalPath = value => typeof value === 'string' && !value.includes('\\') && !value.includes(':') && !value.includes('\0') && !path.posix.isAbsolute(value) && value.split('/').every(piece => piece && !['.', '..', '.git'].includes(piece));
function pin(row) { assert(row && Object.isFrozen(row)); fields(row, ['file', 'mode', 'blob', 'sha256']); assert(canonicalPath(row.file)); assert(['100644', '100755'].includes(row.mode)); assert.match(row.blob, /^[a-f0-9]{40}$/); assert.match(row.sha256, /^[a-f0-9]{64}$/); }
const changedPin = (before, after) => before.mode !== after.mode || before.blob !== after.blob || before.sha256 !== after.sha256;
const replacement = (file, before, after) => Object.freeze({ file, before, after });
export function enterpriseUxReplacementPlan(legacyFiles, legacy, files, predecessorPin) {
 assert(Array.isArray(legacyFiles) && new Set(legacyFiles).size === legacyFiles.length); assert(legacy && Array.isArray(legacy.additions)); assert(Array.isArray(files) && files.length >= legacyFiles.length); assert.equal(typeof predecessorPin, 'function');
 const legacyAdditions = new Map(); for (const row of legacy.additions) { pin(row); assert(legacyFiles.includes(row.file), 'Legacy addition remains in the native inventory: ' + row.file); assert(!legacyAdditions.has(row.file), 'Duplicate legacy addition: ' + row.file); legacyAdditions.set(row.file, row); }
 const current = files.slice(0, legacyFiles.length); assert.deepEqual(current.map(row => row.file), legacyFiles, 'Complete original ordered native inventory retained');
 const replacements = [], legacyAdditionReplacements = [];
 for (const after of current) {
  pin(after); const before = predecessorPin(after.file, after); assert(before === null || before && Object.isFrozen(before), 'Predecessor pin callback returns a frozen pin or null');
  if (before !== null) { pin(before); assert.equal(before.file, after.file); if (changedPin(before, after)) replacements.push(replacement(after.file, before, after)); continue; }
  const legacyBefore = legacyAdditions.get(after.file); assert(legacyBefore, 'Only a sealed legacy addition may be absent from the UX predecessor: ' + after.file);
  if (changedPin(legacyBefore, after)) legacyAdditionReplacements.push(replacement(after.file, legacyBefore, after));
 }
 return Object.freeze({ replacements: Object.freeze(replacements), legacyAdditionReplacements: Object.freeze(legacyAdditionReplacements) });
}
export function assertEnterpriseUxReplacementPlan(legacyFiles, legacy, files, predecessorPin, declaration) {
 assert(declaration && Array.isArray(declaration.replacements) && Array.isArray(declaration.legacyAdditionReplacements));
 const plan = enterpriseUxReplacementPlan(legacyFiles, legacy, files, predecessorPin);
 assert.deepEqual(declaration.replacements, plan.replacements, 'Complete predecessor-based UX replacement plan');
 assert.deepEqual(declaration.legacyAdditionReplacements, plan.legacyAdditionReplacements, 'Complete legacy-addition UX replacement plan');
 return plan;
}
export function enterpriseUxImports(file, source) {
 const result = new Set(), ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
 const add = value => { if (typeof value !== 'string' || !value.startsWith('.')) return; const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), value)); assert(canonicalPath(target), 'Relative native import stays in repository'); result.add(target); };
 const visit = node => {
  if (!node || typeof node !== 'object') return;
  if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)) add(node.source?.value);
  if (node.type === 'ImportExpression' && node.source?.type === 'Literal') add(node.source.value);
  if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'require' && node.arguments.length === 1 && node.arguments[0]?.type === 'Literal') add(node.arguments[0].value);
  for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
 };
 visit(ast); return [...result].sort();
}
export function enterpriseUxClosure(legacyFiles, read) {
 assert(Array.isArray(legacyFiles) && new Set(legacyFiles).size === legacyFiles.length);
 const reached = new Set([...legacyFiles, ...ENTERPRISE_UX_SUPPORT, ...ENTERPRISE_UX_ASSETS]), queue = [...reached];
 for (let index = 0; index < queue.length; index++) {
  const file = queue[index]; assert(canonicalPath(file));
  if (file === ENTERPRISE_UX_METADATA) continue;
  const bytes = read(file); assert(Buffer.isBuffer(bytes), 'Actual committed native input bytes required');
  if (!/\.(?:js|mjs|cjs)$/.test(file)) continue;
  const source = bytes.toString('utf8'); assert(Buffer.from(source).equals(bytes), 'Lossless actual native JavaScript');
  for (const dependency of enterpriseUxImports(file, source)) if (!reached.has(dependency)) { reached.add(dependency); queue.push(dependency); }
 }
 reached.delete(ENTERPRISE_UX_METADATA);
 return [...legacyFiles, ...[...reached].filter(file => !legacyFiles.includes(file)).sort()];
}
export function assertEnterpriseUxInputDefinition(legacyFiles, legacy, declaration = ENTERPRISE_NATIVE_UX_INPUTS) {
 assert.equal(declaration, ENTERPRISE_NATIVE_UX_INPUTS, 'Only the actual frozen current-native declaration');
 assert.equal(declaration.status, 'SEALED', 'Current UX native inputs remain UNSEALED; no prior native results transfer');
 assert.equal(digest(JSON.stringify(declaration)), ENTERPRISE_NATIVE_UX_INPUTS_SHA256, 'Whole current-native declaration changed');
 fields(declaration, ['version', 'status', 'phase', 'authoredRevision', 'predecessorRevision', 'uxRevision', 'legacyRevision', 'legacyDefinitionSha256', 'legacyInventorySha256', 'nativePredecessorRevision', 'nativePredecessorMetadataSha256', 'deedSourceDefinitionSha256', 'contractPredecessorRevision', 'contractPredecessorMetadataSha256', 'contractSourceDefinitionSha256', 'contractSourceRevision', 'contractBaseRevision', 'reviewedContractRevision', 'reviewedUiRevision', 'files', 'replacements', 'legacyAdditionReplacements', 'additions']);
 assert.equal(declaration.version, 4); assert.equal(declaration.phase, 'ACTUAL_ENTERPRISE_CONTRACT_RELEASE_NATIVE_INPUTS');
 assert.equal(PREDECESSOR_NATIVE_INPUTS.status, 'SEALED');
 assert.equal(digest(JSON.stringify(PREDECESSOR_NATIVE_INPUTS)), PREDECESSOR_NATIVE_DEFINITION_SHA256, 'Immutable predecessor native declaration');
 assert.equal(declaration.nativePredecessorRevision, PREDECESSOR_NATIVE_INPUTS.authoredRevision);
 assert.equal(declaration.nativePredecessorMetadataSha256, ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, 'Original native manifest bytes remain immutable');
 assert.equal(declaration.deedSourceDefinitionSha256, digest(JSON.stringify(DEED_ALLOCATION_SOURCE_DOMAINS)), 'Exact reviewed Deed source layer, not a phase-only grant');
 assert.equal(declaration.predecessorRevision, 'c6247976ff71e8d4c103ebd1498c2d373217d077'); assert.equal(declaration.uxRevision, '940df6a1efbe4ddcd8301cd138d5643dbe48a0bc'); assert.match(declaration.authoredRevision, /^[a-f0-9]{40}$/);
 assert.equal(declaration.legacyRevision, legacy.revision); assert.equal(declaration.legacyDefinitionSha256, digest(JSON.stringify(legacy))); assert.equal(declaration.legacyInventorySha256, digest(JSON.stringify(legacyFiles)));
 assert(Object.isFrozen(declaration) && Object.isFrozen(declaration.files) && Object.isFrozen(declaration.replacements) && Object.isFrozen(declaration.legacyAdditionReplacements) && Object.isFrozen(declaration.additions));
 assert.equal(new Set(declaration.files.map(row => row.file)).size, declaration.files.length);
 assert.deepEqual(declaration.files.slice(0, legacyFiles.length).map(row => row.file), legacyFiles, 'Complete original ordered native inventory retained');
 const current = new Map(); for (const row of declaration.files) { pin(row); assert.notEqual(row.file, ENTERPRISE_UX_METADATA, 'Only unavoidable manifest self-reference is separately captured'); current.set(row.file, row); }
 assert.equal(current.get(ENTERPRISE_UX_PREDECESSOR_METADATA)?.sha256, declaration.nativePredecessorMetadataSha256, 'The old native manifest is an exact ordinary input, never another self-reference');
 assert.equal(current.get(ENTERPRISE_UX_QUALIFIED_METADATA)?.sha256, ENTERPRISE_UX_QUALIFIED_METADATA_SHA256, 'The qualified UX manifest remains an exact ordinary input, never native admission');
 assert.equal(current.get(ENTERPRISE_UX_BUSINESS_PREDECESSOR_METADATA)?.sha256, ENTERPRISE_UX_BUSINESS_PREDECESSOR_METADATA_SHA256, 'The frozen Deed record is an exact ordinary input, never another self-reference');
 assert.equal(current.get(ENTERPRISE_UX_CONTRACT_PREDECESSOR_METADATA)?.sha256, declaration.contractPredecessorMetadataSha256, 'The accepted Desk record is an exact ordinary input, never another self-reference');
 assertContractReleaseNativeDefinition(declaration);
 for (const parent of Object.values(BUSINESS_DESK_COMBINED_NATIVE_PARENTS.profiles)) {
  const actual = current.get(parent.archiveFile);
  assert(actual, 'Every exact frozen parent descriptor is an ordinary input');
  assert.equal(actual.mode, parent.original.mode); assert.equal(actual.blob, parent.original.blob);
  assert.equal(actual.sha256, parent.original.rawSha256, 'Never admit a rewritten parent archive');
 }
 const extra = declaration.files.slice(legacyFiles.length); assert.deepEqual(extra.map(row => row.file), extra.map(row => row.file).sort()); assert.deepEqual(declaration.additions, extra);
 for (const file of [...ENTERPRISE_UX_SUPPORT, ...ENTERPRISE_UX_ASSETS]) assert(current.has(file), 'Required actual UX/native support file: ' + file);
 const seen = new Set(), order = new Map(legacyFiles.map((file, index) => [file, index]));
 const transitions = (rows, legacyAddition) => { let prior = -1; for (const row of rows) { assert(row && Object.isFrozen(row)); fields(row, ['file', 'before', 'after']); assert(legacyFiles.includes(row.file) && !seen.has(row.file)); seen.add(row.file); assert(order.get(row.file) > prior, 'Native replacements remain in inventory order'); prior = order.get(row.file); pin(row.before); pin(row.after); assert.equal(row.before.file, row.file); assert.equal(row.after.file, row.file); assert.deepEqual(row.after, current.get(row.file)); assert(changedPin(row.before, row.after), 'Replacement must change the exact baseline pin'); if (legacyAddition) { const baseline = legacy.additions.find(entry => entry.file === row.file); assert(baseline, 'Legacy-addition replacement requires its sealed legacy pin'); assert.deepEqual(row.before, baseline, 'Legacy-addition replacement starts at the exact sealed legacy pin'); } } };
 transitions(declaration.replacements, false); transitions(declaration.legacyAdditionReplacements, true);
 return declaration;
}
export function assertEnterpriseUxTrackedInput(file, current, authored, bytes, declaration = ENTERPRISE_NATIVE_UX_INPUTS) {
 assert.equal(declaration, ENTERPRISE_NATIVE_UX_INPUTS, 'Caller cannot substitute a native declaration');
 assert.equal(declaration.status, 'SEALED', 'Unsealed current inputs cannot grant native admission');
 const expected = declaration.files.find(row => row.file === file); assert(expected, 'No undeclared current UX native input: ' + file);
 assert(Buffer.isBuffer(bytes)); assert(current && authored && current.type === 'blob' && authored.type === 'blob');
 assert.equal(current.mode, expected.mode); assert.equal(authored.mode, expected.mode); assert.equal(current.blob, expected.blob, 'Current native source differs from actual authored input'); assert.equal(authored.blob, expected.blob, 'Native pin is not actual authored Git');
 assert.equal(digest(bytes), expected.sha256, 'Whole actual native source changed'); assert.equal(blob(bytes), expected.blob, 'Actual native Git bytes changed');
 // These exact current bytes have already been admitted independently of any historical relation.
 // The relation below records provenance only; native execution and its sixteen fresh cases remain mandatory.
 const previous = PREDECESSOR_NATIVE_INPUTS.files.find(row => row.file === file);
 return contractReleaseNativeProvenance(file, previous, expected, declaration);
}
