import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { decodeAbiParameters, decodeFunctionData, encodeAbiParameters, getContractAddress, getAddress, keccak256, zeroAddress } from 'viem';
import { buildLiquidityDeploymentPlan, liquidityDeploymentInputTemplate, loadReviewedArtifact,
  verifyLiquidityDeploymentStartup } from '../tools/liquidity-deployment-plan.js';

const A = (n) => getAddress(`0x${BigInt(n).toString(16).padStart(40, '0')}`);
const H = `0x${'19'.repeat(32)}`;
const E = 10n ** 18n;
const clone = (value) => JSON.parse(JSON.stringify(value));
const root = fileURLToPath(new URL('../', import.meta.url));
const contractsRoot = path.join(root, 'omerta-contracts');
let passed = 0;
function test(name, fn) { fn(); ++passed; console.log(`PASS ${name}`); }
async function testAsync(name, fn) { await fn(); ++passed; console.log(`PASS ${name}`); }

// Synthetic public inputs and deliberately explicit test-only budgets. No network or financial recommendation.
function fixture({ genesis = true, bank = true } = {}) {
  const x = liquidityDeploymentInputTemplate();
  x.chainId = 31337; x.localRehearsal = true;
  x.snapshot = { chainId: 31337, blockNumber: '123', blockHash: H }; x.startingNonce = '17';
  let n = 0x1000;
  for (const role of Object.keys(x.roles)) x.roles[role] = A(++n);
  x.roles.guardian = x.roles.keeper;
  n = 0x2000;
  for (const name of Object.keys(x.core)) x.core[name] = { address: A(++n), runtimeHash: H };
  x.core.safe.address = x.roles.safe; x.core.claim.address = x.roles.claim;
  x.core.hook.address = A(0x1030cc);
  const { roles: r, core: c } = x;
  const key = { currency0: zeroAddress, currency1: c.omr.address, fee: 3000, tickSpacing: 60, hooks: c.hook.address };
  const keyParam = { type: 'tuple', components: [{ name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' },
    { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }] };
  x.pool = { id: keccak256(encodeAbiParameters([keyParam], [key])), fee: 3000, tickSpacing: 60 };
  x.bindings = {
    positionManager: { poolManager: c.poolManager.address, permit2: c.permit2.address },
    oracle: { poolManager: c.poolManager.address, source: c.hook.address, omr: c.omr.address, poolId: x.pool.id },
    fees: { owner: r.safe, feeRecipient: r.dev, vigBps: 2500, mintDevBps: 10000, nonMintRouter: zeroAddress },
    bond: { owner: r.safe, omr: c.omr.address, signer: r.bondSigner, paused: false, liquidityHealthGuard: zeroAddress,
      polBps: 3750, devBps: 1500, rwaBps: 2500 },
    claim: { owner: r.safe, omr: c.omr.address, signer: r.voucherSigner },
    hook: { owner: r.safe, poolManager: c.poolManager.address, omr: c.omr.address, authorized: c.strategy.address,
      devRecipient: r.dev, rwaRecipient: r.treasury, sellTaxBps: 1000, taxDevBps: 200, taxRwaBps: 400, taxCommunityBps: 200 },
    splitter: { poolManager: c.poolManager.address, canonicalPoolId: x.pool.id, treasuryRecipient: r.treasury,
      vigRecipient: getContractAddress({ from: r.deployer, nonce: 18n }), founderRecipient: r.dev },
    bankTransmuter: { owner: r.safe, asset: c.bankAsset.address, debtToken: c.bankDebt.address },
    bankAsset: { decimals: 6 },
  };
  x.policies.pol = { minLiquidity: String(E), warmup: '3600', maxOracleAge: '600', maxDeviationBps: 500, budgetWindow: '86400',
    maxNativePerAction: String(E), maxNativePerWindow: String(2n * E), maxOmrPerAction: String(5n * E), maxOmrPerWindow: String(10n * E) };
  for (const stream of Object.keys(x.policies.buybacks)) x.policies.buybacks[stream] = {
    perAction: String(E / 10n), perDay: String(E), minInterval: '600', maxOracleAge: '600', slippageBps: 300,
  };
  x.policies.gas = { periodBudget: String(E / 10n), perRefillCap: String(E / 100n), targetBalance: String(E / 50n), minInterval: '600' };
  x.policies.bond = { dailyCapOMR: String(100n * E), maxOmrPerEth: String(1000n * E), maxOracleAge: '600', priceToleranceBps: 500, unpauseAfterConfiguration: true };
  x.genesis = { enabled: genesis, maxOracleAge: '600' };
  x.bank = { enabled: bank, assetDecimals: 6, perActionCap: '10000000', periodBudget: '100000000' };
  return x;
}

const input = fixture();
const plan = buildLiquidityDeploymentPlan(input);

test('deterministic EOA CREATE nonces, bytecode and immutable future recipients', () => {
  assert.deepEqual(plan, buildLiquidityDeploymentPlan(clone(input)));
  assert.deepEqual(plan.deployments.map((d) => d.id), ['polVault', 'vig', 'desk', 'community', 'polBuyback', 'feeRouter', 'gasVault', 'genesisController', 'bankBuffer']);
  for (const [index, d] of plan.deployments.entries()) {
    assert.equal(d.predictedAddress, getContractAddress({ from: input.roles.deployer, nonce: 17n + BigInt(index) }));
    assert.equal(d.nonce, String(17 + index)); assert.equal(d.to, null); assert.equal(d.value, '0');
    assert.equal(d.from, input.roles.deployer); assert.equal(keccak256(d.data), d.initCodeKeccak256);
    const artifact = loadReviewedArtifact(d.contract);
    const constructor = artifact.abi.find((v) => v.type === 'constructor');
    const decoded = decodeAbiParameters(constructor.inputs, `0x${d.data.slice(artifact.bytecode.length)}`);
    if (d.id === 'polVault') {
      assert.equal(decoded[0].safe, input.roles.safe); assert.equal(decoded[0].deskRecipient, plan.predicted.desk);
      assert.equal(decoded[0].vigRecipient, plan.predicted.vig);
    }
    assert.ok(d.artifact.artifactSha256); assert.ok(d.artifact.sources[`src/${d.contract}.sol`]);
    assert.ok(d.artifact.runtimeTemplateKeccak256); assert.notEqual(d.artifact.creationBytecodeKeccak256, d.initCodeKeccak256);
  }
  assert.equal(plan.snapshotVerifiedOnChain, false); assert.equal(plan.broadcasts, false); assert.equal(plan.networkAccess, false);
});

test('constructor dependencies are available in order and all administrative owners are Safe', () => {
  const available = new Set(Object.keys(plan.coreRuntimePins));
  for (const d of plan.deployments) {
    for (const dep of d.requiredCodeBeforeCreation) assert.ok(available.has(dep), `${d.id} depends on unavailable ${dep}`);
    available.add(d.id);
    assert.equal(d.owner, d.contract === 'FeeRevenueRouter' ? null : input.roles.safe);
  }
  for (const call of plan.governance.calls) assert.equal(call.from, input.roles.safe);
  assert.equal(plan.governance.mustExecuteAsAtomicSafeBatch, true);
  assert.equal(plan.governance.calls[0].functionName, 'pause');
  assert.equal(plan.governance.calls.at(-1).functionName, 'unpause');
});

test('fresh POL vault binds the selected keeper in creation calldata without a paused-only setter', () => {
  const artifact = loadReviewedArtifact('ProtocolLiquidityVault');
  const constructor = artifact.abi.find((entry) => entry.type === 'constructor');
  for (const genesis of [true, false]) {
    const selected = fixture({ genesis, bank: false });
    selected.roles.keeper = A(genesis ? 0x7001 : 0x7002);
    selected.roles.guardian = selected.roles.keeper;
    const generated = buildLiquidityDeploymentPlan(selected);
    const vault = generated.deployments.find((deployment) => deployment.id === 'polVault');
    const [config] = decodeAbiParameters(constructor.inputs, `0x${vault.data.slice(artifact.bytecode.length)}`);
    assert.equal(config.keeper, selected.roles.keeper);
    const vaultCalls = generated.governance.calls.filter((call) => call.to === vault.predictedAddress)
      .map((call) => decodeFunctionData({ abi: artifact.abi, data: call.data }).functionName);
    // A fresh vault starts unpaused; setKeeper is a paused-only rotation path.
    assert.deepEqual(vaultCalls, genesis ? ['setInventoryExecutor', 'setGenesisController'] : ['setInventoryExecutor']);
    for (const id of ['vig-keeper', 'desk-keeper', 'community-keeper', 'polBuyback-keeper', 'gas-keeper']) {
      assert.deepEqual(generated.governance.calls.find((call) => call.id === id).arguments, [selected.roles.keeper, true]);
    }
  }
});

test('mint remains 100% DEV and non-mint shares stay 50/25/10/15', () => {
  assert.deepEqual(plan.preservedPolicy.mint, { devBps: 10000, recipient: input.roles.dev, feeAmountChanged: false });
  assert.deepEqual(plan.preservedPolicy.nonMint, { devBps: 5000, vigBps: 2500, treasuryBps: 1000, communityBps: 1500 });
  const router = plan.deployments.find((d) => d.id === 'feeRouter');
  assert.deepEqual(router.constructorArguments, [input.core.fees.address, input.roles.dev, plan.predicted.vig, input.roles.treasury, plan.predicted.community]);
  assert.equal(plan.governance.calls.filter((c) => ['setFeeRecipient', 'setFees', 'setMinter', 'setBurner', 'setSigner', 'transferOwnership'].includes(c.functionName)).length, 0);
  const feeCalls = plan.governance.calls.filter((c) => c.to === input.core.fees.address);
  assert.deepEqual(feeCalls.map((c) => c.functionName), ['setVigRecipient', 'setNonMintRouter']);
});

test('Vig has fixed claim custody for both halves and hook ratios are never rewritten', () => {
  const vig = plan.deployments.find((d) => d.id === 'vig');
  assert.deepEqual(vig.constructorArguments.slice(5, 8), [0, input.roles.claim, input.roles.claim]);
  const hook = plan.governance.calls.find((c) => c.id === 'hook-recipients');
  assert.deepEqual(hook.arguments, [input.roles.dev, input.roles.treasury, plan.predicted.community, plan.predicted.polVault]);
  assert.equal(plan.governance.calls.some((c) => c.functionName === 'setSellTax'), false);
  assert.deepEqual(plan.preservedPolicy.bond, { polBps: 3750, devBps: 1500, treasuryBps: 2500, vigBps: 2250 });
  assert.deepEqual(plan.preservedPolicy.hook, { sellTaxBps: 1000, devBps: 200, treasuryBps: 400, communityBps: 200, polBps: 200 });
});

test('Safe calldata decodes to documented exact functions and arguments', () => {
  const lookup = { 'OmertaFees': input.core.fees.address, 'OmertaBond': input.core.bond.address, 'OmertaHook': input.core.hook.address,
    'Transmuter': input.core.bankTransmuter.address };
  for (const d of plan.deployments) lookup[d.contract] ||= d.predictedAddress;
  for (const call of plan.governance.calls) {
    const deployment = plan.deployments.find((d) => d.predictedAddress === call.to);
    const contract = deployment?.contract || Object.keys(lookup).find((name) => lookup[name] === call.to);
    const decoded = decodeFunctionData({ abi: loadReviewedArtifact(contract).abi, data: call.data });
    assert.equal(decoded.functionName, call.functionName);
    const canonicalArgs = (args) => JSON.parse(JSON.stringify(args, (_, v) => ['bigint', 'number'].includes(typeof v) ? String(v) : v));
    assert.deepEqual(canonicalArgs(decoded.args || []), canonicalArgs(call.arguments));
    assert.equal(call.operation, 0); assert.equal(call.value, '0');
  }
});

test('existing fee router detaches only inside ordered atomic batch and existing bond pause is retained', () => {
  const x = fixture(); x.bindings.fees.nonMintRouter = A(0x555); x.bindings.bond.paused = true; x.policies.bond.unpauseAfterConfiguration = false;
  const p = buildLiquidityDeploymentPlan(x);
  assert.deepEqual(p.governance.calls.filter((c) => c.to === x.core.fees.address).map((c) => c.functionName), ['setNonMintRouter', 'setVigRecipient', 'setNonMintRouter']);
  assert.equal(p.governance.calls.find((c) => c.id === 'fees-detach-router').arguments[0], zeroAddress);
  assert.equal(p.governance.calls.some((c) => ['pause', 'unpause'].includes(c.functionName)), false);
});

test('optional contracts neither consume nonces nor receive configuration authority when absent', () => {
  const p = buildLiquidityDeploymentPlan(fixture({ genesis: false, bank: false }));
  assert.equal(p.deployments.length, 7); assert.equal(p.predicted.genesisController, undefined); assert.equal(p.predicted.bankBuffer, undefined);
  assert.equal(p.governance.calls.some((c) => ['setGenesisController', 'setFunder'].includes(c.functionName)), false);
});

test('explicit zero bond daily cap encodes unlimited issuance without removing other guards', () => {
  const selected = fixture();
  selected.policies.bond.dailyCapOMR = '0';
  selected.policies.bond.unpauseAfterConfiguration = false;
  const generated = buildLiquidityDeploymentPlan(selected);
  const capCall = generated.governance.calls.find((call) => call.id === 'bond-daily-cap');
  const decoded = decodeFunctionData({ abi: loadReviewedArtifact('OmertaBond').abi, data: capCall.data });
  assert.equal(decoded.functionName, 'setDailyCap');
  assert.deepEqual(decoded.args, [0n]);
  assert.deepEqual(capCall.arguments, ['0']);
  assert.match(capCall.purpose, /Remove the global daily bond issuance limit/);
  assert.deepEqual(generated.bondIssuancePolicy, { dailyCapOMR: '0', dailyLimit: 'unlimited' });
  assert.deepEqual(plan.bondIssuancePolicy, { dailyCapOMR: input.policies.bond.dailyCapOMR, dailyLimit: 'finite' });
  assert.equal(generated.governance.calls[0].id, 'bond-pause');
  assert.equal(generated.governance.calls.some((call) => call.id === 'bond-resume'), false);
  for (const id of ['bond-oracle', 'bond-health', 'bond-guardian', 'bond-rate-cap']) {
    assert.deepEqual(generated.governance.calls.find((call) => call.id === id), plan.governance.calls.find((call) => call.id === id));
  }
});

test('bond daily cap requires an explicit unsigned decimal value even when zero is allowed', () => {
  for (const value of [null, undefined, 0, '-1', 'unlimited', '01', String(1n << 256n)]) {
    const selected = fixture();
    if (value === undefined) delete selected.policies.bond.dailyCapOMR;
    else selected.policies.bond.dailyCapOMR = value;
    assert.throws(() => buildLiquidityDeploymentPlan(selected), /bond.dailyCapOMR/);
  }
});

test('required positive budgets reject missing, zero, unlimited and inconsistent values', () => {
  for (const mutate of [
    (x) => { x.policies.pol.maxNativePerAction = null; }, (x) => { x.policies.gas.periodBudget = '0'; },
    (x) => { x.policies.buybacks.vig.perDay = '1'; }, (x) => { x.policies.bond.maxOmrPerEth = '0'; },
    (x) => { x.policies.pol.maxNativePerAction = '0'; }, (x) => { x.policies.buybacks.vig.perAction = '0'; },
    (x) => { x.policies.bond.maxOracleAge = '0'; },
    (x) => { x.bank.perActionCap = '100000001'; }, (x) => { x.policies.pol.warmup = '1'; },
    (x) => { x.policies.bond.unpauseAfterConfiguration = null; }, (x) => { x.policies.pol.maxNativePerWindow = 'unlimited'; },
  ]) { const x = fixture(); mutate(x); assert.throws(() => buildLiquidityDeploymentPlan(x)); }
});

test('wrong chain, wrong snapshot domain, reused operational roles and altered mint recipient reject', () => {
  for (const mutate of [
    (x) => { x.chainId = 1; }, (x) => { x.localRehearsal = false; }, (x) => { x.snapshot.chainId = 4663; },
    (x) => { x.roles.keeper = x.roles.safe; }, (x) => { x.roles.deployer = x.roles.safe; },
    (x) => { x.roles.bondSigner = x.roles.safe; }, (x) => { x.bindings.fees.mintDevBps = 5000; },
    (x) => { x.roles.guardian = x.roles.dev; }, (x) => { x.startingNonce = '18446744073709551614'; },
    (x) => { x.bindings.fees.feeRecipient = A(0x777); }, (x) => { x.bindings.hook.rwaRecipient = A(0x777); },
    (x) => { x.bindings.positionManager.permit2 = A(0x777); }, (x) => { x.pool.id = H; },
    (x) => { x.privateKey = 'not accepted'; }, (x) => { x.core.oracle.runtimeHash = `0x${'00'.repeat(32)}`; },
    (x) => { x.snapshot.privateKey = 'not accepted'; }, (x) => { x.bindings.splitter.vigRecipient = A(0x777); },
    (x) => { x.bindings.bankAsset.decimals = 18; },
  ]) { const x = fixture(); mutate(x); assert.throws(() => buildLiquidityDeploymentPlan(x)); }
});

test('missing artifact, changed metadata source hash and invalid compiler settings refuse generation', () => {
  assert.throws(() => loadReviewedArtifact('DoesNotExist'), /Missing artifact/);
  const original = fs.readFileSync;
  try {
    fs.readFileSync = function (name, ...args) {
      const data = original.call(this, name, ...args);
      if (String(name).endsWith(`${path.sep}FeeRevenueRouter.json`)) {
        const a = JSON.parse(data.toString()); a.metadata.sources['src/FeeRevenueRouter.sol'].keccak256 = H;
        return Buffer.from(JSON.stringify(a));
      }
      return data;
    };
    assert.throws(() => buildLiquidityDeploymentPlan(fixture()), /artifact\/source mismatch/);
  } finally { fs.readFileSync = original; }
  try {
    fs.readFileSync = function (name, ...args) {
      const data = original.call(this, name, ...args);
      if (String(name).endsWith(`${path.sep}KeeperGasVault.json`)) {
        const a = JSON.parse(data.toString()); a.metadata.settings.optimizer.runs = 1;
        return Buffer.from(JSON.stringify(a));
      }
      return data;
    };
    assert.throws(() => buildLiquidityDeploymentPlan(fixture()), /compiler settings differ/);
  } finally { fs.readFileSync = original; }
  try {
    fs.readFileSync = function (name, ...args) {
      const data = original.call(this, name, ...args);
      if (String(name).endsWith(`${path.sep}KeeperGasVault.json`)) {
        const a = JSON.parse(data.toString()); a.abi.find((entry) => entry.name === 'setKeeperAllowed').name = 'maliciousReplacement';
        return Buffer.from(JSON.stringify(a));
      }
      return data;
    };
    assert.throws(() => buildLiquidityDeploymentPlan(fixture()), /ABI differs/);
  } finally { fs.readFileSync = original; }
});

test('template has null financial inputs and CLI requires a concrete input file', () => {
  const template = liquidityDeploymentInputTemplate(); assert.equal(template.roles.safe, null);
  assert.equal(template.policies.gas.periodBudget, null); assert.equal(template.policies.buybacks.vig.perAction, null);
  assert.throws(() => buildLiquidityDeploymentPlan(template));
  const missing = spawnSync(process.execPath, ['tools/liquidity-deployment-plan.js', '--plan'], { cwd: root, encoding: 'utf8' });
  assert.equal(missing.status, 1); assert.match(missing.stderr, /Usage/);
  const printed = spawnSync(process.execPath, ['tools/liquidity-deployment-plan.js', '--template'], { cwd: root, encoding: 'utf8' });
  assert.equal(printed.status, 0); assert.deepEqual(JSON.parse(printed.stdout), template);
});

function startupFixture() {
  const input = fixture();
  const runtime = '0x60006000f3';
  for (const pin of Object.values(input.core)) pin.runtimeHash = keccak256(runtime);
  const plan = buildLiquidityDeploymentPlan(input);
  const state = { block: { number: 123n, hash: H, timestamp: 2_000_000_000n }, canonicalHash: H,
    latestNonce: 17, pendingNonce: 17, pinnedNonce: 17, chainId: input.chainId, initialized: false, creationNonces: new Map(),
    code: new Map(Object.values(plan.coreRuntimePins).map((pin) => [pin.address.toLowerCase(), runtime])),
    getters: { poolManager: input.core.poolManager.address, canonicalPoolId: input.pool.id,
      treasuryRecipient: input.roles.treasury, vigRecipient: plan.predicted.vig, founderRecipient: input.roles.dev },
    calls: [] };
  const client = {
    async getChainId() { state.calls.push(['getChainId']); return state.chainId; },
    async getBlock(args) { state.calls.push(['getBlock', args]); return { ...state.block, hash: args.blockNumber == null ? state.block.hash : state.canonicalHash }; },
    async getTransactionCount(args) {
      state.calls.push(['getTransactionCount', args]);
      if (args.address.toLowerCase() !== plan.roles.deployer.toLowerCase()) return state.creationNonces.get(args.address.toLowerCase()) || 0;
      return args.blockTag === 'latest' ? state.latestNonce : args.blockTag === 'pending' ? state.pendingNonce : state.pinnedNonce;
    },
    async getCode(args) { state.calls.push(['getCode', args]); return state.code.get(args.address.toLowerCase()) || '0x'; },
    async readContract(args) { state.calls.push(['readContract', args]); return args.functionName === 'canonicalPoolInitialized' ? state.initialized : state.getters[args.functionName]; },
  };
  return { input, plan, state, client, options: { expectedPlanSha256: plan.planSha256, now: () => 2_000_000_030_000 } };
}

await testAsync('startup verifies the complete reserved CREATE interval and immutable future Vig target at one canonical block', async () => {
  const { plan, state, client, options } = startupFixture();
  const evidence = await verifyLiquidityDeploymentStartup(client, plan, options);
  assert.equal(evidence.status, 'startup_verified'); assert.equal(evidence.planSha256, plan.planSha256);
  assert.equal(evidence.latestNonce, '17'); assert.equal(evidence.pendingNonce, '17');
  assert.equal(evidence.coreRuntimePins.length, Object.keys(plan.coreRuntimePins).length);
  assert.deepEqual(evidence.emptyCreationAddresses, plan.deployments.map((d) => d.predictedAddress));
  assert.equal(evidence.genesisSplitterVerified, true); assert.equal(evidence.nonceReservationEnforcedOnChain, false);
  assert.equal(plan.startupProtocol.nextNonceAfterBundle, '26');
  assert.match(plan.startupProtocol.requirements.join(' '), /CREATE2 factory call/);
  assert.match(plan.startupProtocol.requirements.join(' '), /reverted transactions/);
  assert.match(plan.startupProtocol.requirements.join(' '), /Never shift the remaining nonces/);
  assert.equal(state.calls.filter(([name, args]) => name === 'getTransactionCount' && args.blockTag === 'pending').length, 2);
  for (const [name, args] of state.calls) if (['getCode', 'readContract'].includes(name)) assert.equal(args.blockNumber, 123n);
  assert.ok(evidence.evidenceSha256);
});

await testAsync('a prerequisite factory call, reverted transaction or pending collision prevents bundle startup without rebasing', async () => {
  for (const [latestNonce, pendingNonce, pinnedNonce] of [[18, 18, 18], [17, 18, 17], [16, 17, 16], [17, 17, 18]]) {
    const f = startupFixture(); Object.assign(f.state, { latestNonce, pendingNonce, pinnedNonce });
    await assert.rejects(verifyLiquidityDeploymentStartup(f.client, f.plan, f.options), /nonce/);
    assert.equal(f.plan.deployments[0].nonce, '17'); assert.equal(f.plan.deployments[1].nonce, '18');
  }
  const f = startupFixture(); const original = f.client.getTransactionCount;
  let latestCalls = 0;
  f.client.getTransactionCount = async (args) => {
    if (args.blockTag === 'latest' && ++latestCalls === 2) return 18;
    return original(args);
  };
  await assert.rejects(verifyLiquidityDeploymentStartup(f.client, f.plan, f.options), /latest\/pending nonce/);
});

await testAsync('any populated creation address, missing prerequisite runtime, or code-bearing deployer fails startup', async () => {
  const baseline = startupFixture();
  for (const target of baseline.plan.deployments) {
    const f = startupFixture(); f.state.code.set(target.predictedAddress.toLowerCase(), '0x6001');
    await assert.rejects(verifyLiquidityDeploymentStartup(f.client, f.plan, f.options), /destination is already occupied/);
    f.state.code.delete(target.predictedAddress.toLowerCase());
    f.state.creationNonces.set(target.predictedAddress.toLowerCase(), 1);
    await assert.rejects(verifyLiquidityDeploymentStartup(f.client, f.plan, f.options), /destination is already occupied/);
  }
  for (const name of Object.keys(baseline.plan.coreRuntimePins)) {
    const f = startupFixture(); f.state.code.delete(f.plan.coreRuntimePins[name].address.toLowerCase());
    await assert.rejects(verifyLiquidityDeploymentStartup(f.client, f.plan, f.options), /core runtime mismatch/);
  }
  const f = startupFixture(); f.state.code.set(f.plan.roles.deployer.toLowerCase(), '0xef01000000000000000000000000000000000000000001');
  await assert.rejects(verifyLiquidityDeploymentStartup(f.client, f.plan, f.options), /EOA without code/);
});

await testAsync('startup rejects stale, future, reorged or wrong-chain observations and a nonce race during reads', async () => {
  for (const mutate of [
    (f) => { f.state.block.timestamp -= 121n; }, (f) => { f.state.block.timestamp += 46n; },
    (f) => { f.state.canonicalHash = `0x${'20'.repeat(32)}`; }, (f) => { f.state.chainId = 4663; },
    (f) => { f.state.block.number = 122n; }, (f) => { f.state.block.hash = `0x${'21'.repeat(32)}`; },
    (f) => { f.state.pendingNonce = Number.MAX_SAFE_INTEGER + 1; },
  ]) { const f = startupFixture(); mutate(f); await assert.rejects(verifyLiquidityDeploymentStartup(f.client, f.plan, f.options)); }
  const f = startupFixture(); let clockCalls = 0;
  f.options.now = () => ++clockCalls === 1 ? 2_000_000_030_000 : 2_000_000_121_000;
  await assert.rejects(verifyLiquidityDeploymentStartup(f.client, f.plan, f.options), /Stale/);
});

await testAsync('startup requires the approved plan hash and checks every immutable genesis splitter binding', async () => {
  const f = startupFixture();
  await assert.rejects(verifyLiquidityDeploymentStartup(f.client, f.plan), /expectedPlanSha256/);
  const tampered = clone(f.plan); tampered.deployments[0].nonce = '18';
  await assert.rejects(verifyLiquidityDeploymentStartup(f.client, tampered, f.options), /approved hash/);
  assert.equal(f.state.calls.length, 0);
  for (const key of Object.keys(f.state.getters)) {
    const changed = startupFixture(); changed.state.getters[key] = key === 'canonicalPoolId' ? H : A(0x777);
    await assert.rejects(verifyLiquidityDeploymentStartup(changed.client, changed.plan, changed.options), /startup splitter/);
  }
  const initialized = startupFixture(); initialized.state.initialized = true;
  await assert.rejects(verifyLiquidityDeploymentStartup(initialized.client, initialized.plan, initialized.options), /canonicalPoolInitialized/);
});

console.log(`${passed} unsigned liquidity deployment-plan checks passed. Startup RPC reads used deterministic mocks only; no network, signer, key, broadcast or funding used.`);
