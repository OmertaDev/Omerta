// Independent, complete-byte verification of a common-prefix observation and two fresh continuations.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { sourceIdentity, verifyArtifactIndex, canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { assertAllianceContinuation, compareAllianceStates } from '../tools/rc1-alliance-continuation.js';
import { compareActorReplay, actorValueHash } from '../tools/rc1-native-actor-replay.js';

const arg = name => process.argv.find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3);
const directories = [arg('reference'), arg('continued'), arg('replay')], output = arg('output');
assert(directories.every(Boolean) && output, 'Provide reference/continued/replay/output');
const source = await sourceIdentity(), read = async (dir, file) => JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
const runs = [], identities = [];
for (const directory of directories) {
  const bytes = await fs.readFile(path.join(directory, 'run.json')), run = JSON.parse(bytes);
  const verified = await verifyArtifactIndex(directory, run); assert.equal(run.status, 'PASS_SCOPED'); assert.deepEqual(run.source, source);
  runs.push(run); identities.push({ directory: path.resolve(directory), runSha256: sha256(bytes), verified });
}
const [reference, continued, replay] = runs, metadata = await read(directories[0], 'alliance-hour24-continuation.json');
const digest = crypto.createHash('sha256'); let resourceCount = 0, prefixSha256 = null;
for await (const line of readline.createInterface({ input: createReadStream(path.join(directories[0], 'history.jsonl')), crlfDelay: Infinity })) {
  if (!line) continue; const event = JSON.parse(line);
  if (event.kind !== 'resource-commit-boundary') continue;
  digest.update(canonicalJson({ event: event.event, journal: event.journal }) + '\n'); resourceCount++;
  if (resourceCount === metadata.resourceJournalPrefixCount) prefixSha256 = digest.copy().digest('hex');
}
assert.equal(prefixSha256, metadata.resourceJournalPrefixSha256); assert.equal(resourceCount, reference.result.resourceJournalCount);
assert.equal(digest.digest('hex'), reference.result.resourceJournalSha256);
const policy = await read(directories[0], 'alliance-hour24-policy.json');
assert.equal(sha256(canonicalJson(policy)), metadata.policyStateSha256);
assert.equal(sha256(canonicalJson((await read(directories[0], 'alliance-hour24-random-tape.json')).draws)), metadata.deterministicRandomTapeSha256);
const input = { source, parentRun: reference, parentPolicy: policy, parentCheckpoint: await read(directories[0], 'alliance-hour24-checkpoint.json'),
  parentContinuation: metadata, seed: reference.configuration.seed, population: 25, hours: 24, observeResources: true,
  guardLimits: Object.fromEntries(['maximumWallMs', 'maximumOutputBytes', 'minimumFreeBytes'].map(k => [k, reference.configuration.guardrails[k]])) };
assertAllianceContinuation(input);
const controls = [];
for (const [name, mutate] of [
  ['wrong-source', v => { v.source.revision = '0'.repeat(40); }],
  ['wrong-observation-config', v => { v.observeResources = false; }],
  ['unfinished-response', v => { v.parentPolicy.nativeBoundary.pendingResponses = 1; }],
  ['unfinished-dispatch', v => { const checkpoint = v.parentPolicy.allianceAdapter;
    checkpoint.payload.state.pending.dispatchState = 'DISPATCHING'; checkpoint.sha256 = actorValueHash(checkpoint.payload); }],
]) {
  const corrupted = structuredClone(input); mutate(corrupted); let message;
  try { assertAllianceContinuation(corrupted); } catch (error) { message = error.message; }
  assert(message, 'Native checkpoint corruption was accepted: ' + name); controls.push({ name, rejected: true, message });
}
for (let i = 1; i < 3; i++) {
  const run = runs[i]; assert.equal(run.configuration.parentCheckpoint.runSha256, identities[0].runSha256);
  assert.equal(run.result.continuation.restoredStateSha256, metadata.finalStateSha256);
  assert.equal(run.result.continuation.applicationBootstrap.beforeStateSha256, metadata.finalStateSha256);
  assert.equal(run.result.initialStateSha256, run.result.continuation.applicationBootstrap.afterStateSha256);
  assert.equal(run.result.continuation.totalLogicalHours, 48);
  assert.deepEqual(run.result.alliance.completedStages, [0, 1]); assert.equal(run.result.alliance.completions.length, 3);
  assert.equal(run.result.alliance.fresh, reference.result.alliance.fresh);
  assert.deepEqual(run.result.timerCounts, { directorTick: 288, guardedTick: 24, guardedSeasonTick: 24, 'health-boundary': 288 });
  const startup = await read(directories[i], 'alliance-startup-lineage.json');
  assert.deepEqual(startup.callbackEvents.filter(e => e.kind === 'callback.complete').map(e => e.label), ['boot:director', 'boot:season', 'boot:hourly']);
  assert(startup.resourceBoundaries > 0);
  const parentKeys = new Set(policy.allianceAdapter.payload.state.receipts.map(r => r.request.idempotencyKey));
  const tape = await read(directories[i], 'actor-tape.json');
  const writes = tape.entries.filter(e => e.kind === 'native-outcome' && e.identity.authority === 'ordinary-http' && e.identity.method === 'POST');
  assert(writes.length > 0); assert.deepEqual(writes[0].identity.idempotencyKey, policy.allianceAdapter.payload.state.pending.decision.request.idempotencyKey);
  assert(writes.every(e => !parentKeys.has(e.identity.idempotencyKey)), 'Completed parent player action repeated');
}
const replayComparison = compareActorReplay(replay.result, continued.result);
const uninterruptedComparison = compareAllianceStates(await read(directories[0], 'final.json'), await read(directories[1], 'final.json'));
assert.deepEqual(uninterruptedComparison, continued.result.continuation.uninterruptedComparison);
const result = { status: 'PASS_SCOPED', source, inputs: identities, controls, replayComparison,
  sharedPrefix: metadata, uninterruptedEqual: uninterruptedComparison.equal,
  changedTables: uninterruptedComparison.changed.map(t => ({ table: t.table, added: t.added.length, removed: t.removed.length })),
  sequenceDifferences: uninterruptedComparison.sequences, canonicalExclusions: [],
  scope: 'Native dump/common prefix, real repeated startup callbacks, exact selected request, complete continuation replay and explicit uninterrupted differences; no 90-day/full-resource/matrix qualification' };
await fs.writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ status: result.status, controls: controls.length, replayFields: replayComparison.fields.length,
  uninterruptedEqual: result.uninterruptedEqual, changedTables: result.changedTables, output }));
