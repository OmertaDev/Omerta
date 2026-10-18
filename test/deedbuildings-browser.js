// Focused real-server browser proof for the permanent property atlas.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';

assert(!process.env.DATABASE_URL, 'Property atlas browser proof requires disposable pg-mem');
const browserRoots = [process.env.PLAYWRIGHT_BROWSERS_PATH,
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
  process.env.HOME && path.join(process.env.HOME, '.cache', 'ms-playwright')].filter(Boolean);
const candidates = process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [chromium.executablePath()];
if (!process.env.CHROMIUM_PATH) {
  for (const browserRoot of browserRoots) {
    if (!fs.existsSync(browserRoot)) continue;
    for (const name of fs.readdirSync(browserRoot).filter(name => name.startsWith('chromium')).sort().reverse())
      for (const relative of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome',
        'chrome-linux64/chrome', 'chrome-headless-shell-win64/headless_shell.exe',
        'chrome-linux/headless_shell', 'chrome-headless-shell-linux64/headless_shell'])
        candidates.push(path.join(browserRoot, name, relative));
  }
  candidates.push('/usr/bin/chromium', '/usr/bin/google-chrome');
}
const executablePath = candidates.find(candidate => candidate && fs.existsSync(candidate));
assert(executablePath, 'Set CHROMIUM_PATH to a Chromium executable');
process.env.INVITE_MODE = 'off';
process.env.RATE_LIMIT = 'off';
delete process.env.CHARACTER_DEED_CUSTODY_ADDRESS;
const app = await buildServer();
let browser, page;
const deedTraffic = [];
try {
  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
  const token = guest.json().token;
  const headers = { authorization: 'Bearer ' + token };
  assert.equal((await app.inject({ method: 'POST', url: '/v1/character', headers,
    payload: { name: 'Building Browser' } })).statusCode, 200);
  const characterId = (await app.inject({ method: 'GET', url: '/v1/me', headers })).json().character.id;
  await app.pool.query("UPDATE characters SET respect=500000,energy=50,cash=5000,loc='docks' WHERE id=$1", [characterId]);
  const accountId = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1', [characterId])).rows[0].account_id;
  assert.equal((await app.inject({ method: 'GET', url: '/v1/deeds/buildings', headers })).json().buildings.length,
    2500, 'all 2500 permanent buildings are available from the first release');
  await app.listen({ host: '127.0.0.1', port: 0 });
  browser = await chromium.launch({ executablePath, headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  page.on('response', async response => {
    if (!new URL(response.url()).pathname.startsWith('/v1/deeds')) return;
    const request = response.request();
    deedTraffic.push({ method: request.method(), path: new URL(response.url()).pathname,
      status: response.status(), request: request.postDataJSON(),
      ...(request.method() === 'POST' ? { body: await response.json().then(({ character, ...body }) => body).catch(() => null) } : {}) });
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(playerToken => {
    localStorage.setItem('omerta_token', playerToken);
    localStorage.setItem('omerta_tour2', '1');
  }, token);
  await page.goto('http://127.0.0.1:' + app.server.address().port, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-main:not(.hidden)');
  await page.locator('[data-tab="deeds"]').first().evaluate(element => element.click());
  await page.locator('#deed-atlas-open').click();
  await page.locator('#deed-atlas svg').waitFor();
  const properties = page.locator('#deed-atlas g[data-property]');
  assert.equal(await properties.count(), 417, 'the browser reads only the chosen district, without downloading all 2500 properties');
  await properties.first().focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#deed-property-detail').textContent(), /docks-0001/);
  assert.equal(await page.locator('#deed-property-claim').count(), 0, 'Map selection alone cannot claim a deed');
  for (let step = 1; step <= 4; step++) {
    if (step > 1) await page.locator('#deed-objective-travel').click();
    await page.locator('#deed-investigate').click();
    await page.waitForFunction(expected => document.querySelector('#deed-property-detail')?.textContent
      .includes('Investigation ' + expected + '/4'), step);
  }
  assert.deepEqual(deedTraffic.filter(row => row.method === 'POST' && row.path === '/v1/deeds/investigate')
    .map(row => row.request.actionId), ['inspect-site', 'verify-registry', 'question-witness', 'secure-title'],
    'The UI follows four distinct server-issued objectives rather than repeating a generic investigation.');
  await page.locator('#deed-property-name').fill('Browser House');
  // A pointer at the card's lower edge must not keep its nested claim control moving.
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => {
    const card = document.querySelector('#deed-property-claim')?.closest('.card');
    return card && !card.matches(':hover') && getComputedStyle(card).transform === 'none';
  });
  const cardBoundary = await page.locator('#deed-property-claim').evaluate(claim => {
    const card = claim.closest('.card');
    if (!card?.closest('#tab-deeds') || !card.contains(claim))
      throw new Error('The earned claim must be inside the Deeds property card');
    card.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const rect = card.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.bottom - 0.5;
    const hit = document.elementFromPoint(x, y);
    if (x <= 0 || x >= innerWidth || y <= 0 || y >= innerHeight || !card.contains(hit))
      throw new Error('The property card lower boundary must be visible and receive the pointer: ' + JSON.stringify({
        card: { id: card.id, className: card.className }, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        point: { x, y }, viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
        hit: hit && { tag: hit.tagName, id: hit.id, className: hit.className }
      }));
    return { x, y };
  });
  await page.mouse.move(cardBoundary.x, cardBoundary.y);
  const [claimResponse] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/v1/deeds/claim'
      && response.request().method() === 'POST'),
    page.locator('#deed-property-claim').click({ delay: 450 }),
  ]);
  assert.equal((await claimResponse).status(), 200, 'The earned claim reaches the real server.');
  assert.equal((await app.pool.query('SELECT name FROM street_deeds WHERE account_id=$1 AND building_id=$2',
    [accountId, 'docks-0001'])).rows[0]?.name, 'Browser House');
  await page.locator('[data-tab="deeds"]').first().evaluate(element => element.click());
  await page.locator('#deed-atlas-open').click();
  await page.locator('[data-property="docks-0001"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#deed-property-detail')?.textContent.includes('Already claimed: Browser House'));
  await properties.nth(1).focus();
  await page.keyboard.press(' ');
  assert.match(await page.locator('#deed-property-detail').textContent(), /docks-0002/);
  assert.match(await page.locator('#deed-atlas').textContent(), /already used its lifetime discovery claim/);
  assert.deepEqual(errors, []);
  if (process.env.DEED_BUILDING_SHOT) await page.locator('#deed-atlas svg').screenshot({ path: process.env.DEED_BUILDING_SHOT });
  console.log('Property atlas browser: all 2500 available, bounded map, four distinct objectives with real district travel, exact-building claim, lifetime limit and keyboard inspection passed.');
} catch (error) {
  console.error('Deed browser failure evidence:', JSON.stringify({ traffic: deedTraffic.slice(-16),
    dom: page && await page.evaluate(() => ({ detail: document.querySelector('#deed-property-detail')?.textContent,
      name: document.querySelector('#deed-property-name')?.value, tab: document.querySelector('.tab.on')?.id,
      deeds: document.querySelector('#tab-deeds')?.textContent.slice(0, 1200),
      receipt: document.querySelector('#resp')?.textContent.slice(-1800) })).catch(() => null) }));
  throw error;
} finally {
  if (browser) await browser.close();
  await app.close();
}
