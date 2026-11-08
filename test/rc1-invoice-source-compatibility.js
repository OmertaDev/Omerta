import { questingHistoricalInput } from '../tools/questing-source-transfer.js';
import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';
import {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from "../tools/commerce-current-enterprise-source-compatibility.js";
import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';
import { companyOperatorSourceBaseline } from '../tools/rc1-company-operator-source-compatibility.js';
import { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';
import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';
import { strategyLeagueSourceBaseline } from '../tools/rc1-strategy-league-source-compatibility.js';
import { marketFeedSourceBaseline } from '../tools/rc1-market-feed-source-compatibility.js';
import { companySuccessionSourceBaseline } from '../tools/rc1-company-succession-source-compatibility.js';
import { strategySourceBaseline } from '../tools/rc1-strategy-source-compatibility.js';
import { coverageSourceBaseline } from '../tools/rc1-logistics-coverage-source-compatibility.js';
import assert from 'node:assert/strict';
import { cityHomesFeedSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { qualifyIntelSource } from '../tools/rc1-intel-source-compatibility.js';
import { INVOICE_SOURCE_CURRENT_PINS, INVOICE_SOURCE_BASELINE_PINS, INVOICE_SOURCE_CURRENT_BLOBS, INVOICE_SOURCE_BASELINE_BLOBS,
  INVOICE_SOURCE_REVIEWED_REVISION, INVOICE_SOURCE_PREDECESSOR_REVISION, INVOICE_SOURCE_INVERSES, INVOICE_SOURCE_TRANSFER,
  assertInvoiceSourceTransfer, qualifyInvoiceSource, invoiceSourceBaseline } from '../tools/rc1-invoice-source-compatibility.js';
const normalize = text => text.replaceAll('\r\n', '\n');
const gitText = spec => normalize(execFileSync('git', ['show', spec], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
let chunks = 0, negatives = 0;
for (const file of Object.keys(INVOICE_SOURCE_CURRENT_PINS)) {
  const current = normalize(coverageSourceBaseline(file, strategySourceBaseline(file, companySuccessionSourceBaseline(file, marketFeedSourceBaseline(file, strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,(hasCommerceCurrentEnterpriseSource(file)?commerceOverCurrentEnterpriseSourceBaseline(file,String(fs.readFileSync(file, 'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8')))):continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))))))))))), baseline = gitText(INVOICE_SOURCE_BASELINE_BLOBS[file]);
  assert.equal(invoiceSourceBaseline(file, current), baseline);
  assert.equal(invoiceSourceBaseline(file, baseline), baseline);
  const unknown = current + '\n// unknown source suffix\n';
  assert.equal(invoiceSourceBaseline(file, unknown), unknown, 'composition must not manufacture historical bytes for unreviewed source');
  assert.throws(() => qualifyInvoiceSource(file, invoiceSourceBaseline(file, unknown)), /source changed/);
  assert.equal(current, gitText(INVOICE_SOURCE_CURRENT_BLOBS[file]), 'Complete Invoice bytes after any exact Home inverse match frozen current Git blob: ' + file);
  assert.equal(current, gitText(INVOICE_SOURCE_REVIEWED_REVISION + ':' + file));
  assert.equal(baseline, gitText(INVOICE_SOURCE_PREDECESSOR_REVISION + ':' + file));
  assert.equal(hash(current), INVOICE_SOURCE_CURRENT_PINS[file]);
  assert.equal(hash(baseline), INVOICE_SOURCE_BASELINE_PINS[file]);
  const diff = normalize(execFileSync('git', ['diff', '--no-ext-diff', '--unified=3',
    INVOICE_SOURCE_PREDECESSOR_REVISION, INVOICE_SOURCE_REVIEWED_REVISION, '--', file], { encoding: 'utf8' }));
  const gitChunks = []; let hunk;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@ ')) { hunk = { current: '', baseline: '' }; gitChunks.push(hunk); continue; }
    if (!hunk) continue;
    if (line.startsWith(' ')) { hunk.current += line.slice(1) + '\n'; hunk.baseline += line.slice(1) + '\n'; }
    else if (line.startsWith('+')) hunk.current += line.slice(1) + '\n';
    else if (line.startsWith('-')) hunk.baseline += line.slice(1) + '\n';
  }
  assert.deepEqual(INVOICE_SOURCE_INVERSES[file], gitChunks, 'Only actual complete Git diff hunks qualify: ' + file);
  const proof = assertInvoiceSourceTransfer(file, current);
  assert.equal(proof.baselineText, baseline, 'All exact inverses reconstruct the entire predecessor file: ' + file);
  assert.equal(proof.sourceBlob, INVOICE_SOURCE_CURRENT_BLOBS[file]);
  assert.equal(proof.predecessorBlob, INVOICE_SOURCE_BASELINE_BLOBS[file]);
  assert.equal(proof.actualSha256, INVOICE_SOURCE_CURRENT_PINS[file]);
  assert.equal(proof.baselineSha256, INVOICE_SOURCE_BASELINE_PINS[file]);
  assert.equal(proof.inverseChunks, INVOICE_SOURCE_TRANSFER.inverseChunks[file]);
  assert.equal(qualifyInvoiceSource(file, current).baselineText, baseline);
  const unchanged = qualifyInvoiceSource(file, baseline);
  assert.equal(unchanged.baselineText, baseline); assert.equal(unchanged.inverseChunks, 0);
  assert.equal(unchanged.sourceBlob, INVOICE_SOURCE_BASELINE_BLOBS[file]);
  assert.equal(assertInvoiceSourceTransfer(file, current.replaceAll('\n', '\r\n')).baselineText, baseline);
  assert.equal(qualifyInvoiceSource(file, baseline.replaceAll('\n', '\r\n')).baselineText, baseline);
  for (const chunk of INVOICE_SOURCE_INVERSES[file]) {
    chunks++; assert.equal(current.split(chunk.current).length, 2, 'Every exact addition appears once: ' + file);
    for (const changed of [current.replace(chunk.current, ''), current.replace(chunk.current, chunk.current + chunk.current)]) {
      assert.notEqual(changed, current); assert.notEqual(changed, baseline, 'Partial deletion is not the complete predecessor');
      assert.throws(() => assertInvoiceSourceTransfer(file, changed), /source changed/);
      assert.throws(() => qualifyInvoiceSource(file, changed), /source changed/); negatives++;
    }
  }
  for (const text of [current, baseline]) {
    const changed = text + '\n// unsupported source suffix\n';
    assert.throws(() => qualifyInvoiceSource(file, changed), /source changed/); negatives++;
  }
  const altered = current.replace(/^import /m, 'import/* changed */ ');
  assert.notEqual(altered, current); assert.throws(() => qualifyInvoiceSource(file, altered), /source changed/); negatives++;
  const protectedLine = current.split('\n').find(line => line.trim() && !INVOICE_SOURCE_INVERSES[file].some(chunk => chunk.current.includes(line + '\n')));
  assert(protectedLine, 'Protected predecessor logic exists outside inverse chunks: ' + file);
  assert.throws(() => qualifyInvoiceSource(file, current.replace(protectedLine, protectedLine + ' /* altered protected logic */')), /source changed/); negatives++;
  assert.throws(() => assertInvoiceSourceTransfer(file, baseline), /source changed/, 'Current transfer never treats historical bytes as the new integration');
}
for (const [file, before, after] of [
  ['src/invariants.js', 'quote.projectedCashRemainder !== quote.fullSettlementNet - owed', 'quote.projectedCashRemainder !== quote.fullSettlementNet + owed'],
  ['src/invariants.js', 'loanEscrow, loanOffered - loanTaken - loanRefunded - loanDeath - loanLoot', 'loanEscrow, loanOffered + loanTaken - loanRefunded - loanDeath - loanLoot'],
  ['src/courierjobs.js', 'Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER', 'Number.isFinite(n) && n >= -1 && n <= Number.MAX_SAFE_INTEGER'],
]) {
  const text = normalize(fs.readFileSync(file, 'utf8'));
  assert.equal(text.split(before).length, 2, 'Targeted accounting/quote/fraction guard exists exactly once');
  assert.throws(() => qualifyInvoiceSource(file, text.replace(before, after)), /source changed/); negatives++;
}
// The exact current population source must enter SITE before the existing
// hardening/invoice chain. These are source-comparison controls, not native evidence.
const populationInput = fs.readFileSync('src/population.js', 'utf8');
const populationLf = normalize(populationInput);
const populationBaseline = gitText('545c16d65cc482ffbc5364ba2aaa0a56916d7b79:src/population.js');
assert.equal(hash(populationBaseline), '7ca4cfe884b3b2f8acd44a9c34c88507c9c42e0730688cac1d4bd358a7d9cecb');
for (const input of [populationInput, populationLf, populationLf.replaceAll('\n', '\r\n')])
  assert.equal(invoiceSourceBaseline('src/population.js', input), populationBaseline);
const checkpointImport = "import { checkpointCasinoRakeback, checkpointCasinoOwnerRemoval } from './casinorakeback.js';\n";
assert.equal(populationLf.split(checkpointImport).length, 2, 'The partial-current control removes exactly one reviewed import');
assert.equal(populationLf.split('ORDER BY id LIMIT 24').length, 2, 'The query drift changes the exact jailbird selection');
for (const changed of [populationLf + '\n// unsupported population source suffix\n',
  populationLf.replace(checkpointImport, ''),
  populationLf.replace('ORDER BY id LIMIT 24', 'ORDER BY id DESC LIMIT 24')]) {
  assert.notEqual(changed, populationLf, 'Every population refusal changes the actual source');
  assert.equal(invoiceSourceBaseline('src/population.js', changed), changed,
    'Unknown, partial-current and query-changed population source cannot acquire historical admission');
  negatives++;
}

assert.throws(() => qualifyInvoiceSource('src/worker.js', ''), /Unknown Invoice source/);
const workerInput = fs.readFileSync('src/worker.js', 'utf8');
const unreviewedWorker = workerInput + '\n// unreviewed worker change\n';
assert.equal(questingHistoricalInput('src/worker.js', unreviewedWorker), unreviewedWorker); negatives++;
const worker = companyOperatorSourceBaseline('src/worker.js', normalize(questingHistoricalInput('src/worker.js', workerInput)));
assert.equal(worker, gitText(INVOICE_SOURCE_PREDECESSOR_REVISION + ':src/worker.js'));
assert.equal(worker, gitText(INVOICE_SOURCE_REVIEWED_REVISION + ':src/worker.js'));
assert.equal(qualifyIntelSource('src/worker.js', worker).baselineText.length > 0, true);
assert.equal(Object.hasOwn(INVOICE_SOURCE_CURRENT_PINS, 'src/worker.js'), false);
assert.throws(() => qualifyInvoiceSource('src/game.js', ''), /Unknown Invoice source/);
assert.throws(() => qualifyInvoiceSource('toString', ''), /Unknown Invoice source/);
assert.match(INVOICE_SOURCE_TRANSFER.scope, /separate current-source native proof/);
assert.match(INVOICE_SOURCE_TRANSFER.scope, /no historical runtime, native, deployment or financial qualification/);
console.log(JSON.stringify({ status: 'PASS', files: 7, chunks, negatives,
  scope: 'Complete frozen current/prior blobs, exact unique Git diff hunk inverses and regression controls only; no new native or financial qualification' }));
