// Finite, typed ETH/OMR cycle solver. Quotes never sign. Every signed request uses the shared
// PostgreSQL nonce journal; the exact reveal is fsynced before committing its on-chain hash.
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { encodeAbiParameters, encodeFunctionData, getAddress, isAddress, keccak256, parseAbi, stringToHex, zeroAddress } from 'viem';
import { validateMarketV2Manifest, marketV2Abi } from './marketv2keeper.js';
import { keeperTransactionStatus, reconcileKeeperTransactions, runKeeperTransaction } from './keepertransactions.js';

const fail = code => Object.assign(new Error(code), { keeperCode: code });
const json = value => JSON.stringify(value, (_key, x) => typeof x === 'bigint' ? String(x) : x);
const stable = x => Array.isArray(x) ? x.map(stable) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, stable(x[k])])) : x;
const exact = (x, keys) => {
  if (!x || typeof x !== 'object' || Array.isArray(x) || Object.keys(x).some(k => !keys.includes(k))) throw fail('invalid_solver_fields');
};
const integer = (n, min, max) => { if (!Number.isSafeInteger(n) || n < min || n > max) throw fail('invalid_solver_integer'); return n; };
const uint = (n, bits = 256) => {
  if (typeof n !== 'string' || !/^[1-9][0-9]*$/.test(n) || BigInt(n) >= 1n << BigInt(bits)) throw fail('invalid_solver_amount'); return BigInt(n);
};
const nonnegative = n => n === '0' ? 0n : uint(n);
const address = (a, allowZero = false) => {
  if (!isAddress(a, { strict: true }) || (!allowZero && a.toLowerCase() === zeroAddress)) throw fail('invalid_solver_address');
  return getAddress(a).toLowerCase();
};
const hash = x => { if (!/^0x[0-9a-f]{64}$/i.test(x || '')) throw fail('invalid_solver_hash'); return x.toLowerCase(); };
const pin = x => { exact(x, ['address', 'runtimeHash']); return { address: address(x.address), runtimeHash: hash(x.runtimeHash) }; };
const key = x => {
  exact(x, ['currency0', 'currency1', 'fee', 'tickSpacing', 'hooks']);
  return { currency0: address(x.currency0, true), currency1: address(x.currency1),
    fee: integer(x.fee, 0, 10000), tickSpacing: integer(x.tickSpacing, 1, 32767), hooks: address(x.hooks, true) };
};
const poolComponents = ['currency0:address', 'currency1:address', 'fee:uint24', 'tickSpacing:int24', 'hooks:address']
  .map(x => { const [name, type] = x.split(':'); return { name, type }; });
const planType = { type: 'tuple', components: [{ name: 'alternative', type: 'tuple', components: poolComponents },
  { name: 'canonicalFirst', type: 'bool' }, { name: 'amount', type: 'uint128' }, { name: 'minimumProfit', type: 'uint128' },
  { name: 'deadline', type: 'uint64' }, { name: 'salt', type: 'bytes32' }] };
export const marketV2QuoterAbi = parseAbi([
  'function poolManager() view returns (address)',
  'function quoteExactInput((address exactCurrency,(address intermediateCurrency,uint24 fee,int24 tickSpacing,address hooks,bytes hookData)[] path,uint128 exactAmount) params) returns (uint256 amountOut,uint256 gasEstimate)',
]);

export function validateMarketV2SolverManifest(input) {
  exact(input, ['upkeep', 'quoter', 'poolManager', 'omr', 'alternatives', 'sizes', 'maxCycleGas', 'minNetProfit', 'dailyCollateralBudget', 'deadlineSeconds', 'networkFeeReserveWei']);
  const m = { upkeep: validateMarketV2Manifest(input.upkeep), quoter: pin(input.quoter), poolManager: pin(input.poolManager), omr: pin(input.omr),
    alternatives: [], sizes: [], maxCycleGas: String(uint(input.maxCycleGas)), minNetProfit: String(uint(input.minNetProfit)),
    dailyCollateralBudget: String(uint(input.dailyCollateralBudget)), deadlineSeconds: integer(input.deadlineSeconds, 30, 300),
    networkFeeReserveWei: String(nonnegative(input.networkFeeReserveWei ?? '0')) };
  if (Object.values(m.upkeep.contracts).filter(c => c.artifact === 'OmertaArbitrageV2').length !== 1) throw fail('one_solver_target_required');
  if (!Array.isArray(input.alternatives) || !input.alternatives.length || input.alternatives.length > 4
      || !Array.isArray(input.sizes) || !input.sizes.length || input.sizes.length > 8) throw fail('unbounded_solver_search');
  m.alternatives = input.alternatives.map(k => {
    const p = key(k);
    if (p.currency0 !== zeroAddress || p.currency1 !== m.omr.address || p.hooks !== zeroAddress) throw fail('invalid_alternative_pool');
    return p;
  });
  if (new Set(m.alternatives.map(json)).size !== m.alternatives.length) throw fail('duplicate_alternative_pool');
  m.sizes = input.sizes.map(x => String(uint(x, 128)));
  if (new Set(m.sizes).size !== m.sizes.length || m.sizes.some(x => BigInt(x) > BigInt(m.dailyCollateralBudget))) throw fail('invalid_solver_size');
  // Profitability covers the bounded commit, execute and eventual claim transactions, not just swap gas.
  if (BigInt(m.maxCycleGas) < 3n * BigInt(m.upkeep.gas.maxGas) || BigInt(m.maxCycleGas) > 100_000_000n
      || BigInt(m.maxCycleGas) * BigInt(m.upkeep.gas.maxFeePerGas) > BigInt(m.upkeep.gas.dailyBudget)) throw fail('invalid_cycle_gas_budget');
  return m;
}

const targetOf = m => Object.values(m.upkeep.contracts).find(c => c.artifact === 'OmertaArbitrageV2');
const manifestHash = m => keccak256(stringToHex(json(stable(m))));
export function marketV2PlanHash(chainId, target, solver, plan) {
  return keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, planType],
    [BigInt(chainId), target, solver, plan]));
}
export function minimumMarketV2GrossProfit(m, reserveBps) {
  const share = BigInt(reserveBps);
  if (share < 0n || share > 5000n) throw fail('invalid_reserve_share');
  const net = BigInt(m.maxCycleGas) * BigInt(m.upkeep.gas.maxFeePerGas) + BigInt(m.networkFeeReserveWei) + BigInt(m.minNetProfit);
  return (net * 10000n + (10000n - share) - 1n) / (10000n - share);
}

async function context(m, clients, now) {
  const pub = clients.publicClient; const target = targetOf(m); const abi = marketV2Abi('OmertaArbitrageV2');
  if (Number(await pub.getChainId()) !== m.upkeep.chainId) throw fail('wrong_chain');
  const block = await pub.getBlock({ blockTag: 'latest' });
  if (!block.hash || block.timestamp > BigInt(now) + 5n || BigInt(now) - block.timestamp > BigInt(m.upkeep.gas.maxSnapshotAgeSeconds)) throw fail('stale_block');
  await Promise.all([...Object.values(m.upkeep.contracts), m.quoter, m.poolManager, m.omr].map(async c => {
    const code = await pub.getCode({ address: c.address, blockNumber: block.number });
    if (!code || code === '0x' || keccak256(code).toLowerCase() !== c.runtimeHash) throw fail('runtime_mismatch');
  }));
  const read = functionName => pub.readContract({ address: target.address, abi, functionName, blockNumber: block.number });
  const [manager, omr, canonical, reserveShare, maxInput, quoterManager] = await Promise.all([
    read('manager'), read('omr'), read('poolKey'), read('reserveProfitBps'), read('maxInput'),
    pub.readContract({ address: m.quoter.address, abi: marketV2QuoterAbi, functionName: 'poolManager', blockNumber: block.number }),
  ]);
  if (address(manager) !== m.poolManager.address || address(quoterManager) !== m.poolManager.address || address(omr) !== m.omr.address
      || address(canonical.currency0, true) !== zeroAddress || address(canonical.currency1) !== m.omr.address
      || !Object.values(m.upkeep.contracts).some(c => c.artifact === 'OmertaHookV2' && c.address === address(canonical.hooks))) throw fail('pool_binding_mismatch');
  const minimumProfit = minimumMarketV2GrossProfit(m, reserveShare);
  if (minimumProfit >= 1n << 128n || m.sizes.some(s => BigInt(s) > BigInt(maxInput))) throw fail('solver_contract_limit');
  return { pub, block, target, abi, canonical, minimumProfit };
}

async function quoteCycle(m, c, alternative, canonicalFirst, amount) {
  const first = canonicalFirst ? c.canonical : alternative; const second = canonicalFirst ? alternative : c.canonical;
  const pathKey = (p, intermediateCurrency) => ({ intermediateCurrency, fee: p.fee, tickSpacing: p.tickSpacing, hooks: p.hooks, hookData: '0x' });
  const quote = await c.pub.simulateContract({ address: m.quoter.address, abi: marketV2QuoterAbi, functionName: 'quoteExactInput',
    args: [{ exactCurrency: zeroAddress, path: [pathKey(first, m.omr.address), pathKey(second, zeroAddress)], exactAmount: BigInt(amount) }],
    account: m.upkeep.keeper, blockNumber: c.block.number });
  const [output, gasEstimate] = quote.result;
  return { output: BigInt(output), grossProfit: BigInt(output) - BigInt(amount), gasEstimate: BigInt(gasEstimate) };
}
async function canonicalBlock(c) {
  if ((await c.pub.getBlock({ blockNumber: c.block.number })).hash !== c.block.hash) throw fail('snapshot_reorg');
}

export async function quoteMarketV2Solver(input, clients, { now = Math.floor(Date.now() / 1000) } = {}) {
  const m = validateMarketV2SolverManifest(input); const c = await context(m, clients, now);
  let best; const rejected = [];
  for (const alternative of m.alternatives) for (const amount of m.sizes) for (const canonicalFirst of [true, false]) {
    try {
      const quote = await quoteCycle(m, c, alternative, canonicalFirst, amount);
      if (quote.grossProfit < c.minimumProfit || quote.gasEstimate > BigInt(m.upkeep.gas.maxGas)) continue;
      if (!best || quote.grossProfit > best.grossProfit) best = { ...quote, alternative, amount, canonicalFirst };
    } catch { rejected.push({ alternativeFee: alternative.fee, amount, canonicalFirst, reason: 'quote_rejected' }); }
  }
  await canonicalBlock(c);
  if (!best) return { state: 'idle', reason: 'no_profitable_bounded_cycle', quoteBlock: String(c.block.number), rejected };
  const plan = { alternative: best.alternative, canonicalFirst: best.canonicalFirst, amount: best.amount,
    minimumProfit: String(c.minimumProfit), deadline: String(c.block.timestamp + BigInt(m.deadlineSeconds)), salt: `0x${randomBytes(32).toString('hex')}` };
  const record = { schemaVersion: 1, manifestHash: manifestHash(m), chainId: m.upkeep.chainId, target: c.target.address, solver: m.upkeep.keeper,
    quoteBlockNumber: String(c.block.number), quoteBlockHash: c.block.hash, plan,
    planHash: marketV2PlanHash(m.upkeep.chainId, c.target.address, m.upkeep.keeper, plan), quotedOutput: String(best.output), quotedGrossProfit: String(best.grossProfit) };
  return { state: 'quoted', record, rejected };
}

export function validateMarketV2SolverPlan(input, record) {
  const m = validateMarketV2SolverManifest(input);
  exact(record, ['schemaVersion', 'manifestHash', 'chainId', 'target', 'solver', 'quoteBlockNumber', 'quoteBlockHash', 'plan', 'planHash', 'quotedOutput', 'quotedGrossProfit']);
  if (record.schemaVersion !== 1 || record.manifestHash !== manifestHash(m) || record.chainId !== m.upkeep.chainId
      || record.target !== targetOf(m).address || record.solver !== m.upkeep.keeper) throw fail('plan_domain_mismatch');
  uint(record.quoteBlockNumber, 64); hash(record.quoteBlockHash); uint(record.quotedOutput); uint(record.quotedGrossProfit);
  const p = record.plan; exact(p, ['alternative', 'canonicalFirst', 'amount', 'minimumProfit', 'deadline', 'salt']);
  const alternative = key(p.alternative);
  if (typeof p.canonicalFirst !== 'boolean' || !m.sizes.includes(p.amount)
      || !m.alternatives.some(a => json(stable(a)) === json(stable(alternative)))) throw fail('plan_policy_mismatch');
  uint(p.amount, 128); uint(p.minimumProfit, 128); uint(p.deadline, 64); hash(p.salt);
  if (hash(record.planHash) !== marketV2PlanHash(m.upkeep.chainId, record.target, record.solver, p)) throw fail('plan_hash_mismatch');
  return JSON.parse(json(record));
}

export function persistMarketV2SolverPlan(file, input, record) {
  const validated = validateMarketV2SolverPlan(input, record);
  // Exclusive creation makes a retry unable to replace the commitment's reveal or salt.
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, `${json(validated)}\n`, 'utf8'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  return validated;
}
export function loadMarketV2SolverPlan(file, input) {
  if (fs.statSync(file).size > 65536) throw fail('oversized_plan_file');
  return validateMarketV2SolverPlan(input, JSON.parse(fs.readFileSync(file, 'utf8')));
}

export async function prepareMarketV2SolverAction(input, saved, clients, phase, { now = Math.floor(Date.now() / 1000) } = {}) {
  if (!['commit', 'execute'].includes(phase)) throw fail('invalid_solver_phase');
  const m = validateMarketV2SolverManifest(input); const record = validateMarketV2SolverPlan(m, saved); const c = await context(m, clients, now);
  const p = record.plan;
  const quotedBlock = await c.pub.getBlock({ blockNumber: BigInt(record.quoteBlockNumber) });
  if (quotedBlock.hash !== record.quoteBlockHash) throw fail('quote_reorg');
  if (BigInt(p.deadline) !== quotedBlock.timestamp + BigInt(m.deadlineSeconds)) throw fail('plan_deadline_mismatch');
  if (BigInt(p.minimumProfit) < c.minimumProfit || BigInt(p.deadline) <= c.block.timestamp
      || BigInt(p.deadline) > c.block.timestamp + 300n) throw fail('expired_or_underfunded_plan');
  const commitment = await c.pub.readContract({ address: c.target.address, abi: c.abi, functionName: 'commitments', args: [m.upkeep.keeper], blockNumber: c.block.number });
  const [committedHash, committedBlock] = commitment;
  if (phase === 'execute' && (committedHash !== record.planHash || c.block.number <= BigInt(committedBlock)
      || c.block.number > BigInt(committedBlock) + 64n)) throw fail('commitment_not_executable');
  if (phase === 'commit') {
    if (committedHash !== `0x${'00'.repeat(32)}` && committedHash !== record.planHash
        && c.block.number <= BigInt(committedBlock) + 64n) throw fail('another_live_commitment');
    const quote = await quoteCycle(m, c, p.alternative, p.canonicalFirst, p.amount);
    if (quote.grossProfit < BigInt(p.minimumProfit)) throw fail('profit_disappeared');
  }
  const args = phase === 'commit' ? [record.planHash] : [p]; const value = phase === 'execute' ? p.amount : '0';
  await c.pub.simulateContract({ address: c.target.address, abi: c.abi, functionName: phase, args,
    value: BigInt(value), account: m.upkeep.keeper, blockNumber: c.block.number });
  await canonicalBlock(c);
  const day = String(c.block.timestamp / 86400n);
  return { chainId: m.upkeep.chainId, wallet: m.upkeep.keeper, target: c.target.address, targetCodeHash: c.target.runtimeHash,
    jobKey: `marketv2:solver:${phase}:${record.planHash}`, request: { data: encodeFunctionData({ abi: c.abi, functionName: phase, args }), value },
    gasBudget: { key: 'market-v2-gas', period: day, limit: m.upkeep.gas.dailyBudget },
    budgets: phase === 'execute' ? [{ key: 'market-v2-solver-collateral', period: day, limit: m.dailyCollateralBudget, amount: p.amount }] : [],
    maxGas: m.upkeep.gas.maxGas, maxFeePerGas: m.upkeep.gas.maxFeePerGas, maxPriorityFeePerGas: m.upkeep.gas.maxPriorityFeePerGas,
    confirmations: m.upkeep.gas.confirmations, accountingRequired: false,
    metadata: { kind: `marketv2_solver_${phase}`, planHash: record.planHash, sourceBlock: String(c.block.number), sourceHash: c.block.hash } };
}

export async function runMarketV2Solver(pool, input, clients, { phase, planFile, now = Math.floor(Date.now() / 1000) } = {}) {
  const m = validateMarketV2SolverManifest(input);
  if (!process.env.DATABASE_URL || !pool) throw fail('postgres_required');
  if (!['commit', 'execute'].includes(phase) || !planFile) throw fail('invalid_solver_phase');
  const target = targetOf(m);
  const pending = await reconcileKeeperTransactions(pool, { chainId: m.upkeep.chainId, wallet: m.upkeep.keeper, clients,
    allowedTargets: { [target.address]: target.runtimeHash } });
  if (pending.state !== 'idle') return pending;
  let record;
  if (fs.existsSync(planFile)) record = loadMarketV2SolverPlan(planFile, m);
  else {
    if (phase !== 'commit') throw fail('persisted_plan_required');
    const quoted = await quoteMarketV2Solver(m, clients, { now });
    if (quoted.state !== 'quoted') return quoted;
    record = persistMarketV2SolverPlan(planFile, m, quoted.record);
  }
  const jobKey = `marketv2:solver:${phase}:${record.planHash}`;
  const existing = await keeperTransactionStatus(pool, { chainId: m.upkeep.chainId, wallet: m.upkeep.keeper, jobKeys: [jobKey] });
  if (existing.length) {
    // Receipt/nonce verification and any retransmission use the original signed bytes. A completed
    // execute has consumed its on-chain commitment and must not be mistaken for a new failed plan.
    const args = phase === 'commit' ? [record.planHash] : [record.plan];
    return runKeeperTransaction(pool, { chainId: m.upkeep.chainId, wallet: m.upkeep.keeper, clients, target: target.address,
      targetCodeHash: target.runtimeHash, jobKey, request: { data: encodeFunctionData({ abi: marketV2Abi('OmertaArbitrageV2'), functionName: phase, args }),
        value: phase === 'execute' ? record.plan.amount : '0' } });
  }
  const action = await prepareMarketV2SolverAction(m, record, clients, phase, { now });
  return runKeeperTransaction(pool, { ...action, clients });
}
