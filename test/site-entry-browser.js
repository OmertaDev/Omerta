import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';

if (process.env.DATABASE_URL) throw new Error('Site entry browser checks require a disposable in-memory database.');
process.env.NODE_ENV = 'test';
const executablePath = process.env.CHROMIUM_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(fs.existsSync);
assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser.');
const app = await buildServer();
let browser;

try {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 375, height: 667 }, { width: 320, height: 568 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#btn-guest').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.locator('#site-analytics-choices').waitFor();
      const layout = await page.locator('#btn-guest').evaluate(button => {
        const rect = button.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, height: innerHeight, width: innerWidth, scroll: document.documentElement.scrollWidth };
      });
      assert.ok(layout.top >= 0 && layout.bottom <= layout.height, `Guest CTA is above the fold at ${viewport.width}×${viewport.height}: ${JSON.stringify(layout)}`);
      assert.ok(layout.scroll <= layout.width + 1, 'The landing page has no horizontal overflow.');
      if (await page.locator('#site-analytics-choices').count()) {
        const overlap = await page.evaluate(() => {
          const button = document.querySelector('#btn-guest').getBoundingClientRect();
          const choices = document.querySelector('#site-analytics-choices').getBoundingClientRect();
          return Math.max(0, Math.min(button.right, choices.right) - Math.max(button.left, choices.left))
            * Math.max(0, Math.min(button.bottom, choices.bottom) - Math.max(button.top, choices.top));
        });
        assert.equal(overlap, 0, `Analytics choices do not obscure signup at ${viewport.width}×${viewport.height}.`);
      }
      assert.equal(await page.locator('img:not([alt])').count(), 0, 'Landing images supply text alternatives or decorative empty alt text.');
    } finally { await page.close(); }
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const faults = [];
  page.on('pageerror', error => faults.push(error.message));
  let guestRequests = 0, releaseRequest;
  const requestHeld = new Promise(resolve => { releaseRequest = resolve; });
  await page.route('**/v1/auth/guest', async route => {
    guestRequests++;
    await requestHeld;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'The city is restarting. Try again.' }) });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const primary = page.locator('#btn-guest');
  await primary.click();
  await page.locator('#age-date').waitFor();
  assert.equal(await primary.isDisabled(), true, 'Eligibility checking shares the signup pending state.');
  await page.evaluate(() => document.querySelector('#btn-guest2').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.equal(await page.locator('dialog[open] #age-date').count(), 1, 'Repeated activations do not open duplicate eligibility dialogs.');
  await page.locator('#age-cancel').click();
  await page.waitForFunction(() => !document.querySelector('#btn-guest').disabled);
  assert.equal(guestRequests, 0, 'Cancelling eligibility never attempts account creation.');
  assert.equal(await page.locator('#guest-status').isHidden(), true, 'Cancelling eligibility clears progress feedback.');
  await primary.click();
  await page.locator('#age-date').fill('1990-01-01');
  await page.locator('dialog[open] button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#guest-status').textContent.includes('Opening your street'));
  assert.equal(await primary.isDisabled(), true, 'The primary signup action stays disabled while waiting.');
  assert.equal(await page.locator('#btn-guest2').isDisabled(), true, 'The secondary signup action shares the pending state.');
  assert.match(await page.locator('#guest-status').textContent(), /Opening your street/);
  await page.evaluate(() => document.querySelector('#btn-guest2').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  releaseRequest();
  await page.waitForFunction(() => !document.querySelector('#btn-guest').disabled);
  assert.equal(guestRequests, 1, 'Repeated signup activations do not create duplicate accounts.');
  assert.equal(await page.locator('#guest-status').textContent(), 'The city is restarting. Try again.');
  assert.equal(await primary.getAttribute('aria-busy'), null, 'An unsuccessful signup clears the busy state.');
  assert.equal(await primary.textContent(), 'PLAY AS A GUEST', 'An unsuccessful signup restores the action label.');

  await page.unroute('**/v1/auth/guest');
  await primary.click();
  await page.locator('#screen-create:not(.hidden)').waitFor();
  await page.waitForFunction(() => !document.querySelector('#btn-guest').disabled);
  assert.equal(await page.locator('#guest-status').isHidden(), true, 'A successful signup clears progress feedback.');
  assert.ok(await page.evaluate(() => localStorage.getItem('omerta_token')), 'Signup preserves the session before opening character creation.');
  assert.deepEqual(faults, [], 'Signup produces no browser exceptions.');
  await page.close();
  console.log('Site entry: desktop/mobile CTA visibility, image labels, eligibility cancellation, signup progress, duplicate prevention, failure recovery and successful signup passed.');
} finally { await browser?.close(); await app.close(); }
