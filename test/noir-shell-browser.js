// Real gameplay survives the quieter shell: navigation, optional panels, and job terms/receipts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';

if (process.env.DATABASE_URL) throw new Error('Noir shell checks require the disposable in-memory database.');
const executablePath = process.env.CHROMIUM_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(fs.existsSync);
assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser.');
const app = await buildServer();
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-noir-shell-'));
const faults = [];
let browser;

async function call(method, url, token, payload) {
  const response = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal(response.statusCode, 200, `${method} ${url}`);
  return response.json();
}
async function openTab(page, tab) {
  await page.locator('#btn-jump').click();
  await page.locator('#jump-q').fill(tab);
  await page.locator(`#jump-list [data-jump="${tab}"]`).first().click();
  await page.locator(`#tab-${tab}.on`).waitFor();
  await page.locator(`#tab-${tab} [data-feel-loading]`).waitFor({ state: 'hidden' });
}
async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(size.scroll <= size.width + 1, `${label} overflows: ${JSON.stringify(size)}`);
}

try {
  const { token } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', token, { name: 'Noir Shell Player' });
  const rules = await call('GET', '/v1/rules');
  await app.listen({ port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'en-US', serviceWorkers: 'block' });
  await context.addInitScript(value => {
    localStorage.setItem('omerta_token', value);
    localStorage.setItem('omerta_tour2', '1');
    localStorage.setItem('omerta_welcomed', '1');
  }, token);
  const page = await context.newPage();
  page.on('pageerror', error => faults.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('#tab-start.on .start-next-card').waitFor();
  await page.locator('#tab-start [data-feel-loading]').waitFor({ state: 'hidden' });

  const primary = page.getByRole('navigation', { name: 'Main destinations', exact: true });
  assert.equal(await primary.getByRole('button').count(), 5, 'desktop presents five main destinations');
  assert.equal(await page.locator('#city-directory').getAttribute('open'), null, 'the complete directory starts collapsed');
  assert.equal(await page.locator('#ux-screen-tools').getAttribute('open'), null, 'workspace tools start collapsed');
  for (const [label, tab] of [['Overview', 'start'], ['Streets', 'streets'], ['City', 'map'], ['Family', 'family'], ['Empire', 'empire']]) {
    await primary.getByRole('button', { name: label, exact: true }).click();
    await page.locator(`#tab-${tab}.on`).waitFor();
    await page.locator(`#tab-${tab} [data-feel-loading]`).waitFor({ state: 'hidden' });
    assert.equal(await primary.locator('[aria-current="page"]').count(), 1, `${label} has one current destination`);
    await noOverflow(page, `desktop ${label}`);
  }

  // The infrequent screens remain reachable through the actual directory controls.
  await page.locator('#city-directory > summary').click();
  if (await page.locator('#tabs-more').isVisible()) await page.locator('#tabs-more').click();
  await page.locator('#grouprail [data-group="legit"]').click();
  await page.locator('#tabs [data-tab="portfolio"]').click();
  await page.locator('#tab-portfolio.on').waitFor();
  await page.locator('#city-directory > summary').click();

  await openTab(page, 'life');
  const closedToggle = page.locator('#tab-life .noir-panel-toggle[aria-expanded="false"]').first();
  await closedToggle.waitFor();
  const panelKey = await closedToggle.locator('..').getAttribute('data-noir-panel-key');
  const toggle = page.locator(`#tab-life [data-noir-panel-key="${panelKey}"] > .noir-panel-toggle`);
  const controlledId = (await toggle.getAttribute('aria-controls')).split(' ')[0];
  const controlled = page.locator(`#${controlledId}`);
  assert.equal(await controlled.isVisible(), false, 'optional character tools are hidden until requested');
  await toggle.click();
  await controlled.waitFor({ state: 'visible' });
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true', 'the disclosure announces its expanded state');

  await openTab(page, 'streets');
  const actionSelector = '#tab-streets [data-do^="POST /v1/crimes/"][data-body*=standard]:enabled';
  await page.locator(actionSelector).first().waitFor();
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => scrollTo(0, 0));
    if (viewport.width < 1000) {
      await page.locator('#tab-streets #ux-action-pocket .operation-action-terms').waitFor();
      assert.equal(await page.locator('#bnav button:visible').count(), 5, 'mobile has five main navigation controls');
    }
    const action = page.locator(actionSelector).first();
    const termsId = await action.getAttribute('aria-describedby');
    const terms = page.locator(`#${termsId}`);
    assert.equal(await terms.count(), 1, 'responsive controls share one real set of job terms');
    assert.equal(await terms.isVisible(), true, 'job terms remain visible with the action');
    const termsText = await terms.innerText();
    const crimeId = (await action.getAttribute('data-do')).split('/').at(-1);
    const crime = rules.crimes.find(entry => entry.id === crimeId);
    assert.ok(crime, 'the action names a published crime');
    assert.match(termsText, /Cost/i);
    assert.ok(termsText.includes(`${crime.nerve} nerve`), 'the action states the published nerve cost');
    assert.match(termsText, /BASELINE WIN/i);
    for (const amount of crime.cash)
      assert.ok(termsText.includes('$' + Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })), 'the action states the published baseline payout range');
    assert.match(termsText, crime.jail ? /jail on a miss/i : /no jail term/i, 'the action states its jail consequence');
    await noOverflow(page, `${viewport.width}px Streets`);
    await page.screenshot({ path: path.join(artifacts, `streets-${viewport.width}.png`) });
  }

  // Execute the issued job control, then compare its receipt against authoritative balances.
  const beforeResponse = await call('GET', '/v1/me', token);
  const before = beforeResponse.character || beforeResponse;
  const actionResponse = page.waitForResponse(response => response.url().includes('/v1/crimes/') && response.request().method() === 'POST');
  const random = Math.random;
  try {
    Math.random = () => .01;
    await page.locator(actionSelector).first().click();
    const response = await actionResponse;
    assert.equal(response.status(), 200, 'the visible control still issues a real successful job');
    assert.equal((await response.json()).success, true);
  } finally { Math.random = random; }
  await page.locator('#operation-latest [data-operation-receipt]').waitFor();
  const afterResponse = await call('GET', '/v1/me', token);
  const after = afterResponse.character || afterResponse;
  const net = Number(after.cash) - Number(before.cash);
  assert.ok(net > 0, 'the server records the job payout');
  const receipt = page.locator('#operation-latest');
  assert.equal(await receipt.isVisible(), true, 'folded extras never hide the action receipt');
  assert.ok((await receipt.innerText()).includes(`+$${net.toLocaleString('en-US', { maximumFractionDigits: 2 })}`), 'receipt reflects the actual server payout');
  await noOverflow(page, '320px receipt');
  assert.deepEqual(faults, [], 'the shell has no unhandled browser errors');
  console.log('noir-shell-browser: PASS (five main destinations, complete directory, optional tools, live terms and receipt, 320/390/1440px)');
  console.log(`Screenshots: ${artifacts}`);
} finally {
  await browser?.close();
  await app.close();
}
