// Source/control proofs only; no PostgreSQL imports, connections, or native-result transfer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
import { assertUxNativeDirectorGuards } from './ux-native-director-guard.js';
await assertUxNativeDirectorGuards();
import { ENTERPRISE_NATIVE_UX_INPUTS, ENTERPRISE_UX_METADATA, ENTERPRISE_UX_SUPPORT, ENTERPRISE_UX_ASSETS, assertEnterpriseUxInputDefinition, assertEnterpriseUxTrackedInput, assertEnterpriseUxMetadataBytes, assertEnterpriseUxReplacementPlan, enterpriseUxReplacementPlan, enterpriseUxMetadataBytes, enterpriseUxClosure, enterpriseUxImports } from '../../tools/enterprise-native-ux.js';
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
export function assertEnterpriseUxNativeGuards(legacyFiles, legacy) {
 let negatives = 0;
 const reject = run => { assert.throws(run); negatives++; };
 const pin = ENTERPRISE_NATIVE_UX_INPUTS;
 const fixturePin = (file, blobDigit, shaDigit, mode = '100644') => Object.freeze({ file, mode, blob: blobDigit.repeat(40), sha256: shaDigit.repeat(64) });
 const fixtureFiles = ['src/present-changed.js', 'src/present-unchanged.js', 'src/absent-changed.js', 'src/absent-unchanged.js'];
 const presentBefore = fixturePin(fixtureFiles[0], '1', '2'), presentAfter = fixturePin(fixtureFiles[0], '3', '4'), presentSame = fixturePin(fixtureFiles[1], '5', '6');
 const absentBefore = fixturePin(fixtureFiles[2], '7', '8'), absentAfter = fixturePin(fixtureFiles[2], '9', 'a'), absentSame = fixturePin(fixtureFiles[3], 'b', 'c'), alternateLegacy = fixturePin(fixtureFiles[0], 'd', 'e');
 const fixtureLegacy = Object.freeze({ additions: Object.freeze([alternateLegacy, absentBefore, absentSame]) }), fixtureCurrent = Object.freeze([presentAfter, presentSame, absentAfter, absentSame]);
 const fixturePredecessors = new Map([[fixtureFiles[0], presentBefore], [fixtureFiles[1], presentSame]]), fixturePredecessor = file => fixturePredecessors.get(file) || null;
 const fixturePlan = enterpriseUxReplacementPlan(fixtureFiles, fixtureLegacy, fixtureCurrent, fixturePredecessor);
 assert.deepEqual(fixturePlan.replacements, [Object.freeze({ file: fixtureFiles[0], before: presentBefore, after: presentAfter })]);
 assert.deepEqual(fixturePlan.legacyAdditionReplacements, [Object.freeze({ file: fixtureFiles[2], before: absentBefore, after: absentAfter })]);
 assert.equal(fixturePlan.replacements[0].before, presentBefore, 'A real predecessor wins over a legacy-addition pin for the same file');
 const fixtureDeclaration = Object.freeze({ replacements: fixturePlan.replacements, legacyAdditionReplacements: fixturePlan.legacyAdditionReplacements });
 assertEnterpriseUxReplacementPlan(fixtureFiles, fixtureLegacy, fixtureCurrent, fixturePredecessor, fixtureDeclaration);
 for (const declaration of [
  { replacements: [], legacyAdditionReplacements: fixturePlan.legacyAdditionReplacements },
  { replacements: fixturePlan.replacements, legacyAdditionReplacements: [] },
  { replacements: [...fixturePlan.replacements, ...fixturePlan.legacyAdditionReplacements], legacyAdditionReplacements: [] },
  { replacements: fixturePlan.replacements, legacyAdditionReplacements: [...fixturePlan.legacyAdditionReplacements, fixturePlan.legacyAdditionReplacements[0]] },
  { replacements: fixturePlan.replacements, legacyAdditionReplacements: [{ ...fixturePlan.legacyAdditionReplacements[0], before: fixturePin(fixtureFiles[2], '0', '8') }] },
  { replacements: fixturePlan.replacements, legacyAdditionReplacements: [{ ...fixturePlan.legacyAdditionReplacements[0], before: fixturePin(fixtureFiles[2], '7', '0') }] },
  { replacements: fixturePlan.replacements, legacyAdditionReplacements: [{ ...fixturePlan.legacyAdditionReplacements[0], before: fixturePin(fixtureFiles[2], '7', '8', '100755') }] },
  { replacements: fixturePlan.replacements, legacyAdditionReplacements: [{ ...fixturePlan.legacyAdditionReplacements[0], file: fixtureFiles[3] }] },
  { replacements: fixturePlan.replacements, legacyAdditionReplacements: [{ ...fixturePlan.legacyAdditionReplacements[0], after: fixturePin(fixtureFiles[2], '0', 'a') }] },
  { replacements: fixturePlan.replacements, legacyAdditionReplacements: [...fixturePlan.legacyAdditionReplacements, { file: fixtureFiles[3], before: absentSame, after: absentSame }] }
 ]) reject(() => assertEnterpriseUxReplacementPlan(fixtureFiles, fixtureLegacy, fixtureCurrent, fixturePredecessor, declaration));
 reject(() => enterpriseUxReplacementPlan(fixtureFiles, Object.freeze({ additions: Object.freeze([alternateLegacy, absentSame]) }), fixtureCurrent, fixturePredecessor));
 reject(() => enterpriseUxReplacementPlan(fixtureFiles, fixtureLegacy, fixtureCurrent, file => file === fixtureFiles[1] ? null : fixturePredecessor(file)));
 reject(() => enterpriseUxReplacementPlan(['../outside.js'], Object.freeze({ additions: Object.freeze([fixturePin('../outside.js', '1', '2')]) }), Object.freeze([fixturePin('../outside.js', '3', '4')]), () => null));
 reject(() => enterpriseUxReplacementPlan(fixtureFiles, fixtureLegacy, fixtureCurrent, () => undefined));
 if (pin.status === 'UNSEALED') reject(() => assertEnterpriseUxInputDefinition(legacyFiles, legacy));
 else {
  assert.equal(assertEnterpriseUxInputDefinition(legacyFiles, legacy), pin);
  for (const mutate of [p => p.version = 1, p => p.status = 'UNSEALED', p => p.authoredRevision = '0'.repeat(40), p => p.predecessorRevision = '1'.repeat(40), p => p.legacyDefinitionSha256 = '2'.repeat(64), p => p.files.shift(), p => p.files.push(p.files[0]), p => p.files[0].blob = '3'.repeat(40), p => p.additions.length = 0, p => p.replacements.length = 0, p => p.legacyAdditionReplacements.length = 0, p => p.extraMetadataExemption = 'src/server.js']) {
   const changed = structuredClone(pin); mutate(changed); reject(() => assertEnterpriseUxInputDefinition(legacyFiles, legacy, changed));
  }
  assert.equal(pin.version, 3); assert.equal(pin.phase, 'ACTUAL_ENTERPRISE_DEED_NATIVE_INPUTS');
  assert.equal(pin.files.length, legacyFiles.length + pin.additions.length);
  assert.equal(pin.legacyAdditionReplacements.length, 4);
  assert(pin.files.some(row => row.file === 'tools/enterprise-native-ux-inputs.js'), 'The old native manifest is an ordinary pinned input');
  assert(pin.files.some(row => row.file === 'src/deedbenefits.js'), 'The actual new runtime benefit dependency is in the closed native capture');
  assert.equal(ENTERPRISE_UX_METADATA, 'tools/enterprise-native-deed-inputs.js', 'Only the fresh successor manifest is self-referential');
  const requiredLegacyReplacements = ['src/accountdaily.js', 'src/socialproof.js', 'tools/economy-hardening-source-transfer.js', 'tools/economy-release-tail-source-transfer.js'];
  assert.deepEqual(pin.legacyAdditionReplacements.map(row => row.file), requiredLegacyReplacements);
  const tree = revision => new Map(git('ls-tree', '-r', '-z', revision).toString().split('\0').filter(Boolean).map(line => { const index = line.indexOf('\t'), [mode, type, blob] = line.slice(0, index).split(' '); return [line.slice(index + 1), { mode, type, blob }]; }));
  const predecessor = tree(pin.predecessorRevision), legacyTree = tree(pin.legacyRevision), legacyAdditions = new Map(legacy.additions.map(row => [row.file, row]));
  const predecessorPin = (file, after) => { const before = predecessor.get(file); if (before) return Object.freeze({ file, mode: before.mode, blob: before.blob, sha256: before.blob === after.blob ? after.sha256 : digest(git('show', pin.predecessorRevision + ':' + file)) }); const legacyPin = legacyAdditions.get(file), actual = legacyTree.get(file); assert(legacyPin && actual?.type === 'blob'); assert.equal(actual.mode, legacyPin.mode); assert.equal(actual.blob, legacyPin.blob); assert.equal(digest(git('show', pin.legacyRevision + ':' + file)), legacyPin.sha256); return null; };
  assertEnterpriseUxReplacementPlan(legacyFiles, legacy, pin.files, predecessorPin, pin);
  for (const file of requiredLegacyReplacements) { const row = pin.legacyAdditionReplacements.find(entry => entry.file === file), before = legacyAdditions.get(file), after = pin.files.find(entry => entry.file === file); assert.equal(git('ls-tree', pin.predecessorRevision, '--', file).length, 0); assert.deepEqual(row.before, before); assert.deepEqual(row.after, after); }
  const first = pin.files[0], canonical = git('show', pin.authoredRevision + ':' + first.file), record = { type: 'blob', mode: first.mode, blob: first.blob };
  const provenance = assertEnterpriseUxTrackedInput(first.file, record, record, canonical);
  assert(provenance && Object.isFrozen(provenance));
  assert.equal(provenance.current.blob, record.blob, 'Provenance retains the actual current Git identity');
  assert.equal(provenance.current.sha256, digest(canonical));
  assert.notEqual(provenance.predecessor.blob, record.blob);
  assert.equal(provenance.nativeAdmission, false, 'Historical provenance cannot grant native admission');
  assert.equal(provenance.priorResultsTransferred, false);
  const historical = git('show', provenance.predecessorRevision + ':' + first.file);
  const historicalRecord = { type: 'blob', mode: provenance.predecessor.mode, blob: provenance.predecessor.blob };
  reject(() => assertEnterpriseUxTrackedInput(first.file, historicalRecord, historicalRecord, historical),
    'Historical bytes cannot replace the fresh current-native input');
  for (const [current, authored, bytes] of [[{ ...record, blob: '0'.repeat(40) }, record, canonical], [record, { ...record, blob: '1'.repeat(40) }, canonical], [{ ...record, mode: '120000' }, record, canonical], [record, record, Buffer.concat([canonical, Buffer.from('\n')])], [record, record, canonical.subarray(1)], [record, record, canonical.toString('utf8')]]) reject(() => assertEnterpriseUxTrackedInput(first.file, current, authored, bytes));
  reject(() => assertEnterpriseUxTrackedInput('../outside.js', record, record, canonical));
  reject(() => assertEnterpriseUxTrackedInput(first.file, record, record, canonical, structuredClone(pin)));
  reject(() => { pin.files[0].sha256 = '4'.repeat(64); });
  const metadata = enterpriseUxMetadataBytes(pin); assertEnterpriseUxMetadataBytes(metadata);
  reject(() => assertEnterpriseUxMetadataBytes(Buffer.concat([metadata, Buffer.from('\n// executable drift\n')])));
  reject(() => assertEnterpriseUxMetadataBytes(Buffer.from(metadata.toString('utf8').replace('Object.freeze(value)', 'value'))));
 }
 reject(() => assertEnterpriseUxInputDefinition(legacyFiles, legacy, Object.freeze({ ...pin })));
 const imports = enterpriseUxImports('src/main.js', "import './one.js';export { item } from './two.js';const more=import('./three.js');const local=require('./four.js');");
 assert.deepEqual(imports, ['src/four.js', 'src/one.js', 'src/three.js', 'src/two.js']);
 reject(() => enterpriseUxImports('src/main.js', "import '../../outside.js';"));
 const fixtures = new Map([...ENTERPRISE_UX_SUPPORT, ...ENTERPRISE_UX_ASSETS].map(file => [file, Buffer.from('// actual fixture\n')]));
 fixtures.set('src/main.js', Buffer.from("import './new-runtime.js';\n")); fixtures.set('src/new-runtime.js', Buffer.from('// actual dependency\n'));
 const closure = enterpriseUxClosure(['src/main.js'], file => { assert(fixtures.has(file), 'Unavailable committed import must refuse'); return fixtures.get(file); });
 assert(closure.includes('src/new-runtime.js')); assert.deepEqual(closure.slice(0, 1), ['src/main.js']); assert(!closure.includes(ENTERPRISE_UX_METADATA));
 fixtures.delete('src/new-runtime.js'); reject(() => enterpriseUxClosure(['src/main.js'], file => { assert(fixtures.has(file)); return fixtures.get(file); }));
 const current = lf(fs.readFileSync('tools/enterprise-native.js', 'utf8')), previous = git('show', 'c6247976ff71e8d4c103ebd1498c2d373217d077:tools/enterprise-native.js').toString('utf8');
 const functions = source => new Map(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.map(item => item.type === 'ExportNamedDeclaration' ? item.declaration : item).filter(item => item?.type === 'FunctionDeclaration').map(item => [item.id.name, source.slice(item.start, item.end)]));
 const before = functions(previous), after = functions(current);
 for (const name of ['assertEnterpriseNativeMode', 'assertEnterpriseInventory', 'assertEnterpriseNativeTrackedBytes', 'assertEnterpriseInputDefinition', 'assertEnterpriseCombinedInputDefinition', 'assertEnterpriseCombinedTrackedInput', 'assertEnterpriseBackend', 'enterpriseChildEnv', 'assertEnterpriseResults', 'assertEnterpriseCleanup', 'run']) { assert(before.has(name)); assert.equal(after.get(name), before.get(name), 'Existing native guard/workload remains byte-exact: ' + name); }
 const capture = after.get('captureEnterpriseSource');
 assert(capture.includes('assertEnterpriseUxInputDefinition(ENTERPRISE_NATIVE_FILES,successor)'));
 assert(capture.includes('assertEnterpriseUxTrackedInput(f,tracked,authored.get(f),canonical,ux)'));
 assert(capture.includes('if(provenance)sourceProvenance[f]=provenance') && capture.includes('nativeInputProvenance:sourceProvenance'),
  'Current physical input identity and historical source provenance are captured separately');
 assert(!/HistoricalInput|SourceBaseline|qualifyUxSource/.test(capture), 'Native capture never reconstructs a historical source');
 const nativeInputGuard = lf(fs.readFileSync('tools/enterprise-native-ux.js', 'utf8'));
 assert(!/assertDeedAllocationSourceTransfer|deedAllocationHistoricalInput|baselineText/.test(nativeInputGuard),
  'Actual-current native admission and provenance never reconstruct inverse historical source text');
 assert(capture.includes('f===ENTERPRISE_UX_METADATA') && !capture.includes("f!=='tools/enterprise-native-inputs.js'"), 'Exactly the new self-reference is unpinnable; old metadata is pinned');
 assert(capture.includes('assertEnterpriseUxReplacementPlan(ENTERPRISE_NATIVE_FILES,successor,ux.files,predecessorPin,ux)') && capture.includes('uxLegacyAdditionReplacements:replacementPlan.legacyAdditionReplacements.map'), 'UX integration recomputes and records both complete replacement categories');
 console.log(JSON.stringify({ phase: 'CURRENT_UX_NATIVE_ADMISSION_GUARDS', status: pin.status, refusals: negatives, unchangedWorkloadCases: 16, originalGuardsUnchanged: true, nativeExecution: false, priorResultsTransferred: false }));
}
