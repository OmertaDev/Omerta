// Reused from reviewed validation commit 36156ace3f4e4600badc8394a205d0e10432d227.
// Historical results are not evidence: run this harness against the candidate.
// Seeded multiplayer campaign actions through rendered mobile command controls.
// Starting characters/social structures are fixtures. Every tested command is
// issued and executed by the production HTTP server against real PostgreSQL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createCampaignNetworkDefinitions } from '../src/director/campaign-network.js';
import { worldKernelInvariants } from '../src/world-kernel-invariants.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Use a disposable loopback PostgreSQL cluster');
if (!process.argv.includes('--postgres')) process.argv.push('--postgres');
const { campaignNetworkFixture } = await import('../test/lib/campaign-network-support.js');
for (const flag of ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS']) process.env[flag] = 'on';
Object.assign(process.env, { LIVING_WORLD_DIRECTOR: 'LIVE', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off' });
for (const name of ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY']) process.env[name] = crypto.randomBytes(32).toString('hex');
delete process.env.COORDINATION_ACCOUNT_IDS; delete process.env.DIRECTOR_ACCOUNT_IDS;
const output = path.resolve(process.env.RC1_CAMPAIGN_MOBILE_OUTPUT || 'docs/release/evidence/player/campaign-mobile');
fs.mkdirSync(output, { recursive: true });
const binary = [process.env.CHROMIUM_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find((file) => file && fs.existsSync(file));
const browser = await chromium.launch({ ...(binary ? { executablePath: binary } : {}), headless: true });
const report = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  harnessSha256: crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),
  node: process.version, platform: process.platform, startedAt: new Date().toISOString(),
  scope: 'Seeded accounts, social structures and initial world. Travel, vehicle acquisition/salvage and disclosure sharing use existing domain services. Discovery, mystery, crafting and operation commands use rendered mobile controls against real PostgreSQL. Not fresh-account onboarding or a human comprehension study.', results: [] };
const save = () => fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
const scenarios = [
  { name: 'shipment-redistribution', actions: [['redistribute_shipment', 'a']] },
  { name: 'shipment-destruction', actions: [['destroy_shipment', 'a']] },
  { name: 'black-market-supply', actions: [['intercept_shipment', 'b'], ['establish_market', 'b'], ['supply_market', 'b']] },
  { name: 'black-market-seizure', actions: [['intercept_shipment', 'b'], ['establish_market', 'b'], ['seize_market', 'a']] },
  { name: 'informant-public-disclosure', actions: [['intercept_shipment', 'b'], ['establish_market', 'b'], ['expose_market', 'b']] },
];
try {
  for (const width of [320, 390]) for (const scenario of scenarios) {
    if (process.env.RC1_CAMPAIGN_MOBILE_CASE && !process.env.RC1_CAMPAIGN_MOBILE_CASE.split(',').includes(scenario.name)) continue;
    const f = await campaignNetworkFixture(`rc1m_${width}_${scenarios.indexOf(scenario)}`);
    let app; const contexts = [], sessions = new Map();
    const result = { width, scenario: scenario.name, status: 'RUNNING', commands: [], outcomes: [], recoveries: [], errors: [] }; report.results.push(result); save();
    try {
      await f.networkEstablish();
      const director = createLivingWorldDirector({ pool: f.pool, content: f.content, definitions: createCampaignNetworkDefinitions(f.content), mode: 'LIVE', clock: f.clock });
      await director.tick();
      const schema = (await f.pool.query('SELECT current_schema() AS name')).rows[0].name;
      const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
      endpoint.searchParams.set('options', `-c search_path=${schema}`); process.env.DATABASE_URL = endpoint.toString();
      app = await buildServer(); const origin = await app.listen({ port: 0, host: '127.0.0.1' });
      const pageFor = async (account) => {
        if (sessions.has(account)) return sessions.get(account);
        const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, isMobile: true, hasTouch: true, locale: 'en-US' });
        contexts.push(context); const page = await context.newPage();
        page.on('pageerror', (error) => result.errors.push(error.message));
        const token = app.jwt.sign({ sub: account, tv: 0 });
        await page.addInitScript((value) => localStorage.setItem('omerta_token', value), token);
        await page.addLocatorHandler(page.locator('[data-tipok]'), async () => page.locator('[data-tipok]').click());
        await page.addLocatorHandler(page.locator('#welcome:not(.hidden)'), async () => page.locator('#tour-skip').click());
        await page.goto(origin, { waitUntil: 'networkidle' });
        await page.waitForSelector('#screen-main:not(.hidden)');
        if (await page.locator('#welcome:not(.hidden)').isVisible()) await page.locator('#tour-skip').click();
        if (await page.locator('#tabs-more:not(.hidden)').count()) await page.locator('#tabs-more').click();
        const groups = await page.locator('#grouprail [data-group]').evaluateAll((elements) => elements.map((entry) => entry.dataset.group));
        for (const group of groups) {
          await page.locator(`#grouprail [data-group="${group}"]`).click();
          const tab = page.locator('[data-tab="world"]');
          if (await tab.isVisible()) { await tab.click(); break; }
        }
        await page.waitForSelector('#tab-world.on .world-summary');
        sessions.set(account, { page, board: null }); return sessions.get(account);
      };
      const engine = {
        retryIssuedCommand: async (account, command, error) => {
          if (error.statusCode !== 409 || !['command_stale', 'command_unavailable', 'command_expired'].includes(error.body?.error)) return false;
          const { page } = await pageFor(account);
          await page.waitForFunction(() => sessionStorage.getItem('omerta_world_pending') === null);
          await page.waitForSelector('#tab-world .world-summary');
          await page.waitForLoadState('networkidle');
          result.recoveries.push({ account, type: command.commandType, parameters: command.parameters,
            rejectedExecutionId: command.executionIdentity.executionId, error: error.body.error,
            action: 'Use visible Refresh world, then issue and click the same command type/parameters once' });
          save(); return true;
        },
        snapshot: async (account, options = {}) => {
          const session = await pageFor(account), { page } = session;
          await page.waitForLoadState('networkidle');
          const update = async (control) => {
            const waiting = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/v1/commands');
            waiting.catch(() => {}); await control.click(); const response = await waiting;
            assert.equal(response.status(), 200, await response.text());
            session.board = await response.json(); await page.waitForSelector('#tab-world .world-summary');
            await page.waitForLoadState('networkidle');
          };
          await update(page.locator('#world-refresh'));
          if (options.operationId && session.board.operations.selected?.id !== options.operationId) {
            const index = session.board.operations.instances.findIndex((entry) => entry.id === options.operationId); assert(index >= 0);
            await update(page.locator(`[data-world-instance="${index}"]`));
          }
          if (options.mysteryGraphId && session.board.cases.selected?.graph?.id !== options.mysteryGraphId) {
            const index = session.board.cases.catalog.findIndex((entry) => entry.graphId === options.mysteryGraphId && entry.started);
            if (index >= 0) await update(page.locator(`[data-world-case="${index}"]`));
          }
          assert(session.board, 'Production projection must render'); return session.board;
        },
        execute: async (account, input, key) => {
          assert.equal(key, input.executionId); const { page, board } = await pageFor(account);
          const command = board.commands.find((entry) => entry.executionIdentity?.executionId === input.executionId);
          assert(command, 'Issued identity must belong to the rendered board');
          let buttons = page.locator('#tab-world').getByRole('button', { name: command.label, exact: true });
          // Several requirement controls share a label. Select the command's
          // position in its visible context, then still verify the exact HTTP
          // identity below. Choosing the first same-label button is ambiguous.
          const contextual = (type, id) => board.commands.filter((entry) => [entry.subject, entry.target]
            .some((reference) => reference?.type === type && reference.id === id));
          if (command.parameters?.operationId && board.operations.selected?.id === command.parameters.operationId) {
            const selected = board.operations.selected;
            const context = page.locator('#tab-world article.world-entry').filter({ has: page.getByRole('heading', { level: 3, name: selected.title, exact: true }) });
            const index = contextual('operation', selected.id).findIndex((entry) => entry.commandId === command.commandId);
            assert(index >= 0); buttons = context.locator(':scope > .world-command > button').nth(index);
          } else if (command.commandType === 'discovery.act') {
            const id = command.parameters.instanceId;
            const instanceIndex = board.discovery.instances.findIndex((entry) => entry.id === id);
            const index = contextual('discovery', id).findIndex((entry) => entry.commandId === command.commandId);
            assert(instanceIndex >= 0 && index >= 0);
            const context = page.locator('#tab-world section.world-card').filter({ has: page.getByRole('heading', { level: 3, name: 'What have I discovered?', exact: true }) })
              .locator(':scope > article.world-entry').nth(instanceIndex);
            buttons = context.locator(':scope > .world-command > button').nth(index);
          }
          let chosen;
          const reachable = async () => { for (const button of await buttons.all()) if (await button.isVisible() && await button.isEnabled()) return button; };
          chosen = await reachable();
          if (!chosen) for (const details of await page.locator('#tab-world details').all()) {
            if (await details.getAttribute('open') === null) await details.locator('summary').click();
            chosen = await reachable(); if (chosen) break;
          }
          assert(chosen, `No reachable ${width}px primary action: ${command.label}`);
          // Position the real control clear of fixed phone navigation, then use
          // a normal hit-tested click. Never force clicks through an overlay.
          await chosen.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
          const waiting = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/v1/commands/execute'));
          waiting.catch(() => {}); await chosen.click();
          if (command.confirmation.required) {
            const confirm = page.locator('[data-world-choice-confirm]'); await confirm.waitFor({ state: 'visible' });
            const box = await confirm.boundingBox(); assert(box && box.width > 0 && box.x >= -1 && box.x + box.width <= width + 1, 'Confirmation must fit viewport');
            await confirm.click();
          }
          const response = await waiting;
          const executed = response.request().postDataJSON(); assert.equal(executed.executionId, input.executionId, 'Clicked control must execute the requested identity');
          const body = await response.json();
          if (response.status() !== 200) throw Object.assign(new Error(JSON.stringify(body)), { statusCode: response.status(), body });
          assert.equal(body.status, 'COMPLETED');
          await page.waitForFunction(() => sessionStorage.getItem('omerta_world_pending') === null);
          await page.waitForSelector('#tab-world .world-summary');
          await page.waitForLoadState('networkidle');
          const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
          assert(layout.scrollWidth <= width + 1, 'No Command Center horizontal overflow');
          result.commands.push({ account, type: command.commandType, label: command.label, confirmed: command.confirmation.required });
          save();
          return body;
        },
      };
      if (scenario.name === 'shipment-redistribution') {
        const boss = f.actors.aBoss;
        await f.networkMystery(boss, f.ids.shipmentEvidence, 'start', engine);
        await f.networkMystery(boss, f.ids.shipmentEvidence, 'complete', engine);
        await f.networkCraft(boss, 1, engine);
        await f.networkMystery(boss, f.ids.shipmentEvidence, 'discover', engine);
        await f.networkMystery(boss, f.ids.shipmentEvidence, 'complete', engine);
      }
      for (const [action, prefix] of scenario.actions) {
        const operation = await f.networkPrepare(action, { prefix, engine });
        await operation.command('organizer', 'execute');
        f.advance(601); await director.tick();
        const board = await engine.snapshot(operation.boss);
        assert(board.consequences.length, 'A participant must receive authorized consequences');
        result.outcomes.push({ action, state: (await f.kernel.get(operation.boss, f.ids.object)).state,
          consequences: board.consequences.map(({ title, description, opportunityIds }) => ({ title, description, opportunityIds })) });
        const { page } = await pageFor(operation.boss);
        await page.screenshot({ path: path.join(output, `${width}-${scenario.name}-${action}.png`), fullPage: true });
      }
      if (scenario.name === 'informant-public-disclosure') {
        const seal = await f.publicTrail('b', engine);
        const trace = await f.networkPrepare('trace_disclosure', { prefix: 'b', engine, preparedItem: seal });
        await trace.command('organizer', 'execute');
        f.advance(601); await director.tick();
        const board = await engine.snapshot(trace.boss);
        assert.equal((await f.kernel.get(trace.boss, f.ids.object)).state, 'public_trace');
        result.outcomes.push({ action: 'trace_disclosure', state: 'public_trace',
          consequences: board.consequences.map(({ title, description, opportunityIds }) => ({ title, description, opportunityIds })) });
        const { page } = await pageFor(trace.boss);
        await page.screenshot({ path: path.join(output, `${width}-${scenario.name}-trace_disclosure.png`), fullPage: true });
      }
      const worldChecks = await worldKernelInvariants(f.pool); assert.equal(worldChecks.ok, true, JSON.stringify(worldChecks));
      const operationChecks = await familyOperationInvariants(f.pool); assert.equal(operationChecks.ok, true, JSON.stringify(operationChecks));
      result.invariants = { world: worldChecks, operations: operationChecks };
      assert.deepEqual(result.errors, []); result.status = 'PASS';
      console.log(`PASS ${width}px ${scenario.name}: ${result.commands.length} rendered commands`);
    } catch (error) {
      result.status = 'FAIL'; result.error = error.stack; console.error(result.error);
      for (const [index, context] of contexts.entries()) for (const page of context.pages()) {
        await page.screenshot({ path: path.join(output, `${width}-${scenario.name}-failure-${index}.png`), fullPage: true }).catch(() => {});
        fs.writeFileSync(path.join(output, `${width}-${scenario.name}-failure-${index}.txt`), await page.locator('body').innerText().catch(() => 'unavailable'));
      }
    }
    finally { for (const context of contexts) await context.close(); if (app) { await app.close(); await app.pool.end(); } delete process.env.DATABASE_URL; await f.cleanup(); save(); }
  }
} finally { await browser.close(); }
if (report.results.some((result) => result.status !== 'PASS')) process.exitCode = 1;
