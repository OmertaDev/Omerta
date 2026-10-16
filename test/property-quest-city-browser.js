// The actual city projection and NPC controls must follow a property case across districts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';

assert(!process.env.DATABASE_URL, 'Property NPC browser proof requires disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off'; process.env.POPULATION_OFF = 'on';
const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
  .find(file => file && fs.existsSync(file));
assert(executablePath, 'Use an installed Chromium/Chrome executable.');
const app = await buildServer(), errors = [], writes = [];
let browser;
const graph = 'property-investigation', root = '/v1/worldgraph/mysteries/' + graph;
try {
  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
  const token = guest.json().token, headers = { authorization: 'Bearer ' + token };
  const post = async (url, payload = {}) => {
    const reply = await app.inject({ method: 'POST', url, payload,
      headers: { ...headers, 'idempotency-key': crypto.randomUUID() } });
    assert.equal(reply.statusCode, 200, reply.body); return reply.json();
  };
  await post('/v1/character', { name: 'Property NPC Proof' });
  const account = app.jwt.verify(token).sub;
  await app.pool.query("UPDATE characters SET respect=10000,cash=5000,energy=100,loc='docks' WHERE account_id=$1 AND alive", [account]);
  await post(root + '/start');
  await post(root + '/nodes/mystery%3Aproperty-briefing/complete', { interactionId: 'property_briefing' });
  await post(root + '/nodes/mystery%3Aproperty-ledger/complete', { interactionId: 'property_inspect_ledger' });
  await post(root + '/choices/choice%3Aproperty-approach', { optionId: 'witness', interactionId: 'property_choose_approach' });
  // An unrelated district case remains district-bound, even when already active.
  await post('/v1/worldgraph/mysteries/district-docks-story/start');
  await post('/v1/travel/neon');
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await context.addInitScript(token => {
    if (!localStorage.getItem('omerta_token')) localStorage.setItem('omerta_token', token);
    localStorage.setItem('omerta_tour2', '1');
  }, token);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST') writes.push(new URL(request.url()).pathname);
  });
  await page.route(base + '/', async route => {
    const response = await route.fetch(), html = await response.text();
    const anchor = '  async function cityQuestProjection(stamp = projections.snapshot()) {';
    assert.equal(html.split(anchor).length, 2);
    await route.fulfill({ response, body: html.replace(anchor,
      '  window.__propertyNpcProof = () => ({ pending: _cityQuestPending, district: me?.loc, '
      + 'actions: [..._cityNpcActions.values()].map(action => ({ id: action.id, path: action.path, available: action.available })) });\n' + anchor) });
  });
  const enterDistrict = async district => {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('#screen-main:not(.hidden)').waitFor();
    await page.locator('#btn-player-view').click();
    await page.locator('[data-destination="fixer"]').waitFor();
    await page.waitForFunction(district => window.__propertyNpcProof().district === district
      && document.querySelector('#city-scene-host .omerta-city'), district);
  };
  const projected = () => page.evaluate(() => window.__propertyNpcProof());
  const actionId = node => graph + ':complete:mystery:property-' + node;
  const perform = async (venue, node) => {
    await page.locator('[data-destination="' + venue + '"]').click();
    const button = page.locator('[data-city-quest-action="' + actionId(node) + '"]');
    await button.waitFor(); assert(await button.isEnabled());
    const path = root + '/nodes/' + encodeURIComponent('mystery:property-' + node) + '/complete';
    const reply = page.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname === path);
    await button.click(); assert.equal((await reply).status(), 200);
    await page.waitForFunction(() => !window.__propertyNpcProof().pending && !document.querySelector('#busy.on'));
  };
  await enterDistrict('neon');
  let state = await projected();
  assert(state.actions.some(action => action.id === actionId('witness') && action.available),
    'The active property case must expose its server-issued witness lead at the Neon NPC.');
  assert(!state.actions.some(action => /property-(records|survey|boundary|reconcile|verify-title)/.test(action.path)),
    'Excluded branches, future leads and other-district steps are not projected in Neon.');
  assert(!state.actions.some(action => action.path.includes('/district-docks-story/')),
    'Other active quest graphs retain their district constraint.');
  await perform('fixer', 'witness');
  await perform('fixer', 'address');
  state = await projected();
  assert(!state.actions.some(action => action.id === actionId('survey')),
    'A newly discovered Foundry step stays absent from the Neon NPC.');
  await post('/v1/travel/foundry');
  await enterDistrict('foundry');
  state = await projected();
  assert(state.actions.some(action => action.id === actionId('survey') && action.available),
    'The same active case exposes its survey lead at the Foundry NPC.');
  assert(!state.actions.some(action => /property-(witness|records|address|boundary|reconcile|verify-title)/.test(action.path)),
    'Neon steps and future title steps stay absent from the Foundry NPC.');
  await perform('workshop', 'survey');
  state = await projected();
  assert(state.actions.some(action => action.id === actionId('boundary') && action.available),
    'The next local objective appears only after survey evidence is recorded.');
  assert(!writes.some(path => path === '/v1/deeds/claim'), 'NPC discovery never auto-claims a property.');
  const fresh = (await app.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token;
  const freshHeaders = { authorization: 'Bearer ' + fresh };
  assert.equal((await app.inject({ method: 'POST', url: '/v1/character', headers: freshHeaders,
    payload: { name: 'Property Start Proof' } })).statusCode, 200);
  await app.pool.query("UPDATE characters SET respect=10000,cash=5000,loc='neon' WHERE account_id=$1 AND alive", [app.jwt.verify(fresh).sub]);
  await page.evaluate(token => localStorage.setItem('omerta_token', token), fresh);
  await enterDistrict('neon');
  assert(!(await projected()).actions.some(action => action.path.startsWith(root + '/')),
    'An unstarted property case is not offered outside its Docks starting district.');
  assert.equal((await app.inject({ method: 'POST', url: '/v1/travel/docks', headers: freshHeaders, payload: {} })).statusCode, 200);
  await enterDistrict('docks');
  assert((await projected()).actions.some(action => action.path === root + '/start' && action.available),
    'The unstarted property case remains available at its intended Docks NPC.');
  assert.deepEqual(errors, []);
  console.log('Property quest NPC browser: Neon witness/address → Foundry survey/boundary; future/excluded/elsewhere nodes and unrelated district quests stay hidden.');
} finally {
  if (browser) await browser.close();
  await app.close();
}
