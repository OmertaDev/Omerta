import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { getAddress, keccak256 } from 'viem';
import { buildGenesisAuctionDeploymentPlan, genesisAuctionArtifactInventory, genesisAuctionFloor, loadGenesisAuctionArtifact } from '../tools/genesis-auction-deployment-plan.js';
import { verifyGenesisAuctionPreflight } from '../tools/genesis-auction-preflight.js';
import { genesisSnapshotRequest } from '../public/genesis-snapshot-rpc.js';
import { genesisSnapshotTransport } from '../src/genesisrpc.js';
import { createPublicClient, custom, parseAbi } from 'viem';

// Reuse the reviewed synthetic policy fixture initializer, not its executable tests.
const text = fs.readFileSync(new URL('./genesis-auction-deployment-plan.js', import.meta.url), 'utf8');
const ast = parse(text, { sourceType: 'module', ecmaVersion: 'latest' });
const declaration = ast.body.flatMap(n => n.declarations || []).find(n => n.id?.name === 'input');
const A = n => getAddress('0x' + BigInt(n).toString(16).padStart(40, '0')), H = '0x' + '19'.repeat(32), E = 10n ** 18n;
const base = vm.runInNewContext('(' + text.slice(declaration.init.start, declaration.init.end) + ')', {
  A, H, E, inventory: genesisAuctionArtifactInventory(), pricing: genesisAuctionFloor(40000000n * E),
});
base.chainId = 4663; base.localRehearsal = false; base.nativeClock.chainId = 4663; base.nativeClock.mode = 'arbsys'; base.startingNonce = '27';
base.roles.deployer = getAddress('0x5ae54b5555ae5dc9f899e03cb9aac74dccdc4e7e');
base.roles.safe = getAddress('0xbe225658718dcb3865902437887a11830e4a9b10'); base.allocation.safeAddress = base.roles.safe; base.hookGovernance.governanceSafe = base.roles.safe; base.roles.hookRecipients[0] = getAddress('0xa87b7a7eecb6f4c771445f5cba5bb0d4b29e5ced'); base.hookGovernance.fixedFounderRecipient = base.roles.hookRecipients[0];
base.external.omr.address = getAddress('0x2e82f8c1cfd5172612b3af56088d7d68d920545d');
base.hook.opening = { blocks: 0, buyBps: 0, maxBuyQuote: '0' };
const factoryCode = '0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3';
base.create2.runtimeHash = keccak256(factoryCode);
const externalCodes = {};
Object.entries(base.external).forEach(([name, pin], i) => { const code = '0x60' + String(i + 1).padStart(2, '0'); pin.runtimeHash = keccak256(code); externalCodes[pin.address.toLowerCase()] = code; });
base.allocation.omrRuntimeHash = base.external.omr.runtimeHash;
const plan = buildGenesisAuctionDeploymentPlan({ ...base, localRehearsal: true });
const artifactName = { polFunding: 'OmertaReserveFundingV2', reserveFunding: 'OmertaReserveFundingV2', coordinator: 'OmertaAuctionCoordinatorV2',
  hook: 'OmertaHookV2', auction: 'OmertaGuardedAuction', validator: 'GenesisCharacterBidValidation' };
const addresses = { ...plan.addresses, validator: plan.internalValidatorAddress, scheduleStore: plan.internalScheduleStoreAddress };
const fixtureCodes = Object.fromEntries(Object.entries(artifactName).map(([role, name]) => {
  const a = loadGenesisAuctionArtifact(name); let code = a.runtimeTemplate;
  if (role === 'auction') for (const { start, length } of a.evidence.immutableReferences[a.nativeClockImmutableId])
    code = code.slice(0, 2 + start * 2) + '1'.padStart(length * 2, '0') + code.slice(2 + (start + length) * 2);
  if (role === 'coordinator') for (const [name, dependency] of [['_managerHash', 'poolManager'], ['_positionsHash', 'positionManager'], ['_permitHash', 'permit2'], ['_tokenHash', 'omr']])
    for (const { start, length } of a.evidence.immutableReferences[a.privateDependencyImmutableIds[name]])
      code = code.slice(0, 2 + start * 2) + base.external[dependency].runtimeHash.slice(2).padStart(length * 2, '0') + code.slice(2 + (start + length) * 2);
  return [addresses[role].toLowerCase(), code];
}));
fixtureCodes[addresses.scheduleStore.toLowerCase()] = plan.internalScheduleRuntime;
const bindings = {
  polFunding: { safe: base.roles.safe, omr: base.external.omr.address, tranche: 0 },
  reserveFunding: { safe: base.roles.safe, omr: base.external.omr.address, tranche: 5 },
  coordinator: { configurator: base.roles.deployer, chainId: 4663, safe: base.roles.safe, liquidityOwner: base.roles.safe, familyYieldTreasury: base.roles.safe, characterNft: base.external.characterNft.address,
    omr: base.external.omr.address, poolManager: base.external.poolManager.address, positionManager: base.external.positionManager.address, permit2: base.external.permit2.address,
    tokenReserve: base.tokenReserve, auction: addresses.auction, characterNftCodeHash: base.external.characterNft.runtimeHash,
    auctionCodeHash: keccak256(fixtureCodes[addresses.auction.toLowerCase()]), validatorCodeHash: keccak256(fixtureCodes[addresses.validator.toLowerCase()]),
    hookCodeHash: keccak256(fixtureCodes[addresses.hook.toLowerCase()]),
    poolKey: { currency0: A(0), currency1: base.external.omr.address, fee: base.hook.poolFee, tickSpacing: base.hook.tickSpacing, hooks: addresses.hook } },
  hook: { poolManager: base.external.poolManager.address, omr: base.external.omr.address, authorized: addresses.coordinator, poolFee: base.hook.poolFee,
    tickSpacing: base.hook.tickSpacing, epochDuration: base.hook.epochDuration, surgeFullTicks: base.hook.surgeFullTicks, openingBlocks: 0, openingBuyBps: 0, openingMaxBuyQuote: 0,
    governanceSafe: base.roles.safe, opsRecipient: base.roles.hookRecipients[0], OPS_SELL_BPS: 200, TAX_CONFIG_DELAY: 172800, TAX_EXECUTION_SAFE_ONLY:true, baseSellBps:900, queuedTaxHash:'0x'+'0'.repeat(64), queuedTaxExecuteAfter:0, taxConfigNonce:0, taxConfig:[160,240,300,100], recipients: [...base.roles.hookRecipients, addresses.polFunding, addresses.reserveFunding] },
  auction: { token: base.external.omr.address, characterNft: base.external.characterNft.address, launchGate: addresses.coordinator, fundsRecipient: addresses.coordinator,
    tokensRecipient: base.roles.safe, currency: A(0), validationHook: addresses.validator, totalSupply: base.auction.totalSupply, minimumRaiseWei: base.auction.requiredCurrencyRaised,
    startBlock: base.auction.startBlock, endBlock: base.auction.endBlock, claimBlock: base.auction.claimBlock, floorPrice: base.auction.floorPrice, tickSpacing: base.auction.tickSpacing,
    launchGateCodeHash: keccak256(fixtureCodes[addresses.coordinator.toLowerCase()]), launchChainId: 4663 },
  validator: { characterNft: base.external.characterNft.address, omr: base.external.omr.address, approvedSupply: base.allocation.totalSupply,
    characterNftCodeHash: base.external.characterNft.runtimeHash, omrCodeHash: base.external.omr.runtimeHash, eligibilityChainId: 4663 },
};
function fixture(options = {}) {
  const candidate = { status: 'CANDIDATE_NOT_APPROVED_NOT_READY', activationReady: false, evidenceSha256: '22'.repeat(32), input: structuredClone(base) };
  const owners = [A(700), A(701), A(702)], safeCode = '0x6022', arbCode = '0xfe';
  const evidence = { canonicalSnapshotRechecked: true, chainId: 4663, observation: base.observation,
    codes: { safe: { keccak256: keccak256(safeCode) }, arbSys: { keccak256: keccak256(arbCode) } },
    reads: { safeOwners: owners }, nativeClock: { samples: base.nativeClock.samples.map(s => ({ ...s, blockHash: H })) } };
  const block = args => ({ number: args?.blockNumber ?? 1000n, hash: options.reorg ? '0x' + '88'.repeat(32) : H,
    timestamp: args?.blockNumber === 900n ? 1999995680n : 2000000000n });
  const requests = [];
  const client = {
    getChainId: async () => options.wrongChain ? 1 : 4663, getBlock: async args => block(args),
    getTransactionCount: async () => options.nonceChanged ? 28 : 27,
    getCode: async ({ address, blockNumber }) => { requests.push({ address, blockNumber }); const lower = address.toLowerCase();
      if (lower === base.roles.deployer.toLowerCase()) return options.deployerCode ? '0x6001' : '0x';
      if (lower === base.roles.safe.toLowerCase()) return safeCode;
      if (lower === base.create2.factory.toLowerCase()) return factoryCode;
      if (lower === A(100).toLowerCase()) return arbCode;
      if (options.occupied && lower === addresses.coordinator.toLowerCase()) return '0x6001';
      return options.badRuntime && lower === base.external.omr.address.toLowerCase() ? '0x6000' : externalCodes[lower] || '0x'; },
    readContract: async ({ address, functionName, blockNumber }) => { requests.push({ address, blockNumber });
      const values = { totalSupply: options.supplyDrift ? 100000000n * E + 1n : 100000000n * E, balanceOf: 100000000n * E, decimals: 18,
        minter: A(0), sellTaxBps: 0n, ammPairs: false, poolManager: base.external.poolManager.address, permit2: base.external.permit2.address,
        getOwners: owners, getThreshold: options.badThreshold ? 1n : 2n, arbBlockNumber: 1000n };
      assert(Object.hasOwn(values, functionName)); return values[functionName]; },
  };
  const forkClient = {
    getChainId: async () => 4663, getBlock: async args => block(args),
    getCode: async ({ address }) => {
      const lower = address.toLowerCase(); if (lower === A(100).toLowerCase()) return arbCode;
      if (externalCodes[lower]) return externalCodes[lower];
      if (options.badSchedule && lower === addresses.scheduleStore.toLowerCase()) return '0x006001';
      if (options.wrongClock && lower === addresses.auction.toLowerCase()) return loadGenesisAuctionArtifact('OmertaGuardedAuction').runtimeTemplate;
      if (options.wrongPrivateHash && lower === addresses.coordinator.toLowerCase()) {
        const a = loadGenesisAuctionArtifact('OmertaAuctionCoordinatorV2'); let code = fixtureCodes[lower];
        for (const { start, length } of a.evidence.immutableReferences[a.privateDependencyImmutableIds._managerHash])
          code = code.slice(0, 2 + start * 2) + '0'.repeat(length * 2) + code.slice(2 + (start + length) * 2);
        return code;
      }
      if (options.tamperCode && lower === addresses.hook.toLowerCase()) return '0x00' + fixtureCodes[lower].slice(4);
      return fixtureCodes[lower];
    },
    readContract: async ({ address, functionName, args = [] }) => {
      const role = Object.keys(addresses).find(k => addresses[k].toLowerCase() === address.toLowerCase());
      if (options.wrongBinding && role === 'validator' && functionName === 'omr') return A(0);
      assert(Object.hasOwn(bindings[role], functionName), `${role}.${functionName}`);
      return functionName === 'recipients' ? bindings[role][functionName][Number(args[0])] : bindings[role][functionName];
    },
  };
  return { candidate, evidence, evidenceSha256: candidate.evidenceSha256, client, forkClient: options.noFork ? null : forkClient,
    nowMs: 2000000000000, requests };
}
let f = fixture(), result = await verifyGenesisAuctionPreflight(f);
assert.equal(result.signingReady, false); assert.equal(result.forkVerified, true); assert.equal(result.forkSnapshots.length, 7);
assert.equal(result.deploymentTransactions.length, 5); assert.equal(result.safeFundingCalls.length, 3);
assert.deepEqual(result.auxiliaryRuntimeChecks.map(x => x.name), ['validator', 'scheduleStore']);
assert.equal(result.forkNativeClock.constructorArbSysSelectionVerified, true); assert.equal(result.forkNativeClock.nativeExecutionProof, false);
assert(f.requests.every(r => r.blockNumber === 1000n));
result = await verifyGenesisAuctionPreflight(fixture({ noFork: true })); assert.equal(result.forkVerified, false); assert.equal(result.signingReady, false);
for (const [name, pattern] of [['wrongChain', /Wrong primary/], ['nonceChanged', /nonce changed/], ['deployerCode', /EOA/],
  ['badRuntime', /runtime changed/], ['supplyDrift', /supply/], ['badThreshold', /threshold/], ['reorg', /reorganized|reorganization/],
  ['occupied', /occupied/], ['badSchedule', /schedule store/], ['wrongClock', /fallback clock/], ['wrongPrivateHash', /wrong private dependency hash/],
  ['tamperCode', /runtime not compiled/], ['wrongBinding', /getter mismatch/]])
  await assert.rejects(() => verifyGenesisAuctionPreflight(fixture({ [name]: true })), pattern, name);
f = fixture(); f.evidenceSha256 = '33'.repeat(32); await assert.rejects(() => verifyGenesisAuctionPreflight(f), /evidence hash/);
f = fixture(); f.nowMs += 121000; await assert.rejects(() => verifyGenesisAuctionPreflight(f), /Stale primary/);
console.log('Read-only genesis preflight PASS: real compiled-runtime templates, five main/two auxiliary SHA snapshots, actual-clock immutable selection, nine dependency/getter bindings, source/head/nonce/supply/authority/runtime/schedule rejection; no key, signing or broadcasting and signingReady remains false.');

// Actual transport wiring, not a high-level fixture that ignores block selectors.
const rpcAddress = A(1);
const rpcHashA = '0x' + 'a1'.repeat(32), rpcHashB = '0x' + 'b2'.repeat(32), rpcCalls = [];
let rpcHeader = { number: '0xa', hash: rpcHashA, timestamp: '0x1', transactions: [] }, rpcChain = '0x1237', rejectHash = false;
const rawGenesisRequest = async args => {
  rpcCalls.push(structuredClone(args));
  if (args.method === 'eth_chainId') return rpcChain;
  if (args.method === 'eth_getBlockByNumber') return rpcHeader;
  if (rejectHash && args.params[1]?.blockHash) throw Error('provider rejects canonical hash selector');
  return args.method === 'eth_call' ? '0x' + '0'.repeat(62) + '12' : '0x6000';
};
const pinnedRpc = genesisSnapshotRequest(rawGenesisRequest, { maximumHeaders: 1 });
assert.throws(() => genesisSnapshotRequest(rawGenesisRequest, { maximumHeaders: 257 }), /configuration/);
await assert.rejects(() => pinnedRpc({ method: 'eth_call', params: [{ to: rpcAddress }, '0xa'] }), /unknown/);
await pinnedRpc({ method: 'eth_getBlockByNumber', params: ['latest', false] });
const originalRead = { method: 'eth_call', params: [{ to: rpcAddress, data: '0x1234', value: '0x0' }, '0xa', { state: 'unchanged' }] };
await pinnedRpc(originalRead);
assert.deepEqual(rpcCalls.at(-1).params, [originalRead.params[0], { blockHash: rpcHashA, requireCanonical: true }, originalRead.params[2]]);
assert.equal(originalRead.params[1], '0xa');
await assert.rejects(() => pinnedRpc({ method: 'eth_call', params: [{ to: rpcAddress }, 'latest'] }), /canonical snapshot/);
await assert.rejects(() => pinnedRpc({ method: 'eth_getCode', params: [rpcAddress, { blockHash: rpcHashB, requireCanonical: true }] }), /unknown/);
await assert.rejects(() => pinnedRpc({ method: 'eth_getCode', params: [rpcAddress, { blockHash: rpcHashA, requireCanonical: false }] }), /noncanonical/);
rpcHeader = { ...rpcHeader, hash: rpcHashB };
await assert.rejects(() => pinnedRpc({ method: 'eth_getBlockByNumber', params: ['0xa', false] }), /snapshot changed/);
await assert.rejects(() => pinnedRpc({ method: 'eth_getBlockByNumber', params: ['0xb', false] }), /wrong number/);
rpcHeader = { ...rpcHeader, number: '0xb' };
await pinnedRpc({ method: 'eth_getBlockByNumber', params: ['0xb', false] });
await assert.rejects(() => pinnedRpc({ method: 'eth_getCode', params: [rpcAddress, '0xa'] }), /unknown/); // bounded eviction
for (const method of ['eth_getBalance', 'eth_getTransactionCount']) for (const tag of ['latest', 'pending']) {
  await pinnedRpc({ method, params: [rpcAddress, tag] }); assert.equal(rpcCalls.at(-1).params[1], tag);
}
rejectHash = true; const rejectedReadStart = rpcCalls.length;
await assert.rejects(() => pinnedRpc({ method: 'eth_getCode', params: [rpcAddress, '0xb'] }), /rejects canonical/);
assert.equal(rpcCalls.length, rejectedReadStart + 1); // no weaker selector retry
rejectHash = false; await pinnedRpc({ method: 'eth_chainId' }); rpcChain = '0x1';
await assert.rejects(() => pinnedRpc({ method: 'eth_chainId' }), /chain changed/);
await assert.rejects(() => pinnedRpc({ method: 'eth_getCode', params: [rpcAddress, '0xb'] }), /unknown/);
rpcHeader = { number: '0xa', hash: rpcHashA, timestamp: '0x1', transactions: [] }; rpcChain = '0x1237';
const actualGenesisClient = createPublicClient({ transport: genesisSnapshotTransport(custom({ request: rawGenesisRequest }, { retryCount: 0 })) });
const actualHeader = await actualGenesisClient.getBlock();
assert.equal(await actualGenesisClient.readContract({ address: rpcAddress, abi: parseAbi(['function decimals() view returns (uint8)']), functionName: 'decimals', blockNumber: actualHeader.number }), 18);
assert.deepEqual(rpcCalls.at(-1).params[1], { blockHash: rpcHashA, requireCanonical: true });
await actualGenesisClient.getCode({ address: rpcAddress, blockNumber: actualHeader.number });
assert.deepEqual(rpcCalls.at(-1).params[1], { blockHash: rpcHashA, requireCanonical: true });
await actualGenesisClient.getBlock({ blockNumber: actualHeader.number }); // final canonical header recheck preserved
rpcHeader = { ...rpcHeader, number: '0x1' + '0'.repeat(64) };
await assert.rejects(() => pinnedRpc({ method: 'eth_getBlockByNumber', params: ['latest', false] }), /unavailable/);
console.log('Genesis canonical hash transport PASS: real viem reads, immutable calldata, unknown/reorg/wrong-header/chain/eviction/provider rejection and live nonce/balance exceptions; no fallback.');
