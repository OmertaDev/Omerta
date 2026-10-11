import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { assertLoanCancelMarkerTransfer, qualifyLoanCancelSource, LOAN_CANCEL_BASELINE_PIN, LOAN_CANCEL_MARKER_PIN,
  LOAN_CANCEL_MARKER_BLOB, LOAN_CANCEL_BASELINE_BLOB, LOAN_CANCEL_SOURCE_INVERSE, LOAN_CANCEL_SOURCE_TRANSFER } from '../tools/rc1-loan-source-compatibility.js';
import { BACKLOG_SOURCE_PINS } from '../tools/rc1-world-backlog-review.js';
import { LOAN_REFUND_METRIC_SOURCE_PINS } from '../tools/rc1-world-economy-metrics.js';
const gitText = blob => execFileSync('git', ['show', blob], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).replaceAll('\r\n', '\n');
const current = fs.readFileSync('src/loans.js', 'utf8').replaceAll('\r\n', '\n');
assert.equal(current, gitText(LOAN_CANCEL_MARKER_BLOB), 'runtime source remains byte-identical to the reviewed marker blob');
assert.equal(current, gitText('HEAD:src/loans.js'));
const proof = assertLoanCancelMarkerTransfer(current), baseline = gitText(LOAN_CANCEL_BASELINE_BLOB);
assert.equal(proof.baselineText, baseline, 'one exact return-line inverse reconstructs the complete original source');
assert.equal(proof.actualSha256, LOAN_CANCEL_MARKER_PIN); assert.equal(proof.baselineSha256, LOAN_CANCEL_BASELINE_PIN); assert.equal(proof.inverseChunks, 1);
assert.equal(BACKLOG_SOURCE_PINS['src/loans.js'], LOAN_CANCEL_BASELINE_PIN, 'backlog historical authority pin is unchanged');
assert.equal(LOAN_REFUND_METRIC_SOURCE_PINS['src/loans.js'], LOAN_CANCEL_BASELINE_PIN, 'receipt custody historical authority pin is unchanged');
assert.equal(qualifyLoanCancelSource(baseline).baselineText, baseline); assert.equal(qualifyLoanCancelSource(current).baselineText, baseline);
assert.equal(assertLoanCancelMarkerTransfer(current.replaceAll('\n', '\r\n')).baselineText, baseline, 'only established CRLF normalization is admitted');
const [marker, original] = LOAN_CANCEL_SOURCE_INVERSE;
for (const [label, changed] of [['missing-marker-line', current.replace(marker, '')], ['missing-addition', current.replace(marker, original)],
  ['duplicate', current.replace(marker, marker + marker)], ['unknown-output', current.replace("loanAction: 'cancel_offer'", "loanAction: 'cancel_anything'")],
  ['unknown-accounting', current.replace('ch.cash = Number(ch.cash) + Number(loan.principal);', 'ch.cash = Number(ch.cash) - Number(loan.principal);')],
  ['unknown-suffix', current + '\n// unknown source drift\n']]) {
  assert.notEqual(changed, current, `${label} causal input must change actual source`);
  assert.throws(() => assertLoanCancelMarkerTransfer(changed), /source changed/, label);
  if (changed !== baseline) assert.throws(() => qualifyLoanCancelSource(changed), /source changed/, `${label} cannot silently qualify`);
}
assert.throws(() => qualifyLoanCancelSource(baseline + '\n// unknown old source drift\n'), /source changed/);
assert.deepEqual(proof.sourceBlob, LOAN_CANCEL_SOURCE_TRANSFER.sourceBlob);
console.log('loan marker compatibility PASS: whole reviewed new/old blobs, exact unique1chunk inverse, unchanged2historicalpins, missing/duplicate/output/accounting/suffix negatives; qualification scope unchanged');
