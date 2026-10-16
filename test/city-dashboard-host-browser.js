// Dashboard operations retain the real neighborhood while using canonical controls and routes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';

assert(!process.env.DATABASE_URL, 'Dashboard host checks require disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off'; process.env.TRAIN_CD_MS = '0';
const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
  .find(file => file && fs.existsSync(file));
assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium executable.');
const shots = process.env.CITY_DASHBOARD_SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const app = await buildServer(); let browser;
try {
  const create = async name => {
    const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });
    assert.equal(guest.statusCode, 200);
    const token = guest.json().token, headers = { authorization: 'Bearer ' + token };
    const made = await app.inject({ method: 'POST', url: '/v1/character', headers, payload: { name } });
    assert.equal(made.statusCode, 200, made.body);
    const character = (await app.pool.query('SELECT id,account_id,generation,loc FROM characters WHERE account_id=$1 AND alive', [app.jwt.verify(token).sub])).rows[0];
    await app.pool.query("UPDATE characters SET loc='docks',energy=100,nerve=30,cash=10000,last_accrued_at=$2 WHERE id=$1",
      [character.id, new Date(Date.now() + 3600000)]);
    return { token, headers, character };
  };
  const viewer = await create('Dashboard Player'), agent = await create('Dashboard Agent');
  await app.pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [agent.character.account_id]);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ executablePath, headless: true });
  const errors = [], layouts = [];
  const pageFor = async viewport => {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block',
      isMobile: viewport.width <= 680, hasTouch: viewport.width <= 680 });
    await context.addInitScript(token => {
      localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1');
      window.__dashboardHandles = [];
      let scene;
      Object.defineProperty(window, 'OmertaCityScene', { configurable: true, get: () => scene, set: value => {
        scene = { ...value, mount(...args) {
          const handle = value.mount(...args), record = { handle, destroyed: false };
          window.__dashboardHandles.push(record);
          return { ...handle, destroy() { record.destroyed = true; handle.destroy(); } };
        } };
      } });
    }, viewer.token);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route(base + '/', async route => {
      const reply = await route.fetch(), html = await reply.text(), anchor = '  function cityGameVisible() {';
      assert.equal(html.split(anchor).length, 2);
      await route.fulfill({ response: reply, body: html.replace(anchor,
        '  window.__dashboardState = () => ({ tab: currentTab, panel: _cityPanel && { ..._cityPanel }, scene: _cityScene?.getState(), alive: !!me?.alive });\n' + anchor) });
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForSelector('#screen-main:not(.hidden)');
    if (await page.locator('.modal-bg[data-managed-dialog]').count()) await page.keyboard.press('Escape');
    await page.locator('#btn-player-view').click();
    await page.waitForFunction(() => window.__dashboardState().scene?.ready);
    return { page, context };
  };
  const state = page => page.evaluate(() => window.__dashboardState());
  const jump = async (page, id) => {
    await page.locator('#city-all-actions').click();
    await page.locator('#jump-q').fill(id);
    await page.locator('#jump-list [data-jump="' + id + '"]').click();
    await page.waitForFunction(id => window.__dashboardState().tab === id, id);
    if (id !== 'map') await page.locator('#city-panel-body > #tab-' + id).waitFor({ state: 'visible' });
  };
  const training = async page => {
    await jump(page, 'streets');
    const section = page.locator('[data-sect="streets-train"]');
    await section.waitFor();
    if (await section.getAttribute('open') === null) await section.locator('summary').click();
    const button = page.locator('#city-panel-body [data-do="POST /v1/train/muscle"]');
    await button.scrollIntoViewIfNeeded(); return button;
  };
  const frameLayout = async (page, width) => {
    const layout = await page.evaluate(() => {
      const bounds = selector => { const box = document.querySelector(selector)?.getBoundingClientRect();
        return box && { top: box.top, bottom: box.bottom, left: box.left, right: box.right, height: box.height }; };
      return { viewport: innerWidth, document: document.documentElement.scrollWidth, height: innerHeight,
        canvas: bounds('.omerta-city__canvas canvas'), panel: bounds('#city-panel'),
        header: bounds('#top'), action: bounds('[data-do="POST /v1/train/muscle"]') };
    });
    layouts.push({ width, ...layout });
    if (shots) await page.screenshot({ path: path.join(shots, 'dashboard-training-' + width + (layout.height === 568 ? '-short' : '') + '.png') });
    assert(layout.document <= layout.viewport + 1, 'The canonical operation fits without horizontal overflow: ' + JSON.stringify(layout));
    assert(layout.canvas.height >= 96 && layout.canvas.top >= layout.header.bottom - 1 && layout.canvas.bottom <= layout.height + 1
      && layout.action.top >= layout.header.bottom - 1 && layout.action.bottom <= layout.height + 1,
    'The real scene and canonical action stay visible together: ' + JSON.stringify(layout));
    return layout;
  };
  const confirmPhoneTraining = async page => {
    const button = await training(page);
    const reply = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/train/muscle' && response.request().method() === 'POST');
    await button.click(); const response = await reply;
    assert.equal(response.status(), 200, 'The phone operation control is clickable and completes a canonical action.');
    const expectedId = 'owner:' + response.request().headers()['idempotency-key'];
    await page.waitForFunction(id => window.__dashboardState().scene.activities.some(activity => activity.self && activity.id === id && activity.kind === 'train' && activity.rendered), expectedId);
    const visible = await page.evaluate(() => {
      const scene = window.__dashboardState().scene, cue = scene.activities.find(activity => activity.self), camera = scene.camera;
      const line = document.querySelector('[data-city-activity-id="' + cue.id + '"]').getBoundingClientRect();
      const hud = document.querySelector('.omerta-city__world-hud').getBoundingClientRect();
      return { line: line.top >= hud.top - 1 && line.bottom <= hud.bottom + 1,
        badge: cue.badge.x - cue.badge.width / 2 >= camera.x - 1 && cue.badge.x + cue.badge.width / 2 <= camera.x + camera.width / camera.zoom + 1
          && cue.badge.y - cue.badge.height / 2 >= camera.y - 1 && cue.badge.y + cue.badge.height / 2 <= camera.y + camera.height / camera.zoom + 1 };
    });
    assert.deepEqual(visible, { line: true, badge: true }, 'The confirmed action label and avatar badge remain visible in the compact phone view.');
  };
  const { page, context } = await pageFor({ width: 1440, height: 1000 });
  await page.locator('#city-all-actions').click();
  const destinations = await page.locator('#jump-list [data-jump]').evaluateAll(nodes => nodes.map(node => node.dataset.jump));
  assert.equal(destinations.length, 33, 'Every dashboard destination is discoverable through the in-game chooser.');
  await page.locator('#jump-close').click();
  const handles = await page.evaluate(() => window.__dashboardHandles.length);
  for (const id of destinations) {
    await jump(page, id);
    assert.equal(await page.locator('#btn-player-view').getAttribute('aria-pressed'), 'true', id + ' stays in player view.');
    assert(await page.locator('#tab-map.on .omerta-city__canvas canvas').isVisible(), id + ' retains the real neighborhood.');
    assert.equal(await page.evaluate(() => window.__dashboardHandles.length), handles, id + ' reuses the same scene.');
    assert.equal((await state(page)).scene.externalPanel, id !== 'map', id + ' gates scene input while its operation is open.');
  }
  for (const utility of ['character', 'communications', 'account']) {
    await page.locator('[data-city-utility="' + utility + '"]').click();
    assert.equal((await state(page)).panel.utility, utility);
    assert.equal((await state(page)).scene.externalPanel, true);
    const selector = { character: '#leftcol', communications: '#wirepanel', account: '.city-account-controls' }[utility];
    assert(await page.locator('#city-panel-body ' + selector).isVisible());
    if (utility === 'communications') {
      await page.locator('#wtab-city').click();
      const sent = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/chat' && response.request().method() === 'POST');
      await page.locator('#chatinput').fill('Local fixture message from the in-game panel.');
      await page.locator('#chatform [type="submit"]').click();
      assert.equal((await sent).status(), 200, 'The in-game Chat control sends through its canonical route.');
    }
    if (utility === 'account') {
      assert(await page.locator('#city-panel-body #btn-logout').isVisible());
      await page.locator('#city-panel-body #btn-help').click();
      await page.locator('#glossary:not(.hidden)').waitFor(); await page.keyboard.press('Escape');
    }
    await page.locator('#city-panel-close').click();
    assert.equal((await state(page)).scene.externalPanel, false);
    assert.equal((await state(page)).panel, null);
  }
  assert.equal(await page.locator('#wirepanel').evaluate(node => node.parentElement.id), 'layout', 'Closing chat restores its existing panel.');

  let train = await training(page);
  await frameLayout(page, 1440);
  const phone = await pageFor({ width: 320, height: 812 });
  await confirmPhoneTraining(phone.page); await frameLayout(phone.page, 320);
  await phone.page.setViewportSize({ width: 320, height: 568 });
  await confirmPhoneTraining(phone.page); await frameLayout(phone.page, 320);
  assert.equal((await state(phone.page)).scene.externalPanel, true);
  await phone.page.locator('#city-panel-close').click();
  assert.equal((await state(phone.page)).scene.externalPanel, false);
  assert.equal(await phone.page.evaluate(() => window.__dashboardHandles.length), 1);
  await phone.context.close(); await page.bringToFront();
  await page.waitForFunction(() => window.__dashboardState().scene.activities.length === 0, null, { timeout: 9000 });
  await app.pool.query('UPDATE characters SET energy=0 WHERE id=$1', [viewer.character.id]);
  const refused = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/train/muscle' && response.request().method() === 'POST');
  await train.click(); assert((await refused).status() >= 400, 'The server rejects a now-unaffordable stale training choice.');
  await page.waitForFunction(() => document.querySelector('#city-panel')?.getAttribute('aria-busy') === 'false');
  assert.equal((await state(page)).scene.activities.length, 0, 'An unsuccessful mutation creates no action cue.');
  await app.pool.query('UPDATE characters SET energy=100,train_at=NULL WHERE id=$1', [viewer.character.id]);
  const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/projections/player');
  await page.locator('#btn-refresh').click(); await refreshed;
  train = await training(page); await train.waitFor({ state: 'visible' });
  const completed = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/train/muscle' && response.request().method() === 'POST');
  const oldStats = Number((await app.pool.query('SELECT muscle FROM characters WHERE id=$1', [viewer.character.id])).rows[0].muscle);
  await train.click(); const completion = await completed;
  assert.equal(completion.status(), 200);
  const idempotency = completion.request().headers()['idempotency-key']; assert(idempotency);
  await page.waitForFunction(id => window.__dashboardState().scene.activities.some(activity => activity.self && activity.id === id && activity.kind === 'train'), 'owner:' + idempotency);
  const firstCue = (await state(page)).scene.activities.find(activity => activity.self);
  assert(Number((await app.pool.query('SELECT muscle FROM characters WHERE id=$1', [viewer.character.id])).rows[0].muscle) > oldStats);
  assert.equal((await state(page)).scene.externalPanel, true, 'The canonical mutation runs while the retained scene is input-locked.');
  await page.route('**/v1/train/muscle', route => route.continue({ headers: { ...route.request().headers(), 'idempotency-key': idempotency } }), { times: 1 });
  train = await training(page);
  const replayed = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/train/muscle' && response.request().method() === 'POST');
  await train.click(); const replay = await replayed;
  assert.equal(replay.headers()['x-idempotent-replay'], 'true');
  await page.waitForFunction(() => document.querySelector('#city-panel')?.getAttribute('aria-busy') === 'false');
  const replayCue = (await state(page)).scene.activities.find(activity => activity.self);
  assert(!replayCue || replayCue.id === firstCue.id && replayCue.startedAt === firstCue.startedAt,
    'HTTP replay never starts a second action cue: ' + JSON.stringify({ firstCue, replayCue }));

  const ownerApiKey = crypto.randomUUID();
  const ownerApiAction = await app.inject({ method: 'POST', url: '/v1/train/muscle',
    headers: { ...viewer.headers, 'idempotency-key': ownerApiKey }, payload: {} });
  assert.equal(ownerApiAction.statusCode, 200, ownerApiAction.body);
  await page.waitForFunction(id => window.__dashboardState().scene.activities.some(activity => activity.self && activity.id === id && activity.kind === 'train'),
    'owner:' + ownerApiKey, { timeout: 20000 });
  assert.equal((await state(page)).scene.externalPanel, true, 'The owner sees an external API action through real presence polling while its operation panel stays open.');

  const rules = (await app.inject({ url: '/v1/rules' })).json();
  const crime = rules.crimes.filter(crime => crime.lvl === 1).sort((a, b) => a.nerve - b.nerve)[0];
  assert(crime, 'A starter public job is available for the API agent fixture.');
  const agentCrime = () => app.inject({ method: 'POST', url: '/v1/crimes/' + crime.id,
    headers: { ...agent.headers, 'idempotency-key': crypto.randomUUID() }, payload: {} });
  const hiddenAction = await agentCrime(); assert.equal(hiddenAction.statusCode, 200, hiddenAction.body);
  const unknownPresence = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/city/presence' && response.status() === 200, { timeout: 20000 });
  const unknown = (await (await unknownPresence).json()).actors.find(actor => actor.id === agent.character.id);
  assert(unknown); assert.equal(unknown.name, null); assert.equal(unknown.activity, undefined,
    'An unmet agent action never supplies a cue that could correlate its marker with named public news.');
  assert(!(await state(page)).scene.activities.some(activity => activity.actorId === agent.character.id));
  await app.pool.query('UPDATE characters SET nerve=30,jail_until=NULL,hosp_until=NULL WHERE id=$1', [agent.character.id]);
  const encounter = unknown.actions.find(action => action.id === 'encounter:' + agent.character.id);
  assert(encounter);
  const met = await app.inject({ method: encounter.method, url: encounter.path,
    headers: { ...viewer.headers, 'idempotency-key': crypto.randomUUID() }, payload: encounter.body });
  assert.equal(met.statusCode, 200, met.body);
  const publicAction = await agentCrime();
  assert.equal(publicAction.statusCode, 200, publicAction.body);
  await page.waitForFunction(actorId => window.__dashboardState().scene.activities.some(activity => activity.actorId === actorId && !activity.self), agent.character.id, { timeout: 20000 });
  assert.match(await page.locator('[data-city-activity]').textContent(), /Dashboard Agent/,
    'A public action animates the known agent after the canonical encounter earns its identity.');
  assert.equal(await page.evaluate(() => window.__dashboardHandles.length), handles);

  // A direct chat control can finish after an external API has moved the owner.
  // Hold the authoritative presence reply to inspect the still-stale scene first.
  await page.waitForFunction(() => window.__dashboardState().scene.activities.length === 0, null, { timeout: 9000 });
  await page.locator('[data-city-utility="communications"]').click();
  await page.locator('#wtab-city').click();
  let releasePresence, observePresence, travelResponse, presenceTimer;
  const presenceGate = new Promise(resolve => { releasePresence = resolve; });
  const heldPresence = new Promise(resolve => { observePresence = resolve; });
  const holdNewDistrict = async route => {
    const reply = await route.fetch(), board = await reply.json();
    if (board.viewer?.district === 'neon') { observePresence(board); await presenceGate; }
    await route.fulfill({ response: reply });
  };
  const travelBeforeChat = async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    travelResponse = await app.inject({ method: 'POST', url: '/v1/travel/neon',
      headers: { ...viewer.headers, 'idempotency-key': crypto.randomUUID() }, payload: {} });
    await route.continue();
  };
  await page.route('**/v1/city/presence*', holdNewDistrict);
  await page.route('**/v1/chat', travelBeforeChat);
  try {
    const sent = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/chat' && response.request().method() === 'POST');
    await page.locator('#chatinput').fill('Local fixture message after an external ride.');
    await page.locator('#chatform [type="submit"]').click();
    assert.equal((await sent).status(), 200); assert.equal(travelResponse.statusCode, 200, travelResponse.body);
    const board = await Promise.race([heldPresence, new Promise((_, reject) => { presenceTimer = setTimeout(() => reject(new Error('No authoritative presence refresh after direct chat.')), 20000); })]);
    clearTimeout(presenceTimer);
    assert.equal(board.viewer.district, 'neon');
    const stale = await state(page);
    assert.equal(stale.scene.region.id, 'docks'); assert.equal(stale.panel.utility, 'communications');
    assert.equal(stale.scene.activities.length, 0, 'A successful direct chat never animates the cached old district while authority is pending.');
    releasePresence();
    await page.waitForFunction(() => window.__dashboardState().scene?.ready && window.__dashboardState().scene.region.id === 'neon'
      && window.__dashboardState().panel === null, null, { timeout: 20000 });
    assert.equal((await state(page)).scene.externalPanel, false, 'The authoritative refresh retires the stale operation panel in the new district.');
  } finally {
    clearTimeout(presenceTimer); releasePresence();
    await page.unroute('**/v1/city/presence*', holdNewDistrict); await page.unroute('**/v1/chat', travelBeforeChat);
  }
  await context.close();

  assert.deepEqual(errors, []);
  console.log('City dashboard host: all 33 destinations, canonical training, failure/replay, owner API activity, known-agent public activity, unmet privacy, stale-district chat recovery, utilities and responsive panel reachability passed.');
  console.log('Action panel layouts:', JSON.stringify(layouts));
} finally {
  if (browser) await browser.close();
  await app.close();
}
