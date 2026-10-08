#!/usr/bin/env node
// Read-only primary-chain and optional ALREADY PREPARED local-fork verification.
// This does not create a fork, execute transactions, sign, or broadcast.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createPublicClient, http, parseAbi, keccak256 } from 'viem';
import { buildGenesisAuctionDeploymentPlan, loadGenesisAuctionArtifact } from './genesis-auction-deployment-plan.js';
import { genesisSnapshotTransport } from '../src/genesisrpc.js';

const sha = code => createHash('sha256').update(Buffer.from(code.slice(2), 'hex')).digest('hex');
const equal = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const assert = (ok, message) => { if (!ok) throw Error(message); };
const LIVE_ABI = parseAbi(['function totalSupply() view returns(uint256)', 'function decimals() view returns(uint8)',
  'function balanceOf(address) view returns(uint256)', 'function minter() view returns(address)', 'function sellTaxBps() view returns(uint256)',
  'function ammPairs(address) view returns(bool)', 'function poolManager() view returns(address)', 'function permit2() view returns(address)',
  'function getOwners() view returns(address[])', 'function getThreshold() view returns(uint256)', 'function arbBlockNumber() view returns(uint256)']);

function sourceRuntimeMatches(artifact, code) {
  const actual = Buffer.from(code.slice(2), 'hex'), template = Buffer.from(artifact.runtimeTemplate.slice(2), 'hex');
  if (actual.length !== template.length) return false;
  for (const ranges of Object.values(artifact.evidence.immutableReferences)) for (const { start, length } of ranges) {
    actual.fill(0, start, start + length); template.fill(0, start, start + length);
  }
  return actual.equals(template);
}

/** Always signingReady=false: a successful technical check is not human authorization or CI approval. */
export async function verifyGenesisAuctionPreflight({ candidate, evidence, evidenceSha256, client, forkClient = null, nowMs = Date.now() }) {
  const input = candidate?.input;
  assert(input && input.chainId === 4663 && input.localRehearsal === false, 'Explicit production candidate required');
  assert(candidate.activationReady === false && candidate.status === 'CANDIDATE_NOT_APPROVED_NOT_READY', 'Candidate must remain unapproved');
  assert(equal(candidate.evidenceSha256, evidenceSha256), 'Candidate evidence hash mismatch');
  assert(evidence?.canonicalSnapshotRechecked && evidence.chainId === 4663, 'Resolved primary-chain observation evidence required');
  assert(equal(input.observation.blockHash, evidence.observation.blockHash)
    && input.observation.blockNumber === evidence.observation.blockNumber, 'Candidate observation differs from resolved evidence');
  const plan = buildGenesisAuctionDeploymentPlan({ ...input, localRehearsal: true });
  assert(await client.getChainId() === 4663, 'Wrong primary chain');
  const head = await client.getBlock();
  assert(typeof head.number === 'bigint' && /^0x[0-9a-f]{64}$/i.test(head.hash), 'Incomplete primary head');
  const age = nowMs / 1000 - Number(head.timestamp);
  assert(Number.isFinite(age) && age >= -30 && age <= 120, 'Stale primary head');
  const read = (address, functionName, args = []) => client.readContract({ address, abi: LIVE_ABI, functionName, args, blockNumber: head.number });
  const runtimeChecks = [];
  for (const [name, pin] of Object.entries(input.external)) {
    const code = await client.getCode({ address: pin.address, blockNumber: head.number });
    assert(code && code !== '0x' && equal(keccak256(code), pin.runtimeHash), `Primary runtime changed: ${name}`);
    runtimeChecks.push({ name, address: pin.address, keccak256: keccak256(code), sha256: sha(code), bytes: (code.length - 2) / 2 });
  }
  const factoryCode = await client.getCode({ address: input.create2.factory, blockNumber: head.number });
  assert(factoryCode && factoryCode !== '0x' && equal(keccak256(factoryCode), input.create2.runtimeHash)
    && equal(keccak256(factoryCode), '0x2fa86add0aed31f33a762c9d88e807c475bd51d0f52bd0955754b2608f7e4989'), 'CREATE2 salt-prefix factory differs from reviewed runtime');
  runtimeChecks.push({ name: 'factory', address: input.create2.factory, keccak256: keccak256(factoryCode), sha256: sha(factoryCode) });
  const [nonce, deployerCode, safeCode, balance, supply, decimals, minter, tax, managerTaxed, pmManager, pmPermit,
    owners, threshold, native, arbCode] = await Promise.all([
    client.getTransactionCount({ address: input.roles.deployer, blockNumber: head.number }),
    client.getCode({ address: input.roles.deployer, blockNumber: head.number }),
    client.getCode({ address: input.roles.safe, blockNumber: head.number }),
    read(input.external.omr.address, 'balanceOf', [input.roles.safe]), read(input.external.omr.address, 'totalSupply'),
    read(input.external.omr.address, 'decimals'), read(input.external.omr.address, 'minter'), read(input.external.omr.address, 'sellTaxBps'),
    read(input.external.omr.address, 'ammPairs', [input.external.poolManager.address]), read(input.external.positionManager.address, 'poolManager'),
    read(input.external.positionManager.address, 'permit2'), read(input.roles.safe, 'getOwners'), read(input.roles.safe, 'getThreshold'),
    read('0x0000000000000000000000000000000000000064', 'arbBlockNumber'),
    client.getCode({ address: '0x0000000000000000000000000000000000000064', blockNumber: head.number }),
  ]);
  assert(String(nonce) === input.startingNonce && (!deployerCode || deployerCode === '0x'), 'Deployment EOA or frozen nonce changed');
  assert(safeCode && equal(keccak256(safeCode), evidence.codes.safe.keccak256), 'Safe proxy runtime changed');
  assert(BigInt(threshold) === 2n && owners.length >= 2 && JSON.stringify(owners.map(x => x.toLowerCase()).sort())
    === JSON.stringify(evidence.reads.safeOwners.map(x => x.toLowerCase()).sort()), 'Safe owner/threshold record changed');
  assert(BigInt(supply) === BigInt(input.allocation.totalSupply) && Number(decimals) === 18 && BigInt(balance) === BigInt(supply), '100M supply or full Safe inventory changed');
  assert(equal(minter, '0x' + '0'.repeat(40)) && BigInt(tax) === 0n && managerTaxed === false, 'Minter/tax configuration differs from reviewed funding assumptions');
  assert(equal(pmManager, input.external.poolManager.address) && equal(pmPermit, input.external.permit2.address), 'Periphery binding changed');
  assert(arbCode && equal(keccak256(arbCode), evidence.codes.arbSys.keccak256), 'Native clock implementation changed');
  assert(input.nativeClock.mode === 'arbsys', 'Successful actual ArbSys call requires the production constructor to select ArbSys');
  assert(BigInt(native) < BigInt(input.auction.startBlock), 'Auction start is no longer safely in the future');
  const canonicalEvidence = await client.getBlock({ blockNumber: BigInt(input.observation.blockNumber) });
  assert(equal(canonicalEvidence.hash, input.observation.blockHash), 'Referenced observation was reorganized');
  for (const s of input.nativeClock.samples) {
    const b = await client.getBlock({ blockNumber: BigInt(s.rpcBlock) });
    const original = evidence.nativeClock.samples.find(x => x.rpcBlock === s.rpcBlock);
    assert(original && equal(b.hash, original.blockHash) && String(b.timestamp) === s.timestamp && original.nativeBlock === s.nativeBlock, 'Native calibration header/evidence mismatch');
  }
  const newlyCreated = [...Object.values(plan.addresses), plan.internalValidatorAddress, plan.internalScheduleStoreAddress];
  for (const address of newlyCreated) {
    const code = await client.getCode({ address, blockNumber: head.number });
    assert(!code || code === '0x', `Counterfactual deployment address already occupied: ${address}`);
  }
  const forkSnapshots = [];
  if (forkClient) {
    assert(await forkClient.getChainId() === 4663, 'Local fork uses wrong chain');
    const forkHead = await forkClient.getBlock();
    for (const [name, pin] of Object.entries(input.external)) {
      const code = await forkClient.getCode({ address: pin.address, blockNumber: forkHead.number });
      assert(code && equal(keccak256(code), pin.runtimeHash), `Local fork external dependency differs from actual primary runtime: ${name}`);
    }
    const forkArbCode = await forkClient.getCode({ address: '0x0000000000000000000000000000000000000064', blockNumber: forkHead.number });
    assert(forkArbCode && equal(keccak256(forkArbCode), evidence.codes.arbSys.keccak256), 'Local fork must preserve actual ArbSys code while reproducing constructor selection');
    for (const [role, contract] of [['polFunding', 'OmertaReserveFundingV2'], ['reserveFunding', 'OmertaReserveFundingV2'],
      ['coordinator', 'OmertaAuctionCoordinatorV2'], ['hook', 'OmertaHookV2'], ['auction', 'OmertaGuardedAuction'], ['validator', 'GenesisCharacterBidValidation']]) {
      const address = role === 'validator' ? plan.internalValidatorAddress : plan.addresses[role];
      const code = await forkClient.getCode({ address, blockNumber: forkHead.number }), artifact = loadGenesisAuctionArtifact(contract);
      assert(code && code !== '0x' && sourceRuntimeMatches(artifact, code), `Local fork runtime not compiled reviewed source: ${role}`);
      if (role === 'auction') {
        const ranges = artifact.evidence.immutableReferences[artifact.nativeClockImmutableId];
        assert(artifact.nativeClockImmutableId && ranges?.length, 'Compiler did not resolve the reviewed native-clock immutable');
        for (const { start, length } of ranges)
          assert(BigInt('0x' + code.slice(2 + start * 2, 2 + (start + length) * 2)) === 1n,
            'Local fork auction constructor selected fallback clock instead of actual production ArbSys');
      }
      if (role === 'coordinator') for (const [name, dependency] of [['_managerHash', 'poolManager'], ['_positionsHash', 'positionManager'], ['_permitHash', 'permit2'], ['_tokenHash', 'omr']]) {
        const ranges = artifact.evidence.immutableReferences[artifact.privateDependencyImmutableIds[name]];
        assert(ranges?.length, `Compiler did not resolve private dependency pin: ${name}`);
        for (const { start, length } of ranges) assert(equal('0x' + code.slice(2 + start * 2, 2 + (start + length) * 2), input.external[dependency].runtimeHash),
          `Local fork constructor captured wrong private dependency hash: ${name}`);
      }
      forkSnapshots.push({ name: role, address, code, keccak256: keccak256(code), sha256: sha(code), bytes: (code.length - 2) / 2 });
    }
    const store = await forkClient.getCode({ address: plan.internalScheduleStoreAddress, blockNumber: forkHead.number });
    assert(equal(store, plan.internalScheduleRuntime), 'Local fork schedule store differs from exact approved schedule');
    forkSnapshots.push({ name: 'scheduleStore', address: plan.internalScheduleStoreAddress, code: store, keccak256: keccak256(store), sha256: sha(store), bytes: (store.length - 2) / 2 });
    const getters = [
      ['polFunding', 'safe', input.roles.safe], ['polFunding', 'omr', input.external.omr.address], ['polFunding', 'tranche', 0],
      ['reserveFunding', 'safe', input.roles.safe], ['reserveFunding', 'omr', input.external.omr.address], ['reserveFunding', 'tranche', 5],
      ['coordinator', 'configurator', input.roles.deployer], ['coordinator', 'chainId', 4663],
      ['coordinator', 'safe', input.roles.safe], ['coordinator', 'liquidityOwner', input.roles.safe], ['coordinator', 'familyYieldTreasury', input.roles.safe],
      ['coordinator', 'characterNft', input.external.characterNft.address], ['coordinator', 'omr', input.external.omr.address],
      ['coordinator', 'poolManager', input.external.poolManager.address], ['coordinator', 'positionManager', input.external.positionManager.address],
      ['coordinator', 'permit2', input.external.permit2.address], ['coordinator', 'tokenReserve', input.tokenReserve], ['coordinator', 'auction', plan.addresses.auction],
      ['coordinator', 'characterNftCodeHash', input.external.characterNft.runtimeHash],
      ['coordinator', 'auctionCodeHash', forkSnapshots.find(x => x.name === 'auction').keccak256],
      ['coordinator', 'validatorCodeHash', forkSnapshots.find(x => x.name === 'validator').keccak256],
      ['coordinator', 'hookCodeHash', forkSnapshots.find(x => x.name === 'hook').keccak256],
      ['hook', 'poolManager', input.external.poolManager.address], ['hook', 'omr', input.external.omr.address], ['hook', 'authorized', plan.addresses.coordinator],
      ['hook', 'poolFee', input.hook.poolFee], ['hook', 'tickSpacing', input.hook.tickSpacing], ['hook', 'epochDuration', input.hook.epochDuration],
      ['hook', 'openingBlocks', 0], ['hook', 'openingBuyBps', 0], ['hook', 'openingMaxBuyQuote', 0], ['hook', 'surgeFullTicks', input.hook.surgeFullTicks],
      ['hook', 'governanceSafe', input.roles.safe], ['hook', 'opsRecipient', input.hookGovernance.fixedFounderRecipient],
      ['hook', 'OPS_SELL_BPS', 200], ['hook', 'TAX_CONFIG_DELAY', 172800], ['hook', 'TAX_EXECUTION_SAFE_ONLY', true],
      ['hook', 'baseSellBps', 900], ['hook', 'queuedTaxHash', '0x' + '0'.repeat(64)], ['hook', 'queuedTaxExecuteAfter', 0], ['hook', 'taxConfigNonce', 0],
      ['auction', 'token', input.external.omr.address], ['auction', 'characterNft', input.external.characterNft.address], ['auction', 'launchGate', plan.addresses.coordinator],
      ['auction', 'fundsRecipient', plan.addresses.coordinator], ['auction', 'tokensRecipient', input.roles.safe], ['auction', 'currency', '0x' + '0'.repeat(40)],
      ['auction', 'validationHook', plan.internalValidatorAddress], ['auction', 'totalSupply', input.auction.totalSupply], ['auction', 'minimumRaiseWei', input.auction.requiredCurrencyRaised],
      ['auction', 'launchGateCodeHash', forkSnapshots.find(x => x.name === 'coordinator').keccak256], ['auction', 'launchChainId', 4663],
      ['auction', 'startBlock', input.auction.startBlock], ['auction', 'endBlock', input.auction.endBlock], ['auction', 'claimBlock', input.auction.claimBlock],
      ['auction', 'floorPrice', input.auction.floorPrice], ['auction', 'tickSpacing', input.auction.tickSpacing],
      ['validator', 'characterNft', input.external.characterNft.address], ['validator', 'omr', input.external.omr.address], ['validator', 'approvedSupply', input.allocation.totalSupply],
      ['validator', 'characterNftCodeHash', input.external.characterNft.runtimeHash], ['validator', 'omrCodeHash', input.external.omr.runtimeHash], ['validator', 'eligibilityChainId', 4663],
    ];
    [...input.roles.hookRecipients, plan.addresses.polFunding, plan.addresses.reserveFunding].forEach((recipient, i) => getters.push(['hook', 'recipients', recipient, [BigInt(i)]]));
    for (const [role, functionName, expected, args = []] of getters) {
      const snap = forkSnapshots.find(x => x.name === role), contract = role === 'validator' ? 'GenesisCharacterBidValidation'
        : role === 'auction' ? 'OmertaGuardedAuction' : role === 'hook' ? 'OmertaHookV2' : role === 'coordinator' ? 'OmertaAuctionCoordinatorV2' : 'OmertaReserveFundingV2';
      const value = await forkClient.readContract({ address: snap.address, abi: loadGenesisAuctionArtifact(contract).abi, functionName, args, blockNumber: forkHead.number });
      assert(equal(value, expected), `Local fork constructor/bind getter mismatch: ${role}.${functionName}`);
    }
    const key = await forkClient.readContract({ address: plan.addresses.coordinator, abi: loadGenesisAuctionArtifact('OmertaAuctionCoordinatorV2').abi,
      functionName: 'poolKey', blockNumber: forkHead.number });
    assert(equal(key.currency0 ?? key[0], '0x' + '0'.repeat(40)) && equal(key.currency1 ?? key[1], input.external.omr.address)
      && equal(key.fee ?? key[2], input.hook.poolFee) && equal(key.tickSpacing ?? key[3], input.hook.tickSpacing)
      && equal(key.hooks ?? key[4], plan.addresses.hook), 'Local fork coordinator pool key differs from approved constructor plan');
    const tax = await forkClient.readContract({ address: plan.addresses.hook, abi: loadGenesisAuctionArtifact('OmertaHookV2').abi,
      functionName: 'taxConfig', blockNumber: forkHead.number });
    const initialTax = [tax.rwaBps ?? tax[0], tax.communityBps ?? tax[1], tax.polBps ?? tax[2], tax.surgeMaxBps ?? tax[3]].map(Number);
    assert(JSON.stringify(initialTax) === JSON.stringify([160, 240, 300, 100]), 'Initial local-fork tax buckets differ from the reviewed unqueued constructor state');
    const end = await forkClient.getBlock({ blockNumber: forkHead.number }); assert(equal(end.hash, forkHead.hash), 'Local fork changed during verification');
  }
  const finalHead = await client.getBlock({ blockNumber: head.number });
  assert(equal(finalHead.hash, head.hash) && await client.getChainId() === 4663, 'Primary head reorganized during preflight');
  return { status: 'TECHNICAL_PREFLIGHT_NOT_AUTHORIZATION', signingReady: false, chainId: 4663, sourceRevision: input.sourceRevision,
    sourceCommitted: plan.workingTreeMatchesRevision, snapshot: { blockNumber: String(head.number), blockHash: head.hash, timestamp: String(head.timestamp) },
    liveChecks: { nonce: String(nonce), supplyWei: String(supply), safeBalanceWei: String(balance), owners, threshold: String(threshold), nativeClock: String(native), runtimeChecks },
    forkVerified: Boolean(forkClient), forkSnapshots,
    forkNativeClock: forkClient ? { constructorArbSysSelectionVerified: true, matchesSuccessfulPrimaryCall: true,
      nativeExecutionProof: false, limitation: 'A local fork may mock ArbSys to reproduce constructor selection; that does not prove native execution on the production chain.' } : null,
    auxiliaryRuntimeChecks: forkSnapshots.filter(x => ['validator', 'scheduleStore'].includes(x.name)).map(({ name, address, sha256 }) => ({ name, address, sha256 })),
    deploymentTransactions: plan.deployments, safeFundingCalls: plan.safeFundingCalls, deployerBindCall: plan.deployerBindCall,
    unresolved: [!plan.workingTreeMatchesRevision && 'Reviewed source commit/artifact refresh', !forkClient && 'Actual five-contract/two-child bound local-fork snapshots',
      'Signer key availability and gas funding', 'Human fee/surge/epoch/recipient and exact packet approval', 'Final CI/reviewer/source/evidence checks'].filter(Boolean) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [file, forkUrl] = process.argv.slice(2); assert(file && process.argv.length <= 4, 'Usage: node tools/genesis-auction-preflight.js <candidate.json> [http://127.0.0.1:port]');
    if (forkUrl) assert(/^http:\/\/(127\.0\.0\.1|localhost):[0-9]+\/?$/.test(forkUrl), 'Fork URL must be explicit local loopback');
    const candidate = JSON.parse(fs.readFileSync(file, 'utf8')), raw = fs.readFileSync(candidate.evidencePath);
    const result = await verifyGenesisAuctionPreflight({ candidate, evidence: JSON.parse(raw), evidenceSha256: createHash('sha256').update(raw).digest('hex'),
      client: createPublicClient({ transport: genesisSnapshotTransport(http('https://rpc.mainnet.chain.robinhood.com/', { timeout: 15000, retryCount: 0 })) }),
      forkClient: forkUrl ? createPublicClient({ transport: http(forkUrl, { timeout: 15000, retryCount: 0 }) }) : null });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (e) { process.stderr.write(`genesis-auction-preflight: ${e.message}\n`); process.exitCode = 1; }
}
