// RC1-05 fixture-assisted B/C/D/E segments. Native PostgreSQL and ordinary
// rendered controls; no post-baseline SQL/domain writes except scheduled ticks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createDockWarDefinitions } from '../src/director/dock-war.js';
import { DOCK_WAR_IDS as ids } from '../src/content/dock-war.js';
import { browserControls } from './lib/rc1-browser-controls.js';
import { canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';
import { worldKernelInvariants } from '../src/world-kernel-invariants.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit isolated loopback PostgreSQL required');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env.COORDINATION_TEST_DATABASE_URL).hostname));
if (!process.argv.includes('--postgres')) process.argv.push('--postgres');
// Import after selecting PostgreSQL; the shared support module captures its mode.
const { dockFixture } = await import('./lib/director-support.js');
const { issueAndExecute } = await import('./lib/player-command-support.js');
for (const flag of ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS']) process.env[flag] = 'on';
Object.assign(process.env, { LIVING_WORLD_DIRECTOR: 'LIVE', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off' });
for (const key of ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY']) process.env[key] = crypto.randomBytes(32).toString('hex');
delete process.env.COORDINATION_ACCOUNT_IDS; delete process.env.DIRECTOR_ACCOUNT_IDS;
const directory = path.resolve(process.env.RC1_GOLDEN_BROWSER_OUTPUT || 'output/rc1-golden-browser');
fs.mkdirSync(directory, { recursive: true });
assert(!fs.existsSync(path.join(directory, 'results.json')), 'Use a new evidence directory for every run');
const binary = [process.env.CHROMIUM_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
  .find((file) => file && fs.existsSync(file));
const browser = await chromium.launch({ ...(binary ? { executablePath: binary } : {}), headless: true });
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  harnessSha256: crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),
  helperSha256: crypto.createHash('sha256').update(fs.readFileSync(new URL('./lib/rc1-browser-controls.js', import.meta.url))).digest('hex'),
  startedAt: new Date().toISOString(), node: process.version, browser: browser.version(), results: [],
  requestedWidth: process.env.RC1_GOLDEN_BROWSER_WIDTH ? Number(process.env.RC1_GOLDEN_BROWSER_WIDTH) : null,
  scope: 'Automated Chromium phone viewport segments of returning/social/investigation/Family-conflict journeys, from declared canonical fixtures.',
  fixtures: 'Five actors start at cash100000/respect10000; two initial Families/Crews formed through domain APIs. Canonical initial dock route and acquired/salvaged materials use existing services; setup garage success is pinned. Rival route knowledge/seal are prepared before baseline. Recruit remains outside all social groups and without discovery/equipment until browser play. JWT login selects only these fixtures.',
  exclusions: ['A fresh-player entry', 'natural low-resource entry', 'human comprehension or complete A-E acceptance', 'physical iOS/Android keyboards and wallets',
    'all operation loss/expiry branches', 'all responsive screens and list sizes', '750ms adversity and lost responses (separate harnesses)', 'production deployment',
    'real-time worker schedule: Director uses a declared601second clock advance for aftermath selection'] };
const save = () => fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(report, null, 2)); save();
const viewports = [{ width: 320, height: 568 }, { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }];
try {
  for (const viewport of viewports) {
    if (process.env.RC1_GOLDEN_BROWSER_WIDTH && viewport.width !== Number(process.env.RC1_GOLDEN_BROWSER_WIDTH)) continue;
    const f = await dockFixture(`golden_${viewport.width}_${crypto.randomBytes(3).toString('hex')}`);
    let app; const sessions = new Map(), contexts = [];
    const result = { viewport, status: 'RUNNING', commands: [], interactions: [], controls: [], recoveries: [], milestones: [], errors: [] };
    report.results.push(result); save();
    try {
      await f.establish();
      await f.acquireMaterials(f.actors.outsider); await f.move(f.actors.outsider, 'docks');
      for (const actor of [f.actors.bBoss, f.actors.bRunner]) await f.learn(actor);
      await f.acquireMaterials(f.actors.bRunner); await f.craft(f.actors.bRunner); await f.move(f.actors.bRunner, 'docks');
      let at = Date.now();
      const director = createLivingWorldDirector({ pool: f.pool, content: f.content, definitions: createDockWarDefinitions(f.content), mode: 'LIVE', clock: () => at });
      await director.tick();
      const schema = (await f.pool.query('SELECT current_schema() AS name')).rows[0].name;
      assert(/^command_golden_[a-z0-9_]+$/.test(schema), 'A private native PostgreSQL fixture schema is required');
      const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL); endpoint.searchParams.set('options', `-c search_path=${schema}`);
      process.env.DATABASE_URL = endpoint.toString();
      app = await buildServer(); const origin = await app.listen({ port: 0, host: '127.0.0.1' });
      result.postgres = (await app.pool.query('SELECT version() AS version')).rows[0].version;
      const baseline = await canonicalDatabaseSnapshot(app.pool);
      result.baselineStateSha256 = baseline.stateSha256;
      fs.writeFileSync(path.join(directory, `${viewport.width}-baseline.json`), JSON.stringify(baseline)); save();
      const pageFor = async (account) => {
        if (sessions.has(account)) return sessions.get(account);
        const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, locale: 'en-US' }); contexts.push(context);
        const page = await context.newPage(); page.on('pageerror', (error) => result.errors.push(error.message));
        await page.addInitScript((token) => localStorage.setItem('omerta_token', token), app.jwt.sign({ sub: account, tv: 0 }));
        await page.addLocatorHandler(page.locator('[data-tipok]'), async () => page.locator('[data-tipok]').click());
        await page.addLocatorHandler(page.locator('#welcome:not(.hidden)'), async () => page.locator('#tour-skip').click());
        await page.goto(origin, { waitUntil: 'networkidle' }); await page.locator('#screen-main:not(.hidden)').waitFor();
        const session = { context, page, board: null }; sessions.set(account, session); return session;
      };
      const { engine, openTab, clickMutation, reach } = browserControls({ pageFor, width: viewport.width, result, save });
      const act = (account, type, parameters = {}, options = {}) => issueAndExecute(engine, account, type, parameters, options);
      const capture = async (account, milestone) => {
        const { page } = await pageFor(account);
        await page.screenshot({ path: path.join(directory, `${viewport.width}-${milestone}.png`), fullPage: true });
        fs.writeFileSync(path.join(directory, `${viewport.width}-${milestone}.txt`), await page.locator('body').innerText());
        result.milestones.push(milestone); save();
      };
      const learner = f.actors.outsider, boss = f.actors.aBoss;
      await openTab(boss, 'crew'); await clickMutation(boss, '#crew-recruit', '/v1/crew/recruiting', (body) => assert.equal(body.crew, 'recruiting'));
      await openTab(learner, 'discover');
      await clickMutation(learner, `[data-ask="${f.crews.a.id}"]`, `/v1/crew/request/${f.crews.a.id}`, (body) => assert.equal(body.crew, 'requested'));
      await capture(learner, 'social-request-sent');
      await openTab(boss, 'crew');
      await clickMutation(boss, `[data-do="POST /v1/crew/request/${learner}-character/accept"]`, `/v1/crew/request/${learner}-character/accept`);
      await openTab(learner, 'family'); await clickMutation(learner, `[data-join="${f.families.a.gangId}"]`, `/v1/gangs/${f.families.a.gangId}/join`);
      const crewPage = await openTab(learner, 'crew'); assert((await crewPage.locator('#tab-crew').innerText()).includes('Dock a Crew'));
      // Focus/viewport reduction exercises CSS and focus retention, not a native keyboard.
      const input = crewPage.locator('#crew-say'); await input.fill('Preparing the dock route');
      await crewPage.setViewportSize({ width: viewport.width, height: 420 }); await input.focus();
      assert(await input.evaluate((element) => document.activeElement === element));
      await reach(crewPage, crewPage.locator('#crew-send'), 'crew input adjacent action with reduced viewport');
      await input.fill(''); await input.press('Tab'); await crewPage.setViewportSize(viewport);
      result.keyboardCheck = 'Emulated reduced420px viewport and focus retention; no message sent, no native-keyboard claim';
      await capture(learner, 'social-approved');
      async function learn(account) {
        let board = await engine.snapshot(account);
        if (!board.discovery.instances.some((run) => run.graphId === ids.coordination && !run.historical)) await act(account, 'discovery.start', { graphId: ids.coordination });
        for (let step = 0; step < 20; step++) {
          board = await engine.snapshot(account); const run = board.discovery.instances.find((entry) => entry.graphId === ids.coordination && !entry.historical); assert(run);
          const next = run.actions.find((entry) => entry.kind === 'complete') || run.actions.find((entry) => entry.kind === 'discover');
          if (!next) return board;
          await act(account, 'discovery.act', { instanceId: run.id, actionId: next.id });
        }
        throw Error('Investigation exceeded authored bound');
      }
      const mystery = (account, kind) => act(account, `mystery.${kind}`, { graphId: ids.evidence }, { mysteryGraphId: ids.evidence });
      const travel = async (account, district) => {
        const { page } = await pageFor(account); await page.locator('#go-travel').click();
        await clickMutation(account, `[data-go-district="${district}"]`, `/v1/travel/${district}`);
      };
      await learn(learner); await mystery(learner, 'start'); await mystery(learner, 'complete'); await learn(learner);
      let board = await engine.snapshot(learner);
      assert(board.knowledge.claims.some((claim) => claim.proposition === 'canal.crossing'));
      assert(!board.knowledge.claims.some((claim) => claim.proposition === 'route.alternate'), 'Partial evidence must remain incomplete');
      await capture(learner, 'investigation-incomplete');
      await travel(learner, 'foundry');
      const crafted = await act(learner, 'recipe.craft', { recipeId: ids.recipe });
      assert(crafted.response.feedback.inventoryChanges.some((item) => item.templateId === ids.key));
      await mystery(learner, 'discover'); await mystery(learner, 'complete'); await learn(learner);
      board = await engine.snapshot(learner);
      assert(!board.knowledge.claims.some((claim) => claim.proposition === 'route.alternate'), 'One actor alone cannot manufacture independent evidence');
      await mystery(boss, 'start'); await mystery(boss, 'complete'); await learn(boss);
      const bossBoard = await engine.snapshot(boss), claim = bossBoard.knowledge.claims.find((entry) => entry.owned && entry.proposition === 'canal.crossing'); assert(claim);
      await act(boss, 'knowledge.share', { claimId: claim.id, kind: 'crew' });
      await learn(learner); board = await engine.snapshot(learner);
      assert(board.knowledge.claims.some((entry) => entry.proposition === 'route.alternate'), 'Independent shared evidence opens the combined conclusion');
      await capture(learner, 'investigation-combined'); await travel(learner, 'docks');
      async function prepare(definitionId, organizer, runner) {
        const definition = f.content.operations.find((entry) => entry.id === definitionId); assert(definition);
        const created = await act(organizer, 'operation.create', { definitionId }), operationId = created.response.result.operationId; assert(operationId);
        const op = (account, type, params = {}) => act(account, `operation.${type}`, { operationId, ...params }, { operationId });
        await op(organizer, 'publish'); await op(organizer, 'join', { roleId: 'organizer' }); await op(runner, 'join', { roleId: 'runner' });
        const incomplete = await engine.snapshot(runner, { operationId }); assert.equal(incomplete.operations.selected.readiness.ready, false);
        for (const role of definition.roles) for (const required of role.requirements) {
          const actor = role.id === 'organizer' ? organizer : runner;
          await op(actor, 'commit', { requirementId: required.id }); await op(actor, 'contribute', { requirementId: required.id });
        }
        await op(organizer, 'approve');
        const ready = await engine.snapshot(runner, { operationId }); assert.equal(ready.operations.selected.readiness.ready, true);
        assert(ready.operations.selected.history.filter((event) => event.kind === 'contribute').length >= 4);
        await capture(runner, `${organizer === boss ? 'social' : 'rival'}-shared-threshold`);
        return { operationId, op };
      }
      const protection = await prepare(ids.protectOperation, boss, learner);
      const interception = await prepare(ids.interceptOperation, f.actors.bBoss, f.actors.bRunner);
      const authorized = await engine.snapshot(learner, { operationId: protection.operationId });
      assert(!JSON.stringify(authorized).includes(interception.operationId), 'A Family cannot enumerate its rival private operation');
      result.returningBefore = { state: authorized.worldObjects.find((object) => object.id === ids.object)?.state, consequences: authorized.consequences.map((event) => event.id) };
      await (await pageFor(learner)).context.close(); sessions.delete(learner);
      await protection.op(boss, 'execute');
      at += 601000; await director.tick();
      const returned = await engine.snapshot(learner, { operationId: protection.operationId });
      assert.equal(returned.worldObjects.find((object) => object.id === ids.object)?.state, 'protected');
      assert.equal(returned.operations.selected.status, 'completed');
      const changed = returned.consequences.filter((event) => !result.returningBefore.consequences.includes(event.id)); assert(changed.length);
      const returnPage = (await pageFor(learner)).page, returnText = await returnPage.locator('#tab-world').innerText();
      for (const question of ['What changed?', 'What needs my attention?', 'What can I do?']) assert(returnText.includes(question));
      assert(changed.some((event) => returnText.includes(event.title)), 'Returning actor sees actual intervening authorized consequence');
      assert(returned.commands.some((command) => command.availability === 'AVAILABLE'));
      result.returningAfter = { state: 'protected', changes: changed.map(({ title, description }) => ({ title, description })), nextActionCount: returned.commands.filter((command) => command.availability === 'AVAILABLE').length };
      await capture(learner, 'returning-after-shared-outcome');
      const losing = await engine.snapshot(f.actors.bBoss, { operationId: interception.operationId });
      assert(!losing.commands.some((command) => command.commandType === 'operation.execute' && command.parameters.operationId === interception.operationId && command.availability === 'AVAILABLE'));
      await interception.op(f.actors.bBoss, 'cancel');
      const terminal = await engine.snapshot(f.actors.bBoss, { operationId: interception.operationId }); assert.equal(terminal.operations.selected.status, 'canceled');
      await capture(f.actors.bBoss, 'conflict-terminal-cancellation');
      result.invariants = { world: await worldKernelInvariants(f.pool), operations: await familyOperationInvariants(f.pool) };
      assert(result.invariants.world.ok && result.invariants.operations.ok, JSON.stringify(result.invariants));
      assert.deepEqual(result.errors, []); result.status = 'PASS';
      console.log(`PASS ${viewport.width}px golden segments: ${result.commands.length} rendered commands, ${result.interactions.length} social/travel interactions`);
    } catch (error) {
      result.status = 'FAIL'; result.error = error.stack; console.error(result.error);
      for (const [account, session] of sessions) if (!session.page.isClosed()) {
        await session.page.screenshot({ path: path.join(directory, `${viewport.width}-${account}-failure.png`), fullPage: true }).catch(() => {});
        fs.writeFileSync(path.join(directory, `${viewport.width}-${account}-failure.txt`), await session.page.locator('body').innerText().catch(() => 'unavailable'));
      }
    } finally {
      for (const context of contexts) await context.close(); if (app) { await app.close(); await app.pool.end(); }
      delete process.env.DATABASE_URL; await f.cleanup(); save();
    }
  }
} finally { await browser.close(); report.endedAt = new Date().toISOString(); save(); }
assert(report.results.length > 0 && report.results.every((result) => result.status === 'PASS'), 'All selected native phone golden journey segments must pass');
console.log(JSON.stringify({ status: 'PASS_SCOPED', source: report.source, dirty: report.dirty,
  widths: report.results.map((result) => result.viewport.width), commands: report.results.reduce((sum, result) => sum + result.commands.length, 0),
  scope: report.scope, coverageExclusions: report.exclusions, output: directory }));
