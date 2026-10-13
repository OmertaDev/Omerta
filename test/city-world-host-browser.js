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
const fixtureCleanup = [];
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
      window.__worldGames = []; window.__worldHandles = []; window.__worldReads = []; window.__worldReadResults = []; window.__worldNavigations = []; window.__worldUpdates = [];
      let engine, module;
      Object.defineProperty(window, 'Phaser', { configurable: true, get: () => engine, set: value => {
        engine = value; value.Game = new Proxy(value.Game, { construct(target, args) {
          const game = Reflect.construct(target, args); window.__worldGames.push(game); return game;
        } });
      } });
      Object.defineProperty(window, 'OmertaCityScene', { configurable: true, get: () => module, set: value => {
        module = { ...value, mount(...args) {
          const read = args[1].onWorldRead, navigate = args[1].onNavigate;
          args[1] = { ...args[1], onNavigate: (tab, context) => {
            window.__worldNavigations.push({ tab, context: structuredClone(context) }); return navigate(tab, context);
          }, onWorldRead: async (kind, context) => {
            window.__worldReads.push(kind);
            const resultRecord = { kind, districtId: context.districtId, cursor: context.cursor, scene: window.__worldHandles.length, settled: false,
              ownerCurrentAtStart: context.isCurrent(), scope: window.__worldReadScope?.() };
            window.__worldReadResults.push(resultRecord);
            const result = await read(kind, context);
            Object.assign(resultRecord, { code: result?.code, ignored: result?.ignored === true, scopeAfter: window.__worldReadScope?.() });
            // The module's await/render continuation settles before this marker.
            queueMicrotask(() => queueMicrotask(() => { resultRecord.settled = true; resultRecord.current = context.isCurrent(); }));
            return result;
          } };
          const handle = value.mount(...args), record = { handle, destroyed: false };
          window.__worldHandles.push(record);
          return { ...handle, update(next) {
            handle.update(next);
            const state = handle.getState(); window.__worldUpdates.push({ scope: window.__worldReadScope?.(),
              hydrationDistrict: next.worldHomes?.districtId, hydrationCount: next.worldHomes?.homes?.length,
              homes: state.homes, position: state.position });
          }, destroy() { record.destroyed = true; handle.destroy(); } };
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
    await page.route(base + '/', async route => {
      const reply = await route.fetch(), html = await reply.text(), anchor = '  async function readCityWorld(kind, context = {}) {';
      assert.equal(html.split(anchor).length, 2);
      await route.fulfill({ response: reply, body: html.replace(anchor,
        '  window.__worldReadScope = () => ({ key: cityIdentity(), epoch: projections.snapshot().epoch, scene: _citySceneEpoch,\n'
        + '    current: !!_cityWorldData && _cityWorldData.key === cityIdentity() && projections.current(_cityWorldData.stamp), tickets: { ..._cityWorldData?.tickets },\n'
        + '    consent: _cityWorldData?.social?.preferences?.chatEnabled });\n' + anchor) });
    });
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
  const revealPlaces = async page => {
    const overview = page.locator('.omerta-city__overview');
    if (!await overview.isVisible() || await overview.getAttribute('open') !== null) return;
    const native = control => page.viewportSize().width <= 680 ? control.tap() : control.click();
    for (const selector of ['[data-city-world-close]','[data-city-actor-close]','[data-city-training-close]','[data-city-close]']) {
      const close = page.locator(selector); if (await close.isVisible()) await native(close);
    }
    await native(overview.locator('summary'));
  };
  const frames = page => page.evaluate(() => new Promise(resolve => { let count = 0; const step = () => ++count >= 8 ? resolve() : requestAnimationFrame(step); requestAnimationFrame(step); }));
  const mutations = requests => requests.filter(request => !['GET', 'HEAD'].includes(request.method) && !['/v1/screens', '/v1/commands/observations'].includes(request.path));
  const bounded = (promise, label) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Timed out waiting for ' + label)), 30000);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
  const dismissCine = async page => { if (await page.locator('#cine.on').count()) await page.locator('#cine.on').evaluate(node => node.click()); };
  const panel = async (page, kind) => {
    if (!await page.locator('.city-world__dock').isVisible()) await page.locator('[data-city-world-tools]').click();
    if (await page.locator('.city-world__tabs').getAttribute('hidden') !== null) await page.locator('[data-city-world-back]').click();
    await page.locator(`[data-city-world-panel="${kind}"]`).click(); await frames(page);
  };
  const assertToolChoicesReturn = async (page, requests) => {
    if (await page.locator('.city-world__tabs').getAttribute('hidden') !== null) {
      if (page.viewportSize().width <= 680) await page.locator('[data-city-world-back]').tap();
      else await page.locator('[data-city-world-back]').click();
      await frames(page);
    }
    const snapshot = () => page.evaluate(() => {
      const current = window.__worldHandles.at(-1).handle.getState();
      return { handles: window.__worldHandles.length, position: current.position, pathLength: current.pathLength,
        panel: current.worldUI.panel, opening: current.worldUI.opening, outer: scrollY,
        pressed: [...document.querySelectorAll('[data-city-world-panel][aria-pressed="true"]')].map(node => node.dataset.cityWorldPanel),
        fields: [...document.querySelectorAll('.city-world__content input,.city-world__content select')].map(node => [node.getAttribute('aria-label'), node.value]),
        receipt: document.querySelector('.city-world__receipt').textContent };
    });
    const choices = () => page.evaluate(() => {
      const dock = document.querySelector('.city-world__dock'), box = dock.getBoundingClientRect();
      const hit = node => { const rect = node.getBoundingClientRect(), target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return rect.top >= box.top && rect.bottom <= box.bottom && node.contains(target); };
      const back = dock.querySelector('[data-city-world-back]');
      return { scroll: dock.scrollTop, visible: [...dock.querySelectorAll('[data-city-world-panel]')].filter(hit).length,
        backHit: hit(back), backHeight: back.getBoundingClientRect().height };
    });
    await page.waitForFunction(() => window.__worldReadResults.every(read => read.settled));
    const before = await snapshot();
    if (before.panel === 'room') assert(before.fields.length >= 3, 'The real room supplies unsaved form fields.');
    for (const keyboard of [false, true]) {
      const box = await page.locator('.city-world__dock').boundingBox();
      await page.locator('.city-world__dock').evaluate(node => {
        node.__toolScrollEnded = false; node.__toolScrollEnd = () => { node.__toolScrollEnded = true; };
        node.addEventListener('scrollend', node.__toolScrollEnd, { once: true });
      });
      try {
        if (page.viewportSize().width <= 680) {
          const touch = await page.context().newCDPSession(page), x = box.x + box.width / 2, y = box.y + box.height - 24;
          try {
            await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            for (const distance of [50, 100, 150, 200, 250]) {
              await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - distance }] }); await frames(page);
            }
          } finally { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach(); }
        } else { await page.mouse.move(box.x + box.width / 2, box.y + box.height - 24); await page.mouse.wheel(0, 900); }
        await page.waitForFunction(() => document.querySelector('.city-world__dock').__toolScrollEnded === true);
      } finally {
        await page.locator('.city-world__dock').evaluate(node => { node.removeEventListener('scrollend', node.__toolScrollEnd); delete node.__toolScrollEnd; delete node.__toolScrollEnded; });
      }
      await page.waitForFunction(() => {
        const dock = document.querySelector('.city-world__dock'), box = dock.getBoundingClientRect();
        return dock.scrollTop > 0 && [...dock.querySelectorAll('[data-city-world-panel]')].every(node => node.getBoundingClientRect().bottom < box.top);
      });
      const scrolled = await choices();
      assert.equal(scrolled.visible, 0, 'Actual content scrolling takes all seven choices out of view.');
      assert(scrolled.backHit && scrolled.backHeight >= 44, 'The sticky return control remains reachable: ' + JSON.stringify(scrolled));
      const at = requests.length, reads = await page.evaluate(() => window.__worldReads.length);
      if (keyboard) {
        await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
        assert(await page.locator('[data-city-world-back]').evaluate(node => document.activeElement === node), 'Native reverse Tab reaches the sticky return button from Map.');
        const focused = await choices();
        assert(focused.scroll > 0 && focused.visible === 0 && focused.backHit, 'Keyboard focus alone leaves the choices hidden before Enter: ' + JSON.stringify(focused));
        await page.keyboard.press('Enter');
      } else if (page.viewportSize().width <= 680) await page.locator('[data-city-world-back]').tap();
      else await page.locator('[data-city-world-back]').click();
      await frames(page);
      const returned = await choices();
      assert.equal(returned.scroll, 0); assert.equal(returned.visible, 7, 'Returning exposes every real panel choice.');
      assert(await page.locator('[data-city-world-panel="map"]').evaluate(node => document.activeElement === node), 'Return focuses the first choice without selecting it.');
      assert.deepEqual(await snapshot(), before, 'Return retains the actual panel, opening, pose, scene, drafts, receipt and outer scroll.');
      assert.equal(await page.evaluate(() => window.__worldReads.length), reads, 'Return does not start a world read.');
      assert.deepEqual(requests.slice(at).filter(request => request.path.startsWith('/v1/')
        && !['/v1/screens', '/v1/commands/observations'].includes(request.path)), [], 'Return sends no game GET or POST.');
    }
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
        hud: rect(document.querySelector('.omerta-city__world-hud')), readiness: document.querySelector('.omerta-city__readiness').textContent,
        resources: rect(document.querySelector('.omerta-city__resources--walking')), warning: rect(document.querySelector('.omerta-city__readiness')),
        hudScroll: document.querySelector('.omerta-city__world-hud').scrollTop };
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

  const assertPanelLoading = async (page, label) => {
    await page.waitForFunction(label => document.querySelector('.city-world__content').getAttribute('aria-busy') === 'true'
      && document.querySelector('.city-world__dock-bar strong').textContent === label + ' · Loading…', label);
    const loading = await page.locator('.city-world__dock').evaluate(dock => {
      const title = dock.querySelector('.city-world__dock-bar strong'), content = dock.querySelector('.city-world__content');
      const notice = dock.querySelector('.city-world__notice'), bounds = title.getBoundingClientRect(), box = dock.getBoundingClientRect();
      const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      return { copy: notice.textContent, busy: content.getAttribute('aria-busy'), outsideBusy: !content.contains(notice),
        visible: bounds.height > 0 && bounds.top >= box.top && bounds.bottom <= box.bottom && (hit === title || title.contains(hit)) };
    });
    assert.equal(loading.copy, 'Loading ' + label + '…'); assert.equal(loading.busy, 'true');
    assert(loading.outsideBusy && loading.visible, 'The sticky loading title is visible and its live notice stays outside the busy content.');
    await assertFrame(page);
  };
  const assertPanelReadFeedback = async viewport => {
    const activate = async (page, selector) => {
      if (selector.startsWith('[data-city-world-panel') && await page.locator('.city-world__tabs').getAttribute('hidden') !== null) {
        if (viewport.width <= 680) await page.locator('[data-city-world-back]').tap();
        else await page.locator('[data-city-world-back]').click();
      }
      return viewport.width <= 680 ? page.locator(selector).tap() : page.locator(selector).click();
    };
    for (const scenario of ['active', 'map', 'close']) {
      const fixture = await newPage(viewport, { noResizeObserver: viewport.width === 320 }), { page, requests } = fixture;
      const handle = await page.evaluateHandle(() => window.__worldHandles.at(-1)), position = (await state(page)).position;
      const queues = new Map(), holds = [];
      const hold = url => {
        let entered, release, fulfilled;
        const observed = new Promise(resolve => { entered = resolve; }), gate = new Promise(resolve => { release = resolve; });
        const finished = new Promise(resolve => { fulfilled = resolve; });
        const item = { observed, gate, entered, release, finished, fulfilled };
        queues.get(url).push(item); holds.push(item); return item;
      };
      const settled = start => page.waitForFunction(start => window.__worldReadResults[start]?.settled === true, start);
      const clear = async label => {
        await page.waitForFunction(label => document.querySelector('.city-world__content').getAttribute('aria-busy') === 'false'
          && document.querySelector('.city-world__dock-bar strong').textContent === label, label);
        assert.equal(await page.locator('.city-world__notice').textContent(), '');
      };
      try {
        for (const url of ['/v1/city/social', '/v1/worldgraph/inventory']) {
          queues.set(url, []);
          await page.route('**' + url, async route => {
            const item = queues.get(url).shift();
            if (!item) return route.continue();
            const reply = await route.fetch(); assert.equal(reply.status(), 200);
            item.entered(await reply.json()); await item.gate;
            await route.fulfill({ response: reply }); item.fulfilled();
          });
        }
        const first = hold('/v1/city/social'), firstRead = await page.evaluate(() => window.__worldReadResults.length);
        await activate(page, '[data-city-world-tools]'); await activate(page, '[data-city-world-panel="style"]');
        const issued = await bounded(first.observed, 'the first actual Style board'); assert.equal(issued.outfits.length, 4);
        assert.equal(await page.locator('[data-city-outfit]').count(), 0);
        await assertPanelLoading(page, 'Style');
        if (scenario === 'active') {
          if (process.env.CITY_WORLD_SHOTS) {
            fs.mkdirSync(process.env.CITY_WORLD_SHOTS, { recursive: true });
            await page.screenshot({ path: path.join(process.env.CITY_WORLD_SHOTS, 'city-world-loading-' + viewport.width + '.png') });
          }
          first.release(); await first.finished; await settled(firstRead); await clear('Style');
          assert.equal(await page.locator('[data-city-outfit]').count(), 4, 'The real winning board supplies all four looks.');
          await assertFrame(page);
          await activate(page, '[data-city-world-close]'); await activate(page, '[data-city-world-tools]');
          const cached = hold('/v1/city/social'), cachedRead = await page.evaluate(() => window.__worldReadResults.length);
          await activate(page, '[data-city-world-panel="style"]'); await bounded(cached.observed, 'the cached Style refresh');
          await clear('Style');
          assert.equal(await page.locator('[data-city-outfit]').count(), 4);
          assert(await page.locator('[data-city-outfit]').evaluateAll(nodes => nodes.every(node => !node.disabled)), 'Cached looks stay usable during their refresh.');
          const bag = hold('/v1/worldgraph/inventory'), bagRead = await page.evaluate(() => window.__worldReadResults.length);
          await activate(page, '[data-city-world-panel="bag"]'); await assertPanelLoading(page, 'Bag');
          cached.release(); await cached.finished; await settled(cachedRead);
          await bounded(bag.observed, 'the actual Bag board queued after Style');
          await assertPanelLoading(page, 'Bag');
          assert.equal((await state(page)).worldUI.panel, 'bag', 'An old Social read cannot clear the current Bag loader.');
          bag.release(); await bag.finished; await settled(bagRead); await clear('Bag'); await assertFrame(page);
        } else {
          await activate(page, scenario === 'map' ? '[data-city-world-panel="map"]' : '[data-city-world-close]');
          await clear(scenario === 'map' ? 'Map' : 'World tools');
          assert.equal(await page.locator('.city-world__dock').isVisible(), scenario === 'map');
          first.release(); await first.finished; await settled(firstRead); await clear(scenario === 'map' ? 'Map' : 'World tools');
          assert.equal((await state(page)).worldUI.panel, scenario === 'map' ? 'map' : '', 'A retired read cannot reopen or retitle the current panel.');
          assert.equal(await page.locator('.city-world__dock').isVisible(), scenario === 'map');
        }
        assert(await page.evaluate(handle => window.__worldHandles.at(-1) === handle && !handle.destroyed, handle));
        assert.deepEqual((await state(page)).position, position, 'Panel reads retain the actual renderer and walking pose.');
        assert.deepEqual(mutations(requests), [], 'Opening, refreshing and retiring panels never submits gameplay.');
      } finally {
        holds.forEach(item => item.release()); await handle.dispose(); await fixture.context.close();
      }
    }
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
  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }, { width: 320, height: 568 }]) await assertPanelReadFeedback(viewport);
  console.log('world host: actual first-load feedback, cached controls and retired per-panel reads pass on desktop and phones');
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
  await page.getByLabel('Furniture column', { exact: true }).fill('5'); await page.getByLabel('Furniture row', { exact: true }).fill('4');
  assert((await page.locator('.city-world__receipt').textContent()).trim(), 'The return proof retains a real saved-room receipt.');
  await assertToolChoicesReturn(page, requests);
  await panel(page, 'map'); await page.locator('[data-city-minimap]').waitFor(); await assertFrame(page);
  await assertToolChoicesReturn(page, requests);
  const toolsDesktop = await newPage({ width: 1440, height: 900 });
  try {
    await panel(toolsDesktop.page, 'map'); await assertToolChoicesReturn(toolsDesktop.page, toolsDesktop.requests);
    await panel(toolsDesktop.page, 'room'); await toolsDesktop.page.getByLabel('Furniture column', { exact: true }).waitFor();
    await toolsDesktop.page.getByLabel('Furniture column', { exact: true }).fill('5'); await toolsDesktop.page.getByLabel('Furniture row', { exact: true }).fill('4');
    await assertToolChoicesReturn(toolsDesktop.page, toolsDesktop.requests);
  } finally { await toolsDesktop.context.close(); await page.bringToFront(); }
  console.log('world host: native phone/desktop tool return preserves panels, drafts, receipt, focus, pose and requests');
  const waypoint = (await state(page)).destinations.find(venue => venue.id === 'stories'), beforeWaypoint = requests.length;
  await page.locator('[data-city-waypoint="stories"]').click();
  const moving = await state(page);
  assert(Math.hypot(moving.position.x - waypoint.x, moving.position.y - waypoint.y) > 40 && moving.pathLength > 0, 'A waypoint starts real local walking instead of teleporting.');
  await page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().pathLength === 0, undefined, { timeout: 15000 });
  assert.equal((await state(page)).selectedVenue, 'stories');
  await page.waitForFunction(() => [...document.querySelectorAll('.city-world__speech,.city-world__dialogue')]
    .some(node => !node.hidden && node.textContent.includes('ELENA SERRA')));
  assert.match(await page.locator('.city-world__speech,.city-world__dialogue').allTextContents().then(text => text.join(' ')), /Ink stays longer than anger/);
  assert.deepEqual(mutations(requests.slice(beforeWaypoint)), []);
  await page.keyboard.press('Escape');
  let walkingPose = (await state(page)).position;
  await panel(page, 'skills');
  await page.locator('.city-world__stats').waitFor();
  await page.locator('[data-city-world-close]').click();
  await revealPlaces(page); await page.locator('[data-destination="training"]').click(); await page.locator('[data-city-action="streets"]').click();
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
  let releaseFirstDenied, releaseDenied, observedFirstDenied, observedDenied, latestDeniedRequest;
  let interceptedDenials = 0, queuedDenials = 0;
  const firstDenialGate = new Promise(resolve => { releaseFirstDenied = resolve; }), firstDenialObserved = new Promise(resolve => { observedFirstDenied = resolve; });
  const denialGate = new Promise(resolve => { releaseDenied = resolve; }), denialObserved = new Promise(resolve => { observedDenied = resolve; });
  await preferences(viewer, { chatEnabled: false });
  await page.route('**/v1/city/nearby-chat?*', async route => {
    // Only reads already queued while the sibling's consent is off are denials.
    // Later polls must reach the real server, which can legitimately return 200.
    if (queuedDenials && interceptedDenials >= queuedDenials) return route.continue();
    const ordinal = ++interceptedDenials, reply = await route.fetch();
    assert.equal(reply.status(), 403); assert.equal((await reply.json()).error, 'city_chat_opt_in_required');
    if (ordinal === 1) { observedFirstDenied(); await firstDenialGate; }
    if (ordinal === queuedDenials) { latestDeniedRequest = route.request(); observedDenied(); await denialGate; }
    await route.fulfill({ response: reply });
  });
  // Chat's five-second background read is actual; it is not a fabricated DTO.
  await bounded(firstDenialObserved, 'the first held real opt-out denial');
  const consentScope = await page.evaluate(() => window.__worldReadScope());
  const consentReadStart = await page.evaluate(() => window.__worldReadResults.length);
  await panel(page, 'style');
  queuedDenials = await page.evaluate(({ start, scope }) => {
    const belongs = record => record.scene === window.__worldHandles.length && record.ownerCurrentAtStart === true
      && record.scope?.current === true && record.scope.key === scope.key && record.scope.epoch === scope.epoch && record.scope.scene === scope.scene;
    const pending = window.__worldReadResults.filter(record => belongs(record) && record.kind === 'chat' && record.code === undefined);
    window.__latestConsentDenial = pending.at(-1);
    window.__winningConsentRead = window.__worldReadResults.slice(start).find(record => belongs(record) && record.kind === 'social');
    return pending.length;
  }, { start: consentReadStart, scope: consentScope });
  assert(queuedDenials > 0);
  assert(await page.evaluate(() => window.__winningConsentRead && window.__winningConsentRead.code === undefined),
    'The real Style read is queued behind the older Chat reads, before the sibling rejoins.');
  releaseFirstDenied();
  await bounded(denialObserved, 'the held real opt-out denial');
  const latestDenialScope = await page.evaluate(() => ({ current: window.__worldReadScope(), read: window.__latestConsentDenial.scope,
    opening: window.__worldHandles.at(-1).handle.getState().worldUI.opening }));
  assert.equal(latestDenialScope.current.key, consentScope.key); assert.equal(latestDenialScope.current.epoch, consentScope.epoch);
  assert.equal(latestDenialScope.current.scene, consentScope.scene); assert.equal(latestDenialScope.current.current, true);
  assert.equal(latestDenialScope.current.tickets.chat, latestDenialScope.read.tickets.chat + 1,
    'The held latest denial is still the current Chat ticket, so only the newer Social read can supersede it.');
  assert(latestDenialScope.current.tickets.social > latestDenialScope.read.tickets.social);
  assert.equal(latestDenialScope.current.consent, true);
  const beforeWinningConsent = mutations(requests).length;
  await preferences(viewer, { chatEnabled: true });
  const oldDenial = page.waitForResponse(reply => reply.request() === latestDeniedRequest && reply.status() === 403);
  const winningConsent = page.waitForResponse(async reply => new URL(reply.url()).pathname === '/v1/city/social'
    && reply.status() === 200 && (await reply.json()).preferences.chatEnabled === true);
  releaseDenied(); await oldDenial; await page.unroute('**/v1/city/nearby-chat?*');
  await winningConsent;
  await page.waitForFunction(() => window.__latestConsentDenial.settled && window.__winningConsentRead.settled);
  const consentReads = await page.evaluate(() => ({ denial: window.__latestConsentDenial, winner: window.__winningConsentRead,
    scope: window.__worldReadScope(), opening: window.__worldHandles.at(-1).handle.getState().worldUI.opening }));
  assert.equal(consentReads.denial.code, 499); assert.equal(consentReads.denial.ignored, true,
    'The current Chat denial is ignored specifically because a newer Social read was issued.');
  assert.equal(consentReads.winner.code, 200); assert.equal(consentReads.winner.ignored, false); assert.equal(consentReads.winner.current, true,
    'The winning Style read is actually accepted, rather than repaired by a later nested refresh.');
  assert.equal(consentReads.scope.key, consentScope.key); assert.equal(consentReads.scope.epoch, consentScope.epoch);
  assert.equal(consentReads.scope.scene, consentScope.scene); assert.equal(consentReads.scope.consent, true);
  assert.equal(consentReads.opening, latestDenialScope.opening); assert.equal(mutations(requests).length, beforeWinningConsent);
  console.log('world host: consent race', JSON.stringify({ queuedDenials, interceptedDenials,
    chatTicket: latestDenialScope.current.tickets.chat, socialTicket: latestDenialScope.current.tickets.social,
    epoch: consentScope.epoch, scene: consentScope.scene, opening: consentReads.opening,
    denial: consentReads.denial.code, winner: consentReads.winner.code }));
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
  await revealPlaces(page); await page.locator('[data-destination="fixer"]').click(); await page.locator('[data-city-open]').click();
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
  // Exercise the actual wider declared fallback font and CI's header height,
  // with real confirmed gains and the full 56px outcome toast still present.
  const shortFont = await page.addStyleTag({ content: '@media (max-width: 320px) { :root { --mono: "Courier New", monospace; } body.city-player-view #top { height: 177.75px; box-sizing: border-box; } }' });
  const restoreToastClock = () => page.locator('#toast').evaluate(node => {
    if (!Object.hasOwn(node, '__layoutBlur')) return;
    node.onblur = node.__layoutBlur; delete node.__layoutBlur;
  });
  await page.locator('#toast.show').evaluate((node, text) => {
    if (node.inert || node.querySelector('span:not(.ti)').textContent !== text) throw Error('The actual outcome must be visible before the pressure fixture.');
    node.__layoutBlur = node.onblur;
    node.onblur = event => { node.__layoutBlur?.call(node, event); clearTimeout(node._h); };
    clearTimeout(node._h);
  }, fullToast);
  try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 1366, height: 600 }]) {
      await page.setViewportSize(viewport); await page.locator('#btn-player-view').click(); await assertFrame(page);
      await panel(page, 'map'); await assertFrame(page);
      if (viewport.width === 320) {
        const pressureToast = await page.locator('#toast').evaluate(node => ({ shown: node.classList.contains('show'), inert: node.inert,
          text: node.querySelector('span:not(.ti)').textContent, height: node.getBoundingClientRect().height }));
        assert(pressureToast.shown && !pressureToast.inert && pressureToast.text === fullToast && Math.abs(pressureToast.height - 56) < 1,
          'The HUD pressure case retains the complete actual outcome inside its 56px visible cap: ' + JSON.stringify(pressureToast));
        const hud = page.locator('.omerta-city__world-hud'), gainCopy = await page.locator('.city-world__gains').textContent();
        const readHudEnd = async () => {
          await hud.evaluate(node => {
            node.__endSettled = new Promise(resolve => {
              const atEnd = () => node.scrollTop >= node.scrollHeight - node.clientHeight - 1;
              if (atEnd()) return resolve();
              const done = () => { if (atEnd()) { node.removeEventListener('scrollend', done); resolve(); } };
              node.addEventListener('scrollend', done);
            });
          });
          await page.keyboard.press('End'); await bounded(hud.evaluate(node => node.__endSettled), 'native HUD End scroll settlement');
        };
        assert.match(gainCopy, /Level 2 reached/);
        const captionCopy = await page.locator('.omerta-city__presence-caption').textContent(), frameBeforeReading = await assertFrame(page);
        assert.equal(frameBeforeReading.header.height, 177.75);
        assert(frameBeforeReading.warning.height >= 32, 'The wider fallback font wraps the full real readiness warning.');
        assert(frameBeforeReading.resources.top >= frameBeforeReading.hud.top && frameBeforeReading.warning.bottom <= frameBeforeReading.hud.bottom,
          'Resources and the complete warning are initially visible in the supported CI geometry.');
        assert(await hud.evaluate(node => node.scrollHeight > node.clientHeight && node.tabIndex === 0 && node.getAttribute('aria-label').includes('Scroll')),
          'Only the actually overflowing HUD enters keyboard navigation with a scroll label.');
        await hud.focus(); await readHudEnd();
        const feedbackVisible = () => {
          const hud = document.querySelector('.omerta-city__world-hud').getBoundingClientRect(), gain = document.querySelector('.city-world__gains').getBoundingClientRect();
          return gain.top >= hud.top && gain.bottom <= hud.bottom;
        };
        await page.waitForFunction(feedbackVisible);
        assert.equal(await page.locator('.city-world__gains').textContent(), gainCopy);
        assert.equal(await page.locator('.omerta-city__presence-caption').textContent(), captionCopy);
        const reading = await hud.evaluate(node => ({ outer: scrollY, inner: node.scrollTop, focused: document.activeElement === node }));
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        const readingFrames = await page.evaluate(() => new Promise(resolve => { const values = []; const sample = () => {
          const hud = document.querySelector('.omerta-city__world-hud'); values.push({ outer: scrollY, inner: hud.scrollTop, focused: document.activeElement === hud });
          if (values.length === 30) resolve(values); else requestAnimationFrame(sample);
        }; requestAnimationFrame(sample); }));
        assert(readingFrames.every(frame => frame.outer === reading.outer && frame.inner === reading.inner && frame.focused),
          'Passive fitting preserves both reading positions and focus without ResizeObserver.');
        await page.locator('#toast.show').focus();
        await page.locator('[data-city-world-close]').click();
        assert(await hud.evaluate(node => !node.style.getPropertyValue('--city-hud-height') && !node.hasAttribute('tabindex')));
        await shortFont.evaluate(node => { node.textContent = node.textContent.replace('177.75px', '215px'); });
        await panel(page, 'map'); const pressure = await assertFrame(page);
        assert.equal(pressure.header.height, 215);
        assert(await hud.evaluate(node => Math.abs(node.getBoundingClientRect().height - 51) < 1), 'The cap is derived from real chrome, never a second minimum-height floor.');
        await hud.focus(); await readHudEnd(); await page.waitForFunction(feedbackVisible);
        await page.keyboard.press('ArrowUp');
        await page.waitForFunction(() => {
          const hud = document.querySelector('.omerta-city__world-hud').getBoundingClientRect(), warning = document.querySelector('.omerta-city__readiness').getBoundingClientRect();
          return warning.top >= hud.top && warning.bottom <= hud.bottom;
        });
        assert.equal(await page.locator('.omerta-city__readiness').textContent(), frameBeforeReading.readiness, 'The complete warning remains keyboard-readable when all rows cannot fit simultaneously.');
        assert.equal(await page.locator('.city-world__gains').textContent(), gainCopy);
        assert.equal(await page.locator('.omerta-city__presence-caption').textContent(), captionCopy);
        assert.deepEqual((await state(page)).position, walkingPose);
        await page.locator('#toast.show').focus(); await page.locator('[data-city-world-close]').click();
        await shortFont.evaluate(node => { node.textContent = node.textContent.replace('215px', '177.75px'); });
        await panel(page, 'map'); await assertFrame(page);
        const toastBox = await page.locator('#toast').evaluate(node => ({ height: node.getBoundingClientRect().height,
          scroll: node.scrollHeight, client: node.clientHeight, tabIndex: node.tabIndex, live: node.getAttribute('aria-live') }));
        assert(Math.abs(toastBox.height - 56) < 1 && toastBox.scroll > toastBox.client && toastBox.tabIndex === 0 && toastBox.live,
          'The complete outcome stays scrollable and keyboard accessible inside a bounded Player toast: ' + JSON.stringify(toastBox));
        assert.equal(await page.locator('#toast > span:not(.ti)').textContent(), fullToast, 'Presentation preserves the full actual outcome text.');
        await restoreToastClock();
        // Restore the real blur clock and arm it before focus pauses it again.
        await page.locator('#toast.show').focus();
        const heldDismissalHandle = await page.locator('#toast').evaluate(node => node._h);
        await hud.focus();
        assert(await page.locator('#toast').evaluate((node, old) => !!node._h && node._h !== old && !Object.hasOwn(node, '__layoutBlur'), heldDismissalHandle),
          'The restored real blur handler arms a fresh dismiss clock before the focus-pause proof.');
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
      assert(await page.locator('.omerta-city__world-hud').evaluate(node => !node.style.getPropertyValue('--city-hud-height') && !node.hasAttribute('tabindex')), 'Closing or leaving phone inspection retires the cap and keyboard-only reading target.');
      assert.deepEqual((await state(page)).position, walkingPose);
    }
  } finally { await restoreToastClock(); }
  await shortFont.evaluate(node => node.remove());
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
    { label: 'Read this clue', run: () => {
      window.__toastActions++;
      const node = document.querySelector('#toast');
      window.__toastActionRetired = { inert: node.inert, tabIndex: node.tabIndex, focusOutside: !node.contains(document.activeElement) };
    } }); });
  assert(await page.locator('#toast').evaluate(node => node._return === document.querySelector('.omerta-city__world-hud')
    && node._return.isConnected && node._return.tabIndex < 0 && !node._return.closest('.hidden, [hidden], [inert]')),
  'The actual previously focused HUD remains connected after its phone-only reading target retires.');
  await page.locator('#toast .toast-act').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.__toastActions), 1);
  assert.deepEqual(await page.evaluate(() => window.__toastActionRetired), { inert: true, tabIndex: -1, focusOutside: true },
    'The action resumes only after toast focus retires, even when its connected return target is no longer focusable.');
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
  await tiny.page.waitForFunction(() => !document.querySelector('.city-world__dialogue').hidden && document.querySelector('.city-world__dialogue').textContent.includes('ELENA SERRA'));
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
  await revealPlaces(fallback.page); await fallback.page.locator('[data-destination="training"]').click();
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
  await revealPlaces(optional.page); await optional.page.locator('[data-destination="training"]').click(); await optional.page.locator('[data-city-open]').click();
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
  // Issue Style under the original actor, then let its real GET observe the
  // successor. Reconciliation may retire these controls as soon as it returns.
  await page.locator('[data-city-world-close]').click();
  let releaseSuccessorRead, observeSuccessorRead, successorReadHeld = false;
  const successorReadGate = new Promise(resolve => { releaseSuccessorRead = resolve; });
  const successorReadIssued = new Promise(resolve => { observeSuccessorRead = resolve; });
  const holdSuccessorRead = async route => {
    if (successorReadHeld) return route.continue();
    successorReadHeld = true; observeSuccessorRead(); await successorReadGate; await route.continue();
  };
  await page.route('**/v1/city/social', holdSuccessorRead);
  const mismatchedSocial = page.waitForResponse(async reply => new URL(reply.url()).pathname === '/v1/city/social'
    && reply.status() === 200 && (await reply.json()).viewer.characterId !== viewer.character.id);
  mismatchedSocial.catch(() => {}); // Observe early rejection; the original promise is still awaited below.
  try {
    await panel(page, 'style'); await bounded(successorReadIssued, 'the original actor\'s issued Style GET');
    const originalScene = await page.evaluate(() => ({ count: window.__worldHandles.length, scope: window.__worldReadScope() }));
    await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [viewer.character.id]);
    const successor = await app.inject({ method: 'POST', url: '/v1/character', headers: viewer.headers, payload: { name: 'World Successor' } });
    assert.equal(successor.statusCode, 200, successor.body);
    releaseSuccessorRead(); await mismatchedSocial;
    await page.waitForFunction(() => document.querySelector('#whoami').textContent.includes('World Successor'));
    await page.waitForFunction(count => window.__worldHandles[count - 1].destroyed
      && window.__worldHandles.length > count && window.__worldHandles.at(-1).handle.getState().ready, originalScene.count);
    const successorScope = await page.evaluate(() => window.__worldReadScope());
    assert.notEqual(successorScope.key, originalScene.scope.key, 'The real successor read reconciles a different owner scope.');
    console.log('world host: successor spanning GET', JSON.stringify({ scene: originalScene.scope.scene,
      currentSocialTicket: originalScene.scope.tickets.social, nextScene: successorScope.scene, originalDestroyed: true }));
  } finally { releaseSuccessorRead(); await page.unroute('**/v1/city/social', holdSuccessorRead); }
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
  // A cached Wine control renders before the restored scene's fresh read has
  // settled. Drain actual current reads before revoking: otherwise a queued
  // player401 can correctly retire the session before Social is dispatched.
  let releaseRestored, observedRestored, fulfilledRestored;
  const restoredGate = new Promise(resolve => { releaseRestored = resolve; });
  const restoredObserved = new Promise(resolve => { observedRestored = resolve; });
  const restoredFulfilled = new Promise(resolve => { fulfilledRestored = resolve; });
  const restoredAt = authPage.requests.length;
  const restoredRead = authPage.page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/city/social' && reply.status() === 200);
  let restoredOnce = false;
  await authPage.page.route('**/v1/city/social', async route => {
    if (restoredOnce) return route.continue(); restoredOnce = true;
    const reply = await route.fetch(); assert.equal(reply.status(), 200);
    assert.equal((await reply.json()).viewer.characterId, authActor.character.id);
    observedRestored(); await restoredGate; await route.fulfill({ response: reply }); fulfilledRestored();
  });
  await panel(authPage.page, 'style'); await authPage.page.locator('[data-city-outfit="wine"]').waitFor();
  await bounded(restoredObserved, 'the real restored Social200 behind cached Wine');
  assert.equal(await authPage.page.evaluate(() => window.__worldReadResults.at(-1).settled), false);
  const restoredPlayer = authPage.page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/projections/player' && reply.status() === 200);
  const restoredInventory = authPage.page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/worldgraph/inventory' && reply.status() === 200);
  await authPage.page.locator('#btn-refresh').click(); await panel(authPage.page, 'bag');
  releaseRestored(); await restoredRead; await restoredPlayer; await restoredInventory;
  await bounded(restoredFulfilled, 'the restored Social route completion'); await authPage.page.unroute('**/v1/city/social');
  const settledReadAt = await authPage.page.evaluate(() => window.__worldReadResults.length);
  await panel(authPage.page, 'style');
  await authPage.page.waitForFunction(start => window.__worldReadResults.slice(start).some(read => read.kind === 'social'
    && read.scene === window.__worldHandles.length && read.settled && read.current && read.code === 200 && !read.ignored), settledReadAt);
  assert.equal((await state(authPage.page)).worldUI.panel, 'style');
  assert.equal((await state(authPage.page)).look, 'wine');
  assert.deepEqual(mutations(authPage.requests.slice(restoredAt)), [], 'Restoration and its read queue are read-only before real revocation.');
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

  // Keep the original default-off and consent fixtures above unchanged. This
  // existing living account joins and writes real history before the new page.
  await preferences(neighbor, { chatEnabled: true });
  const chatSetup = (await app.inject({ method: 'GET', url: '/v1/city/social', headers: neighbor.headers })).json();
  const sendHistory = chatSetup.actions.find(action => action.id === 'chat:send'); assert(sendHistory?.available);
  const historyText = 'Saved loading regression history';
  const historyReply = await app.inject({ method: sendHistory.method, url: sendHistory.path,
    headers: { ...neighbor.headers, 'idempotency-key': crypto.randomUUID() }, payload: { ...sendHistory.body, text: historyText } });
  assert.equal(historyReply.statusCode, 200, historyReply.body);
  const joinedLoader = await newPage(undefined, { actor: neighbor });
  const joinedHandle = await joinedLoader.page.evaluateHandle(() => window.__worldHandles.at(-1));
  const joinedPosition = (await state(joinedLoader.page)).position;
  let releaseSocial, observedSocial, releaseChat, observedChat, releaseCached, observedCached;
  const socialGate = new Promise(resolve => { releaseSocial = resolve; }), socialObserved = new Promise(resolve => { observedSocial = resolve; });
  const chatGate = new Promise(resolve => { releaseChat = resolve; }), chatObserved = new Promise(resolve => { observedChat = resolve; });
  const cachedGate = new Promise(resolve => { releaseCached = resolve; }), cachedObserved = new Promise(resolve => { observedCached = resolve; });
  try {
    const joinedStyle = joinedLoader.page.waitForResponse(async reply => new URL(reply.url()).pathname === '/v1/city/social'
      && reply.status() === 200 && (await reply.json()).preferences.chatEnabled === true);
    await joinedLoader.page.locator('[data-city-world-tools]').tap();
    if (await joinedLoader.page.locator('.city-world__tabs').getAttribute('hidden') !== null) await joinedLoader.page.locator('[data-city-world-back]').tap();
    await joinedLoader.page.locator('[data-city-world-panel="style"]').tap(); await joinedStyle;
    await joinedLoader.page.waitForFunction(() => window.__worldHandles.at(-1).handle.getState().worldUI.chatJoined
      && document.querySelectorAll('[data-city-outfit]').length === 4 && document.querySelector('.city-world__content').getAttribute('aria-busy') === 'false');
    assert.equal(joinedLoader.requests.filter(request => request.path === '/v1/city/nearby-chat').length, 0,
      'The fresh joined Style board has not populated Chat through its normal background poll.');
    let socialOnce = false, chatOnce = false;
    await joinedLoader.page.route('**/v1/city/social', async route => {
      if (socialOnce) return route.continue(); socialOnce = true;
      const reply = await route.fetch(); assert.equal(reply.status(), 200); assert.equal((await reply.json()).preferences.chatEnabled, true);
      observedSocial(); await socialGate; await route.fulfill({ response: reply });
    });
    await joinedLoader.page.route('**/v1/city/nearby-chat?*', async route => {
      if (chatOnce) return route.continue(); chatOnce = true;
      const reply = await route.fetch(); assert.equal(reply.status(), 200);
      assert((await reply.json()).messages.some(message => message.text === historyText));
      observedChat(); await chatGate; await route.fulfill({ response: reply });
    });
    if (await joinedLoader.page.locator('.city-world__tabs').getAttribute('hidden') !== null) await joinedLoader.page.locator('[data-city-world-back]').tap();
    await joinedLoader.page.locator('[data-city-world-panel="chat"]').tap();
    await bounded(socialObserved, 'the joined Chat opening\'s actual Social200');
    assert.equal(joinedLoader.requests.filter(request => request.path === '/v1/city/nearby-chat').length, 0);
    await assertPanelLoading(joinedLoader.page, 'Nearby chat');
    assert.equal(await joinedLoader.page.locator('[data-city-nearby-feed]').textContent(), 'Messages have not loaded yet.');
    await joinedLoader.page.evaluate(() => {
      window.__chatLoaderTrace = [];
      window.__chatLoaderObserver = new MutationObserver(records => {
        const dock = document.querySelector('.city-world__dock');
        window.__chatLoaderTrace.push({ busy: dock.querySelector('.city-world__content').getAttribute('aria-busy'),
          title: dock.querySelector('.city-world__dock-bar strong').textContent, feed: dock.querySelector('[data-city-nearby-feed]')?.textContent,
          cleared: records.some(record => record.attributeName === 'aria-busy' && record.oldValue === 'false') });
      });
      window.__chatLoaderObserver.observe(document.querySelector('.city-world__dock'), { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['aria-busy'] });
    });
    releaseSocial(); await bounded(chatObserved, 'the dependent actual Chat200');
    await assertPanelLoading(joinedLoader.page, 'Nearby chat');
    const handoff = await joinedLoader.page.evaluate(() => { window.__chatLoaderObserver.disconnect(); return window.__chatLoaderTrace; });
    assert(handoff.length > 0 && handoff.every(frame => frame.busy === 'true' && frame.title === 'Nearby chat · Loading…'
      && frame.feed === 'Messages have not loaded yet.' && !frame.cleared), 'The real Social-to-Chat handoff never becomes quiet or falsely complete: ' + JSON.stringify(handoff));
    releaseChat();
    await joinedLoader.page.waitForFunction(text => document.querySelector('[data-city-nearby-feed]')?.textContent.includes(text)
      && document.querySelector('.city-world__content').getAttribute('aria-busy') === 'false', historyText);
    assert.equal(await joinedLoader.page.locator('.city-world__dock-bar strong').textContent(), 'Nearby chat');
    await joinedLoader.page.unroute('**/v1/city/social'); await joinedLoader.page.unroute('**/v1/city/nearby-chat?*');
    await joinedLoader.page.locator('[data-city-world-close]').tap(); await joinedLoader.page.locator('[data-city-world-tools]').tap();
    await joinedLoader.page.route('**/v1/city/social', async route => {
      const reply = await route.fetch(); assert.equal(reply.status(), 200); observedCached(); await cachedGate; await route.fulfill({ response: reply });
    });
    if (await joinedLoader.page.locator('.city-world__tabs').getAttribute('hidden') !== null) await joinedLoader.page.locator('[data-city-world-back]').tap();
    await joinedLoader.page.locator('[data-city-world-panel="chat"]').tap(); await bounded(cachedObserved, 'the complete-history cached Social refresh');
    assert.equal(await joinedLoader.page.locator('.city-world__content').getAttribute('aria-busy'), 'false');
    assert.equal(await joinedLoader.page.locator('.city-world__dock-bar strong').textContent(), 'Nearby chat');
    assert((await joinedLoader.page.locator('[data-city-nearby-feed]').textContent()).includes(historyText));
    releaseCached(); await joinedLoader.page.waitForFunction(() => window.__worldReadResults.every(read => read.settled));
    assert(await joinedLoader.page.evaluate(handle => window.__worldHandles.at(-1) === handle && !handle.destroyed, joinedHandle));
    assert.deepEqual((await state(joinedLoader.page)).position, joinedPosition);
    assert.deepEqual(mutations(joinedLoader.requests), [], 'Joined Chat loading and cached opening send no message or consent mutation.');
    await assertFrame(joinedLoader.page);
    console.log('world host: real joined Social-to-Chat loading handoff and cached history pass');
  } finally {
    releaseSocial(); releaseChat(); releaseCached();
    await joinedLoader.page.evaluate(() => { window.__chatLoaderObserver?.disconnect(); delete window.__chatLoaderObserver; delete window.__chatLoaderTrace; });
    await joinedHandle.dispose(); await joinedLoader.context.close();
  }
  {
  // Keep the inherited fixtures above unchanged. The existing living neighbor
  // now exercises the canonical atlas, travel receipts and account-owned deed.
  const historicalAccounts = [];
  for (let index = 0; index < 35; index++) {
    const account = (index === 0 ? 'onchain:' : '') + 'world-host-history-' + index;
    const street = index === 0 ? 'Legacy Café' : 'World Atlas Legacy ' + String(index).padStart(2, '0');
    await app.pool.query('INSERT INTO street_deeds(account_id,name,name_lc,district) VALUES($1,$2,$3,$4)', [account, street, street.toLowerCase(), 'docks']);
    historicalAccounts.push(account);
  }
  const clearHistoricalHomes = async () => { for (const account of historicalAccounts) await app.pool.query('DELETE FROM street_deeds WHERE account_id=$1', [account]); };
  fixtureCleanup.push(clearHistoricalHomes);
  await preferences(neighbor, { chatEnabled: false });
  await app.pool.query('UPDATE characters SET cash=1000000,health=100,jail_until=NULL,last_accrued_at=$2 WHERE id=$1 AND alive',
    [neighbor.character.id, new Date(Date.now() + 600000)]);
  const connected = await newPage(undefined, { actor: neighbor });
  const cityPage = connected.page, cityRequests = connected.requests;
  const activate = async control => {
    if (await control.getAttribute('data-city-world-map') !== null || await control.getAttribute('data-destination') !== null) await revealPlaces(cityPage);
    return cityPage.viewportSize().width <= 680 ? control.tap() : control.click();
  };
  const currentActor = async actor => (await app.pool.query('SELECT id,account_id,generation,loc,cash FROM characters WHERE account_id=$1 AND alive', [actor.character.account_id])).rows[0];
  const fares = async actor => (await app.pool.query("SELECT amount FROM transactions WHERE character_id=$1 AND currency='cash' AND reason='travel'", [(await currentActor(actor)).id])).rows.map(row => Number(row.amount));
  const recorded = async actor => (await app.inject({ url: '/v1/collection', headers: actor.headers })).json().categories.find(category => category.id === 'districts').items;
  const openAtlas = async (page = cityPage) => {
    const control = await page.locator('[data-city-home-action="map"]').isVisible()
      ? page.locator('[data-city-home-action="map"]') : await page.locator('.city-world__dock').isVisible()
        ? page.locator('[data-city-map-view="world"]') : page.locator('[data-city-world-map]');
    if (await control.getAttribute('data-city-world-map') !== null) await revealPlaces(page);
    await (page.viewportSize().width <= 680 ? control.tap() : control.click());
    await page.waitForFunction(() => document.querySelectorAll('[data-city-district]').length === 6
      && !document.querySelector('.city-world__content').textContent.includes('recorded visits are loading'));
    const modeBounds = await page.evaluate(() => Array.from(document.querySelectorAll('[data-city-map-view]')).map(node => {
      const style = getComputedStyle(node); return { id: node.dataset.cityMapView, height: node.getBoundingClientRect().height,
        offsetHeight: node.offsetHeight, minHeight: style.minHeight, display: style.display, transform: style.transform,
        connected: node.isConnected, tab: node.closest('.tab')?.className, body: document.body.className };
    }));
    assert.deepEqual(modeBounds.map(node => node.id), ['neighborhood', 'world']);
    assert(modeBounds.length === 2 && modeBounds.every(node => node.connected && node.height >= 44),
      'Neighborhood and World overview remain actual44px controls in the real player stylesheet: ' + JSON.stringify(modeBounds));
    assert.equal((await state(page)).worldUI.mapView, 'world');
  };
  const enterDeeds = async page => {
    const native = control => page.viewportSize().width <= 680 ? control.tap() : control.click();
    if (await page.locator('.city-world__dock').isVisible()) await native(page.locator('[data-city-world-close]'));
    await revealPlaces(page);
    await native(page.locator('[data-destination="clubhouse"]'));
    await native(page.locator('[data-city-action="deeds"]'));
  };
  const selectDistrict = async id => {
    const start = await cityPage.evaluate(() => window.__worldReadResults.length);
    await activate(cityPage.locator(`[data-city-district="${id}"]`));
    await cityPage.waitForFunction(({ start, id }) => window.__worldReadResults.slice(start).some(read => read.kind === 'homes'
      && read.districtId === id && read.settled && read.current && read.code === 200 && !read.ignored), { start, id });
    assert.equal((await state(cityPage)).worldUI.districtId, id);
  };
  const assertCaptionInspection = async () => {
    await cityPage.waitForFunction(() => window.__worldReadResults.every(read => read.settled));
    await frames(cityPage);
    const before = await state(cityPage), handle = await cityPage.evaluateHandle(() => window.__worldHandles.at(-1));
    const previous = before.worldUI.districtId, readStart = await cityPage.evaluate(() => window.__worldReadResults.length);
    assert.notEqual(previous, 'cathedral', 'Caption activation must change the currently inspected district.');
    const requestStart = cityRequests.length, name = mapBoard.districts.find(district => district.id === 'cathedral').name;
    const caption = cityPage.locator('.city-world__atlas-diagram text').filter({ hasText: name });
    assert.equal(await caption.count(), 1);
    await caption.scrollIntoViewIfNeeded();
    await cityPage.evaluate(() => {
      window.__atlasCaptionActivation = null;
      window.__atlasCaptionObserver = event => {
        const target = event.target, trusted = event.isTrusted, pointerType = event.pointerType;
        queueMicrotask(() => { window.__atlasCaptionActivation = {
          target: target.tagName, trusted, pointerType,
          selected: window.__worldHandles.at(-1).handle.getState().worldUI.districtId,
          focusedDetail: document.activeElement?.dataset.cityDistrictDetail
        }; });
      };
      document.addEventListener('click', window.__atlasCaptionObserver, { once: true });
    });
    try {
      await activate(caption);
      const clicked = await cityPage.evaluate(() => window.__atlasCaptionActivation);
      assert(clicked?.trusted, 'The atlas caption uses actual native pointer input.');
      if (cityPage.viewportSize().width > 680) {
        assert.equal(clicked.target, 'text', 'The desktop mouse activates the district name itself, not the nearby circle.');
        assert.equal(clicked.pointerType, 'mouse');
      }
      assert.equal(clicked.selected, 'cathedral', 'Native district caption activation selects Cathedral Hill.');
      assert.equal(clicked.focusedDetail, 'cathedral', 'Caption activation focuses its district details.');
    } finally {
      await cityPage.evaluate(() => {
        document.removeEventListener('click', window.__atlasCaptionObserver);
        delete window.__atlasCaptionObserver; delete window.__atlasCaptionActivation;
      });
    }
    const settled = async (start, id) => {
      await cityPage.waitForFunction(({ start, id }) => window.__worldReadResults.slice(start).some(read => read.kind === 'homes'
        && read.districtId === id && read.settled && read.current && read.code === 200 && !read.ignored), { start, id });
      assert.equal((await state(cityPage)).worldUI.districtId, id);
      assert.equal(await cityPage.locator(`[data-city-district="${id}"]`).getAttribute('aria-pressed'), 'true');
      assert.match(await cityPage.locator(`[data-city-district-detail="${id}"]`).textContent(),
        new RegExp(mapBoard.districts.find(district => district.id === id).name));
      assert(await cityPage.evaluate(() => document.querySelector('.city-world__content').contains(document.activeElement)),
        'A real directory settlement retains keyboard focus within the atlas.');
    };
    await settled(readStart, 'cathedral');
    const keyboardRead = await cityPage.evaluate(() => window.__worldReadResults.length);
    const districtButton = cityPage.locator(`[data-city-district="${previous}"]`);
    await districtButton.focus(); await districtButton.press('Enter');
    await settled(keyboardRead, previous);
    assert.deepEqual((await state(cityPage)).position, before.position, 'Caption and keyboard inspection preserve the actual walking pose.');
    assert(await cityPage.evaluate(entry => window.__worldHandles.at(-1) === entry && !entry.destroyed, handle));
    await handle.dispose();
    assert.deepEqual(mutations(cityRequests.slice(requestStart)), [], 'Caption and accessible-list inspection submit no gameplay POST.');
  };
  const travelPrompt = async id => {
    await activate(cityPage.locator(`[data-city-travel="${id}"]`));
    const modal = cityPage.locator('.modal-bg[data-managed-dialog]').last(); await modal.waitFor({ state: 'visible' });
    assert.match(await modal.textContent(), /A ride costs \$250/);
    assert.equal(await modal.locator('[data-yes]').textContent(), 'Travel — $250');
    return modal;
  };
  const districtReady = async id => {
    await cityPage.waitForFunction(id => window.__worldHandles.at(-1)?.handle.getState().ready
      && window.__worldHandles.at(-1).handle.getState().region.id === id, id);
    assert.equal((await currentActor(neighbor)).loc, id);
  };
  let cityHandle = await cityPage.evaluateHandle(() => window.__worldHandles.at(-1)), cityPose = (await state(cityPage)).position;
  const initialFares = await fares(neighbor), beforeAtlas = cityRequests.length;
  await openAtlas();
  const firstDirectory = await app.inject({ url: '/v1/city/homes?district=docks', headers: neighbor.headers }); assert.equal(firstDirectory.statusCode, 200);
  const firstDirectoryBody = firstDirectory.json(); assert.equal(firstDirectoryBody.homes.length, 32); assert(firstDirectoryBody.nextCursor);
  assert.equal(firstDirectoryBody.total, 35); assert.equal(firstDirectoryBody.myHome, null);
  assert(firstDirectoryBody.homes.some(home => home.key === 'legacy café' && home.ownership === 'external' && home.owner === null && !home.mine));
  assert(firstDirectoryBody.homes.some(home => home.ownership === 'estate' && home.owner === null && !home.mine));
  const moreDirectory = cityPage.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/city/homes'
    && new URL(reply.url()).searchParams.get('after') === firstDirectoryBody.nextCursor && reply.status() === 200);
  await activate(cityPage.locator('[data-city-homes-more]')); const moreDirectoryBody = await (await moreDirectory).json();
  assert.equal(moreDirectoryBody.homes.length, 3); assert.equal(moreDirectoryBody.nextCursor, null);
  const directoryKeys = [...new Set([...firstDirectoryBody.homes, ...moreDirectoryBody.homes].map(home => home.key))];
  await cityPage.waitForFunction(count => window.__worldHandles.at(-1).handle.getState().homes.length === count, directoryKeys.length);
  const physicalHomes = (await state(cityPage)).homes, downstreamKey = moreDirectoryBody.homes.at(-1).key;
  assert(physicalHomes.some(home => home.key === downstreamKey));
  await selectDistrict('neon');
  const updatesBeforeRefresh = await cityPage.evaluate(() => window.__worldUpdates.length);
  await refresh(cityPage);
  await cityPage.waitForFunction(start => window.__worldUpdates.slice(start).some(update => update.hydrationDistrict === 'docks'
    && update.hydrationCount === 32 && update.scope?.current), updatesBeforeRefresh);
  const refreshedHomeUpdate = await cityPage.evaluate(start => window.__worldUpdates.slice(start).find(update => update.hydrationDistrict === 'docks'
    && update.hydrationCount === 32 && update.scope?.current), updatesBeforeRefresh);
  assert.deepEqual(refreshedHomeUpdate.homes, physicalHomes, 'A winning unrelated Refresh cannot replace accepted page2 plots with the cached first page.');
  assert.deepEqual(refreshedHomeUpdate.position, cityPose);
  assert(await cityPage.evaluate(handle => window.__worldHandles.at(-1) === handle && !handle.destroyed, cityHandle));
  assert.deepEqual(mutations(cityRequests.slice(beforeAtlas)), [], 'Directory pagination, foreign inspection and physical hydration stay read-only.');
  const mapReply = await app.inject({ url: '/v1/map', headers: neighbor.headers }); assert.equal(mapReply.statusCode, 200);
  const mapBoard = mapReply.json(); assert.equal(mapBoard.total, 6);
  assert.deepEqual(await cityPage.locator('[data-city-district]').evaluateAll(nodes => nodes.map(node => node.dataset.cityDistrict)), mapBoard.districts.map(district => district.id));
  const edges = new Set(mapBoard.districts.flatMap(district => district.neighbours.map(id => [district.id, id].sort().join(':'))));
  assert.equal(await cityPage.locator('.city-world__atlas-diagram line').count(), edges.size);
  for (const visit of await recorded(neighbor)) {
    const row = cityPage.locator(`[data-city-district="${visit.id}"]`);
    assert.equal((await row.textContent()).includes('Visited'), visit.got, 'Only the actual Collection GET records a visit.');
  }
  await assertCaptionInspection();
  await selectDistrict('neon');
  assert.match(await cityPage.locator('[data-city-district-detail="neon"]').textContent(), /\$250/);
  let confirmation = await travelPrompt('neon'); await activate(confirmation.locator('[data-no]'));
  await cityPage.waitForFunction(() => !window.__worldHandles.at(-1).handle.getState().worldUI.pending);
  assert.deepEqual(mutations(cityRequests.slice(beforeAtlas)), [], 'Atlas inspection and cancellation send no gameplay mutation.');
  assert.deepEqual(await fares(neighbor), initialFares);
  assert.equal((await currentActor(neighbor)).loc, 'docks');
  assert.deepEqual((await state(cityPage)).position, cityPose);
  assert(await cityPage.evaluate(handle => window.__worldHandles.at(-1) === handle && !handle.destroyed, cityHandle));

  // A real authenticated read holds the queue; closing and reopening the Atlas
  // permanently retires the confirmed but not-yet-dispatched travel intent.
  let releaseTravelQueue, observeTravelQueue;
  const travelQueueGate = new Promise(resolve => { releaseTravelQueue = resolve; });
  const travelQueueObserved = new Promise(resolve => { observeTravelQueue = resolve; });
  let queueOnce = false;
  const holdTravelQueue = async route => { if (queueOnce) return route.continue(); queueOnce = true; observeTravelQueue(); await travelQueueGate; await route.continue(); };
  await cityPage.route('**/v1/projections/player*', holdTravelQueue);
  const queuedAt = cityRequests.length;
  try {
    await cityPage.locator('#btn-refresh').click(); await bounded(travelQueueObserved, 'the queued travel player read');
    confirmation = await travelPrompt('neon'); await activate(confirmation.locator('[data-yes]'));
    await activate(cityPage.locator('[data-city-world-close]')); await activate(cityPage.locator('[data-city-world-map]'));
  } finally { releaseTravelQueue(); }
  await cityPage.waitForFunction(() => !document.querySelector('#busy.on') && !window.__worldHandles.at(-1).handle.getState().worldUI.pending);
  await cityPage.unroute('**/v1/projections/player*', holdTravelQueue);
  assert.equal(mutations(cityRequests.slice(queuedAt)).filter(request => request.path.startsWith('/v1/travel/')).length, 0);
  assert.deepEqual(await fares(neighbor), initialFares); assert.equal((await currentActor(neighbor)).loc, 'docks');
  assert.deepEqual((await state(cityPage)).position, cityPose);

  // The cached UI allows the fare, then the actual server sees a sibling cash
  // change. A definitive refusal must retain the district, canvas and pose.
  await selectDistrict('neon');
  let refusalOnce = false;
  const refuseFare = async route => {
    if (!refusalOnce) { refusalOnce = true; await app.pool.query('UPDATE characters SET cash=0 WHERE id=$1 AND alive', [neighbor.character.id]); }
    await route.continue();
  };
  await cityPage.route('**/v1/travel/neon', refuseFare);
  const refused = cityPage.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/travel/neon');
  try {
    confirmation = await travelPrompt('neon'); await activate(confirmation.locator('[data-yes]'));
    const reply = await refused; assert.equal(reply.status(), 400); assert.equal((await reply.json()).error, 'cash');
    await cityPage.waitForFunction(() => !document.querySelector('#busy.on') && !window.__worldHandles.at(-1).handle.getState().worldUI.pending);
    assert.equal((await currentActor(neighbor)).loc, 'docks'); assert.deepEqual(await fares(neighbor), initialFares);
    assert.deepEqual((await state(cityPage)).position, cityPose);
    assert(await cityPage.evaluate(handle => window.__worldHandles.at(-1) === handle && !handle.destroyed, cityHandle));
  } finally { await cityPage.unroute('**/v1/travel/neon', refuseFare); }
  await app.pool.query('UPDATE characters SET cash=1000000 WHERE id=$1 AND alive', [neighbor.character.id]);
  await refresh(cityPage); await selectDistrict('neon');
  const beforeRide = await currentActor(neighbor), rideAt = cityRequests.length;
  const successfulRide = cityPage.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/travel/neon');
  confirmation = await travelPrompt('neon'); await activate(confirmation.locator('[data-yes]'));
  const ride = await successfulRide; assert.equal(ride.status(), 200); const rideBody = await ride.json();
  assert.deepEqual({ ok: rideBody.ok, loc: rideBody.loc, cost: rideBody.cost }, { ok: true, loc: 'neon', cost: 250 });
  await districtReady('neon');
  assert.equal(Number((await currentActor(neighbor)).cash), Number(beforeRide.cash) - 250);
  assert.deepEqual(await fares(neighbor), [...initialFares, -250]);
  assert.equal(mutations(cityRequests.slice(rideAt)).filter(request => request.path === '/v1/travel/neon').length, 1);
  assert(await cityHandle.evaluate(record => record.destroyed)); await cityHandle.dispose();
  await clearHistoricalHomes();
  cityHandle = await cityPage.evaluateHandle(() => window.__worldHandles.at(-1)); cityPose = (await state(cityPage)).position;

  let releaseVisit, observeVisit;
  const visitGate = new Promise(resolve => { releaseVisit = resolve; }), visitObserved = new Promise(resolve => { observeVisit = resolve; });
  let visitOnce = false;
  const holdVisit = async route => {
    if (visitOnce) return route.continue(); visitOnce = true;
    const reply = await route.fetch(); assert.equal(reply.status(), 200);
    assert.equal((await reply.json()).categories.find(category => category.id === 'districts').items.find(item => item.id === 'neon').got, true);
    observeVisit(); await visitGate; await route.fulfill({ response: reply });
  };
  await cityPage.route('**/v1/collection', holdVisit);
  try {
    await activate(cityPage.locator('[data-city-world-map]')); await bounded(visitObserved, 'the actual visited Collection GET');
    assert(!(await cityPage.locator('[data-city-district="neon"]').textContent()).includes('Visited'), 'Here does not optimistically manufacture a recorded visit.');
    releaseVisit(); await cityPage.waitForFunction(() => document.querySelector('[data-city-district="neon"]').textContent.includes('Visited'));
    assert.deepEqual((await state(cityPage)).position, cityPose);
    assert(await cityPage.evaluate(handle => window.__worldHandles.at(-1) === handle && !handle.destroyed, cityHandle));
  } finally { releaseVisit(); await cityPage.unroute('**/v1/collection', holdVisit); }

  // Lose a real committed travel response after closing its old view. Recovery
  // must retain the exact key/body and the one authoritative fare after remount.
  await selectDistrict('foundry');
  const attempts = []; let originalTravel, releaseLostTravel, observeLostTravel;
  const lostGate = new Promise(resolve => { releaseLostTravel = resolve; }), lostObserved = new Promise(resolve => { observeLostTravel = resolve; });
  const loseTravel = async route => {
    attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON(), path: new URL(route.request().url()).pathname });
    const reply = await route.fetch(); assert.equal(reply.status(), 200);
    if (attempts.length === 1) { originalTravel = await reply.text(); observeLostTravel(); await lostGate; await route.abort('connectionfailed'); }
    else await route.fulfill({ response: reply });
  };
  await cityPage.route('**/v1/travel/foundry', loseTravel);
  const beforeLostRide = await currentActor(neighbor), faresBeforeLost = await fares(neighbor);
  try {
    confirmation = await travelPrompt('foundry'); await activate(confirmation.locator('[data-yes]'));
    await bounded(lostObserved, 'the actually committed lost travel reply');
    await activate(cityPage.locator('[data-city-world-close]')); releaseLostTravel();
    await districtReady('foundry'); await openAtlas();
    await cityPage.locator('[data-city-world-retry]').waitFor();
    assert.equal(await cityPage.locator('[data-city-travel]:enabled').count(), 0, 'An uncertain ride blocks a fresh travel key after closing and remounting.');
    const retryReply = cityPage.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/travel/foundry');
    await activate(cityPage.locator('[data-city-world-retry]')); const replay = await retryReply;
    assert.equal(replay.status(), 200); assert.equal(await replay.text(), originalTravel);
    await cityPage.waitForFunction(() => !document.querySelector('#busy.on') && !window.__worldHandles.at(-1).handle.getState().worldUI.pending);
    assert.equal(attempts.length, 2); assert.deepEqual(attempts[1], attempts[0]); assert(attempts[0].key);
    assert.equal(Number((await currentActor(neighbor)).cash), Number(beforeLostRide.cash) - 250);
    assert.deepEqual(await fares(neighbor), [...faresBeforeLost, -250]);
    assert.equal((await currentActor(neighbor)).loc, 'foundry');
  } finally { releaseLostTravel(); await cityPage.unroute('**/v1/travel/foundry', loseTravel); }
  await cityHandle.dispose();
  console.log('world host: six-district atlas, confirmed one-fare travel, refused/queued cancellation, winning visits and exact-key lost-reply recovery pass');

  // A canonical claim on another district reveals the deed without a ride.
  // The current real successor is the seller; no additional account is created.
  const seller = await currentActor(viewer); assert(seller && seller.id !== viewer.character.id);
  const sellerPage = await newPage({ width: 1440, height: 1000 }, { actor: viewer });
  await enterDeeds(sellerPage.page); await sellerPage.page.locator('#deed-name').waitFor();
  const street = 'Connected World Street', key = street.toLowerCase(), propertyDistrict = 'brick';
  const sellerFares = await fares(viewer), sellerLocation = seller.loc, sellerAt = sellerPage.requests.length;
  await sellerPage.page.locator('#deed-name').fill(street);
  const claimed = sellerPage.page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/deeds/claim');
  await sellerPage.page.locator('[data-claimdist="brick"]').click();
  const claimReply = await claimed; assert.equal(claimReply.status(), 200); assert.equal((await claimReply.json()).name, street);
  await sellerPage.page.waitForFunction(({ key, district }) => window.__worldHandles.at(-1)?.handle.getState().worldUI?.mapView === 'world'
    && window.__worldHandles.at(-1).handle.getState().worldUI.districtId === district
    && [...document.querySelectorAll('[data-city-home]')].some(node => node.dataset.cityHome === key), { key, district: propertyDistrict });
  assert.equal((await currentActor(viewer)).loc, sellerLocation); assert.deepEqual(await fares(viewer), sellerFares);
  assert.deepEqual(mutations(sellerPage.requests.slice(sellerAt)).map(request => request.path), ['/v1/deeds/claim'], 'Claim reveals the real deed without automatic fare or other gameplay action.');
  const claimedDirectory = await app.inject({ url: '/v1/city/homes?district=brick', headers: viewer.headers }); assert.equal(claimedDirectory.statusCode, 200);
  const claimedBoard = claimedDirectory.json();
  assert.deepEqual(Object.keys(claimedBoard).sort(), ['districtId', 'homes', 'myHome', 'nextCursor', 'placement', 'total', 'viewer']);
  assert.deepEqual(claimedBoard.viewer, { characterId: seller.id, generation: Number(seller.generation), district: sellerLocation });
  assert.equal(claimedBoard.districtId, propertyDistrict); assert.equal(claimedBoard.placement, 'illustrative');
  assert.equal(claimedBoard.myHome.key, key); assert.equal(claimedBoard.myHome.mine, true);
  assert.deepEqual(Object.keys(claimedBoard.myHome).sort(), ['districtId', 'key', 'mine', 'owner', 'ownership', 'street']);
  assert.deepEqual(Object.keys(claimedBoard.myHome.owner).sort(), ['kind', 'name']);
  const deeds = await app.inject({ url: '/v1/deeds', headers: viewer.headers }); assert.equal(deeds.statusCode, 200);
  const salePrice = deeds.json().market.minPrice;
  const listed = await app.inject({ method: 'POST', url: '/v1/deeds/list', headers: { ...viewer.headers, 'idempotency-key': crypto.randomUUID() }, payload: { price: salePrice } });
  assert.equal(listed.statusCode, 200, listed.body);
  // The seller's assertions are complete; its renderer is not part of the buyer's journey.
  await sellerPage.context.close();
  await cityPage.bringToFront(); await enterDeeds(cityPage); await cityPage.locator(`[data-buydeed="${seller.id}"]`).waitFor();
  const beforeBuy = await currentActor(neighbor), buyFares = await fares(neighbor), buyAt = cityRequests.length;
  const boughtDeed = cityPage.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/deeds/buy/' + seller.id);
  await activate(cityPage.locator(`[data-buydeed="${seller.id}"]`));
  const buyModal = cityPage.locator('.modal-bg[data-managed-dialog]').last(); await buyModal.waitFor({ state: 'visible' }); await activate(buyModal.locator('[data-yes]'));
  const buyReply = await boughtDeed; assert.equal(buyReply.status(), 200); assert.equal((await buyReply.json()).street, street);
  await cityPage.waitForFunction(({ key, district }) => window.__worldHandles.at(-1)?.handle.getState().worldUI?.mapView === 'world'
    && window.__worldHandles.at(-1).handle.getState().worldUI.districtId === district
    && [...document.querySelectorAll('[data-city-home]')].some(node => node.dataset.cityHome === key), { key, district: propertyDistrict });
  const afterBuy = await currentActor(neighbor);
  assert.equal(afterBuy.loc, beforeBuy.loc); assert.equal(Number(afterBuy.cash), Number(beforeBuy.cash) - salePrice); assert.deepEqual(await fares(neighbor), buyFares);
  assert.deepEqual(mutations(cityRequests.slice(buyAt)).map(request => request.path), ['/v1/deeds/buy/' + seller.id]);
  const parcelRows = (await app.pool.query('SELECT name_lc,district,account_id FROM street_deeds WHERE name_lc=$1', [key])).rows;
  assert.deepEqual(parcelRows, [{ name_lc: key, district: propertyDistrict, account_id: neighbor.character.account_id }], 'A sale transfers the same parcel instead of duplicating it.');
  const transferred = (await app.inject({ url: '/v1/city/homes?district=brick', headers: neighbor.headers })).json();
  assert.equal(transferred.myHome.key, key); assert.equal(transferred.myHome.mine, true); assert.equal(transferred.myHome.owner.name, 'Nearby Player');
  assert.equal(transferred.homes.filter(home => home.key === key).length, 1);
  await activate(cityPage.locator(`.city-world__home[data-city-home="${key}"]`));
  assert.equal(await cityPage.locator('[data-city-home-walk]').count(), 0, 'A remote property cannot invent a local entrance or move the player.');
  if (process.env.CITY_WORLD_SHOTS) await cityPage.screenshot({ path: path.join(process.env.CITY_WORLD_SHOTS, 'city-world-atlas-property-375.png') });

  // Selecting the actual owned home is only a presentation hint. An explicit
  // confirmed ride precedes the fresh directory read and real entrance walk.
  const beforeHomeRide = await currentActor(neighbor), homeFares = await fares(neighbor);
  const homeRide = cityPage.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/travel/brick');
  confirmation = await travelPrompt(propertyDistrict); await activate(confirmation.locator('[data-yes]'));
  const homeRideReply = await homeRide; assert.equal(homeRideReply.status(), 200); assert.equal((await homeRideReply.json()).cost, 250);
  await districtReady(propertyDistrict);
  await cityPage.waitForFunction(key => window.__worldHandles.at(-1).handle.getState().homes.some(home => home.key === key)
    && window.__worldHandles.at(-1).handle.getState().pathLength > 0, key);
  const homeMoving = await state(cityPage), homePlot = homeMoving.homes.find(home => home.key === key);
  assert(Math.hypot(homeMoving.position.x - homePlot.entrance.x, homeMoving.position.y - homePlot.entrance.y) > 40,
    'A confirmed ride followed by the real home entry starts walking instead of teleporting to the property.');
  const homeWalkSnapshot = () => cityPage.evaluate(key => {
    const entry = window.__worldHandles.at(-1), state = entry.handle.getState(), game = window.__worldGames.at(-1);
    return { at: performance.now(), scene: window.__worldHandles.length, destroyed: entry.destroyed,
      ready: state.ready, region: state.region.id, position: state.position, pathLength: state.pathLength,
      selectedHome: state.selectedHome, home: state.homes.find(home => home.key === key), worldUI: state.worldUI,
      focus: document.hasFocus(), visibility: document.visibilityState, active: document.activeElement?.tagName,
      renderer: { frame: game.loop.frame, delta: game.loop.delta, actualFps: game.loop.actualFps, running: game.loop.running } };
  }, key);
  const homeWalkStart = await homeWalkSnapshot();
  try {
    await cityPage.waitForFunction(key => window.__worldHandles.at(-1).handle.getState().selectedHome === key
      && window.__worldHandles.at(-1).handle.getState().pathLength === 0, key, { timeout: 15000 });
  } catch (error) {
    let diagnosticTimer;
    const final = await Promise.race([
      homeWalkSnapshot().catch(failure => ({ unavailable: failure.message })),
      new Promise(resolve => { diagnosticTimer = setTimeout(() => resolve({ unavailable: 'snapshot exceeded 2000ms' }), 2000); }),
    ]);
    clearTimeout(diagnosticTimer);
    console.error('world host: failed owned-home arrival', JSON.stringify({ key, start: homeWalkStart, final }));
    throw error;
  }
  const homeArrived = await state(cityPage);
  assert.equal(homeArrived.homes.filter(home => home.key === key).length, 1);
  assert(Math.hypot(homeArrived.position.x - homePlot.entrance.x, homeArrived.position.y - homePlot.entrance.y) < 42);
  assert.equal(Number((await currentActor(neighbor)).cash), Number(beforeHomeRide.cash) - 250);
  assert.deepEqual(await fares(neighbor), [...homeFares, -250]);
  assert.equal(homeArrived.homes.find(home => home.key === key).mine, true);
  if (process.env.CITY_WORLD_SHOTS) await cityPage.screenshot({ path: path.join(process.env.CITY_WORLD_SHOTS, 'city-world-home-arrival-375.png') });
  await openAtlas(); await activate(cityPage.locator(`.city-world__home[data-city-home="${key}"]`));

  let releaseDeed, observeDeed;
  const deedGate = new Promise(resolve => { releaseDeed = resolve; }), deedObserved = new Promise(resolve => { observeDeed = resolve; });
  const holdDeed = async route => { const reply = await route.fetch(); assert.equal(reply.status(), 200); assert.equal((await reply.json()).deed.name, street); observeDeed(); await deedGate; await route.fulfill({ response: reply }); };
  await cityPage.route('**/v1/deeds', holdDeed);
  try {
    await activate(cityPage.getByRole('button', { name: 'Open Street Deeds →', exact: true })); await bounded(deedObserved, 'the owned deed handoff GET');
    assert.deepEqual(await cityPage.evaluate(() => window.__worldNavigations.at(-1)), { tab: 'deeds',
      context: { venueId: 'clubhouse', streetKey: key, districtId: propertyDistrict, focus: 'owned-deed' } }, 'The scene forwards the actual owned-deed context to the host.');
    assert.equal(await cityPage.locator('#city-owned-deed').count(), 0, 'A deed heading is not rendered or focused before its actual winning GET.');
    releaseDeed(); await cityPage.waitForFunction(() => document.activeElement?.id === 'city-owned-deed');
    assert.match(await cityPage.locator('#city-owned-deed').textContent(), new RegExp(street));
  } finally { releaseDeed(); await cityPage.unroute('**/v1/deeds', holdDeed); }
  await cityPage.locator('#btn-player-view').tap(); await districtReady(propertyDistrict); await openAtlas(); await selectDistrict(propertyDistrict);
  await activate(cityPage.locator(`.city-world__home[data-city-home="${key}"]`));
  let releaseRetiredDeed, observeRetiredDeed;
  const retiredDeedGate = new Promise(resolve => { releaseRetiredDeed = resolve; }), retiredDeedObserved = new Promise(resolve => { observeRetiredDeed = resolve; });
  const holdRetiredDeed = async route => { const reply = await route.fetch(); assert.equal(reply.status(), 200); observeRetiredDeed(); await retiredDeedGate; await route.fulfill({ response: reply }); };
  await cityPage.route('**/v1/deeds', holdRetiredDeed);
  try {
    await activate(cityPage.getByRole('button', { name: 'Open Street Deeds →', exact: true })); await bounded(retiredDeedObserved, 'the retired navigation deed GET');
    await activate(cityPage.locator('#bnav [data-go="streets"]')); releaseRetiredDeed(); await frames(cityPage);
    assert.notEqual(await cityPage.evaluate(() => document.activeElement?.id), 'city-owned-deed');
    assert.equal(await cityPage.locator('#tab-streets:not(.hidden)').count(), 1, 'A late deed read cannot override a newer human navigation.');
  } finally { releaseRetiredDeed(); await cityPage.unroute('**/v1/deeds', holdRetiredDeed); }
  await cityPage.locator('#btn-player-view').tap(); await districtReady(propertyDistrict); await openAtlas(); await selectDistrict(propertyDistrict);
  await selectDistrict('neon'); assert.equal(await cityPage.locator('[data-city-travel="neon"]').isEnabled(), true);
  await cityPage.locator('[data-city-travel="neon"]').evaluate(node => { window.__retiredAtlasTravel = node; });
  await selectDistrict(propertyDistrict);
  await activate(cityPage.locator(`.city-world__home[data-city-home="${key}"]`));
  const desktopHandle = await cityPage.evaluateHandle(() => window.__worldHandles.at(-1)), desktopPose = (await state(cityPage)).position;
  await cityPage.setViewportSize({ width: 1440, height: 1000 }); await frames(cityPage);
  assert(await cityPage.evaluate(handle => window.__worldHandles.at(-1) === handle && !handle.destroyed, desktopHandle));
  assert.deepEqual((await state(cityPage)).position, desktopPose, 'Passive resizing preserves the current home arrival pose.');
  await openAtlas(); await selectDistrict(propertyDistrict); await assertCaptionInspection();
  await activate(cityPage.locator(`.city-world__home[data-city-home="${key}"]`));
  await assertFrame(cityPage);
  assert(await cityPage.evaluate(handle => window.__worldHandles.at(-1) === handle && !handle.destroyed, desktopHandle));
  assert.deepEqual((await state(cityPage)).position, desktopPose, 'Explicit desktop atlas entry reveals the same canvas and pose.');
  await desktopHandle.dispose();
  if (process.env.CITY_WORLD_SHOTS) await cityPage.screenshot({ path: path.join(process.env.CITY_WORLD_SHOTS, 'city-world-atlas-property-desktop.png') });
  const privateAt = cityRequests.length;
  let releasePrivateDeed, observePrivateDeed, releaseLogout, privateDeedOnce = false;
  const privateDeedGate = new Promise(resolve => { releasePrivateDeed = resolve; }), privateDeedObserved = new Promise(resolve => { observePrivateDeed = resolve; });
  const logoutGate = new Promise(resolve => { releaseLogout = resolve; });
  const holdPrivateDeed = async route => {
    if (privateDeedOnce) return route.continue(); privateDeedOnce = true;
    const reply = await route.fetch(); assert.equal(reply.status(), 200); observePrivateDeed(); await privateDeedGate; await route.fulfill({ response: reply });
  };
  await cityPage.route('**/v1/deeds', holdPrivateDeed);
  const holdLogout = async route => { const reply = await route.fetch(); assert.equal(reply.status(), 200); await logoutGate; await route.fulfill({ response: reply }); };
  await cityPage.route('**/v1/access/logout', holdLogout);
  try {
    await activate(cityPage.getByRole('button', { name: 'Open Street Deeds →', exact: true })); await bounded(privateDeedObserved, 'the old owner\'s held real deed GET');
    await cityPage.locator('#btn-logout').click();
    const logout = cityPage.locator('.modal-bg[data-managed-dialog]').last(); await logout.waitFor({ state: 'visible' }); await logout.locator('[data-yes]').click();
    await cityPage.locator('#screen-auth:not(.hidden)').waitFor(); releasePrivateDeed(); await frames(cityPage);
    assert.equal(await cityPage.locator('[data-city-home],.city-world__dock,.city-world__receipt').count(), 0);
    assert.notEqual(await cityPage.evaluate(() => document.activeElement?.id), 'city-owned-deed', 'A held deed handoff cannot focus private content after owner retirement.');
    await cityPage.evaluate(() => window.__retiredAtlasTravel.click()); await frames(cityPage);
    assert.equal(mutations(cityRequests.slice(privateAt)).filter(request => request.path.startsWith('/v1/travel/')).length, 0);
  } finally {
    releasePrivateDeed(); releaseLogout();
    await cityPage.unroute('**/v1/deeds', holdPrivateDeed); await cityPage.unroute('**/v1/access/logout', holdLogout);
  }
  await connected.context.close();
  console.log('world host: canonical claim and same-parcel sale reveal fresh owned homes without fare, guarded deed focus, navigation cancellation and private teardown pass');
  }
  assert.deepEqual(errors, []);
  for (const context of contexts) await context.close();
  console.log('city-world-host-browser: actual tools/header, shared objective, equipment/outfit/room, waypoint walking, base-stat feedback, consented two-message chat, decorative routines, reduced motion and responsive camera pass');
} finally { await browser?.close(); for (const cleanup of fixtureCleanup) await cleanup(); await app.close(); }
