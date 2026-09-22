// Retained PG16 sequence: visible refresh before submission, then bucket expiry.
// Real canonical browser controls and native PostgreSQL; only server clock and
// test-driver boundaries are controlled. No command or receipt is fabricated.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';
import { browserControls } from './lib/rc1-browser-controls.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit isolated PostgreSQL required');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env.COORDINATION_TEST_DATABASE_URL).hostname));
if (!process.argv.includes('--postgres')) process.argv.push('--postgres');
const { dockFixture, ids, key } = await import('./lib/director-support.js');
const { issueAndExecute } = await import('./lib/player-command-support.js');
for (const flag of ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS']) process.env[flag] = 'on';
Object.assign(process.env, { LIVING_WORLD_DIRECTOR: 'LIVE', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off' });
for (const name of ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY']) process.env[name] = crypto.randomBytes(32).toString('hex');
delete process.env.COORDINATION_ACCOUNT_IDS; delete process.env.DIRECTOR_ACCOUNT_IDS;
const directory = path.resolve(process.env.RC1_PHONE_EXPIRY_OUTPUT || 'output/rc1-phone-expiry');
fs.mkdirSync(directory, { recursive: true });
assert(!fs.existsSync(path.join(directory, 'results.json')), 'Use a fresh evidence directory');
const result = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  status: 'RUNNING', controls: [], recoveries: [], commands: [], errors: [], attempts: [] };
const save = () => fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(result, null, 2));
const originalNow = Date.now;
let app, browser, f;
save();
try {
  f = await dockFixture(`phone_expiry_${crypto.randomBytes(4).toString('hex')}`);
  await f.establish();
  const created = await f.family.create(f.actors.aBoss, { definitionId: ids.protectOperation }, key());
  const operationId = created.operationId;
  const schema = (await f.pool.query('SELECT current_schema() AS name')).rows[0].name;
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL); endpoint.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = endpoint.toString();
  app = await buildServer(); const origin = await app.listen({ port: 0, host: '127.0.0.1' });
  result.postgres = (await app.pool.query('SELECT version() AS version')).rows[0].version;
  const binary = [process.env.CHROMIUM_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
  browser = await chromium.launch({ ...(binary ? { executablePath: binary } : {}), headless: true });
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); page.on('pageerror', error => result.errors.push(error.message));
  await page.addInitScript(token => localStorage.setItem('omerta_token', token), app.jwt.sign({ sub: f.actors.aBoss, tv: 0 }));
  await page.addLocatorHandler(page.locator('[data-tipok]'), () => page.locator('[data-tipok]').click());
  await page.addLocatorHandler(page.locator('#welcome:not(.hidden)'), () => page.locator('#tour-skip').click());
  await page.goto(origin, { waitUntil: 'networkidle' }); await page.locator('#screen-main:not(.hidden)').waitFor();
  const session = { page, board: null }, { engine } = browserControls({ pageFor: async () => session, width: 430, result, save });
  const boundary = (Math.floor(originalNow() / 600000) + 1) * 600000;
  let now = boundary - 1000, attempts = 0;
  Date.now = () => now;
  const nativeExecute = engine.execute;
  engine.execute = async (account, input, identity) => {
    attempts++;
    const command = session.board.commands.find(entry => entry.executionIdentity?.executionId === identity);
    assert.equal(command.commandType, 'operation.publish');
    if (attempts === 1) {
      const refreshed = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/v1/commands');
      await page.locator('#world-refresh').click(); await refreshed; await page.waitForLoadState('networkidle');
    } else if (attempts === 2) {
      assert.equal(new Date(command.expiresAt).getTime(), boundary);
      now = boundary + 1;
    }
    try {
      const response = await nativeExecute(account, input, identity);
      result.attempts.push({ attempt: attempts, outcome: 'COMPLETED', replayed: response.replayed }); save(); return response;
    } catch (error) {
      result.attempts.push({ attempt: attempts, outcome: error.body?.error, observedBrowserRefresh: !!error.observedBrowserRefresh }); save();
      if (attempts === 2) {
        assert.equal(error.statusCode, 409); assert.equal(error.body.error, 'command_unavailable');
        assert.equal((await f.pool.query('SELECT status FROM world_operations WHERE id=$1', [operationId])).rows[0].status, 'draft', 'Expired publish has no effect');
      }
      throw error;
    }
  };
  const published = await issueAndExecute(engine, f.actors.aBoss, 'operation.publish', { operationId }, { operationId });
  assert.equal(attempts, 3); assert.deepEqual(result.attempts.map(entry => entry.outcome), ['browser_board_refresh', 'command_unavailable', 'COMPLETED']);
  assert.equal((await f.pool.query('SELECT status FROM world_operations WHERE id=$1', [operationId])).rows[0].status, 'recruiting');
  const history = async () => (await f.pool.query('SELECT * FROM world_operation_events WHERE operation_id=$1 ORDER BY revision,ordinal', [operationId])).rows;
  const historyBefore = await history();
  const replay = await app.inject({ method: 'POST', url: '/v1/commands/execute', headers: { authorization: `Bearer ${app.jwt.sign({ sub: f.actors.aBoss, tv: 0 })}`, 'idempotency-key': published.command.executionIdentity.executionId }, payload: { executionId: published.command.executionIdentity.executionId, confirmed: published.command.confirmation.required } });
  assert.equal(replay.statusCode, 200); assert.equal(replay.json().replayed, true);
  assert.deepEqual(await history(), historyBefore, 'Duplicate identity has no second effect');
  assert.deepEqual(result.errors, []); result.status = 'PASS_SCOPED';
  console.log(JSON.stringify({ status: result.status, source: result.source, postgres: result.postgres, attempts: result.attempts, checks: ['zero-submission-refresh', 'expired-publish-no-effect', 'visible-reissue', 'duplicate-receipt-no-second-effect', 'no-browser-errors'] }));
} catch (error) { result.status = 'FAIL'; result.error = error.stack; throw error; }
finally {
  Date.now = originalNow; save();
  if (browser) await browser.close();
  if (app) { await app.close(); await app.pool.end(); }
  delete process.env.DATABASE_URL;
  if (f) await f.cleanup();
}
