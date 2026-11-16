// Wallet/API seams only: no transaction is broadcast and no external RPC is contacted.
import assert from 'node:assert/strict';
import { encodeFunctionData, parseAbi } from 'viem';
import { createNativeGarageClient } from '../public/nativegarage-client.js';

const A = digit => '0x' + digit.repeat(40);
const H = digit => '0x' + digit.repeat(64);
const WALLET = A('1'), OTHER = A('2'), PROFILE = H('3'), TX = H('4'), FEE = 600000000000000000n;
const ZERO = H('0');
const ABI = parseAbi(['function claim(bytes32)', 'function requestGta(bytes32)', 'function fulfill(uint256,bytes)',
  'function settleGta(uint256)', 'function salvage(bytes32,uint256)', 'function abandonCar(uint256)',
  'function harden(bytes32,uint256)', 'function approve(address,uint256)', 'function craft(bytes32)',
  'function assign(uint256,bytes32)', 'function unassign(uint256)', 'function retire(bytes32)',
  'function safeTransferFrom(address,address,uint256)']);
const copy = value => structuredClone(value);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const memory = () => {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
function fixture(options = {}) {
  const storage = options.storage || memory(), events = new Map(), calls = [], sends = [], states = [];
  const config = { configured: true, enabled: true, status: 'ready', chainId: 4663, manifestHash: H('5'),
    explorer: 'https://explorer.example', contracts: { engine: A('6'), module: A('7'), drand: A('8'), rules: A('9'), omr: A('a'), house: A('b') } };
  const state = { config, board: { ...copy(config), wallet: WALLET, profile: { id: PROFILE, wallet: WALLET, claimed: true, retired: false, level: 8 },
    confirmedBlock: { number: '100', hash: H('c'), timestamp: '1900000000' }, indexing: { status: 'ready' },
    inventory: { cursor: '0', nextCursor: null, hasNext: false, limit: 25 }, materials: { scrap: '12', wire: '2', steel: '0', parts: '2' },
    omr: { balance: String(10n ** 20n), allowance: String(10n ** 20n), hardeningCostWei: String(FEE) },
    pending: { requestId: '3', round: '1000', fulfilled: false, readyAt: '0' },
    cars: [{ tokenId: '1', owner: WALLET, modelIndex: '0' }], tools: [{ tokenId: '2', owner: WALLET, assignedProfile: ZERO }],
    availableActions: ['claim', 'requestGta', 'fulfill', 'settleGta', 'salvage', 'abandonCar', 'harden', 'approve', 'craft', 'assign', 'unassign', 'retire', 'transferCar', 'transferTool'] },
    expected: WALLET, accounts: [WALLET], network: '0x1237', switchWorks: true, receiptStatus: 'confirmed', confirmations: '5', required: 5,
    pickerCalls: 0, permissions: 0, boardReads: 0, failBoard: false, receiptTx: null, pickerOptions: [] };
  const provider = { on(event, listener) { if (!events.has(event)) events.set(event, new Set()); events.get(event).add(listener); },
    removeListener(event, listener) { events.get(event)?.delete(listener); },
    emit(event, value) { for (const listener of [...(events.get(event) || [])]) listener(value); },
    async request(request) {
      calls.push(copy(request));
      if (request.method === 'eth_accounts') { await state.accountHook?.(calls.filter(row => row.method === 'eth_accounts').length); return copy(state.accounts); }
      if (request.method === 'eth_requestAccounts') { state.permissions++; return copy(state.accounts); }
      if (request.method === 'eth_chainId') return state.network;
      if (request.method === 'wallet_switchEthereumChain') {
        if (state.switchWorks) { state.network = request.params[0].chainId; provider.emit('chainChanged', state.network); }
        return null;
      }
      if (request.method === 'eth_sendTransaction') {
        sends.push(copy(request.params[0]));
        if (state.sendError) throw state.sendError;
        if (state.sendHook) return state.sendHook();
        return state.sendResult ?? TX;
      }
      throw Error('Unexpected wallet RPC method ' + request.method);
    } };
  const encoded = (action, args = {}) => {
    const id = state.board.profile?.id;
    let fn = action, values = [], target = config.contracts.engine;
    if (['claim', 'requestGta', 'retire', 'craft'].includes(action)) values = [id];
    if (['salvage', 'harden'].includes(action)) values = [id, BigInt(args.tokenId ?? args.batches)];
    if (action === 'approve') { target = config.contracts.omr; values = [config.contracts.module, FEE * BigInt(args.batches)]; }
    if (action === 'assign') values = [BigInt(args.tokenId), id];
    if (['unassign', 'abandonCar'].includes(action)) values = [BigInt(args.tokenId)];
    if (['transferCar', 'transferTool'].includes(action)) { fn = 'safeTransferFrom'; values = [WALLET, args.to, BigInt(args.tokenId)]; }
    if (action === 'fulfill') { target = config.contracts.drand; values = [BigInt(args.requestId), '0x' + 'ab'.repeat(64)]; }
    if (action === 'settleGta') values = [BigInt(args.requestId)];
    if (['salvage', 'harden', 'craft', 'assign', 'unassign', 'transferTool'].includes(action)) target = config.contracts.module;
    return { to: target, data: encodeFunctionData({ abi: ABI, functionName: fn, args: values }) };
  };
  const api = async (method, url, body) => {
    calls.push({ method, url, body: copy(body) });
    if (url === '/v1/native-garage/config') return copy(state.config);
    if (url.startsWith('/v1/native-garage?')) {
      state.boardReads++; if (state.failBoard) throw Error('Confirmed garage is temporarily unavailable.');
      await state.boardHook?.(); return copy(state.board);
    }
    if (url === '/v1/native-garage/prepare') {
      if (state.prepareError) throw state.prepareError;
      const tx = encoded(body.action, body.args);
      const plan = { ...tx, chainId: config.chainId, from: WALLET, value: '0x0', action: body.action,
        manifestHash: config.manifestHash, profileId: state.board.profile?.id || null, summary: 'Exact native garage action',
        preparedBlock: { number: '101', hash: H('d') }, validUntilMs: String(Date.now() + 300000) };
      await state.prepareHook?.(plan); state.plan = copy(plan); return plan;
    }
    if (url.startsWith('/v1/native-garage/receipt/')) {
      await state.receiptHook?.();
      const saved = [...storage.values.values()].map(value => { try { return JSON.parse(value); } catch { return null; } }).find(Boolean);
      const tx = state.receiptTx || sends.at(-1) || saved;
      return { hash: TX, status: state.receiptStatus, confirmations: state.confirmations, requiredConfirmations: state.required,
        blockNumber: '100', blockHash: H('c'),
        transaction: { chainId: 4663, from: WALLET, to: tx.to, data: tx.data, value: '0x0' } };
    }
    throw Error('Unexpected API request ' + url);
  };
  const client = createNativeGarageClient({ api, pickProvider: async options => { state.pickerCalls++; state.pickerOptions.push(options); return provider; },
    getExpectedWallet: () => { state.expectedHook?.(); return state.expected; }, onState: value => { states.push(value); state.onState?.(value); },
    storage, maxPolls: 1, wait: async () => {} });
  return { client, state, provider, storage, sends, calls, states, encoded };
}
let groups = 0;
async function test(name, run) { await run(); groups++; console.log('PASS ' + name); }

await test('read-only loading never opens a wallet and disabled deployments never send', async () => {
  const f = fixture(); await f.client.load(); assert.equal(f.state.pickerCalls, 0); assert.equal(f.state.permissions, 0);
  f.state.config.enabled = false; await f.client.load(); await f.client.perform('harden', { batches: '1' });
  assert.equal(f.sends.length, 0); assert.equal(f.state.pickerCalls, 0);
});
await test('exact ABI intent switches and rechecks chain, then refetches authoritative balances', async () => {
  const f = fixture(); f.state.network = '0x1'; await f.client.load();
  f.state.receiptHook = () => { f.state.board.materials = { scrap: '8', wire: '2', steel: '1', parts: '2' }; };
  await f.client.perform('harden', { batches: '1' });
  assert.equal(f.sends.length, 1); assert.deepEqual(f.sends[0], { from: WALLET, ...f.encoded('harden', { batches: '1' }), value: '0x0', chainId: '0x1237' });
  assert.equal(f.client.getState().board.materials.steel, '1'); assert.equal(f.client.getState().busy, false);
  assert.equal(f.storage.values.size, 0); assert(f.calls.some(row => row.method === 'wallet_switchEthereumChain'));
  assert(f.states.some(row => row.phase === 'refreshing' && row.busy));
});
await test('malformed target, calldata, value, chain, wallet, profile, manifest and timing never reach wallet send', async () => {
  const changes = [plan => { plan.to = A('e'); }, plan => { plan.data += '00'; }, plan => { plan.value = '0x1'; },
    plan => { plan.chainId = 1; }, plan => { plan.from = OTHER; }, plan => { plan.profileId = H('f'); },
    plan => { plan.manifestHash = H('f'); }, plan => { plan.validUntilMs = '1'; }, plan => { plan.preparedBlock.hash = 'bad'; }];
  for (const mutate of changes) {
    const f = fixture(); await f.client.load(); f.state.prepareHook = mutate; await f.client.perform('harden', { batches: '1' });
    assert.equal(f.sends.length, 0); assert.equal(f.client.getState().busy, false); assert(f.client.getState().error);
  }
});
await test('a wallet that reports a successful switch but stays on the wrong chain cannot send', async () => {
  const f = fixture(); await f.client.load(); f.state.network = '0x1'; f.state.switchWorks = false;
  await f.client.perform('harden', { batches: '1' }); assert.equal(f.sends.length, 0); assert.equal(f.client.getState().busy, false);
});
await test('account, network round-trip and application wallet changes invalidate prepared plans', async () => {
  for (const mode of ['account', 'chain', 'expected']) {
    const f = fixture(); await f.client.load(); f.state.prepareHook = () => {
      if (mode === 'account') { f.state.accounts = [OTHER]; f.provider.emit('accountsChanged', [OTHER]); }
      if (mode === 'chain') { f.provider.emit('chainChanged', '0x1'); f.provider.emit('chainChanged', '0x1237'); }
      if (mode === 'expected') f.state.expected = OTHER;
    };
    await f.client.perform('harden', { batches: '1' }); assert.equal(f.sends.length, 0); assert.equal(f.storage.values.size, 0);
  }
});
await test('the final state callback cannot invalidate a wallet just before an unchecked send', async () => {
  const f = fixture(); await f.client.load(); let once = false;
  f.state.onState = value => { if (value.phase === 'wallet' && !once) { once = true; f.state.accounts = [OTHER]; f.provider.emit('accountsChanged', [OTHER]); } };
  await f.client.perform('harden', { batches: '1' }); assert.equal(f.sends.length, 0); assert.equal(f.storage.values.size, 0);
});
await test('double clicks and navigation during a wallet prompt never create a second transaction', async () => {
  const f = fixture(); await f.client.load(); const wallet = deferred(); f.state.sendHook = () => wallet.promise;
  const first = f.client.perform('harden', { batches: '1' });
  while (!f.sends.length) await new Promise(resolve => setImmediate(resolve));
  const second = await f.client.perform('harden', { batches: '1' }); assert.equal(second.ignored, true);
  f.state.accounts = [OTHER]; f.provider.emit('accountsChanged', [OTHER]); wallet.resolve(TX); await first;
  assert.equal(f.sends.length, 1); assert.equal(f.client.getState().transaction.hash, TX); assert.equal(f.client.getState().busy, false);
});
await test('signature rejection clears the unsent record and permits an explicit retry', async () => {
  const f = fixture(); await f.client.load(); f.state.sendError = Object.assign(Error('User rejected'), { code: 4001 });
  await f.client.perform('harden', { batches: '1' }); assert.equal(f.client.getState().phase, 'cancelled');
  assert.equal(f.client.getState().busy, false); assert.equal(f.storage.values.size, 0);
  f.state.sendError = null; await f.client.perform('harden', { batches: '1' }); assert.equal(f.sends.length, 2);
});
await test('pending timeout and page reload retain the lock and resume without resending', async () => {
  const f = fixture(); await f.client.load(); f.state.receiptStatus = 'pending'; f.state.confirmations = '0';
  await f.client.perform('harden', { batches: '1' }); assert.equal(f.client.getState().phase, 'recoverable'); assert.equal(f.client.getState().busy, true);
  f.client.dispose(); const next = fixture({ storage: f.storage }); await next.client.load();
  assert.equal(next.client.getState().busy, true); await next.client.perform('harden', { batches: '1' }); assert.equal(next.sends.length, 0);
  await next.client.resume(); assert.equal(next.client.getState().busy, false); assert.equal(next.storage.values.size, 0); assert.equal(next.sends.length, 0);
});
await test('an unknown broadcast remains recoverable until an exact matching hash is supplied', async () => {
  const f = fixture(); await f.client.load(); f.state.sendResult = 'not-a-hash';
  await f.client.perform('harden', { batches: '1' }); assert.equal(f.client.getState().busy, true); assert.equal(f.client.getState().transaction.hash, null);
  f.state.receiptTx = { to: A('e'), data: '0x00' }; await f.client.resume(TX);
  assert.equal(f.client.getState().busy, true); assert.equal(f.client.getState().error, 'transaction_mismatch');
  f.state.receiptTx = null; await f.client.resume(); assert.equal(f.client.getState().busy, false); assert.equal(f.sends.length, 1);
});
await test('reverted and successful production receipts both wait for five confirmations', async () => {
  for (const status of ['reverted', 'confirmed']) {
    const f = fixture(); await f.client.load(); f.state.receiptStatus = status; f.state.confirmations = '1'; f.state.required = 1;
    await f.client.perform('harden', { batches: '1' }); assert.equal(f.client.getState().busy, true); assert.equal(f.storage.values.size, 1);
    f.state.confirmations = '5'; await f.client.resume(); assert.equal(f.client.getState().busy, false);
    assert.equal(f.client.getState().phase, status === 'reverted' ? 'reverted' : 'ready'); assert.equal(f.storage.values.size, 0);
  }
});
await test('confirmed receipt plus failed board refresh stays ambiguous and cannot resend', async () => {
  const f = fixture(); await f.client.load(); f.state.receiptHook = () => { f.state.failBoard = true; };
  await f.client.perform('harden', { batches: '1' }); assert.equal(f.client.getState().phase, 'recoverable'); assert.equal(f.client.getState().busy, true);
  await f.client.perform('harden', { batches: '1' }); assert.equal(f.sends.length, 1);
  f.state.failBoard = false; f.state.receiptHook = null; await f.client.resume(); assert.equal(f.client.getState().busy, false); assert.equal(f.sends.length, 1);
});
await test('approval is exact, separate, and never creates a local allowance flag', async () => {
  const f = fixture(); f.state.board.omr.allowance = '0'; f.state.board.availableActions = ['approve']; await f.client.load();
  await f.client.perform('approve', { batches: '1' });
  assert.equal(f.sends[0].data, encodeFunctionData({ abi: ABI, functionName: 'approve', args: [f.state.config.contracts.module, FEE] }));
  assert.equal(f.client.getState().board.omr.allowance, '0'); await f.client.perform('harden', { batches: '1' }); assert.equal(f.sends.length, 1);
  f.state.board.omr.allowance = String(FEE); f.state.board.availableActions = ['harden']; await f.client.load();
  await f.client.perform('harden', { batches: '1' }); assert.equal(f.sends.length, 2);
});
await test('fulfillment uses only the exact pending request and a canonical 64-byte proof call', async () => {
  const f = fixture(); await f.client.load(); await f.client.perform('fulfill'); assert.equal(f.sends[0].to, f.state.config.contracts.drand);
  assert.equal(f.sends[0].data, f.encoded('fulfill', { requestId: '3' }).data);
  const bad = fixture(); await bad.client.load(); await bad.client.perform('fulfill', { requestId: '4' }); assert.equal(bad.sends.length, 0);
});
await test('transfers use the wallet as sender and only authoritative refresh removes ownership', async () => {
  const f = fixture(); await f.client.load(); f.state.receiptStatus = 'pending'; f.state.confirmations = '0';
  await f.client.perform('transferCar', { tokenId: '1', to: OTHER }); assert.equal(f.client.getState().board.cars.length, 1);
  assert.equal(f.sends[0].data, f.encoded('transferCar', { tokenId: '1', to: OTHER }).data);
  f.state.receiptStatus = 'confirmed'; f.state.confirmations = '5'; f.state.board.cars = []; await f.client.resume();
  assert.equal(f.client.getState().board.cars.length, 0);
});
await test('storage errors stop a send and corrupt tracking never silently unlocks a duplicate', async () => {
  const f = fixture(); await f.client.load(); f.storage.setItem = () => { throw Error('blocked'); };
  await f.client.perform('harden', { batches: '1' }); assert.equal(f.sends.length, 0); assert.equal(f.client.getState().error, 'storage_unavailable');
  const next = fixture(); next.storage.values.set('omerta:native-garage:v1:4663:' + A('6') + ':' + WALLET, '{bad');
  await next.client.load(); assert.equal(next.client.getState().busy, true); await next.client.perform('harden', { batches: '1' }); assert.equal(next.sends.length, 0);
});
await test('disposing during a wallet prompt still persists the returned hash for later recovery', async () => {
  const f = fixture(); await f.client.load(); const wallet = deferred(); f.state.sendHook = () => wallet.promise;
  const sending = f.client.perform('harden', { batches: '1' }); while (!f.sends.length) await new Promise(resolve => setImmediate(resolve));
  f.client.dispose(); wallet.resolve(TX); await sending;
  const record = JSON.parse([...f.storage.values.values()][0]); assert.equal(record.hash, TX);
  const next = fixture({ storage: f.storage }); await next.client.load(); await next.client.resume(); assert.equal(next.client.getState().busy, false);
});
await test('stale confirmed blocks and unfinished indexing keep a confirmed transaction locked', async () => {
  for (const reason of ['block', 'indexing', 'fork']) {
    const f = fixture(); await f.client.load();
    if (reason === 'block') f.state.board.confirmedBlock.number = '99';
    if (reason === 'indexing') f.state.board.indexing.status = 'indexing';
    if (reason === 'fork') f.state.board.confirmedBlock.hash = H('e');
    await f.client.perform('harden', { batches: '1' });
    assert.equal(f.client.getState().busy, true); assert.equal(f.client.getState().error, 'projection_pending');
    assert.equal(f.storage.values.size, 1);
    f.state.board.confirmedBlock = { number: '100', hash: H('c'), timestamp: '1900000000' }; f.state.board.indexing.status = 'ready';
    await f.client.resume(); assert.equal(f.client.getState().busy, false); assert.equal(f.sends.length, 1);
  }
});
await test('pagination survives prepare and confirmed refresh, and explicit wallet choice forwards force', async () => {
  const f = fixture(); f.state.board.inventory.cursor = '25'; await f.client.load({ cursor: '25' });
  await f.client.perform('transferTool', { tokenId: '2', to: OTHER });
  assert(f.calls.filter(row => row.url?.startsWith('/v1/native-garage?')).every(row => row.url.endsWith('&cursor=25')));
  await f.client.connect({ force: true }); assert.deepEqual(f.state.pickerOptions.at(-1), { force: true });
});
await test('explicit wallet selection reads a different garage without linking or sending', async () => {
  const f = fixture(); await f.client.load({ cursor: '25' });
  f.state.accounts = [OTHER]; f.state.board.wallet = OTHER; f.state.board.profile.wallet = OTHER;
  f.state.board.cars = []; f.state.board.tools = [];
  await f.client.connect({ force: true });
  assert.equal(f.client.getState().board.wallet, OTHER); assert.equal(f.client.getState().error, null);
  assert.equal(f.state.expected, WALLET); assert.equal(f.sends.length, 0);
  assert(f.calls.some(row => row.url === `/v1/native-garage?wallet=${OTHER}&cursor=0`));
  assert(f.calls.filter(row => row.url).every(row => row.method === 'GET'));
  f.state.accounts = [WALLET];
  await f.client.perform('craft');
  assert.equal(f.sends.length, 0); assert.equal(f.client.getState().error, 'wallet_changed');
});
await test('explicit selection retains session guards before and after wallet awaits', async () => {
  for (const boundary of ['before', 'picker', 'accounts']) {
    const f = fixture(); await f.client.load();
    f.state.expectedHook = (() => { let calls = 0; return () => {
      if (++calls >= { before: 1, picker: 2, accounts: 3 }[boundary]) throw Object.assign(Error('Session changed.'), { code: 'session_changed' });
    }; })();
    await f.client.connect({ force: true });
    assert.equal(f.client.getState().error, 'session_changed'); assert.equal(f.sends.length, 0);
    if (boundary === 'before') assert.equal(f.state.pickerCalls, 0);
  }
  const f = fixture(); await f.client.load(); await f.client.connect({ force: true });
  f.state.expectedHook = () => { throw Object.assign(Error('Session changed.'), { code: 'session_changed' }); };
  await f.client.perform('craft'); assert.equal(f.sends.length, 0); assert.equal(f.client.getState().error, 'session_changed');
});
console.log(`nativegarage-client: PASS (${groups} wallet/controller behavior groups)`);
