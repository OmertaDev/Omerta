// Closed, deployment-pinned liquidity jobs. The manifest contains public policy only; keys
// stay in the process environment. Reading/planning never signs or broadcasts a transaction.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createPublicClient, createWalletClient, defineChain, encodeFunctionData, getAddress,
  http, fallback, isAddress, keccak256, parseAbi, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { keeperTransactionStatus, reconcileKeeperTransactions, runKeeperTransaction } from './keepertransactions.js';
import { discoverGenesisFoundation, readGenesisKeeperState } from './genesiskeeper.js';

const HASH = /^0x[0-9a-f]{64}$/i;
const UINT128 = (1n << 128n) - 1n;
const lower = (v) => String(v || '').toLowerCase();
const min = (...values) => values.reduce((a, b) => a < b ? a : b);
const sum = (values) => values.reduce((a, b) => a + BigInt(b), 0n);
const serviceJob=(kind)=>kind.startsWith('bank_')||kind.startsWith('genesis_');
const problem = (code) => Object.assign(new Error(code), { keeperCode: code });
const nat = (v, zero = false) => {
  if (!/^(0|[1-9][0-9]*)$/.test(String(v ?? ''))) throw problem('invalid_integer_policy');
  const n = BigInt(v); if ((!zero && !n) || n >= 1n << 256n) throw problem('invalid_integer_policy'); return n;
};
const addr = (v, allowZero = false) => {
  if (!isAddress(v, { strict: true }) || (!allowZero && lower(v) === zeroAddress)) throw problem('invalid_address_policy');
  return lower(getAddress(v));
};
const integer = (v, max = 86400) => {
  if (!Number.isSafeInteger(v) || v < 1 || v > max) throw problem('invalid_integer_policy'); return v;
};
const exactKeys = (obj, keys) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || Object.keys(obj).some((key) => !keys.includes(key))) throw problem('unknown_manifest_field');
};
const JOB_KEYS = {
  hook_sweep: ['asset', 'recipients', 'initializer'],
  buyback: ['stream', 'primaryRecipient', 'secondaryRecipient', 'maxAmount', 'dailyBudget'],
  token_revenue: ['stream', 'primaryRecipient', 'secondaryRecipient'],
  pol_collect: ['deskRecipient', 'vigRecipient'],
  pol_increase: ['maxNative', 'maxOmr', 'dailyNativeBudget', 'dailyOmrBudget', 'slippageBps'],
  pol_fund_inventory: ['executor', 'maxNative', 'dailyNativeBudget'],
  gas_topup: ['recipient', 'maxAmount', 'dailyBudget'],
  bank_harvest: ['asset', 'vault', 'transmuter', 'debtToken', 'assetDecimals', 'minAssetAmount', 'feeRecipient', 'user'],
  bank_sweep: ['asset', 'vault', 'transmuter', 'debtToken', 'assetDecimals', 'minAssetAmount', 'feeRecipient'],
  bank_fund_buffer: ['asset', 'transmuter', 'debtToken', 'assetDecimals', 'minAssetAmount', 'maxAssetAmount', 'dailyAssetBudget'],
  genesis_checkpoint: [], genesis_migrate: [], genesis_sweep_unsold: [], genesis_distribute: [], genesis_accept_foundation: [],
};
const fnAbi = (signature) => parseAbi([`function ${signature}`]);
const sig = {
  hook_sweep: 'sweep(address currency)', buyback: 'execute(uint256 amount,uint256 minOut,uint256 deadline)',
  token_revenue: 'distributeTokenRevenue()', pol_collect: 'collectFees(uint256 deadline) returns (uint256,uint256)',
  pol_increase: 'increase(uint128 nativeMax,uint128 omrMax,uint128 minLiquidityAdded,uint256 deadline) returns (uint128,uint256,uint256)',
  pol_fund_inventory: 'fundInventory(uint128 nativeAmount)', gas_topup: 'topUp(address keeper) returns (uint256)',
  bank_harvest: 'harvest(address user)', bank_sweep: 'sweepFees()',
  bank_fund_buffer: 'fundDeficit() returns (uint256)',
  genesis_checkpoint:'checkpoint()',genesis_migrate:'migrate()',genesis_sweep_unsold:'sweepUnsoldTokens()',
  genesis_distribute:'distributeResidual()',genesis_accept_foundation:'acceptFoundation(uint256 positionId)',
};

export function validateLiquidityManifest(raw) {
  // Clone first: callers cannot mutate approved policy after validation.
  const m = JSON.parse(JSON.stringify(raw));
  exactKeys(m, ['schemaVersion', 'chainId', 'governanceSafe', 'keeper', 'poolId', 'contracts', 'gas', 'jobs', 'genesis', 'indexing', 'bondDailyIssuance']);
  // Absence retains capped behavior without changing the bytes used for existing manifest hashes.
  if (Object.hasOwn(m, 'bondDailyIssuance') && !['capped', 'unlimited'].includes(m.bondDailyIssuance))
    throw problem('invalid_bond_daily_issuance_policy');
  if (m.schemaVersion !== 1 || m.chainId !== 4663 || !HASH.test(m.poolId)) throw problem('invalid_deployment_domain');
  exactKeys(m.indexing, ['startL2Block', 'maxBlocks']);
  m.indexing.startL2Block = String(nat(m.indexing.startL2Block, true));
  integer(m.indexing.maxBlocks, 10000);
  m.governanceSafe = addr(m.governanceSafe); m.keeper = addr(m.keeper);
  if (m.governanceSafe === m.keeper) throw problem('keeper_is_governance');
  if (!m.contracts || Array.isArray(m.contracts)) throw problem('missing_contract_pins');
  const addresses = new Set();
  for (const [name, target] of Object.entries(m.contracts)) {
    if (!/^[a-z][a-zA-Z0-9]{0,40}$/.test(name)) throw problem('invalid_contract_name');
    exactKeys(target, ['address', 'runtimeHash']); target.address = addr(target.address);
    if (!HASH.test(target.runtimeHash) || addresses.has(target.address)) throw problem('invalid_contract_pins');
    target.runtimeHash = lower(target.runtimeHash); addresses.add(target.address);
  }
  for (const name of ['omr', 'poolManager', 'oracle', 'polVault']) if (!m.contracts[name]) throw problem('missing_contract_pins');
  if (m.bondDailyIssuance === 'unlimited' && !m.contracts.bond) throw problem('missing_bond_dependency_pin');
  if(m.contracts.genesisController||m.genesis) {
    exactKeys(m.genesis,['treasuryRecipient','vigRecipient','founderRecipient','genesisStartL2Block','maxLogScanBlocks','maxCandidatePositions']);
    for(const name of ['genesisController','auction','strategy','splitter','positionManager'])if(!m.contracts[name])throw problem('missing_genesis_dependency_pin');
    for(const name of ['treasuryRecipient','vigRecipient','founderRecipient'])m.genesis[name]=addr(m.genesis[name]);
    m.genesis.genesisStartL2Block=String(nat(m.genesis.genesisStartL2Block,true));
    integer(m.genesis.maxLogScanBlocks,1000000);integer(m.genesis.maxCandidatePositions,64);
  }
  exactKeys(m.gas, ['maxGas', 'maxFeePerGas', 'maxPriorityFeePerGas', 'dailyBudget', 'confirmations', 'maxSnapshotAgeSeconds']);
  for (const name of ['maxGas', 'maxFeePerGas', 'dailyBudget']) m.gas[name] = String(nat(m.gas[name]));
  m.gas.maxPriorityFeePerGas = String(nat(m.gas.maxPriorityFeePerGas, true));
  if (nat(m.gas.maxPriorityFeePerGas, true) > nat(m.gas.maxFeePerGas)
    || nat(m.gas.maxGas) * nat(m.gas.maxFeePerGas) > nat(m.gas.dailyBudget)) throw problem('invalid_gas_policy');
  integer(m.gas.confirmations, 100); integer(m.gas.maxSnapshotAgeSeconds, 300);
  if (!Array.isArray(m.jobs) || m.jobs.length > 32) throw problem('invalid_jobs');
  const ids = new Set(), lanes = new Set();
  for (const j of m.jobs) {
    if (!JOB_KEYS[j.kind]) throw problem('unsupported_job_kind');
    exactKeys(j, ['id', 'kind', 'target', 'intervalSeconds', 'minNativeValue', ...JOB_KEYS[j.kind]]);
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(j.id || '') || ids.has(j.id) || !m.contracts[j.target]) throw problem('invalid_job_identity');
    ids.add(j.id); integer(j.intervalSeconds);
    if (!serviceJob(j.kind)) {
      j.minNativeValue = String(nat(j.minNativeValue));
      // Trading/revenue jobs must exceed their worst permitted gas cost. Bank maintenance is
      // a separately declared service: its exact asset floor, cadence and gas budget govern it.
      if (nat(j.minNativeValue) <= nat(m.gas.maxGas) * nat(m.gas.maxFeePerGas)) throw problem('uneconomic_job_policy');
    } else if (j.minNativeValue != null) throw problem('maintenance_uses_service_budget');
    if(j.kind.startsWith('genesis_')&&(!m.genesis||j.target!=='genesisController'))throw problem('invalid_genesis_job_target');
    if (['pol_collect', 'pol_increase', 'pol_fund_inventory'].includes(j.kind) && j.target !== 'polVault') throw problem('wrong_pol_target');
    if (j.kind === 'hook_sweep') {
      if (!['native', 'omr'].includes(j.asset)) throw problem('invalid_hook_asset');
      exactKeys(j.recipients, ['dev', 'rwa', 'community', 'lp']);
      for (const name of ['dev', 'rwa', 'community', 'lp']) j.recipients[name] = addr(j.recipients[name]);
      if (j.initializer && !m.contracts[j.initializer]) throw problem('unknown_hook_initializer');
    }
    if (['buyback', 'token_revenue'].includes(j.kind)) {
      if (![0, 1, 2, 3].includes(j.stream)) throw problem('invalid_revenue_stream');
      j.primaryRecipient = addr(j.primaryRecipient); j.secondaryRecipient = addr(j.secondaryRecipient, j.stream !== 0);
      if (j.stream === 0 && j.primaryRecipient !== j.secondaryRecipient) throw problem('vig_requires_shared_claim_custody');
      if (j.stream !== 0 && j.secondaryRecipient !== zeroAddress) throw problem('unexpected_secondary_recipient');
      if (j.stream < 2 && (!m.contracts.claim || j.primaryRecipient !== m.contracts.claim.address
        || (j.stream === 0 && j.secondaryRecipient !== m.contracts.claim.address))) throw problem('claim_custody_pin_required');
      if (j.stream === 3 && j.primaryRecipient !== m.contracts.polVault.address) throw problem('invalid_pol_custody');
    }
    if (j.kind === 'pol_collect') { j.deskRecipient = addr(j.deskRecipient); j.vigRecipient = addr(j.vigRecipient); }
    if (j.kind === 'pol_fund_inventory' && !m.contracts[j.executor]) throw problem('unknown_inventory_executor');
    if (j.kind === 'gas_topup') {
      j.recipient = addr(j.recipient);
      // This journal controls exactly one funded wallet. Oracle/other gas wallets need separate explicit policy.
      if (j.recipient !== m.keeper) throw problem('undeclared_keeper_recipient');
    }
    if (j.kind.startsWith('bank_')) {
      for (const ref of (j.kind==='bank_fund_buffer'?['asset','transmuter','debtToken']:['asset','vault','transmuter','debtToken'])) if (!m.contracts[j[ref]]) throw problem('missing_bank_dependency_pin');
      if (!Number.isSafeInteger(j.assetDecimals) || j.assetDecimals<0 || j.assetDecimals>18) throw problem('invalid_bank_asset_decimals');
      j.minAssetAmount=String(nat(j.minAssetAmount));
      if (j.kind!=='bank_fund_buffer') j.feeRecipient=addr(j.feeRecipient);
      if (j.kind==='bank_harvest') j.user=addr(j.user);
      if (j.kind==='bank_fund_buffer') {
        j.maxAssetAmount=String(nat(j.maxAssetAmount));j.dailyAssetBudget=String(nat(j.dailyAssetBudget));
        if (nat(j.maxAssetAmount)>nat(j.dailyAssetBudget) || nat(j.minAssetAmount)>nat(j.maxAssetAmount)) throw problem('invalid_action_budget');
      }
    }
    for (const field of ['maxAmount', 'dailyBudget', 'maxNative', 'maxOmr', 'dailyNativeBudget', 'dailyOmrBudget']) {
      if (JOB_KEYS[j.kind].includes(field)) j[field] = String(nat(j[field]));
    }
    if (j.maxAmount && nat(j.maxAmount) > nat(j.dailyBudget)) throw problem('invalid_action_budget');
    if (j.maxNative && (nat(j.maxNative) > UINT128 || nat(j.maxNative) > nat(j.dailyNativeBudget))) throw problem('invalid_action_budget');
    if (j.maxOmr && (nat(j.maxOmr) > UINT128 || nat(j.maxOmr) > nat(j.dailyOmrBudget))) throw problem('invalid_action_budget');
    if (j.kind === 'pol_increase' && (!Number.isSafeInteger(j.slippageBps) || j.slippageBps < 0 || j.slippageBps > 1000)) throw problem('invalid_slippage_policy');
    const lane = `${j.kind}:${j.target}:${j.asset || ''}:${j.user || ''}`;
    if (lanes.has(lane)) throw problem('duplicate_job_lane'); lanes.add(lane);
  }
  return m;
}

export function liquidityKeeperConfig(env = process.env) {
  if (env.LIQUIDITY_AUTOMATION_ENABLED !== 'on') return { enabled: false, reason: 'liquidity_automation_disabled' };
  if (env.DEX_BOT_ENABLED === 'on' || env.DEX_BOT_PK) throw problem('legacy_dex_bot_conflict');
  if (!env.LIQUIDITY_AUTOMATION_MANIFEST_PATH || !/^[0-9a-f]{64}$/i.test(env.LIQUIDITY_AUTOMATION_MANIFEST_SHA256 || '')) throw problem('manifest_pin_required');
  const bytes = fs.readFileSync(env.LIQUIDITY_AUTOMATION_MANIFEST_PATH);
  if (createHash('sha256').update(bytes).digest('hex') !== lower(env.LIQUIDITY_AUTOMATION_MANIFEST_SHA256)) throw problem('manifest_digest_mismatch');
  const manifest = validateLiquidityManifest(JSON.parse(bytes));
  if (Number(env.CHAIN_ID) !== manifest.chainId) throw problem('wrong_chain');
  const rpcUrls = [...new Set([env.CHAIN_RPC_URL || '', ...(env.LIQUIDITY_RPC_URLS || '').split(',').filter(Boolean)].map((value) => {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw problem('invalid_rpc_transport');
    return url.href;
  }))];
  if (rpcUrls.length > 3) throw problem('too_many_rpc_transports');
  return { enabled: true, manifest, rpcUrl: rpcUrls[0], rpcUrls };
}

export function makeLiquidityKeeperClients(config, { env = process.env, signing = false } = {}) {
  const rpcUrls = config.rpcUrls || [config.rpcUrl];
  const transport = () => fallback(rpcUrls.map((url) => http(url, { retryCount: 0, timeout: 15000 })), { rank: false, retryCount: 0 });
  const chain = defineChain({ id: config.manifest.chainId, name: 'OMERTA keeper target', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: rpcUrls } } });
  const publicClient = createPublicClient({ chain, transport: transport() });
  if (!signing) return { publicClient };
  const key = env.LIQUIDITY_KEEPER_PK;
  if (!HASH.test(key || '')) throw problem('keeper_key_required');
  const keyBytes=(value)=>lower(value).replace(/^0x/,'');
  if ([env.V4_ORACLE_KEEPER_PK, env.OMERTA_ORACLE_PK, env.ORACLE_KEEPER_PK, env.DEX_BOT_PK,
    env.STOCK_KEEPER_PK,env.VOUCHER_SIGNER_PK,env.STOCK_ALLOCATION_SIGNER_PK,env.RWA_BALLOT_PUBLISHER_PK].filter(Boolean)
    .some((v)=>keyBytes(v)===keyBytes(key))) throw problem('shared_privileged_key');
  const account = privateKeyToAccount(key);
  if (lower(account.address) !== config.manifest.keeper) throw problem('signer_mismatch');
  return { publicClient, account, walletClient: createWalletClient({ chain, account, transport: transport() }) };
}

export async function readLiquiditySnapshot(manifest, clients) {
  const m = validateLiquidityManifest(manifest), pub = clients.publicClient;
  const readAt = Date.now();
  if (Number(await pub.getChainId()) !== m.chainId) throw problem('wrong_chain');
  const block = await pub.getBlock({ blockTag: 'latest' });
  if (block.number == null || !HASH.test(block.hash || '')) throw problem('invalid_snapshot_block');
  const now = BigInt(block.timestamp), day = now / 86400n;
  const wallNow=BigInt(Math.floor(readAt/1000));
  if (now>wallNow+15n || wallNow>now+BigInt(m.gas.maxSnapshotAgeSeconds)) throw problem('stale_chain_head');
  const read = (target, signature, args = []) => pub.readContract({ address: getAddress(m.contracts[target].address), abi: fnAbi(signature), functionName: signature.split('(')[0], args, blockNumber: block.number });
  const equal = (actual, expected) => { if (lower(actual) !== lower(expected)) throw problem('deployment_binding_mismatch'); };
  await Promise.all(Object.values(m.contracts).map(async (t) => {
    const code = await pub.getCode({ address: getAddress(t.address), blockNumber: block.number }) || '0x';
    if (lower(keccak256(code)) !== t.runtimeHash || code === '0x') throw problem('target_code_mismatch');
  }));
  const [keeperBalance, health, oracleResult, emergencyLatched] = await Promise.all([
    pub.getBalance({ address: getAddress(m.keeper), blockNumber: block.number }),
    read('polVault', 'healthy() view returns (bool)'),
    read('oracle', 'consult() view returns (uint256,uint256)').catch(() => null),
    read('polVault','emergencyLatched() view returns (bool)'),
  ]);
  const foundationBindings = await Promise.all(['owner() view returns (address)', 'omr() view returns (address)',
    'poolManager() view returns (address)', 'poolId() view returns (bytes32)', 'oracle() view returns (address)'].map((s) => read('polVault',s)));
  [m.governanceSafe,m.contracts.omr.address,m.contracts.poolManager.address,m.poolId,m.contracts.oracle.address]
    .forEach((expected,i) => equal(foundationBindings[i],expected));
  const oracle = oracleResult && BigInt(oracleResult[0]) > 0n && BigInt(oracleResult[1]) <= now
    && now - BigInt(oracleResult[1]) <= 7200n ? { omrPerEth: String(oracleResult[0]), updatedAt: String(oracleResult[1]) } : null;
  const omrBalance = (account) => read('omr', 'balanceOf(address) view returns (uint256)', [getAddress(account)]);
  const nativeBalance = (account) => pub.getBalance({ address: getAddress(account), blockNumber: block.number });
  const dailyIssuancePolicy=m.bondDailyIssuance??'capped';
  let bond={ready:false,dailyCapOmrWei:'0',dailyIssuancePolicy,reason:'bond_not_configured'};
  if(m.contracts.bond) {
    try {
      const [owner,omr,guard,bondOracle,paused,dailyCap,maxPrice,ceiling,minter]=await Promise.all([
        read('bond','owner() view returns (address)'),read('bond','omr() view returns (address)'),
        read('bond','liquidityHealthGuard() view returns (address)'),read('bond','oracle() view returns (address)'),
        read('bond','paused() view returns (bool)'),read('bond','dailyCapOMR() view returns (uint256)'),
        read('bond','maxOmrPerEth() view returns (uint256)'),read('bond','priceCeiling() view returns (uint256,uint256)'),
        read('omr','minter() view returns (address)'),
      ]);
      for(const [actual,expected] of [[owner,m.governanceSafe],[omr,m.contracts.omr.address],[guard,m.contracts.polVault.address],
        [bondOracle,m.contracts.oracle.address],[minter,m.contracts.bond.address]])equal(actual,expected);
      const dailyPolicyMatches=dailyIssuancePolicy==='unlimited'?BigInt(dailyCap)===0n:BigInt(dailyCap)>0n;
      const priceBoundsSet=BigInt(maxPrice)>0n&&BigInt(ceiling[0])>0n&&BigInt(ceiling[1])>0n;
      bond={ready:!paused&&!!health&&dailyPolicyMatches&&priceBoundsSet,dailyCapOmrWei:String(dailyCap),dailyIssuancePolicy,maxOmrPerEthWei:String(maxPrice),
        priceCeilingOmrPerEthWei:String(ceiling[0]),reason:paused?'bond_paused':!health?'foundation_unhealthy':!dailyPolicyMatches?'bond_daily_policy_mismatch':!priceBoundsSet?'bond_caps_unset':null};
    }catch(error){bond={ready:false,dailyCapOmrWei:'0',dailyIssuancePolicy,reason:error.keeperCode||'bond_read_unavailable'};}
  }
  const genesis=m.contracts.genesisController?await readGenesisKeeperState(m,pub,block,read):null;
  const jobs = {};
  for (const j of m.jobs) {
    try {
      const r = (s, args = []) => read(j.target, s, args);
      equal(await r('owner() view returns (address)'), m.governanceSafe);
      const s = { kind: j.kind, ready: true };
      if(j.kind.startsWith('genesis_')) {
        const g=genesis;
        Object.assign(s,{phase:g.phase,provenMigrated:g.provenMigrated,failedRecoverable:g.failedRecoverable,positionId:g.positionId,
          ready:g.bound&&!g.stopped,genesis:g});
        if(j.kind==='genesis_checkpoint')s.ready=s.ready&&!g.emergencyLatched&&[1,2].includes(g.phase)&&BigInt(g.currentBlock)>=BigInt(g.startBlock);
        if(j.kind==='genesis_migrate')s.ready=s.ready&&!g.emergencyLatched&&g.phase===2;
        if(j.kind==='genesis_sweep_unsold')s.ready=s.ready&&BigInt(g.currentBlock)>=BigInt(g.migrationBlock)
          &&(BigInt(g.unsoldSwept)===0n||BigInt(g.controllerOmr)>0n);
        if(j.kind==='genesis_distribute')s.ready=s.ready&&(g.provenMigrated||g.failedRecoverable)
          &&(BigInt(g.splitterNative)>0n||BigInt(g.splitterOmr)>0n);
        if(j.kind==='genesis_accept_foundation') {
          s.ready=s.ready&&!g.emergencyLatched&&g.provenMigrated&&BigInt(g.positionId)===0n;
          if(s.ready)Object.assign(s,await discoverGenesisFoundation(m,pub,block,read));
        }
        if(s.ready&&j.kind!=='genesis_accept_foundation')await pub.simulateContract({account:getAddress(m.keeper),address:getAddress(m.contracts.genesisController.address),
          abi:fnAbi(sig[j.kind]),functionName:sig[j.kind].split('(')[0],args:[],blockNumber:block.number});
        if(!s.ready)s.reason=g.stopped?'genesis_stopped':!g.bound?'genesis_unbound':g.failed?'genesis_failed_phase':'genesis_job_not_due';
      } else if (j.kind === 'hook_sweep') {
        equal(await r('omr() view returns (address)'), m.contracts.omr.address);
        equal(await r('poolManager() view returns (address)'), m.contracts.poolManager.address);
        if (j.initializer) equal(await r('authorized() view returns (address)'),m.contracts[j.initializer].address);
        for (const name of ['dev', 'rwa', 'community', 'lp']) equal(await r(`${name}Recipient() view returns (address)`), j.recipients[name]);
        s.owed = (await r('owed(address) view returns (uint256,uint256,uint256,uint256)', [j.asset === 'native' ? zeroAddress : getAddress(m.contracts.omr.address)])).map(String);
      } else if (['buyback', 'token_revenue'].includes(j.kind)) {
        const [paused, allowed, omr, manager, pool, guard, oracleAddress, stream, primary, secondary, sequence] = await Promise.all([
          r('paused() view returns (bool)'), r('keeper(address) view returns (bool)', [getAddress(m.keeper)]),
          r('omr() view returns (address)'), r('poolManager() view returns (address)'), r('poolId() view returns (bytes32)'),
          r('healthGuard() view returns (address)'), r('oracle() view returns (address)'), r('stream() view returns (uint8)'),
          r('primaryRecipient() view returns (address)'), r('secondaryRecipient() view returns (address)'), r('sequence() view returns (uint256)'),
        ]);
        for (const [actual, expected] of [[omr,m.contracts.omr.address],[manager,m.contracts.poolManager.address],[pool,m.poolId],[guard,m.contracts.polVault.address],[oracleAddress,m.contracts.oracle.address],[primary,j.primaryRecipient],[secondary,j.secondaryRecipient]]) equal(actual,expected);
        if (Number(stream) !== j.stream) throw problem('revenue_stream_mismatch');
        Object.assign(s, { ready: !paused && allowed, sequence: String(sequence), paused, allowed });
        if (j.kind === 'token_revenue') s.amount = String(await omrBalance(m.contracts[j.target].address));
        else {
          const [balance, perAction, perDay, spent, next] = await Promise.all([nativeBalance(m.contracts[j.target].address), r('perAction() view returns (uint256)'), r('perDay() view returns (uint256)'), r('spentInDay(uint256) view returns (uint256)', [day]), r('nextExecutionAt() view returns (uint256)')]);
          const remaining = BigInt(perDay) > BigInt(spent) ? BigInt(perDay) - BigInt(spent) : 0n;
          const amount = min(BigInt(balance), BigInt(perAction), remaining, nat(j.maxAmount));
          Object.assign(s, { ready: s.ready && health && now >= BigInt(next), amount: String(amount), next: String(next), perAction: String(perAction), perDay: String(perDay), spent: String(spent), minOut: amount ? String(await r('quoteFloor(uint256) view returns (uint256)', [amount])) : '0' });
        }
      } else if (j.kind.startsWith('pol_')) {
        const [paused, emergency, keeper, omr, manager, pool, oracleAddress, position] = await Promise.all([
          r('paused() view returns (bool)'), r('emergencyLatched() view returns (bool)'), r('keeper() view returns (address)'), r('omr() view returns (address)'), r('poolManager() view returns (address)'), r('poolId() view returns (bytes32)'), r('oracle() view returns (address)'), r('positionId() view returns (uint256)'),
        ]);
        for (const [actual,expected] of [[keeper,m.keeper],[omr,m.contracts.omr.address],[manager,m.contracts.poolManager.address],[pool,m.poolId],[oracleAddress,m.contracts.oracle.address]]) equal(actual,expected);
        Object.assign(s, { ready: !paused && !emergency && !!health && BigInt(position) > 0n, positionId: String(position) });
        s.deskRecipient=lower(await r('deskRecipient() view returns (address)'));
        s.vigRecipient=lower(await r('vigRecipient() view returns (address)'));
        if (j.kind === 'pol_collect') {
          equal(await r('deskRecipient() view returns (address)'), j.deskRecipient); equal(await r('vigRecipient() view returns (address)'), j.vigRecipient);
          s.fees = (await r('pendingFees() view returns (uint256,uint256)')).map(String);
          if (s.ready && sum(s.fees)>0n) {
            // Growth is an estimate. The full fixed-position call proves the actual collection
            // and routing are executable before a recurring economic job is offered.
            const simulation=await pub.simulateContract({account:getAddress(m.keeper),address:getAddress(m.contracts.polVault.address),
              abi:fnAbi(sig.pol_collect),functionName:'collectFees',args:[now+180n],blockNumber:block.number});
            s.fees=simulation.result.map(String);
          }
        } else {
          const [budget, native, omrAmount] = await Promise.all([r('budgetAvailable() view returns (uint256,uint256)'),nativeBalance(m.contracts.polVault.address),omrBalance(m.contracts.polVault.address)]);
          const nativeMax = min(BigInt(budget[0]),BigInt(native),nat(j.maxNative)); s.nativeMax = String(nativeMax);
          if (j.kind === 'pol_fund_inventory') {
            equal(await r('inventoryExecutor() view returns (address)'), m.contracts[j.executor].address);
            equal(await r('inventoryExecutorCodeHash() view returns (bytes32)'), m.contracts[j.executor].runtimeHash);
            // Preserve native matching inventory. Buying half of a native-only excess brings the
            // two sides toward parity without spending the ETH needed to pair the purchased OMR.
            const omrNativeValue=oracle?BigInt(omrAmount)*10n**18n/BigInt(oracle.omrPerEth):BigInt(native);
            const inventoryDeficit=BigInt(native)>omrNativeValue?(BigInt(native)-omrNativeValue)/2n:0n;
            s.nativeMax=String(min(nativeMax,inventoryDeficit));
          }
          else {
            const omrMax = min(BigInt(budget[1]),BigInt(omrAmount),nat(j.maxOmr)); s.omrMax = String(omrMax);
            s.liquidity = nativeMax && omrMax ? String(await r('quoteLiquidity(uint128,uint128) view returns (uint128)',[nativeMax,omrMax])) : '0';
          }
        }
      } else if (j.kind === 'gas_topup') {
        const [paused, allowed, amount, cap] = await Promise.all([r('paused() view returns (bool)'),r('allowedKeeper(address) view returns (bool)',[getAddress(j.recipient)]),
          r('refillAmount(address) view returns (uint256)',[getAddress(j.recipient)]),r('perRefillCap() view returns (uint256)')]);
        Object.assign(s,{ready:!paused && allowed,amount:String(amount),maxRefill:String(cap)});
      } else if (j.kind==='bank_fund_buffer') {
        for (const ref of ['asset','transmuter']) equal(await r(`${ref}() view returns (address)`),m.contracts[j[ref]].address);
        equal(await r('assetCodeHash() view returns (bytes32)'),m.contracts[j.asset].runtimeHash);
        equal(await r('transmuterCodeHash() view returns (bytes32)'),m.contracts[j.transmuter].runtimeHash);
        equal(await read(j.transmuter,'asset() view returns (address)'),m.contracts[j.asset].address);
        equal(await read(j.transmuter,'debtToken() view returns (address)'),m.contracts[j.debtToken].address);
        equal(await read(j.transmuter,'owner() view returns (address)'),m.governanceSafe);
        if (Number(await read(j.asset,'decimals() view returns (uint8)'))!==j.assetDecimals
          || Number(await read(j.debtToken,'decimals() view returns (uint8)'))!==18) throw problem('bank_denomination_mismatch');
        const [paused,amount,cap,allowed,allowance]=await Promise.all([r('paused() view returns (bool)'),r('fundingAmount() view returns (uint256)'),
          r('perActionCap() view returns (uint256)'),read(j.transmuter,'funder(address) view returns (bool)',[getAddress(m.contracts[j.target].address)]),
          read(j.asset,'allowance(address,address) view returns (uint256)',[getAddress(m.contracts[j.target].address),getAddress(m.contracts[j.transmuter].address)])]);
        if (BigInt(allowance)!==0n) throw problem('bank_buffer_residual_allowance');
        Object.assign(s,{ready:!paused && allowed,amount:String(amount),maxFundAmount:String(cap)});
        if (s.ready && BigInt(amount)>=nat(j.minAssetAmount)) {
          const simulation=await pub.simulateContract({account:getAddress(m.keeper),address:getAddress(m.contracts[j.target].address),
            abi:fnAbi(sig.bank_fund_buffer),functionName:'fundDeficit',args:[],blockNumber:block.number});
          s.amount=String(simulation.result);
        }
      } else if (j.kind.startsWith('bank_')) {
        for (const ref of ['asset','vault','transmuter','debtToken']) equal(await r(`${ref}() view returns (address)`),m.contracts[j[ref]].address);
        equal(await r('feeRecipient() view returns (address)'),j.feeRecipient);
        equal(await read(j.vault,'asset() view returns (address)'),m.contracts[j.asset].address);
        equal(await read(j.transmuter,'asset() view returns (address)'),m.contracts[j.asset].address);
        equal(await read(j.transmuter,'debtToken() view returns (address)'),m.contracts[j.debtToken].address);
        equal(await read(j.transmuter,'owner() view returns (address)'),m.governanceSafe);
        const decimals=Number(await read(j.asset,'decimals() view returns (uint8)'));
        if (decimals!==j.assetDecimals || Number(await read(j.debtToken,'decimals() view returns (uint8)'))!==18) throw problem('bank_denomination_mismatch');
        const scale=BigInt(await r('scale() view returns (uint256)'));
        if (scale!==10n**BigInt(18-decimals)) throw problem('bank_denomination_mismatch');
        s.amount='0';
        if (j.kind==='bank_sweep') s.amount=String(await r('accruedFees() view returns (uint256)'));
        else {
          const [principal,collateral,debt,feeBps,funder]=await Promise.all([
            r('principalOf(address) view returns (uint256)',[getAddress(j.user)]),r('collateralOf(address) view returns (uint256)',[getAddress(j.user)]),
            r('debtOf(address) view returns (uint256)',[getAddress(j.user)]),r('harvestFeeBps() view returns (uint16)'),
            read(j.transmuter,'funder(address) view returns (bool)',[getAddress(m.contracts[j.target].address)]),
          ]);
          if (!funder || BigInt(feeBps)>3000n) throw problem('bank_harvest_binding_mismatch');
          const yieldAssets=BigInt(collateral)>BigInt(principal)?BigInt(collateral)-BigInt(principal):0n;
          const net=yieldAssets-yieldAssets*BigInt(feeBps)/10000n;
          // Debt-clearing service, excluding fees and the untouched compounding remainder.
          s.amount=String(min(net,(BigInt(debt)+scale-1n)/scale));
        }
        if (BigInt(s.amount)>=nat(j.minAssetAmount)) {
          await pub.simulateContract({account:getAddress(m.keeper),address:getAddress(m.contracts[j.target].address),
            abi:fnAbi(sig[j.kind]),functionName:sig[j.kind].split('(')[0],args:j.kind==='bank_harvest'?[getAddress(j.user)]:[],blockNumber:block.number});
        }
      }
      jobs[j.id] = s;
    } catch (error) { jobs[j.id] = { kind:j.kind, ready:false, reason:error.keeperCode || 'job_read_unavailable' }; }
  }
  // A reorg during the reads invalidates the whole observation; it cannot authorize a send.
  const canonical = await pub.getBlock({ blockNumber:block.number });
  if (lower(canonical.hash) !== lower(block.hash)) throw problem('snapshot_reorged');
  return { chainId:m.chainId,blockNumber:String(block.number),blockHash:lower(block.hash),timestamp:String(now),readAt,keeperBalance:String(keeperBalance),health:!!health,
    emergencyLatched:!!emergencyLatched,genesisPhase:genesis?.phase??null,genesis,bond,oracle,jobs };
}

export function planLiquidityActions(manifest, snapshot, { completedJobKeys = [], nowMs = Date.now(), planningContext = {}, lastAttemptByJob = {} } = {}) {
  const m = validateLiquidityManifest(manifest), actions = [], blocked = [];
  if (snapshot.chainId !== m.chainId || !HASH.test(snapshot.blockHash || '') || !Number.isFinite(snapshot.readAt)
    || nowMs < snapshot.readAt || nowMs - snapshot.readAt > m.gas.maxSnapshotAgeSeconds * 1000) throw problem('stale_snapshot');
  const timestamp = nat(snapshot.timestamp), period = `day:${timestamp / 86400n}`, done = new Set(completedJobKeys);
  const gasCost = nat(m.gas.maxGas) * nat(m.gas.maxFeePerGas);
    const valueOfOmr = (amount) => snapshot.oracle ? amount * 10n ** 18n / nat(snapshot.oracle.omrPerEth) : 0n;
  for (const j of m.jobs) {
    const s = snapshot.jobs[j.id];
    const skip = (reason) => blocked.push({jobId:j.id,reason});
    const jobKey = `${j.id}:${timestamp / BigInt(j.intervalSeconds)}`;
    if (done.has(jobKey)) { skip('interval_already_attempted'); continue; }
    if (!s?.ready) { skip(s?.reason || 'job_not_ready'); continue; }
    if (nat(snapshot.keeperBalance,true) < gasCost) { skip('keeper_gas_seed_required'); continue; }
    let args=[],value=0n,economic=0n,budgets=[],metadata={kind:j.kind,jobId:j.id};
    const budget = (asset, amount, limit) => ({key:`${j.id}:${asset}`,period,amount:String(amount),limit});
    const deadline = timestamp + 180n;
    if(j.kind.startsWith('genesis_')) {
      if(j.kind==='genesis_accept_foundation')args=[nat(s.positionId)];
      metadata={...metadata,serviceBudget:true,phase:s.phase,provenMigrated:s.provenMigrated,failedRecoverable:s.failedRecoverable,
        omr:m.contracts.omr.address,auction:m.contracts.auction.address,strategy:m.contracts.strategy.address,splitter:m.contracts.splitter.address,
        foundation:m.contracts.polVault.address,treasuryRecipient:m.genesis.treasuryRecipient,vigRecipient:m.genesis.vigRecipient,founderRecipient:m.genesis.founderRecipient,
        ...(j.kind==='genesis_accept_foundation'?{positionId:s.positionId,migrationTxHash:s.migrationTxHash,migrationL2Block:s.migrationL2Block}:{})};
    } else if (j.kind === 'hook_sweep') {
      const amount = sum(s.owed); economic = j.asset === 'native' ? amount : valueOfOmr(amount);
      args = [j.asset === 'native' ? zeroAddress : getAddress(m.contracts.omr.address)];
      metadata = {...metadata,asset:j.asset,omr:m.contracts.omr.address,recipients:j.recipients,amount:String(amount)};
    } else if (['buyback','token_revenue'].includes(j.kind)) {
      const amount = nat(s.amount,true);
      metadata = {...metadata,kind:j.kind === 'buyback' ? 'buyback' : 'token_revenue',stream:j.stream,omr:m.contracts.omr.address,primaryRecipient:j.primaryRecipient,secondaryRecipient:j.secondaryRecipient,
        ...(j.stream < 2 ? {claimRecipient:m.contracts.claim.address} : {})};
      if (j.kind === 'buyback') {
        if (j.stream === 1) {
          const strategy=planningContext.desk?.[j.id],anchor=Number(strategy?.anchorEthPerOmr);
          if (strategy?.buyAllowed !== true || !Number.isFinite(anchor) || anchor <= 0) {skip('desk_band_strategy_required');continue;}
          metadata.anchorEthPerOmr=anchor;
          if(strategy.minOutWei!=null)metadata.strategyMinOutWei=String(nat(strategy.minOutWei));
        }
        if (!snapshot.health || !amount || amount > nat(j.maxAmount) || !nat(s.minOut,true)) {skip('buyback_not_ready');continue;}
        const minOut=metadata.strategyMinOutWei&&nat(metadata.strategyMinOutWei)>nat(s.minOut)?nat(metadata.strategyMinOutWei):nat(s.minOut);
        economic = amount; args=[amount,minOut,deadline]; budgets=[budget('native',amount,j.dailyBudget)];
      } else economic=valueOfOmr(amount);
    } else if (j.kind === 'pol_collect') {
      economic=nat(s.fees[0],true)+valueOfOmr(nat(s.fees[1],true)); args=[deadline];
      metadata={...metadata,omr:m.contracts.omr.address,deskRecipient:j.deskRecipient,vigRecipient:j.vigRecipient,positionId:s.positionId};
    } else if (j.kind === 'pol_increase') {
      const native=nat(s.nativeMax,true),omr=nat(s.omrMax,true),liquidity=nat(s.liquidity,true);
      const floor=liquidity*BigInt(10000-j.slippageBps)/10000n;
      if (!snapshot.health || !native || !omr || !floor || native>nat(j.maxNative) || omr>nat(j.maxOmr)) {skip('pol_inventory_or_quote_unavailable');continue;}
      economic=native+valueOfOmr(omr);args=[native,omr,floor,deadline];
      budgets=[budget('native',native,j.dailyNativeBudget),budget('omr',omr,j.dailyOmrBudget)];
      metadata={...metadata,omr:m.contracts.omr.address,deskRecipient:s.deskRecipient,vigRecipient:s.vigRecipient,positionId:s.positionId,nativeMax:String(native),omrMax:String(omr),minLiquidity:String(floor)};
    } else if (j.kind === 'pol_fund_inventory') {
      const amount=nat(s.nativeMax,true);
      if (!snapshot.health || amount>nat(j.maxNative)) {skip('pol_unhealthy');continue;}
      economic=amount;args=[amount];budgets=[budget('native',amount,j.dailyNativeBudget)];metadata={...metadata,executor:m.contracts[j.executor].address};
    } else if (j.kind === 'gas_topup') {
      const amount=nat(s.amount,true);
      const cap=nat(s.maxRefill);
      if (amount>nat(j.maxAmount) || cap>nat(j.maxAmount)) {skip('refill_exceeds_approved_cap');continue;}
      // Gas reduces the recipient's balance before topUp reads its deficit. Reserve the whole
      // immutable refill cap, not an optimistic pre-transaction deficit preview.
      economic=amount;args=[getAddress(j.recipient)];budgets=[budget('native',cap,j.dailyBudget)];metadata={...metadata,recipient:j.recipient,maxRefill:String(cap)};
    } else if (j.kind.startsWith('bank_')) {
      const amount=nat(s.amount,true);
      if (amount<nat(j.minAssetAmount)) {skip('bank_below_asset_threshold');continue;}
      args=j.kind==='bank_harvest'?[getAddress(j.user)]:[];
      metadata={...metadata,asset:m.contracts[j.asset].address,assetDecimals:j.assetDecimals,feeRecipient:j.feeRecipient,
        transmuter:m.contracts[j.transmuter].address,serviceBudget:true,previewAssetAmount:String(amount),...(j.kind==='bank_harvest'?{user:j.user}:{})};
      if (j.kind==='bank_fund_buffer') {
        const cap=nat(s.maxFundAmount);
        if (amount>nat(j.maxAssetAmount) || cap>nat(j.maxAssetAmount)) {skip('bank_buffer_exceeds_approved_cap');continue;}
        budgets=[budget('asset',cap,j.dailyAssetBudget)];metadata.maxFundAmount=String(cap);
      }
    }
    if (!serviceJob(j.kind) && economic<nat(j.minNativeValue)) {skip(snapshot.oracle || !['token_revenue','hook_sweep','pol_collect'].includes(j.kind) ? 'below_economic_threshold' : 'oracle_unavailable');continue;}
    const abi=fnAbi(sig[j.kind]);
    actions.push({jobId:j.id,kind:j.kind,jobKey,target:m.contracts[j.target].address,targetCodeHash:m.contracts[j.target].runtimeHash,
      functionName:sig[j.kind].split('(')[0],args:args.map((a)=>typeof a==='bigint'?String(a):a),
      request:{data:encodeFunctionData({abi,functionName:sig[j.kind].split('(')[0],args}),value:String(value)},
      budgets,gasBudget:{key:'liquidity-gas',period,limit:m.gas.dailyBudget},metadata,
      accountingRequired:j.kind.startsWith('genesis_')||['buyback','token_revenue','pol_collect','pol_increase','pol_fund_inventory','hook_sweep','bank_harvest','bank_sweep','bank_fund_buffer'].includes(j.kind),
      economicNativeValue:serviceJob(j.kind)?null:String(economic)});
  }
  // Fund the existing keeper first when a funded allowlisted refill is available.
  const priority={gas_topup:-3,genesis_migrate:-2,genesis_accept_foundation:-1};
  const attempted=(id)=>Object.hasOwn(lastAttemptByJob,id)?Number(lastAttemptByJob[id]):-1;
  actions.sort((a,b)=>(priority[a.kind]||0)-(priority[b.kind]||0)||attempted(a.jobId)-attempted(b.jobId));
  return {chainId:m.chainId,blockNumber:snapshot.blockNumber,blockHash:snapshot.blockHash,timestamp:snapshot.timestamp,health:snapshot.health,actions,blocked};
}

export async function runLiquidityKeeper(pool, { config, clients, onConfirmed, dryRun = false, planningContext = {} } = {}) {
  try {
    config ||= liquidityKeeperConfig();
    if (!config.enabled) return {state:'disabled',reason:config.reason,alert:false};
    const m=validateLiquidityManifest(config.manifest);
    clients ||= makeLiquidityKeeperClients(config,{signing:!dryRun});
    // Shared with confirmed public-log recovery. Load after module initialization because the
    // indexer itself consumes this module's closed manifest validator.
    const preSettlement=!dryRun?(await import('./liquidityindexer.js')).verifyHookSweepReceipt:null;
    const verifyReceipt=preSettlement?(row,receipt)=>preSettlement(clients,row,receipt):undefined;
    if (!dryRun) {
      const pending=await reconcileKeeperTransactions(pool,{chainId:m.chainId,wallet:m.keeper,clients,
        allowedTargets:Object.fromEntries(Object.values(m.contracts).map(t=>[t.address,t.runtimeHash])),onConfirmed,preSettlement:verifyReceipt});
      if (pending.state!=='idle') return pending;
    }
    const prior=pool?await keeperTransactionStatus(pool,{chainId:m.chainId,wallet:m.keeper}):[];
    const snapshot=await readLiquiditySnapshot(m,clients);
    const currentKeys=m.jobs.map(j=>`${j.id}:${BigInt(snapshot.timestamp)/BigInt(j.intervalSeconds)}`);
    const current=pool?await keeperTransactionStatus(pool,{chainId:m.chainId,wallet:m.keeper,jobKeys:currentKeys}):[];
    const lastAttemptByJob=Object.create(null);
    for(const row of [...prior,...current])if(row.metadata?.jobId&&!Object.hasOwn(lastAttemptByJob,row.metadata.jobId))lastAttemptByJob[row.metadata.jobId]=row.nonce;
    const resolvedContext=typeof planningContext==='function'?await planningContext(pool,m,snapshot):planningContext;
    const plan=planLiquidityActions(m,snapshot,{completedJobKeys:current.map(r=>r.jobKey),planningContext:resolvedContext,lastAttemptByJob});
    if (dryRun) return {state:'planned',alert:false,plan};
    const action=plan.actions[0];
    if (!action) return {state:'idle',alert:plan.blocked.some(b=>!['interval_already_attempted','below_economic_threshold','job_not_ready'].includes(b.reason)),plan};
    if (action.accountingRequired && !onConfirmed) return {state:'blocked',reason:'accounting_handler_required',alert:true,plan};
    // One newly signed transaction per invocation; pending receipt reconciliation always runs first.
    return await runKeeperTransaction(pool,{...action,chainId:m.chainId,wallet:m.keeper,clients,onConfirmed,preSettlement:verifyReceipt,
      maxGas:m.gas.maxGas,maxFeePerGas:m.gas.maxFeePerGas,maxPriorityFeePerGas:m.gas.maxPriorityFeePerGas,confirmations:m.gas.confirmations});
  } catch (error) {return {state:'blocked',reason:error.keeperCode||'liquidity_keeper_unavailable',alert:true};}
}
