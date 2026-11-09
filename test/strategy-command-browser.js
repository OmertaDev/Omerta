// The city command table reads real district records; map inspection never issues gameplay moves.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';

if (process.env.DATABASE_URL) throw new Error('Strategy command checks require the disposable in-memory database.');
const executablePath = process.env.CHROMIUM_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(fs.existsSync);
assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser.');
const artifacts = process.env.STRATEGY_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-strategy-'));
fs.mkdirSync(artifacts, { recursive: true });
const app = await buildServer();
const faults = [];
const statusNames = { open: 'Open territory', occupied: 'Occupied', mine: 'Your family', held: 'Family controlled', contested: 'Contested' };
let browser;
let activePage;

async function call(method, url, token, payload) {
  const response = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal(response.statusCode, 200, `${method} ${url}`);
  return response.json();
}
async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(size.scroll <= size.width + 1, `${label} overflows: ${JSON.stringify(size)}`);
}
async function aboveFold(page, selector, label) {
  const position = await page.locator(selector).first().evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: innerHeight };
  });
  assert.ok(position.top >= 0 && position.bottom <= position.height, `${label} is below the fold: ${JSON.stringify(position)}`);
}
async function districtFacts(page) {
  return page.locator('.strategy-district-facts > div').evaluateAll(rows => Object.fromEntries(rows.map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent])));
}
async function assertDistrict(page, district) {
  const button = page.locator(`[data-strategy-district="${district.id}"]`);
  assert.equal(await button.getAttribute('aria-pressed'), 'true', `${district.name} is selected`);
  assert.equal(await button.getAttribute('data-state'), district.state, 'district state comes from the server map');
  assert.equal(await page.locator('[data-strategy-district][aria-pressed="true"]').count(), 1);
  assert.equal(await page.locator('.strategy-inspector h3').innerText(), district.name);
  const facts = await districtFacts(page);
  const control = district.holder ? [district.holder.tag, district.holder.name].filter(Boolean).join(' · ') : district.occupier?.name || 'No recorded holder';
  assert.equal(facts.Control, control, 'the inspector names the recorded holder or occupier');
  assert.equal(facts.Status, statusNames[district.state], 'the inspector describes the authoritative control state');
  assert.equal(facts['District perk'], district.perk, 'the inspector retains the published district perk');
}
async function assertCameraDisabled(page) {
  const buttons = page.locator('[data-strategy-camera]');
  assert.equal(await buttons.count(), 3, 'the map exposes its three camera controls');
  for (const button of await buttons.all())
    assert.equal(await button.isDisabled(), true, 'camera controls are disabled without an active 3D renderer');
}

try {
  const { token } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', token, { name: 'Strategy Command Player' });
  // Different control states make stale or hardcoded inspector records observable.
  await app.pool.query("UPDATE districts SET npc_holder=NULL, holder_gang=NULL, garrison=4321 WHERE id='canal'");
  const board = await call('GET', '/v1/map', token);
  assert.equal(board.districts.length, 6, 'the fixture exposes the six authoritative city districts');
  await app.listen({ port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader'] });

  async function open(viewport, { blockRenderer = false } = {}) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', locale: 'en-US', serviceWorkers: 'block' });
    await context.addInitScript(value => {
      localStorage.setItem('omerta_token', value);
      localStorage.setItem('omerta_tour2', '1');
      localStorage.setItem('omerta_welcomed', '1');
      window.__strategyWebGLDraws = 0;
      // Observe real draw commands without needing production-only inspection hooks.
      for (const name of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
        const prototype = window[name]?.prototype;
        if (!prototype) continue;
        for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
          const original = prototype[method];
          if (typeof original !== 'function') continue;
          prototype[method] = function (...args) {
            const result = Reflect.apply(original, this, args);
            window.__strategyWebGLDraws++;
            return result;
          };
        }
      }
    }, token);
    const page = await context.newPage(), requests = [];
    activePage = page;
    page.on('pageerror', error => faults.push(error.message));
    page.on('request', request => requests.push({ method: request.method(), path: new URL(request.url()).pathname, at: Date.now() }));
    if (blockRenderer) await page.route('**/vendor/strategy-city-renderer.js*', route => route.abort('failed'));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('#tab-start.on .start-next-card').waitFor();
    await page.locator('#strategy-command').waitFor();
    await page.locator('#tab-start [data-feel-loading]').waitFor({ state: 'hidden' });
    return { page, context, requests };
  }

  const desktop = await open({ width: 1440, height: 900 });
  const { page } = desktop;
  await page.locator('.strategy-map-status').filter({ hasText: 'Current city records' }).waitFor();
  assert.equal(await page.locator('.strategy-orders > .start-first-week').count(), 1, 'the original first-week panel lives beside the desktop map');
  await aboveFold(page, '.strategy-orders .start-next-card .act', 'desktop original first-week action');
  assert.equal(await page.locator('[data-strategy-district]').count(), 6);
  const initialReads = desktop.requests.filter(request => request.method === 'GET' && request.path === '/v1/map');
  assert.ok(initialReads.length >= 1 && initialReads.length <= 2, 'initial map loading uses a bounded read');
  const inspectedAt = Date.now(), initialWrites = desktop.requests.filter(request => request.method === 'POST').length;

  for (const district of board.districts) {
    await page.locator(`[data-strategy-district="${district.id}"]`).click();
    await assertDistrict(page, district);
  }
  // Tactile presses must preserve the centered map label until mouseup dispatches its click.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => document.body.classList.add('ux-feel-tactile'));
  try {
    for (const district of board.districts) {
      const button = page.locator(`[data-strategy-district="${district.id}"]`);
      const rect = await button.boundingBox();
      assert.ok(rect);
      const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.waitForTimeout(50);
      assert.equal(await button.evaluate(element => element.classList.contains('ux-feel-pressed')), true, 'normal-motion coverage exercises an actual tactile press');
      assert.equal(await page.evaluate(({ x, y, id }) => document.elementFromPoint(x, y)?.closest('button')?.dataset.strategyDistrict === id, { ...point, id: district.id }), true, 'the district label stays beneath the pointer while pressed');
      await page.mouse.up();
      await assertDistrict(page, district);
    }
  } finally {
    await page.mouse.up();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => document.body.classList.remove('ux-feel-tactile'));
  }
  const chosen = board.districts.find(district => district.id === 'canal');
  const keyboardDistrict = page.locator('[data-strategy-district="canal"]');
  await keyboardDistrict.focus();
  await page.keyboard.press('Enter');
  await assertDistrict(page, chosen);
  assert.equal(await keyboardDistrict.evaluate(element => element === document.activeElement), true, 'district selection retains keyboard focus');
  for (const mode of ['influence', 'trade', 'districts']) {
    const button = page.locator(`[data-strategy-mode="${mode}"]`);
    await button.focus();
    await page.keyboard.press('Space');
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-strategy-mode][aria-pressed="true"]').count(), 1);
    assert.equal(await button.evaluate(element => element === document.activeElement), true, 'map-mode controls retain keyboard focus');
    await assertDistrict(page, chosen);
    const facts = await districtFacts(page);
    if (mode === 'influence') assert.equal(facts.Garrison, Number(chosen.garrison).toLocaleString('en-US'));
    if (mode === 'trade') assert.equal(facts['Street deeds'], Number(chosen.deeds).toLocaleString('en-US'));
  }
  await page.waitForTimeout(1200);
  const webglAvailable = await page.evaluate(() => {
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) return false;
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  });
  if (webglAvailable) {
    await page.locator('.strategy-canvas[data-renderer="ready"] .strategy-city-canvas').waitFor();
    assert.ok(await page.locator('.strategy-city-canvas').getAttribute('data-three-revision'), 'the loaded scene identifies its Three.js renderer');
    await page.waitForFunction(() => window.__strategyWebGLDraws > 0);
    assert.equal(await page.locator('.strategy-city-canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2');
      return !!gl && !gl.isContextLost() && gl.drawingBufferWidth > 0 && gl.drawingBufferHeight > 0;
    }), true, 'the strategy scene has a live rendered WebGL context');
    const camera = page.getByRole('group', { name: 'Map camera', exact: true });
    for (const label of ['Zoom in', 'Zoom out', 'Reset map view'])
      assert.equal(await camera.getByRole('button', { name: label, exact: true }).isEnabled(), true, `${label} is available with the 3D map`);
    for (const label of ['Zoom in', 'Reset map view', 'Zoom out', 'Reset map view']) {
      const draws = await page.evaluate(() => window.__strategyWebGLDraws);
      await camera.getByRole('button', { name: label, exact: true }).click();
      await page.waitForFunction(previous => window.__strategyWebGLDraws > previous, draws);
      await assertDistrict(page, chosen);
    }
  } else {
    await page.locator('.strategy-canvas[data-renderer="fallback"]').waitFor();
    await assertCameraDisabled(page);
  }
  const additionalReads = desktop.requests.filter(request => request.method === 'GET' && request.path === '/v1/map').length - initialReads.length;
  assert.ok(additionalReads <= Math.floor((Date.now() - inspectedAt) / 30000), 'inspection and camera controls reuse map records within the 30-second read window');
  assert.equal(desktop.requests.filter(request => request.method === 'POST').length, initialWrites, 'map inspection and camera controls issue no gameplay POSTs');
  await noOverflow(page, 'desktop city command');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, 'strategy-desktop.png') });
  await desktop.context.close();

  for (const width of [390, 320]) {
    const mobile = await open({ width, height: 844 });
    const stage = mobile.page.locator('#strategy-command');
    assert.equal(await stage.evaluate(element => element.tagName), 'DETAILS', 'mobile map uses a native disclosure');
    assert.equal(await stage.getAttribute('open'), null, 'mobile starts with the command map closed');
    assert.equal(await mobile.page.locator('#tab-start > .start-first-week').count(), 1, 'mobile retains the original first-week panel');
    assert.equal(await mobile.page.locator('#tab-start > .start-first-week + #strategy-command').count(), 1, 'the optional map follows the first-week action');
    assert.equal(await mobile.page.locator('#tab-start .start-next-card .act').first().isVisible(), true);
    assert.equal(mobile.requests.filter(request => request.method === 'GET' && request.path === '/v1/map').length, 0, 'a closed mobile map makes no extra map read');
    assert.equal(await mobile.page.locator('.strategy-city-canvas').count(), 0, 'the closed mobile map starts without a WebGL scene');
    await assertCameraDisabled(mobile.page);
    await noOverflow(mobile.page, `${width}px closed command map`);
    if (width === 390) await mobile.page.screenshot({ path: path.join(artifacts, 'strategy-mobile.png') });
    await stage.locator(':scope > summary').focus();
    await mobile.page.keyboard.press('Enter');
    await mobile.page.locator('.strategy-map-status').filter({ hasText: 'Current city records' }).waitFor();
    const button = mobile.page.locator('[data-strategy-district="canal"]');
    await button.click();
    await assertDistrict(mobile.page, chosen);
    await assertCameraDisabled(mobile.page);
    await noOverflow(mobile.page, `${width}px expanded command map`);
    if (width === 390) await stage.screenshot({ path: path.join(artifacts, 'strategy-mobile-expanded.png') });
    assert.ok(mobile.requests.filter(request => request.method === 'GET' && request.path === '/v1/map').length <= 1, 'expanding the mobile map uses a single read');
    await mobile.context.close();
  }

  const fallback = await open({ width: 1440, height: 900 }, { blockRenderer: true });
  await fallback.page.locator('.strategy-canvas[data-renderer="fallback"]').waitFor();
  await fallback.page.locator('.strategy-map-status').filter({ hasText: 'Current city records' }).waitFor();
  assert.equal(await fallback.page.locator('.strategy-city-canvas').count(), 0);
  await assertCameraDisabled(fallback.page);
  assert.equal(await fallback.page.getByRole('group', { name: 'Inspect a district', exact: true }).getByRole('button').count(), 6, 'all district controls remain accessible when the renderer cannot load');
  await fallback.page.locator('[data-strategy-district="canal"]').click();
  await assertDistrict(fallback.page, chosen);
  await fallback.page.locator('[data-strategy-mode="influence"]').click();
  assert.equal((await districtFacts(fallback.page)).Garrison, '4,321');
  await aboveFold(fallback.page, '.strategy-orders .start-next-card .act', 'fallback original first-week action');
  await noOverflow(fallback.page, 'renderer failure fallback');
  await fallback.context.close();
  assert.deepEqual(faults, [], 'map rendering and fallback introduce no unhandled browser errors');
  console.log('strategy-command-browser: PASS (live districts, tactile clicks, modes, keyboard focus, bounded reads, desktop orders, 320/390px disclosures, Three.js camera controls and bundle-failure fallback)');
  console.log(`Screenshots: ${artifacts}`);
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: path.join(artifacts, 'strategy-failure.png') }).catch(() => {});
    console.error('Strategy failure state:', await activePage.evaluate(() => ({
      renderer: document.querySelector('.strategy-canvas')?.getAttribute('data-renderer'),
      stage: document.querySelector('#strategy-command')?.tagName,
      status: document.querySelector('.strategy-map-status')?.textContent,
      districtControls: document.querySelectorAll('[data-strategy-district]').length,
      canvases: document.querySelectorAll('.strategy-city-canvas').length,
    })).catch(() => null));
  }
  throw error;
} finally {
  await browser?.close();
  await app.close();
}
