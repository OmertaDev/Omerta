// Closed V2 upkeep jobs. State is read at one block; each proposed call is simulated again before signing.
// On-chain contracts own all capital/fee accounting. No game cash or legacy liquidity ledger is credited here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, defineChain, encodeAbiParameters, encodePacked, encodeFunctionData, getAddress, http, isAddress, keccak256, toHex, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { keeperTransactionStatus, reconcileKeeperTransactions, runKeeperTransaction } from './keepertransactions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = code => Object.assign(new Error(code), { keeperCode: code });
const kinds = {
  refresh: ['OmertaMarketStateV2', 'refresh'],
  hook_claim: ['OmertaHookV2', 'sweep'],
  funding_flush: ['OmertaReserveFundingV2', 'flush'],
  lp_collect: ['OmertaStabilityControllerV2', 'collect'],
  lp_claim: ['OmertaStabilityControllerV2', 'claimFees'],
  lp_finalize: ['OmertaStabilityControllerV2', 'finalize'],
  turf_expire: ['OmertaStabilityControllerV2', 'expireTurf'],
  lp_deploy: ['OmertaStabilityControllerV2', 'deploy'],
  lp_recover: ['OmertaStabilityControllerV2', 'observeRecovery'],
  lp_regenerate: ['OmertaStabilityControllerV2', 'regenerate'],
  turf_checkpoint: ['OmertaTurfFeeBridgeV2', 'checkpointFees'],
  commitment_checkpoint: ['OmertaCommitmentVaultV2', 'checkpoint'],
  bond_proceeds: ['OmertaInventoryBondV2', 'claimProceeds'],
  arb_claim: ['OmertaArbitrageV2', 'claimFor'],
};
const exact = (o, keys) => {
  if (!o || typeof o !== 'object' || Array.isArray(o) || Object.keys(o).some(k => !keys.includes(k))) throw fail('invalid_manifest_fields');
};
const addr = x => {
  if (!isAddress(x, { strict: true }) || x.toLowerCase() === zeroAddress) throw fail('invalid_address');
  return getAddress(x).toLowerCase();
};
const integer = (x, min, max) => {
  if (!Number.isSafeInteger(x) || x < min || x > max) throw fail('invalid_integer'); return x;
};
const uint = (x, zero = false) => {
  if (!/^(0|[1-9][0-9]*)$/.test(String(x ?? ''))) throw fail('invalid_amount');
  const n = BigInt(x); if ((!zero && n === 0n) || n >= 1n << 256n) throw fail('invalid_amount'); return n;
};

export function validateMarketV2Manifest(input) {
  const m = JSON.parse(JSON.stringify(input));
  exact(m, ['schemaVersion', 'chainId', 'keeper', 'governanceSafe', 'contracts', 'jobs', 'gas']);
  if (m.schemaVersion !== 2) throw fail('invalid_version');
  integer(m.chainId, 1, Number.MAX_SAFE_INTEGER);
  m.keeper = addr(m.keeper); m.governanceSafe = addr(m.governanceSafe);
  if (m.keeper === m.governanceSafe) throw fail('keeper_is_governance');
  if (!m.contracts || typeof m.contracts !== 'object' || Array.isArray(m.contracts)) throw fail('invalid_pins');
  const seen = new Set();
  for (const [name, c] of Object.entries(m.contracts)) {
    exact(c, ['address', 'runtimeHash', 'artifact']);
    if (!/^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(name) || !/^0x[0-9a-f]{64}$/i.test(c.runtimeHash)
        || !Object.values(kinds).some(([a]) => a === c.artifact)) throw fail('invalid_pins');
    c.address = addr(c.address); c.runtimeHash = c.runtimeHash.toLowerCase();
    if (seen.has(c.address)) throw fail('duplicate_target'); seen.add(c.address);
  }
  exact(m.gas, ['maxGas', 'maxFeePerGas', 'maxPriorityFeePerGas', 'dailyBudget', 'confirmations', 'maxSnapshotAgeSeconds']);
  for (const k of ['maxGas', 'maxFeePerGas', 'dailyBudget']) m.gas[k] = String(uint(m.gas[k]));
  m.gas.maxPriorityFeePerGas = String(uint(m.gas.maxPriorityFeePerGas, true));
  if (BigInt(m.gas.maxPriorityFeePerGas) > BigInt(m.gas.maxFeePerGas)
      || BigInt(m.gas.maxGas) * BigInt(m.gas.maxFeePerGas) > BigInt(m.gas.dailyBudget)) throw fail('invalid_gas_policy');
  integer(m.gas.confirmations, 1, 100); integer(m.gas.maxSnapshotAgeSeconds, 1, 300);
  if (!Array.isArray(m.jobs) || m.jobs.length > 32) throw fail('invalid_jobs');
  const ids = new Set();
  for (const j of m.jobs) {
    exact(j, ['id', 'kind', 'target', 'intervalSeconds', 'tranche', 'bucket', 'currency', 'tokenId', 'beneficiary', 'minimumAmount']);
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,40}$/.test(j.id) || ids.has(j.id) || !kinds[j.kind]
        || m.contracts[j.target]?.artifact !== kinds[j.kind][0]) throw fail('invalid_job');
    ids.add(j.id); integer(j.intervalSeconds, 60, 86400);
    if (['lp_collect', 'lp_claim', 'lp_finalize', 'lp_deploy', 'lp_recover', 'lp_regenerate'].includes(j.kind)) integer(j.tranche, 0, 6);
    else if (j.tranche !== undefined) throw fail('unexpected_tranche');
    if (['lp_collect', 'lp_claim', 'lp_finalize', 'lp_deploy', 'lp_recover', 'lp_regenerate'].includes(j.kind) && j.tranche === 5) throw fail('reserve_is_idle');
    if (['lp_finalize', 'lp_recover', 'lp_regenerate'].includes(j.kind) && ![1, 2, 3, 4].includes(j.tranche)) throw fail('not_directional_tranche');
    if (j.kind === 'hook_claim') {
      integer(j.bucket, 0, 4);
      if (!isAddress(j.currency, { strict: true })) throw fail('invalid_currency');
      j.currency = getAddress(j.currency).toLowerCase();
    } else if (j.bucket !== undefined || j.currency !== undefined) throw fail('unexpected_fee_argument');
    if (j.kind === 'commitment_checkpoint') j.tokenId = String(uint(j.tokenId));
    else if (j.tokenId !== undefined) throw fail('unexpected_token');
    if (j.kind === 'arb_claim') j.beneficiary = addr(j.beneficiary);
    else if (j.beneficiary !== undefined) throw fail('unexpected_recipient');
    j.minimumAmount = String(uint(j.minimumAmount ?? '1'));
  }
  return m;
}

export function marketV2Abi(name) {
  if (!Object.values(kinds).some(([a]) => a === name)) throw fail('invalid_artifact');
  return JSON.parse(fs.readFileSync(path.join(root, 'omerta-contracts', 'out', `${name}.sol`, `${name}.json`))).abi;
}

export function makeMarketV2Clients(manifest, { rpcUrl, signing = false, privateKey } = {}) {
  if (!rpcUrl || !/^https?:\/\//.test(rpcUrl)) throw fail('rpc_required');
  const chain = defineChain({ id: manifest.chainId, name: 'Omerta market deployment', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 15000, retryCount: 1 }) });
  if (!signing) return { publicClient };
  if (!/^0x[0-9a-f]{64}$/i.test(privateKey || '')) throw fail('keeper_key_required');
  const account = privateKeyToAccount(privateKey);
  if (account.address.toLowerCase() !== manifest.keeper) throw fail('signer_mismatch');
  return { publicClient, account, walletClient: createWalletClient({ chain, account, transport: http(rpcUrl) }) };
}

const modulus = 1n << 256n;
const word = n => toHex((BigInt(n) % modulus + modulus) % modulus, { size: 32 });
const slotAdd = (slot, offset) => word(BigInt(slot) + BigInt(offset));
const hashWords = (a, b) => keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }], [a, b]));
const storageAbi = [{ type: 'function', name: 'extsload', stateMutability: 'view', inputs: [{ type: 'bytes32[]' }], outputs: [{ type: 'bytes32[]' }] }];

// Read-only projection of the pinned v4-core StateLibrary (POOLS_SLOT=6, TICKS=4,
// POSITIONS=6) and Position.update. Currency growth subtraction deliberately wraps
// uint256. This never authorizes a call: real contract simulation remains mandatory.
export function marketV2PendingFees(words, liquidity, lower, upper) {
  if (!Array.isArray(words) || words.length !== 10 || words.some(w => !/^0x[0-9a-f]{64}$/i.test(w))) throw fail('invalid_pool_storage');
  const w = words.map(BigInt);
  if ((w[3] & ((1n << 128n) - 1n)) !== liquidity) throw fail('position_custody_mismatch');
  const rawTick = Number((w[0] >> 160n) & ((1n << 24n) - 1n));
  const tick = rawTick >= 1 << 23 ? rawTick - (1 << 24) : rawTick;
  const sub = x => (x % modulus + modulus) % modulus;
  const inside = side => tick < lower ? sub(w[6 + side] - w[8 + side])
    : tick >= upper ? sub(w[8 + side] - w[6 + side]) : sub(w[1 + side] - w[6 + side] - w[8 + side]);
  return { native: sub(inside(0) - w[4]) * liquidity / (1n << 128n), omr: sub(inside(1) - w[5]) * liquidity / (1n << 128n), tick };
}

async function pendingFees(client, block, controller, tranche, position) {
  const abi = marketV2Abi('OmertaStabilityControllerV2');
  const read = (functionName, args = []) => client.readContract({ address: controller, abi, functionName, args, blockNumber: block.number });
  const [manager, poolId] = await Promise.all([read('manager'), read('poolId')]);
  const base = hashWords(poolId, word(6));
  const salt = keccak256(encodeAbiParameters([{ type: 'uint8' }, { type: 'uint64' }], [tranche, position.nonce]));
  const positionKey = keccak256(encodePacked(['address', 'int24', 'int24', 'bytes32'], [controller, position.lower, position.upper, salt]));
  const owned = hashWords(positionKey, slotAdd(base, 6));
  const lower = hashWords(word(position.lower), slotAdd(base, 4));
  const upper = hashWords(word(position.upper), slotAdd(base, 4));
  const slots = [base, slotAdd(base, 1), slotAdd(base, 2), owned, slotAdd(owned, 1), slotAdd(owned, 2),
    slotAdd(lower, 1), slotAdd(lower, 2), slotAdd(upper, 1), slotAdd(upper, 2)];
  const words = await client.readContract({ address: manager, abi: storageAbi, functionName: 'extsload', args: [slots], blockNumber: block.number });
  return marketV2PendingFees(words, position.liquidity, position.lower, position.upper);
}

async function jobArgs(j, target, block, client, abi) {
  const read = (functionName, args = [], address = target.address, readAbi = abi) => client.readContract({ address, abi: readAbi, functionName, args, blockNumber: block.number });
  const min = BigInt(j.minimumAmount);
  switch (j.kind) {
    case 'refresh': {
      const s = await read('snapshot'); const source = await read('source');
      const duration = BigInt(await read('epochDuration', [], source, marketV2Abi('OmertaHookV2')));
      return block.timestamp / duration > s.epoch + 1n ? [] : null;
    }
    case 'hook_claim': return await read('owed', [j.currency, j.bucket]) >= min ? [j.currency, j.bucket] : null;
    case 'funding_flush': {
      const token = await read('omr');
      const tokenAbi = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }];
      const [native, omr] = await Promise.all([client.getBalance({ address: target.address, blockNumber: block.number }), read('balanceOf', [target.address], token, tokenAbi)]);
      return native >= min || omr >= min ? [] : null;
    }
    case 'lp_collect': {
      const p = await read('position', [j.tranche]); if (p.liquidity === 0n) return null;
      const fees = await pendingFees(client, block, target.address, j.tranche, p);
      return fees.native >= min || fees.omr >= min ? [j.tranche] : null;
    }
    case 'lp_claim': {
      const a = await read('account', [j.tranche]); return a.nativeFees >= min || a.omrFees >= min ? [j.tranche] : null;
    }
    case 'lp_finalize': {
      const p = await read('position', [j.tranche]); if (p.liquidity === 0n || block.number <= p.deployedBlock) return null;
      const { tick } = await pendingFees(client, block, target.address, j.tranche, p);
      return j.tranche <= 2 ? tick >= p.upper ? [j.tranche] : null : tick <= p.lower ? [j.tranche] : null;
    }
    case 'turf_expire': return block.timestamp >= await read('turfSeasonEnd') && (await read('position', [6])).liquidity > 0n ? [] : null;
    case 'lp_deploy': case 'lp_recover': case 'lp_regenerate': {
      if (await read('paused')) return null;
      const source = await read('marketState'); const s = await read('snapshot', [], source, marketV2Abi('OmertaMarketStateV2'));
      if (!s.valid || s.epoch === 0n || s.observedAt === 0n || s.observedAt > block.timestamp) return null;
      const a = await read('account', [j.tranche]);
      if (j.kind === 'lp_deploy' && ((await read('position', [j.tranche])).liquidity !== 0n || s.epoch <= a.lastDeploymentEpoch)) return null;
      if (j.kind === 'lp_recover' && (s.epoch <= a.lastRecoveryEpoch || s.observedAt <= a.lastRecoveryAt)) return null;
      if (j.kind === 'lp_regenerate' && (s.epoch !== a.lastRecoveryEpoch || a.recoverySamples < Number(await read('recoveryY'))
          || (await read('position', [j.tranche])).liquidity !== 0n)) return null;
      return [j.tranche, s.epoch];
    }
    case 'turf_checkpoint': {
      if (await read('closed')) return null;
      const source = await read('source'); if (source === zeroAddress) return null;
      const sourceAbi = marketV2Abi('OmertaStabilityControllerV2');
      const p = await read('position', [6], source, sourceAbi);
      if (p.liquidity > 0n && block.timestamp >= await read('turfSeasonEnd', [], source, sourceAbi)) return [];
      const a = await read('account', [6], source, sourceAbi);
      if (a.nativeFees >= min || a.omrFees >= min) return [];
      if (await read('claimedNativeFees', [6], source, sourceAbi) - await read('forwardedNative') >= min
          || await read('claimedOmrFees', [6], source, sourceAbi) - await read('forwardedOmr') >= min) return [];
      if (p.liquidity === 0n) return null;
      const fees = await pendingFees(client, block, source, 6, p);
      return fees.native >= min || fees.omr >= min ? [] : null;
    }
    case 'commitment_checkpoint': {
      const p = await read('commitment', [BigInt(j.tokenId)]);
      if (p.withdrawn || p.depositor === zeroAddress || await read('paused')) return null;
      const source = await read('marketState'); const s = await read('snapshot', [], source, marketV2Abi('OmertaMarketStateV2'));
      // Invalid readings intentionally reset the anchor on chain; repeatedly paying for the
      // same already-broken anchor does no useful work. Never credit intervals off chain.
      if (!s.valid || s.epoch === 0n || s.omrPerEth === 0n || s.minLiquidity < await read('minimumMarketLiquidity')
          || s.observedAt > block.timestamp || s.observedAt < p.depositedAt
          || block.timestamp - s.observedAt > BigInt(await read('maxObservationAge'))) return p.lastObservedAt > 0n ? [BigInt(j.tokenId)] : null;
      return s.epoch > p.lastEpoch && s.observedAt > p.lastObservedAt && p.lastObservedAt < p.maturesAt ? [BigInt(j.tokenId)] : null;
    }
    case 'bond_proceeds': return await read('proceedsOwed') >= min ? [] : null;
    case 'arb_claim': return await read('claimable', [j.beneficiary]) >= min ? [j.beneficiary] : null;
    default: throw fail('invalid_job');
  }
}

export async function planMarketV2(input, clients, { completedJobKeys = [], now } = {}) {
  const m = validateMarketV2Manifest(input); const pub = clients.publicClient;
  const currentTime = typeof now === 'function' ? now : () => now ?? Math.floor(Date.now() / 1000);
  const fresh = b => b.hash && b.number !== null && b.number !== undefined
    && b.timestamp <= BigInt(currentTime()) + 5n && BigInt(currentTime()) - b.timestamp <= BigInt(m.gas.maxSnapshotAgeSeconds);
  if (Number(await pub.getChainId()) !== m.chainId) throw fail('wrong_chain');
  const block = await pub.getBlock({ blockTag: 'latest' });
  if (!fresh(block)) throw fail('stale_block');
  // Runtime hashes bind executable code and embedded immutables. The deployment plan
  // separately verifies constructor storage and one-time bindings before activation.
  await Promise.all(Object.values(m.contracts).map(async c => {
    const code = await pub.getCode({ address: c.address, blockNumber: block.number });
    if (!code || code === '0x' || keccak256(code).toLowerCase() !== c.runtimeHash) throw fail('runtime_mismatch');
  }));
  const actions = []; const blocked = [];
  for (const j of m.jobs) {
    const target = m.contracts[j.target]; const abi = marketV2Abi(target.artifact);
    const jobKey = `marketv2:${j.id}:${block.timestamp / BigInt(j.intervalSeconds)}`;
    if (completedJobKeys.includes(jobKey)) { blocked.push({ jobId: j.id, reason: 'interval_already_attempted' }); continue; }
    try {
      const args = await jobArgs(j, target, block, pub, abi);
      if (args === null) { blocked.push({ jobId: j.id, reason: 'not_ready' }); continue; }
      const functionName = kinds[j.kind][1];
      await pub.simulateContract({ address: target.address, abi, functionName, args, account: m.keeper, blockNumber: block.number });
      actions.push({ jobKey, target: target.address, targetCodeHash: target.runtimeHash, functionName, args,
        request: { data: encodeFunctionData({ abi, functionName, args }), value: '0' },
        gasBudget: { key: 'market-v2-gas', period: String(block.timestamp / 86400n), limit: m.gas.dailyBudget },
        accountingRequired: false, metadata: { jobId: j.id, kind: j.kind, sourceBlock: String(block.number), sourceHash: block.hash } });
    } catch { blocked.push({ jobId: j.id, reason: 'read_or_simulation_rejected' }); }
  }
  const same = await pub.getBlock({ blockNumber: block.number });
  if (same.hash !== block.hash) throw fail('snapshot_reorg');
  if (!fresh(block)) throw fail('stale_block');
  return { chainId: m.chainId, blockNumber: String(block.number), blockHash: block.hash, actions, blocked };
}

export async function runMarketV2(pool, input, clients, { dryRun = true } = {}) {
  const m = validateMarketV2Manifest(input);
  if (!dryRun && !process.env.DATABASE_URL) throw fail('postgres_required');
  if (!dryRun) {
    const pending = await reconcileKeeperTransactions(pool, { chainId: m.chainId, wallet: m.keeper, clients,
      allowedTargets: Object.fromEntries(Object.values(m.contracts).map(c => [c.address, c.runtimeHash])) });
    if (pending.state !== 'idle') return pending;
  }
  const initial = await planMarketV2(m, clients);
  const rows = pool ? await keeperTransactionStatus(pool, { chainId: m.chainId, wallet: m.keeper, jobKeys: initial.actions.map(a => a.jobKey) }) : [];
  const plan = { ...initial, actions: initial.actions.filter(a => !rows.some(r => r.jobKey === a.jobKey)) };
  if (dryRun) return { state: 'planned', plan };
  if (!plan.actions.length) return { state: 'idle', plan };
  return runKeeperTransaction(pool, { ...plan.actions[0], chainId: m.chainId, wallet: m.keeper, clients,
    maxGas: m.gas.maxGas, maxFeePerGas: m.gas.maxFeePerGas, maxPriorityFeePerGas: m.gas.maxPriorityFeePerGas, confirmations: m.gas.confirmations });
}
