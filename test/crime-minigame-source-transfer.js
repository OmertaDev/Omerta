// Whole actual source qualifies before any earlier historical-only comparison.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { CRIME_MINIGAME_SOURCE as source, CRIME_MINIGAME_PREDECESSOR, CRIME_MINIGAME_GENERATED_FILES,
  qualifyCrimeMinigameRelease, crimeMinigameSourceDataBytes, crimeMinigameActual,
  qualifyCrimeMinigameSource, crimeMinigameHistoricalInput, crimeMinigameHistoricalEntry,
  crimeMinigameHistoricalRecord } from '../tools/crime-minigame-source-compatibility.js';
import { grandStrategyActual } from '../tools/grand-strategy-source-transfer.js';

const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const sha = (value) => createHash('sha256').update(value).digest('hex');
const entry = (file, pin, kind) => kind === 'tree' ? `${pin.mode} blob ${pin.blob}\t${file}` : `${pin.mode} ${pin.blob} 0\t${file}`;
const release = qualifyCrimeMinigameRelease();
assert.equal(source.predecessor, CRIME_MINIGAME_PREDECESSOR);
assert.equal(source.status, 'SEALED');
assert.equal(fs.readFileSync('tools/crime-minigame-source-data.js', 'utf8').replaceAll('\r\n', '\n'), crimeMinigameSourceDataBytes(source));
assert(!CRIME_MINIGAME_GENERATED_FILES.some((file) => file.startsWith('src/') || file.startsWith('public/')),
  'Generated exclusions never include runtime source');
assert.deepEqual(CRIME_MINIGAME_GENERATED_FILES.filter((file) => file.startsWith('knowledge/generated/')).sort(), [
  'knowledge/generated/documents.md', 'knowledge/generated/github-history.md', 'knowledge/generated/graph-summary.md',
  'knowledge/generated/graph.json', 'knowledge/generated/graph.mmd', 'knowledge/generated/inventory.md',
  'knowledge/generated/modules.md', 'knowledge/generated/routes.md',
], 'The eight knowledge outputs form an explicit fixed generated domain');
for (const file of ['public/index.html', 'src/game.js', 'src/server.js', 'src/ux-tactics.js',
  'src/agentgateway.js', 'src/agentturn.js', 'src/task-puzzle-jobs.js', 'tools/grand-strategy-source-transfer.js',
  'test/grand-strategy-source-transfer.js']) assert(Object.hasOwn(source.files, file), 'Required exact inverse: ' + file);
for (const file of ['src/crime-minigame.js', 'public/ux-crime-minigame.js', 'public/ux-crime-minigame.css',
  'tools/crime-minigame-source-compatibility.js', 'tools/seal-crime-minigame-source.js',
  'test/crime-minigame-source-transfer.js']) assert(Object.hasOwn(source.additions, file), 'Required exact addition: ' + file);
assert.equal(git('diff', '--name-only', source.predecessor, 'HEAD', '--',
  'tools/grand-strategy-source-data.js', 'tools/ui-trim-source-data.js', 'tools/age-removal-source-data.js'), '',
  'Earlier historical seals stay immutable');
let positives = 0, refusals = 0;
for (const [file, row] of Object.entries(source.files)) {
  const actual = crimeMinigameActual(file), current = actual.committed.toString('utf8');
  const baseline = git('show', source.predecessor + ':' + file);
  assert.equal(sha(actual.committed), row.current.sha256);
  assert.equal(git('show', source.revision + ':' + file), current);
  for (const input of [current, current.replaceAll('\n', '\r\n'), Buffer.from(current), actual.physical]) {
    const proof = qualifyCrimeMinigameSource(file, input);
    assert.equal(proof.baselineText, baseline);
    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.migration, proof.financial,
      proof.activation, proof.deployment, proof.priorResultsTransferred], [true, false, false, false, false, false, false, false]);
    const historical = crimeMinigameHistoricalInput(file, input);
    assert.equal(String(historical), baseline); assert.equal(Buffer.isBuffer(historical), Buffer.isBuffer(input)); positives++;
  }
  for (const kind of ['tree', 'index']) {
    const identity = entry(file, row.current, kind);
    for (const ending of ['', '\n']) assert.equal(crimeMinigameHistoricalEntry(file, identity + ending, kind), entry(file, row.baseline, kind) + ending);
    for (const mutation of [' ' + identity, identity + '\n\n', identity.replace(row.current.blob, '0'.repeat(40))]) {
      assert.equal(crimeMinigameHistoricalEntry(file, mutation, kind), mutation); refusals++;
    }
  }
  const historical = crimeMinigameHistoricalRecord(file, actual);
  assert.equal(historical.committed.toString('utf8'), baseline);
  assert.deepEqual(historical.head, { mode: row.baseline.mode, blob: row.baseline.blob });
  assert.strictEqual(crimeMinigameHistoricalRecord(file, historical), historical);
  for (const mutation of [current + '\n// unknown successor\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace(/\S/, '?'), current.replace('\n', '\r\n'), current.replace('\n', '\r'), baseline, null]) {
    assert.throws(() => qualifyCrimeMinigameSource(file, mutation));
    assert.strictEqual(crimeMinigameHistoricalInput(file, mutation), mutation); refusals++;
  }
  const invalid = Buffer.from([0xff]);
  assert.throws(() => qualifyCrimeMinigameSource(file, invalid), /Lossless UTF-8/);
  assert.throws(() => crimeMinigameHistoricalInput(file, invalid), /Lossless UTF-8/); refusals += 2;
  for (const inverse of row.inverses) {
    assert.equal(current.slice(inverse.at, inverse.at + inverse.current.length), inverse.current);
    const partial = current.slice(0, inverse.at) + inverse.baseline + current.slice(inverse.at + inverse.current.length);
    assert.notEqual(partial, current);
    assert.throws(() => qualifyCrimeMinigameSource(file, partial));
    assert.equal(crimeMinigameHistoricalInput(file, partial), partial); refusals++;
  }
}
for (const file of Object.keys(source.additions)) {
  const actual = crimeMinigameActual(file);
  assert.equal(git('ls-tree', source.predecessor, '--', file), '', 'An addition has no fabricated empty predecessor');
  assert.equal(sha(actual.committed), source.additions[file].sha256);
  assert.throws(() => qualifyCrimeMinigameSource(file, actual.committed));
  assert.strictEqual(crimeMinigameHistoricalInput(file, actual.committed), actual.committed); positives++; refusals++;
}
for (const file of ['__proto__', 'constructor', 'src/unreviewed-successor.js']) {
  const input = Buffer.from([0xff]); assert.throws(() => qualifyCrimeMinigameSource(file, input));
  assert.strictEqual(crimeMinigameHistoricalInput(file, input), input); refusals++;
}
// A cold historical fixture installs a projecting fs reader after importing
// these qualifiers. Genuine current admission must never recurse into that view.
const originalRead = fs.readFileSync, projectedFiles = ['src/game.js', 'src/server.js'];
const projectByPath = new Map(projectedFiles.map((file) => [path.resolve(file), file]));
let projectedReads = 0;
try {
  fs.readFileSync = (candidate, options) => {
    const raw = originalRead(candidate, options), file = projectByPath.get(path.resolve(candidate));
    if (!file) return raw;
    projectedReads++;
    return crimeMinigameHistoricalInput(file, raw);
  };
  for (const file of projectedFiles) {
    const actual = crimeMinigameActual(file);
    assert.equal(sha(actual.physical.toString('utf8').replaceAll('\r\n', '\n')), source.files[file].current.sha256);
  }
  assert.equal(sha(grandStrategyActual('src/server.js').committed), source.files['src/server.js'].baseline.sha256);
  assert.equal(projectedReads, 0, 'Actual authority never re-enters a projected filesystem read');
  for (const file of projectedFiles)
    assert.equal(sha(fs.readFileSync(file).toString('utf8').replaceAll('\r\n', '\n')), source.files[file].baseline.sha256);
  assert.equal(projectedReads, projectedFiles.length, 'Each explicit fixture read projects exactly once');
  positives += projectedFiles.length * 2 + 1;
} finally { fs.readFileSync = originalRead; }
// Refusal controls use an isolated real index/worktree, leaving the caller untouched.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-crime-source-'));
try {
  const file = 'public/index.html', actual = crimeMinigameActual(file);
  const environment = { ...process.env, GIT_DIR: git('rev-parse', '--absolute-git-dir').trim(),
    GIT_WORK_TREE: temporary, GIT_INDEX_FILE: path.join(temporary, 'reviewed-index') };
  execFileSync('git', ['--no-replace-objects', 'read-tree', 'HEAD'], { cwd: temporary, env: environment, windowsHide: true });
  fs.mkdirSync(path.join(temporary, 'public')); fs.writeFileSync(path.join(temporary, file), actual.physical);
  const script = 'import { crimeMinigameActual } from ' + JSON.stringify(new URL('../tools/crime-minigame-source-compatibility.js', import.meta.url).href)
    + '; crimeMinigameActual("public/index.html");';
  const child = (env) => spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: temporary, env, windowsHide: true, encoding: 'utf8' });
  assert.equal(child(environment).status, 0);
  fs.appendFileSync(path.join(temporary, file), 'x');
  const changed = child(environment); assert.notEqual(changed.status, 0); assert.match(changed.stderr, /Physical source/); refusals++;
  fs.writeFileSync(path.join(temporary, file), actual.physical);
  const index = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') });
  assert.notEqual(index.status, 0); assert.match(index.stderr, /stage-zero index/); refusals++;
} finally {
  assert(path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(temporary).startsWith('omerta-crime-source-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
console.log(JSON.stringify({ phase: source.phase, sourceInputs: release.files.length, positives, refusals,
  sourceOnly: true, runtime: false, native: false, deployment: false, priorResultsTransferred: false }));
