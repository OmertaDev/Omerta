import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION, COMPANY_OPERATOR_SOURCE_PREDECESSOR_REVISION,
  COMPANY_OPERATOR_SOURCE_CURRENT_PINS, COMPANY_OPERATOR_SOURCE_BASELINE_PINS, COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS,
  COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS, COMPANY_OPERATOR_SOURCE_INVERSES, COMPANY_OPERATOR_SOURCE_TRANSFER,
  assertCompanyOperatorSourceTransfer, qualifyCompanyOperatorSource, companyOperatorSourceBaseline } from '../tools/rc1-company-operator-source-compatibility.js';
import { qualifyIntelSource, INTEL_SOURCE_BASELINE_BLOBS } from '../tools/rc1-intel-source-compatibility.js';
import { WORLD_RECOVERY_REVIEW, verifyWorldRecoverySources } from '../tools/rc1-world-qualification.js';
import * as Deed from '../tools/rc1-deed-source-compatibility.js';

const normalize = text => text.replaceAll('\r\n', '\n');
const git = (...args) => normalize(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
let wholeFileComparisons = 0, sha256Comparisons = 0, blobComparisons = 0, negatives = 0, chunks = 0;
const entire = (actual, expected, message) => { assert.equal(actual, expected, message); wholeFileComparisons++; };
const currentFiles = new Map();
for (const file of Object.keys(COMPANY_OPERATOR_SOURCE_CURRENT_PINS)) {
  const current = normalize(fs.readFileSync(file, 'utf8')), baseline = git('show', COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS[file]);
  currentFiles.set(file, current);
  entire(current, git('show', COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS[file]), 'Full working source equals frozen Git blob');
  entire(current, git('show', `${COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION}:${file}`), 'Full current revision source');
  entire(baseline, git('show', `${COMPANY_OPERATOR_SOURCE_PREDECESSOR_REVISION}:${file}`), 'Full 727 predecessor source');
  entire(hash(current), COMPANY_OPERATOR_SOURCE_CURRENT_PINS[file]); entire(hash(baseline), COMPANY_OPERATOR_SOURCE_BASELINE_PINS[file]);
  sha256Comparisons += 2;
  entire(blob(current), COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS[file]); entire(blob(baseline), COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS[file]);
  blobComparisons += 2;
  const gitChunks = []; let hunk;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', COMPANY_OPERATOR_SOURCE_PREDECESSOR_REVISION, COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION, '--', file).split('\n')) {
    if (line.startsWith('@@ ')) { hunk = { current: '', baseline: '' }; gitChunks.push(hunk); continue; }
    if (!hunk) continue;
    if (line.startsWith(' ')) { hunk.current += line.slice(1) + '\n'; hunk.baseline += line.slice(1) + '\n'; }
    else if (line.startsWith('+')) hunk.current += line.slice(1) + '\n'; else if (line.startsWith('-')) hunk.baseline += line.slice(1) + '\n';
  }
  assert.deepEqual(COMPANY_OPERATOR_SOURCE_INVERSES[file], gitChunks, 'Only actual complete unique Git hunks');
  assert.equal(gitChunks.length, 2); chunks += gitChunks.length;
  const proof = assertCompanyOperatorSourceTransfer(file, current);
  entire(proof.baselineText, baseline); entire(companyOperatorSourceBaseline(file, current), baseline);
  entire(qualifyCompanyOperatorSource(file, current).baselineText, baseline);
  entire(qualifyCompanyOperatorSource(file, baseline).baselineText, baseline);
  entire(assertCompanyOperatorSourceTransfer(file, current.replaceAll('\n', '\r\n')).baselineText, baseline);
  entire(qualifyCompanyOperatorSource(file, baseline.replaceAll('\n', '\r\n')).baselineText, baseline);
  assert.equal(proof.sourceBlob, COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS[file]); assert.equal(proof.predecessorBlob, COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS[file]);
  assert.equal(qualifyCompanyOperatorSource(file, baseline).inverseChunks, 0);
  const altered = [current + '\n// unsupported full-file suffix\n', '// unsupported prefix\n' + current, current.replace('import ', 'import  ')];
  for (const chunk of gitChunks) {
    const context = chunk.current.split('\n').find(line => line.trim() && chunk.baseline.includes(line + '\n'));
    assert(context, 'Protected context exists'); assert.equal(current.split(chunk.current).length, 2, 'Every current hunk is unique');
    altered.push(current.replace(chunk.current, ''), current.replace(chunk.current, chunk.current + chunk.current), current.replace(context + '\n', context + ' // drift\n'));
  }
  const [a, b] = gitChunks; const swapped = current.replace(a.current, '__RC1_OPERATOR_HUNK__').replace(b.current, a.current).replace('__RC1_OPERATOR_HUNK__', b.current); altered.push(swapped);
  if (file === 'src/server.js') altered.push(current.replace('registerCompanyOperators(app, { pool, auth });', 'registerCompanyOperators(app, { pool });'));
  else altered.push(current.replace('runCompanyOperators(pool, 20)', 'runCompanyOperators(pool, 21)'), current.replace('setInterval(guardedCompanyTick, 30000);', 'setInterval(guardedCompanyTick, 60000);'), current.replace('  setInterval(guardedCompanyTick, 30000);\n  void guardedCompanyTick();', '  void guardedCompanyTick();\n  setInterval(guardedCompanyTick, 30000);'));
  for (const changed of altered) {
    assert.notEqual(changed, current); assert.equal(companyOperatorSourceBaseline(file, changed), changed, 'Unknown source must never manufacture predecessor bytes');
    assert.throws(() => assertCompanyOperatorSourceTransfer(file, changed), /source changed/); assert.throws(() => qualifyCompanyOperatorSource(file, changed), /source changed/);
    assert.throws(() => assertCompanyOperatorSourceTransfer(file, changed.replaceAll('\n', '\r\n')), /source changed/);
    await assert.rejects(() => verifyWorldRecoverySources({ sourceRevision: COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION, readFile: candidate => candidate === file ? changed : fs.readFileSync(candidate) }), /source changed/);
    if (file === 'src/worker.js') assert.throws(() => qualifyIntelSource(file, changed), /source changed/);
    else assert.throws(() => Deed.assertDeedServerCompatibility(changed), /source changed/);
    negatives++;
  }
}
assert.throws(() => assertCompanyOperatorSourceTransfer('src/companyoperators.js', ''), /Unknown Company Operator/);
assert.throws(() => qualifyCompanyOperatorSource('src/invariants.js', ''), /Unknown Company Operator/);
const unsupported = '// unsupported'; assert.equal(companyOperatorSourceBaseline('src/unknown.js', unsupported), unsupported);
const worker = currentFiles.get('src/worker.js'), intel = qualifyIntelSource('src/worker.js', worker);
entire(intel.companyOperatorSourceTransfer.baselineText, git('show', COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS['src/worker.js']));
entire(intel.baselineText, git('show', INTEL_SOURCE_BASELINE_BLOBS['src/worker.js']));
assert.equal(intel.companyOperatorSourceTransfer.sourceRevision, COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION);
const server = currentFiles.get('src/server.js');
for (const name of ['assertEconomySourceTransfer']) {
  const proof = Deed[name]('src/server.js', server); assert.equal(proof.companyOperatorSourceTransfer.actualSha256, COMPANY_OPERATOR_SOURCE_CURRENT_PINS['src/server.js']);
}
for (const name of ['assertGenesisSnapshotServerCompatibility', 'assertGenesisWrapperServerCompatibility', 'assertHttpReceiptServerCompatibility', 'assertDeedServerCompatibility']) {
  const proof = Deed[name](server); assert.equal(proof.companyOperatorSourceTransfer.actualSha256, COMPANY_OPERATOR_SOURCE_CURRENT_PINS['src/server.js']);
}
assert.deepEqual(WORLD_RECOVERY_REVIEW.companyOperatorSourceReviewTransfer, COMPANY_OPERATOR_SOURCE_TRANSFER);
assert.match(COMPANY_OPERATOR_SOURCE_TRANSFER.scope, /no world-soak, native, financial, deployment or onchain qualification/);
const actual = await verifyWorldRecoverySources({ sourceRevision: COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION, readFile: file => fs.readFileSync(file) });
const prior = await verifyWorldRecoverySources({ sourceRevision: COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION, readFile: file => currentFiles.has(file) ? git('show', `${COMPANY_OPERATOR_SOURCE_PREDECESSOR_REVISION}:${file}`) : fs.readFileSync(file) });
assert.deepEqual(actual, prior, 'Historical source qualification remains exactly unchanged after outer reconstruction');
console.log(`rc1-company-operator-source-compatibility: PASS ${chunks} exact Git hunks; ${wholeFileComparisons} whole-file comparisons (${sha256Comparisons} SHA256 + ${blobComparisons} Git blob + ${wholeFileComparisons - sha256Comparisons - blobComparisons} complete text); ${negatives} unknown/missing/duplicate/reordered/context/hook controls; LF/CRLF; exact full server/worker envelopes; historical scoped parity only`);
