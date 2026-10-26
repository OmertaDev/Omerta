// Independently pinned source-reader conservation. No native compiler/runtime is imported here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { UX_NATIVE_READER_SOURCE as pin, UX_NATIVE_READER_SOURCE_FILES, qualifyUxNativeReaderSource, uxNativeReaderHistoricalInput, UX_PHASE2_UPGRADE_BOUND_SOURCE, UX_PHASE2_UPGRADE_BOUND_FILE, qualifyUxPhase2UpgradeBoundSource, uxPhase2UpgradeBoundHistoricalInput } from '../../tools/ux-native-reader-source-compatibility.js';
import { qualifyUxSource, uxHistoricalInput } from '../../tools/ux-source-compatibility.js';
const AUTHORED_NATIVE_READER_FIX = 'c1720a694799e743c6f70bc3069dba2bbecae08e';
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
assert.equal(pin.status, 'SEALED'); assert.equal(pin.revision, AUTHORED_NATIVE_READER_FIX);
assert.equal(pin.targetRevision, 'a93245c8eb798dd3760720b65e61c300cb0fceed');
assert.deepEqual(UX_NATIVE_READER_SOURCE_FILES, ['test/phase2-postgres.js', 'tools/enterprise-native.js', 'test/enterprise-native-guard.js']);
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
// This is only the historical reader's qualified view; raw HEAD is independently pinned below.
function qualifiedNativeReaderHeadEntry(file) {
  const raw = git('show', 'HEAD:' + file), entry = git('ls-tree', 'HEAD', '--', file).trim();
  const qualified = uxPhase2UpgradeBoundHistoricalInput(file, raw);
  if (qualified === raw) return entry;
  const row = UX_PHASE2_UPGRADE_BOUND_SOURCE.files[0];
  assert.equal(file, row.file); assert.equal(entry, row.mode + ' blob ' + row.currentBlob + '\t' + file, 'Raw new HEAD mode/blob must qualify before any historical entry normalization');
  assert.equal(sha(qualified), row.targetSha256);
  return row.targetMode + ' blob ' + row.targetBlob + '\t' + file;
}
let positives = 0, refusals = 0, inverseHunks = 0;
for (const row of pin.files) {
  const current = git('show', pin.revision + ':' + row.file), target = git('show', pin.targetRevision + ':' + row.file), physical = uxPhase2UpgradeBoundHistoricalInput(row.file, fs.readFileSync(row.file, 'utf8')), stat = fs.lstatSync(row.file);
  assert(stat.isFile() && !stat.isSymbolicLink()); assert.equal(uxPhase2UpgradeBoundHistoricalInput(row.file, git('show', 'HEAD:' + row.file)), current, 'Actual committed native-reader source remains authored source');
  assert.equal(qualifiedNativeReaderHeadEntry(row.file), row.mode + ' blob ' + row.currentBlob + '\t' + row.file, 'Actual committed reader mode and blob remain exact');
  assert(physical === current || physical === current.replaceAll('\n', '\r\n'));
  for (const [revision, mode, expected] of [[pin.revision, row.mode, row.currentBlob], [pin.targetRevision, row.targetMode, row.targetBlob]]) assert.equal(git('ls-tree', revision, '--', row.file).trim(), mode + ' blob ' + expected + '\t' + row.file);
  assert.deepEqual(row.inverses, hunks(git('diff', '--no-ext-diff', '--unified=3', pin.targetRevision, pin.revision, '--', row.file)), 'Exact actual Git inverse hunks only');
  for (const input of [physical, current, current.replaceAll('\n', '\r\n')]) {
    const proof = qualifyUxNativeReaderSource(row.file, input);
    assert.equal(proof.baselineText, target); assert.equal(proof.sourceRevision, pin.revision); assert.equal(proof.targetRevision, pin.targetRevision);
    assert.deepEqual([proof.sourceOnly, proof.native, proof.runtime], [true, false, false]); assert.equal(uxNativeReaderHistoricalInput(row.file, input), target); positives++;
  }
  assert.deepEqual(uxNativeReaderHistoricalInput(row.file, Buffer.from(current)), Buffer.from(target)); positives++;
  const reject = input => { assert.notEqual(input, current); assert.throws(() => qualifyUxNativeReaderSource(row.file, input)); refusals++; };
  for (const input of [current + '\n', current.slice(1), '\ufeff' + current, current + '\0', current.replace(/\S/, '?'), current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) reject(input);
  for (const inverse of row.inverses) {
    for (const input of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current), current.replace(inverse.current, () => inverse.baseline), current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) reject(input);
    inverseHunks++;
  }
  if (row.inverses.length > 1) { const [left, right] = row.inverses, marker = '\u0001NATIVE_READER_HUNK_SWAP\u0001'; assert(!current.includes(marker)); reject(current.replace(left.current, () => marker).replace(right.current, () => left.current).replace(marker, () => right.current)); }
  for (const input of [current + '\n// arbitrary future source\n', current.slice(1), target]) assert.equal(uxNativeReaderHistoricalInput(row.file, input), input);
  assert.throws(() => qualifyUxNativeReaderSource(row.file, current, Object.freeze({ ...pin }))); refusals++;
  assert.throws(() => uxNativeReaderHistoricalInput(row.file, Buffer.concat([Buffer.from(current), Buffer.from([0xff])])), /Lossless UTF-8/); refusals++;
  assert.throws(() => qualifyUxSource(row.file, current)); refusals++;
  assert.equal(sha(current), row.currentSha256);
}
for (const file of ['../schema.sql', 'schema.sql', 'constructor', '__proto__', 'src/unknown.js']) { assert.throws(() => qualifyUxNativeReaderSource(file, 'x')); assert.equal(uxNativeReaderHistoricalInput(file, 'x'), 'x'); refusals++; }
console.log(JSON.stringify({ phase: pin.phase, source: pin.revision, predecessor: pin.targetRevision, files: pin.files.length, inverseHunks, positives, refusals, sourceOnly: true, runtime: false, native: false }));

// A distinct one-file forward layer, never a native execution or runtime clearance.
{
  const next = UX_PHASE2_UPGRADE_BOUND_SOURCE, file = UX_PHASE2_UPGRADE_BOUND_FILE;
  assert.equal(next.status, 'SEALED');
  assert.equal(next.revision, '2ce8bfeb648b61ec73ac55c4ef17d75b654aaeca');
  assert.equal(next.targetRevision, 'ae8f8688960d5165b94a5de1c29d6306ad9f0c9c');
  assert.deepEqual(next.files.map(row => row.file), [file]);
  for (const [revision, tree] of [[next.revision, next.tree], [next.targetRevision, next.targetTree]]) assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);
  git('merge-base', '--is-ancestor', next.targetRevision, next.revision); git('merge-base', '--is-ancestor', next.revision, 'HEAD');
  const row = next.files[0], current = git('show', next.revision + ':' + file), prior = git('show', next.targetRevision + ':' + file), physical = fs.readFileSync(file, 'utf8');
  assert.equal(git('show', 'HEAD:' + file), current, 'Raw actual HEAD retains the complete new authored Phase2 file');
  assert(physical === current || physical === current.replaceAll('\n', '\r\n'), 'Raw physical Phase2 file is whole LF/CRLF authored source');
  assert(fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink());
  for (const [revision, mode, expected] of [[next.revision, row.mode, row.currentBlob], [next.targetRevision, row.targetMode, row.targetBlob]]) assert.equal(git('ls-tree', revision, '--', file).trim(), mode + ' blob ' + expected + '\t' + file);
  assert.deepEqual(row.inverses, hunks(git('diff', '--no-ext-diff', '--unified=3', next.targetRevision, next.revision, '--', file)));
  assert.equal(row.inverses.length, 1); assert.equal(row.mode, row.targetMode);
  assert.equal(prior, git('show', pin.revision + ':' + file), 'New predecessor is the complete old c172 authored Phase2 source');
  let positives = 0, refusals = 0;
  for (const input of [physical, current, current.replaceAll('\n', '\r\n')]) {
    const proof = qualifyUxPhase2UpgradeBoundSource(file, input);
    assert.equal(proof.baselineText, prior); assert.deepEqual([proof.sourceOnly, proof.native, proof.runtime], [true, false, false]);
    assert.equal(uxPhase2UpgradeBoundHistoricalInput(file, input), prior);
    assert.equal(uxNativeReaderHistoricalInput(file, input), git('show', pin.targetRevision + ':' + file));
    assert.equal(uxHistoricalInput(file, input), git('show', pin.targetRevision + ':' + file)); positives++;
    assert.throws(() => qualifyUxNativeReaderSource(file, input), 'New bytes never receive old direct native-reader qualification'); refusals++;
  }
  assert.deepEqual(uxPhase2UpgradeBoundHistoricalInput(file, Buffer.from(current)), Buffer.from(prior)); positives++;
  const start = current.indexOf("timeout: mode === 'upgrade' ? 600000 : 240000"), end = current.indexOf(', maxBuffer:', start);
  assert(start > 0 && end > start); const expression = current.slice(start + 'timeout: '.length, end);
  assert.equal(expression, "mode === 'upgrade' ? 600000 : 240000");
  const timeoutFor = Function('mode', 'return (' + expression + ');');
  assert.equal(timeoutFor('upgrade'), 600000);
  for (const mode of ['clean', 'scalar', 'missing-unique', 'lots-boundary', 'lots', 'lots-upgrade', 'upgrade ', 'UPGRADE', undefined, null, 1, new String('upgrade')]) assert.equal(timeoutFor(mode), 240000);
  const reject = input => { assert.notEqual(input, current); assert.throws(() => qualifyUxPhase2UpgradeBoundSource(file, input)); refusals++; };
  for (const input of [current + '\n', current.slice(1), '\ufeff' + current, current + '\0', current.replace(/\S/, '?'), current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null, prior]) reject(input);
  for (const changed of ["mode === 'upgrade' ? 601000 : 240000", "mode === 'lots-upgrade' ? 600000 : 240000", "mode === 'upgrade' ? 600000 : 600000", "mode !== 'upgrade' ? 600000 : 240000", "mode == 'upgrade' ? 600000 : 240000", 'Number(process.env.P2_TIMEOUT || 600000)', '600000']) reject(current.replace(expression, changed));
  reject(current.replace('statement_timeout=30000', 'statement_timeout=60000'));
  reject(current.replace('lock_timeout=5000', 'lock_timeout=10000'));
  reject(current.replace("PG_POOL_MAX: '12'", "PG_POOL_MAX: '24'"));
  reject(current.replace("['clean','upgrade','scalar','missing-unique']", "['clean','scalar','missing-unique']"));
  const inverse = row.inverses[0];
  for (const input of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current), current.replace(inverse.current, () => inverse.baseline), current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) reject(input);
  assert.throws(() => qualifyUxPhase2UpgradeBoundSource(file, current, Object.freeze({ ...next }))); refusals++;
  assert.throws(() => uxPhase2UpgradeBoundHistoricalInput(file, Buffer.concat([Buffer.from(current), Buffer.from([255])])), /Lossless UTF-8/); refusals++;
  for (const unknown of ['../test/phase2-postgres.js', '__proto__', 'schema.sql']) { assert.throws(() => qualifyUxPhase2UpgradeBoundSource(unknown, current)); assert.equal(uxPhase2UpgradeBoundHistoricalInput(unknown, current), current); refusals++; }
  for (const input of [prior, current + '\n// unknown future source\n', current.slice(1)]) assert.equal(uxPhase2UpgradeBoundHistoricalInput(file, input), input);
  let conserved = fs.readFileSync('tools/ux-native-reader-source-compatibility.js', 'utf8').replaceAll('\r\n', '\n');
  conserved = conserved.replace("import { UX_PHASE2_UPGRADE_BOUND_SOURCE, UX_PHASE2_UPGRADE_BOUND_SOURCE_SHA256 } from './ux-phase2-upgrade-bound-source-data.js';\n", '');
  const begin = conserved.indexOf('export { UX_PHASE2_UPGRADE_BOUND_SOURCE };'), finish = conserved.indexOf('export function uxNativeReaderHistoricalInput(file, input) {', begin);
  assert(begin >= 0 && finish > begin); conserved = conserved.slice(0, begin) + conserved.slice(finish);
  conserved = conserved.replace('  input = uxPhase2UpgradeBoundHistoricalInput(file, input);\n', '');
  assert.equal(conserved, git('show', next.targetRevision + ':tools/ux-native-reader-source-compatibility.js'), 'Only the new forward layer may differ from the complete prior native-reader module');
  console.log(JSON.stringify({ phase: next.phase, files: 1, inverseHunks: 1, positives, refusals, upgradeHangMilliseconds: 600000, otherModeHangMilliseconds: 240000, runtime: false, native: false }));
}
