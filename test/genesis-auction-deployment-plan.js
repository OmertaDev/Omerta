import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeAbiParameters, decodeFunctionData, getAddress, getContractAddress, keccak256, concatHex, parseAbi } from 'viem';
import { buildGenesisAuctionDeploymentPlan, genesisAuctionArtifactInventory, loadGenesisAuctionArtifact, GENESIS_AUCTION_ARTIFACTS, genesisAuctionFloor, uniformGenesisAuctionSchedule } from '../tools/genesis-auction-deployment-plan.js';

// Synthetic 31337 fixture only. No live recipient, address, cadence, or launch recommendation.
const root = fileURLToPath(new URL('../omerta-contracts/', import.meta.url));
const A = n => getAddress(`0x${BigInt(n).toString(16).padStart(40, '0')}`), H = `0x${'19'.repeat(32)}`, E = 10n ** 18n;
const inventory = genesisAuctionArtifactInventory(), clone = x => JSON.parse(JSON.stringify(x));
const pricing = genesisAuctionFloor(40000000n * E);
const input = {
  schemaVersion: 1, chainId: 31337, localRehearsal: true, sourceRevision: inventory.sourceRevision, startingNonce: '17',
  roles: { deployer: A(100), safe: A(101), hookRecipients: [A(107), A(108), A(109)] },
  external: Object.fromEntries(['omr', 'poolManager', 'positionManager', 'permit2', 'characterNft'].map((k, i) => [k, { address: A(200 + i), runtimeHash: H }])),
  create2: { factory: A(300), runtimeHash: H, kind: 'salt-prefix', saltStart: '0', maxAttempts: 200000 },
  artifactHashes: inventory.artifactHashes, sourceHashes: inventory.sourceHashes,
  observation: { blockNumber: '1000', blockHash: H, timestamp: '2000000000' },
  nativeClock: { chainId: 31337, mode: 'block.number', currentBlock: '1000', evidenceSha256: '21'.repeat(32), minMillisecondsPerBlock: '43200', maxMillisecondsPerBlock: '43200',
    samples: [{ nativeBlock: '900', rpcBlock: '900', timestamp: '1999995680' }, { nativeBlock: '1000', rpcBlock: '1000', timestamp: '2000000000' }] },
  hook: { poolFee: 3000, tickSpacing: 60, opening: { blocks: 0, buyBps: 0, maxBuyQuote: '0' }, surgeFullTicks: 100, epochDuration: 3600 },
  auction: { totalSupply: String(40000000n * E), startBlock: '1010', endBlock: '11010', claimBlock: '11010', tickSpacing: pricing.tickSpacing,
    floorPrice: pricing.floorPrice, requiredCurrencyRaised: String(10n * E), auctionStepsData: '0x0003e80000002710' },
  hookGovernance: { governanceSafe: A(101), fixedFounderRecipient: A(107), fixedFounderBps: 200, delaySeconds: 172800, executionSafeOnly: true },
  tokenReserve: String(20000000n * E),
  allocation: { totalSupply: String(100000000n * E), decimals: 18, safeAddress: A(101), safeBalance: String(100000000n * E), observationBlockNumber: '1000', observationBlockHash: H, omrRuntimeHash: H, evidenceSha256: '31'.repeat(32) },
};
const plan = buildGenesisAuctionDeploymentPlan(input);
assert.equal(plan.activationReady, false); assert.equal(plan.strategiesReady, false); assert.equal(plan.fundingAdaptersBound, false);
assert.equal(plan.deployments.length, 5); assert.equal(plan.safeFundingCalls.length, 3);
assert.deepEqual(plan.deployments.map(x => x.nonce), ['17', '18', '19', '20', '21']);
for (const [name, offset] of [['polFunding', 0], ['reserveFunding', 1], ['coordinator', 2], ['auction', 4]])
  assert.equal(plan.addresses[name], getContractAddress({ from: input.roles.deployer, nonce: 17n + BigInt(offset) }));
assert.equal(BigInt(plan.addresses.hook) & 0x3fffn, 0x35c4n);
assert.equal(plan.deployments[3].to, input.create2.factory);
assert.equal(plan.deployerBindCall.from, input.roles.deployer);
const bind = decodeFunctionData({ abi: loadGenesisAuctionArtifact('OmertaAuctionCoordinatorV2').abi, data: plan.deployerBindCall.data });
assert.deepEqual(bind.args, [plan.addresses.auction]);
const decodeConstructor = (contract, data) => {
  const a = loadGenesisAuctionArtifact(contract);
  return decodeAbiParameters(a.abi.find(x => x.type === 'constructor').inputs, `0x${data.slice(a.bytecode.length)}`);
};
const coordinator = decodeConstructor('OmertaAuctionCoordinatorV2', plan.deployments[2].data);
assert.equal(coordinator[4], plan.addresses.hook); assert.equal(coordinator[8], input.roles.safe);
const hook = decodeConstructor('OmertaHookV2', `0x${plan.deployments[3].data.slice(66)}`);
assert.equal(hook.length, 10); assert.equal(hook[9], input.roles.safe); assert.deepEqual(plan.finalManifest.hookGovernance, input.hookGovernance);
assert.equal(hook[2], plan.addresses.coordinator); assert.deepEqual(hook[5], [...input.roles.hookRecipients, plan.addresses.polFunding, plan.addresses.reserveFunding]);
assert.equal(decodeConstructor('OmertaReserveFundingV2', plan.deployments[0].data)[2], 0);
assert.equal(decodeConstructor('OmertaReserveFundingV2', plan.deployments[1].data)[2], 5);
const auction = decodeConstructor('OmertaGuardedAuction', plan.deployments[4].data);
assert.equal(auction[2].currency, A(0)); assert.equal(auction[2].validationHook, A(0));
assert.equal(auction[2].fundsRecipient, plan.addresses.coordinator); assert.equal(auction[4], input.external.characterNft.address);
assert.equal(coordinator[9], input.external.characterNft.address);
assert.equal(coordinator.length, 10, 'Constructor carries one Safe and no obsolete ETH split recipients');
assert.equal(plan.internalValidatorAddress, getContractAddress({ from: plan.addresses.auction, nonce: 1n }));
assert.deepEqual(plan.internalValidatorConstructorArgs, [input.external.characterNft.address, input.external.omr.address]);
assert.equal(plan.internalValidatorApprovedSupply, input.allocation.totalSupply);
assert.equal(plan.internalValidatorInitCodeHash, keccak256((await import('viem')).encodeDeployData({
  abi: loadGenesisAuctionArtifact('GenesisCharacterBidValidation').abi,
  bytecode: loadGenesisAuctionArtifact('GenesisCharacterBidValidation').bytecode,
  args: [input.external.characterNft.address, input.external.omr.address],
})));
assert.equal(plan.inventory.totalSafeOmrRequired, String(100000000n * E));
assert.equal(plan.inventory.initialFundingOmr, String(60000000n * E));
assert.equal(plan.inventory.bondHeldAtSafe, String(40000000n * E));
assert.equal(plan.inventory.expectedSafeBalanceAfterFunding, String(40000000n * E));
assert.equal(plan.inventory.bondActivated, false);
assert.equal(plan.deploymentAddressCount, 7);
assert.equal(plan.internalScheduleAddress, getContractAddress({ from: plan.addresses.auction, nonce: 2n }));
assert.equal(plan.internalScheduleRuntime, '0x00' + input.auction.auctionStepsData.slice(2));
assert.equal(plan.internalScheduleRuntimeHash, keccak256(plan.internalScheduleRuntime));
assert.equal(plan.finalManifest.policy.lpProceedsBps, 5000);
assert.equal(plan.finalManifest.policy.familySafe, input.roles.safe);
assert.equal(plan.finalManifest.policy.bondReserveCustodian, input.roles.safe);
assert.equal(auction[2].tokensRecipient, input.roles.safe);
assert.equal(plan.pricing.floorPrice, '19807040628566084398400');
assert.equal(plan.pricing.fullSaleAtFloorWei, String(10n * E));
assert.equal(plan.pricing.upwardRoundingFromRawFloorQ96, '15');
assert.equal(BigInt(input.auction.totalSupply) * (BigInt(pricing.floorPrice) + BigInt(pricing.tickSpacing)) / (1n << 96n), 101n * E / 10n,
  'Existing next 1% bid tick is separate from negligible UP floor alignment');
const rawDown = 10n * E * (1n << 96n) / BigInt(input.auction.totalSupply);
assert.equal(BigInt(input.auction.totalSupply) * (rawDown / 100n * 100n) / (1n << 96n), 10n * E - 1n,
  'Down-aligned full sale misses 10 ETH graduation by one wei');
assert.deepEqual(plan.inventory.auctionDurationSecondsBounds, ['432000', '432000']);
assert.deepEqual(Object.keys(plan.finalManifest.contracts).sort(), ['auction','characterNft','coordinator','omr','validator']);
assert.equal(plan.finalManifest.contracts.coordinator.runtimeCodeHash, null, 'Cannot invent constructor-immutable runtime hash before deployment');
assert.equal(plan.finalManifest.dependencies.hook.runtimeCodeHash, null);
assert(!JSON.stringify(plan).includes('playerSale'), 'No gameplay tranche is planned');
const transfer = decodeFunctionData({ abi: parseAbi(['function transfer(address,uint256) returns(bool)']), data: plan.safeFundingCalls[0].data });
assert.deepEqual(transfer.args, [plan.addresses.auction, 40000000n * E]);
assert(plan.deployments.every(x => x.from === input.roles.deployer && x.value === '0x0'));
assert(plan.safeFundingCalls.every(x => x.from === input.roles.safe && x.value === '0x0'));
let negative = 0;
function bad(edit, pattern) { const v = clone(input); edit(v); assert.throws(() => buildGenesisAuctionDeploymentPlan(v), pattern); negative++; }
bad(v => delete v.roles.safe, /missing/);
bad(v => v.privateKey = 'never read', /Forbidden/);
bad(v => delete v.allocation, /missing/);
bad(v => v.allocation.totalSupply = String(100000000n * E + 1n), /verified 100M/);
bad(v => v.allocation.decimals = 6, /18 decimals/);
bad(v => v.allocation.safeBalance = String(100000000n * E - 1n), /Safe must hold/);
bad(v => v.allocation.safeAddress = A(110), /bind the same/);
bad(v => v.allocation.observationBlockNumber = '999', /bind the same/);
bad(v => v.allocation.omrRuntimeHash = `0x${'88'.repeat(32)}`, /bind the same/);
bad(v => v.auction.totalSupply = String(39999999n * E), /approved 40%/);
bad(v => v.tokenReserve = String(19999999n * E), /approved 20%/);
bad(v => v.auction.requiredCurrencyRaised = String(9n * E), /approved 10 ETH/);
bad(v => v.auction.floorPrice = String(BigInt(pricing.floorPrice) + BigInt(pricing.tickSpacing)), /minimally UP/);
bad(v => v.roles.treasury = A(110), /unknown field/);
bad(v => delete v.hookGovernance, /missing/);
bad(v => v.hookGovernance.governanceSafe = A(110), /Committee tax governance/);
bad(v => v.hookGovernance.fixedFounderBps = 199, /Committee tax governance/);
bad(v => v.hookGovernance.delaySeconds = 86400, /Committee tax governance/);
bad(v => v.hookGovernance.executionSafeOnly = false, /Committee tax governance/);
bad(v => v.sourceRevision = '01'.repeat(20), /sourceRevision differs/);
bad(v => v.artifactHashes.OmertaGuardedAuction = '22'.repeat(32), /artifact hash mismatch/);
bad(v => v.sourceHashes['src/market-v2/OmertaAuctionCoordinatorV2.sol'] = '22'.repeat(32), /Source hash mismatch/);
bad(v => v.startingNonce = '18446744073709551615', /Nonce sequence/);
bad(v => v.roles.hookRecipients[0] = A(0), /nonzero address/);
bad(v => v.roles.hookRecipients.push(A(110)), /Three explicit/);
bad(v => v.roles.safe = v.roles.deployer, /nonce owner/);
bad(v => v.external.characterNft.runtimeHash = `0x${'00'.repeat(32)}`, /hash required/);
bad(v => v.nativeClock.chainId = 4663, /chain-bound/);
bad(v => v.localRehearsal = false, /31337 requires/);
bad(v => { v.chainId = 1; v.localRehearsal = false; }, /Only production chain 4663/, 'Wrong production chain must fail before dirty source validation');
bad(v => { v.chainId = 1; v.localRehearsal = true; }, /Only production chain 4663/);
bad(v => v.nativeClock.mode = 'rpc_latest', /clock mode/);
bad(v => v.nativeClock.currentBlock = '999', /differs from RPC/);
bad(v => v.nativeClock.samples[0].timestamp = '1999999999', /contradict cadence/);
bad(v => v.nativeClock.evidenceSha256 = '0'.repeat(64), /hash required/);
bad(v => v.hook.opening.buyBps = 1001, /policy bounds/);
bad(v => v.auction.startBlock = '999', /future/);
bad(v => v.auction.auctionStepsData = '0x0003e8000000270f', /schedule duration/);
bad(v => v.auction.claimBlock = '11009', /ordering/);
bad(v => v.auction.claimBlock = '12000', /claims start at closure/);
bad(v => { v.roles.safe = plan.addresses.auction; v.allocation.safeAddress = plan.addresses.auction; v.hookGovernance.governanceSafe = plan.addresses.auction; }, /Recipient cannot/);
bad(v => v.playerSale = {}, /unknown field/);
bad(v => v.observation.wallets = [], /unknown field/);
bad(v => { v.nativeClock.minMillisecondsPerBlock = '26000'; v.nativeClock.maxMillisecondsPerBlock = '26000'; }, /contradict cadence/);
const changedNonce = clone(input); changedNonce.startingNonce = '23';
assert.notEqual(buildGenesisAuctionDeploymentPlan(changedNonce).addresses.auction, plan.addresses.auction);
const arb = clone(input); arb.nativeClock.mode = 'arbsys'; arb.nativeClock.currentBlock = '500';
arb.nativeClock.samples = [{ nativeBlock: '400', rpcBlock: '900', timestamp: '1999995680' }, { nativeBlock: '500', rpcBlock: '1000', timestamp: '2000000000' }];
assert.equal(buildGenesisAuctionDeploymentPlan(arb).nativeClock.currentBlock, '500', 'Native clock is distinct from RPC block for Orbit chains');
const longerCliff = clone(input); longerCliff.auction.claimBlock = '12000';
assert.throws(() => buildGenesisAuctionDeploymentPlan(longerCliff), /claims start at closure/);
const mainnet = clone(input); mainnet.chainId = 4663; mainnet.nativeClock.chainId = 4663;
mainnet.roles.deployer = '0x5ae54b5555ae5dc9f899e03cb9aac74dccdc4e7e'; mainnet.roles.safe = '0xbe225658718dcb3865902437887a11830e4a9b10'; mainnet.allocation.safeAddress = mainnet.roles.safe; mainnet.roles.hookRecipients[0] = '0xa87b7a7eecb6f4c771445f5cba5bb0d4b29e5ced'; mainnet.hookGovernance.governanceSafe = mainnet.roles.safe; mainnet.hookGovernance.fixedFounderRecipient = mainnet.roles.hookRecipients[0]; mainnet.external.omr.address = '0x2e82f8c1cfd5172612b3af56088d7d68d920545d';
assert.equal(buildGenesisAuctionDeploymentPlan(mainnet).deployments[0].chainId, 4663, 'Robinhood Chain is accepted with exact chain-bound clock and artifact inputs');
mainnet.localRehearsal = false;
if (inventory.workingTreeMatchesRevision) assert.equal(buildGenesisAuctionDeploymentPlan(mainnet).deployments[0].chainId, 4663);
else assert.throws(() => buildGenesisAuctionDeploymentPlan(mainnet), /Production planning requires committed source bytes/, 'Valid production chain proceeds to the separate source-cleanliness gate');
const wrongSafe = clone(mainnet); wrongSafe.localRehearsal = true; wrongSafe.roles.safe = A(101); wrongSafe.allocation.safeAddress = A(101); wrongSafe.hookGovernance.governanceSafe = A(101);
assert.throws(() => buildGenesisAuctionDeploymentPlan(wrongSafe), /founder approval/);
for (const [edit, pattern] of [[v => { v.hook.poolFee = 500; }, /approved static LP fee/],
  [v => { v.hook.opening = { blocks: 200, buyBps: 500, maxBuyQuote: String(10n * E) }; }, /opening restrictions must be OFF/],
  [v => { v.hook.tickSpacing = 10; }, /tick spacing 60/], [v => { v.hook.epochDuration = 60; }, /epoch 3600/],
  [v => { v.hook.surgeFullTicks = 200; }, /surge calibration/]]) {
  const invalidProduction = clone(mainnet); invalidProduction.localRehearsal = true; edit(invalidProduction);
  assert.throws(() => buildGenesisAuctionDeploymentPlan(invalidProduction), pattern, 'Fork rehearsal cannot bypass production approvals');
}
const threeDay = clone(input); threeDay.nativeClock.minMillisecondsPerBlock = '25920'; threeDay.nativeClock.maxMillisecondsPerBlock = '25920'; threeDay.nativeClock.samples[0].timestamp = '1999997408';
assert.throws(() => buildGenesisAuctionDeploymentPlan(threeDay), /120 hours/);

for (const duration of [1n, 7n, 128n, 10000n, 36000n, 4320000n, 9999999n, 10000000n]) {
  const schedule = uniformGenesisAuctionSchedule(duration);
  assert(schedule.stepCount <= 256); assert.equal(schedule.auctionStepsData.length, 2 + schedule.stepCount * 16);
  let blocks = 0n, issued = 0n;
  for (const step of schedule.steps) {
    const rate = BigInt(step.mps), delta = BigInt(step.blockDelta); assert(delta > 0n);
    blocks += delta; issued += rate * delta;
    const deviation = issued * duration - 10000000n * blocks;
    assert((deviation < 0n ? -deviation : deviation) <= BigInt(schedule.maxCumulativeDeviationMpsCeil) * duration,
      'Every rate-boundary cumulative deviation stays within the disclosed segmented bound');
  }
  assert.equal(blocks, duration); assert.equal(issued, 10000000n, 'Vendor StepStorage exact weighted issuance validation');
}
assert.throws(() => uniformGenesisAuctionSchedule(0n), /duration/);
assert.throws(() => uniformGenesisAuctionSchedule(10000001n), /duration/);
const longSchedule = uniformGenesisAuctionSchedule(4320000n);
assert(BigInt(longSchedule.maxCumulativeDeviationMpsCeil) * 1000n < 10000000n, 'Even fast-L2 4.32M blocks stay below 0.1% cumulative rounding displacement');
const nonuniform = clone(input); nonuniform.auction.auctionStepsData = '0x0000000000001b58000d0600000003e8000d0500000007d0';
assert.throws(() => buildGenesisAuctionDeploymentPlan(nonuniform), /uniform schedule/,
  'A valid weighted schedule with all issuance in its final30% is rejected');

// Tamper actual artifact/source bytes in an isolated disposable tree, preserving real compiler metadata.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-genesis-planner-'));
try {
  const name = 'OmertaGuardedAuction', source = GENESIS_AUCTION_ARTIFACTS[name];
  const artifactPath = path.join('out', path.basename(source), `${name}.json`);
  const bytes = fs.readFileSync(path.join(root, artifactPath)), artifact = JSON.parse(bytes);
  for (const file of Object.keys(artifact.metadata.sources)) { fs.mkdirSync(path.dirname(path.join(temp, file)), { recursive: true }); fs.copyFileSync(path.join(root, file), path.join(temp, file)); }
  fs.mkdirSync(path.dirname(path.join(temp, artifactPath)), { recursive: true }); fs.writeFileSync(path.join(temp, artifactPath), bytes);
  assert.equal(loadGenesisAuctionArtifact(name, { contractsRoot: temp }).evidence.artifactSha256, inventory.artifactHashes[name]);
  fs.appendFileSync(path.join(temp, source), '\n// stale\n');
  assert.throws(() => loadGenesisAuctionArtifact(name, { contractsRoot: temp }), /stale artifact/);
  fs.copyFileSync(path.join(root, source), path.join(temp, source));
  const changed = JSON.parse(bytes); changed.abi = [];
  fs.writeFileSync(path.join(temp, artifactPath), JSON.stringify(changed));
  assert.throws(() => loadGenesisAuctionArtifact(name, { contractsRoot: temp }), /ABI mismatch/);
  const compiler = JSON.parse(bytes), metadata = JSON.parse(compiler.rawMetadata); metadata.settings.viaIR = true;
  compiler.rawMetadata = JSON.stringify(metadata); fs.writeFileSync(path.join(temp, artifactPath), JSON.stringify(compiler));
  assert.throws(() => loadGenesisAuctionArtifact(name, { contractsRoot: temp }), /compiler profile/);
  const oversized = JSON.parse(bytes); oversized.deployedBytecode.object = '0x' + '00'.repeat(24577);
  fs.writeFileSync(path.join(temp, artifactPath), JSON.stringify(oversized));
  assert.throws(() => loadGenesisAuctionArtifact(name, { contractsRoot: temp }), /runtime size/);
  const hugeCreation = JSON.parse(bytes); hugeCreation.bytecode.object = '0x' + '00'.repeat(49153);
  fs.writeFileSync(path.join(temp, artifactPath), JSON.stringify(hugeCreation));
  assert.throws(() => loadGenesisAuctionArtifact(name, { contractsRoot: temp }), /creation bytecode size/);
} finally { fs.rmSync(temp, { recursive: true }); }
console.log(`Unsigned NFT-gated auction planner PASS: real artifacts, five nonces, all-public inventory, NFT coordinator/auction args, adapters/funding, 120h native schedule, conserved40/20/40, fixedLP/50%ETHpolicy, ${negative} rejected manifests, source/ABI/compiler/size tampering. No eligibility roster, signing or broadcast.`);
