// Real mobile navigation and lifecycle wiring; only media playback is faked so missing AAC
// support cannot turn an audio leak check into a vacuous zero-playing pass.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';

assert(!process.env.DATABASE_URL, 'Ambient browser proof requires disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';
const executablePath = process.env.CHROMIUM_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(candidate => fs.existsSync(candidate));
assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser.');
const app = await buildServer(); let browser; const errors = [];
try {
  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' }); assert.equal(guest.statusCode, 200);
  const token = guest.json().token;
  const created = await app.inject({ method: 'POST', url: '/v1/character', headers: { authorization: `Bearer ${token}` }, payload: { name: 'Ambient Lifecycle' } });
  assert.equal(created.statusCode, 200);
  const manifest = await app.inject({ method: 'GET', url: '/v1/art/motion' });
  assert.equal(manifest.statusCode, 200);
  for (const key of ['bed-den', 'bed-docks', 'bed-law']) assert.ok(manifest.json().beds.includes(key), `Real manifest must contain ${key}`);
  await app.listen({ host: '127.0.0.1', port: 0 });
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await context.addInitScript(token => {
    localStorage.setItem('omerta_token', token);
    for (const key of ['omerta_tour2', 'omerta_welcomed', 'omerta_alltabs']) localStorage.setItem(key, '1');
    localStorage.setItem('omerta_sfx', 'on'); localStorage.setItem('omerta_feedback', JSON.stringify({ ambience: true }));
    window.__beds = [];
    window.Audio = class {
      constructor(src) { this.src = src; this.volume = 1; this.paused = true; this.removed = false; this.loads = 0; window.__beds.push(this); }
      play() { this.paused = false; return Promise.resolve(); }
      pause() { this.paused = true; }
      removeAttribute(name) { if (name === 'src') { this.src = ''; this.removed = true; } }
      load() { this.loads++; }
    };
    window.__audioSnapshot = () => ({ created: __beds.length, playing: __beds.filter(bed => !bed.paused).length,
      retained: __beds.filter(bed => !bed.removed).length, released: __beds.filter(bed => bed.removed && bed.loads === 1).length });
    // Bubble phase observes the actual button handler synchronously, before any fade can tick.
    document.addEventListener('click', event => {
      if (event.target.closest?.('#btn-sfx')) window.__muteSnapshot = window.__audioSnapshot();
    });
  }, token);
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${app.server.address().port}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#screen-main:not(.hidden)').waitFor();
  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(modal => modal.classList.add('hidden')));
  const jump = async tab => {
    await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill(tab);
    await page.locator(`#jump-list [data-jump="${tab}"]`).first().click(); await page.locator(`#tab-${tab}.on`).waitFor();
  };
  for (const tab of ['den', 'port', 'law', 'den']) await jump(tab);
  await page.waitForFunction(() => __beds.length >= 3 && __beds.filter(bed => !bed.paused).length === 1);
  const walked = await page.evaluate(() => __audioSnapshot());
  assert.ok(walked.created >= 3, 'real navigation must have started multiple distinct beds');
  assert.equal(walked.playing, 1);
  const mute = page.locator('#btn-sfx');
  const disclosures = mute.locator('xpath=ancestor::details');
  for (let i = 0; i < await disclosures.count(); i++) {
    const disclosure = disclosures.nth(i);
    if (!await disclosure.evaluate(element => element.open)) await disclosure.locator(':scope > summary').click();
  }
  await mute.click(); const muted = await page.evaluate(() => __muteSnapshot);
  assert.equal(muted.playing, 0, 'the physical mute click stops audio in the same event turn');
  assert.equal(muted.retained, 0, 'mute releases all current and outgoing media resources');
  await mute.click(); await page.waitForFunction(() => __audioSnapshot().playing === 1);
  for (const event of ['visibilitychange', 'pagehide', 'freeze']) {
    const stopped = await page.evaluate(event => {
      if (event === 'visibilitychange') {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event(event));
      } else (event === 'freeze' ? document : window).dispatchEvent(new Event(event));
      return __audioSnapshot();
    }, event);
    assert.equal(stopped.playing, 0, `${event} stops all playback in the same event turn`);
    assert.equal(stopped.retained, 0, `${event} releases all audio resources`);
    await page.evaluate(event => {
      if (event === 'visibilitychange') {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new Event(event));
      } else (event === 'freeze' ? document : window).dispatchEvent(new Event(event === 'freeze' ? 'resume' : 'pageshow'));
    }, event);
    await page.waitForFunction(() => __audioSnapshot().playing === 1);
    assert.equal((await page.evaluate(() => __audioSnapshot())).created, stopped.created + 1, 'return starts exactly one fresh bed');
  }
  assert.deepEqual(errors, []);
  console.log(`Ambient mobile browser: ${walked.created} beds exercised; real navigation, immediate mute, hide/show, pagehide/pageshow, document freeze/resume, and resource release passed.`);
} finally { await browser?.close(); await app.close(); }
