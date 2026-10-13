// Component-level lifecycle and interaction proofs; authoritative routes have separate actual-server journeys.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { DISTRICTS, districtNeighbours } from '../src/rules.js';

const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium executable.');
const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const viewport of [{ width: 375, height: 812 }, { width: 1366, height: 768 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', isMobile: viewport.width <= 680, hasTouch: viewport.width <= 680 });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://world-ui.test/art/**', route => route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.resolve('public/art', path.basename(new URL(route.request().url()).pathname))) }));
    await page.setContent('<base href="http://world-ui.test"><header id="tools-host"></header><section class="omerta-city"><div id="guidance"></div><div id="toolbar"></div><div id="viewport"><div id="map"></div></div></section>');
    await page.addStyleTag({ content: '.omerta-city{width:calc(100% - 32px);max-width:960px;margin:12px auto;background:#172626;color:#eadfc4;font-family:Arial}#map{height:280px;position:relative}button{background:#26352f;color:#efe4c6;border:1px solid #85785c;padding:6px}button:not([data-city-map-view]){min-height:44px}button:focus{outline:2px solid #e9b85b}' });
    await page.addStyleTag({ path: 'public/city-world-ui.css' });
    await page.addScriptTag({ path: 'public/city-world-ui.js' });
    await page.evaluate(() => {
      window.__reads = []; window.__sent = []; window.__waypoints = []; window.__looks = []; window.__recoveries = 0;
      window.__observedConsent = []; window.__captureConsent = false;
      window.__chatTicks = []; window.__chatIntervalIds = []; const realInterval = window.setInterval;
      window.setInterval = (callback, interval, ...args) => { const id = realInterval(callback, interval, ...args); if (interval === 5000) { window.__chatTicks.push(callback); window.__chatIntervalIds.push(id); } return id; };
      window.__character = { id: 'owner-a', generation: 1, name: 'Viewer', level: 1, stats: { muscle: 5, cunning: 5, speed: 5 }, guns: ['starter'], gun: null, ammo: 10, cb: 2 };
      window.__social = { preferences: { outfit: 'classic', chatEnabled: false, room: { furniture: [{ id: 'chair', x: 1, y: 1 }, { id: 'lamp', x: 3, y: 2 }] } },
        outfits: [{ id: 'classic', name: 'Classic', color: '#a89c7b' }, { id: 'moss', name: 'Moss', color: '#8ea986' }], emotes: [{ id: 'wave', name: 'Wave' }], furniture: [{ id: 'chair', name: 'Chair' }, { id: 'lamp', name: 'Lamp' }] };
      window.__fixture = {
        scopeKey: 'session-a', character: window.__character, district: { id: 'harbor', name: 'Harbor' },
        viewport: document.querySelector('#viewport'), mapLayer: document.querySelector('#map'), toolbar: document.querySelector('#toolbar'),
        toolsHost: document.querySelector('#tools-host'), trackerHost: document.querySelector('#guidance'),
        venues: [{ id: 'training', name: 'Training Room', x: 606, y: 504 }, { id: 'fixer', name: 'The Fixer', x: 144, y: 224 }],
        rules: { guns: [{ id: 'starter', name: 'Starter pistol' }] }, objectives: [{ id: 'meet', title: 'Meet a different face', status: 'active' }],
        getState: () => ({ world: { width: 960, height: 640 }, position: { x: 430, y: 366 }, obstacles: [] }),
        onWaypoint: id => window.__waypoints.push(id), onLook: id => window.__looks.push(id), onOpenIntel: () => { window.__intelOpened = true; },
        onPanelChange: () => { if (window.__captureConsent && window.__ui) window.__observedConsent.push(window.__ui.getState().chatJoined); },
        onRead: async kind => { window.__reads.push(kind);
          if (window.__heldReads) {
            window.__chatIntervalIds.forEach(id => clearInterval(id));
            return new Promise((resolve, reject) => window.__heldReads.push({ kind, resolve, reject }));
          }
          const denied = kind === 'chat' && window.__chat403;
          if (kind === 'chat' && window.__holdChat) await new Promise(resolve => { window.__releaseChat = resolve; });
          if (denied) return { code: 403, body: { error: 'city_chat_opt_in_required' } };
          if (window.__holdRead) await new Promise(resolve => { window.__releaseRead = resolve; });
          if (kind === 'inventory' && window.__holdInventory) await new Promise(resolve => { window.__releaseInventory = resolve; });
          return { code: 200, body: kind === 'social' ? structuredClone(window.__social) : kind === 'chat' ? { messages: [
            { id: 'm0', who: 'Public neighbor', text: 'Earlier message', characterId: 'neighbor', generation: 1, at: new Date(Date.now() - 2000).toISOString() },
            { id: 'm1', who: 'Public neighbor', text: '<img src=x onerror=window.__xss=1>', characterId: 'neighbor', generation: 1, at: new Date().toISOString() }
          ], participants: [{ id: 'neighbor', generation: 1, name: 'Public neighbor' }] } : kind === 'inventory' ? window.__inventoryReply || {} : {} }; },
        onAction: async (kind, payload, guards) => {
          if (window.__queue) await new Promise(resolve => { window.__releaseQueue = resolve; });
          if (!guards.beforeDispatch()) return { code: 499, ignored: true, body: {} };
          window.__sent.push({ kind, payload });
          if (kind === 'chat-consent') window.__social.preferences.chatEnabled = payload.enabled;
          if (kind === 'outfit') window.__social.preferences.outfit = payload.outfit;
          if (kind === 'room') window.__social.preferences.room.furniture = payload.furniture;
          if (window.__holdReply) await new Promise(resolve => { window.__releaseReply = resolve; });
          return { code: 200, body: { ok: true } };
        },
        onRetry: async () => { window.__recoveries++; window.__ui.update({ recovery: false, receipt: { label: 'Recovered', summary: 'The original action is confirmed.' } }); }
      };
      window.__ui = window.OmertaCityWorldUI.mount(document.querySelector('.omerta-city'), window.__fixture);
    });
    const click = async selector => viewport.width <= 680 ? page.locator(selector).tap() : page.locator(selector).click();
    assert.equal(await page.locator('[data-city-objective-tracker]').innerText(), '◆ Meet a different face');
    assert.equal(await page.locator('#tools-host [data-city-world-tools]').count(), 1);
    await page.evaluate(() => window.__ui.update({ trackerVisible: false }));
    assert.equal(await page.locator('[data-city-objective-tracker]').isVisible(), false);
    await page.evaluate(() => window.__ui.update({ trackerVisible: true }));
    await click('[data-city-world-tools]');
    assert.equal(await page.locator('[data-city-minimap]').count(), 1);
    await page.locator('.city-world__content').focus();
    await page.evaluate(() => window.__ui.update({}));
    assert.equal(await page.locator('.city-world__content').evaluate(node => document.activeElement === node), true, 'A passive update retains anonymous content focus rather than choosing an unrelated unkeyed tab.');
    assert.deepEqual(await page.evaluate(() => window.__reads), [], 'Opening a local minimap does not request or mutate gameplay.');
    await click('[data-city-waypoint="training"]');
    assert.deepEqual(await page.evaluate(() => window.__waypoints), ['training']);
    assert.equal(await page.evaluate(() => window.__ui.getState().panel), '');
    await click('[data-city-objective-tracker]'); assert.equal(await page.evaluate(() => window.__intelOpened), true);
    await page.evaluate(() => { window.__ui.frame({ position: { x: 606, y: 504 } }); window.__ui.close(false); });
    assert.match(await page.locator('.city-world__speech').innerText(), /THE TRAINER/, 'Closing an already hidden tool panel does not erase an arrival dialogue.');
    await page.evaluate(() => { document.querySelector('#map').style.height = '96px'; window.__ui.frame({ position: { x: 606, y: 504 } }); });
    assert.equal(await page.locator('.city-world__speech').isVisible(), false);
    assert.match(await page.locator('.city-world__dialogue').innerText(), /THE TRAINER/, 'An active cue moves outside a newly short map instead of obscuring the avatar.');
    await page.evaluate(() => { document.querySelector('#map').style.height = '280px'; });

    await page.evaluate(() => window.__ui.open('bag'));
    await page.waitForFunction(() => window.__reads.includes('inventory'));
    await page.evaluate(() => { window.__social.preferences.chatEnabled = true; window.__ui.update({ social: window.__social }); window.__holdInventory = true; window.__ui.open('bag'); });
    await page.waitForFunction(() => !!window.__releaseInventory);
    assert.equal((await page.locator('.city-world__content').innerText()).includes('notebook'), false);
    await page.evaluate(() => { window.__chatTicks.at(-1)(); });
    await page.waitForFunction(() => window.__reads.includes('chat'));
    await page.evaluate(() => { window.__inventoryReply = { currentCharacterItems: [{ templateId: 'notebook', state: 'held' }] }; window.__holdInventory = false; window.__releaseInventory(); });
    await page.waitForFunction(() => document.querySelector('.city-world__content').textContent.includes('notebook'));
    await page.evaluate(() => { window.__social.preferences.chatEnabled = false; window.__ui.update({ social: window.__social }); window.__reads = []; });
    await page.evaluate(() => { window.__queue = true; });
    await click('[data-city-equip="starter"]');
    await page.waitForFunction(() => !!window.__releaseQueue);
    await click('[data-city-world-close]');
    await page.evaluate(() => { window.__ui.open('bag'); window.__queue = false; window.__releaseQueue(); });
    await page.waitForFunction(() => !window.__ui.getState().pending);
    assert.deepEqual(await page.evaluate(() => window.__sent), [], 'Closing and reopening cancels an old queued opening without a send.');

    await page.evaluate(() => { window.__holdReply = true; });
    await click('[data-city-equip="starter"]'); await page.waitForFunction(() => !!window.__releaseReply);
    await click('[data-city-world-close]');
    await page.evaluate(() => { window.__holdReply = false; window.__releaseReply(); });
    await page.waitForFunction(() => !window.__ui.getState().pending);
    assert.equal(await page.evaluate(() => window.__sent.length), 1, 'A dispatched action is not canceled or resent by closing.');

    await page.evaluate(() => { window.__ui.update({ receipt: { label: 'Equip', summary: 'Confirmation pending', recovery: { sameKey: true } }, recovery: true }); window.__ui.open('bag'); });
    assert.equal(await page.locator('[data-city-equip="starter"]').isDisabled(), true);
    await click('[data-city-world-retry]'); assert.equal(await page.evaluate(() => window.__recoveries), 1);
    await page.evaluate(() => window.__ui.setHeight(64));
    await page.locator('[data-city-equip="starter"]').scrollIntoViewIfNeeded();
    const controlFits = () => page.locator('[data-city-equip="starter"]').evaluate(node => {
      const dock = node.closest('.city-world__dock').getBoundingClientRect(), box = node.getBoundingClientRect();
      return box.height >= 44 && box.top >= dock.top && box.bottom <= dock.bottom && [box.top + 2, box.bottom - 2].every(y => {
        const hit = document.elementFromPoint(box.left + box.width / 2, y); return hit === node || node.contains(hit);
      });
    });
    assert.equal(await controlFits(), true, 'A real 44px equipment control fits and receives hits in a 64px dock.');
    await page.evaluate(() => document.querySelector('.city-world__dock').classList.remove('is-compact'));
    await page.locator('[data-city-equip="starter"]').scrollIntoViewIfNeeded();
    assert.equal(await controlFits(), false, 'The former full header demonstrably obscures a control in the minimum dock.');
    await page.evaluate(() => window.__ui.setHeight(64));
    const closeFits = await page.locator('[data-city-world-close]').evaluate(node => {
      const dock = node.closest('.city-world__dock').getBoundingClientRect(), box = node.getBoundingClientRect();
      return box.height >= 44 && box.top >= dock.top && box.bottom <= dock.bottom && document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) === node;
    });
    assert.equal(closeFits, true, 'Close remains a visible real target after internal scrolling.');
    const backFits = await page.locator('[data-city-world-back]').evaluate(node => {
      const dock = node.closest('.city-world__dock').getBoundingClientRect(), box = node.getBoundingClientRect();
      return box.height >= 44 && box.width >= 44 && box.top >= dock.top && box.bottom <= dock.bottom && [box.top + 2, box.bottom - 2].every(y => document.elementFromPoint(box.left + box.width / 2, y) === node);
    });
    assert.equal(backFits, true, 'The return-to-choices control is also a usable 44px target in the minimum dock.');
    const beforeReturn = await page.evaluate(() => ({ reads: window.__reads.length, sent: window.__sent.length }));
    await click('[data-city-world-back]');
    assert.deepEqual(await page.evaluate(() => ({ scroll: document.querySelector('.city-world__dock').scrollTop, focus: document.activeElement.dataset.cityWorldPanel, panel: window.__ui.getState().panel, reads: window.__reads.length, sent: window.__sent.length })),
      { scroll: 0, focus: 'map', panel: 'bag', ...beforeReturn }, 'Returning to choices focuses their first control without changing the selected panel or issuing a read/action.');
    await click('[data-city-world-close]');
    await page.evaluate(() => window.__ui.setHeight(240));
    await page.evaluate(() => window.__ui.open('chat'));
    await page.waitForFunction(() => document.querySelector('[data-city-chat-consent]')?.textContent === 'Join nearby chat');
    assert.equal(await page.evaluate(() => window.__reads.filter(kind => kind === 'chat').length), 0, 'Default-off chat does not read a room feed.');
    await click('[data-city-chat-consent]');
    await page.waitForFunction(() => !!document.querySelector('[data-city-nearby-feed]'));
    await page.waitForFunction(() => document.querySelector('[data-city-nearby-feed]').textContent.includes('<img'));
    assert.equal(await page.locator('[data-city-nearby-feed] li').first().innerText(), 'Public neighbor · Earlier message');
    assert.match(await page.locator('.city-world__speech').innerText(), /<img/, 'The bubble uses the newest item of the actual oldest-first DTO convention.');
    assert.equal(await page.locator('[data-city-nearby-feed] img').count(), 0); assert.equal(await page.evaluate(() => window.__xss), undefined);
    await page.locator('[data-city-nearby-input]').fill('A draft stays here');
    await page.locator('[data-city-nearby-input]').evaluate(node => node.setSelectionRange(3, 3));
    await page.evaluate(() => window.__ui.update({ chat: { messages: [] } }));
    assert.deepEqual(await page.locator('[data-city-nearby-input]').evaluate(node => [node.value, node.selectionStart, document.activeElement === node]), ['A draft stays here', 3, true]);
    await page.locator('[data-city-world-back]').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-city-nearby-input]').inputValue(), 'A draft stays here', 'Returning to the chooser leaves an unsent message draft intact.');
    assert.equal(await page.evaluate(() => window.__ui.getState().panel), 'chat');
    await page.locator('[data-city-chat-consent]').focus();
    await page.evaluate(() => window.__ui.update({ chat: { messages: [] } }));
    assert.equal(await page.locator('[data-city-chat-consent]').evaluate(node => document.activeElement === node), true, 'A passive update does not move focus into the send field.');
    await page.evaluate(() => { window.__chat403 = true; window.__holdChat = true; window.__chatTicks.at(-1)(); });
    await page.waitForFunction(() => !!window.__releaseChat);
    await page.evaluate(() => { window.__ui.update({ social: structuredClone(window.__social) }); window.__captureConsent = true; window.__chat403 = false; window.__holdChat = false; window.__releaseChat(); });
    await page.waitForFunction(() => window.__observedConsent.length >= 2);
    assert.equal(await page.evaluate(() => window.__observedConsent.every(Boolean)), true, 'Settled old403 handling never regresses the newer winning consent, even transiently.');
    await page.evaluate(() => { window.__captureConsent = false; });
    assert.equal(await page.evaluate(() => window.__ui.getState().chatJoined), true, 'An old held403 cannot regress a newer winning consent board.');
    await page.evaluate(() => { window.__social.preferences.chatEnabled = false; window.__chat403 = true; window.__chatTicks.at(-1)(); });
    await page.waitForFunction(() => !window.__ui.getState().chatJoined && !document.querySelector('[data-city-nearby-feed]'));
    assert.equal(await page.locator('.city-world__speech').textContent(), '', 'An authoritative opt-out removes cached conversation text.');
    await page.evaluate(() => { window.__chat403 = false; });
    await click('[data-city-chat-consent]');
    await page.waitForFunction(() => window.__ui.getState().chatJoined && !!document.querySelector('[data-city-nearby-feed]'));
    await page.evaluate(() => window.__ui.update({ social: null, chat: null }));
    assert.equal(await page.evaluate(() => window.__ui.getState().chatJoined), false);
    assert.equal(await page.locator('[data-city-nearby-feed]').count(), 0, 'Explicit null model retirement clears a previously joined room.');
    assert.equal(await page.locator('.city-world__speech').textContent(), '');
    await page.evaluate(() => window.__ui.update({ social: structuredClone(window.__social) }));
    await page.evaluate(() => window.__ui.open('style'));
    await page.waitForFunction(() => !!document.querySelector('[data-city-outfit="moss"]'));
    await click('[data-city-outfit="moss"]');
    await page.waitForFunction(() => window.__looks.includes('moss'));
    await click('[data-city-emote="wave"]');
    await page.waitForFunction(() => window.__sent.some(action => action.kind === 'emote'));
    assert.deepEqual(await page.evaluate(() => window.__sent.find(action => action.kind === 'emote').payload), { emoteId: 'wave' }, 'The emote consumer uses the closed backend field name.');
    await page.evaluate(() => window.__ui.open('chat'));
    await page.waitForFunction(() => document.querySelector('[data-city-chat-consent]')?.textContent === 'Leave nearby chat');
    await click('[data-city-chat-consent]');
    await page.waitForFunction(() => document.querySelector('[data-city-chat-consent]')?.textContent === 'Join nearby chat');
    assert.equal(await page.locator('[data-city-nearby-feed]').count(), 0);

    await page.evaluate(() => window.__ui.open('room'));
    await page.waitForFunction(() => document.querySelectorAll('.city-world__furniture').length === 2);
    await click('button:has-text("Use Chair")');
    assert.equal(await page.locator('.city-world__room-player').evaluate(node => node.style.gridColumn), '2');
    const useTargets = await page.locator('.city-world__emotes button').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
    assert(useTargets.every(bounds => bounds.width >= 44 && bounds.height >= 44), 'Usable furniture has accessible 44px controls outside miniature art.');
    await page.locator('[aria-label="Furniture column"]').fill('5');
    await page.locator('[aria-label="Furniture row"]').fill('6');
    await click('button:has-text("Place furniture")');
    await page.waitForFunction(() => window.__social.preferences.room.furniture.some(item => item.id === 'chair' && item.x === 4 && item.y === 5));
    await page.evaluate(() => { window.__ui.update({ character: { ...window.__character, stats: { muscle: 6, cunning: 5, speed: 5 }, level: 2 } }); });
    assert.match(await page.locator('.city-world__gains').innerText(), /muscle \+1.*Level 2 reached/);

    await page.evaluate(() => { window.__social.preferences.chatEnabled = true; window.__ui.open('chat'); });
    await page.waitForFunction(() => document.querySelector('.city-world__speech').textContent.includes('Public neighbor'));
    await page.evaluate(() => window.__ui.update({ receipt: { label: 'Private previous-owner receipt', summary: 'Private', recovery: { sameKey: true } }, recovery: true,
      onRetry: () => new Promise(resolve => { window.__releaseOldRetry = resolve; }) }));
    await click('[data-city-world-retry]');
    await page.waitForFunction(() => !!window.__releaseOldRetry);
    await page.evaluate(() => { window.__ui.update({ scopeKey: 'session-b', character: { id: 'owner-b', generation: 1, stats: { muscle: 5, cunning: 5, speed: 5 }, guns: ['starter'] } }); });
    assert.equal(await page.locator('.city-world__speech').textContent(), '', 'Owner changes remove old opted-in chat text from the DOM.');
    assert.equal(await page.locator('.city-world__dialogue').textContent(), '', 'Short-frame dialogue is also cleared, not merely hidden.');
    assert.equal(await page.locator('[data-city-objective-tracker]').innerText(), '◆ Meet someone · collect your first clue', 'A successor does not inherit the former owner pinned progress.');
    await page.evaluate(() => { window.__holdReply = true; window.__releaseReply = null; window.__ui.open('bag'); });
    await click('[data-city-equip="starter"]'); await page.waitForFunction(() => !!window.__releaseReply);
    await page.evaluate(() => window.__releaseOldRetry());
    assert.equal(await page.evaluate(() => window.__ui.getState().pending), true, 'An old owner retry cannot clear a new owner pending action.');
    await page.evaluate(() => { window.__holdReply = false; window.__releaseReply(); });
    await page.waitForFunction(() => !window.__ui.getState().pending);

    await page.evaluate(() => { window.__ui.update({ receipt: { label: 'Private previous-owner receipt', summary: 'Private', recovery: { sameKey: true } }, recovery: true }); window.__holdRead = true; window.__ui.open('style'); });
    await page.waitForFunction(() => !!window.__releaseRead);
    await page.evaluate(() => { window.__ui.update({ scopeKey: 'session-c', character: { id: 'owner-c', generation: 1, stats: { muscle: 5, cunning: 5, speed: 5 }, guns: [] } }); window.__holdRead = false; window.__releaseRead(); window.__ui.open('style'); });
    assert.equal(await page.locator('.city-world__receipt').innerText(), '', 'Identity changes clear private cached receipts.');
    assert.equal(await page.evaluate(() => window.__ui.getState().pending), false);
    await page.evaluate(() => window.__ui.destroy());
    assert.equal(await page.locator('.city-world__dock').count(), 0); assert.equal(await page.locator('.city-world__toolbar').count(), 0);
    assert.equal(await page.locator('#tools-host button').count(), 0); assert.equal(await page.locator('#guidance button').count(), 0, 'External controls are disposed with their scene.');
    const actionsBeforeReads = await page.evaluate(() => window.__sent.length);
    await page.evaluate(() => {
      window.__heldReads = [];
      window.__ui = window.OmertaCityWorldUI.mount(document.querySelector('.omerta-city'), {
        ...window.__fixture, scopeKey: 'loading-session', character: window.__character,
        receipt: { label: 'Existing action', summary: 'Already confirmed.' }, recovery: false
      });
    });
    let heldCount = 0;
    const heldRead = async kind => {
      const index = heldCount++;
      await page.waitForFunction(({ index, kind }) => window.__heldReads[index]?.kind === kind, { index, kind });
      return index;
    };
    const settleRead = async (index, result, rejection = false) => {
      await page.evaluate(({ index, result, rejection }) => {
        const read = window.__heldReads[index];
        if (rejection) read.reject(new Error('Controlled read rejection')); else read.resolve(result);
      }, { index, result, rejection });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const readState = () => page.evaluate(() => ({
      busy: document.querySelector('.city-world__content').getAttribute('aria-busy'),
      title: document.querySelector('.city-world__dock-bar > strong').textContent,
      notice: document.querySelector('.city-world__notice').textContent
    }));
    await click('[data-city-world-tools]');
    await click('[data-city-world-panel="bag"]');
    const firstInventory = await heldRead('inventory');
    assert.deepEqual(await readState(), { busy: 'true', title: 'Bag · Loading…', notice: 'Loading Bag…' }, 'The first held read identifies the panel and announces loading before a reply exists.');
    assert.equal(await page.locator('.city-world__notice').getAttribute('role'), 'status');
    assert.equal(await page.locator('.city-world__notice').getAttribute('aria-live'), 'polite');
    assert.equal(await page.locator('.city-world__dock-bar').evaluate(node => getComputedStyle(node).position), 'sticky');
    assert.equal(await page.locator('[data-city-equip="starter"]').isEnabled(), true, 'Reading does not disable a confirmed equipment control.');
    const unchangedReceipt = await page.locator('.city-world__receipt').innerText();
    await settleRead(firstInventory, { code: 200, body: { currentCharacterItems: [{ templateId: 'notebook', state: 'held' }] } });
    await page.waitForFunction(() => document.querySelector('.city-world__content').textContent.includes('notebook'));
    assert.deepEqual(await readState(), { busy: 'false', title: 'Bag', notice: '' }, 'The winning reply retires both loading cues.');
    await click('[data-city-world-panel="bag"]');
    const cachedInventory = await heldRead('inventory');
    assert.deepEqual(await readState(), { busy: 'false', title: 'Bag', notice: '' }, 'A refresh leaves the cached panel usable without a first-load announcement.');
    assert.match(await page.locator('.city-world__content').innerText(), /notebook/);
    assert.equal(await page.locator('[data-city-equip="starter"]').isEnabled(), true);
    await settleRead(cachedInventory, { code: 503, body: { error: 'db_down' } });
    assert.deepEqual(await readState(), { busy: 'false', title: 'Bag', notice: 'Could not refresh this panel. Your character has not changed. Try again.' }, 'A current error takes priority over a loading message and preserves cached content.');
    assert.match(await page.locator('.city-world__content').innerText(), /notebook/);
    assert.equal(await page.locator('.city-world__receipt').innerText(), unchangedReceipt, 'Read success or failure never changes the action receipt.');

    await click('[data-city-world-panel="style"]');
    const firstSocial = await heldRead('social');
    assert.deepEqual(await readState(), { busy: 'true', title: 'Style · Loading…', notice: 'Loading Style…' });
    await click('[data-city-world-panel="map"]');
    assert.deepEqual(await readState(), { busy: 'false', title: 'Map', notice: '' }, 'A local panel switch retires the former loader.');
    await settleRead(firstSocial, { code: 503, body: {} });
    assert.deepEqual(await readState(), { busy: 'false', title: 'Map', notice: '' }, 'An old opening error cannot repaint the current panel.');
    assert.equal(await page.locator('[data-city-minimap]').count(), 1);

    await click('[data-city-world-panel="chat"]');
    const chatSocial = await heldRead('social');
    assert.deepEqual(await readState(), { busy: 'true', title: 'Nearby chat · Loading…', notice: 'Loading Nearby chat…' });
    const joinedSocial = await page.evaluate(() => ({ ...structuredClone(window.__social), preferences: { ...structuredClone(window.__social.preferences), chatEnabled: true } }));
    await settleRead(chatSocial, { code: 200, body: joinedSocial });
    const olderChat = await heldRead('chat');
    assert.deepEqual(await readState(), { busy: 'true', title: 'Nearby chat · Loading…', notice: 'Loading Nearby chat…' });
    assert.equal(await page.locator('[data-city-nearby-feed]').innerText(), 'Messages have not loaded yet.', 'An unanswered history request never claims that a loaded room is quiet.');
    const chatOpening = await page.evaluate(() => window.__ui.getState().opening);
    await click('button:has-text("Refresh messages")');
    const newerChat = await heldRead('chat');
    assert.equal(await page.evaluate(() => window.__ui.getState().opening), chatOpening, 'Both chat requests belong to the same opening.');
    await settleRead(olderChat, null, true);
    assert.deepEqual(await readState(), { busy: 'true', title: 'Nearby chat · Loading…', notice: 'Loading Nearby chat…' }, 'An older rejection cannot replace or clear the newer pending read.');
    await settleRead(newerChat, { code: 200, body: { messages: [{ id: 'winning-read', who: 'Neighbor', text: 'Current room reply.' }], participants: [] } });
    assert.deepEqual(await readState(), { busy: 'false', title: 'Nearby chat', notice: '' });
    assert.match(await page.locator('[data-city-nearby-feed]').innerText(), /Current room reply\./);

    await page.evaluate(() => window.__ui.update({ chat: null }));
    await click('[data-city-world-panel="chat"]');
    const partialSocialError = await heldRead('social');
    assert.deepEqual(await readState(), { busy: 'true', title: 'Nearby chat · Loading…', notice: 'Loading Nearby chat…' }, 'Cached joined consent still waits for the current social dependency when history is missing.');
    assert.equal(await page.locator('[data-city-nearby-feed]').innerText(), 'Messages have not loaded yet.');
    assert.equal(await page.locator('[data-city-nearby-input]').isEnabled(), true);
    await settleRead(partialSocialError, { code: 503, body: { error: 'db_down' } });
    assert.deepEqual(await readState(), { busy: 'false', title: 'Nearby chat', notice: 'Could not refresh this panel. Your character has not changed. Try again.' }, 'A failed dependency clears its loader and reports the current error.');
    assert.equal(await page.locator('[data-city-nearby-feed]').innerText(), 'Messages have not loaded yet.', 'A failed read leaves history unloaded rather than inventing an empty room.');
    await click('[data-city-world-panel="chat"]');
    const partialSocial = await heldRead('social');
    assert.deepEqual(await readState(), { busy: 'true', title: 'Nearby chat · Loading…', notice: 'Loading Nearby chat…' });
    await settleRead(partialSocial, { code: 200, body: joinedSocial });
    const partialChatError = await heldRead('chat');
    assert.deepEqual(await readState(), { busy: 'true', title: 'Nearby chat · Loading…', notice: 'Loading Nearby chat…' }, 'Loading remains active across the social-to-history handoff.');
    await settleRead(partialChatError, null, true);
    assert.deepEqual(await readState(), { busy: 'false', title: 'Nearby chat', notice: 'Could not refresh this panel. Try again.' });
    assert.equal(await page.locator('[data-city-nearby-feed]').innerText(), 'Messages have not loaded yet.');
    await click('button:has-text("Refresh messages")');
    const loadedEmptyChat = await heldRead('chat');
    assert.deepEqual(await readState(), { busy: 'true', title: 'Nearby chat · Loading…', notice: 'Could not refresh this panel. Try again.' }, 'An ongoing retry retains the current error ahead of the loading status.');
    await settleRead(loadedEmptyChat, { code: 200, body: { messages: [], participants: [] } });
    assert.equal((await readState()).busy, 'false');
    assert.equal((await readState()).title, 'Nearby chat');
    assert.equal(await page.locator('[data-city-nearby-feed]').innerText(), 'The room is quiet. Say hello.', 'Only a successful loaded empty history may use the quiet-room copy.');
    await click('[data-city-world-panel="chat"]');
    const completeCachedSocial = await heldRead('social');
    assert.deepEqual(await readState(), { busy: 'false', title: 'Nearby chat', notice: '' }, 'A complete cached consent/history panel remains usable during a social refresh.');
    assert.equal(await page.locator('[data-city-nearby-input]').isEnabled(), true);
    assert.equal(await page.locator('[data-city-nearby-feed]').innerText(), 'The room is quiet. Say hello.');
    await settleRead(completeCachedSocial, { code: 503, body: { error: 'db_down' } });
    assert.deepEqual(await readState(), { busy: 'false', title: 'Nearby chat', notice: 'Could not refresh this panel. Your character has not changed. Try again.' });
    assert.equal(await page.locator('[data-city-nearby-feed]').innerText(), 'The room is quiet. Say hello.');
    assert.equal(await page.locator('.city-world__receipt').innerText(), unchangedReceipt);

    await click('[data-city-world-panel="map"]');
    await click('[data-city-world-panel="chat"]');
    const consentSocial = await heldRead('social');
    await settleRead(consentSocial, { code: 200, body: joinedSocial });
    const consentHistory = await heldRead('chat');
    await settleRead(consentHistory, { code: 200, body: { messages: [], participants: [] } });
    await page.evaluate(() => window.__ui.update({ chat: null }));
    await click('button:has-text("Refresh messages")');
    const retiredChat = await heldRead('chat');
    assert.equal((await readState()).busy, 'true');
    await page.evaluate(() => window.__ui.update({ social: { ...structuredClone(window.__social), preferences: { ...structuredClone(window.__social.preferences), chatEnabled: false } } }));
    assert.deepEqual(await readState(), { busy: 'false', title: 'Nearby chat', notice: '' }, 'Retired consent clears the first-load marker immediately.');
    await settleRead(retiredChat, { code: 200, body: { messages: [{ id: 'retired-room', who: 'Old neighbor', text: 'Retired private conversation.' }] } });
    assert.equal(await page.locator('[data-city-nearby-feed]').count(), 0);
    assert.equal((await page.locator('.city-world__dock').innerText()).includes('Retired private conversation.'), false);
    assert.equal((await readState()).busy, 'false');

    await page.evaluate(() => window.__ui.update({ social: null }));
    await click('[data-city-world-panel="style"]');
    const oldOwnerSocial = await heldRead('social');
    assert.equal((await readState()).busy, 'true');
    await page.evaluate(() => window.__ui.update({ scopeKey: 'loading-successor', character: { id: 'loading-successor', generation: 2, guns: ['starter'] } }));
    assert.deepEqual(await readState(), { busy: 'false', title: 'World tools', notice: '' }, 'An identity change retires loading UI with the old owner.');
    assert.equal(await page.locator('.city-world__dock').isVisible(), false);
    await click('[data-city-world-tools]'); await click('[data-city-world-panel="bag"]');
    const newOwnerInventory = await heldRead('inventory');
    await settleRead(oldOwnerSocial, null, true);
    assert.deepEqual(await readState(), { busy: 'true', title: 'Bag · Loading…', notice: 'Loading Bag…' }, 'Old-owner settlement cannot clear the successor pending read.');
    assert.equal(await page.locator('.city-world__receipt').innerText(), '');
    await click('[data-city-world-close]');
    assert.deepEqual(await readState(), { busy: 'false', title: 'World tools', notice: '' }, 'Closing retires loading indicators before the response settles.');
    await settleRead(newOwnerInventory, { code: 200, body: { currentCharacterItems: [{ templateId: 'closed-reply', state: 'held' }] } });
    assert.equal(await page.locator('.city-world__dock').isVisible(), false);
    assert.deepEqual(await readState(), { busy: 'false', title: 'World tools', notice: '' });
    assert.equal(await page.evaluate(() => window.__sent.length), actionsBeforeReads, 'Read feedback and cancellation issue no extra actions.');
    await page.evaluate(() => { window.__heldReads = null; window.__ui.destroy(); });
    const hydrated = await page.evaluate(() => {
      const colors = [], ui = window.OmertaCityWorldUI.mount(document.querySelector('.omerta-city'), {
        scopeKey: 'cached-session', character: { id: 'cached-owner', generation: 2 }, district: { id: 'harbor' },
        viewport: document.querySelector('#viewport'), toolbar: document.querySelector('#toolbar'),
        social: { preferences: { outfit: 'wine', chatEnabled: true, room: { furniture: [] } } },
        chat: { messages: [] }, onLook: preset => colors.push(preset)
      });
      const state = ui.getState(); ui.destroy(); return { joined: state.chatJoined, colors };
    });
    assert.deepEqual(hydrated, { joined: true, colors: ['wine'] }, 'Mount consumes the current host-supplied cached preference without reverting a saved look or consent.');

    await page.evaluate(districts => {
      window.__atlasReads = []; window.__homeBoards = []; window.__homeWalks = []; window.__travelSent = []; window.__travelReceipts = []; window.__deedJumps = [];
      window.__atlasCharacter = { id: 'atlas-owner', generation: 1, loc: 'docks', cash: 1000, jailSeconds: 0 };
      window.__atlasFrame = { world: { width: 960, height: 640 }, position: { x: 430, y: 366 }, homes: [], obstacles: [] };
      window.__atlasDistricts = districts;
      window.__atlasOptions = { scopeKey: 'atlas-session', character: window.__atlasCharacter, district: { id: 'docks', name: 'The Docks' },
        viewport: document.querySelector('#viewport'), toolbar: document.querySelector('#toolbar'), toolsHost: document.querySelector('#tools-host'),
        rules: { districts, travelCost: 250 }, getState: () => window.__atlasFrame,
        onRead: (kind, context) => new Promise(resolve => window.__atlasReads.push({ kind, districtId: context.districtId, cursor: context.cursor, context, resolve })),
        onHomes: board => { window.__homeBoards.push(board); if (board?.districtId === 'docks') window.__atlasFrame.homes = board.homes.map(home => ({ ...home, entrance: { x: 900, y: 300 } })); if (!board) window.__atlasFrame.homes = []; },
        onHome: key => window.__homeWalks.push(key), onNavigate: (tab, context) => window.__deedJumps.push({ tab, context }),
        onTravel: async (district, context) => {
          if (window.__queueTravel) await new Promise(resolve => { window.__releaseTravelQueue = resolve; });
          if (!context.beforeDispatch()) return { code: 499, ignored: true, body: {} };
          window.__travelSent.push(district);
          if (window.__holdTravel) await new Promise(resolve => { window.__releaseTravel = resolve; });
          window.__travelReceipts.push(district); return { code: 200, body: { loc: district, cost: 250 } };
        }
      };
      window.__atlasUI = window.OmertaCityWorldUI.mount(document.querySelector('.omerta-city'), window.__atlasOptions);
      const launch = document.createElement('button'); launch.id = 'atlas-launch'; launch.textContent = 'World map'; launch.onclick = () => window.__atlasUI.openMapOverview(); document.querySelector('#tools-host').append(launch);
    }, DISTRICTS.map(district => ({ ...district, neighbours: districtNeighbours(district.id), deeds: 3 })));
    const atlasRead = async (kind, districtId) => {
      await page.waitForFunction(({ kind, districtId }) => window.__atlasReads.some(read => !read.used && read.context.isCurrent() && read.kind === kind && (!districtId || read.districtId === districtId)), { kind, districtId });
      return page.evaluate(({ kind, districtId }) => { const index = window.__atlasReads.findIndex(read => !read.used && read.context.isCurrent() && read.kind === kind && (!districtId || read.districtId === districtId)); window.__atlasReads[index].used = true; return index; }, { kind, districtId });
    };
    const atlasReply = async (index, body) => {
      await page.evaluate(({ index, body }) => window.__atlasReads[index].resolve({ code: 200, body }), { index, body });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const homes = (districtId, start, count, nextCursor = null, myHome = null) => ({ viewer: { characterId: 'atlas-owner', generation: 1, district: 'docks' }, districtId, placement: 'illustrative',
      homes: Array.from({ length: count }, (_, index) => ({ key: 'street ' + String(start + index).padStart(3, '0'), street: 'Street ' + (start + index), districtId,
        owner: { name: ['Public Player', '<img src=x onerror=window.__atlasXss=1>', 'NPC Steward'][index % 3], kind: ['player', 'agent', 'npc'][index % 3] }, mine: false, ownership: 'city' })), myHome, nextCursor, total: 100 });
    const ownHome = { key: 'zz own street', street: 'Your recorded street', districtId: 'docks', owner: { name: 'Viewer', kind: 'player' }, mine: true, ownership: 'city' };
    await click('#atlas-launch'); assert.equal(await page.locator('[data-city-world-panel]').count(), 7);
    assert.deepEqual(await page.locator('[data-city-map-view]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height)), [44, 44],
      'Both map mode controls get their touch size from the actual WorldUI stylesheet.');
    const firstAtlas = await atlasRead('atlas'), firstCollection = await atlasRead('collection');
    await atlasReply(firstAtlas, { districts: DISTRICTS.map(district => ({ ...district, neighbours: districtNeighbours(district.id), deeds: 3 })) });
    await atlasReply(firstCollection, { categories: [{ id: 'districts', items: DISTRICTS.map(district => ({ id: district.id, name: district.name, got: district.id === 'brick' })) }] });
    const firstHomes = await atlasRead('homes', 'docks');
    await atlasReply(firstHomes, homes('docks', 0, 32, 'street 031', ownHome));
    await page.evaluate(board => { window.__firstHomesHydration = board; window.__atlasUI.update({ homes: board }); }, homes('docks', 0, 32, 'street 031', ownHome));
    assert.equal(await page.locator('[data-city-district]').count(), 6);
    assert.match(await page.locator('[data-city-district="docks"]').innerText(), /Here.*Not recorded/);
    assert.match(await page.locator('[data-city-district="brick"]').innerText(), /Visited/);
    assert.equal(await page.locator('.city-world__atlas-diagram line').count(), new Set(DISTRICTS.flatMap(district => districtNeighbours(district.id).map(other => [district.id, other].sort().join(':')))).size);
    assert.equal(await page.locator('[data-city-home]').count(), 33, 'The own-home peek is included beyond the first public page without double counting.');
    assert.match(await page.locator('.city-world__home-list').innerText(), /Public Player.*player/);
    assert.match(await page.locator('.city-world__home-list').innerText(), /NPC Steward.*npc/);
    assert.equal(await page.locator('.city-world__home-list img').count(), 0); assert.equal(await page.evaluate(() => window.__atlasXss), undefined);
    assert.deepEqual(await page.evaluate(() => window.__travelSent), [], 'Overview, visits and directory inspection never travel.');
    await click('[data-city-home="street 001"]');
    assert.match(await page.locator('[data-city-home-detail]').innerText(), /img.*agent/);
    assert.equal(await page.locator('button:has-text("Open Street Deeds")').count(), 0, 'Another owner has no private deed or hideout controls.');
    await click('[data-city-home="zz own street"]');
    const mapPalette = await page.locator('.city-world__home-detail button,.city-world__homes > button').evaluateAll(nodes => nodes.map(node => {
      const style = getComputedStyle(node); return { appearance: style.appearance, color: style.color, background: style.backgroundColor,
        shadow: style.boxShadow, height: node.getBoundingClientRect().height };
    }));
    assert(mapPalette.length >= 4 && mapPalette.every(style => style.appearance === 'none' && style.color === 'rgb(236, 210, 161)'
      && style.background === 'rgb(36, 34, 29)' && style.shadow.includes('inset') && style.height >= 44),
    'New home, deed, hideout and directory controls use the existing City palette and touch size.');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.city-world__home-detail button:focus-visible').count(), 1);
    assert.deepEqual(await page.locator('.city-world__home-detail button:focus-visible').evaluate(node => {
      const style = getComputedStyle(node); return { color: style.outlineColor, width: style.outlineWidth, offset: style.outlineOffset };
    }), { color: 'rgb(232, 179, 75)', width: '2px', offset: '-3px' });
    await click('button:has-text("Open Street Deeds")');
    assert.deepEqual(await page.evaluate(() => window.__deedJumps.at(-1)), { tab: 'deeds', context: { venueId: 'clubhouse', streetKey: ownHome.key, districtId: 'docks', focus: 'owned-deed' } });
    await page.evaluate(() => window.__atlasUI.openMapOverview());
    await click('[data-city-homes-more]'); const moreHomes = await atlasRead('homes', 'docks');
    assert.equal(await page.evaluate(index => window.__atlasReads[index].cursor, moreHomes), 'street 031');
    await atlasReply(moreHomes, homes('docks', 32, 32, 'street 063', ownHome));
    assert.equal(await page.locator('[data-city-home]').count(), 64); assert.equal(await page.locator('[data-city-home="zz own street"]').count(), 1);
    await click('[data-city-home="street 063"]');
    const pagedWindow = await page.evaluate(() => ({ keys: [...document.querySelectorAll('[data-city-home]')].map(node => node.dataset.cityHome),
      scroll: document.querySelector('.city-world__dock').scrollTop, state: window.__atlasUI.getState() }));
    await page.evaluate(() => window.__atlasUI.update({ homes: window.__firstHomesHydration,
      social: { preferences: { outfit: 'classic', chatEnabled: false, room: { furniture: [] } } } }));
    assert.deepEqual(await page.evaluate(() => ({ keys: [...document.querySelectorAll('[data-city-home]')].map(node => node.dataset.cityHome),
      scroll: document.querySelector('.city-world__dock').scrollTop, state: window.__atlasUI.getState() })), pagedWindow,
    'Republishing the host\'s retained first page with unrelated social state preserves loaded pages, selection and reading position.');
    await page.evaluate(() => window.__atlasUI.update({ homes: structuredClone(window.__firstHomesHydration) }));
    assert.deepEqual(await page.locator('[data-city-home]').evaluateAll(nodes => nodes.map(node => node.dataset.cityHome)), pagedWindow.keys,
      'An equivalent fresh JSON first page also preserves the loaded window.');
    const changedFirstPage = homes('docks', 0, 32, 'street 031', null);
    changedFirstPage.homes[31].owner = { name: 'Winning public steward', kind: 'agent' }; changedFirstPage.total = 101;
    await page.evaluate(board => window.__atlasUI.update({ homes: board }), changedFirstPage);
    assert.equal(await page.locator('[data-city-home="street 000"]').count(), 0, 'Hydration does not displace a loaded later row with an out-of-window first-page row.');
    assert.equal(await page.locator('[data-city-home="street 063"]').count(), 1);
    assert.equal(await page.locator('[data-city-home="zz own street"]').count(), 0, 'A fresh null own peek removes stale private deed links without inventing a new steward.');
    assert.match(await page.locator('[data-city-home="street 031"]').innerText(), /Winning public steward.*agent/);
    assert.match(await page.locator('.city-world__homes').innerText(), /101 recorded streets/);
    await click('[data-city-homes-more]'); const laterHomes = await atlasRead('homes', 'docks');
    assert.equal(await page.evaluate(index => window.__atlasReads[index].cursor, laterHomes), 'street 063');
    await atlasReply(laterHomes, homes('docks', 64, 32, null, ownHome));
    assert.equal(await page.locator('[data-city-home]').count(), 64); assert.equal(await page.locator('[data-city-home="zz own street"]').count(), 1);
    assert.equal(await page.locator('[data-city-home="street 095"]').count(), 1, 'Later pages remain reachable within the bounded window.');
    assert(await page.evaluate(() => window.__homeBoards.filter(Boolean).every(board => board.homes.length <= 64)));
    const physicalWindow = await page.evaluate(() => window.__atlasFrame.homes.map(home => home.key));
    assert.equal(physicalWindow.length, 64);
    await click('[data-city-atlas-district="brick"]'); const oldBrickHomes = await atlasRead('homes', 'brick');
    await click('[data-city-district="cathedral"]'); const currentCathedralHomes = await atlasRead('homes', 'cathedral');
    const beforeOldHomes = await page.evaluate(() => window.__homeBoards.length);
    await atlasReply(oldBrickHomes, homes('brick', 0, 3));
    assert.equal(await page.evaluate(() => window.__homeBoards.length), beforeOldHomes, 'A retired district response cannot update home plots.');
    const cathedral = homes('cathedral', 0, 3); cathedral.homes[0] = { key: 'outside street', street: 'External street', districtId: 'cathedral', owner: null, mine: false, ownership: 'external' };
    cathedral.homes[1] = { key: 'estate street', street: 'Estate street', districtId: 'cathedral', owner: null, mine: false, ownership: 'estate' };
    await atlasReply(currentCathedralHomes, cathedral);
    assert.match(await page.locator('[data-city-home="outside street"]').innerText(), /External deed record/);
    assert.match(await page.locator('[data-city-home="estate street"]').innerText(), /no living steward/);
    const inspectedRemote = await page.locator('[data-city-home]').evaluateAll(nodes => nodes.map(node => node.dataset.cityHome));
    await page.evaluate(() => window.__atlasUI.update({ homes: window.__firstHomesHydration }));
    assert.deepEqual(await page.locator('[data-city-home]').evaluateAll(nodes => nodes.map(node => node.dataset.cityHome)), inspectedRemote,
      'Current-district hydration cannot replace an inspected remote directory.');
    assert.deepEqual(await page.evaluate(() => window.__atlasFrame.homes.map(home => home.key)), physicalWindow,
      'Current-district hydration while inspecting a foreign district preserves the accepted physical plot window.');
    assert.equal((await page.evaluate(() => window.__atlasUI.getState())).districtId, 'cathedral');
    await click('button:has-text("Refresh streets")'); const wrongViewerHomes = await atlasRead('homes', 'cathedral');
    const wrongViewer = homes('cathedral', 20, 3); wrongViewer.viewer.characterId = 'another-owner';
    const beforeWrongViewer = await page.evaluate(() => window.__homeBoards.length);
    await atlasReply(wrongViewerHomes, wrongViewer);
    assert.equal(await page.evaluate(() => window.__homeBoards.length), beforeWrongViewer, 'A board for another viewer cannot populate directory or scene plots.');
    assert.equal(await page.locator('[data-city-home="street 020"]').count(), 0);
    await click('[data-city-travel="cathedral"]'); await page.waitForFunction(() => !window.__atlasUI.getState().pending);
    assert.deepEqual(await page.evaluate(() => window.__travelSent), ['cathedral']);
    assert.deepEqual(await page.evaluate(() => window.__atlasCharacter.loc), 'docks', 'A travel receipt never optimistically changes location or visited flags.');
    await page.evaluate(() => { window.__atlasUI.update({ character: { ...window.__atlasCharacter, cash: 249 } }); });
    assert.equal(await page.locator('[data-city-travel="cathedral"]').isDisabled(), true);
    assert.equal(await page.locator('[data-city-travel="cathedral"]').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(41, 39, 31)', 'An unavailable fare retains the disabled City tone.');
    await page.evaluate(() => window.__atlasUI.update({ rules: { districts: window.__atlasDistricts, travelCost: null } }));
    assert.equal(await page.locator('[data-city-travel="cathedral"]').isDisabled(), true, 'A missing fare is not presented as a free ride.');
    await page.evaluate(() => window.__atlasUI.update({ rules: { districts: window.__atlasDistricts, travelCost: 250 } }));
    await page.evaluate(() => window.__atlasUI.update({ character: { ...window.__atlasCharacter, jailSeconds: 10 } }));
    assert.equal(await page.locator('[data-city-travel="cathedral"]').isDisabled(), true);
    await page.evaluate(() => { window.__atlasUI.update({ character: window.__atlasCharacter }); window.__queueTravel = true; });
    await click('[data-city-travel="cathedral"]'); await page.waitForFunction(() => !!window.__releaseTravelQueue);
    await click('[data-city-world-close]'); await page.evaluate(() => window.__atlasUI.openMapOverview('cathedral'));
    await page.evaluate(() => { window.__queueTravel = false; window.__releaseTravelQueue(); }); await page.waitForFunction(() => !window.__atlasUI.getState().pending);
    assert.equal(await page.evaluate(() => window.__travelSent.length), 1, 'Close and reopen permanently cancel a queued old travel opening.');
    await page.evaluate(() => { window.__holdTravel = true; });
    await click('[data-city-travel="cathedral"]'); await page.waitForFunction(() => !!window.__releaseTravel);
    await click('[data-city-world-close]'); await page.evaluate(() => { window.__holdTravel = false; window.__releaseTravel(); });
    await page.waitForFunction(() => !window.__atlasUI.getState().pending);
    assert.equal(await page.evaluate(() => window.__travelReceipts.length), 2, 'A sent trip can complete after close without a second dispatch or reopening.');
    assert.equal(await page.locator('.city-world__dock').isVisible(), false);
    await page.evaluate(() => { window.__atlasUI.update({ recovery: true }); window.__atlasUI.openMapOverview('cathedral'); });
    assert.equal(await page.locator('[data-city-travel="cathedral"]').isDisabled(), true, 'Unresolved same-key recovery blocks a fresh ride.');
    await page.evaluate(() => window.__atlasUI.update({ recovery: false }));
    await page.evaluate(() => window.__atlasUI.openMapOverview('docks'));
    const staleCollection = await atlasRead('collection');
    await page.evaluate(() => window.__atlasUI.update({ scopeKey: 'other-owner', character: { id: 'other-owner', generation: 2, loc: 'docks', cash: 1000 } }));
    await atlasReply(staleCollection, { categories: [{ id: 'districts', items: [{ id: 'docks', got: true }] }] });
    assert.equal(await page.locator('.city-world__dock').isVisible(), false); assert.equal(await page.locator('[data-city-home]').count(), 0);
    assert.equal(await page.evaluate(() => window.__homeBoards.at(-1)), null, 'Identity retirement clears the accepted directory, not just its display.');
    if (viewport.width <= 680) {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.evaluate(() => { window.__atlasUI.update({ character: window.__atlasCharacter, scopeKey: 'atlas-session', atlas: { districts: window.__atlasDistricts } }); window.__atlasUI.openMapOverview(); });
      const smallAtlas = await atlasRead('atlas'); await atlasReply(smallAtlas, { districts: DISTRICTS.map(district => ({ ...district, neighbours: districtNeighbours(district.id), deeds: 3 })) });
      const targets = await page.locator('[data-city-district]').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
      assert(targets.every(target => target.width >= 44 && target.height >= 44));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'The overview fits a 320px reduced-motion phone.');
      await page.evaluate(() => window.__atlasUI.setHeight(64));
      const close = await page.locator('[data-city-world-close]').evaluate(node => { const box = node.getBoundingClientRect(); return {
        height: box.height, hits: [box.top + 3, box.bottom - 3].map(y => { const hit = document.elementFromPoint(box.left + box.width / 2, y); return hit === node || node.contains(hit); }) }; });
      assert(close.height >= 44 && close.hits.every(Boolean), 'The atlas keeps the existing compact Close control reachable.');
    }
    await page.evaluate(() => { window.__atlasUI.destroy(); document.querySelector('#atlas-launch').remove(); });
    assert.deepEqual(errors, []); await context.close();
  }
  console.log('City world UI PASS: map, equipment, queued/dispatched lifecycle, same-key receipt recovery, default-off chat/XSS, furniture targets, confirmed gains and owner teardown on phone/desktop.');
} finally { await browser.close(); }
