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
async function openDirectory(page) {
  if (await page.locator('#city-directory').getAttribute('open') === null)
    await page.locator('#city-directory > summary').click();
}
async function aboveFold(page, selector, label) {
  const position = await page.locator(selector).evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: innerHeight };
  });
  assert.ok(position.top >= 0 && position.bottom <= position.height, `${label} is below the fold: ${JSON.stringify(position)}`);
}

async function reachableCrimePocket(page, label) {
  // Let the existing, finite menu notification expire. Never hide an overlay to pass hit tests.
  await page.waitForFunction(() => !document.querySelector('#toast.show'));
  const geometry = await page.locator('#ux-action-pocket').evaluate(pocket => {
    const bounds = element => {
      const r = element.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const terms = pocket.querySelector('.operation-action-terms');
    return {
      pocket: bounds(pocket),
      terms: { ...bounds(terms), lineHeight: parseFloat(getComputedStyle(terms).lineHeight), text: terms.textContent },
      buttons: [...pocket.querySelectorAll('.verbrow button')].map(button => {
        const rect = bounds(button);
        const clip = { top: 0, bottom: innerHeight, left: 0, right: innerWidth };
        for (let ancestor = button.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const r = ancestor.getBoundingClientRect(), style = getComputedStyle(ancestor);
          if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
            clip.left = Math.max(clip.left, r.left + ancestor.clientLeft);
            clip.right = Math.min(clip.right, r.left + ancestor.clientLeft + ancestor.clientWidth);
          }
          if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
            clip.top = Math.max(clip.top, r.top + ancestor.clientTop);
            clip.bottom = Math.min(clip.bottom, r.top + ancestor.clientTop + ancestor.clientHeight);
          }
        }
        const points = [[rect.left + 3, rect.top + 3], [rect.right - 3, rect.top + 3],
          [rect.left + 3, rect.bottom - 3], [rect.right - 3, rect.bottom - 3],
          [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2]];
        return { text: button.textContent, ...rect,
          unclipped: rect.top >= clip.top && rect.bottom <= clip.bottom && rect.left >= clip.left && rect.right <= clip.right,
          hit: points.every(([x, y]) => button.contains(document.elementFromPoint(x, y))) };
      }),
    };
  });
  assert.equal(geometry.buttons.length, 4, `${label}: all three approaches and optional preparation remain available`);
  for (const button of geometry.buttons) {
    assert.ok(button.width >= 44 && button.height >= 44, `${label}: 44px touch target: ${JSON.stringify(button)}`);
    assert.ok(button.unclipped && button.hit, `${label}: action is clipped or covered: ${JSON.stringify(button)}`);
  }
  assert.ok(geometry.terms.height >= 3 * geometry.terms.lineHeight,
    `${label}: costs and risks need at least three readable lines, not a scroll sliver: ${JSON.stringify(geometry.terms)}`);
  assert.match(geometry.terms.text, /COST.*BASELINE WIN[\s\S]*QUIET[\s\S]*STANDARD[\s\S]*LOUD/);
  fs.writeFileSync(path.join(artifacts, `shell-pocket-${label.replace(/[^a-z0-9]+/gi, '-')}.json`), JSON.stringify(geometry, null, 2));
  return geometry;
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
  assert.equal(await page.locator('#city-directory[open]').count(), 0, 'the complete directory starts collapsed beside the five main destinations');
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

  await openDirectory(page);
  await page.locator('#city-sidebar #tabs [data-tab="start"]').focus();
  await page.keyboard.press('ArrowDown');
  await page.locator('#tab-streets.on').waitFor();
  assert.equal(await page.locator('#city-sidebar #tabs [data-tab="streets"]').evaluate(element => element === document.activeElement), true,
    'vertical navigation follows ArrowDown and retains keyboard focus');
  await openTab(page, 'start');
  await page.locator('#tab-start .start-next-card').waitFor();
  await page.locator('#city-directory > summary').click();

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
  await openDirectory(page);
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
  await openDirectory(page);
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
  await reachableCrimePocket(page, 'mobile crime pocket');
  await aboveFold(page, '#tab-streets #ux-action-pocket [data-do^="POST /v1/crimes/"][data-body*=standard]:enabled', 'mobile crime action');
  assert.equal(await page.locator('#ux-action-pocket .operation-action-terms').count(), 1, 'the mobile action retains its live cost and risk terms');
  await noOverflow(page, 'mobile Streets');
  await page.screenshot({ path: path.join(artifacts, 'shell-streets-mobile.png') });

  const crimeRequests = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/v1/crimes/')) crimeRequests.push(request.url());
  });
  const pocketViewports = [{ width: 390, height: 844 }, { width: 320, height: 568 },
    { width: 568, height: 320 }, { width: 480, height: 320 },
    { width: 760, height: 360 }, { width: 320, height: 568 }];
  for (const [rotation, viewport] of pocketViewports.entries()) {
    await page.setViewportSize(viewport);
    await reachableCrimePocket(page, `${viewport.width}x${viewport.height} rotation ${rotation}`);
    for (let visit = 0; visit < 2; visit++) {
      await openTab(page, 'start');
      await openTab(page, 'streets');
      const label = `${viewport.width}x${viewport.height} rotation ${rotation} visit ${visit + 1}`;
      await page.locator('#ux-action-pocket [data-task-crime]').waitFor();
      await reachableCrimePocket(page, label);
      await noOverflow(page, label);
      const terms = page.locator('#ux-action-pocket .operation-action-terms');
      // Wide landscape may already show every term; scroll only real overflow.
      if (await terms.evaluate(element => element.scrollHeight > element.clientHeight)) {
        await terms.hover();
        await page.mouse.wheel(0, 500);
        await page.waitForFunction(() => {
          const terms = document.querySelector('#ux-action-pocket .operation-action-terms');
          return terms.scrollTop > 0 && terms.scrollTop + terms.clientHeight >= terms.scrollHeight - 1;
        });
        await reachableCrimePocket(page, `${label} after reading all terms`);
        await page.mouse.wheel(0, -500);
        await page.waitForFunction(() => document.querySelector('#ux-action-pocket .operation-action-terms').scrollTop === 0);
      }
      const prepare = page.locator('#ux-action-pocket [data-task-crime]');
      await prepare.focus();
      assert.equal(await prepare.evaluate(element => element === document.activeElement), true, `${label}: keyboard focus reaches preparation`);
      await page.keyboard.press('Enter');
      const puzzle = page.getByRole('dialog', { name: /Task puzzle/ });
      await puzzle.getByRole('button', { name: 'Solve and attempt crime' }).waitFor();
      await page.keyboard.press('Escape');
      await puzzle.waitFor({ state: 'detached' });
      assert.equal(await prepare.evaluate(element => element === document.activeElement), true, `${label}: closing restores preparation focus`);
      await reachableCrimePocket(page, `${label} after puzzle dismissal`);
      assert.equal(crimeRequests.length, 0, 'Opening and closing optional preparation never attempts the crime');
      await page.screenshot({ path: path.join(artifacts, `shell-pocket-${viewport.width}-${viewport.height}-${rotation}-${visit + 1}.png`) });
    }
  }

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
  const primary = page.locator('#ux-action-pocket [data-do^="POST /v1/crimes/"][data-body*=standard]:enabled');
  await primary.focus();
  assert.equal(await primary.evaluate(element => element === document.activeElement), true, 'The ordinary crime remains keyboard reachable after repeated preparation and navigation');
  const ordinaryAttempt = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname.startsWith('/v1/crimes/'));
  await page.keyboard.press('Enter');
  assert.equal((await ordinaryAttempt).status(), 200, 'Keyboard activation reaches the real ordinary crime endpoint');
  assert.equal(crimeRequests.length, 1, 'One keyboard activation attempts exactly one ordinary crime');
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
