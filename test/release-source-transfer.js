import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';
import { economyReleaseSource } from '../tools/economy-release-composition.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { RELEASE_SOURCE_REVISION, RELEASE_SOURCE_PREDECESSOR, RELEASE_SOURCE_PHASE, RELEASE_SOURCE_DOMAINS,
  assertReleaseSourceTransfer, releaseSourceBaseline } from '../tools/release-source-transfer.js';
import { CITY_PLAY_SOURCE_PREDECESSOR, CITY_PLAY_SOURCE_PHASE, CITY_PLAY_SOURCE_DOMAINS,
  assertCityPlaySourceTransfer, cityPlaySourceBaseline } from '../tools/city-play-source-transfer.js';

const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const files = ['package-lock.json', 'package.json', 'schema.sql', 'src/agentgateway.js', 'src/crew.js', 'src/db.js',
  'src/deeds.js', 'src/game.js', 'src/routes/worldgraph.js', 'src/server.js', 'src/wire.js', 'src/worker.js',
  'src/rules.generated.js', 'src/rules.tail.js', 'src/genesisauction.js', 'public/genesis-deploy-client.js', 'tools/genesis-auction-preflight.js'];
assert.equal(RELEASE_SOURCE_REVISION, 'b90bd95dee6e0fda851247cc660288f4bbf8fdc0');
assert.equal(RELEASE_SOURCE_PREDECESSOR, 'fe4a75a8b21fc41fd3d3bc75cf7720612c581463');
assert.equal(RELEASE_SOURCE_PHASE, 'exact-source-transfer-only; no historical runtime/native/migration/financial/genesis/deployment clearance');
assert.deepEqual(Object.keys(RELEASE_SOURCE_DOMAINS), files);
git('merge-base', '--is-ancestor', RELEASE_SOURCE_PREDECESSOR, RELEASE_SOURCE_REVISION);
let comparisons = 0, hunks = 0, negatives = 0;
const entire = (actual, expected) => { assert.equal(actual, expected); comparisons++; };
function reject(file, text) {
  assert.throws(() => assertReleaseSourceTransfer(file, text));
  assert.equal(releaseSourceBaseline(file, text), text, 'Unknown bytes retain their original rejecting form');
  negatives++;
}
for (const [file, domain] of Object.entries(RELEASE_SOURCE_DOMAINS)) {
  const current = git('show', RELEASE_SOURCE_REVISION + ':' + file);
  const prior = git('show', RELEASE_SOURCE_PREDECESSOR + ':' + file);
  entire(economyReleaseSource('main', file, cityPlaySourceBaseline(file, lf(cityActivitySourceBaseline(file,fs.readFileSync(file, 'utf8'))))), current);
  entire(current, git('cat-file', 'blob', domain.currentBlob));
  entire(prior, git('cat-file', 'blob', domain.baselineBlob));
  assert.equal(hash(current), domain.currentSha256); assert.equal(blob(current), domain.currentBlob);
  assert.equal(hash(prior), domain.baselineSha256); assert.equal(blob(prior), domain.baselineBlob);
  assert.notEqual(current, prior);
  assert(Object.isFrozen(domain) && Object.isFrozen(domain.inverses));
  const proof = assertReleaseSourceTransfer(file, current);
  entire(proof.baselineText, prior); entire(releaseSourceBaseline(file, current), prior);
  assert.equal(proof.sourceRevision, RELEASE_SOURCE_REVISION); assert.equal(proof.predecessorRevision, RELEASE_SOURCE_PREDECESSOR);
  assert.equal(proof.phase, RELEASE_SOURCE_PHASE); assert.equal(proof.sourceOnly, true);
  assert.equal(proof.inverseChunks, domain.inverses.length);
  entire(assertReleaseSourceTransfer(file, current.replaceAll('\n', '\r\n')).baselineText, prior);
  entire(releaseSourceBaseline(file, current.replaceAll('\n', '\r\n')), prior);
  const actual = []; let hunk;
  for (const line of git('diff', '--no-ext-diff', '--unified=' + domain.contextLines,
    RELEASE_SOURCE_PREDECESSOR, RELEASE_SOURCE_REVISION, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; actual.push(hunk); }
    else if (hunk) {
      if (line[0] === '+') hunk.current += line.slice(1) + '\n';
      else if (line[0] === '-') hunk.baseline += line.slice(1) + '\n';
      else if (line[0] === ' ') { hunk.current += line.slice(1) + '\n'; hunk.baseline += line.slice(1) + '\n'; }
    }
  }
  assert.equal(domain.contextLines, 3);
  assert.deepEqual(domain.inverses, actual, 'Only literal complete Git diff hunks for the pinned revisions');
  assert(domain.inverses.length);
  reject(file, current + '\n// unreviewed release suffix\n');
  reject(file, current.slice(1)); reject(file, '\ufeff' + current);
  reject(file, current.replace('\n', '\r\n')); reject(file, prior);
  const intervals = [];
  for (const chunk of domain.inverses) {
    hunks++;
    assert(Object.isFrozen(chunk));
    assert.equal(current.split(chunk.current).length - 1, 1);
    const start = current.indexOf(chunk.current); intervals.push([start, start + chunk.current.length]);
    reject(file, current.replace(chunk.current, ''));
    reject(file, current.replace(chunk.current, () => chunk.current + chunk.current));
    reject(file, current.replace(chunk.current, () => chunk.baseline));
    reject(file, current.replace(chunk.current, () => chunk.current.replace(/\S/, '?')));
    const reversed = chunk.current.trimEnd().split('\n').reverse().join('\n') + '\n';
    if (reversed !== chunk.current) reject(file, current.replace(chunk.current, () => reversed));
  }
  let outside = -1;
  for (let index = 0; index < current.length; index++) {
    if (/\S/.test(current[index]) && intervals.every(([start, end]) => index < start || index >= end)) { outside = index; break; }
  }
  assert(outside >= 0, 'The drift test must mutate outside all admitted hunks: ' + file);
  reject(file, current.slice(0, outside) + '?' + current.slice(outside + 1));
  if (domain.inverses.length > 1) {
    const [a, b] = domain.inverses;
    reject(file, current.replace(a.current, '@@release-test@@').replace(b.current, () => a.current).replace('@@release-test@@', () => b.current));
  }
  const other = files.find(path => path !== file);
  reject(other, current);
}
for (const file of ['src/unknown.js', 'src/generated.js', 'package.json.unreviewed', 'src/server.js.extra', 'toString', '__proto__']) {
  reject(file, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : 'unknown');
}
// The superseded release lacks the newly reviewed dated reset and has no current alias.
const supersededDb = git('show', 'b602dc0da8fd3922ae53b84d23e4e46b6e90439f:src/db.js');
assert.notEqual(supersededDb, git('show', RELEASE_SOURCE_REVISION + ':src/db.js'));
reject('src/db.js', supersededDb);
reject('schema.sql', Buffer.from('unknown'));
console.log(`Release source transfer PASS: ${files.length} literal candidate domains, ${comparisons} complete-text comparisons, 68 SHA256/Gitblob bindings, ${hunks} actual inverse hunks, ${negatives} negative controls; source-only, no inherited runtime/native/migration/financial/genesis/deployment qualification`);

// An outer complete-file alias preserves every frozen release pin above. Its current
// candidate is pinned by literal source hashes; historical commits remain immutable.
const cityFiles = ['package.json', 'src/content/phase1.js', 'src/content/phase1-policy.js', 'tools/release-source-transfer.js'];
assert.equal(CITY_PLAY_SOURCE_PREDECESSOR, '5c18acaaf47c84851729b82354340c4d56734dd9');
assert.equal(CITY_PLAY_SOURCE_PHASE, 'exact-working-source-transfer-only; no historical runtime/native/migration/financial/deployment clearance');
assert.deepEqual(Object.keys(CITY_PLAY_SOURCE_DOMAINS), cityFiles);
let cityHunks = 0, cityNegatives = 0;
const rejectCity = (file, text) => {
  assert.throws(() => assertCityPlaySourceTransfer(file, text));
  assert.equal(cityPlaySourceBaseline(file, text), text, 'Unrecognized City candidate bytes remain unchanged.');
  cityNegatives++;
};
for (const [file, domain] of Object.entries(CITY_PLAY_SOURCE_DOMAINS)) {
  const current = economyReleaseSource('city', file, lf(cityActivitySourceBaseline(file,fs.readFileSync(file, 'utf8'))));
  const prior = git('show', CITY_PLAY_SOURCE_PREDECESSOR + ':' + file);
  assert(Object.isFrozen(domain) && Object.isFrozen(domain.inverses));
  assert.equal(hash(current), domain.currentSha256); assert.equal(blob(current), domain.currentBlob);
  assert.equal(execFileSync('git', ['hash-object', '--stdin'], { input: current, encoding: 'utf8' }).trim(), domain.currentBlob);
  assert.equal(hash(prior), domain.baselineSha256); assert.equal(blob(prior), domain.baselineBlob);
  assert.equal(prior, git('cat-file', 'blob', domain.baselineBlob));
  const proof = assertCityPlaySourceTransfer(file, current);
  assert.equal(proof.baselineText, prior); assert.equal(proof.currentSha256, domain.currentSha256);
  assert.equal(proof.predecessorRevision, CITY_PLAY_SOURCE_PREDECESSOR); assert.equal(proof.sourceOnly, true);
  assert.equal(proof.phase, CITY_PLAY_SOURCE_PHASE); assert.equal(proof.inverseChunks, domain.inverses.length);
  assert.equal(cityPlaySourceBaseline(file, current), prior);
  assert.equal(cityPlaySourceBaseline(file, current.replaceAll('\n', '\r\n')), prior);
  assert.equal(cityPlaySourceBaseline(file, prior), prior);
  const actual = []; let hunk;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', CITY_PLAY_SOURCE_PREDECESSOR, '23f115c6f142321e1796e272bea406e1feb137ba', '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; actual.push(hunk); }
    else if (hunk) {
      if (line[0] === '+') hunk.current += line.slice(1) + '\n';
      else if (line[0] === '-') hunk.baseline += line.slice(1) + '\n';
      else if (line[0] === ' ') { hunk.current += line.slice(1) + '\n'; hunk.baseline += line.slice(1) + '\n'; }
    }
  }
  assert.equal(domain.contextLines, 3);
  assert.deepEqual(domain.inverses, actual, 'Only actual complete predecessor-to-candidate diff hunks are admitted.');
  assert(actual.length);
  for (const changed of [current + '\n// unknown candidate suffix\n', current.slice(1), '\ufeff' + current,
    current.replace('\n', '\r\n'), prior]) rejectCity(file, changed);
  const intervals = [];
  for (const chunk of domain.inverses) {
    cityHunks++;
    assert(Object.isFrozen(chunk));
    assert.equal(current.split(chunk.current).length - 1, 1);
    const start = current.indexOf(chunk.current); intervals.push([start, start + chunk.current.length]);
    for (const changed of [current.replace(chunk.current, ''), current.replace(chunk.current, () => chunk.current + chunk.current),
      current.replace(chunk.current, () => chunk.baseline), current.replace(chunk.current, () => chunk.current.replace(/\S/, '?')),
      current.replace(chunk.current, () => chunk.current.trimEnd().split('\n').reverse().join('\n') + '\n')]) {
      rejectCity(file, changed);
    }
  }
  const outside = [...current].findIndex((character, index) => /\S/.test(character)
    && intervals.every(([start, end]) => index < start || index >= end));
  assert(outside >= 0);
  rejectCity(file, current.slice(0, outside) + '?' + current.slice(outside + 1));
  if (domain.inverses.length > 1) {
    const [a, b] = domain.inverses;
    rejectCity(file, current.replace(a.current, '@@city-play@@').replace(b.current, () => a.current).replace('@@city-play@@', () => b.current));
  }
  rejectCity(cityFiles.find(candidate => candidate !== file), current);
}
for (const file of ['src/unknown.js', 'src/generated.js', 'package.json.unreviewed', 'src/content/phase1.js.extra',
  'src/content/neighborhood-broadcast.js', 'tools/city-play-source-transfer.js', 'toString', '__proto__']) {
  rejectCity(file, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : 'unknown');
}
rejectCity('package.json', Buffer.from('unknown'));
console.log(`City play source transfer PASS: ${cityFiles.length} exact domains, ${cityHunks} actual inverse hunks, ${cityNegatives} rejecting controls; original release pins unchanged, source-only qualification`);
