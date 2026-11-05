// Independent exact-source and mutation proofs; no runtime or native results transfer.
import assert from 'node:assert/strict';
import { integratedEconomicParentInput } from '../tools/integrated-economic-parent-source.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { SALE_SOURCE, SALE_SOURCE_FILES, SALE_SOURCE_PREDECESSOR, qualifySaleSource, saleHistoricalInput } from '../tools/sale-source-compatibility.js';
import { uxHistoricalInput, qualifyUxSource } from '../tools/ux-source-compatibility.js';
import { uxAfterwordHistoricalInput } from '../tools/ux-afterword-source-compatibility.js';
import { economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput } from '../tools/economy-ux-merge-source-compatibility.js';
import { economySocialProofCutoverHistoricalInput } from '../tools/economy-social-proof-cutover-source-transfer.js';
import { economyMonitorHistoricalInput } from '../tools/economy-monitor-source-transfer.js';
import { ageEligibilityHistoricalInput } from '../tools/age-eligibility-source-transfer.js';
import { COMMERCE_CURRENT_BOOT_READER } from '../tools/commerce-current-native-data.js';
import { deedAllocationHistoricalInput } from '../tools/deed-allocation-source-transfer.js';
import { economyDeedMergeHistoricalInput } from '../tools/economy-deed-merge-source-compatibility.js';
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
const currentSaleSource = (file, input) => {
  input = integratedEconomicParentInput(file, input, 'main');
  input = economyDeedMergeHistoricalInput(file, input, 'monitor');
  input = deedAllocationHistoricalInput(file, input);
  input = uxAfterwordHistoricalInput(file, input);
  input = ageEligibilityHistoricalInput(file, input);
  input = economyMonitorHistoricalInput(file, input);
  return economySocialProofCutoverHistoricalInput(file, input);
};
for (const row of pin.files) {
  const current = git('show', pin.revision + ':' + row.file), target = git('show', pin.targetRevision + ':' + row.file);
  const physical = currentSaleSource(row.file, fs.readFileSync(row.file, 'utf8'));
  const committed = currentSaleSource(row.file, git('show', 'HEAD:' + row.file));
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
for (const hook of ["import { uxAfterwordHistoricalInput } from './ux-afterword-source-compatibility.js';\n", '  input = uxAfterwordHistoricalInput(file, input);\n']) {
  assert.equal(conserved.split(hook).length, 2, 'One exact separately admitted Afterword integration hook'); conserved = conserved.replace(hook, '');
}
assert.equal(conserved, git('show', pin.targetRevision + ':tools/ux-source-compatibility.js'), 'All prior historical qualifiers and refusal predicates remain byte-identical');
// The dual-parent definition first proves the complete physical integration reader and reconstructs
// its monitor parent. Retain that parent's independently pinned correction-reader conservation
// proof below; neither reconstruction executes historical source or admits native bytes.
const correctionFile = 'tools/economy-ux-merge-source-compatibility.js';
const correctionPhysical = economyDeedMergeHistoricalInput(correctionFile, fs.readFileSync(correctionFile, 'utf8'), 'monitor');
let candidateConserved = correctionPhysical.replaceAll('\r\n', '\n');
const correctionRevision = '77882cdfc2e54f94602065c58132b9da913b5427';
const correctionPredecessor = '6fdc897851ef23e8c2cf691733ad944a7663242a';
const correctionCurrent = Object.freeze({ sha256: 'bae09cba0a3833d53b1f29db1c8462513924eb3e9f0b6373544b9c94304e4aea',
  blob: 'f14f8b5aee26da0062e5b9be1b8d129df7852a41', bytes: 46593 });
const correctionBaseline = Object.freeze({ sha256: 'ca6fd1a86117cf5caf77e43a3518471fc2e804d000de34ee325ceb1c316bb94e',
  blob: '14e2b55c534ce79715e7916a17891a6c449df0fe', bytes: 7769 });
const correctionInverses = Object.freeze(inverseHunks(git('diff', '--no-ext-diff', '--unified=3',
  correctionPredecessor, correctionRevision, '--', correctionFile)).map(Object.freeze));
const correctionBlob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
git('merge-base', '--is-ancestor', correctionPredecessor, correctionRevision);
git('merge-base', '--is-ancestor', correctionRevision, 'HEAD');
assert.equal(git('show', correctionRevision + ':' + correctionFile), candidateConserved);
const correctionStat = fs.lstatSync(correctionFile); assert(correctionStat.isFile() && !correctionStat.isSymbolicLink());
for (const [revision, record] of [[correctionRevision, correctionCurrent], [correctionPredecessor, correctionBaseline]])
  assert.equal(git('ls-tree', revision, '--', correctionFile).trim(), '100644 blob ' + record.blob + '\t' + correctionFile);
assert(correctionInverses.length > 0);
const restoreCorrectionReader = input => {
  assert.equal(typeof input, 'string');
  assert.equal(Buffer.from(input).toString('utf8'), input);
  assert(!input.startsWith('\ufeff') && !input.includes('\0'));
  const current = input.replaceAll('\r\n', '\n');
  assert(!current.includes('\r') && (input === current || input === current.replaceAll('\n', '\r\n')));
  assert.equal(sha(current), correctionCurrent.sha256); assert.equal(correctionBlob(current), correctionCurrent.blob);
  assert.equal(Buffer.byteLength(current), correctionCurrent.bytes);
  let restored = current, end = -1;
  for (const inverse of correctionInverses) {
    assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);
    assert(inverse.current.length); assert.equal(current.split(inverse.current).length, 2);
    const at = current.indexOf(inverse.current); assert(at >= end); end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha(restored), correctionBaseline.sha256); assert.equal(correctionBlob(restored), correctionBaseline.blob);
  assert.equal(Buffer.byteLength(restored), correctionBaseline.bytes);
  assert.equal(restored, git('show', correctionPredecessor + ':' + correctionFile));
  return restored;
};
let correctionRefusals = 0;
for (const current of [candidateConserved, candidateConserved.replaceAll('\n', '\r\n')])
  assert.equal(restoreCorrectionReader(current), git('show', correctionPredecessor + ':' + correctionFile));
for (const changed of [candidateConserved + '\n// drift\n', candidateConserved.slice(1), '\ufeff' + candidateConserved,
  candidateConserved + '\0', candidateConserved.replace('\n', '\r\n'), candidateConserved.replace('\n', '\r'),
  Buffer.from(candidateConserved), Buffer.from([0xc3, 0x28]), null]) {
  assert.throws(() => restoreCorrectionReader(changed)); correctionRefusals++;
}
for (const inverse of correctionInverses) for (const changed of [
  candidateConserved.replace(inverse.current, ''),
  candidateConserved.replace(inverse.current, inverse.current + inverse.current),
  candidateConserved.replace(inverse.current, inverse.baseline),
  candidateConserved.replace(inverse.current, inverse.current.replace(/\S/, char => char === '?' ? '!' : '?')),
]) { assert.throws(() => restoreCorrectionReader(changed)); correctionRefusals++; }
candidateConserved = restoreCorrectionReader(correctionPhysical);
console.log(JSON.stringify({ phase: 'EXACT_ECONOMY_MONITOR_CORRECTION_READER_SOURCE_ONLY', source: correctionRevision,
  predecessor: correctionPredecessor, files: 1, inverseHunks: correctionInverses.length, positives: 2,
  refusals: correctionRefusals, sourceOnly: true, native: false, runtime: false }));
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

let economicConserved = integratedEconomicParentInput(correctionFile, fs.readFileSync(correctionFile, 'utf8'), 'economic').replaceAll('\r\n', '\n');
for (const [hook, count] of [["import { saleHistoricalInput } from './sale-source-compatibility.js';\n", 1], ['  input = saleHistoricalInput(file, input);\n', 2],
  ["import { deedAllocationHistoricalInput } from './deed-allocation-source-transfer.js';\n", 1],
  ['  input = deedAllocationHistoricalInput(file, input);\n', 2],
  ["import { currentEconomicTermsBaseline } from './current-economic-terms-source-transfer.js';\n", 1],
  ['  input = currentEconomicTermsBaseline(file, input);\n', 2],
  ["import { economyBankInterestHardeningHistoricalInput } from './economy-bank-interest-source-transfer.js';\n", 1],
  ['  input = economyBankInterestHardeningHistoricalInput(file, input);\n', 2],
  ["import { economySocialProofCutoverHistoricalInput } from './economy-social-proof-cutover-source-transfer.js';\n", 1],
  ['  input = economySocialProofCutoverHistoricalInput(file, input);\n', 2],
  ["import { economySocialReceiptSafetyHistoricalInput } from './economy-social-proof-receipt-safety-source-transfer.js';\n", 1],
  ['  input = economySocialReceiptSafetyHistoricalInput(file, input);\n', 2],
  ["import { economySocialReceiptHistoricalInput } from './economy-social-proof-receipt-source-transfer.js';\n", 1],
  ['  input = economySocialReceiptHistoricalInput(file, input);\n', 2]]) {
  assert.equal(economicConserved.split(hook).length, count + 1, 'Exact candidate and main sale integration hooks'); economicConserved = economicConserved.split(hook).join('');
}
assert.equal(economicConserved, git('show', 'c86bcd310e5f38845642637230ba4bec7d653183:tools/economy-ux-merge-source-compatibility.js'), 'All committed economy merge qualifiers and refusal predicates remain byte-identical');
