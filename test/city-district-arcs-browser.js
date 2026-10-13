// Real server/Phaser phone and desktop journeys. Every activation uses native pointer input.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';
import { ledger } from '../src/game.js';
import { CONSTANTS } from '../src/rules.js';
import { DISTRICT_STORY_ARCS } from '../src/content/district-story-arcs.js';

assert(!process.env.DATABASE_URL, 'District arc browser fixtures require disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off'; process.env.POPULATION_OFF = 'on';
const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
  .find(file => file && fs.existsSync(file));
assert(executablePath, 'Use an installed Chromium/Chrome executable.');
const app = await buildServer();
let browser;
const contexts = [], errors = [], proof = [];
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const bounded = (promise, label) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error('Timed out waiting for ' + label)), 30000);
  promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});
try {
  const create = async name => {
    const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });
    assert.equal(guest.statusCode, 200, guest.body);
    const token = guest.json().token, account = app.jwt.verify(token).sub;
    const headers = { authorization: 'Bearer ' + token };
    const made = await app.inject({ method: 'POST', url: '/v1/character', headers, payload: { name } });
    assert.equal(made.statusCode, 200, made.body);
    const character = (await app.pool.query('SELECT id,generation,loc,cash FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
    await app.pool.query('UPDATE characters SET cash=100000,respect=10000,last_accrued_at=$2 WHERE id=$1',
      [character.id, new Date(Date.now() + 86400000)]);
    await ledger(app.pool, { characterId: character.id, currency: 'cash', amount: 100000 - Number(character.cash), reason: 'crime:arc-browser-fixture' });
    return { token, account, headers, character };
  };
  const currentActor = async actor => (await app.pool.query('SELECT id,generation,loc,cash,respect,heat,ammo FROM characters WHERE account_id=$1 AND alive', [actor.account])).rows[0];
  const inventory = async actor => {
    const response = await app.inject({ url: '/v1/worldgraph/inventory', headers: actor.headers });
    assert.equal(response.statusCode, 200, response.body); return response.json();
  };
  const serverBoard = async (actor, graphId) => {
    const response = await app.inject({ url: '/v1/worldgraph/mysteries/' + encodeURIComponent(graphId), headers: actor.headers });
    assert.equal(response.statusCode, 200, response.body); return response.json();
  };
  const keepsakes = (actor, templateId) => app.pool.query('SELECT id FROM item_instances WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3',
    ['character', actor.character.id, templateId]);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ executablePath, headless: true });
  const newPage = async (actor, viewport) => {
    const context = await browser.newContext({ viewport, isMobile: viewport.width <= 680, hasTouch: viewport.width <= 680,
      serviceWorkers: 'block', locale: 'en-US' });
    contexts.push(context);
    await context.addInitScript(token => {
      localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1');
      window.__arcHandles = []; window.__arcPointer = []; window.__arcReads = [];
      document.addEventListener('click', event => {
        const button = event.target.closest('button');
        window.__arcPointer.push({ trusted: event.isTrusted, pointerType: event.pointerType,
          id: button?.id, quest: button?.dataset.cityQuestAction, destination: button?.dataset.destination,
          label: button?.textContent });
      }, true);
      let module;
      Object.defineProperty(window, 'OmertaCityScene', { configurable: true, get: () => module, set: value => {
        module = { ...value, mount(...args) {
          const read = args[1].onWorldRead;
          args[1] = { ...args[1], onWorldRead: async (kind, context) => {
            const record = { kind, districtId: context.districtId, settled: false };
            window.__arcReads.push(record);
            const result = await read(kind, context);
            Object.assign(record, { code: result?.code, ignored: result?.ignored === true });
            queueMicrotask(() => queueMicrotask(() => { record.settled = true; record.current = context.isCurrent(); }));
            return result;
          } };
          const handle = value.mount(...args), entry = { handle, destroyed: false };
          window.__arcHandles.push(entry);
          return { ...handle, destroy() { entry.destroyed = true; return handle.destroy(); } };
        } };
      } });
    }, actor.token);
    const page = await context.newPage(), requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push({ method: request.method(), path: new URL(request.url()).pathname,
      key: request.headers()['idempotency-key'], body: request.postData() }));
    await page.route(base + '/', async route => {
      const response = await route.fetch(), html = await response.text();
      const anchor = '  async function cityQuestProjection(stamp = projections.snapshot()) {';
      assert.equal(html.split(anchor).length, 2);
      await route.fulfill({ response, body: html.replace(anchor,
        '  window.__arcProbe = () => ({ pending: _cityQuestPending, identity: cityIdentity(), epoch: projections.snapshot().epoch,\n'
        + '    tab: currentTab, mode: _mapMode, receiptLabels: operationReceipts.map(receipt => receipt.label) });\n' + anchor) });
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('#screen-main:not(.hidden)').waitFor();
    if (await page.locator('.modal-bg[data-managed-dialog]').count()) await page.keyboard.press('Escape');
    const fixture = { page, context, requests, actor, viewport };
    await activate(fixture, page.locator('#btn-player-view'));
    await ready(fixture);
    return fixture;
  };
  const state = fixture => fixture.page.evaluate(() => window.__arcHandles.at(-1)?.handle.getState());
  const ready = fixture => fixture.page.waitForFunction(() => window.__arcHandles.at(-1)?.handle.getState().ready);
  const settled = fixture => fixture.page.waitForFunction(() => !window.__arcProbe().pending && !document.querySelector('#busy.on'));
  const activate = async (fixture, control) => {
    await fixture.page.bringToFront();
    const at = await fixture.page.evaluate(() => window.__arcPointer.length);
    if (fixture.viewport.width <= 680) await control.tap(); else await control.click();
    const pointer = await fixture.page.evaluate(at => window.__arcPointer.slice(at).at(-1), at);
    assert(pointer?.trusted, 'Every browser activation uses trusted native pointer input.');
    assert.equal(pointer.pointerType, fixture.viewport.width <= 680 ? 'touch' : 'mouse');
    return pointer;
  };
  const pose = async fixture => (await state(fixture)).position;
  const sameScenePose = async (fixture, before, entry) => {
    assert.deepEqual(await pose(fixture), before, 'Quest mutation/settlement preserves the actual walking pose.');
    assert(await fixture.page.evaluate(entry => window.__arcHandles.at(-1) === entry && !entry.destroyed, entry),
      'Quest mutation/settlement keeps the same live scene handle.');
  };
  const visit = async (fixture, venueId) => {
    if (await fixture.page.locator('.city-world__dock').isVisible()) await activate(fixture, fixture.page.locator('[data-city-world-close]'));
    if (await fixture.page.locator('.omerta-city__interaction').isVisible()) await activate(fixture, fixture.page.locator('[data-city-close]'));
    await activate(fixture, fixture.page.locator(`[data-destination="${venueId}"]`));
    await fixture.page.locator('.omerta-city__interaction').waitFor({ state: 'visible' });
    await fixture.page.waitForFunction(venueId => window.__arcHandles.at(-1).handle.getState().selectedVenue === venueId, venueId);
  };
  const questButton = (fixture, id) => fixture.page.locator(`[data-city-quest-action="${id}"]`);
  const graphRoot = story => '/v1/worldgraph/mysteries/' + encodeURIComponent(story.package.id);
  const action = async (fixture, id, expectedPath) => {
    const before = await pose(fixture), entry = await fixture.page.evaluateHandle(() => window.__arcHandles.at(-1));
    const reply = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === expectedPath);
    const pointer = await activate(fixture, questButton(fixture, id)); assert.equal(pointer.quest, id);
    const confirm = fixture.page.locator('.modal-bg[data-managed-dialog] [data-yes]').last();
    if (await confirm.isVisible()) await activate(fixture, confirm);
    const response = await reply;
    assert.equal(response.status(), 200, await response.text()); assert(response.request().headers()['idempotency-key']);
    await settled(fixture); await sameScenePose(fixture, before, entry); await entry.dispose();
    return response;
  };
  const travel = async (fixture, districtId) => {
    const before = await currentActor(fixture.actor), path = '/v1/travel/' + districtId;
    if (before.loc === districtId) return;
    if (await fixture.page.locator('.omerta-city__interaction').isVisible()) await activate(fixture, fixture.page.locator('[data-city-close]'));
    await activate(fixture, fixture.page.locator('[data-city-world-map]'));
    await fixture.page.locator(`[data-city-district="${districtId}"]`).waitFor();
    await fixture.page.waitForFunction(() => window.__arcReads.every(read => read.settled));
    const readStart = await fixture.page.evaluate(() => window.__arcReads.length);
    await activate(fixture, fixture.page.locator(`[data-city-district="${districtId}"]`));
    await fixture.page.waitForFunction(({ districtId, readStart }) => window.__arcReads.slice(readStart).some(read => read.kind === 'homes'
      && read.districtId === districtId && read.settled && read.current && read.code === 200 && !read.ignored), { districtId, readStart });
    await activate(fixture, fixture.page.locator(`[data-city-travel="${districtId}"]`));
    const confirmation = fixture.page.locator('.modal-bg[data-managed-dialog]').last();
    await confirmation.waitFor({ state: 'visible' }); assert.match(await confirmation.textContent(), /A ride costs \$250/);
    const response = fixture.page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === path);
    await activate(fixture, confirmation.locator('[data-yes]'));
    const reply = await response; assert.equal(reply.status(), 200, await reply.text());
    const result = await reply.json(); assert.deepEqual({ loc: result.loc, cost: result.cost }, { loc: districtId, cost: CONSTANTS.TRAVEL_COST });
    await fixture.page.waitForFunction(districtId => window.__arcHandles.at(-1)?.handle.getState().ready
      && window.__arcHandles.at(-1).handle.getState().region.id === districtId, districtId);
    const after = await currentActor(fixture.actor); assert.equal(after.loc, districtId);
    assert.equal(Number(after.cash), Number(before.cash) - CONSTANTS.TRAVEL_COST);
    assert(fixture.requests.some(request => request.method === 'POST' && request.path === path && request.key));
  };
  const learn = async (fixture, skillId) => {
    await visit(fixture, 'training'); const before = await pose(fixture);
    const previousLayout = await fixture.page.evaluateHandle(() => document.querySelector('#tab-life').firstChild);
    const skillsRead = fixture.page.waitForResponse(reply => reply.request().method() === 'GET'
      && new URL(reply.url()).pathname === '/v1/skills');
    const finalRead = fixture.page.waitForResponse(reply => reply.request().method() === 'GET'
      && new URL(reply.url()).pathname === '/v1/season/recap');
    skillsRead.catch(() => {}); finalRead.catch(() => {});
    await activate(fixture, fixture.page.locator('[data-city-action="life"]'));
    await fixture.page.locator('#tab-life.on').waitFor({ state: 'attached' });
    assert.equal((await skillsRead).status(), 200); assert.equal((await finalRead).status(), 200);
    await fixture.page.waitForFunction(previous => document.querySelector('#tab-life').firstChild !== previous, previousLayout);
    await previousLayout.dispose();
    const response = fixture.page.waitForResponse(reply => reply.request().method() === 'POST'
      && new URL(reply.url()).pathname === '/v1/skills/' + skillId);
    response.catch(() => {});
    await activate(fixture, fixture.page.locator(`[data-learn="${skillId}"]`));
    const learned = await response; assert.equal(learned.status(), 200, await learned.text());
    assert.equal((await learned.json()).learned, skillId); assert(learned.request().headers()['idempotency-key']);
    await fixture.page.locator('#city-return').waitFor({ state: 'visible' });
    await activate(fixture, fixture.page.locator('#city-return')); await ready(fixture);
    assert.deepEqual(await pose(fixture), before, 'Canonical skill navigation returns to its saved world pose.');
  };
  const queuedClose = async (fixture, story) => {
    await visit(fixture, 'fixer');
    const gate = deferred(), observed = deferred(); let once = false;
    const hold = async route => { if (once) return route.continue(); once = true; observed.resolve(); await gate.promise; await route.continue(); };
    await fixture.page.route('**/v1/projections/player*', hold);
    const before = await pose(fixture), entry = await fixture.page.evaluateHandle(() => window.__arcHandles.at(-1));
    const requestStart = fixture.requests.length;
    try {
      await activate(fixture, fixture.page.locator('#btn-refresh')); await bounded(observed.promise, 'the actual authenticated queue read');
      const pointer = await activate(fixture, questButton(fixture, story.package.id + ':start'));
      assert.equal(pointer.quest, story.package.id + ':start');
      await fixture.page.waitForFunction(() => window.__arcProbe().pending);
      await activate(fixture, fixture.page.locator('[data-city-close]'));
      await activate(fixture, fixture.page.locator('[data-destination="fixer"]'));
      await fixture.page.locator('.omerta-city__interaction').waitFor({ state: 'visible' });
    } finally { gate.resolve(); }
    await settled(fixture); await fixture.page.unroute('**/v1/projections/player*', hold);
    assert.deepEqual(fixture.requests.slice(requestStart).filter(request => request.method === 'POST'
      && !['/v1/screens', '/v1/commands/observations'].includes(request.path)), [], 'Close/reopen retires the queued intent with zero gameplay POST.');
    assert.equal((await app.pool.query('SELECT id FROM mystery_instances WHERE graph_id=$1 AND owner_id=$2',
      [story.package.id, fixture.actor.character.id])).rows.length, 0);
    await sameScenePose(fixture, before, entry); await entry.dispose();
  };
  const sentClose = async (fixture, story, id, path) => {
    const gate = deferred(), committed = deferred();
    const hold = async route => { const response = await route.fetch(); assert.equal(response.status(), 200); committed.resolve(response);
      await gate.promise; await route.fulfill({ response }); };
    await fixture.page.route(base + path, hold);
    const before = await pose(fixture), entry = await fixture.page.evaluateHandle(() => window.__arcHandles.at(-1));
    const reply = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === path);
    try {
      const pointer = await activate(fixture, questButton(fixture, id)); assert.equal(pointer.quest, id);
      await bounded(committed.promise, 'the actual committed quest step');
      await activate(fixture, fixture.page.locator('[data-city-close]'));
    } finally { gate.resolve(); }
    const response = await reply; assert.equal(response.status(), 200); await settled(fixture);
    await fixture.page.unroute(base + path, hold);
    assert.equal(await fixture.page.locator('.omerta-city__interaction').isVisible(), false, 'A sent result does not reopen the closed venue.');
    await sameScenePose(fixture, before, entry); await entry.dispose();
    const replay = await app.inject({ method: 'POST', url: path, headers: { ...fixture.actor.headers,
      'idempotency-key': response.request().headers()['idempotency-key'] }, payload: response.request().postDataJSON() });
    assert.equal(replay.statusCode, 200); assert.deepEqual(replay.json(), await response.json());
  };
  const worldRecovery = async fixture => {
    await activate(fixture, fixture.page.locator('[data-city-world-tools]'));
    await activate(fixture, fixture.page.locator('[data-city-world-panel="bag"]'));
    await fixture.page.waitForFunction(() => window.__arcReads.every(read => read.settled));
    const retry = fixture.page.locator('[data-city-world-retry]'); await retry.waitFor({ state: 'visible' });
    return retry;
  };
  const lostReport = async (fixture, story, id, path, templateId, inPlace = false) => {
    const gate = deferred(), committed = deferred(); let once = false;
    const lose = async route => { if (once) return route.continue(); once = true;
      const response = await route.fetch(); assert.equal(response.status(), 200); committed.resolve(await response.json());
      await gate.promise; await route.abort('failed'); };
    await fixture.page.route(base + path, lose);
    const before = await pose(fixture), entry = await fixture.page.evaluateHandle(() => window.__arcHandles.at(-1));
    const requested = fixture.page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === path);
    let result, request;
    try {
      const pointer = await activate(fixture, questButton(fixture, id)); assert.equal(pointer.quest, id);
      request = await requested; result = await bounded(committed.promise, 'the real once-only keepsake commit');
      await activate(fixture, fixture.page.locator('[data-city-close]'));
    } finally { gate.resolve(); }
    await settled(fixture); await fixture.page.unroute(base + path, lose);
    await sameScenePose(fixture, before, entry);
    let retry, count;
    if (inPlace) retry = await worldRecovery(fixture);
    else {
      await activate(fixture, fixture.page.locator('#btn-dashboard-view'));
      await fixture.page.locator('#operation-desk').waitFor({ state: 'visible' });
      assert(await entry.evaluate(record => record.destroyed), 'Explicit Dashboard departure retires the old scene.');
      count = await fixture.page.evaluate(() => window.__arcHandles.length);
      const recovery = fixture.page.locator('.operation-receipt--error').filter({ hasText: 'Publish your corrected account' }).first();
      retry = recovery.locator('[data-operation-retry]'); await retry.waitFor({ state: 'attached' });
    }
    assert.equal((await keepsakes(fixture.actor, templateId)).rows.length, 1, 'Lost reply occurred after the real keepsake was committed.');
    const replayed = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === path);
    replayed.catch(() => {}); // Preserve the activation failure if browser cleanup retires this observer.
    await activate(fixture, retry);
    const response = await replayed; assert.equal(response.status(), 200); assert.deepEqual(await response.json(), result);
    assert.equal(response.request().headers()['idempotency-key'], request.headers()['idempotency-key']);
    assert.deepEqual(response.request().postDataJSON(), request.postDataJSON());
    await settled(fixture);
    if (inPlace) {
      await fixture.page.waitForFunction(() => !window.__arcHandles.at(-1).handle.getState().worldUI.pending);
      await activate(fixture, fixture.page.locator('[data-city-world-close]'));
    } else {
      assert.equal(await fixture.page.evaluate(() => window.__arcHandles.length), count, 'Recovery does not open a scene while the Dashboard is selected.');
      await activate(fixture, fixture.page.locator('#btn-player-view')); await ready(fixture);
    }
    assert.equal((await keepsakes(fixture.actor, templateId)).rows.length, 1, 'Native global recovery replays once without another keepsake.');
    assert.equal(await fixture.page.locator('.omerta-city__interaction').isVisible(), false);
    if (inPlace) await sameScenePose(fixture, before, entry);
    else {
      assert.deepEqual(await pose(fixture), before, 'Explicit return after global recovery restores the exact saved world pose.');
      assert(await fixture.page.evaluate(entry => window.__arcHandles.at(-1) !== entry && !window.__arcHandles.at(-1).destroyed, entry),
        'Explicit return mounts a distinct live scene after Dashboard departure.');
    }
    await entry.dispose();
  };
  const uncertainStart = async viewport => {
    const actor = await create('Arc Uncertain ' + viewport.width), fixture = await newPage(actor, viewport), story = DISTRICT_STORY_ARCS[0];
    await visit(fixture, 'fixer');
    const before = await pose(fixture), entry = await fixture.page.evaluateHandle(() => window.__arcHandles.at(-1));
    const path = graphRoot(story) + '/start', abort = route => route.abort('failed');
    await fixture.page.route(base + path, abort);
    const requested = fixture.page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === path);
    await activate(fixture, questButton(fixture, story.package.id + ':start'));
    const request = await requested; await settled(fixture); await fixture.page.unroute(base + path, abort);
    assert.equal((await app.pool.query('SELECT id FROM mystery_instances WHERE graph_id=$1 AND owner_id=$2',
      [story.package.id, actor.character.id])).rows.length, 0, 'The aborted transport did not create an instance.');
    assert.equal(await fixture.page.locator('[data-city-quest-action]:enabled').count(), 0,
      'A recovery-only receiver update disables unchanged same-venue quest offers.');
    const retry = await worldRecovery(fixture);
    const replayed = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === path);
    replayed.catch(() => {});
    await activate(fixture, retry);
    const response = await replayed; assert.equal(response.status(), 200); assert.equal(response.request().headers()['idempotency-key'], request.headers()['idempotency-key']);
    assert.deepEqual(response.request().postDataJSON(), request.postDataJSON());
    await settled(fixture); await fixture.page.waitForFunction(() => !window.__arcHandles.at(-1).handle.getState().worldUI.pending);
    await activate(fixture, fixture.page.locator('[data-city-world-close]'));
    await sameScenePose(fixture, before, entry); await entry.dispose();
    await visit(fixture, 'fixer'); assert.equal(await questButton(fixture, 'start').isEnabled(), true,
      'Resolved in-place recovery re-enables the independent original introduction.');
    assert.equal((await app.pool.query('SELECT id FROM mystery_instances WHERE graph_id=$1 AND owner_id=$2',
      [story.package.id, actor.character.id])).rows.length, 1);
    await fixture.context.close();
  };
  const privacy = async viewport => {
    const actor = await create('Arc Privacy ' + viewport.width), fixture = await newPage(actor, viewport), story = DISTRICT_STORY_ARCS[0];
    await visit(fixture, 'fixer');
    const gate = deferred(), committed = deferred(), logoutGate = deferred(), logoutObserved = deferred();
    const path = graphRoot(story) + '/start';
    const hold = async route => { const response = await route.fetch(); assert.equal(response.status(), 200); committed.resolve(await response.json());
      await gate.promise; await route.fulfill({ response }); };
    const holdLogout = async route => { const response = await route.fetch(); assert.equal(response.status(), 200); logoutObserved.resolve();
      await logoutGate.promise; await route.fulfill({ response }); };
    await fixture.page.route(base + path, hold); await fixture.page.route('**/v1/access/logout', holdLogout);
    try {
      await activate(fixture, questButton(fixture, story.package.id + ':start'));
      const old = await bounded(committed.promise, 'the old-session committed start');
      assert(old.instanceId);
      await activate(fixture, fixture.page.locator('#btn-dashboard-view'));
      await activate(fixture, fixture.page.locator('#btn-logout'));
      const confirmation = fixture.page.locator('.modal-bg[data-managed-dialog]').last(); await confirmation.waitFor({ state: 'visible' });
      await activate(fixture, confirmation.locator('[data-yes]'));
      await fixture.page.locator('#screen-auth:not(.hidden)').waitFor();
      await bounded(logoutObserved.promise, 'the real logout response held after private clear');
      gate.resolve(); await settled(fixture);
      assert.equal(await fixture.page.locator('.omerta-city').count(), 0, 'Retired session removes the scene before the delayed private result.');
      assert.equal(await fixture.page.locator('[data-city-quest-action]').count(), 0);
      assert.equal(await fixture.page.locator('[data-operation-receipt]').count(), 0);
      assert.equal((await fixture.page.locator('#resp').textContent()).includes(old.instanceId), false, 'Old quest authority never returns to the response desk after private clear.');
    } finally {
      gate.resolve(); logoutGate.resolve();
      await fixture.page.unroute(base + path, hold); await fixture.page.unroute('**/v1/access/logout', holdLogout);
      await fixture.context.close();
    }
  };
  for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 1000 }]) {
    const actor = await create('Arc Browser ' + viewport.width), fixture = await newPage(actor, viewport);
    const learned = new Set();
    await queuedClose(fixture, DISTRICT_STORY_ARCS[0]);
    for (const [index, story] of DISTRICT_STORY_ARCS.entries()) {
      await travel(fixture, story.presentation.districtId); await visit(fixture, 'fixer');
      const prefix = story.package.id + ':', root = graphRoot(story);
      const ids = await fixture.page.locator('[data-city-quest-action]').evaluateAll(nodes => nodes.map(node => node.dataset.cityQuestAction));
      assert(ids.includes('start') && ids.includes(prefix + 'start'), 'The original introduction and district story coexist at the same actual venue.');
      assert.equal(new Set(ids).size, ids.length);
      assert.equal(await questButton(fixture, prefix + 'start').textContent(), 'Begin ' + story.presentation.title);
      assert(!ids.some(id => id.startsWith('district-') && !id.startsWith(prefix)), 'Other districts do not appear as physical venue offers.');
      await action(fixture, prefix + 'start', root + '/start');
      const intro = story.package.nodes.find(node => node.id.endsWith('-introduction'));
      const introPath = root + '/nodes/' + encodeURIComponent(intro.id) + '/complete';
      if (index === 0) await sentClose(fixture, story, prefix + 'complete:' + intro.id, introPath);
      else await action(fixture, prefix + 'complete:' + intro.id, introPath);
      await visit(fixture, 'fixer');
      const choice = story.package.nodes.find(node => node.type === 'choice');
      const approach = viewport.width > 680 || index === 0 ? 'specialist' : 'witness';
      await action(fixture, prefix + 'choose:' + choice.id + ':' + approach, root + '/choices/' + encodeURIComponent(choice.id));
      const branch = story.package.nodes.find(node => node.id.endsWith('-' + approach));
      await visit(fixture, story.venues[branch.id]);
      if (approach === 'specialist' && !learned.has(story.skillId)) {
        assert.equal(await questButton(fixture, prefix + 'complete:' + branch.id).isEnabled(), false, 'A real missing skill disables the issued specialist action.');
        await learn(fixture, story.skillId); learned.add(story.skillId); await visit(fixture, story.venues[branch.id]);
      }
      await action(fixture, prefix + 'complete:' + branch.id, root + '/nodes/' + encodeURIComponent(branch.id) + '/complete');
      await visit(fixture, 'stories'); await action(fixture, prefix + 'explore', root + '/explore');
      const report = story.package.nodes.find(node => node.id.endsWith('-report'));
      const reportId = prefix + 'complete:' + report.id, reportPath = root + '/nodes/' + encodeURIComponent(report.id) + '/complete';
      const templateId = story.package.nodes.find(node => node.type === 'item_template').id;
      if (index <= 1) await lostReport(fixture, story, reportId, reportPath, templateId, index === 1);
      else await action(fixture, reportId, reportPath);
      assert.equal((await serverBoard(actor, story.package.id)).status, 'completed');
      const bag = await inventory(actor); assert.equal(bag.currentCharacterItems.filter(item => item.templateId === templateId).length, 1);
      assert.equal((await keepsakes(actor, templateId)).rows.length, 1);
      proof.push({ viewport: viewport.width, graphId: story.package.id, approach, keepsakes: 1, nativeInput: viewport.width <= 680 ? 'touch' : 'mouse' });
      console.log('arc browser passed:', viewport.width, story.package.id, approach);
    }
    await fixture.context.close(); await uncertainStart(viewport); await privacy(viewport);
  }
  assert.deepEqual(errors, [], 'No page error occurs in the actual client/Phaser integration.');
  assert.equal(proof.length, 12);
  console.log('city-district-arcs-browser PASS: real phone/desktop native input, six district journeys, canonical fare/skill/choice/keepsake, coexisting opaque quest IDs, same action pose/handle, queued close/reopen zero POST, sent-close/exact-key World-tools and Dashboard recovery, recovery-only disabled receiver and session privacy');
} catch (error) {
  console.error('District arc browser failure:', error.message);
  throw error;
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  if (browser) await browser.close();
  await app.close();
}
