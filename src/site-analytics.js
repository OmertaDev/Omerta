import { checkPublicRateLimit, rateLimitsEnabled } from './ratelimit.js';

// Every stored dimension is a fixed public label. No request/account identifiers or URLs enter SQL.
export const SITE_ANALYTICS_PAGES = Object.freeze([
  '/', '/wiki', '/arena', '/play', '/sale', '/path', '/defi', '/fee-flows',
  '/privacy', '/terms', '/dmca', '/resources',
  ...['gun', 'ledger', 'kitchen', 'wheel', 'shadow', 'ring'].map(id => `/path/${id}`),
]);
const pages = SITE_ANALYTICS_PAGES;
const targets = Object.freeze(['/', '/wiki', '/arena', '/play', '/sale', '/path', '/agents', '/defi', '/fee-flows', 'guest_start']);
const completionTargets = Object.freeze(['signup_success', 'first_job_completed']);
export const SITE_ANALYTICS_RETENTION_DAYS = 90;
const counterPrefix = 'website_count:';

function validDimensions(page, event, target) {
  return pages.includes(page) && (event === 'pageview' ? target === ''
    : event === 'cta' ? targets.includes(target)
      : event === 'completion' && page === '/' && completionTargets.includes(target));
}

function dailyCounter(row, since, today) {
  if (!row.id.startsWith(counterPrefix)) return null;
  let dimensions;
  try { dimensions = JSON.parse(row.id.slice(counterPrefix.length)); } catch { return null; }
  if (!Array.isArray(dimensions) || dimensions.length !== 4) return null;
  const [day, page, event, target] = dimensions;
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < since || day > today
    || !validDimensions(page, event, target)) return null;
  const midnight = new Date(`${day}T00:00:00.000Z`);
  const count = Number(row.props);
  if (!Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== day
    || new Date(row.at).getTime() !== midnight.getTime() || !Number.isSafeInteger(count) || count < 1) return null;
  return { day, page, event, target, count };
}

export function registerSiteAnalytics(app, { pool, modAuth, baseUrl }) {
  let origin;
  try { origin = new URL(baseUrl).origin; } catch { /* reject malformed deployment origins */ }
  const origins = new Set(origin ? [origin] : []);
  // Production serves both of these fixed first-party aliases. Custom hosts stay exact-match.
  if (origin === 'https://omerta.fun' || origin === 'https://www.omerta.fun') {
    origins.add('https://omerta.fun');
    origins.add('https://www.omerta.fun');
  }
  app.post('/site-analytics/event', { bodyLimit: 256 }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (req.headers.dnt === '1' || req.headers['sec-gpc'] === '1') return reply.code(204).send();
    // Browser-only, same-origin writes. Checking the configured origin avoids trusting Host headers.
    if (!origins.has(req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site')
      return reply.code(403).send({ error: 'analytics_origin' });
    if (rateLimitsEnabled()) {
      const limited = await checkPublicRateLimit({ ip: req.ip });
      if (limited) return reply.code(429).header('Retry-After', limited.retryAfter).send({ error: 'rate_limited' });
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some(key => !['consent', 'page', 'event', 'target'].includes(key))
      || body.consent !== true || (body.event === 'pageview' && body.target !== undefined)
      || !validDimensions(body.page, body.event, body.target || ''))
      return reply.code(400).send({ error: 'analytics_event' });
    const day = new Date().toISOString().slice(0, 10);
    const id = counterPrefix + JSON.stringify([day, body.page, body.event, body.target || '']);
    await pool.query(`INSERT INTO telemetry (id, at, account_id, event, props)
      VALUES ($1,$2,NULL,'website_count','1') ON CONFLICT (id)
      DO UPDATE SET props=(telemetry.props::bigint+1)::text`, [id, new Date(`${day}T00:00:00.000Z`)]);
    return reply.code(204).send();
  });
  app.get('/v1/mod/site-analytics', { preHandler: modAuth }, async (_req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const since = new Date(Date.now() - (SITE_ANALYTICS_RETENTION_DAYS - 1) * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const stored = await pool.query("SELECT id, at, props FROM telemetry WHERE event='website_count' AND account_id IS NULL AND at >= $1", [new Date(`${since}T00:00:00.000Z`)]);
    const rows = stored.rows.map(row => dailyCounter(row, since, today)).filter(Boolean)
      .sort((a, b) => b.day.localeCompare(a.day) || a.page.localeCompare(b.page)
        || a.event.localeCompare(b.event) || a.target.localeCompare(b.target));
    return { since, retentionDays: SITE_ANALYTICS_RETENTION_DAYS, consent: 'opt-in',
      totals: { pageviews: rows.filter(row => row.event === 'pageview').reduce((sum, row) => sum + Number(row.count), 0),
        ctaClicks: rows.filter(row => row.event === 'cta').reduce((sum, row) => sum + Number(row.count), 0),
        guestSignups: rows.filter(row => row.event === 'completion' && row.target === 'signup_success').reduce((sum, row) => sum + row.count, 0),
        firstJobMilestones: rows.filter(row => row.event === 'completion' && row.target === 'first_job_completed').reduce((sum, row) => sum + row.count, 0) },
      rows };
  });
}
