// Real pg-mem browser checks for server-issued crafting, journal and Crew actions.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from '../src/server.js';
import { createItem, withItemTransaction } from '../src/items.js';
import { NEIGHBORHOOD_QUEST_GRAPH_ID } from '../src/content/neighborhood-initiation.js';
import { PHASE1_WORLD_GRAPH } from '../src/routes/worldgraph.js';
import { mysteryUi } from '../src/worldgraph-ui.js';

// A GUI projection must preserve the newer engine's authentic affordances and closed branches.
const choiceDefinition = PHASE1_WORLD_GRAPH.nodes.get('choice:neighborhood-approach');
const authenticAffordance = { kind: 'choice', nodeId: choiceDefinition.id, optionId: 'ask', interactionId: 'choose_neighborhood_approach' };
const projectedChoice = mysteryUi({ graph: { id: NEIGHBORHOOD_QUEST_GRAPH_ID }, status: 'active', instanceId: 'projection-only',
  nodes: [{ id: choiceDefinition.id, type: 'choice', status: 'available', blockedBy: [], options: choiceDefinition.options }],
  actions: [authenticAffordance] }, PHASE1_WORLD_GRAPH);
assert.deepEqual(projectedChoice.actions, [authenticAffordance], 'Existing core-progression action shape remains unchanged.');
assert.equal(projectedChoice.nodes[0].uiActions.find(action => action.body.optionId === 'listen').available, false,
  'A branch excluded by the authoritative affordance is disabled in the GUI.');
assert.equal(projectedChoice.nodes[0].uiActions.find(action => action.body.optionId === 'ask').available, true);

assert(!process.env.DATABASE_URL, 'Fieldwork browser tests require disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';
const executablePath = process.env.CHROMIUM_PATH || [
  chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(candidate => fs.existsSync(candidate));
assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser.');
const app = await buildServer();
let browser;
try {
  const players = [];
  app.get('/fieldwork-browser-fixture.js', (_req, reply) => reply.type('application/javascript').send(fs.readFileSync(new URL('../public/world-fieldwork.js', import.meta.url), 'utf8')));
  app.get('/fieldwork-browser-fixture.css', (_req, reply) => reply.type('text/css').send(fs.readFileSync(new URL('../public/world-fieldwork.css', import.meta.url), 'utf8')));
  app.get('/fieldwork-browser-fixture', (_req, reply) => reply.type('text/html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fieldwork-browser-fixture.css"><style>body{margin:0;padding:16px;background:#282a25}#fieldwork{max-width:1100px;margin:auto}</style></head><body><main id="fieldwork"></main><script src="/fieldwork-browser-fixture.js"></script><script>
    const token=${JSON.stringify(players[0].token)};
    window.__fieldworkCalls=[]; window.__fieldworkReads=[]; window.__failNextResponse=false; window.__navigate=[];
    let queue=Promise.resolve();
    function api(method,url,body,requestOptions={}) {
      const task=queue.then(async()=>{
        const response=await fetch(url,{method,headers:{authorization:'Bearer '+token,...(body!==undefined?{'content-type':'application/json'}:{}),...(method==='POST'?{'idempotency-key':requestOptions.idempotencyKey||crypto.randomUUID()}: {})},body:body===undefined?undefined:JSON.stringify(body)});
        const result={code:response.status,body:await response.json()};
        if(method==='GET')window.__fieldworkReads.push(url);
        if(method==='POST')window.__fieldworkCalls.push({url,body,key:requestOptions.idempotencyKey,result});
        return result;
      }); queue=task.catch(()=>{}); return task;
    }
    async function act(method,url,body,requestOptions) {
      const result=await api(method,url,body,requestOptions);
      if(window.__failNextResponse){window.__failNextResponse=false;return{code:503,body:{error:'offline',message:'The response was interrupted. Its outcome is uncertain.'}};}
      return result;
    }
    window.__fieldwork=OmertaFieldwork.mount(document.getElementById('fieldwork'),{api,act,refresh:()=>api('GET','/v1/me'),character:{id:${JSON.stringify(players[0].characterId)}},onNavigate:tab=>window.__navigate.push(tab),isActive:()=>true});
  </script></body></html>`));
  const call = async (method, url, player, payload, key) => {
    const response = await app.inject({ method, url, payload, headers: {
      ...(player ? { authorization: 'Bearer ' + player.token } : {}),
      ...(key ? { 'idempotency-key': key } : {}),
    } });
    assert.equal(response.statusCode, 200, method + ' ' + url + ': ' + response.body);
    return response.json();
  };
  for (let index = 0; index < 4; index++) {
    const guest = await call('POST', '/v1/auth/guest', null, { birthDate: '1990-01-01' });
    const player = { token: guest.token, accountId: app.jwt.verify(guest.token).sub };
    await call('POST', '/v1/character', player, { name: 'Field Tester ' + index });
    player.characterId = (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [player.accountId])).rows[0].id;
    await app.pool.query("UPDATE characters SET loc='foundry',respect=10000,cash=10000 WHERE id=$1", [player.characterId]);
    await app.pool.query("INSERT INTO character_skills (character_id,skill_id) VALUES($1,'fence_network')", [player.characterId]);
    players.push(player);
  }
  const crewId = crypto.randomUUID();
  await app.pool.query('INSERT INTO crews(id,name,leader_account) VALUES($1,$2,$3)', [crewId, 'Field Test Crew', players[0].accountId]);
  for (const [index, player] of players.entries()) await app.pool.query('INSERT INTO crew_members(crew_id,account_id,name) VALUES($1,$2,$3)', [crewId, player.accountId, 'Field Crew ' + index]);
  const carId = crypto.randomUUID();
  await app.pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg,listed,pledged,minted_onchain) VALUES($1,$2,'junker','stock',80,false,false,false)", [carId, players[0].characterId]);

  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const settled = target => target.locator('[data-fieldwork-refresh]:not([disabled])').waitFor();
  const idle = () => settled(page);
  const confirm = async () => { await page.locator('[data-fieldwork-confirm]').click(); await idle(); };
  const activate = async selector => { await page.locator(selector).click(); if (await page.locator('[data-fieldwork-confirm]').count()) await confirm(); else await idle(); };
  const refresh = async () => { await page.locator('[data-fieldwork-refresh]').click(); await idle(); };

  // A failed Crafting read must leave the independent Journal and Crew reads available.
  const panePage = await context.newPage();
  panePage.on('pageerror', error => errors.push(error.message));
  const recipesPath = '**/v1/worldgraph/recipes';
  const unavailable = route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Crafting temporarily unavailable.' }) });
  await panePage.route(recipesPath, unavailable);
  await panePage.goto(base + '/fieldwork-browser-fixture'); await settled(panePage);
  await panePage.locator('[data-fieldwork-view="mysteries"]').click();
  assert.equal(await panePage.locator('[data-fieldwork-case="' + NEIGHBORHOOD_QUEST_GRAPH_ID + '"]').count(), 1, 'Crafting failure does not hide the real starter quest.');
  const readsAfterFailure = await panePage.evaluate(() => window.__fieldworkReads);
  assert(readsAfterFailure.includes('/v1/worldgraph/mysteries') && readsAfterFailure.includes('/v1/worldgraph/operations'), 'Later independent panes still load after a failed read.');
  await panePage.locator('[data-fieldwork-view="recipes"]').click();
  assert.match(await panePage.locator('.fieldwork-pane-error').textContent(), /Crafting could not load/);
  assert(!(await panePage.locator('.fieldwork-body').textContent()).includes('No recipes are currently issued'), 'A failed read is never presented as successful empty data.');
  assert.deepEqual(await panePage.evaluate(() => window.__fieldworkCalls), [], 'Browsing and retries never dispatch game mutations.');
  await panePage.setViewportSize({ width: 375, height: 812 });
  assert(await panePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Scoped error and retry controls fit a phone width.');
  await panePage.unroute(recipesPath, unavailable);
  const beforePaneRetry = await panePage.evaluate(() => window.__fieldworkReads.length);
  await panePage.getByRole('button', { name: 'Retry Crafting', exact: true }).focus();
  await panePage.keyboard.press('Enter'); await settled(panePage);
  assert.deepEqual(await panePage.evaluate(index => window.__fieldworkReads.slice(index), beforePaneRetry), ['/v1/worldgraph/recipes'], 'Pane retry fetches only its own board.');
  assert.equal(await panePage.getByRole('button', { name: 'Salvage junker', exact: true }).isEnabled(), true, 'Successful retry restores current issued actions.');
  assert.equal(await panePage.evaluate(() => document.activeElement.dataset.fieldworkView), 'recipes', 'Keyboard retry returns focus to the current pane when its retry control disappears.');
  await panePage.route(recipesPath, unavailable);
  await panePage.locator('[data-fieldwork-refresh]').click(); await settled(panePage);
  assert.match(await panePage.locator('.fieldwork-pane-error').textContent(), /last loaded record/);
  assert.equal(await panePage.getByRole('button', { name: 'Salvage junker', exact: true }).isDisabled(), true, 'Cached Crafting data remains readable but cannot dispatch a stale action.');
  await panePage.locator('[data-fieldwork-view="mysteries"]').click();
  assert.equal(await panePage.locator('[data-fieldwork-case="' + NEIGHBORHOOD_QUEST_GRAPH_ID + '"] [data-fieldwork-action]').isEnabled(), true, 'Healthy Journal actions remain available after the failed refresh finishes.');
  await panePage.evaluate(() => window.__fieldwork.destroy()); await panePage.close();

  // Authentication and missing-character failures stop further reads and clear cached private data.
  for (const failure of [{ status: 401, error: 'token_revoked' }, { status: 400, error: 'no_character' }]) {
    const sessionPage = await context.newPage();
    sessionPage.on('pageerror', error => errors.push(error.message));
    await sessionPage.route(recipesPath, route => route.fulfill({ status: failure.status, contentType: 'application/json', body: JSON.stringify({ error: failure.error, message: 'Restore your session.' }) }));
    await sessionPage.route('**/v1/me', route => route.fulfill({ status: failure.status === 401 ? 401 : 404, contentType: 'application/json', body: JSON.stringify({ error: failure.error }) }));
    await sessionPage.goto(base + '/fieldwork-browser-fixture');
    await sessionPage.waitForFunction(() => window.__fieldworkReads.includes('/v1/me'));
    assert.match(await sessionPage.locator('.fieldwork-body').textContent(), /Restore your session/);
    assert.equal(await sessionPage.locator('[data-fieldwork-action]').count(), 0, 'Session failure removes cached mutation controls.');
    const sessionReads = await sessionPage.evaluate(() => window.__fieldworkReads);
    assert(!sessionReads.includes('/v1/worldgraph/mysteries') && !sessionReads.includes('/v1/worldgraph/operations'), 'No later pane reads continue after session failure.');
    assert.deepEqual(await sessionPage.evaluate(() => window.__fieldworkCalls), []);
    await sessionPage.evaluate(() => window.__fieldwork.destroy()); await sessionPage.close();
  }

  const restoredPage = await context.newPage();
  restoredPage.on('pageerror', error => errors.push(error.message));
  const expired = route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'token_revoked', message: 'Restore your session.' }) });
  await restoredPage.route(recipesPath, expired);
  // The production bridge returns a player projection envelope, rather than /me's legacy body.
  await restoredPage.route('**/v1/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ player: { character: { id: players[0].characterId, name: 'Field Tester 0' } } }) }));
  await restoredPage.goto(base + '/fieldwork-browser-fixture');
  await restoredPage.waitForFunction(() => document.querySelector('.fieldwork-notice')?.textContent.includes('Reload your records'));
  const restoredReads = await restoredPage.evaluate(() => window.__fieldworkReads.length);
  await restoredPage.evaluate(id => window.__fieldwork.update({ character: { id } }), players[0].characterId);
  await restoredPage.waitForTimeout(100);
  assert.equal(await restoredPage.evaluate(() => window.__fieldworkReads.length), restoredReads, 'Same-character parent updates do not loop failed authentication reads.');
  await restoredPage.unroute(recipesPath, expired);
  await restoredPage.locator('[data-fieldwork-view="recipes"]').click();
  await restoredPage.getByRole('button', { name: 'Retry Crafting', exact: true }).click(); await settled(restoredPage);
  assert.equal(await restoredPage.getByRole('button', { name: 'Salvage junker', exact: true }).isEnabled(), true, 'A restored same-character session can reload the pane without a new controller.');
  assert.deepEqual(await restoredPage.evaluate(() => window.__fieldworkCalls), []);
  await restoredPage.evaluate(() => window.__fieldwork.destroy()); await restoredPage.close();

  // A delayed old-character response cannot overwrite the replacement character's fresh panes.
  const stalePage = await context.newPage();
  stalePage.on('pageerror', error => errors.push(error.message));
  await stalePage.goto(base + '/fieldwork-browser-fixture'); await settled(stalePage);
  await stalePage.evaluate(() => {
    window.__fieldwork.destroy();
    const board = name => ({ code: 200, body: { stacks: [], items: [{ id: name, title: name, state: 'active', actions: [] }] } });
    window.__fieldwork = OmertaFieldwork.mount(document.getElementById('fieldwork'), { character: { id: 'old-character' }, isActive: () => true,
      api: () => new Promise(resolve => { window.__releaseOldPane = () => resolve(board('Old private record')); }), act: () => { throw new Error('Unexpected mutation'); } });
    window.__fieldwork.update({ character: { id: 'replacement-character' }, api: async (_method, url) => url.endsWith('/inventory') ? board('Fresh current record')
      : { code: 200, body: { [url.split('/').at(-1)]: [] } } });
  });
  await settled(stalePage); await stalePage.evaluate(() => window.__releaseOldPane());
  await stalePage.waitForTimeout(50);
  assert.match(await stalePage.locator('.fieldwork-body').textContent(), /Fresh current record/);
  assert(!(await stalePage.locator('.fieldwork-body').textContent()).includes('Old private record'), 'Old-generation data never reaches the current UI.');
  await stalePage.evaluate(() => {
    window.__fieldwork.destroy(); window.__sessionReadCount = 0;
    window.__fieldwork = OmertaFieldwork.mount(document.getElementById('fieldwork'), { character: { id: 'session-old-character' }, isActive: () => true,
      api: async (_method, url) => url.endsWith('/inventory') ? { code: 200, body: { stacks: [], items: [] } }
        : { code: 401, body: { error: 'token_revoked' } },
      refresh: () => new Promise(resolve => { window.__releaseOldSession = () => resolve({ code: 200, body: { player: { character: { id: 'session-old-character' } } } }); }),
      act: () => { throw new Error('Unexpected mutation'); } });
  });
  await stalePage.waitForFunction(() => typeof window.__releaseOldSession === 'function');
  await stalePage.evaluate(() => window.__fieldwork.update({ character: { id: 'session-new-character' }, api: async (_method, url) => {
    window.__sessionReadCount++;
    return { code: 200, body: url.endsWith('/inventory') ? { stacks: [], items: [{ id: 'session-new-item', title: 'Replacement session record', state: 'active', actions: [] }] }
      : { [url.split('/').at(-1)]: [] } };
  } }));
  await settled(stalePage);
  const currentSessionReads = await stalePage.evaluate(() => window.__sessionReadCount);
  await stalePage.evaluate(() => window.__releaseOldSession()); await stalePage.waitForTimeout(50);
  assert.equal(await stalePage.evaluate(() => window.__sessionReadCount), currentSessionReads, 'A delayed old session check does not restart the replacement generation.');
  assert.match(await stalePage.locator('.fieldwork-body').textContent(), /Replacement session record/);
  await stalePage.evaluate(() => {
    window.__fieldwork.destroy(); window.__destroyedReads = [];
    window.__fieldwork = OmertaFieldwork.mount(document.getElementById('fieldwork'), { character: { id: 'dispose-character' }, isActive: () => true,
      api: (_method, url) => { window.__destroyedReads.push(url); return new Promise(resolve => { window.__releaseDestroyedPane = () => resolve({ code: 200, body: { stacks: [], items: [] } }); }); },
      act: () => { throw new Error('Unexpected mutation'); } });
    window.__fieldwork.destroy(); window.__releaseDestroyedPane();
  });
  await stalePage.waitForTimeout(50);
  assert.equal(await stalePage.locator('.world-fieldwork').count(), 0, 'A late pane cannot recreate destroyed UI.');
  assert.deepEqual(await stalePage.evaluate(() => window.__destroyedReads), ['/v1/worldgraph/inventory'], 'Destroyed loads stop before other panes.');
  await stalePage.close();

  await page.goto(base + '/fieldwork-browser-fixture'); await idle();
  assert.deepEqual(await page.evaluate(() => window.__fieldworkCalls), [], 'Opening the module performs no mutation.');
  await page.locator('[data-fieldwork-view="recipes"]').click();
  const salvage = page.getByRole('button', { name: 'Salvage junker', exact: true });
  await salvage.click();
  assert.equal(await page.evaluate(() => window.__fieldworkCalls.length), 0, 'Salvage confirmation is shown before dispatch.');
  await page.locator('[data-fieldwork-cancel]').click(); await idle();
  assert.equal((await app.pool.query('SELECT count(*) AS n FROM cars WHERE id=$1', [carId])).rows[0].n, 1, 'Cancelling preserves the exact car.');
  await salvage.click(); await confirm();
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM cars WHERE id=$1', [carId])).rows[0].n), 0, 'Confirmed salvage consumes the selected vehicle.');

  const recipes = await call('GET', '/v1/worldgraph/recipes', players[0]);
  const hardened = recipes.recipes.find(recipe => recipe.id === 'recipe:hardened_steel');
  const hardenedOutput = hardened.outputs[0].templateId;
  await page.evaluate(() => { window.__failNextResponse = true; });
  await page.locator('[data-fieldwork-recipe="recipe:hardened_steel"] [data-fieldwork-action]').click();
  await page.locator('[data-fieldwork-confirm]').click();
  await page.locator('[data-fieldwork-retry]').waitFor();
  const committed = await app.pool.query("SELECT quantity FROM item_stacks WHERE owner_scope='account' AND owner_id=$1 AND template_id=$2", [players[0].accountId, hardenedOutput]);
  const cashBeforeRetry = (await app.pool.query('SELECT cash FROM characters WHERE id=$1', [players[0].characterId])).rows[0].cash;
  await page.locator('[data-fieldwork-retry]').click(); await idle();
  assert.equal((await app.pool.query("SELECT quantity FROM item_stacks WHERE owner_scope='account' AND owner_id=$1 AND template_id=$2", [players[0].accountId, hardenedOutput])).rows[0].quantity, committed.rows[0].quantity, 'Response recovery awards no duplicate materials.');
  assert.equal((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [players[0].characterId])).rows[0].cash, cashBeforeRetry, 'Response recovery pays no duplicate cash cost.');
  const hardenedCalls = await page.evaluate(() => window.__fieldworkCalls.filter(call => decodeURIComponent(call.url).includes('recipe:hardened_steel')));
  assert.equal(hardenedCalls.length, 2); assert.equal(hardenedCalls[0].key, hardenedCalls[1].key, 'Logical retry retains the exact idempotency key.');

  await activate('[data-fieldwork-recipe="recipe:precision_lock_tool"] [data-fieldwork-action]');
  await page.locator('[data-fieldwork-view="inventory"]').click();
  await page.getByRole('button', { name: 'Carry with this character', exact: true }).click(); await confirm();
  assert(await page.getByRole('heading', { name: 'Carried by this character', exact: true }).isVisible(), 'Current-character custody remains visible after assignment.');

  await page.locator('[data-fieldwork-view="mysteries"]').click();
  await activate('[data-fieldwork-case="belladonna-demo"] [data-fieldwork-action]');
  assert(!(await page.locator('.fieldwork-case').innerHTML()).includes('mystery:belladonna-lock'), 'Hidden lead identity is absent before discovery.');
  const trace = page.locator('[data-fieldwork-node="mystery:belladonna-trace"] [data-fieldwork-action]');
  await trace.click(); await idle();
  assert.equal(await page.locator('[data-fieldwork-node="mystery:belladonna-lock"]').count(), 1, 'Completing evidence reveals the authored lead without guessing its identity.');
  for (let step = 0; step < 8; step++) {
    const completed = await page.locator('.fieldwork-case__heading .fieldwork-stamp').textContent();
    if (completed === 'completed') break;
    const next = page.locator('.fieldwork-case [data-fieldwork-action]:not([disabled])').filter({ hasText: 'Complete this step' }).first();
    if (await next.count()) { await next.click(); if (await page.locator('[data-fieldwork-confirm]').count()) await confirm(); else await idle(); }
    else { await page.getByRole('button', { name: 'Investigate the next lead', exact: true }).click(); await idle(); }
  }
  assert.equal(await page.locator('.fieldwork-case__heading .fieldwork-stamp').textContent(), 'completed', 'The real investigation completes through issued visible steps.');

  // Seed the other participants' conserved tools; player zero crafted and carried theirs through UI.
  const precision = recipes.recipes.find(recipe => recipe.id === 'recipe:precision_lock_tool').outputs[0].templateId;
  for (const index of [2, 3]) await withItemTransaction(app.pool, client => createItem(client, { scope: 'account', id: players[index].accountId }, precision, 'crafted', 'fieldwork-browser-tool-' + index));
  await page.locator('[data-fieldwork-view="operations"]').click();
  await page.getByRole('button', { name: 'Open this crew operation', exact: true }).click(); await confirm();
  await page.locator('[data-fieldwork-role="investigator"] [data-fieldwork-action]').click(); await idle();
  const operationCatalog = await call('GET', '/v1/worldgraph/operations', players[0]);
  const operationId = operationCatalog.operations.find(entry => entry.operationNodeId === 'operation:belladonna-lockbox').operationId;
  for (const [index, role] of [[1, 'driver'], [2, 'mechanic'], [3, 'enforcer']]) {
    const board = await call('GET', '/v1/worldgraph/operations/' + operationId, players[index]);
    const issued = board.roles.find(entry => entry.roleId === role).actions.find(action => action.available);
    assert(issued, 'An unassigned eligible account is issued its role claim.');
    await call(issued.method, issued.path, players[index], issued.body, crypto.randomUUID());
  }
  await refresh();
  await page.locator('.fieldwork-role [data-fieldwork-action]:not([disabled])').first().click(); await idle();
  assert.match(await page.locator('.fieldwork-role').textContent(), /fourth petal/i, 'The assigned role reads its own newly discovered clue.');
  const driverView = await call('GET', '/v1/worldgraph/operations/' + operationId + '/role', players[1]);
  assert.doesNotMatch(JSON.stringify(driverView), /fourth petal|belladonna-cipher-fragment/i, 'Another role receives neither the private clue nor its identity.');
  for (const index of [1, 2, 3]) {
    const board = await call('GET', '/v1/worldgraph/operations/' + operationId + '/role', players[index]);
    const issued = board.nodes.flatMap(node => node.actions || []).find(action => action.available);
    assert(issued, 'Each assigned role is issued its next ordered contribution.');
    await call(issued.method, issued.path, players[index], issued.body, crypto.randomUUID());
  }
  await refresh();
  await page.getByRole('button', { name: 'Complete operation', exact: true }).click(); await confirm();
  assert.equal((await call('GET', '/v1/worldgraph/operations/' + operationId, players[0])).status, 'completed', 'The closer completes the real four-account operation.');
  const completedBlockers = await page.locator('.fieldwork-role .fieldwork-node .fieldwork-blockers li').allTextContents();
  assert.equal(new Set(completedBlockers).size, completedBlockers.length, 'Completed-role blocker copy is displayed once.');

  // An opener can recover escrow after departing the old Crew, without reopening its private board.
  const recoveryCrewId = crypto.randomUUID();
  await app.pool.query('INSERT INTO crews(id,name,leader_account) VALUES($1,$2,$3)', [recoveryCrewId, 'Recovery Crew', players[0].accountId]);
  for (const player of players) await app.pool.query('UPDATE crew_members SET crew_id=$1 WHERE account_id=$2', [recoveryCrewId, player.accountId]);
  const recoveryCatalog = await call('GET', '/v1/worldgraph/operations', players[0]);
  const openRecovery = recoveryCatalog.operations.find(entry => entry.operationNodeId === 'operation:belladonna-lockbox').actions.find(action => action.available);
  const recoveryOperation = await call(openRecovery.method, openRecovery.path, players[0], openRecovery.body, crypto.randomUUID());
  const recoveryId = recoveryOperation.operationId;
  for (const [index, role] of ['investigator', 'driver', 'mechanic', 'enforcer'].entries()) {
    const board = await call('GET', '/v1/worldgraph/operations/' + recoveryId, players[index]);
    const issued = board.roles.find(entry => entry.roleId === role).actions.find(action => action.available);
    await call(issued.method, issued.path, players[index], issued.body, crypto.randomUUID());
  }
  for (const index of [0, 1, 2]) {
    const board = await call('GET', '/v1/worldgraph/operations/' + recoveryId + '/role', players[index]);
    const issued = board.nodes.flatMap(node => node.actions || []).find(action => action.available);
    await call(issued.method, issued.path, players[index], issued.body, crypto.randomUUID());
  }
  const escrowedId = (await app.pool.query('SELECT item_id FROM operation_escrow WHERE operation_id=$1', [recoveryId])).rows[0].item_id;
  await call('POST', '/v1/crew/leave', players[3], {}, crypto.randomUUID());
  await call('POST', '/v1/crew/leave', players[0], {}, crypto.randomUUID());
  const foreignRecovery = await call('GET', '/v1/worldgraph/operations', players[3]);
  assert(!JSON.stringify(foreignRecovery).includes(recoveryId), 'A nonopener outside the Crew receives no recovery operation identity.');
  for (const id of [recoveryId, 'missing-recovery-operation']) {
    const denied = await app.inject({ method: 'POST', url: '/v1/worldgraph/operations/' + id + '/cancel', payload: {}, headers: { authorization: 'Bearer ' + players[3].token, 'idempotency-key': crypto.randomUUID() } });
    assert.equal(denied.statusCode, 400);
    assert.equal(denied.json().error, 'operation_unavailable', 'Foreign and missing cancellation remain indistinguishable.');
  }
  const oldDetail = await app.inject({ method: 'GET', url: '/v1/worldgraph/operations/' + recoveryId, headers: { authorization: 'Bearer ' + players[0].token } });
  assert.equal(oldDetail.statusCode, 400); assert.equal(oldDetail.json().error, 'operation_unavailable', 'Recovery does not grant current-Crew board access.');
  await refresh();
  await page.getByRole('button', { name: 'Close this operation and recover held items', exact: true }).click(); await confirm();
  assert.equal((await app.pool.query('SELECT status FROM world_operations WHERE id=$1', [recoveryId])).rows[0].status, 'canceled');
  const recoveredItem = (await app.pool.query('SELECT state,owner_scope,owner_id FROM item_instances WHERE id=$1', [escrowedId])).rows[0];
  assert.deepEqual(recoveredItem, { state: 'active', owner_scope: 'account', owner_id: players[2].accountId }, 'Old-Crew GUI cancellation returns escrow to its recorded depositor.');

  const shots = process.env.FIELDWORK_SHOTS || process.env.CITY_SCENE_SHOTS;
  if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.locator('.world-fieldwork').screenshot({ path: path.join(shots, 'fieldwork-desktop.png') }); }
  await page.setViewportSize({ width: 375, height: 812 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Fieldwork has no phone-width overflow.');
  if (shots) await page.locator('.world-fieldwork').screenshot({ path: path.join(shots, 'fieldwork-mobile.png') });

  // An old active instance can be cancelled using its exact issued ID after character replacement.
  await page.locator('[data-fieldwork-view="mysteries"]').click();
  await activate('[data-fieldwork-case="' + NEIGHBORHOOD_QUEST_GRAPH_ID + '"] [data-fieldwork-action]');
  await page.locator('[data-fieldwork-node="mystery:neighborhood-fixer"] [data-fieldwork-action]').click(); await idle();
  await page.locator('[data-fieldwork-node="choice:neighborhood-approach"] [data-fieldwork-action]').first().click(); await confirm();
  await page.locator('[data-fieldwork-node="mystery:neighborhood-listen"] [data-fieldwork-action]').click(); await idle();
  assert(!(await page.locator('.fieldwork-case').innerHTML()).includes('mystery:neighborhood-newsroom'), 'Eligible hidden lead identity is absent before explicit investigation.');
  await page.getByRole('button', { name: 'Investigate the next lead', exact: true }).click(); await idle();
  const exploreCall = await page.evaluate(() => window.__fieldworkCalls.find(call => call.url.endsWith('/explore')));
  assert(exploreCall, 'The journal uses the generic issued exploration route.');
  const exactReplay = await call('POST', exploreCall.url, players[0], exploreCall.body, exploreCall.key);
  assert.deepEqual(exactReplay, exploreCall.result.body, 'Exploration replay returns the exact originally issued discovery result.');
  assert.equal(await page.locator('[data-fieldwork-node="mystery:neighborhood-newsroom"]').count(), 1, 'Explicit investigation reveals the issued lead.');
  const beforeReplacement = await call('GET', '/v1/worldgraph/mysteries', players[0]);
  const oldInstanceId = beforeReplacement.mysteries.find(entry => entry.graphId === NEIGHBORHOOD_QUEST_GRAPH_ID).instanceId;
  const heirId = crypto.randomUUID();
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [players[0].characterId]);
  await app.pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,'Field Heir',1,'foundry')", [heirId, players[0].accountId]);
  await page.evaluate(id => window.__fieldwork.update({ character: { id } }), heirId); await idle();
  await page.getByRole('button', { name: 'Recover held items and close', exact: true }).click(); await confirm();
  assert.equal((await app.pool.query('SELECT status FROM mystery_instances WHERE id=$1', [oldInstanceId])).rows[0].status, 'canceled', 'Historical cancellation targets the recorded old instance.');
  await page.getByRole('button', { name: 'Return to the neighborhood', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.__navigate), ['map']);
  await page.evaluate(() => window.__fieldwork.destroy());
  assert.equal(await page.locator('.world-fieldwork').count(), 0, 'Destroy removes module UI.');
  assert.deepEqual(errors, [], 'No uncaught browser errors.');
  console.log('world-fieldwork-browser: pane failure isolation/retry, cached action guards, session clearing, stale-generation/teardown, confirmation/cancel, salvage/crafting/carry, exact-key recovery, hidden-lead discovery/replay, journal completion, four-account operation/private clue, old-Crew escrow recovery/privacy, mobile layout and historical cancellation pass' + (shots ? '\nScreenshots: ' + shots + '/fieldwork-desktop.png and fieldwork-mobile.png' : ''));
  await context.close();
} finally { if (browser) await browser.close(); await app.close(); }
