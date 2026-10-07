import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { DEPLOYER, SAFE, FACTORY, STORAGE_KEY, GenesisDeploymentClient, sha256, verifyDeploymentPacket } from '../public/genesis-deploy-client.js';

const now = Date.parse('2026-10-07T00:00:00Z');
const addr = n => `0x${n.toString(16).padStart(40, '0')}`;
const roles = ['polFunding', 'reserveFunding', 'coordinator', 'hook', 'auction'];
const code = '0x60006000', runtimeSha = await sha256(Uint8Array.from([0x60, 0, 0x60, 0]), webcrypto);
const scheduleData = '0x0000010000000001', scheduleCode = `0x00${scheduleData.slice(2)}`;
const scheduleSha = await sha256(Uint8Array.from(scheduleCode.slice(2).match(/../g), x => parseInt(x, 16)), webcrypto);
const hash = n => `0x${n.toString(16).padStart(64, '0')}`;
const dependencyAddresses = {
  omr: '0x2e82f8c1cfd5172612b3af56088d7d68d920545d', characterNft: '0x669c8878a2db3c3d0f7a447f398daa3178a0200b',
  poolManager: '0x8366a39cc670b4001a1121b8f6a443a643e40951', positionManager: '0x58daec3116aae6d93017baaea7749052e8a04fa7',
  permit2: '0x000000000022d473030f116ddee9f6b43ac78ba3', create2Factory: FACTORY,
};
const packet = {
  chainId: 4663, signingReady: true, validUntil: '2026-10-08T00:00:00Z', deploymentDeadline: '2026-10-08T00:00:00Z',
  launchClock: { mode: 'arbsys', startBlock: '10000', endBlock: '4000000', claimBlock: '4000000' },
  finalManifest: { chainId: 4663, policy: { totalSupplyWei: '100000000000000000000000000', decimals: 18,
    saleTokenAmountWei: '40000000000000000000000000', lpTokenAmountWei: '20000000000000000000000000',
    bondTokenAmountWei: '40000000000000000000000000', minimumRaiseWei: '10000000000000000000', lpProceedsBps: 5000,
    claimsAtAuctionEnd: true, familySafe: SAFE, liquidityOwner: SAFE, unsoldRecipient: SAFE, bondReserveCustodian: SAFE } },
  deployments: roles.map((role, i) => ({ role, chainId: 4663, from: DEPLOYER, nonce: String(i), value: '0x0',
    predicted: addr(100 + i), data: i === 3 ? '0x' + '00'.repeat(32) + '6000' : '0x6000', ...(i === 3 ? { to: FACTORY } : {}) })),
  runtimeChecks: Object.fromEntries(roles.map((role, i) => [role, { address: addr(100 + i), sha256: runtimeSha }])),
  dependencyChecks: Object.entries(dependencyAddresses).map(([name, address]) => ({ name, address, sha256: runtimeSha })),
  internalValidatorAddress: addr(200), internalValidatorApprovedSupply: '100000000000000000000000000', internalScheduleAddress: addr(201),
  releaseSchedule: { auctionStepsData: scheduleData }, internalScheduleRuntime: scheduleCode,
  auxiliaryRuntimeChecks: [{ name: 'validator', address: addr(200), sha256: runtimeSha },
    { name: 'scheduleStore', address: addr(201), sha256: scheduleSha }],
};
async function encoded(p = packet) { const raw = new TextEncoder().encode(JSON.stringify(p)); return [raw, await sha256(raw, webcrypto)]; }
class Storage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.get(k) || null; }
  setItem(k, v) { this.map.set(k, v); }
}
class Locks {
  busy = false;
  async request(key, options, work) {
    assert.equal(key, STORAGE_KEY); assert.equal(options.ifAvailable, true);
    if (this.busy) return work(null);
    this.busy = true; try { return await work({ name: key }); } finally { this.busy = false; }
  }
}
function fixture({ storage = new Storage(), locks = new Locks(), clock = () => now, confirm = async () => true } = {}) {
  const state = { nonce: 0n, pendingNonce: 0n, chain: '0x1237', account: DEPLOYER, sendError: null, sendHash: true,
    receipts: new Map(), sent: new Map(), codes: new Map(Object.values(dependencyAddresses).map(a => [a, code])),
    requests: [], wait: null, head: 106n, native: 256n, canonical: true, failed: false, alteredTx: false, runtimeBad: false, receiptRead: 0 };
  const provider = { request: async ({ method, params = [] }) => {
    state.requests.push({ method, params });
    if (method === 'eth_chainId') return state.chain;
    if (method === 'eth_accounts') return [state.account];
    if (method === 'eth_getTransactionCount') return '0x' + (params[1] === 'pending' ? state.pendingNonce : state.nonce).toString(16);
    if (method === 'eth_getCode') return state.codes.get(params[0].toLowerCase()) || '0x';
    if (method === 'eth_call') return '0x' + state.native.toString(16).padStart(64, '0');
    if (method === 'eth_estimateGas') return '0x186a0';
    if (method === 'eth_gasPrice') return '0x3e8';
    if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
    if (method === 'eth_blockNumber') return '0x' + state.head.toString(16);
    if (method === 'eth_getBlockByNumber') {
      const n = params[0] === 'latest' ? 106n : BigInt(params[0]);
      return { number: '0x' + n.toString(16), hash: state.canonical ? hash(Number(n)) : hash(999) };
    }
    if (method === 'eth_sendTransaction') {
      if (state.wait) await state.wait;
      if (state.sendError) throw state.sendError;
      const tx = params[0], i = Number(BigInt(tx.nonce)), h = hash(1000 + i);
      assert.equal(tx.value, '0x0'); assert.equal(tx.gas, '0x1d4c0');
      state.sent.set(h, { ...tx, input: tx.data, hash: h, blockNumber: '0x64', blockHash: hash(100),
        ...(state.alteredTx ? { value: '0x1' } : {}) });
      state.receipts.set(h, { transactionHash: h, blockNumber: '0x64', blockHash: hash(100), status: state.failed ? '0x0' : '0x1',
        ...(tx.to ? {} : { contractAddress: packet.deployments[i].predicted }) });
      if (!state.failed) state.codes.set(packet.deployments[i].predicted, state.runtimeBad ? '0x6001' : code);
      if (!state.failed && i === 4) for (const pin of packet.auxiliaryRuntimeChecks)
        state.codes.set(pin.address, pin.name === 'scheduleStore' ? scheduleCode : code);
      state.nonce++; state.pendingNonce = state.nonce;
      return state.sendHash ? h : undefined;
    }
    if (method === 'eth_getTransactionByHash') return state.sent.get(params[0]) || null;
    if (method === 'eth_getTransactionReceipt') { state.receiptRead++; return state.receipts.get(params[0]) || null; }
    throw Error(`unexpected method ${method}`);
  } };
  const client = new GenesisDeploymentClient({ provider, storage, locks, cryptoApi: webcrypto, now: clock, readTimeoutMs: 5, confirm });
  return { client, state, provider, storage, locks };
}
const [raw, digest] = await encoded();
const load = async f => f.client.load(raw, digest);
let f = fixture(); await load(f);
assert.ok(!f.state.requests.some(r => r.method === 'eth_sendTransaction'), 'loading never sends');
for (let i = 0; i < 5; i++) {
  await f.client.sendNext(); assert.equal(f.client.summary().stage, i);
  assert.equal(f.client.state().pending.nonce, String(i));
  await f.client.checkPending(); assert.equal(f.client.summary().stage, i + 1);
}
assert.equal(f.state.requests.filter(r => r.method === 'eth_sendTransaction').length, 5);
assert.equal(f.state.requests.filter(r => r.method === 'eth_sendTransaction')[3].params[0].to, FACTORY);
assert.ok(f.state.requests.every(r => !['personal_sign', 'eth_sign', 'eth_signTypedData_v4'].includes(r.method)));
await assert.rejects(() => f.client.sendNext(), /pending|halted/);

for (const change of [p => { p.signingReady = false; }, p => { p.chainId = 1; }, p => { p.deployments[0].value = '0x1'; },
  p => { p.deployments[0].from = addr(2); }, p => { p.deployments[2].nonce = '8'; }, p => { p.deployments[0].to = addr(2); },
  p => { p.deployments[3].to = addr(2); }, p => { p.finalManifest.policy.lpProceedsBps = 3750; },
  p => { p.runtimeChecks.auction.sha256 = undefined; }, p => { p.dependencyChecks.pop(); },
  p => { p.auxiliaryRuntimeChecks.pop(); }, p => { p.auxiliaryRuntimeChecks[0].address = packet.deployments[0].predicted; },
  p => { p.auxiliaryRuntimeChecks[0].sha256 = undefined; },
  p => { p.internalValidatorApprovedSupply = '1'; }, p => { p.internalScheduleRuntime = '0x006001'; },
  p => { p.internalValidatorAddress = dependencyAddresses.omr; p.auxiliaryRuntimeChecks[0].address = dependencyAddresses.omr; },
  p => { p.validUntil = '2026-10-01T00:00:00Z'; }, p => { p.launchClock.claimBlock = '4000001'; }]) {
  const p = structuredClone(packet); change(p); const [r, d] = await encoded(p);
  await assert.rejects(() => verifyDeploymentPacket(r, d, { now, cryptoApi: webcrypto }));
}
await assert.rejects(() => verifyDeploymentPacket(raw, '00'.repeat(32), { now, cryptoApi: webcrypto }), /SHA-256/);
for (const change of [s => { s.nonce = 1n; }, s => { s.pendingNonce = 1n; }, s => { s.chain = '0x1'; },
  s => { s.account = addr(2); }, s => { s.codes.set(dependencyAddresses.omr, '0x6001'); },
  s => { s.codes.set(packet.deployments[0].predicted, code); }]) {
  f = fixture(); await load(f); change(f.state); await assert.rejects(() => f.client.sendNext());
  assert.ok(!f.state.requests.some(r => r.method === 'eth_sendTransaction'));
}
for (const error of [{ code: -32002 }, { code: -32000 }, Error('network lost')]) {
  f = fixture(); await load(f); f.state.sendError = error; await assert.rejects(() => f.client.sendNext());
  assert.equal(f.client.summary().pending, 'unknown wallet outcome');
  const reload = fixture({ storage: f.storage }); await load(reload);
  await assert.rejects(() => reload.client.sendNext(), /pending/);
  const p = structuredClone(packet); p.validUntil = '2026-10-09T00:00:00Z'; const [r, d] = await encoded(p);
  await assert.rejects(() => reload.client.load(r, d), /different packet/);
}
f = fixture(); await load(f); f.state.sendError = { code: 4001 }; await assert.rejects(() => f.client.sendNext());
assert.equal(f.client.summary().pending, null, 'only explicit user rejection clears prehash intent');
f = fixture(); await load(f); f.state.sendHash = false; await assert.rejects(() => f.client.sendNext(), /Unknown/);
assert.equal(f.client.summary().pending, 'unknown wallet outcome');
await f.client.checkPending(hash(1000)); assert.equal(f.client.summary().stage, 1);

f = fixture(); await load(f);
let release;
f.state.wait = new Promise(resolve => { release = resolve; });
const late = f.client.sendNext();
while (!f.state.requests.some(r => r.method === 'eth_sendTransaction')) await new Promise(resolve => setTimeout(resolve, 1));
await new Promise(resolve => setTimeout(resolve, 15));
assert.equal(f.client.summary().pending, 'unknown wallet outcome', 'wallet prompt is not timed out');
const other = fixture({ storage: f.storage, locks: f.locks });
await assert.rejects(() => load(other), /Another tab/);
await assert.rejects(() => other.client.sendNext(), /Another tab/);
release(); await late; await f.client.checkPending(); assert.equal(f.client.summary().stage, 1);

for (const change of [s => { s.canonical = false; }, s => { s.head = 104n; }, s => { s.runtimeBad = true; },
  s => { s.alteredTx = true; }]) {
  f = fixture(); await load(f); change(f.state); await f.client.sendNext();
  await assert.rejects(() => f.client.checkPending()); assert.equal(f.client.summary().stage, 0);
  assert.ok(f.client.state().pending, 'invalid receipt/runtime keeps request recorded');
}
f = fixture(); await load(f); f.state.failed = true; await f.client.sendNext();
await assert.rejects(() => f.client.checkPending(), /consumed its nonce/);
assert.equal(f.client.summary().halted, 'confirmed_failed');
await assert.rejects(() => f.client.sendNext(), /halted/);
const regenerated = structuredClone(packet);
regenerated.deployments.forEach(d => { d.nonce = String(Number(d.nonce) + 1); });
const [reraw, redigest] = await encoded(regenerated); await f.client.load(reraw, redigest);
assert.equal(f.client.summary().stage, 0); assert.equal(f.client.state().failures.length, 1);

f = fixture(); await load(f); await f.client.sendNext();
const expired = fixture({ storage: f.storage, clock: () => Date.parse('2026-10-09T00:00:00Z') });
expired.state.sent = f.state.sent; expired.state.receipts = f.state.receipts; expired.state.codes = f.state.codes;
await load(expired); await expired.client.checkPending(); assert.equal(expired.client.summary().stage, 1);
await assert.rejects(() => expired.client.sendNext(), /deadline/);
console.log('Deployment client PASS: reviewed bytes/policy/pins, five individual approvals, durable unknown/late requests, cross-tab locks, nonce/chain/code guards, canonical receipts and failure halt; fake wallet only.');
f = fixture({ confirm: async () => { f.state.native = 10000n; return true; } }); await load(f);
await assert.rejects(() => f.client.sendNext(), /start passed during review/);
assert.equal(f.client.state().pending, null);
assert.ok(!f.state.requests.some(r => r.method === 'eth_sendTransaction'));
f = fixture({ confirm: async () => { f.state.canonical = false; return true; } }); await load(f);
await assert.rejects(() => f.client.sendNext(), /snapshot changed/);
assert.equal(f.client.state().pending, null);
assert.ok(!f.state.requests.some(r => r.method === 'eth_sendTransaction'));
f = fixture({ confirm: async () => false }); await load(f); await f.client.sendNext();
assert.equal(f.client.state().pending, null);
assert.ok(!f.state.requests.some(r => r.method === 'eth_sendTransaction'));
console.log('Parallel pre-read and final native-clock/canonical-block checks reject start/reorg races before intent or wallet send PASS');
for (const child of ['validator', 'scheduleStore']) {
  f = fixture(); await load(f);
  for (let i = 0; i < 4; i++) { await f.client.sendNext(); await f.client.checkPending(); }
  assert.ok(!f.state.requests.some(r => r.method === 'eth_getCode'
    && packet.auxiliaryRuntimeChecks.some(p => p.address === r.params[0])), 'children are not read before auction creation');
  await f.client.sendNext();
  f.state.codes.set(packet.auxiliaryRuntimeChecks.find(p => p.name === child).address, '0x6001');
  await assert.rejects(() => f.client.checkPending(), /runtime differs/);
  assert.equal(f.client.summary().stage, 4); assert.ok(f.client.state().pending);
  await assert.rejects(() => f.client.sendNext(), /pending/);
}
console.log('Internal validator and schedule-store runtime checks independently block final-stage completion on mismatch PASS');
// Packet loading cannot enter any asynchronous deployment phase, even for the same packet.
for (const pauseMethod of ['eth_estimateGas', 'confirm', 'eth_sendTransaction']) {
  let resume, entered;
  const paused = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { resume = resolve; });
  let currentTime = now;
  f = fixture({ clock: () => currentTime, confirm: async () => {
    if (pauseMethod === 'confirm') { entered(); await gate; }
    return true;
  } });
  await load(f);
  const originalRequest = f.provider.request;
  f.provider.request = async request => {
    if (request.method === pauseMethod) { entered(); await gate; }
    return originalRequest(request);
  };
  const sending = f.client.sendNext(); await paused;
  const before = f.storage.getItem(STORAGE_KEY);
  await assert.rejects(() => load(f), /in flight/);
  assert.equal(f.storage.getItem(STORAGE_KEY), before);
  const replacement = structuredClone(packet);
  replacement.validUntil = '2026-10-11T00:00:00Z'; replacement.deploymentDeadline = '2026-10-11T00:00:00Z';
  const [replacementRaw, replacementHash] = await encoded(replacement);
  const second = fixture({ storage: f.storage, locks: f.locks, clock: () => Date.parse('2026-10-09T00:00:00Z') });
  await assert.rejects(() => second.client.load(replacementRaw, replacementHash), /Another tab/);
  assert.equal(f.storage.getItem(STORAGE_KEY), before, 'expired-state replacement cannot enter the held deployment lock');
  resume(); await sending;
  assert.equal(f.client.state().pending.packetHash, digest);
  const submitted = f.state.requests.find(r => r.method === 'eth_sendTransaction').params[0];
  assert.equal(submitted.data, packet.deployments[0].data);
  await f.client.checkPending();
}
f = fixture({ confirm: async () => {
  const s = f.client.state(); s.receipts.push({ unexpected: true }); f.client.save(s);
  return true;
} }); await load(f);
await assert.rejects(() => f.client.sendNext(), /changed deployment state/);
assert.equal(f.client.state().pending, null);
assert.ok(!f.state.requests.some(r => r.method === 'eth_sendTransaction'));
console.log('Packet-load/state mutation races during quote, confirmation and wallet send are refused; captured digest/stage/calldata remain bound PASS');
for (const change of [
  p => { p.data = '0xdeadbeef'; }, p => { p.nonce = '88'; }, p => { p.predicted = addr(555); },
  p => { p.runtimeSha256 = 'ab'.repeat(32); }, p => { p.role = 'auction'; }, p => { p.from = addr(555); },
  p => { p.value = '0x1'; }, p => { p.to = addr(555); }, p => { p.stage = 1; },
]) {
  f = fixture(); await load(f); await f.client.sendNext();
  const s = f.client.state(); change(s.pending); f.client.save(s);
  // An RPC agreeing with corrupted local storage still cannot make storage authoritative.
  f.state.sent.set(s.pending.hash, { hash: s.pending.hash, from: s.pending.from, to: s.pending.to,
    input: s.pending.data, value: s.pending.value, nonce: '0x' + BigInt(s.pending.nonce).toString(16),
    blockNumber: '0x64', blockHash: hash(100) });
  f.state.codes.set(s.pending.predicted, code);
  const readsBefore = f.state.requests.filter(r => r.method === 'eth_getTransactionByHash').length;
  await assert.rejects(() => f.client.checkPending(), /Stored deployment/);
  assert.equal(f.state.requests.filter(r => r.method === 'eth_getTransactionByHash').length, readsBefore);
  assert.equal(f.client.summary().stage, 0); assert.ok(f.client.state().pending);
}
f = fixture(); await load(f);
for (let i = 0; i < 4; i++) { await f.client.sendNext(); await f.client.checkPending(); }
await f.client.sendNext();
f.state.codes.set(packet.deployments[0].predicted, '0x6001');
await assert.rejects(() => f.client.checkPending(), /runtime differs/);
assert.equal(f.client.summary().stage, 4); assert.ok(f.client.state().pending);
assert.ok(f.state.requests.some(r => r.method === 'eth_getCode'
  && r.params[0] === packet.deployments[0].predicted && r.params[1] === '0x64'));
console.log('Stored intent is bound to reviewed calldata/nonce/role/runtime before RPC; all five parent and two child runtimes rechecked at final receipt block PASS');
