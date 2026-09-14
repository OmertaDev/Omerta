import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decodeFunctionData, keccak256, zeroAddress } from 'viem';
import { marketV2Abi } from '../src/marketv2keeper.js';
import { validateMarketV2SolverManifest, quoteMarketV2Solver, validateMarketV2SolverPlan, marketV2PlanHash,
  minimumMarketV2GrossProfit, prepareMarketV2SolverAction, persistMarketV2SolverPlan, loadMarketV2SolverPlan, runMarketV2Solver } from '../src/marketv2solver.js';

const address = n => `0x${n.toString(16).padStart(40, '0')}`;
const code = '0x60006000'; const runtimeHash = keccak256(code);
const pin = n => ({ address: address(n), runtimeHash });
const now = 1_800_000_000;
const canonical = { currency0: zeroAddress, currency1: address(7), fee: 3000, tickSpacing: 60, hooks: address(3) };
const raw = {
  upkeep: { schemaVersion: 2, chainId: 31337, keeper: address(1), governanceSafe: address(2),
    contracts: { hook: { ...pin(3), artifact: 'OmertaHookV2' }, arbitrage: { ...pin(4), artifact: 'OmertaArbitrageV2' } }, jobs: [],
    gas: { maxGas: '100000', maxFeePerGas: '1', maxPriorityFeePerGas: '0', dailyBudget: '10000000', confirmations: 2, maxSnapshotAgeSeconds: 60 } },
  quoter: pin(5), poolManager: pin(6), omr: pin(7), alternatives: [{ ...canonical, fee: 500, hooks: zeroAddress }],
  sizes: ['100000', '200000'], maxCycleGas: '300000', minNetProfit: '1000', dailyCollateralBudget: '1000000', deadlineSeconds: 180,
  networkFeeReserveWei: '250',
};
const m = validateMarketV2SolverManifest(raw);
assert.equal(marketV2PlanHash(31337, address(0x4444), address(0x1000), {
  alternative: { currency0: zeroAddress, currency1: address(0x7000), fee: 500, tickSpacing: 60, hooks: zeroAddress },
  canonicalFirst: true, amount: '200000', minimumProfit: '376563', deadline: '1800000180', salt: `0x${'11'.repeat(32)}`,
}), '0xded4db9766aac20f1ad83050d6d37219876d06b7b3d0aa5b4c65aede445ccd78', 'actual Solidity hashPlan golden vector');
assert.equal(marketV2PlanHash(31337, address(0x1000), address(0x2000), {
  alternative: { currency0: zeroAddress, currency1: address(0x3000), fee: 500, tickSpacing: 10, hooks: zeroAddress },
  canonicalFirst: false, amount: '1000000000000000000', minimumProfit: '123', deadline: '1800000300', salt: `0x${'7'.padStart(64, '0')}`,
}), '0x77be99e7a5d7b1c5887002bbd3e5356e45e0bd821db2b10250497e7003470d59', 'reverse route Solidity golden vector');
function fixture({ profitable = true, wrongChain = false, wrongCode = false, wrongManager = false, wrongToken = false, reorg = false, rejectExecute = false } = {}) {
  const calls = []; let head = { number: 100n, timestamp: BigInt(now), hash: `0x${'ab'.repeat(32)}` };
  const blocks = new Map([[100n, head]]); let commitment = [`0x${'00'.repeat(32)}`, 0n];
  return { calls,
    setHead: (number, timestamp) => { head = { number: BigInt(number), timestamp: BigInt(timestamp), hash: `0x${number.toString(16).padStart(64, '0')}` }; blocks.set(head.number, head); },
    commit: (hash, number) => { commitment = [hash, BigInt(number)]; },
    publicClient: {
      getChainId: async () => wrongChain ? 1 : 31337,
      getBlock: async options => options.blockNumber !== undefined
        ? { ...blocks.get(options.blockNumber), ...(reorg ? { hash: `0x${'ee'.repeat(32)}` } : {}) } : head,
      getCode: async request => { assert.equal(request.blockNumber, head.number); return wrongCode ? '0x6001' : code; },
      readContract: async request => {
        assert.equal(request.blockNumber, head.number);
        const values = { manager: address(6), omr: wrongToken ? address(9) : address(7), poolKey: canonical,
          reserveProfitBps: 2000, maxInput: 1_000_000n, poolManager: wrongManager ? address(9) : address(6), commitments: commitment };
        assert.ok(request.functionName in values, `unknown read ${request.functionName}`); return values[request.functionName];
      },
      simulateContract: async request => {
        assert.equal(request.blockNumber, head.number); assert.equal(request.account, address(1)); calls.push(request);
        if (request.functionName === 'quoteExactInput') {
          const p = request.args[0]; assert.equal(p.exactCurrency, zeroAddress); assert.equal(p.path.length, 2);
          assert.equal(p.path[0].intermediateCurrency, address(7)); assert.equal(p.path[1].intermediateCurrency, zeroAddress);
          assert.ok(p.path.every(k => k.hookData === '0x'));
          const profit = profitable && p.path[0].hooks === address(3) ? p.exactAmount * 10n : -1n;
          return { result: [p.exactAmount + profit, 10000n] };
        }
        if (request.functionName === 'execute' && rejectExecute) throw new Error('InsufficientProfit');
        assert.ok(['commit', 'execute'].includes(request.functionName));
        return { result: 1_000_000n };
      },
    },
  };
}

assert.equal(minimumMarketV2GrossProfit(m, 2000), 376563n, 'ceiling includes commit, execute, claim, network reserve and stability share');
const f = fixture();
const quoted = await quoteMarketV2Solver(m, f, { now });
assert.equal(quoted.state, 'quoted');
assert.equal(f.calls.length, 4, 'all finite sizes and both directions were quoted');
assert.equal(quoted.record.plan.amount, '200000');
assert.equal(quoted.record.plan.canonicalFirst, true);
assert.equal(quoted.record.plan.minimumProfit, '376563');
assert.equal(quoted.record.plan.deadline, String(now + 180));
assert.equal(quoted.record.planHash, marketV2PlanHash(31337, address(4), address(1), quoted.record.plan));
assert.notEqual(quoted.record.planHash, marketV2PlanHash(1, address(4), address(1), quoted.record.plan));
assert.notEqual(quoted.record.planHash, marketV2PlanHash(31337, address(4), address(8), quoted.record.plan));
assert.deepEqual(validateMarketV2SolverPlan(m, quoted.record), quoted.record);

{
  const action = await prepareMarketV2SolverAction(m, quoted.record, f, 'commit', { now });
  const decoded = decodeFunctionData({ abi: marketV2Abi('OmertaArbitrageV2'), data: action.request.data });
  assert.equal(decoded.functionName, 'commit'); assert.equal(decoded.args[0], quoted.record.planHash);
  assert.equal(action.request.value, '0'); assert.equal(action.budgets.length, 0);
  assert.equal(action.gasBudget.key, 'market-v2-gas');
  f.commit(quoted.record.planHash, 100);
  await assert.rejects(() => prepareMarketV2SolverAction(m, quoted.record, f, 'execute', { now }), /commitment_not_executable/);
  f.setHead(101, now + 2);
  const execute = await prepareMarketV2SolverAction(m, quoted.record, f, 'execute', { now: now + 2 });
  const reveal = decodeFunctionData({ abi: marketV2Abi('OmertaArbitrageV2'), data: execute.request.data });
  assert.equal(reveal.functionName, 'execute'); assert.equal(reveal.args[0].salt, quoted.record.plan.salt);
  assert.equal(reveal.args[0].amount, 200000n); assert.equal(execute.request.value, '200000');
  assert.deepEqual(execute.budgets, [{ key: 'market-v2-solver-collateral', period: String(BigInt(now) / 86400n), limit: '1000000', amount: '200000' }]);
  assert.ok(f.calls.some(c => c.functionName === 'execute' && c.value === 200000n), 'exact reveal simulated before any transport');
  f.setHead(165, now + 100);
  await assert.rejects(() => prepareMarketV2SolverAction(m, quoted.record, f, 'execute', { now: now + 100 }), /commitment_not_executable/);
}

for (const [options, reason] of [[{ wrongChain: true }, 'wrong_chain'], [{ wrongCode: true }, 'runtime_mismatch'],
  [{ wrongManager: true }, 'pool_binding_mismatch'], [{ wrongToken: true }, 'pool_binding_mismatch'], [{ reorg: true }, 'snapshot_reorg']]) {
  await assert.rejects(() => quoteMarketV2Solver(m, fixture(options), { now }), new RegExp(reason));
}
assert.equal((await quoteMarketV2Solver(m, fixture({ profitable: false }), { now })).state, 'idle');
await assert.rejects(() => quoteMarketV2Solver(m, fixture(), { now: now + 61 }), /stale_block/);
await assert.rejects(() => prepareMarketV2SolverAction(m, quoted.record, fixture({ profitable: false }), 'commit', { now }), /profit_disappeared/);
{
  const busy = fixture(); busy.commit(`0x${'ff'.repeat(32)}`, 99);
  await assert.rejects(() => prepareMarketV2SolverAction(m, quoted.record, busy, 'commit', { now }), /another_live_commitment/);
  const reject = fixture({ rejectExecute: true }); reject.commit(quoted.record.planHash, 99);
  await assert.rejects(() => prepareMarketV2SolverAction(m, quoted.record, reject, 'execute', { now }), /InsufficientProfit/);
  const expired = fixture(); expired.setHead(101, now + 181); expired.commit(quoted.record.planHash, 100);
  await assert.rejects(() => prepareMarketV2SolverAction(m, quoted.record, expired, 'execute', { now: now + 181 }), /expired_or_underfunded_plan/);
}
for (const mutate of [
  x => { x.alternatives[0].hooks = address(3); }, x => { x.alternatives[0].currency1 = address(8); },
  x => { x.alternatives[0].data = '0x1234'; }, x => { x.sizes[0] = '100000000'; },
  x => { x.maxCycleGas = '100000'; }, x => { x.deadlineSeconds = 301; },
  x => { x.upkeep.keeper = x.upkeep.governanceSafe; }, x => { x.quoter.runtimeHash = '0x1234'; },
  x => { x.alternatives = Array(5).fill(x.alternatives[0]); }, x => { x.sizes = Array(9).fill('1'); },
  x => { x.networkFeeReserveWei = '-1'; }, x => { x.minimumOutput = '1'; },
]) {
  const copy = structuredClone(raw); mutate(copy); assert.throws(() => validateMarketV2SolverManifest(copy));
}
for (const mutate of [x => { x.plan.amount = '100000'; }, x => { x.solver = address(9); }, x => { x.plan.data = '0x1234'; },
  x => { x.chainId = 1; }, x => { x.plan.salt = `0x${'ef'.repeat(32)}`; }]) {
  const copy = structuredClone(quoted.record); mutate(copy); assert.throws(() => validateMarketV2SolverPlan(m, copy));
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-solver-test-'));
const planFile = path.join(temp, 'plan.json');
try {
  persistMarketV2SolverPlan(planFile, m, quoted.record);
  assert.deepEqual(loadMarketV2SolverPlan(planFile, m), quoted.record);
  assert.throws(() => persistMarketV2SolverPlan(planFile, m, quoted.record), /EEXIST/);
  const original = fs.readFileSync(planFile, 'utf8');
  assert.equal(original.includes(quoted.record.plan.salt), true);
  const oldDatabase = process.env.DATABASE_URL; delete process.env.DATABASE_URL;
  try { await assert.rejects(() => runMarketV2Solver(null, m, {}, { phase: 'commit', planFile }), /postgres_required/); }
  finally { if (oldDatabase !== undefined) process.env.DATABASE_URL = oldDatabase; }
  assert.equal(fs.readFileSync(planFile, 'utf8'), original, 'failed execution never rewrites reveal');
} finally {
  // This test owns these exact paths; no recursive removal or external path expansion.
  fs.unlinkSync(planFile); fs.rmdirSync(temp);
}
console.log('marketv2solver: bounded full-cycle quotes, all pool fees, fixed block/runtime pins, gas+reserve profitability, typed commit/reveal, immutable persistence, replay window, policy tampering and PostgreSQL gate passed');
