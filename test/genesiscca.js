import assert from 'node:assert/strict';
import { decodeFunctionData, keccak256 } from 'viem';
import {
  GENESIS_DISTRIBUTION_OMR,
  GENESIS_LP_RESERVE_OMR,
  GENESIS_SALE_OMR,
  MPS,
  Q96,
  ROBINHOOD_GENESIS_STACK,
  V4_OBSERVATION_SOURCE_INTERFACE_ID,
  buildGenesisLaunchArtifacts,
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
const readiness = await verifyGenesisLaunchReadiness(readinessClient, built);
assert.equal(readiness.canonicalPoolId, expectedPoolId);
assert.equal(readiness.funding.permit2Nonce, 7n);
assert.equal(readiness.funding.permit2Expiration, BigInt(input.permit2Expiration));
assert.equal(readiness.hook.initializerInterfaceSupported, true);
assert.equal(readiness.hook.observationSourceInterfaceSupported, true);
assert.equal(readiness.splitter.poolInitialized, false);
await assert.rejects(
  () => verifyGenesisLaunchReadiness({
    ...readinessClient,
    getBlock: async () => ({ number: built.timeline.startBlock, timestamp: 1_700_000_000n }),
  }, built),
  /start block.*not in the future/,
);

assert.throws(() => buildGenesisLaunchArtifacts({ ...input, hook: 'not-an-address' }), /valid EVM address/);
assert.throws(
  () => buildGenesisLaunchArtifacts({ ...input, hook: '0x5555555555555555555555555555555555555555' }),
  /permission flags/,
);
assert.throws(() => buildGenesisLaunchArtifacts({ ...input, claimDelayBlocks: '0' }), /claimBlock/);
assert.throws(() => buildGenesisLaunchArtifacts({ ...input, salt: '0x1234' }), /32 bytes/);
assert.throws(() => buildGenesisLaunchArtifacts({ ...input, vigRecipient: undefined }), /vigRecipient/);

console.log('✅ Genesis CCA config/preflight test passed — exact allocation, schedule, pricing, pinned stack, zero-tax hook, splitter, one-shot allowances, and unsigned atomic launcher calldata.');
