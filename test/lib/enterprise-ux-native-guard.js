// Source/control proofs only; no PostgreSQL imports, connections, or native-result transfer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
import { ENTERPRISE_NATIVE_UX_INPUTS, ENTERPRISE_UX_METADATA, ENTERPRISE_UX_SUPPORT, ENTERPRISE_UX_ASSETS, assertEnterpriseUxInputDefinition, assertEnterpriseUxTrackedInput, assertEnterpriseUxMetadataBytes, enterpriseUxMetadataBytes, enterpriseUxClosure, enterpriseUxImports } from '../../tools/enterprise-native-ux.js';
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const lf = text => text.replaceAll('\r\n', '\n');
export function assertEnterpriseUxNativeGuards(legacyFiles, legacy) {
 let negatives = 0;
 const reject = run => { assert.throws(run); negatives++; };
 const pin = ENTERPRISE_NATIVE_UX_INPUTS;
 if (pin.status === 'UNSEALED') reject(() => assertEnterpriseUxInputDefinition(legacyFiles, legacy));
 else {
  assert.equal(assertEnterpriseUxInputDefinition(legacyFiles, legacy), pin);
  for (const mutate of [p => p.status = 'UNSEALED', p => p.authoredRevision = '0'.repeat(40), p => p.predecessorRevision = '1'.repeat(40), p => p.legacyDefinitionSha256 = '2'.repeat(64), p => p.files.shift(), p => p.files.push(p.files[0]), p => p.files[0].blob = '3'.repeat(40), p => p.additions.length = 0, p => p.replacements.length = 0, p => p.extraMetadataExemption = 'src/server.js']) {
   const changed = structuredClone(pin); mutate(changed); reject(() => assertEnterpriseUxInputDefinition(legacyFiles, legacy, changed));
  }
  const first = pin.files[0], canonical = git('show', pin.authoredRevision + ':' + first.file), record = { type: 'blob', mode: first.mode, blob: first.blob };
  assertEnterpriseUxTrackedInput(first.file, record, record, canonical);
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
 assert(!/HistoricalInput|SourceBaseline|qualifyUxSource/.test(capture), 'Native capture never reconstructs a historical source');
 assert(capture.includes('f===ENTERPRISE_UX_METADATA') && !capture.includes("f!=='tools/enterprise-native-inputs.js'"), 'Exactly the new self-reference is unpinnable; old metadata is pinned');
 console.log(JSON.stringify({ phase: 'CURRENT_UX_NATIVE_ADMISSION_GUARDS', status: pin.status, refusals: negatives, unchangedWorkloadCases: 16, originalGuardsUnchanged: true, nativeExecution: false, priorResultsTransferred: false }));
}
