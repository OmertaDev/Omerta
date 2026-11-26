// Source controls read only immutable Git object sizes; no native proof, server or database starts.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { LAUNCH_ENTERPRISE_SOURCE as source } from '../tools/launch-enterprise-source-data.js';
import { QUESTING_ENTERPRISE_NATIVE_INPUTS as declaration } from '../tools/enterprise-native-questing-inputs.js';
import { validateLaunchEnterpriseDefinition, assertLaunchEnterpriseCurrentBytes,
  captureLaunchEnterpriseSource, launchEnterpriseDeclaredInput, nativeGarageEnterprisePredecessor,
  assertNativeGarageEnterpriseClosure } from '../tools/native-garage-enterprise-source.js';

let controls = 0, refusals = 0;
const copy = () => structuredClone(source);
const refuse = edit => { const value = copy(); edit(value); assert.throws(() => validateLaunchEnterpriseDefinition(value)); refusals++; };
const before = JSON.stringify(declaration);
assert.deepEqual(validateLaunchEnterpriseDefinition(source), {
  sourceOnly: true, currentSourceQualified: false, nativeAdmission: false, priorResultsTransferred: false,
}); controls++;
assert.equal(source.replacements.length, 20); assert.equal(source.authored.length, 2);
assert.equal(source.currentClosure.length, declaration.files.length + 5);
assert(source.currentClosure.includes('test/lib/phase2-error.js'));
assert(source.currentClosure.includes('tools/launch-enterprise-source-data.js'));
assert(source.currentClosure.includes('tools/launch-integration-source-data.js'));
assert(!source.currentClosure.includes('test/launch-enterprise-source-transfer.js'));
assert(source.support.some(row => row.file === 'test/launch-enterprise-source-transfer.js')); controls++;
for (const edit of [
  value => { value.status = 'UNSEALED'; },
  value => { value.version = '1'; },
  value => { value.reviewedRevision = '0'.repeat(40); },
  value => { value.declarationSha256 = '0'.repeat(64); },
  value => { value.declaredRevision = '0'.repeat(40); },
  value => { value.nativeAdmission = true; },
  value => { value.replacements.pop(); },
  value => { value.replacements.push(value.replacements[0]); },
  value => { value.replacements.reverse(); },
  value => { value.replacements[0].before.sha256 = '0'.repeat(64); },
  value => { value.replacements[0].before.blob = '0'.repeat(40); },
  value => { value.replacements[0].before.bytes += 1; },
  value => { value.authored[0].before.bytes += 1; },
  value => { value.replacements[0].current.mode = '120000'; },
  value => { value.replacements[0].current.bytes = -1; },
  value => { value.replacements[0].current.bytes = Number.MAX_SAFE_INTEGER + 1; },
  value => { value.replacements[0].current.sha256 = 'not-a-sha'; },
  value => { value.replacements[0].current.extra = true; },
  value => { value.authored.pop(); },
  value => { value.additions[0].file = 'src/unreviewed.js'; },
  value => { value.additions.push({ file: 'tools/generated-unreviewed.js', current: value.additions[0].current }); },
  value => { value.generated.pop(); },
  value => { value.generated.push('tools/generated-unreviewed.js'); },
  value => { value.generated[0] = { file: value.generated[0], sha256: '0'.repeat(64) }; },
  value => { value.support[0].file = 'test/unreviewed.js'; },
  value => { value.currentClosure = value.currentClosure.filter(file => file !== 'test/lib/phase2-error.js'); },
  value => { value.currentClosure.push(value.currentClosure[0]); },
  value => { value.currentClosure.push('src/unreviewed.js'); },
  value => { value.currentClosure.reverse(); },
]) refuse(edit);

const bytes = Buffer.from('owned current source\n');
const pin = { mode: '100644', bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  blob: createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes])).digest('hex') };
assertLaunchEnterpriseCurrentBytes(bytes, pin); controls++;
for (const changed of [Buffer.concat([bytes, Buffer.from('x')]), bytes.subarray(1), Buffer.from(bytes.toString().replace('\n', '\r\n')),
  Buffer.from('changed current source\n')]) { assert.throws(() => assertLaunchEnterpriseCurrentBytes(changed, pin)); refusals++; }
for (const changed of [{ ...pin, blob: '0'.repeat(40) }, { ...pin, sha256: '0'.repeat(64) },
  { ...pin, bytes: pin.bytes + 1 }, { ...pin, extra: true }]) {
  assert.throws(() => assertLaunchEnterpriseCurrentBytes(bytes, changed)); refusals++;
}
// Neither a caller-supplied matching tuple nor a made-up capture can authorize
// use of new current bytes under an old native declaration.
const row = source.replacements.find(value => value.file === 'src/chain.js');
assert.throws(() => nativeGarageEnterprisePredecessor(row.file,
  { type: 'blob', mode: row.current.mode, blob: row.current.blob }, bytes, row.before, Object.freeze({ sourceOnly: true })));
assert.throws(() => launchEnterpriseDeclaredInput('src/chain.js', {}));
assert.throws(() => assertNativeGarageEnterpriseClosure(source.currentClosure, declaration.files.map(value => value.file),
  declaration.files.map(value => value.file), {}));
assert.throws(() => captureLaunchEnterpriseSource({})); refusals += 4;
assert.equal(JSON.stringify(declaration), before); controls++;
console.log(JSON.stringify({ phase: 'LAUNCH_ENTERPRISE_SOURCE_PURE_CONTROLS', controls, refusals,
  oldDeclaredInputs: declaration.files.length, sourceOnly: true, currentSourceQualified: false,
  nativeAdmission: false, priorResultsTransferred: false, servicesStarted: false }));
