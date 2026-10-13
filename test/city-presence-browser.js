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
  const viewer = await player('Presence Viewer LongName');
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
  const newPage = async (viewport, { noResizeObserver = false, capturePlayer = false, playerToken = viewer.token } = {}) => {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block', isMobile: viewport.width <= 680, hasTouch: viewport.width <= 680 });
    if (noResizeObserver) await context.addInitScript(() => { window.ResizeObserver = undefined; });
    await context.addInitScript(token => {
      localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1');
      window.__presenceGames = []; let engine;
      Object.defineProperty(window, 'Phaser', { configurable: true, get: () => engine, set: value => {
        engine = value; const Game = value.Game;
        value.Game = new Proxy(Game, { construct(target, args) {
          const game = Reflect.construct(target, args); window.__presenceGames.push(game); return game;
        } });
      } });
      window.__presenceHandles = []; let api;
      Object.defineProperty(window, 'OmertaCityScene', { configurable: true, get: () => api, set: value => {
        // Capture after the root retry and the scene's awaited notice/finally
        // have settled, before an unrelated debounced board refresh can run.
        const observeRetry = retry => async (...params) => {
          const result = await retry(...params);
          if (window.__presenceHistoricalRetry) queueMicrotask(() => queueMicrotask(() => {
            window.__historicalRetryCompletion = { code: result.code, revision: window.__presenceRevision(),
              journal: window.__presenceModel.intel.map(entry => entry.sequence),
              completed: window.__presenceModel.objectives.filter(objective => objective.status === 'completed').length,
              notice: document.querySelector('.omerta-city__actor-notice')?.textContent };
          }));
          return result;
        };
        const observeOptions = options => typeof options.onEncounterRetry === 'function'
          ? { ...options, onEncounterRetry: observeRetry(options.onEncounterRetry) } : options;
        api = { ...value, mount(...args) {
          args[1] = observeOptions(args[1]);
          const handle = value.mount(...args), record = { handle, destroyed: false, character: { ...args[1].character }, retry: args[1].onEncounterRetry };
          window.__presenceHandles.push(record);
          window.__presenceModel = { ...args[1] };
          return { ...handle, update(options) { options = observeOptions(options); Object.assign(window.__presenceModel, options); const result = handle.update(options); window.__presenceReceiptHook?.(options); return result; },
            destroy() { record.destroyed = true; return handle.destroy(); } };
        } };
      } });
    }, playerToken);
    const page = await context.newPage(); await page.bringToFront();
    page.on('pageerror', error => errors.push(error.message));
    const playerReply = capturePlayer ? page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/projections/player' && reply.status() === 200) : null;
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
    return { page, context, requests, playerReply: playerReply ? await playerReply : null };
  };
  const state = page => page.evaluate(() => window.__presenceHandles.at(-1).handle.getState());
  const frames = page => page.evaluate(() => new Promise(resolve => { let observed = 0; const next = () => ++observed < 8 ? requestAnimationFrame(next) : resolve(); requestAnimationFrame(next); }));
  const mutations = requests => requests.filter(request => !['GET', 'HEAD'].includes(request.method)
    && !['/v1/screens', '/v1/commands/observations'].includes(request.path));
  const markerFrame = async page => {
    const { position, camera, actorPage, selectedActor, actorOpening, actorMarkers, pathLength } = await state(page);
    return { current: { position, camera, actorPage, selectedActor, actorOpening, actorMarkers, pathLength },
      box: await page.locator('.omerta-city__canvas canvas').boundingBox() };
  };
  const visibleMarker = ({ current, box }) => current.actorMarkers.find(marker => {
    const x = (marker.x - current.camera.x) * current.camera.zoom, y = (marker.y - 15 - current.camera.y) * current.camera.zoom;
    return x > 15 && x < box.width - 15 && y > 15 && y < box.height - 15;
  });
  const preparePhoneMarker = async (page, viewport) => {
    let view = await markerFrame(page);
    if (!visibleMarker(view)) {
      // Approximate UUID slots are not reserved near the phone camera. Use an
      // actual larger map and its real walking path before the phone tap proof.
      console.log('Phone actor navigation setup:', JSON.stringify({ viewport, ...view }));
      const handles = await page.evaluate(() => window.__presenceHandles.length), initial = view.current.position;
      if (await page.locator('.omerta-city__actor-dock:not([hidden])').count()) await page.locator('[data-city-actor-close]').click();
      await page.setViewportSize({ width: 1440, height: 1400 });
      await page.locator('#btn-player-view').click(); await frames(page);
      let wide = await markerFrame(page);
      assert.deepEqual(wide.current.position, initial, 'Resizing the same scene does not move the player.');
      assert.equal(await page.evaluate(() => window.__presenceHandles.length), handles);
      if (!visibleMarker(wide)) {
        // A fitted 680px map can still crop the far-right district slots. Walk
        // into the open upper street, then let the ordinary follow camera pan.
        await page.locator('.omerta-city__canvas canvas').focus();
        await page.keyboard.down('ArrowUp');
        try { await page.waitForFunction(() => window.__presenceHandles.at(-1).handle.getState().position.y <= 272, undefined, { timeout: 3000 }); }
        finally { await page.keyboard.up('ArrowUp'); }
        await page.keyboard.down('ArrowRight');
        try {
          await page.waitForFunction(() => {
            const current = window.__presenceHandles.at(-1).handle.getState(), box = document.querySelector('.omerta-city__canvas canvas').getBoundingClientRect();
            return current.actorMarkers.some(marker => {
              const x = (marker.x - current.camera.x) * current.camera.zoom, y = (marker.y - 15 - current.camera.y) * current.camera.zoom;
              return x > 15 && x < box.width - 15 && y > 15 && y < box.height - 15;
            });
          }, undefined, { timeout: 5000 });
        } finally { await page.keyboard.up('ArrowRight'); }
        await frames(page); wide = await markerFrame(page);
      }
      const actor = visibleMarker(wide);
      assert(actor, 'The actual larger map and normal camera pan must expose a published marker: ' + JSON.stringify(wide));
      await page.locator('.omerta-city__canvas canvas').tap({ position: {
        x: (actor.x - wide.current.camera.x) * wide.current.camera.zoom,
        y: (actor.y - 15 - wide.current.camera.y) * wide.current.camera.zoom } });
      assert((await state(page)).pathLength > 0, 'The real marker tap starts a walking path rather than relocating the player.');
      await page.waitForFunction(id => {
        const current = window.__presenceHandles.at(-1).handle.getState();
        return current.selectedActor === id && current.pathLength === 0;
      }, actor.id, { timeout: 15000 });
      const arrival = (await state(page)).position;
      assert(Math.hypot(arrival.x - actor.x, arrival.y - actor.y) < 42, 'The actual path arrives beside the inspected actor.');
      assert.notDeepEqual(arrival, initial);
      await page.setViewportSize(viewport); await page.locator('#btn-player-view').click(); await frames(page);
      await page.locator('[data-city-actor-close]').click(); await frames(page);
      view = await markerFrame(page);
      assert.deepEqual(view.current.position, arrival, 'Restoring the phone preserves the actual arrival pose.');
      assert.equal(await page.evaluate(() => window.__presenceHandles.length), handles, 'The same scene survives the navigation setup.');
    }
    assert.equal(await page.locator('.omerta-city__actor-dock:not([hidden])').count(), 0,
      'Both phone tap proofs start with the inspector closed.');
    assert(visibleMarker(view), 'At least one real actor marker is visible on the phone: ' + JSON.stringify({ viewport, ...view }));
    return view;
  };
  const assertDockFrame = async page => {
    await frames(page);
    const geometry = await page.evaluate(() => {
      const rect = node => node.getBoundingClientRect().toJSON(), hit = node => {
        const r = rect(node), target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return node === target || node.contains(target);
      };
      const canvas = document.querySelector('.omerta-city__canvas canvas'), hud = document.querySelector('.omerta-city__world-hud');
      const dock = document.querySelector('.omerta-city__actor-dock'), close = dock.querySelector('[data-city-actor-close]');
      const game = window.__presenceGames.findLast(game => game.canvas === canvas && game.scene?.getScenes(true).length), live = game.scene.getScenes(true)[0];
      const camera = live.cameras.main, box = rect(canvas);
      const avatar = [live.children.list.find(node => node.texture?.key === 'city-player' || node.texture?.key?.startsWith('city-art-player-')), live.data.get('playerName')].map(node => {
        const bounds = node.getBounds();
        return { top: (bounds.top - camera.worldView.y) * camera.zoom * box.height / camera.height,
          bottom: (bounds.bottom - camera.worldView.y) * camera.zoom * box.height / camera.height,
          left: (bounds.left - camera.worldView.x) * camera.zoom * box.width / camera.width,
          right: (bounds.right - camera.worldView.x) * camera.zoom * box.width / camera.width };
      });
      const controls = [...hud.querySelectorAll('[data-city-resource] dd'), hud.querySelector('.omerta-city__readiness')];
      const toast = document.querySelector('#toast'), toastBox = toast?.classList.contains('show') ? rect(toast) : null;
      const toastTop = toastBox && toastBox.bottom > 0 && toastBox.top < innerHeight ? toastBox.top : innerHeight;
      return { hud: rect(hud), canvas: box, dock: rect(dock), close: rect(close), header: rect(document.querySelector('#top')),
        engine: { width: canvas.width, height: canvas.height }, avatar, viewport: rect(document.querySelector('.omerta-city__viewport')),
        worldWidth: 960 * camera.zoom, height: innerHeight, toastTop, controlsVisible: controls.every(hit), closeVisible: hit(close),
        canvasVisible: [box.top + 3, box.top + box.height / 2, box.bottom - 3].every(y => document.elementFromPoint(box.left + box.width / 2, y) === canvas),
        name: live.data.get('playerName').text, expectedName: window.__presenceHandles.at(-1).character.name.slice(0, 26) };
    });
    const detail = JSON.stringify(geometry);
    assert(geometry.hud.top >= geometry.header.bottom && geometry.controlsVisible, 'Current resource values and readiness stay below sticky chrome: ' + detail);
    assert(geometry.canvasVisible && geometry.dock.bottom <= Math.min(geometry.height, geometry.toastTop) + 1, 'The map and reserved dock fit the usable window: ' + detail);
    assert(geometry.close.height >= 44 && geometry.closeVisible, 'The dock close control remains reachable: ' + detail);
    assert(Math.abs(geometry.engine.width - geometry.canvas.width) <= 1 && Math.abs(geometry.engine.height - geometry.canvas.height) <= 1, 'CSS and Phaser share actual viewport geometry: ' + detail);
    assert.equal(geometry.name, geometry.expectedName, 'Keeping the label visible must preserve the complete player name.');
    assert(geometry.avatar.every(bounds => bounds.top >= -1 && bounds.bottom <= geometry.canvas.height + 1 && bounds.left >= -1 && bounds.right <= geometry.canvas.width + 1), 'The complete actual avatar and name remain in the map: ' + detail);
    assert(geometry.viewport.width <= 960 && Math.abs(geometry.viewport.left - (page.viewportSize().width - geometry.viewport.width) / 2) <= 1, 'Wide Player maps are centered at the world width: ' + detail);
    assert(geometry.canvas.width <= geometry.worldWidth + 1 && Math.abs(geometry.canvas.left - (page.viewportSize().width - geometry.canvas.width) / 2) <= 1, 'The centered canvas does not extend into empty space beyond the world: ' + detail);
    return geometry;
  };
  const assertFallbackMap = async page => {
    const layout = await page.locator('.omerta-city__map-layer').evaluate(node => {
      const status = node.querySelector('.omerta-city__status'), style = getComputedStyle(status);
      return { minimum: getComputedStyle(node).minHeight, height: node.getBoundingClientRect().height,
        statusHeight: status.getBoundingClientRect().height, margins: parseFloat(style.marginTop) + parseFloat(style.marginBottom),
        canvasDisplay: getComputedStyle(node.querySelector('.omerta-city__canvas')).display };
    });
    assert.equal(layout.minimum, '0px', JSON.stringify(layout)); assert.equal(layout.canvasDisplay, 'none', JSON.stringify(layout));
    assert(layout.height <= layout.statusHeight + layout.margins + 1, 'Fallback reserves its real status message without an empty map strip: ' + JSON.stringify(layout));
  };
  const inspect = async (page, id) => {
    if (await page.locator('.omerta-city__actor-dock:not([hidden])').count()) await page.locator('[data-city-actor-close]').click();
    while (!await page.locator('[data-city-actors-previous]').isDisabled()) await page.locator('[data-city-actors-previous]').click();
    for (let index = 0; index < 40; index++) {
      const button = page.locator('[data-city-actor="' + id + '"]');
      if (await button.count()) {
        const network = [];
        const response = reply => { if (network.length < 16) network.push({ path: new URL(reply.url()).pathname.slice(0, 160), status: reply.status() }); };
        const failed = request => { if (network.length < 16) network.push({ path: new URL(request.url()).pathname.slice(0, 160), status: null, failed: true }); };
        page.on('response', response); page.on('requestfailed', failed);
        await page.evaluate(() => {
          window.__actorClickTrace = [];
          const observe = event => {
            try {
              if (window.__actorClickTrace.length >= 12) return;
              const current = window.__presenceHandles.at(-1), state = current?.handle?.getState();
              const target = event.target instanceof Element ? event.target : null;
              window.__actorClickTrace.push({ type: event.type, target: target?.tagName || null,
                actor: target?.closest('[data-city-actor]')?.dataset.cityActor || null,
                ready: state?.ready ?? null, selected: state?.selectedActor ?? null, opening: state?.actorOpening ?? null,
                handleCount: window.__presenceHandles.length, destroyed: current?.destroyed ?? null,
                unavailable: !state, scroll: scrollY, x: event.clientX, y: event.clientY });
            } catch {
              if (window.__actorClickTrace.length < 12) window.__actorClickTrace.push({ type: event.type, unavailable: true });
            }
          };
          for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, observe, { capture: true, passive: true });
          window.__actorClickCleanup = () => { for (const type of ['pointerdown', 'pointerup', 'click']) document.removeEventListener(type, observe, true); };
        });
        try {
          await button.click();
          await page.waitForFunction(id => window.__presenceHandles.at(-1).handle.getState().selectedActor === id, id);
        } catch (error) {
          try {
            const diagnostic = await page.evaluate(() => {
              const current = window.__presenceHandles.at(-1), state = current.handle.getState();
              const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON() || null;
              return { trace: window.__actorClickTrace, ready: state.ready, selected: state.selectedActor,
                opening: state.actorOpening, handleCount: window.__presenceHandles.length, destroyed: current.destroyed,
                scroll: scrollY, roster: [...document.querySelectorAll('[data-city-actor]')].slice(0, 24).map(node => node.dataset.cityActor),
                layout: { canvas: rect('.omerta-city__canvas canvas'), roster: rect('.omerta-city__actor-list'), dock: rect('.omerta-city__actor-dock') } };
            });
            error.message += '\nBounded actor click diagnostics: ' + JSON.stringify({ ...diagnostic, network });
          } catch { /* Preserve the primary click/selection error even if its page is unavailable. */ }
          throw error;
        } finally {
          page.off('response', response); page.off('requestfailed', failed);
          await page.evaluate(() => window.__actorClickCleanup?.()).catch(() => {});
        }
        return;
      }
      assert(!await page.locator('[data-city-actors-more]').isDisabled(), 'Every issued actor remains reachable through roster pagination.');
      await page.locator('[data-city-actors-more]').click();
      await page.waitForFunction(() => document.querySelector('[data-city-actors-more]')?.textContent === 'More people');
    }
    assert.fail('Actor pagination did not reach ' + id);
  };
  const walkToClubhouse = async page => {
    await page.locator('[data-city-world-tools]').click();
    await page.locator('[data-city-waypoint="clubhouse"]').click();
    await page.waitForFunction(() => {
      const current = window.__presenceHandles.at(-1).handle.getState();
      return current.pathLength === 0 && current.selectedVenue === 'clubhouse';
    }, undefined, { timeout: 15000 });
  };
  const assertCrowdedPlayerName = async page => {
    const handles = await page.evaluate(() => window.__presenceHandles.length), arrival = (await state(page)).position;
    const roster = await page.locator('.omerta-city__actor-list').textContent();
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport); await page.locator('#btn-player-view').click(); await frames(page);
      const samples = await page.evaluate(() => new Promise(resolve => {
        const values = [], next = () => {
          const canvas = document.querySelector('.omerta-city__canvas canvas');
          const live = window.__presenceGames.findLast(game => game.canvas === canvas && game.scene?.getScenes(true).length).scene.getScenes(true)[0];
          const name = live.data.get('playerName'), bounds = name.getBounds(), gap = 2 / live.cameras.main.zoom;
          const labels = ['THE CLUBHOUSE', 'DOORMAN · NPC', 'MECHANIC · NPC'].map(text => {
            const node = live.children.list.find(node => node.type === 'Text' && node.text === text), other = node.getBounds();
            return { text, visible: node.visible, overlap: other.right > bounds.left - gap && other.left < bounds.right + gap
              && other.bottom > bounds.top - gap && other.top < bounds.bottom + gap };
          });
          values.push({ position: window.__presenceHandles.at(-1).handle.getState().position, name: name.text, visible: name.visible, labels });
          if (values.length < 30) requestAnimationFrame(next); else resolve(values);
        }; requestAnimationFrame(next);
      }));
      for (const sample of samples) {
        assert.deepEqual(sample.position, arrival); assert.equal(sample.name, 'Presence Viewer LongName'); assert(sample.visible);
        for (const label of sample.labels.slice(0, 2)) {
          assert(label.overlap, 'The real Clubhouse arrival exercises an actual label collision: ' + JSON.stringify({ viewport, sample }));
          assert.equal(label.visible, false, 'Crowded canvas labels must yield to the complete player name: ' + JSON.stringify({ viewport, sample }));
        }
        assert.equal(sample.labels[2].overlap, false); assert.equal(sample.labels[2].visible, true, 'Unrelated NPC labels stay visible.');
      }
      assert.equal(await page.evaluate(() => window.__presenceHandles.length), handles);
      assert.equal(await page.locator('.omerta-city__actor-list').textContent(), roster, 'Decluttering retains the full accessible roster names and types.');
    }
    await page.locator('.omerta-city__canvas canvas').focus(); await page.keyboard.down('ArrowDown');
    try { await page.waitForFunction(() => window.__presenceHandles.at(-1).handle.getState().position.y >= 280, undefined, { timeout: 3000 }); }
    finally { await page.keyboard.up('ArrowDown'); }
    const clear = (await state(page)).position; assert.notDeepEqual(clear, arrival);
    await frames(page);
    assert(await page.evaluate(() => {
      const canvas = document.querySelector('.omerta-city__canvas canvas');
      const live = window.__presenceGames.findLast(game => game.canvas === canvas && game.scene?.getScenes(true).length).scene.getScenes(true)[0];
      return ['THE CLUBHOUSE', 'DOORMAN · NPC'].every(text => live.children.list.find(node => node.type === 'Text' && node.text === text).visible);
    }), 'Venue and NPC titles reappear after real walking clears the player name.');
    assert.equal(await page.locator('.omerta-city__actor-list').textContent(), roster);
    await page.setViewportSize({ width: 1440, height: 1400 }); await page.locator('#btn-player-view').click(); await frames(page);
    assert.deepEqual((await state(page)).position, clear); assert.equal(await page.evaluate(() => window.__presenceHandles.length), handles);
    const view = await markerFrame(page), marker = view.current.actorMarkers.find(marker => {
      const x = (marker.x - view.current.camera.x) * view.current.camera.zoom, y = (marker.y - 15 - view.current.camera.y) * view.current.camera.zoom;
      return x > 15 && x < view.box.width - 15 && y > 15 && y < view.box.height - 15
        && Math.hypot(marker.x - clear.x, marker.y - clear.y) > 54;
    });
    assert(marker, 'The actual larger map exposes a published actor for the crowded-name interaction proof: ' + JSON.stringify(view));
    await page.locator('.omerta-city__canvas canvas').tap({ position: {
      x: (marker.x - view.current.camera.x) * view.current.camera.zoom,
      y: (marker.y - 15 - view.current.camera.y) * view.current.camera.zoom } });
    assert((await state(page)).pathLength > 0);
    await page.waitForFunction(id => {
      const current = window.__presenceHandles.at(-1).handle.getState();
      return current.selectedActor === id && current.pathLength === 0;
    }, marker.id, { timeout: 15000 });
    await frames(page);
    const publicLabel = await page.evaluate(marker => {
      const canvas = document.querySelector('.omerta-city__canvas canvas');
      const live = window.__presenceGames.findLast(game => game.canvas === canvas && game.scene?.getScenes(true).length).scene.getScenes(true)[0];
      const name = live.data.get('playerName'), bounds = name.getBounds(), gap = 2 / live.cameras.main.zoom;
      const label = live.children.list.find(node => node.type === 'Text' && node.x === marker.x && node.y === marker.y - 73), other = label.getBounds();
      const sprite = live.children.list.find(node => node.type === 'Sprite' && node.x === marker.x && node.y === marker.y);
      const ring = live.children.list.find(node => node.type === 'Graphics' && node.x === marker.x && node.y === marker.y && node.depth === marker.y - 1);
      return { visible: label.visible, overlap: other.right > bounds.left - gap && other.left < bounds.right + gap
        && other.bottom > bounds.top - gap && other.top < bounds.bottom + gap,
        sprite: { x: sprite.x, y: sprite.y, visible: sprite.visible }, ring: { x: ring.x, y: ring.y, visible: ring.visible } };
    }, marker);
    assert(publicLabel.overlap, 'Real walking arrives beside an actual overlapping public actor label.');
    assert.equal(publicLabel.visible, false, 'Actual public marker labels also yield to the full player name.');
    assert.deepEqual(publicLabel.sprite, { x: marker.x, y: marker.y, visible: true });
    assert.deepEqual(publicLabel.ring, { x: marker.x, y: marker.y, visible: true });
    const publicActor = await page.evaluate(id => window.__presenceModel.actors.find(actor => actor.id === id), marker.id);
    const actorCaption = publicActor.name || (publicActor.kind === 'agent' ? 'Unknown agent' : publicActor.kind === 'player' ? 'Unknown player' : 'Unnamed resident');
    assert((await page.locator('[data-city-actor="' + marker.id + '"]').textContent()).includes(actorCaption));
    assert((await page.locator('.omerta-city__actor-body').textContent()).includes(actorCaption), 'The full authorized actor caption remains accessible.');
    const opening = (await state(page)).actorOpening, publicPose = (await state(page)).position;
    const tapped = await markerFrame(page);
    await page.locator('.omerta-city__canvas canvas').tap({ position: {
      x: (marker.x - tapped.current.camera.x) * tapped.current.camera.zoom,
      y: (marker.y - 15 - tapped.current.camera.y) * tapped.current.camera.zoom } });
    assert.equal((await state(page)).actorOpening, opening + 2, 'A hidden label does not change the actual actor sprite hit priority.');
    assert.deepEqual((await state(page)).position, publicPose);
    await page.locator('[data-city-actor-close]').click(); await frames(page);
    await walkToClubhouse(page);
    if (await page.locator('.omerta-city__actor-dock:not([hidden])').count()) await page.locator('[data-city-actor-close]').click();
    if (await page.locator('.omerta-city__interaction:not([hidden])').count()) await page.locator('[data-city-close]').click();
    assert.equal(await page.evaluate(() => window.__presenceHandles.length), handles);
  };
  const assertPlayerNameEdge = async (page, actorId) => {
    // The preceding real touch gesture may leave an ordinary walking path active.
    // Let that path finish naturally before measuring resize-only pose preservation.
    await page.evaluate(() => new Promise((resolve, reject) => {
      const deadline = performance.now() + 15000;
      let previous = null;
      const observe = () => {
        const current = window.__presenceHandles.at(-1).handle.getState(), pose = current.position;
        if (current.pathLength === 0 && previous?.pathLength === 0
            && pose.x === previous.position.x && pose.y === previous.position.y
            && pose.facing === previous.position.facing) return resolve();
        if (performance.now() >= deadline) return reject(new Error('Touch-gesture walking did not become stationary before the resize test.'));
        previous = { pathLength: current.pathLength, position: { ...pose } };
        requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    }));
    const handles = await page.evaluate(() => window.__presenceHandles.length), initial = (await state(page)).position;
    await page.setViewportSize({ width: 1440, height: 1400 });
    await page.locator('#btn-player-view').click(); await frames(page);
    assert.deepEqual((await state(page)).position, initial, 'Preparing the larger map preserves the current pose.');
    assert((await state(page)).destinations.some(venue => venue.id === 'clubhouse'));
    await walkToClubhouse(page);
    const street = (await state(page)).position;
    assert(street.y > 202 && street.y < 286, 'The real authored waypoint arrives on the open upper street.');
    if (await page.locator('.omerta-city__actor-dock:not([hidden])').count()) await page.locator('[data-city-actor-close]').click();
    if (await page.locator('.omerta-city__interaction:not([hidden])').count()) await page.locator('[data-city-close]').click();
    await assertCrowdedPlayerName(page);
    await page.locator('.omerta-city__canvas canvas').focus();
    await page.keyboard.down('ArrowRight');
    try {
      await page.waitForFunction(() => {
        const current = window.__presenceHandles.at(-1).handle.getState();
        return current.position.x >= current.world.width - 64;
      }, undefined, { timeout: 5000 });
    } finally { await page.keyboard.up('ArrowRight'); }
    const edge = (await state(page)).position;
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('#btn-player-view').click(); await inspect(page, actorId); await assertDockFrame(page);
    assert.equal(await page.evaluate(() => window.__presenceHandles.length), handles);
    assert.deepEqual((await state(page)).position, edge, 'Phone inspection keeps the real edge arrival pose.');
    const samples = await page.evaluate(() => new Promise(resolve => {
      const values = [], next = () => {
        const canvas = document.querySelector('.omerta-city__canvas canvas'), box = canvas.getBoundingClientRect();
        const game = window.__presenceGames.findLast(game => game.canvas === canvas && game.scene?.getScenes(true).length), live = game.scene.getScenes(true)[0];
        const camera = live.cameras.main, name = live.data.get('playerName'), bounds = name.getBounds();
        values.push({ position: window.__presenceHandles.at(-1).handle.getState().position, text: name.text, width: box.width,
          left: (bounds.left - camera.worldView.x) * camera.zoom * box.width / camera.width,
          right: (bounds.right - camera.worldView.x) * camera.zoom * box.width / camera.width });
        if (values.length < 30) requestAnimationFrame(next); else resolve(values);
      }; requestAnimationFrame(next);
    }));
    for (const sample of samples) {
      assert.deepEqual(sample.position, edge);
      assert.equal(sample.text, 'Presence Viewer LongName'); assert.equal(sample.text.length, 24);
      assert(sample.left >= -1 && sample.right <= sample.width + 1,
        'The complete maximum-length player name stays in the rendered viewport at the reachable world edge: ' + JSON.stringify(sample));
    }
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
  const unknownPerson = await page.evaluate(id => window.__presenceModel.actors.find(actor => actor.id === id), human.id);
  assert.equal(unknownPerson.name, null); assert.equal(unknownPerson.level, null); assert.equal(unknownPerson.online, null);
  assert((await page.locator('.omerta-city__actor-body').textContent()).includes('Unknown player'));
  assert(!(await page.locator('.omerta-city__actor-body').textContent()).includes(hostileName), 'Read-only inspection hides the unearned live name.');
  assert(!(await page.locator('.omerta-city__actor-body').textContent()).includes('Level 0'), 'An unknown level is not rendered as a fabricated zero.');
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
  // Earlier legitimate reads can still publish board 3. Commit board 4 only
  // after the replay has installed its newer-read barrier and that real GET
  // is queued, so an unheld background read cannot win board 4 prematurely.
  let releaseFourthEncounter, queuedNewRead, releaseNewRead, startedNewRead;
  const fourthEncounterGate = new Promise(resolve => { releaseFourthEncounter = resolve; });
  const newReadQueued = new Promise(resolve => { queuedNewRead = resolve; });
  const newReadGate = new Promise(resolve => { releaseNewRead = resolve; }), newReadStarted = new Promise(resolve => { startedNewRead = resolve; });
  await page.route('**/v1/city/intel', async route => {
    if (await page.evaluate(() => window.__holdHistoricalRead === true)) {
      queuedNewRead(); await fourthEncounterGate;
      const reply = await route.fetch(); assert.equal((await reply.json()).progress.totalEncounters, 4);
      startedNewRead(); await newReadGate; await route.fulfill({ response: reply });
    } else await route.continue();
  });
  await page.evaluate(() => {
    window.__presenceReceiptHook = options => {
      if (options.encounterReceipt?.state !== 'success') return;
      window.__presenceReceiptHook = null; window.__holdHistoricalRead = true; window.__presenceHistoricalRetry = true;
      window.__pendingHistoricalRead = window.__presenceRead();
      window.__historicalReadRevision = window.__presenceRevision();
    };
  });
  const recovered = page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/city/encounters/' + npc.id);
  await page.locator('[data-city-encounter-retry]').click(); const recoveredReply = await recovered;
  assert.equal(recoveredReply.status(), 200); assert.deepEqual(await recoveredReply.json(), lostBody);
  assert.equal(recoveredReply.request().headers()['idempotency-key'], lostRequest.key);
  assert.deepEqual(recoveredReply.request().postDataJSON(), lostRequest.body);
  assert.equal(attempts, 2, 'The lost request and its same-key replay are the only browser encounter attempts.');
  await page.unroute('**/v1/city/encounters/' + npc.id);
  await page.waitForFunction(() => window.__historicalRetryCompletion);
  const retryCompletion = await page.evaluate(() => window.__historicalRetryCompletion);
  assert.equal(retryCompletion.code, 200);
  assert(retryCompletion.notice?.startsWith('Intel recorded:'), 'The replay boundary follows the scene notice and action cleanup.');
  assert.equal(retryCompletion.revision, await page.evaluate(() => window.__historicalReadRevision), 'An old replay receipt does not invalidate the newer read ticket.');
  assert.deepEqual(retryCompletion.journal, [3, 2, 1], 'Historical receipt retains the exact winning journal after its model effects settle.');
  assert.equal(retryCompletion.completed, 1);
  await page.evaluate(() => { window.__presenceHistoricalRetry = false; });
  await newReadQueued;
  const latest = await otherClientEncounter(agent.id);
  assert.equal(latest.progress.totalEncounters, 4); assert.equal(latest.progress.completedObjectives, 2);
  releaseFourthEncounter();
  await newReadStarted;
  assert.equal(await page.evaluate(() => window.__presenceModel.intel.length), 3, 'Historical receipt cannot roll back the winning journal.');
  assert.equal(await page.evaluate(() => window.__presenceModel.objectives.filter(objective => objective.status === 'completed').length), 1);
  await page.evaluate(() => { window.__holdHistoricalRead = false; }); releaseNewRead();
  await page.evaluate(() => window.__pendingHistoricalRead); await page.unroute('**/v1/city/intel');
  await page.waitForFunction(() => window.__presenceModel.intel.length === 4);
  assert.equal(await page.evaluate(() => window.__presenceModel.objectives.filter(objective => objective.status === 'completed').length), 2);
  assert.equal((await readIntel()).progress.totalEncounters, 4, 'Same-key replay adds no phantom encounter.');
  const introducedHuman = await encounter(page, human.id);
  assert.equal(introducedHuman.body.encounteredActor.name, hostileName);
  await app.pool.query('UPDATE characters SET name=$2,respect=200000 WHERE id=$1', [human.id, 'Hidden live rename']);
  const readsBeforePrivacy = mutations(requests).length;
  await page.evaluate(() => window.__presenceRead());
  await inspect(page, human.id);
  const learnedPerson = await page.evaluate(id => window.__presenceModel.actors.find(actor => actor.id === id), human.id);
  assert.equal(learnedPerson.name, hostileName); assert.equal(learnedPerson.level, introducedHuman.body.encounteredActor.level);
  assert.equal(learnedPerson.observedAt, introducedHuman.body.intel.collectedAt);
  assert.equal(learnedPerson.source, 'city_encounter'); assert.equal(learnedPerson.online, null); assert.equal(learnedPerson.gangTag, null);
  const learnedText = await page.locator('.omerta-city__actor-body').textContent();
  assert(learnedText.includes(hostileName) && learnedText.includes('Last learned:') && learnedText.includes('recorded facts, not live tracking'));
  assert(!learnedText.includes('Hidden live rename'), 'An actual winning GET retains the observer\'s dated notebook facts.');
  assert.equal(await page.locator('.omerta-city__actor-body img').count(), 0);
  assert.equal(await page.evaluate(() => window.__actorInjection), undefined);
  assert.equal(mutations(requests).length, readsBeforePrivacy, 'Reading earned facts submits no encounter or other gameplay action.');
  await app.pool.query('UPDATE characters SET name=$2,respect=0 WHERE id=$1', [human.id, hostileName]);
  await encounter(page, agent.id); await encounter(page, human.id);
  const board = await readIntel();
  assert.equal(board.progress.totalEncounters, 7);
  assert.equal(board.progress.completedObjectives, 3);
  assert.equal(new Set(board.journal.map(entry => entry.id)).size, 7);
  assert.deepEqual((await state(page)).position, pose);
  await page.locator('[data-city-actor-close]').click(); await page.locator('[data-city-intel-open]').click();
  // Actor/journal panels reserve desktop space rather than scrolling resource
  // values under sticky chrome, including a short landscape window.
  const desktopReads = requests.length;
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1366, height: 600 }]) {
    await page.setViewportSize(viewport);
    await page.locator('[data-city-actor-close]').click(); await frames(page);
    const closed = await page.locator('.omerta-city__canvas canvas').boundingBox();
    const closedFit = await page.locator('.omerta-city__canvas').evaluate(node => node.style.getPropertyValue('--city-map-height'));
    assert(Number.isFinite(parseFloat(closedFit)) && parseFloat(closedFit) >= 96, 'The closed Player map has a measured desktop fit.');
    await page.locator('[data-city-intel-open]').click();
    await assertDockFrame(page);
    assert.deepEqual((await state(page)).position, pose); assert.equal(await page.evaluate(() => window.__presenceHandles.length), handles);
    const shots = process.env.CITY_PRESENCE_SHOTS;
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, 'city-people-journal-' + viewport.width + '.png') }); }
    await inspect(page, npc.id); await assertDockFrame(page);
    const button = await page.locator('[data-city-encounter]').evaluate(node => { const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { height: r.height, visible: node === hit || node.contains(hit) }; });
    assert(button.height >= 44 && button.visible, JSON.stringify(button));
    if (shots) await page.screenshot({ path: path.join(shots, 'city-people-actor-' + viewport.width + '.png') });
    await page.locator('[data-city-actor-close]').click(); await frames(page);
    assert.equal(await page.locator('.omerta-city__canvas').evaluate(node => node.style.getPropertyValue('--city-map-height')), closedFit, 'Closing restores the original measured desktop map fit.');
    const restored = await page.locator('.omerta-city__canvas canvas').evaluate(node => ({ ...node.getBoundingClientRect().toJSON(), engineWidth: node.width, engineHeight: node.height }));
    assert(Math.abs(restored.width - closed.width) <= 1 && Math.abs(restored.height - closed.height) <= 1, 'Closing restores actual original desktop dimensions: ' + JSON.stringify({ closed, restored }));
    assert(Math.abs(restored.engineWidth - restored.width) <= 1 && Math.abs(restored.engineHeight - restored.height) <= 1, 'Closing restores matching Phaser dimensions.');
    assert.deepEqual((await state(page)).position, pose);
    await page.locator('[data-city-intel-open]').click();
  }
  assert.deepEqual(mutations(requests.slice(desktopReads)), [], 'Desktop journal/actor opening and resizing never submit gameplay.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-city-actor-close]').click(); await page.locator('[data-city-intel-open]').click();
  const noObserver = await newPage({ width: 1366, height: 600 }, { noResizeObserver: true });
  const noObserverPose = (await state(noObserver.page)).position;
  await noObserver.page.locator('[data-city-intel-open]').click(); await assertDockFrame(noObserver.page);
  await inspect(noObserver.page, npc.id); await assertDockFrame(noObserver.page);
  assert.deepEqual((await state(noObserver.page)).position, noObserverPose);
  assert.deepEqual(mutations(noObserver.requests), []);
  await noObserver.context.close();
  await page.bringToFront();
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
  await page.evaluate(() => {
    const canvas = document.querySelector('.omerta-city__canvas canvas');
    window.__retiredNameCamera = window.__presenceGames.findLast(game => game.canvas === canvas && game.scene?.getScenes(true).length).scene.getScenes(true)[0].cameras.main;
  });
  assert.equal(await page.evaluate(() => window.__retiredNameCamera.listenerCount('followupdate')), 1);
  await app.pool.query('UPDATE characters SET generation=generation+1 WHERE id=$1', [viewer.id]);
  await page.locator('#btn-refresh').click();
  await page.waitForFunction(generation => window.__presenceHandles.at(-1)?.character.generation === generation
    && window.__presenceHandles.at(-1).handle.getState().ready, retired + 1, { timeout: 20000 });
  assert(await page.evaluate(() => window.__presenceHandles.at(-2).destroyed));
  assert.equal(await page.evaluate(() => window.__retiredNameCamera.listenerCount('followupdate')), 0, 'The retired scene removes its player-name placement listener.');
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
    // Health regenerates 20/min. Each phone gets its own bounded accrual hold,
    // so this warning/geometry scenario does not depend on earlier test speed.
    const previousVitals = (await app.pool.query('SELECT health,energy,last_accrued_at,cash,bank FROM characters WHERE id=$1', [viewer.id])).rows[0];
    await app.pool.query('UPDATE characters SET health=22,energy=31,last_accrued_at=$2 WHERE id=$1', [viewer.id, new Date(Date.now() + 600000)]);
    const mobile = await newPage(viewport, { capturePlayer: true }), phone = mobile.page;
    const playerBody = await mobile.playerReply.json(), projectedPlayer = playerBody.player?.character || playerBody.player;
    assert.equal(projectedPlayer.health, 22, 'The real winning phone player GET carries the controlled low-health fixture.');
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
    assert.equal((await state(phone)).resources.health, projectedPlayer.health, 'The scene health comes from the actual phone player projection.');
    assert.equal((await phone.locator('[data-city-resource="health"] dd').textContent()).replace(/\s+/g, ''), '22/100');
    assert.match(await phone.locator('.omerta-city__readiness').textContent(), /LOW HEALTH/);
    const shots = process.env.CITY_PRESENCE_SHOTS;
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await phone.screenshot({ path: path.join(shots, 'city-people-' + viewport.width + '.png') }); }
    const beforeNavigation = mutations(mobile.requests).length;
    // Either phone's 96px inspector map can legitimately crop every person.
    // Search bounded real roster pages on the closed map first. If no page
    // intersects the camera, use actual walking to prepare the same phone tap.
    await phone.locator('[data-city-actor-close]').click(); await frames(phone);
    // inspect(npc) can leave the roster on a later page. Search the complete
    // bounded real roster, including the earlier pages, for the touch target.
    while (!await phone.locator('[data-city-actors-previous]').isDisabled()) await phone.locator('[data-city-actors-previous]').click();
    for (let rosterPage = 0; rosterPage < 40; rosterPage++) {
      if (visibleMarker(await markerFrame(phone)) || await phone.locator('[data-city-actors-more]').isDisabled()) break;
      await phone.locator('[data-city-actors-more]').click();
      await phone.waitForFunction(() => document.querySelector('[data-city-actors-more]')?.textContent === 'More people');
      await frames(phone);
    }
    const view = await preparePhoneMarker(phone, viewport), current = view.current, marker = visibleMarker(view);
    assert.equal(mutations(mobile.requests).length, beforeNavigation, 'Marker navigation setup performs no gameplay POST.');
    const beforeTouch = mutations(mobile.requests).length;
    const opening = current.actorOpening;
    await phone.locator('.omerta-city__canvas canvas').tap({ position: { x: (marker.x - current.camera.x) * current.camera.zoom, y: (marker.y - 15 - current.camera.y) * current.camera.zoom } });
    await phone.waitForFunction(id => window.__presenceHandles.at(-1).handle.getState().selectedActor === id, marker.id, { timeout: 15000 });
    assert.equal((await state(phone)).actorOpening, opening + 1, 'One real tap opens exactly one inspector.');
    if (viewport.width === 375) await assertDockFrame(phone);
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
      await phone.locator('.omerta-city__actor-list').evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const outside = await phone.evaluate(() => {
        const list = document.querySelector('.omerta-city__actor-list'), rect = list.getBoundingClientRect();
        const x = rect.left + rect.width / 2, y = Math.min(640, rect.bottom - 20, innerHeight - 130), hit = document.elementFromPoint(x, y);
        return { x, y, scroll: scrollY, rosterHit: list.contains(hit), canvasHit: hit?.tagName === 'CANVAS' };
      });
      assert(outside.rosterHit && !outside.canvasHit, 'Native outside scrolling starts on the actual visible roster: ' + JSON.stringify(outside));
      const outsidePose = (await state(phone)).position;
      assert.equal((await state(phone)).pathLength, 0);
      const touch = await phone.context().newCDPSession(phone);
      try {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: outside.x, y: outside.y }] });
        for (const offset of [55, 110, 165, 220]) { await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: outside.x, y: outside.y - offset }] }); await frames(phone); }
      } finally { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach(); }
      await phone.waitForFunction(before => scrollY > before + 20, outside.scroll);
      assert.deepEqual((await state(phone)).position, outsidePose, 'Native roster scrolling does not move the player.');
      assert.equal((await state(phone)).pathLength, 0, 'Native roster scrolling cannot start a map path.');
      assert.equal(mutations(mobile.requests).length, beforeTouch, 'Native touch scrolling remains usable outside the canvas.');
      await assertPlayerNameEdge(phone, npc.id);
      assert.equal(mutations(mobile.requests).length, beforeTouch, 'Walking to the label edge and inspecting remain read-only.');
    }
    await mobile.context.close();
    const afterPhone = (await app.pool.query('SELECT cash,bank FROM characters WHERE id=$1', [viewer.id])).rows[0];
    assert.equal(Number(afterPhone.cash), Number(previousVitals.cash)); assert.equal(Number(afterPhone.bank), Number(previousVitals.bank));
    await app.pool.query('UPDATE characters SET health=$2,energy=$3,last_accrued_at=$4 WHERE id=$1', [viewer.id, previousVitals.health, previousVitals.energy, previousVitals.last_accrued_at]);
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
  await assertFallbackMap(fallback);
  await fallback.setViewportSize({ width: 1366, height: 600 });
  await fallback.locator('[data-city-actor-close]').click(); await fallback.locator('[data-city-actor]').first().click();
  await assertFallbackMap(fallback);
  await fallback.setViewportSize({ width: 375, height: 812 });
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

  // Property signs are real directory records, not live character positions.
  const propertyViewer = await player('Property Explorer');
  for (const [owner, street] of [[propertyViewer, 'Reader Home'], [human, 'Legacy <b> Lane'], [agent, 'Agent Stead'], [npc, 'Resident Row']]) {
    await app.pool.query('INSERT INTO street_deeds(account_id,name,name_lc,district,corner_at) VALUES($1,$2,$3,$4,now())',
      [owner.account_id, street, street.toLowerCase(), 'docks']);
  }
  await app.pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [agent.id, 'brick']);
  for (const viewport of [{ width: 1366, height: 768 }, { width: 375, height: 812 }]) {
    const property = await newPage(viewport, { playerToken: propertyViewer.token }), p = property.page;
    await p.waitForFunction(() => window.__presenceHandles.at(-1).handle.getState().homes?.length === 4);
    const homes = (await state(p)).homes, record = await p.evaluateHandle(() => window.__presenceHandles.at(-1));
    const agentHome = homes.find(home => home.key === 'agent stead');
    assert.equal(agentHome.owner.kind, 'agent');
    assert.deepEqual(Object.keys(agentHome.owner).sort(), ['kind', 'name'], 'Property facts expose no steward position or private account identifier.');
    assert.equal((await state(p)).actorMarkers.some(marker => marker.id === agent.id), false, 'An away agent has a property marker without a fabricated live-person marker.');
    assert.equal(new Set(homes.map(home => home.key)).size, 4);
    const beforeProperty = mutations(property.requests).length;
    await p.locator('[data-city-home="legacy <b> lane"]').click();
    await p.waitForFunction(() => window.__presenceHandles.at(-1).handle.getState().selectedHome === 'legacy <b> lane'
      && window.__presenceHandles.at(-1).handle.getState().pathLength === 0);
    assert.equal(await p.locator('.omerta-city__actor-body h4').innerText(), 'Legacy <b> Lane');
    assert((await p.locator('.omerta-city__actor-body').innerText()).includes(hostileName));
    assert.equal(await p.locator('.omerta-city__actor-body img, .omerta-city__actor-body b').count(), 0, 'Legacy street markup and hostile owner names remain literal text.');
    assert.equal(await p.evaluate(() => window.__actorInjection), undefined);
    assert.equal(await p.locator('[data-city-home-action="hideout"]').count(), 0);
    const homePose = (await state(p)).position, currentHomes = JSON.stringify((await state(p)).homes);
    const board = (await app.inject({ method: 'GET', url: '/v1/city/homes?district=docks', headers: propertyViewer.headers })).json();
    await p.evaluate(board => window.__presenceHandles.at(-1).handle.update({ worldHomes: { ...board, viewer: { ...board.viewer, generation: board.viewer.generation + 1 } } }), board);
    assert.equal(JSON.stringify((await state(p)).homes), currentHomes, 'A stale generation cannot replace accepted physical properties.');
    const remote = (await app.inject({ method: 'GET', url: '/v1/city/homes?district=brick', headers: propertyViewer.headers })).json();
    await p.evaluate(board => window.__presenceHandles.at(-1).handle.update({ worldHomes: board }), remote);
    assert.equal(JSON.stringify((await state(p)).homes), currentHomes, 'A remote district directory never replaces the current physical neighborhood.');
    assert.deepEqual((await state(p)).position, homePose);
    assert(await p.evaluate(record => window.__presenceHandles.at(-1) === record && !record.destroyed, record));
    await p.locator('[data-city-actor-close]').click();
    await p.locator('[data-city-world-map]').click();
    await p.waitForFunction(() => window.__presenceHandles.at(-1).handle.getState().worldUI.mapView === 'world');
    assert.deepEqual((await state(p)).position, homePose, 'Atlas inspection preserves the actual local walking pose.');
    assert.equal(mutations(property.requests).length, beforeProperty, 'Property and district inspection issue no gameplay command.');
    await property.context.close();
  }
  assert.deepEqual(errors, []);
  console.log('city-presence-browser: public types/pagination/escaping, read-only inspection, fresh intel/objectives/replay, pose, queued cancellation, dispatched receipt and mobile touch/keyboard geometry pass');
} finally { await browser?.close(); await app.close(); }
