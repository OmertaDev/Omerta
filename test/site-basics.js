import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';

if (process.env.DATABASE_URL) throw new Error('Site checks require a disposable database.');
const app = await buildServer();
try {
  const sitemap = await app.inject('/sitemap.xml');
  assert.equal(sitemap.statusCode, 200);
  const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
  assert.ok(urls.length > 10, 'all stable public guides are discoverable');
  assert.ok(!urls.some(url => ['/admin', '/consigliere'].includes(url.pathname)));
  assert.ok(urls.some(url => url.pathname === '/guides/getting-started'), 'the beginner guide is in the sitemap');
  assert.ok(['/defi', '/fee-flows'].every(path => urls.some(url => url.pathname === path)), 'current public finance pages are in the sitemap');
  const titles = new Set();
  for (const url of urls) {
    const response = await app.inject(url.pathname + '?ref=private-referral');
    assert.equal(response.statusCode, 200, url.pathname);
    if (!response.headers['content-type'].startsWith('text/html')) continue;
    const head = response.body.split('</head>')[0];
    const title = head.match(/<title>(.*?)<\/title>/)?.[1];
    assert.ok(title && !titles.has(title), `unique title for ${url.pathname}`);
    titles.add(title);
    assert.match(head, /<meta name="description" content="[^"]+">/);
    assert.ok(head.includes(`<link rel="canonical" href="${url.href}">`), 'query-free canonical');
    assert.ok(!head.includes('private-referral'), 'no request data in page metadata');
    const imageUrl = head.match(/<meta property="og:image" content="([^"]+)">/)?.[1];
    assert.ok(imageUrl, `sharing image for ${url.pathname}`);
    const image = await app.inject(new URL(imageUrl).pathname);
    assert.equal(image.statusCode, 200, imageUrl);
    assert.match(image.headers['content-type'], /image\/png/);
    assert.equal(image.rawPayload.readUInt32BE(16), 1200);
    assert.equal(image.rawPayload.readUInt32BE(20), 630);
    assert.match(head, /src="\/site-analytics\.js\?v=[a-f0-9]{16}" defer/);
    assert.match(head, /rel="icon"/);
  }
  for (const path of ['/gone', '/gone.html', '/path/unknown', '/gone?token=private-value']) {
    const missing = await app.inject({ url: path, headers: { accept: 'text/html' } });
    assert.equal(missing.statusCode, 404);
    assert.match(missing.headers['content-type'], /text\/html/);
    assert.match(missing.headers['x-robots-tag'], /noindex/);
    assert.match(missing.body, /href="\/wiki"/);
    assert.ok(!missing.body.includes('private-value'));
  }
  for (const path of ['/v1/missing', '/missing.js', '/art/missing.png']) {
    const missing = await app.inject({ url: path, headers: { accept: 'application/json' } });
    assert.equal(missing.statusCode, 404);
    assert.match(missing.headers['content-type'], /application\/json/);
  }
  const root = await app.inject('/');
  assert.ok(root.body.includes('href="/guides/getting-started"'), 'the guide is linked from the homepage');
  const guide = await app.inject('/guides/getting-started');
  assert.match(guide.body, /<h1[^>]*>How to play OMERTÀ/);
  assert.match(guide.body, /href="\/path"/);
  assert.match(guide.body, /href="\/play"/);
  const openapi = (await app.inject('/openapi.json')).json();
  assert.ok(!openapi.paths['/guides/getting-started'], 'the HTML guide is excluded from the JSON API contract');
  const agents = await app.inject('/agents');
  assert.match(agents.headers['content-type'], /text\/markdown/, 'existing machine onboarding stays compatible');
  const cached = await app.inject({ url: '/', headers: { 'if-none-match': root.headers.etag } });
  assert.equal(cached.statusCode, 304, 'metadata preserves conditional caching');
  const admin = await app.inject('/admin');
  assert.match(admin.headers['x-robots-tag'], /noindex/);
  assert.ok(!admin.body.includes('/site-analytics.js'), 'operator activity is not tracked');
  const consig = await app.inject('/consigliere');
  assert.match(consig.headers['x-robots-tag'], /noindex/);
  console.log('site-basics: PASS — served metadata, real sharing images, crawl discovery and HTML/JSON 404s');
} finally {
  await app.close();
}
