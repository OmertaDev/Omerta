import assert from 'node:assert/strict';
import fs from 'node:fs';
import { encodeFunctionData, keccak256 } from 'viem';
import { buildGenesisCadenceEvidence, canonicalJson, sha256Hex } from '../src/genesiscadence.js';
import {
  GENESIS_RELEASE_ARTIFACTS,
  GENESIS_RELEASE_SCOPE_FILES,
  GENESIS_AUTOMATED_AUDIT_SCOPE,
  buildGenesisReleaseManifest,
} from '../src/genesisrelease.js';
import { GENESIS_DISTRIBUTION_OMR, buildGenesisLaunchArtifacts, canonicalGenesisPoolId } from '../src/genesiscca.js';

const sha = (byte) => byte.repeat(64);
const hex32 = (byte) => `0x${byte.repeat(64)}`;
const owners = [
  '0xa111111111111111111111111111111111111111',
  '0xa222222222222222222222222222222222222222',
  '0xa333333333333333333333333333333333333333',
];
const cadence = buildGenesisCadenceEvidence({
  chainId: 4663,
  rpcClass: 'public',
  generatedAt: '2026-08-27T10:03:01.000Z',
  samples: [0, 1, 2, 3, 4].map((index) => ({
    elapsedMs: index * 45_000,
    observedAt: new Date(Date.parse('2026-08-27T10:00:00.000Z') + index * 45_000).toISOString(),
    blockNumberish: String(50_000_000 + index * 450),
    latestBlock: String(50_000_100 + index * 450),
    latestTimestamp: String(1_777_000_000 + index * 45),
    finalizedBlock: String(50_000_080 + index * 450),
  })),
});
assert.equal(cadence.targets.auctionSeconds, 604800);
assert.equal(cadence.targets.claimDelaySeconds, 86400);
assert.equal(cadence.summary.medianCadenceMicros, 100_000n);
assert.equal(cadence.summary.auctionBlocks, 6_048_000n);
assert.equal(cadence.summary.claimDelayBlocks, 864_000n);
assert.equal(cadence.summary.maxFinalityLagBlocks, 20n);

const launch = {
  token: '0x1111111111111111111111111111111111111111',
  launchOwner: '0x2222222222222222222222222222222222222222',
  treasury: '0x2222222222222222222222222222222222222222',
  vigRecipient: '0x6666666666666666666666666666666666666666',
  founderRecipient: '0x7777777777777777777777777777777777777777',
  proceedsSplitter: '0x3333333333333333333333333333333333333333',
  positionRecipient: '0x4444444444444444444444444444444444444444',
  hook: '0x55555555555555555555555555555555555530cc',
  salt: `0x${'ab'.repeat(32)}`,
  startBlock: '51000000',
  auctionBlocks: '6048000',
  prebidBlocks: '0',
  claimDelayBlocks: '864000',
  permit2Expiration: '1800000000',
  requiredCurrencyRaised: '10000000000000000000',
};
const launchCalldataKeccak256 = keccak256(buildGenesisLaunchArtifacts(launch).safeTransactions.launch.data);
const input = {
  launch,
  audit: {
    status: 'passed',
    scopeCommit: '1'.repeat(40),
    reportSha256: sha('a'),
    reviewer: 'independent-review-firm',
    unresolvedCritical: 0,
    unresolvedHigh: 0,
    signerIncluded: true,
    scope: {
      initializerHook: true,
      tickAccumulator: true,
      v4Oracle: true,
      proceedsSplitter: true,
      omrTransferBehavior: true,
      lbpFailureBranch: true,
      forkEvidence: true,
      sharedSigner: true,
    },
  },
  governance: {
    launchSafe: { address: launch.launchOwner, owners, threshold: 2 },
    recipientsApproved: true,
    recipientDecisionSha256: sha('b'),
    treasuryAllocationApproved: true,
    treasuryAllocationOmr: GENESIS_DISTRIBUTION_OMR.toString(),
    treasuryAllocationSha256: sha('c'),
    taxesRemainZeroThroughFirstBond: true,
    lpCustody: {
      kind: 'safe',
      address: launch.positionRecipient,
      owners,
      threshold: 2,
      reviewSha256: sha('d'),
      recoverySimulationSha256: sha('e'),
    },
  },
  cadence,
  timingApproval: {
    independentlyRecomputed: true,
    finalityLagReviewed: true,
    leadBlocksApproved: true,
    approvalSha256: sha('f'),
    startBlock: launch.startBlock,
    auctionBlocks: launch.auctionBlocks,
    claimDelayBlocks: launch.claimDelayBlocks,
  },
  forkRehearsal: {
    chainId: 4663,
    blockNumber: '47283811',
    passed: true,
    archiveSha256: sha('1'),
    noProductionBroadcasts: true,
    noProductionKeysRead: true,
    arbSysShimDeclared: true,
  },
  safeCeremony: {
    safeAddress: launch.launchOwner,
    safeTransactionHash: hex32('2'),
    preflight: {
      status: 'passed', chainId: 4663, blockNumber: '50500000', evidenceSha256: sha('3'),
      stackRuntimeHashesMatch: true, readinessPassed: true, launchCalldataKeccak256,
    },
    simulation: {
      status: 'passed', chainId: 4663, blockNumber: '50600000', evidenceSha256: sha('4'),
      launchCalldataKeccak256,
    },
    decoders: [
      { operatorId: 'operator-a', launchCalldataKeccak256, evidenceSha256: sha('5') },
      { operatorId: 'operator-b', launchCalldataKeccak256, evidenceSha256: sha('6') },
    ],
    approvalsRecorded: true,
    approvalsSha256: sha('7'),
  },
};
const context = {
  createdAt: '2026-08-27T10:10:00.000Z',
  repository: {
    commit: '1'.repeat(40),
    clean: true,
    nodeVersion: 'v24.0.0',
    files: GENESIS_RELEASE_SCOPE_FILES.map((file, index) => ({ path: file, sha256: sha(String(index % 10)) })),
    artifacts: GENESIS_RELEASE_ARTIFACTS.map((contract, index) => ({
      contract,
      artifactSha256: sha(((index + 1) % 16).toString(16)),
      creationBytecodeKeccak256: hex32(((index + 3) % 16).toString(16)),
      runtimeBytecodeKeccak256: hex32(((index + 6) % 16).toString(16)),
    })),
  },
};

const manifest = buildGenesisReleaseManifest(input, context);
assert.equal(manifest.status, 'ready_for_safe_execution');
assert.equal(manifest.chainId, 4663);
assert.equal(manifest.repository.commit, context.repository.commit);
assert.equal(manifest.launch.launchCalldataKeccak256, launchCalldataKeccak256);
assert.equal(manifest.launch.timeline.auctionBlocks, 6_048_000);
assert.equal(manifest.timing.evidence.evidenceSha256, cadence.evidenceSha256);
assert.equal(manifest.governance.treasuryAllocationOmr, GENESIS_DISTRIBUTION_OMR);
assert.match(manifest.manifestSha256, /^[0-9a-f]{64}$/);
assert.equal(buildGenesisReleaseManifest(input, context).manifestSha256, manifest.manifestSha256,
  'the same reviewed inputs must produce the same manifest digest');

const mutate = (fn) => {
  const nextInput = structuredClone(input);
  const nextContext = structuredClone(context);
  fn(nextInput, nextContext);
  return () => buildGenesisReleaseManifest(nextInput, nextContext);
};
assert.throws(mutate((_review, next) => { next.repository.clean = false; }), /clean.*explicitly true/i);
assert.throws(mutate((review) => { review.audit.status = 'pending'; }), /audit.status/);
assert.throws(mutate((review) => { review.audit.scope.v4Oracle = false; }), /audit.scope.v4Oracle/);
assert.throws(mutate((review) => { review.audit.unresolvedHigh = 1; }), /critical or high/);
assert.throws(mutate((review) => { review.governance.launchSafe.owners[2] = owners[1]; }), /owners must be distinct/);
assert.throws(mutate((review) => { review.governance.lpCustody.address = launch.treasury; }), /positionRecipient/);
assert.throws(mutate((review) => { review.launch.auctionBlocks = '6047999'; }), /cadence-derived/);
assert.throws(mutate((review) => { review.launch.auctionBlocks = '2592000'; }), /cadence-derived/);
assert.throws(mutate((review) => { review.cadence.samples[4].blockNumberish = '50001799'; }),
  /evidenceSha256/);
assert.throws(mutate((review) => { review.timingApproval.independentlyRecomputed = false; }),
  /independentlyRecomputed/);
assert.throws(mutate((review) => { review.safeCeremony.decoders.length = 1; }), /at least two/);
assert.throws(mutate((review) => {
  review.safeCeremony.simulation.launchCalldataKeccak256 = hex32('9');
}), /simulation must bind/);
assert.throws(mutate((review) => { review.privateKey = 'forbidden'; }), /credentials/);
assert.throws(() => buildGenesisCadenceEvidence({ ...cadence, samples: cadence.samples.slice(0, 4) }),
  /at least 5 samples/);
assert.throws(() => buildGenesisCadenceEvidence({
  ...cadence,
  samples: cadence.samples.map((sample) => ({ ...sample, finalizedBlock: null })),
}), /finalizedBlock/);

for (const file of GENESIS_RELEASE_SCOPE_FILES) assert(fs.existsSync(file), `frozen source exists: ${file}`);
for (const file of ['src/genesiskeeper.js', 'src/keepertransactions.js', 'src/liquiditystate.js',
  'src/liquidityqueue.js', 'tools/liquidity-deployment-plan.js', 'omerta-contracts/src/GenesisLifecycleController.sol']) {
  assert(GENESIS_RELEASE_SCOPE_FILES.includes(file));
}
for (const name of ['GenesisLifecycleController', 'ProtocolLiquidityVault', 'LiquidityBuybackExecutor', 'KeeperGasVault']) {
  assert(GENESIS_RELEASE_ARTIFACTS.includes(name));
}
const autoInput = structuredClone(input);
Object.assign(autoInput.launch, { launchMode: 'automated',
  lifecycleController: '0x8888888888888888888888888888888888888888',
  oracle: '0x9999999999999999999999999999999999999999',
  liquidityKeeper: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  runtimeCodeHashes: Object.fromEntries(['token', 'hook', 'proceedsSplitter', 'lifecycleController',
    'positionRecipient', 'oracle'].map((name) => [name, hex32('a')])),
});
Object.assign(autoInput.audit.scope, Object.fromEntries(GENESIS_AUTOMATED_AUDIT_SCOPE.map((name) => [name, true])));
Object.assign(autoInput.forkRehearsal, Object.fromEntries(['prePoolOracleBootstrap', 'controllerBoundBeforeStart',
  'exactFactoryPrediction', 'migrationToProtocolVault', 'oracleFullWindowRequired', 'keeperReceiptAccounting',
  'uncappedBidding', 'zeroValidationHook']
  .map((name) => [name, true])));
autoInput.governance.lpCustody.kind = 'protocol_liquidity_vault';
const autoLaunch = buildGenesisLaunchArtifacts(autoInput.launch);
const autoLaunchDigest = autoLaunch.calldataDigests.launchKeccak256;
autoInput.safeCeremony.preflight.launchCalldataKeccak256 = autoLaunchDigest;
autoInput.safeCeremony.simulation.launchCalldataKeccak256 = autoLaunchDigest;
autoInput.safeCeremony.preflight.blockNumberish = '50500000';
autoInput.safeCeremony.simulation.blockNumberish = '50600000';
// L2 block numbers can already exceed the auction's separate ArbSys clock.
autoInput.safeCeremony.preflight.blockNumber = '90000000';
autoInput.safeCeremony.simulation.blockNumber = '90000001';
for (const decoder of autoInput.safeCeremony.decoders) decoder.launchCalldataKeccak256 = autoLaunchDigest;
autoInput.safeCeremony.auctionBinding = { status: 'pending_creation', postCreationVerificationRequired: true };
const autoManifest = buildGenesisReleaseManifest(autoInput, context);
assert.equal(autoManifest.status, 'ready_for_safe_launch_requires_auction_binding');
assert.equal(autoManifest.auctionBinding.transaction, null, 'no guessed auction produces calldata before creation');
assert.equal(autoManifest.launch.participants.lifecycleController, autoInput.launch.lifecycleController);
assert.equal(autoManifest.governance.lpCustody.custodyType, 'protocol_liquidity_vault');
const rejectAutomatic = (modify, pattern) => {
  const candidate = structuredClone(autoInput);
  const candidateContext = structuredClone(context);
  modify(candidate, candidateContext);
  assert.throws(() => buildGenesisReleaseManifest(candidate, candidateContext), pattern);
};
rejectAutomatic((review) => { delete review.safeCeremony.auctionBinding; }, /auctionBinding.*required/);
rejectAutomatic((review) => { review.safeCeremony.auctionBinding.postCreationVerificationRequired = false; }, /explicitly true/);
rejectAutomatic((review) => { review.governance.lpCustody.kind = 'audited_lock'; }, /protocol_liquidity_vault/);
rejectAutomatic((review) => { delete review.safeCeremony.preflight.blockNumberish; }, /blockNumberish/);
rejectAutomatic((review) => { review.safeCeremony.simulation.blockNumberish = autoInput.launch.startBlock; }, /precede startBlock/);
for (const name of GENESIS_AUTOMATED_AUDIT_SCOPE) {
  rejectAutomatic((review) => { delete review.audit.scope[name]; }, new RegExp(`audit.scope.${name}`));
}
rejectAutomatic((review) => { review.forkRehearsal.controllerBoundBeforeStart = false; }, /controllerBoundBeforeStart/);
rejectAutomatic((_review, inventory) => {
  inventory.repository.files = inventory.repository.files.filter((entry) => entry.path !== 'src/genesiskeeper.js');
}, /missing src\/genesiskeeper/);
rejectAutomatic((_review, inventory) => {
  inventory.repository.artifacts = inventory.repository.artifacts.filter((entry) => entry.contract !== 'ProtocolLiquidityVault');
}, /missing ProtocolLiquidityVault/);

const auction = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const data = encodeFunctionData({ abi: [{ type: 'function', name: 'bindAuction', stateMutability: 'nonpayable',
  inputs: [{ name: 'auction', type: 'address' }], outputs: [] }], functionName: 'bindAuction', args: [auction] });
const checkedAtTimestamp = BigInt(Math.floor(Date.parse(context.createdAt) / 1000));
autoInput.safeCeremony.auctionBinding = { status: 'ready_for_auction_binding', chainId: 4663,
  transaction: { from: launch.launchOwner, to: autoInput.launch.lifecycleController, value: '0', data },
  auction, auctionRuntimeCodeHash: hex32('d'), checkedAtBlock: '90000002', checkedAtBlockHash: hex32('e'),
  checkedAtTimestamp, currentBlock: '50700000', beforeBlock: launch.startBlock,
  launchCalldataKeccak256: autoLaunchDigest, bindingCalldataKeccak256: keccak256(data),
  launchArtifactsSha256: sha256Hex(canonicalJson(autoLaunch)),
  factoryPredictionVerified: true, simulated: true,
  readiness: { canonicalPoolId: canonicalGenesisPoolId(autoInput.launch),
    launchArtifactsSha256: sha256Hex(canonicalJson(autoLaunch)),
    runtimeCodeHashes: { ...autoInput.launch.runtimeCodeHashes }, baselineInitialized: false,
    oracleQuote: { price: 0n, updatedAt: 0n }, checkedAtBlock: '90000002', checkedAtBlockHash: hex32('e'),
    checkedAtTimestamp, currentBlock: '50700000' },
};
const readyBinding = buildGenesisReleaseManifest(autoInput, context);
assert.equal(readyBinding.status, 'ready_for_auction_binding');
assert.equal(readyBinding.auctionBinding.submitted, false, 'a simulated unsigned payload is never claimed as already bound');
assert.equal(readyBinding.auctionBinding.transaction.data, data);
for (const [field, value] of [['factoryPredictionVerified', false], ['simulated', false],
  ['beforeBlock', '51000001'], ['currentBlock', launch.startBlock], ['bindingCalldataKeccak256', hex32('f')],
  ['launchCalldataKeccak256', hex32('f')], ['checkedAtTimestamp', checkedAtTimestamp - 121n]]) {
  rejectAutomatic((review) => { review.safeCeremony.auctionBinding[field] = value; },
    /explicitly true|startBlock|calldata|stale/);
}
rejectAutomatic((review) => { review.safeCeremony.auctionBinding.transaction.to = launch.token; }, /exact zero-value/);
rejectAutomatic((review) => { review.safeCeremony.auctionBinding.transaction.value = '1'; }, /exact zero-value/);
rejectAutomatic((review) => { review.safeCeremony.auctionBinding.transaction.data = '0x'; }, /exact zero-value/);
rejectAutomatic((review) => { review.safeCeremony.auctionBinding.readiness.baselineInitialized = true; }, /pre-pool oracle/);
rejectAutomatic((review) => { review.safeCeremony.auctionBinding.readiness.checkedAtBlockHash = hex32('f'); }, /same canonical snapshot/);
rejectAutomatic((review) => { review.safeCeremony.auctionBinding.readiness.runtimeCodeHashes.oracle = hex32('f'); }, /runtimeCodeHashes.oracle/);
for (const name of ['oracle', 'liquidityKeeper']) {
  rejectAutomatic((review) => {
    review.launch[name] = '0xcccccccccccccccccccccccccccccccccccccccc';
    assert.equal(buildGenesisLaunchArtifacts(review.launch).calldataDigests.launchKeccak256, autoLaunchDigest,
      'these off-calldata identities require the separate full-artifact commitment');
  }, /full launch artifact/);
}
console.log(`✅ Automated Genesis release: ${GENESIS_RELEASE_SCOPE_FILES.length} source files and ${GENESIS_RELEASE_ARTIFACTS.length} artifacts,
  mandatory automated audit/rehearsal scope, pinned POL custody, distinct auction clocks, and pending/verified binding stages.`);

console.log('✅ Genesis production release gate passed — fresh chain cadence, source/bytecode freeze, audit scope, governance custody, fork evidence, and independent Safe ceremony all fail closed and bind exact unsigned calldata.');
