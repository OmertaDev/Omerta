// Verified logical history access. No raw fallback and no decoded temporary file.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { Transform, PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { verifyArtifactIndex } from './rc1-native-proof.js';

export async function* boundedHistoryLines(chunks, { maximumDecodedBytes, maximumLineBytes, requireTerminalNewline = false }) {
  for (const value of [maximumDecodedBytes, maximumLineBytes]) assert(Number.isSafeInteger(value) && value > 0);
  let bytes = 0, length = 0, pieces = [];
  const take = () => {
    const raw = Buffer.concat(pieces, length); pieces = []; length = 0;
    return new TextDecoder('utf-8', { fatal: true }).decode(raw.at(-1) === 10 ? raw.subarray(0, -1) : raw);
  };
  for await (const chunk of chunks) {
    assert(Buffer.isBuffer(chunk)); bytes += chunk.length; assert(bytes <= maximumDecodedBytes, 'Logical reader decoded-byte bound exceeded');
    let offset = 0;
    while (offset < chunk.length) {
      const lf = chunk.indexOf(10, offset), end = lf < 0 ? chunk.length : lf + 1;
      const part = chunk.subarray(offset, end); length += part.length;
      assert(length <= maximumLineBytes, 'Logical reader line-byte bound exceeded'); pieces.push(part);
      if (lf >= 0) yield take(); offset = end;
    }
  }
  if (length) { assert(!requireTerminalNewline, 'Logical reader truncated final line'); yield take(); }
}

export async function* readVerifiedHistoryLines(directory, run, { maximumLineBytes = 16777216 } = {}) {
  assert(Number.isSafeInteger(maximumLineBytes) && maximumLineBytes > 0);
  await verifyArtifactIndex(directory, run, { historyLimits: { maximumLineBytes } });
  const compressed = run.format === 2, artifact = run.artifacts.find(item => item.path === (compressed ? 'history.jsonl.gz' : 'history.jsonl'));
  assert(artifact, 'Verified logical history is not indexed');
  const logical = compressed ? artifact.decoded : artifact;
  assert(Number.isSafeInteger(logical.bytes) && logical.bytes > 0);
  const physicalHash = crypto.createHash('sha256'), logicalHash = crypto.createHash('sha256'); let physicalBytes = 0, logicalBytes = 0;
  const meter = new Transform({ transform(chunk, _encoding, callback) {
    physicalBytes += chunk.length;
    if (physicalBytes > artifact.bytes) return callback(Error('Logical reader stored-byte bound exceeded'));
    physicalHash.update(chunk); callback(null, chunk);
  } });
  const decoded = new Transform({ transform(chunk, _encoding, callback) {
    logicalBytes += chunk.length;
    if (logicalBytes > logical.bytes) return callback(Error('Logical reader decoded-byte bound exceeded'));
    logicalHash.update(chunk); callback(null, chunk);
  } });
  const output = new PassThrough(), source = createReadStream(path.join(directory, artifact.path));
  const gunzip = compressed ? createGunzip({ chunkSize: 65536 }) : null;
  const pumping = pipeline(...[source, meter, gunzip, decoded, output].filter(Boolean));
  void pumping.catch(() => {}); // Preserve the original rejection for the awaited path below.
  let complete = false, failure = null;
  try {
    yield* boundedHistoryLines(output, { maximumDecodedBytes: logical.bytes,
      maximumLineBytes: compressed ? Math.min(maximumLineBytes, run.historyStorage.maximumLineBytes) : maximumLineBytes,
      requireTerminalNewline: compressed });
    await pumping;
    assert.equal(physicalBytes, artifact.bytes); assert.equal(physicalHash.digest('hex'), artifact.sha256, 'Logical reader physical hash changed');
    if (gunzip) assert.equal(gunzip.bytesWritten, physicalBytes, 'Logical reader trailing gzip bytes');
    assert.equal(logicalBytes, logical.bytes); assert.equal(logicalHash.digest('hex'), logical.sha256, 'Logical reader decoded hash changed');
    complete = true;
  } catch (error) { failure = error; throw error;
  } finally {
    source.destroy(); output.destroy(); await pumping.catch(() => {});
    if (!failure) assert(complete, 'Logical history consumption was incomplete');
  }
}
