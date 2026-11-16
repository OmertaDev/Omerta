// Source-only qualification of the actual native garage successor; no execution results transfer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { NATIVE_GARAGE_SOURCE as source, NATIVE_GARAGE_SCOPE, NATIVE_GARAGE_GENERATED_FILES,
  assertNativeGarageCurrentSource, nativeGarageActual, qualifyNativeGarageSource,
  nativeGarageHistoricalInput, nativeGarageHistoricalEntry, nativeGarageHistoricalRecord } from '../tools/native-garage-source-transfer.js';

const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  windowsHide: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
});
assertNativeGarageCurrentSource();
assert.equal(new Set(NATIVE_GARAGE_SCOPE).size, NATIVE_GARAGE_SCOPE.length);
assert(!NATIVE_GARAGE_SCOPE.includes('schema.sql') && !NATIVE_GARAGE_SCOPE.includes('src/db.js'));
assert(NATIVE_GARAGE_GENERATED_FILES.includes('tools/native-garage-source-data.js'));
let positives = 0, refusals = 0;
const entry = (file, pin, kind) => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\t' + file
  : pin.mode + ' ' + pin.blob + ' 0\t' + file;
for (const [file, row] of Object.entries(source.files)) {
  const actual = nativeGarageActual(file), current = actual.committed.toString('utf8');
  const before = git('show', source.predecessor + ':' + file);
  for (const input of [current, current.replaceAll('\n', '\r\n'), actual.committed, actual.physical]) {
    const proof = qualifyNativeGarageSource(file, input);
    assert.equal(proof.baselineText, before);
    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.migration, proof.financial,
      proof.activation, proof.deployment, proof.priorResultsTransferred], [true, false, false, false, false, false, false, false]);
    assert.equal(String(nativeGarageHistoricalInput(file, input)), before); positives++;
  }
  const historical = nativeGarageHistoricalRecord(file, actual);
  assert(historical.committed.equals(Buffer.from(before)));
  assert.deepEqual(historical.head, { mode: row.baseline.mode, blob: row.baseline.blob });
  assert.strictEqual(nativeGarageHistoricalRecord(file, historical), historical); positives += 3;
  for (const kind of ['tree', 'index']) {
    assert.equal(nativeGarageHistoricalEntry(file, entry(file, row.current, kind), kind), entry(file, row.baseline, kind));
    const forged = entry(file, row.current, kind).replace(row.current.blob, '0'.repeat(40));
    assert.equal(nativeGarageHistoricalEntry(file, forged, kind), forged); positives++; refusals++;
  }
  for (const input of [current + '\n// unreviewed\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), null]) {
    assert.throws(() => qualifyNativeGarageSource(file, input));
    assert.strictEqual(nativeGarageHistoricalInput(file, input), input); refusals++;
  }
  assert.throws(() => nativeGarageHistoricalInput(file, Buffer.from([255])), /Lossless UTF-8/); refusals++;
  for (const changed of [{ ...actual, index: actual.index.replace(actual.head.blob, '0'.repeat(40)) },
    { ...actual, committed: Buffer.concat([actual.committed, Buffer.from('x')]) },
    { ...actual, physical: Buffer.concat([actual.physical, Buffer.from('x')]) },
    { ...actual, symbolic: true }, { ...actual, regular: false }, { ...actual, extra: true }]) {
    assert.throws(() => nativeGarageHistoricalRecord(file, changed)); refusals++;
  }
}
for (const file of Object.keys(source.additions)) {
  const actual = nativeGarageActual(file);
  assert.strictEqual(nativeGarageHistoricalRecord(file, actual), actual);
  assert.strictEqual(nativeGarageHistoricalInput(file, actual.committed), actual.committed);
  assert.throws(() => qualifyNativeGarageSource(file, actual.committed)); positives += 2; refusals++;
}
assert.strictEqual(nativeGarageHistoricalInput('src/unreviewed.js', 'arbitrary'), 'arbitrary');

const observedFile = 'public/index.html', observed = nativeGarageActual(observedFile);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-native-source-'));
const moduleUrl = new URL('../tools/native-garage-source-transfer.js', import.meta.url).href;
try {
  const environment = { ...process.env, GIT_DIR: git('rev-parse', '--absolute-git-dir').trim(),
    GIT_WORK_TREE: temporary, GIT_INDEX_FILE: path.join(temporary, 'reviewed-index') };
  execFileSync('git', ['read-tree', 'HEAD'], { cwd: temporary, env: environment, windowsHide: true });
  fs.mkdirSync(path.join(temporary, 'public'));
  const target = path.join(temporary, observedFile);
  fs.writeFileSync(target, observed.physical);
  const script = 'import { nativeGarageActual } from ' + JSON.stringify(moduleUrl) + '; nativeGarageActual("public/index.html");';
  const child = env => spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: temporary, env, windowsHide: true, encoding: 'utf8',
  });
  assert.equal(child(environment).status, 0); positives++;
  fs.writeFileSync(target, Buffer.from(observed.committed.toString('utf8').replaceAll('\n', '\r\n')));
  assert.equal(child(environment).status, 0); positives++;
  fs.appendFileSync(target, 'x');
  const changed = child(environment); assert.notEqual(changed.status, 0); assert.match(changed.stderr, /Physical source/); refusals++;
  fs.writeFileSync(target, observed.physical);
  const changedIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') });
  assert.notEqual(changedIndex.status, 0); assert.match(changedIndex.stderr, /stage-zero index/); refusals++;

  // A separate local Git repository shares only read-only predecessor objects, never root refs/index.
  const isolated = path.join(temporary, 'git-proof'); fs.mkdirSync(isolated);
  const objects = path.resolve(git('rev-parse', '--git-common-dir').trim(), 'objects');
  const isolatedEnv = { ...process.env, GIT_DIR: path.join(isolated, '.git'), GIT_WORK_TREE: isolated,
    GIT_INDEX_FILE: path.join(isolated, 'index'), GIT_ALTERNATE_OBJECT_DIRECTORIES: objects,
    GIT_AUTHOR_NAME: 'Source fixture', GIT_AUTHOR_EMAIL: 'source@example.test',
    GIT_COMMITTER_NAME: 'Source fixture', GIT_COMMITTER_EMAIL: 'source@example.test' };
  const localGit = (args, input) => execFileSync('git', args, { cwd: isolated, env: isolatedEnv,
    windowsHide: true, encoding: 'utf8', input });
  localGit(['init', '--quiet', isolated]); localGit(['read-tree', git('rev-parse', 'HEAD').trim()]);
  const extra = localGit(['hash-object', '-w', '--stdin'], 'unreviewed\n').trim();
  localGit(['update-index', '--add', '--cacheinfo', '100644', extra, 'src/unreviewed.js']);
  const tree = localGit(['write-tree']).trim();
  const commit = localGit(['commit-tree', tree, '-p', git('rev-parse', 'HEAD').trim()], 'Unreviewed source fixture\n').trim();
  localGit(['update-ref', 'HEAD', commit]);
  const check = spawnSync(process.execPath, ['--input-type=module', '-e',
    'import { assertNativeGarageCurrentSource } from ' + JSON.stringify(moduleUrl) + '; assertNativeGarageCurrentSource();'],
  { cwd: isolated, env: isolatedEnv, windowsHide: true, encoding: 'utf8' });
  assert.notEqual(check.status, 0); assert.match(check.stderr, /Only fixed independently generated domains/); refusals++;
} finally {
  assert(path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep)
    && path.basename(temporary).startsWith('omerta-native-source-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
console.log(JSON.stringify({ phase: 'NATIVE_GARAGE_EXACT_SUCCESSOR_SOURCE_ONLY', positives, refusals,
  sourceInputs: NATIVE_GARAGE_SCOPE.length, sourceOnly: true, runtime: false, native: false,
  financial: false, deployment: false, priorResultsTransferred: false }));
