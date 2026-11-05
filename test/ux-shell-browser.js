// Real-page navigation and onboarding checks against a disposable database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';

if (process.env.DATABASE_URL) throw new Error('Shell browser integration requires the disposable in-memory database.');
const executablePath = process.env.CHROMIUM_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(fs.existsSync);
assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser.');
const app = await buildServer();
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-ux-shell-'));
const faults = [];
let browser;
let page;

async function call(method, url, token, payload) {
  const response = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal(response.statusCode, 200, `${method} ${url}`);
  return response.json();
}
async function openTab(page, tab) {
  await page.locator('#btn-jump').click();
  await page.locator('#jump-q').fill(tab);
  await page.locator(`#jump-list [data-jump="${tab}"]`).first().click();
  await page.locator(`#tab-${tab}.on`).waitFor();
  await page.locator(`#tab-${tab} [data-feel-loading]`).waitFor({ state: 'hidden' });
}
async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(size.scroll <= size.width + 2, `${label} overflows: ${JSON.stringify(size)}`);
}
async function aboveFold(page, selector, label) {
  const position = await page.locator(selector).evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: innerHeight };
  });
  assert.ok(position.top >= 0 && position.bottom <= position.height, `${label} is below the fold: ${JSON.stringify(position)}`);
}

try {
  const { token } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', token, { name: 'Shell First Job' });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'en-US' });
  await context.addInitScript(value => {
    localStorage.setItem('omerta_token', value);
    localStorage.setItem('omerta_tour2', '1');
    localStorage.setItem('omerta_welcomed', '1');
  }, token);
  page = await context.newPage();
  page.on('pageerror', error => faults.push(error.message));
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type()) && /UI .*unavailable|UI enhancement unavailable|renderSheet failed/.test(message.text())) faults.push(message.text());
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('#screen-main:not(.hidden)').waitFor();
  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(modal => modal.classList.add('hidden')));
  await openTab(page, 'start');
  await page.locator('#tab-start .start-next-card').waitFor();
  await page.screenshot({ path: path.join(artifacts, 'shell-desktop-initial.png') });
  console.log(`Screenshots: ${artifacts}`);

  assert.equal(await page.locator('#city-sidebar #grouprail').count(), 1, 'the original group navigation lives in the sidebar');
  assert.equal(await page.locator('#city-sidebar #tabs').count(), 1, 'the original operation controls remain one accessible copy');
  assert.equal(await page.locator('#tabpanel #coachwrap').count(), 1, 'next action belongs beside the operation');
  assert.equal(await page.locator('#game-menu[open]').count(), 0, 'secondary utilities start closed');
  assert.equal(await page.locator('#ux-screen-tools[open]').count(), 0, 'workspace controls do not precede gameplay by default');
  assert.equal(await page.locator('#city-directory[open]').count(), 1, 'desktop navigation remains visible');
  assert.equal(await page.locator('#game-menu #btn-logout').count(), 1, 'account controls remain available in the utility menu');
  await aboveFold(page, '#tab-start .start-next-card .act', 'desktop first-week action');
  const onboardingOrder = await page.evaluate(() => {
    const first = document.querySelector('#tab-start .start-first-week');
    const secondary = document.querySelector('#tab-start details[data-sect="start-outreach"]');
    return !!first && !!secondary && !!(first.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  assert.equal(onboardingOrder, true, 'the first playable task precedes recruitment');
  assert.equal(await page.locator('#tab-start details[data-sect="start-outreach"][open]').count(), 0, 'recruitment starts disclosed');
  assert.equal(await page.locator('#tab-start details[data-sect="start-mint"][open]').count(), 0, 'mint onboarding starts disclosed');
  await noOverflow(page, 'desktop Start Here');
  await page.screenshot({ path: path.join(artifacts, 'shell-desktop.png') });

  await page.locator('#city-sidebar #tabs [data-tab="start"]').focus();
  await page.keyboard.press('ArrowDown');
  await page.locator('#tab-streets.on').waitFor();
  assert.equal(await page.locator('#city-sidebar #tabs [data-tab="streets"]').evaluate(element => element === document.activeElement), true,
    'vertical navigation follows ArrowDown and retains keyboard focus');
  await openTab(page, 'start');
  await page.locator('#tab-start .start-next-card').waitFor();

  const menu = page.locator('#game-menu > summary');
  await menu.click();
  await page.locator('#game-menu #btn-logout').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#game-menu[open]').count(), 0, 'Escape closes the utility menu');
  assert.equal(await menu.evaluate(element => element === document.activeElement), true, 'Escape returns focus to the menu summary');

  const feed = page.locator('#city-feed-toggle');
  assert.equal(await feed.getAttribute('aria-expanded'), 'false', 'the city feed starts collapsed');
  await feed.click();
  await page.locator('#wirepanel').waitFor({ state: 'visible' });
  assert.equal(await feed.getAttribute('aria-expanded'), 'true');
  await feed.click();
  await page.locator('#wirepanel').waitFor({ state: 'hidden' });

  await feed.click();
  await menu.click();
  await page.locator('#wirepanel').waitFor({ state: 'hidden' });
  assert.equal(await feed.getAttribute('aria-expanded'), 'false', 'opening the utility menu closes the wire');
  await page.keyboard.press('Escape');
  await feed.click();
  await page.keyboard.press('Escape');
  await page.locator('#wirepanel').waitFor({ state: 'hidden' });
  assert.equal(await feed.evaluate(element => element === document.activeElement), true, 'Escape closes the wire and restores focus');

  await page.locator('#ux-screen-tools > summary').click();
  await page.locator('[data-ux-focus]').click();
  assert.equal(await page.locator('[data-ux-focus]').getAttribute('aria-pressed'), 'true');
  await feed.click();
  await page.locator('#wirepanel').waitFor({ state: 'visible' });
  await noOverflow(page, 'focused operation with wire');
  await page.keyboard.press('Escape');
  await page.locator('[data-ux-focus]').click();
  await page.locator('#ux-screen-tools > summary').click();

  // Secondary onboarding remains useful after a live server refresh.
  await page.locator('#tab-start details[data-sect="start-outreach"] > summary').click();
  await page.locator('#ref-claim-name').fill('Unsent referral draft');
  await page.locator('#character-sheet > summary').click();
  const sheetRefreshed = page.waitForResponse(response => [`${base}/v1/me`, `${base}/v1/projections/player`].includes(response.url()) && response.status() === 200);
  await page.locator('#btn-refresh').click();
  await sheetRefreshed;
  const refreshed = page.waitForResponse(response => response.url() === `${base}/v1/home` && response.status() === 200);
  // Returning to a visible city tab uses the same full board refresh as live events.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await refreshed;
  await page.waitForFunction(() => document.querySelector('#ref-claim-name')?.value === 'Unsent referral draft'
    && document.querySelector('#tab-start details[data-sect="start-outreach"]')?.open);
  assert.equal(await page.locator('#ref-claim-name').inputValue(), 'Unsent referral draft', 'refresh preserves the unsent referral');

  await openTab(page, 'streets');
  await page.locator('#tab-streets [data-do^="POST /v1/crimes/"]:enabled').first().waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  const standardCrime = '#tab-streets [data-do^="POST /v1/crimes/"][data-body*=standard]:enabled';
  await aboveFold(page, `${standardCrime} >> nth=0`, 'desktop crime action');
  await noOverflow(page, 'desktop Streets');
  await page.screenshot({ path: path.join(artifacts, 'shell-streets-desktop.png') });
  await page.locator('#tabs-more').click();
  assert.ok(await page.locator('#grouprail [data-group]:visible').count() >= 8, 'the whole city exposes every navigation group');
  await page.locator('#grouprail [data-group="earners"]').click();
  await page.locator('#tab-kitchen.on').waitFor();
  // Search retains access to infrequent screens throughout the navigation.
  await openTab(page, 'portfolio');
  await openTab(page, 'start');
  await page.locator('#tab-start .start-next-card').waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => !document.querySelector('#city-directory')?.open);
  await aboveFold(page, '#tab-start .start-next-card .act', 'mobile first-week action');
  await noOverflow(page, 'mobile Start Here');
  await page.screenshot({ path: path.join(artifacts, 'shell-mobile.png') });
  await menu.click();
  await page.locator('#game-menu #btn-logout').waitFor({ state: 'visible' });
  await noOverflow(page, 'mobile utility menu');
  await page.keyboard.press('Escape');
  await page.locator('#city-directory > summary').click();
  await page.locator('#grouprail [data-group="streets"]').click();
  await page.locator('#tab-streets.on').waitFor();
  assert.equal(await page.locator('#city-directory[open]').count(), 0, 'choosing a mobile destination closes the city directory');
  await page.locator('#bnav [data-go="streets"]').click();
  await page.locator('#tab-streets.on').waitFor();
  await page.locator('#tab-streets [data-do^="POST /v1/crimes/"]:enabled').first().waitFor();
  await page.locator('#tab-streets #ux-action-pocket [data-do^="POST /v1/crimes/"][data-body*=standard]:enabled').waitFor();
  await aboveFold(page, '#tab-streets #ux-action-pocket [data-do^="POST /v1/crimes/"][data-body*=standard]:enabled', 'mobile crime action');
  assert.equal(await page.locator('#ux-action-pocket .operation-action-terms').count(), 1, 'the mobile action retains its live cost and risk terms');
  await noOverflow(page, 'mobile Streets');
  await page.screenshot({ path: path.join(artifacts, 'shell-streets-mobile.png') });

  const firstSession = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await firstSession.addInitScript(value => localStorage.setItem('omerta_token', value), token);
  const freshPage = await firstSession.newPage();
  freshPage.on('pageerror', error => faults.push(error.message));
  await freshPage.goto(base, { waitUntil: 'domcontentloaded' });
  await freshPage.locator('#tab-start.on .start-next-card').waitFor();
  await freshPage.locator('#tab-start [data-feel-loading]').waitFor({ state: 'hidden' });
  assert.equal(await freshPage.locator('#welcome').isVisible(), false, 'a fresh player reaches gameplay without a mandatory tour');
  await aboveFold(freshPage, '#tab-start .start-next-card .act', 'fresh mobile first-week action');
  await noOverflow(freshPage, 'fresh mobile onboarding');
  await freshPage.screenshot({ path: path.join(artifacts, 'shell-first-session.png') });
  assert.deepEqual(faults, [], 'the redesigned shell introduces no runtime failures');
  console.log('ux-shell-browser: PASS (focused onboarding, desktop/mobile navigation, utilities, feed, refresh, full city access)');
  console.log(`Screenshots: ${artifacts}`);
} catch (error) {
  if (page) {
    await page.screenshot({ path: path.join(artifacts, 'shell-failure.png') }).catch(() => {});
    console.log(`Failure screenshots: ${artifacts}`);
    console.log('Shell geometry:', await page.evaluate(() => Object.fromEntries(['top', 'vitals', 'city-sidebar', 'tabpanel', 'coachwrap', 'coach-go', 'tabbodies'].map(id => {
      const element = document.getElementById(id), rect = element?.getBoundingClientRect();
      return [id, rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null];
    }))).catch(() => null));
  }
  throw error;
} finally {
  await browser?.close();
  await app.close();
}
