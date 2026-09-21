// Controlled transport delay, real crew response and rendered controls. No UI state edits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { browserControls } from './lib/rc1-browser-controls.js';
import { installFocusDiagnostics } from './lib/rc1-focus-diagnostics.js';
assert(process.env.COORDINATION_TEST_DATABASE_URL && process.env.RC1_GOLDEN_BROWSER_OUTPUT);
if (!process.argv.includes('--postgres')) process.argv.push('--postgres');
for (const flag of ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS']) process.env[flag] = 'on';
Object.assign(process.env, { LIVING_WORLD_DIRECTOR: 'LIVE', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off' });
for (const key of ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY']) process.env[key] = crypto.randomBytes(32).toString('hex');
const [{ dockFixture }, { buildServer }] = await Promise.all([import('./lib/director-support.js'), import('../src/server.js')]);
const width = Number(process.env.RC1_GOLDEN_BROWSER_WIDTH || 320), output = process.env.RC1_GOLDEN_BROWSER_OUTPUT;
fs.mkdirSync(output, { recursive: true }); assert(!fs.existsSync(path.join(output, 'results.json')));
const result = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), status: 'RUNNING', width,
  scope: 'Native crew input preservation while a real canonical circle response is held after tab entry',
  fixtures: 'Existing dockFixture initial actors/social membership; no post-baseline SQL/domain mutation', controls: [], recoveries: [], errors: [] };
const save = () => fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2)); save();
const binary = [process.env.CHROMIUM_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
const f = await dockFixture(`focus_${width}_${crypto.randomBytes(3).toString('hex')}`); let app, browser, page, diagnostics, release;
try {
  const schema = (await f.pool.query('SELECT current_schema() AS name')).rows[0].name;
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL); endpoint.searchParams.set('options', `-c search_path=${schema}`); process.env.DATABASE_URL = endpoint.toString();
  app = await buildServer(); const origin = await app.listen({ port: 0, host: '127.0.0.1' });
  browser = await chromium.launch({ ...(binary ? { executablePath: binary } : {}), headless: true });
  const context = await browser.newContext({ viewport: { width, height: 700 }, isMobile: true, hasTouch: true }); page = await context.newPage();
  diagnostics = await installFocusDiagnostics(page); page.on('pageerror', error => result.errors.push(error.message));
  await page.addInitScript(token => localStorage.setItem('omerta_token', token), app.jwt.sign({ sub: f.actors.aBoss, tv: 0 }));
  await page.addLocatorHandler(page.locator('[data-tipok]'), () => page.locator('[data-tipok]').click());
  await page.addLocatorHandler(page.locator('#welcome:not(.hidden)'), () => page.locator('#tour-skip').click());
  await page.goto(origin, { waitUntil: 'networkidle' }); await page.locator('#screen-main:not(.hidden)').waitFor();
  const { openTab } = browserControls({ pageFor: async () => ({ page }), width, result, save });
  await openTab(f.actors.aBoss, 'crew'); await page.locator('#crew-say').waitFor();
  await page.waitForFunction(() => typeof document.querySelector('#crew-send')?.onclick === 'function');
  await diagnostics.mark('initial-crew-settled'); await openTab(f.actors.aBoss, 'family');
  let arrived; const pending = new Promise(resolve => { arrived = resolve; }), held = new Promise(resolve => { release = resolve; });
  let intercepted = false;
  await page.route('**/v1/circle', async route => {
    if (intercepted) return route.continue(); intercepted = true;
    const response = await route.fetch(); result.heldResponse = { status: response.status(), path: '/v1/circle' }; arrived();
    await held; await route.fulfill({ response });
  });
  await page.locator('[data-tab="crew"]').click(); await pending;
  await diagnostics.mark('crew-render-waiting-for-real-circle');
  const input = page.locator('#crew-say'), original = await input.elementHandle();
  await input.fill('Keep this unsent draft'); await page.setViewportSize({ width, height: 420 }); await input.focus();
  assert(await input.evaluate(node => document.activeElement === node)); await diagnostics.mark('draft-focused-before-release');
  const finished = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/crew/chat');
  finished.catch(() => {}); release(); await finished;
  await page.waitForLoadState('networkidle'); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  result.after = await input.evaluate((node, prior) => ({ sameNode: node === prior, focused: document.activeElement === node,
    value: node.value, priorConnected: prior.isConnected, currentVisible: node.getBoundingClientRect().height > 0 }), original);
  await diagnostics.mark('after-pending-render-completed'); result.diagnostics = await diagnostics.read(); save();
  assert.equal(result.after.sameNode, true, 'Pending crew render replaced the active draft input');
  assert.equal(result.after.focused, true, 'Pending crew render lost input focus');
  assert.equal(result.after.value, 'Keep this unsent draft', 'Pending crew render lost draft text');
  assert.deepEqual(result.errors, []); result.status = 'PASS_SCOPED';
} catch (error) { result.status = 'FAIL'; result.error = error.stack; process.exitCode = 1; }
finally {
  release?.(); if (page && !page.isClosed()) { result.diagnostics = await diagnostics.read(); await page.screenshot({ path: path.join(output, 'focus.png'), fullPage: true }); }
  if (browser) await browser.close(); if (app) { await app.close(); await app.pool.end(); }
  delete process.env.DATABASE_URL; await f.cleanup(); save();
}
console.log(JSON.stringify({ status: result.status, source: result.source, width, after: result.after, error: result.error }));
