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
  let interceptNext, responses = 0;
  await page.route('**/v1/circle', async route => {
    const hold = interceptNext; interceptNext = null;
    if (!hold) return route.continue();
    const response = await route.fetch(), bytes = await response.body();
    (result.heldResponses ||= []).push({ status: response.status(), path: '/v1/circle', bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    hold.arrived(); await hold.held; await route.fulfill({ response }); hold.delivered();
  });
  const holdNext = () => {
    let arrived, delivered;
    const pending = new Promise(resolve => { arrived = resolve; }), done = new Promise(resolve => { delivered = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    interceptNext = { arrived, delivered, held }; return { pending, done };
  };
  const settle = async () => { await page.waitForLoadState('networkidle'); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); };
  const state = (locator, prior) => locator.evaluate((node, old) => ({ sameNode: node === old, focused: document.activeElement === node,
    value: node.value, priorConnected: old.isConnected, currentVisible: node.getBoundingClientRect().height > 0,
    selection: [node.selectionStart, node.selectionEnd, node.selectionDirection] }), prior);
  const first = holdNext(); await page.locator('[data-tab="crew"]').click(); await first.pending;
  await diagnostics.mark('crew-render-waiting-for-real-circle');
  const input = page.locator('#crew-say'), original = await input.elementHandle();
  await input.fill('Keep this unsent draft'); await page.setViewportSize({ width, height: 420 }); await input.focus();
  await page.keyboard.press('Home'); await page.keyboard.down('Shift');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Shift'); result.before = await state(input, original);
  assert(await input.evaluate(node => document.activeElement === node)); await diagnostics.mark('draft-focused-before-release');
  release(); await first.done; await settle(); result.after = await state(input, original);
  await diagnostics.mark('after-pending-render-completed'); result.diagnostics = await diagnostics.read(); save();
  assert.equal(result.after.sameNode, true, 'Pending crew render replaced the active draft input');
  assert.equal(result.after.focused, true, 'Pending crew render lost input focus');
  assert.equal(result.after.value, 'Keep this unsent draft', 'Pending crew render lost draft text');
  assert.deepEqual(result.after.selection, result.before.selection, 'Pending crew render changed text selection');
  // The adjacent Send button is part of the editing interaction. Wait until the
  // deferred refresh has actually attempted its canonical reads, then check the
  // same draft and button still exist before ordinary keyboard submission.
  page.on('response', response => { if (new URL(response.url()).pathname === '/v1/circle') responses++; });
  const send = await page.locator('#crew-send').elementHandle();
  const buttonRefresh = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/circle'); buttonRefresh.catch(() => {});
  await page.keyboard.press('Tab'); await buttonRefresh; await settle();
  result.sendFocus = { ...(await state(input, original)), sameSend: await page.locator('#crew-send').evaluate((node, old) => node === old, send),
    focusedSend: await page.locator('#crew-send').evaluate(node => document.activeElement === node) }; save();
  assert.equal(result.sendFocus.sameNode, true, 'Tab-to-Send refresh replaced the unsent draft input');
  assert.equal(result.sendFocus.sameSend, true, 'Tab-to-Send refresh replaced the activation target');
  assert.equal(result.sendFocus.focusedSend, true, 'Tab-to-Send refresh lost button focus');
  assert.equal(result.sendFocus.value, 'Keep this unsent draft', 'Tab-to-Send refresh lost unsent text');
  let submitted = 0;
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/v1/crew/chat') submitted++; });
  const posted = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/v1/crew/chat'); posted.catch(() => {});
  await page.keyboard.press('Enter'); const receipt = await posted;
  assert.equal(receipt.status(), 200); assert.equal(receipt.request().postDataJSON().text, 'Keep this unsent draft');
  await page.locator('#crew-room').getByText('Keep this unsent draft', { exact: false }).waitFor(); await settle();
  assert.equal(submitted, 1); assert.equal(await input.inputValue(), '');
  result.submission = { status: receipt.status(), count: submitted, exactDraft: true, rendered: true };
  // Leaving the completed interaction must still allow a fresh Crew render.
  const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/crew/chat'); refreshed.catch(() => {});
  await page.keyboard.press('Tab'); await refreshed; await settle();
  result.deferred = { freshCircleReads: responses, changedNode: !(await input.evaluate((node, old) => node === old, original)),
    wired: await page.locator('#crew-send').evaluate(node => typeof node.onclick === 'function') };
  assert(result.deferred.freshCircleReads > 0 && result.deferred.changedNode && result.deferred.wired, 'Focusout must finish the deferred refresh');
  // Overlap two real entries. Authenticated requests are serialized, so release
  // the old response after the new entry starts and hold the new circle read.
  // Outside the input, only revision ownership prevents the stale DOM commit.
  const navigate = async id => {
    if (await page.locator('#tabs-more:not(.hidden)').count()) await page.locator('#tabs-more').click();
    for (const group of await page.locator('#grouprail [data-group]').evaluateAll(nodes => nodes.map(node => node.dataset.group))) {
      await page.locator(`#grouprail [data-group="${group}"]`).click();
      if (await page.locator(`[data-tab="${id}"]`).isVisible()) { await page.locator(`[data-tab="${id}"]`).click(); break; }
    }
    await page.locator(`#tab-${id}.on`).waitFor();
  };
  await openTab(f.actors.aBoss, 'family'); const old = holdNext(); await navigate('crew'); await old.pending;
  await navigate('family');
  await navigate('crew');
  const latest = await input.elementHandle(); await input.fill('Newer board draft'); await page.keyboard.press('Tab');
  assert.equal(await input.evaluate(node => document.activeElement === node), false, 'Stale response control must not rely on focused-input deferral');
  const releaseOld = release, current = holdNext(); releaseOld(); await old.done; await current.pending;
  result.stale = await state(input, latest);
  assert.equal(result.stale.sameNode, true, 'Older response replaced the newer crew panel');
  assert.equal(result.stale.value, 'Newer board draft', 'Older response lost the newer draft');
  const newer = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/crew/chat'); newer.catch(() => {});
  release(); await current.done; await newer; await settle();
  assert.equal(await input.evaluate((node, prior) => node !== prior, latest), true, 'Newest render must eventually complete');
  result.checks = ['focused-node-retained', 'draft-retained', 'selection-retained', 'tab-to-send-node-and-draft-retained',
    'ordinary-enter-submits-exact-draft-once', 'fresh-render-on-interaction-exit', 'older-response-cannot-overwrite-newer-entry'];
  assert.deepEqual(result.errors, []); result.status = 'PASS_SCOPED';
} catch (error) { result.status = 'FAIL'; result.error = error.stack; process.exitCode = 1; }
finally {
  release?.(); if (page && !page.isClosed()) { result.diagnostics = await diagnostics.read(); await page.screenshot({ path: path.join(output, 'focus.png'), fullPage: true }); }
  if (browser) await browser.close(); if (app) { await app.close(); await app.pool.end(); }
  delete process.env.DATABASE_URL; await f.cleanup(); save();
}
console.log(JSON.stringify({ status: result.status, source: result.source, width, after: result.after, error: result.error }));
