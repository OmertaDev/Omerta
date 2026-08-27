#!/usr/bin/env node
// Exact-stack genesis/oracle/bond rehearsal. Every state-changing RPC is sent only to a disposable
// loopback Anvil fork. The upstream chain-4663 endpoint is read-only and supplies fork state only.
// Keeper and quote keys are random, in-memory test keys; no private key is accepted or persisted.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import {
  concatHex, createPublicClient, createWalletClient, defineChain, encodeAbiParameters,
  encodeFunctionData, getAddress, getCreate2Address, http, keccak256, maxUint256,
  parseEther, stringToHex, toFunctionSelector, toHex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { newDb } from 'pg-mem';
import {
  ROBINHOOD_GENESIS_STACK, V4_OBSERVATION_SOURCE_INTERFACE_ID,
  buildGenesisLaunchArtifacts, canonicalGenesisPoolId,
  verifyGenesisLaunchReadiness, verifyRobinhoodGenesisStack,
} from '../src/genesiscca.js';
import {
  classifyV4OracleHealth, readV4OracleSnapshot,
  runV4OracleKeeper, v4OracleHealth,
} from '../src/v4oraclekeeper.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const contractsRoot = path.join(root, 'omerta-contracts');
const auditRoot = path.join(root, '.audit', 'genesis-fork-rehearsal');
const forkRpc = process.env.ROBINHOOD_FORK_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const CHAIN_ID = 4663;
const ZERO = '0x0000000000000000000000000000000000000000';
const ARBSYS = '0x0000000000000000000000000000000000000064';
const CREATE2_DEPLOYER = '0x4e59b44847b379578588920cA78FbF26c0B4956C';
const HOOK_FLAGS = 0x30ccn;
const HOOK_MASK = 0x3fffn;
const PERIOD = 600;
const MAX_WINDOW_MULT = 4;
const MAX_HOOK_SALT_ATTEMPTS = 200_000;

const ARBSYS_ABI = [{
  type: 'function', name: 'arbBlockNumber', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }],
}];
const SUBMIT_BID_ABI = [{
  type: 'function', name: 'submitBid', stateMutability: 'payable',
  inputs: [
    { name: 'maxPriceQ96', type: 'uint256' }, { name: 'amount', type: 'uint128' },
    { name: 'owner', type: 'address' }, { name: 'hookData', type: 'bytes' },
  ], outputs: [{ name: 'bidId', type: 'uint256' }],
}];
const CCA_ABI = [
  { type: 'function', name: 'checkpoint', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'isGraduated', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'clearingPrice', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'currencyRaised', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalCleared', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint128' }] },
];
const LBP_ABI = [{
  type: 'function', name: 'migrate', stateMutability: 'nonpayable',
  inputs: [{ name: 'initializer', type: 'address' }], outputs: [],
}];
const ERC20_ABI = [
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
];
const POSITION_ABI = [{
  type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }],
}];
const TOPICS = {
  initializerCreated: keccak256(stringToHex('InitializerCreated(address,(address,address,uint64,uint128,address,address,(uint24,int24,address),bytes,bytes))')),
  migrated: keccak256(stringToHex('Migrated(address,(address,address,uint24,int24,address),uint160,bytes)')),
  migrationFailed: keccak256(stringToHex('MigrationFailed(address,bytes)')),
  fundsRecovered: keccak256(stringToHex('FundsRecovered(address,address,uint256)')),
  erc721Transfer: keccak256(stringToHex('Transfer(address,address,uint256)')),
};
const TICK_MULTIPLIERS = [
  0xfffcb933bd6fad37aa2d162d1a594001n, 0xfff97272373d413259a46990580e213an,
  0xfff2e50f5f656932ef12357cf3c7fdccn, 0xffe5caca7e10e4e61c3624eaa0941cd0n,
  0xffcb9843d60b6159c9db58835c926644n, 0xff973b41fa98c081472e6896dfb254c0n,
  0xff2ea16466c96a3843ec78b326b52861n, 0xfe5dee046a99a2a811c461f1969c3053n,
  0xfcbe86c7900a88aedcffc83b479aa3a4n, 0xf987a7253ac413176f2b074cf7815e54n,
  0xf3392b0822b70005940c7a398e4b70f3n, 0xe7159475a2c29b7443b29c7fa6e889d9n,
  0xd097f3bdfd2022b8845ad8f792aa5825n, 0xa9f746462d870fdf8a65dc1f90e061e5n,
  0x70d869a156d2a1b890bb3df62baf32f7n, 0x31be135f97d08fd981231505542fcfa6n,
  0x9aa508b5b7a84e1c677de54f3e99bc9n, 0x5d6af8dedb81196699c329225ee604n,
  0x2216e584f5fa1ea926041bedfe98n, 0x48a170391f7dc42444e8fa2n,
];

function usage() {
  console.log(`Usage: npm run genesis:fork

Runs the complete CCA/LBP -> v4 oracle -> keeper faults -> bond rehearsal against a disposable
Anvil fork of Robinhood Chain mainnet. Evidence is written below .audit/genesis-fork-rehearsal/.

Optional environment:
  ROBINHOOD_FORK_RPC_URL   HTTPS chain-4663 state RPC (default: public Robinhood RPC)
  FOUNDRY_BIN             Directory containing forge and anvil

The command refuses a non-HTTPS upstream, a non-4663 chain, changed pinned bytecode, and any
non-loopback mutation target. It never accepts a production private key.`);
}
if (process.argv.includes('--help') || process.argv.includes('-h')) { usage(); process.exit(0); }
if (process.argv.length !== 2) { usage(); process.exit(1); }

const json = (value) => JSON.stringify(value, (_key, item) => {
  if (typeof item === 'bigint') return item.toString();
  if (item instanceof Date) return item.toISOString();
  return item;
}, 2) + '\n';
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const topicAddress = (topic) => getAddress(`0x${topic.slice(-40)}`);

function artifact(source, contract) {
  const file = path.join(contractsRoot, 'out', `${source}.sol`, `${contract}.json`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed.bytecode?.object || parsed.bytecode.object === '0x') throw new Error(`missing bytecode in ${file}`);
  return { abi: parsed.abi, bytecode: parsed.bytecode.object, deployedBytecode: parsed.deployedBytecode?.object };
}
function foundryExecutable(name) {
  const filename = process.platform === 'win32' ? `${name}.exe` : name;
  if (process.env.FOUNDRY_BIN) return path.join(process.env.FOUNDRY_BIN, filename);
  const homeInstall = path.join(os.homedir(), '.foundry', 'bin', filename);
  return fs.existsSync(homeInstall) ? homeInstall : filename;
}
async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}
async function waitForRpc(url, child) {
  const probe = createPublicClient({ transport: http(url, { timeout: 2_000, retryCount: 0 }) });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`Anvil exited during startup (code ${child.exitCode})`);
    try {
      await probe.getChainId();
      return createPublicClient({ transport: http(url, { timeout: 180_000, retryCount: 0 }) });
    } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Anvil did not expose its loopback RPC within 60 seconds');
}
function receiptEvidence(label, receipt) {
  return {
    label, transactionHash: receipt.transactionHash, blockHash: receipt.blockHash,
    blockNumber: receipt.blockNumber, status: receipt.status, from: receipt.from, to: receipt.to,
    contractAddress: receipt.contractAddress, cumulativeGasUsed: receipt.cumulativeGasUsed,
    gasUsed: receipt.gasUsed, effectiveGasPrice: receipt.effectiveGasPrice,
    logs: receipt.logs.map((log) => ({ address: log.address, logIndex: log.logIndex, topics: log.topics, data: log.data })),
  };
}
function compactHealth(label, health) {
  return {
    label, state: health.state, alert: health.alert, oracleAddress: health.oracleAddress,
    baselineS: health.baselineS, chainNowS: health.chainNowS, elapsedS: health.elapsedS,
    dueInS: health.dueInS, ageS: health.ageS, periodS: health.periodS,
    maxWindowS: health.maxWindowS, priceAverage: health.priceAverage,
    lastUpdateS: health.lastUpdateS, updateEligible: health.updateEligible, note: health.note,
  };
}
function signedFloorDiv(numerator, denominator) {
  assert(denominator > 0n, 'positive denominator required');
  let quotient = numerator / denominator;
  if (numerator < 0n && numerator % denominator !== 0n) quotient--;
  return quotient;
}
function sqrtPriceAtTick(tick) {
  const signedTick = BigInt(tick);
  const absTick = signedTick < 0n ? -signedTick : signedTick;
  if (absTick > 887272n) throw new Error(`tick ${tick} is outside TickMath bounds`);
  let ratio = (absTick & 1n) !== 0n ? TICK_MULTIPLIERS[0] : 1n << 128n;
  for (let i = 1; i < TICK_MULTIPLIERS.length; i++) {
    if ((absTick & (1n << BigInt(i))) !== 0n) ratio = (ratio * TICK_MULTIPLIERS[i]) >> 128n;
  }
  if (signedTick > 0n) ratio = maxUint256 / ratio;
  return (ratio + ((1n << 32n) - 1n)) >> 32n;
}
function omrPerEthAtTick(tick) {
  const sqrtPriceX96 = sqrtPriceAtTick(tick);
  return (sqrtPriceX96 * sqrtPriceX96 * 10n ** 18n) / (1n << 192n);
}
function wrapClients(base, controls) {
  const evidence = { signCount: 0, sendAttempts: [], receiptWaits: [] };
  const walletClient = new Proxy(base.walletClient, {
    get(target, property, receiver) {
      if (property === 'signTransaction') return async (...args) => {
        evidence.signCount++;
        return target.signTransaction(...args);
      };
      if (property === 'sendRawTransaction') return async (request) => {
        evidence.sendAttempts.push({ rawTx: request.serializedTransaction, hash: keccak256(request.serializedTransaction) });
        if (controls.failSends > 0) { controls.failSends--; throw new Error('injected send outage'); }
        return target.sendRawTransaction(request);
      };
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const publicClient = new Proxy(base.publicClient, {
    get(target, property, receiver) {
      if (property === 'waitForTransactionReceipt') return async (request) => {
        evidence.receiptWaits.push(request.hash);
        if (controls.receiptTimeouts > 0) { controls.receiptTimeouts--; throw new Error('injected receipt timeout'); }
        return target.waitForTransactionReceipt(request);
      };
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { clients: { ...base, publicClient, walletClient }, evidence };
}
async function journalDb() {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  await pool.query(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'));
  return pool;
}

async function run() {
  const startedAt = new Date();
  const runId = startedAt.toISOString().replace(/[:.]/g, '-');
  const evidenceDir = path.join(auditRoot, runId);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const forge = foundryExecutable('forge');
  const anvilPath = foundryExecutable('anvil');
  const build = spawnSync(forge, ['build'], { cwd: contractsRoot, stdio: 'pipe', encoding: 'utf8', windowsHide: true });
  if (build.status !== 0) throw new Error(`forge build failed:\n${build.stderr || build.stdout}`);

  const remoteUrl = new URL(forkRpc);
  if (remoteUrl.protocol !== 'https:') throw new Error('ROBINHOOD_FORK_RPC_URL must use HTTPS');
  const remote = createPublicClient({ transport: http(remoteUrl.toString(), { timeout: 20_000, retryCount: 2 }) });
  assert.equal(await remote.getChainId(), CHAIN_ID, 'upstream RPC must be chain 4663');
  const forkBlock = await remote.getBlock({ blockTag: 'latest' });
  const remoteCodeHashes = {};
  const pinned = {
    liquidityLauncher: ROBINHOOD_GENESIS_STACK.liquidityLauncher,
    lbpStrategy: ROBINHOOD_GENESIS_STACK.lbpStrategy,
    ccaFactory: ROBINHOOD_GENESIS_STACK.ccaFactory,
    permit2: ROBINHOOD_GENESIS_STACK.permit2,
    poolManager: ROBINHOOD_GENESIS_STACK.poolManager,
    positionManager: ROBINHOOD_GENESIS_STACK.positionManager,
  };
  for (const [name, address] of Object.entries(pinned)) {
    const code = await remote.getCode({ address, blockNumber: forkBlock.number });
    assert(code && code !== '0x', `${name} has no code at fork block`);
    remoteCodeHashes[name] = keccak256(code);
    assert.equal(remoteCodeHashes[name], ROBINHOOD_GENESIS_STACK.runtimeCodeHashes[name], `${name} code hash drift`);
  }

  const port = await freePort();
  const localRpc = `http://127.0.0.1:${port}`;
  const anvilArgs = [
    '--fork-url', remoteUrl.toString(), '--fork-block-number', forkBlock.number.toString(),
    '--fork-chain-id', String(CHAIN_ID), '--chain-id', String(CHAIN_ID),
    '--host', '127.0.0.1', '--port', String(port), '--auto-impersonate', '--balance', '1000000',
    '--gas-limit', '50000000', '--disable-code-size-limit', '--no-rate-limit', '--no-storage-caching', '--quiet',
  ];
  const anvil = spawn(anvilPath, anvilArgs, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let anvilDiagnostics = '';
  anvil.stderr.on('data', (chunk) => { anvilDiagnostics = `${anvilDiagnostics}${chunk}`.slice(-12_000); });
  let pool;
  const receipts = [];
  const healthSnapshots = [];
  const deployments = {};
  const faultEvidence = {};
  try {
    const publicClient = await waitForRpc(localRpc, anvil);
    assert.equal(await publicClient.getChainId(), CHAIN_ID, 'local fork must retain chain ID 4663');
    assert.equal(new URL(localRpc).hostname, '127.0.0.1', 'mutations must target loopback');
    const chain = defineChain({
      id: CHAIN_ID, name: 'Robinhood Chain fork rehearsal',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [localRpc] } },
    });
    const accounts = (await publicClient.request({ method: 'eth_accounts' }))
      .map((address) => getAddress(address.toLowerCase()));
    assert(accounts.length >= 10, 'Anvil did not expose ten disposable accounts');
    const [safe, treasury, vig, founder, positionRecipient, bidder, trader, pol, rwa, bonder] = accounts;
    const localTransport = () => http(localRpc, { timeout: 180_000, retryCount: 0 });
    const safeWallet = createWalletClient({ account: safe, chain, transport: localTransport() });
    const bidderWallet = createWalletClient({ account: bidder, chain, transport: localTransport() });
    const traderWallet = createWalletClient({ account: trader, chain, transport: localTransport() });
    const bonderWallet = createWalletClient({ account: bonder, chain, transport: localTransport() });

    const rpc = (method, params = []) => publicClient.request({ method, params });
    async function wait(hash, label) {
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 60_000 });
      assert.equal(receipt.status, 'success', `${label} reverted`);
      receipts.push(receiptEvidence(label, receipt));
      return receipt;
    }
    async function deploy(label, art, args, wallet = safeWallet) {
      const hash = await wallet.deployContract({ abi: art.abi, bytecode: art.bytecode, args, account: wallet.account, gas: 40_000_000n });
      const receipt = await wait(hash, `deploy:${label}`);
      assert(receipt.contractAddress, `${label} deployment returned no address`);
      deployments[label] = getAddress(receipt.contractAddress);
      return deployments[label];
    }
    async function send(label, wallet, request) {
      const hash = await wallet.sendTransaction({ account: wallet.account, gas: 40_000_000n, ...request });
      return wait(hash, label);
    }
    async function write(label, wallet, request) {
      const hash = await wallet.writeContract({ account: wallet.account, gas: 40_000_000n, ...request });
      return wait(hash, label);
    }
    const chainBlockNumberish = () => publicClient.readContract({ address: ARBSYS, abi: ARBSYS_ABI, functionName: 'arbBlockNumber' });
    async function mineToBlock(target) {
      const current = await chainBlockNumberish();
      assert(target >= current, `cannot mine backwards from ${current} to ${target}`);
      if (target > current) await rpc('anvil_mine', [toHex(target - current)]);
    }
    async function advanceOracleTo(oracle, oracleAbi, elapsed) {
      const baseline = Number(await publicClient.readContract({ address: oracle, abi: oracleAbi, functionName: 'blockTimestampLast' }));
      const block = await publicClient.getBlock({ blockTag: 'latest' });
      const delta = baseline + elapsed - Number(block.timestamp);
      if (delta > 0) await rpc('evm_increaseTime', [delta]);
      await rpc('evm_mine');
    }

    // Anvil forks state but does not emulate ArbSys. Record this sole local runtime substitution.
    const shim = artifact('ForkArbSysShim', 'ForkArbSysShim');
    assert(shim.deployedBytecode && shim.deployedBytecode !== '0x', 'missing ArbSys shim runtime');
    await rpc('anvil_setCode', [ARBSYS, shim.deployedBytecode]);
    const shimCode = await publicClient.getCode({ address: ARBSYS });
    assert.equal(await chainBlockNumberish(), await publicClient.getBlockNumber(), 'ArbSys shim must mirror block.number');

    const omrArt = artifact('OMR', 'OMR');
    const hookArt = artifact('OmertaHook', 'OmertaHook');
    const splitterArt = artifact('GenesisProceedsSplitter', 'GenesisProceedsSplitter');
    const oracleArt = artifact('OmrV4TwapOracle', 'OmrV4TwapOracle');
    const bondArt = artifact('OmertaBond', 'OmertaBond');
    const swapRouterArt = artifact('PoolSwapTest', 'PoolSwapTest');

    const omr = await deploy('OMR', omrArt, [safe]);
    const constructorArgs = encodeAbiParameters(
      [{ type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'address' }],
      [ROBINHOOD_GENESIS_STACK.poolManager, omr, safe, ROBINHOOD_GENESIS_STACK.lbpStrategy],
    );
    const hookInitCode = concatHex([hookArt.bytecode, constructorArgs]);
    const hookInitHash = keccak256(hookInitCode);
    let hook;
    let hookSalt;
    for (let i = 0; i < MAX_HOOK_SALT_ATTEMPTS; i++) {
      const salt = toHex(i, { size: 32 });
      const candidate = getCreate2Address({ from: CREATE2_DEPLOYER, salt, bytecodeHash: hookInitHash });
      if ((BigInt(candidate) & HOOK_MASK) !== HOOK_FLAGS || candidate.slice(2, 4).toLowerCase() === '91') continue;
      if (await publicClient.getCode({ address: candidate })) continue;
      hook = candidate; hookSalt = salt; break;
    }
    assert(hook && hookSalt, 'no valid hook salt found in 200,000 attempts');
    await send('deploy:OmertaHook:create2', safeWallet, {
      to: CREATE2_DEPLOYER, data: concatHex([hookSalt, hookInitCode]), value: 0n,
    });
    assert(await publicClient.getCode({ address: hook }), 'mined hook has no runtime code');
    deployments.OmertaHook = hook;
    assert.equal(BigInt(hook) & HOOK_MASK, HOOK_FLAGS, 'hook address flags mismatch');
    assert.equal(BigInt(await publicClient.readContract({ address: hook, abi: hookArt.abi, functionName: 'HOOK_FLAGS' })), HOOK_FLAGS);
    assert.equal(getAddress(await publicClient.readContract({ address: hook, abi: hookArt.abi, functionName: 'authorized' })), ROBINHOOD_GENESIS_STACK.lbpStrategy);
    const initializerInterface = toFunctionSelector('authorized()');
    assert(await publicClient.readContract({ address: hook, abi: hookArt.abi, functionName: 'supportsInterface', args: [initializerInterface] }));
    assert(await publicClient.readContract({ address: hook, abi: hookArt.abi, functionName: 'supportsInterface', args: [V4_OBSERVATION_SOURCE_INTERFACE_ID] }));
    let directCallbackRejected = false;
    try {
      await publicClient.call({
        account: safe, to: hook,
        data: encodeFunctionData({
          abi: hookArt.abi, functionName: 'beforeInitialize',
          args: [safe, { currency0: ZERO, currency1: omr, fee: 3_000, tickSpacing: 60, hooks: hook }, 1n],
        }),
      });
    } catch { directCallbackRejected = true; }
    assert(directCallbackRejected, 'hook callback accepted a direct non-PoolManager caller');

    const poolId = canonicalGenesisPoolId({ token: omr, hook });
    const splitter = await deploy('GenesisProceedsSplitter', splitterArt, [
      ROBINHOOD_GENESIS_STACK.poolManager, poolId, treasury, vig, founder,
    ]);
    const swapRouter = await deploy('PoolSwapTest', swapRouterArt, [ROBINHOOD_GENESIS_STACK.poolManager]);
    await write('prepare:fund-trader-omr', safeWallet, {
      address: omr, abi: ERC20_ABI, functionName: 'transfer', args: [trader, parseEther('100000')],
    });
    await write('prepare:trader-approve-swap-router', traderWallet, {
      address: omr, abi: ERC20_ABI, functionName: 'approve', args: [swapRouter, maxUint256],
    });

    const clockNow = await chainBlockNumberish();
    const launchBlock = await publicClient.getBlock({ blockTag: 'latest' });
    const genesisInput = {
      token: omr, launchOwner: safe, treasury, vigRecipient: vig, founderRecipient: founder,
      proceedsSplitter: splitter, positionRecipient, hook,
      salt: keccak256(stringToHex(`omerta-fork-${forkBlock.number}-${omr}`)),
      // Block time is deliberately compressed for the fork; supply-MPS and migration invariants are
      // unchanged. Production block counts still come from the separately measured 72h/24h cadence.
      startBlock: (clockNow + 12n).toString(), auctionBlocks: '24', prebidBlocks: '0',
      claimDelayBlocks: '12', permit2Expiration: (launchBlock.timestamp + 86_400n).toString(),
      requiredCurrencyRaised: parseEther('10').toString(),
    };
    const launch = buildGenesisLaunchArtifacts(genesisInput);
    for (const [index, transaction] of launch.safeTransactions.prepare.entries()) {
      await send(`prepare:${index + 1}`, safeWallet, { to: transaction.to, data: transaction.data, value: transaction.value });
    }
    const stackPreflight = await verifyRobinhoodGenesisStack(publicClient, { representativeRaise: launch.graduation.requiredCurrencyRaised });
    const readinessPreflight = await verifyGenesisLaunchReadiness(publicClient, launch);
    const launchReceipt = await send('launch:liquidity-launcher-multicall', safeWallet, {
      to: launch.safeTransactions.launch.to, data: launch.safeTransactions.launch.data,
      value: launch.safeTransactions.launch.value,
    });
    const initializerLog = launchReceipt.logs.find((log) => (
      log.address.toLowerCase() === ROBINHOOD_GENESIS_STACK.lbpStrategy.toLowerCase()
      && log.topics[0]?.toLowerCase() === TOPICS.initializerCreated.toLowerCase()
    ));
    assert(initializerLog?.topics[1], 'LBPStrategy.InitializerCreated was not emitted');
    const initializer = topicAddress(initializerLog.topics[1]);
    deployments.CCAInitializer = initializer;

    await mineToBlock(launch.timeline.startBlock);
    // CCA requires every bid's maximum to be strictly above the current clearing price. The first
    // aligned tick is the smallest admissible bid ceiling; the auction can still clear at its floor.
    const bidMaxPriceQ96 = launch.pricing.floorPrice + launch.pricing.tickSpacing;
    await write('auction:submit-12-eth-first-tick-bid', bidderWallet, {
      address: initializer, abi: SUBMIT_BID_ABI, functionName: 'submitBid',
      args: [bidMaxPriceQ96, parseEther('12'), bidder, '0x'], value: parseEther('12'),
    });
    await mineToBlock(launch.timeline.endBlock + 1n);
    await write('auction:final-checkpoint', bidderWallet, {
      address: initializer, abi: CCA_ABI, functionName: 'checkpoint', args: [],
    });
    const auctionState = {
      graduated: await publicClient.readContract({ address: initializer, abi: CCA_ABI, functionName: 'isGraduated' }),
      clearingPriceQ96: await publicClient.readContract({ address: initializer, abi: CCA_ABI, functionName: 'clearingPrice' }),
      currencyRaised: await publicClient.readContract({ address: initializer, abi: CCA_ABI, functionName: 'currencyRaised' }),
      totalCleared: await publicClient.readContract({ address: initializer, abi: CCA_ABI, functionName: 'totalCleared' }),
    };
    assert.equal(auctionState.graduated, true, 'CCA did not graduate');
    assert(auctionState.currencyRaised >= parseEther('10'), 'CCA raise is below graduation minimum');

    const migrationReceipt = await write('migration:lbp-migrate', bidderWallet, {
      address: ROBINHOOD_GENESIS_STACK.lbpStrategy, abi: LBP_ABI, functionName: 'migrate', args: [initializer],
    });
    const migrationTopics = migrationReceipt.logs.map((log) => log.topics[0]?.toLowerCase());
    assert(migrationTopics.includes(TOPICS.migrated.toLowerCase()), 'Migrated was not emitted');
    assert(!migrationTopics.includes(TOPICS.migrationFailed.toLowerCase()), 'MigrationFailed was emitted');
    assert(!migrationTopics.includes(TOPICS.fundsRecovered.toLowerCase()), 'FundsRecovered was emitted');
    assert.equal(await publicClient.readContract({
      address: splitter, abi: splitterArt.abi, functionName: 'canonicalPoolInitialized',
    }), true, 'canonical pool is not initialized');
    const accumulator = await publicClient.readContract({
      address: hook, abi: hookArt.abi, functionName: 'currentTickCumulative', args: [poolId],
    });
    assert.equal(accumulator[2], true, 'hook accumulator is not initialized');
    const zeroTopic = toHex(0n, { size: 32 }).toLowerCase();
    const positionLog = migrationReceipt.logs.find((log) => (
      log.address.toLowerCase() === ROBINHOOD_GENESIS_STACK.positionManager.toLowerCase()
      && log.topics[0]?.toLowerCase() === TOPICS.erc721Transfer.toLowerCase()
      && log.topics[1]?.toLowerCase() === zeroTopic
    ));
    assert(positionLog?.topics[3], 'migration did not mint a position NFT');
    const positionTokenId = BigInt(positionLog.topics[3]);
    const positionOwner = getAddress(await publicClient.readContract({
      address: ROBINHOOD_GENESIS_STACK.positionManager, abi: POSITION_ABI,
      functionName: 'ownerOf', args: [positionTokenId],
    }));
    assert.equal(positionOwner, positionRecipient, 'position NFT owner mismatch');
    await write('migration:distribute-residual', bidderWallet, {
      address: splitter, abi: splitterArt.abi, functionName: 'distributeResidual', args: [],
    });

    const oracle = await deploy('OmrV4TwapOracle', oracleArt, [hook, omr, 3_000, 60, PERIOD]);
    await write('oracle:set-hook-observer', safeWallet, {
      address: hook, abi: hookArt.abi, functionName: 'setObserver', args: [oracle],
    });
    assert.equal(getAddress(await publicClient.readContract({ address: hook, abi: hookArt.abi, functionName: 'observer' })), oracle);

    const keeperKey = generatePrivateKey();
    const keeperAccount = privateKeyToAccount(keeperKey);
    await rpc('anvil_setBalance', [keeperAccount.address, toHex(parseEther('100'))]);
    const keeperConfig = {
      rpcUrl: localRpc, chainId: CHAIN_ID, oracleAddress: oracle, bondAddress: null,
      privateKey: keeperKey, confirmations: 1, timeoutMs: 5_000, leaseMs: 60_000,
    };
    const keeperClients = {
      publicClient: createPublicClient({ chain, transport: localTransport(), cacheTime: 0 }),
      walletClient: createWalletClient({ account: keeperAccount, chain, transport: localTransport() }),
      account: keeperAccount,
    };
    pool = await journalDb();
    let health = await v4OracleHealth(pool, { config: keeperConfig, clients: keeperClients, keeperConfigured: true });
    healthSnapshots.push(compactHealth('03-warming', health));
    assert.equal(health.state, 'warming');
    let earlyUpdateRejected = false;
    try {
      await keeperClients.publicClient.simulateContract({ address: oracle, abi: oracleArt.abi, functionName: 'update', account: keeperAccount });
    } catch { earlyUpdateRejected = true; }
    assert(earlyUpdateRejected, 'oracle accepted an early update');
    await advanceOracleTo(oracle, oracleArt.abi, PERIOD);
    health = await v4OracleHealth(pool, { config: keeperConfig, clients: keeperClients, keeperConfigured: true });
    healthSnapshots.push(compactHealth('03-due', health));
    assert.equal(health.state, 'due');
    const initialUpdate = await runV4OracleKeeper(pool, { config: keeperConfig, clients: keeperClients });
    healthSnapshots.push(compactHealth('03-healthy', initialUpdate.health));
    assert.equal(initialUpdate.action, 'confirmed');
    assert.equal(initialUpdate.health.state, 'healthy');

    await advanceOracleTo(oracle, oracleArt.abi, PERIOD);
    const sendFault = wrapClients(keeperClients, { failSends: 1, receiptTimeouts: 0 });
    const sendFailed = await runV4OracleKeeper(pool, { config: keeperConfig, clients: sendFault.clients });
    const sendRecovered = await runV4OracleKeeper(pool, { config: keeperConfig, clients: sendFault.clients });
    assert.equal(sendFailed.action, 'prepared');
    assert.equal(sendRecovered.action, 'confirmed');
    assert.equal(sendFault.evidence.signCount, 1);
    assert.equal(sendFault.evidence.sendAttempts.length, 2);
    assert.equal(sendFault.evidence.sendAttempts[0].rawTx, sendFault.evidence.sendAttempts[1].rawTx);
    assert.equal(sendFault.evidence.sendAttempts[0].hash, sendFault.evidence.sendAttempts[1].hash);
    faultEvidence.sendOutage = {
      firstAction: sendFailed.action, recoveryAction: sendRecovered.action,
      signCount: 1, rawTxEqual: true, hashEqual: true,
      rawTx: sendFault.evidence.sendAttempts[0].rawTx, txHash: sendFault.evidence.sendAttempts[0].hash,
    };

    await advanceOracleTo(oracle, oracleArt.abi, PERIOD);
    const receiptFault = wrapClients(keeperClients, { failSends: 0, receiptTimeouts: 1 });
    const receiptPending = await runV4OracleKeeper(pool, { config: keeperConfig, clients: receiptFault.clients });
    const receiptRecovered = await runV4OracleKeeper(pool, { config: keeperConfig, clients: receiptFault.clients });
    assert.equal(receiptPending.action, 'pending');
    assert.equal(receiptRecovered.action, 'confirmed');
    assert.equal(receiptFault.evidence.signCount, 1);
    assert.equal(receiptFault.evidence.sendAttempts.length, 1);
    assert.equal(receiptFault.evidence.receiptWaits[0], receiptFault.evidence.receiptWaits[1]);
    faultEvidence.receiptTimeout = {
      firstAction: receiptPending.action, recoveryAction: receiptRecovered.action,
      signCount: 1, sendCount: 1, watchedSameHash: true, txHash: receiptFault.evidence.receiptWaits[0],
    };

    await advanceOracleTo(oracle, oracleArt.abi, PERIOD * 2 + 1);
    const keeperLate = await v4OracleHealth(pool, { config: keeperConfig, clients: keeperClients, keeperConfigured: true });
    healthSnapshots.push(compactHealth('05-keeper-late', keeperLate));
    assert.equal(keeperLate.state, 'keeper_late');
    const actualLate = await readV4OracleSnapshot(keeperConfig, keeperClients.publicClient);
    const stale = classifyV4OracleHealth({ ...actualLate, keeperConfigured: true, maxOracleAgeS: PERIOD });
    healthSnapshots.push(compactHealth('05-stale-at-600s-max-age', stale));
    assert.equal(stale.state, 'stale');
    await advanceOracleTo(oracle, oracleArt.abi, PERIOD * MAX_WINDOW_MULT + 1);
    const overlong = await v4OracleHealth(pool, { config: keeperConfig, clients: keeperClients, keeperConfigured: true });
    healthSnapshots.push(compactHealth('05-rebaselining', overlong));
    assert.equal(overlong.state, 'rebaselining');
    const rebaseline = await runV4OracleKeeper(pool, { config: keeperConfig, clients: keeperClients });
    healthSnapshots.push(compactHealth('06-after-discard-warming', rebaseline.health));
    assert.equal(rebaseline.action, 'confirmed');
    assert.equal(rebaseline.health.state, 'warming');
    assert.equal(rebaseline.health.priceAverage, '0');

    // The recovery window contains a real v4 swap, giving two historical tick segments to rebuild.
    const baselineCumulative = BigInt(await publicClient.readContract({ address: oracle, abi: oracleArt.abi, functionName: 'tickCumulativeLast' }));
    const baselineTimestamp = Number(await publicClient.readContract({ address: oracle, abi: oracleArt.abi, functionName: 'blockTimestampLast' }));
    await advanceOracleTo(oracle, oracleArt.abi, Math.floor(PERIOD / 2));
    const beforeSwap = await publicClient.readContract({ address: hook, abi: hookArt.abi, functionName: 'currentTickCumulative', args: [poolId] });
    const poolKey = { currency0: ZERO, currency1: omr, fee: 3_000, tickSpacing: 60, hooks: hook };
    await write('oracle-window:real-v4-buy', traderWallet, {
      address: swapRouter, abi: swapRouterArt.abi, functionName: 'swap',
      args: [
        poolKey,
        { zeroForOne: true, amountSpecified: -parseEther('0.05'), sqrtPriceLimitX96: 4_295_128_740n },
        { takeClaims: false, settleUsingBurn: false }, '0x',
      ], value: parseEther('0.05'),
    });
    const afterSwap = await publicClient.readContract({ address: hook, abi: hookArt.abi, functionName: 'currentTickCumulative', args: [poolId] });
    await advanceOracleTo(oracle, oracleArt.abi, PERIOD);
    const honestUpdate = await runV4OracleKeeper(pool, { config: keeperConfig, clients: keeperClients });
    healthSnapshots.push(compactHealth('06-recovered-healthy', honestUpdate.health));
    assert.equal(honestUpdate.action, 'confirmed');
    assert.equal(honestUpdate.health.state, 'healthy');
    const endCumulative = BigInt(await publicClient.readContract({ address: oracle, abi: oracleArt.abi, functionName: 'tickCumulativeLast' }));
    const endTimestamp = Number(await publicClient.readContract({ address: oracle, abi: oracleArt.abi, functionName: 'blockTimestampLast' }));
    const publishedTick = Number(await publicClient.readContract({ address: oracle, abi: oracleArt.abi, functionName: 'arithmeticMeanTick' }));
    const publishedPrice = BigInt(await publicClient.readContract({ address: oracle, abi: oracleArt.abi, functionName: 'priceAverage' }));
    const elapsed = BigInt(endTimestamp - baselineTimestamp);
    const reconstructedTick = Number(signedFloorDiv(endCumulative - baselineCumulative, elapsed));
    const reconstructedPrice = omrPerEthAtTick(reconstructedTick);
    assert.equal(reconstructedTick, publishedTick, 'historical tick reconstruction mismatch');
    assert.equal(reconstructedPrice, publishedPrice, 'independent price reconstruction mismatch');
    assert(publishedPrice > 10n ** 18n, 'OMR/ETH orientation appears inverted');
    const reconstruction = {
      poolId,
      baseline: { tickCumulative: baselineCumulative, timestamp: baselineTimestamp },
      beforeSwap: { tickCumulative: beforeSwap[0], timestamp: beforeSwap[1] },
      afterSwap: { tickCumulative: afterSwap[0], timestamp: afterSwap[1] },
      end: { tickCumulative: endCumulative, timestamp: endTimestamp },
      inferredPreSwapTick: signedFloorDiv(BigInt(afterSwap[0]) - baselineCumulative, BigInt(Number(afterSwap[1]) - baselineTimestamp)),
      inferredPostSwapTick: signedFloorDiv(endCumulative - BigInt(afterSwap[0]), BigInt(endTimestamp - Number(afterSwap[1]))),
      elapsedSeconds: elapsed, reconstructedMeanTick: reconstructedTick, publishedMeanTick: publishedTick,
      reconstructedOmrPerEthWei: reconstructedPrice, publishedOmrPerEthWei: publishedPrice,
      ethPerOmrWad: 10n ** 36n / publishedPrice,
      orientation: 'currency1/currency0 = OMR-wei per ETH-wei; scaled to 18-decimal OMR per native ETH',
      exactMatch: true,
    };

    const quoteKey = generatePrivateKey();
    const quoteSigner = privateKeyToAccount(quoteKey);
    const bond = await deploy('OmertaBond', bondArt, [
      safe, quoteSigner.address, omr, 5_000n, 2_000n, 1_000n,
      pol, founder, rwa, vig, parseEther('10000'), publishedPrice * 2n,
    ]);
    await write('bond:set-v4-oracle', safeWallet, {
      address: bond, abi: bondArt.abi, functionName: 'setOracle', args: [oracle, 500n, 1_800n],
    });
    await write('bond:arm-omr-minter-last', safeWallet, {
      address: omr, abi: omrArt.abi, functionName: 'setMinter', args: [bond],
    });
    assert.equal(getAddress(await publicClient.readContract({ address: bond, abi: bondArt.abi, functionName: 'oracle' })), oracle);
    const activatedKeeperConfig = { ...keeperConfig, bondAddress: bond };
    const activatedHealth = await v4OracleHealth(pool, { config: activatedKeeperConfig, clients: keeperClients, keeperConfigured: true });
    healthSnapshots.push(compactHealth('08-bond-oracle-aligned', activatedHealth));
    assert.equal(activatedHealth.state, 'healthy');
    const bondBlock = await publicClient.getBlock({ blockTag: 'latest' });
    const principal = parseEther('0.001');
    const quote = {
      payer: bonder, principal, priceOmrPerEth: publishedPrice, discountBps: 0n,
      vestSeconds: 86_400n, nonce: 1n, deadline: bondBlock.timestamp + 3_600n,
    };
    const signature = await quoteSigner.signTypedData({
      domain: { name: 'OmertaBond', version: '1', chainId: CHAIN_ID, verifyingContract: bond },
      primaryType: 'BondQuote',
      types: { BondQuote: [
        { name: 'payer', type: 'address' }, { name: 'principal', type: 'uint256' },
        { name: 'priceOmrPerEth', type: 'uint256' }, { name: 'discountBps', type: 'uint256' },
        { name: 'vestSeconds', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ] }, message: quote,
    });
    const supplyBefore = BigInt(await publicClient.readContract({ address: omr, abi: ERC20_ABI, functionName: 'totalSupply' }));
    const bondReceipt = await write('bond:low-value-settlement', bonderWallet, {
      address: bond, abi: bondArt.abi, functionName: 'bond', args: [quote, signature], value: principal,
    });
    const supplyAfter = BigInt(await publicClient.readContract({ address: omr, abi: ERC20_ABI, functionName: 'totalSupply' }));
    const expectedPayout = principal * publishedPrice / 10n ** 18n;
    assert.equal(supplyAfter - supplyBefore, expectedPayout, 'bond minted an unexpected amount');
    assert.equal(await publicClient.getBalance({ address: bond }), 0n, 'bond retained ETH');

    const journalRows = (await pool.query(
      `SELECT oracle_address, baseline_timestamp, status, tx_hash, raw_tx, nonce,
              claimed_at, sent_at, confirmed_at, last_error
         FROM v4_oracle_keeper_attempts ORDER BY baseline_timestamp`,
    )).rows;
    assert(journalRows.some((row) => row.tx_hash === faultEvidence.sendOutage.txHash && row.status === 'confirmed'));
    assert(journalRows.some((row) => row.tx_hash === faultEvidence.receiptTimeout.txHash && row.status === 'confirmed'));

    const evidence = {
      ok: true, startedAt, completedAt: new Date(),
      safety: {
        mutationRpc: localRpc, mutationTargetLoopback: true, upstreamRpcOrigin: remoteUrl.origin,
        upstreamReadOnly: true, productionTransactionsBroadcast: 0, productionKeysRead: 0,
        secretsPersisted: false,
        blockNumberishShim: {
          reason: 'Anvil does not emulate Robinhood ArbSys address(100); pinned CCA/LBP bytecode is unchanged.',
          address: ARBSYS, runtimeCodeHash: keccak256(shimCode),
        },
      },
      toolchain: { foundryBuild: 'passed', node: process.version },
      fork: {
        chainId: CHAIN_ID, blockNumber: forkBlock.number, blockHash: forkBlock.hash,
        timestamp: forkBlock.timestamp, pinnedRuntimeCodeHashes: remoteCodeHashes,
      },
      participants: { safe, treasury, vig, founder, positionRecipient, bidder, trader, pol, rwa, bonder, keeper: keeperAccount.address },
      deployments,
      hookSecurity: {
        create2Salt: hookSalt, flags: toHex(HOOK_FLAGS), directNonPoolManagerCallbackRejected: true,
        initializerInterface, observationSourceInterface: V4_OBSERVATION_SOURCE_INTERFACE_ID,
      },
      genesis: {
        inputSha256: sha256(json(genesisInput)), initializer, poolId, auctionState,
        timingMode: 'compressed fork blocks; production 72h/24h derivation is not reused',
        bidMaxPriceQ96, positionTokenId, positionOwner, migrationSucceeded: true, migrationFailureEvents: 0,
        residualDistributed: true,
      },
      oracle: {
        address: oracle, observerReadback: oracle, directWorkerAddress: oracle,
        periodSeconds: PERIOD, maxWindowMultiple: MAX_WINDOW_MULT, earlyUpdateRejected,
      },
      bond: {
        address: bond, oracle, principalWei: principal, oraclePriceOmrPerEthWei: publishedPrice,
        expectedAndMintedPayoutWei: expectedPayout, transactionHash: bondReceipt.transactionHash,
        retainedEthWei: 0,
      },
    };
    const files = {
      'evidence.json': json(evidence),
      'genesis-input.json': json(genesisInput),
      'preflight.json': json({ ok: true, stack: stackPreflight, readiness: readinessPreflight }),
      'receipts.json': json(receipts),
      'health-snapshots.json': json(healthSnapshots),
      'keeper-journal.json': json(journalRows),
      'fault-evidence.json': json(faultEvidence),
      'price-reconstruction.json': json(reconstruction),
    };
    for (const [name, contents] of Object.entries(files)) fs.writeFileSync(path.join(evidenceDir, name), contents);
    fs.writeFileSync(path.join(evidenceDir, 'SHA256SUMS'),
      Object.entries(files).map(([name, contents]) => `${sha256(contents)}  ${name}`).join('\n') + '\n');
    console.log(json({
      ok: true, evidenceDir, forkBlock: forkBlock.number, initializer, poolId, oracle, bond,
      healthStates: healthSnapshots.map((item) => item.state), reconstructedPriceExact: true,
      lowValueBondTx: bondReceipt.transactionHash,
    }));
    return evidenceDir;
  } catch (error) {
    fs.writeFileSync(path.join(evidenceDir, 'failure.json'), json({
      ok: false, failedAt: new Date(), error: String(error?.stack || error),
      forkBlock: forkBlock.number, receipts, healthSnapshots, faultEvidence, deployments,
      anvilDiagnostics: anvilDiagnostics.replaceAll(remoteUrl.toString(), '<redacted-upstream-rpc>'),
    }));
    throw Object.assign(error, { evidenceDir });
  } finally {
    if (pool) await pool.end();
    anvil.kill();
  }
}

run().catch((error) => {
  console.error(`Genesis fork rehearsal failed${error.evidenceDir ? `; partial evidence: ${error.evidenceDir}` : ''}:`);
  console.error(String(error?.message || error));
  process.exitCode = 1;
});
