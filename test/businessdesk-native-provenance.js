// Source-only admission/provenance assertions. No server, database or native execution.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { businessDeskCombinedNativeProvenance } from '../tools/businessdesk-combined-native-provenance.js';
import { BUSINESS_DESK_COMBINED_NATIVE_PARENTS as nativeParents } from '../tools/businessdesk-combined-native-parents.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as archivedDeskNative } from '../tools/businessdesk-desk-parent-native-inputs.js';
import { NOIR_UI_SOURCE } from '../tools/noir-ui-source-data.js';
import { DEED_ALLOCATION_SOURCE_DOMAINS } from '../tools/deed-allocation-source-data.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as previousNative } from '../tools/enterprise-native-ux-b35-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as deedNative } from '../tools/businessdesk-deed-native-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as currentNative } from '../tools/enterprise-native-deed-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as activeNative, assertEnterpriseUxTrackedInput } from '../tools/enterprise-native-ux.js';

assert.deepEqual(process.argv.slice(2), [], 'Complete source-only provenance test; no skip or native selector.');
assert.equal(previousNative.status, 'SEALED'); assert(Object.isFrozen(previousNative));
assert.equal(deedNative.status, 'SEALED'); assert.equal(deedNative.version, 3);
assert(Object.isFrozen(deedNative) && Object.isFrozen(deedNative.files));
assert.equal(currentNative.status, 'SEALED', 'Seal actual current inputs before executing this test.');
assert.equal(currentNative.version, 6); assert.equal(currentNative.phase, 'ACTUAL_ENTERPRISE_MONITOR_WIKI_DESK_NATIVE_INPUTS');
assert.equal(archivedDeskNative.status, 'SEALED'); assert.equal(archivedDeskNative.version, 3);
assert.equal(archivedDeskNative.phase, 'ACTUAL_ENTERPRISE_DEED_NATIVE_INPUTS');
assert(Object.isFrozen(currentNative) && Object.isFrozen(currentNative.files));
assert.strictEqual(activeNative, currentNative, 'The real admission function uses the actual current declaration.');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  windowsHide: true, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blob = bytes => crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const relation = 'exact-reviewed-monitor-wiki-desk-native-pin-provenance-only';
const archivedCombinedRelation = 'exact-combined-noir-and-deed-source-provenance-only';
const previousRows = new Map(previousNative.files.map(row => [row.file, row]));
const deedRows = new Map(deedNative.files.map(row => [row.file, row]));
const currentRows = new Map(currentNative.files.map(row => [row.file, row]));
const archivedDeskRows = new Map(archivedDeskNative.files.map(row => [row.file, row]));
assert.deepEqual(Object.keys(nativeParents.businessPins), ['.github/workflows/ci.yml', 'package.json', 'public/index.html', 'src/server.js',
  'test/deed-allocation-source-compatibility.js', 'test/gates.js', 'test/lib/enterprise-ux-native-guard.js',
  'tools/deed-allocation-source-transfer.js', 'tools/enterprise-native-ux-seal.js', 'tools/enterprise-native-ux.js']);
const samePin = (a, b) => a.mode === b.mode && a.blob === b.blob && a.sha256 === b.sha256;
const proofOf = (proof, file, previous, expected) => {
  assert(proof && Object.isFrozen(proof) && Object.isFrozen(proof.current) && Object.isFrozen(proof.predecessor));
  assert.deepEqual(Object.keys(proof).sort(), ['file', 'current', 'predecessor', 'predecessorRevision', 'relation', 'nativeAdmission', 'priorResultsTransferred'].sort());
  assert.equal(proof.file, file);
  assert.deepEqual(proof.current, { mode: expected.mode, blob: expected.blob, sha256: expected.sha256 });
  assert.strictEqual(proof.predecessor, previous); assert.equal(proof.predecessorRevision, previousNative.authoredRevision);
  assert.equal(proof.relation, relation);
  assert.equal(proof.nativeAdmission, false); assert.equal(proof.priorResultsTransferred, false);
};
let applicable = 0, refusals = 0, refinedApplicable = 0, neutralAdditions = 0, sample;
const reject = run => { assert.throws(run); refusals++; };
for (const [file, desk] of Object.entries(nativeParents.businessPins)) {
  const previous = previousRows.get(file), archivedDesk = archivedDeskRows.get(file), expected = currentRows.get(file);
  if (!previous) {
    assert(['test/deed-allocation-source-compatibility.js', 'tools/deed-allocation-source-transfer.js'].includes(file),
      'Only the original two Business additions have no B35 input.');
    assert.equal(businessDeskCombinedNativeProvenance(file, previous, expected), null, 'An addition invents no original native transition.');
    neutralAdditions++; continue;
  }
  assert(archivedDesk && Object.isFrozen(archivedDesk), 'Every historical Business case retains its exact archived Desk input.');
  assert(!samePin(previous, archivedDesk), 'The historical eight-case applicability set cannot be dropped by a current change.');
  assert(expected && Object.isFrozen(expected) && Object.isFrozen(previous), 'Every historical case requires an actual current-v6 input.');
  const archivedPath = nativeParents.parentPaths.desk.find(row => row.file === file); assert(archivedPath);
  assert.deepEqual(archivedPath.current, archivedDesk); assert.deepEqual(archivedPath.predecessor, previous);
  const refinement = archivedPath.edges.find(edge => edge.kind === 'desk-noir-combined');
  if (refinement) {
    assert(['package.json', 'public/index.html'].includes(file), 'Only the two exact shared Noir/Business domains refine the archived Desk relation.');
    assert.deepEqual(refinement.from, archivedDesk);
    const noir = NOIR_UI_SOURCE.files.find(row => row.file === file); assert(noir && !noir.predecessorAbsent);
    assert.deepEqual(refinement.to, { file, mode: noir.mode, blob: noir.currentBlob, sha256: noir.currentSha256 });
    const noirEdge = archivedPath.edges.find(edge => edge.kind === 'noir'); assert(noirEdge);
    assert.deepEqual(noirEdge.from, refinement.to); assert.deepEqual(noirEdge.to, desk.baseline);
    assert.deepEqual([noir.predecessorMode, noir.predecessorBlob, noir.predecessorSha256],
      [desk.baseline.mode, desk.baseline.blob, desk.baseline.sha256], 'Both archived branches anchor the same exact frozen Deed input.');
    refinedApplicable++;
  } else assert.deepEqual(desk.current, archivedDesk, 'The original Business postimage is preserved in the archived Desk descriptor.');
  const stage = deedRows.get(file);
  assert(stage && Object.isFrozen(stage), 'An actual frozen Deed native archive row anchors every applicable Desk baseline.');
  assert.deepEqual(desk.baseline, stage);
  reject(() => { stage.blob = '0'.repeat(40); });
  const deed = Object.hasOwn(DEED_ALLOCATION_SOURCE_DOMAINS, file) ? DEED_ALLOCATION_SOURCE_DOMAINS[file] : null;
  if (deed) {
    assert.deepEqual(desk.baseline, { file, mode: deed.currentMode, blob: deed.currentBlob, sha256: deed.currentSha256 });
    assert.deepEqual([deed.baselineMode, deed.baselineBlob, deed.baselineSha256], [previous.mode, previous.blob, previous.sha256]);
  } else assert.deepEqual(desk.baseline, previous);
  const proof = businessDeskCombinedNativeProvenance(file, previous, expected);
  proofOf(proof, file, previous, expected); applicable++;
  reject(() => businessDeskCombinedNativeProvenance(file, Object.freeze({ ...previous }), expected));
  reject(() => businessDeskCombinedNativeProvenance(file, previous, Object.freeze({ ...expected })));
  reject(() => businessDeskCombinedNativeProvenance(file, Object.freeze({ ...previous, blob: '0'.repeat(40) }), expected));
  reject(() => businessDeskCombinedNativeProvenance(file, previous, Object.freeze({ ...expected, sha256: '0'.repeat(64) })));
  reject(() => { proof.nativeAdmission = true; });
  reject(() => { proof.current.blob = '0'.repeat(40); });
  sample ||= { file, previous, expected, proof };
}
assert.equal(applicable, 8, 'All eight original Business cases remain actual-current proof cases.');
assert.equal(refinedApplicable, 2); assert.equal(neutralAdditions, 2); assert(sample);
const record = (revision, file) => {
  const line = git('ls-tree', '-z', revision, '--', file).toString('utf8');
  const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
  assert(match && match[3] === file, 'Actual regular authored Git input required.');
  return Object.freeze({ type: 'blob', mode: match[1], blob: match[2] });
};
const { file, previous, expected } = sample;
const current = record('HEAD', file), authored = record(currentNative.authoredRevision, file);
const bytes = git('show', `${currentNative.authoredRevision}:${file}`);
assert(git('show', `HEAD:${file}`).equals(bytes), 'The current committed source candidate equals its sealed authored bytes.');
assert.equal(sha(bytes), expected.sha256); assert.equal(blob(bytes), expected.blob);
const admitted = assertEnterpriseUxTrackedInput(file, current, authored, bytes);
proofOf(admitted, file, previous, expected); assert.deepEqual(admitted, sample.proof);
const otherMode = current.mode === '100644' ? '100755' : '100644';
for (const [now, anchor, raw] of [
  [current, authored, Buffer.concat([bytes, Buffer.from('\n')])],
  [current, authored, bytes.subarray(1)],
  [current, authored, bytes.toString('utf8')],
  [{ ...current, mode: otherMode }, authored, bytes],
  [current, { ...authored, mode: otherMode }, bytes],
  [{ ...current, blob: '0'.repeat(40) }, authored, bytes],
  [current, { ...authored, blob: '1'.repeat(40) }, bytes],
  [{ ...current, type: 'tree' }, authored, bytes],
]) reject(() => assertEnterpriseUxTrackedInput(file, now, anchor, raw));
reject(() => assertEnterpriseUxTrackedInput(file, current, authored, bytes, Object.freeze({ ...currentNative })));
for (const unknown of ['unknown', '__proto__', 'constructor', 'toString', '../src/server.js',
  undefined, null, 1, Symbol('src/server.js'), Object.freeze({ toString() { throw new Error('No coercion'); } })]) {
  assert.equal(businessDeskCombinedNativeProvenance(unknown, previous, expected), null);
}
assert.equal(refusals, 65, 'All original Business refusal categories are retained.');
console.log(JSON.stringify({ phase: 'BUSINESS_DESK_CURRENT_NATIVE_PROVENANCE_SOURCE_GUARDS', applicable, refusals,
  authoredRevision: currentNative.authoredRevision, relation, refinements: { relation: archivedCombinedRelation, source: nativeParents.profiles.desk.revision, applicable: refinedApplicable }, nativeAdmission: false, nativeExecution: false, priorResultsTransferred: false }));
