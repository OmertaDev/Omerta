import assert from 'node:assert/strict';
import { keccak256 } from 'viem';
import { buildGenesisCadenceEvidence } from '../src/genesiscadence.js';
import {
  GENESIS_RELEASE_ARTIFACTS,
  GENESIS_RELEASE_SCOPE_FILES,
  buildGenesisReleaseManifest,
} from '../src/genesisrelease.js';
import { GENESIS_DISTRIBUTION_OMR, buildGenesisLaunchArtifacts } from '../src/genesiscca.js';

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
assert.equal(cadence.summary.medianCadenceMicros, 100_000n);
assert.equal(cadence.summary.auctionBlocks, 2_592_000n);
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
  auctionBlocks: '2592000',
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
      artifactSha256: sha(String(index + 1)),
      creationBytecodeKeccak256: hex32(String(index + 3)),
      runtimeBytecodeKeccak256: hex32(String(index + 6)),
    })),
  },
};

const manifest = buildGenesisReleaseManifest(input, context);
assert.equal(manifest.status, 'ready_for_safe_execution');
assert.equal(manifest.chainId, 4663);
assert.equal(manifest.repository.commit, context.repository.commit);
assert.equal(manifest.launch.launchCalldataKeccak256, launchCalldataKeccak256);
assert.equal(manifest.launch.timeline.auctionBlocks, 2_592_000);
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
assert.throws(mutate((review) => { review.launch.auctionBlocks = '2591999'; }), /cadence-derived/);
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

console.log('✅ Genesis production release gate passed — fresh chain cadence, source/bytecode freeze, audit scope, governance custody, fork evidence, and independent Safe ceremony all fail closed and bind exact unsigned calldata.');
