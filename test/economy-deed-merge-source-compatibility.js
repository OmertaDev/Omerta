// Exact immutable Git source/provenance controls; no reconstructed source is executed.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ECONOMY_DEED_MERGE_SOURCE as source, ECONOMY_DEED_MERGE_SOURCE_SHA256 as sourceSha,
  ECONOMY_DEED_MERGE_NATIVE_PROVENANCE as provenance, ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256 as provenanceSha,
  ECONOMY_DEED_MERGE_FILES, ECONOMY_DEED_MERGE_PROFILES, ECONOMY_DEED_MERGE_NATIVE_REVIEW_FILES,
  ECONOMY_DEED_MERGE_NOIR_NATIVE_FILES,
  ECONOMY_DEED_MERGE_PREFLIGHT_SUCCESSOR, ECONOMY_DEED_MERGE_ENGAGEMENT_SUCCESSOR,
  assertEconomyDeedMergeSource, economyDeedMergeHistoricalInput,
  assertEconomyDeedNativeProvenanceDefinition, assertEconomyDeedNativeProvenance }
  from '../tools/economy-deed-merge-source-compatibility.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as previous,
  ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as previousSha } from '../tools/enterprise-native-ux-b35-inputs.js';
import { economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput }
  from '../tools/economy-ux-merge-source-compatibility.js';
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args],
  { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const blob = value => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(value) + '\0').update(value).digest('hex');
const lf = value => value.replaceAll('\r\n', '\n');
const treeCache = new Map();
const tree = revision => {
  if (!treeCache.has(revision)) treeCache.set(revision, new Map(git('ls-tree', '-r', '-z', revision).split('\0').filter(Boolean).map(line => {
    const at = line.indexOf('\t'), [mode, type, oid] = line.slice(0, at).split(' ');
    return [line.slice(at + 1), { mode, type, blob: oid }];
  })));
  return treeCache.get(revision);
};
const nativePin = (revision, file) => {
  const entry = tree(revision).get(file); assert.equal(entry?.type, 'blob');
  return { file, mode: entry.mode, blob: entry.blob, sha256: sha(git('show', revision + ':' + file)) };
};
const inverses = (prior, authored, file) => {
  const rows = []; let current;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', prior, authored, '--', file).split('\n')) {
    if (line.startsWith('@@')) { current = { current: '', baseline: '' }; rows.push(current); }
    else if (current && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') current.current += line.slice(1) + '\n';
      if (line[0] !== '+') current.baseline += line.slice(1) + '\n';
    }
  }
  return rows;
};
assert.deepEqual(process.argv.slice(2), []);
assert.equal(source.status, 'SEALED', 'Commit complete integration source, then generate its exact definition');
assert.equal(sha(JSON.stringify(source)), sourceSha); assert.equal(sha(JSON.stringify(provenance)), provenanceSha);
assert.deepEqual(source.files.map(row => row.file), ECONOMY_DEED_MERGE_FILES);
assert.equal(source.files.length, 14); assert.equal(ECONOMY_DEED_MERGE_NATIVE_REVIEW_FILES.length, 56);
assert.deepEqual(Object.keys(source.profiles), ['monitor', 'deed', 'noir']);
assert.equal(git('rev-parse', source.sourceRevision + '^{tree}').trim(), source.sourceTree);
git('merge-base', '--is-ancestor', source.sourceRevision, 'HEAD');
let positives = 0, refusals = 0, sourceHunks = 0;
const reject = action => { assert.throws(action, error => error?.code === 'ERR_ASSERTION'); refusals++; };
for (const row of source.files) {
  const physical = fs.readFileSync(row.file, 'utf8'), current = git('show', source.sourceRevision + ':' + row.file);
  const stat = fs.lstatSync(row.file); assert(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(lf(physical), current); assert.equal(current, git('show', 'HEAD:' + row.file));
  assert.equal(sha(current), row.current.sha256); assert.equal(blob(current), row.current.blob);
  assert.equal(Buffer.byteLength(current), row.current.bytes);
  assert.equal(sha(current), row.current.rawSha256.lf); assert.equal(sha(current.replaceAll('\n', '\r\n')), row.current.rawSha256.crlf);
  assert.equal(tree(source.sourceRevision).get(row.file).mode, row.current.mode);
  assert.equal(tree('HEAD').get(row.file).mode, row.current.mode);
  for (const profile of ['monitor', 'deed', 'noir']) {
    const parent = row.parents[profile], revision = ECONOMY_DEED_MERGE_PROFILES[profile], baseline = git('show', revision + ':' + row.file);
    assert.equal(source.profiles[profile].revision, revision);
    assert.equal(git('rev-parse', revision + '^{tree}').trim(), source.profiles[profile].tree);
    git('merge-base', '--is-ancestor', revision, source.sourceRevision);
    assert.equal(parent.mode, tree(revision).get(row.file).mode); assert.equal(parent.blob, blob(baseline));
    assert.equal(parent.sha256, sha(baseline)); assert.equal(parent.bytes, Buffer.byteLength(baseline));
    assert.deepEqual(parent.inverses, inverses(revision, source.sourceRevision, row.file));
    for (const input of [physical, current, current.replaceAll('\n', '\r\n')]) {
      const proof = assertEconomyDeedMergeSource(row.file, input, profile);
      assert.equal(proof.baselineText, baseline); assert.equal(proof.predecessorRevision, revision);
      assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native], [true, false, false]); assert(Object.isFrozen(proof));
      assert.equal(economyDeedMergeHistoricalInput(row.file, input, profile), baseline);
      assert.deepEqual(economyDeedMergeHistoricalInput(row.file, Buffer.from(input), profile), Buffer.from(baseline)); positives++;
    }
    for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
      current.replace('\n', '\r\n'), current.replace('\n', '\r'), null]) {
      reject(() => assertEconomyDeedMergeSource(row.file, changed, profile));
      assert.equal(economyDeedMergeHistoricalInput(row.file, changed, profile), changed);
    }
    for (const inverse of parent.inverses) {
      for (const changed of [current.replace(inverse.current, ''), current.replace(inverse.current, inverse.current + inverse.current),
        current.replace(inverse.current, inverse.baseline),
        current.replace(inverse.current, inverse.current.replace(/\S/, char => char === '?' ? '!' : '?'))]) {
        reject(() => assertEconomyDeedMergeSource(row.file, changed, profile));
        assert.equal(economyDeedMergeHistoricalInput(row.file, changed, profile), changed);
      }
      sourceHunks++;
    }
    reject(() => assertEconomyDeedMergeSource(row.file, current, profile, Object.freeze({ ...source })));
    reject(() => economyDeedMergeHistoricalInput(row.file, Buffer.from([0xc3, 0x28]), profile));
  }
}
for (const profile of ['monitor', 'deed', 'noir']) for (const file of ['__proto__', 'constructor', 'toString', 'src/unknown.js',
  '../src/game.js', 'schema.sql', 'tools/economy-deed-merge-source-compatibility.js', null]) {
  const input = Buffer.from([0xff]); reject(() => assertEconomyDeedMergeSource(file, 'unknown', profile));
  assert.strictEqual(economyDeedMergeHistoricalInput(file, input, profile), input);
}
for (const profile of [null, undefined, 'other', new String('monitor'), new String('noir'), { toString: () => 'monitor' }])
  reject(() => economyDeedMergeHistoricalInput('package.json', '', profile));
// These identical newer postimages have distinct age-policy and Deed predecessors. Require the
// caller's explicit source context rather than letting whichever frozen hook ran first decide.
for (const file of ['docs/legal-security-setup.md', 'src/legal.js', 'test/legal-security.js']) {
  const current = git('show', '837f0e45558be03d65b8a4584018c20ff7f69dbc:' + file);
  const ageBaseline = git('show', 'a24df18ea1a0b57f25df942675dd9fef7415f275:' + file);
  const deedBaseline = git('show', 'b35dd222054f0c5f3ca814f228dd7d9a46c58ae9:' + file);
  for (const helper of [economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput]) {
    assert.equal(helper(file, current), helper(file, ageBaseline));
    assert.equal(helper(file, current, 'monitor'), helper(file, ageBaseline, 'monitor'));
    assert.equal(helper(file, current, 'deed'), helper(file, deedBaseline, 'deed')); positives++;
    reject(() => helper(file, current, 'other'));
    reject(() => helper(file, current, { toString: () => 'monitor' }));
  }
}
assert.equal(assertEconomyDeedNativeProvenanceDefinition(), provenance);
assert.equal(provenance.sourceRevision, source.sourceRevision); assert.equal(provenance.sourceTree, source.sourceTree);
assert.equal(provenance.predecessorDefinitionSha256, previousSha); assert.equal(provenance.predecessorRevision, previous.authoredRevision);
assert.deepEqual(provenance.reviewedFiles, ECONOMY_DEED_MERGE_NATIVE_REVIEW_FILES);
assert.equal(provenance.predecessorMetadataSha256, sha(git('show', source.sourceRevision + ':tools/enterprise-native-ux-b35-inputs.js')));
const changedExisting = previous.files.filter(pin => {
  const entry = tree(source.sourceRevision).get(pin.file); assert(entry, 'Existing native input cannot disappear');
  return entry.mode !== pin.mode || entry.blob !== pin.blob;
}).map(pin => pin.file).sort();
assert.deepEqual(provenance.files.map(row => row.file), changedExisting, 'Every changed existing native source has exact closed provenance');
const parentReview = new Set();
for (const profile of ['monitor', 'deed']) for (const pin of previous.files) {
  const revision = ECONOMY_DEED_MERGE_PROFILES[profile];
  const entry = tree(revision).get(pin.file); assert(entry);
  if (entry.mode !== pin.mode || entry.blob !== pin.blob) parentReview.add(pin.file);
}
const operationalSuccessors = [ECONOMY_DEED_MERGE_PREFLIGHT_SUCCESSOR, ECONOMY_DEED_MERGE_ENGAGEMENT_SUCCESSOR];
assert.deepEqual(operationalSuccessors.map(row => row.file), ['src/preflight.js', 'src/engagement.js']);
assert.equal(parentReview.size, 51);
assert.deepEqual([...parentReview].sort(), ECONOMY_DEED_MERGE_NATIVE_REVIEW_FILES.filter(file => !operationalSuccessors.some(row => row.file === file)
  && !ECONOMY_DEED_MERGE_NOIR_NATIVE_FILES.includes(file)));
assert(Object.isFrozen(ECONOMY_DEED_MERGE_NOIR_NATIVE_FILES));
assert.deepEqual(ECONOMY_DEED_MERGE_NOIR_NATIVE_FILES,
  ['public/omerta-ui.css', 'public/ux-feedback.js', 'public/ux-world.js']);
const noirChanges = [];
for (const pin of previous.files) {
  const entry = tree(ECONOMY_DEED_MERGE_PROFILES.noir).get(pin.file); assert(entry);
  if (entry.mode === pin.mode && entry.blob === pin.blob) continue;
  if (!parentReview.has(pin.file)) noirChanges.push(pin.file);
  parentReview.add(pin.file);
}
assert.deepEqual(noirChanges.sort(), ECONOMY_DEED_MERGE_NOIR_NATIVE_FILES);
assert.equal(parentReview.size, 54);
for (const operational of operationalSuccessors) {
  assert(Object.isFrozen(operational));
  const operationalPredecessor = previous.files.find(pin => pin.file === operational.file); assert(operationalPredecessor);
  for (const revision of Object.values(ECONOMY_DEED_MERGE_PROFILES))
    assert.deepEqual(nativePin(revision, operational.file), operationalPredecessor,
      'The exact operational input remains unchanged in all immutable parents');
  const operationalBefore = git('show', previous.authoredRevision + ':' + operational.file);
  const operationalCurrent = git('show', source.sourceRevision + ':' + operational.file);
  assert.equal(operationalBefore.split(operational.anchor).length, 2);
  const expectedOperational = operationalBefore.replace(operational.anchor, operational.anchor + operational.addition);
  const checkOperational = current => assert.equal(current, expectedOperational,
    'Only the bounded monitor operational classification extends native provenance');
  checkOperational(operationalCurrent); assert.notEqual(operationalCurrent, operationalBefore); positives++;
  assert.equal(tree(source.sourceRevision).get(operational.file).mode, operationalPredecessor.mode);
  for (const current of [operationalBefore, operationalCurrent + '\n// drift\n',
    operationalCurrent.replace(operational.addition, ''),
    operationalCurrent.replace(operational.addition, operational.addition + operational.addition),
    operationalCurrent.replace(operational.addition, operational.addition.replace(/\S/, char => char === '?' ? '!' : '?'))])
    reject(() => checkOperational(current));
  parentReview.add(operational.file);
}
assert.deepEqual([...parentReview].sort(), ECONOMY_DEED_MERGE_NATIVE_REVIEW_FILES);
for (const row of provenance.files) {
  assert.deepEqual(row.current, nativePin(source.sourceRevision, row.file));
  assert.deepEqual(row.predecessor, nativePin(previous.authoredRevision, row.file));
  const proof = assertEconomyDeedNativeProvenance(row.file, row.current, row.predecessor);
  assert.equal(proof.nativeAdmission, false); assert.equal(proof.priorResultsTransferred, false); positives++;
  for (const side of ['current', 'predecessor']) for (const field of ['file', 'mode', 'blob', 'sha256']) {
    const changed = { ...row[side], [field]: field === 'mode' ? (row[side].mode === '100644' ? '100755' : '100644')
      : field === 'file' ? '../unknown' : (row[side][field][0] === 'f' ? 'e' : 'f') + row[side][field].slice(1) };
    reject(() => assertEconomyDeedNativeProvenance(row.file, side === 'current' ? changed : row.current,
      side === 'predecessor' ? changed : row.predecessor));
  }
  reject(() => assertEconomyDeedNativeProvenance(row.file, { ...row.current, nativeAdmission: true }, row.predecessor));
}
reject(() => assertEconomyDeedNativeProvenanceDefinition(Object.freeze({ ...provenance })));
reject(() => assertEconomyDeedNativeProvenance('src/unknown.js', {}, {}));
console.log(JSON.stringify({ phase: source.phase, sourceRevision: source.sourceRevision, profiles: ['monitor', 'deed', 'noir'],
  files: source.files.length, inverseHunks: sourceHunks, nativeProvenanceFiles: provenance.files.length,
  positives, refusals, sourceOnly: true, runtime: false, nativeAdmission: false, priorResultsTransferred: false }));
