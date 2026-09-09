import { encodeFunctionData, getAddress, isAddress, keccak256 } from 'viem';
import { GENESIS_DISTRIBUTION_OMR, buildGenesisLaunchArtifacts, canonicalGenesisPoolId } from './genesiscca.js';
import { buildGenesisCadenceEvidence, canonicalJson, sha256Hex } from './genesiscadence.js';

export const GENESIS_RELEASE_SCOPE_FILES = Object.freeze([
  'omerta-contracts/foundry.toml',
  'omerta-contracts/src/OmertaHook.sol',
  'omerta-contracts/src/GenesisProceedsSplitter.sol',
  'omerta-contracts/src/OmrV4TwapOracle.sol',
  'omerta-contracts/src/IOmrOracle.sol',
  'omerta-contracts/src/OMR.sol',
  'omerta-contracts/src/OmertaFees.sol',
  'omerta-contracts/src/OmertaBond.sol',
  'omerta-contracts/src/VoucherClaim.sol',
  'omerta-contracts/src/GenesisLifecycleController.sol',
  'omerta-contracts/src/GenesisWalletCap.sol',
  'omerta-contracts/src/ProtocolLiquidityVault.sol',
  'omerta-contracts/src/LiquidityBuybackExecutor.sol',
  'omerta-contracts/src/FeeRevenueRouter.sol',
  'omerta-contracts/src/KeeperGasVault.sol',
  'omerta-contracts/src/BankBufferVault.sol',
  'omerta-contracts/src/interfaces/ILiquidityHealth.sol',
  'omerta-contracts/src/interfaces/IInitializerHook.sol',
  'omerta-contracts/src/interfaces/IOmrV4ObservationSource.sol',
  'omerta-contracts/GENESIS-LAUNCH.md',
  'src/genesiscca.js',
  'src/genesiscadence.js',
  'src/genesislaunch.js',
  'src/genesisrelease.js',
  'src/genesiskeeper.js',
  'src/keepertransactions.js',
  'src/liquiditykeeper.js',
  'src/liquidityautomation.js',
  'src/liquidityaccounting.js',
  'src/liquidityindexer.js',
  'src/liquiditypolicy.js',
  'src/liquidityqueue.js',
  'src/liquiditystate.js',
  'src/chain.js',
  'src/chainparams.js',
  'src/watcher.js',
  'src/worker.js',
  'src/bonds.js',
  'src/fees.js',
  'src/desk.js',
  'src/bank.js',
  'src/rules.js',
  'src/db.js',
  'schema.sql',
  'package.json',
  'package-lock.json',
  'src/v4oraclekeeper.js',
  'tools/genesis-cadence-sample.js',
  'tools/genesis-fork-rehearsal.js',
  'tools/genesis-launch-config.js',
  'tools/genesis-launch-preflight.js',
  'tools/genesis-release-manifest.js',
  'tools/liquidity-deployment-plan.js',
  'tools/liquidity-keeper.js',
  'tools/liquidity-manifest-example.js',
  'tools/liquidity-e2e.js',
  'omerta-contracts/script/DeployV4TwapOracle.s.sol',
  'omerta-contracts/script/DeployHook.s.sol',
  'omerta-contracts/script/DeployGenesisSplitter.s.sol',
  'omerta-contracts/test/OmrV4TwapOracle.t.sol',
  'omerta-contracts/test/audit/GenesisOracleBootstrap.t.sol',
  'omerta-contracts/test/GenesisLifecycleController.t.sol',
  'omerta-contracts/test/GenesisWalletCap.t.sol',
  'omerta-contracts/test/ProtocolLiquidityVault.t.sol',
  'omerta-contracts/test/LiquidityBuybackExecutor.t.sol',
  'test/genesiscca.js',
  'test/fixtures/genesis-stack-runtime.json',
  'test/genesisrelease.js',
  'test/genesiskeeper.js',
  'test/v4oraclekeeper.js',
  'test/keepertransactions.js',
  'test/liquiditykeeper.js',
  'test/liquidityaccounting.js',
  'test/liquidityindexer.js',
  'test/liquiditypolicy.js',
  'test/liquidityqueue.js',
  'test/liquidity-deployment-plan.js',
]);

export const GENESIS_RELEASE_ARTIFACTS = Object.freeze([
  'OmertaHook', 'GenesisProceedsSplitter', 'OmrV4TwapOracle',
  'GenesisLifecycleController', 'GenesisWalletCap', 'ProtocolLiquidityVault', 'LiquidityBuybackExecutor',
  'FeeRevenueRouter', 'KeeperGasVault', 'BankBufferVault', 'OMR', 'OmertaFees', 'OmertaBond', 'VoucherClaim',
]);

const REQUIRED_AUDIT_SCOPE = Object.freeze([
  'initializerHook', 'tickAccumulator', 'v4Oracle', 'proceedsSplitter',
  'omrTransferBehavior', 'lbpFailureBranch', 'forkEvidence', 'sharedSigner',
]);

export const GENESIS_AUTOMATED_AUDIT_SCOPE = Object.freeze([
  'oracleBootstrap', 'lifecycleController', 'protocolLiquidityVault', 'keeperTransactionJournal',
  'receiptAccounting', 'receiptIndexer', 'liquidityHealth', 'claimQueueBacking', 'dailyOffering',
  'deploymentNonceCoordination', 'auctionBinding', 'genesisWalletCap',
]);

function object(label, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is required`);
  return value;
}

function string(label, value, { max = 200 } = {}) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`${label} must be a nonempty string of at most ${max} characters`);
  }
  return value.trim();
}

function bool(label, value) {
  if (value !== true) throw new Error(`${label} must be explicitly true`);
  return true;
}

function integer(label, value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return parsed;
}

function uint(label, value) {
  try {
    const parsed = BigInt(value);
    if (parsed < 0n) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${label} must be an unsigned integer`);
  }
}

function address(label, value) {
  if (!isAddress(value) || /^0x0{40}$/i.test(value)) throw new Error(`${label} must be a nonzero EVM address`);
  return getAddress(value);
}

function sha256(label, value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`${label} must be a 64-character SHA-256 digest`);
  }
  return value.toLowerCase();
}

function hex32(label, value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`${label} must be a 32-byte hex value`);
  }
  return value.toLowerCase();
}

function isoTimestamp(label, value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  return new Date(value).toISOString();
}

function assertNoSecretFields(value, path = 'input') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretFields(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (/(?:private.?key|mnemonic|seed.?phrase|keystore|password|secret)/i.test(key)) {
      throw new Error(`${path}.${key} is forbidden: release metadata must never contain credentials`);
    }
    assertNoSecretFields(child, `${path}.${key}`);
  }
}

function validateSafe(label, raw) {
  const safe = object(label, raw);
  const safeAddress = address(`${label}.address`, safe.address);
  if (!Array.isArray(safe.owners) || safe.owners.length !== 3) {
    throw new Error(`${label}.owners must contain exactly three independently controlled addresses`);
  }
  const owners = safe.owners.map((owner, index) => address(`${label}.owners[${index}]`, owner));
  if (new Set(owners.map((owner) => owner.toLowerCase())).size !== owners.length) {
    throw new Error(`${label}.owners must be distinct`);
  }
  if (integer(`${label}.threshold`, safe.threshold) !== 2) throw new Error(`${label}.threshold must be 2`);
  return { address: safeAddress, owners, threshold: 2 };
}

function validateRepository(raw) {
  const repository = object('repository inventory', raw);
  const commit = string('repository.commit', repository.commit);
  if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error('repository.commit must be a full 40-character Git commit');
  bool('repository.clean', repository.clean);
  if (!Array.isArray(repository.files)) throw new Error('repository.files is required');
  const files = repository.files.map((entry, index) => ({
    path: string(`repository.files[${index}].path`, entry?.path, { max: 300 }),
    sha256: sha256(`repository.files[${index}].sha256`, entry?.sha256),
  }));
  const fileMap = new Map(files.map((entry) => [entry.path, entry]));
  for (const required of GENESIS_RELEASE_SCOPE_FILES) {
    if (!fileMap.has(required)) throw new Error(`repository inventory is missing ${required}`);
  }
  if (!Array.isArray(repository.artifacts)) throw new Error('repository.artifacts is required');
  const artifacts = repository.artifacts.map((entry, index) => ({
    contract: string(`repository.artifacts[${index}].contract`, entry?.contract),
    artifactSha256: sha256(`repository.artifacts[${index}].artifactSha256`, entry?.artifactSha256),
    creationBytecodeKeccak256: hex32(
      `repository.artifacts[${index}].creationBytecodeKeccak256`, entry?.creationBytecodeKeccak256,
    ),
    runtimeBytecodeKeccak256: hex32(
      `repository.artifacts[${index}].runtimeBytecodeKeccak256`, entry?.runtimeBytecodeKeccak256,
    ),
  }));
  const names = new Set(artifacts.map((entry) => entry.contract));
  for (const required of GENESIS_RELEASE_ARTIFACTS) {
    if (!names.has(required)) throw new Error(`repository artifact inventory is missing ${required}`);
  }
  return {
    commit: commit.toLowerCase(), clean: true,
    nodeVersion: string('repository.nodeVersion', repository.nodeVersion), files, artifacts,
  };
}

function validateAudit(raw, commit, automated) {
  const audit = object('audit', raw);
  if (audit.status !== 'passed') throw new Error('audit.status must be passed');
  if (String(audit.scopeCommit || '').toLowerCase() !== commit) {
    throw new Error('audit.scopeCommit must equal the frozen repository commit');
  }
  if (integer('audit.unresolvedCritical', audit.unresolvedCritical) !== 0
    || integer('audit.unresolvedHigh', audit.unresolvedHigh) !== 0) {
    throw new Error('audit cannot have unresolved critical or high findings');
  }
  bool('audit.signerIncluded', audit.signerIncluded);
  const scope = object('audit.scope', audit.scope);
  const requiredScope = [...REQUIRED_AUDIT_SCOPE, ...(automated ? GENESIS_AUTOMATED_AUDIT_SCOPE : [])];
  for (const item of requiredScope) bool(`audit.scope.${item}`, scope[item]);
  return {
    status: 'passed', scopeCommit: commit,
    reportSha256: sha256('audit.reportSha256', audit.reportSha256),
    reviewer: string('audit.reviewer', audit.reviewer),
    unresolvedCritical: 0, unresolvedHigh: 0, signerIncluded: true,
    scope: Object.fromEntries(requiredScope.map((item) => [item, true])),
  };
}

function validateGovernance(raw, launch) {
  const governance = object('governance', raw);
  const launchSafe = validateSafe('governance.launchSafe', governance.launchSafe);
  if (launchSafe.address.toLowerCase() !== launch.participants.launchOwner.toLowerCase()) {
    throw new Error('governance.launchSafe.address must equal launch.launchOwner');
  }
  bool('governance.recipientsApproved', governance.recipientsApproved);
  bool('governance.treasuryAllocationApproved', governance.treasuryAllocationApproved);
  bool('governance.taxesRemainZeroThroughFirstBond', governance.taxesRemainZeroThroughFirstBond);
  const allocation = uint('governance.treasuryAllocationOmr', governance.treasuryAllocationOmr);
  if (allocation !== GENESIS_DISTRIBUTION_OMR) {
    throw new Error('governance.treasuryAllocationOmr must equal the exact launcher allocation');
  }
  const lp = object('governance.lpCustody', governance.lpCustody);
  if (!['safe', 'audited_lock', 'protocol_liquidity_vault'].includes(lp.kind)) {
    throw new Error('governance.lpCustody.kind must be safe, audited_lock, or protocol_liquidity_vault');
  }
  if (launch.launchMode === 'automated' && lp.kind !== 'protocol_liquidity_vault') {
    throw new Error('automated genesis requires governance.lpCustody.kind protocol_liquidity_vault');
  }
  const custodyType = lp.kind;
  const lpAddress = address('governance.lpCustody.address', lp.address);
  if (lpAddress.toLowerCase() !== launch.participants.positionRecipient.toLowerCase()) {
    throw new Error('governance.lpCustody.address must equal launch.positionRecipient');
  }
  const lpSafe = custodyType === 'safe' ? validateSafe('governance.lpCustody.safe', {
    address: lpAddress, owners: lp.owners, threshold: lp.threshold,
  }) : null;
  return {
    launchSafe,
    recipientsApproved: true,
    recipientDecisionSha256: sha256('governance.recipientDecisionSha256', governance.recipientDecisionSha256),
    treasuryAllocationApproved: true,
    treasuryAllocationOmr: allocation,
    treasuryAllocationSha256: sha256(
      'governance.treasuryAllocationSha256', governance.treasuryAllocationSha256,
    ),
    taxesRemainZeroThroughFirstBond: true,
    lpCustody: {
      custodyType, address: lpAddress, safe: lpSafe,
      reviewSha256: sha256('governance.lpCustody.reviewSha256', lp.reviewSha256),
      recoverySimulationSha256: sha256(
        'governance.lpCustody.recoverySimulationSha256', lp.recoverySimulationSha256,
      ),
    },
  };
}

function validateTiming(rawCadence, rawApproval, launch, createdAt) {
  const cadence = buildGenesisCadenceEvidence(rawCadence);
  if (String(rawCadence.evidenceSha256 || '').toLowerCase() !== cadence.evidenceSha256) {
    throw new Error('cadence.evidenceSha256 does not match the normalized samples');
  }
  const cadenceAt = Date.parse(cadence.generatedAt);
  const created = Date.parse(createdAt);
  if (cadenceAt > created + 5 * 60 * 1000 || created - cadenceAt > 60 * 60 * 1000) {
    throw new Error('cadence evidence must be no more than one hour old at manifest creation');
  }
  if (BigInt(launch.timeline.auctionBlocks) !== cadence.summary.auctionBlocks
    || launch.timeline.claimDelayBlocks !== cadence.summary.claimDelayBlocks) {
    throw new Error('launch auctionBlocks/claimDelayBlocks must equal the cadence-derived values');
  }
  if (launch.timeline.startBlock <= cadence.summary.lastBlockNumberish) {
    throw new Error('launch startBlock must be after the last measured BlockNumberish sample');
  }
  const approval = object('timingApproval', rawApproval);
  bool('timingApproval.independentlyRecomputed', approval.independentlyRecomputed);
  bool('timingApproval.finalityLagReviewed', approval.finalityLagReviewed);
  bool('timingApproval.leadBlocksApproved', approval.leadBlocksApproved);
  if (uint('timingApproval.startBlock', approval.startBlock) !== launch.timeline.startBlock
    || uint('timingApproval.auctionBlocks', approval.auctionBlocks) !== BigInt(launch.timeline.auctionBlocks)
    || uint('timingApproval.claimDelayBlocks', approval.claimDelayBlocks) !== launch.timeline.claimDelayBlocks) {
    throw new Error('timingApproval must bind the exact launch timeline');
  }
  return {
    evidence: cadence,
    approval: {
      independentlyRecomputed: true, finalityLagReviewed: true, leadBlocksApproved: true,
      approvalSha256: sha256('timingApproval.approvalSha256', approval.approvalSha256),
      startBlock: launch.timeline.startBlock,
      auctionBlocks: BigInt(launch.timeline.auctionBlocks),
      claimDelayBlocks: launch.timeline.claimDelayBlocks,
    },
  };
}

function validateFork(raw, automated) {
  const fork = object('forkRehearsal', raw);
  if (Number(fork.chainId) !== 4663) throw new Error('forkRehearsal.chainId must be 4663');
  bool('forkRehearsal.passed', fork.passed);
  bool('forkRehearsal.noProductionBroadcasts', fork.noProductionBroadcasts);
  bool('forkRehearsal.noProductionKeysRead', fork.noProductionKeysRead);
  bool('forkRehearsal.arbSysShimDeclared', fork.arbSysShimDeclared);
  const automatedChecks = ['prePoolOracleBootstrap', 'controllerBoundBeforeStart', 'exactFactoryPrediction',
    'migrationToProtocolVault', 'oracleFullWindowRequired', 'keeperReceiptAccounting', 'walletCapEnforced',
    'walletCapCumulative', 'walletCapRollback'];
  if (automated) for (const name of automatedChecks) bool(`forkRehearsal.${name}`, fork[name]);
  return {
    chainId: 4663, blockNumber: uint('forkRehearsal.blockNumber', fork.blockNumber), passed: true,
    archiveSha256: sha256('forkRehearsal.archiveSha256', fork.archiveSha256),
    noProductionBroadcasts: true, noProductionKeysRead: true, arbSysShimDeclared: true,
    ...(automated ? Object.fromEntries(automatedChecks.map((name) => [name, true])) : {}),
  };
}

function validateSafeCeremony(raw, launch, launchCalldataKeccak256) {
  const ceremony = object('safeCeremony', raw);
  const safeAddress = address('safeCeremony.safeAddress', ceremony.safeAddress);
  if (safeAddress.toLowerCase() !== launch.participants.launchOwner.toLowerCase()) {
    throw new Error('safeCeremony.safeAddress must equal launch.launchOwner');
  }
  const preflight = object('safeCeremony.preflight', ceremony.preflight);
  if (preflight.status !== 'passed' || Number(preflight.chainId) !== 4663) {
    throw new Error('safeCeremony.preflight must be passed on chain 4663');
  }
  bool('safeCeremony.preflight.stackRuntimeHashesMatch', preflight.stackRuntimeHashesMatch);
  bool('safeCeremony.preflight.readinessPassed', preflight.readinessPassed);
  if (hex32('safeCeremony.preflight.launchCalldataKeccak256', preflight.launchCalldataKeccak256)
    !== launchCalldataKeccak256) throw new Error('preflight must bind the exact launch calldata');
  const preflightBlock = uint('safeCeremony.preflight.blockNumber', preflight.blockNumber);
  const preflightClock = launch.launchMode === 'automated'
    ? uint('safeCeremony.preflight.blockNumberish', preflight.blockNumberish) : preflightBlock;
  if (preflightClock >= launch.timeline.startBlock) throw new Error('preflight block must precede startBlock');

  const simulation = object('safeCeremony.simulation', ceremony.simulation);
  if (simulation.status !== 'passed' || Number(simulation.chainId) !== 4663) {
    throw new Error('safeCeremony.simulation must be passed on chain 4663');
  }
  if (hex32('safeCeremony.simulation.launchCalldataKeccak256', simulation.launchCalldataKeccak256)
    !== launchCalldataKeccak256) throw new Error('simulation must bind the exact launch calldata');
  const simulationBlock = uint('safeCeremony.simulation.blockNumber', simulation.blockNumber);
  const simulationClock = launch.launchMode === 'automated'
    ? uint('safeCeremony.simulation.blockNumberish', simulation.blockNumberish) : simulationBlock;
  if (simulationClock >= launch.timeline.startBlock) throw new Error('simulation block must precede startBlock');

  if (!Array.isArray(ceremony.decoders) || ceremony.decoders.length < 2) {
    throw new Error('safeCeremony.decoders must contain at least two independent records');
  }
  const decoders = ceremony.decoders.map((decoder, index) => {
    const operatorId = string(`safeCeremony.decoders[${index}].operatorId`, decoder?.operatorId, { max: 64 });
    if (hex32(`safeCeremony.decoders[${index}].launchCalldataKeccak256`, decoder?.launchCalldataKeccak256)
      !== launchCalldataKeccak256) throw new Error(`safeCeremony.decoders[${index}] decoded different calldata`);
    return {
      operatorId,
      launchCalldataKeccak256,
      evidenceSha256: sha256(`safeCeremony.decoders[${index}].evidenceSha256`, decoder?.evidenceSha256),
    };
  });
  if (new Set(decoders.map((decoder) => decoder.operatorId)).size !== decoders.length) {
    throw new Error('safeCeremony decoder operatorIds must be distinct');
  }
  bool('safeCeremony.approvalsRecorded', ceremony.approvalsRecorded);
  return {
    safeAddress,
    safeTransactionHash: hex32('safeCeremony.safeTransactionHash', ceremony.safeTransactionHash),
    launchCalldataKeccak256,
    preflight: {
      status: 'passed', chainId: 4663, blockNumber: preflightBlock,
      ...(launch.launchMode === 'automated' ? { blockNumberish: preflightClock } : {}),
      evidenceSha256: sha256('safeCeremony.preflight.evidenceSha256', preflight.evidenceSha256),
      stackRuntimeHashesMatch: true, readinessPassed: true, launchCalldataKeccak256,
    },
    simulation: {
      status: 'passed', chainId: 4663, blockNumber: simulationBlock,
      ...(launch.launchMode === 'automated' ? { blockNumberish: simulationClock } : {}),
      evidenceSha256: sha256('safeCeremony.simulation.evidenceSha256', simulation.evidenceSha256),
      launchCalldataKeccak256,
    },
    decoders,
    approvalsRecorded: true,
    approvalsSha256: sha256('safeCeremony.approvalsSha256', ceremony.approvalsSha256),
  };
}

function validateAuctionBinding(raw, launch, createdAt) {
  if (launch.launchMode !== 'automated') return null;
  const binding = object('safeCeremony.auctionBinding', raw);
  if (binding.status === 'pending_creation') {
    bool('safeCeremony.auctionBinding.postCreationVerificationRequired', binding.postCreationVerificationRequired);
    return { status: 'pending_creation', postCreationVerificationRequired: true,
      controller: launch.participants.lifecycleController, foundation: launch.participants.positionRecipient,
      oracle: launch.participants.oracle, canonicalPoolId: canonicalGenesisPoolId(launch.participants),
      beforeBlock: launch.timeline.startBlock, transaction: null };
  }
  if (binding.status !== 'ready_for_auction_binding' || Number(binding.chainId) !== 4663) {
    throw new Error('safeCeremony.auctionBinding must be pending_creation or verified ready_for_auction_binding on chain 4663');
  }
  bool('safeCeremony.auctionBinding.factoryPredictionVerified', binding.factoryPredictionVerified);
  bool('safeCeremony.auctionBinding.simulated', binding.simulated);
  const launchArtifactsSha256 = sha256Hex(canonicalJson(launch));
  if (sha256('binding.launchArtifactsSha256', binding.launchArtifactsSha256) !== launchArtifactsSha256) {
    throw new Error('auction binding must bind the full launch artifact including oracle, keeper, and runtime identities');
  }
  const auction = address('safeCeremony.auctionBinding.auction', binding.auction);
  const currentBlock = uint('safeCeremony.auctionBinding.currentBlock', binding.currentBlock);
  if (currentBlock >= launch.timeline.startBlock
    || uint('safeCeremony.auctionBinding.beforeBlock', binding.beforeBlock) !== launch.timeline.startBlock) {
    throw new Error('auction binding must precede the exact committed startBlock on the controller clock');
  }
  const checkedAtTimestamp = uint('safeCeremony.auctionBinding.checkedAtTimestamp', binding.checkedAtTimestamp);
  const age = BigInt(Math.floor(Date.parse(createdAt) / 1000)) - checkedAtTimestamp;
  if (age > 120n || age < -60n) throw new Error('auction binding evidence is stale or future-dated');
  const tx = object('safeCeremony.auctionBinding.transaction', binding.transaction);
  const expectedData = encodeFunctionData({ abi: [{ type: 'function', name: 'bindAuction', stateMutability: 'nonpayable',
    inputs: [{ name: 'auction', type: 'address' }], outputs: [] }], functionName: 'bindAuction', args: [auction] });
  if (address('binding transaction.from', tx.from) !== launch.participants.launchOwner
    || address('binding transaction.to', tx.to) !== launch.participants.lifecycleController
    || uint('binding transaction.value', tx.value) !== 0n || tx.data?.toLowerCase() !== expectedData.toLowerCase()) {
    throw new Error('auction binding transaction must be the exact zero-value Safe controller call');
  }
  const bindingCalldataKeccak256 = keccak256(expectedData);
  if (hex32('binding.bindingCalldataKeccak256', binding.bindingCalldataKeccak256) !== bindingCalldataKeccak256
    || hex32('binding.launchCalldataKeccak256', binding.launchCalldataKeccak256)
      !== launch.calldataDigests.launchKeccak256.toLowerCase()) {
    throw new Error('auction binding evidence must bind the exact launch and binding calldata');
  }
  const readiness = object('auction binding readiness', binding.readiness);
  if (sha256('binding.readiness.launchArtifactsSha256', readiness.launchArtifactsSha256) !== launchArtifactsSha256) {
    throw new Error('auction binding readiness must bind the full launch artifact');
  }
  if (readiness.baselineInitialized !== false
    || uint('binding.readiness.oracleQuote.price', readiness.oracleQuote?.price) !== 0n
    || uint('binding.readiness.oracleQuote.updatedAt', readiness.oracleQuote?.updatedAt) !== 0n) {
    throw new Error('auction binding requires the verified pre-pool oracle baseline and zero quote');
  }
  if (uint('binding.readiness.checkedAtBlock', readiness.checkedAtBlock) !== uint('binding.checkedAtBlock', binding.checkedAtBlock)
    || hex32('binding.readiness.checkedAtBlockHash', readiness.checkedAtBlockHash)
      !== hex32('binding.checkedAtBlockHash', binding.checkedAtBlockHash)
    || uint('binding.readiness.checkedAtTimestamp', readiness.checkedAtTimestamp) !== checkedAtTimestamp
    || uint('binding.readiness.currentBlock', readiness.currentBlock) > currentBlock) {
    throw new Error('auction binding readiness must use the same canonical snapshot and a coherent controller clock');
  }
  if (hex32('binding.readiness.canonicalPoolId', readiness.canonicalPoolId)
    !== canonicalGenesisPoolId(launch.participants).toLowerCase()) throw new Error('auction binding pool mismatch');
  for (const [name, hash] of Object.entries(launch.automation.runtimeCodeHashes)) {
    if (hex32(`binding.readiness.runtimeCodeHashes.${name}`, readiness.runtimeCodeHashes?.[name]) !== hash) {
      throw new Error(`auction binding runtimeCodeHashes.${name} mismatch`);
    }
  }
  return { status: 'ready_for_auction_binding', chainId: 4663, auction,
    auctionRuntimeCodeHash: hex32('binding.auctionRuntimeCodeHash', binding.auctionRuntimeCodeHash),
    checkedAtBlock: uint('binding.checkedAtBlock', binding.checkedAtBlock),
    checkedAtBlockHash: hex32('binding.checkedAtBlockHash', binding.checkedAtBlockHash),
    checkedAtTimestamp, currentBlock, beforeBlock: launch.timeline.startBlock,
    transaction: { from: tx.from, to: tx.to, value: 0n, data: expectedData },
    bindingCalldataKeccak256, launchCalldataKeccak256: launch.calldataDigests.launchKeccak256,
    launchArtifactsSha256,
    factoryPredictionVerified: true, simulated: true, submitted: false };
}

export function buildGenesisReleaseManifest(input = {}, context = {}) {
  assertNoSecretFields(input);
  const createdAt = isoTimestamp('context.createdAt', context.createdAt);
  const repository = validateRepository(context.repository);
  const launch = buildGenesisLaunchArtifacts(object('launch', input.launch));
  const launchCalldataKeccak256 = keccak256(launch.safeTransactions.launch.data).toLowerCase();
  if (launch.calldataDigests.launchKeccak256.toLowerCase() !== launchCalldataKeccak256) {
    throw new Error('Genesis builder launch calldata digest mismatch');
  }
  const automated = launch.launchMode === 'automated';
  const audit = validateAudit(input.audit, repository.commit, automated);
  const governance = validateGovernance(input.governance, launch);
  const timing = validateTiming(input.cadence, input.timingApproval, launch, createdAt);
  const forkRehearsal = validateFork(input.forkRehearsal, automated);
  const safeCeremony = validateSafeCeremony(input.safeCeremony, launch, launchCalldataKeccak256);
  const auctionBinding = validateAuctionBinding(input.safeCeremony?.auctionBinding, launch, createdAt);

  const launchSummary = {
    artifactsSha256: sha256Hex(canonicalJson(launch)),
    launchMode: launch.launchMode,
    automation: launch.automation,
    participants: launch.participants,
    allocation: launch.allocation,
    timeline: launch.timeline,
    pricing: launch.pricing,
    graduation: launch.graduation,
    supplySchedule: launch.supplySchedule,
    safeTransactions: launch.safeTransactions,
    launchCalldataKeccak256,
  };
  const body = {
    schemaVersion: 1,
    status: automated ? (auctionBinding.status === 'pending_creation'
      ? 'ready_for_safe_launch_requires_auction_binding' : 'ready_for_auction_binding') : 'ready_for_safe_execution',
    createdAt,
    chainId: 4663,
    repository,
    externalStack: launch.stack,
    launch: launchSummary,
    audit,
    governance,
    timing,
    forkRehearsal,
    safeCeremony,
    auctionBinding,
    safety: {
      unsigned: true,
      broadcastsTransactions: false,
      readsPrivateKeys: false,
      externalAuditAuthenticityRequiresHumanVerification: true,
      safeApprovalsRemainExternal: true,
    },
  };
  return { ...body, manifestSha256: sha256Hex(canonicalJson(body)) };
}
