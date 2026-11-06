// Exact combined-source qualification only; no runtime, native execution or release transfer.
import { BUSINESS_DESK_COMBINED_SOURCE as combinedSource, BUSINESS_DESK_COMBINED_SOURCE_SHA256 as combinedSourceSha, businessDeskCombinedHistoricalInput } from '../tools/businessdesk-combined-source-transfer.js';
import assert from 'node:assert/strict';
import { integratedEconomicSource, integratedEconomicParentInput } from '../tools/integrated-economic-parent-source.js';
import { ciDeedRecoveryHistoricalInput, ciDeedRecoveryHistoricalEntry } from '../tools/ci-deed-recovery-source-transfer.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BUSINESS_DESK_NOIR_SOURCE, BUSINESS_DESK_NOIR_SOURCE_SHA256 } from '../tools/businessdesk-noir-source-data.js';
import { BUSINESS_DESK_NOIR_SOURCE_FILES, assertBusinessDeskNoirSourceTransfer,
  businessDeskNoirHistoricalInput } from '../tools/businessdesk-noir-source-transfer.js';
import { BUSINESS_DESK_NOIR_NATIVE_FILES } from '../tools/businessdesk-noir-native-provenance.js';
import { businessDeskCombinedNativeProvenance } from '../tools/businessdesk-combined-native-provenance.js';
import { BUSINESS_DESK_COMBINED_NATIVE_PARENTS as nativeParents } from '../tools/businessdesk-combined-native-parents.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as archivedDeskNative } from '../tools/businessdesk-desk-parent-native-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as deedNative } from '../tools/businessdesk-deed-native-inputs.js';
import { NOIR_UI_SOURCE } from '../tools/noir-ui-source-data.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as previousNative } from '../tools/enterprise-native-ux-b35-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as currentNative } from '../tools/enterprise-native-deed-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as activeNative, assertEnterpriseUxTrackedInput } from '../tools/enterprise-native-ux.js';


// This comparison boundary admits actual C6 HEAD, index and physical bytes
// before selecting a separately pinned historical parent. It executes no view.
function readCombinedPhysical(file) {
  assert.equal(combinedSource.status, 'SEALED', 'Bind the actual combined source before historical comparisons');
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(combinedSource)).digest('hex'), combinedSourceSha);
  const authoredEntry = git('ls-tree', integratedEconomicSource.revision, '--', file).trim();
  const match = authoredEntry.match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);
  assert(match && match[3] === file, 'Only an actual regular authored source can be compared');
  assert.equal(ciDeedRecoveryHistoricalEntry(file, git('ls-tree', 'HEAD', '--', file), 'tree').trim(), authoredEntry, 'Actual HEAD mode/blob qualifies before projection');
  assert.equal(ciDeedRecoveryHistoricalEntry(file, git('ls-files', '--stage', '--', file), 'index').trim(), match[1] + ' ' + match[2] + ' 0\t' + file,
    'Actual index mode/blob qualifies before projection');
  const authored = git('show', integratedEconomicSource.revision + ':' + file);
  assert.equal(ciDeedRecoveryHistoricalInput(file, git('show', 'HEAD:' + file)), authored, 'Actual HEAD retains the complete authored source');
  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());
  const raw = ciDeedRecoveryHistoricalInput(file, fs.readFileSync(file)), physical = raw.toString('utf8');
  assert(Buffer.from(physical).equals(raw), 'Lossless actual UTF-8 source only');
  assert(physical === authored || physical === authored.replaceAll('\n', '\r\n'), 'Whole actual LF/CRLF physical source qualifies first');
  const main = integratedEconomicParentInput(file, physical, 'main');
  const parent = git('show', combinedSource.sourceRevision + ':' + file);
  assert(main === parent || main === parent.replaceAll('\n', '\r\n'), 'Exact original combined comparison source: ' + file);
  return main;
}

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
  const actualPhysical = readCombinedPhysical(file);
  const physicalText = businessDeskCombinedHistoricalInput(file, actualPhysical, 'desk');
  assert.equal(lf(physicalText), current, 'The exact Desk parent comparison retains its original whole-source binding.');
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
assert.equal(currentNative.version, 6); assert.equal(currentNative.phase, 'ACTUAL_ENTERPRISE_MONITOR_WIKI_DESK_NATIVE_INPUTS');
assert.equal(archivedDeskNative.status, 'SEALED'); assert.equal(archivedDeskNative.version, 3);
const archivedDeskRows = new Map(archivedDeskNative.files.map(row => [row.file, row]));
const deedRows = new Map(deedNative.files.map(row => [row.file, row]));
const record = (revision, file) => {
  const line = git('ls-tree', '-z', revision, '--', file);
  const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
  assert(match && match[3] === file, 'Actual regular authored Git input required.');
  return Object.freeze({ type: 'blob', mode: match[1], blob: match[2] });
};
const relation = 'exact-reviewed-monitor-wiki-desk-native-pin-provenance-only';
let nativeRelations = 0, nativeRefusals = 0, neutralAdditions = 0, sample;
const refusedDeskParentInputs = [];
const nativeRefused = run => { assert.throws(run); nativeRefusals++; };
for (const file of nativeFiles) {
  const previous = previousNative.files.find(row => row.file === file), expected = currentNative.files.find(row => row.file === file);
  if (!previous) {
    assert(nativeFiles.indexOf(file) >= 7, 'Only the two declared shared additions lack a B35 predecessor.');
    if (expected) assert(Object.isFrozen(expected));
    assert.equal(businessDeskCombinedNativeProvenance(file, previous, expected), null, 'An addition never invents an existing-input predecessor pin.');
    neutralAdditions++; continue;
  }
  assert(expected && Object.isFrozen(expected));
  assert(nativeFiles.indexOf(file) < 7); assert(Object.isFrozen(previous));
  const archivedDesk = archivedDeskRows.get(file), archivedPath = nativeParents.parentPaths.desk.find(row => row.file === file);
  assert(archivedDesk && Object.isFrozen(archivedDesk) && archivedPath, 'Every original Noir case retains its archived Desk path.');
  assert.deepEqual(archivedPath.current, archivedDesk); assert.deepEqual(archivedPath.predecessor, previous);
  const noirAnchor = NOIR_UI_SOURCE.files.find(row => row.file === file); assert(noirAnchor && !noirAnchor.predecessorAbsent);
  const noirEdge = archivedPath.edges.find(edge => edge.kind === 'noir'); assert(noirEdge);
  assert.deepEqual(noirEdge.from, { file, mode: noirAnchor.mode, blob: noirAnchor.currentBlob, sha256: noirAnchor.currentSha256 });
  assert.deepEqual(noirEdge.to, { file, mode: noirAnchor.predecessorMode, blob: noirAnchor.predecessorBlob, sha256: noirAnchor.predecessorSha256 });
  const stage = deedRows.get(file); assert(stage && Object.isFrozen(stage)); assert.deepEqual(noirEdge.to, stage);
  if (nativeFiles.indexOf(file) < 2) {
    const refinement = archivedPath.edges.find(edge => edge.kind === 'desk-noir-combined'); assert(refinement);
    assert.deepEqual(refinement.from, archivedDesk); assert.deepEqual(refinement.to, noirEdge.from);
  } else assert.deepEqual(archivedDesk, noirEdge.from);
  const proof = businessDeskCombinedNativeProvenance(file, previous, expected);
  assert(proof && Object.isFrozen(proof) && Object.isFrozen(proof.current));
  assert.deepEqual(Object.keys(proof).sort(), ['file', 'current', 'predecessor', 'predecessorRevision', 'relation', 'nativeAdmission', 'priorResultsTransferred'].sort());
  assert.equal(proof.file, file); assert.strictEqual(proof.predecessor, previous);
  assert.equal(proof.predecessorRevision, previousNative.authoredRevision); assert.equal(proof.relation, relation);
  assert.deepEqual(proof.current, { mode: expected.mode, blob: expected.blob, sha256: expected.sha256 });
  assert.equal(proof.nativeAdmission, false); assert.equal(proof.priorResultsTransferred, false);
  nativeRefused(() => businessDeskCombinedNativeProvenance(file, Object.freeze({ ...previous }), expected));
  nativeRefused(() => businessDeskCombinedNativeProvenance(file, previous, Object.freeze({ ...expected })));
  nativeRefused(() => businessDeskCombinedNativeProvenance(file, Object.freeze({ ...previous, blob: '0'.repeat(40) }), expected));
  nativeRefused(() => businessDeskCombinedNativeProvenance(file, previous, Object.freeze({ ...expected, sha256: '0'.repeat(64) })));
  nativeRefused(() => { proof.nativeAdmission = true; }); nativeRefused(() => { proof.current.blob = '0'.repeat(40); });
  const current = record('HEAD', file), authored = record(activeNative.authoredRevision, file);
  const parentBytes = Buffer.from(git('show', `${currentNative.authoredRevision}:${file}`));
  const bytes = Buffer.from(git('show', activeNative.authoredRevision + ':' + file));
  assert.equal(git('show', `HEAD:${file}`), bytes.toString('utf8'), 'The committed source candidate retains its sealed actual native bytes.');
  assert.equal(sha(parentBytes), expected.sha256); assert.equal(blob(parentBytes), expected.blob);
  const activeRow = activeNative.files.find(row => row.file === file);
  assert.equal(sha(bytes), activeRow.sha256); assert.equal(blob(bytes), activeRow.blob);
  const admitted = assertEnterpriseUxTrackedInput(file, current, authored, bytes);
  assert.equal(admitted.current.blob, activeRow.blob); assert.deepEqual(admitted.deskProvenance ?? admitted, proof);
  if (activeRow.blob !== expected.blob) {
    assert.throws(() => assertEnterpriseUxTrackedInput(file, current, authored, parentBytes));
    refusedDeskParentInputs.push(file);
  }
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
assert.deepEqual(refusedDeskParentInputs, ['package.json', 'public/index.html']);
assert.equal(nativeRelations, 7); assert.equal(neutralAdditions, 2); assert.equal(nativeRefusals, 119, 'All original Noir refusal categories are retained.'); assert(sample);
for (const unknown of ['unknown', '__proto__', 'constructor', 'toString', '../public/index.html', null, undefined, 1, Symbol('source'),
  Object.freeze({ toString() { throw Error('No coercion'); } })]) assert.equal(businessDeskCombinedNativeProvenance(unknown, sample.previous, sample.expected), null);
console.log(JSON.stringify({ phase, source: source.revision, tree: source.tree, targets, inverseHunks: inverseCount,
  positives, refusals, nativeRelations, nativeRefusals, refusedDeskParentInputs, sourceOnly: true, runtime: false, native: false,
  migration: false, financial: false, activation: false, deployment: false }));
