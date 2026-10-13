import { commercialPremisesSourceBaseline } from '../tools/rc1-commercial-premises-source-compatibility.js';
import { cityGameplaySourceBaseline } from '../tools/rc1-city-gameplay-source-compatibility.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION, COMPANY_WORKFLOW_SOURCE_PREDECESSOR_REVISION,
  COMPANY_WORKFLOW_SOURCE_CURRENT_PINS, COMPANY_WORKFLOW_SOURCE_BASELINE_PINS, COMPANY_WORKFLOW_SOURCE_CURRENT_BLOBS,
  COMPANY_WORKFLOW_SOURCE_BASELINE_BLOBS, COMPANY_WORKFLOW_SOURCE_INVERSES, COMPANY_WORKFLOW_SOURCE_TRANSFER,
  assertCompanyWorkflowSourceTransfer, qualifyCompanyWorkflowSource, companyWorkflowSourceBaseline } from '../tools/rc1-company-workflow-source-compatibility.js';
import { GAME_EMPLOYMENT_SOURCE_CURRENT_PINS, GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS, GAME_EMPLOYMENT_SOURCE_TRANSFER,
  assertGameEmploymentSourceTransfer, gameEmploymentSourceBaseline } from '../tools/rc1-game-employment-source-compatibility.js';
import { COMPANY_OPERATOR_SOURCE_CURRENT_PINS, COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS, COMPANY_OPERATOR_SOURCE_TRANSFER,
  assertCompanyOperatorSourceTransfer } from '../tools/rc1-company-operator-source-compatibility.js';
import { qualifyIntelSource } from '../tools/rc1-intel-source-compatibility.js';
import { invoiceSourceBaseline } from '../tools/rc1-invoice-source-compatibility.js';
import { WORLD_RECOVERY_REVIEW, verifyWorldRecoverySources } from '../tools/rc1-world-qualification.js';
import * as Deed from '../tools/rc1-deed-source-compatibility.js';

const normalize = text => text.replaceAll('\r\n', '\n');
const git = (...args) => normalize(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
let completeTextComparisons = 0, sha256Comparisons = 0, blobComparisons = 0, negatives = 0, hunks = 0;
const entire = (actual, expected, message) => { assert.equal(actual, expected, message); completeTextComparisons++; };
const sources = new Map(), predecessors = new Map();
assert.deepEqual(Object.keys(COMPANY_WORKFLOW_SOURCE_CURRENT_PINS), ['src/server.js', 'src/worker.js', 'src/invariants.js', 'src/social/estate.js']);
for (const file of Object.keys(COMPANY_WORKFLOW_SOURCE_CURRENT_PINS)) {
  const current = commercialPremisesSourceBaseline(file,cityGameplaySourceBaseline(file,fs.readFileSync(file,'utf8'))), baseline = git('show', COMPANY_WORKFLOW_SOURCE_BASELINE_BLOBS[file]); sources.set(file, current); predecessors.set(file, baseline);
  entire(current, git('show', COMPANY_WORKFLOW_SOURCE_CURRENT_BLOBS[file])); entire(current, git('show', `${COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION}:${file}`)); entire(current, git('show', `129ab229990c2b9c0d3a460ed75f731081fd1f5c:${file}`));
  entire(baseline, git('show', `${COMPANY_WORKFLOW_SOURCE_PREDECESSOR_REVISION}:${file}`));
  assert.equal(hash(current), COMPANY_WORKFLOW_SOURCE_CURRENT_PINS[file]); assert.equal(hash(baseline), COMPANY_WORKFLOW_SOURCE_BASELINE_PINS[file]); sha256Comparisons += 2;
  assert.equal(blob(current), COMPANY_WORKFLOW_SOURCE_CURRENT_BLOBS[file]); assert.equal(blob(baseline), COMPANY_WORKFLOW_SOURCE_BASELINE_BLOBS[file]); blobComparisons += 2;
  const chunks = []; let hunk;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', COMPANY_WORKFLOW_SOURCE_PREDECESSOR_REVISION, COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION, '--', file).split('\n')) {
    if (line.startsWith('@@ ')) { hunk = { current: '', baseline: '' }; chunks.push(hunk); continue; }
    if (!hunk) continue;
    if (line.startsWith(' ')) { hunk.current += line.slice(1) + '\n'; hunk.baseline += line.slice(1) + '\n'; }
    else if (line.startsWith('+')) hunk.current += line.slice(1) + '\n'; else if (line.startsWith('-')) hunk.baseline += line.slice(1) + '\n';
  }
  assert.deepEqual(COMPANY_WORKFLOW_SOURCE_INVERSES[file], chunks); assert.equal(chunks.length, 2); hunks += chunks.length;
  const proof = assertCompanyWorkflowSourceTransfer(file, current);
  entire(proof.baselineText, baseline); entire(companyWorkflowSourceBaseline(file, current), baseline); entire(qualifyCompanyWorkflowSource(file, current).baselineText, baseline); entire(qualifyCompanyWorkflowSource(file, baseline).baselineText, baseline);
  entire(assertCompanyWorkflowSourceTransfer(file, current.replaceAll('\n', '\r\n')).baselineText, baseline); entire(qualifyCompanyWorkflowSource(file, baseline.replaceAll('\n', '\r\n')).baselineText, baseline);
  assert.equal(proof.sourceRevision, COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION); assert.equal(proof.predecessorRevision, COMPANY_WORKFLOW_SOURCE_PREDECESSOR_REVISION); assert.equal(proof.sourceBlob, COMPANY_WORKFLOW_SOURCE_CURRENT_BLOBS[file]); assert.equal(proof.predecessorBlob, COMPANY_WORKFLOW_SOURCE_BASELINE_BLOBS[file]);
  assert.equal(proof.actualSha256, COMPANY_WORKFLOW_SOURCE_CURRENT_PINS[file]); assert.equal(proof.baselineSha256, COMPANY_WORKFLOW_SOURCE_BASELINE_PINS[file]); assert.equal(proof.inverseChunks, 2); assert.equal(qualifyCompanyWorkflowSource(file, baseline).inverseChunks, 0);
  assert.equal(proof.evidence, COMPANY_WORKFLOW_SOURCE_TRANSFER.evidence); assert.equal(proof.phase, COMPANY_WORKFLOW_SOURCE_TRANSFER.phase); assert.equal(proof.scope, COMPANY_WORKFLOW_SOURCE_TRANSFER.scope);
  assert.throws(() => assertCompanyWorkflowSourceTransfer(file, baseline), /source changed/, 'A complete N02 file is not the new N03 runtime');
  const changes = [current + '\n// unknown file suffix\n', '// unknown prefix\n' + current];
  for (const chunk of chunks) {
    assert.equal(current.split(chunk.current).length, 2); const context = chunk.current.split('\n').find(line => line.trim() && chunk.baseline.includes(line + '\n')); assert(context);
    changes.push(current.replace(chunk.current, ''), current.replace(chunk.current, chunk.current + chunk.current), current.replace(chunk.current, chunk.current.replace(context + '\n', context + ' // protected context drift\n')));
  }
  const [a, b] = chunks; changes.push(current.replace(a.current, '__WORKFLOW_HUNK__').replace(b.current, a.current).replace('__WORKFLOW_HUNK__', b.current));
  if (file === 'src/server.js') changes.push(current.replace('registerCompanyWorkflows(app, { pool, auth });', 'registerCompanyWorkflows(app, { pool });'), current.replace("from './routes/companyworkflows.js'", "from './routes/otherworkflows.js'"), current.replace('registerGameEmployment(app, { pool, auth });', 'registerGameEmployment(app, { pool });'));
  else if (file === 'src/worker.js') changes.push(current.replace('runCompanyWorkflows(pool, 20)', 'runCompanyWorkflows(pool, 21)'), current.replace('setInterval(guardedCompanyTick, 30000);', 'setInterval(guardedCompanyTick, 60000);'), current.replace("      await safe('company operators', () => runCompanyOperators(pool, 20));\n      await safe('company workflows', () => runCompanyWorkflows(pool, 20));", "      await safe('company workflows', () => runCompanyWorkflows(pool, 20));\n      await safe('company operators', () => runCompanyOperators(pool, 20));"), current.replace('runCompanyOperators(pool, 20)', 'runCompanyOperators(pool, 21)'));
  else if (file === 'src/invariants.js') changes.push(current.replace("push('company workflow provenance', workflows.issues.length, 0, 0", "push('company workflow provenance', 0, 0, 0"), current.replace('await runCompanyWorkflowInvariants(pool)', 'await runCompanyWorkflowInvariants(null)'));
  else changes.push(current.replace('await closeCompanyWorkflowsAtDeath(client, victim.id)', 'await closeCompanyWorkflowsAtDeath(client, opts.killerCh.id)'), current.replace('await voidEmploymentAtDeath(client, h, victim, opts.killerCh, estateLootRate)', 'await voidEmploymentAtDeath(client, h, victim, null, 0)'));
  for (const changed of changes) {
    assert.notEqual(changed, current); assert.equal(companyWorkflowSourceBaseline(file, changed), changed); assert.equal(gameEmploymentSourceBaseline(file, changed), changed); assert.equal(invoiceSourceBaseline(file, changed), changed, 'Unknown source remains unchanged across every older composition');
    assert.throws(() => assertCompanyWorkflowSourceTransfer(file, changed), /source changed/); assert.throws(() => qualifyCompanyWorkflowSource(file, changed), /source changed/); assert.throws(() => assertCompanyWorkflowSourceTransfer(file, changed.replaceAll('\n', '\r\n')), /source changed/);
    if (file === 'src/worker.js') assert.throws(() => qualifyIntelSource(file, changed), /source changed/);
    if (file === 'src/server.js') assert.throws(() => Deed.assertDeedServerCompatibility(changed), /source changed/);
    if (file === 'src/invariants.js') assert.throws(() => Deed.assertDeedBacklogCompatibility(file, changed), /source changed/);
    // WQ's historical file domain is unchanged; invariant/estate bytes have their own closed guards.
    if (Object.hasOwn(WORLD_RECOVERY_REVIEW.sourceFiles, file)) await assert.rejects(() => verifyWorldRecoverySources({ sourceRevision: COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION, readFile: candidate => candidate === file ? changed : fs.readFileSync(candidate) }), /source changed/);
    else assert.throws(() => qualifyIntelSource(file, invoiceSourceBaseline(file, changed)), /source changed/);
    negatives++;
  }
  if (file !== 'src/worker.js') {
    assert.equal(COMPANY_WORKFLOW_SOURCE_BASELINE_PINS[file], GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[file]); assert.equal(COMPANY_WORKFLOW_SOURCE_BASELINE_BLOBS[file], GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS[file]);
    entire(gameEmploymentSourceBaseline(file, current), assertGameEmploymentSourceTransfer(file, baseline).baselineText);
    assert.throws(() => assertGameEmploymentSourceTransfer(file, current), /source changed/, 'Strict N02 assert stays frozen');
  }
  if (file === 'src/invariants.js') for (const guard of ['assertDeedBacklogCompatibility', 'assertFranchiseSourceTransfer']) {
    const composed = Deed[guard](file, current), prior = Deed[guard](file, baseline); assert.deepEqual(composed.companyWorkflowSourceTransfer, proof);
    for (const [key, value] of Object.entries(prior)) if (key !== 'actualSha256') assert.deepEqual(composed[key], value, 'Original N02/historical metadata remains unchanged');
  }
}
for (const file of ['src/companyworkflows.js', 'src/game.js', 'toString']) { assert.throws(() => assertCompanyWorkflowSourceTransfer(file, ''), /Unknown Company Workflow/); assert.throws(() => qualifyCompanyWorkflowSource(file, ''), /Unknown Company Workflow/); }
assert.equal(companyWorkflowSourceBaseline('unknown', 'unknown bytes'), 'unknown bytes');
const server = sources.get('src/server.js'), serverPrior = predecessors.get('src/server.js'), serverProof = assertCompanyWorkflowSourceTransfer('src/server.js', server);
for (const guard of ['assertGenesisSnapshotServerCompatibility', 'assertGenesisWrapperServerCompatibility', 'assertHttpReceiptServerCompatibility', 'assertDeedServerCompatibility']) {
  const current = Deed[guard](server), old = Deed[guard](serverPrior); assert.deepEqual(current.companyWorkflowSourceTransfer, serverProof); assert.deepEqual(current.gameEmploymentSourceTransfer, old.gameEmploymentSourceTransfer); assert.deepEqual(current.companyOperatorSourceTransfer, old.companyOperatorSourceTransfer);
  for (const [key, value] of Object.entries(old)) if (key !== 'actualSha256') assert.deepEqual(current[key], value);
  assert.equal(current.actualSha256, COMPANY_WORKFLOW_SOURCE_CURRENT_PINS['src/server.js']);
}
const economy = Deed.assertEconomySourceTransfer('src/server.js', server); assert.deepEqual(economy.companyWorkflowSourceTransfer, serverProof);
const worker = sources.get('src/worker.js'), workerPrior = predecessors.get('src/worker.js'), workerProof = assertCompanyWorkflowSourceTransfer('src/worker.js', worker);
assert.equal(hash(workerPrior), COMPANY_OPERATOR_SOURCE_CURRENT_PINS['src/worker.js']); assert.equal(blob(workerPrior), COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS['src/worker.js']); sha256Comparisons++; blobComparisons++;
const intel = qualifyIntelSource('src/worker.js', worker), oldIntel = qualifyIntelSource('src/worker.js', workerPrior);
assert.deepEqual(intel.companyWorkflowSourceTransfer, workerProof); assert.deepEqual(intel.companyOperatorSourceTransfer, assertCompanyOperatorSourceTransfer('src/worker.js', workerPrior));
for (const [key, value] of Object.entries(oldIntel)) if (key !== 'actualSha256') assert.deepEqual(intel[key], value, 'Old Intel/N01 scope and metadata unchanged');
assert.equal(intel.actualSha256, COMPANY_WORKFLOW_SOURCE_CURRENT_PINS['src/worker.js']);
assert.deepEqual(WORLD_RECOVERY_REVIEW.companyWorkflowSourceReviewTransfer, COMPANY_WORKFLOW_SOURCE_TRANSFER); assert.deepEqual(WORLD_RECOVERY_REVIEW.gameEmploymentSourceReviewTransfer, GAME_EMPLOYMENT_SOURCE_TRANSFER); assert.deepEqual(WORLD_RECOVERY_REVIEW.companyOperatorSourceReviewTransfer, COMPANY_OPERATOR_SOURCE_TRANSFER);
assert.match(COMPANY_WORKFLOW_SOURCE_TRANSFER.scope, /no world-soak, native, financial, deployment or onchain qualification/);
const currentQualification = await verifyWorldRecoverySources({ sourceRevision: COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION, readFile: file => fs.readFileSync(file) });
const priorQualification = await verifyWorldRecoverySources({ sourceRevision: COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION, readFile: file => predecessors.get(file) || fs.readFileSync(file) }); assert.deepEqual(currentQualification, priorQualification);
console.log(`rc1-company-workflow-source-compatibility: PASS ${hunks} exact Git hunks; ${completeTextComparisons} full text + ${sha256Comparisons} SHA256 + ${blobComparisons} Git blob comparisons; ${negatives} missing/duplicate/reordered/full-file/context/auth/import/worker-cap-cadence/estate/invariant/older-layer controls; LF/CRLF; completecurrent metadata; original N02/N01/historical scope only`);
