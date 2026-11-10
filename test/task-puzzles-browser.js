import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';
import { solveTaskPuzzle } from './lib/task-puzzle-solver.js';
import { hustleOf, dayOf, MISSIONS } from '../src/rules.js';

assert(!process.env.DATABASE_URL, 'Task puzzle browser tests use disposable pg-mem only.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off'; process.env.CLUE_DROP_P = '0';
const executablePath = process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium.');
const app = await buildServer(), errors = [], requests = [], artifacts = '.superpowers/sdd/2026-11-10-task-puzzles/screenshots';
fs.mkdirSync(artifacts, { recursive: true });
let browser, page;
const api = async (method, url, token, payload) => {
  const r = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal(r.statusCode, 200, `${url}: ${r.body}`); return r.json();
};
const dialog = () => page.getByRole('dialog', { name: /Task puzzle/ });
const draftOf = () => dialog().locator('form').evaluate(n => ({ fields: [...new FormData(n).entries()], route: n.querySelector('fieldset ol')?.textContent || '' }));
const navigate = async name => {
  await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill(name);
  await page.locator(`#jump-list [data-jump="${name}"]`).first().click();
  await page.waitForLoadState('networkidle');
};
const missions = async () => {
  await navigate('start');
  const section = page.locator('details[data-sect="start-missions"]');
  if (!await section.evaluate(n => n.open)) await section.locator(':scope > summary').click();
};
const crimeBook = async () => {
  const section = page.locator('details[data-sect="crimes-all"]');
  if (await section.count() && !await section.evaluate(n => n.open)) await section.locator(':scope > summary').click();
};
const puzzleOf = async (scope, targetId, token) => (await api('GET', `/v1/task-puzzles?scope=${scope}&targetId=${targetId}`, token)).puzzle;
const choose = async (puzzle, answer = solveTaskPuzzle(puzzle).answer, keyboard = false) => {
  const card = dialog();
  const activate = async locator => { if (keyboard) { await locator.focus(); await page.keyboard.press('Space'); } else await locator.click(); };
  if (puzzle.kind === 'patrol') await activate(card.locator(`input[value="${answer.start}"]`));
  if (puzzle.kind === 'evidence') await activate(card.locator(`input[value="${answer.suspect}"]`));
  if (puzzle.kind === 'matching') for (const pair of answer.pairs) {
    const select = card.locator(`select[data-match="${pair.left}"]`);
    if (keyboard) {
      await select.focus(); await page.keyboard.press('Home');
      const values = await select.locator('option').evaluateAll(nodes => nodes.map(n => n.value));
      for (let i = 0; i < values.indexOf(pair.right); i++) await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Tab');
    } else await select.selectOption(pair.right);
  }
  if (puzzle.kind === 'route') {
    await activate(card.getByRole('button', { name: 'Reset route', exact: true }));
    assert.equal(await card.locator('[data-route-reset]').evaluate(n => document.activeElement === n), true, 'Reset route keeps keyboard focus on an enabled control.');
    for (const id of answer.path.slice(1)) await activate(card.locator(`[data-route-add="${id}"]`));
  }
  if (page.viewportSize().width === 390) {
    await card.locator('button[type="submit"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${artifacts}/mobile-${puzzle.kind}-controls.png` });
  }
};
const fit = async puzzle => {
  assert.equal(await dialog().getAttribute('data-task-puzzle'), puzzle.kind);
  assert(await dialog().evaluate(n => n.scrollWidth <= n.clientWidth + 2), 'Puzzle fits its mobile width.');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Production page has no horizontal overflow.');
  const targets = await dialog().locator('button, select, .task-puzzle-choice').evaluateAll(ns => ns.filter(n => n.getClientRects().length).map(n => n.getBoundingClientRect().height));
  assert(targets.every(height => height >= 44), `Touch controls are at least 44px: ${targets}`);
  await page.screenshot({ path: `${artifacts}/mobile-${puzzle.kind}.png`, fullPage: false });
};
try {
  const { token } = await api('POST', '/v1/auth/guest');
  await api('POST', '/v1/character', token, { name: 'Task Browser Player' });
  const ch = (await app.pool.query("SELECT * FROM characters WHERE name='Task Browser Player'")).rows[0];
  await app.pool.query('UPDATE characters SET respect=10000,cunning=100,speed=100,muscle=100,cash=50000,nerve=50,mission_at=NULL WHERE id=$1', [ch.id]);
  await app.listen({ host: '127.0.0.1', port: 0 });
  browser = await chromium.launch({ executablePath, headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true });
  page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.method() === 'POST') requests.push({ url: new URL(r.url()).pathname, body: r.postDataJSON(), key: r.headers()['idempotency-key'] }); });
  await page.addInitScript(token => { localStorage.setItem('omerta_token', token); for (const key of ['omerta_tour2', 'omerta_welcomed', 'omerta_alltabs']) localStorage.setItem(key, '1'); }, token);
  await page.goto(`http://127.0.0.1:${app.server.address().port}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#screen-main:not(.hidden)').waitFor();
  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(n => n.classList.add('hidden')));
  await missions();
  const trigger = page.locator('[data-mission="m2"]');
  await trigger.click();
  await dialog().waitFor();
  assert.equal(await trigger.getAttribute('data-mission'), 'm2', 'Actual Family Missions control opens the puzzle.');
  await dialog().getByRole('button', { name: 'Solve and attempt mission' }).waitFor();
  const first = await puzzleOf('mission', 'm2', token), seen = new Set([first.kind]);
  await fit(first);
  await dialog().getByText('A hint, if you need it', { exact: true }).click();
  assert.equal(await dialog().locator('.task-puzzle-hint').evaluate(n => n.open), true);
  await choose(first);
  const draftBefore = await draftOf();
  await page.keyboard.press('Escape'); assert.equal(await dialog().count(), 0);
  assert.equal(requests.filter(r => r.url === '/v1/missions/m2').length, 0, 'Dismissal never executes the mission.');
  await page.waitForFunction(() => document.activeElement?.dataset.mission === 'm2');
  assert.equal(await trigger.evaluate(n => n === document.activeElement), true, 'Dismissal restores focus even if the board was refreshed.');
  await trigger.click(); await dialog().getByRole('button', { name: 'Solve and attempt mission' }).waitFor();
  assert.deepEqual(await draftOf(), draftBefore, 'Reopen preserves the answer draft.');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await missions();
  await page.locator('[data-mission="m2"]').click(); await dialog().getByRole('button', { name: 'Solve and attempt mission' }).waitFor();
  assert.deepEqual(await puzzleOf('mission', 'm2', token), first, 'Refresh resumes exactly the issued challenge.');
  assert.deepEqual(await draftOf(), draftBefore);
  // A dismissed slow issuance cannot replace a newer task's dialog.
  await page.keyboard.press('Escape');
  let releaseIssue, issueReady;
  const issueHeld = new Promise(r => { issueReady = r; }), issueGate = new Promise(r => { releaseIssue = r; });
  await page.route('**/v1/task-puzzles', async route => {
    if (route.request().postDataJSON()?.targetId !== 'm2') return route.continue();
    const reply = await route.fetch(); issueReady(); await issueGate; await route.fulfill({ response: reply });
  });
  await page.locator('[data-mission="m2"]').click(); await issueHeld;
  await dialog().getByRole('button', { name: 'Close puzzle' }).click();
  await page.locator('[data-mission="m11"]').click(); releaseIssue();
  await dialog().getByRole('button', { name: 'Solve and attempt mission' }).waitFor();
  assert.equal(await dialog().locator('.task-puzzle-eyebrow').innerText(), MISSIONS.find(m => m.id === 'm11').name.toUpperCase(), 'Only the newer mission is rendered.');
  await page.unroute('**/v1/task-puzzles'); await page.keyboard.press('Escape');
  await page.locator('[data-mission="m2"]').click(); await dialog().getByRole('button', { name: 'Solve and attempt mission' }).waitFor();
  // Submit an incomplete draft: real server refusal, no client completion flags or mutation.
  await dialog().getByRole('button', { name: 'Clear answer' }).click();
  const wrong = page.waitForResponse(r => r.url().endsWith('/v1/missions/m2') && r.request().method() === 'POST');
  await dialog().getByRole('button', { name: 'Solve and attempt mission' }).click();
  assert.equal((await (await wrong).json()).error, 'bad_task_puzzle_answer');
  await dialog().getByRole('status').filter({ hasText: 'does not satisfy' }).waitFor();
  assert.equal((await puzzleOf('mission', 'm2', token)).status, 'issued');
  await choose(first, undefined, true);
  // Hold an actual committed response so repeated activation and a lost reply are exercised.
  let release, ready;
  const held = new Promise(r => { ready = r; }), gate = new Promise(r => { release = r; });
  await page.route('**/v1/missions/m2', async route => { await route.fetch(); ready(); await gate; await route.abort('failed'); });
  const before = Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [ch.id])).rows[0].cash);
  await dialog().getByRole('button', { name: 'Solve and attempt mission' }).focus(); await page.keyboard.press('Enter'); await held;
  assert.equal(await dialog().locator('form').getAttribute('aria-busy'), 'true');
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  assert.equal(requests.filter(r => r.url === '/v1/missions/m2').length, 2, 'Only wrong plus one pending mission request.');
  release(); await dialog().getByRole('button', { name: 'Check task status' }).waitFor();
  await page.unroute('**/v1/missions/m2');
  await dialog().getByRole('button', { name: 'Check task status' }).click();
  await dialog().getByRole('status').filter({ hasText: 'recorded' }).waitFor();
  const after = Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [ch.id])).rows[0].cash);
  assert.equal(after - before, MISSIONS.find(m => m.id === 'm2').reward.cash, 'Uncertain response recovery pays exactly once.');
  assert.equal(requests.filter(r => r.url === '/v1/missions/m2').length, 2, 'Status recovery never resends a job.');
  await page.keyboard.press('Escape');
  for (const id of ['m11', 'm12']) {
    await app.pool.query('UPDATE characters SET mission_at=NULL WHERE id=$1', [ch.id]);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await missions();
    await page.locator(`[data-mission="${id}"]`).click(); await dialog().getByRole('button', { name: 'Solve and attempt mission' }).waitFor();
    const puzzle = await puzzleOf('mission', id, token); seen.add(puzzle.kind); await fit(puzzle); await choose(puzzle);
    await dialog().getByRole('button', { name: 'Clear answer' }).click(); await choose(puzzle, undefined, true);
    const result = page.waitForResponse(r => r.url().endsWith(`/v1/missions/${id}`) && r.request().method() === 'POST');
    await dialog().getByRole('button', { name: 'Solve and attempt mission' }).focus(); await page.keyboard.press('Enter');
    assert.equal((await result).status(), 200); await dialog().getByRole('status').filter({ hasText: 'recorded' }).waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(id => document.querySelector(`[data-mission="${id}"]`)?.disabled, id);
    assert.equal(await page.locator(`[data-mission="${id}"]`).isDisabled(), true, 'Known success repaints the current mission board with the cooldown after dismissal.');
    assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY', 'Completed-task dismissal focuses a current enabled board control.');
  }
  const hustle = hustleOf(ch.id, dayOf());
  await app.pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [ch.id, hustle.stops[0]]);
  await api('POST', '/v1/hustle/advance', token, {});
  await app.pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [ch.id, hustle.stops[1]]);
  await app.pool.query('INSERT INTO daily_progress (character_id,day,counters) VALUES ($1,$2,$3) ON CONFLICT (character_id,day) DO UPDATE SET counters=$3', [ch.id, dayOf(), JSON.stringify({ [hustle.leg.kind]: 10 })]);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await navigate('streets');
  await page.locator('#hu-go').click(); await dialog().getByRole('button', { name: 'Solve and check in' }).waitFor();
  const hp = await puzzleOf('hustle', 'legwork', token); seen.add(hp.kind); await fit(hp); await choose(hp);
  await dialog().getByRole('button', { name: 'Clear answer' }).click(); await choose(hp, undefined, true);
  await dialog().getByRole('button', { name: 'Solve and check in' }).focus(); await page.keyboard.press('Enter');
  await dialog().getByRole('status').filter({ hasText: 'recorded' }).waitFor();
  assert.equal(Number((await app.pool.query('SELECT step FROM hustles WHERE character_id=$1 AND day=$2', [ch.id, dayOf()])).rows[0].step), 2);
  assert.equal(seen.size, 4, 'All four different mechanics played through actual mission and Hustle controls.');
  await page.keyboard.press('Escape');
  await page.getByText('Stop 3 of 3', { exact: true }).waitFor();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await app.pool.query('UPDATE characters SET street_action_at=NULL,jail_until=NULL,nerve=50 WHERE id=$1', [ch.id]);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await navigate('streets');
  await crimeBook(); await page.locator('[data-task-crime="pick"]').click(); await dialog().getByRole('button', { name: 'Solve and attempt crime' }).waitFor();
  assert.match(await dialog().innerText(), /feedback only.*no.*odds.*reward/i);
  const cp = await puzzleOf('crime', 'pick', token); await choose(cp);
  await page.screenshot({ path: `${artifacts}/desktop-crime-preparation.png` });
  // A different committed attempt makes the open preparation stale. Never automatically reroll/resubmit.
  await api('POST', '/v1/crimes/pick', token, {});
  await app.pool.query('UPDATE characters SET street_action_at=NULL,jail_until=NULL,nerve=50 WHERE id=$1', [ch.id]);
  const stale = page.waitForResponse(r => r.url().endsWith('/v1/crimes/pick') && r.request().method() === 'POST');
  await dialog().getByRole('button', { name: 'Solve and attempt crime' }).click();
  assert.equal((await (await stale).json()).error, 'stale_task_puzzle');
  await dialog().getByRole('button', { name: 'Reopen current task' }).click();
  await dialog().getByRole('button', { name: 'Solve and attempt crime' }).waitFor();
  const current = await puzzleOf('crime', 'pick', token); assert.notEqual(current.id, cp.id); await choose(current);
  await dialog().getByLabel('Crime approach').selectOption('quiet');
  const revisionBefore = Number((await app.pool.query('SELECT crime_puzzle_revision FROM characters WHERE id=$1', [ch.id])).rows[0].crime_puzzle_revision);
  await page.route('**/v1/crimes/pick', route => route.abort('failed'));
  await dialog().getByRole('button', { name: 'Solve and attempt crime' }).click();
  await dialog().getByRole('button', { name: 'Check task status' }).waitFor();
  await page.unroute('**/v1/crimes/pick');
  const originalAttempt = requests.filter(r => r.url === '/v1/crimes/pick').at(-1);
  assert.equal(originalAttempt.body.approach, 'quiet', 'Optional preparation preserves the explicitly selected approach.');
  // Reload while a submission has an unknown outcome. The same draft and exact request key survive.
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await navigate('streets'); await crimeBook();
  await page.locator('[data-task-crime="pick"]').click(); await dialog().getByRole('button', { name: 'Check task status' }).waitFor();
  assert.equal((await puzzleOf('crime', 'pick', token)).id, current.id);
  assert.equal(await dialog().getByLabel('Crime approach').inputValue(), 'quiet', 'Recovery displays the approach that will actually be retried.');
  await page.route('**/v1/task-puzzles?*', route => route.abort('failed'));
  await dialog().getByRole('button', { name: 'Check task status' }).click();
  await dialog().getByRole('status').filter({ hasText: 'Status is unavailable' }).waitFor();
  assert.equal(await dialog().getByRole('button', { name: 'Solve and attempt crime' }).isDisabled(), true);
  await page.unroute('**/v1/task-puzzles?*');
  await dialog().getByRole('button', { name: 'Check task status' }).click();
  await dialog().getByRole('button', { name: 'Retry same submission' }).waitFor();
  const prepared = page.waitForResponse(r => r.url().endsWith('/v1/crimes/pick') && r.request().method() === 'POST');
  await dialog().getByRole('button', { name: 'Retry same submission' }).click();
  assert.equal((await (await prepared).json()).puzzle.completed, true);
  const retryAttempt = requests.filter(r => r.url === '/v1/crimes/pick').at(-1);
  assert.deepEqual(retryAttempt, originalAttempt, 'Uncertain retry uses the exact original request key, answer and approach.');
  await dialog().getByRole('status').filter({ hasText: 'recorded' }).waitFor(); await page.keyboard.press('Escape');
  assert.equal(Number((await app.pool.query('SELECT crime_puzzle_revision FROM characters WHERE id=$1', [ch.id])).rows[0].crime_puzzle_revision), revisionBefore + 1, 'One committed prepared attempt after failed dispatch and reload.');
  for (const recovery of ['dismissal', 'reload']) {
    await app.pool.query('UPDATE characters SET street_action_at=NULL,jail_until=NULL,nerve=50 WHERE id=$1', [ch.id]);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await navigate('streets'); await crimeBook();
    await page.locator('[data-task-crime="pick"]').click(); await dialog().getByRole('button', { name: 'Solve and attempt crime' }).waitFor();
    const pendingPuzzle = await puzzleOf('crime', 'pick', token); await choose(pendingPuzzle);
    const revision = Number((await app.pool.query('SELECT crime_puzzle_revision FROM characters WHERE id=$1', [ch.id])).rows[0].crime_puzzle_revision);
    const crimeRequests = requests.filter(r => r.url === '/v1/crimes/pick').length;
    await page.route('**/v1/crimes/pick', async route => {
      const committed = await route.fetch();
      assert.equal(committed.status(), 200); assert.equal((await committed.json()).puzzle.completed, true);
      await route.abort('failed');
    });
    await dialog().getByRole('button', { name: 'Solve and attempt crime' }).click();
    await dialog().getByRole('button', { name: 'Check task status' }).waitFor();
    await page.unroute('**/v1/crimes/pick');
    // Only readiness changes: the committed attempt's occurrence revision is deliberately retained.
    await app.pool.query('UPDATE characters SET street_action_at=NULL,jail_until=NULL,nerve=50 WHERE id=$1', [ch.id]);
    const issues = requests.filter(r => r.url === '/v1/task-puzzles').length;
    if (recovery === 'reload') {
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await navigate('streets'); await crimeBook();
    } else await page.keyboard.press('Escape');
    await page.locator('[data-task-crime="pick"]').click(); await dialog().waitFor(); await page.waitForLoadState('networkidle');
    assert.equal(requests.filter(r => r.url === '/v1/task-puzzles').length, issues,
      `${recovery}: unresolved committed crime is discovered by task selector before issuing any new puzzle.`);
    await dialog().getByRole('status').filter({ hasText: 'occurrence changed' }).waitFor();
    assert.equal(await dialog().getByRole('button', { name: 'Solve and attempt crime' }).isDisabled(), true);
    assert.equal(await puzzleOf('crime', 'pick', token), null, 'Receipt reconciliation must not itself issue the new occurrence.');
    assert.equal(requests.filter(r => r.url === '/v1/crimes/pick').length, crimeRequests + 1, 'Recovery never resends the committed crime.');
    assert.equal(Number((await app.pool.query('SELECT crime_puzzle_revision FROM characters WHERE id=$1', [ch.id])).rows[0].crime_puzzle_revision), revision + 1);
    await dialog().getByRole('button', { name: 'Reopen current task' }).click();
    await dialog().getByRole('button', { name: 'Solve and attempt crime' }).waitFor();
    assert.equal(await dialog().getByRole('button', { name: 'Solve and attempt crime' }).isDisabled(), false);
    assert.notEqual((await puzzleOf('crime', 'pick', token)).id, pendingPuzzle.id, 'Only explicit reopening issues the next occurrence.');
    await page.keyboard.press('Escape');
  }
  await app.pool.query('UPDATE characters SET street_action_at=NULL,jail_until=NULL,nerve=50 WHERE id=$1', [ch.id]);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await navigate('streets');
  const ordinary = page.waitForResponse(r => r.url().endsWith('/v1/crimes/pick') && r.request().method() === 'POST');
  await crimeBook(); await page.locator('[data-do="POST /v1/crimes/pick"]').filter({ hasText: 'do it' }).first().click();
  assert.equal((await ordinary).status(), 200, 'Ordinary crime still works with no preparation.');
  assert.deepEqual(errors, []);
  console.log(`task puzzle browser: real production mission/Hustle/crime entries, four mechanics, keyboard/touch, hints, wrong retry, drafts/reload/dismissal, pending/lost-response recovery, stale reopen, one reward and mobile fit passed; screenshots ${artifacts}`);
} catch (error) { if (page) await page.screenshot({ path: `${artifacts}/failure.png` }).catch(() => {}); throw error; }
finally { if (browser) await browser.close(); await app.close(); }
