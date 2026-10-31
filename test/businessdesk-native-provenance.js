// Source-only admission/provenance assertions. No server, database or native execution.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { businessDeskNativeProvenance } from '../tools/businessdesk-native-provenance.js';
import { BUSINESS_DESK_DOMAINS } from '../tools/businessdesk-source-transfer.js';
import { DEED_ALLOCATION_SOURCE_DOMAINS } from '../tools/deed-allocation-source-data.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as previousNative } from '../tools/enterprise-native-ux-b35-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as currentNative } from '../tools/enterprise-native-deed-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as activeNative, assertEnterpriseUxTrackedInput } from '../tools/enterprise-native-ux.js';

assert.deepEqual(process.argv.slice(2), [], 'Complete source-only provenance test; no skip or native selector.');
assert.equal(previousNative.status, 'SEALED'); assert(Object.isFrozen(previousNative));
assert.equal(currentNative.status, 'SEALED', 'Seal actual current inputs before executing this test.');
assert.equal(currentNative.version, 3); assert.equal(currentNative.phase, 'ACTUAL_ENTERPRISE_DEED_NATIVE_INPUTS');
assert(Object.isFrozen(currentNative) && Object.isFrozen(currentNative.files));
assert.strictEqual(activeNative, currentNative, 'The real admission function uses the actual current declaration.');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  windowsHide: true, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blob = bytes => crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const relation = 'exact-reviewed-business-and-deed-source-provenance-only';
const previousRows = new Map(previousNative.files.map(row => [row.file, row]));
const currentRows = new Map(currentNative.files.map(row => [row.file, row]));
const samePin = (a, b) => a.mode === b.mode && a.blob === b.blob && a.sha256 === b.sha256;
const proofOf = (proof, file, previous, expected) => {
  assert(proof && Object.isFrozen(proof) && Object.isFrozen(proof.current) && Object.isFrozen(proof.predecessor));
  assert.deepEqual(Object.keys(proof).sort(), ['file', 'current', 'predecessor', 'predecessorRevision', 'relation', 'nativeAdmission', 'priorResultsTransferred'].sort());
  assert.equal(proof.file, file);
  assert.deepEqual(proof.current, { mode: expected.mode, blob: expected.blob, sha256: expected.sha256 });
  assert.deepEqual(proof.predecessor, previous); assert.equal(proof.predecessorRevision, previousNative.authoredRevision);
  assert.equal(proof.relation, relation); assert.equal(proof.nativeAdmission, false); assert.equal(proof.priorResultsTransferred, false);
};
let applicable = 0, refusals = 0, sample;
const reject = run => { assert.throws(run); refusals++; };
for (const [file, desk] of Object.entries(BUSINESS_DESK_DOMAINS)) {
  const previous = previousRows.get(file), expected = currentRows.get(file);
  if (!previous || !expected || samePin(previous, expected)) {
    assert.equal(businessDeskNativeProvenance(file, previous, expected), null, 'No applicable existing-input transition grants provenance.');
    continue;
  }
  assert(Object.isFrozen(previous) && Object.isFrozen(expected));
  assert.equal(desk.mode, expected.mode); assert.equal(desk.currentBlob, expected.blob); assert.equal(desk.currentSha256, expected.sha256);
  const deed = Object.hasOwn(DEED_ALLOCATION_SOURCE_DOMAINS, file) ? DEED_ALLOCATION_SOURCE_DOMAINS[file] : null;
  if (deed) {
    assert.deepEqual([desk.baselineMode, desk.baselineBlob, desk.baselineSha256], [deed.currentMode, deed.currentBlob, deed.currentSha256]);
    assert.deepEqual([deed.baselineMode, deed.baselineBlob, deed.baselineSha256], [previous.mode, previous.blob, previous.sha256]);
  } else assert.deepEqual([desk.baselineMode, desk.baselineBlob, desk.baselineSha256], [previous.mode, previous.blob, previous.sha256]);
  const proof = businessDeskNativeProvenance(file, previous, expected);
  proofOf(proof, file, previous, expected); applicable++;
  reject(() => businessDeskNativeProvenance(file, Object.freeze({ ...previous }), expected));
  reject(() => businessDeskNativeProvenance(file, previous, Object.freeze({ ...expected })));
  reject(() => businessDeskNativeProvenance(file, Object.freeze({ ...previous, blob: '0'.repeat(40) }), expected));
  reject(() => businessDeskNativeProvenance(file, previous, Object.freeze({ ...expected, sha256: '0'.repeat(64) })));
  reject(() => { proof.nativeAdmission = true; });
  reject(() => { proof.current.blob = '0'.repeat(40); });
  sample ||= { file, previous, expected, proof };
}
assert(applicable > 0 && sample, 'At least one actual Desk-changed existing old-UX input must exercise the composed provenance path.');
const record = (revision, file) => {
  const line = git('ls-tree', '-z', revision, '--', file).toString('utf8');
  const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
  assert(match && match[3] === file, 'Actual regular authored Git input required.');
  return Object.freeze({ type: 'blob', mode: match[1], blob: match[2] });
};
const { file, previous, expected } = sample;
const current = record('HEAD', file), authored = record(currentNative.authoredRevision, file);
const bytes = git('show', `${currentNative.authoredRevision}:${file}`);
assert(git('show', `HEAD:${file}`).equals(bytes), 'The current physical source candidate equals its sealed authored bytes.');
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
for (const unknown of ['unknown', '__proto__', 'constructor', 'toString', '../src/server.js']) {
  assert.equal(businessDeskNativeProvenance(unknown, previous, expected), null);
}
console.log(JSON.stringify({ phase: 'BUSINESS_DESK_CURRENT_NATIVE_PROVENANCE_SOURCE_GUARDS', applicable, refusals,
  authoredRevision: currentNative.authoredRevision, relation, nativeAdmission: false, nativeExecution: false, priorResultsTransferred: false }));
