// Exact complete GUI and fixture-reader source proofs; no native/runtime admission.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CONTINUOUS_CITY_SOURCE_REVISION, CONTINUOUS_CITY_SOURCE_PREDECESSOR, CONTINUOUS_CITY_SOURCE_DOMAINS,
  CONTINUOUS_CITY_FIXTURE_DOMAINS, qualifyContinuousCitySource, qualifyContinuousCityFixtureSource,
  continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';
import { CONTINUOUS_CITY_FIXTURE_PREDECESSOR } from '../tools/continuous-city-fixture-source-data.js';
import { hasEnterpriseOverRootSource, enterpriseOverRootSourceBaseline } from '../tools/enterprise-current-source-compatibility.js';
assert.deepEqual(process.argv.slice(2), [], 'Source-only proof has no native or retained modes');
const git = (...args) => execFileSync('git', ['-c', 'core.safecrlf=false', ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
function hunks(diff) {
  const result = []; let current;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { if (current) result.push(current); current = { current: '', baseline: '' }; }
    else if (current && line.startsWith(' ')) { current.current += line.slice(1) + '\n'; current.baseline += line.slice(1) + '\n'; }
    else if (current && line.startsWith('+')) current.current += line.slice(1) + '\n';
    else if (current && line.startsWith('-')) current.baseline += line.slice(1) + '\n';
    else if (current && line.startsWith('\\ No newline')) assert.fail('Unexpected non-newline source hunk');
  }
  if (current) result.push(current); return result;
}
let positives = 0, refusals = 0, inverseHunks = 0, additions = 0;
function verify(file, pin, actual, baseline, qualify, diff) {
  assert.equal(hash(actual), pin.currentSha256); assert.equal(blob(actual), pin.currentBlob);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.currentRawSha256) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  for (const input of [actual, actual.replaceAll('\n', '\r\n')]) {
    const proof = qualify(file, input);
    assert.equal(proof.sourceOnly, true); assert.equal(proof.native, false);
    assert.equal(proof.predecessorAbsent, baseline === null); assert.equal(proof.baselineText, baseline);
    assert.equal(hash(input), pin.currentRawSha256[input.includes('\r\n') ? 'crlf' : 'lf']); positives++;
  }
  for (const input of [actual + '\n// unknown\n', '\n// unknown\n' + actual, actual.slice(1), '\ufeff' + actual,
    actual + '\0', actual.replace('\n', '\r\n'), actual.replace('\n', '\r'), Buffer.from(actual), null]) {
    assert.throws(() => qualify(file, input)); refusals++;
  }
  for (const inverse of pin.inverses) {
    for (const input of [actual.replace(inverse.current, ''), actual.replace(inverse.current, () => inverse.current + inverse.current), actual.replace(inverse.current, () => inverse.baseline)]) {
      assert.throws(() => qualify(file, input)); refusals++;
    }
    inverseHunks++;
  }
  if (baseline === null) {
    assert.equal(pin.baselineMode, null); assert.equal(pin.baselineBlob, null); assert.equal(pin.baselineSha256, null);
    assert.deepEqual(pin.inverses, []); assert.throws(() => continuousCityHistoricalInput(file, actual)); refusals++; additions++;
  } else {
    assert.equal(pin.baselineMode, '100644'); assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
    assert.deepEqual(pin.inverses, hunks(diff), 'Inverses must be actual complete Git diff contexts: ' + file);
    assert.throws(() => qualify(file, baseline)); refusals++;
    assert.throws(() => continuousCityHistoricalInput(file, baseline)); refusals++;
    assert.throws(() => continuousCityHistoricalInput(file, Buffer.concat([Buffer.from(actual), Buffer.from([0xff])])), /lossless UTF-8/); refusals++;
    assert.equal(continuousCityHistoricalInput(file, actual), baseline);
    assert.deepEqual(continuousCityHistoricalInput(file, Buffer.from(actual)), Buffer.from(baseline)); positives += 2;
    for (const input of [actual + '\n// physical mutation\n', '\ufeff' + actual, actual + '\0', actual.replace('\n', '\r\n')]) {
      assert.throws(() => continuousCityHistoricalInput(file, input)); refusals++;
    }
  }
}
assert.equal(Object.keys(CONTINUOUS_CITY_SOURCE_DOMAINS).length, 16);
for (const [file, pin] of Object.entries(CONTINUOUS_CITY_SOURCE_DOMAINS)) {
  const current = git('show', CONTINUOUS_CITY_SOURCE_REVISION + ':' + file);
  assert.equal(lf(fs.readFileSync(file, 'utf8')), current, 'Actual GUI source must remain exactly frozen: ' + file);
  assert.equal(git('ls-tree', CONTINUOUS_CITY_SOURCE_REVISION, '--', file).split(' ')[0], pin.currentMode);
  const priorTree = git('ls-tree', CONTINUOUS_CITY_SOURCE_PREDECESSOR, '--', file);
  assert.equal(priorTree === '', pin.predecessorAbsent);
  if (!pin.predecessorAbsent) assert.equal(priorTree.split(' ')[0], pin.baselineMode);
  const baseline = pin.predecessorAbsent ? null : git('show', CONTINUOUS_CITY_SOURCE_PREDECESSOR + ':' + file);
  verify(file, pin, current, baseline, qualifyContinuousCitySource,
    git('diff', '--no-ext-diff', '--unified=3', CONTINUOUS_CITY_SOURCE_PREDECESSOR, CONTINUOUS_CITY_SOURCE_REVISION, '--', file));
  if (hasEnterpriseOverRootSource(file)) { assert.throws(() => enterpriseOverRootSourceBaseline(file, current)); refusals++; }
}
assert.equal(additions, 5);
assert.equal(Object.keys(CONTINUOUS_CITY_FIXTURE_DOMAINS).length, 36);
for (const [file, pin] of Object.entries(CONTINUOUS_CITY_FIXTURE_DOMAINS)) {
  assert(file.startsWith('test/'), 'Reader proofs cannot admit production source');
  assert(!Object.hasOwn(CONTINUOUS_CITY_SOURCE_DOMAINS, file), 'GUI and reader domains stay disjoint');
  const actual = lf(fs.readFileSync(file, 'utf8')), baseline = git('show', CONTINUOUS_CITY_FIXTURE_PREDECESSOR + ':' + file);
  assert.equal(git('ls-files', '--stage', '--', file).split(' ')[0], pin.currentMode);
  assert.equal(git('ls-tree', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, '--', file).split(' ')[0], pin.baselineMode);
  verify(file, pin, actual, baseline, qualifyContinuousCityFixtureSource,
    git('diff', '--no-ext-diff', '--unified=3', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, '--', file));
  if (hasEnterpriseOverRootSource(file)) { assert.throws(() => enterpriseOverRootSourceBaseline(file, actual)); refusals++; }
}
for (const file of ['__proto__', 'constructor', 'toString', '../package.json', 'src/unknown.js', 'schema.sql.extra']) {
  for (const fn of [qualifyContinuousCitySource, qualifyContinuousCityFixtureSource]) { assert.throws(() => fn(file, 'unknown')); refusals++; }
  const raw = Buffer.from('unknown\r\nbytes\n'); assert.equal(continuousCityHistoricalInput(file, raw), raw);
}
for (const file of ['tools/enterprise-current-source-compatibility.js', 'tools/enterprise-current-source-data.js', 'tools/enterprise-native-inputs.js']) {
  assert.equal(lf(fs.readFileSync(file, 'utf8')), git('show', CONTINUOUS_CITY_SOURCE_REVISION + ':' + file), 'Predecessor guard/data is immutable: ' + file);
}
console.log(JSON.stringify({ phase: 'CONTINUOUS_CITY_EXACT_SOURCE_ONLY', source: CONTINUOUS_CITY_SOURCE_REVISION,
  predecessor: CONTINUOUS_CITY_SOURCE_PREDECESSOR, sourceFiles: 16, addedFiles: additions, fixtureReaders: 36,
  positives, refusals, inverseHunks, native: false, postgres: false, release: false }));
