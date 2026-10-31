import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decodeFunctionData, encodeAbiParameters, getAddress, getContractAddress, keccak256, toHex, zeroAddress } from 'viem';
import { buildPlayerGenesisDeploymentPlan, loadPlayerGenesisArtifact,
  PLAYER_GENESIS_ROLES, predictPlayerGenesisAddresses, minimumGenesisTokenReserve,
  GENESIS_INITIAL_LP_BPS, GENESIS_LIQUIDITY_LOCK_SECONDS } from '../tools/player-genesis-deployment-plan.js';
import { preflightPlayerGenesis as preflightWithClock } from '../tools/player-genesis-preflight.js';
import { buildGenesisCadenceEvidence } from '../src/genesiscadence.js';

const A = n => getAddress(`0x${BigInt(n).toString(16).padStart(40, '0')}`);
const CODE = '0x6001600055', H = keccak256(CODE), E = 10n ** 18n;
const clone = x => JSON.parse(JSON.stringify(x));
const json = x => JSON.stringify(x, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
// The fixture has an explicit synthetic 2033 clock. Production/CLI callers default to actual Date.now.
const preflightPlayerGenesis = (input, client, options = {}) => preflightWithClock(input, client,
  { now: () => Number(BigInt(input.snapshot.timestamp) + 5n) * 1000, ...options });
const POOL_ABI = { type: 'tuple', components: [
  { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' },
  { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' },
] };
const poolOnly = key => Object.fromEntries(POOL_ABI.components.map(({ name }) => [name, key[name]]));
const rewardPoolFor = input => ({ currency0: zeroAddress, currency1: input.external.wbtc.address,
  fee: input.policies.rewards.fee, tickSpacing: input.policies.rewards.tickSpacing, hooks: zeroAddress });
function rewardSlots(input) {
  const id = keccak256(encodeAbiParameters([POOL_ABI], [rewardPoolFor(input)]));
  const slot = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [id, 6n]));
  return { slot, liquidity: toHex((BigInt(slot) + 3n) % (1n << 256n), { size: 32 }) };
}

/** Synthetic local-only values. This is never a mainnet configuration or approved allocation. */
export function playerGenesisDeploymentExample() {
  const baseResult = spawnSync(process.execPath, ['test/market-v2-deployment-plan.js', '--example'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (baseResult.status !== 0) throw Error(baseResult.stderr);
  const b = JSON.parse(baseResult.stdout);
  const { initializer: _i, capitalProvider: _c, ...roles } = b.roles;
  const contractNames = [...new Set(PLAYER_GENESIS_ROLES.map(([, c]) => c))];
  return {
    schemaVersion: 2, route: 'guarded-public-auction', chainId: 31337, localRehearsal: true, sourceRevision: b.sourceRevision,
    startingNonce: b.startingNonce, roles,
    snapshot: { timestamp: b.snapshot.timestamp, blockNumber: b.snapshot.blockNumber, blockHash: H, auctionClock: '1000', maxAgeSeconds: '300' },
    governance: { runtimeHash: H, owners: [A(0x71001), A(0x71002), A(0x71003)], threshold: 2,
      singleton: A(0x71004), singletonRuntimeHash: H, fallbackHandler: A(0x71005), fallbackHandlerRuntimeHash: H },
    external: Object.fromEntries(['permit2', 'weth', 'descriptor', 'wbtc', 'rewardManager']
      .map((k, i) => [k, { address: A(0x72000 + i), runtimeHash: H }])),
    positionManager: { unsubscribeGasLimit: '100000' }, create2: { ...b.create2, runtimeHash: H },
    artifactHashes: Object.fromEntries(contractNames.map(c => [c, loadPlayerGenesisArtifact(c).evidence.artifactSha256])),
    runtimeHashes: Object.fromEntries(PLAYER_GENESIS_ROLES.map(([role]) => [role, H])),
    restrictedMarket: { additionalOperators: [], contractHolders: [] }, policies: b.policies, season: b.season,
    auction: { inventory: String(2_000_000n * E), unsoldRecipient: roles.safe, startBlock: '2000', endBlock: '2005', claimBlock: '2010',
      tickSpacing: '1000', floorPrice: String((1n << 80n) / 1000n * 1000n), requiredCurrencyRaised: String(E),
      steps: [{ mps: '1750000', blockDelta: '4' }, { mps: '3000000', blockDelta: '1' }] },
    coordinator: { tokenReserve: String(2_000_000n * E), liquidityOwner: roles.safe, treasury: roles.safe, vig: A(0x74001), founder: roles.dev },
  };
}

/** Structurally valid, synthetic mainnet-profile fixture; no live address or cadence evidence. */
function mainnetProfileExample(input) {
  const mainnet = clone(input), snapshot = Number(mainnet.snapshot.timestamp);
  mainnet.chainId = 4663;
  mainnet.localRehearsal = false;
  mainnet.external.wbtc.address = getAddress('0x6bac06600d220ac5ac281ad1f504d2cf0f90f6e6');
  mainnet.snapshot.auctionClock = '50000180';
  mainnet.snapshot.blockNumber = '50000280';
  const cadence = buildGenesisCadenceEvidence({
    chainId: 4663, rpcClass: 'public', generatedAt: new Date(snapshot * 1000).toISOString(),
    samples: [0, 1, 2, 3, 4].map(index => ({ elapsedMs: index * 45_000,
      observedAt: new Date((snapshot - 180 + index * 45) * 1000).toISOString(),
      blockNumberish: String(50_000_000 + index * 45), latestBlock: String(50_000_100 + index * 45),
      latestTimestamp: String(snapshot - 180 + index * 45), finalizedBlock: String(50_000_080 + index * 45) })),
  });
  const start = 50_000_200n, duration = cadence.summary.auctionBlocks;
  mainnet.auction = { ...mainnet.auction, cadence: JSON.parse(json(cadence)), inventory: String(60_000_000n * E),
    startBlock: String(start), endBlock: String(start + duration), claimBlock: String(start + duration + cadence.summary.claimDelayBlocks),
    floorPrice: '26410000000000000000000', tickSpacing: '26410000000000000000', requiredCurrencyRaised: String(20n * E),
    steps: [{ mps: '1', blockDelta: String(duration - 1n) }, { mps: String(10_000_000n - duration + 1n), blockDelta: '1' }] };
  mainnet.coordinator.tokenReserve = String(30_000_001n * E);
  return mainnet;
}

function predeployClient(input, changes = {}) {
  const plan = buildPlayerGenesisDeploymentPlan(input);
  const rewardStorage = rewardSlots(input);
  const occupied = new Set([input.roles.safe, input.governance.singleton, input.governance.fallbackHandler,
    ...Object.values(input.external).map(x => x.address), input.create2.factory, A(100),
    ...input.restrictedMarket.additionalOperators.map(x => x.address), ...input.restrictedMarket.contractHolders.map(x => x.address)]
    .map(x => x.toLowerCase()));
  const block = { number: BigInt(input.snapshot.blockNumber), hash: H, timestamp: BigInt(input.snapshot.timestamp) };
  const ownerAddress = x => `0x${x.slice(2).padStart(64, '0')}`;
  return { plan, client: {
    getChainId: async () => input.chainId,
    getBlock: async x => x?.blockNumber !== undefined ? block : { ...block, number: block.number + 5n, timestamp: block.timestamp + 5n },
    getBytecode: async ({ address }) => occupied.has(address.toLowerCase()) ? CODE : '0x',
    getTransactionCount: async () => Number(input.startingNonce),
    getStorageAt: async ({ slot }) => BigInt(slot) === 0n ? ownerAddress(input.governance.singleton)
      : slot === keccak256('0x67756172645f6d616e616765722e67756172642e61646472657373') ? `0x${'00'.repeat(32)}`
        : ownerAddress(input.governance.fallbackHandler),
    readContract: async ({ address, functionName, args = [] }) => {
      if (address.toLowerCase() === input.external.wbtc.address.toLowerCase() && functionName === 'decimals') return 8;
      if (address.toLowerCase() === input.external.rewardManager.address.toLowerCase() && functionName === 'extsload') {
        if (args[0] === rewardStorage.slot) return toHex(1n << 96n, { size: 32 });
        if (args[0] === rewardStorage.liquidity) return toHex(1000n * E, { size: 32 });
        throw Error('Unexpected synthetic reward manager storage slot');
      }
      return ({ getOwners: input.governance.owners, getThreshold: BigInt(input.governance.threshold),
        VERSION: '1.4.1', getModulesPaginated: [[], A(1)], arbBlockNumber: BigInt(input.snapshot.auctionClock) })[functionName];
    },
    ...changes,
  } };
}

function preparedClient(input) {
  const { plan, client } = predeployClient(input), a = plan.addresses;
  const registry = plan.steps.find(x => x.label === 'Verify the exact complete operator and contract-holder registries immediately before sealing').required;
  const fields = {
    omr: { owner: input.roles.safe, genesisTreasury: input.roles.safe, genesisTreasuryRuntimeHash: input.governance.runtimeHash,
      policySealed: true, settlementManager: a.poolManager, REVENUE_POLICY_ID: plan.restrictedMarket.policyId,
      totalSupply: 100_000_000n * E, decimals: 18, operatorCount: registry.operatorCount, contractHolderCount: registry.contractHolderCount },
    poolManager: { owner: input.roles.safe, omr: a.omr, TRADE_FEE_BPS: 400, MAX_HOOK_FEE_BPS: 50,
      revenuePolicyId: plan.restrictedMarket.policyId, rewardsRecipient: a.btcRewards,
      developerRecipient: input.roles.dev, rwaRecipient: input.roles.rwa, communityRecipient: input.roles.community, polRecipient: a.polFunding,
      extsload: `0x${'00'.repeat(32)}` },
    positionManager: { poolManager: a.poolManager, permit2: input.external.permit2.address },
    router: { manager: a.poolManager, omr: a.omr },
    hook: { authorized: a.coordinator, poolKey: plan.canonicalPool, rewardsRecipient: a.btcRewards, managerCollectsRevenue: true, REWARDS_BPS: 50 },
    btcRewards: { safe: input.roles.safe, wbtc: input.external.wbtc.address, omr: a.omr, omrRouter: a.router,
      converter: a.btcConverter, routerRuntimeHash: H, converterRuntimeHash: H, wbtcRuntimeHash: H,
      MAX_PROOF_LENGTH: 64, MAX_DEADLINE_DELAY: 86400, omrPool: plan.canonicalPool },
    btcConverter: { authorizedVault: a.btcRewards, wbtc: input.external.wbtc.address,
      externalManager: input.external.rewardManager.address, poolFee: input.policies.rewards.fee,
      poolTickSpacing: input.policies.rewards.tickSpacing, managerRuntimeHash: H, wbtcRuntimeHash: H,
      MAX_DEADLINE_DELAY: 86400, poolKey: rewardPoolFor(input) },
    coordinator: { auction: a.auction, playerSale: zeroAddress, publicOnly: true, omr: a.omr, poolManager: a.poolManager,
      positionManager: a.positionManager, permit2: input.external.permit2.address, ...input.coordinator,
      playerMigrationSucceeded: false, chainId: input.chainId, auctionCodeHash: H, saleCodeHash: `0x${'00'.repeat(32)}`, hookCodeHash: H,
      INITIAL_LP_BPS: GENESIS_INITIAL_LP_BPS, LIQUIDITY_LOCK_SECONDS: GENESIS_LIQUIDITY_LOCK_SECONDS,
      migrationTimestamp: 0n, liquidityUnlockTimestamp: 0n, liquidityPositionId: 0n,
      inventoryFunded: true, minimumTokenReserve: plan.inventories.minimumLiquidity, poolKey: plan.canonicalPool },
    auction: { ...plan.auctionParameters, token: a.omr, totalSupply: input.auction.inventory, launchGate: a.coordinator,
      launchGateCodeHash: H, launchChainId: input.chainId, inventoryFunded: true, tokensReceived: true, blockNumberish: BigInt(input.snapshot.auctionClock) },
  };
  const balances = new Map([[input.roles.safe.toLowerCase(), plan.inventories.retainedBySafe], [a.auction.toLowerCase(), plan.inventories.public],
    [a.coordinator.toLowerCase(), plan.inventories.liquidity]]);
  const roleByAddress = new Map(Object.entries(a).map(([role, address]) => [address.toLowerCase(), role]));
  return { plan, client: { ...client,
    getTransactionCount: async () => Number(input.startingNonce) + PLAYER_GENESIS_ROLES.length + 1,
    getBytecode: async x => roleByAddress.has(x.address.toLowerCase()) ? CODE : client.getBytecode(x),
    readContract: async request => {
      const role = roleByAddress.get(request.address.toLowerCase()), { functionName: fn, args = [] } = request;
      if (!role) return client.readContract(request);
      const contract = PLAYER_GENESIS_ROLES.find(([r]) => r === role)[1];
      assert.ok(plan.artifacts[contract].abi.some(x => x.type === 'function' && x.name === fn), `${contract}.${fn} must exist in the compiled ABI`);
      if (role === 'omr') {
        if (fn === 'balanceOf') return balances.get(args[0].toLowerCase()) || 0n;
        if (fn === 'allowance') return 0n;
        if (fn === 'isRecipient') return args[0].toLowerCase() !== a.btcConverter.toLowerCase();
        if (fn === 'operatorAt') return registry.operators[Number(args[0])].operatorAt;
        if (fn === 'operatorRole') return registry.operators.find(x => x.operatorAt.toLowerCase() === args[0].toLowerCase())?.operatorRole || 0;
        if (fn === 'operatorRuntimeHash') return registry.operators.find(x => x.operatorAt.toLowerCase() === args[0].toLowerCase()).operatorRuntimeHash;
        if (fn === 'contractHolderAt') return registry.contractHolders[Number(args[0])].contractHolderAt;
        if (fn === 'contractHolderRuntimeHash') return registry.contractHolders.find(x => x.contractHolderAt.toLowerCase() === args[0].toLowerCase())?.contractHolderRuntimeHash || `0x${'00'.repeat(32)}`;
      }
      if (!(fn in (fields[role] || {}))) throw Error(`Synthetic prepared state lacks ${role}.${fn}`);
      return fields[role][fn];
    },
  } };
}

if (process.argv.includes('--example')) {
  process.stdout.write(`${json(playerGenesisDeploymentExample())}\n`);
} else {
  const fixture = playerGenesisDeploymentExample(), plan = buildPlayerGenesisDeploymentPlan(fixture);
  let count = 0;
  const test = async (name, fn) => { await fn(); count++; console.log(`PASS ${name}`); };
  await test('all nineteen nonce-bound deployments bind the reward vault and converter before the hook', () => {
    const deployments = plan.steps.filter(x => x.kind === 'deployment');
    assert.equal(plan.steps[0].kind, 'readiness');
    assert.equal(plan.steps[0].label, 'Verify pinned WBTC asset and reward conversion route before deployments');
    assert.equal(plan.steps[0].transaction, undefined);
    assert.equal(deployments.length, 19);
    for (const [index, d] of deployments.entries()) {
      assert.equal(d.transaction.nonce, String(BigInt(fixture.startingNonce) + BigInt(index)));
      if (d.role !== 'hook') assert.equal(d.expectedAddress, getContractAddress({ from: fixture.roles.deployer, nonce: BigInt(d.transaction.nonce) }));
    }
    const predicted = predictPlayerGenesisAddresses(fixture.roles.deployer, fixture.startingNonce);
    assert.equal(predicted.auction, plan.addresses.auction);
    assert.equal(plan.nextDeployerNonceAfterDeployments, String(BigInt(fixture.startingNonce) + 19n));
    assert.equal(plan.addresses.playerSale, undefined);
    assert.equal(plan.artifacts.GenesisPlayerSale, undefined);
    assert.equal(plan.runtimeHashes.playerSale, undefined);
    assert.deepEqual(deployments.find(x => x.role === 'poolManager').constructorArgs[2],
      [fixture.roles.dev, fixture.roles.rwa, fixture.roles.community, plan.addresses.polFunding]);
    assert.equal(deployments.find(x => x.role === 'poolManager').constructorArgs[3], plan.addresses.btcRewards);
    assert.equal(deployments.find(x => x.role === 'hook').constructorArgs[2], plan.addresses.coordinator);
    assert.equal(deployments.find(x => x.role === 'hook').constructorArgs.at(-1), plan.addresses.btcRewards);
    assert.equal(deployments.find(x => x.role === 'coordinator').constructorArgs[4], plan.addresses.hook);
    assert.deepEqual(deployments.slice(4, 6).map(x => x.role), ['btcRewards', 'btcConverter']);
  });
  await test('reward constructors bind future vault and converter addresses and exact external runtimes', () => {
    const deployment = role => plan.steps.find(x => x.kind === 'deployment' && x.role === role);
    assert.deepEqual(deployment('btcRewards').constructorArgs, [{ safe: fixture.roles.safe,
      wbtc: fixture.external.wbtc.address, omr: plan.addresses.omr, omrRouter: plan.addresses.router,
      omrPool: poolOnly(plan.canonicalPool), converter: plan.addresses.btcConverter,
      routerRuntimeHash: fixture.runtimeHashes.router, converterRuntimeHash: fixture.runtimeHashes.btcConverter }]);
    assert.deepEqual(deployment('btcConverter').constructorArgs, [plan.addresses.btcRewards, fixture.external.wbtc.address,
      fixture.external.rewardManager.address, rewardPoolFor(fixture), fixture.external.rewardManager.runtimeHash,
      fixture.external.wbtc.runtimeHash]);
    const registry = plan.steps.find(x => x.label === 'Verify the exact complete operator and contract-holder registries immediately before sealing').required;
    assert.ok(registry.contractHolders.some(x => x.contractHolderAt === plan.addresses.btcRewards
      && x.contractHolderRuntimeHash === fixture.runtimeHashes.btcRewards));
    assert.ok(!registry.operators.some(x => [plan.addresses.btcRewards, plan.addresses.btcConverter].includes(x.operatorAt)));
    assert.ok(!registry.contractHolders.some(x => x.contractHolderAt === plan.addresses.btcConverter));
    const changed = clone(fixture); changed.runtimeHashes.btcConverter = `0x${'33'.repeat(32)}`;
    const changedPlan = buildPlayerGenesisDeploymentPlan(changed);
    assert.equal(changedPlan.steps.find(x => x.kind === 'deployment' && x.role === 'btcRewards')
      .constructorArgs[0].converterRuntimeHash, changed.runtimeHashes.btcConverter);
    assert.notEqual(changedPlan.steps.find(x => x.kind === 'deployment' && x.role === 'btcRewards').initCodeHash,
      deployment('btcRewards').initCodeHash);
  });
  await test('single public route contains no player tranche, eligibility or extra wait and preserves explicit public inventory', () => {
    assert.equal(plan.route, 'guarded-public-auction');
    assert.equal(plan.schemaVersion, 2);
    assert.equal(plan.eligibility, undefined);
    assert.equal(plan.playerDeadlines, undefined);
    assert.equal(plan.inventories.player, undefined);
    assert.equal(plan.inventories.public, fixture.auction.inventory);
    assert.equal(plan.inventories.retainedBySafe, String(96_000_000n * E));
    assert.equal(plan.auctionParameters.validationHook, zeroAddress);
    assert.equal(plan.auctionParameters.claimBlock, fixture.auction.claimBlock);
    assert.ok(plan.steps.every(x => x.role !== 'playerSale'));
    assert.ok(plan.steps.every(x => !['bind', 'openPlayerSale', 'settleAndRelease', 'migratePublicAfterCancellation'].includes(x.functionName)));
    const changed = clone(fixture); changed.auction.inventory = String(3_000_000n * E);
    const explicit = buildPlayerGenesisDeploymentPlan(changed);
    assert.equal(explicit.inventories.public, changed.auction.inventory);
    assert.equal(explicit.inventories.retainedBySafe, String(95_000_000n * E));
  });
  await test('bind follows deployment and exact typed inventory pulls follow irreversible sealing', () => {
    const bind = plan.steps.findIndex(x => x.role === 'coordinator' && x.functionName === 'bindPublicAuction');
    assert.ok(plan.steps.filter(x => x.kind === 'deployment').every(x => plan.steps.indexOf(x) < bind));
    const seal = plan.steps.findIndex(x => x.functionName === 'sealPolicy');
    assert.ok(seal > bind);
    assert.deepEqual(plan.steps.filter(x => x.functionName === 'fundInventory').map(x => x.role), ['coordinator', 'auction']);
    assert.deepEqual(plan.steps[bind].args, [plan.addresses.auction]);
    for (const call of plan.steps.filter(x => x.functionName === 'fundInventory')) {
      assert.ok(plan.steps.indexOf(call) > seal);
      assert.equal(call.transaction.from, fixture.roles.safe);
      const artifact = plan.artifacts[PLAYER_GENESIS_ROLES.find(([role]) => role === call.role)[1]];
      assert.equal(decodeFunctionData({ abi: artifact.abi, data: call.transaction.data }).functionName, 'fundInventory');
      const index = plan.steps.indexOf(call), approval = plan.steps[index - 1], revoke = plan.steps[index + 1];
      const expected = BigInt(call.role === 'auction' ? fixture.auction.inventory : fixture.coordinator.tokenReserve);
      for (const [step, amount] of [[approval, expected], [revoke, 0n]]) {
        const decoded = decodeFunctionData({ abi: plan.artifacts.OmertaRestrictedOMRV2.abi, data: step.transaction.data });
        assert.equal(decoded.functionName, 'approve');
        assert.deepEqual(decoded.args, [plan.addresses[call.role], amount]);
        assert.equal(step.transaction.from, fixture.roles.safe);
      }
    }
    assert.equal(plan.steps.some(x => ['initialize', 'modifyLiquidities', 'transfer'].includes(x.functionName)), false);
    const registry = plan.steps[seal - 1].required;
    for (const role of ['auction', 'coordinator']) assert.ok(registry.operators.some(x => x.operatorAt === plan.addresses[role] && x.operatorRole === 2));
  });
  await test('Genesis LP policy preserves half the accepted ETH and locks principal after successful migration', () => {
    assert.equal(GENESIS_INITIAL_LP_BPS, 5000);
    assert.equal(GENESIS_LIQUIDITY_LOCK_SECONDS, 7_776_000);
    assert.deepEqual(plan.genesisLiquidityPolicy, {
      initialLpBps: 5000, minimumCustodySeconds: 7_776_000, custodyClock: 'seconds after successful migration',
      claimCliffAlsoRequired: true, lockedPositionOwner: plan.addresses.coordinator,
      releasedPositionOwner: fixture.coordinator.liquidityOwner, feeRecipient: fixture.coordinator.liquidityOwner,
      feesCollectibleDuringCustody: true, residualSplitBps: { treasury: 4000, vig: 3600, founder: 2400 },
    });
    assert.ok(plan.executionConditions.some(line => line.includes('90 days after successful migration')));
    const oldReserve = mainnetProfileExample(fixture);
    oldReserve.coordinator.tokenReserve = String(22_500_001n * E);
    assert.throws(() => buildPlayerGenesisDeploymentPlan(oldReserve), /tokenReserve must be at least/);
  });
  await test('guarded output contains no primary-sale allocation, price or dates inferred from defaults', () => {
    assert.equal(plan.inventories.public, fixture.auction.inventory);
    assert.equal(plan.auctionParameters.floorPrice, fixture.auction.floorPrice);
    for (const mutate of [x => delete x.auction.inventory, x => delete x.auction.startBlock, x => delete x.coordinator.founder,
      x => delete x.external.permit2.runtimeHash, x => delete x.external.wbtc, x => delete x.external.rewardManager.runtimeHash,
      x => delete x.runtimeHashes.btcRewards, x => delete x.runtimeHashes.btcConverter, x => delete x.policies.rewards,
      x => { x.policies.rewards.hooks = A(99); }, x => { x.rewards = { converterRuntimeHash: H }; },
      x => { x.runtimeHashes.btcConverter = plan.artifacts.OmertaWbtcConverterV2.runtimeTemplateKeccak256; },
      x => { x.restrictedMarket.additionalOperators.push({ address: predictPlayerGenesisAddresses(x.roles.deployer, x.startingNonce).btcConverter,
        role: 2, runtimeHash: H, purpose: 'Unneeded converter custody privilege' }); },
      x => { x.restrictedMarket.contractHolders.push({ address: predictPlayerGenesisAddresses(x.roles.deployer, x.startingNonce).btcConverter,
        runtimeHash: H, purpose: 'Unneeded converter receiving privilege' }); },
      x => delete x.runtimeHashes.coordinator, x => { x.schemaVersion = 1; }, x => { x.route = 'guarded-player-genesis'; }, x => { delete x.route; },
      x => { x.auction.steps[0].mps = '1'; }, x => { x.auction.startBlock = x.snapshot.auctionClock; },
      x => { x.auction.inventory = String(100_000_000n * E); },
      x => { x.player = { inventory: String(1_000_000n * E), eligibility: [] }; },
      x => { x.runtimeHashes.playerSale = H; }, x => { x.artifactHashes.GenesisPlayerSale = 'ab'.repeat(32); },
      x => { x.auction.validationHook = A(99); }, x => { x.auction.claimBlock = x.auction.startBlock; }, x => { x.artifactHashes.OmertaGuardedAuction = '00'.repeat(32); },
      x => { x.coordinator.treasury = A(0x77777); },
      x => { x.auction.unsoldRecipient = predictPlayerGenesisAddresses(x.roles.deployer, x.startingNonce).commitment; },
      x => { x.runtimeHashes.coordinator = plan.artifacts.OmertaGenesisCoordinatorV2.runtimeTemplateKeccak256; },
      x => { x.restrictedMarket.additionalOperators = [{ address: x.roles.safe, role: 2, runtimeHash: H, purpose: 'bad arbitrary owner operator' }]; },
      x => { x.privateKey = 'forbidden'; }]) {
      const changed = clone(fixture); mutate(changed); assert.throws(() => buildPlayerGenesisDeploymentPlan(changed));
    }
  });
  await test('mainnet profile requires approved economics, fresh native cadence and exact auction and claim periods', () => {
    const mainnet = mainnetProfileExample(fixture);
    const production = buildPlayerGenesisDeploymentPlan(mainnet);
    assert.equal(BigInt(production.auctionParameters.endBlock) - BigInt(production.auctionParameters.startBlock), 604_800n);
    assert.equal(BigInt(production.auctionParameters.claimBlock) - BigInt(production.auctionParameters.endBlock), 86_400n);
    assert.equal(production.auctionCadence.evidenceSha256, mainnet.auction.cadence.evidenceSha256);
    for (const [mutate, reason] of [
      [x => { delete x.auction.cadence; }, /cadence/],
      [x => { x.auction.cadence.summary.auctionBlocks = '5'; }, /recomputed/],
      [x => { x.auction.cadence.evidenceSha256 = '00'.repeat(32); }, /recomputed/],
      [x => { x.snapshot.timestamp = String(BigInt(x.snapshot.timestamp) + 3601n); }, /one hour/],
      [x => { x.auction.cadence.generatedAt = new Date((Number(x.snapshot.timestamp) + 1) * 1000).toISOString(); }, /recomputed/],
      [x => { x.snapshot.auctionClock = '50000179'; }, /ahead/],
      [x => { x.snapshot.maxAgeSeconds = '301'; }, /300/],
      [x => { x.auction.inventory = String(2_000_000n * E); }, /60000000.*20 ETH/],
      [x => { x.auction.requiredCurrencyRaised = String(E); }, /60000000.*20 ETH/],
      [x => { x.auction.claimBlock = x.auction.endBlock; }, /one-day cliff/],
      [x => { x.auction.endBlock = String(BigInt(x.auction.startBlock) + 5n);
        x.auction.claimBlock = x.auction.endBlock; x.auction.steps = clone(fixture.auction.steps); }, /seven-day/],
      [x => { x.localRehearsal = true; delete x.auction.cadence; }, /cadence/],
    ]) {
      const changed = clone(mainnet); mutate(changed);
      assert.throws(() => buildPlayerGenesisDeploymentPlan(changed), reason);
    }
    const local = clone(fixture); local.auction.claimBlock = local.auction.endBlock;
    assert.equal(buildPlayerGenesisDeploymentPlan(local).auctionCadence, null);
  });
  await test('offline reserve and CCA constructor checks reject unexecutable funding before deployment', () => {
    const minimum = BigInt(plan.inventories.minimumLiquidity);
    assert.ok(minimum > 1_000_000n * E);
    const exact = clone(fixture); exact.coordinator.tokenReserve = String(minimum);
    assert.equal(buildPlayerGenesisDeploymentPlan(exact).inventories.minimumLiquidity, String(minimum));
    for (const [mutate, reason] of [
      [x => { x.coordinator.tokenReserve = '1'; }, /tokenReserve must be at least/],
      [x => { x.coordinator.tokenReserve = String(minimum - 1n); }, /tokenReserve must be at least/],
      [x => { x.auction.requiredCurrencyRaised = '1'; }, /rounding/],
      [x => { x.auction.floorPrice = String(1n << 32n); x.auction.tickSpacing = '2'; }, /native CCA minimum/],
      [x => { x.auction.floorPrice = String(BigInt(x.auction.floorPrice) + 1n); }, /align/],
      [x => { x.auction.tickSpacing = '1'; }, /spacing/],
    ]) {
      const changed = clone(fixture); mutate(changed);
      assert.throws(() => buildPlayerGenesisDeploymentPlan(changed), reason);
    }
    const supply = 60_000_000n * E;
    const maximumBidPrice = [((1n << 154n) / supply) ** 2n, (1n << 222n) / supply].reduce((a, b) => a < b ? a : b);
    const productionMinimum = minimumGenesisTokenReserve({ supply, floorPrice: 26_410_000_000_000_000_000_000n,
      maximumBidPrice, spacing: 60, minimumRaise: 20n * E });
    assert.ok(productionMinimum > 30_000_000n * E && productionMinimum < 30_000_001n * E);
  });
  await test('manifest and constructor hashes bind explicit inventory, schedule and nonce', () => {
    assert.equal(buildPlayerGenesisDeploymentPlan(clone(fixture)).manifestSha256, plan.manifestSha256);
    for (const mutate of [x => { x.auction.inventory = String(3_000_000n * E); },
      x => { x.auction.claimBlock = '2011'; }, x => { x.startingNonce = String(BigInt(x.startingNonce) + 1n); }]) {
      const changed = clone(fixture); mutate(changed);
      const next = buildPlayerGenesisDeploymentPlan(changed);
      assert.notEqual(next.manifestSha256, plan.manifestSha256);
      assert.notEqual(next.steps.find(x => x.role === 'auction' && x.kind === 'deployment').initCodeHash,
        plan.steps.find(x => x.role === 'auction' && x.kind === 'deployment').initCodeHash);
    }
  });
  await test('predeploy validates Safe configuration, native clock, empty addresses and exact EOA nonce', async () => {
    const { client } = predeployClient(fixture);
    assert.equal((await preflightPlayerGenesis(fixture, client)).ok, true);
    await assert.rejects(() => preflightPlayerGenesis(fixture, { ...client, getTransactionCount: async () => Number(fixture.startingNonce) + 1 }), /nonce/);
    await assert.rejects(() => preflightPlayerGenesis(fixture, { ...client, getBytecode: async () => CODE }), /Deployer/);
    await assert.rejects(() => preflightPlayerGenesis(fixture, { ...client, readContract: async x => x.functionName === 'getModulesPaginated'
      ? [[A(99)], A(1)] : client.readContract(x) }), /module/);
    await assert.rejects(() => preflightPlayerGenesis(fixture, { ...client, getBlock: async x => x?.blockNumber !== undefined
      ? { number: 123n, hash: `0x${'11'.repeat(32)}`, timestamp: 2000000000n } : client.getBlock(x) }), /hash/);
    const wrongClock = clone(fixture); wrongClock.snapshot.auctionClock = '999';
    await assert.rejects(() => preflightPlayerGenesis(wrongClock, client), /auction clock/);
    await assert.rejects(() => preflightPlayerGenesis(fixture, client, { confirmations: 0 }), /five/);
    let tipReads = 0;
    await assert.rejects(() => preflightPlayerGenesis(fixture, { ...client, getBlock: async request => {
      const b = await client.getBlock(request);
      return request?.blockNumber !== undefined || ++tipReads === 1 ? b
        : { ...b, timestamp: BigInt(fixture.snapshot.timestamp) + BigInt(fixture.snapshot.maxAgeSeconds) + 1n };
    } }), /became stale/);
  });
  await test('predeploy requires exact pinned WBTC and initialized liquid reward pool without claiming budget depth', async () => {
    const { client } = predeployClient(fixture), requests = [];
    const result = await preflightPlayerGenesis(fixture, { ...client,
      readContract: request => { requests.push(request); return client.readContract(request); } });
    assert.equal(result.rewardRoute.initialized, true);
    assert.equal(result.rewardRoute.activeLiquidityObserved, true);
    assert.equal(result.rewardRoute.executableDepthForBudgetVerified, false);
    assert.equal(result.rewardRoute.sqrtPriceX96, String(1n << 96n));
    assert.equal(result.rewardRoute.liquidity, String(1000n * E));
    assert.deepEqual(result.rewardRoute.pool, rewardPoolFor(fixture));
    const externalReads = requests.filter(x => [fixture.external.wbtc.address, fixture.external.rewardManager.address].includes(x.address));
    assert.equal(externalReads.length, 3);
    assert.ok(externalReads.every(x => x.blockNumber === BigInt(fixture.snapshot.blockNumber)));
    for (const role of ['wbtc', 'rewardManager']) await assert.rejects(() => preflightPlayerGenesis(fixture, { ...client,
      getBytecode: request => request.address === fixture.external[role].address ? '0x6002' : client.getBytecode(request),
    }), new RegExp(`${role} runtime`));
    await assert.rejects(() => preflightPlayerGenesis(fixture, { ...client,
      readContract: request => request.functionName === 'decimals' ? 18 : client.readContract(request),
    }), /WBTC decimals/);
    const slots = rewardSlots(fixture);
    for (const [slot, value, reason] of [
      [slots.slot, toHex(1n << 200n, { size: 32 }), /must be initialized/],
      [slots.liquidity, toHex(1n << 200n, { size: 32 }), /must have active liquidity/],
      [slots.slot, '0x01', /state response missing/],
    ]) await assert.rejects(() => preflightPlayerGenesis(fixture, { ...client,
      readContract: request => request.address === fixture.external.rewardManager.address && request.args?.[0] === slot
        ? value : client.readContract(request),
    }), reason);
  });
  await test('wall clock rejects coherent replayed RPC state and future clocks at entry and completion', async () => {
    const { client } = predeployClient(fixture);
    const snapshot = BigInt(fixture.snapshot.timestamp), milliseconds = seconds => Number(seconds) * 1000;
    // RPC blocks, hashes, clocks and nonces remain coherent; only the independent wall time advances.
    await assert.rejects(() => preflightPlayerGenesis(fixture, client,
      { now: () => milliseconds(snapshot + BigInt(fixture.snapshot.maxAgeSeconds) + 1n) }), /stale relative to wall clock/);
    await assert.rejects(() => preflightPlayerGenesis(fixture, client,
      { now: () => milliseconds(snapshot - 16n) }), /future relative to wall clock/);
    let clockReads = 0;
    await assert.rejects(() => preflightPlayerGenesis(fixture, client,
      { now: () => milliseconds(snapshot + (++clockReads === 1 ? 5n : 301n)) }), /completion.*stale relative to wall clock/);
    clockReads = 0;
    await assert.rejects(() => preflightPlayerGenesis(fixture, client,
      { now: () => milliseconds(snapshot + (++clockReads === 1 ? 5n : -16n)) }), /completion.*future relative to wall clock/);
    let wall = snapshot + 5n, anchoredReads = 0;
    await assert.rejects(() => preflightPlayerGenesis(fixture, { ...client,
      getBlock: async request => {
        const block = await client.getBlock(request);
        if (request?.blockNumber !== undefined && ++anchoredReads === 2) wall = snapshot + 301n;
        return block;
      },
    }, { now: () => milliseconds(wall) }), /completion.*stale relative to wall clock/);
    const fresh = await preflightPlayerGenesis(fixture, client);
    assert.deepEqual(fresh.freshness, { wallClockTimestamp: String(snapshot + 5n), maxAgeSeconds: fixture.snapshot.maxAgeSeconds,
      maximumFutureClockSkewSeconds: '15' });
    await assert.rejects(() => preflightPlayerGenesis(fixture, client, { now: 123 }), /Wall clock function/);
    await assert.rejects(() => preflightPlayerGenesis(fixture, client, { now: () => NaN }), /safe integer milliseconds/);
    const spoofed = clone(fixture); spoofed.now = milliseconds(snapshot + 5n);
    assert.throws(() => buildPlayerGenesisDeploymentPlan(spoofed), /unknown field/);
  });
  await test('prepared preflight refuses deployment-only or partially prepared stacks', async () => {
    const { client } = predeployClient(fixture);
    await assert.rejects(() => preflightPlayerGenesis(fixture, client, { phase: 'prepared' }), /nonce/);
    await assert.rejects(() => preflightPlayerGenesis(fixture, { ...client,
      getTransactionCount: async () => Number(fixture.startingNonce) + PLAYER_GENESIS_ROLES.length + 1 }, { phase: 'prepared' }), /deployed code required/);
  });
  await test('prepared verifies funded compiled-ABI bindings and rejects registry/inventory/latest-clock drift', async () => {
    const { client } = preparedClient(fixture);
    const requests = [];
    const result = await preflightPlayerGenesis(fixture, { ...client,
      readContract: request => { requests.push(request); return client.readContract(request); } }, { phase: 'prepared' });
    assert.equal(result.ok, true);
    assert.ok(requests.every(x => x.address !== zeroAddress));
    assert.ok(requests.every(x => !['merkleRoot', 'openDeadline', 'migrationDeadline', 'closesAt', 'released', 'cancelled'].includes(x.functionName)));
    const managerSource = fs.readFileSync(new URL('../omerta-contracts/src/market-v2/core/OmertaPoolManagerV2.sol', import.meta.url), 'utf8');
    const actualFee = Number(managerSource.match(/TRADE_FEE_BPS\s*=\s*(\d+)/)[1]);
    assert.equal((await preflightPlayerGenesis(fixture, { ...client,
      readContract: request => request.functionName === 'TRADE_FEE_BPS' ? actualFee : client.readContract(request) }, { phase: 'prepared' })).ok, true);
    for (const [name, override, message] of [
      ['TRADE_FEE_BPS', () => 500n, /TRADE_FEE_BPS/], ['REVENUE_POLICY_ID', () => H, /REVENUE_POLICY_ID/],
      ['MAX_HOOK_FEE_BPS', () => 100n, /MAX_HOOK_FEE_BPS/], ['REWARDS_BPS', () => 0n, /REWARDS_BPS/],
      ['rewardsRecipient', () => A(99), /rewardsRecipient/], ['managerCollectsRevenue', () => false, /managerCollectsRevenue/],
      ['authorizedVault', () => A(99), /authorizedVault/], ['wbtc', () => A(99), /wbtc/],
      ['omrRouter', () => A(99), /omrRouter/], ['converter', () => A(99), /converter/],
      ['externalManager', () => A(99), /externalManager/], ['poolFee', () => 500n, /poolFee/],
      ['poolTickSpacing', () => 1n, /poolTickSpacing/],
      ['routerRuntimeHash', () => `0x${'22'.repeat(32)}`, /routerRuntimeHash/],
      ['converterRuntimeHash', () => `0x${'22'.repeat(32)}`, /converterRuntimeHash/],
      ['managerRuntimeHash', () => `0x${'22'.repeat(32)}`, /managerRuntimeHash/],
      ['wbtcRuntimeHash', () => `0x${'22'.repeat(32)}`, /wbtcRuntimeHash/],
      ['MAX_PROOF_LENGTH', () => 65n, /MAX_PROOF_LENGTH/], ['MAX_DEADLINE_DELAY', () => 86401n, /MAX_DEADLINE_DELAY/],
      ['minimumTokenReserve', () => 1n, /minimumTokenReserve/], ['requiredCurrencyRaised', () => 1n, /requiredCurrencyRaised/],
      ['INITIAL_LP_BPS', () => 3750n, /INITIAL_LP_BPS/], ['LIQUIDITY_LOCK_SECONDS', () => 0n, /LIQUIDITY_LOCK_SECONDS/],
      ['migrationTimestamp', () => 1n, /migrationTimestamp/], ['liquidityUnlockTimestamp', () => 1n, /liquidityUnlockTimestamp/],
      ['liquidityPositionId', () => 1n, /liquidityPositionId/],
      ['operatorRole', () => 1n, /operator role/], ['balanceOf', () => 0n, /exact OMR inventory/],
      ['isRecipient', () => false, /receiving wallet|recovery recipient|reward vault receiving-only/], ['blockNumberish', () => 2000n, /latest native clock/],
      ['publicOnly', () => false, /publicOnly/],
      ['playerSale', () => A(99), /playerSale/], ['saleCodeHash', () => H, /saleCodeHash/],
      ['auctionCodeHash', () => `0x${'22'.repeat(32)}`, /auctionCodeHash/],
      ['launchGateCodeHash', () => `0x${'22'.repeat(32)}`, /launchGateCodeHash/],
      ['allowance', () => 1n, /revoked inventory allowance/],
      ['tokensReceived', () => false, /tokensReceived/],
    ]) await assert.rejects(() => preflightPlayerGenesis(fixture, { ...client,
      readContract: request => request.functionName === name ? override(request) : client.readContract(request) }, { phase: 'prepared' }), message);
    for (const [target, getter, expected] of [
      [plan.addresses.btcConverter, 'poolKey', /reward converter PoolKey/],
      [plan.addresses.btcRewards, 'omrPool', /reward vault OMR PoolKey/],
    ]) await assert.rejects(() => preflightPlayerGenesis(fixture, { ...client,
      readContract: request => request.address === target && request.functionName === getter
        ? { ...(getter === 'poolKey' ? rewardPoolFor(fixture) : plan.canonicalPool), hooks: A(99) }
        : client.readContract(request) }, { phase: 'prepared' }), expected);
    for (const [target, getter, value, expected] of [
      [plan.addresses.btcRewards, 'operatorRole', 2n, /reward vault must not be an operator/],
      [plan.addresses.btcConverter, 'operatorRole', 2n, /converter must not be an operator/],
      [plan.addresses.btcConverter, 'contractHolderRuntimeHash', H, /converter must not be a contract holder/],
      [plan.addresses.btcConverter, 'isRecipient', true, /converter must not be an OMR recipient/],
    ]) await assert.rejects(() => preflightPlayerGenesis(fixture, { ...client,
      readContract: request => request.address === plan.addresses.omr && request.functionName === getter
        && request.args?.[0] === target ? value : client.readContract(request) }, { phase: 'prepared' }), expected);
  });
  console.log(`player-genesis-deployment: ${count} focused checks passed`);
}
