// Real server/scene integration for the neighborhood's contextual world tools.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';
import { PACING } from '../src/rules.js';

assert(!process.env.DATABASE_URL, 'World host browser fixtures require disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';
const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
  .find(file => file && fs.existsSync(file));
assert(executablePath);
const client = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const toastFunctions = client.slice(client.indexOf('  function dismissToast()'), client.indexOf('  // THE TRAVEL PICKER'));
assert(toastFunctions.includes('function toast(') && toastFunctions.includes('t.inert = true'));
const app = await buildServer(); let browser;
try {
  const create = async name => {
    const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });
    assert.equal(guest.statusCode, 200);
    const token = guest.json().token, headers = { authorization: 'Bearer ' + token };
    const made = await app.inject({ method: 'POST', url: '/v1/character', headers, payload: { name } });
    assert.equal(made.statusCode, 200, made.body);
    const character = (await app.pool.query('SELECT id,generation,loc,account_id FROM characters WHERE account_id=$1 AND alive', [app.jwt.verify(token).sub])).rows[0];
    return { token, headers, character };
  };
  const viewer = await create('World Player'), neighbor = await create('Nearby Player');
  const errors = [], contexts = [];
  await app.pool.query('UPDATE characters SET cash=100000,health=22,energy=45,nerve=10,last_accrued_at=$2 WHERE id=$1',
    [viewer.character.id, new Date(Date.now() + 600000)]);
  const rulesReply = await app.inject({ method: 'GET', url: '/v1/rules' });
  assert.equal(rulesReply.statusCode, 200); const rules = rulesReply.json();
  const weapon = rules.guns.find(gun => gun.crates === 0) || rules.guns[0]; assert(weapon);
  await app.pool.query('UPDATE characters SET cb=$2,cash=$3 WHERE id=$1', [viewer.character.id, weapon.crates, weapon.cash + 500]);
  const bought = await app.inject({ method: 'POST', url: '/v1/armory/gun/' + weapon.id + '/buy', headers: { ...viewer.headers, 'idempotency-key': crypto.randomUUID() }, payload: {} });
  assert.equal(bought.statusCode, 200, bought.body);
  const unequipped = await app.inject({ method: 'POST', url: '/v1/armory/unequip', headers: { ...viewer.headers, 'idempotency-key': crypto.randomUUID() }, payload: {} });
  assert.equal(unequipped.statusCode, 200, unequipped.body);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ executablePath, headless: true });
  const newPage = async (viewport = { width: 375, height: 812 }, { reducedMotion = 'no-preference', noResizeObserver = false, engineFailure = false, moduleFailure = false, pendingEntry = false, actor = viewer } = {}) => {
    const context = await browser.newContext({ viewport, isMobile: viewport.width <= 680, hasTouch: viewport.width <= 680, reducedMotion, serviceWorkers: 'block' });
    contexts.push(context);
    await context.addInitScript(({ token, noResizeObserver }) => {
      localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1');
      if (noResizeObserver) window.ResizeObserver = undefined;
      window.__worldGames = []; window.__worldHandles = []; window.__worldReads = [];
      let engine, module;
      Object.defineProperty(window, 'Phaser', { configurable: true, get: () => engine, set: value => {
        engine = value; value.Game = new Proxy(value.Game, { construct(target, args) {
          const game = Reflect.construct(target, args); window.__worldGames.push(game); return game;
        } });
      } });
      Object.defineProperty(window, 'OmertaCityScene', { configurable: true, get: () => module, set: value => {
        module = { ...value, mount(...args) {
          const read = args[1].onWorldRead;
          args[1] = { ...args[1], onWorldRead: (kind, context) => { window.__worldReads.push(kind); return read(kind, context); } };
          const handle = value.mount(...args), record = { handle, destroyed: false };
          window.__worldHandles.push(record);
          return { ...handle, destroy() { record.destroyed = true; handle.destroy(); } };
        } };
      } });
    }, { token: actor.token, noResizeObserver });
    if (engineFailure) await context.route('**/vendor/phaser.js*', route => route.abort('failed'));
    if (moduleFailure) await context.route('**/city-world-ui.js*', route => route.abort('failed'));
    let releaseArt;
    if (pendingEntry) {
      const artGate = new Promise(resolve => { releaseArt = resolve; });
      await context.route('**/art/city-neighborhood-v1.png*', async route => {
        const response = await route.fetch(); await artGate; await route.fulfill({ response });
      });
    }
    const page = await context.newPage(); await page.bringToFront();
    page.on('pageerror', error => errors.push(error.message));
    const requests = []; page.on('request', request => requests.push({ method: request.method(), path: new URL(request.url()).pathname }));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForSelector('#screen-main:not(.hidden)');
    if (await page.locator('.modal-bg[data-managed-dialog]').count()) {
      console.log('Host entry dialog:', (await page.locator('.modal-bg[data-managed-dialog]').last().textContent()).trim().slice(0, 180));
      await page.keyboard.press('Escape');
    }
    await page.locator('#btn-player-view').click();
    if (engineFailure) await page.locator('.omerta-city--unavailable').waitFor();
    else if (!pendingEntry) await page.waitForFunction(() => window.__worldHandles.at(-1)?.handle.getState().ready);
    if (!moduleFailure) await page.locator('[data-city-world-tools]').waitFor({ state: 'visible' });
    return { page, context, requests, releaseArt };
  };
  const state = page => page.evaluate(() => window.__worldHandles.at(-1).handle.getState());
  const frames = page => page.evaluate(() => new Promise(resolve => { let count = 0; const step = () => ++count >= 8 ? resolve() : requestAnimationFrame(step); requestAnimationFrame(step); }));
  const mutations = requests => requests.filter(request => !['GET', 'HEAD'].includes(request.method) && !['/v1/screens', '/v1/commands/observations'].includes(request.path));
  const bounded = (promise, label) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Timed out waiting for ' + label)), 30000);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
  const dismissCine = async page => { if (await page.locator('#cine.on').count()) await page.locator('#cine.on').evaluate(node => node.click()); };
  const panel = async (page, kind) => {
    if (!await page.locator('.city-world__dock').isVisible()) await page.locator('[data-city-world-tools]').click();
    await page.locator(`[data-city-world-panel="${kind}"]`).click(); await frames(page);
  };
  const refresh = async page => {
    const response = page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/projections/player' && reply.status() === 200);
    await page.locator('#btn-refresh').click(); const body = await (await response).json(); await frames(page);
    return body.player?.character || body.player;
  };
  const post = async (page, control, pathname) => {
    const response = page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === pathname);
    await page.locator(control).click(); const reply = await response;
    assert.equal(reply.status(), 200, await reply.text());
    await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().worldUI?.pending === false);
    return { reply, body: await reply.json() };
  };
  const preferences = async (actor, change) => {
    const board = (await app.inject({ method: 'GET', url: '/v1/city/social', headers: actor.headers })).json();
    const id = 'outfit' in change ? 'outfit:' + change.outfit : change.chatEnabled ? 'chat:enable' : 'chat:disable';
    const action = board.actions.find(action => action.id === id); assert(action?.available);
    const response = await app.inject({ method: action.method, url: action.path,
      headers: { ...actor.headers, 'idempotency-key': crypto.randomUUID() }, payload: action.body });
    assert.equal(response.statusCode, 200, response.body); return response.json();
  };
  const inspectFrame = async page => {
    await frames(page);
    return page.evaluate(() => {
      const rect = node => node.getBoundingClientRect().toJSON(), hit = node => {
        const box = rect(node); return [box.top + 3, box.bottom - 3].every(y => {
          const target = document.elementFromPoint(box.left + box.width / 2, y); return target === node || node.contains(target);
        });
      };
      const canvas = document.querySelector('.omerta-city__canvas canvas'), box = rect(canvas);
      const game = window.__worldGames.findLast(game => game.canvas === canvas && game.scene?.getScenes(true).length), scene = game.scene.getScenes(true)[0], camera = scene.cameras.main;
      const sprite = scene.children.list.find(node => node.texture?.key === 'city-player' || node.texture?.key?.startsWith('city-art-player-'));
      const avatar = [sprite, scene.data.get('playerName')].map(node => { const bounds = node.getBounds(); return {
        top: (bounds.top - camera.worldView.y) * camera.zoom * box.height / camera.height,
        bottom: (bounds.bottom - camera.worldView.y) * camera.zoom * box.height / camera.height,
        left: (bounds.left - camera.worldView.x) * camera.zoom * box.width / camera.width,
        right: (bounds.right - camera.worldView.x) * camera.zoom * box.width / camera.width }; });
      const tools = document.querySelector('[data-city-world-tools]'), guidance = document.querySelector('.omerta-city__next-move');
      const close = document.querySelector('[data-city-world-close]'), dock = document.querySelector('.city-world__dock');
      const bottom = ['bnav', 'toast'].map(id => document.getElementById(id)).filter(node => {
        const style = node && getComputedStyle(node), bounds = node?.getBoundingClientRect();
        return bounds?.height && ['fixed', 'sticky'].includes(style.position) && (node.id !== 'toast' || node.classList.contains('show'));
      }).reduce((limit, node) => Math.min(limit, node.getBoundingClientRect().top), innerHeight);
      return { canvas: box, engine: { width: canvas.width, height: canvas.height }, avatar,
        header: rect(document.querySelector('#top')), tools: rect(tools), toolsHit: hit(tools), guidance: rect(guidance),
        close: close && !close.closest('[hidden]') ? { bounds: rect(close), hit: hit(close) } : null, dock: dock && !dock.hidden ? rect(dock) : null, width: innerWidth, height: innerHeight,
        overflow: document.documentElement.scrollWidth, tint: sprite.tintTopLeft, bottom,
        hud: rect(document.querySelector('.omerta-city__world-hud')), readiness: document.querySelector('.omerta-city__readiness').textContent };
    });
  };
  const assertFrame = async page => {
    const view = await inspectFrame(page), detail = JSON.stringify(view);
    assert(view.tools.height >= 44 && view.toolsHit && view.tools.top >= 0 && view.tools.bottom <= view.height, 'World tools stay visible in the global header: ' + detail);
    assert(view.overflow <= view.width + 1, 'The header does not widen the phone: ' + detail);
    assert(view.hud.top >= view.header.bottom - 1 && view.canvas.bottom <= view.bottom + 1, 'HUD and map remain in the usable frame: ' + detail);
    assert(Math.abs(view.canvas.height - view.engine.height) <= 1 && Math.abs(view.canvas.width - view.engine.width) <= 1, 'CSS and Phaser dimensions agree: ' + detail);
    assert(view.avatar.every(bounds => bounds.top >= -1 && bounds.bottom <= view.canvas.height + 1 && bounds.left >= -1 && bounds.right <= view.canvas.width + 1), 'Complete actual avatar/name stay visible: ' + detail);
    if (view.close) assert(view.close.bounds.height >= 44 && view.close.hit, 'The world-panel close remains usable: ' + detail);
    if (view.dock) assert(view.dock.top >= view.header.bottom - 1 && view.dock.bottom <= view.bottom + 1, 'The entire bounded world dock stays above fixed chrome: ' + detail);
    return view;
  };

  // Real delayed art keeps the explicit entry pending while Tools is already
  // usable. Canceling that entry must not move the clicked header button.
  const pending = await newPage(undefined, { pendingEntry: true });
  try {
    assert.equal(await pending.page.locator('#btn-player-view').getAttribute('aria-busy'), 'true');
    assert.equal(await pending.page.locator('#btn-player-view').textContent(), 'Player view');
    assert.equal((await state(pending.page)).ready, false);
    const toolsBefore = await pending.page.locator('[data-city-world-tools]').boundingBox();
    const pendingMutations = pending.requests.length;
    await pending.page.locator('[data-city-world-tools]').click({ delay: 80 });
    assert.equal(await pending.page.locator('.city-world__dock').isVisible(), true, 'A real pending-entry Tools click opens the dock.');
    assert.deepEqual(await pending.page.locator('[data-city-world-tools]').boundingBox(), toolsBefore, 'Canceling pending entry preserves the header click target.');
    assert.equal(await pending.page.locator('#btn-player-view').getAttribute('aria-busy'), null);
    await panel(pending.page, 'style');
    pending.releaseArt();
    await pending.page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().ready);
    await frames(pending.page);
    assert.equal((await state(pending.page)).worldUI.panel, 'style');
    assert(await pending.page.evaluate(() => document.querySelector('.city-world__dock').contains(document.activeElement)), 'Canceled entry cannot steal focus from the selected tools panel.');
    assert.deepEqual(mutations(pending.requests.slice(pendingMutations)), [], 'Pending entry and Tools inspection remain read-only.');
  } finally { pending.releaseArt(); await pending.context.close(); }
  const { page, requests } = await newPage(undefined, { noResizeObserver: true });
  const pose = (await state(page)).position, handles = await page.evaluate(() => window.__worldHandles.length), initial = requests.length;
  let view = await assertFrame(page);
  if (process.env.CITY_WORLD_SHOTS) { fs.mkdirSync(process.env.CITY_WORLD_SHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.CITY_WORLD_SHOTS, 'city-world-host-entry-375.png') }); }
  assert(view.guidance.top >= view.header.bottom - 1 && view.guidance.bottom <= view.canvas.top, 'A fresh player sees the issued NPC objective above the map: ' + JSON.stringify(view));
  assert.match(await page.locator('.omerta-city__next-move').textContent(), /Visit The Fixer/);
  assert.equal(requests.filter(request => request.path === '/v1/city/nearby-chat').length, 0, 'Default-off chat makes no feed request.');
  await panel(page, 'bag');
  await page.locator(`[data-city-equip="${weapon.id}"]`).waitFor();
  await assertFrame(page);
  assert.deepEqual(mutations(requests.slice(initial)), [], 'Opening world tools/inventory remains read-only.');
  await post(page, `[data-city-equip="${weapon.id}"]`, '/v1/armory/gun/' + weapon.id + '/equip');
  const equipped = await app.inject({ method: 'GET', url: '/v1/projections/player', headers: viewer.headers });
  assert.equal(equipped.statusCode, 200, equipped.body); assert.equal(equipped.json().player.gun, weapon.id);
  await panel(page, 'style'); await page.locator('[data-city-outfit="wine"]').waitFor();
  await post(page, '[data-city-outfit="wine"]', '/v1/city/social/preferences');
  await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().look === 'wine');
  assert.equal((await inspectFrame(page)).tint, 0xba8790, 'A saved published preset really changes the avatar tint.');
  let social = (await app.inject({ method: 'GET', url: '/v1/city/social', headers: viewer.headers })).json();
  assert.equal(social.preferences.outfit, 'wine'); assert.equal(social.preferences.chatEnabled, false);
  await panel(page, 'room'); await page.locator('select[aria-label="Furniture to place"]').waitFor();
  await assertFrame(page);
  await page.locator('select[aria-label="Furniture to place"]').selectOption('lamp');
  await page.getByLabel('Furniture column', { exact: true }).fill('6'); await page.getByLabel('Furniture row', { exact: true }).fill('6');
  await post(page, '[data-world-control="Place furniture"]', '/v1/city/social/preferences');
  social = (await app.inject({ method: 'GET', url: '/v1/city/social', headers: viewer.headers })).json();
  assert(social.preferences.room.furniture.some(item => item.id === 'lamp' && item.x === 5 && item.y === 5));
  const room = page.locator('.city-world__room'); await room.evaluate(node => {
    const dock = node.closest('.city-world__dock'), bar = dock.querySelector('.city-world__dock-bar');
    dock.scrollTop += node.getBoundingClientRect().top - dock.getBoundingClientRect().top - bar.getBoundingClientRect().height - 8;
  });
  const roomReading = await page.evaluate(async () => {
    const positions = []; for (let i = 0; i < 30; i++) {
      await new Promise(requestAnimationFrame); positions.push({ outer: scrollY, inner: document.querySelector('.city-world__dock').scrollTop });
    } return positions;
  });
  assert(roomReading.every(position => position.outer === roomReading[0].outer && position.inner === roomReading[0].inner),
    'A panel opening cancels prior native smooth scrolling and preserves subsequent internal reading: ' + JSON.stringify(roomReading));
  await assertFrame(page);
  const roomBounds = await room.boundingBox(), closeBounds = await page.locator('[data-city-world-close]').boundingBox();
  assert(roomBounds.y >= closeBounds.y + closeBounds.height - 1 && roomBounds.y + roomBounds.height <= page.viewportSize().height, 'The entire room preview remains visible below its reachable close.');
  if (process.env.CITY_WORLD_SHOTS) await page.screenshot({ path: path.join(process.env.CITY_WORLD_SHOTS, 'city-world-host-room-375.png') });
  const roomCalls = requests.length; await page.getByRole('button', { name: 'Use Lamp', exact: true }).click();
  assert.deepEqual(mutations(requests.slice(roomCalls)), [], 'Using free room scenery is cosmetic, not an invented gameplay API.');
  await panel(page, 'map'); await page.locator('[data-city-minimap]').waitFor(); await assertFrame(page);
  const waypoint = (await state(page)).destinations.find(venue => venue.id === 'stories'), beforeWaypoint = requests.length;
  await page.locator('[data-city-waypoint="stories"]').click();
  const moving = await state(page);
  assert(Math.hypot(moving.position.x - waypoint.x, moving.position.y - waypoint.y) > 40 && moving.pathLength > 0, 'A waypoint starts real local walking instead of teleporting.');
  await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().pathLength === 0, undefined, { timeout: 15000 });
  assert.equal((await state(page)).selectedVenue, 'stories');
  await page.waitForFunction(() => [...document.querySelectorAll('.city-world__speech,.city-world__dialogue')]
    .some(node => !node.hidden && node.textContent.includes('THE EDITOR')));
  assert.match(await page.locator('.city-world__speech,.city-world__dialogue').allTextContents().then(text => text.join(' ')), /A clue is a lead/);
  assert.deepEqual(mutations(requests.slice(beforeWaypoint)), []);
  await page.keyboard.press('Escape');
  let walkingPose = (await state(page)).position;
  await panel(page, 'skills');
  await page.locator('.city-world__stats').waitFor();
  await page.locator('[data-city-world-close]').click();
  await page.locator('[data-destination="training"]').click(); await page.locator('[data-city-action="streets"]').click();
  const muscleBefore = (await app.pool.query('SELECT muscle FROM characters WHERE id=$1', [viewer.character.id])).rows[0].muscle;
  const trained = await post(page, '[data-city-train="muscle"]', '/v1/train/muscle');
  const muscleAfter = (await app.pool.query('SELECT muscle FROM characters WHERE id=$1', [viewer.character.id])).rows[0].muscle;
  assert.equal(Number(muscleAfter), Number(muscleBefore) + trained.body.gain);
  await page.waitForFunction(gain => document.querySelector('.city-world__gains').textContent.includes('muscle +' + gain), trained.body.gain);
  assert.deepEqual((await state(page)).position, walkingPose);
  await page.locator('[data-city-training-close]').click();
  await panel(page, 'chat'); await page.locator('[data-city-chat-consent]').waitFor();
  assert.equal(requests.filter(request => request.path === '/v1/city/nearby-chat').length, 0, 'Room/style/skills do not silently join or load chat.');
  await post(page, '[data-city-chat-consent]', '/v1/city/social/preferences');
  await page.locator('[data-city-nearby-input]').waitFor();
  const neighborSocial = (await app.inject({ method: 'GET', url: '/v1/city/social', headers: neighbor.headers })).json();
  const join = neighborSocial.actions.find(action => action.id === 'chat:enable');
  assert.equal((await app.inject({ method: join.method, url: join.path, headers: { ...neighbor.headers, 'idempotency-key': crypto.randomUUID() }, payload: join.body })).statusCode, 200);
  const send = async text => {
    const current = (await app.inject({ method: 'GET', url: '/v1/city/social', headers: neighbor.headers })).json();
    const issued = current.actions.find(action => action.id === 'chat:send');
    const reply = await app.inject({ method: issued.method, url: issued.path, headers: { ...neighbor.headers, 'idempotency-key': crypto.randomUUID() }, payload: { ...issued.body, text } });
    assert.equal(reply.statusCode, 200, reply.body); return reply.json();
  };
  await send('First nearby message'); await new Promise(resolve => setTimeout(resolve, 2100)); await send('Newest nearby message');
  await page.locator('[data-city-world-close]').click();
  await page.waitForFunction(() => document.querySelector('.city-world__speech').textContent.includes('Newest nearby message') || document.querySelector('.city-world__dialogue').textContent.includes('Newest nearby message'), undefined, { timeout: 12000 });
  await panel(page, 'chat');
  const transcript = await page.locator('.city-world__chat-feed').textContent();
  assert(transcript.indexOf('First nearby message') < transcript.indexOf('Newest nearby message'), 'Real nearby messages render oldest-first while the bubble uses the newest.');
  await post(page, '[data-city-chat-consent]', '/v1/city/social/preferences');
  const leftChat = requests.length; await page.locator('[data-city-world-close]').click();
  await new Promise(resolve => setTimeout(resolve, 5200));
  assert.equal(requests.slice(leftChat).filter(request => request.path === '/v1/city/nearby-chat').length, 0, 'Leaving consent stops feed polling.');
  assert.equal(await page.locator('.city-world__speech:not([hidden])').count(), 0);
  assert.equal(await page.locator('.city-world__dialogue:not([hidden])').count(), 0);
  console.log('world host: core tools, saved room, walking, stats and chronological chat passed');
  await panel(page, 'style'); await page.locator('[data-city-outfit="ink"]').waitFor();
  // An intent belongs to one opening, even if that same panel is reopened while
  // an authenticated read holds the application's actual request queue.
  let releaseRead;
  const readGate = new Promise(resolve => { releaseRead = resolve; });
  await page.route('**/v1/projections/player*', async route => { await readGate; await route.continue(); });
  const heldRead = page.waitForRequest(request => new URL(request.url()).pathname === '/v1/projections/player');
  await page.locator('#btn-refresh').click(); await heldRead;
  const queuedAt = requests.length;
  try {
    await page.locator('[data-city-outfit="ink"]').click();
    await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().worldUI.pending);
    await page.locator('[data-city-world-close]').click(); await panel(page, 'style');
  } finally { releaseRead(); }
  await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().worldUI.pending === false);
  await page.unroute('**/v1/projections/player*');
  assert.equal(mutations(requests.slice(queuedAt)).filter(request => request.path === '/v1/city/social/preferences').length, 0,
    'Close and reopen cannot revive the old queued world choice.');
  assert.equal((await app.inject({ method: 'GET', url: '/v1/city/social', headers: viewer.headers })).json().preferences.outfit, 'wine');
  let releaseSaved, saved;
  const savedGate = new Promise(resolve => { releaseSaved = resolve; }), savedReply = new Promise(resolve => { saved = resolve; });
  await page.route('**/v1/city/social/preferences', async route => {
    const reply = await route.fetch(); saved(reply); await savedGate; await route.fulfill({ response: reply });
  });
  const dispatched = page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/city/social/preferences');
  await page.locator('[data-city-outfit="moss"]').click(); assert.equal((await bounded(savedReply, 'the committed outfit reply')).status(), 200);
  await page.locator('[data-city-world-close]').click(); releaseSaved();
  assert.equal((await dispatched).status(), 200);
  await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().worldUI.pending === false);
  await page.unroute('**/v1/city/social/preferences');
  assert.equal((await state(page)).worldUI.panel, '', 'A dispatched reply does not reopen its retired panel.');
  await panel(page, 'style');
  await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().look === 'moss');
  assert.match(await page.locator('.city-world__receipt').textContent(), /Moss|outfit|look/i);
  // Both atomic-commit uncertainty codes keep the exact actual method/body/key.
  // A sibling changes the saved preset before replay; cached receipts are history,
  // and the winning social GET must keep that newer preference.
  for (const code of ['item_commit_unknown', 'item_recovery_required']) {
    const attempts = []; let original;
    await page.route('**/v1/city/social/preferences', async route => {
      attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
      const reply = await route.fetch(); assert.equal(reply.status(), 200);
      if (!original) { original = await reply.text(); await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: code, message: 'Retry the same request key.' }) }); }
      else await route.fulfill({ response: reply });
    });
    const uncertain = page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/city/social/preferences');
    await page.locator('[data-city-outfit="ink"]').click(); assert.equal((await uncertain).status(), 503);
    await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().worldUI.pending === false);
    await page.locator('[data-city-world-retry]').waitFor();
    assert.equal(await page.locator('[data-city-outfit]:enabled').count(), 0, 'Uncertainty blocks fresh outfit keys.');
    await page.locator('[data-city-world-close]').click(); await panel(page, 'bag');
    assert.equal(await page.locator('[data-city-equip]:enabled').count(), 0, 'Closing/changing actor controls cannot bypass pending world recovery.');
    await preferences(viewer, { outfit: 'wine' }); await panel(page, 'style');
    await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().look === 'wine');
    const recovered = page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/city/social/preferences');
    await page.locator('[data-city-world-retry]').click(); const replay = await recovered;
    assert.equal(replay.status(), 200); assert.equal(await replay.text(), original, 'Recovery receives the immutable original HTTP success.');
    await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().worldUI.pending === false);
    await page.unroute('**/v1/city/social/preferences');
    assert.equal(attempts.length, 2); assert.deepEqual(attempts[1], attempts[0]);
    await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().look === 'wine');
    assert.equal((await app.inject({ method: 'GET', url: '/v1/city/social', headers: viewer.headers })).json().preferences.outfit, 'wine');
  }
  // Real denial from another client retires the transcript immediately and stops
  // polling. A later superseded denial cannot turn a newer Join back off.
  await panel(page, 'chat'); await post(page, '[data-city-chat-consent]', '/v1/city/social/preferences');
  await preferences(viewer, { chatEnabled: false });
  const denied = page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/city/nearby-chat' && reply.status() === 403);
  await denied;
  await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().worldUI.chatJoined === false);
  assert.equal(await page.locator('.city-world__chat-feed').count(), 0);
  assert.equal(await page.locator('.city-world__speech:not([hidden]),.city-world__dialogue:not([hidden])').count(), 0);
  await post(page, '[data-city-chat-consent]', '/v1/city/social/preferences');
  let releaseDenied, observedDenied;
  const denialGate = new Promise(resolve => { releaseDenied = resolve; }), denialObserved = new Promise(resolve => { observedDenied = resolve; });
  await preferences(viewer, { chatEnabled: false });
  const oldDenial = page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/city/nearby-chat' && reply.status() === 403);
  await page.route('**/v1/city/nearby-chat?*', async route => {
    const reply = await route.fetch(); assert.equal(reply.status(), 403); observedDenied(); await denialGate; await route.fulfill({ response: reply });
  });
  // Chat's five-second background read is actual; it is not a fabricated DTO.
  await bounded(denialObserved, 'the held real opt-out denial');
  await preferences(viewer, { chatEnabled: true });
  const winningConsent = page.waitForResponse(async reply => new URL(reply.url()).pathname === '/v1/city/social'
    && reply.status() === 200 && (await reply.json()).preferences.chatEnabled === true);
  await panel(page, 'style');
  releaseDenied(); await oldDenial; await page.unroute('**/v1/city/nearby-chat?*');
  await winningConsent;
  await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().worldUI.chatJoined === true);
  await panel(page, 'chat'); await page.locator('[data-city-nearby-input]').waitFor();
  await panel(page, 'style');
  const emote = await post(page, '[data-city-emote="wave"]', '/v1/city/nearby-chat');
  assert.equal(emote.reply.request().postDataJSON().emoteId, 'wave'); assert.equal(emote.body.message.kind, 'emote');
  assert.match(await page.locator('.city-world__receipt').textContent(), /Emote shared/);
  assert(!(await page.locator('.city-world__receipt').textContent()).includes('[object Object]'));
  for (const status of [429, 500]) {
    await page.locator('[data-city-world-close]').click();
    await page.route('**/v1/city/social', route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'city_social_unavailable' }) }));
    const transient = page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/city/social' && reply.status() === status);
    await panel(page, 'style'); await transient; await frames(page);
    assert.equal((await state(page)).look, 'wine'); assert.equal((await state(page)).worldUI.chatJoined, true);
    assert.equal(await page.locator('[data-city-outfit]').count(), 4, 'A transient read keeps the last guarded outfit catalog.');
    await page.unroute('**/v1/city/social');
  }
  await panel(page, 'chat'); await post(page, '[data-city-chat-consent]', '/v1/city/social/preferences');
  await page.locator('[data-city-world-close]').click();
  console.log('world host: queued/sent/uncertain same-key actions, historical preferences, consent retirement and emote receipts passed');
  await app.pool.query('UPDATE characters SET respect=$2,nerve=10,last_accrued_at=$3 WHERE id=$1', [viewer.character.id, PACING.LEVEL_DIVISOR - 1, new Date(Date.now() + 600000)]);
  const beforeLevel = await refresh(page); assert.equal(beforeLevel.level, 1);
  await page.locator('[data-destination="fixer"]').click(); await page.locator('[data-city-open]').click();
  const smallJob = rules.crimes.filter(job => job.lvl === 1).sort((a, b) => a.nerve - b.nerve)[0];
  await page.locator('[data-city-crime-select]').selectOption(smallJob.id);
  await page.route('**/v1/crimes/' + smallJob.id, async route => {
    // Bound only this disposable server request's random success branch; cost,
    // respect, receipt and player projection still execute the actual engine.
    const random = Math.random; Math.random = () => 0;
    try { const reply = await route.fetch(); await route.fulfill({ response: reply }); }
    finally { Math.random = random; }
  });
  const leveled = await post(page, '[data-city-approach="quiet"]', '/v1/crimes/' + smallJob.id);
  await page.unroute('**/v1/crimes/' + smallJob.id);
  assert.equal(leveled.body.success, true);
  await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().resources.level === 2);
  assert.match(await page.locator('.city-world__gains').textContent(), /Level 2 reached/);
  const afterLevel = (await app.inject({ method: 'GET', url: '/v1/projections/player', headers: viewer.headers })).json().player;
  assert.equal(afterLevel.level, 2); assert(afterLevel.respect > beforeLevel.respect);
  await dismissCine(page); await page.locator('[data-city-training-close]').click();
  await page.locator('#toast.show').focus();
  const fullToast = await page.locator('#toast > span:not(.ti)').textContent();
  assert(fullToast.length > 100, 'The controlled real job reaches a long multi-line outcome toast.');
  const ambient = (await state(page)).ambient;
  await page.waitForFunction(before => window.__worldHandles.at(-1).handle.getState().ambient.some((point, index) => Math.hypot(point.x - before[index].x, point.y - before[index].y) > 2), ambient);
  const decorations = await state(page);
  assert(decorations.ambient.every(point => !decorations.obstacles.some(box => point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height)), 'Decorative routines remain outside solid buildings.');
  assert.equal(await page.evaluate(() => window.__worldHandles.length), handles);
  for (const viewport of [{ width: 320, height: 568 }, { width: 1366, height: 600 }]) {
    await page.setViewportSize(viewport); await page.locator('#btn-player-view').click(); await assertFrame(page);
    await panel(page, 'map'); await assertFrame(page);
    if (viewport.width === 320) {
      const toastBox = await page.locator('#toast').evaluate(node => ({ height: node.getBoundingClientRect().height,
        scroll: node.scrollHeight, client: node.clientHeight, tabIndex: node.tabIndex, live: node.getAttribute('aria-live') }));
      assert(toastBox.height <= 56 && toastBox.scroll > toastBox.client && toastBox.tabIndex === 0 && toastBox.live,
        'The complete outcome stays scrollable and keyboard accessible inside a bounded Player toast: ' + JSON.stringify(toastBox));
      assert.equal(await page.locator('#toast > span:not(.ti)').textContent(), fullToast, 'Presentation preserves the full actual outcome text.');
      await page.locator('#toast').focus(); await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => document.querySelector('#toast').scrollTop > 0);
      await new Promise(resolve => setTimeout(resolve, 3500));
      assert(await page.locator('#toast.show').isVisible(), 'The existing dismiss clock pauses while the player reads the focused toast.');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#toast.show').count(), 0); assert.equal((await state(page)).worldUI.panel, 'map', 'Dismissing the focused toast does not close the gameplay panel.');
      assert(await page.locator('#toast').evaluate(node => node.inert && node.tabIndex === -1 && !node.contains(document.activeElement)),
        'Escape retires the toast and all descendant focus targets.');
      await page.keyboard.press('Tab'); assert.equal(await page.locator('#toast').evaluate(node => node.contains(document.activeElement)), false);
    }
    await page.locator('[data-city-world-close]').click();
    assert.deepEqual((await state(page)).position, walkingPose);
  }
  const still = await newPage({ width: 375, height: 812 }, { reducedMotion: 'reduce' });
  const frozen = (await state(still.page)).ambient; await frames(still.page); assert.deepEqual((await state(still.page)).ambient, frozen);
  await still.context.close(); await page.bringToFront();
  // Execute the exact production DOM helpers in this browser realm, without a
  // gameplay request, to cover retirement paths beyond this player's receipts.
  await page.evaluate(source => {
    window.__toastProof = new Function('$', 'haptic', source + '\nreturn { toast, dismissToast };')(selector => document.querySelector(selector), () => {});
  }, toastFunctions);
  await page.evaluate(() => window.__toastProof.toast('Timeout feedback'));
  await page.waitForFunction(() => !document.querySelector('#toast').classList.contains('show'), undefined, { timeout: 5000 });
  assert(await page.locator('#toast').evaluate(node => node.inert && node.tabIndex === -1));
  await page.locator('#btn-refresh').focus(); await page.keyboard.press('Tab');
  assert.equal(await page.locator('#toast').evaluate(node => node.contains(document.activeElement)), false, 'A timed-out message is absent from keyboard navigation.');
  await page.evaluate(() => { window.__toastActions = 0; window.__toastProof.toast('Action feedback', false,
    { label: 'Read this clue', run: () => { window.__toastActions++; } }); });
  await page.locator('#toast .toast-act').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.__toastActions), 1);
  assert(await page.locator('#toast').evaluate(node => node.inert && node.tabIndex === -1 && !node.contains(document.activeElement)));
  await page.keyboard.press('Tab'); assert.equal(await page.locator('#toast').evaluate(node => node.contains(document.activeElement)), false, 'An activated message retires its action button.');
  await page.evaluate(() => window.__toastProof.toast('Dismissible feedback', false, { label: 'Read this clue', run: () => { window.__toastActions++; } }));
  await page.locator('#toast .toast-x').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.__toastActions), 1); assert(await page.locator('#toast').evaluate(node => node.inert && node.tabIndex === -1));
  const tiny = await newPage({ width: 320, height: 568 }, { noResizeObserver: true });
  const tinyStart = tiny.requests.length, tinyInitial = await assertFrame(tiny.page);
  assert(tinyInitial.guidance.top >= tinyInitial.header.bottom - 1 && tinyInitial.guidance.bottom <= tinyInitial.canvas.top,
    'The first short-phone Player entry shows its issued objective with the map.');
  await panel(tiny.page, 'map'); await tiny.page.locator('[data-city-waypoint="stories"]').click();
  await tiny.page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().pathLength === 0);
  await tiny.page.waitForFunction(() => !document.querySelector('.city-world__dialogue').hidden && document.querySelector('.city-world__dialogue').textContent.includes('THE EDITOR'));
  await assertFrame(tiny.page);
  assert.deepEqual(mutations(tiny.requests.slice(tinyStart)), [], 'Short-frame authored NPC dialogue/waypoints remain read-only.');
  if (process.env.CITY_WORLD_SHOTS) await tiny.page.screenshot({ path: path.join(process.env.CITY_WORLD_SHOTS, 'city-world-host-dialogue-320.png') });
  await tiny.page.keyboard.press('Escape');
  await tiny.page.locator('[data-city-world-tools]').tap(); await frames(tiny.page);
  assert.equal((await state(tiny.page)).worldUI.panel, 'map', 'The visible 44px Tools control opens with an actual phone tap.');
  if (process.env.CITY_WORLD_SHOTS) await tiny.page.screenshot({ path: path.join(process.env.CITY_WORLD_SHOTS, 'city-world-host-map-320.png') });
  const beforeTap = await state(tiny.page), tapCanvas = await tiny.page.locator('.omerta-city__canvas canvas').boundingBox();
  const tapGoal = { x: beforeTap.position.x + 48, y: beforeTap.position.y };
  await tiny.page.touchscreen.tap(tapCanvas.x + (tapGoal.x - beforeTap.camera.x) * beforeTap.camera.zoom,
    tapCanvas.y + (tapGoal.y - beforeTap.camera.y) * beforeTap.camera.zoom);
  await tiny.page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().pathLength === 0);
  const tapped = await state(tiny.page);
  assert.equal(tapped.worldUI.panel, ''); assert(Math.hypot(tapped.position.x - tapGoal.x, tapped.position.y - tapGoal.y) <= 12,
    'A real canvas touch keeps its world point when closing/resizing the tools panel: ' + JSON.stringify({ before: beforeTap.position, goal: tapGoal, actual: tapped.position }));
  await assertFrame(tiny.page);
  assert.deepEqual(mutations(tiny.requests.slice(tinyStart)), [], 'Touching tools and walking send no gameplay action.');
  await tiny.context.close(); await page.bringToFront();
  const fallback = await newPage({ width: 375, height: 812 }, { engineFailure: true });
  const fallbackAt = fallback.requests.length;
  await panel(fallback.page, 'bag'); await fallback.page.locator('[data-city-equip]').waitFor();
  assert.deepEqual(mutations(fallback.requests.slice(fallbackAt)), [], 'Engine failure preserves read-only World tools/inventory.');
  await fallback.page.locator('[data-city-world-close]').click();
  await fallback.page.locator('[data-destination="training"]').click();
  await fallback.page.locator('[data-city-open]').click();
  await fallback.page.locator('#tab-life.on').waitFor();
  assert.equal(await fallback.page.locator('[data-city-world-tools]').count(), 0, 'Fallback destination navigation retires its external Tools control.');
  await fallback.context.close(); await page.bringToFront();
  const optional = await newPage({ width: 375, height: 812 }, { moduleFailure: true });
  const optionalPose = (await state(optional.page)).position, optionalAt = optional.requests.length;
  const optionalFrames = await optional.page.evaluate(async () => {
    const heights = []; for (let i = 0; i < 10; i++) {
      await new Promise(requestAnimationFrame);
      heights.push({ inspecting: document.querySelector('.omerta-city').classList.contains('is-inspecting'),
        hud: document.querySelector('.omerta-city__world-hud').getBoundingClientRect().height,
        canvas: document.querySelector('.omerta-city__canvas').getBoundingClientRect().height });
    } return heights;
  });
  assert(optionalFrames.every(frame => frame.inspecting === false && frame.hud === optionalFrames[0].hud && frame.canvas === optionalFrames[0].canvas),
    'Optional-module failure cannot toggle inspection styles or trigger a live resize loop: ' + JSON.stringify(optionalFrames));
  await optional.page.locator('[data-destination="training"]').click(); await optional.page.locator('[data-city-open]').click();
  assert.equal((await state(optional.page)).trainingOpen, true); assert.deepEqual((await state(optional.page)).position, optionalPose);
  assert.deepEqual(mutations(optional.requests.slice(optionalAt)), [], 'Optional tool failure preserves Core training and current pose.');
  await optional.context.close(); await page.bringToFront();
  // Re-entering the map hydrates a guarded cached outfit before Phaser creates
  // its sprite, without waiting for a new style panel read.
  await panel(page, 'style'); await page.locator('[data-city-outfit="wine"]').waitFor();
  await page.locator('[data-city-outfit="wine"]').evaluate(button => { window.__retiredWorldChoice = button; });
  await page.evaluate(() => { window.__worldRealm = crypto.randomUUID(); });
  const realm = await page.evaluate(() => window.__worldRealm);
  const poseBeforeRemount = (await state(page)).position, oldHandles = await page.evaluate(() => window.__worldHandles.length);
  await page.locator('#btn-dashboard-view').click(); await page.locator('[data-tab="streets"]').evaluate(button => button.click());
  await page.locator('#btn-player-view').click();
  await page.waitForFunction(count => window.__worldHandles.length > count && window.__worldHandles.at(-1).handle.getState().ready, oldHandles);
  assert.equal((await state(page)).look, 'wine'); assert.equal((await inspectFrame(page)).tint, 0xba8790);
  assert.deepEqual((await state(page)).position, poseBeforeRemount, 'View retirement/remount retains the owned local pose.');
  await panel(page, 'style');
  if (process.env.CITY_WORLD_SHOTS) await page.screenshot({ path: path.join(process.env.CITY_WORLD_SHOTS, 'city-world-host-desktop.png') });
  // A real same-realm successor cannot inherit saved room/receipt DOM or make
  // an old detached action dispatch under its new character identity.
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [viewer.character.id]);
  const successor = await app.inject({ method: 'POST', url: '/v1/character', headers: viewer.headers, payload: { name: 'World Successor' } });
  assert.equal(successor.statusCode, 200, successor.body);
  const mismatchedSocial = page.waitForResponse(async reply => new URL(reply.url()).pathname === '/v1/city/social'
    && reply.status() === 200 && (await reply.json()).viewer.characterId !== viewer.character.id);
  await page.locator('[data-city-world-close]').click(); await panel(page, 'style'); await mismatchedSocial;
  await page.waitForFunction(() => document.querySelector('#whoami').textContent.includes('World Successor'));
  await page.locator('#btn-dashboard-view').click();
  assert.equal(await page.evaluate(() => window.__worldRealm), realm);
  assert(!(await page.locator('#resp').textContent()).includes('Emote shared'));
  assert.equal(await page.locator('.city-world__receipt,.city-world__speech').count(), 0);
  const retiredAt = requests.length;
  await page.evaluate(() => window.__retiredWorldChoice.click()); await frames(page);
  assert.deepEqual(mutations(requests.slice(retiredAt)), [], 'A retired private world action stays inert under the successor.');
  const authActor = await create('Auth Scope'), authPage = await newPage({ width: 375, height: 812 }, { actor: authActor });
  await panel(authPage.page, 'style'); await authPage.page.locator('[data-city-outfit="wine"]').waitFor();
  await post(authPage.page, '[data-city-outfit="wine"]', '/v1/city/social/preferences');
  await authPage.page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().look === 'wine');
  await authPage.page.locator('[data-city-world-close]').click();
  let releaseMismatch, observedMismatch;
  const mismatchGate = new Promise(resolve => { releaseMismatch = resolve; }), mismatchObserved = new Promise(resolve => { observedMismatch = resolve; });
  await app.pool.query('UPDATE characters SET generation=generation+1 WHERE id=$1', [authActor.character.id]);
  const heldMismatch = authPage.page.waitForResponse(async reply => new URL(reply.url()).pathname === '/v1/city/social'
    && reply.status() === 200 && (await reply.json()).viewer.generation === authActor.character.generation + 1);
  let heldOnce = false;
  await authPage.page.route('**/v1/city/social', async route => {
    if (heldOnce) return route.continue(); heldOnce = true;
    const reply = await route.fetch(); assert.equal(reply.status(), 200); assert.equal((await reply.json()).viewer.generation, authActor.character.generation + 1);
    observedMismatch(); await mismatchGate; await route.fulfill({ response: reply });
  });
  await panel(authPage.page, 'style'); await bounded(mismatchObserved, 'the held real newer-generation social snapshot');
  await app.pool.query('UPDATE characters SET generation=$2 WHERE id=$1', [authActor.character.id, authActor.character.generation]);
  const readCount = await authPage.page.evaluate(() => window.__worldReads.length);
  const freshOldOwner = authPage.page.waitForResponse(async reply => new URL(reply.url()).pathname === '/v1/city/social'
    && reply.status() === 200 && (await reply.json()).viewer.generation === authActor.character.generation);
  await panel(authPage.page, 'room');
  await authPage.page.waitForFunction(count => window.__worldReads.length > count, readCount);
  releaseMismatch(); await heldMismatch; await freshOldOwner; await authPage.page.unroute('**/v1/city/social'); await frames(authPage.page);
  assert.equal((await state(authPage.page)).look, 'wine');
  assert.match(await authPage.page.locator('.city-world__receipt').textContent(), /Wine|outfit|look/i,
    'A superseded mismatched snapshot cannot purge the current owner\'s receipt/model.');
  await panel(authPage.page, 'style');
  await authPage.page.locator('[data-city-outfit="wine"]').evaluate(button => { window.__retiredAuthChoice = button; });
  await authPage.page.locator('[data-city-world-close]').click();
  let releaseBanned, observedBanned;
  const bannedGate = new Promise(resolve => { releaseBanned = resolve; }), bannedObserved = new Promise(resolve => { observedBanned = resolve; });
  await app.pool.query("UPDATE accounts SET status='banned' WHERE id=$1", [authActor.character.account_id]);
  const bannedResponse = authPage.page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/city/social' && reply.status() === 403);
  await authPage.page.route('**/v1/city/social', async route => {
    const reply = await route.fetch(); assert.equal(reply.status(), 403); observedBanned(); await bannedGate; await route.fulfill({ response: reply });
  });
  await panel(authPage.page, 'style'); await bounded(bannedObserved, 'the old actual banned response');
  await app.pool.query("UPDATE accounts SET status='active' WHERE id=$1", [authActor.character.account_id]);
  const authHandleCount = await authPage.page.evaluate(() => window.__worldHandles.length);
  await authPage.page.locator('#btn-dashboard-view').click(); await authPage.page.locator('[data-tab="streets"]').evaluate(button => button.click());
  await authPage.page.locator('#btn-player-view').click(); releaseBanned(); await bannedResponse;
  await authPage.page.unroute('**/v1/city/social');
  await authPage.page.waitForFunction(count => window.__worldHandles.length > count && window.__worldHandles.at(-1).handle.getState().ready, authHandleCount);
  assert(await authPage.page.locator('#screen-main:not(.hidden)').isVisible(), 'A retired scene denial cannot sign out the current restored session.');
  await panel(authPage.page, 'style'); await authPage.page.locator('[data-city-outfit="wine"]').waitFor();
  await authPage.page.locator('[data-city-world-close]').click();
  await app.pool.query('UPDATE accounts SET token_version=token_version+1 WHERE id=$1', [authActor.character.account_id]);
  const revokedResponse = authPage.page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/city/social' && reply.status() === 401);
  await panel(authPage.page, 'style'); await revokedResponse;
  await authPage.page.locator('#screen-auth:not(.hidden)').waitFor();
  assert.equal(await authPage.page.locator('[data-city-world-tools],.city-world__receipt,.city-world__speech').count(), 0);
  const afterAuth = authPage.requests.length;
  await authPage.page.evaluate(() => window.__retiredAuthChoice.click()); await frames(authPage.page);
  assert.deepEqual(mutations(authPage.requests.slice(afterAuth)), [], 'Known revocation retires private controls before another auth refresh.');
  await authPage.context.close();
  assert.deepEqual(errors, []);
  for (const context of contexts) await context.close();
  console.log('city-world-host-browser: actual tools/header, shared objective, equipment/outfit/room, waypoint walking, base-stat feedback, consented two-message chat, decorative routines, reduced motion and responsive camera pass');
} finally { await browser?.close(); await app.close(); }
