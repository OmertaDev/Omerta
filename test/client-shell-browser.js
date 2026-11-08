import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import zlib from 'node:zlib';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';
import { prepareClientShell } from '../src/client-shell.js';

if (process.env.DATABASE_URL) throw new Error('Client shell checks require the disposable database.');
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT = 'off';
process.env.CLUE_DROP_P = '0';
const reservation = net.createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
process.env.PUBLIC_URL = `http://127.0.0.1:${port}`;
delete process.env.X_CLIENT_ID;
const base = process.env.PUBLIC_URL;
const app = await buildServer();
let browser;
const call = async (method, url, token, payload) => {
  const result = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal(result.statusCode, 200, `${method} ${url}`);
  return result.json();
};
const source = fs.readFileSync('public/index.html', 'utf8').replaceAll('\r\n', '\n');
const runtime = source.match(/<script>\n(\(\(\) => \{[\s\S]*?)\n<\/script>\s*<\/body>/)[1];
const executablePath = process.env.CHROMIUM_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(fs.existsSync);
assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser.');
try {
  const landing = await app.inject('/');
  const loaderUrl = landing.body.match(/<script src="(\/landing-loader\.js\?v=[a-f0-9]+)" defer/)[1];
  const loader = await app.inject(loaderUrl);
  const config = JSON.parse(loader.body.match(/const CONFIG = (\{[^\n]+\});/)[1]);
  assert.ok(landing.rawPayload.length < Buffer.byteLength(source) * .2, 'The public HTML no longer transfers the game program.');
  const compressed = await app.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
  assert.ok(compressed.rawPayload.length < zlib.gzipSync(source).length * .2, 'Public HTML saves at least 80% of the prior compressed document.');
  assert.ok(!landing.body.includes('async function act(') && !landing.body.includes('createOmertaWorkspace?.('));
  assert.ok(!landing.body.includes('<script src="/ux-') && !landing.body.includes('rel="stylesheet" href="/ux-'));
  const code = await app.inject(config.runtime);
  assert.equal(code.body, runtime, 'The served program is exactly the reviewed canonical game source.');
  assert.equal(code.headers['cache-control'], 'no-store', 'The existing service worker must not retain an old virtual program.');
  assert.equal(loader.headers['cache-control'], 'no-store', 'A cached bootstrap must not bypass the current-version handshake.');
  const zipped = await app.inject({ url: config.runtime, headers: { 'accept-encoding': 'gzip' } });
  assert.deepEqual(zlib.gunzipSync(zipped.rawPayload), code.rawPayload);
  assert.equal((await app.inject({ url: config.runtime, headers: { 'if-none-match': code.headers.etag } })).statusCode, 304);
  assert.equal((await app.inject('/game-runtime.js?v=old-client')).statusCode, 409, 'A stale loader cannot mix runtime versions.');
  assert.equal((await app.inject('/landing-loader.js?v=old-client')).statusCode, 409);
  assert.deepEqual((await app.inject('/site-entry.json')).json(), { xOAuth: false });
  const assets = name => name.startsWith('/ux-navigation.') ? fs.readFileSync('public' + name)
    : Buffer.from(name === '/ux-quests.js' ? 'quest revision one' : 'fixed asset');
  const before = prepareClientShell(source, assets);
  const after = prepareClientShell(source, name => name === '/ux-quests.js' ? Buffer.from('quest revision two') : assets(name));
  assert.notEqual(before.loaderRevision, after.loaderRevision, 'An enhancement-only deployment invalidates the loader cache key.');
  assert.notEqual(JSON.parse(before.loader.match(/const CONFIG = (\{[^\n]+\});/)[1]).scripts.find(url => url.startsWith('/ux-quests.js')),
    JSON.parse(after.loader.match(/const CONFIG = (\{[^\n]+\});/)[1]).scripts.find(url => url.startsWith('/ux-quests.js')));

  const guest = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', guest.token, { name: 'Deferred Street' });
  await app.listen({ port, host: '127.0.0.1' });
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const initialRequests = [], gameWrites = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname; initialRequests.push(path);
    if (path.startsWith('/v1/') && request.method() !== 'GET') gameWrites.push(path);
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  const gameAssets = new Set([...config.scripts, ...config.styles].map(url => new URL(url, base).pathname));
  assert.ok(!initialRequests.includes('/game-runtime.js') && !initialRequests.some(url => gameAssets.has(url)), 'First paint requests no game scripts or styles.');
  assert.ok(!initialRequests.includes('/v1/rules'), 'Provider discovery does not transfer the full game catalog.');
  assert.equal(await page.locator('#xoauth-row').isHidden(), true, 'Unconfigured X sign-in stays hidden.');
  await page.locator('#ux-practice summary').click();
  for (const approach of ['quiet', 'standard', 'loud']) {
    await page.locator(`[data-practice="${approach}"]`).click();
    assert.match(await page.locator('.ux-practice-receipt').innerText(), /PRACTICE RECEIPT/);
    assert.match(await page.locator('.ux-practice-receipt').innerText(), /None · practice only/);
    assert.equal(await page.locator(`[data-practice="${approach}"]`).getAttribute('aria-pressed'), 'true');
  }
  assert.equal(gameWrites.length, 0, 'No-account practice remains entirely local.');
  assert.ok(!initialRequests.includes('/game-runtime.js') && !initialRequests.some(url => gameAssets.has(url)), 'Practice does not load the game or its enhancement assets.');
  await page.locator('#site-analytics-choices summary').click();
  await page.getByRole('button', { name: 'Allow counts', exact: true }).click();
  const analytics = [];
  page.on('request', request => { if (new URL(request.url()).pathname === '/site-analytics/event') analytics.push(request.postDataJSON()); });
  let attempts = 0, resume;
  const held = new Promise(resolve => { resume = resolve; });
  await page.route('**/game-runtime.js?*', async route => {
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 503, contentType: 'application/javascript', body: 'Unavailable' });
    else { await held; await route.fulfill({ status: 200, contentType: 'application/javascript', body: runtime }); }
  });
  await page.locator('#btn-guest').focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Try loading again', exact: true }).waitFor();
  assert.equal(await page.locator('#btn-guest').isDisabled(), false, 'A network failure restores entry controls.');
  assert.equal(analytics.filter(event => event.event === 'completion').length, 0, 'Failed loading creates no signup completion.');
  await page.getByRole('button', { name: 'Try loading again', exact: true }).click();
  assert.equal(await page.locator('#btn-guest').isDisabled(), true);
  resume();
  await page.locator('#age-date').waitFor();
  assert.equal(analytics.filter(event => event.target === 'guest_start').length, 1, 'A delayed physical activation is counted once after replay.');
  await page.locator('#age-date').fill('1990-01-01');
  const signup = page.waitForRequest(request => request.url().endsWith('/site-analytics/event') && request.postDataJSON().target === 'signup_success');
  await page.locator('dialog[open] button[type="submit"]').click();
  await signup; await page.locator('#screen-create:not(.hidden)').waitFor();
  assert.equal(analytics.filter(event => event.target === 'signup_success').length, 1);
  assert.equal(analytics.filter(event => event.target === 'guest_start').length, 1);
  assert.equal(await page.locator('#landing-language-controls').count(), 0, 'Core entry removes the temporary picker before mounting its own.');
  await context.close();

  async function restored(fragment = false, consent = false) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.addInitScript(({ token, fragment, consent }) => {
      if (!fragment) localStorage.setItem('omerta_token', token);
      localStorage.setItem('omerta_tour2', '1'); localStorage.setItem('omerta_welcomed', '1');
      if (consent) localStorage.setItem('omerta_site_analytics', 'accepted');
    }, { token: guest.token, fragment, consent });
    const page = await context.newPage(); const faults = [];
    page.on('pageerror', error => faults.push(error.message));
    // A temporary optional interface outage retains the core game fallback.
    if (!fragment) await page.route('**/ux-tools.js?*', route => route.fulfill({ status: 503, body: '' }));
    await page.goto(base + (fragment ? '/#token=' + encodeURIComponent(guest.token) : ''), { waitUntil: 'domcontentloaded' });
    await page.locator('#screen-main:not(.hidden)').waitFor();
    await page.locator('#tab-start .start-next-card').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('omerta_token')), guest.token);
    assert.equal(new URL(page.url()).hash, '', 'OAuth credentials are removed from browser history.');
    assert.deepEqual(faults, [], 'Late initialization retains working core game panels.');
    return { context, page };
  }
  const saved = await restored(); await saved.context.close();
  const oauth = await restored(true); await oauth.context.close();

  const restoring = await browser.newContext({ reducedMotion: 'reduce' });
  await restoring.addInitScript(token => localStorage.setItem('omerta_token', token), guest.token);
  const restoringPage = await restoring.newPage(); let continuePlayer, guestDuringRestore = 0;
  const waitingPlayer = new Promise(resolve => { continuePlayer = resolve; });
  restoringPage.on('request', request => { if (request.url().endsWith('/v1/auth/guest')) guestDuringRestore++; });
  await restoringPage.route('**/v1/projections/player', async route => { await waitingPlayer; await route.continue(); });
  await restoringPage.goto(base, { waitUntil: 'domcontentloaded' });
  await restoringPage.waitForFunction(() => window.OmertaGameReady === true);
  assert.equal(await restoringPage.locator('#btn-guest').isDisabled(), true, 'An existing session remains protected while its asynchronous player lookup is pending.');
  await restoringPage.evaluate(() => document.querySelector('#btn-guest').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.equal(guestDuringRestore, 0);
  assert.equal(await restoringPage.evaluate(() => localStorage.getItem('omerta_token')), guest.token);
  continuePlayer(); await restoringPage.locator('#screen-main:not(.hidden)').waitFor();
  assert.equal(guestDuringRestore, 0, 'Restoring a street cannot silently replace it with a new guest.'); await restoring.close();

  const delayed = await browser.newContext({ reducedMotion: 'reduce' });
  await delayed.addInitScript(token => { localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1'); localStorage.setItem('omerta_welcomed', '1'); }, guest.token);
  const delayedPage = await delayed.newPage(); let releaseOptional;
  await delayedPage.route('**/ux-coordination.js?*', async route => {
    await new Promise(resolve => { releaseOptional = resolve; }); await route.abort().catch(() => {});
  });
  await delayedPage.goto(base, { waitUntil: 'domcontentloaded' });
  await delayedPage.locator('#screen-main:not(.hidden)').waitFor({ timeout: 20000 });
  await delayedPage.locator('#tab-start .start-next-card').waitFor();
  assert.ok(releaseOptional, 'The intentional optional request was still pending when core recovery completed.');
  releaseOptional(); await delayed.close();

  const board = await call('GET', '/v1/onboard', guest.token);
  assert.equal(board.tasks.find(task => task.id === 'ob_crime').ready, false);
  const random = Math.random;
  try {
    Math.random = () => 0;
    assert.equal((await call('POST', '/v1/crimes/pick', guest.token)).success, true, 'A real successful job unlocks the account milestone.');
  } finally { Math.random = random; }
  const job = await restored(false, true), jobCounts = [];
  job.page.on('request', request => { if (request.url().endsWith('/site-analytics/event')) jobCounts.push(request.postDataJSON()); });
  const claim = job.page.locator('[data-obclaim="ob_crime"]'); await claim.waitFor();
  await claim.evaluate(button => { window.__repeatFirstClaim = button.onclick; });
  const claimed = job.page.waitForResponse(response => response.url().endsWith('/v1/onboard/ob_crime/claim'));
  const completion = job.page.waitForRequest(request => request.url().endsWith('/site-analytics/event') && request.postDataJSON().target === 'first_job_completed');
  await claim.click(); assert.equal((await claimed).status(), 200); await completion;
  await claim.waitFor({ state: 'detached' });
  const again = job.page.waitForResponse(response => response.url().endsWith('/v1/onboard/ob_crime/claim'));
  await job.page.evaluate(() => window.__repeatFirstClaim()); assert.equal((await again).status(), 400);
  assert.equal(jobCounts.filter(event => event.target === 'first_job_completed').length, 1, 'Only the successful account-once claim records a completion.');
  await job.context.close();

  const rejected = await browser.newPage({ reducedMotion: 'reduce' }), rejectedCounts = [];
  await rejected.addInitScript(() => localStorage.setItem('omerta_site_analytics', 'accepted'));
  rejected.on('request', request => { if (request.url().endsWith('/site-analytics/event')) rejectedCounts.push(request.postDataJSON()); });
  await rejected.route('**/v1/auth/guest', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Retry this signup.' }) }));
  await rejected.goto(base); await rejected.locator('#btn-guest').click();
  await rejected.locator('#age-date').fill('1990-01-01'); await rejected.locator('dialog[open] button[type="submit"]').click();
  await rejected.waitForFunction(() => document.querySelector('#guest-status').textContent === 'Retry this signup.' && !document.querySelector('#btn-guest').disabled);
  assert.equal(rejectedCounts.filter(event => event.event === 'completion').length, 0, 'A confirmed failed signup records no successful completion.');
  await rejected.close();

  const stale = await browser.newPage({ reducedMotion: 'reduce' });
  await stale.route('**/game-runtime.js?*', route => route.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"client_version_changed"}' }));
  await stale.goto(base + '/#token=' + encodeURIComponent(guest.token));
  await stale.getByRole('button', { name: 'Reload the page', exact: true }).waitFor();
  assert.ok(new URL(stale.url()).hash.includes('token='), 'Version recovery preserves a callback credential until the real program can collect it.');
  await stale.unroute('**/game-runtime.js?*');
  await stale.getByRole('button', { name: 'Reload the page', exact: true }).click();
  await stale.locator('#screen-main:not(.hidden)').waitFor();
  assert.equal(new URL(stale.url()).hash, ''); await stale.close();

  process.env.X_CLIENT_ID = 'client-shell-test';
  const signIn = await browser.newPage({ reducedMotion: 'reduce' });
  await signIn.route('**/v1/auth/x/start', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: base + '/?oauth-return=1#token=' + encodeURIComponent(guest.token) }) }));
  await signIn.goto(base); await signIn.locator('#xoauth-row:not(.hidden)').waitFor();
  await signIn.locator('#btn-xoauth').click(); await signIn.locator('#age-date').fill('1990-01-01');
  await signIn.locator('dialog[open] button[type="submit"]').click(); await signIn.locator('#screen-main:not(.hidden)').waitFor();
  assert.equal(new URL(signIn.url()).hash, '', 'Configured X entry retains the existing callback flow.'); await signIn.close();
  delete process.env.X_CLIENT_ID;

  const provider = await browser.newPage({ reducedMotion: 'reduce' });
  let providerToken;
  await provider.route('**/v1/auth/privy', route => { providerToken = route.request().postDataJSON().token; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: guest.token }) }); });
  await provider.goto(base); await provider.locator('#token-signin > summary').click();
  await provider.locator('#auth-provider').selectOption('privy'); await provider.locator('#auth-token').fill('synthetic-provider-token');
  await provider.locator('#btn-provider').click(); await provider.locator('#age-date').fill('1990-01-01');
  await provider.locator('dialog[open] button[type="submit"]').click(); await provider.locator('#screen-main:not(.hidden)').waitFor();
  assert.equal(providerToken, 'synthetic-provider-token', 'Deferred initialization preserves an explicitly entered provider token.'); await provider.close();

  const wallet = await browser.newPage({ reducedMotion: 'reduce' });
  await wallet.goto(base); await wallet.locator('#btn-wallet-onboard').click(); await wallet.locator('#age-date').waitFor();
  assert.equal(await wallet.evaluate(() => sessionStorage.getItem('omerta-wallet-onboarding')), '1');
  await wallet.locator('#age-cancel').click(); await wallet.close();

  const broken = await browser.newPage({ reducedMotion: 'reduce' });
  broken.on('pageerror', () => {}); let brokenLoads = 0;
  await broken.route('**/game-runtime.js?*', route => { brokenLoads++; return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'throw new Error("Intentional initialization failure")' }); });
  await broken.goto(base); await broken.locator('#btn-guest').click();
  await broken.getByRole('button', { name: 'Reload the page', exact: true }).waitFor();
  assert.equal(brokenLoads, 1, 'A partial initialization offers a reload instead of evaluating the game twice.');
  await broken.close();

  const noLoader = await browser.newPage({ reducedMotion: 'reduce' });
  await noLoader.route('**/landing-loader.js?*', route => route.abort());
  await noLoader.goto(base); await noLoader.locator('#client-load-failure:not([hidden])').waitFor();
  await noLoader.unroute('**/landing-loader.js?*');
  await noLoader.locator('#client-load-failure button').click();
  await noLoader.waitForFunction(() => window.OmertaLandingReady === true);
  assert.equal(await noLoader.locator('#client-load-failure').isHidden(), true, 'A failed bootstrap has a visible, working reload recovery.');
  await noLoader.close();

  const installed = await browser.newContext({ reducedMotion: 'reduce' });
  const installedPage = await installed.newPage();
  await installedPage.goto(base + '/wiki', { waitUntil: 'networkidle' });
  await installedPage.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await installedPage.waitForFunction(() => !!navigator.serviceWorker.controller);
  await installedPage.evaluate(async () => {
    const name = (await caches.keys()).find(key => key.startsWith('omerta-shell-'));
    if (!name) throw new Error('The installed app shell cache is required.');
    const cache = await caches.open(name);
    await cache.put('/site-analytics.js', new Response('window.OmertaSiteAnalytics = { stale: true };',
      { headers: { 'content-type': 'application/javascript' } }));
  });
  await installedPage.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await installedPage.evaluate(() => window.OmertaSiteAnalytics?.stale), undefined);
  assert.equal(await installedPage.evaluate(() => typeof window.OmertaSiteAnalytics?.firstJobResult), 'function',
    'An installed visitor receives current analytics despite the old cache-first script.');
  assert.match(await installedPage.locator('script[src^="/site-analytics.js"]').getAttribute('src'), /\?v=[a-f0-9]{16}$/);
  assert.match(await installedPage.evaluate(async () => (await caches.match('/site-analytics.js')).text()), /stale: true/,
    'The content version bypasses the old entry without purging unrelated installed assets.');
  await installed.close();
  console.log(`Client shell: ${compressed.rawPayload.length} compressed HTML bytes; deferred assets, exact runtime, version/retry recovery, actual signup/job counts and saved/OAuth/provider/wallet entry passed.`);
} finally { await browser?.close(); await app.close(); }
