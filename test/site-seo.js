import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalOrigin, enhancePage, INDEXABLE_SITE_PATHS, siteRobots, siteSitemap } from '../src/site-seo.js';
import { PATH_IDS } from '../src/path-funnel.js';
import { renderPathResultPage } from '../src/path-pages.js';

const baseUrl = 'https://preview.example.test/nested?secret=hidden';
const origin = 'https://preview.example.test';
const titles = new Set();
const descriptions = new Set();
for (const [file, path] of [['index', '/'], ['wiki', '/wiki'], ['arena', '/arena'], ['play', '/play'], ['sale', '/sale'], ['defi', '/defi'], ['fee-flows', '/fee-flows'], ['getting-started', '/guides/getting-started']]) {
  const original = readFileSync(new URL(`../public/${file}.html`, import.meta.url), 'utf8');
  const html = enhancePage(original, { baseUrl, path });
  const head = html.slice(0, html.indexOf('</head>'));
  const title = head.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = head.match(/<meta name="description" content="([^"]+)">/)?.[1];
  assert.ok(title && description, `${path} has a title and description`);
  assert.ok(!titles.has(title) && !descriptions.has(description), `${path} metadata is unique`);
  titles.add(title); descriptions.add(description);
  assert.equal((head.match(/<title>/g) || []).length, 1, `${path} has one document title`);
  assert.equal((head.match(/name="description"/g) || []).length, 1, `${path} has one description`);
  assert.ok(head.includes(`<link rel="canonical" href="${origin}${path}">`));
  assert.ok(head.includes(`<meta property="og:url" content="${origin}${path}">`));
  assert.ok(head.includes(`<meta property="og:image" content="${origin}/site-share.png">`));
  assert.ok(head.includes('<meta name="twitter:card" content="summary_large_image">'));
  assert.ok(head.includes('href="/icon-192.png"') && head.includes('href="/apple-touch-icon.png"'));
  const identity = JSON.parse(head.match(/id="omerta-page-identity">([\s\S]*?)<\/script>/)[1]);
  assert.equal(identity.url, `${origin}${path}`);
  assert.equal(identity.about['@id'], 'https://www.omerta.fun/#game', 'pages identify the same game');
  assert.equal(html.slice(html.indexOf('</head>')), original.slice(original.indexOf('</head>')),
    `${path} enhancement preserves game scripts, body markup and nested SVG titles`);
}

for (const id of PATH_IDS) {
  const html = enhancePage(renderPathResultPage(id), { baseUrl, path: `/path/${id}` });
  assert.ok(html.includes(`content="${origin}/art/path-${id}-1200x630.png?v=`), `${id} preserves its versioned custom share card`);
  assert.ok(!html.includes('name="robots"'), `${id} remains an indexable public guide`);
}

const input = '<html><head><title>Terms &amp; privacy</title><meta name="description" content="Players &amp; operators"></head><body>Unchanged</body></html>';
const normalized = enhancePage(input, { baseUrl });
assert.ok(normalized.includes('<title>Terms &amp; privacy</title>'));
assert.ok(!normalized.includes('&amp;amp;'), 'existing HTML entities are not double escaped');
const hostile = enhancePage(input, { baseUrl: 'javascript:alert(1)', path: '//evil.test', title: '<script>bad</script>', description: '"><img src=x>' });
assert.ok(hostile.includes('href="https://www.omerta.fun/"'));
assert.ok(hostile.includes('&lt;script&gt;bad&lt;/script&gt;'));
assert.ok(hostile.includes('&quot;&gt;&lt;img src=x&gt;'));
assert.equal(canonicalOrigin('file:///secret'), 'https://www.omerta.fun');
assert.equal(canonicalOrigin('not a URL'), 'https://www.omerta.fun');
assert.equal(canonicalOrigin('https://user:password@example.test/private'), 'https://example.test');
for (const alias of ['http://omerta.fun', 'https://omerta.fun', 'http://www.omerta.fun', 'https://www.omerta.fun']) {
  assert.ok(enhancePage(input, { baseUrl: `${alias}/ignored?private=value`, path: '/play' })
    .includes('rel="canonical" href="https://www.omerta.fun/play"'), 'production aliases share one canonical hostname');
  assert.ok(siteSitemap(alias).includes('<loc>https://www.omerta.fun/play</loc>'));
  assert.ok(siteRobots(alias).includes('Sitemap: https://www.omerta.fun/sitemap.xml'));
  assert.equal(canonicalOrigin(alias), alias, 'application origins remain unchanged for auth and analytics');
}
for (const preview of ['http://localhost:8787', 'https://preview.example.test', 'https://omerta.fun.example.test', 'http://omerta.fun:8787'])
  assert.ok(enhancePage(input, { baseUrl: preview }).includes(`rel="canonical" href="${preview}/"`), 'preview origins are preserved');
assert.equal((enhancePage(normalized, { baseUrl }).match(/id="omerta-page-identity"/g) || []).length, 1,
  'repeated metadata enhancement does not duplicate the page identity');
for (const path of ['/admin', '/consigliere']) assert.ok(enhancePage(input, { path }).includes('content="noindex, follow"'));
assert.ok(enhancePage(input, { indexable: false }).includes('content="noindex, follow"'));

const sitemap = siteSitemap(baseUrl);
assert.equal(new Set(INDEXABLE_SITE_PATHS).size, INDEXABLE_SITE_PATHS.length, 'the sitemap has no duplicate routes');
for (const path of INDEXABLE_SITE_PATHS) assert.ok(sitemap.includes(`<loc>${origin}${path}</loc>`));
for (const path of ['/admin', '/consigliere', '/terms', '/dmca']) assert.ok(!sitemap.includes(`<loc>${origin}${path}</loc>`));
const configured = siteSitemap(baseUrl, { legalReady: { terms: true, dmca: true } });
assert.ok(configured.includes(`<loc>${origin}/terms</loc>`) && configured.includes(`<loc>${origin}/dmca</loc>`));
assert.ok(!configured.includes('secret'), 'canonical URLs exclude deployment URL queries and paths');
const robots = siteRobots(baseUrl);
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
assert.ok(robots.includes('Disallow: /admin') && robots.includes('Disallow: /v1/auth/'));
assert.ok(!robots.includes('Disallow: /v1/\n'), 'public agent API discovery remains available');

const png = readFileSync(new URL('../public/site-share.png', import.meta.url));
assert.equal(png.subarray(1, 4).toString(), 'PNG', 'the site share image is a raster PNG');
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);
console.log('site-seo: PASS — unique metadata, canonical URLs, landscape share cards, private-page exclusions and complete sitemap');
