import { PATH_IDS } from './path-funnel.js';

const DEFAULT_ORIGIN = 'https://www.omerta.fun';
const SHARE_IMAGE = '/site-share.png';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const unescape = (value) => String(value ?? '').replace(/&(?:amp|lt|gt|quot|apos|#39);/g,
  (entity) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" }[entity]));

// Keep discovery limited to mounted, stable public pages. Account pages and URLs carrying
// referral codes, auth credentials or individual quiz answers never belong in this list.
export const INDEXABLE_SITE_PATHS = Object.freeze([
  '/', '/wiki', '/arena', '/play', '/sale', '/agents', '/path', '/defi', '/fee-flows',
  ...PATH_IDS.map((id) => `/path/${id}`), '/privacy', '/resources',
]);

const DESCRIPTIONS = {
  '/privacy': 'How OMERTÀ uses account information, browser storage and optional services, and how to manage your privacy choices.',
  '/terms': 'Read OMERTÀ payment terms, prepaid access, purchase confirmations, cancellation and refund information.',
  '/dmca': 'How to report copyright concerns about content hosted by OMERTÀ and submit a notice or counter-notice.',
  '/resources': 'Review the scripts, fonts and optional identity, wallet, notification and AI service providers used by OMERTÀ.',
  '/admin': 'OMERTÀ operations console for authorized operators.',
  '/consigliere': 'Manage your OMERTÀ connected agents, permissions and pending confirmations.',
};

export function canonicalOrigin(value) {
  try {
    const url = new URL(value || DEFAULT_ORIGIN);
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : DEFAULT_ORIGIN;
  } catch { return DEFAULT_ORIGIN; }
}

// Keep the configured application origin intact for authentication and same-origin writes.
// Search metadata uses one production hostname even when PUBLIC_URL uses the apex alias.
function canonicalSiteOrigin(value) {
  const origin = canonicalOrigin(value);
  const url = new URL(origin);
  return !url.port && ['omerta.fun', 'www.omerta.fun'].includes(url.hostname) ? DEFAULT_ORIGIN : origin;
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g))
    result[match[1].toLowerCase()] = unescape(match[2] ?? match[3] ?? match[4]);
  return result;
}

// Call before static pages are compressed and hashed, so metadata costs nothing per visit.
// Only the document head changes; inline game templates and SVG titles remain untouched.
export function enhancePage(html, { baseUrl, path = '/', indexable = true, title, description } = {}) {
  const end = html.search(/<\/head\s*>/i);
  if (end < 0) return html;
  let head = html.slice(0, end);
  const tail = html.slice(end);
  const origin = canonicalSiteOrigin(baseUrl);
  const cleanPath = String(path).split(/[?#]/)[0];
  const safePath = /^\/(?!\/)[^\\\s]*$/.test(cleanPath) ? cleanPath : '/';
  const canonical = new URL(safePath, origin).href;
  const metadata = new Map();
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = attributes(tag);
    metadata.set((attrs.name || attrs.property || '').toLowerCase(), attrs.content || '');
  }
  const pageTitle = title || unescape(head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]) || 'OMERTÀ';
  const pageDescription = description || metadata.get('description') || DESCRIPTIONS[safePath]
    || 'Explore OMERTÀ, a persistent multiplayer mafia city for people and AI players.';
  // Path guides already own branded cards; all other pages share the site-wide landscape card.
  const pathImage = /^\/path\/(?:gun|ledger|kitchen|wheel|shadow|ring)$/.test(safePath)
    ? metadata.get('og:image') : null;
  const image = pathImage ? new URL(new URL(pathImage, origin).pathname + new URL(pathImage, origin).search, origin).href
    : `${origin}${SHARE_IMAGE}`;
  const noindex = !indexable || ['/admin', '/consigliere'].includes(safePath);
  const replacedMeta = new Set(['description', 'robots', 'og:type', 'og:site_name', 'og:title', 'og:description',
    'og:url', 'og:image', 'og:image:url', 'og:image:secure_url', 'og:image:type', 'og:image:width',
    'og:image:height', 'og:image:alt', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']);
  head = head.replace(/<script\b[^>]*\bid="omerta-page-identity"[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, (tag) => {
      const attrs = attributes(tag);
      return replacedMeta.has((attrs.name || attrs.property || '').toLowerCase()) ? '' : tag;
    }).replace(/<link\b[^>]*>/gi, (tag) => {
      const rel = (attributes(tag).rel || '').toLowerCase().split(/\s+/);
      return rel.some((value) => ['canonical', 'icon', 'apple-touch-icon'].includes(value)) ? '' : tag;
    });
  const meta = (key, value, property = false) => `<meta ${property ? 'property' : 'name'}="${key}" content="${esc(value)}">`;
  const imageAlt = pathImage ? pageTitle : 'OMERTÀ — a persistent mafia city for people and AI players';
  const pageIdentity = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${canonical}#webpage`,
    url: canonical, name: pageTitle, description: pageDescription,
    about: { '@id': `${DEFAULT_ORIGIN}/#game` },
    isPartOf: { '@type': 'WebSite', '@id': `${DEFAULT_ORIGIN}/#website`, name: 'OMERTÀ', url: `${DEFAULT_ORIGIN}/` },
  }).replace(/</g, '\\u003c');
  const additions = [
    `<title>${esc(pageTitle)}</title>`, meta('description', pageDescription),
    `<link rel="canonical" href="${esc(canonical)}">`,
    meta('og:type', 'website', true), meta('og:site_name', 'OMERTÀ', true),
    meta('og:title', pageTitle, true), meta('og:description', pageDescription, true),
    meta('og:url', canonical, true), meta('og:image', image, true), meta('og:image:type', 'image/png', true),
    meta('og:image:width', '1200', true), meta('og:image:height', '630', true), meta('og:image:alt', imageAlt, true),
    meta('twitter:card', 'summary_large_image'), meta('twitter:title', pageTitle),
    meta('twitter:description', pageDescription), meta('twitter:image', image), meta('twitter:image:alt', imageAlt),
    '<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">',
    ...(noindex ? [meta('robots', 'noindex, follow')] : []),
    ...(!noindex ? [`<script type="application/ld+json" id="omerta-page-identity">${pageIdentity}</script>`] : []),
  ];
  return `${head}\n${additions.join('\n')}\n${tail}`;
}

export function siteRobots(baseUrl) {
  return [
    '# OMERTÀ — public pages and AI agent discovery are welcome.',
    '# Machine surfaces: /llms.txt, /agents, /openapi.json and /play.',
    'User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /consigliere',
    'Disallow: /v1/auth/', 'Disallow: /v1/mod/',
    `Sitemap: ${canonicalSiteOrigin(baseUrl)}/sitemap.xml`, '',
  ].join('\n');
}

export function siteSitemap(baseUrl, { legalReady = {} } = {}) {
  const origin = canonicalSiteOrigin(baseUrl);
  const paths = [...INDEXABLE_SITE_PATHS, ...['terms', 'dmca'].filter((kind) => legalReady[kind]).map((kind) => `/${kind}`)];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + paths.map((path) => `  <url><loc>${esc(`${origin}${path}`)}</loc></url>`).join('\n')
    + '\n</urlset>\n';
}
