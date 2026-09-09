// Run with a locally installed Chromium browser; all accounts and codes are disposable pg-mem data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';
process.env.INVITE_MODE = 'on'; process.env.RATE_LIMIT = 'off';
const app = await buildServer();
await app.pool.query("INSERT INTO invite_codes (code, uses_left) VALUES ('BROWSER-TEST-ONLY',1)");
const origin = await app.listen({ port: 0, host: '127.0.0.1' });
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });
const output = path.resolve('output/launch-invite-gate'); fs.mkdirSync(output, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin + '/?ref=GateTester#invite=BROWSER-TEST-ONLY', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#invite-code').inputValue(), 'BROWSER-TEST-ONLY');
  assert(!page.url().includes('invite='), 'invite scrubbed from URL');
  assert(page.url().includes('ref=GateTester'), 'referral preserved');
  assert.equal(await page.locator('#screen-game').count(), 0, 'console withheld');
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no mobile overflow');
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  await page.locator('#invite-code').fill('INCORRECT');
  await page.locator('#enter').click();
  await page.waitForFunction(() => document.querySelector('#gate-status').classList.contains('error'));
  assert.equal(await page.locator('#enter').isEnabled(), true, 'retry enabled after rejected code');
  await page.locator('#invite-code').fill('BROWSER-TEST-ONLY');
  await page.locator('#enter').click();
  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 30000 });
  const token = await page.evaluate(() => localStorage.getItem('omerta_token'));
  assert(token, 'admission token saved durably before navigation');
  assert((await context.cookies()).some((c) => c.name === 'omerta_access' && c.httpOnly), 'view cookie HttpOnly');
  const apiHeaders = { authorization: 'Bearer ' + token };
  const created = await app.inject({ method: 'POST', url: '/v1/character', headers: apiHeaders, payload: { name: 'Browser Invite' } });
  assert.equal(created.statusCode, 200, created.body);
  const accountId = app.jwt.verify(token).sub;
  await app.pool.query('UPDATE characters SET respect=5000 WHERE account_id=$1', [accountId]);
  const crew = await app.inject({ method: 'POST', url: '/v1/crew', headers: apiHeaders, payload: { name: 'Browser Crew' } });
  assert.equal(crew.statusCode, 200, crew.body);
  await page.reload({ waitUntil: 'networkidle' });
  // Use the real tab control, even if the first-week onboarding overlay is covering it.
  await page.locator('[data-tab="crew"]').evaluate((el) => el.click());
  await page.waitForSelector('#launch-invite-generate', { state: 'attached' });
  assert.equal(await page.locator('#launch-invite-generate').count(), 1);
  await page.locator('#launch-invite-generate').evaluate((el) => el.click());
  await page.waitForSelector('[data-launch-copy]', { state: 'attached' });
  assert.equal(await page.locator('[data-launch-copy]').count(), 1, 'new invite visible in crew panel');
  const board = (await app.inject({ method: 'GET', url: '/v1/invites', headers: apiHeaders })).json();
  assert.equal(board.remaining, 2);
  // Only the gate script must be free of execution errors; report any legacy console errors too.
  assert.deepEqual(errors, [], 'no uncaught browser script errors');
  await context.close();
  console.log('PASS: desktop/mobile gate, private markup, referral preservation, invalid-code retry, real form redemption, durable login, and Crew invite control. Screenshots: ' + output);
} finally { await browser.close(); await app.close(); }
