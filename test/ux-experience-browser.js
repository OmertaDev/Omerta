// Real-page UX integration against a disposable in-process database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';
import { masteryXpFor } from '../src/rules.js';

if (process.env.DATABASE_URL) throw new Error('UX browser integration requires the disposable in-memory database.');
const executablePath = process.env.CHROMIUM_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find((candidate) => fs.existsSync(candidate));
assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser.');
const app = await buildServer(), pool = app.pool;
let browser;
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-ux-experience-'));
const faults = [];
const call = async (method, url, token, body) => {
  const reply = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });
  assert.equal(reply.statusCode, 200, `${method} ${url}`); return reply.json();
};
const create = async (name) => {
  const { token } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', token, { name });
  const ch = (await pool.query('SELECT * FROM characters WHERE name=$1', [name])).rows[0];
  return { token, ch };
};
const wireErrors = (page) => {
  page.on('pageerror', (error) => faults.push(error.message));
  page.on('console', (message) => { if (['warning', 'error'].includes(message.type()) && /UI .*unavailable|UI enhancement unavailable|renderSheet failed/.test(message.text())) faults.push(message.text()); });
};
const hideIntro = (page) => page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach((modal) => modal.classList.add('hidden')));
const openTab = async (page, tab) => {
  // Boot and guide routing can change the active rail between a visibility check
  // and its click. The public jump control is available across every rail.
  await page.locator('#btn-jump').click();
  await page.locator('#jump-q').fill(tab);
  await page.locator(`#jump-list [data-jump="${tab}"]`).first().click();
  await page.locator(`#tab-${tab}.on`).waitFor();
};
const noOverflow = async (page, label) => {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.width + 2, `${label} overflows: ${JSON.stringify(dimensions)}`);
};

try {
  const player = await create('UX Integration Reader'), other = await create('UX Integration Other');
  await pool.query('UPDATE characters SET respect=159,cunning=50,speed=50,nerve=40,energy=100,cash=50000 WHERE id=$1', [player.ch.id]);
  await pool.query("INSERT INTO masteries (character_id,track_id,xp) VALUES ($1,'larceny',$2)", [player.ch.id, masteryXpFor(2) - 1]);
  await pool.query("INSERT INTO mastery_legend (account_id,track_id,xp) VALUES ($1,'larceny',$2)", [player.ch.account_id, masteryXpFor(2) - 1]);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });
  const landing = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }); wireErrors(landing);
  const writes = [];
  landing.on('request', (request) => { if (request.url().startsWith(base + '/v1/') && request.method() !== 'GET') writes.push(request.url()); });
  await landing.goto(base, { waitUntil: 'domcontentloaded' });
  await landing.locator('#ux-practice summary').waitFor();
  await landing.locator('#ux-practice summary').click();
  await landing.locator('[data-practice="quiet"]').click();
  assert.match(await landing.locator('.ux-practice-receipt').innerText(), /PRACTICE RECEIPT/);
  assert.match(await landing.locator('.ux-practice-receipt').innerText(), /None · practice only/);
  assert.equal(writes.length, 0, 'landing practice issues no mutating requests');
  await noOverflow(landing, 'desktop landing');
  await landing.screenshot({ path: path.join(artifacts, 'ux-landing-desktop.png'), fullPage: false });
  await landing.close();

  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce', locale: 'en-US' });
  await context.addInitScript((token) => {
    localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1'); localStorage.setItem('omerta_welcomed', '1'); localStorage.setItem('omerta_alltabs', '1');
  }, player.token);
  const page = await context.newPage(); wireErrors(page);
  let lastMe = null;
  page.on('response', async (response) => { if ([base + '/v1/me', base + '/v1/projections/player'].includes(response.url()) && response.status() === 200) { const data = await response.json().catch(() => null); if (data) lastMe = data.player?.character || data.player || data.character || data; } });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('#screen-main:not(.hidden)').waitFor(); await hideIntro(page);
  await page.locator('[data-ux-search]').waitFor();
  assert.equal(await page.evaluate(() => ['createOmertaFeedback', 'createOmertaProgression', 'createOmertaSocial', 'createOmertaNavigation'].every((name) => typeof window[name] === 'function')), true);
  await openTab(page, 'life');
  const goal = page.locator('#tab-life select[aria-label="Choose your next achievement"]');
  await goal.waitFor(); await goal.selectOption('trade:larceny');
  await page.locator('#sheet-body .ux-goal-card strong').filter({ hasText: 'Larceny' }).waitFor();
  await openTab(page, 'streets');
  await page.locator('#tab-streets [data-do^="POST /v1/crimes/"]:enabled').first().waitFor();
  await page.locator('[data-ux-pin]').click();
  const before = structuredClone(lastMe);
  const actionResponse = page.waitForResponse((response) => response.url().includes('/v1/crimes/') && response.request().method() === 'POST');
  const originalRandom = Math.random;
  let result;
  try {
    Math.random = () => .01;
    await page.locator('#tab-streets [data-do^="POST /v1/crimes/"][data-body*=standard]:enabled').first().click();
    const response = await actionResponse; assert.equal(response.status(), 200); result = await response.json();
  } finally { Math.random = originalRandom; }
  assert.equal(result.success, true, 'the disposable fixture produces a real successful job');
  await page.locator('#operation-latest .ux-receipt-trade').waitFor();
  const after = await call('GET', '/v1/me', player.token);
  const afterMe = after.character || after;
  const net = Number(afterMe.cash) - Number(before.cash), xp = Number(afterMe.trades.find((t) => t.id === 'larceny').xp) - Number(before.trades.find((t) => t.id === 'larceny').xp);
  assert.ok(net > 0 && xp > 0);
  const receiptText = await page.locator('#operation-latest').innerText();
  assert.ok(receiptText.includes(`+$${net.toLocaleString('en-US', { maximumFractionDigits: 2 })} pocket change`), `receipt actual net: ${receiptText}`);
  assert.ok(receiptText.includes(`Larceny +${xp.toLocaleString('en-US', { maximumFractionDigits: 2 })} XP`), `receipt actual XP: ${receiptText}`);
  assert.ok(await page.locator('#operation-latest [data-operation-tab]').count(), 'a real rank unlock has a follow-up');
  assert.equal(await page.locator('.ux-reward-transfer, .vignette').count(), 0, 'reduced motion omits flying rewards and job vignettes');
  await noOverflow(page, 'desktop action page');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, 'ux-action-desktop.png'), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#operation-latest .ux-receipt-details > summary').click();
  await page.locator('#operation-latest .ux-receipt-trade').waitFor();
  assert.match(await page.locator('#operation-latest .ux-receipt-trade').innerText(), /Larceny.*XP/, 'Expanding the compact mobile reward restores its verified trade XP.');
  await page.locator('#operation-latest .ux-changes').waitFor();
  assert.ok(await page.locator('#operation-latest .operation-receipt__delta').innerText(), 'The expanded mobile receipt retains its confirmed resource delta.');
  await page.locator('#operation-latest .ux-receipt-details > summary').click();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.locator('[data-feedback-settings]').click();
  await page.locator('#ux-effects-volume').fill('25'); await page.locator('#ux-celebration').selectOption('quiet');
  assert.equal(await page.locator('body').getAttribute('data-celebration'), 'quiet');
  await page.locator('button[aria-label="Close feedback preferences"]').click();
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await hideIntro(page);
  await openTab(page, 'streets');
  await page.locator('[data-ux-pin][aria-pressed="true"]').waitFor();
  assert.equal(await page.locator('body').getAttribute('data-celebration'), 'quiet', 'feedback preference survives reload');
  await page.setViewportSize({ width: 390, height: 844 });
  // A screen can finish an outstanding read immediately after the viewport changes.
  // Read the live region and its required contents atomically, not a detached locator
  // whose original controls were correctly returned before a renderer replaced it.
  const pocketReady = await page.waitForFunction(() => {
    const node = document.querySelector('#tab-streets.on .ux-action-pocket');
    if (!node || node.querySelectorAll('.operation-action-terms').length !== 1 || node.querySelectorAll('.verbrow').length !== 1) return false;
    const r = node.getBoundingClientRect(), bar = document.getElementById('bnav').getBoundingClientRect();
    const terms = node.querySelector('.operation-action-terms');
    return { terms: node.querySelectorAll('.operation-action-terms').length, rows: node.querySelectorAll('.verbrow').length,
      matchingTerms: terms ? document.querySelectorAll(`#${terms.id}`).length : 0, bottom: r.bottom, barTop: bar.top, z: Number(getComputedStyle(node).zIndex) };
  });
  const pocket = await pocketReady.jsonValue();
  assert.equal(pocket.terms, 1); assert.equal(pocket.rows, 1); assert.equal(pocket.matchingTerms, 1, 'mobile reuses the original action and cost terms once');
  assert.ok(pocket.bottom <= pocket.barTop + 2 && pocket.z < 20, 'mobile action controls remain above bottom navigation and below dialogs');
  await noOverflow(page, 'mobile active operation');
  await page.screenshot({ path: path.join(artifacts, 'ux-action-mobile.png'), fullPage: false });
  // Change account in the same browser store: preferences keyed by account cannot carry over.
  await page.evaluate((token) => localStorage.setItem('omerta_token', token), other.token);
  // The initialization script sets a token on navigation, so use a fresh page without it.
  const plainContext = await browser.newContext({ viewport: { width: 1440, height: 1050 }, storageState: await context.storageState(), reducedMotion: 'reduce' });
  const otherPage = await plainContext.newPage(); wireErrors(otherPage);
  await otherPage.goto(base, { waitUntil: 'domcontentloaded' }); await otherPage.locator('#screen-main:not(.hidden)').waitFor(); await hideIntro(otherPage);
  await openTab(otherPage, 'streets');
  await otherPage.locator('[data-ux-pin][aria-pressed="false"]').waitFor();
  assert.equal(await otherPage.locator('#sheet-body .ux-goal-card > strong').count(), 0, 'a pinned achievement does not cross accounts');
  assert.deepEqual(faults, [], 'real-page modules have no page errors or swallowed UI failures');
  console.log('ux-experience-browser: PASS (practice has no writes; real net/XP receipt and follow-up; preferences; reduced motion; desktop/mobile; account isolation)');
  console.log(`Screenshots: ${artifacts}`);
} finally { await browser?.close(); await app.close(); }
