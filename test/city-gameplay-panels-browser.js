// Real Home/PvE controls and known-authority retirement. Responses always come from the actual server.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';
import { ledger } from '../src/game.js';
import { grantStack, withItemTransaction } from '../src/items.js';
import { STAGED_CREW_MISSIONS_PACKAGE as mission } from '../src/content/staged-crew-missions.js';
import { CITY_WORLD_OPPORTUNITIES } from '../src/content/city-world-opportunities.js';

assert(!process.env.DATABASE_URL, 'Gameplay panel browser fixtures require disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off'; process.env.POPULATION_OFF = 'on';
const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
assert(executablePath);
const app = await buildServer(), contexts = [], errors = [];
const bindingInverse = process.argv.includes('--binding-inverse');
const adventureBindingInverse = process.argv.includes('--adventure-binding-inverse');
const crewPollingInverse = process.argv.includes('--crew-polling-inverse');
const crewLoadingInverse = process.argv.includes('--crew-loading-inverse');
let browser;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const bounded = (promise, label) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error('Timed out waiting for ' + label)), 30000);
  promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});
try {
  const create = async name => {
    const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });
    assert.equal(guest.statusCode, 200, guest.body);
    const token = guest.json().token, account = app.jwt.verify(token).sub, headers = { authorization: 'Bearer ' + token };
    const made = await app.inject({ method: 'POST', url: '/v1/character', headers, payload: { name } }); assert.equal(made.statusCode, 200, made.body);
    const row = (await app.pool.query('SELECT id,generation,cash FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
    await app.pool.query("UPDATE characters SET loc='docks',cash=100000,respect=10000,last_accrued_at=$2 WHERE id=$1", [row.id, new Date(Date.now() + 86400000)]);
    await ledger(app.pool, { characterId: row.id, currency: 'cash', amount: 100000 - Number(row.cash), reason: 'crime:gameplay-panels-fixture' });
    return { ...row, token, account, headers, name };
  };
  const post = (actor, path, body, key = crypto.randomUUID()) => app.inject({ method: 'POST', url: path, payload: body,
    headers: { ...actor.headers, 'idempotency-key': key } });
  const get = async (actor, path) => { const response = await app.inject({ url: path, headers: actor.headers }); assert.equal(response.statusCode, 200, response.body); return response.json(); };
  const success = async response => { const reply = await response; assert.equal(reply.statusCode, 200, reply.body); return reply.json(); };
  const completeDocks = async actor => {
    const root = '/v1/worldgraph/mysteries/district-docks-story';
    await success(post(actor, root + '/start', {}));
    await success(post(actor, root + '/nodes/mystery%3Adistrict-docks-story-introduction/complete', { interactionId: 'district-docks-story:meet' }));
    await success(post(actor, root + '/choices/choice%3Adistrict-docks-story-approach', { interactionId: 'district-docks-story:choose', optionId: 'witness' }));
    await success(post(actor, root + '/nodes/mystery%3Adistrict-docks-story-witness/complete', { interactionId: 'district-docks-story:witness' }));
    await success(post(actor, root + '/explore', {}));
    await success(post(actor, root + '/nodes/mystery%3Adistrict-docks-story-report/complete', { interactionId: 'district-docks-story:report' }));
  };
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ executablePath, headless: true });
  const activate = async (fixture, control) => {
    if ((await control.getAttribute('data-destination') !== null || await control.getAttribute('data-city-world-map') !== null)
      && await fixture.page.locator('.omerta-city__overview').isVisible() && await fixture.page.locator('.omerta-city__overview').getAttribute('open') === null) {
      for (const selector of ['[data-city-world-close]','[data-city-actor-close]','[data-city-training-close]','[data-city-close]']) {
        const close = fixture.page.locator(selector); if (await close.isVisible()) { if (fixture.viewport.width <= 680) await close.tap(); else await close.click(); }
      }
      const summary = fixture.page.locator('.omerta-city__overview > summary');
      if (fixture.viewport.width <= 680) await summary.tap(); else await summary.click();
    }
    if (await control.getAttribute('data-city-world-panel') !== null && await fixture.page.locator('.city-world__tabs').getAttribute('hidden') !== null) {
      const choices = fixture.page.locator('[data-city-world-back]');
      if (fixture.viewport.width <= 680) await choices.tap(); else await choices.click();
    }
    const at = await fixture.page.evaluate(() => window.__panelPointers.length);
    if (fixture.viewport.width <= 680) await control.tap(); else await control.click();
    const pointer = await fixture.page.evaluate(at => window.__panelPointers.slice(at).at(-1), at);
    assert(pointer?.trusted); assert.equal(pointer.pointerType, fixture.viewport.width <= 680 ? 'touch' : 'mouse');
  };
  const newPage = async (actor, viewport) => {
    const context = await browser.newContext({ viewport, isMobile: viewport.width <= 680, hasTouch: viewport.width <= 680, serviceWorkers: 'block' }); contexts.push(context);
    await context.addInitScript(token => {
      localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1');
      window.__panelHandles = []; window.__panelReads = []; window.__panelPointers = [];
      document.addEventListener('click', event => window.__panelPointers.push({ trusted: event.isTrusted, pointerType: event.pointerType }), true);
      let module;
      Object.defineProperty(window, 'OmertaCityScene', { configurable: true, get: () => module, set: value => {
        module = { ...value, mount(...args) {
          const read = args[1].onWorldRead;
          args[1] = { ...args[1], onWorldRead: async (kind, context) => {
            const record = { kind, settled: false }; window.__panelReads.push(record);
            const result = await read(kind, context); Object.assign(record, { code: result?.code, ignored: result?.ignored === true });
            queueMicrotask(() => queueMicrotask(() => { record.settled = true; record.current = context.isCurrent(); })); return result;
          } };
          const handle = value.mount(...args), entry = { handle, destroyed: false }; window.__panelHandles.push(entry);
          return { ...handle, destroy() { entry.destroyed = true; return handle.destroy(); } };
        } };
      } });
    }, actor.token);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.route(base + '/', async route => {
      const response = await route.fetch(), source = await response.text(), anchor = '  async function readCityWorld(kind, context = {}) {';
      let html = source;
      if (bindingInverse) {
        const guard = '&& action.path===payload.path && JSON.stringify(action.body)===JSON.stringify(payload.body)';
        assert.equal(html.split(guard).length, 2, 'The bounded inverse removes only the single Home lookup freshness guard.');
        html = html.replace(guard, '');
      }
      if (adventureBindingInverse) {
        const guard = '&& JSON.stringify(action.body) === JSON.stringify(payload.body)';
        assert.equal(html.split(guard).length, 2, 'The focused Adventure inverse removes exactly its one issuer body-match guard.');
        html = html.replace(guard, '');
      }
      assert.equal(html.split(anchor).length, 2);
      await route.fulfill({ response, body: html.replace(anchor,
        '  window.__panelProbe = () => ({ authority: _cityAuthorityRevision, pending: _cityWorldPending,\n'
        + '    encounterRevision: _cityWorldData?.encounters?.active?.revision || null,\n'
        + '    homeKey: _cityWorldData?.["home-interior"]?.home?.key || null,\n'
        + '    viewer: me ? { characterId: me.id, generation: me.generation, district: me.loc } : null });\n' + anchor) });
    });
    if (crewPollingInverse) await page.route('**/world-fieldwork.js*', async route => {
      const response = await route.fetch(), source = await response.text();
      const trigger = "await load(['operations'], { background: true });";
      assert.equal(source.split(trigger).length, 2, 'The inverse removes only the new timed Crew read.');
      await route.fulfill({ response, body: source.replace(trigger, 'void 0;') });
    });
    if (crewLoadingInverse) await page.route('**/world-fieldwork.js*', async route => {
      const response = await route.fetch(), source = await response.text();
      const gate = 'backgroundLoading = background; loading = !background;';
      assert.equal(source.split(gate).length, 2, 'The inverse restores only the invisible background action lock.');
      await route.fulfill({ response, body: source.replace(gate, 'backgroundLoading = background; loading = true;') });
    });
    await page.goto(base, { waitUntil: 'networkidle' }); await page.locator('#screen-main:not(.hidden)').waitFor();
    if (await page.locator('.modal-bg[data-managed-dialog]').count()) await page.keyboard.press('Escape');
    const fixture = { page, context, actor, viewport }; await activate(fixture, page.locator('#btn-player-view'));
    await page.waitForFunction(() => window.__panelHandles.at(-1)?.handle.getState().ready);
    assert.deepEqual(await page.evaluate(() => [typeof window.CityHomeUi?.render, typeof window.CityAdventureUi?.render]),
      ['function', 'function'], 'Actual Home and Adventure assets must load through the server routes.');
    return fixture;
  };
  const state = fixture => fixture.page.evaluate(() => window.__panelHandles.at(-1)?.handle.getState());
  const settled = fixture => fixture.page.waitForFunction(() => !window.__panelProbe().pending && !document.querySelector('#busy.on')
    && window.__panelReads.every(read => read.settled));
  const same = async (fixture, entry, position) => {
    assert.deepEqual((await state(fixture)).position, position);
    assert(await fixture.page.evaluate(entry => window.__panelHandles.at(-1) === entry && !entry.destroyed, entry));
  };
  const panel = async (fixture, kind) => {
    if (await fixture.page.locator('.city-world__dock').isVisible()) await activate(fixture, fixture.page.locator('[data-city-world-close]'));
    await activate(fixture, fixture.page.locator('[data-city-world-tools]'));
    await activate(fixture, fixture.page.locator(`[data-city-world-panel="${kind}"]`)); await settled(fixture);
  };
  const adventureRevisionJourney = async viewport => {
    const actor = await create('Panel Revision Player ' + viewport.width), fixture = await newPage(actor, viewport);
    await fixture.page.emulateMedia({ reducedMotion: viewport.width <= 680 ? 'reduce' : 'no-preference' });
    await fixture.page.evaluate(() => { window.__drillAnimations = []; document.addEventListener('animationstart', event => {
      if (event.animationName === 'city-drill-step') window.__drillAnimations.push(event.target.closest('[data-city-drill]')?.dataset.cityDrillRevision);
    }); });
    const entry = await fixture.page.evaluateHandle(() => window.__panelHandles.at(-1)), position = (await state(fixture)).position;
    await panel(fixture, 'adventures');
    const prepared = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/v1/city/encounters/start');
    await activate(fixture, fixture.page.locator('[data-city-adventure-action="start:docks-patrol"]'));
    const preparation = await prepared; assert.equal(preparation.status(), 200);
    const initial = (await preparation.json()).encounter; assert.equal(initial.revision, 1); await settled(fixture);
    const drill = fixture.page.locator('[data-city-drill]');
    assert.equal(await drill.count(), 1);
    assert.equal(await drill.locator('.city-drill__stage').getAttribute('data-intent'), initial.intent);
    assert.deepEqual(await drill.locator('meter').evaluateAll(nodes => nodes.map(node => [node.value, node.max])),
      [[initial.health,initial.maxHealth],[initial.stamina,10],[initial.enemyHealth,initial.enemyMaxHealth]]);
    assert.equal(await drill.locator('.city-drill__stage img').count(), 2, 'Both drill participants are staged visibly without adding world actors.');
    await fixture.page.waitForFunction(() => [...document.querySelectorAll('.city-drill__stage img')].length === 2
      && [...document.querySelectorAll('.city-drill__stage img')].every(node => node.complete && node.naturalWidth > 0));
    assert(await drill.locator('.city-drill__stage img').evaluateAll(nodes => nodes.every(node => node.complete && node.naturalWidth > 0)), 'Existing pixel art actually loads.');
    assert((await fixture.page.locator('.city-drill__moves').textContent()).includes('momentum from guarding strengthens it'));
    assert((await fixture.page.locator('.city-drill__moves').textContent()).includes('Recover stamina up to its cap'));
    assert.equal(await drill.locator('.city-drill__result').textContent(), initial.last);
    await same(fixture, entry, position);
    const turnPath = '/v1/city/encounters/' + encodeURIComponent(initial.id) + '/turn';
    const gate = deferred(), committed = deferred(), playerGate = deferred(), playerHeld = deferred();
    let playerOnce = false;
    const holdPlayer = async route => {
      if (playerOnce) return route.continue(); playerOnce = true;
      const response = await route.fetch(); assert.equal(response.status(), 200);
      const body = await response.json(), player = body.player?.character || body.player; assert.equal(player.id, actor.id);
      playerHeld.resolve(); await playerGate.promise; await route.fulfill({ response });
    };
    const hold = async route => { const response = await route.fetch(); assert.equal(response.status(), 200);
      const body = await response.json(); assert.equal(body.encounter.revision, 2); committed.resolve(body);
      await gate.promise; await route.fulfill({ response }); };
    await fixture.page.route(base + turnPath, hold);
    await fixture.page.route('**/v1/projections/player*', holdPlayer);
    const guarded = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === turnPath); guarded.catch(() => {});
    let displayed;
    try {
      await activate(fixture, fixture.page.locator('[data-city-adventure-action="guard"]'));
      await bounded(committed.promise, 'the first real guard commit with ACK held');
      await activate(fixture, fixture.page.locator('[data-city-world-close]'));
      await activate(fixture, fixture.page.locator('[data-city-world-tools]'));
      const reopened = fixture.page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/v1/city/encounters');
      await activate(fixture, fixture.page.locator('[data-city-world-panel="adventures"]'));
      // Authenticated reads queue behind the POST. Deliver its real ACK only after the
      // reopen reads are queued, then hold the action's real player-refresh response.
      gate.resolve();
      const opening = await reopened; assert.equal(opening.status(), 200); displayed = (await opening.json()).active;
      assert.equal(displayed.id, initial.id); assert.equal(displayed.revision, 2);
      await fixture.page.locator(`[data-city-encounter="${initial.id}"]`).getByText(/^Round 2\/12/).waitFor();
      assert.equal(await fixture.page.evaluate(() => window.__panelProbe().encounterRevision), 2);
      await bounded(playerHeld.promise, 'the original guard completion player GET held before publication');
      const external = displayed.actions.find(action => action.id === 'guard'); assert(external?.available);
      const advance = await success(post(actor, external.path, external.body));
      assert.equal(advance.encounter.revision, 3); assert.equal(advance.encounter.turn, 2);
      assert.equal((await get(actor, '/v1/city/encounters')).active.revision, 3);
    } finally { gate.resolve(); playerGate.resolve(); }
    const oldAck = await guarded; assert.equal(oldAck.status(), 200); assert.equal((await oldAck.json()).encounter.revision, 2);
    await fixture.page.unroute(base + turnPath, hold); await fixture.page.unroute('**/v1/projections/player*', holdPlayer); await settled(fixture);
    await fixture.page.waitForFunction(() => window.__panelProbe().encounterRevision === 3);
    await same(fixture, entry, position);
    assert.equal(await fixture.page.locator(`[data-city-encounter="${initial.id}"]`).getByText(/^Round 2\/12/).count(), 1,
      'The visible board genuinely remains revision2 while the root issuer cache has revision3.');
    const stale = displayed.actions.find(action => action.id === 'guard'); assert.equal(stale.body.expectedRevision, 2);
    const posts = [], track = request => { if (request.method() === 'POST' && new URL(request.url()).pathname === turnPath) posts.push(request.postDataJSON()); };
    fixture.page.on('request', track);
    try {
      assert.equal(await fixture.page.locator('[data-city-adventure-action="guard"]').isEnabled(), true);
      await activate(fixture, fixture.page.locator('[data-city-adventure-action="guard"]')); await settled(fixture);
      if (adventureBindingInverse) {
        assert.equal(posts.length, 1); assert.equal(posts[0].expectedRevision, 3);
        assert.equal((await get(actor, '/v1/city/encounters')).active.revision, 4);
        console.log('Adventure body-match inverse reached:', viewport.width, 'actual held ACK/cache3/display2; old visible guard consumed newer body3 and advanced revision4');
      }
      assert.deepEqual(posts, [], 'Stale revision2 Adventure control must send ZERO POST instead of rebinding the newer revision3 body.');
      assert.equal((await get(actor, '/v1/city/encounters')).active.revision, 3);
      assert((await fixture.page.locator('.city-world__dock').textContent()).includes('This adventure changed. Refresh it before making your choice.'));
      await same(fixture, entry, position);
      const refresh = fixture.page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/v1/city/encounters');
      await activate(fixture, fixture.page.getByRole('button', { name: 'Refresh encounters', exact: true }));
      const refreshed = await refresh; assert.equal(refreshed.status(), 200); const current = (await refreshed.json()).active;
      assert.equal(current.revision, 3); await settled(fixture);
      await fixture.page.locator(`[data-city-encounter="${initial.id}"]`).getByText(/^Round 3\/12/).waitFor();
      if (viewport.width > 680) await fixture.page.waitForFunction(() => window.__drillAnimations.includes('3'));
      else assert.equal(await fixture.page.locator('.city-drill__player').evaluate(node => getComputedStyle(node).animationName), 'none', 'Reduced motion keeps the same tactical information without a move animation.');
      const animations = await fixture.page.evaluate(() => window.__drillAnimations.length);
      const unchangedRead = fixture.page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/v1/city/encounters');
      await activate(fixture, fixture.page.getByRole('button', { name: 'Refresh encounters', exact: true }));
      const unchanged = await unchangedRead; assert.equal(unchanged.status(), 200); assert.equal((await unchanged.json()).active.revision, 3);
      await settled(fixture);
      await fixture.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await fixture.page.evaluate(() => window.__drillAnimations.length), animations, 'Refreshing the same confirmed revision does not replay a move animation.');
      assert.deepEqual(posts, [], 'Inspecting intent, previews and unchanged results never sends a gameplay action.');
      const fresh = current.actions.find(action => action.id === 'guard'); assert(fresh?.available); assert.equal(fresh.body.expectedRevision, 3);
      const accepted = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === turnPath);
      await activate(fixture, fixture.page.locator('[data-city-adventure-action="guard"]'));
      const response = await accepted; assert.equal(response.status(), 200); assert.deepEqual(response.request().postDataJSON(), fresh.body);
      assert.equal((await response.json()).encounter.revision, 4); await settled(fixture); await same(fixture, entry, position);
      assert.deepEqual(posts, [fresh.body], 'Only the refreshed visible revision3 control sends one exact issued body.');
    } finally { fixture.page.off('request', track); }
    await entry.dispose(); await fixture.context.close();
    console.log('Adventure body binding passed:', viewport.width, 'real held ACK; displayed2/root cache3; stale native guard ZERO POST/state3; native refresh3 then exact displayed body3 once/state4; same scene/pose');
  };
  const npcJourney = async viewport => {
    const actor = await create('Panel Favor Player ' + viewport.width), npc = await create('Panel Resident ' + viewport.width);
    await app.pool.query('UPDATE characters SET is_npc=true WHERE id=$1', [npc.id]);
    await app.pool.query('UPDATE account_persistent SET npc_flag=true WHERE account_id=$1', [npc.account]);
    const fixture = await newPage(actor, viewport), entry = await fixture.page.evaluateHandle(() => window.__panelHandles.at(-1));
    const position = (await state(fixture)).position;
    const trust = CITY_WORLD_OPPORTUNITIES.find(record => record.package.id === 'city-neighbor-favors');
    const note = trust.package.nodes.find(node => node.id === 'm:city-favors:return-note');
    const evidence = trust.package.nodes.find(node => node.id === 'e:city-favors:note');
    const money = async () => {
      const character = (await app.pool.query('SELECT cash,bank,health,respect,ammo FROM characters WHERE id=$1', [actor.id])).rows[0];
      const persistent = (await app.pool.query('SELECT omr,staked,rewards FROM account_persistent WHERE account_id=$1', [actor.account])).rows[0];
      const transactions = Number((await app.pool.query('SELECT COUNT(*) n FROM transactions WHERE character_id=$1 OR account_id=$2', [actor.id, actor.account])).rows[0].n);
      return { character, persistent, transactions };
    };
    const favor = async () => Number((await app.pool.query(`SELECT favor FROM city_npc_favors WHERE owner_character_id=$1
      AND owner_generation=$2 AND npc_character_id=$3 AND npc_generation=$4`, [actor.id, actor.generation, npc.id, npc.generation])).rows[0]?.favor || 0);
    const before = await money(), openingPosts = [];
    const trackOpening = request => { if (request.method() === 'POST') openingPosts.push(new URL(request.url()).pathname); };
    fixture.page.on('request', trackOpening);
    await panel(fixture, 'adventures');
    const index = await get(actor, '/v1/city/opportunities');
    const resident = index.npcs.find(row => row.id === npc.id); assert(resident); assert.equal(resident.name, npc.name); assert.equal(resident.favor, 0);
    const offered = index.opportunities.find(row => row.npcId === npc.id && row.title === trust.presentation.title); assert(offered?.available);
    const root = '/v1/city/opportunities/' + encodeURIComponent(npc.id) + '/' + offered.graphRef;
    const inspect = () => fixture.page.locator('.city-world__card').filter({ has: fixture.page.getByText(npc.name, { exact: true }) })
      .getByRole('button', { name: 'Inspect ' + offered.title, exact: true });
    await activate(fixture, inspect()); await settled(fixture); await same(fixture, entry, position);
    fixture.page.off('request', trackOpening);
    assert.deepEqual(openingPosts.filter(path => !['/v1/screens', '/v1/commands/observations'].includes(path)), [],
      'Opening real NPC opportunity index/detail is read-only.');
    assert.equal(await favor(), 0); assert.equal((await get(actor, root)).graph.started, false);
    assert.equal(await fixture.page.locator('[data-city-opportunity-detail]').count(), 1);
    assert(!(await fixture.page.locator('.city-world__content').textContent()).includes(note.metadata.description));
    const perform = async issued => {
      assert(issued?.available); assert.equal(issued.method, 'POST');
      const reply = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === issued.path);
      await activate(fixture, fixture.page.locator(`[data-city-adventure-action="${issued.id}"]`));
      if (issued.consequence) await activate(fixture, fixture.page.locator('.modal-bg[data-managed-dialog] [data-yes]').last());
      const response = await reply; assert.equal(response.status(), 200); assert.deepEqual(response.request().postDataJSON(), issued.body);
      assert(response.request().headers()['idempotency-key']); await settled(fixture); await same(fixture, entry, position); return response;
    };
    const availableNode = (board, id) => board.nodes.find(node => node.id === id)?.actions.find(action => action.available);
    await perform((await get(actor, root)).actions.find(action => action.id.endsWith(':start')));
    await perform(availableNode(await get(actor, root), 'm:city-favors:meet'));
    assert(!(await fixture.page.locator('.city-world__content').textContent()).includes(note.metadata.description), 'The first hidden lead is absent before actual exploration.');
    await perform((await get(actor, root)).actions.find(action => action.id.endsWith(':explore')));
    assert((await fixture.page.locator('[data-city-opportunity-detail]').textContent()).includes(note.metadata.description));
    const returned = await perform(availableNode(await get(actor, root), note.id));
    assert.deepEqual((await returned.json()).favor, { before: 0, after: 1 }); assert.equal(await favor(), 1);
    const after = await get(actor, root); assert.equal(after.relationship.favor, 1); assert.equal(after.relationship.tier, 'familiar');
    assert((await fixture.page.locator('[data-city-opportunity-detail]').textContent()).includes(evidence.metadata.description));
    assert((await fixture.page.locator('.city-world__content').textContent()).includes('Favors 1/3'));
    assert.deepEqual(await money(), before, 'The first favor moves no cash, bank, OMR, core health, respect, ammo or money-ledger entry.');
    const replay = await success(post(actor, returned.request().url().slice(base.length), returned.request().postDataJSON(), returned.request().headers()['idempotency-key']));
    assert.deepEqual(replay, await returned.json()); assert.equal(await favor(), 1);

    // Both refusals use the currently issued native control/body. Only actual server actor state changes.
    const refuse = async (issued, expectedError, identityChanged) => {
      assert(issued?.available); const oldViewer = await fixture.page.evaluate(() => window.__panelProbe().viewer);
      const authority = await fixture.page.evaluate(() => window.__panelProbe().authority);
      assert.equal(issued.body.characterId, oldViewer.characterId); assert.equal(issued.body.generation, oldViewer.generation);
      const gate = deferred(), held = deferred(); let sent = false;
      const mark = request => { if (request.method() === 'POST' && new URL(request.url()).pathname === issued.path) sent = true; };
      const hold = async route => {
        if (!sent) return route.continue(); const response = await route.fetch(); assert.equal(response.status(), 200);
        const body = await response.json(), player = body.player?.character || body.player;
        assert.equal(player.id, actor.id); assert.equal(Number(player.generation), Number(actor.generation) + (identityChanged ? 1 : 0));
        held.resolve(); await gate.promise; await route.fulfill({ response });
      };
      fixture.page.on('request', mark); await fixture.page.route('**/v1/projections/player*', hold);
      const refusal = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === issued.path); refusal.catch(() => {});
      try {
        if (identityChanged) await app.pool.query('UPDATE characters SET generation=generation+1 WHERE id=$1', [actor.id]);
        else await app.pool.query("UPDATE characters SET loc='canal' WHERE id=$1", [npc.id]);
        await activate(fixture, fixture.page.locator(`[data-city-adventure-action="${issued.id}"]`));
        const response = await refusal; assert.equal(response.status(), 409); assert.equal((await response.json()).error, expectedError);
        assert.deepEqual(response.request().postDataJSON(), issued.body);
        await bounded(held.promise, 'the real player GET after the NPC refusal');
        assert.equal(await fixture.page.locator('[data-city-opportunity-detail]').count(), 0, 'Known refusal removes private NPC detail before the player refresh publishes.');
        assert(!(await fixture.page.locator('.city-world__content').textContent()).includes(evidence.metadata.description));
        assert.deepEqual(await fixture.page.evaluate(() => window.__panelProbe().viewer), oldViewer);
        if (identityChanged) assert.equal(await fixture.page.evaluate(() => window.__panelProbe().authority), authority + 1);
        await same(fixture, entry, position); assert.equal(await favor(), 1); assert.deepEqual(await money(), before);
        assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM mystery_node_state WHERE node_id=$1 AND instance_id=$2',
          ['choice:city-favors:confidence', after.graph.instanceId])).rows[0].n), 0, 'Refusal cannot discover or advance the next private branch.');
      } finally { gate.resolve(); }
      await fixture.page.unroute('**/v1/projections/player*', hold); fixture.page.off('request', mark); await settled(fixture);
    };
    await refuse(after.actions.find(action => action.id.endsWith(':explore')), 'city_npc_unavailable', false);
    await app.pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [npc.id]);
    await activate(fixture, fixture.page.getByRole('button', { name: 'NPC favors & discoveries', exact: true })); await settled(fixture);
    await activate(fixture, inspect()); await settled(fixture);
    assert((await fixture.page.locator('[data-city-opportunity-detail]').textContent()).includes(evidence.metadata.description));
    await refuse((await get(actor, root)).actions.find(action => action.id.endsWith(':explore')), 'city_opportunity_identity_changed', true);
    await fixture.page.waitForFunction(generation => window.__panelProbe().viewer?.generation === generation && window.__panelHandles.at(-1)?.handle.getState().ready, Number(actor.generation) + 1);
    assert(await entry.evaluate(record => record.destroyed), 'Winning identity publication retires the old NPC scene.');
    await panel(fixture, 'adventures');
    const fresh = await get(actor, '/v1/city/opportunities'); assert.equal(fresh.npcs.find(row => row.id === npc.id).favor, 0);
    assert.equal(await fixture.page.locator('[data-city-opportunity-detail]').count(), 0);
    assert(!(await fixture.page.locator('.city-world__content').textContent()).includes(evidence.metadata.description), 'Old private evidence cannot reappear in the new character generation.');
    assert.equal(await favor(), 1); assert.deepEqual(await money(), before);
    await entry.dispose(); await fixture.context.close();
    console.log('NPC Adventures passed:', viewport.width, 'real resident; zero gameplay POST opening; native start/step/discovery/first favor; durable 1/3 with no money effects; exact receipt replay; current-body target/generation refusals; private detail retirement before held player GET; same scene/pose until identity publication');
  };
  const cooperativeHomeJourney = async () => {
    const host = await create('Room Pair Host'), guest = await create('Room Pair Guest');
    await success(post(host,'/v1/deeds/claim',{name:'Two Voices Browser',district:'docks'}));
    const key=(await get(host,'/v1/city/homes?district=docks')).myHome.key;
    const interior=actor=>get(actor,'/v1/city/home/interior?homeKey='+encodeURIComponent(key));
    const activateHome=(await interior(host)).actions.find(action=>action.id==='activate'); await success(post(host,activateHome.path,activateHome.body));
    let board=await interior(host);const layout=board.actions.find(action=>action.id==='layout');
    await success(post(host,layout.path,{...layout.body,room:{furniture:[{id:'chair',x:0,y:0},{id:'table',x:1,y:0},{id:'lamp',x:2,y:0}]}}));
    const invite=(await interior(host)).actions.find(action=>action.id==='invite');
    const invited=await success(post(host,invite.path,{...invite.body,targetCharacterId:guest.id}));
    const permission=(await get(guest,'/v1/city/home/invitations')).invitations.find(row=>row.id===invited.effect.grantId).action;
    await success(post(guest,permission.path,permission.body));
    const a=await newPage(host,{width:1440,height:1000}),b=await newPage(guest,{width:375,height:812});
    const snapshots=[];const writes=[];
    for(const fixture of [a,b]){fixture.page.on('request',request=>{if(request.method()==='POST')writes.push(new URL(request.url()).pathname);});
      snapshots.push({entry:await fixture.page.evaluateHandle(()=>window.__panelHandles.at(-1)),pose:(await state(fixture)).position});await panel(fixture,'room');}
    await activate(a,a.page.getByRole('button',{name:'Enter Two Voices Browser',exact:true}));await settled(a);
    await activate(b,b.page.getByRole('button',{name:'Enter home',exact:true}));await settled(b);
    for(const fixture of [a,b])await activate(fixture,fixture.page.getByRole('button',{name:'Hosting',exact:true}));
    assert.deepEqual(writes,[],'Entering a granted home and selecting Hosting do not imply puzzle consent.');
    const send=async(fixture,control,path)=>{const reply=fixture.page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname===path);
      await activate(fixture,control);assert.equal((await reply).status(),200);await settled(fixture);};
    const refresh=async fixture=>{await activate(fixture,fixture.page.getByRole('button',{name:'Refresh this room',exact:true}));await settled(fixture);};
    await send(a,a.page.locator('.city-world__card').filter({has:a.page.getByText('Two voices, one room',{exact:true})}).getByRole('button',{name:'Open puzzle',exact:true}),'/v1/city/home/activity/open');
    for(const fixture of [a,b]){await refresh(fixture);await activate(fixture,fixture.page.getByLabel('Share my name and join this home puzzle',{exact:true}));
      await send(fixture,fixture.page.getByRole('button',{name:'Join puzzle',exact:true}),'/v1/city/home/activity/join');}
    await refresh(a);await refresh(b);
    assert(!(await a.page.locator('[data-city-home-activity]').textContent()).includes('where a visitor sits'));
    assert((await b.page.locator('[data-city-home-activity]').textContent()).includes('where a visitor sits'));
    for(const [actor,fixture,furnishing]of [[host,a,'chair'],[guest,b,'table'],[host,a,'lamp']]){
      await refresh(fixture);const cell=(await interior(actor)).activity.active.cells.find(cell=>cell.furnishingId===furnishing);
      await send(fixture,fixture.page.getByRole('button',{name:cell.label,exact:true}),cell.action.path);
    }
    await refresh(b);assert((await b.page.locator('[data-city-home-activity]').textContent()).includes('Confirmed solved:'));
    assert.equal((await get(host,'/v1/city/home/activity-history')).outcomes[0].outcome.puzzleId,'two-voices-v1');
    assert.equal((await get(guest,'/v1/city/home/activity-history')).outcomes[0].outcome.puzzleId,'two-voices-v1');
    for(const [index,fixture]of [a,b].entries()){await same(fixture,snapshots[index].entry,snapshots[index].pose);await snapshots[index].entry.dispose();await fixture.context.close();}
    assert.deepEqual(writes,['/v1/city/home/activity/open','/v1/city/home/activity/join','/v1/city/home/activity/join',...Array(3).fill('/v1/city/home/activity/answer')]);
    console.log('Home cooperative browser PASS: real desktop host/phone guest, explicit dual consent, private complementary clue, alternating issued actions, both confirmed histories and unchanged scene/pose');
  };
  await cooperativeHomeJourney();
  for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 1000 }]) {
    await adventureRevisionJourney(viewport);
    await npcJourney(viewport);
    const actor = await create('Panel Browser ' + viewport.width), street = 'Panel Home ' + viewport.width;
    const claim = await post(actor, '/v1/deeds/claim', { name: street, district: 'docks' }); assert.equal(claim.statusCode, 200, claim.body);
    const directory = await get(actor, '/v1/city/homes?district=docks'); assert(directory.myHome);
    const homeKey = directory.myHome.key;
    const fixture = await newPage(actor, viewport);
    await panel(fixture, 'room');
    const enter = fixture.page.getByRole('button', { name: 'Enter ' + directory.myHome.street, exact: true });
    assert.equal(await enter.count(), 1, JSON.stringify(await fixture.page.evaluate(() => ({ homeUi: typeof window.CityHomeUi,
      reads: window.__panelReads, roomText: document.querySelector('.city-world__content')?.textContent.slice(0, 380) }))));
    await activate(fixture, enter); await settled(fixture);
    const owned = await get(actor, '/v1/city/home/interior?homeKey=' + encodeURIComponent(homeKey));
    const activation = owned.actions.find(action => action.id === 'activate'); assert(activation?.available);
    const activated = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === activation.path);
    await activate(fixture, fixture.page.getByRole('button', { name: activation.label, exact: true }));
    const activationReply = await activated; assert.equal(activationReply.status(), 200); await settled(fixture);
    await fixture.page.locator('[data-city-deed-room]').waitFor({ state: 'visible' });
    await activate(fixture, fixture.page.getByRole('button', { name: 'Workbench', exact: true }));
    const salvage = fixture.page.locator('.city-world__card').filter({ has: fixture.page.getByText('Strip a Wreck', { exact: true }) });
    assert(await salvage.isVisible(), 'The workbench station exposes the real recipe controls.');
    assert((await salvage.textContent()).includes('1 × Car'), 'The real asset ingredient has a readable label.');
    assert((await salvage.textContent()).includes('Use Crafting for car salvage.'), 'The real salvage refusal explains where to continue.');
    assert(!(await fixture.page.locator('.city-world__content').textContent()).match(/undefined|recipe_location|recipe_owns_car|salvage_required/),
      'Home recipe presentation does not print missing fields or internal blocker codes.');
    await activate(fixture, fixture.page.getByRole('button', { name: 'Room & furniture', exact: true }));
    const initialRoom = await get(actor, '/v1/city/home/interior?homeKey=' + encodeURIComponent(homeKey));
    const draftEntry = await fixture.page.evaluateHandle(() => window.__panelHandles.at(-1)), draftPose = (await state(fixture)).position;
    const draftPosts = [], trackDraft = request => { if (request.method() === 'POST') draftPosts.push(new URL(request.url()).pathname); };
    fixture.page.on('request', trackDraft);
    const previewCell = fixture.page.getByRole('button', { name: 'Preview column 2, row 2', exact: true });
    const previewBounds = await previewCell.boundingBox(); assert(previewBounds.width >= 44 && previewBounds.height >= 44);
    for (const label of ['Rotate preview', 'Place in draft', 'Undo last placement', 'Reset to confirmed room', 'Save furnishing', 'Refresh this room']) {
      const control = fixture.page.getByRole('button', { name: label, exact: true });
      const bounds = await control.boundingBox(); assert(bounds.height >= 44, label + ' retains a 44px touch target.');
    }
    await activate(fixture, previewCell); await activate(fixture, fixture.page.getByRole('button', { name: 'Rotate preview', exact: true }));
    await activate(fixture, fixture.page.getByRole('button', { name: 'Place in draft', exact: true }));
    assert.equal(await fixture.page.getByRole('img', { name: /rotation 90 degrees/ }).count(), 1);
    if(process.env.CITY_HOME_SHOTS){fs.mkdirSync(process.env.CITY_HOME_SHOTS,{recursive:true});await fixture.page.screenshot({path:process.env.CITY_HOME_SHOTS+'/home-draft-'+viewport.width+'.png'});}
    await activate(fixture, fixture.page.getByRole('button', { name: 'Undo last placement', exact: true }));
    assert.equal(await fixture.page.getByRole('img', { name: /rotation 90 degrees/ }).count(), 0);
    await activate(fixture, fixture.page.getByRole('button', { name: 'Place in draft', exact: true }));
    await activate(fixture, fixture.page.getByRole('button', { name: 'Refresh this room', exact: true })); await settled(fixture);
    assert.equal(await fixture.page.getByRole('img', { name: /rotation 90 degrees/ }).count(), 1, 'Ordinary refresh preserves the unsent furnishing draft.');
    assert.deepEqual(draftPosts, []); assert.deepEqual((await get(actor, '/v1/city/home/interior?homeKey=' + encodeURIComponent(homeKey))).room.furniture, initialRoom.room.furniture);
    const saveReply = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/v1/city/home/layout');
    await activate(fixture, fixture.page.getByRole('button', { name: 'Save furnishing', exact: true }));
    const saved = await saveReply; assert.equal(saved.status(), 200); assert.equal(saved.request().postDataJSON().expectedLayoutRevision, initialRoom.home.layoutRevision); await settled(fixture);
    assert.deepEqual(draftPosts, ['/v1/city/home/layout']);
    await same(fixture, draftEntry, draftPose); fixture.page.off('request', trackDraft); await draftEntry.dispose();
    const confirmed = await get(actor, '/v1/city/home/interior?homeKey=' + encodeURIComponent(homeKey));
    assert.equal(confirmed.room.furniture[0].rotation, 1);
    await activate(fixture, fixture.page.getByRole('button', { name: 'Preview column 3, row 2', exact: true }));
    await activate(fixture, fixture.page.getByRole('button', { name: 'Place in draft', exact: true }));
    const externalLayout = confirmed.actions.find(action => action.id === 'layout');
    await success(post(actor, externalLayout.path, { ...externalLayout.body, room: { furniture: [{ id: 'chair', x: 4, y: 4, rotation: 2 }] } }));
    await activate(fixture, fixture.page.getByRole('button', { name: 'Refresh this room', exact: true })); await settled(fixture);
    assert(await fixture.page.getByRole('button', { name: 'Save furnishing', exact: true }).isDisabled());
    assert((await fixture.page.locator('[data-city-home-station="room"]').textContent()).includes('Your draft is kept'));
    await activate(fixture, fixture.page.getByRole('button', { name: 'Reset to confirmed room', exact: true }));
    assert(await fixture.page.getByRole('button', { name: 'Save furnishing', exact: true }).isEnabled());
    const privateBefore = await get(actor, '/v1/city/home/interior?homeKey=' + encodeURIComponent(homeKey));
    const furnishing = privateBefore.room.catalog[0].id;
    const occupied = new Set(privateBefore.room.furniture.filter(item => item.id !== furnishing).map(item => item.x + ':' + item.y));
    const cell = Array.from({ length: 36 }, (_, i) => ({ x: i % 6, y: Math.floor(i / 6) })).find(cell => !occupied.has(cell.x + ':' + cell.y));
    assert(cell);
    await fixture.page.getByLabel('Home furnishing', { exact: true }).selectOption(furnishing);
    await fixture.page.getByLabel('Home column', { exact: true }).fill(String(cell.x + 1));
    await fixture.page.getByLabel('Home row', { exact: true }).fill(String(cell.y + 1));
    const entry = await fixture.page.evaluateHandle(() => window.__panelHandles.at(-1)), position = (await state(fixture)).position;
    const oldViewer = await fixture.page.evaluate(() => window.__panelProbe().viewer), oldAuthority = await fixture.page.evaluate(() => window.__panelProbe().authority);
    const gate = deferred(), held = deferred(); let postIssued = false;
    const markPost = request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/v1/city/home/layout') postIssued = true; };
    fixture.page.on('request', markPost);
    const holdPlayer = async route => {
      if (!postIssued) return route.continue();
      const response = await route.fetch(); assert.equal(response.status(), 200);
      const body = await response.json(), player = body.player?.character || body.player;
      assert.equal(player.id, actor.id); assert.equal(Number(player.generation), Number(actor.generation) + 1);
      held.resolve(); await gate.promise; await route.fulfill({ response });
    };
    await fixture.page.route('**/v1/projections/player*', holdPlayer);
    const refusal = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/v1/city/home/layout');
    refusal.catch(() => {});
    try {
      await app.pool.query('UPDATE characters SET generation=generation+1 WHERE id=$1', [actor.id]);
      await activate(fixture, fixture.page.getByRole('button', { name: 'Save furnishing', exact: true }));
      const rejected = await refusal; assert.equal(rejected.status(), 409); assert.equal((await rejected.json()).error, 'home_identity_changed');
      await bounded(held.promise, 'the actual next-generation player GET held before publication');
      assert.equal(await fixture.page.locator('[data-city-deed-room]').count(), 0, 'Known POST mismatch removes the old private floor before the player GET wins.');
      assert.equal(await fixture.page.getByRole('button', { name: 'Save furnishing', exact: true }).count(), 0);
      assert.equal(await fixture.page.locator('[data-city-quest-action]').count(), 0, 'Known mismatch clears the old quest realm immediately.');
      assert.deepEqual(await fixture.page.evaluate(() => window.__panelProbe().viewer), oldViewer,
        'The fresh player projection is still genuinely held during the retirement assertions.');
      assert.equal(await fixture.page.evaluate(() => window.__panelProbe().authority), oldAuthority + 1);
      await same(fixture, entry, position);
      assert.deepEqual((await get(actor, '/v1/city/home/interior?homeKey=' + encodeURIComponent(homeKey))).room.furniture,
        privateBefore.room.furniture, 'The rejected original-generation action never changes the actual room.');
    } finally { gate.resolve(); }
    await fixture.page.unroute('**/v1/projections/player*', holdPlayer); fixture.page.off('request', markPost);
    await fixture.page.waitForFunction(generation => window.__panelProbe().viewer?.generation === generation, Number(actor.generation) + 1);
    await fixture.page.waitForFunction(() => window.__panelHandles.at(-1)?.handle.getState().ready);
    assert(await entry.evaluate(record => record.destroyed), 'The winning new-generation projection finally retires its old scene.'); await entry.dispose();

    await panel(fixture, 'adventures');
    const liveEntry = await fixture.page.evaluateHandle(() => window.__panelHandles.at(-1)), livePose = (await state(fixture)).position;
    const encounterBefore = await get(actor, '/v1/city/encounters'); assert.equal(encounterBefore.scenarios.length, 1); assert.equal(encounterBefore.active, null);
    const prepared = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/v1/city/encounters/start');
    await activate(fixture, fixture.page.locator('[data-city-adventure-action="start:docks-patrol"]'));
    const prepareReply = await prepared; assert.equal(prepareReply.status(), 200); const prepareBody = await prepareReply.json();
    assert.equal(prepareBody.encounter.scenarioId, 'docks-patrol'); await settled(fixture); await same(fixture, liveEntry, livePose);
    const encounterId = prepareBody.encounter.id, turnPath = '/v1/city/encounters/' + encodeURIComponent(encounterId) + '/turn';
    const turnGate = deferred(), committed = deferred();
    const holdTurn = async route => { const response = await route.fetch(); assert.equal(response.status(), 200); committed.resolve(await response.json());
      await turnGate.promise; await route.fulfill({ response }); };
    await fixture.page.route(base + turnPath, holdTurn);
    const turnReply = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === turnPath); turnReply.catch(() => {});
    try {
      await activate(fixture, fixture.page.locator('[data-city-adventure-action="guard"]'));
      await bounded(committed.promise, 'the actual tactical turn commit');
      await activate(fixture, fixture.page.locator('[data-city-world-close]'));
    } finally { turnGate.resolve(); }
    const guarded = await turnReply; assert.equal(guarded.status(), 200); const firstTurn = await guarded.json();
    assert.equal(firstTurn.encounter.turn, 1); assert.equal(firstTurn.encounter.revision, 2); await settled(fixture);
    await fixture.page.unroute(base + turnPath, holdTurn);
    assert.equal(await fixture.page.locator('.city-world__dock').isVisible(), false, 'A sent tactical reply does not reopen a closed phone/desktop panel.');
    await same(fixture, liveEntry, livePose);
    const replay = await post(actor, turnPath, guarded.request().postDataJSON(), guarded.request().headers()['idempotency-key']);
    assert.equal(replay.statusCode, 200); assert.deepEqual(replay.json(), firstTurn);
    assert.equal((await get(actor, '/v1/city/encounters')).active.turn, 1, 'Exact replay never takes a second tactical turn.');
    await panel(fixture, 'adventures');
    let encounter = (await get(actor, '/v1/city/encounters')).active, turns = 1;
    while (encounter?.status === 'active' && turns < 12) {
      const move = encounter.intent === 'brace' && encounter.stamina >= 2 ? 'feint' : encounter.stamina >= 2 ? 'strike' : 'guard';
      assert(encounter.actions.find(action => action.id === move)?.available);
      const result = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === turnPath);
      await activate(fixture, fixture.page.locator(`[data-city-adventure-action="${move}"]`));
      const response = await result; assert.equal(response.status(), 200); encounter = (await response.json()).encounter; turns++;
      await settled(fixture); await same(fixture, liveEntry, livePose);
    }
    const completed = await get(actor, '/v1/city/encounters');
    assert.equal(completed.active, null); assert(completed.history.some(row => row.id === encounterId && row.status !== 'active'));

    const members = [actor, await create('Panel Lookout ' + viewport.width), await create('Panel Driver ' + viewport.width)];
    const crew = await success(post(actor, '/v1/crew', { name: 'Panel Crew ' + viewport.width }));
    for (const member of members.slice(1)) {
      await success(post(actor, '/v1/crew/invite', { name: member.name }));
      await success(post(member, '/v1/crew/accept/' + encodeURIComponent(crew.id), {}));
    }
    await completeDocks(actor);
    const crewOpen = async (wait = true) => {
      if (wait) {
        await panel(fixture, 'adventures');
        await activate(fixture, fixture.page.getByRole('button', { name: 'Crew mission board', exact: true }));
      } else {
        await activate(fixture, fixture.page.locator('[data-destination="clubhouse"]'));
        await activate(fixture, fixture.page.getByRole('button', { name: 'Open The Clubhouse →', exact: true }));
      }
      await fixture.page.locator('[data-fieldwork-view="operations"][aria-pressed="true"]').waitFor();
      if (!wait) return;
      await fixture.page.waitForFunction(() => {
        const refresh = document.querySelector('[data-city-crew-board] [data-fieldwork-refresh]');
        return refresh && !refresh.disabled && document.querySelector('[data-city-crew-board] .fieldwork-body')?.getAttribute('aria-busy') === 'false';
      });
    };
    const crewReady = () => fixture.page.waitForFunction(() => {
      const refresh = document.querySelector('[data-city-crew-board] [data-fieldwork-refresh]');
      return refresh && !refresh.disabled && document.querySelector('[data-city-crew-board] .fieldwork-body')?.getAttribute('aria-busy') === 'false'
        && !document.querySelector('#busy.on');
    });
    await crewOpen();
    const offer = (await get(actor, '/v1/worldgraph/operations')).operations.find(entry => entry.graphId === mission.id);
    assert(offer?.actions[0]?.available);
    const openingAction = offer.actions[0];
    const openControl = () => fixture.page.locator('[data-city-crew-board] .fieldwork-card')
      .filter({ has: fixture.page.getByRole('heading', { name: offer.title, exact: true }) })
      .getByRole('button', { name: openingAction.label, exact: true });
    const confirmOpen = async () => { if (openingAction.consequence) await activate(fixture, fixture.page.locator('.modal-bg[data-managed-dialog] [data-yes]').last()); };
    const queuedGate = deferred(), queueObserved = deferred(); let queueOnce = false;
    const queueRead = async route => { if (queueOnce) return route.continue(); queueOnce = true; queueObserved.resolve(); await queuedGate.promise; await route.continue(); };
    await fixture.page.route('**/v1/projections/player*', queueRead);
    const queuedPosts = [], trackPost = request => { if (request.method() === 'POST') queuedPosts.push(new URL(request.url()).pathname); };
    fixture.page.on('request', trackPost);
    try {
      await activate(fixture, fixture.page.locator('#btn-refresh')); await bounded(queueObserved.promise, 'the authenticated Crew queue read');
      await activate(fixture, openControl()); await confirmOpen(); await fixture.page.locator('#busy.on').waitFor();
      await activate(fixture, fixture.page.getByRole('button', { name: 'Close crew missions', exact: true }));
      await crewOpen(false);
    } finally { queuedGate.resolve(); }
    await fixture.page.unroute('**/v1/projections/player*', queueRead); await crewReady();
    fixture.page.off('request', trackPost);
    assert.deepEqual(queuedPosts.filter(path => !['/v1/screens', '/v1/commands/observations'].includes(path)), [],
      'Closing and reopening the Crew dock retires its queued intent with zero gameplay POST.');
    assert.equal(Boolean((await get(actor, '/v1/worldgraph/operations')).operations.find(entry => entry.graphId === mission.id).operationId), false);
    await same(fixture, liveEntry, livePose);

    const openGate = deferred(), openCommitted = deferred();
    const holdOpen = async route => { const response = await route.fetch(); assert.equal(response.status(), 200); openCommitted.resolve(await response.json());
      await openGate.promise; await route.fulfill({ response }); };
    await fixture.page.route(base + openingAction.path, holdOpen);
    const openReply = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === openingAction.path); openReply.catch(() => {});
    try {
      await activate(fixture, openControl()); await confirmOpen(); await bounded(openCommitted.promise, 'the actual Crew operation opening commit');
      await activate(fixture, fixture.page.getByRole('button', { name: 'Close crew missions', exact: true }));
    } finally { openGate.resolve(); }
    const openedReply = await openReply; assert.equal(openedReply.status(), 200); const opened = await openedReply.json(); await settled(fixture);
    await fixture.page.unroute(base + openingAction.path, holdOpen);
    assert.equal(await fixture.page.locator('[data-city-gameplay="crew"]').isVisible(), false);
    await same(fixture, liveEntry, livePose);
    const openReplay = await success(post(actor, openingAction.path, openedReply.request().postDataJSON(), openedReply.request().headers()['idempotency-key']));
    assert.deepEqual(openReplay, opened);
    await crewOpen();
    const operationRoot = '/v1/worldgraph/operations/' + encodeURIComponent(opened.operationId);
    const roleAction = (await get(actor, operationRoot)).roles.find(role => role.roleId === 'planner').actions[0];
    const pollGate = deferred(), pollObserved = deferred(); let pollOnce = false;
    const heldPoll = async route => {
      if (pollOnce) return route.continue(); pollOnce = true;
      const response = await route.fetch(); assert.equal(response.status(), 200); pollObserved.resolve();
      await pollGate.promise; await route.fulfill({ response });
    };
    await fixture.page.route(base + '/v1/worldgraph/operations', heldPoll);
    await bounded(pollObserved.promise, 'the actual timed Crew catalogue read');
    const claimed = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === roleAction.path);
    claimed.catch(() => {});
    try {
      await activate(fixture, fixture.page.locator('[data-fieldwork-role="planner"]').getByRole('button', { name: roleAction.label, exact: true }));
      await fixture.page.locator('#busy.on').waitFor();
    } finally { pollGate.resolve(); }
    await fixture.page.unroute(base + '/v1/worldgraph/operations', heldPoll);
    assert.equal((await claimed).status(), 200); await crewReady();
    const switchGate = deferred(), switchObserved = deferred(); let switchOnce = false;
    const heldSwitch = async route => {
      if (switchOnce) return route.continue(); switchOnce = true;
      const response = await route.fetch(); assert.equal(response.status(), 200); switchObserved.resolve();
      await switchGate.promise; await route.fulfill({ response });
    };
    await fixture.page.route(base + '/v1/worldgraph/operations', heldSwitch);
    for (const [index, role] of ['lookout', 'driver'].entries()) {
      const member = members[index + 1], issued = (await get(member, operationRoot)).roles.find(entry => entry.roleId === role).actions[0];
      await success(post(member, issued.path, issued.body));
    }
    await bounded(switchObserved.promise, 'the actual Crew handoff read before switching view');
    await activate(fixture, fixture.page.locator('[data-fieldwork-view="inventory"]'));
    const inventoryPane = await fixture.page.locator('.fieldwork-body').elementHandle();
    const switchedRead = fixture.page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/v1/worldgraph/operations');
    switchGate.resolve(); await switchedRead;
    await fixture.page.unroute(base + '/v1/worldgraph/operations', heldSwitch);
    await fixture.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    assert(await inventoryPane.evaluate(node => node.isConnected), 'A retired Crew poll cannot redraw the new Inventory view or restore its old scroll/focus.');
    await inventoryPane.dispose();
    await activate(fixture, fixture.page.locator('[data-fieldwork-view="operations"]'));
    await fixture.page.waitForFunction(() => document.querySelector('[data-fieldwork-handoff]')?.textContent === 'Your turn: Planner');
    assert((await fixture.page.locator('[data-fieldwork-role="lookout"]').textContent()).includes('name not learned'));
    await same(fixture, liveEntry, livePose);
    const steps = mission.nodes.filter(node => node.type === 'operation_step').sort((a, b) => a.metadata.order - b.metadata.order);
    for (const [index, step] of steps.entries()) {
      const participant = step.metadata.roleId === 'planner' ? actor : step.metadata.roleId === 'lookout' ? members[1] : members[2];
      const issued = (await get(participant, operationRoot + '/role')).nodes.find(node => node.id === step.id).actions[0]; assert(issued.available);
      if (participant === actor) {
        await fixture.page.waitForFunction(label => [...document.querySelectorAll('.fieldwork-role button')].some(button => button.textContent === label && !button.disabled), issued.label);
        await crewReady();
        const result = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === issued.path);
        await activate(fixture, fixture.page.locator('.fieldwork-role').getByRole('button', { name: issued.label, exact: true }));
        assert.equal((await result).status(), 200); await crewReady(); await same(fixture, liveEntry, livePose);
      } else await success(post(participant, issued.path, issued.body));
      if (index === 1) {
        await fixture.page.waitForFunction(() => document.querySelector('[data-fieldwork-handoff]')?.textContent === 'Your turn: Planner');
        await crewReady();
        const privateText = mission.nodes.find(node => node.id === 'evidence:quiet-pier-signal').metadata.privateEvidence;
        assert(!(await fixture.page.locator('[data-city-crew-board]').textContent()).includes(privateText), 'The planner never receives the lookout private clue.');
      }
    }
    await fixture.page.waitForFunction(() => document.querySelector('[data-fieldwork-handoff]')?.textContent === 'All contributions are in. The planner can close the run.');
    await crewReady();
    const closing = (await get(actor, operationRoot)).actions.find(action => action.path.endsWith('/complete')); assert(closing.available);
    const closedResponse = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === closing.path);
    await activate(fixture, fixture.page.getByRole('button', { name: closing.label, exact: true }));
    if (closing.consequence) await activate(fixture, fixture.page.locator('.modal-bg[data-managed-dialog] [data-yes]').last());
    const closed = await closedResponse; assert.equal(closed.status(), 200); await crewReady(); await same(fixture, liveEntry, livePose);
    assert.equal((await get(actor, operationRoot)).status, 'completed');
    assert((await fixture.page.locator('[data-fieldwork-achievements]').textContent()).includes('The Quiet Pier Run'));
    const closeReplay = await success(post(actor, closing.path, closed.request().postDataJSON(), closed.request().headers()['idempotency-key']));
    assert.deepEqual(closeReplay, await closed.json());
    const artifact = (await get(members[2], '/v1/worldgraph/inventory')).items.filter(item => item.templateId === 'item:quiet_pier_manifest');
    assert.equal(artifact.length, 1); assert.deepEqual(artifact[0].actions, []);
    assert.equal((await get(actor, '/v1/worldgraph/inventory')).items.filter(item => item.templateId === 'item:quiet_pier_manifest').length, 0);
    const crewReads = [], noteRead = request => { if (request.method() === 'GET' && new URL(request.url()).pathname.startsWith('/v1/worldgraph/operations')) crewReads.push(request.url()); };
    await activate(fixture, fixture.page.getByRole('button', { name: 'Close crew missions', exact: true }));
    fixture.page.on('request', noteRead); await fixture.page.waitForTimeout(5500); fixture.page.off('request', noteRead);
    assert.deepEqual(crewReads, [], 'Closing the scoped Crew dock stops its five-second polling without remounting the scene.');
    await same(fixture, liveEntry, livePose);

    // A real workbench action at A may finish after a readonly opening at B. Neither target may rebind the other's common action ID.
    await liveEntry.dispose();
    for (const member of members) {
      const travelled = await success(post(member, '/v1/travel/foundry', {})); assert.equal(travelled.loc, 'foundry'); assert.equal(travelled.cost, 250);
    }
    await activate(fixture, fixture.page.locator('#btn-refresh'));
    await fixture.page.waitForFunction(() => window.__panelProbe().viewer?.district === 'foundry' && window.__panelHandles.at(-1)?.handle.getState().ready);
    const homeEntry = await fixture.page.evaluateHandle(() => window.__panelHandles.at(-1)), homePose = (await state(fixture)).position;
    const guestHomes = [];
    for (const [index, host] of members.slice(1).entries()) {
      await success(post(host, '/v1/deeds/claim', { name: 'Panel Visit ' + index + ' ' + viewport.width, district: 'foundry' }));
      const home = (await get(host, '/v1/city/homes?district=foundry')).myHome; assert(home);
      let interior = await get(host, '/v1/city/home/interior?homeKey=' + encodeURIComponent(home.key));
      const activation = interior.actions.find(action => action.id === 'activate');
      await success(post(host, activation.path, activation.body));
      interior = await get(host, '/v1/city/home/interior?homeKey=' + encodeURIComponent(home.key));
      const invite = interior.actions.find(action => action.id === 'invite');
      const invitation = await success(post(host, invite.path, { ...invite.body, targetCharacterId: actor.id, rights: index ? ['visit'] : ['visit', 'workbench'] }));
      const accept = (await get(actor, '/v1/city/home/invitations')).invitations.find(row => row.id === invitation.effect.grantId).action;
      await success(post(actor, accept.path, accept.body)); guestHomes.push({ ...home, grantId: invitation.effect.grantId });
    }
    await withItemTransaction(app.pool, client => grantStack(client, { scope: 'account', id: actor.account },
      'mat:scrap_steel', 4, 'standard', 'gameplay panel canonical workbench fixture', crypto.randomUUID()));
    const [homeA, homeB] = guestHomes;
    const visitControl = home => fixture.page.locator('.city-world__card').filter({ has: fixture.page.getByText(home.key, { exact: true }) })
      .getByRole('button', { name: 'Enter home', exact: true });
    await panel(fixture, 'room'); await activate(fixture, visitControl(homeA)); await settled(fixture);
    await activate(fixture, fixture.page.getByRole('button', { name: 'Workbench', exact: true }));
    const visitA = await get(actor, '/v1/city/home/interior?homeKey=' + encodeURIComponent(homeA.key));
    const recipe = visitA.workbench.recipes.find(row => row.id === 'recipe:hardened_steel'); assert(recipe?.action.available, JSON.stringify(recipe?.blockedBy));
    const cashBeforeCraft = Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [actor.id])).rows[0].cash);
    const craftGate = deferred(), craftCommitted = deferred(), lateGate = deferred(), lateObserved = deferred();
    let craftSent = false, aReads = 0;
    const markCraft = request => { if (request.method() === 'POST' && new URL(request.url()).pathname === recipe.action.path) craftSent = true; };
    fixture.page.on('request', markCraft);
    const holdCraft = async route => { const response = await route.fetch(); assert.equal(response.status(), 200); craftCommitted.resolve(await response.json());
      await craftGate.promise; await route.fulfill({ response }); };
    const holdLateA = async route => {
      if (!craftSent || new URL(route.request().url()).searchParams.get('homeKey') !== homeA.key || ++aReads !== 2) return route.continue();
      const response = await route.fetch(); assert.equal(response.status(), 200); assert.equal((await response.json()).home.key, homeA.key);
      lateObserved.resolve(); await lateGate.promise; await route.fulfill({ response });
    };
    await fixture.page.route(base + recipe.action.path, holdCraft);
    await fixture.page.route('**/v1/city/home/interior?*', holdLateA);
    const craftingReply = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === recipe.action.path); craftingReply.catch(() => {});
    try {
      await activate(fixture, fixture.page.locator('.city-world__card').filter({ has: fixture.page.getByText(recipe.title, { exact: true }) })
        .getByRole('button', { name: recipe.action.label, exact: true }));
      await bounded(craftCommitted.promise, 'the real canonical A workbench commit');
      await activate(fixture, fixture.page.locator('[data-city-world-close]'));
      await activate(fixture, fixture.page.locator('[data-city-world-tools]'));
      await activate(fixture, fixture.page.locator('[data-city-world-panel="room"]'));
      await activate(fixture, visitControl(homeB));
      craftGate.resolve(); await bounded(lateObserved.promise, 'the actual late A refresh after a B opening');
      await fixture.page.getByRole('heading', { name: homeB.street + ' · Visiting', exact: true }).waitFor();
    } finally { craftGate.resolve(); lateGate.resolve(); }
    const crafted = await craftingReply; assert.equal(crafted.status(), 200); await settled(fixture);
    await fixture.page.unroute(base + recipe.action.path, holdCraft); await fixture.page.unroute('**/v1/city/home/interior?*', holdLateA); fixture.page.off('request', markCraft);
    assert.equal(await fixture.page.evaluate(() => window.__panelProbe().homeKey), homeA.key, 'The source cache really received the late A200.');
    await fixture.page.getByRole('heading', { name: homeB.street + ' · Visiting', exact: true }).waitFor();
    assert.equal(Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [actor.id])).rows[0].cash), cashBeforeCraft - 300);
    const craftReplay = await success(post(actor, recipe.action.path, crafted.request().postDataJSON(), crafted.request().headers()['idempotency-key']));
    assert.deepEqual(craftReplay, await crafted.json());
    const withdrawals = [], trackWithdrawal = request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/v1/city/home/visitors/leave') withdrawals.push(request.postDataJSON()); };
    fixture.page.on('request', trackWithdrawal);
    await activate(fixture, fixture.page.getByRole('button', { name: 'Leave this home', exact: true })); await settled(fixture);
    if (bindingInverse) {
      assert.equal(withdrawals.length, 1); assert.equal(withdrawals[0].grantId, homeA.grantId);
      const grants = (await app.pool.query('SELECT id,status FROM city_home_visitors WHERE id IN ($1,$2)', [homeA.grantId, homeB.grantId])).rows;
      assert.equal(grants.find(grant => grant.id === homeA.grantId).status, 'revoked');
      assert.equal(grants.find(grant => grant.id === homeB.grantId).status, 'active');
      console.log('binding inverse setup complete: canonical A craft300, late real cacheA/displayB; native B leave sent A grant and actually revoked A while B stayed active. Intended zero-POST oracle follows.');
    }
    assert.deepEqual(withdrawals, [], 'Displayed B cannot send a common-ID action rebound to late A authority.');
    let permissions = (await get(actor, '/v1/city/home/invitations')).permissions;
    assert(guestHomes.every(home => permissions.find(grant => grant.id === home.grantId)?.status === 'active'));
    await activate(fixture, visitControl(homeB)); await settled(fixture);
    const withdrew = fixture.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/v1/city/home/visitors/leave');
    await activate(fixture, fixture.page.getByRole('button', { name: 'Leave this home', exact: true })); assert.equal((await withdrew).status(), 200); await settled(fixture);
    fixture.page.off('request', trackWithdrawal);
    assert.equal(withdrawals.length, 1); assert.equal(withdrawals[0].grantId, homeB.grantId);
    permissions = (await get(actor, '/v1/city/home/invitations')).permissions;
    assert.equal(permissions.find(grant => grant.id === homeA.grantId)?.status, 'active');
    assert.equal(permissions.find(grant => grant.id === homeB.grantId), undefined, 'Withdrawn consent is absent from the current private permission board.');
    assert.equal((await app.pool.query('SELECT status FROM city_home_visitors WHERE id=$1', [homeB.grantId])).rows[0].status, 'revoked');
    assert.equal(await fixture.page.locator('[data-city-deed-room]').count(), 0, 'Confirmed withdrawal removes the old private B room.');
    await same(fixture, homeEntry, homePose);
    await activate(fixture, fixture.page.locator('[data-city-world-close]'));
    await activate(fixture, fixture.page.locator('#btn-dashboard-view'));
    assert.equal(await fixture.page.evaluate(() => localStorage.getItem('omerta_game_view')), 'dashboard');
    await activate(fixture, fixture.page.locator('#btn-player-view'));
    assert.equal(await fixture.page.evaluate(() => localStorage.getItem('omerta_game_view')), 'player');
    await fixture.page.reload();
    await fixture.page.waitForFunction(() => document.querySelector('#btn-player-view')?.getAttribute('aria-pressed') === 'true'
      && window.__panelHandles.at(-1)?.handle.getState().ready);
    const resumed = await fixture.page.evaluateHandle(() => window.__panelHandles.at(-1)), resumedPose = (await state(fixture)).position;
    const resumePosts = [], noteResume = request => { if (request.method() === 'POST' && !['/v1/screens','/v1/commands/observations'].includes(new URL(request.url()).pathname)) resumePosts.push(new URL(request.url()).pathname); };
    fixture.page.on('request', noteResume);
    await activate(fixture, fixture.page.locator('[data-city-world-tools]'));
    await activate(fixture, fixture.page.locator('[data-city-resume]'));
    await fixture.page.locator('[data-city-continuity]').waitFor(); await settled(fixture);
    const recap = fixture.page.locator('[data-city-continuity]');
    const recapText = await recap.textContent();
    assert(recapText.includes('The Quiet Pier Run · Crew run complete as Planner'));
    assert(!mission.nodes.filter(node => node.type === 'evidence' && node.metadata.roleId === 'lookout')
      .some(node => recapText.includes(node.metadata.privateEvidence)), 'A fresh recap never reveals another role’s private clue.');
    await activate(fixture, recap.getByRole('button', { name: 'Continue at ' + homeA.street.toLowerCase(), exact: true }));
    await fixture.page.getByRole('heading', { name: homeA.street + ' · Visiting', exact: true }).waitFor(); await settled(fixture);
    fixture.page.off('request', noteResume); assert.deepEqual(resumePosts, [], 'Returning view and continuing an accepted home perform only authorized reads.');
    await same(fixture, resumed, resumedPose); await resumed.dispose();
    await homeEntry.dispose(); await fixture.context.close();
    console.log('gameplay panels passed:', viewport.width, 'real Home authority retirement; tactical prepare/turn/replay; Crew queued/sent close, consenting roles/stages/private evidence/driver custody; two-home late cache zero-rebind/actual B withdrawal/private-room retirement');
  }
  assert.deepEqual(errors, []);
  console.log('city-gameplay-panels-browser PASS: trusted native phone/desktop Home layout, immediate known-generation retirement with old scene/pose until real player publication, fresh-generation scene, Adventures prepare/tactics, Crew consenting roles/stages/private evidence/driver custody, queued zero POST and sent-close preservation with exact-key replay, two-home late-cache exact target binding and confirmed withdrawal retirement');
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  if (browser) await browser.close(); await app.close();
}
