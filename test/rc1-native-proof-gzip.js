import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { gunzipSync, gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { createGzipHistoryWriter, createGzipProofRecorder, verifyGzipHistory, validateHistoryStorage } from '../tools/rc1-native-proof-gzip.js';
import { canonicalJson, sha256, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { hashEvidenceFile, verifyBoundedHistoryStream } from '../tools/rc1-native-proof-stream.js';

const root = process.env.RC1_GZIP_TEST_OUTPUT || await fs.mkdtemp(path.join(os.tmpdir(), 'rc1-proof-gzip-'));
await fs.mkdir(root, { recursive: true });
const storage = { encoding: 'gzip', framing: 'event-members-v1', maximumDecodedBytes: 1048576,
  maximumStoredBytes: 1048576, maximumLineBytes: 65536, maximumOutstandingInvocations: 4, maximumPendingRecords: 4 };
const api = { canonicalJson, sha256, verifyArtifactIndex, wallTimestamp: () => '2026-09-21T00:00:00.000Z',
  assertSourceUnchanged: async () => {} };
const source = { revision: 'unit-source', testOnly: true };
let caseNumber = 0;
const recorder = async (label, extra = {}, overrides = {}) => {
  const directory = path.join(root, `${++caseNumber}-${label}`);
  return { directory, proof: await createGzipProofRecorder({ directory, source, configuration: { testOnly: true },
    runId: label, seed: 'unit', scenarioId: 'storage-controls', population: 0, historyStorage: { ...storage, ...extra } }, { ...api, ...overrides }) };
};
const seal = events => {
  let previousHash = null;
  return Buffer.from(events.map((event, index) => {
    const row = { sequence: index + 1, previousHash, ...event }, hash = sha256(canonicalJson(row));
    previousHash = hash; return canonicalJson({ ...row, hash });
  }).join('\n') + '\n');
};
const events = [{ kind: 'initialization', detail: 'José 雨 🚦' }, { kind: 'invocation', invocation: 1 }, { kind: 'completion', invocation: 1 }];
const bytes = seal(events);
for (let split = 0; split <= bytes.length; split++) {
  const result = await verifyBoundedHistoryStream([bytes.subarray(0, split), bytes.subarray(split)], { ...api, limits: storage });
  assert.equal(result.events, 3); assert.equal(result.invocations, 1);
}
for (const bad of [seal([{ kind: 'invocation', invocation: 2 }]), seal([{ kind: 'invocation', invocation: 1 }]),
  seal([{ kind: 'completion', invocation: 1 }]), seal([...events, { kind: 'completion', invocation: 1 }]), bytes.subarray(0, -1), Buffer.from('\n')])
  await assert.rejects(verifyBoundedHistoryStream([bad], { ...api, limits: storage }));
await assert.rejects(verifyBoundedHistoryStream([bytes], { ...api, limits: { ...storage, maximumLineBytes: 10 } }), /line-byte/);
await assert.rejects(verifyBoundedHistoryStream([bytes], { ...api, limits: { ...storage, maximumDecodedBytes: 10 } }), /decoded-byte/);
assert.throws(() => validateHistoryStorage({ ...storage, maximumStoredBytes: Infinity }));
assert.throws(() => validateHistoryStorage({ ...storage, extra: true }));

// A stalled physical write cannot acknowledge an event. Each acknowledged prefix
// is a complete independently decodable member, including multi-byte text.
const file = path.join(root, 'writer-prefix.gz');
let release, didWrite, writes = 0, failAfter = Infinity;
const blocked = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { didWrite = resolve; });
const injected = Error('physical write sentinel');
const writer = await createGzipHistoryWriter(file, storage, { open: async (...args) => {
  const handle = await fs.open(...args);
  return { close: () => handle.close(), async write(chunk, offset, length, position) {
    if (++writes === 1) { didWrite(); await blocked; }
    if (writes > failAfter) throw injected;
    return handle.write(chunk, offset, Math.min(length, 11), position);
  } };
} });
let acknowledged = false;
const append = writer.append(bytes).then(() => { acknowledged = true; });
await started; await Promise.resolve(); assert.equal(acknowledged, false); assert.equal((await fs.stat(file)).size, 0);
release(); await append;
const prefix = await fs.readFile(file); assert.deepEqual(gunzipSync(prefix), bytes);
assert.equal(writer.diagnostic().acknowledgedDecodedBytes, bytes.length);
failAfter = writes + 1; await assert.rejects(writer.append(bytes), error => error === injected); await writer.close();
assert.deepEqual(gunzipSync((await fs.readFile(file)).subarray(0, prefix.length)), bytes);
const partial = await fs.readFile(file); assert.throws(() => gunzipSync(partial));
assert.equal(writer.diagnostic().acknowledgedDecodedBytes, bytes.length);

const crashFile = path.join(root, 'interrupted.gz'), crashScript = path.join(root, 'interrupt-control.mjs');
await fs.writeFile(crashScript, `import fs from 'node:fs/promises';
import { createGzipHistoryWriter } from ${JSON.stringify(new URL('../tools/rc1-native-proof-gzip.js', import.meta.url).href)};
let interrupt = false;
const writer = await createGzipHistoryWriter(${JSON.stringify(crashFile)}, ${JSON.stringify(storage)}, { open: async (...args) => {
  const handle = await fs.open(...args); return { close: () => handle.close(), async write(chunk, offset, length, position) {
    if (interrupt) { await handle.write(chunk, offset, Math.min(8, length), position); process.exit(73); }
    return handle.write(chunk, offset, length, position);
  } };
} });
await writer.append(Buffer.from(${JSON.stringify(bytes.toString())}));
console.log(JSON.stringify(writer.diagnostic())); interrupt = true;
await writer.append(Buffer.from(${JSON.stringify(bytes.toString())}));
`, { flag: 'wx' });
const crash = spawnSync(process.execPath, [crashScript], { encoding: 'utf8' });
assert.equal(crash.status, 73, crash.stderr);
const acknowledgedCrash = JSON.parse(crash.stdout), crashedBytes = await fs.readFile(crashFile);
assert.deepEqual(gunzipSync(crashedBytes.subarray(0, acknowledgedCrash.storedBytes)), bytes);
assert.throws(() => gunzipSync(crashedBytes));

const good = await recorder('good');
await good.proof.record({ kind: 'initialization', detail: 'José 雨 🚦' });
const resultValue = { exact: '9007199254740993', rows: [{ owner: 'a', amount: '7' }] };
assert.equal(await good.proof.invoke('native-control', { command: 'one' }, async () => resultValue), resultValue);
await good.proof.artifact('result.json', resultValue);
await assert.rejects(good.proof.artifact('result.json', {}), /Duplicate/);
await assert.rejects(good.proof.artifact('run.json', {}), /reserved/);
await assert.rejects(good.proof.artifact('run-unsealed.json', {}), /reserved/);
const run = await good.proof.finish({ status: 'PASS_SCOPED', checks: 'transport unit only' });
assert.equal(await verifyArtifactIndex(good.directory, run), true);
const compressed = await fs.readFile(path.join(good.directory, 'history.jsonl.gz'));
const decoded = gunzipSync(compressed), history = run.artifacts.find(item => item.path === 'history.jsonl.gz');
assert.deepEqual(decoded, seal([
  { kind: 'initialization', detail: 'José 雨 🚦', observedAt: api.wallTimestamp() },
  { kind: 'invocation', invocation: 1, authority: 'native-control', identity: { command: 'one' }, observedAt: api.wallTimestamp() },
  { kind: 'completion', invocation: 1, outcome: 'RETURNED', result: resultValue, observedAt: api.wallTimestamp() },
]));
assert.equal(history.decoded.sha256, sha256(decoded)); assert.equal(history.decoded.bytes, decoded.length);
assert.equal((await fs.readdir(good.directory)).includes('history.jsonl'), false);
const reindex = async value => ({ ...history, ...await hashEvidenceFile(value) });
for (const [label, raw] of [['truncated', compressed.subarray(0, -1)], ['trailing', Buffer.concat([compressed, Buffer.from('junk')])],
  ['padding', Buffer.concat([compressed, Buffer.alloc(1)])], ['crc', Buffer.from(compressed)]]) {
  if (label === 'crc') raw[raw.length - 5] ^= 1;
  const target = path.join(root, `${label}.gz`); await fs.writeFile(target, raw);
  await assert.rejects(verifyGzipHistory(target, await reindex(target), storage, api));
}
const target = path.join(root, 'reindexed-logical-corruption.gz');
await fs.writeFile(target, gzipSync(decoded.toString().replace('José', 'Jose')));
await assert.rejects(verifyGzipHistory(target, await reindex(target), storage, api));
await assert.rejects(verifyArtifactIndex(good.directory, { ...run, historyStorageSha256: '0'.repeat(64) }), /configuration/);
await assert.rejects(verifyArtifactIndex(good.directory, { ...run, format: 3 }), /Unknown compressed evidence format/);
await assert.rejects(verifyArtifactIndex(good.directory, { ...run, artifacts: [...run.artifacts, history] }), /Duplicate/);
await assert.rejects(verifyArtifactIndex(good.directory, { ...run, historyVerification: { ...run.historyVerification, events: 99 } }), /summary/);
await assert.rejects(verifyGzipHistory(path.join(good.directory, history.path), history, { ...storage, maximumStoredBytes: compressed.length - 1 }, api), /stored-byte/);
await assert.rejects(hashEvidenceFile(path.join(good.directory, history.path), compressed.length - 1), /stored-byte/);

const ordinary = await recorder('authority-error'); const authorityError = Object.assign(Error('authority sentinel'), { code: 'SENTINEL' });
await assert.rejects(ordinary.proof.invoke('native-control', {}, async () => { throw authorityError; }), error => error === authorityError);
assert.equal((await ordinary.proof.finish({ status: 'FAIL', error: authorityError.message })).status, 'FAIL');
const changed = await recorder('source-change', {}, { assertSourceUnchanged: async () => { throw Error('source changed sentinel'); } });
await changed.proof.record({ kind: 'initialization' });
await assert.rejects(changed.proof.finish({ status: 'PASS_SCOPED' }), /source changed sentinel/);
const changedRun = JSON.parse(await fs.readFile(path.join(changed.directory, 'run.json')));
assert.equal(changedRun.status, 'FAIL'); assert.equal(changedRun.result.status, 'FAIL'); await verifyArtifactIndex(changed.directory, changedRun);

for (const [label, limits, exercise, pattern] of [
  ['line', { maximumLineBytes: 250 }, p => p.record({ kind: 'large', value: 'x'.repeat(300) }), /line-byte/],
  ['stored', { maximumStoredBytes: 1 }, p => p.record({ kind: 'initialization' }), /stored-byte/],
  ['decoded', { maximumDecodedBytes: 250, maximumLineBytes: 250 }, async p => { await p.record({ kind: 'initialization' }); await p.record({ kind: 'next' }); }, /decoded-byte/],
  ['outstanding', { maximumOutstandingInvocations: 1 }, async p => { await p.record({ kind: 'invocation', invocation: 1 }); await p.record({ kind: 'invocation', invocation: 2 }); }, /outstanding/],
  ['pending', { maximumPendingRecords: 1 }, async p => { const first = p.record({ kind: 'initialization' }); const second = p.record({ kind: 'next' }); await Promise.all([first, second]); }, /pending-record/],
]) {
  const fixture = await recorder(label, limits); await assert.rejects(exercise(fixture.proof), pattern);
  await fixture.proof.artifact('failure-context.json', { sentinel: label });
  await assert.rejects(fixture.proof.finish({ status: 'PASS_SCOPED' }), pattern);
  await assert.rejects(fs.access(path.join(fixture.directory, 'run.json')));
  const failure = JSON.parse(await fs.readFile(path.join(fixture.directory, 'capture-failure.json')));
  assert.equal(failure.status, 'INCOMPLETE'); assert.equal(failure.matrixQualifying, false);
  await assert.rejects(fixture.proof.invoke('must-not-run', {}, async () => assert.fail('Authority admitted after capture failure')), pattern);
}
const completion = await recorder('completion-capture-failure', { maximumLineBytes: 400 });
const originalError = Error('x'.repeat(1000));
await assert.rejects(completion.proof.invoke('native-control', {}, async () => { throw originalError; }), error => error === originalError);
await assert.rejects(completion.proof.finish({ status: 'FAIL', originalError: originalError.message }), /line-byte/);
const incomplete = JSON.parse(await fs.readFile(path.join(completion.directory, 'capture-failure.json')));
assert.deepEqual(incomplete.outstandingInvocations, [1]); assert.equal(incomplete.authorityFailure.message, originalError.message);
const publication = await recorder('publication-failure');
await publication.proof.record({ kind: 'initialization' });
await fs.mkdir(path.join(publication.directory, 'run.json'));
await assert.rejects(publication.proof.finish({ status: 'PASS_SCOPED' }), /exist/i);
assert.equal((await fs.stat(path.join(publication.directory, 'run.json'))).isDirectory(), true);
assert.equal(JSON.parse(await fs.readFile(path.join(publication.directory, 'capture-failure.json'))).status, 'INCOMPLETE');
assert.equal(JSON.parse(await fs.readFile(path.join(publication.directory, 'run-unsealed.json'))).status, 'PASS_SCOPED');
console.log(JSON.stringify({ status: 'PASS_UNIT', directory: root, controls: 'legacy separate; gzip prefixes/write stall, UTF8, physical/logical corruption, finite bounds, failure identity, source-change FAIL and reserved paths' }));
