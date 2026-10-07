import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { keccak256, stringToHex } from 'viem';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const main = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
const ast = parse(main, { ecmaVersion: 'latest' });
const sources = new Map();
function source(name) {
  if (sources.has(name)) return sources.get(name);
  let found;
  function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'FunctionDeclaration' && n.id?.name === name) found = n;
    for (const v of Object.values(n)) if (typeof v === 'object') walk(v);
  }
  walk(ast); assert(found, name); const text = main.slice(found.start, found.end); sources.set(name, text); return text;
}
const A = `0x${'22'.repeat(20)}`, TO = `0x${'33'.repeat(20)}`, HASH = `0x${'44'.repeat(32)}`;
const BLOCK_HASH = `0x${'66'.repeat(32)}`, OTHER_BLOCK_HASH = `0x${'77'.repeat(32)}`;
const KEY = 'omerta:genesis:4663:' + A, ETH = '0xde0b6b3a7640000';
const TOPIC = '0x650baad5cd8ca09b8f580be220fa04ce2ba905a041f764b6a3fe2c848eb70540';
assert.equal(TOPIC, keccak256(stringToHex('BidSubmitted(uint256,address,uint256,uint128)')), 'Reviewed auction event signature pins topic0');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const pause = ms => new Promise(r => setTimeout(r, ms));
function locks() {
  const held = new Set();
  return { request: async (key, options, action) => {
    assert.equal(options.ifAvailable, true);
    if (held.has(key)) return action(null);
    held.add(key); try { return await action({ key }); } finally { held.delete(key); }
  } };
}
function fixture(o = {}, shared = {}) {
  const store = shared.store || new Map(), lockManager = shared.locks || locks();
  const nodes = Object.fromEntries(['genesis-amount', 'genesis-min-omr', 'genesis-bid-id', 'genesis-last-full', 'genesis-outbid', 'player-genesis-status', 'character-checkout-status']
    .map(k => [k, { value: k === 'genesis-amount' ? '1' : k === 'genesis-min-omr' ? '100' : '', textContent: '' }]));
  const calls = [], confirms = [], messages = [], quotes = [];
  let sends = 0, quoteCount = 0, accountReads = 0, chainReads = 0, receiptReads = 0, blockReads = 0, headReads = 0;
  const tx = { action: 'bid', chainId: 4663, chainIdHex: '0x1237', from: A, to: TO, data: '0x12345678', value: ETH, validUntil: '2099-01-01T00:00:00.000Z' };
  const provider = { request: async ({ method, params }) => {
    calls.push(method);
    if (o.stall === `${method}:${calls.filter(x => x === method).length}`) {
      if (o.late) { await pause(20); } else return new Promise(() => {});
    }
    if (method === 'eth_requestAccounts') return [A];
    if (method === 'wallet_switchEthereumChain') return null;
    if (method === 'eth_accounts') { accountReads++; return [o.changedAccount ? TO : A]; }
    if (method === 'eth_chainId') { chainReads++; return o.changedChain && chainReads > 1 ? '0x1' : '0x1237'; }
    if (method === 'eth_sendTransaction') {
      sends++; assert.equal(store.has(KEY), true, 'Intent must exist before financial wallet send');
      assert.equal(params[0].chainId, '0x1237');
      if (o.delaySend) await o.delaySend;
      if (o.sendError) throw Object.assign(Error('wallet request failed'), { code: o.sendError });
      return o.noHash ? undefined : HASH;
    }
    if (method === 'eth_getTransactionReceipt') { receiptReads++; if (o.receiptRead) return o.receiptRead(receiptReads); return o.receipt || null; }
    if (method === 'eth_blockNumber') { headReads++; return o.shrunkHead && headReads > 1 ? '0x68' : o.head || '0x69'; }
    if (method === 'eth_getBlockByNumber') {
      blockReads++; assert.deepEqual(Array.from(params), ['0x64', false]);
      if (o.missingBlock) return null;
      return { number: '0x64', hash: o.orphaned || (o.reorgDuringValidation && blockReads > 1) ? OTHER_BLOCK_HASH : BLOCK_HASH };
    }
    if (method === 'eth_getTransactionByHash') return { ...tx, input: tx.data, hash: HASH, blockHash: BLOCK_HASH, blockNumber: '0x64',
      ...(o.wrongTx ? { from: TO } : {}), ...(o.sentOverride || {}) };
    throw Error(method);
  } };
  const context = vm.createContext({
    pickWalletProvider: async () => o.stalledPicker ? new Promise(() => {}) : provider,
    $: selector => nodes[selector.replace(/^#/, '')], genesisTransactionsInFlight: new Set(),
    navigator: { locks: lockManager },
    localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    setTimeout: (fn, delay) => setTimeout(fn, delay === 45000 ? 5 : delay), clearTimeout,
    toast: m => messages.push(m), confirm: m => { confirms.push(m); return o.cancelConfirm ? false : true; },
    api: async (method, path, input) => {
      assert(path.startsWith('/v1/genesis-auction'), 'Only the single auction API is used');
      if (method === 'GET') return o.server503 ? { code: 503, body: {} } : { code: 200, body: { phase: 'public_auction', nftOwned: true,
        auction: { tickSpacingQ96: o.tick ?? '2', floorPriceX96: o.floor ?? '4294967296' } } };
      quoteCount++; quotes.push({ ...input });
      if (o.noNft || o.server503) return { code: o.noNft ? 403 : 503, body: { message: 'Character NFT or available service required' } };
      if (o.quoteStall) return new Promise(() => {});
      if (o.changeDom) nodes['genesis-min-omr'].value = '999';
      return { code: 200, body: { ...tx, action: input.action, value: input.action === 'bid' ? ETH : '0x0',
        ...(o.valueMismatch ? { value: '0x1' } : {}), ...(o.quoteDrift && quoteCount === 2 ? { data: '0x5678' } : {}),
        ...(o.expired ? { validUntil: '2000-01-01' } : {}), ...(o.nanExpiry ? { validUntil: 'invalid' } : {}),
        ...(o.freshExpired && quoteCount === 2 ? { validUntil: '2000-01-01' } : {}) } };
    },
  });
  vm.runInContext(['characterCheckoutStatus', 'characterCheckoutStep', 'switchCharacterChain', 'playerGenesisHtml', 'playerGenesisStatus', 'playerGenesisAction'].map(source).join('\n')
    + '\nthis.run = playerGenesisAction; this.render = playerGenesisHtml;', context);
  return { store, nodes, calls, confirms, messages, quotes, context, run: action => context.run(action), get sends() { return sends; }, get quoteCount() { return quoteCount; } };
}
const pending = () => JSON.stringify({ from: A, to: TO, value: ETH, data: '0x12345678', action: 'bid', hash: HASH });
const receipt = (id = 0n, topic = TOPIC) => ({ blockNumber: '0x64', blockHash: BLOCK_HASH, transactionHash: HASH, status: '0x1', logs: [{ address: TO,
  topics: [topic, '0x' + id.toString(16).padStart(64, '0'), '0x' + A.slice(2).padStart(64, '0')] }] });

const ok = fixture(); await ok.run('bid');
assert.equal(ok.sends, 1); assert.equal(ok.quoteCount, 2); assert.equal(JSON.parse(ok.store.get(KEY)).hash, HASH);
assert.equal(ok.quotes[0].maxPriceX96, (((1n << 96n) / 100n) / 2n * 2n).toString());
const offTick = fixture({ tick: '10', floor: '4294967300' }); await offTick.run('bid');
assert.equal(offTick.sends, 1);
assert.equal(BigInt(offTick.quotes[0].maxPriceX96) % 10n, 0n, 'Nonaligned reciprocals are rounded to a valid tick');
assert(BigInt(offTick.quotes[0].maxPriceX96) <= (1n << 96n) / 100n, 'Tick rounding preserves the minimum token rate');
for (const options of [{ tick: '0' }, { tick: '1' }, { tick: 'bad' }, { floor: 'bad' }, { tick: '10' }, { floor: (1n << 96n).toString() }]) {
  const f = fixture(options); await f.run('bid'); assert.equal(f.sends, 0); assert.equal(f.quoteCount, 0);
}
await ok.run('bid'); assert.equal(ok.sends, 1, 'Persistent pending record blocks repeated payment');
for (const option of ['valueMismatch', 'noNft', 'server503', 'changedAccount', 'changedChain', 'quoteDrift', 'expired', 'nanExpiry', 'freshExpired', 'cancelConfirm']) {
  const f = fixture({ [option]: true }); await f.run('bid'); assert.equal(f.sends, 0, option); assert.equal(f.store.has(KEY), false, option);
}
const exact = fixture(); exact.nodes['genesis-amount'].value = '1.000000000000000001'; await exact.run('bid'); assert.equal(exact.sends, 0, 'One wei mismatch must reject');
for (const action of ['contribute', 'refundPlayer', 'claimPlayer', 'arbitrary']) {
  const f = fixture(); await f.run(action); assert.equal(f.sends, 0); assert.equal(f.quoteCount, 0);
}
assert(!fixture().context.render().includes('data-genesis-action="contribute"'));
assert(fixture().context.render().includes('five-day'));
assert(fixture().context.render().includes('can be below the final auction price'));
assert(fixture().context.render().includes('full deposited ETH'));
for (const action of ['exitBid', 'claimBid']) {
  const f = fixture(); f.nodes['genesis-bid-id'].value = '0'; await f.run(action);
  assert.equal(f.sends, 1, action); assert.equal(JSON.parse(f.store.get(KEY)).value, '0x0', 'Recovery never requests ETH');
}
const frozen = fixture({ changeDom: true }); await frozen.run('bid');
assert(frozen.confirms[0].includes('Minimum OMR per ETH: 100\n')); assert(!frozen.confirms[0].includes('999'));
assert.equal(frozen.quotes[1].maxPriceX96, frozen.quotes[0].maxPriceX96);
for (const code of [4001, -32002]) { const f = fixture({ sendError: code }); await f.run('bid'); assert.equal(f.sends, 1); assert.equal(f.store.has(KEY), code !== 4001); }
const unknown = fixture({ noHash: true }); await unknown.run('bid'); await unknown.run('bid'); assert.equal(unknown.sends, 1); assert(unknown.store.has(KEY));
const confirmZero = fixture({ receipt: receipt(0n) }); confirmZero.store.set(KEY, pending()); await confirmZero.run('pending');
assert.equal(confirmZero.store.has(KEY), false); assert.equal(confirmZero.nodes['genesis-bid-id'].value, '0'); assert.equal(confirmZero.store.get(KEY + ':lastBidId'), '0');
const restoreZero = fixture({}, { store: confirmZero.store }); await restoreZero.run('read'); assert.equal(restoreZero.nodes['genesis-bid-id'].value, '0');
const lastId = fixture({ receipt: receipt(42n) }); lastId.store.set(KEY, pending()); await lastId.run('pending'); assert.equal(lastId.store.get(KEY + ':lastBidId'), '42');
const reverted = fixture({ receipt: { ...receipt(), status: '0x0' } }); reverted.store.set(KEY, pending()); await reverted.run('pending');
assert.equal(reverted.store.has(KEY), false, 'A confirmed matching reverted transaction allows recovery without a phantom payment');
assert.equal(reverted.store.has(KEY + ':lastBidId'), false, 'Reverted bid cannot populate a bid ID');
const wrongTopic = fixture({ receipt: receipt(42n, '0x' + 'ff'.repeat(32)) }); wrongTopic.store.set(KEY, pending()); await wrongTopic.run('pending'); assert.equal(wrongTopic.store.has(KEY + ':lastBidId'), false);
for (const options of [{ receipt: null }, { receipt: receipt(), head: '0x68' }, { receipt: receipt(), wrongTx: true }, { receipt: receipt(), changedChain: true }, { receipt: receipt(), changedAccount: true }]) {
  const f = fixture(options); f.store.set(KEY, pending()); await f.run('pending'); assert(f.store.has(KEY), JSON.stringify(options));
}
const noRecordedHash = fixture(); noRecordedHash.store.set(KEY, JSON.stringify({ action: 'bid' })); await noRecordedHash.run('pending'); assert(noRecordedHash.store.has(KEY));
for (const options of [{ orphaned: true }, { reorgDuringValidation: true }, { missingBlock: true }, { shrunkHead: true },
  { sentOverride: { hash: `0x${'55'.repeat(32)}` } }, { sentOverride: { blockHash: OTHER_BLOCK_HASH } }, { sentOverride: { blockNumber: '0x65' } },
  { receipt: { ...receipt(), transactionHash: `0x${'55'.repeat(32)}` } }, { receipt: { ...receipt(), blockHash: '0xinvalid' } },
  { receipt: { ...receipt(), blockNumber: '100' } }, { receipt: { ...receipt(), status: '0x2' } }]) {
  const f = fixture({ receipt: receipt(42n), ...options }); f.store.set(KEY, pending()); await f.run('pending');
  assert(f.store.has(KEY), 'Orphaned, malformed, mismatched or insufficiently confirmed receipt retains persistent intent');
  assert.equal(f.store.has(KEY + ':lastBidId'), false, 'Unverified receipt cannot adopt a bid ID');
  assert.equal(f.nodes['genesis-bid-id'].value, '', 'Unverified receipt cannot populate the bid ID field');
  await f.run('bid'); assert.equal(f.sends, 0, 'Retained intent prevents another financial send');
}
const concurrent = fixture({ delaySend: pause(10) }); await Promise.all([concurrent.run('bid'), concurrent.run('bid')]); assert.equal(concurrent.sends, 1);
const shared = { store: new Map(), locks: locks() }, tab1 = fixture({ delaySend: pause(10) }, shared), tab2 = fixture({}, shared);
await Promise.all([tab1.run('bid'), tab2.run('bid')]); assert.equal(tab1.sends + tab2.sends, 1);
for (const stall of ['eth_requestAccounts:1', 'wallet_switchEthereumChain:1', 'eth_chainId:1', 'eth_accounts:1', 'eth_chainId:2']) {
  for (const late of [false, true]) { const f = fixture({ stall, late }); await f.run('bid'); if (late) await pause(30); assert.equal(f.sends, 0, `${stall} late=${late}`); assert(!f.store.has(KEY)); }
}
for (const options of [{ stalledPicker: true }, { quoteStall: true }]) { const f = fixture(options); await f.run('bid'); assert.equal(f.sends, 0); }
assert(fixture().context.render().includes('Existing refunds and claims remain available after transferring your NFT.'));
assert(fixture().context.render().includes('data-genesis-action="pending"'));

// A stale asynchronous pending check must not clear a newer wallet submission.
const delayed = deferred(), stale = fixture({ receiptRead: () => delayed.promise }); stale.store.set(KEY, pending());
const checkingOld = stale.run('pending');
while (!stale.calls.includes('eth_getTransactionReceipt')) await pause(1);
const newPending = JSON.stringify({ from: A, to: TO, value: ETH, data: '0x12345678', action: 'bid', hash: `0x${'55'.repeat(32)}` });
stale.store.set(KEY, newPending); delayed.resolve(receipt()); await checkingOld;
assert.equal(stale.store.get(KEY), newPending, 'Old confirmation response must preserve a newer persistent payment record');
console.log('Player genesis real-function client PASS: precise ETH, NFT/service gates, two quotes, frozen minimum, canonical/reorg-safe confirmations and event IDs, persistent intents, locks/concurrency, stale pending responses and bounded late wallet requests.');
