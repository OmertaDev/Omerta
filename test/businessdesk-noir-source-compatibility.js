// Exact combined-source qualification only; no runtime, native execution or release transfer.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BUSINESS_DESK_NOIR_SOURCE, BUSINESS_DESK_NOIR_SOURCE_SHA256 } from '../tools/businessdesk-noir-source-data.js';
import { BUSINESS_DESK_NOIR_SOURCE_FILES, assertBusinessDeskNoirSourceTransfer,
  businessDeskNoirHistoricalInput } from '../tools/businessdesk-noir-source-transfer.js';
import { BUSINESS_DESK_NOIR_NATIVE_FILES, businessDeskNoirNativeProvenance } from '../tools/businessdesk-noir-native-provenance.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as previousNative } from '../tools/enterprise-native-ux-b35-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as currentNative } from '../tools/enterprise-native-deed-inputs.js';
import { assertEnterpriseUxTrackedInput } from '../tools/enterprise-native-ux.js';

assert.deepEqual(process.argv.slice(2), [], 'Bare source-only entrypoint required.');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
});
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
const source = BUSINESS_DESK_NOIR_SOURCE;
const noir = '42d9df7628a30653ff7c8bac203b7bd317dee597';
const business = 'd01c02b67896521ac3651cea827f235197c6d870';
const targets = [
  ['package.json', 'noir', noir],
  ['public/index.html', 'noir', noir],
  ['test/ux-community-browser.js', 'noir', noir],
  ['test/ux-expanded-browser.js', 'noir', noir],
  ['test/deed-allocation-source-compatibility.js', 'business', business],
  ['tools/deed-allocation-source-transfer.js', 'business', business],
];
const phase = 'EXACT_BUSINESS_DESK_NOIR_SOURCE_ONLY';
assert.equal(source.status, 'SEALED'); assert.equal(source.version, 1); assert.equal(source.phase, phase);
assert.equal(source.contextLines, 3);
assert.match(source.revision, /^[a-f0-9]{40}$/); assert.match(source.tree, /^[a-f0-9]{40}$/);
assert.equal(sha(JSON.stringify(source)), BUSINESS_DESK_NOIR_SOURCE_SHA256);
assert(Object.isFrozen(source) && Object.isFrozen(source.files));
assert.deepEqual(BUSINESS_DESK_NOIR_SOURCE_FILES, targets.map(([file]) => file));
assert(Object.isFrozen(BUSINESS_DESK_NOIR_SOURCE_FILES));
assert.deepEqual(source.files.map(row => [row.file, row.targetKind, row.targetRevision]), targets, 'Only the closed reviewed six-file view is admitted.');
assert.equal(git('rev-parse', `${source.revision}^{tree}`).trim(), source.tree);
for (const predecessor of [noir, business]) git('merge-base', '--is-ancestor', predecessor, source.revision);
git('merge-base', '--is-ancestor', source.revision, 'HEAD');

const inverseHunks = diff => {
  const result = []; let hunk;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', target: '' }; result.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.target += line.slice(1) + '\n';
    }
  }
  return result;
};
let positives = 0, refusals = 0, inverseCount = 0;
const refused = (file, input, pin = source) => {
  assert.throws(() => assertBusinessDeskNoirSourceTransfer(file, input, pin), error => error?.code === 'ERR_ASSERTION'); refusals++;
};
for (const [file, targetKind, targetRevision] of targets) {
  const pin = source.files.find(row => row.file === file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert(Object.isFrozen(pin.currentRawSha256));
  assert.equal(pin.mode, '100644'); assert.equal(pin.targetMode, '100644');
  const current = git('show', `${source.revision}:${file}`), target = git('show', `${targetRevision}:${file}`);
  assert.equal(git('ls-tree', source.revision, '--', file).trim(), `${pin.mode} blob ${pin.currentBlob}\t${file}`);
  assert.equal(git('ls-tree', targetRevision, '--', file).trim(), `${pin.targetMode} blob ${pin.targetBlob}\t${file}`);
  assert.equal(current, git('show', pin.currentBlob)); assert.equal(target, git('show', pin.targetBlob));
  assert.equal(sha(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob); assert.equal(Buffer.byteLength(current), pin.currentBytes);
  assert.equal(sha(target), pin.targetSha256); assert.equal(blob(target), pin.targetBlob); assert.equal(Buffer.byteLength(target), pin.targetBytes);
  assert.equal(pin.currentRawSha256.lf, sha(current)); assert.equal(pin.currentRawSha256.crlf, sha(current.replaceAll('\n', '\r\n')));
  assert(current.endsWith('\n') && !current.includes('\r') && current.indexOf('\n') !== current.lastIndexOf('\n'));
  assert.notEqual(current, target); assert(pin.inverses.length > 0);
  assert.deepEqual(pin.inverses, inverseHunks(git('diff', '--no-ext-diff', '--unified=3', targetRevision, source.revision, '--', file)));
  let reconstructed = current, end = -1;
  for (const inverse of pin.inverses) {
    assert.deepEqual(Object.keys(inverse).sort(), ['current', 'target']);
    assert(inverse.current.length); assert.equal(current.split(inverse.current).length, 2, 'The full current inverse context is unique.');
    const at = current.indexOf(inverse.current); assert(at >= end, 'Inverse contexts are ordered and nonoverlapping.'); end = at + inverse.current.length;
    assert.equal(reconstructed.split(inverse.current).length, 2);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.target);
    for (const changed of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current),
      current.replace(inverse.current, () => inverse.target), current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) refused(file, changed);
    assert.throws(() => { inverse.current = 'unreviewed'; }, TypeError); inverseCount++;
  }
  assert.equal(reconstructed, target, 'Every actual inverse reconstructs the complete exact target; partial recovery grants no authority.');
  const physical = fs.readFileSync(file), physicalText = physical.toString('utf8');
  assert(Buffer.from(physicalText).equals(physical), 'Physical input is lossless UTF-8.');
  assert.equal(lf(physicalText), current, 'Current physical bytes match the actual bound source, allowing only uniform line endings.');
  for (const input of [current, current.replaceAll('\n', '\r\n'), physicalText]) {
    const proof = assertBusinessDeskNoirSourceTransfer(file, input);
    assert(Object.isFrozen(proof));
    assert.deepEqual(Object.keys(proof).sort(), ['file', 'targetText', 'targetKind', 'targetRevision', 'sourceRevision', 'sourceOnly', 'runtime', 'native', 'inverseChunks'].sort());
    assert.equal(proof.file, file); assert.equal(proof.targetText, target); assert.equal(proof.targetKind, targetKind);
    assert.equal(proof.targetRevision, targetRevision); assert.equal(proof.sourceRevision, source.revision); assert.equal(proof.inverseChunks, pin.inverses.length);
    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native], [true, false, false]);
    assert.equal(businessDeskNoirHistoricalInput(file, input, targetKind), target);
    assert.deepEqual(businessDeskNoirHistoricalInput(file, Buffer.from(input), targetKind), Buffer.from(target));
    assert.equal(businessDeskNoirHistoricalInput(file, input), targetKind === 'noir' ? target : input, 'The default view cannot silently cross target kinds.');
    for (const wrongKind of ['native', targetKind === 'noir' ? 'business' : 'noir', null, {}]) {
      assert.strictEqual(businessDeskNoirHistoricalInput(file, input, wrongKind), input);
      const raw = Buffer.from(input); assert.strictEqual(businessDeskNoirHistoricalInput(file, raw, wrongKind), raw); refusals += 2;
    }
    positives += 3;
  }
  const altered = [target, current + '\n', current.slice(0, -1), current.slice(1), '\ufeff' + current, current + '\0',
    current.replace(/\S/, '?'), current.replace('\n', '\r\n'), current.replace('\n', '\r'), current + '\ud800', current + '// unreviewed source\n'];
  for (const input of altered) {
    refused(file, input); assert.strictEqual(businessDeskNoirHistoricalInput(file, input, targetKind), input);
    const raw = Buffer.from(input); assert.strictEqual(businessDeskNoirHistoricalInput(file, raw, targetKind), raw);
  }
  for (const input of [Buffer.from(current), null, undefined, 7, {}, []]) refused(file, input);
  for (const pinClone of [{ ...source }, JSON.parse(JSON.stringify(source)), Object.freeze({ ...source, files: source.files }),
    Object.freeze({ ...source, files: source.files.map(row => row.file === file ? { ...row, targetKind: targetKind === 'noir' ? 'business' : 'noir' } : row) })]) refused(file, current, pinClone);
  const invalidUtf8 = Buffer.concat([Buffer.from(current), Buffer.from([0xff])]);
  assert.throws(() => businessDeskNoirHistoricalInput(file, invalidUtf8, targetKind), /Lossless UTF-8|lossless UTF-8/); refusals++;
  assert.throws(() => { pin.currentSha256 = '0'.repeat(64); }, TypeError);
  assert.throws(() => { pin.currentRawSha256.lf = '0'.repeat(64); }, TypeError);
  assert.throws(() => { pin.inverses.push({ current: '', target: '' }); }, TypeError);
}
for (const file of ['__proto__', 'constructor', 'toString', '../public/index.html', 'public/business-control-desk.js', 'unknown', null, undefined, {}, [], 7, Symbol('domain')]) {
  for (const input of ['unreviewed', Buffer.from([0xff, 0, 13]), null, {}]) {
    refused(file, input); assert.strictEqual(businessDeskNoirHistoricalInput(file, input), input);
  }
}
assert.throws(() => { source.files.push({ file: 'unreviewed' }); }, TypeError);
assert.throws(() => { source.revision = '0'.repeat(40); }, TypeError);

// These calls prove only the finite pin relation and its raw-byte refusals.
// The actual native workload must still run on the untransformed current tree.
const nativeFiles = ['package.json', 'public/index.html', 'public/omerta-ui.css', 'public/ux-feedback.js',
  'public/ux-navigation.js', 'public/ux-tactics.js', 'public/ux-world.js',
  'test/deed-allocation-source-compatibility.js', 'tools/deed-allocation-source-transfer.js'];
assert.deepEqual(BUSINESS_DESK_NOIR_NATIVE_FILES, nativeFiles); assert(Object.isFrozen(BUSINESS_DESK_NOIR_NATIVE_FILES));
assert.equal(currentNative.status, 'SEALED'); assert.equal(previousNative.status, 'SEALED');
assert.equal(currentNative.version, 3); assert.equal(currentNative.phase, 'ACTUAL_ENTERPRISE_DEED_NATIVE_INPUTS');
const record = (revision, file) => {
  const line = git('ls-tree', '-z', revision, '--', file);
  const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
  assert(match && match[3] === file, 'Actual regular authored Git input required.');
  return Object.freeze({ type: 'blob', mode: match[1], blob: match[2] });
};
const relation = 'exact-combined-noir-and-deed-source-provenance-only';
let nativeRelations = 0, nativeRefusals = 0, sample;
const nativeRefused = run => { assert.throws(run); nativeRefusals++; };
for (const file of nativeFiles) {
  const previous = previousNative.files.find(row => row.file === file), expected = currentNative.files.find(row => row.file === file);
  assert(expected && Object.isFrozen(expected));
  if (!previous) {
    assert(nativeFiles.indexOf(file) >= 7, 'Only the two declared shared additions lack a B35 predecessor.');
    assert.equal(businessDeskNoirNativeProvenance(file, previous, expected), null, 'An addition never invents an existing-input predecessor pin.');
    continue;
  }
  assert(nativeFiles.indexOf(file) < 7); assert(Object.isFrozen(previous));
  const proof = businessDeskNoirNativeProvenance(file, previous, expected);
  assert(proof && Object.isFrozen(proof) && Object.isFrozen(proof.current));
  assert.deepEqual(Object.keys(proof).sort(), ['file', 'current', 'predecessor', 'predecessorRevision', 'relation', 'nativeAdmission', 'priorResultsTransferred'].sort());
  assert.equal(proof.file, file); assert.strictEqual(proof.predecessor, previous);
  assert.equal(proof.predecessorRevision, previousNative.authoredRevision); assert.equal(proof.relation, relation);
  assert.deepEqual(proof.current, { mode: expected.mode, blob: expected.blob, sha256: expected.sha256 });
  assert.equal(proof.nativeAdmission, false); assert.equal(proof.priorResultsTransferred, false);
  nativeRefused(() => businessDeskNoirNativeProvenance(file, Object.freeze({ ...previous }), expected));
  nativeRefused(() => businessDeskNoirNativeProvenance(file, previous, Object.freeze({ ...expected })));
  nativeRefused(() => businessDeskNoirNativeProvenance(file, Object.freeze({ ...previous, blob: '0'.repeat(40) }), expected));
  nativeRefused(() => businessDeskNoirNativeProvenance(file, previous, Object.freeze({ ...expected, sha256: '0'.repeat(64) })));
  nativeRefused(() => { proof.nativeAdmission = true; }); nativeRefused(() => { proof.current.blob = '0'.repeat(40); });
  const current = record('HEAD', file), authored = record(currentNative.authoredRevision, file);
  const bytes = Buffer.from(git('show', `${currentNative.authoredRevision}:${file}`));
  assert.equal(git('show', `HEAD:${file}`), bytes.toString('utf8'), 'The committed source candidate retains its sealed actual native bytes.');
  assert.equal(sha(bytes), expected.sha256); assert.equal(blob(bytes), expected.blob);
  assert.deepEqual(assertEnterpriseUxTrackedInput(file, current, authored, bytes), proof);
  const otherMode = current.mode === '100644' ? '100755' : '100644';
  for (const [now, anchor, raw] of [
    [current, authored, Buffer.concat([bytes, Buffer.from('\n')])],
    [current, authored, bytes.subarray(1)],
    [current, authored, bytes.toString('utf8')],
    [current, authored, Buffer.from(bytes.toString('utf8').replaceAll('\n', '\r\n'))],
    [{ ...current, mode: otherMode }, authored, bytes],
    [current, { ...authored, mode: otherMode }, bytes],
    [{ ...current, blob: '0'.repeat(40) }, authored, bytes],
    [current, { ...authored, blob: '1'.repeat(40) }, bytes],
    [{ ...current, type: 'tree' }, authored, bytes],
    [current, authored, Buffer.from(git('show', `${previousNative.authoredRevision}:${file}`))],
  ]) nativeRefused(() => assertEnterpriseUxTrackedInput(file, now, anchor, raw));
  nativeRefused(() => assertEnterpriseUxTrackedInput(file, current, authored, bytes, Object.freeze({ ...currentNative })));
  sample ||= { previous, expected }; nativeRelations++;
}
assert.equal(nativeRelations, 7); assert(sample);
for (const unknown of ['unknown', '__proto__', 'constructor', 'toString', '../public/index.html', null, undefined, 1, Symbol('source'),
  Object.freeze({ toString() { throw Error('No coercion'); } })]) assert.equal(businessDeskNoirNativeProvenance(unknown, sample.previous, sample.expected), null);
console.log(JSON.stringify({ phase, source: source.revision, tree: source.tree, targets, inverseHunks: inverseCount,
  positives, refusals, nativeRelations, nativeRefusals, sourceOnly: true, runtime: false, native: false,
  migration: false, financial: false, activation: false, deployment: false }));
