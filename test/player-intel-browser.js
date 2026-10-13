// Real UI clicks against an isolated in-process database and a separate headless browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';
import { readPlayerIntel } from '../src/playerintel.js';

if (process.env.DATABASE_URL) throw new Error('Player intel browser test requires disposable pg-mem; clear DATABASE_URL.');
function resolveBrowser() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const caches = [...new Set([
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
    process.env.HOME && path.join(process.env.HOME, '.cache', 'ms-playwright'),
  ].filter(Boolean))];
  for (const cache of caches) {
    let versions;
    try { versions = fs.readdirSync(cache).filter((entry) => entry.startsWith('chromium')).sort().reverse(); }
    catch { continue; }
    for (const version of versions) for (const relative of [
      'chrome-win64/chrome.exe', 'chrome-win/chrome.exe',
      'chrome-headless-shell-win64/headless_shell.exe', 'chrome-headless-shell-win/headless_shell.exe',
      'chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-linux/headless_shell',
      'chrome-headless-shell-linux64/headless_shell',
      'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    ]) {
      const candidate = path.join(cache, version, relative);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ].find((candidate) => fs.existsSync(candidate));
}
const executablePath = resolveBrowser();
if (!executablePath || !fs.existsSync(executablePath))
  throw new Error('Player intel browser test cannot find Chromium; set CHROMIUM_PATH to an installed executable.');

const app = await buildServer();
const pool = app.pool;
let browser;
const call = async (method, url, token, body) => {
  const response = await app.inject({ method, url,
    headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });
  assert.equal(response.statusCode, 200, `${method} ${url} failed (${response.statusCode})`);
  return response.json();
};
const create = async (name) => {
  const { token } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', token, { name });
  const { character } = await call('GET', '/v1/me', token);
  const ch = (await pool.query('SELECT * FROM characters WHERE id=$1', [character.id])).rows[0];
  return { token, ch };
};
const pageErrors = [];
const authenticate = async (player, base) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
  await context.addInitScript((token) => {
    localStorage.setItem('omerta_token', token);
    localStorage.setItem('omerta_tour2', '1');
    localStorage.setItem('omerta_welcomed', '1');
    localStorage.setItem('omerta_alltabs', '1');
  }, player.token);
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('#screen-main:not(.hidden)').waitFor();
  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)')
    .forEach((modal) => modal.classList.add('hidden')));
  return page;
};
const wetWork = async (page) => {
  await page.locator('#grouprail [data-group="blood"]').click();
  await page.locator('#tabs [data-tab="pvp"]').click();
  await page.locator('#tab-pvp h2').filter({ hasText: 'People you know' }).waitFor();
};

try {
  const witness = await create('Browser Intel Witness');
  const recipient = await create('Browser Intel Recipient');
  const mark = await create('Browser Intel Mark');
  const remote = await create('Browser Intel Hidden');
  await pool.query('UPDATE characters SET loc=$1 WHERE id=$2', ['canal', remote.ch.id]);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await authenticate(witness, base);
  await wetWork(page);
  let panelText = await page.locator('#tab-pvp').innerText();
  assert(!panelText.includes(remote.ch.name), 'Wet Work must not expose an undiscovered remote player');
  assert(!panelText.includes(mark.ch.name), 'a nearby stranger remains anonymous before introduction');
  assert(panelText.includes('Unfamiliar player'), 'the screen offers an anonymous local introduction');

  let received = page.waitForResponse((response) => response.url().endsWith(`/v1/streets/${mark.ch.id}/meet`)
    && response.request().method() === 'POST');
  await page.locator(`[data-meet="${mark.ch.id}"]`).click();
  assert.equal((await received).status(), 200, 'introduce-yourself click completes the meeting');
  await page.locator('#tab-pvp .card').filter({ hasText: mark.ch.name }).waitFor();
  const sighting = await readPlayerIntel(pool, witness.ch.account_id, mark.ch.id);
  assert(sighting?.observedAt, 'the introduction stores the date of the sighting');
  assert.equal(sighting.loc, 'docks');
  const markCard = page.locator('#tab-pvp .card').filter({ hasText: mark.ch.name });
  assert((await markCard.innerText()).includes('last seen in docks'));
  const renderedTime = await page.evaluate((observedAt) => new Date(observedAt).toLocaleString(), sighting.observedAt);
  assert((await markCard.innerText()).includes(renderedTime), 'the known-player card displays its dated sighting');

  received = page.waitForResponse((response) => response.url().endsWith(`/v1/streets/${recipient.ch.id}/meet`)
    && response.request().method() === 'POST');
  await page.locator(`[data-meet="${recipient.ch.id}"]`).click();
  assert.equal((await received).status(), 200);
  await page.locator('#tab-pvp .card').filter({ hasText: recipient.ch.name }).waitFor();
  await pool.query('UPDATE characters SET loc=$1 WHERE id=$2', ['neon', mark.ch.id]);
  assert.equal(await readPlayerIntel(pool, recipient.ch.account_id, mark.ch.id), null,
    'the recipient has not met the gossip target');

  await page.locator('#btn-phone').click();
  await page.locator('#phone:not(.hidden) #ph-intel-share').waitFor();
  assert((await page.locator('#phone').innerText()).includes('PASS A WORD'), 'phone exposes the gossip flow');
  await page.locator('#ph-intel-about').selectOption(mark.ch.id);
  await page.locator('#ph-intel-to').selectOption(recipient.ch.id);
  received = page.waitForResponse((response) => response.url().endsWith(`/v1/intel/share/${recipient.ch.id}`)
    && response.request().method() === 'POST');
  await page.locator('#ph-intel-share').click();
  assert.equal((await received).status(), 200, 'share-what-you-know click reaches the gossip endpoint');
  const gossip = await readPlayerIntel(pool, recipient.ch.account_id, mark.ch.id);
  assert.equal(gossip.source, 'gossip');
  assert.equal(gossip.sourceName, witness.ch.name);
  assert.equal(gossip.loc, 'docks', 'the share button passes recorded facts rather than the target live location');
  assert.equal(new Date(gossip.observedAt).getTime(), new Date(sighting.observedAt).getTime());

  const recipientPage = await authenticate(recipient, base);
  await wetWork(recipientPage);
  const receivedCard = recipientPage.locator('#tab-pvp .card').filter({ hasText: mark.ch.name });
  await receivedCard.waitFor();
  const receivedText = await receivedCard.innerText();
  assert(receivedText.includes('last seen in docks'));
  assert(receivedText.includes(`heard from ${witness.ch.name}`));
  assert(!receivedText.includes('last seen in neon'));
  assert.deepEqual(pageErrors, [], 'the new UI flow has no unhandled browser errors');
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-player-intel-'));
  const screenshot = path.join(artifacts, 'received-gossip.png');
  await recipientPage.locator('#tab-pvp').screenshot({ path: screenshot });
  console.log(`player intel browser: anonymous introduction, dated sighting and phone gossip passed; screenshot ${screenshot}`);
} finally {
  await browser?.close();
  await app.close();
  await pool.end();
}
