// Source controls read only immutable Git object sizes; no native proof, server or database starts.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { LAUNCH_ENTERPRISE_SOURCE as source } from '../tools/launch-enterprise-source-data.js';
import { QUESTING_ENTERPRISE_NATIVE_INPUTS as declaration } from '../tools/enterprise-native-questing-inputs.js';
import { assertQuestingEnterpriseTrackedInput, assertQuestingEnterpriseStable } from '../tools/enterprise-native-questing.js';
import { validateLaunchEnterpriseDefinition, assertLaunchEnterpriseCurrentBytes,
  captureLaunchEnterpriseSource, launchEnterpriseDeclaredInput, nativeGarageEnterprisePredecessor,
  assertNativeGarageEnterpriseClosure, planLaunchEnterpriseDeclaredChunks, decodeLaunchEnterpriseDeclaredChunk,
  LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES, LAUNCH_ENTERPRISE_BATCH_MAX_BYTES } from '../tools/native-garage-enterprise-source.js';

let controls = 0, refusals = 0;
const copy = () => structuredClone(source);
const refuse = edit => { const value = copy(); edit(value); assert.throws(() => validateLaunchEnterpriseDefinition(value)); refusals++; };
const before = JSON.stringify(declaration);
assert.deepEqual(validateLaunchEnterpriseDefinition(source), {
  sourceOnly: true, currentSourceQualified: false, nativeAdmission: false, priorResultsTransferred: false,
}); controls++;
assert.equal(source.replacements.length, 28); assert.equal(source.authored.length, 2);
assert.equal(source.additions.length, 5); assert.equal(source.support.length, 1);
assert.equal(source.replacements.length + source.authored.length + source.additions.length + source.support.length, 36);
for (const file of ['tools/deed-quest-source-transfer.js', 'test/director-migration.js', 'test/enterprise-release-phase2-migration-catalog.js',
  'test/task-puzzle-native-catalog-guard.js', 'test/task-puzzle-native-integration-guard.js',
  'tools/questing-enterprise-catalog.js', 'tools/questing-ux-release-phase2-native-catalog.js'])
  assert(source.replacements.some(row => row.file === file));
assert.equal(source.currentClosure.length, declaration.files.length + 7);
assert(source.currentClosure.includes('tools/deed-primary-native-catalog.js'));
assert(source.currentClosure.includes('test/deed-primary-native-catalog-guard.js'));
assert(source.additions.some(row => row.file === 'test/deed-primary-native-catalog-guard.js'));
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
for (const capture of [{}, Object.freeze({ revision: '0'.repeat(40), files: Object.freeze({}) }),
  JSON.parse(JSON.stringify({ revision: '0'.repeat(40), files: {} }))]) {
  assert.throws(() => assertQuestingEnterpriseStable(capture), /Genuine current questing source capture required/);
  assert.throws(() => assertQuestingEnterpriseTrackedInput('schema.sql', {}, {}, Buffer.alloc(0), declaration, capture),
    /Genuine current questing source capture required/); refusals += 2;
}
assert.throws(() => assertQuestingEnterpriseTrackedInput('schema.sql', {}, {}, Buffer.alloc(0),
  Object.freeze({ ...declaration }), {}), /Caller cannot substitute/); refusals++;
assert.equal(JSON.stringify(declaration), before); controls++;
console.log(JSON.stringify({ phase: 'LAUNCH_ENTERPRISE_SOURCE_PURE_CONTROLS', controls, refusals,
  oldDeclaredInputs: declaration.files.length, sourceOnly: true, currentSourceQualified: false,
  nativeAdmission: false, priorResultsTransferred: false, servicesStarted: false }));

// BATCH CONTROLS BEGIN
// Synthetic size fixtures plan boundaries without allocating large payloads or
// granting source admission. Content controls execute the real chunk decoder.
let batchControls = 0, batchRefusals = 0;
const payloads = [Buffer.from('first\n'), Buffer.from([0, 255, 10, 7]), Buffer.from('first\n')];
const rows = payloads.map((bytes, index) => ({ file: `fixture/${index}.bin`, mode: '100644',
  blob: createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes])).digest('hex'),
  sha256: createHash('sha256').update(bytes).digest('hex') }));
const metadata = sizes => Buffer.from(rows.map((row, index) => `${row.blob} blob ${sizes[index]}\n`).join(''));
const info = metadata(payloads.map(bytes => bytes.length));
const plan = planLaunchEnterpriseDeclaredChunks(rows, info);
assert.equal(plan.chunks.length, 1); assert.deepEqual(plan.entries.map(row => row.file), rows.map(row => row.file));
assert(Object.isFrozen(plan) && Object.isFrozen(plan.chunks[0].entries)); batchControls++;
assert.equal(rows[0].blob, rows[2].blob, 'Distinct declared paths may share an immutable blob'); batchControls++;
const frame = Buffer.concat(rows.flatMap((row, index) => [Buffer.from(`${row.blob} blob ${payloads[index].length}\n`), payloads[index], Buffer.from('\n')]));
const decoded = decodeLaunchEnterpriseDeclaredChunk(frame, plan.chunks[0]);
assert.deepEqual([...decoded.keys()], rows.map(row => row.file));
for (const [index, row] of rows.entries()) assert(decoded.get(row.file).equals(payloads[index])); batchControls++;
const changedFrame = Buffer.from(frame), owned = decodeLaunchEnterpriseDeclaredChunk(changedFrame, plan.chunks[0]);
changedFrame[changedFrame.indexOf(10) + 1] ^= 1;
assert(owned.get(rows[0].file).equals(payloads[0]), 'Decoded cached bytes own their backing'); batchControls++;
const boundary = planLaunchEnterpriseDeclaredChunks(rows,
  metadata([LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES - 56, 1, LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES + 1]));
assert.equal(boundary.chunks.length, 3); assert.equal(boundary.chunks[0].framedBytes, LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES);
assert(boundary.chunks[2].framedBytes > LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES && boundary.chunks[2].entries.length === 1);
assert(boundary.chunks.every(chunk => chunk.framedBytes <= LAUNCH_ENTERPRISE_BATCH_MAX_BYTES)); batchControls++;
const atCap = planLaunchEnterpriseDeclaredChunks(rows, metadata([LAUNCH_ENTERPRISE_BATCH_MAX_BYTES - 57, 1, 1]));
assert.equal(atCap.chunks[0].framedBytes, LAUNCH_ENTERPRISE_BATCH_MAX_BYTES);
assert.equal(atCap.chunks[0].entries.length, 1); batchControls++;
assert.equal(JSON.stringify(planLaunchEnterpriseDeclaredChunks(rows, info)), JSON.stringify(plan)); batchControls++;
for (const bad of [info.subarray(0, -1), Buffer.concat([info, info.subarray(0, info.indexOf(10) + 1)]),
  Buffer.from(info.toString().split('\n').slice(1).join('\n')),
  Buffer.from(info.toString().replace(rows[0].blob, '0'.repeat(40))),
  Buffer.from(info.toString().replace(' blob ', ' tree ')),
  Buffer.from(info.toString().replace(' blob 6\n', ' blob 06\n')),
  Buffer.from(info.toString().replace(' blob 6\n', ' blob -1\n')),
  Buffer.from(info.toString().replace(' blob 6\n', ' blob 9007199254740992\n')),
  metadata([LAUNCH_ENTERPRISE_BATCH_MAX_BYTES, 1, 1]), Buffer.concat([Buffer.from([255]), info.subarray(1)])]) {
  assert.throws(() => planLaunchEnterpriseDeclaredChunks(rows, bad)); batchRefusals++;
}
for (const badRows of [[rows[0], rows[0], rows[2]], [rows[1], rows[0], rows[2]],
  [{ ...rows[0], file: '../unreviewed' }, rows[1], rows[2]],
  [{ ...rows[0], extra: true }, rows[1], rows[2]]]) {
  assert.throws(() => planLaunchEnterpriseDeclaredChunks(badRows, info)); batchRefusals++;
}
const wrongContent = Buffer.from(frame); wrongContent[wrongContent.indexOf(10) + 1] ^= 1;
const wrongEnd = Buffer.from(frame); wrongEnd[wrongEnd.length - 1] = 0;
for (const bad of [frame.subarray(0, -1), Buffer.concat([frame, Buffer.from('x')]), wrongContent, wrongEnd,
  Buffer.from(frame.toString('latin1').replace(rows[0].blob, '0'.repeat(40)), 'latin1'),
  Buffer.from(frame.toString('latin1').replace(' blob ', ' tree '), 'latin1'),
  Buffer.from(frame.toString('latin1').replace(' blob 6\n', ' blob 7\n'), 'latin1')]) {
  assert.throws(() => decodeLaunchEnterpriseDeclaredChunk(bad, plan.chunks[0])); batchRefusals++;
}
const chunk = plan.chunks[0];
for (const bad of [{ ...chunk, entries: chunk.entries.slice(1) },
  { ...chunk, entries: [chunk.entries[0], { ...chunk.entries[1], file: chunk.entries[0].file }, chunk.entries[2]] },
  { ...chunk, entries: [{ ...chunk.entries[0], sha256: '0'.repeat(64) }, ...chunk.entries.slice(1)] },
  { ...chunk, framedBytes: chunk.framedBytes - 1 }, { ...chunk, extra: true }]) {
  assert.throws(() => decodeLaunchEnterpriseDeclaredChunk(frame, bad)); batchRefusals++;
}
console.log(JSON.stringify({ phase: 'LAUNCH_ENTERPRISE_IMMUTABLE_BATCH_SOURCE_CONTROLS', controls: batchControls,
  refusals: batchRefusals, targetBytes: LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES, unchangedProcessCap: LAUNCH_ENTERPRISE_BATCH_MAX_BYTES,
  sourceOnly: true, currentSourceQualified: false, nativeAdmission: false, priorResultsTransferred: false, servicesStarted: false }));
// BATCH CONTROLS END
