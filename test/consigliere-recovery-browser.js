// Optional browser regression against the real mounted Gateway and disposable pg-mem.
// Set CHROMIUM_PATH to an installed Chromium/Chrome executable before running.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';

assert(!process.env.DATABASE_URL, 'Consigliere recovery browser checks require disposable pg-mem.');
assert(process.env.CHROMIUM_PATH, 'Set CHROMIUM_PATH to a Chromium executable.');
process.env.COORDINATION_ENGINE = 'on';
process.env.RATE_LIMIT = 'off';
const app = await buildServer();
let browser;
try {
  const accountId = crypto.randomUUID();
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'recovery-ui',$1)", [accountId]);
  await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [accountId]);
  await app.pool.query('INSERT INTO characters(id,account_id,name,season) VALUES($1,$2,$3,1)', [accountId + '-ch', accountId, 'Recovery Reviewer']);
  const playerToken = app.jwt.sign({ sub: accountId, tv: 0 });
  const post = (url, token, payload) => app.inject({ method: 'POST', url, payload, headers: { authorization: 'Bearer ' + token } });
  const grantResponse = await post('/v1/gateway/connections', playerToken, {
    provider: 'muse', label: 'Recovery UI', scopes: ['omerta.coordination.read', 'omerta.coordination.prepare'],
  });
  assert.equal(grantResponse.statusCode, 200, grantResponse.body);
  const agentToken = grantResponse.json().token;
  const call = (capability, args = {}) => post('/v1/gateway/call', agentToken, { capability, arguments: args, requestId: crypto.randomUUID() });
  const catalog = await call('get_coordination_requests');
  assert.equal(catalog.statusCode, 200, catalog.body);
  const graph = catalog.json().data.graphs.find(entry => entry.id === 'omerta.coordination.dead-letter');
  assert(graph);
  const prepare = async () => {
    const response = await call('prepare_coordination_request', { graphId: graph.id, expectedContentHash: graph.contentHash });
    assert.equal(response.statusCode, 200, response.body);
    return response.json().data.id;
  };
  const committedId = await prepare(), untouchedId = await prepare(), retryableId = await prepare();
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
  const context = await browser.newContext();
  await context.addInitScript(token => localStorage.setItem('omerta_token', token), playerToken);
  const page = await context.newPage();
  const errors = [];
  let confirmRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/confirm')) confirmRequests++; });
  const open = async id => {
    await page.goto(base + '/consigliere?preparation=' + id);
    await page.locator('#approval-section:not([hidden])').waitFor();
  };
  const countCommands = async () => Number((await app.pool.query('SELECT count(*) AS n FROM coordination_commands WHERE account_id=$1', [accountId])).rows[0].n);
  await open(committedId);
  await page.getByRole('button', { name: 'Approve this action', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('approval-result').textContent.startsWith('Action completed.'));
  const commands = await countCommands();
  assert.equal(commands, 1);
  await app.pool.query('UPDATE agent_gateway_preparations SET result_json=$1 WHERE id=$2',
    [JSON.stringify({ status: 429, ok: false }), retryableId]);
  await open(retryableId);
  assert.equal(await page.getByRole('button', { name: 'Retry approved action', exact: true }).isEnabled(), true,
    'Unexpired pending attempt names the possible action retry explicitly.');
  assert.equal(await page.getByRole('button', { name: 'Check action result', exact: true }).count(), 0,
    'A pending action retry is not presented as only a result check.');
  assert.match(await page.locator('#approval-result').textContent(), /Retrying may execute the action you approved/);
  assert.equal(confirmRequests, 1, 'Displaying the retry control does not submit the action.');
  const expired = new Date(Date.now() - 60000).toISOString();
  // Simulate a delayed concurrent refusal overwriting metadata after a durable game commit.
  for (const state of ['pending', 'refused']) {
    await app.pool.query('UPDATE agent_gateway_preparations SET state=$1,result_json=$2,expires_at=$3 WHERE id=$4',
      [state, JSON.stringify({ status: state === 'pending' ? 429 : 409, ok: false }), expired, committedId]);
    await open(committedId);
    const check = page.getByRole('button', { name: 'Check action result', exact: true });
    assert.equal(await check.isEnabled(), true, `${state} expired attempted proposal retains recovery control`);
    assert.doesNotMatch(await page.locator('#approval-result').textContent(), /did not run|request a new proposal/);
    const response = page.waitForResponse(result => result.request().method() === 'POST' && result.url().endsWith('/confirm'));
    await check.click();
    assert.equal((await response).status(), 200);
    await page.waitForFunction(() => document.getElementById('approval-result').textContent.startsWith('Action completed.'));
    assert.equal(await countCommands(), commands, 'Recovery creates no additional authoritative command.');
    assert.equal(await page.locator('#approve').isVisible(), false, 'Completed proposal needs no further approval.');
  }
  await app.pool.query('UPDATE agent_gateway_preparations SET expires_at=$1 WHERE id=$2', [expired, untouchedId]);
  await open(untouchedId);
  assert.equal(await page.getByRole('button', { name: 'Approve this action', exact: true }).isDisabled(), true,
    'Untouched expired proposal cannot initiate an action from the UI.');
  assert.equal(confirmRequests, 3);
  // An attempted terminal proposal with no committed receipt remains checkable, but cannot execute.
  await app.pool.query("UPDATE agent_gateway_preparations SET state='refused',result_json=$1 WHERE id=$2",
    [JSON.stringify({ status: 409, ok: false }), untouchedId]);
  await open(untouchedId);
  const refusalResponse = page.waitForResponse(result => result.request().method() === 'POST' && result.url().endsWith('/confirm'));
  await page.getByRole('button', { name: 'Check action result', exact: true }).click();
  assert.equal((await refusalResponse).status(), 409);
  assert.equal(await countCommands(), commands, 'Checking an expired refusal without a receipt cannot dispatch.');
  assert.deepEqual(errors, []);
  console.log('consigliere-recovery-browser: explicit pending retry label, expired pending/refused recovery, neutral outcome copy, untouched expiry, and no-receipt refusal pass');
} finally {
  if (browser) await browser.close();
  await app.close();
}
