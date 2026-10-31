#!/usr/bin/env node
// Pinned-block read-only verification. No wallet client, private keys, or chain writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, http, parseAbi, keccak256, toHex, encodeAbiParameters, zeroAddress } from 'viem';
import { buildPlayerGenesisDeploymentPlan, PLAYER_GENESIS_ROLES } from './player-genesis-deployment-plan.js';
import { RESTRICTED_MARKET_POLICY_ID, RESTRICTED_MARKET_SUPPLY, RESTRICTED_MARKET_TRADE_FEE_BPS } from './market-v2-deployment-plan.js';

const norm = x => Array.isArray(x) ? x.map(norm) : x && typeof x === 'object'
  ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, norm(v)])) : typeof x === 'string' ? x.toLowerCase() : String(x);
function same(label, actual, expected) {
  if (JSON.stringify(norm(actual)) !== JSON.stringify(norm(expected))) throw Error(`${label}: live binding mismatch`);
}
function requireTrue(label, condition) { if (!condition) throw Error(label); }
const POOL_ABI = { type: 'tuple', components: [
  { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' },
  { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' },
] };
const POOL_SIGNATURE = '(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)';
const poolValues = key => [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks];
const MAX_FUTURE_CLOCK_SKEW_SECONDS = 15n;

export async function preflightPlayerGenesis(input, client, { phase = 'predeploy', confirmations = 5, now = Date.now, ...buildOptions } = {}) {
  if (!['predeploy', 'prepared'].includes(phase)) throw Error('phase must be predeploy or prepared');
  if (!Number.isInteger(confirmations) || confirmations < 5) throw Error('At least five confirmations required');
  if (typeof now !== 'function') throw Error('Wall clock function required');
  const wallClock = () => {
    const milliseconds = now();
    requireTrue('Wall clock must return nonnegative safe integer milliseconds', Number.isSafeInteger(milliseconds) && milliseconds >= 0);
    return BigInt(Math.floor(milliseconds / 1000));
  };
  const plan = buildPlayerGenesisDeploymentPlan(input, buildOptions);
  const checkWallClock = (label, timestamp, wall) => {
    requireTrue(`${label} timestamp is in the future relative to wall clock`, timestamp <= wall + MAX_FUTURE_CLOCK_SKEW_SECONDS);
    requireTrue(`${label} timestamp is stale relative to wall clock`, timestamp >= wall - BigInt(input.snapshot.maxAgeSeconds));
  };
  same('chain ID', await client.getChainId(), plan.chainId);
  const blockNumber = BigInt(input.snapshot.blockNumber);
  const [tip, block] = await Promise.all([client.getBlock(), client.getBlock({ blockNumber })]);
  same('snapshot block hash', block.hash, input.snapshot.blockHash);
  same('snapshot timestamp', block.timestamp, input.snapshot.timestamp);
  requireTrue('Snapshot needs five confirmations', tip.number >= blockNumber + BigInt(confirmations));
  requireTrue('Snapshot is stale or from the future', tip.timestamp >= block.timestamp
    && tip.timestamp - block.timestamp <= BigInt(input.snapshot.maxAgeSeconds));
  const initialWall = wallClock();
  checkWallClock('Snapshot', block.timestamp, initialWall);
  checkWallClock('RPC tip', tip.timestamp, initialWall);
  const read = (address, signature, functionName, args = []) => client.readContract({ address, abi: parseAbi([signature]), functionName, args, blockNumber });
  const checkCode = async (label, address, expected) => {
    const code = await client.getBytecode({ address, blockNumber });
    requireTrue(`${label}: deployed code required`, Boolean(code && code !== '0x'));
    same(`${label} runtime`, keccak256(code), expected);
  };
  const { safe, deployer } = plan.roles, g = input.governance;
  await Promise.all([
    checkCode('governance Safe', safe, g.runtimeHash),
    checkCode('Safe singleton', g.singleton, g.singletonRuntimeHash),
    checkCode('Safe fallback handler', g.fallbackHandler, g.fallbackHandlerRuntimeHash),
    ...Object.entries(plan.externalRuntimePins).map(([label, x]) => checkCode(label, x.address, x.runtimeHash)),
    checkCode('CREATE2 factory', plan.create2Factory.factory, plan.create2Factory.runtimeHash),
    ...input.restrictedMarket.additionalOperators.map(x => checkCode('additional custody operator', x.address, x.runtimeHash)),
    ...input.restrictedMarket.contractHolders.map(x => checkCode('additional receiving holder', x.address, x.runtimeHash)),
  ]);
  const rewardPool = plan.steps.find(x => x.kind === 'deployment' && x.role === 'btcConverter').constructorArgs[3];
  same('WBTC decimals', await read(plan.externalRuntimePins.wbtc.address,
    'function decimals() view returns (uint8)', 'decimals'), 8);
  // The external dependency must be the reviewed standard v4 manager: its pools mapping is slot 6,
  // and active liquidity is at offset 3 (v4-core StateLibrary). This is configuration admission only;
  // nonzero liquidity is not a quote or executable-depth proof for any conversion amount.
  const rewardPoolId = keccak256(encodeAbiParameters([POOL_ABI], [rewardPool]));
  const rewardPoolSlot = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [rewardPoolId, 6n]));
  const rewardLiquiditySlot = toHex((BigInt(rewardPoolSlot) + 3n) % (1n << 256n), { size: 32 });
  const [rewardSlot0, rewardLiquidityWord] = await Promise.all([rewardPoolSlot, rewardLiquiditySlot].map(slot =>
    read(plan.externalRuntimePins.rewardManager.address, 'function extsload(bytes32) view returns (bytes32)', 'extsload', [slot])));
  requireTrue('Reward pool state response missing', [rewardSlot0, rewardLiquidityWord].every(x => /^0x[\da-fA-F]{64}$/.test(x || '')));
  const rewardSqrtPrice = BigInt(rewardSlot0) & ((1n << 160n) - 1n);
  const rewardLiquidity = BigInt(rewardLiquidityWord) & ((1n << 128n) - 1n);
  requireTrue('Reward ETH/WBTC pool must be initialized before deployment', rewardSqrtPrice !== 0n);
  requireTrue('Reward ETH/WBTC pool must have active liquidity before deployment', rewardLiquidity !== 0n);
  const owners = await read(safe, 'function getOwners() view returns (address[])', 'getOwners');
  same('Safe owners', owners.map(x => x.toLowerCase()).sort(), g.owners.map(x => x.toLowerCase()).sort());
  same('Safe threshold', await read(safe, 'function getThreshold() view returns (uint256)', 'getThreshold'), g.threshold);
  same('Safe VERSION', await read(safe, 'function VERSION() view returns (string)', 'VERSION'), '1.4.1');
  const slot = async key => {
    const value = await client.getStorageAt({ address: safe, slot: key, blockNumber });
    requireTrue('Safe storage response missing', /^0x[\da-fA-F]{64}$/.test(value || '')); return value;
  };
  same('Safe singleton', `0x${(await slot(`0x${'00'.repeat(32)}`)).slice(-40)}`, g.singleton);
  same('Safe guard', BigInt(await slot(keccak256(toHex('guard_manager.guard.address')))), 0n);
  same('Safe fallback handler', `0x${(await slot(keccak256(toHex('fallback_manager.handler.address')))).slice(-40)}`, g.fallbackHandler);
  const sentinel = '0x0000000000000000000000000000000000000001';
  const [modules, next] = await read(safe, 'function getModulesPaginated(address start,uint256 pageSize) view returns (address[] array,address next)',
    'getModulesPaginated', [sentinel, 1n]);
  same('Safe module count', modules.length, 0); same('Safe module sentinel', next, sentinel);
  const deployerCode = await client.getBytecode({ address: deployer, blockNumber });
  requireTrue('Deployer must be an undelegated EOA', !deployerCode || deployerCode === '0x');
  const nonce = BigInt(input.startingNonce) + (phase === 'prepared' ? BigInt(PLAYER_GENESIS_ROLES.length + 1) : 0n);
  const [latestNonce, pendingNonce] = await Promise.all([
    client.getTransactionCount({ address: deployer, blockTag: 'latest' }), client.getTransactionCount({ address: deployer, blockTag: 'pending' }),
  ]);
  same('deployer latest nonce', latestNonce, nonce); same('deployer pending nonce', pendingNonce, nonce);
  const arbSys = '0x0000000000000000000000000000000000000064';
  const arbCode = await client.getBytecode({ address: arbSys, blockNumber });
  const clock = arbCode && arbCode !== '0x'
    ? await read(arbSys, 'function arbBlockNumber() view returns (uint256)', 'arbBlockNumber') : block.number;
  same('native auction clock', clock, input.snapshot.auctionClock);
  requireTrue('Auction already started at pinned clock', BigInt(plan.auctionParameters.startBlock) > BigInt(clock));
  if (phase === 'predeploy') {
    await Promise.all(Object.entries(plan.addresses).map(async ([role, address]) => {
      const code = await client.getBytecode({ address, blockNumber });
      requireTrue(`${role}: predicted address is occupied`, !code || code === '0x');
    }));
  } else {
    await Promise.all(Object.entries(plan.addresses).map(([role, address]) => checkCode(role, address, plan.runtimeHashes[role])));
    const { omr, poolManager: manager, positionManager: positions, hook, coordinator, auction, btcRewards, btcConverter } = plan.addresses;
    const getters = async (address, fields) => Promise.all(fields.map(async ([fn, type, value]) =>
      same(fn, await read(address, `function ${fn}() view returns (${type})`, fn), value)));
    await getters(omr, [['owner', 'address', safe], ['genesisTreasury', 'address', safe], ['policySealed', 'bool', true],
      ['genesisTreasuryRuntimeHash', 'bytes32', input.governance.runtimeHash],
      ['settlementManager', 'address', manager], ['REVENUE_POLICY_ID', 'bytes32', RESTRICTED_MARKET_POLICY_ID],
      ['totalSupply', 'uint256', RESTRICTED_MARKET_SUPPLY], ['decimals', 'uint8', 18]]);
    await getters(manager, [['owner', 'address', safe], ['omr', 'address', omr], ['TRADE_FEE_BPS', 'uint16', RESTRICTED_MARKET_TRADE_FEE_BPS],
      ['revenuePolicyId', 'bytes32', RESTRICTED_MARKET_POLICY_ID], ['developerRecipient', 'address', plan.roles.dev],
      ['rwaRecipient', 'address', plan.roles.rwa], ['communityRecipient', 'address', plan.roles.community], ['polRecipient', 'address', plan.addresses.polFunding],
      ['rewardsRecipient', 'address', btcRewards], ['MAX_HOOK_FEE_BPS', 'uint16', 50]]);
    await getters(positions, [['poolManager', 'address', manager], ['permit2', 'address', plan.externalRuntimePins.permit2.address]]);
    await getters(plan.addresses.router, [['manager', 'address', manager], ['omr', 'address', omr]]);
    await getters(hook, [['authorized', 'address', coordinator], ['rewardsRecipient', 'address', btcRewards],
      ['managerCollectsRevenue', 'bool', true], ['REWARDS_BPS', 'uint16', 50]]);
    await getters(btcRewards, [['safe', 'address', safe], ['wbtc', 'address', plan.externalRuntimePins.wbtc.address],
      ['omr', 'address', omr], ['omrRouter', 'address', plan.addresses.router], ['converter', 'address', btcConverter],
      ['routerRuntimeHash', 'bytes32', plan.runtimeHashes.router], ['converterRuntimeHash', 'bytes32', plan.runtimeHashes.btcConverter],
      ['wbtcRuntimeHash', 'bytes32', plan.externalRuntimePins.wbtc.runtimeHash], ['MAX_PROOF_LENGTH', 'uint256', 64],
      ['MAX_DEADLINE_DELAY', 'uint256', 86400]]);
    await getters(btcConverter, [['authorizedVault', 'address', btcRewards], ['wbtc', 'address', plan.externalRuntimePins.wbtc.address],
      ['externalManager', 'address', plan.externalRuntimePins.rewardManager.address], ['poolFee', 'uint24', rewardPool.fee],
      ['poolTickSpacing', 'int24', rewardPool.tickSpacing], ['managerRuntimeHash', 'bytes32', plan.externalRuntimePins.rewardManager.runtimeHash],
      ['wbtcRuntimeHash', 'bytes32', plan.externalRuntimePins.wbtc.runtimeHash], ['MAX_DEADLINE_DELAY', 'uint256', 86400]]);
    same('reward converter PoolKey', poolValues(await read(btcConverter,
      `function poolKey() view returns (${POOL_SIGNATURE})`, 'poolKey')), poolValues(rewardPool));
    same('reward vault OMR PoolKey', poolValues(await read(btcRewards,
      `function omrPool() view returns (${POOL_SIGNATURE})`, 'omrPool')), poolValues(plan.canonicalPool));
    await getters(coordinator, [['auction', 'address', auction], ['playerSale', 'address', zeroAddress], ['publicOnly', 'bool', true], ['omr', 'address', omr],
      ['poolManager', 'address', manager], ['positionManager', 'address', positions], ['permit2', 'address', plan.externalRuntimePins.permit2.address],
      ['liquidityOwner', 'address', input.coordinator.liquidityOwner], ['treasury', 'address', input.coordinator.treasury],
      ['vig', 'address', input.coordinator.vig], ['founder', 'address', input.coordinator.founder],
      ['tokenReserve', 'uint128', input.coordinator.tokenReserve], ['playerMigrationSucceeded', 'bool', false], ['chainId', 'uint256', plan.chainId],
      ['INITIAL_LP_BPS', 'uint16', plan.genesisLiquidityPolicy.initialLpBps],
      ['LIQUIDITY_LOCK_SECONDS', 'uint256', plan.genesisLiquidityPolicy.minimumCustodySeconds],
      ['migrationTimestamp', 'uint256', 0], ['liquidityUnlockTimestamp', 'uint256', 0], ['liquidityPositionId', 'uint256', 0],
      ['minimumTokenReserve', 'uint256', plan.inventories.minimumLiquidity],
      ['auctionCodeHash', 'bytes32', plan.runtimeHashes.auction], ['saleCodeHash', 'bytes32', `0x${'00'.repeat(32)}`],
      ['hookCodeHash', 'bytes32', plan.runtimeHashes.hook]]);
    const publicFields = Object.entries(plan.auctionParameters).filter(([k]) => k !== 'auctionStepsData');
    for (const [name, value] of publicFields) {
      await getters(auction, [[name, typeof value === 'string' && value.startsWith('0x') ? 'address' : 'uint256', value]]);
    }
    await getters(auction, [['token', 'address', omr], ['totalSupply', 'uint128', plan.inventories.public],
      ['launchGate', 'address', coordinator], ['launchGateCodeHash', 'bytes32', plan.runtimeHashes.coordinator],
      ['launchChainId', 'uint256', plan.chainId], ['inventoryFunded', 'bool', true], ['tokensReceived', 'bool', true]]);
    await getters(coordinator, [['inventoryFunded', 'bool', true]]);
    const readiness = plan.steps.find(x => x.label === 'Verify the exact complete operator and contract-holder registries immediately before sealing').required;
    same('operator count', await read(omr, 'function operatorCount() view returns (uint256)', 'operatorCount'), readiness.operatorCount);
    for (const operator of readiness.operators) {
      same('operatorAt', await read(omr, 'function operatorAt(uint256) view returns (address)', 'operatorAt', [BigInt(operator.index)]), operator.operatorAt);
      same('operator role', await read(omr, 'function operatorRole(address) view returns (uint8)', 'operatorRole', [operator.operatorAt]), operator.operatorRole);
      same('operator runtime pin', await read(omr, 'function operatorRuntimeHash(address) view returns (bytes32)', 'operatorRuntimeHash', [operator.operatorAt]), operator.operatorRuntimeHash);
    }
    same('contract holder count', await read(omr, 'function contractHolderCount() view returns (uint256)', 'contractHolderCount'), readiness.contractHolderCount);
    for (const holder of readiness.contractHolders) {
      same('contractHolderAt', await read(omr, 'function contractHolderAt(uint256) view returns (address)', 'contractHolderAt', [BigInt(holder.index)]), holder.contractHolderAt);
      same('holder runtime pin', await read(omr, 'function contractHolderRuntimeHash(address) view returns (bytes32)', 'contractHolderRuntimeHash', [holder.contractHolderAt]), holder.contractHolderRuntimeHash);
    }
    same('reward vault receiving-only admission', await read(omr, 'function isRecipient(address) view returns (bool)', 'isRecipient', [btcRewards]), true);
    same('reward vault must not be an operator', await read(omr, 'function operatorRole(address) view returns (uint8)', 'operatorRole', [btcRewards]), 0);
    same('converter must not be an operator', await read(omr, 'function operatorRole(address) view returns (uint8)', 'operatorRole', [btcConverter]), 0);
    same('converter must not be a contract holder', await read(omr,
      'function contractHolderRuntimeHash(address) view returns (bytes32)', 'contractHolderRuntimeHash', [btcConverter]), `0x${'00'.repeat(32)}`);
    same('converter must not be an OMR recipient', await read(omr, 'function isRecipient(address) view returns (bool)', 'isRecipient', [btcConverter]), false);
    for (const [address, expected] of [[safe, plan.inventories.retainedBySafe], [auction, plan.inventories.public],
      [coordinator, plan.inventories.liquidity]])
      same('exact OMR inventory', await read(omr, 'function balanceOf(address) view returns (uint256)', 'balanceOf', [address]), expected);
    for (const spender of [auction, coordinator])
      same('revoked inventory allowance', await read(omr, 'function allowance(address,address) view returns (uint256)', 'allowance', [safe, spender]), 0n);
    for (const wallet of readiness.registeredWallets) {
      same('registered receiving wallet', await read(omr, 'function isRecipient(address) view returns (bool)', 'isRecipient', [wallet.address]), true);
      const code = await client.getBytecode({ address: wallet.address, blockNumber });
      requireTrue('Receiving wallet gained unreviewed/delegated code', !code || code === '0x');
    }
    for (const recipient of [input.auction.unsoldRecipient, input.coordinator.liquidityOwner, input.coordinator.treasury])
      same('launch recovery recipient', await read(omr, 'function isRecipient(address) view returns (bool)', 'isRecipient', [recipient]), true);
    for (const target of [hook, coordinator]) {
      const key = await read(target, 'function poolKey() view returns ((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks))', 'poolKey');
      const expected = plan.canonicalPool;
      same('canonical PoolKey', [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
        [expected.currency0, expected.currency1, expected.fee, expected.tickSpacing, expected.hooks]);
    }
    // PoolManager's reviewed source preserves the v4-core pools mapping at slot 6.
    const poolSlot = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [plan.canonicalPool.poolId, 6n]));
    same('canonical pool must remain uninitialized', await read(manager, 'function extsload(bytes32) view returns (bytes32)', 'extsload', [poolSlot]), `0x${'00'.repeat(32)}`);
  }
  const finalTip = await client.getBlock();
  requireTrue('Snapshot became stale during preflight', finalTip.timestamp >= block.timestamp
    && finalTip.timestamp - block.timestamp <= BigInt(input.snapshot.maxAgeSeconds));
  const latestClock = phase === 'prepared'
    ? await client.readContract({ address: plan.addresses.auction,
      abi: parseAbi(['function blockNumberish() view returns (uint256)']), functionName: 'blockNumberish', blockNumber: finalTip.number })
    : arbCode && arbCode !== '0x' ? await client.readContract({ address: arbSys,
      abi: parseAbi(['function arbBlockNumber() view returns (uint256)']), functionName: 'arbBlockNumber', blockNumber: finalTip.number }) : finalTip.number;
  requireTrue('Auction already started at latest native clock', BigInt(plan.auctionParameters.startBlock) > BigInt(latestClock));
  same('snapshot reorg check', (await client.getBlock({ blockNumber })).hash, block.hash);
  // Sample after the last RPC await: even slow final clock/reorg reads must not outlive freshness.
  const finalWall = wallClock();
  checkWallClock('Snapshot at completion', block.timestamp, finalWall);
  checkWallClock('RPC tip at completion', finalTip.timestamp, finalWall);
  return { ok: true, phase, chainId: plan.chainId, blockNumber: String(block.number), blockHash: block.hash,
    timestamp: String(block.timestamp), auctionClock: String(clock), latestAuctionClock: String(latestClock), manifestSha256: plan.manifestSha256,
    rewardRoute: { poolId: rewardPoolId, pool: rewardPool, sqrtPriceX96: String(rewardSqrtPrice), liquidity: String(rewardLiquidity),
      initialized: true, activeLiquidityObserved: true, executableDepthForBudgetVerified: false },
    freshness: { wallClockTimestamp: String(finalWall), maxAgeSeconds: input.snapshot.maxAgeSeconds,
      maximumFutureClockSkewSeconds: String(MAX_FUTURE_CLOCK_SKEW_SECONDS) },
    limits: 'Read-only configuration evidence; does not replace scoped security review, fork rehearsal, owner acceptance or transaction simulation.' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let rpc;
  try {
    const [file, phase] = process.argv.slice(2);
    if (!file || !['predeploy', 'prepared'].includes(phase) || process.argv.length !== 4)
      throw Error('Usage: CHAIN_RPC_URL=https://... node tools/player-genesis-preflight.js <manifest.json> <predeploy|prepared>');
    rpc = process.env.CHAIN_RPC_URL;
    if (new URL(rpc).protocol !== 'https:') throw Error('CHAIN_RPC_URL must use HTTPS');
    const result = await preflightPlayerGenesis(JSON.parse(fs.readFileSync(file, 'utf8')),
      createPublicClient({ transport: http(rpc, { retryCount: 1, timeout: 15000 }) }), { phase });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const message = String(error.shortMessage || error.message || error);
    process.stderr.write(`player-genesis-preflight: ${rpc ? message.replaceAll(rpc, '<redacted-rpc>') : message}\n`);
    process.exitCode = 1;
  }
}
