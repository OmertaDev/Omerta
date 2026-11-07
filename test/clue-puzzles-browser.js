import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';
import { cluePuzzleOf, publicCluePuzzle } from '../src/clue-puzzles.js';

assert(!process.env.DATABASE_URL, 'Clue browser verification uses disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off'; process.env.CLUE_RELIC_P = '0';
const executablePath = process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((candidate) => fs.existsSync(candidate));
assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium.');
const app = await buildServer();
let browser;
const api = async (method, url, token, payload) => {
  const reply = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal(reply.statusCode, 200, `${url}: ${reply.body}`); return reply.json();
};
try {
  const { token } = await api('POST', '/v1/auth/guest');
  await api('POST', '/v1/character', token, { name: 'Clue Browser Reader' });
  const ch = (await app.pool.query("SELECT * FROM characters WHERE name='Clue Browser Reader'")).rows[0];
  let salt;
  for (let index = 0; index < 5000; index++) {
    const candidate = `trail-v2:browser-${index}`;
    if ([1, 2, 3, 4].every((step) => !cluePuzzleOf(candidate, step).window)) { salt = candidate; break; }
  }
  assert(salt);
  await app.pool.query("INSERT INTO clue_scrolls (character_id,salt,step,steps,tier) VALUES ($1,$2,1,4,'easy')", [ch.id, salt]);
  const firstPuzzle = cluePuzzleOf(salt, 1);
  await app.pool.query('UPDATE characters SET loc=$2,energy=200 WHERE id=$1', [ch.id, firstPuzzle.district]);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(token => { localStorage.setItem('omerta_token', token); for (const key of ['omerta_tour2', 'omerta_welcomed', 'omerta_alltabs']) localStorage.setItem(key, '1'); }, token);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.evaluate(() => typeof window.renderOmertaCluePuzzle), 'function', 'the production page loads the clue renderer');
  await page.locator('#screen-main:not(.hidden)').waitFor();
  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(element => element.classList.add('hidden')));
  await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill('streets');
  await page.locator('#jump-list [data-jump="streets"]').first().click();
  const streetCard = page.locator('#tab-streets.on #clue-slot .clue-puzzle'); await streetCard.waitFor();
  assert.equal(await streetCard.getAttribute('data-clue-puzzle'), firstPuzzle.kind, 'the actual Streets renderer mounts structured clues');
  assert.ok((await streetCard.locator('.clue-puzzle-meta').first().innerText()).includes(publicCluePuzzle(firstPuzzle).kindName),
    'the production renderer displays the readable mechanic name');
  assert.equal(await page.locator('#clue-slot #clue-dig').count(), 0, 'structured clues do not expose the legacy dig bypass');
  await streetCard.locator(`input[value="${firstPuzzle.choices.find(choice => choice.id !== firstPuzzle.answerId).id}"]`).check();
  const refused = page.waitForResponse(response => response.url().endsWith('/v1/clues/answer') && response.request().method() === 'POST');
  await streetCard.getByRole('button', { name: /Submit deduction/ }).click();
  const wrongReply = await refused; assert.equal(wrongReply.status(), 200); assert.equal((await wrongReply.json()).cold, true, 'the production action pipeline preserves the step on a wrong deduction');
  assert.equal(Number((await app.pool.query('SELECT step FROM clue_scrolls WHERE character_id=$1', [ch.id])).rows[0].step), 1);
  await page.evaluate(({ token }) => {
    const slot = document.createElement('div'); slot.id = 'clue-test-slot'; slot.style.cssText = 'position:fixed;inset:0;z-index:2147483647;overflow:auto;background:#111;padding:12px;box-sizing:border-box'; document.body.append(slot);
    window.clueBrowserResults = [];
    const api = async (method, path, body) => {
      const response = await fetch(path, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const result = { code: response.status, body: await response.json() }; if (method === 'POST') clueBrowserResults.push(result); return result;
    };
    window.refreshClueBrowser = async () => {
      const board = (await api('GET', '/v1/clues')).body;
      if (board.scroll) renderOmertaCluePuzzle(slot, board, { action: api, refresh: refreshClueBrowser });
      else slot.textContent = 'The casket was found.';
    };
  }, { token });
  const seen = new Set();
  for (let step = 1; step <= 4; step++) {
    const puzzle = cluePuzzleOf(salt, step); seen.add(puzzle.kind);
    await app.pool.query('UPDATE characters SET loc=$2,energy=200 WHERE id=$1', [ch.id, puzzle.district]);
    await page.evaluate(() => refreshClueBrowser());
    const card = page.locator('#clue-test-slot .clue-puzzle');
    assert.equal(await card.getAttribute('data-clue-puzzle'), puzzle.kind);
    await card.getByText('A hint, if you need it', { exact: true }).click();
    assert.equal(await card.locator('details').evaluate((node) => node.open), true);
    if (step === 1) {
      await card.locator(`input[value="${puzzle.choices.find((choice) => choice.id !== puzzle.answerId).id}"]`).check();
      await card.getByRole('button', { name: /Submit deduction/ }).click();
      await page.waitForFunction(() => clueBrowserResults.length === 1);
      assert.equal(await page.evaluate(() => clueBrowserResults[0].body.cold), true);
      assert.equal(Number((await app.pool.query('SELECT step FROM clue_scrolls WHERE character_id=$1', [ch.id])).rows[0].step), 1);
      await page.locator('#clue-test-slot input:not(:disabled)').first().waitFor();
    }
    const before = await page.evaluate(() => clueBrowserResults.length);
    await page.locator(`#clue-test-slot input[value="${puzzle.answerId}"]`).check();
    await page.locator('#clue-test-slot').getByRole('button', { name: /Submit deduction/ }).click();
    await page.waitForFunction((length) => clueBrowserResults.length === length, before + 1);
    await page.waitForFunction(() => !document.querySelector('#clue-test-slot button:disabled'));
    assert.equal(await page.evaluate(() => clueBrowserResults.at(-1).body.ok), true);
    const width = await page.locator('#clue-test-slot').evaluate((node) => [node.scrollWidth, node.clientWidth]);
    assert(width[0] <= width[1] + 2, `the mobile clue card fits its viewport: ${width}`);
  }
  assert.equal(seen.size, 4);
  await page.getByText('The casket was found.', { exact: true }).waitFor();
  assert.equal(Number((await app.pool.query('SELECT caskets FROM account_persistent WHERE account_id=$1', [ch.account_id])).rows[0].caskets), 1);
  assert.deepEqual(errors, []);
  console.log('clue browser: authenticated production Streets renderer/action, all four real deduction interactions, hints, wrong-answer recovery, casket completion and mobile fit passed');
} finally { if (browser) await browser.close(); await app.close(); }
