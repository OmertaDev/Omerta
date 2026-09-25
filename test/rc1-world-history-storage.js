import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { createGzipHistoryWriter } from '../tools/rc1-native-proof-gzip.js';
import { hashEvidenceFile } from '../tools/rc1-native-proof-stream.js';
import { readVerifiedHistoryLines, boundedHistoryLines } from '../tools/rc1-native-history-reader.js';
import { parseWorldHistoryStorage, assertWorldHistoryStorage, retainWorldFailure } from '../tools/rc1-world-history-storage.js';

const flags = ['--history-encoding=gzip', '--history-max-decoded-bytes=1048576', '--history-max-stored-bytes=1048576',
  '--history-max-line-bytes=65536', '--history-max-outstanding-invocations=4', '--history-max-pending-records=4'];
assert.equal(parseWorldHistoryStorage([]), undefined); const storage = parseWorldHistoryStorage(flags);
for (const args of [flags.slice(1), [...flags, flags[0]], ['--history-encoding=identity'], [...flags, '--history-unknown=1'],
  flags.map(s => s.replace('=65536', '=Infinity')), flags.map(s => s.replace('=65536', '=0')),
  flags.map(s => s.replace('=65536', '=1e5')), flags.map(s => s.replace('=65536', '=9007199254740992'))])
  assert.throws(() => parseWorldHistoryStorage(args));
assertWorldHistoryStorage({ format: 1, configuration: {} }, undefined);
assertWorldHistoryStorage({ format: 2, configuration: { historyStorage: storage }, historyStorage: storage }, storage);
assert.throws(() => assertWorldHistoryStorage({ format: 2, configuration: { historyStorage: storage }, historyStorage: storage }, undefined), /differ/);
assert.throws(() => assertWorldHistoryStorage({ format: 2, configuration: { historyStorage: storage }, historyStorage: storage },
  { ...storage, maximumPendingRecords: 3 }), /differ/);

const root = process.env.RC1_WORLD_STORAGE_TEST_OUTPUT || await fs.mkdtemp(path.join(os.tmpdir(), 'rc1-world-history-'));
await fs.mkdir(root, { recursive: true });
const events = [{ kind: 'invocation', invocation: 1, identity: { owner: 'José 雨 🚦' } },
  ...[1, 2, 3].map(n => ({ kind: 'resource-commit-boundary', event: { transaction: n }, journal: { owner: 'José 雨 🚦', amount: '9007199254740993', n } })),
  { kind: 'completion', invocation: 1 }];
let previousHash = null;
const lines = events.map((event, index) => {
  const row = { sequence: index + 1, previousHash, ...event }, hash = sha256(canonicalJson(row)); previousHash = hash;
  return Buffer.from(canonicalJson({ ...row, hash }) + '\n');
});
const raw = Buffer.concat(lines), rawDirectory = path.join(root, 'identity'), gzipDirectory = path.join(root, 'gzip');
await fs.mkdir(rawDirectory); await fs.mkdir(gzipDirectory);
await fs.writeFile(path.join(rawDirectory, 'history.jsonl'), raw, { flag: 'wx' });
const writer = await createGzipHistoryWriter(path.join(gzipDirectory, 'history.jsonl.gz'), storage);
for (const line of lines) await writer.append(line); await writer.close();
const make = configuration => ({ configuration, configurationSha256: sha256(canonicalJson(configuration)), status: 'PASS_SCOPED',
  result: { status: 'PASS_SCOPED' }, matrixQualifying: false });
const identity = { ...make({}), format: 1, artifacts: [{ path: 'history.jsonl', ...await hashEvidenceFile(path.join(rawDirectory, 'history.jsonl')) }] };
const gzip = { ...make({ historyStorage: storage }), format: 2, historyStorage: storage, historyStorageSha256: sha256(canonicalJson(storage)),
  historyVerification: { semantics: 'sequential-invocations-v1', events: 5, invocations: 1, finalHash: previousHash },
  artifacts: [{ path: 'history.jsonl.gz', ...await hashEvidenceFile(path.join(gzipDirectory, 'history.jsonl.gz')),
    decoded: { path: 'history.jsonl', encoding: 'gzip', framing: 'event-members-v1', bytes: raw.length, sha256: sha256(raw) } }] };
const results = [];
for (const [directory, run] of [[rawDirectory, identity], [gzipDirectory, gzip]]) {
  const hash = crypto.createHash('sha256'); let count = 0, prefix; const observed = [];
  for await (const line of readVerifiedHistoryLines(directory, run)) {
    observed.push(line); const event = JSON.parse(line); if (event.kind !== 'resource-commit-boundary') continue;
    hash.update(canonicalJson({ event: event.event, journal: event.journal }) + '\n'); if (++count === 2) prefix = hash.copy().digest('hex');
  }
  assert.equal(observed.join('\n') + '\n', raw.toString()); results.push({ count, prefix, full: hash.digest('hex') });
  await assert.rejects(async () => { for await (const _line of readVerifiedHistoryLines(directory, run, { maximumLineBytes: 5 })) {} }, /line-byte/);
  await assert.rejects(async () => { for await (const _line of readVerifiedHistoryLines(directory, run)) break; }, /consumption was incomplete/);
}
assert.deepEqual(results[0], results[1]);
for (let split = 0; split <= raw.length; split++) {
  const values = [];
  for await (const line of boundedHistoryLines([raw.subarray(0, split), raw.subarray(split)], { maximumDecodedBytes: raw.length,
    maximumLineBytes: 65536, requireTerminalNewline: true })) values.push(line);
  assert.equal(values.join('\n') + '\n', raw.toString());
}
await assert.rejects(async () => { for await (const _line of boundedHistoryLines([raw.subarray(0, -1)], {
  maximumDecodedBytes: raw.length, maximumLineBytes: 65536, requireTerminalNewline: true })) {} }, /truncated/);
const compressed = await fs.readFile(path.join(gzipDirectory, 'history.jsonl.gz'));
await fs.writeFile(path.join(gzipDirectory, 'history.jsonl.gz'), compressed.subarray(0, -1));
await assert.rejects(async () => { for await (const _line of readVerifiedHistoryLines(gzipDirectory, gzip)) {} });
const firstError = Error('recording poisoned'); const result = { status: 'FAIL', error: firstError.message }; const cleanup = [];
for (const label of ['pool', 'database', 'runtime']) await retainWorldFailure(async () => { cleanup.push(label); throw firstError; }, { historyStorage: storage, result });
assert.deepEqual(cleanup, ['pool', 'database', 'runtime']); assert.equal(result.captureErrors.length, 3);
await assert.rejects(retainWorldFailure(async () => { throw firstError; }, { historyStorage: undefined, result }), error => error === firstError);
console.log(JSON.stringify({ status: 'PASS_UNIT', root, controls: 'explicit CLI/identity equality, exact resource prefix/full digest in both encodings, UTF8/line bounds/truncation, poisoned-capture cleanup and default error contract' }));
