import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { hashEvidenceFile, verifyHistoryStream } from '../tools/rc1-native-proof-stream.js';
import { canonicalJson, sha256, verifyArtifactIndex } from '../tools/rc1-native-proof.js';

const seal = events => {
  let previousHash = null;
  return events.map((event, index) => {
    const row = { ...event, sequence: index + 1, previousHash }, hash = sha256(canonicalJson(row));
    previousHash = hash; return canonicalJson({ ...row, hash });
  }).join('\n') + '\n';
};
const goodEvents = [{ kind: 'initialization', detail: 'José 雨 🚦' },
  { kind: 'invocation', invocation: 'one', identity: { request: '\n literal inside JSON' } },
  { kind: 'completion', invocation: 'one', result: { count: 2 } }];
const valid = seal(goodEvents), bytes = Buffer.from(valid);
const chunks = (buffer, size) => Array.from({ length: Math.ceil(buffer.length / size) }, (_, i) => buffer.subarray(i * size, (i + 1) * size));
const verify = input => verifyHistoryStream(input, { canonicalJson, sha256 });
// Reference is the prior complete-history checks, retained only for bounded unit fixtures.
function former(text) {
  const history = text.trim().split('\n').map(JSON.parse), invoked = new Set(), unfinished = new Set(); let previousHash = null;
  for (const [index, { hash, ...event }] of history.entries()) {
    assert.equal(event.sequence, index + 1); assert.equal(event.previousHash, previousHash);
    assert.equal(hash, sha256(canonicalJson(event))); previousHash = hash;
    if (event.kind === 'invocation') { assert(!invoked.has(event.invocation)); invoked.add(event.invocation); unfinished.add(event.invocation); }
    if (event.kind === 'completion') assert(unfinished.delete(event.invocation));
  }
  assert.equal(unfinished.size, 0); return { events: history.length, invocations: invoked.size, finalHash: previousHash };
}
for (const size of [1, 2, 3, 4, 7, 13, 64, 65536]) assert.deepEqual(await verify(chunks(bytes, size)), former(valid));
for (let split = 0; split <= bytes.length; split++)
  assert.deepEqual(await verify([bytes.subarray(0, split), bytes.subarray(split)]), former(valid));
for (const text of [valid, ' \r\n\t\n' + valid + '\n\t', valid.trim(), valid.replaceAll('\n', '\r\n')])
  assert.deepEqual(await verify(chunks(Buffer.from(text), 3)), former(text));
const invalid = [
  '', ' \r\n\t', valid.slice(0, -8), valid.replace('José', 'Jose'),
  valid.replace('\n', '\n\n'), valid.replaceAll('\n', '\r'),
  seal([...goodEvents, { kind: 'completion', invocation: 'one' }]),
  seal([{ kind: 'invocation', invocation: 'lost' }]),
  seal([{ kind: 'completion', invocation: 'unknown' }]),
  seal([{ kind: 'invocation', invocation: 'x' }, { kind: 'invocation', invocation: 'x' }, { kind: 'completion', invocation: 'x' }]),
  seal(goodEvents).replace('"sequence":2', '"sequence":9'),
  valid.trim() + '\n' + valid.split('\n')[0],
  valid.replace('"kind":"initialization"', 'not json'),
];
for (const text of invalid) { assert.throws(() => former(text)); await assert.rejects(verify(chunks(Buffer.from(text), 5))); }
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rc1-proof-stream-'));
try {
  const binary = Buffer.alloc(2 * 1024 * 1024 + 13); for (let i = 0; i < binary.length; i++) binary[i] = i % 251;
  await fs.writeFile(path.join(root, 'binary.dump'), binary); await fs.writeFile(path.join(root, 'history.jsonl'), valid);
  assert.deepEqual(await hashEvidenceFile(path.join(root, 'binary.dump')), { sha256: sha256(binary), bytes: binary.length });
  const configuration = { exact: 'José 🚦' }, record = { configuration, configurationSha256: sha256(canonicalJson(configuration)),
    status: 'PASS_SCOPED', result: { status: 'PASS_SCOPED' }, matrixQualifying: false,
    artifacts: [{ path: 'binary.dump', ...await hashEvidenceFile(path.join(root, 'binary.dump')) },
      { path: 'history.jsonl', ...await hashEvidenceFile(path.join(root, 'history.jsonl')) }] };
  assert.equal(await verifyArtifactIndex(root, record), true);
  const original = structuredClone(record);
  record.artifacts[0].bytes--; await assert.rejects(verifyArtifactIndex(root, record), /size mismatch/);
  record.artifacts[0].bytes++; record.artifacts[0].sha256 = '0'.repeat(64); await assert.rejects(verifyArtifactIndex(root, record), /hash mismatch/);
  record.artifacts = original.artifacts; record.artifacts.push(record.artifacts[0]); await assert.rejects(verifyArtifactIndex(root, record), /Duplicate/);
  record.artifacts.pop();
  // Even honestly re-indexed malformed history must fail semantic verification.
  for (const text of invalid) {
    await fs.writeFile(path.join(root, 'history.jsonl'), text);
    record.artifacts[1] = { path: 'history.jsonl', ...await hashEvidenceFile(path.join(root, 'history.jsonl')) };
    await assert.rejects(verifyArtifactIndex(root, record));
  }
} finally { await fs.rm(root, { recursive: true }); }
console.log('PASS exact streaming artifact/history verification: ordinary equivalence, every byte split, UTF-8/CRLF, malformed/truncated/duplicate/unfinished history, full binary hashes and retained index checks');
