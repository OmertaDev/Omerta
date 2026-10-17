// Real Phaser/DOM activity cues with a static local fixture; no database or account mutations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

function browserPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  for (const cache of [process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
    process.env.HOME && path.join(process.env.HOME, '.cache', 'ms-playwright')].filter(Boolean)) {
    if (!fs.existsSync(cache)) continue;
    for (const version of fs.readdirSync(cache).filter(name => name.startsWith('chromium')).sort().reverse()) {
      for (const binary of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome',
        'chrome-linux64/chrome', 'chrome-headless-shell-win64/headless_shell.exe',
        'chrome-headless-shell-linux64/headless_shell', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const candidate = path.join(cache, version, binary); if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
    .find(candidate => fs.existsSync(candidate));
}
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="/city-scene.css"><link rel="stylesheet" href="/city-world-ui.css">
  <style>body{margin:0;background:#171b19}#scene{max-width:1040px;margin:auto}button{font:inherit}</style></head>
  <body class="city-player-view"><button id="panel">External panel</button><div id="player-view-switch"></div><main id="scene"></main>
  <script src="/vendor/phaser.js"></script><script src="/city-world-ui.js"></script><script src="/city-scene.js"></script></body></html>`;
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/') { response.setHeader('content-type', 'text/html'); response.end(html); return; }
  const file = path.resolve(publicRoot, '.' + pathname);
  if (!file.startsWith(publicRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
  response.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/png');
  fs.createReadStream(file).pipe(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  const executablePath = browserPath(); assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium executable.');
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const open = async (target, reducedMotion = false) => {
    await target.goto('http://127.0.0.1:' + server.address().port);
    await target.evaluate(reducedMotion => {
      window.character = { id: 'owner', generation: 1, loc: 'docks', name: 'Current player', health: 100, energy: 50, nerve: 30, cash: 200 };
      window.actors = [
        { id: 'public-human', generation: 1, kind: 'player', district: 'docks', name: 'Known neighbor', actions: [] },
        { id: 'public-agent', generation: 1, kind: 'agent', district: 'docks', name: null, actions: [] }
      ];
      window.navigation = [];
      window.scene = window.OmertaCityScene.mount(document.querySelector('#scene'), {
        character: window.character, district: { id: 'docks', name: 'The Docks' }, actors: window.actors,
        worldScopeKey: 'first', reducedMotion, onNavigate: (...args) => window.navigation.push(args),
        renderTraining: host => { host.textContent = 'The existing training panel'; }
      });
      window.receipt = (id, extra = {}) => ({ id, state: 'confirmed', actorId: window.character.id,
        generation: window.character.generation, district: window.character.loc, kind: 'train',
        label: 'Training confirmed', venueId: 'training', at: new Date().toISOString(), ...extra });
    }, reducedMotion);
    await target.waitForFunction(() => window.scene.getState().ready);
  };
  const state = target => target.evaluate(() => window.scene.getState());
  const frames = target => target.evaluate(() => new Promise(resolve => {
    let left = 8; function next() { if (!--left) resolve(); else requestAnimationFrame(next); } requestAnimationFrame(next);
  }));
  await open(page);

  await page.evaluate(() => {
    for (const [index, extra] of [
      { state: 'pending' }, { state: 'error' }, { state: 'unknown' }, { actorId: 'another-owner' },
      { generation: 2 }, { district: 'brick' }, { at: 'not-a-date' }, { at: Date.now() - 61000 }, { at: Date.now() + 6000 }
    ].entries()) window.scene.update({ activityReceipt: window.receipt('invalid-' + index, extra) });
  });
  assert.equal((await state(page)).activities.length, 0, 'Only fresh confirmed receipts for the exact current owner create a cue.');
  const before = (await state(page)).position;
  await page.evaluate(() => { window.confirmed = window.receipt('own-training'); window.scene.update({ activityReceipt: window.confirmed }); });
  await page.waitForFunction(() => window.scene.getState().activities[0]?.rendered);
  const own = (await state(page)).activities[0];
  assert.equal(own.kind, 'train'); assert(own.self);
  assert.match(await page.locator('[data-city-activity]').textContent(), /You · Training confirmed/);
  await page.evaluate(() => { for (let i = 0; i < 5; i++) window.scene.update({ activityReceipt: window.confirmed, actors: window.actors }); });
  assert.equal((await state(page)).activities[0].startedAt, own.startedAt, 'Refresh/replay keeps the original cue lifetime.');
  assert.deepEqual((await state(page)).position, before, 'Confirmed own actions never move the player to a venue.');

  const initialActors = (await state(page)).actorMarkers;
  await page.evaluate(() => {
    window.actors = window.actors.map((actor, index) => ({ ...actor, activity: {
      id: 'public-' + index, kind: index ? 'trade' : 'work', venueId: index ? 'workshop' : 'fixer',
      label: index ? 'Posted a market listing' : 'Pulled a job', at: new Date().toISOString()
    } }));
    window.scene.update({ actors: window.actors });
  });
  await page.waitForFunction(() => window.scene.getState().activities.length === 3 && window.scene.getState().activities.every(activity => activity.rendered));
  assert.match(await page.locator('[data-city-activity]').textContent(), /Unknown agent · Posted a market listing/);
  await page.waitForFunction(initial => window.scene.getState().actorMarkers.some(actor => {
    const start = initial.find(item => item.id === actor.id); return Math.hypot(actor.x - start.x, actor.y - start.y) > 4;
  }), initialActors);
  await page.evaluate(() => window.scene.update({ actors: window.actors }));
  const movingActors = (await state(page)).actorMarkers;
  assert(movingActors.some(actor => { const start = initialActors.find(item => item.id === actor.id); return Math.hypot(actor.x - start.x, actor.y - start.y) > 4; }),
    'Roster refresh preserves a real actor activity path instead of resetting its marker.');
  assert(await page.evaluate(initial => {
    const current = window.scene.getState();
    return current.actorMarkers.every(actor => {
      const start = initial.find(item => item.id === actor.id);
      return Math.hypot(actor.x - start.x, actor.y - start.y) < 80 && !current.obstacles.some(obstacle =>
        actor.x + 7 > obstacle.x && actor.x - 7 < obstacle.x + obstacle.width && actor.y + 7 > obstacle.y && actor.y - 7 < obstacle.y + obstacle.height);
    });
  }, initialActors), 'Activity steps remain short and outside actual building footprints.');

  await page.evaluate(() => window.scene.update({ activityReceipt: window.receipt('hostile', {
    kind: '__proto__', label: '<img src=x onerror=window.__injected=1>'
  }) }));
  assert.equal((await state(page)).activities.find(activity => activity.self).kind, 'work', 'Unrecognized kinds use the neutral work cue.');
  assert.equal(await page.locator('[data-city-activity] img').count(), 0);
  assert.match(await page.locator('[data-city-activity]').textContent(), /<img src=x/);
  assert.equal(await page.evaluate(() => window.__injected), undefined, 'Activity labels are rendered as text.');

  await page.locator('[data-destination="training"]').click();
  await page.locator('[data-city-open]').click();
  assert.equal((await state(page)).gameDock, 'training');
  await page.evaluate(() => { window.scene.update({ externalPanel: true }); document.querySelector('#panel').focus(); });
  const locked = await state(page);
  assert(locked.externalPanel); assert.equal(locked.gameDock, null); assert.equal(locked.selectedVenue, null); assert.equal(locked.pathLength, 0);
  assert(await page.locator('[data-city-move="right"]').isDisabled());
  assert(await page.locator('[data-destination="fixer"]').isDisabled());
  assert(await page.locator('[data-city-world-tools]').isDisabled());
  assert(await page.locator('[data-city-activity]').isVisible(), 'External operation panels leave the activity HUD visible.');
  assert.equal(await page.evaluate(() => window.scene.walkToVenue('fixer')), false);
  assert.equal(await page.evaluate(() => window.scene.showWorldMap()), false);
  await page.evaluate(() => { document.querySelector('canvas').focus(); document.querySelector('[data-destination="fixer"]').click(); });
  await page.keyboard.down('ArrowRight'); await frames(page); await page.keyboard.up('ArrowRight');
  await page.locator('canvas').dispatchEvent('pointerdown', { clientX: 500, clientY: 200 });
  assert.deepEqual((await state(page)).position, locked.position, 'Keyboard and canvas input cannot move the player behind an operation panel.');
  assert.equal((await state(page)).selectedVenue, null); assert.equal(await page.evaluate(() => window.navigation.length), 0);
  await page.evaluate(() => { document.querySelector('#panel').focus(); window.scene.update({ externalPanel: false }); });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'panel', 'Unlocking does not steal focus from the host.');
  assert(!(await page.locator('[data-city-move="right"]').isDisabled()));
  assert(!(await page.locator('[data-destination="fixer"]').isDisabled()));
  await page.locator('canvas').focus(); await page.keyboard.down('ArrowRight');
  await page.waitForFunction(x => window.scene.getState().position.x > x + 12, locked.position.x);
  await page.keyboard.up('ArrowRight');
  assert.equal(await page.evaluate(() => window.scene.walkToVenue('fixer')), true);
  await page.evaluate(() => window.scene.closePanels());
  assert.equal((await state(page)).pathLength, 0, 'closePanels also cancels queued navigation.');

  await page.waitForFunction(() => window.scene.getState().activities.length === 0, null, { timeout: 9000 });
  await page.evaluate(() => window.scene.update({ activityReceipt: window.confirmed, actors: window.actors }));
  assert.equal((await state(page)).activities.length, 0, 'Expired cues do not replay when the same projection returns.');
  await page.evaluate(() => {
    window.scene.update({ activityReceipt: window.receipt('before-scope') });
    window.scene.update({ worldScopeKey: 'second', activityReceipt: window.receipt('same-boundary') });
    window.scene.update({ activityReceipt: window.receipt('same-boundary'), actors: window.actors });
  });
  assert.equal((await state(page)).activities.length, 0, 'Authority changes clear active cues and consume boundary receipts.');
  await page.evaluate(() => {
    window.scene.update({ activityReceipt: window.receipt('before-generation') });
    window.character = { ...window.character, generation: 2 };
    window.scene.update({ character: window.character });
  });
  assert.equal((await state(page)).activities.length, 0, 'Character generation changes clear own and other activity.');
  await page.evaluate(() => window.scene.update({ activityReceipt: window.receipt('new-generation') }));
  assert.equal((await state(page)).activities.length, 1);
  await page.evaluate(() => {
    window.character = { ...window.character, loc: 'brick' };
    window.scene.update({ character: window.character, district: { id: 'brick', name: 'Brick' } });
  });
  assert.equal((await state(page)).activities.length, 0, 'District changes clear all activity.');

  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  mobile.on('pageerror', error => errors.push(error.message));
  await open(mobile, true);
  const still = (await state(mobile)).actorMarkers;
  await mobile.evaluate(() => {
    window.actors[1].activity = { id: 'reduced-public', kind: 'trade', label: 'Posted a market listing', venueId: 'workshop', at: Date.now() };
    window.scene.update({ actors: window.actors, activityReceipt: window.receipt('reduced-own') });
  });
  await mobile.waitForFunction(() => window.scene.getState().activities.length === 2 && window.scene.getState().activities.every(activity => activity.rendered));
  await frames(mobile);
  assert.deepEqual((await state(mobile)).actorMarkers, still, 'Reduced motion keeps public actor positions still.');
  assert((await state(mobile)).activities.every(activity => !activity.moving));
  assert.match(await mobile.locator('[data-city-activity]').textContent(), /You · Training confirmed/);
  assert.match(await mobile.locator('[data-city-activity]').textContent(), /Unknown agent · Posted a market listing/);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Activity feedback fits a phone viewport.');
  await mobile.evaluate(() => {
    window.actors[1] = { ...window.actors[1], generation: 2 };
    window.scene.update({ actors: window.actors });
  });
  assert((await state(mobile)).activities.every(activity => activity.self), 'A new public actor generation cannot reuse its old activity.');
  await mobile.evaluate(() => window.scene.destroy());
  assert.equal(await mobile.locator('[data-city-activity]').count(), 0);
  assert.deepEqual(errors, []);
  console.log('City activity browser: confirmed owner/public cues, guarded identity, replay/expiry, short paths, reduced motion, safe labels and external-panel input lock passed.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
