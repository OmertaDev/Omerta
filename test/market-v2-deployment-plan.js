import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decodeFunctionData, decodeAbiParameters, encodeAbiParameters, getContractAddress, getAddress,
  keccak256, parseAbi, zeroAddress } from 'viem';
import { MARKET_V2_ROLES, MARKET_V2_HOOK_FLAGS, loadMarketV2Artifact, mineMarketV2Hook,
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
  const artifactHashes = Object.fromEntries([...new Set(MARKET_V2_ROLES.map(([, c]) => c))]
    .map(c => [c, loadMarketV2Artifact(c).evidence.artifactSha256]));
  const limit = { nativePerAction: String(E), omrPerAction: String(E), nativePerEpisode: String(5n * E), omrPerEpisode: String(5n * E),
    nativeLifetime: String(100n * E), omrLifetime: String(100n * E), nativeRegeneration: String(E), omrRegeneration: String(E) };
  return {
    schemaVersion: 1, chainId: 31337, localRehearsal: true, sourceRevision, startingNonce: '17', roles,
    snapshot: { blockNumber: '123', blockHash: H, timestamp: '2000000000' },
    external: Object.fromEntries(['omr', 'poolManager', 'positionManager', 'permit2'].map((k, i) => [k, { address: A(0x20000 + i), runtimeHash: H }])),
    create2: { factory: A(0x30000), runtimeHash: H, kind: 'salt-prefix', saltStart: '0', maxAttempts: 200000 },
    artifactHashes,
    policies: {
      pool: { fee: 3000, tickSpacing: 60 },
      hook: { opening: { blocks: 200, buyBps: 500, maxBuyQuote: String(10n * E) }, surgeFullTicks: 100, epochDuration: 60 },
      market: { requiredLiquidity: String(500n * E), maxAge: '120', fullStressTicks: 100 },
      turf: { maxAge: 120 },
      stability: { limits: Array.from({ length: 7 }, () => clone(limit)), maxObservationAge: 120, cooldown: 60,
        recoveryInterval: 60, minLiquidity: String(500n * E), maxSpotDeviationTicks: 500, minBandTicks: 60,
        maxBandTicks: 600, stressOnBps: 6000, stressOffBps: 2000, recoveryX: 2, recoveryY: 3 },
      bond: { maxObservationAge: 120, vestingSeconds: 86400, minLiquidity: String(500n * E), maxSpotDeviationTicks: 500,
        discountBps: 500, minNativePurchase: String(E / 100n), maxNativePurchase: String(E), maxNativePerEpoch: String(5n * E),
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
  test('eleven deployments resolve future CREATE addresses and one mined CREATE2 hook', () => {
    const ds = plan.steps.filter(x => x.kind === 'deployment');
    assert.equal(ds.length, 11);
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
  });
  test('hook constructor encodes all native funding recipients with immutable intended taxes', () => {
    const d = plan.steps.find(x => x.role === 'hook' && x.kind === 'deployment');
    const a = loadMarketV2Artifact('OmertaHookV2');
    const initCode = `0x${d.transaction.data.slice(66)}`;
    const decoded = decodeAbiParameters(a.abi.find(x => x.type === 'constructor').inputs, `0x${initCode.slice(a.bytecode.length)}`);
    assert.equal(decoded[0], fixture.external.poolManager.address);
    assert.equal(decoded[1], fixture.external.omr.address);
    assert.deepEqual(decoded[5], [fixture.roles.dev, fixture.roles.rwa, fixture.roles.community, plan.addresses.polFunding, plan.addresses.reserveFunding]);
    assert.deepEqual(plan.economics.splitBps, { dev: 200, rwa: 160, community: 240, pol: 300 });
    assert.equal(plan.economics.sellBaseBps, 900);
    assert.equal(plan.economics.ordinaryBuyBps, 0);
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
  test('opening is immutable, bounded and cannot manufacture a permanent buy tax', () => {
    const x = clone(fixture); x.policies.hook.opening.blocks = 201;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /opening.blocks/);
    x.policies.hook.opening.blocks = 0;
    assert.throws(() => buildMarketV2DeploymentPlan(x), /Disabled opening/);
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
