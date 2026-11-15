// Exercise the production crime controls and server, including the losing path.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';

assert(!process.env.DATABASE_URL, 'Crime browser verification uses disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off'; process.env.CLUE_DROP_P = '0';
const executablePath = process.env.CHROMIUM_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(candidate => fs.existsSync(candidate));
assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium.');
const app = await buildServer();
let browser;
const originalRandom = Math.random;
const api = async (method, url, token, payload) => {
  const response = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal(response.statusCode, 200, `${url}: ${response.body}`);
  return response.json();
};
try {
  const { token } = await api('POST', '/v1/auth/guest');
  await api('POST', '/v1/character', token, { name: 'Lock Browser Player' });
  const ch = (await app.pool.query("SELECT * FROM characters WHERE name='Lock Browser Player'")).rows[0];
  const reset = () => app.pool.query('UPDATE characters SET nerve=100,cunning=200,speed=200,jail_until=NULL,street_action_at=NULL,last_accrued_at=$2 WHERE id=$1', [ch.id, new Date()]);
  await reset();
  await app.listen({ host: '127.0.0.1', port: 0 });
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true, serviceWorkers: 'block' });
  await context.addInitScript(value => {
    localStorage.setItem('omerta_token', value); localStorage.setItem('omerta_tour2', '1');
    localStorage.setItem('omerta_welcomed', '1');
  }, token);
  const page = await context.newPage(), errors = [], attempts = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && /\/v1\/crimes\/[^/?]+$/.test(new URL(request.url()).pathname)) attempts.push(request.postDataJSON());
  });
  const openStreets = async () => {
    await page.goto(`http://127.0.0.1:${app.server.address().port}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#screen-main:not(.hidden)').waitFor();
    await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(node => node.classList.add('hidden')));
    await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill('streets');
    await page.locator('#jump-list [data-jump="streets"]').first().click();
    await page.locator('#tab-streets .noir-job-card .prime:enabled').first().waitFor();
  };
  const job = () => page.locator('#tab-streets .noir-job-card .prime:enabled').first();
  const dialog = page.locator('dialog.crime-minigame');
  const values = () => dialog.locator('[data-crime-sequence] [data-crime-value]').evaluateAll(nodes => nodes.map(node => Number(node.dataset.crimeValue)));
  const snapshot = async () => {
    const row = (await app.pool.query('SELECT nerve,cash,street_action_at FROM characters WHERE id=$1', [ch.id])).rows[0];
    return { nerve: Number(row.nerve), cash: Number(row.cash), street: row.street_action_at };
  };
  await openStreets();
  const before = await snapshot();
  const selectedJob = await job().getAttribute('data-do');
  await page.locator(`#tab-streets .prime[data-do="${selectedJob}"]`).click(); await dialog.locator('[data-crime-begin]').waitFor();
  assert.equal(attempts.length, 0, 'Opening the required minigame cannot commit the crime.');
  assert.deepEqual(await snapshot(), before, 'Loading a lock spends no nerve or cash.');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  assert.equal(attempts.length, 0, 'Backing out cannot bypass the minigame.');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-do')), selectedJob, 'Cancellation restores focus to the selected crime control.');

  await job().click(); await dialog.locator('[data-crime-begin]').waitFor();
  await page.setViewportSize({ width: 320, height: 720 });
  assert(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'The lock fits a narrow touch viewport.');
  const bounds = await dialog.evaluate(node => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom, viewport: innerHeight, scrollTop: node.scrollTop, height: node.clientHeight, maxHeight: getComputedStyle(node).maxHeight, position: getComputedStyle(node).position }));
  assert(bounds.top >= 0 && bounds.bottom <= bounds.viewport, `The entire lock dialog stays within the viewport: ${JSON.stringify(bounds)}`);
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-crime-lock-'));
  await page.screenshot({ path: path.join(artifacts, 'lock-mobile.png') });
  const response = page.waitForResponse(reply => reply.request().method() === 'POST' && /\/v1\/crimes\/[^/?]+$/.test(new URL(reply.url()).pathname));
  const expectedMoves = [];
  for (let round = 0; round < 3; round++) {
    await dialog.locator('[data-crime-begin]').waitFor({ state: 'visible' });
    const sequence = await values();
    await dialog.locator('[data-crime-begin]').click();
    assert.equal(await values().then(list => list.length), 0, 'The signal is concealed during input.');
    if (!round) {
      const wrong = (sequence[0] + 1) % 4; expectedMoves.push(wrong);
      await page.keyboard.press(String(wrong + 1));
      assert.match(await dialog.locator('[role="status"]').innerText(), /Wrong pin/);
      assert.match(await dialog.locator('.crime-lock-alarm').innerText(), /85%/);
    }
    for (const value of sequence) {
      expectedMoves.push(value);
      if (!round) await page.keyboard.press(String(value + 1));
      else await dialog.locator(`[data-crime-pad="${value}"]`).tap();
    }
  }
  const completed = await (await response).json();
  assert.equal(completed.minigame.completed, true); assert.equal(completed.minigame.mistakes, 1);
  assert.equal(completed.minigame.multiplier, .85);
  assert.deepEqual(attempts[0].minigame.moves, expectedMoves, 'The actual interactive trace reaches settlement.');
  assert(completed.character.streetActionSeconds > 0);
  await dialog.waitFor({ state: 'hidden' });

  await reset(); await openStreets();
  await job().click(); await dialog.locator('[data-crime-begin]').waitFor();
  const first = (await values())[0];
  await dialog.locator('[data-crime-begin]').click();
  const lostResponse = page.waitForResponse(reply => reply.request().method() === 'POST' && /\/v1\/crimes\/[^/?]+$/.test(new URL(reply.url()).pathname));
  Math.random = () => .001;
  for (let strike = 0; strike < 3; strike++) await dialog.locator(`[data-crime-pad="${(first + 1) % 4}"]`).tap();
  const lost = await (await lostResponse).json();
  Math.random = originalRandom;
  assert.equal(lost.success, false, 'A failed minigame loses even with a favorable crime roll.');
  assert.equal(lost.successChance, 0); assert.equal(lost.minigame.mistakes, 3);
  assert.equal(attempts.length, 2, 'Every terminal minigame commits exactly one crime.');
  assert.deepEqual(errors, []);
  console.log(`crime minigame browser: required flow, cancellation, focus, concealed signals, keyboard/touch, mistakes, actual settlement, failure and mobile fit passed; screenshot: ${path.join(artifacts, 'lock-mobile.png')}`);
} finally { Math.random = originalRandom; if (browser) await browser.close(); await app.close(); }
