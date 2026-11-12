// Retired planning UI stays absent; native controls and authenticated previews remain authoritative.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';
import { PORT } from '../src/rules.js';

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
try {
  const guest = await api('POST', '/v1/auth/guest'); const token = guest.body.token;
  const created = await api('POST', '/v1/character', token, { name: 'Tactics Browser Reader' });
  assert.equal(created.code, 200, JSON.stringify(created.body));
  const row = (await pool.query('SELECT * FROM characters WHERE name=$1', ['Tactics Browser Reader'])).rows[0];
  await pool.query("UPDATE characters SET loc='docks',respect=1960,cunning=8,speed=7,cash=500000,energy=25,nerve=20,health=55,heat=12,last_accrued_at=$2 WHERE id=$1", [row.id, new Date()]);
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce', locale: 'en-US', serviceWorkers: 'block' });
  await context.addInitScript(token => {
    localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1');
    localStorage.setItem('omerta_welcomed', '1'); localStorage.setItem('omerta_alltabs', '1');
  }, token);
  const page = await context.newPage(), faults = [], mutations = [], retiredRequests = [];
  page.on('pageerror', error => faults.push(error.message));
  page.on('request', request => { if (request.method() === 'POST' && /\/v1\/(crimes|train|items|port|skills)/.test(request.url())) mutations.push(request.url()); });
  page.on('request', request => { if (/\/ux-tactics\.(js|css)(?:\?|$)/.test(request.url())) retiredRequests.push(request.url()); });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('#screen-main:not(.hidden)').waitFor();
  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(node => node.classList.add('hidden')));
  const noPlanningUi = async () => {
    assert.equal(await page.locator('[data-ux-tactics]').count(), 0, 'Navigation never remounts the retired Planning Table.');
    assert.equal(await page.locator('script[src*="ux-tactics.js"],link[href*="ux-tactics.css"]').count(), 0);
    assert.deepEqual(retiredRequests, [], 'The live shell never downloads retired planning assets.');
  };
  const openJobs = async () => {
    await openTab(page, 'streets');
    await page.locator('#tab-streets .noir-job-card').first().waitFor();
    const fullBook = page.locator('#tab-streets details[data-sect="crimes-all"]');
    if (await fullBook.count() && !await fullBook.evaluate(node => node.open)) await fullBook.locator(':scope > summary').click();
    await page.locator('#tab-streets [data-do="POST /v1/crimes/pick"].prime:enabled').waitFor();
  };
  const navigationEconomy = await economicSnapshot(row.id);
  for (const viewport of [{ width: 1440, height: 1050 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await openJobs();
    const pick = page.locator('#tab-streets .noir-job-card').filter({ has: page.locator('[data-do="POST /v1/crimes/pick"]') });
    assert.equal(await pick.locator('[data-do="POST /v1/crimes/pick"]:enabled').count(), 3, 'Quiet, standard and loud remain real enabled actions.');
    const terms = await pick.locator('.operation-action-terms').innerText();
    assert.match(terms, /COST\s+2 nerve/);
    assert.match(terms, /BASELINE WIN\s+\$40[-–]\$120/);
    assert.match(terms, /no jail term/);
    assert.match(terms, /QUIET.*safer.*STANDARD.*baseline.*LOUD.*heat/s);
    assert.match(await page.locator('#tab-streets #crime-stereo-terms').innerText(), /3 nerve.*jail on a miss/s);
    const gym = page.locator('#tab-streets details[data-sect="streets-train"]');
    if (!await gym.evaluate(node => node.open)) await gym.locator(':scope > summary').click();
    const train = page.locator('#tab-streets [data-do="POST /v1/train/muscle"]');
    assert.equal(await train.isEnabled(), true);
    const trainingTerms = await train.getAttribute('aria-describedby');
    assert.match(await page.locator(`#${trainingTerms}`).innerText(), /10 energy per session.*recovery clock/s);
    await noPlanningUi();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Native job choices fit the viewport.');
    await pick.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, `native-streets-${viewport.width}.png`) });

    await openTab(page, 'port');
    const route = page.locator('#tab-port .pt-route[data-for="working-tactics-boat"]');
    await route.waitFor();
    assert.match(await route.locator('option').first().innerText(), /buy \$[\d,]+\/u.*sell \$[\d,]+\/u.*[\d.]+% caught/);
    const escort = page.locator('#tab-port .pt-esc[data-for="working-tactics-boat"]');
    assert((await escort.locator('..').innerText()).includes(`escort +$${PORT.ESCORT_COST.toLocaleString('en-US')}`));
    assert.equal(await page.locator('#tab-port [data-run="working-tactics-boat"]').isEnabled(), true);
    await escort.check(); await escort.uncheck();
    await noPlanningUi();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Native port controls fit the viewport.');
    await page.screenshot({ path: path.join(artifacts, `native-port-${viewport.width}.png`) });
  }
  assert.equal(mutations.length, 0, 'Navigation and choosing an escort do not execute any economic action.');
  assert.deepEqual(await economicSnapshot(row.id), navigationEconomy, 'Browsing native jobs and sea lanes preserves inventory, skills, boats and the ledger.');

  // Keep real success/failure coverage on the original action buttons and the
  // current feedback receipt, without restoring the retired planning module.
  await page.setViewportSize({ width: 1440, height: 1050 });
  for (const [crimeId, roll, success, nerve] of [['pick', 0.01, true, 2], ['stereo', 0.99999, false, 3]]) {
    await pool.query('UPDATE characters SET street_action_at=NULL WHERE id=$1', [row.id]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#screen-main:not(.hidden)').waitFor();
    await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(node => node.classList.add('hidden')));
    await openJobs();
    const before = (await api('GET', '/v1/me', token)).body;
    const beforeCharacter = before.character || before;
    const originalRandom = Math.random;
    let outcome;
    try {
      Math.random = () => roll;
      const confirmed = page.waitForResponse(response => response.url().endsWith(`/v1/crimes/${crimeId}`) && response.request().method() === 'POST');
      await page.locator(`#tab-streets [data-do="POST /v1/crimes/${crimeId}"].prime:enabled`).click();
      const response = await confirmed;
      assert.equal(response.status(), 200);
      outcome = await response.json();
    } finally { Math.random = originalRandom; }
    assert.equal(outcome.success, success, 'The original action reaches the real deterministic game outcome.');
    assert.equal(outcome.decisionContext.crimeId, crimeId);
    assert.equal(outcome.decisionContext.cost.nerve, nerve, 'The confirmed attempt retains its listed nerve cost.');
    assert(outcome.decisionContext.probability > 0 && outcome.decisionContext.probability < 1);
    assert(Number.isFinite(Date.parse(outcome.decisionContext.projectedAt)));
    assert(Array.isArray(outcome.decisionContext.modifiers));
    if (!success) {
      assert(outcome.decisionContext.jailSecondsOnFailure > 0, 'The failed job retains its pre-action jail risk.');
      assert.match(outcome.decisionContext.note, /failed roll does not identify one modifier as its cause/);
    }
    const receipt = page.locator(`#operation-latest .operation-receipt--${success ? 'success' : 'setback'}`);
    await receipt.waitFor();
    const after = (await api('GET', '/v1/me', token)).body;
    const afterCharacter = after.character || after;
    if (success) {
      const net = Number(afterCharacter.cash) - Number(beforeCharacter.cash);
      assert(net > 0, 'A confirmed successful job changes the real cash balance.');
      assert.equal(await receipt.locator('.ux-receipt-outcome').innerText(), `+$${net.toLocaleString('en-US', { maximumFractionDigits: 2 })} pocket change`);
      await receipt.locator('.ux-receipt-details > summary').click();
      assert.match(await receipt.locator('.ux-receipt-books').innerText(), /Reported payout.*net pocket change/);
    } else {
      assert.match(await receipt.locator('.ux-receipt-outcome').innerText(), /job went sideways/);
      assert((await receipt.locator('.operation-receipt__summary').innerText()).trim());
      assert((await receipt.locator('.operation-receipt__delta').innerText()).trim());
    }
    assert.match(await receipt.locator('.ux-changes').innerText(), new RegExp(`nerve\\s+[-−]${nerve}(?:\\D|$)`));
    await noPlanningUi();
  }
  assert.equal(mutations.length, 2, 'Only the two deliberately clicked jobs perform economic mutations.');
  assert.deepEqual(faults, []);
  console.log(`Tactics real-page browser checks passed: read-only API previews, retired UI/assets absent, native desktop/mobile costs and risks, navigation isolation, actual success/failure and confirmed receipts. Screenshots: ${artifacts}`);
} finally { await browser?.close(); await app.close(); }
