// Admission to execute the unchanged native proofs on actual current source. No historical inverses.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { parse } from 'acorn';
import { ENTERPRISE_NATIVE_UX_INPUTS, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 } from './enterprise-native-ux-inputs.js';
export { ENTERPRISE_NATIVE_UX_INPUTS };
export const ENTERPRISE_UX_METADATA = 'tools/enterprise-native-ux-inputs.js';
export const ENTERPRISE_UX_SUPPORT = Object.freeze(['tools/enterprise-native-ux.js', 'tools/enterprise-native-ux-seal.js', 'test/lib/enterprise-ux-native-guard.js', 'test/ux-source-compatibility.js', 'test/lib/ux-native-reader-source-compatibility.js', 'tools/ux-director-reader-source-seal.js', 'tools/ux-workflow-bound-source-seal.js', 'tools/ux-phase2-upgrade-bound-source-seal.js', 'tools/ux-suites-gate-source-seal.js', 'tools/sale-source-seal.js', 'test/sale-source-compatibility.js', 'tools/generate-economy-social-proof-receipt-source-transfer.js', 'tools/generate-economy-social-proof-receipt-safety-source-transfer.js']);
export const ENTERPRISE_UX_ASSETS = Object.freeze([
 ...['feedback', 'progression', 'social', 'navigation', 'workspace', 'world', 'tactics', 'investigation', 'coordination', 'feel', 'tools', 'identity', 'story', 'community'].flatMap(name => ['public/ux-' + name + '.js', ...(name === 'workspace' ? [] : ['public/ux-' + name + '.css'])]),
 'public/sale.html',
 ...['docks', 'neon', 'foundry', 'brick', 'canal', 'cathedral'].map(district => 'public/art/nft/deed-' + district + '.jpg'),
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
 fields(declaration, ['version', 'status', 'phase', 'authoredRevision', 'predecessorRevision', 'uxRevision', 'legacyRevision', 'legacyDefinitionSha256', 'legacyInventorySha256', 'files', 'replacements', 'legacyAdditionReplacements', 'additions']);
 assert.equal(declaration.version, 2); assert.equal(declaration.phase, 'ACTUAL_ENTERPRISE_UX_NATIVE_INPUTS');
 assert.equal(declaration.predecessorRevision, 'c6247976ff71e8d4c103ebd1498c2d373217d077'); assert.equal(declaration.uxRevision, '940df6a1efbe4ddcd8301cd138d5643dbe48a0bc'); assert.match(declaration.authoredRevision, /^[a-f0-9]{40}$/);
 assert.equal(declaration.legacyRevision, legacy.revision); assert.equal(declaration.legacyDefinitionSha256, digest(JSON.stringify(legacy))); assert.equal(declaration.legacyInventorySha256, digest(JSON.stringify(legacyFiles)));
 assert(Object.isFrozen(declaration) && Object.isFrozen(declaration.files) && Object.isFrozen(declaration.replacements) && Object.isFrozen(declaration.legacyAdditionReplacements) && Object.isFrozen(declaration.additions));
 assert.equal(new Set(declaration.files.map(row => row.file)).size, declaration.files.length);
 assert.deepEqual(declaration.files.slice(0, legacyFiles.length).map(row => row.file), legacyFiles, 'Complete original ordered native inventory retained');
 const current = new Map(); for (const row of declaration.files) { pin(row); assert.notEqual(row.file, ENTERPRISE_UX_METADATA, 'Only unavoidable manifest self-reference is separately captured'); current.set(row.file, row); }
 const extra = declaration.files.slice(legacyFiles.length); assert.deepEqual(extra.map(row => row.file), extra.map(row => row.file).sort()); assert.deepEqual(declaration.additions, extra);
 for (const file of [...ENTERPRISE_UX_SUPPORT, ...ENTERPRISE_UX_ASSETS]) assert(current.has(file), 'Required actual UX/native support file: ' + file);
 const seen = new Set(), order = new Map(legacyFiles.map((file, index) => [file, index]));
 const transitions = (rows, legacyAddition) => { let prior = -1; for (const row of rows) { assert(row && Object.isFrozen(row)); fields(row, ['file', 'before', 'after']); assert(legacyFiles.includes(row.file) && !seen.has(row.file)); seen.add(row.file); assert(order.get(row.file) > prior, 'Native replacements remain in inventory order'); prior = order.get(row.file); pin(row.before); pin(row.after); assert.equal(row.before.file, row.file); assert.equal(row.after.file, row.file); assert.deepEqual(row.after, current.get(row.file)); assert(changedPin(row.before, row.after), 'Replacement must change the exact baseline pin'); if (legacyAddition) { const baseline = legacy.additions.find(entry => entry.file === row.file); assert(baseline, 'Legacy-addition replacement requires its sealed legacy pin'); assert.deepEqual(row.before, baseline, 'Legacy-addition replacement starts at the exact sealed legacy pin'); } } };
 transitions(declaration.replacements, false); transitions(declaration.legacyAdditionReplacements, true);
 return declaration;
}
export function assertEnterpriseUxTrackedInput(file, current, authored, bytes, declaration = ENTERPRISE_NATIVE_UX_INPUTS) {
 assert.equal(declaration, ENTERPRISE_NATIVE_UX_INPUTS, 'Caller cannot substitute a native declaration');
 const expected = declaration.files.find(row => row.file === file); assert(expected, 'No undeclared current UX native input: ' + file);
 assert(Buffer.isBuffer(bytes)); assert(current && authored && current.type === 'blob' && authored.type === 'blob');
 assert.equal(current.mode, expected.mode); assert.equal(authored.mode, expected.mode); assert.equal(current.blob, expected.blob, 'Current native source differs from actual authored input'); assert.equal(authored.blob, expected.blob, 'Native pin is not actual authored Git');
 assert.equal(digest(bytes), expected.sha256, 'Whole actual native source changed'); assert.equal(blob(bytes), expected.blob, 'Actual native Git bytes changed');
}
