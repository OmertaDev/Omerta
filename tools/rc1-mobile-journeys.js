#!/usr/bin/env node
// Disposable production-server browser evidence. This is an actual fresh-account
// entry/first-command/recovery journey, not a claim that every campaign was played.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';
import { FURNACE_IDS } from '../src/content/furnace-ledger.js';
import { browserControls, waitForWorldReceipt } from '../test/lib/rc1-browser-controls.js';

const native = process.argv.includes('--postgres');
const selectedWidth = process.argv.find(arg => arg.startsWith('--width='))?.slice(8);
if (native) {
  const database = new URL(process.env.DATABASE_URL);
  assert(['localhost', '127.0.0.1', '[::1]'].includes(database.hostname));
  assert(/^\/rc1_world_[a-f0-9]{24}$/.test(database.pathname), 'Native browser requires the owned-database parent runner');
  assert(process.env.RC1_MOBILE_JOURNEY_OUTPUT && selectedWidth);
} else assert(!process.env.DATABASE_URL && !selectedWidth, 'Default browser journeys require disposable pg-mem');
const widths = native ? [Number(selectedWidth)] : [320, 390];
assert(widths.every(width => [320, 360, 390, 430].includes(width)));
for (const flag of ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE',
  'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS']) process.env[flag] = 'on';
process.env.LIVING_WORLD_DIRECTOR = 'LIVE';
process.env.INVITE_MODE = 'off';
process.env.RATE_LIMIT = 'off';
delete process.env.COORDINATION_ACCOUNT_IDS;
delete process.env.DIRECTOR_ACCOUNT_IDS;
const output = path.resolve(process.env.RC1_MOBILE_JOURNEY_OUTPUT || 'docs/release/evidence/player/mobile');
if (native) assert(!fs.existsSync(path.join(output, 'results.json')), 'Never overwrite a retained browser run');
fs.mkdirSync(output, { recursive: true });
const executablePath = [process.env.CHROMIUM_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
  .find((file) => file && fs.existsSync(file));
assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium binary');
let app, origin;
const browser = await chromium.launch({ executablePath, headless: true });
const results = [];
try {
  for (const width of widths) {
    app = await buildServer();
    origin = await app.listen({ port: 0, host: '127.0.0.1' });
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 },
      isMobile: true, hasTouch: true, locale: 'en-US' });
    const page = await context.newPage(), errors = [], requests = [], telemetry = [], network = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/v1/commands/execute'))
        requests.push({ body: request.postDataJSON(), key: request.headers()['idempotency-key'] });
    });
    page.on('response', (response) => {
      if (response.url().endsWith('/v1/commands/observations')) telemetry.push({ status: response.status(), body: response.request().postDataJSON() });
      if (response.request().method() === 'POST') network.push({ at: new Date().toISOString(), path: new URL(response.url()).pathname, status: response.status() });
    });
    const result = { width, steps: [], controls: [], errors, requests, telemetry, network };
    results.push(result);
    const { reach } = browserControls({ pageFor: async () => ({ page }), width, result, save: () => {} });
    const snapshot = async (stage) => {
      const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        text: document.querySelector('#tab-world')?.innerText || '',
        buttons: [...document.querySelectorAll('#tab-world button')].filter((button) => !button.disabled)
          .map((button) => ({ text: button.innerText, width: button.getBoundingClientRect().width,
            height: button.getBoundingClientRect().height })) }));
      assert(layout.scrollWidth <= layout.width + 1, `${width} ${stage}: horizontal overflow`);
      fs.writeFileSync(path.join(output, `${width}-${stage}.json`), JSON.stringify(layout, null, 2));
      await page.screenshot({ path: path.join(output, `${width}-${stage}.png`), fullPage: true });
      result.steps.push(stage);
      return layout;
    };
    const openTab = async (tabId) => {
      if (await page.locator('#tabs-more:not(.hidden)').count()) await page.locator('#tabs-more').click();
      const groups = await page.locator('#grouprail [data-group]').evaluateAll((elements) => elements.map((entry) => entry.dataset.group));
      for (const group of groups) {
        await page.locator(`#grouprail [data-group="${group}"]`).click();
        const target = page.locator(`[data-tab="${tabId}"]`);
        if (await target.isVisible()) { await target.click(); break; }
      }
      await page.waitForSelector(`#tab-${tabId}.on`);
    };
    const openWorld = async () => { await openTab('world'); await page.waitForSelector('#tab-world.on .world-summary'); };
    const commandBoard = async (graphId = null) => {
      const token = await page.evaluate(() => localStorage.getItem('omerta_token'));
      const response = await app.inject({ method: 'GET', url: '/v1/commands' + (graphId ? `?mysteryGraphId=${encodeURIComponent(graphId)}` : ''),
        headers: { authorization: `Bearer ${token}` } });
      assert.equal(response.statusCode, 200, response.body);
      return response.json();
    };
    const executeVisible = async (command) => {
      assert(command?.availability === 'AVAILABLE', 'The next browser action must be server-issued and available');
      await page.waitForFunction((label) => [...document.querySelectorAll('#tab-world button')]
        .some((button) => button.textContent.trim() === label && !button.disabled), command.label);
      const buttons = page.locator('#tab-world').getByRole('button', { name: command.label, exact: true });
      let chosenButton;
      const findVisible = async () => {
        for (const button of await buttons.all()) if (await button.isVisible() && await button.isEnabled()) return button;
        return null;
      };
      chosenButton = await findVisible();
      if (!chosenButton) for (const details of await page.locator('#tab-world details').all()) {
        if (await details.getAttribute('open') === null) await details.locator('summary').click();
        chosenButton = await findVisible(); if (chosenButton) break;
      }
      assert(chosenButton, `No reachable enabled UI control for ${command.label}`);
      const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST'
        && response.url().endsWith('/v1/commands/execute'));
      // Observe rejection even if clicking a rerendered control itself fails.
      responsePromise.catch(() => {});
      if (native) await reach(page, chosenButton, command.label);
      await chosenButton.click();
      if (command.confirmation?.required) {
        await page.locator('[data-world-choice-confirm]').waitFor({ state: 'visible' });
        const confirmBounds = await page.locator('[data-world-choice-confirm]').boundingBox();
        assert(confirmBounds && confirmBounds.x >= 0 && confirmBounds.x + confirmBounds.width <= width + 1,
          'The confirmation action fits the phone viewport');
        await page.locator('[data-world-choice-confirm]').click();
      }
      const response = await responsePromise;
      assert.equal(response.status(), 200, await response.text());
      const body = await response.json(); assert.equal(body.status, 'COMPLETED');
      await page.waitForFunction(() => sessionStorage.getItem('omerta_world_pending') === null);
      await page.waitForSelector('#tab-world .world-summary');
      if (native) assert.equal(await waitForWorldReceipt(page, command.label), command.label);
      return body;
    };
    try {
      await page.goto(origin, { waitUntil: 'networkidle' });
      await page.locator('#btn-guest').click();
      await page.waitForSelector('#screen-create:not(.hidden)');
      await page.locator('#new-name').fill(`RC1 Mobile ${width}`);
      await page.locator('#btn-create').click();
      await page.waitForSelector('#welcome:not(.hidden)');
      await page.locator('#tour-next').click();
      assert.match(await page.locator('#tour-next').innerText(), /PULL YOUR FIRST JOB/);
      await page.locator('#tour-next').click();
      await page.waitForSelector('#welcome.hidden', { state: 'attached' });
      await openWorld();
      const initial = await commandBoard();
      result.initial = { opportunities: initial.opportunities, commands: initial.commands.map(({ executionIdentity, ...command }) => command),
        cases: initial.cases, consequences: initial.consequences };
      assert(initial.opportunities.length > 0, 'A new player receives an opportunity');
      const lockedKey = initial.commands.find((command) => command.parameters.recipeId === 'recipe:archive_turn_key');
      assert.equal(lockedKey?.availability, 'LOCKED');
      assert(!lockedKey.description.includes('junker'), 'Locked requirements do not reveal the later acquisition guidance');
      const layout = await snapshot('new-player-command-center');
      assert.match(layout.text, /What can I do\?/);
      assert.match(layout.text, /What needs my attention\?/);
      const start = initial.commands.find((command) => command.commandType === 'mystery.start'
        && command.availability === 'AVAILABLE' && command.parameters.graphId === FURNACE_IDS.inspection);
      const chosen = start || initial.commands.find((command) => command.commandType === 'mystery.start' && command.availability === 'AVAILABLE');
      assert(chosen, 'Fresh player has an immediately available case action');
      result.firstCommand = { type: chosen.commandType, label: chosen.label, parameters: chosen.parameters };
      const freshBoard = page.waitForResponse((response) => response.request().method() === 'GET'
        && new URL(response.url()).pathname === '/v1/commands');
      await page.locator('#world-refresh').click(); await freshBoard;
      await page.waitForSelector('#tab-world .world-summary');
      // The server commits, but the phone loses the response. No successful result is forged.
      let dropped = false;
      await page.route('**/v1/commands/execute', async (route) => {
        if (dropped) return route.continue();
        dropped = true;
        const response = await route.fetch();
        if (response.status() !== 200) {
          result.deliveryFailure = { status: response.status(), body: await response.text() };
          return route.fulfill({ response });
        }
        await route.abort('connectionfailed');
      });
      const firstControl = page.locator(`[data-world-mystery="${chosen.parameters.graphId}"]`)
        .getByRole('button', { name: chosen.label, exact: true });
      if (native) await reach(page, firstControl, chosen.label);
      await firstControl.click();
      await page.waitForSelector('#world-retry', { timeout: 30000 });
      await snapshot('response-lost');
      const pending = await page.evaluate(() => JSON.parse(sessionStorage.getItem('omerta_world_pending')));
      assert(pending?.executionId, 'The unknown outcome retains its original execution identity');
      await page.reload({ waitUntil: 'networkidle' });
      await openWorld();
      await page.waitForSelector('#world-retry');
      const retryResponse = page.waitForResponse((response) => response.request().method() === 'POST'
        && response.url().endsWith('/v1/commands/execute'));
      if (native) await reach(page, page.locator('#world-retry'), 'Retry saved move');
      await page.locator('#world-retry').click();
      const replay = await (await retryResponse).json();
      assert.equal(replay.replayed, true, 'Recovery confirms the original committed command');
      await page.waitForFunction(() => sessionStorage.getItem('omerta_world_pending') === null);
      await page.waitForSelector(`[data-world-selected-case="${chosen.parameters.graphId}"]`);
      assert.match(await page.locator(`[data-world-selected-case="${chosen.parameters.graphId}"]`).innerText(), /Case active/);
      await snapshot('recovered-after-refresh');
      assert.equal(requests.length, 2, 'Lost-response recovery issued exactly one initial command and one retry');
      assert.equal(requests[0].key, requests[1].key, 'Retry retains the HTTP idempotency identity');
      assert.deepEqual(requests[0].body, requests[1].body, 'Retry retains the original command body');
      const account = app.jwt.verify(await page.evaluate(() => localStorage.getItem('omerta_token'))).sub;
      const instances = await app.pool.query('SELECT id FROM mystery_instances WHERE authority_account_id=$1 AND graph_id=$2',
        [account, chosen.parameters.graphId]);
      assert.equal(instances.rows.length, 1, 'The lost response and reload do not duplicate the case');
      // Repeated taps while an ordinary command response is slow must execute once.
      await page.unroute('**/v1/commands/execute');
      await page.route('**/v1/commands/execute', async (route) => {
        const response = await route.fetch();
        const delayedAt = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 800));
        result.delayedResponse = { requestedMs: 800, actualMs: Date.now() - delayedAt };
        await route.fulfill({ response });
      });
      const prepared = await commandBoard(chosen.parameters.graphId);
      const complete = prepared.commands.find((command) => command.commandType === 'mystery.complete'
        && command.parameters.graphId === chosen.parameters.graphId && command.availability === 'AVAILABLE');
      assert(complete, 'The first case provides a playable follow-up');
      const button = page.locator(`[data-world-selected-case="${chosen.parameters.graphId}"]`)
        .getByRole('button', { name: complete.label, exact: true });
      await button.scrollIntoViewIfNeeded();
      if (native) await reach(page, button, complete.label);
      const bounds = await button.boundingBox(); assert(bounds);
      const completionResponse = page.waitForResponse((response) => response.request().method() === 'POST'
        && response.url().endsWith('/v1/commands/execute'));
      await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { clickCount: 2, delay: 30 });
      const completion = await (await completionResponse).json();
      assert.equal(completion.status, 'COMPLETED');
      await page.waitForFunction(() => sessionStorage.getItem('omerta_world_pending') === null);
      await page.waitForSelector(`[data-world-selected-case="${chosen.parameters.graphId}"]`);
      assert.equal(requests.length, 3, 'Repeated taps issue one command while the response is delayed');
      assert(result.delayedResponse.actualMs >= 750, 'The committed response was withheld for the required latency interval');
      if (native) assert.equal(await waitForWorldReceipt(page, complete.label), complete.label);
      await snapshot('first-case-completed');
      // Solo preparation: follow an existing public investigation, obtain real
      // materials in the garage, and craft at the Foundry. Only the random garage
      // success/model roll is pinned; no stats, cash, inventory, or cooldown is set.
      await page.unroute('**/v1/commands/execute');
      let current = await commandBoard();
      const graphId = 'omerta.coordination.split-ledger';
      await executeVisible(current.commands.find((command) => command.commandType === 'discovery.start' && command.parameters.graphId === graphId));
      for (let step = 0; step < 12; step++) {
        current = await commandBoard();
        if (current.knowledge.claims.some((claim) => claim.owned && claim.proposition === 'ledger.assembly')) break;
        const run = current.discovery.instances.find((entry) => entry.graphId === graphId && !entry.historical);
        assert(run, 'Started investigation remains visible');
        const action = run.actions.find((entry) => entry.kind === 'complete') || run.actions.find((entry) => entry.kind === 'discover');
        assert(action, 'The local solo source is reachable');
        await executeVisible(current.commands.find((command) => command.commandType === 'discovery.act'
          && command.parameters.instanceId === run.id && command.parameters.actionId === action.id));
      }
      current = await commandBoard();
      assert(current.worldObjects.some((object) => object.id === 'facility:foundry_archive'), 'Authentic solo discovery reveals the archive');
      result.preparation = current.commands.filter((command) => ['recipe.craft', 'world.execute'].includes(command.commandType))
        .map(({ executionIdentity, ...command }) => command);
      const knownKey = result.preparation.find((command) => command.parameters.recipeId === 'recipe:archive_turn_key');
      assert(knownKey.description.includes('Garage') && knownKey.description.includes('Foundry'),
        'A disclosed recipe names a practical material acquisition and crafting path');
      await snapshot('solo-preparation-requirements');
      await page.locator('#go-travel').click();
      const travelResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/v1/travel/foundry'));
      await page.locator('[data-go-district="foundry"]').click();
      assert.equal((await travelResponse).status(), 200);
      await openTab('garage');
      const random = Math.random;
      try {
        Math.random = () => 0.01;
        const boostResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/v1/garage/boost'));
        await page.locator('#tab-garage [data-do="POST /v1/garage/boost"]').click();
        const boosted = await (await boostResponse).json();
        assert.equal(boosted.car?.model, 'junker');
      } finally { Math.random = random; }
      await openWorld(); current = await commandBoard();
      await executeVisible(current.commands.find((command) => command.commandType === 'item.salvage' && command.availability === 'AVAILABLE'));
      current = await commandBoard();
      await executeVisible(current.commands.find((command) => command.commandType === 'recipe.craft'
        && command.parameters.recipeId === 'recipe:archive_turn_key' && command.availability === 'AVAILABLE'));
      current = await commandBoard();
      const worldMove = current.commands.find((command) => command.commandType === 'world.execute'
        && command.parameters.objectId === 'facility:foundry_archive' && command.availability === 'AVAILABLE');
      result.worldGate = { commands: current.commands.filter((command) => command.commandType === 'world.execute')
        .map(({ executionIdentity, ...command }) => command), inventory: current.inventory,
        crew: current.crew, family: current.family, consequences: current.consequences };
      await snapshot('solo-ready-equipment-world-gate');
      assert.deepEqual(errors, [], 'No uncaught page errors during solo preparation');
      assert(telemetry.length > 0 && telemetry.every((entry) => entry.status === 200), 'Preparation telemetry is authenticated and accepted');
      // The canonical World Kernel has required current Family leadership and
      // a uniform eligible Crew since its original authored definition. The
      // solo player prepares the tools; this does not grant collective authority.
      assert.equal(worldMove, undefined, 'Preparation cannot bypass Family authority');
      const archive = current.commands.find(command => command.commandType === 'world.execute'
        && command.parameters.objectId === 'facility:foundry_archive');
      assert.equal(archive?.availability, 'LOCKED');
      assert(archive.blockers.some(blocker => blocker.code === 'family_authority'));
      assert((await page.locator('#tab-world').innerText()).includes('This requires current Family leadership and an eligible Crew.'));
      assert.equal(current.worldObjects.find(object => object.id === 'facility:foundry_archive')?.state, 'sealed');
      assert.equal(current.crew, null, 'The path remains solo');
      assert.equal(current.family, null, 'No Family fixture is required');
      assert(current.commands.some(command => command.availability === 'AVAILABLE'), 'Another authorized next action remains available');
      result.collectiveBoundary = { prepared: true, state: 'sealed', requiredAuthority: 'current Family leadership and eligible Crew',
        worldActionExecuted: false, note: 'Collective completion belongs to the separate social/Family golden journey' };
      result.after = { opportunities: current.opportunities, consequences: current.consequences,
        availableCommands: current.commands.filter((command) => command.availability === 'AVAILABLE')
          .map(({ executionIdentity, ...command }) => command) };
      assert.deepEqual(errors, [], 'No uncaught page errors');
      assert(telemetry.length > 0 && telemetry.every((entry) => entry.status === 200), 'UI telemetry observations are authenticated and accepted');
      result.status = 'PASS';
      console.log(`PASS ${width}px: fresh solo account, command recovery, repeated taps, canonical discovery/travel/garage/salvage/craft and visible Family gate; telemetry=${telemetry.length}`);
    } catch (error) {
      result.status = 'FAIL'; result.error = error.stack;
      await snapshot('failure').catch(() => {});
      console.error(`FAIL ${width}px: ${error.stack}`);
    } finally { await context.close(); await app.close(); if (native) await app.pool.end(); app = null; }
  }
} finally {
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ database: native ? 'owned native PostgreSQL' : 'disposable pg-mem', browser: await browser.version(),
    contentMode: 'LIVE with existing foundation flags enabled; no chain/economic activation', results }, null, 2));
  await browser.close(); if (app) { await app.close(); if (native) await app.pool.end(); }
}
assert(results.length === widths.length && results.every((result) => result.status === 'PASS'), 'RC1 golden solo journey failed; see recorded release blockers');
