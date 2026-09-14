import assert from 'node:assert/strict';
import { decodeFunctionData, keccak256, toHex, zeroAddress } from 'viem';
import { validateMarketV2Manifest, planMarketV2, runMarketV2, marketV2Abi, marketV2PendingFees } from '../src/marketv2keeper.js';

const address = n => `0x${n.toString(16).padStart(40, '0')}`;
const hash = keccak256('0x60006000');
const raw = {
  schemaVersion: 2, chainId: 31337, keeper: address(1), governanceSafe: address(2),
  contracts: {
    hook: { address: address(3), runtimeHash: hash, artifact: 'OmertaHookV2' },
    state: { address: address(4), runtimeHash: hash, artifact: 'OmertaMarketStateV2' },
    controller: { address: address(5), runtimeHash: hash, artifact: 'OmertaStabilityControllerV2' },
  },
  gas: { maxGas: '1000000', maxFeePerGas: '1000000000', maxPriorityFeePerGas: '0', dailyBudget: '10000000000000000', confirmations: 2, maxSnapshotAgeSeconds: 60 },
  jobs: [
    { id: 'refresh', kind: 'refresh', target: 'state', intervalSeconds: 60 },
    { id: 'fund-pol', kind: 'hook_claim', target: 'hook', bucket: 3, currency: zeroAddress, minimumAmount: '100', intervalSeconds: 60 },
    { id: 'deploy-core', kind: 'lp_deploy', target: 'controller', tranche: 0, intervalSeconds: 300 },
  ],
};
const m = validateMarketV2Manifest(raw);
const now = 1800000300;
const block = { number: 100n, timestamp: BigInt(now), hash: `0x${'ab'.repeat(32)}` };
function fixture({ valid = true, owed = 1000n, code = '0x60006000', rejectDeploy = false, chainId = 31337, reorg = false } = {}) {
  const calls = [];
  return { calls, publicClient: {
    getChainId: async () => chainId,
    getBlock: async opts => opts.blockNumber && reorg ? { ...block, hash: `0x${'cd'.repeat(32)}` } : block,
    getCode: async () => code,
    readContract: async req => {
      assert.equal(req.blockNumber, block.number);
      const values = { snapshot: { epoch: block.timestamp / 60n - 2n, observedAt: block.timestamp - 60n, valid }, source: address(3), marketState: address(4), epochDuration: 60n, owed, paused: false, position: { liquidity: 0n }, account: { lastDeploymentEpoch: 0n, lastRecoveryEpoch: 0n, lastRecoveryAt: 0n } };
      assert.ok(req.functionName in values, `unexpected read: ${req.functionName}`); return values[req.functionName];
    },
    simulateContract: async req => {
      assert.equal(req.blockNumber, block.number); assert.equal(req.account, address(1));
      calls.push(req.functionName);
      if (rejectDeploy && req.functionName === 'deploy') throw new Error('SpotDeviation');
      return { result: undefined };
    },
  } };
}

{
  const f = fixture(); const plan = await planMarketV2(m, f, { now });
  assert.deepEqual(plan.actions.map(a => a.functionName), ['refresh', 'sweep', 'deploy']);
  for (const action of plan.actions) assert.equal(action.request.value, '0');
  const claim = plan.actions[1]; const decoded = decodeFunctionData({ abi: marketV2Abi('OmertaHookV2'), data: claim.request.data });
  assert.equal(decoded.functionName, 'sweep'); assert.deepEqual(decoded.args, [zeroAddress, 3]);
  assert.equal(plan.actions[2].args[1], block.timestamp / 60n - 2n);
  const again = await planMarketV2(m, f, { now, completedJobKeys: plan.actions.map(a => a.jobKey) });
  assert.equal(again.actions.length, 0);
}
{
  const plan = await planMarketV2(m, fixture({ valid: false, owed: 0n }), { now });
  assert.deepEqual(plan.actions.map(a => a.functionName), ['refresh']);
  const rejected = await planMarketV2(m, fixture({ rejectDeploy: true }), { now });
  assert.equal(rejected.actions.some(a => a.functionName === 'deploy'), false);
  assert.equal(rejected.blocked.find(a => a.jobId === 'deploy-core').reason, 'read_or_simulation_rejected');
}
await assert.rejects(() => planMarketV2(m, fixture({ code: '0x6001' }), { now }), /runtime_mismatch/);
await assert.rejects(() => planMarketV2(m, fixture({ chainId: 1 }), { now }), /wrong_chain/);
await assert.rejects(() => planMarketV2(m, fixture({ reorg: true }), { now }), /snapshot_reorg/);
await assert.rejects(() => planMarketV2(m, fixture(), { now: now + 61 }), /stale_block/);
{
  let clock = now; const f = fixture();
  const simulate = f.publicClient.simulateContract;
  f.publicClient.simulateContract = async req => { const result = await simulate(req); clock = now + 61; return result; };
  await assert.rejects(() => planMarketV2(m, f, { now: () => clock }), /stale_block/, 'a plan may become stale while its RPC reads are running');
}

// The read-only fee projection uses the pinned StateLibrary storage layout and
// modular growth arithmetic. These checks cover in/out-of-range and wraparound.
const word = n => toHex(BigInt.asUintN(256, BigInt(n)), { size: 32 });
const q128 = 1n << 128n;
const packedSlot0 = tick => word((BigInt.asUintN(24, BigInt(tick)) << 160n) | 1n);
{
  const words = [packedSlot0(0), word(9n * q128), word(12n * q128), word(10n), word(q128), word(2n * q128),
    word(q128), word(2n * q128), word(3n * q128), word(4n * q128)];
  assert.deepEqual(marketV2PendingFees(words, 10n, -60, 60), { native: 40n, omr: 40n, tick: 0 });
  words[0] = packedSlot0(-100);
  words[6] = word(8n * q128); words[7] = word(12n * q128);
  assert.deepEqual(marketV2PendingFees(words, 10n, -60, 60), { native: 40n, omr: 60n, tick: -100 });
  words[0] = packedSlot0(100); words[8] = word(13n * q128); words[9] = word(20n * q128);
  assert.deepEqual(marketV2PendingFees(words, 10n, -60, 60), { native: 40n, omr: 60n, tick: 100 });
  assert.throws(() => marketV2PendingFees(words, 11n, -60, 60), /position_custody_mismatch/);
  const wrapped = [packedSlot0(0), word(2n * q128), word(0), word(1n), word(-q128), word(0), word(0), word(0), word(0), word(0)];
  assert.equal(marketV2PendingFees(wrapped, 1n, -60, 60).native, 3n * q128 / q128);
}
{
  const policy = structuredClone(raw);
  policy.jobs = [{ id: 'collect', kind: 'lp_collect', target: 'controller', tranche: 0, intervalSeconds: 60 }];
  const f = fixture(); const originalRead = f.publicClient.readContract;
  const p = { liquidity: 10n, nonce: 1n, lower: -60, upper: 60, deployedBlock: 1n };
  let accrued = 0n;
  f.publicClient.readContract = async req => {
    assert.equal(req.blockNumber, block.number);
    if (req.functionName === 'position') return p;
    if (req.functionName === 'manager') return address(99);
    if (req.functionName === 'poolId') return `0x${'12'.repeat(32)}`;
    if (req.functionName === 'extsload') {
      assert.equal(req.args[0].length, 10); assert.equal(new Set(req.args[0]).size, 10);
      return [packedSlot0(0), word(accrued * q128), word(0), word(10), word(0), word(0), word(0), word(0), word(0), word(0)];
    }
    return originalRead(req);
  };
  assert.equal((await planMarketV2(policy, f, { now })).actions.length, 0, 'active liquidity alone does not justify paying for a collection');
  accrued = 1n;
  assert.equal((await planMarketV2(policy, f, { now })).actions[0].functionName, 'collect');
}
{
  const policy = structuredClone(raw);
  policy.contracts.commitment = { address: address(6), runtimeHash: hash, artifact: 'OmertaCommitmentVaultV2' };
  policy.jobs = [{ id: 'commitment', kind: 'commitment_checkpoint', target: 'commitment', tokenId: '1', intervalSeconds: 60 }];
  const f = fixture(); const originalRead = f.publicClient.readContract;
  let lastObservedAt = 0n;
  f.publicClient.readContract = async req => {
    if (req.functionName === 'commitment') return { depositor: address(20), withdrawn: false, lastObservedAt, lastEpoch: 1n, depositedAt: 1n, maturesAt: block.timestamp + 1000n };
    if (req.functionName === 'snapshot') return { valid: false, observedAt: block.timestamp - 60n };
    return originalRead(req);
  };
  assert.equal((await planMarketV2(policy, f, { now })).actions.length, 0, 'an already broken anchor is not repeatedly reset');
  lastObservedAt = block.timestamp - 120n;
  assert.equal((await planMarketV2(policy, f, { now })).actions[0].functionName, 'checkpoint', 'one reset can still protect a previously live anchor');
}
{
  const policy = structuredClone(raw);
  policy.jobs = [{ id: 'regenerate', kind: 'lp_regenerate', target: 'controller', tranche: 2, intervalSeconds: 60 }];
  const f = fixture(); const originalRead = f.publicClient.readContract;
  let samples = 2;
  f.publicClient.readContract = async req => {
    if (req.functionName === 'account') return { lastRecoveryEpoch: block.timestamp / 60n - 2n, recoverySamples: samples };
    if (req.functionName === 'recoveryY') return 3;
    return originalRead(req);
  };
  assert.equal((await planMarketV2(policy, f, { now })).actions.length, 0);
  samples = 3;
  const result = await planMarketV2(policy, f, { now });
  assert.equal(result.actions[0].functionName, 'regenerate');
  const decoded = decodeFunctionData({ abi: marketV2Abi('OmertaStabilityControllerV2'), data: result.actions[0].request.data });
  assert.deepEqual(decoded.args, [2, block.timestamp / 60n - 2n]);
}
{
  const policy = structuredClone(raw);
  policy.contracts.bridge = { address: address(7), runtimeHash: hash, artifact: 'OmertaTurfFeeBridgeV2' };
  policy.jobs = [{ id: 'turf', kind: 'turf_checkpoint', target: 'bridge', intervalSeconds: 60 }];
  const f = fixture(); const originalRead = f.publicClient.readContract;
  let unforwarded = 0n;
  f.publicClient.readContract = async req => {
    if (req.functionName === 'closed') return false;
    if (req.functionName === 'source') return address(5);
    if (req.functionName === 'account') return { nativeFees: 0n, omrFees: 0n };
    if (['claimedNativeFees', 'forwardedNative', 'forwardedOmr'].includes(req.functionName)) return 0n;
    if (req.functionName === 'claimedOmrFees') return unforwarded;
    return originalRead(req);
  };
  assert.equal((await planMarketV2(policy, f, { now })).actions.length, 0, 'empty live bridge does not consume upkeep gas');
  unforwarded = 100n;
  assert.equal((await planMarketV2(policy, f, { now })).actions[0].functionName, 'checkpointFees', 'a prior permissionless controller claim is still forwarded');
}
for (const mutate of [
  x => { x.jobs[0].kind = 'retire'; },
  x => { x.jobs[0].data = '0x1234'; },
  x => { x.jobs[2].tranche = 5; },
  x => { x.keeper = x.governanceSafe; },
  x => { x.contracts.hook.artifact = '../OMR'; },
  x => { x.jobs[0].target = 'hook'; },
  x => { x.jobs[0].beneficiary = address(10); },
  x => { x.gas.dailyBudget = '1'; },
  x => { x.jobs[2].kind = 'lp_recover'; x.jobs[2].tranche = 0; },
]) {
  const copy = structuredClone(raw); mutate(copy); assert.throws(() => validateMarketV2Manifest(copy));
}
const priorDatabase = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;
try { await assert.rejects(() => runMarketV2(null, m, {}, { dryRun: false }), /postgres_required/); }
finally { if (priorDatabase !== undefined) process.env.DATABASE_URL = priorDatabase; }
assert.equal(raw.jobs[0].minimumAmount, undefined, 'validation never mutates caller policy');
console.log('marketv2keeper: typed calls, exact epoch, actual ABI, simulation/runtime gating, reorg and planning-age checks, pending-fee projection, no-op/cadence gates, funded regeneration, no treasury authority, PostgreSQL requirement passed');
