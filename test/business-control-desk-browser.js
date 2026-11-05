// Real mounted application and Chromium controls. Counterparties act over public
// HTTP; only initial funding/stock/prerequisites are fixture writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { businessDeskFixture, courierReference, consignmentReference } from './lib/business-control-desk-fixture.js';

// This checks the component's public lifecycle, not application authentication.
// GET DTOs come from the mounted public APIs. Only this isolated no-dispatch
// component receives an act spy, so delayed reads cannot move game state.
async function componentIdentityBoundary(context, f, scenario, production, toolId) {
  const before = await f.snapshot(), paths = ['/v1/session', '/v1/me', '/v1/company/desk', '/v1/worldgraph/inventory',
    '/v1/worldgraph/recipes', '/v1/market', '/v1/depot', '/v1/depots', '/v1/resources/company',
    '/v1/company/operator', '/v1/company/production', '/v1/company/courier-networks', '/v1/consignments'];
  const records = {};
  for (const [name, actor] of Object.entries({ a: scenario.actors.maker, b: scenario.actors.outsider })) {
    records[name] = {};
    for (const path of paths) {
      const response = await f.request(actor, 'GET', path);
      assert.equal(response.status, 200, `${name} ${path}: ${response.text}`);
      records[name][path] = { code: response.status, body: response.body };
    }
  }
  const privateMarkers = [scenario.businessId, production.runId, toolId, `Desk Company ${scenario.label}`];
  // Keep the component-only spy separate from the real application's timers,
  // session handling and positive economic journey.
  const page = await context.newPage();
  await page.goto(f.origin + '/robots.txt', { waitUntil: 'domcontentloaded' });
  await page.setContent('<!doctype html><html><head><title>Business component boundary proof</title></head><body></body></html>');
  await page.addScriptTag({ url: f.origin + '/business-control-desk.js' });
  let posts = 0;
  const countPosts = request => { if (request.method() === 'POST') posts++; };
  page.on('request', countPosts);
  try {
    await page.evaluate(({ records }) => {
      const host = document.createElement('div'); host.id = 'business-boundary-proof'; document.body.append(host);
      const proof = window.__businessBoundaryProof = { actor: 'a', holdRead: false, holdProbe: false, readHeld: false, probeHeld: false, acts: [] };
      const api = async (method, path) => {
        if (method !== 'GET') throw Error('Component boundary proof only permits real captured GET records.');
        const actor = proof.actor, response = structuredClone(records[actor][path]);
        if (!response) throw Error('Unexpected public read ' + path);
        if (actor === 'a' && proof.holdRead && path === '/v1/resources/company') {
          proof.readHeld = true; await new Promise(resolve => { proof.releaseRead = resolve; });
          proof.readReturned = true;
        }
        if (actor === 'a' && proof.holdProbe && path === '/v1/session') {
          proof.probeHeld = true; await new Promise(resolve => { proof.releaseProbe = resolve; });
          proof.probeReturned = true;
        }
        // Deliberately return stale responses even after update(). The real
        // component must reject them using its own identity/epoch checks.
        return response;
      };
      const options = actor => ({ identity: records[actor]['/v1/session'].body.accountId,
        character: records[actor]['/v1/session'].body.character, api, isActive: () => true,
        act: async (...args) => { proof.acts.push(args); return { code: 503, body: { error: 'component_spy_only' } }; } });
      proof.controller = window.OmertaBusinessDesk.mount(host, options('a'));
      proof.swap = actor => { proof.actor = actor; proof.controller.update(options(actor)); };
    }, { records });
    const host = page.locator('#business-boundary-proof');
    await host.locator('.business-body[aria-busy="false"]').waitFor();
    assert((await host.innerHTML()).includes(production.runId), 'The first actor has an actual private production receipt on the component.');
    await page.evaluate(() => { const proof = window.__businessBoundaryProof; proof.holdRead = true; proof.controller.update({}); });
    await page.waitForFunction(() => window.__businessBoundaryProof.readHeld);
    await page.evaluate(() => window.__businessBoundaryProof.swap('b'));
    for (const marker of privateMarkers) assert(!(await host.innerHTML()).includes(marker), 'Identity update synchronously clears the old private board.');
    await host.locator('.business-body[aria-busy="false"]').waitFor();
    await page.evaluate(() => { const proof = window.__businessBoundaryProof; proof.holdRead = false; proof.releaseRead(); });
    await page.waitForFunction(() => window.__businessBoundaryProof.readReturned);
    for (const marker of privateMarkers) assert(!(await host.innerHTML()).includes(marker), 'A delayed old-account record cannot repopulate the new board.');
    assert.equal(await page.evaluate(() => window.__businessBoundaryProof.acts.length), 0);

    await page.evaluate(() => window.__businessBoundaryProof.swap('a'));
    await host.locator('.business-body[aria-busy="false"]').waitFor();
    await page.evaluate(() => { window.__businessBoundaryProof.holdProbe = true; });
    await host.locator('button[data-business-action="buy-input"]:not([disabled])').first().click();
    await page.waitForFunction(() => window.__businessBoundaryProof.probeHeld);
    await page.evaluate(() => window.__businessBoundaryProof.swap('b'));
    await host.locator('.business-body[aria-busy="false"]').waitFor();
    await page.evaluate(() => { const proof = window.__businessBoundaryProof; proof.holdProbe = false; proof.releaseProbe(); });
    await page.waitForFunction(() => window.__businessBoundaryProof.probeReturned);
    assert.equal(await page.evaluate(() => window.__businessBoundaryProof.acts.length), 0, 'An old actor preflight released after update cannot dispatch a POST.');
    assert.equal(posts, 0, 'The isolated component races send no actual POST.');
    for (const marker of privateMarkers) assert(!(await host.innerHTML()).includes(marker));
    assert.deepEqual(await f.snapshot(), before, 'The component-only identity races perform no game writes.');
  } finally {
    page.off('request', countPosts);
    await page.evaluate(() => {
      const proof = window.__businessBoundaryProof;
      if (proof) { proof.releaseRead?.(); proof.releaseProbe?.(); proof.controller.destroy(); }
      document.getElementById('business-boundary-proof')?.remove(); delete window.__businessBoundaryProof;
    });
    await page.close();
  }
}

async function mountedAgentRateBoundary(context, f, scenario) {
  const actor = scenario.actors.outsider;
  const character = (await f.ok(actor, 'GET', '/v1/me')).character;
  assert.equal((await f.app.pool.query('SELECT agent_flag FROM account_persistent WHERE account_id=$1', [actor.account])).rows[0].agent_flag, true);
  const before = await f.snapshot(), priorRateLimit = process.env.RATE_LIMIT;
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(f.origin + '/robots.txt', { waitUntil: 'domcontentloaded' });
    await page.setContent('<!doctype html><title>Mounted agent cadence proof</title><div id="agent-desk"></div>');
    await page.addScriptTag({ url: f.origin + '/business-control-desk.js' });
    process.env.RATE_LIMIT = 'on';
    const allowed = await f.request(actor, 'GET', '/v1/session', undefined, undefined, 'agent');
    assert.equal(allowed.status, 200, allowed.text);
    const limited = await f.request(actor, 'GET', '/v1/me', undefined, undefined, 'agent');
    assert.equal(limited.status, 429, 'The default mounted agent bucket really limits an immediate authenticated read.');
    assert.equal(limited.body.error, 'rate_limited'); assert.equal(limited.body.retryAfter, 3);
    assert.equal(limited.headers['retry-after'], '3');
    await page.evaluate(({ character, account, token }) => {
      const proof = window.__mountedAgentProof = { requests: [] };
      async function request(method, path, body, options = {}) {
        if (options.beforeDispatch && !options.beforeDispatch()) return { ignored: true };
        const headers = { authorization: 'Bearer ' + token };
        if (body !== undefined) headers['content-type'] = 'application/json';
        if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
        const at = Date.now();
        const response = await fetch(path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const result = { code: response.status, body: await response.json() };
        proof.requests.push({ method, path, at, code: result.code, body, key: options.idempotencyKey });
        return options.isCurrent && !options.isCurrent() ? { ignored: true } : result;
      }
      proof.controller = window.OmertaBusinessDesk.mount(document.getElementById('agent-desk'), {
        identity: account, character, api: request, act: request, isActive: () => true,
      });
    }, { character, account: actor.account, token: actor.agent });
    // Thirteen authenticated reads at the real unchanged 1/3s cadence require
    // over thirty seconds. This bound applies only to this added live-rate case.
    const idle = () => page.waitForFunction(() => document.querySelector('#agent-desk .business-body')?.getAttribute('aria-busy') === 'false', undefined, { timeout: 90000 });
    await idle();
    assert.equal(await page.locator('#agent-desk .business-partial').count(), 0);
    assert.equal(await page.locator('#agent-desk .business-summary').count(), 1);
    const travel = page.locator('#agent-desk form[data-business-form="travel"]');
    assert.equal(await travel.locator('[data-business-action="travel"]').isDisabled(), false, 'The real agent finishes loading every dependent board.');
    await travel.locator('[name="district"]').selectOption('neon');
    const response = page.waitForResponse(value => value.request().method() === 'POST' && new URL(value.url()).pathname === '/v1/travel/neon', { timeout: 20000 });
    await travel.locator('[data-business-action="travel"]').click();
    const committed = await response; assert.equal(committed.status(), 200, await committed.text());
    assert.deepEqual(committed.request().postDataJSON(), {});
    assert.match(committed.request().headers()['idempotency-key'] ?? '', /^[!-~]{1,128}$/);
    await idle();
    assert.equal(await page.locator('#agent-desk .business-partial').count(), 0, 'The post-mutation read cohort also respects the real agent cadence.');
    const trace = await page.evaluate(() => window.__mountedAgentProof.requests);
    assert(trace.some(row => row.method === 'GET' && row.code === 429), 'This proof exercises an actual mounted rate refusal, rather than disabling the limiter.');
    const posts = trace.filter(row => row.method === 'POST');
    assert.equal(posts.length, 1, 'Cadence prevents duplicate real travel effects.'); assert.equal(posts[0].code, 200);
    console.log(JSON.stringify({ businessDeskAgentRateTrace: { agentFlag: true, rateLimit: 'on',
      immediateRead: { session: allowed.status, me: limited.status, retryAfter: limited.body.retryAfter }, requests: trace } }));
    const after = await f.snapshot(), initial = before.characters.find(row => row.id === actor.id), final = after.characters.find(row => row.id === actor.id);
    assert.equal(final.loc, 'neon');
    const oldIds = new Set(before.transactions.map(row => row.id));
    const added = after.transactions.filter(row => !oldIds.has(row.id));
    assert(added.some(row => row.character_id === actor.id && row.currency === 'cash' && Number(row.amount) < 0), 'Travel pays its canonical game-cash cost.');
    assert.equal(Number(final.cash) + Number(final.bank) - Number(initial.cash) - Number(initial.bank), added.filter(row => row.character_id === actor.id && row.currency === 'cash').reduce((sum, row) => sum + Number(row.amount), 0));
    for (const key of ['cars', 'market', 'stacks', 'items', 'events', 'escrow', 'production', 'couriers', 'consignments']) assert.deepEqual(after[key], before[key], `Rate recovery does not invent ${key} effects.`);
    await f.books(); assert.deepEqual(errors, []);
    console.log('business desk real mounted agent cadence PASS: default RATE_LIMIT=on/agent_flag, actual 429, complete reads, canonical session-preflight/travel and single reconciled game-cash effect');
  } finally {
    process.env.RATE_LIMIT = priorRateLimit;
    await page.evaluate(() => window.__mountedAgentProof?.controller.destroy()).catch(() => {});
    await page.close();
  }
}

const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
assert(executablePath, 'Install Chromium or set CHROMIUM_PATH; the business desk browser proof never skips.');
const f = await businessDeskFixture([{ label: 'desktop', rateLimitProbe: true }, { label: 'mobile' }]);
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true });
  for (const [index, viewport] of [{ width: 1280, height: 900 }, { width: 390, height: 844 }].entries()) {
    const s = f.scenarios[index], { maker, first, second, host, buyer } = s.actors;
    const before = await f.snapshot(), errors = [], requests = [], failedRequests = [];
    const context = await browser.newContext({ viewport, isMobile: index === 1, hasTouch: index === 1 });
    let page, lastAction = '';
    try {
      await context.addInitScript(token => localStorage.setItem('omerta_token', token), maker.token);
      page = await context.newPage();
      page.on('pageerror', error => { errors.push(error.message); if (errors.length > 16) errors.shift(); });
      page.on('request', request => {
        if (request.method() === 'POST') { requests.push({ method: request.method(), path: new URL(request.url()).pathname }); if (requests.length > 16) requests.shift(); }
      });
      page.on('requestfailed', request => {
        failedRequests.push({ method: request.method(), path: new URL(request.url()).pathname, error: request.failure()?.errorText });
        if (failedRequests.length > 16) failedRequests.shift();
      });
      page.on('dialog', dialog => dialog.accept());
      await page.addLocatorHandler(page.locator('[data-tipok]'), async locator => locator.click());
      await page.addLocatorHandler(page.locator('#welcome:not(.hidden)'), async () => page.locator('#tour-skip').click());
      await page.goto(f.origin, { waitUntil: 'domcontentloaded' });
      await page.locator('#screen-main:not(.hidden)').waitFor();
      if (!await page.locator('[data-tab="business"]:visible').count()) {
        await page.locator('#grouprail [data-group="earners"]').click();
      }
      await page.locator('[data-tab="business"]:visible').first().click();
      const desk = page.locator('#tab-business');
      await desk.waitFor({ state: 'visible' });
      await desk.locator('[data-business-refresh]').waitFor();
      // The first desk response can finish before the rest of its read cohort.
      const idle = () => page.waitForFunction(() => document.body.style.cursor !== 'progress'
        && document.querySelector('#tab-business .business-body')?.getAttribute('aria-busy') === 'false');
      async function refresh() {
        await idle();
        const response = page.waitForResponse(result => result.request().method() === 'GET' && new URL(result.url()).pathname === '/v1/company/desk');
        await desk.locator('[data-business-refresh]').click();
        assert.equal((await response).status(), 200);
        await idle();
      }
      async function action(name, path, body, fields = {}, entityId) {
        lastAction = name;
        await idle();
        let button;
        if (entityId) {
          const direct = desk.locator(`button[data-business-action="${name}"][data-business-id="${entityId}"]`);
          button = await direct.count() ? direct.first() : desk.locator(`[data-business-id="${entityId}"] button[data-business-action="${name}"]`).first();
        } else button = desk.locator(`button[data-business-action="${name}"]`).first();
        await button.waitFor({ state: 'visible' });
        const form = button.locator('xpath=ancestor::form[1]');
        assert.equal(await form.count(), 1, `${name} is submitted by an ordinary form.`);
        for (const [field, value] of Object.entries(fields)) {
          const control = form.locator(`[name="${field}"]`).first();
          assert.equal(await control.count(), 1, `${name} exposes the ${field} control.`);
          const tag = await control.evaluate(element => element.tagName.toLowerCase());
          const type = await control.getAttribute('type');
          if (type === 'checkbox') { if (value) await control.check(); else await control.uncheck(); }
          else if (tag === 'select') await control.selectOption(String(value));
          else await control.fill(String(value));
        }
        await idle();
        const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === path);
        await button.click();
        const response = await responsePromise, request = response.request();
        assert.deepEqual(request.postDataJSON(), body, `${name} sends only canonical public API fields.`);
        assert.equal(response.status(), 200, `${name}: ${await response.text()}`);
        const key = request.headers()['idempotency-key'];
        assert.match(key ?? '', /^[!-~]{1,128}$/, `${name} carries the real HTTP idempotency key.`);
        const result = await response.json();
        await idle();
        await f.replay(maker, 'POST', path, body, key);
        await refresh();
        return result;
      }
      async function recoverCommittedPurchase(input) {
        const path = `/v1/market/${input.listingId}/buy`, cashBefore = await f.cash(maker);
        let committed, originalKey, interceptedFailure, attempts = 0;
        const intercept = async route => {
          if (route.request().method() !== 'POST') return route.continue();
          try {
            attempts++; originalKey = route.request().headers()['idempotency-key'];
            assert.match(originalKey ?? '', /^[!-~]{1,128}$/);
            assert.deepEqual(route.request().postDataJSON(), {});
            const response = await route.fetch();
            assert.equal(response.status(), 200, await response.text());
            committed = await response.json();
          } catch (error) { interceptedFailure = error; }
          await route.abort('failed'); // A successful server commit receives no browser acknowledgement.
        };
        const pattern = f.origin + path;
        await page.route(pattern, intercept);
        try {
          await desk.locator(`[data-business-id="${input.listingId}"] button[data-business-action="buy-input"]`).click();
          await desk.locator('[data-business-retry]').waitFor({ state: 'visible' });
          if (interceptedFailure) throw interceptedFailure;
          assert.equal(attempts, 1); assert.equal(committed.carId, input.carId);
          assert.equal(await f.cash(maker), cashBefore - input.price);
          const committedState = await f.snapshot();
          assert.equal(committedState.cars.find(row => row.id === input.carId)?.character_id, maker.id);
          assert.equal(await desk.locator('[data-business-action]:not([disabled])').count(), 0, 'An unknown committed result locks every other mutation.');
          await refresh();
          await desk.locator('[data-business-retry]').waitFor({ state: 'visible' });
          assert.equal(attempts, 1, 'Refreshing an unknown result sends no automatic mutation retry.');
          assert.equal(await desk.locator('[data-business-action]:not([disabled])').count(), 0, 'Refresh cannot discard the pending protected request.');
          assert.deepEqual(await f.snapshot(), committedState);
        } finally { await page.unroute(pattern, intercept); }
        const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === path);
        await desk.locator('[data-business-retry]').click();
        const response = await responsePromise;
        assert.equal(response.status(), 200); assert.equal(response.headers()['x-idempotent-replay'], 'true');
        assert.equal(response.request().headers()['idempotency-key'], originalKey);
        assert.deepEqual(response.request().postDataJSON(), {}); assert.deepEqual(await response.json(), committed);
        await idle(); await refresh();
        assert.equal(await desk.locator('[data-business-retry]').count(), 0);
        assert.equal(await f.cash(maker), cashBefore - input.price, 'Recovery causes no second debit.');
        await f.replay(maker, 'POST', path, {}, originalKey);
        return committed;
      }
      async function partialReadRecovery() {
        await page.waitForFunction(() => !document.querySelector('#tab-business [data-business-action="produce"]').disabled);
        const beforeRead = await f.snapshot(), pattern = '**/v1/company/production';
        const unavailable = route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'fixture_read_unavailable' }) });
        await page.route(pattern, unavailable);
        try {
          await refresh();
          await desk.locator('.business-partial').waitFor();
          assert.equal(await desk.locator('[data-business-action="produce"]').isDisabled(), true);
          assert.equal(await desk.locator('.business-summary').isVisible(), true, 'Independent cash records remain visible.');
          assert.equal(await desk.locator('#business-supply').isVisible(), true, 'Independent supply records remain visible.');
          assert.deepEqual(await f.snapshot(), beforeRead, 'A read failure cannot move game cash, items or receipts.');
        } finally { await page.unroute(pattern, unavailable); }
        await refresh();
        await desk.locator('.business-partial').waitFor({ state: 'detached' });
        await page.waitForFunction(() => !document.querySelector('#tab-business [data-business-action="produce"]').disabled);
        assert.deepEqual(await f.snapshot(), beforeRead, 'Restoring read availability performs no game action.');
      }
      const input = s.inputs[0], next = s.inputs[1];
      const bought = index === 0 ? await recoverCommittedPurchase(input)
        : await action('buy-input', `/v1/market/${input.listingId}/buy`, {}, {}, input.listingId);
      assert.equal(bought.carId, input.carId);
      const recipeBoard = await f.ok(maker, 'GET', '/v1/worldgraph/recipes');
      const salvage = recipeBoard.recipes.find(recipe => recipe.id === 'recipe:car_salvage_basic')?.actions
        ?.find(issued => issued.available && issued.path.endsWith('/' + encodeURIComponent(input.carId)));
      assert(salvage, 'The current public recipe board must issue this exact owned car salvage action.');
      assert.equal(salvage.method, 'POST');
      await action('salvage', salvage.path, salvage.body ?? {}, {}, input.carId);
      if (index === 0) await partialReadRecovery();
      const produced = await action('produce', '/v1/company/production/run', s.production,
        { recipeId: 'recipe:hardened_steel', secondRecipeId: 'recipe:precision_lock_tool' });
      assert.equal(produced.totalCrafts, 2); assert.equal(produced.totalCashCost, 300);
      const toolId = produced.crafts.at(-1).receipt.outputs[0].id;
      const courierTerms = { itemId: toolId, firstCarrier: first.account, secondCarrier: second.account,
        origin: 'foundry', handoff: 'docks', destination: 'neon', firstFee: 30, secondFee: 40, expiresInSeconds: 3600, consent: true };
      const network = await action('publish-courier', '/v1/company/courier-networks/publish', courierTerms,
        { firstCarrier: first.account, secondCarrier: second.account, origin: 'foundry', handoff: 'docks', destination: 'neon',
          firstFee: 30, secondFee: 40, expiresInSeconds: 3600, consent: true }, toolId);
      const reference = courierReference(network);
      await f.replay(first, 'POST', '/v1/company/courier-networks/consent', reference, `${s.label}-browser-first-consent`);
      await f.replay(second, 'POST', '/v1/company/courier-networks/consent', reference, `${s.label}-browser-second-consent`);
      await refresh();
      await action('dispatch-courier', '/v1/company/courier-networks/dispatch', reference, { consent: true }, network.networkId);
      assert.equal((await f.item(toolId)).owner_id, network.networkId + ':first');
      await f.replay(first, 'POST', '/v1/company/courier-networks/travel', reference, `${s.label}-browser-first-travel`);
      await f.replay(first, 'POST', '/v1/company/courier-networks/handoff', reference, `${s.label}-browser-handoff`);
      assert.equal((await f.item(toolId)).owner_id, network.networkId + ':second');
      await action('travel', '/v1/travel/neon', {}, { district: 'neon' });
      await f.replay(second, 'POST', '/v1/company/courier-networks/travel', reference, `${s.label}-browser-second-travel`);
      await f.replay(second, 'POST', '/v1/company/courier-networks/arrive', reference, `${s.label}-browser-arrive`);
      await refresh();
      assert.equal((await f.item(toolId)).owner_id, maker.account, 'Carrier delivery returns the same UID to the owner.');
      const saleTerms = { itemId: toolId, hostAccountId: host.account, price: 10000, hostFeeBps: 1000, lifetimeSeconds: 3600, consent: true };
      const offer = await action('create-consignment', '/v1/consignments/create', saleTerms,
        { hostAccountId: host.account, price: 10000, hostFeeBps: 1000, lifetimeSeconds: 3600, consent: true }, toolId);
      const saleReference = consignmentReference(offer);
      await f.replay(host, 'POST', '/v1/consignments/accept', saleReference, `${s.label}-browser-host-accept`);
      assert(await f.cash(maker) < next.price);
      await f.replay(buyer, 'POST', '/v1/consignments/buy', saleReference, `${s.label}-browser-buyer-purchase`);
      assert(await f.cash(maker) >= next.price);
      await refresh();
      await action('reinvest', `/v1/market/${next.listingId}/buy`, {}, {}, next.listingId);
      await f.assertFinished(s, toolId, before);
      if (index === 0) {
        await componentIdentityBoundary(context, f, s, produced, toolId);
        await mountedAgentRateBoundary(context, f, s);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'The complete desk fits the viewport.');
      assert.deepEqual(errors, []);
      console.log(`business desk Chromium ${viewport.width}x${viewport.height} PASS: human controls buy/salvage/two-recipe batch/courier consent/dispatch/travel/sale offer/reinvestment; public funded counterparties, canonical balances/title, exact HTTP receipts, no page errors or horizontal overflow${index === 0 ? '; committed-response loss recovery, partial read recovery and separate component identity/preflight no-dispatch boundaries' : ''}`);
    } catch (error) {
      const directory = path.resolve(process.env.BUSINESS_CONTROL_DESK_BROWSER_OUTPUT || 'output/business-control-desk-browser', `${Date.now()}-${s.label}`);
      fs.mkdirSync(directory, { recursive: true });
      const formState = page ? await page.evaluate(action => {
        const desk = document.querySelector('#tab-business');
        return { action, cursor: document.body.style.cursor,
          busy: desk?.querySelector('.business-body')?.getAttribute('aria-busy'),
          notice: desk?.querySelector('.business-notice')?.textContent?.slice(0, 512),
          forms: [...(desk?.querySelectorAll('form[data-business-form]') || [])]
            .filter(form => [...form.querySelectorAll('[data-business-action]')].some(button => button.dataset.businessAction === action))
            .slice(0, 3).map(form => ({ form: form.dataset.businessForm, entityId: form.dataset.businessId,
              invalid: [...form.elements].filter(input => input.willValidate && !input.validity.valid).map(input => input.name),
              fields: [...form.elements].filter(input => input.name).slice(0, 16).map(input => ({ name: input.name,
                value: input.type === 'checkbox' ? input.checked : input.value.slice(0, 100) })) })) };
      }, lastAction).catch(() => null) : null;
      const diagnostics = { viewport, message: error.message, requests, failedRequests, pageErrors: errors,
        formState,
        desk: page ? (await page.locator('#tab-business').innerText().catch(() => '')).slice(0, 4000) : '' };
      fs.writeFileSync(path.join(directory, 'failure.json'), JSON.stringify(diagnostics, null, 2));
      if (page) await page.screenshot({ path: path.join(directory, 'failure.png'), fullPage: true }).catch(() => {});
      console.error(JSON.stringify({ businessDeskFailure: directory, message: error.message, requests, failedRequests, pageErrors: errors, formState }));
      throw error;
    } finally { await context.close(); }
  }
} finally { if (browser) await browser.close(); await f.close(); }
