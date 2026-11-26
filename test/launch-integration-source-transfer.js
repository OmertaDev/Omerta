// The real current Git/index/physical source qualifies before any historical projection.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { LAUNCH_INTEGRATION_SOURCE as source, LAUNCH_INTEGRATION_PREDECESSOR,
  LAUNCH_INTEGRATION_REVIEWED_REVISION, LAUNCH_INTEGRATION_REVIEWED_PRODUCT_PATHS,
  LAUNCH_INTEGRATION_AUTHORED_PATHS, assertLaunchIntegrationCurrentSource,
  assertLaunchIntegrationPostCandidatePaths, launchIntegrationActual, qualifyLaunchIntegrationSource,
  launchIntegrationHistoricalInput, launchIntegrationHistoricalEntry,
  launchIntegrationHistoricalRecord } from '../tools/launch-integration-source-transfer.js';

const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const entry = (file, pin, kind) => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\t' + file : pin.mode + ' ' + pin.blob + ' 0\t' + file;
const admitted = assertLaunchIntegrationCurrentSource();
assert.equal(source.predecessor, LAUNCH_INTEGRATION_PREDECESSOR);assert.equal(source.revision, LAUNCH_INTEGRATION_REVIEWED_REVISION);
assert.deepEqual(source.reviewedProductChanges, LAUNCH_INTEGRATION_REVIEWED_PRODUCT_PATHS);
assert.equal(LAUNCH_INTEGRATION_AUTHORED_PATHS.length, 16);assert.equal(Object.keys(source.files).length, 15);
for (const file of ['.github/workflows/ui-trim-source.yml', 'test/deeds-supply-postgres.js', 'test/ux-tactics-browser.js', 'test/native-garage-enterprise-source.js']) assert(Object.hasOwn(source.files, file));
assert.equal(source.protectedFiles.length, 121);assert.deepEqual(source.reviewedProtectedChanges, ['package.json', 'public/index.html']);
assert(!source.protectedFiles.includes('public/ux-navigation.css'), 'CSS is separately reviewed; do not invent protected-union membership');
assert.deepEqual([admitted.sourceOnly, admitted.runtime, admitted.native, admitted.financial, admitted.migration,
  admitted.activation, admitted.deployment, admitted.priorResultsTransferred, admitted.treePinsAreSecurityReview],
  [true, false, false, false, false, false, false, false, false]);
let positives = 0, refusals = 0;
for (const [file, row] of Object.entries(source.files)) {
  const actual = launchIntegrationActual(file), before = git('show', source.predecessor + ':' + file), current = actual.committed.toString('utf8');
  for (const input of [current, current.replaceAll('\n', '\r\n'), actual.committed, actual.physical]) {
    const proof = qualifyLaunchIntegrationSource(file, input);assert.equal(proof.baselineText, before.toString('utf8'));assert.equal(String(launchIntegrationHistoricalInput(file, input)), before.toString('utf8'));positives++;
  }
  const historical = launchIntegrationHistoricalRecord(file, actual);assert(historical.committed.equals(before));assert.strictEqual(launchIntegrationHistoricalRecord(file, historical), historical);positives += 2;
  for (const kind of ['tree', 'index']) {assert.equal(launchIntegrationHistoricalEntry(file, entry(file, row.current, kind), kind), entry(file, row.baseline, kind));positives++;}
  for (const input of [current + '\n// unreviewed\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), null]) {
    assert.throws(() => qualifyLaunchIntegrationSource(file, input));assert.strictEqual(launchIntegrationHistoricalInput(file, input), input);refusals++;
  }
  assert.throws(() => launchIntegrationHistoricalInput(file, Buffer.from([255])), error => error.code === 'ERR_ASSERTION'
    && /Lossless UTF-8/.test(error.message) && /lossless UTF-8/.test(error.message));refusals++;
  for (const changed of [{ ...actual, index: actual.index.replace(actual.head.blob, '0'.repeat(40)) },
    { ...actual, committed: Buffer.concat([actual.committed, Buffer.from('x')]) },
    { ...actual, physical: Buffer.concat([actual.physical, Buffer.from('x')]) }, { ...actual, regular: false },
    { ...actual, symbolic: true }, { ...actual, extra: true }, { ...actual, head: { ...actual.head, mode: '120000' } }]) {
    assert.throws(() => launchIntegrationHistoricalRecord(file, changed));refusals++;
  }
  const unknown = { ...actual, head: { ...actual.head, blob: '0'.repeat(40) } };assert.strictEqual(launchIntegrationHistoricalRecord(file, unknown), unknown);refusals++;
}
for (const file of Object.keys(source.additions)) {const actual = launchIntegrationActual(file);assert.strictEqual(launchIntegrationHistoricalRecord(file, actual), actual);assert.throws(() => qualifyLaunchIntegrationSource(file, actual.committed));positives++;refusals++;}
for (const file of ['public/index.html', 'public/ux-navigation.css', 'src/server.js', 'src/unreviewed-launch.js', '.github/workflows/ui-trim-source-unreviewed.yml', 'test/deeds-supply-postgres-unreviewed.js', 'test/ux-tactics-browser-unreviewed.js', 'test/native-garage-enterprise-source-unreviewed.js', './tools/launch-integration-source-transfer.js', 'tools/age-removal-source-data.js']) {
  assert.throws(() => assertLaunchIntegrationPostCandidatePaths([file]));refusals++;
}
assertLaunchIntegrationPostCandidatePaths([...LAUNCH_INTEGRATION_AUTHORED_PATHS]);positives++;
for (const file of ['.github/workflows/ui-trim-source.yml', 'test/deeds-supply-postgres.js', 'test/ux-tactics-browser.js', 'test/native-garage-enterprise-source.js']) {assertLaunchIntegrationPostCandidatePaths([file]);positives++;}
assert.throws(() => assertLaunchIntegrationPostCandidatePaths([LAUNCH_INTEGRATION_AUTHORED_PATHS[0], LAUNCH_INTEGRATION_AUTHORED_PATHS[0]]));refusals++;
assert.throws(() => assertLaunchIntegrationPostCandidatePaths('arbitrary'));refusals++;
assert.throws(() => launchIntegrationActual('src/unreviewed-launch.js'));refusals++;
assert.strictEqual(launchIntegrationHistoricalInput('src/unreviewed-launch.js', 'unreviewed'), 'unreviewed');

// Exercise the real dirty-path predicate together with exact-current LF/CRLF admission.
// Only the genuine() seam is finite here; real HEAD/index/FD admission was required above.
const helperText = launchIntegrationActual('tools/launch-integration-source-transfer.js').committed.toString('utf8');
const dirtyStart = helperText.indexOf('function checkDirtySourcePaths('), dirtyEnd = helperText.indexOf('function context()', dirtyStart);
assert(dirtyStart >= 0 && dirtyEnd > dirtyStart);
const ownedPin = Object.freeze({ mode: '100644', blob: 'owned-blob', sha256: 'owned-sha', bytes: 11 });
const renderedMetadata = 'sealed metadata\n', metadataName = 'tools/launch-integration-source-data.js';
let dirtyModel, genuineCalls;
const dirtyPredicate = vm.runInNewContext('(' + helperText.slice(dirtyStart, dirtyEnd) + ')', {
  assert, Buffer, generated: ['knowledge/generated/graph.json'], metadata: metadataName, source: {},
  pinFor: file => file === 'public/index.html' ? ownedPin : null,
  launchIntegrationSourceDataBytes: () => renderedMetadata,
  blob: text => 'blob:' + text, sha: text => 'sha:' + text,
  genuine: (file, pin) => {
    genuineCalls++;
    assert(dirtyModel.head && dirtyModel.index && dirtyModel.mode === '100644'
      && dirtyModel.regular && !dirtyModel.symbolic && dirtyModel.lossless);
    if (file === metadataName) assert.deepEqual({ ...pin }, { mode: '100644', blob: 'blob:' + renderedMetadata,
      sha256: 'sha:' + renderedMetadata, bytes: Buffer.byteLength(renderedMetadata) });
    else assert.strictEqual(pin, ownedPin);
    assert(dirtyModel.physical === dirtyModel.committed
      || dirtyModel.physical === dirtyModel.committed.replaceAll('\n', '\r\n'));
  },
}, { timeout: 1000 });
const dirtyCases = [
  [[], {}, true, 0], [['knowledge/generated/graph.json'], {}, true, 0],
  [['public/index.html'], {}, true, 1],
  [['public/index.html'], { physical: 'alpha\r\nbeta\r\n' }, true, 1],
  [[metadataName], { committed: renderedMetadata, physical: renderedMetadata.replaceAll('\n', '\r\n') }, true, 1],
  [['public/index.html'], { physical: 'alpha\nchanged\n' }, false, 1],
  [['public/index.html'], { physical: 'alpha\r\nbeta\n' }, false, 1],
  [['public/index.html'], { index: false }, false, 1], [['public/index.html'], { head: false }, false, 1],
  [['public/index.html'], { mode: '120000' }, false, 1], [['public/index.html'], { regular: false }, false, 1],
  [['public/index.html'], { symbolic: true }, false, 1], [['public/index.html'], { lossless: false }, false, 1],
  [['src/server.js'], {}, false, 0], [['src/unreviewed-launch.js'], {}, false, 0],
  [['./public/index.html'], {}, false, 0], [['public/index.html', 'src/unreviewed-launch.js'], {}, false, 1],
];
for (const [paths, changes, accepted, calls] of dirtyCases) {
  dirtyModel = { head: true, index: true, mode: '100644', regular: true, symbolic: false, lossless: true,
    committed: 'alpha\nbeta\n', physical: 'alpha\nbeta\n', ...changes }; genuineCalls = 0;
  if (accepted) { dirtyPredicate(paths); positives++; } else { assert.throws(() => dirtyPredicate(paths)); refusals++; }
  assert.equal(genuineCalls, calls, 'Dirty paths never skip or cache current source admission');
}
console.log(`launch integration source: ${positives} exact positives, ${refusals} refusals; source binding only, no execution/result transfer`);
