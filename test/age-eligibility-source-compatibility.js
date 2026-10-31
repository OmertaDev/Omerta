// Exact source transfer for the merged age policy; actual runtime tests retain current policy bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  AGE_ELIGIBILITY_SOURCE_REVISION as revision, AGE_ELIGIBILITY_SOURCE_TREE as tree,
  AGE_ELIGIBILITY_SOURCE_PREDECESSOR as predecessor, AGE_ELIGIBILITY_SOURCE_PREDECESSOR_TREE as predecessorTree,
  AGE_ELIGIBILITY_SOURCE_PHASE as phase, AGE_ELIGIBILITY_SOURCE_DOMAINS as domains,
  assertAgeEligibilitySourceTransfer, ageEligibilityHistoricalInput,
} from '../tools/age-eligibility-source-transfer.js';
import { economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput }
  from '../tools/economy-ux-merge-source-compatibility.js';
const files = ['docs/legal-security-setup.md', 'omerta-mcp/README.md', 'src/age.js',
  'src/legal.js', 'src/server.js', 'test/age.js', 'test/legal-security.js'];
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
}).replaceAll('\r\n', '\n');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const inverseHunks = diff => {
  const inverses = []; let hunk = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += `${line.slice(1)}\n`;
      if (line[0] !== '+') hunk.baseline += `${line.slice(1)}\n`;
    }
  }
  return inverses;
};
assert.equal(revision, '837f0e45558be03d65b8a4584018c20ff7f69dbc');
assert.equal(predecessor, 'a24df18ea1a0b57f25df942675dd9fef7415f275');
assert.equal(git('rev-parse', `${revision}^`).trim(), predecessor);
assert.equal(git('rev-parse', `${revision}^{tree}`).trim(), tree);
assert.equal(git('rev-parse', `${predecessor}^{tree}`).trim(), predecessorTree);
git('merge-base', '--is-ancestor', revision, 'HEAD');
assert.match(phase, /^exact-age-eligibility-policy-update-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance$/);
assert.deepEqual(git('diff', '--name-only', predecessor, revision).trim().split('\n'), files);
assert.deepEqual(Object.keys(domains), files); assert(Object.isFrozen(domains));
let positives = 0, refusals = 0, hunks = 0;
for (const file of files) {
  const pin = domains[file], current = git('show', `${revision}:${file}`), baseline = git('show', `${predecessor}:${file}`);
  assert.equal(fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'), current, 'Physical merged age policy remains exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.equal(pin.contextLines, 3); assert.equal(pin.currentSha256, sha(current)); assert.equal(pin.currentBlob, blob(current));
  assert.equal(pin.currentBytes, Buffer.byteLength(current)); assert.equal(pin.baselineSha256, sha(baseline));
  assert.equal(pin.baselineBlob, blob(baseline)); assert.equal(pin.baselineBytes, Buffer.byteLength(baseline));
  assert.equal(git('ls-tree', revision, '--', file).trim(), `${pin.mode} blob ${pin.currentBlob}\t${file}`);
  assert.deepEqual(pin.inverses, inverseHunks(git('diff', '--no-ext-diff', '--unified=3', predecessor, revision, '--', file)));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertAgeEligibilitySourceTransfer(file, input);
    assert.equal(transfer.baselineText, baseline);
    assert.deepEqual([transfer.sourceOnly, transfer.runtime, transfer.native], [true, false, false]);
    assert.equal(ageEligibilityHistoricalInput(file, input), baseline);
    for (const helper of [economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput])
      assert.equal(helper(file, input), helper(file, baseline));
    positives += 4;
  }
  assert.deepEqual(ageEligibilityHistoricalInput(file, Buffer.from(current)), Buffer.from(baseline)); positives++;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), null]) {
    assert.throws(() => assertAgeEligibilitySourceTransfer(file, changed));
    assert.equal(ageEligibilityHistoricalInput(file, changed), changed); refusals++;
  }
  const invalidUtf8 = Buffer.from([0xc3, 0x28]);
  assert.throws(() => assertAgeEligibilitySourceTransfer(file, invalidUtf8));
  assert.throws(() => ageEligibilityHistoricalInput(file, invalidUtf8)); refusals++;
  for (const inverse of pin.inverses) {
    for (const changed of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current),
      current.replace(inverse.current, () => inverse.baseline), current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) {
      assert.throws(() => assertAgeEligibilitySourceTransfer(file, changed));
      assert.equal(ageEligibilityHistoricalInput(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of ['__proto__', 'constructor', 'toString', 'src/unknown.js']) {
  const text = 'unknown\r\nbytes\n', bytes = Buffer.from([0xff]);
  assert.throws(() => assertAgeEligibilitySourceTransfer(file, text));
  assert.equal(ageEligibilityHistoricalInput(file, text), text);
  assert.strictEqual(ageEligibilityHistoricalInput(file, bytes), bytes); refusals++;
}
console.log(JSON.stringify({ phase, revision, files: files.length, positives, refusals, inverseHunks: hunks,
  sourceOnly: true, runtime: false, native: false }));
