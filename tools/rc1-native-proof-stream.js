// Exact evidence verification with bounded file/line buffering. No sampled rows.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';

export async function hashEvidenceFile(file, maximumBytes = Infinity) {
  const hash = crypto.createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    bytes += chunk.length; assert(bytes <= maximumBytes, 'Evidence stored-byte bound exceeded'); hash.update(chunk);
  }
  return { sha256: hash.digest('hex'), bytes };
}

// Accept byte chunks so tests can split within UTF-8 code points, JSON syntax,
// CRLF, and event boundaries. Split only LF, matching the former whole-file
// trim().split('\n') parser; a bare CR is not a new event delimiter.
export async function verifyHistoryStream(chunks, { canonicalJson, sha256, limits }) {
  const decoder = new StringDecoder('utf8'), unfinished = new Set(), invoked = new Set();
  let tail = '', count = 0, previousHash = null, pendingWhitespace = false;
  let boundedBytes = 0, boundedLineBytes = 0;
  const line = text => {
    if (!text.trim()) { if (count) pendingWhitespace = true; return; }
    assert(!pendingWhitespace, 'Interior empty history line');
    const { hash, ...event } = JSON.parse(text);
    assert.equal(event.sequence, count + 1, 'History sequence gap');
    assert.equal(event.previousHash, previousHash, 'History chain gap');
    assert.equal(hash, sha256(canonicalJson(event)), 'History hash mismatch');
    previousHash = hash; count++;
    if (event.kind === 'invocation') {
      assert(!invoked.has(event.invocation), 'Duplicate invocation'); invoked.add(event.invocation); unfinished.add(event.invocation);
    }
    if (event.kind === 'completion') assert(unfinished.delete(event.invocation), 'Unknown/repeated completion');
  };
  const accept = text => {
    tail += text; let start = 0, end;
    while ((end = tail.indexOf('\n', start)) !== -1) { line(tail.slice(start, end)); start = end + 1; }
    tail = tail.slice(start);
  };
  for await (const chunk of chunks) {
    assert(Buffer.isBuffer(chunk), 'History requires exact byte chunks');
    if (limits) {
      boundedBytes += chunk.length; assert(boundedBytes <= limits.maximumDecodedBytes, 'History decoded-byte bound exceeded');
      let offset = 0;
      while (offset < chunk.length) {
        const lf = chunk.indexOf(10, offset), end = lf < 0 ? chunk.length : lf + 1;
        boundedLineBytes += end - offset; assert(boundedLineBytes <= limits.maximumLineBytes, 'History line-byte bound exceeded');
        if (lf >= 0) boundedLineBytes = 0; offset = end;
      }
    }
    accept(decoder.write(chunk));
  }
  accept(decoder.end()); if (tail) line(tail);
  assert(count > 0, 'Empty history'); assert.equal(unfinished.size, 0, 'Unfinished authority invocations');
  return { events: count, invocations: invoked.size, finalHash: previousHash };
}

// Explicit format2 mode: bound the raw line before decoding/parsing and retain
// only unfinished IDs. The legacy parser and its accepted inputs are unchanged.
export async function verifyBoundedHistoryStream(chunks, { canonicalJson, sha256, limits }) {
  const unfinished = new Set(); let count = 0, invocations = 0, previousHash = null, bytes = 0, length = 0;
  let pieces = [];
  const line = () => {
    const raw = Buffer.concat(pieces, length); pieces = []; length = 0;
    assert(raw.length > 1 && raw.at(-1) === 10, 'Invalid bounded history line');
    const { hash, ...event } = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw.subarray(0, -1)));
    assert.equal(event.sequence, count + 1, 'History sequence gap');
    assert.equal(event.previousHash, previousHash, 'History chain gap');
    assert.equal(hash, sha256(canonicalJson(event)), 'History hash mismatch');
    if (event.kind === 'invocation') {
      assert.equal(event.invocation, invocations + 1, 'Nonsequential authority invocation');
      assert(unfinished.size < limits.maximumOutstandingInvocations, 'History outstanding-invocation bound exceeded');
      unfinished.add(event.invocation); invocations++;
    }
    if (event.kind === 'completion') assert(unfinished.delete(event.invocation), 'Unknown/repeated completion');
    count++; previousHash = hash;
  };
  for await (const chunk of chunks) {
    assert(Buffer.isBuffer(chunk), 'History requires exact byte chunks'); bytes += chunk.length;
    assert(bytes <= limits.maximumDecodedBytes, 'History decoded-byte bound exceeded');
    let start = 0;
    while (start < chunk.length) {
      const found = chunk.indexOf(10, start), end = found < 0 ? chunk.length : found + 1;
      const part = chunk.subarray(start, end); length += part.length;
      assert(length <= limits.maximumLineBytes, 'History line-byte bound exceeded');
      pieces.push(part); if (found >= 0) line(); start = end;
    }
  }
  assert.equal(length, 0, 'Truncated history line'); assert(count > 0, 'Empty history');
  assert.equal(unfinished.size, 0, 'Unfinished authority invocations');
  return { semantics: 'sequential-invocations-v1', events: count, invocations, finalHash: previousHash };
}
