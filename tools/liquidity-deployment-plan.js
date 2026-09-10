#!/usr/bin/env node
// Offline, unsigned CREATE and Safe-call planning. The optional startup verifier accepts a
// caller-supplied public client and performs reads only; the CLI has no RPC, signer or key reader.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { encodeDeployData, encodeFunctionData, encodeAbiParameters, getContractAddress, getAddress, parseAbi,
  keccak256, toHex, zeroAddress } from 'viem';

const DEFAULT_ROOT = fileURLToPath(new URL('../omerta-contracts/', import.meta.url));
const BASE_CORE = ['safe', 'omr', 'poolManager', 'positionManager', 'permit2', 'oracle', 'fees', 'bond', 'hook', 'claim'];
const ROLE_NAMES = ['safe', 'dev', 'treasury', 'communityCustody', 'claim', 'keeper', 'guardian', 'deployer', 'bondSigner', 'voucherSigner'];
const BASE_DEPLOYMENTS = [['polVault', 'ProtocolLiquidityVault'], ['vig', 'LiquidityBuybackExecutor'],
  ['desk', 'LiquidityBuybackExecutor'], ['community', 'LiquidityBuybackExecutor'],
  ['polBuyback', 'LiquidityBuybackExecutor'], ['feeRouter', 'FeeRevenueRouter'], ['gasVault', 'KeeperGasVault']];
const STARTUP_MAX_AGE_SECONDS = 120;
const STARTUP_FUTURE_SKEW_SECONDS = 15;
const SHA = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
const clone = (value) => JSON.parse(json(value));
const ordered = (value) => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, ordered(value[k])])) : value;
const abiIdentity = (abi) => JSON.stringify((abi || []).map((entry) => JSON.stringify(ordered(entry))).sort());

function object(name, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} is required`);
  return value;
}
function addr(name, value, allowZero = false) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${name} must be a public EVM address`);
  const normalized = getAddress(value.toLowerCase());
  if (!allowZero && normalized === zeroAddress) throw new Error(`${name} cannot be zero`);
  return normalized;
}
function hash(name, value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value) || /^0x0{64}$/.test(value))
    throw new Error(`${name} requires a nonzero 32-byte hash`);
  return value.toLowerCase();
}
function uint(name, value, bits = 256, allowZero = false) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value))
    throw new Error(`${name} requires an explicit decimal integer string; no budget defaults are supplied`);
  const n = BigInt(value);
  if ((!allowZero && n === 0n) || n >= (1n << BigInt(bits))) throw new Error(`${name} is outside uint${bits} policy bounds`);
  return n;
}
function integer(name, value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} is outside ${min}..${max}`);
  return value;
}
function equal(name, actual, expected) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) throw new Error(`${name} does not match the committed binding`);
}
function bool(name, value) { if (typeof value !== 'boolean') throw new Error(`${name} must be explicitly true or false`); return value; }
function withinRoot(root, target) {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Validate every compiler source hash against the current working tree before using an ABI or bytecode. */
export function loadReviewedArtifact(contract, { contractsRoot = DEFAULT_ROOT } = {}) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(contract)) throw new Error('Invalid artifact contract name');
  const root = fs.realpathSync(contractsRoot);
  const file = path.join(root, 'out', `${contract}.sol`, `${contract}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing artifact for ${contract}; compile the reviewed source first`);
  const bytes = fs.readFileSync(file);
  const artifact = JSON.parse(bytes.toString('utf8'));
  const metadata = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : artifact.metadata;
  if (!Array.isArray(artifact.abi) || !metadata?.sources || metadata.settings?.compilationTarget?.[`src/${contract}.sol`] !== contract)
    throw new Error(`${contract}: missing compiler source/ABI identity`);
  // Foundry's parsed metadata representation drops empty outputs and adds empty receive inputs;
  // rawMetadata is the compiler's exact ABI representation without that serialization conversion.
  const compilerAbi = typeof artifact.rawMetadata === 'string' ? JSON.parse(artifact.rawMetadata).output?.abi : metadata.output?.abi;
  if (abiIdentity(artifact.abi) !== abiIdentity(compilerAbi))
    throw new Error(`${contract}: ABI differs from its compiler metadata`);
  if (!metadata.compiler?.version?.startsWith('0.8.26+') || metadata.settings.optimizer?.enabled !== true
      || metadata.settings.optimizer?.runs !== 800 || metadata.settings.evmVersion !== 'cancun')
    throw new Error(`${contract}: compiler settings differ from the reviewed 0.8.26/800/Cancun profile`);
  const sourceHashes = {};
  for (const [source, entry] of Object.entries(metadata.sources)) {
    const target = path.resolve(root, source);
    if (!withinRoot(root, target) || !fs.existsSync(target) || !withinRoot(root, fs.realpathSync(target)))
      throw new Error(`${contract}: source path unavailable or outside contracts tree: ${source}`);
    const content = fs.readFileSync(target);
    const actual = keccak256(toHex(content));
    // Foundry's compiler input may contain LF while the Windows checkout uses CRLF.
    // Permit only that byte normalization, retain both raw and compiler-input identities.
    const normalized = keccak256(toHex(content.toString('utf8').replace(/\r\n/g, '\n')));
    const expected = entry.keccak256?.toLowerCase();
    if (actual !== expected && normalized !== expected) throw new Error(`${contract}: artifact/source mismatch: ${source}`);
    sourceHashes[source] = { rawKeccak256: actual, sha256: SHA(content), compilerInputKeccak256: expected,
      crlfNormalized: actual !== expected };
  }
  for (const field of ['bytecode', 'deployedBytecode']) {
    if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(artifact[field]?.object || '')) throw new Error(`${contract}: missing or unlinked ${field}`);
    if (Object.keys(artifact[field].linkReferences || {}).length) throw new Error(`${contract}: linked-library deployment is unsupported`);
  }
  return { abi: artifact.abi, bytecode: artifact.bytecode.object, runtimeTemplate: artifact.deployedBytecode.object,
    evidence: { contract, artifactSha256: SHA(bytes), creationBytecodeKeccak256: keccak256(artifact.bytecode.object),
      runtimeTemplateKeccak256: keccak256(artifact.deployedBytecode.object),
      runtimeTemplateBytes: (artifact.deployedBytecode.object.length - 2) / 2,
      immutableReferences: artifact.deployedBytecode.immutableReferences || {},
      compiler: metadata.compiler.version, settings: metadata.settings, sources: sourceHashes } };
}

function validateInput(input) {
  const i = object('input', input);
  const rejectSecrets = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [name, entry] of Object.entries(value)) {
      if (/private.?key|mnemonic|seed.?phrase|password|secret|rpc.?url/i.test(name))
        throw new Error(`Private credentials and RPC endpoints are not deployment-plan inputs: ${name}`);
      rejectSecrets(entry);
    }
  };
  rejectSecrets(i);
  const allowed = new Set(['schemaVersion', 'chainId', 'localRehearsal', 'snapshot', 'roles', 'startingNonce', 'core', 'pool', 'bindings', 'policies', 'genesis', 'bank']);
  for (const key of Object.keys(i)) if (!allowed.has(key)) throw new Error(`Unknown input field ${key}; only public deployment inputs are accepted`);
  if (i.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  if (![4663, 46630].includes(i.chainId) && !(i.chainId === 31337 && i.localRehearsal === true))
    throw new Error('Unsupported chain: only Robinhood 4663/46630 or explicitly local 31337');
  const snapshot = object('snapshot', i.snapshot);
  equal('snapshot.chainId', snapshot.chainId, i.chainId);
  uint('snapshot.blockNumber', snapshot.blockNumber, 64, true); hash('snapshot.blockHash', snapshot.blockHash);
  const roles = Object.fromEntries(ROLE_NAMES.map((k) => [k, addr(`roles.${k}`, i.roles?.[k])]));
  for (const k of ['safe', 'dev', 'treasury', 'communityCustody', 'claim', 'deployer', 'bondSigner', 'voucherSigner']) {
    if (roles.keeper === roles[k]) throw new Error(`Dedicated keeper cannot also be ${k}`);
  }
  for (const k of ['safe', 'claim', 'treasury', 'dev', 'communityCustody', 'bondSigner', 'voucherSigner']) {
    if (roles.deployer === roles[k]) throw new Error(`CREATE deployer must be separate from ${k}`);
  }
  for (const k of ['bondSigner', 'voucherSigner']) if (roles[k] === roles.safe) throw new Error(`${k} cannot own governance`);
  if (roles.guardian !== roles.keeper && [roles.safe, roles.deployer, roles.bondSigner, roles.voucherSigner,
    roles.dev, roles.treasury, roles.claim, roles.communityCustody].includes(roles.guardian))
    throw new Error('Guardian must be a dedicated pause key or the designated keeper');
  const genesis = bool('genesis.enabled', i.genesis?.enabled);
  const bank = bool('bank.enabled', i.bank?.enabled);
  const names = [...BASE_CORE, ...(genesis ? ['strategy', 'splitter'] : []), ...(bank ? ['bankAsset', 'bankTransmuter', 'bankDebt'] : [])];
  const core = Object.fromEntries(names.map((name) => [name, {
    address: addr(`core.${name}.address`, i.core?.[name]?.address), runtimeHash: hash(`core.${name}.runtimeHash`, i.core?.[name]?.runtimeHash),
  }]));
  if (new Set(Object.values(core).map((c) => c.address)).size !== names.length) throw new Error('Core contract identities must be distinct');
  equal('Safe address', roles.safe, core.safe.address); equal('claim address', roles.claim, core.claim.address);
  if (Object.values(core).some((c) => [roles.keeper, roles.deployer, roles.guardian, roles.bondSigner, roles.voucherSigner].includes(c.address)))
    throw new Error('Operational keys cannot be core contract addresses');
  const b = object('bindings', i.bindings);
  for (const target of ['fees', 'bond', 'hook', 'claim']) equal(`${target}.owner`, addr(`${target}.owner`, b[target]?.owner), roles.safe);
  equal('positionManager.poolManager', b.positionManager?.poolManager, core.poolManager.address);
  equal('positionManager.permit2', b.positionManager?.permit2, core.permit2.address);
  equal('oracle.poolManager', b.oracle?.poolManager, core.poolManager.address);
  equal('oracle.source', b.oracle?.source, core.hook.address);
  equal('oracle.omr', b.oracle?.omr, core.omr.address);
  equal('hook.omr', b.hook?.omr, core.omr.address); equal('hook.poolManager', b.hook?.poolManager, core.poolManager.address);
  equal('fees.feeRecipient', b.fees?.feeRecipient, roles.dev);
  equal('fees.mintDevBps', b.fees?.mintDevBps, 10000); equal('fees.vigBps', b.fees?.vigBps, 2500);
  addr('fees.nonMintRouter', b.fees?.nonMintRouter, true);
  equal('bond.omr', b.bond?.omr, core.omr.address); equal('claim.omr', b.claim?.omr, core.omr.address);
  equal('bond.signer', b.bond?.signer, roles.bondSigner); equal('claim.signer', b.claim?.signer, roles.voucherSigner);
  bool('bond.paused', b.bond?.paused); addr('bond.liquidityHealthGuard', b.bond?.liquidityHealthGuard, true);
  for (const k of ['polBps', 'devBps', 'rwaBps']) integer(`bond.${k}`, b.bond[k], 0, 10000);
  if (b.bond.polBps + b.bond.devBps + b.bond.rwaBps >= 10000) throw new Error('Bond fixed shares leave no Vig allocation');
  equal('hook.devRecipient', b.hook?.devRecipient, roles.dev); equal('hook.rwaRecipient', b.hook?.rwaRecipient, roles.treasury);
  for (const k of ['sellTaxBps', 'taxDevBps', 'taxRwaBps', 'taxCommunityBps']) integer(`hook.${k}`, b.hook[k], 0, 1000);
  if (b.hook.taxDevBps + b.hook.taxRwaBps + b.hook.taxCommunityBps > b.hook.sellTaxBps) throw new Error('Hook shares exceed tax');
  const pool = object('pool', i.pool);
  integer('pool.fee', pool.fee, 0, 999999); integer('pool.tickSpacing', pool.tickSpacing, 1, 32767);
  const key = { currency0: zeroAddress, currency1: core.omr.address, fee: pool.fee, tickSpacing: pool.tickSpacing, hooks: core.hook.address };
  if ((BigInt(core.hook.address) & 0xf03n) !== 0n) throw new Error('Hook has unsupported liquidity callback flags');
  const policy = object('policies', i.policies);
  const pol = {};
  for (const k of ['minLiquidity', 'maxNativePerAction', 'maxNativePerWindow', 'maxOmrPerAction', 'maxOmrPerWindow']) pol[k] = uint(`policies.pol.${k}`, policy.pol?.[k], 128);
  for (const k of ['warmup', 'maxOracleAge', 'budgetWindow']) pol[k] = uint(`policies.pol.${k}`, policy.pol?.[k], 32);
  pol.maxDeviationBps = integer('policies.pol.maxDeviationBps', policy.pol?.maxDeviationBps, 1, 1000);
  if (pol.warmup < pol.maxOracleAge || pol.maxNativePerWindow < pol.maxNativePerAction || pol.maxOmrPerWindow < pol.maxOmrPerAction)
    throw new Error('POL warmup/window caps are inconsistent');
  const buys = Object.fromEntries(['vig', 'desk', 'community', 'polBuyback'].map((s) => {
    const p = policy.buybacks?.[s];
    const result = { perAction: uint(`${s}.perAction`, p?.perAction, 128), perDay: uint(`${s}.perDay`, p?.perDay, 128),
      minInterval: uint(`${s}.minInterval`, p?.minInterval, 32), maxOracleAge: uint(`${s}.maxOracleAge`, p?.maxOracleAge, 32),
      slippageBps: integer(`${s}.slippageBps`, p?.slippageBps, 0, 1000) };
    if (result.perDay < result.perAction) throw new Error(`${s} per-action cap exceeds daily budget`);
    return [s, result];
  }));
  const gas = Object.fromEntries(['periodBudget', 'perRefillCap', 'targetBalance', 'minInterval'].map((k) => [k, uint(`gas.${k}`, policy.gas?.[k])]));
  if (gas.perRefillCap > gas.periodBudget || gas.perRefillCap > gas.targetBalance) throw new Error('Gas refill cap exceeds budget/target');
  // OmertaBond explicitly defines a zero daily cap as unlimited; other budgets remain positive.
  const bond = { dailyCapOMR: uint('bond.dailyCapOMR', policy.bond?.dailyCapOMR, 256, true), maxOmrPerEth: uint('bond.maxOmrPerEth', policy.bond?.maxOmrPerEth),
    maxOracleAge: uint('bond.maxOracleAge', policy.bond?.maxOracleAge, 32),
    priceToleranceBps: integer('bond.priceToleranceBps', policy.bond?.priceToleranceBps, 0, 2000),
    unpauseAfterConfiguration: bool('bond.unpauseAfterConfiguration', policy.bond?.unpauseAfterConfiguration) };
  if (genesis) {
    equal('genesis splitter manager', b.splitter?.poolManager, core.poolManager.address);
    equal('genesis splitter treasury', b.splitter?.treasuryRecipient, roles.treasury);
    equal('genesis splitter founder', b.splitter?.founderRecipient, roles.dev);
    equal('hook.authorized', b.hook?.authorized, core.strategy.address);
    uint('genesis.maxOracleAge', i.genesis.maxOracleAge, 32);
  }
  if (bank) {
    equal('bank Transmuter owner', b.bankTransmuter?.owner, roles.safe);
    equal('bank Transmuter asset', b.bankTransmuter?.asset, core.bankAsset.address);
    equal('bank Transmuter debt', b.bankTransmuter?.debtToken, core.bankDebt.address);
    integer('bank.assetDecimals', i.bank.assetDecimals, 0, 18);
    equal('bank asset decimals', b.bankAsset?.decimals, i.bank.assetDecimals);
    const cap = uint('bank.perActionCap', i.bank.perActionCap); const daily = uint('bank.periodBudget', i.bank.periodBudget);
    if (cap > daily) throw new Error('Bank action cap exceeds daily budget');
  }
  return { i, roles, core, key, b, pol, buys, gas, bond, genesis, bank, nonce: uint('startingNonce', i.startingNonce, 64, true) };
}

/** Produces a deterministic unsigned plan from public, caller-supplied observations. No network verification is implied. */
export function buildLiquidityDeploymentPlan(input, { contractsRoot = DEFAULT_ROOT } = {}) {
  const { i, roles: r, core: c, key, b, pol, buys, gas, bond, genesis, bank, nonce } = validateInput(input);
  const order = [...BASE_DEPLOYMENTS, ...(genesis ? [['genesisController', 'GenesisLifecycleController'],
    ['genesisWalletCap', 'GenesisWalletCap']] : []),
    ...(bank ? [['bankBuffer', 'BankBufferVault']] : [])];
  if (nonce + BigInt(order.length) >= (1n << 64n)) throw new Error('Deployment nonces exceed the EIP-2681 account limit');
  const needed = [...new Set([...order.map(([, type]) => type), 'OmertaFees', 'OmertaBond', 'OmertaHook', ...(bank ? ['Transmuter'] : [])])];
  const artifacts = Object.fromEntries(needed.map((name) => [name, loadReviewedArtifact(name, { contractsRoot })]));
  const predicted = Object.fromEntries(order.map(([name], index) => [name, getContractAddress({ from: r.deployer, nonce: nonce + BigInt(index) })]));
  const occupied = new Set([...Object.values(c).map((v) => v.address), ...Object.values(r)].map((a) => a.toLowerCase()));
  if (Object.values(predicted).some((a) => occupied.has(a.toLowerCase()))) throw new Error('Predicted CREATE address collides with an existing contract or role');
  const keyParam = artifacts.LiquidityBuybackExecutor.abi.find((v) => v.type === 'constructor').inputs[2];
  const poolId = keccak256(encodeAbiParameters([keyParam], [key]));
  equal('pool.id', hash('pool.id', i.pool.id), poolId); equal('oracle.poolId', b.oracle.poolId, poolId);
  if (genesis) {
    equal('splitter.canonicalPoolId', b.splitter.canonicalPoolId, poolId);
    equal('splitter.vigRecipient', b.splitter.vigRecipient, predicted.vig);
  }
  const polConfig = { safe: r.safe, keeper: r.keeper, positionManager: c.positionManager.address, permit2: c.permit2.address,
    oracle: c.oracle.address, key, deskRecipient: predicted.desk, vigRecipient: predicted.vig, ...pol };
  const buy = (name, stream, primary, secondary = zeroAddress) => [r.safe, c.poolManager.address, key,
    c.oracle.address, predicted.polVault, stream, primary, secondary, buys[name]];
  const args = {
    polVault: [polConfig], vig: buy('vig', 0, r.claim, r.claim), desk: buy('desk', 1, r.claim),
    community: buy('community', 2, r.communityCustody), polBuyback: buy('polBuyback', 3, predicted.polVault),
    feeRouter: [c.fees.address, r.dev, predicted.vig, r.treasury, predicted.community],
    gasVault: [r.safe, gas.periodBudget, gas.perRefillCap, gas.targetBalance, gas.minInterval],
    ...(genesis ? { genesisController: [r.safe, c.strategy.address, c.splitter.address, predicted.polVault, c.oracle.address,
      c.omr.address, r.treasury, BigInt(i.genesis.maxOracleAge)], genesisWalletCap: [predicted.genesisController] } : {}),
    ...(bank ? { bankBuffer: [c.bankAsset.address, c.bankTransmuter.address, r.safe, BigInt(i.bank.perActionCap), BigInt(i.bank.periodBudget)] } : {}),
  };
  const codeDependencies = {
    polVault: ['positionManager', 'permit2', 'oracle', 'omr', 'hook', 'poolManager'],
    vig: ['poolManager', 'oracle', 'omr', 'polVault'], desk: ['poolManager', 'oracle', 'omr', 'polVault'],
    community: ['poolManager', 'oracle', 'omr', 'polVault'], polBuyback: ['poolManager', 'oracle', 'omr', 'polVault'],
    feeRouter: ['fees'], gasVault: [], genesisController: ['strategy', 'splitter', 'polVault', 'oracle', 'omr', 'poolManager'],
    genesisWalletCap: ['genesisController'], bankBuffer: ['bankAsset', 'bankTransmuter'],
  };
  const available = new Set(Object.keys(c));
  const deployments = order.map(([name, contract], index) => {
    for (const dep of codeDependencies[name]) if (!available.has(dep)) throw new Error(`${name}: constructor requires ${dep} code before deployment`);
    const artifact = artifacts[contract]; const data = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args: args[name] });
    available.add(name);
    return { id: name, contract, chainId: i.chainId, from: r.deployer, to: null, nonce: String(nonce + BigInt(index)),
      value: '0', predictedAddress: predicted[name], data, initCodeKeccak256: keccak256(data),
      constructorArguments: clone(args[name]), requiredCodeBeforeCreation: codeDependencies[name],
      constructorBoundValues: name === 'polVault' ? clone(polConfig) : clone(args[name]),
      owner: contract === 'FeeRevenueRouter' ? null : r.safe,
      artifact: artifact.evidence };
  });
  const calls = [];
  const call = (id, contract, target, functionName, values, purpose) => calls.push({ id, chainId: i.chainId,
    from: r.safe, to: target, value: '0', operation: 0, functionName, arguments: clone(values), purpose,
    data: encodeFunctionData({ abi: artifacts[contract].abi, functionName, args: values }) });
  if (!b.bond.paused) call('bond-pause', 'OmertaBond', c.bond.address, 'pause', [], 'Stop quote execution while changing issuance boundaries.');
  // The fresh vault binds r.keeper in its constructor; setKeeper is a paused-only rotation path.
  call('pol-inventory', 'ProtocolLiquidityVault', predicted.polVault, 'setInventoryExecutor', [predicted.polBuyback], 'Bind the one fixed inventory buyer.');
  if (genesis) call('pol-genesis', 'ProtocolLiquidityVault', predicted.polVault, 'setGenesisController', [predicted.genesisController], 'Allow only one qualifying custody adoption.');
  for (const name of ['vig', 'desk', 'community', 'polBuyback']) call(`${name}-keeper`, 'LiquidityBuybackExecutor', predicted[name], 'setKeeper', [r.keeper, true], 'Keeper may execute only the immutable stream policy.');
  call('gas-keeper', 'KeeperGasVault', predicted.gasVault, 'setKeeperAllowed', [r.keeper, true], 'Allow bounded gas refills to the declared keeper.');
  if (addr('fees.nonMintRouter', b.fees.nonMintRouter, true) !== zeroAddress)
    call('fees-detach-router', 'OmertaFees', c.fees.address, 'setNonMintRouter', [zeroAddress], 'Temporarily detach the old router inside the same atomic Safe batch.');
  call('fees-vig', 'OmertaFees', c.fees.address, 'setVigRecipient', [predicted.vig], 'Bind the fixed Vig buyer without changing DEV mint custody.');
  call('fees-router', 'OmertaFees', c.fees.address, 'setNonMintRouter', [predicted.feeRouter], 'Apply 50% DEV / 25% Vig / 10% treasury / 15% community to non-mint fees.');
  call('bond-recipients', 'OmertaBond', c.bond.address, 'setRecipients', [predicted.polVault, r.dev, r.treasury, predicted.vig], 'Preserve immutable bond shares with the reviewed automated destinations.');
  call('bond-oracle', 'OmertaBond', c.bond.address, 'setOracle', [c.oracle.address, bond.priceToleranceBps, bond.maxOracleAge], 'Use the declared canonical oracle and finite age policy.');
  call('bond-health', 'OmertaBond', c.bond.address, 'setLiquidityHealthGuard', [predicted.polVault], 'Require actual POL custody and warmup for new issuance.');
  call('bond-guardian', 'OmertaBond', c.bond.address, 'setEmergencyGuardian', [r.guardian], 'Grant pause-only authority to the designated monitor.');
  call('bond-daily-cap', 'OmertaBond', c.bond.address, 'setDailyCap', [bond.dailyCapOMR], bond.dailyCapOMR === 0n
    ? 'Remove the global daily bond issuance limit; oracle, rate, liquidity-health and pause checks remain.'
    : 'Install the explicitly selected finite daily bond issuance budget.');
  call('bond-rate-cap', 'OmertaBond', c.bond.address, 'setMaxRate', [bond.maxOmrPerEth], 'Install the explicitly selected issuance-rate ceiling.');
  call('hook-recipients', 'OmertaHook', c.hook.address, 'setRecipients', [r.dev, r.treasury, predicted.community, predicted.polVault], 'Preserve DEV/treasury and every tax ratio; automate only community/POL custody.');
  if (bank) call('bank-funder', 'Transmuter', c.bankTransmuter.address, 'setFunder', [predicted.bankBuffer, true], 'Permit only the prefunded bounded buffer path; grant no mint/burn authority.');
  if (bond.unpauseAfterConfiguration) call('bond-resume', 'OmertaBond', c.bond.address, 'unpause', [], 'Resume only after installing all guards; absent/unhealthy foundation still rejects issuance.');
  const result = { schemaVersion: 1, unsigned: true, broadcasts: false, networkAccess: false,
    chainId: i.chainId, inputSha256: SHA(json(input)), snapshot: clone(i.snapshot), snapshotVerifiedOnChain: false,
    roles: r, coreRuntimePins: c, pool: { id: poolId, key }, predicted, deployments,
    startupProtocol: {
      stage: 'after_prerequisites_before_first_create', deployer: r.deployer,
      firstNonce: String(nonce), nextNonceAfterBundle: String(nonce + BigInt(order.length)),
      transactionCount: order.length, maxSnapshotAgeSeconds: STARTUP_MAX_AGE_SECONDS,
      nonceReservationEnforcedOnChain: false,
      requiredCoreContracts: Object.keys(c),
      genesis: genesis ? { splitter: c.splitter.address, vigRecipient: predicted.vig,
        strategy: c.strategy.address, poolMustBeUninitialized: true } : null,
      requirements: [
        'Mine all prerequisite deployments before startup verification, including the hook CREATE2 factory call, oracle and immutable splitter. Every transaction from this deployer consumes its nonce, including factory calls and reverted transactions.',
        'Choose the bundle starting nonce before deploying the immutable splitter, accounting for every prerequisite transaction from this deployer. The splitter must commit to the Vig address at startingNonce + 1.',
        'Run verifyLiquidityDeploymentStartup with the approved plan hash immediately before the first CREATE. Both latest and pending deployer nonces must equal firstNonce; all core runtimes must exist and every CREATE destination must have no code and nonce zero. A prefunded balance is allowed.',
        'Give this deployer exclusive use of the reserved nonce interval. Before each later CREATE, recheck its exact nonce and the preceding successful receipt, runtime and constructor bindings. Do not submit concurrent factory, funding or other transactions from this EOA.',
        'A consumed nonce, reverted creation, changed dependency or occupied destination stops execution. Never shift the remaining nonces or rebuild the immutable recipient predictions to continue an interrupted bundle.',
      ],
    },
    governance: { owner: r.safe, mustExecuteAsAtomicSafeBatch: true, calls },
    bondIssuancePolicy: { dailyCapOMR: String(bond.dailyCapOMR), dailyLimit: bond.dailyCapOMR === 0n ? 'unlimited' : 'finite' },
    preservedPolicy: { mint: { devBps: 10000, recipient: r.dev, feeAmountChanged: false },
      nonMint: { devBps: 5000, vigBps: 2500, treasuryBps: 1000, communityBps: 1500 },
      bond: { polBps: b.bond.polBps, devBps: b.bond.devBps, treasuryBps: b.bond.rwaBps,
        vigBps: 10000 - b.bond.polBps - b.bond.devBps - b.bond.rwaBps },
      hook: { sellTaxBps: b.hook.sellTaxBps, devBps: b.hook.taxDevBps, treasuryBps: b.hook.taxRwaBps,
        communityBps: b.hook.taxCommunityBps, polBps: b.hook.sellTaxBps - b.hook.taxDevBps - b.hook.taxRwaBps - b.hook.taxCommunityBps } },
    postDeploymentChecks: [
      'Independently verify the supplied chain snapshot, Safe owner/threshold, core runtime pins and every declared getter binding.',
      'Require the deployer to be an EOA with this exact starting nonce; confirm each predicted address is empty before sequential CREATE transactions.',
      'Compare each deployed runtime against its reviewed template with compiler immutable references resolved, then verify constructor-bound getters.',
      'Simulate all ordered calls as one atomic Safe batch after every creation; no private key, gas fee or signature is included here.',
      'Confirm mint remains 100% DEV, signer/minter/burner authorities remain unchanged, and keeper has no governance or withdrawal authority.',
      'Prefund operating gas/backing separately using explicitly approved amounts; this plan contains no funding or payout transaction.',
      ...(genesis ? ['The existing splitter must already commit its immutable Vig recipient to the predicted Vig executor; this plan refuses an old operations-wallet recipient.',
        'Create the atomic CCA with tokensRecipient=predicted.genesisController, validationHook=predicted.genesisWalletCap and LP positionRecipient=predicted.polVault, then bind its verified address before startBlock. The hook enforces 0.28 ETH cumulative per bidding wallet. Auction creation/binding is not fabricated in this plan.'] : []),
      ...(bank ? ['Keep bank activation subject to its separate concrete asset/ERC-4626 review; this plan does not enable debt issuance or seed the first borrow.'] : []),
    ] };
  return { ...result, planSha256: SHA(json(result)) };
}

/** Read-only startup proof for one approved plan. This is not an on-chain nonce reservation or
 * permission to broadcast; the caller must retain exclusive use of the deployer after this read. */
export async function verifyLiquidityDeploymentStartup(client, plan, { expectedPlanSha256, now = Date.now } = {}) {
  if (typeof expectedPlanSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedPlanSha256))
    throw new Error('The independently approved expectedPlanSha256 is required');
  const { planSha256, ...body } = object('plan', plan);
  if (SHA(json(body)) !== expectedPlanSha256.toLowerCase() || planSha256 !== expectedPlanSha256.toLowerCase())
    throw new Error('Deployment plan does not match the approved hash');
  const protocol = object('plan.startupProtocol', plan.startupProtocol);
  const deployer = addr('plan.roles.deployer', plan.roles?.deployer);
  equal('startup deployer', protocol.deployer, deployer);
  const firstNonce = uint('startup firstNonce', protocol.firstNonce, 64, true);
  if (!Array.isArray(plan.deployments) || plan.deployments.length === 0
      || protocol.transactionCount !== plan.deployments.length) throw new Error('Invalid CREATE sequence');
  equal('startup next nonce', protocol.nextNonceAfterBundle, firstNonce + BigInt(plan.deployments.length));
  for (const [index, deployment] of plan.deployments.entries()) {
    equal('CREATE sender', deployment.from, deployer);
    equal('CREATE chain', deployment.chainId, plan.chainId);
    equal('CREATE nonce', deployment.nonce, firstNonce + BigInt(index));
    equal('CREATE address', deployment.predictedAddress,
      getContractAddress({ from: deployer, nonce: firstNonce + BigInt(index) }));
    equal('CREATE init code', keccak256(deployment.data), deployment.initCodeKeccak256);
    if (deployment.to !== null) throw new Error('Only sequential EOA CREATE transactions are supported');
  }
  const chainId = await client.getChainId();
  equal('startup chain', chainId, plan.chainId);
  const block = await client.getBlock({ blockTag: 'latest' });
  const number = uint('startup block number', String(block?.number), 64, true);
  const blockHash = hash('startup block hash', block?.hash);
  const fresh = (head) => {
    const timestamp = uint('startup block timestamp', String(head?.timestamp), 64, true);
    const clock = now();
    if (!Number.isSafeInteger(clock) || clock < 0) throw new Error('Invalid startup verification clock');
    const seconds = BigInt(Math.floor(clock / 1000));
    if (timestamp > seconds + BigInt(STARTUP_FUTURE_SKEW_SECONDS)
        || seconds > timestamp + BigInt(STARTUP_MAX_AGE_SECONDS)) throw new Error('Stale or future startup block');
  };
  fresh(block);
  const plannedBlock = uint('plan snapshot block', plan.snapshot?.blockNumber, 64, true);
  if (number < plannedBlock) throw new Error('Startup block precedes the approved plan snapshot');
  if (number === plannedBlock) equal('plan snapshot block hash', blockHash, plan.snapshot.blockHash);
  const nonceValue = (value) => {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Unsafe deployer nonce response');
    return uint('deployer nonce', String(value), 64, true);
  };
  const checkNonces = async () => {
    const [latest, pending] = await Promise.all([
      client.getTransactionCount({ address: deployer, blockTag: 'latest' }),
      client.getTransactionCount({ address: deployer, blockTag: 'pending' }),
    ]);
    if (nonceValue(latest) !== firstNonce || nonceValue(pending) !== firstNonce)
      throw new Error('Deployer latest/pending nonce differs from the reserved first nonce; stop without rebasing');
  };
  await checkNonces();
  const at = { blockNumber: number };
  const [deployerCode, pinnedNonce] = await Promise.all([
    client.getCode({ address: deployer, ...at }), client.getTransactionCount({ address: deployer, ...at }),
  ]);
  if (deployerCode && deployerCode !== '0x') throw new Error('CREATE deployer must be an EOA without code');
  if (nonceValue(pinnedNonce) !== firstNonce) throw new Error('Deployer nonce at the verified block differs from the plan');
  const core = object('plan.coreRuntimePins', plan.coreRuntimePins);
  if (json(protocol.requiredCoreContracts) !== json(Object.keys(core))) throw new Error('Startup dependency inventory mismatch');
  const coreRuntimePins = await Promise.all(Object.entries(core).map(async ([name, pin]) => {
    const address = addr(`core.${name}`, pin.address);
    const code = await client.getCode({ address, ...at });
    if (!code || code === '0x' || keccak256(code) !== pin.runtimeHash.toLowerCase())
      throw new Error(`Startup core runtime mismatch: ${name}`);
    return { name, address, runtimeHash: keccak256(code) };
  }));
  await Promise.all(plan.deployments.map(async (deployment) => {
    const [code, nonce] = await Promise.all([
      client.getCode({ address: deployment.predictedAddress, ...at }),
      client.getTransactionCount({ address: deployment.predictedAddress, ...at }),
    ]);
    if ((code && code !== '0x') || nonceValue(nonce) !== 0n)
      throw new Error(`CREATE destination is already occupied: ${deployment.id}`);
  }));
  if (protocol.genesis) {
    const g = protocol.genesis;
    equal('startup splitter', g.splitter, core.splitter?.address);
    equal('startup Vig', g.vigRecipient, plan.predicted.vig);
    const read = (signature) => client.readContract({ address: g.splitter, ...at,
      abi: parseAbi([`function ${signature}`]), functionName: signature.split('(')[0] });
    const expectations = [
      ['poolManager() view returns (address)', core.poolManager.address],
      ['canonicalPoolId() view returns (bytes32)', plan.pool.id],
      ['treasuryRecipient() view returns (address)', plan.roles.treasury],
      ['vigRecipient() view returns (address)', plan.predicted.vig],
      ['founderRecipient() view returns (address)', plan.roles.dev],
      ['canonicalPoolInitialized() view returns (bool)', false],
    ];
    await Promise.all(expectations.map(async ([signature, expected]) => equal(`startup splitter ${signature}`, await read(signature), expected)));
  }
  const canonical = await client.getBlock({ blockNumber: number });
  equal('startup canonical block', canonical?.hash, blockHash);
  equal('startup canonical number', canonical?.number, number);
  fresh(block);
  await checkNonces();
  equal('startup final chain', await client.getChainId(), chainId);
  fresh(block);
  const evidence = { schemaVersion: 1, status: 'startup_verified', planSha256, chainId,
    blockNumber: String(number), blockHash, blockTimestamp: String(block.timestamp),
    deployer, latestNonce: String(firstNonce), pendingNonce: String(firstNonce), coreRuntimePins,
    emptyCreationAddresses: plan.deployments.map((d) => d.predictedAddress),
    genesisSplitterVerified: !!protocol.genesis, broadcasts: false, nonceReservationEnforcedOnChain: false };
  return { ...evidence, evidenceSha256: SHA(json(evidence)) };
}

export function liquidityDeploymentInputTemplate() {
  const entry = () => ({ address: null, runtimeHash: null });
  const buy = () => ({ perAction: null, perDay: null, minInterval: null, maxOracleAge: null, slippageBps: null });
  return { schemaVersion: 1, chainId: null, localRehearsal: false,
    snapshot: { chainId: null, blockNumber: null, blockHash: null },
    roles: Object.fromEntries(ROLE_NAMES.map((name) => [name, null])), startingNonce: null,
    core: Object.fromEntries([...BASE_CORE, 'strategy', 'splitter', 'bankAsset', 'bankTransmuter', 'bankDebt'].map((name) => [name, entry()])),
    pool: { id: null, fee: null, tickSpacing: null },
    bindings: { positionManager: { poolManager: null, permit2: null }, oracle: { poolManager: null, source: null, omr: null, poolId: null },
      fees: { owner: null, feeRecipient: null, vigBps: null, mintDevBps: null, nonMintRouter: null },
      bond: { owner: null, omr: null, signer: null, paused: null, liquidityHealthGuard: null, polBps: null, devBps: null, rwaBps: null },
      claim: { owner: null, omr: null, signer: null }, hook: { owner: null, poolManager: null, omr: null, authorized: null,
        devRecipient: null, rwaRecipient: null, sellTaxBps: null, taxDevBps: null, taxRwaBps: null, taxCommunityBps: null },
      splitter: { poolManager: null, canonicalPoolId: null, treasuryRecipient: null, vigRecipient: null, founderRecipient: null },
      bankTransmuter: { owner: null, asset: null, debtToken: null }, bankAsset: { decimals: null } },
    policies: { pol: { minLiquidity: null, warmup: null, maxOracleAge: null, maxDeviationBps: null, budgetWindow: null,
      maxNativePerAction: null, maxNativePerWindow: null, maxOmrPerAction: null, maxOmrPerWindow: null },
      buybacks: Object.fromEntries(['vig', 'desk', 'community', 'polBuyback'].map((name) => [name, buy()])),
      gas: { periodBudget: null, perRefillCap: null, targetBalance: null, minInterval: null },
      bond: { dailyCapOMR: null, maxOmrPerEth: null, maxOracleAge: null, priceToleranceBps: null, unpauseAfterConfiguration: null } },
    genesis: { enabled: false, maxOracleAge: null }, bank: { enabled: false, assetDecimals: null, perActionCap: null, periodBudget: null } };
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  const [mode, inputFile, outputFile] = process.argv.slice(2);
  if (mode === '--template' && !inputFile) console.log(json(liquidityDeploymentInputTemplate()));
  else if (mode === '--plan' && inputFile && process.argv.length <= 5) {
    const result = buildLiquidityDeploymentPlan(JSON.parse(fs.readFileSync(inputFile, 'utf8')));
    const bytes = `${json(result)}\n`;
    if (outputFile) { fs.writeFileSync(outputFile, bytes, { flag: 'wx' }); console.log(json({ file: path.resolve(outputFile), planSha256: result.planSha256, unsigned: true })); }
    else console.log(bytes);
  } else {
    console.error('Usage: node tools/liquidity-deployment-plan.js --template | --plan INPUT.json [NEW_OUTPUT.json]');
    console.error('All addresses, current bindings, runtime hashes, nonce and finite budgets are explicit public inputs. This tool never contacts an RPC, signs, broadcasts or funds.');
    process.exitCode = 1;
  }
}
