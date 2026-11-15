// Actual successor source qualifies first; all earlier comparisons remain historical only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { AGE_REMOVAL_SOURCE, ageRemovalHistoricalRecord } from '../tools/age-removal-source-transfer.js';
import { GRAND_STRATEGY_SOURCE as source, GRAND_STRATEGY_PREDECESSOR, GRAND_STRATEGY_SCOPE,
  GRAND_STRATEGY_GENERATED_FILES, GRAND_STRATEGY_RELEASE_FILES, grandStrategySourceDataBytes,
  grandStrategyActual, qualifyGrandStrategySource, grandStrategyHistoricalInput,
  grandStrategyHistoricalEntry, grandStrategyHistoricalRecord } from '../tools/grand-strategy-source-transfer.js';
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const sha = value => createHash('sha256').update(value).digest('hex');
const blob = value => createHash('sha1').update('blob ' + Buffer.byteLength(value) + '\0').update(value).digest('hex');
const entry = (file, pin, kind) => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\t' + file
  : pin.mode + ' ' + pin.blob + ' 0\t' + file;
assert.equal(source.status, 'SEALED', 'An unsealed successor never inherits a historical comparison');
assert.equal(source.phase, 'EXACT_GRAND_STRATEGY_SOURCE_COMPARISON_ONLY');
assert.equal(source.predecessor, GRAND_STRATEGY_PREDECESSOR);
assert.equal(GRAND_STRATEGY_RELEASE_FILES.length, 99, 'The original release input set is finite');
for (const [revision, tree] of [[source.revision, source.tree], [source.predecessor, source.predecessorTree]])
  assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);
git('merge-base', '--is-ancestor', source.predecessor, source.revision);
git('merge-base', '--is-ancestor', source.revision, 'HEAD');
const excluded = new Set(GRAND_STRATEGY_GENERATED_FILES);
const changes = kind => git('diff', '--name-only', '--no-renames', '--diff-filter=' + kind,
  '-z', source.predecessor, source.revision).split('\0').filter(file => file && !excluded.has(file));
assert.deepEqual(Object.keys(source.files), changes('M'));
assert.deepEqual(Object.keys(source.additions), changes('A'));
assert.deepEqual(changes('DRTCUXB'), []);
assert.deepEqual([...Object.keys(source.files), ...Object.keys(source.additions)].sort(),
  GRAND_STRATEGY_SCOPE.filter(file => !excluded.has(file)), 'Every authored runtime, test, helper and binary asset has one exact pin');
for (const file of excluded) assert(!Object.hasOwn(source.files, file) && !Object.hasOwn(source.additions, file));
const postCandidate = git('diff', '--name-only', '--no-renames', '-z', source.revision, 'HEAD').split('\0').filter(Boolean);
assert(postCandidate.every(file => excluded.has(file)), 'Only the fixed independently generated domains may follow the reviewed candidate');
assert.equal(fs.readFileSync('tools/grand-strategy-source-data.js', 'utf8').replaceAll('\r\n', '\n'), grandStrategySourceDataBytes(source),
  'The sole generated self-reference contains exact data and no executable additions');
assert.equal(git('diff', '--name-only', source.predecessor, 'HEAD', '--',
  'tools/ui-trim-source-data.js', 'tools/age-removal-source-data.js'), '', 'Every earlier sealed historical pin remains immutable');

// Batch genuine identity reads, then fingerprint whole physical text/binary inputs.
const pins = Object.fromEntries([...Object.entries(source.files).map(([file, row]) => [file, { ...row.current, text: true }]),
  ...Object.entries(source.additions)]);
const names = Object.keys(pins);
const rows = output => new Map(output.split('\0').filter(Boolean).map(row => [row.slice(row.indexOf('\t') + 1), row]));
const heads = rows(git('ls-tree', '-z', 'HEAD', '--', ...names));
const indexes = rows(git('ls-files', '--stage', '-z', '--', ...names));
for (const [file, pin] of Object.entries(pins)) {
  assert.equal(heads.get(file), entry(file, pin, 'tree'), 'Whole genuine HEAD identity: ' + file);
  assert.equal(indexes.get(file), entry(file, pin, 'index'), 'Whole genuine stage-zero identity: ' + file);
  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());
  const physical = fs.readFileSync(file);
  let canonical = physical;
  if (pin.text) {
    const raw = physical.toString('utf8'); assert(Buffer.from(raw).equals(physical));
    const lf = raw.replaceAll('\r\n', '\n');
    assert(!/[\r\0\ufeff]/.test(lf) && (raw === lf || raw === lf.replaceAll('\n', '\r\n')));
    canonical = Buffer.from(lf);
  }
  assert.equal(canonical.length, pin.bytes); assert.equal(sha(canonical), pin.sha256); assert.equal(blob(canonical), pin.blob);
}
let positives = 0, refusals = 0;
for (const [file, row] of Object.entries(source.files)) {
  const actual = grandStrategyActual(file), current = actual.committed.toString('utf8');
  const before = git('show', source.predecessor + ':' + file);
  for (const input of [current, current.replaceAll('\n', '\r\n'), Buffer.from(current), actual.physical]) {
    const proof = qualifyGrandStrategySource(file, input);
    assert.equal(proof.baselineText, before);
    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.migration, proof.financial,
      proof.activation, proof.deployment, proof.priorResultsTransferred], [true, false, false, false, false, false, false, false]);
    const projected = grandStrategyHistoricalInput(file, input);
    assert.equal(String(projected), before);
    assert.equal(Buffer.isBuffer(projected), Buffer.isBuffer(input)); positives++;
  }
  const historical = grandStrategyHistoricalRecord(file, actual);
  assert.equal(historical.committed.toString('utf8'), before);
  assert.deepEqual(historical.head, { mode: row.baseline.mode, blob: row.baseline.blob });
  assert.strictEqual(grandStrategyHistoricalRecord(file, historical), historical, 'Prior tuples acquire no new qualification');
  for (const physical of [actual.committed, Buffer.from(current.replaceAll('\n', '\r\n'))]) {
    assert.deepEqual(grandStrategyHistoricalRecord(file, { ...actual, physical }), historical,
      'Complete LF and CRLF supplied records retain the same historical identity'); positives++;
  }
  assert.throws(() => qualifyGrandStrategySource(file, before)); refusals++; positives++;
  for (const kind of ['tree', 'index']) {
    for (const suffix of ['', '\n'])
      assert.equal(grandStrategyHistoricalEntry(file, entry(file, row.current, kind) + suffix, kind), entry(file, row.baseline, kind) + suffix);
    for (const value of [' ' + entry(file, row.current, kind), entry(file, row.current, kind) + '\n\n',
      entry(file, row.current, kind).replace(row.current.blob, '0'.repeat(40))]) {
      assert.equal(grandStrategyHistoricalEntry(file, value, kind), value); refusals++;
    }
  }
  for (const value of [current + '\n// unreviewed successor\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), null]) {
    assert.throws(() => qualifyGrandStrategySource(file, value));
    assert.strictEqual(grandStrategyHistoricalInput(file, value), value); refusals++;
  }
  const invalid = Buffer.from([0xff]);
  assert.throws(() => qualifyGrandStrategySource(file, invalid), /Lossless UTF-8/);
  assert.throws(() => grandStrategyHistoricalInput(file, invalid), /Lossless UTF-8/); refusals += 2;
}
const observedFile = 'public/index.html', observed = grandStrategyActual(observedFile);
const priorObserved = grandStrategyHistoricalRecord(observedFile, observed);
for (const file of ['public/index.html', 'public/sw.js', 'src/server.js']) {
  const actual = grandStrategyActual(file), pin = AGE_REMOVAL_SOURCE.files[file].baseline;
  for (const physical of [actual.committed, Buffer.from(actual.committed.toString('utf8').replaceAll('\n', '\r\n'))]) {
    const historical = ageRemovalHistoricalRecord(file, { ...actual, physical });
    assert.deepEqual(historical.head, { mode: pin.mode, blob: pin.blob });
    assert.equal(historical.index, entry(file, pin, 'index'));
    assert.equal(historical.committed.length, pin.bytes); assert.equal(sha(historical.committed), pin.sha256);
    assert.equal(blob(historical.committed), pin.blob); assert(historical.physical.equals(historical.committed));
    assert.equal(historical.regular, true); assert.equal(historical.symbolic, false); positives++;
  }
}
assert.throws(() => grandStrategyHistoricalRecord(observedFile, { ...priorObserved, head: { ...priorObserved.head, extra: true } })); refusals++;
for (const patch of [{ head: { ...observed.head, mode: '120000' } },
  { index: observed.index.replace(observed.head.blob, '0'.repeat(40)) }, { regular: false }, { symbolic: true },
  { physical: Buffer.concat([observed.physical, Buffer.from('x')]) },
  { physical: observed.committed.subarray(1) }, { physical: priorObserved.committed },
  { physical: Buffer.from(observed.committed.toString('utf8').replace('\n', '\r\n')) },
  { physical: Buffer.from(observed.committed.toString('utf8').replace('\n', '\r')) },
  { physical: Buffer.concat([Buffer.from('\ufeff'), observed.committed]) },
  { physical: Buffer.concat([observed.committed, Buffer.from('\0')]) }, { physical: Buffer.from([0xff]) },
  { committed: Buffer.concat([observed.committed, Buffer.from('x')]) }, { extra: true }]) {
  for (const qualify of [grandStrategyHistoricalRecord, ageRemovalHistoricalRecord]) {
    assert.throws(() => qualify(observedFile, { ...observed, ...patch })); refusals++;
  }
}
assert.equal(git('ls-tree', '-z', source.predecessor, '--', ...Object.keys(source.additions)), '',
  'An added source or binary asset has no predecessor record');
for (const file of Object.keys(source.additions)) {
  const input = Buffer.from('new files have no predecessor');
  assert.throws(() => qualifyGrandStrategySource(file, input));
  assert.strictEqual(grandStrategyHistoricalInput(file, input), input); refusals++;
}
for (const file of ['__proto__', 'constructor', 'src/unreviewed-successor.js']) {
  const input = Buffer.from([0xff]); assert.throws(() => qualifyGrandStrategySource(file, input));
  assert.strictEqual(grandStrategyHistoricalInput(file, input), input); refusals++;
}
// Genuine index/physical refusal controls use an isolated alternate index/work tree, never the caller's checkout.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-grand-source-'));
try {
  const environment = { ...process.env, GIT_DIR: git('rev-parse', '--absolute-git-dir').trim(),
    GIT_WORK_TREE: temporary, GIT_INDEX_FILE: path.join(temporary, 'reviewed-index') };
  execFileSync('git', ['--no-replace-objects', 'read-tree', 'HEAD'], { cwd: temporary, env: environment, windowsHide: true });
  fs.mkdirSync(path.join(temporary, 'public')); fs.writeFileSync(path.join(temporary, observedFile), observed.physical);
  const script = 'import { grandStrategyActual } from ' + JSON.stringify(new URL('../tools/grand-strategy-source-transfer.js', import.meta.url).href)
    + '; grandStrategyActual(' + JSON.stringify(observedFile) + ');';
  const child = (env, code = script) => spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: temporary, env, windowsHide: true, encoding: 'utf8',
  });
  const historicalScript = 'import { execFileSync } from "node:child_process"; import { GRAND_STRATEGY_SOURCE as source, grandStrategyHistoricalRecord } from '
    + JSON.stringify(new URL('../tools/grand-strategy-source-transfer.js', import.meta.url).href)
    + '; const file = ' + JSON.stringify(observedFile)
    + '; const pin = source.files[file].baseline; const bytes = execFileSync("git", ["--no-replace-objects", "show", source.predecessor + ":" + file], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });'
    + ' grandStrategyHistoricalRecord(file, { head: { mode: pin.mode, blob: pin.blob }, index: pin.mode + " " + pin.blob + " 0\\t" + file,'
    + ' committed: bytes, physical: bytes, regular: true, symbolic: false });';
  const currentRecordScript = ending => 'import { execFileSync } from "node:child_process"; import { GRAND_STRATEGY_SOURCE as source, grandStrategyHistoricalRecord } from '
    + JSON.stringify(new URL('../tools/grand-strategy-source-transfer.js', import.meta.url).href)
    + '; import { ageRemovalHistoricalRecord } from ' + JSON.stringify(new URL('../tools/age-removal-source-transfer.js', import.meta.url).href)
    + '; const file = ' + JSON.stringify(observedFile)
    + '; const pin = source.files[file].current; const bytes = execFileSync("git", ["--no-replace-objects", "show", "HEAD:" + file], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });'
    + ' const physical = ' + (ending === 'LF' ? 'bytes' : 'Buffer.from(bytes.toString("utf8").replaceAll("\\n", "\\r\\n"))') + ';'
    + ' for (const qualify of [grandStrategyHistoricalRecord, ageRemovalHistoricalRecord]) qualify(file, { head: { mode: pin.mode, blob: pin.blob }, index: pin.mode + " " + pin.blob + " 0\\t" + file,'
    + ' committed: bytes, physical, regular: true, symbolic: false });';
  assert.equal(child(environment).status, 0, 'Genuine closed source succeeds in an isolated checkout');
  assert.equal(child(environment, historicalScript).status, 0, 'Historical tuples are idempotent only after genuine current admission');
  for (const physical of [observed.committed, Buffer.from(observed.committed.toString('utf8').replaceAll('\n', '\r\n'))]) {
    fs.writeFileSync(path.join(temporary, observedFile), physical);
    for (const ending of ['LF', 'CRLF']) {
      assert.equal(child(environment, currentRecordScript(ending)).status, 0,
        'Genuine LF/CRLF disk bytes admit either whole supplied representation through the historical chain'); positives += 2;
    }
  }
  fs.writeFileSync(path.join(temporary, observedFile), observed.physical);
  fs.appendFileSync(path.join(temporary, observedFile), 'x');
  const changed = child(environment); assert.notEqual(changed.status, 0); assert.match(changed.stderr, /Physical source/); refusals++;
  const forgedPrior = child(environment, historicalScript); assert.notEqual(forgedPrior.status, 0);
  assert.match(forgedPrior.stderr, /Physical source/); refusals++;
  const forgedCurrent = child(environment, currentRecordScript('LF')); assert.notEqual(forgedCurrent.status, 0);
  assert.match(forgedCurrent.stderr, /Physical source/); refusals++;
  fs.writeFileSync(path.join(temporary, observedFile), observed.physical);
  const changedIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') });
  assert.notEqual(changedIndex.status, 0); assert.match(changedIndex.stderr, /stage-zero index/); refusals++;
  const forgedIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') }, historicalScript);
  assert.notEqual(forgedIndex.status, 0); assert.match(forgedIndex.stderr, /stage-zero index/); refusals++;
  const forgedCurrentIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') }, currentRecordScript('LF'));
  assert.notEqual(forgedCurrentIndex.status, 0); assert.match(forgedCurrentIndex.stderr, /stage-zero index/); refusals++;
} finally {
  assert(path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(temporary).startsWith('omerta-grand-source-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
console.log(JSON.stringify({ phase: 'GRAND_STRATEGY_EXACT_SUCCESSOR_SOURCE_ONLY', positives, refusals,
  sourceInputs: names.length, sourceOnly: true, runtime: false, native: false, financial: false,
  deployment: false, priorResultsTransferred: false }));
