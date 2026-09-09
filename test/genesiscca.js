import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicalJson, sha256Hex } from '../src/genesiscadence.js';
import { decodeFunctionData, keccak256 } from 'viem';
import {
  GENESIS_DISTRIBUTION_OMR,
  GENESIS_LP_RESERVE_OMR,
  GENESIS_SALE_OMR,
  MPS,
  Q96,
  ROBINHOOD_GENESIS_STACK,
  V4_OBSERVATION_SOURCE_INTERFACE_ID,
  GENESIS_WALLET_CAP_WEI,
  assertGenesisWalletCapPolicy,
  buildGenesisLaunchArtifacts,
  buildGenesisAuctionBinding,
  verifyGenesisAutomationReadiness,
  canonicalGenesisPoolId,
  encodeSupplySchedule,
  floorPriceConfig,
  generateSupplySchedule,
  validateSupplySchedule,
  verifyGenesisLaunchReadiness,
  verifyRobinhoodGenesisStack,
} from '../src/genesiscca.js';

const AUCTION_BLOCKS = 2_592_000; // 72h at Robinhood's current 100ms ArbSys cadence
const schedule = generateSupplySchedule({ auctionBlocks: AUCTION_BLOCKS });
const summary = validateSupplySchedule(schedule, AUCTION_BLOCKS);
assert.equal(summary.totalMps, MPS);
assert.equal(summary.totalBlocks, BigInt(AUCTION_BLOCKS));
assert.equal(schedule.length, 13, '12 convex steps plus one final block');
assert.equal(schedule.at(-1).blockDelta, 1);
assert(summary.finalMps >= 2_000_000n && summary.finalMps <= 4_000_000n);
assert.equal((encodeSupplySchedule(schedule).length - 2) / 2, schedule.length * 8);

const withPrebid = generateSupplySchedule({ auctionBlocks: 10_000, prebidBlocks: 500 });
assert.deepEqual(withPrebid[0], { mps: 0, blockDelta: 500 });
assert.equal(validateSupplySchedule(withPrebid, 10_500).totalMps, MPS);

assert.throws(
  () => validateSupplySchedule([{ mps: 9_999_999, blockDelta: 1 }, { mps: 1, blockDelta: 2 }], 3),
  /releases/,
);
assert.throws(() => generateSupplySchedule({ auctionBlocks: 12 }), /larger than/);

const price = floorPriceConfig();
assert.equal(price.rawFloorPrice, Q96 / 205_882n);
assert.equal(price.floorPrice % price.tickSpacing, 0n);
assert(price.floorPrice <= price.rawFloorPrice, 'floor rounding must never raise the configured minimum');

assert.equal(GENESIS_DISTRIBUTION_OMR, GENESIS_SALE_OMR + GENESIS_LP_RESERVE_OMR);
assert.equal(GENESIS_LP_RESERVE_OMR, GENESIS_SALE_OMR * 3_750n / 10_000n);
assert.equal(V4_OBSERVATION_SOURCE_INTERFACE_ID, '0xa4f7792a');

const input = {
  token: '0x1111111111111111111111111111111111111111',
  treasury: '0x2222222222222222222222222222222222222222',
  vigRecipient: '0x6666666666666666666666666666666666666666',
  founderRecipient: '0x7777777777777777777777777777777777777777',
  proceedsSplitter: '0x3333333333333333333333333333333333333333',
  positionRecipient: '0x4444444444444444444444444444444444444444',
  hook: '0x55555555555555555555555555555555555530cc',
  salt: `0x${'ab'.repeat(32)}`,
  startBlock: '50000000',
  auctionBlocks: String(AUCTION_BLOCKS),
  claimDelayBlocks: '864000', // 24h at the same measured cadence
  permit2Expiration: '1800000000',
};
const built = buildGenesisLaunchArtifacts(input);
const automatedInput = { ...input, launchMode: 'automated',
  lifecycleController: '0x8888888888888888888888888888888888888888',
  oracle: '0x9999999999999999999999999999999999999999',
  liquidityKeeper: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  walletCap: '0xcccccccccccccccccccccccccccccccccccccccc',
  runtimeCodeHashes: Object.fromEntries(['token', 'hook', 'proceedsSplitter', 'lifecycleController',
    'positionRecipient', 'oracle', 'walletCap'].map((name) => [name, keccak256('0x6000')])),
};
const controlled = buildGenesisLaunchArtifacts(automatedInput);
assertGenesisWalletCapPolicy(controlled);
assert.equal(controlled.initializerParameters.validationHook.toLowerCase(), automatedInput.walletCap);
assert.equal(controlled.walletCapPolicy.maxCommitmentWei, GENESIS_WALLET_CAP_WEI);
assert.throws(() => buildGenesisLaunchArtifacts({ ...automatedInput, walletCap: undefined }), /walletCap/);
assert.throws(() => buildGenesisLaunchArtifacts({ ...automatedInput, walletCap: `0x${'0'.repeat(40)}` }), /zero address/);
assert.throws(() => assertGenesisWalletCapPolicy(built), /current Genesis launches/);
assert.throws(() => assertGenesisWalletCapPolicy({ ...controlled, walletCapPolicy: { ...controlled.walletCapPolicy,
  maxCommitmentWei: 2n * GENESIS_WALLET_CAP_WEI } }), /1 ETH commitment/);
assert.equal(controlled.initializerParameters.tokensRecipient, '0x8888888888888888888888888888888888888888');
assert.equal(built.initializerParameters.tokensRecipient, input.treasury);
assert.deepEqual(controlled.migratorParameters, built.migratorParameters, 'automation changes unsold-token authority only');
assert.throws(() => buildGenesisLaunchArtifacts({ ...automatedInput, lifecycleController: 'invalid' }), /valid EVM address/);
assert.throws(() => buildGenesisLaunchArtifacts({ ...input, lifecycleController: automatedInput.lifecycleController }), /explicit launchMode/);
assert.throws(() => buildGenesisLaunchArtifacts({ ...automatedInput, oracle: undefined }), /oracle/);
assert.throws(() => buildGenesisLaunchArtifacts({ ...automatedInput, runtimeCodeHashes: {} }), /runtimeCodeHashes.token/);
assert.throws(() => buildGenesisLaunchArtifacts({ ...automatedInput,
  runtimeCodeHashes: { ...automatedInput.runtimeCodeHashes, oracle: `0x${'00'.repeat(32)}` } }), /cannot be zero/);
assert.equal(controlled.participants.lifecycleController, automatedInput.lifecycleController);
assert.equal(controlled.participants.tokensRecipient, automatedInput.lifecycleController);
assert.equal(controlled.automation.auctionBinding.status, 'requires_created_auction_verification');
assert.equal(built.initializerSalt, controlled.initializerSalt, 'the strategy salt binds the migration tuple');
assert.notEqual(built.initializerParams, controlled.initializerParams, 'unsold authority changes factory CREATE2 init code');
assert.equal(built.chainId, 4663);
assert.equal(built.stack.lbpStrategy, ROBINHOOD_GENESIS_STACK.lbpStrategy);
assert.equal(built.timeline.endBlock, 52_592_000n);
assert.equal(built.timeline.migrationBlock, 52_592_001n);
assert.equal(built.timeline.claimBlock, 53_456_000n);
assert.equal(built.initializerParameters.fundsRecipient, ROBINHOOD_GENESIS_STACK.lbpStrategy);
assert.equal(built.migratorParameters.reservedTokenAmountForLP, GENESIS_LP_RESERVE_OMR);
assert.equal(built.migratorParameters.recipient, input.proceedsSplitter);
assert.equal(built.migratorParameters.poolParameters.hook.toLowerCase(), input.hook.toLowerCase());
assert.equal(built.migratorParameters.poolParameters.fee, 3_000);
assert.equal(built.migratorParameters.poolParameters.tickSpacing, 60);
assert.equal(built.invariants.scheduleMps, MPS);
assert.equal(built.invariants.floorAligned, true);
assert.equal(built.safeTransactions.prepare.length, 3);
assert.equal(built.safeTransactions.launch.from, input.treasury);
assert.equal(built.participants.vigRecipient, input.vigRecipient);
assert.equal(built.calldataDigests.launchKeccak256, keccak256(built.safeTransactions.launch.data));

const outer = decodeFunctionData({
  abi: [{
    type: 'function', name: 'multicall', stateMutability: 'payable',
    inputs: [{ name: 'data', type: 'bytes[]' }], outputs: [{ name: 'results', type: 'bytes[]' }],
  }],
  data: built.safeTransactions.launch.data,
});
assert.equal(outer.functionName, 'multicall');
assert.equal(outer.args[0].length, 2, 'deposit and distribution must share one atomic multicall');

const stackClient = {
  getChainId: async () => ROBINHOOD_GENESIS_STACK.chainId,
  getBytecode: async () => '0x6000',
  getBlockNumber: async () => 12_345n,
  readContract: async ({ address, functionName }) => {
    if (address === ROBINHOOD_GENESIS_STACK.liquidityLauncher && functionName === 'permit2') {
      return ROBINHOOD_GENESIS_STACK.permit2;
    }
    if (address === ROBINHOOD_GENESIS_STACK.lbpStrategy && functionName === 'initializerFactory') {
      return ROBINHOOD_GENESIS_STACK.ccaFactory;
    }
    if (address === ROBINHOOD_GENESIS_STACK.lbpStrategy && functionName === 'poolManager') {
      return ROBINHOOD_GENESIS_STACK.poolManager;
    }
    if (address === ROBINHOOD_GENESIS_STACK.lbpStrategy && functionName === 'positionManager') {
      return ROBINHOOD_GENESIS_STACK.positionManager;
    }
    if (address === ROBINHOOD_GENESIS_STACK.ccaFactory && functionName === 'protocolFeeController') {
      return '0x0000000000000000000000000000000000000000';
    }
    throw new Error(`unexpected stack read: ${address} ${functionName}`);
  },
};
const stackReport = await verifyRobinhoodGenesisStack(stackClient, { verifyRuntimeHashes: false });
assert.equal(stackReport.checkedAtBlock, 12_345n);
assert.equal(stackReport.protocolFee.enabled, false);
assert.equal(stackReport.protocolFee.amount, 0n);

const expectedPoolId = canonicalGenesisPoolId({ token: input.token, hook: input.hook });
const readinessClient = {
  getBytecode: async () => '0x6000',
  getBlock: async () => ({ number: 12_346n, timestamp: 1_700_000_000n }),
  readContract: async ({ address, functionName }) => {
    if (address === input.token) {
      if (functionName === 'sellTaxBps') return 0n;
      if (functionName === 'balanceOf') return GENESIS_DISTRIBUTION_OMR;
      if (functionName === 'allowance') return GENESIS_DISTRIBUTION_OMR;
    }
    if (address === ROBINHOOD_GENESIS_STACK.permit2 && functionName === 'allowance') {
      // viem decodes Permit2's uint48 expiration as a number, unlike the bigint uint160 amount.
      return [GENESIS_DISTRIBUTION_OMR, Number(input.permit2Expiration), 7n];
    }
    if (address.toLowerCase() === input.hook.toLowerCase()) {
      if (functionName === 'owner') return input.treasury;
      if (functionName === 'poolManager') return ROBINHOOD_GENESIS_STACK.poolManager;
      if (functionName === 'omr') return input.token;
      if (functionName === 'authorized') return ROBINHOOD_GENESIS_STACK.lbpStrategy;
      if (functionName === 'HOOK_FLAGS') return 0x30ccn;
      if (functionName === 'sellTaxBps') return 0n;
      if (functionName === 'allowedQuote' || functionName === 'supportsInterface') return true;
    }
    if (address === input.proceedsSplitter) {
      if (functionName === 'poolManager') return ROBINHOOD_GENESIS_STACK.poolManager;
      if (functionName === 'canonicalPoolId') return expectedPoolId;
      if (functionName === 'canonicalPoolInitialized') return false;
      if (functionName === 'treasuryRecipient') return input.treasury;
      if (functionName === 'vigRecipient') return input.vigRecipient;
      if (functionName === 'founderRecipient') return input.founderRecipient;
    }
    throw new Error(`unexpected readiness read: ${address} ${functionName}`);
  },
};
await assert.rejects(() => verifyGenesisLaunchReadiness(readinessClient, built), /current Genesis launches/);

assert.throws(() => buildGenesisLaunchArtifacts({ ...input, hook: 'not-an-address' }), /valid EVM address/);
assert.throws(
  () => buildGenesisLaunchArtifacts({ ...input, hook: '0x5555555555555555555555555555555555555555' }),
  /permission flags/,
);
assert.throws(() => buildGenesisLaunchArtifacts({ ...input, claimDelayBlocks: '0' }), /claimBlock/);
assert.throws(() => buildGenesisLaunchArtifacts({ ...input, salt: '0x1234' }), /32 bytes/);
assert.throws(() => buildGenesisLaunchArtifacts({ ...input, vigRecipient: undefined }), /vigRecipient/);

const runtimeFixture = JSON.parse(fs.readFileSync(new URL('./fixtures/genesis-stack-runtime.json', import.meta.url)));
for (const [name, code] of Object.entries(runtimeFixture.runtime)) {
  assert.equal(keccak256(code), ROBINHOOD_GENESIS_STACK.runtimeCodeHashes[name], `fixture ${name} runtime remains pinned`);
}
const auctionAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const blockHash = `0x${'ab'.repeat(32)}`;
function automatedClient(options = {}) {
  const reads = [];
  const p = controlled.participants;
  const codes = Object.fromEntries(Object.entries(runtimeFixture.runtime).map(([name, code]) => [
    ROBINHOOD_GENESIS_STACK[name].toLowerCase(), code,
  ]));
  const runtimeHash = (name) => controlled.automation.runtimeCodeHashes[name] ?? ROBINHOOD_GENESIS_STACK.runtimeCodeHashes[name];
  const controllerReads = { owner: p.launchOwner, strategy: ROBINHOOD_GENESIS_STACK.lbpStrategy,
    splitter: p.proceedsSplitter, foundation: p.positionRecipient, oracle: p.oracle, omr: p.token,
    treasury: p.treasury, poolId: expectedPoolId, chainId: 4663n, stopped: false, failed: false,
    usesArbSys: true, auction: '0x0000000000000000000000000000000000000000', currentBlock: 49_999_999n,
    ...Object.fromEntries(Object.entries({ strategyCodeHash: 'lbpStrategy', splitterCodeHash: 'proceedsSplitter',
      foundationCodeHash: 'positionRecipient', oracleCodeHash: 'oracle', omrCodeHash: 'token',
      poolManagerCodeHash: 'poolManager' }).map(([name, dependency]) => [name, runtimeHash(dependency)])) };
  const vaultReads = { owner: p.launchOwner, poolManager: ROBINHOOD_GENESIS_STACK.poolManager,
    positionManager: ROBINHOOD_GENESIS_STACK.positionManager, permit2: ROBINHOOD_GENESIS_STACK.permit2,
    oracle: p.oracle, omr: p.token, keeper: p.liquidityKeeper, genesisController: p.lifecycleController,
    vigRecipient: p.vigRecipient, emergencyRecipient: p.launchOwner,
    poolId: expectedPoolId, configuredChainId: 4663n, positionId: 0n, activationTimestamp: 0n,
    paused: false, emergencyLatched: false,
    ...Object.fromEntries(Object.entries({ positionManagerCodeHash: 'positionManager', poolManagerCodeHash: 'poolManager',
      permit2CodeHash: 'permit2', omrCodeHash: 'token', oracleCodeHash: 'oracle', hookCodeHash: 'hook',
      genesisControllerCodeHash: 'lifecycleController' }).map(([name, dependency]) => [name, runtimeHash(dependency)])) };
  const oracleReads = { source: p.hook, poolManager: ROBINHOOD_GENESIS_STACK.poolManager, omr: p.token,
    poolId: expectedPoolId, fee: 3000, tickSpacing: 60, baselineInitialized: false, consult: [0n, 0n] };
  const auctionReads = { token: p.token, currency: '0x0000000000000000000000000000000000000000',
    tokensRecipient: p.lifecycleController, fundsRecipient: ROBINHOOD_GENESIS_STACK.lbpStrategy,
    validationHook: p.walletCap, totalSupply: GENESIS_SALE_OMR,
    startBlock: controlled.timeline.startBlock, endBlock: controlled.timeline.endBlock,
    claimBlock: controlled.timeline.claimBlock, floorPrice: controlled.pricing.floorPrice,
    tickSpacing: controlled.pricing.tickSpacing };
  const dictionaries = { [p.lifecycleController.toLowerCase()]: controllerReads,
    [p.positionRecipient.toLowerCase()]: vaultReads, [p.oracle.toLowerCase()]: oracleReads,
    [p.walletCap.toLowerCase()]: { controller: p.lifecycleController, controllerCodeHash: runtimeHash('lifecycleController'),
      MAX_COMMITMENT: GENESIS_WALLET_CAP_WEI, totalCommitted: 0n },
    [auctionAddress]: auctionReads };
  for (const [target, updates] of Object.entries(options.overrides ?? {})) {
    Object.assign(dictionaries[target.toLowerCase()], updates);
  }
  const block = { number: 80_000_000n, hash: blockHash,
    timestamp: BigInt(Math.floor(Date.now() / 1000)) - BigInt(options.age ?? 0) };
  return { reads,
    getChainId: async () => options.chainId ?? 4663,
    getBytecode: async ({ address, blockNumber }) => {
      // All automated proof reads are pinned; legacy funding checks have their separate API.
      if (blockNumber != null) assert.equal(blockNumber, block.number);
      if (address.toLowerCase() === options.empty?.toLowerCase()) return '0x';
      if (address.toLowerCase() === options.changedCode?.toLowerCase()) return '0x6001';
      return codes[address.toLowerCase()] ?? '0x6000';
    },
    getBlock: async ({ blockNumber }) => ({ ...block,
      hash: blockNumber != null && options.reorg ? `0x${'cd'.repeat(32)}` : block.hash }),
    readContract: async (request) => {
      reads.push(request);
      const { address, functionName, blockNumber, args = [] } = request;
      if (blockNumber != null) assert.equal(blockNumber, block.number);
      if (request.blockTag === 'latest' && functionName === 'currentBlock') {
        options.onLiveClock?.();
        return options.finalClock ?? controllerReads.currentBlock;
      }
      if (address === ROBINHOOD_GENESIS_STACK.lbpStrategy) {
        if (functionName === 'registeredPoolIds') return options.registered ?? auctionAddress;
        if (functionName === 'initializers') return options.migrator ?? controlled.migratorParameters;
      }
      if (address === ROBINHOOD_GENESIS_STACK.ccaFactory && functionName === 'getAddress') {
        assert.deepEqual(args, [p.token, GENESIS_SALE_OMR, controlled.initializerParams,
          controlled.initializerSalt, ROBINHOOD_GENESIS_STACK.lbpStrategy]);
        return options.predicted ?? auctionAddress;
      }
      const dictionary = dictionaries[address.toLowerCase()];
      if (dictionary && Object.hasOwn(dictionary, functionName)) return dictionary[functionName];
      return readinessClient.readContract(request);
    },
    simulateContract: async (request) => {
      assert.equal(request.address, p.lifecycleController);
      assert.equal(request.functionName, 'bindAuction');
      assert.equal(request.account, p.launchOwner);
      assert.equal(request.blockNumber, block.number);
      assert.equal(request.args[0].toLowerCase(), auctionAddress);
      if (options.simulationError) throw new Error('binding simulation refused');
      return { result: undefined };
    },
  };
}
const autoClient = automatedClient();
const autoReadiness = await verifyGenesisAutomationReadiness(autoClient, controlled);
assert.equal(autoReadiness.currentBlock, 49_999_999n);
assert.equal(autoReadiness.checkedAtBlock, 80_000_000n, 'ArbSys scheduling must not use the independent L2 block number');
assert.equal(autoReadiness.baselineInitialized, false);
assert(autoClient.reads.every((read) => read.blockNumber === 80_000_000n
  || (read.functionName === 'currentBlock' && read.blockTag === 'latest')));
assert.equal((await verifyGenesisLaunchReadiness(automatedClient(), controlled)).automation.currentBlock, 49_999_999n);
const readiness = await verifyGenesisLaunchReadiness(automatedClient(), controlled);
assert.equal(readiness.canonicalPoolId, expectedPoolId);
assert.equal(readiness.funding.permit2Nonce, 7n);
assert.equal(readiness.funding.permit2Expiration, BigInt(input.permit2Expiration));
assert.equal(readiness.hook.initializerInterfaceSupported, true);
assert.equal(readiness.hook.observationSourceInterfaceSupported, true);
assert.equal(readiness.splitter.poolInitialized, false);
const binding = await buildGenesisAuctionBinding(automatedClient(), controlled);
assert.equal(binding.transaction.to, controlled.participants.lifecycleController);
assert.equal(binding.transaction.value, 0n);
assert.equal(binding.factoryPredictionVerified, true);
assert.equal(binding.launchArtifactsSha256, sha256Hex(canonicalJson(controlled)));
assert.equal(binding.readiness.launchArtifactsSha256, binding.launchArtifactsSha256);
assert.equal(binding.simulated, true);
assert.equal(binding.auction.toLowerCase(), auctionAddress);
assert.equal(binding.bindingCalldataKeccak256, keccak256(binding.transaction.data));
assert.equal(decodeFunctionData({ abi: [{ type: 'function', name: 'bindAuction', stateMutability: 'nonpayable',
  inputs: [{ type: 'address', name: 'auction' }], outputs: [] }], data: binding.transaction.data }).args[0].toLowerCase(), auctionAddress);

let adversarial = 0;
async function rejectAuto(options, pattern, bind = false) {
  await assert.rejects(() => (bind ? buildGenesisAuctionBinding : verifyGenesisAutomationReadiness)(
    automatedClient(options), controlled,
  ), pattern);
  adversarial++;
}
for (const target of ['lifecycleController', 'positionRecipient', 'oracle', 'walletCap']) {
  await rejectAuto({ empty: controlled.participants[target] }, /no runtime code/);
  await rejectAuto({ changedCode: controlled.participants[target] }, /runtime code hash mismatch/);
}
await rejectAuto({ changedCode: ROBINHOOD_GENESIS_STACK.lbpStrategy }, /runtime code hash mismatch/);
await rejectAuto({ chainId: 1 }, /chain 4663/);
await rejectAuto({ age: 121 }, /stale/);
await rejectAuto({ reorg: true }, /canonical block/);
const wrong = controlled.participants.treasury;
for (const [target, field, value] of [
  ['lifecycleController', 'foundation', wrong], ['lifecycleController', 'oracle', wrong],
  ['lifecycleController', 'treasury', controlled.participants.oracle], ['lifecycleController', 'owner', controlled.participants.oracle],
  ['lifecycleController', 'auction', auctionAddress], ['lifecycleController', 'usesArbSys', false],
  ['lifecycleController', 'currentBlock', controlled.timeline.startBlock],
  ['lifecycleController', 'foundationCodeHash', `0x${'00'.repeat(32)}`],
  ['positionRecipient', 'genesisController', wrong], ['positionRecipient', 'oracle', wrong],
  ['positionRecipient', 'vigRecipient', wrong], ['positionRecipient', 'emergencyRecipient', controlled.participants.oracle],
  ['positionRecipient', 'keeper', wrong], ['positionRecipient', 'emergencyLatched', true],
  ['positionRecipient', 'positionId', 1n], ['oracle', 'source', wrong], ['oracle', 'poolId', `0x${'00'.repeat(32)}`],
  ['oracle', 'baselineInitialized', true], ['oracle', 'consult', [1n, 1n]],
  ['walletCap', 'controller', wrong], ['walletCap', 'controllerCodeHash', `0x${'ff'.repeat(32)}`],
  ['walletCap', 'MAX_COMMITMENT', 2n * GENESIS_WALLET_CAP_WEI], ['walletCap', 'totalCommitted', 1n],
]) {
  await rejectAuto({ overrides: { [controlled.participants[target]]: { [field]: value } } }, /mismatch|not in the future|zero quote/);
}
await rejectAuto({ registered: '0x0000000000000000000000000000000000000000' }, /zero address/, true);
await rejectAuto({ predicted: wrong }, /factory prediction/, true);
await rejectAuto({ empty: auctionAddress }, /created CCA.*no runtime/, true);
await rejectAuto({ migrator: { ...controlled.migratorParameters, positionRecipient: wrong } }, /migration parameters/, true);
await rejectAuto({ migrator: { ...controlled.migratorParameters, lpAllocationSchedule: '0x' } }, /migration parameters/, true);
for (const [field, value] of [['tokensRecipient', wrong], ['fundsRecipient', wrong], ['validationHook', wrong],
  ['startBlock', controlled.timeline.startBlock - 1n], ['endBlock', controlled.timeline.endBlock + 1n],
  ['claimBlock', controlled.timeline.claimBlock + 1n], ['totalSupply', GENESIS_SALE_OMR - 1n]]) {
  await rejectAuto({ overrides: { [auctionAddress]: { [field]: value } } }, /created CCA.*mismatch/, true);
}
await rejectAuto({ simulationError: true }, /simulation refused/, true);
await rejectAuto({ finalClock: controlled.timeline.startBlock }, /reached its start/, true);
await rejectAuto({ finalClock: controlled.timeline.startBlock }, /reached its start/);
await assert.rejects(() => verifyGenesisLaunchReadiness(automatedClient({ finalClock: controlled.timeline.startBlock }), controlled),
  /reached its start/);
const realNow = Date.now;
try {
  let testNow = realNow();
  Date.now = () => testNow;
  for (const check of [verifyGenesisAutomationReadiness, buildGenesisAuctionBinding, verifyGenesisLaunchReadiness]) {
    const client = automatedClient({ onLiveClock: () => { testNow += 121_000; } });
    await assert.rejects(() => check(client, controlled), /became stale during verification/);
    adversarial++;
  }
} finally { Date.now = realNow; }
console.log(`✅ Automated Genesis bootstrap/binding: coherent uninitialized oracle accepted, exact factory/strategy proof, unsigned simulated Safe payload, and ${adversarial} rejection cases.`);

console.log('✅ Genesis CCA config/preflight test passed — exact allocation, schedule, pricing, pinned stack, zero-tax hook, splitter, one-shot allowances, and unsigned atomic launcher calldata.');
