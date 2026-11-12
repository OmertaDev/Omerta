// Whole current source qualifies before the immutable historical comparison is reconstructed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { UI_TRIM_SOURCE as source, uiTrimSourceDataBytes, qualifyUiTrimSource,
  uiTrimHistoricalInput, uiTrimHistoricalEntry, uiTrimHistoricalRecord } from '../tools/ui-trim-source-transfer.js';

const predecessor = '42e7c7648d74bbdd1cd38da0f3f61a72a7abc831';
const metadata = 'tools/ui-trim-source-data.js';
const generated = new Set([metadata]);
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const sha = input => createHash('sha256').update(input).digest('hex');
const blob = input => createHash('sha1').update('blob ' + Buffer.byteLength(input) + '\0').update(input).digest('hex');
assert.equal(source.status, 'SEALED'); assert.equal(source.predecessor, predecessor);
assert.equal(source.phase, 'EXACT_UI_TRIM_SOURCE_COMPARISON_ONLY');
for (const [revision, tree] of [[source.revision, source.tree], [source.predecessor, source.predecessorTree]])
  assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);
git('merge-base', '--is-ancestor', predecessor, source.revision);
git('merge-base', '--is-ancestor', source.revision, 'HEAD');
const changed = status => git('diff', '--name-only', '--no-renames', '--diff-filter=' + status,
  '-z', predecessor, source.revision).split('\0').filter(file => file && !generated.has(file));
assert.deepEqual(Object.keys(source.files), changed('M'), 'Every reviewed modification is independently pinned');
assert.deepEqual(Object.keys(source.additions), changed('A'), 'Every new helper is independently pinned');
assert.deepEqual(changed('DRTCUXB'), [], 'No historical file deletion or type replacement');
assert.equal(fs.readFileSync(metadata, 'utf8').replaceAll('\r\n', '\n'), uiTrimSourceDataBytes(source),
  'The only self-reference is exact generated data');
for (const file of generated) assert(!Object.hasOwn(source.files, file) && !Object.hasOwn(source.additions, file),
  'Generated metadata cannot inherit a historical source proof');
function actual(file, pin) {
  const committed = Buffer.from(git('show', 'HEAD:' + file));
  const authored = Buffer.from(git('show', source.revision + ':' + file));
  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);
  const headEntry = git('ls-tree', 'HEAD', '--', file).trim();
  const index = git('ls-files', '--stage', '--', file).trim();
  assert(headEntry === `${pin.mode} blob ${pin.blob}\t${file}` && index === `${pin.mode} ${pin.blob} 0\t${file}`,
    'Complete current HEAD and stage-zero identities: ' + file);
  assert(committed.equals(authored), 'Actual source remains the exact reviewed authored source: ' + file);
  assert.equal(sha(committed), pin.sha256); assert.equal(blob(committed), pin.blob); assert.equal(committed.length, pin.bytes);
  assert(stat.isFile() && !stat.isSymbolicLink());
  assert(physical.equals(committed) || physical.equals(Buffer.from(committed.toString('utf8').replaceAll('\n', '\r\n'))),
    'Whole actual physical source remains uniform LF or CRLF: ' + file);
  return { head: { mode: pin.mode, blob: pin.blob }, index, committed, physical,
    regular: stat.isFile(), symbolic: stat.isSymbolicLink() };
}
assert.equal(git('diff', '--name-only', predecessor, source.revision, '--', 'src', 'schema.sql', 'render.yaml', 'package-lock.json'), '',
  'No gameplay, server, schema, deployment settings or dependency changes');
let positives = 0, refusals = 0;
for (const [file, row] of Object.entries(source.files)) {
  const current = actual(file, row.current), text = current.committed.toString('utf8');
  const baseline = git('show', predecessor + ':' + file);
  assert.equal(sha(baseline), row.baseline.sha256); assert.equal(blob(baseline), row.baseline.blob);
  assert.equal(Buffer.byteLength(baseline), row.baseline.bytes);
  for (const input of [text, text.replaceAll('\n', '\r\n'), Buffer.from(text), current.physical]) {
    const proof = qualifyUiTrimSource(file, input);
    assert.equal(proof.baselineText, baseline);
    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.migration, proof.financial,
      proof.activation, proof.deployment, proof.priorResultsTransferred], [true, false, false, false, false, false, false, false]);
    assert.equal(String(uiTrimHistoricalInput(file, input)), baseline);
    assert.equal(Buffer.isBuffer(uiTrimHistoricalInput(file, input)), Buffer.isBuffer(input)); positives++;
  }
  const historical = uiTrimHistoricalRecord(file, current);
  assert.equal(historical.committed.toString('utf8'), baseline);
  assert.deepEqual(historical.head, { mode: row.baseline.mode, blob: row.baseline.blob }); positives++;
  for (const kind of ['tree', 'index']) {
    const format = pin => kind === 'tree' ? `${pin.mode} blob ${pin.blob}\t${file}` : `${pin.mode} ${pin.blob} 0\t${file}`;
    for (const suffix of ['', '\n']) assert.equal(uiTrimHistoricalEntry(file, format(row.current) + suffix, kind), format(row.baseline) + suffix);
    for (const changed of [' ' + format(row.current), format(row.current) + '\n\n', format(row.current).replace(row.current.blob, '0'.repeat(40))])
      assert.equal(uiTrimHistoricalEntry(file, changed, kind), changed);
  }
  for (const changed of [text + '\n// unreviewed change\n', text.slice(1), '\ufeff' + text, text + '\0',
    text.replace('\n', '\r\n'), text.replace('\n', '\r'), null]) {
    assert.throws(() => qualifyUiTrimSource(file, changed));
    assert.strictEqual(uiTrimHistoricalInput(file, changed), changed); refusals++;
  }
  for (const patch of [{ index: current.index.replace(row.current.blob, '0'.repeat(40)) },
    { head: { ...current.head, mode: '120000' } }, { regular: false }, { symbolic: true },
    { physical: Buffer.concat([current.physical, Buffer.from('x')]) }, { committed: Buffer.from(baseline) }]) {
    assert.throws(() => uiTrimHistoricalRecord(file, { ...current, ...patch })); refusals++;
  }
  for (const inverse of row.inverses) {
    const changed = text.slice(0, inverse.at) + inverse.baseline + text.slice(inverse.at + inverse.current.length);
    assert.throws(() => qualifyUiTrimSource(file, changed));
    assert.equal(uiTrimHistoricalInput(file, changed), changed); refusals++;
  }
  const invalidUtf8 = Buffer.from([0xff]);
  for (const reader of [qualifyUiTrimSource, uiTrimHistoricalInput]) {
    assert.throws(() => reader(file, invalidUtf8), error => error.code === 'ERR_ASSERTION'
      && /Lossless UTF-8/.test(error.message) && /lossless UTF-8/.test(error.message)); refusals++;
  }
}
for (const [file, pin] of Object.entries(source.additions)) {
  const current = actual(file, pin);
  assert.equal(git('ls-tree', predecessor, '--', file).trim(), '');
  assert.throws(() => qualifyUiTrimSource(file, current.committed));
  assert.strictEqual(uiTrimHistoricalInput(file, current.committed), current.committed); positives++;
}
for (const file of ['__proto__', 'constructor', 'src/unknown.js']) {
  const input = Buffer.from([0xff]); assert.strictEqual(uiTrimHistoricalInput(file, input), input);
  assert.throws(() => qualifyUiTrimSource(file, 'unknown source')); refusals++;
}
assert.throws(() => git('grep', '-n', 'ui-trim-source-', '--', 'src', 'public'), error => error.status === 1,
  'Actual runtime does not load historical ui-trim views');
console.log(JSON.stringify({ phase: source.phase, authoredRevision: source.revision, positives, refusals,
  sourceOnly: true, runtime: false, native: false, deployment: false, priorResultsTransferred: false }));
