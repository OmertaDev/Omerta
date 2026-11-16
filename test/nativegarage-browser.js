// Real game shell, disposable pg-mem, synthetic chain projections and EIP-1193 wallet.
// This checks browser transaction handling; it never sends a public-chain transaction.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { encodeFunctionData, parseAbi } from 'viem';
import { buildServer } from './server-fixture.js';

if (process.env.DATABASE_URL) throw new Error('Native garage browser checks require disposable pg-mem.');
process.env.RATE_LIMIT = 'off';
process.env.INVITE_MODE = 'off';

const executablePath = process.env.CHROMIUM_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(candidate => fs.existsSync(candidate));
assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser.');
const A = '0x' + '11'.repeat(20), B = '0x' + '22'.repeat(20);
const hash = '0x' + 'ab'.repeat(32), profileId = '0x' + 'cd'.repeat(32);
const manifestHash = '0x' + 'ef'.repeat(32);
const contracts = Object.fromEntries(['engine', 'module', 'drand', 'rules', 'omr', 'house'].map((name, index) => [name, '0x' + String(index + 3).repeat(40)]));
const chainId = 31337;
const planAbi = parseAbi([
  'function requestGta(bytes32 id)', 'function salvage(bytes32 id,uint256 carTokenId)',
  'function approve(address spender,uint256 amount)', 'function harden(bytes32 id,uint256 batches)',
  'function craft(bytes32 id)',
]);
const planData = payload => encodeFunctionData({ abi: planAbi, functionName: payload.action,
  args: payload.action === 'approve' ? [contracts.module, 600000000000000000n]
    : payload.action === 'salvage' ? [profileId, BigInt(payload.args.tokenId)]
      : payload.action === 'harden' ? [profileId, BigInt(payload.args.batches)] : [profileId] });
const artifacts = path.resolve('output/native-garage-ui');
fs.mkdirSync(artifacts, { recursive: true });
const app = await buildServer(), faults = [], checks = [];
let browser;
async function call(method, url, token, payload) {
  const response = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal(response.statusCode, 200, `${method} ${url}: ${response.body}`);
  return response.json();
}
const config = enabled => ({ enabled, configured: enabled, status: enabled ? 'ready' : 'disabled', reason: enabled ? null : 'Onchain garage is not enabled on this server.', chainId, manifestHash, contracts, explorer: null });
function board(fixture) {
  return { ...config(fixture.enabled), wallet: A,
    profile: { id: profileId, wallet: A, claimed: true, retired: false, level: 8 },
    confirmedBlock: { number: '120', hash: '0x' + '12'.repeat(32), timestamp: '1794700000' },
    energy: { micros: '66000000', capMicros: '66000000', nextGtaAtMs: '0', jailUntilMs: '0' },
    pending: null, materials: { scrap: fixture.confirmed ? '6' : fixture.scrap || '0', wire: '0', steel: '0', parts: '0' },
    omr: { balance: '9000000000000000000', allowance: fixture.approved ? '600000000000000000' : '0', hardeningCostWei: '600000000000000000' },
    cars: fixture.confirmed ? [] : fixture.cars, tools: [], availableActions: fixture.actions,
    indexing: { status: 'ready', cursorBlock: '120', targetBlock: '120', more: false } };
}
function walletStub({ token, address, chain }) {
  localStorage.setItem('omerta_token', token);
  for (const key of ['omerta_tour2', 'omerta_welcomed', 'omerta_alltabs', 'omerta_seen_portfolio']) localStorage.setItem(key, '1');
  const listeners = {}, state = { address, chain, mode: 'ok', calls: [] };
  const provider = {
    on(name, listener) { (listeners[name] ||= []).push(listener); },
    removeListener(name, listener) { listeners[name] = (listeners[name] || []).filter(fn => fn !== listener); },
    async request({ method, params }) {
      const entry = { method, params }; state.calls.push(entry); await window.recordNativeWalletCall(entry);
      if (method === 'eth_accounts' && state.pauseAccounts) {
        state.pauseAccounts = false;
        return new Promise(resolve => { state.releaseAccounts = () => resolve([state.address]); });
      }
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [state.address];
      if (method === 'eth_chainId') return '0x' + state.chain.toString(16);
      if (method === 'wallet_switchEthereumChain') {
        if (state.mode === 'wrong-chain') return null;
        state.chain = Number(params[0].chainId); return null;
      }
      if (method === 'eth_sendTransaction') {
        if (state.mode === 'reject') throw Object.assign(new Error('Synthetic transaction rejected.'), { code: 4001 });
        return '0x' + 'ab'.repeat(32);
      }
      throw new Error('Unexpected native garage wallet method: ' + method);
    },
  };
  const announce = () => dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: {
    info: { uuid: 'native-browser', rdns: 'test.native-garage', name: 'Native test wallet', icon: '' }, provider,
  } }));
  addEventListener('eip6963:requestProvider', announce);
  window.__nativeWallet = { state, emit(name, value) {
    if (name === 'accountsChanged') state.address = value[0];
    if (name === 'chainChanged') state.chain = Number(value);
    for (const fn of listeners[name] || []) fn(value);
  } };
}

try {
  const { token } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', token, { name: 'Native Garage Browser' });
  const originalMe = (await call('GET', '/v1/me', token)).character;
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });
  async function open({ enabled = true, migrated = true, mobile = false, address = A, chain = chainId } = {}) {
    const fixture = { enabled, migrated, confirmed: false, approved: false, receiptStatus: 'pending', calls: [], prepares: [], reads: 0,
      actions: ['requestGta', 'approve', 'harden', 'craft'], cars: [] };
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.exposeFunction('recordNativeWalletCall', entry => fixture.calls.push(entry));
    await context.addInitScript(walletStub, { token, address, chain });
    await context.route('**/v1/me', route => route.fulfill({ status: fixture.authInvalid ? 401 : 200, contentType: 'application/json', body: JSON.stringify(fixture.authInvalid ? { error: 'token_revoked' } : { character: { ...originalMe, wallet: A, onchainCrafting: migrated,
      cars: [{ id: 'stale-sql-car', model: 'Frozen SQL car', dmg: 0 }],
    } }) }));
    await context.route('**/v1/projections/player', async route => {
      if (fixture.authInvalid) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'token_revoked' }) });
      const response = await route.fetch();
      if (!response.ok()) return route.fulfill({ response });
      const body = await response.json();
      const decorate = character => ({ ...character, wallet: A, onchainCrafting: migrated,
        cars: [{ id: 'stale-sql-car', model: 'Frozen SQL car', dmg: 0 }],
      });
      if (body.player?.character) body.player.character = decorate(body.player.character);
      else body.player = decorate(body.player);
      await route.fulfill({ response, body: JSON.stringify(body) });
    });
    await context.route('**/v1/session', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ authed: true, accountId: originalMe.id, hasCharacter: true, wallet: A }) }));
    await context.route('**/v1/native-garage**', async route => {
      const request = route.request(), url = new URL(request.url());
      let response;
      if (url.pathname.endsWith('/config')) response = config(enabled);
      else if (url.pathname.endsWith('/prepare')) {
        const payload = request.postDataJSON(); fixture.prepares.push(payload);
        const to = payload.action === 'approve' ? contracts.omr : payload.action === 'requestGta' ? contracts.engine : contracts.module;
        fixture.plan = { chainId, from: A, to, data: planData(payload), value: '0x0', action: payload.action, manifestHash, profileId, summary: 'Synthetic ' + payload.action,
          preparedBlock: { number: '120', hash: '0x' + '12'.repeat(32) }, validUntilMs: String(Date.now() + 60000) };
        response = fixture.plan;
      } else if (url.pathname.includes('/receipt/')) {
        response = { hash, status: fixture.receiptStatus, confirmations: fixture.receiptStatus === 'confirmed' ? '2' : '0', requiredConfirmations: 2,
          blockNumber: fixture.receiptStatus === 'confirmed' ? '120' : null, blockHash: fixture.receiptStatus === 'confirmed' ? '0x' + '12'.repeat(32) : null,
          transaction: fixture.plan ? { chainId, from: A, to: fixture.plan.to, data: fixture.plan.data, value: '0x0' } : null, link: null };
      } else { fixture.reads++; response = board(fixture); }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => faults.push(error.stack || error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('#screen-main:not(.hidden)').waitFor();
    await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(node => node.classList.add('hidden')));
    if (!migrated) await page.locator('#tab-control-garage').evaluate(node => node.click());
    await page.locator('#native-garage').waitFor();
    return { page, fixture, context };
  }
  async function chooseWallet(page) {
    const picker = page.locator('#walletpick:not(.hidden)');
    await picker.waitFor();
    await picker.locator('button').filter({ hasText: 'Native test wallet' }).click();
    await page.locator('#walletpick').waitFor({ state: 'hidden' });
  }
  const action = (page, name) => page.locator(`[data-ng-action="${name}"]`).first();
  const sent = fixture => fixture.calls.filter(entry => entry.method === 'eth_sendTransaction');
  const pendingStored = page => page.evaluate(() => Object.keys(sessionStorage).some(key => key.startsWith('omerta:native-garage:v1:')));
  const check = name => { checks.push(name); console.log('PASS ' + name); };

  const disabledLane = await open({ enabled: false, migrated: false });
  await disabledLane.page.locator('#native-garage .ng-unavailable').waitFor();
  assert.match(await disabledLane.page.locator('#native-garage').innerText(), /not enabled|not connected/i);
  assert.equal(await disabledLane.page.locator('[data-do="POST /v1/garage/boost"]').count(), 1, 'unmigrated city garage remains available');
  await disabledLane.page.locator('#tab-garage [data-ux-rules]').waitFor();
  await disabledLane.page.locator('#tab-garage [data-ux-progression="context-trades"]').waitFor();
  assert.equal(disabledLane.fixture.calls.length, 0, 'disabled lane never asks for a wallet');
  assert.equal(disabledLane.fixture.prepares.length, 0);
  check('disabled by default and separate city lane');
  await disabledLane.context.close();

  const migratedLane = await open();
  await action(migratedLane.page, 'requestGta').waitFor();
  assert.equal(await migratedLane.page.locator('[data-do="POST /v1/garage/boost"]').count(), 0);
  assert.equal(await migratedLane.page.locator('#tab-garage > .ux-identity').count(), 0, 'frozen SQL showroom is excluded from live chain garage');
  assert.equal(await migratedLane.page.locator('#tab-garage [data-ux-rules]').count(), 0, 'legacy theft rules are excluded from native garage');
  assert.equal(await migratedLane.page.locator('#tab-garage [data-ux-progression="context-trades"]').count(), 0, 'native GTA does not promise SQL mastery gains');
  assert.doesNotMatch(await migratedLane.page.locator('#tab-garage').innerText(), /Frozen SQL car/);
  assert.match(await migratedLane.page.locator('.ng-energy').innerText(), /66/);
  await migratedLane.page.locator('#tab-control-start').evaluate(node => node.click());
  await migratedLane.page.locator('.strategy-current-order button').waitFor();
  assert.match(await migratedLane.page.locator('.strategy-current-order').innerText(), /onchain garage/i);
  await migratedLane.page.locator('.strategy-current-order button').click();
  await migratedLane.page.locator('#tab-garage.on #native-garage').waitFor();
  await migratedLane.page.screenshot({ path: path.join(artifacts, 'desktop.png'), fullPage: true });
  check('migrated shell lands in chain garage and avoids stale SQL ownership');
  await migratedLane.context.close();

  const rejected = await open();
  await action(rejected.page, 'requestGta').waitFor();
  await rejected.page.evaluate(() => { __nativeWallet.state.mode = 'reject'; });
  await action(rejected.page, 'requestGta').click();
  await chooseWallet(rejected.page);
  await rejected.page.waitForFunction(() => /declined|rejected|cancelled/i.test(document.querySelector('#native-garage').innerText));
  assert.equal(sent(rejected.fixture).length, 1);
  assert.equal(await pendingStored(rejected.page), false, 'explicit rejection does not leave a broadcast pending record');
  assert.equal(await rejected.page.locator('.ng-fleet [data-ng-car]').count(), 0);
  check('existing picker and explicit wallet rejection');
  await rejected.context.close();

  const wrongWallet = await open({ address: B });
  await action(wrongWallet.page, 'requestGta').waitFor();
  await action(wrongWallet.page, 'requestGta').click();
  await chooseWallet(wrongWallet.page);
  await wrongWallet.page.locator('#native-garage [role="alert"]').waitFor();
  assert.match(await wrongWallet.page.locator('#native-garage [role="alert"]').innerText(), /wallet|account|address/i);
  assert.equal(sent(wrongWallet.fixture).length, 0, 'wrong wallet cannot send the plan');
  check('wrong selected wallet is visible and cannot send');
  await wrongWallet.context.close();

  const wrongChain = await open({ chain: 1 });
  await action(wrongChain.page, 'requestGta').waitFor();
  await wrongChain.page.evaluate(() => { __nativeWallet.state.mode = 'wrong-chain'; });
  await action(wrongChain.page, 'requestGta').click();
  await chooseWallet(wrongChain.page);
  await wrongChain.page.locator('#native-garage [role="alert"]').waitFor();
  assert.match(await wrongChain.page.locator('#native-garage [role="alert"]').innerText(), /chain|network/i);
  assert.equal(sent(wrongChain.fixture).length, 0);
  check('wrong network cannot send');
  await wrongChain.context.close();

  const changedSession = await open();
  await action(changedSession.page, 'requestGta').waitFor();
  await changedSession.page.evaluate(() => { __nativeWallet.state.pauseAccounts = true; });
  await action(changedSession.page, 'requestGta').click();
  await chooseWallet(changedSession.page);
  await changedSession.page.waitForFunction(() => typeof __nativeWallet.state.releaseAccounts === 'function');
  changedSession.fixture.authInvalid = true;
  await changedSession.page.locator('#btn-refresh').evaluate(node => node.click());
  await changedSession.page.locator('#screen-auth:not(.hidden)').waitFor();
  await changedSession.page.evaluate(() => { __nativeWallet.state.releaseAccounts(); });
  await changedSession.page.waitForFunction(() => /session changed/i.test(document.querySelector('#native-garage')?.textContent || ''));
  assert.equal(sent(changedSession.fixture).length, 0, 'expired session cannot reuse selectedWallet while wallet access is pending');
  assert.equal(changedSession.fixture.prepares.length, 0);
  check('session expiration invalidates an in-flight wallet selection');
  await changedSession.context.close();

  const salvage = await open();
  salvage.fixture.cars = [{ tokenId: '7', owner: A, modelIndex: 0, modelName: 'Junker', trimName: 'Stock', damage: 17, rarityName: 'Common' }];
  salvage.fixture.actions.push('salvage');
  await salvage.page.locator('[data-ng-refresh]').click();
  await action(salvage.page, 'salvage').waitFor();
  await action(salvage.page, 'salvage').click();
  await chooseWallet(salvage.page);
  await salvage.page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.startsWith('omerta:native-garage:v1:')));
  assert.equal(sent(salvage.fixture).length, 1);
  assert.equal(await salvage.page.locator('.ng-materials div').filter({ hasText: /^Scrap/ }).locator('dd').innerText(), '0', 'broadcast does not credit salvage');
  assert.equal(await salvage.page.locator('[data-ng-car="7"]').count(), 1, 'broadcast does not remove confirmed car');
  assert.equal(await action(salvage.page, 'salvage').isDisabled(), true);
  const readsBeforeConfirmation = salvage.fixture.reads;
  salvage.fixture.confirmed = true; salvage.fixture.receiptStatus = 'confirmed';
  await salvage.page.waitForFunction(() => [...document.querySelectorAll('.ng-materials div')].some(node => node.querySelector('dt')?.textContent === 'Scrap' && node.querySelector('dd')?.textContent === '6'));
  assert.ok(salvage.fixture.reads > readsBeforeConfirmation, 'confirmation rereads authoritative board');
  assert.equal(await salvage.page.locator('[data-ng-car="7"]').count(), 0);
  assert.equal(sent(salvage.fixture).length, 1);
  check('hash pending confirmation and authoritative refetch without optimistic credits');
  await salvage.context.close();

  const approval = await open();
  approval.fixture.scrap = '4';
  await approval.page.locator('[data-ng-refresh]').click();
  await action(approval.page, 'approve').waitFor();
  assert.equal(await action(approval.page, 'harden').count(), 0, 'approval is its own action');
  await action(approval.page, 'approve').click();
  await chooseWallet(approval.page);
  await approval.page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.startsWith('omerta:native-garage:v1:')));
  approval.fixture.approved = true; approval.fixture.receiptStatus = 'confirmed';
  await action(approval.page, 'harden').waitFor();
  assert.equal(approval.fixture.prepares.length, 1);
  assert.equal(approval.fixture.prepares[0].action, 'approve');
  assert.equal(sent(approval.fixture).length, 1, 'approval never auto-sends hardening');
  assert.equal(approval.fixture.plan.to, contracts.omr);
  check('exact OMR approval remains distinct from paid hardening');
  await approval.context.close();

  const recovery = await open();
  await action(recovery.page, 'requestGta').waitFor();
  await action(recovery.page, 'requestGta').click();
  await chooseWallet(recovery.page);
  await recovery.page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.startsWith('omerta:native-garage:v1:')));
  await recovery.page.locator('#tab-control-start').evaluate(node => node.click());
  await recovery.page.locator('#tab-control-garage').evaluate(node => node.click());
  await recovery.page.locator('#native-garage [data-ng-status]').waitFor();
  assert.equal(sent(recovery.fixture).length, 1, 'tab navigation never resends');
  await recovery.page.reload({ waitUntil: 'domcontentloaded' });
  await recovery.page.locator('#native-garage').waitFor();
  await recovery.page.locator('[data-ng-resume]').waitFor();
  assert.equal(sent(recovery.fixture).length, 1, 'reload checks the stored hash without another send');
  recovery.fixture.receiptStatus = 'confirmed';
  await recovery.page.locator('[data-ng-resume]').click();
  await recovery.page.waitForFunction(() => !Object.keys(sessionStorage).some(key => key.startsWith('omerta:native-garage:v1:')));
  assert.equal(sent(recovery.fixture).length, 1);
  check('pending transaction survives tab navigation and reload without replay');
  await recovery.context.close();

  const mobile = await open({ mobile: true });
  await action(mobile.page, 'requestGta').waitFor();
  await mobile.page.screenshot({ path: path.join(artifacts, 'mobile.png'), fullPage: true });
  mobile.fixture.cars = [{ tokenId: '9', owner: A, modelIndex: 0, modelName: '<img src=x onerror="window.nativeXss=1">', trimName: '<svg onload="window.nativeXss=2">', damage: 2, rarityName: 'Common' }];
  await mobile.page.locator('[data-ng-refresh]').click();
  await mobile.page.locator('[data-ng-car="9"]').waitFor();
  assert.equal(await mobile.page.locator('#native-garage img, #native-garage svg').count(), 0);
  assert.equal(await mobile.page.evaluate(() => window.nativeXss), undefined);
  assert.match(await mobile.page.locator('[data-ng-car="9"]').innerText(), /<img src=x/);
  const dimensions = await mobile.page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.width + 1, `mobile overflow: ${JSON.stringify(dimensions)}`);
  await mobile.page.screenshot({ path: path.join(artifacts, 'security-xss.png'), fullPage: true });
  check('mobile layout and chain strings render as text');
  await mobile.context.close();
  assert.deepEqual(faults, [], 'browser has no uncaught page errors');
  console.log(`PASS native garage browser: ${checks.length} groups`);
} catch (error) {
  const page = browser?.contexts().flatMap(context => context.pages()).at(-1);
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(artifacts, 'failure.html'), await page.content().catch(() => ''));
  }
  throw error;
} finally {
  fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({ checks, faults }, null, 2) + '\n');
  await browser?.close();
  await app.close();
}
