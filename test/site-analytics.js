import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import { newDb } from 'pg-mem';
import { Pool as NativePool } from 'pg';
import { chromium } from 'playwright-core';
import { registerSiteAnalytics } from '../src/site-analytics.js';

const native = process.argv.includes('--postgres');
assert.deepEqual(process.argv.slice(2), native ? ['--postgres'] : [], 'Only the optional --postgres mode is supported');
const schema = fs.readFileSync('schema.sql', 'utf8').match(/CREATE TABLE IF NOT EXISTS telemetry \([\s\S]*?\n\);/)[0];
let adminPool, schemaName, pool;
if (native) {
  assert.notEqual(process.env.NODE_ENV, 'production', 'Native analytics proof refuses the production environment');
  assert(!process.env.DATABASE_URL, 'Native analytics proof refuses an ambient application database');
  assert(process.env.SITE_ANALYTICS_TEST_DATABASE_URL, 'Explicit SITE_ANALYTICS_TEST_DATABASE_URL is required');
  const endpoint = new URL(process.env.SITE_ANALYTICS_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(endpoint.protocol)
    && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
  assert(!endpoint.searchParams.has('options'), 'The test owns its isolated schema search path');
  schemaName = `site_analytics_test_${crypto.randomBytes(8).toString('hex')}`;
  assert(/^site_analytics_test_[a-f0-9]{16}$/.test(schemaName));
  adminPool = new NativePool({ connectionString: endpoint.toString(), connectionTimeoutMillis: 10000, query_timeout: 30000 });
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  pool = new NativePool({ connectionString: endpoint.toString(), options: `-c search_path=${schemaName},pg_catalog`,
    max: 8, connectionTimeoutMillis: 10000, query_timeout: 30000 });
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schemaName);
} else {
  const { Pool } = newDb().adapters.createPg();
  pool = new Pool();
}
await pool.query(schema);
const previousRate = process.env.RATE_LIMIT;
process.env.RATE_LIMIT = 'off';
const reservation = net.createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const baseUrl = `http://127.0.0.1:${port}`;
const app = Fastify();
const requests = [];
app.addHook('onRequest', async req => {
  if (req.url === '/site-analytics/event') requests.push({ headers: req.headers });
});
registerSiteAnalytics(app, { pool, baseUrl, modAuth: async (req, reply) => {
  if (req.headers['x-mod-key'] !== 'test-analytics-key') return reply.code(401).send({ error: 'unauthorized' });
} });
app.get('/site-analytics.js', (_req, reply) => reply.type('application/javascript').send(fs.readFileSync('public/site-analytics.js', 'utf8')));
for (const path of ['/', '/wiki', '/privacy']) app.get(path, (_req, reply) => reply.type('text/html').send(
  '<!doctype html><html lang="en"><head><title>Analytics fixture</title></head><body><main><button id="btn-guest">Play as guest</button><a href="/wiki?private=do-not-store">Codex</a></main><footer></footer><script defer src="/site-analytics.js"></script></body></html>'));
const post = (payload, headers = {}) => app.inject({ method: 'POST', url: '/site-analytics/event',
  headers: { origin: baseUrl, ...headers }, payload });
const view = { consent: true, page: '/', event: 'pageview' };
let browser;
try {
  assert.equal((await app.inject('/v1/mod/site-analytics')).statusCode, 401, 'aggregate reports require moderator access');
  for (const payload of [
    { page: '/', event: 'pageview' }, { ...view, consent: false },
    { ...view, page: '/?ref=private' }, { ...view, accountId: 'private' },
    { ...view, target: '/wiki' }, { ...view, event: 'cta', target: 'https://external.test' },
    { ...view, event: 'cta', target: '/wiki?ref=private' },
  ]) assert.equal((await post(payload)).statusCode, 400, 'unconsented events and unrestricted dimensions are rejected');
  assert.equal((await post(view, { origin: 'https://evil.test' })).statusCode, 403);
  assert.equal((await post(view, { origin: 'null' })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/site-analytics/event', payload: view })).statusCode, 403);
  assert.equal((await post(view, { 'sec-fetch-site': 'cross-site' })).statusCode, 403);
  assert.equal((await post(view, { dnt: '1' })).statusCode, 204);
  assert.equal((await post(view, { 'sec-gpc': '1' })).statusCode, 204);
  assert.equal((await pool.query('SELECT * FROM telemetry')).rows.length, 0, 'invalid requests and privacy signals store no analytics');
  const concurrentEvents = native ? 64 : 7;
  const responses = await Promise.all(Array.from({ length: concurrentEvents }, () => post(view)));
  assert(responses.every(response => response.statusCode === 204), 'every concurrent event is accepted');
  assert.equal((await post({ consent: true, page: '/', event: 'cta', target: '/wiki' })).statusCode, 204);
  const report = await app.inject({ url: '/v1/mod/site-analytics', headers: { 'x-mod-key': 'test-analytics-key' } });
  assert.equal(report.statusCode, 200);
  assert.match(report.headers['cache-control'], /private.*no-store/);
  assert.deepEqual(report.json().totals, { pageviews: concurrentEvents, ctaClicks: 1 }, 'concurrent events increment aggregate counters without lost updates');
  assert.equal(report.json().rows.length, 2, 'repeated events retain only daily aggregate rows');
  assert.deepEqual(Object.keys(report.json().rows[0]).sort(), ['count', 'day', 'event', 'page', 'target']);
  const storedCounters = (await pool.query('SELECT * FROM telemetry')).rows;
  assert.equal(storedCounters.length, 2, 'one namespaced row stores each daily aggregate, not each event');
  const today = new Date().toISOString().slice(0, 10);
  const viewId = 'website_count:' + JSON.stringify([today, '/', 'pageview', '']);
  const viewCounter = storedCounters.find(row => row.id === viewId);
  assert.equal(viewCounter.event, 'website_count');
  assert.equal(viewCounter.account_id, null, 'aggregate rows cannot be associated with an account');
  assert.equal(viewCounter.props, String(concurrentEvents), 'props contains only the numeric JSON counter');
  assert.equal(new Date(viewCounter.at).toISOString(), `${today}T00:00:00.000Z`, 'counter timestamps have daily precision');
  const since = report.json().since;
  const oldDay = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  for (const [id, at, account, props] of [
    ['website_count:invalid-json', `${today}T00:00:00.000Z`, null, '1'],
    ['website_count:' + JSON.stringify([today, '/private-account', 'pageview', '']), `${today}T00:00:00.000Z`, null, '1'],
    ['website_count:' + JSON.stringify([today, '/sale', 'pageview', '']), `${today}T00:00:00.000Z`, 'must-not-report', '1'],
    ['website_count:' + JSON.stringify([today, '/play', 'pageview', '']), `${today}T00:00:00.000Z`, null, '{"private":"must-not-report"}'],
    ['website_count:' + JSON.stringify([oldDay, '/', 'pageview', '']), `${oldDay}T00:00:00.000Z`, null, '5'],
  ]) await pool.query("INSERT INTO telemetry (id,at,account_id,event,props) VALUES ($1,$2,$3,'website_count',$4)", [id, new Date(at), account, props]);
  const filtered = (await app.inject({ url: '/v1/mod/site-analytics', headers: { 'x-mod-key': 'test-analytics-key' } })).json();
  assert.deepEqual(filtered.totals, report.json().totals, 'out-of-window, account-linked and malformed records are excluded');
  assert.equal(filtered.since, since, 'report includes the current UTC date and previous 89 dates');
  const aliasApp = Fastify();
  registerSiteAnalytics(aliasApp, { pool, baseUrl: 'https://omerta.fun', modAuth: async () => {} });
  try {
    for (const origin of ['https://omerta.fun', 'https://www.omerta.fun']) {
      const response = await aliasApp.inject({ method: 'POST', url: '/site-analytics/event', headers: { origin }, payload: view });
      assert.equal(response.statusCode, 204, 'both explicit HTTPS production aliases work');
    }
    for (const origin of ['http://www.omerta.fun', 'https://preview.omerta.fun', 'https://www.omerta.fun:444', 'https://evil.test']) {
      const response = await aliasApp.inject({ method: 'POST', url: '/site-analytics/event', headers: { origin }, payload: view });
      assert.equal(response.statusCode, 403, 'other schemes, subdomains, ports and hosts remain denied');
    }
  } finally { await aliasApp.close(); }
  await pool.query('DELETE FROM telemetry');
  requests.length = 0;
  if (!native) {
  await app.listen({ port, host: '127.0.0.1' });
  const executablePath = process.env.CHROMIUM_PATH || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ].find(fs.existsSync);
  assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser.');
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 320, height: 568 } });
  await context.addCookies([{ name: 'unrelated_account_cookie', value: 'must-not-send', url: baseUrl }]);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/?private=do-not-store`);
  await page.locator('#site-analytics-choices').waitFor();
  assert.equal(await page.locator('#site-analytics-choices').getAttribute('open'), null, 'privacy control is collapsed by default');
  assert.equal(requests.length, 0, 'default preference makes no analytics requests');
  await page.locator('#site-analytics-choices summary').click();
  const accepted = page.waitForResponse(response => response.url().endsWith('/site-analytics/event'));
  await page.getByRole('button', { name: 'Allow counts' }).click();
  assert.equal((await accepted).status(), 204);
  assert.equal(requests[0].headers.cookie, undefined, 'analytics requests omit account cookies');
  assert.equal(requests[0].headers.referer, undefined, 'analytics requests omit the referring URL');
  const guestClick = page.waitForResponse(response => response.url().endsWith('/site-analytics/event'));
  await page.getByRole('button', { name: 'Play as guest' }).click();
  assert.equal((await guestClick).status(), 204);
  const guestCounterId = 'website_count:' + JSON.stringify([today, '/', 'cta', 'guest_start']);
  assert.equal((await pool.query('SELECT props FROM telemetry WHERE id=$1', [guestCounterId])).rows[0].props, '1',
    'the primary guest button is included without collecting account or signup details');
  const clicked = page.waitForResponse(response => response.url().endsWith('/site-analytics/event'));
  await page.getByRole('link', { name: 'Codex', exact: true }).click();
  assert.equal((await clicked).status(), 204);
  await page.waitForURL('**/wiki?private=do-not-store');
  await page.locator('#site-analytics-choices').waitFor();
  await page.locator('#site-analytics-choices summary').click();
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  const before = requests.length;
  await page.reload();
  await page.locator('#site-analytics-choices').waitFor();
  assert.equal(requests.length, before, 'declining persists and stops future analytics');
  for (const signal of ['globalPrivacyControl', 'doNotTrack']) {
    const privateContext = await browser.newContext();
    await privateContext.addInitScript(name => {
      localStorage.setItem('omerta_site_analytics', 'accepted');
      Object.defineProperty(navigator, name, { value: name === 'globalPrivacyControl' ? true : '1' });
    }, signal);
    const privatePage = await privateContext.newPage();
    const start = requests.length;
    await privatePage.goto(baseUrl);
    await privatePage.locator('#site-analytics-choices').waitFor();
    await privatePage.locator('#site-analytics-choices summary').click();
    assert.equal(await privatePage.getByRole('button', { name: 'Allow counts' }).isDisabled(), true);
    assert.equal(requests.length, start, `${signal} suppresses requests despite a prior opt-in`);
    await privateContext.close();
  }
  const stored = (await pool.query('SELECT * FROM telemetry')).rows;
  assert(!JSON.stringify(stored).includes('do-not-store'), 'query strings never enter analytics storage');
  }
  console.log(`site-analytics${native ? ' (native PostgreSQL)' : ''}: PASS — opt-in, same-origin aliases, GPC/DNT, credential-free${native ? '' : ' browser'} requests, atomic daily counters and moderator-only reports`);
} finally {
  await browser?.close();
  await app.close();
  await pool.end();
  if (schemaName) {
    assert(/^site_analytics_test_[a-f0-9]{16}$/.test(schemaName), 'cleanup remains confined to the generated test schema');
    await adminPool.query(`DROP SCHEMA ${schemaName} CASCADE`);
    await adminPool.end();
  }
  if (previousRate === undefined) delete process.env.RATE_LIMIT;
  else process.env.RATE_LIMIT = previousRate;
}
