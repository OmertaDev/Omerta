#!/usr/bin/env node
// Offline, unsigned guarded-auction route. Never reads credentials, signs, or broadcasts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { encodeDeployData, encodeFunctionData, getAddress, getContractAddress,
  keccak256, concatHex, toHex, zeroAddress } from 'viem';
import { buildMarketV2DeploymentPlan, loadMarketV2Artifact, MARKET_V2_ROLES,
  RESTRICTED_MARKET_POLICY_ID, RESTRICTED_MARKET_SUPPLY, sqrtAtTick } from './market-v2-deployment-plan.js';
import { buildGenesisCadenceEvidence, canonicalJson } from '../src/genesiscadence.js';

const ROOT = fileURLToPath(new URL('../omerta-contracts/', import.meta.url));
const EXTRA = {
  OmertaRestrictedOMRV2: ['src/market-v2/OmertaRestrictedOMRV2.sol', true],
  OmertaPoolManagerV2: ['src/market-v2/core/OmertaPoolManagerV2.sol', false],
  PositionManager: ['lib/v4-periphery/src/PositionManager.sol', true],
  OmertaGenesisCoordinatorV2: ['src/market-v2/OmertaGenesisCoordinatorV2.sol', true],
  OmertaGuardedAuction: ['src/genesis-auction/OmertaGuardedAuction.sol', false],
};
export const PLAYER_GENESIS_ROLES = [
  ['omr', 'OmertaRestrictedOMRV2'], ['poolManager', 'OmertaPoolManagerV2'], ['positionManager', 'PositionManager'],
  ['coordinator', 'OmertaGenesisCoordinatorV2'], ...MARKET_V2_ROLES,
  ['auction', 'OmertaGuardedAuction'],
];
const stringify = x => JSON.stringify(x, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
const clone = x => JSON.parse(stringify(x));
const sha = x => createHash('sha256').update(x).digest('hex');
function obj(name, x) { if (!x || typeof x !== 'object' || Array.isArray(x)) throw Error(`${name}: object required`); return x; }
function keys(name, x, expected) {
  obj(name, x);
  for (const key of expected) if (!(key in x)) throw Error(`${name}.${key}: explicit value required`);
  for (const key of Object.keys(x)) if (!expected.includes(key)) throw Error(`${name}.${key}: unknown field`);
}
function addr(name, x) {
  if (!/^0x[\da-fA-F]{40}$/.test(x || '') || /^0x0{40}$/.test(x)) throw Error(`${name}: nonzero public address required`);
  return getAddress(x.toLowerCase());
}
function uint(name, x, bits = 256, zero = false) {
  if (typeof x !== 'string' || !/^(0|[1-9]\d*)$/.test(x)) throw Error(`${name}: decimal integer string required`);
  const n = BigInt(x);
  if ((!zero && !n) || n >= 1n << BigInt(bits)) throw Error(`${name}: uint${bits} bounds`);
  return n;
}
function hash(name, x) {
  if (!/^0x[\da-fA-F]{64}$/.test(x || '') || /^0x0{64}$/.test(x)) throw Error(`${name}: nonzero bytes32 required`);
  return x.toLowerCase();
}
function exact(name, a, b) { if (String(a).toLowerCase() !== String(b).toLowerCase()) throw Error(`${name}: binding mismatch`); }
function publicOnly(x) {
  if (!x || typeof x !== 'object') return;
  for (const [key, value] of Object.entries(x)) {
    if (/private.?key|mnemonic|secret|password|seed.?phrase|rpc.?url/i.test(key)) throw Error(`Credentials/endpoints forbidden: ${key}`);
    publicOnly(value);
  }
}
const sorted = x => Array.isArray(x) ? x.map(sorted) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sorted(x[k])])) : x;
const abiIdentity = x => JSON.stringify(x.map(v => JSON.stringify(sorted(v))).sort());
const within = (root, p) => { const r = path.relative(root, p); return r !== '..' && !r.startsWith(`..${path.sep}`) && !path.isAbsolute(r); };
const ceilDiv = (a, b) => (a + b - 1n) / b;
export const GENESIS_INITIAL_LP_BPS = 5000;
export const GENESIS_LIQUIDITY_LOCK_SECONDS = 90 * 24 * 60 * 60;
function sqrt(value) {
  if (value < 2n) return value;
  let current = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
  for (;;) {
    const next = (current + value / current) / 2n;
    if (next >= current) return current;
    current = next;
  }
}

/** Exact integer counterpart of OmertaGenesisCoordinatorV2._minimumTokenReserve. */
export function minimumGenesisTokenReserve({ supply, floorPrice, maximumBidPrice, spacing, minimumRaise }) {
  if (!Number.isInteger(spacing) || spacing < 1 || spacing > 32767
    || floorPrice < (1n << 32n) + 1n || maximumBidPrice < floorPrice || maximumBidPrice >= 1n << 160n
    || supply <= 0n || supply > 1n << 100n) throw Error('Genesis price/supply cannot fund supported full-range liquidity');
  const upperTick = Math.trunc(887272 / spacing) * spacing;
  const upper = sqrtAtTick(upperTick), lower = sqrtAtTick(-upperTick);
  const largestSqrt = sqrt((1n << 288n) / floorPrice);
  const smallestSqrt = sqrt((1n << 288n) / maximumBidPrice);
  if (smallestSqrt <= lower || largestSqrt >= upper / 2n) throw Error('Genesis price bounds exceed the finite full-range ticks');
  const required = ceilDiv(ceilDiv(supply * BigInt(GENESIS_INITIAL_LP_BPS), 10_000n) * upper, upper - largestSqrt) + 2n;
  const roundingBudget = 100n * (ceilDiv(1n << 96n, smallestSqrt) + 2n);
  if (minimumRaise * BigInt(GENESIS_INITIAL_LP_BPS) / 10_000n < roundingBudget || minimumRaise < ceilDiv(maximumBidPrice, 1n << 96n))
    throw Error('Auction requiredCurrencyRaised is too small for full-range liquidity rounding');
  return required;
}

function productionCadence(m, start, end, claim, inventory, minimumRaise) {
  if (m.chainId !== 4663) return null;
  if (inventory !== 60_000_000n * 10n ** 18n || minimumRaise !== 20n * 10n ** 18n)
    throw Error('Mainnet launch requires the approved 60000000 OMR inventory and 20 ETH graduation threshold');
  if (BigInt(m.snapshot.maxAgeSeconds) > 300n) throw Error('Mainnet snapshot.maxAgeSeconds cannot exceed 300');
  const raw = obj('auction.cadence', m.auction.cadence);
  const cadence = buildGenesisCadenceEvidence(raw);
  if (canonicalJson(raw) !== canonicalJson(cadence)) throw Error('auction.cadence must match its recomputed evidence hash and summary');
  const snapshotMs = Number(BigInt(m.snapshot.timestamp) * 1000n);
  const generatedMs = Date.parse(cadence.generatedAt);
  const lastObservedMs = Date.parse(cadence.samples.at(-1).observedAt);
  if (!Number.isSafeInteger(snapshotMs) || generatedMs > snapshotMs || lastObservedMs > generatedMs
    || snapshotMs - generatedMs > 3600_000 || snapshotMs - lastObservedMs > 3600_000)
    throw Error('Auction cadence samples must finish within one hour before the pinned snapshot');
  if (cadence.summary.lastBlockNumberish > BigInt(m.snapshot.auctionClock)
    || cadence.samples.at(-1).latestBlock > BigInt(m.snapshot.blockNumber)
    || cadence.samples.at(-1).latestTimestamp > BigInt(m.snapshot.timestamp))
    throw Error('Auction cadence samples cannot be ahead of the pinned snapshot');
  if (end - start !== cadence.summary.auctionBlocks || claim - end !== cadence.summary.claimDelayBlocks)
    throw Error('Mainnet bidding and claim delay must equal the cadence-derived seven-day auction and one-day cliff');
  return cadence;
}

/** Pin every imported working-tree source, exact ABI, compiler profile, and unlinked artifact. */
export function loadPlayerGenesisArtifact(contract, { contractsRoot = ROOT } = {}) {
  if (!(contract in EXTRA)) return loadMarketV2Artifact(contract, { contractsRoot });
  const [target, viaIR] = EXTRA[contract];
  const root = fs.realpathSync(contractsRoot);
  const file = path.join(root, 'out', `${contract}.sol`, `${contract}.json`);
  if (!within(root, fs.realpathSync(file))) throw Error(`${contract}: artifact outside contracts root`);
  const bytes = fs.readFileSync(file);
  const a = JSON.parse(bytes);
  const m = typeof a.rawMetadata === 'string' ? JSON.parse(a.rawMetadata) : a.metadata;
  if (m?.settings?.compilationTarget?.[target] !== contract || !m.compiler?.version?.startsWith('0.8.38+')
    || m.settings.optimizer?.enabled !== true || m.settings.optimizer.runs !== 800
    || m.settings.evmVersion !== 'cancun' || Boolean(m.settings.viaIR) !== viaIR
    || !m.sources?.[target]?.keccak256 || !Array.isArray(a.abi) || abiIdentity(a.abi) !== abiIdentity(m.output.abi))
    throw Error(`${contract}: compiler/ABI metadata mismatch`);
  const sources = {};
  for (const [source, info] of Object.entries(m.sources)) {
    const p = path.resolve(root, source);
    if (!within(root, p) || !within(root, fs.realpathSync(p))) throw Error(`${contract}: source outside contracts root`);
    const b = fs.readFileSync(p);
    if (![keccak256(toHex(b)), keccak256(toHex(b.toString('utf8').replace(/\r\n/g, '\n')))].includes(info.keccak256))
      throw Error(`${contract}: stale artifact for ${source}`);
    sources[source] = { sha256: sha(b), compilerInputKeccak256: info.keccak256 };
  }
  for (const field of ['bytecode', 'deployedBytecode']) {
    if (!/^0x(?:[\da-fA-F]{2})+$/.test(a[field]?.object || '') || Object.keys(a[field].linkReferences || {}).length)
      throw Error(`${contract}: absent bytecode or unresolved library links`);
  }
  if ((a.deployedBytecode.object.length - 2) / 2 > 24576) throw Error(`${contract}: EIP-170 runtime size limit`);
  return { abi: a.abi, bytecode: a.bytecode.object, evidence: { contract, artifactSha256: sha(bytes),
    compiler: m.compiler.version, settings: m.settings, sources,
    creationBytecodeKeccak256: keccak256(a.bytecode.object), runtimeTemplateKeccak256: keccak256(a.deployedBytecode.object),
    immutableReferences: a.deployedBytecode.immutableReferences || {} } };
}

export function predictPlayerGenesisAddresses(deployer, startingNonce) {
  const from = addr('deployer', deployer), nonce = uint('startingNonce', startingNonce, 64, true);
  if (nonce + BigInt(PLAYER_GENESIS_ROLES.length) >= 1n << 64n) throw Error('Deployment nonce overflow');
  return Object.fromEntries(PLAYER_GENESIS_ROLES.filter(([role]) => role !== 'hook').map(([role]) => {
    const index = PLAYER_GENESIS_ROLES.findIndex(([r]) => r === role);
    return [role, getContractAddress({ from, nonce: nonce + BigInt(index) })];
  }));
}

export function buildPlayerGenesisDeploymentPlan(input, { contractsRoot = ROOT, artifactLoader = loadPlayerGenesisArtifact } = {}) {
  const m = clone(obj('manifest', input)); publicOnly(m);
  keys('manifest', m, ['schemaVersion', 'route', 'chainId', 'localRehearsal', 'sourceRevision', 'startingNonce', 'snapshot', 'roles',
    'external', 'positionManager', 'create2', 'artifactHashes', 'runtimeHashes', 'restrictedMarket', 'policies', 'season',
    'auction', 'coordinator', 'governance']);
  if (m.schemaVersion !== 2 || m.route !== 'guarded-public-auction' || ![4663, 31337].includes(m.chainId) || typeof m.localRehearsal !== 'boolean'
    || (m.chainId === 31337 && !m.localRehearsal)) throw Error('Explicit public-only guarded route schema v2, chain 4663 or local rehearsal 31337 required');
  if (!/^[\da-f]{40}$/i.test(m.sourceRevision || '')) throw Error('sourceRevision: full commit required');
  keys('roles', m.roles, ['safe', 'deployer', 'safeExecutor', 'adjudicator', 'dev', 'rwa', 'community']);
  const roles = Object.fromEntries(Object.entries(m.roles).map(([k, v]) => [k, addr(`roles.${k}`, v)]));
  if (Object.entries(roles).some(([key, value]) => key !== 'deployer' && value === roles.deployer))
    throw Error('Deployer must be separate from every setup, recipient, and Safe caller');
  keys('governance', m.governance, ['runtimeHash', 'owners', 'threshold', 'singleton', 'singletonRuntimeHash', 'fallbackHandler', 'fallbackHandlerRuntimeHash']);
  hash('governance.runtimeHash', m.governance.runtimeHash);
  for (const role of ['singleton', 'fallbackHandler']) {
    addr(`governance.${role}`, m.governance[role]); hash(`governance.${role}RuntimeHash`, m.governance[`${role}RuntimeHash`]);
  }
  if (!Array.isArray(m.governance.owners) || !m.governance.owners.length || m.governance.owners.length > 64
    || !Number.isInteger(m.governance.threshold) || m.governance.threshold < 1 || m.governance.threshold > m.governance.owners.length)
    throw Error('Explicit bounded Safe owners and valid threshold required');
  const safeOwners = m.governance.owners.map(x => addr('Safe owner', x));
  if (new Set(safeOwners).size !== safeOwners.length) throw Error('Duplicate Safe owner');
  if (m.chainId === 4663 && (safeOwners.length !== 3 || m.governance.threshold !== 2)) throw Error('Mainnet governance requires approved 2-of-3 Safe');
  const addresses = predictPlayerGenesisAddresses(roles.deployer, m.startingNonce);
  keys('snapshot', m.snapshot, ['timestamp', 'blockNumber', 'blockHash', 'auctionClock', 'maxAgeSeconds']);
  uint('snapshot.timestamp', m.snapshot.timestamp, 64);
  const clock = uint('snapshot.auctionClock', m.snapshot.auctionClock, 64, true);
  uint('snapshot.blockNumber', m.snapshot.blockNumber, 64, true); hash('snapshot.blockHash', m.snapshot.blockHash);
  uint('snapshot.maxAgeSeconds', m.snapshot.maxAgeSeconds, 64);
  keys('external', m.external, ['permit2', 'weth', 'descriptor', 'wbtc', 'rewardManager']);
  const external = Object.fromEntries(Object.entries(m.external).map(([key, x]) => {
    keys(`external.${key}`, x, ['address', 'runtimeHash']);
    return [key, { address: addr(`external.${key}.address`, x.address), runtimeHash: hash(`external.${key}.runtimeHash`, x.runtimeHash) }];
  }));
  keys('positionManager', m.positionManager, ['unsubscribeGasLimit']);
  const unsubscribeGas = uint('positionManager.unsubscribeGasLimit', m.positionManager.unsubscribeGasLimit, 256);
  keys('runtimeHashes', m.runtimeHashes, PLAYER_GENESIS_ROLES.map(([role]) => role));
  for (const [role] of PLAYER_GENESIS_ROLES) hash(`runtimeHashes.${role}`, m.runtimeHashes[role]);
  const contracts = [...new Set(PLAYER_GENESIS_ROLES.map(([, contract]) => contract))];
  keys('artifactHashes', m.artifactHashes, contracts);
  const artifacts = Object.fromEntries(contracts.map(contract => {
    const artifact = artifactLoader(contract, { contractsRoot });
    if (!/^[\da-f]{64}$/i.test(m.artifactHashes[contract] || '')) throw Error(`artifactHashes.${contract}: explicit SHA256 required`);
    exact(`artifactHashes.${contract}`, m.artifactHashes[contract], artifact.evidence.artifactSha256);
    return [contract, artifact];
  }));
  for (const [role, contract] of PLAYER_GENESIS_ROLES) {
    const evidence = artifacts[contract].evidence;
    if (Object.keys(evidence.immutableReferences || {}).length
      && m.runtimeHashes[role].toLowerCase() === evidence.runtimeTemplateKeccak256)
      throw Error(`runtimeHashes.${role}: immutable template is not constructor-specific runtime`);
  }
  keys('restrictedMarket', m.restrictedMarket, ['additionalOperators', 'contractHolders']);
  if (!Array.isArray(m.restrictedMarket.additionalOperators) || !Array.isArray(m.restrictedMarket.contractHolders))
    throw Error('Explicit restricted operator/holder lists required');
  const launchOperators = ['coordinator', 'auction'].map(role => ({ address: addresses[role], role: 2,
    runtimeHash: m.runtimeHashes[role], purpose: `Reviewed guarded Genesis ${role} custody and exact typed inventory pull` }));
  const duplicateLaunch = m.restrictedMarket.additionalOperators.some(x => launchOperators.some(y => x.address?.toLowerCase() === y.address.toLowerCase()));
  if (duplicateLaunch) throw Error('Launch custody operators are managed by the guarded planner');
  if (m.restrictedMarket.additionalOperators.some(x => [roles.safe, roles.deployer].some(a => x.address?.toLowerCase() === a.toLowerCase())))
    throw Error('Safe/deployer may not be arbitrary custody operators');
  const marketInput = { schemaVersion: 2, chainId: m.chainId, localRehearsal: m.localRehearsal,
    sourceRevision: m.sourceRevision, startingNonce: String(BigInt(m.startingNonce) + 4n),
    snapshot: { timestamp: m.snapshot.timestamp, blockNumber: m.snapshot.blockNumber, blockHash: m.snapshot.blockHash },
    roles: { ...roles, initializer: addresses.coordinator, capitalProvider: roles.safe },
    external: { omr: { address: addresses.omr, runtimeHash: m.runtimeHashes.omr },
      poolManager: { address: addresses.poolManager, runtimeHash: m.runtimeHashes.poolManager },
      positionManager: { address: addresses.positionManager, runtimeHash: m.runtimeHashes.positionManager }, permit2: external.permit2,
      wbtc: external.wbtc, rewardManager: external.rewardManager },
    restrictedMarket: { policyId: RESTRICTED_MARKET_POLICY_ID,
      operatorRuntimeHashes: Object.fromEntries(['hook', 'controller', 'bond', 'turf', 'arbitrage', 'router', 'positionManager', 'permit2']
        .map(k => [k, k === 'permit2' ? external.permit2.runtimeHash : m.runtimeHashes[k]])),
      holderRuntimeHashes: Object.fromEntries(['polFunding', 'reserveFunding', 'turfFeeBridge', 'btcRewards'].map(k => [k, m.runtimeHashes[k]])),
      additionalOperators: [...launchOperators, ...m.restrictedMarket.additionalOperators], contractHolders: m.restrictedMarket.contractHolders },
    create2: m.create2, artifactHashes: Object.fromEntries(MARKET_V2_ROLES.map(([, c]) => [c, m.artifactHashes[c]])),
    rewards: { converterRuntimeHash: m.runtimeHashes.btcConverter },
    policies: m.policies, season: m.season, bootstrap: null, funding: null };
  const market = buildMarketV2DeploymentPlan(marketInput, { contractsRoot, artifactLoader, deferBootstrap: true });
  Object.assign(addresses, market.addresses);
  keys('auction', m.auction, ['inventory', 'unsoldRecipient', 'startBlock', 'endBlock', 'claimBlock', 'tickSpacing',
    'floorPrice', 'requiredCurrencyRaised', 'steps', ...(m.chainId === 4663 || 'cadence' in m.auction ? ['cadence'] : [])]);
  const auction = m.auction;
  const publicInventory = uint('auction.inventory', auction.inventory, 128);
  const start = uint('auction.startBlock', auction.startBlock, 64), end = uint('auction.endBlock', auction.endBlock, 64);
  const claim = uint('auction.claimBlock', auction.claimBlock, 64);
  if (start <= clock || end <= start || claim < end) throw Error('Auction schedule must be future native auction-clock blocks with claim >= end');
  if (!Array.isArray(auction.steps) || !auction.steps.length || auction.steps.length > 1000) throw Error('Explicit bounded auction steps required');
  let blocks = 0n, issuance = 0n;
  const stepsData = concatHex(auction.steps.map((step, i) => {
    keys(`auction.steps[${i}]`, step, ['mps', 'blockDelta']);
    const mps = uint(`auction.steps[${i}].mps`, step.mps, 24, true), delta = uint(`auction.steps[${i}].blockDelta`, step.blockDelta, 40);
    blocks += delta; issuance += mps * delta;
    return concatHex([toHex(mps, { size: 3 }), toHex(delta, { size: 5 })]);
  }));
  if (blocks !== end - start || issuance !== 10_000_000n) throw Error('Auction steps must exactly span end-start and issue 10000000 MPS');
  const tick = uint('auction.tickSpacing', auction.tickSpacing), floor = uint('auction.floorPrice', auction.floorPrice);
  const requiredRaise = uint('auction.requiredCurrencyRaised', auction.requiredCurrencyRaised, 128);
  if (tick < 2n || floor < (1n << 32n) + 1n || floor % tick !== 0n)
    throw Error('Auction floor must meet the native CCA minimum and align to a tick spacing of at least two');
  const maximumBidPrice = publicInventory <= 1n << 62n ? (1n << 160n) - 1n
    : [((1n << 154n) / publicInventory) ** 2n, (1n << 222n) / publicInventory].reduce((a, b) => a < b ? a : b);
  if (floor + tick > maximumBidPrice) throw Error('Auction floor plus price tick exceeds native CCA maximum bid price');
  const cadence = productionCadence(m, start, end, claim, publicInventory, requiredRaise);
  const minimumReserve = minimumGenesisTokenReserve({ supply: publicInventory, floorPrice: floor,
    maximumBidPrice, spacing: m.policies.pool.tickSpacing, minimumRaise: requiredRaise });
  keys('coordinator', m.coordinator, ['tokenReserve', 'liquidityOwner', 'treasury', 'vig', 'founder']);
  const reserve = uint('coordinator.tokenReserve', m.coordinator.tokenReserve, 127);
  if (reserve < minimumReserve) throw Error(`coordinator.tokenReserve must be at least ${minimumReserve} for all accepted auction prices`);
  if (publicInventory + reserve > RESTRICTED_MARKET_SUPPLY) throw Error('Genesis inventories exceed the fixed 100000000 OMR supply');
  const finalRegistry = market.steps.find(x => x.label === 'Verify the exact complete operator and contract-holder registries immediately before sealing')?.required;
  if (!finalRegistry) throw Error('Complete restricted registry evidence required');
  const approved = new Set([roles.safe, ...finalRegistry.registeredWallets.map(x => x.address),
    ...finalRegistry.operators.map(x => x.operatorAt), ...finalRegistry.contractHolders.map(x => x.contractHolderAt)]
    .map(x => x.toLowerCase()));
  for (const [label, value] of Object.entries({ publicUnsold: auction.unsoldRecipient, ...m.coordinator })) {
    if (label === 'tokenReserve') continue;
    const a = addr(label, value);
    // The immutable launch must never depend on an unenrolled receiving address.
    if (['publicUnsold', 'liquidityOwner', 'treasury'].includes(label) && !approved.has(a.toLowerCase()))
      throw Error(`${label}: require genesis Safe or explicitly reviewed/registered holder`);
  }
  const parameters = { currency: zeroAddress, tokensRecipient: addr('auction.unsoldRecipient', auction.unsoldRecipient),
    fundsRecipient: addresses.coordinator, startBlock: start, endBlock: end, claimBlock: claim, tickSpacing: tick,
    validationHook: zeroAddress, floorPrice: floor, requiredCurrencyRaised: requiredRaise, auctionStepsData: stepsData };
  const args = {
    omr: [roles.safe], poolManager: [addresses.omr, roles.safe,
      [roles.dev, roles.rwa, roles.community, addresses.polFunding], addresses.btcRewards],
    positionManager: [addresses.poolManager, external.permit2.address, unsubscribeGas, external.descriptor.address, external.weth.address],
    coordinator: [addresses.poolManager, addresses.positionManager, external.permit2.address, addresses.omr, addresses.hook,
      m.policies.pool.fee, m.policies.pool.tickSpacing, reserve, addr('liquidityOwner', m.coordinator.liquidityOwner),
      addr('treasury', m.coordinator.treasury), addr('vig', m.coordinator.vig), addr('founder', m.coordinator.founder)],
    auction: [addresses.omr, publicInventory, parameters, addresses.coordinator],
  };
  const deployment = role => {
    const contract = PLAYER_GENESIS_ROLES.find(([r]) => r === role)[1], a = artifacts[contract];
    const data = encodeDeployData({ abi: a.abi, bytecode: a.bytecode, args: args[role] });
    if ((data.length - 2) / 2 > 49152) throw Error(`${role}: EIP-3860 initcode size limit`);
    return { kind: 'deployment', role, contract, method: 'CREATE', expectedAddress: addresses[role], constructorArgs: args[role],
      initCodeHash: keccak256(data), transaction: { chainId: m.chainId, from: roles.deployer,
        nonce: String(BigInt(m.startingNonce) + BigInt(PLAYER_GENESIS_ROLES.findIndex(([r]) => r === role))), value: '0', data } };
  };
  const call = (label, role, functionName, values, from) => ({ kind: 'call', label, role, functionName, args: values,
    transaction: { chainId: m.chainId, from, to: addresses[role], value: '0',
      data: encodeFunctionData({ abi: artifacts[PLAYER_GENESIS_ROLES.find(([r]) => r === role)[1]].abi, functionName, args: values }) } });
  const boundary = market.steps.findIndex(x => x.label === 'Verify replacement market contracts and actual operator runtime before irrevocable policy sealing');
  if (boundary < 0 || !market.bootstrapDeferred) throw Error('Market planner guarded-route boundary unavailable');
  if (market.steps[0]?.kind !== 'readiness'
    || market.steps[0]?.label !== 'Verify pinned WBTC asset and reward conversion route before deployments')
    throw Error('Market planner predeployment reward-route boundary unavailable');
  const funding = [];
  for (const [role, amount] of [['coordinator', reserve], ['auction', publicInventory]]) {
    funding.push(call(`Approve exact ${role} inventory`, 'omr', 'approve', [addresses[role], amount], roles.safe));
    funding.push(call(`Pull exact ${role} inventory after policy sealing`, role, 'fundInventory', [], roles.safe));
    funding.push(call(`Revoke ${role} inventory approval`, 'omr', 'approve', [addresses[role], 0n], roles.safe));
  }
  const steps = [
    market.steps[0], ...['omr', 'poolManager', 'positionManager', 'coordinator'].map(deployment), ...market.steps.slice(1, boundary),
    deployment('auction'),
    call('Bind the single guarded public auction before bids', 'coordinator', 'bindPublicAuction', [addresses.auction], roles.deployer),
    ...market.steps.slice(boundary), ...funding,
  ];
  return clone({ schemaVersion: 2, route: 'guarded-public-auction', mode: 'offline-unsigned', chainId: m.chainId,
    localRehearsal: m.localRehearsal, sourceRevision: m.sourceRevision, manifestSha256: sha(stringify(m)), snapshot: m.snapshot,
    roles, governance: m.governance, startingNonce: m.startingNonce,
    nextDeployerNonceAfterDeployments: String(BigInt(m.startingNonce) + BigInt(PLAYER_GENESIS_ROLES.length)),
    addresses, canonicalPool: market.canonicalPool, economics: market.economics,
    inventories: { public: publicInventory, liquidity: reserve, minimumLiquidity: minimumReserve,
      retainedBySafe: RESTRICTED_MARKET_SUPPLY - publicInventory - reserve },
    auctionParameters: parameters, auctionCadence: cadence, coordinator: m.coordinator,
    genesisLiquidityPolicy: { initialLpBps: GENESIS_INITIAL_LP_BPS, minimumCustodySeconds: GENESIS_LIQUIDITY_LOCK_SECONDS,
      custodyClock: 'seconds after successful migration', claimCliffAlsoRequired: true,
      lockedPositionOwner: addresses.coordinator, releasedPositionOwner: m.coordinator.liquidityOwner,
      feeRecipient: m.coordinator.liquidityOwner, feesCollectibleDuringCustody: true,
      residualSplitBps: { treasury: 4000, vig: 3600, founder: 2400 } },
    artifacts: Object.fromEntries(Object.entries(artifacts).map(([c, a]) => [c, { abi: a.abi, ...a.evidence }])),
    runtimeHashes: m.runtimeHashes, externalRuntimePins: external, create2Factory: m.create2,
    restrictedMarket: market.restrictedMarket, steps,
    executionConditions: [
      'Unsigned only. No transaction is simulated, signed or broadcast. A generated plan is not release approval.',
      'Every actual runtime hash must come from constructor-specific fork deployment, not the artifact runtime template.',
      'Before deployments, verify the exact pinned WBTC asset and hookless external ETH/WBTC pool; initialized liquidity is not executable-depth proof for the selected conversion budget.',
      `All ${PLAYER_GENESIS_ROLES.length} deployment transactions consume the exact EOA nonce sequence. Intervening deployer transactions invalidate auction and manager recipient addresses.`,
      'Coordinator bind is the first subsequent deployer transaction; interleaved setup uses separate configured callers.',
      'Guarded auction uses native auction clock (ArbSys when available), not assumed Robinhood L2 block cadence.',
      'Run production-stack fork rehearsal through public finality, direct migration, claim opening and failed-public recovery.',
      'Verify minimum/maximum final-price LP reserve sufficiency and accepted-proceeds limits in that rehearsal before public bids.',
      'Half of accepted ETH funds the initial LP budget; residual ETH retains the 40/36/24 Treasury/Vig/founder proportions, including bounded LP rounding dust.',
      'Keep the LP NFT and principal in the coordinator until both the claim cliff and 90 days after successful migration; collect only fees to the immutable liquidity owner.',
      'Public bidding has zero validation hook, no Merkle eligibility root, no wallet cap, and no reserved player tranche.',
      'Public auction inventory and liquidity reserve remain explicit. Removing the player tranche never reallocates its former inventory automatically.',
      'Auction start, complete sealed operator registry, exact inventories and native clock must pass prepared preflight immediately before accepting bids.',
      'Core funding, direct pool initialization, and legacy CCA/LBP factory calls are omitted. Coordinator creates the pool only after guarded settlement.',
    ] });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 2 && args[0] === '--predict-addresses') {
      const input = JSON.parse(fs.readFileSync(args[1], 'utf8')); publicOnly(input);
      keys('prediction', input, ['chainId', 'deployer', 'startingNonce']);
      if (![4663, 31337].includes(input.chainId)) throw Error('Prediction chain must be 4663 or local rehearsal 31337');
      process.stdout.write(`${stringify({ mode: 'prediction-only', chainId: input.chainId,
        addresses: predictPlayerGenesisAddresses(input.deployer, input.startingNonce),
        conditions: `CREATE prediction only; no artifact, runtime, hook or release verification. Reserve the exact ${PLAYER_GENESIS_ROLES.length}-transaction nonce sequence.` })}\n`);
    } else {
      if (args.length !== 1) throw Error('Usage: node tools/player-genesis-deployment-plan.js <manifest.json> | --predict-addresses <public-nonce.json>');
      process.stdout.write(`${stringify(buildPlayerGenesisDeploymentPlan(JSON.parse(fs.readFileSync(args[0], 'utf8'))))}\n`);
    }
  } catch (error) { process.stderr.write(`player-genesis-deployment-plan: ${error.message}\n`); process.exitCode = 1; }
}
