import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeAbiParameters, decodeFunctionData, getAddress, getContractAddress, keccak256, concatHex, parseAbi } from 'viem';
import { buildGenesisAuctionDeploymentPlan, genesisAuctionArtifactInventory, loadGenesisAuctionArtifact, GENESIS_AUCTION_ARTIFACTS } from '../tools/genesis-auction-deployment-plan.js';

// Synthetic 31337 fixture only. No live recipient, address, cadence, or launch recommendation.
const root = fileURLToPath(new URL('../omerta-contracts/', import.meta.url));
const A = n => getAddress(`0x${BigInt(n).toString(16).padStart(40, '0')}`), H = `0x${'19'.repeat(32)}`, E = 10n ** 18n;
const inventory = genesisAuctionArtifactInventory(), clone = x => JSON.parse(JSON.stringify(x));
const input = {
  schemaVersion: 1, chainId: 31337, localRehearsal: true, sourceRevision: inventory.sourceRevision, startingNonce: '17',
  roles: { deployer: A(100), safe: A(101), liquidityOwner: A(102), treasury: A(103), vig: A(104), founder: A(105), unsoldRecipient: A(106), hookRecipients: [A(107), A(108), A(109)] },
  external: Object.fromEntries(['omr', 'poolManager', 'positionManager', 'permit2', 'characterNft'].map((k, i) => [k, { address: A(200 + i), runtimeHash: H }])),
  create2: { factory: A(300), runtimeHash: H, kind: 'salt-prefix', saltStart: '0', maxAttempts: 200000 },
  artifactHashes: inventory.artifactHashes, sourceHashes: inventory.sourceHashes,
  observation: { blockNumber: '1000', blockHash: H, timestamp: '2000000000' },
  nativeClock: { chainId: 31337, mode: 'block.number', currentBlock: '1000', evidenceSha256: '21'.repeat(32), minMillisecondsPerBlock: '25920', maxMillisecondsPerBlock: '25920',
    samples: [{ nativeBlock: '900', rpcBlock: '900', timestamp: '1999997408' }, { nativeBlock: '1000', rpcBlock: '1000', timestamp: '2000000000' }] },
  hook: { poolFee: 3000, tickSpacing: 60, opening: { blocks: 200, buyBps: 500, maxBuyQuote: String(10n * E) }, surgeFullTicks: 100, epochDuration: 60 },
  auction: { totalSupply: String(1100n * E), startBlock: '1010', endBlock: '11010', claimBlock: '11010', tickSpacing: '2',
    floorPrice: String(((1n << 96n) / 1000n) / 2n * 2n), requiredCurrencyRaised: String(E), auctionStepsData: '0x0003e80000002710' },
  tokenReserve: String(1000n * E),
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
assert.equal(coordinator[4], plan.addresses.hook); assert.equal(coordinator[8], input.roles.liquidityOwner);
const hook = decodeConstructor('OmertaHookV2', `0x${plan.deployments[3].data.slice(66)}`);
assert.equal(hook[2], plan.addresses.coordinator); assert.deepEqual(hook[5], [...input.roles.hookRecipients, plan.addresses.polFunding, plan.addresses.reserveFunding]);
assert.equal(decodeConstructor('OmertaReserveFundingV2', plan.deployments[0].data)[2], 0);
assert.equal(decodeConstructor('OmertaReserveFundingV2', plan.deployments[1].data)[2], 5);
const auction = decodeConstructor('OmertaGuardedAuction', plan.deployments[4].data);
assert.equal(auction[2].currency, A(0)); assert.equal(auction[2].validationHook, A(0));
assert.equal(auction[2].fundsRecipient, plan.addresses.coordinator); assert.equal(auction[4], input.external.characterNft.address);
assert.equal(coordinator[12], input.external.characterNft.address);
assert.equal(plan.internalValidatorAddress, getContractAddress({ from: plan.addresses.auction, nonce: 1n }));
assert.equal(plan.inventory.totalSafeOmrRequired, String(2100n * E));
assert.deepEqual(plan.inventory.auctionDurationSecondsBounds, ['259200', '259200']);
assert.deepEqual(Object.keys(plan.finalManifest.contracts).sort(), ['auction','characterNft','coordinator','omr','validator']);
assert.equal(plan.finalManifest.contracts.coordinator.runtimeCodeHash, null, 'Cannot invent constructor-immutable runtime hash before deployment');
assert.equal(plan.finalManifest.dependencies.hook.runtimeCodeHash, null);
assert(!JSON.stringify(plan).includes('playerSale'), 'No gameplay tranche is planned');
const transfer = decodeFunctionData({ abi: parseAbi(['function transfer(address,uint256) returns(bool)']), data: plan.safeFundingCalls[0].data });
assert.deepEqual(transfer.args, [plan.addresses.auction, 1100n * E]);
assert(plan.deployments.every(x => x.from === input.roles.deployer && x.value === '0x0'));
assert(plan.safeFundingCalls.every(x => x.from === input.roles.safe && x.value === '0x0'));
let negative = 0;
function bad(edit, pattern) { const v = clone(input); edit(v); assert.throws(() => buildGenesisAuctionDeploymentPlan(v), pattern); negative++; }
bad(v => delete v.roles.safe, /missing/);
bad(v => v.privateKey = 'never read', /Forbidden/);
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
bad(v => v.roles.unsoldRecipient = plan.addresses.auction, /Recipient cannot/);
bad(v => v.playerSale = {}, /unknown field/);
bad(v => v.observation.wallets = [], /unknown field/);
bad(v => { v.nativeClock.minMillisecondsPerBlock = '26000'; v.nativeClock.maxMillisecondsPerBlock = '26000'; }, /contradict cadence/);
const changedNonce = clone(input); changedNonce.startingNonce = '23';
assert.notEqual(buildGenesisAuctionDeploymentPlan(changedNonce).addresses.auction, plan.addresses.auction);
const arb = clone(input); arb.nativeClock.mode = 'arbsys'; arb.nativeClock.currentBlock = '500';
arb.nativeClock.samples = [{ nativeBlock: '400', rpcBlock: '900', timestamp: '1999997408' }, { nativeBlock: '500', rpcBlock: '1000', timestamp: '2000000000' }];
assert.equal(buildGenesisAuctionDeploymentPlan(arb).nativeClock.currentBlock, '500', 'Native clock is distinct from RPC block for Orbit chains');
const longerCliff = clone(input); longerCliff.auction.claimBlock = '12000';
assert.equal(buildGenesisAuctionDeploymentPlan(longerCliff).deployments.length, 5, 'No forced 48-hour player window');
const mainnet = clone(input); mainnet.chainId = 4663; mainnet.nativeClock.chainId = 4663;
assert.equal(buildGenesisAuctionDeploymentPlan(mainnet).deployments[0].chainId, 4663, 'Robinhood Chain is accepted with exact chain-bound clock and artifact inputs');
mainnet.localRehearsal = false;
if (inventory.workingTreeMatchesRevision) assert.equal(buildGenesisAuctionDeploymentPlan(mainnet).deployments[0].chainId, 4663);
else assert.throws(() => buildGenesisAuctionDeploymentPlan(mainnet), /Production planning requires committed source bytes/, 'Valid production chain proceeds to the separate source-cleanliness gate');

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
console.log(`Unsigned NFT-gated auction planner PASS: real artifacts, five nonces, all-public inventory, NFT coordinator/auction args, adapters/funding, 72h native schedule, ${negative} rejected manifests, source/ABI/compiler/size tampering. No eligibility roster, signing or broadcast.`);
