import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { coreProgressionContent } from '../src/content/core-progression.js';
import { CRITIQUE_ECONOMY_SOURCE_TRANSFER as transfer, assertCritiqueEconomySourceTransfer,
  critiqueEconomySourceBaseline, critiqueEconomyRecoveryCatalog } from '../tools/rc1-critique-economy-source-compatibility.js';
import { FIRST_BATCH_SOURCE_DOMAINS, FIRST_BATCH_SOURCE_PREDECESSOR, firstBatchSourceBaseline,
  assertFirstBatchSourceTransfer } from '../tools/rc1-first-batch-source-compatibility.js';
import { CASE_CREW_CATALOG_TRANSFER, caseCrewRecoveryCatalog } from '../tools/rc1-case-crew-catalog-compatibility.js';
import { CHECKPOINT_RECOVERY_REVIEW, recoveryCatalog, historicalRecoveryCatalog,
  preProductionRecoveryCatalog, verifyCheckpointRecoverySources } from '../tools/rc1-checkpoint-recovery-review.js';
import { WORLD_RECOVERY_REVIEW } from '../tools/rc1-world-qualification.js';

const normalize = text => text.replaceAll('\r\n', '\n');
const git = (...args) => normalize(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const hash = value => sha256(canonicalJson(value)), clone = value => structuredClone(value);
const files = ['schema.sql', 'src/agentgateway.js', 'src/content/phase1.js', 'src/content/phase1-policy.js', 'package.json'];
assert.deepEqual(Object.keys(transfer.domains), files);
assert.equal(transfer.peerRevision, '9adc01bea4963b89f12419126bd91bb5e7d57a55');
assert.equal(transfer.caseCrewRevision, 'b9a7b37dddd00c0abc184c61d352633a1a05cb40');
assert.match(transfer.scope, /ALL new Company, Case, Crew, Home and Encounter authority, privacy, current native, migration, worker, activation and deployment qualification remain outside/);
assert.match(transfer.scope, /new package instances remain UNKNOWN/);
assert.equal(transfer.catalog.peerSha256, CHECKPOINT_RECOVERY_REVIEW.productionCatalogTransfer.actualSha256);
assert.equal(transfer.catalog.caseCrewSha256, CASE_CREW_CATALOG_TRANSFER.actualSha256);
assert.equal(transfer.catalog.caseCrewNodesSha256, CASE_CREW_CATALOG_TRANSFER.addedNodesSha256);
assert.equal(transfer.catalog.companyNodesSha256, CHECKPOINT_RECOVERY_REVIEW.productionCatalogTransfer.addedNodesSha256);
const input = { sourceRevision: WORLD_RECOVERY_REVIEW.reviewedRevision, readFile: file => fs.readFileSync(file) };
const source = await verifyCheckpointRecoverySources(input);
let sourceNegatives = 0, hunks = 0;
for (const file of files) {
  const current = normalize(fs.readFileSync(file, 'utf8'));
  for (const view of file === 'src/content/phase1.js' ? ['peer', 'caseCrew'] : ['peer']) {
    const d = view === 'peer' ? transfer.domains[file] : transfer.caseManifest;
    const revision = view === 'peer' ? transfer.peerRevision : transfer.caseCrewRevision;
    const prior = git('show', revision + ':' + file);
    assert.equal(sha256(current), d.currentSha256); assert.equal(blob(current), d.currentBlob);
    assert.equal(sha256(prior), d.predecessorSha256); assert.equal(blob(prior), d.predecessorBlob);
    for (const text of [current, current.replaceAll('\n', '\r\n'), prior, prior.replaceAll('\n', '\r\n')])
      assert.equal(assertCritiqueEconomySourceTransfer(file, text, view).baselineText, prior);
    assert.equal(critiqueEconomySourceBaseline(file, current, view), prior);
    assert.equal(critiqueEconomySourceBaseline(file, prior, view), prior);
    const actualChunks = []; let chunk;
    for (const line of git('diff', '--no-ext-diff', '--unified=3', revision, '--', file).split('\n')) {
      if (line.startsWith('@@ ')) { chunk = { current: '', baseline: '' }; actualChunks.push(chunk); continue; }
      if (!chunk || line.startsWith('\\')) continue;
      if (line.startsWith(' ')) { chunk.current += line.slice(1) + '\n'; chunk.baseline += line.slice(1) + '\n'; }
      else if (line.startsWith('+')) chunk.current += line.slice(1) + '\n';
      else if (line.startsWith('-')) chunk.baseline += line.slice(1) + '\n';
    }
    assert.deepEqual(actualChunks, d.inverses, 'Every inverse is the actual complete source diff: ' + file + '/' + view);
    const mutations = [current + '\n// unknown combined source\n', current.slice(1), prior + '\n// unknown predecessor\n'];
    let reconstructed = current;
    for (const part of actualChunks) {
      hunks++; assert.equal(reconstructed.split(part.current).length, 2);
      reconstructed = reconstructed.replace(part.current, () => part.baseline);
      mutations.push(current.replace(part.current, ''), current.replace(part.current, () => part.current + part.current),
        current.replace(part.current, () => part.current + '// changed actual protected hunk\n'));
    }
    assert.equal(reconstructed, prior, 'Complete predecessor bytes, including unrelated guards, are retained.');
    for (const changed of mutations) {
      assert.notEqual(changed, current);
      assert.throws(() => assertCritiqueEconomySourceTransfer(file, changed, view), /source changed/);
      assert.equal(critiqueEconomySourceBaseline(file, changed, view), changed, 'Unknown bytes remain rejecting.');
      assert.throws(() => assertFirstBatchSourceTransfer(file, changed), /source drift/);
      if (file === 'src/content/phase1.js') await assert.rejects(verifyCheckpointRecoverySources({ ...input,
        readFile: candidate => candidate === file ? changed : fs.readFileSync(candidate) }), /source changed|source drift/);
      sourceNegatives++;
    }
  }
  assert.equal(assertFirstBatchSourceTransfer(file, current).baselineText,
    git('show', FIRST_BATCH_SOURCE_PREDECESSOR + ':' + file), 'Outer composition preserves the complete FirstBatch predecessor.');
  assert.equal(firstBatchSourceBaseline(file, current), git('show', FIRST_BATCH_SOURCE_PREDECESSOR + ':' + file));
  assert.equal(transfer.domains[file].predecessorSha256, FIRST_BATCH_SOURCE_DOMAINS[file].currentSha256);
}
for (const [file, before, after] of [
  ['schema.sql', "'docks-mastery-v1'", "'unreviewed-master-v1'"],
  ['src/agentgateway.js', "completedOperations", "unreviewedOperations"],
  ['src/content/phase1.js', '  COMPANY_PRODUCTION_QUALITY_PACKAGE,', ''],
  ['src/content/phase1-policy.js', "'first-errand-case-v2'", "'unreviewed-case-v2'"],
  ['package.json', 'node test/rc1-critique-economy-source-compatibility.js && ', ''],
]) {
  const current = normalize(fs.readFileSync(file, 'utf8')); assert(current.includes(before), 'Real protected bytes: ' + before);
  const changed = current.replace(before, after); assert.notEqual(changed, current);
  assert.equal(critiqueEconomySourceBaseline(file, changed), changed);
  assert.throws(() => assertFirstBatchSourceTransfer(file, changed), /source drift/);
  if (file === 'src/content/phase1.js') await assert.rejects(verifyCheckpointRecoverySources({ ...input,
    readFile: candidate => candidate === file ? changed : fs.readFileSync(candidate) }), /source changed|source drift/);
  sourceNegatives++;
}
for (const file of ['src/unknown.js', '../schema.sql', '__proto__']) {
  assert.throws(() => assertCritiqueEconomySourceTransfer(file, ''), /Unknown/);
  assert.equal(critiqueEconomySourceBaseline(file, 'unknown'), 'unknown'); sourceNegatives++;
}
for (const value of [null, {}, 0]) assert.throws(() => assertCritiqueEconomySourceTransfer(files[0], value), /non-text/);
assert.throws(() => assertCritiqueEconomySourceTransfer(files[0], '', 'unknown'), /Unknown/);
assert.throws(() => assertCritiqueEconomySourceTransfer(files[0], '', 'caseCrew'), /Unknown/);
assert.deepEqual(await verifyCheckpointRecoverySources({ ...input,
  readFile: file => normalize(fs.readFileSync(file, 'utf8')).replaceAll('\n', '\r\n') }), source);

const flags = { CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on', COORDINATION_KNOWLEDGE: 'on',
  COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', LIVING_WORLD_DIRECTOR: 'LIVE' };
const previous = Object.fromEntries(Object.keys(flags).map(key => [key, process.env[key]]));
Object.assign(process.env, flags); const current = recoveryCatalog(coreProgressionContent());
for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
const untouched = canonicalJson(current), peer = critiqueEconomyRecoveryCatalog(current), cases = critiqueEconomyRecoveryCatalog(current, 'caseCrew');
assert.equal(hash(current), transfer.catalog.currentSha256); assert.equal(hash(peer), transfer.catalog.peerSha256);
assert.equal(hash(cases), transfer.catalog.caseCrewSha256);
assert.equal(current.nodes.length - peer.nodes.length, 36); assert.equal(current.nodes.length - cases.nodes.length, 1);
assert.deepEqual(preProductionRecoveryCatalog(peer), caseCrewRecoveryCatalog(cases), 'Both exact branches reconstruct the same complete original20 catalogue.');
assert.equal(hash(historicalRecoveryCatalog(current)), CHECKPOINT_RECOVERY_REVIEW.catalogSha256);
assert.equal(historicalRecoveryCatalog(peer).nodes.length, historicalRecoveryCatalog(cases).nodes.length);
assert.equal(canonicalJson(current), untouched, 'Neither source-only view mutates the live catalogue.');
assert.equal(critiqueEconomyRecoveryCatalog(peer), peer); assert.equal(critiqueEconomyRecoveryCatalog(cases), cases);
let catalogNegatives = 0;
for (const mutate of [
  c => { c.nodes.pop(); }, c => { c.nodes.push(clone(c.nodes[0])); }, c => { c.nodes.reverse(); },
  c => { c.nodes.find(n => n.packageId === 'first-errand-case-v2').version = 999; },
  c => { c.nodes.find(n => n.packageId === 'crew-crosscurrent-v1').id += '-unknown'; },
  c => { c.nodes.find(n => n.packageId === 'company-production-quality').id += '-unknown'; },
  c => { c.nodes.find(n => n.packageId === 'core-materials').id += '-unknown'; },
  c => { c.operations.push({ id: 'unreviewed-operation' }); }, c => { c.graphs.push({ id: 'unreviewed-graph' }); },
  c => { c.objects.push({ id: 'unreviewed-object' }); },
]) {
  const changed = clone(current); mutate(changed); assert.notEqual(hash(changed), hash(current));
  assert.equal(critiqueEconomyRecoveryCatalog(changed), changed); assert.equal(critiqueEconomyRecoveryCatalog(changed, 'caseCrew'), changed);
  assert.equal(historicalRecoveryCatalog(changed), changed, 'Unknown full catalogue retains historical UNKNOWN boundary.'); catalogNegatives++;
}
console.log(`Critique/economy composition PASS: five complete source domains/two exact manifest views, ${hunks} actual inverse hunks, ${sourceNegatives} source/consumer negatives, two complete catalogue views and ${catalogNegatives} catalogue negatives; no new authority/native/release qualification.`);
