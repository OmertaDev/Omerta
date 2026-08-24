#!/usr/bin/env node
// High-leverage public/IA browser contract. This is intentionally narrower than tools/mobile.js:
// it catches truth, first-paint, payload, public empty/search states, and intent navigation.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { buildServer } from '../src/server.js';

function resolveBrowser() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/chromium', '/usr/bin/google-chrome',
  ]) if (fs.existsSync(p)) return p;
  return null;
}

const exe = resolveBrowser();
if (!exe) {
  console.error('✗ PUBLIC UI CONTRACT CANNOT RUN — set CHROMIUM_PATH to a Chromium/Chrome binary.');
  process.exit(1);
}
if (process.env.DATABASE_URL) {
  console.error('✗ PUBLIC UI CONTRACT REFUSES DATABASE_URL — it requires disposable pg-mem.');
  process.exit(1);
}

const app = await buildServer();
await app.listen({ port: 0, host: '127.0.0.1' });
const BASE = `http://127.0.0.1:${app.server.address().port}`;
const browser = await chromium.launch({ executablePath: exe });
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(BASE, { waitUntil: 'domcontentloaded' });
  const firstFrame = await desktop.evaluate(() => ({
    ctaOpacity: Number(getComputedStyle(document.querySelector('#btn-guest')).opacity),
    heroOpacity: Number(getComputedStyle(document.querySelector('.hero .tag')).opacity),
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    editorial: document.querySelector('.wire-ticker')?.dataset.feedMode === 'editorial',
    announcesLive: !!document.querySelector('.wire-ticker[role="status"], .wire-ticker[aria-live]'),
  }));
  check(firstFrame.ctaOpacity === 1 && firstFrame.heroOpacity === 1,
    `landing comprehension is opacity-gated on first paint — ${JSON.stringify(firstFrame)}`);
  check(firstFrame.over <= 1, `desktop landing scrolls sideways by ${firstFrame.over}px`);
  check(firstFrame.editorial && !firstFrame.announcesLive,
    'the fictional landing feed is not programmatically identified as editorial flavor');
  const gameProof = await desktop.evaluate(() => ({
    approaches: document.querySelectorAll('.operation-proof .operation-approach').length,
    receipt: document.querySelectorAll('.operation-proof .operation-receipt').length,
  }));
  check(gameProof.approaches === 3 && gameProof.receipt === 1,
    `landing does not prove one game decision and its recorded consequence — ${JSON.stringify(gameProof)}`);
  await desktop.waitForLoadState('networkidle');
  const landingLoad = await desktop.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource').map((r) => ({
      name: new URL(r.name).pathname, bytes: r.transferSize || r.encodedBodySize || 0,
    })).sort((a, b) => b.bytes - a.bytes);
    return { bytes: (nav?.transferSize || nav?.encodedBodySize || 0) + resources.reduce((sum, r) => sum + r.bytes, 0),
      resources: resources.slice(0, 6) };
  });
  check(landingLoad.bytes <= 1.5 * 1024 * 1024,
    `cold landing transfers ${Math.round(landingLoad.bytes / 1024)} KB; budget is 1536 KB — ${JSON.stringify(landingLoad.resources)}`);
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
  await mobile.goto(`${BASE}/wiki`, { waitUntil: 'networkidle' });
  let publicWidth = await mobile.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
  check(publicWidth.inner <= 320 && publicWidth.scroll <= 321,
    `320px Codex expands its layout viewport — ${JSON.stringify(publicWidth)}`);
  const searchVisible = await mobile.locator('#q').isVisible();
  check(searchVisible, 'Codex search is hidden behind Browse sections on mobile');
  if (!searchVisible) await mobile.click('#nav-toggle');
  await mobile.fill('#q', 'death');
  await mobile.waitForTimeout(100);
  const searchShape = await mobile.evaluate(() => ({
    results: document.querySelectorAll('#search-results a').length,
    snippets: [...document.querySelectorAll('#search-results .search-hit__snippet')]
      .filter((x) => x.textContent.trim()).length,
    marks: document.querySelectorAll('#search-results mark').length,
  }));
  check(searchShape.results > 0 && searchShape.snippets === searchShape.results && searchShape.marks > 0,
    `Codex search lacks direct, highlighted result snippets — ${JSON.stringify(searchShape)}`);

  await mobile.goto(`${BASE}/arena`, { waitUntil: 'networkidle' });
  await mobile.waitForFunction(() => !document.querySelector('#board')?.hasAttribute('aria-busy'));
  publicWidth = await mobile.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
  check(publicWidth.inner <= 320 && publicWidth.scroll <= 321,
    `320px Arena expands its layout viewport — ${JSON.stringify(publicWidth)}`);
  const arenaEmpty = await mobile.evaluate(() => ({
    metrics: document.querySelectorAll('#stats .stat').length,
    artifact: document.querySelectorAll('#stats .arena-empty').length,
  }));
  check(arenaEmpty.metrics === 0 && arenaEmpty.artifact === 1,
    `empty Arena repeats zero metrics instead of teaching the first-entry path — ${JSON.stringify(arenaEmpty)}`);

  await mobile.goto(BASE, { waitUntil: 'networkidle' });
  await mobile.click('#btn-guest');
  await mobile.waitForSelector('#screen-create:not(.hidden)');
  await mobile.fill('#new-name', 'Intent ' + Math.random().toString(36).slice(2, 8));
  await mobile.click('#btn-create');
  await mobile.waitForSelector('#screen-main:not(.hidden)');
  if (await mobile.locator('#welcome:not(.hidden)').count()) await mobile.click('#tour-skip');
  for (const [query, expected] of [['heal', 'life'], ['sell car', 'garage'], ['take loan', 'loans']]) {
    await mobile.click('#btn-jump');
    await mobile.fill('#jump-q', query);
    const got = await mobile.locator('#jump-list [data-jump]').first().getAttribute('data-jump').catch(() => null);
    check(got === expected, `quick jump “${query}” should lead with ${expected}, got ${got || 'no result'}`);
    await mobile.press('#jump-q', 'Escape');
  }
  const chatLabel = await mobile.locator('#chatinput').getAttribute('aria-label');
  check(!!chatLabel, 'city chat input has no programmatic accessible name');
  const typeFloor = await mobile.evaluate(() => {
    const px = (selector) => Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    return { cardDetail: px('#tab-streets .card .d'), coachHint: px('#coach .ch'), bottomNav: px('#bnav button') };
  });
  check(typeFloor.cardDetail >= 14 && typeFloor.coachHint >= 14 && typeFloor.bottomNav >= 11.5,
    `operational type floor is still too small — ${JSON.stringify(typeFloor)}`);
  await mobile.close();
} finally {
  await browser.close();
  await app.close();
}

if (failures.length) {
  console.error(`\n✗ PUBLIC UI CONTRACT FAILED — ${failures.length} problem(s):\n`);
  failures.forEach((f) => console.error('   • ' + f));
  process.exit(1);
}
console.log('\n✅ public UI contract passed — first paint, payload, truth register, Codex search, Arena empty state, intent jump, and chat labeling.');
