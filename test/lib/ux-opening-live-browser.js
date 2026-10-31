// The opening journey against the unchanged application page and real disposable API.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from '../server-fixture.js';

export async function runOpeningLiveBrowserProof() {
  assert(!process.env.DATABASE_URL, 'Opening journey proof requires disposable pg-mem.');
  process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off'; process.env.CLUE_DROP_P = '0';
  const executablePath = process.env.CHROMIUM_PATH || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ].find(existsSync);
  assert(executablePath, 'Set CHROMIUM_PATH for the real-page opening journey proof.');
  const app = await buildServer(), pool = app.pool, artifacts = mkdtempSync(path.join(tmpdir(), 'omerta-ux-opening-'));
  let browser;
  const api = async (method, url, token, payload) => {
    const response = await app.inject({ method, url, payload, headers: token ? { authorization: 'Bearer ' + token } : {} });
    assert.equal(response.statusCode, 200, `${method} ${url}: ${response.body}`);
    return response.json();
  };
  const createPlayer = async name => {
    const { token } = await api('POST', '/v1/auth/guest');
    await api('POST', '/v1/character', token, { name });
    const character = (await api('GET', '/v1/me', token)).character;
    return { token, character };
  };
  const openTab = async (page, tab) => {
    await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill(tab);
    await page.locator(`#jump-list [data-jump="${tab}"]`).first().click();
    await page.locator(`#tab-${tab}.on`).waitFor();
  };
  const openDetails = async locator => { if (!await locator.evaluate(node => node.open)) await locator.locator(':scope > summary').click(); };
  const opening = (page, tab) => page.locator(`#tab-${tab} [data-ux-progression="opening"] .ux-opening`);
  const economy = async id => ({
    cash: Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [id])).rows[0].cash),
    assets: (await pool.query('SELECT asset_id FROM character_assets WHERE character_id=$1 ORDER BY asset_id', [id])).rows,
    transactions: Number((await pool.query('SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1', [id])).rows[0].n),
  });
  try {
    const alice = await createPlayer('Opening Journey Reader');
    await pool.query("UPDATE characters SET respect=0,cash=5099,muscle=1,cunning=1,speed=1,energy=50,nerve=20,health=100,heat=0,loc='docks',last_accrued_at=$2 WHERE id=$1", [alice.character.id, new Date()]);
    const initial = await economy(alice.character.id);
    await app.listen({ host: '127.0.0.1', port: 0 });
    const base = 'http://127.0.0.1:' + app.server.address().port;
    browser = await chromium.launch({ executablePath, headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.addInitScript(token => {
      if (!localStorage.getItem('omerta_token')) localStorage.setItem('omerta_token', token);
      for (const key of ['omerta_tour2', 'omerta_welcomed', 'omerta_alltabs']) localStorage.setItem(key, '1');
    }, alice.token);
    const page = await context.newPage(), errors = [], mutations = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (request.method() === 'POST' && (/^\/v1\/crimes\//.test(url.pathname) || /^\/v1\/assets\/[^/]+\/buy$/.test(url.pathname))) mutations.push(url.pathname);
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('#screen-main:not(.hidden)').waitFor();
    await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(node => node.classList.add('hidden')));
    await openTab(page, 'start');
    await openDetails(opening(page, 'start'));
    const quoteResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/ux/tactics' && response.status() === 200);
    await opening(page, 'start').getByRole('button', { name: 'Find a useful upgrade', exact: true }).click();
    const quote = await (await quoteResponse).json();
    assert.equal(quote.tactics.characterId, alice.character.id, 'The real nested tactics response is used.');
    const beater = quote.tactics.openingUpgrades.find(offer => offer.id === 'beater');
    assert.deepEqual(beater.cost, { price: 5000, fee: 50, tax: 50, total: 5100 });
    assert.equal(beater.affordable, false);
    await opening(page, 'start').getByLabel('Choose your first upgrade').selectOption('beater');
    await opening(page, 'start').getByRole('button', { name: 'Start this journey', exact: true }).click();
    await opening(page, 'start').locator('.ux-opening-budget').waitFor();
    assert.match(await opening(page, 'start').locator('.ux-opening-budget').innerText(), /5,100.*100 house take/);
    assert.equal(await opening(page, 'start').locator('[data-complete=true]').count(), 0);
    assert.equal(mutations.length, 0, 'Selecting and starting the journey never executes a game action.');
    assert.deepEqual(await economy(alice.character.id), initial);

    await opening(page, 'start').getByRole('button', { name: 'Choose a street job', exact: true }).click();
    await page.locator('#tab-streets.on').waitFor();
    assert.equal(mutations.length, 0, 'The journey only navigates to the original job controls.');
    const random = Math.random;
    let job;
    try {
      Math.random = () => 0.01;
      const result = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/crimes/pick' && response.request().method() === 'POST');
      await page.locator('#tab-streets [data-do="POST /v1/crimes/pick"].prime:enabled').click();
      job = await (await result).json();
      assert.equal(job.success, true); assert(job.take > 0);
      await page.waitForFunction(() => document.body.style.cursor !== 'progress');
    } finally { Math.random = random; }
    await page.waitForFunction(() => document.querySelectorAll('#tab-streets .ux-opening-steps [data-complete=true]').length === 1);
    await openDetails(opening(page, 'streets'));
    const beforePurchase = (await api('GET', '/v1/me', alice.token)).character;
    assert(beforePurchase.cash >= 5100); assert(!beforePurchase.assets.includes('beater'));
    await opening(page, 'streets').getByRole('button', { name: 'Review this purchase', exact: true }).click();
    await page.locator('#tab-empire.on').waitFor();
    const originalBuy = page.locator('#tab-empire [data-asbuy="beater"]');
    await originalBuy.waitFor();
    assert.equal(await originalBuy.evaluate(node => node === document.activeElement), true);
    assert.deepEqual(mutations, ['/v1/crimes/pick'], 'Review focuses the original purchase button without buying.');
    const purchaseResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/assets/beater/buy' && response.request().method() === 'POST');
    await originalBuy.click();
    const purchase = await (await purchaseResponse).json();
    assert.equal(purchase.asset, 'beater'); assert.equal(purchase.spent, 5100);
    await page.waitForFunction(() => document.querySelectorAll('#tab-empire .ux-opening-steps [data-complete=true]').length === 3);
    await openDetails(opening(page, 'empire'));
    const afterPurchase = (await api('GET', '/v1/me', alice.token)).character;
    assert.equal(beforePurchase.cash - afterPurchase.cash, 5100);
    assert(afterPurchase.assets.includes('beater'));
    assert.equal(afterPurchase.stats.speed, beforePurchase.stats.speed, 'The purchase changes effective capability, not the underlying trained stat.');
    assert.equal(afterPurchase.eff.speed - beforePurchase.eff.speed, 2);
    assert.match(await opening(page, 'empire').locator('.ux-opening-steps').innerText(), /speed: 1 → 3/);
    assert.match(await opening(page, 'empire').locator('.ux-opening-complete').innerText(), /Journey complete/);
    assert.deepEqual(mutations, ['/v1/crimes/pick', '/v1/assets/beater/buy']);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'The real opening journey fits a 390px phone.');
    await opening(page, 'empire').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'opening-complete-mobile.png'), fullPage: false });
    await opening(page, 'empire').screenshot({ path: path.join(artifacts, 'opening-complete-panel.png') });
    console.log('Opening real-page: confirmed job, exact $5,100 purchase, effective speed 1→3 and 390px completion passed.');

    // The authenticated workspace must persist the actual confirmed journey.
    let saved;
    for (let attempt = 0; attempt < 30; attempt++) {
      saved = await api('GET', '/v1/ux/workspace', alice.token);
      if (saved.values?.progression?.opening?.gain) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(saved.values.progression.opening.actor, `${alice.character.id}:1`);
    assert.equal(saved.values.progression.opening.purchase.spent, 5100);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor();
    await openTab(page, 'start');
    await page.waitForFunction(() => document.querySelectorAll('#tab-start .ux-opening-steps [data-complete=true]').length === 3);

    // The unchanged application's authenticated queue is serial. Character changes are
    // checked through actual refreshed sessions rather than an impossible parallel read.
    await pool.query('UPDATE characters SET generation=2 WHERE id=$1', [alice.character.id]);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor();
    await openTab(page, 'start'); await openDetails(opening(page, 'start'));
    assert.equal(await opening(page, 'start').getAttribute('data-opening-actor'), `${alice.character.id}:2`);
    assert.equal(await opening(page, 'start').locator('[data-complete=true]').count(), 0);
    const currentQuote = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/ux/tactics' && response.status() === 200);
    await opening(page, 'start').getByRole('button', { name: 'Find a useful upgrade', exact: true }).click();
    const currentOffers = (await (await currentQuote).json()).tactics;
    assert.equal(currentOffers.characterId, alice.character.id);
    assert(!currentOffers.openingUpgrades.some(offer => offer.id === 'beater'), 'Fresh server quotes exclude the asset actually purchased in the earlier generation.');
    await opening(page, 'start').getByLabel('Choose your first upgrade').selectOption('wasp');
    await opening(page, 'start').getByRole('button', { name: 'Start this journey', exact: true }).click();
    await opening(page, 'start').locator('.ux-opening-budget').waitFor();
    assert.equal(await opening(page, 'start').locator('[data-complete=true]').count(), 0);

    const bob = await createPlayer('Opening Journey Stranger');
    await page.evaluate(token => localStorage.setItem('omerta_token', token), bob.token);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor();
    await openTab(page, 'start');
    await page.waitForFunction(id => document.querySelector('#tab-start .ux-opening')?.dataset.openingActor === `${id}:1`, bob.character.id);
    assert.equal(await opening(page, 'start').locator('[data-complete=true]').count(), 0);
    assert.equal(await opening(page, 'start').locator('.ux-opening-complete').count(), 0);
    assert.deepEqual(mutations, ['/v1/crimes/pick', '/v1/assets/beater/buy'], 'Reloads, fresh quotes and account changes do not issue game actions.');
    assert.deepEqual(errors, []);
    console.log(`Opening real-page browser passed: original job→$5,100 asset buy→effective speed 1→3, authenticated nested quotes and actual limited receipts, manual controls, persisted completion, account/generation/source fences, 390px layout. Screenshots: ${artifacts}`);
  } catch (error) {
    console.error('Opening real-page proof failed:', error.message); throw error;
  } finally { await browser?.close(); app.server.closeIdleConnections?.(); await app.close(); }
}
