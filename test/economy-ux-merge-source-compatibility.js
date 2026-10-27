// Exact dual-parent source proof only. No runtime, database, network, or native execution.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  ECONOMY_UX_MERGE_SOURCE as pin, ECONOMY_UX_MERGE_FILES, qualifyEconomyUxMergeSource,
  economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput,
} from '../tools/economy-ux-merge-source-compatibility.js';

assert.deepEqual(process.argv.slice(2), [], 'Bare source-only entrypoint required');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 128 * 1024 * 1024,
});
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const inverseHunks = diff => {
  const rows = []; let hunk = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; rows.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += `${line.slice(1)}\n`;
      if (line[0] !== '+') hunk.baseline += `${line.slice(1)}\n`;
    }
  }
  return rows;
};
assert.equal(pin.status, 'SEALED'); assert.equal(pin.phase, 'EXACT_ECONOMY_UX_MERGE_SOURCE_ONLY');
assert.deepEqual(pin.files.map(row => row.file), ECONOMY_UX_MERGE_FILES);
assert.equal(git('rev-parse', `${pin.sourceRevision}^{tree}`).trim(), pin.sourceTree);
assert.equal(git('rev-parse', `${pin.mergeRevision}^{tree}`).trim(), pin.mergeTree);
assert.equal(git('rev-parse', `${pin.mergeRevision}^1`).trim(), pin.candidateParentRevision);
assert.equal(git('rev-parse', `${pin.mergeRevision}^2`).trim(), pin.mainParentRevision);
assert.equal(git('rev-parse', `${pin.candidateParentRevision}^{tree}`).trim(), pin.candidateParentTree);
assert.equal(git('rev-parse', `${pin.mainParentRevision}^{tree}`).trim(), pin.mainParentTree);
git('merge-base', '--is-ancestor', pin.mergeRevision, pin.sourceRevision);
git('merge-base', '--is-ancestor', pin.sourceRevision, 'HEAD');
const helpers = {
  candidate: economyUxMergeCandidateHistoricalInput,
  main: economyUxMergeMainHistoricalInput,
};
let positives = 0, refusals = 0, inverseCount = 0, absentParents = 0;
for (const row of pin.files) {
  assert(Object.isFrozen(row) && Object.isFrozen(row.candidate) && Object.isFrozen(row.main));
  const current = git('show', `${pin.sourceRevision}:${row.file}`);
  assert.equal(git('ls-tree', pin.sourceRevision, '--', row.file).trim(), `${row.mode} blob ${row.currentBlob}\t${row.file}`);
  assert.equal(sha(current), row.currentSha256); assert.equal(blob(current), row.currentBlob); assert.equal(Buffer.byteLength(current), row.currentBytes);
  for (const target of ['candidate', 'main']) {
    const parent = row[target], revision = pin[`${target}ParentRevision`], helper = helpers[target];
    const proof = qualifyEconomyUxMergeSource(row.file, current, target);
    assert.deepEqual([proof.sourceOnly, proof.native, proof.runtime], [true, false, false]);
    assert.equal(proof.sourceRevision, pin.sourceRevision); assert.equal(proof.targetRevision, revision); assert.equal(proof.target, target);
    if (parent.absent) {
      assert.equal(git('ls-tree', revision, '--', row.file), ''); assert.equal(proof.predecessorAbsent, true); assert.equal(proof.baselineText, null);
      assert.equal(helper(row.file, current), current); absentParents++; positives++;
      continue;
    }
    assert.equal(parent.absent, false); assert(Object.isFrozen(parent.inverses) && parent.inverses.every(Object.isFrozen));
    const baseline = git('show', `${revision}:${row.file}`);
    assert.equal(git('ls-tree', revision, '--', row.file).trim(), `${parent.mode} blob ${parent.blob}\t${row.file}`);
    assert.equal(sha(baseline), parent.sha256); assert.equal(blob(baseline), parent.blob); assert.equal(Buffer.byteLength(baseline), parent.bytes);
    assert.deepEqual(parent.inverses, inverseHunks(git('diff', '--no-ext-diff', '--unified=3', revision, pin.sourceRevision, '--', row.file)));
    assert.equal(proof.baselineText, baseline); assert.equal(helper(row.file, current), baseline);
    assert.deepEqual(helper(row.file, Buffer.from(current)), Buffer.from(baseline));
    assert.equal(qualifyEconomyUxMergeSource(row.file, current.replaceAll('\n', '\r\n'), target).baselineText, baseline);
    for (const inverse of parent.inverses) {
      for (const changed of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current), current.replace(inverse.current, () => inverse.baseline)])
        assert.throws(() => qualifyEconomyUxMergeSource(row.file, changed, target));
      inverseCount++;
    }
    positives += 3;
  }
  for (const changed of [current + '\n', current.slice(1), '\ufeff' + current, current + '\0', current.replace(/\S/, '?'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    for (const target of ['candidate', 'main']) { assert.throws(() => qualifyEconomyUxMergeSource(row.file, changed, target)); refusals++; }
  }
  for (const helper of Object.values(helpers)) {
    const future = `${current}\n// unknown future integrated source\n`; assert.equal(helper(row.file, future), future);
    assert.throws(() => helper(row.file, Buffer.concat([Buffer.from(current), Buffer.from([0xff])])), /Lossless UTF-8/); refusals += 2;
  }
}
for (const file of ['../schema.sql', '__proto__', 'constructor', 'unknown']) {
  for (const target of ['candidate', 'main']) assert.throws(() => qualifyEconomyUxMergeSource(file, 'x', target));
  for (const helper of Object.values(helpers)) assert.equal(helper(file, 'x'), 'x'); refusals += 2;
}
const first = pin.files[0], firstCurrent = git('show', `${pin.sourceRevision}:${first.file}`);
assert.throws(() => qualifyEconomyUxMergeSource(first.file, firstCurrent, 'unknown')); refusals++;
assert.throws(() => qualifyEconomyUxMergeSource(first.file, firstCurrent, 'candidate', Object.freeze({ ...pin }))); refusals++;
console.log(JSON.stringify({ phase: pin.phase, source: pin.sourceRevision, merge: pin.mergeRevision,
  candidateParent: pin.candidateParentRevision, mainParent: pin.mainParentRevision, files: pin.files.length,
  inverseHunks: inverseCount, absentParents, positives, refusals, sourceOnly: true, native: false, runtime: false }));
