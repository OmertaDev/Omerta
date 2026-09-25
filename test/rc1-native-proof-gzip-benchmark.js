// Retained-byte transport measurement only. Never rewrites original evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { sourceIdentity, assertSourceUnchanged, canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { createGzipHistoryWriter, verifyGzipHistory } from '../tools/rc1-native-proof-gzip.js';
import { hashEvidenceFile, verifyHistoryStream } from '../tools/rc1-native-proof-stream.js';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const input = argument('input'), output = argument('output'); assert(input && output);
const source = await sourceIdentity(), before = await fs.stat(input);
const storage = { encoding: 'gzip', framing: 'event-members-v1', maximumDecodedBytes: 2147483648,
  maximumStoredBytes: 536870912, maximumLineBytes: 1048576, maximumOutstandingInvocations: 64, maximumPendingRecords: 1 };
const maximumWallMs = 300000, start = performance.now();
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'measurement-reserved.json'), canonicalJson({ source, input, storage, maximumWallMs,
  semantics: 'Storage measurement of complete immutable input bytes; no gameplay rerun or qualification.' }), { flag: 'wx', mode: 0o600 });
const file = path.join(output, 'history.jsonl.gz'), writer = await createGzipHistoryWriter(file, storage);
let result, rssPeak = process.memoryUsage().rss, heapPeak = process.memoryUsage().heapUsed;
const sampler = setInterval(() => { const memory = process.memoryUsage(); rssPeak = Math.max(rssPeak, memory.rss); heapPeak = Math.max(heapPeak, memory.heapUsed); }, 25);
const guard = () => assert(performance.now() - start < maximumWallMs, 'Measurement wall-clock guard exceeded');
try {
  let tail = Buffer.alloc(0), lines = 0, maximumLineBytes = 0;
  const compressionStart = performance.now(), cpu = process.cpuUsage();
  for await (const chunk of createReadStream(input, { highWaterMark: 65536 })) {
    guard(); const joined = tail.length ? Buffer.concat([tail, chunk]) : chunk; let offset = 0, end;
    while ((end = joined.indexOf(10, offset)) >= 0) {
      const line = joined.subarray(offset, end + 1); maximumLineBytes = Math.max(maximumLineBytes, line.length);
      await writer.append(line); lines++; offset = end + 1; guard();
    }
    tail = Buffer.from(joined.subarray(offset)); assert(tail.length <= storage.maximumLineBytes, 'Input line bound exceeded');
  }
  assert.equal(tail.length, 0, 'Input lacks terminal newline'); await writer.close();
  const compressionMs = performance.now() - compressionStart, compressionCpu = process.cpuUsage(cpu), physical = await hashEvidenceFile(file, storage.maximumStoredBytes);
  const logical = writer.diagnostic(), artifact = { path: 'history.jsonl.gz', ...physical,
    decoded: { path: 'history.jsonl', encoding: 'gzip', framing: 'event-members-v1', bytes: logical.acknowledgedDecodedBytes, sha256: logical.acknowledgedDecodedSha256 } };
  guard(); const verificationStart = performance.now();
  const verified = await verifyGzipHistory(file, artifact, storage, { canonicalJson, sha256 });
  const verificationMs = performance.now() - verificationStart; guard();
  const original = await hashEvidenceFile(input, storage.maximumDecodedBytes);
  assert.deepEqual({ bytes: artifact.decoded.bytes, sha256: artifact.decoded.sha256 }, original);
  const originalVerified = await verifyHistoryStream(createReadStream(input), { canonicalJson, sha256 });
  assert.deepEqual({ events: verified.events, invocations: verified.invocations, finalHash: verified.finalHash }, originalVerified);
  const after = await fs.stat(input); assert.equal(after.size, before.size); assert.equal(after.mtimeMs, before.mtimeMs); assert.equal(after.ino, before.ino);
  await assertSourceUnchanged(source); guard();
  result = { status: 'PASS_STORAGE_MEASUREMENT', source, input, inputUnchanged: true, original, storage, maximumWallMs, artifact, lines,
    maximumObservedLineBytes: maximumLineBytes, verified, compressionMs, compressionCpu, verificationMs, elapsedMs: performance.now() - start,
    sampledRssPeakBytes: rssPeak, sampledHeapPeakBytes: heapPeak, processMaximumRssKiB: process.resourceUsage().maxRSS,
    node: process.version, execArgv: process.execArgv, sampledMemoryPeriodMs: 25, ratio: original.bytes / physical.bytes,
    limitations: ['128 MiB old-space flag is not a total process memory quota.', 'Per-event complete gzip members; no fsync or power-loss claim.',
      'Stored input source/qualification does not change; this is not native world performance or matrix evidence.'] };
} catch (error) {
  result = { status: 'FAIL_STORAGE_MEASUREMENT', source, input, storage, error: { message: error.message, stack: error.stack }, partial: writer.diagnostic() };
} finally { clearInterval(sampler); await writer.close(); }
await fs.writeFile(path.join(output, 'measurement-result.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify(result)); assert.equal(result.status, 'PASS_STORAGE_MEASUREMENT', result.error?.message);
