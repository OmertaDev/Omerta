// The wiki's finished media must play from the real HTTP routes, not just from a local file URL.
import assert from 'node:assert/strict';
import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildServer } from './server-fixture.js';

assert(!process.env.DATABASE_URL, 'Wiki media proof requires disposable pg-mem');
const prefix = '/art/wiki-economy/';
const movie = 'omerta-wiki-economy-1080p.mp4';
const moviePath = fileURLToPath(new URL('../public/art/wiki-economy/' + movie, import.meta.url));
const movieSize = statSync(moviePath).size;
assert(movieSize > 0, 'The completed explainer movie must ship with its player');
const app = await buildServer();
const request = (name, headers = {}, method = 'GET') => app.inject({ method, url: prefix + name, headers });
const assertCache = response => assert.equal(response.headers['cache-control'], 'no-cache',
  'Unhashed explainer assets updated in place must revalidate');
const bytesAt = (start, size) => {
  const fd = openSync(moviePath, 'r');
  try {
    const bytes = Buffer.alloc(size);
    assert.equal(readSync(fd, bytes, 0, size, start), size);
    return bytes;
  } finally { closeSync(fd); }
};

try {
  const full = await request(movie);
  assert.equal(full.statusCode, 200);
  assert.equal(full.headers['content-type'], 'video/mp4');
  assert.equal(full.headers['accept-ranges'], 'bytes');
  assert.equal(Number(full.headers['content-length']), movieSize);
  assert.equal(full.rawPayload.length, movieSize, 'Full GET streams the complete movie');
  assert(full.rawPayload.subarray(0, 16).equals(bytesAt(0, 16)));
  assertCache(full);

  // Encoded slashes may resolve through the pre-existing /art/:file route; caching must follow the asset.
  const alias = await app.inject({ method: 'HEAD', url: '/art/wiki-economy%2F' + movie });
  assert.equal(alias.statusCode, 200);
  assertCache(alias);

  const head = await request(movie, {}, 'HEAD');
  assert.equal(head.statusCode, 200);
  assert.equal(Number(head.headers['content-length']), movieSize);
  assert.equal(head.rawPayload.length, 0);
  assertCache(head);

  for (const [range, start, end] of [
    ['bytes=0-1023', 0, 1023],
    ['bytes=-512', movieSize - 512, movieSize - 1],
    [`bytes=${movieSize - 256}-`, movieSize - 256, movieSize - 1],
  ]) {
    const result = await request(movie, { range, 'accept-encoding': 'gzip' });
    assert.equal(result.statusCode, 206, range);
    assert.equal(result.headers['content-type'], 'video/mp4');
    assert.equal(result.headers['content-range'], `bytes ${start}-${end}/${movieSize}`);
    assert.equal(Number(result.headers['content-length']), end - start + 1);
    assert.equal(result.headers['content-encoding'], undefined, 'Byte ranges are never compressed');
    assert(result.rawPayload.equals(bytesAt(start, end - start + 1)), 'Range bytes match the movie');
    assertCache(result);
  }
  for (const range of [`bytes=${movieSize}-`, 'bytes=20-10', 'bytes=-0']) {
    const result = await request(movie, { range });
    assert.equal(result.statusCode, 416, range);
    assert.equal(result.headers['content-range'], `bytes */${movieSize}`);
    assertCache(result);
  }

  const ids = ['economy-map', 'fee-split', 'deed-lifecycle', 'stock-rewards', 'token-supply', 'technology-stack'];
  for (const id of ids) for (const suffix of ['', '-panel']) for (const extension of ['png', 'svg']) {
    const result = await request(`${id}${suffix}.${extension}`, {}, 'HEAD');
    assert.equal(result.statusCode, 200, `${id}${suffix}.${extension}`);
    assert(result.headers['content-type'].startsWith(extension === 'png' ? 'image/png' : 'image/svg+xml'));
    assert(Number(result.headers['content-length']) > 0);
    assertCache(result);
  }
  for (const [name, type, expected] of [
    ['fee-split.png', 'image/png', null],
    ['fee-split.svg', 'image/svg+xml', '<svg'],
    ['omerta-wiki-economy-poster.jpg', 'image/jpeg', null],
    ['gallery.html', 'text/html', '<!doctype html>'],
    ['captions.vtt', 'text/vtt', 'WEBVTT'],
    ['transcript.md', 'text/plain', null],
  ]) {
    const result = await request(name);
    assert.equal(result.statusCode, 200, name);
    assert(result.headers['content-type'].startsWith(type), name);
    assertCache(result);
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
    if (expected) assert(result.body.includes(expected), name);
    if (name === 'gallery.html') {
      assert.equal(result.headers['x-frame-options'], 'DENY');
      assert(result.headers['content-security-policy'].includes("default-src 'none'"));
      assert(result.headers['content-security-policy'].includes("media-src 'self'"));
      assert(result.headers['content-security-policy'].includes("style-src 'unsafe-inline'"));
    }
    if (name.endsWith('.svg')) assert(result.headers['content-security-policy'].includes("default-src 'none'"));
  }

  for (const name of ['assets.json', 'content.json', 'film.json', 'unknown.png', 'fal/economy-map.png',
    'fal%2Feconomy-map.png', '..%2F..%2Fserver.js', '%2e%2e%5c%2e%2e%5cserver.js']) {
    const result = await request(name);
    assert([400, 404].includes(result.statusCode), `Not public: ${name}`);
    assert(!result.body.includes('import Fastify'), 'Traversal never serves server source');
  }
  console.log('✓ Wiki economy media: full movie, HEAD, normal/suffix/open byte ranges, 416, diagram/panel MIME, revalidation, scoped CSP and private-file/traversal exclusion.');
} finally { await app.close(); }
