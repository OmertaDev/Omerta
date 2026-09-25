// Bounded, lossless recorded-query storage. Every chunk remains proof-indexed.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson, sha256 } from './rc1-native-proof.js';

const validName = (name) => /^query-tape-[0-9]{5}\.json$/.test(name);
export function createQueryTapeWriter({ artifact, maxEntries = 64, maxBytes = 8 * 1024 * 1024 }) {
  assert.equal(typeof artifact, 'function');
  assert(Number.isSafeInteger(maxEntries) && maxEntries > 0);
  assert(Number.isSafeInteger(maxBytes) && maxBytes > 0);
  const chunks = [], digest = crypto.createHash('sha256');
  let pending = [], bytes = 0, entries = 0, records = 0, rejected = 0, sealed = false;
  async function flush() {
    if (!pending.length) return;
    const name = `query-tape-${String(chunks.length + 1).padStart(5, '0')}.json`;
    assert(validName(name));
    const chunk = { format: 3, entries: pending };
    await artifact(name, chunk);
    chunks.push({ path: name, entries: pending.length, firstEntry: entries - pending.length + 1,
      lastEntry: entries, semanticSha256: sha256(canonicalJson(chunk)) });
    pending = []; bytes = 0;
  }
  return {
    async append(entry) {
      assert(!sealed, 'Query tape is sealed');
      assert.equal(entry.sequence, entries + 1);
      const size = Buffer.byteLength(canonicalJson(entry));
      assert(size <= maxBytes, 'Single query observation exceeds declared tape chunk budget');
      if (pending.length && (pending.length >= maxEntries || bytes + size > maxBytes)) await flush();
      pending.push(entry); bytes += size; entries++;
      if (entry.accepted) { assert.equal(entry.record.sequence, records + 1); records++; digest.update(`${canonicalJson(entry.record)}\n`); }
      else rejected++;
    },
    async manifest({ complete }) {
      await flush(); if (complete) sealed = true;
      return { format: 3, complete, storage: 'lossless-proof-indexed-json-chunks', maxEntries, maxBytes,
        entries, records, rejected, recordsSha256: digest.copy().digest('hex'), chunks: [...chunks] };
    },
  };
}

export function createQueryTapeReader({ manifest, directory, load }) {
  assert.equal(manifest.format, 3, 'Query tape version differs');
  assert.equal(manifest.complete, true, 'Incomplete query tape cannot drive replay');
  assert.equal(manifest.rejected, 0, 'Failed query tape cannot drive replay');
  assert.equal(manifest.entries, manifest.records);
  assert(Array.isArray(manifest.chunks));
  let total = 0;
  for (const chunk of manifest.chunks) {
    assert(validName(chunk.path)); assert(Number.isSafeInteger(chunk.entries) && chunk.entries > 0);
    assert.equal(chunk.firstEntry, total + 1); total += chunk.entries; assert.equal(chunk.lastEntry, total);
  }
  assert.equal(total, manifest.entries);
  const read = load || (async (name) => {
    assert(validName(name));
    const file = path.join(directory, name), stat = await fs.stat(file);
    assert(stat.size <= manifest.maxBytes * 2 + 65536, 'Query tape chunk exceeds declared size');
    return JSON.parse(await fs.readFile(file, 'utf8'));
  });
  const digest = crypto.createHash('sha256');
  let chunkIndex = 0, offset = 0, current = [], consumed = 0;
  return {
    async next() {
      assert(consumed < manifest.records, 'Unrecorded SQL occurrence');
      if (offset === current.length) {
        const descriptor = manifest.chunks[chunkIndex++], chunk = await read(descriptor.path);
        assert.equal(chunk.format, 3); assert.equal(chunk.entries.length, descriptor.entries);
        assert.equal(sha256(canonicalJson(chunk)), descriptor.semanticSha256, 'Query tape chunk hash differs');
        current = chunk.entries; offset = 0;
      }
      const entry = current[offset++]; consumed++;
      assert.equal(entry.sequence, consumed); assert.equal(entry.accepted, true);
      assert.equal(entry.record.sequence, consumed);
      digest.update(`${canonicalJson(entry.record)}\n`);
      return entry.record;
    },
    finish() {
      assert.equal(consumed, manifest.records, 'Unconsumed recorded SQL occurrences');
      assert.equal(digest.copy().digest('hex'), manifest.recordsSha256, 'Query tape record stream hash differs');
      return { consumed, recordsSha256: manifest.recordsSha256 };
    },
  };
}
