// PWA — the game installs to the home screen (iOS + Android): a web manifest, app icons, and the
// install meta in the client. Confirms the manifest is valid + complete, the icons serve as PNGs, the
// service worker is an app-shell (network-first navigations, never caches the API), and the client head
// carries the install tags. Runs on pg-mem — zero infra.
import assert from 'node:assert';
import vm from 'node:vm';
import { buildServer } from '../src/server.js';

const app = await buildServer();
const get = async (url) => { const r = await app.inject({ method: 'GET', url }); return r; };

// ── the manifest: valid, complete, installable ──
const m = await get('/manifest.json');
assert.equal(m.statusCode, 200, 'manifest serves');
assert.ok(/application\/manifest\+json/.test(m.headers['content-type']), 'the right content-type');
const man = JSON.parse(m.body);
assert.ok(man.name && man.short_name, 'has a name');
assert.equal(man.display, 'standalone', 'display: standalone (opens as an app, no browser chrome)');
assert.ok(man.start_url, 'has a start_url');
assert.equal(man.theme_color, '#0c0b0d', 'the noir theme color');
assert.ok(Array.isArray(man.icons) && man.icons.length >= 2, 'at least two icon sizes');
assert.ok(man.icons.some((i) => i.sizes === '192x192') && man.icons.some((i) => i.sizes === '512x512'), '192 + 512 present');
assert.ok(man.icons.some((i) => i.purpose === 'maskable'), 'a maskable icon (Android safe-zone)');
// the alt name some platforms probe
assert.equal((await get('/manifest.webmanifest')).statusCode, 200, '/manifest.webmanifest also serves');

// ── the icons are real PNGs ──
for (const f of ['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png']) {
  const r = await get(f);
  assert.equal(r.statusCode, 200, `${f} serves`);
  assert.ok(/image\/png/.test(r.headers['content-type']), `${f} is a PNG`);
  const b = r.rawPayload;
  assert.ok(b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47, `${f} has the PNG magic bytes`);
  // every icon the manifest lists must actually resolve (a 404 icon breaks install)
}
for (const i of man.icons) assert.equal((await get(i.src)).statusCode, 200, `manifest icon ${i.src} resolves`);

// ── the service worker is an app shell (not just push) ──
const sw = (await get('/sw.js')).body;
assert.ok(/addEventListener\(['"]install['"]/.test(sw), 'the SW handles install (pre-caches the shell)');
assert.ok(/addEventListener\(['"]fetch['"]/.test(sw), 'the SW handles fetch (offline shell)');
assert.ok(/addEventListener\(['"]push['"]/.test(sw), 'the SW still handles push');
assert.ok(sw.includes("startsWith('/v1/')"), 'the SW NEVER caches the API');

// Drive the deployed worker against real Request/Response values and a disposable Cache API double.
// A stylesheet can be permanently stale while every route test stays green; a Codex navigation used
// to overwrite '/'. These checks exercise the actual fetch handlers and the offline results.
{
  const origin = 'https://omerta.test';
  const keyOf = (req) => new URL(typeof req === 'string' ? req : req.url, origin).href;
  const stores = new Map();
  const listeners = new Map();
  const calls = [];
  let network = async (req) => new Response(`fresh:${new URL(keyOf(req)).pathname}`);
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async match(req) { return entries.get(keyOf(req))?.clone(); },
        async put(req, res) { entries.set(keyOf(req), res.clone()); },
        async addAll(urls) {
          for (const url of urls) entries.set(keyOf(url), await network(url));
        },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  stores.set('omerta-shell-v1', new Map([[keyOf('/'), new Response('polluted old shell')]]));
  stores.set('unrelated-cache', new Map());
  vm.runInNewContext(sw, {
    URL, Response, caches,
    fetch: (req) => { calls.push(keyOf(req)); return network(req); },
    self: { location: { origin }, skipWaiting: async () => {},
      clients: { claim: async () => {} },
      addEventListener: (type, fn) => listeners.set(type, fn) },
  });
  const dispatch = async (type, request) => {
    const waits = [];
    let response;
    listeners.get(type)({ request, respondWith: (p) => { response = p; }, waitUntil: (p) => waits.push(p) });
    const result = await response;
    await Promise.all(waits);
    return result;
  };
  const req = (path, { mode = 'navigate', method = 'GET', headers = {} } = {}) =>
    ({ url: new URL(path, origin).href, mode, method, headers: new Headers(headers) });
  const read = (path, options) => dispatch('fetch', req(path, options));
  await dispatch('install');
  await dispatch('activate');
  assert(!stores.has('omerta-shell-v1'), 'activation discards the old polluted shell cache');
  assert(stores.has('unrelated-cache'), 'activation leaves caches owned by other features alone');
  const ownName = [...stores.keys()].find((name) => name.startsWith('omerta-shell-'));
  const own = await caches.open(ownName);
  assert.equal(await (await own.match('/omerta-ui.css')).text(), 'fresh:/omerta-ui.css',
    'the shared stylesheet is part of the offline installation');

  for (const version of ['first', 'second']) {
    network = async () => new Response(`stylesheet:${version}`);
    assert.equal(await (await read('/omerta-ui.css', { mode: 'cors' })).text(), `stylesheet:${version}`,
      'an installed client sees a newly deployed shared stylesheet without clearing storage');
  }
  network = async (request) => new Response(`page:${new URL(request.url).pathname}`);
  await read('/'); await read('/wiki');
  assert.equal(await (await own.match('/')).text(), 'page:/', 'Codex never overwrites the game shell');
  assert.equal(await (await own.match('/wiki')).text(), 'page:/wiki', 'Codex keeps its own offline page');

  for (const [label, response] of [
    ['server error', new Response('failure', { status: 500 })],
    ['not found', new Response('missing', { status: 404 })],
    ['no-store', new Response('private data', { headers: { 'cache-control': 'no-store' } })],
    ['private', new Response('private data', { headers: { 'cache-control': 'private, max-age=60' } })],
    ['redirect', Object.defineProperty(new Response('redirect target'), 'redirected', { value: true })],
  ]) {
    network = async () => response;
    await read('/wiki');
    assert.equal(await (await own.match('/wiki')).text(), 'page:/wiki', `${label} cannot replace a working cached page`);
  }

  network = async () => { throw new Error('offline'); };
  assert.equal(await (await read('/')).text(), 'page:/', 'offline root uses its cached game shell');
  assert.equal(await (await read('/?ref=NewStreet')).text(), 'page:/', 'offline root referrals use the canonical shell');
  assert.equal(await (await read('/wiki')).text(), 'page:/wiki', 'offline Codex uses its own page');
  assert.equal((await read('/uncached-page')).type, 'error', 'an uncached page does not masquerade as the game shell');
  assert.equal(await (await read('/omerta-ui.css', { mode: 'cors' })).text(), 'stylesheet:second',
    'offline styling uses the latest successful stylesheet');

  const before = calls.length;
  for (const [path, options] of [
    ['/v1/me', {}], ['/openapi.json', {}], ['/sw.js', {}],
    ['/v1/crimes/pick', { method: 'POST' }], ['https://elsewhere.test/art.jpg', { mode: 'cors' }],
    ['/art/hype/hero-poster.mp4', { mode: 'cors', headers: { range: 'bytes=0-1023' } }],
    ['/private-page', { headers: { authorization: 'Bearer disposable-test-value' } }],
  ]) assert.equal(await read(path, options), undefined, `${path} passes through without cache handling`);
  assert.equal(calls.length, before, 'excluded requests never enter the worker network/cache strategy');

  network = async () => new Response('stable art');
  await read('/art/test.webp', { mode: 'cors' });
  network = async () => { throw new Error('art should have been cached'); };
  assert.equal(await (await read('/art/test.webp', { mode: 'cors' })).text(), 'stable art',
    'unchanged static art retains its cache-first behavior');
}

// ── the client head carries the install tags ──
const html = (await get('/')).body;
assert.ok(html.includes('<link rel="manifest" href="/manifest.json">'), 'the client links the manifest');
assert.ok(html.includes('rel="apple-touch-icon"'), 'an apple-touch-icon (iOS home screen)');
assert.ok(html.includes('name="apple-mobile-web-app-capable"'), 'iOS standalone meta');
assert.ok(html.includes('name="theme-color"'), 'a theme-color');
assert.ok(html.includes('viewport-fit=cover'), 'the iOS viewport exposes its safe-area insets');
const ui = (await get('/omerta-ui.css')).body;
assert.ok(ui.includes('--om-safe-area-top: env(safe-area-inset-top, 0px)'),
  'the shared public shell exposes the iPhone status-bar inset');
assert.ok(/\.public-nav\s*\{[^}]*padding:\s*calc\(8px \+ var\(--om-safe-area-top\)\)/s.test(ui),
  'the public header keeps its controls below the iPhone PWA status bar');

// ── THE MOTION LIBRARY route — the generated ambient clips behind the cinematics + the landing hero.
// The boot ALLOWLIST discipline (a request is a Map lookup — no traversal by construction), streamed
// from disk with RANGE support, which is NOT optional for <video>: Chromium's media stack refuses a
// source it cannot seek (found live by the motion probe — the element fires error and the client's
// fail-safe removes the clip).
{
  const r = await get('/art/hype/hero-poster.mp4');
  assert.equal(r.statusCode, 200, 'a motion clip serves');
  assert.ok(/video\/mp4/.test(r.headers['content-type']), 'as video/mp4');
  assert.equal(r.headers['accept-ranges'], 'bytes', 'and advertises range support (the <video> decoder needs it)');
  assert.ok(Number(r.headers['content-length']) > 100000, 'with a real content-length');
  const rr = await app.inject({ method: 'GET', url: '/art/hype/hero-poster.mp4', headers: { range: 'bytes=0-1023' } });
  assert.equal(rr.statusCode, 206, 'a range request gets 206 partial content');
  assert.equal(rr.headers['content-length'], '1024', 'exactly the requested slice');
  assert.ok(/^bytes 0-1023\//.test(rr.headers['content-range']), 'with a correct content-range');
  const bad = await app.inject({ method: 'GET', url: '/art/hype/hero-poster.mp4', headers: { range: 'bytes=999999999-' } });
  assert.equal(bad.statusCode, 416, 'an unsatisfiable range is refused, not crashed');
  assert.equal((await get('/art/hype/no-such-clip.mp4')).statusCode, 404, 'an unknown clip 404s (allowlist)');
  assert.equal((await get('/art/hype/..%2F..%2Fpackage.json')).statusCode, 404, 'traversal is a key not in the Map');
  // the AMBIENT BEDS ride the same allowlist + range machinery as the clips (an <audio> element
  // wants seekability exactly like <video>), typed audio/mp4 — and the client learns what shipped
  // from the motion manifest instead of hardcoding a list that would drift from this directory
  const bed = await get('/art/hype/bed-streets.m4a');
  assert.equal(bed.statusCode, 200, 'an ambient bed serves');
  assert.ok(/audio\/mp4/.test(bed.headers['content-type']), 'as audio/mp4');
  assert.equal(bed.headers['accept-ranges'], 'bytes', 'with range support');
  const mo = await get('/v1/art/motion');
  assert.equal(mo.statusCode, 200, 'the motion manifest serves');
  const moj = JSON.parse(mo.body);
  assert.ok(Array.isArray(moj.clips) && moj.clips.includes('hero-poster'), 'the manifest lists the clips (by plate name, no extension)');
  assert.ok(Array.isArray(moj.beds) && moj.beds.includes('bed-streets'), 'and the beds');
}

console.log('pwa: PASS');
await app.close();
process.exit(0);
