// Real disposable server and native pointer/keyboard play: no mocked gameplay replies.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';

assert(!process.env.DATABASE_URL, 'Case browser uses disposable memory only.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off'; process.env.POPULATION_OFF = 'on';
const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(path => path && fs.existsSync(path));
assert(executablePath);
const app = await buildServer(), contexts = [], errors = [];
let browser;
try {
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ executablePath, headless: true });
  for (const width of [1440, 375]) {
    const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });
    assert.equal(guest.statusCode, 200); const token = guest.json().token, headers = { authorization: 'Bearer ' + token };
    const made = await app.inject({ method: 'POST', url: '/v1/character', headers, payload: { name: 'Case Browser ' + width } });
    assert.equal(made.statusCode, 200, made.body);
    const account = app.jwt.verify(token).sub;
    const actor = (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
    await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1', [actor.id, new Date(Date.now() + 86400000)]);
    const context = await browser.newContext({ viewport: { width, height: 812 }, isMobile: width < 680, hasTouch: width < 680, serviceWorkers: 'block' }); contexts.push(context);
    await context.addInitScript(token => {
      localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1');
      window.__caseHandles = []; window.__caseClicks = [];
      document.addEventListener('click', event => { window.__caseClicks.push({ trusted: event.isTrusted, pointerType: event.pointerType }); console.debug('case-native:' + JSON.stringify({ trusted: event.isTrusted, pointerType: event.pointerType })); }, true);
      let module;
      Object.defineProperty(window, 'OmertaCityScene', { configurable: true, get: () => module, set(value) { module = { ...value, mount(...args) {
        const handle = value.mount(...args), item = { handle, destroyed: false }; window.__caseHandles.push(item);
        return { ...handle, destroy() { item.destroyed = true; handle.destroy(); } };
      } }; } });
    }, token);
    const page = await context.newPage(), requests = [], nativeClicks = [];
    page.on('console', message => { if (message.text().startsWith('case-native:')) nativeClicks.push(JSON.parse(message.text().slice('case-native:'.length))); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push({ method: request.method(), path: new URL(request.url()).pathname }));
    await page.route(base + '/', async route => {
      const response = await route.fetch(), html = await response.text(), anchor = '  async function cityQuestProjection(stamp = projections.snapshot()) {';
      assert.equal(html.split(anchor).length, 2);
      await route.fulfill({ response, body: html.replace(anchor, '  window.__caseProbe = () => ({ pending: _cityQuestPending, journal: _cityCaseState, identity: cityIdentity() });\n' + anchor) });
    });
    const activate = async locator => { const count = nativeClicks.length; if (width < 680) await locator.tap(); else await locator.click();
      assert(nativeClicks.length > count && nativeClicks.at(-1).trusted, 'Native input is trusted, including the click before logout navigation.'); }; 
    const state = () => page.evaluate(() => window.__caseHandles.at(-1).handle.getState());
    const gameplay = () => requests.filter(request => request.method === 'POST' && !['/v1/screens', '/v1/commands/observations'].includes(request.path));
    await page.goto(base, { waitUntil: 'networkidle' }); await page.locator('#screen-main:not(.hidden)').waitFor();
    if (await page.locator('.modal-bg[data-managed-dialog]').count()) await page.keyboard.press('Escape');
    await activate(page.locator('#btn-player-view'));
    await page.waitForFunction(() => window.__caseHandles.at(-1)?.handle.getState().ready);
    const original = await state(), beforeOpen = gameplay().length; let expectedPose = original.position, inspectedProp = false;
    await activate(page.locator('.omerta-city__journal'));
    await page.locator('[data-city-case-select]').waitFor();
    assert.equal(await page.locator('[data-city-case-select]').inputValue(), 'first-errand-case-v2');
    assert.equal(await page.locator('[data-city-case-beat]').count(), 1);
    assert.equal(gameplay().length, beforeOpen, 'Opening the private journal makes no gameplay call.');
    assert.deepEqual((await state()).position, original.position);
    const pick = async graph => {
      const control = page.locator('[data-city-case-select]');
      const index = await control.locator('option').evaluateAll((nodes, id) => nodes.findIndex(node => node.value === id), graph);
      assert(index >= 0); await control.focus(); await page.keyboard.press('Home');
      for (let i = 0; i < index; i++) await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForFunction(graph => window.__caseProbe().journal.selected === graph, graph);
    };
    await pick('neighborhood-initiation');
    assert.match(await page.locator('[data-city-case-beat]').textContent(), /A Name Worth Remembering/);
    assert.doesNotMatch(await page.locator('[data-city-case-beat]').textContent(), /Parcel 47/);
    await pick('first-errand-case-v2'); assert.equal(gameplay().length, beforeOpen, 'Changing the tracked case is read-only.');
    // A real projection occupies the existing dispatch queue. Closing this opening
    // retires only the unsent intent; no fabricated DTO or canceled response is used.
    let releaseRead, observeRead;
    const readGate = new Promise(resolve => { releaseRead = resolve; });
    const readObserved = new Promise(resolve => { observeRead = resolve; }); let held = false;
    const holdRead = async route => { if (held) return route.continue(); held = true; observeRead(); await readGate; await route.continue(); };
    await page.route('**/v1/projections/player*', holdRead);
    const beforeQueued = gameplay().length; console.log('case queue proof start', width);
    try {
      await activate(page.locator('#btn-refresh'));
      await Promise.race([readObserved, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Actual player refresh did not reach held route')), 10000); readObserved.then(() => clearTimeout(timer)); })]);
      await activate(page.locator('[data-city-case-action]:enabled').first());
      await page.waitForFunction(() => window.__caseProbe().pending);
      await activate(page.locator('[data-city-world-close]'));
      await activate(page.locator('.omerta-city__journal'));
    } finally { releaseRead(); }
    await page.waitForFunction(() => !window.__caseProbe().pending && !document.querySelector('#busy.on'));
    await page.unroute('**/v1/projections/player*', holdRead); console.log('case queue proof settled', width);
    assert.equal(gameplay().length, beforeQueued, 'Closing and reopening cancels the queued old opening with zero gameplay POST.');
    assert.equal((await app.pool.query('SELECT id FROM mystery_instances WHERE owner_id=$1 AND graph_id=$2', [actor.id, 'first-errand-case-v2'])).rows.length, 0);
    await page.locator('[data-city-case-action]:enabled').first().waitFor();
    const act = async id => {
      const before = (await state()).position;
      const exact = page.locator('[data-city-case-action]').locator('xpath=self::*[@data-city-case-action=' + JSON.stringify(id) + ']');
      assert.equal(await exact.count(), 1, 'The current beat exposes the exact issued action once.');
      const response = page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname.startsWith('/v1/worldgraph/mysteries/first-errand-case-v2/'));
      await activate(exact);
      if (id.includes(':choose:')) { await page.locator('.modal-bg[data-managed-dialog] [data-yes]').last().waitFor(); await activate(page.locator('.modal-bg[data-managed-dialog] [data-yes]').last()); }
      const reply = await response; assert.equal(reply.status(), 200, await reply.text()); assert(reply.request().headers()['idempotency-key']);
      await page.waitForFunction(() => !window.__caseProbe().pending && !document.querySelector('#busy.on'));
      assert.deepEqual((await state()).position, before, 'The action retains the real world pose.');
      assert.equal(await page.evaluate(() => window.__caseHandles.filter(item => !item.destroyed).length), 1);
    };
    for (let step = 0; step < 16; step++) {
      const journal = await page.evaluate(() => window.__caseProbe().journal);
      if (journal.status === 'completed') break;
      const lead = journal.leads.find(lead => lead.actions.some(action => action.available && !action.isCancel)); assert(lead);
      let action = lead.actions.find(action => action.available && action.id.endsWith(':choose:copied-date')) || lead.actions.find(action => action.available && !action.isCancel);
      if (!inspectedProp && lead.nodeId === 'mystery:first-errand-receipt') {
        const zero = gameplay().length;
        await activate(page.getByRole('button', { name: 'Pin lead · The Workshop', exact: true }));
        await page.waitForFunction(() => { const scene = window.__caseHandles.at(-1).handle.getState(); return scene.selectedVenue === 'workshop' && scene.pathLength === 0; });
        expectedPose = (await state()).position;
        assert.notDeepEqual(expectedPose, original.position, 'Pinning leads to actual walking, not a cosmetic completion.');
        await activate(page.locator('[data-city-close]'));
        await page.locator('.omerta-city__canvas canvas').scrollIntoViewIfNeeded();
        const click = await page.evaluate(() => {
          const state = window.__caseHandles.at(-1).handle.getState(), prop = state.caseProps.find(prop => prop.nodeId === 'mystery:first-errand-receipt');
          const box = document.querySelector('.omerta-city__canvas canvas').getBoundingClientRect();
          return { x: box.left + (prop.x - state.camera.x) * state.camera.zoom, y: box.top + (prop.y - state.camera.y) * state.camera.zoom };
        });
        if (width < 680) await page.touchscreen.tap(click.x, click.y); else await page.mouse.click(click.x, click.y);
        await page.locator('.omerta-city__interaction').waitFor({ state: 'visible' });
        assert.match(await page.locator('.omerta-city__interaction').textContent(), /Receipt pinned beside Ada/);
        assert.equal(gameplay().length, zero, 'Walking and inspecting the visible prop do not complete or spend the action.');
        assert.deepEqual((await state()).position, expectedPose);
        await activate(page.locator('.omerta-city__journal')); inspectedProp = true;
      }
      if (action.id.includes(':choose:')) {
        assert.equal(await page.locator('[data-city-case-evidence] article').count(), 2, 'Actual acquired records sit together before the decision.');
        assert.match(await page.locator('[data-city-case-evidence]').textContent(), /15 October/);
        assert.match(await page.locator('[data-city-case-evidence]').textContent(), /14 October/);
        if (process.env.CITY_CASE_SHOTS) { fs.mkdirSync(process.env.CITY_CASE_SHOTS, { recursive: true }); await page.screenshot({ path: process.env.CITY_CASE_SHOTS + '/case-' + width + '.png' }); }
      }
      await act(action.id);
    }
    assert.equal((await page.evaluate(() => window.__caseProbe().journal)).status, 'completed');
    assert(await page.getByRole('button', { name: 'Ask Nico for a paying job', exact: true }).isVisible());
    const noMorePosts = gameplay().length;
    await activate(page.getByRole('button', { name: 'Ask Nico for a paying job', exact: true }));
    assert.equal((await state()).gameDock, 'fixer'); assert.equal(gameplay().length, noMorePosts);
    assert.deepEqual((await state()).position, expectedPose);
    assert.equal(await page.locator('[data-city-first-pay]').count(), 0, 'An offered job is not a confirmed payout.');
    const paid = page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname.startsWith('/v1/crimes/'));
    const rng = Math.random; let paidReply;
    try { Math.random = () => 0; await activate(page.locator('[data-city-approach="quiet"]')); paidReply = await paid; }
    finally { Math.random = rng; }
    assert.equal(paidReply.status(), 200); const outcome = await paidReply.json(); assert.equal(outcome.success, true); assert(outcome.take > 0);
    await page.locator('[data-city-first-pay]').waitFor({ state: 'visible' });
    assert((await page.locator('[data-city-first-pay]').textContent()).includes(String(outcome.take)), 'The tutorial reports the actual server payout.');
    assert.match(await page.locator('[data-city-first-pay]').textContent(), /lootable transit/);
    const bankPosts = gameplay().length;
    await activate(page.locator('[data-city-first-bank]')); await page.locator('#bank-dep').waitFor({ state: 'visible' });
    assert.equal(gameplay().length, bankPosts, 'The bank handoff does not submit a deposit.');
    const native = await app.inject({ url: '/v1/worldgraph/mysteries/first-errand-case-v2', headers });
    assert.equal(native.statusCode, 200); assert.equal(native.json().status, 'completed');
    assert.equal(native.json().nodes.find(node => node.id === 'choice:first-errand-explanation').status, 'completed');
    await activate(page.locator('#btn-player-view'));
    await page.waitForFunction(() => window.__caseHandles.at(-1)?.handle.getState().ready);
    await activate(page.locator('.omerta-city__journal'));
    await page.locator('[data-city-case-evidence] article').first().waitFor();
    const old = await page.evaluateHandle(() => document.querySelector('.city-world__dock'));
    let releaseLogout, observedLogout;
    const logoutGate = new Promise(resolve => { releaseLogout = resolve; });
    const logoutObserved = new Promise(resolve => { observedLogout = resolve; });
    const holdLogout = async route => { const response = await route.fetch(); assert.equal(response.status(), 200); observedLogout(); await logoutGate; await route.fulfill({ response }); };
    await page.route('**/v1/access/logout', holdLogout);
    try {
      await activate(page.locator('#btn-dashboard-view')); await activate(page.locator('#btn-logout'));
      const confirmation = page.locator('.modal-bg[data-managed-dialog]').last(); await confirmation.waitFor();
      await activate(confirmation.locator('[data-yes]')); await page.locator('#screen-auth:not(.hidden)').waitFor(); await logoutObserved;
      assert.equal(await page.locator('[data-city-case-evidence]').count(), 0, 'Identity teardown removes acquired private evidence.');
      assert.equal(await page.evaluate(() => window.__caseProbe().journal), null, 'The host clears the private case model.');
      assert.equal(await old.evaluate(node => node.isConnected), false);
    } finally { releaseLogout(); await page.unroute('**/v1/access/logout', holdLogout); await old.dispose(); }
    await context.close(); console.log('case-story browser passed', width);
  }
  assert.deepEqual(errors, []);
  console.log('city-case-story-browser PASS: real desktop and phone case selection, single beat, acquired evidence comparison, explicit permanent choices, same scene/pose and read-only paying-work handoff');
} finally { for (const context of contexts) await context.close().catch(() => {}); if (browser) await browser.close(); await app.close(); }
