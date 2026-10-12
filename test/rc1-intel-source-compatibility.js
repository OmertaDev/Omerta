import { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';
import { COMPANY_OPERATOR_SOURCE_CURRENT_PINS, COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS } from '../tools/rc1-company-operator-source-compatibility.js';
import { companyWorkflowSourceBaseline } from '../tools/rc1-company-workflow-source-compatibility.js';
import { invoiceSourceBaseline, INVOICE_SOURCE_CURRENT_PINS } from '../tools/rc1-invoice-source-compatibility.js';
import { coverageSourceBaseline } from '../tools/rc1-logistics-coverage-source-compatibility.js';
import { strategySourceBaseline } from '../tools/rc1-strategy-source-compatibility.js';
import { companySuccessionSourceBaseline } from '../tools/rc1-company-succession-source-compatibility.js';
import { marketFeedSourceBaseline } from '../tools/rc1-market-feed-source-compatibility.js';
import { strategyLeagueSourceBaseline } from '../tools/rc1-strategy-league-source-compatibility.js';
import assert from 'node:assert/strict';
import { cityHomesFeedSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { INTEL_SOURCE_CURRENT_PINS, INTEL_SOURCE_BASELINE_PINS, INTEL_SOURCE_CURRENT_BLOBS, INTEL_SOURCE_BASELINE_BLOBS,
  INTEL_SOURCE_REVIEWED_REVISION, INTEL_SOURCE_PREDECESSOR_REVISION, INTEL_SOURCE_INVERSES, INTEL_SOURCE_TRANSFER,
  assertIntelSourceTransfer, qualifyIntelSource } from '../tools/rc1-intel-source-compatibility.js';
const normalize = text => text.replaceAll('\r\n', '\n');
const gitText = spec => normalize(execFileSync('git', ['show', spec], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
let chunks = 0, negatives = 0;
for (const file of Object.keys(INTEL_SOURCE_CURRENT_PINS)) {
  const raw = normalize(fs.readFileSync(file, 'utf8'));
  const compose = text => invoiceSourceBaseline(file, coverageSourceBaseline(file, strategySourceBaseline(file, companySuccessionSourceBaseline(file, marketFeedSourceBaseline(file, strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, text)))))));
  const current = compose(raw), baseline = gitText(INTEL_SOURCE_BASELINE_BLOBS[file]);
  const unknown = raw + '\n// unreviewed composed source\n';
  assert.equal(compose(unknown), unknown, 'Exact wrappers never manufacture historical bytes for unknown stacked source');
  assert.throws(() => qualifyIntelSource(file, compose(unknown)), /source changed/);
  negatives++;
  assert.equal(current, gitText(INTEL_SOURCE_CURRENT_BLOBS[file]), 'Complete Intel bytes after exact known source inverses match frozen current Git blob: ' + file);
  assert.equal(current, gitText(INTEL_SOURCE_REVIEWED_REVISION + ':' + file));
  assert.equal(baseline, gitText(INTEL_SOURCE_PREDECESSOR_REVISION + ':' + file));
  assert.equal(hash(current), INTEL_SOURCE_CURRENT_PINS[file]);
  assert.equal(hash(baseline), INTEL_SOURCE_BASELINE_PINS[file]);
  const proof = assertIntelSourceTransfer(file, current);
  assert.equal(proof.baselineText, baseline, 'All exact inverses reconstruct the entire predecessor file: ' + file);
  assert.equal(proof.sourceBlob, INTEL_SOURCE_CURRENT_BLOBS[file]);
  assert.equal(proof.predecessorBlob, INTEL_SOURCE_BASELINE_BLOBS[file]);
  assert.equal(proof.actualSha256, INTEL_SOURCE_CURRENT_PINS[file]);
  assert.equal(proof.baselineSha256, INTEL_SOURCE_BASELINE_PINS[file]);
  assert.equal(proof.inverseChunks, INTEL_SOURCE_TRANSFER.inverseChunks[file]);
  assert.equal(qualifyIntelSource(file, current).baselineText, baseline);
  const unchanged = qualifyIntelSource(file, baseline);
  assert.equal(unchanged.baselineText, baseline); assert.equal(unchanged.inverseChunks, 0);
  assert.equal(unchanged.sourceBlob, INTEL_SOURCE_BASELINE_BLOBS[file]);
  assert.equal(assertIntelSourceTransfer(file, current.replaceAll('\n', '\r\n')).baselineText, baseline);
  assert.equal(qualifyIntelSource(file, baseline.replaceAll('\n', '\r\n')).baselineText, baseline);
  for (const chunk of INTEL_SOURCE_INVERSES[file]) {
    chunks++; assert.equal(current.split(chunk).length, 2, 'Every exact addition appears once: ' + file);
    for (const changed of [current.replace(chunk, ''), current.replace(chunk, chunk + chunk)]) {
      assert.notEqual(changed, current); assert.notEqual(changed, baseline, 'Partial deletion is not the complete predecessor');
      assert.throws(() => assertIntelSourceTransfer(file, changed), /source changed/);
      assert.throws(() => qualifyIntelSource(file, changed), /source changed/); negatives++;
    }
  }
  for (const text of [current, baseline]) {
    const changed = text + '\n// unsupported source suffix\n';
    assert.throws(() => qualifyIntelSource(file, changed), /source changed/); negatives++;
  }
  const altered = current.replace(INTEL_SOURCE_INVERSES[file][0], INTEL_SOURCE_INVERSES[file][0].replace('import ', 'import/* changed */ '));
  assert.notEqual(altered, current); assert.throws(() => qualifyIntelSource(file, altered), /source changed/); negatives++;
  assert.throws(() => assertIntelSourceTransfer(file, baseline), /source changed/, 'Current transfer never treats historical bytes as the new integration');
}
assert.throws(() => qualifyIntelSource('src/game.js', ''), /Unknown Intel source/);
assert.throws(() => qualifyIntelSource('toString', ''), /Unknown Intel source/);
assert.match(INTEL_SOURCE_TRANSFER.scope, /separate current-source native proof/);
assert.match(INTEL_SOURCE_TRANSFER.scope, /no historical runtime, native, deployment or financial qualification/);
const operatorWorker = companyWorkflowSourceBaseline('src/worker.js', fs.readFileSync('src/worker.js', 'utf8'));
const operatorTransfer = qualifyIntelSource('src/worker.js', operatorWorker);
assert.equal(operatorTransfer.actualSha256, COMPANY_OPERATOR_SOURCE_CURRENT_PINS['src/worker.js']);
assert.equal(operatorTransfer.companyOperatorSourceTransfer.baselineText, gitText(COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS['src/worker.js']));
assert.equal(operatorTransfer.companyOperatorSourceTransfer.baselineText, gitText(INTEL_SOURCE_CURRENT_BLOBS['src/worker.js']));
assert.equal(operatorTransfer.baselineText, gitText(INTEL_SOURCE_BASELINE_BLOBS['src/worker.js']));
assert.deepEqual(qualifyIntelSource('src/worker.js', operatorWorker.replaceAll('\n', '\r\n')), operatorTransfer);
for (const changed of [operatorWorker + '\n// unreviewed operator suffix\n', operatorWorker.replace('runCompanyOperators(pool, 20)', 'runCompanyOperators(pool, 21)'), operatorWorker.replace('  void guardedCompanyTick();\n', ''), operatorWorker.replace('setInterval(guardedCompanyTick, 30000);', 'setInterval(guardedCompanyTick, 30000);\n  setInterval(guardedCompanyTick, 30000);')]) {
  assert.notEqual(changed, operatorWorker); assert.throws(() => qualifyIntelSource('src/worker.js', changed), /source changed/); negatives++;
}
console.log(JSON.stringify({ status: 'PASS', files: 4, chunks, negatives,
  scope: 'Complete frozen current/prior blobs, exact addition inverses and regression controls only; no new native or financial qualification' }));
