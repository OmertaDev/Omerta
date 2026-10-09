// Targeted City mode browser regression. Uses the real server and disposable pg-mem.
// Run: node test/city-scene-browser.js (or set CHROMIUM_PATH to a Chromium executable).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';

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
            const entry = { handle, destroyed: false };
            window.__cityHandles.push(entry);
            return { ...handle, destroy() { entry.destroyed = true; return handle.destroy(); } };
          } };
        },
      });
    }, playerToken);
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    return page;
  };

  const state = page => page.evaluate(() => window.__cityHandles.at(-1)?.handle.getState());
  const selectTab = async (page, tab) => {
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

  // Real input must move the player, and local walking must not submit a game action.
  const walkStart = requests.length;
  await canvas.focus();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(450);
  await page.keyboard.up('ArrowRight');
  const afterKeyboard = await state(page);
  assert(afterKeyboard.player.x > before.player.x + 20, 'Focused arrow input moves the avatar.');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowRight');
  const atBuilding = await state(page);
  const blockingBuilding = atBuilding.obstacles.filter(obstacle => obstacle.x > before.player.x
    && obstacle.y < before.player.y && obstacle.y + obstacle.height > before.player.y).sort((a, b) => a.x - b.x)[0];
  assert(blockingBuilding, 'A solid facade lies on the rehearsed movement ray.');
  assert(atBuilding.player.x < blockingBuilding.x, 'Arrow movement stops outside the solid building.');
  assert(atBuilding.player.x - afterKeyboard.player.x < 45, 'A held movement key cannot cross the building facade.');
  const box = await canvas.boundingBox();
  const goal = { x: 440, y: 440 };
  const camera = atBuilding.camera;
  await canvas.click({ position: {
    x: (goal.x - camera.x) * camera.zoom * box.width / camera.width,
    y: (goal.y - camera.y) * camera.zoom * box.height / camera.height,
  } });
  await page.waitForFunction(() => window.__cityHandles.at(-1).handle.getState().pathLength > 0);
  await page.waitForFunction(() => window.__cityHandles.at(-1).handle.getState().pathLength === 0);
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
  await page.waitForFunction(() => window.__cityHandles.at(-1).handle.getState().pathLength > 0);
  await page.locator('#map-mode-territory').focus();
  await page.waitForFunction(() => window.__cityHandles.at(-1).handle.getState().pathLength === 0);
  const afterBlur = await state(page);
  await page.waitForTimeout(250);
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

  // The original introduction is played at NPC doors, with a real committed branch and item award.
  await page.locator('[data-destination="fixer"]').click();
  await questAction(page, page.locator('[data-city-quest-action]:enabled').first());
  await page.waitForFunction(() => document.querySelector('.omerta-city__interaction')?.textContent.includes('Nico Bellini'));
  await questAction(page, page.locator('[data-city-quest-action]:enabled').first());
  const listen = page.locator('[data-city-quest-action]').filter({ hasText: 'Listen before you act' });
  await listen.waitFor({ state: 'visible' });
  await questAction(page, listen);
  await page.locator('[data-destination="workshop"]').click();
  await page.waitForFunction(() => document.querySelector('.omerta-city__interaction')?.textContent.includes('Ada Ferri'));
  if (shots) {
    await dismissCelebration(page);
    await page.locator('#city-scene-host').screenshot({ path: path.join(shots, 'city-quest.png'), style: sceneShotStyle });
  }
  await questAction(page, page.locator('[data-city-quest-action]:enabled').first());
  await page.locator('[data-destination="stories"]').click();
  await page.locator('[data-city-quest-action="explore"]').waitFor({ state: 'visible' });
  await questAction(page, page.locator('[data-city-quest-action="explore"]'));
  await page.waitForFunction(() => document.querySelector('.omerta-city__interaction')?.textContent.includes('Elena Serra'));
  await questAction(page, page.locator('[data-city-quest-action]:enabled').first());
  const caseReply = await app.inject({ method: 'GET', url: '/v1/worldgraph/mysteries/neighborhood-initiation', headers });
  assert.equal(caseReply.statusCode, 200, caseReply.body);
  assert.equal(caseReply.json().status, 'completed', 'Door interactions complete the persisted quest.');
  assert(caseReply.json().choices.some(choice => choice.choiceId === 'listen'), 'The first approach is remembered by the server.');
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
  await mobile.waitForTimeout(600);
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
  const touchStart = (await state(mobile)).player;
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
  await mobile.waitForTimeout(350);
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert((await state(mobile)).player.y > touchStart.y + 20, 'A real held touch moves the avatar.');
  const afterRelease = (await state(mobile)).player;
  await mobile.waitForTimeout(150);
  assert.deepEqual((await state(mobile)).player, afterRelease, 'Touch release stops movement.');
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
  await mobile.waitForTimeout(120);
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  const afterCancel = (await state(mobile)).player;
  await mobile.waitForTimeout(150);
  assert.deepEqual((await state(mobile)).player, afterCancel, 'Pointer cancellation stops held touch movement.');
  await touchSession.detach();
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
  await missingArt.locator('.omerta-city__canvas canvas').focus();
  await missingArt.keyboard.down('ArrowDown');
  await missingArt.waitForTimeout(350);
  await missingArt.keyboard.up('ArrowDown');
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
  await selectTab(delayed, 'streets');
  const engineLoaded = delayed.waitForResponse(response => new URL(response.url()).pathname === '/vendor/phaser.js');
  releaseEngine();
  await engineLoaded;
  await delayed.waitForTimeout(300);
  assert.equal(await delayed.locator('.omerta-city__canvas canvas').count(), 0, 'Delayed engine cannot mount onto an abandoned Map tab.');
  assert(await delayed.evaluate(() => window.__cityHandles.every(entry => entry.destroyed)), 'No live renderer handle survives a delayed tab departure.');

  // Even a missing scene module leaves existing gameplay navigation available.
  const missingScene = await newPage();
  await missingScene.route('**/city-scene.js*', route => route.abort());
  await missingScene.goto(base, { waitUntil: 'networkidle' });
  await missingScene.waitForSelector('#screen-main:not(.hidden)');
  await selectTab(missingScene, 'map');
  await missingScene.locator('#city-scene-retry').waitFor();
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
  assert.match(await missingEngine.locator('.omerta-city__status').textContent(), /unavailable/);
  assert.equal(await missingEngine.locator('.omerta-city__canvas canvas').count(), 0, 'Engine failure retains no broken canvas.');
  await missingEngine.locator('.omerta-city__destination[data-destination="stories"]').click();
  await missingEngine.locator('[data-city-open]').click();
  await missingEngine.waitForSelector('#tab-desk.on', { state: 'attached' });
  await missingEngine.unroute('**/vendor/phaser.js*');
  await selectTab(missingEngine, 'map');
  await waitForCity(missingEngine);
  assert.equal(await missingEngine.locator('.omerta-city__canvas canvas').count(), 1, 'Returning after an engine load failure retries the engine successfully.');

  // Authoritative identity transitions must never reuse another district or generation's pose.
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
  await page.locator('.omerta-city__canvas canvas').focus();
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(350);
  await page.keyboard.up('ArrowDown');
  assert((await state(page)).player.y > 400, 'The old generation has a distinct pose before invalidation.');
  const generationHandles = await page.evaluate(() => window.__cityHandles.length);
  await app.pool.query('UPDATE characters SET generation=generation+1 WHERE id=$1', [characterId]);
  const generationRead = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/projections/player');
  bus.emit('me:' + characterId, { type: 'city-browser-generation' });
  await generationRead;
  await page.waitForFunction(count => window.__cityHandles.length > count && window.__cityHandles.at(-1).handle.getState().ready, generationHandles);
  assert.deepEqual((await state(page)).player, { x: 430, y: 366 }, 'A new generation cannot reuse the prior generation pose.');
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
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/logout-all', headers: authHeaders })).statusCode, 200);
  await authPage.locator('#btn-refresh').click();
  await authPage.waitForSelector('#screen-auth:not(.hidden)');
  assert.equal(await authPage.locator('.omerta-city__canvas canvas').count(), 0, 'A revoked session disposes City and returns to sign-in.');
  assert.deepEqual(pageErrors, [], 'No uncaught browser errors.');
  for (const context of contexts) await context.close();
  console.log('city-scene-browser: generated art/fallbacks, movement/collision, live resource HUD, all gameplay destinations, real job receipt, saved return/reload poses, NPC quest/choice/keepsake/journal, mobile touch/release/cancel, reduced motion, identity/district reset, auth cleanup, and asset recovery pass' +
    (shots ? '\nScreenshots: ' + path.join(shots, 'city-desktop.png') + ' and ' + path.join(shots, 'city-mobile.png') : ''));
} finally {
  if (browser) await browser.close();
  await app.close();
}
