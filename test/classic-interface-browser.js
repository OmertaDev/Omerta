// Real-server regression for the classic interface and its onboarding entry points.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';

assert(!process.env.DATABASE_URL, 'Classic interface checks require disposable pg-mem.');
process.env.INVITE_MODE = 'off';
process.env.RATE_LIMIT = 'off';
const candidates = process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [chromium.executablePath()];
if (!process.env.CHROMIUM_PATH) {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
    process.env.HOME && path.join(process.env.HOME, '.cache', 'ms-playwright')].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root).filter(name => name.startsWith('chromium')).sort().reverse())
      for (const relative of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome',
        'chrome-linux64/chrome', 'chrome-headless-shell-win64/headless_shell.exe',
        'chrome-linux/headless_shell', 'chrome-headless-shell-linux64/headless_shell'])
        candidates.push(path.join(root, name, relative));
  }
  candidates.push('C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome');
}
const executablePath = candidates.find(candidate => candidate && fs.existsSync(candidate));
assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium executable.');
const shots = process.env.CLASSIC_INTERFACE_SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });

const app = await buildServer();
let browser, currentPage, failureState;
const errors = [], visualRequests = [], completed = [];
try {
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ executablePath, headless: true });
  const createPlayer = async name => {
    const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });
    assert.equal(guest.statusCode, 200);
    const token = guest.json().token, headers = { authorization: 'Bearer ' + token };
    const created = await app.inject({ method: 'POST', url: '/v1/character', headers, payload: { name } });
    assert.equal(created.statusCode, 200, created.body);
    return token;
  };
  const assertClassic = async (page, phone) => {
    for (const selector of ['#leftcol', '#tabs', '#grouprail', ...(phone ? ['#bnav'] : [])])
      assert(await page.locator(selector).isVisible(), selector + ' remains available in the classic interface');
    assert.equal(await page.locator('#player-view-switch, #city-actions, #city-panel, #city-scene-host, #map-mode-walk, #map-mode-territory, #tab-map canvas').count(),
      0, 'The classic interface has no visual city launcher, HUD, mount, or canvas.');
    assert.deepEqual(await page.evaluate(() => ({
      player: document.body.classList.contains('city-player-view'),
      panel: document.body.classList.contains('city-panel-open'),
      scene: !!window.OmertaCityScene, worldUI: !!window.OmertaCityWorldUI, phaser: !!window.Phaser,
    })), { player: false, panel: false, scene: false, worldUI: false, phaser: false });
    assert.deepEqual(visualRequests, [], 'No visual city runtime or styles are imported.');
  };
  const jump = async (page, id, recent = false) => {
    await page.locator('#btn-jump').click();
    if (!recent) await page.locator('#jump-q').fill(id);
    await page.locator('#jump-list [data-jump="' + id + '"]').click();
    await page.locator('#tab-' + id + '.on').waitFor({ state: 'visible' });
  };
  const openMap = async (page, recent = false) => {
    const [response] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === '/v1/map'
        && response.request().method() === 'GET'),
      jump(page, 'map', recent),
    ]);
    assert.equal(response.status(), 200);
    const { districts } = await response.json();
    assert(districts.length > 0, 'The real map endpoint supplies districts.');
    const board = page.locator('#map-territory-board');
    await board.waitFor({ state: 'visible' });
    await page.waitForFunction(count => document.querySelectorAll('#map-territory-board > .grid > .card').length === count, districts.length);
    assert.deepEqual(await board.locator(':scope > .grid > .card > .t').allTextContents(),
      districts.map(district => district.name), 'Every server district is displayed as a classic card.');
    assert.match(await board.textContent(), /Who holds the city/);
  };
  const load = async page => {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('#screen-main:not(.hidden)').waitFor({ state: 'visible' });
  };

  for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 375, height: 812 }]]) {
    const phone = label === 'phone';
    for (const firstRun of [false, true]) {
      const token = await createPlayer('Classic ' + label + (firstRun ? ' new' : ' old'));
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block',
        isMobile: phone, hasTouch: phone });
      try {
        // The test may contact only its disposable local server.
        await context.route('**/*', route => new URL(route.request().url()).origin === base
          ? route.continue() : route.abort());
        await context.addInitScript(({ token, firstRun }) => {
          localStorage.setItem('omerta_token', token);
          localStorage.setItem('omerta_alltabs', '1');
          localStorage.setItem('omerta_recent_tabs', JSON.stringify(['map', 'streets']));
          if (firstRun) localStorage.removeItem('omerta_tour2');
          else localStorage.setItem('omerta_tour2', '1');
        }, { token, firstRun });
        const page = currentPage = await context.newPage();
        page.setDefaultTimeout(15000);
        page.on('pageerror', error => errors.push(label + ': ' + error.message));
        page.on('request', request => {
          if (/^\/(?:city-scene\.(?:js|css)|city-world-ui\.(?:js|css)|city-world-layout\.js|vendor\/phaser\.js)$/.test(new URL(request.url()).pathname))
            visualRequests.push(request.url());
        });
        await load(page);
        if (firstRun) {
          await page.locator('#welcome:not(.hidden)').waitFor({ state: 'visible' });
          await page.locator('#tour-skip').click();
          await page.locator('#tab-streets.on').waitFor({ state: 'visible' });
          await assertClassic(page, phone);
          await load(page);
          await page.locator('#welcome:not(.hidden)').waitFor({ state: 'visible' });
          const steps = await page.locator('#tour-dots i').count();
          assert(steps > 0 && steps <= 10, 'The first-run tour has a bounded number of steps.');
          for (let step = 0; step < steps; step++) await page.locator('#tour-next').click();
          await page.locator('#welcome').waitFor({ state: 'hidden' });
          await page.locator('#tab-streets.on').waitFor({ state: 'visible' });
          await assertClassic(page, phone);
          completed.push(label + ': first-run skip and completion open Streets');
        } else {
          if (await page.locator('.modal-bg[data-managed-dialog]').count()) await page.keyboard.press('Escape');
          await jump(page, 'streets');
          await assertClassic(page, phone);
          await openMap(page, true);
          await assertClassic(page, phone);
          await jump(page, 'profile');
          await assertClassic(page, phone);
          await page.locator('#btn-help').click();
          await page.locator('#glossary-tour').click();
          await page.locator('#tour-skip').click();
          await page.locator('#welcome').waitFor({ state: 'hidden' });
          await page.locator('#tab-profile.on').waitFor({ state: 'visible' });
          await assertClassic(page, phone);
          await load(page);
          if (await page.locator('.modal-bg[data-managed-dialog]').count()) await page.keyboard.press('Escape');
          await openMap(page, true);
          await assertClassic(page, phone);
          if (shots) await page.screenshot({ path: path.join(shots, label + '.png') });
          completed.push(label + ': Streets, sidebar, navigation, district cards, returning map preference, and replay close');
        }
        assert.deepEqual(errors, [], 'The real interface runs without browser errors.');
      } catch (error) {
        failureState = currentPage && await currentPage.evaluate(() => ({ tab: document.querySelector('.tab.on')?.id,
          dialogs: [...document.querySelectorAll('.modal-bg:not(.hidden)')].map(node => node.id),
          bodyClass: document.body.className, map: document.querySelector('#tab-map')?.textContent.slice(0, 1200) })).catch(() => null);
        throw error;
      } finally { await context.close(); currentPage = null; }
    }
  }
  console.log('Classic interface browser passed:', JSON.stringify(completed));
} catch (error) {
  console.error('Classic interface failure evidence:', JSON.stringify({ completed, errors, visualRequests, page: failureState }));
  throw error;
} finally {
  if (browser) await browser.close();
  await app.close();
}
