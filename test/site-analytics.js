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
let signupStatus = 503, claimStatus = 409;
app.post('/fixture-signup', (_req, reply) => reply.code(signupStatus).send(signupStatus === 200
  ? { token: 'private-fixture-token' } : { error: 'unavailable' }));
app.post('/fixture-first-job', (_req, reply) => reply.code(claimStatus).send(claimStatus === 200
  ? { ok: true, task: 'ob_crime', taskName: 'Pull your first job', cash: 500, cb: 0, en: 10, capstone: false } : { ok: false, error: 'claimed' }));
for (const path of ['/', '/wiki', '/privacy']) app.get(path, (_req, reply) => reply.type('text/html').send(
  '<!doctype html><html lang="en"><head><title>Analytics fixture</title></head><body><main><button id="btn-guest">Play as guest</button><button id="fixture-job">Claim first-job reward</button><a href="/wiki?private=do-not-store">Codex</a></main><footer></footer><script defer src="/site-analytics.js"></script><script>'
  + 'document.querySelector("#btn-guest").onclick=async()=>{const response=await fetch("/fixture-signup",{method:"POST"});window.OmertaSiteAnalytics.signupResult({code:response.status,body:await response.json()});};'
  + 'document.querySelector("#fixture-job").onclick=async()=>{const response=await fetch("/fixture-first-job",{method:"POST"});window.OmertaSiteAnalytics.firstJobResult("POST","/v1/onboard/ob_crime/claim",{code:response.status,body:await response.json()});};'
  + '</script></body></html>'));
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
    { ...view, event: 'completion', target: 'unknown_step' },
    { ...view, page: '/wiki', event: 'completion', target: 'signup_success' },
    { ...view, event: 'cta', target: 'signup_success' },
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
  for (const target of ['signup_success', 'first_job_completed'])
    assert.equal((await post({ consent: true, page: '/', event: 'completion', target })).statusCode, 204);
  const report = await app.inject({ url: '/v1/mod/site-analytics', headers: { 'x-mod-key': 'test-analytics-key' } });
  assert.equal(report.statusCode, 200);
  assert.match(report.headers['cache-control'], /private.*no-store/);
  assert.deepEqual(report.json().totals, { pageviews: concurrentEvents, ctaClicks: 1, guestSignups: 1, firstJobMilestones: 1 }, 'concurrent events increment aggregate counters without lost updates');
  assert.equal(report.json().rows.length, 4, 'repeated events retain only daily aggregate rows');
  assert.deepEqual(Object.keys(report.json().rows[0]).sort(), ['count', 'day', 'event', 'page', 'target']);
  const storedCounters = (await pool.query('SELECT * FROM telemetry')).rows;
  assert.equal(storedCounters.length, 4, 'one namespaced row stores each daily aggregate, not each event');
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
    ['website_count:' + JSON.stringify([today, '/', 'completion', 'private-step']), `${today}T00:00:00.000Z`, null, '5'],
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
  await page.evaluate(() => {
    window.OmertaSiteAnalytics.signupResult({ code: 200, body: { token: 'private-fixture-token' } });
    window.OmertaSiteAnalytics.firstJobResult('POST', '/v1/onboard/ob_crime/claim', { code: 200, body: { ok: true, task: 'ob_crime' } });
  });
  assert.equal(requests.length, 0, 'confirmed onboarding responses do not bypass the default opt-out');
  await page.locator('#site-analytics-choices summary').click();
  const accepted = page.waitForResponse(response => response.url().endsWith('/site-analytics/event'));
  await page.getByRole('button', { name: 'Allow counts' }).click();
  assert.equal((await accepted).status(), 204);
  assert.equal(requests[0].headers.cookie, undefined, 'analytics requests omit account cookies');
  assert.equal(requests[0].headers.referer, undefined, 'analytics requests omit the referring URL');
  const guestClick = page.waitForResponse(response => response.url().endsWith('/site-analytics/event'));
  const failedSignup = page.waitForResponse(response => response.url().endsWith('/fixture-signup'));
  await page.getByRole('button', { name: 'Play as guest' }).click();
  assert.equal((await guestClick).status(), 204);
  assert.equal((await failedSignup).status(), 503);
  const guestCounterId = 'website_count:' + JSON.stringify([today, '/', 'cta', 'guest_start']);
  assert.equal((await pool.query('SELECT props FROM telemetry WHERE id=$1', [guestCounterId])).rows[0].props, '1',
    'the primary guest button is included without collecting account or signup details');
  const completionId = target => 'website_count:' + JSON.stringify([today, '/', 'completion', target]);
  assert.equal((await pool.query('SELECT props FROM telemetry WHERE id=$1', [completionId('signup_success')])).rows.length, 0,
    'a rejected guest signup cannot count as a completed signup');
  signupStatus = 200;
  const completedSignup = page.waitForResponse(response => response.url().endsWith('/site-analytics/event')
    && response.request().postDataJSON().target === 'signup_success');
  await page.getByRole('button', { name: 'Play as guest' }).click();
  assert.equal((await completedSignup).status(), 204);
  assert.equal((await pool.query('SELECT props FROM telemetry WHERE id=$1', [completionId('signup_success')])).rows[0].props, '1');
  const failedClaim = page.waitForResponse(response => response.url().endsWith('/fixture-first-job'));
  await page.getByRole('button', { name: 'Claim first-job reward' }).click();
  assert.equal((await failedClaim).status(), 409);
  assert.equal((await pool.query('SELECT props FROM telemetry WHERE id=$1', [completionId('first_job_completed')])).rows.length, 0,
    'an unavailable or already claimed milestone cannot count as completion');
  claimStatus = 200;
  const completedJob = page.waitForResponse(response => response.url().endsWith('/site-analytics/event')
    && response.request().postDataJSON().target === 'first_job_completed');
  await page.getByRole('button', { name: 'Claim first-job reward' }).click();
  assert.equal((await completedJob).status(), 204);
  const beforeRefusals = requests.length;
  const refused = await page.evaluate(() => [
    window.OmertaSiteAnalytics.signupResult({ code: 503, body: { token: 'private-fixture-token' } }),
    window.OmertaSiteAnalytics.signupResult({ code: 200, body: {} }),
    window.OmertaSiteAnalytics.signupResult({ code: 200, ignored: true, body: { token: 'private-fixture-token' } }),
    window.OmertaSiteAnalytics.signupResult({ code: 200, replayed: true, body: { token: 'private-fixture-token' } }),
    window.OmertaSiteAnalytics.firstJobResult('POST', '/v1/crimes/pick', { code: 200, body: { ok: true, success: true } }),
    window.OmertaSiteAnalytics.firstJobResult('POST', '/v1/onboard/ob_crime', { code: 200, body: { ok: true, task: 'ob_crime' } }),
    window.OmertaSiteAnalytics.firstJobResult('GET', '/v1/onboard/ob_crime/claim', { code: 200, body: { ok: true, task: 'ob_crime' } }),
    window.OmertaSiteAnalytics.firstJobResult('POST', '/v1/onboard/ob_crime/claim', { code: 200, body: { ok: false } }),
    window.OmertaSiteAnalytics.firstJobResult('POST', '/v1/onboard/ob_crime/claim', { code: 200, body: { ok: true } }),
    window.OmertaSiteAnalytics.firstJobResult('POST', '/v1/onboard/ob_crime/claim', { code: 200, body: { ok: true, task: 'ob_boost' } }),
    window.OmertaSiteAnalytics.firstJobResult('POST', '/v1/onboard/ob_crime/claim', { code: 200, body: { ok: true, task: 'ob_crime', replayed: true } }),
  ]);
  assert(refused.every(value => value === false));
  assert.equal(requests.length, beforeRefusals, 'failures, stale responses, repeats and unrelated actions never count as completions');
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
    await privatePage.evaluate(() => {
      window.OmertaSiteAnalytics.signupResult({ code: 200, body: { token: 'private-fixture-token' } });
      window.OmertaSiteAnalytics.firstJobResult('POST', '/v1/onboard/ob_crime/claim', { code: 200, body: { ok: true, task: 'ob_crime' } });
    });
    assert.equal(await privatePage.getByRole('button', { name: 'Allow counts' }).isDisabled(), true);
    assert.equal(requests.length, start, `${signal} suppresses requests despite a prior opt-in`);
    await privateContext.close();
  }
  const stored = (await pool.query('SELECT * FROM telemetry')).rows;
  assert(!JSON.stringify(stored).includes('do-not-store'), 'query strings never enter analytics storage');
  assert(!JSON.stringify(stored).includes('private-fixture-token'), 'successful response credentials never enter analytics storage');
  assert(requests.every(request => request.headers.cookie === undefined && request.headers.referer === undefined),
    'completion and navigation requests all omit account cookies and referring URLs');
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
