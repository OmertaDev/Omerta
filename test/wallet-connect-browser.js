// Wallet picker regression with disposable pg-mem and synthetic EIP-1193 providers.
// No installed wallet, public chain, or WalletConnect session is used by this test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { privateKeyToAccount } from 'viem/accounts';
import { buildServer } from './server-fixture.js';

if (process.env.DATABASE_URL) throw new Error('Wallet browser test requires disposable pg-mem; clear DATABASE_URL.');
process.env.RATE_LIMIT = 'off';
process.env.INVITE_MODE = 'off';

function resolveBrowser() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const caches = [...new Set([
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
    process.env.HOME && path.join(process.env.HOME, '.cache', 'ms-playwright'),
  ].filter(Boolean))];
  for (const cache of caches) {
    let versions;
    try { versions = fs.readdirSync(cache).filter((entry) => entry.startsWith('chromium')).sort().reverse(); }
    catch { continue; }
    for (const version of versions) for (const relative of [
      'chrome-win64/chrome.exe', 'chrome-win/chrome.exe',
      'chrome-headless-shell-win64/headless_shell.exe', 'chrome-headless-shell-win/headless_shell.exe',
      'chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-linux/headless_shell',
      'chrome-headless-shell-linux64/headless_shell',
      'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    ]) {
      const candidate = path.join(cache, version, relative);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ].find((candidate) => fs.existsSync(candidate));
}
const executablePath = resolveBrowser();
if (!executablePath || !fs.existsSync(executablePath))
  throw new Error('Wallet browser test cannot find Chromium; set CHROMIUM_PATH to an installed executable.');

const app = await buildServer();
const pool = app.pool;
const artifacts = path.resolve('output/wallet-connect');
fs.mkdirSync(artifacts, { recursive: true });
const pageErrors = [];
let browser;
const call = async (method, url, token, payload) => {
  const response = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload });
  assert.equal(response.statusCode, 200, `${method} ${url}: ${response.body}`);
  return response.json();
};
const createPlayer = async (name) => {
  const { token } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', token, { name });
  return token;
};

// This public test key signs challenges only against the disposable server.
const signer = privateKeyToAccount('0x' + '17'.repeat(32));
const A = signer.address;
const B = '0x' + '22'.repeat(20);
const stubWallets = ({ providers, legacy, token, address }) => {
  if (token) {
    localStorage.setItem('omerta_token', token);
    for (const key of ['omerta_tour2', 'omerta_welcomed', 'omerta_alltabs', 'omerta_seen_portfolio']) localStorage.setItem(key, '1');
  }
  const events = {}, wallets = {}, calls = [];
  for (const config of providers) {
    const listeners = {};
    const provider = {
      mode: 'ok', accounts: [config.address || address],
      on(name, listener) { (listeners[name] ||= []).push(listener); },
      removeListener(name, listener) { listeners[name] = (listeners[name] || []).filter((entry) => entry !== listener); },
      emit(name, payload) { for (const listener of listeners[name] || []) listener(payload); },
      async connect() { calls.push({ id: config.id, method: 'connect' }); },
      async disconnect() { provider.emit('disconnect'); },
      async request({ method, params }) {
        calls.push({ id: config.id, method, params });
        if (method === 'eth_requestAccounts') {
          if (provider.mode === 'refuse') throw Object.assign(new Error('Synthetic wallet request refused.'), { code: 4001 });
          if (provider.mode === 'pending') return new Promise((resolve) => { provider.resolve = resolve; });
          return provider.accounts;
        }
        if (method === 'eth_accounts') return provider.accounts;
        if (method === 'eth_chainId') return '0x1';
        if (method === 'personal_sign') return window.signWalletTestMessage(params[0]);
        if (method === 'wallet_switchEthereumChain') return null;
        throw new Error('Unexpected synthetic wallet method: ' + method);
      },
    };
    wallets[config.id] = provider;
    const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: {
      info: { uuid: config.id, rdns: config.rdns || 'test.' + config.id, name: config.name,
        icon: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Crect width=%2224%22 height=%2224%22 rx=%226%22 fill=%22%238677ee%22/%3E%3C/svg%3E' },
      provider,
    } }));
    events[config.id] = announce;
    if (config.announce !== false) window.addEventListener('eip6963:requestProvider', announce);
  }
  if (legacy) window.ethereum = wallets[legacy];
  else delete window.ethereum;
  window.__walletTest = {
    providers: wallets, calls,
    announce(id, delay = 0) { setTimeout(events[id], delay); },
    settle(id) { wallets[id].resolve?.(wallets[id].accounts); },
    mode(id, value) { wallets[id].mode = value; },
    emit(id, event, value) {
      if (event === 'accountsChanged') wallets[id].accounts = value;
      wallets[id].emit(event, value);
    },
  };
};

try {
  const baseRules = await call('GET', '/v1/rules');
  await app.listen({ port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });
  const open = async ({ providers = [], legacy = null, wc = false, mobile = false, game = false } = {}) => {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, locale: 'en-US' });
    await context.exposeFunction('signWalletTestMessage', (message) => signer.signMessage({ message }));
    const token = game ? await createPlayer('Wallet Browser ' + Math.random().toString(36).slice(2, 8)) : null;
    await context.addInitScript(stubWallets, { providers, legacy, token, address: A });
    await context.route('**/v1/rules', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...baseRules,
      walletConnect: wc ? { projectId: 'synthetic-project', chainId: 1 } : null,
    }) }));
    await context.route('**/vendor/walletconnect.js', (route) => route.fulfill({ contentType: 'application/javascript',
      body: 'export const EthereumProvider = { init: async () => window.__walletTest.providers.wc };',
    }));
    if (!game) {
      // Keep ledger reads deterministic; the real server serves the DeFi page.
      await context.route('**/v1/defi**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic ledger unavailable.' }) }));
    }
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
    await page.goto(base + (game ? '/' : '/defi'), { waitUntil: 'domcontentloaded' });
    if (game) {
      await page.locator('#screen-main:not(.hidden)').waitFor();
      // Existing first-session overlays are unrelated to this wallet flow.
      await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach((modal) => modal.classList.add('hidden')));
      await page.locator('#grouprail [data-group="legit"]').click();
      await page.locator('#tabs [data-tab="portfolio"]').click();
      await page.locator('#wallet-link').waitFor();
    }
    return page;
  };
  const picker = (page) => page.locator('#wallet-dialog');
  const options = (page) => page.locator('#wallet-options .wallet-option');
  const choose = async (page, name) => {
    await page.locator('#connect-wallet').click();
    await picker(page).waitFor({ state: 'visible' });
    await options(page).filter({ hasText: name }).click();
  };
  const connected = async (page, address = A) => {
    await page.waitForFunction((expected) => document.querySelector('#wallet-address').textContent === expected, address);
    assert.equal(await picker(page).isVisible(), false, 'successful connection closes the picker');
  };
  const assertNoRequest = async (page) => assert.deepEqual(await page.evaluate(() => window.__walletTest.calls), [], 'opening the picker does not request wallet access');

  const empty = await open();
  await empty.locator('#connect-wallet').click();
  await picker(empty).waitFor({ state: 'visible' });
  assert.match(await picker(empty).innerText(), /no wallet|no .*wallet.*detected/i);
  assert.equal(await options(empty).count(), 0);
  assert(await empty.locator('#wallet-get a[href^="https://"]').count() >= 2, 'no-wallet state provides install help');
  assert.equal(await options(empty).filter({ hasText: 'WalletConnect' }).count(), 0, 'WalletConnect is omitted without a public project ID');
  await picker(empty).screenshot({ path: path.join(artifacts, 'defi-no-wallet-desktop.png'), animations: 'disabled' });
  await empty.keyboard.press('Escape');
  assert.equal(await picker(empty).isVisible(), false, 'Escape closes wallet picker');
  assert.equal(await empty.locator('#connect-wallet').evaluate((button) => document.activeElement === button), true, 'Escape restores focus');

  const one = await open({ providers: [{ id: 'meta', name: 'MetaMask', rdns: 'io.metamask' }] });
  await one.locator('#connect-wallet').click();
  await picker(one).waitFor({ state: 'visible' });
  assert.equal(await options(one).count(), 1, 'one provider still requires explicit wallet selection');
  await assertNoRequest(one);
  await one.evaluate(() => window.__walletTest.mode('meta', 'refuse'));
  await options(one).first().click();
  await one.locator('#wallet-dialog-status').filter({ hasText: /cancel|refus|reject|declin/i }).waitFor();
  assert.equal(await picker(one).isVisible(), true, 'refusal remains visible inside the picker');
  await one.evaluate(() => window.__walletTest.mode('meta', 'ok'));
  await one.locator('#wallet-retry').click();
  await connected(one);
  await one.evaluate((address) => window.__walletTest.emit('meta', 'accountsChanged', [address]), B);
  await connected(one, B);
  await one.locator('#disconnect-wallet').click();
  assert.equal(await one.locator('#wallet-identity').isVisible(), false, 'disconnect clears wallet identity');
  await choose(one, 'MetaMask');
  await connected(one, B);
  await one.evaluate(() => window.__walletTest.emit('meta', 'accountsChanged', []));
  assert.equal(await one.locator('#wallet-identity').isVisible(), false, 'empty account list disconnects');

  const multi = await open({ providers: [{ id: 'meta', name: 'MetaMask' }, { id: 'rabby', name: 'Rabby' }] });
  await multi.locator('#connect-wallet').click();
  await picker(multi).waitFor({ state: 'visible' });
  assert.equal(await options(multi).count(), 2);
  await assertNoRequest(multi);
  await picker(multi).screenshot({ path: path.join(artifacts, 'defi-wallet-picker-desktop.png'), animations: 'disabled' });
  await options(multi).filter({ hasText: 'Rabby' }).click();
  await connected(multi);
  assert.deepEqual(await multi.evaluate(() => window.__walletTest.calls.map(({ id, method }) => ({ id, method }))),
    [{ id: 'rabby', method: 'eth_requestAccounts' }], 'only the selected wallet receives the access request');
  await multi.evaluate(() => window.__walletTest.emit('rabby', 'disconnect'));
  assert.equal(await multi.locator('#wallet-identity').isVisible(), false, 'provider disconnect clears wallet identity');

  const late = await open({ providers: [{ id: 'late', name: 'Late Wallet', announce: false }] });
  await late.locator('#connect-wallet').click();
  await picker(late).waitFor({ state: 'visible' });
  assert.equal(await options(late).count(), 0);
  await late.evaluate(() => window.__walletTest.announce('late', 30));
  await options(late).filter({ hasText: 'Late Wallet' }).waitFor();
  await assertNoRequest(late);
  await options(late).filter({ hasText: 'Late Wallet' }).click();
  await connected(late);

  const pending = await open({ providers: [{ id: 'pending', name: 'Pending Wallet' }] });
  await pending.evaluate(() => window.__walletTest.mode('pending', 'pending'));
  await choose(pending, 'Pending Wallet');
  await pending.waitForFunction(() => window.__walletTest.calls.some((call) => call.method === 'eth_requestAccounts'));
  await pending.locator('#wallet-dialog .dialog-actions [data-close="wallet-dialog"]').click();
  await pending.evaluate(() => window.__walletTest.settle('pending'));
  await pending.waitForFunction(() => !document.querySelector('#connect-wallet').disabled);
  assert.equal(await pending.locator('#wallet-identity').isVisible(), false, 'a cancelled pending request cannot reconnect after resolving');

  const legacy = await open({ providers: [{ id: 'legacy', name: 'Legacy Wallet', announce: false }, { id: 'wc', name: 'Phone Wallet', announce: false }], legacy: 'legacy', wc: true, mobile: true });
  await legacy.locator('#connect-wallet').click();
  await picker(legacy).waitFor({ state: 'visible' });
  await options(legacy).filter({ hasText: 'WalletConnect' }).waitFor();
  assert.equal(await options(legacy).filter({ hasText: 'WalletConnect' }).count(), 1, 'public WalletConnect config enables the phone option');
  assert.equal(await options(legacy).filter({ hasText: /Browser wallet|Legacy Wallet/i }).count(), 1, 'legacy injection remains selectable beside WalletConnect');
  await picker(legacy).screenshot({ path: path.join(artifacts, 'defi-wallet-picker-mobile.png'), animations: 'disabled' });
  await options(legacy).filter({ hasText: /Browser wallet|Legacy Wallet/i }).click();
  await connected(legacy);
  await legacy.locator('#disconnect-wallet').click();
  await choose(legacy, 'WalletConnect');
  await connected(legacy);
  assert(await legacy.evaluate(() => window.__walletTest.calls.some((call) => call.id === 'wc' && call.method === 'connect')), 'WalletConnect selection uses the configured synthetic provider');

  for (const [name, config] of [
    ['single', { providers: [{ id: 'game', name: 'MetaMask', rdns: 'io.metamask' }] }],
    ['legacy', { providers: [{ id: 'game', name: 'Legacy Wallet', announce: false }, { id: 'wc', name: 'Phone Wallet', announce: false }], legacy: 'game', wc: true }],
  ]) {
    const game = await open({ ...config, game: true, mobile: name === 'legacy' });
    await game.locator('#wallet-link').click();
    await game.locator('#walletpick:not(.hidden)').waitFor();
    const gameOptions = game.locator('#walletpick-list [data-wi]');
    await assertNoRequest(game);
    assert.equal(await gameOptions.filter({ hasText: name === 'single' ? 'MetaMask' : /Browser wallet|Legacy Wallet/i }).count(), 1,
      'game wallet link always presents the chosen browser wallet');
    await game.locator('#walletpick').screenshot({ path: path.join(artifacts, `game-wallet-picker-${name === 'single' ? 'desktop' : 'mobile'}.png`), animations: 'disabled' });
    if (name === 'single') {
      let challenges = 0;
      game.on('request', (request) => { if (request.url().endsWith('/v1/wallet/challenge')) challenges++; });
      await game.evaluate(() => window.__walletTest.mode('game', 'pending'));
      await gameOptions.filter({ hasText: 'MetaMask' }).click();
      await game.waitForFunction(() => window.__walletTest.calls.some((call) => call.method === 'eth_requestAccounts'));
      await game.locator('#walletpick-cancel').click();
      await game.evaluate(() => window.__walletTest.settle('game'));
      await game.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(challenges, 0, 'cancelling a pending game connection cannot request a signing challenge');
      assert.equal(await game.locator('#walletpick').isVisible(), false);
      await game.locator('#wallet-link').click();
      await game.locator('#walletpick:not(.hidden)').waitFor();
      await game.evaluate(() => window.__walletTest.mode('game', 'refuse'));
      await gameOptions.filter({ hasText: 'MetaMask' }).click();
      await game.locator('#walletpick-status').filter({ hasText: /cancel|refus|reject|declin/i }).waitFor();
      assert.equal(await game.locator('#walletpick').isVisible(), true, 'game wallet refusal keeps inline recovery available');
      await game.evaluate(() => window.__walletTest.mode('game', 'ok'));
      const verification = game.waitForResponse((response) => response.url().endsWith('/v1/wallet/verify') && response.request().method() === 'POST');
      await gameOptions.filter({ hasText: 'MetaMask' }).click();
      const verified = await verification;
      assert.equal(verified.status(), 200, await verified.text());
      assert.equal(challenges, 1, 'retry requests exactly one signing challenge');
      assert.equal(Number((await pool.query('SELECT count(*) AS n FROM account_persistent WHERE lower(wallet_address)=lower($1)', [A])).rows[0].n), 1,
        'the selected synthetic wallet is linked by the real server signature verifier');
    } else await game.locator('#walletpick-cancel').click();
    assert.equal(await game.locator('#walletpick').isVisible(), false);
    await game.context().close();
  }
  assert.deepEqual(pageErrors, [], 'wallet picker flows have no unhandled browser errors');
  console.log(`wallet browser: real DeFi discovery, explicit selection, retry, cancellation, account changes, disconnect, WalletConnect gating, game entry and signature verification passed; screenshots ${artifacts}`);
} finally {
  await browser?.close();
  await app.close();
  await pool.end();
}
