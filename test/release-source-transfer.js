import { economyReleaseSource } from '../tools/economy-release-composition.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { RELEASE_SOURCE_REVISION, RELEASE_SOURCE_PREDECESSOR, RELEASE_SOURCE_PHASE, RELEASE_SOURCE_DOMAINS,
  assertReleaseSourceTransfer, releaseSourceBaseline } from '../tools/release-source-transfer.js';

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
  entire(economyReleaseSource('main', file, lf(fs.readFileSync(file, 'utf8'))), current);
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
