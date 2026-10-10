// Actual City UI and authoritative encounter API, using disposable local players.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';

assert(!process.env.DATABASE_URL, 'City presence browser checks require disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';
const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium executable.');
const app = await buildServer();
let browser;
const errors = [];
try {
  const player = async name => {
    const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });
    assert.equal(guest.statusCode, 200, guest.body);
    const token = guest.json().token, headers = { authorization: 'Bearer ' + token };
    const created = await app.inject({ method: 'POST', url: '/v1/character', headers, payload: { name } });
    assert.equal(created.statusCode, 200, created.body);
    const row = (await app.pool.query('SELECT id,account_id,loc,generation FROM characters WHERE account_id=$1 AND alive', [app.jwt.verify(token).sub])).rows[0];
    return { ...row, token, headers };
  };
  const viewer = await player('Presence Viewer');
  const human = await player('Public Player'), agent = await player('Public Agent'), npc = await player('Public Resident'), away = await player('Away Person');
  const secondViewer = await player('Presence B');
  await app.pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [agent.account_id]);
  await app.pool.query('UPDATE characters SET is_npc=true WHERE id=$1', [npc.id]);
  await app.pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [away.id, 'canal']);
  const hostileName = '<img src=x onerror=window.__actorInjection=1>';
  await app.pool.query('UPDATE characters SET name=$2 WHERE id=$1', [human.id, hostileName]);
  for (let index = 0; index < 25; index++) {
    const resident = await player('Resident ' + index);
    await app.pool.query('UPDATE characters SET is_npc=true WHERE id=$1', [resident.id]);
  }
  await app.pool.query('UPDATE characters SET health=22,energy=31 WHERE id=$1', [viewer.id]);
  const readIntel = async () => {
    const reply = await app.inject({ method: 'GET', url: '/v1/city/intel', headers: viewer.headers });
    assert.equal(reply.statusCode, 200, reply.body); return reply.json();
  };
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ executablePath, headless: true });
  const newPage = async viewport => {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block', isMobile: viewport.width <= 680, hasTouch: viewport.width <= 680 });
    await context.addInitScript(token => {
      localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1');
      window.__presenceHandles = []; let api;
      Object.defineProperty(window, 'OmertaCityScene', { configurable: true, get: () => api, set: value => {
        api = { ...value, mount(...args) {
          const handle = value.mount(...args), record = { handle, destroyed: false, character: { ...args[1].character }, retry: args[1].onEncounterRetry };
          window.__presenceHandles.push(record);
          window.__presenceModel = { ...args[1] };
          return { ...handle, update(options) { Object.assign(window.__presenceModel, options); const result = handle.update(options); window.__presenceReceiptHook?.(options); return result; },
            destroy() { record.destroyed = true; return handle.destroy(); } };
        } };
      } });
    }, viewer.token);
    const page = await context.newPage(); await page.bringToFront();
    page.on('pageerror', error => errors.push(error.message));
    const requests = []; page.on('request', request => requests.push({ method: request.method(), path: new URL(request.url()).pathname }));
    // Test-only access to the existing read coordinator.
    // Responses remain from the real server; source files are never modified.
    await page.route(base + '/', async route => {
      const reply = await route.fetch(), html = await reply.text(), anchor = '  async function renderMap() {';
      assert.equal(html.split(anchor).length, 2);
      await route.fulfill({ response: reply, body: html.replace(anchor,
        '  window.__presenceRead = () => { clearTimeout(_reRenderT); return renderMap(); };\n'
        + '  window.__presenceRevision = () => _cityPeopleRevision;\n' + anchor) });
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForSelector('#screen-main:not(.hidden)');
    await page.locator('#btn-player-view').click();
    await page.waitForFunction(() => window.__presenceHandles.at(-1)?.handle.getState().ready);
    await page.waitForSelector('[data-city-actor]');
    return { page, context, requests };
  };
  const state = page => page.evaluate(() => window.__presenceHandles.at(-1).handle.getState());
  const frames = page => page.evaluate(() => new Promise(resolve => { let observed = 0; const next = () => ++observed < 8 ? requestAnimationFrame(next) : resolve(); requestAnimationFrame(next); }));
  const mutations = requests => requests.filter(request => !['GET', 'HEAD'].includes(request.method)
    && !['/v1/screens', '/v1/commands/observations'].includes(request.path));
  const inspect = async (page, id) => {
    if (await page.locator('.omerta-city__actor-dock:not([hidden])').count()) await page.locator('[data-city-actor-close]').click();
    while (!await page.locator('[data-city-actors-previous]').isDisabled()) await page.locator('[data-city-actors-previous]').click();
    for (let index = 0; index < 40; index++) {
      const button = page.locator('[data-city-actor="' + id + '"]');
      if (await button.count()) { await button.click(); await page.waitForFunction(id => window.__presenceHandles.at(-1).handle.getState().selectedActor === id, id); return; }
      assert(!await page.locator('[data-city-actors-more]').isDisabled(), 'Every issued actor remains reachable through roster pagination.');
      await page.locator('[data-city-actors-more]').click();
      await page.waitForFunction(() => document.querySelector('[data-city-actors-more]')?.textContent === 'More people');
    }
    assert.fail('Actor pagination did not reach ' + id);
  };
  const encounter = async (page, id) => {
    await inspect(page, id);
    const response = page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/city/encounters/' + id);
    await page.locator('[data-city-encounter]').click();
    const reply = await response; assert.equal(reply.status(), 200, await reply.text());
    const body = await reply.json();
    await page.waitForFunction(() => document.querySelector('.omerta-city__actor-notice')?.textContent.startsWith('Intel recorded:'));
    return { reply, body };
  };

  const { page, context, requests } = await newPage({ width: 1440, height: 1000 });
  const pose = (await state(page)).position, handles = await page.evaluate(() => window.__presenceHandles.length);
  const seen = new Set(), rosterPages = [], initial = requests.length;
  for (let index = 0; index < 40; index++) {
    const ids = await page.locator('[data-city-actor]').evaluateAll(buttons => buttons.map(button => button.dataset.cityActor));
    rosterPages.push(ids); for (const id of ids) seen.add(id);
    assert((await state(page)).actorMarkers.length <= 24, 'Sprite rendering is bounded independently of total roster size.');
    if (await page.locator('[data-city-actors-more]').isDisabled()) break;
    await page.locator('[data-city-actors-more]').click();
    await page.waitForFunction(() => document.querySelector('[data-city-actors-more]')?.textContent === 'More people');
  }
  for (const actor of [npc, agent, human]) assert(seen.has(actor.id), 'All published semantic types are discoverable.');
  const laterActor = await page.locator('[data-city-actor]').last().getAttribute('data-city-actor');
  assert(seen.size > 24 && !seen.has(away.id) && !seen.has(viewer.id), 'Roster pagination preserves current district and excludes the viewer.');
  const removed = rosterPages[0].find(id => ![npc.id, human.id, agent.id, secondViewer.id].includes(id)), overlapping = rosterPages[1][0];
  assert(removed && overlapping);
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [removed]);
  const changed = (await app.pool.query('UPDATE characters SET generation=generation+1 WHERE id=$1 RETURNING generation', [overlapping])).rows[0];
  while (!await page.locator('[data-city-actors-previous]').isDisabled()) await page.locator('[data-city-actors-previous]').click();
  if (await page.locator('#btn-refresh').isDisabled()) console.log('Waiting for the existing refresh before the boundary probe.');
  const changedPage = page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/city/presence');
  await page.locator('#btn-refresh').click(); await changedPage;
  await page.waitForFunction(({ id, generation }) => window.__presenceModel.actors?.find(actor => actor.id === id)?.generation === generation,
    { id: overlapping, generation: changed.generation });
  const updatedIssuer = await page.evaluate(id => window.__presenceModel.actors.find(actor => actor.id === id), overlapping);
  assert.equal(updatedIssuer.actions[0].body.targetGeneration, changed.generation, 'An old downstream page cannot overwrite the winning issuer generation.');
  const afterBoundary = new Set();
  for (let index = 0; index < 40; index++) {
    for (const id of await page.locator('[data-city-actor]').evaluateAll(buttons => buttons.map(button => button.dataset.cityActor))) afterBoundary.add(id);
    if (await page.locator('[data-city-actors-more]').isDisabled()) break;
    await page.locator('[data-city-actors-more]').click();
    await page.waitForFunction(() => document.querySelector('[data-city-actors-more]')?.textContent === 'More people');
  }
  assert.equal(afterBoundary.size, seen.size - 1); assert(!afterBoundary.has(removed));
  assert.deepEqual(mutations(requests.slice(initial)), []);
  await inspect(page, human.id);
  assert((await page.locator('.omerta-city__actor-body').textContent()).includes(hostileName));
  assert.equal(await page.locator('.omerta-city__actor-body img').count(), 0);
  assert.equal(await page.evaluate(() => window.__actorInjection), undefined);
  assert.deepEqual(mutations(requests.slice(initial)), [], 'Read-only actor inspection never collects intel.');
  assert.deepEqual((await state(page)).position, pose);
  assert.equal(await page.evaluate(() => window.__presenceHandles.length), handles);

  // Fresh confirmed encounters create new cards and advance actual, distinct-source objectives.
  const first = await encounter(page, npc.id);
  assert.equal(first.body.intel.source.id, npc.id);
  assert((await page.locator('.omerta-city__actor-body').textContent()).includes(first.body.objectives.find(objective => objective.status === 'available').title), 'An actual objective unlock is visible beside its encounter receipt.');
  const confirmedDelta = await page.evaluate(() => window.__presenceModel.encounterReceipt.delta);
  assert.equal(typeof confirmedDelta, 'string'); assert(confirmedDelta.length);
  assert((await page.locator('[data-city-encounter-receipt]').textContent()).includes(confirmedDelta), 'The actual string state-confirmation delta is visible in the private receipt.');
  const key = first.reply.request().headers()['idempotency-key']; assert(key);
  const replay = await app.inject({ method: 'POST', url: '/v1/city/encounters/' + npc.id,
    headers: { ...viewer.headers, 'idempotency-key': key }, payload: first.reply.request().postDataJSON() });
  assert.equal(replay.statusCode, 200, replay.body); assert.deepEqual(replay.json(), first.body);
  assert.equal((await readIntel()).progress.totalEncounters, 1, 'Exact-key replay creates no second journal entry.');

  // Lose a committed reply, then let a second authorized client advance the
  // real journal/objectives. Historical replay must remain a receipt, not a
  // replacement for a newer board or an invalidation of a newer read ticket.
  await inspect(page, npc.id);
  let lostRequest, lostBody, attempts = 0;
  await page.route('**/v1/city/encounters/' + npc.id, async route => {
    if (++attempts === 1) {
      lostRequest = { key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() };
      const committed = await route.fetch(); lostBody = await committed.json(); await route.abort('failed');
    } else await route.continue();
  });
  await page.locator('[data-city-encounter]').click(); await page.waitForSelector('[data-city-encounter-retry]');
  const otherClientEncounter = async id => {
    const presence = await app.inject({ method: 'GET', url: '/v1/city/presence?limit=40', headers: viewer.headers });
    assert.equal(presence.statusCode, 200, presence.body);
    const action = presence.json().actors.find(actor => actor.id === id)?.actions[0]; assert(action);
    const reply = await app.inject({ method: action.method, url: action.path,
      headers: { ...viewer.headers, 'idempotency-key': crypto.randomUUID() }, payload: action.body });
    assert.equal(reply.statusCode, 200, reply.body); return reply.json();
  };
  const newer = await otherClientEncounter(human.id);
  assert.equal(newer.progress.totalEncounters, 3); assert.equal(newer.progress.completedObjectives, 1);
  const winningRead = page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/city/intel');
  await page.locator('#btn-refresh').click(); await winningRead;
  await page.waitForFunction(() => window.__presenceModel.intel?.length === 3);
  assert.equal(await page.evaluate(() => window.__presenceModel.objectives.filter(objective => objective.status === 'completed').length), 1);
  await page.locator('[data-city-actor-close]').click(); await inspect(page, human.id);
  assert(await page.locator('[data-city-encounter]').isDisabled(), 'Uncertainty blocks fresh moves even after inspecting another source.');
  const latest = await otherClientEncounter(agent.id);
  assert.equal(latest.progress.totalEncounters, 4); assert.equal(latest.progress.completedObjectives, 2);
  let releaseNewRead, startedNewRead;
  const newReadGate = new Promise(resolve => { releaseNewRead = resolve; }), newReadStarted = new Promise(resolve => { startedNewRead = resolve; });
  await page.route('**/v1/city/intel', async route => {
    if (await page.evaluate(() => window.__holdHistoricalRead === true)) {
      const reply = await route.fetch(); assert.equal((await reply.json()).progress.totalEncounters, 4);
      startedNewRead(); await newReadGate; await route.fulfill({ response: reply });
    } else await route.continue();
  });
  await page.evaluate(() => {
    window.__presenceReceiptHook = options => {
      if (options.encounterReceipt?.state !== 'success') return;
      window.__presenceReceiptHook = null; window.__holdHistoricalRead = true;
      window.__pendingHistoricalRead = window.__presenceRead();
      window.__historicalReadRevision = window.__presenceRevision();
    };
  });
  const recovered = page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/city/encounters/' + npc.id);
  await page.locator('[data-city-encounter-retry]').click(); const recoveredReply = await recovered;
  assert.equal(recoveredReply.status(), 200); assert.deepEqual(await recoveredReply.json(), lostBody);
  assert.equal(recoveredReply.request().headers()['idempotency-key'], lostRequest.key);
  assert.deepEqual(recoveredReply.request().postDataJSON(), lostRequest.body);
  await page.unroute('**/v1/city/encounters/' + npc.id);
  await newReadStarted;
  assert.equal(await page.evaluate(() => window.__presenceRevision()), await page.evaluate(() => window.__historicalReadRevision), 'An old replay receipt does not invalidate the newer read ticket.');
  assert.equal(await page.evaluate(() => window.__presenceModel.intel.length), 3, 'Historical receipt cannot roll back the winning journal.');
  assert.equal(await page.evaluate(() => window.__presenceModel.objectives.filter(objective => objective.status === 'completed').length), 1);
  await page.evaluate(() => { window.__holdHistoricalRead = false; }); releaseNewRead();
  await page.evaluate(() => window.__pendingHistoricalRead); await page.unroute('**/v1/city/intel');
  await page.waitForFunction(() => window.__presenceModel.intel.length === 4);
  assert.equal(await page.evaluate(() => window.__presenceModel.objectives.filter(objective => objective.status === 'completed').length), 2);
  assert.equal((await readIntel()).progress.totalEncounters, 4, 'Same-key replay adds no phantom encounter.');
  await encounter(page, human.id); await encounter(page, agent.id); await encounter(page, human.id);
  const board = await readIntel();
  assert.equal(board.progress.totalEncounters, 7);
  assert.equal(board.progress.completedObjectives, 3);
  assert.equal(new Set(board.journal.map(entry => entry.id)).size, 7);
  assert.deepEqual((await state(page)).position, pose);
  await page.locator('[data-city-actor-close]').click(); await page.locator('[data-city-intel-open]').click();
  assert.equal(await page.locator('[data-city-intel]').count(), 7);
  assert.equal(await page.locator('[data-city-objective]').count(), 3);
  assert.equal(await page.locator('[data-city-intel-action]').count(), 0, 'Reading the journal cannot complete an encounter objective.');

  await encounter(page, laterActor);
  assert((await state(page)).actorPage > 0 && (await state(page)).selectedActor === laterActor, 'A later-page encounter retains its inspector and roster page.');
  const refreshedPresence = page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/city/presence');
  await page.locator('#btn-refresh').click(); await refreshedPresence;
  await page.waitForFunction(id => document.querySelector('[data-city-actor="' + id + '"]') && window.__presenceHandles.at(-1).handle.getState().selectedActor === id, laterActor);
  assert((await page.locator('.omerta-city__actor-notice').textContent()).startsWith('Intel recorded:'));
  assert.equal((await readIntel()).progress.totalEncounters, 8);

  // Initial view intent cannot revive after close/reopen while the authenticated queue is held.
  await inspect(page, npc.id);
  let releaseRead; const readGate = new Promise(resolve => { releaseRead = resolve; });
  await page.route('**/v1/projections/player*', async route => { await readGate; await route.continue(); });
  const heldRead = page.waitForRequest(request => new URL(request.url()).pathname === '/v1/projections/player');
  await page.locator('#btn-refresh').click(); await heldRead;
  const beforeQueue = requests.length;
  await page.locator('[data-city-encounter]').click();
  await page.locator('[data-city-actor-close]').click(); await inspect(page, npc.id);
  releaseRead();
  await page.waitForFunction(() => !document.querySelector('[data-city-encounter]')?.disabled);
  await page.unroute('**/v1/projections/player*');
  assert.equal(requests.slice(beforeQueue).filter(request => request.path.startsWith('/v1/city/encounters/')).length, 0);
  assert.equal((await readIntel()).progress.totalEncounters, 8);

  // A dispatched command retains its successful receipt when its inspector closes.
  await inspect(page, npc.id);
  let releaseReply, sent; const replyGate = new Promise(resolve => { releaseReply = resolve; }), committed = new Promise(resolve => { sent = resolve; });
  await page.route('**/v1/city/encounters/' + npc.id, async route => { const reply = await route.fetch(); sent(); await replyGate; await route.fulfill({ response: reply }); });
  const actualReply = page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/city/encounters/' + npc.id);
  await page.locator('[data-city-encounter]').click(); await committed;
  await page.locator('[data-city-actor-close]').click(); releaseReply();
  assert.equal((await actualReply).status(), 200);
  await page.unroute('**/v1/city/encounters/' + npc.id);
  await page.waitForFunction(() => window.__presenceHandles.at(-1).handle.getState().selectedActor === null);
  assert.equal(await page.locator('.omerta-city__actor-dock:not([hidden])').count(), 0);
  assert.equal((await readIntel()).progress.totalEncounters, 9);
  await page.locator('[data-city-intel-open]').click(); await page.waitForSelector('[data-city-intel]');
  assert.equal(await page.locator('[data-city-intel]').count(), 9);

  // The server, not a fabricated response, reports key reuse for a fresh issuer
  // snapshot. Private Retry must never turn this into a new-key command.
  await inspect(page, npc.id);
  await app.pool.query('UPDATE characters SET generation=generation+1 WHERE id=$1', [npc.id]);
  const freshNpc = page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/city/presence');
  await page.locator('#btn-refresh').click(); await freshNpc;
  await page.waitForFunction(({ id, generation }) => window.__presenceModel.actors.find(actor => actor.id === id)?.actions[0].body.targetGeneration === generation,
    { id: npc.id, generation: first.reply.request().postDataJSON().targetGeneration + 1 });
  await page.route('**/v1/city/encounters/' + npc.id, route => route.continue({ headers: { ...route.request().headers(), 'idempotency-key': key } }));
  const collision = page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/city/encounters/' + npc.id);
  await page.locator('[data-city-encounter]').click(); const collisionReply = await collision;
  assert.equal(collisionReply.status(), 422); assert.equal((await collisionReply.json()).error, 'idempotency_key_reuse');
  await page.unroute('**/v1/city/encounters/' + npc.id);
  await page.waitForFunction(() => window.__presenceModel.encounterReceipt?.state === 'error' && window.__presenceModel.encounterRecovery === false);
  assert.equal(await page.locator('[data-city-encounter-retry]').count(), 0);
  const beforeUnsafeRetry = requests.length;
  assert.equal((await page.evaluate(() => window.__presenceHandles.at(-1).retry())).code, 499);
  assert.equal(requests.slice(beforeUnsafeRetry).filter(request => request.path.startsWith('/v1/city/encounters/')).length, 0);
  assert.equal((await readIntel()).progress.totalEncounters, 9);
  await inspect(page, npc.id);
  await page.locator('[data-city-encounter]').evaluate(button => { window.__retiredEncounter = button; });
  const retired = await page.evaluate(() => window.__presenceHandles.at(-1).character.generation);
  await app.pool.query('UPDATE characters SET generation=generation+1 WHERE id=$1', [viewer.id]);
  await page.locator('#btn-refresh').click();
  await page.waitForFunction(generation => window.__presenceHandles.at(-1)?.character.generation === generation
    && window.__presenceHandles.at(-1).handle.getState().ready, retired + 1, { timeout: 20000 });
  assert(await page.evaluate(() => window.__presenceHandles.at(-2).destroyed));
  assert.equal((await state(page)).selectedActor, null);
  assert.deepEqual((await state(page)).position, { x: 430, y: 366, facing: 'down' });
  const beforeRetired = requests.length;
  await page.evaluate(() => window.__retiredEncounter.click()); await frames(page);
  assert.equal(requests.slice(beforeRetired).filter(request => request.path.startsWith('/v1/city/encounters/')).length, 0);
  assert.equal((await readIntel()).progress.totalEncounters, 0, 'A new generation cannot inherit private encounter intel.');
  await page.locator('[data-city-intel-open]').click();
  assert.equal(await page.locator('[data-city-intel]').count(), 0);
  await context.close();

  for (const viewport of [{ width: 375, height: 812 }, { width: 320, height: 568 }]) {
    const mobile = await newPage(viewport), phone = mobile.page;
    await inspect(phone, npc.id); await frames(phone);
    await phone.locator('[data-city-encounter]').scrollIntoViewIfNeeded();
    const geometry = await phone.evaluate(() => {
      const rect = node => node.getBoundingClientRect().toJSON();
      const canvas = document.querySelector('.omerta-city__canvas canvas'), close = document.querySelector('[data-city-actor-close]'), action = document.querySelector('[data-city-encounter]');
      return { canvas: rect(canvas), engine: { width: canvas.width, height: canvas.height }, close: rect(close), action: rect(action), header: rect(document.querySelector('#top')),
        hits: [close, action].map(node => { const r = rect(node); return node.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); }) };
    });
    assert(geometry.close.height >= 44 && geometry.action.height >= 44 && geometry.hits.every(Boolean), JSON.stringify(geometry));
    assert(geometry.canvas.top >= geometry.header.bottom && geometry.canvas.bottom <= viewport.height, JSON.stringify(geometry));
    assert(Math.abs(geometry.engine.height - geometry.canvas.height) <= 1 && Math.abs(geometry.engine.width - geometry.canvas.width) <= 1);
    assert.match(await phone.locator('.omerta-city__readiness').textContent(), /LOW HEALTH/);
    const shots = process.env.CITY_PRESENCE_SHOTS;
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await phone.screenshot({ path: path.join(shots, 'city-people-' + viewport.width + '.png') }); }
    const beforeTouch = mutations(mobile.requests).length;
    // A 96px inspector map can legitimately crop every other person. Use its
    // closed map for the 320px touch setup; 375px still tests resize during the tap.
    if (viewport.width === 320) { await phone.locator('[data-city-actor-close]').click(); await frames(phone); }
    const current = await state(phone), box = await phone.locator('.omerta-city__canvas canvas').boundingBox();
    const marker = current.actorMarkers.find(marker => {
      const x = (marker.x - current.camera.x) * current.camera.zoom, y = (marker.y - 15 - current.camera.y) * current.camera.zoom;
      return x > 15 && x < box.width - 15 && y > 15 && y < box.height - 15;
    });
    assert(marker, 'At least one real actor marker is visible on the phone.');
    const opening = current.actorOpening;
    await phone.locator('.omerta-city__canvas canvas').tap({ position: { x: (marker.x - current.camera.x) * current.camera.zoom, y: (marker.y - 15 - current.camera.y) * current.camera.zoom } });
    await phone.waitForFunction(id => window.__presenceHandles.at(-1).handle.getState().selectedActor === id, marker.id, { timeout: 15000 });
    assert.equal((await state(phone)).actorOpening, opening + (viewport.width === 320 ? 1 : 2), 'One real tap opens exactly one inspector.');
    assert.equal(mutations(mobile.requests).length, beforeTouch, 'Touch movement/inspection performs no gameplay POST.');
    await phone.locator('[data-city-actor-close]').click();
    await phone.keyboard.press('e');
    await phone.waitForFunction(id => window.__presenceHandles.at(-1).handle.getState().selectedActor === id, marker.id);
    assert.equal(await phone.locator('[data-city-interact]').textContent(), 'Interact');
    await phone.keyboard.press('Escape');
    await phone.waitForFunction(() => document.activeElement === document.querySelector('.omerta-city__canvas canvas'));
    await phone.keyboard.press('Enter');
    await phone.waitForFunction(id => window.__presenceHandles.at(-1).handle.getState().selectedActor === id, marker.id);
    await phone.keyboard.press('Escape');
    assert.equal(mutations(mobile.requests).length, beforeTouch);
    if (viewport.width === 375) {
      await phone.locator('.omerta-city__actor-list').evaluate(node => node.scrollIntoView({ block: 'center' }));
      const scrollBefore = await phone.evaluate(() => scrollY), touch = await phone.context().newCDPSession(phone);
      try {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 140, y: 640 }] });
        for (const y of [585, 530, 475, 420]) { await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 140, y }] }); await frames(phone); }
      } finally { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach(); }
      await phone.waitForFunction(before => scrollY > before + 20, scrollBefore);
      assert.equal(mutations(mobile.requests).length, beforeTouch, 'Native touch scrolling remains usable outside the canvas.');
    }
    await mobile.context.close();
  }

  // Engine failure leaves the same public roster and explicit server actions usable.
  const fallbackContext = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  await fallbackContext.addInitScript(token => { localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1'); }, viewer.token);
  const fallback = await fallbackContext.newPage();
  fallback.on('pageerror', error => errors.push(error.message));
  await fallback.route('**/vendor/phaser.js*', route => route.abort('failed'));
  await fallback.goto(base, { waitUntil: 'networkidle' }); await fallback.locator('#btn-player-view').click();
  await fallback.waitForSelector('.omerta-city--unavailable [data-city-actor]');
  const fallbackCalls = []; fallback.on('request', request => fallbackCalls.push({ method: request.method(), path: new URL(request.url()).pathname }));
  await fallback.locator('[data-city-actor]').first().click();
  assert.deepEqual(mutations(fallbackCalls), []);
  await fallback.locator('[data-city-encounter]').click();
  await fallback.waitForFunction(() => document.querySelector('.omerta-city__actor-notice')?.textContent.startsWith('Intel recorded:'));
  await fallback.locator('[data-city-actor-close]').click();
  await fallback.waitForFunction(() => document.activeElement?.hasAttribute('data-city-actor'));
  await fallback.locator('[data-city-intel-open]').click(); assert.equal(await fallback.locator('[data-city-intel]').count(), 1);
  await fallbackContext.close();

  const realm = await newPage({ width: 375, height: 812 });
  const privateA = await encounter(realm.page, npc.id), realmMarker = crypto.randomUUID();
  assert((await realm.page.locator('#resp').textContent()).includes(privateA.body.intel.id), 'A completed opted action produces actual Last Word content before cleanup.');
  assert(await realm.page.locator('[data-operation-receipt]').count());
  await realm.page.locator('[data-city-encounter]').evaluate(button => { window.__formerOwnerButton = button; });
  await realm.page.evaluate(marker => { window.__sameRealmMarker = marker; }, realmMarker);
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [viewer.id]);
  const successor = await app.inject({ method: 'POST', url: '/v1/character', headers: viewer.headers, payload: { name: 'Presence Successor' } });
  assert.equal(successor.statusCode, 200, successor.body);
  await realm.page.locator('#btn-refresh').click();
  await realm.page.waitForFunction(() => document.querySelector('#whoami')?.textContent.includes('Presence Successor'));
  await realm.page.locator('#btn-dashboard-view').click();
  assert.equal(await realm.page.evaluate(() => window.__sameRealmMarker), realmMarker, 'An actual character switch preserves the JS realm rather than masking leakage with a reload.');
  assert.equal(await realm.page.locator('[data-city-intel]').count(), 0);
  assert(!(await realm.page.locator('#resp').textContent()).includes(privateA.body.intel.id));
  const privateReceipts = await realm.page.locator('[data-operation-receipt]').allTextContents();
  assert(!privateReceipts.some(text => text.includes('Collect intel from ' + privateA.body.encounteredActor.name)));
  const beforeFormerOwner = realm.requests.length;
  await realm.page.evaluate(() => window.__formerOwnerButton.click()); await frames(realm.page);
  assert.equal(realm.requests.slice(beforeFormerOwner).filter(request => request.path.startsWith('/v1/city/encounters/')).length, 0);
  await realm.context.close();

  const session = await newPage({ width: 375, height: 812 });
  await inspect(session.page, npc.id);
  await session.page.locator('[data-city-encounter]').evaluate(button => { window.__expiredEncounter = button; });
  const revoked = await app.inject({ method: 'POST', url: '/v1/auth/logout-all', headers: viewer.headers });
  assert.equal(revoked.statusCode, 200, revoked.body);
  await session.page.locator('#btn-refresh').click();
  await session.page.waitForSelector('#screen-auth:not(.hidden)');
  assert.equal(await session.page.locator('[data-city-actor], [data-city-intel]').count(), 0);
  const beforeExpired = session.requests.length;
  await session.page.evaluate(() => window.__expiredEncounter.click()); await frames(session.page);
  assert.equal(session.requests.slice(beforeExpired).filter(request => request.path.startsWith('/v1/city/encounters/')).length, 0);
  await session.context.close();
  assert.deepEqual(errors, []);
  console.log('city-presence-browser: public types/pagination/escaping, read-only inspection, fresh intel/objectives/replay, pose, queued cancellation, dispatched receipt and mobile touch/keyboard geometry pass');
} finally { await browser?.close(); await app.close(); }
