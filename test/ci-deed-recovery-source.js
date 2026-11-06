// Current raw Git/index/physical admission precedes exact historical source comparisons.
// This source-only proof executes no reconstructed test or runtime code.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { CI_DEED_RECOVERY_SOURCE as source, qualifyCiDeedRecoverySource,
  ciDeedRecoveryHistoricalInput, ciDeedRecoveryHistoricalEntry,
  ciDeedRecoveryHistoricalRecord } from '../tools/ci-deed-recovery-source-transfer.js';

assert.deepEqual(process.argv.slice(2), [], 'Bare complete source-only proof required');
const domains = [
  '.github/workflows/ci.yml', 'package.json', 'public/index.html', 'test/deed-discovery-ui.js', 'test/gates.js',
  'test/businessdesk-combined-source-compatibility.js', 'test/businessdesk-noir-source-compatibility.js',
  'test/economy-deed-merge-source-compatibility.js', 'test/wiki-media-source-transfer.js',
  'test/deed-allocation-source-compatibility.js', 'test/economy-monitor-source-compatibility.js',
  'tools/integrated-economic-parent-source.js', 'tools/combined-economic-deed-source-transfer.js',
  'tools/enterprise-native-ux.js',
  'tools/economy-ux-merge-source-compatibility.js',
];
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const sha = text => createHash('sha256').update(text).digest('hex');
const blob = text => createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
assert.equal(source.status, 'SEALED'); assert.equal(source.phase, 'EXACT_CI_DEED_RECOVERY_COMPARISON_ONLY');
assert.equal(source.predecessor, '0ce6ab96a34e6061232980ad60bfdbc94cf98fdb');
assert(Object.isFrozen(source) && Object.isFrozen(source.files));
for (const [revision, tree] of [[source.revision, source.tree], [source.predecessor, source.predecessorTree]])
  assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);
git('merge-base', '--is-ancestor', source.predecessor, source.revision); git('merge-base', '--is-ancestor', source.revision, 'HEAD');
const changed = git('diff', '--name-only', '--diff-filter=M', '-z', source.predecessor, source.revision).split('\0').filter(file => domains.includes(file));
assert.deepEqual(Object.keys(source.files).sort(), changed.sort(), 'Every changed file in the explicit comparison scope is present, and nothing else');
for (const file of ['.github/workflows/ci.yml', 'public/index.html', 'test/deed-discovery-ui.js', 'test/gates.js'])
  assert(Object.hasOwn(source.files, file), 'Each actual CI/Deed fix is admitted independently');
let positives = 0, refusals = 0;
for (const [file, row] of Object.entries(source.files)) {
  const current = git('show', source.revision + ':' + file), predecessor = git('show', source.predecessor + ':' + file);
  assert(Object.isFrozen(row) && Object.isFrozen(row.current) && Object.isFrozen(row.baseline) && Object.isFrozen(row.inverses));
  for (const [revision, text, pin] of [[source.revision, current, row.current], [source.predecessor, predecessor, row.baseline]]) {
    assert.equal(git('ls-tree', revision, '--', file).trim(), pin.mode + ' blob ' + pin.blob + '\t' + file);
    assert.equal(Buffer.byteLength(text), pin.bytes); assert.equal(sha(text), pin.sha256); assert.equal(blob(text), pin.blob);
  }
  const actualEntry = git('ls-tree', 'HEAD', '--', file), actualIndex = git('ls-files', '--stage', '--', file);
  assert.equal(actualEntry.trim(), row.current.mode + ' blob ' + row.current.blob + '\t' + file, 'Current HEAD is exact before any source comparison');
  assert.equal(actualIndex.trim(), row.current.mode + ' ' + row.current.blob + ' 0\t' + file, 'Current index is exact before any source comparison');
  const committed = git('show', 'HEAD:' + file); assert.equal(committed, current, 'Complete committed current source qualifies first');
  const stat = fs.lstatSync(file), raw = fs.readFileSync(file); assert(stat.isFile() && !stat.isSymbolicLink());
  assert(raw.equals(Buffer.from(current)) || raw.equals(Buffer.from(current.replaceAll('\n', '\r\n'))), 'Complete actual physical bytes qualify first');
  for (const input of [current, current.replaceAll('\n', '\r\n'), raw]) {
    const proof = qualifyCiDeedRecoverySource(file, input);
    assert.equal(proof.baselineText, predecessor);
    assert.deepEqual([proof.sourceOnly, proof.native, proof.runtime, proof.priorResultsTransferred], [true, false, false, false]);
    assert.equal(String(ciDeedRecoveryHistoricalInput(file, input)), predecessor);
    assert.equal(Buffer.isBuffer(ciDeedRecoveryHistoricalInput(file, input)), Buffer.isBuffer(input)); positives++;
  }
  assert.equal(ciDeedRecoveryHistoricalEntry(file, actualEntry, 'tree'), git('ls-tree', source.predecessor, '--', file));
  assert.equal(ciDeedRecoveryHistoricalEntry(file, actualIndex, 'index').trim(), row.baseline.mode + ' ' + row.baseline.blob + ' 0\t' + file);
  const record = { raw: Buffer.from(current), content: current, pin: { ...row.current, rawSha256: { lf: sha(current), crlf: sha(current.replaceAll('\n', '\r\n')) } } };
  const historical = ciDeedRecoveryHistoricalRecord(file, record); assert.equal(historical.content, predecessor); assert.equal(historical.pin.blob, row.baseline.blob);
  for (const altered of [current + '\n', current.slice(1), '\ufeff' + current, current + '\0', current.replace(/\S/, '?'), current.replace('\n', '\r\n'), predecessor]) {
    assert.notEqual(altered, current); assert.throws(() => qualifyCiDeedRecoverySource(file, altered));
    assert.strictEqual(ciDeedRecoveryHistoricalInput(file, altered), altered); refusals++;
  }
  for (const hunk of row.inverses) {
    const partial = current.slice(0, hunk.at) + hunk.baseline + current.slice(hunk.at + hunk.current.length);
    assert.notEqual(partial, current); assert.strictEqual(ciDeedRecoveryHistoricalInput(file, partial), partial); refusals++;
  }
  for (const [entry, kind] of [[actualEntry.replace(row.current.blob, row.baseline.blob), 'tree'], [actualIndex.replace(row.current.blob, '0'.repeat(40)), 'index']]) {
    assert.throws(() => ciDeedRecoveryHistoricalEntry(file, entry, kind)); refusals++;
  }
  for (const entry of [' ' + actualEntry, actualEntry + '\n', actualEntry.trim() + '\r\n']) {
    assert.throws(() => ciDeedRecoveryHistoricalEntry(file, entry, 'tree')); refusals++;
  }
  assert.throws(() => ciDeedRecoveryHistoricalRecord(file, { ...record, raw: Buffer.from(current + '\n') })); refusals++;
  for (const changed of [
    { ...record, content: current + '\n' },
    { ...record, content: current.replaceAll('\n', '\r\n'), raw: Buffer.from(current.replaceAll('\n', '\r\n')) },
    { ...record, pin: { ...record.pin, bytes: record.pin.bytes + 1 } },
    { ...record, pin: { ...record.pin, mode: '120000' } },
    { ...record, pin: { ...record.pin, sha256: '0'.repeat(64) } },
    { ...record, pin: { ...record.pin, rawSha256: { ...record.pin.rawSha256, lf: '0'.repeat(64) } } },
    { ...record, pin: { ...record.pin, rawSha256: { ...record.pin.rawSha256, crlf: '0'.repeat(64) } } },
  ]) { assert.throws(() => ciDeedRecoveryHistoricalRecord(file, changed)); refusals++; }
  assert.throws(() => ciDeedRecoveryHistoricalInput(file, Buffer.from([255])), /lossless/i); refusals++;
}
for (const file of ['../public/index.html', '__proto__', 'constructor', 'schema.sql', 'tools/enterprise-native-economic-release-inputs.js']) {
  const input = Buffer.from([255]); assert.strictEqual(ciDeedRecoveryHistoricalInput(file, input), input);
  assert.throws(() => qualifyCiDeedRecoverySource(file, 'unknown')); refusals++;
}
assert.throws(() => ciDeedRecoveryHistoricalEntry('public/index.html', '', 'unknown'));
console.log(JSON.stringify({ status: 'PASS_SOURCE_ONLY', domains: Object.keys(source.files).length, positives, refusals, runtime: false, native: false, priorResultsTransferred: false }));
