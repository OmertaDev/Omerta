import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { coreProgressionContent } from '../src/content/core-progression.js';
import { CASE_CREW_CATALOG_TRANSFER as transfer, assertCaseCrewCatalogSource,
  caseCrewCatalogSourceBaseline, caseCrewRecoveryCatalog } from '../tools/rc1-case-crew-catalog-compatibility.js';
import { CHECKPOINT_RPG_CATALOG_TRANSFER, CHECKPOINT_RECOVERY_REVIEW, recoveryCatalog,
  cityGameplayRecoveryCatalog, historicalRecoveryCatalog, verifyCheckpointRecoverySources } from '../tools/rc1-checkpoint-recovery-review.js';
import { WORLD_RECOVERY_REVIEW } from '../tools/rc1-world-qualification.js';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).replaceAll('\r\n', '\n');
const hash = value => sha256(canonicalJson(value)), clone = value => structuredClone(value);
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const files = ['src/content/phase1.js', 'src/content/first-errand-case.js', 'src/content/crew-crosscurrent.js'];
assert.deepEqual(Object.keys(transfer.sourcePins), files); assert.deepEqual(Object.keys(transfer.sourceBlobs), files);
assert.deepEqual(transfer.packageIds, ['first-errand-case-v2', 'crew-crosscurrent-v1']);
assert.equal(transfer.predecessorSha256, CHECKPOINT_RPG_CATALOG_TRANSFER.actualSha256);
assert.equal(transfer.manifestPredecessorBlob, CHECKPOINT_RPG_CATALOG_TRANSFER.sourceBlobs[transfer.manifestFile]);
assert.equal(transfer.phase, 'exact source and catalog transfer only');
assert.match(transfer.scope, /ALL new Case\/Crew authority, privacy, reachability, recovery, native, worker, migration, activation and deployment qualification remain outside/);
assert.match(transfer.scope, /New package instances remain UNKNOWN/);
const input = { sourceRevision: WORLD_RECOVERY_REVIEW.reviewedRevision, readFile: file => fs.readFileSync(file) };
const source = await verifyCheckpointRecoverySources(input);
assert.equal(source.caseCrewCatalogTransfer, transfer);
assert.deepEqual(await verifyCheckpointRecoverySources({ ...input,
  readFile: file => String(fs.readFileSync(file)).replace(/\r?\n/g, '\r\n') }), source);
let sourceNegatives = 0;
for (const file of files) {
  const current = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  assert.equal(current, git('show', transfer.sourceRevision + ':' + file));
  assert.equal(current, git('show', transfer.sourceBlobs[file]));
  assert.equal(sha256(current), transfer.sourcePins[file]); assert.equal(blob(current), transfer.sourceBlobs[file]);
  for (const text of [current, current.replaceAll('\n', '\r\n')]) {
    assert.equal(assertCaseCrewCatalogSource(file, text).actualSha256, transfer.sourcePins[file]);
    const expected = file === transfer.manifestFile ? git('show', transfer.predecessorRevision + ':' + file) : current;
    assert.equal(caseCrewCatalogSourceBaseline(file, text), expected);
  }
  const changed = ['// unreviewed prefix\n' + current, current + '\n// unreviewed suffix\n', current.slice(1)];
  if (file === transfer.manifestFile) {
    const prior = git('show', transfer.predecessorRevision + ':' + file);
    assert.equal(sha256(prior), transfer.manifestPredecessorSha256); assert.equal(blob(prior), transfer.manifestPredecessorBlob);
    for (const text of [prior, prior.replaceAll('\n', '\r\n')]) assert.equal(assertCaseCrewCatalogSource(file, text).baselineText, prior);
    const chunks = []; let hunk;
    for (const line of git('diff', '--no-ext-diff', '--unified=3', transfer.predecessorRevision, transfer.sourceRevision, '--', file).split('\n')) {
      if (line.startsWith('@@ ')) { hunk = { current: '', baseline: '' }; chunks.push(hunk); continue; }
      if (!hunk) continue;
      if (line.startsWith(' ')) { hunk.current += line.slice(1) + '\n'; hunk.baseline += line.slice(1) + '\n'; }
      else if (line.startsWith('+')) hunk.current += line.slice(1) + '\n';
      else if (line.startsWith('-')) hunk.baseline += line.slice(1) + '\n';
    }
    assert.equal(chunks.length, 2); assert.deepEqual(chunks, transfer.manifestInverses);
    let reconstructed = current;
    for (const chunk of chunks) {
      assert.equal(reconstructed.split(chunk.current).length, 2);
      reconstructed = reconstructed.replace(chunk.current, () => chunk.baseline);
      changed.push(current.replace(chunk.current, ''), current.replace(chunk.current, () => chunk.current + chunk.current));
    }
    assert.equal(reconstructed, prior, 'The complete original manifest, not only old registrations, is reconstructed.');
  } else {
    const before = file.endsWith('first-errand-case.js') ? 'requires: [receipt, book]' : 'minimumDistinctAccounts: 3';
    assert(current.includes(before)); changed.push(current.replace(before, file.endsWith('first-errand-case.js') ? 'requires: []' : 'minimumDistinctAccounts: 1'));
  }
  for (const text of changed) {
    assert.notEqual(text, current);
    assert.throws(() => assertCaseCrewCatalogSource(file, text), /source changed/);
    assert.equal(caseCrewCatalogSourceBaseline(file, text), text, 'Unknown source must retain rejecting bytes.');
    await assert.rejects(verifyCheckpointRecoverySources({ ...input, readFile: candidate => candidate === file ? text : fs.readFileSync(candidate) }), /source changed/);
    sourceNegatives++;
  }
}
for (const file of ['src/content/unknown.js', 'src/worker.js', '../src/content/phase1.js', '__proto__']) {
  assert.throws(() => assertCaseCrewCatalogSource(file, ''), /Unknown/);
  assert.equal(caseCrewCatalogSourceBaseline(file, 'unknown'), 'unknown'); sourceNegatives++;
}
for (const value of [null, {}, 0]) assert.throws(() => assertCaseCrewCatalogSource(files[0], value), /non-text/);

const flags = { CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on', COORDINATION_KNOWLEDGE: 'on',
  COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', LIVING_WORLD_DIRECTOR: 'LIVE' };
const previous = Object.fromEntries(Object.keys(flags).map(key => [key, process.env[key]]));
Object.assign(process.env, flags); const current = recoveryCatalog(coreProgressionContent());
for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
const untouched = canonicalJson(current), prior = caseCrewRecoveryCatalog(current);
assert.equal(hash(current), transfer.actualSha256); assert.equal(hash(prior), transfer.predecessorSha256);
assert.equal(current.nodes.length - prior.nodes.length, 36);
assert.equal(hash(current.nodes.filter(node => transfer.packageIds.includes(node.packageId))), transfer.addedNodesSha256);
for (const id of transfer.packageIds) assert.equal(current.nodes.filter(node => node.packageId === id).length, transfer.packageNodeCounts[id]);
for (const key of ['graphs', 'operations', 'objects']) assert.equal(prior[key], current[key], 'Complete non-node catalogue sections are unchanged.');
assert.equal(caseCrewRecoveryCatalog(prior), prior);
assert.equal(cityGameplayRecoveryCatalog(current), current, 'The original RPG envelope was not widened.');
assert.equal(hash(cityGameplayRecoveryCatalog(prior)), CHECKPOINT_RPG_CATALOG_TRANSFER.predecessorSha256);
assert.equal(hash(historicalRecoveryCatalog(current)), CHECKPOINT_RECOVERY_REVIEW.catalogSha256);
assert.equal(canonicalJson(current), untouched, 'Source-only reconstruction must not mutate current content.');
const changes = [];
for (const id of transfer.packageIds) changes.push(
  value => { const index = value.nodes.findIndex(node => node.packageId === id); assert(index >= 0); value.nodes.splice(index, 1); },
  value => value.nodes.push(clone(value.nodes.find(node => node.packageId === id))),
  value => { value.nodes.find(node => node.packageId === id).metadata.description = 'Unreviewed case or Crew text'; },
  value => { value.nodes.find(node => node.packageId === id).version++; },
);
changes.push(
  value => { value.nodes[0].version++; },
  value => value.nodes.reverse(),
  value => value.nodes.push({ ...clone(value.nodes[0]), id: 'unreviewed:node', packageId: 'unreviewed-package' }),
  value => { value.graphs[0].version++; },
  value => value.operations.push({ id: 'unreviewed-operation' }),
  value => value.objects.push({ id: 'unreviewed-object' }),
  value => { value.unreviewed = true; },
);
for (const mutate of changes) {
  const changed = clone(current); mutate(changed); assert.notEqual(hash(changed), hash(current));
  assert.equal(caseCrewRecoveryCatalog(changed), changed, 'Unknown complete catalogue cannot receive partial node filtering.');
  assert.equal(historicalRecoveryCatalog(changed), changed, 'Composed historical consumer retains all unknown bytes.');
}
console.log(`PASS Case/Crew catalogue source-only transfer: 3 exact producers/2 unique manifest hunks, 2 packages/36 nodes, ${sourceNegatives} source/consumer negatives and ${changes.length} complete-catalogue negatives; original RPG/City pins unchanged; no authority/native qualification`);
