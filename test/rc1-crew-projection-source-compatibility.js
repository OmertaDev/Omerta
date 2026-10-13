import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CREW_PROJECTION_SOURCE_TRANSFER as transfer, assertCrewProjectionSourceTransfer,
  crewProjectionSourceBaseline } from '../tools/rc1-crew-projection-source-compatibility.js';
import { CITY_GAMEPLAY_SOURCE_CURRENT_PINS, cityGameplaySourceBaseline,
  qualifyCityGameplaySource } from '../tools/rc1-city-gameplay-source-compatibility.js';
import { CITY_SOURCE_CURRENT_PINS, assertCitySourceTransfer } from '../tools/rc1-deed-source-compatibility.js';
import { WORLD_RECOVERY_REVIEW, verifyWorldRecoverySources } from '../tools/rc1-world-qualification.js';
import { verifyCheckpointRecoverySources } from '../tools/rc1-checkpoint-recovery-review.js';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const files = ['src/operations.js', 'src/routes/worldgraph.js'];
assert.deepEqual(Object.keys(transfer.currentPins), files);
for (const map of ['baselinePins', 'currentBlobs', 'baselineBlobs', 'inverses']) assert.deepEqual(Object.keys(transfer[map]), files);
assert.equal(Object.keys(CITY_GAMEPLAY_SOURCE_CURRENT_PINS).length, 17, 'The original gameplay map is not broadened.');
assert.equal(transfer.phase, 'exact source transfer only');
assert.match(transfer.scope, /ALL new Crew content, earned-name privacy, current gameplay authority, reachability, recovery behavior, native, worker, migration, activation and deployment qualification remain outside/);
const priorFiles = Object.fromEntries(files.map(file => [file, git('show', transfer.predecessorRevision + ':' + file)]));
const input = { sourceRevision: WORLD_RECOVERY_REVIEW.reviewedRevision, readFile: file => fs.readFileSync(file) };
const source = await verifyWorldRecoverySources(input), checkpoint = await verifyCheckpointRecoverySources(input);
assert.equal(source.crewProjectionSourceTransfer, transfer);
assert.equal(source.sourceFiles['src/operations.js'], CITY_SOURCE_CURRENT_PINS['src/operations.js'], 'The historical recovery rule pin is unchanged.');
for (const verify of [verifyWorldRecoverySources, verifyCheckpointRecoverySources]) {
  const current = await verify(input);
  assert.deepEqual(await verify({ ...input, readFile: file => priorFiles[file] ?? fs.readFileSync(file) }), current,
    'Both complete known files retain the same historical source evidence, not new behavioral qualification.');
  assert.deepEqual(await verify({ ...input, readFile: file => String(fs.readFileSync(file)).replace(/\r?\n/g, '\r\n') }), current);
}
let hunks = 0, negatives = 0;
for (const file of files) {
  const current = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'), prior = priorFiles[file];
  assert.equal(current, git('show', transfer.sourceRevision + ':' + file), 'Complete frozen current file matches independent Git.');
  assert.equal(current, git('show', transfer.currentBlobs[file])); assert.equal(prior, git('show', transfer.baselineBlobs[file]));
  assert.equal(hash(current), transfer.currentPins[file]); assert.equal(blob(current), transfer.currentBlobs[file]);
  assert.equal(hash(prior), transfer.baselinePins[file]); assert.equal(blob(prior), transfer.baselineBlobs[file]);
  assert.equal(prior, git('show', CITY_SOURCE_CURRENT_PINS[file] === transfer.baselinePins[file]
    ? transfer.predecessorRevision + ':' + file : transfer.baselineBlobs[file]));
  assert.equal(CITY_SOURCE_CURRENT_PINS[file], transfer.baselinePins[file], 'The explicit predecessor retains the old City predicate.');
  for (const text of [current, current.replaceAll('\n', '\r\n'), prior, prior.replaceAll('\n', '\r\n')]) {
    assert.equal(assertCrewProjectionSourceTransfer(file, text).baselineText, prior);
    assert.equal(crewProjectionSourceBaseline(file, text), prior);
    assertCitySourceTransfer(file, crewProjectionSourceBaseline(file, text));
  }
  assert.equal(cityGameplaySourceBaseline(file, current), current, 'Crew projection is not smuggled into the closed17 alias.');
  assert.throws(() => qualifyCityGameplaySource(file, current), /Unknown gameplay source/);
  const chunks = []; let hunk;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', transfer.predecessorRevision, transfer.sourceRevision, '--', file).split('\n')) {
    if (line.startsWith('@@ ')) { hunk = { current: '', baseline: '' }; chunks.push(hunk); continue; }
    if (!hunk) continue;
    if (line.startsWith(' ')) { hunk.current += line.slice(1) + '\n'; hunk.baseline += line.slice(1) + '\n'; }
    else if (line.startsWith('+')) hunk.current += line.slice(1) + '\n';
    else if (line.startsWith('-')) hunk.baseline += line.slice(1) + '\n';
  }
  assert.deepEqual(transfer.inverses[file], chunks, 'Only the actual complete Git diff is reversible.');
  let reconstructed = current;
  const mutations = ['// unknown current prefix\n' + current, current + '\n// unknown current suffix\n'];
  for (const chunk of chunks) {
    assert.equal(reconstructed.split(chunk.current).length, 2, 'Each inverse has one actual source occurrence.');
    reconstructed = reconstructed.replace(chunk.current, () => chunk.baseline);
    mutations.push(current.replace(chunk.current, ''), current.replace(chunk.current, () => chunk.current + chunk.current),
      current.replace(chunk.current, () => '// altered Crew projection context\n' + chunk.current));
  }
  assert.equal(reconstructed, prior, 'All exact inverses reproduce the entire predecessor.'); hunks += chunks.length;
  const guards = file === 'src/operations.js' ? [
    ['await readPlayerIntel(client, context.accountId, assignment.character_id)', 'await readPlayerIntel(client, assignment.account_id, assignment.character_id)'],
    ['const self = assignment.account_id === context.accountId;', 'const self = true;'],
    ['{ lock = true } = {})', '{ lock = false } = {})'],
    ['|| !maySeeNode(node, states, assignment?.role_id || null)', '|| false'],
  ] : [
    ["WHERE role.account_id=$1 AND operation.status='completed'", "WHERE operation.status='completed'"],
    ["node.visibility === 'public'", 'true'],
    ['ORDER BY operation.completed_at DESC,operation.id LIMIT 20', 'ORDER BY operation.completed_at DESC,operation.id LIMIT 2000'],
    ["app.post('/v1/worldgraph/operations/:graphId/:operationNodeId/open', mutationOptions(auth)", "app.post('/v1/worldgraph/operations/:graphId/:operationNodeId/open', mutationOptions(null)"],
  ];
  for (const [before, after] of guards) {
    assert(current.includes(before), 'A negative must alter actual current privacy or mutation authority: ' + before);
    mutations.push(current.replace(before, after));
  }
  const verify = file === 'src/operations.js' ? verifyWorldRecoverySources : verifyCheckpointRecoverySources;
  for (const changed of mutations) {
    assert.notEqual(changed, current); assert.notEqual(changed, prior);
    assert.equal(crewProjectionSourceBaseline(file, changed), changed, 'Unknown source retains its rejecting bytes.');
    assert.equal(crewProjectionSourceBaseline(file, changed.replaceAll('\n', '\r\n')), changed.replaceAll('\n', '\r\n'));
    assert.throws(() => assertCrewProjectionSourceTransfer(file, changed), /source changed/);
    assert.throws(() => assertCrewProjectionSourceTransfer(file, changed.replaceAll('\n', '\r\n')), /source changed/);
    assert.throws(() => assertCitySourceTransfer(file, crewProjectionSourceBaseline(file, changed)), /source changed/);
    await assert.rejects(verify({ ...input, readFile: candidate => candidate === file ? changed : fs.readFileSync(candidate) }), /source changed/,
      'The real recovery consumer rejects corrupted current Crew bytes'); negatives++;
  }
}
for (const file of ['src/content/crew-crosscurrent.js', 'src/city-home-interiors.js', 'src/worker.js', 'src/server.js', 'toString', 'constructor', './src/operations.js']) {
  assert.equal(crewProjectionSourceBaseline(file, 'unknown source'), 'unknown source');
  assert.throws(() => assertCrewProjectionSourceTransfer(file, 'unknown source'), /Unknown Crew projection source/); negatives++;
}
assert.equal(checkpoint.crewProjectionSourceTransfer, transfer);
console.log(`Crew projection source transfer: 2 complete current/f254 files, ${hunks} exact Git hunks, ${negatives} current privacy/guard/hunk/consumer/unknown negatives; original17 and historical recovery pins retained; current authority/native/release evidence excluded`);
