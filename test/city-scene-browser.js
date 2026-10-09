// Targeted City mode browser regression. Uses the real server and disposable pg-mem.
// Run: node test/city-scene-browser.js (or set CHROMIUM_PATH to a Chromium executable).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';

// Cached options must never update or destroy a different current identity while its read is pending.
const clientSource = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const mountSource = clientSource.slice(clientSource.indexOf('  async function mountCityNeighborhood()'), clientSource.indexOf('  function syncMapMode()'));
for (const current of [{ id: 'current', generation: 2, loc: 'docks' }, { id: 'replacement', generation: 1, loc: 'docks' }]) {
  const cached = { character: { id: 'current', generation: 1 }, district: { id: 'docks' } };
  let reused = 0;
  const scope = { $: () => ({}), currentTab: 'map', _mapMode: 'walk', _citySceneOptions: cached,
    _citySceneKey: 'current:1:docks', _cityScene: { update: () => reused++ },
    cityIdentity: () => `${current.id}:${current.generation}:${current.loc}`,
    destroyCityScene: () => assert.fail('Stale cached options cannot destroy the current scene before authoritative read completion.') };
  vm.runInNewContext(mountSource + '\nthis.mount = mountCityNeighborhood;', scope);
  await scope.mount();
  assert.equal(reused, 0, 'Stale generation/character options cannot reuse a current scene.');
}

const CITY_ART = [
  { file: '/art/city-neighborhood-v1.png', width: 960, height: 640, alpha: false },
  ...['player-down', 'player-up', 'player-left', 'player-right', 'player-step', 'fixer', 'worker', 'neighbor']
    .map(name => ({ file: '/art/city-' + name + '-v1.png', width: 38, height: 60, alpha: true })),
];

function resolveBrowser() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const caches = [...new Set([
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
    process.env.HOME && path.join(process.env.HOME, '.cache', 'ms-playwright'),
  ].filter(Boolean))];
  for (const cache of caches) {
    let versions;
    try { versions = fs.readdirSync(cache).filter(entry => entry.startsWith('chromium')).sort().reverse(); }
    catch { continue; }
    for (const version of versions) for (const relative of [
      'chrome-win64/chrome.exe', 'chrome-win/chrome.exe',
      'chrome-headless-shell-win64/headless_shell.exe',
      'chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-linux/headless_shell',
      'chrome-headless-shell-linux64/headless_shell',
      'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    ]) {
      const candidate = path.join(cache, version, relative);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ].find(candidate => fs.existsSync(candidate));
}

async function inspectPngs(page, files) {
  return page.evaluate(async paths => {
    const results = [];
    for (const file of paths) {
      const response = await fetch(file);
      const blob = await response.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
      if (!response.ok || !png) {
        results.push({ file, status: response.status, png, type: blob.type });
        continue;
      }
      const bitmap = await createImageBitmap(blob);
      const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = surface.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      let transparent = 0, visible = 0;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] === 0) transparent++;
        else visible++;
      }
      results.push({ file, status: response.status, png, type: blob.type, width: bitmap.width, height: bitmap.height, transparent, visible });
      bitmap.close();
    }
    return results;
  }, files);
}

// Browser input waits. Keep these independent of the server fixture for focused frame-delay checks.
async function waitForInput(page, predicate, argument) {
  try { await page.waitForFunction(predicate, argument, { timeout: 5000 }); }
  catch (error) {
    console.error('City input diagnostic:', JSON.stringify(await page.evaluate(() => {
      const state = window.__cityHandles.at(-1)?.handle.getState();
      return { hidden: document.hidden, focused: document.hasFocus(), active: document.activeElement?.id || document.activeElement?.tagName,
        ready: state?.ready, player: state?.player, facing: state?.facing, pathLength: state?.pathLength,
        held: Array.from(document.querySelectorAll('[data-city-move].is-held')).map(button => button.dataset.cityMove) };
    })));
    throw error;
  }
}
async function holdKey(page, key, predicate, argument) {
  await page.bringToFront();
  await page.locator('.omerta-city__canvas canvas').focus();
  try {
    await page.keyboard.down(key);
    await waitForInput(page, predicate, argument);
  } finally { await page.keyboard.up(key); }
}
async function waitForFrames(page, frames) {
  await page.evaluate(frames => {
    window.__cityObservedFrames = 0;
    const observe = () => { if (++window.__cityObservedFrames < frames) requestAnimationFrame(observe); };
    requestAnimationFrame(observe);
  }, frames);
  await waitForInput(page, frames => window.__cityObservedFrames >= frames, frames);
}
// End browser input waits.

assert(!process.env.DATABASE_URL, 'City mode browser checks require disposable pg-mem; clear DATABASE_URL.');
const executablePath = resolveBrowser();
assert(executablePath && fs.existsSync(executablePath), 'Set CHROMIUM_PATH to an installed Chromium/Chrome executable.');
process.env.INVITE_MODE = 'off';
process.env.RATE_LIMIT = 'off';

const app = await buildServer();
let browser;
try {
  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });
  assert.equal(guest.statusCode, 200, guest.body);
  const token = guest.json().token;
  const headers = { authorization: 'Bearer ' + token };
  const created = await app.inject({ method: 'POST', url: '/v1/character', headers, payload: { name: 'City Browser' } });
  assert.equal(created.statusCode, 200, created.body);
  const characterId = (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [app.jwt.verify(token).sub])).rows[0].id;
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ executablePath, headless: true, timeout: 20000 });
  const pageErrors = [];
  const contexts = [];
  const shots = process.env.CITY_SCENE_SHOTS;
  const sceneShotStyle = '#top,#vitals,#bnav{visibility:hidden!important;}';
  if (shots) fs.mkdirSync(shots, { recursive: true });

  const newPage = async (options = {}, playerToken = token) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US', serviceWorkers: 'block', ...options });
    contexts.push(context);
    await context.addInitScript(playerToken => {
      localStorage.setItem('omerta_token', playerToken);
      localStorage.setItem('omerta_tour2', '1');
      // Capture handles only in the test realm; production needs no global debug hooks.
      window.__cityHandles = [];
      let api;
      Object.defineProperty(window, 'OmertaCityScene', {
        configurable: true,
        get: () => api,
        set: value => {
          api = { ...value, mount(...args) {
            const handle = value.mount(...args);
            const entry = { handle, options: args[1], destroyed: false };
            window.__cityHandles.push(entry);
            return { ...handle, destroy() { entry.destroyed = true; return handle.destroy(); } };
          } };
        },
      });
    }, playerToken);
    const page = await context.newPage();
    await page.bringToFront();
    page.on('pageerror', error => pageErrors.push(error.message));
    return page;
  };

  const state = page => page.evaluate(() => window.__cityHandles.at(-1)?.handle.getState());
  const selectTab = async (page, tab) => {
    await page.bringToFront();
    await page.locator(`[data-tab="${tab}"]`).evaluate(button => button.click());
    await page.waitForSelector(`#tab-${tab}.on`, { state: 'attached' });
  };
  const waitForCity = async page => {
    await page.waitForFunction(() => window.__cityHandles.at(-1)?.handle.getState().ready);
    await page.locator('.omerta-city__canvas canvas').waitFor();
  };
  const openCity = async page => {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForSelector('#screen-main:not(.hidden)');
    await selectTab(page, 'map');
    await waitForCity(page);
  };
  const assertPosition = async (page, expected, message) => {
    const actual = (await state(page)).position;
    assert(Math.hypot(actual.x - expected.x, actual.y - expected.y) < 1, message + ': position');
    assert.equal(actual.facing, expected.facing, message + ': facing');
  };
  const assertHud = async (page, expected) => {
    const fields = ['cash', 'health', 'energy', 'nerve', 'heat', 'level'];
    const values = Object.fromEntries(fields.map(key => [key, Number(expected[key])]));
    await page.waitForFunction(values => {
      const resources = window.__cityHandles.at(-1)?.handle.getState().resources;
      return resources && Object.entries(values).every(([key, value]) => resources[key] === value);
    }, values);
    for (const key of fields) {
      const text = await page.locator(`[data-city-resource="${key}"] [data-city-value]`).textContent();
      assert.equal(Number(text.split('/')[0].replace(/[^\d.-]/g, '')), values[key], 'Visible City HUD mirrors ' + key);
    }
    const current = await state(page);
    assert(current.resources.progress && Number.isFinite(current.resources.progress.next), 'The HUD has server-rule level progress.');
    assert.equal(await page.locator('[data-city-progress]').count(), 1);
  };
  const returnToCity = async page => {
    await page.locator('#city-session-bar').waitFor({ state: 'visible' });
    await page.locator('#city-return').click();
    await waitForCity(page);
  };
  const refreshHudFromClient = async page => {
    const reply = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/projections/player');
    await page.locator('#btn-refresh').click();
    const me = await (await reply).json();
    await assertHud(page, me.player?.character || me.player);
  };
  const questAction = async (page, button) => {
    const reply = page.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname.startsWith('/v1/worldgraph/mysteries/neighborhood-initiation'));
    await button.click();
    const confirmation = page.locator('[data-managed-dialog] [data-yes]').last();
    if (await confirmation.isVisible()) await confirmation.click();
    const response = await reply;
    assert.equal(response.status(), 200, 'NPC quest action reaches the real authoritative mystery transaction.');
    assert(response.request().headers()['idempotency-key'], 'NPC interactions retain mutation retry authority.');
    return response.json();
  };
  const dismissCelebration = async page => {
    const overlay = page.locator('#cine.on');
    if (await overlay.count()) await overlay.evaluate(element => element.click());
  };
  const assertVenueOnscreen = async (page, checkClose = true) => {
    const layout = await page.evaluate(checkClose => {
      const card = document.querySelector('.omerta-city__interaction');
      const controls = [document.activeElement, ...(checkClose ? [card.querySelector('[data-city-close]')] : [])];
      return { card: card.getBoundingClientRect().toJSON(), height: innerHeight,
        focusedOpen: document.activeElement.matches('[data-city-open]'),
        controls: controls.map(control => {
          const bounds = control.getBoundingClientRect();
          const hits = [bounds.top + 3, bounds.bottom - 3].map(y => {
            const hit = document.elementFromPoint(bounds.left + bounds.width / 2, y);
            return { visible: hit === control || control.contains(hit), element: hit?.tagName, id: hit?.id, className: hit?.className };
          });
          return { top: bounds.top, bottom: bounds.bottom, hits };
        }) };
    }, checkClose);
    assert(layout.focusedOpen, 'Opening a venue preserves its primary keyboard focus.');
    assert(layout.card.top >= 0 && layout.card.bottom <= layout.height + 1,
      'Venue details fit the window: ' + JSON.stringify(layout));
    for (const control of layout.controls) assert(control.top >= 0 && control.bottom <= layout.height + 1 && control.hits.every(hit => hit.visible),
      'Venue controls are visible and unobscured by sticky chrome: ' + JSON.stringify(layout));
  };
  const visitQuest = async (page, venueId, requests) => {
    const guide = page.locator('.omerta-city__next-move');
    const venue = (await state(page)).destinations.find(venue => venue.id === venueId);
    assert(venue, 'Quest destination is an existing public venue.');
    const destinationName = await page.locator(`[data-destination="${venueId}"] .omerta-city__destination-name`).textContent();
    await page.getByRole('button', { name: 'Visit ' + destinationName, exact: true }).waitFor();
    assert.equal(await guide.getAttribute('data-city-guidance'), 'quest');
    assert.equal(await guide.locator('[role="status"]').getAttribute('aria-live'), 'polite');
    assert.equal(await guide.locator('[role="status"]').getAttribute('aria-atomic'), 'true');
    await guide.scrollIntoViewIfNeeded();
    const layout = await page.evaluate(() => {
      const guide = document.querySelector('.omerta-city__next-move').getBoundingClientRect();
      const map = document.querySelector('.omerta-city__viewport').getBoundingClientRect();
      const button = document.querySelector('[data-city-nextmove]').getBoundingClientRect();
      return { top: guide.top, bottom: guide.bottom, mapTop: map.top, buttonWidth: button.width,
        buttonHeight: button.height, width: document.documentElement.scrollWidth, viewport: innerWidth, height: innerHeight };
    });
    assert(layout.top >= -1 && layout.bottom <= layout.height + 1 && layout.bottom <= layout.mapTop + 1,
      'The current quest objective is visible above the map: ' + JSON.stringify(layout));
    assert(layout.width <= layout.viewport + 1 && layout.buttonWidth >= 44 && layout.buttonHeight >= 44,
      'The objective and destination control fit a phone with a usable touch target.');
    const beforeVisit = requests.length;
    await page.locator('[data-city-nextmove]').click();
    await page.locator('.omerta-city__interaction').waitFor({ state: 'visible' });
    await assertVenueOnscreen(page);
    assert.equal((await state(page)).selectedVenue, venueId, 'The guide opens the currently issued destination.');
    assert.deepEqual(requests.slice(beforeVisit).filter(request => !['GET', 'HEAD'].includes(request.method)), [],
      'A quest destination visit does not select a branch or submit a mutation.');
  };
  const assertEntered = async page => {
    await page.waitForFunction(() => document.activeElement === document.querySelector('.omerta-city__canvas canvas'));
    const layout = await page.evaluate(() => {
      const canvas = document.querySelector('.omerta-city__canvas canvas'), rect = canvas.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: innerHeight,
        hits: [rect.top + 3, rect.top + rect.height / 2, rect.bottom - 3].map(y => document.elementFromPoint(rect.left + rect.width / 2, y) === canvas),
        chrome: ['top', 'vitals', 'bnav', 'toast'].map(id => {
          const node = document.getElementById(id), rect = node?.getBoundingClientRect();
          return { id, position: node && getComputedStyle(node).position, top: rect?.top, bottom: rect?.bottom };
        }) };
    });
    assert(layout.top >= 0 && layout.bottom <= layout.height + 1 && layout.hits.every(Boolean),
      'Explicit entry reveals the ready canvas above fixed chrome: ' + JSON.stringify(layout));
  };
  const assertWorldHud = async page => {
    const layout = await page.evaluate(() => {
      const hud = document.querySelector('.omerta-city__world-hud'), canvas = document.querySelector('.omerta-city__canvas canvas');
      const scene = window.__cityHandles.at(-1).handle.getState(), rect = canvas.getBoundingClientRect(), hudRect = hud.getBoundingClientRect();
      const player = { x: rect.left + (scene.player.x - scene.camera.x) * scene.camera.zoom * rect.width / scene.camera.width,
        y: rect.top + (scene.player.y - scene.camera.y) * scene.camera.zoom * rect.height / scene.camera.height };
      const controls = [...hud.querySelectorAll('[data-city-resource]'), hud.querySelector('.omerta-city__readiness')];
      return { hud: hudRect.toJSON(), canvas: rect.toJSON(), camera: scene.camera, player,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        visible: controls.every(control => { const b = control.getBoundingClientRect();
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return control === hit || control.contains(hit); }),
        playerVisible: document.elementFromPoint(player.x, player.y) === canvas,
        fields: controls.slice(0, -1).map(control => control.dataset.cityResource),
        readinessCount: document.querySelectorAll('.omerta-city__readiness[role="status"]').length };
    });
    assert(!layout.overflow && layout.visible && layout.playerVisible, 'Walking HUD and player are visible without covering the canvas: ' + JSON.stringify(layout));
    assert(layout.hud.bottom <= layout.canvas.top + 1, 'The HUD reserves its own space outside the playable camera.');
    assert(Math.abs(layout.camera.width - layout.canvas.width) <= 1 && Math.abs(layout.camera.height - layout.canvas.height) <= 1,
      'Phaser dimensions match the CSS viewport after compact resizing.');
    assert.deepEqual(layout.fields, ['cash', 'health', 'energy', 'nerve']);
    assert.equal(layout.readinessCount, 1, 'Readiness is a single live region.');
    assert.equal(await page.locator('.omerta-city__readiness').getAttribute('aria-atomic'), 'true');
    for (const field of ['cash', 'health', 'energy', 'nerve', 'heat', 'level']) assert.equal(await page.locator(`[data-city-resource="${field}"]`).count(), 1, field + ' has one projection-backed value.');
  };
  const gameplayRequests = requests => requests.filter(request => !['GET', 'HEAD'].includes(request.method)
    && !['/v1/screens', '/v1/commands/observations'].includes(request.path));

  // A first phone visit retains its help, then explicitly enters the existing local scene.
  const entry = await newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  // The scene's live layout must remain correct without optional resize observation.
  await entry.context().addInitScript(() => { window.ResizeObserver = undefined; });
  const entryRequests = [];
  entry.on('request', request => entryRequests.push({ method: request.method(), path: new URL(request.url()).pathname }));
  await openCity(entry);
  assert(await entry.locator('#intro-walk').isVisible(), 'First Map help offers a separate entry control.');
  const entryPose = (await state(entry)).position, entryHandles = await entry.evaluate(() => window.__cityHandles.length);
  const entryStart = entryRequests.length;
  await entry.locator('#intro-walk').click();
  await assertEntered(entry);
  await assertWorldHud(entry);
  assert.equal(await entry.evaluate(() => localStorage.getItem('omerta_seen_map')), null, 'Entering does not dismiss first-visit help.');
  await assertPosition(entry, entryPose, 'First phone entry retains pose');
  assert.equal((await state(entry)).reducedMotion, true);
  await entry.locator('#map-mode-walk').click();
  await assertEntered(entry);
  assert.equal(await entry.evaluate(() => window.__cityHandles.length), entryHandles, 'Repeated Walk reuses the same Phaser game.');
  await assertPosition(entry, entryPose, 'Repeated entry retains pose');
  await app.pool.query('UPDATE characters SET cash=2222,health=22,energy=31,nerve=4 WHERE id=$1', [characterId]);
  const liveHud = entry.waitForResponse(async response => {
    if (new URL(response.url()).pathname !== '/v1/projections/player' || response.status() !== 200) return false;
    const reply = await response.json(), character = reply.player?.character || reply.player;
    return character?.cash === 2222 && character.health < 30;
  });
  await entry.locator('#btn-refresh').evaluate(button => button.click());
  const projected = (await (await liveHud).json()).player;
  await assertHud(entry, projected?.character || projected);
  await entry.locator('#map-mode-walk').click(); await assertEntered(entry); await assertWorldHud(entry);
  assert.equal((await state(entry)).resources.health, (projected?.character || projected).health, 'Walk retains the current GET health instead of stale cached values.');
  assert.equal(await entry.evaluate(() => window.__cityHandles.length), entryHandles, 'Current-health reuse keeps the same scene handle.');
  assert.match(await entry.locator('.omerta-city__readiness').textContent(), /LOW HEALTH.*Heal before/);
  if (shots) await entry.screenshot({ path: path.join(shots, 'city-world-hud-375.png') });
  for (const [width, height] of [[320, 568], [360, 780]]) {
    const beforeResize = (await state(entry)).position;
    await entry.setViewportSize({ width, height }); await waitForFrames(entry, 3);
    await entry.locator('#map-mode-walk').click(); await assertEntered(entry); await assertWorldHud(entry);
    await assertPosition(entry, beforeResize, 'Compact resize retains the player pose');
    if (width === 320) {
      const initialHeight = (await state(entry)).camera.height;
      const beforeWarning = (await state(entry)).position;
      await app.pool.query('UPDATE characters SET cash=2223,health=100,safe_until=$2 WHERE id=$1', [characterId, new Date(Date.now() + 60000)]);
      const warningReply = entry.waitForResponse(async response => {
        if (new URL(response.url()).pathname !== '/v1/projections/player' || response.status() !== 200) return false;
        const reply = await response.json(), character = reply.player?.character || reply.player;
        return character?.cash === 2223 && character.safeSeconds > 0;
      });
      await entry.locator('#btn-refresh').evaluate(button => button.click());
      const warningPlayer = (await (await warningReply).json()).player;
      await assertHud(entry, warningPlayer?.character || warningPlayer);
      await waitForFrames(entry, 3);
      assert.match(await entry.locator('.omerta-city__readiness').textContent(), /SAFEHOUSE.*Offense and payouts are restricted/);
      assert((await state(entry)).camera.height < initialHeight - 3, 'A longer winning-projection warning resizes the live camera without ResizeObserver.');
      await assertWorldHud(entry);
      await assertPosition(entry, beforeWarning, 'Live warning wrapping retains the player pose');
      assert.equal(await entry.evaluate(() => window.__cityHandles.length), entryHandles, 'A HUD resize keeps the existing Phaser game.');
    }
    const walking = await state(entry), box = await entry.locator('.omerta-city__canvas canvas').boundingBox();
    const goal = { x: walking.player.x + 16, y: walking.player.y + 16 };
    await entry.locator('.omerta-city__canvas canvas').tap({ position: {
      x: (goal.x - walking.camera.x) * walking.camera.zoom * box.width / walking.camera.width,
      y: (goal.y - walking.camera.y) * walking.camera.zoom * box.height / walking.camera.height,
    } });
    await waitForInput(entry, goal => {
      const state = window.__cityHandles.at(-1).handle.getState();
      return state.pathLength === 0 && Math.hypot(state.player.x - goal.x, state.player.y - goal.y) <= 16;
    }, goal);
    await assertWorldHud(entry);
    if (shots) await entry.screenshot({ path: path.join(shots, 'city-world-hud-' + width + '.png') });
    if (width === 320) {
      await app.pool.query('UPDATE characters SET cash=2222,health=22,safe_until=NULL WHERE id=$1', [characterId]);
      const clearedReply = entry.waitForResponse(async response => {
        if (new URL(response.url()).pathname !== '/v1/projections/player' || response.status() !== 200) return false;
        const reply = await response.json(), character = reply.player?.character || reply.player;
        return character?.cash === 2222 && character.health < 30 && character.safeSeconds === 0;
      });
      await entry.locator('#btn-refresh').evaluate(button => button.click());
      const clearedPlayer = (await (await clearedReply).json()).player;
      await assertHud(entry, clearedPlayer?.character || clearedPlayer);
      await waitForFrames(entry, 3);
      assert.match(await entry.locator('.omerta-city__readiness').textContent(), /LOW HEALTH/);
      await assertWorldHud(entry);
    }
  }
  const phonePose = (await state(entry)).position;
  await entry.setViewportSize({ width: 1440, height: 1000 }); await waitForFrames(entry, 3);
  await entry.locator('#map-mode-walk').click(); await assertEntered(entry); await assertWorldHud(entry);
  assert.equal(await entry.locator('.omerta-city__canvas').evaluate(node => node.style.getPropertyValue('--city-map-height')), '', 'Leaving phone mode removes its height override without ResizeObserver.');
  await assertPosition(entry, phonePose, 'Leaving phone mode retains the player pose');
  await app.pool.query('UPDATE characters SET cash=500,health=100,energy=50,nerve=10 WHERE id=$1', [characterId]);
  assert.deepEqual(gameplayRequests(entryRequests.slice(entryStart)), [], 'Entry never submits gameplay or travel actions.');
  await entry.evaluate(() => { window.__oldEntryButton = document.querySelector('#intro-walk'); });
  await entry.locator('#intro-got').click();
  assert.equal(await entry.evaluate(() => localStorage.getItem('omerta_seen_map')), '1', 'Existing got-it dismissal remains explicit.');
  await entry.evaluate(() => window.__oldEntryButton.click());
  assert.notEqual(await entry.evaluate(() => document.activeElement?.tagName), 'CANVAS', 'A disposed intro button cannot enter the scene.');
  const priorEntryResources = (await state(entry)).resources;
  try {
    await app.pool.query('UPDATE characters SET cash=$1, health=$2 WHERE id=$3', [2222, 22, characterId]);
    const freshEntry = entry.waitForResponse(async response => {
      if (new URL(response.url()).pathname !== '/v1/projections/player' || response.status() !== 200) return false;
      const body = await response.json(), character = body.player?.character || body.player;
      return character?.cash === 2222 && character.health < 30;
    });
    await entry.locator('#btn-refresh').evaluate(button => button.click());
    const freshEntryBody = await (await freshEntry).json();
    const freshEntryCharacter = freshEntryBody.player?.character || freshEntryBody.player;
    await assertHud(entry, freshEntryCharacter);
    await entry.locator('#map-mode-walk').click();
    await assertEntered(entry);
    assert.equal((await state(entry)).resources.health, freshEntryCharacter.health, 'Walk retains the latest server health projection.');
    assert.equal((await state(entry)).resources.cash, freshEntryCharacter.cash, 'Walk retains the latest server cash projection.');
    assert.match(await entry.locator('.omerta-city__readiness').textContent(), /LOW HEALTH.*Heal before/);
    assert.equal(await entry.evaluate(() => window.__cityHandles.length), entryHandles, 'Fresh HUD reuse retains the same renderer.');
  } finally {
    await app.pool.query('UPDATE characters SET cash=$1, health=$2 WHERE id=$3', [priorEntryResources.cash, priorEntryResources.health, characterId]);
  }
  await entry.context().close();

  const page = await newPage();
  const requests = [];
  page.on('request', request => requests.push({ method: request.method(), path: new URL(request.url()).pathname }));
  await openCity(page);
  assert(requests.some(request => request.path === '/vendor/phaser.js'), 'City mode loads the local Phaser engine.');
  assert.equal(await page.evaluate(() => window.Phaser.VERSION), '3.90.0', 'The pinned local Phaser version actually executes.');
  const canvas = page.locator('.omerta-city__canvas canvas');
  const before = await state(page);
  assert(before.ready && !before.reducedMotion, 'Interactive scene is ready.');
  assert.deepEqual(before.art, { background: 'generated', player: 'generated', npcs: 'generated' }, 'The normal scene actually uses the delivered generated background and character art.');
  await refreshHudFromClient(page);
  const deliveredArt = await inspectPngs(page, CITY_ART.map(asset => asset.file));
  for (const [index, delivered] of deliveredArt.entries()) {
    const expected = CITY_ART[index];
    assert.equal(delivered.status, 200, expected.file + ' is served successfully.');
    assert(delivered.png && delivered.type === 'image/png', expected.file + ' is a PNG with the correct media type.');
    assert.deepEqual([delivered.width, delivered.height], [expected.width, expected.height], expected.file + ' has the scene dimensions.');
    assert(delivered.visible > 0, expected.file + ' contains visible art.');
    if (expected.alpha) assert(delivered.transparent > 0, expected.file + ' is a real transparent sprite cutout.');
    else assert.equal(delivered.transparent, 0, 'The neighborhood background is opaque.');
  }

  // Only issued, available actions at known venues can replace the coach. Updates must not
  // repeatedly announce an unchanged objective or expose unavailable leads in the banner.
  await page.evaluate(() => {
    const entry = window.__cityHandles.at(-1);
    window.__guidanceOriginal = { character: entry.options.character, npcQuests: entry.options.npcQuests };
    window.__guideChanges = [];
    window.__guideObserver = new MutationObserver(records => window.__guideChanges.push(...records.map(record => record.type)));
    window.__guideObserver.observe(document.querySelector('.omerta-city__next-move [role="status"]'), { childList: true, subtree: true });
    entry.handle.update({ npcQuests: window.__guidanceOriginal.npcQuests });
  });
  await page.waitForTimeout(50);
  assert.deepEqual(await page.evaluate(() => window.__guideChanges), [], 'An unchanged objective does not repeat its live announcement.');
  const guideFallback = await page.evaluate(() => {
    const entry = window.__cityHandles.at(-1), character = { ...window.__guidanceOriginal.character,
      coach: { label: 'Pull your first job', hint: 'Find a job on the Streets.', tab: 'streets' } };
    const results = [];
    for (const npcQuests of [null, {},
      { workshop: { title: 'Unavailable lead', actions: [{ id: 'complete', available: false }] } },
      { workshop: { title: 'Unissued lead', actions: [{ id: 'complete' }] } },
      { workshop: { title: 'Abandon only', actions: [{ id: 'cancel', available: true }] } },
      { secret: { title: 'Unknown venue', actions: [{ id: 'complete', available: true }] } }]) {
      entry.handle.update({ character, npcQuests });
      const guide = document.querySelector('.omerta-city__next-move');
      results.push({ hidden: guide.hidden, source: guide.dataset.cityGuidance, title: guide.querySelector('strong').textContent,
        button: guide.querySelector('button').textContent, label: guide.querySelector('button').getAttribute('aria-label') });
    }
    entry.handle.update({ character: { ...character, coach: null }, npcQuests: {} });
    const hidden = document.querySelector('.omerta-city__next-move').hidden;
    entry.handle.update({ character: { ...character, coach: { label: 'Check your progress' } }, npcQuests: {} });
    const noTab = document.querySelector('[data-city-nextmove]').hidden;
    entry.handle.update(window.__guidanceOriginal);
    window.__guideObserver.disconnect();
    return { results, hidden, noTab };
  });
  for (const result of guideFallback.results) assert.deepEqual(result,
    { hidden: false, source: 'coach', title: 'Pull your first job', button: 'Go →', label: null },
    'Missing, blocked, incomplete, cancel-only, and unknown-venue quest data preserves coach guidance.');
  assert(guideFallback.hidden && guideFallback.noTab, 'Absent guidance stays hidden and a coach without a destination has no visit button.');

  // Real input must move the player, and local walking must not submit a game action.
  const walkStart = requests.length;
  await holdKey(page, 'ArrowRight', x => {
    const state = window.__cityHandles.at(-1).handle.getState();
    return state.player.x > x + 20 && state.facing === 'right';
  }, before.player.x);
  const afterKeyboard = await state(page);
  assert(afterKeyboard.player.x > before.player.x + 20, 'Focused arrow input moves the avatar.');
  const blockingBuilding = afterKeyboard.obstacles.filter(obstacle => obstacle.x > before.player.x
    && obstacle.y < before.player.y && obstacle.y + obstacle.height > before.player.y).sort((a, b) => a.x - b.x)[0];
  assert(blockingBuilding, 'A solid facade lies on the rehearsed movement ray.');
  await page.evaluate(() => { window.__cityCollision = null; });
  await holdKey(page, 'ArrowRight', facade => {
    const state = window.__cityHandles.at(-1).handle.getState(), previous = window.__cityCollision;
    const x = state.player.x;
    window.__cityCollision = { x, frames: previous?.x === x ? previous.frames + 1 : 0 };
    return x >= facade - 20 && state.facing === 'right' && window.__cityCollision.frames >= 12;
  }, blockingBuilding.x);
  const atBuilding = await state(page);
  assert(atBuilding.player.x < blockingBuilding.x, 'Arrow movement stops outside the solid building.');
  assert(atBuilding.player.x - afterKeyboard.player.x < 45, 'A held movement key cannot cross the building facade.');
  const box = await canvas.boundingBox();
  const goal = { x: 440, y: 440 };
  const camera = atBuilding.camera;
  await canvas.click({ position: {
    x: (goal.x - camera.x) * camera.zoom * box.width / camera.width,
    y: (goal.y - camera.y) * camera.zoom * box.height / camera.height,
  } });
  await waitForInput(page, () => window.__cityHandles.at(-1).handle.getState().pathLength > 0);
  await waitForInput(page, () => window.__cityHandles.at(-1).handle.getState().pathLength === 0);
  const afterPointer = await state(page);
  assert(Math.hypot(afterPointer.player.x - goal.x, afterPointer.player.y - goal.y) <= 16, 'Canvas tap routes the avatar to the chosen ground.');
  assert(!afterPointer.obstacles.some(obstacle => afterPointer.player.x > obstacle.x && afterPointer.player.x < obstacle.x + obstacle.width
    && afterPointer.player.y > obstacle.y && afterPointer.player.y < obstacle.y + obstacle.height), 'The walked route ends outside solid geometry.');
  const stories = afterPointer.destinations.find(destination => destination.id === 'stories');
  const pointerBox = await canvas.boundingBox();
  await canvas.click({ position: {
    x: (stories.x - afterPointer.camera.x) * afterPointer.camera.zoom * pointerBox.width / afterPointer.camera.width,
    y: (stories.y - afterPointer.camera.y) * afterPointer.camera.zoom * pointerBox.height / afterPointer.camera.height,
  } });
  await waitForInput(page, () => window.__cityHandles.at(-1).handle.getState().pathLength > 0);
  await page.locator('#map-mode-territory').focus();
  await waitForInput(page, () => window.__cityHandles.at(-1).handle.getState().pathLength === 0);
  const afterBlur = await state(page);
  await waitForFrames(page, 16);
  assert.deepEqual((await state(page)).player, afterBlur.player, 'Leaving canvas focus cancels the pending venue walk.');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'map-mode-territory', 'Cancelled arrival never steals focus from another control.');
  assert.equal(await page.locator('.omerta-city__interaction').isVisible(), false, 'Cancelled arrival opens no venue card.');
  assert.deepEqual(requests.slice(walkStart).filter(request => !['GET', 'HEAD'].includes(request.method)), [],
    'Walking does not mutate gameplay or spend travel fare.');

  // Background character/map refreshes retain the live scene and its local position.
  await canvas.focus(); // Existing background renders defer while a gameplay button has focus.
  const handleCount = await page.evaluate(() => window.__cityHandles.length);
  const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/projections/player');
  await page.locator('#btn-refresh').evaluate(button => button.click());
  await refreshed;
  const mapRefresh = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/map');
  // A real own-character event exercises refresh()+renderActive without an authoritative action.
  const { bus } = await import('../src/game.js');
  bus.emit('me:' + characterId, { type: 'city-browser-refresh' });
  await mapRefresh;
  assert.equal(await page.evaluate(() => window.__cityHandles.length), handleCount, 'Same-district refresh preserves the existing Phaser game.');
  assert(Math.hypot((await state(page)).player.x - afterBlur.player.x, (await state(page)).player.y - afterBlur.player.y) < 1,
    'Same-district refresh preserves the local avatar position.');
  const resourcePose = (await state(page)).position;
  await app.pool.query('UPDATE characters SET cash=4321,energy=65,nerve=8,health=72,heat=13,respect=500 WHERE id=$1', [characterId]);
  const resourceRead = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/projections/player');
  await canvas.focus();
  bus.emit('me:' + characterId, { type: 'city-browser-resources' });
  const resourceReply = await (await resourceRead).json();
  await assertHud(page, resourceReply.player?.character || resourceReply.player);
  await assertPosition(page, resourcePose, 'A resource update preserves exploration pose');
  if (shots) {
    await dismissCelebration(page);
    await page.locator('#city-scene-host').screenshot({ path: path.join(shots, 'city-desktop.png'), style: sceneShotStyle });
  }

  // Selecting an existing district board never presents a second travel transaction.
  await page.locator('#map-mode-territory').click();
  assert.equal(await page.locator('.omerta-city__canvas canvas').count(), 0, 'Territory mode disposes the walking canvas.');
  assert(await page.evaluate(() => window.__cityHandles.at(-1).destroyed), 'Territory mode destroys the scene handle.');
  await page.locator('#map-mode-walk').click();
  await waitForCity(page);

  // Destination doors reuse the corresponding gameplay screens and dispose the old scene.
  for (const [destination, tab] of Object.entries({
    fixer: 'streets', workshop: 'garage', training: 'life', clubhouse: 'crew', stories: 'desk',
  })) {
    const venuePose = (await state(page)).position;
    const resourcesBeforeJob = (await state(page)).resources;
    await page.locator(`.omerta-city__destination[data-destination="${destination}"]`).click();
    await page.locator('[data-city-open]').click();
    await page.waitForSelector(`#tab-${tab}.on`, { state: 'attached' });
    assert(await page.evaluate(() => window.__cityHandles.at(-1).destroyed), `${destination} navigation destroys the old scene.`);
    assert.equal(await page.locator('.omerta-city__canvas canvas').count(), 0, 'Tab switch removes the previous canvas.');
    if (destination === 'fixer') {
      // Complete the first playable loop through the existing authoritative crime control.
      const crimeResponse = page.waitForResponse(response => response.request().method() === 'POST'
        && new URL(response.url()).pathname.startsWith('/v1/crimes/'));
      const random = Math.random;
      try {
        Math.random = () => 0; // Deterministic server die; the browser has its own realm.
        await page.locator('#tab-streets .verbrow .prime').first().click();
        const response = await crimeResponse;
        assert.equal(response.status(), 200, 'A fixer job reaches the existing server action.');
        assert.equal((await response.json()).success, true, 'The deterministic first job succeeds.');
        assert(response.request().headers()['idempotency-key'], 'The game retains its mutation retry key.');
      } finally { Math.random = random; }
      await page.locator('[data-operation-receipt].operation-receipt--success').first().waitFor({ state: 'attached' });
    }
    await returnToCity(page);
    assert.equal(await page.locator('.omerta-city__canvas canvas').count(), 1, 'Returning to Map mounts exactly one canvas.');
    await assertPosition(page, venuePose, destination + ' returns to the saved neighborhood pose');
    if (destination === 'fixer') {
      await refreshHudFromClient(page);
      assert((await state(page)).resources.nerve < resourcesBeforeJob.nerve, 'A real job updates City HUD nerve after returning.');
    }
  }

  // The training-room doorway opens the actual gym, then submits its existing authoritative action.
  await app.pool.query('UPDATE characters SET energy=65,train_at=NULL WHERE id=$1', [characterId]);
  await refreshHudFromClient(page);
  const gymPose = (await state(page)).position, energyBeforeGym = (await state(page)).resources.energy;
  await page.locator('[data-destination="training"]').click();
  await page.locator('[data-city-action="streets"]').click();
  const gym = page.locator('details[data-sect="streets-train"]');
  await gym.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('details[data-sect="streets-train"]')?.open === true);
  assert.equal(await gym.evaluate(details => details.open), true, 'Training-room navigation expands the existing gym section.');
  const trainingReply = page.waitForResponse(response => response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/v1/train/muscle');
  await gym.locator('[data-do="POST /v1/train/muscle"]').click();
  const trainingResponse = await trainingReply;
  assert.equal(trainingResponse.status(), 200, 'The gym executes the existing train route.');
  const trained = await trainingResponse.json();
  assert.equal(trained.stat, 'muscle');
  assert(trained.gain > 0, 'The real gym action improves the chosen stat.');
  assert(trainingResponse.request().headers()['idempotency-key'], 'Training retains its mutation retry key.');
  await page.locator('[data-operation-receipt].operation-receipt--success').filter({ hasText: /muscle/i }).first().waitFor({ state: 'attached' });
  await returnToCity(page);
  await refreshHudFromClient(page);
  assert((await state(page)).resources.energy < energyBeforeGym, 'The returned City HUD reflects energy spent at the gym.');
  await assertPosition(page, gymPose, 'Training returns to the same exploration pose');

  // The scene directory covers every human gameplay panel, including the new Fieldwork journal.
  const tabs = await page.locator('#tabs [data-tab]').evaluateAll(buttons => buttons.map(button => button.dataset.tab).filter(tab => tab !== 'deck'));
  const directory = (await state(page)).actions;
  const entries = Object.entries(directory).flatMap(([venueId, actions]) => actions.map(action => ({ venueId, ...action })));
  const covered = new Set(entries.map(action => action.tab));
  assert(covered.has('fieldwork'), 'Fieldwork is reachable from a City venue.');
  assert(covered.has('world'), 'The existing Command Center is reachable from a City venue.');
  for (const tab of tabs) assert(covered.has(tab), 'The City directory includes gameplay panel ' + tab);
  const directoryPose = (await state(page)).position;
  for (const tab of tabs.filter(tab => tab !== 'map')) {
    const entry = entries.find(action => action.tab === tab);
    await page.locator(`[data-destination="${entry.venueId}"]`).click();
    const action = page.locator(`[data-city-action="${tab}"]`);
    if (await action.count()) await action.click();
    else await page.locator('[data-city-open]').click();
    await page.waitForSelector(`#tab-${tab}.on`, { state: 'visible' });
    await page.waitForFunction(tab => document.querySelector('#tab-' + tab)?.textContent.trim().length > 0, tab);
    assert.equal(await page.locator('.omerta-city__canvas canvas').count(), 0, tab + ' disposes the exploration renderer.');
    await returnToCity(page);
    await assertPosition(page, directoryPose, tab + ' returns to the same City session');
  }
  const reloadPose = (await state(page)).position;
  await page.reload({ waitUntil: 'networkidle' });
  await selectTab(page, 'map');
  await waitForCity(page);
  await assertPosition(page, reloadPose, 'Reload restores the character/generation/district-scoped session position');

  // On a phone the above-map guide follows the original introduction's real issued objectives.
  // Opening a destination remains separate from explicit conversations, choices, and item award.
  await page.setViewportSize({ width: 375, height: 812 });
  await dismissCelebration(page);
  await visitQuest(page, 'fixer', requests);
  for (const height of [500, 320]) {
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 375, height });
    await page.locator('[data-destination="fixer"]').click();
    await assertVenueOnscreen(page);
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.omerta-city__interaction').isVisible(), false, 'A short-screen venue retains keyboard close.');
  await page.setViewportSize({ width: 375, height: 812 });
  const beforeDirectory = requests.length;
  await page.locator('[data-destination="directory"]').click();
  await assertVenueOnscreen(page);
  await page.locator('.omerta-city__interaction').evaluate(card => { card.scrollTop = 120; });
  const readingPosition = await page.evaluate(() => ({ page: scrollY, card: document.querySelector('.omerta-city__interaction').scrollTop,
    focused: document.activeElement.dataset.cityOpen }));
  await page.setViewportSize({ width: 375, height: 800 });
  await waitForFrames(page, 3);
  assert.deepEqual(await page.evaluate(() => ({ page: scrollY, card: document.querySelector('.omerta-city__interaction').scrollTop,
    focused: document.activeElement.dataset.cityOpen })), readingPosition, 'A small viewport resize preserves venue reading position and focus.');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('[data-destination="fixer"]').click();
  await assertVenueOnscreen(page);
  assert.deepEqual(requests.slice(beforeDirectory).filter(request => !['GET', 'HEAD'].includes(request.method)), [],
    'Revealing venue details from the destination list submits no gameplay action.');
  await questAction(page, page.locator('[data-city-quest-action]:enabled').first());
  await page.waitForFunction(() => document.querySelector('.omerta-city__interaction')?.textContent.includes('Nico Bellini'));
  await questAction(page, page.locator('[data-city-quest-action]:enabled').first());
  const listen = page.locator('[data-city-quest-action]').filter({ hasText: 'Listen before you act' });
  await listen.waitFor({ state: 'visible' });
  await questAction(page, listen);
  await page.waitForFunction(() => document.querySelector('.omerta-city__next-move strong')?.textContent.includes('Listen at the Workshop'));
  await visitQuest(page, 'workshop', requests);
  await page.waitForFunction(() => document.querySelector('.omerta-city__interaction')?.textContent.includes('Ada Ferri'));
  if (shots) {
    await dismissCelebration(page);
    await page.locator('#city-scene-host').screenshot({ path: path.join(shots, 'city-quest.png'), style: sceneShotStyle });
  }
  await questAction(page, page.locator('[data-city-quest-action]:enabled').first());
  await visitQuest(page, 'stories', requests);
  await page.locator('[data-city-quest-action="explore"]').waitFor({ state: 'visible' });
  await questAction(page, page.locator('[data-city-quest-action="explore"]'));
  await page.waitForFunction(() => document.querySelector('.omerta-city__interaction')?.textContent.includes('Elena Serra'));
  await questAction(page, page.locator('[data-city-quest-action]:enabled').first());
  const caseReply = await app.inject({ method: 'GET', url: '/v1/worldgraph/mysteries/neighborhood-initiation', headers });
  assert.equal(caseReply.statusCode, 200, caseReply.body);
  assert.equal(caseReply.json().status, 'completed', 'Door interactions complete the persisted quest.');
  assert(caseReply.json().choices.some(choice => choice.choiceId === 'listen'), 'The first approach is remembered by the server.');
  await page.waitForFunction(() => document.querySelector('.omerta-city__next-move')?.dataset.cityGuidance === 'coach');
  assert.equal(await page.locator('[data-city-nextmove]').getAttribute('aria-label'), null, 'A completed quest returns to coach guidance.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-city-journal]').click();
  await page.waitForSelector('#tab-fieldwork.on', { state: 'visible' });
  await page.locator('[data-fieldwork-view="inventory"]').click();
  await page.locator('.fieldwork-item').filter({ hasText: 'Neighborhood Notebook' }).waitFor({ state: 'visible' });
  await page.locator('[data-fieldwork-view="mysteries"]').click();
  await page.locator('[data-fieldwork-mystery="neighborhood-initiation"]').click();
  await page.waitForFunction(() => document.querySelector('.fieldwork-case')?.textContent.toLowerCase().includes('completed'));
  await returnToCity(page);
  await selectTab(page, 'city');
  await page.locator('#city-walk-open').click();
  await page.waitForSelector('#tab-map.on', { state: 'attached' });
  await waitForCity(page);

  const mobile = await newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await openCity(mobile);
  const reducedState = await state(mobile);
  assert.equal(reducedState.reducedMotion, true, 'Reduced-motion preference reaches the scene.');
  assert(reducedState.ambient.length > 0, 'Ambient actors are present for the reduced-motion rehearsal.');
  await waitForFrames(mobile, 36);
  assert.deepEqual((await state(mobile)).ambient, reducedState.ambient, 'Reduced motion keeps cosmetic ambient actors still.');
  const mobileLayout = await mobile.evaluate(() => {
    const canvas = document.querySelector('.omerta-city__canvas canvas').getBoundingClientRect();
    return { viewport: innerWidth, width: document.documentElement.scrollWidth, canvasLeft: canvas.left, canvasRight: canvas.right };
  });
  assert(mobileLayout.width <= mobileLayout.viewport + 1, `Phone layout has no horizontal overflow: ${JSON.stringify(mobileLayout)}`);
  assert(mobileLayout.canvasLeft >= 0 && mobileLayout.canvasRight <= mobileLayout.viewport + 1, 'The phone canvas stays inside the viewport.');
  const moveDown = mobile.locator('[data-city-move="down"]');
  await moveDown.scrollIntoViewIfNeeded();
  const touchBox = await moveDown.boundingBox();
  assert(touchBox.width >= 44 && touchBox.height >= 44, 'Mobile movement has a usable 44px touch target.');
  const touchSession = await mobile.context().newCDPSession(mobile);
  const touchPoint = { x: touchBox.x + touchBox.width / 2, y: touchBox.y + touchBox.height / 2, id: 1 };
  await mobile.bringToFront();
  const touchStart = (await state(mobile)).player;
  try {
    try {
      await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
      await waitForInput(mobile, y => {
        const state = window.__cityHandles.at(-1).handle.getState();
        return state.player.y > y + 20 && state.facing === 'down'
          && document.querySelector('[data-city-move="down"]').classList.contains('is-held');
      }, touchStart.y);
    } finally { await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    assert((await state(mobile)).player.y > touchStart.y + 20, 'A real held touch moves the avatar.');
    const afterRelease = (await state(mobile)).player;
    await waitForFrames(mobile, 10);
    assert.deepEqual((await state(mobile)).player, afterRelease, 'Touch release stops movement.');
    assert.equal(await mobile.locator('[data-city-move].is-held').count(), 0, 'Touch release clears the held input.');
    try {
      await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
      await waitForInput(mobile, y => {
        const state = window.__cityHandles.at(-1).handle.getState();
        return state.player.y > y && state.facing === 'down'
          && document.querySelector('[data-city-move="down"]').classList.contains('is-held');
      }, afterRelease.y);
    } finally { await touchSession.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); }
    const afterCancel = (await state(mobile)).player;
    await waitForFrames(mobile, 10);
    assert.deepEqual((await state(mobile)).player, afterCancel, 'Pointer cancellation stops held touch movement.');
    assert.equal(await mobile.locator('[data-city-move].is-held').count(), 0, 'Pointer cancellation clears the held input.');
  } finally { await touchSession.detach(); }
  await mobile.locator('[data-destination="fixer"]').tap();
  await mobile.locator('[data-city-close]').tap();
  assert.equal(await mobile.locator('.omerta-city__interaction').isVisible(), false, 'Touch users can close venue details.');
  if (shots) await mobile.locator('#city-scene-host').screenshot({ path: path.join(shots, 'city-mobile.png'), style: sceneShotStyle });

  // An image outage retains local exploration and the existing gameplay destinations.
  const missingArt = await newPage();
  const artFallbackRequests = [];
  missingArt.on('request', request => artFallbackRequests.push({ method: request.method(), path: new URL(request.url()).pathname }));
  await missingArt.route('**/art/city-*.png*', route => route.abort());
  await openCity(missingArt);
  const fallbackState = await state(missingArt);
  assert.deepEqual(fallbackState.art, { background: 'fallback', player: 'fallback', npcs: 'fallback' }, 'Missing generated images use the procedural fallback textures.');
  const artWalkStart = artFallbackRequests.length;
  await holdKey(missingArt, 'ArrowDown', y => {
    const state = window.__cityHandles.at(-1).handle.getState();
    return state.player.y > y + 20 && state.facing === 'down';
  }, fallbackState.player.y);
  assert((await state(missingArt)).player.y > fallbackState.player.y + 20, 'The fallback avatar still walks through the scene.');
  assert.deepEqual(artFallbackRequests.slice(artWalkStart).filter(request => !['GET', 'HEAD'].includes(request.method)), [], 'Fallback walking still submits no game mutation.');
  await missingArt.locator('.omerta-city__destination[data-destination="stories"]').click();
  await missingArt.locator('[data-city-open]').click();
  await missingArt.waitForSelector('#tab-desk.on', { state: 'attached' });

  // A slow asset response must not resurrect a scene after the player has left Map.
  const delayed = await newPage();
  let releaseEngine;
  const release = new Promise(resolve => { releaseEngine = resolve; });
  await delayed.route('**/vendor/phaser.js*', async route => {
    await release;
    await route.continue();
  });
  await delayed.goto(base, { waitUntil: 'networkidle' });
  await delayed.waitForSelector('#screen-main:not(.hidden)');
  const engineRequested = delayed.waitForRequest(request => new URL(request.url()).pathname === '/vendor/phaser.js', { timeout: 10000 });
  await selectTab(delayed, 'map');
  await engineRequested;
  await delayed.locator('#map-mode-walk').click();
  await selectTab(delayed, 'streets');
  const engineLoaded = delayed.waitForResponse(response => new URL(response.url()).pathname === '/vendor/phaser.js');
  releaseEngine();
  await engineLoaded;
  await delayed.waitForTimeout(300);
  assert.equal(await delayed.locator('.omerta-city__canvas canvas').count(), 0, 'Delayed engine cannot mount onto an abandoned Map tab.');
  assert(await delayed.evaluate(() => window.__cityHandles.every(entry => entry.destroyed)), 'No live renderer handle survives a delayed tab departure.');
  assert.notEqual(await delayed.evaluate(() => document.activeElement?.tagName), 'CANVAS', 'A departed entry intent cannot steal focus.');

  // Later modal focus and authoritative identity changes cancel pending entry before readiness.
  for (const reason of ['modal', 'identity', 'wheel', 'keyboard', 'touch', 'blur', 'hidden']) {
    const waiting = await newPage();
    let unblock;
    const gate = new Promise(resolve => { unblock = resolve; });
    await waiting.route('**/vendor/phaser.js*', async route => { await gate; await route.continue(); });
    await waiting.goto(base, { waitUntil: 'networkidle' });
    const engine = waiting.waitForRequest(request => new URL(request.url()).pathname === '/vendor/phaser.js');
    await selectTab(waiting, 'map'); await engine;
    await waiting.locator('#map-mode-walk').click();
    assert.equal(await waiting.locator('#map-mode-walk').getAttribute('aria-busy'), 'true', 'Capture pending entry before ' + reason + ' cancellation.');
    if (reason === 'modal') {
      await waiting.keyboard.press('/');
      await waiting.locator('#jump-q').waitFor({ state: 'visible' });
    } else if (reason === 'identity') {
      const alive = (await app.pool.query('SELECT generation FROM characters WHERE id=$1', [characterId])).rows[0].generation;
      await waiting.route('**/v1/projections/player', async route => {
        const response = await route.fetch(), reply = await response.json();
        if (response.status() !== 200) return route.fulfill({ response });
        (reply.player?.character || reply.player).generation = alive + 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
      });
      const changed = waiting.waitForResponse(async response => {
        if (new URL(response.url()).pathname !== '/v1/projections/player' || response.status() !== 200) return false;
        const reply = await response.json(); return (reply.player?.character || reply.player)?.generation === alive + 1;
      });
      await waiting.locator('#btn-refresh').evaluate(button => button.click()); await changed;
    } else if (reason === 'wheel') await waiting.mouse.wheel(0, 50);
    else if (reason === 'keyboard') await waiting.keyboard.press('PageDown');
    else if (reason === 'touch') await waiting.evaluate(() => document.dispatchEvent(new Event('touchmove', { bubbles: true })));
    else if (reason === 'blur') await waiting.evaluate(() => window.dispatchEvent(new Event('blur')));
    else {
      await waiting.evaluate(() => {
        // Headless Chromium keeps all tabs visible. Drive the visibility contract directly,
        // capturing cancellation synchronously before any100ms intent timer can run.
        const before = Object.getOwnPropertyDescriptor(document, 'hidden');
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        try {
          document.dispatchEvent(new Event('visibilitychange'));
          window.__entryCanceledWhenHidden = !document.querySelector('#map-mode-walk').hasAttribute('aria-busy');
        } finally {
          if (before) Object.defineProperty(document, 'hidden', before); else delete document.hidden;
          document.dispatchEvent(new Event('visibilitychange'));
        }
      });
      assert(await waiting.evaluate(() => window.__entryCanceledWhenHidden), 'The pending intent is canceled synchronously on page hiding.');
    }
    await waiting.waitForFunction(() => !document.querySelector('#map-mode-walk')?.hasAttribute('aria-busy'), null, { polling: 100, timeout: 5000 });
    const loaded = waiting.waitForResponse(response => new URL(response.url()).pathname === '/vendor/phaser.js');
    unblock(); await loaded;
    if (reason === 'hidden') await waiting.bringToFront();
    if (reason === 'modal') await waiting.waitForFunction(() => window.__cityHandles.at(-1)?.handle.getState().ready);
    await waitForFrames(waiting, 3);
    assert.notEqual(await waiting.evaluate(() => document.activeElement?.tagName), 'CANVAS', reason + ' cancels delayed canvas focus.');
    if (reason === 'modal') assert.equal(await waiting.evaluate(() => document.activeElement?.id), 'jump-q');
    await waiting.context().close();
  }

  // Even a missing scene module leaves existing gameplay navigation available.
  const loadingResources = await newPage();
  let releaseResourceEngine;
  const resourceEngineGate = new Promise(resolve => { releaseResourceEngine = resolve; });
  await loadingResources.route('**/vendor/phaser.js*', async route => { await resourceEngineGate; await route.continue(); });
  const previousResourceRow = (await app.pool.query('SELECT cash, health FROM characters WHERE id=$1', [characterId])).rows[0];
  try {
    await loadingResources.goto(base, { waitUntil: 'networkidle' });
    const resourceEngineRequested = loadingResources.waitForRequest(request => new URL(request.url()).pathname === '/vendor/phaser.js');
    await selectTab(loadingResources, 'map');
    await resourceEngineRequested;
    await app.pool.query('UPDATE characters SET cash=$1, health=$2 WHERE id=$3', [3333, 23, characterId]);
    const changedResources = loadingResources.waitForResponse(async response => {
      if (new URL(response.url()).pathname !== '/v1/projections/player' || response.status() !== 200) return false;
      const body = await response.json(), character = body.player?.character || body.player;
      return character?.cash === 3333 && character.health < 30;
    });
    await loadingResources.locator('#btn-refresh').evaluate(button => button.click());
    const changedResourceBody = await (await changedResources).json();
    const changedResourceCharacter = changedResourceBody.player?.character || changedResourceBody.player;
    const resourceEngineLoaded = loadingResources.waitForResponse(response => new URL(response.url()).pathname === '/vendor/phaser.js');
    releaseResourceEngine();
    await resourceEngineLoaded;
    await waitForCity(loadingResources);
    await assertHud(loadingResources, changedResourceCharacter);
    assert.match(await loadingResources.locator('.omerta-city__readiness').textContent(), /LOW HEALTH.*Heal before/);
  } finally {
    releaseResourceEngine();
    await app.pool.query('UPDATE characters SET cash=$1, health=$2 WHERE id=$3', [previousResourceRow.cash, previousResourceRow.health, characterId]);
    await loadingResources.context().close();
  }

  const missingScene = await newPage();
  await missingScene.route('**/city-scene.js*', route => route.abort());
  await missingScene.goto(base, { waitUntil: 'networkidle' });
  await missingScene.waitForSelector('#screen-main:not(.hidden)');
  await selectTab(missingScene, 'map');
  await missingScene.locator('#city-scene-retry').waitFor();
  await missingScene.locator('#map-mode-walk').click();
  await missingScene.waitForFunction(() => document.activeElement?.id === 'city-scene-retry');
  assert.equal(await missingScene.locator('.omerta-city__canvas canvas').count(), 0, 'Failed assets never leave a partial canvas.');
  const fallbackTabs = await missingScene.locator('[data-city-jump]').evaluateAll(buttons => buttons.map(button => button.dataset.cityJump));
  for (const tab of tabs) assert(fallbackTabs.includes(tab), 'Missing scene module retains gameplay destination ' + tab);
  await missingScene.locator('[data-city-jump="streets"]').first().click();
  await missingScene.waitForSelector('#tab-streets.on', { state: 'attached' });

  // Missing Phaser retains the renderer's accessible destinations.
  const missingEngine = await newPage();
  await missingEngine.route('**/vendor/phaser.js*', route => route.abort());
  await missingEngine.goto(base, { waitUntil: 'networkidle' });
  await missingEngine.waitForSelector('#screen-main:not(.hidden)');
  await selectTab(missingEngine, 'map');
  await missingEngine.locator('.omerta-city--unavailable').waitFor();
  assert.equal(await missingEngine.locator('.omerta-city__world-hud').count(), 1, 'Engine fallback preserves projection-backed walking status.');
  await missingEngine.locator('#map-mode-walk').click();
  await missingEngine.waitForFunction(() => document.activeElement?.dataset.destination === 'fixer');
  assert.match(await missingEngine.locator('.omerta-city__status').textContent(), /unavailable/);
  assert.equal(await missingEngine.locator('.omerta-city__canvas canvas').count(), 0, 'Engine failure retains no broken canvas.');
  await missingEngine.evaluate(() => window.__cityHandles.at(-1).handle.update({ npcQuests: {
    workshop: { title: 'Listen at the Workshop', actions: [{ id: 'complete', available: true }] },
  } }));
  await missingEngine.setViewportSize({ width: 375, height: 812 });
  await missingEngine.getByRole('button', { name: 'Visit The Workshop', exact: true }).click();
  await assertVenueOnscreen(missingEngine);
  assert.equal((await state(missingEngine)).selectedVenue, 'workshop', 'Quest guidance opens venue details even when the engine is unavailable.');
  await missingEngine.locator('[data-city-close]').click();
  const fallbackFocus = await missingEngine.evaluate(() => {
    const control = document.activeElement, bounds = control.getBoundingClientRect();
    return { destination: control.dataset.destination, visible: [bounds.top + 3, bounds.bottom - 3].every(y => {
      const hit = document.elementFromPoint(bounds.left + bounds.width / 2, y);
      return hit === control || control.contains(hit);
    }) };
  });
  assert.deepEqual(fallbackFocus, { destination: 'workshop', visible: true }, 'Fallback close restores a visible destination control.');
  await missingEngine.locator('.omerta-city__destination[data-destination="stories"]').click();
  await missingEngine.locator('[data-city-open]').click();
  await missingEngine.waitForSelector('#tab-desk.on', { state: 'attached' });
  await missingEngine.unroute('**/vendor/phaser.js*');
  await selectTab(missingEngine, 'map');
  await waitForCity(missingEngine);
  assert.equal(await missingEngine.locator('.omerta-city__canvas canvas').count(), 1, 'Returning after an engine load failure retries the engine successfully.');

  // Authoritative identity transitions must never reuse another district or generation's pose.
  await page.bringToFront();
  const identityHandles = await page.evaluate(() => window.__cityHandles.length);
  const map = (await app.inject({ method: 'GET', url: '/v1/map', headers })).json();
  const otherDistrict = map.districts.find(district => district.id !== (resourceReply.player?.character || resourceReply.player).loc).id;
  await app.pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [characterId, otherDistrict]);
  const districtRead = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/projections/player');
  await page.locator('.omerta-city__canvas canvas').focus();
  bus.emit('me:' + characterId, { type: 'city-browser-district' });
  await districtRead;
  await page.waitForFunction(count => window.__cityHandles.length > count && window.__cityHandles.at(-1).handle.getState().ready, identityHandles);
  assert.deepEqual((await state(page)).player, { x: 430, y: 366 }, 'Another district starts at its own valid spawn.');
  await holdKey(page, 'ArrowDown', () => {
    const state = window.__cityHandles.at(-1).handle.getState();
    return state.player.y > 400 && state.facing === 'down';
  });
  assert((await state(page)).player.y > 400, 'The old generation has a distinct pose before invalidation.');
  const generationHandles = await page.evaluate(() => window.__cityHandles.length);
  let generationReads = 0, delayedMapReads = 0;
  let releaseOldMap;
  const oldMapGate = new Promise(resolve => { releaseOldMap = resolve; });
  await page.route('**/v1/map', async route => {
    if (++delayedMapReads !== 1) return route.continue();
    const response = await route.fetch();
    await oldMapGate;
    await page.waitForTimeout(250);
    await route.fulfill({ response });
  });
  // Begin the stale read before changing identity. An old request still in api()'s queue can
  // correctly be canceled without reaching HTTP, which would not exercise this response race.
  const oldMapRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/v1/map');
  bus.emit('me:' + characterId, { type: 'city-browser-old-map' });
  await oldMapRequest;
  await page.route('**/v1/projections/player', route => {
    if (++generationReads === 1) return route.fulfill({ status: 409, contentType: 'application/json',
      body: JSON.stringify({ error: 'contention', message: 'Refresh the view before trying again.' }) });
    return route.continue();
  });
  let generationRead, recoveredRead;
  try {
    const nextGeneration = (await app.pool.query('UPDATE characters SET generation=generation+1 WHERE id=$1 RETURNING generation', [characterId])).rows[0].generation;
    generationRead = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/projections/player' && response.status() === 409);
    recoveredRead = page.waitForResponse(async response => {
      if (new URL(response.url()).pathname !== '/v1/projections/player' || response.status() !== 200) return false;
      const reply = await response.json();
      return (reply.player?.character || reply.player)?.generation === nextGeneration;
    });
    bus.emit('me:' + characterId, { type: 'city-browser-generation' });
  } finally { releaseOldMap(); }
  const contentionResponse = await generationRead;
  assert.equal((await contentionResponse.json()).error, 'contention', 'Generation refresh exercises the bounded contention recovery.');
  let generationResponse = contentionResponse;
  try {
    generationResponse = await recoveredRead;
    await page.waitForFunction(count => window.__cityHandles.length > count && window.__cityHandles.at(-1).handle.getState().ready, generationHandles);
  } catch (error) {
    const reply = await generationResponse.json(), character = reply.player?.character || reply.player;
    console.error('City generation remount diagnostic:', JSON.stringify({ countBefore: generationHandles,
      code: generationResponse.status(), error: reply.error, message: reply.message,
      projection: { id: character?.id, loc: character?.loc, generation: character?.generation },
      browser: await page.evaluate(() => ({ hidden: document.hidden, focused: document.hasFocus(),
        mapActive: document.querySelector('#tab-map')?.classList.contains('on'),
        main: !document.querySelector('#screen-main')?.classList.contains('hidden'),
        auth: !document.querySelector('#screen-auth')?.classList.contains('hidden'),
        create: !document.querySelector('#screen-create')?.classList.contains('hidden'),
        canvases: document.querySelectorAll('.omerta-city__canvas canvas').length,
        handles: window.__cityHandles.slice(-3).map(entry => ({ destroyed: entry.destroyed,
          identity: { id: entry.options.character?.id, loc: entry.options.character?.loc, generation: entry.options.character?.generation },
          ready: entry.handle.getState().ready, player: entry.handle.getState().player })) })) }));
    throw error;
  }
  assert.deepEqual((await state(page)).player, { x: 430, y: 366 }, 'A new generation cannot reuse the prior generation pose.');
  assert(generationReads >= 2 && delayedMapReads >= 2,
    `Contention recovery supersedes the delayed old-identity map with a fresh read (player=${generationReads}, map=${delayedMapReads}).`);
  assert(await page.evaluate(count => window.__cityHandles.slice(0, count).every(entry => entry.destroyed), generationHandles),
    'All old-generation handles stay retired after the delayed map response.');
  assert.equal(await page.locator('.omerta-city__canvas canvas').count(), 1, 'Recovery leaves exactly one current-generation canvas.');
  await page.unroute('**/v1/projections/player');
  await page.unroute('**/v1/map');
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [characterId]);
  await page.locator('#btn-refresh').click();
  await page.waitForSelector('#screen-create:not(.hidden)');
  assert.equal(await page.locator('.omerta-city__canvas canvas').count(), 0, 'No living character disposes the City renderer.');
  const authGuest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });
  const authToken = authGuest.json().token;
  const authHeaders = { authorization: 'Bearer ' + authToken };
  const authCharacter = await app.inject({ method: 'POST', url: '/v1/character', headers: authHeaders, payload: { name: 'City Auth' } });
  assert.equal(authCharacter.statusCode, 200, authCharacter.body);
  const authPage = await newPage({}, authToken);
  await openCity(authPage);
  await authPage.getByRole('button', { name: 'Visit The Fixer', exact: true }).waitFor();
  await authPage.evaluate(() => { window.__oldQuestVisit = document.querySelector('[data-city-nextmove]'); });
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/logout-all', headers: authHeaders })).statusCode, 200);
  await authPage.locator('#btn-refresh').click();
  await authPage.waitForSelector('#screen-auth:not(.hidden)');
  assert.equal(await authPage.locator('.omerta-city__canvas canvas').count(), 0, 'A revoked session disposes City and returns to sign-in.');
  const retiredVisit = await authPage.evaluate(() => {
    window.__oldQuestVisit.click();
    return { guides: document.querySelectorAll('.omerta-city__next-move').length,
      selected: window.__cityHandles.at(-1).handle.getState().selectedVenue };
  });
  assert.deepEqual(retiredVisit, { guides: 0, selected: null }, 'A retired identity cannot reopen its old quest destination.');
  assert.deepEqual(pageErrors, [], 'No uncaught browser errors.');
  for (const context of contexts) await context.close();
  console.log('city-scene-browser: generated art/fallbacks, movement/collision, live resource HUD, all gameplay destinations, real job receipt, saved return/reload poses, phone quest guidance/visits/coach fallback, NPC quest/choice/keepsake/journal, mobile touch/release/cancel, reduced motion, identity/district reset, auth cleanup, and asset recovery pass' +
    (shots ? '\nScreenshots: ' + path.join(shots, 'city-desktop.png') + ' and ' + path.join(shots, 'city-mobile.png') : ''));
} finally {
  if (browser) await browser.close();
  await app.close();
}
