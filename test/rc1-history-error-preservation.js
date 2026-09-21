import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, gzipSync } from 'node:zlib';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { createGzipHistoryWriter, verifyGzipHistory } from '../tools/rc1-native-proof-gzip.js';

const root = process.env.RC1_HISTORY_ERROR_OUTPUT || await fs.mkdtemp(path.join(os.tmpdir(), 'rc1-history-error-'));
await fs.mkdir(root, { recursive: true });
const storage = { encoding: 'gzip', framing: 'event-members-v1', maximumDecodedBytes: 1048576,
  maximumStoredBytes: 1048576, maximumLineBytes: 65536, maximumOutstandingInvocations: 4, maximumPendingRecords: 4 };
const events = [{ kind: 'invocation', invocation: 1, owner: 'José 雨 🚦' },
  { kind: 'resource-commit-boundary', amount: '9007199254740993' }, { kind: 'completion', invocation: 1 }];
let previousHash = null;
const lines = events.map((event, index) => {
  const row = { sequence: index + 1, previousHash, ...event }, hash = sha256(canonicalJson(row)); previousHash = hash;
  return Buffer.from(canonicalJson({ ...row, hash }) + '\n');
});
const bytes = Buffer.concat(lines), file = path.join(root, 'history.jsonl.gz');
const writer = await createGzipHistoryWriter(file, storage);
for (const line of lines) await writer.append(line); await writer.close();
const compressed = await fs.readFile(file);
const artifactOf = (physical, logical) => ({ path: 'history.jsonl.gz', bytes: physical.length, sha256: sha256(physical),
  decoded: { path: 'history.jsonl', encoding: 'gzip', framing: 'event-members-v1', bytes: logical.length, sha256: sha256(logical) } });
const artifact = artifactOf(compressed, bytes), api = { canonicalJson, sha256 }, controls = [];
const rejects = async (label, work, predicate) => {
  let caught;
  await assert.rejects(work, error => { caught = error; return predicate(error); });
  controls.push({ label, name: caught.name, code: caught.code ?? null, message: caught.message });
};
assert.equal((await verifyGzipHistory(file, artifact, storage, api)).events, 3);

// Native fs/zlib scheduling is essential: an already-buffered Readable.from()
// does not reproduce Node22's premature async-iterator AbortError.
const causal = [];
for (const retainPipelineOwnership of [false, true]) {
  const sentinel = Error('causal validator sentinel'), source = createReadStream(file), gunzip = createGunzip();
  const decoded = new Transform({ transform(chunk, _encoding, callback) { callback(null, chunk); } });
  let caught;
  try {
    await pipeline(source, gunzip, decoded, async chunks => {
      assert.equal(chunks, decoded);
      for await (const _chunk of retainPipelineOwnership ? chunks.iterator({ destroyOnReturn: false }) : chunks) throw sentinel;
    });
  } catch (error) { caught = error; }
  assert(source.destroyed && gunzip.destroyed && decoded.destroyed, 'Pipeline must tear down every stream');
  if (retainPipelineOwnership) assert.equal(caught, sentinel);
  causal.push({ retainPipelineOwnership, exactPrimaryError: caught === sentinel, code: caught?.code ?? null, streamsDestroyed: true });
}

const sentinel = Error('first history validation failure'); let validated = false;
await rejects('exact consumer exception identity', () => verifyGzipHistory(file, artifact, storage, {
  ...api, canonicalJson() { validated = true; throw sentinel; },
}), error => error === sentinel);
assert(validated);
await rejects('line-byte bound', () => verifyGzipHistory(file, artifact, { ...storage, maximumLineBytes: 5 }, api),
  error => error.code === 'ERR_ASSERTION' && /line-byte/.test(error.message));
await rejects('native read error', () => verifyGzipHistory(path.join(root, 'absent.gz'), artifact, storage, api), error => error.code === 'ENOENT');
await rejects('physical bound during streaming', () => verifyGzipHistory(file, { ...artifact, bytes: compressed.length - 1 }, storage, api),
  error => error.message === 'History stored-byte bound exceeded');
await rejects('decoded bound during streaming', () => verifyGzipHistory(file, { ...artifact, decoded: { ...artifact.decoded, bytes: bytes.length - 1 } }, storage, api),
  error => error.message === 'History decoded-byte bound exceeded');

const altered = JSON.parse(lines[0]); altered.owner = 'foreign owner';
const wrongHash = Buffer.concat([Buffer.from(canonicalJson(altered) + '\n'), ...lines.slice(1)]);
const wrongSequence = JSON.parse(lines[0]); wrongSequence.sequence = 2;
for (const [label, raw, expected] of [
  ['semantic hash', wrongHash, /History hash mismatch/],
  ['sequence gap', Buffer.from(canonicalJson(wrongSequence) + '\n'), /History sequence gap/],
  ['malformed JSON', Buffer.from('{bad\n'), /JSON|property/i],
  ['unfinished invocation', lines[0], /Unfinished authority invocations/],
  ['truncated line', bytes.subarray(0, -1), /Truncated history line/],
]) {
  const stored = gzipSync(raw), target = path.join(root, label.replaceAll(' ', '-') + '.gz');
  await fs.writeFile(target, stored, { flag: 'wx' });
  await rejects(label, () => verifyGzipHistory(target, artifactOf(stored, raw), storage, api), error => expected.test(error.message));
}
const truncated = compressed.subarray(0, -1), truncatedFile = path.join(root, 'truncated-gzip.gz');
await fs.writeFile(truncatedFile, truncated, { flag: 'wx' });
await rejects('native gzip truncation', () => verifyGzipHistory(truncatedFile, artifactOf(truncated, bytes), storage, api),
  error => error.code === 'Z_BUF_ERROR');
const summary = { status: 'PASS_UNIT', node: process.version, controls, causal,
  logicalSha256: sha256(bytes), storedSha256: sha256(compressed), limits: storage };
await fs.writeFile(path.join(root, 'result.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(summary));
