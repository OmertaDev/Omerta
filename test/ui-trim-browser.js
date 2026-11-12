import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';
assert(!process.env.DATABASE_URL, 'UI trim requires disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';
const executablePath = process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(fs.existsSync);
assert(executablePath, 'Set CHROMIUM_PATH to installed Chromium.');
const app = await buildServer(); let browser;
const artifacts = process.env.UI_TRIM_ARTIFACTS || path.resolve('output/ui-trim');
fs.mkdirSync(artifacts, { recursive: true });
const api = async (method, url, token, payload) => { const r = await app.inject({ method, url, payload, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...(method === 'POST' ? { 'idempotency-key': randomUUID() } : {}) } }); assert.equal(r.statusCode, 200, `${url}: ${r.body}`); return r.json(); };
const jump = async (page, tab) => { await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill(tab); await page.locator(`#jump-list [data-jump="${tab}"]`).first().click(); await page.locator(`#tab-${tab}.on`).waitFor(); await page.waitForFunction(tab => !document.querySelector(`#tab-${tab}`)?.querySelector('[aria-busy="true"]'), tab); await page.waitForTimeout(500); await page.mouse.move(0, 0); await page.keyboard.press('Escape'); };
try {
  const { token } = await api('POST', '/v1/auth/guest'); await api('POST', '/v1/character', token, { name: 'UI Trim Reader' });
  await app.pool.query('UPDATE characters SET respect=10000,cash=200000,energy=100,nerve=40 WHERE name=$1', ['UI Trim Reader']);
  await app.listen({ host: '127.0.0.1', port: 0 });
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(token => { localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1'); localStorage.setItem('omerta_welcomed', '1'); localStorage.setItem('omerta_alltabs', '1'); }, token);
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + app.server.address().port); await page.locator('#screen-main:not(.hidden)').waitFor();
  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(node => node.classList.add('hidden')));
  await jump(page, 'life');
  assert.deepEqual(await page.evaluate(() => ({ description: document.querySelectorAll('.noir-screen-description').length, introduction: document.querySelectorAll('.intro-card').length })), { description: 0, introduction: 0 }, 'A first visit goes directly to the game, without duplicated instructions');
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const tab of ['start', 'streets', 'garage', 'life', 'profile', 'port', 'law', 'pen', 'city', 'map', 'empire', 'family', 'loans', 'store', 'portfolio']) {
      await jump(page, tab);
      if (['start', 'streets', 'life'].includes(tab)) await page.screenshot({ path: path.join(artifacts, `${viewport.width}-${tab}.png`) });
      assert.equal(await page.locator('.noir-screen-description,.intro-card').count(), 0, 'Screen instructions do not return during navigation');
      assert.ok((await page.locator('#noir-screen-heading h2').innerText()).trim(), 'The existing screen heading keeps its identity');
      assert.equal(await page.locator('#noir-screen-heading .noir-codex-link').getAttribute('href'), '/wiki', 'Reference help remains available');
      assert.equal(await page.locator('[data-ux-tactics]').count(), 0, 'Planning Table is absent from the game');
      assert.equal(await page.locator('#ux-session-endpoint').count(), 0, 'Session coaching is absent');
      assert.equal(await page.locator('#tab-start .ux-world-panel,#tab-profile .ux-world-panel,#tab-life .ux-world-panel').count(), 0, 'Personal city panels are absent');
      assert.doesNotMatch(await page.locator(`#tab-${tab}`).innerText(), /planning table|a good place to pause|your place in the city/i);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, `${tab} fits ${viewport.width}px`);
    }
    await jump(page, 'streets');
    const help = page.getByRole('link', { name: 'The Codex', exact: true }); await help.focus();
    assert.equal(await help.evaluate(node => node === document.activeElement), true, 'Reference help remains keyboard-accessible during play');
    await jump(page, 'start');
  }
  assert.equal(await page.locator('script[src*="ux-tactics.js"],link[href*="ux-tactics.css"]').count(), 0, 'Retired planning UI is not downloaded');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await jump(page, 'life');
  assert.equal(await page.locator('.noir-screen-description,.intro-card').count(), 0, 'Refreshing does not restore instructions');
  assert.deepEqual(errors, []);
  console.log('UI trim: desktop/mobile navigation, repeat visits, panel absence and browser errors PASS. Screenshots: ' + artifacts);
} finally { await browser?.close(); await app.close(); }
