// Component-only consent lifecycle proof. DTOs below are illustrative records,
// not a substitute for the real HTTP/PostgreSQL economic journey.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright-core';

const script = fs.readFileSync(new URL('../public/business-control-desk.js', import.meta.url));
const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
assert(executablePath, 'Install Chromium or set CHROMIUM_PATH; consent checks never skip.');
const server = http.createServer((request, response) => {
  response.setHeader('Content-Type', request.url === '/business-control-desk.js' ? 'text/javascript' : 'text/html');
  response.end(request.url === '/business-control-desk.js' ? script : '<!doctype html><title>Business consent component proof</title><div id="desk"></div><script src="/business-control-desk.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true });
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(() => {
      const character = { id: 'character:owner', generation: 1, loc: 'foundry', cash: '10000', bank: '0', cars: [] };
      const proof = window.__consentProof = { account: 'account:owner', character, acts: [], failUnknown: false, holdProbe: false };
      const row = { networkId: 'network:component', sourceHash: 'a'.repeat(64), itemId: 'tool:network', status: 'ready',
        ownerOriginal: character.id, firstOriginal: 'character:first', secondOriginal: 'character:second',
        origin: 'foundry', handoff: 'docks', destination: 'neon', firstFee: 30, secondFee: 40,
        firstConsent: true, secondConsent: true, expiresAt: new Date(Date.now() + 3600000).toISOString() };
      proof.records = {
        '/v1/company/desk': { currency: 'game_cash', character: { id: character.id, cash: '10000', bank: '0' },
          cashflow: { totalsScope: 'returned_rows', income: '0', outflow: '0', netCashflow: '0', rows: [] } },
        '/v1/worldgraph/inventory': { stacks: [], items: [{ id: 'tool:free', templateId: 'item:precision_lock_tool', state: 'active', escrowed: false }] },
        '/v1/worldgraph/recipes': { recipes: [] }, '/v1/market': { listings: [] }, '/v1/depot': { depot: null },
        '/v1/depots': { enabled: false, catalog: {}, businesses: [] }, '/v1/resources/company': { company: null },
        '/v1/company/operator': { operators: [] }, '/v1/company/production': { recipes: [], receipts: [] },
        '/v1/company/courier-networks': { networks: [row] }, '/v1/consignments': { rows: [] },
      };
      const api = async (method, path) => {
        if (method !== 'GET') throw Error('The component fixture permits only reads.');
        if (path === '/v1/session') {
          if (proof.holdProbe) { proof.probeHeld = true; await new Promise(resolve => { proof.releaseProbe = resolve; }); }
          return { code: 200, body: { authed: true, accountId: proof.account, character: structuredClone(proof.character) } };
        }
        return { code: 200, body: structuredClone(path === '/v1/me' ? { character: proof.character } : proof.records[path]) };
      };
      proof.controller = window.OmertaBusinessDesk.mount(document.getElementById('desk'), {
        identity: proof.account, character, api, isActive: () => true,
        act: async (method, path, body, options) => {
          proof.acts.push({ method, path, body: structuredClone(body), key: options.idempotencyKey });
          return { code: proof.failUnknown ? 503 : 409, body: { error: 'component_no_game_writes' } };
        },
      });
      proof.refresh = () => proof.controller.update({});
      proof.row = row;
    });
    const idle = () => page.locator('.business-body[aria-busy="false"]').waitFor();
    const dispatch = page.locator('form[data-business-form="courier-dispatch-courier"]');
    const cancel = page.locator('form[data-business-form="courier-cancel-courier"]');
    const offer = page.locator('form[data-business-form="courier"]');
    const consent = form => form.locator('[name="consent"]');
    const refresh = async () => { await page.evaluate(() => window.__consentProof.refresh()); await idle(); };
    await idle();
    assert.equal(await consent(dispatch).isChecked(), false, 'No initial consent is inferred.');
    await consent(dispatch).check();
    await refresh();
    assert.equal(await consent(dispatch).isChecked(), true, 'Harmless same-actor refresh preserves explicit exact-terms consent.');
    assert.equal(await consent(cancel).isChecked(), false, 'Consent never transfers to another action on the same row.');
    for (const change of [{ sourceHash: 'b'.repeat(64) }, { firstFee: 31 }, { handoff: 'brick' }, { expiresAt: new Date(Date.now() + 7200000).toISOString() }]) {
      await page.evaluate(change => { Object.assign(window.__consentProof.row, change); window.__consentProof.refresh(); }, change);
      await idle();
      assert.equal(await consent(dispatch).isChecked(), false, 'Changed source or displayed terms require fresh consent.');
      await consent(dispatch).check();
    }
    await offer.locator('[name="firstCarrier"]').fill('account:first');
    await offer.locator('[name="secondCarrier"]').fill('account:second');
    await consent(offer).check();
    await refresh();
    assert.equal(await consent(offer).isChecked(), true, 'Ordinary form values and their explicit consent survive unchanged refresh.');
    assert.equal(await offer.locator('[name="firstCarrier"]').inputValue(), 'account:first');
    await offer.locator('[name="firstFee"]').fill('35');
    assert.equal(await consent(offer).isChecked(), false, 'Editing an input clears its consent immediately.');
    await consent(offer).check();
    await offer.locator('[name="handoff"]').selectOption('brick');
    assert.equal(await consent(offer).isChecked(), false, 'Changing a selection clears consent.');

    await page.evaluate(() => { window.__consentProof.holdProbe = true; window.__consentProof.probeHeld = false; });
    await dispatch.locator('[data-business-action="dispatch-courier"]').click();
    await page.waitForFunction(() => window.__consentProof.probeHeld);
    assert.equal(await consent(dispatch).isChecked(), false, 'Submission consumes consent before dispatch.');
    await page.evaluate(() => { const proof = window.__consentProof; proof.holdProbe = false; proof.releaseProbe(); });
    await page.waitForFunction(() => window.__consentProof.acts.length === 1);
    await idle();
    assert.equal(await consent(dispatch).isChecked(), false, 'A known result never rechecks a form.');
    await dispatch.locator('[data-business-action="dispatch-courier"]').click();
    assert.equal(await page.evaluate(() => window.__consentProof.acts.length), 1, 'Unchecked consent blocks a new request.');
    const first = await page.evaluate(() => window.__consentProof.acts[0]);
    assert.deepEqual(first.body, { networkId: 'network:component', sourceHash: 'b'.repeat(64), consent: true });

    await consent(dispatch).check();
    await page.evaluate(() => { window.__consentProof.failUnknown = true; });
    await dispatch.locator('[data-business-action="dispatch-courier"]').click();
    await page.locator('[data-business-retry]').waitFor();
    await refresh();
    assert.equal(await consent(dispatch).isChecked(), false, 'Unknown outcome does not leave fresh form consent.');
    assert.equal(await dispatch.locator('[data-business-action="dispatch-courier"]').isDisabled(), true);
    await page.evaluate(() => { window.__consentProof.failUnknown = false; });
    await page.locator('[data-business-retry]').click();
    await page.waitForFunction(() => window.__consentProof.acts.length === 3);
    await idle();
    const retryActs = await page.evaluate(() => window.__consentProof.acts.slice(1));
    assert.deepEqual(retryActs[1], retryActs[0], 'Recovery retains only the exact previously authorized body and idempotency key.');

    await consent(dispatch).check();
    await page.evaluate(() => {
      const proof = window.__consentProof;
      proof.account = 'account:new-owner'; proof.character = { ...proof.character, id: 'character:new-owner', generation: 2 };
      proof.row.ownerOriginal = proof.character.id; proof.records['/v1/company/desk'].character.id = proof.character.id;
      proof.controller.update({ identity: proof.account, character: proof.character });
    });
    await idle();
    assert.equal(await consent(dispatch).isChecked(), false, 'New account or character never inherits consent.');
    assert.deepEqual(pageErrors, []);
    await page.evaluate(() => window.__consentProof.controller.destroy());
    await page.close();
  }
  console.log('business desk component consent: desktop/mobile exact refresh, term/input/actor refusal, submit consumption and exact unknown-result recovery passed');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
