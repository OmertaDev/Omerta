import { marketFeedSourceBaseline } from '../tools/rc1-market-feed-source-compatibility.js';
import assert from 'node:assert/strict';
import { cityHomesFeedSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { COMPANY_SUCCESSION_SOURCE_CURRENT_PINS, COMPANY_SUCCESSION_SOURCE_BASELINE_PINS, COMPANY_SUCCESSION_SOURCE_CURRENT_BLOBS, COMPANY_SUCCESSION_SOURCE_BASELINE_BLOBS,
  COMPANY_SUCCESSION_SOURCE_REVIEWED_REVISION, COMPANY_SUCCESSION_SOURCE_PREDECESSOR_REVISION, COMPANY_SUCCESSION_SOURCE_INVERSES, COMPANY_SUCCESSION_SOURCE_TRANSFER,
  assertCompanySuccessionSourceTransfer, qualifyCompanySuccessionSource, companySuccessionSourceBaseline } from '../tools/rc1-company-succession-source-compatibility.js';
const normalize = text => text.replaceAll('\r\n', '\n');
const gitText = spec => normalize(execFileSync('git', ['show', spec], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
let chunks = 0, negatives = 0;
for (const file of Object.keys(COMPANY_SUCCESSION_SOURCE_CURRENT_PINS)) {
  const current = normalize(marketFeedSourceBaseline(file, cityHomesFeedSourceBaseline(file, fs.readFileSync(file, 'utf8')))), baseline = gitText(COMPANY_SUCCESSION_SOURCE_BASELINE_BLOBS[file]);
  assert.equal(companySuccessionSourceBaseline(file, current), baseline);
  assert.equal(companySuccessionSourceBaseline(file, baseline), baseline);
  const unknown = current + '\n// unknown source suffix\n';
  assert.equal(companySuccessionSourceBaseline(file, unknown), unknown, 'composition must not manufacture historical bytes for unreviewed source');
  assert.throws(() => qualifyCompanySuccessionSource(file, companySuccessionSourceBaseline(file, unknown)), /source changed/);
  assert.equal(current, gitText(COMPANY_SUCCESSION_SOURCE_CURRENT_BLOBS[file]), 'Complete Succession bytes after any exact Home inverse match frozen current Git blob: ' + file);
  assert.equal(current, gitText(COMPANY_SUCCESSION_SOURCE_REVIEWED_REVISION + ':' + file));
  assert.equal(baseline, gitText(COMPANY_SUCCESSION_SOURCE_PREDECESSOR_REVISION + ':' + file));
  assert.equal(hash(current), COMPANY_SUCCESSION_SOURCE_CURRENT_PINS[file]);
  assert.equal(hash(baseline), COMPANY_SUCCESSION_SOURCE_BASELINE_PINS[file]);
  const diff = normalize(execFileSync('git', ['diff', '--no-ext-diff', '--unified=3',
    COMPANY_SUCCESSION_SOURCE_PREDECESSOR_REVISION, COMPANY_SUCCESSION_SOURCE_REVIEWED_REVISION, '--', file], { encoding: 'utf8' }));
  const gitChunks = []; let hunk;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@ ')) { hunk = { current: '', baseline: '' }; gitChunks.push(hunk); continue; }
    if (!hunk) continue;
    if (line.startsWith(' ')) { hunk.current += line.slice(1) + '\n'; hunk.baseline += line.slice(1) + '\n'; }
    else if (line.startsWith('+')) hunk.current += line.slice(1) + '\n';
    else if (line.startsWith('-')) hunk.baseline += line.slice(1) + '\n';
  }
  assert.deepEqual(COMPANY_SUCCESSION_SOURCE_INVERSES[file], gitChunks, 'Only actual complete Git diff hunks qualify: ' + file);
  const proof = assertCompanySuccessionSourceTransfer(file, current);
  assert.equal(proof.baselineText, baseline, 'All exact inverses reconstruct the entire predecessor file: ' + file);
  assert.equal(proof.sourceBlob, COMPANY_SUCCESSION_SOURCE_CURRENT_BLOBS[file]);
  assert.equal(proof.predecessorBlob, COMPANY_SUCCESSION_SOURCE_BASELINE_BLOBS[file]);
  assert.equal(proof.actualSha256, COMPANY_SUCCESSION_SOURCE_CURRENT_PINS[file]);
  assert.equal(proof.baselineSha256, COMPANY_SUCCESSION_SOURCE_BASELINE_PINS[file]);
  assert.equal(proof.inverseChunks, COMPANY_SUCCESSION_SOURCE_TRANSFER.inverseChunks[file]);
  assert.equal(qualifyCompanySuccessionSource(file, current).baselineText, baseline);
  const unchanged = qualifyCompanySuccessionSource(file, baseline);
  assert.equal(unchanged.baselineText, baseline); assert.equal(unchanged.inverseChunks, 0);
  assert.equal(unchanged.sourceBlob, COMPANY_SUCCESSION_SOURCE_BASELINE_BLOBS[file]);
  assert.equal(assertCompanySuccessionSourceTransfer(file, current.replaceAll('\n', '\r\n')).baselineText, baseline);
  assert.equal(qualifyCompanySuccessionSource(file, baseline.replaceAll('\n', '\r\n')).baselineText, baseline);
  for (const chunk of COMPANY_SUCCESSION_SOURCE_INVERSES[file]) {
    const lines = chunk.current.split('\n');
    const context = lines.find(line => line.trim() && chunk.baseline.includes(line + '\n'));
    const addition = lines.find(line => line.trim() && !chunk.baseline.includes(line + '\n'));
    assert(context && addition, 'Every frozen hunk has actual added logic and protected context');
    for (const target of [context, addition]) {
      const alteredChunk = chunk.current.replace(target, target + ' /* unsupported hunk change */');
      const alteredSource = current.replace(chunk.current, alteredChunk);
      assert.notEqual(alteredSource, current);
      assert.throws(() => qualifyCompanySuccessionSource(file, alteredSource), /source changed/); negatives++;
    }
    chunks++; assert.equal(current.split(chunk.current).length, 2, 'Every exact addition appears once: ' + file);
    for (const changed of [current.replace(chunk.current, ''), current.replace(chunk.current, chunk.current + chunk.current)]) {
      assert.notEqual(changed, current); assert.notEqual(changed, baseline, 'Partial deletion is not the complete predecessor');
      assert.throws(() => assertCompanySuccessionSourceTransfer(file, changed), /source changed/);
      assert.throws(() => qualifyCompanySuccessionSource(file, changed), /source changed/); negatives++;
    }
  }
  for (const text of [current, baseline]) {
    const changed = text + '\n// unsupported source suffix\n';
    assert.throws(() => qualifyCompanySuccessionSource(file, changed), /source changed/); negatives++;
  }
  const altered = current.replace(/^import /m, 'import/* changed */ ');
  assert.notEqual(altered, current); assert.throws(() => qualifyCompanySuccessionSource(file, altered), /source changed/); negatives++;
  const protectedLine = current.split('\n').find(line => line.trim() && !COMPANY_SUCCESSION_SOURCE_INVERSES[file].some(chunk => chunk.current.includes(line + '\n')));
  assert(protectedLine, 'Protected predecessor logic exists outside inverse chunks: ' + file);
  assert.throws(() => qualifyCompanySuccessionSource(file, current.replace(protectedLine, protectedLine + ' /* altered protected logic */')), /source changed/); negatives++;
  assert.throws(() => assertCompanySuccessionSourceTransfer(file, baseline), /source changed/, 'Current transfer never treats historical bytes as the new integration');
}
assert.throws(() => qualifyCompanySuccessionSource('src/worker.js', ''), /Unknown Company Succession source/);
assert.throws(() => qualifyCompanySuccessionSource('src/game.js', ''), /Unknown Company Succession source/);
assert.throws(() => qualifyCompanySuccessionSource('toString', ''), /Unknown Company Succession source/);
assert.match(COMPANY_SUCCESSION_SOURCE_TRANSFER.scope, /separate current-source native proof/);
assert.match(COMPANY_SUCCESSION_SOURCE_TRANSFER.scope, /no historical runtime, native, deployment or financial qualification/);
console.log(JSON.stringify({ status: 'PASS', sourceRevision: COMPANY_SUCCESSION_SOURCE_REVIEWED_REVISION, predecessorRevision: COMPANY_SUCCESSION_SOURCE_PREDECESSOR_REVISION, files: 2, chunks, negatives,
  scope: 'Complete frozen current/prior blobs, exact unique Git diff hunk inverses and regression controls only; no new native or financial qualification' }));
