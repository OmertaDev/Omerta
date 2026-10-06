import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const main = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
const ast = parse(main, { ecmaVersion: 'latest' });
let trophyExpression;
function findTrophy(value) {
  if (!value || typeof value !== 'object') return;
  if (value.type === 'ConditionalExpression' && main.slice(value.test.start, value.test.end) === 'identityBody.nftToken') trophyExpression = value;
  for (const child of Object.values(value)) if (typeof child === 'object') findTrophy(child);
}
findTrophy(ast); assert(trophyExpression, 'Wallet panel renders confirmed NFT state');
function functionSource(name) {
  let found;
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'FunctionDeclaration' && value.id?.name === name) found = value;
    for (const child of Object.values(value)) if (typeof child === 'object') walk(child);
  }
  walk(ast); assert(found, name); return main.slice(found.start, found.end);
}
const readyCalls = [], readyPanel = { innerHTML: '', setAttribute() {} };
const quickView = vm.createContext({ characterCheckoutOnly: true, navigationRevision: 1,
  $: (selector) => selector === '#tab-portfolio' ? readyPanel : {},
  readCharacterReadiness: async () => { readyCalls.push('/v1/identity/readiness'); return { code: 200, body: { ready: true } }; },
  characterCheckoutStep: (action) => action(), characterWalletHtml: () => 'CHARACTER READY', linkWallet() {}, setTab() {}, esc: String,
  refresh: () => { throw Error('The focused view must not wait for finance refresh'); } });
vm.runInContext(functionSource('renderPortfolio') + '\nthis.render = renderPortfolio;', quickView);
const renderingQuickView = quickView.render();
assert(readyPanel.innerHTML.includes('Checking your wallet'), 'Loading feedback is painted before readiness resolves');
await renderingQuickView;
assert.deepEqual(readyCalls, ['/v1/identity/readiness']);
assert(readyPanel.innerHTML.includes('CHARACTER READY'));
let finishFinanceRead;
const delayedFinance = new Promise((resolve) => { finishFinanceRead = resolve; });
const racePanel = { innerHTML: '', setAttribute() {}, querySelector: () => null };
const raceContext = vm.createContext({ characterCheckoutOnly: false, navigationRevision: 1,
  $: (selector) => selector === '#tab-portfolio' ? racePanel : {}, refresh: async () => {},
  api: async (method, path) => path === '/v1/vault' ? delayedFinance : { code: 200, body: {} },
  readCharacterReadiness: async () => ({ code: 200, body: {} }),
  characterCheckoutStep: (action) => action(), characterWalletHtml: () => 'FOCUSED CHARACTER VIEW', linkWallet() {}, setTab() {}, esc: String });
vm.runInContext(functionSource('renderPortfolio') + '\nthis.render = renderPortfolio;', raceContext);
const oldFinanceRender = raceContext.render();
await Promise.resolve();
raceContext.navigationRevision = 2; raceContext.characterCheckoutOnly = true;
await raceContext.render();
finishFinanceRead({ code: 200, body: {} });
await oldFinanceRender;
assert(racePanel.innerHTML.includes('FOCUSED CHARACTER VIEW'), 'Late finance reads cannot overwrite the character checkout or its wallet feedback');
const immediateCalls = [];
const queueContext = vm.createContext({ token: 'fixture', _authQueue: new Promise(() => {}),
  apiNow: async (method, path, body, options) => { assert.equal(options.authToken, 'fixture'); immediateCalls.push(path); return { code: 200 }; },
  projections: { invalidate() {} } });
vm.runInContext(functionSource('api') + functionSource('readCharacterReadiness') + '\nthis.read = readCharacterReadiness; this.queuedRead = api;', queueContext);
assert.equal((await queueContext.read()).code, 200, 'Authenticated read-only readiness bypasses a blocked finance queue');
queueContext.queuedRead('GET', '/v1/vault');
assert.deepEqual(immediateCalls, ['/v1/identity/readiness'], 'Other authenticated reads retain their queue');
let finishOldSessionRead;
queueContext.apiNow = () => new Promise((resolve) => { finishOldSessionRead = resolve; });
const oldSessionRead = queueContext.read(); queueContext.token = 'replacement-session';
finishOldSessionRead({ code: 200, body: { privateAccountFixture: true } });
const ignoredRead = await oldSessionRead;
assert.equal(ignoredRead.code, 499); assert.equal(ignoredRead.body.privateAccountFixture, undefined, 'Direct readiness retains captured-session isolation');
const renderTrophy = (nftToken) => vm.runInNewContext('(' + main.slice(trophyExpression.start, trophyExpression.end) + ')',
  { identityBody: { nftToken, characterMinted: true }, identity: { nftContract: `0x${'44'.repeat(20)}` }, esc: String, encodeURIComponent });
assert(renderTrophy(null).includes('data-character-tx="claim"'));
const confirmedTrophy = renderTrophy({ tokenId: '42', ownerAddress: `0x${'22'.repeat(20)}`, portraitUrl: '/v1/identity/42/portrait.svg' });
assert(confirmedTrophy.includes('NFT #42 confirmed')); assert(confirmedTrophy.includes('/v1/identity/42/portrait.svg'));
assert(!confirmedTrophy.includes('data-character-tx="claim"'), 'Confirmed registry token hides repeated NFT claim');
const start = main.indexOf('  function characterCheckoutStatus(');
const source = main.slice(start, main.indexOf("  document.addEventListener('click'", start));
const tx = { accountId: 'one', from: `0x${'22'.repeat(20)}`, to: `0x${'33'.repeat(20)}`,
  chainId: 4663, chainIdHex: '0x1237', value: '0x3', data: '0x12345678', feeRecipient: `0x${'44'.repeat(20)}` };
const hash = `0x${'55'.repeat(32)}`, store = new Map();
const walletHtmlContext = vm.createContext({ me: { wallet: tx.from }, rules: {}, esc: String, encodeURIComponent,
  localStorage: { getItem: (key) => store.get(key) || null } });
vm.runInContext(functionSource('characterWalletHtml') + '\nthis.renderWallet = characterWalletHtml;', walletHtmlContext);
const readiness = { ready: true, accountId: tx.accountId, chainId: tx.chainId, feesContract: tx.to,
  nftContract: tx.to, feeWei: '10000000000000000', feeRecipient: tx.feeRecipient, nftToken: null };
assert(walletHtmlContext.renderWallet(readiness, 200).includes('data-character-tx="fee"'));
assert(!walletHtmlContext.renderWallet({ ...readiness, hasPaidPortraitFee: true, creditReady: true }, 200).includes('data-character-tx="fee"'));
assert(!walletHtmlContext.renderWallet({ ...readiness, creditReady: true }, 200).includes('data-character-tx="fee"'));
assert(!walletHtmlContext.renderWallet(readiness, 400).includes('data-character-tx='));
store.set(`omerta-character-fee:${tx.accountId}:${tx.chainIdHex}:${tx.from}:${tx.to}`, 'intent:fixture');
assert(!walletHtmlContext.renderWallet(readiness, 200).includes('data-character-tx="fee"'), 'Focused view preserves unknown-payment retry protection');
store.clear();
async function run(options = {}) {
  let sends = 0, requests = 0, accounts = 0, switches = 0, chainReads = 0;
  const toasts = [], calls = [], previews = [], stages = [];
  const status = { set textContent(value) { stages.push(value); } };
  const provider = { request: async ({ method, params }) => {
    calls.push(method);
    if (options.stalledRead === `${method}:${calls.filter((call) => call === method).length}`) return new Promise(() => {});
    if (method === 'wallet_switchEthereumChain') {
      switches++;
      if (options.switchRejected) throw Error('chain switch rejected');
      if (options.addNetwork && switches === 1) throw Object.assign(Error('unknown chain'), { code: 4902 });
      return null;
    }
    if (method === 'wallet_addEthereumChain') { assert.equal(params[0].chainId, '0x1237'); assert.equal(params[0].rpcUrls[0], 'https://rpc.mainnet.chain.robinhood.com/'); return null; }
    if (method === 'eth_requestAccounts') {
      if (options.pendingWalletRequest) throw Object.assign(Error('Request already pending'), { code: -32002 });
      if (options.stalledAccounts) return new Promise(() => {});
      if (options.lateAccounts) await new Promise((resolve) => setTimeout(resolve, 20));
      return [options.wrongWallet ? tx.to : tx.from];
    }
    if (method === 'eth_accounts') { accounts++; return [options.changedWallet ? tx.to : tx.from]; }
    if (method === 'eth_chainId') return (options.changedChain && ++chainReads > 1) || (options.switchDuringFreshApi && requests >= 2) ? '0x1' : tx.chainIdHex;
    if (method === 'eth_getTransactionReceipt') return options.receipt || null;
    if (method === 'eth_sendTransaction') {
      sends++; assert.equal(params[0].from, tx.from); assert.equal(params[0].chainId, tx.chainIdHex);
      if (options.delaySend) await new Promise((resolve) => setTimeout(resolve, 10));
      if (options.cancelled) throw Object.assign(Error('user rejected transaction'), { code: 4001 });
      if (options.responseLost) throw Error('broadcast occurred, wallet response lost'); return hash;
    }
    throw Error(method);
  } };
  const context = vm.createContext({ pickProvider: async () => options.stalledPicker ? new Promise(() => {}) : provider, connectedProvider: null,
    $: () => status, setTimeout: (fn, delay) => setTimeout(fn, delay === 45000 && (options.stalledAccounts || options.lateAccounts || options.stalledPicker || options.stalledRead) ? 5 : delay), clearTimeout,
    characterTransactionsInFlight: new Set(),
    navigator: options.unsupported ? {} : options.lockManager ? { locks: options.lockManager } : { locks: { request: async (name, settings, action) => action(options.lockUnavailable ? null : { name }) } },
    api: async (method, path, body) => { requests++; if (options.reveal) assert.equal(body.purpose, 'reveal'); return { code: 200, body: { ...tx, ...(options.claim ? { value: '0x0' } : {}), ...(options.drift && requests === 2 ? { value: '0x4' } : {}) } }; },
    toast: (value) => toasts.push(value), describe: () => 'unavailable', confirm: (value) => { previews.push(value); return options.confirm !== false; },
    localStorage: { getItem: (key) => store.get(key) || null, setItem: (key, value) => { if (options.storageBlocked) throw Error('storage blocked'); store.set(key, value); }, removeItem: (key) => store.delete(key) } });
  vm.runInContext(source + '\nthis.submit = submitCharacterTransaction;', context);
  if (options.concurrent) await Promise.all([context.submit('fee'), context.submit('fee')]);
  else await context.submit(options.claim ? 'claim' : options.reveal ? 'reveal' : 'fee');
  if (options.lateAccounts) await new Promise((resolve) => setTimeout(resolve, 30));
  return { sends, toasts, calls, accounts, previews, stages };
}
store.clear(); const pendingWallet = await run({ pendingWalletRequest: true });
assert.equal(pendingWallet.sends, 0);
assert(pendingWallet.stages.some((message) => /Open MetaMask and complete or reject/.test(message)));
for (const option of ['stalledPicker', 'stalledAccounts', 'lateAccounts']) {
  store.clear(); const result = await run({ [option]: true });
  assert.equal(result.sends, 0, 'A timed-out connection never continues to a late financial send');
  assert.equal(store.size, 0, 'No payment intent is created before wallet connection succeeds');
  assert(result.stages.some((message) => /did not respond/.test(message)), 'Stalled connection has persistent recovery instructions');
}
for (const stalledRead of ['eth_accounts:1', 'eth_accounts:2', 'eth_chainId:1', 'eth_chainId:2', 'eth_chainId:3']) {
  store.clear(); const result = await run({ stalledRead });
  assert.equal(result.sends, 0, stalledRead);
  assert.equal(store.size, 0, 'Final read timeout happens before payment intent and send');
  assert(result.stages.some((message) => /did not respond/.test(message)), stalledRead);
}
for (const option of ['wrongWallet', 'changedWallet', 'changedChain', 'switchDuringFreshApi', 'drift', 'switchRejected', 'storageBlocked', 'lockUnavailable', 'unsupported']) {
  store.clear(); assert.equal((await run({ [option]: true })).sends, 0, option);
}
store.clear(); assert.equal((await run({ confirm: false })).sends, 0);
store.clear(); assert.equal((await run({ claim: true, unsupported: true })).sends, 1, 'Zero-value trophy claim remains available without payment Web Locks'); assert.equal(store.size, 0);
store.clear(); const added = await run({ addNetwork: true }); assert.equal(added.sends, 1); assert(added.calls.includes('wallet_addEthereumChain'));
store.clear(); const reveal = await run({ reveal: true }); assert.equal(reveal.sends, 1); assert(reveal.previews[0].includes('trophy claim is free'));
store.clear(); assert.equal((await run({ concurrent: true })).sends, 1, 'multiple page buttons share one wallet checkout in flight');
store.clear();
const held = new Set();
const lockManager = { request: async (name, options, action) => {
  if (held.has(name)) return action(null);
  held.add(name); try { return await action({ name }); } finally { held.delete(name); }
} };
const tabs = await Promise.all([run({ lockManager, delaySend: true }), run({ lockManager, delaySend: true })]);
assert.equal(tabs.reduce((count, tab) => count + tab.sends, 0), 1, 'separate page contexts coordinate one payment through shared Web Locks');
store.clear();
assert.equal((await run({ cancelled: true })).sends, 1); assert.equal(store.size, 0, 'cancelled transaction never leaves a pending payment');
assert.equal((await run({ responseLost: true })).sends, 1); assert.equal(store.size, 1);
assert.equal((await run()).sends, 0, 'lost broadcast response retains intent after reload and cannot double pay');
store.clear();
assert.equal((await run()).sends, 1); assert.equal(store.size, 1);
const reload = await run(); assert.equal(reload.sends, 0, 'persisted pending transaction blocks payment after reload');
assert(reload.calls.indexOf('wallet_switchEthereumChain') < reload.calls.indexOf('eth_getTransactionReceipt'));
assert.equal((await run({ receipt: { status: '0x1' } })).sends, 0, 'successful receipt awaits account credit without another fee');
assert.equal((await run({ receipt: { status: '0x0' } })).sends, 1, 'confirmed failed receipt permits reviewed retry');
for (const label of ['Connect wallet', 'Mint your character NFT', 'Sign up &amp; connect wallet', 'Wallet &amp; on-chain']) assert(html.includes(label));
console.log('character wallet: account/chain changes, changed quote, cancellation, disabled storage, persistent pending/reload, failed receipt retry and navigation PASS');
