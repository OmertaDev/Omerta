// Component-level lifecycle and interaction proofs; authoritative routes have separate actual-server journeys.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

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
    await page.addStyleTag({ content: '.omerta-city{width:calc(100% - 32px);max-width:960px;margin:12px auto;background:#172626;color:#eadfc4;font-family:Arial}#map{height:280px;position:relative}button{background:#26352f;color:#efe4c6;border:1px solid #85785c;min-height:44px;padding:6px}button:focus{outline:2px solid #e9b85b}' });
    await page.addStyleTag({ path: 'public/city-world-ui.css' });
    await page.addScriptTag({ path: 'public/city-world-ui.js' });
    await page.evaluate(() => {
      window.__reads = []; window.__sent = []; window.__waypoints = []; window.__looks = []; window.__recoveries = 0;
      window.__observedConsent = []; window.__captureConsent = false;
      window.__chatTicks = []; const realInterval = window.setInterval;
      window.setInterval = (callback, interval, ...args) => { if (interval === 5000) window.__chatTicks.push(callback); return realInterval(callback, interval, ...args); };
      window.__character = { id: 'owner-a', generation: 1, name: 'Viewer', level: 1, stats: { muscle: 5, cunning: 5, speed: 5 }, guns: ['starter'], gun: null, ammo: 10, cb: 2 };
      window.__social = { preferences: { outfit: 'classic', chatEnabled: false, room: { furniture: [{ id: 'chair', x: 1, y: 1 }, { id: 'lamp', x: 3, y: 2 }] } },
        outfits: [{ id: 'classic', name: 'Classic', color: '#a89c7b' }, { id: 'moss', name: 'Moss', color: '#8ea986' }], emotes: [{ id: 'wave', name: 'Wave' }], furniture: [{ id: 'chair', name: 'Chair' }, { id: 'lamp', name: 'Lamp' }] };
      window.__ui = window.OmertaCityWorldUI.mount(document.querySelector('.omerta-city'), {
        scopeKey: 'session-a', character: window.__character, district: { id: 'harbor', name: 'Harbor' },
        viewport: document.querySelector('#viewport'), mapLayer: document.querySelector('#map'), toolbar: document.querySelector('#toolbar'),
        toolsHost: document.querySelector('#tools-host'), trackerHost: document.querySelector('#guidance'),
        venues: [{ id: 'training', name: 'Training Room', x: 606, y: 504 }, { id: 'fixer', name: 'The Fixer', x: 144, y: 224 }],
        rules: { guns: [{ id: 'starter', name: 'Starter pistol' }] }, objectives: [{ id: 'meet', title: 'Meet a different face', status: 'active' }],
        getState: () => ({ world: { width: 960, height: 640 }, position: { x: 430, y: 366 }, obstacles: [] }),
        onWaypoint: id => window.__waypoints.push(id), onLook: id => window.__looks.push(id), onOpenIntel: () => { window.__intelOpened = true; },
        onPanelChange: () => { if (window.__captureConsent && window.__ui) window.__observedConsent.push(window.__ui.getState().chatJoined); },
        onRead: async kind => { window.__reads.push(kind); const denied = kind === 'chat' && window.__chat403;
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
      });
    });
    const click = async selector => viewport.width <= 680 ? page.locator(selector).tap() : page.locator(selector).click();
    assert.equal(await page.locator('[data-city-objective-tracker]').innerText(), '◆ Meet a different face');
    assert.equal(await page.locator('#tools-host [data-city-world-tools]').count(), 1);
    await page.evaluate(() => window.__ui.update({ trackerVisible: false }));
    assert.equal(await page.locator('[data-city-objective-tracker]').isVisible(), false);
    await page.evaluate(() => window.__ui.update({ trackerVisible: true }));
    await click('[data-city-world-tools]');
    assert.equal(await page.locator('[data-city-minimap]').count(), 1);
    assert.deepEqual(await page.evaluate(() => window.__reads), [], 'Opening a local minimap does not request or mutate gameplay.');
    await click('[data-city-waypoint="training"]');
    assert.deepEqual(await page.evaluate(() => window.__waypoints), ['training']);
    assert.equal(await page.evaluate(() => window.__ui.getState().panel), '');
    await click('[data-city-objective-tracker]'); assert.equal(await page.evaluate(() => window.__intelOpened), true);

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
    assert.deepEqual(errors, []); await context.close();
  }
  console.log('City world UI PASS: map, equipment, queued/dispatched lifecycle, same-key receipt recovery, default-off chat/XSS, furniture targets, confirmed gains and owner teardown on phone/desktop.');
} finally { await browser.close(); }
