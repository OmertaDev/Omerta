// Exact evidence verification with bounded file/line buffering. No sampled rows.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';

export async function hashEvidenceFile(file) {
  const hash = crypto.createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(file)) { bytes += chunk.length; hash.update(chunk); }
  return { sha256: hash.digest('hex'), bytes };
}

// Accept byte chunks so tests can split within UTF-8 code points, JSON syntax,
// CRLF, and event boundaries. Split only LF, matching the former whole-file
// trim().split('\n') parser; a bare CR is not a new event delimiter.
export async function verifyHistoryStream(chunks, { canonicalJson, sha256 }) {
  const decoder = new StringDecoder('utf8'), unfinished = new Set(), invoked = new Set();
  let tail = '', count = 0, previousHash = null, pendingWhitespace = false;
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
  for await (const chunk of chunks) { assert(Buffer.isBuffer(chunk), 'History requires exact byte chunks'); accept(decoder.write(chunk)); }
  accept(decoder.end()); if (tail) line(tail);
  assert(count > 0, 'Empty history'); assert.equal(unfinished.size, 0, 'Unfinished authority invocations');
  return { events: count, invocations: invoked.size, finalHash: previousHash };
}
