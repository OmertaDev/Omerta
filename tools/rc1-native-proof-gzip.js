// Optional evidence transport. No gameplay, clock, resource or replay normalization.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Readable, Writable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';
import { createGzip, createGunzip } from 'node:zlib';
import { hashEvidenceFile, verifyBoundedHistoryStream } from './rc1-native-proof-stream.js';

const limitNames = ['maximumDecodedBytes', 'maximumStoredBytes', 'maximumLineBytes', 'maximumOutstandingInvocations', 'maximumPendingRecords'];
export function validateHistoryStorage(value) {
  assert.deepEqual(Object.keys(value).sort(), ['encoding', 'framing', ...limitNames].sort(), 'Unknown/missing history storage option');
  assert.equal(value.encoding, 'gzip'); assert.equal(value.framing, 'event-members-v1');
  for (const name of limitNames) assert(Number.isSafeInteger(value[name]) && value[name] > 0, `Invalid ${name}`);
  assert(value.maximumLineBytes <= value.maximumDecodedBytes, 'Line bound exceeds decoded bound');
  return { ...value };
}

// A complete member is acknowledged only after every underlying write callback.
// This is not fsync and does not claim durability through loss of power.
export async function createGzipHistoryWriter(file, storage, { open = fs.open } = {}) {
  validateHistoryStorage(storage);
  const handle = await open(file, 'wx', 0o600), logical = crypto.createHash('sha256');
  let logicalBytes = 0, storedBytes = 0, closed = false, failed = null, writing = false;
  return {
    async append(bytes) {
      assert(Buffer.isBuffer(bytes)); assert(!closed && !writing && !failed, 'History writer is closed, busy or failed');
      assert(bytes.length <= storage.maximumLineBytes, 'History line-byte bound exceeded');
      assert(logicalBytes + bytes.length <= storage.maximumDecodedBytes, 'History decoded-byte bound exceeded');
      writing = true;
      const sink = new Writable({ highWaterMark: 65536, write(chunk, _encoding, callback) {
        (async () => {
          assert(storedBytes + chunk.length <= storage.maximumStoredBytes, 'History stored-byte bound exceeded');
          let offset = 0;
          while (offset < chunk.length) {
            const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset, null);
            assert(bytesWritten > 0 && bytesWritten <= chunk.length - offset, 'Invalid history write acknowledgement');
            storedBytes += bytesWritten; offset += bytesWritten;
          }
        })().then(() => callback(), callback);
      } });
      try {
        await pipeline(Readable.from([bytes]), createGzip({ level: 6, chunkSize: 65536 }), sink);
        logical.update(bytes); logicalBytes += bytes.length;
      } catch (error) { failed = error; throw error; }
      finally { writing = false; }
    },
    diagnostic() { return { acknowledgedDecodedBytes: logicalBytes, acknowledgedDecodedSha256: logical.copy().digest('hex'), storedBytes }; },
    async close() { if (!closed) { closed = true; await handle.close(); } },
  };
}

export async function verifyGzipHistory(file, artifact, storage, { canonicalJson, sha256 }) {
  validateHistoryStorage(storage);
  assert.deepEqual(Object.keys(artifact).sort(), ['path', 'bytes', 'sha256', 'decoded'].sort(), 'Unexpected compressed artifact fields');
  assert.deepEqual(Object.keys(artifact.decoded).sort(), ['path', 'encoding', 'framing', 'bytes', 'sha256'].sort());
  assert.equal(artifact.path, 'history.jsonl.gz'); assert.equal(artifact.decoded.path, 'history.jsonl');
  assert.equal(artifact.decoded.encoding, storage.encoding); assert.equal(artifact.decoded.framing, storage.framing);
  for (const item of [artifact, artifact.decoded]) {
    assert(Number.isSafeInteger(item.bytes) && item.bytes > 0, 'Invalid history byte count');
    assert(/^[a-f0-9]{64}$/.test(item.sha256), 'Invalid history hash');
  }
  assert(artifact.bytes <= storage.maximumStoredBytes, 'History stored-byte bound exceeded');
  assert(artifact.decoded.bytes <= storage.maximumDecodedBytes, 'History decoded-byte bound exceeded');
  const decodedHash = crypto.createHash('sha256'); let storedBytes = 0, decodedBytes = 0;
  const gunzip = createGunzip({ chunkSize: 65536 });
  const physical = new Transform({ transform(chunk, _encoding, callback) {
    storedBytes += chunk.length;
    callback(storedBytes > artifact.bytes || storedBytes > storage.maximumStoredBytes ? Error('History stored-byte bound exceeded') : null, chunk);
  } });
  const decoded = new Transform({ transform(chunk, _encoding, callback) {
    decodedBytes += chunk.length;
    if (decodedBytes > artifact.decoded.bytes || decodedBytes > storage.maximumDecodedBytes) return callback(Error('History decoded-byte bound exceeded'));
    decodedHash.update(chunk); callback(null, chunk);
  } });
  let verified;
  await pipeline(createReadStream(file), physical, gunzip, decoded, async chunks => {
    verified = await verifyBoundedHistoryStream(chunks, { canonicalJson, sha256, limits: storage });
  });
  assert.equal(storedBytes, artifact.bytes, 'History stored size mismatch');
  // zlib accepts trailing zero padding; bytesWritten excludes that padding.
  assert.equal(gunzip.bytesWritten, storedBytes, 'Trailing bytes after gzip members');
  assert.equal(decodedBytes, artifact.decoded.bytes, 'History decoded size mismatch');
  assert.equal(decodedHash.digest('hex'), artifact.decoded.sha256, 'History decoded hash mismatch');
  return verified;
}

export async function createGzipProofRecorder(options, api) {
  const { directory, source, configuration, runId, seed, scenarioId, population } = options;
  const storage = validateHistoryStorage(options.historyStorage);
  const { canonicalJson, sha256, wallTimestamp, assertSourceUnchanged, canonicalDatabaseSnapshot, writeCheckpoint, verifyArtifactIndex } = api;
  const historyStorageSha256 = sha256(canonicalJson(storage)), historyPath = path.join(directory, 'history.jsonl.gz');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'run-reserved.json'), canonicalJson({ runId, source, format: 2,
    historyStorage: storage, historyStorageSha256, configurationSha256: sha256(canonicalJson(configuration)),
    incompleteCapture: { history: 'history.jsonl.gz', diagnostic: 'capture-failure.json' } }), { flag: 'wx', mode: 0o600 });
  const writer = await createGzipHistoryWriter(historyPath, storage);
  const artifacts = [], names = new Set(['run-reserved.json', 'run.json', 'run-unsealed.json', 'history.jsonl', 'history.jsonl.gz', 'capture-failure.json']);
  const artifactOperations = new Set();
  const outstanding = new Set(), startedAt = wallTimestamp();
  let sequence = 0, invocation = 0, seenInvocations = 0, previousHash = null, pending = 0, tail = Promise.resolve();
  let closed = false, captureFailure = null, attemptedSequence = null, authorityFailure = null;
  const fail = error => { captureFailure ||= error; return error; };
  const record = event => {
    if (captureFailure) return Promise.reject(captureFailure);
    if (closed) return Promise.reject(fail(Error('History admission is closed')));
    if (pending >= storage.maximumPendingRecords) return Promise.reject(fail(Error('History pending-record bound exceeded')));
    pending++;
    const work = tail.then(async () => {
      if (captureFailure) throw captureFailure;
      attemptedSequence = sequence + 1;
      try {
        for (const key of ['sequence', 'previousHash', 'observedAt', 'hash']) assert(!Object.hasOwn(event, key), `Reserved history field: ${key}`);
        if (event.kind === 'invocation') {
          assert.equal(event.invocation, seenInvocations + 1, 'Nonsequential authority invocation');
          assert(outstanding.size < storage.maximumOutstandingInvocations, 'History outstanding-invocation bound exceeded');
        }
        if (event.kind === 'completion') assert(outstanding.has(event.invocation), 'Unknown/repeated completion');
        const row = { sequence: attemptedSequence, previousHash, observedAt: wallTimestamp(), ...event };
        const hash = sha256(canonicalJson(row)), bytes = Buffer.from(`${canonicalJson({ ...row, hash })}\n`);
        await writer.append(bytes);
        sequence = attemptedSequence; previousHash = hash;
        if (event.kind === 'invocation') { seenInvocations++; outstanding.add(event.invocation); }
        if (event.kind === 'completion') outstanding.delete(event.invocation);
        return sequence;
      } catch (error) { throw fail(error); }
    });
    tail = work.catch(() => {}).finally(() => { pending--; });
    return work;
  };
  const writeJson = async (name, value) => {
    const bytes = `${JSON.stringify(value, null, 2)}\n`;
    await fs.writeFile(path.join(directory, name), bytes, { flag: 'wx', mode: 0o600 });
    artifacts.push({ path: name, sha256: sha256(bytes), bytes: Buffer.byteLength(bytes) });
  };
  const artifactOperation = (paths, work) => {
    assert(!closed, 'Artifact admission is closed');
    for (const name of paths) assert(!names.has(name), `Duplicate/reserved artifact path: ${name}`);
    for (const name of paths) names.add(name);
    // History may already be poisoned: caller failure snapshots are still
    // admitted until finish. An admitted artifact failure prevents sealing.
    const operation = Promise.resolve().then(work).catch(error => { throw fail(error); });
    artifactOperations.add(operation);
    void operation.finally(() => artifactOperations.delete(operation)).catch(() => {});
    return operation;
  };
  const put = async (name, value) => {
    assert(/^[a-z0-9-]+\.json$/.test(name));
    return artifactOperation([name], () => writeJson(name, value));
  };
  return {
    record, artifact: put,
    async invoke(kind, identity, work) {
      const id = ++invocation;
      await record({ kind: 'invocation', invocation: id, authority: kind, identity });
      let value;
      try { value = await work(); }
      catch (error) {
        try { await record({ kind: 'completion', invocation: id, outcome: 'THREW', error: { message: error.message, code: error.code || null } }); }
        catch { authorityFailure = { message: error.message, code: error.code || null, invocation: id }; }
        throw error;
      }
      await record({ kind: 'completion', invocation: id, outcome: 'RETURNED', result: value }); return value;
    },
    async snapshot(pool, label) {
      assert(/^[a-z0-9-]+$/.test(label));
      return artifactOperation([`${label}.json`], async () => {
        const value = await canonicalDatabaseSnapshot(pool); await writeJson(`${label}.json`, value); return value;
      });
    },
    async checkpoint(pool, label, url) {
      assert(/^[a-z0-9-]+$/.test(label)); const name = `${label}.dump`;
      return artifactOperation([name, `${label}-checkpoint.json`], async () => {
        const value = await writeCheckpoint(pool, path.join(directory, name), url);
        artifacts.push({ path: name, sha256: value.sha256, bytes: value.bytes });
        await writeJson(`${label}-checkpoint.json`, value); return value;
      });
    },
    async finish(result) {
      assert(!closed, 'Recorder already finished'); closed = true;
      assert(['PASS_SCOPED', 'FAIL'].includes(result.status), 'A scoped recorder cannot issue release or matrix clearance');
      await tail;
      await Promise.allSettled([...artifactOperations]);
      try { await writer.close(); } catch (error) { fail(error); }
      let sourceFailure = null;
      try { await assertSourceUnchanged(source); } catch (error) { sourceFailure = error.message; }
      if (!sequence || outstanding.size) fail(Error(!sequence ? 'Empty history' : 'Unfinished authority invocations'));
      let physical;
      try { physical = await hashEvidenceFile(historyPath); } catch (error) { fail(error); }
      if (!captureFailure) {
        const diagnostic = writer.diagnostic();
        artifacts.push({ path: 'history.jsonl.gz', ...physical, decoded: { path: 'history.jsonl', encoding: storage.encoding,
          framing: storage.framing, bytes: diagnostic.acknowledgedDecodedBytes, sha256: diagnostic.acknowledgedDecodedSha256 } });
        const record = { format: 2, runId, seed, scenarioId, population, source, configuration,
          configurationSha256: sha256(canonicalJson(configuration)), startedAt, endedAt: wallTimestamp(),
          historyStorage: storage, historyStorageSha256,
          historyVerification: { semantics: 'sequential-invocations-v1', events: sequence, invocations: seenInvocations, finalHash: previousHash },
          runtime: { node: process.version, platform: process.platform, architecture: process.arch, cpuCount: os.cpus().length,
            totalMemoryBytes: os.totalmem(), availableParallelism: os.availableParallelism(), productionEquivalent: false,
            hardwareLimits: 'Local machine; no enforced process CPU/RAM quota.' },
          status: sourceFailure ? 'FAIL' : result.status,
          result: sourceFailure ? { ...result, status: 'FAIL', requestedStatus: result.status, sourceFailure } : result,
          ...(sourceFailure ? { sourceFailure } : {}), artifacts,
          evidenceKind: 'native-postgresql-scoped-fixture', matrixQualifying: false,
          coverageExclusions: ['Storage transport does not broaden the native workload, resource, replay or release scope.'],
          traceSemantics: 'Invocation and response-completion observation order, not PostgreSQL commit order. Raw IDs/results retained in restricted output.' };
        try {
          await verifyArtifactIndex(directory, record);
          // A failed write/close must not expose a parseable sealed PASS. Publish
          // the fully closed staging file with a no-overwrite hard link.
          const staging = path.join(directory, 'run-unsealed.json');
          await fs.writeFile(staging, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
          await fs.link(staging, path.join(directory, 'run.json'));
          try { await fs.unlink(staging); } catch { /* A redundant staging link is harmless after successful publication. */ }
        } catch (error) { fail(error); }
        if (!captureFailure) { if (sourceFailure) throw Error(sourceFailure); return record; }
      }
      // This is deliberately not a sealed run, even when the caller requested PASS.
      try {
        await fs.writeFile(path.join(directory, 'capture-failure.json'), `${JSON.stringify({ format: 1, kind: 'rc1-incomplete-capture',
          status: 'INCOMPLETE', runId, source, sourceFailure, historyStorage: storage, historyStorageSha256,
          error: { message: captureFailure.message, code: captureFailure.code || null }, authorityFailure,
          attemptedSequence, acknowledgedSequence: sequence, acknowledgedFinalHash: previousHash,
          outstandingInvocations: [...outstanding], ...writer.diagnostic(), physical: physical || null,
          requestedResult: result, retainedArtifacts: artifacts, matrixQualifying: false }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      } catch { /* Never replace the original failure or delete partial bytes. */ }
      throw captureFailure;
    },
  };
}
