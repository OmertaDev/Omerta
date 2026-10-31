import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decodeFunctionData, decodeAbiParameters, encodeAbiParameters, getContractAddress, getAddress,
  keccak256, toHex, parseAbi, zeroAddress } from 'viem';
import { MARKET_V2_ROLES, MARKET_V2_HOOK_FLAGS, RESTRICTED_MARKET_POLICY_ID, RESTRICTED_MARKET_SUPPLY, RESTRICTED_MARKET_TRADE_FEE_BPS, loadMarketV2Artifact, mineMarketV2Hook,
  buildMarketV2DeploymentPlan } from '../tools/market-v2-deployment-plan.js';

const A = n => getAddress(`0x${BigInt(n).toString(16).padStart(40, '0')}`);
const H = `0x${'19'.repeat(32)}`;
const E = 10n ** 18n;
const clone = x => JSON.parse(JSON.stringify(x));
const json = x => JSON.stringify(x, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);

/** Synthetic 31337-only example, with deliberately explicit test budgets, never live recommendations. */
export function marketV2DeploymentExample() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const sourceRevision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  const roles = Object.fromEntries(['safe', 'deployer', 'safeExecutor', 'adjudicator', 'initializer', 'dev', 'rwa', 'community', 'capitalProvider']
    .map((name, i) => [name, A(0x10000 + i)]));
  roles.capitalProvider = roles.safe;
  const artifactHashes = Object.fromEntries([...new Set(MARKET_V2_ROLES.map(([, c]) => c))]
    .map(c => [c, loadMarketV2Artifact(c).evidence.artifactSha256]));
  const limit = { nativePerAction: String(E), omrPerAction: String(E), nativePerEpisode: String(5n * E), omrPerEpisode: String(5n * E),
    nativeLifetime: String(100n * E), omrLifetime: String(100n * E), nativeRegeneration: String(E), omrRegeneration: String(E) };
  return {
    schemaVersion: 2, chainId: 31337, localRehearsal: true, sourceRevision, startingNonce: '17', roles,
    snapshot: { blockNumber: '123', blockHash: H, timestamp: '2000000000' },
    external: Object.fromEntries(['omr', 'poolManager', 'positionManager', 'permit2', 'wbtc', 'rewardManager'].map((k, i) => [k, { address: A(0x20000 + i), runtimeHash: H }])),
    restrictedMarket: { policyId: RESTRICTED_MARKET_POLICY_ID,
      operatorRuntimeHashes: Object.fromEntries(['hook', 'controller', 'bond', 'turf', 'arbitrage', 'router', 'positionManager', 'permit2'].map(k => [k, H])),
      additionalOperators: [], holderRuntimeHashes: Object.fromEntries(['polFunding', 'reserveFunding', 'turfFeeBridge', 'btcRewards'].map(k => [k, H])),
      contractHolders: [] },
    create2: { factory: A(0x30000), runtimeHash: H, kind: 'salt-prefix', saltStart: '0', maxAttempts: 200000 },
    artifactHashes,
    rewards: { converterRuntimeHash: H },
    policies: {
      rewards: { fee: 3000, tickSpacing: 60 },
      pool: { fee: 3000, tickSpacing: 60 },
      hook: { opening: { blocks: 200, buyBps: 50, maxBuyQuote: String(10n * E) }, surgeFullTicks: 100, epochDuration: 60 },
      market: { requiredLiquidity: String(500n * E), maxAge: '120', fullStressTicks: 100 },
      turf: { maxAge: 120 },
      stability: { limits: Array.from({ length: 7 }, () => clone(limit)), maxObservationAge: 120, cooldown: 60,
        recoveryInterval: 60, minLiquidity: String(500n * E), maxSpotDeviationTicks: 500, minBandTicks: 60,
        maxBandTicks: 600, stressOnBps: 6000, stressOffBps: 2000, recoveryX: 2, recoveryY: 3 },
      bond: { maxObservationAge: 120, vestingSeconds: 30 * 86400, minLiquidity: String(500n * E), maxSpotDeviationTicks: 500,
        discountBps: 50, minNativePurchase: String(E / 100n), maxNativePurchase: String(E), maxNativePerEpoch: String(5n * E),
        maxNativeLifetime: String(100n * E), maxOmrPerPurchase: String(2n * E), maxOmrPerEpoch: String(10n * E),
        maxOmrLifetime: String(200n * E), maxOmrPerEth: String(2n * E) },
      arbitrage: { reserveProfitBps: 2500, maxInput: String(E) },
      commitment: { maxAge: 120, minLiquidity: String(500n * E) },
    },
    season: { startsAt: '2000086400', endsAt: '2002678400', lowerTick: -600, upperTick: 600,
      families: [{ id: '1', treasury: A(0x40000) }], owners: { families: ['1', '0', '0', '0'], shares: [10000, 0, 0, 0], count: 1 } },
    bootstrap: { sqrtPriceX96: String(1n << 96n), liquidity: String(1000n * E), lowerTick: -887220, upperTick: 887220,
      maxNative: String(1001n * E), maxOmr: String(1001n * E), deadline: '2000003600', positionOwner: roles.safe },
    funding: { tranches: Array.from({ length: 7 }, () => ({ native: String(10n * E), omr: String(10n * E) })), bondOmr: String(100n * E) },
  };
}

if (process.argv.includes('--example')) {
  process.stdout.write(`${json(marketV2DeploymentExample())}\n`);
} else {
  const fixture = marketV2DeploymentExample();
  const plan = buildMarketV2DeploymentPlan(fixture);
  let passed = 0;
  const test = (name, fn) => { fn(); ++passed; console.log(`PASS ${name}`); };
  test('fourteen deployments bind reward contracts and preserve the exact companion CREATE sequence', () => {
    const ds = plan.steps.filter(x => x.kind === 'deployment');
    assert.equal(ds.length, 14);
    assert.equal(ds.filter(x => x.method === 'CREATE2').length, 1);
    ds.forEach((d, i) => {
      assert.equal(d.transaction.nonce, String(17 + i));
      if (d.role === 'hook') {
        assert.equal(BigInt(d.expectedAddress) & 0x3fffn, MARKET_V2_HOOK_FLAGS);
        assert.equal(d.expectedAddress, getContractAddress({ opcode: 'CREATE2', from: fixture.create2.factory, salt: d.salt, bytecodeHash: d.initCodeHash }));
        assert.equal(d.transaction.data.slice(0, 66), d.salt);
        assert.equal(keccak256(`0x${d.transaction.data.slice(66)}`), d.initCodeHash);
      } else assert.equal(d.expectedAddress, getContractAddress({ from: fixture.roles.deployer, nonce: BigInt(17 + i) }));
    });
    assert.equal(ds.at(-1).role, 'router');
    assert.deepEqual(ds.at(-1).constructorArgs, [fixture.external.poolManager.address, fixture.external.omr.address]);
  });
  test('hook constructor encodes all native funding recipients with immutable intended taxes', () => {
    const d = plan.steps.find(x => x.role === 'hook' && x.kind === 'deployment');
    const a = loadMarketV2Artifact('OmertaHookV2');
    const initCode = `0x${d.transaction.data.slice(66)}`;
    const decoded = decodeAbiParameters(a.abi.find(x => x.type === 'constructor').inputs, `0x${initCode.slice(a.bytecode.length)}`);
    assert.equal(decoded[0], fixture.external.poolManager.address);
    assert.equal(decoded[1], fixture.external.omr.address);
    assert.deepEqual(decoded[5], [fixture.roles.dev, fixture.roles.rwa, fixture.roles.community, plan.addresses.polFunding, plan.addresses.reserveFunding]);
    assert.equal(decoded[9], plan.addresses.btcRewards);
    assert.deepEqual(plan.economics.splitBps, { dev: 127, rwa: 51, community: 76, pol: 96 });
    assert.equal(plan.economics.sellBaseBps, 350);
    assert.equal(plan.economics.ordinaryBuyBps, 400);
    assert.equal(plan.economics.rewardsTradeBps, 50);
    assert.equal(plan.economics.totalTradeBps, 400);
    assert.equal(plan.economics.rewardsRecipient, plan.addresses.btcRewards);
    assert.equal(plan.economics.baseTradeBps, 350);
    assert.equal(plan.economics.enforcedBy, fixture.external.poolManager.address);
    assert.equal(plan.economics.primaryRecipients.pol, plan.addresses.polFunding);
    assert.equal(plan.economics.maximumCombinedTradeBps, 450);
    assert.equal(plan.economics.maximumCombinedEnforcedBy, fixture.external.poolManager.address);
    assert.equal(plan.economics.maximumSurgeBps, 50);
    assert.equal(plan.economics.maximumHookBps, 50);
    assert.equal(Object.values(plan.economics.splitBps).reduce((sum, bps) => sum + bps, 0), 350);
  });
  test('fee readbacks and output match the actual current manager policy', () => {
    const source = fs.readFileSync(new URL('../omerta-contracts/src/market-v2/core/OmertaPoolManagerV2.sol', import.meta.url), 'utf8');
    assert.equal(RESTRICTED_MARKET_TRADE_FEE_BPS, Number(source.match(/TRADE_FEE_BPS\s*=\s*(\d+)/)[1]));
    assert.equal(RESTRICTED_MARKET_POLICY_ID, keccak256(toHex(source.match(/revenuePolicyId\s*=\s*keccak256\("([^"]+)"\)/)[1])));
    assert.notEqual(RESTRICTED_MARKET_POLICY_ID, keccak256(toHex('OMERTA_RESTRICTED_LP_REVENUE_V2_500_BOTH_DIRECTIONS')));
    assert.notEqual(RESTRICTED_MARKET_POLICY_ID, keccak256(toHex('OMERTA_RESTRICTED_LP_REVENUE_V2_550_BOTH_DIRECTIONS')));
    const weights = [200, 80, 120, 150], total = weights.reduce((sum, value) => sum + value, 0);
    const allocated = weights.map(weight => Math.floor(weight * 350 / total));
    const order = weights.map((weight, i) => ({ i, remainder: weight * 350 % total }))
      .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
    for (let i = 0, remaining = 350 - allocated.reduce((sum, value) => sum + value, 0); i < remaining; i++)
      allocated[order[i].i]++;
    assert.deepEqual(allocated, [127, 51, 76, 96], 'largest remainders receive the two unassigned basis points');
    assert.deepEqual(Object.values(plan.economics.splitBps), allocated);
    assert.equal(Number(source.match(/developer = base \* (\d+) \/ BASE_FEE_BPS/)[1]), allocated[0]);
    assert.equal(Number(source.match(/rwa = base \* (\d+) \/ BASE_FEE_BPS/)[1]), allocated[1]);
    assert.equal(Number(source.match(/community = base \* (\d+) \/ BASE_FEE_BPS/)[1]), allocated[2]);
  });
  test('reward deployments encode the same vault, router, asset and hookless external conversion pool', () => {
    const decode = role => {
      const d = plan.steps.find(x => x.kind === 'deployment' && x.role === role);
      const a = loadMarketV2Artifact(d.contract);
      return decodeAbiParameters(a.abi.find(x => x.type === 'constructor').inputs, `0x${d.transaction.data.slice(a.bytecode.length)}`);
    };
    const [vault] = decode('btcRewards');
    assert.equal(vault.safe, fixture.roles.safe);
    assert.equal(vault.wbtc, fixture.external.wbtc.address);
    assert.equal(vault.omr, fixture.external.omr.address);
    assert.equal(vault.omrRouter, plan.addresses.router);
    assert.equal(vault.converter, plan.addresses.btcConverter);
    assert.equal(vault.routerRuntimeHash, H);
    assert.equal(vault.converterRuntimeHash, H);
    const { poolId, ...canonicalPoolKey } = plan.canonicalPool;
    assert.deepEqual(vault.omrPool, canonicalPoolKey);
    const converter = decode('btcConverter');
    assert.deepEqual(converter, [plan.addresses.btcRewards, fixture.external.wbtc.address,
      fixture.external.rewardManager.address, { currency0: zeroAddress, currency1: fixture.external.wbtc.address,
        fee: 3000, tickSpacing: 60, hooks: zeroAddress }, H, H]);
    assert.equal(plan.steps[0].kind, 'readiness');
    assert.equal(plan.steps[0].required.executableDepthForBudgetRequired, true);
    assert.equal(plan.steps[0].required.decimals, 8);
  });
  test('the external converter cannot receive OMR privileges through additional manifest entries', () => {
    const x = clone(fixture);
    x.restrictedMarket.additionalOperators.push({ address: plan.addresses.btcConverter, role: 2, runtimeHash: H, purpose: 'Forbidden converter custody' });
    assert.throws(() => buildMarketV2DeploymentPlan(x), /converter.*OMR operator/);
    const y = clone(fixture);
    y.restrictedMarket.contractHolders.push({ address: plan.addresses.btcConverter, runtimeHash: H, purpose: 'Forbidden converter holder' });
    assert.throws(() => buildMarketV2DeploymentPlan(y), /converter.*OMR contract holder/);
    assert.equal(plan.steps.some(step => step.functionName === 'setOperator' && step.args[0] === plan.addresses.btcRewards), false);
  });
  test('rewards require actual constructor-specific runtime evidence and a distinct external settlement domain', () => {
    const x = clone(fixture); x.rewards.converterRuntimeHash = loadMarketV2Artifact('OmertaWbtcConverterV2').evidence.runtimeTemplateKeccak256;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /immutable template/);
    const y = clone(fixture); y.external.rewardManager.address = y.external.poolManager.address;
    assert.throws(() => buildMarketV2DeploymentPlan(y), /must be distinct/);
    const z = clone(fixture); z.chainId = 4663; z.localRehearsal = false;
    assert.throws(() => buildMarketV2DeploymentPlan(z), /reviewed bridged WBTC address/);
    const w = clone(fixture); w.policies.rewards.tickSpacing = 0;
    assert.throws(() => buildMarketV2DeploymentPlan(w), /rewards.tickSpacing/);
  });
  test('inventory bonds deploy dormant with a bounded discount and at least thirty-day vesting', () => {
    assert.equal(plan.bondPolicy.startsPaused, true);
    assert.equal(plan.bondPolicy.maximumDiscountBps, 50);
    assert.equal(plan.bondPolicy.minimumVestingSeconds, 30 * 86400);
    assert.equal(plan.steps.some(step => step.role === 'bond' && step.functionName === 'setPaused' && step.args[0] === false), false);
    const excess = clone(fixture); excess.policies.bond.discountBps = 51;
    assert.throws(() => buildMarketV2DeploymentPlan(excess), /bond.discountBps.*policy bounds/);
    const short = clone(fixture); short.policies.bond.vestingSeconds = 30 * 86400 - 1;
    assert.throws(() => buildMarketV2DeploymentPlan(short), /bond.vestingSeconds.*policy bounds/);
  });
  test('manager binding and reviewed roles are Safe calls sealed after deployments and before asset funding', () => {
    const abi = parseAbi(['function bindSettlementManager(address manager,bytes32 expectedRuntimeHash)',
      'function setOperator(address operator,uint8 role,bytes32 expectedRuntimeHash)', 'function sealPolicy()']);
    const bind = plan.steps.findIndex(x => x.functionName === 'bindSettlementManager');
    const seal = plan.steps.findIndex(x => x.functionName === 'sealPolicy');
    assert.ok(plan.steps.filter(x => x.kind === 'deployment').every(x => plan.steps.indexOf(x) < bind));
    assert.ok(bind < seal);
    const decodedBind = decodeFunctionData({ abi, data: plan.steps[bind].transaction.data });
    assert.deepEqual(decodedBind.args, [fixture.external.poolManager.address, H]);
    const registers = plan.steps.filter(x => x.functionName === 'setOperator');
    assert.equal(registers.length, 8);
    const roles = { hook: 2, controller: 2, bond: 2, turf: 2, arbitrage: 1, router: 1, positionManager: 1, permit2: 1 };
    for (const [role, n] of Object.entries(roles)) {
      const step = registers.find(x => x.label === `Register restricted ${role} operator`);
      const decoded = decodeFunctionData({ abi, data: step.transaction.data });
      assert.deepEqual(decoded.args, [plan.restrictedMarket.operatorAddresses[role], n, H]);
      assert.equal(step.transaction.from, fixture.roles.safe);
      assert.equal(step.transaction.to, fixture.external.omr.address);
      assert.ok(plan.steps.indexOf(step) < seal);
    }
    assert.ok(plan.steps.filter(x => ['approve', 'initialize', 'modifyLiquidities', 'fund', 'fundInventory'].includes(x.functionName))
      .every(x => seal < plan.steps.indexOf(x)));
    const readiness = plan.steps.find(x => x.label === 'Verify replacement market contracts and actual operator runtime before irrevocable policy sealing');
    assert.equal(readiness.required.manager.polRecipient, plan.addresses.polFunding);
    assert.equal(readiness.required.manager.TRADE_FEE_BPS, 400);
    assert.equal(readiness.required.manager.rewardsRecipient, plan.addresses.btcRewards);
    assert.equal(readiness.required.positionManager.poolManager, fixture.external.poolManager.address);
    assert.equal(readiness.required.token.operatorCount, 0);
    assert.equal(readiness.required.token.contractHolderCount, 0);
    assert.equal(readiness.required.token.genesisTreasury, fixture.roles.safe);
    assert.equal(readiness.required.token.totalSupply, String(RESTRICTED_MARKET_SUPPLY));
    assert.equal(readiness.required.token.ownerBalance, String(RESTRICTED_MARKET_SUPPLY));
    assert.equal(readiness.required.token.zeroExternalInventory, true);
    assert.equal(readiness.required.capitalProvider, fixture.roles.safe);
    assert.ok(plan.steps.indexOf(readiness) < bind);
    const finalRegistry = plan.steps[seal - 1];
    assert.equal(finalRegistry.kind, 'readiness');
    assert.equal(finalRegistry.label, 'Verify the exact complete operator and contract-holder registries immediately before sealing');
    assert.equal(finalRegistry.required.operatorCount, 9);
    assert.equal(finalRegistry.required.ownerBalance, String(RESTRICTED_MARKET_SUPPLY));
    assert.equal(finalRegistry.required.zeroExternalInventory, true);
    assert.equal(finalRegistry.required.includesAllEverConfiguredEntries, true);
    assert.deepEqual(finalRegistry.required.operators[0], { index: 0, operatorAt: fixture.external.poolManager.address,
      operatorRole: 3, operatorRuntimeHash: H });
    Object.entries(roles).forEach(([role, n], i) => {
      assert.deepEqual(finalRegistry.required.operators[i + 1], { index: i + 1,
        operatorAt: plan.restrictedMarket.operatorAddresses[role], operatorRole: n, operatorRuntimeHash: H });
    });
    assert.equal(finalRegistry.required.contractHolderCount, 4);
    ['polFunding', 'reserveFunding', 'turfFeeBridge', 'btcRewards'].forEach((role, index) => {
      assert.deepEqual(finalRegistry.required.contractHolders[index], { index, contractHolderAt: plan.addresses[role], contractHolderRuntimeHash: H });
    });
    assert.ok(plan.executionConditions.some(x => x.includes('offline generator does not perform them')));
  });
  test('inventory must remain entirely with the Safe until sealing and typed funding uses that Safe', () => {
    const x = clone(fixture); x.roles.capitalProvider = A(0x10008);
    assert.throws(() => buildMarketV2DeploymentPlan(x), /capitalProvider must be the token-owning Safe/);
    assert.ok(plan.steps.filter(step => ['approve', 'modifyLiquidities', 'fund', 'fundInventory'].includes(step.functionName))
      .every(step => step.transaction.from === fixture.roles.safe));
    assert.equal(plan.executionConditions.some(x => x.includes('already hold its explicitly allocated')), false);
  });
  test('old unrestricted manifests and mismatched revenue policy cannot silently plan', () => {
    const x = clone(fixture); delete x.restrictedMarket;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /restrictedMarket.*missing required/);
    const y = clone(fixture); y.schemaVersion = 1;
    assert.throws(() => buildMarketV2DeploymentPlan(y), /schemaVersion must be 2/);
    const z = clone(fixture); z.restrictedMarket.policyId = H;
    assert.throws(() => buildMarketV2DeploymentPlan(z), /policyId.*binding mismatch/);
  });
  test('runtime identities are complete and external operator pins agree', () => {
    const x = clone(fixture); delete x.restrictedMarket.operatorRuntimeHashes.router;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /router.*missing required/);
    const y = clone(fixture); y.restrictedMarket.operatorRuntimeHashes.positionManager = `0x${'20'.repeat(32)}`;
    assert.throws(() => buildMarketV2DeploymentPlan(y), /positionManager.*binding mismatch/);
    const z = clone(fixture); z.restrictedMarket.operatorRuntimeHashes.hook = loadMarketV2Artifact('OmertaHookV2').evidence.runtimeTemplateKeccak256;
    assert.throws(() => buildMarketV2DeploymentPlan(z), /immutable runtime template/);
  });
  test('additional custody operators are explicit and cannot duplicate or acquire settlement input authority', () => {
    const operator = { address: A(0x50000), role: 2, runtimeHash: H, purpose: 'Reviewed bounded game payout custody' };
    const x = clone(fixture); x.restrictedMarket.additionalOperators = [operator];
    const extended = buildMarketV2DeploymentPlan(x);
    const added = extended.steps.find(step => step.label === `Register reviewed custody operator: ${operator.purpose}`);
    assert.deepEqual(added.args, [operator.address, 2, H]);
    const registry = extended.steps.find(step => step.label === 'Verify the exact complete operator and contract-holder registries immediately before sealing');
    assert.equal(registry.required.operatorCount, 10);
    assert.deepEqual(registry.required.operators.at(-1), { index: 9, operatorAt: operator.address, operatorRole: 2, operatorRuntimeHash: H });
    x.restrictedMarket.additionalOperators[0].role = 1;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /ProtocolCustody/);
    x.restrictedMarket.additionalOperators[0].role = 2;
    x.restrictedMarket.additionalOperators[0].address = fixture.external.poolManager.address;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /Duplicate/);
    x.restrictedMarket.additionalOperators[0].address = fixture.roles.safe;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /public-role/);
  });
  test('receiving-only adapter holders are Safe-registered before sealing and cannot acquire operator authority', () => {
    const holders = plan.steps.filter(step => step.functionName === 'setContractHolder');
    assert.equal(holders.length, 4);
    const seal = plan.steps.findIndex(step => step.functionName === 'sealPolicy');
    const abi = parseAbi(['function setContractHolder(address holder,bytes32 expectedRuntimeHash)']);
    ['polFunding', 'reserveFunding', 'turfFeeBridge', 'btcRewards'].forEach((role, i) => {
      const step = holders[i];
      assert.equal(step.transaction.from, fixture.roles.safe);
      assert.deepEqual(decodeFunctionData({ abi, data: step.transaction.data }).args, [plan.addresses[role], H]);
      assert.ok(plan.steps.indexOf(step) < seal);
      assert.equal(plan.steps.some(x => x.functionName === 'setOperator' && x.args[0] === plan.addresses[role]), false);
    });
    const x = clone(fixture); delete x.restrictedMarket.holderRuntimeHashes.reserveFunding;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /reserveFunding.*missing required/);
    const y = clone(fixture); y.restrictedMarket.holderRuntimeHashes.polFunding = loadMarketV2Artifact('OmertaReserveFundingV2').evidence.runtimeTemplateKeccak256;
    assert.throws(() => buildMarketV2DeploymentPlan(y), /holderRuntimeHashes.polFunding.*immutable runtime template/);
  });
  test('fee wallets self-enroll from the same undelegated EOA and contract treasuries need explicit holder pins', () => {
    const wallets = plan.steps.filter(step => step.functionName === 'registerWallet');
    assert.deepEqual(wallets.map(x => x.args[0]), [fixture.roles.dev, fixture.roles.rwa, fixture.roles.community, fixture.season.families[0].treasury]);
    const abi = parseAbi(['function registerWallet(address wallet)']);
    for (const step of wallets) {
      assert.equal(step.transaction.from, step.args[0]);
      assert.equal(decodeFunctionData({ abi, data: step.transaction.data }).args[0], step.transaction.from);
    }
    const readiness = plan.steps.find(step => step.label === 'Verify self-enrolling revenue wallets are undelegated EOAs');
    assert.equal(readiness.required.liveCode, '0x');
    assert.equal(readiness.required.directCallerEqualsTransactionOrigin, true);
    const x = clone(fixture); x.restrictedMarket.contractHolders = [{ address: x.roles.rwa, runtimeHash: H, purpose: 'Reviewed RWA treasury' }];
    const p = buildMarketV2DeploymentPlan(x);
    assert.equal(p.steps.some(step => step.functionName === 'registerWallet' && step.args[0] === x.roles.rwa), false);
    const registry = p.steps.find(step => step.label === 'Verify the exact complete operator and contract-holder registries immediately before sealing');
    assert.equal(registry.required.contractHolderCount, 5);
    assert.deepEqual(registry.required.contractHolders.at(-1), { index: 4, contractHolderAt: x.roles.rwa, contractHolderRuntimeHash: H });
    x.restrictedMarket.contractHolders[0].address = x.roles.safe;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /genesis address/);
    x.restrictedMarket.contractHolders[0].address = p.addresses.router;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /operator.*genesis address/);
    x.restrictedMarket.contractHolders[0].address = p.addresses.polFunding;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /Duplicate/);
  });
  test('season/Turf setup precedes bridge deployment and complete one-time binding calls follow controller', () => {
    const index = label => plan.steps.findIndex(x => x.label === label);
    const bridge = plan.steps.findIndex(x => x.kind === 'deployment' && x.role === 'turfFeeBridge');
    assert.ok(index('Create immutable seasonal Turf 0 before bridge construction') < bridge);
    const controller = plan.steps.findIndex(x => x.kind === 'deployment' && x.role === 'controller');
    assert.ok(index('Bind earned Turf fees to controller accounting') > controller);
    assert.ok(index('Bind the only fee source for season 1 Turf 0') < index('Register the game fee checkpoint lane before season start'));
    const funding = plan.steps.find(x => x.label === 'Bind stability funding to War Chest');
    const decoded = decodeFunctionData({ abi: plan.artifacts.OmertaReserveFundingV2.abi, data: funding.transaction.data });
    assert.equal(decoded.functionName, 'bindController');
    assert.equal(decoded.args[0], plan.addresses.controller);
  });
  test('bootstrap mints real PM actions, settles the pair and sweeps native change', () => {
    const step = plan.steps.find(x => x.functionName === 'modifyLiquidities');
    const decoded = decodeFunctionData({ abi: parseAbi(['function modifyLiquidities(bytes unlockData,uint256 deadline) payable']), data: step.transaction.data });
    const [actions, params] = decodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], decoded.args[0]);
    assert.equal(actions, '0x020d14');
    assert.equal(params.length, 3);
    assert.deepEqual(decodeAbiParameters([{ type: 'address' }, { type: 'address' }], params[1]), [zeroAddress, fixture.external.omr.address]);
    assert.deepEqual(decodeAbiParameters([{ type: 'address' }, { type: 'address' }], params[2]), [zeroAddress, fixture.roles.capitalProvider]);
    assert.ok(BigInt(plan.bootstrapAmounts.native) < 1000n * E);
    assert.ok(BigInt(plan.bootstrapAmounts.omr) < 1000n * E);
    assert.equal(step.transaction.value, String(1001n * E));
    assert.ok(plan.steps.some(x => x.kind === 'readiness'));
  });
  test('missing constructor policies fail rather than inventing treasury budgets', () => {
    const x = clone(fixture); delete x.policies.stability.limits[0].nativePerAction;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /missing constructor field/);
  });
  test('stale ABI/bytecode evidence cannot be used under different artifact hash', () => {
    const x = clone(fixture); x.artifactHashes.OmertaHookV2 = 'ab'.repeat(32);
    assert.throws(() => buildMarketV2DeploymentPlan(x), /artifactHashes.OmertaHookV2.*binding mismatch/);
  });
  test('funding and market bindings cannot be overridden through policy objects', () => {
    const x = clone(fixture); x.policies.stability.safe = A(0x999);
    assert.throws(() => buildMarketV2DeploymentPlan(x), /binding is derived/);
  });
  test('ABI-sized values must also satisfy constructor policy inequalities', () => {
    const x = clone(fixture); x.policies.stability.limits[0].nativePerAction = String(10n * E);
    assert.throws(() => buildMarketV2DeploymentPlan(x), /budget ordering/);
    const y = clone(fixture); y.policies.market.requiredLiquidity = '0';
    assert.throws(() => buildMarketV2DeploymentPlan(y), /market.requiredLiquidity.*policy bounds/);
  });
  test('unknown hook policy keys cannot silently change the intended economics', () => {
    const x = clone(fixture); x.policies.hook.baseSellBps = 1000;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /unknown manifest field/);
  });
  test('nonce owner cannot also execute setup calls', () => {
    const x = clone(fixture); x.roles.safeExecutor = x.roles.deployer;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /nonce owner must be separate/);
  });
  test('bootstrap must actually fund the claimed starting liquidity', () => {
    const x = clone(fixture); x.bootstrap.maxNative = '1';
    assert.throws(() => buildMarketV2DeploymentPlan(x), /asset caps cannot fund/);
  });
  test('opening is immutable and cannot add more than half a percent to the mandatory base fee', () => {
    const x = clone(fixture); x.policies.hook.opening.blocks = 201;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /opening.blocks/);
    x.policies.hook.opening.blocks = 0;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /Disabled opening/);
    x.policies.hook.opening.blocks = 200; x.policies.hook.opening.buyBps = 51;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /opening.buyBps/);
  });
  test('family treasuries and exact ownership split are mandatory before bridge deployment', () => {
    const x = clone(fixture); x.season.owners.shares[0] = 9000;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /sum to 10000/);
  });
  test('secret-bearing input is rejected before artifact or mining work', () => {
    const x = clone(fixture); x.extra = { privateKey: 'do not accept' };
    assert.throws(() => buildMarketV2DeploymentPlan(x), /Credentials/);
  });
  test('CREATE2 search is finite with explicit exhaustion', () => {
    let start = 0n;
    while ((BigInt(getContractAddress({ opcode: 'CREATE2', from: fixture.create2.factory, salt: `0x${start.toString(16).padStart(64, '0')}`, bytecodeHash: H })) & 0x3fffn) === MARKET_V2_HOOK_FLAGS) ++start;
    assert.throws(() => mineMarketV2Hook(fixture.create2.factory, H, start, 1), /budget exhausted/);
  });
  console.log(`${passed} market-v2 deployment plan checks passed; offline artifact-backed synthetic example only.`);
}
