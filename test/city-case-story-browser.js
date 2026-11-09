// Current production shell, real local HTTP server and native browser clicks.
// No legacy CityScene, injected action shortcuts or fabricated projections.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { CREW_CROSSCURRENT_PACKAGE } from '../src/content/crew-crosscurrent.js';

assert(!process.env.DATABASE_URL, 'Story browser proof requires disposable pg-mem.');
for (const key of ['JWT_SECRET', 'MOD_KEY', 'MARKET_SEED']) process.env[key] = crypto.randomBytes(32).toString('hex');
Object.assign(process.env, { INVITE_MODE: 'off', RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', POPULATION_OFF: 'on', CORE_PROGRESSION: 'off' });
const { buildServer } = await import('./server-fixture.js');
const { ledger } = await import('../src/game.js');
const executablePath = process.env.CHROMIUM_PATH || [chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(candidate => fs.existsSync(candidate));
assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser.');
const app = await buildServer();
let browser, currentPage;
const errors = [], legacyRequests = [], contexts = [];
try {
  await app.listen({ host: '127.0.0.1', port: 0 });
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  const call = (actor, method, url, body) => app.inject({ method, url, ...(body === undefined ? {} : { payload: body }),
    headers: { ...(actor?.headers || {}), ...(method === 'POST' ? { 'idempotency-key': crypto.randomUUID() } : {}) } });
  const ok = async promise => { const response = await promise; assert.equal(response.statusCode, 200, response.body); return response.json(); };
  const actor = async name => {
    const { token } = await ok(call(null, 'POST', '/v1/auth/guest', { birthDate: '1990-01-01' }));
    const account = app.jwt.verify(token).sub, headers = { authorization: 'Bearer ' + token };
    await ok(call({ headers }, 'POST', '/v1/character', { name }));
    const character = (await app.pool.query('SELECT id,cash FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
    await app.pool.query('UPDATE characters SET cash=100000,respect=10000,loc=$2,last_accrued_at=$3 WHERE id=$1',
      [character.id, 'docks', new Date(Date.now() + 86400000)]);
    await ledger(app.pool, { characterId: character.id, currency: 'cash', amount: 100000 - Number(character.cash), reason: 'crime:story-browser-fixture' });
    return { name, token, account, character: character.id, headers };
  };
  browser = await chromium.launch({ executablePath, headless: true });
  const idle = page => page.locator('.world-fieldwork [data-fieldwork-refresh]:not([disabled])').waitFor({ state: 'visible' });
  const refresh = async page => { currentPage = page; await idle(page); await page.locator('[data-fieldwork-refresh]').click(); await idle(page); };
  const open = async (player, phone = false) => {
    const context = await browser.newContext({ viewport: phone ? { width: 375, height: 812 } : { width: 1440, height: 900 },
      reducedMotion: 'reduce', serviceWorkers: 'block', isMobile: phone, hasTouch: phone });
    contexts.push(context);
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addInitScript(token => {
      localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_alltabs', '1'); localStorage.setItem('omerta_tour2', '1');
    }, player.token);
    const page = currentPage = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (/^\/(?:city-scene\.(?:js|css)|city-world-ui\.(?:js|css)|city-world-layout\.js|vendor\/phaser\.js)$/.test(new URL(request.url()).pathname)) legacyRequests.push(request.url());
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.locator('#screen-main:not(.hidden)').waitFor({ state: 'visible' });
    if (await page.locator('.modal-bg[data-managed-dialog]').count()) await page.keyboard.press('Escape');
    await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill('fieldwork');
    await page.locator('#jump-list [data-jump="fieldwork"]').click();
    await page.locator('#tab-fieldwork.on').waitFor({ state: 'visible' }); await idle(page);
    return page;
  };
  const view = async (page, name) => { currentPage = page; await idle(page); await page.locator('[data-fieldwork-view="' + name + '"]').click(); };
  const perform = async (page, container, action) => {
    currentPage = page; assert(action?.available, 'The real server must issue an available action.');
    const response = page.waitForResponse(reply => new URL(reply.url()).pathname === action.path && reply.request().method() === action.method);
    await container.getByRole('button', { name: action.label, exact: true }).click();
    if (action.consequence || action.path.includes('/choices/') || action.path.endsWith('/cancel')) {
      await page.locator('.modal-bg[data-managed-dialog] [data-yes]').click();
    }
    const reply = await response;
    assert.equal(reply.status(), 200, await reply.text());
    assert.deepEqual(reply.request().postDataJSON(), action.body || {}, 'The browser sends exactly the server-issued action body.');
    assert(reply.request().headers()['idempotency-key'], 'Every click carries an idempotency key.');
    await idle(page);
    assert.equal(await page.locator('.fieldwork-notice--error').count(), 0);
    return reply.json();
  };
  const graphId = 'first-errand-case-v2', caseBase = '/v1/worldgraph/mysteries/' + graphId;
  for (const [choice, phone] of [['copied-date', false], ['missed-boat', true]]) {
    const player = await actor('Parcel ' + choice), page = await open(player, phone);
    await view(page, 'mysteries');
    const offer = (await ok(call(player, 'GET', '/v1/worldgraph/mysteries'))).mysteries.find(item => item.graphId === graphId);
    const card = page.locator('[data-fieldwork-case="' + graphId + '"]');
    assert.match(await card.textContent(), /Parcel 47/);
    assert.doesNotMatch(await card.textContent(), /wrong departure date|14 October/);
    await perform(page, card, offer.actions[0]);
    assert.equal(await page.locator('.fieldwork-clue').count(), 0);
    const node = async id => {
      for (let attempt = 0; attempt < 14; attempt++) {
        const board = await ok(call(player, 'GET', caseBase));
        const found = board.nodes.find(item => item.id === id);
        if (found) return found;
        const explore = board.uiActions.find(action => action.path.endsWith('/explore') && action.available);
        assert(explore, 'A real discovery action reaches ' + id);
        await perform(page, page.locator('.fieldwork-case'), explore);
      }
      assert.fail('Discovery failed to reach ' + id);
    };
    const step = async (id, optionId) => {
      const record = await node(id), action = record.uiActions.find(action => action.available && (!optionId || action.body.optionId === optionId));
      await perform(page, page.locator('.fieldwork-case [data-fieldwork-node="' + id + '"]'), action);
    };
    await step('mystery:first-errand-meet');
    await step('mystery:first-errand-receipt');
    assert.equal(await page.locator('[data-fieldwork-node="choice:first-errand-explanation"]').count(), 0, 'One record does not reveal the comparison.');
    await step('mystery:first-errand-book');
    const evidence = await page.locator('[data-fieldwork-node="evidence:first-errand-receipt"]').textContent();
    assert.match(evidence, /14 October/); assert.match(evidence, /15 October/);
    assert.match(await page.locator('[data-fieldwork-node="evidence:first-errand-book"]').textContent(), /14 October/);
    await step('choice:first-errand-explanation', choice);
    const selected = choice === 'copied-date' ? 'side-door' : 'public-desk';
    const closed = choice === 'copied-date' ? 'public-desk' : 'side-door';
    assert.equal(await page.locator('[data-fieldwork-node="mystery:first-errand-' + closed + '"]').count(), 0, 'The closed follow-up stays out of the journal.');
    await step('mystery:first-errand-' + selected);
    await step('mystery:first-errand-report');
    assert.equal((await ok(call(player, 'GET', caseBase))).status, 'completed');
    assert.equal(await page.getByRole('heading', { name: 'Case closed', exact: true }).count(), 1);
    await page.locator('[data-fieldwork-keepsakes]').click();
    assert.equal(await page.getByRole('heading', { name: 'Blue Correction Counterfoil', exact: true }).count(), choice === 'copied-date' ? 1 : 0);
    if (phone) assert(await page.locator('.world-fieldwork').evaluate(node => node.scrollWidth <= node.clientWidth + 2), 'The current Fieldwork journal fits a phone.');
    await page.context().close();
  }

  const players = await Promise.all(['Planner', 'Lookout', 'Driver'].map(role => actor('Cross Browser ' + role)));
  const crew = await ok(call(players[0], 'POST', '/v1/crew', { name: 'Browser Crosscurrent' }));
  for (const player of players.slice(1)) {
    await ok(call(players[0], 'POST', '/v1/crew/invite', { name: player.name }));
    await ok(call(player, 'POST', '/v1/crew/accept/' + crew.id, {}));
  }
  // Seed only the established Docks prerequisite through its real HTTP workflow.
  const docks = '/v1/worldgraph/mysteries/district-docks-story';
  await ok(call(players[0], 'POST', docks + '/start', {}));
  for (const [suffix, body] of [
    ['/nodes/mystery%3Adistrict-docks-story-introduction/complete', { interactionId: 'district-docks-story:meet' }],
    ['/choices/choice%3Adistrict-docks-story-approach', { interactionId: 'district-docks-story:choose', optionId: 'witness' }],
    ['/nodes/mystery%3Adistrict-docks-story-witness/complete', { interactionId: 'district-docks-story:witness' }],
    ['/explore', {}], ['/nodes/mystery%3Adistrict-docks-story-report/complete', { interactionId: 'district-docks-story:report' }],
  ]) await ok(call(players[0], 'POST', docks + suffix, body));
  const pages = await Promise.all(players.map((player, index) => open(player, index === 2)));
  for (const page of pages) await view(page, 'operations');
  const offer = (await ok(call(players[0], 'GET', '/v1/worldgraph/operations'))).operations.find(item => item.graphId === CREW_CROSSCURRENT_PACKAGE.id);
  const opened = await perform(pages[0], pages[0].locator('.fieldwork-card').filter({ has: pages[0].getByRole('heading', { name: offer.title, exact: true }) }), offer.actions[0]);
  const operationBase = '/v1/worldgraph/operations/' + opened.operationId;
  for (let index = 0; index < 3; index++) {
    await refresh(pages[index]);
    const role = (await ok(call(players[index], 'GET', operationBase))).roles[index];
    await perform(pages[index], pages[index].locator('[data-fieldwork-role="' + role.roleId + '"]'), role.actions[0]);
  }
  for (const page of pages) await refresh(page);
  assert.match(await pages[0].locator('.fieldwork-handoff').textContent(), /Your turn: Planner/);
  const contribute = async (index, key) => {
    const page = pages[index]; await refresh(page);
    const node = (await ok(call(players[index], 'GET', operationBase + '/role'))).nodes.find(node => node.id === 'operation:crosscurrent-' + key);
    await perform(page, page.locator('.fieldwork-role [data-fieldwork-node="' + node.id + '"]'), node.actions[0]);
  };
  await contribute(0, 'quay'); await contribute(0, 'brief');
  await contribute(1, 'read-quay');
  const privateNotes = CREW_CROSSCURRENT_PACKAGE.nodes.filter(node => node.type === 'evidence').map(node => node.metadata.privateEvidence);
  assert((await pages[1].locator('.world-fieldwork').textContent()).includes(privateNotes[0]));
  for (const index of [0, 2]) {
    await refresh(pages[index]);
    const visible = await pages[index].locator('.world-fieldwork').textContent();
    assert(!privateNotes.some(text => visible.includes(text)), 'Another role never receives the acquired lookout clue.');
  }
  await contribute(1, 'wait'); await contribute(1, 'signal');
  await contribute(2, 'read-escape');
  assert((await pages[2].locator('.world-fieldwork').textContent()).includes(privateNotes[2]));
  for (const index of [0, 1]) {
    await refresh(pages[index]);
    assert(!(await pages[index].locator('.world-fieldwork').textContent()).includes(privateNotes[2]),
      'The driver\'s acquired steering notes remain absent from the other players\' DOM.');
  }
  await contribute(2, 'barge'); await contribute(2, 'finish');
  await refresh(pages[0]);
  const board = await ok(call(players[0], 'GET', operationBase));
  await perform(pages[0], pages[0].locator('.fieldwork-case'), board.actions.find(action => action.path.endsWith('/complete')));
  for (const [index, page] of pages.entries()) {
    await refresh(page);
    const history = page.locator('.fieldwork-accomplishments');
    assert.match(await history.textContent(), /Crosscurrent: the Missing Launch/);
    assert.match(await history.textContent(), /Leave behind the barges/);
    const text = await history.textContent(); assert(!privateNotes.some(note => text.includes(note)));
    assert.equal((await ok(call(players[index], 'GET', operationBase))).status, 'completed');
  }
  assert.deepEqual(legacyRequests, [], 'The new gameplay never imports the obsolete visual city shell.');
  assert.deepEqual(errors, [], 'The current production shell has no browser script errors.');
  console.log('city-case-story-browser PASS: current shell, desktop/phone Parcel 47 branches, evidence discovery, permanent choices, keepsake, three-player Crosscurrent role handoffs/private clues and persisted public accomplishments; no legacy CityScene');
} catch (error) {
  if (currentPage && !currentPage.isClosed()) console.error('Visible failure context:', (await currentPage.locator('body').innerText()).slice(-12000));
  throw error;
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  if (browser) await browser.close();
  await app.close();
}
