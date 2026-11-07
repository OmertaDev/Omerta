// Additive source-only reader view; the complete actual HEAD/index/physical source qualifies first.
import { QUESTING_SOURCE, qualifyQuestingSource, questingHistoricalEntry } from '../../tools/questing-source-transfer.js';
export function questingEnterpriseReaderView(file, input, entry) {
  assert.equal(arguments.length, 3);
  assert(["test/enterprise-release-phase2-migration-catalog.js"].includes(file), 'Only the finite retained reader domains');
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  assert.equal(typeof text, 'string'); if (buffer) assert(Buffer.from(text).equals(input), 'Lossless whole reader bytes');
  const lf = text.replaceAll('\r\n', '\n');
  assert(!lf.includes('\r') && (text === lf || text === lf.replaceAll('\n', '\r\n')), 'Whole LF or uniform CRLF reader source');
  assert.equal(typeof entry, 'string');
  const parsed = entry.match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0\r\n]+)$/);
  assert(parsed && parsed[3] === file, 'Exact regular reader Git entry');
  assert.equal(crypto.createHash('sha1').update('blob ' + Buffer.byteLength(lf) + '\0').update(lf).digest('hex'), parsed[2], 'Whole comparison input equals its admitted actual Git blob');
  const flags = { sourceOnly: true, runtime: false, native: false, financial: false, activation: false, deployment: false, priorResultsTransferred: false };
  if (!Object.hasOwn(QUESTING_SOURCE.files, file)) return Object.freeze({ input, entry, ...flags });
  const proof = qualifyQuestingSource(file, input);
  assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.financial, proof.activation, proof.deployment, proof.priorResultsTransferred], [true, false, false, false, false, false, false]);
  const priorEntry = questingHistoricalEntry(file, entry, 'tree');
  return Object.freeze({ input: buffer ? Buffer.from(proof.baselineText) : proof.baselineText, entry: priorEntry, ...flags });
}

function admittedQuestingEnterpriseReader(file) {
  const committed = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  const text = committed.toString('utf8'), physical = fs.readFileSync(file), stat = fs.lstatSync(file);
  const entry = git('ls-tree', 'HEAD', '--', file).trim();
  assert(Buffer.from(text).equals(committed) && !/[\r\0\ufeff]/.test(text), 'Whole actual Git reader is lossless UTF-8 LF');
  const parsed = entry.match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/); assert(parsed && parsed[3] === file);
  assert.equal(crypto.createHash('sha1').update('blob ' + committed.length + '\0').update(committed).digest('hex'), parsed[2]);
  assert.equal(git('ls-files', '--stage', '--', file).trim(), entry.replace(' blob ', ' ').replace('\t', ' 0\t'), 'Actual Enterprise reader index equals HEAD before any comparison');
  assert(stat.isFile() && !stat.isSymbolicLink());
  assert(physical.equals(committed) || physical.equals(Buffer.from(text.replaceAll('\n', '\r\n'))), 'Whole actual Enterprise reader physical bytes equal HEAD');
  return { head: questingEnterpriseReaderView(file, text, entry), physical: questingEnterpriseReaderView(file, physical.toString('utf8'), entry) };
}

// Independently pinned source-reader conservation. No native compiler/runtime is imported here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { UX_ENTERPRISE_READER_SOURCE as pin, UX_ENTERPRISE_READER_SOURCE_FILES, qualifyUxEnterpriseReaderSource, uxEnterpriseReaderHistoricalInput } from '../../tools/ux-enterprise-reader-source-compatibility.js';
import { qualifyUxSource } from '../../tools/ux-source-compatibility.js';
import { qualifyUxNativeReaderSource } from '../../tools/ux-native-reader-source-compatibility.js';
import { ECONOMY_UX_MERGE_SOURCE, economyUxMergeMainHistoricalInput } from '../../tools/economy-ux-merge-source-compatibility.js';
const AUTHORED_ENTERPRISE_READER_FIX = '79b1c6dbfaa4f7046ae8e62da32d4e3a2d312c58';
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
assert.equal(pin.status, 'SEALED'); assert.equal(pin.revision, AUTHORED_ENTERPRISE_READER_FIX);
assert.equal(pin.targetRevision, 'c6247976ff71e8d4c103ebd1498c2d373217d077');
assert.deepEqual(UX_ENTERPRISE_READER_SOURCE_FILES, ['test/enterprise-release-phase2-migration-catalog.js']);
for (const [revision, tree] of [[pin.revision, pin.tree], [pin.targetRevision, pin.targetTree]]) assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);
git('merge-base', '--is-ancestor', pin.targetRevision, pin.revision); git('merge-base', '--is-ancestor', pin.revision, 'HEAD');
const hunks = diff => {
  const result = []; let hunk;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; result.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) { if (line[0] !== '-') hunk.current += line.slice(1) + '\n'; if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n'; }
  }
  return result;
};
let positives = 0, refusals = 0, inverseHunks = 0;
for (const row of pin.files) {
  const questReader = admittedQuestingEnterpriseReader(row.file);
  const current = git('show', pin.revision + ':' + row.file), target = git('show', pin.targetRevision + ':' + row.file), physical = economyUxMergeMainHistoricalInput(row.file, questReader.physical.input), stat = fs.lstatSync(row.file);
  const mergeRow = ECONOMY_UX_MERGE_SOURCE.files.find(item => item.file === row.file); assert(mergeRow);
  assert.equal(questReader.head.entry, git('ls-tree', QUESTING_SOURCE.predecessor, '--', row.file).trim(), 'The independently admitted quest predecessor retains its exact Git source entry');
  assert(stat.isFile() && !stat.isSymbolicLink()); assert.equal(economyUxMergeMainHistoricalInput(row.file, questReader.head.input), current, 'Parent-qualified committed Enterprise reader source remains authored source');
  assert.equal(mergeRow.main.mode + ' blob ' + mergeRow.main.blob + '\t' + row.file, row.mode + ' blob ' + row.currentBlob + '\t' + row.file, 'Parent-qualified reader mode and blob remain exact');
  assert(physical === current || physical === current.replaceAll('\n', '\r\n'));
  for (const [revision, mode, expected] of [[pin.revision, row.mode, row.currentBlob], [pin.targetRevision, row.targetMode, row.targetBlob]]) assert.equal(git('ls-tree', revision, '--', row.file).trim(), mode + ' blob ' + expected + '\t' + row.file);
  assert.deepEqual(row.inverses, hunks(git('diff', '--no-ext-diff', '--unified=3', pin.targetRevision, pin.revision, '--', row.file)), 'Exact actual Git inverse hunks only');
  for (const input of [physical, current, current.replaceAll('\n', '\r\n')]) {
    const proof = qualifyUxEnterpriseReaderSource(row.file, input);
    assert.equal(proof.baselineText, target); assert.equal(proof.sourceRevision, pin.revision); assert.equal(proof.targetRevision, pin.targetRevision);
    assert.deepEqual([proof.sourceOnly, proof.native, proof.runtime], [true, false, false]); assert.equal(uxEnterpriseReaderHistoricalInput(row.file, input), target); positives++;
  }
  assert.deepEqual(uxEnterpriseReaderHistoricalInput(row.file, Buffer.from(current)), Buffer.from(target)); positives++;
  const reject = input => { assert.notEqual(input, current); assert.throws(() => qualifyUxEnterpriseReaderSource(row.file, input)); refusals++; };
  for (const input of [current + '\n', current.slice(1), '\ufeff' + current, current + '\0', current.replace(/\S/, '?'), current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) reject(input);
  for (const inverse of row.inverses) {
    for (const input of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current), current.replace(inverse.current, () => inverse.baseline), current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) reject(input);
    inverseHunks++;
  }
  if (row.inverses.length > 1) { const [left, right] = row.inverses, marker = '\u0001NATIVE_READER_HUNK_SWAP\u0001'; assert(!current.includes(marker)); reject(current.replace(left.current, () => marker).replace(right.current, () => left.current).replace(marker, () => right.current)); }
  for (const input of [current + '\n// arbitrary future source\n', current.slice(1), target]) assert.equal(uxEnterpriseReaderHistoricalInput(row.file, input), input);
  assert.throws(() => qualifyUxEnterpriseReaderSource(row.file, current, Object.freeze({ ...pin }))); refusals++;
  assert.throws(() => uxEnterpriseReaderHistoricalInput(row.file, Buffer.concat([Buffer.from(current), Buffer.from([0xff])])), /Lossless UTF-8/); refusals++;
  assert.throws(() => qualifyUxSource(row.file, current)); refusals++;
  assert.throws(() => qualifyUxNativeReaderSource(row.file, current)); refusals++;
  assert.equal(sha(current), row.currentSha256);
}
for (const file of ['../schema.sql', 'schema.sql', 'constructor', '__proto__', 'src/unknown.js']) { assert.throws(() => qualifyUxEnterpriseReaderSource(file, 'x')); assert.equal(uxEnterpriseReaderHistoricalInput(file, 'x'), 'x'); refusals++; }
console.log(JSON.stringify({ phase: pin.phase, source: pin.revision, predecessor: pin.targetRevision, files: pin.files.length, inverseHunks, positives, refusals, sourceOnly: true, runtime: false, native: false }));
