// Real mounted application and Chromium controls. Counterparties act over public
// HTTP; only initial funding/stock/prerequisites are fixture writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { businessDeskFixture, SALVAGE_RECIPE, courierReference, consignmentReference } from './lib/business-control-desk-fixture.js';

const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
assert(executablePath, 'Install Chromium or set CHROMIUM_PATH; the business desk browser proof never skips.');
const f = await businessDeskFixture([{ label: 'desktop' }, { label: 'mobile' }]);
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true });
  for (const [index, viewport] of [{ width: 1280, height: 900 }, { width: 390, height: 844 }].entries()) {
    const s = f.scenarios[index], { maker, first, second, host, buyer } = s.actors;
    const before = await f.snapshot(), errors = [];
    const context = await browser.newContext({ viewport, isMobile: index === 1, hasTouch: index === 1 });
    try {
      await context.addInitScript(token => localStorage.setItem('omerta_token', token), maker.token);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
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
      const idle = () => page.waitForFunction(() => document.body.style.cursor !== 'progress');
      async function refresh() {
        await idle();
        const response = page.waitForResponse(result => result.request().method() === 'GET' && new URL(result.url()).pathname === '/v1/company/desk');
        await desk.locator('[data-business-refresh]').click();
        assert.equal((await response).status(), 200);
      }
      async function action(name, path, body, fields = {}, entityId) {
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
      const input = s.inputs[0], next = s.inputs[1];
      const bought = await action('buy-input', `/v1/market/${input.listingId}/buy`, {}, {}, input.listingId);
      assert.equal(bought.carId, input.carId);
      await action('salvage', SALVAGE_RECIPE + input.carId, {}, {}, input.carId);
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
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'The complete desk fits the viewport.');
      assert.deepEqual(errors, []);
      console.log(`business desk Chromium ${viewport.width}x${viewport.height} PASS: human controls buy/salvage/two-recipe batch/courier consent/dispatch/travel/sale offer/reinvestment; public funded counterparties, canonical balances/title, exact HTTP receipts, no page errors or horizontal overflow`);
    } finally { await context.close(); }
  }
} finally { if (browser) await browser.close(); await f.close(); }
