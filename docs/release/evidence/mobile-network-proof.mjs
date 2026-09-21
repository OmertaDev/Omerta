// Real PostgreSQL + real browser, default newcomer balances, no injected client board.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import { chromium } from 'playwright-core';

const url = new URL(process.env.RC1_TEST_DATABASE_URL || '');
assert(['localhost','127.0.0.1','[::1]'].includes(url.hostname), 'isolated loopback PostgreSQL required');
const admin = new Pool({ connectionString: url.toString() });
const database = `rc1_mobile_${crypto.randomBytes(6).toString('hex')}`;
await admin.query(`CREATE DATABASE ${database}`);
url.pathname = `/${database}`; process.env.DATABASE_URL = url.toString();
for (const flag of ['CORE_PROGRESSION','WORLD_GRAPH_KERNEL','COORDINATION_ENGINE','COORDINATION_KNOWLEDGE',
  'COORDINATION_KNOWLEDGE_SHARING','COORDINATION_OPERATIONS']) process.env[flag] = 'on';
Object.assign(process.env, { JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'),
  MOD_KEY: crypto.randomBytes(32).toString('hex'), SOCIAL_VERIFY_MODE: 'off', POPULATION_OFF: 'on', LIVING_WORLD_DIRECTOR: 'LIVE', INVITE_MODE: 'off' });
delete process.env.COORDINATION_ACCOUNT_IDS; delete process.env.DIRECTOR_ACCOUNT_IDS;
const directory = path.resolve("C:\\Users\\Jorge\\.codex\\worktrees\\omerta-rc1-closure\\Omerta\\docs\\release\\evidence\\mobile-network"); fs.mkdirSync(directory, { recursive: true });
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((file) => fs.existsSync(file));
let app, browser, activePage; const findings = [], results = [];
try {
  const { buildServer } = await import('file:///C:/Users/Jorge/.codex/worktrees/omerta-rc1-proof/src/server.js');
  app = await buildServer(); const origin = await app.listen({ host: '127.0.0.1', port: 0 });
  browser = await chromium.launch({ executablePath, headless: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) {
    const started = Date.now(), errors = [];
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, locale: 'en-US' });
    const page = await context.newPage(); activePage = page; page.on('pageerror', (error) => errors.push(error.message));
    const network = await context.newCDPSession(page);
    await network.send('Network.enable');
    await network.send('Network.emulateNetworkConditions', { offline: false, latency: 750,
      downloadThroughput: 160000, uploadThroughput: 64000, connectionType: 'cellular3g' });
    await page.goto(origin, { waitUntil: 'networkidle', timeout: 60000 });
    await page.locator('#btn-guest').click();
    await page.locator('#screen-create:not(.hidden)').waitFor();
    await page.setViewportSize({ width: viewport.width, height: 500 });
    await page.locator('#new-name').click();
    await page.locator('#new-name').pressSequentially(('RC1 Network Phone ' + viewport.width).padEnd(24, 'x'));
    assert.equal(await page.locator('#new-name').inputValue().then(v => v.length), 24);
    assert.equal(await page.locator('#new-name').evaluate(el => document.activeElement === el), true);
    await page.locator('#btn-create').scrollIntoViewIfNeeded();
    await page.locator('#btn-create').click();
    await page.locator('#screen-main:not(.hidden)').waitFor();
    await page.setViewportSize(viewport);
    await page.locator('#tour-next').click(); await page.locator('#tour-next').click();
    await page.locator('#welcome.hidden').waitFor({ state: 'attached' });
    const crime = page.locator('#tab-streets .verbrow .prime').first();
    await crime.waitFor({ state: 'visible' });
    const firstResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.startsWith('/v1/crimes/'));
    await crime.click(); const first = await firstResponse;
    assert.equal(first.status(), 200, await first.text());
    const firstActionMs = Date.now() - started;
    // The response can precede the client's queued refresh/result UI on slower hosts.
    await page.locator('#operation-desk[aria-busy="false"]').waitFor({ state: 'attached' });
    await page.locator('.vignette').waitFor({ state: 'hidden' });
    for (let dialogs = 0; dialogs < 4; dialogs++) {
      const closeResult = page.locator('.modal-bg[data-managed-dialog]:visible').last().locator('[data-x], [data-tipok]');
      if (!await closeResult.isVisible()) break;
      await closeResult.click();
    }
    assert.equal(await page.locator('.modal-bg[data-managed-dialog]:visible').count(), 0,
      'all first-action result/onboarding dialogs must have a real dismissal control');
    await page.locator('#bnav [data-go="family"]').click();
    await page.locator('#tabs [data-tab="world"]').click();
    await page.locator('#tab-world .world-summary').waitFor();
    const visible = await page.locator('#tab-world').innerText();
    for (const question of ['What changed?', 'What needs my attention?', 'What can I do?']) assert(visible.includes(question));
    const ready = page.locator('#tab-world [data-world-move]:not([disabled])');
    assert(await ready.count() > 0, 'new players have an available canonical command');
    const chosen = ready.first(), label = await chosen.innerText();
    const box = await chosen.boundingBox();
    if (box.height < 44 || box.width < 44) findings.push(`${viewport.width}: critical Command Center action touch target ${box.width}x${box.height}`);
    let droppedReceipt, committedCensus, dropped = false;
    const census = async () => {
      const counts = {};
      for (const table of ['coordination_instances', 'coordination_commands', 'content_instances', 'content_instance_nodes', 'content_instance_effects',
        'mystery_instances', 'item_events', 'world_kernel_events', 'world_operation_events']) {
        counts[table] = Number((await app.pool.query('SELECT count(*) FROM ' + table)).rows[0].count);
      }
      return counts;
    };
    await page.route('**/v1/commands/execute', async route => {
      if (dropped) return route.continue();
      dropped = true;
      const committed = await route.fetch();
      assert.equal(committed.status(), 200);
      droppedReceipt = await committed.json();
      assert.equal(droppedReceipt.status, 'COMPLETED');
      committedCensus = await census();
      await route.abort('failed'); // Lose the response after the real server committed.
    });
    const resultPromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/v1/commands/execute', { timeout: 60000 });
    await chosen.click();
    const confirm = page.locator('[data-world-choice-confirm]');
    if (await confirm.isVisible()) await confirm.click();
    const retry = page.locator('#world-retry');
    await retry.waitFor({ state: 'visible', timeout: 30000 });
    await retry.click();
    const commandResponse = await resultPromise, response = await commandResponse.json();
    assert.equal(response.replayed, true, 'lost committed response must replay, not execute twice');
    assert.equal(response.executionId, droppedReceipt.executionId, 'retry preserves exact issued identity');
    assert.deepEqual(await census(), committedCensus, 'retry must not duplicate any captured canonical domain rows');
    assert.equal(committedCensus.coordination_instances, results.length + 1,
      'discovery.start creates exactly one canonical coordination instance per new player');
    assert.equal(commandResponse.status(), 200, JSON.stringify(response));
    assert.equal(response.status, 'COMPLETED');
    await page.locator('#tab-world .world-notice[role="status"]').waitFor();
    assert((await page.locator('#tab-world').innerText()).includes(label), 'player sees the action receipt');
    assert(Object.values(droppedReceipt.feedback).some((value) => Array.isArray(value) && value.length), 'first canonical command visibly changes a projection');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (overflow) findings.push(`${viewport.width}: Command Center page overflows horizontally`);
    await page.screenshot({ path: path.join(directory, `command-center-${viewport.width}.png`), fullPage: false });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#bnav [data-go="family"]').click();
    await page.locator('#tabs [data-tab="world"]').click();
    await page.locator('#tab-world .world-summary').waitFor();
    assert.equal(errors.length, 0, errors.join('\n'));
    results.push({ viewport, firstActionMs, firstCanonicalAction: label, commandCompleted: true, consequenceVisible: true, reload: true, javascriptErrors: errors, lostCommittedResponse: true, exactIdentityReplay: true, committedCensus, latencyMs: 750, nameLength: 24, reducedViewportInput: true });
    await context.close();
  }
  fs.writeFileSync(path.join(directory, 'journeys.json'), JSON.stringify({ results, findings, source: '21d0589a8b1f15cbb712e574becd507b813e4b0c', scope: 'Real PostgreSQL; Chromium network throttling and lost committed response. Reduced viewport is a keyboard geometry proxy, not native virtual keyboard proof.' }, null, 2));
  assert.deepEqual(findings, [], 'mobile critical paths');
  console.log(JSON.stringify({ status: 'PASS', results }));
} catch (error) {
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(directory, 'failure.png'), fullPage: true });
  fs.writeFileSync(path.join(directory, 'journey-failure.json'), JSON.stringify({ results, findings, error: error.message }, null, 2));
  throw error;
} finally {
  await browser?.close(); await app?.close(); await app?.pool.end();
  await admin.query(`DROP DATABASE ${database} WITH (FORCE)`); await admin.end();
}

