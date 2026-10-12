import assert from 'node:assert/strict';
import { companyWorkflowSourceBaseline } from '../tools/rc1-company-workflow-source-compatibility.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION, GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION,
  GAME_EMPLOYMENT_SOURCE_CURRENT_PINS, GAME_EMPLOYMENT_SOURCE_BASELINE_PINS, GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS,
  GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS, GAME_EMPLOYMENT_SOURCE_INVERSES, GAME_EMPLOYMENT_SOURCE_TRANSFER,
  assertGameEmploymentSourceTransfer, qualifyGameEmploymentSource, gameEmploymentSourceBaseline } from '../tools/rc1-game-employment-source-compatibility.js';
import { COMPANY_OPERATOR_SOURCE_CURRENT_PINS, COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS, COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS,
  COMPANY_OPERATOR_SOURCE_TRANSFER, assertCompanyOperatorSourceTransfer, companyOperatorSourceBaseline } from '../tools/rc1-company-operator-source-compatibility.js';
import { WORLD_RECOVERY_REVIEW, verifyWorldRecoverySources } from '../tools/rc1-world-qualification.js';
import { invoiceSourceBaseline } from '../tools/rc1-invoice-source-compatibility.js';
import * as Deed from '../tools/rc1-deed-source-compatibility.js';

const normalize = text => text.replaceAll('\r\n', '\n');
const git = (...args) => normalize(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
let completeTextComparisons = 0, sha256Comparisons = 0, blobComparisons = 0, negatives = 0, totalHunks = 2;
const entire = (actual, expected, message) => { assert.equal(actual, expected, message); completeTextComparisons++; };
const file = 'src/server.js', current = companyWorkflowSourceBaseline(file, fs.readFileSync(file, 'utf8')), baseline = git('show', GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[file]);
assert.deepEqual(Object.keys(GAME_EMPLOYMENT_SOURCE_CURRENT_PINS), [file, 'src/invariants.js', 'src/social/estate.js'], 'Closed authorized source domains, no new worker scope');
for (const spec of [GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS[file], `${GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION}:${file}`, 'e9d2aa81c4547ec792efa7a75270c8afa98151db:src/server.js', '56ccfe6e03c8a1b161e3203179cc0fa2605a6d39:src/server.js']) entire(current, git('show', spec), 'Complete frozen employment runtime');
entire(baseline, git('show', `${GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION}:${file}`), 'Complete N01 predecessor');
assert.equal(hash(current), GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[file]); assert.equal(hash(baseline), GAME_EMPLOYMENT_SOURCE_BASELINE_PINS[file]); sha256Comparisons += 2;
assert.equal(blob(current), GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS[file]); assert.equal(blob(baseline), GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[file]); blobComparisons += 2;
assert.equal(GAME_EMPLOYMENT_SOURCE_BASELINE_PINS[file], COMPANY_OPERATOR_SOURCE_CURRENT_PINS[file]);
assert.equal(GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[file], COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS[file]);
const chunks = []; let hunk;
for (const line of git('diff', '--no-ext-diff', '--unified=3', GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION, GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION, '--', file).split('\n')) {
  if (line.startsWith('@@ ')) { hunk = { current: '', baseline: '' }; chunks.push(hunk); continue; }
  if (!hunk) continue;
  if (line.startsWith(' ')) { hunk.current += line.slice(1) + '\n'; hunk.baseline += line.slice(1) + '\n'; }
  else if (line.startsWith('+')) hunk.current += line.slice(1) + '\n'; else if (line.startsWith('-')) hunk.baseline += line.slice(1) + '\n';
}
assert.deepEqual(GAME_EMPLOYMENT_SOURCE_INVERSES[file], chunks); assert.equal(chunks.length, 2);
const proof = assertGameEmploymentSourceTransfer(file, current);
entire(proof.baselineText, baseline); entire(gameEmploymentSourceBaseline(file, current), baseline);
entire(qualifyGameEmploymentSource(file, current).baselineText, baseline); entire(qualifyGameEmploymentSource(file, baseline).baselineText, baseline);
entire(assertGameEmploymentSourceTransfer(file, current.replaceAll('\n', '\r\n')).baselineText, baseline);
entire(qualifyGameEmploymentSource(file, baseline.replaceAll('\n', '\r\n')).baselineText, baseline);
assert.equal(proof.sourceRevision, GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION); assert.equal(proof.predecessorRevision, GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION);
assert.equal(proof.sourceBlob, GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS[file]); assert.equal(proof.predecessorBlob, GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[file]);
assert.equal(proof.actualSha256, GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[file]); assert.equal(proof.baselineSha256, GAME_EMPLOYMENT_SOURCE_BASELINE_PINS[file]);
assert.equal(proof.inverseChunks, 2); assert.equal(qualifyGameEmploymentSource(file, baseline).inverseChunks, 0);
assert.equal(proof.phase, GAME_EMPLOYMENT_SOURCE_TRANSFER.phase); assert.equal(proof.scope, GAME_EMPLOYMENT_SOURCE_TRANSFER.scope);
assert.equal(proof.evidence, GAME_EMPLOYMENT_SOURCE_TRANSFER.evidence);
const originalOperator = assertCompanyOperatorSourceTransfer(file, baseline);
entire(originalOperator.baselineText, git('show', COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS[file]));
entire(companyOperatorSourceBaseline(file, current), originalOperator.baselineText);
assert.throws(() => assertCompanyOperatorSourceTransfer(file, current), /Company Operator source changed/, 'Strict N01 transfer itself remains frozen to the original blob');

const changedSources = [current + '\n// unsupported whole-file suffix\n', '// unsupported prefix\n' + current, current.replace('import ', 'import  '), current.replace('registerGameEmployment(app, { pool, auth });', 'registerGameEmployment(app, { pool });')];
for (const chunk of chunks) {
  assert.equal(current.split(chunk.current).length, 2, 'Complete hunk is unique');
  const context = chunk.current.split('\n').find(line => line.trim() && chunk.baseline.includes(line + '\n')); assert(context);
  changedSources.push(current.replace(chunk.current, ''), current.replace(chunk.current, chunk.current + chunk.current), current.replace(context + '\n', context + ' // context drift\n'));
}
const [a, b] = chunks; changedSources.push(current.replace(a.current, '__EMPLOYMENT_HUNK__').replace(b.current, a.current).replace('__EMPLOYMENT_HUNK__', b.current));
changedSources.push(current.replace("from './routes/gameemployment.js'", "from './routes/otheremployment.js'"), current.replace('registerCompanyOperators(app, { pool, auth });', 'registerCompanyOperators(app, { pool });'));
for (const changed of changedSources) {
  assert.notEqual(changed, current); assert.equal(gameEmploymentSourceBaseline(file, changed), changed); assert.equal(companyOperatorSourceBaseline(file, changed), changed, 'Unknown outer source cannot become historical bytes');
  assert.throws(() => assertGameEmploymentSourceTransfer(file, changed), /source changed/); assert.throws(() => qualifyGameEmploymentSource(file, changed), /source changed/);
  assert.throws(() => assertGameEmploymentSourceTransfer(file, changed.replaceAll('\n', '\r\n')), /source changed/);
  assert.throws(() => Deed.assertDeedServerCompatibility(changed), /source changed/);
  await assert.rejects(() => verifyWorldRecoverySources({ sourceRevision: GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION, readFile: candidate => candidate === file ? changed : fs.readFileSync(candidate) }), /source changed/);
  negatives++;
}
for (const unknown of ['src/worker.js', 'src/gameemployment.js', 'toString']) {
  assert.throws(() => assertGameEmploymentSourceTransfer(unknown, ''), /Unknown Game Employment/); assert.throws(() => qualifyGameEmploymentSource(unknown, ''), /Unknown Game Employment/);
}
assert.equal(gameEmploymentSourceBaseline('src/unknown.js', 'unknown'), 'unknown');
const worker = companyWorkflowSourceBaseline('src/worker.js', fs.readFileSync('src/worker.js', 'utf8'));
entire(worker, git('show', `${GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION}:src/worker.js`)); entire(worker, git('show', `${GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION}:src/worker.js`));
assert.equal(hash(worker), COMPANY_OPERATOR_SOURCE_CURRENT_PINS['src/worker.js']); sha256Comparisons++;
assert.equal(blob(worker), COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS['src/worker.js']); blobComparisons++;
entire(gameEmploymentSourceBaseline('src/worker.js', worker), worker);
for (const name of ['assertGenesisSnapshotServerCompatibility', 'assertGenesisWrapperServerCompatibility', 'assertHttpReceiptServerCompatibility', 'assertDeedServerCompatibility']) {
  const composed = Deed[name](current), previous = Deed[name](baseline);
  assert.deepEqual(composed.gameEmploymentSourceTransfer, proof, 'Complete current-source metadata retained');
  assert.deepEqual(composed.companyOperatorSourceTransfer, previous.companyOperatorSourceTransfer, 'Original N01 metadata unchanged');
  assert.equal(composed.actualSha256, GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[file]);
}
const economy = Deed.assertEconomySourceTransfer(file, current); assert.deepEqual(economy.gameEmploymentSourceTransfer, proof); assert.deepEqual(economy.companyOperatorSourceTransfer, originalOperator);
assert.deepEqual(WORLD_RECOVERY_REVIEW.gameEmploymentSourceReviewTransfer, GAME_EMPLOYMENT_SOURCE_TRANSFER);
assert.deepEqual(WORLD_RECOVERY_REVIEW.companyOperatorSourceReviewTransfer, COMPANY_OPERATOR_SOURCE_TRANSFER);
assert.match(GAME_EMPLOYMENT_SOURCE_TRANSFER.scope, /no worker, world-soak, native, financial, deployment or onchain qualification/);
const actual = await verifyWorldRecoverySources({ sourceRevision: GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION, readFile: candidate => fs.readFileSync(candidate) });
const historical = await verifyWorldRecoverySources({ sourceRevision: GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION, readFile: candidate => candidate === file ? baseline : fs.readFileSync(candidate) });
assert.deepEqual(actual, historical, 'Historical qualification parity unchanged');
for (const sourceFile of ['src/invariants.js', 'src/social/estate.js']) {
  const source = companyWorkflowSourceBaseline(sourceFile, fs.readFileSync(sourceFile, 'utf8')), prior = git('show', GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[sourceFile]);
  entire(source, git('show', GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS[sourceFile])); entire(source, git('show', `${GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION}:${sourceFile}`));
  entire(prior, git('show', `${GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION}:${sourceFile}`));
  assert.equal(hash(source), GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[sourceFile]); assert.equal(hash(prior), GAME_EMPLOYMENT_SOURCE_BASELINE_PINS[sourceFile]); sha256Comparisons += 2;
  assert.equal(blob(source), GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS[sourceFile]); assert.equal(blob(prior), GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[sourceFile]); blobComparisons += 2;
  const sourceChunks = []; let sourceHunk;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION, GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION, '--', sourceFile).split('\n')) {
    if (line.startsWith('@@ ')) { sourceHunk = { current: '', baseline: '' }; sourceChunks.push(sourceHunk); continue; }
    if (!sourceHunk) continue;
    if (line.startsWith(' ')) { sourceHunk.current += line.slice(1) + '\n'; sourceHunk.baseline += line.slice(1) + '\n'; }
    else if (line.startsWith('+')) sourceHunk.current += line.slice(1) + '\n'; else if (line.startsWith('-')) sourceHunk.baseline += line.slice(1) + '\n';
  }
  assert.deepEqual(GAME_EMPLOYMENT_SOURCE_INVERSES[sourceFile], sourceChunks); assert.equal(sourceChunks.length, sourceFile === 'src/invariants.js' ? 3 : 2); totalHunks += sourceChunks.length;
  const sourceProof = assertGameEmploymentSourceTransfer(sourceFile, source);
  entire(sourceProof.baselineText, prior); entire(gameEmploymentSourceBaseline(sourceFile, source), prior); entire(qualifyGameEmploymentSource(sourceFile, source).baselineText, prior);
  entire(qualifyGameEmploymentSource(sourceFile, prior).baselineText, prior); entire(assertGameEmploymentSourceTransfer(sourceFile, source.replaceAll('\n', '\r\n')).baselineText, prior); entire(qualifyGameEmploymentSource(sourceFile, prior.replaceAll('\n', '\r\n')).baselineText, prior);
  assert.equal(sourceProof.sourceRevision, GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION); assert.equal(sourceProof.predecessorRevision, GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION); assert.equal(sourceProof.sourceBlob, GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS[sourceFile]); assert.equal(sourceProof.predecessorBlob, GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[sourceFile]);
  assert.equal(sourceProof.actualSha256, GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[sourceFile]); assert.equal(sourceProof.baselineSha256, GAME_EMPLOYMENT_SOURCE_BASELINE_PINS[sourceFile]); assert.equal(sourceProof.evidence, GAME_EMPLOYMENT_SOURCE_TRANSFER.evidence); assert.equal(sourceProof.phase, GAME_EMPLOYMENT_SOURCE_TRANSFER.phase); assert.equal(sourceProof.scope, GAME_EMPLOYMENT_SOURCE_TRANSFER.scope);
  entire(invoiceSourceBaseline(sourceFile, source), invoiceSourceBaseline(sourceFile, prior), 'Only exact outer normalization precedes the unchanged historical invoice chain');
  const changed = [source + '\n// unsupported file suffix\n', '// unsupported prefix\n' + source];
  for (const chunk of sourceChunks) {
    assert.equal(source.split(chunk.current).length, 2); const context = chunk.current.split('\n').find(line => line.trim() && chunk.baseline.includes(line + '\n')); assert(context);
    changed.push(source.replace(chunk.current, ''), source.replace(chunk.current, chunk.current + chunk.current), source.replace(chunk.current, chunk.current.replace(context + '\n', context + ' // drift\n')));
  }
  const [first, second] = sourceChunks; changed.push(source.replace(first.current, '__EMPLOYMENT_HUNK__').replace(second.current, first.current).replace('__EMPLOYMENT_HUNK__', second.current));
  changed.push(sourceFile === 'src/invariants.js' ? source.replace("'employment:wage:'", "'employment:unreviewed:'") : source.replace('await voidEmploymentAtDeath(client, h, victim, opts.killerCh, estateLootRate)', 'await voidEmploymentAtDeath(client, h, victim, null, 0)'));
  for (const alteration of changed) {
    assert.notEqual(alteration, source); assert.equal(gameEmploymentSourceBaseline(sourceFile, alteration), alteration); assert.equal(invoiceSourceBaseline(sourceFile, alteration), alteration);
    assert.throws(() => assertGameEmploymentSourceTransfer(sourceFile, alteration), /source changed/); assert.throws(() => qualifyGameEmploymentSource(sourceFile, alteration), /source changed/); assert.throws(() => assertGameEmploymentSourceTransfer(sourceFile, alteration.replaceAll('\n', '\r\n')), /source changed/); negatives++;
  }
  if (sourceFile === 'src/invariants.js') for (const guard of ['assertDeedBacklogCompatibility', 'assertFranchiseSourceTransfer']) {
    const composed = Deed[guard](sourceFile, source), previous = Deed[guard](sourceFile, prior); assert.deepEqual(composed.gameEmploymentSourceTransfer, sourceProof);
    for (const [name, value] of Object.entries(previous)) if (name !== 'actualSha256') assert.deepEqual(composed[name], value, 'Original complete historical transfer metadata remains unchanged');
    for (const alteration of changed) assert.throws(() => Deed[guard](sourceFile, alteration), /source changed/);
  }
}
console.log(`rc1-game-employment-source-compatibility: PASS ${totalHunks} exact Git hunks; ${completeTextComparisons} complete text + ${sha256Comparisons} SHA256 + ${blobComparisons} Git blob comparisons; ${negatives} full-file/missing/duplicate/reordered/context/auth/import/reason/estate/N01-drift controls; LF/CRLF; full current metadata; original N01/worker/historical scopes unchanged`);
