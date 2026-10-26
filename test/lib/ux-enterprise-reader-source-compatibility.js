// Independently pinned source-reader conservation. No native compiler/runtime is imported here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { UX_ENTERPRISE_READER_SOURCE as pin, UX_ENTERPRISE_READER_SOURCE_FILES, qualifyUxEnterpriseReaderSource, uxEnterpriseReaderHistoricalInput } from '../../tools/ux-enterprise-reader-source-compatibility.js';
import { qualifyUxSource } from '../../tools/ux-source-compatibility.js';
import { qualifyUxNativeReaderSource } from '../../tools/ux-native-reader-source-compatibility.js';
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
  const current = git('show', pin.revision + ':' + row.file), target = git('show', pin.targetRevision + ':' + row.file), physical = fs.readFileSync(row.file, 'utf8'), stat = fs.lstatSync(row.file);
  assert(stat.isFile() && !stat.isSymbolicLink()); assert.equal(git('show', 'HEAD:' + row.file), current, 'Actual committed Enterprise reader source remains authored source');
  assert.equal(git('ls-tree', 'HEAD', '--', row.file).trim(), row.mode + ' blob ' + row.currentBlob + '\t' + row.file, 'Actual committed reader mode and blob remain exact');
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
