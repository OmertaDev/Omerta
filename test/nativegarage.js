// Mocked RPC facade tests. Real Anvil/provider/OMR integration is exercised separately.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import { decodeFunctionData, keccak256 } from 'viem';
import { loadNativeGarageConfig, createNativeGarageService, NATIVE_GARAGE_ABI,
  registerNativeGarageRoutes } from '../src/nativegarage.js';

const addr = n => `0x${n.toString(16).padStart(40, '0')}`;
const h = n => `0x${BigInt(n).toString(16).padStart(64, '0')}`;
const ZERO = addr(0), ZERO_HASH = h(0), wallet = addr(10), other = addr(11), profileId = h(100);
const code = '0x60016000', time = 1800000000n;
const chainHash = '0x04f1e9062b8a81f848fded9c12306733282b2727ecced50032187751166ec8c3';
const names = ['engine', 'module', 'drand', 'rules', 'omr'];
const config = { configured: true, schema: 'omerta.native-garage.deployment.v1', chainId: 31337,
  startBlock: '1', startBlockHash: h(1), confirmations: 5, explorer: 'https://example.test', rpcUrl: 'http://127.0.0.1:8545',
  manifestHash: h(200), sourceRulesCommitment: h(201), foundryRecipeCommitment: h(202), house: addr(90),
  contracts: Object.fromEntries(names.map((name, i) => [name, { address: addr(i + 1), runtimeHash: keccak256(code) }])) };
const addresses = Object.fromEntries(Object.entries(config.contracts).map(([k, v]) => [k, v.address]));
const record = { profileId, accountIdHash: h(300), characterIdHash: h(301), wallet, snapshotHash: h(302),
  state: { level: 8, location: h(303), alive: true, fenceNetwork: true, speed: 8, cunning: 9,
    energyMicros: 66000000n, capturedAtMs: (time - 1000n) * 1000n, nextGtaAtMs: 0n, jailUntilMs: 0n } };
function fixture(options = {}) {
  const state = { head: 20n, chain: 31337, code, logs: [], readCalls: [], logCalls: [], simulations: [], branch: new Map(),
    claimed: true, retired: false, request: 0n, fulfilled: false, scrap: 12n, wire: 4n, steel: 1n, parts: 4n,
    balance: 3000000000000000000n, allowance: 600000000000000000n, payment: true, count: 1n, energy: 66000000n,
    owners: new Map([['engine:1', wallet], ['module:1', wallet]]), assigned: ZERO_HASH,
    tx: null, receipt: null, failSimulation: null, fetches: [], profile: record, ...options };
  const block = number => ({ number, hash: state.branch.get(number) || h(number), timestamp: time });
  const client = {
    getChainId: async () => state.chain,
    getBlock: async ({ blockNumber, blockTag }) => block(blockTag ? state.head : blockNumber),
    getCode: async () => state.code,
    getLogs: async range => { state.logCalls.push(range); return state.logs.filter(l => l.blockNumber >= range.fromBlock && l.blockNumber <= range.toBlock); },
    readContract: async ({ address, functionName: fn, args = [], blockNumber }) => {
      const kind = names.find(k => addresses[k].toLowerCase() === address.toLowerCase());
      state.readCalls.push({ kind, fn, args, blockNumber });
      if (state.override) { const value = state.override(kind, fn, args); if (value !== undefined) return value; }
      const pins = {
        'engine:manifestHash': config.manifestHash, 'engine:sourceRulesCommitment': config.sourceRulesCommitment,
        'engine:migrationChainId': 31337n, 'engine:randomnessSource': addresses.drand, 'engine:rules': addresses.rules,
        'engine:foundry': addresses.module, 'engine:randomnessRuntimeHash': keccak256(code), 'engine:rulesRuntimeHash': keccak256(code),
        'module:recipeCommitment': config.foundryRecipeCommitment, 'module:deploymentChainId': 31337n,
        'module:acquisition': addresses.engine, 'module:acquisitionRuntimeHash': keccak256(code),
        'module:omr': addresses.omr, 'module:omrRuntimeHash': keccak256(code), 'module:houseRevenueRecipient': config.house,
        'rules:sourceRulesCommitment': config.sourceRulesCommitment, 'drand:CHAIN_HASH': chainHash, 'omr:decimals': 18,
      };
      if (`${kind}:${fn}` in pins) return pins[`${kind}:${fn}`];
      if (fn === 'profileForWallet') return [wallet, other].some(a => a.toLowerCase() === args[0].toLowerCase()) ? profileId : ZERO_HASH;
      if (fn === 'profile') return state.profile;
      if (fn === 'claimed') return state.claimed;
      if (fn === 'retired') return state.retired;
      if (fn === 'energy') return [state.energy, time * 1000n, 0];
      if (fn === 'energyCap') return 66000000n;
      if (['nextGtaAtMs', 'jailUntilMs'].includes(fn)) return 0n;
      if (fn === 'pendingRequest') return state.request;
      if (fn === 'garageCount') return state.count;
      if (fn === 'materials') return [state.scrap, state.wire, state.steel, state.parts];
      if (fn === 'balanceOf') return state.balance;
      if (fn === 'allowance') return state.allowance;
      if (['policySealed', 'isOperator', 'isRecipient'].includes(fn)) return state.payment;
      if (fn === 'operatorRole') return state.payment ? 2 : 0;
      if (fn === 'requests') return [addresses.engine, 1000n, state.fulfilled, state.fulfilled ? 55n : 0n];
      if (fn === 'readyAt') return state.readyAt ?? time - 10n;
      if (fn === 'action') return { profileId, nonce: 1n, requestedAtMs: (time - 100n) * 1000n,
        round: 1000n, chanceBps: 5000, settled: false, success: false, tokenId: 0n, wordHash: ZERO_HASH };
      if (fn === 'ownerOf') {
        const owner = state.owners.get(`${kind}:${args[0]}`);
        if (!owner) throw { data: { errorName: 'ERC721NonexistentToken' } };
        return owner;
      }
      if (fn === 'car') return { originProfile: profileId, requestId: 1n, actionNonce: 1n, wordHash: h(500),
        modelIndex: state.modelIndex || 0, trimIndex: 1, damage: 15, rarityIndex: 0, sourceHash: h(501) };
      if (fn === 'modelId') return 'junker';
      if (fn === 'assignedProfile') return state.assigned;
      if (fn === 'provenance') return { profileId, snapshotHash: record.snapshotHash, accountIdHash: record.accountIdHash,
        characterIdHash: record.characterIdHash, crafter: wallet, recipeCommitment: config.foundryRecipeCommitment,
        sequence: args[0], steelConsumed: 1n, partsConsumed: 2n };
      throw new Error(`unmocked ${kind}.${fn}`);
    },
    simulateContract: async request => { state.simulations.push(request); if (state.failSimulation) throw state.failSimulation; return { result: true }; },
    getTransaction: async () => { if (!state.tx) throw { name: 'TransactionNotFoundError' }; return state.tx; },
    getTransactionReceipt: async () => { if (!state.receipt) throw { name: 'TransactionReceiptNotFoundError' }; return state.receipt; },
  };
  const service = createNativeGarageService({ config, publicClient: client, allowLocal: true, clock: () => Number(time) * 1000,
    fetchImpl: async (url, opts) => { state.fetches.push({ url, opts }); return { ok: true, headers: new Headers(),
      text: async () => JSON.stringify(state.proof || { round: 1000, signature: 'aa'.repeat(64) }) }; }, limits: options.limits });
  return { state, client, service };
}
const transfer = (kind, token, from = ZERO, to = wallet, number = 2n, logIndex = 0) => ({
  address: addresses[kind], blockNumber: number, blockHash: h(number), logIndex,
  args: { tokenId: BigInt(token), from, to },
});
const rejects = (promise, code) => assert.rejects(promise, e => e.code === code);
let groups = 0;
const test = async (label, run) => { await run(); groups++; console.log(`PASS ${label}`); };

await test('closed by default and invalid manifest never calls RPC', async () => {
  const closed = loadNativeGarageConfig({});
  assert.equal(closed.configured, false);
  const service = createNativeGarageService({ config: closed, publicClient: new Proxy({}, { get: () => { throw Error('RPC called'); } }) });
  assert.equal((await service.board()).configured, false);
  await rejects(service.prepare({ wallet, action: 'claim' }), 'native_unconfigured');
  assert.equal(loadNativeGarageConfig({ NATIVE_GARAGE_ENABLED: 'on' }).status, 'invalid-configuration');
});

await test('deployment file exact byte hash, chain and minimum confirmations', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-garage-'));
  try {
    const file = path.join(dir, 'manifest.json');
    fs.writeFileSync(file, JSON.stringify({ ...config, chainId: 4663, rpcUrl: undefined }));
    const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const env = { NATIVE_GARAGE_ENABLED: 'on', NATIVE_GARAGE_MANIFEST_PATH: file,
      NATIVE_GARAGE_MANIFEST_SHA256: digest, NATIVE_GARAGE_RPC_URL: 'https://rpc.example.test/secret-path' };
    assert.equal(loadNativeGarageConfig(env).configured, true);
    assert.equal(createNativeGarageService({ config: loadNativeGarageConfig(env) }).config().rpcUrl, undefined);
    assert.equal(loadNativeGarageConfig({ ...env, NATIVE_GARAGE_MANIFEST_SHA256: '0'.repeat(64) }).configured, false);
    assert.throws(() => createNativeGarageService({ config: { ...config, confirmations: 1 }, allowLocal: true }));
    assert.throws(() => createNativeGarageService({ config }));
  } finally { fs.rmSync(dir, { recursive: true }); }
});

await test('confirmed board pins runtime, bindings and safe JSON', async () => {
  const { state, service } = fixture(); state.logs = [transfer('engine', 1), transfer('module', 1)];
  const board = await service.board({ wallet });
  assert.equal(board.confirmedBlock.number, '16');
  assert.equal(board.cars[0].modelName, 'junker'); assert.equal(board.tools[0].provenance.sequence, '1');
  assert.equal(board.energy.micros, '66000000'); assert.equal(board.materials.scrap, '12');
  assert.equal(board.inventory.hasNext, false); assert.equal(board.indexing.status, 'ready');
  assert(board.availableActions.includes('harden')); assert(!JSON.stringify(board).includes('rpcUrl'));
  assert(state.readCalls.every(call => call.blockNumber === 16n));
});

await test('wrong chain, runtime, source commitment and stale clocks close reads', async () => {
  let f = fixture({ chain: 1 }); await rejects(f.service.board({ wallet }), 'native_chain_mismatch');
  f = fixture({ code: '0x6002' }); await rejects(f.service.board({ wallet }), 'native_runtime_mismatch');
  f = fixture({ override: (kind, fn) => kind === 'engine' && fn === 'sourceRulesCommitment' ? h(999) : undefined });
  await rejects(f.service.board({ wallet }), 'native_binding_mismatch');
  f = fixture();
  const stale = createNativeGarageService({ config, allowLocal: true, publicClient: f.client, clock: () => Number(time + 301n) * 1000 });
  await rejects(stale.board({ wallet }), 'native_stale_chain');
});

await test('projection bounded chunks, pagination and live ownership exclude stale logs', async () => {
  const { state, service } = fixture({ limits: { chunkSize: 2, maxChunks: 2 } });
  state.logs = Array.from({ length: 30 }, (_, i) => transfer('module', i + 1));
  for (let i = 1; i <= 30; i++) state.owners.set(`module:${i}`, wallet);
  state.owners.set('module:2', other); state.owners.delete('module:3');
  const board = await service.board({ wallet });
  assert.equal(state.logCalls.length, 2); assert.equal(board.indexing.cursorBlock, '4'); assert.equal(board.indexing.more, true);
  assert.equal(board.tools.length, 23); assert.equal(board.inventory.nextCursor, '25');
  const page = await service.board({ wallet, cursor: '25' }); assert.equal(page.tools.length, 5); assert.equal(page.inventory.hasNext, false);
  await rejects(service.board({ wallet, cursor: '01' }), 'native_bad_amount');
});

await test('cursor reorg rebuilds transfer history and anchor reorg fails closed', async () => {
  const f = fixture(); f.state.logs = [transfer('module', 1)];
  assert.equal((await f.service.board({ wallet })).tools.length, 1);
  f.state.branch.set(16n, h(900)); f.state.logs = [];
  assert.equal((await f.service.board({ wallet })).tools.length, 0);
  f.state.branch.set(1n, h(901)); await rejects(f.service.board({ wallet }), 'native_deployment_reorg');
});

await test('allowlisted plans simulate latest state and approve the exact fee only', async () => {
  const f = fixture();
  const approve = await f.service.prepare({ wallet, action: 'approve', args: { batches: '2' } });
  assert.equal(approve.to.toLowerCase(), addresses.omr.toLowerCase()); assert.equal(approve.value, '0x0');
  const decoded = decodeFunctionData({ abi: NATIVE_GARAGE_ABI.omr, data: approve.data });
  assert.deepEqual(decoded.args, [addresses.module, 1200000000000000000n]);
  assert.equal(f.state.simulations[0].blockNumber, 20n); assert.deepEqual(approve.preparedBlock, { number: '20', hash: h(20) });
  assert.equal(approve.validUntilMs, String(Number(time) * 1000 + 300000));
  await rejects(f.service.prepare({ wallet, action: 'approve', args: { batches: '1', spender: other } }), 'native_bad_request');
  await rejects(f.service.prepare({ wallet, action: 'sendTransaction', args: {} }), 'native_bad_action');
  await rejects(f.service.prepare({ wallet, action: 'harden', args: { batches: '0' } }), 'native_bad_amount');
  await rejects(f.service.prepare({ wallet, action: 'craft', args: { data: '0x' } }), 'native_bad_request');
});

await test('payment, energy, ownership and material checks precede simulation', async () => {
  let f = fixture({ allowance: 0n }); await rejects(f.service.prepare({ wallet, action: 'harden', args: { batches: '1' } }), 'native_allowance'); assert.equal(f.state.simulations.length, 0);
  f = fixture({ payment: false }); await rejects(f.service.prepare({ wallet, action: 'approve', args: { batches: '1' } }), 'native_payment_closed');
  f = fixture({ steel: 0n }); await rejects(f.service.prepare({ wallet, action: 'craft' }), 'native_materials');
  f = fixture({ energy: 0n }); await rejects(f.service.prepare({ wallet, action: 'requestGta' }), 'native_action_unavailable');
  f = fixture(); f.state.owners.set('engine:1', other); await rejects(f.service.prepare({ wallet, action: 'salvage', args: { tokenId: '1' } }), 'native_not_owner');
  f = fixture({ modelIndex: 1 }); await rejects(f.service.prepare({ wallet, action: 'salvage', args: { tokenId: '1' } }), 'native_not_junker');
});

await test('assigned tools block transfers, and retired owners retain exit operations', async () => {
  let f = fixture({ assigned: profileId });
  await rejects(f.service.prepare({ wallet, action: 'transferTool', args: { tokenId: '1', to: other } }), 'native_tool_assigned');
  f = fixture({ retired: true, assigned: profileId });
  await f.service.prepare({ wallet, action: 'unassign', args: { tokenId: '1' } });
  await f.service.prepare({ wallet, action: 'abandonCar', args: { tokenId: '1' } });
  await rejects(f.service.prepare({ wallet, action: 'craft' }), 'native_inactive_profile');
  f.state.assigned = ZERO_HASH;
  await f.service.prepare({ wallet, action: 'transferTool', args: { tokenId: '1', to: other } });
});

await test('fulfill fetch is bound to pinned round and simulated real calldata', async () => {
  const f = fixture({ request: 1n });
  f.state.readyAt = time + 6n;
  assert(!(await f.service.board({ wallet })).availableActions.includes('fulfill'));
  await rejects(f.service.prepare({ wallet, action: 'fulfill', args: { requestId: '1' } }), 'native_randomness_pending');
  assert.equal(f.state.fetches.length, 0);
  f.state.readyAt = time;
  assert((await f.service.board({ wallet })).availableActions.includes('fulfill'));
  const plan = await f.service.prepare({ wallet, action: 'fulfill', args: { requestId: '1' } });
  assert.equal(f.state.fetches.length, 1); assert.equal(f.state.fetches[0].url, `https://api.drand.sh/${chainHash.slice(2)}/public/1000`);
  assert.equal(f.state.fetches[0].opts.redirect, 'error');
  const decoded = decodeFunctionData({ abi: NATIVE_GARAGE_ABI.drand, data: plan.data });
  assert.equal(decoded.args[0], 1n); assert.equal(decoded.args[1], `0x${'aa'.repeat(64)}`);
  assert.equal(f.state.simulations[0].address.toLowerCase(), addresses.drand.toLowerCase());
  await rejects(f.service.prepare({ wallet, action: 'fulfill', args: { requestId: '2' } }), 'native_unknown_request');
  f.state.proof = { round: 1001, signature: 'aa'.repeat(64) };
  await rejects(f.service.prepare({ wallet, action: 'fulfill', args: { requestId: '1' } }), 'native_proof_unavailable');
  f.state.proof = { round: 1000, signature: 'aa'.repeat(65) };
  await rejects(f.service.prepare({ wallet, action: 'fulfill', args: { requestId: '1' } }), 'native_proof_unavailable');
});

await test('RPC errors redact transport details and surface decoded recipient failures', async () => {
  const f = fixture({ failSimulation: { cause: { data: { errorName: 'ERC721InvalidReceiver' } } } });
  await assert.rejects(f.service.prepare({ wallet, action: 'transferTool', args: { tokenId: '1', to: other } }),
    e => e.code === 'native_simulation_reverted' && e.message.includes('ERC721InvalidReceiver'));
  f.state.failSimulation = Error('http://secret:token@rpc.example');
  await assert.rejects(f.service.prepare({ wallet, action: 'craft' }), e => e.code === 'native_rpc_unavailable' && !e.message.includes('secret'));
});

await test('receipt confirms canonical blocks, includes exact transaction, and delays terminal reverts', async () => {
  const f = fixture({ tx: { from: wallet, to: addresses.engine, input: '0x12345678', value: 0n },
    receipt: { blockNumber: 18n, blockHash: h(18), status: 'reverted' } });
  let r = await f.service.receipt(h(800), { wallet }); assert.equal(r.status, 'confirming'); assert.equal(r.executionStatus, 'reverted');
  assert.deepEqual(r.transaction, { chainId: 31337, from: wallet, to: addresses.engine, data: '0x12345678', value: '0x0' });
  f.state.head = 22n; r = await f.service.receipt(h(800), { wallet }); assert.equal(r.status, 'reverted'); assert.equal(r.confirmations, '5');
  assert.equal(r.blockNumber, '18'); assert.equal(r.blockHash, h(18));
  f.state.receipt.status = 'success'; assert.equal((await f.service.receipt(h(800), { wallet })).status, 'confirmed');
  f.state.branch.set(18n, h(999)); assert.equal((await f.service.receipt(h(800), { wallet })).status, 'pending');
  f.state.tx.from = other; await rejects(f.service.receipt(h(800), { wallet }), 'native_transaction_mismatch');
});

await test('authenticated routes require an explicit wallet and never read or mutate SQL', async () => {
  const reads = [], seen = [];
  const service = { config: () => ({ configured: true }), board: async v => { seen.push(v); return { wallet: v.wallet }; },
    prepare: async v => { seen.push(v); return v; }, receipt: async (_, v) => { seen.push(v); return v; } };
  const pool = { query: async (sql, params) => { reads.push({ sql, params }); throw Error('The RPC facade must not use SQL.'); } };
  const app = Fastify(); registerNativeGarageRoutes(app, { service, pool, auth: async req => { req.user = { sub: 'account' }; } });
  for (const request of [{ method: 'GET', url: '/v1/native-garage?cursor=25' },
    { method: 'POST', url: '/v1/native-garage/prepare', payload: { action: 'craft' } },
    { method: 'GET', url: `/v1/native-garage/receipt/${h(800)}` }]) {
    const result = await app.inject(request);
    assert.equal(result.statusCode, 400); assert.equal(result.json().error, 'native_wallet_required');
  }
  assert.equal(seen.length, 0); assert.equal(reads.length, 0);
  let result = await app.inject({ method: 'GET', url: `/v1/native-garage?wallet=${wallet}&cursor=25` });
  assert.equal(result.statusCode, 200); assert.equal(result.json().wallet.toLowerCase(), wallet.toLowerCase());
  assert.equal(seen[0].cursor, '25'); assert.equal(reads.length, 0);
  result = await app.inject({ method: 'GET', url: `/v1/native-garage?wallet=${other}` });
  assert.equal(result.json().wallet.toLowerCase(), other.toLowerCase());
  result = await app.inject({ method: 'POST', url: '/v1/native-garage/prepare', payload: { wallet, action: 'craft', args: {} } });
  assert.equal(result.statusCode, 200); assert.equal(result.json().wallet.toLowerCase(), wallet.toLowerCase());
  result = await app.inject({ method: 'GET', url: `/v1/native-garage/receipt/${h(800)}?wallet=${wallet}` });
  assert.equal(result.statusCode, 200); assert.equal(result.json().wallet.toLowerCase(), wallet.toLowerCase());
  result = await app.inject({ method: 'GET', url: '/v1/native-garage?wallet=not-a-wallet' });
  assert.equal(result.statusCode, 400); assert.equal(result.json().error, 'native_bad_address');
  result = await app.inject({ method: 'POST', url: '/v1/native-garage/prepare', payload: { wallet, action: 'craft', args: {}, publicClient: {} } });
  assert.equal(result.statusCode, 400);
  assert.equal(reads.length, 0);
  await app.close();
});

await test('unconfigured receipt route rejects before any wallet or SQL lookup', async () => {
  let queries = 0;
  const app = Fastify();
  const service = createNativeGarageService({ config: loadNativeGarageConfig({}) });
  registerNativeGarageRoutes(app, { service, auth: async req => { req.user = { sub: 'account' }; },
    pool: { query: async () => { queries++; throw Error('No migration table in the closed deployment.'); } } });
  const result = await app.inject({ method: 'GET', url: `/v1/native-garage/receipt/${h(800)}` });
  assert.equal(result.statusCode, 503);
  assert.equal(result.json().error, 'native_unconfigured');
  assert.equal(queries, 0);
  await app.close();
});

console.log(`native garage: ${groups} mocked RPC groups passed`);
