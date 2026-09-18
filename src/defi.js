// Public protocol projection and tightly bounded calldata builders.
//
// This module is deliberately read-heavy and authority-light. It reads the canonical, reviewed
// mainnet registry, pins every RPC read to one block, and can encode only a small set of explicitly
// named user or Safe calls. It never creates a wallet client, imports a private key, signs, or sends.
import { readFileSync } from 'node:fs';
import {
  createPublicClient, defineChain, encodeFunctionData, getAddress, http, isAddress,
  keccak256, parseAbi, parseUnits, zeroAddress,
} from 'viem';

const HASH = /^0x[0-9a-f]{64}$/i;
const UINT256_MAX = (1n << 256n) - 1n;
const MANIFEST_URL = new URL('../omerta-contracts/deployments/4663/manifest.json', import.meta.url);
const REQUIRED_CONTRACTS = [
  'OMR', 'GearVault', 'VoucherClaim', 'OMRStaking', 'OmertaFees', 'StreetDeed',
  'DynastyNFT', 'StockVault', 'GenesisOracle', 'OmertaBond', 'OmertaHook',
  'OmrV4TwapOracle', 'GenesisProceedsSplitter', 'ProtocolLiquidityVault',
  'VigBuyback', 'DeskBuyback', 'CommunityBuyback', 'PolBuyback', 'FeeRevenueRouter',
  'KeeperGasVault', 'GenesisLifecycleController',
];

const ENV_ADDRESS = Object.freeze({
  OMR: 'OMR_ADDRESS',
  GearVault: 'GEAR_VAULT_ADDRESS',
  VoucherClaim: 'VOUCHER_CLAIM_ADDRESS',
  OMRStaking: 'OMR_STAKING_ADDRESS',
  OmertaFees: 'OMERTA_FEES_ADDRESS',
  StreetDeed: 'STREET_DEED_ADDRESS',
  DynastyNFT: 'DYNASTY_NFT_ADDRESS',
  StockVault: 'STOCK_VAULT_ADDRESS',
  GenesisOracle: 'GENESIS_ORACLE_ADDRESS',
  OmertaBond: 'OMERTA_BOND_ADDRESS',
  OmertaHook: 'OMERTA_HOOK_ADDRESS',
  OmrV4TwapOracle: 'OMR_V4_ORACLE_ADDRESS',
  GenesisProceedsSplitter: 'GENESIS_PROCEEDS_SPLITTER_ADDRESS',
  ProtocolLiquidityVault: 'PROTOCOL_LIQUIDITY_VAULT_ADDRESS',
  VigBuyback: 'VIG_BUYBACK_ADDRESS',
  DeskBuyback: 'DESK_BUYBACK_ADDRESS',
  CommunityBuyback: 'COMMUNITY_BUYBACK_ADDRESS',
  PolBuyback: 'POL_BUYBACK_ADDRESS',
  FeeRevenueRouter: 'FEE_REVENUE_ROUTER_ADDRESS',
  KeeperGasVault: 'KEEPER_GAS_VAULT_ADDRESS',
  GenesisLifecycleController: 'GENESIS_LIFECYCLE_CONTROLLER_ADDRESS',
});

const lower = (value) => String(value || '').toLowerCase();
const errorOf = (code, detail) => Object.assign(new Error(code), { code, detail });
const safeError = (error) => String(error?.shortMessage || error?.message || error || 'read failed').slice(0, 180);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function validateMainnetDeployment(raw) {
  const manifest = clone(raw);
  if (manifest?.schemaVersion !== 1 || manifest?.network?.chainId !== 4663)
    throw errorOf('invalid_mainnet_manifest', 'chain');
  if (!/^https:\/\//.test(manifest.network.rpc || '') || !/^https:\/\//.test(manifest.network.explorer || ''))
    throw errorOf('invalid_mainnet_manifest', 'network');
  if (!isAddress(manifest.governance?.safe, { strict: true }) || manifest.governance?.threshold !== 2
    || manifest.governance?.ownerCount !== 3) throw errorOf('invalid_mainnet_manifest', 'governance');
  if (!HASH.test(manifest.pool?.id || '') || manifest.pool?.publicSwapRouter !== null)
    throw errorOf('invalid_mainnet_manifest', 'pool');
  const seen = new Set();
  for (const name of REQUIRED_CONTRACTS) {
    const target = manifest.contracts?.[name];
    if (!target || !isAddress(target.address, { strict: true }) || !HASH.test(target.runtimeHash || '')
      || !HASH.test(target.transactionHash || '') || !/^\d+$/.test(target.deploymentBlock || '')
      || BigInt(target.deploymentBlock) > BigInt(manifest.verification?.snapshotBlock || 0)
      || !target.category || !target.purpose)
      throw errorOf('invalid_mainnet_manifest', `contract:${name}`);
    const address = lower(getAddress(target.address));
    if (seen.has(address)) throw errorOf('invalid_mainnet_manifest', `duplicate:${name}`);
    seen.add(address);
  }
  if (Object.keys(manifest.contracts).length !== REQUIRED_CONTRACTS.length)
    throw errorOf('invalid_mainnet_manifest', 'contract_count');
  if (manifest.verification?.failures !== 0 || manifest.verification?.checks < 200
    || manifest.verification?.runtimeTemplateMatches !== true)
    throw errorOf('invalid_mainnet_manifest', 'verification');
  return deepFreeze(manifest);
}

export const MAINNET_DEPLOYMENT = validateMainnetDeployment(JSON.parse(readFileSync(MANIFEST_URL, 'utf8')));

export function protocolAddress(name, env = process.env) {
  const canonical = Object.hasOwn(MAINNET_DEPLOYMENT.contracts, name) ? MAINNET_DEPLOYMENT.contracts[name]?.address : null;
  if (!canonical) throw errorOf('unknown_protocol_contract', name);
  const envName = ENV_ADDRESS[name];
  const configured = envName && env[envName];
  if (configured) {
    if (!isAddress(configured, { strict: true })) throw errorOf('invalid_protocol_address', envName);
    if (lower(getAddress(configured)) !== lower(getAddress(canonical)))
      throw errorOf('protocol_address_mismatch', envName);
  }
  return getAddress(canonical);
}

export function protocolAddressForEnv(envName, env = process.env) {
  const name = Object.entries(ENV_ADDRESS).find(([, value]) => value === envName)?.[0];
  if (!name) return env[envName] || null;
  return protocolAddress(name, env);
}

export function defiRpcUrl(env = process.env) {
  if (env.CHAIN_ID && String(env.CHAIN_ID) !== String(MAINNET_DEPLOYMENT.network.chainId))
    throw errorOf('protocol_chain_mismatch', 'CHAIN_ID');
  const raw = String(env.DEFI_RPC_URL || env.CHAIN_RPC_URL || MAINNET_DEPLOYMENT.network.rpc).trim();
  let url;
  try { url = new URL(raw); } catch { throw errorOf('invalid_defi_rpc', 'url'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && local && url.protocol === 'http:'))
    throw errorOf('invalid_defi_rpc', 'transport');
  return url.href;
}

export function makeDefiClient(env = process.env) {
  const rpc = defiRpcUrl(env);
  const chain = defineChain({
    id: MAINNET_DEPLOYMENT.network.chainId,
    name: MAINNET_DEPLOYMENT.network.name,
    nativeCurrency: MAINNET_DEPLOYMENT.network.nativeCurrency,
    rpcUrls: { default: { http: [rpc] } },
    blockExplorers: { default: { name: 'Blockscout', url: MAINNET_DEPLOYMENT.network.explorer } },
  });
  return createPublicClient({ chain, transport: http(rpc, { timeout: 12_000, retryCount: 1 }) });
}

const ABI_CACHE = new Map();
const abiFor = (signature) => {
  if (!ABI_CACHE.has(signature)) ABI_CACHE.set(signature, parseAbi([`function ${signature}`]));
  return ABI_CACHE.get(signature);
};
const functionName = (signature) => signature.slice(0, signature.indexOf('('));
const normalize = (value) => {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).filter(([key]) => !/^\d+$/.test(key)).map(([key, child]) => [key, normalize(child)]));
  return value;
};
const setPath = (target, path, value) => {
  const parts = path.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) cursor = cursor[part] ||= {};
  cursor[parts.at(-1)] = value;
};
const bigintOrNull = (value) => value == null || !/^[0-9]+$/.test(String(value)) ? null : BigInt(value);
const subtractStrings = (...values) => {
  const parsed = values.map(bigintOrNull);
  return parsed.some((v) => v == null) ? null : parsed.slice(1).reduce((total, value) => total - value, parsed[0]).toString();
};
const matches = (actual, expected) => actual != null && lower(actual) === lower(expected);

const READS = Object.freeze([
  ['token.totalSupply', 'OMR', 'totalSupply() view returns (uint256)'],
  ['token.minter', 'OMR', 'minter() view returns (address)'],
  ['token.sellTaxBps', 'OMR', 'sellTaxBps() view returns (uint256)'],
  ['token.treasuryBalance', 'OMR', 'balanceOf(address) view returns (uint256)', 'governanceSafe'],
  ['token.claimReserve', 'OMR', 'balanceOf(address) view returns (uint256)', 'VoucherClaim'],
  ['token.polInventory', 'OMR', 'balanceOf(address) view returns (uint256)', 'ProtocolLiquidityVault'],
  ['staking.omr', 'OMRStaking', 'omr() view returns (address)'],
  ['staking.apyBps', 'OMRStaking', 'apyBps() view returns (uint256)'],
  ['staking.totalStaked', 'OMRStaking', 'totalStaked() view returns (uint256)'],
  ['staking.rewardPool', 'OMRStaking', 'rewardPool() view returns (uint256)'],
  ['staking.rewardIndex', 'OMRStaking', 'rewardIndex() view returns (uint256)'],
  ['staking.lastRewardUpdate', 'OMRStaking', 'lastRewardUpdate() view returns (uint64)'],
  ['staking.contractBalance', 'OMR', 'balanceOf(address) view returns (uint256)', 'OMRStaking'],
  ['bonds.omr', 'OmertaBond', 'omr() view returns (address)'],
  ['bonds.paused', 'OmertaBond', 'paused() view returns (bool)'],
  ['bonds.liquidityHealthy', 'OmertaBond', 'liquidityHealthy() view returns (bool)'],
  ['bonds.dailyCapOMR', 'OmertaBond', 'dailyCapOMR() view returns (uint256)'],
  ['bonds.committedOMR', 'OmertaBond', 'committedOMR() view returns (uint256)'],
  ['bonds.maxOmrPerEth', 'OmertaBond', 'maxOmrPerEth() view returns (uint256)'],
  ['bonds.maxOracleAge', 'OmertaBond', 'maxOracleAge() view returns (uint256)'],
  ['bonds.priceToleranceBps', 'OmertaBond', 'priceToleranceBps() view returns (uint256)'],
  ['bonds.nextBondId', 'OmertaBond', 'nextBondId() view returns (uint256)'],
  ['bonds.oracle', 'OmertaBond', 'oracle() view returns (address)'],
  ['bonds.liquidityHealthGuard', 'OmertaBond', 'liquidityHealthGuard() view returns (address)'],
  // Reverts by design until the oracle has a non-zero, fresh observation. That is a blocked market,
  // not an RPC failure, so it must not turn the otherwise coherent snapshot into `partial`.
  ['bonds.priceCeiling', 'OmertaBond', 'priceCeiling() view returns (uint256,uint256)', null, true],
  ['oracle.consult', 'OmrV4TwapOracle', 'consult() view returns (uint256,uint256)'],
  ['oracle.baselineInitialized', 'OmrV4TwapOracle', 'baselineInitialized() view returns (bool)'],
  ['oracle.period', 'OmrV4TwapOracle', 'PERIOD() view returns (uint32)'],
  ['oracle.source', 'OmrV4TwapOracle', 'source() view returns (address)'],
  ['oracle.poolManager', 'OmrV4TwapOracle', 'poolManager() view returns (address)'],
  ['oracle.omr', 'OmrV4TwapOracle', 'omr() view returns (address)'],
  ['oracle.poolId', 'OmrV4TwapOracle', 'poolId() view returns (bytes32)'],
  ['liquidity.healthy', 'ProtocolLiquidityVault', 'healthy() view returns (bool)'],
  ['liquidity.paused', 'ProtocolLiquidityVault', 'paused() view returns (bool)'],
  ['liquidity.emergencyLatched', 'ProtocolLiquidityVault', 'emergencyLatched() view returns (bool)'],
  ['liquidity.currentLiquidity', 'ProtocolLiquidityVault', 'currentLiquidity() view returns (uint128)'],
  ['liquidity.positionId', 'ProtocolLiquidityVault', 'positionId() view returns (uint256)'],
  ['liquidity.activationTimestamp', 'ProtocolLiquidityVault', 'activationTimestamp() view returns (uint256)'],
  ['liquidity.pendingFees', 'ProtocolLiquidityVault', 'pendingFees() view returns (uint256,uint256)'],
  ['liquidity.budgetAvailable', 'ProtocolLiquidityVault', 'budgetAvailable() view returns (uint256,uint256)'],
  ['liquidity.totalCollectedNative', 'ProtocolLiquidityVault', 'totalCollectedNative() view returns (uint256)'],
  ['liquidity.totalCollectedOmr', 'ProtocolLiquidityVault', 'totalCollectedOmr() view returns (uint256)'],
  ['liquidity.totalNativeAdded', 'ProtocolLiquidityVault', 'totalNativeAdded() view returns (uint256)'],
  ['liquidity.totalOmrAdded', 'ProtocolLiquidityVault', 'totalOmrAdded() view returns (uint256)'],
  ['liquidity.keeper', 'ProtocolLiquidityVault', 'keeper() view returns (address)'],
  ['liquidity.omr', 'ProtocolLiquidityVault', 'omr() view returns (address)'],
  ['liquidity.oracle', 'ProtocolLiquidityVault', 'oracle() view returns (address)'],
  ['liquidity.poolId', 'ProtocolLiquidityVault', 'poolId() view returns (bytes32)'],
  ['liquidity.genesisController', 'ProtocolLiquidityVault', 'genesisController() view returns (address)'],
  ['liquidity.inventoryExecutor', 'ProtocolLiquidityVault', 'inventoryExecutor() view returns (address)'],
  ['genesis.phase', 'GenesisLifecycleController', 'phase() view returns (uint8)'],
  ['genesis.auction', 'GenesisLifecycleController', 'auction() view returns (address)'],
  ['genesis.failed', 'GenesisLifecycleController', 'failed() view returns (bool)'],
  ['genesis.stopped', 'GenesisLifecycleController', 'stopped() view returns (bool)'],
  ['genesis.migrationBlock', 'GenesisLifecycleController', 'migrationBlock() view returns (uint256)'],
  ['genesis.currentBlock', 'GenesisLifecycleController', 'currentBlock() view returns (uint256)'],
  ['genesis.foundation', 'GenesisLifecycleController', 'foundation() view returns (address)'],
  ['genesis.splitter', 'GenesisLifecycleController', 'splitter() view returns (address)'],
  ['genesis.oracle', 'GenesisLifecycleController', 'oracle() view returns (address)'],
  ['genesis.omr', 'GenesisLifecycleController', 'omr() view returns (address)'],
  ['genesis.poolId', 'GenesisLifecycleController', 'poolId() view returns (bytes32)'],
  ['genesis.poolInitialized', 'GenesisProceedsSplitter', 'canonicalPoolInitialized() view returns (bool)'],
  ['fees.mintFee', 'OmertaFees', 'mintFee() view returns (uint256)'],
  ['fees.respawnFee', 'OmertaFees', 'respawnFee() view returns (uint256)'],
  ['fees.rerollFee', 'OmertaFees', 'rerollFee() view returns (uint256)'],
  ['fees.vigBps', 'OmertaFees', 'vigBps() view returns (uint256)'],
  ['fees.nonce', 'OmertaFees', 'nonce() view returns (uint256)'],
  ['fees.nonMintRouter', 'OmertaFees', 'nonMintRouter() view returns (address)'],
  ['feeRouter.lastNonce', 'FeeRevenueRouter', 'lastNonce() view returns (uint256)'],
  ['feeRouter.devBps', 'FeeRevenueRouter', 'devBps() view returns (uint256)'],
  ['feeRouter.vigBps', 'FeeRevenueRouter', 'vigBps() view returns (uint256)'],
  ['feeRouter.treasuryBps', 'FeeRevenueRouter', 'treasuryBps() view returns (uint256)'],
  ['feeRouter.communityBps', 'FeeRevenueRouter', 'communityBps() view returns (uint256)'],
  ['gasVault.paused', 'KeeperGasVault', 'paused() view returns (bool)'],
  ['gasVault.totalRefilled', 'KeeperGasVault', 'totalRefilled() view returns (uint256)'],
  ['gasVault.refillAvailable', 'KeeperGasVault', 'refillAmount(address) view returns (uint256)', 'keeper'],
  ['gasVault.nextRefillAt', 'KeeperGasVault', 'nextRefillAt(address) view returns (uint256)', 'keeper'],
]);

const OWNED_CONTRACTS = Object.freeze([
  'OMR', 'GearVault', 'VoucherClaim', 'OMRStaking', 'OmertaFees', 'StreetDeed', 'DynastyNFT',
  'StockVault', 'GenesisOracle', 'OmertaBond', 'OmertaHook', 'ProtocolLiquidityVault',
  'VigBuyback', 'DeskBuyback', 'CommunityBuyback', 'PolBuyback', 'KeeperGasVault',
  'GenesisLifecycleController',
]);
const PHASES = ['unbound', 'auction', 'migration', 'failed', 'oracle-warmup', 'live'];

function readArg(ref) {
  if (ref === 'governanceSafe') return MAINNET_DEPLOYMENT.governance.safe;
  if (ref === 'keeper') return MAINNET_DEPLOYMENT.roles.keeper;
  return protocolAddress(ref);
}

export async function readDefiSnapshot({ account = null, client = null, env = process.env, now = Date.now() } = {}) {
  const publicClient = client || makeDefiClient(env);
  let wallet = null;
  if (account != null && account !== '') {
    if (!isAddress(account, { strict: true })) throw errorOf('invalid_account', 'account');
    wallet = getAddress(account);
  }
  const errors = [];
  const readError = (section, key, error) => {
    errors.push({ section, key, message: safeError(error) });
    return null;
  };
  let chainId, block;
  try {
    [chainId, block] = await Promise.all([publicClient.getChainId(), publicClient.getBlock({ blockTag: 'latest' })]);
  } catch (error) {
    throw errorOf('defi_rpc_unavailable', safeError(error));
  }
  if (Number(chainId) !== MAINNET_DEPLOYMENT.network.chainId) throw errorOf('protocol_chain_mismatch', String(chainId));
  if (block.number == null || !HASH.test(block.hash || '')) throw errorOf('invalid_chain_snapshot', 'head');
  const blockNumber = block.number;
  const read = async (path, contractName, signature, argRef = null, optional = false) => {
    try {
      return normalize(await publicClient.readContract({
        address: protocolAddress(contractName, env), abi: abiFor(signature),
        functionName: functionName(signature), args: argRef ? [getAddress(readArg(argRef))] : [], blockNumber,
      }));
    } catch (error) { return optional ? null : readError(path.split('.')[0], path, error); }
  };

  const state = {};
  await Promise.all(READS.map(async ([path, contractName, signature, argRef, optional]) =>
    setPath(state, path, await read(path, contractName, signature, argRef, optional))));

  const contractRows = await Promise.all(Object.entries(MAINNET_DEPLOYMENT.contracts).map(async ([key, item]) => {
    let codePresent = null, runtimeMatches = null, liveRuntimeHash = null;
    try {
      const code = await publicClient.getCode({ address: getAddress(item.address), blockNumber }) || '0x';
      codePresent = code !== '0x';
      if (codePresent) liveRuntimeHash = keccak256(code);
      runtimeMatches = codePresent && lower(liveRuntimeHash) === lower(item.runtimeHash);
    } catch (error) { readError('contracts', key, error); }
    let owner = null;
    if (OWNED_CONTRACTS.includes(key)) owner = await read(`contracts.${key}.owner`, key, 'owner() view returns (address)');
    return {
      key, name: item.contract || key, category: item.category, purpose: item.purpose,
      address: getAddress(item.address), explorerUrl: `${MAINNET_DEPLOYMENT.network.explorer}/address/${getAddress(item.address)}`,
      transactionHash: item.transactionHash,
      transactionUrl: `${MAINNET_DEPLOYMENT.network.explorer}/tx/${item.transactionHash}`,
      sourceVerified: false, codePresent, runtimeMatches, owner,
      governanceMatches: owner == null ? null : matches(owner, MAINNET_DEPLOYMENT.governance.safe),
    };
  }));

  const balance = async (path, address) => {
    try { return normalize(await publicClient.getBalance({ address: getAddress(address), blockNumber })); }
    catch (error) { return readError(path.split('.')[0], path, error); }
  };
  state.governance ||= {};
  [state.governance.nativeBalance, state.gasVault.balance, state.gasVault.keeperBalance] = await Promise.all([
    balance('governance.nativeBalance', MAINNET_DEPLOYMENT.governance.safe),
    balance('gasVault.balance', protocolAddress('KeeperGasVault', env)),
    balance('gasVault.keeperBalance', MAINNET_DEPLOYMENT.roles.keeper),
  ]);

  const safeRead = async (path, signature) => {
    try {
      return normalize(await publicClient.readContract({ address: getAddress(MAINNET_DEPLOYMENT.governance.safe),
        abi: abiFor(signature), functionName: functionName(signature), blockNumber }));
    } catch (error) { return readError('governance', path, error); }
  };
  [state.governance.owners, state.governance.threshold, state.governance.nonce] = await Promise.all([
    safeRead('governance.owners', 'getOwners() view returns (address[])'),
    safeRead('governance.threshold', 'getThreshold() view returns (uint256)'),
    safeRead('governance.nonce', 'nonce() view returns (uint256)'),
  ]);

  if (wallet) {
    state.account = { address: wallet };
    const accountRead = async (path, contractName, signature, args = []) => {
      try {
        return normalize(await publicClient.readContract({ address: protocolAddress(contractName, env),
          abi: abiFor(signature), functionName: functionName(signature), args, blockNumber }));
      } catch (error) { return readError('account', path, error); }
    };
    [state.account.nativeBalance, state.account.omrBalance, state.account.stakingAllowance,
      state.account.position, state.account.pendingRewards] = await Promise.all([
      balance('account.nativeBalance', wallet),
      accountRead('account.omrBalance', 'OMR', 'balanceOf(address) view returns (uint256)', [wallet]),
      accountRead('account.stakingAllowance', 'OMR', 'allowance(address,address) view returns (uint256)',
        [wallet, protocolAddress('OMRStaking', env)]),
      accountRead('account.position', 'OMRStaking',
        'positions(address) view returns (uint256 staked,uint256 accrued,uint64 lastAccrued)', [wallet]),
      accountRead('account.pendingRewards', 'OMRStaking', 'pendingRewards(address) view returns (uint256)', [wallet]),
    ]);
  }

  const blockTimestamp = Number(block.timestamp) * 1000;
  const oracleResult = state.oracle?.consult;
  if (Array.isArray(oracleResult)) {
    state.oracle.omrPerEth = oracleResult[0];
    state.oracle.updatedAt = oracleResult[1];
    const updatedAt = Number(oracleResult[1] || 0);
    state.oracle.ageSeconds = updatedAt ? Math.max(0, Number(block.timestamp) - updatedAt) : null;
    state.oracle.ready = BigInt(oracleResult[0] || 0) > 0n && updatedAt > 0;
  } else state.oracle.ready = false;
  if (Array.isArray(state.bonds?.priceCeiling)) {
    state.bonds.priceCeilingOmrPerEth = state.bonds.priceCeiling[0];
    state.bonds.priceCeilingUpdatedAt = state.bonds.priceCeiling[1];
  }
  if (Array.isArray(state.liquidity?.pendingFees)) {
    [state.liquidity.pendingNativeFees, state.liquidity.pendingOmrFees] = state.liquidity.pendingFees;
  }
  if (Array.isArray(state.liquidity?.budgetAvailable)) {
    [state.liquidity.nativeBudgetAvailable, state.liquidity.omrBudgetAvailable] = state.liquidity.budgetAvailable;
  }
  state.staking.backingSurplus = subtractStrings(state.staking.contractBalance,
    state.staking.totalStaked, state.staking.rewardPool);
  const phaseNumber = state.genesis?.phase == null ? null : Number(state.genesis.phase);
  state.genesis.phaseNumber = Number.isInteger(phaseNumber) ? phaseNumber : null;
  state.genesis.phaseName = PHASES[phaseNumber] || 'unavailable';

  const requiredBindings = [
    [state.staking?.omr, protocolAddress('OMR', env)],
    [state.bonds?.omr, protocolAddress('OMR', env)],
    [state.bonds?.oracle, protocolAddress('OmrV4TwapOracle', env)],
    [state.bonds?.liquidityHealthGuard, protocolAddress('ProtocolLiquidityVault', env)],
    [state.oracle?.omr, protocolAddress('OMR', env)],
    [state.oracle?.poolId, MAINNET_DEPLOYMENT.pool.id],
    [state.liquidity?.omr, protocolAddress('OMR', env)],
    [state.liquidity?.oracle, protocolAddress('OmrV4TwapOracle', env)],
    [state.liquidity?.poolId, MAINNET_DEPLOYMENT.pool.id],
    [state.liquidity?.genesisController, protocolAddress('GenesisLifecycleController', env)],
    [state.genesis?.foundation, protocolAddress('ProtocolLiquidityVault', env)],
    [state.genesis?.splitter, protocolAddress('GenesisProceedsSplitter', env)],
    [state.genesis?.oracle, protocolAddress('OmrV4TwapOracle', env)],
    [state.genesis?.omr, protocolAddress('OMR', env)],
    [state.genesis?.poolId, MAINNET_DEPLOYMENT.pool.id],
    [state.fees?.nonMintRouter, protocolAddress('FeeRevenueRouter', env)],
  ];
  const codeOk = contractRows.every((item) => item.codePresent === true && item.runtimeMatches === true);
  const ownersOk = contractRows.filter((item) => item.owner != null).every((item) => item.governanceMatches === true);
  const bindingsReadable = requiredBindings.every(([actual]) => actual != null);
  const bindingsOk = bindingsReadable && requiredBindings.every(([actual, expected]) => matches(actual, expected));
  const safeOwners = Array.isArray(state.governance.owners) ? state.governance.owners : [];
  const governanceOk = state.governance.threshold === '2' && safeOwners.length === 3;
  const marketReady = state.genesis.phaseName === 'live' && state.liquidity.healthy === true
    && state.oracle.ready === true && state.bonds.paused === false;
  const stakingDepositsReady = marketReady && bigintOrNull(state.staking.rewardPool) > 0n;
  const accountStake = Array.isArray(state.account?.position) ? bigintOrNull(state.account.position[0]) : null;
  const accountPending = bigintOrNull(state.account?.pendingRewards);
  const rewardPool = bigintOrNull(state.staking?.rewardPool);
  const actionItems = [
    { id: 'approve-staking', kind: 'wallet_transaction', label: 'Approve OMR for staking',
      enabled: stakingDepositsReady, blockedBy: stakingDepositsReady ? [] : ['deployment_dormant'],
      fields: [{ name: 'amountOmr', type: 'decimal', decimals: 18 }] },
    { id: 'stake', kind: 'wallet_transaction', label: 'Stake OMR',
      enabled: stakingDepositsReady, blockedBy: stakingDepositsReady ? [] : ['deployment_dormant'],
      fields: [{ name: 'amountOmr', type: 'decimal', decimals: 18 }] },
    { id: 'unstake', kind: 'wallet_transaction', label: 'Unstake OMR',
      enabled: accountStake != null && accountStake > 0n,
      blockedBy: accountStake == null ? ['wallet_not_connected'] : accountStake > 0n ? [] : ['nothing_staked'],
      fields: [{ name: 'amountOmr', type: 'decimal', decimals: 18 }] },
    { id: 'claim-staking-rewards', kind: 'wallet_transaction', label: 'Claim staking rewards',
      enabled: accountPending != null && rewardPool != null && accountPending > 0n && rewardPool >= accountPending,
      blockedBy: accountPending == null ? ['wallet_not_connected'] : accountPending === 0n ? ['nothing_claimable']
        : rewardPool != null && rewardPool < accountPending ? ['reward_pool_underfunded'] : [], fields: [] },
    { id: 'claim-bond', kind: 'wallet_transaction', label: 'Claim vested bond OMR',
      enabled: wallet != null, blockedBy: wallet ? [] : ['wallet_not_connected'],
      fields: [{ name: 'bondId', type: 'integer' }] },
  ];

  const readiness = {
    deployment: { ready: codeOk, label: 'Runtime code', detail: codeOk ? '21/21 canonical runtimes match' : 'One or more runtimes are missing or changed' },
    governance: { ready: governanceOk && ownersOk, label: 'Governance', detail: governanceOk && ownersOk ? '2-of-3 Safe controls every owned contract' : 'Safe or owner state needs review' },
    wiring: { ready: bindingsOk, label: 'Bindings', detail: bindingsOk ? 'Critical dependencies match the canonical registry' : bindingsReadable ? 'A critical dependency has drifted' : 'One or more bindings could not be read' },
    genesis: { ready: state.genesis.phaseName !== 'unbound' && state.genesis.phaseName !== 'failed', label: 'Genesis', detail: `Lifecycle phase: ${state.genesis.phaseName}` },
    market: { ready: marketReady, label: 'Live market', detail: marketReady ? 'Pool, oracle, liquidity guard, and bond desk are live' : 'Market activation is not complete' },
  };

  return {
    schemaVersion: 1,
    status: errors.length ? 'partial' : 'ok',
    network: {
      name: MAINNET_DEPLOYMENT.network.name,
      chainId: MAINNET_DEPLOYMENT.network.chainId,
      chainIdHex: `0x${MAINNET_DEPLOYMENT.network.chainId.toString(16)}`,
      nativeCurrency: MAINNET_DEPLOYMENT.network.nativeCurrency,
      explorer: MAINNET_DEPLOYMENT.network.explorer,
      publicRpc: MAINNET_DEPLOYMENT.network.rpc,
    },
    snapshot: {
      blockNumber: block.number.toString(), blockHash: block.hash,
      blockTimestamp: new Date(blockTimestamp).toISOString(), readAt: new Date(now).toISOString(),
      ageSeconds: Math.max(0, Math.floor((now - blockTimestamp) / 1000)),
    },
    acceptance: {
      status: MAINNET_DEPLOYMENT.status,
      checkedAt: MAINNET_DEPLOYMENT.verification.checkedAt,
      snapshotBlock: MAINNET_DEPLOYMENT.verification.snapshotBlock,
      checks: MAINNET_DEPLOYMENT.verification.checks,
      failures: MAINNET_DEPLOYMENT.verification.failures,
      sourceCommit: MAINNET_DEPLOYMENT.source.commit,
      sourceVerifiedContracts: MAINNET_DEPLOYMENT.verification.explorerSourcesVerified,
      governanceTransaction: MAINNET_DEPLOYMENT.governance.configurationTransaction,
    },
    pool: {
      id: MAINNET_DEPLOYMENT.pool.id, fee: MAINNET_DEPLOYMENT.pool.fee,
      tickSpacing: MAINNET_DEPLOYMENT.pool.tickSpacing,
      hook: MAINNET_DEPLOYMENT.pool.hook,
      swapsAvailable: marketReady && !!MAINNET_DEPLOYMENT.pool.publicSwapRouter,
      swapsUnavailableReason: MAINNET_DEPLOYMENT.pool.publicSwapRouter ? null : 'A reviewed public swap router is not pinned.',
    },
    readiness, contracts: contractRows, metrics: state, errors,
    actions: {
      endpoint: '/v1/defi/tx',
      items: actionItems,
      staking: ['approve-staking', 'stake', 'unstake', 'claim-staking-rewards'],
      bonds: ['claim-bond'],
      swaps: [],
      note: 'The endpoint only prepares fixed, user-signed calldata. It cannot sign or send.',
    },
  };
}

export function unavailableDefiSnapshot(error, { now = Date.now() } = {}) {
  return {
    schemaVersion: 1, status: 'unavailable',
    network: {
      name: MAINNET_DEPLOYMENT.network.name, chainId: MAINNET_DEPLOYMENT.network.chainId,
      chainIdHex: `0x${MAINNET_DEPLOYMENT.network.chainId.toString(16)}`,
      nativeCurrency: MAINNET_DEPLOYMENT.network.nativeCurrency,
      explorer: MAINNET_DEPLOYMENT.network.explorer, publicRpc: MAINNET_DEPLOYMENT.network.rpc,
    },
    snapshot: { blockNumber: null, blockHash: null, blockTimestamp: null, readAt: new Date(now).toISOString(), ageSeconds: null },
    acceptance: {
      status: MAINNET_DEPLOYMENT.status, checkedAt: MAINNET_DEPLOYMENT.verification.checkedAt,
      snapshotBlock: MAINNET_DEPLOYMENT.verification.snapshotBlock,
      checks: MAINNET_DEPLOYMENT.verification.checks, failures: MAINNET_DEPLOYMENT.verification.failures,
      sourceCommit: MAINNET_DEPLOYMENT.source.commit,
      sourceVerifiedContracts: MAINNET_DEPLOYMENT.verification.explorerSourcesVerified,
      governanceTransaction: MAINNET_DEPLOYMENT.governance.configurationTransaction,
    },
    pool: { id: MAINNET_DEPLOYMENT.pool.id, fee: MAINNET_DEPLOYMENT.pool.fee,
      tickSpacing: MAINNET_DEPLOYMENT.pool.tickSpacing, hook: MAINNET_DEPLOYMENT.pool.hook,
      swapsAvailable: false, swapsUnavailableReason: 'Live state is unavailable.' },
    readiness: {},
    contracts: Object.entries(MAINNET_DEPLOYMENT.contracts).map(([key, item]) => ({
      key, name: item.contract || key, category: item.category, purpose: item.purpose,
      address: item.address, explorerUrl: `${MAINNET_DEPLOYMENT.network.explorer}/address/${item.address}`,
      transactionHash: item.transactionHash,
      transactionUrl: `${MAINNET_DEPLOYMENT.network.explorer}/tx/${item.transactionHash}`,
      sourceVerified: false, codePresent: null, runtimeMatches: null, owner: null, governanceMatches: null,
    })),
    metrics: {}, errors: [{ section: 'rpc', key: 'snapshot', message: safeError(error?.detail || error) }],
    actions: { endpoint: '/v1/defi/tx', staking: ['approve-staking', 'stake', 'unstake', 'claim-staking-rewards'],
      bonds: ['claim-bond'], swaps: [], items: [], note: 'Calldata preparation remains available; live state could not be read.' },
  };
}

const positiveUint = (value, name) => {
  if (!/^[1-9][0-9]*$/.test(String(value ?? ''))) throw errorOf('invalid_defi_input', name);
  const parsed = BigInt(value);
  if (parsed > UINT256_MAX) throw errorOf('invalid_defi_input', name);
  return parsed;
};
const omrAmount = (value) => {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,18})?$/.test(value.trim()))
    throw errorOf('invalid_defi_input', 'amountOmr');
  const amount = parseUnits(value.trim(), 18);
  if (amount <= 0n || amount > UINT256_MAX) throw errorOf('invalid_defi_input', 'amountOmr');
  return amount;
};

const USER_ACTIONS = Object.freeze({
  'approve-staking': { target: 'OMR', signature: 'approve(address spender,uint256 amount) returns (bool)', args: (body) => [protocolAddress('OMRStaking'), omrAmount(body.amountOmr)], label: 'Approve OMR for staking' },
  stake: { target: 'OMRStaking', signature: 'stake(uint256 amount)', args: (body) => [omrAmount(body.amountOmr)], label: 'Stake OMR' },
  unstake: { target: 'OMRStaking', signature: 'unstake(uint256 amount)', args: (body) => [omrAmount(body.amountOmr)], label: 'Unstake OMR' },
  'claim-staking-rewards': { target: 'OMRStaking', signature: 'claimRewards()', args: () => [], label: 'Claim staking rewards' },
  'claim-bond': { target: 'OmertaBond', signature: 'claim(uint256 bondId)', args: (body) => [positiveUint(body.bondId, 'bondId')], label: 'Claim vested bond OMR' },
});

export function buildDefiTransaction(body = {}, env = process.env) {
  const action = USER_ACTIONS[body.action];
  if (!action) throw errorOf('unknown_defi_action', 'action');
  const args = action.args(body);
  const to = protocolAddress(action.target, env);
  return {
    schemaVersion: 1, action: body.action, label: action.label,
    chainId: MAINNET_DEPLOYMENT.network.chainId, to,
    data: encodeFunctionData({ abi: abiFor(action.signature), functionName: functionName(action.signature), args }),
    value: '0x0',
    review: { contract: action.target, function: functionName(action.signature),
      arguments: normalize(args), explorerUrl: `${MAINNET_DEPLOYMENT.network.explorer}/address/${to}` },
    next: 'Review this fixed call in your wallet. The server has not signed or sent it.',
  };
}

const ADMIN_ACTIONS = Object.freeze({
  'bond.pause': { target: 'OmertaBond', signature: 'pause()', args: [], label: 'Pause new reserve bonds', risk: 'emergency' },
  'bond.unpause': { target: 'OmertaBond', signature: 'unpause()', args: [], label: 'Unpause reserve bonds', risk: 'activation' },
  'voucher.pause': { target: 'VoucherClaim', signature: 'pause()', args: [], label: 'Pause extraction claims', risk: 'emergency' },
  'voucher.unpause': { target: 'VoucherClaim', signature: 'unpause()', args: [], label: 'Unpause extraction claims', risk: 'activation' },
  'gear.pause': { target: 'GearVault', signature: 'pause()', args: [], label: 'Pause gear extraction', risk: 'emergency' },
  'gear.unpause': { target: 'GearVault', signature: 'unpause()', args: [], label: 'Unpause gear extraction', risk: 'activation' },
  'deed.pause': { target: 'StreetDeed', signature: 'pause()', args: [], label: 'Pause deed extraction', risk: 'emergency' },
  'deed.unpause': { target: 'StreetDeed', signature: 'unpause()', args: [], label: 'Unpause deed extraction', risk: 'activation' },
  'dynasty.pause': { target: 'DynastyNFT', signature: 'pause()', args: [], label: 'Pause dynasty claims', risk: 'emergency' },
  'dynasty.unpause': { target: 'DynastyNFT', signature: 'unpause()', args: [], label: 'Unpause dynasty claims', risk: 'activation' },
  'stock.pause': { target: 'StockVault', signature: 'pause()', args: [], label: 'Pause stock delivery', risk: 'emergency' },
  'stock.unpause': { target: 'StockVault', signature: 'unpause()', args: [], label: 'Unpause stock delivery', risk: 'activation' },
  'liquidity.pause': { target: 'ProtocolLiquidityVault', signature: 'pauseAutomation()', args: [], label: 'Pause liquidity automation', risk: 'emergency' },
  'liquidity.resume': { target: 'ProtocolLiquidityVault', signature: 'resumeAutomation()', args: [], label: 'Resume liquidity automation', risk: 'activation' },
  'genesis.stop': { target: 'GenesisLifecycleController', signature: 'setStopped(bool value)', args: [true], label: 'Stop Genesis progression', risk: 'emergency' },
  'genesis.resume': { target: 'GenesisLifecycleController', signature: 'setStopped(bool value)', args: [false], label: 'Resume Genesis progression', risk: 'activation' },
  'gas.pause': { target: 'KeeperGasVault', signature: 'pause()', args: [], label: 'Pause keeper gas refills', risk: 'emergency' },
  'gas.unpause': { target: 'KeeperGasVault', signature: 'unpause()', args: [], label: 'Unpause keeper gas refills', risk: 'activation' },
});

export function adminDefiActions() {
  return Object.entries(ADMIN_ACTIONS).map(([id, action]) => ({ id, label: action.label, target: action.target,
    to: protocolAddress(action.target), function: functionName(action.signature), risk: action.risk }));
}

export function buildAdminDefiTransaction(actionId, env = process.env) {
  const action = Object.hasOwn(ADMIN_ACTIONS, actionId) ? ADMIN_ACTIONS[actionId] : null;
  if (!action) throw errorOf('unknown_defi_admin_action', 'action');
  const to = protocolAddress(action.target, env);
  return {
    schemaVersion: 1, action: actionId, label: action.label, risk: action.risk,
    safe: getAddress(MAINNET_DEPLOYMENT.governance.safe), chainId: MAINNET_DEPLOYMENT.network.chainId,
    to, value: '0', operation: 0,
    data: encodeFunctionData({ abi: abiFor(action.signature), functionName: functionName(action.signature), args: action.args }),
    review: { contract: action.target, function: functionName(action.signature), arguments: normalize(action.args),
      targetExplorerUrl: `${MAINNET_DEPLOYMENT.network.explorer}/address/${to}` },
    next: 'Import this call into the governance Safe, simulate it, and collect the required 2-of-3 signatures. This dashboard cannot sign or execute it.',
  };
}

// Explicit structural marker for tests and reviewers: there is no swap call until a reviewed router
// address is pinned in the manifest. PoolManager calldata is never improvised in a browser.
export const PUBLIC_SWAPS_AVAILABLE = MAINNET_DEPLOYMENT.pool.publicSwapRouter !== null;
