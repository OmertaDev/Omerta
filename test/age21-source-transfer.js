// Exact source-only evidence for the already-authored age policy. No native/runtime admission.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { AGE21_SOURCE, AGE21_SOURCE_SHA256, assertAge21SourceTransfer,
  age21HistoricalInput } from '../tools/age21-source-transfer.js';

assert.deepEqual(process.argv.slice(2), [], 'Source-only proof has no native/runtime flags');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const files = ['docs/legal-security-setup.md', 'omerta-mcp/README.md', 'src/age.js',
  'src/legal.js', 'src/server.js', 'test/age.js', 'test/legal-security.js'];
assert.equal(AGE21_SOURCE.revision, '837f0e45558be03d65b8a4584018c20ff7f69dbc');
assert.equal(AGE21_SOURCE.predecessorRevision, 'a24df18ea1a0b57f25df942675dd9fef7415f275');
assert.equal(hash(JSON.stringify(AGE21_SOURCE)), AGE21_SOURCE_SHA256);
assert.deepEqual(Object.keys(AGE21_SOURCE.files), files);
assert.deepEqual(git('diff', '--name-only', AGE21_SOURCE.predecessorRevision,
  AGE21_SOURCE.revision).trim().split('\n'), files, 'Exact authored commit scope');
for (const [revision, tree] of [[AGE21_SOURCE.revision, AGE21_SOURCE.tree],
  [AGE21_SOURCE.predecessorRevision, AGE21_SOURCE.predecessorTree]])
  assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);
execFileSync('git', ['--no-replace-objects', 'merge-base', '--is-ancestor', AGE21_SOURCE.predecessorRevision, AGE21_SOURCE.revision]);

function actualInverses(diff) {
  const hunks = []; let current, priorKind;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@ ')) { current = { current: '', baseline: '' }; hunks.push(current); continue; }
    if (!current) continue;
    if (line.startsWith('\\ No newline at end of file')) {
      if (priorKind !== '-') current.current = current.current.slice(0, -1);
      if (priorKind !== '+') current.baseline = current.baseline.slice(0, -1);
    } else if ([' ', '+', '-'].includes(line[0])) {
      priorKind = line[0];
      if (priorKind !== '-') current.current += line.slice(1) + '\n';
      if (priorKind !== '+') current.baseline += line.slice(1) + '\n';
    }
  }
  return hunks;
}

let positives = 0, refusals = 0;
for (const file of files) {
  const row = AGE21_SOURCE.files[file];
  const current = git('show', AGE21_SOURCE.revision + ':' + file);
  const baseline = git('show', AGE21_SOURCE.predecessorRevision + ':' + file);
  assert(!current.includes('\r') && !baseline.includes('\r'), 'Actual authored text is LF');
  assert(Object.isFrozen(row) && Object.isFrozen(row.inverses)
    && row.inverses.every(Object.isFrozen), 'Literal evidence stays immutable');
  for (const [revision, text, pin] of [[AGE21_SOURCE.revision, current, row.current],
    [AGE21_SOURCE.predecessorRevision, baseline, row.baseline]]) {
    assert.equal(git('ls-tree', revision, '--', file).trim(), pin.mode + ' blob ' + pin.lf.blob + '\t' + file);
    for (const [variant, raw] of [['lf', text], ['crlf', text.replaceAll('\n', '\r\n')]]) {
      assert.equal(hash(raw), pin[variant].sha256);
      assert.equal(blob(raw), pin[variant].blob);
      assert.equal(Buffer.byteLength(raw), pin[variant].bytes);
    }
  }
  assert.deepEqual(row.inverses, actualInverses(git('diff', '--no-ext-diff', '--no-renames',
    '--unified=3', AGE21_SOURCE.predecessorRevision, AGE21_SOURCE.revision, '--', file)), 'Hunks are the actual authored Git diff');
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const proof = assertAge21SourceTransfer(file, input);
    assert.equal(proof.baselineText, baseline);
    assert.equal(age21HistoricalInput(file, input), baseline);
    assert.deepEqual(age21HistoricalInput(file, Buffer.from(input)), Buffer.from(baseline));
    assert.equal(proof.sourceOnly, true);
    for (const phase of ['native', 'runtime', 'migration', 'financial', 'activation', 'deployment']) assert.equal(proof[phase], false);
    positives++;
  }
  const changed = [current + '\n// arbitrary successor\n', current.slice(1), '\ufeff' + current,
    current + '\0', current.replace('\n', '\r\n'), current.replace('\n', '\r'), baseline];
  for (const inverse of row.inverses) changed.push(current.replace(inverse.current, ''),
    current.replace(inverse.current, () => inverse.current + inverse.current));
  if (row.inverses.length > 1) {
    const [first, second] = row.inverses;
    changed.push(current.replace(first.current, '\u0001').replace(second.current, first.current).replace('\u0001', second.current));
  }
  for (const input of changed) {
    assert.throws(() => assertAge21SourceTransfer(file, input));
    assert.equal(age21HistoricalInput(file, input), input, 'Unknown or predecessor bytes remain raw for the original guard');
    refusals++;
  }
  const invalidUtf8 = Buffer.concat([Buffer.from(current), Buffer.from([0xff])]);
  assert.throws(() => age21HistoricalInput(file, invalidUtf8), /Lossless UTF-8/);
  assert.throws(() => assertAge21SourceTransfer(file, current, Object.freeze({ ...AGE21_SOURCE })));
  refusals += 2;
}
for (const file of ['../src/server.js', '__proto__', 'constructor', 'src/unknown.js']) {
  assert.throws(() => assertAge21SourceTransfer(file, 'unknown'));
  assert.equal(age21HistoricalInput(file, 'unknown'), 'unknown'); refusals++;
}
console.log(JSON.stringify({ phase: 'PASS_EXACT_AGE21_SOURCE_ONLY', files: files.length,
  positives, refusals, nativeAdmission: false, runtimeAdmission: false }));
