// Real mounted controls and authenticated read-only previews against disposable pg-mem.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';
import { PORT, PACING } from '../src/rules.js';

assert(!process.env.DATABASE_URL, 'Tactics browser checks use the disposable in-memory database.');
const executablePath = process.env.CHROMIUM_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(existsSync);
assert(executablePath, 'Set CHROMIUM_PATH to a Chromium executable.');
const app = await buildServer(), pool = app.pool, artifacts = mkdtempSync(path.join(tmpdir(), 'omerta-ux-tactics-'));
let browser;
const api = async (method, url, token, payload) => {
  const response = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { code: response.statusCode, body: response.json() };
};
const economicSnapshot = async id => ({
  items: (await pool.query('SELECT item_id,qty FROM character_items WHERE character_id=$1 ORDER BY item_id', [id])).rows,
  skills: (await pool.query('SELECT skill_id FROM character_skills WHERE character_id=$1 ORDER BY skill_id', [id])).rows,
  boats: (await pool.query('SELECT id,run_until,run_escort FROM boats WHERE character_id=$1 ORDER BY id', [id])).rows,
  transactions: Number((await pool.query('SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1', [id])).rows[0].n),
});
const openTab = async (page, id) => {
  await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill(id);
  await page.locator(`#jump-list [data-jump="${id}"]`).first().click(); await page.locator(`#tab-${id}.on`).waitFor();
};
const tactics = (page, id) => page.locator(`#tab-${id} > [data-ux-tactics]`);
try {
  const guest = await api('POST', '/v1/auth/guest'); const token = guest.body.token;
  const created = await api('POST', '/v1/character', token, { name: 'Tactics Browser Reader' });
  assert.equal(created.code, 200, JSON.stringify(created.body));
  const row = (await pool.query('SELECT * FROM characters WHERE name=$1', ['Tactics Browser Reader'])).rows[0];
  await pool.query('UPDATE characters SET respect=1960,cunning=8,speed=7,cash=500000,energy=25,nerve=20,health=55,heat=12,last_accrued_at=$2 WHERE id=$1', [row.id, new Date()]);
  await pool.query("INSERT INTO account_gear (account_id,gear_id) VALUES ($1,'lockpick')", [row.account_id]);
  await pool.query("INSERT INTO character_items (character_id,item_id,qty) VALUES ($1,'espresso',2)", [row.id]);
  await pool.query("INSERT INTO boats (id,character_id,kind) VALUES ('working-tactics-boat',$1,'dinghy')", [row.id]);
  await pool.query("INSERT INTO boats (id,character_id,kind,minted_onchain) VALUES ('extracted-tactics-boat',$1,'cigarette',true)", [row.id]);
  assert.equal((await api('GET', '/v1/ux/tactics')).code, 401, 'The projection requires authentication.');
  const initialEconomy = await economicSnapshot(row.id);
  const preview = await api('GET', '/v1/ux/tactics?gear=none&skills=none&sea=1', token);
  assert.equal(preview.code, 200, JSON.stringify(preview.body));
  assert.equal(preview.body.tactics.loadout.proposedStats.cunning - preview.body.tactics.loadout.actualStats.cunning, -8);
  assert.equal(preview.body.tactics.sea.fleet.length, 1);
  assert.equal(preview.body.tactics.sea.quotes.length, PORT.ROUTES.length * 2);
  assert(preview.body.tactics.recovery.options.some(option => option.preview?.item === 'espresso'));
  assert.deepEqual(await economicSnapshot(row.id), initialEconomy, 'Authenticated previews do not consume items, learn skills, launch boats, or write transactions.');
  assert.equal((await api('GET', '/v1/ux/tactics?gear=unknown', token)).code, 400);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
  await context.addInitScript(token => {
    localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1');
    localStorage.setItem('omerta_welcomed', '1'); localStorage.setItem('omerta_alltabs', '1');
  }, token);
  const page = await context.newPage(), faults = [], mutations = [];
  page.on('pageerror', error => faults.push(error.message));
  page.on('request', request => { if (request.method() === 'POST' && /\/v1\/(crimes|train|items|port|skills)/.test(request.url())) mutations.push(request.url()); });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('#screen-main:not(.hidden)').waitFor();
  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(node => node.classList.add('hidden')));
  await openTab(page, 'streets');
  await tactics(page, 'streets').locator(':scope > summary').click();
  const table = tactics(page, 'streets');
  await table.locator('.ux-tactics-comparison').waitFor();
  assert.equal(await table.locator('.ux-tactics-comparison thead th').count(), 4, 'Three approaches have aligned side-by-side columns.');
  assert.match(await table.locator('.ux-tactics-comparison').innerText(), /Success payout/);
  await table.locator('[data-tactics-add]').first().click();
  await table.locator('[data-tactics-add-choice]').click();
  assert.equal(await table.locator('.ux-tactics-plan>li').count(), 2);
  assert.match(await table.locator('.ux-tactics-conflicts').last().innerText(), /street clock/,
    'two consecutive crime quotes expose the shared street-action clock');
  await table.locator('[data-tactics-wait="1"]').fill(String(PACING.STREET_ACTION_CD_MS / 1000));
  await table.locator('[data-tactics-wait="1"]').press('Tab');
  assert.equal(await table.locator('.ux-tactics-conflicts').count(), 0,
    'waiting the authoritative street duration makes the second crime schedulable');
  await table.locator('[data-tactics-remove="1"]').click(); await table.locator('[data-tactics-remove="0"]').click();
  await table.locator('[data-tactics-field="plan-choice"]').selectOption('train:muscle'); await table.locator('[data-tactics-add-choice]').click();
  await table.locator('[data-tactics-field="plan-choice"]').selectOption('train:muscle'); await table.locator('[data-tactics-add-choice]').click();
  assert.match(await table.locator('.ux-tactics-conflicts').last().innerText(), /gym clock/);
  const gymWait = preview.body.tactics.planner.find(move => move.id === 'train:muscle').cooldown.seconds;
  await table.locator('[data-tactics-wait="1"]').fill(String(gymWait)); await table.locator('[data-tactics-wait="1"]').press('Tab');
  assert.equal(await table.locator('.ux-tactics-conflicts').count(), 0, 'A deliberate wait using the actual server gym duration resolves its cooldown conflict.');
  await table.locator('[data-tactics-field="nerve"]').fill('0'); await table.locator('[data-tactics-field="nerve"]').press('Tab');
  await table.locator('[data-tactics-view="jobs"]').click();
  assert.match(await table.locator('.ux-tactics-view').innerText(), /No jobs fit this resource budget/);
  const currentNerve = await table.locator('[data-tactics-field="nerve"]').getAttribute('max');
  await table.locator('[data-tactics-field="nerve"]').fill(currentNerve); await table.locator('[data-tactics-field="nerve"]').press('Tab');
  await table.locator('[data-tactics-view="loadout"]').click();
  await table.locator('[data-tactics-gear="lockpick"]').uncheck();
  const gearResponse = page.waitForResponse(response => response.url().includes('/v1/ux/tactics?') && response.status() === 200);
  await table.locator('[data-tactics-preview]').click(); await gearResponse;
  await page.waitForFunction(() => [...document.querySelectorAll('#tab-streets .ux-tactics table tr')].some(tr => tr.textContent.includes('cunning') && tr.textContent.includes('-8')));
  assert.match(await table.innerText(), /NO EQUIP OR PURCHASE/);
  await table.locator('[data-tactics-view="skills"]').click();
  await table.locator('[data-tactics-skill="getaway"]').check();
  const skillResponse = page.waitForResponse(response => response.url().includes('/v1/ux/tactics?') && response.status() === 200);
  await table.locator('[data-tactics-preview]').click(); await skillResponse;
  await table.locator('.ux-tactics-conflicts').filter({ hasText: 'Getaway requires Pack Mule' }).waitFor();
  await table.locator('[data-tactics-skill="pack_mule"]').check();
  const validSkillResponse = page.waitForResponse(response => response.url().includes('/v1/ux/tactics?') && response.status() === 200);
  await table.locator('[data-tactics-preview]').click(); await validSkillResponse;
  await page.waitForFunction(() => !document.querySelector('#tab-streets .ux-tactics-skills') || !document.querySelector('#tab-streets .ux-tactics-hypothetical .ux-tactics-conflicts'));
  assert.match(await table.innerText(), /NO POINTS SPENT/);
  await table.locator('[data-tactics-view="formula"]').click();
  const oldChance = await table.locator('[data-explorer-result]').innerText();
  await table.locator('[data-tactics-explorer="cunning"]').focus(); await page.keyboard.press('ArrowRight');
  assert.notEqual(await table.locator('[data-explorer-result]').innerText(), oldChance, 'Keyboard exploration changes hypothetical odds through the published expression.');
  await table.locator('[data-tactics-view="recovery"]').click();
  assert.match(await table.locator('.ux-tactics-view').innerText(), /Corner-Stand Espresso/);
  assert.match(await table.locator('.ux-tactics-view').innerText(), /same helper used by the live item route/);
  assert.equal(mutations.length, 0, 'All comparisons, gear/skill toggles, formula inputs and plans avoid game mutations.');
  assert.deepEqual(await economicSnapshot(row.id), initialEconomy);
  await page.screenshot({ path: path.join(artifacts, 'tactics-desktop.png'), fullPage: false });

  await openTab(page, 'port');
  const harbor = tactics(page, 'port');
  await harbor.locator('.ux-tactics-view table tbody tr').first().waitFor();
  assert.match(await harbor.locator('.ux-tactics-view').innerText(), /Clean proceeds/);
  const costWithoutEscort = await harbor.locator('.ux-tactics-view table tbody tr').first().locator('td').nth(0).innerText();
  await harbor.locator('[data-tactics-field="escort"]').check();
  const costWithEscort = await harbor.locator('.ux-tactics-view table tbody tr').first().locator('td').nth(0).innerText();
  assert.notEqual(costWithEscort, costWithoutEscort);
  assert.equal(mutations.length, 0, 'An escort preview never launches a boat.');
  await page.setViewportSize({ width: 390, height: 844 });
  const widths = await page.evaluate(() => ({ viewport: innerWidth, body: document.documentElement.scrollWidth }));
  assert(widths.body <= widths.viewport + 2, `The scrollable comparison stays inside the mobile layout: ${JSON.stringify(widths)}`);
  await harbor.locator('.ux-tactics-view table').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifacts, 'tactics-mobile.png'), fullPage: false });
  assert.equal(await harbor.locator('.ux-tactics-table-wrap').evaluate(node => node.scrollWidth > node.clientWidth), true, 'Wide comparisons scroll locally on phones.');
  await page.setViewportSize({ width: 1440, height: 1050 });

  // Practice starts with a fresh read, then advances only from real confirmed jobs.
  // Tab activation precedes the async native board replacement. Do not click the
  // planning toolbar retained from the earlier Streets visit while it is replaced.
  const previousStreetTable = await table.elementHandle();
  await openTab(page, 'streets');
  if (previousStreetTable) {
    await page.waitForFunction(previous => !previous.isConnected, previousStreetTable);
    await previousStreetTable.dispose();
  }
  await table.locator('[data-tactics-view="trials"]').waitFor();
  await table.locator('[data-tactics-view="trials"]').click();
  const light = () => table.locator('[data-trial-card="light-touch"]');
  await page.waitForFunction(() => document.querySelectorAll('#tab-streets [data-ux-tactics] [data-trial-card]').length === 3);
  assert.equal(await table.locator('[data-trial-card]').count(), 3);
  assert.match(await table.locator('.ux-tactics-trials').innerText(), /private practice stamps add no currency, items or public rank/);
  await light().locator('[data-tactics-trial]').click();
  await light().locator('.ux-tactics-trial-status').filter({ hasText: 'In progress · 0 / 2' }).waitFor();
  assert.equal(mutations.length, 0, 'Starting a mastery trial only reads conditions and saves private notes.');
  assert.deepEqual(await economicSnapshot(row.id), initialEconomy);
  const practiceRandom = Math.random;
  try {
    Math.random = () => 0.01;
    for (let step = 1; step <= 2; step++) {
      const fullBook = page.locator('#tab-streets details[data-sect="crimes-all"]');
      if (await fullBook.count() && !await fullBook.evaluate(node => node.open)) await fullBook.locator(':scope > summary').click();
      const confirmed = page.waitForResponse(response => response.url().includes('/v1/crimes/') && response.request().method() === 'POST');
      await page.locator('#tab-streets [data-do="POST /v1/crimes/pick"].prime:enabled').click();
      const outcome = await (await confirmed).json();
      assert.equal(outcome.success, true);
      assert(outcome.decisionContext.cost.nerve <= 6);
      await light().locator('.ux-tactics-trial-status').filter({ hasText: step === 2 ? 'Practice complete · 2 / 2' : 'In progress · 1 / 2' }).waitFor();
      await page.waitForFunction(() => document.body.style.cursor !== 'progress');
      if (step === 1) {
        await pool.query('UPDATE characters SET street_action_at=NULL WHERE id=$1', [row.id]);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('#screen-main:not(.hidden)').waitFor();
        await openTab(page, 'streets');
        await light().locator('.ux-tactics-trial-status').filter({ hasText: 'In progress · 1 / 2' }).waitFor();
      }
    }
  } finally { Math.random = practiceRandom; }
  assert.match(await light().locator('.ux-tactics-trial-stamp').innerText(), /Personal record · this character/);
  const afterPractice = await economicSnapshot(row.id), practiceMutations = mutations.length;
  await light().locator('[data-tactics-trial]').click();
  await light().locator('.ux-tactics-trial-status').filter({ hasText: 'In progress · 0 / 2' }).waitFor();
  assert.equal(mutations.length, practiceMutations, 'Resetting a trial never repeats or reverses a real job.');
  assert.deepEqual(await economicSnapshot(row.id), afterPractice);
  await light().locator('[data-tactics-trial-stop]').click();
  await light().locator('.ux-tactics-trial-status').filter({ hasText: 'Run paused' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await light().scrollIntoViewIfNeeded();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Mastery rules and controls stay within the phone viewport.');
  assert(await light().locator('[data-tactics-trial]').evaluate(button => button.getBoundingClientRect().height >= 44));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await pool.query('UPDATE characters SET generation=2,street_action_at=NULL WHERE id=$1', [row.id]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#screen-main:not(.hidden)').waitFor();
  await openTab(page, 'streets');
  await light().locator('.ux-tactics-trial-status').filter({ hasText: 'Not started · 0 / 2' }).waitFor();

  // A real failed action carries its pre-action quote into the explanatory receipt.
  await openTab(page, 'streets');
  const random = Math.random;
  try {
    Math.random = () => 0.99999;
    const failureResponse = page.waitForResponse(response => response.url().includes('/v1/crimes/') && response.request().method() === 'POST');
    await page.locator('#tab-streets [data-do^="POST /v1/crimes/"]:enabled').first().click();
    const failed = await (await failureResponse).json();
    assert.equal(failed.success, false); assert.equal(typeof failed.decisionContext.probability, 'number');
  } finally { Math.random = random; }
  await page.locator('.tab.on [data-ux-tactics] .ux-tactics-setback summary').waitFor();
  const resultClose = page.locator('.modal-bg:not(.hidden) [data-x],.modal-bg:not(.hidden) [data-no]').last();
  await resultClose.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await resultClose.isVisible()) await resultClose.click();
  await page.keyboard.press('Escape');
  await page.locator('.tab.on .ux-tactics-setback summary').click();
  assert.match(await page.locator('.tab.on .ux-tactics-setback').innerText(), /No individual modifier is proven to have caused the failure/);
  assert.deepEqual(faults, []);
  console.log(`Tactics real-page browser checks passed. Screenshots: ${artifacts}`);
} finally { await browser?.close(); await app.close(); }
