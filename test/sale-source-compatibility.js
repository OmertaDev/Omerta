// Independent exact-source and mutation proofs; no runtime or native results transfer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { SALE_SOURCE, SALE_SOURCE_FILES, SALE_SOURCE_PREDECESSOR, qualifySaleSource, saleHistoricalInput } from '../tools/sale-source-compatibility.js';
import { uxHistoricalInput, qualifyUxSource } from '../tools/ux-source-compatibility.js';
import { economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput } from '../tools/economy-ux-merge-source-compatibility.js';
import { economySocialProofCutoverHistoricalInput } from '../tools/economy-social-proof-cutover-source-transfer.js';
import { economyMonitorHistoricalInput } from '../tools/economy-monitor-source-transfer.js';
import { ageEligibilityHistoricalInput } from '../tools/age-eligibility-source-transfer.js';
import { COMMERCE_CURRENT_BOOT_READER } from '../tools/commerce-current-native-data.js';
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const pin = SALE_SOURCE;
assert.equal(pin.status, 'SEALED', 'Seal sale source against the committed authored revision before release');
assert.equal(pin.targetRevision, SALE_SOURCE_PREDECESSOR);
assert.deepEqual(pin.files.map(row => row.file), ['package.json', 'public/index.html', 'src/server.js', 'test/director-migration.js']);
assert.deepEqual(pin.files.map(row => row.file), SALE_SOURCE_FILES);
for (const [revision, tree] of [[pin.revision, pin.tree], [pin.targetRevision, pin.targetTree]])
  assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);
git('merge-base', '--is-ancestor', pin.targetRevision, pin.revision);
git('merge-base', '--is-ancestor', pin.revision, 'HEAD');
const inverseHunks = diff => {
  const rows = []; let hunk;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; rows.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) { if (line[0] !== '-') hunk.current += line.slice(1) + '\n'; if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n'; }
  }
  return rows;
};
let positives = 0, refusals = 0, hunks = 0;
for (const row of pin.files) {
  const current = git('show', pin.revision + ':' + row.file), target = git('show', pin.targetRevision + ':' + row.file);
  const physical = economySocialProofCutoverHistoricalInput(row.file, economyMonitorHistoricalInput(row.file, ageEligibilityHistoricalInput(row.file, fs.readFileSync(row.file, 'utf8'))));
  const committed = economySocialProofCutoverHistoricalInput(row.file, economyMonitorHistoricalInput(row.file, ageEligibilityHistoricalInput(row.file, git('show', 'HEAD:' + row.file))));
  const stat = fs.lstatSync(row.file);
  assert(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(committed, current, 'Actual committed sale source remains exact after the reviewed outer transfer');
  assert(physical === current || physical === current.replaceAll('\n', '\r\n'), 'Physical sale source remains whole LF/CRLF');
  for (const [revision, mode, expected] of [[pin.revision, row.mode, row.currentBlob], [pin.targetRevision, row.targetMode, row.targetBlob]])
    assert.equal(git('ls-tree', revision, '--', row.file).trim(), mode + ' blob ' + expected + '\t' + row.file);
  assert.deepEqual(row.inverses, inverseHunks(git('diff', '--no-ext-diff', '--unified=3', pin.targetRevision, pin.revision, '--', row.file)), 'Only actual immutable Git hunks are admitted');
  for (const input of [physical, current, current.replaceAll('\n', '\r\n')]) {
    const proof = qualifySaleSource(row.file, input);
    assert.equal(proof.baselineText, target);
    assert.deepEqual([proof.sourceOnly, proof.native, proof.runtime], [true, false, false]);
    assert.equal(proof.sourceRevision, pin.revision); assert.equal(proof.targetRevision, pin.targetRevision);
    assert.equal(saleHistoricalInput(row.file, input), target);
    assert.equal(uxHistoricalInput(row.file, input), uxHistoricalInput(row.file, target), 'Existing historical reader chain sees its exact predecessor');
    assert.equal(economyUxMergeCandidateHistoricalInput(row.file, input), economyUxMergeCandidateHistoricalInput(row.file, target), 'Existing candidate reader chain sees its exact predecessor');
    assert.equal(economyUxMergeMainHistoricalInput(row.file, input), economyUxMergeMainHistoricalInput(row.file, target), 'Existing main reader chain sees its exact predecessor');
    assert.throws(() => qualifyUxSource(row.file, input), 'Sale bytes never acquire direct older qualification');
    positives++; refusals++;
  }
  assert.deepEqual(saleHistoricalInput(row.file, Buffer.from(current)), Buffer.from(target)); positives++;
  for (const input of [physical, current, current.replaceAll('\n', '\r\n')]) {
    assert.deepEqual(economyUxMergeCandidateHistoricalInput(row.file, Buffer.from(input)), economyUxMergeCandidateHistoricalInput(row.file, Buffer.from(target)));
    assert.deepEqual(economyUxMergeMainHistoricalInput(row.file, Buffer.from(input)), economyUxMergeMainHistoricalInput(row.file, Buffer.from(target)));
    positives++;
  }
  const reject = input => { assert.throws(() => qualifySaleSource(row.file, input)); refusals++; };
  for (const input of [current + '\n', current.slice(1), '\ufeff' + current, current + '\0', current.replace(/\S/, '?'), current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null, target]) reject(input);
  for (const inverse of row.inverses) {
    for (const input of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current), current.replace(inverse.current, () => inverse.baseline), current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) reject(input);
    hunks++;
  }
  for (const input of [current + '\n// unrelated future mutation\n', current.slice(1), target])
    assert.equal(saleHistoricalInput(row.file, input), input, 'Unknown or predecessor bytes retain their original form');
  const unknown = current + '\n// unrelated future mutation\n';
  assert.equal(uxHistoricalInput(row.file, unknown), unknown, 'Unknown bytes do not get an older inverse');
  for (const input of [unknown, current.slice(1), Buffer.from(unknown)]) {
    assert.equal(economyUxMergeCandidateHistoricalInput(row.file, input), input, 'Unknown candidate bytes retain their original form');
    assert.equal(economyUxMergeMainHistoricalInput(row.file, input), input, 'Unknown main bytes retain their original form');
  }
  assert.throws(() => qualifySaleSource(row.file, current, Object.freeze({ ...pin }))); refusals++;
  assert.throws(() => saleHistoricalInput(row.file, Buffer.concat([Buffer.from(current), Buffer.from([255])])), /lossless/); refusals++;
  assert.equal(sha(current), row.currentSha256);
}
for (const file of ['../src/server.js', '__proto__', 'constructor', 'public/sale.html', 'src/unknown.js']) {
  assert.throws(() => qualifySaleSource(file, 'x')); assert.equal(saleHistoricalInput(file, 'x'), 'x'); refusals++;
  assert.equal(economyUxMergeCandidateHistoricalInput(file, 'x'), 'x');
  assert.equal(economyUxMergeMainHistoricalInput(file, 'x'), 'x');
}
// Original commerce boot directory predicates remain one complete, unchanged source block.
assert.equal(fs.readFileSync('src/server.js', 'utf8').replaceAll('\r\n', '\n').split(COMMERCE_CURRENT_BOOT_READER).length, 2);
let conserved = fs.readFileSync('tools/ux-source-compatibility.js', 'utf8').replaceAll('\r\n', '\n');
for (const hook of ["import { saleHistoricalInput } from './sale-source-compatibility.js';\n", '  input = saleHistoricalInput(file, input);\n']) {
  assert.equal(conserved.split(hook).length, 2, 'One exact sale integration hook'); conserved = conserved.replace(hook, '');
}
assert.equal(conserved, git('show', pin.targetRevision + ':tools/ux-source-compatibility.js'), 'All prior historical qualifiers and refusal predicates remain byte-identical');
let candidateConserved = fs.readFileSync('tools/economy-ux-merge-source-compatibility.js', 'utf8').replaceAll('\r\n', '\n');
for (const [hook, count] of [["import { saleHistoricalInput } from './sale-source-compatibility.js';\n", 1], ['  input = saleHistoricalInput(file, input);\n', 2],
  ["import { economyMonitorHistoricalInput } from './economy-monitor-source-transfer.js';\n", 1],
  ['  input = economyMonitorHistoricalInput(file, input);\n', 2],
  ["import { ageEligibilityHistoricalInput } from './age-eligibility-source-transfer.js';\n", 1],
  ['  input = ageEligibilityHistoricalInput(file, input);\n', 2],
  ["import { economyBankInterestHardeningHistoricalInput } from './economy-bank-interest-source-transfer.js';\n", 1],
  ['  input = economyBankInterestHardeningHistoricalInput(file, input);\n', 2],
  ["import { economySocialProofCutoverHistoricalInput } from './economy-social-proof-cutover-source-transfer.js';\n", 1],
  ['  input = economySocialProofCutoverHistoricalInput(file, input);\n', 2],
  ["import { economySocialReceiptSafetyHistoricalInput } from './economy-social-proof-receipt-safety-source-transfer.js';\n", 1],
  ['  input = economySocialReceiptSafetyHistoricalInput(file, input);\n', 2],
  ["import { economySocialReceiptHistoricalInput } from './economy-social-proof-receipt-source-transfer.js';\n", 1],
  ['  input = economySocialReceiptHistoricalInput(file, input);\n', 2]]) {
  assert.equal(candidateConserved.split(hook).length, count + 1, 'Exact candidate and main sale integration hooks'); candidateConserved = candidateConserved.split(hook).join('');
}
assert.equal(candidateConserved, git('show', 'c86bcd310e5f38845642637230ba4bec7d653183:tools/economy-ux-merge-source-compatibility.js'), 'All committed economy merge qualifiers and refusal predicates remain byte-identical');
console.log(JSON.stringify({ phase: pin.phase, files: pin.files.length, hunks, positives, refusals, runtime: false, native: false }));
